<template>
  <div class="slash-command-node pointer-events-auto absolute transition-all duration-300" 
       :style="nodePositionStyle"
       :class="['theme-' + currentTheme, commandTypeClass]">
    
    <!-- Connector line to parent -->
    <div class="connector-line" :style="connectorStyle"></div>
    
    <!-- Main command card -->
    <Card class="command-card backdrop-blur-sm border shadow-lg">
      <!-- Header -->
      <div class="command-header p-3 border-b border-base-300/50">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <component :is="commandIcon" class="w-5 h-5" :style="{ color: commandColor }" />
            <span class="font-semibold text-base-content">{{ command }}</span>
          </div>
          <div class="flex items-center gap-2">
            <Badge v-if="executionTime" variant="secondary" class="text-xs">
              {{ executionTime }}ms
            </Badge>
            <button @click="$emit('close')" class="btn btn-xs btn-ghost">×</button>
          </div>
        </div>
      </div>
      
      <!-- Content based on command type -->
      <div class="command-content p-4">
        <!-- Loading State -->
        <div v-if="isLoading" class="loading-display flex items-center justify-center py-8">
          <div class="flex flex-col items-center gap-3">
            <div class="loading loading-spinner loading-md text-primary"></div>
            <span class="text-sm text-base-content/70">Processing {{ command }}...</span>
          </div>
        </div>
        
        <!-- Actual Content (when not loading) -->
        <div v-else>
          <!-- Sessions Command -->
          <div v-if="command === '/sessions'" class="sessions-display">
          <h4 class="text-sm font-medium mb-3 text-base-content/80">Recent Sessions</h4>
          <div v-if="parsedData.sessions && parsedData.sessions.length > 0" class="space-y-2">
            <div v-for="session in parsedData.sessions" :key="session.id" 
                 class="session-item p-3 rounded-lg bg-base-100/50 border border-base-300/30">
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-mono text-sm text-primary">{{ session.id.slice(0, 8) }}...</div>
                  <div class="text-xs text-base-content/60">
                    {{ session.message_count }} messages • ${{ session.total_cost.toFixed(3) }}
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <Badge :variant="session.status === 'active' ? 'default' : 'secondary'" class="text-xs">
                    {{ session.status }}
                  </Badge>
                  <button class="btn btn-xs btn-primary">Resume</button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-6 text-base-content/60">
            <Database class="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No recent sessions found</p>
          </div>
        </div>
        
        <!-- Config Command -->
        <div v-else-if="command === '/config'" class="config-display">
          <h4 class="text-sm font-medium mb-3 text-base-content/80">Configuration Files</h4>
          <div class="space-y-3">
            <div v-for="(section, name) in configSections" :key="name" class="config-section">
              <h5 class="text-xs font-medium text-base-content/70 mb-2 flex items-center gap-1">
                <Folder class="w-3 h-3" />
                {{ name }}
              </h5>
              <div class="grid grid-cols-1 gap-1">
                <div v-for="file in section" :key="file" 
                     class="config-file p-2 rounded bg-base-100/30 text-xs font-mono text-base-content/80 hover:bg-base-100/50 transition-colors">
                  {{ file }}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Tools Command -->
        <div v-else-if="command === '/tools'" class="tools-display">
          <h4 class="text-sm font-medium mb-3 text-base-content/80">Available Tools</h4>
          <div class="grid grid-cols-2 gap-3">
            <div v-for="(tools, category) in toolCategories" :key="category" class="tool-category">
              <h5 class="text-xs font-medium text-base-content/70 mb-2 capitalize">{{ category }} Tools</h5>
              <div class="space-y-1">
                <div v-for="tool in tools" :key="tool" 
                     class="tool-item p-2 rounded bg-base-100/30 text-xs text-base-content/80 hover:bg-primary/10 transition-colors cursor-pointer">
                  {{ tool }}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Help Command -->
        <div v-else-if="command === '/help'" class="help-display">
          <div class="prose prose-sm max-w-none">
            <pre class="text-xs text-base-content/80 whitespace-pre-wrap">{{ parsedData.response || rawData }}</pre>
          </div>
        </div>
        
        <!-- Generic Command (fallback) -->
        <div v-else class="generic-display">
          <div class="text-xs text-base-content/70 mb-2">Response:</div>
          <div class="p-3 rounded bg-base-100/30 text-xs text-base-content/80 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
            {{ parsedData.response || rawData }}
          </div>
        </div>
        
        </div> <!-- End of v-else for actual content -->
      </div>
    </Card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Card } from '@/components/ui/card'
import Badge from '../../ui/Badge.vue'
import { 
  Terminal, Settings, Wrench, HelpCircle, Database, Folder,
  Activity, Code, Search, Edit3, FolderOpen
} from 'lucide-vue-next'
import { useThemeStore } from '../../../stores/themeStore'

const props = defineProps({
  command: String,
  rawData: String,
  position: Object,
  parentPosition: Object,
  executionTime: Number,
  isLoading: Boolean
})

const emit = defineEmits(['close'])

const themeStore = useThemeStore()
const currentTheme = computed(() => themeStore.currentTheme)

// Parse the command response data
const parsedData = computed(() => {
  try {
    // Try to extract meaningful data from the raw response
    if (props.command === '/sessions') {
      // Parse sessions data if it exists
      return { sessions: [] } // Would parse actual session data
    } else if (props.command === '/config') {
      // Parse config data from the response
      return parseConfigResponse(props.rawData)
    } else if (props.command === '/tools') {
      // Parse tools data
      return parseToolsResponse(props.rawData)
    }
    return { response: props.rawData }
  } catch (e) {
    return { response: props.rawData }
  }
})

const parseConfigResponse = (data) => {
  // Extract configuration info from the response
  const sections = {
    'Frontend': [
      'package.json',
      'tsconfig.json', 
      'vite.config.ts',
      'tailwind.config.js'
    ],
    'Backend': [
      'requirements.txt',
      'app.py'
    ]
  }
  return { sections }
}

const parseToolsResponse = (data) => {
  return {
    builtin: ['Read', 'Write', 'Bash', 'Glob', 'Grep', 'Edit', 'MultiEdit', 'LS', 'TodoWrite'],
    mcp: []
  }
}

// Command-specific styling
const commandConfig = computed(() => {
  const configs = {
    '/sessions': { icon: Database, color: '#10b981' },
    '/config': { icon: Settings, color: '#8b5cf6' },
    '/tools': { icon: Wrench, color: '#f59e0b' },
    '/help': { icon: HelpCircle, color: '#06b6d4' },
    '/clear': { icon: Activity, color: '#ef4444' }
  }
  return configs[props.command] || { icon: Terminal, color: '#6b7280' }
})

const commandIcon = computed(() => commandConfig.value.icon)
const commandColor = computed(() => commandConfig.value.color)
const commandTypeClass = computed(() => `command-${props.command.slice(1)}`)

// Parsed sections for config display
const configSections = computed(() => {
  if (props.command === '/config' && parsedData.value.sections) {
    return parsedData.value.sections
  }
  return {}
})

// Tool categories for tools display
const toolCategories = computed(() => {
  if (props.command === '/tools') {
    return {
      builtin: parsedData.value.builtin || [],
      mcp: parsedData.value.mcp || []
    }
  }
  return {}
})

// Position and connector styling
const nodePositionStyle = computed(() => ({
  left: `${props.position.x}px`,
  top: `${props.position.y}px`,
  zIndex: 1000
}))

const connectorStyle = computed(() => {
  if (!props.parentPosition) return {}
  
  const dx = props.parentPosition.x - props.position.x
  const dy = props.parentPosition.y - props.position.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx) * 180 / Math.PI
  
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: `${length}px`,
    height: '2px',
    backgroundColor: commandConfig.value.color,
    transformOrigin: '0 50%',
    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
    opacity: 0.6,
    zIndex: -1
  }
})
</script>

<style scoped>
.slash-command-node {
  min-width: 320px;
  max-width: 480px;
}

.command-card {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.theme-dark .command-card {
  background: rgba(30, 30, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.session-item:hover,
.config-file:hover,
.tool-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.connector-line {
  pointer-events: none;
}

.command-content {
  max-height: 400px;
  overflow-y: auto;
}
</style>