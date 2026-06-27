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

  // Funzione per il Login con Google
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) showMessage("Errore Google Login: " + error.message);
  };

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

  const features = [
    { icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', label: 'Trova parcheggi liberi', desc: 'In tempo reale su mappa interattiva' },
    { icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z', label: 'Ticket digitale con QR', desc: 'Accesso rapido al parcheggio' },
    { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'EcoPoints & Premi', desc: 'Guadagna punti ad ogni sosta' },
  ];

  return (
    <div className="flex items-center justify-center min-h-[calc(100svh-64px)] px-4 py-8">
      <div className="flex w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100">

        {/* Left panel — solo desktop */}
        <div className="hidden md:flex flex-col justify-between w-[420px] shrink-0 bg-gradient-to-br from-emerald-800 to-emerald-600 p-10 text-white">
          <div>
            <div className="flex items-center gap-2 mb-10">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <span className="font-black text-lg tracking-tight">Brescia Green Park</span>
            </div>

            <h2 className="text-3xl font-black leading-snug mb-3">Il parcheggio<br />più smart della città.</h2>
            <p className="text-emerald-100/80 text-sm leading-relaxed mb-10">Prenota in anticipo, risparmia tempo e guadagna punti ad ogni sosta.</p>

            <div className="space-y-5">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4.5 h-4.5 text-emerald-200 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={f.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-sm">{f.label}</p>
                    <p className="text-emerald-200/70 text-xs mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-emerald-300/50 text-[10px] font-bold uppercase tracking-widest mt-10">Progetto scolastico • 2025</p>
        </div>

        {/* Right panel — form */}
        <form onSubmit={handleLogin} className="flex-1 bg-white p-8 sm:p-10 flex flex-col">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-gray-900">Bentornato</h2>
            <p className="text-sm text-gray-400 font-medium mt-1">Accedi al tuo account per continuare</p>
          </div>

          {uiMessage.text && (
            <div className={`p-3 rounded-xl mb-6 text-sm font-bold text-center border ${
              uiMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              uiMessage.type === 'info' ? 'bg-blue-50 text-blue-800 border-blue-200' :
              'bg-red-50 text-red-800 border-red-200'
            }`}>
              {uiMessage.text}
            </div>
          )}

          <div className="space-y-4 flex-grow">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Email</label>
              <input
                type="email"
                placeholder="nome@email.com"
                value={email}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Password</label>
                <button type="button" onClick={handleResetPassword} className="text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors">
                  Password dimenticata?
                </button>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Questo è un progetto scolastico: non garantiamo la sicurezza completa dei dati.
            </p>

            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black text-sm hover:bg-emerald-700 shadow-md transition-all active:scale-[0.98]">
              Accedi
            </button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400 font-bold">Oppure</span></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl hover:bg-gray-50 transition-all shadow-sm active:scale-[0.98]"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Continua con Google
            </button>

            <p className="text-center text-sm text-gray-500 pt-1">
              Nuovo utente?{' '}
              <Link to="/register" className="text-emerald-600 font-bold hover:underline">Registrati ora</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}