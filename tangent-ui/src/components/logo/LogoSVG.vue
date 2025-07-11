<template>
  <svg viewBox="0 0 200 45" class="absolute inset-0">
    <!-- Dynamic wave patterns -->
    <path
      d="M 20 22.5 C 40 22.5, 45 12, 65 12 S 90 33, 110 33 S 135 12, 155 12 S 180 22.5, 200 22.5"
      fill="none"
      :stroke="isDark ? '#ffffff' : '#000000'"
      stroke-width="1"
    />

    <!-- Fractal-like pattern -->
    <path
      d="M 100 22.5 C 105 22.5, 110 18, 120 18 S 135 27, 145 27 S 155 18, 165 18"
      fill="none"
      :stroke="themeColors.primary"
      stroke-width="1"
    />
    <path
      d="M 100 22.5 C 95 22.5, 90 27, 80 27 S 65 18, 55 18 S 45 27, 35 27"
      fill="none"
      :stroke="themeColors.secondary"
      stroke-width="1"
    />

    <!-- Geometric accents -->
    <path
      v-for="i in 8"
      :key="`right-${i}`"
      :d="`M ${100 + i * 10} 22.5 L ${105 + i * 10} 15 L ${110 + i * 10} 22.5`"
      fill="none"
      :stroke="themeColors.accent"
      stroke-width="0.5"
      :stroke-opacity="0.3"
    />
    <path
      v-for="i in 8"
      :key="`left-${i}`"
      :d="`M ${100 - i * 10} 22.5 L ${95 - i * 10} 30 L ${90 - i * 10} 22.5`"
      fill="none"
      :stroke="themeColors.primary"
      stroke-width="0.5"
      :stroke-opacity="0.3"
    />

    <!-- Dynamic circles -->
    <circle
      v-for="i in 5"
      :key="`right-circle-${i}`"
      :cx="100 + i * 20"
      :cy="22.5 + Math.sin(i * 1.5) * 5"
      :r="1.2 - i * 0.15"
      :fill="themeColors.primary"
    />
    <circle
      v-for="i in 5"
      :key="`left-circle-${i}`"
      :cx="100 - i * 20"
      :cy="22.5 + Math.cos(i * 1.5) * 5"
      :r="1.2 - i * 0.15"
      :fill="themeColors.secondary"
    />

    <!-- Central focal point -->
    <path
      d="M 95 22.5 L 105 22.5 M 100 17.5 L 100 27.5"
      :stroke="isDark ? '#ffffff' : '#000000'"
      stroke-width="1.5"
    />
    <circle
      cx="100"
      cy="22.5"
      r="2.5"
      :fill="isDark ? '#ffffff' : '#000000'"
    />

    <!-- Abstract mathematical symbols -->
    <path
      d="M 160 15 A 5 5 0 0 1 170 15 A 5 5 0 0 1 160 15"
      fill="none"
      :stroke="themeColors.accent"
      stroke-width="0.75"
      :stroke-opacity="0.5"
    />
    <path
      d="M 30 30 A 5 5 0 0 0 40 30 A 5 5 0 0 0 30 30"
      fill="none"
      :stroke="themeColors.primary"
      stroke-width="0.75"
      :stroke-opacity="0.5"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/themeStore'

const themeStore = useThemeStore()

const themeColors = computed(() => themeStore.currentThemeColors)
const isDark = computed(() => themeStore.isDarkTheme(themeStore.currentTheme))
</script>