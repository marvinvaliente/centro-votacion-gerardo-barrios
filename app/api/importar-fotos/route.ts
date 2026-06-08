import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Descarga una imagen de Google Drive y la sube a Supabase Storage
async function migrarFoto(driveId: string, path: string): Promise<string | null> {
  const url = `https://drive.google.com/uc?export=download&id=${driveId}`

  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) return null

  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  const { error } = await supabase.storage
    .from('fotos-dui')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true })

  if (error) return null

  const { data } = supabase.storage.from('fotos-dui').getPublicUrl(path)
  return data.publicUrl
}

export async function POST(req: NextRequest) {
  const { dui, frente_id, reverso_id } = await req.json()

  if (!dui) return NextResponse.json({ error: 'DUI requerido' }, { status: 400 })

  const result: { frente?: string | null; reverso?: string | null; error?: string } = {}

  try {
    if (frente_id) {
      result.frente = await migrarFoto(frente_id, `${dui}/frente.jpg`)
    }
    if (reverso_id) {
      result.reverso = await migrarFoto(reverso_id, `${dui}/reverso.jpg`)
    }

    // Actualizar registro en BD solo con los URLs que se obtuvieron
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (result.frente) { update.foto_frente_url = result.frente; update.frente_valido = true }
    if (result.reverso) { update.foto_reverso_url = result.reverso; update.reverso_valido = true }

    if (Object.keys(update).length > 1) {
      await supabase.from('registros_dui').update(update).eq('dui', dui)
    }

    return NextResponse.json({ ok: true, dui, ...result })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
