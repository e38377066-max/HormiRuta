import { useEffect, useState } from 'react'
import { useMessaging } from '../../contexts/MessagingContext'
import './MessagingPages.css'

export default function OrdersPage() {
  const { orders, fetchOrders, confirmOrder, cancelOrder, completeOrder, loading } = useMessaging()
  const [filter, setFilter] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)

  useEffect(() => {
    fetchOrders(filter || null)
  }, [filter])

  const getStatusChip = (status) => {
    const classes = {
      pending: 'chip-warning',
      confirmed: 'chip-info',
      in_progress: 'chip-primary',
      completed: 'chip-positive',
      cancelled: 'chip-negative'
    }
    const labels = {
      pending: 'Pendiente',
      confirmed: 'Confirmada',
      in_progress: 'En Progreso',
      completed: 'Completada',
      cancelled: 'Cancelada'
    }
    return <span className={`chip ${classes[status]}`}>{labels[status] || status}</span>
  }

  const handleConfirm = async (id) => {
    try {
      await confirmOrder(id)
    } catch (error) {
      console.error('Error confirming order:', error)
    }
  }

  const handleComplete = async (id) => {
    try {
      await completeOrder(id)
    } catch (error) {
      console.error('Error completing order:', error)
    }
  }

  const handleCancel = async (id) => {
    if (confirm('Cancelar esta orden?')) {
      try {
        await cancelOrder(id)
      } catch (error) {
        console.error('Error cancelling order:', error)
      }
    }
  }

  return (
    <div className="messaging-page">
      <div className="page-header">
        <h1>Ordenes de Mensajeria</h1>
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === '' ? 'active' : ''}`}
            onClick={() => setFilter('')}
          >
            Todas
          </button>
          <button 
            className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pendientes
          </button>
          <button 
            className={`filter-tab ${filter === 'confirmed' ? 'active' : ''}`}
            onClick={() => setFilter('confirmed')}
          >
            Confirmadas
          </button>
          <button 
            className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completadas
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <p>No hay ordenes</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <span className="order-id">#{order.id}</span>
                {getStatusChip(order.status)}
              </div>
              
              <div className="order-body">
                <div className="order-info">
                  <strong>{order.customerName || 'Cliente'}</strong>
                  <span className="order-phone">{order.customerPhone || '-'}</span>
                </div>
                
                <div className="order-address">
                  <span className="address-icon">📍</span>
                  <span>{order.address || 'Sin direccion'}</span>
                </div>

                {order.zipCode && (
                  <div className="order-zip">
                    <span className={`coverage-badge ${order.hasCoverage ? 'has-coverage' : 'no-coverage'}`}>
                      {order.hasCoverage ? '✓ Con cobertura' : '✗ Sin cobertura'}
                    </span>
                    <span className="zip-code">ZIP: {order.zipCode}</span>
                  </div>
                )}

                {order.notes && (
                  <div className="order-notes">
                    <em>{order.notes}</em>
                  </div>
                )}
              </div>

              <div className="order-actions">
                {order.status === 'pending' && (
                  <>
                    <button className="btn btn-positive btn-small" onClick={() => handleConfirm(order.id)}>
                      Confirmar
                    </button>
                    <button className="btn btn-negative btn-small" onClick={() => handleCancel(order.id)}>
                      Cancelar
                    </button>
                  </>
                )}
                {order.status === 'confirmed' && (
                  <button className="btn btn-primary btn-small" onClick={() => handleComplete(order.id)}>
                    Completar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
