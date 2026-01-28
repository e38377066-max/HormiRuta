import { useEffect, useState } from 'react'
import { useMessaging } from '../../contexts/MessagingContext'
import './MessagingPages.css'

export default function OrdersPage() {
  const { orders, stats, settings, fetchOrders, fetchStats, fetchSettings, confirmOrder, cancelOrder, completeOrder, createOrder, loading } = useMessaging()
  const [filter, setFilter] = useState('')
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [newOrder, setNewOrder] = useState({ customer_name: '', customer_phone: '', address: '', notes: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchOrders(filter || null)
    fetchStats()
    fetchSettings()
  }, [filter])

  const statusOptions = [
    { label: 'Todos', value: '' },
    { label: 'Pendientes', value: 'pending' },
    { label: 'Confirmadas', value: 'confirmed' },
    { label: 'En camino', value: 'in_transit' },
    { label: 'Completadas', value: 'completed' },
    { label: 'Canceladas', value: 'cancelled' }
  ]

  const getStatusColor = (status) => {
    const colors = { pending: '#ff9800', confirmed: '#2196f3', in_transit: '#1976d2', completed: '#4caf50', cancelled: '#f44336' }
    return colors[status] || '#9e9e9e'
  }

  const getStatusIcon = (status) => {
    const icons = { pending: '⏰', confirmed: '✓', in_transit: '🚚', completed: '✓✓', cancelled: '✗' }
    return icons[status] || '?'
  }

  const getStatusLabel = (status) => {
    const labels = { pending: 'Pendiente', confirmed: 'Confirmada', in_transit: 'En camino', completed: 'Completada', cancelled: 'Cancelada' }
    return labels[status] || status
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const handleCreateOrder = async () => {
    if (!newOrder.address) return
    setCreating(true)
    try {
      await createOrder(newOrder)
      setShowNewOrder(false)
      setNewOrder({ customer_name: '', customer_phone: '', address: '', notes: '' })
    } catch (err) {
      console.error('Error creating order:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="q-page">
      <h2 className="page-title">
        <span className="title-icon">💬</span>
        Centro de Mensajeria
      </h2>

      <div className="stats-row">
        <div className="stat-card bg-primary">
          <div className="stat-value">{stats?.todayOrders || 0}</div>
          <div className="stat-label">Ordenes Hoy</div>
        </div>
        <div className="stat-card bg-warning">
          <div className="stat-value">{stats?.pending || 0}</div>
          <div className="stat-label">Pendientes</div>
        </div>
        <div className="stat-card bg-info">
          <div className="stat-value">{stats?.confirmed || 0}</div>
          <div className="stat-label">Confirmadas</div>
        </div>
        <div className="stat-card bg-positive">
          <div className="stat-value">{stats?.completed || 0}</div>
          <div className="stat-label">Completadas</div>
        </div>
      </div>

      {!settings?.has_api_token && (
        <div className="warning-card">
          <span className="warning-icon">⚠️</span>
          <div className="warning-content">
            <div className="warning-title">Configuracion Requerida</div>
            <div className="warning-text">Necesitas configurar tu API token de Respond.io para empezar a recibir ordenes.</div>
          </div>
          <a href="/messaging/settings" className="q-btn primary">Configurar</a>
        </div>
      )}

      <div className="action-buttons">
        <button className="q-btn primary" onClick={() => setShowNewOrder(true)}>
          ➕ Nueva Orden
        </button>
        <a href="/messaging/coverage" className="q-btn secondary">
          🗺️ Zonas de Cobertura
        </a>
        <a href="/messaging/settings" className="q-btn accent">
          ⚙️ Configuracion
        </a>
      </div>

      <div className="q-card">
        <div className="card-header">
          <h3>Ordenes Recientes</h3>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="filter-select">
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📥</span>
            <div>No hay ordenes aun</div>
            <div className="empty-caption">Las ordenes apareceran aqui cuando lleguen desde Respond.io</div>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map(order => (
              <div key={order.id} className="order-item">
                <div className="order-avatar" style={{ background: getStatusColor(order.status) }}>
                  {getStatusIcon(order.status)}
                </div>
                <div className="order-content">
                  <div className="order-name">{order.customerName || order.customer_name || 'Sin nombre'}</div>
                  <div className="order-address">{order.address || 'Sin direccion'}</div>
                  <div className="order-chips">
                    <span className={`q-chip ${order.validation_status === 'valid' || order.hasCoverage ? 'positive' : 'negative'}`}>
                      {order.validation_status === 'valid' || order.hasCoverage ? 'Cobertura OK' : 'Sin cobertura'}
                    </span>
                    {order.channel_type && <span className="q-chip outline">{order.channel_type}</span>}
                  </div>
                </div>
                <div className="order-side">
                  <div className="order-date">{formatDate(order.createdAt || order.created_at)}</div>
                  <span className="q-chip" style={{ background: getStatusColor(order.status), color: 'white' }}>
                    {getStatusLabel(order.status)}
                  </span>
                  <div className="order-actions">
                    {order.status === 'pending' && (
                      <>
                        <button className="action-btn positive" onClick={() => confirmOrder(order.id)}>✓</button>
                        <button className="action-btn negative" onClick={() => cancelOrder(order.id)}>✗</button>
                      </>
                    )}
                    {order.status === 'confirmed' && (
                      <button className="action-btn primary" onClick={() => completeOrder(order.id)}>✓✓</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNewOrder && (
        <div className="modal-overlay" onClick={() => setShowNewOrder(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Nueva Orden Manual</h3>
            <div className="modal-form">
              <input
                type="text"
                placeholder="Nombre del cliente"
                value={newOrder.customer_name}
                onChange={(e) => setNewOrder({ ...newOrder, customer_name: e.target.value })}
                className="q-input"
              />
              <input
                type="text"
                placeholder="Telefono"
                value={newOrder.customer_phone}
                onChange={(e) => setNewOrder({ ...newOrder, customer_phone: e.target.value })}
                className="q-input"
              />
              <textarea
                placeholder="Direccion de entrega"
                value={newOrder.address}
                onChange={(e) => setNewOrder({ ...newOrder, address: e.target.value })}
                className="q-input"
                rows={2}
              />
              <textarea
                placeholder="Notas adicionales"
                value={newOrder.notes}
                onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                className="q-input"
                rows={2}
              />
            </div>
            <div className="modal-actions">
              <button className="q-btn flat" onClick={() => setShowNewOrder(false)}>Cancelar</button>
              <button className="q-btn primary" onClick={handleCreateOrder} disabled={creating}>
                {creating ? 'Creando...' : 'Crear Orden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
