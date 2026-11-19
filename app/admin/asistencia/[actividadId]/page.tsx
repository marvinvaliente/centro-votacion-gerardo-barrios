'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ChevronLeft, Loader2, Users, UserCheck, Search, Download, Link2 } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Asistente = {
  id: string
  nombre: string
  dui: string | null
  asistio_at: string
}

type Actividad = {
  id: string
  titulo: string
  fecha: string
  hora: string | null
  hora_fin: string | null
  lugar: string | null
}

export default function AdminAsistenciaPage() {
  const { actividadId } = useParams<{ actividadId: string }>()
  const router = useRouter()
  const [actividad, setActividad] = useState<Actividad | null>(null)
  const [asistentes, setAsistentes] = useState<Asistente[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [copiado, setCopiado] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: act }, { data: asis }] = await Promise.all([
      supabase.from('actividades').select('id,titulo,fecha,hora,hora_fin,lugar').eq('id', actividadId).single(),
      supabase.from('asistencias_actividad')
        .select('id, asistio_at, registro:registros_dui!registro_id(nombre,dui)')
        .eq('actividad_id', actividadId)
        .order('asistio_at', { ascending: true }),
    ])
    setActividad(act)
    setAsistentes((asis ?? []).map((a: any) => ({
      id: a.id,
      nombre: a.registro?.nombre ?? '—',
      dui: a.registro?.dui ?? null,
      asistio_at: a.asistio_at,
    })))
    setCargando(false)
  }, [actividadId])

  useEffect(() => { cargar() }, [cargar])

  async function eliminar(id: string) {
    await supabase.from('asistencias_actividad').delete().eq('id', id)
    setAsistentes(prev => prev.filter(a => a.id !== id))
  }

  function copiarEnlace() {
    const url = `${window.location.origin}/asistencia/${actividadId}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function exportarCSV() {
    const rows = [['Nombre', 'DUI', 'Hora registro'],
      ...filtrados.map(a => [a.nombre, a.dui ?? '', new Date(a.asistio_at).toLocaleTimeString('es-SV')])]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `asistencia-${actividad?.titulo ?? actividadId}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const filtrados = asistentes.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (a.dui ?? '').includes(busqueda)
  )

  if (cargando) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-gray-900 truncate">{actividad?.titulo}</h1>
          <p className="text-sm text-gray-500">
            {actividad?.fecha ? new Date(actividad.fecha + 'T12:00:00').toLocaleDateString('es-SV', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
            {actividad?.hora ? ` · ${actividad.hora.slice(0, 5)}` : ''}
            {actividad?.hora_fin ? ` – ${actividad.hora_fin.slice(0, 5)}` : ''}
          </p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        <button onClick={copiarEnlace}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium">
          <Link2 className="w-4 h-4" />
          {copiado ? '¡Copiado!' : 'Copiar enlace'}
        </button>
        {asistentes.length > 0 && (
          <button onClick={exportarCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm font-medium">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        )}
      </div>

      {/* Contador */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 rounded-xl border border-green-100 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-3xl font-bold text-green-700">
            <UserCheck className="w-6 h-6" />{asistentes.length}
          </div>
          <p className="text-xs text-green-600 mt-0.5">Presentes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-3xl font-bold text-gray-500">
            <Users className="w-6 h-6 text-gray-400" />{filtrados.length}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{busqueda ? 'Filtrados' : 'Total'}</p>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Buscar por nombre o DUI…"
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtrados.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">
            {asistentes.length === 0 ? 'Aún no hay asistentes registrados.' : 'Sin resultados.'}
          </p>
        )}
        {filtrados.map(a => (
          <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
            <UserCheck className="w-5 h-5 text-green-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-gray-900 truncate">{a.nombre}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {a.dui && <span className="text-xs text-gray-400">{a.dui}</span>}
                <span className="text-xs text-green-600">
                  ✓ {new Date(a.asistio_at).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
            <button onClick={() => eliminar(a.id)}
              className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
              Anular
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
