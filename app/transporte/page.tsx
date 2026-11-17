'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  MapPin, Bus, Calendar, CheckCircle, XCircle, Clock,
  ChevronLeft, Loader2, ExternalLink, Navigation, Map, X
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
  lugar: string | null
  evento_latitud: number | null
  evento_longitud: number | null
  transporte_recogida: boolean
  transporte_regreso: boolean
  activo: boolean
}

type Solicitud = {
  id: string
  evento_id: string
  estado: string
  solicita_recogida: boolean
  solicita_regreso: boolean
  created_at: string
}

type Vista = 'login' | 'perfil'

// Centro de El Salvador por defecto (Santa Ana)
const DEFAULT_LAT = 13.9942
const DEFAULT_LNG = -89.5629

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
  onSolicitar,
  onCancelar,
}: {
  ev: Evento
  sol: Solicitud | undefined
  solicitando: boolean
  onSolicitar: (opts: { recogida: boolean; regreso: boolean }) => void
  onCancelar: () => void
}) {
  const [selRecogida, setSelRecogida] = useState(false)
  const [selRegreso, setSelRegreso]   = useState(false)

  const tieneAlguno = ev.transporte_recogida || ev.transporte_regreso
  const ningunaSeleccionada = !selRecogida && !selRegreso

  if (!tieneAlguno) {
    return (
      <div className="mt-3 text-xs text-gray-400 italic text-center py-1">
        Sin transporte disponible para este evento
      </div>
    )
  }

  if (sol) {
    return (
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full ${estadoColor(sol.estado)}`}>
            {estadoIcon(sol.estado)}
            Solicitud: {sol.estado}
          </span>
          {sol.estado === 'pendiente' && (
            <button onClick={onCancelar} className="text-xs text-red-500 hover:text-red-700 underline">
              Cancelar
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {sol.solicita_recogida && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🚐 Recogida solicitada</span>
          )}
          {sol.solicita_regreso && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">🏠 Ir a dejar solicitado</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {/* Opciones disponibles */}
      <p className="text-xs text-gray-500 font-medium">Seleccioná el transporte que necesitás:</p>
      <div className="flex gap-2 flex-wrap">
        {ev.transporte_recogida && (
          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer text-sm transition-colors ${selRecogida ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <input
              type="checkbox"
              checked={selRecogida}
              onChange={(e) => setSelRecogida(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600"
            />
            🚐 Recogida
          </label>
        )}
        {ev.transporte_regreso && (
          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer text-sm transition-colors ${selRegreso ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <input
              type="checkbox"
              checked={selRegreso}
              onChange={(e) => setSelRegreso(e.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-600"
            />
            🏠 Ir a dejar
          </label>
        )}
      </div>
      <button
        onClick={() => onSolicitar({ recogida: selRecogida, regreso: selRegreso })}
        disabled={solicitando || ningunaSeleccionada}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
      >
        {solicitando
          ? <><Loader2 className="w-4 h-4 animate-spin" />Solicitando...</>
          : <><Bus className="w-4 h-4" />{ningunaSeleccionada ? 'Seleccioná una opción' : 'Solicitar transporte'}</>}
      </button>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────
export default function TransportePage() {
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
        .select('id, evento_id, estado, solicita_recogida, solicita_regreso, created_at')
        .eq('registro_id', reg.id)

      setRegistro(reg)
      setEventos(evs ?? [])
      setSolicitudes(sols ?? [])
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

  async function capturarGPSDirecto() {
    if (!registro) return
    setGpsEstado('cargando')
    setGpsMsg('Obteniendo tu ubicación...')

    if (!navigator.geolocation) {
      setGpsEstado('error')
      setGpsMsg('Tu dispositivo no soporta geolocalización.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await guardarCoordenadas(pos.coords.latitude, pos.coords.longitude)
      },
      (geoErr) => {
        setGpsEstado('error')
        setGpsMsg(
          geoErr.code === 1
            ? 'Permiso denegado. Habilitá la ubicación en tu navegador.'
            : 'No se pudo obtener la ubicación. Intentá de nuevo.'
        )
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  async function confirmarDesdeMapas(lat: number, lng: number) {
    setMostrarMapa(false)
    setGpsEstado('cargando')
    setGpsMsg('Guardando destino...')
    await guardarCoordenadas(lat, lng)
  }

  async function solicitarTransporte(
    eventoId: string,
    opts: { recogida: boolean; regreso: boolean }
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
        })
        .select('id, evento_id, estado, solicita_recogida, solicita_regreso, created_at')
        .single()

      if (err) { alert('Error al solicitar transporte.'); return }
      setSolicitudes((prev) => [...prev, data])
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
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="flex flex-col items-center mb-8">
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
        <header className="bg-blue-600 text-white px-4 py-4 shadow">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button
              onClick={() => { setVista('login'); setRegistro(null); setDuiInput('') }}
              className="p-1 hover:bg-blue-500 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-lg leading-tight">{registro?.nombre}</h1>
              <p className="text-blue-200 text-xs">{registro?.cargo} · JRV {registro?.jrv}</p>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto p-4 space-y-5">

          {/* Tarjeta destino */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-0.5">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">¿Dónde te dejamos?</h2>
            </div>
            <p className="text-xs text-gray-400 mb-3 ml-7">Indicá tu vivienda o el lugar donde querés que te dejen al regreso</p>

            {registro?.latitud && registro?.longitud ? (
              <div className="mb-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Punto de destino registrado</p>
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
                Aún no tenés un punto registrado. Marcá tu vivienda u otro lugar donde querés que te dejemos.
              </p>
            )}

            {gpsMsg && (
              <div className={`text-sm rounded-lg px-3 py-2 mb-3 ${gpsEstado === 'ok' ? 'bg-green-50 text-green-700' : gpsEstado === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                {gpsMsg}
              </div>
            )}

            {/* Dos botones */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={capturarGPSDirecto}
                disabled={gpsEstado === 'cargando'}
                className="flex flex-col items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 px-2 rounded-xl transition-colors text-sm"
              >
                {gpsEstado === 'cargando'
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <Navigation className="w-5 h-5" />}
                <span className="leading-tight text-center text-xs">Estoy aquí ahora</span>
              </button>

              <button
                onClick={() => setMostrarMapa(true)}
                className="flex flex-col items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-2 rounded-xl transition-colors text-sm"
              >
                <Map className="w-5 h-5" />
                <span className="leading-tight text-center text-xs">Marcar en el mapa</span>
              </button>
            </div>

            {(registro?.latitud) && (
              <button
                onClick={() => setMostrarMapa(true)}
                className="w-full mt-2 text-xs text-indigo-600 hover:text-indigo-800 underline text-center"
              >
                Cambiar punto de destino
              </button>
            )}
          </section>

          {/* Eventos y solicitudes */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">Eventos y Transporte</h2>
            </div>

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
                            {ev.hora && ` · ${ev.hora.slice(0, 5)}`}
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
