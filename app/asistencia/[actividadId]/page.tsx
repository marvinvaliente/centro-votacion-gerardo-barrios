'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { CheckCircle, Loader2, ShieldCheck, Heart, Clock, XCircle } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type EstadoReg = 'idle' | 'buscando' | 'ok' | 'ya_registrado' | 'no_encontrado' | 'error'

type Actividad = {
  id: string
  titulo: string
  fecha: string
  hora: string | null
  hora_fin: string | null
  lugar: string | null
}

function formatDui(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 9)
  return d.length <= 8 ? d : `${d.slice(0, 8)}-${d.slice(8)}`
}

function ventanaAbierta(actividad: Actividad): 'antes' | 'abierta' | 'cerrada' | 'sin_hora' {
  if (!actividad.hora) return 'sin_hora'
  const hoy = new Date()
  const fechaEvento = actividad.fecha
  const fechaHoy = hoy.toISOString().slice(0, 10)
  if (fechaEvento !== fechaHoy) {
    return fechaEvento > fechaHoy ? 'antes' : 'cerrada'
  }
  const [hh, mm] = actividad.hora.split(':').map(Number)
  const inicio = new Date(hoy); inicio.setHours(hh, mm, 0, 0)
  if (actividad.hora_fin) {
    const [hf, mf] = actividad.hora_fin.split(':').map(Number)
    const fin = new Date(hoy); fin.setHours(hf, mf, 59, 999)
    if (hoy < inicio) return 'antes'
    if (hoy > fin) return 'cerrada'
    return 'abierta'
  }
  return hoy >= inicio ? 'abierta' : 'antes'
}

export default function AsistenciaActividadPage() {
  const { actividadId } = useParams<{ actividadId: string }>()
  const [actividad, setActividad] = useState<Actividad | null>(null)
  const [cargando, setCargando] = useState(true)
  const [dui, setDui] = useState('')
  const [estado, setEstado] = useState<EstadoReg>('idle')
  const [nombre, setNombre] = useState('')
  const [horaReg, setHoraReg] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('actividades').select('id,titulo,fecha,hora,hora_fin,lugar')
      .eq('id', actividadId).single()
      .then(({ data }) => { setActividad(data); setCargando(false) })
  }, [actividadId])

  const registrar = useCallback(async () => {
    const duiLimpio = dui.replace(/\D/g, '')
    if (duiLimpio.length !== 9 || !actividad) return
    const duiFmt = `${duiLimpio.slice(0, 8)}-${duiLimpio.slice(8)}`
    setEstado('buscando')

    const { data: reg } = await supabase
      .from('registros_dui').select('id,nombre').eq('dui', duiFmt).single()

    if (!reg) { setEstado('no_encontrado'); return }

    const { data: existe } = await supabase
      .from('asistencias_actividad').select('id,asistio_at')
      .eq('actividad_id', actividadId).eq('registro_id', reg.id).single()

    if (existe) {
      setNombre(reg.nombre)
      setHoraReg(existe.asistio_at)
      setEstado('ya_registrado')
      return
    }

    const ahora = new Date().toISOString()
    const { error } = await supabase.from('asistencias_actividad')
      .insert({ actividad_id: actividadId, registro_id: reg.id, asistio_at: ahora })

    if (error) { setEstado('error'); return }
    setNombre(reg.nombre)
    setHoraReg(ahora)
    setEstado('ok')
  }, [dui, actividad, actividadId])

  if (cargando) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  if (!actividad) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
      Actividad no encontrada.
    </div>
  )

  const ventana = ventanaAbierta(actividad)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-5">

        {/* Encabezado */}
        <div className="text-center space-y-1">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{actividad.titulo}</h1>
          {actividad.lugar && <p className="text-xs text-gray-400">{actividad.lugar}</p>}
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            {actividad.hora
              ? `${actividad.hora.slice(0, 5)}${actividad.hora_fin ? ` – ${actividad.hora_fin.slice(0, 5)}` : ''}`
              : new Date(actividad.fecha + 'T12:00:00').toLocaleDateString('es-SV', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>

        {/* Ventana cerrada antes */}
        {ventana === 'antes' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-2">
            <Clock className="w-10 h-10 text-amber-400 mx-auto" />
            <p className="font-semibold text-amber-800">El registro aún no está habilitado</p>
            <p className="text-sm text-amber-600">
              El registro de asistencia estará disponible a partir de las <strong>{actividad.hora?.slice(0, 5)}</strong>.
            </p>
          </div>
        )}

        {/* Ventana cerrada después */}
        {ventana === 'cerrada' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center space-y-2">
            <XCircle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="font-semibold text-red-800">El registro ya cerró</p>
            <p className="text-sm text-red-600">
              El período de registro finalizó a las <strong>{actividad.hora_fin?.slice(0, 5)}</strong>.
            </p>
          </div>
        )}

        {/* Ventana abierta o sin hora definida */}
        {(ventana === 'abierta' || ventana === 'sin_hora') && (
          <>
            {/* Mensaje de confianza */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
              <Heart className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700 leading-relaxed">
                Confiamos en la <strong>sinceridad</strong> y el <strong>profesionalismo</strong> de cada uno de ustedes.
                Por favor ingrese su DUI únicamente para registrar la asistencia antes de retirarse del lugar del evento.
              </p>
            </div>

            {/* Formulario */}
            {(estado === 'idle' || estado === 'buscando') && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ingrese su DUI</label>
                  <input
                    type="tel" inputMode="numeric" placeholder="00000000-0"
                    value={dui} onChange={e => setDui(formatDui(e.target.value))} maxLength={10}
                    className="w-full text-center text-2xl font-mono tracking-widest border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-center">{dui.replace(/\D/g, '').length}/9 dígitos</p>
                </div>
                <button
                  onClick={registrar}
                  disabled={dui.replace(/\D/g, '').length !== 9 || estado === 'buscando'}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
                >
                  {estado === 'buscando'
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Verificando…</>
                    : 'Registrar mi asistencia'}
                </button>
              </div>
            )}

            {/* Éxito */}
            {estado === 'ok' && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center space-y-3">
                <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
                <div>
                  <p className="text-lg font-bold text-green-800">{nombre}</p>
                  <p className="text-green-600 text-sm mt-1">¡Asistencia registrada con éxito!</p>
                  {horaReg && (
                    <p className="text-xs text-green-500 mt-0.5">
                      {new Date(horaReg).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  )}
                </div>
                <p className="text-xs text-green-600">Gracias por su puntualidad y compromiso.</p>
                <button onClick={() => { setDui(''); setEstado('idle') }} className="text-xs text-green-700 underline underline-offset-2">
                  Registrar otra persona
                </button>
              </div>
            )}

            {/* Ya registrado */}
            {estado === 'ya_registrado' && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
                <CheckCircle className="w-14 h-14 text-amber-400 mx-auto" />
                <div>
                  <p className="text-lg font-bold text-amber-800">{nombre}</p>
                  <p className="text-amber-700 text-sm mt-1">Su asistencia ya fue registrada anteriormente.</p>
                  {horaReg && (
                    <p className="text-xs text-amber-500 mt-0.5">
                      Registrado a las {new Date(horaReg).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <button onClick={() => { setDui(''); setEstado('idle') }} className="text-xs text-amber-700 underline underline-offset-2">
                  Registrar otra persona
                </button>
              </div>
            )}

            {/* No encontrado */}
            {estado === 'no_encontrado' && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center space-y-3">
                <p className="font-semibold text-red-800">DUI no encontrado</p>
                <p className="text-sm text-red-600">No encontramos ese DUI en el sistema. Verifique el número e intente de nuevo.</p>
                <button onClick={() => { setDui(''); setEstado('idle') }}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium">
                  Intentar de nuevo
                </button>
              </div>
            )}

            {estado === 'error' && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-center space-y-2">
                <p className="font-semibold text-gray-700">Ocurrió un error</p>
                <button onClick={() => { setDui(''); setEstado('idle') }}
                  className="px-5 py-2 rounded-xl bg-gray-700 text-white text-sm font-medium">
                  Intentar de nuevo
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
