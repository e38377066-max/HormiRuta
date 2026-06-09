/**
 * @fileoverview Punto de entrada principal de la aplicación React.
 * Configura los proveedores de contexto, el enrutador y la inicialización de la plataforma nativa.
 */

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

/**
 * Suprime las advertencias de depreciación de Google Maps JS en la consola.
 * Las APIs siguen siendo funcionales, pero generan ruido innecesario.
 */
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

/**
 * Inicialización de funciones nativas cuando se ejecuta en iOS o Android.
 * Maneja la ocultación de la pantalla de carga (Splash Screen) y la configuración de la barra de estado.
 */
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
  // En plataformas web, intentamos ocultar el Splash Screen si está presente
  import('@capacitor/splash-screen').then(({ SplashScreen }) => {
    SplashScreen.hide().catch(() => {})
  }).catch(() => {})
}

// Renderizado de la aplicación en el elemento raíz del DOM
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
