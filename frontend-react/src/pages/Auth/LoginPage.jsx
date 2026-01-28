import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import './AuthPages.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, loading, error } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(email, password)
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
          <h2>Iniciar Sesion</h2>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label>Correo electronico</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Contrasena</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contrasena"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Cargando...' : 'Entrar'}
          </button>

          <p className="auth-link">
            No tienes cuenta? <Link to="/register">Registrate</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
