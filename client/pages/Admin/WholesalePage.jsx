/**
 * @fileoverview Página de gestión de clientes mayoristas (Wholesale).
 * Permite registrar clientes frecuentes, gestionar sus direcciones validadas,
 * consultar sus órdenes activas y disparar despachos directos.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api'
import './AdminPages.css'

/** Mapeo de estados de órdenes a claves de traducción */
const STATUS_LABELS_KEY = {
  pickup_ready: 'wholesale.status.pickupReady',
  on_delivery: 'wholesale.status.onDelivery',
  ordered: 'wholesale.status.ordered',
  null: 'wholesale.status.noOrder'
}

/** Colores visuales para los estados de órdenes */
const STATUS_COLORS = {
  pickup_ready: '#22c55e',
  on_delivery: '#f59e0b',
  ordered: '#3b82f6',
  null: '#6b7280'
}

/**
 * Componente que muestra un badge con el estado de las órdenes activas del cliente.
 * @param {Object} props
 * @param {Object} props.client - Objeto del cliente con info de órdenes.
 * @returns {JSX.Element}
 */
function ActiveOrdersBadge({ client }) {
  const { t } = useTranslation()
  const count = client.active_orders_count || 0
  if (count === 0) {
    return (
      <span style={{ fontSize: 11, background: '#f1f5f9', color: '#6b7280', padding: '2px 10px', borderRadius: 99, fontWeight: 600 }}>
        {t('wholesale.noActiveOrders')}
      </span>
    )
  }
  if (count === 1) {
    const s = client.active_orders[0]?.order_status
    return (
      <span style={{ fontSize: 11, background: (STATUS_COLORS[s] || '#6b7280') + '22', color: STATUS_COLORS[s] || '#6b7280', padding: '2px 10px', borderRadius: 99, fontWeight: 600 }}>
        {t(STATUS_LABELS_KEY[s] || 'wholesale.status.unknown')}
      </span>
    )
  }
  return (
    <span style={{ fontSize: 11, background: '#7c3aed22', color: '#7c3aed', padding: '2px 10px', borderRadius: 99, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span className="material-icons" style={{ fontSize: 12 }}>layers</span>
      {count} {t('wholesale.activeOrders')}
    </span>
  )
}

/**
 * Componente principal WholesalePage para la gestión de clientes recurrentes.
 * @returns {JSX.Element}
 */
export default function WholesalePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  /** @type {[Array, Function]} Lista de clientes mayoristas */
  const [clients, setClients] = useState([])
  /** @type {[boolean, Function]} Indica si se están cargando los clientes */
  const [loading, setLoading] = useState(true)
  /** @type {[boolean, Function]} Controla la visibilidad del formulario de cliente */
  const [showForm, setShowForm] = useState(false)
  /** @type {[Object|null, Function]} Cliente que se está editando */
  const [editingClient, setEditingClient] = useState(null)
  /** @type {[boolean, Function]} Indica si se está guardando un cambio */
  const [saving, setSaving] = useState(false)
  /** @type {[number|null, Function]} ID del cliente para el que se está creando una orden manual */
  const [dispatchingId, setDispatchingId] = useState(null)
  /** @type {[Object|null, Function]} Mensaje de notificación temporal */
  const [msg, setMsg] = useState(null)

  /** Estructura inicial del formulario de cliente */
  const emptyForm = { customer_name: '', customer_phone: '', validated_address: '', respond_contact_id: '', notes: '', is_active: true }
  const [form, setForm] = useState(emptyForm)

  /** Carga inicial */
  useEffect(() => { fetchClients() }, [])

  /** Obtiene la lista de clientes del backend */
  const fetchClients = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/wholesale')
      setClients(res.data.clients || [])
    } catch (err) {
      console.error('Error loading wholesale clients:', err)
    } finally {
      setLoading(false)
    }
  }

  /** Muestra un mensaje de éxito o error temporal */
  const showMsg = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  const openAdd = () => { setEditingClient(null); setForm(emptyForm); setShowForm(true) }

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

  /** Guarda los datos del cliente */
  const handleSave = async () => {
    if (!form.customer_name.trim()) { showMsg(t('wholesale.nameRequired'), 'error'); return }
    setSaving(true)
    try {
      if (editingClient) {
        await api.put(`/api/wholesale/${editingClient.id}`, form)
        showMsg(`${t('wholesale.clientUpdated')}: "${form.customer_name}"`)
      } else {
        await api.post('/api/wholesale', form)
        showMsg(`${t('wholesale.clientCreated')}: "${form.customer_name}"`)
      }
      setShowForm(false)
      fetchClients()
    } catch (err) {
      showMsg(err.response?.data?.error || t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  /** Elimina un registro de cliente mayorista */
  const handleDelete = async (client) => {
    if (!window.confirm(`${t('wholesale.confirmDelete')} "${client.customer_name}"?`)) return
    try {
      await api.delete(`/api/wholesale/${client.id}`)
      showMsg(`${t('wholesale.clientDeleted')}: "${client.customer_name}"`)
      fetchClients()
    } catch (err) {
      showMsg(err.response?.data?.error || t('common.error'), 'error')
    }
  }

  /** Crea una nueva orden de despacho de forma inmediata para el cliente */
  const handleDispatchNow = async (client) => {
    if (!client.validated_address) { showMsg(t('wholesale.noAddress'), 'error'); return }
    const count = client.active_orders_count || 0
    const confirmMsg = count > 0
      ? `"${client.customer_name}" ${t('wholesale.hasActiveOrders', { count })}. ${t('wholesale.addAnother')}`
      : `${t('wholesale.confirmDispatch')} "${client.customer_name}"?`
    if (!window.confirm(confirmMsg)) return
    setDispatchingId(client.id)
    try {
      await api.post(`/api/wholesale/${client.id}/dispatch-now`)
      showMsg(`"${client.customer_name}" ${t('wholesale.addedToDispatch')}`)
      fetchClients()
    } catch (err) {
      showMsg(err.response?.data?.error || t('common.error'), 'error')
    } finally {
      setDispatchingId(null)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container"><div className="spinner"></div></div>
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
          <h1>{t('wholesale.title')}</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{t('wholesale.subtitle')}</p>
        </div>
        <button className="action-btn primary" onClick={openAdd} title={t('wholesale.addManualTooltip')}>
          <span className="material-icons">add</span>
          {t('wholesale.addManual')}
        </button>
      </div>

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, background: msg.type === 'error' ? '#fee2e2' : '#dcfce7', color: msg.type === 'error' ? '#991b1b' : '#166534', fontSize: 14, fontWeight: 500 }}>
          {msg.text}
        </div>
      )}

      {clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: 12, border: '2px dashed #e2e8f0' }}>
          <span className="material-icons" style={{ fontSize: 48, color: '#94a3b8', display: 'block', marginBottom: 12 }}>store</span>
          <p style={{ margin: 0, color: '#64748b', fontSize: 15 }}>{t('wholesale.noClients')}</p>
          <p style={{ margin: '8px 0 20px', color: '#94a3b8', fontSize: 13 }}>{t('wholesale.noClientsHint')}</p>
          <button className="action-btn primary" onClick={openAdd}>
            <span className="material-icons">add</span>
            {t('wholesale.addManual')}
          </button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#64748b' }}>
            {activeClients.length} {t('wholesale.active')} · {inactiveClients.length} {t('wholesale.inactive')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {clients.map(client => (
              <div key={client.id} style={{ background: client.is_active ? '#fff' : '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', opacity: client.is_active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-icons" style={{ color: '#fff', fontSize: 22 }}>store</span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: '#1e293b' }}>{client.customer_name}</span>
                      {!client.is_active && (
                        <span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 99 }}>{t('wholesale.inactiveLabel')}</span>
                      )}
                      <ActiveOrdersBadge client={client} />
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 6 }}>
                      {client.customer_phone && (
                        <span style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="material-icons" style={{ fontSize: 14 }}>phone</span>{client.customer_phone}
                        </span>
                      )}
                      {client.validated_address && (
                        <span style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="material-icons" style={{ fontSize: 14 }}>location_on</span>{client.validated_address}
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
                      <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>{client.notes}</div>
                    )}

                    <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
                      {client.pickup_count > 0 && `${client.pickup_count} pick-up(s) ${t('wholesale.total')}`}
                      {client.last_pickup_at && ` · ${t('wholesale.last')}: ${new Date(client.last_pickup_at).toLocaleDateString()}`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {client.is_active && (
                      <button
                        onClick={() => handleDispatchNow(client)}
                        disabled={dispatchingId === client.id || !client.validated_address}
                        title={!client.validated_address ? t('wholesale.noAddressTooltip') : t('wholesale.addOrderTooltip')}
                        style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: (client.active_orders_count || 0) > 0 ? '#7c3aed' : '#22c55e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: client.validated_address ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4, opacity: client.validated_address ? 1 : 0.5 }}
                      >
                        <span className="material-icons" style={{ fontSize: 14 }}>add_box</span>
                        {dispatchingId === client.id ? t('wholesale.sending') : t('wholesale.newOrder')}
                      </button>
                    )}
                    <button onClick={() => openEdit(client)} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                      <span className="material-icons" style={{ fontSize: 16 }}>edit</span>
                    </button>
                    <button onClick={() => handleDelete(client)} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #fecaca', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18 }}>
              {editingClient ? t('wholesale.form.editTitle') : t('wholesale.form.addTitle')}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                  {t('wholesale.form.name')} *
                </label>
                <input type="text" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  placeholder={t('wholesale.form.namePlaceholder')}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{t('wholesale.form.phone')}</label>
                <input type="tel" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })}
                  placeholder="+1 214 000 0000"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{t('wholesale.form.address')}</label>
                <input type="text" value={form.validated_address} onChange={e => setForm({ ...form, validated_address: e.target.value })}
                  placeholder="201 Hensley Dr, Grand Prairie, TX 75050"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{t('wholesale.form.respondId')}</label>
                <input type="text" value={form.respond_contact_id} onChange={e => setForm({ ...form, respond_contact_id: e.target.value })}
                  placeholder={t('wholesale.form.respondIdPlaceholder')}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{t('wholesale.form.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder={t('wholesale.form.notesPlaceholder')} rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              {editingClient && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} style={{ width: 18, height: 18 }} />
                  <span style={{ fontSize: 14, color: '#374151' }}>{t('wholesale.form.active')}</span>
                </label>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                {t('common.cancel')}
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {saving ? t('common.saving') : editingClient ? t('common.saveChanges') : t('wholesale.form.addBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
