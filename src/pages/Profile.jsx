import React, { useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';

export default function Profile({ profile }) {
  const [form, setForm] = useState({ nome: '', cognome: '', telefono: '', citta: '', via: '', cap: '' });
  const [targa, setTarga] = useState('');
  const [veicoli, setVeicoli] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]); // Nuovo stato

  useEffect(() => {
    if (profile) {
      setForm({
        nome: profile.nome || '', cognome: profile.cognome || '',
        telefono: profile.telefono || '', citta: profile.citta || '',
        via: profile.via || '', cap: profile.cap || ''
      });
      loadVeicoli();
      loadPrenotazioni(); // Carichiamo le prenotazioni all'avvio
    }
  }, [profile]);

  async function loadVeicoli() {
    const { data } = await supabase.from('veicolo').select('*').eq('idpersona', profile.idpersona);
    setVeicoli(data || []);
  }

  async function loadPrenotazioni() {
    const { data } = await supabase.from('prenotazione').select('*').eq('idpersona', profile.idpersona);
    setPrenotazioni(data || []);
  }

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('persona').update(form).eq('idpersona', profile.idpersona);
    if (error) alert(error.message); else alert("Profilo salvato!");
  };

  const addVeicolo = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('veicolo').insert([{ idpersona: profile.idpersona, targa: targa.toUpperCase() }]);
    if (error) alert(error.message); else { setTarga(''); loadVeicoli(); }
  };

  if (!profile) return <div className="p-10 text-center">Caricamento profilo...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 mt-10">
      <h1 className="text-3xl font-black mb-8 text-emerald-800">Il Tuo Pannello</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* DATI PERSONALI */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-4">Dati Personali</h2>
          <form onSubmit={handleUpdate} className="space-y-4">
            <input type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50" placeholder="Nome" />
            <input type="text" value={form.cognome} onChange={e => setForm({...form, cognome: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50" placeholder="Cognome" />
            <button className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">Aggiorna Profilo</button>
          </form>
        </div>
        
        {/* VEICOLI */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-4">I tuoi Veicoli (Obbligatori per prenotare)</h2>
          <form onSubmit={addVeicolo} className="flex gap-2 mb-4">
            <input type="text" value={targa} onChange={e => setTarga(e.target.value)} className="flex-1 p-3 border rounded-xl uppercase bg-gray-50" placeholder="Es. AB123CD" required />
            <button className="bg-emerald-600 text-white px-6 rounded-xl font-bold">+</button>
          </form>
          <div className="space-y-2">
            {veicoli.map(v => (
              <div key={v.targa} className="p-3 bg-gray-50 border rounded-xl font-mono text-lg font-bold flex justify-between items-center">
                {v.targa} <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full uppercase">Attivo</span>
              </div>
            ))}
          </div>
        </div>

        {/* PRENOTAZIONI ATTIVE */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-emerald-200">
          <h2 className="text-xl font-bold mb-4 text-emerald-800">Le Tue Prenotazioni</h2>
          {prenotazioni.length === 0 ? (
             <p className="text-gray-500">Non hai prenotazioni attive.</p>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {prenotazioni.map(pren => (
                 <div key={pren.idprenotazione} className="p-4 border border-gray-200 rounded-xl bg-gray-50 flex flex-col gap-2">
                   <div className="flex justify-between items-center">
                     <span className="font-black text-lg">Posto #{pren.idposto}</span>
                     <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold uppercase">{pren.stato}</span>
                   </div>
                   <p className="font-mono text-gray-600 text-sm">Targa: {pren.targa}</p>
                   <p className="text-xs text-gray-400">Data: {new Date(pren.orarioinizio).toLocaleString('it-IT')}</p>
                 </div>
               ))}
             </div>
          )}
        </div>

      </div>
    </div>
  );
}