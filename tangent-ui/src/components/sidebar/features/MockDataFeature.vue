<template>
  <div class="mock-data-feature">
    <div class="section-title">Mock Archive Generator</div>
    <p class="section-description">
      Generate mock conversation archives for testing your upload and processing flow.
    </p>

    <!-- Configuration Form -->
    <div class="mock-config-grid">
      <div class="config-group">
        <label class="config-label">Platform</label>
        <select v-model="mockConfig.platform" class="config-select">
          <option value="chatgpt">ChatGPT</option>
          <option value="claude">Claude</option>
        </select>
      </div>
      <div class="config-group">
        <label class="config-label">Conversation Count</label>
        <input v-model.number="mockConfig.conversation_count" type="number" min="1" max="50"
          class="config-input" />
      </div>
      <div class="config-group">
        <label class="config-label">Max Messages per Conversation</label>
        <input v-model.number="mockConfig.max_messages_per_conversation" type="number" min="2" max="30"
          class="config-input" />
      </div>
      <div class="config-group">
        <label class="config-label">Content Theme</label>
        <select v-model="mockConfig.content_source" class="config-select">
          <option value="general">General</option>
          <option value="tech_support">Tech Support</option>
          <option value="creative">Creative</option>
          <option value="educational">Educational</option>
          <option value="business">Business</option>
          <option value="coding">Coding</option>
        </select>
      </div>
    </div>

    <!-- Advanced Configuration -->
    <div class="advanced-config-section">
      <div class="section-header">
        <h3>Advanced Settings</h3>
        <button @click="showAdvanced = !showAdvanced" class="toggle-btn">
          {{ showAdvanced ? 'Hide' : 'Show' }} Advanced
        </button>
      </div>

      <div v-if="showAdvanced" class="advanced-config-grid">
        <div class="config-group">
          <label class="config-label">Language</label>
          <select v-model="mockConfig.language" class="config-select">
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
            <option value="ja">Japanese</option>
            <option value="zh">Chinese</option>
          </select>
        </div>
        <div class="config-group">
          <label class="config-label">Date Range</label>
          <select v-model="mockConfig.date_range" class="config-select">
            <option value="recent">Recent (Last 30 days)</option>
            <option value="month">Last Month</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Last Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        <div class="config-group">
          <label class="config-label">User Personas</label>
          <input v-model.number="mockConfig.user_personas" type="number" min="1" max="10"
            class="config-input" placeholder="Number of different users" />
        </div>
        <div class="config-group">
          <label class="config-label">Include Metadata</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="mockConfig.include_timestamps" />
              <span>Timestamps</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="mockConfig.include_attachments" />
              <span>Attachments</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="mockConfig.include_reactions" />
              <span>Reactions</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Content Templates -->
    <div class="content-templates-section">
      <div class="section-title">Content Templates</div>
      <div class="templates-grid">
        <div v-for="template in contentTemplates" :key="template.id" 
          class="template-card" 
          :class="{ active: mockConfig.template_id === template.id }"
          @click="mockConfig.template_id = template.id">
          <div class="template-icon">{{ template.icon }}</div>
          <div class="template-info">
            <div class="template-name">{{ template.name }}</div>
            <div class="template-desc">{{ template.description }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="mock-actions">
      <button @click="generateMockData" :disabled="isGenerating" class="btn-primary mock-generate-btn">
        <Loader v-if="isGenerating" class="w-4 h-4 animate-spin" />
        <span v-if="isGenerating">Generating...</span>
        <span v-else>🎭 Generate & Download</span>
      </button>
      <button @click="previewMockData" :disabled="isGenerating" class="btn-secondary mock-preview-btn">
        <Eye class="w-4 h-4" />
        Preview Sample
      </button>
    </div>

    <!-- Status Messages -->
    <div v-if="mockError" class="error-message">
      <X class="w-4 h-4" />
      {{ mockError }}
    </div>
    <div v-if="mockSuccess" class="success-message">
      <Check class="w-4 h-4" />
      {{ mockSuccess }}
    </div>

    <!-- Generation Progress -->
    <div v-if="isGenerating" class="generation-progress">
      <div class="progress-header">
        <span class="progress-text">{{ generationStatus }}</span>
        <span class="progress-percent">{{ generationProgress }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${generationProgress}%` }"></div>
      </div>
    </div>

    <!-- Preview Section -->
    <div v-if="showPreview && previewData" class="mock-preview-section">
      <div class="preview-header">
        <h3>Generated Sample</h3>
        <button @click="showPreview = false" class="close-preview-btn">
          <X class="w-4 h-4" />
        </button>
      </div>
      <div class="preview-content">
        <div class="preview-metadata">
          <div class="metadata-item">
            <strong>Platform:</strong> {{ previewData.platform.toUpperCase() }}
          </div>
          <div class="metadata-item">
            <strong>Conversations:</strong> {{ previewData.conversation_count }}
          </div>
          <div class="metadata-item">
            <strong>Total Messages:</strong> {{ previewData.total_messages }}
          </div>
          <div class="metadata-item">
            <strong>File Size:</strong> {{ formatFileSize(previewData.estimated_size) }}
          </div>
        </div>
        <div class="preview-sample">
          <h4>Sample Conversation:</h4>
          <div class="sample-conversation">
            <div v-for="message in previewData.sample_messages" :key="message.id" 
              class="sample-message" :class="message.role">
              <div class="message-header">
                <span class="message-author">{{ message.author }}</span>
                <span class="message-time">{{ message.timestamp }}</span>
              </div>
              <div class="message-content">{{ message.content }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Configuration Summary -->
    <div v-if="mockConfig.platform" class="config-summary">
      <div class="summary-title">Configuration Summary</div>
      <div class="summary-details">
        <div class="summary-item">
          <strong>Platform:</strong> {{ mockConfig.platform.toUpperCase() }}
        </div>
        <div class="summary-item">
          <strong>Conversations:</strong> {{ mockConfig.conversation_count }}
        </div>
        <div class="summary-item">
          <strong>Max Messages:</strong> {{ mockConfig.max_messages_per_conversation }}
        </div>
        <div class="summary-item">
          <strong>Theme:</strong> {{ formatThemeName(mockConfig.content_source) }}
        </div>
        <div v-if="showAdvanced" class="summary-item">
          <strong>Language:</strong> {{ getLanguageName(mockConfig.language) }}
        </div>
        <div v-if="showAdvanced" class="summary-item">
          <strong>User Personas:</strong> {{ mockConfig.user_personas }}
        </div>
        <div class="summary-item">
          <strong>Estimated Size:</strong> {{ estimatedFileSize }}
        </div>
      </div>
    </div>

    <!-- Recent Generations -->
    <div v-if="recentGenerations.length > 0" class="recent-generations">
      <div class="section-title">Recent Generations</div>
      <div class="generations-list">
        <div v-for="generation in recentGenerations" :key="generation.id" class="generation-item">
          <div class="generation-info">
            <div class="generation-name">{{ generation.name }}</div>
            <div class="generation-meta">
              <span class="generation-date">{{ formatDate(generation.created_at) }}</span>
              <span class="generation-size">{{ formatFileSize(generation.file_size) }}</span>
              <span class="generation-platform">{{ generation.platform.toUpperCase() }}</span>
            </div>
          </div>
          <div class="generation-actions">
            <button @click="downloadGeneration(generation)" class="action-btn download">
              <Download class="w-4 h-4" />
            </button>
            <button @click="deleteGeneration(generation.id)" class="action-btn delete">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import { Loader, Eye, X, Check, Download, Trash2 } from 'lucide-vue-next';
import { mockDataService, type MockDataConfig } from '@/services/mockDataService';

// State
const showAdvanced = ref(false);
const showPreview = ref(false);
const isGenerating = ref(false);
const generationProgress = ref(0);
const generationStatus = ref('');
const mockError = ref('');
const mockSuccess = ref('');
const previewData = ref(null);
const recentGenerations = ref([]);

// Mock Configuration
const mockConfig = reactive<MockDataConfig>({
  platform: 'chatgpt',
  conversation_count: 5,
  max_messages_per_conversation: 10,
  content_source: 'general',
  language: 'en',
  date_range: 'recent',
  user_personas: 3,
  template_id: 'default',
  include_timestamps: true,
  include_attachments: false,
  include_reactions: false
});

// Content Templates
const contentTemplates = [
  {
    id: 'default',
    name: 'General Chat',
    description: 'Mixed topics and casual conversation',
    icon: '💬'
  },
  {
    id: 'technical',
    name: 'Technical Support',
    description: 'Troubleshooting and help desk scenarios',
    icon: '🔧'
  },
  {
    id: 'creative',
    name: 'Creative Writing',
    description: 'Story writing and creative collaboration',
    icon: '✨'
  },
  {
    id: 'educational',
    name: 'Educational',
    description: 'Learning and tutoring conversations',
    icon: '📚'
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Professional and work-related discussions',
    icon: '💼'
  },
  {
    id: 'coding',
    name: 'Programming',
    description: 'Code review and development help',
    icon: '💻'
  }
];

// Language mapping
const languageNames = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  zh: 'Chinese'
};

// Computed properties
const estimatedFileSize = computed(() => {
  const baseSize = mockConfig.conversation_count * mockConfig.max_messages_per_conversation * 150; // bytes per message
  const multiplier = mockConfig.include_attachments ? 1.5 : 1;
  return formatFileSize(baseSize * multiplier);
});

// Methods
const formatThemeName = (theme: string) => {
  return theme.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getLanguageName = (code: string) => {
  return languageNames[code] || code.toUpperCase();
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const generateMockData = async () => {
  if (isGenerating.value) return;
  
  isGenerating.value = true;
  mockError.value = '';
  mockSuccess.value = '';
  generationProgress.value = 0;
  generationStatus.value = 'Initializing generation...';
  
  try {
    // Simulate progress updates
    const progressSteps = [
      { progress: 10, status: 'Creating conversation structure...' },
      { progress: 30, status: 'Generating user personas...' },
      { progress: 50, status: 'Creating message content...' },
      { progress: 70, status: 'Adding metadata and timestamps...' },
      { progress: 90, status: 'Formatting and packaging...' },
      { progress: 100, status: 'Complete!' }
    ];
    
    for (const step of progressSteps) {
      await new Promise(resolve => setTimeout(resolve, 500));
      generationProgress.value = step.progress;
      generationStatus.value = step.status;
    }
    
    // Call the actual service
    const result = await mockDataService.generateMockData(mockConfig);
    
    if (result.success) {
      mockSuccess.value = `Successfully generated ${mockConfig.conversation_count} conversations! Download started.`;
      
      // Add to recent generations
      recentGenerations.value.unshift({
        id: Date.now(),
        name: `${mockConfig.platform}-mock-${mockConfig.conversation_count}-convos`,
        platform: mockConfig.platform,
        created_at: new Date().toISOString(),
        file_size: result.file_size || 0,
        download_url: result.download_url
      });
      
      // Keep only last 10 generations
      if (recentGenerations.value.length > 10) {
        recentGenerations.value = recentGenerations.value.slice(0, 10);
      }
      
      // Auto-download the file
      if (result.download_url) {
        const link = document.createElement('a');
        link.href = result.download_url;
        link.download = result.filename || 'mock-conversations.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } else {
      mockError.value = result.error || 'Failed to generate mock data';
    }
  } catch (error) {
    console.error('Error generating mock data:', error);
    mockError.value = 'An error occurred while generating mock data';
  } finally {
    isGenerating.value = false;
    generationProgress.value = 0;
    generationStatus.value = '';
  }
};

const previewMockData = async () => {
  try {
    const result = await mockDataService.generatePreview(mockConfig);
    if (result.success) {
      previewData.value = result.data;
      showPreview.value = true;
    } else {
      mockError.value = result.error || 'Failed to generate preview';
    }
  } catch (error) {
    console.error('Error generating preview:', error);
    mockError.value = 'An error occurred while generating preview';
  }
};

const downloadGeneration = (generation: any) => {
  if (generation.download_url) {
    const link = document.createElement('a');
    link.href = generation.download_url;
    link.download = generation.name + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const deleteGeneration = (id: number) => {
  recentGenerations.value = recentGenerations.value.filter(g => g.id !== id);
};

// Load recent generations on mount
onMounted(() => {
  const saved = localStorage.getItem('mock-generations');
  if (saved) {
    try {
      recentGenerations.value = JSON.parse(saved);
    } catch (error) {
      console.error('Error loading saved generations:', error);
    }
  }
});

// Save recent generations to localStorage
const saveGenerations = () => {
  localStorage.setItem('mock-generations', JSON.stringify(recentGenerations.value));
};

// Watch for changes to save automatically
import { watch } from 'vue';
watch(recentGenerations, saveGenerations, { deep: true });
</script>

<style scoped>
.mock-data-feature {
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--theme-text-primary);
  margin-bottom: 0.5rem;
}

.section-description {
  color: var(--theme-text-secondary);
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

/* Configuration Grid */
.mock-config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.config-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.config-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--theme-text-primary);
}

.config-input,
.config-select {
  padding: 0.5rem;
  border: 1px solid rgba(var(--theme-border-rgb), 0.3);
  border-radius: 6px;
  font-size: 0.875rem;
  background-color: var(--theme-background);
  color: var(--theme-text-primary);
  transition: border-color 0.2s ease;
}

.config-input:focus,
.config-select:focus {
  outline: none;
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 3px rgba(var(--theme-primary-rgb), 0.1);
}

/* Advanced Configuration */
.advanced-config-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(var(--theme-background-rgb), 0.5);
  border-radius: 8px;
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--theme-text-primary);
  margin: 0;
}

.toggle-btn {
  padding: 0.5rem 1rem;
  background: var(--theme-primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.advanced-config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--theme-text-primary);
}

/* Content Templates */
.content-templates-section {
  margin-bottom: 1.5rem;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 0.75rem;
}

.template-card {
  padding: 1rem;
  background: rgba(var(--theme-background-rgb), 0.5);
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.template-card:hover {
  background: rgba(var(--theme-primary-rgb), 0.05);
  border-color: rgba(var(--theme-primary-rgb), 0.3);
}

.template-card.active {
  background: rgba(var(--theme-primary-rgb), 0.1);
  border-color: var(--theme-primary);
}

.template-icon {
  font-size: 1.5rem;
}

.template-info {
  flex: 1;
}

.template-name {
  font-weight: 600;
  color: var(--theme-text-primary);
  margin-bottom: 0.25rem;
}

.template-desc {
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

/* Action Buttons */
.mock-actions {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--theme-primary);
  color: white;
  flex: 1;
}

.btn-secondary {
  background: transparent;
  color: var(--theme-primary);
  border: 1px solid var(--theme-primary);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Status Messages */
.error-message,
.success-message {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.error-message {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.success-message {
  background: rgba(34, 197, 94, 0.1);
  color: #15803d;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

/* Generation Progress */
.generation-progress {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(var(--theme-primary-rgb), 0.05);
  border-radius: 8px;
  border: 1px solid rgba(var(--theme-primary-rgb), 0.1);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.progress-text {
  font-size: 0.875rem;
  color: var(--theme-text-primary);
}

.progress-percent {
  font-weight: 600;
  color: var(--theme-primary);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(var(--theme-border-rgb), 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--theme-primary);
  transition: width 0.3s ease;
}

/* Preview Section */
.mock-preview-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(var(--theme-background-rgb), 0.5);
  border-radius: 8px;
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(var(--theme-border-rgb), 0.2);
}

.preview-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--theme-text-primary);
  margin: 0;
}

.close-preview-btn {
  padding: 0.25rem;
  background: transparent;
  border: none;
  color: var(--theme-text-secondary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-preview-btn:hover {
  background: rgba(var(--theme-text-rgb), 0.1);
}

.preview-content {
  display: grid;
  gap: 1rem;
}

.preview-metadata {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.metadata-item {
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

.preview-sample h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--theme-text-primary);
  margin-bottom: 0.75rem;
}

.sample-conversation {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
  border-radius: 6px;
  padding: 0.75rem;
  background: var(--theme-background);
}

.sample-message {
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(var(--theme-border-rgb), 0.1);
}

.sample-message:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.message-author {
  font-weight: 500;
  color: var(--theme-text-primary);
  font-size: 0.875rem;
}

.message-time {
  font-size: 0.75rem;
  color: var(--theme-text-secondary);
}

.message-content {
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
  line-height: 1.4;
}

.sample-message.user .message-author {
  color: var(--theme-primary);
}

.sample-message.assistant .message-author {
  color: var(--theme-secondary);
}

/* Configuration Summary */
.config-summary {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(var(--theme-secondary-rgb), 0.05);
  border-radius: 8px;
  border: 1px solid rgba(var(--theme-secondary-rgb), 0.1);
}

.summary-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--theme-text-primary);
  margin-bottom: 0.75rem;
}

.summary-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.summary-item {
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

/* Recent Generations */
.recent-generations {
  margin-bottom: 1rem;
}

.generations-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.generation-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(var(--theme-background-rgb), 0.5);
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.generation-item:hover {
  background: rgba(var(--theme-primary-rgb), 0.05);
}

.generation-info {
  flex: 1;
}

.generation-name {
  font-weight: 500;
  color: var(--theme-text-primary);
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.generation-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: var(--theme-text-secondary);
}

.generation-platform {
  padding: 0.125rem 0.5rem;
  background: rgba(var(--theme-primary-rgb), 0.1);
  color: var(--theme-primary);
  border-radius: 8px;
  font-weight: 500;
}

.generation-actions {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  padding: 0.5rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn.download {
  color: var(--theme-primary);
}

.action-btn.download:hover {
  background: rgba(var(--theme-primary-rgb), 0.1);
}

.action-btn.delete {
  color: #ef4444;
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.1);
}
</style>