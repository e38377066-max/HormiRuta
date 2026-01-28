import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './PlannerLayout.css'

export default function PlannerLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="planner-layout">
      <header className="planner-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>
        <h1 className="planner-title">HormiRuta</h1>
        <div className="header-actions">
          <span className="user-email">{user?.email}</span>
          <button className="logout-btn-small" onClick={handleLogout}>🚪</button>
        </div>
      </header>
      <main className="planner-content">
        <Outlet />
      </main>
    </div>
  )
}
