import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { LISTA_PREMI } from '../utils/gamification';

export default function Rewards({ profile, refreshProfile }) {
  const [selectedReward, setSelectedReward] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- AGGIUNGI QUESTO CONTROLLO ---
  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        <p className="ml-3 font-bold text-emerald-800">Caricamento profilo...</p>
      </div>
    );
  }
  // ---------------------------------

  const punti = profile.punti_accumulati || 0;

  const handleRiscatta = async (premio) => {
    setLoading(true);
    // 1. Scalo i punti
    const { error: updateError } = await supabase
      .from('persona')
      .update({ punti_accumulati: punti - premio.soglia })
      .eq('idpersona', profile.idpersona);

    if (!updateError) {
      // 2. Registro il premio
      await supabase.from('premi_riscattati').insert([
        { idpersona: profile.idpersona, premio_nome: premio.titolo, punti_spesi: premio.soglia }
      ]);
      alert("Premio riscattato con successo! Riceverai le istruzioni via mail.");
      refreshProfile();
      setSelectedReward(null);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <header className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 rounded-3xl text-white shadow-xl mb-10">
        <p className="uppercase tracking-widest text-xs font-bold opacity-80 mb-2">Il tuo bilancio sostenibile</p>
        <h1 className="text-4xl font-black mb-4">{punti} <span className="text-2xl font-normal">EcoPoints</span></h1>
        <div className="w-full bg-white/20 h-3 rounded-full overflow-hidden">
          <div className="bg-white h-full transition-all duration-1000" style={{ width: `${Math.min((punti/2000)*100, 100)}%` }}></div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {LISTA_PREMI.map((premio) => (
          <div 
            key={premio.id}
            onClick={() => setSelectedReward(premio)}
            className="bg-white p-6 rounded-2xl border-2 border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-tighter">
                {premio.categoria}
              </span>
              <span className="font-black text-emerald-800">{premio.soglia} pt</span>
            </div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-emerald-600 transition-colors">{premio.titolo}</h3>
            <p className="text-gray-500 text-sm line-clamp-2">{premio.desc}</p>
          </div>
        ))}
      </div>

      {/* MODAL POPUP */}
      {selectedReward && (
        <div className="fixed inset-0 bg-emerald-950/40 backdrop-blur-sm flex items-center justify-center z-[1001] p-4">
          <div className="bg-white p-8 rounded-3xl max-w-md w-full shadow-2xl animate-scale-up">
            <h2 className="text-2xl font-black text-emerald-900 mb-2">{selectedReward.titolo}</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">{selectedReward.desc}</p>
            
            <button 
              disabled={punti < selectedReward.soglia || loading}
              onClick={() => handleRiscatta(selectedReward)}
              className={`w-full py-4 rounded-2xl font-black text-lg transition-all mb-3 ${
                punti >= selectedReward.soglia 
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {punti >= selectedReward.soglia ? 'RISCATTA ORA' : `TI MANCANO ${selectedReward.soglia - punti} PT`}
            </button>
            <button onClick={() => setSelectedReward(null)} className="w-full text-gray-400 font-bold py-2 hover:text-gray-600 transition-colors text-sm">CHIUDI</button>
          </div>
        </div>
      )}
    </div>
  );
}