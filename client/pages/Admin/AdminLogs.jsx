import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'
import './AdminPages.css'

export default function AdminLogs() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [levelFilter, setLevelFilter] = useState('all')
  const [search, setSearch] = useState('')
  const logsEndRef = useRef(null)
  const containerRef = useRef(null)

  const fetchLogs = useCallback(async () => {
    try {
      const params = { limit: 500 }
      if (levelFilter !== 'all') params.level = levelFilter
      if (search) params.search = search
      const response = await api.get('/api/admin/logs', { params })
      setLogs(response.data.logs || [])
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }, [levelFilter, search])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchLogs])

  useEffect(() => {
    if (logsEndRef.current && containerRef.current) {
      const container = containerRef.current
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      if (isNearBottom) {
        logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [logs])

  const handleClearLogs = async () => {
    try {
      await api.delete('/api/admin/logs')
      setLogs([])
    } catch (error) {
      console.error('Error clearing logs:', error)
    }
  }

  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return '#ff5252'
      case 'warn': return '#ffd740'
      case 'info': return '#e0e0e0'
      default: return '#e0e0e0'
    }
  }

  const getLevelBadgeClass = (level) => {
    switch (level) {
      case 'error': return 'log-badge-error'
      case 'warn': return 'log-badge-warn'
      case 'info': return 'log-badge-info'
      default: return 'log-badge-info'
    }
  }

  const formatTime = (timestamp) => {
    const d = new Date(timestamp)
    return d.toLocaleTimeString('es-MX', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
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
        <h1>Logs del Sistema</h1>
      </div>

      <div className="logs-toolbar">
        <div className="logs-toolbar-left">
          <select
            className="logs-filter-select"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <div className="search-box">
            <span className="material-icons">search</span>
            <input
              type="text"
              placeholder="Buscar en logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="logs-toolbar-right">
          <label className="logs-auto-refresh">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-refresh</span>
            {autoRefresh && <span className="logs-pulse"></span>}
          </label>
          <button className="btn-primary" onClick={fetchLogs} style={{ padding: '8px 12px' }}>
            <span className="material-icons" style={{ fontSize: 18 }}>refresh</span>
          </button>
          <button className="btn-cancel" onClick={handleClearLogs} style={{ padding: '8px 12px', color: '#f44336', borderColor: '#f44336' }}>
            <span className="material-icons" style={{ fontSize: 18 }}>delete</span>
            Limpiar
          </button>
        </div>
      </div>

      <div className="logs-terminal" ref={containerRef}>
        {logs.length === 0 ? (
          <div className="logs-empty">No hay logs disponibles</div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="log-entry" style={{ color: getLevelColor(log.level) }}>
              <span className="log-time">{formatTime(log.timestamp)}</span>
              <span className={`log-badge ${getLevelBadgeClass(log.level)}`}>
                {log.level.toUpperCase()}
              </span>
              {log.source && <span className="log-source">[{log.source}]</span>}
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      <div className="logs-footer">
        <span>{logs.length} entradas</span>
      </div>
    </div>
  )
}
