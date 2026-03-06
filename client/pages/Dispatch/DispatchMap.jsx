import { useEffect, useState, useRef, useCallback } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api'
import './DispatchMap.css'

const STATUS_CONFIG = {
  approved: { label: 'Aprobada', color: '#4caf50', icon: 'check_circle' },
  ordered: { label: 'Ordenada', color: '#2196f3', icon: 'shopping_cart' },
  on_delivery: { label: 'En Entrega', color: '#ff9800', icon: 'delivery_dining' },
  ups_shipped: { label: 'UPS Shipped', color: '#9c27b0', icon: 'local_shipping' },
  delivered: { label: 'Entregada', color: '#ff6d00', icon: 'done_all' }
}

const DRIVER_COLORS = [
  '#6200ea', '#e91e63', '#00897b', '#ff6f00', '#1565c0',
  '#6a1b9a', '#2e7d32', '#c62828', '#00838f', '#ef6c00',
  '#4527a0', '#ad1457', '#00695c', '#d84315', '#283593'
]

function createNumberedIcon(number, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
    <text x="18" y="22" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Arial">${number}</text>
  </svg>`
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}

export default function DispatchMap() {
  const { isAdmin, isDriver } = useAuth()
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const polylineRef = useRef(null)
  const directionsRendererRef = useRef(null)
  const optimizeTimerRef = useRef(null)

  const [orders, setOrders] = useState([])
  const [stats, setStats] = useState({})
  const [selectedOrders, setSelectedOrders] = useState([])
  const [drivers, setDrivers] = useState([])
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreateRoute, setShowCreateRoute] = useState(false)
  const [showAssignDriver, setShowAssignDriver] = useState(null)
  const [routeName, setRouteName] = useState('')
  const [activeTab, setActiveTab] = useState('orders')
  const [editingNotes, setEditingNotes] = useState(null)
  const [notesValue, setNotesValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [respondUsers, setRespondUsers] = useState([])
  const [selectedRespondUsers, setSelectedRespondUsers] = useState([])
  const [loadingRespondUsers, setLoadingRespondUsers] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [routeInfo, setRouteInfo] = useState(null)
  const [optimizingLive, setOptimizingLive] = useState(false)
  const [deliveredOrders, setDeliveredOrders] = useState([])
  const [loadingDelivered, setLoadingDelivered] = useState(false)
  const [evidenceModal, setEvidenceModal] = useState(null)
  const [editingBilling, setEditingBilling] = useState(null)
  const [billingValues, setBillingValues] = useState({ order_cost: '', deposit_amount: '', total_to_collect: '' })
  const [messageModal, setMessageModal] = useState(null)
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageSuccess, setMessageSuccess] = useState('')
  const [showManualOrder, setShowManualOrder] = useState(false)
  const [manualOrderForm, setManualOrderForm] = useState({ customer_name: '', customer_phone: '', validated_address: '', order_cost: '', deposit_amount: '', notes: '' })
  const [manualOrderGeo, setManualOrderGeo] = useState(null)
  const [manualOrderGeoLoading, setManualOrderGeoLoading] = useState(false)
  const [manualOrderSaving, setManualOrderSaving] = useState(false)
  const [manualOrderError, setManualOrderError] = useState('')
  const [editOrderModal, setEditOrderModal] = useState(null)
  const [editOrderForm, setEditOrderForm] = useState({ customer_name: '', customer_phone: '', validated_address: '', order_cost: '', deposit_amount: '', notes: '' })
  const [editOrderGeo, setEditOrderGeo] = useState(null)
  const [editOrderGeoLoading, setEditOrderGeoLoading] = useState(false)
  const [editOrderSaving, setEditOrderSaving] = useState(false)
  const [editOrderError, setEditOrderError] = useState('')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = { available: 'true' }
      if (filterStatus) params.status = filterStatus
      const [ordersRes, routesRes] = await Promise.all([
        api.get('/api/dispatch/orders', { params }),
        api.get('/api/dispatch/routes')
      ])
      setOrders(ordersRes.data.orders || [])
      setRoutes(routesRes.data.routes || [])

      if (isAdmin) {
        const [statsRes, driversRes] = await Promise.all([
          api.get('/api/dispatch/stats'),
          api.get('/api/dispatch/drivers')
        ])
        setStats(statsRes.data)
        setDrivers(driversRes.data.drivers || [])
      }
    } catch (error) {
      console.error('Error fetching dispatch data:', error)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, isAdmin])

  const fetchDeliveredOrders = useCallback(async () => {
    try {
      setLoadingDelivered(true)
      const res = await api.get('/api/dispatch/orders/delivered')
      setDeliveredOrders(res.data.orders || [])
    } catch (error) {
      console.error('Error fetching delivered orders:', error)
    } finally {
      setLoadingDelivered(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 180000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      console.warn('Google Maps API key not configured')
      return
    }

    const loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places', 'geometry']
    })

    loader.load().then((google) => {
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: { lat: 32.7767, lng: -96.7970 },
        zoom: 11,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] }
        ]
      })
    }).catch(err => console.error('Error loading Google Maps:', err))
  }, [])

  useEffect(() => {
    if (!mapInstance.current || !window.google?.maps) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const ordersToShow = orders.filter(o => o.address_lat && o.address_lng)

    ordersToShow.forEach(order => {
      const config = STATUS_CONFIG[order.order_status] || STATUS_CONFIG.approved
      const selIndex = selectedOrders.indexOf(order.id)
      const isSelected = selIndex !== -1

      let icon
      if (isSelected) {
        icon = {
          url: createNumberedIcon(selIndex + 1, '#6200ea'),
          scaledSize: new window.google.maps.Size(36, 44),
          anchor: new window.google.maps.Point(18, 44)
        }
      } else {
        icon = {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: config.color,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          scale: 10
        }
      }

      const marker = new window.google.maps.Marker({
        position: { lat: order.address_lat, lng: order.address_lng },
        map: mapInstance.current,
        icon,
        title: `${order.customer_name || 'Sin nombre'} - ${order.address}`,
        zIndex: isSelected ? 100 : 1
      })

      const infoContent = `
        <div style="font-family:sans-serif;min-width:200px">
          <strong>${order.customer_name || 'Sin nombre'}</strong><br/>
          <span style="color:#666">${order.address || ''}</span><br/>
          <span style="color:#666">${order.customer_phone || ''}</span><br/>
          <span style="background:${config.color};color:white;padding:2px 8px;border-radius:4px;font-size:12px">${config.label}</span>
          ${order.amount ? `<br/><strong>$${order.amount.toFixed(2)}</strong>` : ''}
        </div>
      `
      const infoWindow = new window.google.maps.InfoWindow({ content: infoContent })

      marker.addListener('click', () => {
        infoWindow.open(mapInstance.current, marker)
        if (isAdmin) toggleOrderSelection(order.id)
      })

      markersRef.current.push(marker)
    })

    routes.forEach(route => {
      if (route.status !== 'assigned' || !route.orders?.length) return
      const driverName = route.orders[0]?.driver_name
      if (!driverName) return
      const colorIdx = Math.abs([...driverName].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0))
      const color = getDriverColor(colorIdx)

      route.orders.forEach((order, stopIdx) => {
        if (!order.address_lat || !order.address_lng) return

        const marker = new window.google.maps.Marker({
          position: { lat: order.address_lat, lng: order.address_lng },
          map: mapInstance.current,
          icon: {
            url: createNumberedIcon(stopIdx + 1, color),
            scaledSize: new window.google.maps.Size(36, 44),
            anchor: new window.google.maps.Point(18, 44)
          },
          title: `${driverName} - ${order.customer_name || 'Sin nombre'}`,
          zIndex: 50
        })

        const infoContent = `
          <div style="font-family:sans-serif;min-width:200px">
            <strong>${order.customer_name || 'Sin nombre'}</strong><br/>
            <span style="color:#666">${order.address || ''}</span><br/>
            <span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:12px">
              ${driverName} - Parada ${stopIdx + 1}
            </span>
          </div>
        `
        const infoWindow = new window.google.maps.InfoWindow({ content: infoContent })
        marker.addListener('click', () => infoWindow.open(mapInstance.current, marker))

        markersRef.current.push(marker)
      })
    })
  }, [orders, selectedOrders, routes])

  useEffect(() => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null)
      directionsRendererRef.current = null
    }
    if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }

    if (!mapInstance.current || !window.google?.maps) return

    const selectedData = selectedOrders
      .map(id => orders.find(o => o.id === id))
      .filter(o => o?.address_lat && o?.address_lng)

    if (selectedData.length < 2) {
      setRouteInfo(null)
      return
    }

    if (optimizeTimerRef.current) clearTimeout(optimizeTimerRef.current)

    setOptimizingLive(true)

    optimizeTimerRef.current = setTimeout(() => {
      const directionsService = new window.google.maps.DirectionsService()
      const renderer = new window.google.maps.DirectionsRenderer({
        map: mapInstance.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#6200ea',
          strokeOpacity: 0.85,
          strokeWeight: 4
        }
      })
      directionsRendererRef.current = renderer

      const origin = { lat: selectedData[0].address_lat, lng: selectedData[0].address_lng }
      const destination = { lat: selectedData[selectedData.length - 1].address_lat, lng: selectedData[selectedData.length - 1].address_lng }
      const waypoints = selectedData.slice(1, -1).map(o => ({
        location: { lat: o.address_lat, lng: o.address_lng },
        stopover: true
      }))

      directionsService.route({
        origin,
        destination,
        waypoints,
        optimizeWaypoints: true,
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: window.google.maps.TrafficModel.BEST_GUESS
        }
      }, (result, status) => {
        setOptimizingLive(false)
        if (status === 'OK') {
          renderer.setDirections(result)

          const route = result.routes[0]
          let totalDist = 0
          let totalDur = 0
          route.legs.forEach(leg => {
            totalDist += leg.distance.value
            totalDur += leg.duration.value
          })

          const selectedIds = selectedData.map(o => o.id)
          let optimizedOrder
          if (route.waypoint_order && route.waypoint_order.length > 0) {
            const firstId = selectedIds[0]
            const lastId = selectedIds[selectedIds.length - 1]
            const middleIds = selectedIds.slice(1, -1)
            const reorderedMiddle = route.waypoint_order.map(i => middleIds[i])
            optimizedOrder = [firstId, ...reorderedMiddle, lastId]
          } else {
            optimizedOrder = selectedIds
          }

          setRouteInfo({
            distance: (totalDist / 1000).toFixed(1),
            duration: Math.round(totalDur / 60),
            optimizedOrder
          })
        } else {
          console.error('Directions request failed:', status)
          setRouteInfo(null)
        }
      })
    }, 500)

    return () => {
      if (optimizeTimerRef.current) clearTimeout(optimizeTimerRef.current)
    }
  }, [selectedOrders, orders])

  const [dragIdx, setDragIdx] = useState(null)

  const toggleOrderSelection = (orderId) => {
    setSelectedOrders(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    )
  }

  const [manualReorder, setManualReorder] = useState(false)

  const moveOrderInSelection = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= selectedOrders.length) return
    setManualReorder(true)
    setRouteInfo(null)
    setSelectedOrders(prev => {
      const arr = [...prev]
      const [item] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, item)
      return arr
    })
  }

  const handleDragStart = (idx) => setDragIdx(idx)
  const handleDragOver = (e) => e.preventDefault()
  const handleDrop = (targetIdx) => {
    if (dragIdx !== null && dragIdx !== targetIdx) {
      moveOrderInSelection(dragIdx, targetIdx)
    }
    setDragIdx(null)
  }

  const getDriverColor = (driverIdx) => DRIVER_COLORS[driverIdx % DRIVER_COLORS.length]

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_status: newStatus } : o))
      await api.put(`/api/dispatch/orders/${orderId}/status`, { order_status: newStatus })
      fetchData()
    } catch (error) {
      console.error('Error updating status:', error)
      alert(error.response?.data?.error || 'Error al actualizar estado')
      fetchData()
    }
  }

  const handleBulkStatus = async (newStatus) => {
    if (!selectedOrders.length) return
    try {
      await api.put('/api/dispatch/orders/bulk-status', { order_ids: selectedOrders, order_status: newStatus })
      setSelectedOrders([])
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al actualizar')
    }
  }

  const handleCreateRoute = async () => {
    if (!selectedOrders.length) return
    try {
      let orderedIds = [...selectedOrders]
      let isPreOptimized = false

      if (!manualReorder && routeInfo?.optimizedOrder && routeInfo.optimizedOrder.length === selectedOrders.length) {
        orderedIds = routeInfo.optimizedOrder
        isPreOptimized = true
      }

      await api.post('/api/dispatch/routes', {
        name: routeName || undefined,
        order_ids: orderedIds,
        pre_optimized: isPreOptimized
      })
      setSelectedOrders([])
      setShowCreateRoute(false)
      setRouteName('')
      setRouteInfo(null)
      setManualReorder(false)
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al crear ruta')
    }
  }

  const [optimizing, setOptimizing] = useState(null)

  const handleOptimizeRoute = async (routeId) => {
    try {
      setOptimizing(routeId)
      const res = await api.post(`/api/dispatch/routes/${routeId}/optimize`)
      alert(`Ruta optimizada: ${res.data.total_distance} km, ~${res.data.total_duration} min`)
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al optimizar ruta')
    } finally {
      setOptimizing(null)
    }
  }

  const handleAssignDriver = async (routeId, driverId) => {
    try {
      await api.put(`/api/dispatch/routes/${routeId}/assign`, { driver_id: driverId })
      setShowAssignDriver(null)
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al asignar chofer')
    }
  }

  const handleMarkDelivered = async (orderId) => {
    try {
      await api.put(`/api/dispatch/orders/${orderId}/delivered`)
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al marcar entregado')
    }
  }

  const openMessageModal = async (order) => {
    setMessageModal(order)
    setMessageSuccess('')
    if (templates.length === 0) {
      setLoadingTemplates(true)
      try {
        const res = await api.get('/api/dispatch/templates')
        setTemplates(res.data.templates || [])
      } catch (err) {
        console.error('Error loading templates:', err)
      } finally {
        setLoadingTemplates(false)
      }
    }
  }

  const sendTemplate = async (template) => {
    if (!messageModal || sendingMessage) return
    setSendingMessage(true)
    setMessageSuccess('')
    try {
      await api.post(`/api/dispatch/orders/${messageModal.id}/send-template`, {
        templateName: template.name,
        languageCode: template.language || 'es',
        components: template.components || []
      })
      setMessageSuccess(`Template "${template.name}" enviado a ${messageModal.customer_name}`)
      setTimeout(() => setMessageSuccess(''), 3000)
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar template')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleSaveNotes = async (orderId) => {
    try {
      await api.put(`/api/dispatch/orders/${orderId}/notes`, { notes: notesValue })
      setEditingNotes(null)
      setNotesValue('')
      fetchData()
    } catch (error) {
      alert('Error al guardar notas')
    }
  }

  const handleSaveBilling = async (orderId) => {
    try {
      await api.put(`/api/dispatch/orders/${orderId}/billing`, {
        order_cost: billingValues.order_cost !== '' ? parseFloat(billingValues.order_cost) : null,
        deposit_amount: billingValues.deposit_amount !== '' ? parseFloat(billingValues.deposit_amount) : null,
        total_to_collect: billingValues.total_to_collect !== '' ? parseFloat(billingValues.total_to_collect) : undefined
      })
      setEditingBilling(null)
      setBillingValues({ order_cost: '', deposit_amount: '', total_to_collect: '' })
      fetchData()
    } catch (error) {
      alert('Error al guardar cobranza')
    }
  }

  const openBillingEditor = (order) => {
    setEditingBilling(order.id)
    setBillingValues({
      order_cost: order.order_cost != null ? String(order.order_cost) : '',
      deposit_amount: order.deposit_amount != null ? String(order.deposit_amount) : '',
      total_to_collect: order.total_to_collect != null ? String(order.total_to_collect) : ''
    })
  }

  const handleBillingChange = (field, value) => {
    const newValues = { ...billingValues, [field]: value }
    if (field === 'order_cost' || field === 'deposit_amount') {
      const cost = parseFloat(field === 'order_cost' ? value : newValues.order_cost) || 0
      const deposit = parseFloat(field === 'deposit_amount' ? value : newValues.deposit_amount) || 0
      newValues.total_to_collect = String(Math.max(0, cost - deposit))
    }
    setBillingValues(newValues)
  }

  const fetchAllUsers = async () => {
    try {
      setLoadingUsers(true)
      const res = await api.get('/api/admin/users', { params: { limit: 200 } })
      setAllUsers(res.data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleChangeRole = async (userId, newRole) => {
    try {
      await api.put(`/api/admin/users/${userId}/role`, { role: newRole })
      fetchAllUsers()
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al cambiar rol')
    }
  }

  const fetchRespondUsers = async () => {
    try {
      setLoadingRespondUsers(true)
      setSyncResult(null)
      const res = await api.get('/api/dispatch/respond-users')
      setRespondUsers(res.data.users || [])
    } catch (error) {
      alert(error.response?.data?.error || 'Error al cargar miembros de Respond.io')
    } finally {
      setLoadingRespondUsers(false)
    }
  }

  const toggleRespondUser = (email) => {
    setSelectedRespondUsers(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  const handleSyncDrivers = async () => {
    if (!selectedRespondUsers.length) return
    try {
      const usersToSync = respondUsers
        .filter(u => selectedRespondUsers.includes(u.email))
        .map(u => ({ name: u.name, email: u.email }))
      const res = await api.post('/api/dispatch/sync-drivers', { users: usersToSync })
      setSyncResult(res.data)
      setSelectedRespondUsers([])
      fetchData()
      const updatedUsers = await api.get('/api/dispatch/respond-users')
      setRespondUsers(updatedUsers.data.users || [])
    } catch (error) {
      alert(error.response?.data?.error || 'Error al sincronizar choferes')
    }
  }

  const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.approved

  const openManualOrderModal = () => {
    setManualOrderForm({ customer_name: '', customer_phone: '', validated_address: '', order_cost: '', deposit_amount: '', notes: '' })
    setManualOrderGeo(null)
    setManualOrderError('')
    setShowManualOrder(true)
  }

  const handleManualGeocode = async () => {
    if (!manualOrderForm.validated_address.trim()) return
    setManualOrderGeoLoading(true)
    setManualOrderGeo(null)
    setManualOrderError('')
    try {
      const res = await api.get('/api/dispatch/geocode-address', { params: { address: manualOrderForm.validated_address } })
      setManualOrderGeo(res.data)
      setManualOrderForm(prev => ({ ...prev, validated_address: res.data.formatted_address }))
    } catch (e) {
      setManualOrderError(e.response?.data?.error || 'No se pudo geocodificar la dirección')
    } finally {
      setManualOrderGeoLoading(false)
    }
  }

  const calcTotal = (form) => {
    const cost = parseFloat(form.order_cost) || 0
    const deposit = parseFloat(form.deposit_amount) || 0
    return Math.max(0, cost - deposit).toFixed(2)
  }

  const handleSaveManualOrder = async () => {
    if (!manualOrderForm.customer_name.trim() || !manualOrderForm.validated_address.trim()) {
      setManualOrderError('Nombre y dirección son requeridos')
      return
    }
    setManualOrderSaving(true)
    setManualOrderError('')
    try {
      await api.post('/api/dispatch/orders', manualOrderForm)
      setShowManualOrder(false)
      fetchData()
    } catch (e) {
      setManualOrderError(e.response?.data?.error || 'Error al guardar la orden')
    } finally {
      setManualOrderSaving(false)
    }
  }

  const openEditOrderModal = (order) => {
    setEditOrderForm({
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      validated_address: order.validated_address || order.address || '',
      order_cost: order.order_cost != null ? String(order.order_cost) : '',
      deposit_amount: order.deposit_amount != null ? String(order.deposit_amount) : '',
      notes: order.notes || ''
    })
    setEditOrderGeo(null)
    setEditOrderError('')
    setEditOrderModal(order)
  }

  const handleEditGeocode = async () => {
    if (!editOrderForm.validated_address.trim()) return
    setEditOrderGeoLoading(true)
    setEditOrderGeo(null)
    setEditOrderError('')
    try {
      const res = await api.get('/api/dispatch/geocode-address', { params: { address: editOrderForm.validated_address } })
      setEditOrderGeo(res.data)
      setEditOrderForm(prev => ({ ...prev, validated_address: res.data.formatted_address }))
    } catch (e) {
      setEditOrderError(e.response?.data?.error || 'No se pudo geocodificar la dirección')
    } finally {
      setEditOrderGeoLoading(false)
    }
  }

  const handleSaveEditOrder = async () => {
    if (!editOrderModal) return
    setEditOrderSaving(true)
    setEditOrderError('')
    try {
      await api.put(`/api/dispatch/orders/${editOrderModal.id}/edit`, editOrderForm)
      setEditOrderModal(null)
      fetchData()
    } catch (e) {
      setEditOrderError(e.response?.data?.error || 'Error al guardar cambios')
    } finally {
      setEditOrderSaving(false)
    }
  }

  const ADMIN_TRANSITIONS = {
    approved: 'ordered',
    ordered: 'on_delivery',
    on_delivery: 'delivered'
  }

  const getNextStatus = (currentStatus) => ADMIN_TRANSITIONS[currentStatus] || null

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className="dispatch-container">
      <div className="dispatch-sidebar">
        <div className="dispatch-header">
          <h2>
            <span className="material-icons">local_shipping</span>
            Despacho
          </h2>
        </div>

        {isAdmin && (
          <div className="dispatch-stats">
            <div className="dstat" style={{ borderColor: '#4caf50' }}>
              <span className="dstat-val">{stats.approved || 0}</span>
              <span className="dstat-label">Aprobadas</span>
            </div>
            <div className="dstat" style={{ borderColor: '#2196f3' }}>
              <span className="dstat-val">{stats.ordered || 0}</span>
              <span className="dstat-label">Ordenadas</span>
            </div>
            <div className="dstat" style={{ borderColor: '#ff9800' }}>
              <span className="dstat-val">{stats.on_delivery || 0}</span>
              <span className="dstat-label">En Entrega</span>
            </div>
            <div className="dstat" style={{ borderColor: '#9c27b0' }}>
              <span className="dstat-val">{stats.ups_shipped || 0}</span>
              <span className="dstat-label">UPS</span>
            </div>
            <div className="dstat" style={{ borderColor: '#ff6d00' }}>
              <span className="dstat-val">{stats.delivered || 0}</span>
              <span className="dstat-label">Entregadas</span>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="dispatch-tabs">
            <button className={`dtab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
              <span className="material-icons">list_alt</span> Ordenes
            </button>
            <button className={`dtab ${activeTab === 'routes' ? 'active' : ''}`} onClick={() => setActiveTab('routes')}>
              <span className="material-icons">route</span> Rutas
            </button>
            <button className={`dtab ${activeTab === 'drivers' ? 'active' : ''}`} onClick={() => { setActiveTab('drivers'); if (allUsers.length === 0) fetchAllUsers() }}>
              <span className="material-icons">people</span> Choferes
            </button>
            <button className={`dtab ${activeTab === 'delivered' ? 'active' : ''}`} onClick={() => { setActiveTab('delivered'); fetchDeliveredOrders() }}>
              <span className="material-icons">done_all</span> Entregadas
            </button>
          </div>
        )}

        {isAdmin && (
          <div className="dispatch-filter">
            <div className="dispatch-search-box">
              <span className="material-icons">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre..."
              />
              {searchQuery && (
                <button className="dispatch-search-clear" onClick={() => setSearchQuery('')}>
                  <span className="material-icons">close</span>
                </button>
              )}
            </div>
            <div className="dispatch-filter-row">
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="approved">Aprobadas</option>
                <option value="ordered">Ordenadas</option>
                <option value="on_delivery">En Entrega</option>
                <option value="ups_shipped">UPS Shipped</option>
                <option value="delivered">Entregadas</option>
              </select>
              <button className="btn-add-manual-order" onClick={openManualOrderModal} title="Agregar orden manual">
                <span className="material-icons">add</span>
              </button>
            </div>
          </div>
        )}

        {isAdmin && selectedOrders.length > 0 && (
          <div className="dispatch-selection-panel">
            <div className="selection-header">
              <div className="selected-count">
                <span className="material-icons">check_circle</span>
                {selectedOrders.length} seleccionada{selectedOrders.length > 1 ? 's' : ''}
                {optimizingLive && <span className="route-calc"> calculando...</span>}
                {routeInfo && !optimizingLive && (
                  <span className="route-info-inline">
                    <span className="material-icons">directions_car</span>
                    {routeInfo.distance} km - {routeInfo.duration} min
                  </span>
                )}
              </div>
              <button className="sel-clear-btn" onClick={() => { setSelectedOrders([]); setShowCreateRoute(false); setRouteName('') }} title="Limpiar">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="selection-stops-list">
              {selectedOrders.map((id, idx) => {
                const o = orders.find(x => x.id === id)
                if (!o) return null
                return (
                  <div
                    key={id}
                    className={`sel-stop-item ${dragIdx === idx ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                  >
                    <span className="sel-stop-number">{idx + 1}</span>
                    <div className="sel-stop-info">
                      <span className="sel-stop-name">{o.customer_name || 'Sin nombre'}</span>
                      <span className="sel-stop-addr">{o.address || ''}</span>
                    </div>
                    <div className="sel-stop-actions">
                      <button onClick={(e) => { e.stopPropagation(); moveOrderInSelection(idx, idx - 1) }} disabled={idx === 0} className="sel-move-btn">
                        <span className="material-icons">arrow_upward</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); moveOrderInSelection(idx, idx + 1) }} disabled={idx === selectedOrders.length - 1} className="sel-move-btn">
                        <span className="material-icons">arrow_downward</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); toggleOrderSelection(id) }} className="sel-remove-btn">
                        <span className="material-icons">remove_circle_outline</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="selection-bottom-actions">
              <div className="status-btns-row">
                <button className="dbtn blue" onClick={() => handleBulkStatus('ordered')} title="Ordenada">
                  <span className="material-icons">shopping_cart</span>
                </button>
                <button className="dbtn orange" onClick={() => handleBulkStatus('on_delivery')} title="En Entrega">
                  <span className="material-icons">delivery_dining</span>
                </button>
                <button className="dbtn green" onClick={() => handleBulkStatus('delivered')} title="Entregada">
                  <span className="material-icons">done_all</span>
                </button>
              </div>

              {!showCreateRoute ? (
                <button className="create-route-btn" onClick={() => setShowCreateRoute(true)}>
                  <span className="material-icons">add_road</span>
                  Crear Ruta con {selectedOrders.length} parada{selectedOrders.length > 1 ? 's' : ''}
                </button>
              ) : (
                <div className="create-route-inline">
                  <input
                    type="text"
                    value={routeName}
                    onChange={e => setRouteName(e.target.value)}
                    placeholder="Nombre de la ruta..."
                    className="route-name-input"
                    autoFocus
                  />
                  <div className="create-route-btns">
                    <button className="dbtn outline" onClick={() => { setShowCreateRoute(false); setRouteName('') }}>Cancelar</button>
                    <button className="dbtn purple" onClick={handleCreateRoute}>
                      <span className="material-icons">check</span> Crear
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="dispatch-list">
          {loading ? (
            <div className="loading-center"><div className="spinner"></div></div>
          ) : activeTab === 'orders' ? (
            (() => {
              const filtered = searchQuery
                ? orders.filter(o => (o.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (o.address || '').toLowerCase().includes(searchQuery.toLowerCase()) || (o.customer_phone || '').includes(searchQuery))
                : orders
              return filtered.length === 0 ? (
                <div className="empty-dispatch">
                  <span className="material-icons">inbox</span>
                  <p>{searchQuery ? 'No se encontraron ordenes' : 'No hay ordenes con direccion'}</p>
                </div>
              ) : (
              filtered.map(order => {
                const cfg = getStatusConfig(order.order_status)
                const isSelected = selectedOrders.includes(order.id)
                return (
                  <div
                    key={order.id}
                    className={`dispatch-order ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (isAdmin) toggleOrderSelection(order.id)
                      if (mapInstance.current && order.address_lat) {
                        mapInstance.current.panTo({ lat: order.address_lat, lng: order.address_lng })
                        mapInstance.current.setZoom(15)
                      }
                    }}
                  >
                    <div className="do-status-dot" style={{ backgroundColor: cfg.color }}></div>
                    <div className="do-content">
                      <div className="do-top">
                        <span className="do-name">{order.customer_name || 'Sin nombre'}</span>
                        <span className="do-id">#{order.id}</span>
                      </div>
                      <div className="do-address">{order.address || 'Sin direccion'}</div>
                      {order.customer_phone && (
                        <div className="do-contact-row" onClick={e => e.stopPropagation()}>
                          <span className="do-phone">{order.customer_phone}</span>
                          <a href={`tel:${order.customer_phone.replace(/[^0-9+]/g, '')}`} className="do-contact-btn do-call-btn" title="Llamar">
                            <span className="material-icons">call</span>
                          </a>
                          <button
                            className="do-contact-btn do-wa-btn"
                            title="Enviar mensaje por Respond.io"
                            onClick={() => openMessageModal(order)}
                          >
                            <span className="material-icons">chat</span>
                          </button>
                        </div>
                      )}
                      <div className="do-bottom">
                        <span className="do-tag" style={{ backgroundColor: `${cfg.color}20`, color: cfg.color, borderColor: cfg.color }}>
                          <span className="material-icons" style={{ fontSize: '14px' }}>{cfg.icon}</span>
                          {cfg.label}
                        </span>
                        {order.notes && (
                          <span className="do-notes-tag">
                            <span className="material-icons" style={{ fontSize: '14px' }}>sticky_note_2</span>
                          </span>
                        )}
                        {order.driver_name && (
                          <span className="do-driver">
                            <span className="material-icons" style={{ fontSize: '14px' }}>person</span>
                            {order.driver_name}
                          </span>
                        )}
                      </div>

                      {isAdmin && (
                        <div className="do-actions" onClick={e => e.stopPropagation()}>
                          {getNextStatus(order.order_status) && (
                            <button
                              className="dbtn full"
                              style={{ backgroundColor: getStatusConfig(getNextStatus(order.order_status)).color }}
                              onClick={() => handleUpdateStatus(order.id, getNextStatus(order.order_status))}
                            >
                              <span className="material-icons" style={{ fontSize: '16px' }}>{getStatusConfig(getNextStatus(order.order_status)).icon}</span>
                              {getStatusConfig(getNextStatus(order.order_status)).label}
                            </button>
                          )}
                          {editingNotes === order.id ? (
                            <div className="do-notes-edit">
                              <textarea
                                value={notesValue}
                                onChange={e => setNotesValue(e.target.value)}
                                placeholder="Agregar notas..."
                                autoFocus
                                rows={2}
                              />
                              <div className="do-notes-actions">
                                <button onClick={() => handleSaveNotes(order.id)}>
                                  <span className="material-icons">check</span>
                                </button>
                                <button onClick={() => setEditingNotes(null)}>
                                  <span className="material-icons">close</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="do-edit-notes"
                              onClick={() => { setEditingNotes(order.id); setNotesValue(order.notes || '') }}
                              title="Notas"
                            >
                              <span className="material-icons">sticky_note_2</span>
                            </button>
                          )}
                          <button
                            className="do-edit-notes"
                            onClick={() => openEditOrderModal(order)}
                            title="Editar orden"
                            style={{ color: '#2196f3' }}
                          >
                            <span className="material-icons">edit</span>
                          </button>

                          {order.notes && editingNotes !== order.id && (
                            <div className="do-notes-preview">{order.notes}</div>
                          )}

                          {editingBilling === order.id ? (
                            <div className="do-billing-edit" onClick={e => e.stopPropagation()}>
                              <div className="billing-field">
                                <label>Costo $</label>
                                <input type="number" step="0.01" value={billingValues.order_cost} onChange={e => handleBillingChange('order_cost', e.target.value)} placeholder="0.00" />
                              </div>
                              <div className="billing-field">
                                <label>Deposito $</label>
                                <input type="number" step="0.01" value={billingValues.deposit_amount} onChange={e => handleBillingChange('deposit_amount', e.target.value)} placeholder="0.00" />
                              </div>
                              <div className="billing-field">
                                <label>Total a cobrar $</label>
                                <input type="number" step="0.01" value={billingValues.total_to_collect} onChange={e => handleBillingChange('total_to_collect', e.target.value)} placeholder="0.00" />
                              </div>
                              <div className="do-notes-actions">
                                <button onClick={() => handleSaveBilling(order.id)}><span className="material-icons">check</span></button>
                                <button onClick={() => setEditingBilling(null)}><span className="material-icons">close</span></button>
                              </div>
                            </div>
                          ) : (
                            <div className="do-billing-row" onClick={e => { e.stopPropagation(); openBillingEditor(order) }}>
                              <span className="material-icons" style={{ fontSize: 16, color: '#4CAF50' }}>payments</span>
                              {order.total_to_collect != null ? (
                                <span className="billing-summary">
                                  Cobrar: <strong>${Number(order.total_to_collect).toFixed(2)}</strong>
                                  {order.order_cost != null && <span className="billing-detail"> (Costo: ${Number(order.order_cost).toFixed(2)})</span>}
                                  {order.deposit_amount > 0 && <span className="billing-detail"> - Dep: ${Number(order.deposit_amount).toFixed(2)}</span>}
                                </span>
                              ) : (
                                <span style={{ color: '#999', fontSize: 12 }}>Agregar cobranza</span>
                              )}
                              {order.payment_status && order.payment_status !== 'pending' && (
                                <span className={`payment-badge ${order.payment_status}`}>
                                  {order.payment_status === 'paid' ? 'Pagado' : 'Parcial'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {isDriver && (
                        <>
                          {order.notes && (
                            <div className="do-notes-preview">{order.notes}</div>
                          )}
                          {(order.total_to_collect != null || order.order_cost != null) && (
                            <div className="do-billing-display">
                              <span className="material-icons" style={{ fontSize: 16, color: '#4CAF50' }}>payments</span>
                              <div className="billing-info">
                                {order.order_cost != null && <span>Costo: ${Number(order.order_cost).toFixed(2)}</span>}
                                {order.deposit_amount > 0 && <span>Deposito: ${Number(order.deposit_amount).toFixed(2)}</span>}
                                {order.total_to_collect != null && <strong>Cobrar: ${Number(order.total_to_collect).toFixed(2)}</strong>}
                              </div>
                              {order.payment_method && (
                                <span className="payment-method-tag">{order.payment_method}</span>
                              )}
                              {order.payment_status && order.payment_status !== 'pending' && (
                                <span className={`payment-badge ${order.payment_status}`}>
                                  {order.payment_status === 'paid' ? 'Pagado' : 'Parcial'}
                                </span>
                              )}
                            </div>
                          )}
                          {order.order_status === 'on_delivery' && (
                            <div className="do-actions" onClick={e => e.stopPropagation()}>
                              <button className="dbtn orange full" onClick={() => handleMarkDelivered(order.id)}>
                                <span className="material-icons">done_all</span> Entregada
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )
            })()
          ) : activeTab === 'routes' ? (
            routes.length === 0 ? (
              <div className="empty-dispatch">
                <span className="material-icons">route</span>
                <p>No hay rutas creadas</p>
              </div>
            ) : (
              routes.map((route) => {
                const driverName = route.status === 'assigned' && route.orders?.[0]?.driver_name ? route.orders[0].driver_name : null
                const driverColorIdx = driverName ? Math.abs([...driverName].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)) : 0
                const driverColor = driverName ? getDriverColor(driverColorIdx) : '#999'
                return (
                <div key={route.id} className="dispatch-route-card" style={{ borderLeftColor: driverColor }}>
                  <div className="dr-header">
                    <span className="dr-name">
                      {route.status === 'assigned' && <span className="dr-color-dot" style={{ backgroundColor: driverColor }}></span>}
                      {route.name}
                    </span>
                    <span className={`dr-status ${route.status}`}>{route.status === 'assigned' ? 'Asignada' : route.status === 'draft' ? 'Borrador' : route.status}</span>
                  </div>
                  <div className="dr-info">
                    <span><span className="material-icons">pin_drop</span> {route.stops_count} paradas</span>
                    {route.total_amount > 0 && <span><span className="material-icons">attach_money</span> ${route.total_amount.toFixed(2)}</span>}
                  </div>
                  {route.orders?.length > 0 && (
                    <div className="dr-orders">
                      {route.orders.map(o => (
                        <div key={o.id} className="dr-order-mini">
                          <span className="dr-dot" style={{ backgroundColor: getStatusConfig(o.order_status).color }}></span>
                          <span>{o.customer_name || 'Sin nombre'}</span>
                          <span className="dr-order-status">{getStatusConfig(o.order_status).label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {route.is_optimized && (
                    <div className="dr-optimized">
                      <span className="material-icons">check_circle</span> Optimizada
                      {route.total_distance > 0 && <span> - {route.total_distance} km</span>}
                      {route.total_duration > 0 && <span> - ~{route.total_duration} min</span>}
                    </div>
                  )}
                  {isAdmin && route.status === 'draft' && (
                    <div className="dr-actions">
                      <button
                        className="dbtn blue full"
                        onClick={() => handleOptimizeRoute(route.id)}
                        disabled={optimizing === route.id || route.is_optimized}
                      >
                        <span className="material-icons">{optimizing === route.id ? 'hourglass_empty' : 'route'}</span>
                        {optimizing === route.id ? 'Optimizando...' : route.is_optimized ? 'Ya Optimizada' : 'Optimizar Ruta'}
                      </button>
                      <button className="dbtn purple full" onClick={() => setShowAssignDriver(route.id)}>
                        <span className="material-icons">person_add</span> Asignar Chofer
                      </button>
                    </div>
                  )}
                  {isAdmin && route.status === 'assigned' && (
                    <div className="dr-driver-row">
                      <div className="dr-driver">
                        <span className="material-icons">person</span> {route.orders?.[0]?.driver_name || 'Chofer asignado'}
                      </div>
                      <button className="dbtn outline small" onClick={() => setShowAssignDriver(route.id)}>
                        <span className="material-icons">swap_horiz</span> Cambiar
                      </button>
                    </div>
                  )}
                  {!isAdmin && route.status === 'assigned' && route.orders?.[0]?.driver_name && (
                    <div className="dr-driver">
                      <span className="material-icons">person</span> {route.orders[0].driver_name}
                    </div>
                  )}
                </div>
              )})
            )
          ) : activeTab === 'drivers' ? (
            <div className="drivers-tab">
              <div className="drivers-section">
                <div className="drivers-section-header">
                  <h3><span className="material-icons">manage_accounts</span> Usuarios del Sistema</h3>
                  <button className="dbtn outline small" onClick={fetchAllUsers} disabled={loadingUsers}>
                    <span className="material-icons">{loadingUsers ? 'hourglass_empty' : 'refresh'}</span>
                  </button>
                </div>
                {loadingUsers ? (
                  <div className="loading-center"><div className="spinner"></div></div>
                ) : allUsers.length === 0 ? (
                  <p className="drivers-empty">No hay usuarios registrados</p>
                ) : (
                  <div className="drivers-list">
                    {allUsers.map(u => (
                      <div key={u.id} className="driver-card">
                        <span className="material-icons driver-icon">{u.role === 'admin' ? 'admin_panel_settings' : u.role === 'driver' ? 'local_shipping' : 'person'}</span>
                        <div className="driver-info">
                          <strong>{u.username}</strong>
                          <span>{u.email}</span>
                        </div>
                        <select
                          className="role-select"
                          value={u.role}
                          onChange={e => handleChangeRole(u.id, e.target.value)}
                        >
                          <option value="admin">Admin</option>
                          <option value="driver">Chofer</option>
                          <option value="client">Cliente</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="drivers-section">
                <div className="drivers-section-header">
                  <h3><span className="material-icons">sync</span> Importar desde Respond.io</h3>
                  <button className="dbtn outline small" onClick={fetchRespondUsers} disabled={loadingRespondUsers}>
                    <span className="material-icons">{loadingRespondUsers ? 'hourglass_empty' : 'refresh'}</span>
                    {loadingRespondUsers ? 'Cargando...' : 'Actualizar'}
                  </button>
                </div>

                {syncResult && (
                  <div className="sync-result">
                    <span className="material-icons">check_circle</span>
                    <span>{syncResult.message}</span>
                  </div>
                )}

                {loadingRespondUsers ? (
                  <div className="loading-center"><div className="spinner"></div></div>
                ) : respondUsers.length === 0 ? (
                  <p className="drivers-empty">Presiona "Actualizar" para cargar miembros del equipo</p>
                ) : (
                  <>
                    <div className="respond-users-list">
                      {respondUsers.map(u => (
                        <div
                          key={u.respond_id || u.email}
                          className={`respond-user-card ${u.already_exists ? 'synced' : ''} ${selectedRespondUsers.includes(u.email) ? 'selected' : ''}`}
                          onClick={() => !u.already_exists && u.email && toggleRespondUser(u.email)}
                        >
                          <div className="ru-check">
                            {u.already_exists ? (
                              <span className="material-icons" style={{ color: '#4caf50' }}>check_circle</span>
                            ) : (
                              <span className="material-icons">{selectedRespondUsers.includes(u.email) ? 'check_box' : 'check_box_outline_blank'}</span>
                            )}
                          </div>
                          <div className="ru-info">
                            <strong>{u.name}</strong>
                            <span>{u.email || 'Sin email'}</span>
                            {u.role && <span className="ru-role">{u.role}</span>}
                          </div>
                          {u.already_exists && <span className="driver-badge synced">Ya registrado ({u.existing_role})</span>}
                        </div>
                      ))}
                    </div>
                    {selectedRespondUsers.length > 0 && (
                      <div className="sync-actions">
                        <button className="dbtn purple full" onClick={handleSyncDrivers}>
                          <span className="material-icons">person_add</span>
                          Importar {selectedRespondUsers.length} chofer{selectedRespondUsers.length > 1 ? 'es' : ''}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : activeTab === 'delivered' ? (
            loadingDelivered ? (
              <div className="loading-center"><div className="spinner"></div></div>
            ) : deliveredOrders.length === 0 ? (
              <div className="empty-dispatch">
                <span className="material-icons">inventory_2</span>
                <p>No hay entregas completadas</p>
              </div>
            ) : (
              deliveredOrders.map(order => (
                <div key={order.id} className="dispatch-order delivered-order">
                  <div className="do-status-dot" style={{ backgroundColor: '#ff6d00' }}></div>
                  <div className="do-content">
                    <div className="do-top">
                      <span className="do-name">{order.customer_name || 'Sin nombre'}</span>
                      <span className="do-id">#{order.id}</span>
                    </div>
                    <div className="do-address">{order.address || 'Sin direccion'}</div>
                    <div className="do-phone">{order.customer_phone || ''}</div>
                    <div className="do-bottom">
                      <span className="do-tag" style={{ backgroundColor: '#ff6d0020', color: '#ff6d00', borderColor: '#ff6d00' }}>
                        <span className="material-icons" style={{ fontSize: '14px' }}>done_all</span>
                        Entregada
                      </span>
                      {order.total_to_collect > 0 && (
                        <span className="do-amount">${Number(order.total_to_collect).toFixed(2)}</span>
                      )}
                      {order.payment_method && (
                        <span className="payment-method-tag">{order.payment_method}</span>
                      )}
                      {order.payment_status && order.payment_status !== 'pending' && (
                        <span className={`payment-badge ${order.payment_status}`}>
                          {order.payment_status === 'paid' ? 'Pagado' : 'Parcial'}
                        </span>
                      )}
                      {order.delivered_at && (
                        <span className="do-delivered-date">
                          {new Date(order.delivered_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    {order.evidence_photos?.length > 0 && (
                      <div className="do-evidence" onClick={e => e.stopPropagation()}>
                        {order.evidence_photos.map((ev, idx) => (
                          <div key={idx} className="evidence-thumb" onClick={() => setEvidenceModal({ order, photo: ev })}>
                            <img src={ev.photo_url} alt="Evidencia" />
                            <span className="material-icons evidence-icon">photo_camera</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {order.evidence_photos?.length === 0 && (
                      <div className="do-no-evidence">
                        <span className="material-icons" style={{ fontSize: '14px', color: '#999' }}>no_photography</span>
                        <span style={{ fontSize: '12px', color: '#999' }}>Sin evidencia</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )
          ) : null}
        </div>
      </div>

      <div className="dispatch-map-area">
        <div ref={mapRef} className="dispatch-google-map"></div>
        <div className="map-legend">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: cfg.color }}></span>
              <span>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {showAssignDriver && (
        <div className="modal-backdrop" onClick={() => setShowAssignDriver(null)}>
          <div className="dispatch-modal" onClick={e => e.stopPropagation()}>
            <h3>Asignar Chofer</h3>
            <div className="dm-drivers-list">
              {drivers.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888' }}>No hay choferes registrados</p>
              ) : (
                drivers.map(d => (
                  <button key={d.id} className="dm-driver-option" onClick={() => handleAssignDriver(showAssignDriver, d.id)}>
                    <span className="material-icons">person</span>
                    <div>
                      <strong>{d.username}</strong>
                      <span>{d.email}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="dm-actions">
              <button className="dbtn outline" onClick={() => setShowAssignDriver(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {evidenceModal && (
        <div className="modal-backdrop" onClick={() => setEvidenceModal(null)}>
          <div className="evidence-modal" onClick={e => e.stopPropagation()}>
            <div className="evidence-modal-header">
              <h3>Evidencia de Entrega</h3>
              <button className="evidence-modal-close" onClick={() => setEvidenceModal(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="evidence-modal-info">
              <strong>{evidenceModal.order.customer_name || 'Sin nombre'}</strong>
              <span>{evidenceModal.order.address}</span>
              {evidenceModal.photo.recipient_name && (
                <span>Recibido por: {evidenceModal.photo.recipient_name}</span>
              )}
              {evidenceModal.photo.completed_at && (
                <span>{new Date(evidenceModal.photo.completed_at).toLocaleString('es-MX')}</span>
              )}
            </div>
            <div className="evidence-modal-image">
              <img src={evidenceModal.photo.photo_url} alt="Evidencia de entrega" />
            </div>
          </div>
        </div>
      )}
      {messageModal && (
        <div className="modal-overlay" onClick={() => setMessageModal(null)}>
          <div className="message-modal" onClick={e => e.stopPropagation()}>
            <div className="message-modal-header">
              <h3>Enviar mensaje</h3>
              <button className="evidence-modal-close" onClick={() => setMessageModal(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="message-modal-client">
              <span className="material-icons">person</span>
              <div>
                <strong>{messageModal.customer_name || 'Sin nombre'}</strong>
                <span>{messageModal.customer_phone}</span>
              </div>
            </div>
            {messageSuccess && (
              <div className="message-success">
                <span className="material-icons">check_circle</span>
                {messageSuccess}
              </div>
            )}
            <div className="message-modal-body">
              <h4>Templates de WhatsApp</h4>
              {loadingTemplates ? (
                <div className="message-loading">Cargando templates...</div>
              ) : templates.length === 0 ? (
                <div className="message-empty">No hay templates disponibles. Verifica la configuracion de Respond.io y el canal.</div>
              ) : (
                <div className="template-list">
                  {templates.map((tpl, i) => (
                    <div key={i} className="template-item" onClick={() => sendTemplate(tpl)}>
                      <div className="template-name">
                        <span className="material-icons" style={{ fontSize: 18, color: '#25D366' }}>description</span>
                        {tpl.name}
                      </div>
                      {tpl.body && <div className="template-body">{tpl.body}</div>}
                      <div className="template-meta">
                        {tpl.language && <span>{tpl.language}</span>}
                        {tpl.status && <span className={`template-status ${tpl.status}`}>{tpl.status}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {sendingMessage && (
              <div className="message-sending">
                <span className="material-icons rotating">hourglass_empty</span>
                Enviando...
              </div>
            )}
          </div>
        </div>
      )}

      {showManualOrder && (
        <div className="order-modal-overlay" onClick={() => setShowManualOrder(false)}>
          <div className="order-modal" onClick={e => e.stopPropagation()}>
            <div className="order-modal-header">
              <span className="material-icons">add_location_alt</span>
              <h3>Nueva Orden Manual</h3>
              <button className="order-modal-close" onClick={() => setShowManualOrder(false)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="order-modal-body">
              {manualOrderError && <div className="order-modal-error">{manualOrderError}</div>}
              <div className="order-form-field">
                <label>Nombre del cliente *</label>
                <input type="text" value={manualOrderForm.customer_name} onChange={e => setManualOrderForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="Nombre completo" />
              </div>
              <div className="order-form-field">
                <label>Teléfono</label>
                <input type="tel" value={manualOrderForm.customer_phone} onChange={e => setManualOrderForm(p => ({ ...p, customer_phone: e.target.value }))} placeholder="+1 (000) 000-0000" />
              </div>
              <div className="order-form-field">
                <label>Dirección *</label>
                <div className="order-address-row">
                  <input type="text" value={manualOrderForm.validated_address} onChange={e => { setManualOrderForm(p => ({ ...p, validated_address: e.target.value })); setManualOrderGeo(null) }} placeholder="123 Main St, Dallas TX 75201" />
                  <button className="btn-geocode" onClick={handleManualGeocode} disabled={manualOrderGeoLoading || !manualOrderForm.validated_address.trim()}>
                    {manualOrderGeoLoading ? <span className="material-icons rotating">hourglass_empty</span> : <span className="material-icons">my_location</span>}
                  </button>
                </div>
                {manualOrderGeo && (
                  <div className="geocode-result">
                    <span className="material-icons" style={{ color: '#4caf50', fontSize: 16 }}>check_circle</span>
                    {manualOrderGeo.formatted_address}
                    {manualOrderGeo.zip_code && <span className="geocode-detail"> · ZIP {manualOrderGeo.zip_code}</span>}
                    {manualOrderGeo.city && <span className="geocode-detail"> · {manualOrderGeo.city}, {manualOrderGeo.state}</span>}
                  </div>
                )}
              </div>
              <div className="order-form-row">
                <div className="order-form-field">
                  <label>Costo ($)</label>
                  <input type="number" step="0.01" min="0" value={manualOrderForm.order_cost} onChange={e => setManualOrderForm(p => ({ ...p, order_cost: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="order-form-field">
                  <label>Depósito ($)</label>
                  <input type="number" step="0.01" min="0" value={manualOrderForm.deposit_amount} onChange={e => setManualOrderForm(p => ({ ...p, deposit_amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="order-form-field">
                  <label>Total a cobrar</label>
                  <input type="text" readOnly value={`$${calcTotal(manualOrderForm)}`} className="readonly-field" />
                </div>
              </div>
              <div className="order-form-field">
                <label>Notas</label>
                <textarea value={manualOrderForm.notes} onChange={e => setManualOrderForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notas internas..." rows={2} />
              </div>
            </div>
            <div className="order-modal-footer">
              <button className="dbtn outline" onClick={() => setShowManualOrder(false)}>Cancelar</button>
              <button className="dbtn purple" onClick={handleSaveManualOrder} disabled={manualOrderSaving}>
                {manualOrderSaving ? <span className="material-icons rotating">hourglass_empty</span> : <span className="material-icons">save</span>}
                Guardar Orden
              </button>
            </div>
          </div>
        </div>
      )}

      {editOrderModal && (
        <div className="order-modal-overlay" onClick={() => setEditOrderModal(null)}>
          <div className="order-modal" onClick={e => e.stopPropagation()}>
            <div className="order-modal-header">
              <span className="material-icons">edit</span>
              <h3>Editar Orden #{editOrderModal.id}</h3>
              <button className="order-modal-close" onClick={() => setEditOrderModal(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="order-modal-body">
              {editOrderError && <div className="order-modal-error">{editOrderError}</div>}
              <div className="order-form-field">
                <label>Nombre del cliente</label>
                <input type="text" value={editOrderForm.customer_name} onChange={e => setEditOrderForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="Nombre completo" />
              </div>
              <div className="order-form-field">
                <label>Teléfono</label>
                <input type="tel" value={editOrderForm.customer_phone} onChange={e => setEditOrderForm(p => ({ ...p, customer_phone: e.target.value }))} placeholder="+1 (000) 000-0000" />
              </div>
              <div className="order-form-field">
                <label>Dirección</label>
                <div className="order-address-row">
                  <input type="text" value={editOrderForm.validated_address} onChange={e => { setEditOrderForm(p => ({ ...p, validated_address: e.target.value })); setEditOrderGeo(null) }} placeholder="123 Main St, Dallas TX 75201" />
                  <button className="btn-geocode" onClick={handleEditGeocode} disabled={editOrderGeoLoading || !editOrderForm.validated_address.trim()}>
                    {editOrderGeoLoading ? <span className="material-icons rotating">hourglass_empty</span> : <span className="material-icons">my_location</span>}
                  </button>
                </div>
                {editOrderGeo && (
                  <div className="geocode-result">
                    <span className="material-icons" style={{ color: '#4caf50', fontSize: 16 }}>check_circle</span>
                    {editOrderGeo.formatted_address}
                    {editOrderGeo.zip_code && <span className="geocode-detail"> · ZIP {editOrderGeo.zip_code}</span>}
                    {editOrderGeo.city && <span className="geocode-detail"> · {editOrderGeo.city}, {editOrderGeo.state}</span>}
                  </div>
                )}
              </div>
              <div className="order-form-row">
                <div className="order-form-field">
                  <label>Costo ($)</label>
                  <input type="number" step="0.01" min="0" value={editOrderForm.order_cost} onChange={e => setEditOrderForm(p => ({ ...p, order_cost: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="order-form-field">
                  <label>Depósito ($)</label>
                  <input type="number" step="0.01" min="0" value={editOrderForm.deposit_amount} onChange={e => setEditOrderForm(p => ({ ...p, deposit_amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="order-form-field">
                  <label>Total a cobrar</label>
                  <input type="text" readOnly value={`$${calcTotal(editOrderForm)}`} className="readonly-field" />
                </div>
              </div>
              <div className="order-form-field">
                <label>Notas</label>
                <textarea value={editOrderForm.notes} onChange={e => setEditOrderForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notas internas..." rows={2} />
              </div>
            </div>
            <div className="order-modal-footer">
              <button className="dbtn outline" onClick={() => setEditOrderModal(null)}>Cancelar</button>
              <button className="dbtn purple" onClick={handleSaveEditOrder} disabled={editOrderSaving}>
                {editOrderSaving ? <span className="material-icons rotating">hourglass_empty</span> : <span className="material-icons">save</span>}
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
