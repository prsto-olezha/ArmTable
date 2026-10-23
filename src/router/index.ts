import { createRouter, createWebHashHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('../views/TournamentsView.vue') },
    { path: '/builder/:id', component: () => import('../views/BuilderView.vue') },
    { path: '/run/:id', component: () => import('../views/RunView.vue') },
    { path: '/results/:id', component: () => import('../views/ResultsView.vue') },
  ],
});
