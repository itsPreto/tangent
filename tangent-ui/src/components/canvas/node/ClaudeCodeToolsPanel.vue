<template>
  <div class="claude-code-sdk-panel bg-gradient-to-br from-primary/5 to-secondary/5 backdrop-blur-md rounded-xl p-1 mb-4 border border-primary/20">
    <!-- Header Bar -->
    <div class="flex items-center justify-between p-3 bg-base-100/20 rounded-t-lg">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
        <span class="text-sm font-semibold text-base-content">Claude Code SDK</span>
        <Badge variant="secondary" class="text-xs">{{ toolCount }} tools</Badge>
      </div>
      <div class="flex items-center gap-1">
        <button 
          @click="emit('convert-slash-commands')"
          class="btn btn-xs btn-ghost text-xs hover:bg-secondary/10 text-secondary"
          title="Convert existing slash commands to specialized nodes"
        >
          ↻
        </button>
        <button 
          @click="expanded = !expanded"
          class="btn btn-xs btn-ghost hover:bg-primary/10 transition-colors"
          :class="{ 'rotate-180': expanded }"
        >
          <ChevronDown class="w-4 h-4 transition-transform duration-200" />
        </button>
      </div>
    </div>
    
    <!-- Compact Expandable Content -->
    <div v-if="expanded" class="p-2">
      <!-- All Content in Wrapped Layout -->
      <div class="flex flex-wrap gap-1 items-center">
        
        <!-- Tools -->
        <div class="flex items-center gap-1">
          <Wrench class="w-3 h-3 text-primary/70" />
          <button 
            v-for="tool in quickTools" 
            :key="tool.name"
            @click="insertTool(tool)"
            class="px-1.5 py-0.5 text-xs rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 transition-all duration-200"
            :title="tool.description"
          >
            {{ tool.name }}
          </button>
        </div>
        
        <div class="w-px h-3 bg-base-300/50"></div>
        
        <!-- Commands -->
        <div class="flex items-center gap-1">
          <Terminal class="w-3 h-3 text-secondary/70" />
          <button 
            v-for="cmd in slashCommands" 
            :key="cmd.name"
            @click="handleSlashCommand(cmd)"
            class="px-1.5 py-0.5 text-xs rounded bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 hover:border-secondary/40 transition-all duration-200"
            :title="cmd.description"
          >
            {{ cmd.name }}
          </button>
        </div>
        
        <div class="w-px h-3 bg-base-300/50"></div>
        
        <!-- Files -->
        <div class="flex items-center gap-1">
          <FileText class="w-3 h-3 text-accent/70" />
          <button 
            v-for="file in commonFiles" 
            :key="file.name"
            @click="insertFileRef(file.name)"
            class="px-1.5 py-0.5 text-xs rounded bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 hover:border-accent/40 transition-all duration-200 font-mono"
            :title="`Reference ${file.name}`"
          >
            @{{ file.name }}
          </button>
        </div>
        
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ChevronDown, Wrench, Terminal, FileText, Search, Edit3, File, Folder, Code, Database, Settings, HelpCircle } from 'lucide-vue-next'
import Badge from '../../ui/Badge.vue'

const props = defineProps({
  onInsertText: Function,
  sessionId: String
})

const expanded = ref(false)

const quickTools = [
  { name: 'Glob', icon: Search, description: 'Find files by pattern', template: 'Find all TypeScript files: use Glob with pattern "**/*.ts"' },
  { name: 'Grep', icon: Search, description: 'Search file contents', template: 'Search for "function" in Vue files: use Grep with pattern "function" and glob "*.vue"' },
  { name: 'Edit', icon: Edit3, description: 'Edit files in place', template: 'Edit a file: use Edit to replace "old text" with "new text" in filename.js' },
  { name: 'LS', icon: Folder, description: 'List directory contents', template: 'List directory: use LS to show contents of src/' },
  { name: 'TodoWrite', icon: File, description: 'Manage tasks', template: 'Create a todo list to track the tasks for this project' }
]

const slashCommands = [
  { name: '/help', icon: HelpCircle, description: 'Show available commands' },
  { name: '/tools', icon: Wrench, description: 'List all tools' },
  { name: '/sessions', icon: Database, description: 'Show recent sessions' },
  { name: '/config', icon: Settings, description: 'View/set configuration' },
  { name: '/clear', icon: Terminal, description: 'Clear conversation' }
]

const commonFiles = [
  { name: 'package.json', icon: Code },
  { name: 'README.md', icon: File },
  { name: 'src/', icon: Folder },
  { name: 'tangent-api/', icon: Folder },
  { name: 'tangent-ui/', icon: Folder }
]

const toolCount = computed(() => {
  // Built-in tools + potential MCP tools
  return 9 // Read, Write, Bash, Glob, Grep, Edit, MultiEdit, LS, TodoWrite
})

// Emit event to trigger slash command conversion
const emit = defineEmits(['convert-slash-commands'])

function insertTool(tool) {
  if (props.onInsertText) {
    props.onInsertText(tool.template)
  }
}

function handleSlashCommand(cmd) {
  if (props.onInsertText) {
    props.onInsertText(cmd.name)
  }
}

function insertFileRef(file) {
  if (props.onInsertText) {
    props.onInsertText(`@${file}`)
  }
}
</script>

<style scoped>
.claude-code-tools-panel {
  font-family: system-ui, -apple-system, sans-serif;
}
</style>