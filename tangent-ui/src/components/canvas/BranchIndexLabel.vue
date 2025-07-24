<template>
  <div 
    class="branch-index-label"
    :style="labelStyle"
  >
    {{ nodeIndex }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/themeStore'

interface Props {
  node: any
  nodeIndex: number
  zoom: number
}

const props = defineProps<Props>()
const themeStore = useThemeStore()

// Position label at leftmost top edge of the node
const labelStyle = computed(() => {
  const baseSize = 16
  const scaledSize = baseSize / Math.max(props.zoom, 0.1) // Scale inversely with zoom like spline labels
  
  // Position at top-left corner, slightly offset from the node
  const leftOffset = -scaledSize * 1.5 // Move left of the node
  const topOffset = -scaledSize * 0.5 // Slightly above the node
  
  return {
    position: 'absolute',
    left: `${leftOffset}px`,
    top: `${topOffset}px`,
    fontSize: `${scaledSize * 0.75}px`, // Slightly smaller text relative to circle
    fontWeight: '700',
    color: 'var(--node-color)',
    backgroundColor: 'rgba(var(--b1), 0.95)',
    border: '2px solid var(--node-color)',
    borderRadius: '50%',
    width: `${scaledSize}px`,
    height: `${scaledSize}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(12px)',
    zIndex: 100,
    pointerEvents: 'none',
    transformOrigin: 'center',
    transition: 'all 0.2s ease',
    // Add shadow for better visibility
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(var(--node-color-rgb), 0.2)',
    // Ensure text is crisp at different zoom levels
    textRendering: 'optimizeLegibility',
    fontVariantNumeric: 'tabular-nums',
  }
})
</script>

<style scoped>
.branch-index-label {
  user-select: none;
  font-variant-numeric: tabular-nums;
}
</style>