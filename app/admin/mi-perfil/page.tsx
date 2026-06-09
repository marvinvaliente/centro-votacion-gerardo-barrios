'use client'

import { useState, useEffect } from 'react'
import { User, Pencil, Save, X, Camera, AlertTriangle, RefreshCw, Upload, FileImage } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { RegistroDUI, Padron } from '@/types'

interface UsuarioAdmin {
  id: string
  nombre: string
  dui: string
  email: string | null
  telefono: string | null
  rol: string
  foto_perfil_url: string | null
}

function toNombrePropio(s: string) {
  return s.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '').join(' ')
}

function formatDUI(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 9)
  return d.length > 8 ? d.slice(0, 8) + '-' + d.slice(8) : d
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
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let b = 0; for (let i = 0; i < pixels.length; i += 4) b += pixels[i] * .299 + pixels[i+1] * .587 + pixels[i+2] * .114
      const avg = b / (pixels.length / 4)
      if (avg < 40) return resolve({ valido: false, razon: 'La imagen está muy oscura.' })
      if (avg > 230) return resolve({ valido: false, razon: 'La imagen está sobreexpuesta.' })
      resolve({ valido: true, razon: 'Imagen válida' })
    }
    img.onerror = () => resolve({ valido: false, razon: 'No se pudo leer el archivo.' })
    img.src = URL.createObjectURL(file)
  })
}

export default function MiPerfilAdminPage() {
  const [usuario, setUsuario]         = useState<UsuarioAdmin | null>(null)
  const [registro, setRegistro]       = useState<RegistroDUI | null>(null)
  const [padronInfo, setPadronInfo]   = useState<Padron | null>(null)
  const [cargando, setCargando]       = useState(true)
  const [error, setError]             = useState('')
  const [sinSesion, setSinSesion]     = useState(false)
  const [duiInput, setDuiInput]       = useState('')

  const [editando, setEditando]       = useState(false)
  const [formPerfil, setFormPerfil]   = useState({ nombre: '', telefono: '', correo: '', direccion: '' })
  const [guardando, setGuardando]     = useState(false)
  const [errorPerfil, setErrorPerfil] = useState('')

  // Foto de perfil
  const [subiendoFotoPerfil, setSubiendoFotoPerfil] = useState(false)
  const [errorFotoPerfil, setErrorFotoPerfil]       = useState('')

  // Fotos DUI
  const [fotoFrente, setFotoFrente]     = useState<File | null>(null)
  const [fotoReverso, setFotoReverso]   = useState<File | null>(null)
  const [frentePrev, setFrentePrev]     = useState<string | null>(null)
  const [reversoPrev, setReversoPrev]   = useState<string | null>(null)
  const [frenteValido, setFrenteValido] = useState<boolean | null>(null)
  const [reversoValido, setReversoValido] = useState<boolean | null>(null)
  const [validandoF, setValidandoF]     = useState(false)
  const [validandoR, setValidandoR]     = useState(false)

  useEffect(() => {
    const dui = sessionStorage.getItem('admin_dui')
    if (!dui) { setSinSesion(true); setCargando(false); return }
    cargar(dui)
  }, [])

  async function cargar(dui: string) {
    setCargando(true); setError('')
    const [{ data: usr }, { data: reg }] = await Promise.all([
      supabase.from('usuarios').select('id,nombre,dui,email,telefono,rol,foto_perfil_url').eq('dui', dui).maybeSingle(),
      supabase.from('registros_dui').select('*, padron(*)').eq('dui', dui).maybeSingle(),
    ])
    // Construir perfil desde usuarios o, como fallback, desde registros_dui
    if (!usr && !reg) {
      setError('No se encontró información para este DUI. Verifique que esté registrado en el portal.')
      setCargando(false); return
    }
    const nombre = usr?.nombre ?? (reg as any)?.nombre ?? dui

    // Si no existe en usuarios, crearlo automáticamente para poder subir foto de perfil
    let usuarioFinal = usr
    if (!usr) {
      const { data: nuevo } = await supabase.from('usuarios').upsert({
        dui,
        nombre,
        email: (reg as any)?.correo ?? null,
        telefono: (reg as any)?.telefono ?? null,
        rol: 'administrador',
        activo: true,
        autorizado: true,
      }, { onConflict: 'dui' }).select('id,nombre,dui,email,telefono,rol,foto_perfil_url').maybeSingle()
      usuarioFinal = nuevo
    }

    setUsuario(usuarioFinal ?? {
      id: '', nombre, dui,
      email: (reg as any)?.correo ?? null,
      telefono: (reg as any)?.telefono ?? null,
      rol: 'administrador',
      foto_perfil_url: null,
    })
    const regData = reg as (RegistroDUI & { padron?: Padron | Padron[] }) | null
    setFormPerfil({
      nombre,
      telefono: usr?.telefono ?? regData?.telefono ?? '',
      correo: usr?.email ?? regData?.correo ?? '',
      direccion: regData?.direccion ?? '',
    })
    if (regData) {
      setRegistro(regData)
      const pad = Array.isArray(regData.padron) ? regData.padron[0] : regData.padron
      if (pad) setPadronInfo(pad)
    }
    setCargando(false)
  }

  async function buscarPorDUI() {
    if (duiInput.replace(/\D/g, '').length < 9) return
    const duiFmt = duiInput.replace(/\D/g, '').slice(0, 8) + '-' + duiInput.replace(/\D/g, '').slice(8, 9)
    sessionStorage.setItem('admin_dui', duiFmt)
    setSinSesion(false)
    cargar(duiFmt)
  }

  async function handleFoto(file: File, lado: 'frente' | 'reverso') {
    const prev = URL.createObjectURL(file)
    if (lado === 'frente') {
      setFotoFrente(file); setFrentePrev(prev); setFrenteValido(null); setValidandoF(true)
      const r = await validarImagenLocal(file); setFrenteValido(r.valido); setValidandoF(false)
    } else {
      setFotoReverso(file); setReversoPrev(prev); setReversoValido(null); setValidandoR(true)
      const r = await validarImagenLocal(file); setReversoValido(r.valido); setValidandoR(false)
    }
  }

  async function guardarPerfil() {
    if (!formPerfil.nombre.trim()) { setErrorPerfil('El nombre es obligatorio'); return }
    if (!usuario?.foto_perfil_url) { setErrorPerfil('Debe subir una foto de perfil antes de guardar.'); return }
    setGuardando(true); setErrorPerfil('')
    const dui = usuario!.dui
    try {
      let frenteUrl = registro?.foto_frente_url ?? null
      let reversoUrl = registro?.foto_reverso_url ?? null
      if (fotoFrente && frenteValido) {
        await supabase.storage.from('fotos-dui').upload(`${dui}/frente.jpg`, fotoFrente, { upsert: true })
        frenteUrl = supabase.storage.from('fotos-dui').getPublicUrl(`${dui}/frente.jpg`).data.publicUrl
      }
      if (fotoReverso && reversoValido) {
        await supabase.storage.from('fotos-dui').upload(`${dui}/reverso.jpg`, fotoReverso, { upsert: true })
        reversoUrl = supabase.storage.from('fotos-dui').getPublicUrl(`${dui}/reverso.jpg`).data.publicUrl
      }
      // Solo actualizar usuarios si tiene id real
      if (usuario!.id) {
        await supabase.from('usuarios').update({
          nombre: formPerfil.nombre.trim(), email: formPerfil.correo.trim() || null,
          telefono: formPerfil.telefono.trim() || null, updated_at: new Date().toISOString()
        }).eq('id', usuario!.id)
      }
      await supabase.from('registros_dui').upsert({
        dui, nombre: formPerfil.nombre.trim(), telefono: formPerfil.telefono.trim() || null,
        correo: formPerfil.correo.trim() || null, direccion: formPerfil.direccion.trim() || null,
        foto_frente_url: frenteUrl, foto_reverso_url: reversoUrl,
        updated_at: new Date().toISOString()
      }, { onConflict: 'dui' })
      setUsuario(prev => prev ? { ...prev, nombre: formPerfil.nombre.trim() } : prev)
      setRegistro(prev => prev ? { ...prev, ...formPerfil, foto_frente_url: frenteUrl, foto_reverso_url: reversoUrl } : null)
      setEditando(false)
    } catch (err: unknown) { setErrorPerfil('Error: ' + (err instanceof Error ? err.message : String(err))) }
    setGuardando(false)
  }

  async function subirFotoPerfil(file: File) {
    if (!usuario?.id) { setErrorFotoPerfil('Complete su perfil antes de subir foto.'); return }
    setSubiendoFotoPerfil(true); setErrorFotoPerfil('')
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `perfiles/${usuario!.id}.${ext}`
    const { error: storErr } = await supabase.storage.from('fotos-dui').upload(path, file, { upsert: true })
    if (storErr) { setErrorFotoPerfil('No se pudo subir la foto. Intente con otra imagen.'); setSubiendoFotoPerfil(false); return }
    const url = supabase.storage.from('fotos-dui').getPublicUrl(path).data.publicUrl + `?t=${Date.now()}`
    const { error: dbErr } = await supabase.from('usuarios').update({ foto_perfil_url: url, updated_at: new Date().toISOString() }).eq('id', usuario!.id)
    if (dbErr) { setErrorFotoPerfil('Foto subida pero no se pudo guardar. Intente de nuevo.'); setSubiendoFotoPerfil(false); return }
    setUsuario(prev => prev ? { ...prev, foto_perfil_url: url } : prev)
    setSubiendoFotoPerfil(false)
  }

  if (cargando) return (
    <div className="p-6 flex items-center justify-center min-h-64" style={{ color: 'var(--texto-muted)' }}>
      <RefreshCw size={20} className="animate-spin mr-2" style={{ opacity: .4 }} /> Cargando...
    </div>
  )

  if (sinSesion) return (
    <div className="p-4 md:p-6 max-w-sm">
      <div className="card p-8">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'var(--fondo)', border: '1px solid var(--borde)' }}>
          <User size={22} style={{ color: 'var(--texto-muted)' }} />
        </div>
        <h2 className="font-bold text-center mb-1">Identificarse</h2>
        <p className="text-xs text-center mb-5" style={{ color: 'var(--texto-muted)' }}>Ingrese su DUI para ver su perfil</p>
        <label className="field-label">Número de DUI</label>
        <input type="text" value={duiInput} onChange={e => setDuiInput(formatDUI(e.target.value))}
          onKeyDown={e => e.key === 'Enter' && buscarPorDUI()}
          placeholder="00000000-0" maxLength={10}
          className="input w-full text-center font-mono text-lg font-semibold mb-4" />
        <button onClick={buscarPorDUI} disabled={duiInput.replace(/\D/g, '').length < 9}
          className="btn btn-primary w-full justify-center py-2.5 disabled:opacity-40">
          Continuar
        </button>
      </div>
    </div>
  )

  if (error) return (
    <div className="p-4 md:p-6 max-w-sm">
      <div className="card p-8 text-center" style={{ color: 'var(--texto-muted)' }}>
        <User size={36} className="mx-auto mb-3" style={{ opacity: .25 }} />
        <p className="text-sm mb-4">{error}</p>
        <button onClick={() => { setError(''); setSinSesion(true); sessionStorage.removeItem('admin_dui') }}
          className="btn btn-ghost btn-sm">Intentar con otro DUI</button>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-5">
      <div className="card overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, var(--navy-dark), var(--navy))', borderBottom: '3px solid var(--gold)' }}>
          <div className="flex items-center gap-3">
            <label className="relative cursor-pointer group flex-shrink-0" title="Cambiar foto de perfil">
              <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center font-bold text-lg"
                style={{ background: 'rgba(200,168,75,.2)', color: 'var(--gold)', border: '2px solid rgba(200,168,75,.4)' }}>
                {usuario!.foto_perfil_url
                  ? <img src={usuario!.foto_perfil_url} alt="perfil" className="w-full h-full object-cover" />
                  : usuario!.nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
                }
              </div>
              <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,.5)' }}>
                {subiendoFotoPerfil
                  ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera size={16} color="white" />}
              </div>
              <input type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) subirFotoPerfil(f) }} />
            </label>
            <div>
              <div className="font-bold text-white">{registro?.nombre ?? usuario!.nombre}</div>
              <div className="text-xs font-mono" style={{ color: 'rgba(255,255,255,.6)' }}>{usuario!.dui}</div>
              {errorFotoPerfil ? (
                <label className="cursor-pointer">
                  <div className="text-xs mt-1 px-2 py-1 rounded-lg flex items-center gap-1.5"
                    style={{ background: 'rgba(220,38,38,.2)', color: '#fca5a5', border: '1px solid rgba(220,38,38,.3)' }}>
                    <AlertTriangle size={10} /><span>{errorFotoPerfil}</span>
                    <span className="underline ml-1">Cargar otra</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) subirFotoPerfil(f) }} />
                </label>
              ) : (
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.35)' }}>Toca la foto para cambiarla</div>
              )}
            </div>
          </div>
          {!editando && (
            <button onClick={() => setEditando(true)}
              className="btn btn-sm" style={{ background: 'rgba(255,255,255,.1)', color: 'white', border: '1px solid rgba(255,255,255,.2)' }}>
              <Pencil size={12} /> Editar
            </button>
          )}
        </div>

        {/* Vista */}
        {!editando ? (
          <div className="p-6 grid grid-cols-2 gap-4">
            {[
              ['Teléfono',  registro?.telefono],
              ['Correo',    registro?.correo],
              ['Dirección', registro?.direccion],
              ['Cargo',     padronInfo?.cargo],
              ['JRV',       padronInfo?.jrv],
              ['Centro',    padronInfo?.centro],
            ].map(([l, v]) => (
              <div key={l as string} className={l === 'Dirección' || l === 'Centro' ? 'col-span-2' : ''}>
                <div className="field-label">{l}</div>
                <div className="text-sm font-medium" style={{ color: v ? 'var(--texto)' : 'var(--texto-muted)' }}>{v || '—'}</div>
              </div>
            ))}
            {(registro?.foto_frente_url || registro?.foto_reverso_url) && (
              <>
                {[{ l: 'Frente del DUI', u: registro?.foto_frente_url }, { l: 'Reverso del DUI', u: registro?.foto_reverso_url }].map(({ l, u }) => (
                  <div key={l}>
                    <div className="field-label mb-1.5">{l}</div>
                    {u ? <a href={u} target="_blank" rel="noopener noreferrer">
                        <img src={u} alt={l} className="w-full rounded-lg object-cover" style={{ border: '1px solid var(--borde)', maxHeight: 110 }} />
                      </a>
                      : <div className="h-20 rounded-lg flex items-center justify-center text-xs"
                          style={{ background: 'var(--fondo)', border: '1px dashed var(--borde)', color: 'var(--texto-muted)' }}>Sin imagen</div>
                    }
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="field-label">Nombre completo</label>
                <input type="text" value={formPerfil.nombre}
                  onChange={e => setFormPerfil(p => ({ ...p, nombre: toNombrePropio(e.target.value) }))}
                  className="input" />
              </div>
              <div>
                <label className="field-label">Teléfono</label>
                <input type="tel" value={formPerfil.telefono}
                  onChange={e => setFormPerfil(p => ({ ...p, telefono: e.target.value }))}
                  className="input" />
              </div>
              <div>
                <label className="field-label">Correo</label>
                <input type="email" value={formPerfil.correo}
                  onChange={e => setFormPerfil(p => ({ ...p, correo: e.target.value }))}
                  className="input" />
              </div>
              <div className="col-span-2">
                <label className="field-label">Dirección</label>
                <input type="text" value={formPerfil.direccion}
                  onChange={e => setFormPerfil(p => ({ ...p, direccion: e.target.value }))}
                  className="input" />
              </div>
            </div>

            {/* Fotos DUI */}
            <div>
              <label className="field-label mb-3 block">
                Fotografías del DUI <span className="font-normal" style={{ color: 'var(--texto-muted)' }}>— Opcional</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                {(['frente', 'reverso'] as const).map(lado => {
                  const prev = lado === 'frente' ? frentePrev   : reversoPrev
                  const val  = lado === 'frente' ? frenteValido : reversoValido
                  const val2 = lado === 'frente' ? validandoF   : validandoR
                  const cur  = lado === 'frente' ? registro?.foto_frente_url : registro?.foto_reverso_url
                  return (
                    <div key={lado}>
                      <div className="field-label mb-1.5">{lado === 'frente' ? 'Frente' : 'Reverso'}</div>
                      <label className="block rounded-lg cursor-pointer overflow-hidden"
                        style={{ border: `2px dashed ${val === true ? 'var(--verde)' : val === false ? 'var(--rojo)' : 'var(--borde)'}`, background: val === true ? 'var(--verde-light)' : 'var(--fondo)', minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {prev ? <img src={prev} alt={lado} className="w-full object-cover" style={{ maxHeight: 100 }} />
                          : cur ? <img src={cur} alt={lado} className="w-full object-cover opacity-40" style={{ maxHeight: 100 }} />
                          : <div className="text-center p-3"><FileImage size={20} style={{ color: 'var(--texto-muted)', margin: '0 auto 4px' }} /><div className="text-xs" style={{ color: 'var(--texto-muted)' }}>Clic para cargar</div></div>
                        }
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => e.target.files?.[0] && handleFoto(e.target.files[0], lado)} />
                      </label>
                      <div className="flex gap-1.5 mt-1.5">
                        <label className="btn btn-ghost btn-sm flex-1 justify-center cursor-pointer" style={{ fontSize: 11 }}>
                          <Upload size={10} /> Galería
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => e.target.files?.[0] && handleFoto(e.target.files[0], lado)} />
                        </label>
                        <label className="btn btn-sm flex-1 justify-center cursor-pointer"
                          style={{ background: 'var(--azul-light)', color: 'var(--azul)', border: '1px solid #bfdbfe', fontSize: 11 }}>
                          <Camera size={10} /> Cámara
                          <input type="file" accept="image/*" capture="environment" className="hidden"
                            onChange={e => e.target.files?.[0] && handleFoto(e.target.files[0], lado)} />
                        </label>
                      </div>
                      <div className="text-xs mt-1">
                        {val2 && <span style={{ color: 'var(--amber)' }}>Validando...</span>}
                        {val === true && <span style={{ color: 'var(--verde)' }}>✓ Válida</span>}
                        {val === false && <span style={{ color: 'var(--rojo)' }}>✗ No legible</span>}
                        {!prev && !val2 && <span style={{ color: 'var(--texto-muted)' }}>{cur ? 'Clic para reemplazar' : 'Sin imagen'}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {errorPerfil && <p className="text-xs" style={{ color: 'var(--rojo)' }}>{errorPerfil}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setEditando(false); setErrorPerfil('') }}
                className="btn btn-ghost flex-1 justify-center"><X size={13} /> Cancelar</button>
              <button onClick={guardarPerfil} disabled={guardando}
                className="btn btn-primary flex-1 justify-center">
                <Save size={13} />{guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
