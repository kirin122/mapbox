<template>
  <main>
    <MapboxMap />
  </main>
</template>

<script setup lang="ts">
import MapboxMap from './components/MapboxMap.vue'
</script>

<style lang="css" scoped>
main {
  height: 100vh;
  width: 100vw;
  position: relative;
}
</style>