'use client'

import { useState, useEffect } from 'react'
import {
  Truck, Loader2, Phone, MapPin, Navigation,
  Users, Calendar, Clock, CheckCircle, Bus,
  ExternalLink, User, AlertTriangle, RefreshCw, Info,
  MessageCircle, CreditCard, Check
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Tipos ────────────────────────────────────────────────────
interface UsuarioProp { id: string; nombre: string; dui: string; registro_dui_id?: string | null }

type Motorista = {
  id: string; nombre: string; dui: string; telefono: string | null
  cargo: string; jrv: string; latitud: number | null; longitud: number | null
}

type Evento = {
  id: string; nombre: string; descripcion: string | null
  fecha: string; hora: string | null; hora_fin: string | null; lugar: string | null
  evento_latitud: number | null; evento_longitud: number | null
  transporte_recogida: boolean; transporte_regreso: boolean; activo: boolean
  punto_reunion_nombre: string | null; punto_reunion_lat: number | null; punto_reunion_lng: number | null
}

type Pasajero = {
  solicitud_id: string; registro_id: string; nombre: string; dui: string; telefono: string | null
  cargo: string; jrv: string; solicita_recogida: boolean; solicita_regreso: boolean
  latitud: number | null; longitud: number | null; estado: string
  recogido: boolean; recogido_at: string | null; completado: boolean; completado_at: string | null
  tipo_recogida: 'domicilio' | 'punto_reunion'
}

type EventoConPasajeros = Evento & { pasajeros: Pasajero[] }

// ── Helpers ──────────────────────────────────────────────────
function fmt12(hora: string | null | undefined): string {
  if (!hora) return ''
  const [h, m] = hora.slice(0, 5).split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function fmtFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-SV', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function buildGoogleMapsUrl(
  motoristaLat: number | null, motoristaLng: number | null,
  eventoLat: number | null, eventoLng: number | null,
  pasajeros: Pasajero[], tipo: 'recogida' | 'regreso',
  puntoReunionLat?: number | null, puntoReunionLng?: number | null
): string {
  if (tipo === 'recogida') {
    const domicilio = pasajeros.filter(p => p.tipo_recogida !== 'punto_reunion' && p.latitud && p.longitud)
    const pReunion = pasajeros.filter(p => p.tipo_recogida === 'punto_reunion')
    const tienePR = pReunion.length > 0 && puntoReunionLat && puntoReunionLng
    const waypoints: string[] = []
    if (tienePR) waypoints.push(`${puntoReunionLat},${puntoReunionLng}`)
    domicilio.forEach(p => waypoints.push(`${p.latitud},${p.longitud}`))
    if (waypoints.length === 0) return '#'
    const origin = motoristaLat && motoristaLng ? `${motoristaLat},${motoristaLng}` : waypoints[0]
    const dest = eventoLat && eventoLng ? `${eventoLat},${eventoLng}` : waypoints[waypoints.length - 1]
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${encodeURIComponent(waypoints.join('|'))}&travelmode=driving`
  } else {
    const conGPS = pasajeros.filter(p => p.latitud && p.longitud)
    if (conGPS.length === 0) return '#'
    const origin = eventoLat && eventoLng ? `${eventoLat},${eventoLng}` : `${conGPS[0].latitud},${conGPS[0].longitud}`
    const dest = `${conGPS[conGPS.length - 1].latitud},${conGPS[conGPS.length - 1].longitud}`
    const waypoints = conGPS.slice(0, -1).map(p => `${p.latitud},${p.longitud}`).join('|')
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints ? '&waypoints=' + encodeURIComponent(waypoints) : ''}&travelmode=driving`
  }
}

// ── Tarjeta de pasajero ───────────────────────────────────────
function TarjetaPasajero({ p, onMarcarRecogido, onMarcarCompletado }: {
  p: Pasajero
  onMarcarRecogido: (id: string, valor: boolean) => void
  onMarcarCompletado: (id: string, valor: boolean) => void
}) {
  const tipos = [p.solicita_recogida && '🚐 Al evento', p.solicita_regreso && '🏠 A casa'].filter(Boolean).join(' · ')
  const whatsappUrl = p.telefono ? `https://wa.me/503${p.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${p.nombre.split(' ')[0]}, soy tu motorista asignado. Ya voy en camino a recogerte. 🚐`)}` : null

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 transition-all ${p.completado ? 'border-green-200 bg-green-50/50' : p.recogido ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${p.completado ? 'bg-green-100' : p.recogido ? 'bg-blue-100' : 'bg-indigo-100'}`}>
            <User className={`w-4 h-4 ${p.completado ? 'text-green-600' : p.recogido ? 'text-blue-600' : 'text-indigo-600'}`} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{p.nombre}</p>
            <p className="text-xs text-gray-400 mt-0.5">{p.cargo} · JRV {p.jrv}</p>
          </div>
        </div>
        {p.completado ? (
          <span className="flex-shrink-0 text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-2 py-0.5 flex items-center gap-1 font-medium"><CheckCircle className="w-3 h-3" /> Completado</span>
        ) : p.recogido ? (
          <span className="flex-shrink-0 text-xs bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 flex items-center gap-1 font-medium"><Check className="w-3 h-3" /> Recogido</span>
        ) : (
          <span className="flex-shrink-0 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">Pendiente</span>
        )}
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs text-gray-500">{tipos}</span>
          <span className="text-xs font-mono text-gray-400 flex items-center gap-1"><CreditCard className="w-3 h-3" /> {p.dui}</span>
          {p.solicita_recogida && p.tipo_recogida === 'punto_reunion' ? (
            <span className="text-xs text-orange-600 font-medium flex items-center gap-1"><MapPin className="w-3 h-3" /> Punto de reunión</span>
          ) : p.latitud ? (
            <span className="text-xs text-green-600 flex items-center gap-1"><MapPin className="w-3 h-3" /> GPS ✓</span>
          ) : (
            <span className="text-xs text-amber-600 flex items-center gap-1"><MapPin className="w-3 h-3" /> Sin GPS</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {p.telefono && <a href={`tel:${p.telefono}`} className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 transition-colors"><Phone className="w-3.5 h-3.5" />{p.telefono}</a>}
          {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white rounded-lg px-3 py-1.5 transition-colors"><MessageCircle className="w-3.5 h-3.5" />WhatsApp</a>}
          {p.latitud && p.longitud && <a href={`https://www.google.com/maps?q=${p.latitud},${p.longitud}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-1.5 transition-colors"><MapPin className="w-3.5 h-3.5" />Ver destino</a>}
        </div>
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <button onClick={() => onMarcarRecogido(p.solicitud_id, !p.recogido)} disabled={p.completado}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-colors ${p.recogido ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40'}`}>
            <Check className="w-3.5 h-3.5" />{p.recogido ? 'Recogido ✓' : 'Marcar recogido'}
          </button>
          <button onClick={() => onMarcarCompletado(p.solicitud_id, !p.completado)} disabled={!p.recogido}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-colors ${p.completado ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-40'}`}>
            <CheckCircle className="w-3.5 h-3.5" />{p.completado ? 'Traslado completado ✓' : 'Completar traslado'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de evento ─────────────────────────────────────────
function TarjetaEvento({ ev, motorista, abierto, onToggle, onMarcarRecogido, onMarcarCompletado }: {
  ev: EventoConPasajeros; motorista: Motorista; abierto: boolean; onToggle: () => void
  onMarcarRecogido: (id: string, valor: boolean) => void; onMarcarCompletado: (id: string, valor: boolean) => void
}) {
  const recogida = ev.pasajeros.filter(p => p.solicita_recogida)
  const regreso = ev.pasajeros.filter(p => p.solicita_regreso)
  const conGPS = ev.pasajeros.filter(p => p.latitud && p.longitud)
  const recogidos = ev.pasajeros.filter(p => p.recogido)
  const completados = ev.pasajeros.filter(p => p.completado)
  const todoCompleto = ev.pasajeros.length > 0 && completados.length === ev.pasajeros.length
  const urlRecogida = buildGoogleMapsUrl(motorista.latitud, motorista.longitud, ev.evento_latitud, ev.evento_longitud, recogida, 'recogida', ev.punto_reunion_lat, ev.punto_reunion_lng)
  const urlRegreso = buildGoogleMapsUrl(motorista.latitud, motorista.longitud, ev.evento_latitud, ev.evento_longitud, regreso, 'regreso')

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${todoCompleto ? 'border-green-200' : 'border-gray-100'}`}>
      <button onClick={onToggle} className="w-full text-left p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-sm">{ev.nombre}</h3>
              {todoCompleto
                ? <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">✅ Completado</span>
                : <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">{ev.pasajeros.length} pasajero{ev.pasajeros.length !== 1 ? 's' : ''}</span>
              }
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-gray-500"><Calendar className="w-3.5 h-3.5" />{fmtFecha(ev.fecha)}</span>
              {ev.hora && <span className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3.5 h-3.5" />{fmt12(ev.hora)}{ev.hora_fin ? ` – ${fmt12(ev.hora_fin)}` : ''}</span>}
              {ev.lugar && <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin className="w-3.5 h-3.5" />{ev.lugar}</span>}
            </div>
          </div>
          <span className="text-gray-400 flex-shrink-0 mt-0.5">{abierto ? '▲' : '▼'}</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {recogida.length > 0 && <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-0.5">🚐 {recogida.length} al evento</span>}
          {regreso.length > 0 && <span className="text-xs bg-indigo-50 text-indigo-700 rounded-full px-2.5 py-0.5">🏠 {regreso.length} a casa</span>}
          {recogidos.length > 0 && <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2.5 py-0.5">✓ {recogidos.length} recogido{recogidos.length !== 1 ? 's' : ''}</span>}
          {completados.length > 0 && <span className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-0.5">✅ {completados.length}/{ev.pasajeros.length} completados</span>}
          {conGPS.length < ev.pasajeros.length && <span className="text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-0.5">⚠️ {ev.pasajeros.length - conGPS.length} sin GPS</span>}
        </div>
      </button>
      {abierto && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50/50">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rutas en Google Maps</p>
            <div className="flex flex-col sm:flex-row gap-2">
              {recogida.length > 0 && (
                <a href={urlRecogida} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${recogida.filter(p => p.latitud).length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-400 pointer-events-none'}`}>
                  <Navigation className="w-4 h-4" /> Ruta de recogida ({recogida.length}) <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {regreso.length > 0 && (
                <a href={urlRegreso} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${regreso.filter(p => p.latitud).length > 0 ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-200 text-gray-400 pointer-events-none'}`}>
                  <Navigation className="w-4 h-4" /> Ruta de regreso ({regreso.length}) <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            {conGPS.length < ev.pasajeros.length && <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{ev.pasajeros.length - conGPS.length} pasajero(s) sin GPS no aparecerán en la ruta</p>}
            {ev.punto_reunion_lat && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-orange-700">Punto de reunión{ev.punto_reunion_nombre ? `: ${ev.punto_reunion_nombre}` : ''}</p>
                  <p className="text-xs text-orange-600">{recogida.filter(p => p.tipo_recogida === 'punto_reunion').length} pasajero(s) se unen aquí · {recogida.filter(p => p.tipo_recogida !== 'punto_reunion').length} en su casa</p>
                  <a href={`https://www.google.com/maps?q=${ev.punto_reunion_lat},${ev.punto_reunion_lng}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-0.5 mt-0.5"><ExternalLink className="w-3 h-3" />Ver punto en Maps</a>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pasajeros ({ev.pasajeros.length})</p>
            {ev.pasajeros.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No hay pasajeros asignados aún</p>
            ) : (
              <div className="space-y-2">
                {ev.pasajeros.map(p => <TarjetaPasajero key={p.solicitud_id} p={p} onMarcarRecogido={onMarcarRecogido} onMarcarCompletado={onMarcarCompletado} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────
export default function MotoristaSection({ usuario }: { usuario: UsuarioProp }) {
  const [cargando, setCargando] = useState(true)
  const [esMotorista, setEsMotorista] = useState(false)
  const [motorista, setMotorista] = useState<Motorista | null>(null)
  const [eventos, setEventos] = useState<EventoConPasajeros[]>([])
  const [cargandoDatos, setCargandoDatos] = useState(false)
  const [eventoAbierto, setEventoAbierto] = useState<string | null>(null)

  useEffect(() => {
    inicializar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.dui])

  async function inicializar() {
    setCargando(true)
    try {
      const { data } = await supabase
        .from('registros_dui')
        .select('id, nombre, dui, telefono, latitud, longitud, es_motorista, padron:padron_id(cargo,jrv)')
        .eq('dui', usuario.dui).single()

      if (!data || !data.es_motorista) { setEsMotorista(false); setCargando(false); return }

      const mot: Motorista = {
        id: data.id, nombre: data.nombre, dui: data.dui, telefono: data.telefono,
        cargo: (data.padron as any)?.cargo ?? 'Sin asignar',
        jrv: (data.padron as any)?.jrv ?? '-',
        latitud: data.latitud, longitud: data.longitud,
      }
      setMotorista(mot); setEsMotorista(true)
      await cargarEventos(mot)
    } finally { setCargando(false) }
  }

  async function cargarEventos(mot: Motorista) {
    setCargandoDatos(true)
    try {
      const { data: evs } = await supabase.from('eventos_transporte').select('*').eq('activo', true).order('fecha', { ascending: true })
      if (!evs || evs.length === 0) { setEventos([]); return }
      const { data: sols } = await supabase
        .from('solicitudes_transporte')
        .select('id, evento_id, solicita_recogida, solicita_regreso, estado, tipo_recogida, recogido, recogido_at, completado, completado_at, registro:registro_id (id, nombre, dui, telefono, latitud, longitud, padron:padron_id(cargo, jrv))')
        .eq('motorista_id', mot.id).in('evento_id', evs.map(e => e.id))

      const pasajerosPorEvento: Record<string, Pasajero[]> = {}
      for (const s of (sols ?? [])) {
        const reg = (s as any).registro
        if (!pasajerosPorEvento[s.evento_id]) pasajerosPorEvento[s.evento_id] = []
        pasajerosPorEvento[s.evento_id].push({
          solicitud_id: s.id, registro_id: reg?.id ?? '',
          nombre: reg?.nombre ?? '—', dui: reg?.dui ?? '—', telefono: reg?.telefono ?? null,
          cargo: reg?.padron?.cargo ?? '—', jrv: reg?.padron?.jrv ?? '—',
          solicita_recogida: s.solicita_recogida, solicita_regreso: s.solicita_regreso,
          latitud: reg?.latitud ?? null, longitud: reg?.longitud ?? null, estado: s.estado,
          recogido: s.recogido ?? false, recogido_at: s.recogido_at ?? null,
          completado: s.completado ?? false, completado_at: s.completado_at ?? null,
          tipo_recogida: s.tipo_recogida ?? 'domicilio',
        })
      }
      const eventosConPasajeros = evs.map(ev => ({ ...ev, pasajeros: pasajerosPorEvento[ev.id] ?? [] })).filter(ev => ev.pasajeros.length > 0)
      setEventos(eventosConPasajeros)
      if (eventosConPasajeros.length === 1) setEventoAbierto(eventosConPasajeros[0].id)
    } finally { setCargandoDatos(false) }
  }

  async function marcarRecogido(solicitudId: string, valor: boolean) {
    setEventos(prev => prev.map(ev => ({ ...ev, pasajeros: ev.pasajeros.map(p => p.solicitud_id === solicitudId ? { ...p, recogido: valor, recogido_at: valor ? new Date().toISOString() : null } : p) })))
    await supabase.from('solicitudes_transporte').update({ recogido: valor, recogido_at: valor ? new Date().toISOString() : null }).eq('id', solicitudId)
  }

  async function marcarCompletado(solicitudId: string, valor: boolean) {
    const ahora = new Date().toISOString()
    setEventos(prev => prev.map(ev => ({ ...ev, pasajeros: ev.pasajeros.map(p => p.solicitud_id === solicitudId ? { ...p, completado: valor, completado_at: valor ? ahora : null } : p) })))
    await supabase.from('solicitudes_transporte').update({ completado: valor, completado_at: valor ? ahora : null }).eq('id', solicitudId)
    if (valor) {
      const evento = eventos.find(ev => ev.pasajeros.some(p => p.solicitud_id === solicitudId))
      const pasajero = evento?.pasajeros.find(p => p.solicitud_id === solicitudId)
      const actividadId = (evento as any)?.actividad_id
      if (actividadId && pasajero?.registro_id) {
        await supabase.from('asistencias_actividad').upsert({ actividad_id: actividadId, registro_id: pasajero.registro_id, asistio_at: ahora }, { onConflict: 'actividad_id,registro_id', ignoreDuplicates: true })
      }
    }
  }

  if (cargando) return (
    <div className="flex justify-center items-center" style={{ height: 'calc(100vh - 56px)' }}>
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  )

  if (!esMotorista) return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center" style={{ height: 'calc(100vh - 56px)' }}>
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
        <Truck className="w-8 h-8 text-gray-300" />
      </div>
      <div>
        <p className="font-semibold text-gray-700">Portal del Motorista</p>
        <p className="text-sm text-gray-400 mt-1">Tu cuenta no está registrada como motorista.<br />Contactá al administrador si creés que es un error.</p>
      </div>
    </div>
  )

  const totalPasajeros = eventos.reduce((acc, ev) => acc + ev.pasajeros.length, 0)
  const conGPSTotal = eventos.reduce((acc, ev) => acc + ev.pasajeros.filter(p => p.latitud).length, 0)
  const completadosTotal = eventos.reduce((acc, ev) => acc + ev.pasajeros.filter(p => p.completado).length, 0)

  return (
    <div className="min-h-full bg-gray-50 pb-10">
      {/* Header */}
      <div className="shadow" style={{ background: '#3730a3', color: 'white' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base leading-tight truncate">{motorista?.nombre}</h1>
            <p className="text-xs opacity-60 truncate">{motorista?.cargo} · JRV {motorista?.jrv}</p>
          </div>
          <button onClick={() => motorista && cargarEventos(motorista)} disabled={cargandoDatos}
            className="p-2 rounded-full hover:bg-white/10 transition-colors" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${cargandoDatos ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {!motorista?.latitud && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Tu ubicación no está registrada.</span>{' '}
              Ingresá a la sección <strong>Transporte</strong> para marcar tu punto de origen.
            </p>
          </div>
        )}

        {/* Métricas */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: `Evento${eventos.length !== 1 ? 's' : ''}`, value: eventos.length, color: 'text-indigo-600' },
            { label: `Pasajero${totalPasajeros !== 1 ? 's' : ''}`, value: totalPasajeros, color: 'text-blue-600' },
            { label: 'Con GPS', value: `${conGPSTotal}/${totalPasajeros}`, color: conGPSTotal === totalPasajeros && totalPasajeros > 0 ? 'text-green-600' : 'text-gray-600' },
            { label: 'Completados', value: `${completadosTotal}/${totalPasajeros}`, color: completadosTotal === totalPasajeros && totalPasajeros > 0 ? 'text-green-600' : 'text-gray-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {cargandoDatos && <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-3" /><p className="text-sm text-gray-500">Cargando tus asignaciones...</p></div>}

        {!cargandoDatos && eventos.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <Bus className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Sin asignaciones por ahora</p>
            <p className="text-sm text-gray-400 mt-1">Cuando el administrador asigne pasajeros para un evento, aparecerán aquí.</p>
            <button onClick={() => motorista && cargarEventos(motorista)} className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 mx-auto transition-colors">
              <RefreshCw className="w-4 h-4" /> Actualizar
            </button>
          </div>
        )}

        {!cargandoDatos && eventos.map(ev => (
          <TarjetaEvento key={ev.id} ev={ev} motorista={motorista!}
            abierto={eventoAbierto === ev.id}
            onToggle={() => setEventoAbierto(prev => prev === ev.id ? null : ev.id)}
            onMarcarRecogido={marcarRecogido} onMarcarCompletado={marcarCompletado} />
        ))}

        {!cargandoDatos && eventos.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">Marcá a cada pasajero como recogido cuando subas, y como completado cuando lo dejes en su destino.</p>
          </div>
        )}
      </div>
    </div>
  )
}
