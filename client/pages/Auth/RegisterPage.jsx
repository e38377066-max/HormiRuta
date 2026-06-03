import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import './AuthPages.css'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const { register, loading, error } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setFormError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      setFormError(t('auth.passwordsNoMatch'))
      return
    }

    if (formData.password.length < 6) {
      setFormError(t('auth.passwordTooShort'))
      return
    }

    const result = await register({
      username: formData.name,
      email: formData.email,
      password: formData.password
    })

    if (result.success) {
      navigate('/planner')
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
          <p className="brand-subtitle">{t('auth.registerSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {(error || formError) && (
            <div className="alert alert-error">{error || formError}</div>
          )}

          <div className="input-group">
            <span className="material-icons input-icon">person</span>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={t('auth.fullNamePlaceholder')}
              required
              className="input-pro"
            />
          </div>

          <div className="input-group">
            <span className="material-icons input-icon">email</span>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={t('auth.emailPlaceholder')}
              required
              className="input-pro"
            />
          </div>

          <div className="input-group">
            <span className="material-icons input-icon">lock</span>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={t('auth.passwordMinLength')}
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

          <div className="input-group">
            <span className="material-icons input-icon">lock</span>
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              required
              className="input-pro"
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? t('auth.registering') : t('auth.createAccount')}
          </button>

          <p className="register-link">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link to="/login">{t('auth.signInLink')}</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
