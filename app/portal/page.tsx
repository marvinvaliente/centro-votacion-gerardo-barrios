'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  User, BookOpen, Calendar, Users, LogOut, Pencil, Save, X,
  Upload, Camera, FileImage, CheckCircle, AlertTriangle, Download,
  ChevronRight, Plus, Trash2, Clock, MapPin, Tag,
  FileText, Video, File, Music, ShieldAlert, Check
} from 'lucide-react'
import LogoUrna from '@/components/LogoUrna'
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

interface Actividad {
  id: string; titulo: string; descripcion: string | null; fecha: string
  hora: string | null; lugar: string | null; tipo: string; creado_por: string | null
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

const TIPOS_ACTIVIDAD = ['general', 'capacitación', 'reunión']

type Seccion = 'perfil' | 'jrv' | 'materiales' | 'calendario'

export default function PortalPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [dui, setDui]         = useState('')
  const [errorLogin, setErrorLogin] = useState('')
  const [cargandoLogin, setCargandoLogin] = useState(false)
  const [seccion, setSeccion] = useState<Seccion>('perfil')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
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

  // Calendario
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [modalActividad, setModalActividad] = useState(false)
  const [formAct, setFormAct]         = useState({ titulo: '', descripcion: '', fecha: '', hora: '', lugar: '', tipo: 'general' })
  const [guardandoAct, setGuardandoAct] = useState(false)
  const [eliminandoAct, setEliminandoAct] = useState<string | null>(null)

  // Asistencia
  const [asistencias, setAsistencias]           = useState<Record<string, boolean | null>>({})
  const [guardandoAsist, setGuardandoAsist]     = useState<string | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) { const u = JSON.parse(stored); setUsuario(u); cargarDatos(u) }
  }, [])

  function formatDUI(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 9)
    if (d.length > 8) return d.slice(0, 8) + '-' + d.slice(8)
    if (d.length === 8) return d + '-'
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
    window.location.href = '/admin'
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
    if ('FaceDetector' in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).FaceDetector({ fastMode: false, maxDetectedFaces: 5 })
        const img = new Image()
        img.src = objectUrl
        await new Promise(r => { img.onload = r })
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
      } catch {
        // Si falla la detección, se permite continuar
      }
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
    const { data: acts } = await supabase.from('actividades').select('*').order('fecha').order('hora')
    if (acts) setActividades(acts)
    // Cargar asistencias del usuario
    const { data: asist } = await supabase.from('asistencias').select('actividad_id, presente').eq('usuario_id', u.id)
    if (asist) {
      const map: Record<string, boolean | null> = {}
      asist.forEach((a: { actividad_id: string; presente: boolean | null }) => { map[a.actividad_id] = a.presente })
      setAsistencias(map)
    }
  }

  function cerrarSesion() { sessionStorage.removeItem(SESSION_KEY); setUsuario(null); setDui('') }

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

  // ── Actividades ──
  async function crearActividad() {
    if (!formAct.titulo.trim() || !formAct.fecha) { return }
    setGuardandoAct(true)
    const { data } = await supabase.from('actividades').insert({ ...formAct, titulo: formAct.titulo.trim(), descripcion: formAct.descripcion || null, hora: formAct.hora || null, lugar: formAct.lugar || null, creado_por: usuario!.id }).select().single()
    if (data) setActividades(prev => [...prev, data].sort((a, b) => a.fecha.localeCompare(b.fecha)))
    setGuardandoAct(false); setModalActividad(false); setFormAct({ titulo: '', descripcion: '', fecha: '', hora: '', lugar: '', tipo: 'general' })
  }

  async function confirmarAsistencia(actividadId: string) {
    if (!usuario) return
    setGuardandoAsist(actividadId)
    const actual = asistencias[actividadId]
    if (actual === undefined || actual === null) {
      await supabase.from('asistencias').upsert({ actividad_id: actividadId, usuario_id: usuario.id, presente: true, marcado_por: 'colaborador' }, { onConflict: 'actividad_id,usuario_id' })
      setAsistencias(prev => ({ ...prev, [actividadId]: true }))
    } else {
      await supabase.from('asistencias').delete().eq('actividad_id', actividadId).eq('usuario_id', usuario.id)
      const copia = { ...asistencias }
      delete copia[actividadId]
      setAsistencias(copia)
    }
    setGuardandoAsist(null)
  }

  async function eliminarActividad(id: string) {
    if (!confirm('¿Eliminar esta actividad?')) return
    setEliminandoAct(id)
    await supabase.from('actividades').delete().eq('id', id)
    setActividades(prev => prev.filter(a => a.id !== id))
    setEliminandoAct(null)
  }

  // Categorías de materiales
  const catsMat = ['Todas', ...Array.from(new Set(materiales.map(m => m.categoria)))]
  const matsFiltrados = materiales.filter(m => filtroMat === 'Todas' || m.categoria === filtroMat)

  // Agrupar actividades por mes
  const actsPorMes = actividades.reduce((acc, a) => {
    const mes = a.fecha.slice(0, 7)
    if (!acc[mes]) acc[mes] = []
    acc[mes].push(a); return acc
  }, {} as Record<string, Actividad[]>)

  const TIPO_COLORES: Record<string, string> = { 'capacitación': 'var(--azul)', 'reunión': 'var(--verde)', 'general': 'var(--navy)' }

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
                : <p className="text-xs mb-4 text-center" style={{ color: 'rgba(255,255,255,.3)' }}>Formato: 12345678-9</p>
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
                  <div className="px-7 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(200,168,75,.08)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                      style={{ background: 'rgba(200,168,75,.18)', border: '1px solid rgba(200,168,75,.3)' }}>
                      {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : <LogoUrna size={20} />}
                    </div>
                    <div>
                      <h2 className="font-bold text-white text-base leading-tight">Nuevo registro</h2>
                      <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,.4)' }}>{dui}</p>
                    </div>
                  </div>

                  <div className="p-7 space-y-3">
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
                <div className="p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                    style={{ background: 'rgba(5,150,105,.15)', border: '1px solid rgba(5,150,105,.3)' }}>
                    <Check size={30} style={{ color: '#34d399' }} />
                  </div>
                  <h2 className="font-bold text-white text-xl mb-2">¡Solicitud enviada!</h2>
                  <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,.5)', lineHeight: 1.7 }}>
                    Su registro ha sido recibido. El equipo administrativo revisará su solicitud y le habilitará el acceso al portal.
                  </p>
                  <button onClick={() => { setVistaLogin('dui'); setErrorLogin(''); resetFormReg() }}
                    className="w-full py-3 rounded-xl text-sm font-medium"
                    style={{ background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.12)' }}>
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
  const NAV = [
    { key: 'perfil',      label: 'Mi Perfil',        icon: User },
    { key: 'jrv',         label: 'Mi JRV',            icon: Users },
    { key: 'materiales',  label: 'Capacitaciones',    icon: BookOpen },
    { key: 'calendario',  label: 'Calendario',        icon: Calendar },
  ] as const

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
          {NAV.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setSeccion(key as Seccion)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left"
              style={{
                background: seccion === key ? 'rgba(200,168,75,.18)' : 'transparent',
                color: seccion === key ? '#c8a84b' : 'rgba(255,255,255,.6)',
                borderLeft: seccion === key ? '3px solid #c8a84b' : '3px solid transparent',
              }}>
              <Icon size={15} className="flex-shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>
        <div className="px-2 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 12 }}>
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex"
        style={{ background: 'var(--navy-dark)', borderTop: '1px solid rgba(255,255,255,.1)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setSeccion(key as Seccion)}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
            style={{ color: seccion === key ? 'var(--gold)' : 'rgba(255,255,255,.4)', minHeight: 56 }}>
            <Icon size={18} />
            <span style={{ fontSize: 10, fontWeight: seccion === key ? 600 : 400 }}>{label}</span>
          </button>
        ))}
        <button onClick={cerrarSesion}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
          style={{ color: 'rgba(255,255,255,.4)', minHeight: 56 }}>
          <LogOut size={18} />
          <span style={{ fontSize: 10 }}>Salir</span>
        </button>
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

        <main className="flex-1 overflow-auto p-4 md:p-6 pb-24 md:pb-6">

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
                  <div className="p-6 grid grid-cols-2 gap-4">
                    {[
                      ['Teléfono', registro?.telefono],
                      ['Correo', registro?.correo],
                      ['Dirección', registro?.direccion],
                      ['Cargo', padronInfo?.cargo],
                      ['JRV', padronInfo?.jrv],
                      ['Centro', padronInfo?.centro],
                    ].map(([l, v]) => (
                      <div key={l as string} className={l === 'Dirección' || l === 'Centro' ? 'col-span-2' : ''}>
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
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2"><label className="field-label">Nombre completo</label><input type="text" value={formPerfil.nombre} onChange={e => setFormPerfil(p => ({ ...p, nombre: toNombrePropio(e.target.value) }))} className="input" /></div>
                      <div><label className="field-label">Teléfono</label><input type="tel" value={formPerfil.telefono} onChange={e => setFormPerfil(p => ({ ...p, telefono: e.target.value }))} className="input" /></div>
                      <div><label className="field-label">Correo</label><input type="email" value={formPerfil.correo} onChange={e => setFormPerfil(p => ({ ...p, correo: e.target.value }))} className="input" /></div>
                      <div className="col-span-2"><label className="field-label">Dirección</label><input type="text" value={formPerfil.direccion} onChange={e => setFormPerfil(p => ({ ...p, direccion: e.target.value }))} className="input" /></div>
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
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
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
                              <div className="text-xs truncate">{c.correo ?? '—'}</div>
                            </div>
                            <div>
                              <div className="field-label">Dirección</div>
                              <div className="text-xs truncate">{c.direccion ?? '—'}</div>
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

          {/* ── MATERIALES ── */}
          {seccion === 'materiales' && (
            <div className="max-w-4xl space-y-4">
              <div className="flex flex-wrap gap-2 mb-2">
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

          {/* ── CALENDARIO ── */}
          {seccion === 'calendario' && (
            <div className="max-w-2xl space-y-5">
              <div className="flex justify-end">
                <button onClick={() => setModalActividad(true)} className="btn btn-primary">
                  <Plus size={14} /> Nueva actividad
                </button>
              </div>
              {Object.keys(actsPorMes).length === 0 ? (
                <div className="card p-10 text-center" style={{ color: 'var(--texto-muted)' }}>
                  <Calendar size={32} className="mx-auto mb-3" style={{ opacity: .25 }} />No hay actividades programadas
                </div>
              ) : Object.entries(actsPorMes).map(([mes, acts]) => (
                <div key={mes} className="card overflow-hidden">
                  <div className="px-5 py-3 font-semibold text-sm" style={{ background: 'var(--fondo)', borderBottom: '1px solid var(--borde)' }}>
                    {new Date(mes + '-01').toLocaleDateString('es-SV', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                  </div>
                  {acts.map((a, i) => (
                    <div key={a.id} className="px-5 py-3 flex gap-4"
                      style={{ borderBottom: i < acts.length - 1 ? '1px solid var(--borde)' : 'none', background: i % 2 === 0 ? 'var(--superficie)' : '#fafafa' }}>
                      <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
                        style={{ background: TIPO_COLORES[a.tipo] + '18', border: `1px solid ${TIPO_COLORES[a.tipo]}44` }}>
                        <div className="font-bold text-sm leading-none" style={{ color: TIPO_COLORES[a.tipo] }}>{new Date(a.fecha + 'T00:00:00').getDate()}</div>
                        <div className="text-xs" style={{ color: TIPO_COLORES[a.tipo], opacity: .7 }}>{new Date(a.fecha + 'T00:00:00').toLocaleDateString('es-SV', { month: 'short' })}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{a.titulo}</div>
                        {a.descripcion && <p className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>{a.descripcion}</p>}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {a.hora && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--texto-muted)' }}><Clock size={10} />{a.hora.slice(0, 5)}</span>}
                          {a.lugar && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--texto-muted)' }}><MapPin size={10} />{a.lugar}</span>}
                          <span className="badge" style={{ background: TIPO_COLORES[a.tipo] + '18', color: TIPO_COLORES[a.tipo], fontSize: 10 }}>{a.tipo}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0 self-start">
                        <button
                          onClick={() => confirmarAsistencia(a.id)}
                          disabled={guardandoAsist === a.id}
                          className="btn btn-sm"
                          style={{
                            background: asistencias[a.id] === true ? 'var(--verde-light)' : 'var(--fondo)',
                            color:      asistencias[a.id] === true ? 'var(--verde)' : 'var(--texto-muted)',
                            border:     `1.5px solid ${asistencias[a.id] === true ? '#a7f3d0' : 'var(--borde)'}`,
                          }}>
                          {guardandoAsist === a.id ? '...' : asistencias[a.id] === true ? <><CheckCircle size={11} /> Confirmado</> : 'Confirmar asistencia'}
                        </button>
                        {a.creado_por === usuario.id && (
                          <button onClick={() => eliminarActividad(a.id)} disabled={eliminandoAct === a.id} className="btn btn-danger btn-sm">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modal nueva actividad */}
      {modalActividad && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setModalActividad(false)}>
          <div className="card w-full max-w-md overflow-hidden" style={{ boxShadow: 'var(--sombra-lg)' }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--borde)', background: 'var(--fondo)' }}>
              <div className="font-semibold flex items-center gap-2"><Calendar size={15} /> Nueva actividad</div>
              <button onClick={() => setModalActividad(false)} className="btn btn-ghost btn-sm w-8 h-8 p-0 justify-center"><X size={14} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="field-label">Título *</label><input type="text" value={formAct.titulo} onChange={e => setFormAct(p => ({ ...p, titulo: e.target.value }))} className="input" placeholder="Nombre de la actividad" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="field-label">Fecha *</label><input type="date" value={formAct.fecha} onChange={e => setFormAct(p => ({ ...p, fecha: e.target.value }))} className="input" /></div>
                <div><label className="field-label">Hora</label><input type="time" value={formAct.hora} onChange={e => setFormAct(p => ({ ...p, hora: e.target.value }))} className="input" /></div>
              </div>
              <div><label className="field-label">Lugar</label><input type="text" value={formAct.lugar} onChange={e => setFormAct(p => ({ ...p, lugar: e.target.value }))} className="input" placeholder="Ubicación" /></div>
              <div><label className="field-label">Tipo</label>
                <div className="flex flex-wrap gap-1.5">
                  {TIPOS_ACTIVIDAD.map(t => (
                    <button key={t} onClick={() => setFormAct(p => ({ ...p, tipo: t }))} className="btn btn-sm capitalize"
                      style={{ background: formAct.tipo === t ? TIPO_COLORES[t] : 'var(--fondo)', color: formAct.tipo === t ? 'white' : 'var(--texto-muted)', border: `1.5px solid ${formAct.tipo === t ? TIPO_COLORES[t] : 'var(--borde)'}` }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="field-label">Descripción</label><textarea value={formAct.descripcion} onChange={e => setFormAct(p => ({ ...p, descripcion: e.target.value }))} rows={2} className="input resize-none" placeholder="Descripción opcional..." /></div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setModalActividad(false)} className="btn btn-ghost flex-1 justify-center">Cancelar</button>
              <button onClick={crearActividad} disabled={guardandoAct || !formAct.titulo || !formAct.fecha} className="btn btn-primary flex-1 justify-center">
                <Plus size={14} />{guardandoAct ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
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
