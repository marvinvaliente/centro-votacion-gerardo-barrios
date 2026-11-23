'use client'

/**
 * Barra de navegación inferior móvil — compartida entre portal y módulos admin.
 * - Secciones del portal (perfil, jrv, agenda, mensajes, transporte, motorista)
 *   navegan a /portal?s=<key>
 * - Módulos admin navegan a /admin/* (con flag admin_embedded)
 */

import { User, Users, Calendar, MessageCircle, Bus, Truck, ShieldAlert, Link2, FolderOpen, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

export type NavKey = 'perfil' | 'jrv' | 'agenda' | 'mensajes' | 'transporte' | 'motorista' | string

interface PortalNavBarProps {
  activeKey: NavKey
}

const ADMIN_SESSION = 'admin_autenticado'

export default function PortalNavBar({ activeKey }: PortalNavBarProps) {
  const [esAdmin, setEsAdmin] = useState(false)
  const [esMotorista, setEsMotorista] = useState(false)

  useEffect(() => {
    const adminOk = sessionStorage.getItem(ADMIN_SESSION) === '1'
    setEsAdmin(adminOk)
    try {
      const reg = sessionStorage.getItem('portal_registro')
      if (reg) {
        const r = JSON.parse(reg)
        setEsMotorista(!!r.es_motorista)
      }
    } catch {}
  }, [])

  const NAV = [
    { key: 'perfil',      label: 'Mi Perfil',  icon: User,          href: '/portal?s=perfil',      adminOnly: false },
    { key: 'jrv',         label: 'Mi JRV',     icon: Users,         href: '/portal?s=jrv',         adminOnly: false },
    { key: 'agenda',      label: 'Agenda',     icon: Calendar,      href: '/portal?s=agenda',      adminOnly: false },
    { key: 'mensajes',    label: 'Mensajes',   icon: MessageCircle, href: '/portal?s=mensajes',    adminOnly: false },
    { key: 'transporte',  label: 'Transporte', icon: Bus,           href: '/portal?s=transporte',  adminOnly: false },
    ...(esMotorista ? [{ key: 'motorista', label: 'Motorista', icon: Truck, href: '/portal?s=motorista', adminOnly: false }] : []),
    ...(esAdmin ? [
      { key: 'admin-panel',      label: 'Panel',     icon: ShieldAlert, href: '/portal?s=admin-panel',      adminOnly: true },
      { key: 'admin-usuarios',   label: 'Usuarios',  icon: Users,       href: '/portal?s=admin-usuarios',   adminOnly: true },
      { key: 'admin-asignacion', label: 'Asignación',icon: Link2,       href: '/portal?s=admin-asignacion', adminOnly: true },
      { key: 'admin-transporte', label: 'T. Admin',  icon: Truck,       href: '/portal?s=admin-transporte', adminOnly: true },
      { key: 'admin-catalogo',   label: 'Catálogo',  icon: FolderOpen,  href: '/portal?s=admin-catalogo',   adminOnly: true },
    ] : []),
  ]

  function navClick(href: string, adminOnly: boolean) {
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
        {NAV.map(({ key, label, icon: Icon, href, adminOnly }) => {
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
              <Icon size={20} />
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
