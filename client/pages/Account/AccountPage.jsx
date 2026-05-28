import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import './AccountPage.css'

export default function AccountPage() {
  const { user, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    if (confirmText.trim().toUpperCase() !== 'ELIMINAR') {
      setError('Escribe ELIMINAR para confirmar')
      return
    }
    setDeleting(true)
    setError('')
    try {
      await deleteAccount()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.error || 'Error al eliminar la cuenta. Intenta de nuevo.')
      setDeleting(false)
    }
  }

  return (
    <div className="account-page">
      <div className="account-card">
        <h1>Mi cuenta</h1>

        <section className="account-section">
          <h2>Información personal</h2>
          <div className="account-field">
            <label>Nombre</label>
            <div>{user?.username || '—'}</div>
          </div>
          <div className="account-field">
            <label>Email</label>
            <div>{user?.email || '—'}</div>
          </div>
          <div className="account-field">
            <label>Teléfono</label>
            <div>{user?.phone || '—'}</div>
          </div>
          <div className="account-field">
            <label>Rol</label>
            <div>{user?.role || 'usuario'}</div>
          </div>
        </section>

        <section className="account-section danger-zone">
          <h2>Zona de peligro</h2>
          <p className="danger-desc">
            Al eliminar tu cuenta se borrarán <strong>permanentemente</strong> tus datos personales,
            rutas, paradas, historial de entregas, conversaciones, configuración y cualquier otro
            dato asociado a tu cuenta. Esta acción <strong>no se puede deshacer</strong>.
          </p>

          {!showConfirm ? (
            <button
              type="button"
              className="btn-danger"
              onClick={() => setShowConfirm(true)}
            >
              Eliminar mi cuenta
            </button>
          ) : (
            <div className="confirm-box">
              <p>Para confirmar, escribe <strong>ELIMINAR</strong> en el campo de abajo:</p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => { setConfirmText(e.target.value); setError('') }}
                placeholder="ELIMINAR"
                className="confirm-input"
                autoFocus
                disabled={deleting}
              />
              {error && <div className="confirm-error">{error}</div>}
              <div className="confirm-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setShowConfirm(false); setConfirmText(''); setError('') }}
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleDelete}
                  disabled={deleting || confirmText.trim().toUpperCase() !== 'ELIMINAR'}
                >
                  {deleting ? 'Eliminando...' : 'Eliminar permanentemente'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
