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
      const { error: dbError } = await supabase.from('persone').insert([{ 
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

  // Funzione per il Login/Registrazione con Google
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) showMessage("Errore Google Login: " + error.message);
  };

  const perks = [
    { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Prenotazione in pochi secondi' },
    { icon: 'M13 10V3L4 14h7v7l9-11h-7z', text: 'Posti EV e per disabili dedicati' },
    { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Accumula EcoPoints e riscatta premi' },
  ];

  return (
    <div className="flex items-center justify-center min-h-[calc(100svh-64px)] px-4 py-8">
      <div className="flex w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100">

        {/* Left panel — solo desktop */}
        <div className="hidden md:flex flex-col justify-between w-[380px] shrink-0 bg-gradient-to-br from-emerald-800 to-emerald-600 p-10 text-white">
          <div>
            <div className="flex items-center gap-2 mb-10">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <span className="font-black text-lg tracking-tight">Brescia Green Park</span>
            </div>

            <h2 className="text-3xl font-black leading-snug mb-3">Unisciti<br />alla community.</h2>
            <p className="text-emerald-100/80 text-sm leading-relaxed mb-10">Registrati gratis e inizia a parcheggiare in modo più smart e sostenibile.</p>

            <div className="space-y-4">
              {perks.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={p.icon} />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white/90">{p.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 p-4 rounded-2xl bg-white/10 border border-white/10">
            <p className="text-xs text-emerald-100/70 leading-relaxed">
              Hai già un account?{' '}
              <Link to="/login" className="text-white font-bold hover:underline">Accedi qui</Link>
            </p>
          </div>
        </div>

        {/* Right panel — form */}
        <form onSubmit={handleRegister} className="flex-1 bg-white p-8 sm:p-10 flex flex-col overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-gray-900">Crea Account</h2>
            <p className="text-sm text-gray-400 font-medium mt-1">Compila i dati per iniziare</p>
          </div>

          {uiMessage.text && (
            <div className={`p-3 rounded-xl mb-5 text-sm font-bold text-center border ${uiMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
              {uiMessage.text}
            </div>
          )}

          <div className="space-y-4 flex-grow">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Nome</label>
                <input type="text" placeholder="Mario" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm" onChange={e => setForm({...form, nome: e.target.value})} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Cognome</label>
                <input type="text" placeholder="Rossi" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm" onChange={e => setForm({...form, cognome: e.target.value})} required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Email</label>
              <input type="email" placeholder="nome@email.com" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm" onChange={e => setForm({...form, email: e.target.value})} required />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Telefono <span className="normal-case font-medium text-gray-400">(opzionale)</span></label>
              <input type="text" placeholder="+39 000 000 0000" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm" onChange={e => setForm({...form, telefono: e.target.value})} />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Password</label>
              <input type="password" placeholder="Minimo 6 caratteri" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm" onChange={e => setForm({...form, password: e.target.value})} required />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black text-sm hover:bg-emerald-700 shadow-md transition-all active:scale-[0.98]">
              Crea Account
            </button>

            <div className="relative my-1">
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

            <p className="text-center text-sm text-gray-500 md:hidden pt-1">
              Hai già un account? <Link to="/login" className="text-emerald-600 font-bold hover:underline">Accedi</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}