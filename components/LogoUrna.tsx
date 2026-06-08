export default function LogoUrna({ size = 32, color = '#c8a84b' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Papeleta entrando */}
      <rect x="13" y="1" width="6" height="5" rx="0.8" fill={color} opacity="0.8"/>
      <polyline points="14.5,3.2 15.5,4.2 17.5,2.2" stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Ranura */}
      <rect x="12" y="5" width="8" height="2" rx="1" fill={color}/>
      {/* Tapa */}
      <rect x="6" y="7" width="20" height="3" rx="1.5" fill={color}/>
      {/* Cuerpo */}
      <rect x="8" y="10" width="16" height="14" rx="2" fill="none" stroke={color} strokeWidth="1.8"/>
      {/* Línea decorativa */}
      <line x1="8" y1="16" x2="24" y2="16" stroke={color} strokeWidth="1" strokeOpacity="0.4"/>
      {/* Base */}
      <rect x="5" y="24" width="22" height="3" rx="1.5" fill={color}/>
      {/* Patas */}
      <rect x="8" y="27" width="3" height="3" rx="1" fill={color} opacity="0.6"/>
      <rect x="21" y="27" width="3" height="3" rx="1" fill={color} opacity="0.6"/>
    </svg>
  )
}
