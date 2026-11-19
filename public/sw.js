// Service Worker — SIRCEV PWA
// Versión: se actualiza con cada deploy (timestamp inyectado en build)
// IMPORTANTE: next.config.mjs envía Cache-Control: no-cache para este archivo
// para que el navegador siempre lo re-descargue y detecte cambios.

const CACHE_NAME = 'sircev-v20261119-2'

// Al instalar: pre-cachear recursos esenciales
self.addEventListener('install', (event) => {
  // Activar de inmediato sin esperar que cierren pestañas anteriores
  self.skipWaiting()
})

// Al activar: limpiar caches viejos y tomar control de todas las pestañas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Estrategia: Network First — siempre intenta red primero para tener lo más reciente
// Si falla la red, usa cache como respaldo
self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones GET del mismo origen
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  // Rutas de API y Supabase: solo red, sin cache
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Guardar copia en cache si la respuesta es válida
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

// Escuchar mensajes del cliente para forzar actualización
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
