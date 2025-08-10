<template>
  <div class="slash-command-container" :class="[commandStatus, commandType]">
    <!-- Command Header -->
    <div class="command-header">
      <div class="command-indicator">
        <component :is="getCommandIcon(command)" :size="14" />
      </div>
      <div class="command-info">
        <span class="command-name">{{ command }}</span>
        <span class="command-params" v-if="parameters">{{ parameters }}</span>
      </div>
      <div class="command-status">
        <div v-if="status === 'executing'" class="status-spinner">
          <div class="spinner"></div>
        </div>
        <component 
          v-else 
          :is="getStatusIcon(status)" 
          :size="12" 
          :class="status"
        />
      </div>
    </div>

    <!-- Command Results (Expandable) -->
    <div 
      v-if="hasResults" 
      class="command-results"
      :class="{ expanded: showResults }"
    >
      <div class="results-toggle" @click="toggleResults">
        <ChevronRight :size="12" :class="{ rotated: showResults }" />
        <span class="results-label">
          {{ showResults ? 'Hide' : 'Show' }} {{ resultType }}
        </span>
      </div>
      
      <div v-if="showResults" class="results-content">
        <!-- Text Results -->
        <div v-if="results.type === 'text'" class="text-results">
          <pre class="result-text">{{ results.content }}</pre>
        </div>

        <!-- Config Results -->
        <div v-else-if="results.type === 'config'" class="config-results">
          <div class="config-grid">
            <div 
              v-for="[key, value] in Object.entries(results.content)" 
              :key="key"
              class="config-item"
            >
              <span class="config-key">{{ key }}</span>
              <span class="config-value">{{ formatConfigValue(value) }}</span>
            </div>
          </div>
        </div>

        <!-- Cost Results -->
        <div v-else-if="results.type === 'cost'" class="cost-results">
          <div class="cost-metrics">
            <div class="cost-item">
              <span class="cost-label">Session Cost</span>
              <span class="cost-value">${{ results.content.sessionCost }}</span>
            </div>
            <div class="cost-item">
              <span class="cost-label">Total Cost</span>
              <span class="cost-value">${{ results.content.totalCost }}</span>
            </div>
            <div class="cost-item">
              <span class="cost-label">Tokens Used</span>
              <span class="cost-value">{{ results.content.tokensUsed }}</span>
            </div>
          </div>
        </div>

        <!-- Tool List Results -->
        <div v-else-if="results.type === 'tools'" class="tools-results">
          <div class="tools-grid">
            <div 
              v-for="tool in results.content" 
              :key="tool.name"
              class="tool-item"
            >
              <component :is="getToolIcon(tool.name)" :size="14" />
              <span class="tool-name">{{ tool.name }}</span>
              <span class="tool-status" :class="tool.status">{{ tool.status }}</span>
            </div>
          </div>
        </div>

        <!-- Generic Results -->
        <div v-else class="generic-results">
          <div class="result-content">{{ results.content }}</div>
        </div>
      </div>
    </div>

    <!-- Execution Time -->
    <div v-if="executionTime" class="execution-time">
      {{ executionTime }}ms
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  Terminal, 
  Settings, 
  DollarSign, 
  Trash2, 
  HelpCircle, 
  LogOut,
  Zap,
  Archive,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  Loader,
  Wrench,
  Code,
  FileText,
  Database
} from 'lucide-vue-next'

interface SlashCommandProps {
  command: string
  parameters?: string
  status: 'pending' | 'executing' | 'success' | 'error'
  results?: {
    type: 'text' | 'config' | 'cost' | 'tools' | 'generic'
    content: any
  }
  executionTime?: number
  timestamp: Date
}

const props = defineProps<SlashCommandProps>()

const showResults = ref(false)

const commandType = computed(() => {
  return `command-${props.command.replace('/', '')}`
})

const commandStatus = computed(() => {
  return `status-${props.status}`
})

const hasResults = computed(() => {
  return props.results && props.status === 'success'
})

const resultType = computed(() => {
  if (!props.results) return ''
  
  switch (props.results.type) {
    case 'config': return 'Configuration'
    case 'cost': return 'Cost Details'
    case 'tools': return 'Tool List'
    default: return 'Results'
  }
})

const toggleResults = () => {
  showResults.value = !showResults.value
}

const getCommandIcon = (command: string) => {
  const iconMap: Record<string, any> = {
    '/clear': Trash2,
    '/config': Settings,
    '/cost': DollarSign,
    '/help': HelpCircle,
    '/exit': LogOut,
    '/compact': Archive,
    '/mcp': Zap,
    '/tools': Wrench,
    '/memory': Database
  }
  
  return iconMap[command] || Terminal
}

const getStatusIcon = (status: string) => {
  const statusIconMap: Record<string, any> = {
    'success': Check,
    'error': X,
    'pending': AlertCircle,
    'executing': Loader
  }
  
  return statusIconMap[status] || AlertCircle
}

const getToolIcon = (toolName: string) => {
  const toolIconMap: Record<string, any> = {
    'Read': FileText,
    'Write': FileText,
    'Bash': Terminal,
    'Edit': Code,
    'default': Wrench
  }
  
  return toolIconMap[toolName] || toolIconMap.default
}

const formatConfigValue = (value: any) => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}
</script>

<style scoped>
.slash-command-container {
  @apply relative mb-2 rounded-lg border transition-all duration-200;
  background: oklch(from oklch(var(--b1)) l c h / 0.02);
  border-color: oklch(from oklch(var(--bc)) l c h / 0.1);
}

.slash-command-container:hover {
  background: oklch(from oklch(var(--b1)) l c h / 0.05);
  border-color: oklch(from oklch(var(--bc)) l c h / 0.2);
}

.command-header {
  @apply flex items-center gap-3 p-3;
}

.command-indicator {
  @apply flex items-center justify-center w-6 h-6 rounded-full;
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  color: oklch(var(--p));
}

.command-info {
  @apply flex-1 min-w-0;
}

.command-name {
  @apply font-mono text-sm font-medium;
  color: oklch(var(--p));
}

.command-params {
  @apply ml-2 text-xs opacity-70 font-mono;
  color: oklch(var(--bc));
}

.command-status {
  @apply flex items-center justify-center w-5 h-5;
}

.status-spinner .spinner {
  @apply w-3 h-3 border border-current rounded-full animate-spin;
  border-top-color: transparent;
}

.success {
  @apply text-success;
}

.error {
  @apply text-error;
}

.pending {
  @apply text-warning;
}

.executing {
  @apply text-info;
}

.command-results {
  @apply border-t transition-all duration-200;
  border-color: oklch(from oklch(var(--bc)) l c h / 0.05);
}

.results-toggle {
  @apply flex items-center gap-2 p-3 cursor-pointer hover:bg-base-200/30 transition-colors;
}

.results-toggle:hover .rotated {
  transform: rotate(90deg);
}

.rotated {
  transform: rotate(90deg);
  transition: transform 0.2s;
}

.results-label {
  @apply text-xs font-medium opacity-70;
}

.results-content {
  @apply px-3 pb-3;
}

.text-results .result-text {
  @apply text-xs font-mono bg-base-200/30 p-3 rounded border whitespace-pre-wrap;
}

.config-grid {
  @apply space-y-1;
}

.config-item {
  @apply flex justify-between items-start gap-4 text-xs;
}

.config-key {
  @apply font-medium min-w-0 flex-shrink-0;
  color: oklch(var(--bc));
}

.config-value {
  @apply font-mono opacity-70 text-right;
  color: oklch(var(--bc));
}

.cost-metrics {
  @apply space-y-2;
}

.cost-item {
  @apply flex justify-between items-center text-xs;
}

.cost-label {
  @apply font-medium;
  color: oklch(var(--bc));
}

.cost-value {
  @apply font-mono font-medium;
  color: oklch(var(--p));
}

.tools-grid {
  @apply space-y-1;
}

.tool-item {
  @apply flex items-center gap-2 text-xs;
}

.tool-name {
  @apply flex-1 font-medium;
}

.tool-status {
  @apply px-2 py-0.5 rounded-full text-xs font-medium;
}

.tool-status.active {
  @apply bg-success/20 text-success;
}

.tool-status.inactive {
  @apply bg-base-300 text-base-content/50;
}

.execution-time {
  @apply absolute top-1 right-1 text-xs opacity-50 font-mono;
  color: oklch(var(--bc));
}

/* Command-specific styling */
.command-clear .command-indicator {
  background: oklch(from oklch(var(--error)) l c h / 0.1);
  color: oklch(var(--error));
}

.command-config .command-indicator {
  background: oklch(from oklch(var(--info)) l c h / 0.1);
  color: oklch(var(--info));
}

.command-cost .command-indicator {
  background: oklch(from oklch(var(--success)) l c h / 0.1);
  color: oklch(var(--success));
}

.command-help .command-indicator {
  background: oklch(from oklch(var(--accent)) l c h / 0.1);
  color: oklch(var(--accent));
}

.status-success {
  border-left: 3px solid oklch(var(--success));
}

.status-error {
  border-left: 3px solid oklch(var(--error));
}

.status-executing {
  border-left: 3px solid oklch(var(--info));
}

.status-pending {
  border-left: 3px solid oklch(var(--warning));
}
</style>