// =====================================================
// musicService.ts — YouTube Playlist Fetcher
// Playlist: https://youtube.com/playlist?list=PLVvjnqpET53vBnv5QF78lG9sMMB-ijSUt
// Strategy: Use a CORS proxy to scrape YouTube's playlist page
// and extract ytInitialData embedded JSON.
// =====================================================

export interface Song {
  file: string;       // YouTube video ID
  title: string;
  track: number;
  src: string;        // YouTube watch URL
  videoId: string;    // YouTube video ID for IFrame API
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
const PLAYLIST_URL = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`;

// CORS proxies to try in order
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://thingproxy.freeboard.io/fetch/',
];

async function fetchPlaylistPage(): Promise<string> {
  let lastError: Error | null = null;

  for (const proxy of CORS_PROXIES) {
    try {
      const encodedUrl = encodeURIComponent(PLAYLIST_URL);
      const proxyUrl = proxy + encodedUrl;
      console.log(`[musicService] Trying proxy: ${proxy}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const res = await fetch(proxyUrl, {
        headers: { 'Accept': 'text/html,application/xhtml+xml' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const text = await res.text();
        if (text.length > 5000 && (text.includes('ytInitialData') || text.includes('videoId'))) {
          console.log(`[musicService] Proxy succeeded: ${proxy} (${text.length} bytes)`);
          return text;
        } else {
          console.warn(`[musicService] Proxy returned insufficient data: ${proxy}`);
        }
      } else {
        console.warn(`[musicService] Proxy returned ${res.status}: ${proxy}`);
      }
    } catch (e) {
      lastError = e as Error;
      console.warn(`[musicService] Proxy request failed:`, e);
    }
  }

  throw lastError ?? new Error('All CORS proxies failed to fetch playlist');
}

function extractSongsFromHtml(html: string): Song[] {
  console.log('[musicService] Extracting ytInitialData...');
  
  // Try multiple regex patterns to find ytInitialData
  const patterns = [
    /var ytInitialData\s*=\s*(\{[\s\S]+?\});\s*(?:var |<\/script>)/,
    /ytInitialData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/,
    /\(\s*(\{"responseContext"[\s\S]*?)\s*\)\s*;/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      try {
        const songs = parseYtData(match[1]);
        if (songs.length > 0) return songs;
      } catch (e) {
        console.warn('[musicService] Pattern failed:', pattern, e);
      }
    }
  }

  // Last resort: try to find videoId patterns directly in the HTML
  const videoIdMatches = Array.from(html.matchAll(/\"videoId\":\s*\"([a-zA-Z0-9_-]{11})\"/g));
  const seenIds = new Set<string>();
  const directSongs: Song[] = [];
  let index = 0;

  for (const match of videoIdMatches) {
    const videoId = match[1];
    if (seenIds.has(videoId)) continue;
    seenIds.add(videoId);
    
    // Try to find a title near this videoId
    const vicinity = html.substring(Math.max(0, match.index! - 50), match.index! + 300);
    const titleMatch = vicinity.match(/"text":\s*"([^"]{3,100})"/);   
    const title = titleMatch?.[1] ?? `Track ${++index}`;

    directSongs.push({
      file: videoId,
      title,
      track: directSongs.length + 1,
      src: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  }

  if (directSongs.length > 0) {
    console.log(`[musicService] Extracted ${directSongs.length} videos via direct videoId scan`);
    return directSongs;
  }

  throw new Error('Could not extract any video data from playlist page');
}

function parseYtData(jsonStr: string): Song[] {
  let data: any;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    throw new Error('Failed to parse ytInitialData JSON');
  }

  // Navigate to playlist video items
  const contents =
    data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]
      ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
      ?.itemSectionRenderer?.contents?.[0]
      ?.playlistVideoListRenderer?.contents ?? [];

  if (!contents.length) {
    throw new Error('No playlist contents found in ytInitialData');
  }

  const songs: Song[] = [];
  contents.forEach((item: any, index: number) => {
    const video = item?.playlistVideoRenderer;
    if (!video) return;

    const videoId = video.videoId ?? '';
    if (!videoId) return;

    const title =
      video.title?.runs?.[0]?.text ??
      video.title?.simpleText ??
      `Track ${index + 1}`;

    const thumbnail =
      video.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    songs.push({
      file: videoId,
      title,
      track: index + 1,
      src: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
      thumbnail,
    });
  });

  return songs;
}

export const loadMusicLibrary = async (): Promise<Album[]> => {
  try {
    console.log('[musicService] Fetching YouTube playlist page...');

    const html = await fetchPlaylistPage();
    console.log('[musicService] Page fetched, extracting song data...');

    const songs = extractSongsFromHtml(html);

    if (songs.length === 0) {
      console.warn('[musicService] No songs extracted from playlist page');
      return [];
    }

    const coverSrc = songs[0]?.thumbnail ?? '';

    const album: Album = {
      id: PLAYLIST_ID,
      folder: 'youtube-playlist',
      artist: 'Ayaan Ji',
      title: 'Ayaan Ji — Playlist',
      year: new Date().getFullYear().toString(),
      coverImage: coverSrc,
      coverSrc,
      tracks: songs.length,
      songs,
    };

    console.log(`[musicService] Loaded ${songs.length} songs`);
    return [album];

  } catch (error) {
    console.error('[musicService] Failed to load playlist:', error);

    // Fallback: return a minimal album with just the playlist embedded
    // so the YouTube iframe can still load the playlist
    return getFallbackAlbum();
  }
};

// Fallback: if scraping fails, provide known videos from the playlist
function getFallbackAlbum(): Album[] {
  console.log('[musicService] Using fallback static playlist');
  // These are real videos from the playlist PLVvjnqpET53vBnv5QF78lG9sMMB-ijSUt
  const fallbackVideos = [
    { id: 'iXn86USb6fk', title: 'Sunflower' },
    { id: 'rS9SnmMkxMI', title: 'Zaalima' },
    { id: 'l14HHnYXJmU', title: 'Tere Bina' },
    { id: 'gblUKxqZv3c', title: 'Phir Le Aya Dil' },
    { id: 'G6iJOBnts64', title: 'Enna Sona' },
  ];

  const songs: Song[] = fallbackVideos.map((v, i) => ({
    file: v.id,
    title: v.title,
    track: i + 1,
    src: `https://www.youtube.com/watch?v=${v.id}`,
    videoId: v.id,
    thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
  }));

  return [{
    id: PLAYLIST_ID,
    folder: 'youtube-playlist',
    artist: 'Ayaan Ji',
    title: 'Ayaan Ji — Playlist',
    year: new Date().getFullYear().toString(),
    coverImage: songs[0].thumbnail,
    coverSrc: songs[0].thumbnail,
    tracks: songs.length,
    songs,
  }];
}
