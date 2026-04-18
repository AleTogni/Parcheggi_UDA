import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';

export default function AdminDashboard({ profile }) {
  const [stats, setStats] = useState({ utenti: 0, parcheggi: 0, posti: 0, attive: 0, totaliValide: 0 });
  const [listaParcheggi, setListaParcheggi] = useState([]);
  
  const [newSpot, setNewSpot] = useState({ idparcheggio: '', piano: '', tipoposto: 'Standard' });
  const [uiMessage, setUiMessage] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const { count: countUtenti } = await supabase.from('persona').select('*', { count: 'exact', head: true });
    const { count: countPosti } = await supabase.from('posto_auto').select('*', { count: 'exact', head: true });
    const { count: countAttive } = await supabase.from('prenotazione').select('*', { count: 'exact', head: true }).eq('stato', 'Attiva');
    
    // LOGICA CORRETTA: Contiamo solo le prenotazioni che NON sono state annullate
    const { count: countValide } = await supabase.from('prenotazione').select('*', { count: 'exact', head: true }).neq('stato', 'Annullata'); 
    
    const { data: parcheggi } = await supabase.from('parcheggio').select('*').order('nome');
    
    setStats({
      utenti: countUtenti || 0,
      parcheggi: parcheggi?.length || 0,
      posti: countPosti || 0,
      attive: countAttive || 0,
      totaliValide: countValide || 0
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

  const handleAddSpot = async (e) => {
    e.preventDefault();
    if (!newSpot.idparcheggio || !newSpot.piano) return showMessage("Compila tutti i campi richiesti.");

    const { error } = await supabase.from('posto_auto').insert([{
      idparcheggio: newSpot.idparcheggio,
      piano: newSpot.piano,
      tipoposto: newSpot.tipoposto,
      stato: 'Libero'
    }]);

    if (error) {
      showMessage("Errore inserimento: " + error.message);
    } else {
      showMessage("Postazione aggiunta al database.");
      setNewSpot({ ...newSpot, piano: '' });
      loadDashboardData();
    }
  };

  // CALCOLATORE CO2 (Basato solo sulle soste effettivamente valide)
  const co2Risparmiata = (stats.totaliValide * 0.25 * 2.5).toFixed(1);
  const alberiEquivalenti = Math.floor(co2Risparmiata / 10);

  return (
    <div className="max-w-6xl mx-auto p-6 mt-6 relative z-0">
      <div className="flex justify-between items-center mb-8 h-10">
        <div>
          <h1 className="text-3xl font-black text-emerald-900 tracking-tight">Centro Operativo</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">Gestione Sistema • Autenticato come <span className="font-bold text-emerald-800">{profile?.nome}</span></p>
        </div>
        {uiMessage && <div className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold shadow-md animate-pulse text-sm">{uiMessage}</div>}
      </div>

      {/* STATISTICHE (Ora con lo stile luminoso della Home/Profilo) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Utenti Registrati</p>
          <p className="text-3xl font-black text-gray-800 mt-1">{stats.utenti}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Parcheggi Censiti</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">{stats.parcheggi}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Posti Totali</p>
          <p className="text-3xl font-black text-blue-600 mt-1">{stats.posti}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-200 bg-emerald-50/30">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Soste Attive Ora</p>
          <p className="text-3xl font-black text-emerald-800 mt-1">{stats.attive}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* WIDGET 1: INSERIMENTO POSTI */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Nuova Postazione</h2>
          <form onSubmit={handleAddSpot} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Seleziona Impianto</label>
              <select 
                value={newSpot.idparcheggio} 
                onChange={e => setNewSpot({...newSpot, idparcheggio: e.target.value})}
                className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-emerald-500 font-medium text-gray-700"
              >
                {listaParcheggi.map(p => <option key={p.idparcheggio} value={p.idparcheggio}>{p.nome}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Piano (es. Terra)</label>
                <input 
                  type="text" 
                  value={newSpot.piano}
                  onChange={e => setNewSpot({...newSpot, piano: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-emerald-500 font-medium text-gray-700"
                  placeholder="Es. Piano -1"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Tipologia</label>
                <select 
                  value={newSpot.tipoposto}
                  onChange={e => setNewSpot({...newSpot, tipoposto: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-emerald-500 font-medium text-gray-700"
                >
                  <option value="Standard">Standard</option>
                  <option value="Disabili">Disabili</option>
                  <option value="Elettrico">Elettrico</option>
                </select>
              </div>
            </div>

            <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition shadow-sm mt-4">
              Registra Postazione
            </button>
          </form>
        </div>

        {/* WIDGET 2: REPORT IMPATTO AMBIENTALE */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-emerald-900 mb-2">Impatto Ambientale</h2>
            <p className="text-gray-500 mb-6 text-sm">
              Dati in tempo reale calcolati su <span className="font-bold text-emerald-600">{stats.totaliValide}</span> prenotazioni valide.
            </p>
          </div>
          
          <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100">
            <div className="flex justify-between items-end mb-4 border-b border-emerald-200 pb-4">
              <span className="text-emerald-800 font-bold uppercase tracking-wider text-sm">CO₂ Evitata (Totale)</span>
              <div className="text-right">
                <span className="text-5xl font-black text-emerald-600">{co2Risparmiata}</span>
                <span className="text-emerald-700 font-bold ml-1 text-xl">kg</span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-emerald-700 font-bold text-sm uppercase tracking-wider">Equivalente forestale</span>
              <span className="font-black text-xl text-emerald-800">{alberiEquivalenti} alberi</span>
            </div>
          </div>
          
          <p className="text-xs text-gray-400 mt-4 text-center italic">
            *Stima calcolata su 15 min di traffico evitato a 2.5 kg CO₂/h per sosta.
          </p>
        </div>

      </div>
    </div>
  );
}