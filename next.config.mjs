/** @type {import('next').NextConfig} */
const isAndroid = process.env.BUILD_TARGET === 'android'

const nextConfig = {
  // Exportación estática solo para la app Android
  ...(isAndroid ? { output: 'export', images: { unoptimized: true } } : {}),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // El service worker nunca debe quedar en caché HTTP
        // para que el navegador detecte cambios en cada visita
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
};

export default nextConfig;
