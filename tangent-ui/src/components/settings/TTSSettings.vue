<template>
  <div class="tts-settings space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
        Text-to-Speech
      </h3>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          v-model="settings.enabled"
          @change="updateSettings"
          class="rounded border-gray-300 dark:border-gray-600"
        />
        <span class="text-sm text-gray-700 dark:text-gray-300">Enable TTS</span>
      </label>
    </div>

    <div v-if="settings.enabled" class="space-y-4">
      <!-- Voice Selection -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Voice
        </label>
        <select
          v-model="settings.voice"
          @change="updateSettings"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option v-for="voice in voices" :key="voice.id" :value="voice.id">
            {{ voice.name }}
          </option>
        </select>
      </div>

      <!-- Speed Control -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Speech Speed: {{ settings.speed.toFixed(1) }}x
        </label>
        <div class="flex items-center gap-3">
          <span class="text-xs text-gray-500 dark:text-gray-400">0.5x</span>
          <input
            type="range"
            v-model.number="settings.speed"
            @input="updateSettings"
            min="0.5"
            max="2.0"
            step="0.1"
            class="flex-1"
          />
          <span class="text-xs text-gray-500 dark:text-gray-400">2.0x</span>
        </div>
      </div>

      <!-- Auto-read Toggle -->
      <div class="flex items-center justify-between">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Auto-read Messages
          </label>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Automatically read new AI responses aloud
          </p>
        </div>
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            v-model="settings.autoRead"
            @change="updateSettings"
            class="rounded border-gray-300 dark:border-gray-600"
          />
        </label>
      </div>

      <!-- Test TTS -->
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Test Voice
            </label>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Preview your current voice settings
            </p>
          </div>
          <button
            @click="testVoice"
            :disabled="isTesting"
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-md text-sm transition-colors flex items-center gap-2"
          >
            <Volume2 v-if="!isTesting" class="w-4 h-4" />
            <Loader2 v-else class="w-4 h-4 animate-spin" />
            {{ isTesting ? 'Speaking...' : 'Test Voice' }}
          </button>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <div class="flex items-center gap-2">
          <AlertCircle class="w-4 h-4 text-red-500" />
          <span class="text-sm text-red-700 dark:text-red-300">{{ error }}</span>
        </div>
      </div>

      <!-- Status Info -->
      <div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <div class="flex items-center gap-2">
          <Info class="w-4 h-4 text-blue-500" />
          <div class="text-sm text-blue-700 dark:text-blue-300">
            <p class="font-medium">Kokoro TTS powered</p>
            <p class="text-xs">{{ voices.length }} voices available • 24kHz high quality</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { Volume2, Loader2, AlertCircle, Info } from 'lucide-vue-next'
import ttsService, { type TTSSettings } from '@/services/ttsService'

// Local reactive copy of settings
const settings = reactive<TTSSettings>({
  voice: ttsService.settings.voice,
  speed: ttsService.settings.speed,
  autoRead: ttsService.settings.autoRead,
  enabled: ttsService.settings.enabled
})

// State
const isTesting = ref(false)

// Computed properties
const voices = computed(() => ttsService.voices.value)
const error = computed(() => ttsService.error.value)

// Test message
const testMessage = "Hello! This is a test of your text-to-speech settings. The voice sounds clear and natural."

const updateSettings = () => {
  ttsService.updateSettings(settings)
}

const testVoice = async () => {
  if (isTesting.value) return
  
  isTesting.value = true
  try {
    await ttsService.speak(testMessage, {
      voice: settings.voice,
      speed: settings.speed
    })
  } catch (error) {
    console.error('Voice test failed:', error)
  } finally {
    isTesting.value = false
  }
}

// Initialize
onMounted(() => {
  // Load voices if not already loaded
  if (voices.value.length === 0) {
    ttsService.loadVoices()
  }
})
</script>

<style scoped>
/* Custom range slider styling */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.dark input[type="range"] {
  background: #4b5563;
}

.dark input[type="range"]::-webkit-slider-thumb {
  background: #60a5fa;
}

.dark input[type="range"]::-moz-range-thumb {
  background: #60a5fa;
}
</style>