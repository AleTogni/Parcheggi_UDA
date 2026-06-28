import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // service role: bypassa RLS
  )

  const now = new Date().toISOString()

  // 1. Trova tutte le prenotazioni attive già scadute
  const { data: scadute, error } = await supabase
    .from('prenotazioni')
    .select('idprenotazione, idposto, idpersona, orarioinizio, orariofine, costo')
    .eq('stato', 'Attiva')
    .lt('orariofine', now) // orariofine < adesso

  if (error) return new Response(JSON.stringify({ error }), { status: 500 })
  if (!scadute || scadute.length === 0)
    return new Response(JSON.stringify({ chiuse: 0 }), { status: 200 })

  // 2. Per ognuna: chiudi la prenotazione e libera il posto
  for (const p of scadute) {
    await supabase
      .from('prenotazioni')
      .update({ stato: 'Conclusa' })
      .eq('idprenotazione', p.idprenotazione)

    await supabase
      .from('posti_auto')
      .update({ stato: 'Libero' })
      .eq('idposto', p.idposto)
  }

  return new Response(
    JSON.stringify({ chiuse: scadute.length }),
    { status: 200 }
  )
})