import type { RegistroDUI, Padron } from '@/types'

const CENTRO = 'C.E. Capitán General Gerardo Barrios'

function esc(v: string | null | undefined) {
  return (v ?? '—').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

// Incrusta la imagen en base64 para que la ficha se vea sin conexión;
// si no se puede descargar, deja el enlace público.
async function aDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise(resolve => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => resolve(url)
      r.readAsDataURL(blob)
    })
  } catch { return url }
}

// Descarga un HTML autocontenido con los datos y las fotos de un registro.
export async function descargarFicha(r: RegistroDUI, padron: Padron | null, fotoPerfilUrl?: string | null) {
  const [frente, reverso, perfil] = await Promise.all([
    aDataUrl(r.foto_frente_url), aDataUrl(r.foto_reverso_url), aDataUrl(fotoPerfilUrl ?? null),
  ])
  const campo = (label: string, valor: string | null | undefined, ancho = false) =>
    `<div${ancho ? ' style="grid-column:1/-1"' : ''}><div class="label">${label}</div><div class="value">${esc(valor)}</div></div>`
  const foto = (titulo: string, src: string | null) =>
    `<div><div class="label">${titulo}</div>${src ? `<img src="${src}" alt="${titulo}">` : '<p class="vacio">Sin imagen</p>'}</div>`

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Registro DUI ${esc(r.dui)}</title>
<style>
body{font-family:Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#1a1814}
header{display:flex;align-items:center;gap:16px;margin-bottom:24px}
header .avatar{width:72px;height:72px;border-radius:12px;object-fit:cover;border:1px solid #ddd}
h1{font-size:20px;margin:0}h2{font-size:13px;color:#888;font-weight:normal;margin:4px 0 0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;margin-bottom:24px}
.label{font-size:11px;text-transform:uppercase;color:#888;font-weight:600;margin-bottom:4px}
.value{font-size:14px}
.fotos{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.fotos img{width:100%;border:1px solid #ddd;border-radius:6px}
.vacio{color:#aaa;font-size:13px}
footer{margin-top:32px;font-size:11px;color:#aaa}
@media print{body{margin:0}}
</style></head><body>
<header>${perfil ? `<img class="avatar" src="${perfil}" alt="Foto de perfil">` : ''}
<div><h1>${esc(r.nombre)}</h1><h2>Registro fotográfico de DUI — ${CENTRO}</h2></div></header>
<div class="grid">
${campo('DUI', r.dui)}${campo('Estado', r.estado === 'completo' ? 'Completo' : 'Pendiente')}
${campo('Cargo', padron?.cargo)}${campo('JRV', padron?.jrv)}
${campo('Teléfono', r.telefono)}${campo('Correo', r.correo)}
${campo('Dirección', r.direccion, true)}
${campo('Tipo', r.es_nuevo ? 'Manual' : 'Padrón')}${campo('Fecha de registro', new Date(r.created_at).toLocaleString('es-SV'))}
</div>
<div class="fotos">${foto('Frente del DUI', frente)}${foto('Reverso del DUI', reverso)}</div>
<footer>Generado el ${new Date().toLocaleString('es-SV')}</footer>
</body></html>`

  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  a.download = `registro_dui_${r.dui.replace(/\D/g, '_')}.html`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
