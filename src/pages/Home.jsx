import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';
import ParkingMap from '../components/ParkingMap';

export default function Home({ profile }) {
  const [parkings, setParkings] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data } = await supabase.from('PARCHEGGIO').select('*');
    setParkings(data || []);
  };

  const handleBook = async (idParcheggio, nome) => {
    const targa = window.prompt("Inserisci la targa per prenotare al " + nome);
    if (!targa) return;

    // 1. Cerca posto libero
    const { data: posti } = await supabase.from('POSTO_AUTO').select('*').eq('idParcheggio', idParcheggio).eq('stato', 'Libero').limit(1);

    if (!posti || posti.length === 0) return alert("Parcheggio pieno!");

    const codice = "GRN-" + Math.random().toString(36).substring(7).toUpperCase();

    // 2. Salva prenotazione
    const { error } = await supabase.from('PRENOTAZIONE').insert([{
      idPersona: profile.idPersona,
      targa: targa.toUpperCase(),
      idPosto: posti[0].idPosto,
      codiceAccesso: codice,
      stato: 'Attiva'
    }]);

    if (error) alert("Errore: " + error.message);
    else {
      await supabase.from('POSTO_AUTO').update({ stato: 'Occupato' }).eq('idPosto', posti[0].idPosto);
      alert("Prenotato! Codice: " + codice);
      loadData();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-4xl font-black text-gray-800 mb-2">Brescia <span className="text-emerald-600">Green Park</span></h1>
      <p className="text-gray-500 mb-8">Gestione intelligente e sostenibile della sosta.</p>
      
      <ParkingMap />

      <h2 className="text-2xl font-bold mt-10 mb-6">Parcheggi in tempo reale</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {parkings.map(p => (
          <div key={p.idParcheggio} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-emerald-900">{p.nome}</h3>
              <p className="text-sm text-gray-500">{p.postiTot} posti totali</p>
            </div>
            <button onClick={() => handleBook(p.idParcheggio, p.nome)} className="mt-6 bg-emerald-50 text-emerald-700 font-bold py-2 rounded-lg hover:bg-emerald-600 hover:text-white transition">
              Prenota Ora
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}