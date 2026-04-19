import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';
import ParkingMap from '../components/ParkingMap';

export default function Home({ profile }) {
  const [parkings, setParkings] = useState([]);
  const [userVehicles, setUserVehicles] = useState([]);
  const [modalData, setModalData] = useState(null);
  const [bookingSpot, setBookingSpot] = useState(null);
  
  const [selectedTarga, setSelectedTarga] = useState('');
  const [nuovaTarga, setNuovaTarga] = useState('');
  const [bookingStart, setBookingStart] = useState('');
  const [bookingEnd, setBookingEnd] = useState('');
  
  const [uiMessage, setUiMessage] = useState({ text: '', type: '' });

  // COSTANTE TARIFFA (Es. 2.00 Euro all'ora)
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
      const ratio = occupati / (p.postitot || 1);
      
      let color = "border-emerald-500 bg-emerald-50 text-emerald-900"; 
      if (ratio >= 1) color = "border-red-500 bg-red-50 text-red-900"; 
      else if (ratio >= 0.5) color = "border-blue-500 bg-blue-50 text-blue-900"; 
      
      return { ...p, occupati, color, postiList: posti };
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

  // CALCOLO PREVENTIVO IN TEMPO REALE
  let preventivo = 0;
  let oreSosta = 0;
  if (bookingStart && bookingEnd) {
    const start = new Date(bookingStart);
    const end = new Date(bookingEnd);
    if (end > start) {
      oreSosta = (end - start) / (1000 * 60 * 60); // Differenza in ore
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
    } else {
      if (!targaFinale) return showMessage("Seleziona un veicolo.");
    }

    if (!bookingStart || !bookingEnd) return showMessage("Inserisci arrivo e uscita.");

    const veicoloScelto = userVehicles.find(v => v.targa === targaFinale);

    if (bookingSpot.tipoposto === 'Disabili' && !profile.is_disabile) {
      return showMessage("Riservato ai possessori di Pass Disabili.");
    }
    if (bookingSpot.tipoposto === 'Elettrico' && veicoloScelto?.alimentazione !== 'Elettrica') {
      return showMessage("Riservato ai veicoli con alimentazione Elettrica.");
    }

    const startDate = new Date(bookingStart);
    const endDate = new Date(bookingEnd);
    
    if (startDate < new Date()) return showMessage("L'orario è già passato.");
    if (endDate <= startDate) return showMessage("L'uscita deve essere dopo l'arrivo.");

    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { error: errPren } = await supabase.from('prenotazione').insert([{
      idpersona: profile.idpersona,
      targa: targaFinale,
      idposto: bookingSpot.idposto,
      codiceaccesso: accessCode, // <-- BUG RISOLTO
      orarioinizio: startDate.toLocaleString('sv-SE').replace(' ', 'T'),
      orariofine: endDate.toLocaleString('sv-SE').replace(' ', 'T'),
      stato: 'Attiva',
      costo: preventivo // <-- SALVATAGGIO PREZZO
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

  return (
    <div className="max-w-6xl mx-auto p-6 relative z-0">
      <h1 className="text-3xl font-black mb-8 text-gray-800 tracking-tight">Brescia <span className="text-emerald-600">Green Park</span></h1>
      
      <ParkingMap parkings={parkings} onMarkerClick={(id) => setModalData(parkings.find(p => p.idparcheggio === id))} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {parkings.map(p => (
          <div key={p.idparcheggio} onClick={() => setModalData(p)} className={`p-6 rounded-3xl border-2 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg ${p.color}`}>
            <h3 className="font-bold text-xl mb-1">{p.nome}</h3>
            <p className="text-4xl font-black">{p.occupati} <span className="text-xl font-medium opacity-60">/ {p.postitot}</span></p>
            <p className="text-sm font-bold opacity-70 mt-2">Dettagli e prenotazioni &rarr;</p>
          </div>
        ))}
      </div>

      {modalData && (
        <div onClick={closeModal} className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div onClick={(e) => e.stopPropagation()} className="bg-white p-8 rounded-[2rem] max-w-2xl w-full shadow-2xl relative cursor-default">
            <button onClick={closeModal} className="absolute top-6 right-6 text-3xl font-bold text-gray-400 hover:text-gray-800 transition-colors">&times;</button>
            
            <h2 className="text-3xl font-black text-gray-900 mb-6">{modalData.nome}</h2>

            {!bookingSpot ? (
              <div className="space-y-3 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {modalData.postiList.map((posto, index) => (
                  <div key={posto.idposto} className="flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors rounded-2xl border border-gray-100">
                    <div>
                      <span className="font-black block text-lg text-gray-800">Posto N° {index + 1}</span>
                      <span className="text-sm text-gray-500 font-medium">{posto.tipoposto} • {posto.piano}</span>
                    </div>
                    {posto.stato?.toLowerCase() === 'libero' ? (
                      <button onClick={() => setBookingSpot(posto)} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold shadow-sm hover:bg-emerald-700 transition-all">Seleziona</button>
                    ) : (
                      <span className="px-4 py-2 bg-gray-200 text-gray-500 rounded-xl font-bold uppercase text-xs">Occupato</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl flex flex-col h-[400px]">
                <h3 className="text-2xl font-black mb-6 text-gray-800">Conferma Sosta</h3>
                
                {uiMessage.text && (
                  <div className={`p-4 rounded-xl mb-4 font-bold text-sm shadow-sm ${uiMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {uiMessage.text}
                  </div>
                )}

                <div className="space-y-4 mb-auto">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Veicolo Selezionato</label>
                    {userVehicles.length > 0 ? (
                      <select value={selectedTarga} onChange={(e) => setSelectedTarga(e.target.value)} className="w-full p-3 rounded-xl bg-gray-50 border-0 ring-1 ring-gray-200 focus:ring-2 focus:ring-emerald-500 font-bold text-gray-800 outline-none">
                        {userVehicles.map(v => <option key={v.targa} value={v.targa}>{v.targa} ({v.alimentazione})</option>)}
                      </select>
                    ) : (
                      <input type="text" placeholder="Targa (es. AB123CD)" value={nuovaTarga} onChange={(e) => setNuovaTarga(e.target.value)} className="w-full p-3 rounded-xl bg-gray-50 border-0 ring-1 ring-gray-200 focus:ring-2 focus:ring-emerald-500 font-bold uppercase text-gray-800 outline-none" />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Arrivo Stimato</label>
                      <input type="datetime-local" min={nowStr} value={bookingStart} onChange={(e) => setBookingStart(e.target.value)} className="w-full p-3 rounded-xl bg-gray-50 border-0 ring-1 ring-gray-200 focus:ring-2 focus:ring-emerald-500 font-bold text-sm text-gray-800 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Uscita Prevista</label>
                      <input type="datetime-local" min={bookingStart || nowStr} value={bookingEnd} onChange={(e) => setBookingEnd(e.target.value)} className="w-full p-3 rounded-xl bg-gray-50 border-0 ring-1 ring-gray-200 focus:ring-2 focus:ring-emerald-500 font-bold text-sm text-gray-800 outline-none" />
                    </div>
                  </div>

                  {/* RIQUADRO PREVENTIVO DINAMICO */}
                  {preventivo > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex justify-between items-center mt-2">
                      <div>
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Costo Stimato</p>
                        <p className="text-xs font-medium text-emerald-800 mt-1">Tariffa: {tariffaOraria.toFixed(2)}€ / h</p>
                      </div>
                      <p className="text-2xl font-black text-emerald-900">{preventivo} €</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-4">
                  <button onClick={handleConfirmBooking} className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-black text-lg hover:bg-emerald-700 transition-all">Paga e Conferma</button>
                  <button onClick={() => {setBookingSpot(null); setUiMessage({text:'', type:''})}} className="px-8 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all">Indietro</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}