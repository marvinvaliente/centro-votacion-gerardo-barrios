'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import {
  MapPin, Bus, Calendar, CheckCircle, XCircle, Clock,
  ChevronLeft, Loader2, ExternalLink, Map, X, Navigation, Truck, Phone
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Registro = {
  id: string
  dui: string
  nombre: string
  telefono: string | null
  cargo: string
  jrv: string
  latitud: number | null
  longitud: number | null
  coordenadas_at: string | null
}

type Evento = {
  id: string
  nombre: string
  descripcion: string | null
  fecha: string
  hora: string | null
  hora_fin: string | null
  lugar: string | null
  evento_latitud: number | null
  evento_longitud: number | null
  transporte_recogida: boolean
  transporte_regreso: boolean
  activo: boolean
  punto_reunion_nombre: string | null
  punto_reunion_lat: number | null
  punto_reunion_lng: number | null
}

type Solicitud = {
  id: string
  evento_id: string
  estado: string
  solicita_recogida: boolean
  solicita_regreso: boolean
  motorista_id: string | null
  motorista_nombre: string | null
  motorista_telefono: string | null
  created_at: string
  tipo_recogida: 'domicilio' | 'punto_reunion' | null
}

type Vista = 'login' | 'perfil'

// Centro de El Salvador por defecto (Santa Ana)
const DEFAULT_LAT = 13.9942
const DEFAULT_LNG = -89.5629

/** Convierte "HH:MM" o "HH:MM:SS" (24h) a "h:MM AM/PM" */
function fmt12(hora: string | null | undefined): string {
  if (!hora) return ''
  const [h, m] = hora.slice(0, 5).split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Devuelve true si ya pasaron 30 min desde la hora de finalización del evento */
function eventoVencido(ev: Evento): boolean {
  if (!ev.hora_fin) return false
  // Construir fecha+hora de cierre: fecha del evento + hora_fin + 30 min
  const [h, m] = ev.hora_fin.slice(0, 5).split(':').map(Number)
  const cierre = new Date(`${ev.fecha}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
  cierre.setMinutes(cierre.getMinutes() + 30)
  return new Date() > cierre
}

/** Distancia Haversine en km */
function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDui(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 9) return `${digits.slice(0, 8)}-${digits.slice(8)}`
  return raw
}

function estadoColor(estado: string) {
  if (estado === 'aprobado') return 'text-green-600 bg-green-50'
  if (estado === 'rechazado') return 'text-red-600 bg-red-50'
  return 'text-yellow-700 bg-yellow-50'
}

function estadoIcon(estado: string) {
  if (estado === 'aprobado') return <CheckCircle className="w-4 h-4" />
  if (estado === 'rechazado') return <XCircle className="w-4 h-4" />
  return <Clock className="w-4 h-4" />
}

// ── Modal con mapa Leaflet ───────────────────────────────────
function MapaModal({
  latInicial,
  lngInicial,
  onConfirmar,
  onCerrar,
}: {
  latInicial: number | null
  lngInicial: number | null
  onConfirmar: (lat: number, lng: number) => void
  onCerrar: () => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [selLat, setSelLat] = useState<number | null>(latInicial)
  const [selLng, setSelLng] = useState<number | null>(lngInicial)
  const [cargandoMapa, setCargandoMapa] = useState(true)
  const [buscandoPos, setBuscandoPos] = useState(false)

  useEffect(() => {
    // Cargar CSS de Leaflet
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Cargar JS de Leaflet
    function initMap(L: any) {
      if (!mapRef.current || mapInstanceRef.current) return

      const initLat = latInicial ?? DEFAULT_LAT
      const initLng = lngInicial ?? DEFAULT_LNG
      const zoom = latInicial ? 16 : 13

      const map = L.map(mapRef.current, { zoomControl: true }).setView([initLat, initLng], zoom)
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      // Icono personalizado
      const icon = L.divIcon({
        html: `<div style="background:#2563eb;border:3px solid white;border-radius:50%;width:22px;height:22px;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        className: '',
      })

      // Si ya hay coordenadas, poner marcador
      if (latInicial && lngInicial) {
        markerRef.current = L.marker([latInicial, lngInicial], { icon, draggable: true }).addTo(map)
        markerRef.current.on('dragend', (e: any) => {
          const pos = e.target.getLatLng()
          setSelLat(pos.lat)
          setSelLng(pos.lng)
        })
      }

      // Click en mapa pone/mueve marcador
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng
        setSelLat(lat)
        setSelLng(lng)
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map)
          markerRef.current.on('dragend', (ev: any) => {
            const pos = ev.target.getLatLng()
            setSelLat(pos.lat)
            setSelLng(pos.lng)
          })
        }
      })

      setCargandoMapa(false)
    }

    if ((window as any).L) {
      initMap((window as any).L)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => initMap((window as any).L)
    document.head.appendChild(script)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function irAUbicacionActual() {
    if (!navigator.geolocation) return
    setBuscandoPos(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setSelLat(lat)
        setSelLng(lng)
        setBuscandoPos(false)

        const L = (window as any).L
        const map = mapInstanceRef.current
        if (!L || !map) return

        map.setView([lat, lng], 17)

        const icon = L.divIcon({
          html: `<div style="background:#2563eb;border:3px solid white;border-radius:50%;width:22px;height:22px;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
          iconSize: [22, 22], iconAnchor: [11, 11], className: '',
        })

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map)
          markerRef.current.on('dragend', (e: any) => {
            const p = e.target.getLatLng()
            setSelLat(p.lat)
            setSelLng(p.lng)
          })
        }
      },
      () => setBuscandoPos(false),
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="flex flex-col bg-white w-full h-full max-w-2xl mx-auto sm:my-4 sm:rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-semibold text-gray-900 text-sm">¿Dónde te dejamos?</p>
              <p className="text-xs text-gray-400">Marcá tu vivienda u otro destino al regreso</p>
            </div>
          </div>
          <button onClick={onCerrar} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Barra de acciones */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 shrink-0 flex items-center gap-2 flex-wrap">
          <button
            onClick={irAUbicacionActual}
            disabled={buscandoPos}
            className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg transition-colors"
          >
            {buscandoPos
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Navigation className="w-4 h-4" />}
            Usar mi ubicación actual
          </button>
          {selLat && selLng && (
            <span className="text-xs text-gray-500 font-mono">
              {selLat.toFixed(5)}, {selLng.toFixed(5)}
            </span>
          )}
        </div>

        {/* Mapa */}
        <div className="relative flex-1 min-h-0">
          {cargandoMapa && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
        </div>

        {/* Instrucción + confirmar */}
        <div className="px-4 py-3 bg-white border-t border-gray-100 shrink-0 space-y-2">
          {!selLat && (
            <p className="text-xs text-gray-400 text-center">
              Tocá tu vivienda u otro punto donde querés que te dejemos al regreso
            </p>
          )}
          <button
            onClick={() => selLat && selLng && onConfirmar(selLat, selLng)}
            disabled={!selLat || !selLng}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {selLat ? 'Confirmar mi destino' : 'Seleccioná un punto en el mapa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Acciones de transporte por evento ───────────────────────
function TransporteAcciones({
  ev,
  sol,
  solicitando,
  tieneGps,
  onSolicitar,
  onCancelar,
}: {
  ev: Evento
  sol: Solicitud | undefined
  solicitando: boolean
  tieneGps: boolean
  onSolicitar: (opts: { recogida: boolean; regreso: boolean; tipo_recogida?: 'domicilio' | 'punto_reunion' }) => void
  onCancelar: () => void
}) {
  const [selRecogida, setSelRecogida] = useState(false)
  const [selRegreso, setSelRegreso]   = useState(false)
  const [tipoRecogida, setTipoRecogida] = useState<'domicilio' | 'punto_reunion'>('domicilio')
  const [tooltipVisible, setTooltipVisible] = useState<'recogida' | 'regreso' | null>(null)
  const tienePuntoReunion = !!(ev.punto_reunion_lat && ev.punto_reunion_lng)

  const tieneAlguno = ev.transporte_recogida || ev.transporte_regreso
  const ningunaSeleccionada = !selRecogida && !selRegreso
  const vencido = eventoVencido(ev)

  // Sin transporte configurado
  if (!tieneAlguno) {
    return (
      <div className="mt-3 text-xs text-gray-400 italic text-center py-1">
        Sin transporte disponible para este evento
      </div>
    )
  }

  // Evento cerrado para solicitudes
  if (vencido && !sol) {
    return (
      <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center">
        <p className="text-xs text-gray-500 font-medium">⏱ Ya no es posible solicitar transporte</p>
        <p className="text-xs text-gray-400">El tiempo para registrar tu solicitud para este evento ha finalizado. ¡Gracias!</p>
      </div>
    )
  }

  // Ya tiene solicitud: mostrar estado y motorista
  if (sol) {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full ${estadoColor(sol.estado)}`}>
            {estadoIcon(sol.estado)}
            Transporte solicitado
          </span>
          {!vencido && (
            <button onClick={onCancelar} className="text-xs text-red-500 hover:text-red-700 underline">
              Cancelar
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {sol.solicita_recogida && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🚐 Llevarme al evento</span>
          )}
          {sol.solicita_recogida && sol.tipo_recogida === 'punto_reunion' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">📍 Punto de reunión</span>
          )}
          {sol.solicita_regreso && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">🏠 Llevarme a casa</span>
          )}
        </div>
        {/* Motorista asignado */}
        {sol.motorista_nombre ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
            <div className="bg-blue-600 text-white rounded-full p-1.5 shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-blue-800">Tu motorista para este evento</p>
              <p className="text-sm text-blue-900 font-medium leading-tight">{sol.motorista_nombre}</p>
              {sol.motorista_telefono && (
                <a href={`tel:${sol.motorista_telefono}`}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-0.5">
                  <Phone className="w-3 h-3" />{sol.motorista_telefono}
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">🕐 En breve se te asignará un motorista. ¡Gracias por tu paciencia!</p>
        )}
      </div>
    )
  }

  // No ha solicitado aún — redirigir al portal para solicitar
  return (
    <div className="mt-3">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl flex-shrink-0">🗓️</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-900 leading-tight">
            ¿Necesitás transporte para este evento?
          </p>
          <p className="text-xs text-blue-700 mt-1 leading-relaxed">
            Para solicitar transporte, confirmá tu asistencia desde el{' '}
            <strong>Portal de colaboradores</strong>. Ahí podés indicar si necesitás
            que te lleven al evento, que te regresen, o ambas opciones — todo en un solo paso. 😊
          </p>
          <a
            href="/portal"
            className="inline-flex items-center gap-1.5 mt-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Ir al Portal
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────
function TransporteInner() {
  const searchParams = useSearchParams()
  const [vista, setVista] = useState<Vista>('login')
  const [duiInput, setDuiInput] = useState('')
  const [registro, setRegistro] = useState<Registro | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [gpsEstado, setGpsEstado] = useState<'idle' | 'cargando' | 'ok' | 'error'>('idle')
  const [gpsMsg, setGpsMsg] = useState('')
  const [solicitando, setSolicitando] = useState<string | null>(null)
  const [mostrarMapa, setMostrarMapa] = useState(false)

  // Auto-login: primero URL, luego sessionStorage del portal
  useEffect(() => {
    const duiParam = searchParams.get('dui') || (() => {
      try {
        const sess = sessionStorage.getItem('portal_usuario')
        if (sess) return JSON.parse(sess).dui ?? null
        const adminDui = sessionStorage.getItem('admin_dui')
        return adminDui ?? null
      } catch { return null }
    })()
    if (duiParam) {
      setDuiInput(duiParam)
      buscarPorDuiDirecto(duiParam)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buscarPorDuiDirecto(duiValor: string) {
    setError('')
    setCargando(true)
    const dui = formatDui(duiValor.trim())
    try {
      const { data, error: err } = await supabase
        .from('registros_dui')
        .select(`
          id, dui, nombre, telefono,
          latitud, longitud, coordenadas_at,
          padron:padron_id (cargo, jrv)
        `)
        .eq('dui', dui)
        .single()

      if (err || !data) {
        setError('DUI no encontrado. Verificá el número e intentá de nuevo.')
        setCargando(false)
        return
      }

      const reg: Registro = {
        id: data.id,
        dui: data.dui,
        nombre: data.nombre,
        telefono: data.telefono,
        cargo: (data.padron as any)?.cargo ?? 'Sin asignar',
        jrv: (data.padron as any)?.jrv ?? '-',
        latitud: data.latitud,
        longitud: data.longitud,
        coordenadas_at: data.coordenadas_at,
      }

      const { data: evs } = await supabase
        .from('eventos_transporte')
        .select('*')
        .eq('activo', true)
        .order('fecha', { ascending: true })

      const { data: sols } = await supabase
        .from('solicitudes_transporte')
        .select(`
          id, evento_id, estado, solicita_recogida, solicita_regreso, motorista_id, created_at, tipo_recogida,
          motorista:motorista_id (nombre, telefono)
        `)
        .eq('registro_id', reg.id)

      setRegistro(reg)
      setEventos(evs ?? [])
      setSolicitudes(
        (sols ?? []).map((s: any) => ({
          id: s.id, evento_id: s.evento_id, estado: s.estado,
          solicita_recogida: s.solicita_recogida, solicita_regreso: s.solicita_regreso,
          motorista_id: s.motorista_id ?? null,
          motorista_nombre: s.motorista?.nombre ?? null,
          motorista_telefono: s.motorista?.telefono ?? null,
          tipo_recogida: s.tipo_recogida ?? 'domicilio',
          created_at: s.created_at,
        }))
      )
      setVista('perfil')
    } finally {
      setCargando(false)
    }
  }

  async function buscarPorDui() {
    setError('')
    setCargando(true)
    const dui = formatDui(duiInput.trim())
    try {
      const { data, error: err } = await supabase
        .from('registros_dui')
        .select(`
          id, dui, nombre, telefono,
          latitud, longitud, coordenadas_at,
          padron:padron_id (cargo, jrv)
        `)
        .eq('dui', dui)
        .single()

      if (err || !data) {
        setError('DUI no encontrado. Verificá el número e intentá de nuevo.')
        setCargando(false)
        return
      }

      const reg: Registro = {
        id: data.id,
        dui: data.dui,
        nombre: data.nombre,
        telefono: data.telefono,
        cargo: (data.padron as any)?.cargo ?? 'Sin asignar',
        jrv: (data.padron as any)?.jrv ?? '-',
        latitud: data.latitud,
        longitud: data.longitud,
        coordenadas_at: data.coordenadas_at,
      }

      const { data: evs } = await supabase
        .from('eventos_transporte')
        .select('*')
        .eq('activo', true)
        .order('fecha', { ascending: true })

      const { data: sols } = await supabase
        .from('solicitudes_transporte')
        .select(`
          id, evento_id, estado, solicita_recogida, solicita_regreso, motorista_id, created_at, tipo_recogida,
          motorista:motorista_id (nombre, telefono)
        `)
        .eq('registro_id', reg.id)

      setRegistro(reg)
      setEventos(evs ?? [])
      setSolicitudes(
        (sols ?? []).map((s: any) => ({
          id: s.id, evento_id: s.evento_id, estado: s.estado,
          solicita_recogida: s.solicita_recogida, solicita_regreso: s.solicita_regreso,
          motorista_id: s.motorista_id ?? null,
          motorista_nombre: s.motorista?.nombre ?? null,
          motorista_telefono: s.motorista?.telefono ?? null,
          tipo_recogida: s.tipo_recogida ?? 'domicilio',
          created_at: s.created_at,
        }))
      )
      setVista('perfil')
    } finally {
      setCargando(false)
    }
  }

  async function guardarCoordenadas(lat: number, lng: number) {
    if (!registro) return
    const { error: upErr } = await supabase
      .from('registros_dui')
      .update({ latitud: lat, longitud: lng, coordenadas_at: new Date().toISOString() })
      .eq('id', registro.id)

    if (!upErr) {
      setRegistro((prev) => prev
        ? { ...prev, latitud: lat, longitud: lng, coordenadas_at: new Date().toISOString() }
        : prev)
      setGpsEstado('ok')
      setGpsMsg(`Punto de destino guardado: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } else {
      setGpsEstado('error')
      setGpsMsg('Error al guardar. Intentá de nuevo.')
    }
  }


  async function confirmarDesdeMapas(lat: number, lng: number) {
    setMostrarMapa(false)
    setGpsEstado('cargando')
    setGpsMsg('Guardando destino...')
    await guardarCoordenadas(lat, lng)
  }

  async function autoDistribuirEvento(eventoId: string): Promise<Record<string, { nombre: string; telefono: string | null }>> {
    // 1. Obtener motoristas asignados a este evento
    const { data: emData } = await supabase
      .from('evento_motoristas')
      .select('motorista_id')
      .eq('evento_id', eventoId)
    const motoristaIds = (emData ?? []).map((r: any) => r.motorista_id)
    if (motoristaIds.length === 0) return {}

    const { data: motData } = await supabase
      .from('registros_dui')
      .select('id, nombre, telefono, latitud, longitud')
      .in('id', motoristaIds)

    const motoristas = (motData ?? []) as { id: string; nombre: string; telefono: string | null; latitud: number | null; longitud: number | null }[]
    if (motoristas.length === 0) return {}

    // 2. Obtener todas las solicitudes del evento con GPS del pasajero
    const { data: solsData } = await supabase
      .from('solicitudes_transporte')
      .select('id, registro_id, registros_dui:registro_id(latitud, longitud)')
      .eq('evento_id', eventoId)

    const sols = (solsData ?? []).map((s: any) => ({
      id: s.id,
      latitud: s.registros_dui?.latitud ?? null,
      longitud: s.registros_dui?.longitud ?? null,
    }))

    if (sols.length === 0) return {}

    // 3. Clustering geográfico de pasajeros (k-means++ con múltiples reinicios)
    // Agrupa pasajeros cercanos entre sí → cada grupo va con un motorista
    const k = motoristas.length
    const conGPS = sols.filter((s) => s.latitud && s.longitud) as { id: string; latitud: number; longitud: number }[]
    const sinGPS = sols.filter((s) => !s.latitud || !s.longitud)
    const asignaciones: { solicitud_id: string; motorista_id: string }[] = []

    if (conGPS.length > 0) {
      const puntos = conGPS.map(s => ({ lat: s.latitud, lng: s.longitud }))

      // K-means++ init: primer centroide = punto más cercano al centro geográfico;
      // siguientes = punto más lejano a cualquier centroide ya elegido
      function kppInit(pts: { lat: number; lng: number }[], kk: number) {
        const cl: { lat: number; lng: number }[] = []
        const cLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
        const cLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length
        let best = 0, bd = Infinity
        pts.forEach((p, i) => { const d = distKm(p.lat, p.lng, cLat, cLng); if (d < bd) { bd = d; best = i } })
        cl.push({ ...pts[best] })
        while (cl.length < kk) {
          const dists = pts.map(p => Math.min(...cl.map(c => distKm(p.lat, p.lng, c.lat, c.lng))) ** 2)
          const total = dists.reduce((s, d) => s + d, 0)
          if (total === 0) { cl.push({ ...pts[cl.length % pts.length] }); continue }
          cl.push({ ...pts[dists.indexOf(Math.max(...dists))] })
        }
        return cl
      }

      // Un paso de k-means: retorna {asignados, centroides, inercia}
      function kRun(pts: typeof conGPS, kk: number, cInit: { lat: number; lng: number }[]) {
        let cs = cInit.map(c => ({ ...c }))
        let asg: number[] = new Array(pts.length).fill(0)
        for (let iter = 0; iter < 30; iter++) {
          const nw = pts.map(s => cs.reduce((b, c, ci) => { const d = distKm(s.latitud, s.longitud, c.lat, c.lng); return d < b.d ? { ci, d } : b }, { ci: 0, d: Infinity }).ci)
          if (nw.every((v, i) => v === asg[i])) break
          asg = nw
          for (let ci = 0; ci < kk; ci++) {
            const mb = pts.filter((_, i) => asg[i] === ci)
            if (mb.length === 0) continue
            cs[ci] = { lat: mb.reduce((s, p) => s + p.latitud, 0) / mb.length, lng: mb.reduce((s, p) => s + p.longitud, 0) / mb.length }
          }
        }
        const inercia = pts.reduce((sum, s, i) => sum + distKm(s.latitud, s.longitud, cs[asg[i]].lat, cs[asg[i]].lng), 0)
        return { asignados: asg, centroides: cs, inercia }
      }

      let mejorAsignados: number[] = []
      let mejoresCentroides: { lat: number; lng: number }[] = []
      let mejorInercia = Infinity

      if (conGPS.length <= k) {
        mejorAsignados = conGPS.map((_, i) => i)
        mejoresCentroides = puntos
      } else {
        const REINICIOS = 8
        for (let r = 0; r < REINICIOS; r++) {
          const cInit = r === 0 || mejorInercia === Infinity
            ? kppInit(puntos, k)
            : mejoresCentroides.map((c, ci) => { const rn = 0.002 * r; return { lat: c.lat + (ci % 2 === 0 ? rn : -rn), lng: c.lng + (ci % 2 === 0 ? -rn : rn) } })
          const { asignados, centroides, inercia } = kRun(conGPS, k, cInit)
          if (inercia < mejorInercia) { mejorInercia = inercia; mejorAsignados = asignados; mejoresCentroides = centroides }
        }
      }

      // Balancear grupos
      const maxPorGrupo = Math.ceil(conGPS.length / k)
      const cuentaGrupo = new Array(k).fill(0)
      const ordenados = conGPS
        .map((s, i) => ({ s, i, grupo: mejorAsignados[i], dist: distKm(s.latitud, s.longitud, mejoresCentroides[mejorAsignados[i]]?.lat ?? s.latitud, mejoresCentroides[mejorAsignados[i]]?.lng ?? s.longitud) }))
        .sort((a, b) => a.dist - b.dist)
      const grupoFinal = new Array(conGPS.length).fill(-1)
      for (const { i, grupo } of ordenados) {
        if (cuentaGrupo[grupo] < maxPorGrupo) { grupoFinal[i] = grupo; cuentaGrupo[grupo]++ }
      }
      for (let i = 0; i < conGPS.length; i++) {
        if (grupoFinal[i] === -1) { const g = cuentaGrupo.indexOf(Math.min(...cuentaGrupo)); grupoFinal[i] = g; cuentaGrupo[g]++ }
      }
      conGPS.forEach((s, i) => asignaciones.push({ solicitud_id: s.id, motorista_id: motoristas[grupoFinal[i]].id }))
    }
    // Sin GPS: round-robin
    const cargaFinal = new Array(k).fill(0)
    asignaciones.forEach(a => { const idx = motoristas.findIndex(m => m.id === a.motorista_id); if (idx >= 0) cargaFinal[idx]++ })
    for (const sol of sinGPS) {
      const idx = cargaFinal.indexOf(Math.min(...cargaFinal)); cargaFinal[idx]++
      asignaciones.push({ solicitud_id: sol.id, motorista_id: motoristas[idx].id })
    }

    // 4. Limpiar y aplicar asignaciones
    await supabase.from('solicitudes_transporte').update({ motorista_id: null }).eq('evento_id', eventoId)
    for (const a of asignaciones) {
      await supabase.from('solicitudes_transporte').update({ motorista_id: a.motorista_id }).eq('id', a.solicitud_id)
    }

    // Devolver mapa id → {nombre, telefono} para actualizar estado local
    return Object.fromEntries(motoristas.map((m) => [m.id, { nombre: m.nombre, telefono: m.telefono }]))
  }

  async function solicitarTransporte(
    eventoId: string,
    opts: { recogida: boolean; regreso: boolean; tipo_recogida?: 'domicilio' | 'punto_reunion' }
  ) {
    if (!registro) return
    setSolicitando(eventoId)
    try {
      const { data, error: err } = await supabase
        .from('solicitudes_transporte')
        .insert({
          registro_id: registro.id,
          evento_id: eventoId,
          estado: 'pendiente',
          solicita_recogida: opts.recogida,
          solicita_regreso: opts.regreso,
          tipo_recogida: opts.tipo_recogida ?? 'domicilio',
        })
        .select('id, evento_id, estado, solicita_recogida, solicita_regreso, motorista_id, created_at, tipo_recogida')
        .single()

      if (err) { alert('Error al solicitar transporte.'); return }

      // Agregar al estado local — el admin distribuirá desde el panel cuando lo considere
      const nuevaSol: Solicitud = {
        ...data,
        motorista_id: null, motorista_nombre: null, motorista_telefono: null,
        tipo_recogida: data.tipo_recogida ?? 'domicilio',
      }
      setSolicitudes((prev) => [...prev, nuevaSol])
    } finally {
      setSolicitando(null)
    }
  }

  async function cancelarSolicitud(solicitudId: string) {
    const { error: err } = await supabase
      .from('solicitudes_transporte')
      .delete()
      .eq('id', solicitudId)
    if (!err) setSolicitudes((prev) => prev.filter((s) => s.id !== solicitudId))
  }

  // ── VISTA LOGIN ──────────────────────────────────────────────
  if (vista === 'login') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4 gap-4">
        {/* Botón volver al portal */}
        <a href="/portal"
          className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 self-start sm:self-center transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Volver al portal
        </a>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 sm:p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-blue-600 text-white rounded-full p-3 mb-3">
              <Bus className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 text-center">Portal de Transporte</h1>
            <p className="text-gray-500 text-sm text-center mt-1">
              Complejo Educativo Cap. General Gerardo Barrios
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de DUI</label>
              <input
                type="text"
                placeholder="00000000-0"
                value={duiInput}
                onChange={(e) => setDuiInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarPorDui()}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={12}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
            )}

            <button
              onClick={buscarPorDui}
              disabled={cargando || !duiInput.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {cargando ? <><Loader2 className="w-5 h-5 animate-spin" />Buscando...</> : 'Acceder'}
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Ingresá tu DUI sin espacios ni guiones.<br />
            Solo personal registrado puede acceder.
          </p>

          <a href="/portal"
            className="mt-4 flex items-center justify-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 font-medium">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
            Para solicitar transporte, usá el Portal de colaboradores
          </a>
        </div>
      </main>
    )
  }

  // ── VISTA PERFIL ─────────────────────────────────────────────
  const solicitudMap = Object.fromEntries(solicitudes.map((s) => [s.evento_id, s]))

  return (
    <>
      {mostrarMapa && (
        <MapaModal
          latInicial={registro?.latitud ?? null}
          lngInicial={registro?.longitud ?? null}
          onConfirmar={confirmarDesdeMapas}
          onCerrar={() => setMostrarMapa(false)}
        />
      )}

      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-blue-600 text-white px-4 py-3 shadow">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button
              onClick={() => { setVista('login'); setRegistro(null); setDuiInput('') }}
              className="p-2 hover:bg-blue-500 rounded-full transition-colors flex-shrink-0"
              title="Cerrar sesión de transporte"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-base leading-tight truncate">{registro?.nombre}</h1>
              <p className="text-blue-200 text-xs truncate">{registro?.cargo} · JRV {registro?.jrv}</p>
            </div>
            <a href="/portal"
              className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-200 hover:text-white bg-blue-500 hover:bg-blue-400 rounded-lg px-2.5 py-1.5 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
              Portal
            </a>
          </div>
        </header>

        <div className="max-w-2xl mx-auto p-4 space-y-5">

          {/* Tarjeta destino */}
          <section className={`bg-white rounded-xl shadow-sm p-5 ${registro?.latitud && registro?.longitud ? 'border border-gray-100' : 'border-2 border-red-300 bg-red-50'}`}>
            <div className="flex items-center gap-2 mb-0.5">
              <MapPin className={`w-5 h-5 ${registro?.latitud && registro?.longitud ? 'text-blue-600' : 'text-red-600'}`} />
              <h2 className={`font-semibold ${registro?.latitud && registro?.longitud ? 'text-gray-800' : 'text-red-800'}`}>
                {registro?.latitud && registro?.longitud ? '📍 Tu punto de destino' : '📍 Paso importante: indicá tu destino'}
              </h2>
            </div>
            <p className={`text-xs mb-3 ml-7 ${registro?.latitud && registro?.longitud ? 'text-gray-500' : 'text-red-600 font-medium'}`}>
              {registro?.latitud && registro?.longitud
                ? 'Esta información es indispensable para que los motoristas puedan organizar las rutas y saber dónde recogerte o dejarte. ¡Mantenerla actualizada hace todo más fácil! 🗺️'
                : 'Esta información es indispensable para los motoristas. Sin tu punto de destino, no es posible organizar la ruta ni asignarte transporte.'}
            </p>

            {registro?.latitud && registro?.longitud ? (
              <div className="mb-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">¡Destino registrado correctamente! ✅</p>
                    <p className="text-xs text-green-600 mt-0.5 font-mono">
                      {registro.latitud.toFixed(5)}, {registro.longitud.toFixed(5)}
                    </p>
                    {registro.coordenadas_at && (
                      <p className="text-xs text-green-600">
                        {new Date(registro.coordenadas_at).toLocaleString('es-SV')}
                      </p>
                    )}
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${registro.latitud},${registro.longitud}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 underline mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver en Google Maps
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">
                Todavía no tenés un punto de destino registrado. Los motoristas necesitan esta información para organizar las rutas — ¡marcarlo solo toma un momento! 😊
              </p>
            )}

            {gpsMsg && (
              <div className={`text-sm rounded-lg px-3 py-2 mb-3 ${gpsEstado === 'ok' ? 'bg-green-50 text-green-700' : gpsEstado === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                {gpsMsg}
              </div>
            )}

            {/* Botón único */}
            <button
              onClick={() => setMostrarMapa(true)}
              className={`w-full flex items-center justify-center gap-2 text-white font-medium py-3 px-4 rounded-xl transition-colors text-sm ${registro?.latitud && registro?.longitud ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              <Map className="w-5 h-5" />
              {registro?.latitud ? 'Actualizar mi punto de destino' : 'Registrar mi punto de destino'}
            </button>
          </section>

          {/* Eventos y solicitudes */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">Eventos y Transporte</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4 ml-7">
              Confirmá tu asistencia y solicitá transporte desde el{' '}
              <a href="/portal" className="text-blue-500 hover:underline font-medium">Portal de colaboradores</a>.
            </p>

            {eventos.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Bus className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay eventos programados.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {eventos.map((ev) => {
                  const sol = solicitudMap[ev.id]
                  return (
                    <div key={ev.id} className="border border-gray-100 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 text-sm">{ev.nombre}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            📅 {new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            {ev.hora && ` · ${fmt12(ev.hora)}`}
                            {ev.hora_fin && ` – ${fmt12(ev.hora_fin)}`}
                          </p>
                          {ev.lugar && <p className="text-xs text-gray-500">📍 {ev.lugar}</p>}
                          {ev.evento_latitud && ev.evento_longitud && (
                            <a
                              href={`https://www.google.com/maps?q=${ev.evento_latitud},${ev.evento_longitud}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5"
                            >
                              <MapPin className="w-3 h-3" />
                              Ver lugar del evento en Maps
                            </a>
                          )}
                          {ev.descripcion && <p className="text-xs text-gray-400 mt-1">{ev.descripcion}</p>}
                        </div>
                      </div>

                      <TransporteAcciones
                        ev={ev}
                        sol={sol}
                        solicitando={solicitando === ev.id}
                        tieneGps={!!(registro?.latitud && registro?.longitud)}
                        onSolicitar={(opts) => solicitarTransporte(ev.id, opts)}
                        onCancelar={() => sol && cancelarSolicitud(sol.id)}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Info personal */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">Mis datos</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">DUI</dt>
                <dd className="font-mono text-gray-800">{registro?.dui}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Teléfono</dt>
                <dd className="text-gray-800">{registro?.telefono ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Cargo</dt>
                <dd className="text-gray-800">{registro?.cargo}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">JRV</dt>
                <dd className="text-gray-800">{registro?.jrv}</dd>
              </div>
            </dl>
          </section>

        </div>
      </main>
    </>
  )
}

export default function TransportePage() {
  return (
    <Suspense fallback={null}>
      <TransporteInner />
    </Suspense>
  )
}
