<template>
  <div 
    class="tool-call-branch-node"
    :class="[
      'theme-' + currentTheme,
      { 'snapped': isSnapped, 'dragging': isDragging }
    ]"
    :style="nodeStyle"
    @mousedown.left="startDrag"
    @contextmenu.prevent="showContextMenu"
  >
    <!-- Node Header -->
    <div class="node-header">
      <div class="header-left">
        <Terminal :size="16" class="tool-icon" />
        <span class="tool-name">{{ toolCall.name }}</span>
        <div class="status-indicator" :class="statusClass">
          <div class="status-dot"></div>
          <span class="status-text">{{ statusText }}</span>
        </div>
      </div>
      
      <div class="header-controls">
        <button
          @click="openInNewWindow"
          class="control-btn"
          title="Open in new window"
        >
          <ExternalLink :size="14" />
        </button>
        <button
          @click="copyToClipboard"
          class="control-btn"
          title="Copy tool call details"
        >
          <Copy :size="14" />
        </button>
        <button
          @click="closeNode"
          class="control-btn close-btn"
          title="Close and return to main session"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- Tool Call Content -->
    <div class="tool-call-content">
      <ToolCallDisplay 
        :tool-call="toolCall"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Terminal,
  ExternalLink,
  Copy,
  X
} from 'lucide-vue-next'

import ToolCallDisplay from './ToolCallDisplay.vue'
import { useThemeStore } from '@/stores/themeStore'
import { useThemeColors } from '@/composables/useThemeColors'

interface ToolCall {
  id: string
  name: string
  parameters: Record<string, any>
  result?: any
  error?: {
    message: string
    details?: string
  }
  timing?: {
    duration: number
    startTime: string
    endTime?: string
  }
  status: 'pending' | 'success' | 'error'
}

interface Position {
  x: number
  y: number
}

const props = defineProps<{
  toolCall: ToolCall
  position: Position
  isSnapped?: boolean
  isDragging?: boolean
}>()

const emit = defineEmits<{
  'close': []
  'move': [position: Position]
  'open-in-window': [toolCall: ToolCall]
}>()

// Theme composables
const themeStore = useThemeStore()
const { currentTheme, getTextColor, themeColors } = useThemeColors()

// Computed properties
const statusClass = computed(() => {
  return {
    'status-pending': props.toolCall.status === 'pending',
    'status-success': props.toolCall.status === 'success',
    'status-error': props.toolCall.status === 'error'
  }
})

const statusText = computed(() => {
  switch (props.toolCall.status) {
    case 'pending': return 'Running...'
    case 'success': return 'Completed'
    case 'error': return 'Failed'
    default: return 'Unknown'
  }
})

const nodeStyle = computed(() => ({
  left: `${props.position.x}px`,
  top: `${props.position.y}px`,
  color: getTextColor(),
  borderColor: props.toolCall.status === 'error' 
    ? '#ef4444' 
    : props.toolCall.status === 'success' 
      ? '#22c55e' 
      : themeColors.value.primary
}))

// Methods

const startDrag = (e: MouseEvent) => {
  // Implement drag logic here
  console.log('Drag started for tool call node')
}

const showContextMenu = (e: MouseEvent) => {
  // Implement context menu
  console.log('Context menu for tool call node')
}

const openInNewWindow = () => {
  emit('open-in-window', props.toolCall)
}

const copyToClipboard = async () => {
  const content = `Tool Call: ${props.toolCall.name}\n\nParameters:\n${formatParameters(props.toolCall.parameters)}\n\nResult:\n${formatResult(props.toolCall.result)}`
  
  try {
    await navigator.clipboard.writeText(content)
    console.log('Tool call details copied to clipboard')
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const closeNode = () => {
  emit('close')
}
</script>

<style scoped>
.tool-call-branch-node {
  position: absolute;
  background: var(--node-bg);
  border: 2px solid;
  border-radius: 12px;
  box-shadow: var(--node-shadow);
  backdrop-filter: blur(12px);
  width: 400px;
  max-height: 600px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
}

.tool-call-branch-node.snapped {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tool-call-branch-node.dragging {
  transform: scale(1.02);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--panel-header-bg);
  border-bottom: 1px solid var(--panel-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.tool-icon {
  color: var(--theme-primary);
  flex-shrink: 0;
}

.tool-name {
  font-weight: 600;
  font-size: 14px;
  color: inherit;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-pending {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-pending .status-dot {
  background: #3b82f6;
  animation: pulse 1.5s ease-in-out infinite;
}

.status-success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.status-success .status-dot {
  background: #22c55e;
}

.status-error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-error .status-dot {
  background: #ef4444;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.control-btn:hover {
  opacity: 1;
  background: rgba(128, 128, 128, 0.1);
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.tool-call-content {
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Scrollbar styling */
.tool-call-content::-webkit-scrollbar {
  width: 6px;
}

.tool-call-content::-webkit-scrollbar-track {
  background: transparent;
}

.tool-call-content::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: 3px;
}

.tool-call-content::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.5);
}
</style>