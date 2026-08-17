/**
 * @fileoverview Recepción de Paquetes — dos secciones:
 *  1. Recepción de Rutas: confirmar entrega de paquetes al chofer + historial
 *  2. Retornos: paquetes skipped que vuelven a la oficina (funcionalidad original)
 */

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../api'
import { getSocket } from '../../socket'
import './AdminPages.css'
import './PackageReturnsPage.css'

const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// ─── Sección de Recepción de Rutas ────────────────────────────────────────────
function RoutePickupSection() {
  const [subTab, setSubTab]         = useState('pending')   // 'pending' | 'history'
  const [pending, setPending]       = useState([])
  const [history, setHistory]       = useState([])
  const [loading, setLoading]       = useState(false)
  const [busyId, setBusyId]         = useState(null)
  const [notif, setNotif]           = useState(null)

  const loadPending = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/dispatch/pickup/pending')
      setPending(res.data.routes || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/dispatch/pickup/history')
      setHistory(res.data.routes || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  const loadAll = useCallback(() => {
    loadPending()
    loadHistory()
  }, [loadPending, loadHistory])

  useEffect(() => { loadAll() }, [loadAll])

  // Recargar en tiempo real cuando el chofer confirma
  useEffect(() => {
    const socket = getSocket()
    const handler = () => {
      loadAll()
      setNotif('✅ Chofer confirmó recogida de paquetes')
      setTimeout(() => setNotif(null), 5000)
    }
    socket.on('pickup:driver_confirmed', handler)
    return () => socket.off('pickup:driver_confirmed', handler)
  }, [loadAll])

  const adminConfirm = async (routeId) => {
    setBusyId(routeId)
    try {
      await api.post(`/api/dispatch/pickup/${routeId}/admin-confirm`)
      await loadAll()
      setNotif('✅ Entrega confirmada — se notificó al chofer')
      setTimeout(() => setNotif(null), 5000)
    } catch (e) {
      alert(e.response?.data?.error || 'Error al confirmar')
    } finally {
      setBusyId(null)
    }
  }

  const statusBadge = (r) => {
    if (r.pickup_driver_confirmed_at) {
      return <span className="pickup-badge pickup-badge-full">✓ Ambos confirmaron</span>
    }
    return <span className="pickup-badge pickup-badge-pending">Pendiente chofer</span>
  }

  return (
    <div>
      {notif && <div className="pickup-notif">{notif}</div>}

      <div className="pr-tabs" style={{ marginBottom: 0 }}>
        <button className={`pr-tab ${subTab === 'pending' ? 'active' : ''}`} onClick={() => setSubTab('pending')}>
          Pendientes <span className="pr-count pr-count-warn">{pending.length}</span>
        </button>
        <button className={`pr-tab ${subTab === 'history' ? 'active' : ''}`} onClick={() => setSubTab('history')}>
          Historial <span className="pr-count">{history.length}</span>
        </button>
        <button className="pr-refresh" onClick={loadAll} disabled={loading}>
          <span className="material-icons">refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="pr-empty"><div className="spinner" /></div>
      ) : subTab === 'pending' ? (
        pending.length === 0 ? (
          <div className="pr-empty">
            <span className="material-icons" style={{ fontSize: 48, color: '#9ca3af' }}>check_circle</span>
            <div>No hay rutas pendientes de confirmación</div>
          </div>
        ) : (
          <div className="pr-list">
            {pending.map(r => (
              <div key={r.id} className="pr-card pickup-card">
                <div className="pr-card-header">
                  <div className="pickup-route-name">
                    <span className="material-icons" style={{ fontSize: 18, color: '#6200ea' }}>route</span>
                    {r.name}
                  </div>
                  <span className="pickup-badge pickup-badge-assigned">Asignada</span>
                </div>
                <div className="pickup-meta">
                  <span className="material-icons" style={{ fontSize: 14 }}>person</span>
                  <strong>{r.driver_name}</strong>
                  <span style={{ margin: '0 6px', color: '#ccc' }}>·</span>
                  <span className="material-icons" style={{ fontSize: 14 }}>local_shipping</span>
                  {r.stops_count} parada{r.stops_count !== 1 ? 's' : ''}
                  <span style={{ margin: '0 6px', color: '#ccc' }}>·</span>
                  <span className="material-icons" style={{ fontSize: 14 }}>schedule</span>
                  {fmtDate(r.assigned_at)}
                </div>
                <div className="pr-actions">
                  <button
                    className="pr-btn pickup-btn-confirm"
                    disabled={busyId === r.id}
                    onClick={() => adminConfirm(r.id)}
                  >
                    <span className="material-icons">inventory</span>
                    {busyId === r.id ? 'Confirmando…' : 'Confirmar Entrega al Chofer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        history.length === 0 ? (
          <div className="pr-empty">
            <span className="material-icons" style={{ fontSize: 48, color: '#9ca3af' }}>history</span>
            <div>No hay recepciones confirmadas aún</div>
          </div>
        ) : (
          <div className="pr-list">
            {history.map(r => (
              <div key={r.id} className="pr-card pickup-card">
                <div className="pr-card-header">
                  <div className="pickup-route-name">
                    <span className="material-icons" style={{ fontSize: 18, color: '#6200ea' }}>route</span>
                    {r.name}
                  </div>
                  {statusBadge(r)}
                </div>
                <div className="pickup-meta">
                  <span className="material-icons" style={{ fontSize: 14 }}>person</span>
                  <strong>{r.driver_name}</strong>
                  <span style={{ margin: '0 6px', color: '#ccc' }}>·</span>
                  <span className="material-icons" style={{ fontSize: 14 }}>local_shipping</span>
                  {r.stops_count} parada{r.stops_count !== 1 ? 's' : ''}
                </div>
                <div className="pickup-timeline">
                  <div className="pickup-timeline-item pickup-timeline-admin">
                    <span className="material-icons">admin_panel_settings</span>
                    <div>
                      <div className="pickup-tl-label">Oficina confirmó entrega</div>
                      <div className="pickup-tl-sub">{r.pickup_admin_confirmed_by_name} · {fmtDate(r.pickup_admin_confirmed_at)}</div>
                    </div>
                  </div>
                  {r.pickup_driver_confirmed_at ? (
                    <div className="pickup-timeline-item pickup-timeline-driver">
                      <span className="material-icons">local_shipping</span>
                      <div>
                        <div className="pickup-tl-label">Chofer confirmó recogida</div>
                        <div className="pickup-tl-sub">{fmtDate(r.pickup_driver_confirmed_at)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="pickup-timeline-item pickup-timeline-waiting">
                      <span className="material-icons">hourglass_top</span>
                      <div>
                        <div className="pickup-tl-label">Esperando confirmación del chofer…</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ─── Sección de Retornos (funcionalidad original) ─────────────────────────────
function RetornosSection() {
  const { t } = useTranslation()
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter]   = useState('all')
  const [busy, setBusy]       = useState(null)

  const dispositionLabel = (d) => {
    switch (d) {
      case 'held_by_driver':    return { txt: t('admin.returns.withDriver'),       cls: 'pr-pill-driver' }
      case 'pending_return':    return { txt: t('admin.returns.pendingReturn'),     cls: 'pr-pill-pending' }
      case 'returned_to_office':return { txt: t('admin.returns.receivedAtOffice'), cls: 'pr-pill-office' }
      default: return { txt: d || '-', cls: '' }
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/dispatch/returns')
      setOrders(res.data?.orders || [])
    } catch (err) { console.error('Error loading returns:', err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const receive = async (id) => {
    if (!confirm(t('admin.returns.confirmReceived'))) return
    setBusy(id)
    try { await api.put(`/api/dispatch/returns/${id}/receive`); await load() }
    catch (err) { alert(err.response?.data?.error || t('common.error')) }
    finally { setBusy(null) }
  }

  const release = async (id) => {
    if (!confirm(t('admin.returns.confirmRelease'))) return
    setBusy(id)
    try { await api.put(`/api/dispatch/returns/${id}/release`); await load() }
    catch (err) { alert(err.response?.data?.error || t('common.error')) }
    finally { setBusy(null) }
  }

  const filtered = orders.filter(o => filter === 'all' || o.package_disposition === filter)
  const counts = {
    all: orders.length,
    held_by_driver: orders.filter(o => o.package_disposition === 'held_by_driver').length,
    pending_return: orders.filter(o => o.package_disposition === 'pending_return').length,
    returned_to_office: orders.filter(o => o.package_disposition === 'returned_to_office').length,
  }

  return (
    <div>
      <div className="pr-tabs" style={{ marginBottom: 0 }}>
        <button className={`pr-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          {t('admin.returns.filters.all')} <span className="pr-count">{counts.all}</span>
        </button>
        <button className={`pr-tab ${filter === 'pending_return' ? 'active' : ''}`} onClick={() => setFilter('pending_return')}>
          {t('admin.returns.filters.pending')} <span className="pr-count pr-count-warn">{counts.pending_return}</span>
        </button>
        <button className={`pr-tab ${filter === 'held_by_driver' ? 'active' : ''}`} onClick={() => setFilter('held_by_driver')}>
          {t('admin.returns.filters.withDriver')} <span className="pr-count">{counts.held_by_driver}</span>
        </button>
        <button className={`pr-tab ${filter === 'returned_to_office' ? 'active' : ''}`} onClick={() => setFilter('returned_to_office')}>
          {t('admin.returns.filters.atOffice')} <span className="pr-count">{counts.returned_to_office}</span>
        </button>
        <button className="pr-refresh" onClick={load} disabled={loading}>
          <span className="material-icons">refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="pr-empty">{t('admin.returns.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="pr-empty">
          <span className="material-icons" style={{ fontSize: 48, color: '#9ca3af' }}>inventory_2</span>
          <div>{t('admin.returns.noPackages')}</div>
        </div>
      ) : (
        <div className="pr-list">
          {filtered.map(o => {
            const disp = dispositionLabel(o.package_disposition)
            return (
              <div key={o.id} className="pr-card">
                <div className="pr-card-header">
                  <div className="pr-customer">{o.customer_name || t('admin.returns.noName')}</div>
                  <span className={`pr-pill ${disp.cls}`}>{disp.txt}</span>
                </div>
                <div className="pr-address">{o.validated_address || o.original_address}</div>
                {o.customer_phone && <div className="pr-info">{t('admin.returns.tel')} {o.customer_phone}</div>}
                {o.held_by_driver_name && <div className="pr-info">{t('admin.returns.driver')} <strong>{o.held_by_driver_name}</strong></div>}
                <div className="pr-info">{t('admin.returns.skipped')} {fmtDate(o.skipped_at)}</div>
                {o.returned_at && <div className="pr-info">{t('admin.returns.received')} {fmtDate(o.returned_at)}</div>}
                {o.skip_reason && (
                  <div className="pr-reason">
                    <span className="material-icons" style={{ fontSize: 14 }}>info</span>
                    {o.skip_reason}
                  </div>
                )}
                <div className="pr-actions">
                  {o.package_disposition === 'pending_return' && (
                    <button className="pr-btn pr-btn-receive" disabled={busy === o.id} onClick={() => receive(o.id)}>
                      <span className="material-icons">inbox</span>{t('admin.returns.markReceived')}
                    </button>
                  )}
                  {o.package_disposition === 'returned_to_office' && (
                    <button className="pr-btn pr-btn-release" disabled={busy === o.id} onClick={() => release(o.id)}>
                      <span className="material-icons">redo</span>{t('admin.returns.releaseNewRoute')}
                    </button>
                  )}
                  {o.package_disposition === 'held_by_driver' && (
                    <>
                      <button className="pr-btn pr-btn-receive" disabled={busy === o.id} onClick={() => receive(o.id)}>
                        <span className="material-icons">inbox</span>{t('admin.returns.receiveAtOffice')}
                      </button>
                      <button className="pr-btn pr-btn-release" disabled={busy === o.id} onClick={() => release(o.id)}>
                        <span className="material-icons">redo</span>{t('admin.returns.releaseDirect')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PackageReturnsPage() {
  const [mainTab, setMainTab] = useState('pickup') // 'pickup' | 'returns'

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Recepción de Paquetes</h1>
        <p className="admin-subtitle">Confirma la entrega de rutas a choferes y gestiona retornos</p>
      </div>

      {/* Tabs principales */}
      <div className="pickup-main-tabs">
        <button
          className={`pickup-main-tab ${mainTab === 'pickup' ? 'active' : ''}`}
          onClick={() => setMainTab('pickup')}
        >
          <span className="material-icons">inventory</span>
          Recepción de Rutas
        </button>
        <button
          className={`pickup-main-tab ${mainTab === 'returns' ? 'active' : ''}`}
          onClick={() => setMainTab('returns')}
        >
          <span className="material-icons">assignment_return</span>
          Retornos de Paquetes
        </button>
      </div>

      <div className="pickup-section-body">
        {mainTab === 'pickup' ? <RoutePickupSection /> : <RetornosSection />}
      </div>
    </div>
  )
}
