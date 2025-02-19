<template>
  <div :class="[
    'relative w-full rounded-lg border p-4',
    variantStyles[variant || 'default'],
    className
  ]" role="alert">
    <slot />
  </div>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'default' | 'destructive',
  className?: string
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  className: ''
})

const variantStyles = {
  default: 'bg-background text-foreground',
  destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive'
}
</script>