<template>
  <Teleport to="body">
    <Transition name="context-menu">
      <div 
        v-if="visible"
        class="canvas-context-menu"
        :style="menuStyle"
        @click.stop
      >
        <div class="menu-container">
          <button 
            class="menu-item"
            @click="handleNewChat"
          >
            <span class="menu-icon">💬</span>
            <span class="menu-label">New Chat</span>
          </button>
          
          <button 
            class="menu-item claude-code"
            @click="handleNewClaudeCode"
          >
            <span class="menu-icon">🤖</span>
            <span class="menu-label">New Claude Code Session</span>
          </button>
          
          <div class="menu-divider"></div>
          
          <button 
            class="menu-item cancel"
            @click="handleCancel"
          >
            <span class="menu-icon">✕</span>
            <span class="menu-label">Cancel</span>
          </button>
        </div>
      </div>
    </Transition>
    
    <!-- Click outside overlay -->
    <div 
      v-if="visible"
      class="context-menu-overlay"
      @click="handleCancel"
    ></div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'

interface Props {
  visible: boolean
  x: number
  y: number
  worldX: number
  worldY: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'new-chat': [position: { x: number; y: number }]
  'new-claude-code': [position: { x: number; y: number }]
  'close': []
}>()

const menuStyle = computed(() => {
  // Ensure menu stays within viewport
  const menuWidth = 240
  const menuHeight = 180
  const padding = 10
  
  let left = props.x
  let top = props.y
  
  // Adjust if menu would go off-screen
  if (props.x + menuWidth > window.innerWidth - padding) {
    left = window.innerWidth - menuWidth - padding
  }
  
  if (props.y + menuHeight > window.innerHeight - padding) {
    top = window.innerHeight - menuHeight - padding
  }
  
  return {
    left: `${left}px`,
    top: `${top}px`
  }
})

const handleNewChat = () => {
  emit('new-chat', { x: props.worldX, y: props.worldY })
  emit('close')
}

const handleNewClaudeCode = () => {
  emit('new-claude-code', { x: props.worldX, y: props.worldY })
  emit('close')
}

const handleCancel = () => {
  emit('close')
}

// Handle escape key
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible) {
    handleCancel()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

.canvas-context-menu {
  position: fixed;
  z-index: 9999;
  pointer-events: auto;
}

.menu-container {
  background: color-mix(in srgb, oklch(var(--b1)) 98%, oklch(var(--p)) 2%);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.15);
  border-radius: 12px;
  padding: 8px;
  box-shadow: 
    0 10px 40px -10px oklch(from oklch(var(--bc)) l c h / 0.3),
    0 0 0 1px oklch(from oklch(var(--bc)) l c h / 0.05);
  backdrop-filter: blur(20px);
  min-width: 220px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: oklch(var(--bc));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.menu-item:hover {
  background: oklch(from oklch(var(--bc)) l c h / 0.08);
  transform: translateX(2px);
}

.menu-item.claude-code {
  color: oklch(var(--p));
}

.menu-item.claude-code:hover {
  background: oklch(from oklch(var(--p)) l c h / 0.1);
}

.menu-item.cancel {
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.menu-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.menu-label {
  flex: 1;
}

.menu-divider {
  height: 1px;
  background: oklch(from oklch(var(--bc)) l c h / 0.1);
  margin: 4px 8px;
}

/* Transition animations */
.context-menu-enter-active,
.context-menu-leave-active {
  transition: all 0.2s ease;
}

.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>