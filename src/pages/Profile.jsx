import React, { useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';

export default function Profile({ profile }) {
  // 1. REINSERITO IL COGNOME NELLO STATO
  const [form, setForm] = useState({ nome: '', cognome: '', is_disabile: false });
  const [targa, setTarga] = useState('');
  const [alimentazione, setAlimentazione] = useState('Termica');
  const [veicoli, setVeicoli] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [uiMessage, setUiMessage] = useState('');
  const [activeTab, setActiveTab] = useState('attive');

  useEffect(() => {
    if (profile) {
      setForm({
        nome: profile.nome || '',
        cognome: profile.cognome || '', // REINSERITO IL CARICAMENTO DEL COGNOME
        is_disabile: profile.is_disabile || false
      });
      loadVeicoli();
      loadPrenotazioni();
    }
  }, [profile]);

  async function loadVeicoli() {
    const { data } = await supabase.from('veicolo').select('*').eq('idpersona', profile.idpersona);
    setVeicoli(data || []);
  }

  async function loadPrenotazioni() {
    const { data } = await supabase.from('prenotazione').select('*').eq('idpersona', profile.idpersona).order('idprenotazione', { ascending: false });
    setPrenotazioni(data || []);
  }

  const showMessage = (msg) => {
    setUiMessage(msg);
    setTimeout(() => setUiMessage(''), 3000);
  };

  const formattaData = (dataIso) => {
    if (!dataIso) return '';
    const d = new Date(dataIso);
    return d.toLocaleString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('persona').update(form).eq('idpersona', profile.idpersona);
    if (error) showMessage("Errore salvataggio."); else showMessage("Profilo aggiornato.");
  };

  const addVeicolo = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('veicolo').insert([{ 
      idpersona: profile.idpersona, 
      targa: targa.toUpperCase(),
      alimentazione: alimentazione 
    }]);
    if (error) showMessage("Errore."); else { setTarga(''); loadVeicoli(); showMessage("Veicolo aggiunto."); }
  };

  const executeCancelBooking = async (pren) => {
    await supabase.from('prenotazione').update({ stato: 'Annullata' }).eq('idprenotazione', pren.idprenotazione);
    await supabase.from('posto_auto').update({ stato: 'Libero' }).eq('idposto', pren.idposto);
    loadPrenotazioni();
    showMessage("Sosta annullata.");
  };

  const prenoFiltrate = prenotazioni.filter(p => activeTab === 'attive' ? p.stato === 'Attiva' : p.stato !== 'Attiva');

  return (
    <div className="max-w-5xl mx-auto p-6 mt-10 relative z-0">
      <div className="flex justify-between items-center mb-8 h-10">
        <h1 className="text-3xl font-black text-emerald-900">Area Personale</h1>
        {uiMessage && <span className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md animate-pulse">{uiMessage}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* DATI PERSONALI */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-4">Dati Personali</h2>
          <form onSubmit={handleUpdate} className="space-y-4">
            
            {/* GRIGLIA NOME E COGNOME */}
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="Nome" />
              <input type="text" value={form.cognome} onChange={e => setForm({...form, cognome: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="Cognome" />
            </div>

            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 hover:bg-emerald-100/50 transition-colors cursor-pointer" onClick={() => setForm({...form, is_disabile: !form.is_disabile})}>
              <input 
                type="checkbox" 
                checked={form.is_disabile} 
                onChange={e => setForm({...form, is_disabile: e.target.checked})}
                className="w-5 h-5 accent-emerald-600 cursor-pointer pointer-events-none"
              />
              <label className="text-sm font-bold text-emerald-900 cursor-pointer pointer-events-none">Possiedo il Pass Disabili</label>
            </div>
            
            {/* HOVER AGGIUNTO */}
            <button className="w-full bg-emerald-700 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-sm transition-colors">Salva Modifiche</button>
          </form>
        </div>

        {/* VEICOLI */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-4">I tuoi Veicoli</h2>
          <form onSubmit={addVeicolo} className="space-y-3 mb-4">
            <div className="flex gap-2">
              <input type="text" value={targa} onChange={e => setTarga(e.target.value)} className="flex-1 p-3 border rounded-xl uppercase bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="Targa" required />
              <select value={alimentazione} onChange={e => setAlimentazione(e.target.value)} className="p-3 border rounded-xl bg-gray-50 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer">
                <option value="Termica">Termica</option>
                <option value="Elettrica">Elettrica</option>
              </select>
              {/* HOVER AGGIUNTO */}
              <button className="bg-emerald-700 hover:bg-emerald-600 text-white px-6 rounded-xl font-bold shadow-sm transition-colors">+</button>
            </div>
          </form>
          <div className="space-y-2">
            {veicoli.length === 0 && <p className="text-gray-400 text-sm">Nessun veicolo salvato.</p>}
            {veicoli.map(v => (
              <div key={v.targa} className="p-3 bg-gray-50 hover:bg-gray-100 border rounded-xl flex justify-between items-center font-bold transition-colors">
                <span>{v.targa}</span>
                <span className="text-xs bg-white px-2 py-1 rounded border border-gray-200">{v.alimentazione}</span>
              </div>
            ))}
          </div>
        </div>

        {/* STORICO PRENOTAZIONI */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-emerald-900">Prenotazioni</h2>
            
            {/* HOVER SUI TABS AGGIUNTO */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setActiveTab('attive')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'attive' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'}`}>In corso</button>
              <button onClick={() => setActiveTab('storico')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'storico' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'}`}>Storico</button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prenoFiltrate.length === 0 && <p className="text-gray-500 text-sm">Nessuna prenotazione trovata.</p>}
            {prenoFiltrate.map(p => (
              <div key={p.idprenotazione} className="p-4 border rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between mb-3 font-black">
                  <span>Posto #{p.idposto}</span>
                  <span className={`text-xs uppercase px-2 py-1 rounded ${p.stato === 'Attiva' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>{p.stato}</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Arrivo: <span className="text-gray-900 font-bold">{formattaData(p.orarioinizio)}</span></p>
                  <p>Uscita: <span className="text-gray-900 font-bold">{formattaData(p.orariofine)}</span></p>
                </div>
                
                {/* HOVER SUL TASTO ANNULLA AGGIUNTO */}
                {p.stato === 'Attiva' && (
                  <button onClick={() => executeCancelBooking(p)} className="w-full mt-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all">
                    Annulla Sosta
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}