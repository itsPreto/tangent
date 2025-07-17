<template>
  <div class="claude-code-streaming">
    <!-- Streaming Status Indicator -->
    <div class="streaming-status" :class="{ active: isConnected }">
      <div class="status-indicator" :class="statusClass">
        <div class="pulse-dot" v-if="isConnected"></div>
      </div>
      <span class="status-text">{{ statusText }}</span>
    </div>

    <!-- Real-time Message Feed -->
    <div class="message-feed" v-if="showFeed">
      <div class="feed-header">
        <h4>Claude Code Live Feed</h4>
        <div class="feed-controls">
          <button @click="toggleAutoScroll" :class="{ active: autoScroll }" class="control-btn">
            <ArrowDown :size="16" />
          </button>
          <button @click="clearFeed" class="control-btn">
            <Trash2 :size="16" />
          </button>
          <button @click="showFeed = false" class="control-btn">
            <X :size="16" />
          </button>
        </div>
      </div>
      
      <div class="feed-content" ref="feedContent">
        <div 
          v-for="message in messages" 
          :key="message.id"
          class="message-item"
          :class="message.type"
        >
          <div class="message-header">
            <span class="instance-id">{{ message.instanceId.substring(0, 8) }}</span>
            <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
            <span class="event-type">{{ message.eventType }}</span>
          </div>
          <div class="message-content">
            <component :is="getMessageComponent(message)" :message="message" />
          </div>
        </div>
      </div>
      
      <div class="feed-footer">
        <div class="message-count">{{ messages.length }} messages</div>
        <div class="connection-status">
          <span :class="{ connected: isConnected }">{{ connectionStatus }}</span>
        </div>
      </div>
    </div>

    <!-- Floating Action Button -->
    <button 
      v-if="!showFeed && hasMessages"
      @click="showFeed = true"
      class="floating-btn"
      :class="{ pulse: hasNewMessages }"
    >
      <MessageSquare :size="20" />
      <span class="badge" v-if="unreadCount > 0">{{ unreadCount }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { 
  MessageSquare, 
  ArrowDown, 
  Trash2, 
  X, 
  Wifi, 
  WifiOff 
} from 'lucide-vue-next'
import ToolCallMessage from './streaming/ToolCallMessage.vue'
import SystemMessage from './streaming/SystemMessage.vue'
import AssistantMessage from './streaming/AssistantMessage.vue'
import ErrorMessage from './streaming/ErrorMessage.vue'
import RawMessage from './streaming/RawMessage.vue'
import { ClaudeCodeMessageParser, type ParsedStreamingMessage } from '../../utils/ClaudeCodeMessageParser'

interface StreamingMessage {
  id: string
  instanceId: string
  eventType: string
  data: any
  timestamp: Date
  type: 'system' | 'assistant' | 'tool_call' | 'raw_output' | 'error'
  read: boolean
  parsedMessage?: ParsedStreamingMessage
}

interface Props {
  instances: string[]
  autoConnect?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoConnect: true
})

const emit = defineEmits<{
  message: [message: StreamingMessage]
  connected: [instanceId: string]
  disconnected: [instanceId: string]
  error: [error: Error]
}>()

// State
const isConnected = ref(false)
const showFeed = ref(false)
const autoScroll = ref(true)
const messages = ref<StreamingMessage[]>([])
const unreadCount = ref(0)
const hasNewMessages = ref(false)
const feedContent = ref<HTMLElement>()
const websocket = ref<WebSocket | null>(null)
const reconnectAttempts = ref(0)
const maxReconnectAttempts = 5
const messageParser = new ClaudeCodeMessageParser()

// Computed
const statusClass = computed(() => ({
  'status-connected': isConnected.value,
  'status-disconnected': !isConnected.value,
  'status-error': reconnectAttempts.value > 0
}))

const statusText = computed(() => {
  if (isConnected.value) return 'Connected'
  if (reconnectAttempts.value > 0) return 'Reconnecting...'
  return 'Disconnected'
})

const connectionStatus = computed(() => {
  if (isConnected.value) return 'Connected to Claude Code'
  return 'Disconnected'
})

const hasMessages = computed(() => messages.value.length > 0)

// Methods
function connect() {
  // For now, we'll implement a simple connection status
  // The actual streaming is handled by individual components
  // This component acts as a monitoring overlay
  isConnected.value = true
  reconnectAttempts.value = 0
}

function connectToStream(message: string, sessionId?: string, nodeId?: string) {
  const url = `http://127.0.0.1:5050/api/claude-code/send-message?message=${encodeURIComponent(message)}&session_id=${sessionId || ''}&node_id=${nodeId || ''}`
  
  const eventSource = new EventSource(url)
  
  eventSource.onopen = () => {
    isConnected.value = true
    reconnectAttempts.value = 0
  }
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      handleMessage(data)
    } catch (error) {
      console.error('Error parsing SSE message:', error)
      // Handle raw message
      handleMessage({
        type: 'raw_output',
        content: event.data
      })
    }
  }
  
  eventSource.onerror = (error) => {
    console.error('SSE error:', error)
    isConnected.value = false
    eventSource.close()
    
    // Attempt to reconnect
    if (reconnectAttempts.value < maxReconnectAttempts) {
      reconnectAttempts.value++
      setTimeout(() => connectToStream(message, sessionId, nodeId), 2000 * reconnectAttempts.value)
    }
  }
  
  return eventSource
}

function disconnect() {
  isConnected.value = false
}

function handleMessage(data: any) {
  // Parse the message using Claude Code SDK parser
  const parsedMessage = messageParser.parseMessage(JSON.stringify(data))
  
  if (!parsedMessage) {
    console.warn('Failed to parse message:', data)
    return
  }
  
  const message: StreamingMessage = {
    id: parsedMessage.id,
    instanceId: data.instance_id || 'unknown',
    eventType: parsedMessage.message.type,
    data: parsedMessage.message,
    timestamp: parsedMessage.timestamp,
    type: getMessageType(parsedMessage.message.type),
    read: false,
    parsedMessage
  }
  
  messages.value.push(message)
  
  // Keep only last 1000 messages
  if (messages.value.length > 1000) {
    messages.value = messages.value.slice(-1000)
  }
  
  // Update unread count
  if (!showFeed.value) {
    unreadCount.value++
    hasNewMessages.value = true
    
    // Auto-show feed for important messages
    if (message.type === 'error' || message.eventType === 'tool_use') {
      showFeed.value = true
    }
  }
  
  emit('message', message)
  
  // Auto-scroll if enabled
  if (autoScroll.value && showFeed.value) {
    nextTick(() => scrollToBottom())
  }
}

function getMessageType(eventType: string): StreamingMessage['type'] {
  switch (eventType) {
    case 'system':
    case 'result':
      return 'system'
    case 'text':
      return 'assistant'
    case 'tool_use':
      return 'tool_call'
    case 'user':
      return 'assistant'
    case 'raw_output':
      return 'raw_output'
    case 'unknown':
      return 'error'
    default:
      return 'system'
  }
}

function getMessageComponent(message: StreamingMessage) {
  // Return different components based on message type
  switch (message.type) {
    case 'tool_call':
      return ToolCallMessage
    case 'system':
      return SystemMessage
    case 'assistant':
      return AssistantMessage
    case 'error':
      return ErrorMessage
    default:
      return RawMessage
  }
}

function toggleAutoScroll() {
  autoScroll.value = !autoScroll.value
  if (autoScroll.value) {
    scrollToBottom()
  }
}

function clearFeed() {
  messages.value = []
  unreadCount.value = 0
  hasNewMessages.value = false
}

function scrollToBottom() {
  if (feedContent.value) {
    feedContent.value.scrollTop = feedContent.value.scrollHeight
  }
}

function formatTime(timestamp: Date): string {
  return timestamp.toLocaleTimeString()
}

// Watch for feed visibility changes
watch(showFeed, (visible) => {
  if (visible) {
    unreadCount.value = 0
    hasNewMessages.value = false
    nextTick(() => scrollToBottom())
  }
})

// Watch for instance changes
watch(() => props.instances, (newInstances, oldInstances) => {
  if (websocket.value && isConnected.value) {
    // Unsubscribe from old instances
    oldInstances?.forEach(instanceId => {
      websocket.value?.send(JSON.stringify({
        type: 'unsubscribe',
        instanceId
      }))
    })
    
    // Subscribe to new instances
    newInstances.forEach(instanceId => {
      websocket.value?.send(JSON.stringify({
        type: 'subscribe',
        instanceId
      }))
    })
  }
}, { deep: true })

// Lifecycle
onMounted(() => {
  if (props.autoConnect) {
    connect()
  }
})

onUnmounted(() => {
  disconnect()
})
</script>

<style scoped>
.claude-code-streaming {
  position: relative;
}

.streaming-status {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  transition: all 0.3s ease;
}

.streaming-status.active {
  background: #ecfdf5;
  border: 1px solid #10b981;
}

.status-indicator {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

.status-indicator.status-connected {
  background: #10b981;
}

.status-indicator.status-error {
  background: #f59e0b;
}

.pulse-dot {
  position: absolute;
  top: -2px;
  left: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse 2s infinite;
  opacity: 0.6;
}

.status-text {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.message-feed {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 500px;
  height: 400px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.feed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.feed-header h4 {
  margin: 0;
  font-size: 14px;
  color: #1e293b;
}

.feed-controls {
  display: flex;
  gap: 4px;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: white;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

.control-btn.active {
  background: #3b82f6;
  color: white;
}

.feed-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.message-item {
  margin-bottom: 8px;
  padding: 8px;
  border-radius: 4px;
  background: #f8fafc;
  border-left: 3px solid #e2e8f0;
}

.message-item.system {
  border-left-color: #3b82f6;
}

.message-item.assistant {
  border-left-color: #10b981;
}

.message-item.tool_call {
  border-left-color: #f59e0b;
}

.message-item.error {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.message-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
  font-size: 11px;
  color: #64748b;
}

.instance-id {
  font-family: monospace;
  background: #e2e8f0;
  padding: 2px 4px;
  border-radius: 2px;
}

.timestamp {
  color: #94a3b8;
}

.event-type {
  font-weight: 500;
  color: #475569;
}

.message-content {
  font-size: 12px;
  color: #1e293b;
  font-family: monospace;
  white-space: pre-wrap;
  max-height: 100px;
  overflow-y: auto;
}

.feed-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  font-size: 11px;
  color: #64748b;
}

.connection-status .connected {
  color: #10b981;
}

.floating-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  transition: all 0.3s ease;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.floating-btn:hover {
  background: #2563eb;
  transform: scale(1.1);
}

.floating-btn.pulse {
  animation: pulse-button 2s infinite;
}

.badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: #ef4444;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pulse-button {
  0% {
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }
  50% {
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.8);
  }
  100% {
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }
}
</style>