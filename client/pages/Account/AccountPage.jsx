import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n/index.js'
import './AccountPage.css'

export default function AccountPage() {
  const { user, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const { t } = useTranslation()

  const confirmWord = t('account.confirmWord')

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

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('area862_language', lang)
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
