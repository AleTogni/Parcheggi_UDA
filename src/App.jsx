import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './api/supabaseClient';
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setProfile(null);
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
      // Se trova i dati, li imposta
      setProfile(data);
    } else if (retries > 0) {
      // Se NON trova i dati (es. appena registrato), aspetta 500ms e riprova!
      setTimeout(() => fetchProfile(uuid, retries - 1), 500);
    } else {
      // Se dopo 4 tentativi (2 secondi) non c'è ancora nulla, si arrende
      setProfile(null);
    }
  }

  return (
    <BrowserRouter>
      <Navbar session={session} profile={profile} />
      <Routes>
        <Route path="/" element={session ? <Home profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!session ? <Register /> : <Navigate to="/" />} />
        <Route path="/profile" element={session ? <Profile profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/admin" element={profile?.ruolo === 'admin' ? <AdminDashboard profile={profile} /> : <Navigate to="/" />} />
        <Route path="/rewards" element={session ? (profile ? (<Rewards profile={profile} refreshProfile={() => fetchProfile(session.user.id)} /> ) : ( <div>Caricamento...</div> )) : (<Navigate to="/login" />)} />
      </Routes>
    </BrowserRouter>
  );
}