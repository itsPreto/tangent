// src/components/ui/card/CardContent.vue
<template>
  <div class="p-6 pt-0" :class="className">
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  className?: string
}>();
</script>