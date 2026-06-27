import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix per l'icona di default di Leaflet in React
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({ iconUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41] });

// Componente Mappa per scegliere le coordinate
function LocationSelector({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return position.lat !== 0 ? <Marker position={[position.lat, position.lng]} /> : null;
}

export default function AdminDashboard({ profile }) {
  const [stats, setStats] = useState({ utenti: 0, parcheggi: 0, posti: 0, attive: 0, totaliValide: 0 });
  const [listaParcheggi, setListaParcheggi] = useState([]);
  const [listaUtenti, setListaUtenti] = useState([]);
  
  const [newParking, setNewParking] = useState({ nome: '', postitot: 100, coperto: true, latitudine: 45.5416, longitudine: 10.2167 });
  const [newSpot, setNewSpot] = useState({ idparcheggio: '', piano: '', tipoposto: 'Standard' });
  const [uiMessage, setUiMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('attive'); 
  const [allBookingsData, setAllBookingsData] = useState([]);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState(null); 

  const [filterParkingId, setFilterParkingId] = useState('all');

  const [chartData, setChartData] = useState([]);
  const [chartView, setChartView] = useState('settimana');
  
  const [pieData, setPieData] = useState([]); 
  const [terminalFeed, setTerminalFeed] = useState([]); 

  const [searchUserTerm, setSearchUserTerm] = useState('');
  const [filterUserRole, setFilterUserRole] = useState('all');

  const PIE_COLORS = { Standard: '#3b82f6', Elettrico: '#10b981', Disabili: '#f59e0b' };

  useEffect(() => { loadDashboardData(); }, [chartView]);

  useEffect(() => {
    if (!showBookingsModal || allBookingsData.length === 0) return;

    const timer = setInterval(() => {
      const now = new Date();
      let requiresUpdate = false;

      const updatedBookings = allBookingsData.map(p => {
        if (p.stato === 'Attiva' && now > new Date(p.orariofine)) {
          console.log(`[Admin Live] Sosta ${p.idprenotazione} scaduta in diretta. La chiudo.`);
          requiresUpdate = true;
          
          supabase.from('prenotazioni').update({ stato: 'Conclusa' }).eq('idprenotazione', p.idprenotazione).then();
          supabase.from('posti_auto').update({ stato: 'Libero' }).eq('idposto', p.idposto).then();
          
          return { ...p, stato: 'Conclusa' };
        }
        return p;
      });

      if (requiresUpdate) {
        setAllBookingsData(updatedBookings);
        loadDashboardData(); 
      }
    }, 5000); 

    return () => clearInterval(timer);
  }, [showBookingsModal, allBookingsData]);

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

    // Caricamento Dati Ciambella (Posti Occupati per Tipologia)
    const { data: postiOccupati } = await supabase.from('posti_auto').select('tipoposto').eq('stato', 'Occupato');
    if (postiOccupati) {
      const counts = { Standard: 0, Elettrico: 0, Disabili: 0 };
      postiOccupati.forEach(posto => { if (counts[posto.tipoposto] !== undefined) counts[posto.tipoposto]++; });
      setPieData(Object.keys(counts).filter(k => counts[k] > 0).map(k => ({ name: k, value: counts[k] })));
    }

    // Caricamento Live Terminal (Ultime 6 Soste)
    const { data: ultimiEventi } = await supabase.from('prenotazioni')
      .select('targa, stato, orarioinizio, posti_auto(parcheggi(nome))')
      .order('orarioinizio', { ascending: false }).limit(6);
    if (ultimiEventi) setTerminalFeed(ultimiEventi);

    setStats({ utenti: u || 0, parcheggi: p?.length || 0, posti: po || 0, attive: at || 0, totaliValide: val || 0 });
    setListaParcheggi(p || []);
    
    if (utentiData) setListaUtenti(utentiData);
    if (p && p.length > 0 && !newSpot.idparcheggio) setNewSpot(prev => ({ ...prev, idparcheggio: p[0].idparcheggio }));
    setIsLoading(false);
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
    try {
      const { data, error } = await supabase
        .from('prenotazioni')
        .select('*')
        .order('orarioinizio', { ascending: false });

      if (error) throw error;

      console.log("Dati caricati (pre-pulizia):", data);

      const now = new Date();
      let requiresRefresh = false;

      for (const p of (data || [])) {
        const scadenza = new Date(p.orariofine);
        
        if (p.stato === 'Attiva' && now > scadenza) {
          console.log(`⏳ Admin: Chiudo sosta scaduta in background (${p.idprenotazione})`);
          await supabase.from('prenotazioni').update({ stato: 'Conclusa' }).eq('idprenotazione', p.idprenotazione);
          await supabase.from('posti_auto').update({ stato: 'Libero' }).eq('idposto', p.idposto);
          requiresRefresh = true;
        }
      }

      if (requiresRefresh) {
        const { data: updatedData } = await supabase
          .from('prenotazioni')
          .select('*')
          .order('orarioinizio', { ascending: false });
        setAllBookingsData(updatedData || []);
      } else {
        setAllBookingsData(data || []);
      }

      setShowBookingsModal(true);
    } catch (err) {
      console.error("Errore fatale:", err.message);
      alert("Errore di connessione: " + err.message);
    }
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
      setNewParking({ nome: '', postitot: 100, coperto: true, latitudine: 45.5416, longitudine: 10.2167 });
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:mt-6 pb-24 relative z-0 transition-colors">
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 border-b border-gray-200 dark:border-gray-800 pb-4 transition-colors">
        <div>
          <h1 className="text-3xl font-black text-emerald-900 dark:text-emerald-400 tracking-tight transition-colors">Centro Operativo</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium text-sm mt-1 transition-colors">Pannello Admin • {profile?.nome || 'Admin'}</p>
        </div>
        {uiMessage && <div className="bg-gray-800 dark:bg-gray-700 text-white px-5 py-2 rounded-lg font-bold shadow-md animate-pulse text-xs mt-3 sm:mt-0 transition-colors">{uiMessage}</div>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm animate-pulse transition-colors">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-md w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md w-1/4"></div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm transition-colors">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Utenti</p>
              <p className="text-3xl font-black text-gray-800 dark:text-gray-100 transition-colors">{stats.utenti}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm transition-colors">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Impianti</p>
              <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400 transition-colors">{stats.parcheggi}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm transition-colors">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Posti</p>
              <p className="text-3xl font-black text-blue-700 dark:text-blue-400 transition-colors">{stats.posti}</p>
            </div>
            <div 
              onClick={handleOpenBookings}
              className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 shadow-sm hover:border-emerald-400 cursor-pointer group transition-colors"
            >
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-500 uppercase tracking-widest mb-1">Soste Attive</p>
              <div className="flex justify-between items-end">
                <p className="text-3xl font-black text-emerald-900 dark:text-emerald-400 transition-colors">{stats.attive}</p>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 px-2 py-1 rounded bg-white dark:bg-gray-900 transition-colors">GESTISCI</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Nuovo Impianto + Mappa Leaflet */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col transition-colors">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-100 dark:border-gray-800 pb-3 transition-colors">Registra Nuovo Impianto</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow">
            
            {/* Form */}
            <form onSubmit={handleAddParking} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">Nome Struttura</label>
                <input type="text" value={newParking.nome} onChange={e => setNewParking({...newParking, nome: e.target.value})} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-500 transition-colors" placeholder="Es. Vittoria" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">Capacità Max</label>
                  <input type="number" value={newParking.postitot} onChange={e => setNewParking({...newParking, postitot: parseInt(e.target.value)})} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-500 transition-colors" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">Tipologia</label>
                  <select value={newParking.coperto} onChange={e => setNewParking({...newParking, coperto: e.target.value === 'true'})} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-500 transition-colors">
                    <option value="true">Coperto</option>
                    <option value="false">All'aperto</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide text-emerald-600 dark:text-emerald-500">Lat (Auto)</label>
                  <input type="text" readOnly value={newParking.latitudine.toFixed(5)} className="w-full p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 font-mono text-emerald-900 dark:text-emerald-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide text-emerald-600 dark:text-emerald-500">Lng (Auto)</label>
                  <input type="text" readOnly value={newParking.longitudine.toFixed(5)} className="w-full p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 font-mono text-emerald-900 dark:text-emerald-400 transition-colors" />
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
                Salva Impianto
              </button>
            </form>

            {/* Mappa Interattiva */}
            <div className="relative h-64 md:h-full rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-sm z-0">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[400] bg-emerald-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md whitespace-nowrap">
                Clicca per posizionare
              </div>
              <MapContainer center={[45.5416, 10.2167]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                <LocationSelector 
                  position={{ lat: newParking.latitudine, lng: newParking.longitudine }} 
                  setPosition={(pos) => setNewParking({...newParking, latitudine: pos.lat, longitudine: pos.lng})} 
                />
              </MapContainer>
            </div>

          </div>
        </div>

        {/* Live Terminal */}
        <div className="bg-gray-900 dark:bg-black p-6 rounded-2xl border border-gray-800 shadow-xl flex flex-col transition-colors">
          <div className="flex items-center gap-2 mb-4 border-b border-gray-800 pb-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 className="text-lg font-mono font-bold text-emerald-400">Activity_Feed.log</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="space-y-3 font-mono text-[11px] text-gray-300">
              {terminalFeed.length === 0 ? (
                <p className="text-gray-600 animate-pulse">In attesa di eventi...</p>
              ) : (
                terminalFeed.map((feed, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-gray-500 shrink-0">[{formattaData(feed.orarioinizio).split(',')[1].trim()}]</span>
                    {feed.stato === 'Attiva' ? (
                      <span className="text-emerald-400">IN: <span className="text-white font-bold">{feed.targa}</span> in {feed.posti_auto?.parcheggi?.nome}</span>
                    ) : (
                      <span className="text-blue-400">OUT: <span className="text-white font-bold">{feed.targa}</span> da {feed.posti_auto?.parcheggi?.nome}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Inserimento Stalli */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col hover:border-gray-300 transition-colors">
          <h2 className="text-lg font-bold text-emerald-900 dark:text-gray-100 mb-6 border-b border-gray-100 dark:border-gray-800 pb-3 transition-colors">Inserimento Stalli</h2>
          <form onSubmit={handleAddSpot} className="space-y-4 flex-grow flex flex-col">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">Impianto di Destinazione</label>
              <select value={newSpot.idparcheggio} onChange={(e) => setNewSpot({...newSpot, idparcheggio: e.target.value})} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-500 transition-colors">
                {listaParcheggi.map(p => <option key={p.idparcheggio} value={p.idparcheggio}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">Settore / Piano</label>
              <input type="text" value={newSpot.piano} onChange={e => setNewSpot({...newSpot, piano: e.target.value})} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-500 transition-colors" placeholder="Es. Piano Terra" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">Categoria Stallo</label>
              <select value={newSpot.tipoposto} onChange={e => setNewSpot({...newSpot, tipoposto: e.target.value})} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-500 transition-colors">
                <option value="Standard">Standard</option>
                <option value="Disabili">Riservato Disabili</option>
                <option value="Elettrico">Ricarica Elettrica</option>
              </select>
            </div>
            <div className="mt-auto pt-4">
              <button type="submit" className="w-full bg-emerald-700 dark:bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-800 dark:hover:bg-emerald-700 transition-all">
                Aggiungi Stallo
              </button>
            </div>
          </form>
        </div>

        {/* Grafici: Ciambella + Linea */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 transition-colors">Performance Rete</h2>
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl transition-colors">
              {['settimana', 'mese', 'tutto'].map(v => (
                <button 
                  key={v} 
                  onClick={() => setChartView(v)} 
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${chartView === v ? 'bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-[250px] flex items-center">
             <ResponsiveContainer width="100%" height="100%">
               <div className="w-full h-full flex flex-col md:flex-row gap-4">

                 {/* Line Chart */}
                 <div className="w-full md:w-2/3 h-full">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.2} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#1f2937', color: '#fff' }} itemStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                      <Line type="monotone" dataKey="co2" name="CO₂ Risparmiata (kg)" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="soste" name="Soste Totali" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                 </div>
               </div>
             </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabella Utenti */}
      <div className="bg-white dark:bg-gray-900 pt-8 pb-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm mb-8 overflow-hidden transition-colors">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-8 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4 gap-4 transition-colors">
          <div>
            <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 transition-colors">Gestione Utenti</h2>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest transition-colors">Controlla e modera gli iscritti</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
             <input 
               type="text" 
               placeholder="Cerca per nome o ID..." 
               value={searchUserTerm}
               onChange={(e) => setSearchUserTerm(e.target.value)}
               className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none w-full sm:w-64 transition-all"
             />
             <select 
               value={filterUserRole} 
               onChange={(e) => setFilterUserRole(e.target.value)}
               className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none transition-all cursor-pointer"
             >
               <option value="all">Tutti i ruoli</option>
               <option value="utente">Utenti standard</option>
               <option value="admin">Amministratori</option>
             </select>
          </div>
        </div>
        
        <div className="overflow-x-auto overflow-y-auto h-[400px] custom-scrollbar px-3 sm:px-8 relative">
          {filteredUtenti.length > 0 ? (
            <table className="w-full min-w-[600px] text-left border-collapse relative">
              <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10 shadow-sm transition-colors">
                <tr className="border-b border-gray-100 dark:border-gray-800 transition-colors">
                  <th className="p-3 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-white dark:bg-gray-900 transition-colors">Utente</th>
                  <th className="p-3 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-white dark:bg-gray-900 transition-colors">Contatti</th>
                  <th className="p-3 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-white dark:bg-gray-900 transition-colors">Ruolo</th>
                  <th className="p-3 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center bg-white dark:bg-gray-900 transition-colors">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50 transition-colors">
                {filteredUtenti.map(utente => (
                  <tr key={utente.idpersona} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="p-3">
                      <p className="font-bold text-gray-800 dark:text-gray-200 transition-colors">{utente.nome || 'Utente'} {utente.cognome || ''}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono transition-colors">ID: {String(utente.idpersona).substring(0, 8)}</p>
                    </td>
                    <td className="p-3 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors">
                      {utente.telefono || 'N/A'}<br/>
                      <span className="text-xs text-gray-400 dark:text-gray-500 transition-colors">{utente.citta || ''}</span>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase border transition-colors ${
                        utente.ruolo === 'admin' 
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 border-purple-200 dark:border-purple-800/50' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                      }`}>
                        {utente.ruolo || 'user'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {utente.idpersona !== profile?.idpersona ? (
                        <div className="grid grid-cols-2 gap-2 w-52 mx-auto">
                          <div>
                            {utente.ruolo !== 'admin' && (
                              <button 
                                onClick={() => handleMakeAdmin(utente)}
                                className="w-full text-[10px] font-bold px-3 py-2 rounded-lg border uppercase transition-all
                                          border-purple-600 dark:border-purple-500 text-purple-600 dark:text-purple-400 bg-transparent hover:bg-purple-50 dark:hover:bg-purple-900/30"
                              >
                                Rendi Admin
                              </button>
                            )}
                          </div>
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
                                  className="w-full text-[10px] font-bold px-1 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                                >
                                  Ann.
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setConfirmDeleteUserId(utente.idpersona)}
                                className="w-full text-[10px] font-bold px-3 py-2 rounded-lg border text-red-600 dark:text-red-400 bg-white dark:bg-gray-900 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all uppercase"
                              >
                                Elimina
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg transition-colors">Il tuo account</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm font-bold bg-gray-50 dark:bg-gray-900 px-6 py-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 transition-colors">
                Nessun utente trovato per questi filtri.
              </p>
            </div>
          )}
        </div>
      </div>

      {showBookingsModal && (
        <div onClick={() => setShowBookingsModal(false)} className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] cursor-pointer transition-all">
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-gray-900 p-4 sm:p-8 rounded-[2.5rem] max-w-4xl w-full shadow-2xl relative cursor-default flex flex-col max-h-[90vh] transition-colors border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col gap-3 border-b border-gray-100 dark:border-gray-800 pb-4 mb-4 transition-colors">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white transition-colors">Registro Prenotazioni</h2>
              <div className="flex flex-row items-center justify-between w-full gap-2 sm:gap-4">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest hidden xs:inline transition-colors">Focus:</span>
                    <select 
                      value={filterParkingId} 
                      onChange={(e) => setFilterParkingId(e.target.value)}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 max-w-[120px] sm:max-w-none transition-colors"
                    >
                      <option value="all">Tutti</option>
                      {listaParcheggi.map(park => (
                        <option key={park.idparcheggio} value={park.idparcheggio}>{park.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg shrink-0 transition-colors">
                    <button onClick={() => setActiveTab('attive')} className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${activeTab === 'attive' ? 'bg-white dark:bg-gray-700 text-emerald-800 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>In corso</button>
                    <button onClick={() => setActiveTab('storico')} className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${activeTab === 'storico' ? 'bg-white dark:bg-gray-700 text-emerald-800 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Storico</button>
                  </div>
                  <button onClick={handleExportCSV} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm transition-all shrink-0">esporta CSV</button>
                </div>
                <button onClick={() => setShowBookingsModal(false)} className="text-3xl font-bold text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition-colors leading-none p-2 shrink-0">&times;</button>
              </div>
            </div>

            <div className="h-[500px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {filteredBookings.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest text-xs transition-colors">Nessuna sosta trovata per questo filtro</p>
                </div>
              ) : (
                filteredBookings.map(pren => (
                  <div key={pren.idprenotazione} className="p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 flex items-center justify-between gap-4 hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono font-black text-gray-800 dark:text-gray-200 text-lg uppercase transition-colors">{pren.targa}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border transition-colors ${
                          pren.stato === 'Attiva' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' : 
                          pren.stato === 'Conclusa' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800/50' : 
                          'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-700'
                        }`}>{pren.stato}</span>
                      </div>
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase transition-colors">{pren.nomeParcheggi} • Stallo {pren.pianoPosto}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 transition-colors">{formattaData(pren.orarioinizio)} &rarr; {formattaData(pren.orariofine)}</p>
                    </div>
                    {pren.stato === 'Attiva' && (
                      <button onClick={() => setConfirmCancelId(pren.idprenotazione)} className="text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900/50 transition-all">Termina Sosta</button>
                    )}
                    {confirmCancelId === pren.idprenotazione && (
                      <div className="flex gap-2">
                        <button onClick={() => executeAdminCancelBooking(pren)} className="bg-red-600 text-white text-xs px-3 py-2 rounded-lg font-bold hover:bg-red-700">Conferma</button>
                        <button onClick={() => setConfirmCancelId(null)} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-3 py-2 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">No</button>
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