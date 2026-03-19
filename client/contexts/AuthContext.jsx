import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import api from '../api'
import { storageGet, storageSet, storageRemove, StorageKeys } from '../utils/storage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const lastActiveRef = useRef(Date.now())
  const isValidatingRef = useRef(false)

  const isAuthenticated = !!user
  const isAdmin = user?.role === 'admin'
  const isDriver = user?.role === 'driver'

  const login = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/api/auth/login', { email, password })
      setUser(response.data.user)
      await storageSet(StorageKeys.USER, JSON.stringify(response.data.user))
      if (response.data.token) {
        await storageSet(StorageKeys.AUTH_TOKEN, response.data.token)
      }
      return { success: true, user: response.data.user }
    } catch (err) {
      let errorMsg = err.response?.data?.error || ''
      if (!errorMsg) {
        if (err.code === 'ERR_NETWORK') {
          errorMsg = `No se pudo conectar al servidor: ${api.defaults.baseURL || 'local'} - Verifica tu conexión a internet`
        } else {
          errorMsg = `${err.message} [${err.code || 'UNKNOWN'}]`
        }
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
      setUser(response.data.user)
      await storageSet(StorageKeys.USER, JSON.stringify(response.data.user))
      if (response.data.token) {
        await storageSet(StorageKeys.AUTH_TOKEN, response.data.token)
      }
      return { success: true, user: response.data.user }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error al registrar'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch (err) {
      console.error('Error en logout:', err)
    } finally {
      setUser(null)
      await storageRemove(StorageKeys.USER)
      await storageRemove(StorageKeys.AUTH_TOKEN)
    }
  }

  const fetchCurrentUser = async (silent = false) => {
    if (!silent) setInitializing(true)

    try {
      const [token, storedUserRaw] = await Promise.all([
        storageGet(StorageKeys.AUTH_TOKEN),
        storageGet(StorageKeys.USER)
      ])

      const storedUser = storedUserRaw ? (() => {
        try { return JSON.parse(storedUserRaw) } catch { return null }
      })() : null

      if (!token && !storedUser) {
        setUser(null)
        return null
      }

      if (!token && storedUser) {
        setUser(storedUser)
        if (!silent) setInitializing(false)
        return storedUser
      }

      try {
        const response = await api.get('/api/auth/me')
        const freshUser = response.data.user
        setUser(freshUser)
        await storageSet(StorageKeys.USER, JSON.stringify(freshUser))
        return freshUser
      } catch (err) {
        const status = err.response?.status
        if (status === 401 || status === 403) {
          setUser(null)
          await storageRemove(StorageKeys.USER)
          await storageRemove(StorageKeys.AUTH_TOKEN)
          return null
        }
        if (storedUser) {
          setUser(storedUser)
          return storedUser
        }
        return null
      }
    } finally {
      if (!silent) setInitializing(false)
    }
  }

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      setInitializing(false)
    }, 8000)

    fetchCurrentUser().finally(() => clearTimeout(safetyTimeout))
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let appListener = null

    const setupAppStateListener = async () => {
      try {
        const { App } = await import('@capacitor/app')
        appListener = await App.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            const now = Date.now()
            const elapsed = now - lastActiveRef.current

            if (elapsed > 30 * 1000 && !isValidatingRef.current) {
              isValidatingRef.current = true
              try {
                await fetchCurrentUser(true)
              } finally {
                isValidatingRef.current = false
              }
            }
            lastActiveRef.current = now
          } else {
            lastActiveRef.current = Date.now()
          }
        })
      } catch (err) {
        console.error('[Auth] Error configurando app state listener:', err)
      }
    }

    setupAppStateListener()

    return () => {
      if (appListener) {
        appListener.remove().catch(() => {})
      }
    }
  }, [])

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
    fetchCurrentUser
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
