'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Send, Users, MessageCircle, ChevronRight, Loader2, Globe, ShieldAlert, Eye, X, Search, ChevronDown, ChevronUp, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Tipos ────────────────────────────────────────────────────
interface UsuarioProp {
  id: string
  nombre: string
  dui: string
  registro_dui_id?: string | null
  rol?: string
  foto_perfil_url?: string | null
}

interface MiembroJrv { id: string; nombre: string; cargo: string; dui: string; foto?: string | null }

interface MensajeGeneral {
  id: string; autor_id: string; autor_nombre: string; autor_rol: string; contenido: string; created_at: string
}
interface MensajeJrv {
  id: string; jrv: string; autor_id: string; autor_nombre: string; autor_rol?: string; contenido: string; created_at: string
}
interface MensajeDirecto {
  id: string; remitente_id: string; destinatario_id: string; remitente_nombre: string; contenido: string; leido: boolean; created_at: string
}

type Conversacion =
  | { tipo: 'general' }
  | { tipo: 'grupo'; jrv: string }
  | { tipo: 'dm'; miembro: MiembroJrv }

// ── Helpers ──────────────────────────────────────────────────
function getLastReadGrupo(jrv: string): string {
  if (typeof window === 'undefined') return new Date(0).toISOString()
  return localStorage.getItem(`lastReadGrupo_${jrv}`) ?? localStorage.getItem('lastReadGrupo') ?? new Date(0).toISOString()
}
function setLastReadGrupoLS(jrv: string, ts: string) {
  if (typeof window !== 'undefined') localStorage.setItem(`lastReadGrupo_${jrv}`, ts)
}
function fmtHora(iso: string) {
  const d = new Date(iso), ahora = new Date()
  if (ahora.toDateString() === d.toDateString()) return d.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-SV', { day: 'numeric', month: 'short' })
}
function iniciales(nombre: string) {
  return nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

// ── Componente ───────────────────────────────────────────────
export default function MensajesSection({
  usuario,
  onNoLeidosChange,
}: {
  usuario: UsuarioProp
  onNoLeidosChange?: (n: number) => void
}) {
  const [jrvData, setJrvData] = useState<{ jrv: string | null; cargo: string | null } | null>(null)
  const [miembros, setMiembros] = useState<MiembroJrv[]>([])
  const [conversacion, setConversacion] = useState<Conversacion | null>(null)
  const [mensajesGeneral, setMensajesGeneral] = useState<MensajeGeneral[]>([])
  const [mensajesGrupo, setMensajesGrupo] = useState<MensajeJrv[]>([])
  const [mensajesDm, setMensajesDm] = useState<MensajeDirecto[]>([])
  const [noLeidosGeneral, setNoLeidosGeneral] = useState(0)
  const [noLeidos, setNoLeidos] = useState<Record<string, number>>({})
  const [noLeidosGrupo, setNoLeidosGrupo] = useState(0)
  const [noLeidosJrvs, setNoLeidosJrvs] = useState<Record<string, number>>({})
  const [todasJrvs, setTodasJrvs] = useState<string[]>([])
  const lastReadGeneralRef = useRef<string>(
    typeof window !== 'undefined' ? localStorage.getItem('lastReadGeneral') ?? new Date(0).toISOString() : new Date(0).toISOString()
  )
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastReadGrupoRef = useRef<string>(new Date(0).toISOString())
  // Lecturas (visto por)
  const [lecturas, setLecturas] = useState<Record<string, { id: string; nombre: string; leido_at: string; usuario_id?: string }[]>>({})
  const [popoverLectura, setPopoverLectura] = useState<string | null>(null)
  // Escribiendo: { nombre, foto } de quienes están escribiendo en la conversación activa
  const [escribiendo, setEscribiendo] = useState<{ id: string; nombre: string; foto?: string | null }[]>([])
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Reacciones: mensajeId -> { emoji -> [{ usuario_id, usuario_nombre }] }
  const [reacciones, setReacciones] = useState<Record<string, Record<string, { usuario_id: string; usuario_nombre: string }[]>>>({})
  // Picker de emojis: id del mensaje abierto (o null)
  const [pickerMsgId, setPickerMsgId] = useState<string | null>(null)
  const EMOJIS = ['👍','❤️','😂','😮','😢','🙏','🔥','👏','✅','🫡']
  // Caché de fotos de perfil: userId -> url (null = sin foto)
  const [fotosCache, setFotosCache] = useState<Record<string, string | null>>(() => {
    // Pre-cargar foto del usuario actual
    const init: Record<string, string | null> = {}
    if (usuario.foto_perfil_url) init[usuario.id] = usuario.foto_perfil_url
    return init
  })

  // Todos los usuarios del sistema (para DMs)
  const [todosUsuarios, setTodosUsuarios] = useState<{ id: string; nombre: string; cargo: string; jrv: string | null; foto: string | null }[]>([])
  const [chatsIniciados, setChatsIniciados] = useState<{ id: string; nombre: string; cargo: string; jrv: string | null; foto: string | null; ultimoMsg: string; ultimaHora: string }[]>([])
  const [busquedaDM, setBusquedaDM] = useState('')
  const [jrvsExpandidas, setJrvsExpandidas] = useState<Record<string, boolean>>({})

  // Propagar total no leídos al portal (para el badge del NAV)
  useEffect(() => {
    const total = Object.values(noLeidos).reduce((a, b) => a + b, 0) + noLeidosGrupo + noLeidosGeneral + Object.values(noLeidosJrvs).reduce((a, b) => a + b, 0)
    onNoLeidosChange?.(total)
  }, [noLeidos, noLeidosGrupo, noLeidosGeneral, noLeidosJrvs, onNoLeidosChange])

  // Cargar jrv/cargo
  useEffect(() => {
    if (!usuario.registro_dui_id) { setJrvData({ jrv: null, cargo: null }); return }
    supabase.from('registros_dui').select('jrv, cargo').eq('id', usuario.registro_dui_id).single()
      .then(({ data }) => setJrvData({
        jrv: data?.jrv && data.jrv !== '—' ? data.jrv : null,
        cargo: data?.cargo && data.cargo !== 'No registrado' ? data.cargo : null,
      }))
  }, [usuario.registro_dui_id])

  // Cargar miembros y otras JRVs
  useEffect(() => {
    if (jrvData === null) return
    const userJrv = jrvData.jrv
    const esJefe = usuario.rol === 'administrador' || usuario.rol === 'jefe_centro'
    if (userJrv) {
      supabase.from('registros_dui').select('id, nombre, cargo, dui').eq('jrv', userJrv)
        .then(async ({ data: rdData }) => {
          const rdIds = (rdData ?? []).map((r: { id: string }) => r.id)
          if (rdIds.length === 0) { setMiembros([]); return }
          const { data: usrData } = await supabase.from('usuarios').select('id, registro_dui_id, foto_perfil_url').in('registro_dui_id', rdIds).neq('id', usuario.id)
          const result: MiembroJrv[] = (usrData ?? []).map((u: { id: string; registro_dui_id: string; foto_perfil_url?: string | null }) => {
            const rd = (rdData ?? []).find((r: any) => r.id === u.registro_dui_id)
            return { id: u.id, nombre: rd?.nombre ?? '', cargo: rd?.cargo ?? '', dui: rd?.dui ?? '', foto: u.foto_perfil_url ?? null }
          }).filter((m: MiembroJrv) => m.nombre)
          setMiembros(result)
          // Poblar caché de fotos con los miembros cargados
          setFotosCache(prev => {
            const next = { ...prev }
            for (const m of result) next[m.id] = m.foto ?? null
            return next
          })
        })
    }
    if (esJefe) {
      supabase.from('registros_dui').select('jrv').neq('jrv', '—').not('jrv', 'is', null)
        .then(({ data }) => {
          let jrvs = Array.from(new Set((data ?? []).map((r: { jrv: string }) => r.jrv).filter(Boolean) as string[]))
          if (userJrv) jrvs = jrvs.filter(j => j !== userJrv)
          setTodasJrvs(jrvs)
        })
    }
  }, [usuario, jrvData])

  // No leídos iniciales
  const calcularNoLeidos = useCallback(async (userJrv: string | null) => {
    const { count: cg } = await supabase.from('mensajes_general').select('*', { count: 'exact', head: true }).neq('autor_id', usuario.id).gt('created_at', lastReadGeneralRef.current)
    setNoLeidosGeneral(cg ?? 0)
    const { data } = await supabase.from('mensajes_directos').select('remitente_id').eq('destinatario_id', usuario.id).eq('leido', false)
    const counts: Record<string, number> = {}
    for (const m of data ?? []) counts[m.remitente_id] = (counts[m.remitente_id] ?? 0) + 1
    setNoLeidos(counts)
    if (userJrv) {
      const { count } = await supabase.from('mensajes_jrv').select('*', { count: 'exact', head: true }).eq('jrv', userJrv).neq('autor_id', usuario.id).gt('created_at', getLastReadGrupo(userJrv))
      setNoLeidosGrupo(count ?? 0)
    }
  }, [usuario.id])

  useEffect(() => {
    if (jrvData !== null) calcularNoLeidos(jrvData.jrv)
  }, [jrvData, calcularNoLeidos])

  // No leídos otras JRVs
  useEffect(() => {
    if (todasJrvs.length === 0) return
    Promise.all(todasJrvs.map(async jrv => {
      const { count } = await supabase.from('mensajes_jrv').select('*', { count: 'exact', head: true }).eq('jrv', jrv).neq('autor_id', usuario.id).gt('created_at', getLastReadGrupo(jrv))
      return [jrv, count ?? 0] as [string, number]
    })).then(results => {
      const counts: Record<string, number> = {}
      for (const [jrv, c] of results) counts[jrv] = c
      setNoLeidosJrvs(counts)
    })
  }, [todasJrvs, usuario.id])

  // Cargar todos los usuarios del sistema
  useEffect(() => {
    async function cargar() {
      const { data: rdData } = await supabase
        .from('registros_dui')
        .select('id, nombre, padron:padron_id(cargo, jrv)')
        .order('nombre')
      const rdIds = (rdData ?? []).map((r: any) => r.id)
      if (rdIds.length === 0) return
      const { data: usrData } = await supabase
        .from('usuarios').select('id, registro_dui_id, foto_perfil_url')
        .in('registro_dui_id', rdIds).neq('id', usuario.id)
      const usrMap: Record<string, any> = {}
      for (const u of usrData ?? []) usrMap[u.registro_dui_id] = u
      const result = (rdData ?? [])
        .filter((r: any) => usrMap[r.id])
        .map((r: any) => ({
          id: usrMap[r.id].id,
          nombre: r.nombre,
          cargo: r.padron?.cargo ?? '',
          jrv: r.padron?.jrv && r.padron.jrv !== '—' ? r.padron.jrv : null,
          foto: usrMap[r.id].foto_perfil_url ?? null,
        }))
      setTodosUsuarios(result)
      // Poblar fotosCache
      setFotosCache(prev => {
        const next = { ...prev }
        for (const u of result) if (!(u.id in next)) next[u.id] = u.foto
        return next
      })
    }
    cargar()
  }, [usuario.id])

  // Cargar conversaciones DM iniciadas (para preview)
  useEffect(() => {
    async function cargar() {
      const { data: dms } = await supabase
        .from('mensajes_directos')
        .select('remitente_id, destinatario_id, remitente_nombre, contenido, created_at')
        .or(`remitente_id.eq.${usuario.id},destinatario_id.eq.${usuario.id}`)
        .order('created_at', { ascending: false })
        .limit(300)
      if (!dms || dms.length === 0) return
      // Agrupar por interlocutor (único), mantener el más reciente
      const seen = new Set<string>()
      const convs: { otherId: string; ultimoMsg: string; ultimaHora: string }[] = []
      for (const m of dms) {
        const otherId = m.remitente_id === usuario.id ? m.destinatario_id : m.remitente_id
        if (!seen.has(otherId)) { seen.add(otherId); convs.push({ otherId, ultimoMsg: m.contenido, ultimaHora: m.created_at }) }
      }
      if (convs.length === 0) return
      const { data: usrs } = await supabase.from('usuarios')
        .select('id, foto_perfil_url, registro:registro_dui_id(nombre, padron:padron_id(cargo, jrv))')
        .in('id', convs.map(c => c.otherId))
      const usrMap: Record<string, any> = {}
      for (const u of usrs ?? []) usrMap[u.id] = u
      setChatsIniciados(convs.map(c => {
        const u = usrMap[c.otherId]
        const reg = u?.registro as any
        return {
          id: c.otherId, nombre: reg?.nombre ?? 'Usuario',
          cargo: reg?.padron?.cargo ?? '', jrv: reg?.padron?.jrv ?? null,
          foto: u?.foto_perfil_url ?? null,
          ultimoMsg: c.ultimoMsg, ultimaHora: c.ultimaHora,
        }
      }))
    }
    cargar()
  }, [usuario.id])

  // Scroll al fondo
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajesGrupo, mensajesDm])

  // Cargar mensajes de conversación activa
  useEffect(() => {
    if (!conversacion) return
    setCargando(true)
    setLecturas({})
    setReacciones({})
    setPickerMsgId(null)
    if (conversacion.tipo === 'general') {
      supabase.from('mensajes_general').select('*').order('created_at', { ascending: true }).limit(150)
        .then(async ({ data }) => {
          const msgs = (data ?? []) as MensajeGeneral[]
          setMensajesGeneral(msgs)
          setCargando(false)
          const ahora = new Date().toISOString()
          lastReadGeneralRef.current = ahora
          localStorage.setItem('lastReadGeneral', ahora)
          setNoLeidosGeneral(0)
          await registrarLecturas(msgs, 'general')
          await cargarLecturas(msgs, 'general')
          await cargarFotosAutores(msgs, 'general')
          await cargarReacciones(msgs, 'general')
        })
    } else if (conversacion.tipo === 'grupo') {
      supabase.from('mensajes_jrv').select('*').eq('jrv', conversacion.jrv).order('created_at', { ascending: true }).limit(100)
        .then(async ({ data }) => {
          const msgs = (data ?? []) as MensajeJrv[]
          setMensajesGrupo(msgs)
          setCargando(false)
          const ahora = new Date().toISOString()
          lastReadGrupoRef.current = ahora
          setLastReadGrupoLS(conversacion.jrv, ahora)
          if (conversacion.jrv === jrvData?.jrv) setNoLeidosGrupo(0)
          else setNoLeidosJrvs(prev => ({ ...prev, [conversacion.jrv]: 0 }))
          await registrarLecturas(msgs, 'jrv')
          await cargarLecturas(msgs, 'jrv')
          await cargarFotosAutores(msgs, 'jrv')
          await cargarReacciones(msgs, 'jrv')
        })
    } else {
      const otherId = conversacion.miembro.id
      supabase.from('mensajes_directos').select('*')
        .or(`and(remitente_id.eq.${usuario.id},destinatario_id.eq.${otherId}),and(remitente_id.eq.${otherId},destinatario_id.eq.${usuario.id})`)
        .order('created_at', { ascending: true }).limit(100)
        .then(async ({ data }) => {
          const msgs = (data ?? []) as MensajeDirecto[]
          setMensajesDm(msgs)
          setCargando(false)
          await supabase.from('mensajes_directos').update({ leido: true }).eq('destinatario_id', usuario.id).eq('remitente_id', otherId).eq('leido', false)
          setNoLeidos(prev => ({ ...prev, [otherId]: 0 }))
          await registrarLecturas(msgs, 'dm')
          await cargarLecturas(msgs, 'dm')
          await cargarFotosAutores(msgs, 'dm')
          await cargarReacciones(msgs, 'dm')
        })
    }
  }, [conversacion, usuario.id, jrvData?.jrv])

  // Canal broadcast para indicador "está escribiendo"
  useEffect(() => {
    // Limpiar canal anterior y estado
    if (typingChannelRef.current) { supabase.removeChannel(typingChannelRef.current); typingChannelRef.current = null }
    setEscribiendo([])
    if (!conversacion) return
    // Nombre de canal único por conversación
    const chanName = conversacion.tipo === 'general' ? 'typing-general'
      : conversacion.tipo === 'grupo' ? `typing-jrv-${conversacion.jrv}`
      : `typing-dm-${[usuario.id, conversacion.miembro.id].sort().join('-')}`
    const ch = supabase.channel(chanName)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === usuario.id) return
        setEscribiendo(prev => {
          const yaEsta = prev.some(e => e.id === payload.userId)
          if (yaEsta) return prev
          return [...prev, { id: payload.userId, nombre: payload.nombre, foto: payload.foto ?? null }]
        })
        // Auto-limpiar tras 4s sin nuevo evento
        const timerId = setTimeout(() => {
          setEscribiendo(prev => prev.filter(e => e.id !== payload.userId))
        }, 4000)
        // guardar timer por userId en un ref sería ideal pero iife simplificado basta aquí
        return () => clearTimeout(timerId)
      })
      .on('broadcast', { event: 'stop_typing' }, ({ payload }) => {
        if (payload.userId === usuario.id) return
        setEscribiendo(prev => prev.filter(e => e.id !== payload.userId))
      })
      .subscribe()
    typingChannelRef.current = ch
    return () => { supabase.removeChannel(ch); typingChannelRef.current = null }
  }, [conversacion, usuario.id])

  // Realtime
  useEffect(() => {
    if (jrvData === null) return
    const userJrv = jrvData.jrv
    const chanGeneral = supabase.channel(`general-mensajes-${usuario.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_general' }, (payload) => {
        const msg = payload.new as MensajeGeneral
        if (conversacion?.tipo === 'general') {
          setMensajesGeneral(prev => [...prev, msg])
          const ahora = new Date().toISOString(); lastReadGeneralRef.current = ahora; localStorage.setItem('lastReadGeneral', ahora)
          if (msg.autor_id !== usuario.id) supabase.from('mensajes_lecturas').upsert({ mensaje_id: msg.id, tabla: 'general', usuario_id: usuario.id, usuario_nombre: usuario.nombre }, { onConflict: 'mensaje_id,tabla,usuario_id', ignoreDuplicates: true })
        } else if (msg.autor_id !== usuario.id) setNoLeidosGeneral(prev => prev + 1)
      }).subscribe()
    const chanDm = supabase.channel(`dm-para-${usuario.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_directos', filter: `destinatario_id=eq.${usuario.id}` }, (payload) => {
        const msg = payload.new as MensajeDirecto
        if (conversacion?.tipo === 'dm' && conversacion.miembro.id === msg.remitente_id) {
          setMensajesDm(prev => [...prev, msg])
          supabase.from('mensajes_directos').update({ leido: true }).eq('id', msg.id)
          supabase.from('mensajes_lecturas').upsert({ mensaje_id: msg.id, tabla: 'dm', usuario_id: usuario.id, usuario_nombre: usuario.nombre }, { onConflict: 'mensaje_id,tabla,usuario_id', ignoreDuplicates: true })
        } else setNoLeidos(prev => ({ ...prev, [msg.remitente_id]: (prev[msg.remitente_id] ?? 0) + 1 }))
        // Actualizar preview de chatsIniciados
        setChatsIniciados(prev => {
          const otherId = msg.remitente_id === usuario.id ? msg.destinatario_id : msg.remitente_id
          const existe = prev.find(c => c.id === otherId)
          if (existe) return prev.map(c => c.id === otherId ? { ...c, ultimoMsg: msg.contenido, ultimaHora: msg.created_at } : c)
          // nuevo interlocutor: añadir con info básica; todosUsuarios puede tenerlo
          return prev // se recargará con la próxima visita
        })
      }).subscribe()
    const channels = [chanGeneral, chanDm]
    if (userJrv) {
      const chanGrupo = supabase.channel(`jrv-mensajes-${userJrv}-${usuario.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_jrv', filter: `jrv=eq.${userJrv}` }, (payload) => {
          const msg = payload.new as MensajeJrv
          if (conversacion?.tipo === 'grupo' && conversacion.jrv === userJrv) {
            setMensajesGrupo(prev => [...prev, msg])
            const ahora = new Date().toISOString(); lastReadGrupoRef.current = ahora; setLastReadGrupoLS(userJrv, ahora)
            if (msg.autor_id !== usuario.id) supabase.from('mensajes_lecturas').upsert({ mensaje_id: msg.id, tabla: 'jrv', usuario_id: usuario.id, usuario_nombre: usuario.nombre }, { onConflict: 'mensaje_id,tabla,usuario_id', ignoreDuplicates: true })
          } else if (msg.autor_id !== usuario.id) setNoLeidosGrupo(prev => prev + 1)
        }).subscribe()
      channels.push(chanGrupo)
    }
    // Realtime: nuevas lecturas de mis mensajes
    const chanLecturas = supabase.channel(`lecturas-${usuario.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_lecturas' }, (payload) => {
        const r = payload.new as any
        // Solo actualizar si la lectura pertenece a un mensaje que tenemos en pantalla
        setLecturas(prev => {
          const yaExisten = prev[r.mensaje_id] ?? []
          if (yaExisten.some(x => x.nombre === r.usuario_nombre)) return prev
          return { ...prev, [r.mensaje_id]: [...yaExisten, { id: r.mensaje_id, nombre: r.usuario_nombre, leido_at: r.leido_at, usuario_id: r.usuario_id }] }
        })
        // Cargar foto si no está en caché
        if (r.usuario_id) {
          setFotosCache(prev => {
            if (r.usuario_id in prev) return prev
            supabase.from('usuarios').select('id, foto_perfil_url').eq('id', r.usuario_id).single()
              .then(({ data }) => {
                if (data) setFotosCache(p => ({ ...p, [data.id]: data.foto_perfil_url ?? null }))
              })
            return prev
          })
        }
      }).subscribe()
    channels.push(chanLecturas)
    // Realtime: reacciones en tiempo real
    const chanReacciones = supabase.channel(`reacciones-${usuario.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_reacciones' }, (payload) => {
        const r = payload.new as any
        setReacciones(prev => ({
          ...prev,
          [r.mensaje_id]: {
            ...(prev[r.mensaje_id] ?? {}),
            [r.emoji]: [...(prev[r.mensaje_id]?.[r.emoji] ?? []).filter(x => x.usuario_id !== r.usuario_id), { usuario_id: r.usuario_id, usuario_nombre: r.usuario_nombre }],
          },
        }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mensajes_reacciones' }, (payload) => {
        const r = payload.old as any
        if (!r.mensaje_id || !r.emoji) return
        setReacciones(prev => {
          if (!prev[r.mensaje_id]?.[r.emoji]) return prev
          const next = { ...prev, [r.mensaje_id]: { ...(prev[r.mensaje_id]) } }
          next[r.mensaje_id][r.emoji] = next[r.mensaje_id][r.emoji].filter(x => x.usuario_id !== r.usuario_id)
          if (next[r.mensaje_id][r.emoji].length === 0) delete next[r.mensaje_id][r.emoji]
          return next
        })
      }).subscribe()
    channels.push(chanReacciones)
    return () => { channels.forEach(ch => supabase.removeChannel(ch)) }
  }, [usuario.id, conversacion, jrvData])

  // Realtime otras JRVs
  useEffect(() => {
    if (todasJrvs.length === 0) return
    const channels = todasJrvs.map(jrv =>
      supabase.channel(`jrv-jefe-${jrv}-${usuario.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_jrv', filter: `jrv=eq.${jrv}` }, (payload) => {
          const msg = payload.new as MensajeJrv
          if (conversacion?.tipo === 'grupo' && conversacion.jrv === jrv) {
            setMensajesGrupo(prev => [...prev, msg])
            setLastReadGrupoLS(jrv, new Date().toISOString())
            setNoLeidosJrvs(prev => ({ ...prev, [jrv]: 0 }))
          } else if (msg.autor_id !== usuario.id) setNoLeidosJrvs(prev => ({ ...prev, [jrv]: (prev[jrv] ?? 0) + 1 }))
        }).subscribe()
    )
    return () => { channels.forEach(ch => supabase.removeChannel(ch)) }
  }, [usuario.id, todasJrvs, conversacion])

  // Registrar lecturas al abrir conversación (mensajes no propios)
  async function registrarLecturas(msgs: any[], tabla: 'general' | 'jrv' | 'dm') {
    const ajenos = msgs.filter(m => {
      const autorId = tabla === 'dm' ? m.remitente_id : m.autor_id
      return autorId !== usuario.id
    })
    if (ajenos.length === 0) return
    const rows = ajenos.map(m => ({
      mensaje_id: m.id,
      tabla,
      usuario_id: usuario.id,
      usuario_nombre: usuario.nombre,
    }))
    // upsert ignora duplicados por la constraint UNIQUE
    await supabase.from('mensajes_lecturas').upsert(rows, { onConflict: 'mensaje_id,tabla,usuario_id', ignoreDuplicates: true })
  }

  // Cargar lecturas de los mensajes propios
  async function cargarLecturas(msgs: any[], tabla: 'general' | 'jrv' | 'dm') {
    const propios = msgs.filter(m => {
      const autorId = tabla === 'dm' ? m.remitente_id : m.autor_id
      return autorId === usuario.id
    })
    if (propios.length === 0) return
    const ids = propios.map(m => m.id)
    const { data } = await supabase.from('mensajes_lecturas')
      .select('mensaje_id, usuario_id, usuario_nombre, leido_at')
      .eq('tabla', tabla)
      .in('mensaje_id', ids)
    if (!data) return
    const map: Record<string, { id: string; nombre: string; leido_at: string; usuario_id?: string }[]> = {}
    const autorIds: string[] = []
    for (const r of data) {
      if (!map[r.mensaje_id]) map[r.mensaje_id] = []
      map[r.mensaje_id].push({ id: r.mensaje_id, nombre: r.usuario_nombre, leido_at: r.leido_at, usuario_id: r.usuario_id })
      if (r.usuario_id && !(r.usuario_id in fotosCache)) autorIds.push(r.usuario_id)
    }
    // Cargar fotos de los que leyeron si no están en caché
    if (autorIds.length > 0) {
      supabase.from('usuarios').select('id, foto_perfil_url').in('id', [...new Set(autorIds)])
        .then(({ data: fData }) => {
          if (!fData) return
          setFotosCache(prev => {
            const next = { ...prev }
            for (const u of fData) next[u.id] = u.foto_perfil_url ?? null
            return next
          })
        })
    }
    setLecturas(prev => ({ ...prev, ...map }))
  }

  // Cargar reacciones de todos los mensajes de una conversación
  async function cargarReacciones(msgs: any[], tabla: 'general' | 'jrv' | 'dm') {
    if (msgs.length === 0) return
    const ids = msgs.map(m => m.id)
    const { data } = await supabase.from('mensajes_reacciones').select('mensaje_id, emoji, usuario_id, usuario_nombre').eq('tabla', tabla).in('mensaje_id', ids)
    if (!data) return
    const map: Record<string, Record<string, { usuario_id: string; usuario_nombre: string }[]>> = {}
    for (const r of data) {
      if (!map[r.mensaje_id]) map[r.mensaje_id] = {}
      if (!map[r.mensaje_id][r.emoji]) map[r.mensaje_id][r.emoji] = []
      map[r.mensaje_id][r.emoji].push({ usuario_id: r.usuario_id, usuario_nombre: r.usuario_nombre })
    }
    setReacciones(prev => ({ ...prev, ...map }))
  }

  // Toggle reacción: añadir si no existe, quitar si ya es del usuario
  async function toggleReaccion(msgId: string, emoji: string) {
    if (!conversacion) return
    const tabla = conversacion.tipo === 'general' ? 'general' : conversacion.tipo === 'grupo' ? 'jrv' : 'dm'
    const actuales = reacciones[msgId]?.[emoji] ?? []
    const yaPuse = actuales.some(r => r.usuario_id === usuario.id)
    if (yaPuse) {
      // Quitar
      await supabase.from('mensajes_reacciones').delete().eq('mensaje_id', msgId).eq('tabla', tabla).eq('usuario_id', usuario.id).eq('emoji', emoji)
      setReacciones(prev => {
        const next = { ...prev, [msgId]: { ...(prev[msgId] ?? {}) } }
        next[msgId][emoji] = (next[msgId][emoji] ?? []).filter(r => r.usuario_id !== usuario.id)
        if (next[msgId][emoji].length === 0) delete next[msgId][emoji]
        return next
      })
    } else {
      // Añadir
      await supabase.from('mensajes_reacciones').upsert({ mensaje_id: msgId, tabla, usuario_id: usuario.id, usuario_nombre: usuario.nombre, emoji }, { onConflict: 'mensaje_id,tabla,usuario_id,emoji', ignoreDuplicates: true })
      setReacciones(prev => ({
        ...prev,
        [msgId]: {
          ...(prev[msgId] ?? {}),
          [emoji]: [...(prev[msgId]?.[emoji] ?? []), { usuario_id: usuario.id, usuario_nombre: usuario.nombre }],
        },
      }))
    }
    setPickerMsgId(null)
  }

  // Cargar fotos de perfil de autores que no están en caché
  async function cargarFotosAutores(msgs: any[], tabla: 'general' | 'jrv' | 'dm') {
    const ids = msgs.map(m => tabla === 'dm' ? m.remitente_id : m.autor_id).filter(Boolean)
    const nuevos = [...new Set(ids)].filter(id => id !== usuario.id && !(id in fotosCache))
    if (nuevos.length === 0) return
    const { data } = await supabase.from('usuarios').select('id, foto_perfil_url').in('id', nuevos)
    if (!data) return
    setFotosCache(prev => {
      const next = { ...prev }
      for (const u of data) next[u.id] = u.foto_perfil_url ?? null
      // también marcar como null los que no volvieron (no tienen registro)
      for (const id of nuevos) if (!(id in next)) next[id] = null
      return next
    })
  }

  // Emitir "está escribiendo" via broadcast
  function emitirTyping() {
    if (!typingChannelRef.current) return
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: usuario.id, nombre: usuario.nombre, foto: usuario.foto_perfil_url ?? null } })
    // Programar auto-stop tras 3s de inactividad
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      typingChannelRef.current?.send({ type: 'broadcast', event: 'stop_typing', payload: { userId: usuario.id } })
    }, 3000)
  }

  // Enviar mensaje
  async function enviar() {
    if (!texto.trim() || !conversacion || enviando) return
    const contenido = texto.trim(); setTexto(''); setEnviando(true)
    if (conversacion.tipo === 'general') {
      const { data } = await supabase.from('mensajes_general').insert({ autor_id: usuario.id, autor_nombre: usuario.nombre, autor_rol: 'colaborador', contenido }).select().single()
      if (data) setMensajesGeneral(prev => [...prev, data as MensajeGeneral])
    } else if (conversacion.tipo === 'grupo') {
      const { data } = await supabase.from('mensajes_jrv').insert({ jrv: conversacion.jrv, autor_id: usuario.id, autor_nombre: usuario.nombre, autor_rol: 'colaborador', contenido }).select().single()
      if (data) setMensajesGrupo(prev => [...prev, data as MensajeJrv])
    } else {
      const { data } = await supabase.from('mensajes_directos').insert({ remitente_id: usuario.id, destinatario_id: conversacion.miembro.id, remitente_nombre: usuario.nombre, contenido }).select().single()
      if (data) setMensajesDm(prev => [...prev, data as MensajeDirecto])
    }
    setEnviando(false); inputRef.current?.focus()
    // Parar indicador de escritura propio al enviar
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingChannelRef.current?.send({ type: 'broadcast', event: 'stop_typing', payload: { userId: usuario.id } })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  const userJrv = jrvData?.jrv ?? null
  const esJefeCentro = usuario.rol === 'administrador' || usuario.rol === 'jefe_centro'
  const totalNoLeidos = Object.values(noLeidos).reduce((a, b) => a + b, 0) + noLeidosGrupo + noLeidosGeneral + Object.values(noLeidosJrvs).reduce((a, b) => a + b, 0)

  // ── Vista chat activo ───────────────────────────────────────
  if (conversacion) {
    const titulo = conversacion.tipo === 'general' ? 'Canal General' : conversacion.tipo === 'grupo' ? `JRV ${conversacion.jrv} · Chat grupal` : conversacion.miembro.nombre
    const subtitulo = conversacion.tipo === 'general' ? 'Comunicación con la administración' : conversacion.tipo === 'grupo' ? (conversacion.jrv === userJrv ? `${miembros.length + 1} integrantes` : `Chat grupal JRV ${conversacion.jrv}`) : conversacion.miembro.cargo
    const msgs: (MensajeGeneral | MensajeJrv | MensajeDirecto)[] = conversacion.tipo === 'general' ? mensajesGeneral : conversacion.tipo === 'grupo' ? mensajesGrupo : mensajesDm
    function esMio(msg: any) { return conversacion!.tipo === 'dm' ? msg.remitente_id === usuario.id : msg.autor_id === usuario.id }
    function nombreMsg(msg: any) { return conversacion!.tipo === 'dm' ? msg.remitente_nombre : msg.autor_nombre }
    function esAdminMsg(msg: any) { return msg.autor_rol === 'admin' || msg.autor_id === 'admin' }

    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)', background: '#f0f4f8' }}>
        {/* Header chat */}
        <div className="flex items-center gap-3 px-4 py-3 shadow-sm flex-shrink-0" style={{ background: '#1e3a5f', color: 'white' }}>
          <button onClick={() => setConversacion(null)} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs overflow-hidden"
            style={conversacion.tipo === 'dm' && fotosCache[conversacion.miembro.id] ? {} : {
              background: conversacion.tipo === 'general' ? 'rgba(99,102,241,.3)' : conversacion.tipo === 'grupo' ? 'rgba(200,168,75,.3)' : 'rgba(255,255,255,.15)',
              border: conversacion.tipo === 'general' ? '1px solid rgba(99,102,241,.5)' : conversacion.tipo === 'grupo' ? '1px solid rgba(200,168,75,.5)' : '1px solid rgba(255,255,255,.2)',
              color: conversacion.tipo === 'general' ? '#c7d2fe' : conversacion.tipo === 'grupo' ? '#c8a84b' : 'white',
            }}>
            {conversacion.tipo === 'general' ? <Globe className="w-4 h-4" /> : conversacion.tipo === 'grupo' ? <Users className="w-4 h-4" /> : (fotosCache[conversacion.miembro.id] ? <img src={fotosCache[conversacion.miembro.id]!} alt={conversacion.miembro.nombre} className="w-full h-full object-cover" /> : iniciales(conversacion.miembro.nombre))}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{titulo}</p>
            <p className="text-xs opacity-60 truncate">{subtitulo}</p>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" onClick={() => { setPickerMsgId(null); setPopoverLectura(null) }}>
          {cargando && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>}
          {!cargando && msgs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#e2e8f0' }}>
                <MessageCircle className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Ningún mensaje aún</p>
            </div>
          )}
          {msgs.map((msg, i) => {
            const mio = esMio(msg), nombre = nombreMsg(msg), admin = esAdminMsg(msg)
            const anterior = msgs[i - 1], mismoAutor = anterior && nombreMsg(anterior) === nombre && esMio(anterior) === mio
            const mostrarNombre = !mio && !mismoAutor && (conversacion.tipo === 'grupo' || conversacion.tipo === 'general')
            return (
              <div key={msg.id} className={`group flex ${mio ? 'justify-end' : 'justify-start'} ${mismoAutor ? 'mt-0.5' : 'mt-3'}`}>
                {!mio && !mismoAutor && (() => {
                  const autorId = conversacion.tipo === 'dm' ? (msg as MensajeDirecto).remitente_id : (msg as MensajeGeneral | MensajeJrv).autor_id
                  const fotoUrl = fotosCache[autorId]
                  return (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mr-2 mt-0.5 overflow-hidden"
                      style={!fotoUrl ? (admin ? { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' } : { background: '#dbeafe', color: '#1e40af' }) : {}}>
                      {fotoUrl
                        ? <img src={fotoUrl} alt={nombre} className="w-full h-full object-cover" />
                        : (admin ? <ShieldAlert className="w-3.5 h-3.5" /> : iniciales(nombre))
                      }
                    </div>
                  )
                })()}
                {!mio && mismoAutor && <div className="w-7 mr-2 flex-shrink-0" />}
                <div className={`max-w-[75%] ${mio ? 'items-end' : 'items-start'} flex flex-col relative`}>
                  {mostrarNombre && (
                    <span className="text-xs font-semibold mb-0.5 ml-1 flex items-center gap-1" style={{ color: admin ? '#1d4ed8' : '#1e40af' }}>
                      {nombre}{admin && <span className="text-[9px] px-1 py-0.5 rounded font-medium" style={{ background: '#eff6ff', color: '#3b82f6' }}>Admin</span>}
                    </span>
                  )}
                  {/* Burbuja + botón reaccionar */}
                  <div className="flex items-end gap-1.5" style={{ flexDirection: mio ? 'row-reverse' : 'row' }}>
                    <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${mio ? 'rounded-br-sm text-white' : 'rounded-bl-sm text-gray-800'}`}
                      style={{ background: mio ? '#1e3a5f' : admin ? '#eff6ff' : 'white', boxShadow: '0 1px 2px rgba(0,0,0,.08)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.contenido}
                    </div>
                    {/* Botón emoji */}
                    <button
                      onClick={e => { e.stopPropagation(); setPickerMsgId(pickerMsgId === msg.id ? null : msg.id); setPopoverLectura(null) }}
                      className="w-6 h-6 rounded-full flex items-center justify-center opacity-30 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      style={{ background: 'rgba(0,0,0,.07)', color: '#64748b', fontSize: 13, lineHeight: 1 }}
                      title="Reaccionar">
                      😊
                    </button>
                  </div>
                  {/* Picker de emojis */}
                  {pickerMsgId === msg.id && (
                    <div className={`absolute z-50 mt-1 flex gap-1 p-1.5 rounded-2xl shadow-xl ${mio ? 'right-0' : 'left-0'}`}
                      style={{ background: '#1e3a5f', border: '1px solid rgba(255,255,255,.12)', top: '100%' }}
                      onClick={e => e.stopPropagation()}>
                      {EMOJIS.map(e => {
                        const yaPuse = (reacciones[msg.id]?.[e] ?? []).some(r => r.usuario_id === usuario.id)
                        return (
                          <button key={e} onClick={() => toggleReaccion(msg.id, e)}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-lg transition-transform active:scale-110"
                            style={{ background: yaPuse ? 'rgba(200,168,75,.25)' : 'transparent' }}
                            title={e}>
                            {e}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {/* Chips de reacciones */}
                  {reacciones[msg.id] && Object.keys(reacciones[msg.id]).length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${mio ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(reacciones[msg.id]).map(([emoji, lista]) => {
                        const yaPuse = lista.some(r => r.usuario_id === usuario.id)
                        const tooltip = lista.map(r => r.usuario_nombre.split(' ')[0]).join(', ')
                        return (
                          <button key={emoji} onClick={() => toggleReaccion(msg.id, emoji)}
                            title={tooltip}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium transition-all active:scale-95"
                            style={{ background: yaPuse ? 'rgba(200,168,75,.2)' : 'rgba(0,0,0,.07)', border: yaPuse ? '1px solid rgba(200,168,75,.5)' : '1px solid rgba(0,0,0,.08)', color: yaPuse ? '#c8a84b' : '#475569' }}>
                            <span style={{ fontSize: 13 }}>{emoji}</span>
                            <span>{lista.length}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <span className="text-[10px] mt-0.5 mx-1 flex items-center gap-1" style={{ color: '#94a3b8' }}>
                    {fmtHora(msg.created_at)}
                    {mio && (() => {
                      const vistos = lecturas[msg.id] ?? []
                      const leido = conversacion.tipo === 'dm' ? (msg as MensajeDirecto).leido : false
                      const hayLecturas = vistos.length > 0 || leido
                      if (!hayLecturas) return <span style={{ color: '#94a3b8' }}>✓</span>
                      return (
                        <button
                          onClick={() => setPopoverLectura(popoverLectura === msg.id ? null : msg.id)}
                          className="flex items-center gap-0.5 hover:opacity-80 transition-opacity"
                          style={{ color: '#38bdf8', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                          <span>✓✓</span>
                          {conversacion.tipo !== 'dm' && vistos.length > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Eye size={9} />
                              <span>{vistos.length}</span>
                            </span>
                          )}
                        </button>
                      )
                    })()}
                  </span>
                  {/* Popover lecturas */}
                  {popoverLectura === msg.id && (() => {
                    const vistos = lecturas[msg.id] ?? []
                    if (vistos.length === 0) return null
                    return (
                      <div className="absolute z-50 bottom-full mb-1 right-0 w-56 rounded-xl shadow-lg overflow-hidden"
                        style={{ background: '#1e3a5f', border: '1px solid rgba(255,255,255,.12)' }}>
                        <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,.1)' }}>
                          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <Eye size={11} style={{ color: '#38bdf8' }} /> Visto por {vistos.length}
                          </span>
                          <button onClick={() => setPopoverLectura(null)} style={{ color: 'rgba(255,255,255,.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
                            <X size={12} />
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {vistos.map((v, idx) => {
                            const fotoVisto = v.usuario_id ? fotosCache[v.usuario_id] : null
                            return (
                              <div key={idx} className="px-3 py-1.5 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold"
                                  style={fotoVisto ? {} : { background: 'rgba(56,189,248,.2)', color: '#38bdf8' }}>
                                  {fotoVisto
                                    ? <img src={fotoVisto} alt={v.nombre} className="w-full h-full object-cover" />
                                    : iniciales(v.nombre)
                                  }
                                </div>
                                <span className="text-xs text-white truncate flex-1">{v.nombre}</span>
                                <span className="text-[10px] flex-shrink-0" style={{ color: '#38bdf8' }}>
                                  {new Date(v.leido_at).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Indicador "está escribiendo" */}
        {escribiendo.length > 0 && (
          <div className="flex-shrink-0 px-4 py-1.5 flex items-center gap-2" style={{ background: '#f0f4f8' }}>
            {/* Avatares mini de quienes escriben */}
            <div className="flex -space-x-1.5">
              {escribiendo.slice(0, 3).map(e => (
                <div key={e.id} className="w-5 h-5 rounded-full border-2 overflow-hidden flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                  style={e.foto ? { borderColor: '#f0f4f8' } : { borderColor: '#f0f4f8', background: '#dbeafe', color: '#1e40af' }}>
                  {e.foto ? <img src={e.foto} alt={e.nombre} className="w-full h-full object-cover" /> : iniciales(e.nombre)}
                </div>
              ))}
            </div>
            {/* Texto + animación de puntos */}
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: '#64748b' }}>
                {escribiendo.length === 1 ? escribiendo[0].nombre.split(' ')[0] : escribiendo.length === 2 ? `${escribiendo[0].nombre.split(' ')[0]} y ${escribiendo[1].nombre.split(' ')[0]}` : `${escribiendo[0].nombre.split(' ')[0]} y ${escribiendo.length - 1} más`}
                {' '}está{escribiendo.length > 1 ? 'n' : ''} escribiendo
              </span>
              <span className="flex gap-0.5 items-end pb-0.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="rounded-full" style={{ width: 4, height: 4, background: '#94a3b8', display: 'inline-block', animation: `typingDot 1.2s ${i * 0.2}s infinite ease-in-out` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <style>{`@keyframes typingDot { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-4px);opacity:1} }`}</style>

        {/* Input */}
        <div className="flex-shrink-0 px-3 py-3 flex items-end gap-2 pb-safe" style={{ background: 'white', borderTop: '1px solid #e2e8f0' }}>
          <textarea ref={inputRef} value={texto} onChange={e => { setTexto(e.target.value); if (e.target.value.trim()) emitirTyping() }} onKeyDown={onKeyDown}
            placeholder={conversacion.tipo === 'general' ? 'Escribe al canal general…' : conversacion.tipo === 'grupo' ? `Escribe al grupo JRV ${conversacion.jrv}…` : `Escribe a ${conversacion.miembro.nombre.split(' ')[0]}…`}
            rows={1} className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none"
            style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', maxHeight: 120, lineHeight: '1.4', color: '#1e293b' }}
            onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px' }} />
          <button onClick={enviar} disabled={!texto.trim() || enviando}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
            style={{ background: texto.trim() && !enviando ? '#1e3a5f' : '#e2e8f0', color: texto.trim() && !enviando ? 'white' : '#94a3b8' }}>
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" style={{ transform: 'translateX(1px)' }} />}
          </button>
        </div>
      </div>
    )
  }

  // ── Vista lista ─────────────────────────────────────────────
  return (
    <div style={{ background: '#f0f4f8', minHeight: '100%' }}>
      {/* Header */}
      <div className="px-4 py-4 shadow-sm flex items-center gap-3" style={{ background: '#1e3a5f', color: 'white' }}>
        <div className="flex-1">
          <h1 className="font-bold text-base leading-tight">Mensajes</h1>
          <p className="text-xs opacity-60">{esJefeCentro ? 'Jefe de Centro · Todas las JRVs' : userJrv ? `JRV ${userJrv}` : 'Portal'}</p>
        </div>
        {totalNoLeidos > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#c8a84b', color: '#1e3a5f' }}>{totalNoLeidos}</span>
        )}
      </div>

      <div className="max-w-lg mx-auto pb-4">
        {/* Canal General */}
        <div className="mx-4 mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 ml-1" style={{ color: '#64748b' }}>Canal general</p>
          <button onClick={() => setConversacion({ tipo: 'general' })}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[.98]"
            style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#eff0ff', border: '1.5px solid #c7d2fe' }}>
              <Globe className="w-6 h-6" style={{ color: '#6366f1' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm" style={{ color: '#1e293b' }}>Canal General</p>
              <p className="text-xs truncate mt-0.5" style={{ color: '#64748b' }}>Comunicados de la administración</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {noLeidosGeneral > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center" style={{ background: '#6366f1', color: 'white' }}>{noLeidosGeneral > 9 ? '9+' : noLeidosGeneral}</span>}
              <ChevronRight className="w-4 h-4" style={{ color: '#94a3b8' }} />
            </div>
          </button>
        </div>

        {/* Chat grupal JRV propia */}
        {userJrv && (
          <div className="mx-4 mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2 ml-1" style={{ color: '#64748b' }}>Tu JRV</p>
            <button onClick={() => setConversacion({ tipo: 'grupo', jrv: userJrv })}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[.98]"
              style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(200,168,75,.15)', border: '1.5px solid rgba(200,168,75,.4)' }}>
                <Users className="w-6 h-6" style={{ color: '#c8a84b' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: '#1e293b' }}>JRV {userJrv} — Todos</p>
                <p className="text-xs truncate mt-0.5" style={{ color: '#64748b' }}>{miembros.length + 1} integrante{miembros.length !== 0 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {noLeidosGrupo > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center" style={{ background: '#1e3a5f', color: 'white' }}>{noLeidosGrupo}</span>}
                <ChevronRight className="w-4 h-4" style={{ color: '#94a3b8' }} />
              </div>
            </button>
          </div>
        )}

        {/* Otras JRVs (jefe de centro) */}
        {esJefeCentro && todasJrvs.length > 0 && (
          <div className="mx-4 mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2 ml-1" style={{ color: '#64748b' }}>{userJrv ? 'Otras JRVs' : 'JRVs del Centro'}</p>
            <div className="space-y-2">
              {todasJrvs.sort().map(jrv => {
                const nl = noLeidosJrvs[jrv] ?? 0
                return (
                  <button key={jrv} onClick={() => setConversacion({ tipo: 'grupo', jrv })}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[.98]"
                    style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.07)', border: nl > 0 ? '1.5px solid rgba(200,168,75,.5)' : 'none' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(200,168,75,.1)', border: '1.5px solid rgba(200,168,75,.3)' }}>
                      <Users className="w-6 h-6" style={{ color: '#c8a84b' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: '#1e293b' }}>JRV {jrv} — Todos</p>
                      <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Chat grupal</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {nl > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center" style={{ background: '#c8a84b', color: '#1e3a5f' }}>{nl > 9 ? '9+' : nl}</span>}
                      <ChevronRight className="w-4 h-4" style={{ color: '#94a3b8' }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Conversaciones recientes (DMs iniciados) */}
        {chatsIniciados.length > 0 && (
          <div className="mx-4 mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2 ml-1" style={{ color: '#64748b' }}>Conversaciones recientes</p>
            <div className="space-y-1">
              {chatsIniciados.map(c => {
                const nl = noLeidos[c.id] ?? 0
                const miembro: MiembroJrv = { id: c.id, nombre: c.nombre, cargo: c.cargo, dui: '', foto: c.foto }
                return (
                  <button key={c.id} onClick={() => setConversacion({ tipo: 'dm', miembro })}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all active:scale-[.98]"
                    style={{ background: nl > 0 ? 'rgba(30,58,95,.04)' : 'white', boxShadow: '0 1px 3px rgba(0,0,0,.07)', border: nl > 0 ? '1.5px solid rgba(30,58,95,.15)' : 'none' }}>
                    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm overflow-hidden"
                      style={c.foto ? {} : { background: '#dbeafe', color: '#1e40af' }}>
                      {c.foto ? <img src={c.foto} alt={c.nombre} className="w-full h-full object-cover" /> : iniciales(c.nombre)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="font-semibold text-sm leading-tight truncate" style={{ color: '#1e293b' }}>{c.nombre}</p>
                        <span className="text-[10px] flex-shrink-0" style={{ color: '#94a3b8' }}>{fmtHora(c.ultimaHora)}</span>
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: nl > 0 ? '#1e3a5f' : '#94a3b8', fontWeight: nl > 0 ? 600 : 400 }}>{c.ultimoMsg}</p>
                    </div>
                    {nl > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center flex-shrink-0" style={{ background: '#1e3a5f', color: 'white' }}>{nl}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Todos los miembros — buscador + por JRV */}
        <div className="mx-4 mt-5 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 ml-1" style={{ color: '#64748b' }}>Todos los miembros</p>
          {/* Buscador */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#94a3b8' }} />
            <input type="text" value={busquedaDM} onChange={e => setBusquedaDM(e.target.value)}
              placeholder="Buscar por nombre o cargo…"
              className="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl outline-none"
              style={{ background: 'white', border: '1px solid #e2e8f0', color: '#1e293b' }} />
            {busquedaDM && (
              <button onClick={() => setBusquedaDM('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: '#94a3b8' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {todosUsuarios.length === 0
            ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: '#94a3b8' }} /></div>
            : (() => {
              const q = busquedaDM.trim().toLowerCase()
              const filtrados = q
                ? todosUsuarios.filter(u => u.nombre.toLowerCase().includes(q) || u.cargo.toLowerCase().includes(q))
                : todosUsuarios

              if (filtrados.length === 0) return (
                <p className="text-center text-sm py-8" style={{ color: '#94a3b8' }}>Sin resultados para &ldquo;{busquedaDM}&rdquo;</p>
              )

              if (q) {
                // Búsqueda activa: lista plana
                return (
                  <div className="space-y-1">
                    {filtrados.map(u => {
                      const nl = noLeidos[u.id] ?? 0
                      const miembro: MiembroJrv = { id: u.id, nombre: u.nombre, cargo: u.cargo, dui: '', foto: u.foto }
                      return (
                        <button key={u.id} onClick={() => setConversacion({ tipo: 'dm', miembro })}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all active:scale-[.98]"
                          style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm overflow-hidden"
                            style={u.foto ? {} : { background: '#dbeafe', color: '#1e40af' }}>
                            {u.foto ? <img src={u.foto} alt={u.nombre} className="w-full h-full object-cover" /> : iniciales(u.nombre)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm leading-tight" style={{ color: '#1e293b' }}>{u.nombre}</p>
                            <p className="text-xs mt-0.5 truncate" style={{ color: '#64748b' }}>
                              {u.cargo}{u.jrv ? ` · JRV ${u.jrv}` : ''}
                            </p>
                          </div>
                          {nl > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center flex-shrink-0" style={{ background: '#1e3a5f', color: 'white' }}>{nl}</span>}
                          <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#94a3b8' }} />
                        </button>
                      )
                    })}
                  </div>
                )
              }

              // Sin búsqueda: agrupados por JRV
              const sinJrv = filtrados.filter(u => !u.jrv)
              const porJrv: Record<string, typeof filtrados> = {}
              for (const u of filtrados) if (u.jrv) { if (!porJrv[u.jrv]) porJrv[u.jrv] = []; porJrv[u.jrv].push(u) }
              const jrvsOrdenadas = Object.keys(porJrv).sort((a, b) => a.localeCompare(b, 'es'))

              function FilaUsuario({ u }: { u: typeof filtrados[0] }) {
                const nl = noLeidos[u.id] ?? 0
                const miembro: MiembroJrv = { id: u.id, nombre: u.nombre, cargo: u.cargo, dui: '', foto: u.foto }
                return (
                  <button onClick={() => setConversacion({ tipo: 'dm', miembro })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all active:scale-[.98]"
                    style={{ background: nl > 0 ? 'rgba(30,58,95,.04)' : 'white', border: nl > 0 ? '1px solid rgba(30,58,95,.15)' : '1px solid transparent' }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs overflow-hidden"
                      style={u.foto ? {} : { background: '#dbeafe', color: '#1e40af' }}>
                      {u.foto ? <img src={u.foto} alt={u.nombre} className="w-full h-full object-cover" /> : iniciales(u.nombre)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight" style={{ color: '#1e293b' }}>{u.nombre}</p>
                      <p className="text-xs truncate" style={{ color: '#64748b' }}>{u.cargo}</p>
                    </div>
                    {nl > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#1e3a5f', color: 'white' }}>{nl}</span>}
                    <MessageCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#94a3b8' }} />
                  </button>
                )
              }

              return (
                <div className="space-y-3">
                  {jrvsOrdenadas.map(jrv => {
                    const abierta = jrvsExpandidas[jrv] !== false // default open
                    const nlJrv = porJrv[jrv].reduce((a, u) => a + (noLeidos[u.id] ?? 0), 0)
                    return (
                      <div key={jrv} className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                        <button onClick={() => setJrvsExpandidas(prev => ({ ...prev, [jrv]: !abierta }))}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left"
                          style={{ borderBottom: abierta ? '1px solid #f1f5f9' : 'none' }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(200,168,75,.15)', border: '1.5px solid rgba(200,168,75,.4)' }}>
                            <Users className="w-4 h-4" style={{ color: '#c8a84b' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm" style={{ color: '#1e293b' }}>JRV {jrv}</p>
                            <p className="text-xs" style={{ color: '#64748b' }}>{porJrv[jrv].length} integrante{porJrv[jrv].length !== 1 ? 's' : ''}</p>
                          </div>
                          {nlJrv > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#c8a84b', color: '#1e3a5f' }}>{nlJrv}</span>}
                          {abierta ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: '#94a3b8' }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: '#94a3b8' }} />}
                        </button>
                        {abierta && (
                          <div className="divide-y" style={{ borderColor: '#f8fafc' }}>
                            {porJrv[jrv].map(u => <FilaUsuario key={u.id} u={u} />)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {sinJrv.length > 0 && (
                    <div className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <User className="w-4 h-4" style={{ color: '#94a3b8' }} />
                        <p className="text-xs font-semibold" style={{ color: '#64748b' }}>Sin JRV asignada</p>
                      </div>
                      <div className="divide-y" style={{ borderColor: '#f8fafc' }}>
                        {sinJrv.map(u => <FilaUsuario key={u.id} u={u} />)}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()
          }
        </div>
      </div>
    </div>
  )
}
