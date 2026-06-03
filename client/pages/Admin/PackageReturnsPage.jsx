import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../api'
import './AdminPages.css'
import './PackageReturnsPage.css'

const fmtDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function PackageReturnsPage() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null)

  const dispositionLabel = (d) => {
    switch (d) {
      case 'held_by_driver': return { txt: t('admin.returns.withDriver'), cls: 'pr-pill-driver' }
      case 'pending_return': return { txt: t('admin.returns.pendingReturn'), cls: 'pr-pill-pending' }
      case 'returned_to_office': return { txt: t('admin.returns.receivedAtOffice'), cls: 'pr-pill-office' }
      default: return { txt: d || '-', cls: '' }
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/dispatch/returns')
      setOrders(res.data?.orders || [])
    } catch (err) {
      console.error('Error loading returns:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const receive = async (id) => {
    if (!confirm(t('admin.returns.confirmReceived'))) return
    setBusy(id)
    try {
      await api.put(`/api/dispatch/returns/${id}/receive`)
      await load()
    } catch (err) {
      alert(err.response?.data?.error || t('common.error'))
    } finally {
      setBusy(null)
    }
  }

  const release = async (id) => {
    if (!confirm(t('admin.returns.confirmRelease'))) return
    setBusy(id)
    try {
      await api.put(`/api/dispatch/returns/${id}/release`)
      await load()
    } catch (err) {
      alert(err.response?.data?.error || t('common.error'))
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
        <h1>{t('admin.returns.title')}</h1>
        <p className="admin-subtitle">{t('admin.returns.subtitle')}</p>
      </div>

      <div className="pr-tabs">
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
                {o.held_by_driver_name && (
                  <div className="pr-info">{t('admin.returns.driver')} <strong>{o.held_by_driver_name}</strong></div>
                )}
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
                    <button
                      className="pr-btn pr-btn-receive"
                      disabled={busy === o.id}
                      onClick={() => receive(o.id)}
                    >
                      <span className="material-icons">inbox</span>
                      {t('admin.returns.markReceived')}
                    </button>
                  )}
                  {o.package_disposition === 'returned_to_office' && (
                    <button
                      className="pr-btn pr-btn-release"
                      disabled={busy === o.id}
                      onClick={() => release(o.id)}
                    >
                      <span className="material-icons">redo</span>
                      {t('admin.returns.releaseNewRoute')}
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
                        {t('admin.returns.receiveAtOffice')}
                      </button>
                      <button
                        className="pr-btn pr-btn-release"
                        disabled={busy === o.id}
                        onClick={() => release(o.id)}
                      >
                        <span className="material-icons">redo</span>
                        {t('admin.returns.releaseDirect')}
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
