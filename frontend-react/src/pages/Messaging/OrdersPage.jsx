import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMessaging } from '../../contexts/MessagingContext'
import './MessagingPages.css'

export default function OrdersPage() {
  const navigate = useNavigate()
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
    const colors = { pending: 'warning', confirmed: 'info', in_transit: 'primary', completed: 'success', cancelled: 'danger' }
    return colors[status] || 'grey'
  }

  const getStatusIcon = (status) => {
    const icons = { pending: 'schedule', confirmed: 'check_circle', in_transit: 'local_shipping', completed: 'done_all', cancelled: 'cancel' }
    return icons[status] || 'help'
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
    <div className="page-container">
      <div className="page-header">
        <h1>Centro de Mensajeria</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-value">{stats?.todayOrders || 0}</div>
          <div className="stat-label">Ordenes Hoy</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-value">{stats?.pending || 0}</div>
          <div className="stat-label">Pendientes</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-value">{stats?.confirmed || 0}</div>
          <div className="stat-label">Confirmadas</div>
        </div>
        <div className="stat-card green">
          <div className="stat-value">{stats?.completed || 0}</div>
          <div className="stat-label">Completadas</div>
        </div>
      </div>

      {!settings?.has_api_token && (
        <div className="alert-card warning">
          <span className="material-icons">warning</span>
          <div className="alert-content">
            <strong>Configuracion Requerida</strong>
            <p>Necesitas configurar tu API token de Respond.io para empezar a recibir ordenes.</p>
          </div>
          <button className="btn-primary" onClick={() => navigate('/messaging/settings')}>Configurar</button>
        </div>
      )}

      <div className="action-bar">
        <button className="btn-primary" onClick={() => setShowNewOrder(true)}>
          <span className="material-icons">add</span>
          Nueva Orden
        </button>
        <button className="btn-secondary" onClick={() => navigate('/messaging/coverage')}>
          <span className="material-icons">map</span>
          Zonas de Cobertura
        </button>
        <button className="btn-accent" onClick={() => navigate('/messaging/settings')}>
          <span className="material-icons">settings</span>
          Configuracion
        </button>
      </div>

      <div className="content-card">
        <div className="card-toolbar">
          <h3>Ordenes Recientes</h3>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <span className="material-icons">inbox</span>
            <p>No hay ordenes aun</p>
            <span className="empty-hint">Las ordenes apareceran aqui cuando lleguen desde Respond.io</span>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map(order => (
              <div key={order.id} className="order-card">
                <div className={`order-icon ${getStatusColor(order.status)}`}>
                  <span className="material-icons">{getStatusIcon(order.status)}</span>
                </div>
                <div className="order-info">
                  <div className="order-name">{order.customerName || order.customer_name || 'Sin nombre'}</div>
                  <div className="order-address">{order.address || 'Sin direccion'}</div>
                  <div className="order-tags">
                    <span className={`tag ${order.validation_status === 'valid' || order.hasCoverage ? 'success' : 'danger'}`}>
                      {order.validation_status === 'valid' || order.hasCoverage ? 'Cobertura OK' : 'Sin cobertura'}
                    </span>
                    {order.channel_type && <span className="tag outline">{order.channel_type}</span>}
                  </div>
                </div>
                <div className="order-meta">
                  <div className="order-date">{formatDate(order.createdAt || order.created_at)}</div>
                  <span className={`tag ${getStatusColor(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                  <div className="order-actions">
                    {order.status === 'pending' && (
                      <>
                        <button className="icon-btn success" onClick={() => confirmOrder(order.id)} title="Confirmar">
                          <span className="material-icons">check</span>
                        </button>
                        <button className="icon-btn danger" onClick={() => cancelOrder(order.id)} title="Cancelar">
                          <span className="material-icons">close</span>
                        </button>
                      </>
                    )}
                    {order.status === 'confirmed' && (
                      <button className="icon-btn primary" onClick={() => completeOrder(order.id)} title="Completar">
                        <span className="material-icons">done_all</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNewOrder && (
        <div className="modal-backdrop" onClick={() => setShowNewOrder(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nueva Orden Manual</h3>
              <button className="modal-close" onClick={() => setShowNewOrder(false)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>Nombre del cliente</label>
                <input
                  type="text"
                  value={newOrder.customer_name}
                  onChange={(e) => setNewOrder({ ...newOrder, customer_name: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label>Telefono</label>
                <input
                  type="text"
                  value={newOrder.customer_phone}
                  onChange={(e) => setNewOrder({ ...newOrder, customer_phone: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label>Direccion de entrega</label>
                <textarea
                  rows={2}
                  value={newOrder.address}
                  onChange={(e) => setNewOrder({ ...newOrder, address: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label>Notas adicionales</label>
                <textarea
                  rows={2}
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowNewOrder(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreateOrder} disabled={creating}>
                {creating ? 'Creando...' : 'Crear Orden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
