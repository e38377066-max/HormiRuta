/**
 * @fileoverview Layout principal del panel con sidebar reorganizado por categorías.
 */

import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import './DashboardLayout.css'

/** Elemento de navegación */
function NavItem({ to, icon, label, color, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `q-item${isActive ? ' active' : ''}`}
      onClick={onClick}
    >
      <span className="material-icons q-item-icon" style={{ color }}>{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}

/** Cabecera de sección del sidebar */
function SectionLabel({ icon, label, color }) {
  return (
    <div className="q-section-label">
      <span className="q-section-indicator" style={{ background: color }} />
      <span>{label}</span>
    </div>
  )
}

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const close = () => setDrawerOpen(false)

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
        <div className="q-drawer-backdrop" onClick={close} />
        <nav className="q-drawer-content">

          {/* ── OPERACIONES ── */}
          <SectionLabel label="Operaciones" color="#6200ea" />
          <NavItem to="/dispatch"  icon="local_shipping" label="Mapa de Despacho"   color="#6200ea" onClick={close} />
          <NavItem to="/planner"   icon="route"          label="Planear Ruta"        color="#3949ab" onClick={close} />

          {isAdmin && (
            <>
              <div className="q-separator" />

              {/* ── RUTAS Y ENTREGAS ── */}
              <SectionLabel label="Rutas y Entregas" color="#2e7d32" />
              <NavItem to="/admin/routes"        icon="history"         label="Historial de Rutas"      color="#388e3c" onClick={close} />
              <NavItem to="/admin/wholesale"     icon="store"           label="Clientes Mayoristas"     color="#00695c" onClick={close} />
              <NavItem to="/admin/accounting"    icon="receipt_long"    label="Contabilidad"            color="#2e7d32" onClick={close} />
              <NavItem to="/admin/returns"       icon="assignment_return" label="Recepción de Paquetes" color="#558b2f" onClick={close} />
            </>
          )}

          <div className="q-separator" />

          {/* ── MENSAJERÍA ── */}
          <SectionLabel label="Mensajería" color="#00897b" />
          <NavItem to="/messaging" icon="inbox"           label="Pedidos"            color="#00897b" onClick={close} end />

          {isAdmin && (
            <>
              <div className="q-separator" />

              {/* ── CEREBRO IA ── */}
              <SectionLabel label="Cerebro IA del Bot" color="#e65100" />
              <NavItem to="/admin/bot-memory"    icon="school"          label="Lecciones del Bot"       color="#e65100" onClick={close} />

              <div className="q-separator" />

              {/* ── CONFIGURACIÓN ── */}
              <SectionLabel label="Configuración" color="#757575" />
              <NavItem to="/messaging/settings"  icon="smart_toy"       label="Config. Bot e IA"        color="#757575" onClick={close} />
              <NavItem to="/messaging/coverage"  icon="location_on"     label="Zonas de Cobertura"      color="#2196f3" onClick={close} />

              <div className="q-separator" />

              {/* ── GESTIÓN DE USUARIOS ── */}
              <SectionLabel label="Gestión de Usuarios" color="#1976d2" />
              <NavItem to="/admin/users"         icon="people"          label="Usuarios y Choferes"     color="#1976d2" onClick={close} />

              <div className="q-separator" />

              {/* ── SISTEMA ── */}
              <SectionLabel label="Sistema" color="#5d4037" />
              <NavItem to="/admin"               icon="dashboard"       label="Panel Admin"             color="#5d4037" end onClick={close} />
              <NavItem to="/admin/logs"          icon="terminal"        label="Logs del Sistema"        color="#795548" onClick={close} />
              <NavItem to="/admin/export"        icon="file_download"   label="Exportar Datos"          color="#8d6e63" onClick={close} />
            </>
          )}

          <div className="q-separator" />

          {/* ── MI CUENTA ── */}
          <SectionLabel label="Mi Cuenta" color="#607d8b" />
          <NavItem to="/account"  icon="person"         label="Mi Cuenta"           color="#607d8b" onClick={close} />
          <NavItem to="/soporte"  icon="support_agent"  label="Soporte"             color="#25d366" onClick={close} />

          <button className="q-item logout" onClick={handleLogout}>
            <span className="material-icons q-item-icon">logout</span>
            <span>Cerrar Sesión</span>
          </button>

        </nav>
      </aside>

      <main className="q-page-container">
        <Outlet />
      </main>
    </div>
  )
}
