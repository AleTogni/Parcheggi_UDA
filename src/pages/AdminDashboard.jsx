import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';

export default function AdminDashboard({ profile }) {
  const [stats, setStats] = useState({ utenti: 0, parcheggi: 0, posti: 0, attive: 0, totaliValide: 0 });
  const [listaParcheggi, setListaParcheggi] = useState([]);
  
  const [newParking, setNewParking] = useState({ nome: '', postitot: 100, coperto: true, latitudine: 45.54, longitudine: 10.22 });
  const [newSpot, setNewSpot] = useState({ idparcheggio: '', piano: '', tipoposto: 'Standard' });
  const [uiMessage, setUiMessage] = useState('');

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    const { count: u } = await supabase.from('persona').select('*', { count: 'exact', head: true });
    const { count: po } = await supabase.from('posto_auto').select('*', { count: 'exact', head: true });
    const { count: at } = await supabase.from('prenotazione').select('*', { count: 'exact', head: true }).eq('stato', 'Attiva');
    const { count: val } = await supabase.from('prenotazione').select('*', { count: 'exact', head: true }).neq('stato', 'Annullata');
    const { data: p } = await supabase.from('parcheggio').select('*').order('nome');
    
    setStats({ utenti: u || 0, parcheggi: p?.length || 0, posti: po || 0, attive: at || 0, totaliValide: val || 0 });
    setListaParcheggi(p || []);
    if (p && p.length > 0) setNewSpot(prev => ({ ...prev, idparcheggio: p[0].idparcheggio }));
  };

  const showMessage = (msg) => {
    setUiMessage(msg);
    setTimeout(() => setUiMessage(''), 4000);
  };

  const handleAddParking = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('parcheggio').insert([newParking]);
    if (error) showMessage("Errore: " + error.message);
    else {
      showMessage("Nuovo impianto aggiunto con successo.");
      setNewParking({ nome: '', postitot: 100, coperto: true, latitudine: 45.54, longitudine: 10.22 });
      loadDashboardData();
    }
  };

  const handleAddSpot = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('posto_auto').insert([newSpot]);
    if (error) showMessage("Errore: " + error.message);
    else { showMessage("Nuovo stallo registrato."); loadDashboardData(); }
  };

  const co2Risparmiata = (stats.totaliValide * 0.25 * 2.5).toFixed(1);

  return (
    <div className="max-w-7xl mx-auto p-6 mt-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-black text-emerald-900 tracking-tight">Centro Operativo</h1>
          <p className="text-gray-500 font-medium mt-1">Pannello di Amministrazione • Accesso <span className="text-emerald-700 font-bold">{profile?.nome}</span></p>
        </div>
        
        {uiMessage && (
          <div className="bg-gray-800 text-white px-5 py-2.5 rounded-lg font-bold shadow-md animate-fade-in-up text-sm">
            {uiMessage}
          </div>
        )}
      </div>

      {/* STATISTICHE RIGA SUPERIORE */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Utenti Registrati</p>
          <p className="text-3xl font-black text-gray-800">{stats.utenti}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Impianti Rete</p>
          <p className="text-3xl font-black text-emerald-700">{stats.parcheggi}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Posti Totali</p>
          <p className="text-3xl font-black text-blue-700">{stats.posti}</p>
        </div>
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1">Soste Attive</p>
          <p className="text-3xl font-black text-emerald-900">{stats.attive}</p>
        </div>
      </div>

      {/* 3 COLONNE AFFIANCATE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLONNA 1: NUOVO IMPIANTO */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col hover:border-gray-300 transition-colors">
          <h2 className="text-lg font-bold text-emerald-900 mb-6 border-b border-gray-100 pb-3">Registra Nuovo Impianto</h2>
          <form onSubmit={handleAddParking} className="space-y-4 flex-grow flex flex-col">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Nome Struttura</label>
              <input type="text" value={newParking.nome} onChange={e => setNewParking({...newParking, nome: e.target.value})} className="w-full p-3 rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all" placeholder="Es. Vittoria" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Latitudine</label>
                <input type="number" step="any" value={newParking.latitudine} onChange={e => setNewParking({...newParking, latitudine: parseFloat(e.target.value)})} className="w-full p-3 rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Longitudine</label>
                <input type="number" step="any" value={newParking.longitudine} onChange={e => setNewParking({...newParking, longitudine: parseFloat(e.target.value)})} className="w-full p-3 rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Capacità Max</label>
                <input type="number" value={newParking.postitot} onChange={e => setNewParking({...newParking, postitot: parseInt(e.target.value)})} className="w-full p-3 rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Tipologia</label>
                <select value={newParking.coperto} onChange={e => setNewParking({...newParking, coperto: e.target.value === 'true'})} className="w-full p-3 rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all">
                  <option value="true">Coperto</option>
                  <option value="false">All'aperto</option>
                </select>
              </div>
            </div>
            <div className="mt-auto pt-4">
              <button type="submit" className="w-full bg-gray-800 text-white font-bold py-3 rounded-lg hover:bg-gray-900 hover:shadow-md transition-all">
                Salva Impianto
              </button>
            </div>
          </form>
        </div>

        {/* COLONNA 2: NUOVO POSTO */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col hover:border-gray-300 transition-colors">
          <h2 className="text-lg font-bold text-emerald-900 mb-6 border-b border-gray-100 pb-3">Inserimento Stalli</h2>
          <form onSubmit={handleAddSpot} className="space-y-4 flex-grow flex flex-col">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Impianto di Destinazione</label>
              <select value={newSpot.idparcheggio} onChange={e => setNewSpot({...newSpot, idparcheggio: e.target.value})} className="w-full p-3 rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all">
                {listaParcheggi.map(p => <option key={p.idparcheggio} value={p.idparcheggio}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Settore / Piano</label>
              <input type="text" value={newSpot.piano} onChange={e => setNewSpot({...newSpot, piano: e.target.value})} className="w-full p-3 rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all" placeholder="Es. Piano Terra" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Categoria Stallo</label>
              <select value={newSpot.tipoposto} onChange={e => setNewSpot({...newSpot, tipoposto: e.target.value})} className="w-full p-3 rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all">
                <option value="Standard">Standard</option>
                <option value="Disabili">Riservato Disabili</option>
                <option value="Elettrico">Ricarica Elettrica</option>
              </select>
            </div>
            <div className="mt-auto pt-4">
              <button type="submit" className="w-full bg-emerald-700 text-white font-bold py-3 rounded-lg hover:bg-emerald-800 hover:shadow-md transition-all">
                Aggiungi Stallo
              </button>
            </div>
          </form>
        </div>

        {/* COLONNA 3: CO2 E IMPATTO */}
        <div className="bg-emerald-900 p-6 rounded-2xl border border-emerald-800 shadow-sm flex flex-col text-white">
          <h2 className="text-lg font-bold text-emerald-50 mb-6 border-b border-emerald-700 pb-3">Impatto Sostenibile</h2>
          
          <p className="text-sm text-emerald-200 leading-relaxed mb-8">
            Report calcolato su <span className="font-bold text-white">{stats.totaliValide}</span> prenotazioni di rete. La riduzione dei tempi di ricerca del parcheggio contribuisce all'abbattimento delle emissioni urbane.
          </p>
          
          <div className="space-y-4 mt-auto">
            <div className="bg-emerald-950 p-5 rounded-xl border border-emerald-800 shadow-inner">
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">CO₂ Evitata Totale</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white tracking-tight">{co2Risparmiata}</span>
                <span className="text-emerald-500 font-bold">kg</span>
              </div>
            </div>

            <div className="bg-emerald-950 p-5 rounded-xl border border-emerald-800 shadow-inner">
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Assorbimento Naturale</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white tracking-tight">{Math.floor(co2Risparmiata / 10)}</span>
                <span className="text-emerald-500 font-bold text-sm">alberi / anno</span>
              </div>
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
}