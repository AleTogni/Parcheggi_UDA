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
  
  // --- STATO PER IL CARICAMENTO INIZIALE (Risolve il bug di Google) ---
  const [isLoading, setIsLoading] = useState(true);
  
  // --- NUOVO STATO GLOBALE PER LA NAVIGAZIONE GPS ---
  const [destinationParking, setDestinationParking] = useState(null);
  const [userLoc, setUserLoc] = useState(null);

  useEffect(() => {
    // Controllo iniziale della sessione
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false); // Se non c'è sessione, smetti di caricare subito
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
          table: 'persona', 
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
      .from('persona')
      .select('*')
      .eq('supabase_uuid', uuid)
      .maybeSingle();

    if (data) {
      setProfile(data);
      setIsLoading(false); // Profilo caricato, possiamo mostrare l'app
    } else if (retries > 0) {
      setTimeout(() => fetchProfile(uuid, retries - 1), 500);
    } else {
      setProfile(null);
      setIsLoading(false); // Fallimento dopo i tentativi, sblocca l'app
    }
  }

  // --- BLOCCO DI SICUREZZA ---
  // Finché Supabase non ha finito di leggere i dati (es. da Google), mostriamo un caricamento
  // Questo impedisce al router di sbatterti fuori prematuramente verso il /login
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-emerald-900 text-white font-bold text-xl">
        <div className="flex flex-col items-center gap-4">
           {/* Piccola animazione di caricamento */}
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
        {/* Passiamo lo stato e la funzione alla Home */}
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
        
        {/* Passiamo solo la funzione di settaggio al Profile */}
        <Route path="/profile" element={
          session ? (
            <Profile 
              profile={profile} 
              setDestinationParking={setDestinationParking} 
            />
          ) : <Navigate to="/login" />
        } />
        
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/admin" element={profile?.ruolo === 'admin' ? <AdminDashboard profile={profile} /> : <Navigate to="/" />} />
        <Route path="/rewards" element={session ? (profile ? (<Rewards profile={profile} refreshProfile={() => fetchProfile(session.user.id)} /> ) : ( <div>Caricamento profilo...</div> )) : (<Navigate to="/login" />)} />
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  );
}