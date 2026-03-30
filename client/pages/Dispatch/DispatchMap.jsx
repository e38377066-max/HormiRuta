import { useEffect, useState, useRef, useCallback } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api'
import './DispatchMap.css'

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: '#9e9e9e', icon: 'hourglass_empty' },
  approved: { label: 'Aprobada', color: '#ffc107', icon: 'check_circle' },
  ordered: { label: 'Ordenada', color: '#2196f3', icon: 'shopping_cart' },
  pickup_ready: { label: 'Listo p/Recoger', color: '#0d47a1', icon: 'inventory_2' },
  on_delivery: { label: 'En Entrega', color: '#ffffff', icon: 'delivery_dining' },
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

function createTriangleIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34">
    <polygon points="17,2 32,32 2,32" fill="${color}" stroke="#fff" stroke-width="2.5"/>
  </svg>`
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}

function createStarIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38">
    <polygon points="19,2 23,14 36,14 26,22 30,34 19,27 8,34 12,22 2,14 15,14" fill="#FFD600" stroke="#fff" stroke-width="2"/>
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
  const [selectionList, setSelectionList] = useState([])
  const [editSelectedOrders, setEditSelectedOrders] = useState([])
  const [editSelectedFavorites, setEditSelectedFavorites] = useState([])
  const [drivers, setDrivers] = useState([])
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [isCreatingRoute, setIsCreatingRoute] = useState(false)
  const [isAddingOrders, setIsAddingOrders] = useState(false)
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
  const [importPassword, setImportPassword] = useState('')
  const [showImportPassword, setShowImportPassword] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [routeInfo, setRouteInfo] = useState(null)
  const [optimizingLive, setOptimizingLive] = useState(false)
  const [deliveredOrders, setDeliveredOrders] = useState([])
  const [loadingDelivered, setLoadingDelivered] = useState(false)
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false)
  const [evidenceModal, setEvidenceModal] = useState(null)
  const [editingBilling, setEditingBilling] = useState(null)
  const [billingValues, setBillingValues] = useState({ order_cost: '', deposit_amount: '', total_to_collect: '' })
  const [messageModal, setMessageModal] = useState(null)
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageSuccess, setMessageSuccess] = useState('')
  const [showManualOrder, setShowManualOrder] = useState(false)
  const [manualOrderForm, setManualOrderForm] = useState({ customer_name: '', customer_phone: '', validated_address: '', order_cost: '', deposit_amount: '', notes: '', apartment_number: '' })
  const [manualOrderGeo, setManualOrderGeo] = useState(null)
  const [manualOrderGeoLoading, setManualOrderGeoLoading] = useState(false)
  const [manualOrderSaving, setManualOrderSaving] = useState(false)
  const [manualOrderError, setManualOrderError] = useState('')
  const [editOrderModal, setEditOrderModal] = useState(null)
  const [editOrderForm, setEditOrderForm] = useState({ customer_name: '', customer_phone: '', validated_address: '', order_cost: '', deposit_amount: '', notes: '', apartment_number: '' })
  const [editOrderGeo, setEditOrderGeo] = useState(null)
  const [editOrderGeoLoading, setEditOrderGeoLoading] = useState(false)
  const [editOrderSaving, setEditOrderSaving] = useState(false)
  const [editOrderError, setEditOrderError] = useState('')
  const [driverCommissions, setDriverCommissions] = useState({})
  const [savingDriverCommission, setSavingDriverCommission] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [loadingFavorites, setLoadingFavorites] = useState(false)
  const [showAddFav, setShowAddFav] = useState(false)
  const [favForm, setFavForm] = useState({ name: '', address: '', customer_phone: '', notes: '' })
  const [favGeo, setFavGeo] = useState(null)
  const [favGeoLoading, setFavGeoLoading] = useState(false)
  const [savingFav, setSavingFav] = useState(false)
  const [favError, setFavError] = useState('')
  const favGeoTimerRef = useRef(null)
  const [editingRouteId, setEditingRouteId] = useState(null)
  const [routeStops, setRouteStops] = useState({})
  const [loadingRouteStops, setLoadingRouteStops] = useState(null)
  const [showAddStopsPanel, setShowAddStopsPanel] = useState(null)
  const [editSearchQuery, setEditSearchQuery] = useState('')
  const [pickupReadyNames, setPickupReadyNames] = useState([])
  const [loadingPickupReady, setLoadingPickupReady] = useState(false)
  const [syncingPickupReady, setSyncingPickupReady] = useState(false)
  const [pickupSyncResult, setPickupSyncResult] = useState(null)

  const selectedOrders = selectionList.filter(x => x.type === 'order').map(x => x.id)
  const selectedFavorites = selectionList.filter(x => x.type === 'favorite').map(x => x.id)

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

  const fetchFavorites = useCallback(async () => {
    try {
      setLoadingFavorites(true)
      const res = await api.get('/api/dispatch/favorites')
      setFavorites(res.data.favorites || [])
    } catch (error) {
      console.error('Error fetching favorites:', error)
    } finally {
      setLoadingFavorites(false)
    }
  }, [])

  const fetchPickupReady = useCallback(async (forceRefresh = false) => {
    try {
      setLoadingPickupReady(true)
      const res = await api.get('/api/email/pickup-ready', { params: forceRefresh ? { refresh: 'true' } : {} })
      const names = (res.data.orders || []).map(o => o.clientName).filter(Boolean)
      setPickupReadyNames(names)
      if (names.length > 0) {
        try {
          const syncRes = await api.post('/api/email/pickup-ready/sync')
          if (syncRes.data?.synced > 0) {
            await fetchData()
          }
        } catch (syncErr) {
          console.error('Error en auto-sync pickup-ready:', syncErr)
        }
      }
    } catch (error) {
      console.error('Error fetching pickup-ready orders:', error)
    } finally {
      setLoadingPickupReady(false)
    }
  }, [fetchData])

  useEffect(() => {
    fetchData()
    fetchFavorites()
    fetchPickupReady()
    const interval = setInterval(fetchData, 180000)
    const pickupInterval = setInterval(() => fetchPickupReady(), 5 * 60 * 1000)
    return () => { clearInterval(interval); clearInterval(pickupInterval) }
  }, [fetchData, fetchFavorites, fetchPickupReady])

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
      const selIndex = selectionList.findIndex(x => x.type === 'order' && x.id === order.id)
      const isSelected = selIndex !== -1
      const editIdx = editSelectedOrders.indexOf(order.id)
      const isEditSelected = showAddStopsPanel !== null && editIdx !== -1
      const isPending = order.order_status === 'pending'
      const isWhite = config.color === '#ffffff'

      let icon
      if (isEditSelected) {
        icon = {
          url: createNumberedIcon(editIdx + 1, '#00897b'),
          scaledSize: new window.google.maps.Size(36, 44),
          anchor: new window.google.maps.Point(18, 44)
        }
      } else if (isSelected) {
        icon = {
          url: createNumberedIcon(selIndex + 1, '#6200ea'),
          scaledSize: new window.google.maps.Size(36, 44),
          anchor: new window.google.maps.Point(18, 44)
        }
      } else if (isPending) {
        icon = {
          url: createTriangleIcon(config.color),
          scaledSize: new window.google.maps.Size(34, 34),
          anchor: new window.google.maps.Point(17, 34)
        }
      } else {
        icon = {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: config.color,
          fillOpacity: 1,
          strokeColor: isWhite ? '#555' : '#fff',
          strokeWeight: isWhite ? 2.5 : 2,
          scale: 10
        }
      }

      const marker = new window.google.maps.Marker({
        position: { lat: order.address_lat, lng: order.address_lng },
        map: mapInstance.current,
        icon,
        title: `${order.customer_name || 'Sin nombre'} - ${order.address}`,
        zIndex: isEditSelected ? 150 : isSelected ? 100 : 1
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
        if (isAdmin && showAddStopsPanel !== null) {
          if (isPending) {
            alert('Los pedidos Pendientes no se pueden agregar a rutas hasta que sean aprobados.')
          } else {
            setEditSelectedOrders(prev =>
              prev.includes(order.id) ? prev.filter(id => id !== order.id) : [...prev, order.id]
            )
          }
        } else {
          infoWindow.open(mapInstance.current, marker)
          if (isAdmin) toggleOrderSelection(order.id)
        }
      })

      markersRef.current.push(marker)
    })

    routes.filter(route => route.status !== 'completed').forEach(route => {
      const stopsToRender = route.route_stops || []
      if (!stopsToRender.length) return
      const driverName = route.status === 'assigned' && route.orders?.[0]?.driver_name ? route.orders[0].driver_name : null
      const colorIdx = driverName ? Math.abs([...driverName].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)) : 0
      const color = driverName ? getDriverColor(colorIdx) : '#6a1b9a'

      stopsToRender.forEach((stop, stopIdx) => {
        if (!stop.lat || !stop.lng) return

        const marker = new window.google.maps.Marker({
          position: { lat: stop.lat, lng: stop.lng },
          map: mapInstance.current,
          icon: {
            url: createNumberedIcon(stopIdx + 1, color),
            scaledSize: new window.google.maps.Size(36, 44),
            anchor: new window.google.maps.Point(18, 44)
          },
          title: `${stop.customer_name || 'Sin nombre'} - ${stop.address || ''}`,
          zIndex: 50
        })

        const infoContent = `
          <div style="font-family:sans-serif;min-width:200px">
            <strong>${stop.customer_name || 'Sin nombre'}</strong><br/>
            <span style="color:#666">${stop.address || ''}</span><br/>
            <span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:12px">
              ${driverName ? driverName + ' - ' : ''}Parada ${stopIdx + 1}
            </span>
          </div>
        `
        const infoWindow = new window.google.maps.InfoWindow({ content: infoContent })
        marker.addListener('click', () => infoWindow.open(mapInstance.current, marker))

        markersRef.current.push(marker)
      })
    })

    window.__dispatchToggleFav = (favId) => {
      setSelectionList(prev =>
        prev.some(x => x.type === 'favorite' && x.id === favId)
          ? prev.filter(x => !(x.type === 'favorite' && x.id === favId))
          : [...prev, { type: 'favorite', id: favId }]
      )
    }

    favorites.filter(f => f.lat && f.lng).forEach(fav => {
      const selIndex = selectionList.findIndex(x => x.type === 'favorite' && x.id === fav.id)
      const isSelected = selIndex !== -1
      const editFavIdx = editSelectedFavorites.indexOf(fav.id)
      const isEditSelected = showAddStopsPanel !== null && editFavIdx !== -1

      const marker = new window.google.maps.Marker({
        position: { lat: fav.lat, lng: fav.lng },
        map: mapInstance.current,
        icon: isEditSelected ? {
          url: createNumberedIcon(editFavIdx + 1, '#00897b'),
          scaledSize: new window.google.maps.Size(36, 44),
          anchor: new window.google.maps.Point(18, 44)
        } : isSelected ? {
          url: createNumberedIcon(selIndex + 1, '#FFD600'),
          scaledSize: new window.google.maps.Size(36, 44),
          anchor: new window.google.maps.Point(18, 44)
        } : {
          url: createStarIcon(),
          scaledSize: new window.google.maps.Size(38, 38),
          anchor: new window.google.maps.Point(19, 19)
        },
        title: fav.name,
        zIndex: isEditSelected ? 250 : isSelected ? 200 : 200
      })

      const infoContent = `
        <div style="font-family:sans-serif;min-width:180px;padding:4px">
          <strong style="color:#b8860b">★ ${fav.name}</strong><br/>
          <span style="color:#666;font-size:13px">${fav.address || ''}</span>
          ${fav.customer_phone ? `<br/><span style="color:#888;font-size:12px">${fav.customer_phone}</span>` : ''}
          ${fav.notes ? `<br/><em style="color:#aaa;font-size:12px">${fav.notes}</em>` : ''}
          <br/><button onclick="window.__dispatchToggleFav(${fav.id})" style="margin-top:8px;background:${isSelected ? '#e53935' : '#4caf50'};color:white;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:13px;width:100%">
            ${isSelected ? '✕ Quitar de ruta' : '+ Agregar a ruta'}
          </button>
        </div>
      `
      const infoWindow = new window.google.maps.InfoWindow({ content: infoContent })

      marker.addListener('click', () => {
        if (isAdmin && showAddStopsPanel !== null) {
          setEditSelectedFavorites(prev =>
            prev.includes(fav.id) ? prev.filter(id => id !== fav.id) : [...prev, fav.id]
          )
        } else {
          infoWindow.open(mapInstance.current, marker)
        }
      })

      markersRef.current.push(marker)
    })
  }, [orders, selectionList, routes, favorites, showAddStopsPanel, editSelectedOrders, editSelectedFavorites])

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
  }, [selectionList, orders])

  const [dragIdx, setDragIdx] = useState(null)

  const toggleOrderSelection = (orderId) => {
    setSelectionList(prev =>
      prev.some(x => x.type === 'order' && x.id === orderId)
        ? prev.filter(x => !(x.type === 'order' && x.id === orderId))
        : [...prev, { type: 'order', id: orderId }]
    )
  }

  const [manualReorder, setManualReorder] = useState(false)

  const moveItemInSelection = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= selectionList.length) return
    setManualReorder(true)
    setRouteInfo(null)
    setSelectionList(prev => {
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
      moveItemInSelection(dragIdx, targetIdx)
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
      setSelectionList(prev => prev.filter(x => x.type !== 'order'))
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al actualizar')
    }
  }

  const handleCreateRoute = async () => {
    if (!selectedOrders.length && !selectedFavorites.length) return
    if (isCreatingRoute) return
    setIsCreatingRoute(true)
    try {
      let orderedIds = [...selectedOrders]
      let isPreOptimized = false

      if (!manualReorder && routeInfo?.optimizedOrder && routeInfo.optimizedOrder.length === selectedOrders.length) {
        orderedIds = routeInfo.optimizedOrder
        isPreOptimized = true
      }

      const favStops = selectedFavorites.map(fid => favorites.find(f => f.id === fid)).filter(Boolean)

      await api.post('/api/dispatch/routes', {
        name: routeName || undefined,
        order_ids: orderedIds,
        pre_optimized: isPreOptimized,
        favorite_stops: favStops.length ? favStops : undefined
      })
      setSelectionList([])
      setShowCreateRoute(false)
      setRouteName('')
      setRouteInfo(null)
      setManualReorder(false)
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al crear ruta')
    } finally {
      setIsCreatingRoute(false)
    }
  }

  const handleDeleteRoute = async (routeId) => {
    if (!window.confirm('¿Eliminar esta ruta? Las órdenes quedarán disponibles de nuevo.')) return
    try {
      await api.delete(`/api/dispatch/routes/${routeId}`)
      setEditingRouteId(null)
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al eliminar ruta')
    }
  }

  const loadRouteStops = async (routeId) => {
    try {
      setLoadingRouteStops(routeId)
      const res = await api.get(`/api/dispatch/routes/${routeId}/detail`)
      const stops = res.data.route?.stops || res.data.stops || []
      setRouteStops(prev => ({ ...prev, [routeId]: stops }))
    } catch (error) {
      console.error('Error loading route stops:', error)
    } finally {
      setLoadingRouteStops(null)
    }
  }

  const handleRemoveStop = async (routeId, stopId) => {
    try {
      await api.delete(`/api/dispatch/routes/${routeId}/stops/${stopId}`)
      setRouteStops(prev => ({
        ...prev,
        [routeId]: (prev[routeId] || []).filter(s => s.id !== stopId)
      }))
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al quitar parada')
    }
  }

  const handleAddOrdersToRoute = async (routeId) => {
    if (!editSelectedOrders.length && !editSelectedFavorites.length) {
      alert('Selecciona órdenes o favoritas primero')
      return
    }
    if (isAddingOrders) return
    setIsAddingOrders(true)
    try {
      const favStops = editSelectedFavorites.map(fid => favorites.find(f => f.id === fid)).filter(Boolean)
      await api.post(`/api/dispatch/routes/${routeId}/orders`, {
        order_ids: editSelectedOrders,
        favorite_stops: favStops.length ? favStops : undefined
      })
      setEditSelectedOrders([])
      setEditSelectedFavorites([])
      await loadRouteStops(routeId)
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al agregar paradas')
    } finally {
      setIsAddingOrders(false)
    }
  }

  const toggleFavoriteSelection = (favId) => {
    setSelectionList(prev =>
      prev.some(x => x.type === 'favorite' && x.id === favId)
        ? prev.filter(x => !(x.type === 'favorite' && x.id === favId))
        : [...prev, { type: 'favorite', id: favId }]
    )
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
    if (!importPassword || importPassword.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres')
      return
    }
    try {
      const usersToSync = respondUsers
        .filter(u => selectedRespondUsers.includes(u.email))
        .map(u => ({ name: u.name, email: u.email }))
      const res = await api.post('/api/dispatch/sync-drivers', { users: usersToSync, password: importPassword })
      setSyncResult(res.data)
      setSelectedRespondUsers([])
      setImportPassword('')
      setShowImportPassword(false)
      fetchData()
      const updatedUsers = await api.get('/api/dispatch/respond-users')
      setRespondUsers(updatedUsers.data.users || [])
    } catch (error) {
      alert(error.response?.data?.error || 'Error al sincronizar choferes')
    }
  }

  const handleCleanupDuplicates = async () => {
    if (!window.confirm('¿Limpiar duplicados? Esto fusionará registros duplicados por teléfono o contacto.')) return
    setCleaningDuplicates(true)
    try {
      const res = await api.post('/api/dispatch/cleanup-duplicates')
      alert(`Limpieza completada: ${res.data.cleaned} duplicado(s) eliminado(s)`)
      await fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al limpiar duplicados')
    } finally {
      setCleaningDuplicates(false)
    }
  }

  const handleDriverCommission = async (driverId) => {
    const val = parseFloat(driverCommissions[driverId])
    if (isNaN(val) || val < 0) return
    setSavingDriverCommission(driverId)
    try {
      await api.put(`/api/admin/users/${driverId}`, { commission_per_stop: val })
      fetchAllUsers()
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al actualizar comisión')
    } finally {
      setSavingDriverCommission(null)
    }
  }

  const addOrderToFavorites = async (order) => {
    try {
      const res = await api.post('/api/dispatch/favorites', {
        name: order.customer_name || 'Sin nombre',
        address: order.address || order.validated_address,
        lat: order.address_lat,
        lng: order.address_lng,
        customer_phone: order.customer_phone || '',
        notes: order.notes || ''
      })
      setFavorites(prev => [res.data.favorite, ...prev])
    } catch (error) {
      alert(error.response?.data?.error || 'Error al agregar a favoritos')
    }
  }

  const handleRemoveFavorite = async (favId) => {
    try {
      await api.delete(`/api/dispatch/favorites/${favId}`)
      setFavorites(prev => prev.filter(f => f.id !== favId))
    } catch (error) {
      alert(error.response?.data?.error || 'Error al eliminar favorito')
    }
  }

  const isOrderFavorited = (order) => favorites.some(
    f => f.address === (order.address || order.validated_address) && f.name === (order.customer_name || 'Sin nombre')
  )

  const autoGeocodeFav = (address) => {
    if (favGeoTimerRef.current) clearTimeout(favGeoTimerRef.current)
    setFavGeo(null)
    if (!address || address.trim().length < 8) return
    setFavGeoLoading(true)
    favGeoTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/api/dispatch/geocode-address', { params: { address } })
        if (res?.data?.formatted_address) {
          setFavGeo(res.data)
          setFavForm(prev => ({ ...prev, address: res.data.formatted_address }))
          setFavError('')
        } else {
          setFavGeo(null)
        }
      } catch (e) {
        setFavError(e?.response?.data?.error || 'No se pudo geocodificar')
      } finally {
        setFavGeoLoading(false)
      }
    }, 1200)
  }

  const handleSaveFavorite = async () => {
    if (!favForm.name.trim()) { setFavError('Nombre requerido'); return }
    setSavingFav(true)
    setFavError('')
    try {
      const payload = { ...favForm }
      if (favGeo) { payload.lat = favGeo.lat; payload.lng = favGeo.lng }
      const res = await api.post('/api/dispatch/favorites', payload)
      setFavorites(prev => [res.data.favorite, ...prev])
      setShowAddFav(false)
      setFavForm({ name: '', address: '', customer_phone: '', notes: '' })
      setFavGeo(null)
    } catch (e) {
      setFavError(e.response?.data?.error || 'Error al guardar')
    } finally {
      setSavingFav(false)
    }
  }

  const getStatusConfig = (status) => STATUS_CONFIG[status] || { label: '', color: '#9e9e9e', icon: 'circle' }

  const getStopStatusColor = (status) => {
    const map = {
      pending: '#9e9e9e',
      completed: '#4caf50',
      skipped: '#f44336',
      in_progress: '#2196f3',
      ordered: '#2196f3',
      approved: '#ffc107',
      on_delivery: '#ffffff',
      delivered: '#ff6d00',
      ups_shipped: '#9c27b0'
    }
    return map[status] || '#9e9e9e'
  }

  const openManualOrderModal = () => {
    setManualOrderForm({ customer_name: '', customer_phone: '', validated_address: '', order_cost: '', deposit_amount: '', notes: '', apartment_number: '' })
    setManualOrderGeo(null)
    setManualOrderError('')
    setShowManualOrder(true)
  }

  const manualGeoTimerRef = useRef(null)
  const editGeoTimerRef = useRef(null)

  const autoGeocodeManual = useCallback((address) => {
    if (manualGeoTimerRef.current) clearTimeout(manualGeoTimerRef.current)
    setManualOrderGeo(null)
    if (!address || address.trim().length < 8) return
    setManualOrderGeoLoading(true)
    manualGeoTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/api/dispatch/geocode-address', { params: { address } })
        if (res?.data && res.data.formatted_address) {
          setManualOrderGeo(res.data)
          setManualOrderForm(prev => ({ ...prev, validated_address: res.data.formatted_address }))
          setManualOrderError('')
        } else {
          setManualOrderGeo(null)
          setManualOrderError('No se encontró la dirección')
        }
      } catch (e) {
        console.error('Geocode error:', e)
        setManualOrderError(e?.response?.data?.error || 'No se pudo geocodificar')
      } finally {
        setManualOrderGeoLoading(false)
      }
    }, 1200)
  }, [])

  const autoGeocodeEdit = useCallback((address) => {
    if (editGeoTimerRef.current) clearTimeout(editGeoTimerRef.current)
    setEditOrderGeo(null)
    if (!address || address.trim().length < 8) return
    setEditOrderGeoLoading(true)
    editGeoTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/api/dispatch/geocode-address', { params: { address } })
        if (res?.data && res.data.formatted_address) {
          setEditOrderGeo(res.data)
          setEditOrderForm(prev => ({ ...prev, validated_address: res.data.formatted_address }))
          setEditOrderError('')
        } else {
          setEditOrderGeo(null)
          setEditOrderError('No se encontró la dirección')
        }
      } catch (e) {
        console.error('Edit geocode error:', e)
        setEditOrderError(e?.response?.data?.error || 'No se pudo geocodificar')
      } finally {
        setEditOrderGeoLoading(false)
      }
    }, 1200)
  }, [])

  const calcTotal = (form) => {
    if (!form) return '0.00'
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
      notes: order.notes || '',
      apartment_number: order.apartment_number || ''
    })
    setEditOrderGeo(null)
    setEditOrderError('')
    setEditOrderModal(order)
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
    ordered: 'pickup_ready',
    pickup_ready: 'on_delivery',
    on_delivery: 'delivered'
  }

  const getNextStatus = (currentStatus) => ADMIN_TRANSITIONS[currentStatus] || null

  const syncPickupReadyFromGmail = async () => {
    setSyncingPickupReady(true)
    setPickupSyncResult(null)
    try {
      const res = await api.post('/api/email/pickup-ready/sync')
      setPickupSyncResult(res.data)
      if (res.data.synced > 0) {
        await fetchData()
        await fetchPickupReady(true)
      }
    } catch (error) {
      setPickupSyncResult({ success: false, error: error.response?.data?.error || 'Error al sincronizar' })
    } finally {
      setSyncingPickupReady(false)
    }
  }

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
            <div className="dstat" style={{ borderColor: '#0d47a1' }}>
              <span className="dstat-val">{stats.pickup_ready || 0}</span>
              <span className="dstat-label">Listo Recoger</span>
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
            <button
              className="dstat-cleanup-btn"
              title="Limpiar duplicados"
              onClick={handleCleanupDuplicates}
              disabled={cleaningDuplicates}
            >
              <span className="material-icons">{cleaningDuplicates ? 'hourglass_empty' : 'auto_fix_high'}</span>
            </button>
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
            <button className={`dtab ${activeTab === 'favorites' ? 'active' : ''}`} style={activeTab === 'favorites' ? { color: '#FFD600', borderBottomColor: '#FFD600' } : {}} onClick={() => { setActiveTab('favorites'); if (favorites.length === 0) fetchFavorites() }}>
              <span className="material-icons">star</span> Favoritas
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
                <option value="pending">Pendientes</option>
                <option value="approved">Aprobadas</option>
                <option value="ordered">Ordenadas</option>
                <option value="pickup_ready">Listo p/Recoger</option>
                <option value="on_delivery">En Entrega</option>
                <option value="ups_shipped">UPS Shipped</option>
                <option value="delivered">Entregadas</option>
              </select>
              <button
                className="btn-add-manual-order"
                onClick={syncPickupReadyFromGmail}
                disabled={syncingPickupReady}
                title="Sincronizar Gmail Pickup Ready"
                style={{ background: '#0d47a1', marginRight: 4 }}
              >
                <span className="material-icons" style={{ fontSize: 18 }}>
                  {syncingPickupReady ? 'hourglass_empty' : 'mark_email_read'}
                </span>
              </button>
              <button className="btn-add-manual-order" onClick={openManualOrderModal} title="Agregar orden manual">
                <span className="material-icons">add</span>
              </button>
            </div>
          </div>
        )}

        {isAdmin && pickupSyncResult && (
          <div className="pickup-sync-result" style={{
            padding: '8px 12px', margin: '4px 8px', borderRadius: 8,
            background: pickupSyncResult.success ? '#0d47a1' : '#c62828',
            color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6
          }}>
            <span className="material-icons" style={{ fontSize: 16 }}>
              {pickupSyncResult.success ? 'check_circle' : 'error'}
            </span>
            {pickupSyncResult.success
              ? `${pickupSyncResult.synced} orden(es) marcadas como Listo p/Recoger`
              : (pickupSyncResult.error || 'Error al sincronizar')}
            <button onClick={() => setPickupSyncResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
              <span className="material-icons" style={{ fontSize: 14 }}>close</span>
            </button>
          </div>
        )}

        {isAdmin && (selectedOrders.length > 0 || selectedFavorites.length > 0) && (
          <div className="dispatch-selection-panel">
            <div className="selection-header">
              <div className="selected-count">
                <span className="material-icons">check_circle</span>
                {selectedOrders.length + selectedFavorites.length} parada{(selectedOrders.length + selectedFavorites.length) > 1 ? 's' : ''}
                {optimizingLive && <span className="route-calc"> calculando...</span>}
                {routeInfo && !optimizingLive && (
                  <span className="route-info-inline">
                    <span className="material-icons">directions_car</span>
                    {routeInfo.distance} km - {routeInfo.duration} min
                  </span>
                )}
              </div>
              <button className="sel-clear-btn" onClick={() => { setSelectionList([]); setShowCreateRoute(false); setRouteName('') }} title="Limpiar">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="selection-stops-list">
              {selectionList.map((item, idx) => {
                const isFav = item.type === 'favorite'
                const o = !isFav ? orders.find(x => x.id === item.id) : null
                const fav = isFav ? favorites.find(f => f.id === item.id) : null
                if (!o && !fav) return null
                const label = isFav ? fav.name : (o.customer_name || 'Sin nombre')
                const addr = isFav ? (fav.address || '') : (o.address || '')
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={`sel-stop-item ${dragIdx === idx ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                  >
                    <span className="sel-stop-number" style={isFav ? { background: '#FFD600', color: '#333' } : {}}>{idx + 1}</span>
                    <div className="sel-stop-info">
                      <span className="sel-stop-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isFav && <span className="material-icons" style={{ fontSize: 13, color: '#FFD600' }}>star</span>}
                        {label}
                      </span>
                      <span className="sel-stop-addr">{addr}</span>
                    </div>
                    <div className="sel-stop-actions">
                      <button onClick={(e) => { e.stopPropagation(); moveItemInSelection(idx, idx - 1) }} disabled={idx === 0} className="sel-move-btn">
                        <span className="material-icons">arrow_upward</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); moveItemInSelection(idx, idx + 1) }} disabled={idx === selectionList.length - 1} className="sel-move-btn">
                        <span className="material-icons">arrow_downward</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          isFav ? toggleFavoriteSelection(item.id) : toggleOrderSelection(item.id)
                        }}
                        className="sel-remove-btn"
                      >
                        <span className="material-icons">remove_circle_outline</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="selection-bottom-actions">
              {selectedOrders.length > 0 && (
                <div className="status-btns-row">
                  <button className="dbtn blue" onClick={() => handleBulkStatus('ordered')} title="Ordenada">
                    <span className="material-icons">shopping_cart</span>
                  </button>
                  <button
                    className="dbtn"
                    style={{ background: '#fff', color: '#333', border: '1.5px solid #bbb' }}
                    onClick={() => handleBulkStatus('on_delivery')}
                    title="En Entrega"
                  >
                    <span className="material-icons" style={{ color: '#333' }}>delivery_dining</span>
                  </button>
                  <button className="dbtn green" onClick={() => handleBulkStatus('delivered')} title="Entregada">
                    <span className="material-icons">done_all</span>
                  </button>
                </div>
              )}

              {!showCreateRoute ? (
                <button className="create-route-btn" onClick={() => setShowCreateRoute(true)}>
                  <span className="material-icons">add_road</span>
                  Crear Ruta con {selectionList.length} parada{selectionList.length > 1 ? 's' : ''}
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
                    <button className="dbtn purple" onClick={handleCreateRoute} disabled={isCreatingRoute}>
                      <span className="material-icons">check</span> {isCreatingRoute ? 'Creando...' : 'Crear'}
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
              const filteredFavs = searchQuery
                ? favorites.filter(f => (f.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (f.address || '').toLowerCase().includes(searchQuery.toLowerCase()))
                : favorites
              return (
              <>
              {filtered.length === 0 && filteredFavs.length === 0 ? (
                <div className="empty-dispatch">
                  <span className="material-icons">inbox</span>
                  <p>{searchQuery ? 'No se encontraron ordenes' : 'No hay ordenes con direccion'}</p>
                </div>
              ) : null}
              {filtered.map(order => {
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
                    <div className="do-status-dot" style={{ backgroundColor: cfg.color, border: cfg.color === '#ffffff' ? '2px solid #555' : 'none' }}></div>
                    <div className="do-content">
                      <div className="do-top">
                        <span className="do-name">{order.customer_name || 'Sin nombre'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={e => { e.stopPropagation(); if (!isOrderFavorited(order)) addOrderToFavorites(order) }}
                            title={isOrderFavorited(order) ? 'Ya en favoritos' : 'Agregar a favoritos'}
                            style={{ background: 'none', border: 'none', cursor: isOrderFavorited(order) ? 'default' : 'pointer', padding: '2px', display: 'flex', color: isOrderFavorited(order) ? '#FFD600' : '#555555' }}
                          >
                            <span className="material-icons" style={{ fontSize: '22px' }}>{isOrderFavorited(order) ? 'star' : 'star_border'}</span>
                          </button>
                          <span className="do-id">#{order.id}</span>
                        </div>
                      </div>
                      <div className="do-address">{order.address || 'Sin direccion'}{order.apartment_number && <span className="do-apt"> Apt {order.apartment_number}</span>}</div>
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
                        <span className="do-tag" style={{ backgroundColor: cfg.color === '#ffffff' ? '#f5f5f5' : `${cfg.color}20`, color: cfg.color === '#ffffff' ? '#555' : cfg.color, borderColor: cfg.color === '#ffffff' ? '#999' : cfg.color }}>
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
                          <div className="do-lifecycle-row">
                            {getNextStatus(order.order_status) && (() => {
                              const nextCfg = getStatusConfig(getNextStatus(order.order_status))
                              const isWhiteBg = nextCfg.color === '#ffffff'
                              return (
                                <button
                                  className="dbtn do-lifecycle-btn"
                                  style={{ backgroundColor: nextCfg.color, color: isWhiteBg ? '#333' : '#fff', border: isWhiteBg ? '1px solid #bbb' : 'none' }}
                                  onClick={() => handleUpdateStatus(order.id, getNextStatus(order.order_status))}
                                >
                                  <span className="material-icons" style={{ fontSize: '16px', color: isWhiteBg ? '#333' : '#fff' }}>{nextCfg.icon}</span>
                                  {nextCfg.label}
                                </button>
                              )
                            })()}
                          </div>
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
              })}
              {filteredFavs.length > 0 && (
                <div className="fav-orders-section">
                  <div className="fav-orders-header">
                    <span className="material-icons" style={{ color: '#FFD600', fontSize: 16 }}>star</span>
                    <span>Favoritas</span>
                  </div>
                  {filteredFavs.map(fav => {
                    const isFavSelected = selectedFavorites.includes(fav.id)
                    return (
                      <div
                        key={fav.id}
                        className={`dispatch-order ${isFavSelected ? 'selected' : ''}`}
                        onClick={() => { if (isAdmin) toggleFavoriteSelection(fav.id); if (mapInstance.current && fav.lat && fav.lng) { mapInstance.current.panTo({ lat: fav.lat, lng: fav.lng }); mapInstance.current.setZoom(15) } }}
                      >
                        <div className="do-status-dot" style={{ backgroundColor: '#FFD600', border: 'none' }}></div>
                        <div className="do-content">
                          <div className="do-top">
                            <span className="do-name">{fav.name}</span>
                            {isAdmin && <span className="material-icons" style={{ fontSize: 18, color: isFavSelected ? '#FFD600' : '#aaa', marginLeft: 'auto' }}>{isFavSelected ? 'star' : 'star_border'}</span>}
                          </div>
                          {fav.address && <div className="do-addr">{fav.address}</div>}
                          {fav.customer_phone && <div className="do-phone">{fav.customer_phone}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              </>
              )
            })()
          ) : activeTab === 'routes' ? (
            (() => {
              const activeRoutes = routes.filter(route => route.status !== 'completed')
              return activeRoutes.length === 0 ? (
              <div className="empty-dispatch">
                <span className="material-icons">route</span>
                <p>No hay rutas activas</p>
              </div>
            ) : (
              activeRoutes.map((route) => {
                const driverName = route.status === 'assigned' && route.orders?.[0]?.driver_name ? route.orders[0].driver_name : null
                const driverColorIdx = driverName ? Math.abs([...driverName].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)) : 0
                const driverColor = driverName ? getDriverColor(driverColorIdx) : '#999'
                const isEditing = editingRouteId === route.id
                const stops = routeStops[route.id] || []
                return (
                <div key={route.id} className="dispatch-route-card" style={{ borderLeftColor: driverColor }}>
                  <div className="dr-header">
                    <span className="dr-name">
                      {route.status === 'assigned' && <span className="dr-color-dot" style={{ backgroundColor: driverColor }}></span>}
                      {route.name}
                    </span>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span className={`dr-status ${route.status}`}>{route.status === 'assigned' ? 'Asignada' : route.status === 'draft' ? 'Borrador' : route.status}</span>
                      {isAdmin && (
                        <button
                          className="dbtn outline small"
                          style={{ padding: '2px 7px', fontSize: 12 }}
                          onClick={() => {
                            if (isEditing) { setEditingRouteId(null) }
                            else { setEditingRouteId(route.id); if (!routeStops[route.id]) loadRouteStops(route.id) }
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: 14 }}>{isEditing ? 'close' : 'edit'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="dr-info">
                    <span><span className="material-icons">pin_drop</span> {route.stops_count} paradas</span>
                    {route.total_amount > 0 && <span><span className="material-icons">attach_money</span> ${route.total_amount.toFixed(2)}</span>}
                    {route.driver_commission_total > 0 && (
                      <span className="dr-commission"><span className="material-icons">paid</span> Chofer: ${route.driver_commission_total.toFixed(2)}</span>
                    )}
                  </div>

                  {route.status === 'completed' && route.route_total_collected > 0 && (
                    <div style={{ marginTop: 6 }}>
                      {route.payment_delivered ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#22c55e', fontWeight: 600 }}>
                          <span className="material-icons" style={{ fontSize: 15 }}>check_circle</span>
                          Entregado: ${Number(route.route_total_collected).toFixed(2)}
                          {route.payment_delivery_method && (
                            <span style={{ fontWeight: 400, color: '#555', marginLeft: 2 }}>
                              ({route.payment_delivery_method === 'cash' ? 'Efectivo' :
                                route.payment_delivery_method === 'card' ? 'Tarjeta' :
                                route.payment_delivery_method === 'transfer' ? 'Transferencia' :
                                route.payment_delivery_method === 'check' ? 'Cheque' :
                                route.payment_delivery_method === 'zelle' ? 'Zelle' :
                                route.payment_delivery_method})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                          <span className="material-icons" style={{ fontSize: 15 }}>pending</span>
                          Total a Cobrar: ${Number(route.route_total_collected).toFixed(2)}
                          <span style={{ fontWeight: 400, color: '#888' }}>(pendiente)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {isEditing && isAdmin && (
                    <div className="dr-edit-panel">
                      {loadingRouteStops === route.id ? (
                        <div className="loading-center" style={{ padding: 12 }}><div className="spinner"></div></div>
                      ) : (
                        <>
                          <div className="dr-edit-stops">
                            {stops.length === 0 ? (
                              <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Sin paradas</p>
                            ) : stops.map((s, i) => (
                              <div key={s.id} className="dr-edit-stop-row">
                                <span className="dr-edit-stop-num">{i + 1}</span>
                                <span className="dr-edit-stop-name">{s.customer_name || s.address || 'Parada'}</span>
                                <button
                                  className="dr-edit-stop-remove"
                                  title="Quitar parada"
                                  onClick={() => handleRemoveStop(route.id, s.id)}
                                >
                                  <span className="material-icons">remove_circle_outline</span>
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="dr-edit-actions">
                            <button
                              className="dbtn outline small full"
                              onClick={() => {
                                if (showAddStopsPanel === route.id) {
                                  setShowAddStopsPanel(null)
                                  setEditSelectedOrders([])
                                  setEditSelectedFavorites([])
                                  setEditSearchQuery('')
                                } else {
                                  setShowAddStopsPanel(route.id)
                                  setEditSearchQuery('')
                                }
                              }}
                            >
                              <span className="material-icons">add_location_alt</span>
                              {showAddStopsPanel === route.id ? 'Cancelar' : 'Agregar paradas'}
                            </button>

                            {showAddStopsPanel === route.id && (() => {
                              const q = editSearchQuery.toLowerCase()
                              const filteredOrders = orders.filter(o =>
                                !q || (o.customer_name || '').toLowerCase().includes(q) || (o.address || '').toLowerCase().includes(q)
                              )
                              const filteredFavs = favorites.filter(f =>
                                !q || (f.name || '').toLowerCase().includes(q) || (f.address || '').toLowerCase().includes(q)
                              )
                              return (
                              <div className="dr-add-stops-picker">
                                <div style={{ fontSize: 11, color: '#00897b', background: '#e0f2f1', borderRadius: 6, padding: '5px 8px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span className="material-icons" style={{ fontSize: 13 }}>touch_app</span>
                                  Toca paradas en el mapa o selecciónalas aquí
                                  {editSelectedOrders.length + editSelectedFavorites.length > 0 && (
                                    <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
                                      {editSelectedOrders.length + editSelectedFavorites.length} sel.
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={editSearchQuery}
                                  onChange={e => setEditSearchQuery(e.target.value)}
                                  placeholder="Buscar por nombre o dirección..."
                                  style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #ccc', fontSize: 12, marginBottom: 6, boxSizing: 'border-box' }}
                                />
                                {filteredOrders.length > 0 && (
                                  <>
                                    <div className="dr-add-stops-label">
                                      <span className="material-icons" style={{ fontSize: 13 }}>list_alt</span> Órdenes disponibles
                                    </div>
                                    {filteredOrders.map(o => {
                                      const isSel = editSelectedOrders.includes(o.id)
                                      return (
                                        <div
                                          key={o.id}
                                          className={`dr-add-stop-item ${isSel ? 'selected' : ''}`}
                                          onClick={() => setEditSelectedOrders(prev =>
                                            prev.includes(o.id) ? prev.filter(id => id !== o.id) : [...prev, o.id]
                                          )}
                                        >
                                          <span className="dr-add-stop-check">
                                            <span className="material-icons">{isSel ? 'check_box' : 'check_box_outline_blank'}</span>
                                          </span>
                                          <div className="dr-add-stop-info">
                                            <span className="dr-add-stop-name">{o.customer_name || 'Sin nombre'}</span>
                                            <span className="dr-add-stop-addr">{o.address || ''}</span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </>
                                )}
                                {filteredFavs.length > 0 && (
                                  <>
                                    <div className="dr-add-stops-label" style={{ marginTop: filteredOrders.length ? 8 : 0 }}>
                                      <span className="material-icons" style={{ fontSize: 13, color: '#FFD600' }}>star</span> Favoritas
                                    </div>
                                    {filteredFavs.map(fav => {
                                      const isSel = editSelectedFavorites.includes(fav.id)
                                      return (
                                        <div
                                          key={fav.id}
                                          className={`dr-add-stop-item ${isSel ? 'selected' : ''}`}
                                          onClick={() => setEditSelectedFavorites(prev =>
                                            prev.includes(fav.id) ? prev.filter(id => id !== fav.id) : [...prev, fav.id]
                                          )}
                                        >
                                          <span className="dr-add-stop-check">
                                            <span className="material-icons">{isSel ? 'check_box' : 'check_box_outline_blank'}</span>
                                          </span>
                                          <div className="dr-add-stop-info">
                                            <span className="dr-add-stop-name">
                                              <span style={{ color: '#FFD600', fontSize: 12 }}>★</span> {fav.name}
                                            </span>
                                            <span className="dr-add-stop-addr">{fav.address || ''}</span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </>
                                )}
                                {filteredOrders.length === 0 && filteredFavs.length === 0 && (
                                  <p style={{ fontSize: 12, color: '#888', textAlign: 'center', margin: '8px 0' }}>Sin resultados</p>
                                )}
                                {(editSelectedOrders.length > 0 || editSelectedFavorites.length > 0) && (
                                  <button
                                    className="dbtn green small full"
                                    style={{ marginTop: 8 }}
                                    disabled={isAddingOrders}
                                    onClick={() => { handleAddOrdersToRoute(route.id); setShowAddStopsPanel(null); setEditSearchQuery('') }}
                                  >
                                    <span className="material-icons">save</span>
                                    {isAddingOrders ? 'Guardando...' : `Guardar ${editSelectedOrders.length + editSelectedFavorites.length} parada${(editSelectedOrders.length + editSelectedFavorites.length) > 1 ? 's' : ''}`}
                                  </button>
                                )}
                              </div>
                              )
                            })()}

                            <button className="dbtn red small full" onClick={() => handleDeleteRoute(route.id)}>
                              <span className="material-icons">delete_forever</span>
                              Eliminar ruta
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {!isEditing && (route.route_stops?.length > 0 || route.orders?.length > 0) && (
                    <div className="dr-orders">
                      <div className="dr-orders-scroll">
                        {(route.route_stops?.length > 0 ? route.route_stops : route.orders).map((s, i) => {
                          const name = s.customer_name || s.name || 'Sin nombre'
                          const statusKey = s.status || s.order_status || 'pending'
                          const dotColor = getStopStatusColor(statusKey)
                          const statusLabel = STATUS_CONFIG[statusKey]?.label || ''
                          return (
                            <div key={s.id || i} className="dr-order-mini">
                              <span className="dr-stop-num">{i + 1}</span>
                              <span className="dr-dot" style={{ backgroundColor: dotColor, border: dotColor === '#ffffff' ? '1.5px solid #aaa' : 'none', flexShrink: 0 }}></span>
                              <span className="dr-stop-name-text">{name}</span>
                              {statusLabel && <span className="dr-order-status">{statusLabel}</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {route.is_optimized && (
                    <div className="dr-optimized">
                      <span className="material-icons">check_circle</span> Optimizada
                      {route.total_distance > 0 && <span> - {route.total_distance} km</span>}
                      {route.total_duration > 0 && <span> - ~{route.total_duration} min</span>}
                    </div>
                  )}
                  {isAdmin && route.status === 'draft' && !isEditing && (
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
                  {isAdmin && route.status === 'assigned' && !isEditing && (
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
          })()
          ) : activeTab === 'favorites' ? (
            <div className="favorites-tab">
              <div className="fav-tab-header">
                <h3><span className="material-icons" style={{ color: '#FFD600' }}>star</span> Direcciones Favoritas</h3>
                <button className="dbtn purple small" onClick={() => { setShowAddFav(v => !v); setFavForm({ name: '', address: '', customer_phone: '', notes: '' }); setFavGeo(null); setFavError('') }}>
                  <span className="material-icons">add</span> Agregar
                </button>
              </div>

              {showAddFav && (
                <div className="fav-add-form">
                  <input
                    type="text"
                    placeholder="Nombre *"
                    value={favForm.name}
                    onChange={e => setFavForm(p => ({ ...p, name: e.target.value }))}
                    className="fav-input"
                  />
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Dirección"
                      value={favForm.address}
                      onChange={e => { setFavForm(p => ({ ...p, address: e.target.value })); autoGeocodeFav(e.target.value) }}
                      className="fav-input"
                    />
                    {favGeoLoading && <span className="fav-geo-spin material-icons rotating">sync</span>}
                    {favGeo && !favGeoLoading && <span className="fav-geo-ok material-icons">check_circle</span>}
                  </div>
                  <input
                    type="text"
                    placeholder="Teléfono (opcional)"
                    value={favForm.customer_phone}
                    onChange={e => setFavForm(p => ({ ...p, customer_phone: e.target.value }))}
                    className="fav-input"
                  />
                  <textarea
                    placeholder="Notas (opcional)"
                    value={favForm.notes}
                    onChange={e => setFavForm(p => ({ ...p, notes: e.target.value }))}
                    className="fav-input fav-textarea"
                    rows={2}
                  />
                  {favError && <div className="fav-error">{favError}</div>}
                  <div className="fav-form-btns">
                    <button className="dbtn outline" onClick={() => setShowAddFav(false)}>Cancelar</button>
                    <button className="dbtn purple" onClick={handleSaveFavorite} disabled={savingFav}>
                      <span className="material-icons">{savingFav ? 'hourglass_empty' : 'star'}</span>
                      Guardar
                    </button>
                  </div>
                </div>
              )}

              {loadingFavorites ? (
                <div className="loading-center"><div className="spinner"></div></div>
              ) : favorites.length === 0 ? (
                <div className="empty-dispatch">
                  <span className="material-icons" style={{ color: '#FFD600' }}>star_border</span>
                  <p>No hay favoritas aún.<br/>Agrega direcciones o usa la ★ en las órdenes.</p>
                </div>
              ) : (
                <div className="fav-list">
                  {favorites.map(fav => (
                    <div key={fav.id} className="fav-card" onClick={() => { if (mapInstance.current && fav.lat && fav.lng) { mapInstance.current.panTo({ lat: fav.lat, lng: fav.lng }); mapInstance.current.setZoom(15) } }}>
                      <span className="material-icons fav-star-icon">star</span>
                      <div className="fav-info">
                        <strong>{fav.name}</strong>
                        {fav.address && <span className="fav-addr">{fav.address}</span>}
                        {fav.customer_phone && <span className="fav-phone">{fav.customer_phone}</span>}
                        {fav.notes && <span className="fav-notes">{fav.notes}</span>}
                      </div>
                      <button
                        className="fav-delete-btn"
                        title="Eliminar favorito"
                        onClick={e => { e.stopPropagation(); handleRemoveFavorite(fav.id) }}
                      >
                        <span className="material-icons">delete_outline</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                        <div className="import-password-field">
                          <label>Contraseña para los choferes importados</label>
                          <div className="password-input-wrapper">
                            <input
                              type={showImportPassword ? 'text' : 'password'}
                              placeholder="Mínimo 6 caracteres"
                              value={importPassword}
                              onChange={e => setImportPassword(e.target.value)}
                              className="import-password-input"
                            />
                            <button
                              type="button"
                              className="toggle-pw-btn"
                              onClick={() => setShowImportPassword(v => !v)}
                            >
                              <span className="material-icons">{showImportPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                          </div>
                        </div>
                        <button className="dbtn purple full" onClick={handleSyncDrivers}>
                          <span className="material-icons">person_add</span>
                          Importar {selectedRespondUsers.length} chofer{selectedRespondUsers.length > 1 ? 'es' : ''}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="drivers-section">
                <div className="drivers-section-header">
                  <h3><span className="material-icons">paid</span> Comisión por Parada</h3>
                </div>
                <p className="gc-desc">Valor que cada chofer cobra por parada completada. Cada chofer puede tener un valor diferente.</p>
                <div className="driver-commissions-list">
                  {allUsers.filter(u => u.role === 'driver').length === 0 ? (
                    <p className="drivers-empty">No hay choferes registrados</p>
                  ) : (
                    allUsers.filter(u => u.role === 'driver').map(driver => (
                      <div key={driver.id} className="driver-commission-row">
                        <div className="dc-driver-info">
                          <span className="material-icons">local_shipping</span>
                          <strong>{driver.username}</strong>
                        </div>
                        <div className="dc-input-row">
                          <span className="gc-dollar">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={driverCommissions[driver.id] !== undefined ? driverCommissions[driver.id] : (driver.commission_per_stop || '')}
                            onChange={e => setDriverCommissions(prev => ({ ...prev, [driver.id]: e.target.value }))}
                            className="gc-input"
                          />
                          <button
                            className="dbtn blue small"
                            onClick={() => handleDriverCommission(driver.id)}
                            disabled={savingDriverCommission === driver.id}
                          >
                            <span className="material-icons">{savingDriverCommission === driver.id ? 'hourglass_empty' : 'save'}</span>
                          </button>
                        </div>
                        {driver.commission_per_stop > 0 && driverCommissions[driver.id] === undefined && (
                          <span className="dc-current">Actual: ${parseFloat(driver.commission_per_stop).toFixed(2)}/parada</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
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
                    <div className="do-address">{order.address || 'Sin direccion'}{order.apartment_number && <span className="do-apt"> Apt {order.apartment_number}</span>}</div>
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
          <div className="dispatch-evidence-modal" onClick={e => e.stopPropagation()}>
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
                  <input type="text" value={manualOrderForm.validated_address} onChange={e => { const val = e.target.value; setManualOrderForm(p => ({ ...p, validated_address: val })); autoGeocodeManual(val) }} placeholder="123 Main St, Dallas TX 75201" />
                  {manualOrderGeoLoading && <span className="material-icons rotating geo-indicator">hourglass_empty</span>}
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
              <div className="order-form-field">
                <label>Apt / Unidad</label>
                <input type="text" value={manualOrderForm.apartment_number} onChange={e => setManualOrderForm(p => ({ ...p, apartment_number: e.target.value }))} placeholder="Ej: #201, Suite B" style={{ maxWidth: '200px' }} />
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
                  <input type="text" value={editOrderForm.validated_address} onChange={e => { const val = e.target.value; setEditOrderForm(p => ({ ...p, validated_address: val })); autoGeocodeEdit(val) }} placeholder="123 Main St, Dallas TX 75201" />
                  {editOrderGeoLoading && <span className="material-icons rotating geo-indicator">hourglass_empty</span>}
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
              <div className="order-form-field">
                <label>Apt / Unidad</label>
                <input type="text" value={editOrderForm.apartment_number} onChange={e => setEditOrderForm(p => ({ ...p, apartment_number: e.target.value }))} placeholder="Ej: #201, Suite B" style={{ maxWidth: '200px' }} />
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
