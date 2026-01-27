const routes = [
  {
    path: '/app',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/IndexPage.vue') }],
  },
  {
    path: '/planner',
    component: () => import('layouts/PlannerLayout.vue'),
    children: [
      { path: '', component: () => import('pages/TripPlannerPage.vue') }
    ]
  },
  {
    path: '/saved-routes',
    component: () => import('layouts/PlannerLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('pages/Settings/SavedRoutesPage.vue') }
    ]
  },
  {
    path: '/settings',
    component: () => import('layouts/SettingsLayout.vue'),
    children: [
      { path: '', component: () => import('pages/Settings/SettingsPage.vue') }
    ]
  },
  {
    path: '/help',
    component: () => import('layouts/SettingsLayout.vue'),
    children: [
      { path: '', component: () => import('pages/Settings/HelpPage.vue') }
    ]
  },
  {
    path: '/local-routes',
    component: () => import('layouts/PlannerLayout.vue'),
    children: [
      { path: '', component: () => import('pages/Settings/LocalRoutesPage.vue') }
    ]
  },
  {
    path: '/routes',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('pages/Routes/RoutesPage.vue') },
      { path: ':id', component: () => import('pages/Routes/RouteDetailPage.vue') }
    ],
  },
  {
    path: '/history',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('pages/Routes/HistoryPage.vue') }
    ],
  },
  {
    path: '/messaging',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('pages/Messaging/MessagingDashboard.vue') },
      { path: 'orders/:id', component: () => import('pages/Messaging/OrderDetailPage.vue') },
      { path: 'coverage', component: () => import('pages/Messaging/CoverageZonesPage.vue') },
      { path: 'settings', component: () => import('pages/Messaging/MessagingSettingsPage.vue') }
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
