/**
 * Biometric abstraction
 *
 * Native (Capacitor Android/iOS):
 *   - `verifyIdentity()` abre el prompt del lector de huella / Face ID
 *   - El DUI del usuario se guarda en localStorage (igual que siempre)
 *   - La huella es SOLO la llave que desbloquea el acceso — el DUI ya está en el dispositivo
 *
 * Web (browser):
 *   - WebAuthn platform authenticator
 */

import { Capacitor } from '@capacitor/core'

/** True when running inside a Capacitor native shell */
function isNative(): boolean {
  try { return Capacitor.isNativePlatform() } catch { return false }
}

// ─── NATIVE ───────────────────────────────────────────────────────────────────

async function nativeIsAvailable(): Promise<boolean> {
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric')
    const result = await NativeBiometric.isAvailable()
    return result.isAvailable
  } catch { return false }
}

/** Muestra el prompt de huella y lanza si el usuario cancela o falla */
async function nativeVerify(title: string, reason: string): Promise<void> {
  const { NativeBiometric } = await import('capacitor-native-biometric')
  await NativeBiometric.verifyIdentity({ reason, title, subtitle: 'Portal GB' })
}

// ─── WEB (WebAuthn) ──────────────────────────────────────────────────────────

async function webIsAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!window.PublicKeyCredential) return false
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false)
}

async function webRegister(dui: string): Promise<void> {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Portal GB', id: location.hostname },
      user: { id: new TextEncoder().encode(dui), name: dui, displayName: dui },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
    },
  }) as PublicKeyCredential
  const arr = new Uint8Array(cred.rawId)
  const idB64 = btoa(Array.from(arr).map(b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  localStorage.setItem('usuario_webauthn_id', idB64)
  localStorage.setItem('usuario_webauthn_dui', dui)
}

async function webAuthenticate(dui: string): Promise<void> {
  const idStr = localStorage.getItem('usuario_webauthn_id')
  if (!idStr) throw new Error('No hay credencial registrada')
  const bin = atob(idStr.replace(/-/g, '+').replace(/_/g, '/'))
  const idBuf = new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i)).buffer
  await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: idBuf, transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  })
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/** Devuelve true si el dispositivo tiene biometría disponible */
export async function bioIsAvailable(): Promise<boolean> {
  if (isNative()) return nativeIsAvailable()
  return webIsAvailable()
}

/** Devuelve el DUI guardado para login biométrico, o null si no hay ninguno */
export function bioGetStoredDUI(): string | null {
  return localStorage.getItem('bio_dui')
}

/** Registra la huella para el DUI dado. Lanza si el usuario cancela o no hay lector. */
export async function bioRegister(dui: string): Promise<void> {
  if (isNative()) {
    await nativeVerify('Registrar huella', `Confirma tu huella para activar acceso rápido como ${dui}`)
  } else {
    await webRegister(dui)
  }
  // Guardar el DUI asociado a la huella en este dispositivo
  localStorage.setItem('bio_dui', dui)
}

/** Autentica con huella. Lanza si falla o cancela. */
export async function bioAuthenticate(): Promise<string> {
  const dui = bioGetStoredDUI()
  if (!dui) throw new Error('No hay huella registrada en este dispositivo')
  if (isNative()) {
    await nativeVerify('Acceso con huella', `Verifica tu identidad para ingresar como ${dui}`)
  } else {
    await webAuthenticate(dui)
  }
  return dui  // devuelve el DUI asociado
}

/** Elimina la huella registrada en este dispositivo */
export async function bioDelete(): Promise<void> {
  localStorage.removeItem('bio_dui')
  localStorage.removeItem('usuario_webauthn_id')
  localStorage.removeItem('usuario_webauthn_dui')
  // Limpiar flags legacy
  localStorage.removeItem('bio_native_registered')
  if (isNative()) {
    try {
      const { NativeBiometric } = await import('capacitor-native-biometric')
      await NativeBiometric.deleteCredentials({ server: 'gb.portal.biometric' })
    } catch { /* ignorar si no había nada */ }
  }
}
