<template>
  <div 
    ref="permissionContainer"
    class="permission-request-cli"
    :class="`theme-${currentTheme}`"
    tabindex="0"
    @keydown="handleKeydown"
    @focus="onFocus"
  >
    <!-- Header -->
    <div class="permission-header">
      <div class="permission-icon">⚠️</div>
      <span class="permission-title">Permission Required</span>
      <div class="permission-status" v-if="status !== 'pending'">
        <span v-if="status === 'approved'" class="status-approved">✓ APPROVED</span>
        <span v-if="status === 'denied'" class="status-denied">✗ DENIED</span>
      </div>
    </div>

    <!-- Tool Details -->
    <div class="tool-details">
      <div class="tool-line">
        <span class="prompt-symbol">$</span>
        <span class="tool-command">{{ toolName }}</span>
        <span class="tool-params" v-if="hasVisibleParams">{{ formatParams(parameters) }}</span>
      </div>
      <div class="tool-description">{{ description }}</div>
    </div>

    <!-- Interactive Options (only show when pending) -->
    <div v-if="status === 'pending'" class="permission-options">
      <div class="options-prompt">Choose action:</div>
      <div class="option-list">
        <div 
          class="option-item"
          :class="{ active: selectedOption === 0 }"
          @click="selectOption(0)"
        >
          <span class="option-key">[Enter]</span>
          <span class="option-action">Allow</span>
          <span class="option-desc">Grant permission and execute</span>
        </div>
        <div 
          class="option-item"
          :class="{ active: selectedOption === 1 }"
          @click="selectOption(1)"
        >
          <span class="option-key">[↓ Enter]</span>
          <span class="option-action">Deny</span>
          <span class="option-desc">Block this action</span>
        </div>
      </div>
      
      <!-- Keyboard hints -->
      <div class="keyboard-hints">
        <span class="hint">↑↓ Navigate</span>
        <span class="hint">Enter Confirm</span>
        <span class="hint">Esc Deny</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useThemeStore } from '@/stores/themeStore'

interface Props {
  toolName: string
  parameters: Record<string, any>
  description: string
  toolCallId: string
  status: 'pending' | 'approved' | 'denied'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'approve': [toolCallId: string, toolName: string, parameters: any]
  'deny': [toolCallId: string, toolName: string, parameters: any]
}>()

// Store and state
const themeStore = useThemeStore()
const currentTheme = computed(() => themeStore.currentTheme)

const permissionContainer = ref<HTMLElement>()
const selectedOption = ref(0) // 0 = Allow, 1 = Deny
const autoFocused = ref(false)

// Computed properties
const hasVisibleParams = computed(() => {
  return Object.keys(props.parameters).length > 0
})

// Methods
const formatParams = (params: Record<string, any>): string => {
  const entries = Object.entries(params)
  if (entries.length === 0) return ''
  
  // Show key params inline, hide verbose ones
  const visible = entries.filter(([key, value]) => {
    if (typeof value === 'string' && value.length > 50) return false
    if (typeof value === 'object') return false
    return true
  }).slice(0, 3)
  
  if (visible.length === 0) return '[complex params]'
  
  return visible.map(([key, value]) => `--${key}="${value}"`).join(' ')
}

const selectOption = (index: number) => {
  selectedOption.value = index
}

const executeOption = () => {
  if (props.status !== 'pending') return
  
  if (selectedOption.value === 0) {
    emit('approve', props.toolCallId, props.toolName, props.parameters)
  } else {
    emit('deny', props.toolCallId, props.toolName, props.parameters)
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (props.status !== 'pending') return
  
  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      selectedOption.value = Math.max(0, selectedOption.value - 1)
      break
      
    case 'ArrowDown':
      event.preventDefault()
      selectedOption.value = Math.min(1, selectedOption.value + 1)
      break
      
    case 'Enter':
      event.preventDefault()
      executeOption()
      break
      
    case 'Escape':
      event.preventDefault()
      selectedOption.value = 1 // Select "Deny"
      executeOption()
      break
      
    case 'Tab':
      event.preventDefault()
      selectedOption.value = selectedOption.value === 0 ? 1 : 0
      break
  }
}

const onFocus = () => {
  autoFocused.value = true
}

// Auto-focus when component mounts (but only if pending)
onMounted(async () => {
  if (props.status === 'pending') {
    await nextTick()
    permissionContainer.value?.focus()
  }
})
</script>

<style scoped>
.permission-request-cli {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  background: var(--theme-surface);
  border: 1px solid var(--theme-warning);
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
  outline: none;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.permission-request-cli:focus {
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 2px rgba(var(--theme-primary-rgb), 0.2);
}

.permission-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
}

.permission-icon {
  font-size: 14px;
}

.permission-title {
  color: var(--theme-warning);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.permission-status {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
}

.status-approved {
  color: var(--theme-success);
}

.status-denied {
  color: var(--theme-error);
}

.tool-details {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--theme-background);
  border-radius: 6px;
  border-left: 3px solid var(--theme-warning);
}

.tool-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
}

.prompt-symbol {
  color: var(--theme-primary);
  font-weight: bold;
}

.tool-command {
  color: var(--theme-text);
  font-weight: 600;
}

.tool-params {
  color: var(--theme-text-muted);
  font-size: 11px;
}

.tool-description {
  color: var(--theme-text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.permission-options {
  border-top: 1px solid var(--theme-border);
  padding-top: 12px;
}

.options-prompt {
  color: var(--theme-text);
  font-size: 11px;
  margin-bottom: 8px;
  font-weight: 500;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
}

.option-item:hover {
  background: var(--theme-surface-hover);
}

.option-item.active {
  background: var(--theme-primary);
  color: var(--theme-primary-content);
  box-shadow: 0 0 0 1px var(--theme-primary);
}

.option-key {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--theme-surface);
  border: 1px solid var(--theme-border);
  border-radius: 3px;
  min-width: 60px;
  text-align: center;
  color: var(--theme-text-muted);
}

.option-item.active .option-key {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: inherit;
}

.option-action {
  font-weight: 600;
  min-width: 60px;
}

.option-desc {
  color: var(--theme-text-muted);
  font-size: 11px;
}

.option-item.active .option-desc {
  color: inherit;
  opacity: 0.8;
}

.keyboard-hints {
  display: flex;
  gap: 16px;
  justify-content: center;
  padding-top: 8px;
  border-top: 1px solid var(--theme-border);
}

.hint {
  font-size: 10px;
  color: var(--theme-text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Animation for new permission requests */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.permission-request-cli {
  animation: slideIn 0.3s ease-out;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .option-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .option-key {
    align-self: flex-start;
  }
  
  .keyboard-hints {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>