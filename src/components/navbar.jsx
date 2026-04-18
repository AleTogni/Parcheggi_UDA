import React from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';

export default function Navbar({ session, profile }) {
  const iniziale = profile?.nome ? profile.nome.charAt(0).toUpperCase() : 'U';
  const isAdmin = profile?.ruolo === 'admin';

  return (
    <nav className="bg-emerald-900 text-white p-3 shadow-md sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center px-2">
        <Link to="/" className="text-2xl font-black tracking-tight hover:text-emerald-300 transition-colors">
          🍃 BRESCIA PARK
        </Link>
        
        <div className="flex items-center gap-4">
          {session ? (
            <>
              {/* BOTTONE ADMIN (Visibile solo agli admin) */}
              {isAdmin && (
                <Link to="/admin" className="bg-yellow-500 text-yellow-950 font-black px-4 py-1.5 rounded-lg text-sm hover:bg-yellow-400 transition shadow-sm">
                  ⚡ AREA ADMIN
                </Link>
              )}

              <Link 
                to="/profile" 
                className="flex items-center gap-3 bg-emerald-800 hover:bg-emerald-700 p-1 pr-4 rounded-full transition-all border border-emerald-700/50 hover:border-emerald-500"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center font-black text-sm text-emerald-950 shadow-inner">
                  {iniziale}
                </div>
                <span className="font-bold text-sm text-emerald-50">{profile?.nome || 'Profilo'}</span>
              </Link>
              
              <button 
                onClick={() => supabase.auth.signOut()} 
                className="text-emerald-300 hover:text-white text-sm font-bold transition-colors px-2"
              >
                Esci
              </button>
            </>
          ) : (
            <Link to="/login" className="font-bold bg-white text-emerald-900 px-5 py-2 rounded-full hover:bg-emerald-100 transition">
              Accedi
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}