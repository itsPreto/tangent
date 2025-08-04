<template>
  <div class="canvas-input-container" 
       :class="{ 
         'transitioning': isTransitioning,
         'expanded': isExpanded,
         'morphing-to-node': isMorphingToNode,
         'animation-phase-morphing': animationPhase === 'morphing',
         'animation-phase-positioning': animationPhase === 'positioning', 
         'animation-phase-materializing': animationPhase === 'materializing'
       }"
       :style="containerStyle">
    
    <!-- Input Container -->
    <div class="input-wrapper" 
         :class="{ 'focused': isFocused, 'has-content': hasContent }"
         ref="inputWrapperRef"
         @wheel="handleWheel">
      
      <!-- Main input area with fly-in from left -->
      <Transition name="fly-in-left">
        <div v-if="showInputArea" class="input-area">
          <div
            ref="editableRef"
            contenteditable="true"
            class="input-field"
            :placeholder="inputPlaceholder"
            @input="handleInput"
            @keydown="handleKeyDown"
            @focus="handleFocus"
            @blur="handleBlur"
            @paste="handlePaste"
            @scroll="handleScroll"
            @wheel="handleWheel"
          ></div>
        </div>
      </Transition>

      <!-- Controls area with fly-in from right -->
      <Transition name="fly-in-right">
        <div v-if="showControls" class="controls">
          <!-- Voice button - always visible during recording -->
          <button
            v-if="!hasContent || isRecording"
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

          <!-- Send button -->
          <button
            @click="handleSend"
            class="control-btn send-btn"
            :class="{ 'ready': hasContent && !isLoading }"
            :disabled="!hasContent || isLoading"
            title="Start your workspace"
          >
            <Send class="icon" />
          </button>
        </div>
      </Transition>
    </div>

    <!-- Remove separate transcription UI - transcription goes directly in input -->

    <!-- Example prompts docked at bottom -->
    <Transition name="fade-in-up">
      <div v-if="showHints && !hasContent" class="example-prompts">
        <button 
          v-for="prompt in examplePrompts" 
          :key="prompt"
          @click="setPrompt(prompt)"
          class="example-prompt"
        >
          {{ prompt }}
        </button>
      </div>
    </Transition>

    <!-- Voice status -->
    <div v-if="isRecording || isProcessing" class="voice-status">
      <div class="status-indicator" :class="{ 'recording': isRecording, 'processing': isProcessing }"></div>
      <span>{{ isRecording ? 'Listening...' : 'Processing...' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { Mic, Send, Loader2 } from 'lucide-vue-next'
import audioService from '@/services/audioService'

const props = defineProps<{
  zoom?: number
  panX?: number
  panY?: number
}>()

const emit = defineEmits<{
  'workspace-created': [message: string, targetPosition?: { x: number, y: number }]
  'transition-start': []
  'transition-complete': []
  'morph-phase-complete': [phase: string]
  'request-target-position': []
}>()

// Refs
const editableRef = ref<HTMLElement>()
const inputWrapperRef = ref<HTMLElement>()

// State
const isFocused = ref(false)
const hasContent = ref(false)
const isLoading = ref(false)

// Voice state from audio service
const isRecording = computed(() => audioService.isRecording.value)
const isProcessing = computed(() => audioService.isProcessing.value)
const transcription = computed(() => audioService.transcription.value)
const isTransitioning = ref(false)
const isExpanded = ref(false)
const messageContent = ref('')

// Enhanced transition states for smooth node morphing
const isMorphingToNode = ref(false)
const morphTargetPosition = ref({ x: 0, y: 0 })
const animationPhase = ref<'idle' | 'morphing' | 'positioning' | 'materializing'>('idle')

// Fly-in animation states
const showInputArea = ref(false)
const showControls = ref(false) 
const showHints = ref(false)

// Grid snapping is now handled by pan constraints in InfiniteCanvas

// Example prompts to help users get started
const examplePrompts = ref([
  "Help me build a React component",
  "Analyze this codebase structure", 
  "Debug my Python script",
  "Create a project plan"
])

// Computed
const inputPlaceholder = computed(() => {
  if (isRecording.value) return "Listening..."
  if (isProcessing.value) return "Processing..."
  return "What would you like to work on today?"
})

const containerStyle = computed(() => {
  // Now positioned directly at world coordinates since we're inside the canvas transform container
  const NEW_CHAT_X = -3000
  const NEW_CHAT_Y = -3000
  
  // Simple world coordinate positioning - the parent canvas transform handles zoom/pan
  const transform = `translate(${NEW_CHAT_X}px, ${NEW_CHAT_Y}px)`
  
  return {
    transform,
    transition: 'none' // No position transitions, canvas handles all transforms
  }
})

// Watch for typing to trigger morphing animation
watch(hasContent, (newHasContent) => {
  if (newHasContent && !isMorphingToNode.value) {
    // User started typing - trigger morphing animation
    isMorphingToNode.value = true
    animationPhase.value = 'morphing'
    emit('morph-phase-complete', 'typing-start')
  } else if (!newHasContent && isMorphingToNode.value && animationPhase.value === 'morphing') {
    // User deleted all content - reverse the morph
    isMorphingToNode.value = false
    animationPhase.value = 'idle'
  }
})

// Methods
const handleInput = (event: Event) => {
  const target = event.target as HTMLElement
  messageContent.value = target.innerText.trim()
  hasContent.value = messageContent.value.length > 0
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (hasContent.value) {
      handleSend()
    }
  }
}

const handleFocus = () => {
  isFocused.value = true
}

const handleBlur = () => {
  isFocused.value = false
}

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') || ''
  
  // Insert text at cursor position
  const selection = window.getSelection()
  if (selection?.rangeCount) {
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }
  
  // Update content
  messageContent.value = editableRef.value?.innerText.trim() || ''
  hasContent.value = messageContent.value.length > 0
}

const setPrompt = (prompt: string) => {
  if (editableRef.value) {
    editableRef.value.innerText = prompt
    messageContent.value = prompt
    hasContent.value = true
    editableRef.value.focus()
  }
}

const toggleVoice = async () => {
  if (isRecording.value) {
    await audioService.stopRecording()
  } else {
    const success = await audioService.startRecording({ 
      type: 'continuous'         // Use real-time chunk processing
    })
    if (!success) {
      console.error('Failed to start voice recording')
    }
  }
}

const getVoiceTitle = () => {
  if (isProcessing.value) return 'Processing voice...'
  if (isRecording.value) return 'Stop recording'
  return 'Start voice input'
}

// Accumulated text for streaming 1-second chunks
const accumulatedText = ref('')
const userHasScrolled = ref(false)

// Track if user manually scrolls
const handleScroll = (event: Event) => {
  // Prevent canvas from zooming when scrolling in input
  event.stopPropagation()
  
  if (editableRef.value) {
    const isAtBottom = editableRef.value.scrollHeight - editableRef.value.scrollTop <= editableRef.value.clientHeight + 10
    userHasScrolled.value = !isAtBottom
  }
}

// Prevent wheel events from zooming the canvas when scrolling in input
const handleWheel = (event: WheelEvent) => {
  if (editableRef.value) {
    const hasScroll = editableRef.value.scrollHeight > editableRef.value.clientHeight
    if (hasScroll) {
      event.stopPropagation()
    }
  }
}

// Watch for transcription and append chunks
watch(transcription, (newTranscription) => {
  if (newTranscription && editableRef.value) {
    // Append new chunk to accumulated text
    if (accumulatedText.value) {
      accumulatedText.value += ' ' + newTranscription
    } else {
      accumulatedText.value = newTranscription
    }
    
    editableRef.value.innerText = accumulatedText.value
    messageContent.value = accumulatedText.value
    hasContent.value = accumulatedText.value.length > 0
    
    // Auto-scroll only if user hasn't manually scrolled up
    nextTick(() => {
      if (editableRef.value && !userHasScrolled.value) {
        // Scroll the input field to the bottom
        editableRef.value.scrollTop = editableRef.value.scrollHeight
        
        // Also move cursor to end of text
        const range = document.createRange()
        const selection = window.getSelection()
        range.selectNodeContents(editableRef.value)
        range.collapse(false) // false means collapse to end
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    })
    
    // Clear transcription for next chunk
    setTimeout(() => {
      audioService.clearTranscription()
    }, 100)
  }
})

// Reset when starting new recording
watch(isRecording, (recording) => {
  if (recording && !accumulatedText.value) {
    accumulatedText.value = ''
    userHasScrolled.value = false // Reset scroll tracking
    if (editableRef.value) {
      editableRef.value.innerText = ''
      messageContent.value = ''
      hasContent.value = false
      editableRef.value.scrollTop = 0 // Scroll to top
    }
  }
})

// Simple fade-out transition (morphing already happened during typing)
const startNodeMorphTransition = async () => {
  // If not already morphing, do a quick morph first
  if (!isMorphingToNode.value) {
    isMorphingToNode.value = true
    animationPhase.value = 'morphing'
    emit('morph-phase-complete', 'morphing-start')
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  // Start fade-out - create branch node now while input container fades
  animationPhase.value = 'materializing'
  emit('morph-phase-complete', 'materializing-start')
  
  // Use the same designated new chat coordinate
  const NEW_CHAT_X = -3000
  const NEW_CHAT_Y = -3000
  
  emit('workspace-created', messageContent.value, { x: NEW_CHAT_X, y: NEW_CHAT_Y })
  
  // Continue fade out for 300ms while branch node fades in
  await new Promise(resolve => setTimeout(resolve, 300))
  
  // Complete the transition
  isExpanded.value = true
  emit('transition-complete')
  isLoading.value = false
}

const handleSend = async () => {
  if (!hasContent.value || isLoading.value) return
  
  isLoading.value = true
  emit('transition-start')
  
  // Start the enhanced 3-phase transition
  await startNodeMorphTransition()
}

// Setup audio service and staggered fly-in animations on mount
onMounted(async () => {
  await nextTick()
  
  // Setup audio service
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
  
  // Start fly-in animations with staggered timing
  // 1. Input area flies in from left (immediate)
  showInputArea.value = true
  
  // 2. Controls fly in from right (150ms delay)
  setTimeout(() => {
    showControls.value = true
  }, 150)
  
  // 3. Hints fade in (300ms delay)
  setTimeout(() => {
    showHints.value = true
  }, 300)
  
  // Focus input after animations start
  setTimeout(() => {
    editableRef.value?.focus()
  }, 200)
})

onUnmounted(() => {
  audioService.cleanup()
})

// Set target position for morphing animation
const setMorphTargetPosition = (position: { x: number, y: number }) => {
  morphTargetPosition.value = position
}

// Expose methods for parent components
defineExpose({
  focus: () => editableRef.value?.focus(),
  setContent: (content: string) => {
    if (editableRef.value) {
      editableRef.value.innerText = content
      messageContent.value = content
      hasContent.value = content.length > 0
    }
  },
  setMorphTargetPosition
})
</script>

<style scoped>
.canvas-input-container {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1000;
  width: 600px;
  max-width: 90vw;
  height: 240px; /* Fixed total height to prevent jarring changes */
  transform-origin: center center;
  /* Center the container by default */
  margin-left: -300px;
  margin-top: -120px; /* Adjusted for new height */
}

/* Half-opacity rectangle background */
.canvas-input-container::before {
  content: '';
  position: absolute;
  top: -20px;
  left: -20px;
  right: -20px;
  bottom: -20px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 32px;
  z-index: -1;
  backdrop-filter: blur(8px);
}

/* Simplified morphing states */
.canvas-input-container.morphing-to-node {
  z-index: 1100; /* Higher z-index during transition */
}

.canvas-input-container.animation-phase-morphing {
  /* Simple fade transition */
  transition: opacity 0.3s ease;
}

.canvas-input-container.animation-phase-morphing .input-wrapper {
  /* No complex morphing - just simple styling */
  border-color: hsl(var(--p));
  transition: border-color 0.3s ease;
}

.canvas-input-container.animation-phase-materializing {
  /* Fade out the entire container */  
  opacity: 0;
  transition: opacity 0.3s ease-out;
}

.input-wrapper {
  display: flex;
  align-items: flex-start;
  background: hsl(var(--b1));
  border: 2px solid hsl(var(--bc) / 0.2);
  border-radius: 24px;
  padding: 16px;
  gap: 12px;
  backdrop-filter: blur(16px);
  transition: border-color 0.3s ease, padding 0.3s ease, height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  height: 64px; /* Use height instead of min-height */
}

/* When user starts interacting, expand the entire container to be typeable */
.input-wrapper.focused {
  border-color: hsl(var(--p));
  /* Keep same padding and height when just focused */
}

.input-wrapper.has-content {
  border-color: hsl(var(--p));
  padding: 24px; /* More padding when active */
  align-items: flex-start; /* Top align when typing */
}

/* When typing, make the wrapper expand to fill available space */
.input-wrapper.has-content {
  height: 176px; /* Expand to fill the space hints leave behind, maintaining total container height */
}

.input-area {
  flex: 1;
  height: 32px;
  display: flex;
  flex-direction: column;
  transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Make input field expand when wrapper has content */
.input-wrapper.has-content .input-area {
  height: 120px; /* Expand to match new wrapper height and provide typing space */
}

.input-field {
  width: 100%;
  min-height: 32px;
  flex: 1; /* Fill available space in the input area */
  overflow-y: auto;
  overflow-x: hidden;
  outline: none;
  font-size: 16px;
  line-height: 1.5;
  color: hsl(var(--bc));
  background: transparent;
  resize: none;
  border: none;
  font-family: inherit;
  white-space: pre-wrap;
  word-wrap: break-word;
  scroll-behavior: smooth; /* Smooth scrolling animation */
  
  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--bc) / 0.2) transparent;
}

.input-field::-webkit-scrollbar {
  width: 6px;
}

.input-field::-webkit-scrollbar-track {
  background: transparent;
}

.input-field::-webkit-scrollbar-thumb {
  background: hsl(var(--bc) / 0.2);
  border-radius: 3px;
}

.input-field::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--bc) / 0.3);
}

.input-field:empty::before {
  content: attr(placeholder);
  color: hsl(var(--bc) / 0.5);
  pointer-events: none;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

/* Position controls at bottom-right when typing */
.input-wrapper.has-content .controls {
  align-self: flex-end;
  margin-top: auto;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 12px;
  background: hsl(var(--bc) / 0.1);
  color: hsl(var(--bc) / 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.control-btn:hover {
  background: hsl(var(--bc) / 0.15);
  color: hsl(var(--bc) / 0.8);
  transform: scale(1.05);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.voice-btn.recording {
  background: hsl(var(--error));
  color: white;
}

.voice-btn.processing {
  background: hsl(var(--warning));
  color: white;
}

.send-btn.ready {
  background: hsl(var(--p));
  color: white;
}

.send-btn.ready:hover {
  background: hsl(var(--p) / 0.9);
  transform: scale(1.05);
}

.icon {
  width: 20px;
  height: 20px;
}

.recording-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.8);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Remove welcome-hints and hint-text styles - no longer needed */

.example-prompts {
  position: absolute;
  bottom: 20px; /* Fixed position at bottom */
  left: 0;
  right: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.example-prompt {
  padding: 8px 16px;
  border: 1px solid hsl(var(--bc) / 0.2);
  border-radius: 16px;
  background: hsl(var(--b1));
  color: hsl(var(--bc) / 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

/* Staggered slide-out animation for prompt buttons */
.fade-in-up-leave-active .example-prompt:nth-child(1) {
  animation: slideOutLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.fade-in-up-leave-active .example-prompt:nth-child(2) {
  animation: slideOutRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.05s forwards;
}
.fade-in-up-leave-active .example-prompt:nth-child(3) {
  animation: slideOutLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards;
}
.fade-in-up-leave-active .example-prompt:nth-child(4) {
  animation: slideOutRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.15s forwards;
}

@keyframes slideOutLeft {
  to {
    opacity: 0;
    transform: translateX(-100px) scale(0.8);
  }
}

@keyframes slideOutRight {
  to {
    opacity: 0;
    transform: translateX(100px) scale(0.8);
  }
}

/* Remove transcription UI styles - using inline transcription instead */

/* Voice status indicator */
.voice-status {
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  z-index: 10;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator.recording {
  background: #ff4444;
  animation: blink 1s infinite;
}

.status-indicator.processing {
  background: hsl(var(--s));
  animation: spin 1s linear infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}

/* Remove slideOutTextLeft - no longer needed */

.example-prompt:hover {
  border-color: hsl(var(--p) / 0.5);
  background: hsl(var(--p) / 0.1);
  color: hsl(var(--p));
  transform: translateY(-1px);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Transition states */
.canvas-input-container.transitioning {
  pointer-events: none;
}

.canvas-input-container.expanded {
  /* This state is when it becomes a branch node */
  width: 400px;
  height: 200px;
}

/* Fly-in animations */
.fly-in-left-enter-active {
  transition: all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.fly-in-left-enter-from {
  opacity: 0;
  transform: translateX(-100px);
}

.fly-in-left-enter-to {
  opacity: 1;
  transform: translateX(0);
}

.fly-in-right-enter-active {
  transition: all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.fly-in-right-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.fly-in-right-enter-to {
  opacity: 1;
  transform: translateX(0);
}

.fade-in-up-enter-active {
  transition: all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.fade-in-up-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); /* Match wrapper expansion timing */
}

.fade-in-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.fade-in-up-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.fade-in-up-leave-to {
  opacity: 0;
  transform: scale(0.95) translateX(-50px); /* Slide out to left while fading and scaling down */
}

/* Dark theme adjustments - removed box-shadow */
@media (prefers-color-scheme: dark) {
  /* No box-shadow on input-wrapper - keeping it clean */
}
</style>