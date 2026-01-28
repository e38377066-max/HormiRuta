import { useEffect, useState } from 'react'
import { useMessaging } from '../../contexts/MessagingContext'
import './MessagingPages.css'

export default function CoveragePage() {
  const { coverageZones, fetchCoverageZones, createCoverageZone, createCoverageZonesBulk, deleteCoverageZone } = useMessaging()
  const [newZip, setNewZip] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkZips, setBulkZips] = useState('')

  useEffect(() => {
    fetchCoverageZones()
  }, [])

  const handleAddZone = async (e) => {
    e.preventDefault()
    if (!newZip.trim()) return

    try {
      await createCoverageZone({ zipCode: newZip.trim() })
      setNewZip('')
    } catch (error) {
      console.error('Error adding zone:', error)
    }
  }

  const handleBulkAdd = async (e) => {
    e.preventDefault()
    if (!bulkZips.trim()) return

    const zips = bulkZips.split(/[\n,;]+/).map(z => z.trim()).filter(z => z)
    if (zips.length === 0) return

    try {
      await createCoverageZonesBulk({ zipCodes: zips })
      setBulkZips('')
      setBulkMode(false)
    } catch (error) {
      console.error('Error bulk adding zones:', error)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('Eliminar esta zona de cobertura?')) {
      try {
        await deleteCoverageZone(id)
      } catch (error) {
        console.error('Error deleting zone:', error)
      }
    }
  }

  return (
    <div className="messaging-page">
      <div className="page-header">
        <h1>Zonas de Cobertura</h1>
        <button 
          className="btn btn-outline"
          onClick={() => setBulkMode(!bulkMode)}
        >
          {bulkMode ? 'Modo Individual' : 'Carga Masiva'}
        </button>
      </div>

      <div className="card p-3 mb-3">
        {bulkMode ? (
          <form onSubmit={handleBulkAdd}>
            <h3>Agregar Multiples Codigos Postales</h3>
            <p className="text-muted">Ingresa los codigos separados por comas, punto y coma o saltos de linea</p>
            <textarea
              className="input"
              rows={5}
              value={bulkZips}
              onChange={(e) => setBulkZips(e.target.value)}
              placeholder="75201, 75202, 75203..."
            />
            <button type="submit" className="btn btn-primary mt-2">
              Agregar Todos
            </button>
          </form>
        ) : (
          <form onSubmit={handleAddZone} className="add-zone-form">
            <input
              type="text"
              className="input"
              value={newZip}
              onChange={(e) => setNewZip(e.target.value)}
              placeholder="Codigo postal (ej: 75201)"
            />
            <button type="submit" className="btn btn-primary">
              Agregar
            </button>
          </form>
        )}
      </div>

      <div className="card">
        <div className="zones-header">
          <span>{coverageZones.length} zonas de cobertura</span>
        </div>
        
        {coverageZones.length === 0 ? (
          <div className="empty-state p-3">
            <span className="empty-icon">📍</span>
            <p>No hay zonas de cobertura configuradas</p>
          </div>
        ) : (
          <div className="zones-grid">
            {coverageZones.map(zone => (
              <div key={zone.id} className="zone-chip">
                <span className="zone-zip">{zone.zipCode}</span>
                <button 
                  className="zone-delete"
                  onClick={() => handleDelete(zone.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
