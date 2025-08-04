<template>
  <div class="claude-terminal">
    <!-- Terminal Header -->
    <div class="terminal-header">
      <div class="terminal-title">
        <span class="terminal-icon">▶</span>
        <span>claude-code</span>
        <span class="cursor">█</span>
      </div>
      <div class="terminal-controls">
        <button @click="refreshInstances" class="terminal-btn" title="Refresh">
          ↻
        </button>
        <button @click="clearTerminal" class="terminal-btn" title="Clear">
          ✕
        </button>
      </div>
    </div>

    <!-- Terminal Content -->
    <div class="terminal-content" ref="terminalContent">
      <!-- Tool Detail View -->
      <div v-if="selectedTool" class="terminal-section">
        <div class="terminal-line">
          <span class="prompt">$</span>
          <span class="command">claude-code tool inspect {{ selectedTool.id }}</span>
        </div>
        <div class="terminal-output">
          <div class="tool-detail-header">
            ┌─ TOOL EXECUTION DETAILS ─────────────────────────────────┐
            │ {{ selectedTool.tool_name.toUpperCase() }} - {{ formatStatus(selectedTool.status) }}
            └──────────────────────────────────────────────────────────┘
          </div>
          
          <div class="detail-section">
            <div class="section-header">► PARAMETERS</div>
            <div v-for="(value, key) in selectedTool.parameters" :key="key" class="param-line">
              {{ key.padEnd(12) }} : {{ formatValue(value) }}
            </div>
          </div>

          <div v-if="selectedTool.result" class="detail-section">
            <div class="section-header">► RESULT</div>
            <div class="result-output">
              <pre>{{ formatResult(selectedTool.result) }}</pre>
            </div>
          </div>

          <div v-if="selectedTool.error_message" class="detail-section error">
            <div class="section-header">► ERROR</div>
            <div class="error-output">
              {{ selectedTool.error_message }}
            </div>
          </div>

          <div class="detail-section">
            <div class="section-header">► TIMING</div>
            <div class="timing-line">
              duration     : {{ formatDuration(selectedTool.duration_ms) }}
            </div>
            <div class="timing-line">
              created      : {{ formatTimestamp(selectedTool.created_at) }}
            </div>
            <div v-if="selectedTool.updated_at !== selectedTool.created_at" class="timing-line">
              updated      : {{ formatTimestamp(selectedTool.updated_at) }}
            </div>
          </div>

          <div class="terminal-line action-line">
            <span class="prompt">$</span>
            <button @click="clearSelectedTool" class="terminal-link">back to overview</button>
          </div>
        </div>
      </div>

      <!-- Main Overview -->
      <div v-else class="terminal-section">
        <!-- Status Line -->
        <div class="terminal-line">
          <span class="prompt">$</span>
          <span class="command">claude-code status</span>
        </div>
        <div class="terminal-output">
          <div class="status-header">
            ┌─ CLAUDE CODE SESSION STATUS ─────────────────────────────┐
            │ {{ formatStatusLine() }}
            └──────────────────────────────────────────────────────────┘
          </div>
        </div>

        <!-- Active Sessions -->
        <div v-if="claudeCodeInstances.length > 0" class="terminal-line">
          <span class="prompt">$</span>
          <span class="command">claude-code list --active</span>
        </div>
        <div v-if="claudeCodeInstances.length > 0" class="terminal-output">
          <div class="sessions-header">
            PID      STATUS    MEMORY   COST     NAME
            ──────── ───────── ──────── ──────── ─────────────────────
          </div>
          <div v-for="instance in claudeCodeInstances" :key="instance.instance_id" 
               class="session-line" 
               @click="selectInstance(instance)">
            {{ formatSessionLine(instance) }}
          </div>
        </div>

        <!-- Recent Tools -->
        <div v-if="recentTools.length > 0" class="terminal-line">
          <span class="prompt">$</span>
          <span class="command">claude-code tools --recent</span>
        </div>
        <div v-if="recentTools.length > 0" class="terminal-output">
          <div class="tools-header">
            TOOL     STATUS    DURATION  DESCRIPTION
            ──────── ───────── ───────── ─────────────────────────────
          </div>
          <div v-for="tool in recentTools" :key="tool.id" 
               class="tool-line" 
               @click="selectTool(tool)">
            {{ formatToolLine(tool) }}
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="terminal-line">
          <span class="prompt">$</span>
          <span class="command">claude-code --help</span>
        </div>
        <div class="terminal-output">
          <div class="help-section">
            AVAILABLE COMMANDS:
            
            <button @click="showCreateForm = !showCreateForm" class="terminal-link">
              new                    Create new session
            </button>
            <button @click="refreshInstances" class="terminal-link">
              refresh               Refresh session data  
            </button>
            <button @click="exportInstances" class="terminal-link">
              export                Export session data
            </button>
            <button @click="clearAllSessions" class="terminal-link">
              clear --all           Clear all sessions
            </button>
          </div>
        </div>

        <!-- Create Form -->
        <div v-if="showCreateForm" class="create-section">
          <div class="terminal-line">
            <span class="prompt">$</span>
            <span class="command">claude-code new --interactive</span>
          </div>
          <div class="terminal-output">
            <div class="form-field">
              <label>session_name:</label>
              <input v-model="newInstance.name" class="terminal-input" placeholder="my-session" />
            </div>
            <div class="form-field">
              <label>working_dir:</label>
              <input v-model="newInstance.working_dir" class="terminal-input" placeholder="/path/to/project" />
            </div>
            <div class="form-field">
              <label>initial_prompt:</label>
              <textarea v-model="newInstance.initial_prompt" class="terminal-textarea" 
                        placeholder="Help me with my project..."></textarea>
            </div>
            <div class="form-actions">
              <button @click="createInstance" class="terminal-link" 
                      :disabled="!canCreateInstance">
                [create]
              </button>
              <button @click="showCreateForm = false" class="terminal-link">
                [cancel]
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, nextTick, watch } from 'vue'
import { useToolCallStore } from '@/stores/toolCallStore'

const props = defineProps<{
  nodeId?: string
  selectedToolCall?: any
}>()

const emit = defineEmits<{
  'open-workspace': [instance: any]
  'tool-selected': [tool: any]
}>()

// Stores
const toolCallStore = useToolCallStore()

// State
const selectedTool = ref(props.selectedToolCall || null)
const showCreateForm = ref(false)
const terminalContent = ref<HTMLElement>()

// Define scrollToBottom early so it's available for the watcher
const scrollToBottom = () => {
  nextTick(() => {
    if (terminalContent.value) {
      terminalContent.value.scrollTop = terminalContent.value.scrollHeight
    }
  })
}

// Watch for prop changes to update selected tool
watch(() => props.selectedToolCall, (newToolCall) => {
  selectedTool.value = newToolCall
  if (newToolCall) {
    scrollToBottom()
  }
}, { immediate: true })

// New Instance Form
const newInstance = reactive({
  name: '',
  working_dir: '',
  initial_prompt: '',
  max_turns: 10,
  cost_limit: 2.0,
  tools: {
    read: true,
    write: true,
    bash: true,
    webfetch: false
  }
})

// Computed properties
const claudeCodeInstances = computed(() => toolCallStore.getAllInstances)
const claudeCodeSessions = computed(() => toolCallStore.claudeCodeSessions)
const totalCost = computed(() => toolCallStore.getTotalCost)

const canCreateInstance = computed(() => {
  return newInstance.name.trim() &&
    newInstance.working_dir.trim() &&
    newInstance.initial_prompt.trim()
})

const recentTools = computed(() => {
  if (!props.nodeId) return []
  return toolCallStore.getToolCallsForNode(props.nodeId).slice(0, 5)
})

// Methods
const formatStatusLine = () => {
  const activeCount = claudeCodeInstances.value.filter(i => i.status === 'running').length
  const totalMemory = claudeCodeInstances.value.reduce((sum, i) => sum + (i.memory_mb || 0), 0)
  return `${activeCount} active • $${totalCost.value.toFixed(2)} total • ${totalMemory}MB memory`
}

const formatSessionLine = (instance: any) => {
  const pid = (instance.pid || 'N/A').toString().padEnd(8)
  const status = instance.status.padEnd(9)
  const memory = `${instance.memory_mb || 0}MB`.padEnd(8)
  const cost = `$${(instance.cost_usd || 0).toFixed(2)}`.padEnd(8)
  const name = (instance.config?.name || `Process ${instance.pid}`).substring(0, 25)
  return `${pid} ${status} ${memory} ${cost} ${name}`
}

const formatToolLine = (tool: any) => {
  const toolName = tool.tool_name.padEnd(8)
  const status = formatStatus(tool.status).padEnd(9)
  const duration = formatDuration(tool.duration_ms).padEnd(9)
  const desc = getToolDescription(tool).substring(0, 35)
  return `${toolName} ${status} ${duration} ${desc}`
}

const formatStatus = (status: string) => {
  switch (status) {
    case 'success': return '✓ OK'
    case 'error': return '✗ ERR'
    case 'pending': return '◐ RUN'
    default: return '? UNK'
  }
}

const formatDuration = (ms?: number) => {
  if (!ms) return 'N/A'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString()
}

const formatValue = (value: any): string => {
  if (typeof value === 'string' && value.length > 60) {
    return value.substring(0, 60) + '...'
  }
  return String(value)
}

const formatResult = (result: any): string => {
  if (typeof result === 'string') return result
  return JSON.stringify(result, null, 2)
}

const getToolDescription = (tool: any) => {
  const { tool_name, parameters } = tool
  switch (tool_name) {
    case 'Read': return `Reading ${getFileName(parameters.file_path)}`
    case 'Write': return `Writing ${getFileName(parameters.file_path)}`
    case 'Bash': return `Running ${parameters.command?.split(' ')[0] || 'command'}`
    case 'WebFetch': return `Fetching ${getDomain(parameters.url)}`
    default: return tool_name
  }
}

const getFileName = (filePath?: string) => {
  if (!filePath) return 'file'
  const parts = filePath.split('/')
  return parts[parts.length - 1] || 'file'
}

const getDomain = (url?: string) => {
  if (!url) return 'URL'
  try {
    return new URL(url).hostname
  } catch {
    return 'URL'
  }
}

// Actions
const selectTool = (tool: any) => {
  selectedTool.value = tool
  emit('tool-selected', tool)
  scrollToBottom()
}

const clearSelectedTool = () => {
  selectedTool.value = null
  emit('tool-selected', null)
}

const selectInstance = (instance: any) => {
  emit('open-workspace', instance)
}

const refreshInstances = async () => {
  await toolCallStore.fetchClaudeCodeInstances()
}

const clearTerminal = () => {
  selectedTool.value = null
  showCreateForm.value = false
}

const createInstance = async () => {
  try {
    const instance = await toolCallStore.createClaudeCodeInstance(newInstance)
    if (instance) {
      resetForm()
      showCreateForm.value = false
      await refreshInstances()
    }
  } catch (error) {
    console.error('Error creating instance:', error)
  }
}

const resetForm = () => {
  newInstance.name = ''
  newInstance.working_dir = ''
  newInstance.initial_prompt = ''
  newInstance.max_turns = 10
  newInstance.cost_limit = 2.0
}

const exportInstances = () => {
  const data = {
    instances: claudeCodeInstances.value,
    sessions: claudeCodeSessions.value,
    exportedAt: new Date().toISOString(),
    totalCost: totalCost.value
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `claude-code-export-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const clearAllSessions = async () => {
  if (confirm('Clear all session data? This cannot be undone.')) {
    try {
      const stopPromises = claudeCodeInstances.value
        .filter(instance => instance.status === 'running')
        .map(instance => toolCallStore.stopInstance(instance.instance_id))
      
      await Promise.all(stopPromises)
      toolCallStore.clearAllData()
    } catch (error) {
      console.error('Error clearing sessions:', error)
    }
  }
}

// Initialize
onMounted(async () => {
  await refreshInstances()
  toolCallStore.fetchClaudeCodeSessions()
})
</script>

<style scoped>
.claude-terminal {
  background: #0f172a;
  color: #e2e8f0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
}

.terminal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #22d3ee;
  font-weight: 600;
}

.terminal-icon {
  color: #10b981;
}

.cursor {
  animation: blink 1s infinite;
  color: #22d3ee;
}

.terminal-controls {
  display: flex;
  gap: 8px;
}

.terminal-btn {
  background: none;
  border: 1px solid #475569;
  color: #94a3b8;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.terminal-btn:hover {
  background: #334155;
  color: #e2e8f0;
}

.terminal-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  overflow-x: hidden;
}

.terminal-section {
  margin-bottom: 24px;
}

.terminal-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.prompt {
  color: #10b981;
  font-weight: 600;
}

.command {
  color: #22d3ee;
}

.terminal-output {
  margin-left: 16px;
  margin-bottom: 16px;
  color: #cbd5e1;
}

.tool-detail-header,
.status-header {
  color: #fbbf24;
  font-weight: 600;
  margin-bottom: 12px;
  white-space: pre;
}

.detail-section {
  margin-bottom: 16px;
}

.section-header {
  color: #22d3ee;
  font-weight: 600;
  margin-bottom: 8px;
}

.param-line,
.timing-line {
  color: #94a3b8;
  margin-bottom: 4px;
}

.result-output {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 4px;
  padding: 12px;
  margin-top: 8px;
}

.result-output pre {
  margin: 0;
  color: #e2e8f0;
  white-space: pre-wrap;
  word-break: break-word;
}

.error {
  .section-header {
    color: #ef4444;
  }
}

.error-output {
  color: #fca5a5;
  background: #1f1416;
  border: 1px solid #532e2e;
  border-radius: 4px;
  padding: 8px;
}

.sessions-header,
.tools-header {
  color: #64748b;
  font-weight: 600;
  margin-bottom: 8px;
}

.session-line,
.tool-line {
  color: #94a3b8;
  cursor: pointer;
  padding: 2px 0;
  transition: color 0.2s ease;
}

.session-line:hover,
.tool-line:hover {
  color: #22d3ee;
  background: #1e293b;
  padding-left: 8px;
  margin-left: -8px;
  border-radius: 2px;
}

.help-section {
  color: #94a3b8;
  line-height: 1.6;
}

.terminal-link {
  background: none;
  border: none;
  color: #22d3ee;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  display: inline;
}

.terminal-link:hover {
  color: #7dd3fc;
}

.terminal-link:disabled {
  color: #64748b;
  cursor: not-allowed;
  text-decoration: none;
}

.action-line {
  margin-top: 16px;
}

.create-section {
  margin-top: 16px;
}

.form-field {
  margin-bottom: 12px;
}

.form-field label {
  color: #22d3ee;
  display: block;
  margin-bottom: 4px;
}

.terminal-input,
.terminal-textarea {
  background: #1e293b;
  border: 1px solid #334155;
  color: #e2e8f0;
  padding: 6px 8px;
  border-radius: 3px;
  font-family: inherit;
  font-size: inherit;
  width: 100%;
  max-width: 300px;
}

.terminal-textarea {
  resize: vertical;
  min-height: 60px;
}

.terminal-input:focus,
.terminal-textarea:focus {
  outline: none;
  border-color: #22d3ee;
  box-shadow: 0 0 0 1px #22d3ee;
}

.form-actions {
  margin-top: 12px;
  display: flex;
  gap: 16px;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Scrollbar */
.terminal-content::-webkit-scrollbar {
  width: 8px;
}

.terminal-content::-webkit-scrollbar-track {
  background: #1e293b;
}

.terminal-content::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}

.terminal-content::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>