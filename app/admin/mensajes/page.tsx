'use client'

import { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, Send, Users, MessageCircle, ChevronRight,
  Loader2, Globe, ShieldAlert
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Tipos ────────────────────────────────────────────────────
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
  autor_rol: string
  contenido: string
  created_at: string
}

type ChatActivo =
  | { tipo: 'general' }
  | { tipo: 'jrv'; jrv: string }

// ── Helpers ──────────────────────────────────────────────────
function fmtHora(iso: string) {
  const d = new Date(iso)
  const hoy = new Date().toDateString() === d.toDateString()
  if (hoy) return d.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-SV', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function iniciales(nombre: string) {
  return nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

const ADMIN_ID = 'admin'
const ADMIN_NOMBRE = 'Administrador'

// ── Componente ───────────────────────────────────────────────
export default function AdminMensajesPage() {
  const [jrvs, setJrvs] = useState<string[]>([])
  const [chat, setChat] = useState<ChatActivo | null>(null)

  const [msgsGeneral, setMsgsGeneral] = useState<MensajeGeneral[]>([])
  const [msgsJrv, setMsgsJrv] = useState<MensajeJrv[]>([])

  // Contadores no leídos
  const [nlGeneral, setNlGeneral] = useState(0)
  const [nlJrv, setNlJrv] = useState<Record<string, number>>({})

  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const lastReadGeneral = useRef<string>(
    typeof window !== 'undefined'
      ? localStorage.getItem('adminLastReadGeneral') ?? new Date(0).toISOString()
      : new Date(0).toISOString()
  )
  const lastReadJrv = useRef<Record<string, string>>(
    typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('adminLastReadJrv') ?? '{}')
      : {}
  )

  // ── Cargar JRVs disponibles ───────────────────────────────
  useEffect(() => {
    supabase
      .from('usuarios')
      .select('jrv')
      .not('jrv', 'is', null)
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((u: any) => u.jrv as string).filter(Boolean))].sort()
        setJrvs(unique)
      })
  }, [])

  // ── Calcular no leídos iniciales ──────────────────────────
  useEffect(() => {
    // General
    supabase
      .from('mensajes_general')
      .select('*', { count: 'exact', head: true })
      .neq('autor_id', ADMIN_ID)
      .gt('created_at', lastReadGeneral.current)
      .then(({ count }) => setNlGeneral(count ?? 0))
  }, [])

  useEffect(() => {
    if (jrvs.length === 0) return
    // Por JRV — mensajes de colaboradores no leídos
    jrvs.forEach(jrv => {
      const lastRead = lastReadJrv.current[jrv] ?? new Date(0).toISOString()
      supabase
        .from('mensajes_jrv')
        .select('*', { count: 'exact', head: true })
        .eq('jrv', jrv)
        .neq('autor_id', ADMIN_ID)
        .gt('created_at', lastRead)
        .then(({ count }) => {
          if ((count ?? 0) > 0) setNlJrv(prev => ({ ...prev, [jrv]: count ?? 0 }))
        })
    })
  }, [jrvs])

  // ── Scroll al fondo ───────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgsGeneral, msgsJrv])

  // ── Cargar mensajes del chat activo ───────────────────────
  useEffect(() => {
    if (!chat) return
    setCargando(true)

    if (chat.tipo === 'general') {
      supabase
        .from('mensajes_general')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(150)
        .then(({ data }) => {
          setMsgsGeneral((data ?? []) as MensajeGeneral[])
          setCargando(false)
          const ahora = new Date().toISOString()
          lastReadGeneral.current = ahora
          localStorage.setItem('adminLastReadGeneral', ahora)
          setNlGeneral(0)
        })
    } else {
      supabase
        .from('mensajes_jrv')
        .select('*')
        .eq('jrv', chat.jrv)
        .order('created_at', { ascending: true })
        .limit(150)
        .then(({ data }) => {
          setMsgsJrv((data ?? []) as MensajeJrv[])
          setCargando(false)
          const ahora = new Date().toISOString()
          lastReadJrv.current[chat.jrv] = ahora
          localStorage.setItem('adminLastReadJrv', JSON.stringify(lastReadJrv.current))
          setNlJrv(prev => ({ ...prev, [chat.jrv]: 0 }))
        })
    }
  }, [chat])

  // ── Realtime ──────────────────────────────────────────────
  useEffect(() => {
    // Chat general
    const chanGeneral = supabase
      .channel('admin-general-msgs')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensajes_general',
      }, (payload) => {
        const msg = payload.new as MensajeGeneral
        if (chat?.tipo === 'general') {
          setMsgsGeneral(prev => [...prev, msg])
          const ahora = new Date().toISOString()
          lastReadGeneral.current = ahora
          localStorage.setItem('adminLastReadGeneral', ahora)
        } else if (msg.autor_id !== ADMIN_ID) {
          setNlGeneral(prev => prev + 1)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(chanGeneral) }
  }, [chat])

  useEffect(() => {
    if (jrvs.length === 0) return
    // Mensajes de JRVs
    const channels = jrvs.map(jrv =>
      supabase
        .channel(`admin-jrv-${jrv}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'mensajes_jrv',
          filter: `jrv=eq.${jrv}`,
        }, (payload) => {
          const msg = payload.new as MensajeJrv
          if (chat?.tipo === 'jrv' && chat.jrv === jrv) {
            setMsgsJrv(prev => [...prev, msg])
            const ahora = new Date().toISOString()
            lastReadJrv.current[jrv] = ahora
            localStorage.setItem('adminLastReadJrv', JSON.stringify(lastReadJrv.current))
          } else if (msg.autor_id !== ADMIN_ID) {
            setNlJrv(prev => ({ ...prev, [jrv]: (prev[jrv] ?? 0) + 1 }))
          }
        })
        .subscribe()
    )
    return () => { channels.forEach(c => supabase.removeChannel(c)) }
  }, [jrvs, chat])

  // ── Enviar ────────────────────────────────────────────────
  async function enviar() {
    if (!texto.trim() || !chat || enviando) return
    const contenido = texto.trim()
    setTexto('')
    setEnviando(true)

    if (chat.tipo === 'general') {
      const { data } = await supabase.from('mensajes_general').insert({
        autor_id: ADMIN_ID,
        autor_nombre: ADMIN_NOMBRE,
        autor_rol: 'admin',
        contenido,
      }).select().single()
      if (data) setMsgsGeneral(prev => [...prev, data as MensajeGeneral])
    } else {
      const { data } = await supabase.from('mensajes_jrv').insert({
        jrv: chat.jrv,
        autor_id: ADMIN_ID,
        autor_nombre: ADMIN_NOMBRE,
        autor_rol: 'admin',
        contenido,
      }).select().single()
      if (data) setMsgsJrv(prev => [...prev, data as MensajeJrv])
    }
    setEnviando(false)
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  const totalNl = nlGeneral + Object.values(nlJrv).reduce((a, b) => a + b, 0)

  // ── Render chat activo ────────────────────────────────────
  if (chat) {
    const titulo = chat.tipo === 'general' ? 'Chat General' : `JRV ${chat.jrv}`
    const subtitulo = chat.tipo === 'general' ? 'Todos los colaboradores' : `Chat grupal JRV ${chat.jrv}`
    const msgs: (MensajeGeneral | MensajeJrv)[] = chat.tipo === 'general' ? msgsGeneral : msgsJrv

    function esAdmin(msg: MensajeGeneral | MensajeJrv) {
      return msg.autor_id === ADMIN_ID || msg.autor_rol === 'admin'
    }

    return (
      <div className="flex flex-col h-[calc(100vh-56px)]" style={{ background: '#f0f4f8' }}>
        {/* Header chat */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 shadow-sm"
          style={{ background: 'white', borderBottom: '1px solid #e2e8f0' }}>
          <button onClick={() => setChat(null)}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: chat.tipo === 'general' ? '#eff6ff' : '#f0fdf4',
              border: `1.5px solid ${chat.tipo === 'general' ? '#bfdbfe' : '#bbf7d0'}`,
            }}>
            {chat.tipo === 'general'
              ? <Globe className="w-5 h-5 text-blue-500" />
              : <Users className="w-5 h-5 text-green-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 leading-tight truncate">{titulo}</p>
            <p className="text-xs text-gray-400 truncate">{subtitulo}</p>
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
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-100">
                <MessageCircle className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400 font-medium">Sin mensajes aún</p>
              <p className="text-xs text-gray-300">Podés escribir el primero. 👇</p>
            </div>
          )}

          {msgs.map((msg, i) => {
            const mio = msg.autor_id === ADMIN_ID
            const esAdminMsg = esAdmin(msg)
            const anterior = msgs[i - 1]
            const mismoAutor = anterior && anterior.autor_id === msg.autor_id
            const nombre = msg.autor_nombre

            return (
              <div key={msg.id} className={`flex ${mio ? 'justify-end' : 'justify-start'} ${mismoAutor ? 'mt-0.5' : 'mt-3'}`}>
                {!mio && !mismoAutor && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mr-2 mt-0.5"
                    style={{
                      background: esAdminMsg ? '#eff6ff' : '#f0fdf4',
                      color: esAdminMsg ? '#1d4ed8' : '#15803d',
                      border: `1px solid ${esAdminMsg ? '#bfdbfe' : '#bbf7d0'}`,
                    }}>
                    {esAdminMsg ? <ShieldAlert className="w-3.5 h-3.5" /> : iniciales(nombre)}
                  </div>
                )}
                {!mio && mismoAutor && <div className="w-7 mr-2 flex-shrink-0" />}

                <div className={`max-w-[75%] flex flex-col ${mio ? 'items-end' : 'items-start'}`}>
                  {!mismoAutor && !mio && (
                    <span className="text-xs font-semibold mb-0.5 ml-1"
                      style={{ color: esAdminMsg ? '#1d4ed8' : '#15803d' }}>
                      {nombre}
                      {esAdminMsg && <span className="ml-1 text-[9px] font-medium px-1 py-0.5 rounded"
                        style={{ background: '#eff6ff', color: '#3b82f6' }}>Admin</span>}
                    </span>
                  )}
                  <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${mio ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                    style={{
                      background: mio
                        ? '#1e3a5f'
                        : esAdminMsg ? '#eff6ff' : 'white',
                      color: mio ? 'white' : '#1e293b',
                      boxShadow: '0 1px 2px rgba(0,0,0,.07)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                    {msg.contenido}
                  </div>
                  <span className="text-[10px] mt-0.5 mx-1 text-slate-400">
                    {fmtHora(msg.created_at)}
                  </span>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-3 py-3 flex items-end gap-2 bg-white"
          style={{ borderTop: '1px solid #e2e8f0' }}>
          <textarea
            ref={inputRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={chat.tipo === 'general'
              ? 'Escribí un mensaje para todos los colaboradores…'
              : `Escribí a la JRV ${chat.jrv}…`}
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

  // ── Vista lista ───────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--texto)' }}>Mensajes</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--texto-muted)' }}>
            Comunicación con los colaboradores
          </p>
        </div>
        {totalNl > 0 && (
          <span className="text-sm font-bold px-3 py-1 rounded-full"
            style={{ background: '#1e3a5f', color: 'white' }}>
            {totalNl} no leído{totalNl !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Chat General */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2"
          style={{ color: 'var(--texto-muted)' }}>Canal general</p>
        <button
          onClick={() => setChat({ tipo: 'general' })}
          className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:shadow-md active:scale-[.99]"
          style={{ background: 'var(--card)', border: '1px solid var(--borde)' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe' }}>
            <Globe className="w-6 h-6 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: 'var(--texto)' }}>Chat General</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>
              Todos los colaboradores del centro
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {nlGeneral > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#1e3a5f', color: 'white', minWidth: 22, textAlign: 'center' }}>
                {nlGeneral > 9 ? '9+' : nlGeneral}
              </span>
            )}
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--texto-muted)' }} />
          </div>
        </button>
      </section>

      {/* Chats por JRV */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2"
          style={{ color: 'var(--texto-muted)' }}>Chats por JRV</p>

        {jrvs.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--texto-muted)' }} />
          </div>
        ) : (
          <div className="space-y-2">
            {jrvs.map(jrv => {
              const nl = nlJrv[jrv] ?? 0
              return (
                <button
                  key={jrv}
                  onClick={() => setChat({ tipo: 'jrv', jrv })}
                  className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:shadow-md active:scale-[.99]"
                  style={{ background: 'var(--card)', border: `1px solid ${nl > 0 ? '#86efac' : 'var(--borde)'}` }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                    style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', color: '#15803d' }}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--texto)' }}>JRV {jrv}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>
                      Chat grupal de la JRV
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {nl > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: '#15803d', color: 'white', minWidth: 22, textAlign: 'center' }}>
                        {nl > 9 ? '9+' : nl}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4" style={{ color: 'var(--texto-muted)' }} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
