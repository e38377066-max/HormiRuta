/**
 * @fileoverview Recepción de Paquetes — dos secciones:
 *  1. Recepción de Rutas: confirmar entrega de paquetes al chofer + historial (por parada)
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

const fmtAmt = (n) => (n > 0 ? `$${Number(n).toFixed(2)}` : '')

// ─── Tarjeta de ruta pendiente con selección de paradas ───────────────────────
function RoutePickupCard({ route, onConfirmed }) {
  // Estado de selección: objeto { [stopId]: bool }
  const [selected, setSelected] = useState(() => {
    const init = {}
    route.stops.forEach(s => { init[s.id] = true })
    return init
  })
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const confirmedIds = route.stops.filter(s => selected[s.id]).map(s => s.id)
  const rejectedIds  = route.stops.filter(s => !selected[s.id]).map(s => s.id)
  const allSelected  = confirmedIds.length === route.stops.length
  const noneSelected = confirmedIds.length === 0

  const toggleAll = () => {
    const allOn = allSelected
    const next = {}
    route.stops.forEach(s => { next[s.id] = !allOn })
    setSelected(next)
  }

  const handleConfirm = async () => {
    if (noneSelected) {
      if (!window.confirm(`¿Devolver TODAS las paradas al dispatching y cancelar esta ruta?\n\nEsta acción no se puede deshacer.`)) return
    }
    setBusy(true)
    try {
      const res = await api.post(`/api/dispatch/pickup/${route.id}/confirm-stops`, {
        confirmed: confirmedIds,
        rejected: rejectedIds
      })
      onConfirmed(res.data.message || 'Procesado')
    } catch (e) {
      alert(e.response?.data?.error || 'Error al confirmar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pr-card pickup-card">
      {/* Cabecera de la ruta */}
      <div className="pr-card-header" style={{ cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
        <div className="pickup-route-name">
          <span className="material-icons" style={{ fontSize: 18, color: '#6200ea' }}>route</span>
          {route.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="pickup-badge pickup-badge-assigned">Asignada</span>
          <span className="material-icons" style={{ fontSize: 20, color: '#9ca3af', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>expand_more</span>
        </div>
      </div>

      <div className="pickup-meta">
        <span className="material-icons">person</span>
        <strong>{route.driver_name}</strong>
        <span style={{ margin: '0 6px', color: '#ddd' }}>·</span>
        <span className="material-icons">local_shipping</span>
        {route.stops_count} parada{route.stops_count !== 1 ? 's' : ''}
        <span style={{ margin: '0 6px', color: '#ddd' }}>·</span>
        <span className="material-icons">schedule</span>
        {fmtDate(route.assigned_at)}
      </div>

      {expanded && (
        <>
          {/* Barra de control — seleccionar todo */}
          <div className="pickup-stops-bar">
            <label className="pickup-check-all" onClick={toggleAll}>
              <span className={`pickup-checkbox ${allSelected ? 'checked' : ''}`}>
                {allSelected ? <span className="material-icons">check</span> : null}
              </span>
              {allSelected ? 'Desmarcar todo' : 'Marcar todo'}
            </label>
            <span className="pickup-stops-count">
              {confirmedIds.length}/{route.stops.length} seleccionadas
            </span>
          </div>

          {/* Lista de paradas */}
          <div className="pickup-stops-list">
            {route.stops.map((stop, idx) => (
              <div
                key={stop.id}
                className={`pickup-stop-row ${selected[stop.id] ? 'stop-selected' : 'stop-rejected'}`}
                onClick={() => setSelected(prev => ({ ...prev, [stop.id]: !prev[stop.id] }))}
              >
                <span className={`pickup-checkbox ${selected[stop.id] ? 'checked' : ''}`}>
                  {selected[stop.id] ? <span className="material-icons">check</span> : null}
                </span>
                <div className="pickup-stop-info">
                  <div className="pickup-stop-num">#{idx + 1}</div>
                  <div className="pickup-stop-details">
                    <div className="pickup-stop-name">{stop.customer_name}</div>
                    <div className="pickup-stop-addr">{stop.address}</div>
                    {stop.customer_phone && (
                      <div className="pickup-stop-phone">
                        <span className="material-icons">phone</span>{stop.customer_phone}
                      </div>
                    )}
                  </div>
                  {stop.amount > 0 && (
                    <div className="pickup-stop-amt">{fmtAmt(stop.amount)}</div>
                  )}
                </div>
                {!selected[stop.id] && (
                  <span className="pickup-stop-badge-rejected">No entregar</span>
                )}
              </div>
            ))}
          </div>

          {/* Resumen y botón de confirmación */}
          <div className="pickup-confirm-footer">
            {rejectedIds.length > 0 && (
              <div className="pickup-footer-warning">
                <span className="material-icons">info</span>
                {rejectedIds.length} parada{rejectedIds.length !== 1 ? 's' : ''} volverá{rejectedIds.length !== 1 ? 'n' : ''} al dispatching
              </div>
            )}
            <button
              className={`pr-btn ${noneSelected ? 'pr-btn-danger' : 'pickup-btn-confirm'}`}
              disabled={busy}
              onClick={handleConfirm}
            >
              <span className="material-icons">{noneSelected ? 'undo' : 'inventory'}</span>
              {busy
                ? 'Procesando…'
                : noneSelected
                  ? 'Devolver todo al dispatching'
                  : allSelected
                    ? `Confirmar toda la ruta (${confirmedIds.length})`
                    : `Confirmar ${confirmedIds.length} de ${route.stops.length}`
              }
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Sección de Recepción de Rutas ────────────────────────────────────────────
function RoutePickupSection() {
  const [subTab, setSubTab]   = useState('pending')
  const [pending, setPending] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [notif, setNotif]     = useState(null)

  const showNotif = (msg) => {
    setNotif(msg)
    setTimeout(() => setNotif(null), 5000)
  }

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

  useEffect(() => {
    const socket = getSocket()
    const handler = (data) => {
      loadAll()
      showNotif(`✅ Chofer ${data?.driver_name || ''} confirmó recogida de paquetes`)
    }
    socket.on('pickup:driver_confirmed', handler)
    return () => socket.off('pickup:driver_confirmed', handler)
  }, [loadAll])

  const handleRouteConfirmed = (msg) => {
    showNotif(`✅ ${msg}`)
    loadAll()
  }

  const statusBadge = (r) => {
    if (r.pickup_driver_confirmed_at)
      return <span className="pickup-badge pickup-badge-full">✓ Ambos confirmaron</span>
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
              <RoutePickupCard key={r.id} route={r} onConfirmed={handleRouteConfirmed} />
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
                  <span className="material-icons">person</span>
                  <strong>{r.driver_name}</strong>
                  <span style={{ margin: '0 6px', color: '#ddd' }}>·</span>
                  <span className="material-icons">local_shipping</span>
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

// ─── Sección de Retornos ──────────────────────────────────────────────────────
function RetornosSection() {
  const { t } = useTranslation()
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter]   = useState('all')
  const [busyId, setBusyId]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/dispatch/returns')
      setOrders(res.data.orders || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // package_disposition values: held_by_driver | pending_return | returned_to_office
  const pill = (disposition) => {
    const map = {
      held_by_driver:     { txt: t('admin.returns.heldByDriver'),     cls: 'pr-pill-skip' },
      pending_return:     { txt: t('admin.returns.pendingReturn'),     cls: 'pr-pill-pending' },
      returned_to_office: { txt: t('admin.returns.returnedToOffice'), cls: 'pr-pill-returned' },
    }
    return map[disposition] || { txt: disposition, cls: '' }
  }

  const counts = {
    all:                orders.length,
    held_by_driver:     orders.filter(o => o.package_disposition === 'held_by_driver').length,
    pending_return:     orders.filter(o => o.package_disposition === 'pending_return').length,
    returned_to_office: orders.filter(o => o.package_disposition === 'returned_to_office').length,
  }

  const visible = filter === 'all' ? orders : orders.filter(o => o.package_disposition === filter)

  // Marcar como recibido en oficina (pending_return → returned_to_office)
  const receiveAtOffice = async (id) => {
    setBusyId(id)
    try {
      await api.put(`/api/dispatch/returns/${id}/receive`)
      await load()
    } catch (e) {
      alert(e.response?.data?.error || t('admin.returns.errorMarking'))
    } finally { setBusyId(null) }
  }

  // Liberar de vuelta al dispatching (returned_to_office → available)
  const releaseToDispatch = async (id) => {
    if (!window.confirm(t('admin.returns.confirmRelease'))) return
    setBusyId(id)
    try {
      await api.put(`/api/dispatch/returns/${id}/release`)
      await load()
    } catch (e) {
      alert(e.response?.data?.error || t('admin.returns.errorMarking'))
    } finally { setBusyId(null) }
  }

  return (
    <div>
      <div className="pr-tabs">
        <button className={`pr-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          {t('admin.returns.filters.all')} <span className="pr-count">{counts.all}</span>
        </button>
        <button className={`pr-tab ${filter === 'held_by_driver' ? 'active' : ''}`} onClick={() => setFilter('held_by_driver')}>
          {t('admin.returns.filters.withDriver')} <span className="pr-count pr-count-warn">{counts.held_by_driver}</span>
        </button>
        <button className={`pr-tab ${filter === 'pending_return' ? 'active' : ''}`} onClick={() => setFilter('pending_return')}>
          {t('admin.returns.filters.pending')} <span className="pr-count pr-count-warn">{counts.pending_return}</span>
        </button>
        <button className={`pr-tab ${filter === 'returned_to_office' ? 'active' : ''}`} onClick={() => setFilter('returned_to_office')}>
          {t('admin.returns.filters.atOffice')} <span className="pr-count">{counts.returned_to_office}</span>
        </button>
        <button className="pr-refresh" onClick={load} disabled={loading}>
          <span className="material-icons">refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="pr-empty"><div className="spinner" /></div>
      ) : visible.length === 0 ? (
        <div className="pr-empty">
          <span className="material-icons" style={{ fontSize: 48, color: '#9ca3af' }}>inbox</span>
          <div>{t('admin.returns.noPackages')}</div>
        </div>
      ) : (
        <div className="pr-list">
          {visible.map(o => {
            const { txt, cls } = pill(o.package_disposition)
            const isBusy = busyId === o.id
            return (
              <div key={o.id} className="pr-card">
                <div className="pr-card-header">
                  <div className="pr-customer">
                    <span className="material-icons">person</span>
                    {o.customer_name || t('admin.returns.unknownCustomer')}
                  </div>
                  <span className={`pr-pill ${cls}`}>{txt}</span>
                </div>
                <div className="pr-address">
                  <span className="material-icons">place</span>
                  {o.validated_address || o.original_address}
                </div>
                {(o.held_by_driver_name || o.driver_name) && (
                  <div className="pr-driver">
                    <span className="material-icons">local_shipping</span>
                    {o.held_by_driver_name || o.driver_name}
                  </div>
                )}
                {o.skip_reason && (
                  <div className="pr-reason">
                    <span className="material-icons">info</span>
                    {o.skip_reason}
                  </div>
                )}
                <div className="pr-actions">
                  {/* Recibir en oficina: aplica a held_by_driver y pending_return */}
                  {(o.package_disposition === 'pending_return' || o.package_disposition === 'held_by_driver') && (
                    <button
                      className="pr-btn pr-btn-success"
                      disabled={isBusy}
                      onClick={() => receiveAtOffice(o.id)}
                    >
                      <span className="material-icons">move_to_inbox</span>
                      {isBusy ? 'Procesando…' : t('admin.returns.receiveAtOffice')}
                    </button>
                  )}
                  {/* Liberar al dispatching: aplica a returned_to_office */}
                  {o.package_disposition === 'returned_to_office' && (
                    <button
                      className="pr-btn pr-btn-outline"
                      disabled={isBusy}
                      onClick={() => releaseToDispatch(o.id)}
                    >
                      <span className="material-icons">redo</span>
                      {isBusy ? 'Procesando…' : t('admin.returns.releaseNewRoute')}
                    </button>
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
  const [mainTab, setMainTab] = useState('pickup')

  return (
    <div className="pr-page">
      <div className="pr-header">
        <h1 className="pr-title">
          <span className="material-icons">inventory_2</span>
          Recepción y Retornos
        </h1>
        <p className="pr-subtitle">Confirma la entrega de rutas a choferes y gestiona retornos</p>
      </div>

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
