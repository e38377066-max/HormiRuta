import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'
import './AdminPages.css'

const fmt = (val) => val != null ? `$${Number(val).toFixed(2)}` : '-'

export default function AccountingPage() {
  const navigate = useNavigate()
  const [report, setReport] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedDriver, setExpandedDriver] = useState(null)

  useEffect(() => {
    fetchDrivers()
    fetchReport()
  }, [])

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

  const handleFilter = (e) => {
    e.preventDefault()
    fetchReport()
  }

  const totals = report.reduce((acc, row) => ({
    stops: acc.stops + row.stops_count,
    cost: acc.cost + row.total_order_cost,
    deposit: acc.deposit + row.total_deposit,
    collected: acc.collected + row.total_collected,
    commission: acc.commission + row.total_commission
  }), { stops: 0, cost: 0, deposit: 0, collected: 0, commission: 0 })

  const exportCSV = () => {
    const headers = ['Chofer', 'Paradas', 'Costo Total', 'Deposito Total', 'Total Cobrado', 'Comision/Parada', 'Total Comision', 'Saldo']
    const rows = report.map(r => [
      r.driver_name,
      r.stops_count,
      r.total_order_cost.toFixed(2),
      r.total_deposit.toFixed(2),
      r.total_collected.toFixed(2),
      (r.commission_per_stop || 0).toFixed(2),
      r.total_commission.toFixed(2),
      r.balance.toFixed(2)
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const now = new Date()
    a.download = `cobranza_${now.toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1>Contabilidad de Choferes</h1>
      </div>

      <div className="content-card" style={{ marginBottom: 16 }}>
        <form className="accounting-filter-form" onSubmit={handleFilter}>
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
            <button type="button" className="btn-secondary" onClick={exportCSV} disabled={report.length === 0}>
              <span className="material-icons">download</span>
              Exportar CSV
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      ) : report.length === 0 ? (
        <div className="content-card">
          <div className="empty-state">
            <span className="material-icons">receipt_long</span>
            <p>No hay entregas en el periodo seleccionado</p>
          </div>
        </div>
      ) : (
        <>
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
                  <td style={{ textAlign: 'center' }}><strong>{totals.stops}</strong></td>
                  <td style={{ textAlign: 'right' }}><strong>{fmt(totals.cost)}</strong></td>
                  <td style={{ textAlign: 'right', color: '#888' }}><strong>{fmt(totals.deposit)}</strong></td>
                  <td style={{ textAlign: 'right', color: '#2e7d32' }}><strong>{fmt(totals.collected)}</strong></td>
                  <td></td>
                  <td style={{ textAlign: 'right' }}><strong>{fmt(totals.commission)}</strong></td>
                  <td style={{ textAlign: 'right', color: '#1565c0' }}><strong>{fmt(totals.collected - totals.commission)}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
