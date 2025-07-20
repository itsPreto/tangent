<template>
  <div 
    v-if="!canvasStore.snappedNodeId" 
    class="top-docker fixed top-4 z-40"
    :style="dockerStyle"
  >
    <div class="toolbar-container bg-base-200/90 backdrop-blur-sm rounded-lg p-2 flex items-center gap-1 shadow-lg border border-base-300">
      <!-- Lock/Unlock tool -->
      <button 
        @click="setTool('lock')"
        :class="['tool-button', { 'active': currentTool === 'lock' }]"
        title="Lock/Unlock"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
      </button>

      <!-- Hand/Pan tool -->
      <button 
        @click="setTool('hand')"
        :class="['tool-button', { 'active': currentTool === 'hand' }]"
        title="Hand Tool (Pan)"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3"/>
        </svg>
      </button>

      <!-- Cursor/Select tool -->
      <button 
        @click="setTool('cursor')"
        :class="['tool-button', { 'active': currentTool === 'cursor' }]"
        title="Select Tool"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/>
        </svg>
      </button>

      <div class="w-px h-6 bg-base-300 mx-1"></div>

      <!-- Rectangle tool -->
      <button 
        @click="setTool('rectangle')"
        :class="['tool-button', { 'active': currentTool === 'rectangle' }]"
        title="Rectangle"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        </svg>
        <span class="tool-number">2</span>
      </button>

      <!-- Diamond tool -->
      <button 
        @click="setTool('diamond')"
        :class="['tool-button', { 'active': currentTool === 'diamond' }]"
        title="Diamond"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2l3.5 6.5L12 22l-3.5-13.5L12 2z"/>
        </svg>
        <span class="tool-number">3</span>
      </button>

      <!-- Circle tool -->
      <button 
        @click="setTool('circle')"
        :class="['tool-button', { 'active': currentTool === 'circle' }]"
        title="Circle"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/>
        </svg>
        <span class="tool-number">4</span>
      </button>

      <!-- Arrow tool -->
      <button 
        @click="setTool('arrow')"
        :class="['tool-button', { 'active': currentTool === 'arrow' }]"
        title="Arrow"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
        </svg>
        <span class="tool-number">5</span>
      </button>

      <!-- Line tool -->
      <button 
        @click="setTool('line')"
        :class="['tool-button', { 'active': currentTool === 'line' }]"
        title="Line"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19l14-14"/>
        </svg>
        <span class="tool-number">6</span>
      </button>

      <!-- Pen tool -->
      <button 
        @click="setTool('pen')"
        :class="['tool-button', { 'active': currentTool === 'pen' }]"
        title="Pen"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
        </svg>
        <span class="tool-number">7</span>
      </button>

      <!-- Fill tool -->
      <button 
        @click="setTool('fill')"
        :class="['tool-button', { 'active': currentTool === 'fill' }]"
        title="Fill Tool"
      >
        <svg class="w-5 h-5" fill="currentColor" stroke="none" viewBox="0 0 24 24">
          <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6H10V4C10 2.9 10.9 2 12 2M21 9V7L19 5L17 7H11V10.5L4 17.5C3 18.5 3 20 4 21S6.5 21 7.5 20L14.5 13H18V11L21 9Z"/>
        </svg>
        <span class="tool-number">F</span>
      </button>

      <!-- Text tool -->
      <button 
        @click="setTool('text')"
        :class="['tool-button', { 'active': currentTool === 'text' }]"
        title="Text"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-9 0v16m10-16v16M9 10h6"/>
        </svg>
        <span class="tool-number">8</span>
      </button>

      <!-- Image tool -->
      <button 
        @click="setTool('image')"
        :class="['tool-button', { 'active': currentTool === 'image' }]"
        title="Image"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        <span class="tool-number">9</span>
      </button>

      <!-- Eraser tool -->
      <button 
        @click="setTool('eraser')"
        :class="['tool-button', { 'active': currentTool === 'eraser' }]"
        title="Eraser"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        <span class="tool-number">0</span>
      </button>

      <!-- More tools -->
      <button 
        @click="setTool('more')"
        :class="['tool-button', { 'active': currentTool === 'more' }]"
        title="More Tools"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
        </svg>
      </button>
    </div>
    
    <!-- Customization Panel -->
    <Transition name="slide-down">
      <div v-if="showCustomizationPanel" class="customization-panel bg-base-200/95 backdrop-blur-sm rounded-lg p-4 mt-3 shadow-lg border border-base-300">
        <!-- Tool-specific options -->
        <div v-if="currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'diamond'">
          <div class="grid grid-cols-2 gap-4">
            <!-- Stroke Color -->
            <div class="customization-group">
              <label class="text-xs text-base-content/60 mb-2 block">Stroke</label>
              <div class="flex gap-2">
                <button v-for="color in strokeColors" :key="color" 
                  @click="setStrokeColor(color)"
                  :class="['color-button', { 'active': drawingStore.strokeColor === color }]"
                  :style="{ backgroundColor: color }">
                </button>
              </div>
            </div>
            
            <!-- Fill Color -->
            <div class="customization-group">
              <label class="text-xs text-base-content/60 mb-2 block">Fill</label>
              <div class="flex gap-2">
                <button v-for="color in fillColors" :key="color" 
                  @click="setFillColor(color)"
                  :class="['color-button', { 'active': drawingStore.fillColor === color, 'transparent-button': color === 'transparent' }]"
                  :style="{ backgroundColor: color === 'transparent' ? 'transparent' : color }"
                </button>
              </div>
            </div>
          </div>
          
          <!-- Stroke Width -->
          <div class="customization-group mt-4">
            <label class="text-xs text-base-content/60 mb-2 block">Stroke Width</label>
            <div class="flex gap-2">
              <button v-for="width in strokeWidths" :key="width" 
                @click="setStrokeWidth(width)"
                :class="['stroke-width-button', { 'active': drawingStore.strokeWidth === width }]">
                <div class="stroke-preview" :style="{ height: `${width}px`, backgroundColor: 'currentColor' }"></div>
              </button>
            </div>
          </div>
          
          <!-- Opacity -->
          <div class="customization-group mt-4">
            <label class="text-xs text-base-content/60 mb-2 block">Opacity</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              :value="drawingStore.opacity"
              @input="setOpacity($event.target.value)"
              class="opacity-slider w-full"
            />
            <div class="flex justify-between text-xs text-base-content/60 mt-1">
              <span>0%</span>
              <span>{{ Math.round(drawingStore.opacity * 100) }}%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
        
        <!-- Line/Arrow specific options -->
        <div v-else-if="currentTool === 'line' || currentTool === 'arrow'">
          <div class="customization-group">
            <label class="text-xs text-base-content/60 mb-2 block">Stroke Color</label>
            <div class="flex gap-2">
              <button v-for="color in strokeColors" :key="color" 
                @click="setStrokeColor(color)"
                :class="['color-button', { 'active': drawingStore.strokeColor === color }]"
                :style="{ backgroundColor: color }">
              </button>
            </div>
          </div>
          
          <div class="customization-group mt-4">
            <label class="text-xs text-base-content/60 mb-2 block">Line Width</label>
            <div class="flex gap-2">
              <button v-for="width in strokeWidths" :key="width" 
                @click="setStrokeWidth(width)"
                :class="['stroke-width-button', { 'active': drawingStore.strokeWidth === width }]">
                <div class="stroke-preview" :style="{ height: `${width}px`, backgroundColor: 'currentColor' }"></div>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Text tool specific options -->
        <div v-else-if="currentTool === 'text'">
          <div class="customization-group">
            <label class="text-xs text-base-content/60 mb-2 block">Text Color</label>
            <div class="flex gap-2">
              <button v-for="color in strokeColors" :key="color" 
                @click="setStrokeColor(color)"
                :class="['color-button', { 'active': drawingStore.strokeColor === color }]"
                :style="{ backgroundColor: color }">
              </button>
            </div>
          </div>
        </div>
        
        <!-- Pen tool specific options -->
        <div v-else-if="currentTool === 'pen'">
          <div class="grid grid-cols-2 gap-4">
            <div class="customization-group">
              <label class="text-xs text-base-content/60 mb-2 block">Pen Color</label>
              <div class="flex gap-2">
                <button v-for="color in strokeColors" :key="color" 
                  @click="setStrokeColor(color)"
                  :class="['color-button', { 'active': drawingStore.strokeColor === color }]"
                  :style="{ backgroundColor: color }">
                </button>
              </div>
            </div>
            
            <div class="customization-group">
              <label class="text-xs text-base-content/60 mb-2 block">Pen Width</label>
              <div class="flex gap-2">
                <button v-for="width in strokeWidths" :key="width" 
                  @click="setStrokeWidth(width)"
                  :class="['stroke-width-button', { 'active': drawingStore.strokeWidth === width }]">
                  <div class="stroke-preview" :style="{ height: `${width}px`, backgroundColor: 'currentColor' }"></div>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Fill tool specific options -->
        <div v-else-if="currentTool === 'fill'">
          <div class="customization-group">
            <label class="text-xs text-base-content/60 mb-2 block">Fill Color</label>
            <div class="flex gap-2">
              <button v-for="color in fillColors.filter(c => c !== 'transparent')" :key="color" 
                @click="setFillColor(color)"
                :class="['color-button', { 'active': drawingStore.fillColor === color }]"
                :style="{ backgroundColor: color }">
              </button>
            </div>
          </div>
          
          <!-- Opacity -->
          <div class="customization-group mt-4">
            <label class="text-xs text-base-content/60 mb-2 block">Opacity</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              :value="drawingStore.opacity"
              @input="setOpacity($event.target.value)"
              class="opacity-slider w-full"
            />
            <div class="flex justify-between text-xs text-base-content/60 mt-1">
              <span>0%</span>
              <span>{{ Math.round(drawingStore.opacity * 100) }}%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
        
        <!-- Default message for tools without options -->
        <div v-else class="text-center text-sm text-base-content/60 py-4">
          {{ getToolMessage(currentTool) }}
        </div>
      </div>
    </Transition>
    
    <!-- Tooltip for canvas instructions -->
    <div class="canvas-help-text text-xs text-base-content/60 text-center mt-2 px-4">
      To move canvas, hold mouse wheel or spacebar while dragging, or use the hand tool
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useDrawingStore } from '@/stores/drawingStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useAppStore } from '@/stores/appStore';

const drawingStore = useDrawingStore();
const canvasStore = useCanvasStore();
const appStore = useAppStore();

// Calculate docker positioning based on available width
const dockerStyle = computed(() => {
  const vw = window.innerWidth;
  
  // Calculate sidebar widths
  let leftSidebarWidth = 0;
  let rightSidebarWidth = 0;
  
  if (appStore.isLeftSidebarExpanded) {
    leftSidebarWidth = 260; // Left sidebar expanded width
  } else {
    leftSidebarWidth = 60; // Left sidebar collapsed width
  }
  
  if (appStore.isRightContentPanelOpen) {
    // Right content panel is open - need to account for both content panel AND potential sidebar expansion
    const contentPanelWidth = vw * 0.35;
    const sidebarWidth = appStore.isRightSidebarExpanded ? 180 : 60;
    rightSidebarWidth = contentPanelWidth + sidebarWidth;
  } else {
    rightSidebarWidth = appStore.isRightSidebarExpanded ? 180 : 60;
  }
  
  // Calculate available width and center position
  const availableWidth = vw - leftSidebarWidth - rightSidebarWidth;
  const centerPosition = leftSidebarWidth + (availableWidth / 2);
  
  return {
    left: `${centerPosition}px`,
    transform: 'translateX(-50%)'
  };
});

// Current tool state
const currentTool = ref<string>('cursor');

// Customization panel state
const showCustomizationPanel = computed(() => {
  return ['rectangle', 'circle', 'diamond', 'line', 'arrow', 'pen', 'text', 'fill'].includes(currentTool.value);
});

// Color options
const strokeColors = ref([
  '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'
]);

const fillColors = ref([
  'transparent', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'
]);

const strokeWidths = ref([1, 2, 4, 8, 16]);

// Set the current tool
const setTool = (tool: string) => {
  currentTool.value = tool;
  drawingStore.setCurrentTool(tool);
  
  // Emit tool change event
  document.dispatchEvent(new CustomEvent('drawing-tool-changed', {
    detail: { tool }
  }));
};

// Handle keyboard shortcuts
const handleKeyDown = (e: KeyboardEvent) => {
  // Check if user is typing in an input field
  const activeTag = document.activeElement?.tagName.toLowerCase();
  const isEditing = 
    activeTag === 'input' ||
    activeTag === 'textarea' ||
    document.activeElement?.getAttribute('contenteditable') === 'true';
    
  if (isEditing) {
    return; // Don't interfere with input
  }
  
  const key = e.key.toLowerCase();
  
  // Number keys for tool selection
  const toolMap: Record<string, string> = {
    '1': 'cursor',
    '2': 'rectangle', 
    '3': 'diamond',
    '4': 'circle',
    '5': 'arrow',
    '6': 'line',
    '7': 'pen',
    'f': 'fill',
    '8': 'text',
    '9': 'image',
    '0': 'eraser'
  };
  
  if (toolMap[key]) {
    e.preventDefault();
    setTool(toolMap[key]);
  }
  
  // Hand tool with spacebar
  if (key === ' ') {
    e.preventDefault();
    setTool('hand');
  }
  
  // Escape to cursor
  if (key === 'escape') {
    setTool('cursor');
  }
};

// Customization methods
const setStrokeColor = (color: string) => {
  drawingStore.strokeColor = color;
};

const setFillColor = (color: string) => {
  drawingStore.fillColor = color;
};

const setStrokeWidth = (width: number) => {
  drawingStore.strokeWidth = width;
};

const setOpacity = (opacity: string) => {
  drawingStore.opacity = parseFloat(opacity);
};

const getToolMessage = (tool: string) => {
  const messages: Record<string, string> = {
    'cursor': 'Select and move objects',
    'hand': 'Pan around the canvas',
    'lock': 'Lock/unlock objects',
    'eraser': 'Click on shapes to delete them',
    'fill': 'Click inside enclosed areas to fill them',
    'more': 'More tools coming soon',
    'image': 'Click to place an image'
  };
  return messages[tool] || 'Tool selected';
};

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<!-- TopDocker.vue -->
<style scoped>
.top-docker {
  user-select: none;
  pointer-events: auto;
}

.toolbar-container {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  /* Increased opacity for a slightly more solid base */
  background: rgba(var(--b2), 0.95);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  border: 1px solid rgba(var(--bc), 0.1);
  /* Added subtle inner border for clean edge separation */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), inset 0 0 0 1px rgba(var(--bc), 0.08);
}

.tool-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: rgba(var(--bc), 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}

/* NEW: Adds a drop-shadow to all icons for guaranteed contrast */
.tool-button svg {
  filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.3));
}

.tool-button:hover {
  background: rgba(var(--bc), 0.1);
  color: rgba(var(--bc), 0.9);
  transform: translateY(-1px);
}

.tool-button.active {
  background: rgba(var(--p), 0.2);
  color: rgba(var(--p), 1);
  box-shadow: 0 0 0 2px rgba(var(--p), 0.5), 0 4px 12px rgba(var(--p), 0.3);
  transform: translateY(-2px);
}

/* NEW: Makes the active tool's icon shadow match the primary color */
.tool-button.active svg {
    filter: drop-shadow(0 1px 2px rgba(var(--p), 0.4));
}

.tool-number {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 10px;
  font-weight: 600;
  color: rgba(var(--bc), 0.5);
  pointer-events: none;
  /* NEW: Adds a shadow to the tool numbers for legibility */
  text-shadow: 0 1px 1px rgba(0,0,0,0.4);
}

.tool-button.active .tool-number {
  color: rgba(var(--p), 0.8);
}

.canvas-help-text {
  background: rgba(var(--b2), 0.8);
  backdrop-filter: blur(8px);
  border-radius: 6px;
  padding: 4px 8px;
  border: 1px solid rgba(var(--bc), 0.05);
}

/* Responsive design */
@media (max-width: 768px) {
  .toolbar-container {
    flex-wrap: wrap;
    max-width: 90vw;
  }
  
  .tool-button {
    width: 36px;
    height: 36px;
  }
  
  .canvas-help-text {
    display: none;
  }
}

/* Customization Panel Styles */
.customization-panel {
  min-width: 300px;
  max-width: 500px;
}

.customization-group {
  margin-bottom: 1rem;
}

.color-button {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.color-button:hover {
  transform: scale(1.1);
  border-color: rgba(var(--bc), 0.3);
}

.color-button.active {
  border-color: rgba(var(--p), 0.8);
  box-shadow: 0 0 0 2px rgba(var(--p), 0.3);
}

.transparent-button {
  background: linear-gradient(45deg, #ccc 25%, transparent 25%), 
              linear-gradient(-45deg, #ccc 25%, transparent 25%), 
              linear-gradient(45deg, transparent 75%, #ccc 75%), 
              linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 6px 6px;
  background-position: 0 0, 0 3px, 3px -3px, -3px 0px;
}

.stroke-width-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 32px;
  border-radius: 4px;
  border: 2px solid transparent;
  background: rgba(var(--bc), 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
}

.stroke-width-button:hover {
  background: rgba(var(--bc), 0.2);
  border-color: rgba(var(--bc), 0.3);
}

.stroke-width-button.active {
  background: rgba(var(--p), 0.15);
  border-color: rgba(var(--p), 0.5);
}

.stroke-preview {
  width: 20px;
  border-radius: 2px;
}

.opacity-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(var(--bc), 0.1);
  outline: none;
  -webkit-appearance: none;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(var(--p), 1);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.opacity-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(var(--p), 1);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Transition animations */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>