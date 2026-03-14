<template>
  <div class="app-container relative">
    <!-- Fixed title area -->
    <div class="title-container fixed z-10 top-0 left-0 right-0">
      <h1>Dedicated to Sunflower</h1>
    </div>

    <!-- Content area - only this part changes with the route -->
    <div class="content-container">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>
  </div>
  
  <!-- Footer area - fixed at the bottom -->
  <div class="footer fixed z-10 bottom-0 left-0 right-0">
    <div class="flex justify-end w-full px-4 items-center">
      <p class="text-sm footer-item">Ayaan Ji &mdash; Music for the soul</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// No dynamic stats needed
</script>

<style>
/* Global styles */
body {
  margin: 0;
  padding: 0;
  background-color: #121212;
  color: #f3f3f3;
  font-family: 'Outfit', 'Pacifico', -apple-system, BlinkMacSystemFont, sans-serif;
  overflow-x: hidden;
}

.app-container {
  min-height: 100vh;
  width: 100%;
  position: relative;
}

/* Page transition animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ===== Desktop Styles ===== */

/* Title styles */
.title-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  width: 100%;
  display: flex;
  align-items: center;
  padding-left: 60px;
  z-index: 1000; /* Ensure it's on the top layer */
  box-sizing: border-box;
}

/* Title styles */
.title-container h1 {
  color: #FFFFFF;
  width: auto;
  white-space: nowrap;
  height: 48px;
  font-size: 42px;
  font-family: 'Fleur De Leah', cursive;
  line-height: 48px;
  margin: 30px 0;
  padding: 0;
  text-align: left;
  font-weight: normal;
}

/* Content area styles */
.content-container {
  position: fixed;
  top: 120px; /* Same height as the title container */
  left: 30px;
  right: 30px;
  bottom: 60px; /* Leave space for the footer */
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center; /* Vertically center */
}

/* Footer styles */
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 60px;
  height: 60px;
  width: 100%;
  display: flex;
  align-items: center;
  color: #bbb;
  font-size: 12px;
  z-index: 1000; /* Ensure it's on the top layer */
  box-sizing: border-box;
}

.footer-item {
  margin-left: 8px;
  white-space: nowrap;
}



.github-link {
  color: #bbb;
  text-decoration: underline;
  transition: color 0.2s ease;
}

.github-link:hover {
  color: #fff;
  text-decoration: underline;
}

/* ===== Mobile Styles ===== */
@media (max-width: 767px) {
  /* Mobile title styles */
  .title-container {
    height: 80px;
    padding-left: 30px;
  }
  
  .title-container h1 {
    width: 100%;
    font-size: 20px;
    margin: 0;
    text-align: left;
    margin-top: 10px;
  }

  /* Mobile content area styles */
  .content-container {
    top: 80px; /* Same height as the mobile title container */
    left: 30px;
    right: 30px;
    bottom: 50px; /* Leave space for the mobile footer */
  }
  
  /* Mobile footer styles */
  .footer {
    height: 50px;
    padding: 0 15px;
  }
  
  .footer-item {
    font-size: 10px;
    margin-left: 5px;
  }
  
  .online-dot {
    width: 6px;
    height: 6px;
    margin-right: 3px;
  }
  
  /* Adjust layout on very small screens */
  @media (max-width: 480px) {
    .footer .flex {
      flex-direction: row;
      justify-content: flex-end;
      align-items: center;
      height: 100%;
    }
    
    .footer-item {
      font-size: 9px;
      margin-left: 3px;
    }
    
    .online-dot {
      width: 5px;
      height: 5px;
      margin-right: 2px;
    }
  }
}
</style>
