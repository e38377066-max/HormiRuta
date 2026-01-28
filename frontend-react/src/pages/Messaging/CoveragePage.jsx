import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMessaging } from '../../contexts/MessagingContext'
import './MessagingPages.css'

export default function CoveragePage() {
  const navigate = useNavigate()
  const { coverageZones, fetchCoverageZones, createCoverageZone, createCoverageZonesBulk, deleteCoverageZone, updateCoverageZone } = useMessaging()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [editingZone, setEditingZone] = useState(null)
  const [bulkZipCodes, setBulkZipCodes] = useState('')
  const [bulkZoneName, setBulkZoneName] = useState('')
  const [zoneForm, setZoneForm] = useState({
    zip_code: '',
    zone_name: '',
    city: '',
    state: '',
    delivery_fee: '',
    estimated_delivery_time: '',
    notes: ''
  })

  useEffect(() => {
    loadZones()
  }, [])

  const loadZones = async () => {
    setLoading(true)
    try {
      await fetchCoverageZones()
    } finally {
      setLoading(false)
    }
  }

  const filteredZones = coverageZones.filter(z => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (z.zip_code || z.zipCode || '').toLowerCase().includes(query) ||
           (z.zone_name || '').toLowerCase().includes(query) ||
           (z.city || '').toLowerCase().includes(query)
  })

  const resetForm = () => {
    setEditingZone(null)
    setZoneForm({
      zip_code: '',
      zone_name: '',
      city: '',
      state: '',
      delivery_fee: '',
      estimated_delivery_time: '',
      notes: ''
    })
  }

  const editZone = (zone) => {
    setEditingZone(zone)
    setZoneForm({
      zip_code: zone.zip_code || zone.zipCode || '',
      zone_name: zone.zone_name || '',
      city: zone.city || '',
      state: zone.state || '',
      delivery_fee: zone.delivery_fee || '',
      estimated_delivery_time: zone.estimated_delivery_time || '',
      notes: zone.notes || ''
    })
    setShowAddDialog(true)
  }

  const saveZone = async () => {
    if (!zoneForm.zip_code && !editingZone) {
      alert('El ZIP code es requerido')
      return
    }

    setSaving(true)
    try {
      if (editingZone) {
        await updateCoverageZone(editingZone.id, zoneForm)
      } else {
        await createCoverageZone(zoneForm)
      }
      setShowAddDialog(false)
      resetForm()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (zone) => {
    if (!confirm(`Eliminar el ZIP code ${zone.zip_code || zone.zipCode}?`)) return
    try {
      await deleteCoverageZone(zone.id)
    } catch (err) {
      alert('Error al eliminar')
    }
  }

  const addBulkZones = async () => {
    if (!bulkZipCodes.trim()) {
      alert('Ingresa al menos un ZIP code')
      return
    }

    const zipCodes = bulkZipCodes
      .split(/[,\n]/)
      .map(z => z.trim())
      .filter(z => z.length > 0)

    if (zipCodes.length === 0) {
      alert('No se encontraron ZIP codes validos')
      return
    }

    setSaving(true)
    try {
      const result = await createCoverageZonesBulk({
        zip_codes: zipCodes,
        zone_name: bulkZoneName || null
      })
      alert(`${result?.created || zipCodes.length} zonas creadas`)
      setShowBulkDialog(false)
      setBulkZipCodes('')
      setBulkZoneName('')
    } catch (err) {
      alert('Error al crear zonas')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1>Zonas de Cobertura</h1>
      </div>

      <div className="action-bar">
        <button className="btn-primary" onClick={() => { resetForm(); setShowAddDialog(true) }}>
          <span className="material-icons">add</span>
          Agregar ZIP Code
        </button>
        <button className="btn-secondary" onClick={() => setShowBulkDialog(true)}>
          <span className="material-icons">playlist_add</span>
          Agregar Multiples
        </button>
        <div className="search-box">
          <span className="material-icons">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por ZIP code..."
          />
        </div>
      </div>

      <div className="content-card">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ZIP Code</th>
                  <th>Zona</th>
                  <th>Ciudad</th>
                  <th>Estado</th>
                  <th>Costo</th>
                  <th>Activo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredZones.map(zone => (
                  <tr key={zone.id}>
                    <td><strong>{zone.zip_code || zone.zipCode}</strong></td>
                    <td>{zone.zone_name || '-'}</td>
                    <td>{zone.city || '-'}</td>
                    <td>{zone.state || '-'}</td>
                    <td>{zone.delivery_fee ? `$${zone.delivery_fee}` : '-'}</td>
                    <td>
                      <span className={`tag ${zone.is_active !== false ? 'success' : 'danger'}`}>
                        {zone.is_active !== false ? 'Si' : 'No'}
                      </span>
                    </td>
                    <td>
                      <button className="icon-btn" onClick={() => editZone(zone)} title="Editar">
                        <span className="material-icons">edit</span>
                      </button>
                      <button className="icon-btn danger" onClick={() => handleDelete(zone)} title="Eliminar">
                        <span className="material-icons">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredZones.length === 0 && (
                  <tr>
                    <td colSpan="7">
                      <div className="empty-state small">
                        <span className="material-icons">location_off</span>
                        <p>No hay zonas de cobertura</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddDialog && (
        <div className="modal-backdrop" onClick={() => setShowAddDialog(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingZone ? 'Editar Zona' : 'Nueva Zona de Cobertura'}</h3>
              <button className="modal-close" onClick={() => { setShowAddDialog(false); resetForm() }}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>Codigo Postal (ZIP)</label>
                <input
                  type="text"
                  value={zoneForm.zip_code}
                  onChange={(e) => setZoneForm({ ...zoneForm, zip_code: e.target.value })}
                  disabled={!!editingZone}
                />
              </div>
              <div className="field-group">
                <label>Nombre de la zona</label>
                <input
                  type="text"
                  value={zoneForm.zone_name}
                  onChange={(e) => setZoneForm({ ...zoneForm, zone_name: e.target.value })}
                />
              </div>
              <div className="field-row">
                <div className="field-group">
                  <label>Ciudad</label>
                  <input
                    type="text"
                    value={zoneForm.city}
                    onChange={(e) => setZoneForm({ ...zoneForm, city: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label>Estado</label>
                  <input
                    type="text"
                    value={zoneForm.state}
                    onChange={(e) => setZoneForm({ ...zoneForm, state: e.target.value })}
                  />
                </div>
              </div>
              <div className="field-row">
                <div className="field-group">
                  <label>Costo de envio</label>
                  <input
                    type="number"
                    value={zoneForm.delivery_fee}
                    onChange={(e) => setZoneForm({ ...zoneForm, delivery_fee: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label>Tiempo estimado (min)</label>
                  <input
                    type="number"
                    value={zoneForm.estimated_delivery_time}
                    onChange={(e) => setZoneForm({ ...zoneForm, estimated_delivery_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="field-group">
                <label>Notas</label>
                <textarea
                  rows={2}
                  value={zoneForm.notes}
                  onChange={(e) => setZoneForm({ ...zoneForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => { setShowAddDialog(false); resetForm() }}>Cancelar</button>
              <button className="btn-primary" onClick={saveZone} disabled={saving}>
                {saving ? 'Guardando...' : editingZone ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkDialog && (
        <div className="modal-backdrop" onClick={() => setShowBulkDialog(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Agregar Multiples ZIP Codes</h3>
              <button className="modal-close" onClick={() => setShowBulkDialog(false)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>ZIP Codes (uno por linea o separados por coma)</label>
                <textarea
                  rows={6}
                  value={bulkZipCodes}
                  onChange={(e) => setBulkZipCodes(e.target.value)}
                  placeholder="33101, 33102, 33103..."
                />
              </div>
              <div className="field-group">
                <label>Nombre de la zona (opcional)</label>
                <input
                  type="text"
                  value={bulkZoneName}
                  onChange={(e) => setBulkZoneName(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowBulkDialog(false)}>Cancelar</button>
              <button className="btn-primary" onClick={addBulkZones} disabled={saving}>
                {saving ? 'Agregando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
