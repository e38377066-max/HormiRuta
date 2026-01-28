import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../api'
import './AdminPages.css'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="q-page q-pa-md">
        <div className="loading-state"><div className="spinner"></div></div>
      </div>
    )
  }

  return (
    <div className="q-page q-pa-md">
      <div className="page-title-row">
        <button className="q-btn-icon" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <div className="page-title">
          <span className="material-icons">admin_panel_settings</span>
          Panel de Administracion
        </div>
      </div>

      <div className="stats-row q-mb-lg">
        <div className="stat-card bg-primary">
          <div className="stat-value">{stats.users?.total || 0}</div>
          <div className="stat-label">Usuarios Totales</div>
        </div>
        <div className="stat-card bg-positive">
          <div className="stat-value">{stats.users?.drivers || 0}</div>
          <div className="stat-label">Repartidores</div>
        </div>
        <div className="stat-card bg-info">
          <div className="stat-value">{stats.users?.clients || 0}</div>
          <div className="stat-label">Clientes</div>
        </div>
        <div className="stat-card bg-warning">
          <div className="stat-value">{stats.orders || 0}</div>
          <div className="stat-label">Ordenes</div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="q-card">
          <div className="card-section">
            <h4>
              <span className="material-icons">people</span>
              Gestion de Usuarios
            </h4>
          </div>
          <div className="card-section">
            <Link to="/admin/users" className="list-item">
              <div className="list-item-icon bg-primary">
                <span className="material-icons">manage_accounts</span>
              </div>
              <div className="list-item-content">
                <div className="list-item-title">Ver todos los usuarios</div>
                <div className="list-item-caption">Administrar roles y permisos</div>
              </div>
              <span className="material-icons list-item-arrow">chevron_right</span>
            </Link>
            <Link to="/admin/users?role=driver" className="list-item">
              <div className="list-item-icon bg-positive">
                <span className="material-icons">local_shipping</span>
              </div>
              <div className="list-item-content">
                <div className="list-item-title">Repartidores</div>
                <div className="list-item-caption">{stats.users?.drivers || 0} activos</div>
              </div>
              <span className="material-icons list-item-arrow">chevron_right</span>
            </Link>
            <Link to="/admin/users?role=client" className="list-item">
              <div className="list-item-icon bg-info">
                <span className="material-icons">person</span>
              </div>
              <div className="list-item-content">
                <div className="list-item-title">Clientes</div>
                <div className="list-item-caption">{stats.users?.clients || 0} registrados</div>
              </div>
              <span className="material-icons list-item-arrow">chevron_right</span>
            </Link>
          </div>
        </div>

        <div className="q-card">
          <div className="card-section">
            <h4>
              <span className="material-icons">settings</span>
              Configuracion
            </h4>
          </div>
          <div className="card-section">
            <Link to="/messaging/coverage" className="list-item">
              <div className="list-item-icon bg-secondary">
                <span className="material-icons">map</span>
              </div>
              <div className="list-item-content">
                <div className="list-item-title">Zonas de Cobertura</div>
                <div className="list-item-caption">Administrar codigos postales</div>
              </div>
              <span className="material-icons list-item-arrow">chevron_right</span>
            </Link>
            <Link to="/messaging/settings" className="list-item">
              <div className="list-item-icon bg-positive">
                <span className="material-icons">message</span>
              </div>
              <div className="list-item-content">
                <div className="list-item-title">Integracion Respond.io</div>
                <div className="list-item-caption">Configurar mensajeria</div>
              </div>
              <span className="material-icons list-item-arrow">chevron_right</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
