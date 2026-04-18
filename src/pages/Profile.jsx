import React, { useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';

export default function Profile({ profile }) {
  const [form, setForm] = useState({ nome: '', cognome: '', telefono: '', citta: '', via: '', cap: '' });
  const [targa, setTarga] = useState('');
  const [veicoli, setVeicoli] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  
  // Gestione Tabs (Attive vs Storico)
  const [activeTab, setActiveTab] = useState('attive'); 

  const [uiMessage, setUiMessage] = useState('');
  const [confirmCancelId, setConfirmCancelId] = useState(null); 
  const [confirmDeletePlate, setConfirmDeletePlate] = useState(null);

  useEffect(() => {
    if (profile) {
      setForm({
        nome: profile.nome || '', cognome: profile.cognome || '',
        telefono: profile.telefono || '', citta: profile.citta || '',
        via: profile.via || '', cap: profile.cap || ''
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
    const { data } = await supabase.from('prenotazione').select('*').eq('idpersona', profile.idpersona).order('idprenotazione', { ascending: false });
    setPrenotazioni(data || []);
  }

  const showMessage = (msg) => {
    setUiMessage(msg);
    setTimeout(() => setUiMessage(''), 3000);
  };

  const formattaData = (dataIso) => {
    if (!dataIso) return '';
    return new Date(dataIso).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('persona').update(form).eq('idpersona', profile.idpersona);
    if (error) showMessage("Errore: " + error.message); 
    else showMessage("Profilo aggiornato con successo.");
  };

  const addVeicolo = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('veicolo').insert([{ idpersona: profile.idpersona, targa: targa.toUpperCase() }]);
    if (error) showMessage("Errore veicolo: " + error.message); 
    else { setTarga(''); loadVeicoli(); showMessage("Veicolo aggiunto."); }
  };

  const deleteVeicolo = async (targaDaEliminare) => {
    const { data, error } = await supabase
      .from('veicolo')
      .delete()
      .eq('targa', targaDaEliminare)
      .eq('idpersona', profile.idpersona)
      .select(); 

    if (error) {
      showMessage("Errore dal DB: " + error.message);
    } else if (!data || data.length === 0) {
      showMessage("Errore: La targa non corrisponde.");
    } else {
      setConfirmDeletePlate(null);
      loadVeicoli();
      showMessage("Veicolo rimosso.");
    }
  };

  const executeCancelBooking = async (prenotazione) => {
    const colonnaId = prenotazione.idprenotazione ? 'idprenotazione' : 'id';
    const valoreId = prenotazione.idprenotazione || prenotazione.id;

    const { data, error: errPren } = await supabase
      .from('prenotazione')
      .update({ stato: 'Annullata' })
      .eq(colonnaId, valoreId)
      .select();

    if (errPren) return showMessage("Errore annullamento: " + errPren.message);
    if (!data || data.length === 0) return showMessage("Prenotazione non trovata.");

    const { error: errPosto } = await supabase.from('posto_auto').update({ stato: 'Libero' }).eq('idposto', prenotazione.idposto);
    if (errPosto) return showMessage("Sosta annullata, errore posto: " + errPosto.message);
    
    setConfirmCancelId(null);
    loadPrenotazioni();
    showMessage("Sosta annullata e posto liberato!");
  };

  if (!profile) return <div className="p-10 text-center">Caricamento in corso...</div>;

  // FILTRIAMO LE PRENOTAZIONI IN BASE AL TAB SELEZIONATO
  const prenotazioniFiltrate = prenotazioni.filter(pren => 
    activeTab === 'attive' ? pren.stato === 'Attiva' : pren.stato !== 'Attiva'
  );

  return (
    <div className="max-w-5xl mx-auto p-6 mt-10">
      <div className="flex justify-between items-center mb-8 h-10">
        <h1 className="text-3xl font-black text-emerald-900">Area Personale</h1>
        {uiMessage && (
          <span className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold animate-pulse shadow-md">
            {uiMessage}
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* COLONNA PROFILO */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-4">Dati Personali</h2>
          <form onSubmit={handleUpdate} className="space-y-4">
            <input type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:border-emerald-500" placeholder="Nome" />
            <input type="text" value={form.cognome} onChange={e => setForm({...form, cognome: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:border-emerald-500" placeholder="Cognome" />
            <button className="w-full bg-emerald-700 text-white py-3 rounded-xl font-bold hover:bg-emerald-800 transition shadow-sm">Salva Modifiche</button>
          </form>
        </div>
        
        {/* COLONNA VEICOLI */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-4">I tuoi Veicoli</h2>
          <form onSubmit={addVeicolo} className="flex gap-2 mb-4">
            <input type="text" value={targa} onChange={e => setTarga(e.target.value)} className="flex-1 p-3 border rounded-xl uppercase bg-gray-50 outline-none focus:border-emerald-500" placeholder="Targa (es. AB123CD)" required />
            <button className="bg-emerald-700 text-white px-6 rounded-xl font-bold hover:bg-emerald-800 transition shadow-sm">+</button>
          </form>
          
          <div className="space-y-2">
            {veicoli.length === 0 && <p className="text-gray-400 text-sm">Nessun veicolo salvato.</p>}
            {veicoli.map(v => (
              <div key={v.targa} className="p-3 bg-gray-50 border rounded-xl font-mono text-lg font-bold flex justify-between items-center text-gray-700">
                <span>{v.targa}</span>
                {confirmDeletePlate === v.targa ? (
                  <div className="flex gap-2">
                    <button onClick={() => deleteVeicolo(v.targa)} className="text-xs bg-red-600 text-white px-3 py-1 rounded shadow-sm hover:bg-red-700 transition">Conferma</button>
                    <button onClick={() => setConfirmDeletePlate(null)} className="text-xs bg-gray-300 text-gray-700 px-3 py-1 rounded transition hover:bg-gray-400">Indietro</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeletePlate(v.targa)} className="text-sm text-red-400 hover:text-red-600 font-normal transition">Elimina</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* COLONNA PRENOTAZIONI CON TABS */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
          
          {/* INTESTAZIONE E SELETTORE TABS */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-xl font-bold text-emerald-900">Gestione Prenotazioni</h2>
            
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('attive')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'attive' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                In corso
              </button>
              <button 
                onClick={() => setActiveTab('storico')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'storico' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Storico
              </button>
            </div>
          </div>

          {prenotazioniFiltrate.length === 0 ? (
             <p className="text-gray-500 text-sm">Nessuna prenotazione trovata in questa sezione.</p>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {prenotazioniFiltrate.map(pren => {
                 const isAttiva = pren.stato === 'Attiva';
                 return (
                   <div key={pren.idprenotazione} className={`p-4 border rounded-xl flex flex-col gap-3 ${isAttiva ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}>
                     
                     <div className="flex justify-between items-start">
                       <div>
                         <span className="font-black text-lg block text-gray-800">Posto #{pren.idposto}</span>
                         <span className="font-mono text-gray-600 text-sm bg-gray-50 px-2 py-0.5 rounded border border-gray-200 mt-1 inline-block">🚘 {pren.targa}</span>
                       </div>
                       <span className={`text-xs px-2 py-1 rounded font-bold uppercase shadow-sm ${isAttiva ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                         {pren.stato}
                       </span>
                     </div>
                     
                     <div className={`text-sm text-gray-700 p-3 rounded-lg border ${isAttiva ? 'bg-white border-emerald-50' : 'bg-gray-50 border-gray-100'}`}>
                        <p className="mb-1">Arrivo: <span className="font-bold text-gray-900">{formattaData(pren.orarioinizio)}</span></p>
                        {pren.orariofine && (
                          <p>Uscita: <span className="font-bold text-gray-900">{formattaData(pren.orariofine)}</span></p>
                        )}
                        <p className={`mt-3 text-xs font-mono px-2 py-1 inline-block rounded border ${isAttiva ? 'bg-emerald-50 text-emerald-900 border-emerald-100' : 'bg-white text-gray-500 border-gray-200'}`}>
                          Codice: {pren.codice_accesso}
                        </p>
                     </div>

                     {/* BOTTONE ANNULLA (Solo visibile se la prenotazione è Attiva) */}
                     {isAttiva && (
                       <div className="mt-1">
                         {confirmCancelId === pren.idprenotazione ? (
                           <div className="flex gap-2">
                             <button onClick={() => executeCancelBooking(pren)} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-red-700 transition">Conferma annullamento</button>
                             <button onClick={() => setConfirmCancelId(null)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-bold transition hover:bg-gray-300">Indietro</button>
                           </div>
                         ) : (
                           <button onClick={() => setConfirmCancelId(pren.idprenotazione)} className="w-full py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-bold transition shadow-sm">
                             Annulla Sosta
                           </button>
                         )}
                       </div>
                     )}
                   </div>
                 );
               })}
             </div>
          )}
        </div>

      </div>
    </div>
  );
}