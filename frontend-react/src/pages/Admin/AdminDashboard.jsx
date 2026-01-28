import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'
import './AdminPages.css'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
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
    return <div className="loading"><div className="spinner"></div></div>
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Panel de Administracion</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <h2>{stats?.total_users || 0}</h2>
          <p>Total Usuarios</p>
        </div>
        <div className="stat-card positive">
          <h2>{stats?.active_users || 0}</h2>
          <p>Usuarios Activos</p>
        </div>
        <div className="stat-card info">
          <h2>{stats?.drivers || 0}</h2>
          <p>Conductores</p>
        </div>
        <div className="stat-card secondary">
          <h2>{stats?.admins || 0}</h2>
          <p>Administradores</p>
        </div>
      </div>

      <div className="admin-cards mt-3">
        <Link to="/admin/users" className="admin-card">
          <span className="admin-card-icon">👥</span>
          <h3>Gestion de Usuarios</h3>
          <p>Ver, editar y administrar usuarios</p>
        </Link>

        <Link to="/messaging/settings" className="admin-card">
          <span className="admin-card-icon">⚙️</span>
          <h3>Configuracion Mensajeria</h3>
          <p>Configurar Respond.io y automatizaciones</p>
        </Link>

        <Link to="/messaging/coverage" className="admin-card">
          <span className="admin-card-icon">📍</span>
          <h3>Zonas de Cobertura</h3>
          <p>Gestionar codigos postales</p>
        </Link>
      </div>
    </div>
  )
}
