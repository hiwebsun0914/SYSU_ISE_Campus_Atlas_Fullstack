// src/router/index.ts
import { createRouter, createWebHashHistory } from 'vue-router'
import { request } from '@/utils/request'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('../pages/Home.vue') },
    { path: '/map', component: () => import('../pages/Map.vue') },
    { path: '/place', component: () => import('../pages/PlaceTest.vue') },
    { path: '/profile', redirect: '/myCheckins' },
    { path: '/myCheckins', component: () => import('../pages/myCheckins.vue') },
    { path: '/rank', component: () => import('../pages/rank.vue') },
    { path: '/future-card', component: () => import('../pages/futureCard.vue') },
    { path: '/signin', component: () => import('../pages/signin.vue') },
    { path: '/hidden-checkpoints', component: () => import('../pages/HiddenCheckpoints.vue') },
    { path: '/hidden-checkpoints/:id', component: () => import('../pages/HiddenCheckpointDetail.vue') },
    { path: '/award', component: () => import('../pages/award/AwardHome.vue') },
    { path: '/award/submit', component: () => import('../pages/award/AwardSubmit.vue') },
    { path: '/award/my', component: () => import('../pages/award/AwardMine.vue') },
    { path: '/award/results', component: () => import('../pages/award/AwardResults.vue') },
    { path: '/award/submission/:id', component: () => import('../pages/award/AwardSubmissionDetail.vue') },

    {
      path: '/admin',
      component: () => import('../pages/admin/AdminHome.vue'),
      meta: { requiresAdmin: true }
    },
    {
      path: '/admin/review',
      redirect: to => ({ path: '/admin', query: { ...to.query, section: 'review' } })
    },
    {
      path: '/admin/submissions',
      redirect: to => ({ path: '/admin', query: { ...to.query, section: 'review', queue: 'submissions' } })
    },

    { path: '/:pathMatch(.*)*', component: { render: () => '404' } }
  ]
})

const ADMIN_ROLES = new Set(['admin', 'owner'])

router.beforeEach(async to => {
  if (to.path === '/myCheckins' && to.query.notice === 'admin-denied') {
    return {
      path: '/signin',
      query: { redirect: '/admin', mode: 'admin', reason: 'admin-denied' }
    }
  }

  if (!to.meta.requiresAdmin) return true

  const token = localStorage.getItem('token') || ''
  if (!token) {
    return { path: '/signin', query: { redirect: to.fullPath, mode: 'admin' } }
  }

  const response = await request('/auth/me', 'GET', null, { cacheBust: true })
  const user = response?.data?.userInfo || null
  if (!response?.ok || response?.data?.code !== 0 || !user) {
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    return { path: '/signin', query: { redirect: to.fullPath, mode: 'admin' } }
  }

  localStorage.setItem('userInfo', JSON.stringify(user))
  if (!ADMIN_ROLES.has(user.role)) {
    return {
      path: '/signin',
      query: { redirect: to.fullPath, mode: 'admin', reason: 'admin-denied' }
    }
  }

  return true
})

export default router
