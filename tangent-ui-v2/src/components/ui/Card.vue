<!-- src/components/ui/Card.vue -->
<template>
    <div 
      class="rounded-lg border bg-card text-card-foreground shadow"
      :class="className"
    >
      <slot />
    </div>
  </template>
  
  <script setup>
  defineProps({
    className: {
      type: String,
      default: ''
    }
  });
  </script>