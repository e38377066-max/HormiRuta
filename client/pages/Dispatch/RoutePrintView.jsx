import './RoutePrintView.css'

const STATUS_LABELS = {
  pending:   'Pendiente',
  arrived:   'En camino',
  completed: 'Entregada',
  failed:    'Fallida',
  skipped:   'Saltada',
}

const PAYMENT_LABELS = {
  cash:     'Efectivo',
  zelle:    'Zelle',
  card:     'Tarjeta',
  transfer: 'Transferencia',
  check:    'Cheque',
}

const fmt = (n) => (n != null && !isNaN(n) ? `$${Number(n).toFixed(2)}` : '—')

export default function RoutePrintView({ route, stops, driverName, onClose }) {
  const totalCosto       = stops.reduce((s, st) => s + (st.order_cost       || 0), 0)
  const totalDepositado  = stops.reduce((s, st) => s + (st.deposit_amount   || 0), 0)
  const totalACobrar     = stops.reduce((s, st) => s + (st.total_to_collect || 0), 0)
  const totalCobrado     = stops.reduce((s, st) => s + (st.amount_collected || 0), 0)

  const handlePrint = () => window.print()

  const handleExportCSV = () => {
    const BOM = '\uFEFF'
    const header = ['#', 'Cliente', 'Telefono', 'Direccion', 'Notas', 'Costo Total', 'Ya Depositado', 'A Cobrar', 'Cobrado', 'Metodo Pago', 'Estado']
    const rows = stops.map((s, i) => [
      i + 1,
      s.customer_name || '',
      s.phone || '',
      [s.address, s.apartment_number ? `Apt ${s.apartment_number}` : ''].filter(Boolean).join(', '),
      s.note || '',
      s.order_cost       != null ? Number(s.order_cost).toFixed(2)       : '',
      s.deposit_amount   != null ? Number(s.deposit_amount).toFixed(2)   : '',
      s.total_to_collect != null ? Number(s.total_to_collect).toFixed(2) : '',
      s.amount_collected != null ? Number(s.amount_collected).toFixed(2) : '',
      PAYMENT_LABELS[s.payment_method] || s.payment_method || '',
      STATUS_LABELS[s.status] || s.status || '',
    ])
    const totalsRow = ['', 'TOTALES', '', '', '',
      totalCosto.toFixed(2),
      totalDepositado.toFixed(2),
      totalACobrar.toFixed(2),
      totalCobrado.toFixed(2),
      '', ''
    ]
    const csv = BOM + [header, ...rows, [], totalsRow]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `ruta-${(route.name || route.id).replace(/[^a-zA-Z0-9-]/g, '_')}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fecha = route.scheduled_date
    ? new Date(route.scheduled_date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="rpv-overlay">
      <div className="rpv-modal">

        <div className="rpv-toolbar no-print">
          <div className="rpv-toolbar-title">
            <span className="material-icons">print</span>
            Vista de impresión — {route.name}
          </div>
          <div className="rpv-toolbar-actions">
            <button className="rpv-btn rpv-btn-csv" onClick={handleExportCSV}>
              <span className="material-icons">table_chart</span>
              Exportar Excel
            </button>
            <button className="rpv-btn rpv-btn-print" onClick={handlePrint}>
              <span className="material-icons">print</span>
              Imprimir / PDF
            </button>
            <button className="rpv-btn rpv-btn-close" onClick={onClose}>
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>

        <div className="rpv-document">

          <header className="rpv-header">
            <div className="rpv-header-brand">
              <div className="rpv-header-logo">862</div>
              <div>
                <div className="rpv-header-company">Area 862 System</div>
                <div className="rpv-header-subtitle">Hoja de Ruta de Entrega</div>
              </div>
            </div>
            <div className="rpv-header-meta">
              <div className="rpv-meta-grid">
                <span className="rpv-meta-label">Ruta</span>
                <span className="rpv-meta-value rpv-route-name">{route.name}</span>
                <span className="rpv-meta-label">Chofer</span>
                <span className="rpv-meta-value">{driverName || '—'}</span>
                <span className="rpv-meta-label">Fecha</span>
                <span className="rpv-meta-value">{fecha}</span>
                <span className="rpv-meta-label">Estado</span>
                <span className={`rpv-badge rpv-badge-${route.status}`}>
                  {route.status === 'assigned' ? 'Asignada' : route.status === 'completed' ? 'Completada' : route.status === 'draft' ? 'Borrador' : route.status}
                </span>
                <span className="rpv-meta-label">Paradas</span>
                <span className="rpv-meta-value">{stops.length}</span>
              </div>
            </div>
          </header>

          <table className="rpv-table">
            <thead>
              <tr>
                <th className="rpv-col-num">#</th>
                <th className="rpv-col-cliente">Cliente</th>
                <th className="rpv-col-dir">Dirección</th>
                <th className="rpv-col-money">Costo</th>
                <th className="rpv-col-money">Depositado</th>
                <th className="rpv-col-money rpv-highlight">A Cobrar</th>
                <th className="rpv-col-money">Cobrado</th>
                <th className="rpv-col-pago">Pago</th>
                <th className="rpv-col-status">Estado</th>
              </tr>
            </thead>
            <tbody>
              {stops.map((s, i) => (
                <tr key={s.id} className={
                  s.status === 'completed' ? 'rpv-row-done' :
                  s.status === 'failed' || s.status === 'skipped' ? 'rpv-row-fail' : ''
                }>
                  <td className="rpv-col-num">{i + 1}</td>
                  <td className="rpv-col-cliente">
                    <div className="rpv-customer">{s.customer_name || '—'}</div>
                    {s.phone && <div className="rpv-phone">{s.phone}</div>}
                    {s.note && <div className="rpv-note">{s.note}</div>}
                  </td>
                  <td className="rpv-col-dir">
                    {s.address || '—'}
                    {s.apartment_number ? <span className="rpv-apt"> · Apt {s.apartment_number}</span> : null}
                  </td>
                  <td className="rpv-col-money">{fmt(s.order_cost)}</td>
                  <td className="rpv-col-money rpv-deposit">{fmt(s.deposit_amount)}</td>
                  <td className="rpv-col-money rpv-highlight rpv-to-collect">{fmt(s.total_to_collect)}</td>
                  <td className="rpv-col-money">{fmt(s.amount_collected)}</td>
                  <td className="rpv-col-pago">
                    {s.payment_method ? (PAYMENT_LABELS[s.payment_method] || s.payment_method) : '—'}
                  </td>
                  <td className="rpv-col-status">
                    <span className={`rpv-status rpv-status-${s.status}`}>
                      {STATUS_LABELS[s.status] || s.status || 'Pendiente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="rpv-totals">
                <td colSpan={3} className="rpv-totals-label">TOTALES</td>
                <td className="rpv-col-money"><strong>{fmt(totalCosto)}</strong></td>
                <td className="rpv-col-money rpv-deposit"><strong>{fmt(totalDepositado)}</strong></td>
                <td className="rpv-col-money rpv-highlight rpv-to-collect"><strong>{fmt(totalACobrar)}</strong></td>
                <td className="rpv-col-money"><strong>{fmt(totalCobrado)}</strong></td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>

          {(route.route_total_collected > 0 || totalACobrar > 0) && (
            <div className="rpv-summary">
              <div className="rpv-summary-row">
                <span>Total a cobrar en ruta</span>
                <span className="rpv-summary-amount">{fmt(totalACobrar)}</span>
              </div>
              {totalDepositado > 0 && (
                <div className="rpv-summary-row">
                  <span>Total ya depositado</span>
                  <span className="rpv-summary-amount rpv-summary-dep">{fmt(totalDepositado)}</span>
                </div>
              )}
              {route.route_total_collected > 0 && (
                <div className="rpv-summary-row">
                  <span>Total recolectado (chofer)</span>
                  <span className="rpv-summary-amount">{fmt(route.route_total_collected)}</span>
                </div>
              )}
              {route.payment_delivered ? (
                <div className="rpv-summary-row rpv-summary-paid">
                  <span>✓ Entregado al administrador</span>
                  <span className="rpv-summary-amount">
                    {fmt(route.admin_amount_received || route.route_total_collected)}
                    {route.payment_delivery_method && ` (${PAYMENT_LABELS[route.payment_delivery_method] || route.payment_delivery_method})`}
                  </span>
                </div>
              ) : route.route_total_collected > 0 ? (
                <div className="rpv-summary-row rpv-summary-pending">
                  <span>⚠ Pago pendiente de entregar</span>
                  <span className="rpv-summary-amount">{fmt(route.route_total_collected)}</span>
                </div>
              ) : null}
            </div>
          )}

          <div className="rpv-sign-section no-print-hide">
            <div className="rpv-sign-box">
              <div className="rpv-sign-line"></div>
              <div className="rpv-sign-label">Firma del Chofer</div>
            </div>
            <div className="rpv-sign-box">
              <div className="rpv-sign-line"></div>
              <div className="rpv-sign-label">Firma del Administrador</div>
            </div>
          </div>

          <footer className="rpv-footer">
            <span>Impreso el {new Date().toLocaleString('es-MX')}</span>
            <span>Area 862 System · Dallas, TX</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
