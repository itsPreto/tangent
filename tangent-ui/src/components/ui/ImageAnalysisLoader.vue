<template>
  <div class="image-analysis-loader">
    <div class="loader-grid">
      <div v-for="i in 9" :key="i" class="grid-cell" :class="`pattern-${(i % 4) + 1}`"></div>
    </div>
    <div class="magnifying-glass" :style="magnifyingGlassStyle">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
        <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

const position = ref({ x: 0, y: 0 })
const animationId = ref<number>()

const magnifyingGlassStyle = computed(() => ({
  transform: `translate(${position.value.x}px, ${position.value.y}px)`
}))

const animateMagnifyingGlass = () => {
  const time = Date.now() * 0.001
  const centerX = 40
  const centerY = 40
  const radius = 30
  
  // Create random-looking movement pattern
  const angle = time * 0.5 + Math.sin(time * 0.3) * 2
  const radiusVariation = radius + Math.sin(time * 0.7) * 10
  
  position.value.x = centerX + Math.cos(angle) * radiusVariation - 12
  position.value.y = centerY + Math.sin(angle) * radiusVariation - 12
  
  animationId.value = requestAnimationFrame(animateMagnifyingGlass)
}

onMounted(() => {
  animateMagnifyingGlass()
})

onUnmounted(() => {
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }
})
</script>

<style scoped>
.image-analysis-loader {
  position: relative;
  width: 100px;
  height: 100px;
  margin: 0 auto;
}

.loader-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  width: 100%;
  height: 100%;
  gap: 2px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.grid-cell {
  background: rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;
}

.grid-cell::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.3;
}

.pattern-1::before {
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 3px,
    rgba(139, 92, 246, 0.3) 3px,
    rgba(139, 92, 246, 0.3) 6px
  );
}

.pattern-2::before {
  background: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 3px,
    rgba(59, 130, 246, 0.3) 3px,
    rgba(59, 130, 246, 0.3) 6px
  );
}

.pattern-3::before {
  background: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 3px,
    rgba(236, 72, 153, 0.3) 3px,
    rgba(236, 72, 153, 0.3) 6px
  );
}

.pattern-4::before {
  background: radial-gradient(
    circle at center,
    rgba(34, 197, 94, 0.3) 0%,
    transparent 70%
  );
}

.magnifying-glass {
  position: absolute;
  width: 24px;
  height: 24px;
  color: rgba(255, 255, 255, 0.8);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  transition: none;
  pointer-events: none;
  z-index: 10;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

.grid-cell {
  animation: pulse 2s ease-in-out infinite;
  animation-delay: calc(var(--i, 0) * 0.1s);
}

.grid-cell:nth-child(1) { --i: 0; }
.grid-cell:nth-child(2) { --i: 1; }
.grid-cell:nth-child(3) { --i: 2; }
.grid-cell:nth-child(4) { --i: 3; }
.grid-cell:nth-child(5) { --i: 4; }
.grid-cell:nth-child(6) { --i: 5; }
.grid-cell:nth-child(7) { --i: 6; }
.grid-cell:nth-child(8) { --i: 7; }
.grid-cell:nth-child(9) { --i: 8; }
</style>