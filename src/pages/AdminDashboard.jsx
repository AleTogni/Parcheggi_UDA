import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function AdminDashboard({ profile }) {
  const [stats, setStats] = useState({ utenti: 0, parcheggi: 0, posti: 0, attive: 0, totaliValide: 0 });
  const [listaParcheggi, setListaParcheggi] = useState([]);
  
  const [listaUtenti, setListaUtenti] = useState([]);
  
  const [newParking, setNewParking] = useState({ nome: '', postitot: 100, coperto: true, latitudine: 45.54, longitudine: 10.22 });
  const [newSpot, setNewSpot] = useState({ idparcheggio: '', piano: '', tipoposto: 'Standard' });
  const [uiMessage, setUiMessage] = useState('');

  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('attive'); 
  const [allBookingsData, setAllBookingsData] = useState([]);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState(null); 

  const [filterParkingId, setFilterParkingId] = useState('all');

  const [chartData, setChartData] = useState([]);
  const [chartView, setChartView] = useState('settimana');

  const [searchUserTerm, setSearchUserTerm] = useState('');
  const [filterUserRole, setFilterUserRole] = useState('all');

  useEffect(() => { loadDashboardData(); }, [chartView]);

  const loadDashboardData = async () => {
    const { count: u, data: utentiData } = await supabase.from('persone').select('*', { count: 'exact' });
    const { count: po } = await supabase.from('posti_auto').select('*', { count: 'exact', head: true });
    const { count: at } = await supabase.from('prenotazioni').select('*', { count: 'exact', head: true }).eq('stato', 'Attiva');
    const { count: val } = await supabase.from('prenotazioni').select('*', { count: 'exact', head: true }).eq('stato', 'Attiva');
    const { data: p } = await supabase.from('parcheggi').select('*').order('nome');
    
    const { data: allPreno } = await supabase.from('prenotazioni').select('orarioinizio, costo');
    if (allPreno) {
      setChartData(processDataForChart(allPreno, chartView));
    }

    setStats({ utenti: u || 0, parcheggi: p?.length || 0, posti: po || 0, attive: at || 0, totaliValide: val || 0 });
    setListaParcheggi(p || []);
    
    if (utentiData) setListaUtenti(utentiData);
    if (p && p.length > 0 && !newSpot.idparcheggio) setNewSpot(prev => ({ ...prev, idparcheggio: p[0].idparcheggio }));
  };

  const processDataForChart = (data, view) => {
    const now = new Date();
    let startDate = new Date();
    let groupBy = 'day';

    if (view === 'settimana') startDate.setDate(now.getDate() - 7);
    else if (view === 'mese') startDate.setDate(now.getDate() - 30);
    else { startDate = new Date(0); groupBy = 'month'; }

    const filtered = data.filter(d => new Date(d.orarioinizio) >= startDate);
    const map = {};

    if (view === 'settimana' || view === 'mese') {
      const daysToGenerate = view === 'settimana' ? 7 : 30;
      for (let i = daysToGenerate; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
        map[key] = { label: key, co2: 0, soste: 0 };
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
        map[key] = { label: key, co2: 0, soste: 0 };
      }
    }

    filtered.forEach(p => {
      const date = new Date(p.orarioinizio);
      const key = groupBy === 'day' 
        ? date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
        : date.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });

      if (!map[key]) map[key] = { label: key, co2: 0, soste: 0 };
      map[key].soste += 1;
      map[key].co2 += parseFloat((parseFloat(p.costo || 0) * 0.25 * 2.5).toFixed(2));
    });

    return Object.values(map).map(item => ({
      ...item,
      co2: parseFloat(item.co2.toFixed(1))
    }));
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
    const { data: preno } = await supabase.from('prenotazioni').select('*').order('orarioinizio', { ascending: false });
    const { data: posti } = await supabase.from('posti_auto').select('*');
    const { data: parkings } = await supabase.from('parcheggii').select('*');

    if (preno && posti && parkings) {
      const enriched = preno.map(p => {
        const posto = posti.find(pos => pos.idposto === p.idposto);
        const parking = posto ? parkings.find(park => park.idparcheggio === posto.idparcheggio) : null;
        return {
           ...p,
           nomeParcheggi: parking ? parking.nome : 'Sconosciuto',
           idparcheggio: parking ? parking.idparcheggio : null,
           pianoPosto: posto ? posto.piano : 'N/A'
        };
      });
      setAllBookingsData(enriched);
    }
    setShowBookingsModal(true);
  };

  const executeAdminCancelBooking = async (pren) => {
    await supabase.from('prenotazioni').update({ stato: 'Annullata' }).eq('idprenotazione', pren.idprenotazione);
    await supabase.from('posti_auto').update({ stato: 'Libero' }).eq('idposto', pren.idposto);
    setConfirmCancelId(null);
    showMessage("Sosta terminata forzatamente.");
    loadDashboardData();
    handleOpenBookings(); 
  };

  const handleExportCSV = () => {
    if (allBookingsData.length === 0) return showMessage("Nessun dato da esportare.");

    const headers = ["ID_Sosta", "Targa", "Parcheggio", "Piano", "Arrivo", "Uscita", "Stato", "Costo_EUR"];
    
    const csvRows = allBookingsData.map(p => {
      return [
        p.idprenotazione,
        p.targa,
        `"${p.nomeParcheggi}"`,
        `"${p.pianoPosto}"`,
        formattaData(p.orarioinizio).replace(/,/g, ''),
        formattaData(p.orariofine).replace(/,/g, ''),
        p.stato,
        p.costo || '0.00'
      ].join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Export_Soste_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showMessage("Download iniziato.");
  };

  const handleMakeAdmin = async (utente) => {
    const { error } = await supabase.from('persone').update({ ruolo: 'admin' }).eq('idpersona', utente.idpersona);
    if (error) {
      showMessage("Errore durante la promozione ad Admin.");
    } else {
      showMessage(`${utente.nome} ora è un Amministratore.`);
      loadDashboardData();
    }
  };

  const handleDeleteUser = async (utente) => {
    const { error } = await supabase.rpc('elimina_dati_utente', { p_id: utente.idpersona });
    
    if (error) {
      console.error(error);
      showMessage("Errore. Verifica i permessi della funzione elimina_dati_utente nel database.");
    } else {
      showMessage("Utente eliminato definitivamente e storico rimosso.");
      setConfirmDeleteUserId(null);
      loadDashboardData();
    }
  };

  const handleAddParking = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('parcheggi').insert([newParking]);
    if (error) showMessage("Errore database: " + error.message);
    else { 
      showMessage("Impianto creato."); 
      setNewParking({ nome: '', postitot: 100, coperto: true, latitudine: 45.54, longitudine: 10.22 });
      loadDashboardData(); 
    }
  };

  const handleAddSpot = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('posti_auto').insert([newSpot]);
    if (error) showMessage("Errore database.");
    else { 
      showMessage("Stallo aggiunto."); 
      setNewSpot({ ...newSpot, piano: '' });
      loadDashboardData(); 
    }
  };

  const co2Risparmiata = (stats.totaliValide * 0.25 * 2.5).toFixed(1);

  const filteredBookings = allBookingsData.filter(p => {
    const tabMatch = activeTab === 'attive' ? p.stato === 'Attiva' : p.stato !== 'Attiva';
    const parkingMatch = filterParkingId === 'all' || String(p.idparcheggio) === String(filterParkingId);
    return tabMatch && parkingMatch;
  });

  const filteredUtenti = listaUtenti.filter(u => {
    const matchSearch = (u.nome?.toLowerCase() || '').includes(searchUserTerm.toLowerCase()) ||
                        (u.cognome?.toLowerCase() || '').includes(searchUserTerm.toLowerCase()) ||
                        String(u.idpersona).toLowerCase().includes(searchUserTerm.toLowerCase());
    
    const ruoloCorrente = u.ruolo || 'user';
    const matchRole = filterUserRole === 'all' ? true : ruoloCorrente === filterUserRole;
    
    return matchSearch && matchRole;
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:mt-6 relative z-0">
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-black text-emerald-900 tracking-tight">Centro Operativo</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">Pannello Admin • {profile?.nome || 'Admin'}</p>
        </div>
        {uiMessage && <div className="bg-gray-800 text-white px-5 py-2 rounded-lg font-bold shadow-md animate-pulse text-xs">{uiMessage}</div>}
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
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
              <button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-lg transition-all">
                Salva Impianto
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col hover:border-gray-300 transition-colors">
          <h2 className="text-lg font-bold text-emerald-900 mb-6 border-b border-gray-100 pb-3">Inserimento Stalli</h2>
          <form onSubmit={handleAddSpot} className="space-y-4 flex-grow flex flex-col">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Impianto di Destinazione</label>
              <select value={newSpot.idparcheggio} onChange={(e) => setNewSpot({...newSpot, idparcheggio: e.target.value})} className="w-full p-3 rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all">
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

        <div className="bg-emerald-900 p-6 rounded-2xl border border-emerald-800 shadow-sm flex flex-col text-white">
          <h2 className="text-lg font-bold text-emerald-50 mb-6 border-b border-emerald-700 pb-3">Impatto Sostenibile</h2>
          <p className="text-sm text-emerald-200 leading-relaxed mb-8">
            Report calcolato in tempo reale su <span className="font-bold text-white">{stats.totaliValide}</span> soste attive.
          </p>
          <div className="space-y-4 mt-auto">
            <div className="bg-emerald-950 p-5 rounded-xl border border-emerald-800 shadow-inner">
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">CO₂ Evitata</p>
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

      <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h2 className="text-xl font-black text-gray-800">Analisi Performance Ambientale</h2>
          
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {['settimana', 'mese', 'tutto'].map(v => (
              <button 
                key={v} 
                onClick={() => setChartView(v)} 
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize ${chartView === v ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 'bold' }} />
              <Line type="monotone" dataKey="co2" name="CO₂ Risparmiata (kg)" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="soste" name="Soste Totali" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SEZIONE: TABELLA GESTIONE UTENTI (CON SCROLLBAR E FILTRI E ALTEZZA FISSA) */}
      <div className="bg-white pt-8 pb-4 rounded-3xl border border-gray-200 shadow-sm mb-8 overflow-hidden">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-8 mb-6 border-b border-gray-100 pb-4 gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-800">Gestione Utenti</h2>
            <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Controlla e modera gli iscritti</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
             <input 
               type="text" 
               placeholder="Cerca per nome o ID..." 
               value={searchUserTerm}
               onChange={(e) => setSearchUserTerm(e.target.value)}
               className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none w-full sm:w-64 transition-all"
             />
             <select 
               value={filterUserRole} 
               onChange={(e) => setFilterUserRole(e.target.value)}
               className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer"
             >
               <option value="all">Tutti i ruoli</option>
               <option value="utente">Utenti standard</option>
               <option value="admin">Amministratori</option>
             </select>
          </div>
        </div>
        
        {/* FIX ALTEZZA: h-[400px] forza un'altezza fissa, evitando che la pagina salti su e giù */}
        <div className="overflow-x-auto overflow-y-auto h-[400px] custom-scrollbar px-3 sm:px-8 relative">
          {filteredUtenti.length > 0 ? (
            <table className="w-full min-w-[600px] text-left border-collapse relative">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="border-b border-gray-100">
                  <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider bg-white">Utente</th>
                  <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider bg-white">Contatti</th>
                  <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider bg-white">Ruolo</th>
                  <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center bg-white">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUtenti.map(utente => (
                  <tr key={utente.idpersona} className="transition-colors hover:bg-gray-50">
                    <td className="p-3">
                      <p className="font-bold text-gray-800">{utente.nome || 'Utente'} {utente.cognome || ''}</p>
                      <p className="text-[10px] text-gray-400 font-mono">ID: {String(utente.idpersona).substring(0, 8)}</p>
                    </td>
                    <td className="p-3 text-sm font-medium text-gray-600">
                      {utente.telefono || 'N/A'}<br/>
                      <span className="text-xs text-gray-400">{utente.citta || ''}</span>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase border ${
                        utente.ruolo === 'admin' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {utente.ruolo || 'user'}
                      </span>
                    </td>
<td className="p-3 text-center">
                      {utente.idpersona !== profile?.idpersona ? (
                        /* FIX ALLINEAMENTO: Usiamo una griglia fissa larga circa 200px */
                        <div className="grid grid-cols-2 gap-2 w-52 mx-auto">
                          
                          {/* SLOT SINISTRO: Rendi Admin (o spazio vuoto) */}
                          <div>
                            {utente.ruolo !== 'admin' && (
                              <button 
                                onClick={() => handleMakeAdmin(utente)}
                                className="w-full text-[10px] font-bold px-3 py-2 rounded-lg border text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100 transition-all uppercase"
                              >
                                Rendi Admin
                              </button>
                            )}
                          </div>

                          {/* SLOT DESTRO: Elimina (o Conferma/Annulla) */}
                          <div>
                            {confirmDeleteUserId === utente.idpersona ? (
                              <div className="flex gap-1 animate-in fade-in zoom-in duration-200">
                                <button 
                                  onClick={() => handleDeleteUser(utente)}
                                  className="w-full text-[10px] font-bold px-1 py-2 rounded-lg bg-red-600 text-white uppercase hover:bg-red-700 shadow-sm transition-all"
                                >
                                  Conf.
                                </button>
                                <button 
                                  onClick={() => setConfirmDeleteUserId(null)}
                                  className="w-full text-[10px] font-bold px-1 py-2 rounded-lg bg-gray-200 text-gray-700 uppercase hover:bg-gray-300 transition-all"
                                >
                                  Ann.
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setConfirmDeleteUserId(utente.idpersona)}
                                className="w-full text-[10px] font-bold px-3 py-2 rounded-lg border text-red-600 bg-white border-red-200 hover:bg-red-50 transition-all uppercase"
                              >
                                Elimina
                              </button>
                            )}
                          </div>
                          
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-lg">Il tuo account</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-400 text-sm font-bold bg-gray-50 px-6 py-4 rounded-2xl border border-dashed border-gray-200">
                Nessun utente trovato per questi filtri.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODALE REGISTRO PRENOTAZIONI */}
      {showBookingsModal && (
        <div onClick={() => setShowBookingsModal(false)} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] cursor-pointer">
          <div onClick={e => e.stopPropagation()} className="bg-white p-4 sm:p-8 rounded-3xl max-w-4xl w-full shadow-2xl relative cursor-default flex flex-col max-h-[90vh]">
            
            <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 mb-4">
              <h2 className="text-2xl font-black text-gray-900">Registro Prenotazioni</h2>
              
              {/* CONTENITORE PRINCIPALE: justify-between e items-start (o center) */}
              <div className="flex flex-row items-center justify-between w-full gap-2 sm:gap-4">
                
                {/* GRUPPO DI SINISTRA: Permette il wrap interno dei filtri senza spostare la X */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 flex-1">
                  
                  {/* Select Focus */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden xs:inline">Focus:</span>
                    <select 
                      value={filterParkingId} 
                      onChange={(e) => setFilterParkingId(e.target.value)}
                      className="p-1.5 rounded-lg border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500 max-w-[120px] sm:max-w-none"
                    >
                      <option value="all">Tutti</option>
                      {listaParcheggi.map(park => (
                        <option key={park.idparcheggio} value={park.idparcheggio}>{park.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tabs Switch */}
                  <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
                    <button onClick={() => setActiveTab('attive')} className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${activeTab === 'attive' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}>In corso</button>
                    <button onClick={() => setActiveTab('storico')} className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${activeTab === 'storico' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}>Storico</button>
                  </div>

                  {/* Bottone CSV */}
                  <button 
                    onClick={handleExportCSV} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm transition-all shrink-0"
                  >
                    esporta CSV
                  </button>
                </div>

                {/* PULSANTE A DESTRA: shrink-0 impedisce alla X di rimpicciolirsi o spostarsi */}
                <button 
                  onClick={() => setShowBookingsModal(false)} 
                  className="text-3xl font-bold text-gray-300 hover:text-gray-600 transition-colors leading-none p-2 shrink-0"
                  aria-label="Chiudi"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="h-[500px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {filteredBookings.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Nessuna sosta trovata per questo filtro</p>
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
                      <p className="text-xs font-bold text-gray-500 uppercase">{pren.nomeParcheggi} • Stallo {pren.pianoPosto}</p>
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