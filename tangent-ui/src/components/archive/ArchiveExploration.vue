<template>
  <div class="archive-exploration">
    <!-- Search Interface -->
    <div class="search-section">
      <SearchInterface 
        @search="handleSearch"
        :results="archiveStore.searchResults"
        :loading="searchLoading"
        placeholder="Search conversations by content or topic..."
      />
    </div>

    <!-- Main Content Area -->
    <div class="exploration-content">
      <!-- Left Panel: Clusters and Insights -->
      <div class="left-panel">
        <!-- Analysis Controls -->
        <div class="analysis-controls">
          <button 
            @click="performAnalysis"
            :disabled="archiveStore.isAnalyzing"
            class="analyze-button"
          >
            {{ archiveStore.isAnalyzing ? 'Analyzing...' : 'Analyze Topics' }}
          </button>
          
          <div class="analysis-params">
            <label>
              Min Cluster Size:
              <input 
                type="number" 
                v-model="minClusterSize" 
                min="2" 
                max="20"
                :disabled="archiveStore.isAnalyzing"
              />
            </label>
          </div>
        </div>

        <!-- Insights Section -->
        <div v-if="archiveStore.insights.length > 0" class="insights-section">
          <h3>Insights</h3>
          <div class="insights-list">
            <InsightCard 
              v-for="insight in archiveStore.actionableInsights" 
              :key="insight.title"
              :insight="insight"
              @action-click="handleInsightAction(insight)"
            />
          </div>
        </div>

        <!-- Clusters Summary -->
        <div v-if="archiveStore.clustersSummary" class="clusters-summary">
          <h3>Topic Analysis</h3>
          <div class="summary-stats">
            <div class="summary-item">
              <span class="value">{{ archiveStore.clustersSummary.totalClusters }}</span>
              <span class="label">Topics Found</span>
            </div>
            <div class="summary-item">
              <span class="value">{{ archiveStore.clustersSummary.totalConversations }}</span>
              <span class="label">Conversations</span>
            </div>
            <div class="summary-item">
              <span class="value">{{ (archiveStore.clustersSummary.avgCompletionRate * 100).toFixed(0) }}%</span>
              <span class="label">Avg Completion</span>
            </div>
          </div>
          
          <div class="top-keywords">
            <h4>Popular Keywords</h4>
            <div class="keyword-tags">
              <span 
                v-for="keyword in archiveStore.clustersSummary.topKeywords" 
                :key="keyword"
                class="keyword-tag"
              >
                {{ keyword }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Topic Clusters -->
      <div class="right-panel">
        <div v-if="archiveStore.clusters.length === 0 && !archiveStore.isAnalyzing" class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>No Analysis Yet</h3>
          <p>Click "Analyze Topics" to discover patterns in your conversations</p>
        </div>

        <div v-else-if="archiveStore.isAnalyzing" class="loading-state">
          <div class="loading-spinner"></div>
          <p>Analyzing conversation patterns...</p>
        </div>

        <div v-else class="clusters-grid">
          <TopicCluster
            v-for="cluster in archiveStore.clusters"
            :key="cluster.id"
            :cluster="cluster"
            :is-selected="archiveStore.selectedCluster?.id === cluster.id"
            @click="selectCluster(cluster)"
            :show-details="true"
          />
        </div>
      </div>
    </div>

    <!-- Cluster Detail Modal -->
    <div v-if="archiveStore.selectedCluster" class="cluster-modal-overlay" @click="closeClusterModal">
      <div class="cluster-modal" @click.stop>
        <div class="modal-header">
          <h2>{{ archiveStore.selectedCluster.name }}</h2>
          <button @click="closeClusterModal" class="close-button">×</button>
        </div>
        
        <div class="modal-content">
          <div class="cluster-details">
            <div class="detail-item">
              <span class="label">Conversations:</span>
              <span class="value">{{ archiveStore.selectedCluster.size }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Completion Rate:</span>
              <span class="value">{{ (archiveStore.selectedCluster.completionRate * 100).toFixed(1) }}%</span>
            </div>
            <div class="detail-item">
              <span class="label">Avg Messages:</span>
              <span class="value">{{ archiveStore.selectedCluster.avgMessageCount.toFixed(1) }}</span>
            </div>
          </div>

          <div class="cluster-keywords">
            <h4>Keywords</h4>
            <div class="keyword-tags">
              <span 
                v-for="keyword in archiveStore.selectedCluster.keywords.slice(0, 10)" 
                :key="keyword"
                class="keyword-tag"
              >
                {{ keyword }}
              </span>
            </div>
          </div>

          <div class="cluster-conversations">
            <h4>Related Conversations</h4>
            <div class="conversation-list">
              <div 
                v-for="convId in archiveStore.selectedCluster.conversations.slice(0, 10)"
                :key="convId"
                class="conversation-item"
              >
                <span class="conv-id">{{ convId.slice(0, 8) }}...</span>
                <button @click="searchConversation(convId)" class="view-button">
                  View
                </button>
              </div>
            </div>
            
            <p v-if="archiveStore.selectedCluster.conversations.length > 10" class="more-conversations">
              And {{ archiveStore.selectedCluster.conversations.length - 10 }} more conversations...
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useArchiveStore } from '@/stores/archiveStore'
import SearchInterface from './SearchInterface.vue'
import TopicCluster from './TopicCluster.vue'
import InsightCard from './InsightCard.vue'
import type { TopicCluster as TopicClusterType, Insight } from '@/types/archive'

const archiveStore = useArchiveStore()

// Component state
const searchLoading = ref(false)
const minClusterSize = ref(3)

// Analysis
async function performAnalysis() {
  await archiveStore.analyzeClusters(minClusterSize.value)
  await archiveStore.generateInsights()
}

// Search
async function handleSearch(query: string) {
  searchLoading.value = true
  try {
    await archiveStore.searchConversations(query)
  } finally {
    searchLoading.value = false
  }
}

async function searchConversation(conversationId: string) {
  await handleSearch(conversationId)
}

// Cluster selection
function selectCluster(cluster: TopicClusterType) {
  archiveStore.selectCluster(cluster)
}

function closeClusterModal() {
  archiveStore.selectCluster(null)
}

// Insight actions
function handleInsightAction(insight: Insight) {
  if (insight.type === 'unfinished' && insight.metadata?.clusterId) {
    // Find the cluster and select it
    const cluster = archiveStore.clusters.find(c => c.id === insight.metadata?.clusterId)
    if (cluster) {
      selectCluster(cluster)
    }
  } else if (insight.type === 'suggestion') {
    // Search for related conversations
    if (insight.relatedConversations.length > 0) {
      handleSearch(insight.relatedConversations[0])
    }
  }
}

// Lifecycle
onMounted(() => {
  // Auto-load analysis if we have data but no clusters
  if (archiveStore.hasData && archiveStore.clusters.length === 0) {
    performAnalysis()
  }
})
</script>

<style scoped>
.archive-exploration {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem;
  height: 100%;
}

.search-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
}

.exploration-content {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1.5rem;
  flex: 1;
  min-height: 0;
}

.left-panel, .right-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 0;
}

.analysis-controls {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
}

.analyze-button {
  background: #4299e1;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  width: 100%;
  margin-bottom: 1rem;
}

.analyze-button:hover:not(:disabled) {
  background: #3182ce;
}

.analyze-button:disabled {
  background: #a0aec0;
  cursor: not-allowed;
}

.analysis-params {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.analysis-params label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: #4a5568;
}

.analysis-params input {
  width: 80px;
  padding: 0.375rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.875rem;
}

.insights-section, .clusters-summary {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
}

.insights-section h3, .clusters-summary h3 {
  margin: 0 0 1rem 0;
  color: #2d3748;
  font-size: 1.1rem;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 6px;
}

.summary-item .value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #2d3748;
}

.summary-item .label {
  font-size: 0.75rem;
  color: #718096;
  margin-top: 0.25rem;
}

.top-keywords h4 {
  margin: 0 0 0.75rem 0;
  color: #4a5568;
  font-size: 0.875rem;
  font-weight: 600;
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.keyword-tag {
  background: #edf2f7;
  color: #4a5568;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  border: 1px solid #e2e8f0;
}

.empty-state, .loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 3rem 2rem;
  color: #718096;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: #4a5568;
}

.loading-state p {
  margin: 1rem 0 0 0;
  color: #4a5568;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e2e8f0;
  border-top: 3px solid #4299e1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.clusters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  overflow-y: auto;
}

.cluster-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.cluster-modal {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h2 {
  margin: 0;
  color: #2d3748;
  font-size: 1.25rem;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #718096;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-button:hover {
  background: #f7fafc;
}

.modal-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.cluster-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 6px;
  text-align: center;
}

.detail-item .label {
  font-size: 0.875rem;
  color: #718096;
  margin-bottom: 0.25rem;
}

.detail-item .value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #2d3748;
}

.cluster-keywords h4, .cluster-conversations h4 {
  margin: 0 0 0.75rem 0;
  color: #2d3748;
  font-size: 1rem;
}

.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
}

.conversation-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.conv-id {
  font-family: monospace;
  font-size: 0.875rem;
  color: #4a5568;
}

.view-button {
  background: #38a169;
  color: white;
  border: none;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.view-button:hover {
  background: #2f855a;
}

.more-conversations {
  color: #718096;
  font-size: 0.875rem;
  text-align: center;
  margin: 0.75rem 0 0 0;
  font-style: italic;
}

@media (max-width: 768px) {
  .exploration-content {
    grid-template-columns: 1fr;
  }
  
  .cluster-modal-overlay {
    padding: 1rem;
  }
}
</style>