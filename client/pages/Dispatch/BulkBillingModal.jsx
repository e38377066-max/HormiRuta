import { useState, useRef } from 'react'
import api from '../../api'
import './BulkBillingModal.css'

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []
  const headerRaw = lines[0]
  const headers = splitCSVLine(headerRaw).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const vals = splitCSVLine(line)
    const obj = {}
    headers.forEach((h, idx) => { obj[h] = (vals[idx] || '').trim() })
    rows.push(obj)
  }
  return rows
}

function splitCSVLine(line) {
  const result = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

function generateTemplate(orders) {
  const BOM = '\uFEFF'
  const header = ['ID', 'Cliente', 'Telefono', 'Direccion', 'Costo (order_cost)', 'Deposito (deposit_amount)', 'A Cobrar (calc)']
  const rows = orders.map(o => [
    o.id,
    o.customer_name || '',
    o.customer_phone || '',
    o.validated_address || '',
    o.order_cost     != null ? Number(o.order_cost).toFixed(2)     : '',
    o.deposit_amount != null ? Number(o.deposit_amount).toFixed(2) : '',
    o.total_to_collect != null ? Number(o.total_to_collect).toFixed(2) : '',
  ])
  const csv = BOM + [header, ...rows]
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `plantilla-precios-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const COL_MAP = {
  id:                   'id',
  'costo_(order_cost)': 'order_cost',
  'deposito_(deposit_amount)': 'deposit_amount',
  order_cost:           'order_cost',
  deposit_amount:       'deposit_amount',
  costo:                'order_cost',
  deposito:             'deposit_amount',
  cost:                 'order_cost',
  deposit:              'deposit_amount',
}

export default function BulkBillingModal({ orders, onClose, onSuccess }) {
  const [parsed, setParsed]     = useState(null)
  const [error, setError]       = useState('')
  const [applying, setApplying] = useState(false)
  const [result, setResult]     = useState(null)
  const fileRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setResult(null); setParsed(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const rawRows = parseCSV(ev.target.result)
        if (!rawRows.length) { setError('El archivo no tiene filas de datos.'); return }

        const normalized = rawRows.map(row => {
          const out = {}
          for (const [k, v] of Object.entries(row)) {
            const mapped = COL_MAP[k]
            if (mapped) out[mapped] = v
          }
          return out
        }).filter(r => r.id && !isNaN(parseInt(r.id)))

        if (!normalized.length) {
          setError('No se encontraron filas válidas con columna ID.')
          return
        }

        const withNames = normalized.map(r => {
          const orig = orders.find(o => String(o.id) === String(r.id))
          return {
            ...r,
            customer_name: orig?.customer_name || r.id,
            address:       orig?.validated_address || '',
            orig_cost:     orig?.order_cost,
            orig_deposit:  orig?.deposit_amount,
          }
        })
        setParsed(withNames)
      } catch (err) {
        setError('Error al leer el archivo: ' + err.message)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleApply = async () => {
    if (!parsed?.length) return
    setApplying(true); setError(''); setResult(null)
    try {
      const updates = parsed.map(r => ({
        id:             r.id,
        order_cost:     r.order_cost    !== '' && r.order_cost    != null ? r.order_cost    : null,
        deposit_amount: r.deposit_amount !== '' && r.deposit_amount != null ? r.deposit_amount : null,
      }))
      const res = await api.put('/api/dispatch/bulk-billing', { updates })
      setResult(res.data)
      onSuccess && onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al aplicar precios')
    } finally {
      setApplying(false)
    }
  }

  const fmt = (v) => v != null && v !== '' && !isNaN(Number(v)) ? `$${Number(v).toFixed(2)}` : '—'
  const changed = (r) => {
    const newCost    = r.order_cost    !== '' && r.order_cost    != null
    const newDeposit = r.deposit_amount !== '' && r.deposit_amount != null
    return (newCost    && String(Number(r.order_cost).toFixed(2))    !== String(Number(r.orig_cost    ?? '').toFixed(2))) ||
           (newDeposit && String(Number(r.deposit_amount).toFixed(2)) !== String(Number(r.orig_deposit ?? '').toFixed(2)))
  }

  return (
    <div className="bbm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bbm-modal">
        <div className="bbm-header">
          <div className="bbm-title">
            <span className="material-icons">table_chart</span>
            Actualizar Precios desde Excel
          </div>
          <button className="bbm-close" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="bbm-body">
          <div className="bbm-steps">
            <div className="bbm-step">
              <div className="bbm-step-num">1</div>
              <div className="bbm-step-content">
                <div className="bbm-step-title">Descargar plantilla</div>
                <div className="bbm-step-desc">
                  Descarga el CSV con todas las órdenes actuales, edita los precios en Excel y guarda como CSV.
                </div>
                <button className="bbm-btn bbm-btn-green" onClick={() => generateTemplate(orders)}>
                  <span className="material-icons">download</span>
                  Descargar Plantilla CSV ({orders.length} órdenes)
                </button>
              </div>
            </div>

            <div className="bbm-step">
              <div className="bbm-step-num">2</div>
              <div className="bbm-step-content">
                <div className="bbm-step-title">Subir archivo con precios</div>
                <div className="bbm-step-desc">
                  Solo edita las columnas <strong>Costo (order_cost)</strong> y <strong>Deposito (deposit_amount)</strong>. No cambies la columna ID.
                </div>
                <div
                  className="bbm-drop-zone"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bbm-drop-active') }}
                  onDragLeave={e => e.currentTarget.classList.remove('bbm-drop-active')}
                  onDrop={e => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('bbm-drop-active')
                    const file = e.dataTransfer.files?.[0]
                    if (file) { const dt = new DataTransfer(); dt.items.add(file); fileRef.current.files = dt.files; handleFile({ target: fileRef.current }) }
                  }}
                >
                  <span className="material-icons">upload_file</span>
                  <span>Arrastra el CSV aquí o haz clic para seleccionar</span>
                  <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: 'none' }} />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bbm-error">
              <span className="material-icons">error_outline</span>
              {error}
            </div>
          )}

          {result && (
            <div className="bbm-success">
              <span className="material-icons">check_circle</span>
              ✓ {result.updated} órdenes actualizadas
              {result.skipped > 0 && ` · ${result.skipped} omitidas`}
            </div>
          )}

          {parsed && !result && (
            <div className="bbm-preview">
              <div className="bbm-preview-header">
                <span className="bbm-preview-title">
                  Vista previa — {parsed.length} órdenes
                  {parsed.filter(changed).length > 0 && (
                    <span className="bbm-changed-badge">{parsed.filter(changed).length} con cambios</span>
                  )}
                </span>
              </div>
              <div className="bbm-table-wrap">
                <table className="bbm-table">
                  <thead>
                    <tr>
                      <th>#ID</th>
                      <th>Cliente</th>
                      <th>Costo Anterior</th>
                      <th>Costo Nuevo</th>
                      <th>Depósito Anterior</th>
                      <th>Depósito Nuevo</th>
                      <th>A Cobrar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map(r => {
                      const isChanged = changed(r)
                      const newCost    = r.order_cost    !== '' && r.order_cost    != null ? parseFloat(r.order_cost)    : (r.orig_cost    || 0)
                      const newDeposit = r.deposit_amount !== '' && r.deposit_amount != null ? parseFloat(r.deposit_amount) : (r.orig_deposit || 0)
                      const toCollect  = Math.max(0, newCost - newDeposit)
                      return (
                        <tr key={r.id} className={isChanged ? 'bbm-row-changed' : ''}>
                          <td className="bbm-id">{r.id}</td>
                          <td className="bbm-name">{r.customer_name}</td>
                          <td className="bbm-money bbm-old">{fmt(r.orig_cost)}</td>
                          <td className="bbm-money bbm-new">{fmt(r.order_cost)}</td>
                          <td className="bbm-money bbm-old">{fmt(r.orig_deposit)}</td>
                          <td className="bbm-money bbm-new">{fmt(r.deposit_amount)}</td>
                          <td className="bbm-money bbm-collect">${toCollect.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="bbm-apply-row">
                <span className="bbm-apply-hint">
                  Solo se actualizan las celdas con valor. Las celdas vacías mantienen el precio actual.
                </span>
                <button
                  className="bbm-btn bbm-btn-blue"
                  onClick={handleApply}
                  disabled={applying}
                >
                  {applying
                    ? <><span className="material-icons rotating">hourglass_empty</span> Aplicando...</>
                    : <><span className="material-icons">save</span> Aplicar {parsed.filter(changed).length || parsed.length} precios</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
