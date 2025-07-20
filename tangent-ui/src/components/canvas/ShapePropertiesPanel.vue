<template>
  <div 
    v-if="drawingStore.hasSelection" 
    class="shape-properties-panel fixed right-4 top-1/2 transform -translate-y-1/2 z-50"
  >
    <div class="properties-container">
      <!-- Header -->
      <div class="properties-header">
        <div class="header-info">
          <h3 class="header-title">
            {{ selectedShapes.length === 1 ? 'Shape Properties' : `${selectedShapes.length} Shapes Selected` }}
          </h3>
          <div class="selected-types">
            {{ getSelectedTypesText() }}
          </div>
        </div>
        <button @click="clearSelection" class="close-button" title="Clear Selection">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Properties Controls -->
      <div class="properties-content">
        
        <!-- Stroke Color -->
        <div v-if="canEditStroke" class="property-group">
          <label class="property-label">Stroke Color</label>
          <div class="color-grid">
            <button
              v-for="color in strokeColors"
              :key="color"
              @click="updateStrokeColor(color)"
              :class="['color-swatch', { 'active': isCurrentStrokeColor(color) }]"
              :style="{ backgroundColor: color }"
              :title="color"
            >
              <div v-if="isCurrentStrokeColor(color)" class="color-check">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
            </button>
          </div>
        </div>

        <!-- Fill Color -->
        <div v-if="canEditFill" class="property-group">
          <label class="property-label">Fill Color</label>
          <div class="color-grid">
            <button
              v-for="color in fillColors"
              :key="color"
              @click="updateFillColor(color)"
              :class="['color-swatch', { 'active': isCurrentFillColor(color), 'transparent': color === 'transparent' }]"
              :style="{ backgroundColor: color === 'transparent' ? 'transparent' : color }"
              :title="color === 'transparent' ? 'No Fill' : color"
            >
              <div v-if="color === 'transparent'" class="transparent-indicator">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div v-else-if="isCurrentFillColor(color)" class="color-check">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
            </button>
          </div>
        </div>

        <!-- Stroke Width -->
        <div v-if="canEditStroke" class="property-group">
          <label class="property-label">Stroke Width</label>
          <div class="stroke-width-grid">
            <button
              v-for="width in strokeWidths"
              :key="width"
              @click="updateStrokeWidth(width)"
              :class="['stroke-width-button', { 'active': isCurrentStrokeWidth(width) }]"
              :title="`${width}px`"
            >
              <div class="stroke-preview" :style="{ height: `${width}px` }"></div>
            </button>
          </div>
        </div>

        <!-- Opacity -->
        <div class="property-group">
          <label class="property-label">Opacity</label>
          <div class="opacity-control">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              :value="currentOpacity"
              @input="updateOpacity($event.target.value)"
              class="opacity-slider"
            />
            <span class="opacity-value">{{ Math.round(currentOpacity * 100) }}%</span>
          </div>
        </div>

        <!-- Position and Size (for single shape) -->
        <div v-if="selectedShapes.length === 1" class="property-group">
          <label class="property-label">Position & Size</label>
          <div class="position-grid">
            <div class="position-input">
              <label class="input-label">X</label>
              <input
                type="number"
                :value="Math.round(selectedShapes[0].x)"
                @input="updatePosition('x', $event.target.value)"
                class="position-field"
              />
            </div>
            <div class="position-input">
              <label class="input-label">Y</label>
              <input
                type="number"
                :value="Math.round(selectedShapes[0].y)"
                @input="updatePosition('y', $event.target.value)"
                class="position-field"
              />
            </div>
            <div v-if="canEditSize" class="position-input">
              <label class="input-label">W</label>
              <input
                type="number"
                :value="Math.round(selectedShapes[0].width || 0)"
                @input="updateSize('width', $event.target.value)"
                class="position-field"
              />
            </div>
            <div v-if="canEditSize" class="position-input">
              <label class="input-label">H</label>
              <input
                type="number"
                :value="Math.round(selectedShapes[0].height || 0)"
                @input="updateSize('height', $event.target.value)"
                class="position-field"
              />
            </div>
            <div v-if="selectedShapes[0].type === 'circle'" class="position-input">
              <label class="input-label">R</label>
              <input
                type="number"
                :value="Math.round(selectedShapes[0].radius || 0)"
                @input="updateSize('radius', $event.target.value)"
                class="position-field"
              />
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="property-group">
          <label class="property-label">Actions</label>
          <div class="action-buttons">
            <button @click="duplicateShapes" class="action-button">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Duplicate
            </button>
            <button @click="deleteShapes" class="action-button danger">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDrawingStore } from '@/stores/drawingStore'

const drawingStore = useDrawingStore()

// Computed properties
const selectedShapes = computed(() => drawingStore.selectedShapes)

const canEditStroke = computed(() => {
  return selectedShapes.value.some(shape => 
    ['rectangle', 'circle', 'diamond', 'line', 'arrow', 'pen', 'text'].includes(shape.type)
  )
})

const canEditFill = computed(() => {
  return selectedShapes.value.some(shape => 
    ['rectangle', 'circle', 'diamond'].includes(shape.type)
  )
})

const canEditSize = computed(() => {
  const shape = selectedShapes.value[0]
  return shape && ['rectangle', 'diamond', 'text', 'image'].includes(shape.type)
})

const currentOpacity = computed(() => {
  if (selectedShapes.value.length === 1) {
    return selectedShapes.value[0].opacity
  }
  // For multiple shapes, show average
  const total = selectedShapes.value.reduce((sum, shape) => sum + shape.opacity, 0)
  return total / selectedShapes.value.length
})

// Color palettes
const strokeColors = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', 
  '#ffff00', '#ff00ff', '#00ffff', '#ff8000', '#8000ff',
  '#808080', '#404040'
]

const fillColors = [
  'transparent', '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#ff00ff', '#00ffff', '#ff8000', '#8000ff',
  '#f0f0f0', '#e0e0e0'
]

const strokeWidths = [1, 2, 3, 4, 6, 8, 12, 16]

// Helper functions
const getSelectedTypesText = () => {
  const types = [...new Set(selectedShapes.value.map(shape => shape.type))]
  return types.join(', ')
}

const isCurrentStrokeColor = (color: string) => {
  return selectedShapes.value.every(shape => shape.strokeColor === color)
}

const isCurrentFillColor = (color: string) => {
  return selectedShapes.value.every(shape => shape.fillColor === color)
}

const isCurrentStrokeWidth = (width: number) => {
  return selectedShapes.value.every(shape => shape.strokeWidth === width)
}

// Update functions
const updateStrokeColor = (color: string) => {
  selectedShapes.value.forEach(shape => {
    shape.strokeColor = color
  })
  drawingStore.saveToHistory()
}

const updateFillColor = (color: string) => {
  selectedShapes.value.forEach(shape => {
    if (['rectangle', 'circle', 'diamond'].includes(shape.type)) {
      shape.fillColor = color
    }
  })
  drawingStore.saveToHistory()
}

const updateStrokeWidth = (width: number) => {
  selectedShapes.value.forEach(shape => {
    shape.strokeWidth = width
  })
  drawingStore.saveToHistory()
}

const updateOpacity = (opacity: string) => {
  const opacityValue = parseFloat(opacity)
  selectedShapes.value.forEach(shape => {
    shape.opacity = opacityValue
  })
  drawingStore.saveToHistory()
}

const updatePosition = (axis: 'x' | 'y', value: string) => {
  const numValue = parseFloat(value)
  if (!isNaN(numValue) && selectedShapes.value.length === 1) {
    selectedShapes.value[0][axis] = numValue
    drawingStore.saveToHistory()
  }
}

const updateSize = (dimension: 'width' | 'height' | 'radius', value: string) => {
  const numValue = parseFloat(value)
  if (!isNaN(numValue) && numValue >= 0 && selectedShapes.value.length === 1) {
    const shape = selectedShapes.value[0]
    if (dimension === 'radius' && shape.type === 'circle') {
      shape.radius = numValue
    } else if (['width', 'height'].includes(dimension)) {
      (shape as any)[dimension] = numValue
    }
    drawingStore.saveToHistory()
  }
}

// Actions
const clearSelection = () => {
  drawingStore.clearSelection()
}

const duplicateShapes = () => {
  drawingStore.duplicateSelected()
}

const deleteShapes = () => {
  drawingStore.deleteSelected()
}
</script>

<style scoped>
.shape-properties-panel {
  user-select: none;
  pointer-events: auto;
}

.properties-container {
  background: rgba(var(--b1), 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(var(--bc), 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  width: 280px;
  max-height: 80vh;
  overflow-y: auto;
}

.properties-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(var(--bc), 0.1);
}

.header-info {
  flex: 1;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(var(--bc), 0.9);
  margin: 0;
}

.selected-types {
  font-size: 12px;
  color: rgba(var(--bc), 0.6);
  margin-top: 2px;
}

.close-button {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: rgba(var(--bc), 0.6);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: rgba(var(--bc), 0.1);
  color: rgba(var(--bc), 0.8);
}

.properties-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.property-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.property-label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(var(--bc), 0.7);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.color-swatch {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(var(--bc), 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.color-swatch.active {
  border-color: rgba(var(--p), 1);
  box-shadow: 0 0 0 2px rgba(var(--p), 0.3);
}

.color-swatch.transparent {
  background: repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 8px 8px;
}

.color-check {
  color: white;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
}

.transparent-indicator {
  color: rgba(var(--bc), 0.6);
}

.stroke-width-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stroke-width-button {
  width: 48px;
  height: 32px;
  border: 2px solid rgba(var(--bc), 0.2);
  border-radius: 6px;
  background: rgba(var(--b2), 1);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stroke-width-button.active {
  border-color: rgba(var(--p), 1);
  background: rgba(var(--p), 0.1);
}

.stroke-preview {
  background: rgba(var(--bc), 0.8);
  width: 80%;
  border-radius: 2px;
}

.opacity-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.opacity-slider {
  flex: 1;
  height: 4px;
  background: rgba(var(--bc), 0.2);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(var(--p), 1);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.opacity-value {
  font-size: 12px;
  color: rgba(var(--bc), 0.7);
  font-weight: 500;
  min-width: 36px;
  text-align: right;
}

.position-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.position-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-label {
  font-size: 11px;
  font-weight: 500;
  color: rgba(var(--bc), 0.6);
}

.position-field {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid rgba(var(--bc), 0.2);
  border-radius: 4px;
  background: rgba(var(--b2), 1);
  color: rgba(var(--bc), 0.9);
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease;
}

.position-field:focus {
  border-color: rgba(var(--p), 0.6);
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid rgba(var(--bc), 0.2);
  border-radius: 6px;
  background: rgba(var(--b2), 1);
  color: rgba(var(--bc), 0.8);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-button:hover {
  background: rgba(var(--bc), 0.1);
  border-color: rgba(var(--bc), 0.3);
}

.action-button.danger {
  border-color: rgba(var(--er), 0.3);
  color: rgba(var(--er), 0.8);
}

.action-button.danger:hover {
  background: rgba(var(--er), 0.1);
  border-color: rgba(var(--er), 0.5);
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .color-swatch.transparent {
    background: repeating-conic-gradient(#555 0% 25%, transparent 0% 50%) 50% / 8px 8px;
  }
}
</style>