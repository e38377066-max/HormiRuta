import { useEffect, useState } from 'react'
import { useMessaging } from '../../contexts/MessagingContext'
import './DashboardPage.css'

export default function DashboardPage() {
  const { stats, pollingStatus, fetchStats, getPollingStatus, startPolling, stopPolling, syncContacts } = useMessaging()
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetchStats()
    getPollingStatus()
  }, [])

  const handleTogglePolling = async () => {
    try {
      if (pollingStatus.active) {
        await stopPolling()
      } else {
        await startPolling(30)
      }
    } catch (error) {
      console.error('Error toggling polling:', error)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncContacts()
      await fetchStats()
    } catch (error) {
      console.error('Error syncing:', error)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="header-actions">
          <button 
            className={`btn ${pollingStatus.active ? 'btn-negative' : 'btn-positive'}`}
            onClick={handleTogglePolling}
          >
            {pollingStatus.active ? '⏹ Detener Polling' : '▶ Iniciar Polling'}
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? '🔄 Sincronizando...' : '🔄 Sincronizar'}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <h2>{stats?.total_orders || 0}</h2>
          <p>Total Ordenes</p>
        </div>
        <div className="stat-card warning">
          <h2>{stats?.pending || 0}</h2>
          <p>Pendientes</p>
        </div>
        <div className="stat-card info">
          <h2>{stats?.confirmed || 0}</h2>
          <p>Confirmadas</p>
        </div>
        <div className="stat-card positive">
          <h2>{stats?.completed || 0}</h2>
          <p>Completadas</p>
        </div>
      </div>

      <div className="card mt-3 p-3">
        <h3>Estado del Servicio</h3>
        <div className="service-status mt-2">
          <div className="status-item">
            <span className={`status-dot ${pollingStatus.active ? 'active' : ''}`}></span>
            <span>Polling Respond.io: {pollingStatus.active ? 'Activo' : 'Inactivo'}</span>
          </div>
          {pollingStatus.interval && (
            <div className="status-item">
              <span>Intervalo: {pollingStatus.interval} segundos</span>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-3 p-3">
        <h3>Resumen de Cobertura</h3>
        <div className="coverage-summary mt-2">
          <div className="coverage-item">
            <span className="coverage-label">Zonas activas:</span>
            <span className="coverage-value">{stats?.coverage_zones || 0}</span>
          </div>
          <div className="coverage-item">
            <span className="coverage-label">Con cobertura:</span>
            <span className="coverage-value positive">{stats?.with_coverage || 0}</span>
          </div>
          <div className="coverage-item">
            <span className="coverage-label">Sin cobertura:</span>
            <span className="coverage-value negative">{stats?.without_coverage || 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
