import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import './AuthPages.css'

const REMEMBER_EMAIL_KEY = 'rem_email'
const REMEMBER_PASS_KEY  = 'rem_pass'
const REMEMBER_FLAG_KEY  = 'rem_on'

export default function LoginPage() {
  const remembered = localStorage.getItem(REMEMBER_FLAG_KEY) === '1'
  const [email,       setEmail]       = useState(remembered ? (localStorage.getItem(REMEMBER_EMAIL_KEY) || '') : '')
  const [password,    setPassword]    = useState(remembered ? (localStorage.getItem(REMEMBER_PASS_KEY)  || '') : '')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe,  setRememberMe]  = useState(remembered)
  const [showTerms,   setShowTerms]   = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const { login, loading, error } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(email, password)
    if (result.success) {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_FLAG_KEY,  '1')
        localStorage.setItem(REMEMBER_EMAIL_KEY, email)
        localStorage.setItem(REMEMBER_PASS_KEY,  password)
      } else {
        localStorage.removeItem(REMEMBER_FLAG_KEY)
        localStorage.removeItem(REMEMBER_EMAIL_KEY)
        localStorage.removeItem(REMEMBER_PASS_KEY)
      }
      const role = result.user?.role
      navigate(role === 'admin' ? '/messaging' : '/planner')
    }
  }

  return (
    <div className="bg-page">
      <div className="circle circle1"></div>
      <div className="circle circle2"></div>
      <div className="circle circle3"></div>

      <div className="login-card">
        <div className="text-center q-mb-lg">
          <div className="logo-avatar">
            <img src="/Area862.png" alt="Area 862" />
          </div>
          <h1 className="brand-title">Area 862</h1>
          <p className="brand-subtitle">{t('auth.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="input-group">
            <span className="material-icons input-icon">email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              required
              className="input-pro"
            />
          </div>

          <div className="input-group">
            <span className="material-icons input-icon">lock</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              required
              className="input-pro"
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              <span className="material-icons">{showPassword ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>{t('auth.rememberMe')}</span>
            </label>
            <button type="button" className="forgot-btn">
              {t('auth.forgotPassword')}
            </button>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>

          <p className="register-link">
            {t('auth.noAccount')}{' '}
            <Link to="/register">{t('auth.registerHere')}</Link>
          </p>
        </form>

        <div className="legal-links">
          <button onClick={() => setShowTerms(true)}>{t('auth.terms')}</button>
          <button onClick={() => setShowPrivacy(true)}>{t('auth.privacy')}</button>
        </div>
      </div>

      {showTerms && (
        <div className="modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>{t('auth.termsTitle')}</h3>
            <div className="modal-content">
              <p><strong>{t('auth.termsCompany')}</strong></p>
              <p><strong>{t('auth.termsDate')}</strong></p>
              <h4>{t('auth.termsSection')}</h4>
              <p>{t('auth.termsBody')}</p>
            </div>
            <button className="modal-close" onClick={() => setShowTerms(false)}>{t('common.close')}</button>
          </div>
        </div>
      )}

      {showPrivacy && (
        <div className="modal-overlay" onClick={() => setShowPrivacy(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>{t('auth.privacyTitle')}</h3>
            <div className="modal-content">
              <p><strong>{t('auth.privacyCompany')}</strong></p>
              <p>{t('auth.privacyBody')}</p>
            </div>
            <button className="modal-close" onClick={() => setShowPrivacy(false)}>{t('common.close')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
