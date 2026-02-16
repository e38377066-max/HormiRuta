import { useEffect, useState, useRef, useCallback } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api'
import './DispatchMap.css'

const STATUS_CONFIG = {
  approved: { label: 'Aprobada', color: '#9e9e9e', icon: 'check_circle' },
  on_production: { label: 'En Produccion', color: '#f44336', icon: 'precision_manufacturing' },
  production_finished: { label: 'Produccion Lista', color: '#03a9f4', icon: 'inventory_2' },
  order_picked_up: { label: 'Recogida', color: '#4caf50', icon: 'local_shipping' },
  on_delivery: { label: 'En Entrega', color: '#ff9800', icon: 'delivery_dining' },
  delivered: { label: 'Entregada', color: '#ff6d00', icon: 'done_all' }
}

export default function DispatchMap() {
  const { isAdmin, isDriver } = useAuth()
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const polylineRef = useRef(null)

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
  const [editingAmount, setEditingAmount] = useState(null)
  const [amountValue, setAmountValue] = useState('')
  const [respondUsers, setRespondUsers] = useState([])
  const [selectedRespondUsers, setSelectedRespondUsers] = useState([])
  const [loadingRespondUsers, setLoadingRespondUsers] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [ordersRes, routesRes] = await Promise.all([
        api.get('/api/dispatch/orders', { params: filterStatus ? { status: filterStatus } : {} }),
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

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
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
      const isSelected = selectedOrders.includes(order.id)

      const marker = new window.google.maps.Marker({
        position: { lat: order.address_lat, lng: order.address_lng },
        map: mapInstance.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: isSelected ? '#6200ea' : config.color,
          fillOpacity: 1,
          strokeColor: isSelected ? '#fff' : '#333',
          strokeWeight: isSelected ? 3 : 1.5,
          scale: isSelected ? 14 : 10
        },
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
  }, [orders, selectedOrders])

  useEffect(() => {
    if (!mapInstance.current || !window.google?.maps) return
    if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }

    if (selectedOrders.length < 2) return

    const selectedCoords = selectedOrders
      .map(id => orders.find(o => o.id === id))
      .filter(o => o?.address_lat && o?.address_lng)
      .map(o => ({ lat: o.address_lat, lng: o.address_lng }))

    if (selectedCoords.length < 2) return

    polylineRef.current = new window.google.maps.Polyline({
      path: selectedCoords,
      geodesic: true,
      strokeColor: '#6200ea',
      strokeOpacity: 0.8,
      strokeWeight: 3,
      map: mapInstance.current
    })
  }, [selectedOrders, orders])

  const toggleOrderSelection = (orderId) => {
    setSelectedOrders(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    )
  }

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/api/dispatch/orders/${orderId}/status`, { order_status: newStatus })
      fetchData()
    } catch (error) {
      console.error('Error updating status:', error)
      alert(error.response?.data?.error || 'Error al actualizar estado')
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
      await api.post('/api/dispatch/routes', {
        name: routeName || undefined,
        order_ids: selectedOrders
      })
      setSelectedOrders([])
      setShowCreateRoute(false)
      setRouteName('')
      fetchData()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al crear ruta')
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

  const handleSaveAmount = async (orderId) => {
    try {
      await api.put(`/api/dispatch/orders/${orderId}/amount`, { amount: parseFloat(amountValue) || 0 })
      setEditingAmount(null)
      setAmountValue('')
      fetchData()
    } catch (error) {
      alert('Error al guardar monto')
    }
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

  const ADMIN_TRANSITIONS = {
    approved: 'on_production',
    on_production: 'production_finished',
    production_finished: 'order_picked_up'
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
            <div className="dstat" style={{ borderColor: '#f44336' }}>
              <span className="dstat-val">{stats.on_production || 0}</span>
              <span className="dstat-label">Produccion</span>
            </div>
            <div className="dstat" style={{ borderColor: '#03a9f4' }}>
              <span className="dstat-val">{stats.production_finished || 0}</span>
              <span className="dstat-label">Listas</span>
            </div>
            <div className="dstat" style={{ borderColor: '#4caf50' }}>
              <span className="dstat-val">{stats.order_picked_up || 0}</span>
              <span className="dstat-label">Recogidas</span>
            </div>
            <div className="dstat" style={{ borderColor: '#ff9800' }}>
              <span className="dstat-val">{stats.on_delivery || 0}</span>
              <span className="dstat-label">En Entrega</span>
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
          </div>
        )}

        {isAdmin && (
          <div className="dispatch-filter">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="approved">Aprobadas</option>
              <option value="on_production">En Produccion</option>
              <option value="production_finished">Produccion Lista</option>
              <option value="order_picked_up">Recogidas</option>
              <option value="on_delivery">En Entrega</option>
              <option value="delivered">Entregadas</option>
            </select>
          </div>
        )}

        {isAdmin && selectedOrders.length > 0 && (
          <div className="dispatch-actions">
            <div className="selected-count">
              <span className="material-icons">check_circle</span>
              {selectedOrders.length} seleccionada{selectedOrders.length > 1 ? 's' : ''}
            </div>
            <div className="action-buttons">
              <button className="dbtn red" onClick={() => handleBulkStatus('on_production')} title="En Produccion">
                <span className="material-icons">precision_manufacturing</span>
              </button>
              <button className="dbtn blue" onClick={() => handleBulkStatus('production_finished')} title="Produccion Lista">
                <span className="material-icons">inventory_2</span>
              </button>
              <button className="dbtn green" onClick={() => handleBulkStatus('order_picked_up')} title="Recogida">
                <span className="material-icons">local_shipping</span>
              </button>
              <button className="dbtn purple" onClick={() => setShowCreateRoute(true)} title="Crear Ruta">
                <span className="material-icons">route</span>
              </button>
              <button className="dbtn outline" onClick={() => setSelectedOrders([])} title="Deseleccionar">
                <span className="material-icons">deselect</span>
              </button>
            </div>
          </div>
        )}

        <div className="dispatch-list">
          {loading ? (
            <div className="loading-center"><div className="spinner"></div></div>
          ) : activeTab === 'orders' ? (
            orders.length === 0 ? (
              <div className="empty-dispatch">
                <span className="material-icons">inbox</span>
                <p>No hay ordenes con direccion</p>
              </div>
            ) : (
              orders.map(order => {
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
                      <div className="do-phone">{order.customer_phone || ''}</div>
                      <div className="do-bottom">
                        <span className="do-tag" style={{ backgroundColor: `${cfg.color}20`, color: cfg.color, borderColor: cfg.color }}>
                          <span className="material-icons" style={{ fontSize: '14px' }}>{cfg.icon}</span>
                          {cfg.label}
                        </span>
                        {order.amount > 0 && (
                          <span className="do-amount">${order.amount.toFixed(2)}</span>
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
                          {editingAmount === order.id ? (
                            <div className="do-amount-edit">
                              <input
                                type="number"
                                value={amountValue}
                                onChange={e => setAmountValue(e.target.value)}
                                placeholder="$0.00"
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleSaveAmount(order.id)}
                              />
                              <button onClick={() => handleSaveAmount(order.id)}>
                                <span className="material-icons">check</span>
                              </button>
                              <button onClick={() => setEditingAmount(null)}>
                                <span className="material-icons">close</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              className="do-edit-amount"
                              onClick={() => { setEditingAmount(order.id); setAmountValue(order.amount || '') }}
                              title="Editar monto"
                            >
                              <span className="material-icons">attach_money</span>
                            </button>
                          )}
                        </div>
                      )}

                      {isDriver && order.order_status === 'on_delivery' && (
                        <div className="do-actions" onClick={e => e.stopPropagation()}>
                          <button className="dbtn orange full" onClick={() => handleMarkDelivered(order.id)}>
                            <span className="material-icons">done_all</span> Entregada
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )
          ) : activeTab === 'routes' ? (
            routes.length === 0 ? (
              <div className="empty-dispatch">
                <span className="material-icons">route</span>
                <p>No hay rutas creadas</p>
              </div>
            ) : (
              routes.map(route => (
                <div key={route.id} className="dispatch-route-card">
                  <div className="dr-header">
                    <span className="dr-name">{route.name}</span>
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
                  {isAdmin && route.status === 'draft' && (
                    <div className="dr-actions">
                      <button className="dbtn purple full" onClick={() => setShowAssignDriver(route.id)}>
                        <span className="material-icons">person_add</span> Asignar Chofer
                      </button>
                    </div>
                  )}
                  {route.status === 'assigned' && route.orders?.[0]?.driver_name && (
                    <div className="dr-driver">
                      <span className="material-icons">person</span> {route.orders[0].driver_name}
                    </div>
                  )}
                </div>
              ))
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

      {showCreateRoute && (
        <div className="modal-backdrop" onClick={() => setShowCreateRoute(false)}>
          <div className="dispatch-modal" onClick={e => e.stopPropagation()}>
            <h3>Crear Ruta de Entrega</h3>
            <p>{selectedOrders.length} ordenes seleccionadas</p>
            <div className="dm-field">
              <label>Nombre de la ruta (opcional)</label>
              <input
                type="text"
                value={routeName}
                onChange={e => setRouteName(e.target.value)}
                placeholder="Ej: Ruta Dallas Norte"
              />
            </div>
            <div className="dm-selected-list">
              {selectedOrders.map(id => {
                const o = orders.find(x => x.id === id)
                if (!o) return null
                return (
                  <div key={id} className="dm-selected-item">
                    <span>{o.customer_name || 'Sin nombre'}</span>
                    <span className="dm-addr">{o.address}</span>
                  </div>
                )
              })}
            </div>
            <div className="dm-actions">
              <button className="dbtn outline" onClick={() => setShowCreateRoute(false)}>Cancelar</button>
              <button className="dbtn purple" onClick={handleCreateRoute}>Crear Ruta</button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}
