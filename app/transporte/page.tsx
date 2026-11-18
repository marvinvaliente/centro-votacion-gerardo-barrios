'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import {
  MapPin, Bus, Calendar, CheckCircle, XCircle, Clock,
  ChevronLeft, Loader2, ExternalLink, Map, X, Navigation
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

  // No ha solicitado aún
  const ambosDisponibles = ev.transporte_recogida && ev.transporte_regreso
  const soloUno = ambosDisponibles && (selRecogida !== selRegreso) // exactamente uno marcado
  const [confirmando, setConfirmando] = useState(false)

  function intentarSolicitar() {
    // Si ambos están disponibles y solo marcó uno, pedir confirmación
    if (ambosDisponibles && soloUno) {
      setConfirmando(true)
      return
    }
    onSolicitar({
      recogida: selRecogida,
      regreso: selRegreso,
      tipo_recogida: selRecogida && tienePuntoReunion ? 'punto_reunion' : 'domicilio',
    })
  }

  if (confirmando) {
    const falta = selRecogida ? '🏠 Llevarme a casa' : '🚐 Llevarme al evento'
    const tieneLabel = selRecogida ? '🚐 Llevarme al evento' : '🏠 Llevarme a casa'
    return (
      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-amber-800">¡Un momento antes de confirmar! 🙂</p>
        <p className="text-sm text-amber-700">
          Seleccionaste solo <span className="font-medium">{tieneLabel}</span>. Para este evento también está disponible <span className="font-medium">{falta}</span>. ¿Lo vas a necesitar?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setConfirmando(false)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5"
          >
            Sí, agregar también {falta}
          </button>
          <button
            onClick={() => { setConfirmando(false); onSolicitar({ recogida: selRecogida, regreso: selRegreso, tipo_recogida: selRecogida && tienePuntoReunion ? 'punto_reunion' : 'domicilio' }) }}
            className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4 text-gray-500" />
            No, solo necesito {tieneLabel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {/* Aviso si no tiene GPS */}
      {!tieneGps && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <MapPin className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            <span className="font-semibold">Antes de solicitar, indicá tu punto de destino. 📍</span>{' '}
            Usá los botones de arriba para marcarlo — así podemos organizarte la ruta correctamente.
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500 font-medium">Seleccioná el transporte que necesitás:</p>
      <div className="flex gap-2 flex-wrap">
        {ev.transporte_recogida && (
          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer text-sm transition-colors ${!tieneGps ? 'opacity-40 pointer-events-none' : ''} ${selRecogida ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <input type="checkbox" checked={selRecogida}
              onChange={(e) => {
                setSelRecogida(e.target.checked)
                if (!e.target.checked) { setTipoRecogida('domicilio'); setTooltipVisible(null) }
                else setTooltipVisible('recogida')
              }}
              className="w-3.5 h-3.5 accent-blue-600" />
            🚐 Llevarme al evento
          </label>
        )}
        {ev.transporte_regreso && (
          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer text-sm transition-colors ${!tieneGps ? 'opacity-40 pointer-events-none' : ''} ${selRegreso ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <input type="checkbox" checked={selRegreso}
              onChange={(e) => {
                setSelRegreso(e.target.checked)
                if (!e.target.checked) setTooltipVisible(null)
                else setTooltipVisible('regreso')
              }}
              className="w-3.5 h-3.5 accent-indigo-600" />
            🏠 Llevarme a casa
          </label>
        )}
      </div>

      {/* Mensajes emergentes por opción */}
      {tooltipVisible === 'recogida' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5">
          <span className="text-lg flex-shrink-0">🚐</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-blue-800">Llevarme al evento</p>
            <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
              {tienePuntoReunion && ev.punto_reunion_nombre
                ? <>Un motorista te esperará en <strong>{ev.punto_reunion_nombre}</strong> y te llevará al evento desde ese punto de reunión.</>
                : <>Un motorista pasará a buscarte <strong>en el punto que marcaste en el mapa</strong> y te llevará directamente al evento.</>
              }
            </p>
          </div>
          <button onClick={() => setTooltipVisible(null)} className="flex-shrink-0 text-blue-400 hover:text-blue-600 ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {tooltipVisible === 'regreso' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-start gap-2.5">
          <span className="text-lg flex-shrink-0">🏠</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-indigo-800">Llevarme a casa</p>
            <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">
              Al finalizar el evento, el motorista te llevará de regreso <strong>al punto que marcaste en el mapa</strong>. Verificá que tus coordenadas GPS sean correctas.
            </p>
          </div>
          <button onClick={() => setTooltipVisible(null)} className="flex-shrink-0 text-indigo-400 hover:text-indigo-600 ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Punto de reunión: si el evento lo tiene, es el único método de recogida */}
      {selRecogida && tienePuntoReunion && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-3 flex items-start gap-2.5">
          <MapPin className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-orange-800">📍 Punto de reunión obligatorio</p>
            {ev.punto_reunion_nombre && (
              <p className="text-sm text-orange-700 font-medium">{ev.punto_reunion_nombre}</p>
            )}
            <p className="text-xs text-orange-600 mt-0.5">Para este evento la recogida es únicamente en el punto de reunión indicado</p>
            {ev.punto_reunion_lat && (
              <a href={`https://www.google.com/maps?q=${ev.punto_reunion_lat},${ev.punto_reunion_lng}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-0.5 mt-1">
                <ExternalLink className="w-3 h-3" />Ver ubicación en Maps
              </a>
            )}
          </div>
        </div>
      )}

      {/* Cierre de plazo */}
      {ev.hora_fin && (
        <p className="text-xs text-gray-400">
          ⏱ Tenés hasta las {(() => { const [h,m] = ev.hora_fin!.slice(0,5).split(':').map(Number); const cierre = h * 60 + m + 30; const hc = Math.floor(cierre / 60) % 24; const mc = cierre % 60; return fmt12(`${String(hc).padStart(2,'0')}:${String(mc).padStart(2,'0')}`) })()} para registrar tu solicitud
        </p>
      )}

      <button
        onClick={intentarSolicitar}
        disabled={solicitando || ningunaSeleccionada || !tieneGps}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
      >
        {solicitando
          ? <><Loader2 className="w-4 h-4 animate-spin" />Registrando tu solicitud...</>
          : <><Bus className="w-4 h-4" />{!tieneGps ? 'Primero indicá tu punto de destino' : ningunaSeleccionada ? 'Seleccioná al menos una opción' : 'Solicitar transporte'}</>}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Si en esta ocasión no vas a necesitar transporte, no es necesario que hagas nada aquí. 🙂
      </p>
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

  // Auto-login si viene ?dui= desde el portal
  useEffect(() => {
    const duiParam = searchParams.get('dui')
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
      .not('latitud', 'is', null)
      .not('longitud', 'is', null)

    const motoristas = (motData ?? []) as { id: string; nombre: string; telefono: string | null; latitud: number; longitud: number }[]
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

    // 3. Algoritmo greedy balanceado con Haversine
    const cap = Math.ceil(sols.length / motoristas.length)
    const carga: Record<string, number> = Object.fromEntries(motoristas.map((m) => [m.id, 0]))
    const asignaciones: { solicitud_id: string; motorista_id: string }[] = []

    const conGPS = sols.filter((s) => s.latitud && s.longitud)
    const sinGPS = sols.filter((s) => !s.latitud || !s.longitud)

    for (const sol of conGPS) {
      const candidatos = motoristas
        .filter((m) => carga[m.id] < cap)
        .sort((a, b) =>
          distKm(sol.latitud!, sol.longitud!, a.latitud, a.longitud) -
          distKm(sol.latitud!, sol.longitud!, b.latitud, b.longitud)
        )
      if (!candidatos.length) continue
      carga[candidatos[0].id]++
      asignaciones.push({ solicitud_id: sol.id, motorista_id: candidatos[0].id })
    }

    for (const sol of sinGPS) {
      const motorista = [...motoristas].sort((a, b) => carga[a.id] - carga[b.id])[0]
      carga[motorista.id]++
      asignaciones.push({ solicitud_id: sol.id, motorista_id: motorista.id })
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

      // Agregar al estado local sin motorista inicialmente
      const nuevaSol: Solicitud = {
        ...data,
        motorista_id: null, motorista_nombre: null, motorista_telefono: null,
        tipo_recogida: data.tipo_recogida ?? 'domicilio',
      }
      setSolicitudes((prev) => [...prev, nuevaSol])

      // Auto-distribuir motoristas para este evento
      const motoristaMap = await autoDistribuirEvento(eventoId)

      // Actualizar estado local: refetch la solicitud recién creada con motorista asignado
      const { data: solActualizada } = await supabase
        .from('solicitudes_transporte')
        .select('id, motorista_id')
        .eq('id', data.id)
        .single()

      if (solActualizada?.motorista_id && motoristaMap[solActualizada.motorista_id]) {
        const mot = motoristaMap[solActualizada.motorista_id]
        setSolicitudes((prev) => prev.map((s) =>
          s.id === data.id
            ? { ...s, motorista_id: solActualizada.motorista_id, motorista_nombre: mot.nombre, motorista_telefono: mot.telefono }
            : s
        ))
      }
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
                {registro?.latitud && registro?.longitud ? '¿Dónde te dejamos?' : '📍 Paso obligatorio: indicá tu destino'}
              </h2>
            </div>
            <p className={`text-xs mb-3 ml-7 ${registro?.latitud && registro?.longitud ? 'text-gray-400' : 'text-red-600 font-medium'}`}>
              {registro?.latitud && registro?.longitud
                ? 'Marcá tu vivienda u otro lugar donde querés que te llevemos al finalizar el evento'
                : 'Necesitás registrar tu punto de destino para poder solicitar transporte.'}
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
                Todavía no tenés un destino registrado. Usá los botones de abajo para marcarlo fácilmente — ¡solo toma un momento! 😊
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
              {registro?.latitud ? 'Cambiar punto de destino' : 'Marcar mi destino en el mapa'}
            </button>
          </section>

          {/* Eventos y solicitudes */}
          <section className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${!(registro?.latitud && registro?.longitud) ? 'opacity-40 pointer-events-none select-none' : ''}`}>
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
