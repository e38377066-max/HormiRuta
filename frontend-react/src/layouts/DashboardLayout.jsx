import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './DashboardLayout.css'

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="q-layout">
      <header className="q-header">
        <div className="q-toolbar">
          <button className="q-btn-icon" onClick={() => setDrawerOpen(!drawerOpen)}>
            ☰
          </button>
          <div className="q-avatar">
            <img src="/hormiruta-icon.svg" alt="HormiRuta" />
          </div>
          <h1 className="q-toolbar-title">HormiRuta</h1>
          <span className="q-user-email">{user?.email}</span>
          <button className="q-btn-icon" onClick={handleLogout} title="Cerrar sesión">
            🚪
          </button>
        </div>
      </header>

      <aside className={`q-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="q-drawer-backdrop" onClick={() => setDrawerOpen(false)}></div>
        <nav className="q-drawer-content">
          <div className="q-item-label">Menu Principal</div>
          
          <NavLink to="/planner" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="q-item-icon" style={{color: '#1976d2'}}>🗺️</span>
            <span>Planificar Ruta</span>
          </NavLink>

          <div className="q-separator"></div>
          <div className="q-item-label">Centro de Mensajeria</div>

          <NavLink to="/messaging" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="q-item-icon" style={{color: '#4caf50'}}>📥</span>
            <span>Ordenes</span>
          </NavLink>

          <NavLink to="/messaging/coverage" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="q-item-icon" style={{color: '#2196f3'}}>📍</span>
            <span>Zonas de Cobertura</span>
          </NavLink>

          <NavLink to="/messaging/settings" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="q-item-icon" style={{color: '#757575'}}>⚙️</span>
            <span>Configuracion Respond.io</span>
          </NavLink>

          {isAdmin && (
            <>
              <div className="q-separator"></div>
              <div className="q-item-label">Administracion</div>

              <NavLink to="/admin" end className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
                <span className="q-item-icon" style={{color: '#673ab7'}}>📊</span>
                <span>Panel de Admin</span>
              </NavLink>

              <NavLink to="/admin/users" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
                <span className="q-item-icon" style={{color: '#673ab7'}}>👥</span>
                <span>Usuarios</span>
              </NavLink>
            </>
          )}

          <div className="q-separator"></div>

          <button className="q-item logout" onClick={handleLogout}>
            <span className="q-item-icon" style={{color: '#f44336'}}>🚪</span>
            <span>Cerrar Sesion</span>
          </button>
        </nav>
      </aside>

      <main className="q-page-container">
        <Outlet />
      </main>
    </div>
  )
}
