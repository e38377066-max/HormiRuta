import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../api'
import './AdminPages.css'

export default function AdminUsers() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roleFilter = searchParams.get('role')
  
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [roleFilter])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = roleFilter ? { role: roleFilter } : {}
      const response = await api.get('/api/admin/users', { params })
      setUsers(response.data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (u.name || '').toLowerCase().includes(query) ||
           (u.email || '').toLowerCase().includes(query)
  })

  const handleToggleActive = async (user) => {
    try {
      await api.put(`/api/admin/users/${user.id}`, { 
        isActive: !user.isActive 
      })
      fetchUsers()
    } catch (error) {
      console.error('Error updating user:', error)
    }
  }

  const openEditDialog = (user) => {
    setEditingUser({ ...user })
    setShowEditDialog(true)
  }

  const handleSaveUser = async () => {
    if (!editingUser) return
    setSaving(true)
    try {
      await api.put(`/api/admin/users/${editingUser.id}`, {
        name: editingUser.name,
        role: editingUser.role,
        isActive: editingUser.isActive
      })
      fetchUsers()
      setShowEditDialog(false)
    } catch (error) {
      console.error('Error saving user:', error)
    } finally {
      setSaving(false)
    }
  }

  const getRoleBadge = (role) => {
    const colors = {
      admin: 'bg-secondary',
      driver: 'bg-positive',
      client: 'bg-info'
    }
    const labels = {
      admin: 'Admin',
      driver: 'Repartidor',
      client: 'Cliente'
    }
    return <span className={`q-chip ${colors[role] || 'bg-info'}`}>{labels[role] || role}</span>
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="q-page q-pa-md">
        <div className="loading-state"><div className="spinner"></div></div>
      </div>
    )
  }

  return (
    <div className="q-page q-pa-md">
      <div className="page-title-row">
        <button className="q-btn-icon" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <div className="page-title">
          <span className="material-icons">people</span>
          {roleFilter ? `Usuarios (${roleFilter})` : 'Todos los Usuarios'}
        </div>
      </div>

      <div className="row-gutter q-mb-md">
        <div className="col-search">
          <div className="search-input-wrapper">
            <span className="material-icons">search</span>
            <input
              type="text"
              className="q-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o email..."
            />
          </div>
        </div>
        <div className="col-actions">
          <span className="hint-text">{filteredUsers.length} usuarios</span>
        </div>
      </div>

      <div className="q-card">
        <table className="q-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="user-cell">
                    <div className="user-avatar-small">
                      <span className="material-icons">person</span>
                    </div>
                    <span>{user.name || 'Sin nombre'}</span>
                  </div>
                </td>
                <td>{user.email}</td>
                <td>{getRoleBadge(user.role)}</td>
                <td>
                  <span className={`q-chip ${user.isActive !== false ? 'positive' : 'negative'}`}>
                    {user.isActive !== false ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>{formatDate(user.createdAt)}</td>
                <td>
                  <button className="q-btn-icon" onClick={() => openEditDialog(user)}>
                    <span className="material-icons">edit</span>
                  </button>
                  <button 
                    className={`q-btn-icon ${user.isActive !== false ? 'text-negative' : 'text-positive'}`}
                    onClick={() => handleToggleActive(user)}
                  >
                    <span className="material-icons">{user.isActive !== false ? 'block' : 'check_circle'}</span>
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan="6" className="empty-state">No hay usuarios</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showEditDialog && editingUser && (
        <div className="modal-overlay" onClick={() => setShowEditDialog(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Editar Usuario</h3>
            <div className="modal-form">
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  className="q-input"
                  value={editingUser.name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="text"
                  className="q-input"
                  value={editingUser.email || ''}
                  disabled
                />
              </div>
              <div className="form-group">
                <label>Rol</label>
                <select
                  className="q-input"
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                >
                  <option value="client">Cliente</option>
                  <option value="driver">Repartidor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="toggle-row">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={editingUser.isActive !== false}
                    onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                  Usuario activo
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="q-btn flat" onClick={() => setShowEditDialog(false)}>Cancelar</button>
              <button className="q-btn primary" onClick={handleSaveUser} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
