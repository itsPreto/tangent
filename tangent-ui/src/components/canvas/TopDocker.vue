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

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

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
  background: rgba(var(--b2), 0.9);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  border: 1px solid rgba(var(--bc), 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
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

.tool-button:hover {
  background: rgba(var(--bc), 0.1);
  color: rgba(var(--bc), 0.9);
  transform: translateY(-1px);
}

.tool-button.active {
  background: rgba(var(--p), 0.15);
  color: rgba(var(--p), 1);
  box-shadow: 0 0 0 2px rgba(var(--p), 0.3);
}

.tool-number {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 10px;
  font-weight: 600;
  color: rgba(var(--bc), 0.5);
  pointer-events: none;
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
</style>