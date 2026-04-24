import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'
import './AdminPages.css'

const fmt = (val) => val != null ? `$${Number(val).toFixed(2)}` : '-'

const fmtDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AccountingPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('summary')

  const [report, setReport] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedDriver, setExpandedDriver] = useState(null)

  const [deliveries, setDeliveries] = useState([])
  const [loadingDeliveries, setLoadingDeliveries] = useState(false)
  const [delDriver, setDelDriver] = useState('')
  const [delDateFrom, setDelDateFrom] = useState('')
  const [delDateTo, setDelDateTo] = useState('')
  const [delSearch, setDelSearch] = useState('')
  const [delSearchInput, setDelSearchInput] = useState('')
  const [availableMonths, setAvailableMonths] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [archivingMonth, setArchivingMonth] = useState(false)

  const [routePayments, setRoutePayments] = useState([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [payDriver, setPayDriver] = useState('')
  const [payDateFrom, setPayDateFrom] = useState('')
  const [payDateTo, setPayDateTo] = useState('')
  const [payFilter, setPayFilter] = useState('all')

  const [confirmModal, setConfirmModal] = useState(null)
  const [confirmType, setConfirmType] = useState('full')
  const [confirmAmount, setConfirmAmount] = useState('')
  const [confirmMethod, setConfirmMethod] = useState('cash')
  const [confirmLoading, setConfirmLoading] = useState(false)

  useEffect(() => {
    fetchDrivers()
    fetchReport()
  }, [])

  useEffect(() => {
    if (activeTab === 'deliveries') fetchDeliveries()
    if (activeTab === 'payments') fetchRoutePayments()
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'summary') return
    const interval = setInterval(() => {
      fetchReport()
    }, 90000)
    return () => clearInterval(interval)
  }, [activeTab, selectedDriver, dateFrom, dateTo])

  const fetchDrivers = async () => {
    try {
      const res = await api.get('/api/admin/users', { params: { role: 'driver' } })
      setDrivers(res.data.users || [])
    } catch (e) {
      console.error('Error cargando choferes:', e)
    }
  }

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

  const handleArchiveMonth = async () => {
    const target = selectedMonth || currentMonthYear()
    if (!window.confirm(`¿Cerrar y exportar a Excel el mes ${target}? Las entregas quedarán marcadas como archivadas.`)) return
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
      const msg = e.response?.data ? await e.response.data.text() : 'Error al archivar mes'
      alert(JSON.parse(msg)?.error || msg)
    } finally {
      setArchivingMonth(false)
    }
  }

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

  const openConfirmModal = (route) => {
    setConfirmModal(route)
    setConfirmType('full')
    setConfirmAmount('')
    setConfirmMethod(route.payment_delivery_method || 'cash')
  }

  const handleAdminConfirm = async () => {
    if (!confirmModal) return
    if (confirmType === 'partial' && (!confirmAmount || isNaN(Number(confirmAmount)) || Number(confirmAmount) <= 0)) {
      alert('Ingresa un monto válido mayor a 0')
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
      alert(e.response?.data?.error || 'Error al confirmar pago')
    } finally {
      setConfirmLoading(false)
    }
  }

  const currentMonthYear = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  const monthLabel = (my) => {
    if (!my) return ''
    const [y, m] = my.split('-')
    const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    return `${names[parseInt(m) - 1]} ${y}`
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

  const summaryTotals = report.reduce((acc, row) => ({
    stops: acc.stops + row.stops_count,
    cost: acc.cost + row.total_order_cost,
    deposit: acc.deposit + row.total_deposit,
    collected: acc.collected + row.total_collected,
    commission: acc.commission + row.total_commission
  }), { stops: 0, cost: 0, deposit: 0, collected: 0, commission: 0 })

  const deliveryTotals = deliveries.reduce((acc, d) => ({
    count: acc.count + 1,
    cost: acc.cost + d.order_cost,
    deposit: acc.deposit + d.deposit_amount,
    to_collect: acc.to_collect + d.total_to_collect,
    collected: acc.collected + d.amount_collected,
    commission: acc.commission + d.commission_per_stop
  }), { count: 0, cost: 0, deposit: 0, to_collect: 0, collected: 0, commission: 0 })

  const exportSummaryCSV = () => {
    const headers = ['Chofer', 'Paradas', 'Costo Total', 'Deposito Total', 'Total Cobrado', 'Comision/Parada', 'Total Comision', 'Saldo']
    const rows = report.map(r => [
      r.driver_name, r.stops_count,
      r.total_order_cost.toFixed(2), r.total_deposit.toFixed(2),
      r.total_collected.toFixed(2), (r.commission_per_stop || 0).toFixed(2),
      r.total_commission.toFixed(2), r.balance.toFixed(2)
    ])
    downloadCSV([headers, ...rows], `cobranza_${today()}`)
  }

  const exportDeliveriesCSV = () => {
    const headers = ['#Orden', 'Cliente', 'Telefono', 'Direccion', 'Ciudad', 'Estado', 'Chofer', 'Costo', 'Deposito', 'A Cobrar', 'Cobrado', 'Metodo', 'Comision/Parada', 'Fecha Entrega']
    const rows = deliveries.map(d => [
      d.id, d.customer_name || '', d.customer_phone || '',
      d.address || '', d.city || '', d.state || '',
      d.driver_name || '', d.order_cost.toFixed(2),
      d.deposit_amount.toFixed(2), d.total_to_collect.toFixed(2),
      d.amount_collected.toFixed(2), d.payment_method || '',
      d.commission_per_stop.toFixed(2),
      d.delivered_at ? new Date(d.delivered_at).toLocaleDateString('es') : ''
    ])
    downloadCSV([headers, ...rows], `entregas_${today()}`)
  }

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
        <h1>Contabilidad</h1>
      </div>

      <div className="accounting-tabs">
        <button
          className={`accounting-tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          <span className="material-icons">people</span>
          Resumen por Chofer
        </button>
        <button
          className={`accounting-tab ${activeTab === 'deliveries' ? 'active' : ''}`}
          onClick={() => setActiveTab('deliveries')}
        >
          <span className="material-icons">local_shipping</span>
          Reporte de Entregas
        </button>
        <button
          className={`accounting-tab ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          <span className="material-icons">payments</span>
          Pagos a Empresa
        </button>
      </div>

      {activeTab === 'summary' && (
        <>
          <div className="content-card" style={{ marginBottom: 16 }}>
            <form className="accounting-filter-form" onSubmit={handleSummaryFilter}>
              <div className="accounting-filter-fields">
                <div className="field-group">
                  <label>Chofer</label>
                  <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}>
                    <option value="">Todos los choferes</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.username || d.email}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>Desde</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Hasta</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>
              <div className="accounting-filter-actions">
                <button type="submit" className="btn-primary" disabled={loading}>
                  <span className="material-icons">filter_list</span>
                  Filtrar
                </button>
                <button type="button" className="btn-secondary" onClick={exportSummaryCSV} disabled={report.length === 0}>
                  <span className="material-icons">download</span>
                  Exportar CSV
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
                <p>No hay entregas en el periodo seleccionado</p>
              </div>
            </div>
          ) : (
            <div className="content-card" style={{ overflowX: 'auto' }}>
              <table className="data-table accounting-table">
                <thead>
                  <tr>
                    <th>Chofer</th>
                    <th style={{ textAlign: 'center' }}>Paradas</th>
                    <th style={{ textAlign: 'right' }}>Costo Orden</th>
                    <th style={{ textAlign: 'right' }}>Depósito</th>
                    <th style={{ textAlign: 'right' }}>Cobrado</th>
                    <th style={{ textAlign: 'right' }}>Com./Parada</th>
                    <th style={{ textAlign: 'right' }}>Total Comisión</th>
                    <th style={{ textAlign: 'right' }}>Saldo Chofer</th>
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
                                    <th>Cliente</th>
                                    <th style={{ textAlign: 'right' }}>Costo</th>
                                    <th style={{ textAlign: 'right' }}>Depósito</th>
                                    <th style={{ textAlign: 'right' }}>A Cobrar</th>
                                    <th style={{ textAlign: 'right' }}>Cobrado</th>
                                    <th>Método</th>
                                    <th>Fecha</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.orders.map(o => (
                                    <tr key={o.id}>
                                      <td>{o.customer_name || 'Sin nombre'}</td>
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
                  <label>Chofer</label>
                  <select value={payDriver} onChange={e => setPayDriver(e.target.value)}>
                    <option value="">Todos los choferes</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.username || d.email}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>Desde</label>
                  <input type="date" value={payDateFrom} onChange={e => setPayDateFrom(e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Hasta</label>
                  <input type="date" value={payDateTo} onChange={e => setPayDateTo(e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Estado</label>
                  <select value={payFilter} onChange={e => setPayFilter(e.target.value)}>
                    <option value="all">Todos</option>
                    <option value="pending">Sin entregar</option>
                    <option value="to_confirm">Por confirmar</option>
                    <option value="partial">Parciales</option>
                    <option value="confirmed">Confirmados</option>
                  </select>
                </div>
              </div>
              <div className="accounting-filter-actions">
                <button type="submit" className="btn-primary" disabled={loadingPayments}>
                  <span className="material-icons">filter_list</span>
                  Filtrar
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
                  Sin entregar
                </span>
              )
              if (r.admin_confirmed) return (
                <span style={{ background: '#e8f5e9', color: '#2e7d32', fontWeight: 700, padding: '3px 10px', borderRadius: 12, fontSize: 13 }}>
                  ✓ Confirmado
                </span>
              )
              if (r.admin_amount_received > 0) return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ background: '#e3f2fd', color: '#1565c0', fontWeight: 700, padding: '3px 10px', borderRadius: 12, fontSize: 13 }}>
                    Parcial: {fmt(r.admin_amount_received)}
                  </span>
                  <span style={{ fontSize: 11, color: '#e65100' }}>Debe: {fmt(r.admin_remaining)}</span>
                </div>
              )
              return (
                <span style={{ background: '#ede7f6', color: '#4527a0', fontWeight: 700, padding: '3px 10px', borderRadius: 12, fontSize: 13 }}>
                  Por confirmar
                </span>
              )
            }
            return filtered.length === 0 ? (
              <div className="content-card">
                <div className="empty-state">
                  <span className="material-icons">payments</span>
                  <p>No hay rutas completadas que coincidan con los filtros</p>
                </div>
              </div>
            ) : (
              <div className="content-card" style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ruta</th>
                      <th>Chofer</th>
                      <th style={{ textAlign: 'right' }}>Total Cobrado</th>
                      <th style={{ textAlign: 'right' }}>Comisión</th>
                      <th>Estado del pago</th>
                      <th>Método chofer</th>
                      <th>Fecha Finalización</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id}>
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
                              Bruto: {fmt(r.route_gross_collected)}
                            </div>
                          )}
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
                              {r.admin_amount_received > 0 ? 'Confirmar saldo' : 'Confirmar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="accounting-totals">
                      <td colSpan={2}><strong>TOTAL ({filtered.length} rutas)</strong></td>
                      <td style={{ textAlign: 'right', color: '#2e7d32' }}>
                        <strong>{fmt(filtered.reduce((s, r) => s + Number(r.route_total_collected || 0), 0))}</strong>
                      </td>
                      <td style={{ textAlign: 'right', color: '#ef6c00' }}>
                        <strong>{fmt(filtered.reduce((s, r) => s + Number(r.route_total_commission || 0), 0))}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: '#888' }}>
                          {filtered.filter(r => !r.admin_confirmed).length} por confirmar&nbsp;·&nbsp;
                          {filtered.filter(r => r.admin_confirmed).length} confirmada(s)
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
                    placeholder="Buscar por cliente, teléfono o dirección..."
                    value={delSearchInput}
                    onChange={e => setDelSearchInput(e.target.value)}
                  />
                </div>
              </div>
              <div className="accounting-filter-fields del-filter-grid">
                <div className="field-group">
                  <label>Mes</label>
                  <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setDelDateFrom(''); setDelDateTo('') }}>
                    <option value="">Todos los meses</option>
                    {availableMonths.map(m => (
                      <option key={m} value={m}>{monthLabel(m)}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>Chofer</label>
                  <select value={delDriver} onChange={e => setDelDriver(e.target.value)}>
                    <option value="">Todos los choferes</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.username || d.email}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>Desde</label>
                  <input type="date" value={delDateFrom} disabled={!!selectedMonth} onChange={e => setDelDateFrom(e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Hasta</label>
                  <input type="date" value={delDateTo} disabled={!!selectedMonth} onChange={e => setDelDateTo(e.target.value)} />
                </div>
              </div>
              <div className="accounting-filter-actions">
                <button type="submit" className="btn-primary" disabled={loadingDeliveries}>
                  <span className="material-icons">filter_list</span>
                  Filtrar
                </button>
                <button type="button" className="btn-secondary" onClick={exportDeliveriesCSV} disabled={deliveries.length === 0}>
                  <span className="material-icons">download</span>
                  Exportar CSV
                </button>
                <button
                  type="button"
                  className="btn-archive-month"
                  onClick={handleArchiveMonth}
                  disabled={archivingMonth}
                  title={`Cerrar mes ${monthLabel(selectedMonth || currentMonthYear())} y exportar Excel`}
                >
                  <span className="material-icons">{archivingMonth ? 'hourglass_empty' : 'table_view'}</span>
                  {archivingMonth ? 'Exportando...' : `Cerrar ${monthLabel(selectedMonth || currentMonthYear())}`}
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
                <p>No hay entregas que coincidan con los filtros</p>
              </div>
            </div>
          ) : (
            <div className="content-card" style={{ overflowX: 'auto' }}>
              <table className="data-table deliveries-report-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th>Dirección</th>
                    <th>Chofer</th>
                    <th style={{ textAlign: 'right' }}>Costo</th>
                    <th style={{ textAlign: 'right' }}>Depósito</th>
                    <th style={{ textAlign: 'right' }}>A Cobrar</th>
                    <th style={{ textAlign: 'right' }}>Cobrado</th>
                    <th>Método</th>
                    <th style={{ textAlign: 'right' }}>Comisión</th>
                    <th>Fecha Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map(d => (
                    <tr key={d.id} className="delivery-report-row">
                      <td className="del-id-cell">#{d.id}</td>
                      <td className="del-customer-cell">
                        <span className="del-customer-name">{d.customer_name || '—'}</span>
                        {d.archived && <span className="archived-badge">archivado</span>}
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
                    <td colSpan={5}><strong>TOTALES ({deliveryTotals.count} entregas)</strong></td>
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
              <h3>Confirmar recepción de pago</h3>
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
                  <span style={{ color: '#555' }}>Total cobrado por chofer:</span>
                  <strong style={{ color: '#2e7d32' }}>{fmt(confirmModal.route_total_collected)}</strong>
                </div>
                {confirmModal.admin_amount_received > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
                      <span style={{ color: '#555' }}>Ya confirmado:</span>
                      <strong style={{ color: '#1565c0' }}>{fmt(confirmModal.admin_amount_received)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
                      <span style={{ color: '#555' }}>Aún pendiente:</span>
                      <strong style={{ color: '#e65100' }}>{fmt(confirmModal.admin_remaining)}</strong>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 8 }}>¿Cómo recibiste el pago?</label>
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
                    ✓ Pago total
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
                    Pago parcial
                    <div style={{ fontSize: 11, fontWeight: 400 }}>Ingresa el monto</div>
                  </button>
                </div>
              </div>

              {confirmType === 'partial' && (
                <div>
                  <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>
                    Monto recibido en este pago
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
                      Quedaría pendiente: <strong style={{ color: '#e65100' }}>
                        {fmt(Math.max(0, confirmModal.admin_remaining - Number(confirmAmount)))}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 8 }}>Método de pago recibido</label>
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
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleAdminConfirm} disabled={confirmLoading}>
                {confirmLoading ? 'Guardando...' : 'Confirmar recepción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
