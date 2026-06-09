/**
 * @fileoverview Página de gestión de usuarios para administradores.
 * Permite listar, filtrar por rol, buscar, editar perfiles y activar/desactivar cuentas de usuario.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api'
import './AdminPages.css'

/**
 * Componente AdminUsers que gestiona la base de usuarios del sistema.
 * @returns {JSX.Element}
 */
export default function AdminUsers() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  /** Filtro de rol obtenido de la URL (admin, driver, client) */
  const roleFilter = searchParams.get('role')
  const { t } = useTranslation()
  
  /** @type {[Array, Function]} Lista completa de usuarios cargados */
  const [users, setUsers] = useState([])
  /** @type {[boolean, Function]} Indica si se están cargando los usuarios */
  const [loading, setLoading] = useState(true)
  /** @type {[string, Function]} Consulta de búsqueda por nombre o email */
  const [searchQuery, setSearchQuery] = useState('')
  /** @type {[boolean, Function]} Controla la visibilidad del diálogo de edición */
  const [showEditDialog, setShowEditDialog] = useState(false)
  /** @type {[Object|null, Function]} Usuario que se está editando actualmente */
  const [editingUser, setEditingUser] = useState(null)
  /** @type {[boolean, Function]} Indica si se está guardando un cambio */
  const [saving, setSaving] = useState(false)

  /** Recarga la lista cuando cambia el filtro de rol */
  useEffect(() => {
    fetchUsers()
  }, [roleFilter])

  /**
   * Obtiene la lista de usuarios del servidor.
   * @async
   */
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

  /** Usuarios filtrados localmente por la búsqueda de texto */
  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (u.name || u.username || '').toLowerCase().includes(query) ||
           (u.email || '').toLowerCase().includes(query)
  })

  /**
   * Alterna el estado activo/inactivo de un usuario.
   * @async
   * @param {Object} user - El usuario a modificar.
   */
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

  /**
   * Abre el diálogo de edición con los datos del usuario seleccionado.
   * @param {Object} user - El usuario a editar.
   */
  const openEditDialog = (user) => {
    setEditingUser({ ...user, commission_per_stop: user.commission_per_stop ?? '' })
    setShowEditDialog(true)
  }

  /**
   * Guarda los cambios realizados en el perfil del usuario editado.
   * @async
   */
  const handleSaveUser = async () => {
    if (!editingUser) return
    setSaving(true)
    try {
      const payload = {
        username: editingUser.username || editingUser.name,
        role: editingUser.role,
        active: editingUser.active ?? editingUser.isActive
      }
      if (editingUser.role === 'driver') {
        payload.commission_per_stop = editingUser.commission_per_stop !== '' ? parseFloat(editingUser.commission_per_stop) : null
      }
      await api.put(`/api/admin/users/${editingUser.id}`, payload)
      fetchUsers()
      setShowEditDialog(false)
    } catch (error) {
      console.error('Error saving user:', error)
    } finally {
      setSaving(false)
    }
  }

  /** Obtiene la etiqueta traducida del rol */
  const getRoleLabel = (role) => {
    const map = { admin: t('admin.users.roles.admin'), driver: t('admin.users.roles.driver'), client: t('admin.users.roles.client') }
    return map[role] || role
  }

  /** Genera iniciales para el avatar del usuario */
  const getInitials = (name, email) => {
    if (name) {
      const parts = name.split(' ')
      return parts.length > 1 
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase()
    }
    return email ? email.substring(0, 2).toUpperCase() : 'U'
  }

  /** Formatea una fecha de registro */
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' })
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
        <h1>{roleFilter ? t('admin.users.titleFiltered', { role: getRoleLabel(roleFilter) }) : t('admin.users.title')}</h1>
      </div>

      <div className="action-bar">
        <div className="search-box">
          <span className="material-icons">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('admin.users.searchPlaceholder')}
          />
        </div>
        <span className="counter">{t('admin.users.counter', { count: filteredUsers.length })}</span>
      </div>

      <div className="content-card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('admin.users.columns.user')}</th>
                <th>{t('admin.users.columns.email')}</th>
                <th>{t('admin.users.columns.role')}</th>
                <th>{t('admin.users.columns.status')}</th>
                <th>{t('admin.users.columns.registered')}</th>
                <th>{t('admin.users.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <div className="avatar">{getInitials(user.name || user.username, user.email)}</div>
                      <span>{user.name || user.username || t('admin.users.noName')}</span>
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
                      {user.isActive !== false ? t('admin.users.active') : t('admin.users.inactive')}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <button className="icon-btn" onClick={() => openEditDialog(user)} title={t('common.edit')}>
                      <span className="material-icons">edit</span>
                    </button>
                    <button 
                      className={`icon-btn ${user.isActive !== false ? 'danger' : 'success'}`}
                      onClick={() => handleToggleActive(user)}
                      title={user.isActive !== false ? t('admin.users.deactivate') : t('admin.users.activate')}
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
                      <p>{t('admin.users.noUsers')}</p>
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
              <h3>{t('admin.users.editUser')}</h3>
              <button className="modal-close" onClick={() => setShowEditDialog(false)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>{t('admin.users.fieldName')}</label>
                <input
                  type="text"
                  value={editingUser.name || editingUser.username || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label>{t('admin.users.fieldEmail')}</label>
                <input
                  type="text"
                  value={editingUser.email || ''}
                  disabled
                />
              </div>
              <div className="field-group">
                <label>{t('admin.users.fieldRole')}</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                >
                  <option value="client">{t('admin.users.roles.client')}</option>
                  <option value="driver">{t('admin.users.roles.driver')}</option>
                  <option value="admin">{t('admin.users.roles.admin')}</option>
                </select>
              </div>
              <div className="field-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={(editingUser.active ?? editingUser.isActive) !== false}
                    onChange={(e) => setEditingUser({ ...editingUser, active: e.target.checked, isActive: e.target.checked })}
                  />
                  <span>{t('admin.users.fieldActive')}</span>
                </label>
              </div>
              {editingUser.role === 'driver' && (
                <div className="field-group">
                  <label>{t('admin.users.fieldCommission')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={editingUser.commission_per_stop ?? ''}
                    onChange={(e) => setEditingUser({ ...editingUser, commission_per_stop: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEditDialog(false)}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={handleSaveUser} disabled={saving}>
                {saving ? t('admin.users.saving') : t('admin.users.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
