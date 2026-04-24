import React, { useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';
import { QRCodeSVG } from 'qrcode.react';

export default function Profile({ profile, refreshProfile }) {
  const [form, setForm] = useState({ 
    nome: '', 
    cognome: '', 
    is_disabile: false,
    telefono: '',
    citta: '',
    via: '',
    cap: ''
  });
  const [targa, setTarga] = useState('');
  const [alimentazione, setAlimentazione] = useState('Termica');
  const [editingTarga, setEditingTarga] = useState(null); 
  const [veicoli, setVeicoli] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [uiMessage, setUiMessage] = useState('');
  const [activeTab, setActiveTab] = useState('attive');

  const tariffaOraria = 2.00;

  useEffect(() => {
    if (profile) {
      setForm({
        nome: profile.nome || '',
        cognome: profile.cognome || '',
        is_disabile: profile.is_disabile || false,
        telefono: profile.telefono || '',
        citta: profile.citta || '',
        via: profile.via || '',
        cap: profile.cap || ''
      });
      loadVeicoli();
      loadPrenotazioni();

      // Sincronizzazione Realtime combinata (Veicoli + Storico)
      const profileChannel = supabase.channel(`profile-db-sync-${profile.idpersona}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'veicolo', filter: `idpersona=eq.${profile.idpersona}` }, () => {
          loadVeicoli(); 
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'prenotazione', filter: `idpersona=eq.${profile.idpersona}` }, () => {
          loadPrenotazioni(); 
        })
        .subscribe();

      return () => { supabase.removeChannel(profileChannel); };
    }
  }, [profile]);

  async function loadVeicoli() {
    const { data } = await supabase
      .from('veicolo')
      .select('*')
      .eq('idpersona', profile.idpersona);
    setVeicoli(data || []);
  }

  async function loadPrenotazioni() {
    const { data } = await supabase
      .from('prenotazione')
      .select('*, posto_auto(piano, parcheggio(nome))')
      .eq('idpersona', profile.idpersona)
      .order('orarioinizio', { ascending: false });
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
    if (error) showMessage("Errore salvataggio."); 
    else { 
      showMessage("Profilo aggiornato."); 
      if (refreshProfile) refreshProfile(); 
    }
  };

  const handleVeicoloAction = async (e) => {
    e.preventDefault();
    const targaPulita = targa.toUpperCase().trim();

    if (editingTarga) {
      const { error } = await supabase
        .from('veicolo')
        .update({ targa: targaPulita, alimentazione })
        .eq('targa', editingTarga);
        
      if (error) {
        showMessage("Errore: La targa potrebbe già esistere.");
      } else {
        showMessage("Veicolo e storico aggiornati!");
        setEditingTarga(null);
        setTarga('');
        await loadVeicoli();
        await loadPrenotazioni();
      }
    } else {
      const { error } = await supabase.from('veicolo').insert([{ 
        idpersona: profile.idpersona, 
        targa: targaPulita,
        alimentazione: alimentazione 
      }]);
      if (error) return showMessage("Veicolo già registrato.");
      showMessage("Veicolo aggiunto!");
      setTarga(''); 
      await loadVeicoli();
    }
  };

  const deleteVeicolo = async (targaToDelete) => {
    setVeicoli(prev => prev.filter(v => v.targa !== targaToDelete));
    
    const { error } = await supabase.from('veicolo').delete().eq('targa', targaToDelete);
    if (error) {
      await loadVeicoli();
      showMessage("Impossibile eliminare: targa presente nello storico.");
    } else {
      showMessage("Veicolo rimosso.");
      await loadPrenotazioni();
    }
  };

  const startEditVeicolo = (v) => { 
    setEditingTarga(v.targa); 
    setTarga(v.targa); 
    setAlimentazione(v.alimentazione); 
  };

  const executeCancelBooking = async (pren) => {
    await supabase.from('prenotazione').update({ stato: 'Annullata' }).eq('idprenotazione', pren.idprenotazione);
    await supabase.from('posto_auto').update({ stato: 'Libero' }).eq('idposto', pren.idposto);
    loadPrenotazioni();
    showMessage("Sosta annullata.");
  };

  const handleProlungaSosta = async (pren) => {
    const endDate = new Date(pren.orariofine);
    endDate.setHours(endDate.getHours() + 1);

    const yyyy = endDate.getFullYear();
    const mm = String(endDate.getMonth() + 1).padStart(2, '0');
    const dd = String(endDate.getDate()).padStart(2, '0');
    const hh = String(endDate.getHours()).padStart(2, '0');
    const min = String(endDate.getMinutes()).padStart(2, '0');
    
    const nuovaUscita = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    const nuovoCosto = (parseFloat(pren.costo || 0) + tariffaOraria).toFixed(2);

    const { error } = await supabase.from('prenotazione')
      .update({ 
        orariofine: nuovaUscita, 
        costo: nuovoCosto 
      })
      .eq('idprenotazione', pren.idprenotazione);

    if (error) {
      showMessage("Errore durante il prolungamento.");
    } else {
      showMessage("Sosta estesa di +1h!");
      loadPrenotazioni();
    }
  };

  const handleDeleteAccount = async () => {
    const { error } = await supabase.rpc('elimina_dati_utente', { p_id: profile.idpersona });
    
    if (error) {
      showMessage("Impossibile eliminare l'account al momento. Riprova più tardi.");
      console.error("Dettaglio errore:", error);
      return; 
    }

    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const prenoFiltrate = prenotazioni.filter(p => activeTab === 'attive' ? p.stato === 'Attiva' : p.stato !== 'Attiva');

  return (
    <div className="max-w-7xl mx-auto p-6 mt-10 relative z-0">
      <div className="flex justify-between items-center mb-8 h-10 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-black text-emerald-900">Area Personale</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Gestisci i tuoi dati e le tue soste</p>
        </div>
        {uiMessage && <span className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md animate-fade-in-up">{uiMessage}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SEZIONE DATI PERSONALI */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h2 className="text-xl font-bold mb-6 text-gray-800">Dati Personali</h2>
          <form onSubmit={handleUpdate} className="space-y-4 flex-grow flex flex-col">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nome</label>
                <input type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="Nome" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cognome</label>
                <input type="text" value={form.cognome} onChange={e => setForm({...form, cognome: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="Cognome" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Telefono</label>
                <input type="text" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="Cellulare" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Città</label>
                <input type="text" value={form.citta} onChange={e => setForm({...form, citta: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="Città" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Via</label>
                <input type="text" value={form.via} onChange={e => setForm({...form, via: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="Indirizzo" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cap</label>
                <input type="text" value={form.cap} onChange={e => setForm({...form, cap: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="Cap" />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 hover:bg-emerald-100/50 transition-colors cursor-pointer" onClick={() => setForm({...form, is_disabile: !form.is_disabile})}>
              <input type="checkbox" checked={form.is_disabile} onChange={e => setForm({...form, is_disabile: e.target.checked})} className="w-5 h-5 accent-emerald-600 cursor-pointer pointer-events-none" />
              <label className="text-sm font-bold text-emerald-900 cursor-pointer pointer-events-none">Possiedo il Pass Disabili</label>
            </div>
            
            <button className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-bold shadow-sm transition-colors mt-auto">Salva Modifiche</button>
          </form>
        </div>

        {/* SEZIONE VEICOLI */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h2 className="text-xl font-bold mb-6 text-gray-800">
            {editingTarga ? 'Modifica Veicolo' : 'I tuoi Veicoli'}
          </h2>
          <form onSubmit={handleVeicoloAction} className="space-y-3 mb-6">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Targa</label>
                <input type="text" value={targa} onChange={e => setTarga(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl uppercase bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-bold" placeholder="Es. AB123CD" required />
              </div>
              <div className="w-32">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Motore</label>
                <select value={alimentazione} onChange={e => setAlimentazione(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer">
                  <option value="Termica">Termica</option>
                  <option value="Elettrica">Elettrica</option>
                </select>
              </div>
              <div className="flex items-end gap-1">
                <button type="submit" className="bg-emerald-700 hover:bg-emerald-800 text-white h-[46px] px-6 rounded-xl font-black shadow-sm transition-colors">
                  {editingTarga ? 'Salva' : '+'}
                </button>
                {editingTarga && (
                  <button type="button" onClick={() => {setEditingTarga(null); setTarga('');}} className="bg-gray-100 hover:bg-gray-200 text-gray-500 h-[46px] px-3 rounded-xl font-bold transition-colors">
                    ×
                  </button>
                )}
              </div>
            </div>
          </form>
          
          <div className="space-y-2 overflow-y-auto max-h-[250px] custom-scrollbar pr-1">
            {veicoli.length === 0 && <p className="text-gray-400 text-sm font-medium text-center py-4">Nessun veicolo salvato.</p>}
            {veicoli.map(v => (
              <div key={v.targa} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex justify-between items-center font-bold transition-colors">
                
                <div className="flex items-center gap-3">
                  <span className="font-mono text-gray-800 tracking-wider">{v.targa}</span>
                  <span className={`text-[10px] px-2 py-1 rounded uppercase border ${
                    v.alimentazione === 'Elettrica' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'
                  }`}>
                    {v.alimentazione}
                  </span>
                </div>

                <div className="flex gap-1">
                  <button onClick={() => startEditVeicolo(v)} className="p-2 text-gray-400 hover:text-emerald-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button onClick={() => deleteVeicolo(v.targa)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 3h-6" />
                    </svg>
                  </button>
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* STORICO PRENOTAZIONI CON QR CODE */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Le tue Soste</h2>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setActiveTab('attive')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'attive' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>In corso</button>
              <button onClick={() => setActiveTab('storico')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'storico' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>Storico</button>
            </div>
          </div>
          
          <div className="h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {prenoFiltrate.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Nessuna prenotazione trovata</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                {prenoFiltrate.map(p => (
                  <div key={p.idprenotazione} className="p-5 border border-gray-100 rounded-xl bg-gray-50 hover:bg-white hover:border-gray-200 transition-all flex flex-col h-full">
                    
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="font-black text-gray-800 text-lg block">
                          {p.posto_auto?.parcheggio?.nome || 'Parcheggio'}
                        </span>
                        <span className="font-mono text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded mt-1 inline-block">
                          {p.targa} • {p.posto_auto?.piano}
                        </span>
                      </div>
                      <span className={`text-[10px] uppercase px-2 py-1 rounded font-bold border ${
                        p.stato === 'Attiva' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                        p.stato === 'Conclusa' ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                        'bg-gray-200 text-gray-500 border-gray-300'
                      }`}>
                        {p.stato}
                      </span>
                    </div>

                    <div className="flex justify-between items-center flex-grow mb-2">
                      {/* SINISTRA: Date e Costo */}
                      <div className="text-xs text-gray-600 space-y-1.5 w-full pr-4">
                        <div className="flex justify-between"><span>Arrivo:</span><span className="text-gray-900 font-bold">{formattaData(p.orarioinizio)}</span></div>
                        <div className="flex justify-between"><span>Uscita:</span><span className="text-gray-900 font-bold">{formattaData(p.orariofine)}</span></div>
                        <div className="flex justify-between pt-2 border-t border-gray-100 mt-2"><span>Costo:</span><span className="text-emerald-700 font-black">{p.costo ? `${p.costo} €` : '0.00 €'}</span></div>
                      </div>

                      {/* DESTRA: Il nostro nuovo QR Code! */}
                      {p.stato === 'Attiva' && p.codiceaccesso && (
                        <div className="flex flex-col items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm shrink-0">
                           <QRCodeSVG value={p.codiceaccesso} size={64} fgColor="#064e3b" />
                           <span className="text-[9px] font-black font-mono text-emerald-800 mt-1 tracking-widest">{p.codiceaccesso}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottoni in basso */}
                    {p.stato === 'Attiva' && (
                      <div className="flex gap-2 mt-auto pt-3 border-t border-gray-100">
                        <button onClick={() => handleProlungaSosta(p)} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm">Prolunga +1h</button>
                        <button onClick={() => executeCancelBooking(p)} className="flex-1 py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 hover:border-red-300 transition-all">Annulla Sosta</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ZONA ROSSA */}
        <div className="lg:col-span-2 bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm mt-4">
          <h2 className="text-lg font-black text-red-900 mb-2">Zona di Pericolo</h2>
          <p className="text-sm text-red-700 mb-4 font-medium">Questa azione eliminerà definitivamente il tuo account, le tue targhe e tutto il tuo storico dal nostro database. L'operazione non può essere annullata.</p>
          <button onClick={handleDeleteAccount} className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold shadow-sm hover:bg-red-700 transition-all border border-red-700">Elimina Definitivamente Account</button>
        </div>

      </div>
    </div>
  );
}