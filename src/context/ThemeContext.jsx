import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Inizializza il tema leggendo da localStorage o preferenza di sistema
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });
  const [saving, setSaving] = useState(false);

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
    // Simuliamo un piccolo delay se necessario, altrimenti cambia subito
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    setSaving(false);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, saving }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Questa è l'esportazione nominata che mancava
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve essere usato all\'interno di un ThemeProvider');
  }
  return context;
}