<template>
  <div class="tab-content">
    <!-- Stats and API Status Row -->
    <div class="agents-header-row section-top">
      <!-- Stats Mini Cards -->
      <div class="stats-row">
        <div class="mini-stat">
          <span class="stat-value">{{ totalModels }}</span>
          <span class="stat-label">Models</span>
        </div>
        <div class="mini-stat">
          <span class="stat-value">{{ freeModelsCount }}</span>
          <span class="stat-label">Free</span>
        </div>
        <div class="mini-stat">
          <span class="stat-value">{{ configuredAgentsCount }}/4</span>
          <span class="stat-label">Agents</span>
        </div>
      </div>

      <!-- API Status Icons -->
      <div class="api-status-row">
        <div v-for="provider in apiProviders" :key="provider.id" class="api-status-dot"
          :class="{ connected: isConnected(provider.id), error: hasError(provider.id) }"
          :title="`${provider.name}: ${getStatusText(provider.id)}`" @click="toggleProviderConfig(provider.id)">
          <img :src="getProviderIcon(provider.id)" class="status-icon" />
        </div>
      </div>
    </div>

    <!-- Two Column Layout -->
    <div class="main-columns section-middle">
      <!-- Left Column: Agents, System Messages, TTS, Whisper -->
      <div class="left-column">
        <div class="section-title">Active Agents</div>
        <div class="agents-compact">
          <div v-for="agent in allAgentTypes" :key="agent.id" class="agent-compact" :class="{
            configured: getAgentModel(agent.id),
            selected: selectedAgent === agent.id,
            custom: agent.isCustom
          }" :style="{ '--agent-color': agent.color }" @click="selectAgent(agent.id)">
            <div class="agent-icon-compact" :style="{ backgroundColor: agent.color + '15', color: agent.color }">
              {{ agent.emoji }}
            </div>
            <div class="agent-details-compact">
              <div class="agent-name-compact">{{ agent.name }}</div>
              <div class="agent-model-compact">{{ getAgentModel(agent.id)?.name || 'No model' }}</div>
            </div>
            <div class="agent-actions">
              <button v-if="getAgentModel(agent.id)" @click.stop="clearAgent(agent.id)" class="clear-compact">
                <X class="w-3 h-3" />
              </button>
              <button v-if="agent.isCustom" @click.stop="agentStore.removeAgent(agent.id)" class="delete-compact"
                title="Delete agent">
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>

          <!-- Add Custom Agent Button -->
          <button @click="showCustomAgentForm = !showCustomAgentForm" class="add-agent-btn">
            <Plus class="w-3 h-3" />
            <span>Create Custom Agent</span>
          </button>
        </div>

        <!-- System Message Section -->
        <div class="system-message-section">
          <div class="section-title">System Message</div>
          <div class="system-header">
            <span class="selected-agent">{{ selectedAgent ? 
              allAgentTypes.find(a => a.id === selectedAgent)?.name : 'Click an agent to edit its system message' }}</span>
          </div>
          <textarea v-if="selectedAgent" v-model="systemMessages[selectedAgent]" @input="updateSystemMessage"
            placeholder="Enter custom system message..." class="system-textarea"></textarea>
        </div>

        <!-- Text-to-Speech Section -->
        <div class="tts-section">
          <div class="section-header">
            <div class="section-title">Text-to-Speech</div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="ttsSettings.enabled" @change="updateTTSSettings" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div v-if="ttsSettings.enabled" class="tts-controls-compact">
            <div class="control-row">
              <label class="control-label-inline">Voice</label>
              <select v-model="ttsSettings.voice" @change="updateTTSSettings" class="tts-select-compact">
                <option value="alloy">Alloy</option>
                <option value="echo">Echo</option>
                <option value="fable">Fable</option>
                <option value="onyx">Onyx</option>
                <option value="nova">Nova</option>
                <option value="shimmer">Shimmer</option>
              </select>
            </div>

            <div class="control-row">
              <label class="control-label-inline">Speed</label>
              <input type="range" v-model.number="ttsSettings.speed" @input="updateTTSSettings" min="0.25" max="4.0"
                step="0.25" class="tts-range" />
              <span class="range-value">{{ ttsSettings.speed.toFixed(1) }}x</span>
            </div>

            <div class="tts-toggles">
              <label class="tts-toggle">
                <input type="checkbox" v-model="ttsSettings.autoRead" @change="updateTTSSettings" class="checkbox-compact" />
                <span>Auto-read</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Whisper.cpp Section -->
        <div class="whisper-section">
          <div class="section-header">
            <div class="section-title">Whisper.cpp</div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="whisperSettings.enabled" @change="updateWhisperSettings" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div v-if="whisperSettings.enabled" class="whisper-controls-compact">
            <div class="control-row">
              <label class="control-label-inline">Model Base (142 MB)</label>
              <select v-model="whisperSettings.model" @change="updateWhisperSettings" class="whisper-select-compact">
                <option v-for="model in whisperModels" :key="model.id" :value="model.id">
                  {{ model.name }}
                </option>
              </select>
            </div>

            <div class="control-row">
              <label class="control-label-inline">Language</label>
              <select v-model="whisperSettings.language" @change="updateWhisperSettings" class="whisper-select-compact">
                <option value="auto">Auto-detect</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ru">Russian</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
              </select>
            </div>

            <div class="control-row">
              <label class="control-label-inline">Threads</label>
              <input type="number" v-model.number="whisperSettings.threads" @input="updateWhisperSettings" min="1"
                max="16" class="whisper-input-compact" />
            </div>

            <div class="whisper-toggles">
              <label class="whisper-toggle">
                <input type="checkbox" v-model="whisperSettings.translate" @change="updateWhisperSettings" class="checkbox-compact" />
                <span>Translate to English</span>
              </label>

              <label class="whisper-toggle">
                <input type="checkbox" v-model="whisperSettings.diarize" @change="updateWhisperSettings" class="checkbox-compact" />
                <span>Speaker diarization</span>
              </label>

              <label class="whisper-toggle">
                <input type="checkbox" v-model="whisperSettings.timestamps" @change="updateWhisperSettings" class="checkbox-compact" />
                <span>Include timestamps</span>
              </label>
            </div>

            <div class="whisper-advanced">
              <button @click="showWhisperAdvanced = !showWhisperAdvanced" class="advanced-toggle">
                <ChevronDown class="w-3 h-3" :class="{ 'rotate-180': showWhisperAdvanced }" />
                Advanced
              </button>

              <div v-if="showWhisperAdvanced" class="advanced-controls">
                <div class="control-row">
                  <label class="control-label-inline">Temperature</label>
                  <input type="range" v-model.number="whisperSettings.temperature" @input="updateWhisperSettings"
                    min="0" max="1" step="0.1" class="whisper-range" />
                  <span class="range-value">{{ whisperSettings.temperature.toFixed(1) }}</span>
                </div>

                <div class="control-row">
                  <label class="control-label-inline">Beam size</label>
                  <input type="number" v-model.number="whisperSettings.beamSize" @input="updateWhisperSettings"
                    min="1" max="10" class="whisper-input-compact" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Model Browser -->
      <div class="right-column">
        <div class="model-browser">
          <div class="browser-header">
            <div class="section-title">Model Browser</div>
            <div class="model-count">{{ filteredModels.length }} models</div>
          </div>

          <!-- Compact Search & Filters -->
          <div class="search-filters-compact">
            <div class="search-row">
              <div class="search-wrapper-compact">
                <Search class="search-icon-compact" />
                <input v-model="searchQuery" type="text" placeholder="Search..." class="search-input-compact" />
              </div>
              <select v-model="activeProvider" class="provider-select-compact">
                <option value="all">All</option>
                <option value="ollama">Ollama</option>
                <option value="openrouter">OpenRouter</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
              </select>
            </div>
            
            <div class="quick-filters-compact">
              <button v-for="filter in quickFilters" :key="filter.id" @click="toggleFilter(filter.id)" 
                class="filter-chip-compact" :class="{ active: activeFilters.has(filter.id) }">
                {{ filter.label }}
              </button>
            </div>
          </div>

          <!-- Models List - Compact Cards -->
          <div class="models-list-compact">
            <div v-for="model in displayedModels" :key="model.id" class="model-card-compact" :class="{
              favorite: isModelFavorite(model),
              free: model.isFree
            }">
              <div class="model-row">
                <img :src="getProviderIcon(model.source)" class="model-icon-compact" />
                <div class="model-info-compact">
                  <div class="model-name-compact">{{ model.name }}</div>
                  <div class="model-meta-compact">
                    <span v-if="model.isFree" class="free-badge">FREE</span>
                    <span v-if="model.parameterSize" class="size-badge">{{ model.parameterSize }}</span>
                    <span v-if="model.contextLength" class="context-badge">{{ formatContext(model.contextLength) }}</span>
                  </div>
                </div>
                <button @click="toggleFavorite(model)" class="favorite-btn-compact"
                  :class="{ active: isModelFavorite(model) }">
                  <Star class="w-3 h-3" :class="{ 'fill-current': isModelFavorite(model) }" />
                </button>
              </div>

              <!-- Agent Assignment Row -->
              <div class="assignment-row">
                <span class="assign-label">Assign:</span>
                <div class="agent-assignment-btns">
                  <button v-for="agent in allAgentTypes" :key="agent.id" @click="setAsAgent(agent.id, model)"
                    class="agent-btn-compact" :class="{
                      active: getAgentModel(agent.id)?.id === model.id,
                      custom: agent.isCustom
                    }" :style="{ '--agent-color': agent.color }" :title="`Assign to ${agent.name}`">
                    {{ agent.emoji }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Load More -->
            <div class="load-more-compact">
              <div v-if="isLoadingMore" class="loading-compact">
                <Loader class="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </div>
              <button v-else-if="hasMoreModels" @click="loadMoreModels" class="load-more-btn-compact">
                Load {{ Math.min(itemsPerPage, remainingCount) }} more
              </button>
              <div v-else-if="displayedModels.length > 0" class="end-compact">
                All loaded
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import { useModelStore } from '@/stores/modelStore';
import { useAgentStore } from '@/stores/agentStore';
import { Check, X, Trash2, Plus, Search, Star, Loader, ChevronDown } from 'lucide-vue-next';

// Stores
const modelStore = useModelStore();
const agentStore = useAgentStore();

// Import provider icons
import ollamaIcon from '@/assets/ollama.jpeg';
import googleIcon from '@/assets/google.jpeg';
import anthropicIcon from '@/assets/anthropic.jpeg';
import openRouterIcon from '@/assets/unknown.jpeg'; // No OpenRouter icon available

// Props
interface Props {
  nodeId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  nodeId: ''
});

// Reactive state
const selectedAgent = ref<string | null>(null);
const showCustomAgentForm = ref(false);
const showApiConfig = ref(false);
const searchQuery = ref('');
const activeProvider = ref('all');
const activeFilters = ref(new Set<string>());
const currentPage = ref(0);
const itemsPerPage = 20;
const isLoadingMore = ref(false);
const isTesting = ref(false);
const showWhisperAdvanced = ref(false);

// API Keys
const apiKeys = reactive({
  anthropic: localStorage.getItem('anthropicApiKey') || '',
  openrouter: localStorage.getItem('openRouterApiKey') || '',
  google: localStorage.getItem('geminiApiKey') || ''
});

// API Providers
const apiProviders = [
  { id: 'anthropic', name: 'Anthropic', placeholder: 'Enter API key...' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'Enter API key...' },
  { id: 'google', name: 'Google', placeholder: 'Enter API key...' },
  { id: 'ollama', name: 'Ollama', placeholder: 'Local' }
];

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
  voice: localStorage.getItem('ttsVoice') || 'alloy',
  speed: parseFloat(localStorage.getItem('ttsSpeed') || '1.0'),
  autoRead: JSON.parse(localStorage.getItem('ttsAutoRead') || 'false')
});

// Whisper Settings
const whisperSettings = reactive({
  enabled: JSON.parse(localStorage.getItem('whisperEnabled') || 'false'),
  model: localStorage.getItem('whisperModel') || 'base',
  language: localStorage.getItem('whisperLanguage') || 'auto',
  threads: parseInt(localStorage.getItem('whisperThreads') || '4'),
  translate: JSON.parse(localStorage.getItem('whisperTranslate') || 'false'),
  diarize: JSON.parse(localStorage.getItem('whisperDiarize') || 'false'),
  timestamps: JSON.parse(localStorage.getItem('whisperTimestamps') || 'false'),
  temperature: parseFloat(localStorage.getItem('whisperTemperature') || '0.0'),
  beamSize: parseInt(localStorage.getItem('whisperBeamSize') || '5')
});

const whisperModels = [
  { id: 'tiny', name: 'Tiny (39 MB)' },
  { id: 'base', name: 'Base (142 MB)' },
  { id: 'small', name: 'Small (466 MB)' },
  { id: 'medium', name: 'Medium (1.5 GB)' },
  { id: 'large', name: 'Large (2.9 GB)' }
];

// Custom Agent Form
const customAgentForm = reactive({
  name: '',
  description: '',
  triggerPatterns: [''],
  tags: ['']
});

// Quick Filters
const quickFilters = [
  { id: 'free', label: 'Free' },
  { id: 'fast', label: 'Fast' },
  { id: 'large-context', label: 'Large Context' },
  { id: 'multimodal', label: 'Multimodal' },
  { id: 'reasoning', label: 'Reasoning' }
];

// Computed properties - copied from original AgentConfiguratorSidePanel
const agentTypes = ref([
  { id: 'text', name: 'Text Agent', emoji: '💬', color: '#3b82f6' },
  { id: 'vision', name: 'Vision Agent', emoji: '👁️', color: '#10b981' },
  { id: 'code', name: 'Code Agent', emoji: '💻', color: '#8b5cf6' },
  { id: 'router', name: 'Router Agent', emoji: '🎯', color: '#f59e0b' }
]);

const allAgentTypes = computed(() => {
  const customAgents = agentStore.customAgents.map(agent => ({
    id: agent.id,
    name: agent.name,
    emoji: '🤖',
    color: '#6366f1',
    isCustom: true
  }));
  return [...agentTypes.value, ...customAgents];
});

// Get all models from all providers - copied from original
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

// Methods
const getProviderIcon = (source: string) => {
  switch (source) {
    case 'ollama': return ollamaIcon;
    case 'google': return googleIcon;
    case 'anthropic': return anthropicIcon;
    case 'openrouter': return openRouterIcon;
    default: return openRouterIcon;
  }
};

const isConnected = (providerId: string) => {
  if (providerId === 'ollama') return true; // Local
  return !!apiKeys[providerId];
};

const hasError = (providerId: string) => {
  return false; // Placeholder for error checking logic
};

const getStatusText = (providerId: string) => {
  return isConnected(providerId) ? 'Connected' : 'Not configured';
};

const toggleProviderConfig = (providerId: string) => {
  showApiConfig.value = !showApiConfig.value;
};

const saveApiKey = (providerId: string) => {
  const key = apiKeys[providerId];
  if (key) {
    localStorage.setItem(`${providerId}ApiKey`, key);
    // TODO: Validate API key
  }
};

const selectAgent = (agentId: string) => {
  selectedAgent.value = selectedAgent.value === agentId ? null : agentId;
};

// Exact implementations from original AgentConfiguratorSidePanel
const getAgentModel = (agentId) => {
  // For standard agents, find by type
  const standardAgent = agentStore.agentConfigs.find(config => config.type === agentId && config.isDefault && config.enabled);
  if (standardAgent) return standardAgent.model || null;

  // For custom agents, find by ID
  const customAgent = agentStore.agentConfigs.find(config => config.id === agentId);
  return customAgent?.model || null;
};

const clearAgent = (agentId) => {
  // Check if it's a custom agent
  const customAgent = agentStore.agentConfigs.find(config => config.id === agentId);
  if (customAgent) {
    agentStore.updateAgentConfig(agentId, { model: null });
  } else {
    // For standard agents
    const config = agentStore.agentConfigs.find(config => config.type === agentId && config.isDefault);
    if (config) {
      agentStore.updateAgentConfig(config.id, { model: null });
    }
  }
};

const setAsAgent = (agentId, model) => {
  // For custom agents, update the specific agent config
  const customAgent = agentStore.agentConfigs.find(config => config.id === agentId);
  if (customAgent) {
    agentStore.updateAgentConfig(agentId, { model, enabled: true });
  } else {
    // For standard agents
    agentStore.setAgentModel(agentId, model);
  }
};

const toggleFilter = (filterId: string) => {
  if (activeFilters.value.has(filterId)) {
    activeFilters.value.delete(filterId);
  } else {
    activeFilters.value.add(filterId);
  }
};

// Favorite functions - copied from original AgentConfiguratorSidePanel
const isModelFavorite = (model) => {
  const favorites = JSON.parse(localStorage.getItem('favoriteModels') || '[]');
  return favorites.some(fav => fav.id === model.id);
};

const toggleModelFavorite = (model) => {
  const favorites = JSON.parse(localStorage.getItem('favoriteModels') || '[]');
  const index = favorites.findIndex(fav => fav.id === model.id);
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push(model);
  }
  localStorage.setItem('favoriteModels', JSON.stringify(favorites));
};

const toggleFavorite = (model: any) => {
  toggleModelFavorite(model);
};

const formatContext = (contextLength: number) => {
  if (contextLength >= 1000000) {
    return `${(contextLength / 1000000).toFixed(1)}M`;
  } else if (contextLength >= 1000) {
    return `${(contextLength / 1000).toFixed(0)}K`;
  }
  return contextLength.toString();
};

const loadMoreModels = () => {
  isLoadingMore.value = true;
  setTimeout(() => {
    currentPage.value++;
    isLoadingMore.value = false;
  }, 500);
};

// System Message Methods
const updateSystemMessage = () => {
  if (selectedAgent.value) {
    localStorage.setItem(`systemMessage_${selectedAgent.value}`, systemMessages[selectedAgent.value]);
  }
};

// TTS Methods
const updateTTSSettings = () => {
  localStorage.setItem('ttsEnabled', JSON.stringify(ttsSettings.enabled));
  localStorage.setItem('ttsVoice', ttsSettings.voice);
  localStorage.setItem('ttsSpeed', ttsSettings.speed.toString());
  localStorage.setItem('ttsAutoRead', JSON.stringify(ttsSettings.autoRead));
};

const testVoice = async () => {
  isTesting.value = true;
  try {
    // TODO: Implement TTS test
    setTimeout(() => {
      isTesting.value = false;
    }, 2000);
  } catch (error) {
    console.error('TTS test failed:', error);
    isTesting.value = false;
  }
};

// Whisper Methods
const updateWhisperSettings = () => {
  localStorage.setItem('whisperEnabled', JSON.stringify(whisperSettings.enabled));
  localStorage.setItem('whisperModel', whisperSettings.model);
  localStorage.setItem('whisperLanguage', whisperSettings.language);
  localStorage.setItem('whisperThreads', whisperSettings.threads.toString());
  localStorage.setItem('whisperTranslate', JSON.stringify(whisperSettings.translate));
  localStorage.setItem('whisperDiarize', JSON.stringify(whisperSettings.diarize));
  localStorage.setItem('whisperTimestamps', JSON.stringify(whisperSettings.timestamps));
  localStorage.setItem('whisperTemperature', whisperSettings.temperature.toString());
  localStorage.setItem('whisperBeamSize', whisperSettings.beamSize.toString());
};

// Initialize models
onMounted(async () => {
  // Initialize all providers
  await Promise.all([
    modelStore.initializeProvider('ollama'),
    modelStore.initializeProvider('anthropic'),
    modelStore.initializeProvider('openrouter'),
    modelStore.initializeProvider('google')
  ]);
});
</script>

<style scoped>
/* Copy exact CSS from AgentConfiguratorSidePanel.vue */
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
  min-height: 0;
  padding: 16px 0;
}

/* Agents Header Row */
.agents-header-row {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: linear-gradient(135deg, hsl(var(--b2)), hsl(var(--b3)));
  border-radius: 12px;
  border: 1px solid hsl(var(--b3));
  padding-right: 16px;
  padding-left: 16px;
}

.stats-row {
  display: flex;
  gap: 40px;
}

.mini-stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: hsl(var(--p));
}

.stat-label {
  display: block;
  font-size: 10px;
  color: hsl(var(--bc) / 0.7);
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.api-status-row {
  display: flex;
  gap: 12px;
}

.api-status-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.api-status-dot.connected {
  border-color: #10b981;
  background: #10b981;
}

.api-status-dot.error {
  border-color: #ef4444;
  background: #ef4444;
}

.api-status-dot:hover {
  transform: scale(1.1);
}

.status-icon {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  object-fit: contain;
}

/* Main Columns */
.main-columns {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
  flex-direction: row-reverse;
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  max-width: 18vw;
  gap: 16px;
  min-height: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  align-self: anchor-center;
  color: var(--text-primary);
  margin: 0;
}

/* Agents Compact */
.agents-compact {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-compact {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.agent-compact:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
}

.agent-compact.configured {
  border-color: var(--agent-color);
  background: linear-gradient(135deg, var(--agent-color)06, var(--agent-color)03);
}

.agent-compact.selected {
  border-color: var(--primary);
  background: linear-gradient(135deg, var(--primary)08, var(--primary)04);
  box-shadow: 0 0 0 2px var(--primary)20;
}

.agent-icon-compact {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.agent-details-compact {
  flex: 1;
  min-width: 0;
}

.agent-name-compact {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 2px 0;
}

.agent-model-compact {
  font-size: 10px;
  color: var(--text-secondary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-actions {
  display: flex;
  gap: 4px;
}

.clear-compact {
  background: none;
  border: 1px solid var(--border);
  padding: 3px;
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.clear-compact:hover {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
}

.add-agent-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
}

.add-agent-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary)05;
}

/* System Message Section */
.system-message-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.system-header {
  display: flex;
  justify-content: space-around;
  align-items: center;
  margin-bottom: 12px;
}

.selected-agent {
  font-size: 11px;
  color: var(--text-secondary);
  font-style: italic;
}

.system-textarea {
  width: 100%;
  min-height: 80px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  resize: vertical;
}

/* TTS Section */
.tts-section,
.whisper-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 34px;
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
  background-color: var(--border);
  transition: 0.4s;
  border-radius: 20px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: var(--primary);
}

input:checked + .toggle-slider:before {
  transform: translateX(14px);
}

.tts-controls-compact,
.whisper-controls-compact {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label-inline {
  width: 60px;
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.tts-select-compact,
.whisper-select-compact {
  flex: 1;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
}

.tts-range,
.whisper-range {
  flex: 1;
  height: 4px;
  background: var(--border);
  outline: none;
  border-radius: 2px;
}

.range-value {
  font-size: 10px;
  color: var(--text-secondary);
  min-width: 30px;
  text-align: right;
}

.whisper-input-compact {
  flex: 1;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
  max-width: 60px;
}

.tts-toggles,
.whisper-toggles {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tts-toggle,
.whisper-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-primary);
}

.checkbox-compact {
  width: 12px;
  height: 12px;
}

.whisper-advanced {
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.advanced-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
}

.advanced-controls {
  margin-top: 12px;
  padding-left: 12px;
  border-left: 2px solid var(--border);
}

/* Model Browser */
.model-browser {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.browser-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.model-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.search-filters-compact {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-row {
  display: flex;
  gap: 8px;
}

.search-wrapper-compact {
  position: relative;
  flex: 1;
}

.search-icon-compact {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
  pointer-events: none;
}

.search-input-compact {
  width: 100%;
  padding: 6px 6px 6px 28px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
}

.provider-select-compact {
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  min-width: 80px;
}

.quick-filters-compact {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.filter-chip-compact {
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 10px;
}

.filter-chip-compact.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* Models List */
.models-list-compact {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.model-card-compact {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  transition: all 0.2s ease;
  position: relative;
}

.model-card-compact:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 12px var(--shadow);
}

.model-card-compact.favorite {
  background: linear-gradient(135deg, #fbbf2410, #fbbf2405);
  border-color: #fbbf24;
}

.model-card-compact.free::after {
  content: 'FREE';
  position: absolute;
  top: 4px;
  right: 6px;
  background: #10b981;
  color: white;
  font-size: 8px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
}

.model-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.model-icon-compact {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: contain;
  flex-shrink: 0;
}

.model-info-compact {
  flex: 1;
  min-width: 0;
}

.model-name-compact {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 2px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-meta-compact {
  display: flex;
  gap: 4px;
  align-items: center;
}

.free-badge {
  background: #10b981;
  color: white;
  font-size: 8px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
}

.size-badge {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 8px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px;
}

.context-badge {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 8px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px;
}

.favorite-btn-compact {
  background: none;
  border: 1px solid var(--border);
  padding: 4px;
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.favorite-btn-compact.active {
  color: #fbbf24;
  border-color: #fbbf24;
}

.assignment-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.assign-label {
  font-size: 10px;
  color: var(--text-secondary);
}

.agent-assignment-btns {
  display: flex;
  gap: 4px;
}

.agent-btn-compact {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.agent-btn-compact:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.agent-btn-compact.active {
  background: var(--agent-color);
  border-color: var(--agent-color);
  color: white;
}

.load-more-compact {
  display: flex;
  justify-content: center;
  padding: 12px;
}

.loading-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}

.load-more-btn-compact {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
}

.load-more-btn-compact:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary)05;
}

.end-compact {
  color: var(--text-secondary);
  font-size: 11px;
  text-align: center;
  font-style: italic;
}

.rotate-180 {
  transform: rotate(180deg);
}
</style>