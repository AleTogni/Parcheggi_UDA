// src/utils/gamification.js

export const CALCOLO_PUNTI = {
  PUNTI_PER_ORA: 10,
  BONUS_EV: 1.2, // +20%
};

export const LISTA_PREMI = [
  { id: 1, soglia: 200, titolo: "Green", desc: "Adotta un albero o finanzia un progetto di riforestazione locale a tuo nome.", categoria: "Ambiente" },
  { id: 2, soglia: 500, titolo: "Cultura", desc: "Sconto speciale sul biglietto di un museo o mostra situata vicino al parcheggio.", categoria: "Cultura" },
  { id: 3, soglia: 1000, titolo: "Avventure", desc: "Partecipazione a trekking guidati o escursioni in riserve naturali protette.", categoria: "Natura" },
  { id: 4, soglia: 1500, titolo: "Mobilità", desc: "Voucher per l'utilizzo gratuito di bici o monopattini elettrici in città.", categoria: "Mobilità" },
];

export const calcolaPuntiSosta = (inizio, fine, tipoAlimentazione) => {
  const start = new Date(inizio);
  const end = new Date(fine);
  const ore = Math.ceil((end - start) / (1000 * 60 * 60)); // Arrotonda per eccesso all'ora
  
  let punti = ore * CALCOLO_PUNTI.PUNTI_PER_ORA;
  
  if (tipoAlimentazione === 'Elettrica') {
    punti = Math.floor(punti * CALCOLO_PUNTI.BONUS_EV);
  }
  
  return punti;
};