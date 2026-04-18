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
  
  // Gestione messaggi UI invece degli alert
  const [uiMessage, setUiMessage] = useState({ text: '', type: '' });

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

const handleConfirmBooking = async () => {
  if (!selectedTarga || !bookingStart || !bookingEnd) return showMessage("Dati incompleti.");

  // 1. RECUPERIAMO IL VEICOLO SELEZIONATO PER CONTROLLARE L'ALIMENTAZIONE
  const veicoloScelto = userVehicles.find(v => v.targa === selectedTarga);

  // 2. CONTROLLO LIMITAZIONI POSTO
  if (bookingSpot.tipoposto === 'Disabili' && !profile.is_disabile) {
    return showMessage("Questo posto è riservato a possessori di Pass Disabili.");
  }
  
  if (bookingSpot.tipoposto === 'Elettrico' && veicoloScelto?.alimentazione !== 'Elettrica') {
    return showMessage("Puoi prenotare questo posto solo con un veicolo Elettrico.");
  }

  const startDate = new Date(bookingStart);
  const endDate = new Date(bookingEnd);
  
  if (startDate < new Date()) return showMessage("L'orario è già passato.");
  if (endDate <= startDate) return showMessage("L'uscita deve essere dopo l'arrivo.");

  const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  // FIX TIMEZONE: Salviamo l'orario includendo il fuso orario locale
  const { error: errPren } = await supabase.from('prenotazione').insert([{
    idpersona: profile.idpersona,
    targa: selectedTarga,
    idposto: bookingSpot.idposto,
    codice_accesso: accessCode,
    orarioinizio: startDate.toLocaleString('sv-SE').replace(' ', 'T'), // Formato ISO locale
    orariofine: endDate.toLocaleString('sv-SE').replace(' ', 'T'),
    stato: 'Attiva'
  }]);

  if (errPren) return showMessage(errPren.message);

  await supabase.from('posto_auto').update({ stato: 'Occupato' }).eq('idposto', bookingSpot.idposto);
  
  showMessage(`Sosta confermata! Codice: ${accessCode}`, 'success');
  
  setTimeout(() => {
    setBookingStart(''); setBookingEnd(''); setBookingSpot(null); setModalData(null);
    loadData();
  }, 2000);
};

  return (
    <div className="max-w-6xl mx-auto p-6 relative z-0">
      <h1 className="text-3xl font-black mb-8 text-gray-800 italic">Brescia <span className="text-emerald-600">Green Park</span></h1>
      
      <ParkingMap parkings={parkings} onMarkerClick={(id) => setModalData(parkings.find(p => p.idparcheggio === id))} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {parkings.map(p => (
          <div key={p.idparcheggio} onClick={() => setModalData(p)} className={`p-6 rounded-2xl border-2 cursor-pointer transition-all hover:scale-105 shadow-sm ${p.color}`}>
            <h3 className="font-bold text-lg">{p.nome}</h3>
            <p className="text-3xl font-black">{p.occupati} / {p.postitot}</p>
            <p className="text-xs opacity-60 mt-2">Dettagli e prenotazioni</p>
          </div>
        ))}
      </div>

      {modalData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl max-w-2xl w-full shadow-2xl relative">
            <button onClick={() => {setModalData(null); setBookingSpot(null); setUiMessage({text:'', type:''})}} className="absolute top-6 right-6 text-3xl font-bold text-gray-400 hover:text-gray-800">&times;</button>
            
            <h2 className="text-3xl font-black text-emerald-900 mb-6">{modalData.nome}</h2>

            {!bookingSpot ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {modalData.postiList.map((posto, index) => (
                  <div key={posto.idposto} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <span className="font-bold block text-lg">Posto N° {index + 1}</span>
                      <span className="text-sm text-gray-500">{posto.tipoposto} • {posto.piano}</span>
                    </div>
                    {posto.stato?.toLowerCase() === 'libero' ? (
                      <button onClick={() => setBookingSpot(posto)} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-700 transition">Seleziona</button>
                    ) : (
                      <span className="px-4 py-2 bg-gray-200 text-gray-500 rounded-xl font-bold uppercase text-xs">Occupato</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200">
                <h3 className="text-xl font-bold mb-4 text-emerald-800">Dettagli Sosta</h3>
                
                {uiMessage.text && (
                  <div className={`p-3 rounded-lg mb-4 font-bold text-sm ${uiMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {uiMessage.text}
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-emerald-800 mb-1">Veicolo</label>
                    {userVehicles.length > 0 ? (
                      <select value={selectedTarga} onChange={(e) => setSelectedTarga(e.target.value)} className="w-full p-3 rounded-xl border border-emerald-200 bg-white font-bold">
                        {userVehicles.map(v => <option key={v.targa} value={v.targa}>{v.targa}</option>)}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        placeholder="Inserisci Targa (es. AB123CD)" 
                        value={nuovaTarga} 
                        onChange={(e) => setNuovaTarga(e.target.value)}
                        className="w-full p-3 rounded-xl border border-emerald-200 bg-white font-bold uppercase"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-emerald-800 mb-1">Arrivo</label>
                      <input type="datetime-local" min={nowStr} value={bookingStart} onChange={(e) => setBookingStart(e.target.value)} className="w-full p-3 rounded-xl border border-emerald-200 bg-white font-bold text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-emerald-800 mb-1">Uscita</label>
                      <input type="datetime-local" min={bookingStart || nowStr} value={bookingEnd} onChange={(e) => setBookingEnd(e.target.value)} className="w-full p-3 rounded-xl border border-emerald-200 bg-white font-bold text-sm text-gray-700" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={handleConfirmBooking} className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl font-black hover:bg-emerald-700">
                    Conferma
                  </button>
                  <button onClick={() => {setBookingSpot(null); setUiMessage({text:'', type:''})}} className="px-6 bg-transparent border border-emerald-600 text-emerald-700 rounded-2xl font-bold hover:bg-emerald-100">
                    Indietro
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}