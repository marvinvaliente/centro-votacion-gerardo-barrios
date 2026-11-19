'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { CheckCircle, Loader2, ShieldCheck, Heart } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Estado = 'idle' | 'buscando' | 'encontrado' | 'ya_registrado' | 'no_encontrado' | 'error'

type Resultado = {
  solicitud_id: string
  nombre: string
  asistio: boolean
  asistio_at: string | null
}

function formatDui(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 9)
  if (digits.length <= 8) return digits
  return `${digits.slice(0, 8)}-${digits.slice(8)}`
}

export default function AsistenciaPublicaPage() {
  const { eventoId } = useParams<{ eventoId: string }>()
  const [dui, setDui] = useState('')
  const [estado, setEstado] = useState<Estado>('idle')
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const buscarYRegistrar = useCallback(async () => {
    const duiLimpio = dui.replace(/\D/g, '')
    if (duiLimpio.length !== 9) return
    const duiFormateado = `${duiLimpio.slice(0, 8)}-${duiLimpio.slice(8)}`

    setEstado('buscando')
    setResultado(null)

    // Buscar el registro por DUI en todos los usuarios del sistema
    const { data: registro, error: errReg } = await supabase
      .from('registros_dui')
      .select('id, nombre')
      .eq('dui', duiFormateado)
      .single()

    if (errReg || !registro) {
      setEstado('no_encontrado')
      return
    }

    const nombre = registro.nombre ?? '—'

    // Verificar si ya registró asistencia
    const { data: yaExiste } = await supabase
      .from('asistencias_evento')
      .select('id, asistio_at')
      .eq('evento_id', eventoId)
      .eq('registro_id', registro.id)
      .single()

    if (yaExiste) {
      setResultado({ solicitud_id: yaExiste.id, nombre, asistio: true, asistio_at: yaExiste.asistio_at })
      setEstado('ya_registrado')
      return
    }

    // Registrar asistencia
    const ahora = new Date().toISOString()
    const { data: nueva, error: errIns } = await supabase
      .from('asistencias_evento')
      .insert({ evento_id: eventoId, registro_id: registro.id, asistio_at: ahora })
      .select('id')
      .single()

    if (errIns || !nueva) {
      setEstado('error')
      return
    }

    setResultado({ solicitud_id: nueva.id, nombre, asistio: true, asistio_at: ahora })
    setEstado('encontrado')
  }, [dui, eventoId])

  const reiniciar = () => {
    setDui('')
    setEstado('idle')
    setResultado(null)
  }

  const duiDigits = dui.replace(/\D/g, '').length

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo / título */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Registro de Asistencia</h1>
          <p className="text-sm text-gray-500">Capacitación General</p>
        </div>

        {/* Mensaje de confianza */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
          <Heart className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 leading-relaxed">
            Confiamos en la <strong>sinceridad</strong> y el <strong>profesionalismo</strong> de cada uno de ustedes.
            Por favor ingrese su DUI únicamente para registrar la asistencia antes de retirarse del lugar del evento.
          </p>
        </div>

        {/* Estado: idle / buscando */}
        {(estado === 'idle' || estado === 'buscando') && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Ingrese su DUI
              </label>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="00000000-0"
                value={dui}
                onChange={e => setDui(formatDui(e.target.value))}
                maxLength={10}
                className="w-full text-center text-2xl font-mono tracking-widest border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1 text-center">
                {duiDigits}/9 dígitos
              </p>
            </div>

            <button
              onClick={buscarYRegistrar}
              disabled={duiDigits !== 9 || estado === 'buscando'}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
            >
              {estado === 'buscando'
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Verificando…</>
                : 'Marcar mi asistencia'}
            </button>
          </div>
        )}

        {/* Estado: registrado exitosamente */}
        {estado === 'encontrado' && resultado && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center space-y-3">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
            <div>
              <p className="text-lg font-bold text-green-800">{resultado.nombre}</p>
              <p className="text-green-600 text-sm mt-1">¡Asistencia registrada con éxito!</p>
              {resultado.asistio_at && (
                <p className="text-xs text-green-500 mt-0.5">
                  {new Date(resultado.asistio_at).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </div>
            <p className="text-xs text-green-600 mt-2">Gracias por su puntualidad y compromiso.</p>
            <button
              onClick={reiniciar}
              className="mt-2 text-xs text-green-700 underline underline-offset-2"
            >
              Registrar otra persona
            </button>
          </div>
        )}

        {/* Estado: ya estaba registrado */}
        {estado === 'ya_registrado' && resultado && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
            <CheckCircle className="w-14 h-14 text-amber-400 mx-auto" />
            <div>
              <p className="text-lg font-bold text-amber-800">{resultado.nombre}</p>
              <p className="text-amber-700 text-sm mt-1">Su asistencia ya fue registrada anteriormente.</p>
              {resultado.asistio_at && (
                <p className="text-xs text-amber-500 mt-0.5">
                  Registrado a las {new Date(resultado.asistio_at).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <button
              onClick={reiniciar}
              className="mt-2 text-xs text-amber-700 underline underline-offset-2"
            >
              Registrar otra persona
            </button>
          </div>
        )}

        {/* Estado: no encontrado */}
        {estado === 'no_encontrado' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <span className="text-3xl">🔍</span>
            </div>
            <div>
              <p className="font-semibold text-red-800">DUI no encontrado</p>
              <p className="text-sm text-red-600 mt-1">
                No encontramos una solicitud de transporte activa con ese DUI para este evento.
              </p>
              <p className="text-xs text-red-500 mt-1">Verifique el número e intente de nuevo.</p>
            </div>
            <button
              onClick={reiniciar}
              className="mt-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Estado: error */}
        {estado === 'error' && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center space-y-3">
            <p className="font-semibold text-gray-700">Ocurrió un error</p>
            <p className="text-sm text-gray-500">Por favor intente de nuevo o contacte al organizador.</p>
            <button
              onClick={reiniciar}
              className="mt-2 px-5 py-2 rounded-xl bg-gray-700 hover:bg-gray-800 text-white text-sm font-medium"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
