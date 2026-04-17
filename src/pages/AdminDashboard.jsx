import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';

export default function AdminDashboard({ profile }) {
  const [stats, setStats] = useState({ parcheggi: 0, postiTotali: 0, postiOccupati: 0, utenti: 0 });

  useEffect(() => {
    async function loadStats() {
      const { count: parcheggi } = await supabase.from('parcheggio').select('*', { count: 'exact', head: true });
      const { data: posti } = await supabase.from('posto_auto').select('stato');
      const { count: utenti } = await supabase.from('persona').select('*', { count: 'exact', head: true });

      setStats({
        parcheggi: parcheggi || 0,
        postiTotali: posti?.length || 0,
        postiOccupati: posti?.filter(p => p.stato?.toLowerCase() === 'occupato').length || 0,
        utenti: utenti || 0
      });
    }
    loadStats();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 mt-10">
      <h1 className="text-4xl font-black text-gray-800 mb-2">Pannello <span className="text-yellow-500">Amministratore</span></h1>
      <p className="text-gray-500 mb-8">Accesso riservato: bentornato, {profile?.nome}.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-t-4 border-t-emerald-500">
          <p className="text-gray-500 text-sm font-bold uppercase">Parcheggi Attivi</p>
          <p className="text-4xl font-black text-emerald-600 mt-2">{stats.parcheggi}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-t-4 border-t-blue-500">
          <p className="text-gray-500 text-sm font-bold uppercase">Posti Totali</p>
          <p className="text-4xl font-black text-blue-600 mt-2">{stats.postiTotali}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-t-4 border-t-red-500">
          <p className="text-gray-500 text-sm font-bold uppercase">Posti Occupati</p>
          <p className="text-4xl font-black text-red-600 mt-2">{stats.postiOccupati}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-t-4 border-t-purple-500">
          <p className="text-gray-500 text-sm font-bold uppercase">Utenti Iscritti</p>
          <p className="text-4xl font-black text-purple-600 mt-2">{stats.utenti}</p>
        </div>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-2xl text-yellow-800">
        <h3 className="font-bold text-lg mb-2">Modalità Sviluppo</h3>
        <p>Da qui in futuro potrai aggiungere nuovi parcheggi, bannare utenti e modificare le tariffe. La Dashboard vede tutti i dati senza limiti.</p>
      </div>
    </div>
  );
}