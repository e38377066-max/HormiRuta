import { useState, createContext, useContext } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import './PlannerLayout.css'

const PlannerContext = createContext(null)

export function usePlanner() {
  return useContext(PlannerContext)
}

export default function PlannerLayout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { t } = useTranslation()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const toggleDrawer = () => setDrawerOpen(!drawerOpen)
  const closeDrawer = () => setDrawerOpen(false)

  const menuItems = [
    { icon: 'map', labelKey: 'nav.myRoute', path: '/planner' },
    { icon: 'account_balance_wallet', labelKey: 'nav.myAccounting', path: '/planner/accounting' },
    { icon: 'person', labelKey: 'nav.myAccount', path: '/planner/account' },
    { icon: 'admin_panel_settings', labelKey: 'nav.adminPanel', path: '/messaging', adminOnly: true }
  ]

  const handleSupport = () => {
    window.open('https://wa.me/18622862862', '_blank', 'noopener,noreferrer')
    closeDrawer()
  }

  const contextValue = {
    toggleDrawer,
    closeDrawer,
    drawerOpen
  }

  return (
    <PlannerContext.Provider value={contextValue}>
      <div className="planner-layout">
        <div className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={closeDrawer}></div>
        
        <aside className={`planner-drawer ${drawerOpen ? 'open' : ''}`}>
          <div className="drawer-header">
            <img src="/Area862.png" alt="Area 862" className="drawer-logo" />
            <div className="drawer-brand">Area 862</div>
          </div>
          
          <div className="drawer-user">
            <div className="user-avatar">
              <span className="material-icons">person</span>
            </div>
            <div className="user-info">
              <div className="user-name">{user?.name || user?.username || t('common.noName')}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </div>
          
          <nav className="drawer-nav">
            {menuItems
              .filter(item => !item.adminOnly || isAdmin)
              .map(item => (
              <button 
                key={item.path + item.labelKey} 
                className={`drawer-item${location.pathname === item.path ? ' active' : ''}`}
                onClick={() => { navigate(item.path); closeDrawer() }}
              >
                <span className="material-icons">{item.icon}</span>
                <span>{t(item.labelKey)}</span>
              </button>
            ))}
          </nav>
          
          <div className="drawer-footer">
            <button className="drawer-item" onClick={handleSupport} style={{color: '#25d366'}}>
              <span className="material-icons">support_agent</span>
              <span>{t('nav.support')}</span>
            </button>
            <button className="drawer-item text-negative" onClick={handleLogout}>
              <span className="material-icons">logout</span>
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </aside>
        
        <main className="planner-content">
          <Outlet />
        </main>
      </div>
    </PlannerContext.Provider>
  )
}
