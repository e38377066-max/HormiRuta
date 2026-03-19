import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'
import './DriverAccountingPage.css'

const fmt = (val) => val != null ? `$${Number(val).toFixed(2)}` : '-'

const monthLabel = (my) => {
  if (!my) return 'Sin fecha'
  const [y, m] = my.split('-')
  const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${names[parseInt(m) - 1]} ${y}`
}

const fmtDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function DriverAccountingPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('months')
  const [months, setMonths] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [totals, setTotals] = useState({ stops: 0, collected: 0, commission: 0, to_deliver: 0 })
  const [availableMonths, setAvailableMonths] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedMonth, setExpandedMonth] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (selectedMonth) params.month_year = selectedMonth
      const res = await api.get('/api/dispatch/my-accounting', { params })
      setMonths(res.data.months || [])
      setDeliveries(res.data.deliveries || [])
      setTotals(res.data.totals || { stops: 0, collected: 0, commission: 0, to_deliver: 0 })
      setAvailableMonths(res.data.available_months || [])
    } catch (e) {
      console.error('Error cargando contabilidad:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const pmtLabel = (method) => {
    if (!method) return null
    const map = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', check: 'Cheque', zelle: 'Zelle' }
    return map[method] || method
  }

  const displayedDeliveries = activeTab === 'deliveries' ? deliveries : []
  const displayedMonths = activeTab === 'months' ? months : []

  return (
    <div className="dac-container">
      <div className="dac-header">
        <button className="dac-back-btn" onClick={() => navigate('/planner')}>
          <span className="material-icons">arrow_back</span>
        </button>
        <div className="dac-title">
          <span className="material-icons dac-title-icon">account_balance_wallet</span>
          <h1>Mi Contabilidad</h1>
        </div>
      </div>

      <div className="dac-summary-cards">
        <div className="dac-card dac-card-green">
          <span className="material-icons">payments</span>
          <div>
            <div className="dac-card-label">Total Cobrado</div>
            <div className="dac-card-value">{fmt(totals.collected)}</div>
          </div>
        </div>
        <div className="dac-card dac-card-blue">
          <span className="material-icons">star</span>
          <div>
            <div className="dac-card-label">Mi Comisión</div>
            <div className="dac-card-value">{fmt(totals.commission)}</div>
          </div>
        </div>
        <div className="dac-card dac-card-orange">
          <span className="material-icons">send</span>
          <div>
            <div className="dac-card-label">A Entregar</div>
            <div className="dac-card-value">{fmt(totals.to_deliver)}</div>
          </div>
        </div>
        <div className="dac-card dac-card-gray">
          <span className="material-icons">local_shipping</span>
          <div>
            <div className="dac-card-label">Entregas</div>
            <div className="dac-card-value">{totals.stops}</div>
          </div>
        </div>
      </div>

      <div className="dac-filter-row">
        <select
          className="dac-month-select"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
        >
          <option value="">Todos los meses</option>
          {availableMonths.map(m => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>

      <div className="dac-tabs">
        <button
          className={`dac-tab ${activeTab === 'months' ? 'active' : ''}`}
          onClick={() => setActiveTab('months')}
        >
          <span className="material-icons">calendar_month</span>
          Por Mes
        </button>
        <button
          className={`dac-tab ${activeTab === 'deliveries' ? 'active' : ''}`}
          onClick={() => setActiveTab('deliveries')}
        >
          <span className="material-icons">receipt_long</span>
          Todas las Entregas
        </button>
      </div>

      {loading ? (
        <div className="dac-loading">
          <div className="dac-spinner"></div>
          <span>Cargando...</span>
        </div>
      ) : (
        <>
          {activeTab === 'months' && (
            <div className="dac-months-list">
              {displayedMonths.length === 0 ? (
                <div className="dac-empty">
                  <span className="material-icons">inbox</span>
                  <p>No hay entregas en este periodo</p>
                </div>
              ) : (
                displayedMonths.map(m => (
                  <div key={m.month_year} className="dac-month-card">
                    <div
                      className="dac-month-header"
                      onClick={() => setExpandedMonth(expandedMonth === m.month_year ? null : m.month_year)}
                    >
                      <div className="dac-month-left">
                        <div className="dac-month-name">{monthLabel(m.month_year)}</div>
                        <div className="dac-month-count">{m.stops_count} entrega{m.stops_count !== 1 ? 's' : ''}</div>
                      </div>
                      <div className="dac-month-right">
                        <div className="dac-month-amounts">
                          <span className="dac-amount-green">+{fmt(m.total_commission)}</span>
                          <span className="dac-amount-orange">→{fmt(m.to_deliver)}</span>
                        </div>
                        <span className="material-icons dac-expand-icon">
                          {expandedMonth === m.month_year ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </div>

                    {expandedMonth === m.month_year && (
                      <div className="dac-month-detail">
                        <div className="dac-month-totals">
                          <div className="dac-total-row">
                            <span>Cobrado</span>
                            <strong className="dac-color-green">{fmt(m.total_collected)}</strong>
                          </div>
                          <div className="dac-total-row">
                            <span>Mi comisión</span>
                            <strong className="dac-color-blue">{fmt(m.total_commission)}</strong>
                          </div>
                          <div className="dac-total-row dac-total-row-highlight">
                            <span>A entregar a oficina</span>
                            <strong className="dac-color-orange">{fmt(m.to_deliver)}</strong>
                          </div>
                        </div>
                        <div className="dac-deliveries-mini">
                          {m.deliveries.map(d => (
                            <div key={d.id} className="dac-delivery-mini-item">
                              <div className="dac-del-mini-top">
                                <span className="dac-del-name">{d.customer_name || 'Sin nombre'}</span>
                                <span className="dac-del-date">{fmtDate(d.delivered_at)}</span>
                              </div>
                              <div className="dac-del-mini-bottom">
                                <span className="dac-del-address">{d.address || '-'}</span>
                              </div>
                              <div className="dac-del-mini-amounts">
                                <span>Cobrado: <strong className="dac-color-green">{fmt(d.amount_collected)}</strong></span>
                                <span>Comisión: <strong className="dac-color-blue">{fmt(d.commission_per_stop)}</strong></span>
                                {d.payment_method && (
                                  <span className={`dac-pmt-badge dac-pmt-${d.payment_method}`}>
                                    {pmtLabel(d.payment_method)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'deliveries' && (
            <div className="dac-deliveries-list">
              {deliveries.length === 0 ? (
                <div className="dac-empty">
                  <span className="material-icons">inbox</span>
                  <p>No hay entregas en este periodo</p>
                </div>
              ) : (
                deliveries.map(d => (
                  <div key={d.id} className="dac-delivery-card">
                    <div className="dac-del-header">
                      <div className="dac-del-customer">
                        <div className="dac-del-avatar">
                          {(d.customer_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="dac-del-name-full">{d.customer_name || 'Sin nombre'}</div>
                          {d.customer_phone && <div className="dac-del-phone">{d.customer_phone}</div>}
                        </div>
                      </div>
                      <div className="dac-del-date-full">{fmtDate(d.delivered_at)}</div>
                    </div>
                    {d.address && (
                      <div className="dac-del-address-full">
                        <span className="material-icons">place</span>
                        {d.address}
                      </div>
                    )}
                    <div className="dac-del-amounts-grid">
                      <div className="dac-del-amount-item">
                        <span className="dac-del-amount-label">A Cobrar</span>
                        <span className="dac-del-amount-val">{fmt(d.total_to_collect)}</span>
                      </div>
                      <div className="dac-del-amount-item">
                        <span className="dac-del-amount-label">Cobrado</span>
                        <span className="dac-del-amount-val dac-color-green">{fmt(d.amount_collected)}</span>
                      </div>
                      <div className="dac-del-amount-item">
                        <span className="dac-del-amount-label">Mi Comisión</span>
                        <span className="dac-del-amount-val dac-color-blue">{fmt(d.commission_per_stop)}</span>
                      </div>
                      <div className="dac-del-amount-item">
                        <span className="dac-del-amount-label">A Entregar</span>
                        <span className="dac-del-amount-val dac-color-orange">{fmt(d.amount_collected - d.commission_per_stop)}</span>
                      </div>
                    </div>
                    {d.payment_method && (
                      <div className="dac-del-footer">
                        <span className={`dac-pmt-badge dac-pmt-${d.payment_method}`}>
                          {pmtLabel(d.payment_method)}
                        </span>
                        {d.archived && <span className="dac-archived-badge">Archivado</span>}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
