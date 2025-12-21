import { defineStore } from 'pinia'
import { api } from 'src/boot/axios'

export const useRouteStore = defineStore('route', {
  state: () => ({
    routes: [],
    currentRoute: null,
    history: [],
    loading: false,
    error: null
  }),

  getters: {
    activeRoutes: (state) => state.routes.filter(r => r.status !== 'completed'),
    completedRoutes: (state) => state.routes.filter(r => r.status === 'completed'),
    pendingStops: (state) => {
      if (!state.currentRoute) return []
      return state.currentRoute.stops.filter(s => s.status === 'pending')
    },
    completedStops: (state) => {
      if (!state.currentRoute) return []
      return state.currentRoute.stops.filter(s => s.status === 'completed')
    }
  },

  actions: {
    async fetchRoutes() {
      this.loading = true
      this.error = null
      try {
        const response = await api.get('/routes')
        this.routes = response.data.routes
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al cargar rutas'
        throw error
      } finally {
        this.loading = false
      }
    },

    async fetchRoute(routeId) {
      this.loading = true
      this.error = null
      try {
        const response = await api.get(`/routes/${routeId}`)
        this.currentRoute = response.data.route
        return this.currentRoute
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al cargar ruta'
        throw error
      } finally {
        this.loading = false
      }
    },

    async createRoute(routeData) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post('/routes', routeData)
        this.routes.unshift(response.data.route)
        this.currentRoute = response.data.route
        return response.data.route
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al crear ruta'
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateRoute(routeId, data) {
      this.loading = true
      this.error = null
      try {
        const response = await api.put(`/routes/${routeId}`, data)
        const index = this.routes.findIndex(r => r.id === routeId)
        if (index !== -1) {
          this.routes[index] = response.data.route
        }
        if (this.currentRoute?.id === routeId) {
          this.currentRoute = response.data.route
        }
        return response.data.route
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al actualizar ruta'
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteRoute(routeId) {
      this.loading = true
      this.error = null
      try {
        await api.delete(`/routes/${routeId}`)
        this.routes = this.routes.filter(r => r.id !== routeId)
        if (this.currentRoute?.id === routeId) {
          this.currentRoute = null
        }
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al eliminar ruta'
        throw error
      } finally {
        this.loading = false
      }
    },

    async addStop(routeId, stopData) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post(`/routes/${routeId}/stops`, stopData)
        if (this.currentRoute?.id === routeId) {
          this.currentRoute.stops.push(response.data.stop)
        }
        return response.data.stop
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al agregar parada'
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateStop(stopId, data) {
      this.loading = true
      this.error = null
      try {
        const response = await api.put(`/stops/${stopId}`, data)
        if (this.currentRoute) {
          const index = this.currentRoute.stops.findIndex(s => s.id === stopId)
          if (index !== -1) {
            this.currentRoute.stops[index] = response.data.stop
          }
        }
        return response.data.stop
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al actualizar parada'
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteStop(stopId) {
      this.loading = true
      this.error = null
      try {
        await api.delete(`/stops/${stopId}`)
        if (this.currentRoute) {
          this.currentRoute.stops = this.currentRoute.stops.filter(s => s.id !== stopId)
        }
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al eliminar parada'
        throw error
      } finally {
        this.loading = false
      }
    },

    async reorderStops(routeId, stopOrder) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post(`/routes/${routeId}/reorder`, { stop_order: stopOrder })
        if (this.currentRoute?.id === routeId) {
          this.currentRoute = response.data.route
        }
        return response.data.route
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al reordenar paradas'
        throw error
      } finally {
        this.loading = false
      }
    },

    async optimizeRoute(routeId, options = {}) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post(`/routes/${routeId}/optimize`, options)
        if (this.currentRoute?.id === routeId) {
          this.currentRoute = response.data.route
        }
        const index = this.routes.findIndex(r => r.id === routeId)
        if (index !== -1) {
          this.routes[index] = response.data.route
        }
        return response.data
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al optimizar ruta'
        throw error
      } finally {
        this.loading = false
      }
    },

    async startRoute(routeId) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post(`/routes/${routeId}/start`)
        if (this.currentRoute?.id === routeId) {
          this.currentRoute = response.data.route
        }
        return response.data.route
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al iniciar ruta'
        throw error
      } finally {
        this.loading = false
      }
    },

    async completeRoute(routeId) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post(`/routes/${routeId}/complete`)
        if (this.currentRoute?.id === routeId) {
          this.currentRoute = response.data.route
        }
        return response.data
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al completar ruta'
        throw error
      } finally {
        this.loading = false
      }
    },

    async completeStop(stopId, data = {}) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post(`/stops/${stopId}/complete`, data)
        if (this.currentRoute) {
          const index = this.currentRoute.stops.findIndex(s => s.id === stopId)
          if (index !== -1) {
            this.currentRoute.stops[index] = response.data.stop
          }
        }
        return response.data.stop
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al completar parada'
        throw error
      } finally {
        this.loading = false
      }
    },

    async failStop(stopId, reason, data = {}) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post(`/stops/${stopId}/fail`, { reason, ...data })
        if (this.currentRoute) {
          const index = this.currentRoute.stops.findIndex(s => s.id === stopId)
          if (index !== -1) {
            this.currentRoute.stops[index] = response.data.stop
          }
        }
        return response.data.stop
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al marcar parada fallida'
        throw error
      } finally {
        this.loading = false
      }
    },

    async importCSV(routeId, csvContent) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post(`/routes/${routeId}/import-csv`, { csv_content: csvContent })
        if (this.currentRoute?.id === routeId) {
          this.currentRoute = response.data.route
        }
        return response.data
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al importar CSV'
        throw error
      } finally {
        this.loading = false
      }
    },

    async importText(routeId, text) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post(`/routes/${routeId}/import-text`, { text })
        if (this.currentRoute?.id === routeId) {
          this.currentRoute = response.data.route
        }
        return response.data
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al importar texto'
        throw error
      } finally {
        this.loading = false
      }
    },

    async fetchHistory(page = 1) {
      this.loading = true
      this.error = null
      try {
        const response = await api.get('/history', { params: { page } })
        this.history = response.data.history
        return response.data
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al cargar historial'
        throw error
      } finally {
        this.loading = false
      }
    },

    async getDirections(routeId) {
      this.loading = true
      this.error = null
      try {
        const response = await api.get(`/routes/${routeId}/directions`)
        return response.data.directions
      } catch (error) {
        this.error = error.response?.data?.error || 'Error al obtener direcciones'
        throw error
      } finally {
        this.loading = false
      }
    },

    clearCurrentRoute() {
      this.currentRoute = null
    },

    clearError() {
      this.error = null
    }
  }
})
