import React from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';

export default function Navbar({ session, profile }) {
  const iniziale = profile?.nome ? profile.nome.charAt(0).toUpperCase() : 'U';
  const isAdmin = profile?.ruolo === 'admin';

  return (
    <nav className="bg-emerald-900 text-white p-3 shadow-lg sticky top-0 z-[999] w-full">
      <div className="container mx-auto flex justify-between items-center px-2">
        <Link to="/" className="text-2xl font-black tracking-tight hover:text-emerald-300 transition-colors">
          🍃 BRESCIA PARK
        </Link>
        
        <div className="flex items-center gap-3">
          {session ? (
            <>
              {/* BOTTONE ADMIN UNIFICATO */}
              {isAdmin && (
                <Link to="/admin" className="bg-emerald-800 hover:bg-emerald-700 text-emerald-50 font-bold px-4 py-2 rounded-full text-sm transition-all shadow-sm border border-emerald-700">
                  Area Admin
                </Link>
              )}

              {/* BOTTONE PROFILO */}
              <Link 
                to="/profile" 
                className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 p-1 pr-4 rounded-full transition-all border border-emerald-700 shadow-sm"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center font-black text-sm text-emerald-950 shadow-inner">
                  {iniziale}
                </div>
                <span className="font-bold text-sm text-emerald-50 hidden sm:inline">{profile?.nome || 'Profilo'}</span>
              </Link>
              
              {/* BOTTONE ESCI ROSSO */}
              <button 
                onClick={() => supabase.auth.signOut()} 
                className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-all px-4 py-2 rounded-full shadow-sm"
              >
                Esci
              </button>
            </>
          ) : (
            <Link to="/login" className="font-bold bg-white text-emerald-900 px-5 py-2 rounded-full hover:bg-emerald-100 transition shadow-sm">
              Accedi
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}