import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [uiMessage, setUiMessage] = useState({ text: '', type: '' });
  const navigate = useNavigate();

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: password });
    
    if (error) {
      setUiMessage({ text: "Errore: " + error.message, type: 'error' });
    } else {
      setUiMessage({ text: "Password aggiornata! Verrai reindirizzato...", type: 'success' });
      setTimeout(() => navigate('/'), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
      <form onSubmit={handleUpdate} className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <h2 className="text-2xl mb-6 font-black text-center text-emerald-800">Nuova Password</h2>
        
        {uiMessage.text && (
           <div className={`p-3 rounded-lg mb-6 text-sm font-bold text-center border ${uiMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
             {uiMessage.text}
           </div>
        )}

        <input 
          type="password" 
          placeholder="Inserisci la nuova password" 
          className="w-full p-3 mb-6 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20" 
          onChange={e => setPassword(e.target.value)} 
          required 
        />
        
        <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition">Salva Password</button>
      </form>
    </div>
  );
}