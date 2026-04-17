import React from 'react';

export default function AdminDashboard() {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-4xl font-black text-gray-800 mb-8">Pannello <span className="text-yellow-500">Amministratore</span></h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-t-4 border-t-emerald-500">
          <p className="text-gray-500 text-sm font-bold uppercase tracking-wider">Prenotazioni Attive</p>
          <p className="text-4xl font-black text-emerald-600 mt-2">142</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-t-4 border-t-blue-500">
          <p className="text-gray-500 text-sm font-bold uppercase tracking-wider">CO2 Risparmiata (Kg)</p>
          <p className="text-4xl font-black text-blue-600 mt-2">85.4</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-t-4 border-t-purple-500">
          <p className="text-gray-500 text-sm font-bold uppercase tracking-wider">Strutture Attive</p>
          <p className="text-4xl font-black text-purple-600 mt-2">8</p>
        </div>
      </div>
    </div>
  );
}