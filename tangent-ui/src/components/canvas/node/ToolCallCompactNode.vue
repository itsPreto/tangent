<template>
  <div 
    class="tool-call-compact-node"
    :class="[
      'compact-card',
      { 
        'selected': isSelected,
        'success': toolCall?.status === 'success',
        'error': toolCall?.status === 'error',
        'pending': toolCall?.status === 'pending',
        'dragging': isDragging
      }
    ]"
    @click="handleClick"
    @dblclick="handleDoubleClick"
    @mousedown="handleMouseDown"
  >
    <!-- Status indicator -->
    <div class="status-indicator" :class="statusClass">
      <div class="status-dot"></div>
    </div>
    
    <!-- Tool icon -->
    <div class="tool-icon">
      <component :is="getToolIcon()" />
    </div>
    
    <!-- Tool label -->
    <div class="tool-label">
      {{ getToolLabel() }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { 
  File, 
  Terminal, 
  Globe, 
  Settings,
  Search,
  Edit3,
  Play,
  Download,
  FileText,
  Code
} from 'lucide-vue-next'

interface ToolCall {
  id: string
  node_id: string
  tool_name: string
  parameters: Record<string, any>
  result?: Record<string, any>
  status: 'pending' | 'success' | 'error'
  error_message?: string
  duration_ms?: number
  created_at: string
  updated_at: string
}

interface Props {
  toolCall?: ToolCall
  isSelected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false
})

const emit = defineEmits<{
  click: [toolCall: ToolCall]
  doubleClick: [toolCall: ToolCall]
}>()

// Drag detection state
const isDragging = ref(false)
const isDraggable = ref(false)
const dragStartPosition = ref({ x: 0, y: 0 })
const DRAG_THRESHOLD = 5
const recentlyDragged = ref(false)

const statusClass = computed(() => {
  if (!props.toolCall) return 'status-error'
  
  switch (props.toolCall.status) {
    case 'success': return 'status-success'
    case 'error': return 'status-error'
    case 'pending': return 'status-pending'
    default: return ''
  }
})

function getToolIcon() {
  if (!props.toolCall) return Settings
  
  switch (props.toolCall.tool_name) {
    case 'Read': return FileText
    case 'Write': return Edit3
    case 'Edit': return Edit3
    case 'Bash': return Terminal
    case 'WebFetch': return Globe
    case 'WebSearch': return Search
    case 'Grep': return Search
    case 'Glob': return Search
    case 'Task': return Play
    default: return Settings
  }
}

function getToolLabel(): string {
  if (!props.toolCall) return 'Unknown Tool'
  
  const { tool_name, parameters } = props.toolCall
  
  switch (tool_name) {
    case 'Read':
      return `Reading ${getFileName(parameters.file_path)}`
    case 'Write':
      return `Writing ${getFileName(parameters.file_path)}`
    case 'Edit':
      return `Editing ${getFileName(parameters.file_path)}`
    case 'Bash':
      return `Running ${getCommandPreview(parameters.command)}`
    case 'WebFetch':
      return `Fetching ${getDomain(parameters.url)}`
    case 'WebSearch':
      if (parameters.query) {
        return `Search: ${parameters.query.substring(0, 30)}${parameters.query.length > 30 ? '...' : ''}`
      } else if (parameters.note && parameters.note.includes('Incomplete data')) {
        return 'WebSearch (no query data)'
      } else {
        return 'WebSearch'
      }
    case 'Grep':
      return `Searching "${parameters.pattern}"`
    case 'Glob':
      return `Finding ${parameters.pattern}`
    case 'Task':
      return parameters.description || 'Running task'
    default:
      return tool_name
  }
}

function getFileName(filePath?: string): string {
  if (!filePath) return 'file'
  const parts = filePath.split('/')
  return parts[parts.length - 1] || 'file'
}

function getCommandPreview(command?: string): string {
  if (!command) return 'command'
  const parts = command.split(' ')
  return parts[0] || 'command'
}

function getDomain(url?: string): string {
  if (!url) return 'URL'
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return 'URL'
  }
}

function handleClick() {
  // Prevent click if node was recently dragged
  if (recentlyDragged.value) {
    recentlyDragged.value = false
    return
  }
  
  if (props.toolCall) {
    emit('click', props.toolCall)
  }
}

function handleDoubleClick() {
  if (props.toolCall && !isDragging.value) {
    emit('doubleClick', props.toolCall)
  }
}

// Drag handling functions
function handleMouseDown(e: MouseEvent) {
  if (e.button !== 0) return // Only handle left click
  
  dragStartPosition.value = { x: e.clientX, y: e.clientY }
  isDraggable.value = true
  isDragging.value = false
  
  // Add global event listeners for drag
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(e: MouseEvent) {
  if (!isDraggable.value) return
  
  const dx = Math.abs(e.clientX - dragStartPosition.value.x)
  const dy = Math.abs(e.clientY - dragStartPosition.value.y)
  
  // Start dragging if mouse moved beyond threshold
  if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
    isDragging.value = true
    recentlyDragged.value = true
  }
}

function handleMouseUp() {
  const wasDragging = isDragging.value
  
  isDraggable.value = false
  isDragging.value = false
  
  // Clean up global event listeners
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  
  // Clear the "recently dragged" flag after a short delay
  if (wasDragging) {
    setTimeout(() => {
      recentlyDragged.value = false
    }, 100)
  }
}

// Cleanup on unmount
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<style scoped>
.tool-call-compact-node {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 8px;
  background: hsl(var(--b1));
  border: 2px solid hsl(var(--bc) / 0.2);
  border-radius: 20px;
  padding: 8px 12px;
  cursor: grab;
  transition: all 0.2s ease;
  z-index: 10;
  max-width: 200px;
  min-width: 120px;
  height: 40px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
}

.tool-call-compact-node:hover {
  transform: translateY(-1px) scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: hsl(var(--p) / 0.5);
}

.tool-call-compact-node.selected {
  border-color: hsl(var(--p));
  box-shadow: 0 0 0 2px hsl(var(--p) / 0.2);
}

.tool-call-compact-node.success {
  border-color: #10b981;
  background: color-mix(in srgb, #10b981 8%, hsl(var(--b1)));
}

.tool-call-compact-node.error {
  border-color: #ef4444;
  background: color-mix(in srgb, #ef4444 8%, hsl(var(--b1)));
}

.tool-call-compact-node.pending {
  border-color: #f59e0b;
  background: color-mix(in srgb, #f59e0b 8%, hsl(var(--b1)));
}

.tool-call-compact-node.dragging {
  cursor: grabbing;
  opacity: 0.8;
  transform: scale(1.05);
  z-index: 1000;
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 8px;
  height: 8px;
  flex-shrink: 0;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.status-success .status-dot {
  background: #10b981;
}

.status-error .status-dot {
  background: #ef4444;
}

.status-pending .status-dot {
  background: #f59e0b;
  animation: pulse 1.5s ease-in-out infinite;
}

.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: hsl(var(--bc) / 0.7);
}

.tool-call-compact-node.success .tool-icon {
  color: #10b981;
}

.tool-call-compact-node.error .tool-icon {
  color: #ef4444;
}

.tool-call-compact-node.pending .tool-icon {
  color: #f59e0b;
}

.tool-label {
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--bc) / 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.8);
  }
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
  .tool-call-compact-node {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .tool-call-compact-node:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
}
</style>