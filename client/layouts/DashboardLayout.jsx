import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import './DashboardLayout.css'

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

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
          <button className="q-btn-icon" onClick={handleLogout} title={t('nav.logout')}>
            <span className="material-icons">logout</span>
          </button>
        </div>
      </header>

      <aside className={`q-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="q-drawer-backdrop" onClick={() => setDrawerOpen(false)}></div>
        <nav className="q-drawer-content">
          <div className="q-item-label">{t('nav.mainMenu')}</div>
          
          <NavLink to="/dispatch" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="material-icons q-item-icon" style={{color: '#6200ea'}}>local_shipping</span>
            <span>{t('nav.dispatch')}</span>
          </NavLink>

          <NavLink to="/planner" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="material-icons q-item-icon" style={{color: '#1976d2'}}>map</span>
            <span>{t('nav.planRoute')}</span>
          </NavLink>

          <div className="q-separator"></div>
          <div className="q-item-label">{t('nav.messagingCenter')}</div>

          <NavLink to="/messaging" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="material-icons q-item-icon" style={{color: '#4caf50'}}>inbox</span>
            <span>{t('nav.orders')}</span>
          </NavLink>

          <NavLink to="/messaging/coverage" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="material-icons q-item-icon" style={{color: '#2196f3'}}>location_on</span>
            <span>{t('nav.coverageZones')}</span>
          </NavLink>

          <NavLink to="/messaging/settings" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="material-icons q-item-icon" style={{color: '#757575'}}>settings</span>
            <span>{t('nav.respondSettings')}</span>
          </NavLink>

          {isAdmin && (
            <>
              <div className="q-separator"></div>
              <div className="q-item-label">{t('nav.administration')}</div>

              <NavLink to="/admin" end className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
                <span className="material-icons q-item-icon" style={{color: '#673ab7'}}>dashboard</span>
                <span>{t('nav.adminPanel')}</span>
              </NavLink>

              <NavLink to="/admin/users" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
                <span className="material-icons q-item-icon" style={{color: '#673ab7'}}>people</span>
                <span>{t('nav.users')}</span>
              </NavLink>

              <NavLink to="/admin/logs" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
                <span className="material-icons q-item-icon" style={{color: '#673ab7'}}>terminal</span>
                <span>{t('nav.systemLogs')}</span>
              </NavLink>
              <NavLink to="/admin/accounting" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
                <span className="material-icons q-item-icon" style={{color: '#673ab7'}}>receipt_long</span>
                <span>{t('nav.accounting')}</span>
              </NavLink>
              <NavLink to="/admin/returns" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
                <span className="material-icons q-item-icon" style={{color: '#673ab7'}}>assignment_return</span>
                <span>{t('nav.packageReception')}</span>
              </NavLink>
            </>
          )}

          <div className="q-separator"></div>

          <NavLink to="/account" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="material-icons q-item-icon" style={{color: '#607d8b'}}>person</span>
            <span>{t('nav.myAccount')}</span>
          </NavLink>

          <NavLink to="/soporte" className={({ isActive }) => `q-item ${isActive ? 'active' : ''}`} onClick={() => setDrawerOpen(false)}>
            <span className="material-icons q-item-icon" style={{color: '#25d366'}}>support_agent</span>
            <span>{t('nav.support')}</span>
          </NavLink>

          <button className="q-item logout" onClick={handleLogout}>
            <span className="material-icons q-item-icon" style={{color: '#f44336'}}>logout</span>
            <span>{t('nav.logout')}</span>
          </button>
        </nav>
      </aside>

      <main className="q-page-container">
        <Outlet />
      </main>
    </div>
  )
}
