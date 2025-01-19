import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import InfiniteCanvas from '../components/canvas/InfiniteCanvas.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: InfiniteCanvas
  },
  {
    path: '/canvas/:id',
    name: 'SpecificCanvas',
    component: InfiniteCanvas,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router