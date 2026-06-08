'use client'

import { useState, useEffect } from 'react'
import {
  Calendar, Plus, Trash2, RefreshCw, Clock, MapPin, Tag, X, Save,
  Pencil, Users, CheckCircle, XCircle, Download, Search
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Actividad {
  id: string
  titulo: string
  descripcion: string | null
  fecha: string
  hora: string | null
  lugar: string | null
  tipo: string
  creado_por: string | null
  created_at: string
}

interface Usuario {
  id: string
  nombre: string
  dui: string
  rol: string
}

interface Asistencia {
  usuario_id: string
  presente: boolean
  marcado_por: 'colaborador' | 'admin'
}

interface PadronInfo {
  jrv: string
  cargo: string
  departamento: string
  municipio: string
  centro: string
}

const JRV_ESTANDAR = new Set(['2429','2430','2431','2432','2433','2434','2435','2436','2437','2438','2439','2440','2441','2442','2443','2444','2445','2446'])

const TIPOS = ['general', 'capacitación', 'reunión']

const TIPO_COLORES: Record<string, string> = {
  'capacitación': 'var(--azul)',
  'reunión':      'var(--verde)',
  'general':      'var(--navy)',
}

const FORM_VACIO = { titulo: '', descripcion: '', fecha: '', hora: '', lugar: '', tipo: 'general' }

export default function CalendarioAdminPage() {
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [cargando, setCargando]       = useState(false)
  const [modal, setModal]             = useState<'nuevo' | 'editar' | null>(null)
  const [actual, setActual]           = useState<Actividad | null>(null)
  const [form, setForm]               = useState(FORM_VACIO)
  const [guardando, setGuardando]     = useState(false)
  const [eliminando, setEliminando]   = useState<string | null>(null)
  const [error, setError]             = useState('')

  // Asistencia
  const [modalAsistencia, setModalAsistencia]   = useState<Actividad | null>(null)
  const [usuarios, setUsuarios]                 = useState<Usuario[]>([])
  const [asistencias, setAsistencias]           = useState<Asistencia[]>([])
  const [cargandoAsist, setCargandoAsist]       = useState(false)
  const [guardandoAsist, setGuardandoAsist]     = useState<string | null>(null)
  const [busquedaAsist, setBusquedaAsist]       = useState('')
  const [padronMap, setPadronMap]               = useState<Record<string, PadronInfo | null>>({})

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('actividades').select('*').order('fecha').order('hora')
    if (data) setActividades(data)
    setCargando(false)
  }

  // ── Asistencia ──
  async function abrirAsistencia(a: Actividad) {
    setModalAsistencia(a)
    setBusquedaAsist('')
    setCargandoAsist(true)
    const [{ data: usrs }, { data: asist }] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, dui, rol').eq('autorizado', true).eq('activo', true).order('nombre'),
      supabase.from('asistencias').select('usuario_id, presente, marcado_por').eq('actividad_id', a.id),
    ])
    if (usrs) {
      setUsuarios(usrs)
      // Cargar padrón de cada usuario por DUI
      const duis = usrs.map((u: Usuario) => u.dui)
      const { data: regs } = await supabase
        .from('registros_dui')
        .select('dui, padron_id, padron(jrv, cargo, departamento, municipio, centro)')
        .in('dui', duis)
      if (regs) {
        const map: Record<string, PadronInfo | null> = {}
        usrs.forEach((u: Usuario) => {
          const reg = regs.find((r: any) => r.dui === u.dui)
          const pad = reg?.padron
          map[u.id] = Array.isArray(pad) ? (pad[0] ?? null) : (pad ?? null)
        })
        setPadronMap(map)
      }
    }
    if (asist) setAsistencias(asist)
    setCargandoAsist(false)
  }

  function presencia(uid: string): boolean | null {
    const a = asistencias.find(x => x.usuario_id === uid)
    return a ? a.presente : null
  }

  async function toggleAsistencia(uid: string, actividadId: string) {
    setGuardandoAsist(uid)
    const actual = presencia(uid)
    if (actual === null) {
      await supabase.from('asistencias').insert({ actividad_id: actividadId, usuario_id: uid, presente: true, marcado_por: 'admin' })
      setAsistencias(prev => [...prev, { usuario_id: uid, presente: true, marcado_por: 'admin' }])
    } else if (actual === true) {
      await supabase.from('asistencias').update({ presente: false, marcado_por: 'admin' }).eq('actividad_id', actividadId).eq('usuario_id', uid)
      setAsistencias(prev => prev.map(x => x.usuario_id === uid ? { ...x, presente: false, marcado_por: 'admin' } : x))
    } else {
      await supabase.from('asistencias').delete().eq('actividad_id', actividadId).eq('usuario_id', uid)
      setAsistencias(prev => prev.filter(x => x.usuario_id !== uid))
    }
    setGuardandoAsist(null)
  }

  async function exportarAsistencia(actividad: Actividad) {
    const XLSX = await import('xlsx')

    function estadoTexto(uid: string) {
      const e = presencia(uid)
      return e === true ? 'Presente' : e === false ? 'Ausente' : 'Sin registrar'
    }

    function construirFila(u: Usuario) {
      const pad = padronMap[u.id]
      return {
        'JRV':         pad ? pad.jrv   : '—',
        'Cargo':       pad ? pad.cargo : '—',
        'Nombre':      u.nombre,
        'DUI':         u.dui,
        'Asistencia':  estadoTexto(u.id),
        'Marcado por': asistencias.find(x => x.usuario_id === u.id)?.marcado_por === 'colaborador' ? 'Auto-confirmado' : asistencias.find(x => x.usuario_id === u.id) ? 'Admin' : '—',
      }
    }

    const cols = [{ wch: 8 }, { wch: 28 }, { wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 16 }]

    // Hoja 1 — JRVs estándar, agrupados por JRV y ordenados por cargo
    const usrsJrv = usuarios
      .filter(u => { const p = padronMap[u.id]; return p && JRV_ESTANDAR.has(p.jrv) })
      .sort((a, b) => {
        const pa = padronMap[a.id]!; const pb = padronMap[b.id]!
        return pa.jrv.localeCompare(pb.jrv) || pa.cargo.localeCompare(pb.cargo)
      })

    // Hoja 2 — Otros cargos (JRV no estándar) + sin padrón
    const usrsOtros = usuarios
      .filter(u => { const p = padronMap[u.id]; return !p || !JRV_ESTANDAR.has(p.jrv) })
      .sort((a, b) => a.nombre.localeCompare(b.nombre))

    const wsJrv   = XLSX.utils.json_to_sheet(usrsJrv.length   ? usrsJrv.map(construirFila)   : [{}])
    const wsOtros = XLSX.utils.json_to_sheet(usrsOtros.length ? usrsOtros.map(construirFila) : [{}])
    wsJrv['!cols']   = cols
    wsOtros['!cols'] = cols

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsJrv,   'Grupos JRV')
    XLSX.utils.book_append_sheet(wb, wsOtros, 'Otros Cargos')

    XLSX.writeFile(wb, `Asistencia_${actividad.titulo.replace(/\s+/g, '_')}_${actividad.fecha}.xlsx`)
  }

  // ── CRUD actividades ──
  function abrirNuevo() {
    setForm(FORM_VACIO); setActual(null); setError(''); setModal('nuevo')
  }

  function abrirEditar(a: Actividad) {
    setForm({ titulo: a.titulo, descripcion: a.descripcion ?? '', fecha: a.fecha, hora: a.hora ?? '', lugar: a.lugar ?? '', tipo: a.tipo })
    setActual(a); setError(''); setModal('editar')
  }

  async function guardar() {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return }
    if (!form.fecha)         { setError('La fecha es obligatoria'); return }
    setGuardando(true); setError('')

    const payload = {
      titulo:      form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      fecha:       form.fecha,
      hora:        form.hora || null,
      lugar:       form.lugar.trim() || null,
      tipo:        form.tipo,
    }

    if (modal === 'nuevo') {
      const { data, error: err } = await supabase.from('actividades').insert({ ...payload, creado_por: null }).select().single()
      if (err) { setError('Error: ' + err.message); setGuardando(false); return }
      if (data) setActividades(prev => [...prev, data].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? '')))
    } else if (actual) {
      const { error: err } = await supabase.from('actividades').update(payload).eq('id', actual.id)
      if (err) { setError('Error: ' + err.message); setGuardando(false); return }
      setActividades(prev => prev.map(a => a.id === actual.id ? { ...a, ...payload } : a)
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? '')))
    }

    setGuardando(false); setModal(null)
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta actividad? Esta acción no se puede deshacer.')) return
    setEliminando(id)
    await supabase.from('actividades').delete().eq('id', id)
    setActividades(prev => prev.filter(a => a.id !== id))
    setEliminando(null)
  }

  const porMes = actividades.reduce((acc, a) => {
    const mes = a.fecha.slice(0, 7)
    if (!acc[mes]) acc[mes] = []
    acc[mes].push(a)
    return acc
  }, {} as Record<string, Actividad[]>)

  const proximas = actividades.filter(a => a.fecha >= new Date().toISOString().slice(0, 10)).length
  const pasadas  = actividades.length - proximas

  const presentes = asistencias.filter(a => a.presente).length
  const ausentes  = asistencias.filter(a => !a.presente).length
  const sinReg    = usuarios.length - asistencias.length

  return (
    <div className="p-4 md:p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold text-base">Calendario de Actividades</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>
            {actividades.length} actividades · {proximas} próximas · {pasadas} pasadas
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="btn btn-ghost btn-sm"><RefreshCw size={13} /></button>
          <button onClick={abrirNuevo} className="btn btn-primary"><Plus size={14} /> Nueva actividad</button>
        </div>
      </div>

      {/* Estadísticas por tipo */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {TIPOS.map(tipo => {
          const count = actividades.filter(a => a.tipo === tipo).length
          return (
            <div key={tipo} className="card p-4 flex items-center gap-3">
              <div className="w-2.5 h-10 rounded-full flex-shrink-0" style={{ background: TIPO_COLORES[tipo] }} />
              <div>
                <div className="text-xl font-bold" style={{ color: TIPO_COLORES[tipo] }}>{count}</div>
                <div className="text-xs capitalize mt-0.5" style={{ color: 'var(--texto-muted)' }}>{tipo}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Lista de actividades */}
      {cargando ? (
        <div className="card p-16 text-center" style={{ color: 'var(--texto-muted)' }}>
          <RefreshCw size={22} className="mx-auto mb-3 animate-spin" style={{ opacity: .4 }} />
          Cargando actividades...
        </div>
      ) : actividades.length === 0 ? (
        <div className="card p-16 text-center" style={{ color: 'var(--texto-muted)' }}>
          <Calendar size={36} className="mx-auto mb-3" style={{ opacity: .25 }} />
          <p className="font-medium">No hay actividades programadas</p>
          <p className="text-xs mt-1">Use el botón "Nueva actividad" para agregar la primera</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(porMes).map(([mes, acts]) => (
            <div key={mes} className="card overflow-hidden">
              <div className="px-5 py-3 font-semibold text-sm"
                style={{ background: 'var(--fondo)', borderBottom: '2px solid var(--borde)' }}>
                {new Date(mes + '-01').toLocaleDateString('es-SV', { month: 'long', year: 'numeric' })
                  .replace(/^\w/, c => c.toUpperCase())}
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--texto-muted)' }}>
                  {acts.length} actividad{acts.length !== 1 ? 'es' : ''}
                </span>
              </div>

              {acts.map((a, i) => (
                <div key={a.id} className="px-5 py-4 flex gap-4 items-start"
                  style={{ borderBottom: i < acts.length - 1 ? '1px solid var(--borde)' : 'none', background: i % 2 === 0 ? 'var(--superficie)' : '#fafafa' }}>

                  <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                    style={{ background: TIPO_COLORES[a.tipo] + '18', border: `1px solid ${TIPO_COLORES[a.tipo]}44` }}>
                    <div className="font-bold text-base leading-none" style={{ color: TIPO_COLORES[a.tipo] }}>
                      {new Date(a.fecha + 'T00:00:00').getDate()}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: TIPO_COLORES[a.tipo], opacity: .75 }}>
                      {new Date(a.fecha + 'T00:00:00').toLocaleDateString('es-SV', { month: 'short' })}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{a.titulo}</div>
                    {a.descripcion && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>{a.descripcion}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {a.hora && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--texto-muted)' }}>
                          <Clock size={10} />{a.hora.slice(0, 5)}
                        </span>
                      )}
                      {a.lugar && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--texto-muted)' }}>
                          <MapPin size={10} />{a.lugar}
                        </span>
                      )}
                      <span className="badge text-xs capitalize"
                        style={{ background: TIPO_COLORES[a.tipo] + '18', color: TIPO_COLORES[a.tipo] }}>
                        <Tag size={9} className="inline mr-1" />{a.tipo}
                      </span>
                      {a.fecha < new Date().toISOString().slice(0, 10) && (
                        <span className="badge" style={{ background: 'var(--fondo)', color: 'var(--texto-muted)', fontSize: 10 }}>Pasada</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => abrirAsistencia(a)}
                      className="btn btn-sm"
                      style={{ background: 'var(--azul-light)', color: 'var(--azul)', border: '1px solid #bfdbfe' }}>
                      <Users size={12} /> Asistencia
                    </button>
                    <button onClick={() => abrirEditar(a)} className="btn btn-ghost btn-sm">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => eliminar(a.id)} disabled={eliminando === a.id} className="btn btn-danger btn-sm">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Modal crear / editar ── */}
      {modal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setModal(null)}>
          <div className="card w-full max-w-md overflow-hidden" style={{ boxShadow: 'var(--sombra-lg)' }}
            onClick={e => e.stopPropagation()}>

            <div className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--borde)', background: 'var(--fondo)' }}>
              <div className="font-semibold flex items-center gap-2">
                <Calendar size={15} />
                {modal === 'nuevo' ? 'Nueva actividad' : 'Editar actividad'}
              </div>
              <button onClick={() => setModal(null)} className="btn btn-ghost btn-sm w-8 h-8 p-0 justify-center"><X size={14} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="field-label">Título *</label>
                <input type="text" value={form.titulo}
                  onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                  className="input" placeholder="Nombre de la actividad" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Fecha *</label>
                  <input type="date" value={form.fecha}
                    onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                    className="input" />
                </div>
                <div>
                  <label className="field-label">Hora</label>
                  <input type="time" value={form.hora}
                    onChange={e => setForm(p => ({ ...p, hora: e.target.value }))}
                    className="input" />
                </div>
              </div>
              <div>
                <label className="field-label">Lugar</label>
                <input type="text" value={form.lugar}
                  onChange={e => setForm(p => ({ ...p, lugar: e.target.value }))}
                  className="input" placeholder="Ubicación de la actividad" />
              </div>
              <div>
                <label className="field-label">Tipo</label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS.map(t => (
                    <button key={t} onClick={() => setForm(p => ({ ...p, tipo: t }))}
                      className="btn btn-sm capitalize"
                      style={{
                        background: form.tipo === t ? TIPO_COLORES[t] : 'var(--fondo)',
                        color:      form.tipo === t ? 'white' : 'var(--texto-muted)',
                        border:     `1.5px solid ${form.tipo === t ? TIPO_COLORES[t] : 'var(--borde)'}`,
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">Descripción</label>
                <textarea value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  rows={3} className="input resize-none"
                  placeholder="Descripción opcional..." />
              </div>
              {error && <p className="text-xs" style={{ color: 'var(--rojo)' }}>{error}</p>}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setModal(null)} className="btn btn-ghost flex-1 justify-center">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="btn btn-primary flex-1 justify-center">
                <Save size={14} />
                {guardando ? 'Guardando...' : modal === 'nuevo' ? 'Crear actividad' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal asistencia ── */}
      {modalAsistencia && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setModalAsistencia(null)}>
          <div className="card w-full max-w-lg overflow-hidden"
            style={{ boxShadow: 'var(--sombra-lg)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-6 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--borde)', background: 'var(--fondo)' }}>
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold flex items-center gap-2">
                  <Users size={15} style={{ color: 'var(--azul)' }} /> Lista de asistencia
                </div>
                <button onClick={() => setModalAsistencia(null)} className="btn btn-ghost btn-sm w-8 h-8 p-0 justify-center"><X size={14} /></button>
              </div>
              <div className="text-sm font-medium">{modalAsistencia.titulo}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>
                {new Date(modalAsistencia.fecha + 'T00:00:00').toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {modalAsistencia.hora && ` · ${modalAsistencia.hora.slice(0, 5)}`}
              </div>

              {/* Resumen */}
              {!cargandoAsist && usuarios.length > 0 && (
                <div className="flex gap-3 mt-3">
                  <span className="badge badge-green"><CheckCircle size={10} /> {presentes} presentes</span>
                  <span className="badge badge-red"><XCircle size={10} /> {ausentes} ausentes</span>
                  <span className="badge" style={{ background: 'var(--fondo)', color: 'var(--texto-muted)' }}>{sinReg} sin registrar</span>
                  <button onClick={() => exportarAsistencia(modalAsistencia)}
                    className="btn btn-sm ml-auto"
                    style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #a7f3d0' }}>
                    <Download size={11} /> Excel
                  </button>
                </div>
              )}

              {/* Buscador */}
              {!cargandoAsist && usuarios.length > 0 && (
                <div className="relative mt-3">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--texto-muted)' }} />
                  <input
                    type="text"
                    value={busquedaAsist}
                    onChange={e => setBusquedaAsist(e.target.value)}
                    placeholder="Buscar por nombre o DUI..."
                    className="input pl-9"
                    style={{ fontSize: 13 }}
                  />
                </div>
              )}
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1">
              {cargandoAsist ? (
                <div className="p-12 text-center" style={{ color: 'var(--texto-muted)' }}>
                  <RefreshCw size={20} className="mx-auto mb-2 animate-spin" style={{ opacity: .4 }} />
                  Cargando...
                </div>
              ) : usuarios.length === 0 ? (
                <div className="p-12 text-center" style={{ color: 'var(--texto-muted)' }}>
                  No hay usuarios activos registrados
                </div>
              ) : usuarios.filter(u =>
                  !busquedaAsist ||
                  u.nombre.toLowerCase().includes(busquedaAsist.toLowerCase()) ||
                  u.dui.includes(busquedaAsist)
                ).map((u, i) => {
                const estado = presencia(u.id)
                const cargando = guardandoAsist === u.id
                const asistObj = asistencias.find(x => x.usuario_id === u.id)
                const marcadoPor = asistObj?.marcado_por ?? null
                return (
                  <div key={u.id} className="px-5 py-3 flex items-center gap-4"
                    style={{ borderBottom: i < usuarios.length - 1 ? '1px solid var(--borde)' : 'none', background: i % 2 === 0 ? 'var(--superficie)' : '#fafafa' }}>

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{
                        background: estado === true ? 'var(--verde-light)' : estado === false ? 'var(--rojo-light)' : 'var(--fondo)',
                        color: estado === true ? 'var(--verde)' : estado === false ? 'var(--rojo)' : 'var(--texto-muted)',
                        border: `1px solid ${estado === true ? '#a7f3d0' : estado === false ? '#fecaca' : 'var(--borde)'}`,
                      }}>
                      {u.nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{u.nombre}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono" style={{ color: 'var(--texto-muted)' }}>{u.dui}</span>
                        {marcadoPor && (
                          <span className="badge text-xs"
                            style={{
                              background: marcadoPor === 'colaborador' ? 'var(--azul-light)' : '#f3f4f6',
                              color:      marcadoPor === 'colaborador' ? 'var(--azul)' : 'var(--texto-muted)',
                              fontSize: 10,
                            }}>
                            {marcadoPor === 'colaborador' ? '✓ Auto-confirmado' : '✎ Admin'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botones de estado — ciclo: sin registrar → presente → ausente → sin registrar */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => toggleAsistencia(u.id, modalAsistencia.id)}
                        disabled={!!cargando}
                        className="btn btn-sm"
                        style={{
                          background: estado === true ? 'var(--verde-light)' : estado === false ? 'var(--rojo-light)' : 'var(--fondo)',
                          color:      estado === true ? 'var(--verde)' : estado === false ? 'var(--rojo)' : 'var(--texto-muted)',
                          border:     `1.5px solid ${estado === true ? '#a7f3d0' : estado === false ? '#fecaca' : 'var(--borde)'}`,
                          minWidth: 110,
                        }}>
                        {cargando ? '...' : estado === true ? <><CheckCircle size={11} /> Presente</> : estado === false ? <><XCircle size={11} /> Ausente</> : 'Sin registrar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--borde)', background: 'var(--fondo)' }}>
              <p className="text-xs" style={{ color: 'var(--texto-muted)' }}>
                Haga clic en el estado para cambiar: <strong>Sin registrar → Presente → Ausente → Sin registrar</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
