<script setup lang="ts">
import DefaultTheme from '@10coding/vitepress-react/theme'

import HomeHeroCopy from './HomeHeroCopy.vue'

const INSTALL_COMMAND = 'npx vitepress-react init'
</script>

<template>
  <DefaultTheme.Layout>
    <template #home-hero-actions-before-actions>
      <HomeHeroCopy :command="INSTALL_COMMAND" />
    </template>
  </DefaultTheme.Layout>
</template>
