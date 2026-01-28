import { createContext, useContext, useState } from 'react'
import api from '../api'

const MessagingContext = createContext(null)

export function MessagingProvider({ children }) {
  const [orders, setOrders] = useState([])
  const [coverageZones, setCoverageZones] = useState([])
  const [settings, setSettings] = useState(null)
  const [stats, setStats] = useState(null)
  const [pollingStatus, setPollingStatus] = useState({ active: false })
  const [loading, setLoading] = useState(false)

  const fetchSettings = async () => {
    try {
      const response = await api.get('/api/messaging/settings')
      setSettings(response.data)
      return response.data
    } catch (error) {
      console.error('Error fetching settings:', error)
      throw error
    }
  }

  const updateSettings = async (data) => {
    try {
      const response = await api.put('/api/messaging/settings', data)
      setSettings(response.data)
      return response.data
    } catch (error) {
      console.error('Error updating settings:', error)
      throw error
    }
  }

  const testConnection = async () => {
    const response = await api.post('/api/messaging/settings/test-connection')
    return response.data
  }

  const fetchOrders = async (status = null) => {
    setLoading(true)
    try {
      const params = status ? { status } : {}
      const response = await api.get('/api/messaging/orders', { params })
      setOrders(response.data.orders || [])
      return response.data.orders
    } catch (error) {
      console.error('Error fetching orders:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const fetchOrder = async (id) => {
    const response = await api.get(`/api/messaging/orders/${id}`)
    return response.data
  }

  const createOrder = async (data) => {
    const response = await api.post('/api/messaging/orders', data)
    setOrders(prev => [response.data, ...prev])
    return response.data
  }

  const updateOrder = async (id, data) => {
    const response = await api.put(`/api/messaging/orders/${id}`, data)
    setOrders(prev => prev.map(o => o.id === id ? response.data : o))
    return response.data
  }

  const confirmOrder = async (id) => {
    const response = await api.post(`/api/messaging/orders/${id}/confirm`)
    setOrders(prev => prev.map(o => o.id === id ? response.data : o))
    return response.data
  }

  const cancelOrder = async (id, reason = '') => {
    const response = await api.post(`/api/messaging/orders/${id}/cancel`, { reason })
    setOrders(prev => prev.map(o => o.id === id ? response.data : o))
    return response.data
  }

  const completeOrder = async (id) => {
    const response = await api.post(`/api/messaging/orders/${id}/complete`)
    setOrders(prev => prev.map(o => o.id === id ? response.data : o))
    return response.data
  }

  const fetchCoverageZones = async () => {
    const response = await api.get('/api/messaging/coverage-zones')
    setCoverageZones(response.data)
    return response.data
  }

  const createCoverageZone = async (data) => {
    const response = await api.post('/api/messaging/coverage-zones', data)
    setCoverageZones(prev => [...prev, response.data])
    return response.data
  }

  const createCoverageZonesBulk = async (data) => {
    const response = await api.post('/api/messaging/coverage-zones/bulk', data)
    if (response.data.zones) {
      setCoverageZones(prev => [...prev, ...response.data.zones])
    }
    return response.data
  }

  const updateCoverageZone = async (id, data) => {
    const response = await api.put(`/api/messaging/coverage-zones/${id}`, data)
    setCoverageZones(prev => prev.map(z => z.id === id ? response.data : z))
    return response.data
  }

  const deleteCoverageZone = async (id) => {
    await api.delete(`/api/messaging/coverage-zones/${id}`)
    setCoverageZones(prev => prev.filter(z => z.id !== id))
  }

  const fetchStats = async () => {
    const response = await api.get('/api/messaging/stats')
    setStats(response.data)
    return response.data
  }

  const getPollingStatus = async () => {
    const response = await api.get('/api/messaging/polling/status')
    setPollingStatus(response.data)
    return response.data
  }

  const startPolling = async (interval = 30) => {
    const response = await api.post('/api/messaging/polling/start', { interval })
    setPollingStatus({ active: true, ...response.data })
    return response.data
  }

  const stopPolling = async () => {
    const response = await api.post('/api/messaging/polling/stop')
    setPollingStatus({ active: false })
    return response.data
  }

  const syncContacts = async () => {
    const response = await api.post('/api/messaging/polling/sync')
    return response.data
  }

  const value = {
    orders,
    coverageZones,
    settings,
    stats,
    pollingStatus,
    loading,
    fetchSettings,
    updateSettings,
    testConnection,
    fetchOrders,
    fetchOrder,
    createOrder,
    updateOrder,
    confirmOrder,
    cancelOrder,
    completeOrder,
    fetchCoverageZones,
    createCoverageZone,
    createCoverageZonesBulk,
    updateCoverageZone,
    deleteCoverageZone,
    fetchStats,
    getPollingStatus,
    startPolling,
    stopPolling,
    syncContacts
  }

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>
}

export function useMessaging() {
  const context = useContext(MessagingContext)
  if (!context) {
    throw new Error('useMessaging must be used within MessagingProvider')
  }
  return context
}
