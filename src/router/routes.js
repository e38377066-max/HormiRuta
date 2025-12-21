const routes = [
  {
    path: '/app',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/IndexPage.vue') }],
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
