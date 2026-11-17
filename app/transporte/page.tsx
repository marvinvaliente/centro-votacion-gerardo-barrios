'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { MapPin, Bus, Calendar, CheckCircle, XCircle, Clock, ChevronLeft, Loader2 } from 'lucide-react'

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
  activo: boolean
}

type Solicitud = {
  id: string
  evento_id: string
  estado: string
  created_at: string
}

type Vista = 'login' | 'perfil'

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

      // Cargar eventos activos
      const { data: evs } = await supabase
        .from('eventos_transporte')
        .select('*')
        .eq('activo', true)
        .order('fecha', { ascending: true })

      // Cargar solicitudes del usuario
      const { data: sols } = await supabase
        .from('solicitudes_transporte')
        .select('id, evento_id, estado, created_at')
        .eq('registro_id', reg.id)

      setRegistro(reg)
      setEventos(evs ?? [])
      setSolicitudes(sols ?? [])
      setVista('perfil')
    } finally {
      setCargando(false)
    }
  }

  async function capturarGPS() {
    if (!registro) return
    setGpsEstado('cargando')
    setGpsMsg('Obteniendo ubicación...')

    if (!navigator.geolocation) {
      setGpsEstado('error')
      setGpsMsg('Tu dispositivo no soporta geolocalización.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude

        const { error: upErr } = await supabase
          .from('registros_dui')
          .update({ latitud: lat, longitud: lng, coordenadas_at: new Date().toISOString() })
          .eq('id', registro.id)

        if (upErr) {
          setGpsEstado('error')
          setGpsMsg('Error al guardar. Intentá de nuevo.')
          return
        }

        setRegistro((prev) => prev ? { ...prev, latitud: lat, longitud: lng, coordenadas_at: new Date().toISOString() } : prev)
        setGpsEstado('ok')
        setGpsMsg(`Ubicación guardada: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
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

  async function solicitarTransporte(eventoId: string) {
    if (!registro) return
    setSolicitando(eventoId)
    try {
      const { data, error: err } = await supabase
        .from('solicitudes_transporte')
        .insert({ registro_id: registro.id, evento_id: eventoId, estado: 'pendiente' })
        .select('id, evento_id, estado, created_at')
        .single()

      if (err) {
        alert('Error al solicitar transporte.')
        return
      }
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

    if (!err) {
      setSolicitudes((prev) => prev.filter((s) => s.id !== solicitudId))
    }
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número de DUI
              </label>
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
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={buscarPorDui}
              disabled={cargando || !duiInput.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {cargando ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Buscando...
                </>
              ) : (
                'Acceder'
              )}
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

        {/* Tarjeta GPS */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-800">Mi Ubicación GPS</h2>
          </div>

          {registro?.latitud && registro?.longitud ? (
            <div className="mb-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Ubicación registrada</p>
                  <p className="text-xs text-green-600 mt-0.5">
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
                className="text-xs text-blue-600 underline mt-1 inline-block"
              >
                Ver en Google Maps
              </a>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-3">
              No tenés ubicación registrada. Presioná el botón para capturar tu ubicación actual.
            </p>
          )}

          {gpsMsg && (
            <div className={`text-sm rounded-lg px-3 py-2 mb-3 ${gpsEstado === 'ok' ? 'bg-green-50 text-green-700' : gpsEstado === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
              {gpsMsg}
            </div>
          )}

          <button
            onClick={capturarGPS}
            disabled={gpsEstado === 'cargando'}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {gpsEstado === 'cargando' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Capturando ubicación...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" />
                {registro?.latitud ? 'Actualizar mi ubicación' : 'Capturar mi ubicación'}
              </>
            )}
          </button>
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
                        {ev.descripcion && <p className="text-xs text-gray-400 mt-1">{ev.descripcion}</p>}
                      </div>
                    </div>

                    <div className="mt-3">
                      {sol ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full ${estadoColor(sol.estado)}`}>
                            {estadoIcon(sol.estado)}
                            Transporte: {sol.estado}
                          </span>
                          {sol.estado === 'pendiente' && (
                            <button
                              onClick={() => cancelarSolicitud(sol.id)}
                              className="text-xs text-red-500 hover:text-red-700 underline"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => solicitarTransporte(ev.id)}
                          disabled={solicitando === ev.id}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        >
                          {solicitando === ev.id ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Solicitando...</>
                          ) : (
                            <><Bus className="w-4 h-4" /> Solicitar transporte</>
                          )}
                        </button>
                      )}
                    </div>
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
  )
}
