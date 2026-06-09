/**
 * @fileoverview Visualizador de registros (logs) del sistema para administradores.
 * Permite monitorear eventos en tiempo real, filtrar por nivel de gravedad, buscar texto, 
 * limpiar la memoria y descargar archivos históricos de logs.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api'
import './AdminPages.css'

/**
 * Componente AdminLogs que implementa una terminal de visualización de registros.
 * @returns {JSX.Element}
 */
export default function AdminLogs() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  /** @type {[Array, Function]} Lista de logs cargados en memoria */
  const [logs, setLogs] = useState([])
  /** @type {[boolean, Function]} Indica si se está realizando la carga inicial */
  const [loading, setLoading] = useState(true)
  /** @type {[boolean, Function]} Controla si el refresco automático está encendido */
  const [autoRefresh, setAutoRefresh] = useState(true)
  /** @type {[string, Function]} Filtro por nivel (all, info, warn, error) */
  const [levelFilter, setLevelFilter] = useState('all')
  /** @type {[string, Function]} Filtro de búsqueda por texto */
  const [search, setSearch] = useState('')
  /** @type {[Object|null, Function]} Estadísticas de los archivos de logs en disco */
  const [fileStats, setFileStats] = useState(null)
  /** @type {[Array, Function]} Lista de archivos históricos (archives) disponibles */
  const [archives, setArchives] = useState([])
  /** @type {React.RefObject} Referencia para el scroll automático al final de la terminal */
  const logsEndRef = useRef(null)
  /** @type {React.RefObject} Referencia al contenedor de la terminal */
  const containerRef = useRef(null)

  /**
   * Obtiene los logs más recientes del servidor.
   * @async
   */
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

  /** Obtiene estadísticas de tamaño y entradas de los archivos actuales */
  const fetchFileStats = async () => {
    try {
      const response = await api.get('/api/admin/logs/stats')
      setFileStats(response.data)
    } catch (error) {
      console.error('Error fetching log stats:', error)
    }
  }

  /** Obtiene la lista de archivos de logs antiguos comprimidos o archivados */
  const fetchArchives = async () => {
    try {
      const response = await api.get('/api/admin/logs/archives')
      setArchives(response.data.archives || [])
    } catch (error) {
      console.error('Error fetching archives:', error)
    }
  }

  /** Carga inicial al montar el componente */
  useEffect(() => {
    fetchLogs()
    fetchFileStats()
    fetchArchives()
  }, [fetchLogs])

  /** Maneja el intervalo de refresco automático (cada 5 segundos) */
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchLogs])

  /** Desplaza el scroll al final de la terminal cuando llegan nuevos logs si el usuario está cerca del fondo */
  useEffect(() => {
    if (logsEndRef.current && containerRef.current) {
      const container = containerRef.current
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      if (isNearBottom) {
        logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [logs])

  /**
   * Limpia los logs almacenados en la memoria del servidor.
   * @async
   */
  const handleClearLogs = async () => {
    try {
      await api.delete('/api/admin/logs')
      setLogs([])
    } catch (error) {
      console.error('Error clearing logs:', error)
    }
  }

  /**
   * Descarga un archivo de logs actual (24h o 3días).
   * @async
   * @param {string} type - Tipo de descarga ('important' o 'full').
   */
  const handleDownload = async (type) => {
    try {
      const response = await api.get(`/api/admin/logs/download/${type}`, { responseType: 'blob' })
      const disposition = response.headers['content-disposition'] || ''
      const filenameMatch = disposition.match(/filename="(.+)"/)
      const fallbackName = type === 'important' ? '24h.txt' : '3dias.txt'
      const filename = filenameMatch ? filenameMatch[1] : fallbackName
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading logs:', error)
    }
  }

  /**
   * Descarga un archivo del histórico archivado.
   * @async
   * @param {string} filename - Nombre del archivo a descargar.
   */
  const handleDownloadArchive = async (filename) => {
    try {
      const response = await api.get(`/api/admin/logs/archives/${filename}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading archive:', error)
    }
  }

  /** Determina el color del texto según el nivel del log */
  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return '#ff5252'
      case 'warn': return '#ffd740'
      case 'info': return '#e0e0e0'
      default: return '#e0e0e0'
    }
  }

  /** Determina la clase CSS para el badge del nivel */
  const getLevelBadgeClass = (level) => {
    switch (level) {
      case 'error': return 'log-badge-error'
      case 'warn': return 'log-badge-warn'
      case 'info': return 'log-badge-info'
      default: return 'log-badge-info'
    }
  }

  /** Formatea la estampa de tiempo del log */
  const formatTime = (timestamp) => {
    const d = new Date(timestamp)
    return d.toLocaleTimeString(undefined, { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
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
        <h1>{t('admin.logs.title')}</h1>
      </div>

      <div className="logs-toolbar">
        <div className="logs-toolbar-left">
          <select
            className="logs-filter-select"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="all">{t('admin.logs.all')}</option>
            <option value="info">{t('admin.logs.info')}</option>
            <option value="warn">{t('admin.logs.warn')}</option>
            <option value="error">{t('admin.logs.error')}</option>
          </select>
          <div className="search-box">
            <span className="material-icons">search</span>
            <input
              type="text"
              placeholder={t('admin.logs.searchPlaceholder')}
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
            <span>{t('admin.logs.autoRefresh')}</span>
            {autoRefresh && <span className="logs-pulse"></span>}
          </label>
          <button className="btn-primary" onClick={fetchLogs} style={{ padding: '8px 12px' }}>
            <span className="material-icons" style={{ fontSize: 18 }}>refresh</span>
          </button>
          <button className="btn-cancel" onClick={handleClearLogs} style={{ padding: '8px 12px', color: '#f44336', borderColor: '#f44336' }}>
            <span className="material-icons" style={{ fontSize: 18 }}>delete</span>
            {t('admin.logs.clear')}
          </button>
        </div>
      </div>

      <div className="logs-download-bar">
        <div className="logs-download-section">
          <button className="logs-download-btn" onClick={() => handleDownload('important')}>
            <span className="material-icons">download</span>
            {t('admin.logs.last24h')}
            {fileStats?.important && (
              <span className="logs-file-info">({fileStats.important.entries} {t('admin.logs.entries')} - {fileStats.important.sizeFormatted})</span>
            )}
          </button>
          <button className="logs-download-btn" onClick={() => handleDownload('full')}>
            <span className="material-icons">download</span>
            {t('admin.logs.last3days')}
            {fileStats?.full && (
              <span className="logs-file-info">({fileStats.full.entries} {t('admin.logs.entries')} - {fileStats.full.sizeFormatted})</span>
            )}
          </button>
        </div>
        {archives.length > 0 && (
          <div className="logs-archive-section">
            <span className="logs-archive-label">{t('admin.logs.history')}</span>
            {archives.map(file => (
              <button key={file.name} className="logs-archive-btn" onClick={() => handleDownloadArchive(file.name)}>
                <span className="material-icons">folder</span>
                {file.name.replace('.txt', '')}
                <span className="logs-file-info">({file.sizeFormatted})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="logs-terminal" ref={containerRef}>
        {logs.length === 0 ? (
          <div className="logs-empty">{t('admin.logs.noLogs')}</div>
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
        <span>{logs.length} {t('admin.logs.inMemory')}</span>
      </div>
    </div>
  )
}
