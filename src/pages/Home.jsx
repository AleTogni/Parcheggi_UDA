import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';
import ParkingMap from '../components/parkingmap';

export default function Home({ profile }) {
  const [parkings, setParkings] = useState([]);
  const [userVehicles, setUserVehicles] = useState([]);
  const [modalData, setModalData] = useState(null);
  const [bookingSpot, setBookingSpot] = useState(null);
  
  // STATI PER FILTRI E POSIZIONE
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOnlyDisabled, setFilterOnlyDisabled] = useState(false);
  const [filterOnlyEV, setFilterOnlyEV] = useState(false);
  const [sortBy, setSortBy] = useState('liberi'); 
  const [userLoc, setUserLoc] = useState(null); 

  const [hoveredParkingId, setHoveredParkingId] = useState(null);
  const [cityStats, setCityStats] = useState({ freeSpots: 0, evSpots: 0, activeSoste: 0 });

  // STATI PER IL PROCESSO DI PRENOTAZIONE
  const [selectedTarga, setSelectedTarga] = useState('manuale');
  const [nuovaTarga, setNuovaTarga] = useState('');
  const [bookingStart, setBookingStart] = useState('');
  const [bookingEnd, setBookingEnd] = useState('');

  // GESTIONE NOTIFICHE (Esterna per GPS, Interna per Dati/Successo)
  const [uiMessage, setUiMessage] = useState({ text: '', type: '' });
  const [showGpsError, setShowGpsError] = useState(false);

  const tariffaOraria = 2.00; 
  const nowStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const IconH = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
      <path d="M18 19l-2-4m0 0l-2-4m2 4H9m3 0l-2-4m2 4v4m-6-4a5 5 0 1 1 10 0" />
    </svg>
  );

  useEffect(() => { 
    loadData();
    if (profile) loadUserVehicles();

    // SOTTOSCRIZIONE REALTIME
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posto_auto' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prenotazione' }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const loadData = async () => {
    const { data: pData } = await supabase.from('parcheggio').select('*');
    const { data: postiData } = await supabase.from('posto_auto').select('*');
    const { count: activeCount } = await supabase.from('prenotazione').select('*', { count: 'exact', head: true }).eq('stato', 'Attiva');

    if (!pData) return;

    let totalFree = 0;
    let totalEVFree = 0;

    const merged = pData.map(p => {
      const posti = (postiData || []).filter(item => item.idparcheggio === p.idparcheggio);
      const occupati = posti.filter(item => item.stato?.toLowerCase() === 'occupato').length;
      const liberi = (p.postitot || 0) - occupati;
      const ratio = occupati / (p.postitot || 1);
      
      const freeEV = posti.filter(item => item.tipoposto === 'Elettrico' && item.stato?.toLowerCase() === 'libero').length;
      totalFree += liberi;
      totalEVFree += freeEV;

      let color = "border-emerald-500 bg-emerald-50 text-emerald-900"; 
      if (ratio >= 1) color = "border-red-500 bg-red-50 text-red-900"; 
      else if (ratio >= 0.5) color = "border-blue-500 bg-blue-50 text-blue-900"; 
      
      return { ...p, occupati, liberi, color, postiList: posti };
    });

    setParkings(merged);
    setCityStats({ freeSpots: totalFree, evSpots: totalEVFree, activeSoste: activeCount || 0 });
  };

  const loadUserVehicles = async () => {
    const { data } = await supabase.from('veicolo').select('*').eq('idpersona', profile.idpersona);
    const validVehicles = data || [];
    setUserVehicles(validVehicles);
    if (validVehicles.length > 0) setSelectedTarga(validVehicles[0].targa);
    else setSelectedTarga('manuale');
  };

  const showInternalMessage = (text, type = 'error') => {
    setUiMessage({ text, type });
    setTimeout(() => setUiMessage({ text: '', type: '' }), 4000);
  };

  const handleSortVicini = () => {
    if (!userLoc) {
      setShowGpsError(true);
      setTimeout(() => setShowGpsError(false), 4000);
    } else {
      setSortBy('vicini');
    }
  };

  const filteredParkings = (parkings || []).filter(p => {
    const matchSearch = p.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDisabled = filterOnlyDisabled ? p.postiList?.some(posto => posto.tipoposto === 'Disabili') : true;
    const matchEV = filterOnlyEV ? p.postiList?.some(posto => posto.tipoposto === 'Elettrico') : true;
    return matchSearch && matchDisabled && matchEV;
  }).sort((a, b) => {
    if (sortBy === 'liberi') return b.liberi - a.liberi;
    if (sortBy === 'nome') return a.nome?.localeCompare(b.nome);
    if (sortBy === 'vicini' && userLoc) {
      const distA = Math.hypot(a.latitudine - userLoc.lat, a.longitudine - userLoc.lng);
      const distB = Math.hypot(b.latitudine - userLoc.lat, b.longitudine - userLoc.lng);
      return distA - distB;
    }
    return 0;
  });

  // FUNZIONE AGGIORNATA PER RISOLVERE L'ERRORE FOREIGN KEY
  const handleConfirmBooking = async () => {
    if (!bookingSpot) return;

    const start = new Date(bookingStart);
    const end = new Date(bookingEnd);
    const now = new Date();

    if (!bookingStart || !bookingEnd) return showInternalMessage("Inserisci orario di arrivo e uscita.");
    if (start < new Date(now.getTime() - 5 * 60000)) return showInternalMessage("L'orario di inizio è nel passato.");
    if (end <= start) return showInternalMessage("L'uscita deve essere successiva all'arrivo.");

    let targaFinale = selectedTarga === 'manuale' ? nuovaTarga.toUpperCase() : selectedTarga;
    if (selectedTarga === 'manuale' && nuovaTarga.length < 5) return showInternalMessage("Inserisci una targa valida.");

    // REGISTRAZIONE AUTOMATICA VEICOLO PER RISOLVERE CONSTRAINT
    if (selectedTarga === 'manuale') {
      const { error: errV } = await supabase
        .from('veicolo')
        .upsert([{ 
          idpersona: profile.idpersona, 
          targa: targaFinale, 
          alimentazione: 'Termica' 
        }], { onConflict: 'targa' });
        
      if (errV) return showInternalMessage("Errore registrazione veicolo: " + errV.message);
    }

    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error: errPren } = await supabase.from('prenotazione').insert([{
      idpersona: profile.idpersona, 
      targa: targaFinale, 
      idposto: bookingSpot.idposto,
      codiceaccesso: accessCode, 
      orarioinizio: bookingStart, 
      orariofine: bookingEnd,
      stato: 'Attiva', 
      costo: preventivo
    }]);

    if (errPren) return showInternalMessage("Errore database: " + errPren.message);

    await supabase.from('posto_auto').update({ stato: 'Occupato' }).eq('idposto', bookingSpot.idposto);
    
    showInternalMessage("Prenotazione confermata con successo!", "success");
    setTimeout(() => { closeModal(); loadData(); }, 2000);
  };

  const closeModal = () => { 
    setModalData(null); 
    setBookingSpot(null); 
    setUiMessage({text:'', type:''}); 
    setBookingStart('');
    setBookingEnd('');
    setNuovaTarga('');
  };

  const getGroupedSpots = () => {
    if (!modalData?.postiList) return { Standard: [], Elettrico: [], Disabili: [] };
    const free = modalData.postiList.filter(p => p.stato?.toLowerCase() === 'libero');
    return {
      Standard: free.filter(p => p.tipoposto === 'Standard'),
      Elettrico: free.filter(p => p.tipoposto === 'Elettrico'),
      Disabili: free.filter(p => p.tipoposto === 'Disabili')
    };
  };

  let preventivo = 0;
  if (bookingStart && bookingEnd) {
    const start = new Date(bookingStart);
    const end = new Date(bookingEnd);
    if (end > start) preventivo = ((end - start) / (1000 * 60 * 60) * tariffaOraria).toFixed(2);
  }

  const grouped = getGroupedSpots();

  return (
    <div className="max-w-7xl mx-auto p-6 relative z-0">
      
      {/* NOTIFICA GPS ESTERNA */}
      {showGpsError && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2 rounded-full shadow-2xl font-black text-[10px] uppercase tracking-widest z-[500] animate-in fade-in zoom-in duration-300">
          Attiva il GPS sulla mappa per usare questo filtro
        </div>
      )}

      {/* SEZIONE RICERCA E FILTRI */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-6 gap-6">
          <div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight">Brescia <span className="text-emerald-600">Green Park</span></h1>
            <p className="text-gray-500 text-sm font-medium mt-1">Gestione intelligente della sosta urbana</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-center">
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input 
                type="text" 
                placeholder="Cerca parcheggio..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-bold transition-all"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setFilterOnlyDisabled(!filterOnlyDisabled)} 
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black border transition-all uppercase flex items-center justify-center gap-1 ${filterOnlyDisabled ? 'bg-yellow-500 text-white border-yellow-500 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                <IconH className="w-4 h-4" /> Disabili
              </button>
              <button 
                onClick={() => setFilterOnlyEV(!filterOnlyEV)} 
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black border transition-all uppercase flex items-center justify-center gap-1 ${filterOnlyEV ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> EV
              </button>
            </div>
          </div>
        </div>

        {/* STATS RAPIDE */}
        <div className="grid grid-cols-3 gap-4 border-t border-gray-200 pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>
            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Posti liberi</p><p className="text-xl font-black text-gray-800">{cityStats.freeSpots}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Colonnine ev</p><p className="text-xl font-black text-gray-800">{cityStats.evSpots}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg></div>
            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Soste attive</p><p className="text-xl font-black text-gray-800">{cityStats.activeSoste}</p></div>
          </div>
        </div>
      </div>
      
      {/* SEZIONE MAPPA E ELENCO */}
      <div className="flex flex-col lg:flex-row gap-6 lg:h-[600px]">
        <div className="w-full lg:w-2/3 h-full">
          <ParkingMap 
            parkings={filteredParkings} 
            onMarkerClick={(id) => setModalData(parkings.find(p => p.idparcheggio === id))} 
            userLoc={userLoc} 
            setUserLoc={setUserLoc} 
            hoveredParkingId={hoveredParkingId}
            setHoveredParkingId={setHoveredParkingId}
          />
        </div>

        <div className="w-full lg:w-1/3 flex flex-col gap-4 h-full">
          <div className="flex justify-between items-center bg-gray-50 p-2 rounded-xl border border-gray-100 shadow-sm flex-shrink-0">
            <span className="text-xs font-bold text-gray-500 pl-2">Ordina per:</span>
            <div className="flex bg-white rounded-lg p-0.5 border border-gray-100 shadow-inner">
              <button onClick={() => setSortBy('liberi')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${sortBy === 'liberi' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Liberi</button>
              <button onClick={() => setSortBy('nome')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${sortBy === 'nome' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>A-Z</button>
              <button onClick={handleSortVicini} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${sortBy === 'vicini' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Vicini</button>
            </div>
          </div>

          <div className="overflow-y-auto px-2 py-2 -mx-2 flex flex-col gap-4 custom-scrollbar flex-1">
            {filteredParkings.map(p => {
              const isHovered = hoveredParkingId === p.idparcheggio;
              return (
                <div 
                  key={p.idparcheggio} 
                  onClick={() => setModalData(p)} 
                  onMouseEnter={() => setHoveredParkingId(p.idparcheggio)}
                  onMouseLeave={() => setHoveredParkingId(null)}
                  className={`shrink-0 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${isHovered ? 'ring-4 ring-emerald-400 scale-[1.02] shadow-xl z-10' : 'hover:shadow-md'} ${p.color}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-lg group-hover:text-emerald-700 transition-colors">{p.nome}</h3>
                      <p className="text-2xl font-black">
                        {p.liberi} <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">/ {p.postitot} liberi</span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                       {p.postiList.some(s => s.tipoposto === 'Elettrico') && <span className="bg-blue-600 text-white text-[9px] px-2 py-1 rounded font-black flex items-center gap-1 shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> EV</span>}
                       {p.postiList.some(s => s.tipoposto === 'Disabili') && <span className="bg-yellow-500 text-white text-[9px] px-2 py-1 rounded font-black flex items-center gap-1 shadow-sm"><IconH className="w-3 h-3" /> H</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODALE DI PRENOTAZIONE */}
      {modalData && (
        <div onClick={closeModal} className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] transition-all overflow-y-auto">
          <div onClick={(e) => e.stopPropagation()} className="bg-white p-8 rounded-[2.5rem] max-w-2xl w-full shadow-2xl relative animate-scale-up my-auto">
            <button onClick={closeModal} className="absolute top-6 right-6 text-3xl font-bold text-gray-300 hover:text-gray-800 transition-colors">&times;</button>
            <h2 className="text-4xl font-black text-gray-900 mb-2">{modalData.nome}</h2>
            <p className="text-gray-400 font-bold mb-6 uppercase text-xs tracking-[0.2em] border-b pb-4">Gestione sosta</p>
            
            {/* NOTIFICA INTERNA ALLA MODALE */}
            {uiMessage.text && (
              <div className={`p-4 mb-6 rounded-2xl text-center font-black text-[10px] uppercase tracking-widest border animate-pulse ${
                uiMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {uiMessage.text}
              </div>
            )}

            {!bookingSpot ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-h-[300px]">
                {Object.entries(grouped).map(([tipo, posti]) => (
                  <div key={tipo} className={`p-6 rounded-3xl border-2 flex flex-col items-center justify-center text-center transition-all ${posti.length > 0 ? 'border-emerald-100 bg-emerald-50/30 hover:border-emerald-500 cursor-pointer shadow-sm hover:shadow-md' : 'opacity-40 bg-gray-50 border-gray-100'}`} onClick={() => posti.length > 0 && setBookingSpot(posti[0])}>
                    {tipo === 'Standard' && <svg className="w-10 h-10 mb-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
                    {tipo === 'Elettrico' && <svg className="w-10 h-10 mb-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                    {tipo === 'Disabili' && <IconH className="w-10 h-10 mb-3 text-yellow-500" />}
                    <span className="font-black text-gray-800 uppercase text-xs mb-1">{tipo}</span>
                    <span className={`text-2xl font-black ${posti.length > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{posti.length}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">liberi</span>
                    {posti.length > 0 && <button className="mt-4 bg-emerald-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm">Scegli</button>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl flex flex-col">
                <div className="flex items-center gap-4 mb-8 bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-black text-emerald-900 text-lg uppercase tracking-tighter">Assegnato: {bookingSpot.tipoposto}</h3>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{bookingSpot.piano} • Brescia Green</p>
                  </div>
                </div>
                
                <div className="space-y-4 mb-auto">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Il tuo veicolo</label>
                    <select value={selectedTarga} onChange={(e) => setSelectedTarga(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 font-black text-gray-800 outline-none transition-all shadow-sm">
                      {/* Correzione parentesi alimentazione */}
                      {userVehicles.map(v => (
                        <option key={v.targa} value={v.targa}>
                          {v.targa}{v.alimentazione ? ` (${v.alimentazione})` : ''}
                        </option>
                      ))}
                      <option value="manuale">Inserisci targa manualmente...</option>
                    </select>
                  </div>
                  {selectedTarga === 'manuale' && (
                    <div className="animate-scale-up">
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Nuova targa</label>
                      <input type="text" placeholder="Es. AA123BB" value={nuovaTarga} onChange={(e) => setNuovaTarga(e.target.value.toUpperCase())} className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-200 font-black uppercase outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Arrivo</label>
                      <input type="datetime-local" min={nowStr} value={bookingStart} onChange={(e) => setBookingStart(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-200 font-black text-sm text-gray-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 shadow-sm transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Uscita</label>
                      <input type="datetime-local" min={bookingStart || nowStr} value={bookingEnd} onChange={(e) => setBookingEnd(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-200 font-black text-sm text-gray-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 shadow-sm transition-all" />
                    </div>
                  </div>

                  {preventivo > 0 && (
                    <div className="bg-emerald-900 p-5 rounded-2xl flex justify-between items-center text-white shadow-lg animate-scale-up mt-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Costo totale stimato</p>
                      <p className="text-3xl font-black">{preventivo} €</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-8">
                  <button onClick={handleConfirmBooking} className="flex-1 bg-emerald-600 text-white py-4 rounded-[1.5rem] font-black text-lg hover:bg-emerald-700 transition-all shadow-md active:scale-95">Paga e conferma</button>
                  <button onClick={() => setBookingSpot(null)} className="px-10 bg-gray-100 text-gray-500 rounded-[1.5rem] font-black hover:bg-gray-200 transition-all text-xs tracking-widest">Indietro</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}