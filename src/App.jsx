import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './api/supabaseClient';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import Rewards from './pages/Rewards';
import UpdatePassword from './pages/UpdatePassword';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  
  // --- STATO PER IL CARICAMENTO INIZIALE ---
  const [isLoading, setIsLoading] = useState(true);
  
  // --- NUOVO STATO GLOBALE PER LA NAVIGAZIONE GPS ---
  const [destinationParking, setDestinationParking] = useState(null);
  const [userLoc, setUserLoc] = useState(null);

  useEffect(() => {
    // Controllo iniziale della sessione
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // SBLOCCA L'APP IMMEDIATAMENTE (Non aspetta il profilo!)
      setIsLoading(false); 
      if (session) {
        fetchProfile(session.user.id);
      }
    });

    // Ascolto dei cambiamenti (es. ritorno dal login di Google)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setIsLoading(false); // Smetti di caricare se si fa il logout
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Sincronizzazione Realtime del Profilo
  useEffect(() => {
    if (!profile?.idpersona) return;

    const channel = supabase
      .channel(`profile-sync-${profile.idpersona}`)
      .on(
        'postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'persone', 
          filter: `idpersona=eq.${profile.idpersona}` 
        }, 
        (payload) => {
          setProfile(payload.new); // Aggiorna lo stato globale istantaneamente
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.idpersona]);

  async function fetchProfile(uuid, retries = 4) {
    const { data } = await supabase
      .from('persone')
      .select('*')
      .eq('supabase_uuid', uuid)
      .maybeSingle();

    if (data) {
      setProfile(data);
    } else if (retries > 0) {
      setTimeout(() => fetchProfile(uuid, retries - 1), 500);
    } else {
      setProfile(null);
    }
  }

  // --- BLOCCO DI SICUREZZA PER SESSIONE ---
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-emerald-900 text-white font-bold text-xl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-white rounded-full animate-spin"></div>
          Caricamento sessione...
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider profile={profile}>
    <BrowserRouter>
      <Navbar session={session} profile={profile} />
      <Routes>
        <Route path="/" element={
          session ? (
            <Home 
              profile={profile} 
              destinationParking={destinationParking} 
              setDestinationParking={setDestinationParking} 
              userLoc={userLoc}      
              setUserLoc={setUserLoc}
            />
          ) : <Navigate to="/login" />
        } />
        
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!session ? <Register /> : <Navigate to="/" />} />
        
        <Route path="/profile" element={
          session ? (
            <Profile 
              profile={profile} 
              setDestinationParking={setDestinationParking} 
            />
          ) : <Navigate to="/login" />
        } />
        
        <Route path="/update-password" element={<UpdatePassword />} />

        {/* ROTTA ADMIN: Ora aspetta in modo sicuro il profilo prima di giudicare i permessi */}
        <Route path="/admin" element={
          session ? (
            profile ? (
              profile.ruolo === 'admin' ? <AdminDashboard profile={profile} /> : <Navigate to="/" />
            ) : (
              <div className="flex h-screen items-center justify-center text-emerald-800 font-bold animate-pulse text-lg">
                Verifica permessi in corso...
              </div>
            )
          ) : <Navigate to="/login" />
        } />

        {/* ROTTA REWARDS: Libera, permettendo al componente di mostrare lo skeleton */}
        <Route path="/rewards" element={session ? <Rewards profile={profile} refreshProfile={() => fetchProfile(session.user.id)} /> : <Navigate to="/login" />} />
        
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  );
}