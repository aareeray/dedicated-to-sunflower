import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loadMusicLibrary, refreshYouTubePlaylistInBackground, type Album } from '../services/musicService'

const PLAYLIST_ID = 'PLVvjnqpET53vBnv5QF78lG9sMMB-ijSUt';

export const useLibraryStore = defineStore('library', () => {
  const albums = ref<Album[]>([])
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const isLoaded = ref<boolean>(false)

  const getAllAlbums = computed(() => albums.value)

  const getAlbumById = (id: string): Album | undefined =>
    albums.value.find(album => album.id === id)

  // Synchronous initial load — completes instantly
  const fetchLibrary = () => {
    if (isLoaded.value) {
      console.log('[LibraryStore] Already loaded, skipping')
      return
    }

    console.log('[LibraryStore] Loading library (sync)...')
    isLoading.value = true
    error.value = null

    try {
      let data = loadMusicLibrary()

      // Apply R2 URL substitution if configured
      const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL || ''
      if (r2PublicUrl) {
        data.forEach(album => {
          if (album.coverSrc?.includes('${R2_PUBLIC_URL}'))
            album.coverSrc = album.coverSrc.replace('${R2_PUBLIC_URL}', r2PublicUrl)
          album.songs.forEach(song => {
            if (song.src?.includes('${R2_PUBLIC_URL}'))
              song.src = song.src.replace('${R2_PUBLIC_URL}', r2PublicUrl)
          })
        })
      }

      albums.value = data
      isLoaded.value = true
      console.log('[LibraryStore] Loaded instantly:', albums.value.length, 'albums')
    } catch (err) {
      console.error('[LibraryStore] Error:', err)
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }

    // Kick off background refresh without blocking
    startBackgroundRefresh()
  }

  // Non-blocking background refresh — updates playlists tracks if fresh data fetched
  const startBackgroundRefresh = () => {
    refreshYouTubePlaylistInBackground((freshSongs) => {
      const ytAlbumIndex = albums.value.findIndex(a => a.id === PLAYLIST_ID)
      if (ytAlbumIndex !== -1) {
        const updated = { ...albums.value[ytAlbumIndex] }
        updated.songs = freshSongs
        updated.tracks = freshSongs.length
        updated.coverSrc = freshSongs[0]?.thumbnail ?? updated.coverSrc
        updated.coverImage = updated.coverSrc
        albums.value = [
          ...albums.value.slice(0, ytAlbumIndex),
          updated,
          ...albums.value.slice(ytAlbumIndex + 1),
        ]
        console.log('[LibraryStore] YouTube album refreshed in background:', freshSongs.length, 'tracks')
      }
    })
  }

  const refreshLibrary = () => {
    albums.value = []
    isLoaded.value = false
    fetchLibrary()
  }

  return {
    albums,
    isLoading,
    error,
    isLoaded,
    getAllAlbums,
    getAlbumById,
    fetchLibrary,
    refreshLibrary,
    startBackgroundRefresh,
  }
})
