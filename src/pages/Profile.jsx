import React, { useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';

export default function Profile({ profile, refreshProfile, setDestinationParking }) {
  const navigate = useNavigate();
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
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm] = useState({ voto: 5, testo: '' });
  const [qrModal, setQrModal] = useState(null);

  // Stato per aggiornare le barre di progresso live ogni minuto
  const [currentTime, setCurrentTime] = useState(new Date());

  const tariffaOraria = 2.00;

  useEffect(() => {
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timeInterval);
  }, []);

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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'veicoli', filter: `idpersona=eq.${profile.idpersona}` }, () => {
          loadVeicoli(); 
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'prenotazioni', filter: `idpersona=eq.${profile.idpersona}` }, () => {
          loadPrenotazioni(); 
        })
        .subscribe();

      return () => { supabase.removeChannel(profileChannel); };
    }
  }, [profile]);

  // --- ROBOTTINO IN BACKGROUND ---
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setPrenotazioni(prev => {
        const sostaScaduta = prev.some(
          p => p.stato === 'Attiva' && now > new Date(p.orariofine)
        );
        if (sostaScaduta) loadPrenotazioni();
        return prev;
      });
    }, 10000); // 10 secondi

    return () => clearInterval(timer);
  }, []);

  async function loadVeicoli() {
    const { data } = await supabase
      .from('veicoli')
      .select('*')
      .eq('idpersona', profile.idpersona);
    setVeicoli(data || []);
  }

  async function loadPrenotazioni() {
    const { data } = await supabase
      .from('prenotazioni')
      .select('*, posti_auto(piano, idparcheggio, parcheggi(nome, latitudine, longitudine))') 
      .eq('idpersona', profile.idpersona)
      .order('orarioinizio', { ascending: false });

    if (data) {
      let requiresRefresh = false;
      const now = new Date();

      for (const p of data) {
        const scadenza = new Date(p.orariofine);

        if (isNaN(scadenza.getTime())) continue;

        if (p.stato === 'Attiva' && now > scadenza) {
          await supabase.from('prenotazioni').update({ stato: 'Conclusa' }).eq('idprenotazione', p.idprenotazione);
          await supabase.from('posti_auto').update({ stato: 'Libero' }).eq('idposto', p.idposto);
          requiresRefresh = true;
        }
      }

      if (requiresRefresh) {
        const { data: updatedData } = await supabase
          .from('prenotazioni')
          .select('*, posti_auto(piano, idparcheggio, parcheggi(nome, latitudine, longitudine))') 
          .eq('idpersona', profile.idpersona)
          .order('orarioinizio', { ascending: false });
        setPrenotazioni(updatedData || []);
      } else {
        setPrenotazioni(data);
      }
    } else {
      setPrenotazioni([]);
    }
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
    const { error } = await supabase.from('persone').update(form).eq('idpersona', profile.idpersona);
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
        .from('veicoli')
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
      const { error } = await supabase.from('veicoli').insert([{ 
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
    
    const { error } = await supabase.from('veicoli').delete().eq('targa', targaToDelete);
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
    await supabase.from('prenotazioni').update({ stato: 'Annullata' }).eq('idprenotazione', pren.idprenotazione);
    await supabase.from('posti_auto').update({ stato: 'Libero' }).eq('idposto', pren.idposto);
    if (setDestinationParking) setDestinationParking(null);
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

    const { error } = await supabase.from('prenotazioni')
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

  const handleSubmitReview = async () => {
    if (!reviewModal) return;

    const { error } = await supabase.from('recensioni').insert([{
      idprenotazione: reviewModal.idprenotazione,
      idparcheggio: reviewModal.posti_auto.idparcheggio,
      idpersona: profile.idpersona,
      voto: reviewForm.voto,
      testo: reviewForm.testo
    }]);

    if (error) {
      if (error.code === '23505') { 
        showMessage("Hai già recensito questa sosta!");
      } else {
        showMessage("Errore durante l'invio della recensione.");
        console.error(error);
      }
    } else {
      showMessage("Recensione inviata con successo! Grazie!");
    }
    
    setReviewModal(null);
    setReviewForm({ voto: 5, testo: '' });
  };

  const prenoFiltrate = prenotazioni.filter(p => activeTab === 'attive' ? p.stato === 'Attiva' : p.stato !== 'Attiva');

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 sm:mt-10 relative z-0 transition-colors">
      
      <div className="flex justify-between items-center mb-8 h-10 border-b border-gray-200 dark:border-gray-800 pb-4 transition-colors">
        <div>
          <h1 className="text-3xl font-black text-emerald-900 dark:text-emerald-400 transition-colors">Area Personale</h1>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1 transition-colors">Gestisci i tuoi dati e le tue soste</p>
        </div>
        {uiMessage && <span className="bg-gray-800 dark:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md animate-fade-in-up transition-colors">{uiMessage}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SEZIONE DATI PERSONALI */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden transition-colors">
          
          {/* Header card con avatar */}
          <div className="bg-gradient-to-br from-emerald-700 to-emerald-600 px-6 pt-6 pb-8 relative">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-black text-white shadow-inner shrink-0">
                {(form.nome?.charAt(0) || '?').toUpperCase()}
              </div>
              <div>
                <p className="text-emerald-100/70 text-[10px] font-black uppercase tracking-widest">Profilo</p>
                <h2 className="text-xl font-black text-white leading-tight">{form.nome} {form.cognome}</h2>
                <p className="text-emerald-200/70 text-xs font-medium mt-0.5">{profile?.email}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleUpdate} className="p-6 flex flex-col gap-5 flex-grow">

            {/* Dati anagrafici */}
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Anagrafica</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 tracking-wide transition-colors">Nome</label>
                  <input type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="Nome" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 tracking-wide transition-colors">Cognome</label>
                  <input type="text" value={form.cognome} onChange={e => setForm({...form, cognome: e.target.value})} className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="Cognome" />
                </div>
              </div>
            </div>

            {/* Contatti */}
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Contatti</p>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 tracking-wide transition-colors">Telefono</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </span>
                  <input type="text" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} className="w-full pl-9 pr-3 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="+39 000 000 0000" />
                </div>
              </div>
            </div>

            {/* Indirizzo */}
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Indirizzo</p>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 tracking-wide transition-colors">Via</label>
                    <input type="text" value={form.via} onChange={e => setForm({...form, via: e.target.value})} className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="Via Roma, 1" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 tracking-wide transition-colors">CAP</label>
                    <input type="text" value={form.cap} onChange={e => setForm({...form, cap: e.target.value})} className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="25100" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 tracking-wide transition-colors">Città</label>
                  <input type="text" value={form.citta} onChange={e => setForm({...form, citta: e.target.value})} className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium" placeholder="Brescia" />
                </div>
              </div>
            </div>

            {/* Toggle disabile */}
            <button type="button" onClick={() => setForm({...form, is_disabile: !form.is_disabile})} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${form.is_disabile ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${form.is_disabile ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11v4m0 4h.01M8 21h8"/></svg>
              </div>
              <div className="flex-1">
                <p className={`text-sm font-black transition-colors ${form.is_disabile ? 'text-emerald-800 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>Pass Disabili</p>
                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">Abilita l'accesso agli stalli riservati</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${form.is_disabile ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 dark:border-gray-600'}`}>
                {form.is_disabile && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}
              </div>
            </button>

            <button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-black text-sm shadow-sm transition-all active:scale-[0.98] mt-auto">
              Salva Modifiche
            </button>
          </form>
        </div>

        {/* SEZIONE VEICOLI */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden transition-colors">
          
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 transition-colors">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2.5.5M13 16H5.5M13 16l2.5.5M19 16h.5a1 1 0 00.95-.68l1.05-3.16A1 1 0 0020.5 11H16l-2-5H9"/></svg>
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-800 dark:text-gray-100 transition-colors">
                  {editingTarga ? <span className="text-emerald-700 dark:text-emerald-400">Modifica Veicolo</span> : 'I tuoi Veicoli'}
                </h2>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">{veicoli.length} registrat{veicoli.length === 1 ? 'o' : 'i'}</p>
              </div>
            </div>
          </div>

          <div className="p-6 flex flex-col gap-5 flex-grow">

            {/* Form aggiungi/modifica */}
            <form onSubmit={handleVeicoloAction} className={`p-4 rounded-2xl border-2 transition-all ${editingTarga ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/10' : 'border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30'}`}>
              <p className="text-[10px] font-black uppercase tracking-widest mb-3 ${editingTarga ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}">
                {editingTarga ? `✏️ Modifica: ${editingTarga}` : '+ Aggiungi veicolo'}
              </p>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 tracking-wide transition-colors">Targa</label>
                  <input
                    type="text"
                    value={targa}
                    onChange={e => setTarga(e.target.value)}
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl uppercase bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-black tracking-widest"
                    placeholder="AB123CD"
                    required
                  />
                </div>
                <div className="w-36">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 tracking-wide transition-colors">Alimentazione</label>
                  <select
                    value={alimentazione}
                    onChange={e => setAlimentazione(e.target.value)}
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="Termica">⛽ Termica</option>
                    <option value="Elettrica">⚡ Elettrica</option>
                  </select>
                </div>
                <div className="flex gap-1.5 items-end">
                  <button type="submit" className={`h-[46px] px-5 rounded-xl font-black text-sm shadow-sm transition-all active:scale-95 text-white ${editingTarga ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600'}`}>
                    {editingTarga ? 'Salva' : '+'}
                  </button>
                  {editingTarga && (
                    <button type="button" onClick={() => { setEditingTarga(null); setTarga(''); setAlimentazione('Termica'); }} className="h-[46px] px-3 rounded-xl font-black text-sm bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                      ×
                    </button>
                  )}
                </div>
              </div>
            </form>

            {/* Lista veicoli */}
            <div className="space-y-2.5 overflow-y-auto max-h-[260px] custom-scrollbar pr-1">
              {veicoli.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                  </div>
                  <p className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-widest">Nessun veicolo salvato</p>
                </div>
              ) : veicoli.map(v => (
                <div key={v.targa} className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all group ${editingTarga === v.targa ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/10' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700'}`}>

                  {/* Icona tipo */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg transition-colors ${v.alimentazione === 'Elettrica' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    {v.alimentazione === 'Elettrica' ? '⚡' : '⛽'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="font-mono font-black text-gray-800 dark:text-gray-200 tracking-widest text-sm transition-colors block">{v.targa}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide transition-colors ${v.alimentazione === 'Elettrica' ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      {v.alimentazione}
                    </span>
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditVeicolo(v)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={() => deleteVeicolo(v.targa)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m-2 0h10" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* STORICO PRENOTAZIONI (TICKET D'IMBARCO) */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col transition-colors">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 transition-colors">Le tue Soste</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5 transition-colors">Ticket digitali e storico</p>
              </div>
            </div>
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl shadow-inner w-full sm:w-auto transition-colors">
              <button onClick={() => setActiveTab('attive')} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'attive' ? 'bg-white dark:bg-gray-700 text-emerald-800 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>In corso</button>
              <button onClick={() => setActiveTab('storico')} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'storico' ? 'bg-white dark:bg-gray-700 text-emerald-800 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>Storico</button>
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
            {prenoFiltrate.length === 0 ? (
              <div className="flex items-center justify-center py-20 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-3xl transition-colors">
                <p className="text-gray-400 dark:text-gray-500 text-xs font-black uppercase tracking-widest transition-colors">Nessuna sosta presente</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 pb-4">
                {prenoFiltrate.map(p => {
                  // Calcolo progress bar per soste attive
                  let progress = 0;
                  if (p.stato === 'Attiva') {
                    const start = new Date(p.orarioinizio).getTime();
                    const end = new Date(p.orariofine).getTime();
                    const total = end - start;
                    const elapsed = currentTime.getTime() - start;
                    progress = Math.min(Math.max((elapsed / total) * 100, 0), 100);
                  }

                  return (
                    <div key={p.idprenotazione} className="flex flex-col md:flex-row bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 relative overflow-hidden group transition-all hover:shadow-xl">
                      
                      {/* Left Side (Info Ticket) */}
                      <div className="p-6 flex-1 border-b md:border-b-0 md:border-r-2 border-dashed border-gray-200 dark:border-gray-700 relative transition-colors">
                        
                        {/* Cutouts per effetto strappo */}
                        <div className="absolute -right-3 -top-3 w-6 h-6 bg-gray-50 dark:bg-gray-900 rounded-full border border-gray-200 dark:border-gray-800 hidden md:block z-10 transition-colors"></div>
                        <div className="absolute -right-3 -bottom-3 w-6 h-6 bg-gray-50 dark:bg-gray-900 rounded-full border border-gray-200 dark:border-gray-800 hidden md:block z-10 transition-colors"></div>
                        
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] block mb-1 transition-colors">Destinazione</span>
                            <span className="font-black text-gray-900 dark:text-white text-2xl tracking-tight leading-none block transition-colors">
                              {p.posti_auto?.parcheggi?.nome || 'Parcheggio'}
                            </span>
                          </div>
                          <span className={`text-[9px] uppercase px-3 py-1.5 rounded-full font-black tracking-widest border shadow-sm transition-colors flex items-center gap-1.5 ${
                            p.stato === 'Attiva' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' : 
                            p.stato === 'Conclusa' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50' : 
                            'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-700'
                          }`}>
                            {p.stato === 'Attiva' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>}
                            {p.stato}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-5 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 transition-colors">
                          <div>
                            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 transition-colors">Targa</span>
                            <span className="font-mono font-black text-gray-800 dark:text-gray-200 text-sm transition-colors">{p.targa}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 transition-colors">Stallo</span>
                            <span className="font-black text-gray-800 dark:text-gray-200 text-sm transition-colors">{p.posti_auto?.piano}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 transition-colors">Costo</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm transition-colors">{p.costo ? `${p.costo} €` : '0.00 €'}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 transition-colors">
                          <span>{formattaData(p.orarioinizio)}</span>
                          <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                          <span>{formattaData(p.orariofine)}</span>
                        </div>

                        {/* Barra Progresso Live (Solo Attive) */}
                        {p.stato === 'Attiva' && (
                          <div className="mt-4">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Avanzamento sosta</span>
                              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">{Math.round(progress)}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner transition-colors">
                              <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                          </div>
                        )}

                        {/* Azioni Sosta */}
                        {p.stato === 'Attiva' && (
                          <div className="flex gap-2 mt-5">
                            <button onClick={() => { const park = { nome: p.posti_auto.parcheggi.nome, latitudine: p.posti_auto.parcheggi.latitudine, longitudine: p.posti_auto.parcheggi.longitudine }; setDestinationParking(park); navigate('/'); }} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[10px] sm:text-xs font-black tracking-widest transition-all shadow-sm uppercase active:scale-95">
                              <span className="flex items-center justify-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                                Naviga
                              </span>
                            </button>
                            <button onClick={() => handleProlungaSosta(p)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-2xl text-[10px] sm:text-xs font-black tracking-widest hover:bg-gray-200 dark:hover:bg-gray-700 transition-all shadow-sm uppercase active:scale-95">+1 Ora</button>
                            <button onClick={() => executeCancelBooking(p)} className="py-3 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs font-black hover:bg-red-100 dark:hover:bg-red-900/40 transition-all shadow-sm active:scale-95">✕</button>
                          </div>
                        )}

                          {p.stato === 'Conclusa' && (
                            <div className="mt-5">
                              <button onClick={() => { setReviewModal(p); setReviewForm({ voto: 5, testo: '' }); }} className="w-full py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2">
                                <svg className="w-4 h-4 text-yellow-400 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                                Lascia una Recensione
                              </button>
                            </div>
                          )}
                      </div>

                      {/* Right Side (QR CODE Ticket) */}
                      {/* Desktop: sempre visibile | Mobile: bottone che apre il modale */}
                      <div className={`shrink-0 relative transition-colors ${p.stato !== 'Attiva' ? 'hidden md:flex opacity-50 grayscale' : ''}`}>
                        {/* Desktop view */}
                        <div className="hidden md:flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900/50 w-56 h-full transition-colors">
                          <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 text-center transition-colors">Codice Accesso</span>
                          <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 mb-2 transition-colors">
                            <QRCodeSVG value={p.codiceaccesso || '000000'} size={100} fgColor="#000000" bgColor="#ffffff" />
                          </div>
                          <span className="font-mono font-black text-gray-800 dark:text-gray-200 tracking-[0.3em] text-lg transition-colors">{p.codiceaccesso || '------'}</span>
                        </div>

                        {/* Mobile: bottone compatto */}
                        {p.stato === 'Attiva' && (
                          <button
                            onClick={() => setQrModal(p)}
                            className="md:hidden flex items-center gap-3 w-full px-5 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-t border-dashed border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors group"
                          >
                            <div className="bg-white dark:bg-gray-900 p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
                              <QRCodeSVG value={p.codiceaccesso || '000000'} size={28} fgColor="#000000" bgColor="#ffffff" />
                            </div>
                            <div className="flex-1 text-left">
                              <span className="block text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Codice Accesso</span>
                              <span className="font-mono font-black text-gray-800 dark:text-gray-200 tracking-[0.2em] text-sm">{p.codiceaccesso || '------'}</span>
                            </div>
                            <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ZONA ROSSA */}
        <div className="lg:col-span-2 bg-red-50 dark:bg-red-900/10 p-6 sm:p-8 rounded-3xl border border-red-200 dark:border-red-900/30 shadow-sm mt-4 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <svg className="w-6 h-6 text-red-600 dark:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <h2 className="text-xl font-black text-red-900 dark:text-red-400 transition-colors">Zona di Pericolo</h2>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300/80 mb-6 font-medium leading-relaxed max-w-3xl transition-colors">Questa azione eliminerà definitivamente il tuo account, le tue targhe e tutto il tuo storico dal nostro database. L'operazione non può essere annullata ed è permanente.</p>
          <button onClick={handleDeleteAccount} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">Elimina Account</button>
        </div>

      </div>

      {/* MODAL QR CODE (Mobile) */}
      {qrModal && (
        <div onClick={() => setQrModal(null)} className="fixed inset-0 bg-gray-900/90 backdrop-blur-sm flex items-center justify-center p-6 z-[100]">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] max-w-xs w-full shadow-2xl relative border border-gray-200 dark:border-gray-800 flex flex-col items-center">
            <button onClick={() => setQrModal(null)} className="absolute top-5 right-5 text-2xl font-bold text-gray-300 dark:text-gray-600 hover:text-gray-800 dark:hover:text-gray-300 transition-colors">&times;</button>

            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Codice Accesso</span>
            <span className="font-black text-gray-900 dark:text-white text-lg mb-5 truncate max-w-full">
              {qrModal.posti_auto?.parcheggi?.nome || 'Parcheggio'}
            </span>

            <div className="bg-white p-4 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 mb-5">
              <QRCodeSVG value={qrModal.codiceaccesso || '000000'} size={200} fgColor="#000000" bgColor="#ffffff" />
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl px-6 py-3 border border-gray-100 dark:border-gray-700 mb-2">
              <span className="font-mono font-black text-gray-800 dark:text-gray-200 tracking-[0.35em] text-2xl">{qrModal.codiceaccesso || '------'}</span>
            </div>

            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-2">Mostra all'ingresso</span>
          </div>
        </div>
      )}

      {reviewModal && (
        <div onClick={() => setReviewModal(null)} className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] transition-all">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-900 p-6 sm:p-10 rounded-[2.5rem] max-w-md w-full shadow-2xl relative animate-scale-up border border-gray-200 dark:border-gray-800 transition-colors">
            <button onClick={() => setReviewModal(null)} className="absolute top-5 right-5 text-2xl font-bold text-gray-300 dark:text-gray-600 hover:text-gray-800 dark:hover:text-gray-300 transition-colors">&times;</button>
            
            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-1 tracking-tight transition-colors">Com'è andata?</h2>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-8 uppercase tracking-widest transition-colors">{reviewModal.posti_auto?.parcheggi?.nome}</p>

            <div className="flex justify-center gap-3 mb-8 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 transition-colors">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg 
                  key={star}
                  onClick={() => setReviewForm({ ...reviewForm, voto: star })}
                  className={`w-12 h-12 cursor-pointer transition-all hover:scale-110 drop-shadow-sm ${reviewForm.voto >= star ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-700'}`} 
                  fill="currentColor" viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              ))}
            </div>

            <textarea 
              placeholder="Scrivi una breve recensione (opzionale)..."
              value={reviewForm.testo}
              onChange={(e) => setReviewForm({ ...reviewForm, testo: e.target.value })}
              className="w-full p-5 rounded-2xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm font-medium resize-none h-32 mb-6 shadow-inner"
            ></textarea>

            <button 
              onClick={handleSubmitReview}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-950 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-md transition-all active:scale-95"
            >
              Invia Recensione
            </button>
          </div>
        </div>
      )}
    </div>
  );
}