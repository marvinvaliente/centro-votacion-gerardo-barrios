import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ── Cron: se ejecuta cada 5 minutos (ver vercel.json)
// Busca eventos que empiezan en los últimos 10 min y aún no enviaron notif de check-in.
// Por cada usuario que confirmó asistencia → inserta un DM tipo 'checkin' en su chat.

export const runtime = 'edge'

const VENTANA_MIN = 10 // minutos hacia atrás para detectar inicio de evento

export async function GET(req: Request) {
  // Verificar que viene de Vercel Cron o del admin
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Vercel también envía el header x-vercel-cron-signature; si no hay secret configurado, aceptar desde Vercel
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    if (!isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const ahora = new Date()
  const hoy = ahora.toISOString().slice(0, 10) // YYYY-MM-DD
  const horaActual = ahora.toTimeString().slice(0, 5) // HH:MM
  // Hora hace VENTANA_MIN minutos
  const hace = new Date(ahora.getTime() - VENTANA_MIN * 60 * 1000)
  const horaHace = hace.toTimeString().slice(0, 5)

  // 1. Buscar eventos de hoy que empezaron en la ventana y aún no notificaron
  const { data: eventos, error: evErr } = await supabase
    .from('eventos_transporte')
    .select('id, nombre, hora')
    .eq('fecha', hoy)
    .eq('checkin_notif_enviada', false)
    .gte('hora', horaHace)
    .lte('hora', horaActual)

  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 })
  if (!eventos || eventos.length === 0) {
    return NextResponse.json({ enviados: 0, message: 'No hay eventos iniciando ahora.' })
  }

  let totalEnviados = 0

  for (const evento of eventos) {
    // 2. Obtener todos los que confirmaron asistencia
    const { data: confs } = await supabase
      .from('confirmaciones_evento')
      .select('usuario_id')
      .eq('evento_id', evento.id)
      .eq('confirmado', true)

    if (!confs || confs.length === 0) {
      // Marcar como enviada aunque no haya nadie
      await supabase.from('eventos_transporte').update({ checkin_notif_enviada: true }).eq('id', evento.id)
      continue
    }

    // 3. Insertar DM tipo 'checkin' para cada usuario confirmado
    const mensajes = confs.map(c => ({
      remitente_id:   null as null,       // mensaje de sistema
      destinatario_id: c.usuario_id,
      remitente_nombre: 'Portal Electoral',
      contenido: `📋 Hora de registrar tu presencia en "${evento.nombre}". Toca el botón para confirmar que estás presente.`,
      leido: false,
      tipo: 'checkin',
      metadata: {
        evento_id:     evento.id,
        evento_nombre: evento.nombre,
        evento_hora:   evento.hora,
      },
    }))

    const { error: insErr } = await supabase.from('mensajes_directos').insert(mensajes)
    if (insErr) {
      console.error(`Error insertando checkin para evento ${evento.id}:`, insErr.message)
      continue
    }

    // 4. Marcar evento como notificado
    await supabase.from('eventos_transporte').update({ checkin_notif_enviada: true }).eq('id', evento.id)
    totalEnviados += confs.length
  }

  return NextResponse.json({
    enviados: totalEnviados,
    eventos: eventos.map(e => e.nombre),
  })
}
