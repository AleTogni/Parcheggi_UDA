import React from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';

export default function Navbar({ session, profile }) {
  return (
    <nav className="bg-emerald-800 text-white p-4 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-black tracking-tighter">🍃 BRESCIA PARK</Link>
        <div className="flex items-center gap-6">
          {session ? (
            <>
              <Link to="/profile" className="text-sm italic hover:text-emerald-300 transition">
                Ciao, {profile?.nome || 'Utente'}
              </Link>
              <button onClick={() => supabase.auth.signOut()} className="bg-red-500 px-4 py-1 rounded-full text-sm font-bold">Esci</button>
            </>
          ) : (
            <Link to="/login" className="font-medium">Accedi</Link>
          )}
        </div>
      </div>
    </nav>
  );
}