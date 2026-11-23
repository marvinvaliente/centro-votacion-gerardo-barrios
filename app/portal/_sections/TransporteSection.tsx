'use client'

import { useState, useEffect, useRef } from 'react'
import {
  MapPin, Bus, Calendar, CheckCircle, XCircle, Clock,
  Loader2, ExternalLink, Map, X, Navigation, Truck, Phone
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Tipos ────────────────────────────────────────────────────
interface UsuarioProp {
  id: string; nombre: string; dui: string; registro_dui_id?: string | null
}

type Registro = {
  id: string; dui: string; nombre: string; telefono: string | null
  cargo: string; jrv: string
  latitud: number | null; longitud: number | null; coordenadas_at: string | null
}

type Evento = {
  id: string; nombre: string; descripcion: string | null; fecha: string
  hora: string | null; hora_fin: string | null; lugar: string | null
  evento_latitud: number | null; evento_longitud: number | null
  transporte_recogida: boolean; transporte_regreso: boolean; activo: boolean
  punto_reunion_nombre: string | null
  punto_reunion_lat: number | null; punto_reunion_lng: number | null
}

type Solicitud = {
  id: string; evento_id: string; estado: string
  solicita_recogida: boolean; solicita_regreso: boolean
  motorista_id: string | null; motorista_nombre: string | null; motorista_telefono: string | null
  created_at: string; tipo_recogida: 'domicilio' | 'punto_reunion' | null
}

// ── Helpers ──────────────────────────────────────────────────
const DEFAULT_LAT = 13.9942
const DEFAULT_LNG = -89.5629

function fmt12(hora: string | null | undefined): string {
  if (!hora) return ''
  const [h, m] = hora.slice(0, 5).split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function eventoVencido(ev: Evento): boolean {
  if (!ev.hora_fin) return false
  const [h, m] = ev.hora_fin.slice(0, 5).split(':').map(Number)
  const cierre = new Date(`${ev.fecha}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
  cierre.setMinutes(cierre.getMinutes() + 30)
  return new Date() > cierre
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
function MapaModal({ latInicial, lngInicial, onConfirmar, onCerrar }: {
  latInicial: number | null; lngInicial: number | null
  onConfirmar: (lat: number, lng: number) => void; onCerrar: () => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const selLatRef = useRef<number | null>(latInicial)
  const selLngRef = useRef<number | null>(lngInicial)
  const [selLat, setSelLat] = useState<number | null>(latInicial)
  const [selLng, setSelLng] = useState<number | null>(lngInicial)
  const [cargandoMapa, setCargandoMapa] = useState(true)
  const [buscandoPos, setBuscandoPos] = useState(false)

  function actualizarCoordenadas(lat: number, lng: number) {
    selLatRef.current = lat; selLngRef.current = lng; setSelLat(lat); setSelLng(lng)
  }

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link'); link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link)
    }
    function initMap(L: any) {
      if (!mapRef.current || mapInstanceRef.current) return
      const initLat = latInicial ?? DEFAULT_LAT, initLng = lngInicial ?? DEFAULT_LNG
      const map = L.map(mapRef.current, { zoomControl: true }).setView([initLat, initLng], latInicial ? 16 : 13)
      mapInstanceRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)
      const icon = L.divIcon({ html: `<div style="background:#2563eb;border:3px solid white;border-radius:50%;width:22px;height:22px;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`, iconSize: [22,22], iconAnchor: [11,11], className: '' })
      if (latInicial && lngInicial) {
        markerRef.current = L.marker([latInicial, lngInicial], { icon, draggable: true }).addTo(map)
        markerRef.current.on('dragend', (e: any) => { const p = e.target.getLatLng(); actualizarCoordenadas(p.lat, p.lng) })
      }
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng; actualizarCoordenadas(lat, lng)
        if (markerRef.current) { markerRef.current.setLatLng([lat, lng]) }
        else {
          markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map)
          markerRef.current.on('dragend', (ev: any) => { const p = ev.target.getLatLng(); actualizarCoordenadas(p.lat, p.lng) })
        }
      })
      setCargandoMapa(false)
    }
    if ((window as any).L) { initMap((window as any).L); return }
    const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => initMap((window as any).L); document.head.appendChild(script)
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; markerRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function irAUbicacionActual() {
    if (!navigator.geolocation) return; setBuscandoPos(true)
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords; actualizarCoordenadas(lat, lng); setBuscandoPos(false)
      const L = (window as any).L, map = mapInstanceRef.current; if (!L || !map) return
      map.setView([lat, lng], 17)
      const icon = L.divIcon({ html: `<div style="background:#2563eb;border:3px solid white;border-radius:50%;width:22px;height:22px;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`, iconSize: [22,22], iconAnchor: [11,11], className: '' })
      if (markerRef.current) markerRef.current.setLatLng([lat, lng])
      else { markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map); markerRef.current.on('dragend', (e: any) => { const p = e.target.getLatLng(); actualizarCoordenadas(p.lat, p.lng) }) }
    }, () => setBuscandoPos(false), { enableHighAccuracy: true, timeout: 15000 })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="flex flex-col bg-white w-full h-full max-w-2xl mx-auto sm:my-4 sm:rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-blue-600" />
            <div><p className="font-semibold text-gray-900 text-sm">¿Dónde te dejamos?</p><p className="text-xs text-gray-400">Marcá tu vivienda u otro destino al regreso</p></div>
          </div>
          <button onClick={onCerrar} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 shrink-0 flex items-center gap-2 flex-wrap">
          <button onClick={irAUbicacionActual} disabled={buscandoPos}
            className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg transition-colors">
            {buscandoPos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            Usar mi ubicación actual
          </button>
          {selLat && selLng && <span className="text-xs text-gray-500 font-mono">{selLat.toFixed(5)}, {selLng.toFixed(5)}</span>}
        </div>
        <div className="relative flex-1 min-h-0">
          {cargandoMapa && <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}
          <div ref={mapRef} className="w-full h-full" />
        </div>
        <div className="px-4 py-3 bg-white border-t border-gray-100 shrink-0 space-y-2">
          {!selLat && <p className="text-xs text-gray-400 text-center">Tocá tu vivienda u otro punto donde querés que te dejemos al regreso</p>}
          <button onClick={() => selLatRef.current && selLngRef.current && onConfirmar(selLatRef.current, selLngRef.current)} disabled={!selLat || !selLng}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {selLat ? 'Confirmar mi destino' : 'Seleccioná un punto en el mapa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Acciones de transporte por evento ───────────────────────
function TransporteAcciones({ ev, sol, solicitando, onSolicitar, onCancelar }: {
  ev: Evento; sol: Solicitud | undefined; solicitando: boolean
  onSolicitar: (opts: { recogida: boolean; regreso: boolean; tipo_recogida?: 'domicilio' | 'punto_reunion' }) => void
  onCancelar: () => void
}) {
  const vencido = eventoVencido(ev)
  const tieneAlguno = ev.transporte_recogida || ev.transporte_regreso
  if (!tieneAlguno) return <div className="mt-3 text-xs text-gray-400 italic text-center py-1">Sin transporte disponible para este evento</div>
  if (vencido && !sol) return (
    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center">
      <p className="text-xs text-gray-500 font-medium">⏱ Ya no es posible solicitar transporte</p>
      <p className="text-xs text-gray-400">El tiempo para registrar tu solicitud para este evento ha finalizado.</p>
    </div>
  )
  if (sol) return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full ${estadoColor(sol.estado)}`}>
          {estadoIcon(sol.estado)} Transporte solicitado
        </span>
        {!vencido && <button onClick={onCancelar} className="text-xs text-red-500 hover:text-red-700 underline">Cancelar</button>}
      </div>
      <div className="flex gap-2 flex-wrap">
        {sol.solicita_recogida && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🚐 Llevarme al evento</span>}
        {sol.solicita_recogida && sol.tipo_recogida === 'punto_reunion' && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">📍 Punto de reunión</span>}
        {sol.solicita_regreso && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">🏠 Llevarme a casa</span>}
      </div>
      {sol.motorista_nombre ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
          <div className="bg-blue-600 text-white rounded-full p-1.5 shrink-0"><Truck className="w-4 h-4" /></div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-blue-800">Tu motorista para este evento</p>
            <p className="text-sm text-blue-900 font-medium leading-tight">{sol.motorista_nombre}</p>
            {sol.motorista_telefono && (
              <a href={`tel:${sol.motorista_telefono}`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-0.5">
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
  return (
    <div className="mt-3">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl flex-shrink-0">🗓️</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-900 leading-tight">¿Necesitás transporte para este evento?</p>
          <p className="text-xs text-blue-700 mt-1 leading-relaxed">
            Para solicitar transporte, confirmá tu asistencia y usá las opciones de abajo.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {ev.transporte_recogida && (
              <button onClick={() => onSolicitar({ recogida: true, regreso: false })} disabled={solicitando}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                {solicitando ? <Loader2 className="w-3 h-3 animate-spin" /> : '🚐'} Ir al evento
              </button>
            )}
            {ev.transporte_regreso && (
              <button onClick={() => onSolicitar({ recogida: false, regreso: true })} disabled={solicitando}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                {solicitando ? <Loader2 className="w-3 h-3 animate-spin" /> : '🏠'} Regresar a casa
              </button>
            )}
            {ev.transporte_recogida && ev.transporte_regreso && (
              <button onClick={() => onSolicitar({ recogida: true, regreso: true })} disabled={solicitando}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                {solicitando ? <Loader2 className="w-3 h-3 animate-spin" /> : '↔️'} Ambos
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────
export default function TransporteSection({ usuario }: { usuario: UsuarioProp }) {
  const [registro, setRegistro] = useState<Registro | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(true)
  const [gpsEstado, setGpsEstado] = useState<'idle' | 'cargando' | 'ok' | 'error'>('idle')
  const [gpsMsg, setGpsMsg] = useState('')
  const [solicitando, setSolicitando] = useState<string | null>(null)
  const [mostrarMapa, setMostrarMapa] = useState(false)

  useEffect(() => {
    cargarDatos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.dui])

  async function cargarDatos() {
    setCargando(true)
    try {
      const dui = usuario.dui
      const { data } = await supabase
        .from('registros_dui')
        .select('id, dui, nombre, telefono, latitud, longitud, coordenadas_at, padron:padron_id (cargo, jrv)')
        .eq('dui', dui).single()

      if (!data) { setCargando(false); return }

      const reg: Registro = {
        id: data.id, dui: data.dui, nombre: data.nombre, telefono: data.telefono,
        cargo: (data.padron as any)?.cargo ?? 'Sin asignar',
        jrv: (data.padron as any)?.jrv ?? '-',
        latitud: data.latitud, longitud: data.longitud, coordenadas_at: data.coordenadas_at,
      }

      const { data: evs } = await supabase.from('eventos_transporte').select('*').eq('activo', true).order('fecha', { ascending: true })
      const { data: sols } = await supabase
        .from('solicitudes_transporte')
        .select('id, evento_id, estado, solicita_recogida, solicita_regreso, motorista_id, created_at, tipo_recogida, motorista:motorista_id (nombre, telefono)')
        .eq('registro_id', reg.id)

      setRegistro(reg)
      setEventos(evs ?? [])
      setSolicitudes((sols ?? []).map((s: any) => ({
        id: s.id, evento_id: s.evento_id, estado: s.estado,
        solicita_recogida: s.solicita_recogida, solicita_regreso: s.solicita_regreso,
        motorista_id: s.motorista_id ?? null,
        motorista_nombre: s.motorista?.nombre ?? null,
        motorista_telefono: s.motorista?.telefono ?? null,
        tipo_recogida: s.tipo_recogida ?? 'domicilio', created_at: s.created_at,
      })))
    } finally {
      setCargando(false)
    }
  }

  async function guardarCoordenadas(lat: number, lng: number) {
    if (!registro) return
    const { error } = await supabase.from('registros_dui').update({ latitud: lat, longitud: lng, coordenadas_at: new Date().toISOString() }).eq('id', registro.id)
    if (!error) {
      setRegistro(prev => prev ? { ...prev, latitud: lat, longitud: lng, coordenadas_at: new Date().toISOString() } : prev)
      setGpsEstado('ok'); setGpsMsg(`Punto de destino guardado: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } else { setGpsEstado('error'); setGpsMsg('Error al guardar. Intentá de nuevo.') }
  }

  async function confirmarDesdeMapas(lat: number, lng: number) {
    setMostrarMapa(false); setGpsEstado('cargando'); setGpsMsg('Guardando destino...')
    await guardarCoordenadas(lat, lng)
  }

  async function solicitarTransporte(eventoId: string, opts: { recogida: boolean; regreso: boolean; tipo_recogida?: 'domicilio' | 'punto_reunion' }) {
    if (!registro) return; setSolicitando(eventoId)
    try {
      const { data, error } = await supabase.from('solicitudes_transporte').insert({
        registro_id: registro.id, evento_id: eventoId, estado: 'pendiente',
        solicita_recogida: opts.recogida, solicita_regreso: opts.regreso, tipo_recogida: opts.tipo_recogida ?? 'domicilio',
      }).select('id, evento_id, estado, solicita_recogida, solicita_regreso, motorista_id, created_at, tipo_recogida').single()
      if (error) { alert('Error al solicitar transporte.'); return }
      setSolicitudes(prev => [...prev, { ...data, motorista_id: null, motorista_nombre: null, motorista_telefono: null, tipo_recogida: data.tipo_recogida ?? 'domicilio' }])
    } finally { setSolicitando(null) }
  }

  async function cancelarSolicitud(solicitudId: string) {
    const { error } = await supabase.from('solicitudes_transporte').delete().eq('id', solicitudId)
    if (!error) setSolicitudes(prev => prev.filter(s => s.id !== solicitudId))
  }

  if (cargando) return (
    <div className="flex justify-center items-center" style={{ height: 'calc(100vh - 56px)' }}>
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  if (!registro) return (
    <div className="flex flex-col items-center justify-center gap-3 p-8" style={{ height: 'calc(100vh - 56px)' }}>
      <Bus className="w-12 h-12 text-gray-200" />
      <p className="text-gray-500 text-sm">No se encontró tu registro de transporte.</p>
    </div>
  )

  const solicitudMap = Object.fromEntries(solicitudes.map(s => [s.evento_id, s]))

  return (
    <>
      {mostrarMapa && (
        <MapaModal latInicial={registro.latitud} lngInicial={registro.longitud} onConfirmar={confirmarDesdeMapas} onCerrar={() => setMostrarMapa(false)} />
      )}

      <div style={{ background: '#f8fafc', minHeight: '100%' }}>
        {/* Header */}
        <div className="px-4 py-4 shadow-sm" style={{ background: '#1e3a5f', color: 'white' }}>
          <h1 className="font-bold text-base">{registro.nombre}</h1>
          <p className="text-xs opacity-60">{registro.cargo} · JRV {registro.jrv}</p>
        </div>

        <div className="max-w-2xl mx-auto p-4 space-y-5 pb-6">
          {/* Destino GPS */}
          <section className={`bg-white rounded-xl shadow-sm p-5 ${registro.latitud && registro.longitud ? 'border border-gray-100' : 'border-2 border-red-300 bg-red-50'}`}>
            <div className="flex items-center gap-2 mb-0.5">
              <MapPin className={`w-5 h-5 ${registro.latitud && registro.longitud ? 'text-blue-600' : 'text-red-600'}`} />
              <h2 className={`font-semibold ${registro.latitud && registro.longitud ? 'text-gray-800' : 'text-red-800'}`}>
                {registro.latitud && registro.longitud ? '📍 Tu punto de destino' : '📍 Paso importante: indicá tu destino'}
              </h2>
            </div>
            <p className={`text-xs mb-3 ml-7 ${registro.latitud && registro.longitud ? 'text-gray-500' : 'text-red-600 font-medium'}`}>
              {registro.latitud && registro.longitud
                ? 'Esta información es indispensable para que los motoristas puedan organizar las rutas. ¡Mantenerla actualizada hace todo más fácil! 🗺️'
                : 'Esta información es indispensable para los motoristas. Sin tu punto de destino, no es posible organizar la ruta ni asignarte transporte.'}
            </p>

            {registro.latitud && registro.longitud ? (
              <div className="mb-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">¡Destino registrado correctamente! ✅</p>
                    <p className="text-xs text-green-600 mt-0.5 font-mono">{registro.latitud.toFixed(5)}, {registro.longitud.toFixed(5)}</p>
                    {registro.coordenadas_at && <p className="text-xs text-green-600">{new Date(registro.coordenadas_at).toLocaleString('es-SV')}</p>}
                  </div>
                </div>
                <a href={`https://www.google.com/maps?q=${registro.latitud},${registro.longitud}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 underline mt-1">
                  <ExternalLink className="w-3 h-3" /> Ver en Google Maps
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">Todavía no tenés un punto de destino registrado. ¡Marcarlo solo toma un momento! 😊</p>
            )}

            {gpsMsg && (
              <div className={`text-sm rounded-lg px-3 py-2 mb-3 ${gpsEstado === 'ok' ? 'bg-green-50 text-green-700' : gpsEstado === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                {gpsMsg}
              </div>
            )}

            <button onClick={() => setMostrarMapa(true)}
              className={`w-full flex items-center justify-center gap-2 text-white font-medium py-3 px-4 rounded-xl transition-colors text-sm ${registro.latitud && registro.longitud ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700'}`}>
              <Map className="w-5 h-5" />
              {registro.latitud ? 'Actualizar mi punto de destino' : 'Registrar mi punto de destino'}
            </button>
          </section>

          {/* Eventos */}
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
                {eventos.map(ev => {
                  const sol = solicitudMap[ev.id]
                  return (
                    <div key={ev.id} className="border border-gray-100 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 text-sm">{ev.nombre}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        📅 {new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        {ev.hora && ` · ${fmt12(ev.hora)}`}{ev.hora_fin && ` – ${fmt12(ev.hora_fin)}`}
                      </p>
                      {ev.lugar && <p className="text-xs text-gray-500">📍 {ev.lugar}</p>}
                      {ev.evento_latitud && ev.evento_longitud && (
                        <a href={`https://www.google.com/maps?q=${ev.evento_latitud},${ev.evento_longitud}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5">
                          <MapPin className="w-3 h-3" /> Ver lugar del evento en Maps
                        </a>
                      )}
                      {ev.descripcion && <p className="text-xs text-gray-400 mt-1">{ev.descripcion}</p>}
                      <TransporteAcciones ev={ev} sol={sol} solicitando={solicitando === ev.id}
                        onSolicitar={(opts) => solicitarTransporte(ev.id, opts)}
                        onCancelar={() => sol && cancelarSolicitud(sol.id)} />
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Mis datos */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">Mis datos</h2>
            <dl className="space-y-1.5 text-sm">
              {[['DUI', registro.dui], ['Teléfono', registro.telefono ?? '—'], ['Cargo', registro.cargo], ['JRV', registro.jrv]].map(([l, v]) => (
                <div key={l} className="flex justify-between"><dt className="text-gray-500">{l}</dt><dd className="text-gray-800">{v}</dd></div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </>
  )
}
