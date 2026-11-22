'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ArrowLeft, Send, Users, MessageCircle, ChevronRight,
  Loader2, RefreshCw, Globe, ShieldAlert
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Tipos ────────────────────────────────────────────────────
interface Usuario {
  id: string
  nombre: string
  dui: string
  jrv: string
  cargo?: string
  rol?: string
}

interface MiembroJrv {
  id: string
  nombre: string
  cargo: string
  dui: string
}

interface MensajeGeneral {
  id: string
  autor_id: string
  autor_nombre: string
  autor_rol: string
  contenido: string
  created_at: string
}

interface MensajeJrv {
  id: string
  jrv: string
  autor_id: string
  autor_nombre: string
  autor_rol?: string
  contenido: string
  created_at: string
}

interface MensajeDirecto {
  id: string
  remitente_id: string
  destinatario_id: string
  remitente_nombre: string
  contenido: string
  leido: boolean
  created_at: string
}

type Conversacion =
  | { tipo: 'general' }
  | { tipo: 'grupo'; jrv: string }
  | { tipo: 'dm'; miembro: MiembroJrv }

// ── Helpers ──────────────────────────────────────────────────
function getLastReadGrupo(jrv: string): string {
  if (typeof window === 'undefined') return new Date(0).toISOString()
  return localStorage.getItem(`lastReadGrupo_${jrv}`)
    ?? localStorage.getItem('lastReadGrupo')
    ?? new Date(0).toISOString()
}
function setLastReadGrupoLS(jrv: string, ts: string) {
  if (typeof window !== 'undefined') localStorage.setItem(`lastReadGrupo_${jrv}`, ts)
}

function fmtHora(iso: string) {
  const d = new Date(iso)
  const ahora = new Date()
  const hoy = ahora.toDateString() === d.toDateString()
  if (hoy) return d.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-SV', { day: 'numeric', month: 'short' })
}

function iniciales(nombre: string) {
  return nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

// ── Componente principal ─────────────────────────────────────
export default function MensajesPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [miembros, setMiembros] = useState<MiembroJrv[]>([])
  const [conversacion, setConversacion] = useState<Conversacion | null>(null)

  // Mensajes
  const [mensajesGeneral, setMensajesGeneral] = useState<MensajeGeneral[]>([])
  const [mensajesGrupo, setMensajesGrupo] = useState<MensajeJrv[]>([])
  const [mensajesDm, setMensajesDm] = useState<MensajeDirecto[]>([])

  // No leídos
  const [noLeidosGeneral, setNoLeidosGeneral] = useState(0)
  const [noLeidos, setNoLeidos] = useState<Record<string, number>>({})
  const [noLeidosGrupo, setNoLeidosGrupo] = useState(0)
  const [noLeidosJrvs, setNoLeidosJrvs] = useState<Record<string, number>>({})
  const [todasJrvs, setTodasJrvs] = useState<string[]>([])

  const lastReadGeneralRef = useRef<string>(
    typeof window !== 'undefined'
      ? localStorage.getItem('lastReadGeneral') ?? new Date(0).toISOString()
      : new Date(0).toISOString()
  )

  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastReadGrupoRef = useRef<string>(new Date(0).toISOString())

  // ── Cargar usuario desde sessionStorage ──────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = sessionStorage.getItem('portal_usuario')
    if (!raw) { window.location.href = '/portal'; return }
    try { setUsuario(JSON.parse(raw)) } catch { window.location.href = '/portal' }
  }, [])

  // ── Cargar miembros de la JRV ─────────────────────────────
  useEffect(() => {
    if (!usuario) return
    supabase
      .from('usuarios')
      .select('id, nombre, cargo, dui')
      .eq('jrv', usuario.jrv)
      .neq('id', usuario.id)
      .order('nombre')
      .then(({ data }) => setMiembros((data ?? []) as MiembroJrv[]))

    // Si es jefe de centro → cargar todas las JRVs distintas
    const esJefe = usuario.cargo?.toLowerCase().includes('jefe') || usuario.rol === 'jefe_centro'
    if (esJefe) {
      supabase
        .from('usuarios')
        .select('jrv')
        .neq('jrv', usuario.jrv)
        .then(({ data }) => {
          const jrvs = Array.from(new Set((data ?? []).map((r: { jrv: string }) => r.jrv).filter(Boolean) as string[]))
          setTodasJrvs(jrvs)
        })
    }
  }, [usuario])

  // ── Calcular no leídos iniciales ──────────────────────────
  const calcularNoLeidos = useCallback(async (usr: Usuario) => {
    // General no leídos
    const { count: cg } = await supabase
      .from('mensajes_general')
      .select('*', { count: 'exact', head: true })
      .neq('autor_id', usr.id)
      .gt('created_at', lastReadGeneralRef.current)
    setNoLeidosGeneral(cg ?? 0)

    // DMs no leídos por remitente
    const { data } = await supabase
      .from('mensajes_directos')
      .select('remitente_id')
      .eq('destinatario_id', usr.id)
      .eq('leido', false)

    const counts: Record<string, number> = {}
    for (const m of data ?? []) {
      counts[m.remitente_id] = (counts[m.remitente_id] ?? 0) + 1
    }
    setNoLeidos(counts)

    // Grupo no leídos (JRV propia)
    const { count } = await supabase
      .from('mensajes_jrv')
      .select('*', { count: 'exact', head: true })
      .eq('jrv', usr.jrv)
      .neq('autor_id', usr.id)
      .gt('created_at', getLastReadGrupo(usr.jrv))
    setNoLeidosGrupo(count ?? 0)
  }, []) // eslint-disable-line

  // ── No leídos para otras JRVs (jefe de centro) ───────────
  useEffect(() => {
    if (!usuario || todasJrvs.length === 0) return
    Promise.all(
      todasJrvs.map(async jrv => {
        const { count } = await supabase
          .from('mensajes_jrv')
          .select('*', { count: 'exact', head: true })
          .eq('jrv', jrv)
          .neq('autor_id', usuario.id)
          .gt('created_at', getLastReadGrupo(jrv))
        return [jrv, count ?? 0] as [string, number]
      })
    ).then(results => {
      const counts: Record<string, number> = {}
      for (const [jrv, c] of results) counts[jrv] = c
      setNoLeidosJrvs(counts)
    })
  }, [usuario, todasJrvs])

  useEffect(() => {
    if (usuario) calcularNoLeidos(usuario)
  }, [usuario, calcularNoLeidos])

  // ── Scroll al fondo ───────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajesGrupo, mensajesDm])

  // ── Cargar mensajes de la conversación activa ─────────────
  useEffect(() => {
    if (!conversacion || !usuario) return
    setCargando(true)

    if (conversacion.tipo === 'general') {
      supabase
        .from('mensajes_general')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(150)
        .then(({ data }) => {
          setMensajesGeneral((data ?? []) as MensajeGeneral[])
          setCargando(false)
          const ahora = new Date().toISOString()
          lastReadGeneralRef.current = ahora
          localStorage.setItem('lastReadGeneral', ahora)
          setNoLeidosGeneral(0)
        })
    } else if (conversacion.tipo === 'grupo') {
      supabase
        .from('mensajes_jrv')
        .select('*')
        .eq('jrv', conversacion.jrv)
        .order('created_at', { ascending: true })
        .limit(100)
        .then(({ data }) => {
          setMensajesGrupo((data ?? []) as MensajeJrv[])
          setCargando(false)
          // Marcar como leído
          const ahora = new Date().toISOString()
          lastReadGrupoRef.current = ahora
          setLastReadGrupoLS(conversacion.jrv, ahora)
          if (conversacion.jrv === usuario.jrv) {
            setNoLeidosGrupo(0)
          } else {
            setNoLeidosJrvs(prev => ({ ...prev, [conversacion.jrv]: 0 }))
          }
        })
    } else {
      const otherId = conversacion.miembro.id
      supabase
        .from('mensajes_directos')
        .select('*')
        .or(
          `and(remitente_id.eq.${usuario.id},destinatario_id.eq.${otherId}),` +
          `and(remitente_id.eq.${otherId},destinatario_id.eq.${usuario.id})`
        )
        .order('created_at', { ascending: true })
        .limit(100)
        .then(async ({ data }) => {
          setMensajesDm((data ?? []) as MensajeDirecto[])
          setCargando(false)
          // Marcar como leídos
          await supabase
            .from('mensajes_directos')
            .update({ leido: true })
            .eq('destinatario_id', usuario.id)
            .eq('remitente_id', otherId)
            .eq('leido', false)
          setNoLeidos(prev => ({ ...prev, [otherId]: 0 }))
        })
    }
  }, [conversacion, usuario])

  // ── Suscripción realtime ──────────────────────────────────
  useEffect(() => {
    if (!usuario) return

    // General
    const chanGeneral = supabase
      .channel(`general-mensajes-${usuario.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensajes_general',
      }, (payload) => {
        const msg = payload.new as MensajeGeneral
        if (conversacion?.tipo === 'general') {
          setMensajesGeneral(prev => [...prev, msg])
          const ahora = new Date().toISOString()
          lastReadGeneralRef.current = ahora
          localStorage.setItem('lastReadGeneral', ahora)
        } else if (msg.autor_id !== usuario.id) {
          setNoLeidosGeneral(prev => prev + 1)
        }
      })
      .subscribe()

    // Grupo (JRV propia)
    const chanGrupo = supabase
      .channel(`jrv-mensajes-${usuario.jrv}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensajes_jrv',
        filter: `jrv=eq.${usuario.jrv}`,
      }, (payload) => {
        const msg = payload.new as MensajeJrv
        if (conversacion?.tipo === 'grupo' && conversacion.jrv === usuario.jrv) {
          setMensajesGrupo(prev => [...prev, msg])
          const ahora = new Date().toISOString()
          lastReadGrupoRef.current = ahora
          setLastReadGrupoLS(usuario.jrv, ahora)
        } else if (msg.autor_id !== usuario.id) {
          setNoLeidosGrupo(prev => prev + 1)
        }
      })
      .subscribe()

    // DMs entrantes
    const chanDm = supabase
      .channel(`dm-para-${usuario.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensajes_directos',
        filter: `destinatario_id=eq.${usuario.id}`,
      }, (payload) => {
        const msg = payload.new as MensajeDirecto
        if (conversacion?.tipo === 'dm' && conversacion.miembro.id === msg.remitente_id) {
          setMensajesDm(prev => [...prev, msg])
          // Marcar leído inmediatamente
          supabase.from('mensajes_directos').update({ leido: true }).eq('id', msg.id)
        } else {
          setNoLeidos(prev => ({ ...prev, [msg.remitente_id]: (prev[msg.remitente_id] ?? 0) + 1 }))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(chanGeneral)
      supabase.removeChannel(chanGrupo)
      supabase.removeChannel(chanDm)
    }
  }, [usuario, conversacion])

  // ── Realtime para otras JRVs (jefe de centro) ────────────
  useEffect(() => {
    if (!usuario || todasJrvs.length === 0) return
    const channels = todasJrvs.map(jrv =>
      supabase
        .channel(`jrv-jefe-${jrv}-${usuario.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'mensajes_jrv',
          filter: `jrv=eq.${jrv}`,
        }, (payload) => {
          const msg = payload.new as MensajeJrv
          if (conversacion?.tipo === 'grupo' && conversacion.jrv === jrv) {
            setMensajesGrupo(prev => [...prev, msg])
            const ahora = new Date().toISOString()
            setLastReadGrupoLS(jrv, ahora)
            setNoLeidosJrvs(prev => ({ ...prev, [jrv]: 0 }))
          } else if (msg.autor_id !== usuario.id) {
            setNoLeidosJrvs(prev => ({ ...prev, [jrv]: (prev[jrv] ?? 0) + 1 }))
          }
        })
        .subscribe()
    )
    return () => { channels.forEach(ch => supabase.removeChannel(ch)) }
  }, [usuario, todasJrvs])

  // ── Enviar mensaje ────────────────────────────────────────
  async function enviar() {
    if (!texto.trim() || !usuario || !conversacion || enviando) return
    const contenido = texto.trim()
    setTexto('')
    setEnviando(true)

    if (conversacion.tipo === 'general') {
      const { data } = await supabase.from('mensajes_general').insert({
        autor_id: usuario.id,
        autor_nombre: usuario.nombre,
        autor_rol: 'colaborador',
        contenido,
      }).select().single()
      if (data) setMensajesGeneral(prev => [...prev, data as MensajeGeneral])
    } else if (conversacion.tipo === 'grupo') {
      const { data } = await supabase.from('mensajes_jrv').insert({
        jrv: conversacion.jrv,
        autor_id: usuario.id,
        autor_nombre: usuario.nombre,
        autor_rol: 'colaborador',
        contenido,
      }).select().single()
      if (data) setMensajesGrupo(prev => [...prev, data as MensajeJrv])
    } else {
      const { data } = await supabase.from('mensajes_directos').insert({
        remitente_id: usuario.id,
        destinatario_id: conversacion.miembro.id,
        remitente_nombre: usuario.nombre,
        contenido,
      }).select().single()
      if (data) setMensajesDm(prev => [...prev, data as MensajeDirecto])
    }
    setEnviando(false)
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  // ── Vista lista (sin conversación activa) ─────────────────
  if (!usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    )
  }

  const esJefeCentro = !!(usuario.cargo?.toLowerCase().includes('jefe') || usuario.rol === 'jefe_centro')
  const totalNoLeidos = Object.values(noLeidos).reduce((a, b) => a + b, 0) + noLeidosGrupo + noLeidosGeneral + Object.values(noLeidosJrvs).reduce((a, b) => a + b, 0)

  // ── Vista chat activo ─────────────────────────────────────
  if (conversacion) {
    const titulo = conversacion.tipo === 'general'
      ? 'Canal General'
      : conversacion.tipo === 'grupo'
        ? `JRV ${conversacion.jrv} · Chat grupal`
        : conversacion.miembro.nombre
    const subtitulo = conversacion.tipo === 'general'
      ? 'Comunicación con la administración'
      : conversacion.tipo === 'grupo'
        ? conversacion.jrv === usuario.jrv
          ? `${miembros.length + 1} integrantes`
          : `Chat grupal JRV ${conversacion.jrv}`
        : conversacion.miembro.cargo

    const msgs: (MensajeGeneral | MensajeJrv | MensajeDirecto)[] =
      conversacion.tipo === 'general' ? mensajesGeneral
        : conversacion.tipo === 'grupo' ? mensajesGrupo
        : mensajesDm

    function esMio(msg: MensajeGeneral | MensajeJrv | MensajeDirecto) {
      if (conversacion!.tipo === 'dm') return (msg as MensajeDirecto).remitente_id === usuario!.id
      return (msg as MensajeGeneral | MensajeJrv).autor_id === usuario!.id
    }
    function nombreMsg(msg: MensajeGeneral | MensajeJrv | MensajeDirecto) {
      if (conversacion!.tipo === 'dm') return (msg as MensajeDirecto).remitente_nombre
      return (msg as MensajeGeneral | MensajeJrv).autor_nombre
    }
    function esAdminMsg(msg: MensajeGeneral | MensajeJrv | MensajeDirecto) {
      const m = msg as any
      return m.autor_rol === 'admin' || m.autor_id === 'admin'
    }

    return (
      <div className="flex flex-col h-screen" style={{ background: '#f0f4f8' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 shadow-sm flex-shrink-0"
          style={{ background: '#1e3a5f', color: 'white' }}>
          <button onClick={() => setConversacion(null)}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs"
            style={{
              background: conversacion.tipo === 'general' ? 'rgba(99,102,241,.3)'
                : conversacion.tipo === 'grupo' ? 'rgba(200,168,75,.3)' : 'rgba(255,255,255,.15)',
              border: conversacion.tipo === 'general' ? '1px solid rgba(99,102,241,.5)'
                : conversacion.tipo === 'grupo' ? '1px solid rgba(200,168,75,.5)' : '1px solid rgba(255,255,255,.2)',
              color: conversacion.tipo === 'general' ? '#c7d2fe'
                : conversacion.tipo === 'grupo' ? '#c8a84b' : 'white',
            }}>
            {conversacion.tipo === 'general'
              ? <Globe className="w-4 h-4" />
              : conversacion.tipo === 'grupo'
                ? <Users className="w-4 h-4" />
                : iniciales(conversacion.miembro.nombre)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{titulo}</p>
            <p className="text-xs opacity-60 truncate">{subtitulo}</p>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {cargando && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            </div>
          )}

          {!cargando && msgs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: '#e2e8f0' }}>
                <MessageCircle className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Ningún mensaje aún</p>
              <p className="text-xs text-gray-400">
                {conversacion.tipo === 'grupo'
                  ? '¡Sé el primero en escribir al grupo!'
                  : `Iniciá la conversación con ${conversacion.miembro.nombre.split(' ')[0]}.`}
              </p>
            </div>
          )}

          {msgs.map((msg, i) => {
            const mio = esMio(msg)
            const nombre = nombreMsg(msg)
            const admin = esAdminMsg(msg)
            const anterior = msgs[i - 1]
            const mismoAutor = anterior && nombreMsg(anterior) === nombre && esMio(anterior) === mio
            const mostrarNombre = !mio && !mismoAutor && (conversacion.tipo === 'grupo' || conversacion.tipo === 'general')
            return (
              <div key={msg.id} className={`flex ${mio ? 'justify-end' : 'justify-start'} ${mismoAutor ? 'mt-0.5' : 'mt-3'}`}>
                {!mio && !mismoAutor && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mr-2 mt-0.5"
                    style={admin
                      ? { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }
                      : { background: '#dbeafe', color: '#1e40af' }}>
                    {admin ? <ShieldAlert className="w-3.5 h-3.5" /> : iniciales(nombre)}
                  </div>
                )}
                {!mio && mismoAutor && <div className="w-7 mr-2 flex-shrink-0" />}
                <div className={`max-w-[75%] ${mio ? 'items-end' : 'items-start'} flex flex-col`}>
                  {mostrarNombre && (
                    <span className="text-xs font-semibold mb-0.5 ml-1 flex items-center gap-1"
                      style={{ color: admin ? '#1d4ed8' : '#1e40af' }}>
                      {nombre}
                      {admin && <span className="text-[9px] px-1 py-0.5 rounded font-medium"
                        style={{ background: '#eff6ff', color: '#3b82f6' }}>Admin</span>}
                    </span>
                  )}
                  <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${mio
                    ? 'rounded-br-sm text-white'
                    : 'rounded-bl-sm text-gray-800'}`}
                    style={{
                      background: mio ? '#1e3a5f' : admin ? '#eff6ff' : 'white',
                      boxShadow: '0 1px 2px rgba(0,0,0,.08)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                    {msg.contenido}
                  </div>
                  <span className="text-[10px] mt-0.5 mx-1" style={{ color: '#94a3b8' }}>
                    {fmtHora(msg.created_at)}
                    {mio && conversacion.tipo === 'dm' && (msg as MensajeDirecto).leido && (
                      <span className="ml-1" style={{ color: '#38bdf8' }}>✓✓</span>
                    )}
                  </span>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-3 py-3 flex items-end gap-2"
          style={{ background: 'white', borderTop: '1px solid #e2e8f0' }}>
          <textarea
            ref={inputRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              conversacion.tipo === 'general' ? 'Escribe un mensaje al canal general…'
                : conversacion.tipo === 'grupo' ? `Escribe al grupo JRV ${conversacion.jrv}…`
                : `Escribe a ${conversacion.miembro.nombre.split(' ')[0]}…`
            }
            rows={1}
            className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none"
            style={{
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              maxHeight: 120,
              lineHeight: '1.4',
              color: '#1e293b',
            }}
            onInput={e => {
              const t = e.currentTarget
              t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={enviar}
            disabled={!texto.trim() || enviando}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              background: texto.trim() && !enviando ? '#1e3a5f' : '#e2e8f0',
              color: texto.trim() && !enviando ? 'white' : '#94a3b8',
            }}>
            {enviando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" style={{ transform: 'translateX(1px)' }} />}
          </button>
        </div>
      </div>
    )
  }

  // ── Vista lista de conversaciones ─────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
      {/* Header */}
      <div className="px-4 py-4 shadow-sm flex items-center gap-3"
        style={{ background: '#1e3a5f', color: 'white' }}>
        <a href="/portal"
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </a>
        <div className="flex-1">
          <h1 className="font-bold text-base leading-tight">Mensajes</h1>
          <p className="text-xs opacity-60">{esJefeCentro ? 'Jefe de Centro · Todas las JRVs' : `JRV ${usuario.jrv}`}</p>
        </div>
        {totalNoLeidos > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: '#c8a84b', color: '#1e3a5f' }}>
            {totalNoLeidos}
          </span>
        )}
      </div>

      <div className="max-w-lg mx-auto">
        {/* Canal General */}
        <div className="mx-4 mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 ml-1" style={{ color: '#64748b' }}>
            Canal general
          </p>
          <button
            onClick={() => setConversacion({ tipo: 'general' })}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[.98]"
            style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#eff0ff', border: '1.5px solid #c7d2fe' }}>
              <Globe className="w-6 h-6" style={{ color: '#6366f1' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm" style={{ color: '#1e293b' }}>Canal General</p>
              <p className="text-xs truncate mt-0.5" style={{ color: '#64748b' }}>
                Comunicados de la administración
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {noLeidosGeneral > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center"
                  style={{ background: '#6366f1', color: 'white' }}>
                  {noLeidosGeneral > 9 ? '9+' : noLeidosGeneral}
                </span>
              )}
              <ChevronRight className="w-4 h-4" style={{ color: '#94a3b8' }} />
            </div>
          </button>
        </div>

        {/* Chat grupal JRV */}
        <div className="mx-4 mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 ml-1" style={{ color: '#64748b' }}>
            Tu JRV
          </p>
          <button
            onClick={() => setConversacion({ tipo: 'grupo', jrv: usuario.jrv })}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[.98]"
            style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(200,168,75,.15)', border: '1.5px solid rgba(200,168,75,.4)' }}>
              <Users className="w-6 h-6" style={{ color: '#c8a84b' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm" style={{ color: '#1e293b' }}>JRV {usuario.jrv} — Todos</p>
              <p className="text-xs truncate mt-0.5" style={{ color: '#64748b' }}>
                {miembros.length + 1} integrante{miembros.length !== 0 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {noLeidosGrupo > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center"
                  style={{ background: '#1e3a5f', color: 'white' }}>
                  {noLeidosGrupo}
                </span>
              )}
              <ChevronRight className="w-4 h-4" style={{ color: '#94a3b8' }} />
            </div>
          </button>
        </div>

        {/* Otras JRVs (solo jefe de centro) */}
        {esJefeCentro && todasJrvs.length > 0 && (
          <div className="mx-4 mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2 ml-1" style={{ color: '#64748b' }}>
              Otras JRVs
            </p>
            <div className="space-y-2">
              {todasJrvs.sort().map(jrv => {
                const nl = noLeidosJrvs[jrv] ?? 0
                return (
                  <button
                    key={jrv}
                    onClick={() => setConversacion({ tipo: 'grupo', jrv })}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[.98]"
                    style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.07)', border: nl > 0 ? '1.5px solid rgba(200,168,75,.5)' : 'none' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(200,168,75,.1)', border: '1.5px solid rgba(200,168,75,.3)' }}>
                      <Users className="w-6 h-6" style={{ color: '#c8a84b' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: '#1e293b' }}>JRV {jrv} — Todos</p>
                      <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Chat grupal</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {nl > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center"
                          style={{ background: '#c8a84b', color: '#1e3a5f' }}>
                          {nl > 9 ? '9+' : nl}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4" style={{ color: '#94a3b8' }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Mensajes directos */}
        <div className="mx-4 mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 ml-1" style={{ color: '#64748b' }}>
            Integrantes de tu JRV
          </p>

          {miembros.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <RefreshCw className="w-6 h-6 text-gray-300" />
              <p className="text-sm text-gray-400">No hay más integrantes registrados en la JRV {usuario.jrv}.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {miembros.map(m => {
                const nl = noLeidos[m.id] ?? 0
                return (
                  <button
                    key={m.id}
                    onClick={() => setConversacion({ tipo: 'dm', miembro: m })}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[.98]"
                    style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                      style={{ background: '#dbeafe', color: '#1e40af' }}>
                      {iniciales(m.nombre)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight" style={{ color: '#1e293b' }}>{m.nombre}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#64748b' }}>{m.cargo}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {nl > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center"
                          style={{ background: '#1e3a5f', color: 'white' }}>
                          {nl}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4" style={{ color: '#94a3b8' }} />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-8 mb-6" style={{ color: '#94a3b8' }}>
          {esJefeCentro
            ? `Acceso a todas las JRVs del centro`
            : `Solo se muestran integrantes de tu JRV ${usuario.jrv}`}
        </p>
      </div>
    </div>
  )
}
