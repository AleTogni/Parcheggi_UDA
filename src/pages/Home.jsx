import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';
import ParkingMap from '../components/parkingmap';

export default function Home({ profile }) {
  const [parkings, setParkings] = useState([]);
  const [userVehicles, setUserVehicles] = useState([]);
  const [modalData, setModalData] = useState(null);
  const [bookingSpot, setBookingSpot] = useState(null);
  
  // STATI PER FILTRI E GPS
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOnlyDisabled, setFilterOnlyDisabled] = useState(false); // NUOVO: Filtro Disabili
  const [filterOnlyEV, setFilterOnlyEV] = useState(false);
  const [sortBy, setSortBy] = useState('liberi'); 
  const [userLoc, setUserLoc] = useState(null); 

  const [hoveredParkingId, setHoveredParkingId] = useState(null);

  const [cityStats, setCityStats] = useState({ freeSpots: 0, evSpots: 0, activeSoste: 0 });

  const [selectedTarga, setSelectedTarga] = useState('');
  const [nuovaTarga, setNuovaTarga] = useState('');
  const [bookingStart, setBookingStart] = useState('');
  const [bookingEnd, setBookingEnd] = useState('');
  const [uiMessage, setUiMessage] = useState({ text: '', type: '' });

  const tariffaOraria = 2.00; 
  const nowStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  useEffect(() => { 
    loadData();
    if (profile) loadUserVehicles();
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
    setUserVehicles(data || []);
    if (data && data.length > 0) setSelectedTarga(data[0].targa);
  };

  const showMessage = (text, type = 'error') => {
    setUiMessage({ text, type });
    setTimeout(() => setUiMessage({ text: '', type: '' }), 4000);
  };

  // LOGICA DI FILTRAGGIO AGGIORNATA
  const filteredParkings = parkings.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDisabled = filterOnlyDisabled ? p.postiList.some(posto => posto.tipoposto === 'Disabili') : true;
    const matchEV = filterOnlyEV ? p.postiList.some(posto => posto.tipoposto === 'Elettrico') : true;
    return matchSearch && matchDisabled && matchEV;
  }).sort((a, b) => {
    if (sortBy === 'liberi') return b.liberi - a.liberi;
    if (sortBy === 'nome') return a.nome.localeCompare(b.nome);
    if (sortBy === 'vicini' && userLoc) {
      const distA = Math.hypot(a.latitudine - userLoc.lat, a.longitudine - userLoc.lng);
      const distB = Math.hypot(b.latitudine - userLoc.lat, b.longitudine - userLoc.lng);
      return distA - distB;
    }
    return 0;
  });

  const handleSortVicini = () => {
    if (!userLoc) alert("Clicca sull'icona della posizione in basso a destra nella mappa prima di usare questo filtro!");
    else setSortBy('vicini');
  };

  const handleConfirmBooking = async () => {
    let targaFinale = selectedTarga;
    if (userVehicles.length === 0) {
      if (!nuovaTarga || nuovaTarga.length < 5) return showMessage("Inserisci una targa valida.");
      targaFinale = nuovaTarga.toUpperCase();
      await supabase.from('veicolo').insert([{ idpersona: profile.idpersona, targa: targaFinale, alimentazione: 'Termica' }]);
      loadUserVehicles();
    }
    if (!bookingStart || !bookingEnd) return showMessage("Inserisci arrivo e uscita.");
    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error: errPren } = await supabase.from('prenotazione').insert([{
      idpersona: profile.idpersona, targa: targaFinale, idposto: bookingSpot.idposto,
      codiceaccesso: accessCode, orarioinizio: bookingStart, orariofine: bookingEnd,
      stato: 'Attiva', costo: preventivo
    }]);
    if (errPren) return showMessage(errPren.message);
    await supabase.from('posto_auto').update({ stato: 'Occupato' }).eq('idposto', bookingSpot.idposto);
    showMessage(`Sosta confermata! Codice: ${accessCode}`, 'success');
    setTimeout(() => { closeModal(); loadData(); }, 2000);
  };

  const closeModal = () => { 
    setModalData(null); 
    setBookingSpot(null); 
    setUiMessage({text:'', type:''}); 
    setBookingStart('');
    setBookingEnd('');
  };

  const getGroupedSpots = () => {
    if (!modalData) return {};
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

            {/* NUOVI FILTRI: DISABILI ED EV */}
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setFilterOnlyDisabled(!filterOnlyDisabled)} 
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black border transition-all uppercase tracking-tighter flex items-center justify-center gap-1 ${filterOnlyDisabled ? 'bg-yellow-500 text-white border-yellow-500 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                 Disabili
              </button>
              <button 
                onClick={() => setFilterOnlyEV(!filterOnlyEV)} 
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black border transition-all uppercase tracking-tighter flex items-center justify-center gap-1 ${filterOnlyEV ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> EV
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-gray-200 pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>
            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Posti in Città</p><p className="text-xl font-black text-gray-800">{cityStats.freeSpots}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Colonnine Libere</p><p className="text-xl font-black text-gray-800">{cityStats.evSpots}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg></div>
            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Soste Attive Ora</p><p className="text-xl font-black text-gray-800">{cityStats.activeSoste}</p></div>
          </div>
        </div>
      </div>
      
      {/* LAYOUT SPLIT */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        <div className="w-full lg:w-2/3">
          <ParkingMap 
            parkings={filteredParkings} 
            onMarkerClick={(id) => setModalData(parkings.find(p => p.idparcheggio === id))} 
            userLoc={userLoc} 
            setUserLoc={setUserLoc} 
            hoveredParkingId={hoveredParkingId}
            setHoveredParkingId={setHoveredParkingId}
          />
        </div>

        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          <div className="flex justify-between items-center bg-gray-50 p-2 rounded-xl border border-gray-100">
            <span className="text-xs font-bold text-gray-500 pl-2">Ordina per:</span>
            <div className="flex bg-white rounded-lg p-0.5 shadow-sm border border-gray-100">
              <button onClick={() => setSortBy('liberi')} className={`px-3 py-1.5 text-[10px] font-black uppercase transition-all rounded-md ${sortBy === 'liberi' ? 'bg-emerald-600 text-white' : 'text-gray-500'}`}>Liberi</button>
              <button onClick={() => setSortBy('nome')} className={`px-3 py-1.5 text-[10px] font-black uppercase transition-all rounded-md ${sortBy === 'nome' ? 'bg-emerald-600 text-white' : 'text-gray-500'}`}>A-Z</button>
              <button onClick={handleSortVicini} className={`px-3 py-1.5 text-[10px] font-black uppercase transition-all rounded-md ${sortBy === 'vicini' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>Vicini</button>
            </div>
          </div>

          {/* FIX BUG GRAFICO: Aggiunto px-2, py-2 e -mx-2 al contenitore per dare spazio al box-shadow e al ring di "uscire" senza essere tagliato */}
          <div className="overflow-y-auto max-h-[440px] px-2 py-2 -mx-2 custom-scrollbar pb-10 flex flex-col gap-4">
            {filteredParkings.map(p => {
              const isHovered = hoveredParkingId === p.idparcheggio;
              const hoverStyles = isHovered 
                ? 'ring-4 ring-emerald-400 shadow-2xl scale-[1.02] z-20 transition-all duration-300' 
                : 'hover:-translate-y-1 hover:shadow-lg transition-all duration-300';

              return (
                <div 
                  key={p.idparcheggio} 
                  onClick={() => setModalData(p)} 
                  onMouseEnter={() => setHoveredParkingId(p.idparcheggio)}
                  onMouseLeave={() => setHoveredParkingId(null)}
                  className={`shrink-0 p-4 rounded-2xl border-2 cursor-pointer relative overflow-hidden group ${p.color} ${hoverStyles}`}
                >
                  <div className="relative z-10 flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-lg mb-1 group-hover:text-emerald-700 transition-colors">{p.nome}</h3>
                      <p className="text-2xl font-black">
                        {p.liberi} <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">/ {p.postitot} liberi</span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                       {p.postiList.some(s => s.tipoposto === 'Elettrico') && <span className="bg-blue-600 text-white text-[9px] px-2 py-1 rounded font-black shadow-sm flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> EV</span>}
                       {p.postiList.some(s => s.tipoposto === 'Disabili') && <span className="bg-yellow-500 text-white text-[9px] px-2 py-1 rounded font-black shadow-sm flex items-center gap-1">♿ H</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredParkings.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-300">
                 <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Nessun risultato</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODALE PRENOTAZIONE SMART (Rimasta identica a prima) */}
      {modalData && (
        <div onClick={closeModal} className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] transition-all overflow-y-auto">
          <div onClick={(e) => e.stopPropagation()} className="bg-white p-8 rounded-[2.5rem] max-w-2xl w-full shadow-2xl relative animate-scale-up my-auto">
            <button onClick={closeModal} className="absolute top-6 right-6 text-3xl font-bold text-gray-300 hover:text-gray-800 transition-colors">&times;</button>
            <h2 className="text-4xl font-black text-gray-900 mb-2">{modalData.nome}</h2>
            <p className="text-gray-500 font-bold mb-8 uppercase text-xs tracking-widest border-b pb-4">Seleziona tipologia di sosta</p>
            
            {uiMessage.text && (
              <div className={`p-4 rounded-2xl mb-6 text-sm font-bold text-center border ${uiMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                {uiMessage.text}
              </div>
            )}

            {!bookingSpot ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-h-[300px]">
                {Object.entries(grouped).map(([tipo, posti]) => (
                  <div key={tipo} className={`p-6 rounded-3xl border-2 flex flex-col items-center justify-center text-center transition-all ${posti.length > 0 ? 'border-emerald-100 bg-emerald-50/30 hover:border-emerald-500 cursor-pointer' : 'opacity-40 border-gray-100 bg-gray-50'}`} onClick={() => posti.length > 0 && setBookingSpot(posti[0])}>
                    
                    {tipo === 'Standard' && <svg className={`w-10 h-10 mb-3 ${posti.length > 0 ? 'text-emerald-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>}
                    {tipo === 'Elettrico' && <svg className={`w-10 h-10 mb-3 ${posti.length > 0 ? 'text-emerald-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>}
                    {tipo === 'Disabili' && <svg className={`w-10 h-10 mb-3 ${posti.length > 0 ? 'text-emerald-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.5 19.5a3 3 0 11-6 0 3 3 0 016 0zM12 6.75a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM9 14.25v-3.75a3 3 0 013-3h1.5a3 3 0 013 3v3.75" /></svg>}

                    <span className="font-black text-gray-800 uppercase text-xs mb-1">{tipo}</span>
                    <span className={`text-2xl font-black ${posti.length > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{posti.length}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">disponibili</span>
                    {posti.length > 0 && <button className="mt-4 bg-emerald-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm">Scegli</button>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl flex flex-col">
                <div className="flex items-center gap-4 mb-8 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-black text-emerald-900 text-lg">Posto {bookingSpot.tipoposto}</h3>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{bookingSpot.piano} • Assegnato</p>
                  </div>
                </div>
                
                <div className="space-y-4 mb-auto">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Il tuo Veicolo</label>
                    <select value={selectedTarga} onChange={(e) => setSelectedTarga(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 font-black text-gray-800 outline-none transition-all">
                      {userVehicles.map(v => (
                        <option key={v.targa} value={v.targa}>
                          {v.targa} ({v.alimentazione || 'Termica'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Check-In</label>
                      <input type="datetime-local" min={nowStr} value={bookingStart} onChange={(e) => setBookingStart(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 font-black text-sm text-gray-800 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Check-Out</label>
                      <input type="datetime-local" min={bookingStart || nowStr} value={bookingEnd} onChange={(e) => setBookingEnd(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 font-black text-sm text-gray-800 outline-none" />
                    </div>
                  </div>

                  {preventivo > 0 && (
                    <div className="bg-emerald-900 p-5 rounded-2xl flex justify-between items-center shadow-lg mt-4">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Costo della Sosta</p>
                      <p className="text-3xl font-black text-white">{preventivo} €</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-8">
                  <button onClick={handleConfirmBooking} className="flex-1 bg-emerald-600 text-white py-4 rounded-[1.5rem] font-black text-lg hover:bg-emerald-700 transition-all shadow-md">Paga e Conferma</button>
                  <button onClick={() => setBookingSpot(null)} className="px-10 bg-gray-100 text-gray-500 rounded-[1.5rem] font-black hover:bg-gray-200 transition-all uppercase text-xs">Cambia</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}