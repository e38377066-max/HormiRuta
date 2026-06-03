import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMessaging } from '../../contexts/MessagingContext'
import { useTranslation } from 'react-i18next'
import api from '../../api'
import './MessagingPages.css'

export default function OrdersPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { orders, stats, settings, fetchOrders, fetchStats, fetchSettings, confirmOrder, cancelOrder, completeOrder, loading } = useMessaging()
  const [filter, setFilter] = useState('')
  const [showValidateZip, setShowValidateZip] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState(null)
  const [validationHistory, setValidationHistory] = useState([])
  const [copySuccess, setCopySuccess] = useState(false)
  const [revalidating, setRevalidating] = useState(false)
  const [zipForm, setZipForm] = useState({ 
    zip_code: '', 
    contact_name: '', 
    platform: 'facebook' 
  })

  const platforms = [
    { id: 'facebook', label: 'Facebook', icon: 'facebook', color: '#1877f2' },
    { id: 'instagram', label: 'Instagram', icon: 'photo_camera', color: '#e4405f' },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'chat', color: '#25d366' },
    { id: 'respond', label: 'Respond.io', icon: 'support_agent', color: '#6366f1' },
    { id: 'sms', label: 'SMS', icon: 'sms', color: '#607d8b' },
    { id: 'email', label: 'Email', icon: 'email', color: '#ea4335' },
    { id: 'phone', label: t('common.phone'), icon: 'phone', color: '#34a853' }
  ]

  const getPlatformInfo = (platformId) => {
    return platforms.find(p => p.id === platformId) || { label: platformId, icon: 'help', color: '#888' }
  }

  useEffect(() => {
    fetchOrders(filter || null)
    fetchStats()
    fetchSettings()
  }, [filter])

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const processedOrders = orders.filter(o => ['confirmed', 'cancelled', 'completed'].includes(o.status))

  const statusOptions = [
    { label: t('orders.filters.all'), value: '' },
    { label: t('orders.filters.pending'), value: 'pending' },
    { label: t('orders.filters.confirmed'), value: 'confirmed' },
    { label: t('orders.filters.inTransit'), value: 'in_transit' },
    { label: t('orders.filters.completed'), value: 'completed' },
    { label: t('orders.filters.cancelled'), value: 'cancelled' }
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
    const map = {
      pending: t('orders.status.pending'),
      confirmed: t('orders.status.confirmed'),
      in_transit: t('orders.status.inTransit'),
      completed: t('orders.status.completed'),
      cancelled: t('orders.status.cancelled')
    }
    return map[status] || status
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const handleValidateZip = async () => {
    if (!zipForm.zip_code) return
    setValidating(true)
    setValidationResult(null)
    setCopySuccess(false)
    try {
      const response = await api.post('/api/messaging/validate-zip', {
        zipOrCity: zipForm.zip_code
      })
      const result = {
        ...response.data,
        hasCoverage: response.data.valid,
        zipCode: zipForm.zip_code,
        contactName: zipForm.contact_name,
        platform: zipForm.platform
      }
      setValidationResult(result)
      
      const historyItem = {
        id: Date.now(),
        zipCode: zipForm.zip_code,
        contactName: zipForm.contact_name || t('orders.placeholders.noName'),
        platform: zipForm.platform,
        hasCoverage: result.valid,
        message: result.message,
        copyMessage: result.copyMessage,
        zone: result.zone,
        timestamp: new Date().toLocaleString(undefined, { 
          day: '2-digit', 
          month: 'short', 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      }
      setValidationHistory(prev => [historyItem, ...prev].slice(0, 50))
    } catch (err) {
      console.error('Error validating ZIP:', err)
      setValidationResult({ 
        success: false, 
        hasCoverage: false, 
        message: t('common.error')
      })
    } finally {
      setValidating(false)
    }
  }

  const handleRevalidate = async () => {
    setRevalidating(true)
    try {
      const res = await api.post('/api/messaging/orders/revalidate')
      const { revalidated, total } = res.data
      alert(t('orders.revalidateComplete', { revalidated, total }))
      fetchOrders(filter || null)
    } catch (err) {
      alert(t('orders.revalidateError'))
    } finally {
      setRevalidating(false)
    }
  }

  const handleCopyMessage = async (message) => {
    if (!message) return
    try {
      await navigator.clipboard.writeText(message)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
      return true
    } catch (err) {
      alert(t('orders.copyError'))
      return false
    }
  }

  const handleCloseValidation = () => {
    setShowValidateZip(false)
    setZipForm({ zip_code: '', contact_name: '', platform: 'facebook' })
    setValidationResult(null)
    setCopySuccess(false)
  }

  const clearHistory = () => {
    setValidationHistory([])
    localStorage.removeItem('zipValidationHistory')
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{t('orders.title')}</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-value">{stats?.todayOrders || 0}</div>
          <div className="stat-label">{t('orders.stats.today')}</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-value">{stats?.pending || 0}</div>
          <div className="stat-label">{t('orders.stats.pending')}</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-value">{stats?.confirmed || 0}</div>
          <div className="stat-label">{t('orders.stats.confirmed')}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-value">{stats?.completed || 0}</div>
          <div className="stat-label">{t('orders.stats.completed')}</div>
        </div>
      </div>

      {!settings?.has_api_token && (
        <div className="alert-card warning">
          <span className="material-icons">warning</span>
          <div className="alert-content">
            <strong>{t('orders.alerts.setupRequired')}</strong>
            <p>{t('orders.alerts.setupMessage')}</p>
          </div>
          <button className="btn-primary" onClick={() => navigate('/messaging/settings')}>{t('orders.actions.configure')}</button>
        </div>
      )}

      <div className="action-bar">
        <button className="btn-primary" onClick={() => setShowValidateZip(true)}>
          <span className="material-icons">pin_drop</span>
          {t('orders.actions.validateZip')}
        </button>
        <button className="btn-secondary" onClick={() => navigate('/messaging/coverage')}>
          <span className="material-icons">map</span>
          {t('orders.actions.coverageZones')}
        </button>
        <button className="btn-accent" onClick={() => navigate('/messaging/settings')}>
          <span className="material-icons">settings</span>
          {t('orders.actions.settings')}
        </button>
        <button className="btn-outline" onClick={handleRevalidate} disabled={revalidating}>
          <span className="material-icons">{revalidating ? 'sync' : 'refresh'}</span>
          {revalidating ? t('orders.actions.validating') : t('orders.actions.revalidate')}
        </button>
      </div>

      <div className="two-column-layout">
        <div className="content-card">
          <div className="card-toolbar">
            <h3>{t('orders.recentOrders')}</h3>
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
          ) : pendingOrders.length === 0 ? (
            <div className="empty-state">
              <span className="material-icons">inbox</span>
              <p>{t('orders.empty.pending')}</p>
              <span className="empty-hint">{t('orders.empty.hint')}</span>
            </div>
          ) : (
            <div className="orders-list">
              {pendingOrders.map(order => (
                <div key={order.id} className="order-card">
                  <div className={`order-icon ${getStatusColor(order.status)}`}>
                    <span className="material-icons">{getStatusIcon(order.status)}</span>
                  </div>
                  <div className="order-info">
                    <div className="order-name">{order.customerName || order.customer_name || t('orders.placeholders.noName')}</div>
                    <div className="order-address">{order.address || t('orders.placeholders.noAddress')}</div>
                    <div className="order-tags">
                      <span className={`tag ${order.validation_status === 'covered' || order.validation_status === 'valid' ? 'success' : 'danger'}`}>
                        {order.validation_status === 'covered' || order.validation_status === 'valid' ? t('orders.validation.covered') : t('orders.validation.noCoverage')}
                      </span>
                      {order.channel_type && <span className="tag outline">{order.channel_type}</span>}
                      {order.lifecycle && <span className="tag lifecycle">{order.lifecycle}</span>}
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
                          <button className="icon-btn success" onClick={() => confirmOrder(order.id)} title={t('orders.actions.confirm')}>
                            <span className="material-icons">check</span>
                          </button>
                          <button className="icon-btn danger" onClick={() => cancelOrder(order.id)} title={t('orders.actions.cancel')}>
                            <span className="material-icons">close</span>
                          </button>
                        </>
                      )}
                      {order.status === 'confirmed' && (
                        <button className="icon-btn primary" onClick={() => completeOrder(order.id)} title={t('orders.actions.complete')}>
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

        <div className="content-card">
          <div className="card-toolbar">
            <h3>
              <span className="material-icons" style={{ marginRight: '8px', fontSize: '20px' }}>history</span>
              {t('orders.validation.historyTitle')}
            </h3>
          </div>

          {processedOrders.length === 0 && validationHistory.length === 0 ? (
            <div className="empty-state small">
              <span className="material-icons">fact_check</span>
              <p>{t('orders.validation.emptyHistory')}</p>
              <span className="empty-hint">{t('orders.validation.historyHint')}</span>
            </div>
          ) : (
            <div className="validation-history-list">
              {processedOrders.map(order => {
                const hasCoverage = order.validation_status === 'covered' || order.validation_status === 'valid'
                return (
                  <div key={order.id} className={`history-card ${hasCoverage ? 'valid' : 'invalid'}`}>
                    <div className="history-status">
                      <span className="material-icons">
                        {order.status === 'confirmed' ? 'check_circle' : order.status === 'completed' ? 'done_all' : 'cancel'}
                      </span>
                    </div>
                    <div className="history-content">
                      <div className="history-top">
                        <span className="history-zip">{order.zip_code || order.address}</span>
                        <span className={`tag ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      <div className="history-name">{order.customerName || order.customer_name || t('orders.placeholders.noName')}</div>
                      <div className="history-time">{formatDate(order.createdAt || order.created_at)}</div>
                    </div>
                  </div>
                )
              })}
              {validationHistory.map(item => {
                const platformInfo = getPlatformInfo(item.platform)
                return (
                  <div key={`manual-${item.id}`} className={`history-card ${item.hasCoverage ? 'valid' : 'invalid'}`}>
                    <div className="history-status">
                      <span className="material-icons">
                        {item.hasCoverage ? 'check_circle' : 'cancel'}
                      </span>
                    </div>
                    <div className="history-content">
                      <div className="history-top">
                        <span className="history-zip">{item.zipCode}</span>
                        <span 
                          className="history-platform" 
                          style={{ backgroundColor: platformInfo.color }}
                          title={platformInfo.label}
                        >
                          <span className="material-icons">{platformInfo.icon}</span>
                          {platformInfo.label}
                        </span>
                      </div>
                      <div className="history-name">{item.contactName}</div>
                      <div className="history-time">{item.timestamp}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showValidateZip && (
        <div className="modal-backdrop" onClick={handleCloseValidation}>
          <div className="modal modal-compact" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('orders.modal.validateTitle')}</h3>
              <button className="modal-close" onClick={handleCloseValidation}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>{t('orders.modal.zipLabel')}</label>
                <input
                  type="text"
                  value={zipForm.zip_code}
                  onChange={(e) => setZipForm({ ...zipForm, zip_code: e.target.value })}
                  placeholder={t('orders.modal.zipPlaceholder')}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleValidateZip()}
                />
              </div>

              <div className="field-group">
                <label>{t('orders.modal.contactLabel')}</label>
                <input
                  type="text"
                  value={zipForm.contact_name}
                  onChange={(e) => setZipForm({ ...zipForm, contact_name: e.target.value })}
                  placeholder={t('orders.modal.contactPlaceholder')}
                />
              </div>

              <div className="field-group">
                <label>{t('orders.modal.platformLabel')}</label>
                <div className="platform-select compact">
                  {platforms.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`platform-option ${zipForm.platform === p.id ? 'selected' : ''}`}
                      onClick={() => setZipForm({ ...zipForm, platform: p.id })}
                      style={zipForm.platform === p.id ? { borderColor: p.color, backgroundColor: `${p.color}15` } : {}}
                    >
                      <span className="material-icons" style={zipForm.platform === p.id ? { color: p.color } : {}}>{p.icon}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {validationResult && (
                <div className={`validation-result ${validationResult.hasCoverage ? 'success' : 'error'}`}>
                  <div className="result-header">
                    <span className="material-icons">
                      {validationResult.hasCoverage ? 'check_circle' : 'cancel'}
                    </span>
                    <div>
                      <h4 style={{ margin: 0 }}>
                        {validationResult.hasCoverage ? t('orders.modal.result.available') : t('orders.modal.result.notAvailable')}
                      </h4>
                      {validationResult.zone && (
                        <p style={{ margin: '4px 0 0', fontSize: '14px' }}>
                          {validationResult.zone.city}, {validationResult.zone.state}
                        </p>
                      )}
                    </div>
                  </div>
                  {validationResult.copyMessage && (
                    <button 
                      className={`btn-copy-full ${copySuccess ? 'copied' : ''}`}
                      onClick={() => handleCopyMessage(validationResult.copyMessage)}
                    >
                      <span className="material-icons">
                        {copySuccess ? 'check' : 'content_copy'}
                      </span>
                      {copySuccess ? t('orders.modal.result.copied') : t('orders.modal.result.copyAction')}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCloseValidation}>{t('orders.actions.close')}</button>
              <button 
                className="btn-primary" 
                onClick={handleValidateZip} 
                disabled={validating || !zipForm.zip_code}
              >
                <span className="material-icons">search</span>
                {validating ? t('orders.actions.validating') : t('orders.actions.validateSubmit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
