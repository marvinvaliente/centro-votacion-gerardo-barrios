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
                // Verificar actualizaciones cada vez que la app se enfoca
                document.addEventListener('visibilitychange', () => {
                  if (document.visibilityState === 'visible') reg.update()
                })
                // Si hay una nueva versión esperando, activarla de inmediato
                reg.addEventListener('updatefound', () => {
                  const newWorker = reg.installing
                  if (!newWorker) return
                  newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                      newWorker.postMessage('SKIP_WAITING')
                      window.location.reload()
                    }
                  })
                })
              })
            })
          }
        `}} />
      </body>
    </html>
  )
}