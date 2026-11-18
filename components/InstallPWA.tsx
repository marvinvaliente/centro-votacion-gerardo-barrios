'use client'

import { useState, useEffect } from 'react'
import { Download, X, Share, Plus } from 'lucide-react'

type Platform = 'android' | 'ios' | 'desktop' | 'unknown'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/macintosh|windows|linux/i.test(ua)) return 'desktop'
  return 'unknown'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
}

interface Props {
  variant?: 'sidebar' | 'bottombar' // dónde se muestra
}

export default function InstallPWA({ variant = 'sidebar' }: Props) {
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [installed, setInstalled] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())
    setInstalled(isStandalone())

    // Capturar el evento de instalación de Android/Chrome
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Detectar cuando se instala
    window.addEventListener('appinstalled', () => setInstalled(true))

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // No mostrar si ya está instalada
  if (installed) return null

  async function handleInstall() {
    if (platform === 'ios') {
      setShowModal(true)
      return
    }
    if (deferredPrompt) {
      // Android/Chrome: usar el prompt nativo
      setInstalling(true)
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setInstalling(false)
      if (outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
    } else {
      // Desktop o Android sin prompt (ya instalado o no soportado)
      setShowModal(true)
    }
  }

  const label = 'Instalar app'
  const icon = <Download size={variant === 'bottombar' ? 20 : 15} className="flex-shrink-0" />

  return (
    <>
      {/* ── Botón ── */}
      {variant === 'sidebar' && (
        <button
          onClick={handleInstall}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left"
          style={{ color: 'rgba(200,168,75,.85)', background: 'rgba(200,168,75,.08)', border: '1px solid rgba(200,168,75,.2)' }}
        >
          {icon}
          <span className="truncate">{installing ? 'Instalando…' : label}</span>
        </button>
      )}

      {variant === 'bottombar' && (
        <button
          onClick={handleInstall}
          className="flex flex-col items-center justify-center gap-0.5 flex-shrink-0"
          style={{ color: 'rgba(200,168,75,.8)', minHeight: 58, minWidth: 56, padding: '8px 4px' }}
        >
          {icon}
          <span style={{ fontSize: 9.5, lineHeight: 1.2 }}>Instalar</span>
        </button>
      )}

      {/* ── Modal instrucciones iOS / Desktop ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl md:rounded-2xl p-6"
            style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,.1)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(200,168,75,.15)' }}>
                  <Download size={20} style={{ color: '#c8a84b' }} />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Instalar SIRCEV</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,.45)' }}>
                    {platform === 'ios' ? 'iPhone / iPad' : 'Escritorio'}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ color: 'rgba(255,255,255,.4)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Pasos iOS */}
            {platform === 'ios' && (
              <div className="space-y-4">
                <p className="text-sm" style={{ color: 'rgba(255,255,255,.65)' }}>
                  Safari no muestra un botón de instalación automático. Seguí estos pasos:
                </p>
                <div className="space-y-3">
                  {[
                    { num: 1, icon: <Share size={16} />, text: 'Tocá el botón Compartir en la barra inferior de Safari' },
                    { num: 2, icon: <Plus size={16} />, text: 'Seleccioná "Agregar a pantalla de inicio"' },
                    { num: 3, icon: <Download size={16} />, text: 'Tocá "Agregar" en la esquina superior derecha' },
                  ].map(({ num, icon, text }) => (
                    <div key={num} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                        style={{ background: 'rgba(200,168,75,.2)', color: '#c8a84b' }}>
                        {num}
                      </div>
                      <div className="flex items-center gap-2 text-sm pt-0.5" style={{ color: 'rgba(255,255,255,.75)' }}>
                        <span style={{ color: '#c8a84b' }}>{icon}</span>
                        {text}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Indicador visual flecha hacia abajo */}
                <div className="mt-4 p-3 rounded-xl text-center text-xs" style={{ background: 'rgba(200,168,75,.1)', color: '#c8a84b', border: '1px dashed rgba(200,168,75,.3)' }}>
                  ↓ El botón Compartir está en la barra inferior de Safari
                </div>
              </div>
            )}

            {/* Pasos Desktop / Android sin prompt */}
            {platform !== 'ios' && (
              <div className="space-y-4">
                <p className="text-sm" style={{ color: 'rgba(255,255,255,.65)' }}>
                  Para instalar desde Chrome:
                </p>
                <div className="space-y-3">
                  {[
                    { num: 1, text: 'Abrí el menú ⋮ (tres puntos) en la esquina superior derecha' },
                    { num: 2, text: 'Seleccioná "Instalar aplicación" o "Agregar a pantalla de inicio"' },
                    { num: 3, text: 'Confirmá tocando "Instalar"' },
                  ].map(({ num, text }) => (
                    <div key={num} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                        style={{ background: 'rgba(200,168,75,.2)', color: '#c8a84b' }}>
                        {num}
                      </div>
                      <div className="text-sm pt-0.5" style={{ color: 'rgba(255,255,255,.75)' }}>{text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(200,168,75,.15)', color: '#c8a84b', border: '1px solid rgba(200,168,75,.3)' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  )
}
