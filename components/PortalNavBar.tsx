'use client'

/**
 * Barra de navegación inferior móvil — compartida entre todas las páginas del portal.
 * Se muestra solo en móvil (< md). Resalta la sección activa según `activeKey`.
 */

import { User, Users, Calendar, MessageCircle, Bus, Truck, ShieldAlert, Link2, FolderOpen, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

export type NavKey = 'perfil' | 'jrv' | 'agenda' | 'mensajes' | 'transporte' | 'motorista' | string

interface PortalNavBarProps {
  activeKey: NavKey
}

const ADMIN_SESSION = 'admin_autenticado'
const ADMIN_DUI = '04325191-7'

export default function PortalNavBar({ activeKey }: PortalNavBarProps) {
  const [esAdmin, setEsAdmin] = useState(false)
  const [esMotorista, setEsMotorista] = useState(false)
  const [dui, setDui] = useState('')
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0)

  useEffect(() => {
    // Leer sesión
    try {
      const sesion = sessionStorage.getItem('portal_usuario')
      if (sesion) {
        const usr = JSON.parse(sesion)
        setDui(usr.dui ?? '')
      }
    } catch {}

    const adminOk = sessionStorage.getItem(ADMIN_SESSION) === '1'
    setEsAdmin(adminOk)

    // Leer es_motorista desde registros_dui cacheado en sessionStorage
    try {
      const reg = sessionStorage.getItem('portal_registro')
      if (reg) {
        const r = JSON.parse(reg)
        setEsMotorista(!!r.es_motorista)
      }
    } catch {}
  }, [])

  const NAV = [
    { key: 'perfil',      label: 'Mi Perfil',  icon: User,          href: '/portal',              badge: 0,                adminOnly: false },
    { key: 'jrv',         label: 'Mi JRV',     icon: Users,         href: '/portal?s=jrv',        badge: 0,                adminOnly: false },
    { key: 'agenda',      label: 'Agenda',     icon: Calendar,      href: '/portal?s=agenda',     badge: 0,                adminOnly: false },
    { key: 'mensajes',    label: 'Mensajes',   icon: MessageCircle, href: '/portal/mensajes',      badge: mensajesNoLeidos, adminOnly: false },
    { key: 'transporte',  label: 'Transporte', icon: Bus,           href: `/transporte?dui=${encodeURIComponent(dui)}`, badge: 0, adminOnly: false },
    ...(esMotorista ? [{ key: 'motorista', label: 'Motorista', icon: Truck, href: `/motorista?dui=${encodeURIComponent(dui)}`, badge: 0, adminOnly: false }] : []),
    ...(esAdmin ? [
      { key: 'admin-panel',      label: 'Panel',     icon: ShieldAlert, href: '/admin',                                        badge: 0, adminOnly: true },
      { key: 'admin-usuarios',   label: 'Usuarios',  icon: Users,       href: '/admin/usuarios',                               badge: 0, adminOnly: true },
      { key: 'admin-asignacion', label: 'Asignación',icon: Link2,       href: '/admin/asignacion',                             badge: 0, adminOnly: true },
      { key: 'admin-transporte', label: 'T. Admin',  icon: Truck,       href: '/admin/transporte',                             badge: 0, adminOnly: true },
      { key: 'admin-catalogo',   label: 'Catálogo',  icon: FolderOpen,  href: '/admin/catalogo/parametros-generales',          badge: 0, adminOnly: true },
    ] : []),
  ]

  function navClick(href: string, adminOnly: boolean) {
    if (adminOnly) sessionStorage.setItem('admin_embedded', '1')
    window.location.href = href
  }

  function cerrarSesion() {
    sessionStorage.removeItem('portal_usuario')
    sessionStorage.removeItem(ADMIN_SESSION)
    sessionStorage.removeItem('admin_dui')
    sessionStorage.removeItem('admin_embedded')
    window.location.href = '/portal'
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{ background: 'var(--navy-dark)', borderTop: '1px solid rgba(255,255,255,.1)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
        {NAV.map(({ key, label, icon: Icon, href, badge, adminOnly }) => {
          const activo = key === activeKey
          return (
            <button key={key}
              onClick={() => navClick(href, adminOnly)}
              className="flex flex-col items-center justify-center gap-0.5 flex-shrink-0 transition-colors relative"
              style={{ color: activo ? 'var(--gold)' : adminOnly ? 'rgba(200,168,75,.55)' : 'rgba(255,255,255,.4)', minHeight: 62, minWidth: 68, padding: '10px 6px' }}>
              {activo && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                  style={{ width: 28, height: 3, background: 'var(--gold)', borderRadius: '0 0 4px 4px' }} />
              )}
              <span className="relative">
                <Icon size={20} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 text-[9px] font-bold px-1 rounded-full"
                    style={{ background: '#ef4444', color: 'white', minWidth: 16, textAlign: 'center' }}>
                    {badge}
                  </span>
                )}
              </span>
              <span className="text-[9px] leading-tight font-medium text-center" style={{ maxWidth: 60 }}>{label}</span>
            </button>
          )
        })}
        {/* Cerrar sesión */}
        <button onClick={cerrarSesion}
          className="flex flex-col items-center justify-center gap-0.5 flex-shrink-0"
          style={{ color: 'rgba(255,255,255,.35)', minHeight: 62, minWidth: 56, padding: '10px 4px' }}>
          <LogOut size={18} />
          <span className="text-[9px] leading-tight font-medium">Salir</span>
        </button>
      </div>
    </nav>
  )
}
