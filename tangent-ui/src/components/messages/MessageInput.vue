<template>
  <div class="message-input-futuristic" :style="cssVariables">
    <!-- Main input container with expandable controls -->
    <div class="input-shell" :class="{ 'expanded': isExpanded, 'voice-active': isVoiceMode }">
      <!-- Core input area -->
      <div class="input-core">
        <div 
          ref="editableRef"
          contenteditable="true"
          class="input-text"
          :class="{ 'has-content': hasContent, 'loading': isLoading }"
          placeholder="Type your message or speak..."
          @paste="handlePaste"
          @keydown.meta.enter.prevent="handleNewline"
          @keydown.ctrl.enter.prevent="handleNewline"
          @keydown.enter.prevent="handleEnter"
          @keydown.esc="handleEscape"
          @input="handleInput"
          @focus="handleFocus"
          @blur="handleBlur"
        ></div>
        
        <!-- Paste cards container -->
        <div v-if="pastedContent.size > 0" class="paste-cards">
          <!-- Paste cards will be rendered here dynamically -->
        </div>
      </div>

      <!-- Right control panel that slides in/out -->
      <div class="control-panel" :class="{ 'expanded': isExpanded }">
        <!-- Voice control section -->
        <div class="voice-section" :class="{ 'active': isVoiceMode }">
          <!-- Main voice button -->
          <button
            @click="toggleVoiceMode"
            :class="[
              'voice-main-button',
              isRecording ? 'recording' : '',
              isProcessing ? 'processing' : '',
              currentVoiceMode === 'continuous' ? 'continuous' : 'manual'
            ]"
            :title="getVoiceButtonTitle()"
          >
            <div class="voice-icon-container">
              <Mic v-if="!isRecording && !isProcessing" class="voice-icon" />
              <div v-else-if="isRecording" class="recording-pulse">
                <div class="pulse-dot"></div>
              </div>
              <Loader2 v-else class="voice-icon processing-spin" />
            </div>
            
            <!-- Mode indicator ring -->
            <div class="mode-ring" :class="currentVoiceMode">
              <span class="mode-text">{{ currentVoiceMode === 'continuous' ? 'AUTO' : 'MANUAL' }}</span>
            </div>
          </button>

          <!-- Voice mode selector (appears when expanded) -->
          <div v-if="isExpanded" class="voice-mode-selector">
            <button
              @click="setVoiceMode('manual')"
              :class="['mode-option', currentVoiceMode === 'manual' ? 'active' : '']"
            >
              <div class="mode-icon">M</div>
              <span>Manual</span>
            </button>
            <button
              @click="setVoiceMode('continuous')"
              :class="['mode-option', currentVoiceMode === 'continuous' ? 'active' : '']"
            >
              <div class="mode-icon">A</div>
              <span>Auto</span>
            </button>
          </div>

          <!-- Voice settings (continuous mode only) -->
          <div v-if="isExpanded && currentVoiceMode === 'continuous'" class="voice-settings">
            <div class="setting-item">
              <label>Sensitivity</label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                v-model.number="vadSettings.vadThreshold"
                class="setting-slider"
              />
              <span class="setting-value">{{ vadSettings.vadThreshold }}</span>
            </div>
            <div class="setting-item">
              <label>Auto-Send Delay</label>
              <input
                type="range"
                min="800"
                max="3000"
                step="100"
                v-model.number="vadSettings.minSilenceDuration"
                class="setting-slider"
              />
              <span class="setting-value">{{ vadSettings.minSilenceDuration }}ms</span>
            </div>
          </div>
        </div>

        <!-- Utility controls -->
        <div class="utility-section">
          <!-- Token counter -->
          <div class="token-display" :class="{ 'show': hasContent }">
            <TokenCounter :text="getCurrentInputText" size="tiny" :show-icon="false" />
          </div>

          <!-- Expand/collapse toggle -->
          <button
            @click="toggleExpanded"
            class="expand-button"
            :class="{ 'expanded': isExpanded }"
            title="Toggle advanced controls"
          >
            <Settings class="expand-icon" />
          </button>

          <!-- Send/Stop button -->
          <button
            @click="isLoading ? handleStop() : handleSubmit()"
            :disabled="!isLoading && !hasContent"
            class="send-button"
            :class="{ 'loading': isLoading, 'ready': hasContent && !isLoading }"
            :title="isLoading ? 'Stop current request' : 'Send message'"
          >
            <div class="send-icon-container">
              <StopCircle v-if="isLoading" class="send-icon" />
              <Send v-else class="send-icon" />
            </div>
          </button>
        </div>
      </div>

      <!-- Voice status indicator -->
      <div v-if="isRecording || isProcessing" class="voice-status">
        <div class="status-content">
          <div v-if="isRecording" class="status-item">
            <div class="status-indicator recording"></div>
            <span>{{ currentVoiceMode === 'continuous' ? 'Listening...' : 'Recording...' }}</span>
            <div
              v-if="currentVoiceMode === 'continuous'"
              :class="['speech-indicator', isSpeechDetected ? 'active' : '']"
            ></div>
          </div>
          <div v-if="isProcessing" class="status-item">
            <div class="status-indicator processing"></div>
            <span>Processing voice...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Voice transcription result -->
    <transition name="transcription">
      <div v-if="transcription" class="transcription-panel">
        <div class="transcription-header">
          <div class="transcription-title">
            <Mic class="transcription-icon" />
            <span>Voice Input</span>
          </div>
          <div class="transcription-actions">
            <button @click="useTranscription" class="action-button primary">
              <Check class="action-icon" />
              <span>Use</span>
            </button>
            <button
              v-if="currentVoiceMode === 'manual'"
              @click="submitTranscription"
              class="action-button success"
            >
              <Send class="action-icon" />
              <span>Send</span>
            </button>
            <button @click="clearTranscription" class="action-button secondary">
              <X class="action-icon" />
            </button>
          </div>
        </div>
        <div class="transcription-content">
          {{ transcription }}
        </div>
      </div>
    </transition>

    <!-- Error display -->
    <transition name="error">
      <div v-if="voiceError" class="error-panel">
        <AlertCircle class="error-icon" />
        <span>{{ voiceError }}</span>
        <button @click="clearVoiceError" class="error-dismiss">
          <X class="dismiss-icon" />
        </button>
      </div>
    </transition>

    <!-- Preview Portal -->
    <Teleport to="body">
      <div
        v-if="activePreview"
        ref="previewEl"
        class="paste-preview-portal"
        :style="{
          left: previewPosition.left + 'px',
          top: previewPosition.top + 'px',
          opacity: activePreview ? 1 : 0,
        }"
        @mouseenter="keepPreview = true"
        @mouseleave="handlePreviewLeave"
      >
        <div class="preview-content">
          {{ activePreview.content }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, onBeforeUnmount } from 'vue';
import { 
  Mic, 
  Settings, 
  Send, 
  StopCircle, 
  Loader2, 
  Check, 
  X, 
  AlertCircle 
} from 'lucide-vue-next';
import TokenCounter from '@/components/ui/TokenCounter.vue';
import audioService from '@/services/audioService';
import { useThemeStore } from '@/stores/themeStore';

const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['send', 'stop', 'escape']);

// Core state
const editableRef = ref(null);
const inputText = ref('');
const isExpanded = ref(false);
const isVoiceMode = ref(false);
const isFocused = ref(false);

// Voice state
const currentVoiceMode = ref('manual');
const vadSettings = ref({
  vadThreshold: 0.5,
  minSpeechDuration: 250,
  minSilenceDuration: 1200,
  maxSpeechDuration: 30,
  speechPad: 200,
  samplesOverlap: 0.1
});

// Computed from audio service
const isRecording = computed(() => audioService.isRecording.value);
const isProcessing = computed(() => audioService.isProcessing.value);
const isSpeechDetected = computed(() => audioService.isSpeechDetected.value);
const transcription = computed(() => audioService.transcription.value);
const voiceError = computed(() => audioService.error.value);

// Paste functionality
const pastedContent = ref(new Map());
const activePreview = ref(null);
const previewPosition = ref({ left: 0, top: 0 });
const keepPreview = ref(false);
let previewTimeout = null;

// Theme integration
const themeStore = useThemeStore();
const activeTheme = computed(() => themeStore.currentTheme);

// Computed properties
const hasContent = computed(() => {
  return inputText.value.length > 0 || pastedContent.value.size > 0;
});

const getCurrentInputText = computed(() => inputText.value);

// Theme-aware computed properties
const isDarkTheme = computed(() => themeStore.isDarkTheme(activeTheme.value));
const themeColors = computed(() => themeStore.getThemeColors(activeTheme.value));

const cssVariables = computed(() => {
  const colors = themeColors.value;
  const isDark = isDarkTheme.value;
  const theme = activeTheme.value;
  
  // Base colors
  let inputBg = isDark ? 'rgba(31, 41, 55, 0.85)' : 'rgba(255, 255, 255, 0.9)';
  let inputBgSecondary = isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(249, 250, 251, 0.95)';
  let inputBorder = isDark ? 'rgba(75, 85, 99, 0.6)' : 'rgba(229, 231, 235, 0.6)';
  let controlBg = isDark ? 'rgba(17, 24, 39, 0.85)' : 'rgba(248, 250, 252, 0.9)';
  let shadowColor = isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)';
  
  // Theme-specific overrides
  if (theme === 'cyberpunk') {
    inputBg = 'rgba(26, 26, 46, 0.9)';
    inputBgSecondary = 'rgba(22, 33, 62, 0.95)';
    inputBorder = `${colors.primary}60`;
    controlBg = 'rgba(15, 20, 25, 0.9)';
    shadowColor = `${colors.primary}30`;
  } else if (theme === 'synthwave') {
    inputBg = 'rgba(40, 20, 60, 0.85)';
    inputBgSecondary = 'rgba(80, 30, 110, 0.9)';
    inputBorder = `${colors.secondary}50`;
    controlBg = 'rgba(20, 10, 30, 0.9)';
    shadowColor = `${colors.secondary}25`;
  } else if (theme === 'aqua') {
    inputBg = 'rgba(0, 60, 90, 0.8)';
    inputBgSecondary = 'rgba(0, 30, 60, 0.9)';
    inputBorder = `${colors.primary}60`;
    controlBg = 'rgba(0, 40, 70, 0.85)';
    shadowColor = `${colors.primary}20`;
  } else if (theme === 'retro') {
    inputBg = 'rgba(255, 248, 235, 0.9)';
    inputBgSecondary = 'rgba(250, 240, 220, 0.95)';
    inputBorder = `${colors.primary}40`;
    controlBg = 'rgba(245, 235, 215, 0.9)';
    shadowColor = 'rgba(139, 69, 19, 0.15)';
  } else if (theme === 'valentine') {
    inputBg = 'rgba(255, 240, 245, 0.9)';
    inputBgSecondary = 'rgba(255, 228, 240, 0.95)';
    inputBorder = `${colors.primary}40`;
    controlBg = 'rgba(250, 220, 235, 0.9)';
    shadowColor = `${colors.primary}20`;
  } else if (theme === 'cupcake') {
    inputBg = 'rgba(255, 250, 245, 0.9)';
    inputBgSecondary = 'rgba(255, 245, 235, 0.95)';
    inputBorder = `${colors.primary}40`;
    controlBg = 'rgba(250, 240, 230, 0.9)';
    shadowColor = `${colors.primary}15`;
  } else if (theme === 'halloween') {
    // Dark purple and blue theme
    inputBg = 'rgba(15, 10, 25, 0.85)';
    inputBgSecondary = 'rgba(25, 15, 35, 0.9)';
    inputBorder = 'rgba(88, 28, 135, 0.6)';
    controlBg = 'rgba(15, 10, 25, 0.9)';
    shadowColor = 'rgba(88, 28, 135, 0.3)';
  } else if (theme === 'acid') {
    // Dark background with neon accents
    inputBg = 'rgba(20, 20, 20, 0.9)';
    inputBgSecondary = 'rgba(30, 30, 30, 0.95)';
    inputBorder = 'rgba(255, 255, 0, 0.5)';
    controlBg = 'rgba(10, 10, 10, 0.9)';
    shadowColor = 'rgba(0, 255, 0, 0.2)';
  }
  
  return {
    '--input-bg': inputBg,
    '--input-bg-secondary': inputBgSecondary,
    '--input-border': inputBorder,
    '--input-text': isDark ? '#e5e7eb' : '#1f2937',
    '--input-placeholder': isDark ? '#9ca3af' : '#6b7280',
    '--primary-color': colors.primary,
    '--secondary-color': colors.secondary,
    '--accent-color': colors.accent,
    '--control-bg': controlBg,
    '--control-bg-secondary': inputBgSecondary,
    '--button-default': isDark ? 'rgba(75, 85, 99, 0.8)' : 'rgba(243, 244, 246, 0.9)',
    '--button-hover': isDark ? 'rgba(107, 114, 128, 0.9)' : 'rgba(229, 231, 235, 0.9)',
    '--transcription-bg': controlBg,
    '--transcription-border': inputBorder,
    '--error-bg': isDark ? 'rgba(127, 29, 29, 0.9)' : 'rgba(254, 242, 242, 0.95)',
    '--error-border': isDark ? 'rgba(153, 27, 27, 0.6)' : 'rgba(254, 202, 202, 0.6)',
    '--error-text': isDark ? '#fca5a5' : '#dc2626',
    '--shadow-color': shadowColor,
    '--theme-name': theme
  };
});

// Voice functionality
const getVoiceButtonTitle = () => {
  if (isProcessing.value) return 'Processing voice input...';
  if (isRecording.value) return 'Stop recording';
  return `Start voice input (${currentVoiceMode.value} mode)`;
};

const toggleVoiceMode = async () => {
  if (isRecording.value) {
    await audioService.stopRecording();
    isVoiceMode.value = false;
  } else {
    const mode = {
      type: currentVoiceMode.value,
      ...vadSettings.value
    };
    const success = await audioService.startRecording(mode);
    if (success) {
      isVoiceMode.value = true;
    }
  }
};

const setVoiceMode = (mode) => {
  currentVoiceMode.value = mode;
  audioService.setVoiceMode({
    type: mode,
    ...vadSettings.value
  });
};

const useTranscription = () => {
  if (transcription.value && editableRef.value) {
    editableRef.value.textContent = transcription.value;
    handleInput();
    audioService.clearTranscription();
  }
};

const submitTranscription = () => {
  if (transcription.value) {
    if (editableRef.value) {
      editableRef.value.textContent = transcription.value;
      handleInput();
    }
    audioService.clearTranscription();
    setTimeout(() => handleSubmit(), 0);
  }
};

const clearTranscription = () => {
  audioService.clearTranscription();
};

const clearVoiceError = () => {
  audioService.clearError();
};

// UI controls
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const handleFocus = () => {
  isFocused.value = true;
};

const handleBlur = () => {
  isFocused.value = false;
  if (!isVoiceMode.value && !transcription.value) {
    isExpanded.value = false;
  }
};

// Input handling
const handleInput = () => {
  if (editableRef.value) {
    inputText.value = editableRef.value.textContent || '';
    
    // Auto-adjust height based on content
    const el = editableRef.value;
    el.style.height = 'auto'; // Reset height to calculate new height
    
    // Calculate the scroll height but limit to 4 lines (6rem)
    const newHeight = Math.min(el.scrollHeight, 96); // 96px = 6rem = 4 lines
    el.style.height = newHeight + 'px';
  }
};

const handleSubmit = () => {
  if (props.isLoading || !hasContent.value) return;

  const plainTextContent = editableRef.value?.textContent.trim() || '';
  const pasteCardElements = editableRef.value?.querySelectorAll('[data-paste-id]');

  if (pasteCardElements && pasteCardElements.length > 0) {
    let message = plainTextContent;
    const pasteEntries = [];

    pasteCardElements.forEach((card, index) => {
      const pasteId = card.dataset.pasteId;
      const pasteContent = pastedContent.value.get(pasteId) || '';
      const wordCount = pasteContent.trim().split(/\s+/).length;

      message += `\n[Paste ${index + 1}: ${wordCount} words]`;

      pasteEntries.push({
        pasteId,
        content: pasteContent,
        preview: pasteContent.substring(0, 120) + (pasteContent.length > 120 ? '...' : ''),
        wordCount
      });
    });

    emit('send', { text: message, pasteEntries });
  } else {
    emit('send', plainTextContent);
  }

  // Reset
  editableRef.value.textContent = '';
  inputText.value = '';
  pastedContent.value.clear();
  handleInput();
};

const handleStop = () => {
  emit('stop');
};

const handleEnter = (event) => {
  if (event.shiftKey) {
    handleNewline();
    return;
  }
  event.preventDefault();
  handleSubmit();
};

const handleNewline = () => {
  document.execCommand('insertLineBreak');
};

const handleEscape = (event) => {
  event.preventDefault();
  if (editableRef.value) {
    editableRef.value.blur();
  }
  emit('escape');
};

// Paste handling (simplified for now)
const handlePaste = (event) => {
  event.preventDefault();
  const pastedText = event.clipboardData.getData('text');
  const wordCount = pastedText.trim().split(/\s+/).length;

  if (wordCount > 100) {
    const pasteId = Date.now().toString();
    pastedContent.value.set(pasteId, pastedText);
    
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const card = createPasteCard(wordCount, pasteId, pastedText);
    range.insertNode(card);
    
    range.setStartAfter(card);
    range.setEndAfter(card);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    document.execCommand('insertText', false, pastedText);
  }
};

const createPasteCard = (wordCount, id, content) => {
  const card = document.createElement('span');
  card.contentEditable = 'false';
  card.className = 'paste-card';
  card.dataset.pasteId = id;
  card.innerHTML = `
    <span class="paste-word-count">${wordCount} words</span>
    <button class="paste-remove" onclick="this.parentElement.remove()">×</button>
  `;
  return card;
};

const handlePreviewLeave = () => {
  keepPreview.value = false;
  if (!previewTimeout) {
    previewTimeout = setTimeout(() => {
      activePreview.value = null;
    }, 100);
  }
};

// Watch VAD settings
watch(vadSettings, (newSettings) => {
  audioService.setVoiceMode({
    type: currentVoiceMode.value,
    ...newSettings
  });
}, { deep: true });

// Watch transcription for auto-submit in continuous mode
watch(transcription, (newTranscription) => {
  if (newTranscription && currentVoiceMode.value === 'continuous') {
    console.log('Auto-submitting transcription in continuous mode:', newTranscription);
    setTimeout(() => {
      submitTranscription();
      // Restart recording after auto-submit
      setTimeout(async () => {
        if (currentVoiceMode.value === 'continuous') {
          console.log('Restarting continuous recording...');
          const mode = {
            type: 'continuous',
            ...vadSettings.value
          };
          await audioService.startRecording(mode);
        }
      }, 100);
    }, 300);
  }
});

// Setup audio service callbacks
onMounted(async () => {
  audioService.setCallbacks({
    onTranscription: (text) => {
      console.log('Transcription received:', text);
      // Handled by the transcription watcher
    },
    onAutoSubmit: (text) => {
      console.log('Auto-submit callback triggered:', text);
      // For continuous mode, submit immediately
      if (currentVoiceMode.value === 'continuous') {
        if (editableRef.value) {
          editableRef.value.textContent = text;
          handleInput();
        }
        setTimeout(() => handleSubmit(), 50);
        
        // Restart recording after auto-submit
        setTimeout(async () => {
          if (currentVoiceMode.value === 'continuous') {
            console.log('Restarting continuous recording after auto-submit...');
            const mode = {
              type: 'continuous',
              ...vadSettings.value
            };
            await audioService.startRecording(mode);
          }
        }, 200);
      }
    },
    onError: (error) => {
      console.error('Voice error:', error);
    }
  });
  
  setVoiceMode('manual');
});

onUnmounted(() => {
  audioService.cleanup();
  if (previewTimeout) {
    clearTimeout(previewTimeout);
  }
});

// Method to insert text into the input
const insertText = (text) => {
  if (editableRef.value) {
    const currentText = editableRef.value.textContent || '';
    editableRef.value.textContent = currentText + text;
    handleInput();
    // Focus and place cursor at the end
    editableRef.value.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(editableRef.value);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
};

defineExpose({
  isFocused: () => isFocused.value,
  insertText
});
</script>

<style scoped>
.message-input-futuristic {
  position: relative;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--input-border);
  transition: all 0.3s ease;
}

/* Theme-specific container styles */
.message-input-futuristic[style*="--theme-name: cyberpunk"] {
  filter: drop-shadow(0 0 8px var(--shadow-color));
}

.message-input-futuristic[style*="--theme-name: synthwave"] {
  background: linear-gradient(45deg, transparent, var(--shadow-color));
  border-radius: 1rem;
}

.message-input-futuristic[style*="--theme-name: aqua"] {
  background: radial-gradient(circle at center, var(--shadow-color), transparent 70%);
  border-radius: 1rem;
}

.input-shell {
  position: relative;
  display: flex;
  align-items: flex-start;
  background: linear-gradient(135deg, var(--input-bg), var(--input-bg-secondary));
  backdrop-filter: blur(16px);
  border: 1px solid var(--input-border);
  border-radius: 1rem;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: 0 4px 20px var(--shadow-color);
}

/* Theme-specific input shell styles */
.input-shell[style*="cyberpunk"] {
  border: 2px solid var(--primary-color);
  box-shadow: 0 0 20px var(--shadow-color), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  position: relative;
}

.input-shell[style*="cyberpunk"]::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(45deg, transparent 30%, var(--primary-color)10, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  border-radius: inherit;
}

.input-shell[style*="cyberpunk"]:hover::before {
  opacity: 1;
}

.input-shell[style*="synthwave"] {
  background: linear-gradient(135deg, var(--input-bg), var(--secondary-color)20);
  border: 1px solid var(--secondary-color);
  box-shadow: 0 0 25px var(--shadow-color);
}

.input-shell[style*="retro"] {
  border: 3px solid var(--primary-color);
  border-style: double;
  background: linear-gradient(135deg, var(--input-bg), var(--input-bg-secondary));
  box-shadow: 4px 4px 0 var(--primary-color)40;
}

.input-shell[style*="valentine"],
.input-shell[style*="cupcake"] {
  border-radius: 1.5rem;
  border: 2px solid var(--primary-color)60;
  background: linear-gradient(135deg, var(--input-bg), var(--primary-color)10);
  box-shadow: 0 8px 32px var(--shadow-color);
}

.input-shell.expanded {
  border-radius: 1.25rem;
  box-shadow: 0 12px 40px var(--shadow-color);
  transform: translateY(-2px);
}

.input-shell.expanded[style*="cyberpunk"] {
  box-shadow: 0 0 30px var(--primary-color)60, 0 12px 40px var(--shadow-color);
}

.input-shell.expanded[style*="synthwave"] {
  box-shadow: 0 0 35px var(--secondary-color)40, 0 12px 40px var(--shadow-color);
}

.input-shell.expanded[style*="retro"] {
  box-shadow: 6px 6px 0 var(--primary-color)40, 0 12px 40px var(--shadow-color);
  transform: translateY(-2px) translateX(-2px);
}

.input-shell.voice-active {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 15%, transparent), 0 8px 32px var(--shadow-color);
  animation: voice-active-pulse 2s infinite;
}

@keyframes voice-active-pulse {
  0%, 100% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 15%, transparent), 0 8px 32px var(--shadow-color);
  }
  50% {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--primary-color) 25%, transparent), 0 12px 40px var(--shadow-color);
  }
}

.input-core {
  flex: 1;
  min-height: 2.5rem;
  padding: 0.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-text {
  min-height: 1.5rem;
  max-height: 6rem; /* 4 lines max (1.5rem * 4) */
  overflow-y: auto;
  outline: none;
  color: var(--input-text);
  font-size: 0.875rem;
  line-height: 1.5;
  word-wrap: break-word;
  resize: none;
  transition: height 0.2s ease;
}

.input-text:empty:before {
  content: attr(placeholder);
  color: var(--input-placeholder);
  pointer-events: none;
}

.control-panel {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0.5rem;
  gap: 0.5rem;
  min-width: 3rem;
  transition: all 0.3s ease;
}

.control-panel.expanded {
  min-width: 12rem;
  background: linear-gradient(135deg, var(--control-bg), var(--control-bg-secondary));
  flex-direction: row;
  justify-content: flex-end;
  border-left: 1px solid var(--input-border);
  border-radius: 0 1.25rem 1.25rem 0;
}

/* Voice Section */
.voice-section {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  width: auto;
}

.voice-main-button {
  position: relative;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color), color-mix(in srgb, var(--primary-color) 80%, black));
  color: white;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px color-mix(in srgb, var(--primary-color) 30%, transparent);
}

/* Theme-specific voice button styles */
.voice-main-button[style*="cyberpunk"] {
  box-shadow: 0 0 20px var(--primary-color)60, 0 6px 20px color-mix(in srgb, var(--primary-color) 30%, transparent);
}

.voice-main-button[style*="retro"] {
  border: 2px solid color-mix(in srgb, var(--primary-color) 80%, white);
  box-shadow: 2px 2px 0 var(--primary-color)80, 0 6px 20px color-mix(in srgb, var(--primary-color) 30%, transparent);
}

.voice-main-button[style*="valentine"],
.voice-main-button[style*="cupcake"] {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  box-shadow: 0 8px 25px color-mix(in srgb, var(--primary-color) 25%, transparent);
}

.voice-main-button:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px color-mix(in srgb, var(--primary-color) 40%, transparent);
}

.voice-main-button.recording {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  animation: voice-pulse 2s infinite;
}

.voice-main-button.processing {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.voice-main-button.continuous {
  border: 2px solid rgba(34, 197, 94, 0.6);
}

@keyframes voice-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
  }
}

.voice-icon-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.voice-icon {
  width: 1rem;
  height: 1rem;
}

.recording-pulse {
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

.processing-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.mode-ring {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5rem;
  font-weight: 600;
  color: white;
}

.mode-ring.continuous {
  background: rgba(34, 197, 94, 0.9);
}

.mode-text {
  font-size: 0.375rem;
  letter-spacing: 0.025em;
}

.voice-mode-selector {
  display: flex;
  gap: 0.5rem;
  width: auto;
}

.mode-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem;
  border: 1px solid rgba(229, 231, 235, 0.5);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  color: #6b7280;
}

.mode-option.active {
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  border-color: color-mix(in srgb, var(--primary-color) 30%, transparent);
  color: var(--primary-color);
}

.mode-icon {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: currentColor;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
}

.voice-settings {
  width: auto;
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(249, 250, 251, 0.6);
  border-radius: 0.5rem;
  border: 1px solid rgba(229, 231, 235, 0.3);
}

.setting-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.setting-item label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.setting-slider {
  width: 100%;
  height: 0.25rem;
  background: #e5e7eb;
  border-radius: 0.125rem;
  outline: none;
  appearance: none;
  cursor: pointer;
}

.setting-slider::-webkit-slider-thumb {
  appearance: none;
  width: 1rem;
  height: 1rem;
  background: var(--primary-color);
  border-radius: 50%;
  cursor: pointer;
}

.setting-value {
  font-size: 0.75rem;
  color: #9ca3af;
  text-align: center;
}

/* Utility Section */
.utility-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.token-display {
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s ease;
}

.token-display.show {
  opacity: 1;
  transform: scale(1);
}

.expand-button {
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 0.5rem;
  background: var(--button-default);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: var(--input-text);
}

.expand-button:hover {
  background: var(--button-hover);
}

.expand-button.expanded {
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  color: var(--primary-color);
}

.expand-icon {
  width: 0.875rem;
  height: 0.875rem;
  transition: transform 0.2s ease;
}

.expand-button.expanded .expand-icon {
  transform: rotate(45deg);
}

.send-button {
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--button-default), var(--button-hover));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--input-text);
  box-shadow: 0 4px 12px var(--shadow-color);
  position: relative;
  overflow: hidden;
}

.send-button::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}

.send-button:hover::before {
  transform: translateX(100%);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-button.ready {
  background: linear-gradient(135deg, var(--accent-color), color-mix(in srgb, var(--accent-color) 80%, black));
  box-shadow: 0 6px 20px color-mix(in srgb, var(--accent-color) 30%, transparent);
  color: white;
  transform: scale(1.05);
}

.send-button.ready[style*="cyberpunk"] {
  box-shadow: 0 0 15px var(--accent-color)80, 0 6px 20px color-mix(in srgb, var(--accent-color) 30%, transparent);
}

.send-button.ready[style*="retro"] {
  border: 2px solid rgba(255, 255, 255, 0.8);
  box-shadow: 2px 2px 0 var(--accent-color)80, 0 6px 20px color-mix(in srgb, var(--accent-color) 30%, transparent);
}

.send-button.ready:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
}

.send-button.loading {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.send-icon {
  width: 1rem;
  height: 1rem;
}

/* Status and transcription */
.voice-status {
  position: absolute;
  top: -2.5rem;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
}

.status-content {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-indicator {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}

.status-indicator.recording {
  background: #ef4444;
  animation: blink 1s infinite;
}

.status-indicator.processing {
  background: #f59e0b;
  animation: spin 1s linear infinite;
}

.speech-indicator {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background: #6b7280;
  transition: background-color 0.2s ease;
}

.speech-indicator.active {
  background: #22c55e;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}

.transcription-panel {
  margin-top: 0.75rem;
  background: var(--transcription-bg);
  border: 1px solid var(--transcription-border);
  border-radius: 0.75rem;
  overflow: hidden;
  backdrop-filter: blur(12px);
  box-shadow: 0 6px 25px var(--shadow-color);
  transform: translateY(0);
}

.transcription-panel[style*="cyberpunk"] {
  border: 1px solid var(--primary-color)60;
  box-shadow: 0 0 15px var(--primary-color)30, 0 6px 25px var(--shadow-color);
}

.transcription-panel[style*="retro"] {
  border: 2px solid var(--primary-color);
  border-style: solid;
  box-shadow: 3px 3px 0 var(--primary-color)40, 0 6px 25px var(--shadow-color);
}

.transcription-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--control-bg);
  border-bottom: 1px solid var(--input-border);
}

.transcription-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--input-text);
}

.transcription-icon {
  width: 1rem;
  height: 1rem;
}

.transcription-actions {
  display: flex;
  gap: 0.5rem;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button.primary {
  background: linear-gradient(135deg, var(--primary-color), color-mix(in srgb, var(--primary-color) 80%, black));
  color: white;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--primary-color) 25%, transparent);
}

.action-button.primary:hover {
  background: #2563eb;
}

.action-button.success {
  background: linear-gradient(135deg, var(--accent-color), color-mix(in srgb, var(--accent-color) 80%, black));
  color: white;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--accent-color) 25%, transparent);
}

.action-button.success:hover {
  background: #16a34a;
}

.action-button.secondary {
  background: #e5e7eb;
  color: #374151;
}

.action-button.secondary:hover {
  background: #d1d5db;
}

.action-icon {
  width: 0.75rem;
  height: 0.75rem;
}

.transcription-content {
  padding: 1rem;
  font-size: 0.875rem;
  color: var(--input-text);
  max-height: 6rem;
  overflow-y: auto;
  white-space: pre-wrap;
}

.error-panel {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--error-bg);
  border: 1px solid var(--error-border);
  border-radius: 0.75rem;
  color: var(--error-text);
  font-size: 0.875rem;
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
  color: var(--error-text);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: background-color 0.2s ease;
}

.error-dismiss:hover {
  background: color-mix(in srgb, var(--error-text) 10%, transparent);
}

.dismiss-icon {
  width: 0.875rem;
  height: 0.875rem;
}

/* Enhanced Animations */
.transcription-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.transcription-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.transcription-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.transcription-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

.transcription-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.error-enter-active,
.error-leave-active {
  transition: all 0.3s ease;
}

.error-enter-from,
.error-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Paste functionality */
.paste-card {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  margin: 0 0.25rem;
  background: rgba(243, 244, 246, 0.8);
  border: 1px solid rgba(229, 231, 235, 0.5);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.paste-card:hover {
  background: rgba(229, 231, 235, 0.8);
}

.paste-word-count {
  font-weight: 500;
}

.paste-remove {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  margin-left: 0.25rem;
}

.paste-remove:hover {
  color: #ef4444;
}

.paste-preview-portal {
  position: fixed;
  z-index: 9999;
  max-width: 24rem;
  width: 90vw;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  transform: translateY(-100%) translateY(-8px);
  transition: opacity 150ms ease, transform 150ms ease;
}

.preview-content {
  padding: 1rem;
  font-size: 0.875rem;
  color: var(--input-text);
  max-height: 12rem;
  overflow-y: auto;
  white-space: pre-wrap;
}

/* Responsive design */
@media (max-width: 768px) {
  .control-panel.expanded {
    min-width: 10rem;
  }
  
  .voice-settings {
    padding: 0.5rem;
  }
  
  .setting-item {
    gap: 0.125rem;
  }
  
  .voice-mode-selector {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .mode-option {
    padding: 0.375rem 0.5rem;
  }
}

@media (max-width: 480px) {
  .input-shell {
    border-radius: 0.75rem;
  }
  
  .control-panel.expanded {
    min-width: 8rem;
  }
  
  .voice-main-button {
    width: 2rem;
    height: 2rem;
  }
  
  .send-button {
    width: 2rem;
    height: 2rem;
  }
  
  .transcription-panel {
    margin-top: 0.5rem;
  }
}

/* Focus and interaction enhancements */
.input-text:focus {
  outline: none;
}

.input-shell:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent), 0 8px 32px var(--shadow-color);
}

/* Accessibility improvements */
@media (prefers-reduced-motion: reduce) {
  .input-shell,
  .voice-main-button,
  .send-button,
  .transcription-panel,
  .action-button {
    transition: none;
  }
  
  .voice-main-button.recording {
    animation: none;
  }
  
  .input-shell.voice-active {
    animation: none;
  }
}

/* Theme-specific micro-interactions */
.expand-button:active {
  transform: scale(0.95);
}

.voice-main-button:active {
  transform: scale(0.95);
}

.send-button:active {
  transform: scale(0.95);
}

.action-button:active {
  transform: scale(0.98);
}

/* Smooth hover transitions for all interactive elements */
.mode-option:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--shadow-color);
}

.setting-slider:hover {
  background: color-mix(in srgb, var(--primary-color) 10%, #e5e7eb);
}

.paste-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--shadow-color);
}

/* Advanced theme-specific animations */
@keyframes cyberpunk-glow {
  0%, 100% {
    box-shadow: 0 0 20px var(--primary-color)30;
  }
  50% {
    box-shadow: 0 0 30px var(--primary-color)60;
  }
}

.input-shell[style*="cyberpunk"]:focus-within {
  animation: cyberpunk-glow 2s infinite;
}

@keyframes retro-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}

.send-button.ready[style*="retro"]:hover {
  animation: retro-bounce 0.6s ease-in-out;
}

/* Halloween theme specific styles */
.message-input-futuristic[style*="halloween"] .input-shell {
  background: linear-gradient(135deg, var(--input-bg) 0%, rgba(59, 130, 246, 0.2) 100%);
  border-color: rgba(124, 58, 237, 0.6);
}

.message-input-futuristic[style*="halloween"] .voice-main-button.recording {
  background: radial-gradient(circle, rgba(124, 58, 237, 0.9), rgba(88, 28, 135, 0.8));
  box-shadow: 0 0 20px rgba(124, 58, 237, 0.6), inset 0 0 10px rgba(88, 28, 135, 0.4);
}

.message-input-futuristic[style*="halloween"] .send-button.ready {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.9), rgba(88, 28, 135, 0.8));
  border-color: rgba(124, 58, 237, 0.8);
}

.message-input-futuristic[style*="halloween"] .send-button.ready:hover {
  box-shadow: 0 0 20px rgba(124, 58, 237, 0.5), 0 0 30px rgba(59, 130, 246, 0.3);
}

/* Acid theme specific styles */
.message-input-futuristic[style*="acid"] .input-shell {
  background: var(--input-bg);
  border: 2px solid;
  border-image: linear-gradient(45deg, #FF00FF, #00FF00, #FFFF00, #FF00FF) 1;
}

.message-input-futuristic[style*="acid"] .voice-main-button.recording {
  background: radial-gradient(circle, rgba(255, 0, 255, 0.9), rgba(0, 255, 0, 0.8));
  box-shadow: 0 0 25px rgba(255, 255, 0, 0.6), inset 0 0 15px rgba(255, 0, 255, 0.4);
  animation: acid-pulse 1s ease-in-out infinite;
}

@keyframes acid-pulse {
  0%, 100% { filter: hue-rotate(0deg); }
  50% { filter: hue-rotate(180deg); }
}

.message-input-futuristic[style*="acid"] .send-button.ready {
  background: linear-gradient(135deg, #FF00FF, #00FF00);
  border: 2px solid #FFFF00;
}

.message-input-futuristic[style*="acid"] .send-button.ready:hover {
  box-shadow: 0 0 25px rgba(255, 255, 0, 0.6), 0 0 35px rgba(0, 255, 0, 0.4);
  animation: acid-pulse 0.5s ease-in-out infinite;
}

.message-input-futuristic[style*="acid"] .action-button {
  border-color: rgba(255, 255, 0, 0.5);
}

.message-input-futuristic[style*="acid"] .action-button:hover {
  background: rgba(255, 255, 0, 0.1);
  border-color: rgba(255, 255, 0, 0.8);
  box-shadow: 0 0 15px rgba(255, 255, 0, 0.4);
}

</style>