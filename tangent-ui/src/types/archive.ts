export interface ArchiveStats {
  totalConversations: number
  totalMessages: number
  dateRange: {
    start: Date | null
    end: Date | null
    spanDays?: number
  } | null
  avgMessageCount: number
  messageCountDistribution?: {
    min: number
    max: number
    median: number
  }
  archiveFilesCount?: number
  databaseReady?: boolean
}

export interface TopicCluster {
  id: string
  label: number
  name: string
  size: number
  conversations: string[]
  keywords: string[]
  centroid: number[]
  completionRate: number
  avgMessageCount: number
  dateRange: {
    start: string | null
    end: string | null
  }
  topTitles: string[]
}

export interface ClusterAnalysisResult {
  clusters: TopicCluster[]
  stats: {
    totalConversations: number
    totalClusters: number
    noiseConversations: number
    clusteredConversations: number
    clusteringEfficiency: number
  }
  umapCoordinates: number[][]
  clusterLabels: number[]
}

export interface Insight {
  type: 'unfinished' | 'pattern' | 'suggestion' | 'error'
  title: string
  description: string
  actionable: boolean
  relatedConversations: string[]
  confidence: number
  metadata?: {
    clusterId?: string
    completionRate?: number
    size?: number
    suggestions?: string
  }
}

export interface InsightsResult {
  insights: Insight[]
  clusterCount: number
  generatedAt: number
}

export interface SearchResult {
  conversationId: string
  metadata: {
    conversation_id: string
    textLength: number
    messageCount: number
    createdAt: string
    title: string
  }
  document: string
  similarity: number
}

export interface SemanticSearchResult {
  query: string
  results: SearchResult[]
  totalResults: number
}

export interface ArchiveFile {
  name: string
  size: number
  modified: number
  path: string
}

export interface ArchiveUploadResult {
  success: boolean
  message: string
  chat_type?: string
  chatType?: string  // For backwards compatibility
  message_count?: number
  messageCount?: number  // For backwards compatibility
  conversation_count?: number
  conversationCount?: number  // For backwards compatibility
  created_workspaces?: number
  workspace_ids?: string[]
}

export interface ArchiveProcessingStatus {
  stage: 'detecting' | 'loading' | 'processing' | 'embeddings' | 'complete' | 'error'
  progress: number
  error?: string
}

export interface ArchiveStatusResponse {
  totalConversations: number
  totalEmbeddings: number
  archiveFilesCount: number
  databaseReady: boolean
  archiveFiles: ArchiveFile[]
}

export interface ArchiveState {
  // Upload state
  uploadProgress: number
  uploadStatus: ArchiveProcessingStatus | null
  isUploading: boolean
  
  // Archive statistics
  stats: ArchiveStats | null
  status: ArchiveStatusResponse | null
  
  // Analytics data
  clusters: TopicCluster[]
  insights: Insight[]
  
  // Search
  searchResults: SearchResult[]
  lastSearchQuery: string
  
  // UI state
  activeTab: 'upload' | 'explore'
  selectedCluster: TopicCluster | null
  isAnalyzing: boolean
  
  // Error handling
  error: string | null
  lastUpdated: number | null
}

// Component prop types
export interface ArchiveUploadProps {
  onUploadComplete?: (result: ArchiveUploadResult) => void
  onProgressUpdate?: (status: ArchiveProcessingStatus) => void
}

export interface ArchiveExplorationProps {
  clusters: TopicCluster[]
  insights: Insight[]
  onClusterSelect?: (cluster: TopicCluster) => void
  onSearch?: (query: string) => void
}

export interface TopicClusterProps {
  cluster: TopicCluster
  isSelected?: boolean
  onClick?: () => void
  showDetails?: boolean
}

export interface InsightCardProps {
  insight: Insight
  onActionClick?: () => void
}

export interface SearchInterfaceProps {
  onSearch: (query: string) => void
  results: SearchResult[]
  loading?: boolean
  placeholder?: string
}

// API request/response types
export interface ArchiveUploadRequest {
  file: File
  enableEmbeddings?: boolean
}

export interface ArchiveProcessRequest {
  filePath: string
}

export interface TopicsRequest {
  minClusterSize?: number
  nComponents?: number
}

export interface SearchRequest {
  query: string
  limit?: number
}

// Utility types
export type ArchiveAction = 
  | { type: 'SET_UPLOAD_PROGRESS'; payload: number }
  | { type: 'SET_UPLOAD_STATUS'; payload: ArchiveProcessingStatus }
  | { type: 'SET_UPLOADING'; payload: boolean }
  | { type: 'SET_STATS'; payload: ArchiveStats }
  | { type: 'SET_STATUS'; payload: ArchiveStatusResponse }
  | { type: 'SET_CLUSTERS'; payload: TopicCluster[] }
  | { type: 'SET_INSIGHTS'; payload: Insight[] }
  | { type: 'SET_SEARCH_RESULTS'; payload: { query: string; results: SearchResult[] } }
  | { type: 'SET_ACTIVE_TAB'; payload: 'upload' | 'explore' }
  | { type: 'SET_SELECTED_CLUSTER'; payload: TopicCluster | null }
  | { type: 'SET_ANALYZING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_LAST_UPDATED'; payload: number }
  | { type: 'RESET_STATE' }

export interface ArchiveConfig {
  maxFileSize: number
  supportedFormats: string[]
  embeddingModel: string
  clusteringParams: {
    minClusterSize: number
    nComponents: number
  }
}