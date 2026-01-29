import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMessaging } from '../../contexts/MessagingContext'
import api from '../../api'
import './MessagingPages.css'

export default function OrdersPage() {
  const navigate = useNavigate()
  const { orders, stats, settings, fetchOrders, fetchStats, fetchSettings, confirmOrder, cancelOrder, completeOrder, loading } = useMessaging()
  const [filter, setFilter] = useState('')
  const [showValidateZip, setShowValidateZip] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState(null)
  const [zipForm, setZipForm] = useState({ 
    zip_code: '', 
    contact_name: '', 
    platform: 'facebook' 
  })

  const platforms = [
    { id: 'facebook', label: 'Facebook', icon: 'facebook' },
    { id: 'instagram', label: 'Instagram', icon: 'photo_camera' },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'chat' },
    { id: 'sms', label: 'SMS', icon: 'sms' },
    { id: 'email', label: 'Email', icon: 'email' },
    { id: 'phone', label: 'Telefono', icon: 'phone' }
  ]

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

  const handleValidateZip = async () => {
    if (!zipForm.zip_code) return
    setValidating(true)
    setValidationResult(null)
    try {
      const response = await api.post('/api/messaging/validate-zip', {
        zip_code: zipForm.zip_code,
        contact_name: zipForm.contact_name,
        platform: zipForm.platform
      })
      setValidationResult(response.data)
    } catch (err) {
      console.error('Error validating ZIP:', err)
      setValidationResult({ 
        success: false, 
        hasCoverage: false, 
        message: 'Error al validar el codigo postal' 
      })
    } finally {
      setValidating(false)
    }
  }

  const handleCloseValidation = () => {
    setShowValidateZip(false)
    setZipForm({ zip_code: '', contact_name: '', platform: 'facebook' })
    setValidationResult(null)
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
        <button className="btn-primary" onClick={() => setShowValidateZip(true)}>
          <span className="material-icons">pin_drop</span>
          Validar ZIP
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

      {showValidateZip && (
        <div className="modal-backdrop" onClick={handleCloseValidation}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Validar Codigo Postal</h3>
              <button className="modal-close" onClick={handleCloseValidation}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 16px', color: '#666', fontSize: '14px' }}>
                Valida la cobertura para contactos que no provienen de Respond.io
              </p>
              
              <div className="field-group">
                <label>Codigo Postal (ZIP)</label>
                <input
                  type="text"
                  value={zipForm.zip_code}
                  onChange={(e) => setZipForm({ ...zipForm, zip_code: e.target.value })}
                  placeholder="Ej: 75104"
                  autoFocus
                />
              </div>

              <div className="field-group">
                <label>Nombre del contacto (opcional)</label>
                <input
                  type="text"
                  value={zipForm.contact_name}
                  onChange={(e) => setZipForm({ ...zipForm, contact_name: e.target.value })}
                  placeholder="Nombre del cliente"
                />
              </div>

              <div className="field-group">
                <label>Plataforma de contacto</label>
                <div className="platform-select">
                  {platforms.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`platform-option ${zipForm.platform === p.id ? 'selected' : ''}`}
                      onClick={() => setZipForm({ ...zipForm, platform: p.id })}
                    >
                      <span className="material-icons">{p.icon}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {validationResult && (
                <div className={`validation-result ${validationResult.hasCoverage ? 'success' : 'error'}`}>
                  <span className="material-icons result-icon">
                    {validationResult.hasCoverage ? 'check_circle' : 'cancel'}
                  </span>
                  <h4>
                    {validationResult.hasCoverage ? 'Cobertura Disponible' : 'Sin Cobertura'}
                  </h4>
                  <p>
                    {validationResult.hasCoverage 
                      ? `El codigo postal ${zipForm.zip_code} tiene cobertura de entrega.`
                      : `El codigo postal ${zipForm.zip_code} no esta dentro de nuestra zona de cobertura.`}
                  </p>
                  {validationResult.zone && (
                    <p style={{ marginTop: '8px', fontWeight: '500' }}>
                      Zona: {validationResult.zone.city}, {validationResult.zone.state}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCloseValidation}>Cerrar</button>
              <button 
                className="btn-primary" 
                onClick={handleValidateZip} 
                disabled={validating || !zipForm.zip_code}
              >
                <span className="material-icons">search</span>
                {validating ? 'Validando...' : 'Validar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
