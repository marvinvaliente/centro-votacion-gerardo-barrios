/**
 * Funciones de notificación automática.
 * Se invocan tras crear eventos, subir materiales o asignar cargos.
 */
import { supabase } from '@/lib/supabase'

const ADMIN_ID     = 'admin'
const ADMIN_NOMBRE = 'ADMINISTRADOR'

/** Publica un aviso en el Canal General cuando se crea un nuevo evento */
export async function notificarNuevoEvento(
  titulo: string,
  fecha: string,          // 'YYYY-MM-DD'
  hora: string | null,
  lugar: string | null,
  tipo: string,
) {
  const fechaFmt = new Date(fecha + 'T12:00:00').toLocaleDateString('es-SV', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const horaFmt = hora ? ` a las ${hora}` : ''
  const lines = [
    `📅 Nuevo evento programado`,
    ``,
    `📌 ${titulo}`,
    `🗓 ${fechaFmt}${horaFmt}`,
    ...(lugar ? [`📍 ${lugar}`] : []),
    `🏷 Tipo: ${tipo}`,
  ]
  await supabase.from('mensajes_general').insert({
    autor_id:     ADMIN_ID,
    autor_nombre: ADMIN_NOMBRE,
    autor_rol:    'admin',
    contenido:    lines.join('\n'),
  })
}

/** Publica un aviso en el Canal General cuando se sube un nuevo material */
export async function notificarNuevoMaterial(nombre: string, categoria: string) {
  const contenido = [
    `📂 Nuevo material disponible`,
    ``,
    `📄 ${nombre}`,
    `🏷 Categoría: ${categoria}`,
    ``,
    `Revisa la sección de Materiales en el portal para descargarlo.`,
  ].join('\n')
  await supabase.from('mensajes_general').insert({
    autor_id:     ADMIN_ID,
    autor_nombre: ADMIN_NOMBRE,
    autor_rol:    'admin',
    contenido,
  })
}

/**
 * Envía un DM de bienvenida al usuario asignado a un cargo.
 * @param registroId  ID del registro_dui asignado
 * @param padronId    ID del puesto en padron (para leer cargo y jrv)
 */
export async function notificarAsignacionCargo(registroId: string, padronId: string) {
  // 1. Buscar el usuario del portal que corresponde a este registro_dui
  const { data: usr } = await supabase
    .from('usuarios')
    .select('id, nombre')
    .eq('registro_dui_id', registroId)
    .single()
  if (!usr) return   // sin cuenta en el portal → nada que hacer

  // 2. Leer cargo y jrv del padrón
  const { data: p } = await supabase
    .from('padron')
    .select('cargo, jrv')
    .eq('id', padronId)
    .single()
  if (!p) return

  const esJrv = p.jrv !== 'OTRO' && p.jrv !== '—' && !!p.jrv

  // 3. Si tiene JRV, obtener los otros miembros
  let bloqueJrv = ''
  if (esJrv) {
    const { data: rdMiembros } = await supabase
      .from('registros_dui')
      .select('nombre, cargo, jrv')
      .eq('jrv', p.jrv)
      .neq('id', registroId)
    const miembros = (rdMiembros ?? []).filter(m => m.nombre)
    if (miembros.length > 0) {
      const lista = miembros.map(m => `  • ${m.nombre} — ${m.cargo}`).join('\n')
      bloqueJrv = `\n\n👥 Miembros de tu JRV ${p.jrv}:\n${lista}`
    } else {
      bloqueJrv = `\n\n🗳 Eres el primer miembro registrado en la JRV ${p.jrv}.`
    }
  }

  const jrvLinea = esJrv ? `\n🗳 JRV: ${p.jrv}` : ''
  const contenido = [
    `👋 ¡Bienvenido/a al sistema del Centro de Votación Gerardo Barrios!`,
    ``,
    `Has sido asignado/a al cargo:`,
    `📋 ${p.cargo}${jrvLinea}${bloqueJrv}`,
    ``,
    `Puedes usar los chats del portal para comunicarte con el equipo. ¡Mucho éxito!`,
  ].join('\n')

  await supabase.from('mensajes_directos').insert({
    remitente_id:    ADMIN_ID,
    destinatario_id: usr.id,
    remitente_nombre: ADMIN_NOMBRE,
    contenido,
  })
}
