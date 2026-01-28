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
      setFormError('Las contrasenas no coinciden')
      return
    }

    if (formData.password.length < 6) {
      setFormError('La contrasena debe tener al menos 6 caracteres')
      return
    }

    const result = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password
    })

    if (result.success) {
      navigate('/dashboard')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <img src="/hormiruta-icon.svg" alt="HormiRuta" />
          <h1>HormiRuta</h1>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <h2>Crear Cuenta</h2>

          {(error || formError) && (
            <div className="alert alert-error">{error || formError}</div>
          )}

          <div className="form-group">
            <label>Nombre completo</label>
            <input
              type="text"
              name="name"
              className="input"
              value={formData.name}
              onChange={handleChange}
              placeholder="Tu nombre"
              required
            />
          </div>

          <div className="form-group">
            <label>Correo electronico</label>
            <input
              type="email"
              name="email"
              className="input"
              value={formData.email}
              onChange={handleChange}
              placeholder="tu@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Contrasena</label>
            <input
              type="password"
              name="password"
              className="input"
              value={formData.password}
              onChange={handleChange}
              placeholder="Minimo 6 caracteres"
              required
            />
          </div>

          <div className="form-group">
            <label>Confirmar contrasena</label>
            <input
              type="password"
              name="confirmPassword"
              className="input"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repite tu contrasena"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Registrando...' : 'Registrarse'}
          </button>

          <p className="auth-link">
            Ya tienes cuenta? <Link to="/login">Inicia sesion</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
