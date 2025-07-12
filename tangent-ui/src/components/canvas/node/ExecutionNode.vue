<template>
  <div 
    class="execution-node"
    :class="[
      'modern-card',
      'node-card',
      { 
        'selected': isSelected,
        'running': executionNode.status === 'running',
        'completed': executionNode.status === 'completed',
        'failed': executionNode.status === 'failed',
        'killed': executionNode.status === 'killed'
      }
    ]"
    :style="nodeStyle"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  >
    <!-- Node Header -->
    <div class="node-header">
      <div class="execution-icon">
        <component :is="getStatusIcon()" :class="iconClass" />
      </div>
      <div class="execution-info">
        <div class="command-preview">{{ commandPreview }}</div>
        <div class="execution-status" :class="statusClass">
          {{ statusText }}
        </div>
      </div>
      <div class="execution-actions">
        <button 
          v-if="executionNode.status === 'running'"
          @click.stop="terminateExecution"
          class="action-btn terminate-btn"
          title="Terminate"
        >
          <Square :size="16" />
        </button>
        <button 
          v-if="canRerun"
          @click.stop="rerunExecution"
          class="action-btn rerun-btn"
          title="Re-run"
        >
          <RotateCcw :size="16" />
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

    <!-- Execution Stats -->
    <div class="execution-stats">
      <div class="stat-item">
        <strong>Status:</strong> {{ statusText }}
      </div>
      <div v-if="executionNode.pid" class="stat-item">
        <strong>PID:</strong> {{ executionNode.pid }}
      </div>
      <div v-if="executionNode.exit_code !== null" class="stat-item">
        <strong>Exit Code:</strong> {{ executionNode.exit_code }}
      </div>
      <div class="stat-item">
        <strong>Duration:</strong> {{ executionDuration }}
      </div>
    </div>

    <!-- Execution Details (collapsed by default) -->
    <div v-if="showDetails" class="execution-details">
      <div class="section">
        <h4>Command</h4>
        <div class="command-full">
          <pre>{{ executionNode.command }}</pre>
        </div>
      </div>

      <div class="section">
        <h4>Environment</h4>
        <div class="env-info">
          <div class="env-item">
            <strong>Working Directory:</strong> {{ executionNode.working_dir }}
          </div>
          <div v-if="executionNode.environment" class="env-item">
            <strong>Environment Variables:</strong>
            <div class="env-vars">
              <div 
                v-for="(value, key) in executionNode.environment" 
                :key="key"
                class="env-var"
              >
                <span class="env-key">{{ key }}:</span>
                <span class="env-value">{{ value }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Output Section -->
      <div v-if="executionNode.stdout" class="section">
        <h4>Output (stdout)</h4>
        <div class="output-container">
          <pre class="output-content stdout">{{ executionNode.stdout }}</pre>
        </div>
      </div>

      <!-- Error Section -->
      <div v-if="executionNode.stderr" class="section">
        <h4>Errors (stderr)</h4>
        <div class="output-container">
          <pre class="output-content stderr">{{ executionNode.stderr }}</pre>
        </div>
      </div>

      <!-- Timing Section -->
      <div class="section timing-section">
        <div class="timing-item">
          <strong>Started:</strong> {{ formatTimestamp(executionNode.created_at) }}
        </div>
        <div v-if="executionNode.updated_at !== executionNode.created_at" class="timing-item">
          <strong>Finished:</strong> {{ formatTimestamp(executionNode.updated_at) }}
        </div>
        <div v-if="executionNode.started_by" class="timing-item">
          <strong>Started by:</strong> {{ getToolCallName(executionNode.started_by) }}
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <button 
        v-if="executionNode.status === 'running'"
        @click.stop="terminateExecution"
        class="action-btn terminate-btn"
        title="Terminate Execution"
      >
        <Square :size="16" />
      </button>
      <button 
        v-if="canRerun"
        @click.stop="rerunExecution"
        class="action-btn rerun-btn"
        title="Re-run Command"
      >
        <RotateCcw :size="16" />
      </button>
      <button 
        @click.stop="copyOutput"
        class="action-btn copy-btn"
        title="Copy Output"
      >
        <Copy :size="16" />
      </button>
      <button 
        v-if="hasLogs"
        @click.stop="downloadLogs"
        class="action-btn download-btn"
        title="Download Logs"
      >
        <Download :size="16" />
      </button>
    </div>

    <!-- Real-time Output (for running executions) -->
    <div v-if="executionNode.status === 'running' && showRealTimeOutput" class="real-time-output">
      <div class="output-header">
        <h4>Live Output</h4>
        <button @click="showRealTimeOutput = false" class="close-btn">
          <X :size="16" />
        </button>
      </div>
      <div class="live-output">
        <pre ref="liveOutputRef" class="live-content">{{ liveOutput }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { 
  Terminal, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Square,
  ChevronDown, 
  RotateCcw, 
  Copy,
  Download,
  X
} from 'lucide-vue-next'

interface ExecutionNode {
  id: string
  node_id: string
  command: string
  working_dir?: string
  environment?: Record<string, string>
  pid?: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed'
  exit_code?: number
  stdout?: string
  stderr?: string
  started_by?: string
  created_at: string
  updated_at: string
}

interface Props {
  executionNode: ExecutionNode
  isSelected?: boolean
  position: { x: number, y: number }
  width?: number
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  width: 400,
  height: 160
})

const emit = defineEmits<{
  click: [executionNode: ExecutionNode]
  doubleClick: [executionNode: ExecutionNode]
  terminate: [executionNode: ExecutionNode]
  rerun: [executionNode: ExecutionNode]
}>()

const showDetails = ref(false)
const showRealTimeOutput = ref(false)
const liveOutput = ref('')
const liveOutputRef = ref<HTMLElement>()

const nodeStyle = computed(() => ({
  left: `${props.position.x}px`,
  top: `${props.position.y}px`,
  width: `${props.width}px`,
  minHeight: `${props.height}px`
}))

const commandPreview = computed(() => {
  const cmd = props.executionNode.command
  return cmd.length > 50 ? cmd.substring(0, 50) + '...' : cmd
})

const statusClass = computed(() => {
  switch (props.executionNode.status) {
    case 'completed': return 'status-success'
    case 'failed': return 'status-error'
    case 'killed': return 'status-killed'
    case 'running': return 'status-running'
    case 'pending': return 'status-pending'
    default: return ''
  }
})

const statusText = computed(() => {
  switch (props.executionNode.status) {
    case 'completed': return 'Completed'
    case 'failed': return 'Failed'
    case 'killed': return 'Killed'
    case 'running': return 'Running'
    case 'pending': return 'Pending'
    default: return 'Unknown'
  }
})

const iconClass = computed(() => {
  switch (props.executionNode.status) {
    case 'completed': return 'text-green-500'
    case 'failed': return 'text-red-500'
    case 'killed': return 'text-orange-500'
    case 'running': return 'text-blue-500 animate-pulse'
    case 'pending': return 'text-yellow-500'
    default: return 'text-gray-500'
  }
})

const canRerun = computed(() => {
  return ['completed', 'failed', 'killed'].includes(props.executionNode.status)
})

const hasLogs = computed(() => {
  return props.executionNode.stdout || props.executionNode.stderr
})

const executionDuration = computed(() => {
  const start = new Date(props.executionNode.created_at)
  const end = new Date(props.executionNode.updated_at)
  const duration = end.getTime() - start.getTime()
  
  if (props.executionNode.status === 'running') {
    const now = new Date()
    const runningDuration = now.getTime() - start.getTime()
    return formatDuration(runningDuration)
  }
  
  return formatDuration(duration)
})

function getStatusIcon() {
  switch (props.executionNode.status) {
    case 'completed': return CheckCircle
    case 'failed': return XCircle
    case 'killed': return Square
    case 'running': return Play
    case 'pending': return Clock
    default: return Terminal
  }
}

function handleClick() {
  emit('click', props.executionNode)
}

function handleDoubleClick() {
  emit('doubleClick', props.executionNode)
}

function terminateExecution() {
  emit('terminate', props.executionNode)
}

function rerunExecution() {
  emit('rerun', props.executionNode)
}

function copyOutput() {
  const output = []
  if (props.executionNode.stdout) {
    output.push('STDOUT:')
    output.push(props.executionNode.stdout)
  }
  if (props.executionNode.stderr) {
    output.push('STDERR:')
    output.push(props.executionNode.stderr)
  }
  navigator.clipboard.writeText(output.join('\n\n'))
}

function downloadLogs() {
  const output = []
  output.push(`Command: ${props.executionNode.command}`)
  output.push(`Working Directory: ${props.executionNode.working_dir}`)
  output.push(`Status: ${props.executionNode.status}`)
  output.push(`Exit Code: ${props.executionNode.exit_code}`)
  output.push(`Started: ${props.executionNode.created_at}`)
  output.push(`Finished: ${props.executionNode.updated_at}`)
  output.push('')
  
  if (props.executionNode.stdout) {
    output.push('STDOUT:')
    output.push(props.executionNode.stdout)
    output.push('')
  }
  
  if (props.executionNode.stderr) {
    output.push('STDERR:')
    output.push(props.executionNode.stderr)
  }
  
  const blob = new Blob([output.join('\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `execution-${props.executionNode.id}.log`
  a.click()
  URL.revokeObjectURL(url)
}

function getToolCallName(toolCallId: string): string {
  return `Tool Call #${toolCallId.substring(0, 8)}`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString()
}

// Real-time output monitoring (would be connected to WebSocket)
let outputInterval: number | null = null

onMounted(() => {
  if (props.executionNode.status === 'running') {
    showRealTimeOutput.value = true
    // Simulate real-time output updates
    outputInterval = setInterval(() => {
      liveOutput.value += `[${new Date().toISOString()}] Process running...\n`
      nextTick(() => {
        if (liveOutputRef.value) {
          liveOutputRef.value.scrollTop = liveOutputRef.value.scrollHeight
        }
      })
    }, 2000)
  }
})

onUnmounted(() => {
  if (outputInterval) {
    clearInterval(outputInterval)
  }
})
</script>

<style scoped>
.execution-node {
  position: absolute;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid #e2e8f0;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
  border-left: 4px solid #06b6d4;
}

.execution-node.selected {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.execution-node.running {
  border-left-color: #3b82f6;
}

.execution-node.completed {
  border-left-color: #10b981;
}

.execution-node.failed {
  border-left-color: #ef4444;
}

.execution-node.killed {
  border-left-color: #f59e0b;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.execution-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #f0f9ff;
}

.execution-info {
  flex: 1;
  min-width: 0;
}

.command-preview {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
  font-family: monospace;
  word-break: break-all;
}

.execution-status {
  font-size: 12px;
  margin-top: 2px;
}

.status-success {
  color: #10b981;
}

.status-error {
  color: #ef4444;
}

.status-killed {
  color: #f59e0b;
}

.status-running {
  color: #3b82f6;
}

.status-pending {
  color: #64748b;
}

.execution-actions {
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

.execution-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 11px;
  color: #64748b;
  flex-wrap: wrap;
}

.stat-item strong {
  color: #475569;
}

.execution-details {
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

.command-full {
  background: #f8fafc;
  padding: 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
  word-break: break-all;
}

.env-info {
  font-size: 12px;
}

.env-item {
  margin-bottom: 4px;
}

.env-vars {
  margin-top: 4px;
  padding-left: 12px;
}

.env-var {
  display: flex;
  gap: 8px;
  font-size: 11px;
}

.env-key {
  font-weight: 600;
  color: #475569;
}

.env-value {
  color: #64748b;
}

.output-container {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

.output-content {
  padding: 8px;
  font-size: 11px;
  font-family: monospace;
  margin: 0;
  white-space: pre-wrap;
}

.stdout {
  background: #f8fafc;
  color: #1e293b;
}

.stderr {
  background: #fef2f2;
  color: #dc2626;
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

.real-time-output {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  height: 300px;
  background: #1e293b;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.output-header {
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 12px 16px;
  background: #334155;
  border-radius: 8px 8px 0 0;
  color: white;
}

.output-header h4 {
  margin: 0;
  font-size: 14px;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.live-output {
  height: calc(100% - 60px);
  overflow-y: auto;
}

.live-content {
  padding: 12px;
  font-size: 11px;
  font-family: monospace;
  color: #e2e8f0;
  background: #1e293b;
  margin: 0;
  height: 100%;
}

.rotate-180 {
  transform: rotate(180deg);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>