import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { MessagingProvider } from './contexts/MessagingContext'
import ErrorBoundary from './components/ErrorBoundary'
import { Capacitor } from '@capacitor/core'
import './index.css'

// ─── Inicialización nativa (solo iOS/Android) ─────────────────────────────
if (Capacitor.isNativePlatform()) {
  const initNative = async () => {
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen')
      SplashScreen.hide().catch(() => {})
    } catch {}

    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar')
      // Íconos blancos sobre fondo oscuro
      await StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
      // Fondo oscuro bajo la barra de estado (Android)
      await StatusBar.setBackgroundColor({ color: '#0f172a' }).catch(() => {})
      // La webview ocupa toda la pantalla incluido el área del status bar
      await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
    } catch {}
  }

  initNative()
} else {
  // En web, solo ocultar splash si existe
  import('@capacitor/splash-screen').then(({ SplashScreen }) => {
    SplashScreen.hide().catch(() => {})
  }).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <MessagingProvider>
            <App />
          </MessagingProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
