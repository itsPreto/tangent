<template>
  <div class="agent-configurator-panel" :style="panelStyle">
    <!-- Compact Header with Tabs -->
    <div class="panel-header" :style="navTabsStyle">
      <div class="nav-tabs-compact">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="nav-tab-compact"
          :class="{ active: activeTab === tab.id }"
          :style="getTabStyle(activeTab === tab.id)"
        >
          <component :is="tab.icon" class="w-3.5 h-3.5" />
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>
    </div>

    <!-- Optimized Content Area -->
    <div class="content-area-optimized">
      <!-- Models Tab - Optimized Layout -->
      <div v-if="activeTab === 'models'" class="tab-content-optimized">
        <!-- Compact Controls Section -->
        <div class="controls-section" :style="cardStyle">
          <div class="controls-row">
            <div class="control-group">
              <label class="control-label">Provider</label>
              <select v-model="activeProvider" @change="setActiveProvider(activeProvider)" 
                      class="control-select" :style="inputStyle">
                <option value="ollama">Ollama</option>
                <option value="openrouter">OpenRouter</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
              </select>
            </div>
            
            <div v-if="activeProvider !== 'ollama'" class="control-group api-key-group">
              <label class="control-label">API Key</label>
              <div class="api-key-compact">
                <input v-model="apiKey" type="password" 
                       class="control-input" :style="inputStyle"
                       :placeholder="getApiKeyPlaceholder(activeProvider)" />
                <button @click="saveApiKey" class="save-btn-compact" :style="saveButtonStyle">
                  <Key class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <!-- Search and Filters Row -->
          <div class="search-filter-row">
            <div class="search-compact">
              <Search class="search-icon-compact w-3 h-3" />
              <input v-model="searchQuery" type="text" placeholder="Search models..."
                     class="search-input-compact" :style="inputStyle" />
            </div>
            <div class="filters-compact">
              <button v-for="filter in quickFilters" :key="filter.id"
                      @click="toggleFilter(filter.id)"
                      class="filter-chip-compact"
                      :style="getFilterChipStyle(filter.id)">
                {{ filter.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Selected Model Display - Compact -->
        <div v-if="selectedModel" class="selected-model-compact" :style="selectedModelCardStyle">
          <div class="selected-model-content">
            <img :src="getProviderIcon(selectedModel.source)" class="selected-model-icon" />
            <div class="selected-model-info">
              <div class="selected-model-name">{{ selectedModel.name }}</div>
              <div class="selected-model-meta">
                <span v-if="selectedModel.parameterSize" class="model-size-badge">{{ selectedModel.parameterSize }}</span>
                <span class="model-family-badge">{{ selectedModel.family || 'Current' }}</span>
              </div>
            </div>
            <Check class="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        <!-- Models List - Compact Grid -->
        <div class="models-section" :style="cardStyle">
          <!-- Loading State -->
          <div v-if="isLoading" class="loading-state-compact">
            <Loader class="w-4 h-4 animate-spin" />
            <span class="loading-text">Loading...</span>
          </div>

          <!-- Empty State -->
          <div v-else-if="filteredModels.length === 0" class="empty-state-compact">
            <AlertCircle class="w-5 h-5 opacity-40" />
            <span class="empty-text">No models found</span>
          </div>

          <!-- Compact Model Grid -->
          <div v-else class="models-grid-compact">
            <div v-for="model in filteredModels" :key="model.id"
                 @click="selectModel(model)"
                 class="model-card-compact"
                 :style="getModelCardStyle(model)">
              
              <div class="model-header-compact">
                <img :src="getProviderIcon(model.source)" class="model-provider-icon-compact" />
                <div class="model-info-compact">
                  <div class="model-name-compact">{{ model.name }}</div>
                  <div class="model-meta-compact">
                    <span v-if="model.parameterSize" class="param-size">{{ model.parameterSize }}</span>
                    <span v-if="model.size" class="file-size">{{ formatFileSize(model.size) }}</span>
                  </div>
                </div>
                <div v-if="isModelSelected(model)" class="selected-check-compact">
                  <Check class="w-3 h-3 text-emerald-400" />
                </div>
              </div>

              <!-- Compact Tags -->
              <div v-if="model.capabilities?.length || model.quantization" class="model-tags-compact">
                <span v-if="model.quantization" class="tag-compact tag-quant">{{ model.quantization }}</span>
                <span v-for="capability in (model.capabilities || []).slice(0, 1)" 
                      :key="capability" class="tag-compact tag-cap">{{ capability }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TTS Tab - Compact -->
      <div v-if="activeTab === 'tts'" class="tab-content-optimized">
        <div class="tts-section" :style="cardStyle">
          <!-- TTS Toggle -->
          <div class="tts-header">
            <div class="tts-title">
              <Mic class="w-4 h-4" />
              <span>Text-to-Speech</span>
            </div>
            <label class="toggle-label-compact">
              <input type="checkbox" v-model="ttsSettings.enabled" @change="updateTTSSettings" 
                     class="toggle-input" />
              <span class="toggle-slider-compact" :style="toggleSliderStyle"></span>
            </label>
          </div>

          <div v-if="ttsSettings.enabled" class="tts-controls-compact">
            <!-- Voice and Speed Row -->
            <div class="tts-controls-row">
              <div class="control-group">
                <label class="control-label">Voice</label>
                <select v-model="ttsSettings.voice" @change="updateTTSSettings"
                        class="control-select" :style="inputStyle">
                  <option v-for="voice in voices" :key="voice.id" :value="voice.id">
                    {{ voice.name }}
                  </option>
                </select>
              </div>

              <div class="control-group">
                <label class="control-label">Speed: {{ ttsSettings.speed.toFixed(1) }}x</label>
                <div class="speed-slider-compact">
                  <input type="range" v-model.number="ttsSettings.speed" @input="updateTTSSettings"
                         min="0.5" max="2.0" step="0.1" class="range-slider-compact" :style="rangeSliderStyle" />
                </div>
              </div>
            </div>

            <!-- Auto-read and Test Row -->
            <div class="tts-actions-row">
              <div class="auto-read-compact">
                <span class="auto-read-label">Auto-read</span>
                <label class="toggle-label-compact">
                  <input type="checkbox" v-model="ttsSettings.autoRead" @change="updateTTSSettings" 
                         class="toggle-input" />
                  <span class="toggle-slider-compact" :style="toggleSliderStyle"></span>
                </label>
              </div>

              <button @click="testVoice" :disabled="isTesting" 
                      class="test-btn-compact" :style="testButtonStyle">
                <Volume2 v-if="!isTesting" class="w-3 h-3" />
                <Loader v-else class="w-3 h-3 animate-spin" />
                <span>{{ isTesting ? 'Testing...' : 'Test' }}</span>
              </button>
            </div>

            <!-- Error Display -->
            <div v-if="error" class="error-compact" :style="errorCardStyle">
              <AlertCircle class="w-3 h-3 text-red-400" />
              <span class="error-text-compact">{{ error }}</span>
            </div>

            <!-- TTS Info -->
            <div class="info-compact" :style="infoCardStyle">
              <Info class="w-3 h-3 text-blue-400" />
              <span class="info-text-compact">Kokoro TTS • {{ voices.length }} voices • 24kHz</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Tab -->
      <div v-if="activeTab === 'settings'" class="tab-content">
        <div class="section-card" :style="cardStyle">
          <div class="section-header">
            <h3 class="section-title">Theme & Appearance</h3>
            <p class="section-subtitle">Customize the visual appearance</p>
          </div>

          <div class="theme-selector">
            <label class="form-label">Theme</label>
            <select :value="currentTheme" @change="(e) => { currentTheme = e.target.value; changeTheme(); }" 
                    class="form-select" :style="inputStyle">
              <option v-for="theme in availableThemes" :key="theme" :value="theme">
                {{ formatThemeName(theme) }}
              </option>
            </select>
          </div>

          <div class="theme-preview" :style="themePreviewStyle">
            <div class="preview-colors">
              <div class="color-swatch" :style="{ backgroundColor: themeColors.primary }"></div>
              <div class="color-swatch" :style="{ backgroundColor: themeColors.secondary }"></div>
              <div class="color-swatch" :style="{ backgroundColor: themeColors.accent }"></div>
            </div>
            <span class="preview-text">{{ formatThemeName(currentTheme) }} Theme</span>
          </div>
        </div>

        <div class="section-card" :style="cardStyle">
          <div class="section-header">
            <h3 class="section-title">Connection Status</h3>
            <p class="section-subtitle">Service connectivity information</p>
          </div>

          <div class="connection-status">
            <div class="status-item">
              <div class="status-dot" :class="{ 'connected': ollamaStatus === 'connected' }"></div>
              <span class="status-name">Ollama Service</span>
              <span class="status-value">{{ ollamaStatus === 'connected' ? 'Connected' : 'Disconnected' }}</span>
            </div>
          </div>

          <div class="connection-info" :style="infoCardStyle">
            <AlertCircle v-if="ollamaStatus !== 'connected'" class="w-4 h-4 text-amber-400" />
            <CheckCircle v-else class="w-4 h-4 text-emerald-400" />
            <span class="connection-text">
              {{ ollamaStatus === 'connected' 
                ? 'Ready to use local models for processing' 
                : 'Please ensure Ollama is running on port 11434' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Notification -->
    <Teleport to="body">
      <transition name="notification">
        <div v-if="notification.show" class="notification" :style="notificationStyle">
          <Check class="w-4 h-4 text-emerald-400" />
          <span>{{ notification.message }}</span>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, reactive } from 'vue';
import { 
  X, Search, Check, AlertCircle, Loader, Key, Volume2, Info, CheckCircle,
  Database, Settings as SettingsIcon, Mic, Palette
} from 'lucide-vue-next';
import { useModelStore } from '@/stores/modelStore';
import { useThemeStore, type ThemeName } from '@/stores/themeStore';
import ttsService, { type TTSSettings } from '@/services/ttsService';

// Default images
import ollamaIcon from '@/assets/ollama.jpeg';
import googleIcon from '@/assets/google.jpeg';
import anthropicIcon from '@/assets/anthropic.jpeg';
import openRouterIcon from '@/assets/unknown.jpeg';
import openAIIcon from '@/assets/openai.jpeg';
import customIcon from '@/assets/unknown.jpeg';

const props = defineProps({
  isOpen: Boolean,
  currentModel: Object
});

const emit = defineEmits(['close', 'model-selected', 'api-key-saved']);

// Stores
const modelStore = useModelStore();
const themeStore = useThemeStore();

// State
const activeTab = ref('models');
const searchQuery = ref('');
const activeProvider = ref('ollama');
const apiKey = ref('');
const activeFilters = ref(new Set());
const enhancedModels = ref([]);
const ollamaStatus = ref('disconnected');
const isTesting = ref(false);

// Notification system
const notification = ref({
  show: false,
  message: ''
});

// Navigation tabs
const tabs = [
  { id: 'models', label: 'Models', icon: Database },
  { id: 'tts', label: 'TTS', icon: Mic },
  { id: 'settings', label: 'Settings', icon: SettingsIcon }
];

// TTS Settings - Local reactive copy
const ttsSettings = reactive({
  voice: ttsService.settings.voice,
  speed: ttsService.settings.speed,
  autoRead: ttsService.settings.autoRead,
  enabled: ttsService.settings.enabled
});

// Get voices from TTS service
const voices = computed(() => ttsService.voices.value);
const error = computed(() => ttsService.error.value);

// Theme - properly sync with store
const currentTheme = ref(themeStore.currentTheme);
const availableThemes = computed(() => themeStore.availableThemes);
const themeColors = computed(() => themeStore.getThemeColors(currentTheme.value));
const isDarkTheme = computed(() => themeStore.isDarkTheme(currentTheme.value));

// Selected model
const selectedModel = ref(
  props.currentModel ||
  (localStorage.getItem('selectedModel') ? JSON.parse(localStorage.getItem('selectedModel')) : null)
);

// Quick filters
const quickFilters = [
  { id: 'text', label: 'Text' },
  { id: 'vision', label: 'Vision' },
  { id: 'code', label: 'Code' },
  { id: 'small', label: 'Small' },
  { id: 'large', label: 'Large' }
];

// Computed
const isLoading = computed(() => modelStore.loading[activeProvider.value]);

const filteredModels = computed(() => {
  let models = activeProvider.value === 'ollama' ? 
    enhancedModels.value : 
    modelStore.getFilteredModels(activeProvider.value, '') || [];

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    models = models.filter(model =>
      model.name.toLowerCase().includes(query) ||
      model.family?.toLowerCase().includes(query)
    );
  }

  // Apply active filters
  if (activeFilters.value.size > 0) {
    models = models.filter(model => {
      if (activeFilters.value.has('text')) {
        return !model.capabilities?.includes('vision') && !model.name.toLowerCase().includes('code');
      }
      if (activeFilters.value.has('vision')) {
        return model.capabilities?.includes('vision') || model.name.toLowerCase().includes('vision') || model.name.toLowerCase().includes('llava');
      }
      if (activeFilters.value.has('code')) {
        return model.name.toLowerCase().includes('code') || model.name.toLowerCase().includes('coder');
      }
      if (activeFilters.value.has('small')) {
        const sizeNum = parseFloat(model.parameterSize || '0');
        return sizeNum < 3 && sizeNum > 0;
      }
      if (activeFilters.value.has('large')) {
        const sizeNum = parseFloat(model.parameterSize || '0');
        return sizeNum > 10;
      }
      return true;
    });
  }

  return models;
});

// Glassmorphism Styles with Theme Integration
const panelStyle = computed(() => {
  const colors = themeColors.value;
  const isDark = isDarkTheme.value;
  
  // Create theme-aware background gradient using primary and secondary colors
  const primaryRgb = hexToRgb(colors.primary);
  const secondaryRgb = hexToRgb(colors.secondary);
  
  return {
    background: isDark 
      ? `linear-gradient(145deg, rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15) 0%, rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.1) 100%), linear-gradient(145deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.85) 100%)`
      : `linear-gradient(145deg, rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.08) 0%, rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.05) 100%), linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)`,
    backdropFilter: 'blur(20px)',
    border: `1px solid ${isDark ? `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.2)` : `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15)`}`,
    borderRadius: '0px',
    boxShadow: isDark 
      ? `0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`
      : `0 25px 50px -12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`,
    color: isDark ? 'rgba(248, 250, 252, 0.95)' : 'rgba(15, 23, 42, 0.95)'
  };
});

const navTabsStyle = computed(() => {
  const colors = themeColors.value;
  const isDark = isDarkTheme.value;
  const primaryRgb = hexToRgb(colors.primary);
  
  return {
    background: isDark
      ? `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.08), rgba(30, 41, 59, 0.3)`
      : `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.05), rgba(248, 250, 252, 0.5)`,
    alignSelf: 'anchor-center',
    backdropFilter: 'blur(8px)',
    borderBottom: `1px solid ${isDark ? `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15)` : `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`}`
  };
});

const cardStyle = computed(() => {
  const colors = themeColors.value;
  const isDark = isDarkTheme.value;
  const primaryRgb = hexToRgb(colors.primary);
  const accentRgb = hexToRgb(colors.accent);
  
  return {
    background: isDark
      ? `linear-gradient(135deg, rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.08) 0%, rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.05) 100%), linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)`
      : `linear-gradient(135deg, rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.05) 0%, rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.03) 100%), linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(248, 250, 252, 0.8) 100%)`,
    backdropFilter: 'blur(16px)',
    border: `1px solid ${isDark ? `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.2)` : `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15)`}`,
    borderRadius: '12px',
    boxShadow: isDark
      ? `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.08)`
      : `0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.08)`
  };
});

const selectedModelCardStyle = computed(() => {
  const colors = themeColors.value;
  const isDark = isDarkTheme.value;
  const primaryRgb = hexToRgb(colors.primary);
  const secondaryRgb = hexToRgb(colors.secondary);
  
  return {
    background: isDark
      ? `linear-gradient(135deg, rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.25) 0%, rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.15) 100%), linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)`
      : `linear-gradient(135deg, rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15) 0%, rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.08) 100%), linear-gradient(135deg, rgba(248, 250, 252, 0.8) 0%, rgba(255, 255, 255, 0.9) 100%)`,
    backdropFilter: 'blur(16px)',
    border: `1px solid ${isDark ? `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.4)` : `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.25)`}`,
    borderRadius: '12px',
    boxShadow: isDark
      ? `0 8px 32px rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15), inset 0 1px 0 rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`
      : `0 8px 32px rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1), inset 0 1px 0 rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.08)`
  };
});

const inputStyle = computed(() => {
  const colors = themeColors.value;
  const isDark = isDarkTheme.value;
  const primaryRgb = hexToRgb(colors.primary);
  
  return {
    background: isDark
      ? `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.05), rgba(15, 23, 42, 0.6)`
      : `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.03), rgba(255, 255, 255, 0.8)`,
    backdropFilter: 'blur(8px)',
    border: `1px solid ${isDark ? `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15)` : `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`}`,
    borderRadius: '8px',
    color: isDark ? 'rgba(248, 250, 252, 0.95)' : 'rgba(15, 23, 42, 0.95)',
    transition: 'all 0.2s ease'
  };
});

const closeButtonStyle = computed(() => ({
  background: isDarkTheme.value
    ? 'rgba(248, 113, 113, 0.2)'
    : 'rgba(248, 113, 113, 0.1)',
  backdropFilter: 'blur(8px)',
  border: `1px solid ${isDarkTheme.value ? 'rgba(248, 113, 113, 0.3)' : 'rgba(248, 113, 113, 0.2)'}`,
  borderRadius: '8px',
  color: isDarkTheme.value ? 'rgba(248, 113, 113, 0.9)' : 'rgba(220, 38, 38, 0.8)',
  transition: 'all 0.2s ease'
}));

const saveButtonStyle = computed(() => ({
  background: `linear-gradient(135deg, ${themeColors.value.primary} 0%, ${themeColors.value.secondary} 100%)`,
  backdropFilter: 'blur(8px)',
  border: 'none',
  borderRadius: '8px',
  color: 'white',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
}));

const testButtonStyle = computed(() => ({
  background: isDarkTheme.value
    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.8) 0%, rgba(16, 185, 129, 0.8) 100%)'
    : 'linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(16, 185, 129, 0.9) 100%)',
  backdropFilter: 'blur(8px)',
  border: 'none',
  borderRadius: '8px',
  color: 'white',
  boxShadow: '0 4px 16px rgba(34, 197, 94, 0.2)'
}));

const statusIndicatorStyle = computed(() => ({
  background: isDarkTheme.value
    ? 'rgba(30, 41, 59, 0.6)'
    : 'rgba(248, 250, 252, 0.6)',
  backdropFilter: 'blur(8px)',
  borderRadius: '20px',
  padding: '4px 12px',
  border: `1px solid ${isDarkTheme.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
}));

const toggleSliderStyle = computed(() => ({
  background: isDarkTheme.value
    ? 'rgba(55, 65, 81, 0.8)'
    : 'rgba(209, 213, 219, 0.8)',
  backdropFilter: 'blur(4px)'
}));

const rangeSliderStyle = computed(() => ({
  background: isDarkTheme.value
    ? 'rgba(55, 65, 81, 0.6)'
    : 'rgba(229, 231, 235, 0.8)',
  backdropFilter: 'blur(4px)'
}));

const infoCardStyle = computed(() => ({
  background: isDarkTheme.value
    ? 'rgba(59, 130, 246, 0.1)'
    : 'rgba(59, 130, 246, 0.05)',
  backdropFilter: 'blur(8px)',
  border: `1px solid ${isDarkTheme.value ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'}`,
  borderRadius: '8px'
}));

const errorCardStyle = computed(() => ({
  background: isDarkTheme.value
    ? 'rgba(248, 113, 113, 0.1)'
    : 'rgba(248, 113, 113, 0.05)',
  backdropFilter: 'blur(8px)',
  border: `1px solid ${isDarkTheme.value ? 'rgba(248, 113, 113, 0.2)' : 'rgba(248, 113, 113, 0.1)'}`,
  borderRadius: '8px',
  padding: '1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem'
}));

const themePreviewStyle = computed(() => ({
  background: isDarkTheme.value
    ? 'rgba(30, 41, 59, 0.4)'
    : 'rgba(248, 250, 252, 0.6)',
  backdropFilter: 'blur(8px)',
  border: `1px solid ${isDarkTheme.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
  borderRadius: '8px'
}));

const badgeStyle = computed(() => ({
  background: isDarkTheme.value
    ? 'rgba(99, 102, 241, 0.2)'
    : 'rgba(99, 102, 241, 0.1)',
  color: isDarkTheme.value ? 'rgba(165, 180, 252, 0.9)' : 'rgba(79, 70, 229, 0.8)',
  backdropFilter: 'blur(4px)',
  border: `1px solid ${isDarkTheme.value ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`
}));

const modelIconStyle = computed(() => ({
  background: isDarkTheme.value
    ? 'rgba(55, 65, 81, 0.6)'
    : 'rgba(243, 244, 246, 0.8)',
  backdropFilter: 'blur(4px)',
  border: `1px solid ${isDarkTheme.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
  borderRadius: '8px'
}));

const notificationStyle = computed(() => ({
  background: isDarkTheme.value
    ? 'rgba(15, 23, 42, 0.95)'
    : 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  border: `1px solid ${isDarkTheme.value ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)'}`,
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
}));

// Tab styles - Subtle and elegant
const getTabStyle = (isActive) => {
  const colors = themeColors.value;
  const isDark = isDarkTheme.value;
  const primaryRgb = hexToRgb(colors.primary);
  
  if (isActive) {
    return {
      background: isDark
        ? `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15)`
        : `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.12)`,
      backdropFilter: 'blur(8px)',
      border: `1px solid ${isDark ? `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.25)` : `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.2)`}`,
      color: isDark ? 'rgba(248, 250, 252, 0.95)' : 'rgba(15, 23, 42, 0.9)',
      boxShadow: `0 2px 8px rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15)`
    };
  }
  return {
    background: isDark
      ? 'rgba(55, 65, 81, 0.3)'
      : 'rgba(243, 244, 246, 0.5)',
    backdropFilter: 'blur(8px)',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
    color: isDark ? 'rgba(156, 163, 175, 0.8)' : 'rgba(107, 114, 128, 0.8)'
  };
};

const getFilterChipStyle = (filterId) => {
  const colors = themeColors.value;
  const isDark = isDarkTheme.value;
  const primaryRgb = hexToRgb(colors.primary);
  
  return {
    background: activeFilters.value.has(filterId) 
      ? isDark
        ? `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.2)`
        : `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15)`
      : isDark
        ? 'rgba(55, 65, 81, 0.4)'
        : 'rgba(243, 244, 246, 0.6)',
    backdropFilter: 'blur(8px)',
    border: activeFilters.value.has(filterId)
      ? `1px solid ${isDark ? `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.3)` : `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.25)`}`
      : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
    color: activeFilters.value.has(filterId) 
      ? isDark ? 'rgba(248, 250, 252, 0.95)' : 'rgba(15, 23, 42, 0.9)'
      : isDark ? 'rgba(156, 163, 175, 0.8)' : 'rgba(107, 114, 128, 0.8)'
  };
};

const getModelCardStyle = (model) => {
  const isSelected = isModelSelected(model);
  return {
    background: isSelected 
      ? isDarkTheme.value
        ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(30, 41, 59, 0.6) 100%)'
        : 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(248, 250, 252, 0.8) 100%)'
      : isDarkTheme.value
        ? 'rgba(30, 41, 59, 0.3)'
        : 'rgba(255, 255, 255, 0.4)',
    backdropFilter: 'blur(12px)',
    border: isSelected 
      ? `1px solid ${isDarkTheme.value ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.3)'}`
      : `1px solid ${isDarkTheme.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
    borderRadius: '10px',
    boxShadow: isSelected
      ? '0 8px 32px rgba(59, 130, 246, 0.15)'
      : '0 4px 16px rgba(0, 0, 0, 0.05)'
  };
};

// Enhanced model fetching for Ollama
const fetchOllamaModelsWithDetails = async () => {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    if (Array.isArray(data.models)) {
      const detailedModels = [];
      
      for (const model of data.models) {
        try {
          const detailResponse = await fetch('http://localhost:11434/api/show', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: model.name })
          });
          
          let modelDetails = {};
          if (detailResponse.ok) {
            modelDetails = await detailResponse.json();
          }

          const enhancedModel = {
            id: model.name,
            name: model.name,
            source: 'ollama',
            family: model.details?.family || 'unknown',
            parameterSize: model.details?.parameter_size || '',
            quantization: model.details?.quantization_level || '',
            size: model.size,
            modified_at: model.modified_at,
            capabilities: modelDetails.capabilities || [],
            isFree: true
          };

          detailedModels.push(enhancedModel);
        } catch (error) {
          console.warn(`Failed to fetch details for ${model.name}:`, error);
          detailedModels.push({
            id: model.name,
            name: model.name,
            source: 'ollama',
            family: model.details?.family || 'unknown',
            parameterSize: model.details?.parameter_size || '',
            size: model.size,
            isFree: true
          });
        }
      }
      
      enhancedModels.value = detailedModels;
    }
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    enhancedModels.value = [];
  }
};

// Utility functions
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

const getApiKeyPlaceholder = (provider) => {
  const placeholders = {
    openrouter: 'sk-or-...',
    anthropic: 'sk-ant-...',
    google: 'AIza...'
  };
  return placeholders[provider] || 'Enter API key';
};

const getProviderIcon = (source) => {
  const icons = {
    ollama: ollamaIcon,
    openrouter: openRouterIcon,
    google: googleIcon,
    anthropic: anthropicIcon,
    openai: openAIIcon
  };
  return icons[source] || customIcon;
};

const formatThemeName = (theme) => {
  return theme.charAt(0).toUpperCase() + theme.slice(1);
};

// Methods
const setActiveProvider = async (provider) => {
  activeProvider.value = provider;
  
  // Load API key from localStorage
  const keyMap = {
    openrouter: 'openRouterApiKey',
    anthropic: 'anthropicApiKey',
    google: 'geminiApiKey'
  };
  apiKey.value = localStorage.getItem(keyMap[provider]) || '';
  
  if (provider === 'ollama') {
    await fetchOllamaModelsWithDetails();
  } else if (!modelStore.hasModels(provider)) {
    modelStore.initializeProvider(provider);
  }
};

const saveApiKey = () => {
  if (!apiKey.value) return;
  
  const keyMap = {
    openrouter: 'openRouterApiKey',
    anthropic: 'anthropicApiKey',
    google: 'geminiApiKey'
  };
  
  localStorage.setItem(keyMap[activeProvider.value], apiKey.value);
  modelStore.initializeProvider(activeProvider.value);
  showNotification('API key saved successfully');
  emit('api-key-saved', { provider: activeProvider.value, apiKey: apiKey.value });
};

const toggleFilter = (filterId) => {
  if (activeFilters.value.has(filterId)) {
    activeFilters.value.delete(filterId);
  } else {
    activeFilters.value.clear(); // Only one filter at a time for simplicity
    activeFilters.value.add(filterId);
  }
};

const selectModel = (model) => {
  selectedModel.value = model;
  localStorage.setItem('selectedModel', JSON.stringify(model));
  localStorage.setItem('modelType', model.source);
  showNotification(`${model.name} selected`);
  emit('model-selected', model);
};

const isModelSelected = (model) => {
  return selectedModel.value && selectedModel.value.id === model.id;
};

const updateTTSSettings = () => {
  ttsService.updateSettings(ttsSettings);
  showNotification('TTS settings updated');
};

const testVoice = async () => {
  if (isTesting.value) return;
  
  const testMessage = "Hello! This is a test of your text-to-speech settings. The voice sounds clear and natural.";
  
  isTesting.value = true;
  try {
    await ttsService.speak(testMessage, {
      voice: ttsSettings.voice,
      speed: ttsSettings.speed
    });
    showNotification('Voice test completed');
  } catch (error) {
    console.error('Voice test failed:', error);
    showNotification('Voice test failed');
  } finally {
    isTesting.value = false;
  }
};

const changeTheme = () => {
  themeStore.setTheme(currentTheme.value);
  showNotification(`Theme changed to ${formatThemeName(currentTheme.value)}`);
};

const checkOllamaConnection = async () => {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    ollamaStatus.value = response.ok ? 'connected' : 'disconnected';
  } catch (error) {
    ollamaStatus.value = 'disconnected';
  }
};

const showNotification = (message) => {
  notification.value.show = false;
  setTimeout(() => {
    notification.value = { show: true, message };
    setTimeout(() => notification.value.show = false, 3000);
  }, 10);
};

// Watchers and lifecycle
watch(() => props.currentModel, (newVal) => {
  if (newVal) selectedModel.value = newVal;
});

// Watch for theme changes from the store
watch(() => themeStore.currentTheme, (newTheme) => {
  currentTheme.value = newTheme;
});

// Watch for DOM attribute changes (for TangentLogo theme changes)
const updateThemeFromDOM = () => {
  const domTheme = document.documentElement.getAttribute('data-theme') as ThemeName || 'light';
  if (domTheme !== currentTheme.value) {
    currentTheme.value = domTheme;
    // Also update the store to keep everything in sync
    themeStore.setTheme(domTheme);
  }
};

// MutationObserver to watch for DOM theme changes
let themeObserver: MutationObserver | null = null;

onMounted(async () => {
  // Sync theme with store
  currentTheme.value = themeStore.currentTheme;
  
  // Set up DOM theme observer to watch for TangentLogo theme changes
  themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        updateThemeFromDOM();
      }
    });
  });
  
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
  
  // Load voices if not already loaded
  if (voices.value.length === 0) {
    await ttsService.loadVoices();
  }
  
  // Sync with TTS service settings
  Object.assign(ttsSettings, ttsService.settings);
  
  // Check Ollama connection
  await checkOllamaConnection();
  
  if (activeProvider.value === 'ollama') {
    await fetchOllamaModelsWithDetails();
  } else if (!modelStore.hasModels(activeProvider.value)) {
    modelStore.initializeProvider(activeProvider.value);
  }
});

onUnmounted(() => {
  // Clean up the DOM theme observer
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
});
</script>

<style scoped>
.agent-configurator-panel {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Compact Header Styles */
.panel-header {
  flex-shrink: 0;
  padding: 0.5rem;
}

.nav-tabs-compact {
  display: flex;
  gap: 0.25rem;
}

.nav-tab-compact {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  font-weight: 500;
  flex: 1;
  justify-content: center;
}

.nav-tab-compact .tab-label {
  display: none;
}

@media (min-width: 320px) {
  .nav-tab-compact .tab-label {
    display: inline;
  }
  .nav-tab-compact {
    justify-content: flex-start;
  }
}

.nav-tab-compact:hover {
  transform: translateY(-1px);
}

/* Optimized Content Area */
.content-area-optimized {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tab-content-optimized {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
}

/* Compact Controls */
.controls-section {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.controls-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 120px;
}

.api-key-group {
  flex: 2;
}

.control-label {
  font-size: 0.65rem;
  font-weight: 500;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.control-select,
.control-input {
  padding: 0.5rem;
  border: none;
  outline: none;
  border-radius: 4px;
  font-size: 0.75rem;
  transition: all 0.2s ease;
}

.api-key-compact {
  display: flex;
  gap: 0.25rem;
}

.api-key-compact .control-input {
  flex: 1;
}

.save-btn-compact {
  padding: 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Search and Filters */
.search-filter-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.search-compact {
  position: relative;
  flex: 1;
  min-width: 140px;
}

.search-icon-compact {
  position: absolute;
  left: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.5;
  pointer-events: none;
}

.search-input-compact {
  width: 100%;
  padding: 0.5rem 0.5rem 0.5rem 1.75rem;
  border: none;
  outline: none;
  border-radius: 4px;
  font-size: 0.75rem;
  transition: all 0.2s ease;
}

.filters-compact {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.filter-chip-compact {
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.625rem;
  font-weight: 500;
}

/* Selected Model - Compact */
.selected-model-compact {
  padding: 0.75rem;
  border-radius: 8px;
}

.selected-model-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.selected-model-icon {
  width: 1.5rem;
  height: 1.5rem;
  object-fit: contain;
  border-radius: 4px;
  flex-shrink: 0;
}

.selected-model-info {
  flex: 1;
  min-width: 0;
}

.selected-model-name {
  font-weight: 600;
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-model-meta {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.125rem;
}

.model-size-badge,
.model-family-badge {
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.2);
  color: rgba(59, 130, 246, 0.9);
}

.model-family-badge {
  background: rgba(156, 163, 175, 0.2);
  color: rgba(156, 163, 175, 0.9);
}

/* Models Section */
.models-section {
  flex: 1;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.loading-state-compact,
.empty-state-compact {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  opacity: 0.6;
}

.loading-text,
.empty-text {
  font-size: 0.75rem;
}

/* Compact Model Grid */
.models-grid-compact {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  flex: 1;
}

.model-card-compact {
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 6px;
}

.model-card-compact:hover {
  transform: translateY(-1px);
}

.model-header-compact {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.model-provider-icon-compact {
  width: 1.25rem;
  height: 1.25rem;
  object-fit: contain;
  border-radius: 3px;
  flex-shrink: 0;
}

.model-info-compact {
  flex: 1;
  min-width: 0;
}

.model-name-compact {
  font-weight: 600;
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.model-meta-compact {
  display: flex;
  gap: 0.375rem;
  margin-top: 0.125rem;
}

.param-size,
.file-size {
  font-size: 0.625rem;
  opacity: 0.7;
}

.selected-check-compact {
  flex-shrink: 0;
}

.model-tags-compact {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.tag-compact {
  padding: 0.125rem 0.375rem;
  border-radius: 8px;
  font-size: 0.5rem;
  font-weight: 500;
}

.tag-quant {
  background: rgba(34, 197, 94, 0.2);
  color: rgba(34, 197, 94, 0.9);
}

.tag-cap {
  background: rgba(168, 85, 247, 0.2);
  color: rgba(168, 85, 247, 0.9);
}

/* TTS Section Compact */
.tts-section {
  padding: 0.75rem;
}

.tts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.tts-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
}

.toggle-label-compact {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.toggle-slider-compact {
  position: relative;
  width: 2.5rem;
  height: 1.25rem;
  border-radius: 0.625rem;
  transition: all 0.2s ease;
}

.toggle-slider-compact::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 1rem;
  height: 1rem;
  background: white;
  border-radius: 50%;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toggle-input:checked + .toggle-slider-compact {
  background: linear-gradient(135deg, rgb(34, 197, 94) 0%, rgb(16, 185, 129) 100%);
}

.toggle-input:checked + .toggle-slider-compact::before {
  transform: translateX(1.25rem);
}

.tts-controls-compact {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tts-controls-row {
  display: flex;
  gap: 0.75rem;
}

.tts-controls-row .control-group {
  flex: 1;
}

.speed-slider-compact {
  margin-top: 0.25rem;
}

.range-slider-compact {
  width: 100%;
  height: 3px;
  border-radius: 1.5px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.range-slider-compact::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  background: linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%);
  cursor: pointer;
  box-shadow: 0 1px 6px rgba(59, 130, 246, 0.3);
}

.range-slider-compact::-moz-range-thumb {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  background: linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%);
  cursor: pointer;
  border: none;
  box-shadow: 0 1px 6px rgba(59, 130, 246, 0.3);
}

.tts-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.auto-read-compact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.auto-read-label {
  font-size: 0.75rem;
  font-weight: 500;
}

.test-btn-compact {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  font-weight: 500;
}

.test-btn-compact:hover:not(:disabled) {
  transform: translateY(-1px);
}

.test-btn-compact:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-compact,
.info-compact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  margin-top: 0.5rem;
}

.error-text-compact,
.info-text-compact {
  font-size: 0.75rem;
}

.panel-header {
  flex-shrink: 0;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-title {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.title-text {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  background: linear-gradient(135deg, currentColor 0%, rgba(255, 255, 255, 0.7) 100%);
  -webkit-background-clip: text;
  background-clip: text;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgb(239, 68, 68);
  transition: all 0.3s ease;
}

.status-dot.connected {
  background: rgb(34, 197, 94);
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
}

.status-text {
  font-size: 0.75rem;
  opacity: 0.8;
}

.close-btn {
  padding: 0.5rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  transform: scale(1.05);
}

.nav-tabs {
  display: flex;
  padding: 0.75rem;
  gap: 0.5rem;
  flex-shrink: 0;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.nav-tab:hover {
  transform: translateY(-1px);
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-card {
  padding: 1.5rem;
  transition: all 0.2s ease;
}

.section-card:hover {
  transform: translateY(-2px);
}

.section-header {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}

.section-subtitle {
  font-size: 0.875rem;
  opacity: 0.7;
  margin: 0;
}

.provider-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 768px) {
  .provider-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  opacity: 0.9;
}

.form-description {
  font-size: 0.75rem;
  opacity: 0.6;
  margin: 0;
}

.form-select,
.form-input {
  padding: 0.75rem;
  border: none;
  outline: none;
  transition: all 0.2s ease;
}

.form-select:focus,
.form-input:focus {
  transform: translateY(-1px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.api-key-input {
  display: flex;
  gap: 0.5rem;
}

.api-key-input .form-input {
  flex: 1;
}

.save-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.save-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.search-input {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.5;
  pointer-events: none;
}

.search-field {
  padding-left: 2.5rem;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-chip {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  font-weight: 500;
}

.filter-chip:hover {
  transform: translateY(-1px);
}

.selected-model {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.model-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
}

.model-info {
  flex: 1;
  min-width: 0;
}

.model-name {
  font-weight: 600;
  font-size: 1rem;
}

.model-family {
  font-size: 0.875rem;
  opacity: 0.7;
}

.model-badges {
  display: flex;
  gap: 0.5rem;
}

.model-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.models-container {
  min-height: 200px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  opacity: 0.7;
}

.models-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .models-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.model-card {
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.model-card:hover {
  transform: translateY(-2px);
}

.model-card-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.model-provider-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
}

.model-details {
  flex: 1;
  min-width: 0;
}

.model-card-name {
  font-weight: 600;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-card-family {
  font-size: 0.75rem;
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-indicator {
  flex-shrink: 0;
}

.model-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.tag {
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.625rem;
  font-weight: 500;
}

.tag-blue {
  background: rgba(59, 130, 246, 0.2);
  color: rgb(147, 197, 253);
}

.tag-green {
  background: rgba(34, 197, 94, 0.2);
  color: rgb(134, 239, 172);
}

.tag-purple {
  background: rgba(168, 85, 247, 0.2);
  color: rgb(196, 181, 253);
}

.model-size {
  font-size: 0.75rem;
  opacity: 0.5;
}

.tts-toggle,
.auto-read-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.toggle-info {
  flex: 1;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.toggle-input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 3rem;
  height: 1.5rem;
  border-radius: 0.75rem;
  transition: all 0.2s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 1.25rem;
  height: 1.25rem;
  background: white;
  border-radius: 50%;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.toggle-input:checked + .toggle-slider {
  background: linear-gradient(135deg, rgb(34, 197, 94) 0%, rgb(16, 185, 129) 100%);
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(1.5rem);
}

.toggle-text {
  font-size: 0.875rem;
  font-weight: 500;
}

.tts-controls {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.slider-label {
  font-size: 0.75rem;
  opacity: 0.6;
  min-width: max-content;
}

.range-slider {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.range-slider::-moz-range-thumb {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.test-section {
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.test-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  width: 100%;
  justify-content: center;
}

.test-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 32px rgba(34, 197, 94, 0.3);
}

.test-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.info-card,
.error-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
}

.info-text {
  flex: 1;
}

.info-title {
  font-weight: 600;
  font-size: 0.875rem;
  margin: 0 0 0.25rem 0;
}

.info-subtitle {
  font-size: 0.75rem;
  opacity: 0.7;
  margin: 0;
}

.error-text {
  font-size: 0.875rem;
  color: rgb(248, 113, 113);
}

.theme-selector {
  margin-bottom: 1.5rem;
}

.theme-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  margin-top: 1rem;
}

.preview-colors {
  display: flex;
  gap: 0.5rem;
}

.color-swatch {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.preview-text {
  font-size: 0.875rem;
  font-weight: 500;
}

.connection-status {
  margin-bottom: 1rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
}

.status-name {
  flex: 1;
  font-weight: 500;
}

.status-value {
  font-size: 0.875rem;
  opacity: 0.7;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
}

.connection-text {
  font-size: 0.875rem;
  opacity: 0.8;
}

.notification {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  max-width: 320px;
  font-size: 0.875rem;
  font-weight: 500;
}

.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from,
.notification-leave-to {
  transform: translateY(1rem);
  opacity: 0;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.5);
}

/* Custom select styling */
.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='rgba(156,163,175,0.8)' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.75rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: 2.5rem;
}

/* Remove hardcoded option styles to let browser handle theme-aware styling */
</style>