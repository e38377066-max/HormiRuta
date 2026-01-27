import { defineStore } from 'pinia'
import { api } from 'src/boot/axios'

export const useMessagingStore = defineStore('messaging', {
  state: () => ({
    orders: [],
    currentOrder: null,
    coverageZones: [],
    settings: null,
    stats: null,
    pollingStatus: { active: false },
    contacts: [],
    loading: false,
    error: null
  }),

  actions: {
    async fetchSettings() {
      try {
        const response = await api.get('/messaging/settings')
        this.settings = response.data
        return this.settings
      } catch (error) {
        console.error('Error fetching messaging settings:', error)
        throw error
      }
    },

    async updateSettings(data) {
      try {
        const response = await api.put('/messaging/settings', data)
        this.settings = response.data
        return this.settings
      } catch (error) {
        console.error('Error updating messaging settings:', error)
        throw error
      }
    },

    async testConnection() {
      try {
        const response = await api.post('/messaging/settings/test-connection')
        return response.data
      } catch (error) {
        console.error('Error testing connection:', error)
        throw error
      }
    },

    async fetchOrders(status = null) {
      this.loading = true
      try {
        const params = status ? { status } : {}
        const response = await api.get('/messaging/orders', { params })
        this.orders = response.data.orders
        return this.orders
      } catch (error) {
        console.error('Error fetching orders:', error)
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async fetchOrder(id) {
      try {
        const response = await api.get(`/messaging/orders/${id}`)
        this.currentOrder = response.data
        return this.currentOrder
      } catch (error) {
        console.error('Error fetching order:', error)
        throw error
      }
    },

    async createOrder(data) {
      try {
        const response = await api.post('/messaging/orders', data)
        this.orders.unshift(response.data)
        return response.data
      } catch (error) {
        console.error('Error creating order:', error)
        throw error
      }
    },

    async updateOrder(id, data) {
      try {
        const response = await api.put(`/messaging/orders/${id}`, data)
        const index = this.orders.findIndex(o => o.id === id)
        if (index !== -1) {
          this.orders[index] = response.data
        }
        if (this.currentOrder?.id === id) {
          this.currentOrder = { ...this.currentOrder, ...response.data }
        }
        return response.data
      } catch (error) {
        console.error('Error updating order:', error)
        throw error
      }
    },

    async confirmOrder(id) {
      try {
        const response = await api.post(`/messaging/orders/${id}/confirm`)
        const index = this.orders.findIndex(o => o.id === id)
        if (index !== -1) {
          this.orders[index] = response.data
        }
        return response.data
      } catch (error) {
        console.error('Error confirming order:', error)
        throw error
      }
    },

    async cancelOrder(id, reason) {
      try {
        const response = await api.post(`/messaging/orders/${id}/cancel`, { reason })
        const index = this.orders.findIndex(o => o.id === id)
        if (index !== -1) {
          this.orders[index] = response.data
        }
        return response.data
      } catch (error) {
        console.error('Error cancelling order:', error)
        throw error
      }
    },

    async completeOrder(id) {
      try {
        const response = await api.post(`/messaging/orders/${id}/complete`)
        const index = this.orders.findIndex(o => o.id === id)
        if (index !== -1) {
          this.orders[index] = response.data
        }
        return response.data
      } catch (error) {
        console.error('Error completing order:', error)
        throw error
      }
    },

    async deleteOrder(id) {
      try {
        await api.delete(`/messaging/orders/${id}`)
        this.orders = this.orders.filter(o => o.id !== id)
      } catch (error) {
        console.error('Error deleting order:', error)
        throw error
      }
    },

    async sendMessage(orderId, message) {
      try {
        const response = await api.post(`/messaging/orders/${orderId}/send-message`, { message })
        return response.data
      } catch (error) {
        console.error('Error sending message:', error)
        throw error
      }
    },

    async fetchCoverageZones() {
      try {
        const response = await api.get('/messaging/coverage-zones')
        this.coverageZones = response.data
        return this.coverageZones
      } catch (error) {
        console.error('Error fetching coverage zones:', error)
        throw error
      }
    },

    async createCoverageZone(data) {
      try {
        const response = await api.post('/messaging/coverage-zones', data)
        this.coverageZones.push(response.data)
        return response.data
      } catch (error) {
        console.error('Error creating coverage zone:', error)
        throw error
      }
    },

    async createCoverageZonesBulk(data) {
      try {
        const response = await api.post('/messaging/coverage-zones/bulk', data)
        if (response.data.zones) {
          this.coverageZones.push(...response.data.zones)
        }
        return response.data
      } catch (error) {
        console.error('Error creating coverage zones:', error)
        throw error
      }
    },

    async updateCoverageZone(id, data) {
      try {
        const response = await api.put(`/messaging/coverage-zones/${id}`, data)
        const index = this.coverageZones.findIndex(z => z.id === id)
        if (index !== -1) {
          this.coverageZones[index] = response.data
        }
        return response.data
      } catch (error) {
        console.error('Error updating coverage zone:', error)
        throw error
      }
    },

    async deleteCoverageZone(id) {
      try {
        await api.delete(`/messaging/coverage-zones/${id}`)
        this.coverageZones = this.coverageZones.filter(z => z.id !== id)
      } catch (error) {
        console.error('Error deleting coverage zone:', error)
        throw error
      }
    },

    async validateAddress(address) {
      try {
        const response = await api.post('/messaging/validate-address', { address })
        return response.data
      } catch (error) {
        console.error('Error validating address:', error)
        throw error
      }
    },

    async fetchStats() {
      try {
        const response = await api.get('/messaging/stats')
        this.stats = response.data
        return this.stats
      } catch (error) {
        console.error('Error fetching stats:', error)
        throw error
      }
    },

    async getPollingStatus() {
      try {
        const response = await api.get('/messaging/polling/status')
        this.pollingStatus = response.data
        return this.pollingStatus
      } catch (error) {
        console.error('Error getting polling status:', error)
        throw error
      }
    },

    async startPolling(interval = 30) {
      try {
        const response = await api.post('/messaging/polling/start', { interval })
        this.pollingStatus = { active: true, ...response.data }
        return response.data
      } catch (error) {
        console.error('Error starting polling:', error)
        throw error
      }
    },

    async stopPolling() {
      try {
        const response = await api.post('/messaging/polling/stop')
        this.pollingStatus = { active: false }
        return response.data
      } catch (error) {
        console.error('Error stopping polling:', error)
        throw error
      }
    },

    async syncContacts() {
      try {
        const response = await api.post('/messaging/polling/sync')
        return response.data
      } catch (error) {
        console.error('Error syncing contacts:', error)
        throw error
      }
    },

    async fetchContacts(status = null) {
      try {
        const params = status ? { status } : {}
        const response = await api.get('/messaging/contacts', { params })
        this.contacts = response.data.contacts
        return this.contacts
      } catch (error) {
        console.error('Error fetching contacts:', error)
        throw error
      }
    },

    async fetchContactMessages(contactId) {
      try {
        const response = await api.get(`/messaging/contacts/${contactId}/messages`)
        return response.data.messages
      } catch (error) {
        console.error('Error fetching contact messages:', error)
        throw error
      }
    }
  }
})
