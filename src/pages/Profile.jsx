import React, { useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';

export default function Profile({ profile }) {
  const [form, setForm] = useState({ nome: '', cognome: '', is_disabile: false });
  const [targa, setTarga] = useState('');
  const [alimentazione, setAlimentazione] = useState('Termica');
  const [veicoli, setVeicoli] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [uiMessage, setUiMessage] = useState('');
  const [activeTab, setActiveTab] = useState('attive');

  const tariffaOraria = 2.00;

  useEffect(() => {
    if (profile) {
      setForm({
        nome: profile.nome || '',
        cognome: profile.cognome || '',
        is_disabile: profile.is_disabile || false
      });
      loadVeicoli();
      loadPrenotazioni();
    }
  }, [profile]);

  async function loadVeicoli() {
    const { data } = await supabase.from('veicolo').select('*').eq('idpersona', profile.idpersona);
    setVeicoli(data || []);
  }

  async function loadPrenotazioni() {
    const { data } = await supabase.from('prenotazione').select('*').eq('idpersona', profile.idpersona).order('orarioinizio', { ascending: false });
    setPrenotazioni(data || []);
  }

  const showMessage = (msg) => {
    setUiMessage(msg);
    setTimeout(() => setUiMessage(''), 3000);
  };

  const formattaData = (dataIso) => {
    if (!dataIso) return '';
    const d = new Date(dataIso);
    return d.toLocaleString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('persona').update(form).eq('idpersona', profile.idpersona);
    if (error) showMessage("Errore salvataggio."); else showMessage("Profilo aggiornato.");
  };

  const addVeicolo = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('veicolo').insert([{ 
      idpersona: profile.idpersona, 
      targa: targa.toUpperCase(),
      alimentazione: alimentazione 
    }]);
    if (error) showMessage("Errore."); else { setTarga(''); loadVeicoli(); showMessage("Veicolo aggiunto."); }
  };

  const executeCancelBooking = async (pren) => {
    await supabase.from('prenotazione').update({ stato: 'Annullata' }).eq('idprenotazione', pren.idprenotazione);
    await supabase.from('posto_auto').update({ stato: 'Libero' }).eq('idposto', pren.idposto);
    loadPrenotazioni();
    showMessage("Sosta annullata.");
  };

  // FUNZIONE: PROLUNGA SOSTA +1 ORA
  const handleProlungaSosta = async (pren) => {
    const currentEnd = new Date(pren.orariofine);
    const newEnd = new Date(currentEnd.getTime() + 60 * 60 * 1000); // Aggiunge 1 ora
    const nuovoCosto = (parseFloat(pren.costo || 0) + tariffaOraria).toFixed(2);

    const { error } = await supabase.from('prenotazione')
      .update({ 
        orariofine: newEnd.toISOString(), 
        costo: nuovoCosto 
      })
      .eq('idprenotazione', pren.idprenotazione);

    if (error) showMessage("Errore prolungamento.");
    else {
      showMessage("Sosta estesa di +1h!");
      loadPrenotazioni();
    }
  };

  // FUNZIONE: ELIMINAZIONE ACCOUNT
  const handleDeleteAccount = async () => {
    const conferma = window.confirm("ATTENZIONE ZONE ROSSA: Questa operazione è irreversibile. Tutte le tue prenotazioni, le tue targhe e i tuoi dati personali verranno eliminati definitivamente. Vuoi procedere?");
    if (!conferma) return;

    await supabase.rpc('elimina_dati_utente', { p_id: profile.idpersona });
    await supabase.auth.signOut();
    window.location.reload();
  };

  const prenoFiltrate = prenotazioni.filter(p => activeTab === 'attive' ? p.stato === 'Attiva' : p.stato !== 'Attiva');

  return (
    <div className="max-w-5xl mx-auto p-6 mt-10 relative z-0">
      <div className="flex justify-between items-center mb-8 h-10 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-black text-emerald-900">Area Personale</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Gestisci i tuoi dati e le tue soste</p>
        </div>
        {uiMessage && <span className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md animate-fade-in-up">{uiMessage}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* REINSERITA LA SEZIONE DATI PERSONALI */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h2 className="text-xl font-bold mb-6 text-gray-800">Dati Personali</h2>
          <form onSubmit={handleUpdate} className="space-y-4 flex-grow flex flex-col">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nome</label>
                <input type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="Nome" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cognome</label>
                <input type="text" value={form.cognome} onChange={e => setForm({...form, cognome: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="Cognome" />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 hover:bg-emerald-100/50 transition-colors cursor-pointer" onClick={() => setForm({...form, is_disabile: !form.is_disabile})}>
              <input 
                type="checkbox" 
                checked={form.is_disabile} 
                onChange={e => setForm({...form, is_disabile: e.target.checked})}
                className="w-5 h-5 accent-emerald-600 cursor-pointer pointer-events-none"
              />
              <label className="text-sm font-bold text-emerald-900 cursor-pointer pointer-events-none">Possiedo il Pass Disabili</label>
            </div>
            
            <button className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-bold shadow-sm transition-colors mt-auto">Salva Modifiche</button>
          </form>
        </div>

        {/* REINSERITA LA SEZIONE VEICOLI */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h2 className="text-xl font-bold mb-6 text-gray-800">I tuoi Veicoli</h2>
          <form onSubmit={addVeicolo} className="space-y-3 mb-6">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Targa</label>
                <input type="text" value={targa} onChange={e => setTarga(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl uppercase bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-bold" placeholder="Es. AB123CD" required />
              </div>
              <div className="w-32">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Motore</label>
                <select value={alimentazione} onChange={e => setAlimentazione(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer">
                  <option value="Termica">Termica</option>
                  <option value="Elettrica">Elettrica</option>
                </select>
              </div>
              <div className="flex items-end">
                <button className="bg-emerald-700 hover:bg-emerald-800 text-white h-[46px] px-6 rounded-xl font-black shadow-sm transition-colors">+</button>
              </div>
            </div>
          </form>
          
          <div className="space-y-2 overflow-y-auto max-h-[150px] custom-scrollbar pr-1">
            {veicoli.length === 0 && <p className="text-gray-400 text-sm font-medium text-center py-4">Nessun veicolo salvato.</p>}
            {veicoli.map(v => (
              <div key={v.targa} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex justify-between items-center font-bold transition-colors">
                <span className="font-mono text-gray-800 tracking-wider">{v.targa}</span>
                <span className={`text-[10px] px-2 py-1 rounded uppercase border ${v.alimentazione === 'Elettrica' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}>
                  {v.alimentazione}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* STORICO PRENOTAZIONI CON FUNZIONE PROLUNGA E ALTEZZA FISSA */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Le tue Soste</h2>
            
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setActiveTab('attive')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'attive' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>In corso</button>
              <button onClick={() => setActiveTab('storico')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'storico' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>Storico</button>
            </div>
          </div>
          
          <div className="h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {prenoFiltrate.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Nessuna prenotazione trovata</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                {prenoFiltrate.map(p => (
                  <div key={p.idprenotazione} className="p-5 border border-gray-100 rounded-xl bg-gray-50 hover:bg-white hover:border-gray-200 transition-all flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="font-black text-gray-800 text-lg block">Stallo #{p.idposto}</span>
                        <span className="font-mono text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded mt-1 inline-block">{p.targa}</span>
                      </div>
                      
                      <span className={`text-[10px] uppercase px-2 py-1 rounded font-bold border ${
                        p.stato === 'Attiva' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                        p.stato === 'Conclusa' ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                        'bg-gray-200 text-gray-500 border-gray-300'
                      }`}>
                        {p.stato}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 space-y-1.5 flex-grow">
                      <div className="flex justify-between">
                        <span>Arrivo:</span>
                        <span className="text-gray-900 font-bold">{formattaData(p.orarioinizio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Uscita:</span>
                        <span className="text-gray-900 font-bold">{formattaData(p.orariofine)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-100 mt-2">
                        <span>Costo:</span>
                        <span className="text-emerald-700 font-black">{p.costo ? `${p.costo} €` : '0.00 €'}</span>
                      </div>
                    </div>
                    
                    {p.stato === 'Attiva' && (
                      <div className="flex gap-2 mt-5">
                        <button 
                          onClick={() => handleProlungaSosta(p)} 
                          className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
                        >
                          Prolunga +1h
                        </button>
                        <button onClick={() => executeCancelBooking(p)} className="flex-1 py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 hover:border-red-300 transition-all">
                          Annulla Sosta
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ZONA ROSSA: ELIMINAZIONE ACCOUNT */}
        <div className="lg:col-span-2 bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm mt-4">
          <h2 className="text-lg font-black text-red-900 mb-2">Zona di Pericolo</h2>
          <p className="text-sm text-red-700 mb-4 font-medium">Questa azione eliminerà definitivamente il tuo account, le tue targhe e tutto il tuo storico dal nostro database. L'operazione non può essere annullata.</p>
          <button 
            onClick={handleDeleteAccount} 
            className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold shadow-sm hover:bg-red-700 hover:shadow-md transition-all border border-red-700"
          >
            Elimina Definitivamente Account
          </button>
        </div>

      </div>
    </div>
  );
}