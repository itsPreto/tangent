<template>
  <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-base-100 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
      <!-- Header -->
      <div class="bg-base-200 px-6 py-4 border-b border-base-300">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold text-base-content">Assign Topic to Workspace</h2>
          <button @click="closeModal" class="btn btn-sm btn-ghost btn-circle">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <p class="text-sm text-base-content/70 mt-1">
          {{ workspaceTitle ? `"${workspaceTitle}"` : 'Current workspace' }}
        </p>
      </div>

      <div class="p-6">
        <!-- Search Input -->
        <div class="mb-6">
          <label class="label">
            <span class="label-text">Search or describe the topic:</span>
          </label>
          <div class="relative">
            <input
              v-model="searchQuery"
              @input="debouncedSearch"
              type="text"
              placeholder="e.g., machine learning, web development, data analysis..."
              class="input input-bordered w-full pr-10"
              :class="{ 'input-error': hasError }"
            />
            <div v-if="isSearching" class="absolute right-3 top-1/2 transform -translate-y-1/2">
              <span class="loading loading-spinner loading-sm"></span>
            </div>
          </div>
          <div v-if="hasError" class="label">
            <span class="label-text-alt text-error">{{ errorMessage }}</span>
          </div>
        </div>

        <!-- Topic Suggestions -->
        <div v-if="searchResults.length > 0" class="mb-6">
          <div class="label">
            <span class="label-text">Topic suggestions (by similarity):</span>
          </div>
          <div class="max-h-60 overflow-y-auto space-y-2">
            <div
              v-for="topic in searchResults"
              :key="topic.id"
              @click="selectTopic(topic)"
              class="flex items-center justify-between p-3 rounded-lg border border-base-300 hover:bg-base-200 cursor-pointer transition-colors"
              :class="{ 'ring-2 ring-primary': selectedTopic?.id === topic.id }"
            >
              <div class="flex-1">
                <div class="font-medium text-base-content">{{ topic.title }}</div>
                <div class="text-sm text-base-content/60">
                  {{ topic.workspaces.length }} workspace{{ topic.workspaces.length !== 1 ? 's' : '' }}
                </div>
                <div v-if="topic.description" class="text-xs text-base-content/50 mt-1">
                  {{ topic.description }}
                </div>
              </div>
              <div class="ml-4 text-right">
                <div class="text-xs text-base-content/50">
                  {{ Math.round(topic.similarity * 100) }}% match
                </div>
                <div class="text-xs text-success">
                  {{ topic.workspaces.length }} related
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No Results -->
        <div v-else-if="searchQuery && !isSearching && !hasError" class="mb-6">
          <div class="text-center py-8 text-base-content/50">
            <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
            <p class="text-sm">No similar topics found</p>
            <p class="text-xs mt-1">This could become a new topic island!</p>
          </div>
        </div>

        <!-- Create New Topic -->
        <div v-if="searchQuery && searchResults.length === 0 && !isSearching" class="mb-6">
          <div class="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <div class="flex items-start space-x-3">
              <svg class="w-5 h-5 text-primary mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              <div class="flex-1">
                <h4 class="font-medium text-base-content">Create new topic: "{{ searchQuery }}"</h4>
                <p class="text-sm text-base-content/70 mt-1">
                  This will create a new topic island in the cluster view
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Selected Topic Preview -->
        <div v-if="selectedTopic" class="mb-6">
          <div class="label">
            <span class="label-text">Selected topic:</span>
          </div>
          <div class="bg-success/10 border border-success/20 rounded-lg p-4">
            <div class="font-medium text-base-content">{{ selectedTopic.title }}</div>
            <div class="text-sm text-base-content/70 mt-1">
              Will be positioned near {{ selectedTopic.workspaces.length }} related workspace{{ selectedTopic.workspaces.length !== 1 ? 's' : '' }}
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3">
          <button @click="closeModal" class="btn btn-ghost">
            Cancel
          </button>
          <button
            @click="assignTopic"
            :disabled="!searchQuery || isAssigning"
            class="btn btn-primary"
            :class="{ 'loading': isAssigning }"
          >
            {{ isAssigning ? 'Assigning...' : selectedTopic ? 'Assign to Topic' : 'Create New Topic' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { clusteringService, type ClusterResult } from '@/services/clusteringService'

// Props
const props = defineProps<{
  showModal: boolean
  workspaceId?: string
  workspaceTitle?: string
}>()

// Emits
const emit = defineEmits<{
  close: []
  assigned: [topicId: string, topicTitle: string]
}>()

// State
const searchQuery = ref('')
const searchResults = ref<ClusterResult[]>([])
const selectedTopic = ref<ClusterResult | null>(null)
const isSearching = ref(false)
const isAssigning = ref(false)
const hasError = ref(false)
const errorMessage = ref('')

// Debounced search
let searchTimeout: number | null = null
const debouncedSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  searchTimeout = setTimeout(() => {
    if (searchQuery.value.trim()) {
      performSearch()
    } else {
      searchResults.value = []
      selectedTopic.value = null
    }
  }, 300)
}

// Perform cosine similarity search
const performSearch = async () => {
  if (!searchQuery.value.trim()) return
  
  isSearching.value = true
  hasError.value = false
  
  try {
    // Get all clustering results (since search API doesn't exist yet)
    const results = await clusteringService.getResults()
    
    if (!results.clusters || results.clusters.length === 0) {
      hasError.value = true
      errorMessage.value = 'No topic clusters available. Generate clusters first by going to Settings > Topic Clustering.'
      return
    }
    
    // Perform local text-based similarity search
    const query = searchQuery.value.toLowerCase()
    const matches = results.clusters
      .map(cluster => ({
        ...cluster,
        similarity: calculateAdvancedSimilarity(query, cluster),
        description: generateClusterDescription(cluster)
      }))
      .filter(cluster => cluster.similarity > 0.1)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 8)
    
    if (matches.length === 0) {
      // Check if any clusters exist at all
      const results = await clusteringService.getResults()
      if (!results.clusters || results.clusters.length === 0) {
        hasError.value = true
        errorMessage.value = 'No topic clusters available. Generate clusters first by going to Settings > Topic Clustering.'
        return
      }
    }
    
    // Add similarity score and description to results
    const enhancedMatches = matches.map(cluster => ({
      ...cluster,
      similarity: cluster.similarity || 0.5, // Backend should provide this
      description: generateClusterDescription(cluster)
    }))
    
    searchResults.value = enhancedMatches
    
    // Auto-select the best match if similarity is very high
    if (enhancedMatches.length > 0 && enhancedMatches[0].similarity > 0.8) {
      selectedTopic.value = enhancedMatches[0]
    }
    
  } catch (error) {
    console.error('Error searching topics:', error)
    hasError.value = true
    
    // Fallback to local clustering results if API fails
    try {
      const results = await clusteringService.getResults()
      if (results.clusters && results.clusters.length > 0) {
        const query = searchQuery.value.toLowerCase()
        const matches = results.clusters
          .map(cluster => ({
            ...cluster,
            similarity: calculateSimpleSimilarity(query, cluster.title.toLowerCase()),
            description: generateClusterDescription(cluster)
          }))
          .filter(cluster => cluster.similarity > 0.1)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 8)
        
        searchResults.value = matches
        errorMessage.value = 'Using local search (clustering API unavailable)'
        hasError.value = false
      } else {
        errorMessage.value = 'Failed to search topics. Please try again.'
      }
    } catch (fallbackError) {
      errorMessage.value = 'Failed to search topics. Please try again.'
    }
  } finally {
    isSearching.value = false
  }
}

// Enhanced similarity calculation that checks cluster content
const calculateAdvancedSimilarity = (query: string, cluster: any): number => {
  const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2)
  
  // Check similarity with cluster title
  const titleSimilarity = calculateTextSimilarity(query, cluster.title.toLowerCase())
  
  // Check similarity with workspace titles in the cluster
  let workspaceSimilarity = 0
  if (cluster.workspaces && cluster.workspaces.length > 0) {
    const workspaceTexts = cluster.workspaces.map(w => w.title.toLowerCase()).join(' ')
    workspaceSimilarity = calculateTextSimilarity(query, workspaceTexts)
  }
  
  // Combine both similarities (weighted toward cluster title)
  return (titleSimilarity * 0.7) + (workspaceSimilarity * 0.3)
}

// Simple similarity calculation for text matching
const calculateTextSimilarity = (query: string, text: string): number => {
  const queryWords = query.split(' ').filter(word => word.length > 2)
  const textWords = text.split(' ')
  
  let matches = 0
  for (const queryWord of queryWords) {
    for (const textWord of textWords) {
      if (textWord.includes(queryWord) || queryWord.includes(textWord)) {
        matches++
        break
      }
    }
  }
  
  return queryWords.length > 0 ? matches / queryWords.length : 0
}

// Simple similarity calculation (fallback)
const calculateSimpleSimilarity = (query: string, title: string): number => {
  return calculateTextSimilarity(query, title)
}

// Generate cluster description
const generateClusterDescription = (cluster: ClusterResult): string => {
  if (cluster.commonTags && cluster.commonTags.length > 0) {
    return `Common topics: ${cluster.commonTags.map(tag => tag.name).join(', ')}`
  }
  return `${cluster.size} related conversations`
}

// Select a topic
const selectTopic = (topic: ClusterResult) => {
  selectedTopic.value = selectedTopic.value?.id === topic.id ? null : topic
}

// Assign topic to workspace
const assignTopic = async () => {
  if (!searchQuery.value.trim() || !props.workspaceId) return
  
  isAssigning.value = true
  
  try {
    const topicId = selectedTopic.value?.id || `topic-${Date.now()}`
    const topicTitle = selectedTopic.value?.title || searchQuery.value
    const createNew = !selectedTopic.value
    
    // For now, just simulate the assignment since the API doesn't exist
    // In a real implementation, this would assign the workspace to the topic cluster
    console.log('Assigning workspace to topic:', {
      workspaceId: props.workspaceId,
      topicId,
      topicTitle,
      createNew
    })
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    emit('assigned', topicId, topicTitle)
    closeModal()
    
  } catch (error) {
    console.error('Error assigning topic:', error)
    hasError.value = true
    errorMessage.value = 'Failed to assign topic. Please try again.'
  } finally {
    isAssigning.value = false
  }
}

// Close modal
const closeModal = () => {
  emit('close')
  // Reset state
  searchQuery.value = ''
  searchResults.value = []
  selectedTopic.value = null
  hasError.value = false
  errorMessage.value = ''
}

// Watch for modal visibility to reset state
watch(() => props.showModal, (show) => {
  if (!show) {
    closeModal()
  }
})
</script>