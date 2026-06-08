'use client'

import { useState, useEffect } from 'react'
import {
  UserCheck, UserX, UserPlus, Pencil, Trash2, Search,
  RefreshCw, CheckCircle, XCircle, Clock, Shield, Eye, EyeOff, X, Save
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Usuario {
  id: string
  registro_dui_id: string | null
  nombre: string
  dui: string
  email: string | null
  telefono: string | null
  password_hash: string | null
  rol: string
  activo: boolean
  autorizado: boolean
  foto_perfil_url: string | null
  created_at: string
  updated_at: string
}

function Avatar({ nombre, fotoUrl, size = 9 }: { nombre: string; fotoUrl?: string | null; size?: number }) {
  const iniciales = nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
  const dim = `${size * 4}px`
  return (
    <div className="rounded-lg overflow-hidden flex items-center justify-center font-bold flex-shrink-0"
      style={{ width: dim, height: dim, fontSize: size < 9 ? 10 : 12, background: 'var(--azul-light)', color: 'var(--azul)', border: '1px solid #bfdbfe' }}>
      {fotoUrl
        ? <img src={fotoUrl} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : iniciales
      }
    </div>
  )
}

type Tab = 'pendientes' | 'activos' | 'inactivos' | 'todos'

function toNombrePropio(s: string) {
  return s.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '').join(' ')
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const ROLES = ['colaborador', 'supervisor', 'administrador']

const formVacio = { nombre: '', dui: '', email: '', telefono: '', rol: 'colaborador', password: '', confirmar: '' }

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(false)
  const [tab, setTab] = useState<Tab>('pendientes')
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<'nuevo' | 'editar' | null>(null)
  const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null)
  const [form, setForm] = useState(formVacio)
  const [mostrarPass, setMostrarPass] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [autorizando, setAutorizando] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [toggleando, setToggleando] = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('usuarios').select('*').order('nombre', { ascending: true })
    if (data) setUsuarios(data)
    setCargando(false)
  }

  // ── Filtros ──
  const ROL_ORDEN: Record<string, number> = { administrador: 0, supervisor: 1, colaborador: 2 }

  const filtrados = usuarios.filter(u => {
    const matchBusqueda = !busqueda ||
      u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.dui.includes(busqueda) ||
      (u.email ?? '').toLowerCase().includes(busqueda.toLowerCase())
    const matchTab =
      tab === 'todos' ? true :
      tab === 'pendientes' ? !u.autorizado :
      tab === 'activos' ? u.autorizado && u.activo :
      u.autorizado && !u.activo
    return matchBusqueda && matchTab
  }).sort((a, b) => {
    const rolDiff = (ROL_ORDEN[a.rol] ?? 9) - (ROL_ORDEN[b.rol] ?? 9)
    if (rolDiff !== 0) return rolDiff
    return a.nombre.localeCompare(b.nombre, 'es')
  })

  const [pagina, setPagina] = useState(1)
  const POR_PAGINA = 20
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const filtradosPagina = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)
  useEffect(() => { setPagina(1) }, [busqueda, tab])

  const cuentas = {
    pendientes: usuarios.filter(u => !u.autorizado).length,
    activos:    usuarios.filter(u => u.autorizado && u.activo).length,
    inactivos:  usuarios.filter(u => u.autorizado && !u.activo).length,
    todos:      usuarios.length,
  }

  // ── Autorizar ──
  async function autorizar(u: Usuario) {
    setAutorizando(u.id)
    const passHash = await hashPassword(u.dui)
    await supabase.from('usuarios').update({
      autorizado: true, activo: true,
      password_hash: passHash,
      updated_at: new Date().toISOString()
    }).eq('id', u.id)
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, autorizado: true, activo: true } : x))
    setAutorizando(null)
  }

  // ── Habilitar / Inhabilitar ──
  async function toggleActivo(u: Usuario) {
    setToggleando(u.id)
    const nuevoEstado = !u.activo
    await supabase.from('usuarios').update({ activo: nuevoEstado, updated_at: new Date().toISOString() }).eq('id', u.id)
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, activo: nuevoEstado } : x))
    setToggleando(null)
  }

  // ── Eliminar ──
  async function eliminar(u: Usuario) {
    if (!confirm(`¿Eliminar al usuario ${u.nombre}? Esta acción no se puede deshacer.`)) return
    setEliminando(u.id)
    await supabase.from('usuarios').delete().eq('id', u.id)
    setUsuarios(prev => prev.filter(x => x.id !== u.id))
    setEliminando(null)
  }

  // ── Abrir modal ──
  function abrirNuevo() {
    setForm(formVacio); setUsuarioActual(null); setError(''); setMostrarPass(false); setModal('nuevo')
  }

  function abrirEditar(u: Usuario) {
    setForm({ nombre: u.nombre, dui: u.dui, email: u.email ?? '', telefono: u.telefono ?? '', rol: u.rol, password: '', confirmar: '' })
    setUsuarioActual(u); setError(''); setMostrarPass(false); setModal('editar')
  }

  // ── Guardar ──
  async function guardar() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.dui.trim())    { setError('El DUI es obligatorio'); return }
    if (modal === 'nuevo' && !form.password) { setError('La contraseña es obligatoria para usuarios nuevos'); return }
    if (form.password && form.password !== form.confirmar) { setError('Las contraseñas no coinciden'); return }
    if (form.password && form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }

    setGuardando(true); setError('')

    const payload: Record<string, unknown> = {
      nombre: form.nombre.trim(), dui: form.dui.trim(),
      email: form.email.trim() || null, telefono: form.telefono.trim() || null,
      rol: form.rol, updated_at: new Date().toISOString(),
    }
    if (form.password) payload.password_hash = await hashPassword(form.password)

    if (modal === 'nuevo') {
      payload.autorizado = true; payload.activo = true
      const { data, error: err } = await supabase.from('usuarios').insert(payload).select().single()
      if (err) { setError('Error: ' + (err.message.includes('unique') ? 'El DUI ya existe' : err.message)); setGuardando(false); return }
      if (data) setUsuarios(prev => [data, ...prev])
    } else if (usuarioActual) {
      const { error: err } = await supabase.from('usuarios').update(payload).eq('id', usuarioActual.id)
      if (err) { setError('Error: ' + err.message); setGuardando(false); return }
      setUsuarios(prev => prev.map(x => x.id === usuarioActual.id ? { ...x, ...payload } as Usuario : x))
    }

    setGuardando(false); setModal(null)
  }

  const TABS: { key: Tab; label: string; color: string }[] = [
    { key: 'pendientes', label: 'Pendientes',  color: 'var(--amber)' },
    { key: 'activos',    label: 'Activos',     color: 'var(--verde)' },
    { key: 'inactivos',  label: 'Inactivos',   color: 'var(--rojo)'  },
    { key: 'todos',      label: 'Todos',       color: 'var(--navy)'  },
  ]

  return (
    <div className="p-4 md:p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold text-base">Administración de Usuarios</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>
            {usuarios.length} usuarios · {cuentas.pendientes} pendientes de autorización
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="btn btn-ghost btn-sm"><RefreshCw size={13} /></button>
          <button onClick={abrirNuevo} className="btn btn-primary"><UserPlus size={14} /> Nuevo usuario</button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Pendientes',  value: cuentas.pendientes, icon: Clock,       color: 'var(--amber)', bg: 'var(--amber-light)', border: '#fde68a' },
          { label: 'Activos',     value: cuentas.activos,    icon: UserCheck,   color: 'var(--verde)', bg: 'var(--verde-light)', border: '#a7f3d0' },
          { label: 'Inactivos',   value: cuentas.inactivos,  icon: UserX,       color: 'var(--rojo)',  bg: 'var(--rojo-light)',  border: '#fecaca' },
          { label: 'Total',       value: cuentas.todos,      icon: Shield,      color: 'var(--navy)',  bg: '#eff6ff',            border: '#bfdbfe' },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: bg, border: `1px solid ${border}` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color }}>{value}</div>
              <div className="text-xs" style={{ color: 'var(--texto-muted)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + búsqueda */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {TABS.map(({ key, label, color }) => (
            <button key={key} onClick={() => setTab(key)}
              className="btn btn-sm"
              style={{
                background: tab === key ? color : 'var(--superficie)',
                color: tab === key ? 'white' : 'var(--texto-muted)',
                border: `1.5px solid ${tab === key ? color : 'var(--borde)'}`,
              }}>
              {label}
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: tab === key ? 'rgba(255,255,255,.25)' : 'var(--fondo)' }}>
                {cuentas[key]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--texto-muted)' }} />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, DUI o correo..." className="input pl-9" />
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-x-auto">
        {cargando ? (
          <div className="p-12 text-center" style={{ color: 'var(--texto-muted)' }}>
            <RefreshCw size={20} className="mx-auto mb-2 animate-spin" style={{ opacity: .4 }} />Cargando...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center" style={{ color: 'var(--texto-muted)' }}>
            No hay usuarios en esta sección
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: 'var(--fondo)', borderBottom: '2px solid var(--borde)' }}>
                {['', 'Nombre', 'DUI', 'Correo', 'Teléfono', 'Rol', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradosPagina.map((u, idx) => (
                <tr key={u.id} className="table-row-hover"
                  style={{ background: idx % 2 === 0 ? 'var(--superficie)' : '#fafafa', borderBottom: '1px solid var(--borde)' }}>
                  <td className="px-3 py-2">
                    <Avatar nombre={u.nombre} fotoUrl={u.foto_perfil_url} size={9} />
                  </td>
                  <td className="px-4 py-3 font-medium">{u.nombre}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--texto-2)' }}>{u.dui}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--texto-muted)' }}>{u.email ?? '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--texto-muted)' }}>{u.telefono ?? '—'}</td>
                  <td className="px-4 py-3">
                    {u.rol === 'administrador'
                      ? <span className="badge" style={{ fontSize: 11, background: 'rgba(200,168,75,.15)', color: 'var(--gold-dark)', border: '1px solid rgba(200,168,75,.4)' }}><Shield size={10} /> administrador</span>
                      : <span className="badge badge-blue" style={{ fontSize: 11 }}>{u.rol}</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {!u.autorizado ? (
                      <span className="badge badge-amber">⏳ Pendiente</span>
                    ) : u.activo ? (
                      <span className="badge badge-green"><CheckCircle size={10} /> Activo</span>
                    ) : (
                      <span className="badge badge-red"><XCircle size={10} /> Inactivo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {!u.autorizado && (
                        <button onClick={() => autorizar(u)} disabled={autorizando === u.id}
                          className="btn btn-success btn-sm">
                          <UserCheck size={11} />{autorizando === u.id ? '...' : 'Autorizar'}
                        </button>
                      )}
                      {u.autorizado && (
                        <button onClick={() => toggleActivo(u)} disabled={toggleando === u.id}
                          className={`btn btn-sm ${u.activo ? 'btn-ghost' : 'btn-success'}`}>
                          {toggleando === u.id ? '...' : u.activo ? <><UserX size={11} /> Inhabilitar</> : <><UserCheck size={11} /> Habilitar</>}
                        </button>
                      )}
                      <button onClick={() => abrirEditar(u)} className="btn btn-ghost btn-sm">
                        <Pencil size={11} />
                      </button>
                      <button onClick={() => eliminar(u)} disabled={eliminando === u.id} className="btn btn-danger btn-sm">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filtrados.length > POR_PAGINA && (
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--borde)', background: 'var(--fondo)' }}>
            <span className="text-xs" style={{ color: 'var(--texto-muted)' }}>
              {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, filtrados.length)} de {filtrados.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPagina(1)} disabled={paginaActual === 1} className="btn btn-ghost btn-sm px-2 disabled:opacity-30">«</button>
              <button onClick={() => setPagina(p => p - 1)} disabled={paginaActual === 1} className="btn btn-ghost btn-sm disabled:opacity-30">‹ Anterior</button>
              <span className="text-xs px-3 font-medium" style={{ color: 'var(--texto)' }}>{paginaActual} / {totalPaginas}</span>
              <button onClick={() => setPagina(p => p + 1)} disabled={paginaActual === totalPaginas} className="btn btn-ghost btn-sm disabled:opacity-30">Siguiente ›</button>
              <button onClick={() => setPagina(totalPaginas)} disabled={paginaActual === totalPaginas} className="btn btn-ghost btn-sm px-2 disabled:opacity-30">»</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => { setModal(null); setError('') }}>
          <div className="card w-full max-w-md overflow-hidden" style={{ boxShadow: 'var(--sombra-lg)' }}
            onClick={e => e.stopPropagation()}>

            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--borde)', background: 'var(--fondo)' }}>
              <div className="font-semibold flex items-center gap-2">
                {modal === 'nuevo' ? <><UserPlus size={15} /> Nuevo usuario</> : <><Pencil size={15} /> Editar usuario</>}
              </div>
              <button onClick={() => setModal(null)} className="btn btn-ghost btn-sm w-8 h-8 p-0 justify-center"><X size={14} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="field-label">Nombre completo *</label>
                  <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: toNombrePropio(e.target.value) }))} className="input" placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="field-label">DUI *</label>
                  <input type="text" value={form.dui} onChange={e => setForm(p => ({ ...p, dui: e.target.value }))} className="input" placeholder="00000000-0" />
                </div>
                <div>
                  <label className="field-label">Teléfono</label>
                  <input type="tel" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} className="input" placeholder="0000-0000" />
                </div>
                <div className="col-span-2">
                  <label className="field-label">Correo electrónico</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input" placeholder="correo@ejemplo.com" />
                </div>
                <div className="col-span-2">
                  <label className="field-label">Rol</label>
                  <div className="flex gap-2">
                    {ROLES.map(r => (
                      <button key={r} onClick={() => setForm(p => ({ ...p, rol: r }))}
                        className="btn btn-sm flex-1 justify-center capitalize"
                        style={{
                          background: form.rol === r ? 'var(--navy)' : 'var(--fondo)',
                          color: form.rol === r ? 'white' : 'var(--texto-muted)',
                          border: `1.5px solid ${form.rol === r ? 'var(--navy)' : 'var(--borde)'}`,
                        }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2" style={{ borderTop: '1px solid var(--borde)', paddingTop: 12 }}>
                  <label className="field-label">{modal === 'nuevo' ? 'Contraseña *' : 'Nueva contraseña'} {modal === 'editar' && <span style={{ fontWeight: 400, color: 'var(--texto-muted)' }}>(dejar vacío para no cambiar)</span>}</label>
                  <div className="relative">
                    <input type={mostrarPass ? 'text' : 'password'} value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      className="input pr-10" placeholder="Mínimo 6 caracteres" />
                    <button onClick={() => setMostrarPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--texto-muted)' }}>
                      {mostrarPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                {form.password && (
                  <div className="col-span-2">
                    <label className="field-label">Confirmar contraseña *</label>
                    <input type={mostrarPass ? 'text' : 'password'} value={form.confirmar}
                      onChange={e => setForm(p => ({ ...p, confirmar: e.target.value }))}
                      className="input" placeholder="Repita la contraseña" />
                  </div>
                )}
              </div>
              {error && <p className="text-xs" style={{ color: 'var(--rojo)' }}>{error}</p>}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setModal(null)} className="btn btn-ghost flex-1 justify-center">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="btn btn-primary flex-1 justify-center">
                <Save size={14} />{guardando ? 'Guardando...' : modal === 'nuevo' ? 'Crear usuario' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
