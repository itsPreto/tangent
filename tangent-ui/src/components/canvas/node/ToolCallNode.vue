<template>
  <div 
    class="tool-call-node"
    :class="[
      'modern-card',
      'node-card',
      { 
        'selected': isSelected,
        'success': toolCall.status === 'success',
        'error': toolCall.status === 'error',
        'pending': toolCall.status === 'pending'
      }
    ]"
    :style="nodeStyle"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  >
    <!-- Node Header -->
    <div class="node-header">
      <div class="tool-icon">
        <component :is="getToolIcon()" />
      </div>
      <div class="tool-info">
        <div class="tool-name">{{ toolCall.tool_name }}</div>
        <div class="tool-status" :class="statusClass">
          {{ statusText }}
        </div>
      </div>
      <div class="tool-actions">
        <button 
          v-if="toolCall.status === 'pending'"
          @click.stop="cancelToolCall"
          class="action-btn cancel-btn"
          title="Cancel"
        >
          <X :size="16" />
        </button>
        <button 
          @click.stop="showDetails = !showDetails"
          class="action-btn details-btn"
          title="Toggle Details"
        >
          <ChevronDown :size="16" :class="{ 'rotate-180': showDetails }" />
        </button>
      </div>
    </div>

    <!-- Tool Parameters (collapsed by default) -->
    <div v-if="showDetails" class="tool-details">
      <div class="section">
        <h4>Parameters</h4>
        <div class="parameters">
          <div 
            v-for="(value, key) in toolCall.parameters" 
            :key="key"
            class="parameter-item"
          >
            <span class="param-key">{{ key }}:</span>
            <span class="param-value">{{ formatValue(value) }}</span>
          </div>
        </div>
      </div>

      <!-- Results Section -->
      <div v-if="toolCall.result" class="section">
        <h4>Result</h4>
        <div class="result-content">
          <pre v-if="toolCall.tool_name === 'Read'">{{ toolCall.result.content }}</pre>
          <div v-else-if="toolCall.tool_name === 'Write'" class="write-result">
            <div class="result-item">
              <strong>File:</strong> {{ toolCall.result.file_path }}
            </div>
            <div class="result-item">
              <strong>Size:</strong> {{ formatFileSize(toolCall.result.file_size) }}
            </div>
            <div class="result-item">
              <strong>Lines:</strong> {{ toolCall.result.lines }}
            </div>
            <div class="result-item">
              <strong>Action:</strong> {{ toolCall.result.action }}
            </div>
          </div>
          <div v-else-if="toolCall.tool_name === 'Bash'" class="bash-result">
            <div class="result-item">
              <strong>Command:</strong> {{ toolCall.result.command }}
            </div>
            <div class="result-item">
              <strong>Exit Code:</strong> {{ toolCall.result.exit_code }}
            </div>
            <div v-if="toolCall.result.stdout" class="stdout">
              <strong>Output:</strong>
              <pre>{{ toolCall.result.stdout }}</pre>
            </div>
            <div v-if="toolCall.result.stderr" class="stderr">
              <strong>Errors:</strong>
              <pre>{{ toolCall.result.stderr }}</pre>
            </div>
          </div>
          <div v-else>
            <pre>{{ JSON.stringify(toolCall.result, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <!-- Error Section -->
      <div v-if="toolCall.error_message" class="section error-section">
        <h4>Error</h4>
        <div class="error-message">
          {{ toolCall.error_message }}
        </div>
      </div>

      <!-- Timing Section -->
      <div class="section timing-section">
        <div class="timing-item">
          <strong>Duration:</strong> {{ formatDuration(toolCall.duration_ms) }}
        </div>
        <div class="timing-item">
          <strong>Created:</strong> {{ formatTimestamp(toolCall.created_at) }}
        </div>
        <div v-if="toolCall.updated_at !== toolCall.created_at" class="timing-item">
          <strong>Updated:</strong> {{ formatTimestamp(toolCall.updated_at) }}
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <button 
        v-if="toolCall.tool_name === 'Bash' && toolCall.status === 'success'"
        @click.stop="rerunCommand"
        class="action-btn rerun-btn"
        title="Re-run Command"
      >
        <RotateCcw :size="16" />
      </button>
      <button 
        v-if="toolCall.tool_name === 'Write'"
        @click.stop="openFile"
        class="action-btn open-btn"
        title="Open File"
      >
        <ExternalLink :size="16" />
      </button>
      <button 
        @click.stop="copyResult"
        class="action-btn copy-btn"
        title="Copy Result"
      >
        <Copy :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  Settings, 
  File, 
  Terminal, 
  Globe, 
  ChevronDown, 
  X, 
  RotateCcw, 
  ExternalLink, 
  Copy,
  Clock,
  CheckCircle,
  XCircle
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
  toolCall: ToolCall
  isSelected?: boolean
  position: { x: number, y: number }
  width?: number
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  width: 320,
  height: 120
})

const emit = defineEmits<{
  click: [toolCall: ToolCall]
  doubleClick: [toolCall: ToolCall]
  cancel: [toolCall: ToolCall]
  rerun: [toolCall: ToolCall]
  openFile: [toolCall: ToolCall]
}>()

const showDetails = ref(false)

const nodeStyle = computed(() => ({
  left: `${props.position.x}px`,
  top: `${props.position.y}px`,
  width: `${props.width}px`,
  minHeight: `${props.height}px`
}))

const statusClass = computed(() => {
  switch (props.toolCall.status) {
    case 'success': return 'status-success'
    case 'error': return 'status-error'
    case 'pending': return 'status-pending'
    default: return ''
  }
})

const statusText = computed(() => {
  switch (props.toolCall.status) {
    case 'success': return 'Success'
    case 'error': return 'Error'
    case 'pending': return 'Running...'
    default: return 'Unknown'
  }
})

function getToolIcon() {
  switch (props.toolCall.tool_name) {
    case 'Read': return File
    case 'Write': return File
    case 'Bash': return Terminal
    case 'WebFetch': return Globe
    default: return Settings
  }
}

function handleClick() {
  emit('click', props.toolCall)
}

function handleDoubleClick() {
  emit('doubleClick', props.toolCall)
}

function cancelToolCall() {
  emit('cancel', props.toolCall)
}

function rerunCommand() {
  emit('rerun', props.toolCall)
}

function openFile() {
  emit('openFile', props.toolCall)
}

function copyResult() {
  if (props.toolCall.result) {
    navigator.clipboard.writeText(JSON.stringify(props.toolCall.result, null, 2))
  }
}

function formatValue(value: any): string {
  if (typeof value === 'string' && value.length > 100) {
    return value.substring(0, 100) + '...'
  }
  return String(value)
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString()
}
</script>

<style scoped>
.tool-call-node {
  position: absolute;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid #e2e8f0;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
}

.tool-call-node.selected {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.tool-call-node.success {
  border-left-color: #10b981;
  border-left-width: 4px;
}

.tool-call-node.error {
  border-left-color: #ef4444;
  border-left-width: 4px;
}

.tool-call-node.pending {
  border-left-color: #f59e0b;
  border-left-width: 4px;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #64748b;
}

.tool-info {
  flex: 1;
}

.tool-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
}

.tool-status {
  font-size: 12px;
  margin-top: 2px;
}

.status-success {
  color: #10b981;
}

.status-error {
  color: #ef4444;
}

.status-pending {
  color: #f59e0b;
}

.tool-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

.tool-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.section {
  margin-bottom: 12px;
}

.section h4 {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
}

.parameters {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.parameter-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.param-key {
  font-weight: 600;
  color: #475569;
  min-width: 80px;
}

.param-value {
  color: #64748b;
  word-break: break-word;
}

.result-content {
  font-size: 12px;
}

.result-item {
  margin-bottom: 4px;
  color: #64748b;
}

.result-item strong {
  color: #475569;
}

.stdout, .stderr {
  margin-top: 8px;
}

.stderr {
  color: #ef4444;
}

.error-section {
  background: #fef2f2;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #fecaca;
}

.error-message {
  color: #dc2626;
  font-size: 12px;
}

.timing-section {
  font-size: 11px;
  color: #94a3b8;
}

.timing-item {
  margin-bottom: 2px;
}

.quick-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}

.rotate-180 {
  transform: rotate(180deg);
}

pre {
  background: #f8fafc;
  padding: 8px;
  border-radius: 4px;
  font-size: 11px;
  overflow-x: auto;
  max-height: 200px;
  margin: 0;
}
</style>