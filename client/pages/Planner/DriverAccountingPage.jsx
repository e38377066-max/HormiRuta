/**
 * @fileoverview Componente de la página de contabilidad del conductor.
 * Proporciona una vista detallada de los ingresos, comisiones y entregas del conductor,
 * permitiendo filtrar por meses y ver el historial de rutas completadas.
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api'
import './DriverAccountingPage.css'

/**
 * Formatea un valor numérico como moneda ($0.00).
 * @param {number|string|null} val - El valor a formatear.
 * @returns {string} El valor formateado o '-' si es nulo.
 */
const fmt = (val) => {
  if (val == null) return '-'
  const n = Number(val)
  return `$${n.toFixed(2)}`
}

/**
 * Nombres de los meses en inglés y español.
 */
const monthNames = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  es: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
}

/**
 * Obtiene la etiqueta legible de un mes y año (ej. "Enero 2024").
 * @param {string} my - El mes y año en formato 'YYYY-MM'.
 * @param {string} [lang='en'] - El idioma para la etiqueta.
 * @returns {string} La etiqueta formateada.
 */
const monthLabel = (my, lang = 'en') => {
  if (!my) return '-'
  const [y, m] = my.split('-')
  const names = monthNames[lang] || monthNames.en
  return `${names[parseInt(m) - 1]} ${y}`
}

/**
 * Formatea una fecha para mostrar solo día y mes abreviado.
 * @param {string|Date} d - La fecha a formatear.
 * @returns {string} La fecha formateada.
 */
const fmtDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

/**
 * Formatea una fecha y hora.
 * @param {string|Date} d - La fecha y hora a formatear.
 * @returns {string} La fecha y hora formateada.
 */
const fmtDateTime = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/**
 * Componente principal de la página de contabilidad del conductor.
 * Gestiona el estado de las pestañas, datos contables y rutas completadas.
 * @returns {JSX.Element} El elemento JSX de la página.
 */
export default function DriverAccountingPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState('routes')
  const [months, setMonths] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [totals, setTotals] = useState({ stops: 0, collected: 0, commission: 0, to_deliver: 0 })
  const [availableMonths, setAvailableMonths] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedMonth, setExpandedMonth] = useState(null)
  const [completedRoutes, setCompletedRoutes] = useState([])
  const [loadingRoutes, setLoadingRoutes] = useState(false)

  /**
   * Configuración de métodos de pago con sus etiquetas, colores y fondos.
   */
  const pmtConfig = {
    cash:     { label: t('planner.cash'),     color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
    card:     { label: t('planner.card'),     color: '#5b8def', bg: 'rgba(91,141,239,0.12)'  },
    transfer: { label: t('planner.transfer'), color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    check:    { label: t('planner.check'),    color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    zelle:    { label: t('planner.zelle'),    color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  }

  /**
   * Carga los datos de contabilidad desde la API.
   */
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
      console.error('Error loading accounting:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  /**
   * Carga las rutas completadas del conductor.
   */
  const fetchCompletedRoutes = useCallback(async () => {
    setLoadingRoutes(true)
    try {
      const res = await api.get('/api/dispatch/my-completed-routes')
      setCompletedRoutes(res.data.routes || [])
    } catch (e) {
      console.error('Error loading routes:', e)
    } finally {
      setLoadingRoutes(false)
    }
  }, [])

  // Efectos para cargar datos al montar el componente o cambiar el mes seleccionado
  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchCompletedRoutes() }, [fetchCompletedRoutes])

  /**
   * Obtiene la configuración visual de un método de pago.
   * @param {string} method - El método de pago.
   * @returns {Object} Configuración de etiqueta y color.
   */
  const getPmt = (method) => pmtConfig[method] || { label: method, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
  const lang = i18n.language?.startsWith('es') ? 'es' : 'en'

  return (
    <div className="dac-root">
      <div className="dac-header">
        <button className="dac-back-btn" onClick={() => navigate('/planner')}>
          <span className="material-icons">arrow_back_ios_new</span>
        </button>
        <span className="dac-header-title">{t('accounting.title')}</span>
        <button className="dac-refresh-btn" onClick={fetchData}>
          <span className="material-icons">refresh</span>
        </button>
      </div>

      <div className="dac-body">
        <div className="dac-hero">
          <div className="dac-hero-label">{t('accounting.pendingCash')}</div>
          <div className="dac-hero-amount">{fmt(totals.to_deliver)}</div>
          <div className="dac-hero-sub">{totals.stops_pending || 0} {t('accounting.pendingDelivery')}</div>
          {Number(totals.electronic_collected) > 0 && (
            <div className="dac-hero-note">
              <span className="material-icons" style={{ fontSize: 14 }}>account_balance</span>
              {fmt(totals.electronic_collected)} {t('accounting.electronicAlreadySent')}
            </div>
          )}
        </div>

        <div className="dac-stats-row">
          <div className="dac-stat dac-stat-green">
            <span className="material-icons">payments</span>
            <div className="dac-stat-val">{fmt(totals.collected)}</div>
            <div className="dac-stat-lbl">{t('accounting.grossCollected')}</div>
          </div>
          <div className="dac-stat-divider" />
          <div className="dac-stat dac-stat-orange">
            <span className="material-icons">account_balance_wallet</span>
            <div className="dac-stat-val">{fmt((Number(totals.collected) || 0) - (Number(totals.commission) || 0))}</div>
            <div className="dac-stat-lbl">{t('accounting.netAmount')}</div>
          </div>
          <div className="dac-stat-divider" />
          <div className="dac-stat dac-stat-blue">
            <span className="material-icons">star_rate</span>
            <div className="dac-stat-val">{fmt(totals.commission)}</div>
            <div className="dac-stat-lbl">{t('accounting.myCommission')}</div>
          </div>
          <div className="dac-stat-divider" />
          <div className="dac-stat dac-stat-gray">
            <span className="material-icons">local_shipping</span>
            <div className="dac-stat-val">{totals.stops}</div>
            <div className="dac-stat-lbl">{t('accounting.deliveries')}</div>
          </div>
        </div>

        {activeTab !== 'routes' && availableMonths.length > 0 && (
          <div className="dac-filter">
            <span className="material-icons dac-filter-icon">filter_list</span>
            <select
              className="dac-month-select"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              <option value="">{t('accounting.allMonths')}</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{monthLabel(m, lang)}</option>
              ))}
            </select>
            <span className="material-icons dac-select-arrow">expand_more</span>
          </div>
        )}

        <div className="dac-tabs">
          <button
            className={`dac-tab ${activeTab === 'routes' ? 'active' : ''}`}
            onClick={() => setActiveTab('routes')}
          >
            <span className="material-icons">route</span>
            {t('accounting.tabs.myRoutes')}
          </button>
          <button
            className={`dac-tab ${activeTab === 'months' ? 'active' : ''}`}
            onClick={() => setActiveTab('months')}
          >
            <span className="material-icons">calendar_month</span>
            {t('accounting.tabs.byMonth')}
          </button>
          <button
            className={`dac-tab ${activeTab === 'deliveries' ? 'active' : ''}`}
            onClick={() => setActiveTab('deliveries')}
          >
            <span className="material-icons">receipt_long</span>
            {t('accounting.tabs.history')}
          </button>
        </div>

        {activeTab === 'routes' ? (
          loadingRoutes ? (
            <div className="dac-loading">
              <div className="dac-spinner" />
              <span>{t('common.loading')}</span>
            </div>
          ) : (
            <div className="dac-list">
              {completedRoutes.length === 0
                ? <EmptyState text={t('accounting.noCompletedRoutes')} />
                : completedRoutes.map(r => (
                  <CompletedRouteCard key={r.id} r={r} onRefresh={fetchCompletedRoutes} t={t} getPmt={getPmt} lang={lang} />
                ))
              }
            </div>
          )
        ) : loading ? (
          <div className="dac-loading">
            <div className="dac-spinner" />
            <span>{t('common.loading')}</span>
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
                    t={t}
                    lang={lang}
                  />
                ))
            )}
            {activeTab === 'deliveries' && (
              deliveries.length === 0
                ? <EmptyState />
                : deliveries.map(d => (
                  <DeliveryCard key={d.id} d={d} getPmt={getPmt} t={t} />
                ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Componente para mostrar un estado vacío cuando no hay datos.
 * @param {Object} props - Propiedades del componente.
 * @param {string} props.text - Texto opcional para mostrar.
 * @returns {JSX.Element} El elemento JSX.
 */
function EmptyState({ text }) {
  const { t } = useTranslation()
  return (
    <div className="dac-empty">
      <span className="material-icons">inbox</span>
      <p>{text || t('common.none')}</p>
    </div>
  )
}

/**
 * Tarjeta que muestra detalles de una ruta completada y permite marcar el pago como entregado.
 * @param {Object} props - Propiedades del componente.
 * @param {Object} props.r - Los datos de la ruta.
 * @param {Function} props.onRefresh - Función para refrescar los datos después de una acción.
 * @param {Function} props.t - Función de traducción.
 * @param {Function} props.getPmt - Función para obtener configuración de pago.
 * @param {string} props.lang - Idioma actual.
 * @returns {JSX.Element} El elemento JSX.
 */
function CompletedRouteCard({ r, onRefresh, t, getPmt, lang }) {
  const [delivering, setDelivering] = useState(false)
  const [method, setMethod] = useState('')
  const [showPayForm, setShowPayForm] = useState(false)
  const [showStops, setShowStops] = useState(false)

  /**
   * Maneja el envío del formulario para marcar el pago como entregado al administrador.
   */
  const handleDeliver = async () => {
    if (!method) return
    setDelivering(true)
    try {
      await api.put(`/api/dispatch/routes/${r.id}/deliver-payment`, { payment_method: method })
      setShowPayForm(false)
      setMethod('')
      if (onRefresh) onRefresh()
    } catch (e) {
      alert(e.response?.data?.error || t('common.error'))
    } finally {
      setDelivering(false)
    }
  }

  /**
   * Determina el estado del pago y su representación visual.
   * @returns {Object} Objeto con etiqueta, color, fondo e icono.
   */
  const paymentStatus = () => {
    if (r.admin_confirmed) return { label: t('accounting.adminConfirmed'), color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: 'verified' }
    if (r.payment_delivered) return { label: t('accounting.deliveredToAdmin'), color: '#5b8def', bg: 'rgba(91,141,239,0.12)', icon: 'check_circle' }
    return { label: t('accounting.pendingDeliveryStatus'), color: '#fb923c', bg: 'rgba(251,146,60,0.12)', icon: 'pending' }
  }

  const status = paymentStatus()

  return (
    <div className="dac-route-card">
      <div className="dac-route-top">
        <div className="dac-route-info">
          <div className="dac-route-name">{r.name || `Route #${r.id}`}</div>
          <div className="dac-route-meta">
            <span className="material-icons">local_shipping</span>
            {r.stops_count} {r.stops_count !== 1 ? t('planner.stops') : t('planner.stop')}
            {r.completed_at && (
              <span style={{ marginLeft: 8, color: '#888' }}>
                · {new Date(r.completed_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
              </span>
            )}
          </div>
        </div>
        <div className="dac-route-badge" style={{ color: status.color, background: status.bg }}>
          <span className="material-icons" style={{ fontSize: 14 }}>{status.icon}</span>
          {status.label}
        </div>
      </div>

      <div className="dac-del-grid">
        <div className="dac-del-cell">
          <div className="dac-del-cell-lbl">{t('accounting.cashCollected')}</div>
          <div className="dac-del-cell-val c-green">{fmt(r.cash_collected != null ? r.cash_collected : r.total_collected)}</div>
        </div>
        {Number(r.electronic_collected) > 0 && (
          <div className="dac-del-cell">
            <div className="dac-del-cell-lbl">Zelle/Transf.</div>
            <div className="dac-del-cell-val" style={{ color: '#a78bfa' }}>{fmt(r.electronic_collected)}</div>
          </div>
        )}
        <div className="dac-del-cell">
          <div className="dac-del-cell-lbl">{t('accounting.myCommission')}</div>
          <div className="dac-del-cell-val c-blue">{fmt(r.commission)}</div>
        </div>
        <div className="dac-del-cell">
          <div className="dac-del-cell-lbl">{t('accounting.toDeliver')}</div>
          <div className="dac-del-cell-val c-orange">{fmt(r.to_deliver)}</div>
        </div>
        {r.admin_amount_received > 0 && (
          <div className="dac-del-cell">
            <div className="dac-del-cell-lbl">{t('accounting.received')}</div>
            <div className="dac-del-cell-val" style={{ color: '#22c55e' }}>{fmt(r.admin_amount_received)}</div>
          </div>
        )}
      </div>
      {Number(r.electronic_collected) > 0 && (
        <div className="dac-elec-note">
          <span className="material-icons" style={{ fontSize: 14 }}>account_balance</span>
          {fmt(r.electronic_collected)} {t('accounting.directToCompany')}
        </div>
      )}

      {r.payment_delivered && r.payment_delivery_method && (
        <div className="dac-del-badges" style={{ marginTop: 8 }}>
          <span className="dac-badge" style={{ color: '#5b8def', background: 'rgba(91,141,239,0.12)' }}>
            {t('accounting.methodPrefix')} {r.payment_delivery_method}
          </span>
          {r.payment_delivered_at && (
            <span className="dac-badge dac-badge-gray">
              {new Date(r.payment_delivered_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}

      {Array.isArray(r.stops) && r.stops.length > 0 && (
        <>
          <button
            className="dac-stops-toggle"
            onClick={() => setShowStops(v => !v)}
          >
            <span className="material-icons">{showStops ? 'expand_less' : 'expand_more'}</span>
            {showStops ? t('accounting.hideStops') : `${t('accounting.viewStops')} (${r.stops.length})`}
          </button>
          {showStops && (
            <div className="dac-stops-list">
              {r.stops.map((s, idx) => {
                const isCompleted = s.status === 'completed'
                const isSkipped = s.status === 'skipped' || s.status === 'failed'
                return (
                  <div
                    key={s.id}
                    className={`dac-stop-row ${isCompleted ? 'is-completed' : ''} ${isSkipped ? 'is-skipped' : ''}`}
                  >
                    <span className={`dac-stop-icon material-icons ${isCompleted ? 'ico-completed' : isSkipped ? 'ico-skipped' : 'ico-pending'}`}>
                      {isCompleted ? 'check_circle' : isSkipped ? 'cancel' : 'radio_button_unchecked'}
                    </span>
                    <div className="dac-stop-body">
                      <div className="dac-stop-name">
                        <span className="dac-stop-num">{idx + 1}.</span>
                        <span className="dac-stop-text">{s.customer_name || t('common.noName')}</span>
                        {isSkipped && <span className="dac-stop-badge dac-stop-badge-skipped">{t('accounting.skipped')}</span>}
                        {isCompleted && <span className="dac-stop-badge dac-stop-badge-completed">{t('accounting.delivered')}</span>}
                      </div>
                      {s.address && (
                        <div className="dac-stop-addr">
                          <span className="material-icons">place</span>
                          <span>{s.address}{s.apartment_number ? `, Apt ${s.apartment_number}` : ''}</span>
                        </div>
                      )}
                      {(Number(s.amount_collected) > 0 || s.payment_method) && (
                        <div className="dac-stop-chips">
                          {Number(s.amount_collected) > 0 && (
                            <span className="dac-stop-chip c-green">+{fmt(s.amount_collected)}</span>
                          )}
                          {s.payment_method && (
                            <span className="dac-stop-chip">{s.payment_method}</span>
                          )}
                        </div>
                      )}
                      {isSkipped && s.failed_reason && (
                        <div className="dac-stop-reason">{s.failed_reason}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {!r.payment_delivered && (
        <div style={{ marginTop: 10 }}>
          {!showPayForm ? (
            <button
              className="dac-deliver-btn"
              onClick={() => setShowPayForm(true)}
            >
              <span className="material-icons">payments</span>
              {t('accounting.markDeliveredAdmin')}
            </button>
          ) : (
            <div className="dac-pay-form">
              <select
                className="dac-month-select"
                value={method}
                onChange={e => setMethod(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">{t('accounting.selectPaymentPlaceholder')}</option>
                <option value="cash">{t('planner.cash')}</option>
                <option value="card">{t('planner.card')}</option>
                <option value="transfer">{t('planner.transfer')}</option>
                <option value="check">{t('planner.check')}</option>
                <option value="zelle">{t('planner.zelle')}</option>
              </select>
              <button
                className="dac-deliver-btn"
                onClick={handleDeliver}
                disabled={!method || delivering}
                style={{ minWidth: 90 }}
              >
                {delivering ? '...' : t('common.confirm')}
              </button>
              <button
                className="dac-cancel-btn"
                onClick={() => { setShowPayForm(false); setMethod('') }}
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Tarjeta que muestra el resumen de contabilidad de un mes específico.
 * @param {Object} props - Propiedades del componente.
 * @param {Object} props.m - Datos del mes.
 * @param {boolean} props.expanded - Si la tarjeta está expandida.
 * @param {Function} props.onToggle - Función para alternar la expansión.
 * @param {Function} props.getPmt - Función para obtener configuración de pago.
 * @param {Function} props.t - Función de traducción.
 * @param {string} props.lang - Idioma actual.
 * @returns {JSX.Element} El elemento JSX.
 */
function MonthCard({ m, expanded, onToggle, getPmt, t, lang }) {
  return (
    <div className="dac-month-card">
      <button className="dac-month-header" onClick={onToggle}>
        <div className="dac-month-info">
          <div className="dac-month-name">{monthLabel(m.month_year, lang)}</div>
          <div className="dac-month-count">
            <span className="material-icons">local_shipping</span>
            {m.stops_count} {t('accounting.deliveries')}
          </div>
        </div>
        <div className="dac-month-amounts">
          <div className="dac-month-comm">+{fmt(m.total_commission)}</div>
          <div className="dac-month-deliver">{fmt(m.to_deliver)} {t('accounting.toDeliver')}</div>
        </div>
        <span className="material-icons dac-chevron">{expanded ? 'expand_less' : 'expand_more'}</span>
      </button>

      {expanded && (
        <div className="dac-month-body">
          <div className="dac-month-totals">
            <div className="dac-tot-row">
              <span>{t('accounting.cashCollected')}</span>
              <strong className="c-green">{fmt(m.total_cash_collected != null ? m.total_cash_collected : m.total_collected)}</strong>
            </div>
            {Number(m.total_electronic_collected) > 0 && (
              <div className="dac-tot-row">
                <span>{t('accounting.electronicToCompany')}</span>
                <strong style={{ color: '#a78bfa' }}>{fmt(m.total_electronic_collected)}</strong>
              </div>
            )}
            <div className="dac-tot-row">
              <span>{t('accounting.myCommission')}</span>
              <strong className="c-blue">{fmt(m.total_commission)}</strong>
            </div>
            <div className="dac-tot-row dac-tot-highlight">
              <span>{t('accounting.cashToOffice')}</span>
              <strong className="c-orange">{fmt(m.to_deliver)}</strong>
            </div>
          </div>

          {m.deliveries && m.deliveries.length > 0 && (
            <div className="dac-mini-list">
              {m.deliveries.map(d => (
                <div key={d.id} className="dac-mini-item">
                  <div className="dac-mini-row">
                    <span className="dac-mini-name">{d.customer_name || t('common.noName')}</span>
                    <span className="dac-mini-date">{fmtDate(d.delivered_at)}</span>
                  </div>
                  {d.address && (
                    <div className="dac-mini-addr">
                      <span className="material-icons">place</span>{d.address}
                    </div>
                  )}
                  <div className="dac-mini-amounts">
                    <span className="dac-mini-chip c-green">+{fmt(d.amount_collected)}</span>
                    <span className="dac-mini-chip c-blue">{t('accounting.commission')} {fmt(d.commission_per_stop)}</span>
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

/**
 * Tarjeta que muestra detalles de una entrega individual.
 * @param {Object} props - Propiedades del componente.
 * @param {Object} props.d - Datos de la entrega.
 * @param {Function} props.getPmt - Función para obtener configuración de pago.
 * @param {Function} props.t - Función de traducción.
 * @returns {JSX.Element} El elemento JSX.
 */
function DeliveryCard({ d, getPmt, t }) {
  const pmt = d.payment_method ? getPmt(d.payment_method) : null
  const isCash = !d.payment_method || d.payment_method === 'cash'
  const toDeliver = (isCash ? Number(d.amount_collected) - Number(d.commission_per_stop) : 0).toFixed(2)

  return (
    <div className="dac-del-card">
      <div className="dac-del-top">
        <div className="dac-del-avatar">
          {(d.customer_name || '?')[0].toUpperCase()}
        </div>
        <div className="dac-del-info">
          <div className="dac-del-name">{d.customer_name || t('common.noName')}</div>
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
          <div className="dac-del-cell-lbl">{t('accounting.toCollect')}</div>
          <div className="dac-del-cell-val">{fmt(d.total_to_collect)}</div>
        </div>
        <div className="dac-del-cell">
          <div className="dac-del-cell-lbl">{t('accounting.collected')}</div>
          <div className="dac-del-cell-val c-green">{fmt(d.amount_collected)}</div>
        </div>
        <div className="dac-del-cell">
          <div className="dac-del-cell-lbl">{t('accounting.commission')}</div>
          <div className="dac-del-cell-val c-blue">{fmt(d.commission_per_stop)}</div>
        </div>
        <div className="dac-del-cell">
          <div className="dac-del-cell-lbl">{t('accounting.toDeliver')}</div>
          <div className="dac-del-cell-val c-orange">${toDeliver}</div>
        </div>
      </div>

      {pmt && (
        <div className="dac-del-badges">
          <span className="dac-badge" style={{ color: pmt.color, background: pmt.bg }}>
            {pmt.label}
          </span>
          {d.archived && <span className="dac-badge dac-badge-gray">{t('accounting.archived')}</span>}
        </div>
      )}
    </div>
  )
}
