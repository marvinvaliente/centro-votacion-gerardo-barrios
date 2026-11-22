import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.alcaldia.centrovotacion.gerardobarrios',
  appName: 'Centro Gerardo Barrios',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1e3a5f',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1e3a5f',
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
}

export default config
