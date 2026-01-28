import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

import DashboardLayout from './layouts/DashboardLayout'
import PlannerLayout from './layouts/PlannerLayout'

import LoginPage from './pages/Auth/LoginPage'
import RegisterPage from './pages/Auth/RegisterPage'

import DashboardPage from './pages/Dashboard/DashboardPage'

import AdminDashboard from './pages/Admin/AdminDashboard'
import AdminUsers from './pages/Admin/AdminUsers'

import OrdersPage from './pages/Messaging/OrdersPage'
import CoveragePage from './pages/Messaging/CoveragePage'
import SettingsPage from './pages/Messaging/SettingsPage'

import TripPlannerPage from './pages/Planner/TripPlannerPage'

function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin } = useAuth()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }
  
  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth()
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }
  
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      
      <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        
        <Route path="messaging/orders" element={<OrdersPage />} />
        <Route path="messaging/coverage" element={<CoveragePage />} />
        <Route path="messaging/settings" element={<SettingsPage />} />
        
        <Route path="admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
      </Route>
      
      <Route path="/planner" element={<ProtectedRoute><PlannerLayout /></ProtectedRoute>}>
        <Route index element={<TripPlannerPage />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
