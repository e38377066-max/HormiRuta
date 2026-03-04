import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMessaging } from '../../contexts/MessagingContext'
import api from '../../api'
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
  const [addressSearch, setAddressSearch] = useState('')
  const [addressSearching, setAddressSearching] = useState(false)
  const [addressResult, setAddressResult] = useState(null)
  const [addressError, setAddressError] = useState('')
  const [bulkAddressSearch, setBulkAddressSearch] = useState('')
  const [bulkAddressSearching, setBulkAddressSearching] = useState(false)
  const [bulkAddressResults, setBulkAddressResults] = useState([])
  const [bulkAddressError, setBulkAddressError] = useState('')
  const [zoneForm, setZoneForm] = useState({
    zip_code: '',
    zone_name: '',
    city: '',
    state: '',
    delivery_fee: '',
    estimated_delivery_time: '',
    notes: ''
  })
  const [loadingZipInfo, setLoadingZipInfo] = useState(false)
  const [sortField, setSortField] = useState('zip_code')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => {
    loadZones()
  }, [])

  const geocodeAddress = async (address) => {
    const response = await api.post('/api/messaging/geocode-address', { address })
    return response.data
  }

  const handleAddressSearch = async () => {
    if (!addressSearch.trim()) return
    setAddressSearching(true)
    setAddressError('')
    setAddressResult(null)
    try {
      const result = await geocodeAddress(addressSearch)
      setAddressResult(result)
    } catch (err) {
      setAddressError(err.response?.data?.error || 'Direccion no encontrada')
    } finally {
      setAddressSearching(false)
    }
  }

  const applyAddressResult = () => {
    if (!addressResult) return
    setZoneForm(prev => ({
      ...prev,
      zip_code: addressResult.zip || prev.zip_code,
      city: addressResult.city || prev.city,
      state: addressResult.state || prev.state,
      zone_name: prev.zone_name || addressResult.city || ''
    }))
    setAddressResult(null)
    setAddressSearch('')
  }

  const handleBulkAddressSearch = async () => {
    if (!bulkAddressSearch.trim()) return
    setBulkAddressSearching(true)
    setBulkAddressError('')
    try {
      const result = await geocodeAddress(bulkAddressSearch)
      if (result.zip) {
        const alreadyAdded = bulkAddressResults.some(r => r.zip === result.zip)
        if (!alreadyAdded) {
          setBulkAddressResults(prev => [...prev, result])
          const currentZips = bulkZipCodes.split(/[,\n]/).map(z => z.trim()).filter(z => z.length > 0)
          if (!currentZips.includes(result.zip)) {
            setBulkZipCodes(prev => prev ? prev + '\n' + result.zip : result.zip)
          }
        } else {
          setBulkAddressError('Este ZIP ya fue agregado')
        }
      } else {
        setBulkAddressError('No se encontro ZIP code para esta direccion')
      }
      setBulkAddressSearch('')
    } catch (err) {
      setBulkAddressError(err.response?.data?.error || 'Direccion no encontrada')
    } finally {
      setBulkAddressSearching(false)
    }
  }

  const removeBulkAddressResult = (zip) => {
    setBulkAddressResults(prev => prev.filter(r => r.zip !== zip))
    const currentZips = bulkZipCodes.split(/[,\n]/).map(z => z.trim()).filter(z => z.length > 0 && z !== zip)
    setBulkZipCodes(currentZips.join('\n'))
  }

  const fetchZipInfo = async (zipCode) => {
    if (!zipCode || zipCode.length !== 5 || !/^\d{5}$/.test(zipCode)) return
    
    setLoadingZipInfo(true)
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`)
      if (response.ok) {
        const data = await response.json()
        if (data.places && data.places.length > 0) {
          const place = data.places[0]
          setZoneForm(prev => ({
            ...prev,
            city: place['place name'] || '',
            state: place['state abbreviation'] || '',
            zone_name: prev.zone_name || place['place name'] || ''
          }))
        }
      }
    } catch (error) {
      console.log('Could not fetch ZIP info:', error)
    } finally {
      setLoadingZipInfo(false)
    }
  }

  const handleZipChange = (e) => {
    const value = e.target.value
    setZoneForm({ ...zoneForm, zip_code: value })
    if (value.length === 5 && /^\d{5}$/.test(value)) {
      fetchZipInfo(value)
    }
  }

  const loadZones = async () => {
    setLoading(true)
    try {
      await fetchCoverageZones()
    } finally {
      setLoading(false)
    }
  }

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const filteredZones = coverageZones.filter(z => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (z.zip_code || z.zipCode || '').toLowerCase().includes(query) ||
           (z.zone_name || '').toLowerCase().includes(query) ||
           (z.city || '').toLowerCase().includes(query) ||
           (z.state || '').toLowerCase().includes(query)
  }).sort((a, b) => {
    let valA = '', valB = ''
    if (sortField === 'zip_code') {
      valA = a.zip_code || a.zipCode || ''
      valB = b.zip_code || b.zipCode || ''
    } else if (sortField === 'zone_name') {
      valA = a.zone_name || ''
      valB = b.zone_name || ''
    } else if (sortField === 'city') {
      valA = a.city || ''
      valB = b.city || ''
    } else if (sortField === 'state') {
      valA = a.state || ''
      valB = b.state || ''
    } else if (sortField === 'delivery_fee') {
      valA = parseFloat(a.delivery_fee) || 0
      valB = parseFloat(b.delivery_fee) || 0
      return sortDir === 'asc' ? valA - valB : valB - valA
    }
    const cmp = valA.toString().localeCompare(valB.toString())
    return sortDir === 'asc' ? cmp : -cmp
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
    setAddressSearch('')
    setAddressResult(null)
    setAddressError('')
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
      setBulkAddressResults([])
      setBulkAddressSearch('')
      setBulkAddressError('')
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
                  <th onClick={() => toggleSort('zip_code')} style={{cursor: 'pointer', userSelect: 'none'}}>
                    ZIP Code {sortField === 'zip_code' && <span className="material-icons" style={{fontSize: '14px', verticalAlign: 'middle'}}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                  </th>
                  <th onClick={() => toggleSort('zone_name')} style={{cursor: 'pointer', userSelect: 'none'}}>
                    Zona {sortField === 'zone_name' && <span className="material-icons" style={{fontSize: '14px', verticalAlign: 'middle'}}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                  </th>
                  <th onClick={() => toggleSort('city')} style={{cursor: 'pointer', userSelect: 'none'}}>
                    Ciudad {sortField === 'city' && <span className="material-icons" style={{fontSize: '14px', verticalAlign: 'middle'}}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                  </th>
                  <th onClick={() => toggleSort('state')} style={{cursor: 'pointer', userSelect: 'none'}}>
                    Estado {sortField === 'state' && <span className="material-icons" style={{fontSize: '14px', verticalAlign: 'middle'}}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                  </th>
                  <th onClick={() => toggleSort('delivery_fee')} style={{cursor: 'pointer', userSelect: 'none'}}>
                    Costo {sortField === 'delivery_fee' && <span className="material-icons" style={{fontSize: '14px', verticalAlign: 'middle'}}>{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                  </th>
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
              {!editingZone && (
                <div className="field-group" style={{background: '#f0f4ff', padding: '12px', borderRadius: '8px', marginBottom: '16px'}}>
                  <label style={{fontWeight: 600}}>
                    <span className="material-icons" style={{fontSize: '16px', verticalAlign: 'middle', marginRight: '4px'}}>search</span>
                    Buscar por direccion
                  </label>
                  <div style={{display: 'flex', gap: '8px', marginTop: '6px'}}>
                    <input
                      type="text"
                      value={addressSearch}
                      onChange={(e) => setAddressSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                      placeholder="Ej: 1234 Main St, Miami FL"
                      style={{flex: 1}}
                    />
                    <button className="btn-primary" onClick={handleAddressSearch} disabled={addressSearching} style={{whiteSpace: 'nowrap'}}>
                      {addressSearching ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                  {addressError && (
                    <p style={{color: '#f44336', fontSize: '12px', marginTop: '6px', marginBottom: 0}}>{addressError}</p>
                  )}
                  {addressResult && (
                    <div style={{marginTop: '8px', padding: '10px', background: '#fff', borderRadius: '6px', border: '1px solid #c8d6e5'}}>
                      <div style={{fontSize: '13px', marginBottom: '6px'}}>
                        <strong>{addressResult.address}</strong>
                      </div>
                      <div style={{fontSize: '12px', color: '#555', display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                        <span>ZIP: <strong>{addressResult.zip}</strong></span>
                        <span>Ciudad: <strong>{addressResult.city}</strong></span>
                        <span>Estado: <strong>{addressResult.state}</strong></span>
                      </div>
                      <button className="btn-success" onClick={applyAddressResult} style={{marginTop: '8px', padding: '6px 14px', fontSize: '12px'}}>
                        <span className="material-icons" style={{fontSize: '14px'}}>check</span>
                        Usar estos datos
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="field-group">
                <label>Codigo Postal (ZIP) {loadingZipInfo && <span style={{fontSize: '12px', color: '#6366f1'}}>(buscando...)</span>}</label>
                <input
                  type="text"
                  value={zoneForm.zip_code}
                  onChange={handleZipChange}
                  disabled={!!editingZone}
                  placeholder="Ingresa 5 digitos para autocompletar"
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
              <div className="field-group" style={{background: '#f0f4ff', padding: '12px', borderRadius: '8px', marginBottom: '16px'}}>
                <label style={{fontWeight: 600}}>
                  <span className="material-icons" style={{fontSize: '16px', verticalAlign: 'middle', marginRight: '4px'}}>search</span>
                  Buscar direccion para obtener ZIP
                </label>
                <div style={{display: 'flex', gap: '8px', marginTop: '6px'}}>
                  <input
                    type="text"
                    value={bulkAddressSearch}
                    onChange={(e) => setBulkAddressSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBulkAddressSearch()}
                    placeholder="Ej: 1234 Main St, Miami FL"
                    style={{flex: 1}}
                  />
                  <button className="btn-primary" onClick={handleBulkAddressSearch} disabled={bulkAddressSearching} style={{whiteSpace: 'nowrap'}}>
                    {bulkAddressSearching ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                {bulkAddressError && (
                  <p style={{color: '#f44336', fontSize: '12px', marginTop: '6px', marginBottom: 0}}>{bulkAddressError}</p>
                )}
                {bulkAddressResults.length > 0 && (
                  <div style={{marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px'}}>
                    {bulkAddressResults.map((r, i) => (
                      <div key={i} style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#fff', borderRadius: '6px', border: '1px solid #c8d6e5', fontSize: '12px'}}>
                        <span style={{flex: 1}}>
                          <strong>{r.zip}</strong> - {r.city}, {r.state}
                        </span>
                        <button onClick={() => removeBulkAddressResult(r.zip)} style={{background: 'none', border: 'none', cursor: 'pointer', color: '#f44336', padding: '2px'}}>
                          <span className="material-icons" style={{fontSize: '16px'}}>close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
