<template>
  <div class="search-interface">
    <!-- Search Input -->
    <div class="search-input-container">
      <div class="search-input-wrapper">
        <div class="search-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        
        <input
          ref="searchInput"
          v-model="query"
          type="text"
          :placeholder="placeholder"
          @keyup.enter="performSearch"
          @input="handleInput"
          class="search-input"
          :disabled="loading"
        />
        
        <button
          v-if="query.length > 0"
          @click="clearSearch"
          class="clear-button"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      
      <button
        @click="performSearch"
        :disabled="!query.trim() || loading"
        class="search-button"
      >
        {{ loading ? 'Searching...' : 'Search' }}
      </button>
    </div>

    <!-- Search Options -->
    <div v-if="showOptions" class="search-options">
      <label class="option-item">
        <span>Results limit:</span>
        <select v-model="searchLimit" class="limit-select">
          <option value="5">5 results</option>
          <option value="10">10 results</option>
          <option value="20">20 results</option>
          <option value="50">50 results</option>
        </select>
      </label>
    </div>

    <!-- Search Results -->
    <div v-if="hasResults || loading" class="search-results">
      <div class="results-header">
        <h4 v-if="!loading">
          {{ results.length }} result{{ results.length !== 1 ? 's' : '' }}
          <span v-if="lastQuery" class="query-text">for "{{ lastQuery }}"</span>
        </h4>
        <div v-if="loading" class="loading-header">
          <div class="loading-spinner"></div>
          <span>Searching conversations...</span>
        </div>
      </div>

      <div v-if="!loading" class="results-list">
        <div
          v-for="(result, index) in results"
          :key="result.conversationId"
          class="result-item"
          @click="selectResult(result)"
        >
          <div class="result-header">
            <div class="result-title">
              {{ result.metadata.title || 'Untitled Conversation' }}
            </div>
            <div class="result-similarity">
              {{ (result.similarity * 100).toFixed(0) }}% match
            </div>
          </div>
          
          <div class="result-metadata">
            <span class="metadata-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {{ formatDate(result.metadata.createdAt) }}
            </span>
            
            <span class="metadata-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
              {{ result.metadata.messageCount }} messages
            </span>
            
            <span class="metadata-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
              {{ result.metadata.textLength.toLocaleString() }} chars
            </span>
          </div>
          
          <div class="result-content">
            <p>{{ truncateText(result.document, 200) }}</p>
          </div>
          
          <div class="result-id">
            ID: {{ result.conversationId.slice(0, 8) }}...
          </div>
        </div>
      </div>

      <div v-if="!loading && results.length === 0 && lastQuery" class="no-results">
        <div class="no-results-icon">🔍</div>
        <h4>No results found</h4>
        <p>Try different keywords or check your spelling</p>
      </div>
    </div>

    <!-- Search Tips -->
    <div v-if="showTips && !hasResults && !loading" class="search-tips">
      <h4>Search Tips</h4>
      <ul>
        <li>Use specific keywords related to your conversations</li>
        <li>Try searching for topics, technologies, or concepts</li>
        <li>Search terms are matched semantically, not just literally</li>
        <li>You can search for conversation IDs directly</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { SearchResult } from '@/types/archive'

const props = defineProps<{
  results: SearchResult[]
  loading?: boolean
  placeholder?: string
  showOptions?: boolean
  showTips?: boolean
}>()

const emit = defineEmits<{
  search: [query: string, limit?: number]
}>()

// Component state
const query = ref('')
const lastQuery = ref('')
const searchLimit = ref(10)
const searchInput = ref<HTMLInputElement>()

// Computed
const hasResults = computed(() => props.results.length > 0)

// Methods
function performSearch() {
  if (!query.value.trim() || props.loading) return
  
  lastQuery.value = query.value
  emit('search', query.value.trim(), searchLimit.value)
}

function clearSearch() {
  query.value = ''
  lastQuery.value = ''
}

function handleInput() {
  // Optional: implement debounced search
}

function selectResult(result: SearchResult) {
  // Emit the selected result or handle it as needed
  console.log('Selected result:', result)
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return 'Unknown date'
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } catch {
    return 'Unknown date'
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

// Watchers
watch(() => props.results, () => {
  // Scroll to results when they appear
  if (props.results.length > 0) {
    setTimeout(() => {
      const resultsElement = document.querySelector('.search-results')
      if (resultsElement) {
        resultsElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 100)
  }
})
</script>

<style scoped>
.search-interface {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-input-container {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.search-input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  transition: border-color 0.2s ease;
}

.search-input-wrapper:focus-within {
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.search-icon {
  position: absolute;
  left: 1rem;
  color: #718096;
  pointer-events: none;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 1rem 1rem 1rem 3rem;
  border: none;
  background: transparent;
  font-size: 1rem;
  color: #2d3748;
  outline: none;
}

.search-input::placeholder {
  color: #a0aec0;
}

.search-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.clear-button {
  position: absolute;
  right: 1rem;
  background: none;
  border: none;
  color: #718096;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-button:hover {
  background: #f7fafc;
  color: #4a5568;
}

.search-button {
  background: #4299e1;
  color: white;
  border: none;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.search-button:hover:not(:disabled) {
  background: #3182ce;
}

.search-button:disabled {
  background: #a0aec0;
  cursor: not-allowed;
}

.search-options {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #4a5568;
}

.limit-select {
  padding: 0.375rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
}

.search-results {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  overflow: hidden;
}

.results-header {
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
}

.results-header h4 {
  margin: 0;
  color: #2d3748;
  font-size: 1rem;
  font-weight: 600;
}

.query-text {
  color: #718096;
  font-weight: 400;
}

.loading-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #4a5568;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e2e8f0;
  border-top: 2px solid #4299e1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.results-list {
  max-height: 500px;
  overflow-y: auto;
}

.result-item {
  padding: 1.5rem;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.result-item:hover {
  background: #f8fafc;
}

.result-item:last-child {
  border-bottom: none;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  gap: 1rem;
}

.result-title {
  font-weight: 600;
  color: #2d3748;
  font-size: 1rem;
  line-height: 1.4;
  flex: 1;
}

.result-similarity {
  background: #edf2f7;
  color: #4a5568;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.result-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: #718096;
  font-size: 0.875rem;
}

.metadata-item svg {
  flex-shrink: 0;
}

.result-content {
  margin-bottom: 0.75rem;
}

.result-content p {
  margin: 0;
  color: #4a5568;
  font-size: 0.875rem;
  line-height: 1.5;
}

.result-id {
  font-family: monospace;
  font-size: 0.75rem;
  color: #a0aec0;
}

.no-results {
  padding: 3rem 2rem;
  text-align: center;
  color: #718096;
}

.no-results-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.no-results h4 {
  margin: 0 0 0.5rem 0;
  color: #4a5568;
  font-size: 1.125rem;
}

.no-results p {
  margin: 0;
  font-size: 0.875rem;
}

.search-tips {
  background: #f0fff4;
  border: 1px solid #c6f6d5;
  border-radius: 8px;
  padding: 1.5rem;
}

.search-tips h4 {
  margin: 0 0 1rem 0;
  color: #2f855a;
  font-size: 1rem;
}

.search-tips ul {
  margin: 0;
  padding-left: 1.25rem;
  color: #276749;
}

.search-tips li {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.4;
}

.search-tips li:last-child {
  margin-bottom: 0;
}

/* Responsive design */
@media (max-width: 640px) {
  .search-input-container {
    flex-direction: column;
  }
  
  .search-button {
    align-self: stretch;
  }
  
  .result-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .result-metadata {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>