// src/router/index.ts
import { createRouter, createWebHashHistory } from 'vue-router'

export default createRouter({
  history: createWebHashHistory(), // 先用 # 路由，百分百能出首页
  routes: [
    { path: '/', component: () => import('../pages/Home.vue') },
    { path: '/atlas', component: () => import('../pages/Index.vue') },
    { path: '/map',   component: () => import('../pages/Map.vue') },
    { path: '/place', component: () => import('../pages/PlaceTest.vue') },

    // 其余页面都用懒加载（就算文件没就位也不影响首页）
    { path: '/myCheckins',   component: () => import('../pages/myCheckins.vue') },
    { path: '/rank',         component: () => import('../pages/rank.vue') },
    { path: '/message',      component: () => import('../pages/message.vue') },
    { path: '/future-card',  component: () => import('../pages/futureCard.vue') },
    { path: '/signin',       component: () => import('../pages/signin.vue') },
    { path: '/connect',      component: () => import('../pages/connect.vue') },
    { path: '/hidden-checkpoints', component: () => import('../pages/HiddenCheckpoints.vue') },
    { path: '/hidden-checkpoints/:id', component: () => import('../pages/HiddenCheckpointDetail.vue') },

    // 如果 Review 在 src/pages/admin/Review.vue，用下面这一行
    { path: '/admin/review', component: () => import('../pages/admin/Review.vue') },
    // 如果你其实放在 src/pages/Review.vue，请改成：
    // { path: '/admin/review', component: () => import('../pages/Review.vue') },

    // 简单 404
    { path: '/:pathMatch(.*)*', component: { render: () => '404' } },
  ],
})
