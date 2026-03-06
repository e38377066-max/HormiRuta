import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../api'
import './AdminPages.css'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [])

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

  const handleResetDispatch = async () => {
    const confirmed = window.confirm('ATENCION: Esto eliminara TODAS las direcciones, rutas, paradas, historial y fotos de evidencia del dispatch. Esta accion no se puede deshacer.\n\n¿Estas seguro?')
    if (!confirmed) return
    const doubleConfirm = window.confirm('ULTIMA CONFIRMACION: Se borraran todos los datos del dispatch permanentemente. ¿Continuar?')
    if (!doubleConfirm) return
    
    setResetting(true)
    try {
      const res = await api.delete('/api/admin/dispatch/reset')
      const d = res.data.deleted
      alert(`Dispatch vaciado:\n- ${d.addresses} direcciones\n- ${d.routes} rutas\n- ${d.stops} paradas\n- ${d.routeHistory} historial\n- ${d.photos} fotos de evidencia`)
      fetchStats()
    } catch (err) {
      alert('Error al vaciar dispatch')
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
        <h1>Panel de Administracion</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-icon">
            <span className="material-icons">groups</span>
          </div>
          <div className="stat-value">{stats.users?.total || 0}</div>
          <div className="stat-label">Usuarios Totales</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">
            <span className="material-icons">local_shipping</span>
          </div>
          <div className="stat-value">{stats.users?.drivers || 0}</div>
          <div className="stat-label">Repartidores</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon">
            <span className="material-icons">person</span>
          </div>
          <div className="stat-value">{stats.users?.clients || 0}</div>
          <div className="stat-label">Clientes</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon">
            <span className="material-icons">inventory_2</span>
          </div>
          <div className="stat-value">{stats.orders || 0}</div>
          <div className="stat-label">Ordenes</div>
        </div>
      </div>

      <div className="admin-sections">
        <div className="admin-section">
          <div className="section-header">
            <span className="material-icons">people</span>
            <h3>Gestion de Usuarios</h3>
          </div>
          <div className="section-items">
            <Link to="/admin/users" className="section-item">
              <div className="item-icon purple">
                <span className="material-icons">manage_accounts</span>
              </div>
              <div className="item-content">
                <div className="item-title">Ver todos los usuarios</div>
                <div className="item-subtitle">Administrar roles y permisos</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <Link to="/admin/users?role=driver" className="section-item">
              <div className="item-icon green">
                <span className="material-icons">local_shipping</span>
              </div>
              <div className="item-content">
                <div className="item-title">Repartidores</div>
                <div className="item-subtitle">{stats.users?.drivers || 0} activos</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <Link to="/admin/users?role=client" className="section-item">
              <div className="item-icon blue">
                <span className="material-icons">person</span>
              </div>
              <div className="item-content">
                <div className="item-title">Clientes</div>
                <div className="item-subtitle">{stats.users?.clients || 0} registrados</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
          </div>
        </div>

        <div className="admin-section">
          <div className="section-header">
            <span className="material-icons">route</span>
            <h3>Rutas y Entregas</h3>
          </div>
          <div className="section-items">
            <Link to="/admin/routes" className="section-item">
              <div className="item-icon blue">
                <span className="material-icons">history</span>
              </div>
              <div className="item-content">
                <div className="item-title">Historial de Rutas</div>
                <div className="item-subtitle">Revisar entregas y evidencias</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <Link to="/admin/accounting" className="section-item">
              <div className="item-icon purple">
                <span className="material-icons">receipt_long</span>
              </div>
              <div className="item-content">
                <div className="item-title">Contabilidad de Choferes</div>
                <div className="item-subtitle">Reporte de entregas y comisiones</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <Link to="/dispatch" className="section-item">
              <div className="item-icon green">
                <span className="material-icons">map</span>
              </div>
              <div className="item-content">
                <div className="item-title">Mapa de Despacho</div>
                <div className="item-subtitle">Crear y asignar rutas</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
          </div>
        </div>

        <div className="admin-section">
          <div className="section-header">
            <span className="material-icons">monitor_heart</span>
            <h3>Sistema</h3>
          </div>
          <div className="section-items">
            <Link to="/admin/logs" className="section-item">
              <div className="item-icon purple">
                <span className="material-icons">terminal</span>
              </div>
              <div className="item-content">
                <div className="item-title">Logs del Sistema</div>
                <div className="item-subtitle">Ver logs del servidor en tiempo real</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <button className="section-item danger-item" onClick={handleResetDispatch} disabled={resetting}>
              <div className="item-icon red">
                <span className="material-icons">{resetting ? 'sync' : 'delete_forever'}</span>
              </div>
              <div className="item-content">
                <div className="item-title">{resetting ? 'Vaciando...' : 'Vaciar Dispatch'}</div>
                <div className="item-subtitle">Eliminar todas las direcciones, rutas, paradas y evidencias</div>
              </div>
            </button>
          </div>
        </div>

        <div className="admin-section">
          <div className="section-header">
            <span className="material-icons">settings</span>
            <h3>Configuracion</h3>
          </div>
          <div className="section-items">
            <Link to="/messaging/coverage" className="section-item">
              <div className="item-icon cyan">
                <span className="material-icons">map</span>
              </div>
              <div className="item-content">
                <div className="item-title">Zonas de Cobertura</div>
                <div className="item-subtitle">Administrar codigos postales</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
            <Link to="/messaging/settings" className="section-item">
              <div className="item-icon green">
                <span className="material-icons">message</span>
              </div>
              <div className="item-content">
                <div className="item-title">Integracion Respond.io</div>
                <div className="item-subtitle">Configurar mensajeria</div>
              </div>
              <span className="material-icons item-arrow">chevron_right</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
