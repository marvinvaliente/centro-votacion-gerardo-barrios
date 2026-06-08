'use client'

import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Search, CheckCircle, AlertTriangle, Save, Pencil, Users, X, FileSpreadsheet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { RegistroDUI, Padron } from '@/types'

const JRV_ESTANDAR = new Set(['2429','2430','2431','2432','2433','2434','2435','2436','2437','2438','2439','2440','2441','2442','2443','2444','2445','2446'])

function Avatar({ nombre, fotoUrl }: { nombre: string; fotoUrl?: string | null }) {
  const iniciales = nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
  return (
    <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center font-bold text-xs flex-shrink-0"
      style={{ background: 'var(--azul-light)', color: 'var(--azul)', border: '1px solid #bfdbfe' }}>
      {fotoUrl
        ? <img src={fotoUrl} alt={nombre} className="w-full h-full object-cover" />
        : iniciales
      }
    </div>
  )
}

/* ─── Combobox buscador ─── */
function PersonaBuscador({ value, opciones, onChange }: {
  value: string; opciones: RegistroDUI[]; onChange: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const seleccionada = opciones.find(r => r.id === value) ?? null
  const filtradas = opciones.filter(r =>
    !query || r.nombre.toLowerCase().includes(query.toLowerCase()) || r.dui.includes(query)
  )

  useEffect(() => {
    function cerrar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setAbierto(false); setQuery('') }
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setAbierto(v => !v)}
        className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all"
        style={{ background: 'var(--fondo)', border: `1.5px solid ${abierto ? 'var(--navy)' : 'var(--borde)'}`, minWidth: 200, boxShadow: abierto ? '0 0 0 3px rgba(26,46,74,.08)' : 'none' }}>
        <span className="text-xs truncate" style={{ color: seleccionada ? 'var(--texto)' : 'var(--texto-muted)' }}>
          {seleccionada ? seleccionada.nombre : '— Sin asignar —'}
        </span>
        <Search size={12} style={{ color: 'var(--texto-muted)', flexShrink: 0, marginLeft: 6 }} />
      </div>

      {abierto && (
        <div className="rounded-xl shadow-lg" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
          background: 'var(--superficie)', border: '1px solid var(--borde)',
          width: 300, maxHeight: 280, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--sombra-lg)'
        }}>
          <div className="p-2.5" style={{ borderBottom: '1px solid var(--borde)' }}>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--texto-muted)' }} />
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Buscar nombre o DUI..." className="input pl-8" style={{ fontSize: 12, padding: '6px 10px 6px 30px' }} />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div onClick={() => { onChange(''); setAbierto(false); setQuery('') }}
              className="px-3 py-2.5 text-xs cursor-pointer flex items-center gap-2"
              style={{ color: 'var(--texto-muted)', borderBottom: '1px solid var(--borde)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--fondo)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              <X size={11} /> Sin asignar
            </div>
            {filtradas.length === 0
              ? <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--texto-muted)' }}>Sin resultados</div>
              : filtradas.map(r => (
                <div key={r.id} onClick={() => { onChange(r.id); setAbierto(false); setQuery('') }}
                  className="px-3 py-2.5 text-xs cursor-pointer"
                  style={{ background: r.id === value ? 'var(--azul-light)' : 'transparent', borderBottom: '1px solid var(--borde)' }}
                  onMouseEnter={e => { if (r.id !== value) (e.currentTarget as HTMLElement).style.background = 'var(--fondo)' }}
                  onMouseLeave={e => { if (r.id !== value) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <div className="font-semibold" style={{ color: r.id === value ? 'var(--azul)' : 'var(--texto)' }}>{r.nombre}</div>
                  <div className="font-mono mt-0.5" style={{ color: 'var(--texto-muted)', fontSize: 11 }}>{r.dui}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Modal de edición ─── */
function ModalEdicion({ registro, onGuardar, onCerrar }: {
  registro: RegistroDUI; onGuardar: (actualizado: RegistroDUI) => void; onCerrar: () => void
}) {
  const [form, setForm] = useState({
    nombre: registro.nombre ?? '', dui: registro.dui ?? '',
    telefono: registro.telefono ?? '', direccion: registro.direccion ?? '',
    correo: registro.correo ?? '', estado: registro.estado ?? 'pendiente',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    if (!form.nombre.trim() || !form.dui.trim()) { setError('Nombre y DUI son obligatorios'); return }
    setGuardando(true); setError('')
    const { error: err } = await supabase.from('registros_dui')
      .update({ ...form, updated_at: new Date().toISOString() }).eq('id', registro.id)
    if (err) { setError('Error: ' + err.message); setGuardando(false); return }
    onGuardar({ ...registro, ...form })
  }

  const campos: { key: keyof typeof form; label: string; type?: string; full?: boolean }[] = [
    { key: 'nombre', label: 'Nombre completo', full: true },
    { key: 'dui', label: 'DUI' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'correo', label: 'Correo electrónico', type: 'email', full: true },
    { key: 'direccion', label: 'Dirección', full: true },
  ]

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)' }} onClick={onCerrar}>
      <div className="card w-full max-w-lg overflow-hidden" style={{ boxShadow: 'var(--sombra-lg)' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--borde)', background: 'var(--fondo)' }}>
          <div>
            <div className="font-semibold flex items-center gap-2"><Pencil size={14} /> Editar registro</div>
            <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--texto-muted)' }}>{registro.dui}</div>
          </div>
          <button onClick={onCerrar} className="btn btn-ghost btn-sm w-8 h-8 p-0 justify-center">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {campos.map(({ key, label, type, full }) => (
            <div key={key} className={full ? 'col-span-2' : ''}>
              <label className="field-label">{label}</label>
              <input type={type ?? 'text'} value={form[key]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                className="input" />
            </div>
          ))}
          <div>
            <label className="field-label">Estado</label>
            <select value={form.estado} onChange={e => setForm(prev => ({ ...prev, estado: e.target.value }))} className="input">
              <option value="completo">Completo</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
        </div>
        {error && <p className="px-6 pb-2 text-xs" style={{ color: 'var(--rojo)' }}>{error}</p>}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onCerrar} className="btn btn-ghost flex-1 justify-center">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="btn btn-primary flex-1 justify-center">
            <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Página principal ─── */
export default function AsignacionPage() {
  const [padron, setPadron] = useState<Padron[]>([])
  const [registros, setRegistros] = useState<RegistroDUI[]>([])
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'asignados' | 'vacios'>('todos')
  const [guardando, setGuardando] = useState<string | null>(null)
  const [seleccion, setSeleccion] = useState<Record<string, string>>({})
  const [modalEdicion, setModalEdicion] = useState<RegistroDUI | null>(null)

  // Otros cargos
  const [nuevoCargo, setNuevoCargo] = useState('')
  const [nuevaPersonaId, setNuevaPersonaId] = useState('')
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState('')
  const [eliminandoCargo, setEliminandoCargo] = useState<string | null>(null)
  const [fotoMap, setFotoMap] = useState<Record<string, string | null>>({})

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    const [{ data: pad }, { data: reg }] = await Promise.all([
      supabase.from('padron').select('*').order('jrv').order('cargo'),
      supabase.from('registros_dui').select('*').order('nombre'),
    ])
    if (pad) setPadron(pad)
    if (reg) {
      setRegistros(reg)
      const init: Record<string, string> = {}
      pad?.forEach(p => { init[p.id] = reg.find(r => r.padron_id === p.id)?.id ?? '' })
      setSeleccion(init)
      // Cargar fotos de perfil desde usuarios
      const duis = reg.map((r: RegistroDUI) => r.dui)
      const { data: usrs } = await supabase.from('usuarios').select('dui, foto_perfil_url').in('dui', duis)
      const map: Record<string, string | null> = {}
      usrs?.forEach((u: { dui: string; foto_perfil_url: string | null }) => { map[u.dui] = u.foto_perfil_url })
      setFotoMap(map)
    }
    setCargando(false)
  }

  async function guardarAsignacion(padronId: string) {
    const registroId = seleccion[padronId]
    setGuardando(padronId)
    await supabase.from('registros_dui').update({ padron_id: null, updated_at: new Date().toISOString() }).eq('padron_id', padronId)
    if (registroId) await supabase.from('registros_dui').update({ padron_id: padronId, updated_at: new Date().toISOString() }).eq('id', registroId)
    setRegistros(prev => prev.map(r => {
      if (r.padron_id === padronId) return { ...r, padron_id: null }
      if (r.id === registroId) return { ...r, padron_id: padronId }
      return r
    }))
    setGuardando(null)
  }

  function personaAsignada(padronId: string) { return registros.find(r => r.padron_id === padronId) }
  function registrosDisponibles(padronId: string) { return registros.filter(r => !r.padron_id || r.padron_id === padronId) }

  const otrosCargos = padron.filter(p => !JRV_ESTANDAR.has(p.jrv))

  async function agregarOtroCargo() {
    if (!nuevoCargo.trim()) { setErrorNuevo('Ingrese el nombre del cargo'); return }
    setGuardandoNuevo(true); setErrorNuevo('')

    // Tomar referencia de centro/municipio/departamento del primer registro del padrón
    const ref = padron[0]
    const { data: nuevoPuesto, error } = await supabase
      .from('padron')
      .insert({
        departamento: ref?.departamento ?? 'Santa Ana',
        municipio: ref?.municipio ?? 'Santa Ana Centro',
        distrito: ref?.distrito ?? 'Santa Ana',
        centro: ref?.centro ?? 'COMPLEJO EDUCATIVO CAPITAN GENERAL GERARDO BARRIOS',
        jrv: 'OTRO',
        cargo: nuevoCargo.trim(),
      })
      .select()
      .single()

    if (error) { setErrorNuevo('Error: ' + error.message); setGuardandoNuevo(false); return }

    // Si se seleccionó persona, asignarla
    if (nuevaPersonaId && nuevoPuesto) {
      await supabase.from('registros_dui').update({ padron_id: nuevoPuesto.id, updated_at: new Date().toISOString() }).eq('id', nuevaPersonaId)
      setRegistros(prev => prev.map(r => r.id === nuevaPersonaId ? { ...r, padron_id: nuevoPuesto.id } : r))
    }

    if (nuevoPuesto) {
      setPadron(prev => [...prev, nuevoPuesto])
      setSeleccion(prev => ({ ...prev, [nuevoPuesto.id]: nuevaPersonaId }))
    }

    setNuevoCargo(''); setNuevaPersonaId(''); setGuardandoNuevo(false)
  }

  async function eliminarOtroCargo(padronId: string) {
    if (!confirm('¿Eliminar este cargo? Se desvinculará la persona asignada.')) return
    setEliminandoCargo(padronId)
    await supabase.from('registros_dui').update({ padron_id: null, updated_at: new Date().toISOString() }).eq('padron_id', padronId)
    await supabase.from('padron').delete().eq('id', padronId)
    setPadron(prev => prev.filter(p => p.id !== padronId))
    setRegistros(prev => prev.map(r => r.padron_id === padronId ? { ...r, padron_id: null } : r))
    setEliminandoCargo(null)
  }

  async function exportarExcel() {
    const XLSX = await import('xlsx')
    const base = 'https://dabcwevhedaymxuhodzf.supabase.co/storage/v1/object/public/fotos-dui'

    function construirFila(p: typeof padron[0]) {
      const persona = personaAsignada(p.id)
      const dui = persona?.dui ?? ''
      return {
        'Departamento': p.departamento,
        'Municipio':    p.municipio,
        'Distrito':     p.distrito,
        'Centro':       p.centro,
        'JRV':          p.jrv,
        'Cargo':        p.cargo,
        'Nombre':       persona?.nombre    ?? '',
        'DUI':          dui,
        'Teléfono':     persona?.telefono  ?? '',
        'Dirección':    persona?.direccion ?? '',
        'Correo':       persona?.correo    ?? '',
        'frente.jpg':   dui ? `${base}/${dui}/frente.jpg`  : '',
        'reverso.jpg':  dui ? `${base}/${dui}/reverso.jpg` : '',
      }
    }

    const cols = [
      { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 52 },
      { wch: 8  }, { wch: 24 }, { wch: 36 }, { wch: 14 },
      { wch: 14 }, { wch: 36 }, { wch: 28 }, { wch: 60 }, { wch: 60 },
    ]

    // Hoja 1 — Otros Cargos
    const filasOtros = otrosCargos.map(construirFila)
    const wsOtros = XLSX.utils.json_to_sheet(filasOtros.length ? filasOtros : [{}])
    wsOtros['!cols'] = cols

    // Hoja 2 — JRV
    const filasJrv = padron.filter(p => JRV_ESTANDAR.has(p.jrv)).map(construirFila)
    const wsJrv = XLSX.utils.json_to_sheet(filasJrv)
    wsJrv['!cols'] = cols

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsJrv, 'JRV')
    XLSX.utils.book_append_sheet(wb, wsOtros, 'Otros Cargos')

    XLSX.writeFile(wb, 'C.E. Capitán General Gerardo Barrios.xlsx')
  }

  const jrvsUnicas = Array.from(new Set(padron.map(p => p.jrv))).filter(j => JRV_ESTANDAR.has(j)).sort()
  const padronFiltrado = padron.filter(p => {
    const persona = personaAsignada(p.id)
    const matchBusqueda = !busqueda || p.jrv.includes(busqueda) || p.cargo.toLowerCase().includes(busqueda.toLowerCase()) ||
      (persona?.nombre.toLowerCase().includes(busqueda.toLowerCase()) ?? false) || (persona?.dui.includes(busqueda) ?? false)
    const matchFiltro = filtro === 'todos' ? true : filtro === 'asignados' ? !!persona : !persona
    return matchBusqueda && matchFiltro
  })

  const totalAsignados = padron.filter(p => !!personaAsignada(p.id)).length
  const totalVacios = padron.length - totalAsignados
  const pct = padron.length ? Math.round(totalAsignados / padron.length * 100) : 0

  return (
    <div className="p-4 md:p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div />
        <div className="flex gap-2">
          <button onClick={cargarDatos} className="btn btn-ghost btn-sm"><RefreshCw size={13} /> Actualizar</button>
          <button onClick={exportarExcel} className="btn btn-sm" style={{ background: 'var(--gold-light)', color: 'var(--gold-dark)', border: '1px solid var(--gold)' }}>
            <FileSpreadsheet size={13} /> Exportar Excel
          </button>
        </div>
      </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total puestos', value: padron.length, icon: Users, color: 'var(--navy)', bg: '#eff6ff', border: '#bfdbfe' },
            { label: 'Asignados', value: totalAsignados, icon: CheckCircle, color: 'var(--verde)', bg: 'var(--verde-light)', border: '#a7f3d0' },
            { label: 'Sin asignar', value: totalVacios, icon: AlertTriangle, color: 'var(--amber)', bg: 'var(--amber-light)', border: '#fde68a' },
            { label: 'Completado', value: `${pct}%`, icon: CheckCircle, color: pct === 100 ? 'var(--verde)' : 'var(--navy)', bg: pct === 100 ? 'var(--verde-light)' : '#eff6ff', border: pct === 100 ? '#a7f3d0' : '#bfdbfe' },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className="card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: bg, border: `1px solid ${border}` }}>
                <Icon size={20} style={{ color }} />
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color }}>{value}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Barra de progreso */}
        <div className="card p-4 mb-5 flex items-center gap-4">
          <span className="text-xs font-semibold" style={{ color: 'var(--texto-muted)', whiteSpace: 'nowrap' }}>Progreso de asignación</span>
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: 'var(--fondo)', border: '1px solid var(--borde)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--verde)' : 'var(--navy)' }} />
          </div>
          <span className="text-xs font-bold" style={{ color: pct === 100 ? 'var(--verde)' : 'var(--navy)', whiteSpace: 'nowrap' }}>{totalAsignados} / {padron.length}</span>
        </div>

        {/* Filtros */}
        <div className="card p-4 mb-5 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--texto-muted)' }} />
            <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por JRV, cargo, nombre o DUI..." className="input pl-9" />
          </div>
          <div className="flex gap-1.5">
            {([['todos', 'Todos'], ['asignados', '✓ Asignados'], ['vacios', '⚠ Vacíos']] as const).map(([f, label]) => (
              <button key={f} onClick={() => setFiltro(f)}
                className="btn btn-sm"
                style={{
                  background: filtro === f ? 'var(--navy)' : 'var(--superficie)',
                  color: filtro === f ? 'white' : 'var(--texto-muted)',
                  border: `1.5px solid ${filtro === f ? 'var(--navy)' : 'var(--borde)'}`,
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Otros cargos + Grupos JRV ── */}
        <div className="space-y-4">
        <div className="card overflow-x-auto">
          <div className="px-5 py-3 flex items-center gap-3"
            style={{ background: 'var(--fondo)', borderBottom: '2px solid var(--borde)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white"
              style={{ background: 'var(--gold-dark)' }}>+</div>
            <span className="font-semibold text-sm" style={{ color: 'var(--gold-dark)' }}>Otros Cargos</span>
            <span className="badge badge-amber">{otrosCargos.length} registrados</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-sm border-collapse" style={{ minWidth: 700 }}>
              <thead>
                <tr style={{ background: 'var(--fondo)', borderBottom: '1px solid var(--borde)' }}>
                  {['Cargo', 'Persona asignada', 'DUI', 'Teléfono', 'Correo', 'Dirección', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--texto-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Fila para agregar nuevo cargo */}
                <tr style={{ background: '#fffbeb', borderBottom: '2px solid #fde68a' }}>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={nuevoCargo}
                      onChange={e => setNuevoCargo(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && agregarOtroCargo()}
                      placeholder="Nombre del cargo..."
                      className="input"
                      style={{ fontSize: 12, padding: '6px 10px', minWidth: 180 }}
                    />
                    {errorNuevo && <p className="text-xs mt-1" style={{ color: 'var(--rojo)' }}>{errorNuevo}</p>}
                  </td>
                  <td className="px-4 py-3" colSpan={5}>
                    <PersonaBuscador
                      value={nuevaPersonaId}
                      opciones={registros.filter(r => !r.padron_id)}
                      onChange={setNuevaPersonaId}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={agregarOtroCargo}
                      disabled={guardandoNuevo}
                      className="btn btn-sm btn-gold disabled:opacity-40"
                    >
                      <Save size={11} />
                      {guardandoNuevo ? '...' : 'Agregar'}
                    </button>
                  </td>
                </tr>

                {/* Cargos existentes */}
                {otrosCargos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-xs" style={{ color: 'var(--texto-muted)' }}>
                      No hay otros cargos registrados. Use el formulario de arriba para agregar.
                    </td>
                  </tr>
                ) : otrosCargos.map((p, idx) => {
                  const persona = personaAsignada(p.id)
                  const disponibles = registrosDisponibles(p.id)
                  const seleccionActual = seleccion[p.id] ?? ''
                  const cambio = seleccionActual !== (persona?.id ?? '')

                  return (
                    <tr key={p.id} className="table-row-hover"
                      style={{ background: idx % 2 === 0 ? 'var(--superficie)' : '#fafafa', borderBottom: '1px solid var(--borde)' }}>
                      <td className="px-4 py-3 font-semibold text-xs" style={{ color: 'var(--texto-2)' }}>{p.cargo}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {persona && <Avatar nombre={persona.nombre} fotoUrl={fotoMap[persona.dui]} />}
                          <PersonaBuscador value={seleccionActual} opciones={disponibles}
                            onChange={id => setSeleccion(prev => ({ ...prev, [p.id]: id }))} />
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--texto-muted)' }}>{persona?.dui ?? '—'}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--texto-muted)' }}>{persona?.telefono ?? '—'}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--texto-muted)' }}>{persona?.correo ?? '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--texto-muted)', maxWidth: 180 }}>
                        <span className="truncate block">{persona?.direccion ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-1.5">
                          <button onClick={() => guardarAsignacion(p.id)}
                            disabled={!cambio || guardando === p.id}
                            className="btn btn-sm btn-primary disabled:opacity-30">
                            <Save size={11} />{guardando === p.id ? '...' : 'Asignar'}
                          </button>
                          {persona && (
                            <button onClick={() => setModalEdicion(persona)} className="btn btn-sm btn-ghost">
                              <Pencil size={11} />
                            </button>
                          )}
                          <button onClick={() => eliminarOtroCargo(p.id)}
                            disabled={eliminandoCargo === p.id}
                            className="btn btn-sm btn-danger">
                            <X size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grupos por JRV */}
        {cargando ? (
          <div className="card p-16 text-center" style={{ color: 'var(--texto-muted)' }}>
            <RefreshCw size={24} className="mx-auto mb-3 animate-spin" style={{ opacity: .4 }} />
            Cargando datos...
          </div>
        ) : (
          <>
            {jrvsUnicas.map(jrv => {
              const puestosJrv = padronFiltrado.filter(p => p.jrv === jrv)
              if (puestosJrv.length === 0) return null
              const asignadosJrv = puestosJrv.filter(p => !!personaAsignada(p.id)).length
              const completo = asignadosJrv === puestosJrv.length

              return (
                <div key={jrv} className="card overflow-hidden">
                  {/* Header JRV */}
                  <div className="px-5 py-3 flex items-center gap-3"
                    style={{ background: completo ? 'var(--verde-light)' : 'var(--fondo)', borderBottom: `2px solid ${completo ? '#a7f3d0' : 'var(--borde)'}` }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                      style={{ background: completo ? 'var(--verde)' : 'var(--navy)', color: 'white' }}>
                      {jrv.slice(-2)}
                    </div>
                    <div>
                      <span className="font-semibold text-sm" style={{ color: completo ? 'var(--verde)' : 'var(--navy)' }}>JRV {jrv}</span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <span className={`badge ${completo ? 'badge-green' : asignadosJrv > 0 ? 'badge-amber' : 'badge-red'}`}>
                        {asignadosJrv} / {puestosJrv.length} asignados
                      </span>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="w-full text-sm border-collapse" style={{ minWidth: 700 }}>
                      <thead>
                        <tr style={{ background: 'var(--fondo)', borderBottom: '1px solid var(--borde)' }}>
                          {['Cargo', 'Persona asignada', 'DUI', 'Teléfono', 'Correo', 'Dirección', ''].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--texto-muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {puestosJrv.map((p, idx) => {
                          const persona = personaAsignada(p.id)
                          const disponibles = registrosDisponibles(p.id)
                          const seleccionActual = seleccion[p.id] ?? ''
                          const cambio = seleccionActual !== (persona?.id ?? '')

                          return (
                            <tr key={p.id} className="table-row-hover transition-colors"
                              style={{ background: idx % 2 === 0 ? 'var(--superficie)' : '#fafafa', borderBottom: '1px solid var(--borde)' }}>
                              <td className="px-4 py-3">
                                <span className="font-semibold text-xs" style={{ color: 'var(--texto-2)' }}>{p.cargo}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {persona && <Avatar nombre={persona.nombre} fotoUrl={fotoMap[persona.dui]} />}
                                  <PersonaBuscador value={seleccionActual} opciones={disponibles}
                                    onChange={id => setSeleccion(prev => ({ ...prev, [p.id]: id }))} />
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--texto-muted)' }}>
                                {persona?.dui ?? '—'}
                              </td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--texto-muted)' }}>
                                {persona?.telefono ?? '—'}
                              </td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--texto-muted)' }}>
                                {persona?.correo ?? '—'}
                              </td>
                              <td className="px-4 py-3 text-xs" style={{ color: 'var(--texto-muted)', maxWidth: 180 }}>
                                <span className="truncate block">{persona?.direccion ?? '—'}</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex gap-1.5">
                                  <button onClick={() => guardarAsignacion(p.id)}
                                    disabled={!cambio || guardando === p.id}
                                    className="btn btn-sm btn-primary disabled:opacity-30">
                                    <Save size={11} />
                                    {guardando === p.id ? '...' : 'Asignar'}
                                  </button>
                                  {persona && (
                                    <button onClick={() => setModalEdicion(persona)}
                                      className="btn btn-sm btn-ghost">
                                      <Pencil size={11} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {modalEdicion && (
        <ModalEdicion registro={modalEdicion}
          onGuardar={actualizado => { setRegistros(prev => prev.map(r => r.id === actualizado.id ? actualizado : r)); setModalEdicion(null) }}
          onCerrar={() => setModalEdicion(null)} />
      )}

    </div>
  )
}
