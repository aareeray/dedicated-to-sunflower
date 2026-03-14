<script setup lang="ts">
console.log('--- AlbumPlayer.vue script setup started ---');

import { ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { useNavigationStore } from '@/store/navigationStore';
import type { Album, Song } from '@/services/musicService';

// Import SVG assets
import nextButtonSvg from '@/assets/NEXT.svg';
import prevButtonSvg from '@/assets/PREV.svg';
import playButtonSvg from '@/assets/Start Stop Button.svg';
import playButtonOuterSvg from '@/assets/start stop outer.svg';
import infoOuterSvg from '@/assets/info outer.svg';

// Define component props
const props = defineProps<{
  albumId?: string
}>();

const route = useRoute();
const router = useRouter();
const libraryStore = useLibraryStore();
const playerStore = usePlayerStore();
const navigationStore = useNavigationStore();

const albumId = computed(() => props.albumId || route.params.albumId as string);
const localCurrentAlbum = ref<Album | null>(null);

const hasStartedPlaying = ref(false);
const previousTrackIndex = ref(0);

const isMobile = ref(false);
const checkDeviceType = () => {
  isMobile.value = window.innerWidth < 768;
};

// --- Store computed ---
const currentAlbumFromStore = computed(() => playerStore.currentAlbum);
const currentTrackIndex = computed(() => playerStore.currentTrackIndex);
const isPlaying = computed(() => playerStore.isPlaying);
const currentSong = computed(() => playerStore.currentSong as (Song | null));
const totalTracks = computed(() => playerStore.currentAlbum?.songs.length ?? 0);

// Dynamic cover: use the current song's thumbnail if available
const displayCoverSrc = computed(() => {
  const song = currentSong.value as any;
  if (song?.thumbnail) return song.thumbnail;
  return (localCurrentAlbum.value || currentAlbumFromStore.value)?.coverSrc ?? '';
});

// Tone arm rotation
const toneArmRotation = computed(() => {
  if (!playerStore.currentAlbum || !playerStore.currentSong || totalTracks.value === 0) return -15;
  if (!playerStore.isPlaying) return -15;
  if (!hasStartedPlaying.value && playerStore.currentTime < 0.5) {
    hasStartedPlaying.value = true;
    previousTrackIndex.value = currentTrackIndex.value;
    return -5;
  }
  const completedTracksProgress = currentTrackIndex.value / totalTracks.value;
  const currentTrackProgress = playerStore.currentTime / (playerStore.duration || 1);
  const currentTrackPortion = 1 / totalTracks.value;
  const totalProgress = completedTracksProgress + (currentTrackProgress * currentTrackPortion);
  const startAngle = -5;
  const totalRotationAngle = 38;
  return startAngle + (totalProgress * totalRotationAngle);
});

// --- YouTube IFrame API ---
const ytPlayerDivId = 'yt-hidden-player';
let ytPlayer: any = null;
let ytPlayerReady = false;
let ytTimeInterval: ReturnType<typeof setInterval> | null = null;

// Scratch sound
import scratchSound from '@/assets/scratch.m4a';
const scratchSoundRef = ref<HTMLAudioElement | null>(null);

function initYouTubeAPI() {
  if ((window as any).YT && (window as any).YT.Player) {
    createYTPlayer(currentSong.value?.videoId ?? '');
  } else {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    (window as any).onYouTubeIframeAPIReady = () => {
      createYTPlayer(currentSong.value?.videoId ?? '');
    };
  }
}

function createYTPlayer(videoId: string) {
  if (!document.getElementById(ytPlayerDivId)) return;
  ytPlayer = new (window as any).YT.Player(ytPlayerDivId, {
    height: '1',
    width: '1',
    videoId: videoId || '',
    playerVars: {
      autoplay: 0,
      controls: 0,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
    },
    events: {
      onReady: () => {
        ytPlayerReady = true;
        console.log('[YT] Player ready');
      },
      onStateChange: (e: any) => {
        const YT = (window as any).YT;
        if (e.data === YT.PlayerState.PLAYING) {
          if (!playerStore.isPlaying) playerStore.play();
          startTimeTracking();
        } else if (e.data === YT.PlayerState.PAUSED) {
          if (playerStore.isPlaying) playerStore.pause();
          stopTimeTracking();
        } else if (e.data === YT.PlayerState.ENDED) {
          stopTimeTracking();
          playerStore.nextTrack();
        } else if (e.data === YT.PlayerState.BUFFERING) {
          // keep current UI state
        }
      },
      onError: (e: any) => {
        console.error('[YT] Player error:', e.data);
        playerStore.pause();
      }
    }
  });
}

function loadVideoId(videoId: string) {
  if (!ytPlayer || !ytPlayerReady) {
    // retry after a short delay
    setTimeout(() => loadVideoId(videoId), 500);
    return;
  }
  if (videoId) {
    ytPlayer.loadVideoById(videoId);
    console.log('[YT] Loading video:', videoId);
  }
}

function startTimeTracking() {
  stopTimeTracking();
  ytTimeInterval = setInterval(() => {
    if (ytPlayer && ytPlayerReady) {
      const t = ytPlayer.getCurrentTime?.() ?? 0;
      const d = ytPlayer.getDuration?.() ?? 0;
      playerStore.updateCurrentTime(t);
      playerStore.updateDuration(d);
    }
  }, 500);
}

function stopTimeTracking() {
  if (ytTimeInterval !== null) {
    clearInterval(ytTimeInterval);
    ytTimeInterval = null;
  }
}

// Load album into store
watchEffect(async () => {
  const selectedId = navigationStore.selectedAlbumId;
  let id = albumId.value;
  if (selectedId && selectedId !== '') {
    id = selectedId;
    navigationStore.clearSelectedAlbumId();
  }
  if (!libraryStore.isLoaded) {
    await libraryStore.fetchLibrary();
  }
  if (id === 'first' && libraryStore.isLoaded) {
    const albums = libraryStore.getAllAlbums;
    if (albums.length > 0) {
      const firstAlbum = albums[0];
      localCurrentAlbum.value = firstAlbum;
      if (!currentAlbumFromStore.value || currentAlbumFromStore.value.id !== firstAlbum.id) {
        playerStore.loadAlbum(firstAlbum);
      }
    }
  } else if (id && id !== 'first' && libraryStore.isLoaded) {
    const albumData = libraryStore.getAlbumById(id);
    if (albumData) {
      localCurrentAlbum.value = albumData;
      if (!currentAlbumFromStore.value || currentAlbumFromStore.value.id !== albumData.id) {
        playerStore.loadAlbum(albumData);
      }
    } else {
      const albums = libraryStore.getAllAlbums;
      if (albums.length > 0) {
        localCurrentAlbum.value = albums[0];
        playerStore.loadAlbum(albums[0]);
      }
    }
  }
});

// When song changes, load into YouTube player
watch(currentSong, (newSong) => {
  if (newSong) {
    const song = newSong as any;
    const videoId = song.videoId ?? '';
    if (videoId) {
      console.log('[AlbumPlayer] Song changed, loading videoId:', videoId);
      loadVideoId(videoId);
    }
  }
}, { immediate: true });

// Sync play/pause with YouTube player
watch(isPlaying, (newIsPlaying) => {
  if (!ytPlayer || !ytPlayerReady) return;
  if (newIsPlaying) {
    ytPlayer.playVideo?.();
  } else {
    ytPlayer.pauseVideo?.();
  }
});

// Play button click
const handlePlayButtonClick = () => {
  if (scratchSoundRef.value) {
    scratchSoundRef.value.currentTime = 0;
    scratchSoundRef.value.volume = 1.0;
    scratchSoundRef.value.play().catch(() => {});
  }
  playerStore.togglePlayPause();
};

const navigateToAlbumBrowse = () => router.push('/tower');

const handleRecordClick = () => {
  if (isMobile.value) {
    navigateToAlbumBrowse();
  } else {
    handlePlayButtonClick();
  }
};

onMounted(() => {
  checkDeviceType();
  window.addEventListener('resize', checkDeviceType);
  initYouTubeAPI();
});

onUnmounted(() => {
  window.removeEventListener('resize', checkDeviceType);
  stopTimeTracking();
  if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy();
});
</script>

<template>
  <!-- Body area: use specified container and styles -->
  <div class="body-container flex items-center justify-center overflow-visible pt-[120px] pl-[60px] pr-[60px] pb-[60px]">
    <!-- Loading state -->
    <div v-if="!localCurrentAlbum && !currentAlbumFromStore" class="loading-state">
      <p>Loading Album...</p>
    </div>
    
    <!-- Content area - inside the body container -->
    <div v-else class="player-content" style="overflow: visible;">
      <!-- Outer container: player-all -->
      <div class="player-all">
        <!-- Player view container: player-view -->
        <div class="player-view" style="overflow: visible;">
          <!-- Album cover container: cover -->
          <div class="cover" style="overflow: visible; padding-top: 25px;">
            <router-link to="/tower" class="cover-link">
              <img 
                :src="displayCoverSrc" 
                :alt="(localCurrentAlbum || currentAlbumFromStore)?.title" 
                class="album-cover"
              >
            </router-link>
          </div>

          <!-- Record and tone arm container: player-record -->
          <div class="player-record" :class="{ 'playing': playerStore.isPlaying }"
               :style="{ '--album-cover-url': `url('${displayCoverSrc}')` }">
            <!-- Record combination container -->
            <div class="record-container" @click="handleRecordClick">
              <img src="@/assets/record.svg" alt="Vinyl Record" class="vinyl-svg" />
              <!-- Record label area -->
              <div class="record-album-title">
                <div class="record-label-top">
                  <span class="album-title-text">{{ (localCurrentAlbum || currentAlbumFromStore)?.title }}</span>
                </div>
                <div class="record-label-bottom">
                  <span class="album-year-text">{{ (localCurrentAlbum || currentAlbumFromStore)?.year }}</span>
                </div>
              </div>
              <!-- Record spindle -->
              <div class="record-axis"></div>
            </div>
            <div class="tone-arm" 
              :style="{ transform: `rotate(${toneArmRotation}deg)` }" 
              @click.stop="handlePlayButtonClick"
              title="Click to Play/Pause">
              <img src="@/assets/Tone Arm.svg" alt="Tone Arm" class="tone-arm-svg" />
            </div>
          </div>
        </div>

        <!-- Playback control buttons container: player-button -->
        <div class="player-button">
          <!-- Center Play/Pause button -->
          <button 
            @click="handlePlayButtonClick" 
            :disabled="totalTracks === 0" 
            class="play-button">
            <img :src="playButtonSvg" width="75" height="60" alt="Play/Pause Button">
          </button>

          <!-- Track info container -->
          <div class="info-container">
            <!-- Outer frame SVG -->
            <img :src="infoOuterSvg" class="info-frame" width="160" height="70" alt="Info Frame">
            
            <div class="info">
              <p class="track-number">Track: {{ currentTrackIndex + 1 }}/{{ totalTracks }}</p>
              <h2 class="track-title">
                {{ currentSong?.title ?? 'No Track Loaded' }}
              </h2>
            </div>
          </div>

          <!-- Previous/Next buttons container -->
          <div class="nav-buttons-container">
            <!-- Outer frame SVG -->
            <img :src="playButtonOuterSvg" class="nav-buttons-frame" width="75" height="60" alt="Button Frame">
            
            <!-- Previous button -->
            <button 
              @click="playerStore.previousTrack" 
              :disabled="totalTracks === 0" 
              class="prev-button">
              <img :src="prevButtonSvg" width="67" height="25" alt="Previous Button" style="width: 100%; height: 100%; object-fit: contain;">
            </button>
            
            <!-- Next button -->
            <button 
              @click="playerStore.nextTrack" 
              :disabled="totalTracks === 0" 
              class="next-button">
              <img :src="nextButtonSvg" width="67" height="25" alt="Next Button" style="width: 100%; height: 100%; object-fit: contain;">
            </button>
          </div>
        </div>
      </div>
    </div>
  </div> <!-- End body-container -->

  <!-- Hidden YouTube IFrame Player -->
  <div id="yt-hidden-player" style="position:fixed;width:1px;height:1px;top:-2px;left:-2px;overflow:hidden;pointer-events:none;opacity:0;"></div>

  <!-- Needle scratch sound effect -->
  <audio ref="scratchSoundRef" :src="scratchSound" preload="auto">
    Your browser does not support the audio element.
  </audio>
</template>

<style scoped>

/* Body container styles */
.body-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* No extra padding-top needed, as pt-[130px] is already added in the template */
}

/* Correct the layout inside the body container */
.player-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative; /* Add relative positioning for child element positioning */
  min-width: 725px; /* Ensure the content area is wide enough */
}

/* Album cover container */
.cover {
  position: absolute;
  z-index: 1; /* Lower z-index than the player */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  left: 0px; /* Adjust cover position to ensure it's fully visible */
  top: 5px; /* Fine-tune vertical position */
  cursor: pointer; /* Show hand cursor on hover */
}

.cover-link {
  display: block;
  cursor: pointer; /* Show hand cursor on hover */
}

/* Add album cover hover effect */
.cover-link:hover .album-cover {
  transform: rotate(-5deg) translateY(-15px); /* Maintain rotation angle, move up 15px */
  box-shadow: 0 16px 24px rgba(0, 0, 0, 0.4); /* Enhance shadow effect */
  filter: brightness(1.1); /* Increase brightness */
  opacity: 1; /* Increase opacity */
}

/* Album cover */
.album-cover {
  width: 320px;
  height: 320px;
  object-fit: cover;
  border-radius: 2px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  margin-bottom: 0; /* Remove bottom margin */
  transform: rotate(-5deg) translateY(0); /* Rotate 5 degrees counter-clockwise, initial position not shifted up */
  transition: all 0.2s ease; /* Add transition effect, extend duration for smoother animation */
  opacity: 0.9; /* Slightly reduce opacity to enhance depth */
}

/* Album title removed */

/* Player view container */
.player-view {
  display: flex;
  position: relative;
  width: 725px; /* Increase width to accommodate overlapping cover and record */
  height: 380px;
  align-items: center;
  justify-content: center;
  z-index: 2; /* Ensure player is above the cover */
}

/* Outer container: entire player */
.player-all {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto; /* Horizontally center */
  width: 100%; /* Full width */
}

/* Inner container: record and tone arm */
.player-record {
  position: absolute;
  right: 0; /* Position the record container on the right */
  width: 450px; /* Width remains unchanged */
  height: 380px;
  border-radius: 8px;
  padding: 10px;
  z-index: 3; /* Ensure record is above the cover */
}

/* Record combination container styles */
.record-container {
  position: relative;
  width: 380px;
  height: 380px;
  margin: 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  /* Remove container's rotation animation */
  cursor: pointer; /* Indicates clickable */
  transition: transform 0.2s ease, filter 0.2s ease; /* Add transition effect */
}

/* Desktop mode vinyl record hover effect */
@media (min-width: 768px) {
  .record-container:hover .vinyl-svg {
    filter: drop-shadow(-15px 10px 20px rgba(0, 0, 0, 0.8)) brightness(1.1); /* Highlight effect */
  }
}

.vinyl-svg {
  position: absolute;
  width: 380px;
  height: 380px;
  filter: drop-shadow(-15px 10px 20px rgba(0, 0, 0, 0.8)); /* Add double shadow effect */
  transition: transform 0.2s ease, filter 0.2s ease; /* Add transition effect */
}

/* Record label area styles */
.record-album-title {
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background-color: #f3f3f3;
  z-index: 4; /* Positioned above the record */
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  text-align: center;
  padding: 0;
  overflow: hidden;
  animation: rotate 20s linear infinite;
  animation-play-state: paused;
}

/* Top label area (Album Title) */
.record-label-top {
  width: 72%;
  padding: 5px;
  margin-top: 20px;
}

/* Bottom label area (Year) */
.record-label-bottom {
  width: 100%;
  padding: 5px;
  margin-bottom: 15px;
}

/* Album title text styles */
.album-title-text {
  font-family: 'Noto Serif SC', serif;
  font-size: 10px;
  font-weight: 600;
  color: #000;
  line-height: 1.2;
  display: -webkit-box;
  display: box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 30px;
}

/* Year text styles */
.album-year-text {
  font-family: 'Noto Serif SC', serif;
  font-size: 10px;
  font-weight: 600;
  color: #000;
  line-height: 1.2;
  display: inline-block;
  transform: rotate(180deg); /* Rotate 180 degrees to invert the text */
}

/* Record spindle styles */
.record-axis {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #000000;
  z-index: 5; /* Positioned above the record label area */
  /* Spindle does not rotate */
  animation: none !important;
}

/* Control rotation animation of the record label area */
.player-record.playing .record-album-title {
  animation-play-state: running;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.tone-arm {
  position: absolute;
  top: 10px;
  right: 20px; /* Adjust position to be clearly inside the container */
  transform-origin: 78.82% 20.28%; /* Set rotation origin to the right side of the tone arm (red arrow position) */
  z-index: 6; /* Ensure tone arm is above all other elements */
  transition: transform 0.5s ease, filter 0.2s ease; /* Add smooth transition effect */
  display: inline-block; /* Make container fit its content size */
  line-height: 0; /* Remove line-height gap */
  font-size: 0; /* Remove text gap */
  cursor: pointer; /* Cursor becomes pointer, indicating it's clickable */
}

.tone-arm-svg {
  width: 85px; /* 180px * 0.4 = 72px */
  height: auto;
  display: block; /* Remove image bottom gap */
}

/* Tone arm hover effect */
.tone-arm:hover {
  filter: brightness(1.1) drop-shadow(0 0 3px rgba(255, 255, 255, 0.047)); /* Highlight effect */
}

/* Track info container */
.info {
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* Left align */
  justify-content: center;
  width: 160px; /* Fixed width */
  height: 60px; /* Fixed height */
  /* Center position */
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.7); /* Black background */
  border-radius: 5px; /* Rounded corners */
  box-sizing: border-box; /* Ensure padding doesn't change element size */
}

/* Track info container */
.info-container {
  position: relative;
  width: 160px;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Outer frame styles */
.info-frame {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}

/* Track info */
.info {
  position: absolute;
  z-index: 2;
  padding: 0 0 0 15px; /* 10px from the left of the container */
  width: 156px;
  height: 56px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start; /* Left align */
  text-align: left;
}

.track-number {
  color: #9ca3af;
  margin: 2px 0;
  font-size: 14px;
  font-family: 'WenQuanYiBitmapSong', monospace; /* WenQuanYi Bitmap Song font */
  width: 100%;
  text-align: left;
  letter-spacing: 0.5px; /* Increase letter spacing for a more pixelated feel */
}

.track-title {
  color: white;
  font-size: 14px; /* Reduce font size, same as track */
  font-weight: 600;
  margin: 2px 0;
  text-align: left; /* Left align */
  max-width: 140px; /* Adjust to fit the new container */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'WenQuanYiBitmapSong', monospace; /* WenQuanYi Bitmap Song font */
  width: 100%;
  letter-spacing: 0.5px; /* Increase letter spacing for a more pixelated feel */
}

/* Inner container: playback control buttons */
.player-button {
  display: flex;
  flex-direction: row;
  justify-content: space-between; /* Justify space between, align to container edges */
  align-items: flex-end; /* Use flex-end instead of bottom, as bottom is not a valid align-items value */
  width: 450px; /* Match the width of the player-record container */
  padding: 10px; /* Add padding */
  margin-top: 30px;
  border-radius: 8px;
  position: relative; /* Provide a reference point for absolutely positioned inner elements */
  min-height: 60px; /* Ensure height is sufficient to contain the info container */
}

/* Skeuomorphic play/pause button */
.play-button {
  margin: 0 15px;
  width: 75px; /* Calculated based on original ratio: (60/66)*82 is approx 75 */
  height: 60px; /* Adjust to 60px */
  border: none;
  cursor: pointer;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
  outline: none;
  align-self: flex-end; /* Align to the bottom of the parent container */
}

.play-button:hover {
  opacity: 0.9;
}

.play-button:active {
  transform: translateY(1px);
}

.play-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.play-icon, .pause-icon {
  width: 40px;
  height: 40px;
  fill: white;
}

/* Navigation buttons container */
.nav-buttons-container {
  position: relative;
  margin: 0 15px;
  width: 75px; /* Same width as the play button */
  height: 60px; /* Same height as the play button */
  display: flex;
  flex-direction: column; /* Vertical layout */
  justify-content: space-between; /* Space-between to ensure buttons are flush with container edges */
  align-items: center; /* Horizontally center */
  align-self: flex-end; /* Align to the bottom within the parent container */
  padding: 4px 0; /* 4px padding top and bottom */
  box-sizing: border-box; /* Ensure padding is included in total height */
  max-width: 450px; /* Limit max width */
  left: 0; /* Reset potential positioning */
  right: 0; /* Reset potential positioning */
}

/* Outer frame styles */
.nav-buttons-frame {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  pointer-events: none;
}

/* Previous/Next button styles */
.prev-button, .next-button {
  position: relative;
  z-index: 2;
  background: transparent; /* Remove background color */
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  width: 67px; /* Same width as container */
  height: 25px; /* Adjust height to fit container */
  display: flex;
  align-items: stretch; /* Ensure child elements stretch to fill the container */
  justify-content: stretch; /* Ensure child elements stretch to fill the container */
  transition: opacity 0.2s ease;
  outline: none;
  overflow: visible; /* Allow content to overflow to show the full SVG */
  border-radius: 0; /* Remove potential border-radius */
}

/* Remove extra margin from buttons, controlled by container padding */
.prev-button, .next-button {
  margin: 0;
}

.prev-button:hover, .next-button:hover {
  opacity: 0.9;
}

.prev-button:active, .next-button:active {
  opacity: 0.8;
  transform: translateY(1px);
}

.prev-button:disabled, .next-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Loading state */
.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 300px;
}

.loading-state p {
  color: white;
  font-size: 20px;
}

/* Responsive adjustments */
/* Styles for medium screen devices */
@media (max-width: 767px) {
  .body-container {
    padding-top: 80px;
    padding-left: 0;
    padding-right: 0;
    display: flex;
    justify-content: center;
  }
  
  .player-all {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc((100vh - 580px)/3); /* Add adaptive spacing */
  }
  
  .player-button {
    margin: 0 auto;  /* Horizontally center */
    transform: scale(0.9);
    width: 90%;  /* Adjust width to fit mobile */
    justify-content: center;  /* Center inner elements */
    padding: 10px 0;  /* Remove left/right padding */
    box-sizing: border-box;  /* Ensure padding is included in total width */
    max-width: 500px;  /* Limit max width */
    left: 0;  /* Reset potential positioning */
    right: 0;  /* Reset potential positioning */
  }
  
  /* Adjust inner element margins for a more compact layout */
  .play-button {
    margin: 0 15px;
  }
  
  .info-container {
    margin: 0 15px;
  }
  
  .nav-buttons-container {
    margin: 0 15px;
  }
  
  .player-view {
    width: 450px;
    padding: 0;
    position: relative !important; /* Override absolute positioning from desktop styles */
    right: 0 !important; /* Reset right positioning */
    margin-right: 10vw !important; /* Keep a distance of 10% of the viewport width from the right edge */
  }
  .player-record {
    padding: 0;
  }
  .player-content {
    flex-direction: column;
    gap: 0;
    height: auto;
    min-height: 0;
  }

  .album-cover {
    width: 320px;
    height: 320px;
  }
  
  .album-title {
    max-width: 320px;
  }
  
  .track-title {
    max-width: 320px;
  }
  
  .record-axis {
    display: none;
  }
  
  .vinyl-svg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: auto;
    width:342px;
    height: 342px;
  }

  /* Adjust tone arm size and position */
  .tone-arm {
    top: 10px;
    right: 35px;
    transform: scale(0.9);
  }

  .tone-arm-svg {
    width: 76.5px;
  }
  
  /* Mobile-specific styles */
  /* Hide album cover container */
  .cover {
    display: none;
  }
  
  /* Hide record center label area */
  .record-album-title {
    display: none;
  }
  
  /* Center player-record on mobile */
  .player-record {
    position: relative;
    right: auto;
    left: auto;
    margin: 0 0;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  /* Add album cover to the center of the record */
  .record-container {
    position: relative;
    width: 342px;
    height: 342px;
  }
  
  .record-container::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: auto;
    width: 108px;
    height: 108px;
    border-radius: 50%;
    background-image: var(--album-cover-url);
    background-size: cover;
    background-position: center;
    z-index: 4;
    /* Add black border */
    border: 2px solid #000;
    /* Add dark overlay */
    box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.6);
    /* Slightly reduce brightness, increase contrast */
    filter: brightness(0.8) contrast(1.2);
    /* Rotate with the record */
    animation: rotate 20s linear infinite;
    animation-play-state: paused;
  }
  
  /* When the record spins, the cover image spins too */
  .player-record.playing .record-container::after {
    animation-play-state: running;
  }
}

</style>
