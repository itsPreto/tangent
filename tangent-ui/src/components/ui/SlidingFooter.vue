<template>
  <!-- Sliding Footer Panel -->
  <div class="sliding-footer-panel" :class="{ 'is-open': isOpen }">
    <!-- Main Content Backdrop -->
    <div class="content-overlay" :class="{ 'visible': isOpen }" @click="$emit('close')"></div>
      <!-- Handle Bar -->
      <div class="handle-bar" @click="$emit('toggle')">
        <div class="handle-indicator"></div>
        <span class="handle-text">{{ isOpen ? 'Hide Tools' : 'Show Tools' }}</span>
        <div class="handle-indicator"></div>
      </div>

      <!-- Main Content Area -->
      <div class="footer-content">
        <!-- Main Grid Layout -->
        <div class="content-grid">
          <!-- Left Column - Quick Actions & Shortcuts -->
          <div class="left-column">
            <!-- Quick Actions Card -->
            <div class="quick-actions-card glass-panel">
              <div class="panel-header">
                <Zap class="w-5 h-5 text-yellow-400" />
                <h3 class="text-lg font-semibold text-base-content">Quick Actions</h3>
              </div>
              <div class="quick-actions-grid">
                <button class="action-button">
                  <Plus class="w-4 h-4" />
                  <span>New Workspace</span>
                </button>
                <button class="action-button">
                  <FileText class="w-4 h-4" />
                  <span>Import ChatGPT</span>
                </button>
                <button class="action-button">
                  <Settings class="w-4 h-4" />
                  <span>Claude Code</span>
                </button>
                <button class="action-button">
                  <GitBranch class="w-4 h-4" />
                  <span>Create Branch</span>
                </button>
              </div>
            </div>

            <!-- Keyboard Shortcuts Card -->
            <div class="shortcuts-card glass-panel">
              <div class="panel-header">
                <Keyboard class="w-5 h-5 text-purple-400" />
                <h3 class="text-lg font-semibold text-base-content">Shortcuts</h3>
              </div>
              <div class="shortcuts-compact">
                <div v-for="(shortcut, index) in shortcuts.slice(0, 6)" :key="index" class="shortcut-row">
                  <div class="shortcut-keys">
                    <kbd v-for="key in shortcut.keys" :key="key" class="glass-kbd-mini">
                      {{ key }}
                    </kbd>
                  </div>
                  <span class="shortcut-desc">{{ shortcut.description }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column - Tips & Statistics -->
          <div class="right-column">
            <!-- Pro Tips Card -->
            <div class="tips-card glass-panel">
              <div class="panel-header">
                <Sparkles class="w-5 h-5 text-green-400" />
                <h3 class="text-lg font-semibold text-base-content">Pro Tips</h3>
              </div>
              <div class="tips-carousel">
                <div v-for="(tip, index) in tips.slice(0, 4)" :key="index" class="tip-card">
                  <div class="tip-icon-wrapper">
                    <component :is="tip.icon" class="w-5 h-5" />
                  </div>
                  <p class="tip-content">{{ tip.text }}</p>
                </div>
              </div>
            </div>

            <!-- Workspace Stats Card -->
            <div class="stats-card glass-panel">
              <div class="panel-header">
                <BarChart3 class="w-5 h-5 text-cyan-400" />
                <h3 class="text-lg font-semibold text-base-content">Workspace Stats</h3>
              </div>
              <div class="stats-grid">
                <div class="stat-item">
                  <div class="stat-number">24</div>
                  <div class="stat-label">Total Workspaces</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">156</div>
                  <div class="stat-label">Messages</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">7</div>
                  <div class="stat-label">Active Today</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">3</div>
                  <div class="stat-label">Favorites</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Keyboard, Sparkles, MousePointer, Lightbulb, GitBranch, Zap, Plus, FileText, Settings, BarChart3, Code, Terminal, Layers, Cpu } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean
}>();

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggle'): void
}>();

// Component functionality (search functionality removed)

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

// Tips data - Based on actual Tangent project features
const tips = [
  { icon: Code, text: 'Claude Code integration lets you run development sessions directly in Tangent' },
  { icon: GitBranch, text: 'Double-click messages to create conversation branches and explore alternative paths' },
  { icon: Terminal, text: 'Monitor tool executions in real-time with granular tracking of bash commands and file operations' },
  { icon: Layers, text: 'Import ChatGPT conversations to preserve your chat history and continue in Tangent' },
  { icon: Zap, text: 'Use different AI models per branch - switch between Claude, GPT, Gemini, and local Ollama models' },
  { icon: Cpu, text: 'Track AI costs and usage across providers with built-in budgeting and monitoring' },
  { icon: Lightbulb, text: 'Snap to fullscreen mode for focused conversation editing by pressing S on selected nodes' },
  { icon: MousePointer, text: 'Drag and drop files for instant AI analysis - supports images, audio, video, and documents' },
  { icon: Sparkles, text: 'Use the 3D visualization to explore complex conversation trees and topic relationships' },
  { icon: Settings, text: 'Configure agent personalities and specialized prompts for different types of tasks' },
  { icon: GitBranch, text: 'Session persistence means you can pause, resume, and export your Claude Code sessions' },
  { icon: Layers, text: 'Level-of-detail rendering keeps performance smooth even with hundreds of conversation nodes' }
];
</script>

<style scoped>

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
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 70vh;
  background: hsl(var(--b2) / 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid hsl(var(--b3));
  border-bottom: none;
  border-radius: 1.5rem 1.5rem 0 0;
  box-shadow: 0 -10px 50px rgba(0, 0, 0, 0.3), inset 0 1px 0 hsl(var(--bc) / 0.1);
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 1000;
  pointer-events: auto;
}

.sliding-footer-panel.is-open {
  transform: translateY(0);
  animation: slideUpBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes slideUpBounce {
  0% {
    transform: translateY(0);
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
  display: flex;
  flex-direction: column;
  padding: 1rem;
  overflow: hidden;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

.left-column, .right-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
}


/* Glass Panel Base Styles */
.glass-panel {
  background: hsl(var(--b2) / 0.2);
  border: 1px solid hsl(var(--b3));
  border-radius: 1rem;
  backdrop-filter: blur(12px);
  box-shadow: inset 0 1px 0 hsl(var(--bc) / 0.1);
  overflow: hidden;
  transition: all 0.3s ease;
}

.glass-panel:hover {
  background: hsl(var(--b2) / 0.3);
  transform: translateY(-2px);
  box-shadow: 
    inset 0 1px 0 hsl(var(--bc) / 0.1),
    0 8px 25px rgba(0, 0, 0, 0.15);
}

/* Quick Actions Card */
.quick-actions-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  padding: 1rem;
  flex: 1;
}

.action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: hsl(var(--b2) / 0.3);
  border: 1px solid hsl(var(--b3));
  border-radius: 0.75rem;
  backdrop-filter: blur(8px);
  color: hsl(var(--bc) / 0.8);
  transition: all 0.3s ease;
  cursor: pointer;
}

.action-button:hover {
  background: hsl(var(--b2) / 0.5);
  color: hsl(var(--bc));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.action-button span {
  font-size: 0.75rem;
  font-weight: 500;
  text-align: center;
}

/* Shortcuts Card */
.shortcuts-card {
  flex: 1;
  align-items: anchor-center;
  display: flex;
  flex-direction: column;
}

.shortcuts-compact {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  overflow-y: auto;
}

.shortcut-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: hsl(var(--b2) / 0.3);
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.shortcut-row:hover {
  background: hsl(var(--b2) / 0.5);
  transform: translateX(2px);
}

.shortcut-keys {
  display: flex;
  gap: 0.25rem;
  min-width: fit-content;
}

.glass-kbd-mini {
  padding: 0.125rem 0.375rem;
  background: hsl(var(--b2) / 0.6);
  border: 1px solid hsl(var(--b3));
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: hsl(var(--bc));
  backdrop-filter: blur(8px);
}

.shortcut-desc {
  font-size: 0.75rem;
  color: hsl(var(--bc) / 0.7);
  line-height: 1.3;
}

/* Tips Card */
.tips-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tips-carousel {
  padding: 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  flex: 1;
  overflow-y: auto;
}

.tip-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: hsl(var(--b2) / 0.3);
  border: 1px solid hsl(var(--b3));
  border-radius: 0.75rem;
  backdrop-filter: blur(8px);
  transition: all 0.3s ease;
}

.tip-card:hover {
  background: hsl(var(--b2) / 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.tip-icon-wrapper {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 50%;
  color: #22c55e;
}

.tip-content {
  font-size: 0.75rem;
  color: hsl(var(--bc) / 0.8);
  text-align: center;
  line-height: 1.4;
  margin: 0;
}

/* Stats Card */
.stats-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.stats-grid {
  padding: 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  flex: 1;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: hsl(var(--b2) / 0.3);
  border: 1px solid hsl(var(--b3));
  border-radius: 0.75rem;
  backdrop-filter: blur(8px);
  transition: all 0.3s ease;
}

.stat-item:hover {
  background: hsl(var(--b2) / 0.5);
  transform: scale(1.05);
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: hsl(var(--bc));
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.625rem;
  color: hsl(var(--bc) / 0.6);
  text-align: center;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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


/* Custom scrollbar */
.shortcuts-compact::-webkit-scrollbar,
.tips-carousel::-webkit-scrollbar {
  width: 4px;
}

.shortcuts-compact::-webkit-scrollbar-track,
.tips-carousel::-webkit-scrollbar-track {
  background: transparent;
}

.shortcuts-compact::-webkit-scrollbar-thumb,
.tips-carousel::-webkit-scrollbar-thumb {
  background: hsl(var(--bc) / 0.2);
  border-radius: 2px;
}

.shortcuts-compact::-webkit-scrollbar-thumb:hover,
.tips-carousel::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--bc) / 0.3);
}

/* Responsive design */
@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  
  .quick-actions-grid,
  .tips-carousel,
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }
  
  .shortcuts-compact {
    max-height: 150px;
  }
}

@media (max-width: 768px) {
  .footer-content {
    padding: 0.75rem;
  }
  
  .content-grid {
    gap: 0.5rem;
  }
  
  .section-header,
  .panel-header {
    padding: 0.75rem 1rem;
  }
  
  .quick-actions-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .tips-carousel {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  
  .action-button,
  .tip-card,
  .stat-item {
    padding: 0.75rem;
  }
  
  .stat-number {
    font-size: 1.25rem;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .shortcut-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>