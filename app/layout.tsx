import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Centro de Votación — C.E. Capitán General Gerardo Barrios',
  description: 'SIRCEV — Sistema de Registro de Colaboradores Electorales y Votación',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SIRCEV',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <meta name="theme-color" content="#0f172a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').then(reg => {

                // ── RECARGA CORRECTA ──────────────────────────────────────
                // Esperar a que controllerchange confirme que el nuevo SW
                // ya tomó control ANTES de recargar. Si se recarga antes,
                // el navegador sigue usando el SW viejo → ciclo sin update.
                let refreshing = false
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                  if (refreshing) return
                  refreshing = true
                  window.location.reload()
                })

                function activarWorker(worker) {
                  worker.addEventListener('statechange', () => {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                      // Pedir al SW que tome control ya (skipWaiting)
                      // La recarga vendrá sola cuando dispare controllerchange
                      worker.postMessage('SKIP_WAITING')
                    }
                  })
                }

                // Si ya había un SW esperando de una visita anterior, activarlo
                if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING')

                // Nuevas actualizaciones encontradas en esta sesión
                reg.addEventListener('updatefound', () => {
                  if (reg.installing) activarWorker(reg.installing)
                })

                // Revisar si hay actualización cada vez que la app vuelve a primer plano
                document.addEventListener('visibilitychange', () => {
                  if (document.visibilityState === 'visible') reg.update()
                })
              })
            })
          }
        `}} />
      </body>
    </html>
  )
}