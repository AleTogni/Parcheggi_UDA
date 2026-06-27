import React, { useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';
import { LISTA_PREMI } from '../utils/gamification';

// --- LOGICA DEI LIVELLI (Emoji mantenute solo qui come richiesto) ---
const getLevelInfo = (punti) => {
  if (punti < 500) return { livello: 1, nome: 'Seme', icona: '🌱', min: 0, max: 500, colore: 'text-emerald-500' };
  if (punti < 1500) return { livello: 2, nome: 'Germoglio', icona: '🌿', min: 500, max: 1500, colore: 'text-green-500' };
  if (punti < 3000) return { livello: 3, nome: 'Albero', icona: '🌳', min: 1500, max: 3000, colore: 'text-teal-600' };
  return { livello: 4, nome: 'Foresta', icona: '🌲', min: 3000, max: 5000, colore: 'text-emerald-800' };
};

export default function Rewards({ profile, refreshProfile }) {
  const [selectedReward, setSelectedReward] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState(null);

  // --- STATI ANIMAZIONE BATTERIA E PUNTEGGIO ---
  const [batteryPercent, setBatteryPercent] = useState(5); // Minimo 5% per estetica
  const [displayedPoints, setDisplayedPoints] = useState(0);

  // --- STATI ASSISTENTE VIRTUALE ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [assistantIndex, setAssistantIndex] = useState(0);

  const assistantMessages = [
    "Benvenuto nella sezione EcoPoints. Come posso assisterti con il catalogo premi?",
    "I punti vengono calcolati automaticamente al termine di ogni sosta. I veicoli elettrici beneficiano di un moltiplicatore.",
    "Per richiedere un premio, selezionalo dal catalogo. L'importo verrà detratto dal tuo saldo.",
    "I voucher digitali verranno recapitati all'indirizzo email associato al tuo account.",
    "Il servizio di assistenza ha raggiunto il limite di query per questa sessione. Ti invitiamo a contattare il supporto tecnico."
  ];

  const assistantPhoto = '/shared image.png';

  const handleSendMessage = () => {
    if (!userInput.trim()) return;
    setChatMessages(prev => [...prev, { sender: 'user', text: userInput }]);
    const responseText = assistantMessages[assistantIndex] || "Limite sessione raggiunto. Contatta l'assistenza per ulteriori informazioni.";
    setTimeout(() => {
      setChatMessages(prev => [...prev, { sender: 'assistant', text: responseText }]);
    }, 500);
    setUserInput('');
    setAssistantIndex(prev => Math.min(prev + 1, assistantMessages.length));
  };

  useEffect(() => {
    const chatContainer = document.querySelector('.chat-messages-rewards');
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  }, [chatMessages]);

  // --- ANIMAZIONI BLINDATE (NON RIPARTONO AL CAMBIO TEMA) ---
  const puntiReali = profile?.punti_accumulati || 0;
  const levelInfo = getLevelInfo(puntiReali);

  useEffect(() => {
    if (profile !== null) {
      // 1. Calcolo percentuale barra verde fluida
      const puntiNelLivello = puntiReali - levelInfo.min;
      const targetLivello = levelInfo.max - levelInfo.min;
      const targetPercent = Math.min(Math.max((puntiNelLivello / targetLivello) * 100, 5), 100);
      
      // Piccolo delay per far scattare la transizione CSS all'apertura
      setTimeout(() => setBatteryPercent(targetPercent), 100);

      // 2. Animazione numerica (Effetto Contachilometri)
      if (puntiReali === 0) {
        setDisplayedPoints(0);
        return;
      }

      let current = 0;
      const duration = 1500; 
      const interval = 16; 
      const step = Math.max(puntiReali / (duration / interval), 1);

      const counter = setInterval(() => {
        current += step;
        if (current >= puntiReali) {
          setDisplayedPoints(puntiReali);
          clearInterval(counter);
        } else {
          setDisplayedPoints(Math.floor(current));
        }
      }, interval);

      return () => clearInterval(counter);
    }
  }, [puntiReali]); // Dipende SOLO dai punti. Cambiare pagina o tema non fa ripartire nulla.

  // --- SKELETON LOADING ---
  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 sm:mt-10 pb-24 relative animate-pulse">
        <div className="bg-gray-200 dark:bg-gray-800 h-[250px] rounded-3xl mb-10"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={`reward-skeleton-${n}`} className="bg-gray-100 dark:bg-gray-800 h-[220px] rounded-3xl"></div>
          ))}
        </div>
      </div>
    );
  }

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRiscatta = async () => {
    if (!selectedReward) return;
    const totalCost = selectedReward.soglia * quantity;
    if (puntiReali < totalCost) return showToast('error', `PUNTI INSUFFICIENTI! TI SERVONO ${totalCost} PT.`);

    setLoading(true);
    const { error: updateError } = await supabase.from('persone').update({ punti_accumulati: puntiReali - totalCost }).eq('idpersona', profile.idpersona);

    if (!updateError) {
      await supabase.from('premi_riscattati').insert([{ idpersona: profile.idpersona, premio_nome: `${quantity}x ${selectedReward.titolo}`, punti_spesi: totalCost }]);
      showToast('success', `RISCATTO CONFERMATO! HAI OTTENUTO ${quantity}X ${selectedReward.titolo.toUpperCase()}`);
      refreshProfile();
      setSelectedReward(null);
    } else {
      showToast('error', "ERRORE DURANTE IL RISCATTO. RIPROVA PIÙ TARDI.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 sm:mt-8 pb-24 relative z-0">
      
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] px-8 py-3 rounded-2xl shadow-lg transition-all transform animate-fade-in-down w-[90%] max-w-md text-center">
          <div className={`font-bold text-xs sm:text-sm tracking-widest py-4 px-2 rounded-xl shadow-sm border ${toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'}`}>
            {toast.message}
          </div>
        </div>
      )}

      {/* HEADER: BATTERIA E LIVELLI */}
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-10 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-xl mb-8 flex flex-col md:flex-row items-center gap-8 md:gap-12 relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-emerald-100 dark:bg-emerald-900 opacity-50 dark:opacity-20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex-1 text-center md:text-left z-10 w-full">
          <div className="inline-flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 px-4 py-2 rounded-full mb-4 shadow-sm transition-colors">
            <span className="text-2xl">{levelInfo.icona}</span>
            <span className="text-xs font-black uppercase tracking-widest text-gray-600 dark:text-gray-300">Livello {levelInfo.livello}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white mb-2 tracking-tight transition-colors">{levelInfo.nome}</h1>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            {puntiReali >= levelInfo.max 
              ? "Hai raggiunto il livello massimo!" 
              : `Ti mancano ${levelInfo.max - puntiReali} pt per lo sblocco successivo.`}
          </p>
        </div>

        <div className="w-full md:w-1/2 flex flex-col items-center md:items-end z-10">
          <div className="flex justify-between items-end w-full max-w-[320px] mb-2 px-1">
            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Avanzamento Livello</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{Math.round(batteryPercent)}%</span>
          </div>

          <div className="relative flex items-center w-full max-w-[320px]">
            <div className="flex-1 h-16 sm:h-20 bg-gray-100 dark:bg-gray-700 border-4 border-gray-200 dark:border-gray-600 rounded-2xl p-1 relative shadow-inner overflow-hidden transition-colors">
              <div 
                className="h-full rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 relative transition-all duration-[1500ms] ease-out shadow-[0_0_20px_rgba(52,211,153,0.4)]"
                style={{ width: `${batteryPercent}%` }}
              >
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/20 rounded-t-xl"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-gray-900 dark:text-white drop-shadow-md tracking-tighter">
                  {displayedPoints} <span className="text-xs font-bold opacity-80 tracking-widest ml-1">PT</span>
                </span>
              </div>
            </div>
            <div className="w-4 h-8 bg-gray-200 dark:bg-gray-600 rounded-r-lg ml-1 border-y-4 border-r-4 border-gray-200 dark:border-gray-600 transition-colors"></div>
          </div>
        </div>
      </div>

      {/* SEZIONE 3 CARD INFO (Rifatte senza emoji, con colori pastello ed effetto dark mode) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-5 rounded-2xl flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800/50">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">Sosta Smart</h4>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Punti base per ogni ticket</p>
          </div>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 p-5 rounded-2xl flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-full flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800/50">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h4 className="font-black text-sm text-emerald-900 dark:text-emerald-100">Guida Eco</h4>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mt-0.5">Moltiplicatore per veicoli EV</p>
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 p-5 rounded-2xl flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 rounded-full flex items-center justify-center shrink-0 border border-purple-200 dark:border-purple-800/50">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          </div>
          <div>
            <h4 className="font-black text-sm text-purple-900 dark:text-purple-100">Riscatto</h4>
            <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mt-0.5">Scegli dal catalogo ufficiale</p>
          </div>
        </div>

      </div>

      {/* TITOLO GRIGLIA PREMI */}
      <div className="mb-6 flex items-center gap-4">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight transition-colors">Catalogo Premi</h2>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 mt-1 transition-colors"></div>
      </div>

      {/* GRIGLIA PREMI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {LISTA_PREMI.map((premio) => (
          <div 
            key={premio.id}
            onClick={() => { setSelectedReward(premio); setQuantity(1); }}
            className="bg-white dark:bg-gray-800 p-6 rounded-3xl border-2 border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg hover:border-emerald-400 dark:hover:border-emerald-500 hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col h-[220px]"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/50 transition-colors">
                {premio.sottotitolo || premio.categoria}
              </span>
              <span className="font-black text-emerald-800 dark:text-emerald-400 text-lg transition-colors">{premio.soglia} <span className="text-xs">pt</span></span>
            </div>
            <h3 className="text-xl font-black mb-3 text-gray-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-tight">{premio.titolo}</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium line-clamp-3 leading-relaxed mt-auto transition-colors">{premio.desc}</p>
          </div>
        ))}
      </div>

      {/* MODAL POPUP PREMIO */}
      {selectedReward && (
        <div onClick={() => setSelectedReward(null)} className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-[1001] p-4 cursor-pointer transition-all">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-900 rounded-[2.5rem] max-w-5xl w-full md:h-[600px] shadow-2xl flex flex-col md:flex-row overflow-hidden relative max-h-[95vh] cursor-auto animate-scale-up border border-gray-200 dark:border-gray-700">
            
            {/* BOTTONE CHIUSURA FIXATO PER DARK E LIGHT MODE */}
            <button 
              onClick={() => setSelectedReward(null)} 
              className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl z-10 shadow-md backdrop-blur-md transition-all 
                         bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              ✕
            </button>

            <div className="md:w-1/2 h-48 md:h-full bg-gray-100 dark:bg-gray-800 relative shrink-0 transition-colors">
              <img src={selectedReward.immagine || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80"} alt={selectedReward.titolo} className="w-full h-full object-cover" />
            </div>

            <div className="md:w-1/2 p-8 md:p-12 flex flex-col overflow-y-auto h-full bg-white dark:bg-gray-900 transition-colors">
              <span className="text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-[0.2em] mb-3 block shrink-0">
                {selectedReward.sottotitolo || selectedReward.categoria}
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-6 shrink-0 leading-tight transition-colors">{selectedReward.titolo}</h2>
              
              <div className="text-gray-600 dark:text-gray-300 mb-8 text-sm md:text-base font-medium leading-relaxed flex-grow pr-2 transition-colors">
                {selectedReward.desc.split('\n').map((paragraph, index) => (
                  <p key={index} className="mb-4">{paragraph}</p>
                ))}
              </div>
              
              <div className="flex items-center justify-between mb-8 bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shrink-0 transition-colors">
                <span className="font-bold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-widest">Quantità</span>
                <div className="flex items-center gap-4 bg-white dark:bg-gray-900 px-2 py-1.5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-gray-800 w-10 h-10 rounded-lg font-black text-xl transition-all flex items-center justify-center">-</button>
                  <span className="font-black text-xl text-gray-900 dark:text-white w-6 text-center transition-colors">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)} className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-gray-800 w-10 h-10 rounded-lg font-black text-xl transition-all flex items-center justify-center">+</button>
                </div>
              </div>

              <div className="flex flex-col mt-auto pt-6 border-t border-gray-100 dark:border-gray-800 shrink-0 transition-colors">
                <div className="flex justify-between items-end mb-6">
                  <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Totale richiesto</span>
                  <span className="text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter transition-colors">{selectedReward.soglia * quantity} <span className="text-lg font-bold">pt</span></span>
                </div>

                <button 
                  disabled={puntiReali < (selectedReward.soglia * quantity) || loading}
                  onClick={handleRiscatta}
                  className={`w-full py-4 rounded-2xl font-black text-base tracking-widest uppercase transition-all transform active:scale-95 ${
                    puntiReali >= (selectedReward.soglia * quantity) 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 dark:shadow-none' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {loading ? 'Elaborazione...' : puntiReali >= (selectedReward.soglia * quantity) ? 'Conferma Riscatto' : 'Punti Insufficienti'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* FAB ASSISTENTE */}
      <div className="fixed bottom-6 right-4 sm:right-6 z-[200]">
        <button
          onClick={() => setIsChatOpen(true)}
          className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 border-2 border-white dark:border-gray-900"
        >
          <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      </div>

      {/* MODAL CHAT ASSISTENTE */}
      {isChatOpen && (
        <div onClick={() => setIsChatOpen(false)} className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 z-[300] transition-all">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-900 w-full sm:max-w-md sm:rounded-3xl rounded-t-[2rem] p-5 sm:p-6 shadow-2xl relative flex flex-col h-[80vh] sm:max-h-[600px] animate-scale-up border border-gray-200 dark:border-gray-800 transition-colors">
            <div className="sm:hidden w-10 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4" />
            <button onClick={() => setIsChatOpen(false)} className="absolute top-5 right-5 text-2xl font-bold text-gray-300 dark:text-gray-600 hover:text-gray-800 dark:hover:text-gray-300 transition-colors">&times;</button>
            <div className="flex items-center gap-4 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4 transition-colors">
              <img src={assistantPhoto} alt="Assistente" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-emerald-500 shadow-sm" />
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter leading-none transition-colors">Assistente Virtuale</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 transition-colors">Gamification</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 chat-messages-rewards pr-2 custom-scrollbar">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3.5 rounded-2xl max-w-[85%] text-sm font-medium leading-relaxed shadow-sm transition-colors ${msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-2xl border border-gray-200 dark:border-gray-700 shrink-0 transition-colors">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Richiedi informazioni sui premi..."
                className="flex-1 p-2 bg-transparent outline-none text-sm font-medium text-gray-900 dark:text-white transition-colors"
              />
              <button 
                onClick={handleSendMessage} 
                disabled={!userInput.trim()}
                className="bg-emerald-600 text-white w-10 h-10 rounded-xl hover:bg-emerald-700 transition-all shrink-0 flex items-center justify-center disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}