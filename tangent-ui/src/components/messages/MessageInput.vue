<template>
  <div class="message-input-container">
    <!-- Main input area -->
    <div class="input-wrapper" :class="{ 'focused': isFocused, 'has-content': hasContent }">
      <!-- Text input area -->
      <div class="input-area">
        <div
          ref="editableRef"
          contenteditable="true"
          class="input-field"
          placeholder="Type your message..."
          @input="handleInput"
          @keydown="handleKeyDown"
          @focus="handleFocus"
          @blur="handleBlur"
          @paste="handlePaste"
        ></div>
      </div>

      <!-- Controls area -->
      <div class="controls">
        <!-- Voice button -->
        <button
          v-if="!hasContent"
          @click="toggleVoice"
          class="control-btn voice-btn"
          :class="{ 'recording': isRecording, 'processing': isProcessing }"
          :title="getVoiceTitle()"
        >
          <Mic v-if="!isRecording && !isProcessing" class="icon" />
          <div v-else-if="isRecording" class="recording-indicator">
            <div class="pulse-dot"></div>
          </div>
          <Loader2 v-else class="icon spin" />
        </button>

        <!-- Send/Stop button -->
        <button
          @click="handleAction"
          class="control-btn send-btn"
          :class="{ 'loading': isLoading, 'ready': hasContent && !isLoading }"
          :disabled="!isLoading && !hasContent"
          :title="isLoading ? 'Stop' : 'Send message'"
        >
          <StopCircle v-if="isLoading" class="icon" />
          <Send v-else class="icon" />
        </button>
      </div>
    </div>

    <!-- Voice transcription result -->
    <div v-if="transcription" class="transcription-result">
      <div class="transcription-header">
        <span class="transcription-label">Voice Input</span>
        <div class="transcription-actions">
          <button @click="useTranscription" class="transcription-btn use">Use</button>
          <button @click="sendTranscription" class="transcription-btn send">Send</button>
          <button @click="clearTranscription" class="transcription-btn clear">×</button>
        </div>
      </div>
      <div class="transcription-content">{{ transcription }}</div>
    </div>

    <!-- Voice status -->
    <div v-if="isRecording || isProcessing" class="voice-status">
      <div class="status-indicator" :class="{ 'recording': isRecording, 'processing': isProcessing }"></div>
      <span>{{ isRecording ? 'Listening...' : 'Processing...' }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { Mic, Send, StopCircle, Loader2 } from 'lucide-vue-next'
import audioService from '@/services/audioService'

const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false
  },
  nodeHeight: {
    type: Number,
    default: null
  },
  nodeWidth: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['send', 'stop'])

// Refs
const editableRef = ref(null)
const inputText = ref('')
const isFocused = ref(false)

// Voice state from audio service
const isRecording = computed(() => audioService.isRecording.value)
const isProcessing = computed(() => audioService.isProcessing.value)
const transcription = computed(() => audioService.transcription.value)

// Computed
const hasContent = computed(() => inputText.value.trim().length > 0)

// Calculate responsive input height based on node height
const maxInputHeight = computed(() => {
  if (!props.nodeHeight) return 12 * 24 // Default 12 lines (288px)
  
  // If node is custom sized, allow input to use up to 40% of the available height
  // Subtract ~200px for header, padding, and other UI elements
  const availableHeight = props.nodeHeight - 200
  const maxAllowed = Math.max(availableHeight * 0.4, 24 * 3) // At least 3 lines
  
  return Math.min(maxAllowed, 24 * 16) // Cap at 16 lines max
})

// Voice functionality
const getVoiceTitle = () => {
  if (isProcessing.value) return 'Processing voice...'
  if (isRecording.value) return 'Stop recording'
  return 'Start voice input'
}

const toggleVoice = async () => {
  if (isRecording.value) {
    await audioService.stopRecording()
  } else {
    const success = await audioService.startRecording({ type: 'manual' })
    if (!success) {
      console.error('Failed to start voice recording')
    }
  }
}

const useTranscription = () => {
  if (transcription.value && editableRef.value) {
    editableRef.value.textContent = transcription.value
    handleInput()
    audioService.clearTranscription()
    editableRef.value.focus()
  }
}

const sendTranscription = () => {
  if (transcription.value) {
    emit('send', transcription.value)
    audioService.clearTranscription()
  }
}

const clearTranscription = () => {
  audioService.clearTranscription()
}

// Input handling
const handleInput = () => {
  if (editableRef.value) {
    inputText.value = editableRef.value.textContent || ''
    
    // Auto-resize based on content with proper scrolling
    const el = editableRef.value
    el.style.height = 'auto'
    
    // Calculate scroll height but allow proper expansion
    const lineHeight = 24 // 1.5rem
    const minHeight = lineHeight
    const maxHeight = maxInputHeight.value
    
    const scrollHeight = el.scrollHeight
    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight))
    
    el.style.height = newHeight + 'px'
    
    // Ensure the cursor/selection is visible when typing
    if (scrollHeight > maxHeight) {
      el.scrollTop = el.scrollHeight - el.clientHeight
    }
  }
}

const handleKeyDown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  } else if (e.key === 'Enter' && e.shiftKey) {
    // Allow line break - handled by browser
    return
  } else if (e.key === 'Escape') {
    editableRef.value?.blur()
  }
}

const handleFocus = () => {
  isFocused.value = true
}

const handleBlur = () => {
  isFocused.value = false
}

const handlePaste = (e) => {
  e.preventDefault()
  const text = e.clipboardData.getData('text/plain')
  
  // Insert text at cursor position
  const selection = window.getSelection()
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }
  
  handleInput()
}

const handleAction = () => {
  if (isLoading.value) {
    emit('stop')
  } else {
    handleSend()
  }
}

const handleSend = () => {
  if (!hasContent.value || props.isLoading) return
  
  const content = inputText.value.trim()
  emit('send', content)
  
  // Clear input
  if (editableRef.value) {
    editableRef.value.textContent = ''
    editableRef.value.style.height = 'auto'
  }
  inputText.value = ''
}

// Setup audio service on mount
import { onMounted, onUnmounted } from 'vue'

onMounted(async () => {
  audioService.setCallbacks({
    onTranscription: (text) => {
      // Handled by computed transcription
    },
    onAutoSubmit: (text) => {
      // For future auto-submit functionality
    },
    onError: (error) => {
      console.error('Voice error:', error)
    }
  })
})

onUnmounted(() => {
  audioService.cleanup()
})
</script>

<style scoped>
.message-input-container {
  @apply flex flex-col gap-3;
  padding: 1rem 0 0 0;
  border-top: 1px solid hsl(var(--border));
}

.input-wrapper {
  @apply flex items-end gap-3 p-3 rounded-xl border transition-all duration-200;
  background: hsl(var(--background));
  border-color: hsl(var(--border));
  min-height: 3.5rem;
}

.input-wrapper.focused {
  @apply ring-2 ring-primary/20;
  border-color: hsl(var(--primary));
}

.input-wrapper.has-content {
  border-color: hsl(var(--primary) / 0.5);
}

.input-area {
  @apply flex-1 min-w-0;
}

.input-field {
  @apply w-full resize-none outline-none bg-transparent text-base-content placeholder:text-gray-400;
  min-height: 1.5rem;
  line-height: 1.5;
  font-size: 0.875rem;
  overflow-y: auto;
  word-wrap: break-word;
  white-space: pre-wrap;
  
  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--b3)) transparent;
}

.input-field::-webkit-scrollbar {
  width: 6px;
}

.input-field::-webkit-scrollbar-track {
  background: transparent;
}

.input-field::-webkit-scrollbar-thumb {
  background: hsl(var(--b3));
  border-radius: 3px;
}

.input-field::-webkit-scrollbar-thumb:hover {
  background: rgb(107 114 128);
}

.input-field:empty::before {
  content: attr(placeholder);
  color: rgb(156 163 175); /* text-gray-400 */
  pointer-events: none;
}

.controls {
  @apply flex items-center gap-2;
}

.control-btn {
  @apply w-9 h-9 rounded-full flex items-center justify-center border-0 cursor-pointer transition-all duration-200;
  background: hsl(var(--b3));
  color: rgb(107 114 128); /* text-gray-500 */
}

.control-btn:hover:not(:disabled) {
  background: rgb(107 114 128 / 0.1); /* text-gray-500 with opacity */
  color: hsl(var(--bc)); /* base-content */
  transform: scale(1.05);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-btn .icon {
  @apply w-4 h-4;
}

.voice-btn.recording {
  background: hsl(var(--er));
  color: white;
  animation: pulse 2s infinite;
}

.voice-btn.processing {
  background: hsl(var(--secondary));
  color: white;
}

.send-btn.ready {
  background: hsl(var(--primary));
  color: white;
  transform: scale(1.05);
}

.send-btn.loading {
  background: hsl(var(--er));
  color: white;
}

.recording-indicator {
  @apply flex items-center justify-center;
}

.pulse-dot {
  @apply w-2 h-2 bg-white rounded-full;
  animation: pulse-dot 1s infinite;
}

.spin {
  animation: spin 1s linear infinite;
}

/* Voice transcription */
.transcription-result {
  @apply bg-base-200/50 border rounded-lg overflow-hidden;
}

.transcription-header {
  @apply flex items-center justify-between px-3 py-2 bg-base-200/80 border-b;
}

.transcription-label {
  @apply text-xs font-medium text-gray-500;
}

.transcription-actions {
  @apply flex gap-1;
}

.transcription-btn {
  @apply px-2 py-1 text-xs rounded border-0 cursor-pointer transition-colors;
}

.transcription-btn.use {
  @apply bg-primary text-white;
}

.transcription-btn.send {
  @apply bg-secondary text-white;
}

.transcription-btn.clear {
  @apply bg-error/10 text-error hover:bg-error/20;
}

.transcription-content {
  @apply p-3 text-sm max-h-24 overflow-y-auto;
}

/* Voice status */
.voice-status {
  @apply absolute -top-10 left-1/2 transform -translate-x-1/2 flex items-center gap-2 px-3 py-1 bg-base-100 border rounded-full text-xs shadow-lg;
}

.status-indicator {
  @apply w-2 h-2 rounded-full;
}

.status-indicator.recording {
  @apply bg-error;
  animation: blink 1s infinite;
}

.status-indicator.processing {
  @apply bg-secondary;
  animation: spin 1s linear infinite;
}

/* Animations */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}

/* Responsive design */
@media (max-width: 640px) {
  .input-wrapper {
    @apply p-2;
    min-height: 3rem;
  }
  
  .control-btn {
    @apply w-8 h-8;
  }
  
  .control-btn .icon {
    @apply w-3.5 h-3.5;
  }
}
</style>