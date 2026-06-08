'use client'

import { useState, useEffect } from 'react'
import { Users, RefreshCw, MapPin, Briefcase, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { RegistroDUI, Padron } from '@/types'

interface PadronConReg extends Padron {
  registro?: RegistroDUI | null
}

export default function MiJRVPage() {
  const [dui, setDui]             = useState<string | null>(null)
  const [padronInfo, setPadronInfo] = useState<Padron | null>(null)
  const [companeros, setCompaneros] = useState<(RegistroDUI & { padron?: Padron | null })[]>([])
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    const d = sessionStorage.getItem('admin_dui')
    if (d) { setDui(d); cargar(d) }
    else { setError('No se encontró el DUI del administrador en la sesión. Vuelva a iniciar sesión desde el portal.'); setCargando(false) }
  }, [])

  async function cargar(duiAdmin: string) {
    setCargando(true); setError('')

    // Buscar el registro del DUI del admin
    const { data: reg } = await supabase
      .from('registros_dui')
      .select('*, padron(*)')
      .eq('dui', duiAdmin)
      .single()

    if (!reg?.padron) {
      setError('No tiene una JRV asignada en el padrón.'); setCargando(false); return
    }

    const pad = Array.isArray(reg.padron) ? reg.padron[0] : reg.padron
    if (!pad) { setError('No tiene una JRV asignada en el padrón.'); setCargando(false); return }

    setPadronInfo(pad)

    // Buscar compañeros de la misma JRV
    const { data: regsJRV } = await supabase
      .from('registros_dui')
      .select('*, padron!inner(*)')
      .eq('padron.jrv', pad.jrv)
      .neq('dui', duiAdmin)

    setCompaneros((regsJRV ?? []) as any)
    setCargando(false)
  }

  if (cargando) return (
    <div className="p-6 flex items-center justify-center min-h-64" style={{ color: 'var(--texto-muted)' }}>
      <RefreshCw size={20} className="animate-spin mr-2" style={{ opacity: .4 }} /> Cargando...
    </div>
  )

  if (error) return (
    <div className="p-6 max-w-xl">
      <div className="card p-8 text-center" style={{ color: 'var(--texto-muted)' }}>
        <Users size={36} className="mx-auto mb-3" style={{ opacity: .25 }} />
        <p className="text-sm">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-2xl space-y-5">

      {/* Mi asignación */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, var(--navy-dark), var(--navy))', borderBottom: '3px solid var(--gold)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(200,168,75,.2)', border: '1px solid rgba(200,168,75,.35)' }}>
            <Users size={18} style={{ color: 'var(--gold)' }} />
          </div>
          <div>
            <div className="font-bold text-white">Mi asignación JRV</div>
            <div className="text-xs font-mono" style={{ color: 'rgba(255,255,255,.5)' }}>{dui}</div>
          </div>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {[
            { icon: Building2, label: 'JRV',          value: padronInfo!.jrv },
            { icon: Briefcase, label: 'Cargo',         value: padronInfo!.cargo },
            { icon: MapPin,    label: 'Departamento',  value: padronInfo!.departamento },
            { icon: MapPin,    label: 'Municipio',     value: padronInfo!.municipio },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'var(--fondo)', border: '1px solid var(--borde)' }}>
                <Icon size={13} style={{ color: 'var(--texto-muted)' }} />
              </div>
              <div>
                <div className="field-label">{label}</div>
                <div className="text-sm font-semibold">{value}</div>
              </div>
            </div>
          ))}
          <div className="col-span-2 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'var(--fondo)', border: '1px solid var(--borde)' }}>
              <Building2 size={13} style={{ color: 'var(--texto-muted)' }} />
            </div>
            <div>
              <div className="field-label">Centro de votación</div>
              <div className="text-sm font-semibold">{padronInfo!.centro}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Compañeros */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ background: 'var(--fondo)', borderBottom: '1px solid var(--borde)' }}>
          <span className="font-semibold text-sm">
            Compañeros en JRV {padronInfo!.jrv}
          </span>
          <span className="badge badge-blue">{companeros.length}</span>
        </div>

        {companeros.length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: 'var(--texto-muted)' }}>
            No hay otros compañeros registrados en esta JRV
          </div>
        ) : companeros.map((c, i) => (
          <div key={c.id} className="px-5 py-4 flex gap-4"
            style={{
              borderBottom: i < companeros.length - 1 ? '1px solid var(--borde)' : 'none',
              background: i % 2 === 0 ? 'var(--superficie)' : '#fafafa'
            }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5"
              style={{ background: 'var(--azul-light)', color: 'var(--azul)' }}>
              {c.nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <div className="font-semibold text-sm">{c.nombre}</div>
                <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--azul)' }}>
                  {(c as any).padron?.cargo ?? '—'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {[
                  { label: 'DUI',       value: c.dui,       mono: true },
                  { label: 'Teléfono',  value: c.telefono },
                  { label: 'Correo',    value: c.correo },
                  { label: 'Dirección', value: c.direccion },
                ].map(({ label, value, mono }) => (
                  <div key={label}>
                    <div className="field-label">{label}</div>
                    <div className={`text-xs truncate ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</div>
                  </div>
                ))}
              </div>
              {(c.foto_frente_url || c.foto_reverso_url) && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {[
                    { label: 'Frente del DUI', url: c.foto_frente_url },
                    { label: 'Reverso del DUI', url: c.foto_reverso_url },
                  ].map(({ label, url }) => (
                    <div key={label}>
                      <div className="field-label mb-1">{label}</div>
                      {url
                        ? <a href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={label} className="w-full rounded-lg object-cover"
                              style={{ border: '1px solid var(--borde)', maxHeight: 100 }} />
                          </a>
                        : <div className="rounded-lg flex items-center justify-center text-xs"
                            style={{ height: 60, background: 'var(--fondo)', border: '1px dashed var(--borde)', color: 'var(--texto-muted)' }}>
                            Sin imagen
                          </div>
                      }
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
