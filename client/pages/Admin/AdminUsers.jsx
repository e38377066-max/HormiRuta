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

  const getRoleLabel = (role) => {
    const labels = { admin: 'Admin', driver: 'Repartidor', client: 'Cliente' }
    return labels[role] || role
  }

  const getInitials = (name, email) => {
    if (name) {
      const parts = name.split(' ')
      return parts.length > 1 
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase()
    }
    return email ? email.substring(0, 2).toUpperCase() : 'U'
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
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

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1>{roleFilter ? `Usuarios (${getRoleLabel(roleFilter)})` : 'Todos los Usuarios'}</h1>
      </div>

      <div className="action-bar">
        <div className="search-box">
          <span className="material-icons">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o email..."
          />
        </div>
        <span className="counter">{filteredUsers.length} usuarios</span>
      </div>

      <div className="content-card">
        <div className="table-container">
          <table className="data-table">
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
                      <div className="avatar">{getInitials(user.name, user.email)}</div>
                      <span>{user.name || 'Sin nombre'}</span>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-tag ${user.role}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td>
                    <span className={`status-tag ${user.isActive !== false ? 'active' : 'inactive'}`}>
                      <span className="status-dot"></span>
                      {user.isActive !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <button className="icon-btn" onClick={() => openEditDialog(user)} title="Editar">
                      <span className="material-icons">edit</span>
                    </button>
                    <button 
                      className={`icon-btn ${user.isActive !== false ? 'danger' : 'success'}`}
                      onClick={() => handleToggleActive(user)}
                      title={user.isActive !== false ? 'Desactivar' : 'Activar'}
                    >
                      <span className="material-icons">{user.isActive !== false ? 'block' : 'check_circle'}</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state small">
                      <span className="material-icons">people_outline</span>
                      <p>No hay usuarios</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showEditDialog && editingUser && (
        <div className="modal-backdrop" onClick={() => setShowEditDialog(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar Usuario</h3>
              <button className="modal-close" onClick={() => setShowEditDialog(false)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={editingUser.name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label>Email</label>
                <input
                  type="text"
                  value={editingUser.email || ''}
                  disabled
                />
              </div>
              <div className="field-group">
                <label>Rol</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                >
                  <option value="client">Cliente</option>
                  <option value="driver">Repartidor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="field-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingUser.isActive !== false}
                    onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.checked })}
                  />
                  <span>Usuario activo</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEditDialog(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveUser} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
