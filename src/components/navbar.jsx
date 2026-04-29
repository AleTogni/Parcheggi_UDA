import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import ThemeSwitch from './ThemeSwitch';

export default function Navbar({ session, profile }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const iniziale = profile?.nome ? profile.nome.charAt(0).toUpperCase() : 'U';
  const isAdmin = profile?.ruolo === 'admin';
  const location = useLocation();

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="bg-emerald-900 text-white p-3 shadow-lg sticky top-0 z-[999] w-full">
      <div className="container mx-auto flex justify-between items-center px-2">
        <Link to="/" className="text-2xl font-black tracking-tight hover:text-emerald-300 transition-colors" onClick={closeMenu}>
          🍃 BRESCIA PARK
        </Link>

        {/* DESKTOP NAV */}
<div className="hidden sm:flex items-center gap-3">
  {session ? (
    <>
      <Link to="/rewards" className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-black">
        🍃 {profile?.punti_accumulati || 0}
      </Link>
      
      {isAdmin && (
        <Link to="/admin" className="flex items-center justify-center h-10 bg-emerald-800 hover:bg-emerald-700 text-emerald-50 font-bold px-4 rounded-full text-sm transition-all shadow-sm border border-emerald-700">
          Area Admin
        </Link>
      )}
      
      <Link
        to="/profile"
        className="flex items-center h-10 gap-2 bg-emerald-800 hover:bg-emerald-700 p-1 pr-4 rounded-full transition-all border border-emerald-700 shadow-sm"
      >
        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center font-black text-sm text-emerald-950 shadow-inner shrink-0">
          {iniziale}
        </div>
        <span className="font-bold text-sm text-emerald-50">{profile?.nome || 'Profilo'}</span>
      </Link>

        <ThemeSwitch />



      <button
        onClick={() => supabase.auth.signOut()}
        className="flex items-center justify-center h-10 bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-all px-4 rounded-full shadow-sm border border-red-600"
      >
        Esci
      </button>
    </>
  ) : (
    <>
      <Link to="/login" className="flex items-center justify-center h-10 font-bold bg-white text-emerald-900 px-5 rounded-full hover:bg-emerald-100 transition shadow-sm border border-transparent">
        Accedi
      </Link>
      
      {/* MODIFICA QUI: Stesso trattamento per l'utente non loggato */}
      <div className="flex items-center justify-center h-10 px-2 bg-emerald-800/50 rounded-full border border-emerald-700">
        <ThemeSwitch />
      </div>
    </>
  )}
</div>

        {/* MOBILE: avatar + hamburger */}
        <div className="flex sm:hidden items-center gap-2">
          {session && (
            <Link to="/rewards" className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-black">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 3s6 0 10 4c2 2 3 5 3 9-4 0-7-1-9-3C5 9 5 3 5 3z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 3c0 0-1 8 4 12"/></svg>
              {profile?.punti_accumulati || 0}
            </Link>
          )}
          <button
            onClick={() => setMenuOpen(prev => !prev)}
            className="w-10 h-10 flex flex-col items-center justify-center gap-1.5 bg-emerald-800 rounded-xl border border-emerald-700 focus:outline-none"
            aria-label="Menu"
          >
            <span className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* MOBILE DROPDOWN MENU */}
      <div className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="container mx-auto px-2 pt-3 pb-2 flex flex-col gap-2 border-t border-emerald-800 mt-3">
          {session ? (
            <>
              <Link
                to="/"
                onClick={closeMenu}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${location.pathname === '/' ? 'bg-emerald-700 text-white' : 'text-emerald-100 hover:bg-emerald-800'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                Home
              </Link>
              <Link
                to="/profile"
                onClick={closeMenu}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${location.pathname === '/profile' ? 'bg-emerald-700 text-white' : 'text-emerald-100 hover:bg-emerald-800'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Profilo
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={closeMenu}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${location.pathname === '/admin' ? 'bg-emerald-700 text-white' : 'text-emerald-100 hover:bg-emerald-800'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Area Admin
                </Link>
              )}
              <div className="h-px bg-emerald-800 my-1" />
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-sm font-bold text-emerald-100">Tema</span>
                <ThemeSwitch />
              </div>
              <button
                onClick={() => { supabase.auth.signOut(); closeMenu(); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-300 hover:bg-red-900/40 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Esci
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={closeMenu}
                className="flex items-center justify-center py-3 rounded-xl font-bold text-sm bg-white text-emerald-900 hover:bg-emerald-100 transition-all"
              >
                Accedi
              </Link>
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-sm font-bold text-emerald-100">Tema</span>
                <ThemeSwitch />
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}