import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'
import './DriverAccountingPage.css'

const fmt = (val) => {
  if (val == null) return '-'
  const n = Number(val)
  return `$${n.toFixed(2)}`
}

const monthLabel = (my) => {
  if (!my) return 'Sin fecha'
  const [y, m] = my.split('-')
  const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
    'Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${names[parseInt(m) - 1]} ${y}`
}

const fmtDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short' })
}

const fmtDateTime = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const pmtConfig = {
  cash:     { label: 'Efectivo',      color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  card:     { label: 'Tarjeta',       color: '#5b8def', bg: 'rgba(91,141,239,0.12)'  },
  transfer: { label: 'Transferencia', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  check:    { label: 'Cheque',        color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  zelle:    { label: 'Zelle',         color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
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

  useEffect(() => { fetchData() }, [fetchData])

  const getPmt = (method) => pmtConfig[method] || { label: method, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }

  return (
    <div className="dac-root">
      <div className="dac-header">
        <button className="dac-back-btn" onClick={() => navigate('/planner')}>
          <span className="material-icons">arrow_back_ios_new</span>
        </button>
        <span className="dac-header-title">Mi Contabilidad</span>
        <button className="dac-refresh-btn" onClick={fetchData}>
          <span className="material-icons">refresh</span>
        </button>
      </div>

      <div className="dac-body">
        <div className="dac-hero">
          <div className="dac-hero-label">Total a Entregar</div>
          <div className="dac-hero-amount">{fmt(totals.to_deliver)}</div>
          <div className="dac-hero-sub">{totals.stops} entrega{totals.stops !== 1 ? 's' : ''} registradas</div>
        </div>

        <div className="dac-stats-row">
          <div className="dac-stat dac-stat-green">
            <span className="material-icons">payments</span>
            <div className="dac-stat-val">{fmt(totals.collected)}</div>
            <div className="dac-stat-lbl">Cobrado</div>
          </div>
          <div className="dac-stat-divider" />
          <div className="dac-stat dac-stat-blue">
            <span className="material-icons">star_rate</span>
            <div className="dac-stat-val">{fmt(totals.commission)}</div>
            <div className="dac-stat-lbl">Mi Comisión</div>
          </div>
          <div className="dac-stat-divider" />
          <div className="dac-stat dac-stat-gray">
            <span className="material-icons">local_shipping</span>
            <div className="dac-stat-val">{totals.stops}</div>
            <div className="dac-stat-lbl">Entregas</div>
          </div>
        </div>

        {availableMonths.length > 0 && (
          <div className="dac-filter">
            <span className="material-icons dac-filter-icon">filter_list</span>
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
            <span className="material-icons dac-select-arrow">expand_more</span>
          </div>
        )}

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
            Historial
          </button>
        </div>

        {loading ? (
          <div className="dac-loading">
            <div className="dac-spinner" />
            <span>Cargando...</span>
          </div>
        ) : (
          <div className="dac-list">
            {activeTab === 'months' && (
              months.length === 0
                ? <EmptyState />
                : months.map(m => (
                  <MonthCard
                    key={m.month_year}
                    m={m}
                    expanded={expandedMonth === m.month_year}
                    onToggle={() => setExpandedMonth(expandedMonth === m.month_year ? null : m.month_year)}
                    getPmt={getPmt}
                  />
                ))
            )}
            {activeTab === 'deliveries' && (
              deliveries.length === 0
                ? <EmptyState />
                : deliveries.map(d => (
                  <DeliveryCard key={d.id} d={d} getPmt={getPmt} />
                ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="dac-empty">
      <span className="material-icons">inbox</span>
      <p>No hay entregas en este periodo</p>
    </div>
  )
}

function MonthCard({ m, expanded, onToggle, getPmt }) {
  return (
    <div className="dac-month-card">
      <button className="dac-month-header" onClick={onToggle}>
        <div className="dac-month-info">
          <div className="dac-month-name">{monthLabel(m.month_year)}</div>
          <div className="dac-month-count">
            <span className="material-icons">local_shipping</span>
            {m.stops_count} entrega{m.stops_count !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="dac-month-amounts">
          <div className="dac-month-comm">+{fmt(m.total_commission)}</div>
          <div className="dac-month-deliver">{fmt(m.to_deliver)} a entregar</div>
        </div>
        <span className="material-icons dac-chevron">{expanded ? 'expand_less' : 'expand_more'}</span>
      </button>

      {expanded && (
        <div className="dac-month-body">
          <div className="dac-month-totals">
            <div className="dac-tot-row">
              <span>Total cobrado</span>
              <strong className="c-green">{fmt(m.total_collected)}</strong>
            </div>
            <div className="dac-tot-row">
              <span>Mi comisión</span>
              <strong className="c-blue">{fmt(m.total_commission)}</strong>
            </div>
            <div className="dac-tot-row dac-tot-highlight">
              <span>A entregar a oficina</span>
              <strong className="c-orange">{fmt(m.to_deliver)}</strong>
            </div>
          </div>

          {m.deliveries && m.deliveries.length > 0 && (
            <div className="dac-mini-list">
              {m.deliveries.map(d => (
                <div key={d.id} className="dac-mini-item">
                  <div className="dac-mini-row">
                    <span className="dac-mini-name">{d.customer_name || 'Sin nombre'}</span>
                    <span className="dac-mini-date">{fmtDate(d.delivered_at)}</span>
                  </div>
                  {d.address && (
                    <div className="dac-mini-addr">
                      <span className="material-icons">place</span>{d.address}
                    </div>
                  )}
                  <div className="dac-mini-amounts">
                    <span className="dac-mini-chip c-green">+{fmt(d.amount_collected)}</span>
                    <span className="dac-mini-chip c-blue">comisión {fmt(d.commission_per_stop)}</span>
                    {d.payment_method && (
                      <span className="dac-mini-chip" style={{ color: getPmt(d.payment_method).color }}>
                        {getPmt(d.payment_method).label}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DeliveryCard({ d, getPmt }) {
  const pmt = d.payment_method ? getPmt(d.payment_method) : null
  const toDeliver = (Number(d.amount_collected) - Number(d.commission_per_stop)).toFixed(2)

  return (
    <div className="dac-del-card">
      <div className="dac-del-top">
        <div className="dac-del-avatar">
          {(d.customer_name || '?')[0].toUpperCase()}
        </div>
        <div className="dac-del-info">
          <div className="dac-del-name">{d.customer_name || 'Sin nombre'}</div>
          {d.customer_phone && <div className="dac-del-phone">{d.customer_phone}</div>}
        </div>
        <div className="dac-del-date">{fmtDateTime(d.delivered_at)}</div>
      </div>

      {d.address && (
        <div className="dac-del-addr">
          <span className="material-icons">place</span>
          <span>{d.address}</span>
        </div>
      )}

      <div className="dac-del-grid">
        <div className="dac-del-cell">
          <div className="dac-del-cell-lbl">A Cobrar</div>
          <div className="dac-del-cell-val">{fmt(d.total_to_collect)}</div>
        </div>
        <div className="dac-del-cell">
          <div className="dac-del-cell-lbl">Cobrado</div>
          <div className="dac-del-cell-val c-green">{fmt(d.amount_collected)}</div>
        </div>
        <div className="dac-del-cell">
          <div className="dac-del-cell-lbl">Comisión</div>
          <div className="dac-del-cell-val c-blue">{fmt(d.commission_per_stop)}</div>
        </div>
        <div className="dac-del-cell">
          <div className="dac-del-cell-lbl">A Entregar</div>
          <div className="dac-del-cell-val c-orange">${toDeliver}</div>
        </div>
      </div>

      {pmt && (
        <div className="dac-del-badges">
          <span className="dac-badge" style={{ color: pmt.color, background: pmt.bg }}>
            {pmt.label}
          </span>
          {d.archived && <span className="dac-badge dac-badge-gray">Archivado</span>}
        </div>
      )}
    </div>
  )
}
