/**
 * @fileoverview Proveedor de contexto para la autenticación de usuarios.
 * Gestiona el estado de la sesión, persistencia en almacenamiento local y validación con el backend.
 */

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import api from '../api'
import { storageGet, storageSet, storageRemove, StorageKeys } from '../utils/storage'

/**
 * Contexto de autenticación.
 * @type {React.Context}
 */
const AuthContext = createContext(null)

/**
 * Intenta parsear una cadena JSON de forma segura.
 * @param {string|null} raw - Cadena JSON a parsear.
 * @returns {Object|null} Objeto parseado o null si falla.
 */
const tryParse = (raw) => {
  try { return raw ? JSON.parse(raw) : null } catch { return null }
}

// ─── Lectura síncrona al cargar el módulo ─────────────────────────────────
// storageGet es síncrono (localStorage), así que esto ocurre ANTES del primer render.
// Usuario ya logueado → cero pantalla de carga, abre directo.
const cachedUser  = tryParse(storageGet(StorageKeys.USER))
const cachedToken = storageGet(StorageKeys.AUTH_TOKEN)

/**
 * Proveedor que envuelve la aplicación para proveer el estado de autenticación.
 * @param {Object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Componentes hijos.
 * @returns {JSX.Element}
 */
export function AuthProvider({ children }) {
  /** @type {[Object|null, Function]} Estado del usuario actual */
  const [user,         setUser]         = useState(cachedUser)
  /** @type {[boolean, Function]} Indica si se está inicializando/validando la sesión */
  const [initializing, setInitializing] = useState(!cachedUser && !!cachedToken)
  /** @type {[boolean, Function]} Indica si hay una operación de carga en curso (login/register) */
  const [loading,      setLoading]      = useState(false)
  /** @type {[string|null, Function]} Mensaje de error de la última operación */
  const [error,        setError]        = useState(null)

  /** @type {React.MutableRefObject<number>} Marca de tiempo de la última actividad del usuario */
  const lastActiveRef   = useRef(Date.now())
  /** @type {React.MutableRefObject<boolean>} Indica si hay una validación de token en curso */
  const isValidatingRef = useRef(false)
  /** @type {React.MutableRefObject<boolean>} Referencia mutable del estado de autenticación */
  const isLoggedInRef   = useRef(!!cachedUser)

  /** @type {boolean} Indica si el usuario está autenticado */
  const isAuthenticated = !!user
  /** @type {boolean} Indica si el usuario tiene rol de administrador */
  const isAdmin         = user?.role === 'admin'
  /** @type {boolean} Indica si el usuario tiene rol de repartidor */
  const isDriver        = user?.role === 'driver'

  /**
   * Limpia los datos de la sesión del estado y del almacenamiento local.
   */
  const clearSession = useCallback(() => {
    setUser(null)
    isLoggedInRef.current = false
    storageRemove(StorageKeys.USER)
    storageRemove(StorageKeys.AUTH_TOKEN)
  }, [])

  /**
   * Guarda los datos de la sesión en el estado y en el almacenamiento local.
   * @param {Object} u - Datos del usuario.
   * @param {string} [token] - Token JWT.
   */
  const saveSession = useCallback((u, token) => {
    setUser(u)
    isLoggedInRef.current = true
    storageSet(StorageKeys.USER, JSON.stringify(u))
    if (token) storageSet(StorageKeys.AUTH_TOKEN, token)
  }, [])

  /**
   * Inicia sesión con correo y contraseña.
   * @async
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
   */
  const login = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/login', { email, password })
      saveSession(res.data.user, res.data.token)
      return { success: true, user: res.data.user }
    } catch (err) {
      let msg = err.response?.data?.error || ''
      if (!msg) {
        if (err.friendlyMessage) {
          msg = err.friendlyMessage
        } else if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || err.isTimeout) {
          msg = 'No se pudo conectar al servidor. Verifica tu conexión a internet.'
        } else {
          msg = `${err.message} [${err.code || 'UNKNOWN'}]`
        }
      }
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Registra un nuevo usuario.
   * @async
   * @param {Object} userData - Datos del usuario a registrar.
   * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
   */
  const register = async (userData) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/register', userData)
      saveSession(res.data.user, res.data.token)
      return { success: true, user: res.data.user }
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al registrar'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Cierra la sesión del usuario actual.
   * @async
   */
  const logout = async () => {
    try { await api.post('/api/auth/logout') } catch {}
    clearSession()
  }

  /**
   * Elimina la cuenta del usuario autenticado.
   * Cumple con las directrices de la Apple App Store 5.1.1(v).
   * @async
   */
  const deleteAccount = async () => {
    await api.delete('/api/auth/account')
    clearSession()
  }

  // ─── Validación silenciosa al montar ──────────────────────────────────
  // Si hay token → valida con servidor en segundo plano sin bloquear la UI.
  // Si el usuario ya está en caché, la app ya está visible mientras esto corre.
  useEffect(() => {
    let cancelled = false
    if (!cachedToken) { setInitializing(false); return }

    api.get('/api/auth/me')
      .then(res => {
        if (cancelled) return
        const freshUser = res.data.user
        setUser(freshUser)
        isLoggedInRef.current = true
        storageSet(StorageKeys.USER, JSON.stringify(freshUser))
      })
      .catch(err => {
        if (cancelled) return
        const status = err.response?.status
        // Solo cerrar sesión si el servidor dice explícitamente que el token es inválido
        // Y no había usuario en caché (para no desloguear al driver sin wifi)
        if ((status === 401 || status === 403) && !cachedUser) {
          clearSession()
        }
        // Con error de red → mantener sesión
      })
      .finally(() => { if (!cancelled) setInitializing(false) })

    return () => { cancelled = true }
  }, [])

  // ─── Revalidar cuando app vuelve del fondo (solo iOS/Android) ─────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let listener = null
    let cancelled = false
    let retryTimer = null

    const setup = async (attempt = 0) => {
      if (cancelled) return
      try {
        const { App } = await import('@capacitor/app')
        listener = await App.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive) { lastActiveRef.current = Date.now(); return }

          const elapsed = Date.now() - lastActiveRef.current
          lastActiveRef.current = Date.now()

          // Solo revalida si lleva más de 5 minutos en fondo
          if (!isLoggedInRef.current || elapsed < 5 * 60 * 1000 || isValidatingRef.current) return

          isValidatingRef.current = true
          try {
            const token = storageGet(StorageKeys.AUTH_TOKEN)
            if (!token) return
            const res = await api.get('/api/auth/me')
            const freshUser = res.data.user
            setUser(freshUser)
            storageSet(StorageKeys.USER, JSON.stringify(freshUser))
          } catch {
            // Error de red → mantener sesión, no cerrar
          } finally {
            isValidatingRef.current = false
          }
        })
      } catch {
        // El bridge de Capacitor puede no estar listo al primer render.
        // Reintentamos hasta 3 veces con backoff antes de desistir.
        if (attempt < 3 && !cancelled) {
          retryTimer = setTimeout(() => setup(attempt + 1), 1000 * (attempt + 1))
        }
      }
    }

    // Pequeña demora inicial para dejar que el bridge de Capacitor termine de inicializarse
    retryTimer = setTimeout(() => setup(0), 500)

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
      if (listener) listener.remove().catch(() => {})
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      user, loading, error, initializing,
      isAuthenticated, isAdmin, isDriver,
      login, register, logout, deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook para acceder al contexto de autenticación.
 * @returns {Object} Datos y funciones de autenticación.
 * @throws {Error} Si se usa fuera de un AuthProvider.
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
