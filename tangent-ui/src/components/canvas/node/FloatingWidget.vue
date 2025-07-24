<template>
  <Teleport to="body">
    <Transition name="widget-fade">
      <div 
        v-if="isVisible"
        class="floating-widget"
        :class="[
          `position-${position}`,
          `type-${type}`,
          { 'interactive': isInteractive }
        ]"
        :style="widgetStyle"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <!-- Progress Widget -->
        <div v-if="type === 'progress'" class="widget-content progress-content">
          <div class="progress-ring">
            <svg viewBox="0 0 36 36" class="circular-chart">
              <circle 
                class="circle-bg" 
                cx="18" 
                cy="18" 
                r="16" 
                stroke="rgba(var(--node-color-rgb), 0.2)"
                stroke-width="2" 
                fill="transparent"
              />
              <circle 
                class="circle-progress" 
                cx="18" 
                cy="18" 
                r="16"
                stroke="var(--node-color)"
                stroke-width="2" 
                fill="transparent"
                stroke-dasharray="100"
                :stroke-dashoffset="100 - progress"
                stroke-linecap="round"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <div class="progress-text">
              <span class="progress-value">{{ Math.round(progress) }}%</span>
            </div>
          </div>
          <div class="progress-label">{{ label || 'Processing...' }}</div>
        </div>

        <!-- Tool Status Widget -->
        <div v-else-if="type === 'tool-status'" class="widget-content tool-status-content">
          <div class="tool-icon" :class="`tool-${toolName?.toLowerCase()}`">
            <component :is="getToolIcon(toolName)" class="w-4 h-4" />
          </div>
          <div class="tool-info">
            <div class="tool-name">{{ toolName }}</div>
            <div class="tool-description">{{ description }}</div>
          </div>
          <div class="status-indicator" :class="status">
            <div class="status-dot"></div>
          </div>
        </div>

        <!-- Notification Widget -->
        <div v-else-if="type === 'notification'" class="widget-content notification-content">
          <div class="notification-icon" :class="notificationLevel">
            <component :is="getNotificationIcon(notificationLevel)" class="w-4 h-4" />
          </div>
          <div class="notification-text">
            <div class="notification-title">{{ title }}</div>
            <div class="notification-message">{{ message }}</div>
          </div>
          <button 
            v-if="isInteractive" 
            @click="$emit('close')"
            class="notification-close"
          >
            <XMarkIcon class="w-3 h-3" />
          </button>
        </div>

        <!-- Custom Content Widget -->
        <div v-else-if="type === 'custom'" class="widget-content custom-content">
          <slot></slot>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { 
  CommandLineIcon, 
  DocumentTextIcon, 
  PencilIcon, 
  MagnifyingGlassIcon,
  CodeBracketIcon,
  FolderIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'

interface Props {
  isVisible: boolean
  type: 'progress' | 'tool-status' | 'notification' | 'custom'
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  progress?: number
  label?: string
  toolName?: string
  description?: string
  status?: 'pending' | 'success' | 'error'
  title?: string
  message?: string
  notificationLevel?: 'info' | 'success' | 'warning' | 'error'
  isInteractive?: boolean
  autoHide?: boolean
  autoHideDelay?: number
  x?: number
  y?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: 'custom',
  position: 'center',
  progress: 0,
  status: 'pending',
  notificationLevel: 'info',
  isInteractive: false,
  autoHide: true,
  autoHideDelay: 3000,
  x: 0,
  y: 0
})

const emit = defineEmits<{
  close: []
  mouseEnter: []
  mouseLeave: []
}>()

const isHovered = ref(false)
const autoHideTimer = ref<number | null>(null)

const widgetStyle = computed(() => {
  const style: Record<string, string> = {}
  
  // Position-based styling
  switch (props.position) {
    case 'top-left':
      style.top = '20px'
      style.left = '20px'
      break
    case 'top-right':
      style.top = '20px'
      style.right = '20px'
      break
    case 'bottom-left':
      style.bottom = '20px'
      style.left = '20px'
      break
    case 'bottom-right':
      style.bottom = '20px'
      style.right = '20px'
      break
    case 'center':
      style.top = '50%'
      style.left = '50%'
      style.transform = 'translate(-50%, -50%)'
      break
  }
  
  // Custom positioning
  if (props.x !== 0 || props.y !== 0) {
    style.left = `${props.x}px`
    style.top = `${props.y}px`
    style.transform = 'none'
  }
  
  return style
})

const getToolIcon = (toolName?: string) => {
  if (!toolName) return CodeBracketIcon
  
  const iconMap: Record<string, any> = {
    'Bash': CommandLineIcon,
    'bash': CommandLineIcon,
    'Read': DocumentTextIcon,
    'read': DocumentTextIcon,
    'Write': PencilIcon,
    'write': PencilIcon,
    'Edit': PencilIcon,
    'edit': PencilIcon,
    'Grep': MagnifyingGlassIcon,
    'grep': MagnifyingGlassIcon,
    'Glob': FolderIcon,
    'glob': FolderIcon,
    'Task': CodeBracketIcon,
    'task': CodeBracketIcon
  }
  return iconMap[toolName] || CodeBracketIcon
}

const getNotificationIcon = (level?: string) => {
  const iconMap: Record<string, any> = {
    'info': InformationCircleIcon,
    'success': CheckCircleIcon,
    'warning': ExclamationTriangleIcon,
    'error': ExclamationTriangleIcon
  }
  return iconMap[level || 'info']
}

const handleMouseEnter = () => {
  isHovered.value = true
  if (autoHideTimer.value) {
    clearTimeout(autoHideTimer.value)
    autoHideTimer.value = null
  }
  emit('mouseEnter')
}

const handleMouseLeave = () => {
  isHovered.value = false
  startAutoHideTimer()
  emit('mouseLeave')
}

const startAutoHideTimer = () => {
  if (props.autoHide && !isHovered.value) {
    autoHideTimer.value = window.setTimeout(() => {
      emit('close')
    }, props.autoHideDelay)
  }
}

onMounted(() => {
  if (props.isVisible) {
    startAutoHideTimer()
  }
})

onUnmounted(() => {
  if (autoHideTimer.value) {
    clearTimeout(autoHideTimer.value)
  }
})
</script>

<style scoped>
.floating-widget {
  position: fixed;
  z-index: 1000;
  pointer-events: auto;
  backdrop-filter: blur(16px);
  border-radius: 0.75rem;
  padding: 0.75rem;
  min-width: 200px;
  max-width: 300px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--node-border-color);
  background: rgba(var(--b1), 0.9);
  color: var(--node-text-color);
}

.floating-widget.interactive {
  cursor: pointer;
}

.widget-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Progress Widget */
.progress-content {
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.progress-ring {
  position: relative;
  width: 40px;
  height: 40px;
}

.circular-chart {
  width: 100%;
  height: 100%;
}

.circle-progress {
  transition: stroke-dashoffset 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.progress-value {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--node-color);
}

.progress-label {
  font-size: 0.875rem;
  text-align: center;
  opacity: 0.9;
}

/* Tool Status Widget */
.tool-status-content {
  align-items: flex-start;
}

.tool-icon {
  width: 32px;
  height: 32px;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tool-bash {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.tool-read, .tool-write, .tool-edit {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.tool-grep, .tool-glob {
  background: rgba(168, 85, 247, 0.2);
  color: #a855f7;
}

.tool-task {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.tool-info {
  flex: 1;
  min-width: 0;
}

.tool-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--node-color);
}

.tool-description {
  font-size: 0.75rem;
  opacity: 0.8;
  margin-top: 0.125rem;
  word-break: break-word;
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-indicator.pending .status-dot {
  background: #f59e0b;
}

.status-indicator.success .status-dot {
  background: #10b981;
  animation: none;
}

.status-indicator.error .status-dot {
  background: #ef4444;
  animation: none;
}

/* Notification Widget */
.notification-content {
  align-items: flex-start;
}

.notification-icon {
  width: 24px;
  height: 24px;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notification-icon.info {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.notification-icon.success {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.notification-icon.warning {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.notification-icon.error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.notification-text {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.125rem;
}

.notification-message {
  font-size: 0.75rem;
  opacity: 0.8;
  line-height: 1.4;
}

.notification-close {
  background: none;
  border: none;
  color: var(--node-text-color);
  opacity: 0.6;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}

.notification-close:hover {
  opacity: 1;
  background: rgba(var(--node-color-rgb), 0.1);
}

/* Position variants */
.position-top-left {
  animation: slideInFromTopLeft 0.3s ease-out;
}

.position-top-right {
  animation: slideInFromTopRight 0.3s ease-out;
}

.position-bottom-left {
  animation: slideInFromBottomLeft 0.3s ease-out;
}

.position-bottom-right {
  animation: slideInFromBottomRight 0.3s ease-out;
}

.position-center {
  animation: scaleIn 0.3s ease-out;
}

/* Transitions */
.widget-fade-enter-active,
.widget-fade-leave-active {
  transition: all 0.3s ease;
}

.widget-fade-enter-from,
.widget-fade-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* Animations */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes slideInFromTopLeft {
  from {
    opacity: 0;
    transform: translate(-20px, -20px);
  }
  to {
    opacity: 1;
    transform: translate(0, 0);
  }
}

@keyframes slideInFromTopRight {
  from {
    opacity: 0;
    transform: translate(20px, -20px);
  }
  to {
    opacity: 1;
    transform: translate(0, 0);
  }
}

@keyframes slideInFromBottomLeft {
  from {
    opacity: 0;
    transform: translate(-20px, 20px);
  }
  to {
    opacity: 1;
    transform: translate(0, 0);
  }
}

@keyframes slideInFromBottomRight {
  from {
    opacity: 0;
    transform: translate(20px, 20px);
  }
  to {
    opacity: 1;
    transform: translate(0, 0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

/* Custom content styling */
.custom-content {
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
}
</style>