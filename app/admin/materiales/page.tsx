'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Upload, Trash2, Download, Search, RefreshCw, FileText, FileImage,
  Video, File, Music, Eye, X, Plus, Tag, FolderOpen
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Material {
  id: string
  nombre: string
  descripcion: string | null
  categoria: string
  archivo_url: string
  tipo_mime: string
  tamanio: number | null
  created_at: string
}

const CATEGORIAS = ['General', 'Normativa', 'Procedimientos', 'Formularios', 'Presentaciones', 'Videos', 'Imágenes', 'Otro']

const TIPOS_ACEPTADOS = [
  'image/*', 'video/*', 'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
].join(',')

function iconoTipo(mime: string) {
  if (mime.startsWith('image/'))    return <FileImage size={20} style={{ color: '#8b5cf6' }} />
  if (mime.startsWith('video/'))    return <Video      size={20} style={{ color: '#ef4444' }} />
  if (mime.startsWith('audio/'))    return <Music      size={20} style={{ color: '#f59e0b' }} />
  if (mime.includes('pdf'))         return <FileText   size={20} style={{ color: '#ef4444' }} />
  if (mime.includes('word'))        return <FileText   size={20} style={{ color: '#2563eb' }} />
  if (mime.includes('excel') || mime.includes('sheet')) return <FileText size={20} style={{ color: '#16a34a' }} />
  if (mime.includes('powerpoint') || mime.includes('presentation')) return <FileText size={20} style={{ color: '#ea580c' }} />
  return <File size={20} style={{ color: 'var(--texto-muted)' }} />
}

function etiquetaTipo(mime: string) {
  if (mime.startsWith('image/'))    return 'Imagen'
  if (mime.startsWith('video/'))    return 'Video'
  if (mime.startsWith('audio/'))    return 'Audio'
  if (mime.includes('pdf'))         return 'PDF'
  if (mime.includes('word'))        return 'Word'
  if (mime.includes('excel') || mime.includes('sheet')) return 'Excel'
  if (mime.includes('powerpoint') || mime.includes('presentation')) return 'PowerPoint'
  if (mime.includes('text'))        return 'Texto'
  return 'Archivo'
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function extDesdeMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
    'video/mp4': '.mp4', 'video/webm': '.webm',
    'audio/mpeg': '.mp3', 'audio/ogg': '.ogg',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt', 'text/csv': '.csv',
  }
  return map[mime] ?? ''
}

async function descargarMaterial(url: string, nombre: string, mime: string) {
  try {
    // Extraer extensión de la URL (más confiable que el mime)
    const urlPath = url.split('?')[0]
    const extUrl = urlPath.includes('.') ? '.' + urlPath.split('.').pop()!.toLowerCase() : extDesdeMime(mime)
    const nombreFinal = nombre.match(/\.[a-zA-Z0-9]+$/) ? nombre : nombre + extUrl

    const resp = await fetch(url)
    const blob = await resp.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl; a.download = nombreFinal; a.click()
    setTimeout(() => URL.revokeObjectURL(objUrl), 10000)
  } catch {
    window.open(url, '_blank')
  }
}

export default function MaterialesPage() {
  const [materiales, setMateriales] = useState<Material[]>([])
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  const [modalSubir, setModalSubir] = useState(false)
  const [previsualizando, setPrevisualizando] = useState<Material | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)

  // Form subida
  const [archivos, setArchivos] = useState<File[]>([])
  const [formNombre, setFormNombre] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formCategoria, setFormCategoria] = useState('General')
  const [subiendo, setSubiendo] = useState(false)
  const [progresoSubida, setProgresoSubida] = useState(0)
  const [errorSubida, setErrorSubida] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('materiales').select('*').order('created_at', { ascending: false })
    if (data) setMateriales(data)
    setCargando(false)
  }

  function abrirModal() {
    setArchivos([]); setFormNombre(''); setFormDesc(''); setFormCategoria('General'); setErrorSubida('')
    setModalSubir(true)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const nuevos = Array.from(e.dataTransfer.files)
    setArchivos(prev => [...prev, ...nuevos])
    if (nuevos.length === 1 && !formNombre) setFormNombre(nuevos[0].name.replace(/\.[^/.]+$/, ''))
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevos = Array.from(e.target.files ?? [])
    setArchivos(prev => [...prev, ...nuevos])
    if (nuevos.length === 1 && !formNombre) setFormNombre(nuevos[0].name.replace(/\.[^/.]+$/, ''))
  }

  async function subirArchivos() {
    if (archivos.length === 0) { setErrorSubida('Seleccione al menos un archivo'); return }
    if (!formNombre.trim() && archivos.length === 1) { setErrorSubida('Ingrese un nombre para el material'); return }
    setSubiendo(true); setErrorSubida(''); setProgresoSubida(0)

    for (let i = 0; i < archivos.length; i++) {
      const file = archivos[i]
      const nombre = archivos.length === 1 ? formNombre.trim() : file.name.replace(/\.[^/.]+$/, '')
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

      const { error: storageErr } = await supabase.storage.from('materiales-capacitacion').upload(path, file)
      if (storageErr) { setErrorSubida(`Error subiendo ${file.name}: ${storageErr.message}`); continue }

      const { data: urlData } = supabase.storage.from('materiales-capacitacion').getPublicUrl(path)

      await supabase.from('materiales').insert({
        nombre,
        descripcion: formDesc.trim() || null,
        categoria: formCategoria,
        archivo_url: urlData.publicUrl,
        tipo_mime: file.type || 'application/octet-stream',
        tamanio: file.size,
      })

      setProgresoSubida(Math.round(((i + 1) / archivos.length) * 100))
    }

    await cargar()
    setSubiendo(false); setModalSubir(false)
  }

  async function eliminar(m: Material) {
    if (!confirm(`¿Eliminar "${m.nombre}"? Esta acción no se puede deshacer.`)) return
    setEliminando(m.id)
    // Extraer path del storage desde la URL
    const path = m.archivo_url.split('/materiales-capacitacion/')[1]
    if (path) await supabase.storage.from('materiales-capacitacion').remove([path])
    await supabase.from('materiales').delete().eq('id', m.id)
    setMateriales(prev => prev.filter(x => x.id !== m.id))
    setEliminando(null)
  }

  const filtrados = materiales.filter(m => {
    const matchBusqueda = !busqueda || m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (m.descripcion ?? '').toLowerCase().includes(busqueda.toLowerCase())
    const matchCategoria = filtroCategoria === 'Todas' || m.categoria === filtroCategoria
    return matchBusqueda && matchCategoria
  })

  const categoriasCon = ['Todas', ...CATEGORIAS.filter(c => materiales.some(m => m.categoria === c))]

  return (
    <div className="p-4 md:p-6">

      {/* Header con acciones */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold text-base">Material de Capacitación</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>
            {materiales.length} archivo{materiales.length !== 1 ? 's' : ''} · Imágenes, videos, documentos y más
          </p>
        </div>
        <button onClick={abrirModal} className="btn btn-primary">
          <Plus size={15} /> Subir material
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--texto-muted)' }} />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o descripción..." className="input pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categoriasCon.map(c => (
            <button key={c} onClick={() => setFiltroCategoria(c)}
              className="btn btn-sm"
              style={{
                background: filtroCategoria === c ? 'var(--navy)' : 'var(--superficie)',
                color: filtroCategoria === c ? 'white' : 'var(--texto-muted)',
                border: `1.5px solid ${filtroCategoria === c ? 'var(--navy)' : 'var(--borde)'}`,
              }}>
              {c}
            </button>
          ))}
        </div>
        <button onClick={cargar} className="btn btn-ghost btn-sm"><RefreshCw size={13} /></button>
      </div>

      {/* Grid de materiales */}
      {cargando ? (
        <div className="card p-16 text-center" style={{ color: 'var(--texto-muted)' }}>
          <RefreshCw size={22} className="mx-auto mb-3 animate-spin" style={{ opacity: .4 }} />
          Cargando materiales...
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card p-16 text-center" style={{ color: 'var(--texto-muted)' }}>
          <FolderOpen size={36} className="mx-auto mb-3" style={{ opacity: .25 }} />
          <p className="font-medium">No hay materiales</p>
          <p className="text-xs mt-1">Suba el primer archivo con el botón "Subir material"</p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {filtrados.map(m => (
            <div key={m.id} className="card overflow-hidden flex flex-col" style={{ transition: 'box-shadow .15s' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--sombra-md)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--sombra)')}>

              {/* Preview para imágenes/videos */}
              {m.tipo_mime.startsWith('image/') && (
                <div className="overflow-hidden flex-shrink-0" style={{ height: 140, background: 'var(--fondo)' }}>
                  <img src={m.archivo_url} alt={m.nombre} className="w-full h-full object-cover" />
                </div>
              )}
              {m.tipo_mime.startsWith('video/') && (
                <div className="overflow-hidden flex-shrink-0 relative" style={{ height: 140, background: '#000' }}>
                  <video src={m.archivo_url} className="w-full h-full object-cover opacity-70" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,.2)' }}>
                      <Video size={18} color="white" />
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-start gap-3 mb-2">
                  <div className="flex-shrink-0 mt-0.5">{iconoTipo(m.tipo_mime)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{m.nombre}</div>
                    {m.descripcion && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--texto-muted)' }}>{m.descripcion}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="badge badge-blue" style={{ fontSize: 10 }}>{etiquetaTipo(m.tipo_mime)}</span>
                  <span className="badge" style={{ background: 'var(--fondo)', color: 'var(--texto-muted)', fontSize: 10 }}>
                    <Tag size={9} className="inline mr-1" />{m.categoria}
                  </span>
                  <span className="text-xs ml-auto" style={{ color: 'var(--texto-muted)' }}>{formatBytes(m.tamanio)}</span>
                </div>

                <div className="flex gap-2 mt-auto">
                  {(m.tipo_mime.startsWith('image/') || m.tipo_mime.startsWith('video/') || m.tipo_mime.includes('pdf')) && (
                    <button onClick={() => setPrevisualizando(m)} className="btn btn-ghost btn-sm flex-1 justify-center">
                      <Eye size={12} /> Ver
                    </button>
                  )}
                  <button onClick={() => descargarMaterial(m.archivo_url, m.nombre, m.tipo_mime)} className="btn btn-ghost btn-sm flex-1 justify-center">
                    <Download size={12} /> Descargar
                  </button>
                  <button onClick={() => eliminar(m)} disabled={eliminando === m.id}
                    className="btn btn-danger btn-sm">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal subir */}
      {modalSubir && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => !subiendo && setModalSubir(false)}>
          <div className="card w-full max-w-lg overflow-hidden" style={{ boxShadow: 'var(--sombra-lg)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--borde)', background: 'var(--fondo)' }}>
              <div className="font-semibold flex items-center gap-2"><Upload size={15} /> Subir material</div>
              {!subiendo && <button onClick={() => setModalSubir(false)} className="btn btn-ghost btn-sm w-8 h-8 p-0 justify-center"><X size={14} /></button>}
            </div>

            <div className="p-6 space-y-4">
              {/* Zona drop */}
              <div ref={dropRef}
                onDrop={onDrop} onDragOver={e => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className="rounded-xl cursor-pointer transition-colors text-center p-8"
                style={{ border: '2px dashed var(--borde)', background: archivos.length ? 'var(--verde-light)' : 'var(--fondo)' }}>
                {archivos.length === 0 ? (
                  <>
                    <Upload size={28} className="mx-auto mb-2" style={{ color: 'var(--texto-muted)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--texto-muted)' }}>Arrastre archivos aquí o haga clic para seleccionar</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--texto-muted)' }}>PDF, Word, Excel, PPT, imágenes, videos, audio y más</p>
                  </>
                ) : (
                  <div className="space-y-1">
                    {archivos.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {iconoTipo(f.type)}
                        <span className="truncate flex-1 text-left">{f.name}</span>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--texto-muted)' }}>{formatBytes(f.size)}</span>
                        <button onClick={e => { e.stopPropagation(); setArchivos(prev => prev.filter((_, j) => j !== i)) }}
                          className="flex-shrink-0" style={{ color: 'var(--rojo)' }}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs mt-2" style={{ color: 'var(--texto-muted)' }}>Clic para agregar más archivos</p>
                  </div>
                )}
                <input ref={inputRef} type="file" multiple accept={TIPOS_ACEPTADOS} className="hidden" onChange={onFileChange} />
              </div>

              {/* Nombre (solo si es 1 archivo) */}
              {archivos.length <= 1 && (
                <div>
                  <label className="field-label">Nombre del material</label>
                  <input type="text" value={formNombre} onChange={e => setFormNombre(e.target.value)}
                    placeholder="Nombre descriptivo" className="input" />
                </div>
              )}

              {/* Descripción */}
              <div>
                <label className="field-label">Descripción <span style={{ color: 'var(--texto-muted)', fontWeight: 400 }}>(opcional)</span></label>
                <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)}
                  placeholder="Breve descripción del contenido..." rows={2}
                  className="input resize-none" style={{ lineHeight: 1.5 }} />
              </div>

              {/* Categoría */}
              <div>
                <label className="field-label">Categoría</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIAS.map(c => (
                    <button key={c} onClick={() => setFormCategoria(c)}
                      className="btn btn-sm"
                      style={{
                        background: formCategoria === c ? 'var(--navy)' : 'var(--fondo)',
                        color: formCategoria === c ? 'white' : 'var(--texto-muted)',
                        border: `1.5px solid ${formCategoria === c ? 'var(--navy)' : 'var(--borde)'}`,
                      }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progreso */}
              {subiendo && (
                <div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--texto-muted)' }}>
                    <span>Subiendo archivos...</span><span>{progresoSubida}%</span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'var(--fondo)', border: '1px solid var(--borde)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${progresoSubida}%`, background: 'var(--navy)' }} />
                  </div>
                </div>
              )}

              {errorSubida && <p className="text-xs" style={{ color: 'var(--rojo)' }}>{errorSubida}</p>}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setModalSubir(false)} disabled={subiendo} className="btn btn-ghost flex-1 justify-center">Cancelar</button>
              <button onClick={subirArchivos} disabled={subiendo || archivos.length === 0} className="btn btn-primary flex-1 justify-center">
                <Upload size={14} />{subiendo ? 'Subiendo...' : `Subir ${archivos.length > 1 ? `(${archivos.length})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal previsualización */}
      {previsualizando && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(0,0,0,.85)' }} onClick={() => setPrevisualizando(null)}>
          <div className="relative w-full max-w-4xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPrevisualizando(null)}
              className="absolute -top-10 right-0 btn btn-sm" style={{ background: 'rgba(255,255,255,.1)', color: 'white', border: '1px solid rgba(255,255,255,.2)' }}>
              <X size={14} /> Cerrar
            </button>
            <div className="text-white text-sm font-medium mb-3 text-center">{previsualizando.nombre}</div>
            {previsualizando.tipo_mime.startsWith('image/') && (
              <img src={previsualizando.archivo_url} alt={previsualizando.nombre}
                className="max-w-full max-h-screen object-contain rounded-xl mx-auto block" />
            )}
            {previsualizando.tipo_mime.startsWith('video/') && (
              <video src={previsualizando.archivo_url} controls autoPlay
                className="w-full rounded-xl" style={{ maxHeight: '80vh' }} />
            )}
            {previsualizando.tipo_mime.includes('pdf') && (
              <iframe src={previsualizando.archivo_url} className="w-full rounded-xl" style={{ height: '80vh', border: 'none' }} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
