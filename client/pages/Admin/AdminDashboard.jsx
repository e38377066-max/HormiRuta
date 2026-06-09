/**
 * @fileoverview Panel de administración principal.
 * Proporciona un resumen de estadísticas del sistema y enlaces rápidos a las diferentes secciones de gestión (IA, Usuarios, Rutas, etc.).
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api'
import './AdminPages.css'

const EXPORT_STATUSES = [
  { key: 'available', label: 'Disponible' },
  { key: 'assigned', label: 'Asignado' },
  { key: 'delivered', label: 'Entregado' },
  { key: 'archived', label: 'Archivado' }
]

/**
 * Componente AdminDashboard que centraliza las funciones administrativas.
 * @returns {JSX.Element}
 */
export default function AdminDashboard() {
  const navigate = useNavigate()
  /** @type {[Object, Function]} Estadísticas generales (usuarios, órdenes, etc.) */
  const [stats, setStats] = useState({})
  /** @type {[boolean, Function]} Indica si se están cargando las estadísticas */
  const [loading, setLoading] = useState(true)
  /** @type {[boolean, Function]} Indica si se está realizando un reset del sistema de despacho */
  const [resetting, setResetting] = useState(false)
  /** @type {[Object, Function]} Estados seleccionados para exportación Excel */
  const [exportStatuses, setExportStatuses] = useState({
    available: true, assigned: true, delivered: false, archived: false
  })
  /** @type {[boolean, Function]} Indica si se está generando el Excel */
  const [exporting, setExporting] = useState(false)
  const { t } = useTranslation()

  /** Carga las estadísticas iniciales al montar el componente */
  useEffect(() => {
    fetchStats()
  }, [])

  /**
   * Obtiene estadísticas administrativas del backend.
   * @async
   */
  const fetchStats = async () => {
    try {
      const response = await api.get('/api/admin/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Error fetching admin stats:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Descarga un Excel con los registros del dispatcher filtrados por los estados seleccionados.
   * @async
   */
  const handleExportExcel = async () => {
    const selected = Object.entries(exportStatuses)
      .filter(([, v]) => v)
      .map(([k]) => k)
    if (selected.length === 0) {
      alert('Selecciona al menos un estado para exportar.')
      return
    }
    setExporting(true)
    try {
      const res = await api.get('/api/admin/dispatch/export', {
        params: { statuses: selected.join(',') },
        responseType: 'blob'
      })
      const url = URL.createObjectURL(new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }))
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toISOString().slice(0, 10)
      a.download = `dispatcher_${dateStr}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Error al exportar. Inténtalo de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  /**
   * Maneja el proceso de borrado completo de los datos de despacho (rutas, paradas, historial).
   * Requiere doble confirmación por seguridad.
   * @async
   */
  const handleResetDispatch = async () => {
    const confirmed = window.confirm(t('admin.resetConfirm1'))
    if (!confirmed) return
    const doubleConfirm = window.confirm(t('admin.resetConfirm2'))
    if (!doubleConfirm) return

    setResetting(true)
    try {
      const res = await api.delete('/api/admin/dispatch/reset')
      const d = res.data.deleted
      alert(t('admin.resetSuccess', {
        addresses: d.addresses,
        routes: d.routes,
        stops: d.stops,
        routeHistory: d.routeHistory,
        photos: d.photos
      }))
      fetchStats()
    } catch (err) {
      alert(t('admin.resetError'))
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1>{t('admin.title')}</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-icon">
            <span className="material-icons">groups</span>
          </div>
          <div className="stat-value">{stats.users?.total || 0}</div>
          <div className="stat-label">{t('admin.stats.totalUsers')}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">
            <span className="material-icons">local_shipping</span>
          </div>
          <div className="stat-value">{stats.users?.drivers || 0}</div>
          <div className="stat-label">{t('admin.stats.drivers')}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon">
            <span className="material-icons">person</span>
          </div>
          <div className="stat-value">{stats.users?.clients || 0}</div>
          <div className="stat-label">{t('admin.stats.clients')}</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon">
            <span className="material-icons">inventory_2</span>
          </div>
          <div className="stat-value">{stats.orders || 0}</div>
          <div className="stat-label">{t('admin.stats.orders')}</div>
        </div>
      </div>

      <div className="admin-sections">

        {/* Cerebro de IA */}
        <div className="admin-section">
          <div className="section-header">
            <span className="material-icons">psychology</span>
            <h3>{t('admin.sections.aiBrain')}</h3>
          </div>
          <div className="section-items">
            <Link to="/admin/bot-memory?tab=lessons" className="section-item">
              <div className="item-icon" style={{ background: 'linear-gradient(135deg, #5b8def, #3b70d4)' }}>
                <span className="material-icons" style={{ color: '#fff' }}>school</span>
              </div>
              <div className="item-content">
                <div className="item-title">{t('admin.items.botLessons')}</div>
                <div className="item-subtitle">{t('admin.items.botLessonsDesc')}</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <Link to="/admin/bot-memory?tab=docs" className="section-item">
              <div className="item-icon" style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}>
                <span className="material-icons" style={{ color: '#fff' }}>library_books</span>
              </div>
              <div className="item-content">
                <div className="item-title">{t('admin.items.docsPrompts')}</div>
                <div className="item-subtitle">{t('admin.items.docsPromptsDesc')}</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <Link to="/admin/bot-memory?tab=media" className="section-item">
              <div className="item-icon" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                <span className="material-icons" style={{ color: '#fff' }}>perm_media</span>
              </div>
              <div className="item-content">
                <div className="item-title">{t('admin.items.audioImages')}</div>
                <div className="item-subtitle">{t('admin.items.audioImagesDesc')}</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
          </div>
        </div>

        {/* Configuración */}
        <div className="admin-section">
          <div className="section-header">
            <span className="material-icons">settings</span>
            <h3>{t('admin.sections.config')}</h3>
          </div>
          <div className="section-items">
            <Link to="/messaging/settings" className="section-item">
              <div className="item-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                <span className="material-icons" style={{ color: '#fff' }}>smart_toy</span>
              </div>
              <div className="item-content">
                <div className="item-title">{t('admin.items.botConfig')}</div>
                <div className="item-subtitle">{t('admin.items.botConfigDesc')}</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <Link to="/messaging/coverage" className="section-item">
              <div className="item-icon cyan">
                <span className="material-icons">map</span>
              </div>
              <div className="item-content">
                <div className="item-title">{t('admin.items.coverageZones')}</div>
                <div className="item-subtitle">{t('admin.items.coverageZonesDesc')}</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
          </div>
        </div>

        {/* Usuarios */}
        <div className="admin-section">
          <div className="section-header">
            <span className="material-icons">people</span>
            <h3>{t('admin.sections.userManagement')}</h3>
          </div>
          <div className="section-items">
            <Link to="/admin/users" className="section-item">
              <div className="item-icon purple">
                <span className="material-icons">manage_accounts</span>
              </div>
              <div className="item-content">
                <div className="item-title">{t('admin.items.allUsers')}</div>
                <div className="item-subtitle">{t('admin.items.allUsersDesc')}</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <Link to="/admin/users?role=driver" className="section-item">
              <div className="item-icon green">
                <span className="material-icons">local_shipping</span>
              </div>
              <div className="item-content">
                <div className="item-title">{t('admin.items.drivers')}</div>
                <div className="item-subtitle">{t('admin.items.driversActive', { count: stats.users?.drivers || 0 })}</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <Link to="/admin/users?role=client" className="section-item">
              <div className="item-icon blue">
                <span className="material-icons">person</span>
              </div>
              <div className="item-content">
                <div className="item-title">{t('admin.items.clients')}</div>
                <div className="item-subtitle">{t('admin.items.clientsRegistered', { count: stats.users?.clients || 0 })}</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
          </div>
        </div>

        {/* Rutas y Entregas */}
        <div className="admin-section">
          <div className="section-header">
            <span className="material-icons">route</span>
            <h3>{t('admin.sections.routesDeliveries')}</h3>
          </div>
          <div className="section-items">
            <Link to="/admin/wholesale" className="section-item">
              <div className="item-icon" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
                <span className="material-icons" style={{ color: '#fff' }}>store</span>
              </div>
              <div className="item-content">
                <div className="item-title">{t('admin.items.wholesaleClients')}</div>
                <div className="item-subtitle">{t('admin.items.wholesaleClientsDesc')}</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <Link to="/admin/routes" className="section-item">
              <div className="item-icon blue">
                <span className="material-icons">history</span>
              </div>
              <div className="item-content">
                <div className="item-title">{t('admin.items.routeHistory')}</div>
                <div className="item-subtitle">{t('admin.items.routeHistoryDesc')}</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <Link to="/admin/accounting" className="section-item">
              <div className="item-icon purple">
                <span className="material-icons">receipt_long</span>
              </div>
              <div className="item-content">
                <div className="item-title">{t('admin.items.driverAccounting')}</div>
                <div className="item-subtitle">{t('admin.items.driverAccountingDesc')}</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <Link to="/dispatch" className="section-item">
              <div className="item-icon green">
                <span className="material-icons">map</span>
              </div>
              <div className="item-content">
                <div className="item-title">{t('admin.items.dispatchMap')}</div>
                <div className="item-subtitle">{t('admin.items.dispatchMapDesc')}</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
          </div>
        </div>

        {/* Exportar Excel */}
        <div className="admin-section">
          <div className="section-header">
            <span className="material-icons">table_view</span>
            <h3>Exportar Dispatcher a Excel</h3>
          </div>
          <div style={{ padding: '16px' }}>
            <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: '#555' }}>
              Selecciona los estados que quieres incluir en el archivo:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
              {EXPORT_STATUSES.map(({ key, label }) => (
                <label
                  key={key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
                    border: exportStatuses[key] ? '2px solid #22c55e' : '2px solid #ddd',
                    background: exportStatuses[key] ? '#f0fdf4' : '#f9f9f9',
                    fontWeight: exportStatuses[key] ? '600' : '400',
                    fontSize: '0.88rem', color: exportStatuses[key] ? '#16a34a' : '#444',
                    transition: 'all 0.15s', userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!exportStatuses[key]}
                    onChange={e => setExportStatuses(prev => ({ ...prev, [key]: e.target.checked }))}
                    style={{ display: 'none' }}
                  />
                  <span className="material-icons" style={{ fontSize: '16px' }}>
                    {exportStatuses[key] ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                  {label}
                </label>
              ))}
            </div>
            <button
              onClick={handleExportExcel}
              disabled={exporting || !Object.values(exportStatuses).some(Boolean)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '11px 24px', borderRadius: '10px', border: 'none',
                background: exporting ? '#9ca3af' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: '#fff', fontWeight: '600', fontSize: '0.95rem',
                cursor: exporting ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s'
              }}
            >
              <span className="material-icons" style={{ fontSize: '20px' }}>
                {exporting ? 'hourglass_top' : 'download'}
              </span>
              {exporting ? 'Generando Excel…' : 'Descargar Excel'}
            </button>
          </div>
        </div>

        {/* Sistema */}
        <div className="admin-section">
          <div className="section-header">
            <span className="material-icons">monitor_heart</span>
            <h3>{t('admin.sections.system')}</h3>
          </div>
          <div className="section-items">
            <Link to="/admin/logs" className="section-item">
              <div className="item-icon purple">
                <span className="material-icons">terminal</span>
              </div>
              <div className="item-content">
                <div className="item-title">{t('admin.items.systemLogs')}</div>
                <div className="item-subtitle">{t('admin.items.systemLogsDesc')}</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <button className="section-item danger-item" onClick={handleResetDispatch} disabled={resetting}>
              <div className="item-icon red">
                <span className="material-icons">{resetting ? 'sync' : 'delete_forever'}</span>
              </div>
              <div className="item-content">
                <div className="item-title">{resetting ? t('admin.items.clearing') : t('admin.items.clearDispatch')}</div>
                <div className="item-subtitle">{t('admin.items.clearDispatchDesc')}</div>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
