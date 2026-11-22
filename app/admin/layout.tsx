'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutGrid, Link2, Users, LogOut, ShieldCheck, ChevronRight, Calendar, User, Camera, FolderOpen, Settings2, Bus, MessageCircle } from 'lucide-react'
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
  { href: '/portal',             label: 'Agenda',                   icon: Calendar },
  { href: '/admin',              label: 'Panel General',           icon: LayoutGrid },
  { href: '/admin/mensajes',     label: 'Mensajes',                icon: MessageCircle },
  { href: '/admin/asignacion',   label: 'Asignación de Cargos',    icon: Link2 },
  { href: '/admin/transporte',   label: 'Transporte',              icon: Bus },
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
  const [mobileMenuOpen,    setMobileMenuOpen]    = useState(false)
  const [nlMensajes,        setNlMensajes]        = useState(0)
  // Modo embebido: accedido desde el portal (sin sidebar propio)
  const [embedded,          setEmbedded]          = useState(false)

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

  // No leídos mensajes admin
  useEffect(() => {
    if (typeof window === 'undefined') return
    const lastGeneral = localStorage.getItem('adminLastReadGeneral') ?? new Date(0).toISOString()
    const lastJrvMap: Record<string, string> = JSON.parse(localStorage.getItem('adminLastReadJrv') ?? '{}')
    Promise.all([
      supabase.from('mensajes_general').select('*', { count: 'exact', head: true })
        .neq('autor_id', 'admin').gt('created_at', lastGeneral),
      supabase.from('mensajes_jrv').select('*', { count: 'exact', head: true })
        .neq('autor_id', 'admin')
        // No podemos filtrar por lastRead por JRV individualmente aquí — usamos fecha mínima global
        .gt('created_at', Object.values(lastJrvMap).length > 0
          ? Object.values(lastJrvMap).reduce((a, b) => a < b ? a : b)
          : new Date(0).toISOString()),
    ]).then(([{ count: cg }, { count: cj }]) => {
      setNlMensajes((cg ?? 0) + (cj ?? 0))
    })

    // Realtime: escuchar nuevos mensajes entrantes para actualizar badge
    const ch = supabase.channel('admin-layout-nl')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_general' },
        (p) => { if (p.new.autor_id !== 'admin') setNlMensajes(n => n + 1) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_jrv' },
        (p) => { if (p.new.autor_id !== 'admin') setNlMensajes(n => n + 1) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    // Verificar si viene del portal (modo embebido)
    if (sessionStorage.getItem('admin_embedded') === '1') {
      sessionStorage.removeItem('admin_embedded') // consumir el flag
      // Solo dejar pasar si ya está autenticado como admin en el portal
      if (sessionStorage.getItem(SESSION_KEY) === '1') {
        setEmbedded(true)
        setAutenticado(true)
        return
      }
    }
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

  /* ── Modo embebido: sin sidebar, solo el contenido con botón volver ── */
  if (embedded) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: 'var(--fondo)' }}>
        <header className="flex items-center px-4 flex-shrink-0"
          style={{ background: 'var(--superficie)', borderBottom: '1px solid var(--borde)', height: 48 }}>
          <a href="/portal"
            className="flex items-center gap-2 text-sm font-medium mr-4"
            style={{ color: 'var(--texto-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--texto)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--texto-muted)')}>
            <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
            Portal
          </a>
          <span style={{ color: 'var(--borde-dark)', marginRight: 8 }}>·</span>
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--texto)' }}>
            {NAV.find(n => n.href === pathname)?.label
              ?? CATALOGO_ITEMS.find(n => n.href === pathname)?.label
              ?? (pathname.startsWith('/admin/transporte') ? 'Transporte' : 'Admin')}
          </span>
        </header>
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>
      </div>
    )
  }

  /* ── App con sidebar ── */
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--fondo)' }}>

      {/* ── Sidebar desktop (md+) ── */}
      <aside className="hidden md:flex flex-col flex-shrink-0 transition-all duration-200"
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
            const esMensajes = href === '/admin/mensajes'
            const badge = esMensajes ? nlMensajes : 0
            return (
              <a key={href} href={href}
                title={collapsed ? label : undefined}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium"
                style={{
                  background: activo ? 'rgba(200,168,75,.18)' : 'transparent',
                  color: activo ? '#c8a84b' : 'rgba(255,255,255,.6)',
                  borderLeft: activo ? '3px solid #c8a84b' : '3px solid transparent',
                }}>
                <span className="relative flex-shrink-0">
                  <Icon size={16} />
                  {badge > 0 && collapsed && (
                    <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full"
                      style={{ background: '#c8a84b' }} />
                  )}
                </span>
                {!collapsed && <span className="truncate flex-1">{label}</span>}
                {!collapsed && badge > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: '#c8a84b', color: '#1e3a5f', minWidth: 18, textAlign: 'center' }}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
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

      {/* ── Drawer móvil (< md) ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)' }}
            onClick={() => setMobileMenuOpen(false)} />
          {/* Panel */}
          <aside className="relative flex flex-col w-72 max-w-[85vw] h-full overflow-y-auto"
            style={{ background: 'linear-gradient(180deg, var(--navy-dark) 0%, var(--navy) 100%)' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <label className="relative cursor-pointer group flex-shrink-0" title="Cambiar logo">
                <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center"
                  style={{ background: 'rgba(200,168,75,.2)', border: '1px solid rgba(200,168,75,.35)' }}>
                  {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : <LogoUrna size={22} />}
                </div>
                <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,.55)' }}>
                  {subiendoLogo
                    ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                    : <Camera size={12} color="white" />}
                </div>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { subirLogo(f); setMobileMenuOpen(false) } }} />
              </label>
              <div className="overflow-hidden flex-1">
                <div className="text-white font-bold text-sm leading-tight truncate">SIRCEV</div>
                <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,.45)' }}>Administrador</div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ color: 'rgba(255,255,255,.5)', background: 'rgba(255,255,255,.08)' }}>
                <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
              </button>
            </div>
            {/* Nav */}
            <nav className="flex-1 py-3 space-y-1 px-2">
              {NAV.map(({ href, label, icon: Icon }) => {
                const activo = pathname === href
                const esMensajes = href === '/admin/mensajes'
                const badge = esMensajes ? nlMensajes : 0
                return (
                  <a key={href} href={href} onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-sm font-medium"
                    style={{
                      background: activo ? 'rgba(200,168,75,.18)' : 'transparent',
                      color: activo ? '#c8a84b' : 'rgba(255,255,255,.7)',
                      borderLeft: activo ? '3px solid #c8a84b' : '3px solid transparent',
                    }}>
                    <Icon size={18} className="flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                    {badge > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: '#c8a84b', color: '#1e3a5f', minWidth: 18, textAlign: 'center' }}>
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </a>
                )
              })}
              {/* Catálogo */}
              <button onClick={() => setCatalogoAbierto(o => !o)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-sm font-medium"
                style={{
                  background: pathname.startsWith('/admin/catalogo') ? 'rgba(200,168,75,.18)' : 'transparent',
                  color: pathname.startsWith('/admin/catalogo') ? '#c8a84b' : 'rgba(255,255,255,.7)',
                  borderLeft: pathname.startsWith('/admin/catalogo') ? '3px solid #c8a84b' : '3px solid transparent',
                }}>
                <FolderOpen size={18} className="flex-shrink-0" />
                <span className="flex-1 text-left">Catálogo</span>
                <ChevronRight size={13} style={{ transform: catalogoAbierto ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {catalogoAbierto && (
                <div className="pl-4 space-y-1">
                  {CATALOGO_ITEMS.map(({ href, label, icon: Icon }) => {
                    const activo = pathname === href
                    return (
                      <a key={href} href={href} onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm"
                        style={{
                          background: activo ? 'rgba(200,168,75,.18)' : 'transparent',
                          color: activo ? '#c8a84b' : 'rgba(255,255,255,.55)',
                          borderLeft: activo ? '3px solid #c8a84b' : '3px solid transparent',
                        }}>
                        <Icon size={15} className="flex-shrink-0" />
                        <span>{label}</span>
                      </a>
                    )
                  })}
                </div>
              )}
            </nav>
            {/* Footer */}
            <div className="px-2 pb-6 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 12 }}>
              <a href="/portal" onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm"
                style={{ color: 'rgba(255,255,255,.55)' }}>
                <ShieldCheck size={18} className="flex-shrink-0" />
                <span>Ver portal</span>
              </a>
              <button onClick={() => { setMobileMenuOpen(false); cerrarSesion() }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm"
                style={{ color: '#f87171' }}>
                <LogOut size={18} className="flex-shrink-0" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center px-4 md:px-6 flex-shrink-0"
          style={{ background: 'var(--superficie)', borderBottom: '1px solid var(--borde)', height: 52 }}>
          {/* Hamburger móvil */}
          <button className="md:hidden mr-3 w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--texto-muted)', background: 'var(--fondo)' }}
            onClick={() => setMobileMenuOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="hidden sm:inline" style={{ color: 'var(--texto-muted)' }}>Admin</span>
            <ChevronRight size={13} className="hidden sm:block" style={{ color: 'var(--borde-dark)' }} />
            <span className="font-medium truncate" style={{ color: 'var(--texto)' }}>
              {NAV.find(n => n.href === pathname)?.label ?? CATALOGO_ITEMS.find(n => n.href === pathname)?.label ?? (pathname.startsWith('/admin/transporte') ? 'Transporte' : 'Panel')}
            </span>
          </div>
          <div className="ml-auto text-xs hidden lg:block" style={{ color: 'var(--texto-muted)' }}>
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
