import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { MessagingProvider } from './contexts/MessagingContext'
import ErrorBoundary from './components/ErrorBoundary'
import { Capacitor } from '@capacitor/core'
import { initStatusBar } from './utils/capacitor'
import './index.css'

// ─── Inicialización nativa (solo iOS/Android) ─────────────────────────────
if (Capacitor.isNativePlatform()) {
  const initNative = async () => {
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen')
      SplashScreen.hide().catch(() => {})
    } catch {}

    // Usar initStatusBar desde capacitor.js (usa el import estático, sin conflicto)
    await initStatusBar()
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
