import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from "npm:resend"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Invece di fidarci, leggiamo il pacchetto come semplice testo
    const rawBody = await req.text();
    
    // 2. Se è completamente vuoto, fermiamo tutto con un errore umano
    if (!rawBody) {
      throw new Error("Il pacchetto è vuoto! React non sta inviando i dati nel 'body'.");
    }

    // 3. Ora che sappiamo che c'è qualcosa, lo trasformiamo in JSON
    const { email, nome, codiceAccesso, parcheggio } = JSON.parse(rawBody);

    if (!email) {
      throw new Error("Pacchetto ricevuto, ma l'indirizzo email dell'utente è vuoto o mancante!");
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${codiceAccesso}`

    const { data, error } = await resend.emails.send({
      from: 'Brescia Green Park <onboarding@resend.dev>',
      to: [email],
      subject: `Conferma Prenotazione - ${parcheggio}`,
      html: `
        <h1>Ciao ${nome || 'Utente'}!</h1>
        <p>La tua sosta è confermata. Mostra questo QR Code alla sbarra:</p>
        <img src="${qrUrl}" alt="QR Code Accesso" />
        <p>Codice testuale: <strong>${codiceAccesso}</strong></p>
      `,
    })

    if (error) throw error;

    return new Response(JSON.stringify(data), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200 
    })

  } catch (error) {
    console.error("ERRORE NELLA FUNZIONE:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400 
    })
  }
})