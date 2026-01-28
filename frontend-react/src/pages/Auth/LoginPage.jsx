import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import './AuthPages.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const { login, loading, error } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(email, password)
    if (result.success) {
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email)
      }
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
            <img src="/hormiruta-icon.svg" alt="HormiRuta" />
          </div>
          <h1 className="brand-title">HormiRuta</h1>
          <p className="brand-subtitle">Accede a tu cuenta para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="input-group">
            <span className="input-icon">📧</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              required
              className="input-pro"
            />
          </div>

          <div className="input-group">
            <span className="input-icon">🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              required
              className="input-pro"
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Recordarme</span>
            </label>
            <button type="button" className="forgot-btn">
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Cargando...' : 'Iniciar sesión'}
          </button>

          <div className="divider">
            <span>O continúa con</span>
          </div>

          <button type="button" className="google-btn">
            <span className="google-icon">G</span>
            Continuar con Google
          </button>

          <p className="register-link">
            ¿No tienes cuenta?{' '}
            <Link to="/register">Regístrate aquí</Link>
          </p>
        </form>

        <div className="legal-links">
          <button onClick={() => setShowTerms(true)}>Términos & Condiciones</button>
          <button onClick={() => setShowPrivacy(true)}>Política de Privacidad</button>
        </div>
      </div>

      {showTerms && (
        <div className="modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Términos & Condiciones de Hormiruta</h3>
            <div className="modal-content">
              <p><strong>EMPRESA:</strong> HORMIRUTA (Optimizador de Rutas)</p>
              <p><strong>FECHA:</strong> Octubre 2025</p>
              <h4>A. Disposiciones Generales</h4>
              <p>El acceso y uso de la aplicación móvil "Hormiruta" constituye la aceptación total de estos Términos y Condiciones de Uso.</p>
            </div>
            <button className="modal-close" onClick={() => setShowTerms(false)}>Cerrar</button>
          </div>
        </div>
      )}

      {showPrivacy && (
        <div className="modal-overlay" onClick={() => setShowPrivacy(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Aviso de Privacidad de Hormiruta</h3>
            <div className="modal-content">
              <p><strong>EMPRESA:</strong> HORMIRUTA (Optimizador de Rutas)</p>
              <p>Hormiruta es responsable del tratamiento de sus datos personales.</p>
            </div>
            <button className="modal-close" onClick={() => setShowPrivacy(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
