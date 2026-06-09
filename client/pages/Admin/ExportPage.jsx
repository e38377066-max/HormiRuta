import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'
import './AdminPages.css'

const DISPATCH_STATUSES = [
  { key: 'available', label: 'Disponible' },
  { key: 'assigned',  label: 'Asignado' },
  { key: 'delivered', label: 'Entregado' },
  { key: 'archived',  label: 'Archivado' }
]

const ORDER_STATUSES = [
  { key: 'approved',     label: 'Aprobado' },
  { key: 'pending',      label: 'Pendiente' },
  { key: 'ordered',      label: 'Ordenado' },
  { key: 'pickup_ready', label: 'Listo para recoger' },
  { key: 'on_delivery',  label: 'En camino' },
  { key: 'ups_shipped',  label: 'UPS Enviado' },
  { key: 'delivered',    label: 'Entregado (orden)' }
]

const COLUMN_GROUPS = [
  {
    label: 'Cliente',
    icon: 'person',
    cols: [
      { key: 'customer_name',  label: 'Nombre' },
      { key: 'customer_phone', label: 'Teléfono' }
    ]
  },
  {
    label: 'Dirección',
    icon: 'location_on',
    cols: [
      { key: 'validated_address', label: 'Dirección Validada' },
      { key: 'original_address',  label: 'Dirección Original' },
      { key: 'apartment_number',  label: 'Apartamento' },
      { key: 'city',              label: 'Ciudad' },
      { key: 'state',             label: 'Estado' },
      { key: 'zip_code',          label: 'ZIP' }
    ]
  },
  {
    label: 'Financiero',
    icon: 'attach_money',
    cols: [
      { key: 'order_cost',       label: 'Costo ($)' },
      { key: 'deposit_amount',   label: 'Depósito ($)' },
      { key: 'total_to_collect', label: 'Por Cobrar ($)' },
      { key: 'amount_collected', label: 'Cobrado ($)' },
      { key: 'payment_method',   label: 'Método Pago' },
      { key: 'payment_status',   label: 'Estado Pago' }
    ]
  },
  {
    label: 'Logística',
    icon: 'local_shipping',
    cols: [
      { key: 'dispatch_status', label: 'Estado Despacho' },
      { key: 'order_status',    label: 'Estado Orden' },
      { key: 'driver_name',     label: 'Driver' },
      { key: 'notes',           label: 'Notas' },
      { key: 'source',          label: 'Fuente' },
      { key: 'created_at',      label: 'Fecha Creación' },
      { key: 'delivered_at',    label: 'Fecha Entrega' }
    ]
  }
]

const DEFAULT_COLS = new Set([
  'customer_name', 'customer_phone', 'validated_address',
  'apartment_number', 'city', 'zip_code',
  'dispatch_status', 'order_status',
  'order_cost', 'deposit_amount', 'total_to_collect', 'driver_name'
])

const initBool = (items, defaultTrue) => {
  const obj = {}
  items.forEach(({ key }) => { obj[key] = defaultTrue.has(key) })
  return obj
}

const ALL_COLS = COLUMN_GROUPS.flatMap(g => g.cols)

export default function ExportPage() {
  const navigate = useNavigate()

  const [dispatchSel, setDispatchSel] = useState(
    initBool(DISPATCH_STATUSES, new Set(['available', 'assigned']))
  )
  const [orderSel, setOrderSel] = useState(
    initBool(ORDER_STATUSES, new Set(ORDER_STATUSES.map(o => o.key)))
  )
  const [colSel, setColSel] = useState(initBool(ALL_COLS, DEFAULT_COLS))
  const [exporting, setExporting] = useState(false)
  const [count, setCount] = useState(null)
  const [countLoading, setCountLoading] = useState(false)

  const anyDispatch = Object.values(dispatchSel).some(Boolean)
  const anyCols    = Object.values(colSel).some(Boolean)

  const toggleAll = (setter, items, value) => {
    const obj = {}
    items.forEach(({ key }) => { obj[key] = value })
    setter(obj)
  }

  const toggleGroup = (keys, value) => {
    setColSel(prev => {
      const next = { ...prev }
      keys.forEach(k => { next[k] = value })
      return next
    })
  }

  const fetchCount = async () => {
    const ds = Object.entries(dispatchSel).filter(([,v]) => v).map(([k]) => k)
    const os = Object.entries(orderSel).filter(([,v]) => v).map(([k]) => k)
    if (!ds.length) { setCount(0); return }
    setCountLoading(true)
    try {
      const res = await api.get('/api/admin/dispatch/export-count', {
        params: {
          statuses: ds.join(','),
          orderStatuses: os.length ? os.join(',') : undefined
        }
      })
      setCount(res.data.count)
    } catch { setCount(null) }
    finally { setCountLoading(false) }
  }

  const handleExport = async () => {
    const ds = Object.entries(dispatchSel).filter(([,v]) => v).map(([k]) => k)
    const os = Object.entries(orderSel).filter(([,v]) => v).map(([k]) => k)
    const cols = Object.entries(colSel).filter(([,v]) => v).map(([k]) => k)
    if (!ds.length) { alert('Selecciona al menos un estado de despacho.'); return }
    if (!cols.length) { alert('Selecciona al menos una columna.'); return }
    setExporting(true)
    try {
      const res = await api.get('/api/admin/dispatch/export', {
        params: {
          statuses: ds.join(','),
          orderStatuses: os.length ? os.join(',') : undefined,
          columns: cols.join(',')
        },
        responseType: 'blob'
      })
      const url = URL.createObjectURL(new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }))
      const a = document.createElement('a')
      a.href = url
      a.download = `dispatcher_${new Date().toISOString().slice(0,10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Error al exportar. Inténtalo de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/admin')}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1>Exportar Dispatcher a Excel</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── FILTRO: Estado de Despacho ── */}
        <div className="admin-section">
          <div className="section-header">
            <span className="material-icons">filter_list</span>
            <h3>Estado de Despacho</h3>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button className="export-toggle-btn" onClick={() => toggleAll(setDispatchSel, DISPATCH_STATUSES, true)}>Todos</button>
              <button className="export-toggle-btn" onClick={() => toggleAll(setDispatchSel, DISPATCH_STATUSES, false)}>Ninguno</button>
            </div>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {DISPATCH_STATUSES.map(({ key, label }) => (
              <Chip
                key={key}
                label={label}
                checked={dispatchSel[key]}
                color="#3b82f6"
                onChange={v => { setDispatchSel(p => ({ ...p, [key]: v })); setCount(null) }}
              />
            ))}
          </div>
        </div>

        {/* ── FILTRO: Estado de Orden ── */}
        <div className="admin-section">
          <div className="section-header">
            <span className="material-icons">assignment</span>
            <h3>Estado de Orden</h3>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button className="export-toggle-btn" onClick={() => toggleAll(setOrderSel, ORDER_STATUSES, true)}>Todos</button>
              <button className="export-toggle-btn" onClick={() => toggleAll(setOrderSel, ORDER_STATUSES, false)}>Ninguno</button>
            </div>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {ORDER_STATUSES.map(({ key, label }) => (
              <Chip
                key={key}
                label={label}
                checked={orderSel[key]}
                color="#a855f7"
                onChange={v => { setOrderSel(p => ({ ...p, [key]: v })); setCount(null) }}
              />
            ))}
          </div>
          <p style={{ margin: '0 16px 12px', fontSize: '0.78rem', color: '#888' }}>
            Si no marcas ningún estado de orden, se exportan todos.
          </p>
        </div>

        {/* ── COLUMNAS ── */}
        <div className="admin-section">
          <div className="section-header">
            <span className="material-icons">view_column</span>
            <h3>Columnas a incluir</h3>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button className="export-toggle-btn" onClick={() => toggleAll(setColSel, ALL_COLS, true)}>Todas</button>
              <button className="export-toggle-btn" onClick={() => toggleAll(setColSel, ALL_COLS, false)}>Ninguna</button>
            </div>
          </div>
          <div style={{ padding: '4px 16px 16px' }}>
            {COLUMN_GROUPS.map(group => (
              <div key={group.label} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span className="material-icons" style={{ fontSize: '16px', color: '#888' }}>{group.icon}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{group.label}</span>
                  <button
                    className="export-toggle-btn"
                    style={{ marginLeft: '6px', fontSize: '0.72rem', padding: '2px 8px' }}
                    onClick={() => {
                      const keys = group.cols.map(c => c.key)
                      const allOn = keys.every(k => colSel[k])
                      toggleGroup(keys, !allOn)
                    }}
                  >
                    {group.cols.every(c => colSel[c.key]) ? 'Quitar grupo' : 'Selec. grupo'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {group.cols.map(({ key, label }) => (
                    <Chip
                      key={key}
                      label={label}
                      checked={colSel[key]}
                      color="#22c55e"
                      onChange={v => setColSel(p => ({ ...p, [key]: v }))}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── ACCIONES ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', paddingBottom: '32px' }}>
          <button
            onClick={fetchCount}
            disabled={countLoading || !anyDispatch}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '10px 20px', borderRadius: '10px', border: '2px solid #3b82f6',
              background: '#fff', color: '#3b82f6', fontWeight: '600', fontSize: '0.9rem',
              cursor: (!anyDispatch || countLoading) ? 'not-allowed' : 'pointer', opacity: (!anyDispatch || countLoading) ? 0.5 : 1
            }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {countLoading ? 'hourglass_top' : 'format_list_numbered'}
            </span>
            {countLoading ? 'Contando…' : 'Ver cuántos registros'}
          </button>

          {count !== null && (
            <span style={{ fontSize: '0.9rem', color: '#444', fontWeight: '500' }}>
              <strong style={{ color: '#3b82f6' }}>{count}</strong> registro{count !== 1 ? 's' : ''} encontrado{count !== 1 ? 's' : ''}
            </span>
          )}

          <button
            onClick={handleExport}
            disabled={exporting || !anyDispatch || !anyCols}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '11px 26px', borderRadius: '10px', border: 'none',
              background: (exporting || !anyDispatch || !anyCols) ? '#9ca3af' : 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#fff', fontWeight: '700', fontSize: '0.95rem',
              cursor: (exporting || !anyDispatch || !anyCols) ? 'not-allowed' : 'pointer'
            }}
          >
            <span className="material-icons" style={{ fontSize: '20px' }}>
              {exporting ? 'hourglass_top' : 'download'}
            </span>
            {exporting ? 'Generando Excel…' : 'Descargar Excel'}
          </button>
        </div>

      </div>
    </div>
  )
}

function Chip({ label, checked, color, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '7px 13px', borderRadius: '20px', cursor: 'pointer',
        border: checked ? `2px solid ${color}` : '2px solid #e0e0e0',
        background: checked ? `${color}18` : '#f5f5f5',
        color: checked ? color : '#666',
        fontWeight: checked ? '600' : '400',
        fontSize: '0.85rem', transition: 'all 0.15s', userSelect: 'none',
        outline: 'none'
      }}
    >
      <span className="material-icons" style={{ fontSize: '15px' }}>
        {checked ? 'check_box' : 'check_box_outline_blank'}
      </span>
      {label}
    </button>
  )
}
