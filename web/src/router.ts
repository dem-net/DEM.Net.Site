import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomePage from './pages/HomePage.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomePage, meta: { title: '' } },
  {
    path: '/terrain',
    name: 'terrain',
    component: () => import('./pages/TerrainPage.vue'),
    meta: { title: 'Map to 3D', fullBleed: true },
  },
  {
    path: '/gpx',
    name: 'gpx',
    component: () => import('./pages/GpxPage.vue'),
    meta: { title: 'GPX to 3D', fullBleed: true },
  },
  {
    path: '/textures',
    name: 'textures',
    component: () => import('./pages/TexturesPage.vue'),
    meta: { title: 'Textures', fullBleed: true },
  },
  {
    path: '/elevation',
    name: 'elevation',
    component: () => import('./pages/ElevationPage.vue'),
    meta: { title: 'Elevation', fullBleed: true },
  },
  { path: '/expo', name: 'expo', component: () => import('./pages/ExpoPage.vue'), meta: { title: 'Expo' } },
  { path: '/faq', name: 'faq', component: () => import('./pages/FaqPage.vue'), meta: { title: 'FAQ' } },
  { path: '/about', name: 'about', component: () => import('./pages/AboutPage.vue'), meta: { title: 'About' } },
  { path: '/privacy', name: 'privacy', component: () => import('./pages/PrivacyPage.vue'), meta: { title: 'Privacy' } },
  // Registered as the OAuth redirect URI on Sketchfab: the path must not change.
  {
    path: '/sketchfab_oauth2',
    name: 'sketchfab',
    component: () => import('./pages/SketchfabPage.vue'),
    meta: { title: 'Publish to Sketchfab' },
  },

  // Old URLs from the previous site
  { path: '/playground_3dbbox', redirect: { name: 'terrain' } },
  { path: '/playground_3dosm', redirect: { name: 'terrain', query: { osm: '1' } } },
  { path: '/playground_3dgpx', redirect: { name: 'gpx' } },
  { path: '/playgroundpoint', redirect: { name: 'elevation', query: { mode: 'point' } } },
  { path: '/playgroundline', redirect: { name: 'elevation', query: { mode: 'line' } } },

  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('./pages/NotFoundPage.vue'),
    meta: { title: 'Page not found' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, _from, saved) => {
    if (saved) return saved
    // Plain anchors only (e.g. /about#support); OAuth hashes like #access_token=… are not selectors.
    // `top` keeps the target below the sticky header (vue-router ignores CSS scroll-margin).
    if (/^#[\w-]+$/.test(to.hash)) return { el: to.hash, top: 72, behavior: 'smooth' }
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · Elevation API` : 'Elevation API · 3D terrain models from any place on Earth'
})

export default router
