import { useEffect, useState, useCallback } from 'react'
import api from '../../api'
import './AdminPages.css'
import './PackageReturnsPage.css'

const fmtDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

const dispositionLabel = (d) => {
  switch (d) {
    case 'held_by_driver': return { txt: 'Con el chofer', cls: 'pr-pill-driver' }
    case 'pending_return': return { txt: 'Pendiente devolucion', cls: 'pr-pill-pending' }
    case 'returned_to_office': return { txt: 'Recibido en oficina', cls: 'pr-pill-office' }
    default: return { txt: d || '-', cls: '' }
  }
}

export default function PackageReturnsPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/dispatch/returns')
      setOrders(res.data?.orders || [])
    } catch (err) {
      console.error('Error cargando devoluciones:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const receive = async (id) => {
    if (!confirm('Marcar este paquete como recibido en oficina?')) return
    setBusy(id)
    try {
      await api.put(`/api/dispatch/returns/${id}/receive`)
      await load()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al marcar como recibido')
    } finally {
      setBusy(null)
    }
  }

  const release = async (id) => {
    if (!confirm('Liberar paquete para asignar a una nueva ruta?')) return
    setBusy(id)
    try {
      await api.put(`/api/dispatch/returns/${id}/release`)
      await load()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al liberar paquete')
    } finally {
      setBusy(null)
    }
  }

  const filtered = orders.filter(o => filter === 'all' || o.package_disposition === filter)

  const counts = {
    all: orders.length,
    held_by_driver: orders.filter(o => o.package_disposition === 'held_by_driver').length,
    pending_return: orders.filter(o => o.package_disposition === 'pending_return').length,
    returned_to_office: orders.filter(o => o.package_disposition === 'returned_to_office').length,
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Recepcion de Paquetes</h1>
        <p className="admin-subtitle">
          Paquetes saltados por choferes. Marca cuando lleguen a oficina o liberalos para una nueva ruta.
        </p>
      </div>

      <div className="pr-tabs">
        <button className={`pr-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          Todos <span className="pr-count">{counts.all}</span>
        </button>
        <button className={`pr-tab ${filter === 'pending_return' ? 'active' : ''}`} onClick={() => setFilter('pending_return')}>
          Pendientes <span className="pr-count pr-count-warn">{counts.pending_return}</span>
        </button>
        <button className={`pr-tab ${filter === 'held_by_driver' ? 'active' : ''}`} onClick={() => setFilter('held_by_driver')}>
          Con chofer <span className="pr-count">{counts.held_by_driver}</span>
        </button>
        <button className={`pr-tab ${filter === 'returned_to_office' ? 'active' : ''}`} onClick={() => setFilter('returned_to_office')}>
          En oficina <span className="pr-count">{counts.returned_to_office}</span>
        </button>
        <button className="pr-refresh" onClick={load} disabled={loading}>
          <span className="material-icons">refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="pr-empty">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="pr-empty">
          <span className="material-icons" style={{ fontSize: 48, color: '#9ca3af' }}>inventory_2</span>
          <div>No hay paquetes en esta categoria</div>
        </div>
      ) : (
        <div className="pr-list">
          {filtered.map(o => {
            const disp = dispositionLabel(o.package_disposition)
            return (
              <div key={o.id} className="pr-card">
                <div className="pr-card-header">
                  <div className="pr-customer">{o.customer_name || 'Sin nombre'}</div>
                  <span className={`pr-pill ${disp.cls}`}>{disp.txt}</span>
                </div>
                <div className="pr-address">{o.validated_address || o.original_address}</div>
                {o.customer_phone && <div className="pr-info">Tel: {o.customer_phone}</div>}
                {o.held_by_driver_name && (
                  <div className="pr-info">Chofer: <strong>{o.held_by_driver_name}</strong></div>
                )}
                <div className="pr-info">Saltado: {fmtDate(o.skipped_at)}</div>
                {o.returned_at && <div className="pr-info">Recibido: {fmtDate(o.returned_at)}</div>}
                {o.skip_reason && (
                  <div className="pr-reason">
                    <span className="material-icons" style={{ fontSize: 14 }}>info</span>
                    {o.skip_reason}
                  </div>
                )}
                <div className="pr-actions">
                  {o.package_disposition === 'pending_return' && (
                    <button
                      className="pr-btn pr-btn-receive"
                      disabled={busy === o.id}
                      onClick={() => receive(o.id)}
                    >
                      <span className="material-icons">inbox</span>
                      Marcar recibido
                    </button>
                  )}
                  {o.package_disposition === 'returned_to_office' && (
                    <button
                      className="pr-btn pr-btn-release"
                      disabled={busy === o.id}
                      onClick={() => release(o.id)}
                    >
                      <span className="material-icons">redo</span>
                      Liberar para nueva ruta
                    </button>
                  )}
                  {o.package_disposition === 'held_by_driver' && (
                    <>
                      <button
                        className="pr-btn pr-btn-receive"
                        disabled={busy === o.id}
                        onClick={() => receive(o.id)}
                      >
                        <span className="material-icons">inbox</span>
                        Recibir en oficina
                      </button>
                      <button
                        className="pr-btn pr-btn-release"
                        disabled={busy === o.id}
                        onClick={() => release(o.id)}
                      >
                        <span className="material-icons">redo</span>
                        Liberar directo
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
