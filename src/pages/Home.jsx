import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';
import ParkingMap from '../components/parkingmap';

export default function Home({ profile }) {
  const [parkings, setParkings] = useState([]);
  const [userVehicles, setUserVehicles] = useState([]);
  const [modalData, setModalData] = useState(null);
  const [bookingSpot, setBookingSpot] = useState(null);
  const [selectedTarga, setSelectedTarga] = useState('');

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

  const handleConfirmBooking = async () => {
    if (!selectedTarga) return alert("Seleziona un veicolo dal tuo profilo!");

    // Genera un codice casuale di 6 caratteri
    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { error: errPren } = await supabase.from('prenotazione').insert([{
      idpersona: profile.idpersona,
      targa: selectedTarga,
      idposto: bookingSpot.idposto,
      codice_accesso: accessCode,
      stato: 'Attiva'
    }]);

    if (errPren) {
      alert("Errore prenotazione: " + errPren.message);
      return;
    }

    await supabase.from('posto_auto').update({ stato: 'Occupato' }).eq('idposto', bookingSpot.idposto);
    
    alert(`Prenotazione confermata! Il tuo codice è: ${accessCode}`);
    setBookingSpot(null);
    setModalData(null);
    loadData();
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
            <p className="text-xs opacity-60 mt-2">Dettagli e posti disponibili</p>
          </div>
        ))}
      </div>

      {/* MODALE DI DETTAGLIO E PRENOTAZIONE */}
      {modalData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl max-w-2xl w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => {setModalData(null); setBookingSpot(null);}} className="absolute top-6 right-6 text-3xl font-bold text-gray-400 hover:text-red-500">&times;</button>
            
            <h2 className="text-3xl font-black text-emerald-900 mb-6">{modalData.nome}</h2>

            {/* SEZIONE: LISTA POSTI O FORM PRENOTAZIONE */}
            {!bookingSpot ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {modalData.postiList.map((posto, index) => (
                  <div key={posto.idposto} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <span className="font-bold block text-lg">Posto N° {index + 1}</span>
                      <span className="text-sm text-gray-500">{posto.tipoposto} • {posto.piano}</span>
                    </div>
                    {posto.stato?.toLowerCase() === 'libero' ? (
                      <button onClick={() => setBookingSpot(posto)} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-700 transition">Prenota</button>
                    ) : (
                      <span className="px-4 py-2 bg-red-100 text-red-600 rounded-xl font-bold uppercase text-xs">Occupato</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 animate-in slide-in-from-right">
                <h3 className="text-xl font-bold mb-4 text-emerald-800">Conferma la tua sosta</h3>
                <p className="mb-4 text-sm text-emerald-700 font-medium italic">Hai selezionato il posto ({bookingSpot.piano}). Per procedere, seleziona uno dei tuoi veicoli registrati:</p>
                
                {userVehicles.length > 0 ? (
                  <>
                    <select 
                      value={selectedTarga} 
                      onChange={(e) => setSelectedTarga(e.target.value)}
                      className="w-full p-4 rounded-xl border-2 border-emerald-200 bg-white mb-6 font-bold text-lg"
                    >
                      {userVehicles.map(v => <option key={v.targa} value={v.targa}>{v.targa}</option>)}
                    </select>
                    <div className="flex gap-3">
                      <button onClick={handleConfirmBooking} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-emerald-700">CONFERMA</button>
                      <button onClick={() => setBookingSpot(null)} className="px-6 bg-gray-200 text-gray-600 rounded-2xl font-bold">Annulla</button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <p className="text-red-600 font-bold mb-4 italic">Non hai ancora aggiunto veicoli al tuo profilo!</p>
                    <button onClick={() => setModalData(null)} className="bg-gray-800 text-white px-6 py-2 rounded-xl">Vai al Profilo</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}