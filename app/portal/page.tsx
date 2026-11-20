'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  User, BookOpen, Calendar, Users, LogOut, Pencil, Save, X, Bus,
  Upload, Camera, FileImage, CheckCircle, AlertTriangle, Download,
  ChevronRight, Plus, Trash2, Clock, MapPin, Tag,
  FileText, Video, File, Music, ShieldAlert, Check, Truck, ClipboardCheck, Loader2,
  MessageCircle
} from 'lucide-react'
import LogoUrna from '@/components/LogoUrna'
import InstallPWA from '@/components/InstallPWA'
import { supabase } from '@/lib/supabase'
import type { RegistroDUI, Padron } from '@/types'

const LOGO_BUCKET = 'fotos-dui'
const LOGO_PATH   = 'configuracion/logo.jpg'

const SESSION_KEY    = 'portal_usuario'
const ADMIN_DUI      = '04325191-7'
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? ''
const ADMIN_SESSION  = 'admin_autenticado'

interface Usuario {
  id: string; nombre: string; dui: string; email: string | null
  telefono: string | null; rol: string; activo: boolean; autorizado: boolean
  registro_dui_id: string | null; foto_perfil_url: string | null
}

interface Material {
  id: string; nombre: string; descripcion: string | null; categoria: string
  archivo_url: string; tipo_mime: string; tamanio: number | null; created_at: string
}


function toNombrePropio(s: string) {
  return s.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '').join(' ')
}

async function hashDUI(dui: string): Promise<string> {
  const data = new TextEncoder().encode(dui)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function descargarArchivo(url: string, nombre: string) {
  const res = await fetch(url)
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombre
  a.click()
  URL.revokeObjectURL(a.href)
}

function formatBytes(b: number | null) {
  if (!b) return ''; if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

function iconoMime(mime: string) {
  if (mime.startsWith('image/')) return <FileImage size={16} style={{ color: '#8b5cf6' }} />
  if (mime.startsWith('video/')) return <Video size={16} style={{ color: '#ef4444' }} />
  if (mime.startsWith('audio/')) return <Music size={16} style={{ color: '#f59e0b' }} />
  if (mime.includes('pdf'))      return <FileText size={16} style={{ color: '#ef4444' }} />
  if (mime.includes('word'))     return <FileText size={16} style={{ color: '#2563eb' }} />
  if (mime.includes('sheet'))    return <FileText size={16} style={{ color: '#16a34a' }} />
  if (mime.includes('presentation')) return <FileText size={16} style={{ color: '#ea580c' }} />
  return <File size={16} style={{ color: 'var(--texto-muted)' }} />
}


type Seccion = 'perfil' | 'jrv' | 'agenda' | 'transporte' | 'materiales' | 'calendario' | 'asistencia'

/* ── Componente de sección Asistencia ── */
function AsistenciaSection({ dui, registroId }: { dui: string; registroId: string | null }) { // registroId = registros_dui.id (registro_dui_id)
  const [actividades, setActividades] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [score, setScore] = useState<{ asistidas: number; total: number } | null>(null)

  useEffect(() => {
    const hoy = new Date().toISOString().slice(0, 10)
    Promise.all([
      supabase.from('actividades').select('id,titulo,fecha,hora,hora_fin,lugar')
        .eq('fecha', hoy).order('hora', { ascending: true }),
      // Total actividades pasadas (hasta hoy inclusive)
      supabase.from('actividades').select('id', { count: 'exact', head: true })
        .lte('fecha', hoy),
      // Actividades asistidas por este usuario
      registroId
        ? supabase.from('asistencias_actividad').select('id', { count: 'exact', head: true })
            .eq('registro_id', registroId)
        : Promise.resolve({ count: 0 }),
    ]).then(([{ data }, { count: total }, { count: asistidas }]) => {
      setActividades(data ?? [])
      setScore({ asistidas: asistidas ?? 0, total: total ?? 0 })
      setCargando(false)
    })
  }, [registroId])

  function ventana(a: any): 'antes' | 'abierta' | 'cerrada' | 'sin_hora' {
    if (!a.hora) return 'sin_hora'
    const ahora = new Date()
    const [hh, mm] = a.hora.split(':').map(Number)
    const inicio = new Date(); inicio.setHours(hh, mm, 0, 0)
    if (a.hora_fin) {
      const [hf, mf] = a.hora_fin.split(':').map(Number)
      const fin = new Date(); fin.setHours(hf, mf, 59, 999)
      if (ahora < inicio) return 'antes'
      if (ahora > fin) return 'cerrada'
      return 'abierta'
    }
    return ahora >= inicio ? 'abierta' : 'antes'
  }

  if (cargando) return <div className="flex justify-center py-16"><div style={{ width: 32, height: 32, border: '3px solid rgba(200,168,75,.3)', borderTopColor: '#c8a84b', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>

  const pct = score && score.total > 0 ? Math.round((score.asistidas / score.total) * 100) : null

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-base font-semibold" style={{ color: 'var(--texto)' }}>Asistencia</h2>

      {/* Score */}
      {score && score.total > 0 && (
        <div className="card p-4 flex items-center gap-4">
          <div className="relative w-14 h-14 shrink-0">
            <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(200,168,75,.15)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#c8a84b" strokeWidth="3"
                strokeDasharray={`${pct} ${100 - (pct ?? 0)}`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: '#c8a84b' }}>
              {pct}%
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--texto)' }}>
              {score.asistidas} de {score.total} {score.total === 1 ? 'actividad' : 'actividades'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>
              {pct === 100 ? '¡Asistencia perfecta! 🌟' : pct! >= 80 ? 'Excelente participación' : pct! >= 50 ? 'Buena participación' : 'Recuerde marcar su asistencia'}
            </p>
          </div>
        </div>
      )}

      {actividades.length === 0 ? (
        <div className="card p-10 text-center" style={{ color: 'var(--texto-muted)' }}>
          <ClipboardCheck size={32} className="mx-auto mb-3" style={{ opacity: .25 }} />
          No hay actividades programadas para hoy.
        </div>
      ) : actividades.map(a => {
        const v = ventana(a)
        const url = `/asistencia/${a.id}${dui ? `?dui=${dui.replace(/\D/g,'')}` : ''}`
        return (
          <div key={a.id} className="card p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: 'var(--texto)' }}>{a.titulo}</p>
              {a.lugar && <p className="text-xs truncate" style={{ color: 'var(--texto-muted)' }}>{a.lugar}</p>}
              <p className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>
                {a.hora ? `${a.hora.slice(0,5)}${a.hora_fin ? ` – ${a.hora_fin.slice(0,5)}` : ''}` : 'Sin hora'}
              </p>
            </div>
            <div className="shrink-0">
              {v === 'abierta' || v === 'sin_hora' ? (
                <a href={url}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: '#16a34a' }}>
                  <ClipboardCheck size={14} /> Registrar
                </a>
              ) : v === 'antes' ? (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(245,158,11,.12)', color: '#d97706' }}>
                  <Clock size={13} /> Pronto
                </span>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(107,114,128,.1)', color: 'var(--texto-muted)' }}>
                  Cerrado
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function PortalPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [dui, setDui]         = useState('')
  const [errorLogin, setErrorLogin] = useState('')
  const [cargandoLogin, setCargandoLogin] = useState(false)
  const [seccion, setSeccion] = useState<Seccion>('perfil')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0)
  const [lightboxUrl, setLightboxUrl]   = useState<string | null>(null)
  const [lightboxNombre, setLightboxNombre] = useState<string>('')
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cuenta regresiva — 28 feb 2027
  const ELECCION = new Date('2027-02-28T06:00:00-06:00').getTime()
  const calcularRestante = () => {
    const diff = ELECCION - Date.now()
    if (diff <= 0) return { dias: 0, horas: 0, minutos: 0, segundos: 0 }
    return {
      dias:     Math.floor(diff / 86400000),
      horas:    Math.floor((diff % 86400000) / 3600000),
      minutos:  Math.floor((diff % 3600000)  / 60000),
      segundos: Math.floor((diff % 60000)    / 1000),
    }
  }
  const [cuenta, setCuenta] = useState({ dias: 0, horas: 0, minutos: 0, segundos: 0 })
  useEffect(() => {
    setCuenta(calcularRestante())
    const t = setInterval(() => setCuenta(calcularRestante()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const url = supabase.storage.from(LOGO_BUCKET).getPublicUrl(LOGO_PATH).data.publicUrl
    fetch(url, { method: 'HEAD' })
      .then(r => { if (r.ok) setLogoUrl(url) })
      .catch(() => {})
  }, [])

  // Estados pre-login extendidos
  type VistaLogin = 'dui' | 'pendiente' | 'registrar' | 'ver' | 'admin'
  const [vistaLogin, setVistaLogin]     = useState<VistaLogin>('dui')
  const [passwordAdmin, setPasswordAdmin] = useState('')
  const [errorAdmin, setErrorAdmin]       = useState('')
  const [regExistente, setRegExistente] = useState<RegistroDUI | null>(null)
  // Formulario de registro
  const [formReg, setFormReg]           = useState({ nombre: '', telefono: '', correo: '', direccion: '' })
  const [guardandoReg, setGuardandoReg] = useState(false)
  const [errorReg, setErrorReg]         = useState('')
  const [modoFormReg, setModoFormReg]   = useState<'ver' | 'editar' | 'registrar' | 'guardado'>('ver')
  // Fotos registro pre-login
  const [fotoPerfilReg, setFotoPerfilReg]     = useState<File | null>(null)
  const [perfilPrevReg, setPerfilPrevReg]     = useState<string | null>(null)
  const [perfilFaltReg, setPerfilFaltReg]     = useState(false)
  const [perfilValReg, setPerfilValReg]       = useState<boolean | null>(null)
  const [perfilRazonReg, setPerfilRazonReg]   = useState('')
  const [validandoPReg, setValidandoPReg]     = useState(false)
  const [fotoFrenteReg, setFotoFrenteReg]     = useState<File | null>(null)
  const [fotoReversoReg, setFotoReversoReg]   = useState<File | null>(null)
  const [frentePrevReg, setFrentePrevReg]     = useState<string | null>(null)
  const [reversoPrevReg, setReversoPrevReg]   = useState<string | null>(null)
  const [frenteValReg, setFrenteValReg]       = useState<boolean | null>(null)
  const [reversoValReg, setReversoValReg]     = useState<boolean | null>(null)
  const [frenteRazonReg, setFrenteRazonReg]   = useState('')
  const [reversoRazonReg, setReversoRazonReg] = useState('')
  const [validandoFReg, setValidandoFReg]     = useState(false)
  const [validandoRReg, setValidandoRReg]     = useState(false)
  const [frenteFaltReg, setFrenteFaltReg]     = useState(false)
  const [reversoFaltReg, setReversoFaltReg]   = useState(false)

  // Datos del registro
  const [registro, setRegistro]       = useState<RegistroDUI | null>(null)
  const [padronInfo, setPadronInfo]   = useState<Padron | null>(null)
  const [companeros, setCompaneros]   = useState<RegistroDUI[]>([])

  // Edición de perfil
  const [editando, setEditando]       = useState(false)
  const [formPerfil, setFormPerfil]   = useState({ nombre: '', telefono: '', correo: '', direccion: '' })
  const [subiendoFotoPerfil, setSubiendoFotoPerfil] = useState(false)
  const [errorFotoPerfil, setErrorFotoPerfil] = useState('')
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState('')

  // Fotos
  const [fotoFrente, setFotoFrente]   = useState<File | null>(null)
  const [fotoReverso, setFotoReverso] = useState<File | null>(null)
  const [frentePreview, setFrentePreview] = useState<string | null>(null)
  const [reversoPreview, setReversoPreview] = useState<string | null>(null)
  const [frenteValido, setFrenteValido]   = useState<boolean | null>(null)
  const [reversoValido, setReversoValido] = useState<boolean | null>(null)
  const [validandoF, setValidandoF] = useState(false)
  const [validandoR, setValidandoR] = useState(false)

  // Materiales
  const [materiales, setMateriales]   = useState<Material[]>([])
  const [filtroMat, setFiltroMat]     = useState('Todas')

  // Agenda — solo eventos (actividades eliminadas)
  const [tabAgenda, setTabAgenda] = useState<'eventos' | 'materiales'>('eventos')
  // Eventos
  const [eventosTransporte, setEventosTransporte] = useState<any[]>([])
  // confirmaciones: mapa evento_id → { confirmado, necesita_recogida, necesita_regreso, check_in_at, id }
  const [confirmaciones, setConfirmaciones] = useState<Record<string, any>>({})
  const [guardandoConf, setGuardandoConf] = useState<string | null>(null)
  const [checkingIn, setCheckingIn] = useState<string | null>(null)
  // Modal RSVP inline
  const [modalRsvp, setModalRsvp] = useState<any | null>(null) // evento completo
  const [rsvpConf, setRsvpConf] = useState({ confirmado: true, necesita_recogida: false, necesita_regreso: false })
  const [rsvpJustificacion, setRsvpJustificacion] = useState('')
  const [rsvpWarnJust, setRsvpWarnJust] = useState(false)
  const [rsvpWarnTransporte, setRsvpWarnTransporte] = useState(false)
  // Paso 2 — formulario de transporte inline
  const [rsvpPaso, setRsvpPaso] = useState<1 | 2>(1)
  const [rsvpRegistroId, setRsvpRegistroId] = useState<string | null>(null)
  const [rsvpGpsLat, setRsvpGpsLat] = useState<number | null>(null)
  const [rsvpGpsLng, setRsvpGpsLng] = useState<number | null>(null)
  const [rsvpGpsCapturando, setRsvpGpsCapturando] = useState(false)
  const [rsvpGpsError, setRsvpGpsError] = useState('')
  const [rsvpSolicitando, setRsvpSolicitando] = useState(false)
  const [rsvpMapaExpandido, setRsvpMapaExpandido] = useState(false)
  // Score asistencia a eventos
  const [scoreAgenda, setScoreAgenda] = useState<{ confirmados: number; checkins: number; total: number } | null>(null)
  // CRUD eventos (admin)
  const FORM_EV_VACIO = { nombre: '', descripcion: '', fecha: '', hora: '', hora_fin: '', lugar: '', transporte_recogida: true, transporte_regreso: true, punto_reunion: '', recogida_domicilio: false, regreso_domicilio: false, activo: true }
  const [modalEvento, setModalEvento] = useState(false)
  const [editandoEvento, setEditandoEvento] = useState<any | null>(null)
  const [formEv, setFormEv] = useState(FORM_EV_VACIO)
  const [guardandoEv, setGuardandoEv] = useState(false)
  const [eliminandoEv, setEliminandoEv] = useState<string | null>(null)
  // Link compartible del último evento creado
  const [linkEvento, setLinkEvento] = useState<{ nombre: string; url: string } | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)
  // Parámetro ?evento=id en URL para auto-abrir RSVP
  const eventoIdUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('evento') : null

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) {
      const u = JSON.parse(stored)
      setUsuario(u)
      cargarDatos(u)
    }
  }, [])

  // Si viene ?evento=id en la URL, navegar a Agenda y abrir RSVP
  useEffect(() => {
    if (!eventoIdUrl || !usuario || eventosTransporte.length === 0) return
    const ev = eventosTransporte.find((e: any) => e.id === eventoIdUrl)
    if (ev) {
      setSeccion('agenda')
      setTabAgenda('eventos')
      abrirRsvp(ev)
      // Limpiar el param de la URL sin recargar
      const url = new URL(window.location.href)
      url.searchParams.delete('evento')
      window.history.replaceState({}, '', url.toString())
    }
  }, [eventoIdUrl, eventosTransporte, usuario])

  function formatDUI(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 9)
    if (d.length > 8) return d.slice(0, 8) + '-' + d.slice(8)
    return d
  }

  async function ingresarAdmin() {
    if (!passwordAdmin) { setErrorAdmin('Ingrese la contraseña'); return }
    setErrorAdmin('')
    const duiFmt = dui.replace(/\D/g, '').slice(0, 8) + '-' + dui.replace(/\D/g, '').slice(8, 9)

    // Buscar el usuario en BD para verificar su contraseña propia
    const { data: usr } = await supabase.from('usuarios').select('password_hash').eq('dui', duiFmt).single()

    let acceso = false
    if (usr?.password_hash) {
      const hash = await hashDUI(passwordAdmin)
      acceso = usr.password_hash === hash
    } else {
      // Fallback: DUI fijo sin registro en BD → contraseña compartida del entorno
      acceso = passwordAdmin === ADMIN_PASSWORD
    }

    if (!acceso) { setErrorAdmin('Contraseña incorrecta'); setPasswordAdmin(''); return }
    sessionStorage.setItem(ADMIN_SESSION, '1')
    sessionStorage.setItem('admin_dui', duiFmt)

    // Cargar datos del admin para mostrarlo en el portal (como cualquier usuario)
    const { data: usrAdmin } = await supabase.from('usuarios').select('*').eq('dui', duiFmt).single()
    if (usrAdmin) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(usrAdmin))
      setUsuario(usrAdmin); cargarDatos(usrAdmin)
    } else {
      // Admin sin registro en tabla usuarios → crear objeto mínimo
      const adminFallback: Usuario = {
        id: 'admin', nombre: 'Administrador', dui: duiFmt,
        email: null, telefono: null, rol: 'administrador',
        activo: true, autorizado: true,
        registro_dui_id: null, foto_perfil_url: null,
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(adminFallback))
      setUsuario(adminFallback)
    }
  }

  async function verificarDUI() {
    if (dui.replace(/\D/g, '').length < 9) { setErrorLogin('Ingrese los 9 dígitos del DUI'); return }
    setCargandoLogin(true); setErrorLogin('')
    const duiFmt = dui.replace(/\D/g, '').slice(0, 8) + '-' + dui.replace(/\D/g, '').slice(8, 9)

    // DUI administrador → pedir contraseña
    const [{ data: usr }, { data: reg }] = await Promise.all([
      supabase.from('usuarios').select('*').eq('dui', duiFmt).single(),
      supabase.from('registros_dui').select('*, padron(*)').eq('dui', duiFmt).single(),
    ])
    setCargandoLogin(false)

    // Administrador (por rol en BD o por DUI fijo) → pedir contraseña admin
    if (duiFmt === ADMIN_DUI || (usr?.rol === 'administrador' && usr?.autorizado)) {
      setVistaLogin('admin'); return
    }

    // Usuario autorizado y activo → ingresar al portal
    if (usr?.autorizado && usr?.activo) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(usr))
      setUsuario(usr); cargarDatos(usr); return
    }

    // Usuario deshabilitado
    if (usr?.autorizado && !usr?.activo) {
      setErrorLogin('Su cuenta está deshabilitada. Contacte al administrador.'); return
    }

    // Tiene registro pero pendiente de autorización
    if (usr && !usr.autorizado) {
      setRegExistente(reg); setVistaLogin('pendiente'); return
    }

    // Tiene registro en DUI pero sin usuario → mostrar sus datos
    if (reg) {
      setRegExistente(reg)
      setFormReg({ nombre: reg.nombre ?? '', telefono: reg.telefono ?? '', correo: reg.correo ?? '', direccion: reg.direccion ?? '' })
      setModoFormReg('ver')
      setVistaLogin('ver'); return
    }

    // Sin ningún registro → formulario de registro nuevo
    setRegExistente(null)
    setFormReg({ nombre: '', telefono: '', correo: '', direccion: '' })
    setModoFormReg('registrar')
    setVistaLogin('registrar')
  }

  function resetFormReg() {
    setFotoFrenteReg(null); setFotoReversoReg(null); setFotoPerfilReg(null)
    setFrentePrevReg(null); setReversoPrevReg(null); setPerfilPrevReg(null)
    setFrenteValReg(null); setReversoValReg(null); setPerfilValReg(null)
    setFrenteRazonReg(''); setReversoRazonReg(''); setPerfilRazonReg('')
    setFrenteFaltReg(false); setReversoFaltReg(false); setPerfilFaltReg(false)
  }

  function validarImagenLocalReg(file: File): Promise<{ valido: boolean; razon: string }> {
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        if (img.width < 200 || img.height < 100) return resolve({ valido: false, razon: 'La imagen es demasiado pequeña.' })
        const ratio = img.width / img.height
        if (ratio < 0.8 || ratio > 3.5) return resolve({ valido: false, razon: 'La proporción no corresponde a un DUI.' })
        const canvas = document.createElement('canvas')
        const scale = Math.min(400 / img.width, 400 / img.height, 1)
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let b = 0; for (let i = 0; i < pixels.length; i += 4) b += pixels[i] * .299 + pixels[i+1] * .587 + pixels[i+2] * .114
        const avg = b / (pixels.length / 4)
        if (avg < 40) return resolve({ valido: false, razon: 'La imagen está muy oscura.' })
        if (avg > 230) return resolve({ valido: false, razon: 'La imagen está sobreexpuesta.' })
        resolve({ valido: true, razon: 'Imagen válida' })
      }
      img.onerror = () => resolve({ valido: false, razon: 'No se pudo leer el archivo.' })
      img.src = URL.createObjectURL(file)
    })
  }

  async function handleFotoPerfilReg(file: File) {
    setPerfilFaltReg(false); setFotoPerfilReg(file)
    const objectUrl = URL.createObjectURL(file)
    setPerfilPrevReg(objectUrl)
    setPerfilValReg(null); setPerfilRazonReg(''); setValidandoPReg(true)

    // 1. Validaciones básicas de calidad
    const calidadOk = await new Promise<{ ok: boolean; razon: string }>(resolve => {
      const img = new Image()
      img.onload = () => {
        if (img.width < 100 || img.height < 100) { resolve({ ok: false, razon: 'La imagen es demasiado pequeña.' }); return }
        const canvas = document.createElement('canvas')
        const scale = Math.min(400 / img.width, 400 / img.height, 1)
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let b = 0; for (let i = 0; i < pixels.length; i += 4) b += pixels[i] * .299 + pixels[i+1] * .587 + pixels[i+2] * .114
        const avg = b / (pixels.length / 4)
        if (avg < 35) { resolve({ ok: false, razon: 'La foto está muy oscura. Busque mejor iluminación.' }); return }
        if (avg > 235) { resolve({ ok: false, razon: 'La foto está sobreexpuesta. Evite luz directa al lente.' }); return }
        resolve({ ok: true, razon: '' })
      }
      img.onerror = () => resolve({ ok: false, razon: 'No se pudo leer el archivo. Intente con otro.' })
      img.src = objectUrl
    })

    if (!calidadOk.ok) {
      setPerfilValReg(false); setPerfilRazonReg(calidadOk.razon); setValidandoPReg(false); return
    }

    // 2. Detección de rostro (FaceDetector API — Chrome/Android)
    try {
      if ('FaceDetector' in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).FaceDetector({ fastMode: false, maxDetectedFaces: 5 })
        const img = new Image()
        img.src = objectUrl
        await new Promise<void>((r, rej) => { img.onload = () => r(); img.onerror = () => rej() })
        const rostros = await detector.detect(img)
        if (rostros.length === 0) {
          setPerfilValReg(false)
          setPerfilRazonReg('No se detectó un rostro. Tome la foto de frente con su cara bien visible.')
          setValidandoPReg(false); return
        }
        if (rostros.length > 1) {
          setPerfilValReg(false)
          setPerfilRazonReg('Se detectaron varios rostros. La foto debe mostrar solo su cara.')
          setValidandoPReg(false); return
        }
      }
    } catch {
      // Si falla la detección (API no soportada o error), se permite continuar
    }

    setPerfilValReg(true); setPerfilRazonReg('Foto válida'); setValidandoPReg(false)
  }

  async function handleFotoReg(file: File, lado: 'frente' | 'reverso') {
    const preview = URL.createObjectURL(file)
    if (lado === 'frente') {
      setFrenteFaltReg(false); setFotoFrenteReg(file); setFrentePrevReg(preview); setFrenteValReg(null); setFrenteRazonReg(''); setValidandoFReg(true)
      const r = await validarImagenLocalReg(file); setFrenteValReg(r.valido); setFrenteRazonReg(r.razon); setValidandoFReg(false)
    } else {
      setReversoFaltReg(false); setFotoReversoReg(file); setReversoPrevReg(preview); setReversoValReg(null); setReversoRazonReg(''); setValidandoRReg(true)
      const r = await validarImagenLocalReg(file); setReversoValReg(r.valido); setReversoRazonReg(r.razon); setValidandoRReg(false)
    }
  }

  async function guardarRegistro() {
    if (!formReg.nombre.trim()) { setErrorReg('El nombre es obligatorio'); return }
    if (!formReg.telefono.trim()) { setErrorReg('El teléfono es obligatorio'); return }
    if (!formReg.correo.trim()) { setErrorReg('El correo es obligatorio'); return }
    if (!formReg.direccion.trim()) { setErrorReg('La dirección es obligatoria'); return }
    const tieneFrenteGuardada = !!regExistente?.foto_frente_url
    const tieneReversoGuardada = !!regExistente?.foto_reverso_url
    if (!fotoFrenteReg && !tieneFrenteGuardada) { setFrenteFaltReg(true); setErrorReg('Cargue la fotografía del frente del DUI'); return }
    if (!fotoReversoReg && !tieneReversoGuardada) { setReversoFaltReg(true); setErrorReg('Cargue la fotografía del reverso del DUI'); return }
    if (fotoFrenteReg && !frenteValReg) { setErrorReg(`Frente: ${frenteRazonReg}`); return }
    if (fotoReversoReg && !reversoValReg) { setErrorReg(`Reverso: ${reversoRazonReg}`); return }
    if (!fotoPerfilReg) { setPerfilFaltReg(true); setErrorReg('La foto de perfil es obligatoria'); return }
    if (perfilValReg === false) { setErrorReg(`Foto de perfil: ${perfilRazonReg}`); return }
    if (perfilValReg === null) { setErrorReg('Espere a que termine la validación de la foto de perfil'); return }

    setGuardandoReg(true); setErrorReg('')
    const duiFmt = dui.replace(/\D/g, '').slice(0, 8) + '-' + dui.replace(/\D/g, '').slice(8, 9)
    const esNuevo = modoFormReg === 'registrar'

    try {
      let frenteUrl = regExistente?.foto_frente_url ?? null
      let reversoUrl = regExistente?.foto_reverso_url ?? null

      if (fotoFrenteReg) {
        const { error: e } = await supabase.storage.from('fotos-dui').upload(`${duiFmt}/frente.jpg`, fotoFrenteReg, { upsert: true })
        if (e) throw e
        frenteUrl = supabase.storage.from('fotos-dui').getPublicUrl(`${duiFmt}/frente.jpg`).data.publicUrl
      }
      if (fotoReversoReg) {
        const { error: e } = await supabase.storage.from('fotos-dui').upload(`${duiFmt}/reverso.jpg`, fotoReversoReg, { upsert: true })
        if (e) throw e
        reversoUrl = supabase.storage.from('fotos-dui').getPublicUrl(`${duiFmt}/reverso.jpg`).data.publicUrl
      }

      const { data: saved, error: dbErr } = await supabase.from('registros_dui').upsert({
        dui: duiFmt, nombre: formReg.nombre.trim(), telefono: formReg.telefono.trim() || null,
        direccion: formReg.direccion.trim() || null, correo: formReg.correo.trim() || null,
        foto_frente_url: frenteUrl, foto_reverso_url: reversoUrl,
        frente_valido: frenteValReg ?? regExistente?.frente_valido ?? false,
        reverso_valido: reversoValReg ?? regExistente?.reverso_valido ?? false,
        estado: 'completo', es_nuevo: esNuevo,
        padron_id: regExistente?.padron_id ?? null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'dui' }).select('*, padron(*)').single()

      if (dbErr) throw dbErr
      if (saved) setRegExistente(saved)

      if (esNuevo && saved) {
        const { data: upserted } = await supabase.from('usuarios').upsert({
          registro_dui_id: saved.id, nombre: formReg.nombre.trim(), dui: duiFmt,
          email: formReg.correo.trim() || null, telefono: formReg.telefono.trim() || null,
          autorizado: false, activo: false, updated_at: new Date().toISOString()
        }, { onConflict: 'dui' }).select('id').single()

        // Subir foto de perfil
        if (fotoPerfilReg && upserted?.id) {
          const ext = fotoPerfilReg.name.split('.').pop() ?? 'jpg'
          const path = `perfiles/${upserted.id}.${ext}`
          const { error: storErr } = await supabase.storage.from('fotos-dui').upload(path, fotoPerfilReg, { upsert: true })
          if (!storErr) {
            const fotoUrl = supabase.storage.from('fotos-dui').getPublicUrl(path).data.publicUrl
            await supabase.from('usuarios').update({ foto_perfil_url: fotoUrl, updated_at: new Date().toISOString() }).eq('id', upserted.id)
          }
        }
      }

      setModoFormReg('guardado')
    } catch (err: unknown) { setErrorReg('Error al guardar: ' + (err instanceof Error ? err.message : String(err))) }
    setGuardandoReg(false)
  }

  async function cargarDatos(u: Usuario) {
    if (u.registro_dui_id) {
      const { data: reg } = await supabase.from('registros_dui').select('*, padron(*)').eq('id', u.registro_dui_id).single()
      if (reg) {
        setRegistro(reg)
        setPadronInfo(reg.padron ?? null)
        setFormPerfil({ nombre: reg.nombre ?? '', telefono: reg.telefono ?? '', correo: reg.correo ?? '', direccion: reg.direccion ?? '' })
        if (reg.padron_id) {
          // Obtener compañeros de la misma JRV
          const { data: mismaJrv } = await supabase.from('padron').select('id').eq('jrv', reg.padron.jrv)
          if (mismaJrv) {
            const ids = mismaJrv.map((p: { id: string }) => p.id)
            const { data: compJrv } = await supabase.from('registros_dui').select('*, padron(*)').in('padron_id', ids).neq('id', reg.id)
            if (compJrv) {
              // Enriquecer con foto_perfil_url desde usuarios
              const duis = compJrv.map((c: RegistroDUI) => c.dui)
              const { data: usrsComp } = await supabase.from('usuarios').select('dui, foto_perfil_url').in('dui', duis)
              const fotoMap: Record<string, string | null> = {}
              usrsComp?.forEach((u: { dui: string; foto_perfil_url: string | null }) => { fotoMap[u.dui] = u.foto_perfil_url })
              setCompaneros(compJrv.map((c: RegistroDUI) => ({ ...c, foto_perfil_url: fotoMap[c.dui] ?? null })))
            }
          }
        }
      }
    }
    const { data: mats } = await supabase.from('materiales').select('*').order('created_at', { ascending: false })
    if (mats) setMateriales(mats)
    // Solo eventos (actividades eliminadas como concepto)
    const { data: evts } = await supabase.from('eventos_transporte').select('*').order('fecha', { ascending: true })
    if (evts) setEventosTransporte(evts)
    // Confirmaciones del usuario a eventos
    const { data: confs } = await supabase.from('confirmaciones_evento').select('*').eq('usuario_id', u.id)
    if (confs) {
      const map: Record<string, any> = {}
      confs.forEach((c: any) => { map[c.evento_id] = c })
      setConfirmaciones(map)
      // Score
      const hoy = new Date().toISOString().slice(0, 10)
      const totalPasados = evts ? evts.filter((e: any) => e.fecha <= hoy).length : 0
      const confirmados = confs.filter((c: any) => c.confirmado).length
      const checkins = confs.filter((c: any) => c.check_in_at != null).length
      setScoreAgenda({ total: totalPasados, confirmados, checkins })
    }
    // Mensajes no leídos
    const { count: nlGrupo } = await supabase
      .from('mensajes_jrv').select('*', { count: 'exact', head: true })
      .eq('jrv', u.jrv).neq('autor_id', u.id)
      .gt('created_at', localStorage.getItem('lastReadGrupo') ?? new Date(0).toISOString())
    const { count: nlDm } = await supabase
      .from('mensajes_directos').select('*', { count: 'exact', head: true })
      .eq('destinatario_id', u.id).eq('leido', false)
    setMensajesNoLeidos((nlGrupo ?? 0) + (nlDm ?? 0))
  }

  function cerrarSesion() {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(ADMIN_SESSION)
    sessionStorage.removeItem('admin_dui')
    setUsuario(null); setDui('')
  }

  // ── Validar foto ──
  async function validarFoto(file: File): Promise<boolean> {
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        if (img.width < 200 || img.height < 100) return resolve(false)
        const r = img.width / img.height
        if (r < 0.8 || r > 3.5) return resolve(false)
        const c = document.createElement('canvas')
        const s = Math.min(400 / img.width, 400 / img.height, 1)
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
        const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0, c.width, c.height)
        const px = ctx.getImageData(0, 0, c.width, c.height).data
        let b = 0; for (let i = 0; i < px.length; i += 4) b += px[i] * .299 + px[i+1] * .587 + px[i+2] * .114
        const avg = b / (px.length / 4); resolve(avg >= 40 && avg <= 230)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  async function handleFoto(file: File, lado: 'frente' | 'reverso') {
    const prev = URL.createObjectURL(file)
    if (lado === 'frente') { setFotoFrente(file); setFrentePreview(prev); setFrenteValido(null); setValidandoF(true); setFrenteValido(await validarFoto(file)); setValidandoF(false) }
    else { setFotoReverso(file); setReversoPreview(prev); setReversoValido(null); setValidandoR(true); setReversoValido(await validarFoto(file)); setValidandoR(false) }
  }

  // ── Foto de perfil ──
  async function subirFotoPerfil(file: File) {
    setSubiendoFotoPerfil(true); setErrorFotoPerfil('')
    const ext = file.name.split('.').pop() ?? 'jpg'
    const idPath = usuario!.id || usuario!.dui.replace(/\D/g, '')
    const path = `perfiles/${idPath}.${ext}`
    const { error } = await supabase.storage.from('fotos-dui').upload(path, file, { upsert: true })
    if (error) {
      setErrorFotoPerfil('No se pudo subir la foto. Intente con otra imagen.')
      setSubiendoFotoPerfil(false); return
    }
    const url = supabase.storage.from('fotos-dui').getPublicUrl(path).data.publicUrl + `?t=${Date.now()}`
    // Intentar update por id; si falla, intentar por dui
    let dbErr = (await supabase.from('usuarios').update({ foto_perfil_url: url, updated_at: new Date().toISOString() }).eq('id', usuario!.id)).error
    if (dbErr) {
      dbErr = (await supabase.from('usuarios').update({ foto_perfil_url: url, updated_at: new Date().toISOString() }).eq('dui', usuario!.dui)).error
    }
    if (dbErr) {
      setErrorFotoPerfil('Error al guardar: ' + dbErr.message)
      setSubiendoFotoPerfil(false); return
    }
    setUsuario(prev => prev ? { ...prev, foto_perfil_url: url } : prev)
    setSubiendoFotoPerfil(false)
  }

  // ── Guardar perfil ──
  async function guardarPerfil() {
    if (!formPerfil.nombre.trim()) { setErrorPerfil('El nombre es obligatorio'); return }
    if (!usuario!.foto_perfil_url) { setErrorPerfil('Debe subir una foto de perfil antes de guardar. Use el ícono de cámara en su avatar.'); return }
    setGuardandoPerfil(true); setErrorPerfil('')
    try {
      const dui = registro!.dui
      let frenteUrl = registro!.foto_frente_url
      let reversoUrl = registro!.foto_reverso_url
      if (fotoFrente && frenteValido) {
        await supabase.storage.from('fotos-dui').upload(`${dui}/frente.jpg`, fotoFrente, { upsert: true })
        frenteUrl = supabase.storage.from('fotos-dui').getPublicUrl(`${dui}/frente.jpg`).data.publicUrl
      }
      if (fotoReverso && reversoValido) {
        await supabase.storage.from('fotos-dui').upload(`${dui}/reverso.jpg`, fotoReverso, { upsert: true })
        reversoUrl = supabase.storage.from('fotos-dui').getPublicUrl(`${dui}/reverso.jpg`).data.publicUrl
      }
      await supabase.from('registros_dui').update({
        nombre: formPerfil.nombre, telefono: formPerfil.telefono || null,
        correo: formPerfil.correo || null, direccion: formPerfil.direccion || null,
        foto_frente_url: frenteUrl, foto_reverso_url: reversoUrl,
        updated_at: new Date().toISOString()
      }).eq('id', registro!.id)
      await supabase.from('usuarios').update({ nombre: formPerfil.nombre, email: formPerfil.correo || null, telefono: formPerfil.telefono || null, updated_at: new Date().toISOString() }).eq('id', usuario!.id)
      setRegistro(prev => prev ? { ...prev, ...formPerfil, foto_frente_url: frenteUrl, foto_reverso_url: reversoUrl } : null)
      setFotoFrente(null); setFotoReverso(null); setFrentePreview(null); setReversoPreview(null); setFrenteValido(null); setReversoValido(null)
      setEditando(false)
    } catch (e: unknown) { setErrorPerfil('Error: ' + (e instanceof Error ? e.message : String(e))) }
    setGuardandoPerfil(false)
  }

  // ── RSVP a evento ──
  async function guardarRsvp() {
    if (!modalRsvp || !usuario) return

    // Validación: si no puede asistir, debe ingresar justificación
    if (!rsvpConf.confirmado && !rsvpJustificacion.trim()) {
      setRsvpWarnJust(true)
      return
    }
    setRsvpWarnJust(false)

    // Advertencia: ofrece transporte, confirmó asistencia, pero no marcó nada
    const ofreceTrans = modalRsvp.transporte_recogida || modalRsvp.transporte_regreso
    if (rsvpConf.confirmado && ofreceTrans && !rsvpConf.necesita_recogida && !rsvpConf.necesita_regreso) {
      setRsvpWarnTransporte(true)
      return
    }
    setRsvpWarnTransporte(false)

    // Si solicitó transporte → cargar registros_dui y avanzar al paso 2
    if (rsvpConf.confirmado && (rsvpConf.necesita_recogida || rsvpConf.necesita_regreso)) {
      const duiFmt = usuario.dui.replace(/\D/g, '').slice(0, 8) + '-' + usuario.dui.replace(/\D/g, '').slice(8, 9)
      const { data: reg } = await supabase.from('registros_dui').select('id, latitud, longitud').eq('dui', duiFmt).single()
      setRsvpRegistroId(reg?.id ?? null)
      setRsvpGpsLat(reg?.latitud ?? null)
      setRsvpGpsLng(reg?.longitud ?? null)
      setRsvpGpsError('')
      setRsvpPaso(2)
      return
    }

    setGuardandoConf(modalRsvp.id)
    const payload = {
      evento_id: modalRsvp.id,
      usuario_id: usuario.id,
      confirmado: rsvpConf.confirmado,
      necesita_recogida: rsvpConf.confirmado ? rsvpConf.necesita_recogida : false,
      necesita_regreso: rsvpConf.confirmado ? rsvpConf.necesita_regreso : false,
      justificacion_ausencia: rsvpConf.confirmado ? null : rsvpJustificacion.trim(),
      fecha_confirmacion: new Date().toISOString(),
    }
    const existing = confirmaciones[modalRsvp.id]
    if (existing) {
      await supabase.from('confirmaciones_evento').update(payload).eq('id', existing.id)
      setConfirmaciones(prev => ({ ...prev, [modalRsvp.id]: { ...existing, ...payload } }))
    } else {
      const { data } = await supabase.from('confirmaciones_evento').insert(payload).select().single()
      if (data) setConfirmaciones(prev => ({ ...prev, [modalRsvp.id]: data }))
    }
    // Si ya no necesita transporte (o no asistirá), cancelar solicitud previa si existe
    const duiFmt = usuario.dui.replace(/\D/g, '').slice(0, 8) + '-' + usuario.dui.replace(/\D/g, '').slice(8, 9)
    const { data: reg } = await supabase.from('registros_dui').select('id').eq('dui', duiFmt).single()
    if (reg) {
      await supabase.from('solicitudes_transporte')
        .delete()
        .eq('registro_id', reg.id)
        .eq('evento_id', modalRsvp.id)
    }
    setGuardandoConf(null)
    setModalRsvp(null)
  }

  async function capturarGpsRsvp() {
    if (!navigator.geolocation) {
      setRsvpGpsError('Su dispositivo no soporta GPS. Contacte al administrador.')
      return
    }
    setRsvpGpsCapturando(true)
    setRsvpGpsError('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setRsvpGpsLat(lat)
        setRsvpGpsLng(lng)
        if (rsvpRegistroId) {
          await supabase.from('registros_dui').update({ latitud: lat, longitud: lng, coordenadas_at: new Date().toISOString() }).eq('id', rsvpRegistroId)
        }
        setRsvpGpsCapturando(false)
      },
      (err) => {
        const msg = err.code === 1
          ? 'Permiso de ubicación denegado. Por favor permita el acceso en la configuración del navegador.'
          : err.code === 3
            ? 'Se agotó el tiempo. Verifique que el GPS esté activo e intente de nuevo.'
            : 'No se pudo obtener su ubicación. Intente de nuevo.'
        setRsvpGpsError(msg)
        setRsvpGpsCapturando(false)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )
  }

  async function confirmarRsvpConTransporte() {
    if (!modalRsvp || !usuario) return
    // Si aún no hay GPS, bloquear (siempre necesario para organizar la ruta)
    if (!rsvpGpsLat) {
      setRsvpGpsError('Necesitamos su ubicación para organizar la ruta del vehículo.')
      return
    }
    setRsvpSolicitando(true)
    // 1. Guardar RSVP
    const payload: any = {
      evento_id: modalRsvp.id,
      usuario_id: usuario.id,
      confirmado: true,
      necesita_recogida: rsvpConf.necesita_recogida,
      necesita_regreso: rsvpConf.necesita_regreso,
      justificacion_ausencia: null,
      fecha_confirmacion: new Date().toISOString(),
    }
    const existing = confirmaciones[modalRsvp.id]
    if (existing) {
      await supabase.from('confirmaciones_evento').update(payload).eq('id', existing.id)
      setConfirmaciones(prev => ({ ...prev, [modalRsvp.id]: { ...existing, ...payload } }))
    } else {
      const { data } = await supabase.from('confirmaciones_evento').insert(payload).select().single()
      if (data) setConfirmaciones(prev => ({ ...prev, [modalRsvp.id]: data }))
    }
    // 2. Upsert solicitud de transporte (actualizar si ya existe, insertar si no)
    if (rsvpRegistroId) {
      const tienePuntoReunion = !modalRsvp.recogida_domicilio && !!modalRsvp.punto_reunion
      const solPayload = {
        registro_id: rsvpRegistroId,
        evento_id: modalRsvp.id,
        estado: 'pendiente',
        solicita_recogida: rsvpConf.necesita_recogida,
        solicita_regreso: rsvpConf.necesita_regreso,
        tipo_recogida: tienePuntoReunion ? 'punto_reunion' : 'domicilio',
      }
      const { data: solExistente } = await supabase
        .from('solicitudes_transporte')
        .select('id')
        .eq('registro_id', rsvpRegistroId)
        .eq('evento_id', modalRsvp.id)
        .single()
      if (solExistente) {
        await supabase.from('solicitudes_transporte').update(solPayload).eq('id', solExistente.id)
      } else {
        await supabase.from('solicitudes_transporte').insert(solPayload)
      }
    }
    setRsvpSolicitando(false)
    setRsvpPaso(1)
    setModalRsvp(null)
  }

  async function hacerCheckIn(eventoId: string) {
    if (!usuario) return
    setCheckingIn(eventoId)
    const existing = confirmaciones[eventoId]
    const now = new Date().toISOString()
    if (existing) {
      await supabase.from('confirmaciones_evento').update({ check_in_at: now }).eq('id', existing.id)
      setConfirmaciones(prev => ({ ...prev, [eventoId]: { ...existing, check_in_at: now } }))
    } else {
      // Check-in sin RSVP previo → crear confirmación con check-in
      const payload = { evento_id: eventoId, usuario_id: usuario.id, confirmado: true, necesita_recogida: false, necesita_regreso: false, fecha_confirmacion: now, check_in_at: now }
      const { data } = await supabase.from('confirmaciones_evento').insert(payload).select().single()
      if (data) setConfirmaciones(prev => ({ ...prev, [eventoId]: data }))
    }
    setCheckingIn(null)
  }

  function abrirRsvp(ev: any) {
    const conf = confirmaciones[ev.id]
    setRsvpConf({
      confirmado: conf ? conf.confirmado : true,
      necesita_recogida: conf ? conf.necesita_recogida : false,
      necesita_regreso: conf ? conf.necesita_regreso : false,
    })
    setRsvpWarnTransporte(false)
    setRsvpWarnJust(false)
    setRsvpJustificacion(conf?.justificacion_ausencia ?? '')
    setRsvpPaso(1)
    setRsvpGpsError('')
    setModalRsvp(ev)
  }

  // ── CRUD eventos de transporte (admin) ──
  function abrirNuevoEvento() {
    setEditandoEvento(null)
    setFormEv(FORM_EV_VACIO)
    setModalEvento(true)
  }

  function abrirEditarEvento(ev: any) {
    setEditandoEvento(ev)
    setFormEv({
      nombre: ev.titulo ?? ev.nombre, descripcion: ev.descripcion ?? '',
      fecha: ev.fecha, hora: ev.hora ?? '', hora_fin: ev.hora_fin ?? '',
      lugar: ev.lugar ?? '', transporte_recogida: ev.transporte_recogida,
      transporte_regreso: ev.transporte_regreso,
      punto_reunion: ev.punto_reunion ?? '',
      recogida_domicilio: ev.recogida_domicilio ?? false,
      regreso_domicilio: ev.regreso_domicilio ?? false,
      activo: ev.activo,
    })
    setModalEvento(true)
  }

  async function guardarEvento() {
    if (!formEv.nombre.trim() || !formEv.fecha) return
    setGuardandoEv(true)
    const payload = {
      nombre: formEv.nombre.trim(),
      descripcion: formEv.descripcion || null,
      fecha: formEv.fecha,
      hora: formEv.hora || null,
      hora_fin: formEv.hora_fin || null,
      lugar: formEv.lugar || null,
      transporte_recogida: formEv.transporte_recogida,
      transporte_regreso: formEv.transporte_regreso,
      punto_reunion: formEv.punto_reunion || null,
      recogida_domicilio: formEv.recogida_domicilio,
      regreso_domicilio: formEv.regreso_domicilio,
      activo: formEv.activo,
    }
    if (editandoEvento) {
      await supabase.from('eventos_transporte').update(payload).eq('id', editandoEvento.id)
      setEventosTransporte(prev => prev.map(e => e.id === editandoEvento.id ? { ...e, ...payload } : e))
    } else {
      const { data } = await supabase.from('eventos_transporte').insert(payload).select().single()
      if (data) {
        setEventosTransporte(prev => [...prev, data].sort((a, b) => a.fecha.localeCompare(b.fecha)))
        // Generar link compartible para el nuevo evento
        const base = typeof window !== 'undefined' ? window.location.origin : 'https://centro-votacion-gerardo-barrios.vercel.app'
        setLinkEvento({ nombre: data.nombre, url: `${base}/portal?evento=${data.id}` })
        setLinkCopiado(false)
      }
    }
    setGuardandoEv(false)
    setModalEvento(false)
  }

  async function eliminarEvento(id: string) {
    if (!confirm('¿Eliminar este evento?')) return
    setEliminandoEv(id)
    await supabase.from('eventos_transporte').delete().eq('id', id)
    setEventosTransporte(prev => prev.filter(e => e.id !== id))
    setEliminandoEv(null)
  }

  // Categorías de materiales
  const catsMat = ['Todas', ...Array.from(new Set(materiales.map(m => m.categoria)))]
  const matsFiltrados = materiales.filter(m => filtroMat === 'Todas' || m.categoria === filtroMat)

  // Eventos ordenados por fecha/hora
  const eventosSorted = [...eventosTransporte].sort((a, b) => {
    const d = a.fecha.localeCompare(b.fecha)
    if (d !== 0) return d
    return (a.hora ?? '00:00').localeCompare(b.hora ?? '00:00')
  })

  const eventosPorMes = eventosSorted.reduce((acc, e) => {
    const mes = e.fecha.slice(0, 7)
    if (!acc[mes]) acc[mes] = []
    acc[mes].push(e); return acc
  }, {} as Record<string, any[]>)

  /* ── LOGIN / PRE-LOGIN ── */
  if (!usuario) {
    return (
      <main className="min-h-screen flex flex-col lg:flex-row"
        style={{ background: 'linear-gradient(135deg, var(--navy-dark) 0%, var(--navy) 100%)' }}>

        {/* ── PANEL IZQUIERDO — información institucional ── */}
        <div className="hidden lg:flex flex-col justify-between flex-1 p-14"
          style={{ borderRight: '1px solid rgba(255,255,255,.07)' }}>

          {/* Header institucional */}
          <div>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ background: 'rgba(200,168,75,.18)', border: '1px solid rgba(200,168,75,.35)' }}>
                {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : <LogoUrna size={30} />}
              </div>
              <div>
                <div className="font-bold text-white text-base leading-tight">SIRCEV</div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,.45)' }}>
                  Sistema de Registro de Colaboradores Electorales
                </div>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-white leading-tight mb-3">
              Portal del<br />
              <span style={{ color: 'var(--gold)' }}>Colaborador</span>
            </h1>
            <p className="text-base mb-10" style={{ color: 'rgba(255,255,255,.55)', maxWidth: 380, lineHeight: 1.7 }}>
              Acceda a su información, confirme su asistencia a capacitaciones y consulte los detalles de su Junta Receptora de Votos.
            </p>

            {/* Info del centro */}
            <div className="space-y-4">
              {/* Centro de votación + botón cómo llegar */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(200,168,75,.12)', border: '1px solid rgba(200,168,75,.2)' }}>
                  <MapPin size={14} style={{ color: 'var(--gold)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,.38)' }}>Centro de Votación</div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,.82)' }}>
                      C.E. Capitán General Gerardo Barrios
                    </span>
                    <a
                      href="https://maps.app.goo.gl/7MBiZdwQmH5XBFJg7"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-150 flex-shrink-0"
                      style={{ background: 'rgba(200,168,75,.18)', border: '1px solid rgba(200,168,75,.4)', color: 'var(--gold)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,168,75,.32)'; e.currentTarget.style.borderColor = 'rgba(200,168,75,.7)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(200,168,75,.18)'; e.currentTarget.style.borderColor = 'rgba(200,168,75,.4)' }}
                    >
                      <MapPin size={11} />
                      Cómo llegar
                    </a>
                  </div>
                </div>
              </div>

              {[
                { icon: MapPin,   label: 'Municipio',         value: 'Santa Ana Centro · Departamento de Santa Ana' },
                { icon: Calendar, label: 'Proceso Electoral', value: 'Elecciones Presidenciales, Legislativas y Municipales 2027' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(200,168,75,.12)', border: '1px solid rgba(200,168,75,.2)' }}>
                    <Icon size={14} style={{ color: 'var(--gold)' }} />
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,.38)' }}>{label}</div>
                    <div className="text-sm font-medium" style={{ color: 'rgba(255,255,255,.82)' }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cuenta regresiva */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(200,168,75,.08)', border: '1px solid rgba(200,168,75,.2)' }}>
            <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'rgba(200,168,75,.7)' }}>
              Faltan para las elecciones · 28 feb 2027
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { valor: cuenta.dias,     label: 'Días' },
                { valor: cuenta.horas,    label: 'Horas' },
                { valor: cuenta.minutos,  label: 'Min' },
                { valor: cuenta.segundos, label: 'Seg' },
              ].map(({ valor, label }) => (
                <div key={label} className="text-center rounded-xl py-3"
                  style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' }}>
                  <div className="text-2xl font-bold text-white leading-none tabular-nums">
                    {String(valor).padStart(2, '0')}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,.35)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Capacidades del portal */}
          <div>
            <p className="text-xs font-semibold mb-4 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.3)' }}>
              Con su acceso puede
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: User,      text: 'Ver y editar su perfil' },
                { icon: Users,     text: 'Consultar su JRV y compañeros' },
                { icon: Calendar,  text: 'Ver actividades programadas' },
                { icon: CheckCircle, text: 'Confirmar asistencia' },
                { icon: BookOpen,  text: 'Descargar material de capacitación' },
                { icon: FileText,  text: 'Consultar su asignación de cargo' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>
                  <Icon size={13} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,.6)' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── PANEL DERECHO — formulario ── */}
        <div className="flex flex-col items-center justify-center p-6 lg:p-14 w-full lg:w-[480px] flex-shrink-0">

          {/* Logo móvil */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
              style={{ background: 'rgba(200,168,75,.18)', border: '1px solid rgba(200,168,75,.35)' }}>
              {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : <LogoUrna size={22} />}
            </div>
            <div>
              <div className="font-bold text-white text-sm">Portal del Colaborador</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,.45)' }}>SIRCEV · Elecciones 2027</div>
            </div>
          </div>


        {/* ── INGRESO DUI ── */}
        {vistaLogin === 'dui' && (
          <div className="w-full max-w-sm">
            {/* Badge institucional */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,.1)' }} />
              <span className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: 'rgba(200,168,75,.15)', color: 'var(--gold)', border: '1px solid rgba(200,168,75,.25)' }}>
                Acceso seguro
              </span>
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,.1)' }} />
            </div>

            <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', backdropFilter: 'blur(12px)' }}>
              <h2 className="font-bold text-white text-xl mb-1 text-center">Ingrese su DUI</h2>
              <p className="text-sm text-center mb-6" style={{ color: 'rgba(255,255,255,.45)' }}>
                Su número de DUI es su credencial de acceso al sistema
              </p>

              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.5)' }}>
                Número de DUI
              </label>
              <input
                type="text"
                value={dui}
                onChange={e => setDui(formatDUI(e.target.value))}
                onKeyDown={e => e.key === 'Enter' && verificarDUI()}
                placeholder="00000000-0"
                maxLength={10}
                className="w-full rounded-xl text-center font-mono text-2xl font-bold mb-2 outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,.08)',
                  border: errorLogin ? '2px solid rgba(220,38,38,.6)' : '2px solid rgba(255,255,255,.15)',
                  color: 'white',
                  padding: '14px 16px',
                  letterSpacing: '.1em',
                }}
                onFocus={e => { if (!errorLogin) e.currentTarget.style.borderColor = 'rgba(200,168,75,.6)' }}
                onBlur={e => { if (!errorLogin) e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)' }}
              />

              {errorLogin
                ? <p className="text-xs mb-4 text-center" style={{ color: '#f87171' }}>{errorLogin}</p>
                : <p className="text-xs mb-4 text-center" style={{ color: 'rgba(255,255,255,.3)' }}>Formato: 12345678-9 &nbsp;·&nbsp; El guión es opcional</p>
              }

              <button
                onClick={verificarDUI}
                disabled={cargandoLogin}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
                style={{
                  background: cargandoLogin ? 'rgba(200,168,75,.4)' : 'var(--gold)',
                  color: cargandoLogin ? 'rgba(255,255,255,.6)' : 'var(--navy-dark)',
                  cursor: cargandoLogin ? 'not-allowed' : 'pointer',
                }}>
                {cargandoLogin
                  ? <><span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Verificando...</>
                  : 'Continuar →'
                }
              </button>

              <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,.25)' }}>
                  Solo colaboradores registrados y autorizados pueden acceder a este sistema.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ── PENDIENTE DE AUTORIZACIÓN ── */}
        {vistaLogin === 'pendiente' && (
          <div className="w-full max-w-sm">
            <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', backdropFilter: 'blur(12px)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.3)' }}>
                <Clock size={30} style={{ color: '#f59e0b' }} />
              </div>
              <h2 className="font-bold text-white text-xl mb-2">Solicitud en revisión</h2>
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,.5)', lineHeight: 1.7 }}>
                Su registro está siendo revisado por el equipo administrativo. Recibirá acceso una vez que sea autorizado.
              </p>
              {regExistente && (
                <div className="rounded-xl p-4 text-left mb-5" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>
                  <p className="text-xs mb-1 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.35)' }}>Datos registrados</p>
                  <p className="font-semibold text-white text-sm">{regExistente.nombre}</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'rgba(255,255,255,.4)' }}>{regExistente.dui}</p>
                </div>
              )}
              <div className="rounded-xl p-3 mb-5" style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}>
                <p className="text-xs" style={{ color: 'rgba(245,158,11,.85)' }}>
                  Si tiene preguntas, contacte al coordinador del centro de votación.
                </p>
              </div>
              <button onClick={() => { setVistaLogin('dui'); setErrorLogin('') }}
                className="w-full py-3 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.12)' }}>
                ← Ingresar otro DUI
              </button>
            </div>
          </div>
        )}

        {/* ── VER REGISTRO EXISTENTE (sin usuario) ── */}
        {vistaLogin === 'ver' && regExistente && (
          <div className="w-full max-w-md">
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', backdropFilter: 'blur(12px)' }}>
              {/* Header */}
              <div className="px-7 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(200,168,75,.08)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(200,168,75,.18)', border: '1px solid rgba(200,168,75,.3)' }}>
                  <User size={18} style={{ color: 'var(--gold)' }} />
                </div>
                <div>
                  <h2 className="font-bold text-white text-base leading-tight">Sus datos registrados</h2>
                  <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,.4)' }}>{regExistente.dui}</p>
                </div>
              </div>

              <div className="p-7">
                {modoFormReg === 'ver' && (
                  <div className="space-y-3 mb-5">
                    {[
                      { label: 'Nombre completo', value: regExistente.nombre },
                      { label: 'Teléfono',         value: regExistente.telefono },
                      { label: 'Correo',            value: regExistente.correo },
                      { label: 'Dirección',         value: regExistente.direccion },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between gap-4 text-sm py-2"
                        style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                        <span style={{ color: 'rgba(255,255,255,.4)' }}>{label}</span>
                        <span className="font-medium text-right" style={{ color: value ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.25)' }}>
                          {value ?? '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {modoFormReg === 'editar' && (
                  <div className="space-y-3 mb-4">
                    {[
                      { field: 'nombre',    label: 'Nombre completo',    type: 'text' },
                      { field: 'telefono',  label: 'Teléfono',           type: 'tel' },
                      { field: 'correo',    label: 'Correo electrónico', type: 'email' },
                      { field: 'direccion', label: 'Dirección',          type: 'text' },
                    ].map(({ field, label, type }) => (
                      <div key={field}>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.4)' }}>{label}</label>
                        <input type={type} value={formReg[field as keyof typeof formReg]}
                          onChange={e => setFormReg(f => ({ ...f, [field]: field === 'nombre' ? toNombrePropio(e.target.value) : e.target.value }))}
                          className="w-full rounded-xl outline-none text-sm transition-all"
                          style={{ background: 'rgba(255,255,255,.08)', border: '1.5px solid rgba(255,255,255,.15)', color: 'white', padding: '10px 14px' }}
                          onFocus={e => e.currentTarget.style.borderColor = 'rgba(200,168,75,.5)'}
                          onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)'}
                        />
                      </div>
                    ))}
                    {errorReg && <p className="text-xs" style={{ color: '#f87171' }}>{errorReg}</p>}
                  </div>
                )}
                {modoFormReg === 'guardado' && (
                  <div className="rounded-xl p-4 mb-4 text-center" style={{ background: 'rgba(5,150,105,.12)', border: '1px solid rgba(5,150,105,.3)' }}>
                    <p className="font-semibold text-sm" style={{ color: '#34d399' }}>✓ Datos actualizados correctamente</p>
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,.4)' }}>Su solicitud está siendo procesada</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {modoFormReg === 'ver' && (
                    <button onClick={() => setModoFormReg('editar')}
                      className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                      style={{ background: 'var(--gold)', color: 'var(--navy-dark)' }}>
                      <Pencil size={14} /> Actualizar mis datos
                    </button>
                  )}
                  {modoFormReg === 'editar' && (
                    <>
                      <button onClick={() => setModoFormReg('ver')}
                        className="flex-1 py-3 rounded-xl text-sm font-medium"
                        style={{ background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.12)' }}>
                        Cancelar
                      </button>
                      <button onClick={guardarRegistro} disabled={guardandoReg}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold"
                        style={{ background: 'var(--gold)', color: 'var(--navy-dark)', opacity: guardandoReg ? .6 : 1 }}>
                        {guardandoReg ? 'Guardando...' : 'Guardar'}
                      </button>
                    </>
                  )}
                </div>

                <button onClick={() => { setVistaLogin('dui'); setErrorLogin('') }}
                  className="w-full text-xs mt-4 text-center" style={{ color: 'rgba(255,255,255,.3)' }}>
                  ← Ingresar otro DUI
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── REGISTRO NUEVO ── */}
        {vistaLogin === 'registrar' && (
          <div className="w-full max-w-md">
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', backdropFilter: 'blur(12px)' }}>
              {modoFormReg !== 'guardado' ? (
                <>
                  <div className="px-5 md:px-7 py-4 md:py-5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(200,168,75,.08)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                      style={{ background: 'rgba(200,168,75,.18)', border: '1px solid rgba(200,168,75,.3)' }}>
                      {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : <LogoUrna size={20} />}
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-base leading-tight">Nuevo registro</h2>
                      <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,.4)' }}>{dui}</p>
                    </div>
                  </div>

                  <div className="p-5 md:p-7 space-y-3">
                    {[
                      { field: 'nombre',    label: 'Nombre completo *',    type: 'text' },
                      { field: 'telefono',  label: 'Teléfono *',           type: 'tel' },
                      { field: 'correo',    label: 'Correo electrónico *', type: 'email' },
                      { field: 'direccion', label: 'Dirección *',          type: 'text' },
                    ].map(({ field, label, type }) => (
                      <div key={field}>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.4)' }}>{label}</label>
                        <input type={type} value={formReg[field as keyof typeof formReg]}
                          onChange={e => setFormReg(f => ({ ...f, [field]: field === 'nombre' ? toNombrePropio(e.target.value) : e.target.value }))}
                          className="w-full rounded-xl outline-none text-sm transition-all"
                          style={{ background: 'rgba(255,255,255,.08)', border: '1.5px solid rgba(255,255,255,.15)', color: 'white', padding: '10px 14px' }}
                          onFocus={e => e.currentTarget.style.borderColor = 'rgba(200,168,75,.5)'}
                          onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)'}
                        />
                      </div>
                    ))}

                    {/* Foto de perfil */}
                    <div className="pt-1">
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.4)' }}>
                        Foto de perfil *
                      </label>
                      <div className="rounded-xl p-4 transition-all"
                        style={{
                          background: 'rgba(255,255,255,.05)',
                          border: `2px dashed ${perfilValReg === false || perfilFaltReg ? 'rgba(220,38,38,.6)' : perfilValReg === true ? 'rgba(5,150,105,.5)' : 'rgba(255,255,255,.18)'}`,
                        }}>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                            style={{ background: 'rgba(200,168,75,.12)', border: '1px solid rgba(200,168,75,.25)' }}>
                            {perfilPrevReg
                              ? <img src={perfilPrevReg} alt="perfil" className="w-full h-full object-cover" />
                              : <Camera size={22} style={{ color: 'rgba(255,255,255,.25)' }} />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            {validandoPReg && <p className="text-xs" style={{ color: 'rgba(255,255,255,.5)' }}>Validando foto...</p>}
                            {!validandoPReg && perfilValReg === true && <p className="text-xs font-semibold" style={{ color: '#34d399' }}>✓ Foto válida</p>}
                            {!validandoPReg && perfilValReg === false && (
                              <p className="text-xs font-semibold" style={{ color: '#f87171' }}>✗ {perfilRazonReg}</p>
                            )}
                            {!validandoPReg && perfilValReg === null && (
                              <p className="text-xs" style={{ color: 'rgba(255,255,255,.35)' }}>
                                {perfilFaltReg ? <span style={{ color: '#f87171' }}>Foto de perfil requerida</span> : 'Debe mostrar claramente su rostro'}
                              </p>
                            )}
                            <div className="flex gap-2 mt-2 flex-wrap">
                              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                style={{ background: 'rgba(200,168,75,.2)', border: '1px solid rgba(200,168,75,.4)', color: 'var(--gold)' }}>
                                <Camera size={11} /> {perfilPrevReg ? 'Tomar otra' : 'Tomar foto'}
                                <input type="file" accept="image/*" capture="user" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFotoPerfilReg(f) }} />
                              </label>
                              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.6)' }}>
                                <Upload size={11} /> Cargar archivo
                                <input type="file" accept="image/*" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFotoPerfilReg(f) }} />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fotos DUI */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {([
                        { lado: 'frente' as const, label: 'Foto frente DUI *', prev: frentePrevReg, val: frenteValReg, razon: frenteRazonReg, validando: validandoFReg, falta: frenteFaltReg },
                        { lado: 'reverso' as const, label: 'Foto reverso DUI *', prev: reversoPrevReg, val: reversoValReg, razon: reversoRazonReg, validando: validandoRReg, falta: reversoFaltReg },
                      ]).map(({ lado, label, prev, val, razon, validando, falta }) => (
                        <div key={lado}>
                          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.4)' }}>{label}</label>
                          <label className="flex flex-col items-center gap-1 cursor-pointer rounded-xl p-3 transition-all"
                            style={{
                              background: 'rgba(255,255,255,.05)',
                              border: `2px dashed ${falta ? 'rgba(220,38,38,.6)' : val === true ? 'rgba(5,150,105,.5)' : val === false ? 'rgba(220,38,38,.6)' : 'rgba(255,255,255,.18)'}`,
                              minHeight: 80
                            }}>
                            {prev
                              ? <img src={prev} alt={lado} style={{ maxHeight: 80, borderRadius: 6, objectFit: 'cover' }} />
                              : <><Camera size={18} style={{ color: 'rgba(255,255,255,.3)' }} /><span className="text-xs" style={{ color: 'rgba(255,255,255,.3)' }}>Cargar</span></>
                            }
                            <input type="file" accept="image/*" className="hidden"
                              onChange={e => e.target.files?.[0] && handleFotoReg(e.target.files[0], lado)} />
                          </label>
                          {validando && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,.35)' }}>Validando...</p>}
                          {!validando && val !== null && (
                            <p className="text-xs mt-1" style={{ color: val ? '#34d399' : '#f87171' }}>
                              {val ? '✓' : '✗'} {razon}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {errorReg && <p className="text-xs" style={{ color: '#f87171' }}>{errorReg}</p>}

                    <button onClick={guardarRegistro} disabled={guardandoReg}
                      className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                      style={{ background: 'var(--gold)', color: 'var(--navy-dark)', opacity: guardandoReg ? .6 : 1 }}>
                      {guardandoReg
                        ? <><span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Guardando...</>
                        : 'Enviar solicitud'
                      }
                    </button>
                    <button onClick={() => { setVistaLogin('dui'); setErrorLogin(''); resetFormReg() }}
                      className="w-full text-xs text-center" style={{ color: 'rgba(255,255,255,.3)' }}>
                      ← Ingresar otro DUI
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                    style={{ background: 'rgba(5,150,105,.15)', border: '1px solid rgba(5,150,105,.3)' }}>
                    <Check size={30} style={{ color: '#34d399' }} />
                  </div>
                  <h2 className="font-bold text-white text-xl mb-2">¡Solicitud enviada!</h2>
                  <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,.5)', lineHeight: 1.7 }}>
                    Su registro ha sido recibido. El equipo administrativo revisará su solicitud y le habilitará el acceso al portal.
                  </p>

                  {/* Pregunta de transporte */}
                  <div className="rounded-xl p-4 mb-5 text-left" style={{ background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.3)' }}>
                    <p className="text-sm font-semibold text-white mb-1">🚐 ¿Necesita transporte al evento?</p>
                    <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,.5)' }}>
                      Puede solicitar que un motorista lo lleve al evento o lo traiga de regreso.
                    </p>
                    <div className="flex gap-2">
                      <a href={`/transporte?dui=${dui.replace(/\D/g,'')}`}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center"
                        style={{ background: 'rgba(99,102,241,.8)', color: '#fff' }}>
                        Sí, solicitar transporte
                      </a>
                      <button onClick={() => { setVistaLogin('dui'); setErrorLogin(''); resetFormReg() }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                        style={{ background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.1)' }}>
                        No, gracias
                      </button>
                    </div>
                  </div>

                  <button onClick={() => { setVistaLogin('dui'); setErrorLogin(''); resetFormReg() }}
                    className="w-full py-2.5 rounded-xl text-xs"
                    style={{ color: 'rgba(255,255,255,.25)' }}>
                    ← Volver al inicio
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ACCESO ADMINISTRADOR ── */}
        {vistaLogin === 'admin' && (
          <div className="w-full max-w-sm">
            <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', backdropFilter: 'blur(12px)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(200,168,75,.15)', border: '1px solid rgba(200,168,75,.3)' }}>
                <ShieldAlert size={26} style={{ color: 'var(--gold)' }} />
              </div>
              <h2 className="font-bold text-white text-xl text-center mb-1">Panel Administrador</h2>
              <p className="text-sm text-center mb-6" style={{ color: 'rgba(255,255,255,.4)' }}>
                Ingrese su contraseña para continuar
              </p>

              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.4)' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={passwordAdmin}
                onChange={e => { setPasswordAdmin(e.target.value); setErrorAdmin('') }}
                onKeyDown={e => e.key === 'Enter' && ingresarAdmin()}
                placeholder="••••••••"
                autoFocus
                className="w-full rounded-xl text-center font-mono text-xl font-bold mb-2 outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,.08)',
                  border: errorAdmin ? '2px solid rgba(220,38,38,.6)' : '2px solid rgba(255,255,255,.15)',
                  color: 'white',
                  padding: '14px 16px',
                  letterSpacing: '.2em',
                }}
                onFocus={e => { if (!errorAdmin) e.currentTarget.style.borderColor = 'rgba(200,168,75,.6)' }}
                onBlur={e => { if (!errorAdmin) e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)' }}
              />
              {errorAdmin && <p className="text-xs mb-3 text-center" style={{ color: '#f87171' }}>{errorAdmin}</p>}

              <button
                onClick={ingresarAdmin}
                className="w-full py-3.5 rounded-xl font-semibold text-sm mt-2"
                style={{ background: 'var(--gold)', color: 'var(--navy-dark)' }}>
                Ingresar al panel →
              </button>

              <button
                onClick={() => { setVistaLogin('dui'); setPasswordAdmin(''); setErrorAdmin('') }}
                className="w-full text-xs mt-4 text-center"
                style={{ color: 'rgba(255,255,255,.3)' }}>
                ← Volver
              </button>
            </div>
          </div>
        )}

        </div>{/* fin panel derecho */}
      </main>
    )
  }

  /* ── PORTAL ── */
  const esAdmin    = usuario?.rol === 'administrador' || sessionStorage.getItem(ADMIN_SESSION) === '1'
  const esMotorista = !!registro?.es_motorista
  const NAV = [
    { key: 'perfil',      label: 'Mi Perfil',        icon: User,         href: null,    badge: 0 },
    { key: 'jrv',         label: 'Mi JRV',            icon: Users,        href: null,    badge: 0 },
    { key: 'agenda',      label: 'Agenda',            icon: Calendar,     href: null,    badge: 0 },
    { key: 'mensajes',    label: 'Mensajes',          icon: MessageCircle, href: '/portal/mensajes', badge: mensajesNoLeidos },
    { key: 'transporte',  label: 'Transporte',        icon: Bus,          href: `/transporte?dui=${encodeURIComponent(usuario?.dui ?? '')}`, badge: 0 },
    ...(esMotorista ? [{ key: 'motorista', label: 'Motorista', icon: Truck, href: `/motorista?dui=${encodeURIComponent(usuario?.dui ?? '')}`, badge: 0 }] : []),
    ...(esAdmin ? [{ key: 'admin', label: 'Panel Admin', icon: ShieldAlert, href: '/admin', badge: 0 }] : []),
  ]

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--fondo)' }}>

      {/* ── Sidebar desktop (md+) ── */}
      <aside className="hidden md:flex w-56 flex-col flex-shrink-0"
        style={{ background: 'linear-gradient(180deg, var(--navy-dark), var(--navy))', borderRight: '1px solid rgba(255,255,255,.06)' }}>
        <div className="px-4 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div
            className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 font-bold text-xs"
            style={{ background: 'rgba(200,168,75,.2)', border: '1px solid rgba(200,168,75,.3)', color: 'var(--gold)', cursor: usuario.foto_perfil_url ? 'zoom-in' : 'default' }}
            onClick={() => { if (usuario.foto_perfil_url) { setLightboxUrl(usuario.foto_perfil_url); setLightboxNombre(usuario.nombre) } }}
          >
            {usuario.foto_perfil_url
              ? <img src={usuario.foto_perfil_url} alt="perfil" className="w-full h-full object-cover" />
              : usuario.nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
            }
          </div>
          <div className="overflow-hidden">
            <div className="text-white font-bold text-xs truncate">{usuario.nombre.split(' ').slice(0, 2).join(' ')}</div>
            <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,.45)', fontFamily: 'monospace' }}>{usuario.dui}</div>
          </div>
        </div>
        <nav className="flex-1 py-3 space-y-1 px-2">
          {NAV.map(({ key, label, icon: Icon, href, badge }) => (
            <button key={key}
              onClick={() => href ? (window.location.href = href) : setSeccion(key as Seccion)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left"
              style={{
                background: !href && seccion === key ? 'rgba(200,168,75,.18)' : 'transparent',
                color: !href && seccion === key ? '#c8a84b' : 'rgba(255,255,255,.6)',
                borderLeft: !href && seccion === key ? '3px solid #c8a84b' : '3px solid transparent',
              }}>
              <Icon size={15} className="flex-shrink-0" />
              <span className="truncate flex-1">{label}</span>
              {badge > 0 && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center flex-shrink-0"
                  style={{ background: '#c8a84b', color: '#1e3a5f', fontSize: 10 }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="px-2 pb-4 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 12 }}>
          <InstallPWA variant="sidebar" />
          <button onClick={cerrarSesion} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
            style={{ color: 'rgba(255,255,255,.45)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.45)')}>
            <LogOut size={15} className="flex-shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Barra inferior móvil (< md) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{ background: 'var(--navy-dark)', borderTop: '1px solid rgba(255,255,255,.1)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
          {NAV.map(({ key, label, icon: Icon, href, badge }) => {
            const activo = !href && seccion === key
            return (
              <button key={key}
                onClick={() => href ? (window.location.href = href) : setSeccion(key as Seccion)}
                className="flex flex-col items-center justify-center gap-0.5 flex-shrink-0 transition-colors relative"
                style={{ color: activo ? 'var(--gold)' : 'rgba(255,255,255,.4)', minHeight: 58, minWidth: 64, padding: '8px 4px' }}>
                {activo && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                    style={{ width: 28, height: 3, background: 'var(--gold)', borderRadius: '0 0 4px 4px' }} />
                )}
                <span className="relative">
                  <Icon size={20} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 text-[9px] font-bold px-1 rounded-full"
                      style={{ background: '#c8a84b', color: '#1e3a5f', lineHeight: '14px', minWidth: 14 }}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 9.5, fontWeight: activo ? 600 : 400, letterSpacing: '-.01em', lineHeight: 1.2, textAlign: 'center', maxWidth: 60 }}>
                  {label}
                </span>
              </button>
            )
          })}
          <InstallPWA variant="bottombar" />
          <button onClick={cerrarSesion}
            className="flex flex-col items-center justify-center gap-0.5 flex-shrink-0"
            style={{ color: 'rgba(255,255,255,.35)', minHeight: 58, minWidth: 56, padding: '8px 4px' }}>
            <LogOut size={20} />
            <span style={{ fontSize: 9.5, lineHeight: 1.2 }}>Salir</span>
          </button>
        </div>
      </nav>

      {/* Contenido */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center px-4 md:px-6 flex-shrink-0"
          style={{ background: 'var(--superficie)', borderBottom: '1px solid var(--borde)', height: 52 }}>
          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: 'var(--texto-muted)' }}>Portal</span>
            <ChevronRight size={13} style={{ color: 'var(--borde-dark)' }} />
            <span className="font-medium">{NAV.find(n => n.key === seccion)?.label}</span>
          </div>
          <div className="ml-auto">
            <span className="badge badge-blue text-xs">{usuario.rol}</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 pb-28 md:pb-6">

          {/* ── MI PERFIL ── */}
          {seccion === 'perfil' && (
            <div className="max-w-2xl space-y-5">
              <div className="card overflow-hidden">
                <div className="px-6 py-4 flex items-center justify-between"
                  style={{ background: 'linear-gradient(135deg, var(--navy-dark), var(--navy))', borderBottom: '3px solid var(--gold)' }}>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0 group" title="Click para ampliar · Doble click para cambiar foto">
                      <div
                        className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center font-bold text-lg"
                        style={{ background: 'rgba(200,168,75,.2)', color: 'var(--gold)', border: '2px solid rgba(200,168,75,.4)', cursor: 'pointer' }}
                        onClick={() => {
                          if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; inputFotoRef.current?.click(); return }
                          clickTimerRef.current = setTimeout(() => { clickTimerRef.current = null; if (usuario.foto_perfil_url) { setLightboxUrl(usuario.foto_perfil_url); setLightboxNombre(usuario.nombre) } }, 220)
                        }}
                      >
                        {usuario.foto_perfil_url
                          ? <img src={usuario.foto_perfil_url} alt="perfil" className="w-full h-full object-cover" />
                          : usuario.nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
                        }
                      </div>
                      <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                        style={{ background: 'rgba(0,0,0,.5)' }}>
                        {subiendoFotoPerfil
                          ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <Camera size={16} color="white" />
                        }
                      </div>
                      <input ref={inputFotoRef} type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) subirFotoPerfil(f) }} />
                    </div>
                    <div>
                      <div className="font-bold text-white">{registro?.nombre ?? usuario.nombre}</div>
                      <div className="text-xs font-mono" style={{ color: 'rgba(255,255,255,.6)' }}>{usuario.dui}</div>
                      {errorFotoPerfil ? (
                        <label className="cursor-pointer">
                          <div className="text-xs mt-1 px-2 py-1 rounded-lg flex items-center gap-1.5"
                            style={{ background: 'rgba(220,38,38,.2)', color: '#fca5a5', border: '1px solid rgba(220,38,38,.3)' }}>
                            <AlertTriangle size={10} />
                            <span>{errorFotoPerfil}</span>
                            <span className="underline ml-1">Cargar otra</span>
                          </div>
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) subirFotoPerfil(f) }} />
                        </label>
                      ) : (
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.35)' }}>Toca la foto para cambiarla</div>
                      )}
                    </div>
                  </div>
                  {!editando && (
                    <button onClick={() => setEditando(true)} className="btn btn-sm" style={{ background: 'rgba(255,255,255,.1)', color: 'white', border: '1px solid rgba(255,255,255,.2)' }}>
                      <Pencil size={12} /> Editar
                    </button>
                  )}
                </div>

                {!editando ? (
                  <div className="p-4 md:p-6 grid grid-cols-2 gap-4">
                    {[
                      ['Teléfono', registro?.telefono],
                      ['Correo', registro?.correo],
                      ['Dirección', registro?.direccion],
                      ['Cargo', padronInfo?.cargo],
                      ['JRV', padronInfo?.jrv],
                      ['Centro', padronInfo?.centro],
                    ].map(([l, v]) => (
                      <div key={l as string} className={l === 'Dirección' || l === 'Centro' || l === 'Correo' ? 'col-span-2' : ''}>
                        <div className="field-label">{l}</div>
                        <div className="text-sm font-medium" style={{ color: v ? 'var(--texto)' : 'var(--texto-muted)' }}>{v || '—'}</div>
                      </div>
                    ))}
                    {/* Fotos */}
                    {(registro?.foto_frente_url || registro?.foto_reverso_url) && (
                      <>
                        {[{ l: 'Frente del DUI', u: registro?.foto_frente_url }, { l: 'Reverso del DUI', u: registro?.foto_reverso_url }].map(({ l, u }) => (
                          <div key={l}>
                            <div className="field-label mb-1.5">{l}</div>
                            {u ? <a href={u} target="_blank"><img src={u} alt={l} className="w-full rounded-lg object-cover" style={{ border: '1px solid var(--borde)', maxHeight: 110 }} /></a>
                              : <div className="h-20 rounded-lg flex items-center justify-center text-xs" style={{ background: 'var(--fondo)', border: '1px dashed var(--borde)', color: 'var(--texto-muted)' }}>Sin imagen</div>}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-4 md:p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2"><label className="field-label">Nombre completo</label><input type="text" value={formPerfil.nombre} onChange={e => setFormPerfil(p => ({ ...p, nombre: toNombrePropio(e.target.value) }))} className="input" /></div>
                      <div><label className="field-label">Teléfono</label><input type="tel" value={formPerfil.telefono} onChange={e => setFormPerfil(p => ({ ...p, telefono: e.target.value }))} className="input" /></div>
                      <div><label className="field-label">Correo</label><input type="email" value={formPerfil.correo} onChange={e => setFormPerfil(p => ({ ...p, correo: e.target.value }))} className="input" /></div>
                      <div className="sm:col-span-2"><label className="field-label">Dirección</label><input type="text" value={formPerfil.direccion} onChange={e => setFormPerfil(p => ({ ...p, direccion: e.target.value }))} className="input" /></div>
                    </div>
                    {/* Fotos edición */}
                    <div>
                      <label className="field-label mb-3 block">Fotografías del DUI <span className="font-normal" style={{ color: 'var(--texto-muted)' }}>— Opcional</span></label>
                      <div className="grid grid-cols-2 gap-4">
                        {(['frente', 'reverso'] as const).map(lado => {
                          const prev = lado === 'frente' ? frentePreview : reversoPreview
                          const val  = lado === 'frente' ? frenteValido  : reversoValido
                          const val2 = lado === 'frente' ? validandoF    : validandoR
                          const cur  = lado === 'frente' ? registro?.foto_frente_url : registro?.foto_reverso_url
                          return (
                            <div key={lado}>
                              <div className="field-label mb-1.5">{lado === 'frente' ? 'Frente' : 'Reverso'}</div>
                              <label className="block rounded-lg cursor-pointer overflow-hidden"
                                style={{ border: `2px dashed ${val === true ? 'var(--verde)' : val === false ? 'var(--rojo)' : 'var(--borde)'}`, background: val === true ? 'var(--verde-light)' : 'var(--fondo)', minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {prev ? <img src={prev} alt={lado} className="w-full object-cover" style={{ maxHeight: 100 }} />
                                  : cur ? <img src={cur} alt={lado} className="w-full object-cover opacity-40" style={{ maxHeight: 100 }} />
                                  : <div className="text-center p-3"><FileImage size={20} style={{ color: 'var(--texto-muted)', margin: '0 auto 4px' }} /><div className="text-xs" style={{ color: 'var(--texto-muted)' }}>Clic para cargar</div></div>}
                                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFoto(e.target.files[0], lado)} />
                              </label>
                              <div className="flex gap-1.5 mt-1.5">
                                <label className="btn btn-ghost btn-sm flex-1 justify-center cursor-pointer" style={{ fontSize: 11 }}><Upload size={10} /> Galería<input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFoto(e.target.files[0], lado)} /></label>
                                <label className="btn btn-sm flex-1 justify-center cursor-pointer" style={{ background: 'var(--azul-light)', color: 'var(--azul)', border: '1px solid #bfdbfe', fontSize: 11 }}><Camera size={10} /> Cámara<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleFoto(e.target.files[0], lado)} /></label>
                              </div>
                              <div className="text-xs mt-1">
                                {val2 && <span style={{ color: 'var(--amber)' }}>Validando...</span>}
                                {val === true && <span style={{ color: 'var(--verde)' }}>✓ Válida</span>}
                                {val === false && <span style={{ color: 'var(--rojo)' }}>✗ No legible</span>}
                                {!prev && !val2 && <span style={{ color: 'var(--texto-muted)' }}>{cur ? 'Clic para reemplazar' : 'Sin imagen'}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    {!usuario.foto_perfil_url && (
                      <div className="rounded-lg px-3 py-2.5 flex items-center gap-2 text-xs"
                        style={{ background: 'var(--amber-light)', border: '1px solid #fde68a', color: 'var(--amber)' }}>
                        <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                        Debe subir una foto de perfil antes de guardar. Toque su avatar y haga doble clic para cargarla.
                      </div>
                    )}
                    {errorPerfil && <p className="text-xs" style={{ color: 'var(--rojo)' }}>{errorPerfil}</p>}
                    <div className="flex gap-3">
                      <button onClick={() => setEditando(false)} className="btn btn-ghost flex-1 justify-center"><X size={13} /> Cancelar</button>
                      <button onClick={guardarPerfil} disabled={guardandoPerfil} className="btn btn-primary flex-1 justify-center"><Save size={13} />{guardandoPerfil ? 'Guardando...' : 'Guardar'}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MI JRV ── */}
          {seccion === 'jrv' && (
            <div className="max-w-2xl space-y-5">
              {padronInfo ? (
                <>
                  <div className="card p-5" style={{ borderLeft: '4px solid var(--navy)' }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center font-bold text-base flex-shrink-0"
                        style={{ background: 'rgba(200,168,75,.15)', color: 'var(--gold)', border: '2px solid rgba(200,168,75,.35)', cursor: usuario.foto_perfil_url ? 'zoom-in' : 'default' }}
                        onClick={() => { if (usuario.foto_perfil_url) { setLightboxUrl(usuario.foto_perfil_url); setLightboxNombre(usuario.nombre) } }}
                      >
                        {usuario.foto_perfil_url
                          ? <img src={usuario.foto_perfil_url} alt="perfil" className="w-full h-full object-cover" />
                          : usuario.nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
                        }
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{usuario.nombre}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--azul)' }}>{padronInfo.cargo}</div>
                      </div>
                    </div>
                    <div className="field-label mb-3">Mi asignación</div>
                    <div className="grid grid-cols-2 gap-3">
                      {[['JRV', padronInfo.jrv], ['Cargo', padronInfo.cargo], ['Departamento', padronInfo.departamento], ['Municipio', padronInfo.municipio], ['Centro', padronInfo.centro]].map(([l, v]) => (
                        <div key={l} className={l === 'Centro' ? 'col-span-2' : ''}>
                          <div className="field-label">{l}</div>
                          <div className="text-sm font-semibold">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card overflow-hidden">
                    <div className="px-5 py-3 font-semibold text-sm" style={{ background: 'var(--fondo)', borderBottom: '1px solid var(--borde)' }}>
                      Compañeros en JRV {padronInfo.jrv} ({companeros.length})
                    </div>
                    {companeros.length === 0 ? (
                      <div className="p-8 text-center text-sm" style={{ color: 'var(--texto-muted)' }}>No hay otros compañeros registrados en esta JRV</div>
                    ) : companeros.map((c, i) => (
                      <div key={c.id} className="px-5 py-4 flex gap-4"
                        style={{ borderBottom: i < companeros.length - 1 ? '1px solid var(--borde)' : 'none', background: i % 2 === 0 ? 'var(--superficie)' : '#fafafa' }}>
                        {(() => {
                          const fotoComp = (c as RegistroDUI & { foto_perfil_url?: string | null }).foto_perfil_url
                          return (
                            <div
                              className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5"
                              style={{ background: 'var(--azul-light)', color: 'var(--azul)', cursor: fotoComp ? 'zoom-in' : 'default' }}
                              onDoubleClick={() => { if (fotoComp) { setLightboxUrl(fotoComp); setLightboxNombre(c.nombre) } }}
                            >
                              {fotoComp
                                ? <img src={fotoComp} alt={c.nombre} className="w-full h-full object-cover" />
                                : c.nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
                              }
                            </div>
                          )
                        })()}
                        <div className="flex-1 min-w-0 space-y-3">
                          <div>
                            <div className="font-semibold text-sm">{c.nombre}</div>
                            <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--azul)' }}>{(c as RegistroDUI & { padron?: { cargo?: string } }).padron?.cargo ?? '—'}</div>
                          </div>
                          <div className="grid grid-cols-1 xs:grid-cols-2 gap-x-6 gap-y-1.5">
                            <div>
                              <div className="field-label">DUI</div>
                              <div className="text-xs font-mono">{c.dui}</div>
                            </div>
                            <div>
                              <div className="field-label">Teléfono</div>
                              <div className="text-xs">{c.telefono ?? '—'}</div>
                            </div>
                            <div>
                              <div className="field-label">Correo</div>
                              <div className="text-xs break-all">{c.correo ?? '—'}</div>
                            </div>
                            <div>
                              <div className="field-label">Dirección</div>
                              <div className="text-xs">{c.direccion ?? '—'}</div>
                            </div>
                          </div>
                          {(c.foto_frente_url || c.foto_reverso_url) && (
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              {[{ label: 'Frente del DUI', url: c.foto_frente_url }, { label: 'Reverso del DUI', url: c.foto_reverso_url }].map(({ label, url }) => (
                                <div key={label}>
                                  <div className="field-label mb-1">{label}</div>
                                  {url
                                    ? <a href={url} target="_blank"><img src={url} alt={label} className="w-full rounded-lg object-cover" style={{ border: '1px solid var(--borde)', maxHeight: 100 }} /></a>
                                    : <div className="rounded-lg flex items-center justify-center text-xs" style={{ height: 60, background: 'var(--fondo)', border: '1px dashed var(--borde)', color: 'var(--texto-muted)' }}>Sin imagen</div>
                                  }
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="card p-10 text-center" style={{ color: 'var(--texto-muted)' }}>
                  <Users size={32} className="mx-auto mb-3" style={{ opacity: .25 }} />
                  No tiene JRV asignada aún
                </div>
              )}
            </div>
          )}

          {/* ── AGENDA (Eventos + Materiales) ── */}
          {seccion === 'agenda' && (
            <div className="max-w-4xl space-y-4">
              {/* Pestañas */}
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--fondo)', border: '1px solid var(--borde)' }}>
                {([['eventos', Calendar, 'Eventos'], ['materiales', BookOpen, 'Materiales']] as const).map(([tab, Icon, label]) => (
                  <button key={tab} onClick={() => setTabAgenda(tab)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium flex-1 justify-center transition-all"
                    style={{
                      background: tabAgenda === tab ? 'white' : 'transparent',
                      color: tabAgenda === tab ? 'var(--navy)' : 'var(--texto-muted)',
                      boxShadow: tabAgenda === tab ? 'var(--sombra)' : 'none',
                    }}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>

              {/* Tab: Eventos */}
              {tabAgenda === 'eventos' && (
                <div className="space-y-4">
                  {/* Score participación */}
                  {scoreAgenda && scoreAgenda.total > 0 && (() => {
                    const pct = Math.round((scoreAgenda.checkins / scoreAgenda.total) * 100)
                    return (
                      <div className="card p-4 flex items-center gap-4">
                        <div className="relative w-14 h-14 shrink-0">
                          <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(200,168,75,.15)" strokeWidth="3" />
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#c8a84b" strokeWidth="3"
                              strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: '#c8a84b' }}>{pct}%</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: 'var(--texto)' }}>
                            {scoreAgenda.checkins} de {scoreAgenda.total} {scoreAgenda.total === 1 ? 'evento' : 'eventos'} asistidos
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>
                            {scoreAgenda.confirmados} {scoreAgenda.confirmados === 1 ? 'confirmación' : 'confirmaciones'} registradas
                          </p>
                        </div>
                      </div>
                    )
                  })()}
                  {/* Botón nuevo evento (solo admin) */}
                  {esAdmin && (
                    <div className="flex justify-end">
                      <button onClick={abrirNuevoEvento} className="btn btn-primary">
                        <Plus size={14} /> Nuevo evento
                      </button>
                    </div>
                  )}
                  {/* Lista por mes */}
                  {Object.keys(eventosPorMes).length === 0 ? (
                    <div className="card p-10 text-center" style={{ color: 'var(--texto-muted)' }}>
                      <Calendar size={32} className="mx-auto mb-3" style={{ opacity: .25 }} />No hay eventos programados
                    </div>
                  ) : Object.entries(eventosPorMes).map(([mes, evs]) => (
                    <div key={mes} className="card overflow-hidden">
                      <div className="px-5 py-3 font-semibold text-sm" style={{ background: 'var(--fondo)', borderBottom: '1px solid var(--borde)' }}>
                        {new Date(mes + '-01').toLocaleDateString('es-SV', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                      </div>
                      {evs.map((ev: any, i: number) => {
                        const hoy = new Date().toISOString().slice(0, 10)
                        const esHoy = ev.fecha === hoy
                        const esPasado = ev.fecha < hoy
                        const conf = confirmaciones[ev.id]
                        const yaConfirmado = conf?.confirmado === true
                        const yaDeclinado = conf?.confirmado === false
                        const yaCheckin = !!conf?.check_in_at
                        const color = '#2563eb'
                        // Ventana de check-in: hoy, desde la hora del evento (o todo el día si sin hora)
                        let checkInAbierto = false
                        if (esHoy) {
                          if (!ev.hora) { checkInAbierto = true }
                          else {
                            const [hh, mm] = ev.hora.split(':').map(Number)
                            const inicio = new Date(); inicio.setHours(hh, mm - 30, 0, 0) // 30min antes
                            checkInAbierto = new Date() >= inicio
                          }
                        }
                        return (
                          <div key={ev.id} className="px-4 md:px-5 py-4 flex flex-col sm:flex-row gap-3 sm:gap-4"
                            style={{ borderBottom: i < evs.length - 1 ? '1px solid var(--borde)' : 'none', background: i % 2 === 0 ? 'var(--superficie)' : '#fafafa', opacity: !ev.activo ? .55 : 1 }}>
                            {/* Fecha chip */}
                            <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
                              style={{ background: color + '18', border: `1px solid ${color}44` }}>
                              <div className="font-bold text-sm leading-none" style={{ color }}>{new Date(ev.fecha + 'T00:00:00').getDate()}</div>
                              <div className="text-xs" style={{ color, opacity: .7 }}>{new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-SV', { month: 'short' })}</div>
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">{ev.nombre}</span>
                                {!ev.activo && <span className="badge" style={{ background: 'rgba(107,114,128,.1)', color: 'var(--texto-muted)', fontSize: 10 }}>Inactivo</span>}
                                {yaCheckin && <span className="badge" style={{ background: '#dcfce7', color: '#16a34a', fontSize: 10 }}><Check size={8} className="inline mr-0.5" />Presente</span>}
                                {yaConfirmado && !yaCheckin && <span className="badge" style={{ background: '#eff6ff', color: color, fontSize: 10 }}><CheckCircle size={8} className="inline mr-0.5" />Confirmado</span>}
                                {yaDeclinado && <span className="badge" style={{ background: 'rgba(107,114,128,.1)', color: 'var(--texto-muted)', fontSize: 10 }}>No asistirá</span>}
                              </div>
                              {ev.descripcion && <p className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>{ev.descripcion}</p>}
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {ev.hora && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--texto-muted)' }}><Clock size={10} />{ev.hora.slice(0, 5)}{ev.hora_fin ? ` – ${ev.hora_fin.slice(0,5)}` : ''}</span>}
                                {ev.lugar && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--texto-muted)' }}><MapPin size={10} />{ev.lugar}</span>}
                                {ev.transporte_recogida && <span className="badge" style={{ background: color + '18', color, fontSize: 10 }}><Bus size={8} className="inline mr-0.5" />Transporte disponible</span>}
                              </div>
                              {/* Info transporte confirmado */}
                              {yaConfirmado && conf && (conf.necesita_recogida || conf.necesita_regreso) && (
                                <div className="mt-1.5 text-xs flex items-center gap-1.5" style={{ color: color }}>
                                  <Bus size={10} />
                                  {[conf.necesita_recogida && 'Recogida', conf.necesita_regreso && 'Regreso'].filter(Boolean).join(' + ')} solicitado
                                </div>
                              )}
                            </div>
                            {/* Acciones */}
                            <div className="flex gap-2 flex-shrink-0 sm:self-start pl-[52px] sm:pl-0 flex-wrap">
                              {/* Check-in: solo el día del evento, en la ventana de hora */}
                              {checkInAbierto && !yaCheckin && (
                                <button onClick={() => hacerCheckIn(ev.id)} disabled={checkingIn === ev.id}
                                  className="btn btn-sm"
                                  style={{ background: '#16a34a', color: 'white', border: 'none' }}>
                                  {checkingIn === ev.id ? '...' : <><ClipboardCheck size={11} /> Estoy presente</>}
                                </button>
                              )}
                              {yaCheckin && (
                                <span className="btn btn-sm" style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0', cursor: 'default' }}>
                                  <Check size={11} /> Asistencia registrada
                                </span>
                              )}
                              {/* RSVP: eventos futuros o hoy sin check-in aún */}
                              {!esPasado && ev.activo && !yaCheckin && (
                                <button onClick={() => abrirRsvp(ev)}
                                  disabled={guardandoConf === ev.id}
                                  className="btn btn-sm"
                                  style={{
                                    background: yaConfirmado ? '#eff6ff' : yaDeclinado ? 'rgba(107,114,128,.08)' : 'var(--fondo)',
                                    color: yaConfirmado ? color : yaDeclinado ? 'var(--texto-muted)' : 'var(--texto-muted)',
                                    border: `1.5px solid ${yaConfirmado ? color + '44' : 'var(--borde)'}`,
                                  }}>
                                  {yaConfirmado ? <><Pencil size={11} /> Editar confirmación</> : yaDeclinado ? 'Cambiar respuesta' : 'Confirmar asistencia'}
                                </button>
                              )}
                              {/* Compartir — visible para todos */}
                              {(() => {
                                const base = typeof window !== 'undefined' ? window.location.origin : 'https://centro-votacion-gerardo-barrios.vercel.app'
                                const url = `${base}/portal?evento=${ev.id}`
                                return (
                                  <button
                                    onClick={() => { navigator.clipboard.writeText(url).catch(() => {}); setLinkEvento({ nombre: ev.nombre, url }); setLinkCopiado(true) }}
                                    className="btn btn-sm"
                                    style={{ background: 'var(--fondo)', color: 'var(--texto-muted)', border: '1.5px solid var(--borde)' }}
                                    title="Copiar link del evento">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                  </button>
                                )
                              })()}
                              {/* Admin: editar / eliminar */}
                              {esAdmin && (
                                <>
                                  <button onClick={() => abrirEditarEvento({ ...ev, titulo: ev.nombre })}
                                    className="btn btn-sm"
                                    style={{ background: 'var(--fondo)', color: 'var(--texto-muted)', border: '1.5px solid var(--borde)' }}
                                    title="Editar evento">
                                    <Pencil size={11} />
                                  </button>
                                  <button onClick={() => eliminarEvento(ev.id)}
                                    disabled={eliminandoEv === ev.id}
                                    className="btn btn-danger btn-sm"
                                    title="Eliminar evento">
                                    <Trash2 size={11} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: Materiales */}
              {tabAgenda === 'materiales' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {catsMat.map(c => (
                      <button key={c} onClick={() => setFiltroMat(c)} className="btn btn-sm"
                        style={{ background: filtroMat === c ? 'var(--navy)' : 'var(--superficie)', color: filtroMat === c ? 'white' : 'var(--texto-muted)', border: `1.5px solid ${filtroMat === c ? 'var(--navy)' : 'var(--borde)'}` }}>
                        {c}
                      </button>
                    ))}
                  </div>
                  {matsFiltrados.length === 0 ? (
                    <div className="card p-10 text-center" style={{ color: 'var(--texto-muted)' }}>
                      <BookOpen size={32} className="mx-auto mb-3" style={{ opacity: .25 }} />No hay materiales disponibles
                    </div>
                  ) : (
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))' }}>
                      {matsFiltrados.map(m => (
                        <div key={m.id} className="card p-4 flex flex-col gap-3">
                          {m.tipo_mime.startsWith('image/') && <img src={m.archivo_url} alt={m.nombre} className="w-full rounded-lg object-cover" style={{ height: 120 }} />}
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 mt-0.5">{iconoMime(m.tipo_mime)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate">{m.nombre}</div>
                              {m.descripcion && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--texto-muted)' }}>{m.descripcion}</p>}
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="badge badge-blue" style={{ fontSize: 10 }}><Tag size={8} className="inline mr-1" />{m.categoria}</span>
                                <span className="text-xs" style={{ color: 'var(--texto-muted)' }}>{formatBytes(m.tamanio)}</span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => descargarArchivo(m.archivo_url, m.nombre)} className="btn btn-ghost btn-sm justify-center">
                            <Download size={12} /> Descargar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </main>
      </div>

      {/* Modal nuevo/editar evento */}
      {modalEvento && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setModalEvento(false)}>
          <div className="card w-full max-w-md overflow-hidden" style={{ boxShadow: 'var(--sombra-lg)' }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--borde)', background: 'var(--fondo)' }}>
              <div className="font-semibold flex items-center gap-2"><Calendar size={15} style={{ color: '#2563eb' }} />{editandoEvento ? 'Editar evento' : 'Nuevo evento'}</div>
              <button onClick={() => setModalEvento(false)} className="btn btn-ghost btn-sm w-8 h-8 p-0 justify-center"><X size={14} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="field-label">Nombre *</label>
                <input type="text" value={formEv.nombre} onChange={e => setFormEv(p => ({ ...p, nombre: e.target.value }))} className="input" placeholder="Nombre del evento" />
              </div>
              <div>
                <label className="field-label">Descripción</label>
                <textarea value={formEv.descripcion} onChange={e => setFormEv(p => ({ ...p, descripcion: e.target.value }))} className="input" rows={2} placeholder="Descripción opcional" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Fecha *</label>
                  <input type="date" value={formEv.fecha} onChange={e => setFormEv(p => ({ ...p, fecha: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="field-label">Lugar</label>
                  <input type="text" value={formEv.lugar} onChange={e => setFormEv(p => ({ ...p, lugar: e.target.value }))} className="input" placeholder="Lugar" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Hora inicio</label>
                  <input type="time" value={formEv.hora} onChange={e => setFormEv(p => ({ ...p, hora: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="field-label">Hora fin</label>
                  <input type="time" value={formEv.hora_fin} onChange={e => setFormEv(p => ({ ...p, hora_fin: e.target.value }))} className="input" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="field-label">Opciones de transporte</label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={formEv.transporte_recogida} onChange={e => setFormEv(p => ({ ...p, transporte_recogida: e.target.checked }))} />
                  Ofrecer recogida (ida al evento)
                </label>
                {formEv.transporte_recogida && (
                  <label className="flex items-center gap-2 cursor-pointer text-sm ml-5">
                    <input type="checkbox" checked={formEv.recogida_domicilio} onChange={e => setFormEv(p => ({ ...p, recogida_domicilio: e.target.checked }))} />
                    Pasar a recoger en el domicilio de cada colaborador
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={formEv.transporte_regreso} onChange={e => setFormEv(p => ({ ...p, transporte_regreso: e.target.checked }))} />
                  Ofrecer regreso (vuelta a casa)
                </label>
                {formEv.transporte_regreso && (
                  <label className="flex items-center gap-2 cursor-pointer text-sm ml-5">
                    <input type="checkbox" checked={formEv.regreso_domicilio} onChange={e => setFormEv(p => ({ ...p, regreso_domicilio: e.target.checked }))} />
                    Dejar en el domicilio de cada colaborador
                  </label>
                )}
              </div>
              {/* Punto de reunión — solo si algún transporte activo y NO es a domicilio */}
              {(formEv.transporte_recogida || formEv.transporte_regreso) && (!formEv.recogida_domicilio || !formEv.regreso_domicilio) && (
                <div>
                  <label className="field-label">Punto de reunión</label>
                  <input type="text" value={formEv.punto_reunion}
                    onChange={e => setFormEv(p => ({ ...p, punto_reunion: e.target.value }))}
                    className="input" placeholder="Ej: Parque Central de Santa Ana, frente a la alcaldía" />
                  <p className="text-xs mt-1" style={{ color: 'var(--texto-muted)' }}>Se mostrará a los colaboradores al confirmar asistencia.</p>
                </div>
              )}
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={formEv.activo} onChange={e => setFormEv(p => ({ ...p, activo: e.target.checked }))} />
                  Evento activo (visible para confirmaciones)
                </label>
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid var(--borde)', background: 'var(--fondo)' }}>
              <button onClick={() => setModalEvento(false)} className="btn btn-ghost">Cancelar</button>
              <button onClick={guardarEvento} disabled={guardandoEv || !formEv.nombre.trim() || !formEv.fecha}
                className="btn btn-primary" style={{ background: '#2563eb' }}>
                {guardandoEv ? '...' : editandoEvento ? 'Guardar cambios' : 'Crear evento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL LINK COMPARTIBLE ── */}
      {linkEvento && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setLinkEvento(null)}>
          <div className="card w-full max-w-sm overflow-hidden" style={{ boxShadow: 'var(--sombra-lg)' }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--borde)', background: 'var(--fondo)' }}>
              <div className="font-semibold text-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                Link del evento
              </div>
              <button onClick={() => setLinkEvento(null)} className="btn btn-ghost btn-sm w-8 h-8 p-0 justify-center"><X size={14} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--texto-muted)' }}>Evento</p>
                <p className="font-semibold text-sm" style={{ color: 'var(--texto)' }}>{linkEvento.nombre}</p>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--texto-muted)' }}>Link para compartir</p>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0 px-3 py-2 rounded-lg text-xs font-mono truncate"
                    style={{ background: 'var(--fondo)', border: '1px solid var(--borde)', color: 'var(--texto)' }}>
                    {linkEvento.url}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(linkEvento.url).catch(() => {})
                      setLinkCopiado(true)
                      setTimeout(() => { setLinkEvento(null); setLinkCopiado(false) }, 1800)
                    }}
                    className="btn btn-sm flex-shrink-0"
                    style={{
                      background: linkCopiado ? '#dcfce7' : '#2563eb',
                      color: linkCopiado ? '#16a34a' : 'white',
                      border: linkCopiado ? '1px solid #bbf7d0' : 'none',
                      minWidth: 80,
                    }}>
                    {linkCopiado ? <><Check size={11} /> Copiado</> : 'Copiar'}
                  </button>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--texto-muted)' }}>
                Al abrir este link, el colaborador verá directamente el formulario de confirmación de asistencia para este evento.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RSVP ── */}
      {modalRsvp && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setModalRsvp(null)}>
          <div className="card w-full max-w-sm overflow-hidden" style={{ boxShadow: 'var(--sombra-lg)' }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--borde)', background: 'var(--fondo)' }}>
              <div className="font-semibold text-sm flex items-center gap-2">
                <Calendar size={14} style={{ color: '#2563eb' }} />{modalRsvp.nombre}
                {rsvpPaso === 2 && <span className="text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#2563eb' }}>Transporte</span>}
              </div>
              <button onClick={() => { setModalRsvp(null); setRsvpPaso(1) }} className="btn btn-ghost btn-sm w-8 h-8 p-0 justify-center"><X size={14} /></button>
            </div>
            <div className="p-6 space-y-5">
            {rsvpPaso === 1 && (<>
              {/* ¿Asistirás? */}
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--texto)' }}>¿Podremos contar con usted en este evento?</p>
                <p className="text-xs mb-3" style={{ color: 'var(--texto-muted)' }}>Su confirmación nos ayuda a organizar mejor la jornada.</p>
                <div className="grid grid-cols-2 gap-3">
                  {[{ val: true, label: '¡Sí, estaré presente!', icon: CheckCircle, color: '#16a34a' }, { val: false, label: 'No podré asistir', icon: X, color: '#dc2626' }].map(({ val, label, icon: Icon, color }) => (
                    <button key={String(val)} onClick={() => setRsvpConf(p => ({ ...p, confirmado: val }))}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-medium"
                      style={{
                        background: rsvpConf.confirmado === val ? color + '12' : 'var(--fondo)',
                        borderColor: rsvpConf.confirmado === val ? color + '66' : 'var(--borde)',
                        color: rsvpConf.confirmado === val ? color : 'var(--texto-muted)',
                      }}>
                      <Icon size={18} /> {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Justificación de ausencia */}
              {!rsvpConf.confirmado && (
                <div>
                  <label className="text-sm font-semibold block mb-1" style={{ color: 'var(--texto)' }}>
                    ¿Puede indicarnos el motivo? <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <p className="text-xs mb-2" style={{ color: 'var(--texto-muted)' }}>
                    Su justificación nos ayuda a planificar mejor. Será tratada con toda discreción.
                  </p>
                  <textarea
                    rows={3}
                    value={rsvpJustificacion}
                    onChange={e => { setRsvpJustificacion(e.target.value); if (e.target.value.trim()) setRsvpWarnJust(false) }}
                    placeholder="Ej. Compromisos de salud, trabajo, familia…"
                    className="w-full rounded-xl px-3 py-2 text-sm resize-none"
                    style={{
                      border: `1.5px solid ${rsvpWarnJust ? '#dc2626' : 'var(--borde)'}`,
                      background: 'var(--fondo)',
                      color: 'var(--texto)',
                      outline: 'none',
                    }}
                  />
                  {rsvpWarnJust && (
                    <p className="text-xs mt-1" style={{ color: '#dc2626' }}>
                      Por favor indique el motivo antes de enviar su respuesta.
                    </p>
                  )}
                </div>
              )}
              {/* Transporte — solo si confirma asistencia y el evento ofrece */}
              {rsvpConf.confirmado && (modalRsvp.transporte_recogida || modalRsvp.transporte_regreso) && (
                <div>
                  <p className="text-sm font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--texto)' }}>
                    <Bus size={14} style={{ color: '#2563eb' }} /> ¿Necesita apoyo de transporte?
                  </p>
                  <p className="text-xs mb-3" style={{ color: 'var(--texto-muted)' }}>Seleccione las opciones que necesite. No tiene costo.</p>
                  <div className="space-y-2">
                    {modalRsvp.transporte_recogida && (
                      <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                        style={{ background: rsvpConf.necesita_recogida ? '#eff6ff' : 'var(--fondo)', border: `1.5px solid ${rsvpConf.necesita_recogida ? '#93c5fd' : 'var(--borde)'}` }}>
                        <input type="checkbox" checked={rsvpConf.necesita_recogida} onChange={e => setRsvpConf(p => ({ ...p, necesita_recogida: e.target.checked }))} className="w-4 h-4 rounded" />
                        <div>
                          <div className="text-sm font-medium">Transporte de ida</div>
                          <div className="text-xs" style={{ color: 'var(--texto-muted)' }}>
                            {modalRsvp.recogida_domicilio
                              ? 'El vehículo pasará a recogerle directamente en su domicilio.'
                              : modalRsvp.punto_reunion
                                ? <>El vehículo partirá desde el <strong>{modalRsvp.punto_reunion}</strong>. Por favor, preséntese puntualmente en ese lugar.</>
                                : 'El vehículo le trasladará al evento desde el punto de reunión indicado.'}
                          </div>
                        </div>
                      </label>
                    )}
                    {modalRsvp.transporte_regreso && (
                      <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                        style={{ background: rsvpConf.necesita_regreso ? '#eff6ff' : 'var(--fondo)', border: `1.5px solid ${rsvpConf.necesita_regreso ? '#93c5fd' : 'var(--borde)'}` }}>
                        <input type="checkbox" checked={rsvpConf.necesita_regreso} onChange={e => setRsvpConf(p => ({ ...p, necesita_regreso: e.target.checked }))} className="w-4 h-4 rounded" />
                        <div>
                          <div className="text-sm font-medium">Transporte de regreso</div>
                          <div className="text-xs" style={{ color: 'var(--texto-muted)' }}>
                            Al finalizar el evento, el vehículo le llevará de regreso hasta su domicilio o el lugar que usted indique.
                          </div>
                        </div>
                      </label>
                    )}
                  {/* Advertencia: selección de transporte vacía */}
                  {rsvpWarnTransporte && (
                    <div className="mt-3 p-3 rounded-xl text-xs flex flex-col gap-2"
                      style={{ background: '#fef9c3', border: '1px solid #fde047', color: '#854d0e' }}>
                      <p className="font-medium">¿No necesita apoyo de transporte?</p>
                      <p>Si no requiere vehículo, puede continuar sin seleccionar ninguna opción.</p>
                      <button
                        onClick={async () => {
                          setRsvpWarnTransporte(false)
                          // Forzar guardado sin transporte
                          if (!modalRsvp || !usuario) return
                          setGuardandoConf(modalRsvp.id)
                          const payload = {
                            evento_id: modalRsvp.id,
                            usuario_id: usuario.id,
                            confirmado: true,
                            necesita_recogida: false,
                            necesita_regreso: false,
                            fecha_confirmacion: new Date().toISOString(),
                          }
                          const existing = confirmaciones[modalRsvp.id]
                          if (existing) {
                            await supabase.from('confirmaciones_evento').update(payload).eq('id', existing.id)
                            setConfirmaciones(prev => ({ ...prev, [modalRsvp.id]: { ...existing, ...payload } }))
                          } else {
                            const { data } = await supabase.from('confirmaciones_evento').insert(payload).select().single()
                            if (data) setConfirmaciones(prev => ({ ...prev, [modalRsvp.id]: data }))
                          }
                          // Borrar solicitud de transporte previa si existe
                          const duiFmtW = usuario!.dui.replace(/\D/g, '').slice(0, 8) + '-' + usuario!.dui.replace(/\D/g, '').slice(8, 9)
                          const { data: regW } = await supabase.from('registros_dui').select('id').eq('dui', duiFmtW).single()
                          if (regW) await supabase.from('solicitudes_transporte').delete().eq('registro_id', regW.id).eq('evento_id', modalRsvp.id)
                          setGuardandoConf(null)
                          setModalRsvp(null)
                        }}
                        className="self-start px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: '#854d0e', color: '#fff' }}>
                        Confirmar sin transporte
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </>)}

            {/* ── PASO 2: Formulario de transporte inline ── */}
            {rsvpPaso === 2 && (
              <div className="space-y-4">
                {/* Resumen de lo que solicitó */}
                <div className="p-3 rounded-xl space-y-1.5" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <p className="text-xs font-semibold" style={{ color: '#1d4ed8' }}>📋 Resumen de su solicitud</p>
                  {rsvpConf.necesita_recogida && (
                    <p className="text-xs" style={{ color: '#1e40af' }}>
                      🚐 <strong>Transporte de ida</strong> —{' '}
                      {modalRsvp.recogida_domicilio
                        ? 'El vehículo pasará por su domicilio'
                        : modalRsvp.punto_reunion
                          ? `Punto de reunión: ${modalRsvp.punto_reunion}`
                          : 'Desde el punto de reunión indicado'}
                    </p>
                  )}
                  {rsvpConf.necesita_regreso && (
                    <p className="text-xs" style={{ color: '#1e40af' }}>🏠 <strong>Transporte de regreso</strong> — hasta su domicilio o lugar indicado</p>
                  )}
                </div>

                {/* Punto de reunión — si aplica */}
                {!modalRsvp.recogida_domicilio && modalRsvp.punto_reunion && (
                  <div className="p-3 rounded-xl" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: '#c2410c' }}>📍 Punto de reunión</p>
                    <p className="text-sm font-medium" style={{ color: '#9a3412' }}>{modalRsvp.punto_reunion}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#c2410c' }}>Por favor preséntese puntualmente en ese lugar.</p>
                  </div>
                )}

                {/* GPS — siempre al solicitar transporte (sirve para ida a domicilio y para el regreso) */}
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--texto)' }}>
                    📍 {modalRsvp.recogida_domicilio ? 'Su ubicación de recogida' : 'Su ubicación de destino (regreso)'}
                  </p>
                  <p className="text-xs mb-2" style={{ color: 'var(--texto-muted)' }}>
                    {modalRsvp.recogida_domicilio
                      ? 'Necesitamos saber dónde recogerle para organizar la ruta del vehículo.'
                      : 'Registre su ubicación para que el vehículo pueda llevarle de regreso a casa.'}
                  </p>
                  {rsvpGpsLat && rsvpGpsLng ? (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #bbf7d0' }}>
                      <div style={{ position: 'relative', height: 160 }}>
                        <iframe
                          title="Ubicación registrada"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${rsvpGpsLng - 0.004},${rsvpGpsLat - 0.003},${rsvpGpsLng + 0.004},${rsvpGpsLat + 0.003}&layer=mapnik&marker=${rsvpGpsLat},${rsvpGpsLng}`}
                          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                          loading="lazy"
                        />
                        <button onClick={() => setRsvpMapaExpandido(true)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid #d1d5db', color: '#374151' }}
                          title="Ver mapa completo">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                        </button>
                      </div>
                      <div className="flex items-center justify-between px-2.5 py-2" style={{ background: '#f0fdf4' }}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin size={12} style={{ color: '#16a34a', flexShrink: 0 }} />
                          <span className="text-xs font-semibold" style={{ color: '#15803d' }}>Ubicación registrada ✓</span>
                          <span className="text-xs" style={{ color: '#166534' }}>{rsvpGpsLat.toFixed(4)}, {rsvpGpsLng.toFixed(4)}</span>
                        </div>
                        <button onClick={capturarGpsRsvp} disabled={rsvpGpsCapturando}
                          className="text-xs px-2 py-1 rounded-lg flex items-center gap-1 flex-shrink-0" style={{ color: '#15803d', background: '#dcfce7', border: '1px solid #bbf7d0' }}>
                          {rsvpGpsCapturando ? <><Loader2 size={11} className="animate-spin" />Obteniendo...</> : 'Actualizar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--borde)' }}>
                      <div style={{ position: 'relative', height: 140 }}>
                        <iframe
                          title="Mapa de referencia"
                          src="https://www.openstreetmap.org/export/embed.html?bbox=-89.5900,13.9800,-89.5400,14.0100&layer=mapnik"
                          style={{ width: '100%', height: '100%', border: 'none', display: 'block', opacity: 0.7 }}
                          loading="lazy"
                        />
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
                          <span className="text-white text-xs font-medium px-2 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.5)' }}>📍 Su ubicación aún no está registrada</span>
                        </div>
                        <button onClick={() => setRsvpMapaExpandido(true)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid #d1d5db', color: '#374151' }}
                          title="Ver mapa completo">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                        </button>
                      </div>
                      <div className="px-2.5 py-2" style={{ background: 'var(--fondo)' }}>
                        <button onClick={capturarGpsRsvp} disabled={rsvpGpsCapturando}
                          className="w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                          style={{ background: '#2563eb', color: '#fff' }}>
                          {rsvpGpsCapturando
                            ? <><Loader2 size={14} className="animate-spin" /> Obteniendo ubicación...</>
                            : <><MapPin size={14} /> Capturar mi ubicación actual</>}
                        </button>
                      </div>
                    </div>
                  )}
                  {rsvpGpsError && <p className="text-xs mt-1.5" style={{ color: '#dc2626' }}>{rsvpGpsError}</p>}
                </div>
              </div>
            )}
            </div>

            {/* Footer — cambia según el paso */}
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--borde)', background: 'var(--fondo)', justifyContent: rsvpPaso === 2 ? 'space-between' : 'flex-end' }}>
              {rsvpPaso === 2 ? (
                <>
                  <button onClick={() => setRsvpPaso(1)} className="btn btn-ghost text-sm">← Volver</button>
                  <button onClick={confirmarRsvpConTransporte} disabled={rsvpSolicitando || !rsvpGpsLat}
                    className="btn btn-primary text-sm font-semibold flex items-center gap-2"
                    style={{ background: '#16a34a' }}>
                    {rsvpSolicitando
                      ? <><Loader2 size={14} className="animate-spin" />Confirmando...</>
                      : <><CheckCircle size={14} />Confirmar asistencia y transporte</>}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setModalRsvp(null); setRsvpWarnTransporte(false); setRsvpWarnJust(false); setRsvpJustificacion(''); setRsvpPaso(1) }} className="btn btn-ghost">Ahora no</button>
                  <button onClick={guardarRsvp} disabled={!!guardandoConf}
                    className="btn btn-primary"
                    style={{ background: rsvpConf.confirmado ? '#16a34a' : '#dc2626' }}>
                    {guardandoConf ? '...' : rsvpConf.confirmado ? 'Guardar mi confirmación' : 'Enviar respuesta'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MAPA FULLSCREEN ── */}
      {rsvpMapaExpandido && (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#000' }}>
          {/* Barra superior */}
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ background: '#1e293b' }}>
            <div className="flex items-center gap-2">
              <MapPin size={14} style={{ color: '#60a5fa' }} />
              <span className="text-sm font-semibold text-white">
                {rsvpGpsLat && rsvpGpsLng ? 'Su ubicación registrada' : 'Mapa de referencia — Santa Ana'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {rsvpGpsLat && rsvpGpsLng && (
                <span className="text-xs" style={{ color: '#94a3b8' }}>{rsvpGpsLat.toFixed(5)}, {rsvpGpsLng.toFixed(5)}</span>
              )}
              <button onClick={() => setRsvpMapaExpandido(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                <X size={16} />
              </button>
            </div>
          </div>
          {/* Mapa */}
          <div className="flex-1 relative">
            <iframe
              title="Mapa pantalla completa"
              src={rsvpGpsLat && rsvpGpsLng
                ? `https://www.openstreetmap.org/export/embed.html?bbox=${rsvpGpsLng - 0.012},${rsvpGpsLat - 0.009},${rsvpGpsLng + 0.012},${rsvpGpsLat + 0.009}&layer=mapnik&marker=${rsvpGpsLat},${rsvpGpsLng}`
                : 'https://www.openstreetmap.org/export/embed.html?bbox=-89.6200,13.9600,-89.5100,14.0300&layer=mapnik'}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          </div>
          {/* Pie */}
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0 gap-3" style={{ background: '#1e293b' }}>
            <button onClick={capturarGpsRsvp} disabled={rsvpGpsCapturando}
              className="flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: '#2563eb', color: '#fff' }}>
              {rsvpGpsCapturando
                ? <><Loader2 size={14} className="animate-spin" /> Obteniendo ubicación...</>
                : <><MapPin size={14} /> {rsvpGpsLat ? 'Actualizar mi ubicación' : 'Capturar mi ubicación'}</>}
            </button>
            <button onClick={() => setRsvpMapaExpandido(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)' }}
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <img
              src={lightboxUrl}
              alt={lightboxNombre}
              className="w-full rounded-2xl object-cover shadow-2xl"
              style={{ maxHeight: '75vh' }}
            />
            <div className="mt-3 text-center text-white font-semibold text-sm">{lightboxNombre}</div>
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)' }}
            >
              <X size={14} color="white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
