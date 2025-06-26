<template>
  <div class="sliding-footer-container" :class="{ 'is-open': isOpen }">
    <!-- Main Content Backdrop -->
    <div class="content-overlay" :class="{ 'visible': isOpen }" @click="$emit('close')"></div>

    <!-- Sliding Footer Panel -->
    <div class="sliding-footer-panel">
      <!-- Handle Bar -->
      <div class="handle-bar" @click="$emit('toggle')">
        <div class="handle-indicator"></div>
        <span class="handle-text">{{ isOpen ? 'Hide Tools' : 'Show Tools' }}</span>
        <div class="handle-indicator"></div>
      </div>

      <!-- Main Content Area -->
      <div class="footer-content">
        <!-- WorkspaceSearchBar Section -->
        <div class="search-section">
          <div class="section-header">
            <Search class="w-5 h-5 text-blue-400" />
            <h3 class="text-lg font-semibold text-base-content">Workspace Search</h3>
          </div>
          <div class="search-container">
            <WorkspaceSearchBar 
              v-model="searchQuery" 
              :view-mode="viewMode"
              @toggle-view="handleViewModeToggle"
              class="enhanced-search-bar"
            />
          </div>
        </div>

        <!-- Left Side - Shortcuts -->
        <div class="side-panel left-panel">
          <div class="panel-header">
            <Keyboard class="w-5 h-5 text-purple-400" />
            <h3 class="text-lg font-semibold text-base-content">Shortcuts</h3>
          </div>
          <div class="shortcuts-list">
            <div v-for="(shortcut, index) in shortcuts" :key="index" class="shortcut-item">
              <div class="shortcut-keys">
                <kbd v-for="key in shortcut.keys" :key="key" class="glass-kbd">
                  {{ key }}
                </kbd>
              </div>
              <span class="shortcut-description">{{ shortcut.description }}</span>
            </div>
          </div>
        </div>

        <!-- Right Side - Tips -->
        <div class="side-panel right-panel">
          <div class="panel-header">
            <Sparkles class="w-5 h-5 text-green-400" />
            <h3 class="text-lg font-semibold text-base-content">Tips & Tricks</h3>
          </div>
          <div class="tips-list">
            <div v-for="(tip, index) in tips" :key="index" class="tip-item">
              <div class="tip-icon">
                <component :is="tip.icon" class="w-4 h-4" />
              </div>
              <p class="tip-text">{{ tip.text }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Search, Keyboard, Sparkles, MousePointer, Lightbulb, GitBranch, Zap } from 'lucide-vue-next';
import WorkspaceSearchBar from '../workspace/WorkspaceSearchBar.vue';

const props = defineProps<{
  isOpen: boolean
}>();

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggle'): void
}>();

// Search functionality
const searchQuery = ref('');
const viewMode = ref<'grid' | 'list'>('grid');

const handleViewModeToggle = () => {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid';
};

// Shortcuts data
const shortcuts = [
  { keys: ['?'], description: 'Show/hide this footer panel' },
  { keys: ['M'], description: 'Open model selector' },
  { keys: ['S'], description: 'Toggle snap mode for selected node' },
  { keys: ['ESC'], description: 'Exit current mode or close panels' },
  { keys: ['↑', '↓', '←', '→'], description: 'Navigate between connected nodes' },
  { keys: ['CMD', '↑'], description: 'Switch to previous workspace' },
  { keys: ['CMD', '↓'], description: 'Switch to next workspace' },
  { keys: ['/'], description: 'Search workspaces and models' },
  { keys: ['SPACE'], description: 'Pan the canvas' },
  { keys: ['CTRL', '+'], description: 'Zoom in' },
  { keys: ['CTRL', '-'], description: 'Zoom out' },
  { keys: ['CTRL', '0'], description: 'Reset zoom' },
  { keys: ['Enter'], description: 'Send message or confirm action' },
  { keys: ['Tab'], description: 'Switch between UI elements' }
];

// Tips data
const tips = [
  { icon: MousePointer, text: 'Click and drag on empty space to pan the canvas' },
  { icon: Sparkles, text: 'Double-click on messages to create branches' },
  { icon: MousePointer, text: 'Drag nodes to rearrange them in the workspace' },
  { icon: Lightbulb, text: 'Use different AI models for different types of tasks' },
  { icon: MousePointer, text: 'Use mouse wheel to zoom in and out' },
  { icon: GitBranch, text: 'Create branches to explore alternative conversation paths' },
  { icon: Zap, text: 'Auto-compaction saves context when approaching token limits' },
  { icon: Lightbulb, text: 'Organize your workspaces by project or topic themes' },
  { icon: MousePointer, text: 'Hold SHIFT while dragging to constrain movement' },
  { icon: Sparkles, text: 'Export important conversations for sharing' },
  { icon: MousePointer, text: 'Right-click for context menus and quick actions' },
  { icon: Lightbulb, text: 'Token counters show real-time context usage' }
];
</script>

<style scoped>
.sliding-footer-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  pointer-events: none;
  padding: 2rem 0;
}

.content-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to top,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.2) 50%,
      rgba(0, 0, 0, 0.4) 100%);
  opacity: 0;
  transition: opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
  z-index: -1;
}

.content-overlay.visible {
  opacity: 1;
  pointer-events: auto;
}

.sliding-footer-panel {
  height: 70vh;
  background: hsl(var(--b2) / 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid hsl(var(--b3));
  border-right: none;
  border-radius: 1.5rem 0 0 1.5rem;
  margin: 2rem 0;
  margin-right: 2rem;
  box-shadow:
    0 -10px 50px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 hsl(var(--bc) / 0.1);
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  opacity: 0;
  pointer-events: auto;
}

.is-open .sliding-footer-panel {
  transform: translateY(0);
  opacity: 1;
  animation: slideUpBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes slideUpBounce {
  0% {
    transform: translateY(100%);
    opacity: 0;
  }
  60% {
    transform: translateY(-5%);
    opacity: 0.8;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.handle-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
  cursor: pointer;
  border-bottom: 1px solid hsl(var(--b3));
  transition: all 0.3s ease;
  background: hsl(var(--b2) / 0.8);
  backdrop-filter: blur(15px);
  position: relative;
  overflow: hidden;
}

.handle-bar::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, hsl(var(--bc) / 0.1), transparent);
  transition: left 0.5s ease;
}

.handle-bar:hover::before {
  left: 100%;
}

.handle-bar:hover {
  background: hsl(var(--b2) / 0.9);
  transform: translateY(-2px);
}

.handle-indicator {
  width: 2rem;
  height: 4px;
  background: linear-gradient(90deg, #60a5fa, #c084fc, #f472b6);
  border-radius: 2px;
  opacity: 0.8;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 2px 8px rgba(96, 165, 250, 0.3);
}

.handle-bar:hover .handle-indicator {
  opacity: 1;
  width: 2.5rem;
  transform: scale(1.1);
  box-shadow: 0 4px 15px rgba(96, 165, 250, 0.5);
}

.handle-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--bc) / 0.9);
  transition: all 0.2s ease;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.handle-bar:hover .handle-text {
  color: hsl(var(--bc));
  transform: scale(1.05);
}

.footer-content {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  grid-template-rows: auto 1fr;
  grid-template-areas: 
    "left search right"
    "left search right";
  gap: 1rem;
  padding: 1rem;
  overflow: hidden;
}

.search-section {
  grid-area: search;
  display: flex;
  flex-direction: column;
  background: hsl(var(--b2) / 0.3);
  border: 1px solid hsl(var(--b3));
  border-radius: 1rem;
  backdrop-filter: blur(12px);
  box-shadow: inset 0 1px 0 hsl(var(--bc) / 0.1);
  overflow: hidden;
}

.search-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.enhanced-search-bar {
  width: 100%;
  max-width: 600px;
}

.side-panel {
  background: hsl(var(--b2) / 0.2);
  border: 1px solid hsl(var(--b3));
  border-radius: 1rem;
  backdrop-filter: blur(12px);
  box-shadow: inset 0 1px 0 hsl(var(--bc) / 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.left-panel {
  grid-area: left;
}

.right-panel {
  grid-area: right;
}

.section-header,
.panel-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid hsl(var(--b3));
  background: hsl(var(--b2) / 0.5);
}

.shortcuts-list,
.tips-list {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.shortcut-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem;
  background: hsl(var(--b2) / 0.5);
  border: 1px solid hsl(var(--b3));
  border-radius: 0.5rem;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.shortcut-item:hover {
  background: hsl(var(--b2) / 0.8);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.shortcut-keys {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.glass-kbd {
  padding: 0.25rem 0.5rem;
  background: hsl(var(--b2) / 0.6);
  border: 1px solid hsl(var(--b3));
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--bc));
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.shortcut-description {
  color: hsl(var(--bc) / 0.8);
  font-size: 0.8rem;
  line-height: 1.4;
  text-align: center;
}

.tip-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: hsl(var(--b2) / 0.5);
  border: 1px solid hsl(var(--b3));
  border-radius: 0.5rem;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.tip-item:hover {
  background: hsl(var(--b2) / 0.8);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.tip-icon {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 0.5rem;
  color: #22c55e;
  backdrop-filter: blur(10px);
}

.tip-text {
  color: hsl(var(--bc) / 0.8);
  font-size: 0.8rem;
  line-height: 1.4;
  margin: 0;
}

/* Custom scrollbar */
.shortcuts-list::-webkit-scrollbar,
.tips-list::-webkit-scrollbar {
  width: 4px;
}

.shortcuts-list::-webkit-scrollbar-track,
.tips-list::-webkit-scrollbar-track {
  background: transparent;
}

.shortcuts-list::-webkit-scrollbar-thumb,
.tips-list::-webkit-scrollbar-thumb {
  background: hsl(var(--bc) / 0.2);
  border-radius: 2px;
}

.shortcuts-list::-webkit-scrollbar-thumb:hover,
.tips-list::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--bc) / 0.3);
}

/* Responsive design */
@media (max-width: 1200px) {
  .footer-content {
    grid-template-columns: 1fr 2fr 1fr;
  }
}

@media (max-width: 1024px) {
  .footer-content {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    grid-template-areas: 
      "search"
      "left"
      "right";
  }
  
  .side-panel {
    max-height: 200px;
  }
  
  .shortcuts-list,
  .tips-list {
    max-height: 150px;
  }
}

@media (max-width: 768px) {
  .footer-content {
    padding: 0.5rem;
    gap: 0.5rem;
  }
  
  .section-header,
  .panel-header {
    padding: 0.75rem 1rem;
  }
  
  .shortcuts-list,
  .tips-list {
    padding: 0.5rem;
  }
}
</style>