import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hormiruta.app',
  appName: 'HormiRuta',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
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
    }
  }
};

export default config;
