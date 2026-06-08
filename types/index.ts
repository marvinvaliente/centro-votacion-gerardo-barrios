export interface Padron {
  id: string
  departamento: string
  municipio: string
  distrito: string
  centro: string
  jrv: string
  cargo: string
}

export interface RegistroDUI {
  id: string
  dui: string
  nombre: string
  telefono: string | null
  direccion: string | null
  correo: string | null
  foto_frente_url: string | null
  foto_reverso_url: string | null
  frente_valido: boolean
  reverso_valido: boolean
  estado: string
  es_nuevo: boolean
  padron_id: string | null
  padron?: Padron | Padron[]
  created_at: string
  updated_at: string
}

export interface Administrador {
  id: string
  email: string
  nombre: string
  rol: 'superadmin' | 'admin' | 'viewer'
  activo: boolean
}