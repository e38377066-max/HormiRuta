import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api'
import './AdminPages.css'

export default function RouteHistory() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [routeDetail, setRouteDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [viewingPhoto, setViewingPhoto] = useState(null)

  useEffect(() => {
    fetchRoutes()
  }, [])

  const fetchRoutes = async () => {
    try {
      const res = await api.get('/api/dispatch/routes/history')
      setRoutes(res.data.routes || [])
    } catch (err) {
      console.error('Error fetching route history:', err)
    } finally {
      setLoading(false)
    }
  }

  const viewRouteDetail = async (route) => {
    setSelectedRoute(route.id)
    setLoadingDetail(true)
    try {
      const res = await api.get(`/api/dispatch/routes/${route.id}/detail`)
      setRouteDetail(res.data.route)
    } catch (err) {
      console.error('Error fetching route detail:', err)
    } finally {
      setLoadingDetail(false)
    }
  }

  const formatDate = (d) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const getStatusLabel = (status) => {
    if (status === 'completed') return t('admin.routeHistory.completed')
    if (status === 'assigned') return t('admin.routeHistory.inProgress')
    return status
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
        <h1>{t('admin.routeHistory.title')}</h1>
      </div>

      {!selectedRoute ? (
        <div className="history-list">
          {routes.length === 0 ? (
            <div className="empty-state">
              <span className="material-icons" style={{ fontSize: 48, color: '#555' }}>route</span>
              <p>{t('admin.routeHistory.noRoutes')}</p>
            </div>
          ) : (
            routes.map(route => (
              <div key={route.id} className="history-route-card" onClick={() => viewRouteDetail(route)}>
                <div className="history-route-top">
                  <div className="history-route-name">{route.name || t('admin.routeHistory.noName')}</div>
                  <span className={`history-status-badge ${route.status}`}>
                    {getStatusLabel(route.status)}
                  </span>
                </div>
                <div className="history-route-meta">
                  <span>
                    <span className="material-icons" style={{ fontSize: 16 }}>person</span>
                    {route.driver_name || t('admin.routeHistory.noDriver')}
                  </span>
                  <span>
                    <span className="material-icons" style={{ fontSize: 16 }}>place</span>
                    {route.stops_count} {t('admin.routeHistory.stops')} ({route.completed_stops}/{route.stops_count})
                  </span>
                  {route.total_amount > 0 && (
                    <span>
                      <span className="material-icons" style={{ fontSize: 16 }}>payments</span>
                      ${route.total_amount.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="history-route-date">
                  {route.completed_at
                    ? `${t('admin.routeHistory.completedAt')} ${formatDate(route.completed_at)}`
                    : `${t('admin.routeHistory.createdAt')} ${formatDate(route.created_at)}`}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="route-detail-view">
          <button className="back-link" onClick={() => { setSelectedRoute(null); setRouteDetail(null); }}>
            <span className="material-icons">arrow_back</span>
            {t('admin.routeHistory.backToHistory')}
          </button>

          {loadingDetail ? (
            <div className="loading-container"><div className="spinner"></div></div>
          ) : routeDetail ? (
            <>
              <div className="detail-header-card">
                <h2>{routeDetail.name}</h2>
                <div className="detail-meta-row">
                  <span className={`history-status-badge ${routeDetail.status}`}>
                    {getStatusLabel(routeDetail.status)}
                  </span>
                  <span>{routeDetail.driver_name || t('admin.routeHistory.noDriver')}</span>
                  {routeDetail.total_distance > 0 && <span>{routeDetail.total_distance.toFixed(1)} km</span>}
                </div>
                {routeDetail.completed_at && (
                  <div className="detail-date">{t('admin.routeHistory.finishedAt')} {formatDate(routeDetail.completed_at)}</div>
                )}
              </div>

              <div className="detail-stops-title">
                <span className="material-icons">checklist</span>
                {t('admin.routeHistory.stopsAndEvidence')} ({routeDetail.completed_stops}/{routeDetail.stops_count})
              </div>

              <div className="detail-stops-list">
                {(routeDetail.stops || []).map((stop, i) => (
                  <div key={stop.id} className={`detail-stop-card ${stop.status === 'completed' ? 'completed' : stop.status === 'skipped' ? 'skipped' : 'pending'}`}>
                    <div className="detail-stop-header">
                      <span className="detail-stop-number">{i + 1}</span>
                      <div className="detail-stop-info">
                        <div className="detail-stop-name">{stop.customer_name || stop.address?.split(',')[0] || 'Stop'}</div>
                        <div className="detail-stop-address">{stop.address}</div>
                        {stop.completed_at && (
                          <div className="detail-stop-time">
                            {stop.status === 'skipped' ? t('admin.routeHistory.skipped') : t('admin.routeHistory.completed')}: {formatDate(stop.completed_at)}
                          </div>
                        )}
                      </div>
                      <span className="material-icons" style={{ color: stop.status === 'completed' ? '#22c55e' : stop.status === 'skipped' ? '#ff5050' : '#f59e0b', fontSize: 24 }}>
                        {stop.status === 'completed' ? 'check_circle' : stop.status === 'skipped' ? 'cancel' : 'pending'}
                      </span>
                    </div>
                    {stop.photo_url ? (
                      <div className="detail-stop-evidence" onClick={() => setViewingPhoto(stop.photo_url)}>
                        <img src={stop.photo_url} alt={`Evidence stop ${i + 1}`} className="evidence-thumb" />
                        <span className="evidence-label">
                          <span className="material-icons" style={{ fontSize: 16 }}>photo_camera</span>
                          {t('admin.routeHistory.viewEvidence')}
                        </span>
                      </div>
                    ) : (
                      <div className="no-evidence">
                        <span className="material-icons" style={{ fontSize: 16, color: '#666' }}>no_photography</span>
                        {t('admin.routeHistory.noEvidence')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: '#999', textAlign: 'center' }}>{t('admin.routeHistory.loadError')}</p>
          )}
        </div>
      )}

      {viewingPhoto && (
        <div className="photo-viewer-overlay" onClick={() => setViewingPhoto(null)}>
          <div className="photo-viewer-container" onClick={e => e.stopPropagation()}>
            <button className="photo-viewer-close" onClick={() => setViewingPhoto(null)}>
              <span className="material-icons">close</span>
            </button>
            <img src={viewingPhoto} alt={t('admin.routeHistory.evidence')} className="photo-viewer-img" />
          </div>
        </div>
      )}
    </div>
  )
}
