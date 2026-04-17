import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';
import ParkingMap from '../components/parkingmap';

export default function Home({ profile }) {
  const [parkings, setParkings] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [modalData, setModalData] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: pData } = await supabase.from('parcheggio').select('*');
    const { data: postiData } = await supabase.from('posto_auto').select('*');
    if (!pData) return;

    const merged = pData.map(p => {
      const posti = (postiData || []).filter(item => item.idparcheggio === p.idparcheggio);
      const occupati = posti.filter(item => item.stato?.toLowerCase() === 'occupato').length;
      const ratio = occupati / (p.postitot || 1);

      let color = "border-emerald-500 bg-emerald-50"; 
      if (ratio >= 1) color = "border-red-500 bg-red-50"; 
      else if (ratio >= 0.5) color = "border-blue-500 bg-blue-50"; 

      return { ...p, occupati, color, postiList: posti };
    });
    setParkings(merged);
  };

  const handleMarkerClick = (id) => {
    setSelectedId(id);
    document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // LOGICA DI PRENOTAZIONE
  const handlePrenota = async (posto) => {
    const targa = window.prompt("Inserisci la TARGA del tuo veicolo registrato:");
    if (!targa) return;

    // 1. Inserisci la prenotazione
    const { error: errPren } = await supabase.from('prenotazione').insert([{
      idpersona: profile.idpersona,
      targa: targa.toUpperCase(),
      idposto: posto.idposto,
      orarioinizio: new Date().toISOString(),
      stato: 'Attiva'
    }]);

    if (errPren) {
      alert("Errore! Assicurati di aver registrato questa targa nel tuo Profilo prima di prenotare.");
      return;
    }

    // 2. Cambia stato del posto in Occupato
    await supabase.from('posto_auto').update({ stato: 'Occupato' }).eq('idposto', posto.idposto);
    
    alert("Prenotazione confermata!");
    setModalData(null); // Chiudi il modale
    loadData(); // Ricarica i dati
  };

  return (
    <div className="max-w-6xl mx-auto p-6 relative z-0">
      <h1 className="text-3xl font-black mb-8 text-gray-800">Brescia <span className="text-emerald-600">Green Park</span></h1>
      
      <ParkingMap parkings={parkings} onMarkerClick={handleMarkerClick} />

      <h2 className="text-xl font-bold mb-6">Parcheggi in tempo reale</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {parkings.map(p => (
          <div 
            key={p.idparcheggio} id={`card-${p.idparcheggio}`}
            onClick={() => setModalData(p)}
            className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${p.color} ${selectedId === p.idparcheggio ? 'ring-4 ring-emerald-300 scale-105' : ''}`}
          >
            <h3 className="font-bold text-lg">{p.nome}</h3>
            <p className="text-2xl font-black">{p.occupati} / {p.postitot}</p>
            <p className="text-sm opacity-70 mt-2">Clicca per dettagli e prenotazioni</p>
          </div>
        ))}
      </div>

      {/* FINESTRA MODALE */}
      {modalData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl max-w-2xl w-full shadow-2xl relative">
            <div className="flex justify-between mb-6">
              <h2 className="text-3xl font-black">{modalData.nome}</h2>
              <button onClick={() => setModalData(null)} className="text-3xl hover:text-red-500 font-bold">&times;</button>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {modalData.postiList.length === 0 && <p className="text-gray-500 italic">Nessun posto specifico inserito nel DB.</p>}
              {modalData.postiList.map(posto => {
                const isOccupato = posto.stato?.toLowerCase() === 'occupato';
                return (
                  <div key={posto.idposto} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <span className="font-bold block">Posto N° {posto.idposto} <span className="text-gray-500 font-normal">({posto.piano})</span></span>
                      <span className="text-sm">Tipo: <b>{posto.tipoposto}</b></span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${isOccupato ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {posto.stato}
                      </span>
                      {!isOccupato && (
                        <button onClick={() => handlePrenota(posto)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold">
                          Prenota
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}