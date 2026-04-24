import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from "npm:resend"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

serve(async (req) => {
  const { email, nome, codiceAccesso, parcheggio } = await req.json()

  // Generiamo il link del QR Code tramite un'API pubblica (api.qrserver.com)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${codiceAccesso}`

  const { data, error } = await resend.emails.send({
    from: 'Brescia Green Park <onboarding@resend.dev>', 
    to: [email],
    subject: `Conferma Prenotazione - ${parcheggio}`,
    html: `
      <h1>Ciao ${nome}!</h1>
      <p>La tua sosta è confermata. Mostra questo QR Code alla sbarra:</p>
      <img src="${qrUrl}" alt="QR Code Accesso" />
      <p>Codice testuale: <strong>${codiceAccesso}</strong></p>
    `,
  })

  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } })
})