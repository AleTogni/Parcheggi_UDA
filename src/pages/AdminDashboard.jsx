import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';

export default function AdminDashboard({ profile }) {
  const [stats, setStats] = useState({ utenti: 0, parcheggi: 0, posti: 0, attive: 0, totaliValide: 0 });
  const [listaParcheggi, setListaParcheggi] = useState([]);
  
  const [newParking, setNewParking] = useState({ nome: '', postitot: 100, coperto: true, latitudine: 45.54, longitudine: 10.22 });
  const [newSpot, setNewSpot] = useState({ idparcheggio: '', piano: '', tipoposto: 'Standard' });
  const [uiMessage, setUiMessage] = useState('');

  // GESTIONE MODALE E TABS
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('attive'); 
  const [allBookingsData, setAllBookingsData] = useState([]);
  const [confirmCancelId, setConfirmCancelId] = useState(null);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    const { count: u } = await supabase.from('persona').select('*', { count: 'exact', head: true });
    const { count: po } = await supabase.from('posto_auto').select('*', { count: 'exact', head: true });
    const { count: at } = await supabase.from('prenotazione').select('*', { count: 'exact', head: true }).eq('stato', 'Attiva');
    const { count: val } = await supabase.from('prenotazione').select('*', { count: 'exact', head: true }).eq('stato', 'Attiva');
    const { data: p } = await supabase.from('parcheggio').select('*').order('nome');
    
    setStats({ utenti: u || 0, parcheggi: p?.length || 0, posti: po || 0, attive: at || 0, totaliValide: val || 0 });
    setListaParcheggi(p || []);
    if (p && p.length > 0) setNewSpot(prev => ({ ...prev, idparcheggio: p[0].idparcheggio }));
  };

  const showMessage = (msg) => {
    setUiMessage(msg);
    setTimeout(() => setUiMessage(''), 4000);
  };

  const formattaData = (dataIso) => {
    if (!dataIso) return '';
    const d = new Date(dataIso);
    return d.toLocaleString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  };

  const handleOpenBookings = async () => {
    const { data: preno } = await supabase.from('prenotazione').select('*').order('orarioinizio', { ascending: false });
    const { data: posti } = await supabase.from('posto_auto').select('*');
    const { data: parkings } = await supabase.from('parcheggio').select('*');

    if (preno && posti && parkings) {
      const enriched = preno.map(p => {
        const posto = posti.find(pos => pos.idposto === p.idposto);
        const parking = posto ? parkings.find(park => park.idparcheggio === posto.idparcheggio) : null;
        return {
           ...p,
           nomeParcheggio: parking ? parking.nome : 'Sconosciuto',
           pianoPosto: posto ? posto.piano : 'N/A'
        };
      });
      setAllBookingsData(enriched);
    }
    setShowBookingsModal(true);
  };

  const executeAdminCancelBooking = async (pren) => {
    await supabase.from('prenotazione').update({ stato: 'Annullata' }).eq('idprenotazione', pren.idprenotazione);
    await supabase.from('posto_auto').update({ stato: 'Libero' }).eq('idposto', pren.idposto);
    setConfirmCancelId(null);
    showMessage("Sosta terminata forzatamente.");
    loadDashboardData();
    handleOpenBookings(); 
  };

  const handleAddParking = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('parcheggio').insert([newParking]);
    if (error) showMessage("Errore database: " + error.message);
    else { 
      showMessage("Impianto creato."); 
      setNewParking({ nome: '', postitot: 100, coperto: true, latitudine: 45.54, longitudine: 10.22 });
      loadDashboardData(); 
    }
  };

  const handleAddSpot = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('posto_auto').insert([newSpot]);
    if (error) showMessage("Errore database.");
    else { 
      showMessage("Stallo aggiunto."); 
      setNewSpot({ ...newSpot, piano: '' });
      loadDashboardData(); 
    }
  };

  const co2Risparmiata = (stats.totaliValide * 0.25 * 2.5).toFixed(1);

  const filteredBookings = allBookingsData.filter(p => 
    activeTab === 'attive' ? p.stato === 'Attiva' : p.stato !== 'Attiva'
  );

  return (
    <div className="max-w-7xl mx-auto p-6 mt-6">
      
      <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-black text-emerald-900 tracking-tight">Centro Operativo</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">Pannello Admin • {profile?.nome}</p>
        </div>
        {uiMessage && <div className="bg-gray-800 text-white px-5 py-2 rounded-lg font-bold shadow-md animate-pulse text-xs">{uiMessage}</div>}
      </div>

      {/* RIGA STATISTICHE */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Utenti</p>
          <p className="text-3xl font-black text-gray-800">{stats.utenti}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Impianti</p>
          <p className="text-3xl font-black text-emerald-700">{stats.parcheggi}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Posti</p>
          <p className="text-3xl font-black text-blue-700">{stats.posti}</p>
        </div>
        
        {/* BOTTONE SOSTE ATTIVE */}
        <div 
          onClick={handleOpenBookings}
          className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 shadow-sm hover:bg-emerald-100 hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1">Soste Attive</p>
          <div className="flex justify-between items-end">
            <p className="text-3xl font-black text-emerald-900">{stats.attive}</p>
            <span className="text-[10px] font-bold text-emerald-600 border border-emerald-200 px-2 py-1 rounded bg-white group-hover:border-emerald-400 transition-colors">GESTISCI</span>
          </div>
        </div>
      </div>

      {/* TRE COLONNE UFFICIALI E FORMALI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLONNA 1 */}
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
              <button type="submit" className="w-full bg-gray-800 text-white font-bold py-3 rounded-lg hover:bg-gray-900 transition-all">
                Salva Impianto
              </button>
            </div>
          </form>
        </div>

        {/* COLONNA 2 */}
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
              <button type="submit" className="w-full bg-emerald-700 text-white font-bold py-3 rounded-lg hover:bg-emerald-800 transition-all">
                Aggiungi Stallo
              </button>
            </div>
          </form>
        </div>

        {/* COLONNA 3 */}
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

      {/* MODALE CON ALTEZZA FISSA */}
      {showBookingsModal && (
        <div onClick={() => setShowBookingsModal(false)} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] cursor-pointer">
          <div onClick={e => e.stopPropagation()} className="bg-white p-8 rounded-3xl max-w-4xl w-full shadow-2xl relative cursor-default flex flex-col max-h-[85vh]">
            
            <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
              <h2 className="text-2xl font-black text-gray-900">Registro Prenotazioni</h2>
              
              <div className="flex bg-gray-100 p-1 rounded-lg mr-8">
                <button onClick={() => setActiveTab('attive')} className={`px-4 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'attive' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}>In corso</button>
                <button onClick={() => setActiveTab('storico')} className={`px-4 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'storico' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}>Storico</button>
              </div>

              <button onClick={() => setShowBookingsModal(false)} className="text-3xl font-bold text-gray-300 hover:text-gray-600 transition-colors">&times;</button>
            </div>

            <div className="h-[500px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {filteredBookings.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Nessun dato trovato</p>
                </div>
              ) : (
                filteredBookings.map(pren => (
                  <div key={pren.idprenotazione} className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex items-center justify-between gap-4 hover:border-gray-200 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono font-black text-gray-800 text-lg uppercase">{pren.targa}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                          pren.stato === 'Attiva' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                          pren.stato === 'Conclusa' ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                          'bg-gray-200 text-gray-500 border-gray-300'
                        }`}>{pren.stato}</span>
                      </div>
                      <p className="text-xs font-bold text-gray-500 uppercase">{pren.nomeParcheggio} • Stallo {pren.pianoPosto}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{formattaData(pren.orarioinizio)} &rarr; {formattaData(pren.orariofine)}</p>
                    </div>
                    {pren.stato === 'Attiva' && (
                      <button onClick={() => setConfirmCancelId(pren.idprenotazione)} className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg border border-red-100 transition-all">Termina Sosta</button>
                    )}
                    {confirmCancelId === pren.idprenotazione && (
                      <div className="flex gap-2">
                        <button onClick={() => executeAdminCancelBooking(pren)} className="bg-red-600 text-white text-xs px-3 py-2 rounded-lg font-bold hover:bg-red-700">Conferma</button>
                        <button onClick={() => setConfirmCancelId(null)} className="bg-gray-200 text-gray-700 text-xs px-3 py-2 rounded-lg font-bold hover:bg-gray-300">No</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}