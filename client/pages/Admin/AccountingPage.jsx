/**
 * @fileoverview Página de contabilidad administrativa.
 * Proporciona un resumen de liquidaciones por chofer, reportes de entregas detallados y gestión de estados de pago de rutas.
 */

import { useEffect, useState, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api'
import './AdminPages.css'

/** Formatea un valor numérico a moneda USD */
const fmt = (val) => val != null ? `$${Number(val).toFixed(2)}` : '-'

/** Formatea una fecha para visualización */
const fmtDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * Componente AccountingPage para la gestión financiera de repartos.
 * @returns {JSX.Element}
 */
export default function AccountingPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  /** @type {[string, Function]} Pestaña activa ('summary', 'deliveries', 'payments') */
  const [activeTab, setActiveTab] = useState('summary')

  // --- Estados para Resumen por Chofer ---
  /** @type {[Array, Function]} Datos del reporte de cobranza acumulada */
  const [report, setReport] = useState([])
  /** @type {[Array, Function]} Lista de repartidores para filtros */
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedDriver, setExpandedDriver] = useState(null)

  // --- Estados para Reporte de Entregas ---
  /** @type {[Array, Function]} Lista de paradas/órdenes entregadas */
  const [deliveries, setDeliveries] = useState([])
  const [loadingDeliveries, setLoadingDeliveries] = useState(false)
  const [delDriver, setDelDriver] = useState('')
  const [delDateFrom, setDelDateFrom] = useState('')
  const [delDateTo, setDelDateTo] = useState('')
  const [delSearch, setDelSearch] = useState('')
  const [delSearchInput, setDelSearchInput] = useState('')
  /** @type {[Array, Function]} Meses disponibles para reportes históricos */
  const [availableMonths, setAvailableMonths] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [archivingMonth, setArchivingMonth] = useState(false)

  // --- Estados para Pagos de Rutas ---
  /** @type {[Array, Function]} Estado de liquidación de rutas completadas */
  const [routePayments, setRoutePayments] = useState([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [payDriver, setPayDriver] = useState('')
  const [payDateFrom, setPayDateFrom] = useState('')
  const [payDateTo, setPayDateTo] = useState('')
  const [payFilter, setPayFilter] = useState('all')

  // --- Estados para Modales y UI ---
  const [confirmModal, setConfirmModal] = useState(null)
  const [confirmType, setConfirmType] = useState('full')
  const [confirmAmount, setConfirmAmount] = useState('')
  const [confirmMethod, setConfirmMethod] = useState('cash')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [expandedPayRoute, setExpandedPayRoute] = useState(null)
  const [viewingPhoto, setViewingPhoto] = useState(null)

  /** Carga inicial de choferes y reporte base */
  useEffect(() => {
    fetchDrivers()
    fetchReport()
  }, [])

  /** Carga datos específicos al cambiar de pestaña */
  useEffect(() => {
    if (activeTab === 'deliveries') fetchDeliveries()
    if (activeTab === 'payments') fetchRoutePayments()
  }, [activeTab])

  /** Refresco automático del resumen cada 90 segundos si la pestaña está activa */
  useEffect(() => {
    if (activeTab !== 'summary') return
    const interval = setInterval(() => {
      fetchReport()
    }, 90000)
    return () => clearInterval(interval)
  }, [activeTab, selectedDriver, dateFrom, dateTo])

  /** Obtiene la lista de usuarios con rol 'driver' */
  const fetchDrivers = async () => {
    try {
      const res = await api.get('/api/admin/users', { params: { role: 'driver' } })
      setDrivers(res.data.users || [])
    } catch (e) {
      console.error('Error cargando choferes:', e)
    }
  }

  /**
   * Obtiene el reporte consolidado de cobranza por chofer.
   * @async
   */
  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = {}
      if (selectedDriver) params.driver_id = selectedDriver
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const res = await api.get('/api/dispatch/accounting', { params })
      setReport(res.data.report || [])
    } catch (e) {
      console.error('Error cargando reporte:', e)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Obtiene el reporte detallado de entregas realizadas.
   * @async
   */
  const fetchDeliveries = useCallback(async () => {
    setLoadingDeliveries(true)
    try {
      const params = {}
      if (delDriver) params.driver_id = delDriver
      if (selectedMonth) {
        params.month_year = selectedMonth
      } else {
        if (delDateFrom) params.date_from = delDateFrom
        if (delDateTo) params.date_to = delDateTo
      }
      if (delSearch) params.search = delSearch
      const res = await api.get('/api/dispatch/deliveries-report', { params })
      setDeliveries(res.data.deliveries || [])
      setAvailableMonths(res.data.available_months || [])
    } catch (e) {
      console.error('Error cargando entregas:', e)
    } finally {
      setLoadingDeliveries(false)
    }
  }, [delDriver, delDateFrom, delDateTo, delSearch, selectedMonth])

  /**
   * Archiva un mes de entregas y descarga el reporte en formato Excel.
   * @async
   */
  const handleArchiveMonth = async () => {
    const target = selectedMonth || currentMonthYear()
    if (!window.confirm(t('admin.accounting.closeAndExport', { month: target }))) return
    setArchivingMonth(true)
    try {
      const res = await api.post('/api/dispatch/deliveries-report/archive-month', { month_year: target }, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte_${target}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      await fetchDeliveries()
    } catch (e) {
      const msg = e.response?.data ? await e.response.data.text() : t('admin.accounting.archiveError')
      alert(JSON.parse(msg)?.error || msg)
    } finally {
      setArchivingMonth(false)
    }
  }

  /**
   * Obtiene el listado de rutas y su estado de liquidación.
   * @async
   */
  const fetchRoutePayments = async (overrides = {}) => {
    setLoadingPayments(true)
    try {
      const params = {}
      const d = overrides.driver !== undefined ? overrides.driver : payDriver
      const df = overrides.dateFrom !== undefined ? overrides.dateFrom : payDateFrom
      const dt = overrides.dateTo !== undefined ? overrides.dateTo : payDateTo
      if (d) params.driver_id = d
      if (df) params.date_from = df
      if (dt) params.date_to = dt
      const res = await api.get('/api/dispatch/routes/payment-status', { params })
      setRoutePayments(res.data.routes || [])
    } catch (e) {
      console.error('Error cargando pagos de rutas:', e)
    } finally {
      setLoadingPayments(false)
    }
  }

  /** Prepara el modal para confirmar la recepción de dinero de una ruta */
  const openConfirmModal = (route) => {
    setConfirmModal(route)
    setConfirmType('full')
    setConfirmAmount('')
    setConfirmMethod(route.payment_delivery_method || 'cash')
  }

  /**
   * Registra la confirmación administrativa de un pago de ruta.
   * @async
   */
  const handleAdminConfirm = async () => {
    if (!confirmModal) return
    if (confirmType === 'partial' && (!confirmAmount || isNaN(Number(confirmAmount)) || Number(confirmAmount) <= 0)) {
      alert(t('admin.accounting.invalidAmount'))
      return
    }
    setConfirmLoading(true)
    try {
      await api.put(`/api/dispatch/routes/${confirmModal.id}/admin-confirm-payment`, {
        type: confirmType,
        amount: confirmType === 'partial' ? Number(confirmAmount) : undefined,
        method: confirmMethod
      })
      setConfirmModal(null)
      await fetchRoutePayments()
    } catch (e) {
      alert(e.response?.data?.error || t('admin.accounting.paymentError'))
    } finally {
      setConfirmLoading(false)
    }
  }

  /** Retorna el mes/año actual en formato YYYY-MM */
  const currentMonthYear = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  /** Obtiene una etiqueta legible para el mes y año */
  const monthLabel = (my) => {
    if (!my) return ''
    const [y, m] = my.split('-')
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
  }

  const handleSummaryFilter = (e) => {
    e.preventDefault()
    fetchReport()
  }

  const handleDeliveriesFilter = (e) => {
    e.preventDefault()
    setDelSearch(delSearchInput)
    setTimeout(fetchDeliveries, 0)
  }

  useEffect(() => {
    if (activeTab === 'deliveries') fetchDeliveries()
  }, [delDriver, delDateFrom, delDateTo, delSearch, selectedMonth])

  /** Calcula totales acumulados del reporte de resumen */
  const summaryTotals = report.reduce((acc, row) => ({
    stops: acc.stops + row.stops_count,
    cost: acc.cost + row.total_order_cost,
    deposit: acc.deposit + row.total_deposit,
    collected: acc.collected + row.total_collected,
    commission: acc.commission + row.total_commission
  }), { stops: 0, cost: 0, deposit: 0, collected: 0, commission: 0 })

  /** Calcula totales acumulados del reporte de entregas */
  const deliveryTotals = deliveries.reduce((acc, d) => ({
    count: acc.count + 1,
    cost: acc.cost + d.order_cost,
    deposit: acc.deposit + d.deposit_amount,
    to_collect: acc.to_collect + d.total_to_collect,
    collected: acc.collected + d.amount_collected,
    commission: acc.commission + d.commission_per_stop
  }), { count: 0, cost: 0, deposit: 0, to_collect: 0, collected: 0, commission: 0 })

  /** Exporta el resumen de choferes a CSV */
  const exportSummaryCSV = () => {
    const headers = [
      t('admin.accounting.driver'),
      t('admin.accounting.stops'),
      t('admin.accounting.orderCost'),
      t('admin.accounting.deposit'),
      t('admin.accounting.collected'),
      t('admin.accounting.commissionPerStop'),
      t('admin.accounting.totalCommission'),
      t('admin.accounting.driverBalance')
    ]
    const rows = report.map(r => [
      r.driver_name, r.stops_count,
      r.total_order_cost.toFixed(2), r.total_deposit.toFixed(2),
      r.total_collected.toFixed(2), (r.commission_per_stop || 0).toFixed(2),
      r.total_commission.toFixed(2), r.balance.toFixed(2)
    ])
    downloadCSV([headers, ...rows], `cobranza_${today()}`)
  }

  /** Exporta el detalle de entregas a CSV */
  const exportDeliveriesCSV = () => {
    const headers = [
      '#Orden',
      t('admin.accounting.client'),
      t('admin.accounting.phone'),
      t('admin.accounting.address'),
      'Ciudad',
      'Estado',
      t('admin.accounting.driver'),
      t('admin.accounting.cost'),
      t('admin.accounting.deposit'),
      t('admin.accounting.toCollect'),
      t('admin.accounting.collected'),
      t('admin.accounting.method'),
      t('admin.accounting.commissionPerStop'),
      t('admin.accounting.deliveryDate')
    ]
    const rows = deliveries.map(d => [
      d.id, d.customer_name || '', d.customer_phone || '',
      d.address || '', d.city || '', d.state || '',
      d.driver_name || '', d.order_cost.toFixed(2),
      d.deposit_amount.toFixed(2), d.total_to_collect.toFixed(2),
      d.amount_collected.toFixed(2), d.payment_method || '',
      d.commission_per_stop.toFixed(2),
      d.delivered_at ? new Date(d.delivered_at).toLocaleDateString(undefined) : ''
    ])
    downloadCSV([headers, ...rows], `entregas_${today()}`)
  }

  /** Descarga un array de datos como archivo CSV */
  const downloadCSV = (data, filename) => {
    const csv = data.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const today = () => new Date().toISOString().split('T')[0]

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1>{t('admin.accounting.title')}</h1>
      </div>

      <div className="accounting-tabs">
        <button
          className={`accounting-tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          <span className="material-icons">people</span>
          {t('admin.accounting.driverSummary')}
        </button>
        <button
          className={`accounting-tab ${activeTab === 'deliveries' ? 'active' : ''}`}
          onClick={() => setActiveTab('deliveries')}
        >
          <span className="material-icons">local_shipping</span>
          {t('admin.accounting.deliveryReport')}
        </button>
        <button
          className={`accounting-tab ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          <span className="material-icons">payments</span>
          {t('admin.accounting.companyPayments')}
        </button>
      </div>

      {activeTab === 'summary' && (
        <>
          <div className="content-card" style={{ marginBottom: 16 }}>
            <form className="accounting-filter-form" onSubmit={handleSummaryFilter}>
              <div className="accounting-filter-fields">
                <div className="field-group">
                  <label>{t('admin.accounting.driver')}</label>
                  <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}>
                    <option value="">{t('admin.accounting.allDrivers')}</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.username || d.email}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>{t('admin.accounting.from')}</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="field-group">
                  <label>{t('admin.accounting.to')}</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>
              <div className="accounting-filter-actions">
                <button type="submit" className="btn-primary" disabled={loading}>
                  <span className="material-icons">filter_list</span>
                  {t('admin.accounting.filter')}
                </button>
                <button type="button" className="btn-secondary" onClick={exportSummaryCSV} disabled={report.length === 0}>
                  <span className="material-icons">download</span>
                  {t('admin.accounting.exportCsv')}
                </button>
              </div>
            </form>
          </div>

          {loading ? (
            <div className="loading-container"><div className="spinner"></div></div>
          ) : report.length === 0 ? (
            <div className="content-card">
              <div className="empty-state">
                <span className="material-icons">receipt_long</span>
                <p>{t('admin.accounting.noDeliveries')}</p>
              </div>
            </div>
          ) : (
            <div className="content-card" style={{ overflowX: 'auto' }}>
              <table className="data-table accounting-table">
                <thead>
                  <tr>
                    <th>{t('admin.accounting.driver')}</th>
                    <th style={{ textAlign: 'center' }}>{t('admin.accounting.stops')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.orderCost')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.deposit')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.collected')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.commissionPerStop')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.totalCommission')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.driverBalance')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {report.map(row => (
                    <>
                      <tr key={row.driver_id} className="accounting-row">
                        <td>
                          <div className="user-cell">
                            <div className="avatar" style={{ background: '#6200ea', color: '#fff' }}>
                              {(row.driver_name || '?')[0].toUpperCase()}
                            </div>
                            <span>{row.driver_name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="accounting-badge">{row.stops_count}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{fmt(row.total_order_cost)}</td>
                        <td style={{ textAlign: 'right', color: '#888' }}>{fmt(row.total_deposit)}</td>
                        <td style={{ textAlign: 'right', color: '#2e7d32', fontWeight: 600 }}>{fmt(row.total_collected)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {row.commission_per_stop ? fmt(row.commission_per_stop) : <span style={{ color: '#999', fontSize: 12 }}>No config.</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(row.total_commission)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ color: row.balance >= 0 ? '#1565c0' : '#c62828', fontWeight: 700 }}>
                            {fmt(row.balance)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="icon-btn"
                            onClick={() => setExpandedDriver(expandedDriver === row.driver_id ? null : row.driver_id)}
                            title="Ver detalle"
                          >
                            <span className="material-icons">
                              {expandedDriver === row.driver_id ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                        </td>
                      </tr>
                      {expandedDriver === row.driver_id && (
                        <tr key={`detail-${row.driver_id}`}>
                          <td colSpan={9} style={{ padding: 0 }}>
                            <div className="accounting-detail">
                              <table className="detail-table">
                                <thead>
                                  <tr>
                                    <th>{t('admin.accounting.client')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.cost')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.deposit')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.toCollect')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.collected')}</th>
                                    <th>{t('admin.accounting.method')}</th>
                                    <th>{t('admin.accounting.columns.date')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.orders.map(o => (
                                    <tr key={o.id}>
                                      <td>{o.customer_name || t('admin.accounting.noName')}</td>
                                      <td style={{ textAlign: 'right' }}>{fmt(o.order_cost)}</td>
                                      <td style={{ textAlign: 'right', color: '#888' }}>{fmt(o.deposit_amount)}</td>
                                      <td style={{ textAlign: 'right' }}>{fmt(o.total_to_collect)}</td>
                                      <td style={{ textAlign: 'right', color: '#2e7d32', fontWeight: 600 }}>{fmt(o.amount_collected)}</td>
                                      <td>
                                        {o.payment_method ? (
                                          <span className={`payment-method-tag ${o.payment_method}`}>{o.payment_method}</span>
                                        ) : '-'}
                                      </td>
                                      <td style={{ color: '#666', fontSize: 12 }}>
                                        {o.delivered_at ? new Date(o.delivered_at).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="accounting-totals">
                    <td><strong>TOTAL</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{summaryTotals.stops}</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{fmt(summaryTotals.cost)}</strong></td>
                    <td style={{ textAlign: 'right', color: '#888' }}><strong>{fmt(summaryTotals.deposit)}</strong></td>
                    <td style={{ textAlign: 'right', color: '#2e7d32' }}><strong>{fmt(summaryTotals.collected)}</strong></td>
                    <td></td>
                    <td style={{ textAlign: 'right' }}><strong>{fmt(summaryTotals.commission)}</strong></td>
                    <td style={{ textAlign: 'right', color: '#1565c0' }}><strong>{fmt(summaryTotals.collected - summaryTotals.commission)}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'payments' && (
        <>
          <div className="content-card" style={{ marginBottom: 16 }}>
            <form className="accounting-filter-form" onSubmit={e => { e.preventDefault(); fetchRoutePayments() }}>
              <div className="accounting-filter-fields del-filter-grid">
                <div className="field-group">
                  <label>{t('admin.accounting.driver')}</label>
                  <select value={payDriver} onChange={e => setPayDriver(e.target.value)}>
                    <option value="">{t('admin.accounting.allDrivers')}</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.username || d.email}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>{t('admin.accounting.from')}</label>
                  <input type="date" value={payDateFrom} onChange={e => setPayDateFrom(e.target.value)} />
                </div>
                <div className="field-group">
                  <label>{t('admin.accounting.to')}</label>
                  <input type="date" value={payDateTo} onChange={e => setPayDateTo(e.target.value)} />
                </div>
                <div className="field-group">
                  <label>{t('admin.accounting.filterStatus')}</label>
                  <select value={payFilter} onChange={e => setPayFilter(e.target.value)}>
                    <option value="all">{t('admin.accounting.statusAll')}</option>
                    <option value="pending">{t('admin.accounting.statusPending')}</option>
                    <option value="to_confirm">{t('admin.accounting.statusToConfirm')}</option>
                    <option value="partial">{t('admin.accounting.statusPartial')}</option>
                    <option value="confirmed">{t('admin.accounting.statusConfirmed')}</option>
                  </select>
                </div>
              </div>
              <div className="accounting-filter-actions">
                <button type="submit" className="btn-primary" disabled={loadingPayments}>
                  <span className="material-icons">filter_list</span>
                  {t('admin.accounting.filter')}
                </button>
              </div>
            </form>
          </div>

          {loadingPayments ? (
            <div className="loading-container"><div className="spinner"></div></div>
          ) : (() => {
            const filtered = routePayments.filter(r => {
              if (payFilter === 'all') return true
              if (payFilter === 'pending') return !r.payment_delivered
              if (payFilter === 'to_confirm') return r.payment_delivered && !r.admin_confirmed && r.admin_amount_received === 0
              if (payFilter === 'partial') return r.payment_delivered && !r.admin_confirmed && r.admin_amount_received > 0
              if (payFilter === 'confirmed') return r.admin_confirmed
              return true
            })
            const getStatusBadge = (r) => {
              if (!r.payment_delivered) return (
                <span style={{ background: '#fff3e0', color: '#e65100', fontWeight: 700, padding: '3px 10px', borderRadius: 12, fontSize: 13 }}>
                  {t('admin.accounting.notDelivered')}
                </span>
              )
              if (r.admin_confirmed) return (
                <span style={{ background: '#e8f5e9', color: '#2e7d32', fontWeight: 700, padding: '3px 10px', borderRadius: 12, fontSize: 13 }}>
                  {t('admin.accounting.confirmedBadge')}
                </span>
              )
              if (r.admin_amount_received > 0) return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ background: '#e3f2fd', color: '#1565c0', fontWeight: 700, padding: '3px 10px', borderRadius: 12, fontSize: 13 }}>
                    {t('admin.accounting.partialBadge', {amount: fmt(r.admin_amount_received)})}
                  </span>
                  <span style={{ fontSize: 11, color: '#e65100' }}>{t('admin.accounting.owes', {amount: fmt(r.admin_remaining)})}</span>
                </div>
              )
              return (
                <span style={{ background: '#ede7f6', color: '#4527a0', fontWeight: 700, padding: '3px 10px', borderRadius: 12, fontSize: 13 }}>
                  {t('admin.accounting.statusToConfirm')}
                </span>
              )
            }
            return filtered.length === 0 ? (
              <div className="content-card">
                <div className="empty-state">
                  <span className="material-icons">payments</span>
                  <p>{t('admin.accounting.noPaymentsFilter')}</p>
                </div>
              </div>
            ) : (
              <div className="content-card" style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('admin.accounting.route')}</th>
                      <th>{t('admin.accounting.driver')}</th>
                      <th style={{ textAlign: 'right' }}>{t('admin.accounting.cashToDeliver')}</th>
                      <th style={{ textAlign: 'right' }}>{t('admin.accounting.zelleTransfer')}</th>
                      <th style={{ textAlign: 'right' }}>{t('admin.accounting.commission')}</th>
                      <th>{t('admin.accounting.payStatus')}</th>
                      <th>{t('admin.accounting.driverMethod')}</th>
                      <th>{t('admin.accounting.completedDate')}</th>
                      <th>{t('admin.accounting.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => {
                      const elecStops = Array.isArray(r.electronic_stops) ? r.electronic_stops : []
                      const hasElectronic = elecStops.length > 0 || Number(r.electronic_collected || 0) > 0
                      const isExpanded = expandedPayRoute === r.id
                      return (
                      <Fragment key={r.id}>
                      <tr>
                        <td>
                          <strong>{r.name || `Ruta #${r.id}`}</strong>
                          {r.stops_count > 0 && (
                            <span style={{ marginLeft: 6, fontSize: 12, color: '#888' }}>
                              ({r.stops_count} paradas)
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="del-driver-cell">
                            <div className="avatar-sm" style={{ background: '#6200ea', color: '#fff' }}>
                              {(r.driver_name || '?')[0].toUpperCase()}
                            </div>
                            <span>{r.driver_name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#2e7d32' }}>
                          {fmt(r.route_total_collected)}
                          {Number(r.route_gross_collected || 0) !== Number(r.route_total_collected || 0) && (
                            <div style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>
                              Efectivo: {fmt(r.route_gross_collected)}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: hasElectronic ? '#6200ea' : '#bbb' }}>
                          {hasElectronic ? (
                            <button
                              type="button"
                              onClick={() => setExpandedPayRoute(isExpanded ? null : r.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6200ea', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 2, padding: 0 }}
                              title="Ver comprobantes"
                            >
                              {fmt(r.electronic_collected)}
                              <span className="material-icons" style={{ fontSize: 16 }}>{isExpanded ? 'expand_less' : 'receipt_long'}</span>
                            </button>
                          ) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', color: '#ef6c00', fontWeight: 600 }}>
                          {Number(r.route_total_commission || 0) > 0 ? fmt(r.route_total_commission) : <span style={{ color: '#bbb', fontWeight: 400 }}>—</span>}
                        </td>
                        <td>{getStatusBadge(r)}</td>
                        <td>
                          {r.payment_delivery_method ? (
                            <span className={`payment-method-tag ${r.payment_delivery_method}`}>
                              {r.payment_delivery_method}
                            </span>
                          ) : (
                            <span style={{ color: '#bbb' }}>—</span>
                          )}
                        </td>
                        <td style={{ color: '#666', fontSize: 13 }}>
                          {r.completed_at ? fmtDate(r.completed_at) : '—'}
                        </td>
                        <td>
                          {r.payment_delivered && !r.admin_confirmed && (
                            <button
                              className="btn-primary"
                              style={{ fontSize: 12, padding: '4px 12px' }}
                              onClick={() => openConfirmModal(r)}
                            >
                              <span className="material-icons" style={{ fontSize: 14 }}>check_circle</span>
                              {r.admin_amount_received > 0 ? t('admin.accounting.confirmBalance') : t('admin.accounting.confirmReceive')}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && hasElectronic && (
                        <tr>
                          <td colSpan={9} style={{ background: '#faf7ff', padding: 0 }}>
                            <div style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 700, color: '#4527a0', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="material-icons" style={{ fontSize: 18 }}>receipt_long</span>
                                {t('admin.accounting.zellePaymentTitle', {amount: fmt(r.electronic_collected)})}
                              </div>
                              {elecStops.length === 0 ? (
                                <div style={{ fontSize: 13, color: '#888' }}>{t('admin.accounting.noStopsWithReceipt')}</div>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                  {elecStops.map(s => (
                                    <div key={s.id} style={{ background: '#fff', border: '1px solid #e6def7', borderRadius: 10, padding: 10, width: 220 }}>
                                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{s.customer_name || t('admin.accounting.noName')}</div>
                                      {s.address && (
                                        <div style={{ fontSize: 11, color: '#888', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {s.address}{s.apartment_number ? `, Apt ${s.apartment_number}` : ''}
                                        </div>
                                      )}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                        <span style={{ fontWeight: 700, color: '#2e7d32' }}>{fmt(s.amount_collected)}</span>
                                        <span className={`payment-method-tag ${s.payment_method}`}>{s.payment_method}</span>
                                      </div>
                                      {s.photo_url ? (
                                        <img
                                          src={s.photo_url}
                                          alt={`Comprobante ${s.customer_name || ''}`}
                                          onClick={() => setViewingPhoto(s.photo_url)}
                                          style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid #eee' }}
                                        />
                                      ) : (
                                        <div style={{ width: '100%', height: 120, borderRadius: 8, background: '#f3f0fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b39ddb', fontSize: 12, textAlign: 'center', padding: 8 }}>
                                          <span>{t('admin.accounting.noPaymentReceipt')}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="accounting-totals">
                      <td colSpan={2}><strong>{t('admin.accounting.totalRoutes', {count: filtered.length})}</strong></td>
                      <td style={{ textAlign: 'right', color: '#2e7d32' }}>
                        <strong>{fmt(filtered.reduce((s, r) => s + Number(r.route_total_collected || 0), 0))}</strong>
                      </td>
                      <td style={{ textAlign: 'right', color: '#6200ea' }}>
                        <strong>{fmt(filtered.reduce((s, r) => s + Number(r.electronic_collected || 0), 0))}</strong>
                      </td>
                      <td style={{ textAlign: 'right', color: '#ef6c00' }}>
                        <strong>{fmt(filtered.reduce((s, r) => s + Number(r.route_total_commission || 0), 0))}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: '#888' }}>
                          {t('admin.accounting.pendingToConfirm', {pending: filtered.filter(r => !r.admin_confirmed).length, confirmed: filtered.filter(r => r.admin_confirmed).length})}
                        </span>
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })()}
        </>
      )}

      {activeTab === 'deliveries' && (
        <>
          <div className="content-card" style={{ marginBottom: 16 }}>
            <form className="accounting-filter-form" onSubmit={handleDeliveriesFilter}>
              <div className="del-search-row">
                <div className="del-search-wrapper">
                  <span className="material-icons del-search-icon">search</span>
                  <input
                    type="text"
                    className="del-search-input"
                    placeholder={t('admin.accounting.searchPlaceholder')}
                    value={delSearchInput}
                    onChange={e => setDelSearchInput(e.target.value)}
                  />
                </div>
              </div>
              <div className="accounting-filter-fields del-filter-grid">
                <div className="field-group">
                  <label>{t('admin.accounting.month')}</label>
                  <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setDelDateFrom(''); setDelDateTo('') }}>
                    <option value="">{t('admin.accounting.allMonths')}</option>
                    {availableMonths.map(m => (
                      <option key={m} value={m}>{monthLabel(m)}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>{t('admin.accounting.driver')}</label>
                  <select value={delDriver} onChange={e => setDelDriver(e.target.value)}>
                    <option value="">{t('admin.accounting.allDrivers')}</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.username || d.email}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>{t('admin.accounting.from')}</label>
                  <input type="date" value={delDateFrom} disabled={!!selectedMonth} onChange={e => setDelDateFrom(e.target.value)} />
                </div>
                <div className="field-group">
                  <label>{t('admin.accounting.to')}</label>
                  <input type="date" value={delDateTo} disabled={!!selectedMonth} onChange={e => setDelDateTo(e.target.value)} />
                </div>
              </div>
              <div className="accounting-filter-actions">
                <button type="submit" className="btn-primary" disabled={loadingDeliveries}>
                  <span className="material-icons">filter_list</span>
                  {t('admin.accounting.filter')}
                </button>
                <button type="button" className="btn-secondary" onClick={exportDeliveriesCSV} disabled={deliveries.length === 0}>
                  <span className="material-icons">download</span>
                  {t('admin.accounting.exportCsv')}
                </button>
                <button
                  type="button"
                  className="btn-archive-month"
                  onClick={handleArchiveMonth}
                  disabled={archivingMonth}
                  title={`${t('admin.accounting.closeMonth', {month: monthLabel(selectedMonth || currentMonthYear())})} y exportar Excel`}
                >
                  <span className="material-icons">{archivingMonth ? 'hourglass_empty' : 'table_view'}</span>
                  {archivingMonth ? t('admin.accounting.exporting') : t('admin.accounting.closeMonth', {month: monthLabel(selectedMonth || currentMonthYear())})}
                </button>
                {deliveries.length > 0 && (
                  <span className="del-count-badge">{deliveries.length} entrega{deliveries.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </form>
          </div>

          {loadingDeliveries ? (
            <div className="loading-container"><div className="spinner"></div></div>
          ) : deliveries.length === 0 ? (
            <div className="content-card">
              <div className="empty-state">
                <span className="material-icons">local_shipping</span>
                <p>{t('admin.accounting.noDeliveriesFilter')}</p>
              </div>
            </div>
          ) : (
            <div className="content-card" style={{ overflowX: 'auto' }}>
              <table className="data-table deliveries-report-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('admin.accounting.client')}</th>
                    <th>{t('admin.accounting.phone')}</th>
                    <th>{t('admin.accounting.address')}</th>
                    <th>{t('admin.accounting.driver')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.cost')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.deposit')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.toCollect')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.collected')}</th>
                    <th>{t('admin.accounting.method')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin.accounting.commission')}</th>
                    <th>{t('admin.accounting.deliveryDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map(d => (
                    <tr key={d.id} className="delivery-report-row">
                      <td className="del-id-cell">#{d.id}</td>
                      <td className="del-customer-cell">
                        <span className="del-customer-name">{d.customer_name || '—'}</span>
                        {d.archived && <span className="archived-badge">{t('admin.accounting.archiveBadge')}</span>}
                      </td>
                      <td className="del-phone-cell">{d.customer_phone || '—'}</td>
                      <td className="del-address-cell">
                        <span title={d.address}>{d.address || '—'}</span>
                      </td>
                      <td>
                        <div className="del-driver-cell">
                          <div className="avatar-sm" style={{ background: '#6200ea', color: '#fff' }}>
                            {(d.driver_name || '?')[0].toUpperCase()}
                          </div>
                          <span>{d.driver_name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{fmt(d.order_cost)}</td>
                      <td style={{ textAlign: 'right', color: '#888' }}>{fmt(d.deposit_amount)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(d.total_to_collect)}</td>
                      <td style={{ textAlign: 'right', color: '#2e7d32', fontWeight: 600 }}>{fmt(d.amount_collected)}</td>
                      <td>
                        {d.payment_method
                          ? <span className={`payment-method-tag ${d.payment_method}`}>{d.payment_method}</span>
                          : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {d.commission_per_stop > 0 ? fmt(d.commission_per_stop) : <span style={{ color: '#bbb', fontSize: 12 }}>—</span>}
                      </td>
                      <td className="del-date-cell">{fmtDate(d.delivered_at)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="accounting-totals">
                    <td colSpan={5}><strong>{t('admin.accounting.totalDeliveries', {count: deliveryTotals.count})}</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{fmt(deliveryTotals.cost)}</strong></td>
                    <td style={{ textAlign: 'right', color: '#888' }}><strong>{fmt(deliveryTotals.deposit)}</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{fmt(deliveryTotals.to_collect)}</strong></td>
                    <td style={{ textAlign: 'right', color: '#2e7d32' }}><strong>{fmt(deliveryTotals.collected)}</strong></td>
                    <td></td>
                    <td style={{ textAlign: 'right' }}><strong>{fmt(deliveryTotals.commission)}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
      {confirmModal && (
        <div className="modal-backdrop" onClick={() => setConfirmModal(null)}>
          <div className="modal" style={{ maxWidth: 440, overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('admin.accounting.confirmModal.title')}</h3>
              <button className="icon-btn" onClick={() => setConfirmModal(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  {confirmModal.name || `Ruta #${confirmModal.id}`}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#555' }}>{t('admin.accounting.confirmModal.totalCollected')}</span>
                  <strong style={{ color: '#2e7d32' }}>{fmt(confirmModal.route_total_collected)}</strong>
                </div>
                {confirmModal.admin_amount_received > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
                      <span style={{ color: '#555' }}>{t('admin.accounting.confirmModal.alreadyConfirmed')}</span>
                      <strong style={{ color: '#1565c0' }}>{fmt(confirmModal.admin_amount_received)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
                      <span style={{ color: '#555' }}>{t('admin.accounting.confirmModal.stillPending')}</span>
                      <strong style={{ color: '#e65100' }}>{fmt(confirmModal.admin_remaining)}</strong>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 8 }}>{t('admin.accounting.confirmModal.howReceived')}</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setConfirmType('full')}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, border: '2px solid',
                      borderColor: confirmType === 'full' ? '#2e7d32' : '#ddd',
                      background: confirmType === 'full' ? '#e8f5e9' : '#fff',
                      color: confirmType === 'full' ? '#2e7d32' : '#555',
                      fontWeight: 700, cursor: 'pointer', fontSize: 13
                    }}
                  >
                    ✓ {t('admin.accounting.confirmModal.fullAmount')}
                    {confirmModal.admin_amount_received > 0
                      ? <div style={{ fontSize: 11, fontWeight: 400 }}>{fmt(confirmModal.admin_remaining)}</div>
                      : <div style={{ fontSize: 11, fontWeight: 400 }}>{fmt(confirmModal.route_total_collected)}</div>
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmType('partial')}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, border: '2px solid',
                      borderColor: confirmType === 'partial' ? '#1565c0' : '#ddd',
                      background: confirmType === 'partial' ? '#e3f2fd' : '#fff',
                      color: confirmType === 'partial' ? '#1565c0' : '#555',
                      fontWeight: 700, cursor: 'pointer', fontSize: 13
                    }}
                  >
                    {t('admin.accounting.confirmModal.partialAmount')}
                    <div style={{ fontSize: 11, fontWeight: 400 }}>{t('admin.accounting.confirmModal.amountReceived')}</div>
                  </button>
                </div>
              </div>

              {confirmType === 'partial' && (
                <div>
                  <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>
                    {t('admin.accounting.confirmModal.amountReceived')}
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Ej: 50.00"
                    value={confirmAmount}
                    onChange={e => setConfirmAmount(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                    autoFocus
                  />
                  {confirmAmount && Number(confirmAmount) > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#888' }}>
                      {t('admin.accounting.confirmModal.stillPending')}: <strong style={{ color: '#e65100' }}>
                        {fmt(Math.max(0, confirmModal.admin_remaining - Number(confirmAmount)))}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 8 }}>{t('admin.accounting.confirmModal.paymentMethod')}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['cash', 'card', 'transfer', 'check', 'zelle'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setConfirmMethod(m)}
                      className={`payment-method-tag ${m}`}
                      style={{
                        cursor: 'pointer', border: '2px solid',
                        borderColor: confirmMethod === m ? '#1565c0' : 'transparent',
                        opacity: confirmMethod === m ? 1 : 0.6,
                        transform: confirmMethod === m ? 'scale(1.05)' : 'scale(1)'
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmModal(null)} disabled={confirmLoading}>
                {t('common.cancel')}
              </button>
              <button className="btn-primary" onClick={handleAdminConfirm} disabled={confirmLoading}>
                {confirmLoading ? t('admin.accounting.confirmModal.saving') : t('admin.accounting.confirmModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingPhoto && (
        <div className="photo-viewer-overlay" onClick={() => setViewingPhoto(null)}>
          <div className="photo-viewer-container" onClick={e => e.stopPropagation()}>
            <button className="photo-viewer-close" onClick={() => setViewingPhoto(null)}>
              <span className="material-icons">close</span>
            </button>
            <img src={viewingPhoto} alt="Comprobante" className="photo-viewer-img" />
          </div>
        </div>
      )}
    </div>
  )
}
