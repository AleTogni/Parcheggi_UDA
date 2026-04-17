import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './api/supabaseClient';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/profile';

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

  async function fetchProfile(uuid) {
    const { data } = await supabase.from('PERSONA').select('*').eq('supabase_uuid', uuid).single();
    setProfile(data);
  }

  return (
    <BrowserRouter>
      <Navbar session={session} profile={profile} />
      <Routes>
        <Route path="/" element={session ? <Home profile={profile} /> : <Navigate to="/login" />} />
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!session ? <Register /> : <Navigate to="/" />} />
        <Route path="/profile" element={session ? <Profile profile={profile} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}