/**
 * @fileoverview Página de gestión de cuenta del usuario.
 * Muestra información personal, permite cambiar el idioma de la aplicación y eliminar la cuenta permanentemente.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n/index.js'
import './AccountPage.css'

/**
 * Componente AccountPage para la gestión de perfil y preferencias.
 * @returns {JSX.Element}
 */
export default function AccountPage() {
  const { user, deleteAccount } = useAuth()
  const navigate = useNavigate()
  /** @type {[boolean, Function]} Controla la visibilidad del flujo de confirmación de eliminación */
  const [showConfirm, setShowConfirm] = useState(false)
  /** @type {[string, Function]} Texto ingresado para confirmar la eliminación */
  const [confirmText, setConfirmText] = useState('')
  /** @type {[boolean, Function]} Indica si la eliminación está en proceso */
  const [deleting, setDeleting] = useState(false)
  /** @type {[string, Function]} Mensaje de error en la página */
  const [error, setError] = useState('')
  const { t } = useTranslation()

  /** Palabra requerida para confirmar la acción destructiva */
  const confirmWord = t('account.confirmWord')

  /**
   * Maneja la eliminación definitiva de la cuenta del usuario.
   * @async
   */
  const handleDelete = async () => {
    if (confirmText.trim().toUpperCase() !== confirmWord.toUpperCase()) {
      setError(t('account.confirmError'))
      return
    }
    setDeleting(true)
    setError('')
    try {
      await deleteAccount()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.error || t('account.deleteError'))
      setDeleting(false)
    }
  }

  /**
   * Cambia el idioma de la interfaz.
   * @param {string} lang - Código de idioma ('en', 'es').
   */
  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang)
  }

  return (
    <div className="account-page">
      <div className="account-card">
        <h1>{t('account.title')}</h1>

        <section className="account-section">
          <h2>{t('account.personalInfo')}</h2>
          <div className="account-field">
            <label>{t('account.name')}</label>
            <div>{user?.username || '—'}</div>
          </div>
          <div className="account-field">
            <label>{t('account.email')}</label>
            <div>{user?.email || '—'}</div>
          </div>
          <div className="account-field">
            <label>{t('account.phone')}</label>
            <div>{user?.phone || '—'}</div>
          </div>
          <div className="account-field">
            <label>{t('account.role')}</label>
            <div>{user?.role || '—'}</div>
          </div>
        </section>

        <section className="account-section">
          <h2>{t('account.languageLabel')}</h2>
          <div className="language-selector">
            <button
              className={`lang-btn ${i18n.language === 'en' || i18n.language?.startsWith('en') ? 'active' : ''}`}
              onClick={() => handleLanguageChange('en')}
            >
              🇺🇸 {t('account.languageEn')}
            </button>
            <button
              className={`lang-btn ${i18n.language === 'es' || i18n.language?.startsWith('es') ? 'active' : ''}`}
              onClick={() => handleLanguageChange('es')}
            >
              🇲🇽 {t('account.languageEs')}
            </button>
          </div>
        </section>

        <section className="account-section danger-zone">
          <h2>{t('account.dangerZone')}</h2>
          <p
            className="danger-desc"
            dangerouslySetInnerHTML={{ __html: t('account.dangerDesc') }}
          />

          {!showConfirm ? (
            <button
              type="button"
              className="btn-danger"
              onClick={() => setShowConfirm(true)}
            >
              {t('account.deleteAccount')}
            </button>
          ) : (
            <div className="confirm-box">
              <p dangerouslySetInnerHTML={{ __html: t('account.confirmDeletePrompt') }} />
              <input
                type="text"
                value={confirmText}
                onChange={(e) => { setConfirmText(e.target.value); setError('') }}
                placeholder={t('account.confirmPlaceholder')}
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
                  {t('account.cancelDelete')}
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleDelete}
                  disabled={deleting || confirmText.trim().toUpperCase() !== confirmWord.toUpperCase()}
                >
                  {deleting ? t('account.deleting') : t('account.deletePermantly')}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
