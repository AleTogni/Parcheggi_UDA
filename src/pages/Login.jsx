import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [uiMessage, setUiMessage] = useState({ text: '', type: '' });
  const navigate = useNavigate();

  const showMessage = (text, type = 'error') => {
    setUiMessage({ text, type });
    setTimeout(() => setUiMessage({ text: '', type: '' }), 5000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) showMessage("Credenziali errate. Riprova.");
    else navigate("/");
  };

  // NUOVA FUNZIONE: Recupero Password integrato nella UI
  const handleResetPassword = async () => {
    if (!email) {
      return showMessage("Inserisci la tua email nel campo qui sopra e clicca di nuovo su recupera password.", "info");
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      showMessage("Errore: " + error.message);
    } else {
      showMessage("Link inviato! Controlla la tua casella email (anche lo spam).", "success");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
      <form onSubmit={handleLogin} className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 flex flex-col relative">
        <h2 className="text-3xl mb-6 font-black text-center text-emerald-800">Bentornato</h2>
        
        {/* AREA MESSAGGI DINAMICI */}
        {uiMessage.text && (
          <div className={`p-3 rounded-lg mb-6 text-sm font-bold text-center border ${
            uiMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 
            uiMessage.type === 'info' ? 'bg-blue-50 text-blue-800 border-blue-200' :
            'bg-red-50 text-red-800 border-red-200'
          }`}>
            {uiMessage.text}
          </div>
        )}

        <input 
          type="email" 
          placeholder="Email" 
          value={email}
          className="w-full p-3 mb-4 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
          onChange={e => setEmail(e.target.value)} 
          required 
        />
        
        <input 
          type="password" 
          placeholder="Password" 
          value={password}
          className="w-full p-3 mb-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
          onChange={e => setPassword(e.target.value)} 
        />
        
        {/* LINK RECUPERO PASSWORD (Ora usa formNoValidate per non scatenare l'errore del campo password vuoto) */}
        <div className="flex justify-end mb-8">
          <button 
            type="button" 
            onClick={handleResetPassword} 
            className="text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors"
          >
            Hai dimenticato la password?
          </button>
        </div>

        <p className="mb-4 text-xs text-gray-500 leading-relaxed">
          Questo è un progetto scolastico: non garantiamo la sicurezza completa dei dati. Pur essendo accessibile via HTTPS, l'app non è realizzata come servizio professionale e non dovrebbe gestire credenziali o informazioni sensibili.
          Ai sensi dell’art. 32 GDPR e dell’art. 2-ter del D.Lgs. 196/2003, la tutela dei dati personali si applica, ma qui il sistema è implementato esclusivamente per finalità didattiche.
        </p>

        <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-emerald-700 shadow-md transition">Accedi</button>
        
        <p className="mt-6 text-center text-sm text-gray-600">
          Nuovo utente? <Link to="/register" className="text-emerald-600 font-bold hover:underline">Registrati ora</Link>
        </p>
      </form>
    </div>
  );
}