const routes = [
  {
    path: '/test',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/IndexPage.vue') }],
  }, {
    path: '/login',
    component: () => import('pages/Auth/LoginPage.vue'),
  },
  {
    path: '/',
    component: () => import('pages/Auth/SplashScreem.vue'),
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
