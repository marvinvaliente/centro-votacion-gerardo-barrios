'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Bus, Calendar, MapPin, Users, Plus, Edit2, Trash2, CheckCircle,
  XCircle, Clock, ExternalLink, Loader2, ChevronDown, ChevronUp, X
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Evento = {
  id: string
  nombre: string
  descripcion: string | null
  fecha: string
  hora: string | null
  lugar: string | null
  activo: boolean
  created_at: string
}

type RegistroConSolicitud = {
  id: string
  nombre: string
  dui: string
  telefono: string | null
  cargo: string
  jrv: string
  latitud: number | null
  longitud: number | null
  coordenadas_at: string | null
  solicitud_id: string | null
  solicitud_estado: string | null
}

type TabActiva = 'eventos' | 'ubicaciones' | 'solicitudes'

const ESTADOS = ['pendiente', 'aprobado', 'rechazado']

function estadoBadge(estado: string | null) {
  if (!estado) return null
  const cls = estado === 'aprobado' ? 'bg-green-100 text-green-700' :
              estado === 'rechazado' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
  const Icon = estado === 'aprobado' ? CheckCircle : estado === 'rechazado' ? XCircle : Clock
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <Icon className="w-3 h-3" />
      {estado}
    </span>
  )
}

// ── Formulario Evento ────────────────────────────────────────
function FormEvento({
  inicial,
  onGuardar,
  onCancelar,
}: {
  inicial?: Partial<Evento>
  onGuardar: (ev: Partial<Evento>) => Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState({
    nombre: inicial?.nombre ?? '',
    descripcion: inicial?.descripcion ?? '',
    fecha: inicial?.fecha ?? '',
    hora: inicial?.hora ?? '',
    lugar: inicial?.lugar ?? '',
    activo: inicial?.activo ?? true,
  })
  const [guardando, setGuardando] = useState(false)

  async function submit() {
    if (!form.nombre.trim() || !form.fecha) return
    setGuardando(true)
    await onGuardar({
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      fecha: form.fecha,
      hora: form.hora || null,
      lugar: form.lugar.trim() || null,
      activo: form.activo,
    })
    setGuardando(false)
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600">Nombre del evento *</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej: Capacitación JRV, Día de elecciones"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Fecha *</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Hora</label>
          <input
            type="time"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.hora}
            onChange={(e) => setForm({ ...form, hora: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600">Lugar</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.lugar}
            onChange={(e) => setForm({ ...form, lugar: e.target.value })}
            placeholder="Dirección o nombre del lugar"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600">Descripción</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="activo"
            checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            className="rounded"
          />
          <label htmlFor="activo" className="text-sm text-gray-700">Evento activo (visible para usuarios)</label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancelar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={guardando || !form.nombre.trim() || !form.fecha}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg flex items-center gap-1.5"
        >
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Guardar
        </button>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────
export default function AdminTransportePage() {
  const [tab, setTab] = useState<TabActiva>('eventos')
  const [eventos, setEventos] = useState<Evento[]>([])
  const [registros, setRegistros] = useState<RegistroConSolicitud[]>([])
  const [eventoSeleccionado, setEventoSeleccionado] = useState<string | null>(null)
  const [mostrarFormEvento, setMostrarFormEvento] = useState(false)
  const [editandoEvento, setEditandoEvento] = useState<Evento | null>(null)
  const [cargando, setCargando] = useState(true)
  const [actualizandoEstado, setActualizandoEstado] = useState<string | null>(null)

  const cargarEventos = useCallback(async () => {
    const { data } = await supabase
      .from('eventos_transporte')
      .select('*')
      .order('fecha', { ascending: true })
    setEventos(data ?? [])
  }, [])

  const cargarRegistrosConSolicitudes = useCallback(async (eventoId?: string) => {
    // Registros con GPS
    const { data: regs } = await supabase
      .from('registros_dui')
      .select(`
        id, nombre, dui, telefono,
        latitud, longitud, coordenadas_at,
        padron:padron_id (cargo, jrv)
      `)
      .order('nombre')

    if (!regs) return

    let solicitudesMap: Record<string, { id: string; estado: string }> = {}
    if (eventoId) {
      const { data: sols } = await supabase
        .from('solicitudes_transporte')
        .select('id, registro_id, estado')
        .eq('evento_id', eventoId)

      if (sols) {
        solicitudesMap = Object.fromEntries(
          sols.map((s) => [s.registro_id, { id: s.id, estado: s.estado }])
        )
      }
    }

    setRegistros(
      regs.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        dui: r.dui,
        telefono: r.telefono,
        cargo: (r.padron as any)?.cargo ?? 'Sin asignar',
        jrv: (r.padron as any)?.jrv ?? '-',
        latitud: r.latitud,
        longitud: r.longitud,
        coordenadas_at: r.coordenadas_at,
        solicitud_id: solicitudesMap[r.id]?.id ?? null,
        solicitud_estado: solicitudesMap[r.id]?.estado ?? null,
      }))
    )
  }, [])

  useEffect(() => {
    async function init() {
      setCargando(true)
      await cargarEventos()
      await cargarRegistrosConSolicitudes()
      setCargando(false)
    }
    init()
  }, [cargarEventos, cargarRegistrosConSolicitudes])

  useEffect(() => {
    if (eventoSeleccionado) {
      cargarRegistrosConSolicitudes(eventoSeleccionado)
    }
  }, [eventoSeleccionado, cargarRegistrosConSolicitudes])

  async function crearEvento(ev: Partial<Evento>) {
    await supabase.from('eventos_transporte').insert(ev)
    await cargarEventos()
    setMostrarFormEvento(false)
  }

  async function actualizarEvento(ev: Partial<Evento>) {
    if (!editandoEvento) return
    await supabase.from('eventos_transporte').update(ev).eq('id', editandoEvento.id)
    await cargarEventos()
    setEditandoEvento(null)
  }

  async function eliminarEvento(id: string) {
    if (!confirm('¿Eliminar este evento? También se eliminarán todas las solicitudes asociadas.')) return
    await supabase.from('eventos_transporte').delete().eq('id', id)
    await cargarEventos()
    if (eventoSeleccionado === id) setEventoSeleccionado(null)
  }

  async function cambiarEstadoSolicitud(solicitudId: string, nuevoEstado: string) {
    setActualizandoEstado(solicitudId)
    await supabase.from('solicitudes_transporte').update({ estado: nuevoEstado }).eq('id', solicitudId)
    if (eventoSeleccionado) await cargarRegistrosConSolicitudes(eventoSeleccionado)
    setActualizandoEstado(null)
  }

  const conGPS = registros.filter((r) => r.latitud && r.longitud)
  const sinGPS = registros.filter((r) => !r.latitud || !r.longitud)
  const conSolicitud = registros.filter((r) => r.solicitud_id)

  function googleMapsRuta() {
    const pts = conGPS.slice(0, 25) // límite Google Maps
    if (pts.length === 0) return '#'
    if (pts.length === 1) return `https://www.google.com/maps?q=${pts[0].latitud},${pts[0].longitud}`
    const waypoints = pts.slice(1, -1).map((p) => `${p.latitud},${p.longitud}`).join('|')
    const origin = `${pts[0].latitud},${pts[0].longitud}`
    const dest = `${pts[pts.length - 1].latitud},${pts[pts.length - 1].longitud}`
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints ? `&waypoints=${waypoints}` : ''}`
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-5">
      <div className="flex items-center gap-3">
        <Bus className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Módulo de Transporte</h1>
          <p className="text-sm text-gray-500">Gestión de eventos, rutas y solicitudes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['eventos', 'ubicaciones', 'solicitudes'] as TabActiva[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
              tab === t ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'eventos' && <><Calendar className="w-4 h-4 inline mr-1" />Eventos</>}
            {t === 'ubicaciones' && <><MapPin className="w-4 h-4 inline mr-1" />Ubicaciones</>}
            {t === 'solicitudes' && <><Users className="w-4 h-4 inline mr-1" />Solicitudes</>}
          </button>
        ))}
      </div>

      {/* ── TAB EVENTOS ── */}
      {tab === 'eventos' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">
              Eventos programados ({eventos.length})
            </h2>
            <button
              onClick={() => { setMostrarFormEvento(true); setEditandoEvento(null) }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Nuevo evento
            </button>
          </div>

          {mostrarFormEvento && !editandoEvento && (
            <FormEvento
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
                    onGuardar={actualizarEvento}
                    onCancelar={() => setEditandoEvento(null)}
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
                        {ev.hora && ` · ${ev.hora.slice(0, 5)}`}
                      </p>
                      {ev.lugar && <p className="text-sm text-gray-500">📍 {ev.lugar}</p>}
                      {ev.descripcion && <p className="text-xs text-gray-400 mt-1">{ev.descripcion}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => { setEditandoEvento(ev); setMostrarFormEvento(false) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => eliminarEvento(ev.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
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

      {/* ── TAB UBICACIONES ── */}
      {tab === 'ubicaciones' && (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{conGPS.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Con GPS registrado</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{sinGPS.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Sin GPS</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              {conGPS.length > 0 && (
                <a
                  href={googleMapsRuta()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 h-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-3 rounded-xl transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver ruta en Google Maps
                </a>
              )}
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Cargo / JRV</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">GPS</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Fecha</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {registros.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 leading-tight">{r.nombre}</p>
                        <p className="text-xs text-gray-400 font-mono">{r.dui}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-gray-700">{r.cargo}</p>
                        <p className="text-xs text-gray-400">JRV {r.jrv}</p>
                      </td>
                      <td className="px-4 py-3">
                        {r.latitud && r.longitud ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            <MapPin className="w-3 h-3" />
                            Registrado
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Sin GPS</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-400">
                        {r.coordenadas_at ? new Date(r.coordenadas_at).toLocaleDateString('es-SV') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {r.latitud && r.longitud && (
                          <a
                            href={`https://www.google.com/maps?q=${r.latitud},${r.longitud}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg inline-flex"
                          >
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
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Seleccioná un evento</label>
            <select
              className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={eventoSeleccionado ?? ''}
              onChange={(e) => setEventoSeleccionado(e.target.value || null)}
            >
              <option value="">— Seleccionar evento —</option>
              {eventos.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.nombre} · {new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-SV')}
                </option>
              ))}
            </select>
          </div>

          {!eventoSeleccionado && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Seleccioná un evento para ver las solicitudes.</p>
            </div>
          )}

          {eventoSeleccionado && (
            <>
              {/* Resumen solicitudes */}
              <div className="grid grid-cols-3 gap-3">
                {['pendiente', 'aprobado', 'rechazado'].map((est) => {
                  const count = conSolicitud.filter((r) => r.solicitud_estado === est).length
                  const color = est === 'aprobado' ? 'text-green-600' : est === 'rechazado' ? 'text-red-500' : 'text-yellow-600'
                  return (
                    <div key={est} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
                      <p className={`text-2xl font-bold ${color}`}>{count}</p>
                      <p className="text-xs text-gray-500 capitalize">{est}</p>
                    </div>
                  )
                })}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Persona</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Teléfono</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">GPS</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {registros
                        .filter((r) => r.solicitud_id)
                        .map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900 leading-tight">{r.nombre}</p>
                              <p className="text-xs text-gray-400">{r.cargo} · JRV {r.jrv}</p>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell text-gray-500">
                              {r.telefono ?? '—'}
                            </td>
                            <td className="px-4 py-3">
                              {r.latitud && r.longitud ? (
                                <a
                                  href={`https://www.google.com/maps?q=${r.latitud},${r.longitud}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                >
                                  <MapPin className="w-3 h-3" />
                                  Ver
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">Sin GPS</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {estadoBadge(r.solicitud_estado)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 justify-center">
                                {r.solicitud_estado !== 'aprobado' && (
                                  <button
                                    onClick={() => cambiarEstadoSolicitud(r.solicitud_id!, 'aprobado')}
                                    disabled={actualizandoEstado === r.solicitud_id}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                                    title="Aprobar"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                )}
                                {r.solicitud_estado !== 'rechazado' && (
                                  <button
                                    onClick={() => cambiarEstadoSolicitud(r.solicitud_id!, 'rechazado')}
                                    disabled={actualizandoEstado === r.solicitud_id}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
                                    title="Rechazar"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      {conSolicitud.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-gray-400">
                            No hay solicitudes para este evento.
                          </td>
                        </tr>
                      )}
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
