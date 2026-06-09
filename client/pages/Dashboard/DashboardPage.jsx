/**
 * @fileoverview Panel de control principal (Dashboard) para administradores.
 * Muestra métricas generales, estado del servicio de polling y resumen de cobertura.
 */

import { useEffect, useState } from 'react'
import { useMessaging } from '../../contexts/MessagingContext'
import { useTranslation } from 'react-i18next'
import './DashboardPage.css'

/**
 * Componente DashboardPage que resume la actividad del sistema.
 * @returns {JSX.Element}
 */
export default function DashboardPage() {
  const { stats, pollingStatus, fetchStats, getPollingStatus, startPolling, stopPolling, syncContacts } = useMessaging()
  /** @type {[boolean, Function]} Indica si se está realizando una sincronización manual */
  const [syncing, setSyncing] = useState(false)
  const { t } = useTranslation()

  /** Carga inicial de datos al montar el componente */
  useEffect(() => {
    fetchStats()
    getPollingStatus()
  }, [])

  /**
   * Alterna el estado del servicio de polling (inicia/detiene).
   * @async
   */
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

  /**
   * Dispara una sincronización manual de contactos de Respond.io.
   * @async
   */
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
        <h1>{t('dashboard.title')}</h1>
        <div className="header-actions">
          <button 
            className={`btn ${pollingStatus.active ? 'btn-negative' : 'btn-positive'}`}
            onClick={handleTogglePolling}
          >
            {pollingStatus.active ? t('dashboard.stopPolling') : t('dashboard.startPolling')}
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? t('dashboard.syncing') : t('dashboard.sync')}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <h2>{stats?.total_orders || 0}</h2>
          <p>{t('dashboard.totalOrders')}</p>
        </div>
        <div className="stat-card warning">
          <h2>{stats?.pending || 0}</h2>
          <p>{t('dashboard.pending')}</p>
        </div>
        <div className="stat-card info">
          <h2>{stats?.confirmed || 0}</h2>
          <p>{t('dashboard.confirmed')}</p>
        </div>
        <div className="stat-card positive">
          <h2>{stats?.completed || 0}</h2>
          <p>{t('dashboard.completed')}</p>
        </div>
      </div>

      <div className="card mt-3 p-3">
        <h3>{t('dashboard.serviceStatus')}</h3>
        <div className="service-status mt-2">
          <div className="status-item">
            <span className={`status-dot ${pollingStatus.active ? 'active' : ''}`}></span>
            <span>{t('dashboard.pollingStatus')} {pollingStatus.active ? t('dashboard.pollingActive') : t('dashboard.pollingInactive')}</span>
          </div>
          {pollingStatus.interval && (
            <div className="status-item">
              <span>{t('dashboard.interval')} {pollingStatus.interval} {t('dashboard.seconds')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-3 p-3">
        <h3>{t('dashboard.coverageSummary')}</h3>
        <div className="coverage-summary mt-2">
          <div className="coverage-item">
            <span className="coverage-label">{t('dashboard.activeZones')}</span>
            <span className="coverage-value">{stats?.coverage_zones || 0}</span>
          </div>
          <div className="coverage-item">
            <span className="coverage-label">{t('dashboard.withCoverage')}</span>
            <span className="coverage-value positive">{stats?.with_coverage || 0}</span>
          </div>
          <div className="coverage-item">
            <span className="coverage-label">{t('dashboard.withoutCoverage')}</span>
            <span className="coverage-value negative">{stats?.without_coverage || 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
