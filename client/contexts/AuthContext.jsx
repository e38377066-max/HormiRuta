import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import api from '../api'
import { storageGet, storageSet, storageRemove, StorageKeys } from '../utils/storage'

const AuthContext = createContext(null)

const tryParse = (raw) => {
  try { return raw ? JSON.parse(raw) : null } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const lastActiveRef = useRef(Date.now())
  const isValidatingRef = useRef(false)
  const isLoggedInRef = useRef(false)

  const isAuthenticated = !!user
  const isAdmin = user?.role === 'admin'
  const isDriver = user?.role === 'driver'

  const clearSession = useCallback(async () => {
    setUser(null)
    isLoggedInRef.current = false
    await Promise.all([
      storageRemove(StorageKeys.USER),
      storageRemove(StorageKeys.AUTH_TOKEN),
    ])
  }, [])

  const login = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/api/auth/login', { email, password })
      const { user: loggedUser, token } = response.data
      setUser(loggedUser)
      isLoggedInRef.current = true
      await Promise.all([
        storageSet(StorageKeys.USER, JSON.stringify(loggedUser)),
        token ? storageSet(StorageKeys.AUTH_TOKEN, token) : Promise.resolve(),
      ])
      return { success: true, user: loggedUser }
    } catch (err) {
      let errorMsg = err.response?.data?.error || ''
      if (!errorMsg) {
        errorMsg = err.code === 'ERR_NETWORK'
          ? 'No se pudo conectar al servidor. Verifica tu conexión.'
          : `${err.message} [${err.code || 'UNKNOWN'}]`
      }
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }

  const register = async (userData) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/api/auth/register', userData)
      const { user: newUser, token } = response.data
      setUser(newUser)
      isLoggedInRef.current = true
      await Promise.all([
        storageSet(StorageKeys.USER, JSON.stringify(newUser)),
        token ? storageSet(StorageKeys.AUTH_TOKEN, token) : Promise.resolve(),
      ])
      return { success: true, user: newUser }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error al registrar'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try { await api.post('/api/auth/logout') } catch {}
    await clearSession()
  }

  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      try {
        const [token, storedUserRaw] = await Promise.all([
          storageGet(StorageKeys.AUTH_TOKEN),
          storageGet(StorageKeys.USER),
        ])

        const storedUser = tryParse(storedUserRaw)

        if (!token && !storedUser) {
          if (!cancelled) {
            setUser(null)
            setInitializing(false)
          }
          return
        }

        if (storedUser) {
          if (!cancelled) {
            setUser(storedUser)
            isLoggedInRef.current = true
            setInitializing(false)
          }
        }

        if (token) {
          try {
            const response = await api.get('/api/auth/me')
            const freshUser = response.data.user
            if (!cancelled) {
              setUser(freshUser)
              isLoggedInRef.current = true
              await storageSet(StorageKeys.USER, JSON.stringify(freshUser))
            }
          } catch (err) {
            const status = err.response?.status
            if ((status === 401 || status === 403) && !storedUser) {
              if (!cancelled) await clearSession()
            }
          }
        }

        if (!cancelled && !storedUser) {
          setInitializing(false)
        }
      } catch {
        if (!cancelled) setInitializing(false)
      }
    }

    const safetyTimer = setTimeout(() => {
      if (!cancelled) setInitializing(false)
    }, 10000)

    initialize().finally(() => clearTimeout(safetyTimer))

    return () => { cancelled = true }
  }, [])

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

          const elapsed = Date.now() - lastActiveRef.current
          lastActiveRef.current = Date.now()

          if (!isLoggedInRef.current || elapsed < 60 * 1000 || isValidatingRef.current) return

          isValidatingRef.current = true
          try {
            const token = await storageGet(StorageKeys.AUTH_TOKEN)
            if (!token) return

            const response = await api.get('/api/auth/me')
            const freshUser = response.data.user
            setUser(freshUser)
            await storageSet(StorageKeys.USER, JSON.stringify(freshUser))
          } catch {
            // Red cayó o servidor no respondió — NO cerrar sesión
          } finally {
            isValidatingRef.current = false
          }
        })
      } catch (err) {
        console.error('[Auth] Error configurando listener de estado:', err)
      }
    }

    setup()
    return () => { if (listener) listener.remove().catch(() => {}) }
  }, [])

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      res => res,
      async err => {
        const status = err.response?.status
        const url = err.config?.url || ''
        const isAuthEndpoint = url.includes('/api/auth/')

        if ((status === 401 || status === 403) && !isAuthEndpoint && isLoggedInRef.current) {
          await clearSession()
        }

        return Promise.reject(err)
      }
    )
    return () => api.interceptors.response.eject(interceptor)
  }, [clearSession])

  const value = {
    user,
    loading,
    error,
    initializing,
    isAuthenticated,
    isAdmin,
    isDriver,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
