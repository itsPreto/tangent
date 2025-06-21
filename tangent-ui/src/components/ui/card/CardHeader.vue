// src/components/ui/card/CardHeader.vue
<template>
  <div class="flex flex-col space-y-1.5 p-6" :class="className">
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  className?: string
}>();
</script>