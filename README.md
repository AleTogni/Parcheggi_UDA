# Brescia Green Park

Brescia Green Park è una piattaforma web avanzata progettata per la gestione intelligente della sosta urbana. Il progetto nasce come Minimum Viable Product (MVP) con l'obiettivo di ottimizzare l'uso degli spazi di parcheggio cittadini e promuovere attivamente la mobilità sostenibile attraverso un sistema integrato di incentivi digitali e gamification.

## Visione del progetto

L'applicazione si propone di risolvere le inefficienze legate alla ricerca del parcheggio, riducendo il traffico parassita e l'inquinamento atmosferico. Attraverso l'integrazione di tecnologie cloud e realtime, il sistema fornisce dati accurati sulla disponibilità degli stalli, premiando gli utenti che scelgono soluzioni di mobilità a basso impatto ambientale.

## Funzionalità principali

### Per l'utente
- Monitoraggio realtime: visualizzazione su mappa interattiva dei parcheggi disponibili, con distinzione specifica per stalli riservati a disabili e colonnine di ricarica elettrica (EV).
- Sistema di prenotazione: flusso guidato per la selezione del posto, associazione della targa e calcolo istantaneo del preventivo basato sulla durata prevista.
- Gestione profilo: archivio digitale dei veicoli personali e storico dettagliato delle prenotazioni effettuate.
- Gamification (EcoPoints): sistema di accumulo punti basato sulla sostenibilità delle soste, con catalogo premi integrato per il riscatto di agevolazioni.

### Per l'amministratore
- Dashboard analitica: visualizzazione delle metriche chiave relative a utenti registrati, saturazione degli impianti e volume di soste attive.
- Gestione infrastruttura: strumenti per l'inserimento di nuovi parcheggi e la mappatura granulare degli stalli (piano, tipologia, stato).
- Report ambientale: grafici interattivi per l'analisi della CO2 risparmiata e statistiche sull'utilizzo degli impianti su base temporale.
- Registro operativo: accesso completo al database delle prenotazioni per il monitoraggio e la gestione forzata delle sessioni di sosta.

## Architettura tecnica

Il progetto utilizza uno stack moderno per garantire prestazioni elevate e sincronizzazione dei dati in tempo reale:

- Frontend: React.js (Vite) per un'interfaccia reattiva e veloce.
- Styling: Tailwind CSS per un design moderno, responsivo e ottimizzato per dispositivi mobile.
- Backend as a Service (BaaS): supabase per la gestione del database PostgreSQL, autenticazione sicura e notifiche push in tempo reale.
- Data visualization: recharts per la generazione di grafici analitici e Leaflet per la cartografia interattiva.

## Requisiti e Installazione

Per eseguire il progetto in ambiente locale, seguire la procedura descritta:

1. Clonare il repository:  
   git clone <[parcheggi_UDA](https://github.com/AleTogni/Parcheggi_UDA)>

2. Installare le dipendenze necessarie:  
   npm install

3. Configurazione dell'ambiente:  
   creare un file .env nella directory principale e configurare le seguenti chiavi:  
   VITE_SUPABASE_URL=il_tuo_url_supabase  
   VITE_SUPABASE_ANON_KEY=la_tua_chiave_anon_supabase  

4. Avvio dell'applicazione:  
   npm run dev

L'interfaccia sarà disponibile all'indirizzo predefinito http://localhost:5173 o ParcheggiUDA.netlify.app


Componenti del progetto: Togni Alessandro, Singh Manrayet, Ponti Daniele
