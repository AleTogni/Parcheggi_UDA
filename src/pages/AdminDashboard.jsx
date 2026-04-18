import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';

export default function AdminDashboard({ profile }) {
  const [stats, setStats] = useState({ utenti: 0, parcheggi: 0, posti: 0, attive: 0 });
  const [listaParcheggi, setListaParcheggi] = useState([]);
  
  // Stato per il form "Aggiungi Posto"
  const [newSpot, setNewSpot] = useState({ idparcheggio: '', piano: '', tipoposto: 'Standard' });
  const [uiMessage, setUiMessage] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    // 1. Carichiamo le statistiche
    const { count: countUtenti } = await supabase.from('persona').select('*', { count: 'exact', head: true });
    const { count: countPosti } = await supabase.from('posto_auto').select('*', { count: 'exact', head: true });
    const { count: countAttive } = await supabase.from('prenotazione').select('*', { count: 'exact', head: true }).eq('stato', 'Attiva');
    
    // 2. Carichiamo i parcheggi per la tendina
    const { data: parcheggi } = await supabase.from('parcheggio').select('*').order('nome');
    
    setStats({
      utenti: countUtenti || 0,
      parcheggi: parcheggi?.length || 0,
      posti: countPosti || 0,
      attive: countAttive || 0
    });
    
    setListaParcheggi(parcheggi || []);
    if (parcheggi && parcheggi.length > 0) {
      setNewSpot({ ...newSpot, idparcheggio: parcheggi[0].idparcheggio });
    }
  };

  const showMessage = (msg) => {
    setUiMessage(msg);
    setTimeout(() => setUiMessage(''), 4000);
  };

  // Funzione superpotere: Aggiunge un posto nel database
  const handleAddSpot = async (e) => {
    e.preventDefault();
    if (!newSpot.idparcheggio || !newSpot.piano) return showMessage("Compila tutti i campi!");

    const { error } = await supabase.from('posto_auto').insert([{
      idparcheggio: newSpot.idparcheggio,
      piano: newSpot.piano,
      tipoposto: newSpot.tipoposto,
      stato: 'Libero'
    }]);

    if (error) {
      showMessage("Errore inserimento: " + error.message);
    } else {
      showMessage("Nuovo posto auto creato con successo!");
      setNewSpot({ ...newSpot, piano: '' }); // Resetta solo il piano
      loadDashboardData(); // Aggiorna il contatore
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 mt-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black text-gray-800 tracking-tight">Centro Operativo <span className="text-yellow-500">Admin</span></h1>
          <p className="text-gray-500 font-medium">Accesso di Livello 1 • Autenticato come {profile?.nome}</p>
        </div>
        {uiMessage && <div className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold shadow-lg animate-pulse">{uiMessage}</div>}
      </div>

      {/* STATISTICHE GLOBALI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-emerald-500">
          <p className="text-sm font-bold text-gray-500 uppercase">Utenti Registrati</p>
          <p className="text-3xl font-black text-emerald-700 mt-1">{stats.utenti}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-blue-500">
          <p className="text-sm font-bold text-gray-500 uppercase">Parcheggi Censiti</p>
          <p className="text-3xl font-black text-blue-700 mt-1">{stats.parcheggi}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-indigo-500">
          <p className="text-sm font-bold text-gray-500 uppercase">Posti Totali</p>
          <p className="text-3xl font-black text-indigo-700 mt-1">{stats.posti}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-red-500">
          <p className="text-sm font-bold text-gray-500 uppercase">Soste Attive Ora</p>
          <p className="text-3xl font-black text-red-700 mt-1">{stats.attive}</p>
        </div>
      </div>

      {/* STRUMENTI ADMIN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* WIDGET: AGGIUNGI POSTO */}
        <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-200">
          <h2 className="text-xl font-bold text-yellow-900 mb-4 flex items-center gap-2">
            <span>➕</span> Aggiungi un nuovo Posto Auto
          </h2>
          <form onSubmit={handleAddSpot} className="space-y-4">
            
            <div>
              <label className="block text-sm font-bold text-yellow-800 mb-1">In quale Parcheggio?</label>
              <select 
                value={newSpot.idparcheggio} 
                onChange={e => setNewSpot({...newSpot, idparcheggio: e.target.value})}
                className="w-full p-3 rounded-xl border border-yellow-300 bg-white"
              >
                {listaParcheggi.map(p => <option key={p.idparcheggio} value={p.idparcheggio}>{p.nome}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-yellow-800 mb-1">Nome Piano (es. Terra)</label>
                <input 
                  type="text" 
                  value={newSpot.piano}
                  onChange={e => setNewSpot({...newSpot, piano: e.target.value})}
                  className="w-full p-3 rounded-xl border border-yellow-300 bg-white"
                  placeholder="Es. Piano -1"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-yellow-800 mb-1">Tipologia</label>
                <select 
                  value={newSpot.tipoposto}
                  onChange={e => setNewSpot({...newSpot, tipoposto: e.target.value})}
                  className="w-full p-3 rounded-xl border border-yellow-300 bg-white"
                >
                  <option value="Standard">Standard</option>
                  <option value="Disabili">Disabili</option>
                  <option value="Elettrico">Elettrico</option>
                </select>
              </div>
            </div>

            <button type="submit" className="w-full bg-yellow-500 text-yellow-950 font-black py-3 rounded-xl hover:bg-yellow-400 transition shadow-sm mt-2">
              CREA POSTO NEL DATABASE
            </button>
          </form>
        </div>

        {/* WIDGET: INFORMAZIONI */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 flex flex-col justify-center items-center text-center">
          <div className="text-5xl mb-4">🛡️</div>
          <h3 className="font-bold text-lg text-gray-800 mb-2">Sicurezza di Sistema</h3>
          <p className="text-gray-500 text-sm max-w-sm">
            Tutte le azioni effettuate da questo pannello modificano direttamente il database live. Usa questo potere con responsabilità.
          </p>
        </div>

      </div>
    </div>
  );
}