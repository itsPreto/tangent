<!-- src/components/ui/Alert.vue -->
<template>
    <div
      :class="[
        'relative w-full rounded-lg border p-4',
        variantStyles[variant],
        className
      ]"
      role="alert"
    >
      <slot />
    </div>
  </template>
  
  <script setup lang="ts">
  const props = defineProps<{
    variant?: 'default' | 'destructive',
    className?: string
  }>()
  
  const variantStyles = {
    default: 'bg-background text-foreground',
    destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive'
  }
  </script>