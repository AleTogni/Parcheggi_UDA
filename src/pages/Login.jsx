import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Credenziali errate: " + error.message);
    else navigate("/");
  };

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
      <form onSubmit={handleLogin} className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <h2 className="text-3xl mb-8 font-black text-center text-emerald-800">Bentornato</h2>
        
        <input type="email" placeholder="Email" className="w-full p-3 mb-4 bg-gray-50 border border-gray-200 rounded-lg outline-none" onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" className="w-full p-3 mb-8 bg-gray-50 border border-gray-200 rounded-lg outline-none" onChange={e => setPassword(e.target.value)} required />
        
        <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-emerald-700 shadow-md transition">Accedi</button>
        <p className="mt-6 text-center text-sm text-gray-600">Nuovo utente? <Link to="/register" className="text-emerald-600 font-bold hover:underline">Registrati ora</Link></p>
      </form>
    </div>
  );
}