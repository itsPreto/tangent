<!-- src/components/ui/AlertDescription.vue -->
<template>
    <div
      class="text-sm [&_p]:leading-relaxed"
      :class="className"
    >
      <slot />
    </div>
  </template>
  
  <script setup lang="ts">
  defineProps<{
    className?: string
  }>()
  </script>