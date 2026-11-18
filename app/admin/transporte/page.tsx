'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Bus, Calendar, MapPin, Users, Plus, Edit2, Trash2, CheckCircle,
  XCircle, Clock, ExternalLink, Loader2, X, Truck, Shuffle, User
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Tipos ────────────────────────────────────────────────────
type Evento = {
  id: string; nombre: string; descripcion: string | null
  fecha: string; hora: string | null; hora_fin: string | null; lugar: string | null
  evento_latitud: number | null; evento_longitud: number | null
  transporte_recogida: boolean; transporte_regreso: boolean
  activo: boolean; created_at: string
  punto_reunion_nombre: string | null
  punto_reunion_lat: number | null
  punto_reunion_lng: number | null
}

type Registro = {
  id: string; nombre: string; dui: string; telefono: string | null
  cargo: string; jrv: string; latitud: number | null; longitud: number | null
  es_motorista: boolean
}

type Solicitud = {
  id: string; registro_id: string; evento_id: string; estado: string
  solicita_recogida: boolean; solicita_regreso: boolean
  motorista_id: string | null
  nombre: string; dui: string; telefono: string | null
  cargo: string; jrv: string; latitud: number | null; longitud: number | null
}

type TabActiva = 'eventos' | 'motoristas' | 'ubicaciones' | 'solicitudes'

// ── Utilidades ───────────────────────────────────────────────
function fmt12(hora: string | null | undefined): string {
  if (!hora) return ''
  const [h, m] = hora.slice(0, 5).split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Convierte "HH:MM" (24h) → { h12, min, ampm } para los selects */
function parse24(val: string | null | undefined): { h12: string; min: string; ampm: 'AM' | 'PM' } {
  if (!val) return { h12: '', min: '00', ampm: 'AM' }
  const [h, m] = val.slice(0, 5).split(':').map(Number)
  return {
    h12: String(h % 12 === 0 ? 12 : h % 12),
    min: String(m).padStart(2, '0'),
    ampm: h < 12 ? 'AM' : 'PM',
  }
}

/** Convierte { h12, min, ampm } → "HH:MM" (24h) para guardar en DB */
function to24(h12: string, min: string, ampm: 'AM' | 'PM'): string | null {
  const h = parseInt(h12)
  if (!h12 || isNaN(h)) return null
  let h24 = ampm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12)
  return `${String(h24).padStart(2, '0')}:${min}`
}

/** Selector de hora 12h: hora (1-12) + minutos (00/15/30/45) + AM/PM */
function HoraPicker({
  value, onChange, label, hint,
}: {
  value: string | null
  onChange: (val: string | null) => void
  label: string
  hint?: string
}) {
  const parsed = parse24(value)
  const [h12, setH12] = useState(parsed.h12)
  const [min, setMin] = useState(parsed.min)
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed.ampm)

  useEffect(() => {
    const p = parse24(value)
    setH12(p.h12); setMin(p.min); setAmpm(p.ampm)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(newH: string, newM: string, newA: 'AM' | 'PM') {
    setH12(newH); setMin(newM); setAmpm(newA)
    onChange(to24(newH, newM, newA))
  }

  const selectCls = 'border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        {/* Hora */}
        <select value={h12} onChange={(e) => update(e.target.value, min, ampm)} className={`${selectCls} w-16`}>
          <option value="">--</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={String(n)}>{n}</option>
          ))}
        </select>
        <span className="text-gray-400 font-bold">:</span>
        {/* Minutos */}
        <select value={min} onChange={(e) => update(h12, e.target.value, ampm)} className={`${selectCls} w-16`}>
          {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        {/* AM/PM */}
        <select value={ampm} onChange={(e) => update(h12, min, e.target.value as 'AM' | 'PM')} className={`${selectCls} w-16`}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function estadoBadge(estado: string | null) {
  if (!estado) return null
  const cls = estado === 'aprobado' ? 'bg-green-100 text-green-700' :
    estado === 'rechazado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
  const Icon = estado === 'aprobado' ? CheckCircle : estado === 'rechazado' ? XCircle : Clock
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <Icon className="w-3 h-3" />{estado}
    </span>
  )
}

// ── Formulario de Evento ─────────────────────────────────────
function FormEvento({ inicial, motoristasDisponibles, motoristasSeleccionados, onGuardar, onCancelar }: {
  inicial?: Partial<Evento>
  motoristasDisponibles: { id: string; nombre: string; telefono: string | null }[]
  motoristasSeleccionados: string[]
  onGuardar: (ev: Partial<Evento>, motoristaIds: string[]) => Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState({
    nombre: inicial?.nombre ?? '',
    descripcion: inicial?.descripcion ?? '',
    fecha: inicial?.fecha ?? '',
    hora: inicial?.hora ?? '',
    hora_fin: inicial?.hora_fin ?? '',
    lugar: inicial?.lugar ?? '',
    evento_latitud: inicial?.evento_latitud ?? null as number | null,
    evento_longitud: inicial?.evento_longitud ?? null as number | null,
    transporte_recogida: inicial?.transporte_recogida ?? false,
    transporte_regreso: inicial?.transporte_regreso ?? false,
    activo: inicial?.activo ?? true,
    punto_reunion_nombre: inicial?.punto_reunion_nombre ?? '',
    punto_reunion_lat: inicial?.punto_reunion_lat ?? null as number | null,
    punto_reunion_lng: inicial?.punto_reunion_lng ?? null as number | null,
  })
  const [selMotoristas, setSelMotoristas] = useState<string[]>(motoristasSeleccionados)
  const [guardando, setGuardando] = useState(false)
  const [gpsEstado, setGpsEstado] = useState<'idle' | 'cargando' | 'ok' | 'error'>('idle')
  const [gpsMsg, setGpsMsg] = useState('')
  const [mapsInput, setMapsInput] = useState('')
  const [prEstado, setPrEstado] = useState<'idle' | 'cargando' | 'ok' | 'error'>('idle')
  const [prMsg, setPrMsg] = useState('')
  const [prInput, setPrInput] = useState('')
  const [usarPuntoReunion, setUsarPuntoReunion] = useState(
    !!(inicial?.punto_reunion_lat && inicial?.punto_reunion_lng)
  )

  function toggleMotorista(id: string) {
    setSelMotoristas(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  function capturarGPS() {
    setGpsEstado('cargando'); setGpsMsg('Obteniendo...')
    if (!navigator.geolocation) { setGpsEstado('error'); setGpsMsg('GPS no disponible.'); return }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm((f) => ({ ...f, evento_latitud: p.coords.latitude, evento_longitud: p.coords.longitude }))
        setMapsInput('')
        setGpsEstado('ok'); setGpsMsg(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`)
      },
      () => { setGpsEstado('error'); setGpsMsg('No se pudo obtener la ubicación.') },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  function parsearDesdeInput(texto: string) {
    setMapsInput(texto)
    if (!texto.trim()) return

    let lat: number | null = null
    let lng: number | null = null

    // Formato: lat,lng o "lat, lng" (coordenadas directas)
    const coordDirecta = texto.match(/^[-\s]*(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)\s*$/)
    if (coordDirecta) {
      lat = parseFloat(coordDirecta[1])
      lng = parseFloat(coordDirecta[2])
    }

    // Google Maps: /@lat,lng,zoom o @lat,lng
    if (!lat) {
      const arroba = texto.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
      if (arroba) { lat = parseFloat(arroba[1]); lng = parseFloat(arroba[2]) }
    }

    // Google Maps: ?q=lat,lng  o  ll=lat,lng
    if (!lat) {
      const qParam = texto.match(/[?&](?:q|ll)=(-?\d{1,3}\.\d+)[,+](-?\d{1,3}\.\d+)/)
      if (qParam) { lat = parseFloat(qParam[1]); lng = parseFloat(qParam[2]) }
    }

    // Google Maps: /place/.../data=...!3dlat!4dlng  o  !2dlat!3dlng
    if (!lat) {
      const data3d = texto.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/)
      if (data3d) { lat = parseFloat(data3d[1]); lng = parseFloat(data3d[2]) }
    }

    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      setForm((f) => ({ ...f, evento_latitud: lat, evento_longitud: lng }))
      setGpsEstado('ok')
      setGpsMsg(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } else if (texto.length > 10) {
      setGpsEstado('error')
      setGpsMsg('No se pudieron extraer coordenadas. Intentá pegar el link completo de Google Maps.')
    }
  }

  function parsearPR(texto: string) {
    setPrInput(texto)
    if (!texto.trim()) return
    let lat: number | null = null; let lng: number | null = null
    const coordDirecta = texto.match(/^[-\s]*(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)\s*$/)
    if (coordDirecta) { lat = parseFloat(coordDirecta[1]); lng = parseFloat(coordDirecta[2]) }
    if (!lat) {
      const arroba = texto.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
      if (arroba) { lat = parseFloat(arroba[1]); lng = parseFloat(arroba[2]) }
    }
    if (!lat) {
      const qParam = texto.match(/[?&](?:q|ll)=(-?\d{1,3}\.\d+)[,+](-?\d{1,3}\.\d+)/)
      if (qParam) { lat = parseFloat(qParam[1]); lng = parseFloat(qParam[2]) }
    }
    if (!lat) {
      const data3d = texto.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/)
      if (data3d) { lat = parseFloat(data3d[1]); lng = parseFloat(data3d[2]) }
    }
    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      setForm((f) => ({ ...f, punto_reunion_lat: lat, punto_reunion_lng: lng }))
      setPrEstado('ok'); setPrMsg(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } else if (texto.length > 10) {
      setPrEstado('error'); setPrMsg('No se pudieron extraer coordenadas.')
    }
  }

  function capturarGPSPR() {
    setPrEstado('cargando'); setPrMsg('Obteniendo...')
    if (!navigator.geolocation) { setPrEstado('error'); setPrMsg('GPS no disponible.'); return }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm((f) => ({ ...f, punto_reunion_lat: p.coords.latitude, punto_reunion_lng: p.coords.longitude }))
        setPrInput('')
        setPrEstado('ok'); setPrMsg(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`)
      },
      () => { setPrEstado('error'); setPrMsg('No se pudo obtener la ubicación.') },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  async function submit() {
    if (!form.nombre.trim() || !form.fecha) return
    setGuardando(true)
    await onGuardar({
      nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null,
      fecha: form.fecha, hora: form.hora || null, hora_fin: form.hora_fin || null,
      lugar: form.lugar.trim() || null,
      evento_latitud: form.evento_latitud, evento_longitud: form.evento_longitud,
      transporte_recogida: form.transporte_recogida,
      transporte_regreso: form.transporte_regreso,
      activo: form.activo,
      punto_reunion_nombre: usarPuntoReunion ? (form.punto_reunion_nombre.trim() || null) : null,
      punto_reunion_lat: usarPuntoReunion ? form.punto_reunion_lat : null,
      punto_reunion_lng: usarPuntoReunion ? form.punto_reunion_lng : null,
    }, selMotoristas)
    setGuardando(false)
  }

  const tieneGPS = form.evento_latitud !== null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600">Nombre del evento *</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej: Capacitación JRV, Día de elecciones" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Fecha *</label>
          <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
        </div>
        <HoraPicker
          label="Hora inicio"
          value={form.hora}
          onChange={(v) => setForm({ ...form, hora: v ?? '' })}
        />
        <HoraPicker
          label="Hora finalización"
          value={form.hora_fin}
          onChange={(v) => setForm({ ...form, hora_fin: v ?? '' })}
          hint="Solicitudes se cierran 30 min después"
        />
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600">Lugar</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })}
            placeholder="Ej: Auditorio Municipal de Santa Ana" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600">GPS del evento</label>

          {/* Campo para pegar link o coordenadas */}
          <div className="mt-1 relative">
            <input
              type="text"
              placeholder="Pegá el link de Google Maps o las coordenadas (ej: 13.9942, -89.5629)"
              value={mapsInput}
              onChange={(e) => parsearDesdeInput(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-300"
            />
            {mapsInput && (
              <button type="button" onClick={() => { setMapsInput(''); setGpsEstado('idle'); setGpsMsg('') }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Separador */}
          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">o</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Capturar ubicación actual */}
          <div className="flex gap-2 flex-wrap items-center">
            <button type="button" onClick={capturarGPS} disabled={gpsEstado === 'cargando'}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg">
              {gpsEstado === 'cargando' ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
              Usar mi ubicación actual
            </button>
            {tieneGPS && (
              <a href={`https://www.google.com/maps?q=${form.evento_latitud},${form.evento_longitud}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <ExternalLink className="w-3 h-3" />Ver en Maps
              </a>
            )}
          </div>

          {/* Resultado */}
          {gpsMsg && (
            <p className={`text-xs mt-1.5 ${gpsEstado === 'ok' ? 'text-green-600' : gpsEstado === 'error' ? 'text-red-500' : 'text-blue-600'}`}>
              {gpsEstado === 'ok' ? '✓ ' : ''}{gpsMsg}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600 block mb-2">Transporte disponible</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${form.transporte_recogida ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
              <input type="checkbox" checked={form.transporte_recogida}
                onChange={(e) => setForm({ ...form, transporte_recogida: e.target.checked })}
                className="w-4 h-4 accent-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-800">🚐 Llevarme al evento</p>
                <p className="text-xs text-gray-400">Ir a recoger al personal para llevarlo al evento</p>
              </div>
            </label>
            <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${form.transporte_regreso ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
              <input type="checkbox" checked={form.transporte_regreso}
                onChange={(e) => setForm({ ...form, transporte_regreso: e.target.checked })}
                className="w-4 h-4 accent-indigo-600" />
              <div>
                <p className="text-sm font-medium text-gray-800">🏠 Llevarme a casa</p>
                <p className="text-xs text-gray-400">Llevar al personal de regreso a su destino</p>
              </div>
            </label>
          </div>
        </div>
        {/* Punto de reunión */}
        {form.transporte_recogida && (
          <div className="sm:col-span-2">
            <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors mb-3 ${usarPuntoReunion ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
              <input type="checkbox" checked={usarPuntoReunion}
                onChange={(e) => setUsarPuntoReunion(e.target.checked)}
                className="w-4 h-4 accent-orange-500" />
              <div>
                <p className="text-sm font-medium text-gray-800">📍 Habilitar punto de reunión</p>
                <p className="text-xs text-gray-400">El personal puede elegir reunirse aquí en lugar de ser recogido en casa</p>
              </div>
            </label>
            {usarPuntoReunion && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Punto de reunión</p>
                <div>
                  <label className="text-xs font-medium text-gray-600">Nombre del punto</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    value={form.punto_reunion_nombre}
                    onChange={(e) => setForm({ ...form, punto_reunion_nombre: e.target.value })}
                    placeholder="Ej: Parque Central, Alcaldía Municipal" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">GPS del punto de reunión</label>
                  <div className="mt-1 relative">
                    <input type="text"
                      placeholder="Pegá el link de Google Maps o coordenadas"
                      value={prInput}
                      onChange={(e) => parsearPR(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder:text-gray-300"
                    />
                    {prInput && (
                      <button type="button" onClick={() => { setPrInput(''); setPrEstado('idle'); setPrMsg(''); setForm((f) => ({ ...f, punto_reunion_lat: null, punto_reunion_lng: null })) }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-gray-200" /><span className="text-xs text-gray-400">o</span><div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <button type="button" onClick={capturarGPSPR} disabled={prEstado === 'cargando'}
                      className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg">
                      {prEstado === 'cargando' ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                      Usar mi ubicación actual
                    </button>
                    {form.punto_reunion_lat && (
                      <a href={`https://www.google.com/maps?q=${form.punto_reunion_lat},${form.punto_reunion_lng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <ExternalLink className="w-3 h-3" />Ver en Maps
                      </a>
                    )}
                  </div>
                  {prMsg && (
                    <p className={`text-xs mt-1.5 ${prEstado === 'ok' ? 'text-green-600' : prEstado === 'error' ? 'text-red-500' : 'text-blue-600'}`}>
                      {prEstado === 'ok' ? '✓ ' : ''}{prMsg}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600">Descripción</label>
          <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input type="checkbox" id="activo" checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="rounded" />
          <label htmlFor="activo" className="text-sm text-gray-700">Evento activo (visible para usuarios)</label>
        </div>

        {/* Motoristas asignados al evento */}
        {(form.transporte_recogida || form.transporte_regreso) && (
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-2">
              Motoristas disponibles para este evento
              {selMotoristas.length > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {selMotoristas.length} seleccionado{selMotoristas.length !== 1 ? 's' : ''}
                </span>
              )}
            </label>
            {motoristasDisponibles.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No hay perfiles de motorista registrados aún.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {motoristasDisponibles.map(m => {
                  const sel = selMotoristas.includes(m.id)
                  return (
                    <label key={m.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border-2 cursor-pointer transition-colors ${sel ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={sel} onChange={() => toggleMotorista(m.id)}
                        className="w-4 h-4 accent-blue-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.nombre}</p>
                        {m.telefono && <p className="text-xs text-gray-400">{m.telefono}</p>}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
            {selMotoristas.length === 0 && motoristasDisponibles.length > 0 && (
              <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                ⚠️ Sin motoristas asignados no habrá distribución automática.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancelar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
        <button onClick={submit} disabled={guardando || !form.nombre.trim() || !form.fecha}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg flex items-center gap-1.5">
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Guardar
        </button>
      </div>
    </div>
  )
}

// ── Algoritmo de distribución ────────────────────────────────
function distribuirMotoristas(
  motoristas: { id: string; latitud: number; longitud: number }[],
  solicitudes: { id: string; latitud: number | null; longitud: number | null }[]
): { solicitud_id: string; motorista_id: string }[] {
  const conGPS = solicitudes.filter((s) => s.latitud && s.longitud)
  const sinGPS = solicitudes.filter((s) => !s.latitud || !s.longitud)

  if (motoristas.length === 0) return []

  const carga: Record<string, number> = Object.fromEntries(motoristas.map((m) => [m.id, 0]))
  const resultado: { solicitud_id: string; motorista_id: string }[] = []
  const maxPorMotorista = Math.ceil(solicitudes.length / motoristas.length)

  // Con GPS: asignar al motorista más cercano con capacidad
  const ordenadas = [...conGPS].sort((a, b) => {
    const minA = Math.min(...motoristas.map((m) => distanciaKm(a.latitud!, a.longitud!, m.latitud, m.longitud)))
    const minB = Math.min(...motoristas.map((m) => distanciaKm(b.latitud!, b.longitud!, m.latitud, m.longitud)))
    return minA - minB
  })

  for (const sol of ordenadas) {
    const candidatos = motoristas
      .filter((m) => carga[m.id] < maxPorMotorista)
      .sort((a, b) =>
        distanciaKm(sol.latitud!, sol.longitud!, a.latitud, a.longitud) -
        distanciaKm(sol.latitud!, sol.longitud!, b.latitud, b.longitud)
      )
    if (!candidatos.length) continue
    carga[candidatos[0].id]++
    resultado.push({ solicitud_id: sol.id, motorista_id: candidatos[0].id })
  }

  // Sin GPS: distribuir equitativamente al motorista con menos carga
  for (const sol of sinGPS) {
    const motorista = motoristas.sort((a, b) => carga[a.id] - carga[b.id])[0]
    carga[motorista.id]++
    resultado.push({ solicitud_id: sol.id, motorista_id: motorista.id })
  }

  return resultado
}

// ── Componente principal ─────────────────────────────────────
export default function AdminTransportePage() {
  const [tab, setTab] = useState<TabActiva>('eventos')
  const [eventos, setEventos] = useState<Evento[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [eventoSeleccionado, setEventoSeleccionado] = useState<string | null>(null)
  const [mostrarFormEvento, setMostrarFormEvento] = useState(false)
  const [editandoEvento, setEditandoEvento] = useState<Evento | null>(null)
  const [motoristasEvento, setMotoristasEvento] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [distribuyendo, setDistribuyendo] = useState(false)
  const [toggleando, setToggleando] = useState<string | null>(null)
  const [busquedaMotorista, setBusquedaMotorista] = useState('')

  const cargarEventos = useCallback(async () => {
    const { data } = await supabase.from('eventos_transporte').select('*').order('fecha', { ascending: true })
    setEventos(data ?? [])
  }, [])

  const cargarRegistros = useCallback(async () => {
    const { data } = await supabase
      .from('registros_dui')
      .select('id, nombre, dui, telefono, latitud, longitud, es_motorista, padron:padron_id(cargo,jrv)')
      .order('nombre')
    setRegistros(
      (data ?? []).map((r: any) => ({
        id: r.id, nombre: r.nombre, dui: r.dui, telefono: r.telefono,
        latitud: r.latitud, longitud: r.longitud,
        cargo: r.padron?.cargo ?? 'Sin asignar', jrv: r.padron?.jrv ?? '-',
        es_motorista: r.es_motorista ?? false,
      }))
    )
  }, [])

  const cargarSolicitudes = useCallback(async (eventoId: string) => {
    const { data } = await supabase
      .from('solicitudes_transporte')
      .select(`
        id, registro_id, evento_id, estado,
        solicita_recogida, solicita_regreso, motorista_id,
        registro:registro_id (nombre, dui, telefono, latitud, longitud,
          padron:padron_id(cargo,jrv))
      `)
      .eq('evento_id', eventoId)

    setSolicitudes(
      (data ?? []).map((s: any) => ({
        id: s.id, registro_id: s.registro_id, evento_id: s.evento_id,
        estado: s.estado, solicita_recogida: s.solicita_recogida,
        solicita_regreso: s.solicita_regreso, motorista_id: s.motorista_id,
        nombre: s.registro?.nombre ?? '-', dui: s.registro?.dui ?? '-',
        telefono: s.registro?.telefono ?? null,
        cargo: s.registro?.padron?.cargo ?? '-', jrv: s.registro?.padron?.jrv ?? '-',
        latitud: s.registro?.latitud ?? null, longitud: s.registro?.longitud ?? null,
      }))
    )
  }, [])

  useEffect(() => {
    async function init() {
      setCargando(true)
      await Promise.all([cargarEventos(), cargarRegistros()])
      setCargando(false)
    }
    init()
  }, [cargarEventos, cargarRegistros])

  useEffect(() => {
    if (eventoSeleccionado) cargarSolicitudes(eventoSeleccionado)
  }, [eventoSeleccionado, cargarSolicitudes])

  async function cargarMotoristasEvento(eventoId: string) {
    const { data } = await supabase.from('evento_motoristas').select('motorista_id').eq('evento_id', eventoId)
    setMotoristasEvento((data ?? []).map((r: any) => r.motorista_id))
  }

  async function crearEvento(ev: Partial<Evento>, motoristaIds: string[]) {
    const { data } = await supabase.from('eventos_transporte').insert(ev).select().single()
    if (data?.id && motoristaIds.length > 0) {
      await supabase.from('evento_motoristas').insert(motoristaIds.map(mid => ({ evento_id: data.id, motorista_id: mid })))
    }
    await cargarEventos(); setMostrarFormEvento(false)
  }
  async function actualizarEvento(ev: Partial<Evento>, motoristaIds: string[]) {
    if (!editandoEvento) return
    await supabase.from('eventos_transporte').update(ev).eq('id', editandoEvento.id)
    // Reemplazar motoristas del evento
    await supabase.from('evento_motoristas').delete().eq('evento_id', editandoEvento.id)
    if (motoristaIds.length > 0) {
      await supabase.from('evento_motoristas').insert(motoristaIds.map(mid => ({ evento_id: editandoEvento.id, motorista_id: mid })))
    }
    await cargarEventos(); setEditandoEvento(null); setMotoristasEvento([])
  }
  async function eliminarEvento(id: string) {
    if (!confirm('¿Eliminar este evento? Se eliminarán todas las solicitudes asociadas.')) return
    await supabase.from('eventos_transporte').delete().eq('id', id)
    await cargarEventos()
    if (eventoSeleccionado === id) setEventoSeleccionado(null)
  }

  async function toggleMotorista(id: string, actual: boolean) {
    setToggleando(id)
    await supabase.from('registros_dui').update({ es_motorista: !actual }).eq('id', id)
    await cargarRegistros()
    setToggleando(null)
  }

  async function autoDistribuir() {
    if (!eventoSeleccionado) return
    // Cargar motoristas asignados a este evento
    const { data: emData } = await supabase.from('evento_motoristas').select('motorista_id').eq('evento_id', eventoSeleccionado)
    const motoristaIdsEvento = (emData ?? []).map((r: any) => r.motorista_id)
    const motoristas = registros.filter((r) => motoristaIdsEvento.includes(r.id) && r.latitud && r.longitud)
    if (motoristas.length === 0) {
      alert('Este evento no tiene motoristas asignados con GPS. Editá el evento y seleccioná los motoristas disponibles.')
      return
    }
    if (solicitudes.length === 0) {
      alert('No hay solicitudes para este evento.')
      return
    }
    if (!confirm(`¿Redistribuir ${solicitudes.length} solicitudes entre ${motoristas.length} motoristas? Esto reemplazará las asignaciones actuales.`)) return

    setDistribuyendo(true)
    const asignaciones = distribuirMotoristas(
      motoristas.map((m) => ({ id: m.id, latitud: m.latitud!, longitud: m.longitud! })),
      solicitudes.map((s) => ({ id: s.id, latitud: s.latitud, longitud: s.longitud }))
    )

    // Limpiar asignaciones actuales
    await supabase.from('solicitudes_transporte').update({ motorista_id: null }).eq('evento_id', eventoSeleccionado)

    // Aplicar nuevas
    for (const a of asignaciones) {
      await supabase.from('solicitudes_transporte').update({ motorista_id: a.motorista_id }).eq('id', a.solicitud_id)
    }

    await cargarSolicitudes(eventoSeleccionado)
    setDistribuyendo(false)
  }

  async function asignarMotoristManual(solicitudId: string, motoristaId: string | null) {
    await supabase.from('solicitudes_transporte').update({ motorista_id: motoristaId }).eq('id', solicitudId)
    if (eventoSeleccionado) await cargarSolicitudes(eventoSeleccionado)
  }

  // ── Métricas ─────────────────────────────────────────────
  const motoristas = registros.filter((r) => r.es_motorista)
  const conGPS = registros.filter((r) => r.latitud && r.longitud)
  const solicitudesAsignadas = solicitudes.filter((s) => s.motorista_id)

  function googleMapsRuta(motoristaId: string) {
    const sols = solicitudes.filter((s) => s.motorista_id === motoristaId && s.latitud && s.longitud)
    const motorista = registros.find((r) => r.id === motoristaId)
    if (sols.length === 0 || !motorista?.latitud) return '#'

    const ev = eventos.find((e) => e.id === eventoSeleccionado)
    const origin = motorista.latitud && motorista.longitud
      ? `${motorista.latitud},${motorista.longitud}`
      : `${sols[0].latitud},${sols[0].longitud}`
    const dest = ev?.evento_latitud && ev?.evento_longitud
      ? `${ev.evento_latitud},${ev.evento_longitud}`
      : `${sols[sols.length - 1].latitud},${sols[sols.length - 1].longitud}`
    const waypoints = sols.map((s) => `${s.latitud},${s.longitud}`).join('|')
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}`
  }

  if (cargando) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-5">
      <div className="flex items-center gap-3">
        <Bus className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Módulo de Transporte</h1>
          <p className="text-sm text-gray-500">{motoristas.length} motoristas · {registros.length} personas registradas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          { key: 'eventos',     label: 'Eventos',     icon: Calendar },
          { key: 'motoristas',  label: 'Motoristas',  icon: Truck },
          { key: 'ubicaciones', label: 'Ubicaciones', icon: MapPin },
          { key: 'solicitudes', label: 'Solicitudes', icon: Users },
        ] as { key: TabActiva; label: string; icon: any }[]).map(({ key: t, label, icon: Icon }) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 px-1 sm:px-3 text-xs sm:text-sm font-medium rounded-lg flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-colors ${tab === t ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="leading-tight text-center">{label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB EVENTOS ── */}
      {tab === 'eventos' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Eventos ({eventos.length})</h2>
            <button onClick={() => { setMostrarFormEvento(true); setEditandoEvento(null) }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg">
              <Plus className="w-4 h-4" />Nuevo evento
            </button>
          </div>
          {mostrarFormEvento && !editandoEvento && (
            <FormEvento
              motoristasDisponibles={registros.filter(r => r.es_motorista).map(r => ({ id: r.id, nombre: r.nombre, telefono: r.telefono }))}
              motoristasSeleccionados={[]}
              onGuardar={crearEvento}
              onCancelar={() => setMostrarFormEvento(false)}
            />
          )}
          {eventos.length === 0 && !mostrarFormEvento && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No hay eventos. Creá el primero.</p>
            </div>
          )}
          {eventos.map((ev) => (
            <div key={ev.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {editandoEvento?.id === ev.id ? (
                <div className="p-4">
                  <FormEvento
                    inicial={ev}
                    motoristasDisponibles={registros.filter(r => r.es_motorista).map(r => ({ id: r.id, nombre: r.nombre, telefono: r.telefono }))}
                    motoristasSeleccionados={motoristasEvento}
                    onGuardar={actualizarEvento}
                    onCancelar={() => { setEditandoEvento(null); setMotoristasEvento([]) }}
                  />
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{ev.nombre}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ev.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {ev.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        📅 {new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        {ev.hora && ` · ${fmt12(ev.hora)}`}
                        {ev.hora_fin && ` – ${fmt12(ev.hora_fin)}`}
                      </p>
                      {ev.lugar && <p className="text-sm text-gray-500">📍 {ev.lugar}</p>}
                      {ev.evento_latitud && ev.evento_longitud && (
                        <a href={`https://www.google.com/maps?q=${ev.evento_latitud},${ev.evento_longitud}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5">
                          <MapPin className="w-3 h-3" />Ver ubicación del evento
                        </a>
                      )}
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {ev.transporte_recogida && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">🚐 Llevarme al evento</span>}
                        {ev.transporte_regreso && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">🏠 Llevarme a casa</span>}
                        {!ev.transporte_recogida && !ev.transporte_regreso && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Sin transporte configurado</span>
                        )}
                      </div>
                      {ev.descripcion && <p className="text-xs text-gray-400 mt-1">{ev.descripcion}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditandoEvento(ev); setMostrarFormEvento(false); cargarMotoristasEvento(ev.id) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => eliminarEvento(ev.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TAB MOTORISTAS ── */}
      {tab === 'motoristas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{motoristas.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Motoristas activos</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{motoristas.filter(m => m.latitud).length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Con GPS registrado</p>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-xs text-amber-700 font-medium">Activá el rol de motorista a cualquier persona registrada en el sistema</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center gap-2">
              <p className="text-sm font-medium text-gray-700 flex-1">Todo el personal registrado</p>
              <div className="relative w-full sm:w-64">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, DUI o cargo..."
                  value={busquedaMotorista}
                  onChange={(e) => setBusquedaMotorista(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
                />
                {busquedaMotorista && (
                  <button
                    onClick={() => setBusquedaMotorista('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Teléfono</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">GPS</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Motorista</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {registros
                    .filter((r) => {
                      if (!busquedaMotorista.trim()) return true
                      const q = busquedaMotorista.toLowerCase()
                      return (
                        r.nombre.toLowerCase().includes(q) ||
                        r.dui.toLowerCase().includes(q) ||
                        r.cargo.toLowerCase().includes(q) ||
                        r.jrv.toLowerCase().includes(q) ||
                        (r.telefono ?? '').includes(q)
                      )
                    })
                    .map((r) => (
                    <tr key={r.id} className={`hover:bg-gray-50 ${r.es_motorista ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.es_motorista && <Truck className="w-4 h-4 text-blue-500 shrink-0" />}
                          <div>
                            <p className="font-medium text-gray-900 leading-tight">{r.nombre}</p>
                            <p className="text-xs text-gray-400">{r.cargo} · JRV {r.jrv}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-gray-500">{r.telefono ?? '—'}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {r.latitud ? (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Registrado</span>
                        ) : (
                          <span className="text-xs text-gray-400">Sin GPS</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleMotorista(r.id, r.es_motorista)}
                          disabled={toggleando === r.id}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${r.es_motorista ? 'bg-blue-600' : 'bg-gray-200'} ${toggleando === r.id ? 'opacity-50' : ''}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${r.es_motorista ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {busquedaMotorista.trim() !== '' && registros.filter((r) => {
                    const q = busquedaMotorista.toLowerCase()
                    return (
                      r.nombre.toLowerCase().includes(q) ||
                      r.dui.toLowerCase().includes(q) ||
                      r.cargo.toLowerCase().includes(q) ||
                      r.jrv.toLowerCase().includes(q) ||
                      (r.telefono ?? '').includes(q)
                    )
                  }).length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                        Sin resultados para &ldquo;{busquedaMotorista}&rdquo;
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB UBICACIONES ── */}
      {tab === 'ubicaciones' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{conGPS.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Con GPS registrado</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{registros.length - conGPS.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Sin GPS</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              {conGPS.length > 0 && (
                <a href={`https://www.google.com/maps/dir/?api=1&origin=${conGPS[0].latitud},${conGPS[0].longitud}&destination=${conGPS[conGPS.length-1].latitud},${conGPS[conGPS.length-1].longitud}&waypoints=${conGPS.slice(1,-1).map(p=>`${p.latitud},${p.longitud}`).join('|')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 h-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-3 rounded-xl transition-colors">
                  <ExternalLink className="w-4 h-4" />Ver todos en Maps
                </a>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Cargo / JRV</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">GPS</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {registros.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {r.es_motorista && <Truck className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                          <div>
                            <p className="font-medium text-gray-900 leading-tight">{r.nombre}</p>
                            <p className="text-xs text-gray-400 font-mono">{r.dui}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-gray-700">{r.cargo}</p>
                        <p className="text-xs text-gray-400">JRV {r.jrv}</p>
                      </td>
                      <td className="px-4 py-3">
                        {r.latitud && r.longitud
                          ? <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><MapPin className="w-3 h-3" />Registrado</span>
                          : <span className="text-xs text-gray-400">Sin GPS</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.latitud && r.longitud && (
                          <a href={`https://www.google.com/maps?q=${r.latitud},${r.longitud}`} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg inline-flex">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB SOLICITUDES ── */}
      {tab === 'solicitudes' && (
        <div className="space-y-4">
          {/* Selector de evento */}
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-48">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Evento</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={eventoSeleccionado ?? ''}
                onChange={(e) => setEventoSeleccionado(e.target.value || null)}
              >
                <option value="">— Seleccionar —</option>
                {eventos.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.nombre} · {new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-SV')}
                  </option>
                ))}
              </select>
            </div>
            {eventoSeleccionado && solicitudes.length > 0 && motoristas.length > 0 && (
              <button
                onClick={autoDistribuir}
                disabled={distribuyendo}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                {distribuyendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
                Auto-distribuir motoristas
              </button>
            )}
          </div>

          {!eventoSeleccionado && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Seleccioná un evento para ver las solicitudes.</p>
            </div>
          )}

          {eventoSeleccionado && (
            <>
              {/* Resumen por motorista */}
              {motoristas.length > 0 && solicitudesAsignadas.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Distribución por motorista</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {motoristas.map((m) => {
                      const asignados = solicitudes.filter((s) => s.motorista_id === m.id)
                      if (asignados.length === 0) return null
                      const ruta = googleMapsRuta(m.id)
                      return (
                        <div key={m.id} className="bg-white border border-blue-100 rounded-xl p-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="bg-blue-100 text-blue-700 rounded-full p-1.5 shrink-0">
                              <Truck className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">{m.nombre}</p>
                              <p className="text-xs text-gray-500">{m.telefono ?? '—'} · <span className="font-semibold text-blue-700">{asignados.length} pasajero{asignados.length !== 1 ? 's' : ''}</span></p>
                            </div>
                          </div>
                          {ruta !== '#' && (
                            <a href={ruta} target="_blank" rel="noopener noreferrer"
                              className="shrink-0 flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg">
                              <ExternalLink className="w-3 h-3" />Ruta
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tabla detalle */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Persona</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Tipo</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Motorista asignado</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">GPS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {solicitudes.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-8 text-gray-400">No hay solicitudes para este evento.</td></tr>
                      )}
                      {solicitudes.map((s) => {
                        const motoristaAsignado = motoristas.find((m) => m.id === s.motorista_id)
                        return (
                          <tr key={s.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900 leading-tight">{s.nombre}</p>
                              <p className="text-xs text-gray-400">{s.cargo} · JRV {s.jrv}</p>
                              <p className="text-xs text-gray-400">{s.telefono ?? '—'}</p>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <div className="flex gap-1 flex-wrap">
                                {s.solicita_recogida && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">🚐</span>}
                                {s.solicita_regreso && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">🏠</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={s.motorista_id ?? ''}
                                onChange={(e) => asignarMotoristManual(s.id, e.target.value || null)}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-40"
                              >
                                <option value="">Sin asignar</option>
                                {motoristas.map((m) => (
                                  <option key={m.id} value={m.id}>{m.nombre}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              {s.latitud && s.longitud ? (
                                <a href={`https://www.google.com/maps?q=${s.latitud},${s.longitud}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                  <MapPin className="w-3 h-3" />Ver
                                </a>
                              ) : <span className="text-xs text-gray-400">Sin GPS</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
