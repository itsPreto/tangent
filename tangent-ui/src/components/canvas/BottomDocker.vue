<template>
  <div class="bottom-docker fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
    <div class="docker-container">
      
      <!-- Curvature Control Group -->
      <div class="control-group curvature-group">
        <div class="control-label">
          <svg class="label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          <span class="label-text">Curve</span>
        </div>
        <div class="slider-container">
          <input 
            type="range" 
            :value="curvature" 
            @input="updateCurvature($event.target.value)"
            min="0" 
            max="3" 
            step="0.01"
            class="curvature-slider"
          />
          <div class="slider-value">{{ curvature.toFixed(2) }}</div>
        </div>
      </div>

      <div class="separator"></div>

      <!-- Info Group -->
      <div class="control-group info-group">
        <div class="info-item">
          <div class="info-label">Zoom</div>
          <div class="info-value">{{ zoom >= 0.01 ? Math.round(zoom * 100) + '%' : (zoom * 100).toFixed(2) + '%' }}</div>
        </div>
        <div class="info-item coords-item">
          <div class="info-label">Position</div>
          <div class="info-value coords">{{ Math.round(panX) }}, {{ Math.round(panY) }}</div>
        </div>
      </div>

      <div class="separator"></div>

      <!-- Action Group -->
      <div class="control-group action-group">
        <div class="action-item">
          <div class="action-label">Center</div>
          <button 
            @click="fitToView"
            :class="['action-button', { 'pulse-animate': isOutsideBounds }]"
            title="Fit to View (Cmd+C)"
          >
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
            </svg>
          </button>
        </div>

        <div class="action-item">
          <div class="action-label">{{ gestureMode === 'zoom' ? 'Zoom' : 'Pan' }}</div>
          <button 
            @click="toggleGestureMode"
            :class="['action-button', { 'active': gestureMode === 'zoom' }]"
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
    </div>
  </div>
</template>

<script setup lang="ts">

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
  isArranging?: boolean;
}>();

// Emits
const emit = defineEmits<{
  'update:curvature': [value: number];
  'fit-to-view': [];
  'toggle-pan-mode': [];
  'toggle-gesture-mode': [];
  'auto-arrange': [];
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

const autoArrange = () => {
  emit('auto-arrange');
};

</script>

<style scoped>
.bottom-docker {
  user-select: none;
  pointer-events: auto;
}

.docker-container {
  display: flex;
  align-items: center;
  background: rgba(var(--b2), 0.95);
  backdrop-filter: blur(16px);
  border-radius: 16px;
  padding: 8px 12px;
  box-shadow: 
    0 4px 12px rgba(var(--bc), 0.15),
    0 0 0 1px rgba(var(--bc), 0.08);
  border: 1px solid rgba(var(--bc), 0.12);
  gap: 12px;
}

/* Control Groups */
.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.curvature-group {
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

.info-group {
  gap: 8px;
}

.action-group {
  gap: 8px;
}

/* Separators */
.separator {
  width: 1px;
  height: 32px;
  background: rgba(var(--bc), 0.15);
  border-radius: 0.5px;
}

/* Control Labels */
.control-label {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
}

.label-icon {
  width: 12px;
  height: 12px;
  color: rgba(var(--bc), 0.6);
}

.label-text {
  font-size: 10px;
  font-weight: 600;
  color: rgba(var(--bc), 0.7);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Slider Container */
.slider-container {
  display: flex;
  align-items: center;
  gap: 6px;
}

.curvature-slider {
  width: 70px;
  height: 6px;
  background: rgba(0, 0, 0, 0.2);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
  border-radius: 3px;
  position: relative;
  overflow: visible;
}

.curvature-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.curvature-slider::-moz-range-track {
  width: 100%;
  height: 6px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.curvature-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #1f2937;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid #ffffff;
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.2),
    0 0 0 0 rgba(31, 41, 55, 0.3);
  margin-top: -4px;
}

.curvature-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 
    0 4px 8px rgba(0, 0, 0, 0.25),
    0 0 0 4px rgba(31, 41, 55, 0.2);
}

.curvature-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #1f2937;
  cursor: pointer;
  border: 2px solid #ffffff;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  margin-top: -4px;
}

.curvature-slider::-moz-range-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
}

.slider-value {
  font-size: 10px;
  font-weight: 600;
  color: rgba(var(--bc), 0.8);
  font-family: 'SF Mono', 'Monaco', monospace;
  min-width: 28px;
  text-align: center;
  background: rgba(var(--bc), 0.08);
  padding: 2px 4px;
  border-radius: 4px;
}

/* Info Items */
.info-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.info-label {
  font-size: 9px;
  font-weight: 600;
  color: rgba(var(--bc), 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 11px;
  color: rgba(var(--bc), 0.9);
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', monospace;
  background: rgba(var(--bc), 0.08);
  padding: 3px 6px;
  border-radius: 6px;
  min-width: 40px;
  text-align: center;
}

.coords {
  min-width: 50px;
}

/* Action Items */
.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.action-label {
  font-size: 9px;
  font-weight: 600;
  color: rgba(var(--bc), 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Action Buttons */
.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(var(--bc), 0.05);
  border: 1px solid rgba(var(--bc), 0.1);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  color: rgba(var(--bc), 0.7);
}

.action-button:hover {
  background: rgba(var(--bc), 0.12);
  color: rgba(var(--bc), 0.9);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(var(--bc), 0.15);
}

.action-button:active {
  transform: translateY(0);
}

.action-button.active {
  background: rgba(var(--p), 0.15);
  color: rgba(var(--p), 1);
  border-color: rgba(var(--p), 0.3);
  box-shadow: 
    0 0 0 1px rgba(var(--p), 0.2),
    0 2px 4px rgba(var(--p), 0.15);
}

.action-button.pulse-animate {
  animation: pulse-glow 2s ease-in-out infinite;
}

.action-button.processing {
  background: rgba(var(--info), 0.15);
  color: rgba(var(--info), 1);
  border-color: rgba(var(--info), 0.3);
  pointer-events: none;
}

@keyframes pulse-glow {
  0%, 100% {
    background: rgba(var(--p), 0.1);
    box-shadow: 
      0 0 0 1px rgba(var(--p), 0.2),
      0 2px 4px rgba(var(--p), 0.15);
    transform: scale(1);
  }
  50% {
    background: rgba(var(--p), 0.2);
    box-shadow: 
      0 0 0 2px rgba(var(--p), 0.4),
      0 4px 12px rgba(var(--p), 0.3);
    transform: scale(1.05);
  }
}

.icon {
  width: 16px;
  height: 16px;
}

/* Theme-specific overrides for extreme dark themes */
[data-theme="cyberpunk"] .docker-container {
  background: oklch(30% 0.1 280 / 0.95);
  border-color: oklch(50% 0.3 280 / 0.3);
}

[data-theme="acid"] .docker-container {
  background: oklch(28% 0.1 120 / 0.95);
  border-color: oklch(60% 0.4 120 / 0.3);
}

[data-theme="cyberpunk"] .action-button {
  background: oklch(35% 0.2 280 / 0.1);
  border-color: oklch(50% 0.3 280 / 0.2);
  color: oklch(75% 0.3 280 / 0.8);
}

[data-theme="acid"] .action-button {
  background: oklch(35% 0.2 120 / 0.1);
  border-color: oklch(60% 0.4 120 / 0.2);
  color: oklch(75% 0.4 120 / 0.8);
}

[data-theme="cyberpunk"] .action-button:hover {
  background: oklch(45% 0.2 280 / 0.2);
  color: oklch(85% 0.3 280);
}

[data-theme="acid"] .action-button:hover {
  background: oklch(50% 0.3 120 / 0.2);
  color: oklch(85% 0.4 120);
}

[data-theme="cyberpunk"] .action-button.active {
  background: oklch(60% 0.3 280 / 0.3);
  color: oklch(90% 0.4 280);
  border-color: oklch(60% 0.3 280 / 0.5);
}

[data-theme="acid"] .action-button.active {
  background: oklch(70% 0.4 120 / 0.3);
  color: oklch(90% 0.5 120);
  border-color: oklch(70% 0.4 120 / 0.5);
}

[data-theme="cyberpunk"] .coords-value,
[data-theme="cyberpunk"] .curvature-value {
  background: oklch(35% 0.2 280 / 0.15);
  color: oklch(80% 0.3 280);
}

[data-theme="acid"] .coords-value,
[data-theme="acid"] .curvature-value {
  background: oklch(35% 0.2 120 / 0.15);
  color: oklch(80% 0.4 120);
}

[data-theme="cyberpunk"] .separator {
  background: oklch(50% 0.3 280 / 0.3);
}

[data-theme="acid"] .separator {
  background: oklch(60% 0.4 120 / 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .docker-container {
    gap: 8px;
    padding: 6px 10px;
  }
  
  .coords-item {
    display: none;
  }
  
  .curvature-slider {
    width: 60px;
  }
  
  .action-button {
    width: 28px;
    height: 28px;
  }
  
  .icon {
    width: 14px;
    height: 14px;
  }
}

@media (max-width: 480px) {
  .separator {
    display: none;
  }
  
  .docker-container {
    gap: 6px;
  }
  
  .info-group {
    gap: 6px;
  }
}
</style>