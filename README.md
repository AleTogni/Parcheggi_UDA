# Brescia Green Park
[![Live Demo](https://img.shields.io/badge/Demo-Live_su_Netlify-success?style=for-the-badge)](https://bresciagreenpark.netlify.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-BaaS-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)

Brescia Green Park è una piattaforma web per la gestione intelligente della sosta urbana. Il progetto nasce come MVP con l'obiettivo di ottimizzare l'uso dei parcheggi cittadini e promuovere la mobilità sostenibile tramite un sistema di incentivi digitali e gamification.

---

## Visione del progetto

L'applicazione vuole risolvere le inefficienze legate alla ricerca del parcheggio, riducendo il traffico parassita e le emissioni. Grazie all'integrazione di tecnologie cloud e realtime, il sistema fornisce dati accurati sulla disponibilità degli stalli e premia chi sceglie soluzioni di mobilità a basso impatto ambientale.

---

## Analisi e preparazione

### Contesto e problema

Brescia, come molte città italiane, affronta quotidianamente la congestione veicolare legata alla ricerca di sosta, il cosiddetto "traffico parassita", con impatti negativi sull'ambiente, sulla vivibilità urbana e sui tempi di spostamento.

### Obiettivi

1. **Digitalizzare la sosta urbana:** dare ai cittadini uno strumento per vedere in tempo reale la disponibilità dei parcheggi, senza dover girare alla cieca.
2. **Incentivare la mobilità sostenibile:** premiare con punti (EcoPoints) le soste con veicoli elettrici e i comportamenti virtuosi.
3. **Strumenti per gli amministratori:** una dashboard per monitorare gli impianti, gestire le prenotazioni e misurare l'impatto ambientale.

### Come abbiamo lavorato

Il progetto è partito dalla definizione dei requisiti e da una fase di ideazione dell'interfaccia, per poi procedere all'implementazione e al testing. In sintesi:

- Analisi dei requisiti e definizione degli use case (utente e amministratore).
- Progettazione del modello dati su Supabase (`persona`, `parcheggio`, `posto_auto`, `prenotazione`, `recensioni`, `premi_riscattati`).
- Implementazione del frontend in React con Vite e Tailwind CSS.
- Integrazione del realtime di Supabase per la sincronizzazione automatica dei dati.
- Testing manuale su browser desktop e mobile.
- Deploy continuo su Netlify collegato al repository GitHub.

### Schema del modello dati

| Tabella | Descrizione |
|---|---|
| `persona` | Utenti registrati, con ruolo (`utente` / `admin`), punti accumulati e UUID Supabase Auth |
| `parcheggio` | Parcheggi urbani con coordinate, capienza totale e attributi strutturali |
| `posto_auto` | Singoli stalli con piano, tipologia (`Standard`, `Disabili`, `Elettrico`) e stato (`Libero` / `Occupato`) |
| `prenotazione` | Sessioni di sosta con targa, orari, costo e stato (`Attiva`, `Conclusa`, `Annullata`) |
| `recensioni` | Valutazioni degli utenti per i parcheggi (voto da 1 a 5 stelle) |
| `premi_riscattati` | Storico dei premi riscattati tramite EcoPoints |

---

## Requisiti funzionali

### Autenticazione e gestione utenti

- Registrazione tramite email e password, o in alternativa tramite Google OAuth.
- Login, recupero password via email e aggiornamento della password dalla pagina dedicata.
- La sessione rimane attiva tra i refresh della pagina.
- Gli utenti con ruolo `admin` hanno accesso all'area riservata; tutti gli altri vengono reindirizzati.

### Visualizzazione parcheggi

- Mappa interattiva (Leaflet/OpenStreetMap) con tutti i parcheggi disponibili.
- I marker cambiano colore in base alla saturazione: verde = libero, blu = parziale, rosso = pieno.
- La ZTL è evidenziata come area poligonale sulla mappa.
- Filtri per nome, stalli disabili e colonnine elettriche; ordinamento per posti liberi o alfabetico.
- Disponibilità aggiornata in tempo reale via WebSocket, senza bisogno di ricaricare la pagina.
- Valutazione media a stelle (1–5) visibile per ogni parcheggio.
- Su mobile, vista a tab tra "Mappa" e "Lista".

### Navigazione GPS

- Pulsante sulla mappa per rilevare la posizione GPS dell'utente.
- Calcolo e visualizzazione del percorso stradale verso il parcheggio scelto (Leaflet Routing Machine), tracciato in verde e con zoom automatico.

### Prenotazione stalli

- Selezione dello stallo con piano e tipologia indicati; associazione a un veicolo salvato o a una targa inserita manualmente.
- Calendario interattivo localizzato in italiano per scegliere data e ora di arrivo/uscita.
- Preventivo visibile prima della conferma (€2,00/ora).
- Alla conferma lo stallo passa a `Occupato` e la prenotazione viene registrata.
- Al termine della sosta i punti EcoPoints vengono aggiornati, con bonus +20% per veicoli elettrici.

### Profilo utente

- Modifica dei dati anagrafici (nome, cognome, telefono) e gestione anagrafica veicoli (aggiunta ed eliminazione targhe).
- Storico prenotazioni con data, parcheggio, costo e punti guadagnati.
- Possibilità di lasciare una recensione a stelle per un parcheggio utilizzato.
- Navigazione GPS avviabile direttamente da una prenotazione nello storico.

### Gamification (EcoPoints)

- 10 punti per ogni ora di sosta completata, con moltiplicatore ×1,2 per i veicoli elettrici.
- Pagina dedicata con saldo punti e catalogo premi riscattabili (con selezione della quantità).
- Il riscatto viene bloccato con messaggio di errore se i punti non sono sufficienti.

### Dashboard amministratore

- Metriche principali in tempo reale: utenti registrati, parcheggi attivi, stalli totali e soste in corso.
- Grafici interattivi su andamento soste e risparmio CO₂ stimato (settimana / mese / anno).
- Inserimento nuovi parcheggi (nome, capienza, tipo, coordinate) e aggiunta stalli a quelli esistenti.
- Registro prenotazioni filtrabile per parcheggio e per stato (attive / storico), con terminazione forzata delle soste e export CSV.
- Lista utenti con ricerca, filtro per ruolo, promozione ad admin ed eliminazione con conferma a doppio step.

### Interfaccia

- Tema chiaro e scuro con preferenza salvata nel browser.
- Assistente virtuale (chatbot) accessibile tramite pulsante FAB fisso.
- Skeleton loader durante il caricamento asincrono dei dati.

---

## Requisiti non funzionali

### Prestazioni

- Il caricamento iniziale deve avvenire in meno di 3 secondi su connessione ≥10 Mbps.
- Gli aggiornamenti realtime degli stalli devono riflettersi nell'interfaccia entro 1 secondo.
- Il calcolo del preventivo avviene lato client, senza chiamate al server.

### Usabilità

- Interfaccia responsiva e usabile da viewport a partire da 320px.
- Il flusso di prenotazione non richiede più di 5 interazioni.
- I feedback (conferme, errori) vengono comunicati tramite toast visibili almeno 4 secondi.
- Il cambio tema avviene senza flash, con transizioni CSS ≤300ms.

### Sicurezza

- Tutte le comunicazioni avvengono tramite HTTPS/TLS.
- Le chiavi API sono gestite tramite variabili d'ambiente, mai hardcodate nel codice.
- La rotta `/admin` è protetta: non autenticati vengono rimandati al login, gli utenti senza ruolo admin alla home.
- La gestione delle sessioni si affida interamente a Supabase Auth.

### Affidabilità

- Il recupero del profilo ritenta automaticamente fino a 4 volte (intervallo 500ms) per gestire ritardi post-registrazione.
- La sincronizzazione del profilo usa i canali Realtime per garantire consistenza tra sessioni diverse.
- In caso di errore durante riscatto o prenotazione, viene mostrato un messaggio senza modificare parzialmente il database.

### Manutenibilità

- Codice organizzato per responsabilità: `/pages`, `/components`, `/utils`, `/context`, `/api`.
- La logica dei punti (tariffe e moltiplicatori) è centralizzata in `gamification.js`.
- Il client Supabase è istanziato una sola volta in `supabaseClient.js`.

### Compatibilità

- Compatibile con le ultime versioni stabili di Chrome, Firefox, Safari ed Edge.
- La mappa funziona su touch con zoom e pan nativi.

---

## Funzionalità principali

### Per l'utente
- **Monitoraggio realtime:** mappa interattiva con disponibilità aggiornata, stalli disabili e colonnine EV evidenziati.
- **Prenotazione:** selezione stallo, targa, orari e preventivo istantaneo.
- **Navigazione GPS:** percorso stradale verso il parcheggio direttamente dalla mappa.
- **Profilo:** gestione veicoli e storico prenotazioni.
- **EcoPoints:** accumulo punti e riscatto premi dal catalogo integrato.
- **Recensioni:** valutazione a stelle per ogni parcheggio usato.
- **Assistente virtuale:** chatbot di supporto accessibile tramite FAB.

### Per l'amministratore
- **Dashboard:** metriche operative in tempo reale.
- **Gestione infrastruttura:** aggiunta parcheggi e stalli.
- **Report ambientale:** grafici CO₂ risparmiata su base temporale.
- **Registro prenotazioni:** filtri, terminazione forzata soste ed export CSV.
- **Gestione utenti:** ricerca, filtri, promozione ad admin ed eliminazione account.

---

## Architettura tecnica

- **Frontend:** React 18 con Vite e React Router v6.
- **Styling:** Tailwind CSS con animazioni CSS personalizzate per tema, modal e toast.
- **BaaS:** Supabase — database PostgreSQL, autenticazione (email e Google OAuth), canali Realtime e Row Level Security.
- **Mappa:** Leaflet + OpenStreetMap; Leaflet Routing Machine per i percorsi GPS.
- **Grafici:** Recharts per la dashboard admin.
- **Altro:** Flatpickr per il selettore date localizzato in italiano.

### Struttura del progetto

```
src/
├── api/
│   └── supabaseClient.js       # Istanza client Supabase
├── components/
│   ├── navbar.jsx              # Barra di navigazione responsiva
│   ├── parkingmap.jsx          # Mappa Leaflet con routing GPS
│   └── ThemeSwitch.jsx         # Toggle tema chiaro/scuro
├── context/
│   └── ThemeContext.jsx        # Provider globale del tema
├── pages/
│   ├── Home.jsx                # Home con mappa e prenotazione
│   ├── Login.jsx               # Autenticazione
│   ├── Register.jsx            # Registrazione
│   ├── Profile.jsx             # Gestione profilo utente
│   ├── Rewards.jsx             # Catalogo premi EcoPoints
│   ├── AdminDashboard.jsx      # Pannello di controllo admin
│   └── UpdatePassword.jsx      # Aggiornamento password
└── utils/
    └── gamification.js         # Logica calcolo punti e lista premi
```

---

## Installazione

1. Clonare il repository:
```bash
git clone https://github.com/AleTogni/Parcheggi_UDA
```

2. Navigare nella cartella e installare le dipendenze:
```bash
cd Parcheggi_UDA
npm install
```

3. Creare un file `.env` con le chiavi Supabase (disponibili in *Project Settings → API*):
```env
VITE_APP_SUPABASE_URL=il_tuo_url_supabase
VITE_APP_SUPABASE_ANON_KEY=la_tua_chiave_anon_supabase
```

4. Avviare l'applicazione:
```bash
npm run dev
```

L'app sarà disponibile su `http://localhost:5173`.

---

## Team

- **Togni Alessandro**
- **Singh Manrayet**
- **Ponti Daniele**
