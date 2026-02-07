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
            <span className="material-icons">menu</span>
          </button>
          <div className="q-avatar">
            <img src="/Area862.png" alt="Area 862" />
          </div>
          <h1 className="q-toolbar-title">Area 862</h1>
          <span className="q-user-email">{user?.email}</span>
          <button className="q-btn-icon" onClick={handleLogout} title="Cerrar sesión">
            <span className="material-icons">logout</span>
          </button>
        </div>
      </header>

      <aside className={`q-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="q-drawer-backdrop" onClick={() => setDrawerOpen(false)}></div>
        <nav className="q-drawer-content">
          <div className="q-item-label">Menu Principal</div>
          
          <NavLink to="/planner" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="material-icons q-item-icon" style={{color: '#1976d2'}}>map</span>
            <span>Planificar Ruta</span>
          </NavLink>

          <div className="q-separator"></div>
          <div className="q-item-label">Centro de Mensajeria</div>

          <NavLink to="/messaging" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="material-icons q-item-icon" style={{color: '#4caf50'}}>inbox</span>
            <span>Ordenes</span>
          </NavLink>

          <NavLink to="/messaging/coverage" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="material-icons q-item-icon" style={{color: '#2196f3'}}>location_on</span>
            <span>Zonas de Cobertura</span>
          </NavLink>

          <NavLink to="/messaging/settings" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="material-icons q-item-icon" style={{color: '#757575'}}>settings</span>
            <span>Configuracion Respond.io</span>
          </NavLink>

          {isAdmin && (
            <>
              <div className="q-separator"></div>
              <div className="q-item-label">Administracion</div>

              <NavLink to="/admin" end className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
                <span className="material-icons q-item-icon" style={{color: '#673ab7'}}>dashboard</span>
                <span>Panel de Admin</span>
              </NavLink>

              <NavLink to="/admin/users" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
                <span className="material-icons q-item-icon" style={{color: '#673ab7'}}>people</span>
                <span>Usuarios</span>
              </NavLink>
            </>
          )}

          <div className="q-separator"></div>

          <button className="q-item logout" onClick={handleLogout}>
            <span className="material-icons q-item-icon" style={{color: '#f44336'}}>logout</span>
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
