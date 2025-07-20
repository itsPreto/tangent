<template>
  <div class="bottom-docker fixed bottom-3 left-1/2 transform -translate-x-1/2 z-40">
    <div class="docker-container flex items-center gap-2">
      
      <!-- Curvature Control -->
      <div class="control-item">
        <input 
          type="range" 
          :value="curvature" 
          @input="updateCurvature($event.target.value)"
          min="0" 
          max="3" 
          step="0.01"
          class="curvature-slider"
          title="Curvature"
        />
      </div>

      <!-- Zoom Info -->
      <div class="control-item">
        <span class="info-text">{{ Math.round(zoom * 100) }}%</span>
      </div>

      <!-- Pan Coordinates -->
      <div class="control-item">
        <span class="info-text coords">{{ Math.round(panX) }}, {{ Math.round(panY) }}</span>
      </div>

      <!-- Fit to View -->
      <button 
        @click="fitToView"
        :class="['control-button', { 'pulse-animate': isOutsideBounds }]"
        title="Fit to View (Cmd+C)"
      >
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
        </svg>
      </button>

      <!-- Gesture Mode Toggle -->
      <button 
        @click="toggleGestureMode"
        :class="['control-button', { 'active': gestureMode === 'zoom' }]"
        :title="`Trackpad: ${gestureMode === 'zoom' ? 'Zoom' : 'Pan'} Mode`"
      >
        <svg v-if="gestureMode === 'zoom'" class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
        </svg>
        <svg v-else class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

// Props
const props = defineProps<{
  curvature: number;
  zoom: number;
  panX: number;
  panY: number;
  isPanMode: boolean;
  gestureMode?: 'scroll' | 'zoom';
  isOutsideBounds?: boolean;
  mouseX?: number;
  mouseY?: number;
}>();

// Emits
const emit = defineEmits<{
  'update:curvature': [value: number];
  'fit-to-view': [];
  'toggle-pan-mode': [];
  'toggle-gesture-mode': [];
}>();

// Methods
const updateCurvature = (value: string) => {
  emit('update:curvature', parseFloat(value));
};

const fitToView = () => {
  emit('fit-to-view');
};

const togglePanMode = () => {
  emit('toggle-pan-mode');
};

const toggleGestureMode = () => {
  emit('toggle-gesture-mode');
};
</script>

<style scoped>
.bottom-docker {
  user-select: none;
  pointer-events: auto;
}

.docker-container {
  background: rgba(var(--b2), 0.9);
  backdrop-filter: blur(12px);
  border-radius: 20px;
  padding: 4px 8px;
  box-shadow: 0 1px 3px rgba(var(--bc), 0.2);
  border: 1px solid rgba(var(--bc), 0.1);
}

.control-item {
  display: flex;
  align-items: center;
  height: 24px;
  padding: 0 4px;
}

.info-text {
  font-size: 11px;
  color: rgba(var(--bc), 0.8);
  font-weight: 500;
  white-space: nowrap;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', 'Monaco', monospace;
}

.coords {
  min-width: 60px;
  text-align: center;
}

.curvature-slider {
  width: 60px;
  height: 4px;
  background: #6b7280;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
  border-radius: 2px;
  border: 1px solid #4b5563;
}

.curvature-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  background: #6b7280;
  border-radius: 2px;
  border: 1px solid #4b5563;
}

.curvature-slider::-moz-range-track {
  width: 100%;
  height: 4px;
  background: #6b7280;
  border-radius: 2px;
  border: 1px solid #4b5563;
  border: none;
}

.curvature-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  transition: all 0.1s ease;
  border: 1px solid #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.curvature-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.curvature-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 1px solid #ffffff;
  transition: all 0.1s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.curvature-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
}

.control-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  color: rgba(var(--bc), 0.7);
}

.control-button:hover {
  background: rgba(var(--bc), 0.1);
  color: rgba(var(--bc), 0.9);
}

.control-button.active {
  background: rgba(var(--p), 0.5);
  color: rgba(var(--pc), 1);
  box-shadow: 0 0 0 1px rgba(var(--p), 0.8);
}

.control-button.pulse-animate {
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    background: oklch(from oklch(var(--p)) l c h / 0.1);
    box-shadow: 0 0 0 1px oklch(from oklch(var(--p)) l c h / 0.3);
    transform: scale(1);
  }
  50% {
    background: oklch(from oklch(var(--p)) l c h / 0.3);
    box-shadow: 0 0 0 2px oklch(from oklch(var(--p)) l c h / 0.6), 0 0 8px oklch(from oklch(var(--p)) l c h / 0.4);
    transform: scale(1.05);
  }
}

.icon {
  width: 14px;
  height: 14px;
}

/* Responsive */
@media (max-width: 640px) {
  .coords {
    display: none;
  }
  
  .curvature-slider {
    width: 50px;
  }
}
</style>