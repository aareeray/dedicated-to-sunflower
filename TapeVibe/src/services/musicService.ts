// =====================================================
// musicService.ts — Music Library Service
// Strategy: Load instantly from hardcoded verified playlist.
//           Try to refresh from Piped/scrape in background.
// =====================================================

export interface Song {
  file: string;       // YouTube video ID or asset URL
  title: string;
  track: number;
  src: string;        // YouTube watch URL or asset URL
  videoId: string;    // YouTube video ID for IFrame API (empty for local)
  thumbnail: string;  // Video thumbnail URL
}

export interface Album {
  id: string;
  folder: string;
  artist: string;
  title: string;
  year: string;
  coverImage: string;
  coverSrc: string;
  tracks: number;
  songs: Song[];
}

const PLAYLIST_ID = 'PLVvjnqpET53vBnv5QF78lG9sMMB-ijSUt';

// ─── Hardcoded verified tracks from the playlist ────────────────────────────
// These are real video IDs from PLVvjnqpET53vBnv5QF78lG9sMMB-ijSUt.
// This list loads INSTANTLY and serves as the guaranteed fallback.
const HARDCODED_TRACKS: { id: string; title: string }[] = [
  { id: 'iXn86USb6fk', title: 'Sunflower' },
  { id: 'rS9SnmMkxMI', title: 'Zaalima' },
  { id: 'l14HHnYXJmU', title: 'Tere Bina' },
  { id: 'gblUKxqZv3c', title: 'Phir Le Aya Dil' },
  { id: 'G6iJOBnts64', title: 'Enna Sona' },
  { id: 'kdwl9BK-pNQ', title: 'Iktara' },
  { id: 'I7a6xkqw-a4', title: 'Teri Deewani' },
  { id: 'LHrAHPdlRLE', title: 'Tum Se Hi' },
  { id: 'FoJldoLMmLM', title: 'Tu Jaane Na' },
  { id: 'AfrO2YjXz2E', title: 'Kabhi Alvida Naa Kehna' },
  { id: 'oaqTHbpxujY', title: 'Tujh Mein Rab Dikhta Hai' },
  { id: 'k5yoRvYqrS0', title: 'Tere Liye' },
  { id: 'F-ZtjHhQaBA', title: 'Dil Dhadakne Do' },
  { id: 'Gy8R_sRFvok', title: 'Khuda Jaane' },
  { id: 'y0zGfCTjUoM', title: 'Aadat' },
];

function buildSongsFromIds(tracks: { id: string; title: string }[]): Song[] {
  return tracks.map((v, i) => ({
    file: v.id,
    title: v.title,
    track: i + 1,
    src: `https://www.youtube.com/watch?v=${v.id}`,
    videoId: v.id,
    thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
  }));
}

function buildYouTubeAlbum(songs: Song[]): Album {
  const coverSrc = songs[0]?.thumbnail ?? '';
  return {
    id: PLAYLIST_ID,
    folder: 'youtube-playlist',
    artist: 'Ayaan Ji',
    title: 'Dedicated to Sunflower',
    year: '2026',
    coverImage: coverSrc,
    coverSrc,
    tracks: songs.length,
    songs,
  };
}

// ─── Local opus songs ────────────────────────────────────────────────────────
const LOCAL_ALBUM_ID = 'local-uploads';

// Vite 5+ glob: use query + import instead of deprecated 'as: url'
const localSongFiles = import.meta.glob('../assets/songs/*.opus', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function getLocalSongs(): Song[] {
  return Object.entries(localSongFiles).map(([path, url], index) => {
    const filename = path.split('/').pop()?.replace('.opus', '') || `Local Track ${index + 1}`;
    const title = filename.split('-').pop()?.trim() || filename;
    return {
      file: url as string,
      title,
      track: index + 1,
      src: url as string,
      videoId: '',
      thumbnail: '',
    };
  });
}

// ─── Main export: returns INSTANTLY with static data ─────────────────────────
export const loadMusicLibrary = (): Album[] => {
  const allAlbums: Album[] = [];

  // 1. Local songs (if any)
  const localSongs = getLocalSongs();
  if (localSongs.length > 0) {
    const defaultCoverUrl = new URL('../assets/Li-Zhi.png', import.meta.url).href;
    allAlbums.push({
      id: LOCAL_ALBUM_ID,
      folder: 'local-songs',
      artist: 'Local Uploads',
      title: 'My Uploaded Songs',
      year: '2026',
      coverImage: '',
      coverSrc: defaultCoverUrl,
      tracks: localSongs.length,
      songs: localSongs,
    });
  }

  // 2. YouTube album — hardcoded, instant
  const ytSongs = buildSongsFromIds(HARDCODED_TRACKS);
  allAlbums.push(buildYouTubeAlbum(ytSongs));

  return allAlbums;
};

// ─── Background refresh: tries Piped then scraping, updates albums in place ──
// Piped API instances
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.smnz.de',
];

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];

const PLAYLIST_URL = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`;

async function tryPiped(): Promise<Song[] | null> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${instance}/playlists/${PLAYLIST_ID}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      const items: Song[] = (data?.relatedStreams ?? []).map((item: { url: string; title: string; thumbnail: string }, i: number) => {
        const videoId = item.url?.split('v=')?.[1] || item.url?.split('/')?.pop() || '';
        return {
          file: videoId,
          title: item.title,
          track: i + 1,
          src: `https://www.youtube.com/watch?v=${videoId}`,
          videoId,
          thumbnail: item.thumbnail,
        };
      });
      if (items.length > 0) {
        console.log(`[musicService] Piped succeeded (${instance}): ${items.length} tracks`);
        return items;
      }
    } catch {
      // try next
    }
  }
  return null;
}

async function tryScrape(): Promise<Song[] | null> {
  for (const proxy of CORS_PROXIES) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(`${proxy}${encodeURIComponent(PLAYLIST_URL)}`, {
        headers: { Accept: 'text/html' },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const html = await res.text();
      // Quick check for sufficient data
      if (html.length < 5000 || !html.includes('videoId')) continue;

      // Extract all video IDs + nearby titles
      const matches = Array.from(html.matchAll(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g));
      const seen = new Set<string>();
      const songs: Song[] = [];
      let idx = 0;
      for (const m of matches) {
        const vid = m[1];
        if (seen.has(vid)) continue;
        seen.add(vid);
        const vicinity = html.substring(Math.max(0, (m.index ?? 0) - 50), (m.index ?? 0) + 300);
        const titleM = vicinity.match(/"text"\s*:\s*"([^"]{3,100})"/);
        const title = titleM?.[1] ?? `Track ${++idx}`;
        songs.push({
          file: vid,
          title,
          track: songs.length + 1,
          src: `https://www.youtube.com/watch?v=${vid}`,
          videoId: vid,
          thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        });
      }
      if (songs.length > 0) {
        console.log(`[musicService] Scrape succeeded (${proxy}): ${songs.length} tracks`);
        return songs;
      }
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Runs in the background after initial load.
 * If a fresh playlist is fetched, calls `onUpdate` with the refreshed songs.
 * Does NOT block the UI.
 */
export async function refreshYouTubePlaylistInBackground(
  onUpdate: (songs: Song[]) => void
): Promise<void> {
  console.log('[musicService] Background refresh started...');
  try {
    const songs = (await tryPiped()) ?? (await tryScrape());
    if (songs && songs.length > 0) {
      console.log(`[musicService] Background refresh succeeded: ${songs.length} tracks`);
      onUpdate(songs);
    } else {
      console.log('[musicService] Background refresh found nothing; keeping hardcoded list');
    }
  } catch (e) {
    console.warn('[musicService] Background refresh error:', e);
  }
}
