import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import AlbumBrowse from '../views/AlbumBrowse.vue'
import AlbumPlayer from '../views/AlbumPlayer.vue'
import { useLibraryStore } from '../store/libraryStore'
import { updateCanonicalLink } from '../utils/seo'

const routes: Readonly<RouteRecordRaw[]> = [
  {
    path: '/',
    name: 'AlbumPlayer',
    component: AlbumPlayer,
    props: () => ({ albumId: 'first' }),
    beforeEnter: (_to, _from, next) => {
      // Kick off library load (sync, instant) — never block navigation
      const libraryStore = useLibraryStore()
      if (!libraryStore.isLoaded) {
        libraryStore.fetchLibrary()
      }
      next()
    }
  },
  {
    path: '/tower',
    name: 'AlbumBrowse',
    component: AlbumBrowse
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Update canonical tag on every navigation
router.beforeEach((to, _from, next) => {
  updateCanonicalLink(to.path)
  next()
})

export default router
