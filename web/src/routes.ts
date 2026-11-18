import type { RouteRecordRaw } from 'vue-router'
import HomePage from './pages/HomePage.vue'
import { MOVED_PAGES } from './seo'

export const routes: RouteRecordRaw[] = [
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
  {
    path: '/stats',
    name: 'stats',
    component: () => import('./pages/StatsPage.vue'),
    meta: { title: 'Statistics', fullBleed: true },
  },
  { path: '/gallery', name: 'gallery', component: () => import('./pages/GalleryPage.vue'), meta: { title: 'Gallery' } },
  // Before /gallery/:id. Not indexed (not in INDEXED_PAGES); the API emails the owner a link to it (#login=…).
  {
    path: '/gallery/admin',
    name: 'gallery-admin',
    component: () => import('./pages/GalleryAdminPage.vue'),
    meta: { title: 'Gallery review' },
  },
  // The publisher's private link adds #token=… (galleryOwnerLink).
  {
    path: '/gallery/:id',
    name: 'gallery-item',
    component: () => import('./pages/GalleryItemPage.vue'),
    meta: { title: 'Gallery' },
  },
  { path: '/about', name: 'about', component: () => import('./pages/AboutPage.vue'), meta: { title: 'About' } },
  { path: '/privacy', name: 'privacy', component: () => import('./pages/PrivacyPage.vue'), meta: { title: 'Privacy' } },
  // Registered as the OAuth redirect URI on Sketchfab: the path must not change.
  {
    path: '/sketchfab_oauth2',
    name: 'sketchfab',
    component: () => import('./pages/SketchfabPage.vue'),
    meta: { title: 'Publish to Sketchfab' },
  },

  // Merged into the About page (see MOVED_PAGES in seo.ts)
  ...MOVED_PAGES.map((m) => ({ path: m.path, redirect: m.to })),

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
