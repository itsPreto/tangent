// src/components/ui/card/Card.vue
<template>
  <div 
    class="rounded-lg border bg-card text-card-foreground shadow"
    :class="className"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  className?: string
}>();
</script>

<style scoped>
.bg-card {
  background-color: rgb(var(--color-base-100) / 1);
}

.text-card-foreground {
  color: rgb(var(--color-base-content) / 1);
}

.shadow {
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
}

.border {
  border-width: 1px;
  border-color: rgb(var(--color-base-300) / 1);
}
</style>