/**
 * @fileoverview Componente principal de la aplicación que gestiona el enrutamiento y la protección de rutas.
 */

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useTranslation } from 'react-i18next'

import DashboardLayout from './layouts/DashboardLayout'
import PlannerLayout from './layouts/PlannerLayout'

import LoginPage from './pages/Auth/LoginPage'
import RegisterPage from './pages/Auth/RegisterPage'
import PrivacyPage from './pages/Legal/PrivacyPage'
import TermsPage from './pages/Legal/TermsPage'
import SupportPage from './pages/Support/SupportPage'

import OrdersPage from './pages/Messaging/OrdersPage'

import AdminDashboard from './pages/Admin/AdminDashboard'
import AdminUsers from './pages/Admin/AdminUsers'
import RouteHistory from './pages/Admin/RouteHistory'
import AdminLogs from './pages/Admin/AdminLogs'
import AccountingPage from './pages/Admin/AccountingPage'
import PackageReturnsPage from './pages/Admin/PackageReturnsPage'
import WholesalePage from './pages/Admin/WholesalePage'
import BotMemoryPage from './pages/Admin/BotMemoryPage'
import ExportPage from './pages/Admin/ExportPage'

import CoveragePage from './pages/Messaging/CoveragePage'
import SettingsPage from './pages/Messaging/SettingsPage'

import TripPlannerPage from './pages/Planner/TripPlannerPage'
import DriverAccountingPage from './pages/Planner/DriverAccountingPage'
import DispatchMap from './pages/Dispatch/DispatchMap'
import AccountPage from './pages/Account/AccountPage'

/**
 * Pantalla de carga que se muestra mientras se inicializa el estado de autenticación.
 * @returns {JSX.Element}
 */
function LoadingScreen() {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a' }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #5b8def', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#94a3b8', fontSize: 14 }}>{t('common.loading')}</p>
      </div>
    </div>
  )
}

/**
 * Determina la ruta por defecto según el rol del usuario.
 * @param {Object} user - Objeto de usuario autenticado.
 * @returns {string} Ruta de destino recomendada.
 */
function getDefaultRoute(user) {
  if (!user) return '/login'
  if (user.role === 'admin') return '/messaging'
  return '/planner'
}

/**
 * Componente que protege rutas requiriendo autenticación y, opcionalmente, roles específicos.
 * @param {Object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Componentes hijos a renderizar si se cumple el acceso.
 * @param {boolean} [props.adminOnly=false] - Indica si la ruta es exclusiva para administradores.
 * @param {string[]} [props.allowedRoles=null] - Lista de roles permitidos para acceder a la ruta.
 * @returns {JSX.Element} El contenido protegido o una redirección.
 */
function ProtectedRoute({ children, adminOnly = false, allowedRoles = null }) {
  const { isAuthenticated, isAdmin, user, initializing } = useAuth()

  if (initializing) return <LoadingScreen />
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to={getDefaultRoute(user)} replace />
  }
  
  if (adminOnly && !isAdmin) {
    return <Navigate to={getDefaultRoute(user)} replace />
  }
  
  return children
}

/**
 * Componente que protege rutas públicas (como Login) para que usuarios autenticados sean redirigidos.
 * @param {Object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Componentes hijos a renderizar si no está autenticado.
 * @returns {JSX.Element} El contenido público o una redirección al dashboard.
 */
function PublicRoute({ children }) {
  const { isAuthenticated, user, initializing } = useAuth()

  if (initializing) return <LoadingScreen />
  
  if (isAuthenticated) {
    return <Navigate to={getDefaultRoute(user)} replace />
  }
  
  return children
}

/**
 * Definición de las rutas de la aplicación.
 * @returns {JSX.Element}
 */
export default function App() {
  const { user, isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/soporte" element={<SupportPage />} />
      
      <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to={isAuthenticated ? getDefaultRoute(user) : '/login'} replace />} />
        <Route path="messaging" element={<OrdersPage />} />
        <Route path="messaging/coverage" element={<CoveragePage />} />
        <Route path="messaging/settings" element={<SettingsPage />} />
        
        <Route path="admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
        <Route path="admin/routes" element={<ProtectedRoute adminOnly><RouteHistory /></ProtectedRoute>} />
        <Route path="admin/logs" element={<ProtectedRoute adminOnly><AdminLogs /></ProtectedRoute>} />
        <Route path="admin/accounting" element={<ProtectedRoute adminOnly><AccountingPage /></ProtectedRoute>} />
        <Route path="admin/returns" element={<ProtectedRoute adminOnly><PackageReturnsPage /></ProtectedRoute>} />
        <Route path="admin/wholesale" element={<ProtectedRoute adminOnly><WholesalePage /></ProtectedRoute>} />
        <Route path="admin/bot-memory" element={<ProtectedRoute adminOnly><BotMemoryPage /></ProtectedRoute>} />
        <Route path="admin/export" element={<ProtectedRoute adminOnly><ExportPage /></ProtectedRoute>} />
        <Route path="dispatch" element={<ProtectedRoute allowedRoles={['admin', 'driver']}><DispatchMap /></ProtectedRoute>} />
        <Route path="account" element={<AccountPage />} />
      </Route>
      
      <Route path="/planner" element={<ProtectedRoute><PlannerLayout /></ProtectedRoute>}>
        <Route index element={<TripPlannerPage />} />
        <Route path="accounting" element={<DriverAccountingPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
      
      <Route path="*" element={<Navigate to={isAuthenticated ? getDefaultRoute(user) : '/login'} replace />} />
    </Routes>
  )
}
