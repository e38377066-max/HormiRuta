import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'
import './AdminPages.css'

const STATUS_LABELS = {
  pickup_ready: 'Listo p/Recoger',
  on_delivery: 'En Entrega',
  ordered: 'Ordenado',
  null: 'Sin orden activa'
}

const STATUS_COLORS = {
  pickup_ready: '#22c55e',
  on_delivery: '#f59e0b',
  ordered: '#3b82f6',
  null: '#6b7280'
}

export default function WholesalePage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dispatchingId, setDispatchingId] = useState(null)
  const [msg, setMsg] = useState(null)

  const emptyForm = {
    customer_name: '',
    customer_phone: '',
    validated_address: '',
    respond_contact_id: '',
    notes: '',
    is_active: true
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/wholesale')
      setClients(res.data.clients || [])
    } catch (err) {
      console.error('Error cargando mayoristas:', err)
    } finally {
      setLoading(false)
    }
  }

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  const openAdd = () => {
    setEditingClient(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (client) => {
    setEditingClient(client)
    setForm({
      customer_name: client.customer_name || '',
      customer_phone: client.customer_phone || '',
      validated_address: client.validated_address || '',
      respond_contact_id: client.respond_contact_id || '',
      notes: client.notes || '',
      is_active: client.is_active !== false
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.customer_name.trim()) {
      showMsg('El nombre es obligatorio', 'error')
      return
    }
    setSaving(true)
    try {
      if (editingClient) {
        await api.put(`/api/wholesale/${editingClient.id}`, form)
        showMsg(`Mayorista "${form.customer_name}" actualizado`)
      } else {
        await api.post('/api/wholesale', form)
        showMsg(`Mayorista "${form.customer_name}" creado`)
      }
      setShowForm(false)
      fetchClients()
    } catch (err) {
      showMsg(err.response?.data?.error || 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (client) => {
    if (!window.confirm(`¿Eliminar a "${client.customer_name}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/api/wholesale/${client.id}`)
      showMsg(`Mayorista "${client.customer_name}" eliminado`)
      fetchClients()
    } catch (err) {
      showMsg(err.response?.data?.error || 'Error al eliminar', 'error')
    }
  }

  const handleDispatchNow = async (client) => {
    if (!client.validated_address) {
      showMsg('Este mayorista no tiene dirección registrada', 'error')
      return
    }
    if (!window.confirm(`¿Agregar a "${client.customer_name}" al despachador ahora como "Listo para Recoger"?`)) return
    setDispatchingId(client.id)
    try {
      await api.post(`/api/wholesale/${client.id}/dispatch-now`)
      showMsg(`"${client.customer_name}" agregado al despachador`)
      fetchClients()
    } catch (err) {
      showMsg(err.response?.data?.error || 'Error al despachar', 'error')
    } finally {
      setDispatchingId(null)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  const activeClients = clients.filter(c => c.is_active)
  const inactiveClients = clients.filter(c => !c.is_active)

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <div style={{ flex: 1 }}>
          <h1>Clientes Mayoristas (MAY)</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Contactos con "MAY" en el nombre — el sistema los agrega automáticamente al despachador cuando llega un correo Pickup Ready
          </p>
        </div>
        <button className="action-btn primary" onClick={openAdd}>
          <span className="material-icons">add</span>
          Agregar Mayorista
        </button>
      </div>

      {msg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 16,
          background: msg.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: msg.type === 'error' ? '#991b1b' : '#166534',
          fontSize: 14,
          fontWeight: 500
        }}>
          {msg.text}
        </div>
      )}

      {clients.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#f8fafc',
          borderRadius: 12,
          border: '2px dashed #e2e8f0'
        }}>
          <span className="material-icons" style={{ fontSize: 48, color: '#94a3b8', display: 'block', marginBottom: 12 }}>store</span>
          <p style={{ margin: 0, color: '#64748b', fontSize: 15 }}>No hay mayoristas registrados aún.</p>
          <p style={{ margin: '8px 0 20px', color: '#94a3b8', fontSize: 13 }}>
            Agrega los contactos que tienen "MAY" en su nombre en Pecky/Respond.io
          </p>
          <button className="action-btn primary" onClick={openAdd}>
            <span className="material-icons">add</span>
            Agregar primer mayorista
          </button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#64748b' }}>
            {activeClients.length} activos · {inactiveClients.length} inactivos
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {clients.map(client => (
              <div key={client.id} style={{
                background: client.is_active ? '#fff' : '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '16px',
                opacity: client.is_active ? 1 : 0.6
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <span className="material-icons" style={{ color: '#fff', fontSize: 22 }}>store</span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: '#1e293b' }}>{client.customer_name}</span>
                      {!client.is_active && (
                        <span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 99 }}>Inactivo</span>
                      )}
                      <span style={{
                        fontSize: 11,
                        background: STATUS_COLORS[client.active_order_status] + '22',
                        color: STATUS_COLORS[client.active_order_status],
                        padding: '2px 10px',
                        borderRadius: 99,
                        fontWeight: 600
                      }}>
                        {STATUS_LABELS[client.active_order_status] || 'Sin orden activa'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 6 }}>
                      {client.customer_phone && (
                        <span style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="material-icons" style={{ fontSize: 14 }}>phone</span>
                          {client.customer_phone}
                        </span>
                      )}
                      {client.validated_address && (
                        <span style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="material-icons" style={{ fontSize: 14 }}>location_on</span>
                          {client.validated_address}
                        </span>
                      )}
                      {client.respond_contact_id && (
                        <span style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="material-icons" style={{ fontSize: 14 }}>chat</span>
                          ID Respond: {client.respond_contact_id}
                        </span>
                      )}
                    </div>

                    {client.notes && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                        {client.notes}
                      </div>
                    )}

                    <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
                      {client.pickup_count > 0 && `${client.pickup_count} pick-up(s) totales`}
                      {client.last_pickup_at && ` · Último: ${new Date(client.last_pickup_at).toLocaleDateString('es-MX')}`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {client.is_active && !client.active_order_status && (
                      <button
                        onClick={() => handleDispatchNow(client)}
                        disabled={dispatchingId === client.id}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#22c55e',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <span className="material-icons" style={{ fontSize: 14 }}>local_shipping</span>
                        {dispatchingId === client.id ? 'Enviando...' : 'Despachar'}
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(client)}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748b'
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 16 }}>edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(client)}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        border: '1px solid #fecaca',
                        background: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ef4444'
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 16 }}>delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 24,
            width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18 }}>
              {editingClient ? 'Editar Mayorista' : 'Agregar Mayorista'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                  Nombre completo (tal como aparece en Pecky/Respond.io) *
                </label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="Ej: Arturo -MAY Arzola"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={form.customer_phone}
                  onChange={e => setForm({ ...form, customer_phone: e.target.value })}
                  placeholder="+1 214 000 0000"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                  Dirección de entrega
                </label>
                <input
                  type="text"
                  value={form.validated_address}
                  onChange={e => setForm({ ...form, validated_address: e.target.value })}
                  placeholder="201 Hensley Dr, Grand Prairie, TX 75050"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                  ID de Contacto en Respond.io (opcional)
                </label>
                <input
                  type="text"
                  value={form.respond_contact_id}
                  onChange={e => setForm({ ...form, respond_contact_id: e.target.value })}
                  placeholder="ID del contacto en Pecky/Respond.io"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                  Notas
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Instrucciones especiales de entrega, etc."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {editingClient && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={{ fontSize: 14, color: '#374151' }}>Cliente activo</span>
                </label>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #e2e8f0',
                  background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 2, padding: '11px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600
                }}
              >
                {saving ? 'Guardando...' : editingClient ? 'Guardar Cambios' : 'Agregar Mayorista'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
