import { defineStore } from 'pinia'
import { api } from 'src/boot/axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    loading: false,
    error: null
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    currentUser: (state) => state.user,
    isAdmin: (state) => state.user?.role === 'admin',
    isDriver: (state) => state.user?.role === 'driver',
    userRole: (state) => state.user?.role || 'client'
  },

  actions: {
    async register(userData) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post('/api/auth/register', userData)
        this.user = response.data.user
        localStorage.setItem('user', JSON.stringify(this.user))
        return { success: true, user: this.user }
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al registrar'
        return { success: false, error: this.error }
      } finally {
        this.loading = false
      }
    },

    async login(email, password) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post('/api/auth/login', { email, password })
        this.user = response.data.user
        localStorage.setItem('user', JSON.stringify(this.user))
        return { success: true, user: this.user }
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al iniciar sesión'
        return { success: false, error: this.error }
      } finally {
        this.loading = false
      }
    },

    async logout() {
      try {
        await api.post('/api/auth/logout')
      } catch (error) {
        console.error('Error en logout:', error)
      } finally {
        this.user = null
        localStorage.removeItem('user')
      }
    },

    async fetchCurrentUser() {
      try {
        const response = await api.get('/api/auth/me')
        this.user = response.data.user
        localStorage.setItem('user', JSON.stringify(this.user))
        return this.user
      } catch {
        this.user = null
        localStorage.removeItem('user')
        return null
      }
    },

    async updateUser(userData) {
      this.loading = true
      try {
        const response = await api.put('/api/auth/update', userData)
        this.user = response.data.user
        localStorage.setItem('user', JSON.stringify(this.user))
        return { success: true, user: this.user }
      } catch (error) {
        return { success: false, error: error.response?.data?.error || 'Error al actualizar' }
      } finally {
        this.loading = false
      }
    },

    loginWithGoogle() {
      const baseUrl = window.location.origin
      window.location.href = `${baseUrl}/api/auth/google/login`
    }
  }
})
