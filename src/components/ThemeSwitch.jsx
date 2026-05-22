import React from 'react';
import { useTheme } from '../context/ThemeContext';

function SunIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

export default function ThemeSwitch() {
  const { theme, toggleTheme, saving } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      disabled={saving}
      aria-label={isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
      className={`
        relative flex items-center shrink-0
        w-16 h-10 rounded-full
        border-2 transition-all duration-300 ease-in-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300
        ${isDark
          ? 'bg-emerald-950 border-emerald-700'
          : 'bg-emerald-800 border-emerald-700'
        }
        ${saving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'}
      `}
    >
      {/* Icona Sole (visibile meglio in light mode) */}
      <span className={`absolute left-2 flex items-center justify-center transition-opacity duration-300 ${isDark ? 'opacity-30' : 'opacity-100'}`}>
        <SunIcon className="w-4 h-4 text-emerald-100" />
      </span>
      
      {/* Icona Luna (visibile meglio in dark mode) */}
      <span className={`absolute right-2 flex items-center justify-center transition-opacity duration-300 ${isDark ? 'opacity-100' : 'opacity-30'}`}>
        <MoonIcon className="w-4 h-4 text-emerald-100" />
      </span>

      {/* Pallino (Toggle) */}
      <div
        className={`
          absolute w-7 h-7 rounded-full shadow-lg
          transition-all duration-300 ease-in-out
          ${isDark
            ? 'translate-x-7 bg-emerald-400'
            : 'translate-x-1 bg-white'
          }
        `}
      />
    </button>
  );
}