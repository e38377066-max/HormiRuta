import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hormiruta.app',
  appName: 'HormiRuta',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: process.env.SERVER_URL || 'https://api.hormiruta.com',
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
