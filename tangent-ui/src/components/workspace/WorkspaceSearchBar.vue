<template>
  <div class="search-bar-container" :class="{
    'left-panel-open': sidePanelOpen,
    'right-panel-open': rightPanelOpen, 
    'both-panels-open': sidePanelOpen && rightPanelOpen,
    'rag-panel-open': ragPanelOpen,
    'has-results': searchResults.length > 0
  }" :style="{
    marginBottom: ragPanelOpen ? '20vh' : '0'
  }">
    <div class="search-input-wrapper">
      <Search class="search-icon" />
      <input
        ref="searchInputRef"
        v-model="searchValue"
        type="text"
        class="search-input"
        placeholder="Search branches... (Ctrl+F to focus)"
        @input="handleInput"
        @keydown.escape="clearSearch"
        @keydown.enter="performSearch"
        @focus="showSuggestions = true"
      />
      
      <!-- Search type toggle -->
      <div class="search-type-toggle">
        <button 
          v-for="type in searchTypes" 
          :key="type.value"
          @click="searchType = type.value"
          :class="['type-btn', { active: searchType === type.value }]"
          :title="type.description"
        >
          {{ type.label }}
        </button>
      </div>
      
      <button v-if="searchValue" @click="clearSearch" class="clear-button">
        <X class="clear-icon" />
      </button>
      
      <!-- Loading indicator -->
      <div v-if="isSearching" class="search-loading">
        <div class="loading-spinner"></div>
      </div>
    </div>

    <!-- Search Suggestions -->
    <Transition name="slide-down">
      <div v-if="showSuggestions && suggestions.length > 0 && searchValue.length > 1" class="suggestions-dropdown">
        <div class="suggestions-header">Suggestions</div>
        <button 
          v-for="suggestion in suggestions.slice(0, 5)" 
          :key="suggestion"
          @click="selectSuggestion(suggestion)"
          class="suggestion-item"
        >
          <Search :size="14" />
          {{ suggestion }}
        </button>
      </div>
    </Transition>

    <!-- Search Results -->
    <Transition name="slide-down">
      <div v-if="searchResults.length > 0" class="search-results">
        <div class="results-header">
          <span class="results-count">{{ searchResults.length }} result{{ searchResults.length !== 1 ? 's' : '' }}</span>
          <button @click="clearSearch" class="close-results">
            <X :size="16" />
          </button>
        </div>
        
        <div class="results-list">
          <div 
            v-for="result in searchResults.slice(0, 10)" 
            :key="result.node_id"
            @click="navigateToNode(result)"
            class="result-item"
            :class="{ 'semantic-match': result.match_type === 'semantic' }"
          >
            <div class="result-icon">
              {{ getNodeTypeIcon(result.type) }}
            </div>
            <div class="result-content">
              <div class="result-title">
                <span v-html="highlightText(result.title)"></span>
                <span v-if="result.similarity" class="similarity-score">
                  {{ Math.round(result.similarity * 100) }}%
                </span>
              </div>
              <div class="result-summary">
                {{ getResultSummary(result) }}
              </div>
              <div v-if="result.content_preview" class="result-preview">
                {{ result.content_preview }}
              </div>
            </div>
          </div>
          
          <div v-if="searchResults.length > 10" class="more-results">
            and {{ searchResults.length - 10 }} more results...
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, computed, nextTick } from 'vue';
import { Search, X } from 'lucide-vue-next';
import { branchSearchService, type SearchResult } from '@/services/branchSearchService';
import { useCanvasStore } from '@/stores/canvasStore';

// Props
const props = defineProps({
  sidePanelOpen: {
    type: Boolean,
    default: false
  },
  rightPanelOpen: {
    type: Boolean,
    default: false
  },
  ragPanelOpen: {
    type: Boolean,
    default: false
  },
  currentChatId: {
    type: String,
    default: null
  }
});

// Emits
const emit = defineEmits(['navigate-to-node']);

// Stores
const canvasStore = useCanvasStore();

// Refs
const searchInputRef = ref<HTMLElement | null>(null);
const searchValue = ref('');
const searchType = ref<'hybrid' | 'text' | 'semantic'>('hybrid');
const searchResults = ref<SearchResult[]>([]);
const suggestions = ref<string[]>([]);
const showSuggestions = ref(false);
const isSearching = ref(false);
const searchTimeout = ref<number | null>(null);

// Search types configuration
const searchTypes = [
  { value: 'hybrid', label: 'Smart', description: 'Combines text and semantic search' },
  { value: 'text', label: 'Text', description: 'Exact text matching' },
  { value: 'semantic', label: 'Semantic', description: 'Meaning-based search' }
];

// Methods
const handleInput = async () => {
  showSuggestions.value = true;
  
  // Debounce search
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
  
  searchTimeout.value = setTimeout(async () => {
    if (searchValue.value.length > 1) {
      // Get suggestions
      suggestions.value = await branchSearchService.getSearchSuggestions(
        searchValue.value, 
        props.currentChatId
      );
      
      // Perform search for longer queries
      if (searchValue.value.length > 2) {
        await performSearch();
      }
    } else {
      suggestions.value = [];
      searchResults.value = [];
    }
  }, 300);
};

const performSearch = async () => {
  if (!searchValue.value.trim()) {
    searchResults.value = [];
    return;
  }
  
  isSearching.value = true;
  showSuggestions.value = false;
  
  try {
    const response = await branchSearchService.searchNodes(searchValue.value, {
      type: searchType.value,
      chat_id: props.currentChatId,
      limit: 20
    });
    
    searchResults.value = response.results;
  } catch (error) {
    console.error('Search error:', error);
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
};

const clearSearch = () => {
  searchValue.value = '';
  searchResults.value = [];
  suggestions.value = [];
  showSuggestions.value = false;
  searchInputRef.value?.focus();
  
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
};

const selectSuggestion = (suggestion: string) => {
  searchValue.value = suggestion;
  showSuggestions.value = false;
  performSearch();
};

const navigateToNode = (result: SearchResult) => {
  emit('navigate-to-node', result);
  showSuggestions.value = false;
};

const focusInput = () => {
  searchInputRef.value?.focus();
};

// Helper methods
const getNodeTypeIcon = (type: string): string => {
  return branchSearchService.getNodeTypeIcon(type);
};

const getResultSummary = (result: SearchResult): string => {
  return branchSearchService.getResultSummary(result);
};

const highlightText = (text: string): string => {
  if (!searchValue.value || searchType.value === 'semantic') {
    return text;
  }
  
  const query = searchValue.value.toLowerCase();
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(query);
  
  if (index === -1) return text;
  
  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);
  
  return `${before}<mark class="search-highlight">${match}</mark>${after}`;
};

// Event listeners
onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+F to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f' && document.activeElement !== searchInputRef.value) {
      e.preventDefault();
      focusInput();
    }
    // Escape to close suggestions/results
    if (e.key === 'Escape') {
      showSuggestions.value = false;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
});

onBeforeUnmount(() => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
});
defineExpose({
  focusInput
});
</script>

<style scoped>
.search-bar-container {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  width: 90%;
  max-width: 600px;
  transition: all 0.3s ease;
}

.search-bar-container.has-results {
  max-width: 800px;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  position: relative;
  background: rgba(var(--b1), 0.95);
  backdrop-filter: blur(20px);
  border-radius: 12px;
  padding: 12px 16px;
  border: 1px solid rgba(var(--bc), 0.15);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.search-input-wrapper:focus-within {
  border-color: rgba(var(--p), 0.5);
  box-shadow: 0 4px 20px rgba(var(--p), 0.15);
}

.search-icon {
  width: 18px;
  height: 18px;
  color: rgba(var(--bc), 0.6);
  margin-right: 12px;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  height: 24px;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: rgba(var(--bc), 0.9);
  margin-right: 12px;
}

.search-input::placeholder {
  color: rgba(var(--bc), 0.5);
}

.search-type-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 12px;
  padding: 4px;
  background: rgba(var(--bc), 0.05);
  border-radius: 8px;
}

.type-btn {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: rgba(var(--bc), 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.type-btn.active {
  background: rgba(var(--p), 0.15);
  color: rgba(var(--p), 1);
}

.type-btn:hover:not(.active) {
  background: rgba(var(--bc), 0.1);
  color: rgba(var(--bc), 0.8);
}

.clear-button, .close-results {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: background 0.2s ease;
}

.clear-button:hover, .close-results:hover {
  background: rgba(var(--bc), 0.1);
}

.clear-icon {
  width: 16px;
  height: 16px;
  color: rgba(var(--bc), 0.6);
}

.search-loading {
  margin-right: 8px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(var(--p), 0.2);
  border-top: 2px solid rgba(var(--p), 1);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Suggestions Dropdown */
.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(var(--b1), 0.95);
  backdrop-filter: blur(20px);
  border-radius: 12px;
  border: 1px solid rgba(var(--bc), 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 110;
  margin-top: 8px;
  overflow: hidden;
}

.suggestions-header {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(var(--bc), 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(var(--bc), 0.03);
  border-bottom: 1px solid rgba(var(--bc), 0.08);
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: rgba(var(--bc), 0.8);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  text-align: left;
}

.suggestion-item:hover {
  background: rgba(var(--bc), 0.05);
  color: rgba(var(--bc), 1);
}

.suggestion-item:last-child {
  border-bottom: none;
}

/* Search Results */
.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(var(--b1), 0.95);
  backdrop-filter: blur(20px);
  border-radius: 12px;
  border: 1px solid rgba(var(--bc), 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 110;
  margin-top: 8px;
  max-height: 400px;
  overflow: hidden;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(var(--bc), 0.03);
  border-bottom: 1px solid rgba(var(--bc), 0.08);
}

.results-count {
  font-size: 12px;
  font-weight: 600;
  color: rgba(var(--bc), 0.7);
}

.close-results {
  color: rgba(var(--bc), 0.6);
}

.results-list {
  max-height: 320px;
  overflow-y: auto;
  overflow-x: hidden;
}

.result-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(var(--bc), 0.05);
}

.result-item:hover {
  background: rgba(var(--bc), 0.03);
}

.result-item:last-child {
  border-bottom: none;
}

.result-item.semantic-match {
  border-left: 3px solid rgba(var(--p), 0.5);
}

.result-icon {
  font-size: 16px;
  margin-top: 2px;
  flex-shrink: 0;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.result-title span {
  font-size: 14px;
  font-weight: 600;
  color: rgba(var(--bc), 0.9);
  line-height: 1.3;
}

.similarity-score {
  font-size: 11px;
  font-weight: 500;
  color: rgba(var(--p), 0.8);
  background: rgba(var(--p), 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
  flex-shrink: 0;
}

.result-summary {
  font-size: 11px;
  color: rgba(var(--bc), 0.6);
  margin-bottom: 4px;
  line-height: 1.2;
}

.result-preview {
  font-size: 12px;
  color: rgba(var(--bc), 0.7);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.more-results {
  padding: 12px 16px;
  text-align: center;
  font-size: 12px;
  color: rgba(var(--bc), 0.6);
  background: rgba(var(--bc), 0.02);
  border-top: 1px solid rgba(var(--bc), 0.08);
}

/* Search Highlight */
.search-highlight {
  background: rgba(var(--p), 0.2);
  color: rgba(var(--p), 1);
  padding: 1px 2px;
  border-radius: 2px;
  font-weight: 600;
}

/* Transitions */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

/* Clustering Progress Indicator */
.clustering-progress {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 60;
}

.progress-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--wa)) l c h / 0.95),
    oklch(from oklch(var(--wa)) l c h / 0.8)
  );
  backdrop-filter: blur(10px);
  border-radius: 9999px;
  padding: 0.5rem 1rem;
  border: 1px solid oklch(from oklch(var(--wa)) l c h / 0.3);
  box-shadow: 0 4px 12px oklch(from oklch(var(--wa)) l c h / 0.2);
  color: oklch(var(--wac));
  min-width: 280px;
}

.progress-icon {
  flex-shrink: 0;
}

.spinning {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.progress-text {
  flex: 1;
  min-width: 0;
}

.progress-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
}

.progress-details {
  font-size: 0.625rem;
  opacity: 0.7;
  margin-top: 0.125rem;
  line-height: 1;
}

.progress-bar-container {
  width: 60px;
  height: 4px;
  background-color: oklch(from oklch(var(--wac)) l c h / 0.2);
  border-radius: 2px;
  overflow: hidden;
  flex-shrink: 0;
}

.progress-bar-fill {
  height: 100%;
  background-color: oklch(var(--wac));
  border-radius: 2px;
  transition: width 0.3s ease;
}

.stop-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 9999px;
  border: none;
  background: oklch(from oklch(var(--wac)) l c h / 0.1);
  color: oklch(from oklch(var(--wac)) l c h / 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.stop-btn:hover {
  background: oklch(from oklch(var(--wac)) l c h / 0.2);
  color: oklch(var(--wac));
}

/* Animation for clustering progress */
.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 0.3s ease;
}

.slide-in-enter-from {
  opacity: 0;
  transform: translateY(-50%) translateX(20px) scale(0.95);
}

.slide-in-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(20px) scale(0.95);
}


/* Responsive adjustments */
@media (max-width: 768px) {
  .search-input-wrapper {
    width: 20rem;
    max-width: 70vw;
  }
  
  .search-input-wrapper:hover {
    width: 22rem;
    max-width: 80vw;
  }
  
  .search-input-wrapper:focus-within {
    width: 24rem;
    max-width: 85vw;
  }
  
  .search-bar-container {
    padding: 0.75rem;
  }
}

@media (max-width: 480px) {
  .search-input-wrapper {
    width: 18rem;
    max-width: 80vw;
  }
  
  .search-input-wrapper:hover,
  .search-input-wrapper:focus-within {
    width: 20rem;
    max-width: 90vw;
  }
}

/* Panel-aware responsive positioning */
.both-panels-open .search-input-wrapper {
  width: 18rem;
  max-width: 90%;
}

.both-panels-open .search-bar-container {
  padding: 0.75rem;
}

.rag-panel-open .search-bar-container {
  transition: margin-bottom 0.3s ease;
}

/* Prevent overlap when RAG panel is open */
.rag-panel-open.both-panels-open .search-input-wrapper {
  width: 16rem;
  max-width: 85%;
}

/* Smaller clustering progress indicator when space is constrained */
.both-panels-open .clustering-progress {
  padding: 0.5rem 0.75rem;
  max-width: 16rem;
}

.both-panels-open .progress-text {
  font-size: 0.8rem;
}

.both-panels-open .progress-details {
  font-size: 0.7rem;
}
</style>