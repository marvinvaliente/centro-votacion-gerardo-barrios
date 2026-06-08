'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutGrid, Link2, BookOpen, Users, LogOut, ShieldCheck, ChevronRight, Calendar, User, Camera, FolderOpen, Settings2 } from 'lucide-react'
import LogoUrna from '@/components/LogoUrna'
import { supabase } from '@/lib/supabase'

const LOGO_PATH   = 'configuracion/logo.jpg'
const LOGO_BUCKET = 'fotos-dui'

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? ''
const SESSION_KEY    = 'admin_autenticado'
const INTENTOS_KEY   = 'admin_intentos'
const BLOQUEO_KEY    = 'admin_bloqueo'
const MAX_INTENTOS   = 5
const BLOQUEO_SEG    = 10 * 60

const NAV = [
  { href: '/admin/mi-perfil',   label: 'Mi Perfil',               icon: User },
  { href: '/admin/mi-jrv',      label: 'Mi JRV',                  icon: Users },
  { href: '/admin/materiales',   label: 'Material de Capacitación',icon: BookOpen },
  { href: '/admin/calendario',   label: 'Calendario',              icon: Calendar },
  { href: '/admin',              label: 'Panel General',           icon: LayoutGrid },
  { href: '/admin/asignacion',   label: 'Asignación de Cargos',    icon: Link2 },
  { href: '/admin/usuarios',     label: 'Usuarios',                icon: Users },
]

const CATALOGO_ITEMS = [
  { href: '/admin/catalogo/parametros-generales', label: 'Parámetros Generales', icon: Settings2 },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()

  const [autenticado,       setAutenticado]       = useState(false)
  const [password,          setPassword]          = useState('')
  const [errorAuth,         setErrorAuth]         = useState('')
  const [intentos,          setIntentos]          = useState(0)
  const [bloqueado,         setBloqueado]         = useState(false)
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const [collapsed,         setCollapsed]         = useState(false)
  const [catalogoAbierto,   setCatalogoAbierto]   = useState(false)
  const [logoUrl,           setLogoUrl]           = useState<string | null>(null)
  const [subiendoLogo,      setSubiendoLogo]      = useState(false)

  useEffect(() => {
    const url = supabase.storage.from(LOGO_BUCKET).getPublicUrl(LOGO_PATH).data.publicUrl
    // Verificar si existe usando HEAD request
    fetch(url, { method: 'HEAD' }).then(r => { if (r.ok) setLogoUrl(url) }).catch(() => {})
  }, [])

  async function subirLogo(file: File) {
    setSubiendoLogo(true)
    const { error } = await supabase.storage.from(LOGO_BUCKET).upload(LOGO_PATH, file, { upsert: true, contentType: file.type })
    if (!error) {
      const url = supabase.storage.from(LOGO_BUCKET).getPublicUrl(LOGO_PATH).data.publicUrl
      setLogoUrl(url + `?t=${Date.now()}`)
    }
    setSubiendoLogo(false)
  }

  useEffect(() => {
    const onResize = () => { if (window.innerWidth < 768) setCollapsed(true) }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === '1') { setAutenticado(true); return }
    const hasta = localStorage.getItem(BLOQUEO_KEY)
    if (hasta) {
      const resta = Math.ceil((parseInt(hasta) - Date.now()) / 1000)
      if (resta > 0) { setBloqueado(true); setSegundosRestantes(resta) }
      else localStorage.removeItem(BLOQUEO_KEY)
    }
    setIntentos(parseInt(localStorage.getItem(INTENTOS_KEY) ?? '0'))
  }, [])

  useEffect(() => {
    if (!bloqueado) return
    const t = setInterval(() => {
      setSegundosRestantes(s => {
        if (s <= 1) {
          clearInterval(t)
          setBloqueado(false)
          localStorage.removeItem(BLOQUEO_KEY)
          localStorage.removeItem(INTENTOS_KEY)
          setIntentos(0)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [bloqueado])

  function verificarPassword() {
    if (bloqueado) return
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      localStorage.removeItem(INTENTOS_KEY)
      localStorage.removeItem(BLOQUEO_KEY)
      setAutenticado(true); setErrorAuth(''); setIntentos(0)
    } else {
      const n = intentos + 1
      setIntentos(n)
      localStorage.setItem(INTENTOS_KEY, String(n))
      setPassword('')
      if (n >= MAX_INTENTOS) {
        const hasta = Date.now() + BLOQUEO_SEG * 1000
        localStorage.setItem(BLOQUEO_KEY, String(hasta))
        setBloqueado(true); setSegundosRestantes(BLOQUEO_SEG); setErrorAuth('')
      } else {
        setErrorAuth(`Contraseña incorrecta. Intentos restantes: ${MAX_INTENTOS - n}`)
      }
    }
  }

  function cerrarSesion() {
    sessionStorage.removeItem(SESSION_KEY)
    router.push('/portal')
  }

  /* ── Login ── */
  if (!autenticado) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, var(--navy-dark) 0%, var(--navy) 100%)' }}>
        <div className="card p-10 w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(200,168,75,.15)', border: '1px solid rgba(200,168,75,.3)' }}>
            <LogoUrna size={36} />
          </div>
          <h1 className="font-bold text-lg mb-1">Panel Administrador</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--texto-muted)' }}>Ingrese su contraseña para continuar</p>

          {bloqueado ? (
            <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--rojo-light)', border: '1px solid #fecaca' }}>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--rojo)' }}>🔒 Acceso bloqueado</p>
              <p className="text-xs" style={{ color: 'var(--rojo)' }}>
                Intente en <strong>{Math.floor(segundosRestantes / 60)}:{String(segundosRestantes % 60).padStart(2, '0')}</strong>
              </p>
            </div>
          ) : (
            <>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verificarPassword()}
                placeholder="Contraseña" className="input text-center mb-3"
                style={{ letterSpacing: '.15em' }} />
              {errorAuth && <p className="text-xs mb-3" style={{ color: 'var(--rojo)' }}>{errorAuth}</p>}
              {intentos > 0 && !errorAuth && (
                <p className="text-xs mb-3" style={{ color: 'var(--texto-muted)' }}>
                  Intentos fallidos: {intentos} / {MAX_INTENTOS}
                </p>
              )}
            </>
          )}

          <button onClick={verificarPassword} disabled={bloqueado}
            className="btn btn-primary w-full justify-center py-2.5 disabled:opacity-40">
            Ingresar al panel
          </button>
          <a href="/portal" className="block mt-4 text-sm" style={{ color: 'var(--texto-muted)' }}>← Volver al portal</a>
        </div>
      </div>
    )
  }

  /* ── App con sidebar ── */
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--fondo)' }}>

      {/* Sidebar */}
      <aside className="flex flex-col flex-shrink-0 transition-all duration-200"
        style={{
          width: collapsed ? 64 : 240,
          background: 'linear-gradient(180deg, var(--navy-dark) 0%, var(--navy) 100%)',
          borderRight: '1px solid rgba(255,255,255,.06)',
        }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <label className="relative cursor-pointer group flex-shrink-0" title="Cambiar logo">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center"
              style={{ background: 'rgba(200,168,75,.2)', border: '1px solid rgba(200,168,75,.35)' }}>
              {logoUrl
                ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                : <LogoUrna size={22} />
              }
            </div>
            <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,.55)' }}>
              {subiendoLogo
                ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                : <Camera size={12} color="white" />
              }
            </div>
            <input type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) subirLogo(f) }} />
          </label>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-white font-bold text-sm leading-tight truncate">SIRCEV</div>
              <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,.45)' }}>Administrador</div>
            </div>
          )}
          <button onClick={() => setCollapsed(c => !c)}
            className="ml-auto flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors"
            style={{ color: 'rgba(255,255,255,.4)' }}
            title={collapsed ? 'Expandir' : 'Colapsar'}>
            <ChevronRight size={14} style={{ transform: collapsed ? 'none' : 'rotate(180deg)', transition: 'transform .2s' }} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 space-y-1 px-2 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const activo = pathname === href
            return (
              <a key={href} href={href}
                title={collapsed ? label : undefined}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium"
                style={{
                  background: activo ? 'rgba(200,168,75,.18)' : 'transparent',
                  color: activo ? '#c8a84b' : 'rgba(255,255,255,.6)',
                  borderLeft: activo ? '3px solid #c8a84b' : '3px solid transparent',
                }}>
                <Icon size={16} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </a>
            )
          })}

          {/* Catálogo */}
          <button
            onClick={() => { if (!collapsed) setCatalogoAbierto(o => !o) }}
            title={collapsed ? 'Catálogo' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium"
            style={{
              background: pathname.startsWith('/admin/catalogo') ? 'rgba(200,168,75,.18)' : 'transparent',
              color: pathname.startsWith('/admin/catalogo') ? '#c8a84b' : 'rgba(255,255,255,.6)',
              borderLeft: pathname.startsWith('/admin/catalogo') ? '3px solid #c8a84b' : '3px solid transparent',
            }}>
            <FolderOpen size={16} className="flex-shrink-0" />
            {!collapsed && (
              <>
                <span className="truncate flex-1 text-left">Catálogo</span>
                <ChevronRight size={13} style={{ transform: catalogoAbierto ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
              </>
            )}
          </button>

          {!collapsed && catalogoAbierto && (
            <div className="pl-4 space-y-1">
              {CATALOGO_ITEMS.map(({ href, label, icon: Icon }) => {
                const activo = pathname === href
                return (
                  <a key={href} href={href}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm"
                    style={{
                      background: activo ? 'rgba(200,168,75,.18)' : 'transparent',
                      color: activo ? '#c8a84b' : 'rgba(255,255,255,.5)',
                      borderLeft: activo ? '3px solid #c8a84b' : '3px solid transparent',
                    }}>
                    <Icon size={14} className="flex-shrink-0" />
                    <span className="truncate">{label}</span>
                  </a>
                )
              })}
            </div>
          )}
        </nav>

        {/* Footer sidebar */}
        <div className="px-2 pb-4 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 12 }}>
          <a href="/portal" title={collapsed ? 'Ver portal' : undefined}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
            style={{ color: 'rgba(255,255,255,.45)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.45)')}>
            <ShieldCheck size={16} className="flex-shrink-0" />
            {!collapsed && <span>Ver portal</span>}
          </a>
          <button onClick={cerrarSesion} title={collapsed ? 'Cerrar sesión' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
            style={{ color: 'rgba(255,255,255,.45)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.45)')}>
            <LogOut size={16} className="flex-shrink-0" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar con breadcrumb */}
        <header className="flex items-center px-6 py-3 flex-shrink-0"
          style={{ background: 'var(--superficie)', borderBottom: '1px solid var(--borde)', height: 52 }}>
          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: 'var(--texto-muted)' }}>Admin</span>
            <ChevronRight size={13} style={{ color: 'var(--borde-dark)' }} />
            <span className="font-medium" style={{ color: 'var(--texto)' }}>
              {NAV.find(n => n.href === pathname)?.label ?? CATALOGO_ITEMS.find(n => n.href === pathname)?.label ?? 'Panel'}
            </span>
          </div>
          <div className="ml-auto text-xs" style={{ color: 'var(--texto-muted)' }}>
            C.E. Capitán General Gerardo Barrios
          </div>
        </header>

        {/* Página */}
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
