import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setFormError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      setFormError('Las contraseñas no coinciden')
      return
    }

    if (formData.password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres')
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
            <img src="/Hormiruta.png" alt="HormiRuta" />
          </div>
          <h1 className="brand-title">HormiRuta</h1>
          <p className="brand-subtitle">Crea tu cuenta para empezar</p>
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
              placeholder="Nombre completo"
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
              placeholder="Correo electrónico"
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
              placeholder="Contraseña (mínimo 6 caracteres)"
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
              placeholder="Confirmar contraseña"
              required
              className="input-pro"
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>

          <div className="divider">
            <span>O continúa con</span>
          </div>

          <button type="button" className="google-btn">
            <img src="/google.png" alt="Google" className="google-icon-img" />
            Continuar con Google
          </button>

          <p className="register-link">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login">Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
