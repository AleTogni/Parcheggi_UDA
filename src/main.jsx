import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// 🚑 TRAPPOLA DI DEBUG: Stampiamo i valori che vede Netlify!
console.log("--- TEST CHIAVI API ---");
console.log("1. URL Supabase:", import.meta.env.VITE_APP_SUPABASE_URL ? "Trovato" : "MANCANTE");
console.log("2. Anon Key:", import.meta.env.VITE_APP_SUPABASE_ANON_KEY ? "Trovata" : "MANCANTE");

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)