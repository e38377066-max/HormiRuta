import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './DashboardLayout.css'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const menuItems = [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/messaging/orders', icon: '📦', label: 'Ordenes' },
    { to: '/messaging/coverage', icon: '📍', label: 'Zonas de Cobertura' },
    { to: '/messaging/settings', icon: '⚙️', label: 'Configuracion' },
  ]

  if (isAdmin) {
    menuItems.push({ to: '/admin', icon: '👑', label: 'Admin Panel' })
    menuItems.push({ to: '/admin/users', icon: '👥', label: 'Usuarios' })
  }

  menuItems.push({ to: '/planner', icon: '🗺️', label: 'Planificador' })

  return (
    <div className="dashboard-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <img src="/hormiruta-icon.svg" alt="HormiRuta" className="logo" />
          {sidebarOpen && <span className="brand">HormiRuta</span>}
        </div>

        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {sidebarOpen && (
            <div className="user-info">
              <span className="user-name">{user?.name || user?.email}</span>
              <span className="user-role">{user?.role}</span>
            </div>
          )}
          <button className="logout-btn" onClick={handleLogout}>
            🚪 {sidebarOpen && 'Salir'}
          </button>
        </div>
      </aside>

      <button 
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? '◀' : '▶'}
      </button>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
