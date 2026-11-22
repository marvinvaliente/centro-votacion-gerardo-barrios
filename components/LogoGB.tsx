export default function LogoGB({ size = 32 }: { size?: number }) {
  const r = size * 0.18          // radio del redondeo
  const cr = size * 0.36         // radio del círculo decorativo
  const fs = size * 0.38         // font-size aproximado (SVG text)

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Fondo redondeado */}
      <rect x="0" y="0" width="100" height="100" rx="22" fill="#1e3a5f" />
      {/* Círculo dorado tenue */}
      <circle cx="50" cy="50" r="36" fill="rgba(200,168,75,0.15)" />
      {/* Texto GB */}
      <text
        x="50" y="50"
        dominantBaseline="central"
        textAnchor="middle"
        fontFamily="'Arial Black', Arial, sans-serif"
        fontWeight="900"
        fontSize="40"
        fill="#c8a84b"
        style={{ letterSpacing: '-1px' }}
      >GB</text>
    </svg>
  )
}
