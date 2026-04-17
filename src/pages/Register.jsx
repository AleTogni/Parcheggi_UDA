import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const [form, setForm] = useState({ 
    nome: '', cognome: '', email: '', password: '', 
    telefono: '', citta: '', via: '', cap: '' 
  });
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password });
    if (error) return alert("Errore: " + error.message);

    if (data.user) {
      const { error: dbError } = await supabase.from('PERSONA').insert([{ 
        supabase_uuid: data.user.id, 
        email: form.email, 
        nome: form.nome,
        cognome: form.cognome,
        telefono: form.telefono,
        citta: form.citta,
        via: form.via,
        cap: form.cap,
        ruolo: 'utente'
      }]);
      if (dbError) alert("Errore DB: " + dbError.message);
      else { alert("Registrazione completata!"); navigate("/"); }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-100">
      <form onSubmit={handleRegister} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg">
        <h2 className="text-3xl font-black text-center text-emerald-800 mb-6">Registrazione</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <input type="text" placeholder="Nome" className="p-3 border rounded-lg" onChange={e => setForm({...form, nome: e.target.value})} required />
          <input type="text" placeholder="Cognome" className="p-3 border rounded-lg" onChange={e => setForm({...form, cognome: e.target.value})} required />
        </div>
        <input type="email" placeholder="Email" className="w-full p-3 mb-4 border rounded-lg" onChange={e => setForm({...form, email: e.target.value})} required />
        <input type="text" placeholder="Telefono" className="w-full p-3 mb-4 border rounded-lg" onChange={e => setForm({...form, telefono: e.target.value})} />
        <div className="grid grid-cols-2 gap-4 mb-4">
          <input type="text" placeholder="Città" className="p-3 border rounded-lg" onChange={e => setForm({...form, citta: e.target.value})} />
          <input type="text" placeholder="CAP" className="p-3 border rounded-lg" onChange={e => setForm({...form, cap: e.target.value})} />
        </div>
        <input type="password" placeholder="Password (min. 6 caratteri)" className="w-full p-3 mb-6 border rounded-lg" onChange={e => setForm({...form, password: e.target.value})} required />
        <button className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition">Crea Account</button>
        <p className="mt-4 text-center">Hai un account? <Link to="/login" className="text-emerald-600 font-bold">Accedi</Link></p>
      </form>
    </div>
  );
}