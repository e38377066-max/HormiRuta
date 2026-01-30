import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isAuthenticated = !!user
  const isAdmin = user?.role === 'admin'
  const isDriver = user?.role === 'driver'

  const login = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/api/auth/login', { email, password })
      setUser(response.data.user)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      return { success: true, user: response.data.user }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error al iniciar sesion'
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
      localStorage.setItem('user', JSON.stringify(response.data.user))
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
      localStorage.removeItem('user')
    }
  }

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/api/auth/me')
      setUser(response.data.user)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      return response.data.user
    } catch {
      setUser(null)
      localStorage.removeItem('user')
      return null
    }
  }

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const value = {
    user,
    loading,
    error,
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
