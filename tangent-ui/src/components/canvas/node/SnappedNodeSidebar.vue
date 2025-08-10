<template>
  <div class="snapped-sidebar left-sidebar" v-if="showSidebar" :style="sidebarStyle">
    <!-- Performance Metrics Panel -->
    <div class="sidebar-section">
      <h3 class="section-title">Performance</h3>
      
      <!-- Token Counter -->
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Tokens</span>
          <span class="metric-value">{{ currentTokens }}/{{ maxTokens }}</span>
        </div>
        <div class="token-progress">
          <div 
            class="token-progress-bar" 
            :style="{ width: `${tokenPercentage}%` }"
          ></div>
        </div>
      </div>

      <!-- Tokens per Second -->
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Speed</span>
          <span class="metric-value">{{ tokensPerSecond }} tok/s</span>
        </div>
        <div class="sparkline-container">
          <svg class="sparkline" viewBox="0 0 100 20">
            <polyline 
              :points="sparklinePoints" 
              fill="none" 
              stroke="var(--node-color)" 
              stroke-width="1.5"
            />
          </svg>
        </div>
      </div>

      <!-- Response Latency -->
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Latency</span>
          <span class="metric-value">{{ responseLatency }}ms</span>
        </div>
        <div class="latency-indicator" :class="latencyClass"></div>
      </div>
    </div>

    <!-- Claude Code Mode Indicator -->
    <div class="sidebar-section" v-if="isClaudeCodeSession">
      <h3 class="section-title">Claude Code</h3>
      
      <div class="mode-indicator-card">
        <div class="mode-header">
          <div class="mode-icon" :class="`mode-${currentMode}`">
            <component :is="getModeIcon(currentMode)" class="w-4 h-4" />
          </div>
          <div class="mode-info">
            <span class="mode-name">{{ currentMode === 'default' ? 'General' : currentMode.charAt(0).toUpperCase() + currentMode.slice(1) }} Mode</span>
            <span class="mode-hint">Shift+Tab to switch</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Command History -->
    <div class="sidebar-section" v-if="isClaudeCodeSession && recentCommands.length > 0">
      <h3 class="section-title">Recent Commands</h3>
      <div class="command-history">
        <div 
          v-for="command in recentCommands" 
          :key="command.id"
          class="command-item"
          :class="command.status"
        >
          <div class="command-icon">
            <component :is="getCommandIcon(command.command)" class="w-3 h-3" />
          </div>
          <div class="command-details">
            <span class="command-name">{{ command.command }}</span>
            <span class="command-time">{{ formatTime(command.timestamp) }}</span>
          </div>
          <div class="command-status" :class="command.status">
            <component :is="getStatusIcon(command.status)" class="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>

    <!-- Context-Aware Activity Feed -->
    <div class="sidebar-section" v-if="isClaudeCodeSession">
      <h3 class="section-title">Tool Activity</h3>
      <div class="activity-feed">
        <div 
          v-for="activity in nodeToolActivities" 
          :key="activity.id"
          class="activity-item"
        >
          <div class="activity-icon" :class="`tool-${activity.tool}`">
            <component :is="getToolIcon(activity.tool)" class="w-3 h-3" />
          </div>
          <div class="activity-content">
            <span class="activity-tool">{{ activity.tool }}</span>
            <span class="activity-description">{{ activity.description }}</span>
            <span class="activity-time">{{ formatTime(activity.timestamp) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat Session Metrics -->
    <div class="sidebar-section" v-else>
      <h3 class="section-title">Session</h3>
      
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Duration</span>
          <span class="metric-value">{{ sessionDuration }}</span>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Messages</span>
          <span class="metric-value">{{ messageCount || 0 }}</span>
        </div>
      </div>
    </div>
  </div>
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
  Cog6ToothIcon,
  CpuChipIcon,
  LightBulbIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'
import { 
  Settings,
  Zap,
  Brain,
  Check,
  X,
  AlertCircle,
  Clock,
  Terminal,
  DollarSign,
  HelpCircle,
  Trash2,
  Archive
} from 'lucide-vue-next'
import { metricsService } from '@/services/metricsService'
import { useSnappedNodeLayout } from '@/composables/useSnappedNodeLayout'
import emitter from '@/utils/eventBus'

interface Props {
  nodeId: string
  isStreaming: boolean
  currentTokens: number
  maxTokens: number
  sessionType?: 'chat' | 'claude-code'
  messageCount?: number
  messages?: any[]
  windowDimensions?: { width: number; height: number }
  isRightContentPanelOpen?: boolean
  stackedPosition?: 'top' | 'bottom'
}

const props = withDefaults(defineProps<Props>(), {
  sessionType: 'chat',
  messageCount: 0,
  windowDimensions: () => ({ width: window.innerWidth, height: window.innerHeight }),
  isRightContentPanelOpen: false,
  stackedPosition: 'top'
})

// Responsive sidebar positioning using new layout composable
const sidebarStyle = computed(() => {
  // Use responsive style from composable, but allow override for minimal layout
  if (layoutStrategy.value === 'minimal') {
    return { display: 'none' };
  }
  
  return {
    ...responsiveStyle.value,
    // Maintain backward compatibility with existing props if needed
    ...(props.windowDimensions ? {} : {})
  };
})

const showSidebar = ref(true)
const sessionStartTime = ref(Date.now())

// Use responsive layout composable
const { leftSidebarStyle: responsiveStyle, layoutStrategy } = useSnappedNodeLayout()

// Get real-time metrics from service
const nodeMetrics = computed(() => metricsService.getNodeMetrics(props.nodeId))
const nodeToolActivities = metricsService.getNodeToolActivities(props.nodeId)

const tokensPerSecond = computed(() => Math.round(nodeMetrics.value.tokensPerSecond))
const responseLatency = computed(() => Math.round(nodeMetrics.value.responseLatency))
const sparklineData = computed(() => nodeMetrics.value.tokenHistory)

const isClaudeCodeSession = computed(() => props.sessionType === 'claude-code')

const tokenPercentage = computed(() => 
  props.maxTokens > 0 ? (props.currentTokens / props.maxTokens) * 100 : 0
)

const latencyClass = computed(() => {
  const latency = responseLatency.value
  if (latency < 100) return 'latency-good'
  if (latency < 500) return 'latency-medium'
  return 'latency-poor'
})

const sessionDuration = computed(() => {
  return metricsService.getSessionDuration(props.nodeId, props.messages || [])
})

const sparklinePoints = computed(() => {
  const data = sparklineData.value
  if (data.length === 0) return '0,10'
  
  const max = Math.max(...data, 1)
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = 20 - ((value / max) * 15)
    return `${x},${y}`
  }).join(' ')
  
  return points
})

const getToolIcon = (tool: string) => {
  const iconMap: Record<string, any> = {
    'Bash': CommandLineIcon,
    'Read': DocumentTextIcon,
    'Write': PencilIcon,
    'Edit': PencilIcon,
    'Grep': MagnifyingGlassIcon,
    'Glob': FolderIcon,
    'Task': CodeBracketIcon
  }
  return iconMap[tool] || CodeBracketIcon
}

// Mock current mode (would come from Claude Code service in real implementation)
const currentMode = ref('default')

// Mock recent commands (would come from store in real implementation)
const recentCommands = ref([
  { id: '1', command: '/config', status: 'success', timestamp: Date.now() - 30000 },
  { id: '2', command: '/tools', status: 'success', timestamp: Date.now() - 120000 },
  { id: '3', command: '/help', status: 'success', timestamp: Date.now() - 300000 }
])

const getModeIcon = (mode: string) => {
  const iconMap: Record<string, any> = {
    'default': Terminal,
    'planning': Brain,
    'coding': CpuChipIcon,
    'analysis': LightBulbIcon,
    'config': Cog6ToothIcon
  }
  return iconMap[mode] || Terminal
}

const getCommandIcon = (command: string) => {
  const iconMap: Record<string, any> = {
    '/config': Settings,
    '/tools': CodeBracketIcon,
    '/help': HelpCircle,
    '/clear': Trash2,
    '/cost': DollarSign,
    '/compact': Archive
  }
  return iconMap[command] || Terminal
}

const getStatusIcon = (status: string) => {
  const statusIconMap: Record<string, any> = {
    'success': Check,
    'error': X,
    'pending': Clock,
    'executing': AlertCircle
  }
  return statusIconMap[status] || Clock
}

const formatTime = (timestamp: number) => {
  const now = Date.now()
  const diff = now - timestamp
  
  if (diff < 1000) return 'now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

onMounted(() => {
  // Start tracking if streaming
  if (props.isStreaming) {
    metricsService.startStreaming(props.nodeId)
  }
})
</script>

<style scoped>
.snapped-sidebar {
  position: fixed;
  top: 20px;
  width: 240px;
  /* height set dynamically via :style binding */
  background: var(--sidebar-bg-color, rgba(var(--b1), 0.8));
  backdrop-filter: blur(16px);
  border: 1px solid var(--sidebar-border-color, var(--node-border-color));
  border-radius: 1rem;
  padding: 1rem;
  overflow-y: auto;
  z-index: 40;
  color: var(--node-text-color);
}

.left-sidebar {
  left: 20px;
}

.sidebar-section {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--node-color);
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-card {
  background: var(--sidebar-card-bg, rgba(var(--node-color-rgb), 0.1));
  border: 1px solid var(--sidebar-card-border, rgba(var(--node-color-rgb), 0.2));
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.metric-label {
  font-size: 0.75rem;
  opacity: 0.8;
}

.metric-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--node-color);
}

.token-progress {
  width: 100%;
  height: 4px;
  background: rgba(var(--node-color-rgb), 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.token-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--node-color), var(--node-color-light));
  transition: width 0.3s ease;
}

.sparkline-container {
  height: 20px;
  width: 100%;
}

.sparkline {
  width: 100%;
  height: 100%;
}

.latency-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 0.25rem;
}

.latency-good {
  background: #10b981;
}

.latency-medium {
  background: #f59e0b;
}

.latency-poor {
  background: #ef4444;
}

.activity-feed {
  max-height: 200px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  margin-bottom: 0.25rem;
  background: var(--sidebar-card-bg, rgba(var(--node-color-rgb), 0.05));
}

.activity-icon {
  width: 24px;
  height: 24px;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tool-Bash {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.tool-Read, .tool-Write, .tool-Edit {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.tool-Grep, .tool-Glob {
  background: rgba(168, 85, 247, 0.2);
  color: #a855f7;
}

.tool-Task {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.activity-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.activity-tool {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--node-color);
}

.activity-description {
  font-size: 0.6875rem;
  opacity: 0.8;
  word-break: break-all;
}

.activity-time {
  font-size: 0.625rem;
  opacity: 0.6;
}

/* Mode Indicator Card */
.mode-indicator-card {
  background: var(--sidebar-card-bg, rgba(var(--node-color-rgb), 0.1));
  border: 1px solid var(--sidebar-card-border, rgba(var(--node-color-rgb), 0.2));
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}

.mode-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mode-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  background: rgba(var(--node-color-rgb), 0.2);
  color: var(--node-color);
}

.mode-icon.mode-default {
  background: rgba(75, 85, 99, 0.2);
  color: #4b5563;
}

.mode-icon.mode-planning {
  background: rgba(139, 92, 246, 0.2);
  color: #8b5cf6;
}

.mode-icon.mode-coding {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.mode-icon.mode-analysis {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.mode-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.mode-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--node-color);
}

.mode-hint {
  font-size: 0.6875rem;
  opacity: 0.6;
  font-style: italic;
}

/* Command History */
.command-history {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-height: 120px;
  overflow-y: auto;
}

.command-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  background: rgba(var(--node-color-rgb), 0.05);
  border: 1px solid rgba(var(--node-color-rgb), 0.1);
  border-radius: 0.375rem;
  transition: all 0.2s ease;
}

.command-item:hover {
  background: rgba(var(--node-color-rgb), 0.1);
  border-color: rgba(var(--node-color-rgb), 0.2);
}

.command-item.success {
  border-left: 3px solid #22c55e;
}

.command-item.error {
  border-left: 3px solid #ef4444;
}

.command-item.pending {
  border-left: 3px solid #f59e0b;
}

.command-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  opacity: 0.8;
}

.command-details {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.command-name {
  font-size: 0.75rem;
  font-weight: 600;
  font-family: monospace;
  color: var(--node-color);
}

.command-time {
  font-size: 0.625rem;
  opacity: 0.6;
}

.command-status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.command-status.success {
  color: #22c55e;
}

.command-status.error {
  color: #ef4444;
}

.command-status.pending {
  color: #f59e0b;
}

/* Scrollbar styling */
.snapped-sidebar::-webkit-scrollbar,
.activity-feed::-webkit-scrollbar {
  width: 4px;
}

.snapped-sidebar::-webkit-scrollbar-track,
.activity-feed::-webkit-scrollbar-track {
  background: transparent;
}

.snapped-sidebar::-webkit-scrollbar-thumb,
.activity-feed::-webkit-scrollbar-thumb {
  background-color: rgba(var(--node-color-rgb), 0.3);
  border-radius: 2px;
}

.snapped-sidebar::-webkit-scrollbar-thumb:hover,
.activity-feed::-webkit-scrollbar-thumb:hover {
  background-color: rgba(var(--node-color-rgb), 0.5);
}
</style>