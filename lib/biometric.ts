/**
 * Biometric abstraction — Capacitor (Android/iOS) + Web fallback
 *
 * On native (Capacitor): uses capacitor-native-biometric (Android Keystore)
 * On web (browser): uses WebAuthn platform authenticator
 */

import { Capacitor } from '@capacitor/core'

const SERVER_KEY = 'gb.portal.biometric'

/** True when running inside a Capacitor native shell */
function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

// ─── NATIVE (Capacitor → Android Keystore) ───────────────────────────────────

async function nativeIsAvailable(): Promise<boolean> {
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric')
    const result = await NativeBiometric.isAvailable()
    return result.isAvailable
  } catch {
    return false
  }
}

async function nativeRegister(dui: string): Promise<void> {
  const { NativeBiometric } = await import('capacitor-native-biometric')
  // Store credential first, then verify with biometric
  await NativeBiometric.setCredentials({
    username: dui,
    password: 'gb_bio_ok',
    server: SERVER_KEY,
  })
  await NativeBiometric.verifyIdentity({
    reason: 'Confirma tu huella para activar el acceso biométrico',
    title: 'Registrar huella',
    subtitle: 'Portal GB',
    description: dui,
  })
}

async function nativeAuthenticate(dui: string): Promise<boolean> {
  const { NativeBiometric } = await import('capacitor-native-biometric')
  await NativeBiometric.verifyIdentity({
    reason: 'Verifica tu identidad para ingresar',
    title: 'Acceso con huella',
    subtitle: 'Portal GB',
    description: dui,
  })
  const creds = await NativeBiometric.getCredentials({ server: SERVER_KEY })
  return creds.username === dui && creds.password === 'gb_bio_ok'
}

async function nativeDelete(): Promise<void> {
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric')
    await NativeBiometric.deleteCredentials({ server: SERVER_KEY })
  } catch {
    // ignore if not registered
  }
}

// ─── WEB (WebAuthn) ──────────────────────────────────────────────────────────

function webIsAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (!window.PublicKeyCredential) return Promise.resolve(false)
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

async function webAuthenticate(dui: string): Promise<boolean> {
  const idStr = localStorage.getItem('usuario_webauthn_id')
  const duiGuardado = localStorage.getItem('usuario_webauthn_dui')
  if (!idStr || duiGuardado !== dui) return false
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
  return true
}

function webDelete() {
  localStorage.removeItem('usuario_webauthn_id')
  localStorage.removeItem('usuario_webauthn_dui')
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export async function bioIsAvailable(): Promise<boolean> {
  if (isNative()) return nativeIsAvailable()
  return webIsAvailable()
}

export function bioIsRegistered(dui: string): boolean {
  if (isNative()) {
    return localStorage.getItem('bio_native_registered') === dui
  }
  return localStorage.getItem('usuario_webauthn_dui') === dui
}

/**
 * Register biometrics for the given DUI.
 * Throws on failure; caller handles error display.
 */
export async function bioRegister(dui: string): Promise<void> {
  if (isNative()) {
    await nativeRegister(dui)
    localStorage.setItem('bio_native_registered', dui)
  } else {
    await webRegister(dui)
  }
}

/** Authenticate. Returns true on success. Throws on failure or cancel. */
export async function bioAuthenticate(dui: string): Promise<boolean> {
  if (isNative()) return nativeAuthenticate(dui)
  return webAuthenticate(dui)
}

/** Remove stored biometric credential. */
export async function bioDelete(dui: string): Promise<void> {
  if (isNative()) {
    await nativeDelete()
    localStorage.removeItem('bio_native_registered')
  } else {
    webDelete()
  }
}

/** Debug: returns current platform info */
export function bioDebugInfo(): string {
  return `native=${isNative()} platform=${Capacitor.getPlatform()}`
}
