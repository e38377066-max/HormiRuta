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

  useEffect(() => {
    fetchDrivers()
    fetchReport()
  }, [])

  useEffect(() => {
    if (activeTab === 'deliveries') fetchDeliveries()
  }, [activeTab])

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
      if (delDateFrom) params.date_from = delDateFrom
      if (delDateTo) params.date_to = delDateTo
      if (delSearch) params.search = delSearch
      const res = await api.get('/api/dispatch/deliveries-report', { params })
      setDeliveries(res.data.deliveries || [])
    } catch (e) {
      console.error('Error cargando entregas:', e)
    } finally {
      setLoadingDeliveries(false)
    }
  }, [delDriver, delDateFrom, delDateTo, delSearch])

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
  }, [delDriver, delDateFrom, delDateTo, delSearch])

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
                  <input type="date" value={delDateFrom} onChange={e => setDelDateFrom(e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Hasta</label>
                  <input type="date" value={delDateTo} onChange={e => setDelDateTo(e.target.value)} />
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
    </div>
  )
}
