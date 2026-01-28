import { useEffect, useState } from 'react'
import api from '../../api'
import './AdminPages.css'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/admin/users')
      setUsers(response.data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/api/admin/users/${userId}`, { role: newRole })
      fetchUsers()
      setEditingUser(null)
    } catch (error) {
      console.error('Error updating role:', error)
    }
  }

  const getRoleChip = (role) => {
    const classes = {
      admin: 'chip-secondary',
      driver: 'chip-info',
      client: 'chip-primary'
    }
    return <span className={`chip ${classes[role] || 'chip-primary'}`}>{role}</span>
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Gestion de Usuarios</h1>
        <span className="user-count">{users.length} usuarios</span>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.name || '-'}</td>
                <td>{user.email}</td>
                <td>
                  {editingUser === user.id ? (
                    <select 
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      onBlur={() => setEditingUser(null)}
                      autoFocus
                    >
                      <option value="client">client</option>
                      <option value="driver">driver</option>
                      <option value="admin">admin</option>
                    </select>
                  ) : (
                    <span onClick={() => setEditingUser(user.id)} style={{ cursor: 'pointer' }}>
                      {getRoleChip(user.role)}
                    </span>
                  )}
                </td>
                <td>
                  <span className={`chip ${user.isActive ? 'chip-positive' : 'chip-negative'}`}>
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                  <button 
                    className={`btn btn-small ${user.isActive ? 'btn-negative' : 'btn-positive'}`}
                    onClick={() => handleToggleActive(user)}
                  >
                    {user.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
