import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [form, setForm] = useState({ nome: '', cognome: '', email: '', password: '', telefono: '' });
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    const { data, error: authError } = await supabase.auth.signUp({ email: form.email, password: form.password });
    
    if (authError) return alert("Errore Auth: " + authError.message);

    if (data.user) {
      const { error: dbError } = await supabase.from('persona').insert([{ 
        supabase_uuid: data.user.id, 
        email: form.email, 
        nome: form.nome,
        cognome: form.cognome,
        telefono: form.telefono || null, // Se vuoto, manda null invece di stringa vuota
        ruolo: 'utente'
      }]);

      if (dbError) {
        console.error(dbError);
        alert("Errore salvataggio profilo: " + dbError.message);
      } else {
        navigate("/");
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleRegister} className="bg-white p-10 rounded-3xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-emerald-800 text-center">Crea Account</h2>
        <input type="text" placeholder="Nome" className="w-full p-3 mb-4 border rounded-xl" onChange={e => setForm({...form, nome: e.target.value})} required />
        <input type="email" placeholder="Email" className="w-full p-3 mb-4 border rounded-xl" onChange={e => setForm({...form, email: e.target.value})} required />
        <input type="text" placeholder="Telefono (Opzionale)" className="w-full p-3 mb-4 border rounded-xl" onChange={e => setForm({...form, telefono: e.target.value})} />
        <input type="password" placeholder="Password (min 6 car.)" className="w-full p-3 mb-6 border rounded-xl" onChange={e => setForm({...form, password: e.target.value})} required />
        <button className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-md">Registrati</button>
      </form>
    </div>
  );
}