import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/privacidad': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/soporte': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/support': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      external: ['@capacitor/app'],
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-capacitor': [
            '@capacitor/core',
            '@capacitor/geolocation',
            '@capacitor/camera',
            '@capacitor/haptics',
            '@capacitor/status-bar',
            '@capacitor/preferences',
            '@capacitor-community/keep-awake'
          ],
          'vendor-maps': ['@googlemaps/js-api-loader'],
          'vendor-misc': ['axios', 'xlsx', 'uuid']
        }
      }
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
})
