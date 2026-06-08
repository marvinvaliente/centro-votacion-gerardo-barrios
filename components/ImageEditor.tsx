'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { RotateCcw, RotateCw, Check, X, SunMedium, Contrast, ZoomIn, Sliders } from 'lucide-react'

interface Props {
  src: string          // URL o object URL de la imagen original
  onAplicar: (file: File) => void
  onCancelar: () => void
  nombre?: string      // 'frente' | 'reverso'
}

export default function ImageEditor({ src, onAplicar, onCancelar, nombre = 'imagen' }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const imgRef     = useRef<HTMLImageElement | null>(null)

  const [rotacion,   setRotacion]   = useState(0)      // grados: 0 90 180 270
  const [brillo,     setBrillo]     = useState(100)    // 50–200
  const [contraste,  setContraste]  = useState(100)    // 50–200
  const [nitidez,    setNitidez]    = useState(0)      // 0–5
  const [aplicando,  setAplicando]  = useState(false)

  const dibujar = useCallback(() => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img) return

    const rad = (rotacion * Math.PI) / 180
    const sinA = Math.abs(Math.sin(rad))
    const cosA = Math.abs(Math.cos(rad))
    const w = img.naturalWidth  * cosA + img.naturalHeight * sinA
    const h = img.naturalWidth  * sinA + img.naturalHeight * cosA

    canvas.width  = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!

    // Aplicar filtros CSS via filter en canvas
    ctx.filter = `brightness(${brillo}%) contrast(${contraste}%)`
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(rad)
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
    ctx.restore()
    ctx.filter = 'none'

    // Nitidez via kernel de convolución
    if (nitidez > 0) {
      const force = nitidez * 0.3
      const kernel = [
        0,          -force,      0,
        -force,  1 + 4 * force, -force,
        0,          -force,      0,
      ]
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const src2    = new Uint8ClampedArray(imgData.data)
      const dst     = imgData.data
      const W = canvas.width, H = canvas.height
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = (y * W + x) * 4
          for (let c = 0; c < 3; c++) {
            let val = 0
            for (let ky = -1; ky <= 1; ky++)
              for (let kx = -1; kx <= 1; kx++)
                val += src2[((y + ky) * W + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)]
            dst[i + c] = Math.min(255, Math.max(0, val))
          }
        }
      }
      ctx.putImageData(imgData, 0, 0)
    }
  }, [rotacion, brillo, contraste, nitidez])

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; dibujar() }
    img.src = src
  }, [src])

  useEffect(() => { dibujar() }, [dibujar])

  async function handleAplicar() {
    setAplicando(true)
    const canvas = canvasRef.current!
    canvas.toBlob(blob => {
      if (!blob) { setAplicando(false); return }
      const file = new File([blob], `${nombre}.jpg`, { type: 'image/jpeg' })
      onAplicar(file)
    }, 'image/jpeg', 0.92)
  }

  function resetear() {
    setRotacion(0); setBrillo(100); setContraste(100); setNitidez(0)
  }

  const sliders = [
    { label: 'Brillo',    icon: SunMedium,  value: brillo,    min: 30,  max: 220, step: 1,   set: setBrillo,    pct: (brillo - 30)    / (220 - 30) },
    { label: 'Contraste', icon: Contrast,   value: contraste, min: 30,  max: 220, step: 1,   set: setContraste, pct: (contraste - 30) / (220 - 30) },
    { label: 'Nitidez',   icon: ZoomIn,     value: nitidez,   min: 0,   max: 5,   step: 0.5, set: setNitidez,   pct: nitidez / 5 },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)' }}>
      <div className="rounded-2xl overflow-hidden w-full flex flex-col"
        style={{ background: 'var(--superficie)', boxShadow: 'var(--sombra-lg)', maxWidth: 680, maxHeight: '95vh' }}>

        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid var(--borde)', background: 'var(--fondo)' }}>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Sliders size={15} /> Editor de imagen — {nombre === 'frente' ? 'Frente del DUI' : 'Reverso del DUI'}
          </div>
          <button onClick={onCancelar} className="btn btn-ghost btn-sm w-8 h-8 p-0 justify-center">
            <X size={14} />
          </button>
        </div>

        {/* Canvas preview */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4"
          style={{ background: '#111', minHeight: 200 }}>
          <canvas ref={canvasRef}
            style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain', borderRadius: 8 }} />
        </div>

        {/* Controles */}
        <div className="px-5 py-4 flex-shrink-0 space-y-3" style={{ borderTop: '1px solid var(--borde)' }}>

          {/* Rotación */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider w-20 flex-shrink-0" style={{ color: 'var(--texto-muted)' }}>Rotación</span>
            <div className="flex gap-2">
              <button onClick={() => setRotacion(r => (r - 90 + 360) % 360)} className="btn btn-ghost btn-sm">
                <RotateCcw size={13} /> −90°
              </button>
              <button onClick={() => setRotacion(r => (r + 90) % 360)} className="btn btn-ghost btn-sm">
                <RotateCw  size={13} /> +90°
              </button>
              <span className="text-xs self-center font-mono px-2 py-1 rounded"
                style={{ background: 'var(--fondo)', color: 'var(--texto-muted)' }}>{rotacion}°</span>
            </div>
          </div>

          {/* Sliders */}
          {sliders.map(({ label, icon: Icon, value, min, max, step, set, pct }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider w-20 flex-shrink-0 flex items-center gap-1.5"
                style={{ color: 'var(--texto-muted)' }}>
                <Icon size={11} /> {label}
              </span>
              <div className="flex-1 relative" style={{ height: 20 }}>
                <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                  <div className="relative w-full h-1.5 rounded-full" style={{ background: 'var(--borde)' }}>
                    <div className="absolute left-0 top-0 h-full rounded-full"
                      style={{ width: `${pct * 100}%`, background: 'var(--navy)' }} />
                  </div>
                </div>
                <input type="range" min={min} max={max} step={step} value={value}
                  onChange={e => set(Number(e.target.value))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer" style={{ height: '100%' }} />
              </div>
              <span className="text-xs font-mono w-8 text-right flex-shrink-0" style={{ color: 'var(--texto-2)' }}>
                {label === 'Nitidez' ? value : `${value}%`}
              </span>
            </div>
          ))}

          {/* Botones */}
          <div className="flex gap-3 pt-1">
            <button onClick={resetear} className="btn btn-ghost btn-sm">
              <RotateCcw size={12} /> Restablecer
            </button>
            <div className="flex-1" />
            <button onClick={onCancelar} className="btn btn-ghost">
              <X size={14} /> Cancelar
            </button>
            <button onClick={handleAplicar} disabled={aplicando} className="btn btn-primary">
              <Check size={14} /> {aplicando ? 'Aplicando...' : 'Aplicar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
