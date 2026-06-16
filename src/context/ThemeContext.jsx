import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';

const ThemeContext = createContext();

export function ThemeProvider({ children, profile }) {
  // 1. Inizializza leggendo dal database se disponibile, altrimenti fallback su localStorage
  const [theme, setTheme] = useState(() => {
    return profile?.tema || localStorage.getItem('theme') || 'light';
  });
  const [saving, setSaving] = useState(false);

  // Aggiorna quando il profilo cambia (es. dopo il caricamento iniziale)
  useEffect(() => {
    if (profile?.tema) {
      setTheme(profile.tema);
    }
  }, [profile?.tema]);

  // Applica il tema al DOM
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = async () => {
    setSaving(true);
    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    // Aggiorna stato locale
    setTheme(newTheme);

    // Aggiorna Database solo se l'utente è loggato
    if (profile?.idpersona) {
      const { error } = await supabase
        .from('persone')
        .update({ tema: newTheme })
        .eq('idpersona', profile.idpersona);
      
      if (error) console.error("Errore salvataggio tema nel DB:", error);
    }
    
    setSaving(false);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, saving }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme deve essere usato all\'interno di un ThemeProvider');
  return context;
}