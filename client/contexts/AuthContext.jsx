import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import api from '../api'
import { storageGet, storageSet, storageRemove, StorageKeys } from '../utils/storage'

const AuthContext = createContext(null)

// ─── Lee localStorage de forma síncrona antes del primer render ───
// Esto hace que el usuario ya logueado NUNCA vea el spinner al abrir el app.
const readSync = (key) => {
  try { return localStorage.getItem(key) } catch { return null }
}

const parseSync = (raw) => {
  try { return raw ? JSON.parse(raw) : null } catch { return null }
}

const syncUser  = parseSync(readSync(StorageKeys.USER))
const syncToken = readSync(StorageKeys.AUTH_TOKEN)

export function AuthProvider({ children }) {
  // Si ya hay usuario guardado → arranca autenticado, sin spinner
  const [user, setUser] = useState(syncUser)
  const [initializing, setInitializing] = useState(!syncUser && !!syncToken)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const lastActiveRef    = useRef(Date.now())
  const isValidatingRef  = useRef(false)
  const isLoggedInRef    = useRef(!!syncUser)

  const isAuthenticated = !!user
  const isAdmin  = user?.role === 'admin'
  const isDriver = user?.role === 'driver'

  const clearSession = useCallback(async () => {
    setUser(null)
    isLoggedInRef.current = false
    localStorage.removeItem(StorageKeys.USER)
    localStorage.removeItem(StorageKeys.AUTH_TOKEN)
    await Promise.allSettled([
      storageRemove(StorageKeys.USER),
      storageRemove(StorageKeys.AUTH_TOKEN),
    ])
  }, [])

  // ─── Login ─────────────────────────────────────────────────────
  const login = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/login', { email, password })
      const { user: u, token } = res.data
      setUser(u)
      isLoggedInRef.current = true
      localStorage.setItem(StorageKeys.USER, JSON.stringify(u))
      if (token) localStorage.setItem(StorageKeys.AUTH_TOKEN, token)
      // Guardar en Preferences también (persistencia extra en iOS)
      await Promise.allSettled([
        storageSet(StorageKeys.USER, JSON.stringify(u)),
        token ? storageSet(StorageKeys.AUTH_TOKEN, token) : Promise.resolve(),
      ])
      return { success: true, user: u }
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

  // ─── Register ──────────────────────────────────────────────────
  const register = async (userData) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/register', userData)
      const { user: u, token } = res.data
      setUser(u)
      isLoggedInRef.current = true
      localStorage.setItem(StorageKeys.USER, JSON.stringify(u))
      if (token) localStorage.setItem(StorageKeys.AUTH_TOKEN, token)
      await Promise.allSettled([
        storageSet(StorageKeys.USER, JSON.stringify(u)),
        token ? storageSet(StorageKeys.AUTH_TOKEN, token) : Promise.resolve(),
      ])
      return { success: true, user: u }
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al registrar'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  // ─── Logout ────────────────────────────────────────────────────
  const logout = async () => {
    try { await api.post('/api/auth/logout') } catch {}
    await clearSession()
  }

  // ─── Validación silenciosa al montar ──────────────────────────
  // Solo corre si hay token pero NO había usuario en caché (caso raro).
  // Si había usuario en caché, valida de todas formas pero sin bloquear UI.
  useEffect(() => {
    let cancelled = false

    const validate = async () => {
      // Si no hay token no hay nada que validar
      const token = syncToken || await storageGet(StorageKeys.AUTH_TOKEN)
      if (!token) {
        setInitializing(false)
        return
      }

      try {
        const res = await api.get('/api/auth/me')
        const freshUser = res.data.user
        if (!cancelled) {
          setUser(freshUser)
          isLoggedInRef.current = true
          localStorage.setItem(StorageKeys.USER, JSON.stringify(freshUser))
          storageSet(StorageKeys.USER, JSON.stringify(freshUser)).catch(() => {})
        }
      } catch (err) {
        const status = err.response?.status
        // Solo cerrar sesión si el servidor dice explícitamente que el token no vale
        // Y solo si NO teníamos usuario en caché (para no desloguear al driver sin conexión)
        if ((status === 401 || status === 403) && !syncUser && !cancelled) {
          await clearSession()
        }
        // Con error de red o cualquier otro error → mantener sesión
      } finally {
        if (!cancelled) setInitializing(false)
      }
    }

    validate()
    return () => { cancelled = true }
  }, [])

  // ─── Revalidar cuando app vuelve del fondo (solo nativo) ──────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let listener = null

    const setup = async () => {
      try {
        const { App } = await import('@capacitor/app')
        listener = await App.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive) {
            lastActiveRef.current = Date.now()
            return
          }
          lastActiveRef.current = Date.now()

          // Solo revalida si lleva más de 5 minutos en background
          const elapsed = Date.now() - lastActiveRef.current
          if (!isLoggedInRef.current || elapsed < 5 * 60 * 1000 || isValidatingRef.current) return

          isValidatingRef.current = true
          try {
            const token = await storageGet(StorageKeys.AUTH_TOKEN)
            if (!token) return
            const res = await api.get('/api/auth/me')
            const freshUser = res.data.user
            setUser(freshUser)
            localStorage.setItem(StorageKeys.USER, JSON.stringify(freshUser))
            storageSet(StorageKeys.USER, JSON.stringify(freshUser)).catch(() => {})
          } catch {
            // Error de red o servidor → mantener sesión, NO cerrar
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

  // ─── Interceptor 401 para llamadas activas ─────────────────────
  // Si una llamada de API (no auth) devuelve 401 → cerrar sesión
  useEffect(() => {
    const id = api.interceptors.response.use(
      res => res,
      async err => {
        const status = err.response?.status
        const url = err.config?.url || ''
        if ((status === 401 || status === 403) && !url.includes('/api/auth/') && isLoggedInRef.current) {
          await clearSession()
        }
        return Promise.reject(err)
      }
    )
    return () => api.interceptors.response.eject(id)
  }, [clearSession])

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
