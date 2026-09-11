/**
 * @fileoverview Recepción física y liberación de paquetes retornados.
 */

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../api'
import './AdminPages.css'
import './PackageReturnsPage.css'

function RetornosSection() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/dispatch/returns')
      setOrders(res.data.orders || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const pill = (disposition) => {
    const map = {
      held_by_driver: {
        txt: t('admin.returns.heldByDriver'),
        cls: 'pr-pill-skip',
      },
      pending_return: {
        txt: t('admin.returns.pendingReturn'),
        cls: 'pr-pill-pending',
      },
      returned_to_office: {
        txt: t('admin.returns.returnedToOffice'),
        cls: 'pr-pill-returned',
      },
    }
    return map[disposition] || { txt: disposition, cls: '' }
  }

  const counts = {
    all: orders.length,
    held_by_driver: orders.filter(o => o.package_disposition === 'held_by_driver').length,
    pending_return: orders.filter(o => o.package_disposition === 'pending_return').length,
    returned_to_office: orders.filter(o => o.package_disposition === 'returned_to_office').length,
  }

  const visible = filter === 'all'
    ? orders
    : orders.filter(o => o.package_disposition === filter)

  const receiveAtOffice = async (id) => {
    setBusyId(id)
    try {
      await api.put(`/api/dispatch/returns/${id}/receive`)
      await load()
    } catch (e) {
      alert(e.response?.data?.error || t('admin.returns.errorMarking'))
    } finally {
      setBusyId(null)
    }
  }

  const releaseToDispatch = async (id) => {
    if (!window.confirm(t('admin.returns.confirmRelease'))) return
    setBusyId(id)
    try {
      await api.put(`/api/dispatch/returns/${id}/release`)
      await load()
    } catch (e) {
      alert(e.response?.data?.error || t('admin.returns.errorMarking'))
    } finally {
      setBusyId(null)
    }
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

export default function PackageReturnsPage() {
  return (
    <div className="pr-page">
      <div className="pr-header">
        <h1 className="pr-title">
          <span className="material-icons">assignment_return</span>
          Retornos de Paquetes
        </h1>
        <p className="pr-subtitle">
          Recibe paquetes devueltos en la oficina y libéralos para una nueva ruta
        </p>
      </div>

      <div className="pickup-section-body">
        <RetornosSection />
      </div>
    </div>
  )
}