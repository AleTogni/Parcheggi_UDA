import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { LISTA_PREMI } from '../utils/gamification';

export default function Rewards({ profile, refreshProfile }) {
  const [selectedReward, setSelectedReward] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState(null);

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        <p className="ml-3 font-bold text-emerald-800">Caricamento profilo...</p>
      </div>
    );
  }

  const punti = profile.punti_accumulati || 0;

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const openModal = (premio) => {
    setSelectedReward(premio);
    setQuantity(1); 
  };

  const closeModal = () => {
    setSelectedReward(null);
  };

  const handleRiscatta = async () => {
    if (!selectedReward) return;

    const totalCost = selectedReward.soglia * quantity;

    if (punti < totalCost) {
      showToast('error', `PUNTI INSUFFICIENTI! TI SERVONO ${totalCost} PT.`);
      return;
    }

    setLoading(true);
    
    const { error: updateError } = await supabase
      .from('persona')
      .update({ punti_accumulati: punti - totalCost })
      .eq('idpersona', profile.idpersona);

    if (!updateError) {
      await supabase.from('premi_riscattati').insert([
        { 
          idpersona: profile.idpersona, 
          premio_nome: `${quantity}x ${selectedReward.titolo}`, 
          punti_spesi: totalCost 
        }
      ]);
      
      showToast('success', `RISCATTO CONFERMATO! HAI OTTENUTO ${quantity}X ${selectedReward.titolo.toUpperCase()}`);
      refreshProfile();
      closeModal();
    } else {
      showToast('error', "ERRORE DURANTE IL RISCATTO. RIPROVA PIÙ TARDI.");
    }
    
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24 relative">
      
      {/* NOTIFICHE TOAST */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] px-8 py-3 rounded-2xl shadow-lg transition-all transform animate-fade-in-down w-[90%] max-w-md text-center">
          {toast.type === 'success' ? (
            <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs sm:text-sm tracking-widest py-4 px-2 rounded-xl shadow-sm">
              {toast.message}
            </div>
          ) : (
            <div className="bg-red-50 text-red-600 border border-red-200 font-bold text-xs sm:text-sm tracking-widest py-4 px-2 rounded-xl shadow-sm">
              {toast.message}
            </div>
          )}
        </div>
      )}

      {/* HEADER BILANCIO */}
      <header className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 rounded-3xl text-white shadow-xl mb-10">
        <p className="uppercase tracking-widest text-xs font-bold opacity-80 mb-2">Il tuo bilancio sostenibile</p>
        <h1 className="text-4xl font-black mb-4">{punti} <span className="text-2xl font-normal opacity-90">EcoPoints</span></h1>
        <div className="w-full bg-white/20 h-3 rounded-full overflow-hidden shadow-inner">
          <div className="bg-white h-full transition-all duration-1000" style={{ width: `${Math.min((punti/2000)*100, 100)}%` }}></div>
        </div>
      </header>

      {/* GRIGLIA PREMI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {LISTA_PREMI.map((premio) => (
          <div 
            key={premio.id}
            onClick={() => openModal(premio)}
            className="bg-white p-6 rounded-2xl border-2 border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-tighter">
                  {premio.sottotitolo || premio.categoria}
                </span>
                <span className="font-black text-emerald-800">{premio.soglia} pt</span>
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-emerald-600 transition-colors">{premio.titolo}</h3>
              <p className="text-gray-500 text-sm line-clamp-2">{premio.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL POPUP (Dimensioni FISSE) */}
      {selectedReward && (
        <div 
          onClick={closeModal} 
          className="fixed inset-0 bg-emerald-950/40 backdrop-blur-sm flex items-center justify-center z-[1001] p-4 cursor-pointer"
        >
          {/* Aggiunto md:h-[600px] per forzare l'altezza fissa su desktop */}
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-white rounded-3xl max-w-5xl w-full md:h-[600px] shadow-2xl flex flex-col md:flex-row overflow-hidden relative max-h-[95vh] cursor-auto"
          >
            
            <button 
              onClick={closeModal} 
              className="absolute top-4 right-4 bg-white/90 hover:bg-white text-gray-600 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl z-10 transition-colors shadow-sm backdrop-blur-md"
            >
              ✕
            </button>

            {/* SINISTRA: IMMAGINE (Aggiunto md:h-full) */}
            <div className="md:w-1/2 h-64 md:h-full bg-emerald-50 relative shrink-0">
              <img 
                src={selectedReward.immagine || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=1000&h=1000"} 
                alt={selectedReward.titolo} 
                className="w-full h-full object-cover" 
              />
            </div>

            {/* DESTRA: CONTENUTO (Aggiunto h-full) */}
            <div className="md:w-1/2 p-8 md:p-12 flex flex-col overflow-y-auto h-full">
              <span className="text-emerald-500 font-bold text-xs uppercase tracking-widest mb-2 block shrink-0">
                {selectedReward.sottotitolo || selectedReward.categoria}
              </span>
              <h2 className="text-4xl font-black text-emerald-950 mb-6 shrink-0">{selectedReward.titolo}</h2>
              
              <div className="text-gray-600 mb-8 text-base leading-relaxed flex-grow pr-4">
                {selectedReward.desc.split('\n').map((paragraph, index) => (
                  <p key={index} className="mb-4">{paragraph}</p>
                ))}
              </div>
              
              {/* Selettore Quantità (shrink-0 per evitare che si schiacci se il testo è lungo) */}
              <div className="flex items-center justify-between mb-8 bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shrink-0">
                <span className="font-bold text-emerald-900">Quantità desiderata:</span>
                <div className="flex items-center gap-4 bg-white px-2 py-1 rounded-xl shadow-sm border border-emerald-200">
                  <button 
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="text-emerald-600 hover:bg-emerald-100 w-12 h-12 rounded-lg font-black text-2xl flex items-center justify-center transition-all"
                  >
                    -
                  </button>
                  <span className="font-black text-2xl text-emerald-950 w-8 text-center">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(q => q + 1)}
                    className="text-emerald-600 hover:bg-emerald-100 w-12 h-12 rounded-lg font-black text-2xl flex items-center justify-center transition-all"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Riepilogo e Bottone Conferma (shrink-0) */}
              <div className="flex flex-col mt-auto pt-6 border-t border-gray-100 shrink-0">
                <div className="flex justify-between items-end mb-6">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Costo Totale</span>
                  <span className="text-4xl font-black text-emerald-700">{selectedReward.soglia * quantity} <span className="text-xl font-bold">pt</span></span>
                </div>

                <button 
                  disabled={punti < (selectedReward.soglia * quantity) || loading}
                  onClick={handleRiscatta}
                  className={`w-full py-5 rounded-2xl font-black text-lg tracking-wide uppercase transition-all transform active:scale-[0.98] ${
                    punti >= (selectedReward.soglia * quantity) 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xl shadow-emerald-600/30' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {loading ? 'Elaborazione...' : punti >= (selectedReward.soglia * quantity) ? 'Conferma Riscatto' : 'Punti Insufficienti'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}