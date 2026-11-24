// Service Worker — SIRCEV PWA
// Versión: se actualiza con cada deploy (timestamp inyectado en build)
// IMPORTANTE: next.config.mjs envía Cache-Control: no-cache para este archivo
// para que el navegador siempre lo re-descargue y detecte cambios.

const CACHE_NAME = 'sircev-v20261124-2'

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

// Estrategia híbrida:
//   • Chunks JS/CSS/_next/static → Stale-While-Revalidate (sirven del cache al instante,
//     se actualizan en background para la próxima visita)
//   • Todo lo demás → Network First (siempre fresco; cache como fallback offline)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) return

  const isStaticAsset = url.pathname.startsWith('/_next/static/')

  if (isStaticAsset) {
    // Stale-While-Revalidate: respuesta inmediata desde cache + actualización silenciosa
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        const fetchPromise = fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            cache.put(event.request, response.clone())
          }
          return response
        }).catch(() => cached)
        return cached || fetchPromise
      })
    )
  } else {
    // Network First para páginas y API de contenido
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => caches.match(event.request))
    )
  }
})

// Escuchar mensajes del cliente para forzar actualización
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
