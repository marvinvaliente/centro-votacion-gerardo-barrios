import type { DragEvent } from 'react'

export interface ResultadoValidacion { valido: boolean; razon: string }

// Tamaños de compresión: el DUI conserva resolución suficiente para leer el texto
// al ampliarlo; la foto de perfil solo se muestra en avatares.
export const COMPRESION_DUI    = { maxLado: 1600, calidad: 0.85, maxBytes: 600 * 1024 }
export const COMPRESION_PERFIL = { maxLado: 600,  calidad: 0.85, maxBytes: 200 * 1024 }

function cargarImagen(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer el archivo.')) }
    img.src = url
  })
}

// Valida legibilidad de una foto del DUI. Debe ejecutarse sobre el archivo
// original, antes de comprimir, porque la compresión altera nitidez y contraste.
export async function validarFotoDUI(file: File): Promise<ResultadoValidacion> {
  let img: HTMLImageElement
  try { img = await cargarImagen(file) } catch { return { valido: false, razon: 'No se pudo leer el archivo.' } }

  // 1. Tamaño mínimo
  if (img.width < 200 || img.height < 100) return { valido: false, razon: 'La imagen es demasiado pequeña, use una foto más grande.' }

  // 2. Proporción (DUI ~1.58:1)
  const ratio = img.width / img.height
  if (ratio < 0.8 || ratio > 3.5) return { valido: false, razon: 'La proporción no corresponde a un DUI, fotografíe solo el documento.' }

  const canvas = document.createElement('canvas')
  const scale = Math.min(400 / img.width, 400 / img.height, 1)
  const w = canvas.width = Math.round(img.width * scale)
  const h = canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data
  const total = w * h
  const gris = new Float32Array(total)
  for (let i = 0; i < total; i++) gris[i] = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114

  // 3. Brillo
  let suma = 0, oscuros = 0
  for (let i = 0; i < total; i++) { suma += gris[i]; if (gris[i] < 40) oscuros++ }
  const promedio = suma / total
  if (promedio < 40) return { valido: false, razon: 'La imagen está muy oscura, mejore la iluminación.' }
  if (promedio > 230) return { valido: false, razon: 'La imagen está sobreexpuesta, evite reflejos o luz directa.' }
  if (oscuros / total > 0.6) return { valido: false, razon: 'Hay demasiadas zonas oscuras, mejore la iluminación.' }

  // 4. Nitidez (promedio del laplaciano)
  let nitidez = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      nitidez += Math.abs(4 * gris[i] - gris[i - w] - gris[i + w] - gris[i - 1] - gris[i + 1])
    }
  }
  nitidez /= (w - 2) * (h - 2)
  if (nitidez < 2.5) return { valido: false, razon: 'La imagen está borrosa o desenfocada, tome la foto con más estabilidad.' }

  // 5. Contraste (desviación estándar del brillo)
  let varianza = 0
  for (let i = 0; i < total; i++) varianza += (gris[i] - promedio) ** 2
  if (Math.sqrt(varianza / total) < 15) return { valido: false, razon: 'La imagen no tiene contraste suficiente, evite fondos uniformes.' }

  return { valido: true, razon: 'Imagen válida' }
}

// Reduce la imagen a maxLado px (lado mayor) en JPEG. No agranda imágenes
// pequeñas y devuelve el archivo intacto si ya es un JPEG dentro de los límites,
// para no recomprimir fotos que ya pasaron por aquí o por el editor.
export async function comprimirImagen(
  file: File,
  { maxLado, calidad, maxBytes }: { maxLado: number; calidad: number; maxBytes: number },
): Promise<File> {
  let img: HTMLImageElement
  try { img = await cargarImagen(file) } catch { return file }

  const ladoMayor = Math.max(img.width, img.height)
  if (file.type === 'image/jpeg' && ladoMayor <= maxLado && file.size <= maxBytes) return file

  const scale = Math.min(maxLado / ladoMayor, 1)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff' // fondo blanco para PNG con transparencia
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', calidad))
  if (!blob || blob.size >= file.size) return file
  const nombre = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], nombre, { type: 'image/jpeg' })
}

// Props para que una zona de carga acepte imágenes arrastradas.
export function propsArrastrar(onArchivo: (file: File) => void) {
  return {
    onDragOver: (e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files?.[0]
      if (file && file.type.startsWith('image/')) onArchivo(file)
    },
  }
}
