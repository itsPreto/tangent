import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ArchiveStats,
  ArchiveStatusResponse,
  TopicCluster,
  Insight,
  SearchResult,
  ArchiveUploadResult,
  ArchiveProcessingStatus,
  ClusterAnalysisResult,
  InsightsResult,
  SemanticSearchResult
} from '@/types/archive'

export const useArchiveStore = defineStore('archive', () => {
  // State
  const uploadProgress = ref(0)
  const uploadStatus = ref<ArchiveProcessingStatus | null>(null)
  const isUploading = ref(false)
  
  const stats = ref<ArchiveStats | null>(null)
  const status = ref<ArchiveStatusResponse | null>(null)
  
  const clusters = ref<TopicCluster[]>([])
  const insights = ref<Insight[]>([])
  
  const searchResults = ref<SearchResult[]>([])
  const lastSearchQuery = ref('')
  
  const activeTab = ref<'upload' | 'explore'>('upload')
  const selectedCluster = ref<TopicCluster | null>(null)
  const isAnalyzing = ref(false)
  
  const error = ref<string | null>(null)
  const lastUpdated = ref<number | null>(null)

  // Computed
  const hasData = computed(() => {
    return status.value?.databaseReady === true && status.value?.totalConversations > 0
  })

  const uploadProgressText = computed(() => {
    if (!uploadStatus.value) return ''
    
    switch (uploadStatus.value.stage) {
      case 'detecting':
        return 'Detecting file format...'
      case 'loading':
        return 'Loading conversation data...'
      case 'processing':
        return 'Processing conversations...'
      case 'embeddings':
        return 'Generating embeddings...'
      case 'complete':
        return 'Upload complete!'
      case 'error':
        return `Error: ${uploadStatus.value.error}`
      default:
        return 'Processing...'
    }
  })

  const clustersSummary = computed(() => {
    if (clusters.value.length === 0) return null
    
    const totalConversations = clusters.value.reduce((sum, cluster) => sum + cluster.size, 0)
    const avgCompletionRate = clusters.value.reduce((sum, cluster) => sum + cluster.completionRate, 0) / clusters.value.length
    const topKeywords = clusters.value
      .flatMap(cluster => cluster.keywords.slice(0, 3))
      .slice(0, 10)
    
    return {
      totalClusters: clusters.value.length,
      totalConversations,
      avgCompletionRate,
      topKeywords
    }
  })

  const unfinishedProjects = computed(() => {
    return insights.value
      .filter(insight => insight.type === 'unfinished')
      .sort((a, b) => b.confidence - a.confidence)
  })

  const actionableInsights = computed(() => {
    return insights.value
      .filter(insight => insight.actionable)
      .sort((a, b) => b.confidence - a.confidence)
  })

  // Actions
  async function uploadArchive(file: File, enableEmbeddings = true): Promise<ArchiveUploadResult> {
    isUploading.value = true
    uploadProgress.value = 0
    uploadStatus.value = null
    error.value = null

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('enable_embeddings', enableEmbeddings.toString())

      const response = await fetch('http://127.0.0.1:5050/api/archive/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result: ArchiveUploadResult = await response.json()
      
      uploadProgress.value = 100
      uploadStatus.value = { stage: 'complete', progress: 100 }
      lastUpdated.value = Date.now()
      
      // Refresh status after successful upload
      await fetchStatus()
      
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Upload failed'
      uploadStatus.value = { stage: 'error', progress: 0, error: error.value }
      throw err
    } finally {
      isUploading.value = false
    }
  }

  async function processExistingFile(filePath: string): Promise<ArchiveUploadResult> {
    isAnalyzing.value = true
    error.value = null

    try {
      const response = await fetch('http://127.0.0.1:5050/api/archive/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file_path: filePath })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Processing failed')
      }

      const result: ArchiveUploadResult = await response.json()
      lastUpdated.value = Date.now()
      
      // Refresh status after processing
      await fetchStatus()
      
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Processing failed'
      throw err
    } finally {
      isAnalyzing.value = false
    }
  }

  async function fetchStatus(): Promise<void> {
    try {
      const response = await fetch('http://127.0.0.1:5050/api/archive/status')
      
      if (!response.ok) {
        throw new Error('Failed to fetch archive status')
      }

      status.value = await response.json()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch status'
    }
  }

  async function fetchStats(): Promise<void> {
    try {
      const response = await fetch('http://127.0.0.1:5050/api/archive/stats')
      
      if (!response.ok) {
        throw new Error('Failed to fetch archive stats')
      }

      const rawStats = await response.json()
      
      // Convert date strings to Date objects if present
      if (rawStats.date_range) {
        stats.value = {
          ...rawStats,
          dateRange: {
            start: rawStats.date_range.start ? new Date(rawStats.date_range.start * 1000) : null,
            end: rawStats.date_range.end ? new Date(rawStats.date_range.end * 1000) : null,
            spanDays: rawStats.date_range.span_days
          }
        }
      } else {
        stats.value = rawStats
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch stats'
    }
  }

  async function analyzeClusters(minClusterSize = 3, nComponents = 50): Promise<void> {
    isAnalyzing.value = true
    error.value = null

    try {
      const params = new URLSearchParams({
        min_cluster_size: minClusterSize.toString(),
        n_components: nComponents.toString()
      })

      const response = await fetch(`http://127.0.0.1:5050/api/analytics/topics?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to analyze topics')
      }

      const result: ClusterAnalysisResult = await response.json()
      clusters.value = result.clusters
      lastUpdated.value = Date.now()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to analyze clusters'
    } finally {
      isAnalyzing.value = false
    }
  }

  async function generateInsights(): Promise<void> {
    try {
      const response = await fetch('http://127.0.0.1:5050/api/analytics/insights')
      
      if (!response.ok) {
        throw new Error('Failed to generate insights')
      }

      const result: InsightsResult = await response.json()
      insights.value = result.insights
      lastUpdated.value = Date.now()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to generate insights'
    }
  }

  async function searchConversations(query: string, limit = 10): Promise<void> {
    if (!query.trim()) {
      searchResults.value = []
      lastSearchQuery.value = ''
      return
    }

    try {
      const response = await fetch('http://127.0.0.1:5050/api/analytics/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, limit })
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const result: SemanticSearchResult = await response.json()
      searchResults.value = result.results
      lastSearchQuery.value = query
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Search failed'
      searchResults.value = []
    }
  }

  async function clearArchive(): Promise<void> {
    try {
      const response = await fetch('http://127.0.0.1:5050/api/archive/clear', {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to clear archive')
      }

      // Reset state
      resetState()
      lastUpdated.value = Date.now()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to clear archive'
    }
  }

  function setActiveTab(tab: 'upload' | 'explore'): void {
    activeTab.value = tab
    
    // Auto-load data when switching to explore tab
    if (tab === 'explore' && hasData.value && clusters.value.length === 0) {
      analyzeClusters()
      generateInsights()
    }
  }

  function selectCluster(cluster: TopicCluster | null): void {
    selectedCluster.value = cluster
  }

  function resetState(): void {
    uploadProgress.value = 0
    uploadStatus.value = null
    isUploading.value = false
    
    stats.value = null
    status.value = null
    
    clusters.value = []
    insights.value = []
    
    searchResults.value = []
    lastSearchQuery.value = ''
    
    activeTab.value = 'upload'
    selectedCluster.value = null
    isAnalyzing.value = false
    
    error.value = null
    lastUpdated.value = null
  }

  function clearError(): void {
    error.value = null
  }

  // Initialize store
  async function initialize(): Promise<void> {
    await fetchStatus()
    if (hasData.value) {
      await fetchStats()
    }
  }

  return {
    // State
    uploadProgress,
    uploadStatus,
    isUploading,
    stats,
    status,
    clusters,
    insights,
    searchResults,
    lastSearchQuery,
    activeTab,
    selectedCluster,
    isAnalyzing,
    error,
    lastUpdated,

    // Computed
    hasData,
    uploadProgressText,
    clustersSummary,
    unfinishedProjects,
    actionableInsights,

    // Actions
    uploadArchive,
    processExistingFile,
    fetchStatus,
    fetchStats,
    analyzeClusters,
    generateInsights,
    searchConversations,
    clearArchive,
    setActiveTab,
    selectCluster,
    resetState,
    clearError,
    initialize
  }
})