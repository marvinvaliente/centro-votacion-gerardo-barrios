'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Circle, ChevronLeft, Loader2, Users, UserCheck, Search, Truck } from 'lucide-react'

const supabase = createClient()

type Pasajero = {
  solicitud_id: string
  registro_id: string
  nombre: string
  dui: string | null
  telefono: string | null
  foto_perfil_url: string | null
  motorista_nombre: string | null
  asistio: boolean
  asistio_at: string | null
}

type Evento = {
  id: string
  nombre: string
  fecha: string
  hora: string | null
  lugar: string | null
}

export default function AsistenciaPage() {
  const { eventoId } = useParams<{ eventoId: string }>()
  const router = useRouter()
  const [evento, setEvento] = useState<Evento | null>(null)
  const [pasajeros, setPasajeros] = useState<Pasajero[]>([])
  const [cargando, setCargando] = useState(true)
  const [marcando, setMarcando] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: ev }, { data: sols }] = await Promise.all([
      supabase.from('eventos_transporte').select('id,nombre,fecha,hora,lugar').eq('id', eventoId).single(),
      supabase
        .from('solicitudes_transporte')
        .select(`
          id, asistio, asistio_at, motorista_id,
          registro:registros_dui!registro_id(id, nombre, dui, telefono),
          motorista:registros_dui!motorista_id(nombre)
        `)
        .eq('evento_id', eventoId)
        .neq('estado', 'cancelado')
        .order('asistio', { ascending: true }),
    ])
    setEvento(ev)
    setPasajeros(
      (sols ?? []).map((s: any) => ({
        solicitud_id: s.id,
        registro_id: s.registro?.id ?? '',
        nombre: s.registro?.nombre ?? '—',
        dui: s.registro?.dui ?? null,
        telefono: s.registro?.telefono ?? null,
        foto_perfil_url: null,
        motorista_nombre: s.motorista?.nombre ?? null,
        asistio: s.asistio ?? false,
        asistio_at: s.asistio_at ?? null,
      }))
    )
    setCargando(false)
  }, [eventoId])

  useEffect(() => { cargar() }, [cargar])

  async function toggleAsistencia(solicitudId: string, actual: boolean) {
    setMarcando(solicitudId)
    const ahora = new Date().toISOString()
    await supabase
      .from('solicitudes_transporte')
      .update({ asistio: !actual, asistio_at: !actual ? ahora : null })
      .eq('id', solicitudId)
    setPasajeros(prev =>
      prev.map(p => p.solicitud_id === solicitudId
        ? { ...p, asistio: !actual, asistio_at: !actual ? ahora : null }
        : p
      )
    )
    setMarcando(null)
  }

  const filtrados = pasajeros.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.dui ?? '').includes(busqueda)
  )
  const presentes = pasajeros.filter(p => p.asistio).length
  const total = pasajeros.length

  if (cargando) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">Asistencia</h1>
          <p className="text-sm text-gray-500 truncate">
            {evento?.nombre} · {evento?.fecha ? new Date(evento.fecha + 'T12:00:00').toLocaleDateString('es-SV', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
            {evento?.hora ? ` · ${evento.hora.slice(0, 5)}` : ''}
          </p>
        </div>
      </div>

      {/* Contador */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-2xl font-bold text-gray-900">
            <Users className="w-5 h-5 text-gray-400" />{total}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Registrados</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 shadow-sm p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-2xl font-bold text-green-700">
            <UserCheck className="w-5 h-5" />{presentes}
          </div>
          <p className="text-xs text-green-600 mt-0.5">Presentes</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 shadow-sm p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{total - presentes}</p>
          <p className="text-xs text-amber-600 mt-0.5">Pendientes</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Progreso</span>
          <span className="font-semibold text-green-600">{total > 0 ? Math.round(presentes / total * 100) : 0}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${total > 0 ? (presentes / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o DUI…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtrados.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No se encontraron resultados</p>
        )}
        {filtrados.map(p => (
          <button
            key={p.solicitud_id}
            onClick={() => toggleAsistencia(p.solicitud_id, p.asistio)}
            disabled={marcando === p.solicitud_id}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
              p.asistio
                ? 'bg-green-50 border-green-200'
                : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-blue-50'
            }`}
          >
            {/* Ícono estado */}
            <div className="shrink-0">
              {marcando === p.solicitud_id
                ? <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                : p.asistio
                  ? <CheckCircle className="w-7 h-7 text-green-500" />
                  : <Circle className="w-7 h-7 text-gray-300" />
              }
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className={`font-medium text-sm truncate ${p.asistio ? 'text-green-800' : 'text-gray-900'}`}>
                {p.nombre}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {p.dui && <span className="text-xs text-gray-400">{p.dui}</span>}
                {p.motorista_nombre && (
                  <span className="flex items-center gap-0.5 text-xs text-blue-600">
                    <Truck className="w-3 h-3" />{p.motorista_nombre.split(' ')[0]}
                  </span>
                )}
                {p.asistio && p.asistio_at && (
                  <span className="text-xs text-green-600">
                    ✓ {new Date(p.asistio_at).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
