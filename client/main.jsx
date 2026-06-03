import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { MessagingProvider } from './contexts/MessagingContext'
import ErrorBoundary from './components/ErrorBoundary'
import { Capacitor } from '@capacitor/core'
import { initStatusBar } from './utils/capacitor'
import './i18n/index.js'
import './index.css'

// Suppress Google Maps JS deprecation warnings (APIs still functional)
;(function suppressGoogleMapsDeprecationWarnings() {
  const _warn = console.warn.bind(console)
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('google.maps') &&
      (args[0].includes('deprecated') || args[0].includes('Deprecated'))
    ) {
      return
    }
    _warn(...args)
  }
})()

// ─── Inicialización nativa (solo iOS/Android) ─────────────────────────────
if (Capacitor.isNativePlatform()) {
  const initNative = async () => {
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen')
      SplashScreen.hide().catch(() => {})
    } catch {}

    await initStatusBar()
  }

  initNative()
} else {
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
