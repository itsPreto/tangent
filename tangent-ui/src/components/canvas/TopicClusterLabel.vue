<template>
  <div
    class="topic-cluster-label"
    :style="{
      transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
      opacity: visible ? 1 : 0,
      '--topic-color': topicColor,
    }"
  >
    <div class="topic-circle">
      <div class="topic-inner">
        <div class="topic-title">{{ topic.topic }}</div>
        <div class="topic-meta">
          <span class="topic-count">{{ topic.size }} items</span>
          <span class="topic-coherence" v-if="topic.coherence > 0.5">
            {{ Math.round(topic.coherence * 100) }}% related
          </span>
        </div>
      </div>
    </div>
    <div class="topic-connector" v-if="showConnector"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Topic {
  topic: string
  size: number
  coherence: number
}

interface Position {
  x: number
  y: number
}

const props = defineProps<{
  topic: Topic
  position: Position
  scale: number
  visible: boolean
  showConnector?: boolean
}>()

// Generate consistent color based on topic name
const topicColor = computed(() => {
  const hash = props.topic.topic
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  // Use hash to generate hue value (0-360)
  const hue = hash % 360
  
  // Use oklch for consistent lightness across themes
  return `oklch(65% 0.15 ${hue})`
})
</script>

<style scoped>
.topic-cluster-label {
  position: absolute;
  pointer-events: auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: center;
  z-index: 10;
}

.topic-circle {
  position: relative;
  width: 600px;
  height: 200px;
  border-radius: 30px;
  background: oklch(from var(--topic-color) l c h / 0.35);
  border: 8px solid oklch(from var(--topic-color) l c h / 0.95);
  backdrop-filter: blur(15px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 
    0 20px 80px oklch(from var(--topic-color) l c h / 0.5),
    0 10px 40px oklch(from oklch(var(--bc)) l c h / 0.2);
}

.topic-circle:hover {
  transform: scale(1.05);
  background: oklch(from var(--topic-color) l c h / 0.25);
  box-shadow: 
    0 12px 48px oklch(from var(--topic-color) l c h / 0.4),
    0 4px 16px oklch(from oklch(var(--bc)) l c h / 0.15);
}

.topic-inner {
  text-align: center;
  padding: 30px;
  max-width: 540px;
  width: 100%;
}

.topic-title {
  font-size: 48px;
  font-weight: 900;
  color: oklch(var(--bc));
  margin-bottom: 12px;
  line-height: 0.9;
  text-shadow: 
    0 4px 8px oklch(from oklch(var(--bc)) l c h / 0.4),
    0 2px 4px oklch(from oklch(var(--bc)) l c h / 0.6);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-align: center;
  letter-spacing: -1px;
  text-transform: uppercase;
}

.topic-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 18px;
  opacity: 0.9;
  font-weight: 600;
}

.topic-count {
  color: oklch(from var(--topic-color) l c h);
  font-weight: 600;
}

.topic-coherence {
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
  font-weight: 500;
}

.topic-connector {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 100px;
  background: linear-gradient(
    to bottom,
    var(--topic-color),
    transparent
  );
  transform: translate(-50%, -50%);
  opacity: 0.3;
}

/* Responsive scaling for different zoom levels */
@media (max-width: 1024px) {
  .topic-circle {
    width: 160px;
    height: 160px;
  }
  
  .topic-title {
    font-size: 16px;
  }
  
  .topic-inner {
    padding: 16px;
    max-width: 128px;
  }
}

/* Ultra-zoomed out state */
.topic-cluster-label.ultra-zoom {
  .topic-circle {
    width: 120px;
    height: 120px;
  }
  
  .topic-title {
    font-size: 14px;
    -webkit-line-clamp: 1;
  }
  
  .topic-meta {
    display: none;
  }
}

/* Animation keyframes */
@keyframes fadeInScale {
  0% {
    opacity: 0;
    transform: translate(var(--x), var(--y)) scale(0.5);
  }
  100% {
    opacity: 1;
    transform: translate(var(--x), var(--y)) scale(var(--scale));
  }
}

.topic-cluster-label.entering {
  animation: fadeInScale 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>