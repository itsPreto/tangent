<template>
  <div class="snapped-sidebar" :class="{ 'right-sidebar': !isRightContentPanelOpen, 'left-sidebar-bottom': isRightContentPanelOpen }" v-if="showSidebar" :style="sidebarStyle">
    <!-- Thread Navigation Tree -->
    <div class="sidebar-section">
      <h3 class="section-title">Thread Map</h3>
      <div class="thread-tree">
        <div class="tree-container">
          <svg class="thread-svg" viewBox="0 0 180 120">
            <!-- Branch connections -->
            <g class="branch-connections">
              <path 
                v-for="connection in threadConnections" 
                :key="connection.id"
                :d="connection.path" 
                fill="none" 
                stroke="var(--node-border-color)" 
                stroke-width="1"
                opacity="0.6"
              />
            </g>
            <!-- Thread nodes -->
            <g class="thread-nodes">
              <circle 
                v-for="node in threadNodes" 
                :key="node.id"
                :cx="node.x" 
                :cy="node.y" 
                :r="node.isCurrentNode ? 4 : 3"
                :fill="node.isCurrentNode ? 'var(--node-color)' : 'var(--node-border-color)'"
                :class="{ 'current-thread-node': node.isCurrentNode, 'clickable-thread-node': !node.isCurrentNode }"
                @click="navigateToNode(node.id)"
              />
            </g>
          </svg>
        </div>
      </div>
    </div>

    <!-- Context Awareness Panel -->
    <div class="sidebar-section">
      <h3 class="section-title">Context</h3>
      
      <!-- Active Tools (Claude Code only) -->
      <div v-if="isClaudeCodeSession" class="context-card">
        <div class="context-header">
          <span class="context-label">Active Tools</span>
        </div>
        <div class="tool-tags">
          <span 
            v-for="tool in activeTools" 
            :key="tool"
            class="tool-tag"
            :class="`tool-${tool.toLowerCase()}`"
          >
            {{ tool }}
          </span>
        </div>
      </div>

      <!-- Memory State -->
      <div class="context-card">
        <div class="context-header">
          <span class="context-label">Key Context</span>
        </div>
        <div class="memory-items">
          <div 
            v-for="item in memoryItems" 
            :key="item.id"
            class="memory-item"
          >
            <div class="memory-icon" :class="item.type">
              <component :is="getMemoryIcon(item.type)" class="w-3 h-3" />
            </div>
            <span class="memory-text">{{ item.text }}</span>
          </div>
        </div>
      </div>

      <!-- File References (Claude Code only) -->
      <div v-if="isClaudeCodeSession && fileReferences.length > 0" class="context-card">
        <div class="context-header">
          <span class="context-label">File References</span>
        </div>
        <div class="file-list">
          <div 
            v-for="file in fileReferences" 
            :key="file.path"
            class="file-item"
            @click="openFile(file.path)"
          >
            <div class="file-icon">
              <component :is="getFileIcon(file.extension)" class="w-3 h-3" />
            </div>
            <span class="file-name">{{ file.name }}</span>
            <span class="file-line" v-if="file.line">:{{ file.line }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Smart Suggestions -->
    <div class="sidebar-section">
      <h3 class="section-title">Quick Actions</h3>
      
      <div class="action-buttons">
        <button 
          v-for="action in contextualActions" 
          :key="action.id"
          class="action-button"
          :class="action.type"
          @click="executeAction(action)"
        >
          <component :is="action.icon" class="w-4 h-4" />
          <span>{{ action.label }}</span>
        </button>
      </div>
    </div>

    <!-- Related Branches -->
    <div class="sidebar-section" v-if="relatedBranches.length > 0">
      <h3 class="section-title">Similar Threads</h3>
      
      <div class="related-list">
        <div 
          v-for="branch in relatedBranches" 
          :key="branch.id"
          class="related-item"
          @click="navigateToBranch(branch.id)"
        >
          <div class="related-preview">
            <span class="related-title">{{ branch.title }}</span>
            <span class="related-similarity">{{ branch.similarity }}% similar</span>
          </div>
          <div class="related-meta">
            <span class="related-time">{{ formatRelativeTime(branch.timestamp) }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Reflection Detail Inline Section -->
    <div v-if="selectedReflection" class="sidebar-section">
      <div class="section-header">
        <h3 class="section-title">Learning Insight</h3>
        <button @click="selectedReflection = null" class="close-insight-btn">
          <X class="w-4 h-4" />
        </button>
      </div>
      
      <div class="reflection-detail-content">
        <!-- Complexity Badge -->
        <div class="reflection-header">
          <div class="flex items-center gap-2">
            <Lightbulb class="w-4 h-4 text-amber-500" />
            <Badge 
              :variant="getComplexityVariant(selectedReflection.complexity)"
              class="complexity-badge"
            >
              {{ selectedReflection.complexity }} complexity
            </Badge>
          </div>
        </div>
        
        <!-- Problem Statement -->
        <div class="reflection-section">
          <h4 class="reflection-section-title">
            <AlertCircle class="w-3 h-3" />
            Problem
          </h4>
          <p class="reflection-section-content">{{ selectedReflection.problem_statement }}</p>
        </div>
        
        <!-- Technical Challenge -->
        <div class="reflection-section">
          <h4 class="reflection-section-title">
            <Code class="w-3 h-3" />
            Technical Challenge
          </h4>
          <p class="reflection-section-content">{{ selectedReflection.technical_challenge }}</p>
        </div>
        
        <!-- Solution Breakthrough -->
        <div class="reflection-section highlight">
          <h4 class="reflection-section-title">
            <Zap class="w-3 h-3" />
            Solution Breakthrough
          </h4>
          <p class="reflection-section-content">{{ selectedReflection.solution_breakthrough }}</p>
        </div>
        
        <!-- Key Insights -->
        <div v-if="selectedReflection.key_insights?.length" class="reflection-section">
          <h4 class="reflection-section-title">
            <Brain class="w-3 h-3" />
            Key Insights
          </h4>
          <ul class="insights-list">
            <li v-for="insight in selectedReflection.key_insights" :key="insight" class="insight-item">
              <CheckCircle class="w-2 h-2 text-green-500 mt-0.5 flex-shrink-0" />
              <span class="text-xs">{{ insight }}</span>
            </li>
          </ul>
        </div>
        
        <!-- Technologies & Metadata -->
        <div class="reflection-metadata">
          <!-- Technologies -->
          <div v-if="selectedReflection.technologies?.length" class="metadata-group">
            <h5 class="metadata-title">Technologies</h5>
            <div class="tag-list">
              <Badge 
                v-for="tech in selectedReflection.technologies" 
                :key="tech"
                variant="secondary"
                class="tech-tag"
              >
                {{ tech }}
              </Badge>
            </div>
          </div>
          
          <!-- Keywords -->
          <div v-if="selectedReflection.keywords?.length" class="metadata-group">
            <h5 class="metadata-title">Keywords</h5>
            <div class="tag-list">
              <Badge 
                v-for="keyword in selectedReflection.keywords.slice(0, 5)" 
                :key="keyword"
                variant="outline"
                class="keyword-tag"
              >
                {{ keyword }}
              </Badge>
            </div>
          </div>
        </div>
        
        <!-- Feedback Buttons -->
        <div class="reflection-actions">
          <button 
            @click="handleReflectionFeedback(true)" 
            class="feedback-btn helpful"
            :class="{ active: localFeedback === 'helpful' }"
          >
            <ThumbsUp class="w-3 h-3" />
            Helpful
          </button>
          <button 
            @click="handleReflectionFeedback(false)" 
            class="feedback-btn not-helpful"
            :class="{ active: localFeedback === 'not-helpful' }"
          >
            <ThumbsDown class="w-3 h-3" />
            Not Helpful
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { 
  DocumentTextIcon,
  CodeBracketIcon,
  FolderIcon,
  ChatBubbleLeftIcon,
  LightBulbIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  ShareIcon,
  CpuChipIcon,
  BoltIcon
} from '@heroicons/vue/24/outline'
import { 
  X, Lightbulb, AlertCircle, Code, Zap, Brain, CheckCircle, 
  XCircle, ThumbsUp, ThumbsDown 
} from 'lucide-vue-next'
import { useSnappedNodeLayout } from '@/composables/useSnappedNodeLayout'
import { useCanvasStore } from '@/stores/canvasStore'
import { useToolCallStore } from '@/stores/toolCallStore'
import { useAppStore } from '@/stores/appStore'
import Badge from '@/components/ui/Badge.vue'
import type { Node } from '@/types/message'

interface ThreadNode {
  id: string
  x: number
  y: number
  isCurrentNode: boolean
  title: string
}

interface ThreadConnection {
  id: string
  path: string
}

interface MemoryItem {
  id: string
  type: 'code' | 'concept' | 'file' | 'task'
  text: string
}

interface FileReference {
  path: string
  name: string
  line?: number
  extension: string
}

interface ContextualAction {
  id: string
  label: string
  type: string
  icon: any
  action: () => void
}

interface RelatedBranch {
  id: string
  title: string
  similarity: number
  timestamp: number
}

interface Props {
  nodeId: string
  sessionType?: 'chat' | 'claude-code'
  currentThreadPath?: string[]
  windowDimensions?: { width: number; height: number }
  isRightContentPanelOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  sessionType: 'chat',
  currentThreadPath: () => [],
  windowDimensions: () => ({ width: window.innerWidth, height: window.innerHeight }),
  isRightContentPanelOpen: false
})

// Store instances
const canvasStore = useCanvasStore()
const toolCallStore = useToolCallStore()
const appStore = useAppStore()

// Get current node data
const currentNode = computed(() => {
  return canvasStore.nodes.find(node => node.id === props.nodeId)
})

// Real session type detection
const isClaudeCodeSession = computed(() => {
  if (!currentNode.value) return false
  
  // Check node type
  if (currentNode.value.type === 'claude-code') return true
  
  // Check metadata flag
  if (currentNode.value.metadata?.isClaudeCode) return true
  
  // Check for Claude Code instances associated with this node
  const activeInstances = toolCallStore.getActiveInstances
  return activeInstances.some(instance => 
    instance.nodeId === props.nodeId || 
    instance.chatId === currentNode.value?.chatId
  )
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

// Reflection inline state
const selectedReflection = ref<any>(null)

// Use responsive layout composable  
const { rightSidebarStyle: responsiveStyle, layoutStrategy } = useSnappedNodeLayout()

// Real thread navigation data from canvasStore
const threadNodes = computed<ThreadNode[]>(() => {
  try {
    if (!currentNode.value?.chatId) return []
    
    // Get all nodes from the same chat
    const allNodes = canvasStore.nodes || []
    const chatNodes = allNodes.filter(node => node.chatId === currentNode.value?.chatId)
    
    // Convert to thread nodes with SVG coordinates (scale down positions)
    return chatNodes.map((node, index) => ({
      id: node.id,
      x: Math.min(Math.max((node.x || 0) / 10, 20), 160), // Scale and clamp to SVG bounds
      y: Math.min(Math.max((node.y || 0) / 10, 20), 100),
      isCurrentNode: node.id === props.nodeId,
      title: node.title || `Thread ${index + 1}`
    }))
  } catch (error) {
    console.error('Error computing thread nodes:', error)
    return []
  }
})

const threadConnections = computed<ThreadConnection[]>(() => {
  try {
    if (!currentNode.value?.chatId) return []
    
    const allConnections = canvasStore.connections || []
    const allNodes = canvasStore.nodes || []
    
    const connections = allConnections.filter(conn => {
      const sourceNode = allNodes.find(n => n.id === conn.sourceNodeId)
      const targetNode = allNodes.find(n => n.id === conn.targetNodeId)
      return sourceNode?.chatId === currentNode.value?.chatId && 
             targetNode?.chatId === currentNode.value?.chatId
    })
    
    return connections.map(conn => {
      const sourceThread = threadNodes.value.find(t => t.id === conn.sourceNodeId)
      const targetThread = threadNodes.value.find(t => t.id === conn.targetNodeId)
      
      if (sourceThread && targetThread) {
        return {
          id: conn.id,
          path: `M${sourceThread.x},${sourceThread.y} L${targetThread.x},${targetThread.y}`
        }
      }
      return { id: conn.id, path: '' }
    }).filter(conn => conn.path !== '')
  } catch (error) {
    console.error('Error computing thread connections:', error)
    return []
  }
})

// Real active tools data
const activeTools = computed(() => {
  if (!isClaudeCodeSession.value) return []
  
  // Get Claude Code instances for this node
  const allInstances = toolCallStore.getActiveInstances || []
  const instances = allInstances.filter(instance => 
    instance.nodeId === props.nodeId || 
    instance.chatId === currentNode.value?.chatId
  )
  
  if (instances.length === 0) return []
  
  // Extract tools from instances
  const tools = new Set<string>()
  instances.forEach(instance => {
    if (instance.allowed_tools && Array.isArray(instance.allowed_tools)) {
      instance.allowed_tools.forEach(tool => tools.add(tool))
    }
  })
  
  return Array.from(tools)
})

// Adaptive memory items based on session type
const memoryItems = computed<MemoryItem[]>(() => {
  if (!currentNode.value) return []
  
  const items: MemoryItem[] = []
  
  if (isClaudeCodeSession.value) {
    // Claude Code specific context
    const allInstances = toolCallStore.getActiveInstances || []
    const instances = allInstances.filter(instance => 
      instance.nodeId === props.nodeId || instance.chatId === currentNode.value?.chatId
    )
    
    instances.forEach(instance => {
      if (instance.working_directory) {
        items.push({
          id: `dir-${instance.id}`,
          type: 'file',
          text: `Working in: ${instance.working_directory}`
        })
      }
      
      if (instance.cost && instance.cost > 0) {
        items.push({
          id: `cost-${instance.id}`,
          type: 'task',
          text: `Session cost: $${instance.cost.toFixed(4)}`
        })
      }
    })
    
    // Add recent tool calls as context
    const toolCalls = toolCallStore.getToolCallsForNode(props.nodeId) || []
    const recentToolCalls = toolCalls.slice(-3)
    
    recentToolCalls.forEach((call, index) => {
      if (call && call.id) {
        items.push({
          id: `tool-${call.id}`,
          type: 'code',
          text: `${call.tool_name || 'Unknown'}: ${JSON.stringify(call.parameters || {}).slice(0, 50)}...`
        })
      }
    })
  } else {
    // Regular chat context - extract from messages
    const messages = currentNode.value.messages || []
    const recentMessages = messages.slice(-5)
    
    // Extract key concepts from messages
    recentMessages.forEach((message, index) => {
      if (message.role === 'user' && message.content) {
        const text = typeof message.content === 'string' 
          ? message.content 
          : message.content.map(c => c.text || '').join(' ')
        
        if (text.length > 20) {
          items.push({
            id: `concept-${index}`,
            type: 'concept',
            text: text.slice(0, 60) + (text.length > 60 ? '...' : '')
          })
        }
      }
    })
    
    // Add model info
    if (currentNode.value.metadata?.model) {
      items.push({
        id: 'model-info',
        type: 'task',
        text: `Model: ${currentNode.value.metadata.model}`
      })
    }
  }
  
  return items.slice(0, 6) // Limit to 6 items for display
})

// Real file references for Claude Code sessions
const fileReferences = computed((): FileReference[] => {
  if (!isClaudeCodeSession.value) return []
  
  const files: FileReference[] = []
  
  // Get file nodes from tool calls
  const fileNodes = toolCallStore.getFileNodesForNode(props.nodeId)
  
  fileNodes.forEach(fileNode => {
    const pathParts = fileNode.filePath.split('/')
    const fileName = pathParts[pathParts.length - 1]
    const extension = fileName.split('.').pop() || ''
    
    files.push({
      path: fileNode.filePath,
      name: fileName,
      line: fileNode.line,
      extension: extension
    })
  })
  
  // Get recent file operations from tool calls
  const recentToolCalls = toolCallStore.getToolCallsForNode(props.nodeId)
    .filter(call => ['Read', 'Write', 'Edit'].includes(call.tool_name))
    .slice(-5)
  
  recentToolCalls.forEach(call => {
    try {
      const args = call.parameters
      
      if (args.file_path) {
        const pathParts = args.file_path.split('/')
        const fileName = pathParts[pathParts.length - 1]
        const extension = fileName.split('.').pop() || ''
        
        // Avoid duplicates
        if (!files.find(f => f.path === args.file_path)) {
          files.push({
            path: args.file_path,
            name: fileName,
            extension: extension
          })
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  })
  
  return files.slice(0, 10) // Limit display
})

// Session-specific contextual actions
const contextualActions = computed((): ContextualAction[] => {
  const actions: ContextualAction[] = []

  if (isClaudeCodeSession.value) {
    // Claude Code specific actions
    const allInstances = toolCallStore.getActiveInstances || []
    const instances = allInstances.filter(instance => 
      instance.nodeId === props.nodeId || instance.chatId === currentNode.value?.chatId
    )
    
    if (instances.length > 0) {
      actions.push(
        {
          id: 'run-tests',
          label: 'Run Tests',
          type: 'test',
          icon: BoltIcon,
          action: () => {
            // Execute test command through active instance
            // TODO: Implement command execution through Claude Code instance
            console.log('npm test') // Example
          }
        },
        {
          id: 'commit',
          label: 'Commit Changes',
          type: 'git',
          icon: ArrowPathIcon,
          action: () => {
            // Execute git commit
            // TODO: Implement command execution through Claude Code instance
            console.log('git add . && git commit -m "Updates from Claude"')
          }
        }
      )
    }
    
    // File operations
    actions.push({
      id: 'create-file',
      label: 'Create File',
      type: 'file',
      icon: DocumentTextIcon,
      action: () => {
        // Trigger file creation dialog or action
        console.log('Create new file')
      }
    })
  } else {
    // Regular chat actions
    actions.push(
      {
        id: 'export-chat',
        label: 'Export Chat',
        type: 'export',
        icon: ShareIcon,
        action: () => {
          // Export chat functionality
          console.log('Export chat', currentNode.value?.chatId)
        }
      },
      {
        id: 'summarize',
        label: 'Summarize',
        type: 'ai',
        icon: LightBulbIcon,
        action: () => {
          // Generate summary of conversation
          console.log('Generate summary')
        }
      }
    )
  }

  // Common actions for all session types
  actions.push(
    {
      id: 'copy',
      label: 'Copy Thread',
      type: 'copy',
      icon: DocumentDuplicateIcon,
      action: () => {
        // Copy thread content to clipboard
        const content = currentNode.value?.messages?.map(m => 
          `${m.role}: ${typeof m.content === 'string' ? m.content : 'complex content'}`
        ).join('\n\n') || ''
        
        navigator.clipboard.writeText(content)
      }
    }
  )

  return actions
})

// Real related branches based on content similarity
const relatedBranches = computed<RelatedBranch[]>(() => {
  if (!currentNode.value) return []
  
  const currentChatId = currentNode.value.chatId
  const branches: RelatedBranch[] = []
  
  // Get all other nodes to compare with
  const otherNodes = canvasStore.nodes.filter(node => 
    node.chatId !== currentChatId && 
    node.messages && 
    node.messages.length > 0
  )
  
  // Simple similarity calculation based on shared keywords
  const getCurrentNodeText = () => {
    return currentNode.value?.messages?.map(m => 
      typeof m.content === 'string' ? m.content : 
      Array.isArray(m.content) ? m.content.map(c => c.text || '').join(' ') : ''
    ).join(' ').toLowerCase() || ''
  }
  
  const currentText = getCurrentNodeText()
  const currentWords = new Set(currentText.split(/\s+/).filter(word => word.length > 3))
  
  otherNodes.forEach(node => {
    const nodeText = node.messages?.map(m => 
      typeof m.content === 'string' ? m.content : 
      Array.isArray(m.content) ? m.content.map(c => c.text || '').join(' ') : ''
    ).join(' ').toLowerCase() || ''
    
    const nodeWords = new Set(nodeText.split(/\s+/).filter(word => word.length > 3))
    
    // Calculate Jaccard similarity
    const intersection = new Set([...currentWords].filter(word => nodeWords.has(word)))
    const union = new Set([...currentWords, ...nodeWords])
    const similarity = union.size > 0 ? (intersection.size / union.size) * 100 : 0
    
    if (similarity > 20) { // Only show if similarity > 20%
      branches.push({
        id: node.id,
        title: node.title || 'Untitled Thread',
        similarity: Math.round(similarity),
        timestamp: node.createdAt ? new Date(node.createdAt).getTime() : Date.now()
      })
    }
  })
  
  // Sort by similarity descending, then by recency
  return branches
    .sort((a, b) => {
      if (Math.abs(a.similarity - b.similarity) < 5) {
        return b.timestamp - a.timestamp // More recent first if similarity is close
      }
      return b.similarity - a.similarity // Higher similarity first
    })
    .slice(0, 5) // Limit to 5 most relevant
})

const getMemoryIcon = (type: string) => {
  const iconMap: Record<string, any> = {
    'code': CodeBracketIcon,
    'concept': LightBulbIcon,
    'file': DocumentTextIcon,
    'task': CpuChipIcon
  }
  return iconMap[type] || ChatBubbleLeftIcon
}

const getFileIcon = (extension: string) => {
  const iconMap: Record<string, any> = {
    'vue': CodeBracketIcon,
    'ts': CodeBracketIcon,
    'js': CodeBracketIcon,
    'md': DocumentTextIcon,
    'json': DocumentTextIcon
  }
  return iconMap[extension] || FolderIcon
}

const formatRelativeTime = (timestamp: number) => {
  const now = Date.now()
  const diff = now - timestamp
  
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// Real navigation functions using store methods
const navigateToNode = (nodeId: string) => {
  // Snap to the selected node
  canvasStore.snapNode(nodeId)
}

const navigateToBranch = (branchId: string) => {
  // Navigate to a related branch (different chat)
  const targetNode = canvasStore.nodes.find(node => node.id === branchId)
  if (targetNode) {
    canvasStore.snapNode(branchId)
    
    // If it's from a different chat, we might need to load that chat
    if (targetNode.chatId !== currentNode.value?.chatId) {
      // This could trigger a chat switch if needed
      console.log('Switching to chat:', targetNode.chatId)
    }
  }
}

const openFile = (filePath: string) => {
  if (isClaudeCodeSession.value) {
    // For Claude Code sessions, we can trigger file opening through tool calls
    const instances = toolCallStore.getActiveInstances.filter(instance => 
      instance.nodeId === props.nodeId || instance.chatId === currentNode.value?.chatId
    )
    
    if (instances.length > 0) {
      // Execute a Read tool call to open/view the file
      console.log('Opening file via Claude Code:', filePath)
      // This would typically trigger a tool call to read the file
    }
  } else {
    console.log('File opening not available for regular chat sessions')
  }
}

const executeAction = (action: ContextualAction) => {
  action.action()
}

// Reflection handlers
const localFeedback = ref<'helpful' | 'not-helpful' | null>(null)

const handleReflectionSuggestionClick = (suggestion: any) => {
  selectedReflection.value = suggestion
  localFeedback.value = null // Reset feedback state
}

const handleReflectionFeedback = async (helpful: boolean) => {
  if (!selectedReflection.value) return
  
  try {
    const response = await fetch(`http://127.0.0.1:5050/api/reflections/${selectedReflection.value.id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helpful })
    })
    
    if (response.ok) {
      localFeedback.value = helpful ? 'helpful' : 'not-helpful'
      console.log('Reflection feedback submitted:', helpful)
    }
  } catch (error) {
    console.error('Failed to submit reflection feedback:', error)
  }
}

const getComplexityVariant = (complexity: string) => {
  switch (complexity) {
    case 'low': return 'outline'
    case 'medium': return 'secondary'
    case 'high': return 'destructive'
    case 'expert': return 'default'
    default: return 'outline'
  }
}

// Expose methods for parent components to show reflection details
defineExpose({
  showReflectionDetails: handleReflectionSuggestionClick
})

// Real-time data watchers for store changes
watch(
  () => canvasStore.nodes.length,
  () => {
    // Reactively update when nodes change
    console.log('Nodes updated, sidebar will re-render')
  }
)

watch(
  () => toolCallStore.getActiveInstances.length,
  () => {
    // Update when Claude Code instances change
    console.log('Claude Code instances updated')
  }
)

watch(
  () => props.nodeId,
  async (newNodeId) => {
    // When switching nodes, ensure data is fresh
    if (newNodeId && isClaudeCodeSession.value) {
      // Refresh Claude Code data for the new node
      await toolCallStore.fetchClaudeCodeInstances()
      await toolCallStore.fetchToolCallsForNode(newNodeId)
    }
  }
)

// Initialize data on mount
onMounted(async () => {
  // Register reflection handler for communication with InfiniteCanvas
  window.__reflectionSidebarHandler = handleReflectionSuggestionClick;
  
  // Ensure we have fresh data when the sidebar mounts
  if (isClaudeCodeSession.value) {
    // Fetch Claude Code instances
    await toolCallStore.fetchClaudeCodeInstances()
    
    // Fetch tool calls for this node
    if (props.nodeId) {
      await toolCallStore.fetchToolCallsForNode(props.nodeId)
    }
  }
})

// Clean up reflection handler on unmount
onBeforeUnmount(() => {
  if (window.__reflectionSidebarHandler === handleReflectionSuggestionClick) {
    delete window.__reflectionSidebarHandler;
  }
})
</script>

<style scoped>
.snapped-sidebar {
  position: fixed;
  top: 20px;
  width: 240px;
  /* height set dynamically via :style binding */
  /* background: var(--sidebar-bg-color, rgba(var(--b1), 0.8)); */
  backdrop-filter: blur(16px);
  border: 1px solid var(--sidebar-border-color, var(--node-border-color));
  border-radius: 1rem;
  padding: 1rem;
  overflow-y: auto;
  z-index: 40;
  color: var(--node-text-color);
}

.right-sidebar {
  right: 20px;
}

.left-sidebar-bottom {
  left: 20px;
  bottom: 20px;
  top: auto;
  right: auto;
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

.thread-tree {
  background: var(--sidebar-card-bg, rgba(var(--node-color-rgb), 0.05));
  border: 1px solid var(--sidebar-card-border, rgba(var(--node-color-rgb), 0.1));
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.tree-container {
  height: 80px;
}

.thread-svg {
  width: 100%;
  height: 100%;
}

.current-thread-node {
  filter: drop-shadow(0 0 6px var(--node-color));
}

.clickable-thread-node {
  cursor: pointer;
  transition: all 0.2s ease;
}

.clickable-thread-node:hover {
  r: 4;
  filter: drop-shadow(0 0 4px var(--node-color));
}

.context-card {
  background: var(--sidebar-card-bg, rgba(var(--node-color-rgb), 0.05));
  border: 1px solid var(--sidebar-card-border, rgba(var(--node-color-rgb), 0.1));
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
}

.context-header {
  margin-bottom: 0.5rem;
}

.context-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--node-color);
}

.tool-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.tool-tag {
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background: rgba(var(--node-color-rgb), 0.2);
  color: var(--node-color);
}

.memory-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.memory-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.memory-icon {
  width: 20px;
  height: 20px;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.memory-icon.code {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.memory-icon.concept {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.memory-icon.file {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.memory-icon.task {
  background: rgba(168, 85, 247, 0.2);
  color: #a855f7;
}

.memory-text {
  font-size: 0.75rem;
  opacity: 0.9;
  line-height: 1.3;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.file-item:hover {
  background: rgba(var(--node-color-rgb), 0.1);
}

.file-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--node-color);
}

.file-name {
  font-size: 0.6875rem;
  font-weight: 500;
}

.file-line {
  font-size: 0.6875rem;
  opacity: 0.6;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(var(--node-color-rgb), 0.2);
  border-radius: 0.375rem;
  background: var(--sidebar-card-bg, rgba(var(--node-color-rgb), 0.05));
  color: var(--node-text-color);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  background: rgba(var(--node-color-rgb), 0.1);
  border-color: rgba(var(--node-color-rgb), 0.3);
}

.action-button.test {
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.3);
}

.action-button.git {
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.3);
}

.action-button.copy {
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.3);
}

.action-button.share {
  color: #8b5cf6;
  border-color: rgba(139, 92, 246, 0.3);
}

.related-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.related-item {
  padding: 0.5rem;
  border-radius: 0.375rem;
  background: var(--sidebar-card-bg, rgba(var(--node-color-rgb), 0.05));
  border: 1px solid var(--sidebar-card-border, rgba(var(--node-color-rgb), 0.1));
  cursor: pointer;
  transition: all 0.2s ease;
}

.related-item:hover {
  background: rgba(var(--node-color-rgb), 0.1);
  border-color: rgba(var(--node-color-rgb), 0.2);
}

.related-preview {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin-bottom: 0.25rem;
}

.related-title {
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.3;
}

.related-similarity {
  font-size: 0.625rem;
  color: var(--node-color);
  opacity: 0.8;
}

.related-meta {
  display: flex;
  justify-content: flex-end;
}

.related-time {
  font-size: 0.625rem;
  opacity: 0.6;
}

/* Scrollbar styling */
.snapped-sidebar::-webkit-scrollbar {
  width: 4px;
}

.snapped-sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.snapped-sidebar::-webkit-scrollbar-thumb {
  background-color: rgba(var(--node-color-rgb), 0.3);
  border-radius: 2px;
}

.snapped-sidebar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(var(--node-color-rgb), 0.5);
}

/* Reflection Detail Inline Styles */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.close-insight-btn {
  padding: 0.25rem;
  border-radius: 0.25rem;
  background: transparent;
  border: none;
  color: var(--node-color);
  opacity: 0.7;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.close-insight-btn:hover {
  opacity: 1;
}

.reflection-detail-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.reflection-header {
  margin-bottom: 0.5rem;
}

.complexity-badge {
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  text-transform: capitalize;
}

.reflection-section {
  padding: 0.5rem;
  border-radius: 0.375rem;
  background: var(--sidebar-card-bg, rgba(var(--node-color-rgb), 0.03));
  border: 1px solid var(--sidebar-card-border, rgba(var(--node-color-rgb), 0.08));
}

.reflection-section.highlight {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.2);
}

.reflection-section-title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--node-color);
  margin-bottom: 0.375rem;
}

.reflection-section-content {
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--node-text-color);
  opacity: 0.9;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: var(--node-text-color);
  opacity: 0.9;
}

.reflection-metadata {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--sidebar-card-bg, rgba(var(--node-color-rgb), 0.02));
  border-radius: 0.375rem;
  border: 1px solid var(--sidebar-card-border, rgba(var(--node-color-rgb), 0.05));
}

.metadata-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metadata-title {
  font-size: 0.625rem;
  font-weight: 500;
  color: var(--node-color);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.tech-tag,
.keyword-tag {
  font-size: 0.625rem;
  padding: 0.125rem 0.25rem;
}

.reflection-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--sidebar-card-border, rgba(var(--node-color-rgb), 0.1));
}

.feedback-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid rgba(var(--node-color-rgb), 0.2);
  border-radius: 0.25rem;
  background: var(--sidebar-card-bg, rgba(var(--node-color-rgb), 0.03));
  color: var(--node-text-color);
  font-size: 0.6875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.feedback-btn:hover {
  background: rgba(var(--node-color-rgb), 0.08);
  border-color: rgba(var(--node-color-rgb), 0.25);
}

.feedback-btn.helpful:hover,
.feedback-btn.helpful.active {
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.1);
}

.feedback-btn.not-helpful:hover,
.feedback-btn.not-helpful.active {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.1);
}
</style>