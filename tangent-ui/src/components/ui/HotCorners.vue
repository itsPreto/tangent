<template>
  <div class="hot-corners-container">
    <!-- Bottom Left Corner -->
    <div 
      class="hot-corner bottom-left"
      @mouseenter="showIndicator('bottom-left')"
      @mouseleave="hideIndicator('bottom-left')"
      @click="$emit('toggle')"
    >
      <div 
        class="corner-indicator" 
        :class="{ 'visible': indicators['bottom-left'] }"
      ></div>
    </div>

    <!-- Bottom Center -->
    <div 
      class="hot-corner bottom-center"
      @mouseenter="showIndicator('bottom-center')"
      @mouseleave="hideIndicator('bottom-center')"
      @click="$emit('toggle')"
    >
      <div 
        class="corner-indicator" 
        :class="{ 'visible': indicators['bottom-center'] }"
      ></div>
    </div>

    <!-- Bottom Right Corner -->
    <div 
      class="hot-corner bottom-right"
      @mouseenter="showIndicator('bottom-right')"
      @mouseleave="hideIndicator('bottom-right')"
      @click="$emit('toggle')"
    >
      <div 
        class="corner-indicator" 
        :class="{ 'visible': indicators['bottom-right'] }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  (e: 'toggle'): void
}>();

const indicators = ref({
  'bottom-left': false,
  'bottom-center': false,
  'bottom-right': false
});

const showIndicator = (corner: string) => {
  indicators.value[corner] = true;
};

const hideIndicator = (corner: string) => {
  indicators.value[corner] = false;
};
</script>

<style scoped>
.hot-corners-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  pointer-events: none;
  z-index: 1000;
}

.hot-corner {
  position: absolute;
  width: 60px;
  height: 60px;
  pointer-events: auto;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hot-corner.bottom-left {
  bottom: 0;
  left: 0;
  border-radius: 0 100% 0 0;
}

.hot-corner.bottom-center {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 50% 50% 0 0;
}

.hot-corner.bottom-right {
  bottom: 0;
  right: 0;
  border-radius: 100% 0 0 0;
}

.corner-indicator {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa, #c084fc, #f472b6);
  box-shadow: 
    0 4px 15px rgba(96, 165, 250, 0.4),
    0 0 30px rgba(192, 132, 252, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.corner-indicator.visible {
  opacity: 1;
  transform: scale(1);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 
      0 4px 15px rgba(96, 165, 250, 0.4),
      0 0 30px rgba(192, 132, 252, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  50% {
    box-shadow: 
      0 6px 25px rgba(96, 165, 250, 0.6),
      0 0 50px rgba(192, 132, 252, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }
}

.hot-corner:hover .corner-indicator {
  transform: scale(1.2);
  box-shadow: 
    0 8px 30px rgba(96, 165, 250, 0.7),
    0 0 60px rgba(192, 132, 252, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.hot-corner:active .corner-indicator {
  transform: scale(0.9);
  transition: all 0.1s ease;
}
</style>