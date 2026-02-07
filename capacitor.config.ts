import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.area862.app',
  appName: 'Area 862',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: process.env.SERVER_URL || 'https://api.area862.com',
    cleartext: true
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
