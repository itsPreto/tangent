<template>
  <div class="voice-input-minimalist">
    <!-- Main Voice Button - always visible -->
    <button
      @click="toggleRecording"
      :disabled="isProcessing"
      :class="[
        'voice-main-btn',
        isRecording ? 'recording' : '',
        isProcessing ? 'processing' : '',
        currentMode === 'continuous' ? 'continuous-mode' : 'manual-mode'
      ]"
      :title="getButtonTitle()"
    >
      <div class="btn-content">
        <Mic v-if="!isRecording && !isProcessing" class="icon" />
        <div v-else-if="isRecording" class="recording-indicator">
          <div class="pulse-dot"></div>
        </div>
        <Loader2 v-else class="icon animate-spin" />
        
        <!-- Mode indicator -->
        <div class="mode-indicator">
          {{ currentMode === 'continuous' ? 'C' : 'M' }}
        </div>
      </div>
    </button>

    <!-- Expandable Settings (Hidden by default) -->
    <div v-if="showSettings" class="settings-panel">
      <!-- Mode Toggle -->
      <div class="setting-row">
        <span class="setting-label">Mode</span>
        <div class="mode-toggle">
          <button
            @click="setVoiceMode('manual')"
            :class="['mode-btn', currentMode === 'manual' ? 'active' : '']"
          >
            Manual
          </button>
          <button
            @click="setVoiceMode('continuous')"
            :class="['mode-btn', currentMode === 'continuous' ? 'active' : '']"
          >
            Conversation
          </button>
        </div>
      </div>

      <!-- Continuous Mode Settings -->
      <div v-if="currentMode === 'continuous'" class="setting-row">
        <details class="advanced-settings">
          <summary>Advanced</summary>
          <div class="settings-grid">
            <div class="setting-item">
              <label>Sensitivity</label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                v-model.number="vadSettings.vadThreshold"
                class="range-input"
              />
              <span class="value">{{ vadSettings.vadThreshold }}</span>
            </div>
            <div class="setting-item">
              <label>Silence Timeout</label>
              <input
                type="range"
                min="800"
                max="3000"
                step="100"
                v-model.number="vadSettings.minSilenceDuration"
                class="range-input"
              />
              <span class="value">{{ vadSettings.minSilenceDuration }}ms</span>
            </div>
          </div>
        </details>
      </div>
    </div>

    <!-- Status Display (Minimal) -->
    <div v-if="isRecording || isProcessing" class="status-minimal">
      <div v-if="isRecording" class="status-item">
        <div class="status-dot recording"></div>
        <span>{{ currentMode === 'continuous' ? 'In Conversation' : 'Recording' }}</span>
        <div v-if="currentMode === 'continuous' && isRecording" 
             :class="['speech-dot', isSpeechDetected ? 'active' : '']"
             :title="isSpeechDetected ? 'Speech detected' : 'Waiting for speech'">
        </div>
      </div>
      <div v-if="isProcessing" class="status-item">
        <div class="status-dot processing"></div>
        <span>{{ currentMode === 'continuous' ? 'Processing & Resuming' : 'Processing' }}</span>
      </div>
    </div>

    <!-- Transcription Result (Clean) -->
    <div v-if="transcription" class="transcription-clean">
      <div class="transcription-header">
        <span class="transcription-label">Voice Input</span>
        <div class="transcription-actions">
          <button @click="useTranscription" class="action-btn primary">
            Use
          </button>
          <button
            @click="submitTranscription"
            v-if="currentMode === 'manual'"
            class="action-btn success"
          >
            Send
          </button>
          <button @click="clearTranscription" class="action-btn secondary">
            Clear
          </button>
        </div>
      </div>
      <div class="transcription-text">
        {{ transcription }}
      </div>
    </div>

    <!-- Error Display (Minimal) -->
    <div v-if="error" class="error-minimal">
      <AlertCircle class="error-icon" />
      <span>{{ error }}</span>
      <button @click="clearError" class="error-dismiss">×</button>
    </div>

    <!-- Settings Toggle -->
    <button
      @click="showSettings = !showSettings"
      class="settings-toggle"
      :class="{ active: showSettings }"
      title="Voice Settings"
    >
      <Settings class="settings-icon" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Mic, Loader2, AlertCircle, Settings } from 'lucide-vue-next';
import audioService, { type VoiceMode } from '@/services/audioService';

const emit = defineEmits<{
  transcription: [text: string];
  submit: [text: string];
  error: [error: string];
}>();

// Voice mode state
const currentMode = ref<'manual' | 'continuous'>('manual');
const showSettings = ref(false);

// VAD settings
const vadSettings = ref({
  vadThreshold: 0.5,
  minSpeechDuration: 250,
  minSilenceDuration: 1500, // 1.5s for natural conversation pauses
  maxSpeechDuration: 30,
  speechPad: 200,
  samplesOverlap: 0.1,
  autoResume: true // Enable auto-resume for seamless conversation
});

// Computed properties from audio service
const isRecording = computed(() => audioService.isRecording.value);
const isProcessing = computed(() => audioService.isProcessing.value);
const isSpeechDetected = computed(() => audioService.isSpeechDetected.value);
const transcription = computed(() => audioService.transcription.value);
const error = computed(() => audioService.error.value);

// Watch VAD settings changes
watch(vadSettings, (newSettings) => {
  audioService.setVoiceMode({
    type: currentMode.value,
    ...newSettings
  });
}, { deep: true });

const getButtonTitle = () => {
  if (isProcessing.value) return 'Processing...';
  if (isRecording.value) return currentMode.value === 'continuous' ? 'Stop Conversation' : 'Stop Recording';
  return currentMode.value === 'continuous' ? 'Start Conversation' : 'Start Recording';
};

const setVoiceMode = (mode: 'manual' | 'continuous') => {
  currentMode.value = mode;
  audioService.setVoiceMode({
    type: mode,
    ...vadSettings.value
  });
};

const toggleRecording = async () => {
  if (isRecording.value) {
    await audioService.stopRecording();
  } else {
    const voiceMode: VoiceMode = {
      type: currentMode.value,
      ...vadSettings.value
    };
    
    const success = await audioService.startRecording(voiceMode);
    if (!success && error.value) {
      emit('error', error.value);
    }
  }
};

const useTranscription = () => {
  if (transcription.value) {
    emit('transcription', transcription.value);
    audioService.clearTranscription();
  }
};

const submitTranscription = () => {
  if (transcription.value) {
    emit('submit', transcription.value);
    audioService.clearTranscription();
  }
};

const clearTranscription = () => {
  audioService.clearTranscription();
};

const clearError = () => {
  audioService.clearError();
};

// Initialize audio service on mount
onMounted(async () => {
  // Set up callbacks for enhanced audio service
  audioService.setCallbacks({
    onTranscription: (text: string) => {
      emit('transcription', text);
    },
    onAutoSubmit: (text: string) => {
      emit('submit', text);
      // Auto-resume is now handled by the enhanced audioService
      console.log('VoiceInput: Auto-submitted text, auto-resume handled by service');
    },
    onError: (error: string) => {
      emit('error', error);
    }
  });

  setVoiceMode('manual');
});

// Cleanup on unmount
onUnmounted(() => {
  audioService.cleanup();
});
</script>

<style scoped>
.voice-input-minimalist {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Main Voice Button */
.voice-main-btn {
  position: relative;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.voice-main-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.voice-main-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Recording State */
.voice-main-btn.recording {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  animation: pulse-recording 2s infinite;
}

@keyframes pulse-recording {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }
}

/* Processing State */
.voice-main-btn.processing {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

/* Continuous Mode Styling */
.voice-main-btn.continuous-mode {
  border: 2px solid rgba(34, 197, 94, 0.5);
}

/* Button Content */
.btn-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon {
  width: 1rem;
  height: 1rem;
}

/* Recording Indicator */
.recording-indicator {
  position: relative;
  width: 1rem;
  height: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulse-dot {
  width: 0.5rem;
  height: 0.5rem;
  background: white;
  border-radius: 50%;
  animation: pulse-dot 1s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

/* Mode Indicator */
.mode-indicator {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 0.75rem;
  height: 0.75rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 50%;
  font-size: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

/* Settings Panel */
.settings-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  z-index: 1000;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 0.75rem;
  min-width: 18rem;
  margin-bottom: 0.5rem;
  max-height: 70vh;
  overflow-y: auto;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.setting-row:last-child {
  margin-bottom: 0;
}

.setting-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

/* Mode Toggle */
.mode-toggle {
  display: flex;
  background: #f3f4f6;
  border-radius: 0.375rem;
  padding: 0.125rem;
}

.mode-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border: none;
  border-radius: 0.25rem;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-btn.active {
  background: white;
  color: #374151;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* Advanced Settings */
.advanced-settings {
  width: 100%;
}

.advanced-settings summary {
  font-size: 0.875rem;
  color: #6b7280;
  cursor: pointer;
  list-style: none;
  padding: 0.25rem 0;
}

.advanced-settings summary::-webkit-details-marker {
  display: none;
}

.advanced-settings summary::before {
  content: '▶';
  display: inline-block;
  margin-right: 0.25rem;
  transition: transform 0.15s ease;
}

.advanced-settings[open] summary::before {
  transform: rotate(90deg);
}

.settings-grid {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.setting-item label {
  font-size: 0.75rem;
  color: #6b7280;
  min-width: 4rem;
}

.range-input {
  flex: 1;
  height: 0.25rem;
  background: #e5e7eb;
  border-radius: 0.125rem;
  outline: none;
  appearance: none;
  cursor: pointer;
}

.range-input::-webkit-slider-thumb {
  appearance: none;
  width: 1rem;
  height: 1rem;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
}

.range-input::-moz-range-thumb {
  width: 1rem;
  height: 1rem;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.value {
  font-size: 0.75rem;
  color: #6b7280;
  min-width: 2rem;
  text-align: right;
}

/* Status Display */
.status-minimal {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}

.status-dot.recording {
  background: #ef4444;
  animation: blink 1s infinite;
}

.status-dot.processing {
  background: #f59e0b;
  animation: spin 1s linear infinite;
}

.speech-dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background: #d1d5db;
  margin-left: 0.25rem;
  transition: background-color 0.15s ease;
}

.speech-dot.active {
  background: #22c55e;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Transcription Result */
.transcription-clean {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  margin-top: 0.25rem;
  overflow: hidden;
}

.transcription-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.transcription-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #374151;
}

.transcription-actions {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn.primary {
  background: #3b82f6;
  color: white;
}

.action-btn.primary:hover {
  background: #2563eb;
}

.action-btn.success {
  background: #22c55e;
  color: white;
}

.action-btn.success:hover {
  background: #16a34a;
}

.action-btn.secondary {
  background: #e5e7eb;
  color: #374151;
}

.action-btn.secondary:hover {
  background: #d1d5db;
}

.transcription-text {
  padding: 0.75rem;
  font-size: 0.875rem;
  color: #374151;
  max-height: 6rem;
  overflow-y: auto;
  white-space: pre-wrap;
}

/* Error Display */
.error-minimal {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #dc2626;
}

.error-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.error-dismiss {
  margin-left: auto;
  background: none;
  border: none;
  color: #dc2626;
  font-size: 1.125rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

/* Settings Toggle */
.settings-toggle {
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  background: #f3f4f6;
  border-radius: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  color: #6b7280;
}

.settings-toggle:hover {
  background: #e5e7eb;
  color: #374151;
}

.settings-toggle.active {
  background: #3b82f6;
  color: white;
}

.settings-icon {
  width: 0.875rem;
  height: 0.875rem;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .settings-panel,
  .transcription-clean {
    background: #1f2937;
    border-color: #374151;
  }
  
  .setting-label,
  .transcription-label,
  .transcription-text {
    color: #d1d5db;
  }
  
  .mode-toggle {
    background: #374151;
  }
  
  .mode-btn {
    color: #9ca3af;
  }
  
  .mode-btn.active {
    background: #4b5563;
    color: #d1d5db;
  }
  
  .transcription-header {
    background: #111827;
    border-bottom-color: #374151;
  }
  
  .settings-toggle {
    background: #374151;
    color: #9ca3af;
  }
  
  .settings-toggle:hover {
    background: #4b5563;
    color: #d1d5db;
  }
  
  .range-input {
    background: #374151;
  }
}
</style>