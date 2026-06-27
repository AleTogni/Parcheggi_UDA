import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [uiMessage, setUiMessage] = useState({ text: '', type: '' });
  const navigate = useNavigate();

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      return setUiMessage({ text: "La password deve essere di almeno 6 caratteri.", type: 'error' });
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setUiMessage({ text: "Errore: " + error.message, type: 'error' });
    } else {
      setUiMessage({ text: "Password aggiornata! Verrai reindirizzato...", type: 'success' });
      setTimeout(() => navigate('/'), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100svh-64px)] px-4">
      <form onSubmit={handleUpdate} className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl w-full max-w-sm border border-gray-100">

        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h2 className="text-2xl font-black text-gray-900 mb-1">Nuova Password</h2>
        <p className="text-sm text-gray-400 font-medium mb-7">Scegli una password sicura di almeno 6 caratteri.</p>

        {uiMessage.text && (
          <div className={`p-3 rounded-xl mb-6 text-sm font-bold text-center border ${uiMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
            {uiMessage.text}
          </div>
        )}

        <div className="mb-6">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Nuova Password</label>
          <input
            type="password"
            placeholder="Minimo 6 caratteri"
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black text-sm hover:bg-emerald-700 shadow-md transition-all active:scale-[0.98]">
          Salva Password
        </button>

        <p className="text-center text-sm text-gray-400 mt-5">
          <Link to="/login" className="font-bold text-emerald-600 hover:underline">← Torna al login</Link>
        </p>
      </form>
    </div>
  );
}