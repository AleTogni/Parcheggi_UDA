import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';
import ParkingMap from '../components/parkingmap';

export default function Home({ profile }) {
  const [parkings, setParkings] = useState([]);
  const [userVehicles, setUserVehicles] = useState([]);
  const [modalData, setModalData] = useState(null);
  const [bookingSpot, setBookingSpot] = useState(null);
  
  // STATO PER LA VISTA (Mappa o Lista)
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'list'

  // STATI PER FILTRI
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOnlyFree, setFilterOnlyFree] = useState(false);
  const [filterOnlyEV, setFilterOnlyEV] = useState(false);

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
    if (!pData) return;

    const merged = pData.map(p => {
      const posti = (postiData || []).filter(item => item.idparcheggio === p.idparcheggio);
      const occupati = posti.filter(item => item.stato?.toLowerCase() === 'occupato').length;
      const liberi = (p.postitot || 0) - occupati;
      const ratio = occupati / (p.postitot || 1);
      
      let color = "border-emerald-500 bg-emerald-50 text-emerald-900"; 
      if (ratio >= 1) color = "border-red-500 bg-red-50 text-red-900"; 
      else if (ratio >= 0.5) color = "border-blue-500 bg-blue-50 text-blue-900"; 
      
      return { ...p, occupati, liberi, color, postiList: posti };
    });
    setParkings(merged);
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

  const filteredParkings = parkings.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchFree = filterOnlyFree ? p.liberi > 0 : true;
    const matchEV = filterOnlyEV ? p.postiList.some(posto => posto.tipoposto === 'Elettrico') : true;
    return matchSearch && matchFree && matchEV;
  });

  let preventivo = 0;
  if (bookingStart && bookingEnd) {
    const start = new Date(bookingStart);
    const end = new Date(bookingEnd);
    if (end > start) {
      const oreSosta = (end - start) / (1000 * 60 * 60);
      preventivo = (oreSosta * tariffaOraria).toFixed(2);
    }
  }

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

  const closeModal = () => { setModalData(null); setBookingSpot(null); setUiMessage({text:'', type:''}); };

  // LOGICA PRENOTAZIONE SMART: Raggruppa i posti per tipo
  const getGroupedSpots = () => {
    if (!modalData) return {};
    const free = modalData.postiList.filter(p => p.stato?.toLowerCase() === 'libero');
    return {
      Standard: free.filter(p => p.tipoposto === 'Standard'),
      Elettrico: free.filter(p => p.tipoposto === 'Elettrico'),
      Disabili: free.filter(p => p.tipoposto === 'Disabili')
    };
  };

  const grouped = getGroupedSpots();

  return (
    <div className="max-w-6xl mx-auto p-6 relative z-0">
      
      {/* HEADER DINAMICO CON TOGGLE */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Brescia <span className="text-emerald-600">Green Park</span></h1>
          <p className="text-gray-500 text-sm font-medium mt-1">Gestione intelligente della sosta urbana</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-center">
          
          {/* SEARCH BOX */}
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

          {/* TOGGLE VISTA MARE / LISTA */}
          <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200">
            <button 
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'map' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}
            >
              🗺️ Mappa
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}
            >
              📋 Lista
            </button>
          </div>
          
          {/* FILTRI RAPIDI */}
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setFilterOnlyFree(!filterOnlyFree)}
              className={`flex-1 sm:flex-none px-3 py-2.5 rounded-xl text-[10px] font-black border transition-all uppercase tracking-tighter ${filterOnlyFree ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              Liberi
            </button>
            <button 
              onClick={() => setFilterOnlyEV(!filterOnlyEV)}
              className={`flex-1 sm:flex-none px-3 py-2.5 rounded-xl text-[10px] font-black border transition-all uppercase tracking-tighter ${filterOnlyEV ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              EV
            </button>
          </div>
        </div>
      </div>
      
      {/* RENDERING CONDIZIONALE VISTA */}
      {viewMode === 'map' ? (
        <ParkingMap parkings={filteredParkings} onMarkerClick={(id) => setModalData(parkings.find(p => p.idparcheggio === id))} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {filteredParkings.map(p => (
            <div key={p.idparcheggio} onClick={() => setModalData(p)} className={`p-6 rounded-3xl border-2 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl relative overflow-hidden group ${p.color}`}>
              <div className="relative z-10">
                <h3 className="font-black text-2xl mb-1 group-hover:text-emerald-600 transition-colors">{p.nome}</h3>
                <p className="text-4xl font-black mb-4">
                  {p.liberi} <span className="text-sm font-bold opacity-60 uppercase tracking-widest">Posti Liberi</span>
                </p>
                <div className="flex gap-2">
                   {p.postiList.some(s => s.tipoposto === 'Elettrico') && <span className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded-lg font-black shadow-sm">⚡ EV</span>}
                   {p.postiList.some(s => s.tipoposto === 'Disabili') && <span className="bg-yellow-500 text-white text-[10px] px-2 py-1 rounded-lg font-black shadow-sm">♿ H</span>}
                </div>
              </div>
              {/* Decorazione di sfondo */}
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredParkings.length === 0 && (
        <div className="text-center py-20 bg-gray-50 rounded-[3rem] border border-dashed border-gray-300">
           <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-sm">Nessun parcheggio trovato</p>
        </div>
      )}

      {/* MODALE PRENOTAZIONE SMART */}
      {modalData && (
        <div onClick={closeModal} className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] transition-all">
          <div onClick={(e) => e.stopPropagation()} className="bg-white p-8 rounded-[2.5rem] max-w-2xl w-full shadow-2xl relative animate-scale-up">
            <button onClick={closeModal} className="absolute top-6 right-6 text-3xl font-bold text-gray-300 hover:text-gray-800 transition-colors">&times;</button>
            <h2 className="text-4xl font-black text-gray-900 mb-2">{modalData.nome}</h2>
            <p className="text-gray-500 font-bold mb-8 uppercase text-xs tracking-widest border-b pb-4">Seleziona tipologia di sosta</p>
            
            {uiMessage.text && (
              <div className={`p-4 rounded-2xl mb-6 text-sm font-bold text-center border ${uiMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                {uiMessage.text}
              </div>
            )}

            {!bookingSpot ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-[400px]">
                {/* CARD SMART PER TIPOLOGIA */}
                {Object.entries(grouped).map(([tipo, posti]) => (
                  <div key={tipo} className={`p-6 rounded-3xl border-2 flex flex-col items-center justify-center text-center transition-all ${posti.length > 0 ? 'border-emerald-100 bg-emerald-50/30 hover:border-emerald-500 cursor-pointer' : 'opacity-40 border-gray-100 bg-gray-50'}`} onClick={() => posti.length > 0 && setBookingSpot(posti[0])}>
                    <span className="text-3xl mb-3">{tipo === 'Standard' ? '🚗' : tipo === 'Elettrico' ? '⚡' : '♿'}</span>
                    <span className="font-black text-gray-800 uppercase text-xs mb-1">{tipo}</span>
                    <span className={`text-xl font-black ${posti.length > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{posti.length}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">disponibili</span>
                    {posti.length > 0 && <button className="mt-4 bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Scegli</button>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl flex flex-col h-[400px]">
                <div className="flex items-center gap-4 mb-8 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-emerald-200">✨</div>
                  <div>
                    <h3 className="font-black text-gray-800">Posto Assegnato: {bookingSpot.tipoposto}</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">{bookingSpot.piano} • Sistema automatico Brescia Green</p>
                  </div>
                </div>
                
                <div className="space-y-4 mb-auto">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Il tuo Veicolo</label>
                    <select value={selectedTarga} onChange={(e) => setSelectedTarga(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-100 border-0 ring-1 ring-gray-200 focus:ring-2 focus:ring-emerald-500 font-black text-gray-800 outline-none transition-all">
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
                      <input type="datetime-local" min={nowStr} value={bookingStart} onChange={(e) => setBookingStart(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-100 border-0 ring-1 ring-gray-200 focus:ring-2 focus:ring-emerald-500 font-black text-sm text-gray-800 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1 tracking-widest">Check-Out</label>
                      <input type="datetime-local" min={bookingStart || nowStr} value={bookingEnd} onChange={(e) => setBookingEnd(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-100 border-0 ring-1 ring-gray-200 focus:ring-2 focus:ring-emerald-500 font-black text-sm text-gray-800 outline-none" />
                    </div>
                  </div>

                  {preventivo > 0 && (
                    <div className="bg-emerald-900 p-5 rounded-2xl flex justify-between items-center shadow-xl shadow-emerald-100">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Costo della Sosta</p>
                      <p className="text-3xl font-black text-white">{preventivo} €</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={handleConfirmBooking} className="flex-1 bg-emerald-600 text-white py-5 rounded-[1.5rem] font-black text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">Paga e Conferma</button>
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