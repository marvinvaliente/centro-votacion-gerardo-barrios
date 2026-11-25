export default function LogoGB({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/logo-gb.png"
      alt="GB"
      width={size}
      height={size}
      style={{ borderRadius: Math.round(size * 0.2), display: 'block', objectFit: 'cover' }}
    />
  )
}
