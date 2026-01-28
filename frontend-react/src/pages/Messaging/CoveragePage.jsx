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
    <div className="q-page q-pa-md">
      <div className="page-title-row">
        <button className="q-btn-icon" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <div className="page-title">
          <span className="material-icons">location_on</span>
          Zonas de Cobertura
        </div>
      </div>

      <div className="row-gutter q-mb-md">
        <div className="col-actions">
          <button className="q-btn primary" onClick={() => { resetForm(); setShowAddDialog(true) }}>
            <span className="material-icons">add</span>
            Agregar ZIP Code
          </button>
          <button className="q-btn secondary" onClick={() => setShowBulkDialog(true)}>
            <span className="material-icons">playlist_add</span>
            Agregar Multiples
          </button>
        </div>
        <div className="col-search">
          <div className="search-input-wrapper">
            <span className="material-icons">search</span>
            <input
              type="text"
              className="q-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ZIP code..."
            />
          </div>
        </div>
      </div>

      <div className="q-card">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
          </div>
        ) : (
          <table className="q-table">
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
                  <td>{zone.zip_code || zone.zipCode}</td>
                  <td>{zone.zone_name || '-'}</td>
                  <td>{zone.city || '-'}</td>
                  <td>{zone.state || '-'}</td>
                  <td>{zone.delivery_fee ? `$${zone.delivery_fee}` : '-'}</td>
                  <td>
                    <span className={`q-chip ${zone.is_active !== false ? 'positive' : 'negative'}`}>
                      {zone.is_active !== false ? 'Si' : 'No'}
                    </span>
                  </td>
                  <td>
                    <button className="q-btn-icon" onClick={() => editZone(zone)}>
                      <span className="material-icons">edit</span>
                    </button>
                    <button className="q-btn-icon text-negative" onClick={() => handleDelete(zone)}>
                      <span className="material-icons">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredZones.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No hay zonas de cobertura
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showAddDialog && (
        <div className="modal-overlay" onClick={() => setShowAddDialog(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>{editingZone ? 'Editar Zona' : 'Nueva Zona de Cobertura'}</h3>
            <div className="modal-form">
              <input
                type="text"
                placeholder="Codigo Postal (ZIP)"
                value={zoneForm.zip_code}
                onChange={(e) => setZoneForm({ ...zoneForm, zip_code: e.target.value })}
                className="q-input"
                disabled={!!editingZone}
              />
              <input
                type="text"
                placeholder="Nombre de la zona"
                value={zoneForm.zone_name}
                onChange={(e) => setZoneForm({ ...zoneForm, zone_name: e.target.value })}
                className="q-input"
              />
              <input
                type="text"
                placeholder="Ciudad"
                value={zoneForm.city}
                onChange={(e) => setZoneForm({ ...zoneForm, city: e.target.value })}
                className="q-input"
              />
              <input
                type="text"
                placeholder="Estado"
                value={zoneForm.state}
                onChange={(e) => setZoneForm({ ...zoneForm, state: e.target.value })}
                className="q-input"
              />
              <input
                type="number"
                placeholder="Costo de envio"
                value={zoneForm.delivery_fee}
                onChange={(e) => setZoneForm({ ...zoneForm, delivery_fee: e.target.value })}
                className="q-input"
              />
              <input
                type="number"
                placeholder="Tiempo estimado (minutos)"
                value={zoneForm.estimated_delivery_time}
                onChange={(e) => setZoneForm({ ...zoneForm, estimated_delivery_time: e.target.value })}
                className="q-input"
              />
              <textarea
                placeholder="Notas"
                value={zoneForm.notes}
                onChange={(e) => setZoneForm({ ...zoneForm, notes: e.target.value })}
                className="q-input"
                rows={2}
              />
            </div>
            <div className="modal-actions">
              <button className="q-btn flat" onClick={() => { setShowAddDialog(false); resetForm() }}>Cancelar</button>
              <button className="q-btn primary" onClick={saveZone} disabled={saving}>
                {saving ? 'Guardando...' : editingZone ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkDialog && (
        <div className="modal-overlay" onClick={() => setShowBulkDialog(false)}>
          <div className="modal-card modal-wide" onClick={e => e.stopPropagation()}>
            <h3>Agregar Multiples ZIP Codes</h3>
            <div className="modal-form">
              <textarea
                placeholder="ZIP Codes (uno por linea o separados por coma)"
                value={bulkZipCodes}
                onChange={(e) => setBulkZipCodes(e.target.value)}
                className="q-input"
                rows={6}
              />
              <small className="hint-text">Ejemplo: 33101, 33102, 33103</small>
              <input
                type="text"
                placeholder="Nombre de la zona (opcional)"
                value={bulkZoneName}
                onChange={(e) => setBulkZoneName(e.target.value)}
                className="q-input"
              />
            </div>
            <div className="modal-actions">
              <button className="q-btn flat" onClick={() => setShowBulkDialog(false)}>Cancelar</button>
              <button className="q-btn primary" onClick={addBulkZones} disabled={saving}>
                {saving ? 'Agregando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
