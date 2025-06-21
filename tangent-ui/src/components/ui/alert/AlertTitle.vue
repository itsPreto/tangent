<!-- src/components/ui/AlertTitle.vue -->
<template>
    <h5
      class="mb-1 font-medium leading-none tracking-tight"
      :class="className"
    >
      <slot />
    </h5>
  </template>
  
  <script setup lang="ts">
  defineProps<{
    className?: string
  }>()
  </script>