'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Download, Search, Eye, Trash2, LayoutGrid, CheckCircle, Clock, Users, Pencil, Save, X, Upload, Camera, FileImage, AlertTriangle, Sliders, TextCursorInput } from 'lucide-react'
import * as XLSX from 'xlsx'
import ImageEditor from '@/components/ImageEditor'
import { supabase } from '@/lib/supabase'
import type { RegistroDUI } from '@/types'

function toNombrePropio(s: string) {
  return s.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '').join(' ')
}

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

export default function AdminPage() {
  const [registros, setRegistros] = useState<RegistroDUI[]>([])
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [modalRegistro, setModalRegistro] = useState<RegistroDUI | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [cambiandoEstado, setCambiandoEstado] = useState<string | null>(null)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [formEdit, setFormEdit] = useState({ nombre: '', dui: '', telefono: '', correo: '', direccion: '', estado: '' })
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState('')
  const [fotoFrente, setFotoFrente] = useState<File | null>(null)
  const [fotoReverso, setFotoReverso] = useState<File | null>(null)
  const [frentePreview, setFrentePreview] = useState<string | null>(null)
  const [reversoPreview, setReversoPreview] = useState<string | null>(null)
  const [frenteValido, setFrenteValido] = useState<boolean | null>(null)
  const [reversoValido, setReversoValido] = useState<boolean | null>(null)
  const [frenteRazon, setFrenteRazon] = useState('')
  const [reversoRazon, setReversoRazon] = useState('')
  const [validandoFrente, setValidandoFrente] = useState(false)
  const [validandoReverso, setValidandoReverso] = useState(false)
  const [editorFoto, setEditorFoto] = useState<{ src: string; lado: 'frente' | 'reverso' } | null>(null)

  const [normalizando, setNormalizando] = useState(false)
  const [resultadoNorm, setResultadoNorm] = useState<string | null>(null)

  useEffect(() => { cargarRegistros() }, [])

  async function normalizarNombres() {
    if (!confirm('¿Convertir todos los nombres a formato nombre propio? Esta acción actualiza registros_dui y usuarios.')) return
    setNormalizando(true); setResultadoNorm(null)
    let actualizados = 0

    // registros_dui
    const { data: regs } = await supabase.from('registros_dui').select('id, nombre')
    if (regs) {
      for (const r of regs) {
        const normalizado = toNombrePropio(r.nombre ?? '')
        if (normalizado !== r.nombre) {
          await supabase.from('registros_dui').update({ nombre: normalizado, updated_at: new Date().toISOString() }).eq('id', r.id)
          actualizados++
        }
      }
    }

    // usuarios
    const { data: usrs } = await supabase.from('usuarios').select('id, nombre')
    if (usrs) {
      for (const u of usrs) {
        const normalizado = toNombrePropio(u.nombre ?? '')
        if (normalizado !== u.nombre) {
          await supabase.from('usuarios').update({ nombre: normalizado, updated_at: new Date().toISOString() }).eq('id', u.id)
          actualizados++
        }
      }
    }

    setResultadoNorm(`${actualizados} registro${actualizados !== 1 ? 's' : ''} actualizado${actualizados !== 1 ? 's' : ''}.`)
    setNormalizando(false)
    cargarRegistros()
  }

  async function cargarRegistros() {
    setCargando(true)
    const { data, error } = await supabase.from('registros_dui').select('*').order('nombre', { ascending: true })
    if (error) alert('Error: ' + error.message)
    if (data) setRegistros(data)
    setCargando(false)
  }

  async function eliminarRegistro(id: string, dui: string) {
    if (!confirm(`¿Eliminar el registro de DUI ${dui}? Esta acción no se puede deshacer.`)) return
    setEliminando(id)
    await supabase.storage.from('fotos-dui').remove([`${dui}/frente.jpg`, `${dui}/reverso.jpg`])
    await supabase.from('registros_dui').delete().eq('id', id)
    setRegistros(prev => prev.filter(r => r.id !== id))
    if (modalRegistro?.id === id) setModalRegistro(null)
    setEliminando(null)
  }

  async function cambiarEstado(id: string, estadoActual: string) {
    const nuevoEstado = estadoActual === 'completo' ? 'pendiente' : 'completo'
    setCambiandoEstado(id)
    const { error } = await supabase.from('registros_dui').update({ estado: nuevoEstado, updated_at: new Date().toISOString() }).eq('id', id)
    if (!error) {
      setRegistros(prev => prev.map(r => r.id === id ? { ...r, estado: nuevoEstado } : r))
      if (modalRegistro?.id === id) setModalRegistro(prev => prev ? { ...prev, estado: nuevoEstado } : null)
    }
    setCambiandoEstado(null)
  }

  function validarImagenLocal(file: File): Promise<{ valido: boolean; razon: string }> {
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        if (img.width < 200 || img.height < 100) return resolve({ valido: false, razon: 'La imagen es demasiado pequeña.' })
        const ratio = img.width / img.height
        if (ratio < 0.8 || ratio > 3.5) return resolve({ valido: false, razon: 'La proporción no corresponde a un DUI.' })
        const canvas = document.createElement('canvas')
        const scale = Math.min(400 / img.width, 400 / img.height, 1)
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let brightness = 0
        for (let i = 0; i < pixels.length; i += 4)
          brightness += pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
        const avg = brightness / (pixels.length / 4)
        if (avg < 40) return resolve({ valido: false, razon: 'Imagen muy oscura.' })
        if (avg > 230) return resolve({ valido: false, razon: 'Imagen sobreexpuesta.' })
        resolve({ valido: true, razon: 'Imagen válida' })
      }
      img.onerror = () => resolve({ valido: false, razon: 'No se pudo leer el archivo.' })
      img.src = URL.createObjectURL(file)
    })
  }

  async function handleFotoEdit(file: File, lado: 'frente' | 'reverso') {
    const preview = URL.createObjectURL(file)
    if (lado === 'frente') {
      setFotoFrente(file); setFrentePreview(preview); setFrenteValido(null); setFrenteRazon(''); setValidandoFrente(true)
      const r = await validarImagenLocal(file)
      setFrenteValido(r.valido); setFrenteRazon(r.razon); setValidandoFrente(false)
    } else {
      setFotoReverso(file); setReversoPreview(preview); setReversoValido(null); setReversoRazon(''); setValidandoReverso(true)
      const r = await validarImagenLocal(file)
      setReversoValido(r.valido); setReversoRazon(r.razon); setValidandoReverso(false)
    }
  }

  function abrirEdicion(r: RegistroDUI) {
    setFormEdit({ nombre: r.nombre ?? '', dui: r.dui ?? '', telefono: r.telefono ?? '', correo: r.correo ?? '', direccion: r.direccion ?? '', estado: r.estado ?? 'pendiente' })
    setFotoFrente(null); setFotoReverso(null)
    setFrentePreview(null); setReversoPreview(null)
    setFrenteValido(null); setReversoValido(null)
    setFrenteRazon(''); setReversoRazon('')
    setModoEdicion(true); setErrorEdit('')
  }

  async function guardarEdicion() {
    if (!formEdit.nombre.trim()) { setErrorEdit('El nombre es obligatorio'); return }
    if (!formEdit.dui.trim()) { setErrorEdit('El DUI es obligatorio'); return }
    if (fotoFrente && !frenteValido) { setErrorEdit(`Frente: ${frenteRazon}`); return }
    if (fotoReverso && !reversoValido) { setErrorEdit(`Reverso: ${reversoRazon}`); return }
    setGuardandoEdit(true); setErrorEdit('')
    try {
      const dui = formEdit.dui.trim()
      let frenteUrl = modalRegistro!.foto_frente_url
      let reversoUrl = modalRegistro!.foto_reverso_url
      if (fotoFrente) {
        await supabase.storage.from('fotos-dui').upload(`${dui}/frente.jpg`, fotoFrente, { upsert: true })
        frenteUrl = supabase.storage.from('fotos-dui').getPublicUrl(`${dui}/frente.jpg`).data.publicUrl
      }
      if (fotoReverso) {
        await supabase.storage.from('fotos-dui').upload(`${dui}/reverso.jpg`, fotoReverso, { upsert: true })
        reversoUrl = supabase.storage.from('fotos-dui').getPublicUrl(`${dui}/reverso.jpg`).data.publicUrl
      }
      const { error } = await supabase.from('registros_dui')
        .update({ ...formEdit, foto_frente_url: frenteUrl, foto_reverso_url: reversoUrl, updated_at: new Date().toISOString() })
        .eq('id', modalRegistro!.id)
      if (error) throw error
      const actualizado = { ...modalRegistro!, ...formEdit, foto_frente_url: frenteUrl, foto_reverso_url: reversoUrl }
      setRegistros(prev => prev.map(r => r.id === actualizado.id ? actualizado : r))
      setModalRegistro(actualizado); setModoEdicion(false)
    } catch (err: unknown) { setErrorEdit('Error: ' + (err instanceof Error ? err.message : String(err))) }
    setGuardandoEdit(false)
  }

  function exportarExcel() {
    const filas = registrosFiltrados.map(r => ({
      'DUI':            r.dui,
      'Nombre':         r.nombre,
      'Estado':         r.estado === 'completo' ? 'Completo' : 'Pendiente',
      'Foto Frente':    r.foto_frente_url ? 'Sí' : 'No',
      'Foto Reverso':   r.foto_reverso_url ? 'Sí' : 'No',
      'Tipo':           r.es_nuevo ? 'Manual' : 'Padrón',
      'Teléfono':       r.telefono ?? '',
      'Correo':         r.correo ?? '',
      'Dirección':      r.direccion ?? '',
      'Fecha registro': new Date(r.created_at).toLocaleString('es-SV'),
    }))
    const hoja = XLSX.utils.json_to_sheet(filas)
    // Ancho de columnas
    hoja['!cols'] = [10, 30, 12, 12, 12, 10, 14, 28, 30, 20].map(w => ({ wch: w }))
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Registros DUI')
    XLSX.writeFile(libro, `registros_dui_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const [pagina, setPagina] = useState(1)
  const POR_PAGINA = 20

  const registrosFiltrados = registros.filter(r => {
    const matchBusqueda = r.dui.includes(busqueda) || r.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchEstado = filtroEstado === 'todos' || r.estado === filtroEstado
    return matchBusqueda && matchEstado
  })

  const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const registrosPagina = registrosFiltrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)

  // Reset página al cambiar filtros
  useEffect(() => { setPagina(1) }, [busqueda, filtroEstado])

  const completos = registros.filter(r => r.estado === 'completo').length
  const pendientes = registros.filter(r => r.estado === 'pendiente').length

  return (
    <div className="p-6">

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total registros', value: registros.length, icon: Users, color: 'var(--navy)', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Completos', value: completos, icon: CheckCircle, color: 'var(--verde)', bg: 'var(--verde-light)', border: '#a7f3d0' },
          { label: 'Pendientes', value: pendientes, icon: Clock, color: 'var(--amber)', bg: 'var(--amber-light)', border: '#fde68a' },
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

      {/* Toolbar */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--texto-muted)' }} />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por DUI o nombre..." className="input pl-9" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="input" style={{ width: 'auto' }}>
          <option value="todos">Todos los estados</option>
          <option value="completo">Completos</option>
          <option value="pendiente">Pendientes</option>
        </select>
        <button onClick={cargarRegistros} className="btn btn-ghost"><RefreshCw size={14} /> Actualizar</button>
        <button onClick={exportarExcel} className="btn btn-ghost"><Download size={14} /> Exportar Excel</button>
        <button onClick={normalizarNombres} disabled={normalizando} className="btn btn-ghost" title="Convertir nombres en mayúsculas a formato nombre propio">
          <TextCursorInput size={14} />{normalizando ? 'Normalizando...' : 'Normalizar nombres'}
        </button>
        {resultadoNorm && (
          <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--verde-light)', color: 'var(--verde)', border: '1px solid #a7f3d0' }}>
            ✓ {resultadoNorm}
          </span>
        )}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {cargando ? (
          <div className="p-16 text-center" style={{ color: 'var(--texto-muted)' }}>
            <RefreshCw size={24} className="mx-auto mb-3 animate-spin" style={{ opacity: .4 }} />
            Cargando registros...
          </div>
        ) : registrosFiltrados.length === 0 ? (
          <div className="p-16 text-center" style={{ color: 'var(--texto-muted)' }}>
            <LayoutGrid size={32} className="mx-auto mb-3" style={{ opacity: .25 }} />
            No hay registros
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: 'var(--fondo)', borderBottom: '2px solid var(--borde)' }}>
                {['', 'DUI', 'Nombre', 'Estado', 'Fotos', 'Tipo', 'Fecha', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registrosPagina.map((r, idx) => (
                <tr key={r.id} className="table-row-hover transition-colors"
                  style={{ background: idx % 2 === 0 ? 'var(--superficie)' : '#fafafa', borderBottom: '1px solid var(--borde)' }}>
                  <td className="px-3 py-2"><Avatar nombre={r.nombre} /></td>
                  <td className="px-4 py-3 font-mono text-xs font-medium" style={{ color: 'var(--texto-2)' }}>{r.dui}</td>
                  <td className="px-4 py-3 font-medium">{r.nombre}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => cambiarEstado(r.id, r.estado)} disabled={cambiandoEstado === r.id}
                      title="Clic para cambiar estado"
                      className={`badge cursor-pointer hover:opacity-80 transition-opacity ${r.estado === 'completo' ? 'badge-green' : 'badge-amber'}`}>
                      {cambiandoEstado === r.id ? '...' : r.estado === 'completo' ? '✓ Completo' : '⏳ Pendiente'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {r.foto_frente_url ? <a href={r.foto_frente_url} target="_blank" className="badge badge-green">F ✓</a> : <span className="badge" style={{ background: 'var(--fondo)', color: 'var(--texto-muted)' }}>F —</span>}
                      {r.foto_reverso_url ? <a href={r.foto_reverso_url} target="_blank" className="badge badge-green">R ✓</a> : <span className="badge" style={{ background: 'var(--fondo)', color: 'var(--texto-muted)' }}>R —</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${r.es_nuevo ? 'badge-amber' : 'badge-blue'}`}>{r.es_nuevo ? 'Manual' : 'Padrón'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--texto-muted)' }}>{new Date(r.created_at).toLocaleDateString('es-SV')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setModalRegistro(r)} className="btn btn-ghost btn-sm"><Eye size={12} /> Ver</button>
                      <button onClick={() => eliminarRegistro(r.id, r.dui)} disabled={eliminando === r.id} className="btn btn-danger btn-sm">
                        <Trash2 size={12} />{eliminando === r.id ? '...' : ''}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* Paginador */}
        {registrosFiltrados.length > POR_PAGINA && (
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--borde)', background: 'var(--fondo)' }}>
            <span className="text-xs" style={{ color: 'var(--texto-muted)' }}>
              {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, registrosFiltrados.length)} de {registrosFiltrados.length}
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

      {/* Modal */}
      {modalRegistro && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => { setModalRegistro(null); setModoEdicion(false) }}>
          <div className="card w-full max-w-lg overflow-hidden" style={{ boxShadow: 'var(--sombra-lg)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--borde)', background: 'var(--fondo)' }}>
              <div>
                <div className="font-semibold">{modoEdicion ? 'Editar registro' : modalRegistro.nombre}</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--texto-muted)' }}>{modalRegistro.dui}</div>
              </div>
              <div className="flex items-center gap-2">
                {!modoEdicion && <button onClick={() => abrirEdicion(modalRegistro)} className="btn btn-ghost btn-sm"><Pencil size={12} /> Editar</button>}
                <button onClick={() => { setModalRegistro(null); setModoEdicion(false) }} className="btn btn-ghost btn-sm w-8 h-8 p-0 justify-center">✕</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* Vista */}
              {!modoEdicion && (
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    {[
                      ['Nombre', modalRegistro.nombre], ['DUI', modalRegistro.dui],
                      ['Teléfono', modalRegistro.telefono ?? '—'], ['Correo', modalRegistro.correo ?? '—'],
                      ['Dirección', modalRegistro.direccion ?? '—'], ['Estado', modalRegistro.estado],
                      ['Tipo', modalRegistro.es_nuevo ? 'Manual' : 'Padrón'],
                      ['Fecha creación', new Date(modalRegistro.created_at).toLocaleString('es-SV')],
                    ].map(([label, value]) => (
                      <div key={label} className={label === 'Dirección' || label === 'Correo' ? 'col-span-2' : ''}>
                        <div className="field-label">{label}</div>
                        <div className="text-sm font-medium">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    {[{ label: 'Frente del DUI', url: modalRegistro.foto_frente_url }, { label: 'Reverso del DUI', url: modalRegistro.foto_reverso_url }].map(({ label, url }) => (
                      <div key={label}>
                        <div className="field-label mb-2">{label}</div>
                        {url ? <a href={url} target="_blank"><img src={url} alt={label} className="w-full rounded-lg object-cover" style={{ border: '1px solid var(--borde)', maxHeight: 120 }} /></a>
                          : <div className="rounded-lg flex items-center justify-center text-xs" style={{ height: 80, background: 'var(--fondo)', border: '1px dashed var(--borde)', color: 'var(--texto-muted)' }}>Sin imagen</div>}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => cambiarEstado(modalRegistro.id, modalRegistro.estado)} disabled={cambiandoEstado === modalRegistro.id}
                      className={`btn flex-1 justify-center ${modalRegistro.estado === 'completo' ? 'btn-ghost' : 'btn-success'}`}>
                      {cambiandoEstado === modalRegistro.id ? 'Cambiando...' : modalRegistro.estado === 'completo' ? 'Marcar pendiente' : 'Marcar completo'}
                    </button>
                    <button onClick={() => eliminarRegistro(modalRegistro.id, modalRegistro.dui)} disabled={eliminando === modalRegistro.id} className="btn btn-danger justify-center">
                      <Trash2 size={14} />{eliminando === modalRegistro.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Edición */}
              {modoEdicion && (
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {[
                      { key: 'nombre', label: 'Nombre completo', full: true, type: 'text' },
                      { key: 'dui', label: 'DUI', full: false, type: 'text' },
                      { key: 'telefono', label: 'Teléfono', full: false, type: 'tel' },
                      { key: 'correo', label: 'Correo electrónico', full: true, type: 'email' },
                      { key: 'direccion', label: 'Dirección', full: true, type: 'text' },
                    ].map(({ key, label, full, type }) => (
                      <div key={key} className={full ? 'col-span-2' : ''}>
                        <label className="field-label">{label}</label>
                        <input type={type} value={formEdit[key as keyof typeof formEdit]}
                          onChange={e => setFormEdit(p => ({ ...p, [key]: key === 'nombre' ? toNombrePropio(e.target.value) : e.target.value }))} className="input" />
                      </div>
                    ))}
                    <div>
                      <label className="field-label">Estado</label>
                      <select value={formEdit.estado} onChange={e => setFormEdit(p => ({ ...p, estado: e.target.value }))} className="input">
                        <option value="completo">Completo</option>
                        <option value="pendiente">Pendiente</option>
                      </select>
                    </div>
                  </div>

                  {/* Fotos */}
                  <div className="mb-4">
                    <div className="field-label mb-3 flex items-center gap-1.5">
                      <FileImage size={10} /> Fotografías del DUI
                      <span className="font-normal" style={{ color: 'var(--texto-muted)' }}>— Cargue nuevas solo si desea actualizarlas</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {(['frente', 'reverso'] as const).map(lado => {
                        const preview   = lado === 'frente' ? frentePreview  : reversoPreview
                        const valido    = lado === 'frente' ? frenteValido   : reversoValido
                        const razon     = lado === 'frente' ? frenteRazon    : reversoRazon
                        const validando = lado === 'frente' ? validandoFrente: validandoReverso
                        const fotoActual= lado === 'frente' ? modalRegistro!.foto_frente_url : modalRegistro!.foto_reverso_url
                        const border    = valido === true ? 'var(--verde)' : valido === false ? 'var(--rojo)' : validando ? 'var(--amber)' : 'var(--borde)'
                        const bg        = valido === true ? 'var(--verde-light)' : valido === false ? 'var(--rojo-light)' : validando ? 'var(--amber-light)' : 'var(--fondo)'
                        return (
                          <div key={lado}>
                            <div className="field-label mb-1.5">{lado === 'frente' ? 'Frente' : 'Reverso'}</div>
                            <label className="block rounded-lg cursor-pointer overflow-hidden"
                              style={{ border: `2px ${preview ? 'solid' : 'dashed'} ${border}`, background: bg, minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {preview ? <img src={preview} alt={lado} className="w-full object-cover" style={{ maxHeight: 120 }} />
                                : fotoActual ? <img src={fotoActual} alt={lado} className="w-full object-cover opacity-40" style={{ maxHeight: 120 }} />
                                : <div className="text-center p-3"><FileImage size={22} style={{ color: 'var(--texto-muted)', margin: '0 auto 4px' }} /><div className="text-xs" style={{ color: 'var(--texto-muted)' }}>Clic para cargar</div></div>}
                              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFotoEdit(e.target.files[0], lado)} />
                            </label>
                            <div className="flex gap-1.5 mt-1.5">
                              <label className="btn btn-ghost btn-sm flex-1 justify-center cursor-pointer" style={{ fontSize: 11 }}>
                                <Upload size={10} /> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFotoEdit(e.target.files[0], lado)} />
                              </label>
                              <label className="btn btn-sm flex-1 justify-center cursor-pointer" style={{ background: 'var(--azul-light)', color: 'var(--azul)', border: '1px solid #bfdbfe', fontSize: 11 }}>
                                <Camera size={10} /> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleFotoEdit(e.target.files[0], lado)} />
                              </label>
                            </div>
                            <div className="text-xs mt-1" style={{ minHeight: 16 }}>
                              {validando && <span style={{ color: 'var(--amber)' }}>Validando...</span>}
                              {valido === true && (
                                <div className="flex items-center justify-between">
                                  <span style={{ color: 'var(--verde)' }}>✓ Imagen válida</span>
                                  <button onClick={() => preview && setEditorFoto({ src: preview, lado })} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                                    <Sliders size={10} /> Editar
                                  </button>
                                </div>
                              )}
                              {!preview && !validando && fotoActual && (
                                <button onClick={() => setEditorFoto({ src: fotoActual, lado })} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                                  <Sliders size={10} /> Editar imagen actual
                                </button>
                              )}
                              {valido === false && (
                                <div className="rounded p-2 mt-1" style={{ background: 'var(--rojo-light)', border: '1px solid #fecaca' }}>
                                  <p style={{ color: 'var(--rojo)' }}><AlertTriangle size={10} className="inline mr-1" />{razon}</p>
                                  <label className="btn btn-sm cursor-pointer mt-1" style={{ background: 'white', border: '1px solid #fecaca', color: 'var(--rojo)', fontSize: 10, display: 'inline-flex' }}>
                                    <Upload size={9} /> Cargar otra
                                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFotoEdit(e.target.files[0], lado)} />
                                  </label>
                                </div>
                              )}
                              {!preview && !validando && !fotoActual && <span style={{ color: 'var(--texto-muted)' }}>Sin imagen</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {errorEdit && <p className="text-xs mb-3" style={{ color: 'var(--rojo)' }}>{errorEdit}</p>}
                  <div className="flex gap-3">
                    <button onClick={() => { setModoEdicion(false); setErrorEdit('') }} className="btn btn-ghost flex-1 justify-center"><X size={14} /> Cancelar</button>
                    <button onClick={guardarEdicion} disabled={guardandoEdit} className="btn btn-primary flex-1 justify-center">
                      <Save size={14} />{guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editorFoto && (
        <ImageEditor src={editorFoto.src} nombre={editorFoto.lado}
          onAplicar={async file => { setEditorFoto(null); await handleFotoEdit(file, editorFoto.lado) }}
          onCancelar={() => setEditorFoto(null)} />
      )}
    </div>
  )
}
