/**
 * @fileoverview Proveedor de contexto para la gestión de mensajería y órdenes.
 * Expone métodos para interactuar con órdenes, zonas de cobertura, configuración de bots y agentes.
 */

import { createContext, useContext, useState } from 'react'
import api from '../api'

/**
 * Contexto de mensajería.
 * @type {React.Context}
 */
const MessagingContext = createContext(null)

/**
 * Proveedor que gestiona el estado global de la mensajería y proporciona funciones de API relacionadas.
 * @param {Object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Componentes hijos.
 * @returns {JSX.Element}
 */
export function MessagingProvider({ children }) {
  /** @type {[Array, Function]} Lista de órdenes de mensajería */
  const [orders, setOrders] = useState([])
  /** @type {[Array, Function]} Lista de zonas de cobertura */
  const [coverageZones, setCoverageZones] = useState([])
  /** @type {[Object|null, Function]} Configuración general de mensajería */
  const [settings, setSettings] = useState(null)
  /** @type {[Object|null, Function]} Estadísticas de mensajería */
  const [stats, setStats] = useState(null)
  /** @type {[Object, Function]} Estado actual del polling de servicios externos */
  const [pollingStatus, setPollingStatus] = useState({ active: false })
  /** @type {[boolean, Function]} Indica si hay una operación de carga en curso */
  const [loading, setLoading] = useState(false)

  /**
   * Obtiene la configuración de mensajería desde el servidor.
   * @async
   * @returns {Promise<Object>}
   */
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

  /**
   * Actualiza la configuración de mensajería.
   * @async
   * @param {Object} data - Nuevos valores de configuración.
   * @returns {Promise<Object>}
   */
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

  /**
   * Prueba la conexión con Respond.io.
   * @async
   * @returns {Promise<Object>}
   */
  const testConnection = async () => {
    const response = await api.post('/api/messaging/settings/test-connection')
    return response.data
  }

  /**
   * Prueba la API key de OpenAI.
   * @async
   * @param {string} apiKey - Clave de API de OpenAI.
   * @returns {Promise<Object>}
   */
  const testOpenAI = async (apiKey) => {
    const response = await api.post('/api/messaging/settings/test-openai', { openai_api_key: apiKey })
    return response.data
  }

  /**
   * Reinicia el estado de prueba de la configuración.
   * @async
   * @returns {Promise<Object>}
   */
  const resetTest = async () => {
    const response = await api.post('/api/messaging/settings/reset-test')
    return response.data
  }

  /**
   * Obtiene la lista de órdenes, opcionalmente filtrada por estado.
   * @async
   * @param {string} [status=null] - Estado de las órdenes a filtrar.
   * @returns {Promise<Array>}
   */
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

  /**
   * Obtiene una orden específica por su ID.
   * @async
   * @param {number|string} id - ID de la orden.
   * @returns {Promise<Object>}
   */
  const fetchOrder = async (id) => {
    const response = await api.get(`/api/messaging/orders/${id}`)
    return response.data
  }

  /**
   * Crea una nueva orden de mensajería.
   * @async
   * @param {Object} data - Datos de la orden.
   * @returns {Promise<Object>}
   */
  const createOrder = async (data) => {
    const response = await api.post('/api/messaging/orders', data)
    setOrders(prev => [response.data, ...prev])
    return response.data
  }

  /**
   * Actualiza una orden existente.
   * @async
   * @param {number|string} id - ID de la orden.
   * @param {Object} data - Datos a actualizar.
   * @returns {Promise<Object>}
   */
  const updateOrder = async (id, data) => {
    const response = await api.put(`/api/messaging/orders/${id}`, data)
    setOrders(prev => prev.map(o => o.id === id ? response.data : o))
    return response.data
  }

  /**
   * Confirma una orden (pasa a estado 'confirmed').
   * @async
   * @param {number|string} id - ID de la orden.
   * @returns {Promise<Object>}
   */
  const confirmOrder = async (id) => {
    const response = await api.post(`/api/messaging/orders/${id}/confirm`)
    setOrders(prev => prev.map(o => o.id === id ? response.data : o))
    return response.data
  }

  /**
   * Cancela una orden.
   * @async
   * @param {number|string} id - ID de la orden.
   * @param {string} [reason=''] - Motivo de la cancelación.
   * @returns {Promise<Object>}
   */
  const cancelOrder = async (id, reason = '') => {
    const response = await api.post(`/api/messaging/orders/${id}/cancel`, { reason })
    setOrders(prev => prev.map(o => o.id === id ? response.data : o))
    return response.data
  }

  /**
   * Marca una orden como completada.
   * @async
   * @param {number|string} id - ID de la orden.
   * @returns {Promise<Object>}
   */
  const completeOrder = async (id) => {
    const response = await api.post(`/api/messaging/orders/${id}/complete`)
    setOrders(prev => prev.map(o => o.id === id ? response.data : o))
    return response.data
  }

  /**
   * Obtiene la lista de zonas de cobertura.
   * @async
   * @returns {Promise<Array>}
   */
  const fetchCoverageZones = async () => {
    const response = await api.get('/api/messaging/coverage-zones')
    setCoverageZones(response.data)
    return response.data
  }

  /**
   * Crea una nueva zona de cobertura.
   * @async
   * @param {Object} data - Datos de la zona.
   * @returns {Promise<Object>}
   */
  const createCoverageZone = async (data) => {
    const response = await api.post('/api/messaging/coverage-zones', data)
    setCoverageZones(prev => [...prev, response.data])
    return response.data
  }

  /**
   * Crea varias zonas de cobertura de forma masiva.
   * @async
   * @param {Object} data - Objeto con el array de zonas.
   * @returns {Promise<Object>}
   */
  const createCoverageZonesBulk = async (data) => {
    const response = await api.post('/api/messaging/coverage-zones/bulk', data)
    if (response.data.zones) {
      setCoverageZones(prev => [...prev, ...response.data.zones])
    }
    return response.data
  }

  /**
   * Actualiza una zona de cobertura existente.
   * @async
   * @param {number|string} id - ID de la zona.
   * @param {Object} data - Datos a actualizar.
   * @returns {Promise<Object>}
   */
  const updateCoverageZone = async (id, data) => {
    const response = await api.put(`/api/messaging/coverage-zones/${id}`, data)
    setCoverageZones(prev => prev.map(z => z.id === id ? response.data : z))
    return response.data
  }

  /**
   * Elimina una zona de cobertura.
   * @async
   * @param {number|string} id - ID de la zona.
   */
  const deleteCoverageZone = async (id) => {
    await api.delete(`/api/messaging/coverage-zones/${id}`)
    setCoverageZones(prev => prev.filter(z => z.id !== id))
  }

  /**
   * Obtiene estadísticas de mensajería (total de órdenes, estados, etc.).
   * @async
   * @returns {Promise<Object>}
   */
  const fetchStats = async () => {
    const response = await api.get('/api/messaging/stats')
    setStats(response.data)
    return response.data
  }

  /**
   * Consulta el estado actual del servicio de polling en el servidor.
   * @async
   * @returns {Promise<Object>}
   */
  const getPollingStatus = async () => {
    const response = await api.get('/api/messaging/polling/status')
    setPollingStatus(response.data)
    return response.data
  }

  /**
   * Inicia el servicio de polling con un intervalo determinado.
   * @async
   * @param {number} [interval=30] - Intervalo en segundos.
   * @returns {Promise<Object>}
   */
  const startPolling = async (interval = 30) => {
    const response = await api.post('/api/messaging/polling/start', { interval })
    setPollingStatus({ active: true, ...response.data })
    return response.data
  }

  /**
   * Detiene el servicio de polling.
   * @async
   * @returns {Promise<Object>}
   */
  const stopPolling = async () => {
    const response = await api.post('/api/messaging/polling/stop')
    setPollingStatus({ active: false })
    return response.data
  }

  /**
   * Fuerza una sincronización de contactos manual.
   * @async
   * @returns {Promise<Object>}
   */
  const syncContacts = async () => {
    const response = await api.post('/api/messaging/polling/sync')
    return response.data
  }

  /**
   * Valida un código postal o nombre de ciudad para verificar cobertura.
   * @async
   * @param {string} zipOrCity - CP o Ciudad.
   * @returns {Promise<Object>}
   */
  const validateZip = async (zipOrCity) => {
    const response = await api.post('/api/messaging/validate-zip', { zipOrCity })
    return response.data
  }

  /**
   * Obtiene la lista de agentes de servicio disponibles.
   * @async
   * @returns {Promise<Array>}
   */
  const fetchAgents = async () => {
    const response = await api.get('/api/messaging/agents')
    return response.data
  }

  /**
   * Crea un nuevo perfil de agente de servicio.
   * @async
   * @param {Object} data - Datos del agente.
   * @returns {Promise<Object>}
   */
  const createAgent = async (data) => {
    const response = await api.post('/api/messaging/agents', data)
    return response.data
  }

  /**
   * Actualiza los datos de un agente.
   * @async
   * @param {number|string} id - ID del agente.
   * @param {Object} data - Datos a actualizar.
   * @returns {Promise<Object>}
   */
  const updateAgent = async (id, data) => {
    const response = await api.put(`/api/messaging/agents/${id}`, data)
    return response.data
  }

  /**
   * Elimina un agente.
   * @async
   * @param {number|string} id - ID del agente.
   * @returns {Promise<Object>}
   */
  const deleteAgent = async (id) => {
    const response = await api.delete(`/api/messaging/agents/${id}`)
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
    testOpenAI,
    resetTest,
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
    syncContacts,
    validateZip,
    fetchAgents,
    createAgent,
    updateAgent,
    deleteAgent
  }

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>
}

/**
 * Hook para acceder al contexto de mensajería.
 * @returns {Object} Datos y funciones de mensajería.
 * @throws {Error} Si se usa fuera de un MessagingProvider.
 */
export function useMessaging() {
  const context = useContext(MessagingContext)
  if (!context) {
    throw new Error('useMessaging must be used within MessagingProvider')
  }
  return context
}
