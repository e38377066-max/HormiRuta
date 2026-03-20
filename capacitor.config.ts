import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.area862.app',
  appName: 'Area 862',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    url: 'https://area862system.com'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0f172a'
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
    webContentsDebuggingEnabled: true,
    backgroundColor: '#0f172a'
  },
  ios: {
    contentInset: 'never',
    scrollEnabled: false,
    backgroundColor: '#0f172a'
  }
};

export default config;
