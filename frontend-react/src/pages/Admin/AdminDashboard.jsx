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
      <div className="admin-page">
        <div className="admin-container">
          <div className="loading-container"><div className="spinner"></div></div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <span className="material-icons">arrow_back</span>
          </button>
          <h1 className="page-title">
            <span className="material-icons">admin_panel_settings</span>
            Panel de Administracion
          </h1>
        </div>

        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-icon primary">
              <span className="material-icons">groups</span>
            </div>
            <div className="stat-value">{stats.users?.total || 0}</div>
            <div className="stat-label">Usuarios Totales</div>
          </div>
          <div className="stat-card success">
            <div className="stat-icon success">
              <span className="material-icons">local_shipping</span>
            </div>
            <div className="stat-value">{stats.users?.drivers || 0}</div>
            <div className="stat-label">Repartidores</div>
          </div>
          <div className="stat-card info">
            <div className="stat-icon info">
              <span className="material-icons">person</span>
            </div>
            <div className="stat-value">{stats.users?.clients || 0}</div>
            <div className="stat-label">Clientes</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-icon warning">
              <span className="material-icons">inventory_2</span>
            </div>
            <div className="stat-value">{stats.orders || 0}</div>
            <div className="stat-label">Ordenes</div>
          </div>
        </div>

        <div className="admin-grid">
          <div className="admin-card">
            <div className="card-header">
              <span className="material-icons">people</span>
              <h3>Gestion de Usuarios</h3>
            </div>
            <div className="card-body">
              <Link to="/admin/users" className="menu-item">
                <div className="menu-icon primary">
                  <span className="material-icons">manage_accounts</span>
                </div>
                <div className="menu-content">
                  <div className="menu-title">Ver todos los usuarios</div>
                  <div className="menu-subtitle">Administrar roles y permisos</div>
                </div>
                <span className="material-icons menu-arrow">chevron_right</span>
              </Link>
              <Link to="/admin/users?role=driver" className="menu-item">
                <div className="menu-icon success">
                  <span className="material-icons">local_shipping</span>
                </div>
                <div className="menu-content">
                  <div className="menu-title">Repartidores</div>
                  <div className="menu-subtitle">{stats.users?.drivers || 0} activos</div>
                </div>
                <span className="material-icons menu-arrow">chevron_right</span>
              </Link>
              <Link to="/admin/users?role=client" className="menu-item">
                <div className="menu-icon info">
                  <span className="material-icons">person</span>
                </div>
                <div className="menu-content">
                  <div className="menu-title">Clientes</div>
                  <div className="menu-subtitle">{stats.users?.clients || 0} registrados</div>
                </div>
                <span className="material-icons menu-arrow">chevron_right</span>
              </Link>
            </div>
          </div>

          <div className="admin-card">
            <div className="card-header">
              <span className="material-icons">settings</span>
              <h3>Configuracion</h3>
            </div>
            <div className="card-body">
              <Link to="/messaging/coverage" className="menu-item">
                <div className="menu-icon purple">
                  <span className="material-icons">map</span>
                </div>
                <div className="menu-content">
                  <div className="menu-title">Zonas de Cobertura</div>
                  <div className="menu-subtitle">Administrar codigos postales</div>
                </div>
                <span className="material-icons menu-arrow">chevron_right</span>
              </Link>
              <Link to="/messaging/settings" className="menu-item">
                <div className="menu-icon success">
                  <span className="material-icons">message</span>
                </div>
                <div className="menu-content">
                  <div className="menu-title">Integracion Respond.io</div>
                  <div className="menu-subtitle">Configurar mensajeria</div>
                </div>
                <span className="material-icons menu-arrow">chevron_right</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
