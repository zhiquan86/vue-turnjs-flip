<template>
  <div class="app">
    <BookFlip
      :pages="pages"
      v-model:currentPage="currentPage"
      :flipDuration="600"
      @flip="handleFlip"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BookFlip from './components/BookFlip.vue'

const currentPage = ref(0)

const pages = ref([
  { content: 'Introduction to Vue 3' },
  { content: 'Setting Up Your First App' },
  { content: 'Understanding the Composition API' },
  { content: 'Building Reusable Components' },
  { content: 'State Management with Pinia' },
  { content: 'Routing and Navigation' },
  { content: 'Testing Your Application' },
  { content: 'Deployment Best Practices' }
])

const handleFlip = (direction: 'next' | 'prev') => {
  console.log(`Flipped ${direction}, now on page ${currentPage.value + 1}`)
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app {
  width: 100%;
  height: 100%;
}
</style>
