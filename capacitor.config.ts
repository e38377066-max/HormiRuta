import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.VITE_API_URL || '';

const config: CapacitorConfig = {
  appId: 'com.area862.app',
  appName: 'Area 862',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    ...(serverUrl ? { url: serverUrl } : {})
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0d1b2a',
      showSpinner: false
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0d1b2a'
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    Camera: {
      presentationStyle: 'fullscreen'
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: false
  }
};

export default config;
