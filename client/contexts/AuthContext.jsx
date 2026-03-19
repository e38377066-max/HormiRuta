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

  const fetchCurrentUser = async () => {
    setInitializing(true)
    try {
      const token = await storageGet(StorageKeys.AUTH_TOKEN)
      if (!token) {
        setUser(null)
        return null
      }
      const response = await api.get('/api/auth/me')
      setUser(response.data.user)
      await storageSet(StorageKeys.USER, JSON.stringify(response.data.user))
      return response.data.user
    } catch (err) {
      const status = err.response?.status
      if (status === 401 || status === 403) {
        setUser(null)
        await storageRemove(StorageKeys.USER)
        await storageRemove(StorageKeys.AUTH_TOKEN)
      } else {
        const stored = await storageGet(StorageKeys.USER)
        if (stored) {
          try {
            setUser(JSON.parse(stored))
          } catch {}
        }
      }
      return null
    } finally {
      setInitializing(false)
    }
  }

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      setInitializing(false)
    }, 6000)

    fetchCurrentUser().finally(() => clearTimeout(safetyTimeout))
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
