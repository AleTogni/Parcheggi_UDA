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
  // Controlla ogni 10 secondi se una sosta a schermo è appena scaduta
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      
      // Verifica se nello stato attuale c'è una sosta attiva con tempo superato
      const sostaScaduta = prenotazioni.some(
        p => p.stato === 'Attiva' && now > new Date(p.orariofine)
      );

      // Se ne becca una, risveglia la funzione principale per chiuderla sul DB!
      if (sostaScaduta) {
        loadPrenotazioni(); 
      }
    }, 10000); // 10 secondi

    return () => clearInterval(timer);
  }, [prenotazioni]);

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

      // IL ROBOTTINO AUTOMATICO CON I SENSORI ACCESI
      for (const p of data) {
        const scadenza = new Date(p.orariofine);

        // 1. Controlliamo se la data è valida
        if (isNaN(scadenza.getTime())) {
          console.error(`🚨 ATTENZIONE: Formato data illeggibile per la sosta ${p.idprenotazione}:`, p.orariofine);
          continue; // Salta questa sosta e passa alla successiva
        }

        if (p.stato === 'Attiva' && now > scadenza) {
          console.log(`⏳ Sosta ${p.idprenotazione} scaduta! Tento di chiuderla nel DB...`);
          
          // 2. Aggiorna Prenotazione e stampa eventuali errori Supabase
          const { error: errPrenotazione } = await supabase
            .from('prenotazioni')
            .update({ stato: 'Conclusa' })
            .eq('idprenotazione', p.idprenotazione);
            
          if (errPrenotazione) {
            console.error("❌ Errore Supabase su PRENOTAZIONI:", errPrenotazione.message);
          }

          // 3. Libera Posto Auto e stampa eventuali errori Supabase
          const { error: errPosto } = await supabase
            .from('posti_auto')
            .update({ stato: 'Libero' })
            .eq('idposto', p.idposto);
            
          if (errPosto) {
            console.error("❌ Errore Supabase su POSTI_AUTO:", errPosto.message);
          }

          if (!errPrenotazione && !errPosto) {
            console.log("✅ Sosta chiusa con successo nel DB!");
            requiresRefresh = true;
          }
        }
      }

      // Se ha chiuso delle soste, riscarica i dati aggiornati per mostrare tutto corretto
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
      if (error.code === '23505') { // 23505 è il codice errore di Supabase per la clausola UNIQUE
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 sm:mt-10 relative z-0">
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
          
          <div className="overflow-y-auto max-h-[60vh] sm:h-[500px] pr-2 custom-scrollbar">
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
                          {p.posti_auto?.parcheggi?.nome || 'Parcheggio'}
                        </span>
                        <span className="font-mono text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded mt-1 inline-block">
                          {p.targa} • {p.posti_auto?.piano}
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
                      <div className="text-xs text-gray-600 space-y-1.5 w-full pr-4">
                        <div className="flex justify-between"><span>Arrivo:</span><span className="text-gray-900 font-bold">{formattaData(p.orarioinizio)}</span></div>
                        <div className="flex justify-between"><span>Uscita:</span><span className="text-gray-900 font-bold">{formattaData(p.orariofine)}</span></div>
                        <div className="flex justify-between pt-2 border-t border-gray-100 mt-2"><span>Costo:</span><span className="text-emerald-700 font-black">{p.costo ? `${p.costo} €` : '0.00 €'}</span></div>
                      </div>

                      {p.stato === 'Attiva' && p.codiceaccesso && (
                        <div className="flex flex-col items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm shrink-0">
                           <QRCodeSVG value={p.codiceaccesso} size={64} fgColor="#064e3b" />
                           <span className="text-[9px] font-black font-mono text-emerald-800 mt-1 tracking-widest">{p.codiceaccesso}</span>
                        </div>
                      )}
                    </div>

                    {p.stato === 'Attiva' && (
                      <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100">
                        <button 
                          onClick={() => {
                            const park = {
                              nome: p.posti_auto.parcheggi.nome,
                              latitudine: p.posti_auto.parcheggi.latitudine,
                              longitudine: p.posti_auto.parcheggi.longitudine
                            };
                            setDestinationParking(park);
                            navigate('/');
                          }}
                          className="flex-1 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-[10px] sm:text-xs font-black tracking-wider hover:bg-blue-100 transition-all shadow-sm"
                        >
                          Guida
                        </button>
                        
                        <button 
                          onClick={() => handleProlungaSosta(p)} 
                          className="flex-1 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] sm:text-xs font-black tracking-wider hover:bg-emerald-100 transition-all shadow-sm"
                        >
                          +1 Ora
                        </button>
                        
                        <button 
                          onClick={() => executeCancelBooking(p)} 
                          className="flex-1 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-[10px] sm:text-xs font-black tracking-wider hover:bg-red-100 transition-all shadow-sm"
                        >
                          Annulla
                        </button>
                      </div>
                    )}

                    {p.stato === 'Conclusa' && (
                      <div className="flex mt-auto pt-4 border-t border-gray-100">
                        <button 
                          onClick={() => { setReviewModal(p); setReviewForm({ voto: 5, testo: '' }); }}
                          className="w-full py-2.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-xl text-[10px] sm:text-xs font-black tracking-wider hover:bg-yellow-100 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                          Valuta Sosta
                        </button>
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
      {/* MODAL RECENSIONE */}
      {reviewModal && (
        <div onClick={() => setReviewModal(null)} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] transition-all">
          <div onClick={(e) => e.stopPropagation()} className="bg-white p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl relative animate-scale-up">
            <button onClick={() => setReviewModal(null)} className="absolute top-4 right-4 text-2xl font-bold text-gray-300 hover:text-gray-800 transition-colors">&times;</button>
            
            <h2 className="text-2xl font-black text-gray-900 mb-1">Com'è andata?</h2>
            <p className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-widest">{reviewModal.posti_auto?.parcheggi?.nome}</p>

            {/* Selettore Stelle */}
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg 
                  key={star}
                  onClick={() => setReviewForm({ ...reviewForm, voto: star })}
                  className={`w-10 h-10 cursor-pointer transition-all hover:scale-110 ${reviewForm.voto >= star ? 'text-yellow-400' : 'text-gray-200'}`} 
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
              className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm font-medium resize-none h-28 mb-4"
            ></textarea>

            <button 
              onClick={handleSubmitReview}
              className="w-full bg-yellow-400 text-yellow-950 py-3.5 rounded-xl font-black text-sm uppercase tracking-widest shadow-md hover:bg-yellow-500 transition-all"
            >
              Invia Recensione
            </button>
          </div>
        </div>
      )}
    </div>
  );
}