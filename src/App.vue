<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="topbar-inner">
        <RouterLink to="/" class="brand">
          <span class="brand-icon">💪</span>
          <span class="brand-name">Arm<b>Table</b></span>
        </RouterLink>
        <span class="topbar-note">круговые турниры · работает офлайн</span>
      </div>
    </header>
    <main class="container">
      <RouterView />
    </main>
  </div>
</template>
