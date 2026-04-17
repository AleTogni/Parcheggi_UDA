import React, { useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';

export default function Profile({ profile }) {
  const [form, setForm] = useState({
    nome: '', cognome: '', telefono: '', citta: '', via: '', cap: ''
  });
  const [targa, setTarga] = useState('');
  const [veicoli, setVeicoli] = useState([]);

  useEffect(() => {
    if (profile) {
      setForm({
        nome: profile.nome || '', cognome: profile.cognome || '',
        telefono: profile.telefono || '', citta: profile.citta || '',
        via: profile.via || '', cap: profile.cap || ''
      });
      loadVeicoli();
    }
  }, [profile]);

  async function loadVeicoli() {
    const { data } = await supabase.from('VEICOLO').select('*').eq('idPersona', profile.idPersona);
    setVeicoli(data || []);
  }

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('PERSONA').update(form).eq('idPersona', profile.idPersona);
    if (error) alert(error.message); else alert("Profilo salvato!");
  };

  const addVeicolo = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('VEICOLO').insert([{ idPersona: profile.idPersona, targa: targa.toUpperCase() }]);
    if (error) alert(error.message); else { setTarga(''); loadVeicoli(); }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
      <div className="bg-white p-6 rounded-2xl shadow-md">
        <h2 className="text-xl font-bold mb-4 text-emerald-800">Dati Personali</h2>
        <form onSubmit={handleUpdate} className="space-y-4">
          <input type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full p-2 border rounded" placeholder="Nome" />
          <input type="text" value={form.cognome} onChange={e => setForm({...form, cognome: e.target.value})} className="w-full p-2 border rounded" placeholder="Cognome" />
          <input type="text" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} className="w-full p-2 border rounded" placeholder="Telefono" />
          <button className="w-full bg-emerald-600 text-white py-2 rounded font-bold">Aggiorna Profilo</button>
        </form>
      </div>
      <div className="bg-white p-6 rounded-2xl shadow-md">
        <h2 className="text-xl font-bold mb-4 text-emerald-800">I tuoi Veicoli</h2>
        <form onSubmit={addVeicolo} className="flex gap-2 mb-4">
          <input type="text" value={targa} onChange={e => setTarga(e.target.value)} className="flex-1 p-2 border rounded" placeholder="Targa" />
          <button className="bg-emerald-600 text-white px-4 rounded font-bold">+</button>
        </form>
        <div className="space-y-2">
          {veicoli.map(v => <div key={v.targa} className="p-2 bg-gray-50 border rounded font-mono">{v.targa}</div>)}
        </div>
      </div>
    </div>
  );
}