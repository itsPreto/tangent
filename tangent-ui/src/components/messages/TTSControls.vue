<template>
  <div class="tts-controls flex items-center gap-2">
    <!-- Play/Stop Button -->
    <button
      @click="togglePlayback"
      :disabled="!canSpeak || !text.trim()"
      :class="[
        'tts-button flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200',
        isActive
          ? 'bg-blue-500 hover:bg-blue-600 text-white'
          : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300',
        (!canSpeak || !text.trim()) && 'opacity-50 cursor-not-allowed'
      ]"
      :title="isActive ? 'Stop reading' : 'Read aloud'"
    >
      <Volume2 v-if="!isActive" class="w-4 h-4" />
      <VolumeX v-else class="w-4 h-4" />
    </button>

    <!-- Auto-read Toggle (if enabled in settings) -->
    <button
      v-if="showAutoToggle"
      @click="toggleAutoRead"
      :class="[
        'auto-read-toggle flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200',
        autoRead
          ? 'bg-green-500 hover:bg-green-600 text-white'
          : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
      ]"
      title="Toggle auto-read for new messages"
    >
      <RotateCcw class="w-4 h-4" />
    </button>

    <!-- Voice Selection (when expanded) -->
    <div v-if="showVoiceSelect" class="voice-select ml-2">
      <select
        v-model="selectedVoice"
        @change="updateVoice"
        class="text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
      >
        <option v-for="voice in voices" :key="voice.id" :value="voice.id">
          {{ voice.name }}
        </option>
      </select>
    </div>

    <!-- Speed Control (when expanded) -->
    <div v-if="showSpeedControl" class="speed-control ml-2 flex items-center gap-1">
      <span class="text-xs text-gray-500 dark:text-gray-400">Speed:</span>
      <input
        v-model.number="speed"
        @change="updateSpeed"
        type="range"
        min="0.5"
        max="2.0"
        step="0.1"
        class="w-16 h-1"
      />
      <span class="text-xs text-gray-500 dark:text-gray-400 w-8">{{ speed.toFixed(1) }}x</span>
    </div>

    <!-- Status Indicator -->
    <div v-if="isLoading || error" class="status-indicator ml-2">
      <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin text-blue-500" />
      <AlertCircle v-else-if="error" class="w-4 h-4 text-red-500" :title="error" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Volume2, VolumeX, RotateCcw, Loader2, AlertCircle } from 'lucide-vue-next'
import ttsService from '@/services/ttsService'

interface Props {
  text: string
  autoTrigger?: boolean
  streamingTrigger?: boolean
  streamingText?: string | null
  showAutoToggle?: boolean
  showVoiceSelect?: boolean
  showSpeedControl?: boolean
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoTrigger: false,
  streamingTrigger: false,
  streamingText: null,
  showAutoToggle: false,
  showVoiceSelect: false,
  showSpeedControl: false,
  compact: true
})

const emit = defineEmits<{
  speaking: [isActive: boolean]
  error: [error: string]
}>()

// Local state
const selectedVoice = ref(ttsService.settings.voice)
const speed = ref(ttsService.settings.speed)
const isStreamingMode = ref(false)
const streamingBuffer = ref('')
const lastProcessedLength = ref(0)

// Computed properties
const canSpeak = computed(() => ttsService.canSpeak)
const voices = computed(() => ttsService.voices.value)
const isLoading = computed(() => ttsService.isSpeaking.value)
const isPlaying = computed(() => ttsService.isPlaying.value)
const error = computed(() => ttsService.error.value)
const autoRead = computed(() => ttsService.settings.autoRead)

const isActive = computed(() => isLoading.value || isPlaying.value)


const togglePlayback = async () => {
  if (isActive.value) {
    stopReading()
  } else {
    await startReading()
  }
}

const startReading = async () => {
  console.log('TTSControls: startReading called, text:', props.text.slice(0, 50), 'canSpeak:', canSpeak.value)
  
  if (!props.text.trim() || !canSpeak.value) {
    console.log('TTSControls: Cannot start reading - no text or cannot speak')
    return
  }

  try {
    console.log('TTSControls: Starting TTS with voice:', selectedVoice.value, 'speed:', speed.value)
    
    // Use semantic chunking for better natural speech flow
    if (props.text.length > 100) {
      await ttsService.speakSemanticChunks(props.text, {
        voice: selectedVoice.value,
        speed: speed.value
      })
    } else {
      // For very short texts, use the regular speak method
      await ttsService.speak(props.text, {
        voice: selectedVoice.value,
        speed: speed.value
      })
    }
    console.log('TTSControls: TTS completed successfully')
  } catch (error) {
    console.error('TTSControls: TTS error:', error)
  }
}

const stopReading = () => {
  ttsService.stop()
}

const toggleAutoRead = () => {
  ttsService.updateSettings({
    autoRead: !autoRead.value
  })
}

const updateVoice = () => {
  ttsService.updateSettings({
    voice: selectedVoice.value
  })
}

const updateSpeed = () => {
  ttsService.updateSettings({
    speed: speed.value
  })
}

const startStreamingMode = () => {
  if (!canSpeak.value) return
  
  isStreamingMode.value = true
  streamingBuffer.value = ''
  lastProcessedLength.value = 0
  
  console.log('Started streaming TTS mode')
}

const stopStreamingMode = async () => {
  if (!isStreamingMode.value) return
  
  isStreamingMode.value = false
  
  // Process any remaining text in buffer
  if (streamingBuffer.value.trim() && streamingBuffer.value.length > lastProcessedLength.value) {
    const remainingText = streamingBuffer.value.slice(lastProcessedLength.value).trim()
    if (remainingText) {
      await speakStreamingChunk(remainingText)
    }
  }
  
  streamingBuffer.value = ''
  lastProcessedLength.value = 0
  
  console.log('Stopped streaming TTS mode')
}

const processStreamingText = async (newText: string) => {
  if (!isStreamingMode.value || !canSpeak.value) return
  
  streamingBuffer.value = newText
  
  // Look for complete sentences or chunks to speak
  const chunkToSpeak = extractSpeakableChunk(newText, lastProcessedLength.value)
  
  if (chunkToSpeak.trim()) {
    lastProcessedLength.value += chunkToSpeak.length
    await speakStreamingChunk(chunkToSpeak)
  }
}

const extractSpeakableChunk = (text: string, fromIndex: number): string => {
  const newContent = text.slice(fromIndex)
  
  // Find the last complete sentence or meaningful chunk
  const sentenceEnders = /[.!?]\s/g
  let lastSentenceEnd = -1
  let match
  
  while ((match = sentenceEnders.exec(newContent)) !== null) {
    lastSentenceEnd = match.index + match[0].length
  }
  
  if (lastSentenceEnd > 0) {
    return newContent.slice(0, lastSentenceEnd)
  }
  
  // If no complete sentence, check for meaningful chunks (commas, etc.)
  const chunkEnders = /[,;:]\s/g
  let lastChunkEnd = -1
  
  while ((match = chunkEnders.exec(newContent)) !== null) {
    lastChunkEnd = match.index + match[0].length
  }
  
  if (lastChunkEnd > 0 && newContent.length - lastChunkEnd > 50) {
    return newContent.slice(0, lastChunkEnd)
  }
  
  // If streaming is done or we have a good chunk, return it
  if (!props.streamingTrigger && newContent.length > 20) {
    return newContent
  }
  
  return ''
}

const speakStreamingChunk = async (chunk: string) => {
  try {
    await ttsService.speak(chunk, {
      voice: selectedVoice.value,
      speed: speed.value
    })
  } catch (error) {
    console.error('Streaming TTS error:', error)
  }
}


// Watch for auto-trigger based on text changes
watch(
  () => props.text,
  (newText) => {
    if (props.autoTrigger && newText.trim() && !isStreamingMode.value) {
      // Small delay to let the component fully render
      setTimeout(() => {
        startReading()
      }, 500)
    }
  },
  { immediate: false }
)

// Watch for auto-trigger prop changes (when user enables auto TTS on existing messages)
watch(
  () => props.autoTrigger,
  (shouldAutoTrigger) => {
    console.log('TTSControls: autoTrigger changed to:', shouldAutoTrigger, 'text:', props.text.slice(0, 50), 'canSpeak:', canSpeak.value)
    if (shouldAutoTrigger && props.text.trim() && !isStreamingMode.value && canSpeak.value) {
      console.log('TTSControls: Starting auto-reading...')
      // Small delay to let the component fully render
      setTimeout(() => {
        startReading()
      }, 500)
    }
  },
  { immediate: true }
)

// Watch for streaming trigger
watch(
  () => props.streamingTrigger,
  (enabled) => {
    if (enabled) {
      startStreamingMode()
    } else {
      stopStreamingMode()
    }
  },
  { immediate: true }
)

// Watch for streaming text changes
watch(
  () => props.streamingText,
  (newText) => {
    if (isStreamingMode.value && newText) {
      processStreamingText(newText)
    }
  },
  { immediate: false }
)

// Watch for speaking state changes
watch(isActive, (active) => {
  emit('speaking', active)
})

// Watch for errors
watch(error, (newError) => {
  if (newError) {
    emit('error', newError)
  }
})


// Watch for auto-trigger
watch(
  () => props.text,
  (newText) => {
    if (props.autoTrigger && autoRead.value && newText.trim() && !isStreamingMode.value) {
      setTimeout(() => {
        startReading()
      }, 500)
    }
  },
  { immediate: false }
)

// Watch for streaming trigger
watch(
  () => props.streamingTrigger,
  (enabled) => {
    if (enabled) {
      startStreamingMode()
    } else {
      stopStreamingMode()
    }
  },
  { immediate: true }
)

// Watch for streaming text changes
watch(
  () => props.streamingText,
  (newText) => {
    if (isStreamingMode.value && newText) {
      processStreamingText(newText)
    }
  },
  { immediate: false }
)
// Cleanup on unmount
onUnmounted(() => {
  if (isActive.value) {
    ttsService.stop()
  }
  if (isStreamingMode.value) {
    stopStreamingMode()
  }
})

// Expose methods for parent components
defineExpose({
  startReading,
  stopReading,
  isActive
})
</script>

<style scoped>
.tts-controls {
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.tts-controls:hover {
  opacity: 1;
}

.tts-button:disabled {
  pointer-events: none;
}

/* Custom range slider styling */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-track {
  background: #e5e7eb;
  height: 4px;
  border-radius: 2px;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  background: #3b82f6;
  height: 12px;
  width: 12px;
  border-radius: 50%;
  cursor: pointer;
}

input[type="range"]::-moz-range-track {
  background: #e5e7eb;
  height: 4px;
  border-radius: 2px;
  border: none;
}

input[type="range"]::-moz-range-thumb {
  background: #3b82f6;
  height: 12px;
  width: 12px;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.dark input[type="range"]::-webkit-slider-track {
  background: #4b5563;
}

.dark input[type="range"]::-moz-range-track {
  background: #4b5563;
}
</style>