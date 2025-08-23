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
    </div>
    
    <!-- Minimalist Customization Panel -->
    <Transition name="slide-down">
      <div v-if="showCustomizationPanel" class="customization-panel">
        <!-- Tool-specific options -->
        <div v-if="currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'diamond'" class="horizontal-layout">
            <!-- Stroke Color -->
            <div class="customization-group">
              <label>Stroke</label>
              <div class="color-grid">
                <button v-for="color in strokeColors" :key="color" 
                  @click="setStrokeColor(color)"
                  :class="['color-button', { 'active': drawingStore.strokeColor === color }]"
                  :style="{ backgroundColor: color }">
                </button>
              </div>
            </div>
            
            <!-- Fill Color -->
            <div class="customization-group">
              <label>Fill</label>
              <div class="color-grid">
                <button v-for="color in fillColors" :key="color" 
                  @click="setFillColor(color)"
                  :class="['color-button', { 'active': drawingStore.fillColor === color, 'transparent-button': color === 'transparent' }]"
                  :style="{ backgroundColor: color === 'transparent' ? 'transparent' : color }"
                </button>
              </div>
            </div>
          
          <!-- Stroke Width -->
          <div class="customization-group">
            <label>Width</label>
            <div class="stroke-width-grid">
              <button v-for="width in strokeWidths" :key="width" 
                @click="setStrokeWidth(width)"
                :class="['stroke-width-button', { 'active': drawingStore.strokeWidth === width }]">
                <div class="stroke-preview" :style="{ height: `${width}px` }"></div>
              </button>
            </div>
          </div>
          
          <!-- Opacity -->
          <div class="customization-group opacity-group">
            <label>Opacity</label>
            <div class="opacity-container">
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                :value="drawingStore.opacity"
                @input="setOpacity($event.target.value)"
                class="opacity-slider"
                :style="{ '--slider-progress': (drawingStore.opacity * 100) + '%' }"
              />
              <span class="opacity-value">{{ Math.round(drawingStore.opacity * 100) }}%</span>
            </div>
          </div>
        </div>
        
        <!-- Line/Arrow specific options -->
        <div v-else-if="currentTool === 'line' || currentTool === 'arrow'" class="horizontal-layout">
          <div class="customization-group">
            <label>Color</label>
            <div class="color-grid">
              <button v-for="color in strokeColors" :key="color" 
                @click="setStrokeColor(color)"
                :class="['color-button', { 'active': drawingStore.strokeColor === color }]"
                :style="{ backgroundColor: color }">
              </button>
            </div>
          </div>
          
          <div class="customization-group">
            <label>Width</label>
            <div class="stroke-width-grid">
              <button v-for="width in strokeWidths" :key="width" 
                @click="setStrokeWidth(width)"
                :class="['stroke-width-button', { 'active': drawingStore.strokeWidth === width }]">
                <div class="stroke-preview" :style="{ height: `${width}px` }"></div>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Text tool specific options -->
        <div v-else-if="currentTool === 'text'" class="horizontal-layout">
          <div class="customization-group">
            <label>Color</label>
            <div class="color-grid">
              <button v-for="color in strokeColors" :key="color" 
                @click="setStrokeColor(color)"
                :class="['color-button', { 'active': drawingStore.strokeColor === color }]"
                :style="{ backgroundColor: color }">
              </button>
            </div>
          </div>
        </div>
        
        <!-- Pen tool specific options -->
        <div v-else-if="currentTool === 'pen'" class="horizontal-layout">
          <div class="customization-group">
            <label>Color</label>
            <div class="color-grid">
              <button v-for="color in strokeColors" :key="color" 
                @click="setStrokeColor(color)"
                :class="['color-button', { 'active': drawingStore.strokeColor === color }]"
                :style="{ backgroundColor: color }">
              </button>
            </div>
          </div>
          
          <div class="customization-group">
            <label>Width</label>
            <div class="stroke-width-grid">
              <button v-for="width in strokeWidths" :key="width" 
                @click="setStrokeWidth(width)"
                :class="['stroke-width-button', { 'active': drawingStore.strokeWidth === width }]">
                <div class="stroke-preview" :style="{ height: `${width}px` }"></div>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Fill tool specific options -->
        <div v-else-if="currentTool === 'fill'" class="horizontal-layout">
          <div class="customization-group">
            <label>Color</label>
            <div class="color-grid">
              <button v-for="color in fillColors.filter(c => c !== 'transparent')" :key="color" 
                @click="setFillColor(color)"
                :class="['color-button', { 'active': drawingStore.fillColor === color }]"
                :style="{ backgroundColor: color }">
              </button>
            </div>
          </div>
          
          <!-- Opacity -->
          <div class="customization-group opacity-group">
            <label>Opacity</label>
            <div class="opacity-container">
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                :value="drawingStore.opacity"
                @input="setOpacity($event.target.value)"
                class="opacity-slider"
                :style="{ '--slider-progress': (drawingStore.opacity * 100) + '%' }"
              />
              <span class="opacity-value">{{ Math.round(drawingStore.opacity * 100) }}%</span>
            </div>
          </div>
        </div>
        
        <!-- Default message for tools without options -->
        <div v-else class="tool-message">
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

// Current tool state - sync with drawing store
const currentTool = computed(() => drawingStore.currentTool);

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
    'fill': 'Click inside enclosed areas to fill them'
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
@media (max-width: 1200px) {
  .toolbar-container {
    max-width: 95vw;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  .toolbar-container::-webkit-scrollbar {
    display: none;
  }
}

@media (max-width: 768px) {
  .toolbar-container {
    flex-wrap: wrap;
    max-width: 90vw;
    justify-content: center;
    gap: 2px;
  }
  
  .tool-button {
    width: 36px;
    height: 36px;
  }
  
  
  .canvas-help-text {
    display: none;
  }
}

@media (max-width: 580px) {
  .toolbar-container {
    gap: 1px;
    padding: 6px;
  }
  
  .tool-button {
    width: 32px;
    height: 32px;
  }
  
  
  /* Hide tool numbers on very small screens to reduce clutter */
  .tool-number {
    display: none;
  }
}

/* Minimalist Horizontal Customization Panel */
.customization-panel {
  width: 100%;
  min-width: 600px;
  max-width: 900px;
  margin-top: 12px;
  padding: 12px 20px;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--b1)) calc(l + 2) c h / 0.98),
    oklch(from oklch(var(--b1)) l c h / 0.95)
  );
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.08);
  box-shadow: 
    0 12px 40px oklch(from oklch(var(--b3)) l c h / 0.15),
    0 2px 8px oklch(from oklch(var(--b3)) l c h / 0.1),
    inset 0 1px 0 oklch(from oklch(var(--bc)) l c h / 0.05);
}

/* Horizontal layout for tool options */
.horizontal-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
}

.customization-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: fit-content;
}

.horizontal-layout .customization-group {
  margin-bottom: 0;
}

.customization-group label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: oklch(from oklch(var(--bc)) l c h / 0.5);
  margin-bottom: 0;
  text-align: center;
  white-space: nowrap;
}

/* Special styling for opacity group */
.opacity-group {
  flex: 1;
  max-width: 200px;
  min-width: 120px;
}

.opacity-container {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.opacity-value {
  font-size: 11px;
  font-weight: 600;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
  background: oklch(from oklch(var(--b1)) l c h / 0.5);
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  min-width: 40px;
  text-align: center;
}

.color-button {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 2px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.color-button::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.color-button:hover {
  transform: translateY(-2px) scale(1.05);
  border-color: oklch(from oklch(var(--bc)) l c h / 0.2);
  box-shadow: 0 4px 12px oklch(from oklch(var(--bc)) l c h / 0.1);
}

.color-button:hover::before {
  opacity: 1;
}

.color-button.active {
  border-color: oklch(from oklch(var(--p)) l c h / 0.6);
  box-shadow: 
    0 0 0 3px oklch(from oklch(var(--p)) l c h / 0.2),
    0 4px 12px oklch(from oklch(var(--p)) l c h / 0.2);
  transform: translateY(-2px) scale(1.05);
}

.color-button.active::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.transparent-button {
  background: 
    linear-gradient(45deg, oklch(from oklch(var(--bc)) l c h / 0.2) 25%, transparent 25%), 
    linear-gradient(-45deg, oklch(from oklch(var(--bc)) l c h / 0.2) 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, oklch(from oklch(var(--bc)) l c h / 0.2) 75%), 
    linear-gradient(-45deg, transparent 75%, oklch(from oklch(var(--bc)) l c h / 0.2) 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
}

.transparent-button.active::after {
  background: oklch(from oklch(var(--bc)) l c h / 0.8);
}

.stroke-width-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  background: oklch(from oklch(var(--b1)) l c h / 0.5);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.stroke-width-button:hover {
  background: oklch(from oklch(var(--b1)) l c h / 0.8);
  border-color: oklch(from oklch(var(--bc)) l c h / 0.2);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px oklch(from oklch(var(--bc)) l c h / 0.1);
}

.stroke-width-button.active {
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  border-color: oklch(from oklch(var(--p)) l c h / 0.3);
  box-shadow: 
    0 0 0 2px oklch(from oklch(var(--p)) l c h / 0.1),
    0 2px 8px oklch(from oklch(var(--p)) l c h / 0.15);
}

.stroke-preview {
  width: 24px;
  border-radius: 99px;
  background: oklch(from oklch(var(--bc)) l c h / 0.8);
}

.stroke-width-button.active .stroke-preview {
  background: oklch(from oklch(var(--p)) l c h / 0.8);
}

/* Minimalist Opacity Slider */
.opacity-slider {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(to right,
    oklch(from oklch(var(--bc)) l c h / 0.1) 0%,
    oklch(from oklch(var(--bc)) l c h / 0.3) 100%
  );
  outline: none;
  -webkit-appearance: none;
  position: relative;
  min-width: 80px;
}

.opacity-slider::before {
  content: '';
  position: absolute;
  height: 100%;
  background: oklch(from oklch(var(--p)) l c h / 0.5);
  border-radius: 2px;
  width: var(--slider-progress, 50%);
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  border: 2px solid oklch(from oklch(var(--p)) l c h / 0.8);
  box-shadow: 
    0 2px 8px oklch(from oklch(var(--b3)) l c h / 0.2),
    0 1px 3px oklch(from oklch(var(--b3)) l c h / 0.3);
  transition: all 0.2s ease;
  position: relative;
  z-index: 2;
}

.opacity-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 
    0 0 0 6px oklch(from oklch(var(--p)) l c h / 0.1),
    0 2px 8px oklch(from oklch(var(--b3)) l c h / 0.3);
}

.opacity-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  border: 2px solid oklch(from oklch(var(--p)) l c h / 0.8);
  box-shadow: 
    0 2px 8px oklch(from oklch(var(--b3)) l c h / 0.2),
    0 1px 3px oklch(from oklch(var(--b3)) l c h / 0.3);
  transition: all 0.2s ease;
  position: relative;
  z-index: 2;
}

.opacity-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
  box-shadow: 
    0 0 0 6px oklch(from oklch(var(--p)) l c h / 0.1),
    0 2px 8px oklch(from oklch(var(--b3)) l c h / 0.3);
}

/* Opacity value display */
.opacity-value-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.opacity-value-display span {
  font-size: 10px;
  font-weight: 500;
  color: oklch(from oklch(var(--bc)) l c h / 0.4);
}

.opacity-value-display .current-value {
  font-size: 11px;
  font-weight: 600;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
  background: oklch(from oklch(var(--b1)) l c h / 0.5);
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
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

/* Grid layouts */
.color-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stroke-width-grid {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* Tool message styling */
.tool-message {
  text-align: center;
  padding: 24px 16px;
  font-size: 13px;
  font-weight: 500;
  color: oklch(from oklch(var(--bc)) l c h / 0.5);
  background: oklch(from oklch(var(--b1)) l c h / 0.3);
  border-radius: 12px;
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.08);
}

/* Theme-specific overrides for extreme dark themes */
[data-theme="cyberpunk"] .drawing-docker {
  background: oklch(30% 0.1 280 / 0.95);
  border-color: oklch(50% 0.3 280 / 0.3);
}

[data-theme="acid"] .drawing-docker {
  background: oklch(28% 0.1 120 / 0.95);
  border-color: oklch(60% 0.4 120 / 0.3);
}

[data-theme="cyberpunk"] .tool-button {
  color: oklch(75% 0.3 280 / 0.8);
}

[data-theme="acid"] .tool-button {
  color: oklch(75% 0.4 120 / 0.8);
}

[data-theme="cyberpunk"] .tool-button:hover {
  background: oklch(40% 0.2 280 / 0.2);
  color: oklch(85% 0.3 280);
}

[data-theme="acid"] .tool-button:hover {
  background: oklch(45% 0.3 120 / 0.2);
  color: oklch(85% 0.4 120);
}

[data-theme="cyberpunk"] .tool-button.active {
  background: oklch(60% 0.3 280 / 0.3);
  color: oklch(90% 0.4 280);
  box-shadow: 0 0 0 2px oklch(60% 0.3 280 / 0.5), 0 4px 12px oklch(60% 0.3 280 / 0.3);
}

[data-theme="acid"] .tool-button.active {
  background: oklch(70% 0.4 120 / 0.3);
  color: oklch(90% 0.5 120);
  box-shadow: 0 0 0 2px oklch(70% 0.4 120 / 0.5), 0 4px 12px oklch(70% 0.4 120 / 0.3);
}

/* Grid layout improvements */
.customization-panel .grid {
  gap: 16px;
}

@media (max-width: 768px) {
  .customization-panel {
    min-width: 500px;
    max-width: 95vw;
    padding: 10px 16px;
  }
  
  .horizontal-layout {
    gap: 16px;
  }
  
  .color-button {
    width: 28px;
    height: 28px;
  }
  
  .stroke-width-button {
    width: 40px;
    height: 32px;
  }
  
  .opacity-group {
    min-width: 100px;
    max-width: 150px;
  }
}

@media (max-width: 580px) {
  .customization-panel {
    min-width: 400px;
  }
  
  .horizontal-layout {
    gap: 12px;
  }
  
  .color-grid {
    gap: 6px;
  }
  
  .stroke-width-grid {
    gap: 4px;
  }
  
  .color-button {
    width: 24px;
    height: 24px;
  }
  
  .stroke-width-button {
    width: 36px;
    height: 28px;
  }
}
</style>