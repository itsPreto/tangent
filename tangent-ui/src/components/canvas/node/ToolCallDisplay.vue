<template>
  <div class="tool-call-display" :class="`theme-${currentTheme}`">
    <!-- Tool Parameters -->
    <div class="content-section">
      <h4 class="section-title">
        <Settings :size="14" />
        Parameters
      </h4>
      <div class="section-content">
        <div class="data-display">
          <pre class="data-content"><code class="language-json" v-html="highlightedParameters"></code></pre>
          <button 
            @click="copyParameters"
            class="copy-button"
            title="Copy parameters"
          >
            <Copy :size="12" />
          </button>
        </div>
      </div>
    </div>

    <!-- Tool Result -->
    <div v-if="toolCall.result" class="content-section">
      <h4 class="section-title">
        <CheckCircle :size="14" />
        Result
      </h4>
      <div class="section-content">
        <div class="data-display result-display">
          <pre class="data-content result-content"><code :class="`language-${resultLanguage}`" v-html="highlightedResult"></code></pre>
          <div class="result-actions">
            <button 
              @click="copyResult"
              class="copy-button"
              title="Copy result"
            >
              <Copy :size="12" />
            </button>
            <button 
              v-if="isCodeResult"
              @click="openInSandbox"
              class="sandbox-button"
              title="Open in sandbox"
            >
              <ExternalLink :size="12" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Information -->
    <div v-if="toolCall.error" class="content-section error-section">
      <h4 class="section-title">
        <AlertCircle :size="14" />
        Error
      </h4>
      <div class="section-content">
        <div class="error-details">
          <p class="error-message">{{ toolCall.error.message }}</p>
          <div v-if="toolCall.error.details" class="data-display">
            <pre class="data-content error-content"><code class="language-text">{{ toolCall.error.details }}</code></pre>
            <button 
              @click="copyError"
              class="copy-button"
              title="Copy error details"
            >
              <Copy :size="12" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Timing Information -->
    <div v-if="toolCall.timing" class="content-section timing-section">
      <h4 class="section-title">
        <Clock :size="14" />
        Timing
      </h4>
      <div class="section-content">
        <div class="timing-grid">
          <div class="timing-item">
            <span class="timing-label">Duration:</span>
            <span class="timing-value">{{ formatDuration(toolCall.timing.duration) }}</span>
          </div>
          <div class="timing-item">
            <span class="timing-label">Started:</span>
            <span class="timing-value">{{ formatTime(toolCall.timing.startTime) }}</span>
          </div>
          <div v-if="toolCall.timing.endTime" class="timing-item">
            <span class="timing-label">Completed:</span>
            <span class="timing-value">{{ formatTime(toolCall.timing.endTime) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Settings,
  CheckCircle,
  AlertCircle,
  Clock,
  Copy,
  ExternalLink
} from 'lucide-vue-next'

import { useThemeStore } from '@/stores/themeStore'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'
import emitter from '@/utils/eventBus'
import Prism from 'prismjs'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-markup'

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

const props = defineProps<{
  toolCall: ToolCall
}>()

// No emits needed - using event bus directly

// Stores
const themeStore = useThemeStore()
const appStore = useAppStore()
const chatStore = useChatStore()

// Theme
const currentTheme = computed(() => themeStore.currentTheme)

// Format parameters as highlighted JSON
const highlightedParameters = computed(() => {
  const json = JSON.stringify(props.toolCall.parameters, null, 2)
  return Prism.highlight(json, Prism.languages.json, 'json')
})

// Detect result language and format
const resultLanguage = computed(() => {
  if (!props.toolCall.result) return 'text'
  
  const result = props.toolCall.result
  
  // Check if it's a file operation result
  if (props.toolCall.name === 'Read' && typeof result === 'string') {
    // Try to detect file type from content
    if (result.includes('import ') || result.includes('export ')) return 'javascript'
    if (result.includes('def ') || result.includes('import ')) return 'python'
    if (result.includes('<!DOCTYPE') || result.includes('<html')) return 'markup'
    if (result.includes('function') || result.includes('const')) return 'javascript'
    return 'text'
  }
  
  if (props.toolCall.name === 'Bash') return 'bash'
  if (props.toolCall.name === 'Write' || props.toolCall.name === 'Edit') return 'text'
  
  // Default to text
  return 'text'
})

// Format result with syntax highlighting
const highlightedResult = computed(() => {
  if (!props.toolCall.result) return ''
  
  const result = typeof props.toolCall.result === 'string' 
    ? props.toolCall.result 
    : JSON.stringify(props.toolCall.result, null, 2)
  
  const language = resultLanguage.value
  
  if (Prism.languages[language]) {
    return Prism.highlight(result, Prism.languages[language], language)
  }
  
  return result
})

// Check if result is code that can be opened in sandbox
const isCodeResult = computed(() => {
  if (!props.toolCall.result) return false
  
  const codeLanguages = ['javascript', 'typescript', 'python', 'markup']
  return codeLanguages.includes(resultLanguage.value) && 
         props.toolCall.name === 'Read' &&
         typeof props.toolCall.result === 'string'
})

// Utility functions
const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString()
}

// Copy functions
const copyParameters = async () => {
  const content = JSON.stringify(props.toolCall.parameters, null, 2)
  await navigator.clipboard.writeText(content)
}

const copyResult = async () => {
  const content = typeof props.toolCall.result === 'string' 
    ? props.toolCall.result 
    : JSON.stringify(props.toolCall.result, null, 2)
  await navigator.clipboard.writeText(content)
}

const copyError = async () => {
  const content = `${props.toolCall.error?.message}\n\n${props.toolCall.error?.details || ''}`
  await navigator.clipboard.writeText(content)
}

const openInSandbox = () => {
  if (props.toolCall.result && typeof props.toolCall.result === 'string') {
    // Use the same event system as CodePreview
    emitter.emit('show-sandbox', {
      code: props.toolCall.result,
      language: resultLanguage.value,
      isStreaming: false,
      nodeId: `tool-call-${props.toolCall.id}`,
      codeIndex: 0,
      messageIndex: 0,
      chatId: chatStore.currentChatId,
      complete: true
    })
    
    // Open the side panel
    appStore.openSidePanel()
  }
}
</script>

<style scoped>
.tool-call-display {
  padding: 0;
}

.content-section {
  margin-bottom: 20px;
}

.content-section:last-child {
  margin-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--theme-primary);
  opacity: 0.9;
}

.section-content {
  margin-left: 22px;
}

.data-display {
  position: relative;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  overflow: hidden;
}

.data-content {
  margin: 0;
  padding: 12px;
  font-size: 12px;
  line-height: 1.4;
  overflow-x: auto;
  background: transparent;
  color: inherit;
  max-height: 200px;
  overflow-y: auto;
}

.result-display {
  position: relative;
}

.result-content {
  max-height: 300px;
  padding-right: 80px; /* Space for buttons */
}

.copy-button, .sandbox-button {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: var(--btn-control-bg);
  color: var(--btn-control-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.copy-button:hover, .sandbox-button:hover {
  opacity: 1;
  background: var(--btn-control-hover);
}

.result-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}

.result-actions .copy-button,
.result-actions .sandbox-button {
  position: static;
}

.sandbox-button {
  background: var(--btn-action-bg);
  color: var(--btn-action-text);
}

.sandbox-button:hover {
  background: var(--btn-action-hover);
}

.error-section .section-title {
  color: #ef4444;
}

.error-details {
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}

.error-message {
  color: #ef4444;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}

.error-content {
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 4px;
  padding: 8px;
  font-size: 11px;
  color: #ef4444;
}

.timing-section {
  font-size: 12px;
}

.timing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.timing-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 4px;
}

.timing-label {
  font-weight: 500;
  color: inherit;
  opacity: 0.7;
}

.timing-value {
  font-weight: 600;
  color: var(--theme-primary);
}

/* Scrollbar styling */
.data-content::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.data-content::-webkit-scrollbar-track {
  background: transparent;
}

.data-content::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: 3px;
}

.data-content::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.5);
}
</style>