import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import api from '../api'
import { storageGet, storageSet, storageRemove, StorageKeys } from '../utils/storage'

const AuthContext = createContext(null)

const tryParse = (raw) => {
  try { return raw ? JSON.parse(raw) : null } catch { return null }
}

// ─── Lectura síncrona al cargar el módulo ─────────────────────────────────
// storageGet es síncrono (localStorage), así que esto ocurre ANTES del primer render.
// Usuario ya logueado → cero pantalla de carga, abre directo.
const cachedUser  = tryParse(storageGet(StorageKeys.USER))
const cachedToken = storageGet(StorageKeys.AUTH_TOKEN)

export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(cachedUser)
  const [initializing, setInitializing] = useState(!cachedUser && !!cachedToken)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)

  const lastActiveRef   = useRef(Date.now())
  const isValidatingRef = useRef(false)
  const isLoggedInRef   = useRef(!!cachedUser)

  const isAuthenticated = !!user
  const isAdmin         = user?.role === 'admin'
  const isDriver        = user?.role === 'driver'

  // ─── Limpiar sesión ────────────────────────────────────────────────────
  const clearSession = useCallback(() => {
    setUser(null)
    isLoggedInRef.current = false
    storageRemove(StorageKeys.USER)
    storageRemove(StorageKeys.AUTH_TOKEN)
  }, [])

  // ─── Guardar sesión ────────────────────────────────────────────────────
  const saveSession = useCallback((u, token) => {
    setUser(u)
    isLoggedInRef.current = true
    storageSet(StorageKeys.USER, JSON.stringify(u))
    if (token) storageSet(StorageKeys.AUTH_TOKEN, token)
  }, [])

  // ─── Login ─────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/login', { email, password })
      saveSession(res.data.user, res.data.token)
      return { success: true, user: res.data.user }
    } catch (err) {
      let msg = err.response?.data?.error || ''
      if (!msg) msg = err.code === 'ERR_NETWORK'
        ? 'No se pudo conectar al servidor. Verifica tu conexión.'
        : `${err.message} [${err.code || 'UNKNOWN'}]`
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  // ─── Register ──────────────────────────────────────────────────────────
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

  // ─── Logout ────────────────────────────────────────────────────────────
  const logout = async () => {
    try { await api.post('/api/auth/logout') } catch {}
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
    const setup = async () => {
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
      } catch (err) {
        console.error('[Auth] Error configurando listener:', err)
      }
    }

    setup()
    return () => { if (listener) listener.remove().catch(() => {}) }
  }, [])

  // No hay interceptor de 401 global.
  // La sesión solo se cierra con logout() explícito del usuario.
  // Los errores 401 en rutas individuales no cierran la sesión.

  return (
    <AuthContext.Provider value={{
      user, loading, error, initializing,
      isAuthenticated, isAdmin, isDriver,
      login, register, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
