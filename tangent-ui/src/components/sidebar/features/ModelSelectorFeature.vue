<template>
  <div class="model-selector-feature">
    <!-- Overview Panel (Top Section) -->
    <div class="panel overview-panel">
      <div class="panel-content">
        <div class="overview-header">
          <h3 class="overview-title">Model Overview</h3>
          <button @click="refreshModels" class="refresh-btn" title="Refresh Models">
            <RotateCcw class="w-4 h-4" />
          </button>
        </div>
        
        <div class="overview-content">
          <div class="overview-stats">
            <div class="stat-item">
              <div class="stat-number">{{ totalModels }}</div>
              <div class="stat-label">Models</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">{{ freeModelsCount }}</div>
              <div class="stat-label">Free</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">{{ configuredAgentsCount }}/4</div>
              <div class="stat-label">Configured</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Agent Management Panel (Middle Section) -->
    <div class="panel agents-panel">
      <div class="panel-content">
        <div class="agents-header">
          <h3 class="agents-title">AI Agents</h3>
          <div class="agents-stats">
            <span class="configured-count">{{ configuredAgentsCount }}/4 configured</span>
            <button @click="showCustomAgentForm = !showCustomAgentForm" class="add-agent-btn" :class="{ active: showCustomAgentForm }" title="Create Agent">
              <Plus class="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
        </div>
        
        <!-- Create Agent Form -->
        <div v-if="showCustomAgentForm" class="create-form-overlay">
          <div class="create-form">
            <input v-model="customAgentForm.name" placeholder="Agent name" class="form-field" />
            <input v-model="customAgentForm.emoji" placeholder="🤖" class="form-field emoji-field" maxlength="2" />
            <input v-model="customAgentForm.color" type="color" class="form-field color-field" />
            <div class="form-actions">
              <button @click="createCustomAgent" class="btn-primary" :disabled="!canCreateAgent">
                Create Agent
              </button>
              <button @click="showCustomAgentForm = false" class="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>

        <!-- Agents Grid -->
        <div class="agents-container">
          <div class="agents-grid">
            <div v-for="agent in allAgentTypes" :key="agent.id" class="agent-card" 
              :class="{ 
                configured: getAgentModel(agent.id),
                selected: selectedAgent === agent.id,
                custom: agent.isCustom 
              }"
              @click="selectAgent(agent.id)">
              <div class="agent-header">
                <div class="agent-icon" :style="{ backgroundColor: agent.color + '25', color: agent.color }">
                  {{ agent.emoji }}
                </div>
                <div class="agent-status">
                  <div v-if="getAgentModel(agent.id)" class="status-indicator active" title="Configured"></div>
                  <div v-else class="status-indicator" title="Not configured"></div>
                </div>
              </div>
              <div class="agent-info">
                <div class="agent-name">{{ agent.name }}</div>
                <div class="agent-model">{{ getAgentModel(agent.id)?.name || 'No model assigned' }}</div>
              </div>
              <div class="agent-actions">
                <button v-if="getAgentModel(agent.id)" @click.stop="clearAgent(agent.id)" class="action-btn clear" title="Clear Model">
                  <X class="w-3 h-3" />
                </button>
                <button v-if="agent.isCustom" @click.stop="removeCustomAgent(agent.id)" class="action-btn delete" title="Delete Agent">
                  <Trash2 class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- System Message Editor -->
    <div v-if="selectedAgent" class="system-message-editor">
          <div class="editor-header">
            <span class="editor-title">System Message for {{ getSelectedAgentName() }}</span>
          </div>
          <textarea 
            v-model="systemMessages[selectedAgent]" 
            @input="updateSystemMessage"
            placeholder="Enter custom system message for this agent..."
            class="system-textarea"
            rows="3">
          </textarea>
        </div>

        <!-- Audio Settings -->
        <div class="audio-settings">
          <div class="audio-toggle-group">
            <div class="audio-toggle">
              <label class="toggle-switch">
                <input type="checkbox" v-model="ttsSettings.enabled" @change="updateTTSSettings" />
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-label">Text-to-Speech</span>
            </div>
            <div class="audio-toggle">
              <label class="toggle-switch">
                <input type="checkbox" v-model="whisperSettings.enabled" @change="updateWhisperSettings" />
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-label">Speech Recognition</span>
            </div>
          </div>
          
          <div v-if="ttsSettings.enabled || whisperSettings.enabled" class="audio-controls">
            <div v-if="ttsSettings.enabled" class="control-section">
              <div class="control-row">
                <span class="control-label">Voice</span>
                <div class="control-options">
                  <button v-for="voice in ttsVoices.slice(0, 3)" :key="voice.id" 
                    @click="ttsSettings.voice = voice.id; updateTTSSettings()"
                    class="option-chip" :class="{ active: ttsSettings.voice === voice.id }">
                    {{ voice.name.split(' ')[0] }}
                  </button>
                </div>
              </div>
              <div class="control-row">
                <span class="control-label">Speed: {{ ttsSettings.speed.toFixed(1) }}x</span>
                <input type="range" v-model.number="ttsSettings.speed" @input="updateTTSSettings" 
                  min="0.25" max="4.0" step="0.25" class="speed-slider" />
              </div>
            </div>
            
            <div v-if="whisperSettings.enabled" class="control-section">
              <div class="control-row">
                <span class="control-label">Model</span>
                <div class="control-options">
                  <button v-for="model in whisperModels.slice(0, 3)" :key="model.id"
                    @click="whisperSettings.model = model.id; updateWhisperSettings()"
                    class="option-chip" :class="{ active: whisperSettings.model === model.id }">
                    {{ model.name.split(' ')[0] }}
                  </button>
                </div>
              </div>
              <div class="control-row">
                <span class="control-label">Language</span>
                <div class="control-options">
                  <button v-for="lang in commonLanguages.slice(0, 4)" :key="lang.code"
                    @click="whisperSettings.language = lang.code; updateWhisperSettings()"
                    class="option-chip" :class="{ active: whisperSettings.language === lang.code }">
                    {{ lang.name }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

    <!-- Model Browser Panel (Bottom Section) -->
    <div class="panel models-panel">
      <div class="models-header">
        <div class="models-title-section">
          <h3 class="models-title">Model Browser</h3>
          <span class="model-count">{{ filteredModels.length }} models</span>
        </div>
        
        <!-- Search -->
        <div class="search-wrapper">
          <Search class="search-icon w-3.5 h-3.5" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search models..." 
            class="search-input" 
          />
          <button v-if="searchQuery" @click="searchQuery = ''" class="clear-search">
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <!-- Filters -->
      <div class="filters-section">
        <!-- Provider Filter Chips -->
        <div class="provider-filters">
          <button v-for="provider in providerOptions" :key="provider.id"
            @click="activeProvider = provider.id"
            class="provider-chip" :class="{ active: activeProvider === provider.id }">
            <img :src="getProviderIcon(provider.id)" class="chip-icon" />
            {{ provider.name }}
          </button>
        </div>
        
        <!-- Quick Filter Chips -->
        <div class="quick-filters">
          <button v-for="filter in quickFilters" :key="filter.id" 
            @click="toggleFilter(filter.id)" 
            class="filter-chip" :class="{ active: activeFilters.has(filter.id) }">
            {{ filter.label }}
          </button>
        </div>
      </div>

      <div class="panel-content models-content">
        <div v-if="filteredModels.length === 0" class="empty-state">
          <div class="empty-icon">🤖</div>
          <div class="empty-message">No models found</div>
          <div class="empty-hint">Try adjusting your search or filters</div>
        </div>
        
        <div v-else class="models-grid">
          <div v-for="model in displayedModels" :key="model.id" class="model-card"
            :class="{ 
              assigned: isModelAssigned(model),
              favorite: isModelFavorite(model)
            }">
            <div class="model-header">
              <img :src="getProviderIcon(model.source)" class="provider-icon" />
              <div class="model-info">
                <div class="model-name">{{ model.name }}</div>
                <div class="model-meta">
                  <span class="provider-name">{{ model.provider || model.source }}</span>
                  <span v-if="model.isFree" class="free-indicator">•</span>
                  <span v-if="model.parameterSize" class="size-info">{{ model.parameterSize }}</span>
                  <span v-if="model.contextLength" class="context-info">{{ formatContext(model.contextLength) }}</span>
                </div>
              </div>
              <button @click="toggleFavorite(model)" class="favorite-btn" 
                :class="{ active: isModelFavorite(model) }">
                <Star class="w-3 h-3" :class="{ 'fill-current': isModelFavorite(model) }" />
              </button>
            </div>
            
            <!-- Agent Assignment -->
            <div class="assignment-actions">
              <button v-for="agent in allAgentTypes" :key="agent.id" 
                @click="setAsAgent(agent.id, model)"
                class="agent-btn" 
                :class="{ 
                  active: getAgentModel(agent.id)?.id === model.id,
                  custom: agent.isCustom 
                }" 
                :style="{ '--agent-color': agent.color }"
                :title="agent.name">
                <span class="agent-emoji">{{ agent.emoji }}</span>
              </button>
            </div>
          </div>
          
          <!-- Load More -->
          <div class="load-more-section">
            <div v-if="isLoadingMore" class="loading-indicator">
              <Loader class="w-4 h-4 animate-spin" />
              <span>Loading more models...</span>
            </div>
            <button v-else-if="hasMoreModels" @click="loadMoreModels" class="load-more-btn">
              Load {{ Math.min(itemsPerPage, remainingCount) }} more models
            </button>
            <div v-else-if="displayedModels.length > 0" class="end-indicator">
              All {{ filteredModels.length }} models loaded
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import { 
  RotateCcw, Plus, X, Trash2, Search, Star, Loader
} from 'lucide-vue-next';
import { useModelStore } from '@/stores/modelStore';
import { useAgentStore } from '@/stores/agentStore';
import { useThemeColors } from '@/composables/useThemeColors';

// Import provider icons
import ollamaIcon from '@/assets/ollama.jpeg';
import googleIcon from '@/assets/google.jpeg';
import anthropicIcon from '@/assets/anthropic.jpeg';
import openRouterIcon from '@/assets/unknown.jpeg';

// Stores and composables
const modelStore = useModelStore();
const agentStore = useAgentStore();
const { themeColors, isDarkTheme } = useThemeColors();

// State
const selectedAgent = ref<string | null>(null);
const showCustomAgentForm = ref(false);
const searchQuery = ref('');
const activeProvider = ref('all');
const activeFilters = ref(new Set<string>());
const currentPage = ref(0);
const itemsPerPage = 20;
const isLoadingMore = ref(false);

// API Keys
const apiKeys = reactive({
  anthropic: localStorage.getItem('anthropicApiKey') || '',
  openrouter: localStorage.getItem('openRouterApiKey') || '',
  google: localStorage.getItem('geminiApiKey') || ''
});

// API Providers
const apiProviders = [
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'openrouter', name: 'OpenRouter' },
  { id: 'google', name: 'Google' },
  { id: 'ollama', name: 'Ollama' }
];

const providerOptions = [
  { id: 'all', name: 'All' },
  ...apiProviders
];

// Agent Types
const agentTypes = ref([
  { id: 'text', name: 'Text Agent', emoji: '💬', color: '#3b82f6' },
  { id: 'vision', name: 'Vision Agent', emoji: '👁️', color: '#10b981' },
  { id: 'code', name: 'Code Agent', emoji: '💻', color: '#8b5cf6' },
  { id: 'router', name: 'Router Agent', emoji: '🎯', color: '#f59e0b' }
]);

// System Messages
const systemMessages = reactive({
  text: localStorage.getItem('systemMessage_text') || 'You are a helpful text assistant.',
  vision: localStorage.getItem('systemMessage_vision') || 'You are a vision assistant.',
  code: localStorage.getItem('systemMessage_code') || 'You are a coding assistant.',
  router: localStorage.getItem('systemMessage_router') || 'You are a router assistant.'
});

// TTS Settings
const ttsSettings = reactive({
  enabled: JSON.parse(localStorage.getItem('ttsEnabled') || 'false'),
  voice: localStorage.getItem('ttsVoice') || 'af_heart',
  speed: parseFloat(localStorage.getItem('ttsSpeed') || '1.0'),
  autoRead: JSON.parse(localStorage.getItem('ttsAutoRead') || 'false')
});

const ttsVoices = ref([
  { id: 'af_heart', name: 'American Female (Heart)' },
  { id: 'af_sarah', name: 'American Female (Sarah)' },
  { id: 'af_sky', name: 'American Female (Sky)' },
  { id: 'af_nicole', name: 'American Female (Nicole)' },
  { id: 'am_adam', name: 'American Male (Adam)' }
]);

// Whisper Settings
const whisperSettings = reactive({
  enabled: JSON.parse(localStorage.getItem('whisperEnabled') || 'false'),
  model: localStorage.getItem('whisperModel') || 'base',
  language: localStorage.getItem('whisperLanguage') || 'auto',
  threads: parseInt(localStorage.getItem('whisperThreads') || '4'),
  translate: JSON.parse(localStorage.getItem('whisperTranslate') || 'false'),
  diarize: JSON.parse(localStorage.getItem('whisperDiarize') || 'false'),
  timestamps: JSON.parse(localStorage.getItem('whisperTimestamps') || 'false')
});

const whisperModels = ref([
  { id: 'tiny', name: 'Tiny (39 MB)' },
  { id: 'base', name: 'Base (142 MB)' },
  { id: 'small', name: 'Small (466 MB)' },
  { id: 'medium', name: 'Medium (1.5 GB)' },
  { id: 'large', name: 'Large (2.9 GB)' }
]);

const commonLanguages = [
  { code: 'auto', name: 'Auto' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' }
];

// Custom Agent Form
const customAgentForm = reactive({
  name: '',
  emoji: '🤖',
  color: '#6366f1'
});

// Quick Filters
const quickFilters = [
  { id: 'free', label: 'Free' },
  { id: 'fast', label: 'Fast' },
  { id: 'large-context', label: 'Large Context' },
  { id: 'multimodal', label: 'Multimodal' },
  { id: 'reasoning', label: 'Reasoning' }
];

// Computed properties
const allAgentTypes = computed(() => {
  const customAgents = (agentStore.customAgents || []).map(agent => ({
    id: agent.id,
    name: agent.name,
    emoji: agent.emoji || '🤖',
    color: agent.color || '#6366f1',
    isCustom: true
  }));
  return [...agentTypes.value, ...customAgents];
});

const allModels = computed(() => {
  const models = [];
  if (activeProvider.value === 'all' || activeProvider.value === 'ollama') {
    models.push(...(modelStore.ollamaModels || []));
  }
  if (activeProvider.value === 'all' || activeProvider.value === 'openrouter') {
    models.push(...(modelStore.openRouterModels || []));
  }
  if (activeProvider.value === 'all' || activeProvider.value === 'anthropic') {
    models.push(...(modelStore.anthropicModels || []));
  }
  if (activeProvider.value === 'all' || activeProvider.value === 'google') {
    models.push(...(modelStore.googleModels || []));
  }
  return models;
});

const totalModels = computed(() => allModels.value.length);
const freeModelsCount = computed(() => allModels.value.filter(m => m.isFree).length);
const configuredAgentsCount = computed(() => {
  return allAgentTypes.value.filter(agent => getAgentModel(agent.id)).length;
});

const filteredModels = computed(() => {
  let models = allModels.value;
  
  // Apply search filter
  if (searchQuery.value) {
    models = models.filter(model => 
      model.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }
  
  // Apply provider filter
  if (activeProvider.value !== 'all') {
    models = models.filter(model => model.source === activeProvider.value);
  }
  
  // Apply quick filters
  activeFilters.value.forEach(filterId => {
    switch (filterId) {
      case 'free':
        models = models.filter(model => model.isFree);
        break;
      case 'fast':
        models = models.filter(model => model.responseTime && model.responseTime < 1000);
        break;
      case 'large-context':
        models = models.filter(model => model.contextLength && model.contextLength > 100000);
        break;
      case 'multimodal':
        models = models.filter(model => model.capabilities?.includes('vision'));
        break;
      case 'reasoning':
        models = models.filter(model => model.capabilities?.includes('reasoning'));
        break;
    }
  });
  
  return models;
});

const displayedModels = computed(() => {
  const endIndex = (currentPage.value + 1) * itemsPerPage;
  return filteredModels.value.slice(0, endIndex);
});

const hasMoreModels = computed(() => {
  return displayedModels.value.length < filteredModels.value.length;
});

const remainingCount = computed(() => {
  return filteredModels.value.length - displayedModels.value.length;
});

const canCreateAgent = computed(() => {
  return customAgentForm.name.trim().length > 0;
});

// Methods
const getProviderIcon = (source: string) => {
  switch (source) {
    case 'ollama': return ollamaIcon;
    case 'google': return googleIcon;
    case 'anthropic': return anthropicIcon;
    case 'openrouter': return openRouterIcon;
    case 'all': return openRouterIcon;
    default: return openRouterIcon;
  }
};

const isConnected = (providerId: string) => {
  if (providerId === 'ollama') return true; // Local
  return !!apiKeys[providerId];
};

const hasError = (providerId: string) => {
  return false;
};

const getStatusText = (providerId: string) => {
  return isConnected(providerId) ? 'Connected' : 'Not configured';
};

const getAgentModel = (agentId: string) => {
  // For standard agents, find by type
  const standardAgent = agentStore.agentConfigs?.find(config => config.type === agentId && config.isDefault && config.enabled);
  if (standardAgent) return standardAgent.model || null;

  // For custom agents, find by ID
  const customAgent = agentStore.agentConfigs?.find(config => config.id === agentId);
  return customAgent?.model || null;
};

const getSelectedAgentName = () => {
  if (!selectedAgent.value) return '';
  const agent = allAgentTypes.value.find(a => a.id === selectedAgent.value);
  return agent?.name || '';
};

const selectAgent = (agentId: string) => {
  selectedAgent.value = selectedAgent.value === agentId ? null : agentId;
};

const clearAgent = (agentId: string) => {
  // Check if it's a custom agent
  const customAgent = agentStore.agentConfigs?.find(config => config.id === agentId);
  if (customAgent) {
    agentStore.updateAgentConfig(agentId, { model: null });
  } else {
    // For standard agents
    const config = agentStore.agentConfigs?.find(config => config.type === agentId && config.isDefault);
    if (config) {
      agentStore.updateAgentConfig(config.id, { model: null });
    }
  }
};

const setAsAgent = (agentId: string, model: any) => {
  // For custom agents, update the specific agent config
  const customAgent = agentStore.agentConfigs?.find(config => config.id === agentId);
  if (customAgent) {
    agentStore.updateAgentConfig(agentId, { model, enabled: true });
  } else {
    // For standard agents
    agentStore.setAgentModel(agentId, model);
  }
};

const isModelAssigned = (model: any) => {
  return allAgentTypes.value.some(agent => {
    const agentModel = getAgentModel(agent.id);
    return agentModel && agentModel.id === model.id;
  });
};

const getAssignedAgent = (model: any) => {
  const agent = allAgentTypes.value.find(agent => {
    const agentModel = getAgentModel(agent.id);
    return agentModel && agentModel.id === model.id;
  });
  return agent?.name || null;
};

const createCustomAgent = () => {
  if (canCreateAgent.value) {
    agentStore.createCustomAgent({
      name: customAgentForm.name,
      emoji: customAgentForm.emoji,
      color: customAgentForm.color
    });
    
    // Reset form
    customAgentForm.name = '';
    customAgentForm.emoji = '🤖';
    customAgentForm.color = '#6366f1';
    showCustomAgentForm.value = false;
  }
};

const removeCustomAgent = (agentId: string) => {
  agentStore.removeAgent(agentId);
};

const updateSystemMessage = () => {
  if (selectedAgent.value) {
    localStorage.setItem(`systemMessage_${selectedAgent.value}`, systemMessages[selectedAgent.value]);
  }
};

const updateTTSSettings = () => {
  localStorage.setItem('ttsEnabled', JSON.stringify(ttsSettings.enabled));
  localStorage.setItem('ttsVoice', ttsSettings.voice);
  localStorage.setItem('ttsSpeed', ttsSettings.speed.toString());
  localStorage.setItem('ttsAutoRead', JSON.stringify(ttsSettings.autoRead));
};

const updateWhisperSettings = () => {
  localStorage.setItem('whisperEnabled', JSON.stringify(whisperSettings.enabled));
  localStorage.setItem('whisperModel', whisperSettings.model);
  localStorage.setItem('whisperLanguage', whisperSettings.language);
  localStorage.setItem('whisperThreads', whisperSettings.threads.toString());
  localStorage.setItem('whisperTranslate', JSON.stringify(whisperSettings.translate));
  localStorage.setItem('whisperDiarize', JSON.stringify(whisperSettings.diarize));
  localStorage.setItem('whisperTimestamps', JSON.stringify(whisperSettings.timestamps));
};

const toggleFilter = (filterId: string) => {
  if (activeFilters.value.has(filterId)) {
    activeFilters.value.delete(filterId);
  } else {
    activeFilters.value.add(filterId);
  }
};

const isModelFavorite = (model: any) => {
  const favorites = JSON.parse(localStorage.getItem('favoriteModels') || '[]');
  return favorites.some((fav: any) => fav.id === model.id);
};

const toggleFavorite = (model: any) => {
  const favorites = JSON.parse(localStorage.getItem('favoriteModels') || '[]');
  const index = favorites.findIndex((fav: any) => fav.id === model.id);
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push(model);
  }
  localStorage.setItem('favoriteModels', JSON.stringify(favorites));
};

const formatContext = (contextLength: number) => {
  if (contextLength >= 1000000) {
    return `${(contextLength / 1000000).toFixed(1)}M`;
  } else if (contextLength >= 1000) {
    return `${(contextLength / 1000).toFixed(0)}K`;
  }
  return contextLength.toString();
};

const hasPerformanceMetrics = (model: any) => {
  return model.responseTime || model.accuracy || model.costPer1kTokens;
};

const formatResponseTime = (responseTime: number) => {
  if (responseTime < 1000) {
    return `${responseTime}ms`;
  }
  return `${(responseTime / 1000).toFixed(1)}s`;
};

const loadMoreModels = () => {
  isLoadingMore.value = true;
  setTimeout(() => {
    currentPage.value++;
    isLoadingMore.value = false;
  }, 300);
};

const refreshModels = async () => {
  try {
    await Promise.all([
      modelStore.initializeProvider?.('ollama'),
      modelStore.initializeProvider?.('openrouter'),
      modelStore.initializeProvider?.('anthropic'),
      modelStore.initializeProvider?.('google')
    ].filter(Boolean));
  } catch (error) {
    console.warn('Error refreshing models:', error);
  }
};

const fetchTTSVoices = async () => {
  try {
    const response = await fetch('http://127.0.0.1:5050/api/tts-voices');
    if (response.ok) {
      const data = await response.json();
      const voiceList = Object.entries(data.voices).map(([id, name]) => ({ id, name }));
      ttsVoices.value = voiceList;
    }
  } catch (error) {
    console.warn('Error fetching TTS voices:', error);
  }
};

// Initialize
onMounted(() => {
  refreshModels();
  fetchTTSVoices();
});
</script>

<style scoped>
.model-selector-feature {
  padding: 0.375rem;
  display: flex;
  background: linear-gradient(180deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 2%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 3%, hsl(var(--b2))));
  flex-direction: column;
  gap: 0.375rem;
  height: 100%;
  overflow: hidden;
  position: relative;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* Panel Base Styles */
.panel {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 6%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 4%, hsl(var(--b2))));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.primary) 15%, hsl(var(--bc) / 0.15));
  border-radius: 16px;
  overflow: hidden;
  backdrop-filter: blur(20px);
  box-shadow: 
    0 8px 32px color-mix(in srgb, v-bind(themeColors.primary) 15%, transparent),
    0 2px 8px rgba(0, 0, 0, 0.1),
    inset 0 1px 1px rgba(255, 255, 255, 0.05);
  position: relative;
  transition: all 0.3s ease;
}

.panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, 
    transparent,
    v-bind(themeColors.primary), 
    v-bind(themeColors.secondary), 
    v-bind(themeColors.accent),
    transparent);
  border-radius: 16px 16px 0 0;
  opacity: 0.8;
}

/* Panel Specific Gradients */
.overview-panel {
  flex-shrink: 0;
  min-height: 80px;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 10%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.accent) 5%, hsl(var(--b2))));
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.overview-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: hsl(var(--bc));
  margin: 0;
  background: linear-gradient(135deg, 
    hsl(var(--bc)),
    color-mix(in srgb, v-bind(themeColors.primary) 40%, hsl(var(--bc))));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.refresh-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 8%, rgba(255, 255, 255, 0.05)),
    color-mix(in srgb, v-bind(themeColors.secondary) 6%, rgba(255, 255, 255, 0.02)));
  color: hsl(var(--bc) / 0.8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.08));
}

.refresh-btn:hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 15%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 12%, hsl(var(--b2))));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, v-bind(themeColors.primary) 20%, transparent);
}

.overview-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.agents-panel {
  flex: 0.6;
  display: flex;
  flex-direction: column;
  min-height: 120px;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.secondary) 8%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.primary) 5%, hsl(var(--b2))));
}

.agents-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.agents-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: hsl(var(--bc));
  margin: 0;
  background: linear-gradient(135deg, 
    hsl(var(--bc)),
    color-mix(in srgb, v-bind(themeColors.secondary) 40%, hsl(var(--bc))));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.agents-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.configured-count {
  font-size: 0.75rem;
  color: hsl(var(--bc) / 0.7);
  font-weight: 500;
}

.add-agent-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.secondary) 8%, rgba(255, 255, 255, 0.05)),
    color-mix(in srgb, v-bind(themeColors.primary) 6%, rgba(255, 255, 255, 0.02)));
  color: hsl(var(--bc) / 0.8);
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.08));
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.75rem;
  font-weight: 600;
}

.add-agent-btn:hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.secondary) 15%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.primary) 12%, hsl(var(--b2))));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, v-bind(themeColors.secondary) 20%, transparent);
}

.add-agent-btn.active {
  background: linear-gradient(135deg, 
    v-bind(themeColors.secondary), 
    v-bind(themeColors.primary));
  color: white;
  border-color: v-bind(themeColors.secondary);
  box-shadow: 0 4px 15px color-mix(in srgb, v-bind(themeColors.secondary) 40%, transparent);
}

.agents-container {
  flex: 1;
  overflow-y: auto;
}

.models-panel {
  flex: 2;
  display: flex;
  flex-direction: column;
  min-height: 300px;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 6%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 4%, hsl(var(--b2))));
}

.models-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 8%, rgba(255, 255, 255, 0.02)),
    color-mix(in srgb, v-bind(themeColors.secondary) 5%, rgba(255, 255, 255, 0.01)));
  border-bottom: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 15%, hsl(var(--bc) / 0.06));
  gap: 1rem;
}

.models-title-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.models-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: hsl(var(--bc));
  margin: 0;
  background: linear-gradient(135deg, 
    hsl(var(--bc)),
    color-mix(in srgb, v-bind(themeColors.accent) 40%, hsl(var(--bc))));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.filters-section {
  padding: 0.5rem;
  border-bottom: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 15%, hsl(var(--bc) / 0.06));
  background: linear-gradient(180deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 4%, rgba(255, 255, 255, 0.02)),
    color-mix(in srgb, v-bind(themeColors.secondary) 3%, rgba(255, 255, 255, 0.01)));
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 8%, rgba(255, 255, 255, 0.02)),
    color-mix(in srgb, v-bind(themeColors.secondary) 5%, rgba(255, 255, 255, 0.01)));
  border-bottom: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.08));
  min-height: 40px;
  position: relative;
  overflow: hidden;
}

.panel-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 5%, transparent),
    color-mix(in srgb, v-bind(themeColors.secondary) 3%, transparent),
    color-mix(in srgb, v-bind(themeColors.accent) 4%, transparent));
  pointer-events: none;
}

.panel-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: hsl(var(--bc));
  margin: 0;
  flex: 1;
  position: relative;
  z-index: 1;
  letter-spacing: -0.01em;
  background: linear-gradient(135deg, 
    hsl(var(--bc)),
    color-mix(in srgb, v-bind(themeColors.primary) 40%, hsl(var(--bc))));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.panel-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.model-count {
  font-size: 0.75rem;
  color: hsl(var(--bc) / 0.7);
  font-weight: 500;
}

.panel-content {
  padding: 0.375rem;
  min-height: 0;
  overflow-y: auto;
  flex: 1;
}

.models-content {
  padding: 0;
  padding-top: 0.5rem;
}

/* Icon Button */
.icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 8%, rgba(255, 255, 255, 0.05)),
    color-mix(in srgb, v-bind(themeColors.secondary) 6%, rgba(255, 255, 255, 0.02)));
  color: hsl(var(--bc) / 0.8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.08));
  position: relative;
  z-index: 1;
  backdrop-filter: blur(8px);
}

.icon-btn:hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 15%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 12%, hsl(var(--b2))));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, v-bind(themeColors.primary) 20%, transparent);
}

.icon-btn.active {
  background: linear-gradient(135deg, 
    v-bind(themeColors.primary), 
    v-bind(themeColors.secondary));
  color: white;
  border-color: v-bind(themeColors.primary);
  box-shadow: 0 4px 15px color-mix(in srgb, v-bind(themeColors.primary) 40%, transparent);
}

/* Overview Stats */
.overview-stats {
  display: flex;
  gap: 0.375rem;
  justify-content: space-between;
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 0.375rem;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 4%, rgba(255, 255, 255, 0.03)),
    color-mix(in srgb, v-bind(themeColors.secondary) 3%, rgba(255, 255, 255, 0.01)));
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 15%, hsl(var(--bc) / 0.08));
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
}

.stat-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, 
    transparent,
    v-bind(themeColors.primary),
    transparent);
  opacity: 0.6;
}

.stat-number {
  font-size: 1.125rem;
  font-weight: 800;
  background: linear-gradient(135deg,
    v-bind(themeColors.primary),
    v-bind(themeColors.secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: block;
  line-height: 1;
  margin-bottom: 0.125rem;
}

.stat-label {
  font-size: 0.625rem;
  color: hsl(var(--bc) / 0.6);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

/* Provider Status */
.provider-status {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.provider-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 8%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.primary) 5%, hsl(var(--b2))));
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.1));
  font-size: 0.75rem;
  opacity: 0.7;
  transition: all 0.2s ease;
}

.provider-indicator.connected {
  opacity: 1;
  border-color: color-mix(in srgb, v-bind(themeColors.primary) 40%, hsl(var(--bc) / 0.2));
}

.provider-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.provider-name {
  color: hsl(var(--bc));
  font-weight: 500;
}

/* Agents Grid */
.agents-grid {
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.agent-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.secondary) 4%, rgba(255, 255, 255, 0.04)),
    color-mix(in srgb, v-bind(themeColors.accent) 3%, rgba(255, 255, 255, 0.02)));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.secondary) 15%, hsl(var(--bc) / 0.08));
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  min-width: 100px;
  min-height: 80px;
  backdrop-filter: blur(10px);
  text-align: center;
  flex-shrink: 0;
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.25rem;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: hsl(var(--bc) / 0.3);
  transition: all 0.3s ease;
}

.status-indicator.active {
  background: linear-gradient(135deg, v-bind(themeColors.primary), v-bind(themeColors.secondary));
  box-shadow: 0 0 8px color-mix(in srgb, v-bind(themeColors.primary) 40%, transparent);
}

.agent-card:hover {
  transform: translateY(-1px);
  box-shadow: 
    0 4px 12px color-mix(in srgb, v-bind(themeColors.secondary) 20%, transparent),
    0 2px 4px rgba(0, 0, 0, 0.1);
  border-color: color-mix(in srgb, v-bind(themeColors.secondary) 25%, hsl(var(--bc) / 0.15));
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.secondary) 6%, rgba(255, 255, 255, 0.06)),
    color-mix(in srgb, v-bind(themeColors.accent) 4%, rgba(255, 255, 255, 0.03)));
}

.agent-card.configured {
  border-color: color-mix(in srgb, v-bind(themeColors.primary) 30%, hsl(var(--bc) / 0.2));
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 6%, rgba(255, 255, 255, 0.05)),
    color-mix(in srgb, v-bind(themeColors.secondary) 4%, rgba(255, 255, 255, 0.02)));
  box-shadow: 
    0 4px 16px color-mix(in srgb, v-bind(themeColors.primary) 10%, transparent),
    inset 0 1px 2px rgba(255, 255, 255, 0.05);
}

.agent-card.selected {
  border-color: color-mix(in srgb, v-bind(themeColors.primary) 60%, hsl(var(--bc) / 0.3));
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 10%, rgba(255, 255, 255, 0.08)),
    color-mix(in srgb, v-bind(themeColors.accent) 6%, rgba(255, 255, 255, 0.04)));
  box-shadow: 
    0 0 0 2px color-mix(in srgb, v-bind(themeColors.primary) 25%, transparent),
    0 8px 24px color-mix(in srgb, v-bind(themeColors.primary) 15%, transparent),
    inset 0 1px 2px rgba(255, 255, 255, 0.1);
}

.add-agent-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.5rem 0.25rem;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 4%, rgba(255, 255, 255, 0.03)),
    color-mix(in srgb, v-bind(themeColors.primary) 2%, rgba(255, 255, 255, 0.01)));
  border: 1px dashed color-mix(in srgb, v-bind(themeColors.accent) 25%, hsl(var(--bc) / 0.2));
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 60px;
  opacity: 0.8;
  position: relative;
  overflow: hidden;
  text-align: center;
}

.add-agent-card:hover {
  opacity: 1;
  border-color: color-mix(in srgb, v-bind(themeColors.primary) 35%, hsl(var(--bc) / 0.3));
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 6%, rgba(255, 255, 255, 0.05)),
    color-mix(in srgb, v-bind(themeColors.accent) 4%, rgba(255, 255, 255, 0.02)));
  transform: translateY(-1px);
  box-shadow: 
    0 4px 12px color-mix(in srgb, v-bind(themeColors.primary) 15%, transparent),
    0 2px 4px rgba(0, 0, 0, 0.1);
}

.add-agent-icon {
  color: hsl(var(--bc) / 0.7);
  transition: all 0.3s ease;
}

.add-agent-card .add-agent-icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.add-agent-card:hover .add-agent-icon {
  color: v-bind(themeColors.primary);
  transform: scale(1.05) rotate(90deg);
}

.add-agent-text {
  font-size: 0.6875rem;
  color: hsl(var(--bc) / 0.7);
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: all 0.3s ease;
  line-height: 1;
}

.add-agent-card:hover .add-agent-text {
  color: hsl(var(--bc) / 0.9);
}

.agent-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  flex-shrink: 0;
  box-shadow: 
    0 1px 4px rgba(0, 0, 0, 0.1),
    inset 0 1px 1px rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}

.agent-info {
  flex: 1;
  text-align: center;
  min-width: 0;
  width: 100%;
}

.agent-name {
  font-weight: 600;
  color: hsl(var(--bc));
  font-size: 0.6875rem;
  letter-spacing: -0.01em;
  line-height: 1;
}

.agent-model {
  font-size: 0.5625rem;
  color: hsl(var(--bc) / 0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.9;
  line-height: 1;
}

.agent-actions {
  display: flex;
  gap: 0.125rem;
  justify-content: center;
  margin-top: 0.125rem;
}

.action-btn {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 4px;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 10%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.primary) 6%, hsl(var(--b2))));
  color: hsl(var(--bc) / 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.action-btn:hover {
  opacity: 1;
  transform: scale(1.05);
}

.action-btn.clear:hover {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

.action-btn.delete:hover {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  color: white;
}

/* System Message Editor */
.system-message-editor {
  margin-top: 0.5rem;
  border-top: 1px solid color-mix(in srgb, v-bind(themeColors.secondary) 20%, hsl(var(--bc) / 0.1));
  padding-top: 0.5rem;
}

.editor-header {
  margin-bottom: 0.5rem;
}

.editor-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--bc) / 0.8);
}

.system-textarea {
  width: 100%;
  min-height: 60px;
  padding: 0.5rem;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.secondary) 5%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.accent) 3%, hsl(var(--b2))));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.secondary) 20%, hsl(var(--bc) / 0.1));
  border-radius: 8px;
  color: hsl(var(--bc));
  font-size: 0.75rem;
  resize: vertical;
  font-family: inherit;
}

.system-textarea:focus {
  outline: none;
  border-color: v-bind(themeColors.primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, v-bind(themeColors.primary) 20%, transparent);
}

/* Audio Settings */
.audio-settings {
  margin-top: 0.5rem;
  border-top: 1px solid color-mix(in srgb, v-bind(themeColors.secondary) 20%, hsl(var(--bc) / 0.1));
  padding-top: 0.5rem;
}

.audio-toggle-group {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.audio-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toggle-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--bc) / 0.8);
}

.audio-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.control-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.control-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--bc) / 0.7);
  min-width: fit-content;
}

.control-options {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.option-chip {
  padding: 0.25rem 0.5rem;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 6%, rgba(255, 255, 255, 0.03)),
    color-mix(in srgb, v-bind(themeColors.primary) 4%, rgba(255, 255, 255, 0.02)));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 15%, hsl(var(--bc) / 0.08));
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  color: hsl(var(--bc) / 0.8);
}

.option-chip:hover {
  border-color: color-mix(in srgb, v-bind(themeColors.primary) 25%, hsl(var(--bc) / 0.15));
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 8%, rgba(255, 255, 255, 0.04)),
    color-mix(in srgb, v-bind(themeColors.primary) 6%, rgba(255, 255, 255, 0.03)));
}

.option-chip.active {
  background: linear-gradient(135deg, v-bind(themeColors.primary), v-bind(themeColors.secondary));
  color: white;
  border-color: v-bind(themeColors.primary);
}


.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.2));
  transition: 0.4s;
  border-radius: 20px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background: v-bind(themeColors.primary);
}

input:checked + .toggle-slider:before {
  transform: translateX(20px);
}


.speed-slider {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.2));
  outline: none;
  -webkit-appearance: none;
}

.speed-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: v-bind(themeColors.primary);
  cursor: pointer;
}


/* Search Section */

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 300px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: hsl(var(--bc) / 0.4);
  z-index: 1;
  pointer-events: none;
  width: 14px;
  height: 14px;
}

.search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 3%, rgba(255, 255, 255, 0.04)),
    color-mix(in srgb, v-bind(themeColors.primary) 2%, rgba(255, 255, 255, 0.02)));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 15%, hsl(var(--bc) / 0.08));
  border-radius: 8px;
  color: hsl(var(--bc));
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  outline: none;
}

.search-input::placeholder {
  color: hsl(var(--bc) / 0.5);
  opacity: 1;
}

.search-input:focus::placeholder {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: color-mix(in srgb, v-bind(themeColors.primary) 40%, hsl(var(--bc) / 0.2));
  box-shadow: 
    0 0 0 3px color-mix(in srgb, v-bind(themeColors.primary) 15%, transparent),
    0 4px 12px color-mix(in srgb, v-bind(themeColors.primary) 10%, transparent);
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 5%, rgba(255, 255, 255, 0.06)),
    color-mix(in srgb, v-bind(themeColors.primary) 3%, rgba(255, 255, 255, 0.03)));
}

.clear-search {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: hsl(var(--bc) / 0.5);
  cursor: pointer;
  padding: 0.125rem;
  border-radius: 4px;
  transition: all 0.2s ease;
  z-index: 1;
}

.clear-search:hover {
  color: hsl(var(--bc));
  background: color-mix(in srgb, v-bind(themeColors.accent) 15%, hsl(var(--b1)));
}

.provider-filters, .quick-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.provider-chip, .filter-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 6%, rgba(255, 255, 255, 0.04)),
    color-mix(in srgb, v-bind(themeColors.primary) 4%, rgba(255, 255, 255, 0.02)));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 15%, hsl(var(--bc) / 0.08));
  border-radius: 12px;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(8px);
  letter-spacing: -0.01em;
}

.provider-chip:hover, .filter-chip:hover {
  border-color: color-mix(in srgb, v-bind(themeColors.primary) 25%, hsl(var(--bc) / 0.15));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, v-bind(themeColors.accent) 10%, transparent);
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 8%, rgba(255, 255, 255, 0.06)),
    color-mix(in srgb, v-bind(themeColors.primary) 6%, rgba(255, 255, 255, 0.03)));
}

.provider-chip.active, .filter-chip.active {
  background: linear-gradient(135deg, v-bind(themeColors.primary), v-bind(themeColors.secondary));
  color: white;
  border-color: transparent;
  box-shadow: 
    0 4px 16px color-mix(in srgb, v-bind(themeColors.primary) 25%, transparent),
    inset 0 1px 2px rgba(255, 255, 255, 0.2);
  font-weight: 700;
}

.chip-icon {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

/* Models List */
.models-grid {
  padding: 0.375rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.375rem;
}

.model-card {
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 2%, rgba(255, 255, 255, 0.02)),
    color-mix(in srgb, v-bind(themeColors.primary) 1%, rgba(255, 255, 255, 0.01)));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 10%, hsl(var(--bc) / 0.06));
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  gap: 0.5rem;
  min-height: 80px;
}

.model-card:hover {
  transform: translateY(-1px);
  box-shadow: 
    0 4px 12px color-mix(in srgb, v-bind(themeColors.accent) 15%, transparent),
    0 2px 4px rgba(0, 0, 0, 0.1);
  border-color: color-mix(in srgb, v-bind(themeColors.accent) 20%, hsl(var(--bc) / 0.12));
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 3%, rgba(255, 255, 255, 0.03)),
    color-mix(in srgb, v-bind(themeColors.primary) 2%, rgba(255, 255, 255, 0.02)));
}

.model-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.provider-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.model-info {
  flex: 1;
  min-width: 0;
}

.model-name {
  font-weight: 600;
  color: hsl(var(--bc));
  font-size: 0.75rem;
  line-height: 1.2;
  margin-bottom: 0.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-meta {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.625rem;
  color: hsl(var(--bc) / 0.6);
  flex-wrap: wrap;
}

.provider-name {
  font-weight: 500;
  text-transform: capitalize;
}

.free-indicator {
  color: #10b981;
  font-weight: 700;
}

.size-info, .context-info {
  opacity: 0.8;
}

.favorite-btn {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 8%, rgba(255, 255, 255, 0.04)),
    color-mix(in srgb, v-bind(themeColors.primary) 6%, rgba(255, 255, 255, 0.02)));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 15%, hsl(var(--bc) / 0.08));
  border-radius: 4px;
  padding: 0.25rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: hsl(var(--bc) / 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
}

.favorite-btn:hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 12%, rgba(255, 255, 255, 0.06)),
    color-mix(in srgb, v-bind(themeColors.primary) 8%, rgba(255, 255, 255, 0.03)));
  transform: translateY(-1px);
  box-shadow: 0 2px 8px color-mix(in srgb, v-bind(themeColors.accent) 20%, transparent);
}

.favorite-btn.active {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
  border-color: #f59e0b;
}

.assignment-actions {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.agent-btn {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 6%, rgba(255, 255, 255, 0.03)),
    color-mix(in srgb, v-bind(themeColors.primary) 4%, rgba(255, 255, 255, 0.02)));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 12%, hsl(var(--bc) / 0.08));
  border-radius: 4px;
  padding: 0.25rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: hsl(var(--bc) / 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
}

.agent-btn:hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 10%, rgba(255, 255, 255, 0.05)),
    color-mix(in srgb, v-bind(themeColors.primary) 6%, rgba(255, 255, 255, 0.03)));
  transform: translateY(-1px);
  box-shadow: 0 2px 8px color-mix(in srgb, v-bind(themeColors.accent) 15%, transparent);
}

.agent-btn.active {
  background: linear-gradient(135deg, var(--agent-color), color-mix(in srgb, var(--agent-color) 80%, white));
  color: white;
  border-color: var(--agent-color);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--agent-color) 30%, transparent);
}

.agent-emoji {
  font-size: 0.75rem;
}

.model-card.assigned {
  border-color: color-mix(in srgb, v-bind(themeColors.primary) 30%, hsl(var(--bc) / 0.2));
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 6%, rgba(255, 255, 255, 0.05)),
    color-mix(in srgb, v-bind(themeColors.accent) 4%, rgba(255, 255, 255, 0.02)));
  box-shadow: 
    0 6px 20px color-mix(in srgb, v-bind(themeColors.primary) 12%, transparent),
    inset 0 1px 2px rgba(255, 255, 255, 0.08);
}

.model-card.favorite::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, 
    transparent,
    #f59e0b,
    #fbbf24,
    #f59e0b,
    transparent);
  opacity: 0.8;
}

.model-header {
  padding: 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 12%, hsl(var(--bc) / 0.06));
  background: linear-gradient(180deg,
    rgba(255, 255, 255, 0.02),
    transparent);
}

.model-basic-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.model-provider-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.model-name-section {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.model-badges {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.model-name {
  font-weight: 700;
  color: hsl(var(--bc));
  font-size: 0.9375rem;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.favorite-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 10%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.primary) 6%, hsl(var(--b2))));
  color: hsl(var(--bc) / 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.favorite-btn:hover {
  transform: scale(1.05);
}

.favorite-btn.active {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
}

.model-details {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}


.model-description {
  font-size: 0.875rem;
  color: hsl(var(--bc) / 0.8);
  line-height: 1.4;
}

.capabilities {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.capability-tag {
  font-size: 0.625rem;
  padding: 0.3125rem 0.625rem;
  background: linear-gradient(135deg, v-bind(themeColors.primary), v-bind(themeColors.secondary));
  color: white;
  border-radius: 14px;
  font-weight: 600;
  text-transform: capitalize;
  box-shadow: 
    0 2px 6px color-mix(in srgb, v-bind(themeColors.primary) 30%, transparent),
    inset 0 1px 1px rgba(255, 255, 255, 0.2);
}

.performance-metrics {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.metric-label {
  font-size: 0.625rem;
  color: hsl(var(--bc) / 0.6);
  text-transform: uppercase;
  letter-spacing: 0.025em;
  font-weight: 500;
}

.metric-value {
  font-size: 0.75rem;
  color: hsl(var(--bc));
  font-weight: 600;
}

.assignment-section {
  padding: 0.75rem;
  border-top: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 12%, hsl(var(--bc) / 0.06));
  background: linear-gradient(180deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 3%, rgba(255, 255, 255, 0.03)),
    color-mix(in srgb, v-bind(themeColors.primary) 2%, rgba(255, 255, 255, 0.01)));
  backdrop-filter: blur(8px);
}

.assignment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.assignment-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--bc) / 0.8);
}

.current-assignment {
  font-size: 0.625rem;
  color: hsl(var(--bc) / 0.6);
  font-style: italic;
}

.agent-assignment-buttons {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.agent-assign-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 6%, rgba(255, 255, 255, 0.04)),
    color-mix(in srgb, v-bind(themeColors.primary) 4%, rgba(255, 255, 255, 0.02)));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 15%, hsl(var(--bc) / 0.08));
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.6875rem;
  backdrop-filter: blur(8px);
}

.agent-assign-btn:hover {
  border-color: color-mix(in srgb, v-bind(themeColors.primary) 25%, hsl(var(--bc) / 0.15));
  transform: translateY(-2px);
  box-shadow: 0 4px 12px color-mix(in srgb, v-bind(themeColors.accent) 10%, transparent);
  background: linear-gradient(145deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 8%, rgba(255, 255, 255, 0.06)),
    color-mix(in srgb, v-bind(themeColors.primary) 6%, rgba(255, 255, 255, 0.03)));
}

.agent-assign-btn.active {
  background: linear-gradient(135deg, var(--agent-color), color-mix(in srgb, var(--agent-color) 80%, white));
  color: white;
  border-color: var(--agent-color);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--agent-color) 30%, transparent);
}

.agent-emoji {
  font-size: 0.75rem;
}

.agent-name {
  font-weight: 500;
  color: hsl(var(--bc));
}

.agent-assign-btn.active .agent-name {
  color: white;
}

/* Load More Section */
.load-more-section {
  padding: 0.5rem;
  text-align: center;
}

.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: hsl(var(--bc) / 0.7);
  font-size: 0.875rem;
}

.load-more-btn {
  padding: 0.5rem 1.5rem;
  background: linear-gradient(135deg, v-bind(themeColors.primary), v-bind(themeColors.secondary));
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.75rem;
  letter-spacing: -0.01em;
  box-shadow: 
    0 4px 16px color-mix(in srgb, v-bind(themeColors.primary) 20%, transparent),
    inset 0 1px 2px rgba(255, 255, 255, 0.2);
}

.load-more-btn:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 
    0 8px 24px color-mix(in srgb, v-bind(themeColors.primary) 30%, transparent),
    0 4px 12px rgba(0, 0, 0, 0.15),
    inset 0 1px 3px rgba(255, 255, 255, 0.3);
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 110%, white), 
    color-mix(in srgb, v-bind(themeColors.secondary) 110%, white));
}

.end-indicator {
  color: hsl(var(--bc) / 0.6);
  font-size: 0.875rem;
  font-style: italic;
}

/* Create Form */
.create-form-overlay {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.secondary) 10%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.accent) 8%, hsl(var(--b2))));
  border-top: 1px solid color-mix(in srgb, v-bind(themeColors.secondary) 25%, hsl(var(--bc) / 0.1));
  z-index: 10;
}

.create-form {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-field {
  padding: 0.75rem;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.secondary) 5%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.accent) 3%, hsl(var(--b2))));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.secondary) 20%, hsl(var(--bc) / 0.1));
  border-radius: 8px;
  color: hsl(var(--bc));
  font-size: 0.875rem;
}

.form-field:focus {
  outline: none;
  border-color: v-bind(themeColors.primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, v-bind(themeColors.primary) 20%, transparent);
}

.emoji-field {
  text-align: center;
  font-size: 1.25rem;
}

.color-field {
  height: 48px;
  cursor: pointer;
  border-radius: 8px;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-primary {
  flex: 1;
  padding: 0.75rem;
  background: linear-gradient(135deg, v-bind(themeColors.primary), v-bind(themeColors.secondary));
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px color-mix(in srgb, v-bind(themeColors.primary) 40%, transparent);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  flex: 1;
  padding: 0.75rem;
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 10%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 8%, hsl(var(--b2))));
  color: hsl(var(--bc));
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 25%, hsl(var(--bc) / 0.1));
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, v-bind(themeColors.accent) 20%, transparent);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: hsl(var(--bc) / 0.6);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-message {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: hsl(var(--bc) / 0.8);
}

.empty-hint {
  font-size: 0.875rem;
  color: hsl(var(--bc) / 0.6);
}

/* Responsive */
@media (max-width: 640px) {
  .overview-stats {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .agents-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .provider-filters, .quick-filters {
    justify-content: center;
  }

  .audio-panels {
    grid-template-columns: 1fr;
  }
}

/* Scrollbar Styling */
.panel-content::-webkit-scrollbar,
.models-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track,
.models-content::-webkit-scrollbar-track {
  background: color-mix(in srgb, v-bind(themeColors.primary) 5%, hsl(var(--b2)));
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb,
.models-content::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, v-bind(themeColors.primary), v-bind(themeColors.secondary));
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover,
.models-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 120%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 120%, hsl(var(--b2))));
}
</style>