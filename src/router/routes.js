const routes = [
  {
    path: '/planner',
    component: () => import('layouts/PlannerLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('pages/TripPlannerPage.vue') }
    ]
  },
  {
    path: '/messaging',
    component: () => import('layouts/DashboardLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('pages/Messaging/MessagingDashboard.vue') },
      { path: 'orders/:id', component: () => import('pages/Messaging/OrderDetailPage.vue') },
      { path: 'coverage', component: () => import('pages/Messaging/CoverageZonesPage.vue') },
      { path: 'settings', component: () => import('pages/Messaging/MessagingSettingsPage.vue') }
    ],
  },
  {
    path: '/admin',
    component: () => import('layouts/DashboardLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', component: () => import('pages/Admin/AdminDashboardPage.vue') },
      { path: 'users', component: () => import('pages/Admin/UsersListPage.vue') }
    ],
  },
  {
    path: '/auth/login',
    component: () => import('pages/Auth/LoginPage.vue'),
  },
  {
    path: '/login',
    redirect: '/auth/login'
  },
  {
    path: '/auth/register',
    component: () => import('pages/Auth/RegisterPage.vue'),
  },
  {
    path: '/register',
    redirect: '/auth/register'
  },
  {
    path: '/',
    component: () => import('pages/Auth/SplashScreem.vue'),
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
