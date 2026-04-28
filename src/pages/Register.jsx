import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const [form, setForm] = useState({ nome: '', cognome: '', email: '', password: '', telefono: '' });
  const [uiMessage, setUiMessage] = useState({ text: '', type: '' });
  const navigate = useNavigate();

  const showMessage = (text, type = 'error') => {
    setUiMessage({ text, type });
    setTimeout(() => setUiMessage({ text: '', type: '' }), 5000);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const { data, error: authError } = await supabase.auth.signUp({ email: form.email, password: form.password });
    
    if (authError) return showMessage("Errore: " + authError.message);

    if (data.user) {
      const { error: dbError } = await supabase.from('persona').insert([{ 
        supabase_uuid: data.user.id, 
        email: form.email, 
        nome: form.nome,
        cognome: form.cognome,
        telefono: form.telefono || null,
        ruolo: 'utente'
      }]);

      if (dbError) {
        showMessage("Errore salvataggio profilo: " + dbError.message);
      } else {
        navigate("/");
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100svh-64px)] px-4">
      <form onSubmit={handleRegister} className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md border border-gray-100 flex flex-col relative">
        <h2 className="text-3xl mb-6 font-black text-center text-emerald-800">Crea Account</h2>
        
        {uiMessage.text && (
          <div className={`p-3 rounded-lg mb-6 text-sm font-bold text-center border ${uiMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
            {uiMessage.text}
          </div>
        )}

        <input type="text" placeholder="Nome" className="w-full p-3 mb-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20" onChange={e => setForm({...form, nome: e.target.value})} required />
        <input type="text" placeholder="Cognome" className="w-full p-3 mb-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20" onChange={e => setForm({...form, cognome: e.target.value})} required />
        <input type="email" placeholder="Email" className="w-full p-3 mb-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20" onChange={e => setForm({...form, email: e.target.value})} required />
        <input type="text" placeholder="Telefono (Opzionale)" className="w-full p-3 mb-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20" onChange={e => setForm({...form, telefono: e.target.value})} />
        <input type="password" placeholder="Password (min 6 car.)" className="w-full p-3 mb-8 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20" onChange={e => setForm({...form, password: e.target.value})} required />
        
        <button className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-emerald-700 shadow-md transition-all">Registrati</button>
        <p className="mt-6 text-center text-sm text-gray-600">Hai già un account? <Link to="/login" className="text-emerald-600 font-bold hover:underline">Accedi</Link></p>
      </form>
    </div>
  );
}