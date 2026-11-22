export default function LogoGB({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Fondo redondeado */}
      <rect x="0" y="0" width="100" height="100" rx="20" fill="#1a3350" />
      {/* Letra G — trazo fino */}
      <path
        d="M32 38 C26 43 24 55 30 62 C36 69 48 69 54 63 L54 52 L44 52"
        stroke="#c8a84b" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      {/* Letra B */}
      <path
        d="M62 32 L62 68"
        stroke="#c8a84b" strokeWidth="3.2" strokeLinecap="round" fill="none"
      />
      <path
        d="M62 32 C72 32 76 38 72 44 C76 44 80 50 76 56 C72 62 62 62 62 62"
        stroke="#c8a84b" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <path
        d="M62 50 L72 50"
        stroke="#c8a84b" strokeWidth="3.2" strokeLinecap="round" fill="none"
      />
    </svg>
  )
}
