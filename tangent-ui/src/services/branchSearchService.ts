import { ref } from 'vue'

export interface SearchMatch {
  type: 'title' | 'content'
  text?: string
  matches?: Array<[number, number]>
  contexts?: Array<{
    context: string
    match_start: number
    match_end: number
  }>
}

export interface SearchResult {
  node_id: string
  chat_id: string
  title: string
  type: string
  x: number
  y: number
  matches?: SearchMatch[]
  similarity?: number
  content_preview?: string
  score?: number
  text_score?: number
  semantic_score?: number
  combined_score?: number
  match_type: 'text' | 'semantic' | 'type_filter' | 'area_filter'
}

export interface SearchOptions {
  type?: 'text' | 'semantic' | 'hybrid'
  chat_id?: string
  limit?: number
  search_titles?: boolean
  search_content?: boolean
  case_sensitive?: boolean
  regex?: boolean
  similarity_threshold?: number
  text_weight?: number
  semantic_weight?: number
}

export interface SearchResponse {
  results: SearchResult[]
  query: string
  search_type: string
  total_results: number
  error?: string
}

class BranchSearchService {
  private baseUrl = 'http://127.0.0.1:5050'
  public isSearching = ref(false)
  public lastResults = ref<SearchResult[]>([])
  public lastQuery = ref('')
  public searchHistory = ref<string[]>([])
  public suggestions = ref<string[]>([])

  async searchNodes(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    if (!query.trim()) {
      return {
        results: [],
        query: '',
        search_type: options.type || 'hybrid',
        total_results: 0
      }
    }

    this.isSearching.value = true
    this.lastQuery.value = query

    try {
      const response = await fetch(`${this.baseUrl}/api/search/nodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          type: options.type || 'hybrid',
          chat_id: options.chat_id,
          limit: options.limit || 20,
          search_titles: options.search_titles !== false,
          search_content: options.search_content !== false,
          case_sensitive: options.case_sensitive || false,
          regex: options.regex || false,
          similarity_threshold: options.similarity_threshold || 0.7,
          text_weight: options.text_weight || 0.4,
          semantic_weight: options.semantic_weight || 0.6
        })
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`)
      }

      this.lastResults.value = result.results
      this.addToHistory(query)
      
      return result
      
    } catch (error) {
      console.error('Error searching nodes:', error)
      return {
        results: [],
        query,
        search_type: options.type || 'hybrid',
        total_results: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    } finally {
      this.isSearching.value = false
    }
  }

  async getSearchSuggestions(partialQuery: string, chatId?: string): Promise<string[]> {
    if (!partialQuery.trim() || partialQuery.length < 2) {
      return []
    }

    try {
      const params = new URLSearchParams({
        q: partialQuery.trim(),
        limit: '5'
      })
      
      if (chatId) {
        params.append('chat_id', chatId)
      }

      const response = await fetch(`${this.baseUrl}/api/search/suggestions?${params}`)
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`)
      }

      this.suggestions.value = result.suggestions
      return result.suggestions
      
    } catch (error) {
      console.error('Error getting search suggestions:', error)
      return []
    }
  }

  async searchNodesByType(nodeType: string, chatId?: string): Promise<SearchResult[]> {
    try {
      const params = new URLSearchParams({
        type: nodeType
      })
      
      if (chatId) {
        params.append('chat_id', chatId)
      }

      const response = await fetch(`${this.baseUrl}/api/search/nodes/by-type?${params}`)
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`)
      }

      return result.results
      
    } catch (error) {
      console.error('Error searching nodes by type:', error)
      return []
    }
  }

  /**
   * Add search query to history (max 20 items)
   */
  private addToHistory(query: string) {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return

    // Remove existing occurrence
    const existingIndex = this.searchHistory.value.indexOf(trimmedQuery)
    if (existingIndex > -1) {
      this.searchHistory.value.splice(existingIndex, 1)
    }

    // Add to beginning
    this.searchHistory.value.unshift(trimmedQuery)

    // Keep only last 20 items
    if (this.searchHistory.value.length > 20) {
      this.searchHistory.value = this.searchHistory.value.slice(0, 20)
    }

    // Persist to localStorage
    try {
      localStorage.setItem('tangent-search-history', JSON.stringify(this.searchHistory.value))
    } catch (error) {
      console.warn('Failed to save search history:', error)
    }
  }

  /**
   * Load search history from localStorage
   */
  loadSearchHistory() {
    try {
      const saved = localStorage.getItem('tangent-search-history')
      if (saved) {
        this.searchHistory.value = JSON.parse(saved)
      }
    } catch (error) {
      console.warn('Failed to load search history:', error)
      this.searchHistory.value = []
    }
  }

  /**
   * Clear search history
   */
  clearSearchHistory() {
    this.searchHistory.value = []
    try {
      localStorage.removeItem('tangent-search-history')
    } catch (error) {
      console.warn('Failed to clear search history:', error)
    }
  }

  /**
   * Clear current search results
   */
  clearResults() {
    this.lastResults.value = []
    this.lastQuery.value = ''
  }

  /**
   * Get highlighted text with search matches
   */
  highlightMatches(text: string, matches: Array<[number, number]>): string {
    if (!matches || matches.length === 0) {
      return text
    }

    // Sort matches by start position (descending) to avoid offset issues
    const sortedMatches = [...matches].sort((a, b) => b[0] - a[0])

    let highlightedText = text
    for (const [start, end] of sortedMatches) {
      const before = highlightedText.slice(0, start)
      const match = highlightedText.slice(start, end)
      const after = highlightedText.slice(end)
      
      highlightedText = `${before}<mark class="search-highlight">${match}</mark>${after}`
    }

    return highlightedText
  }

  /**
   * Get search result summary for display
   */
  getResultSummary(result: SearchResult): string {
    if (result.match_type === 'semantic') {
      return `Semantic match (${Math.round((result.similarity || 0) * 100)}% similarity)`
    }
    
    if (result.match_type === 'text' && result.matches) {
      const titleMatches = result.matches.filter(m => m.type === 'title').length
      const contentMatches = result.matches.filter(m => m.type === 'content').length
      
      const parts = []
      if (titleMatches > 0) parts.push(`${titleMatches} title match${titleMatches > 1 ? 'es' : ''}`)
      if (contentMatches > 0) parts.push(`${contentMatches} content match${contentMatches > 1 ? 'es' : ''}`)
      
      return parts.join(', ')
    }

    if (result.combined_score !== undefined) {
      return `Hybrid match (score: ${Math.round(result.combined_score * 100)})`
    }

    return 'Match found'
  }

  /**
   * Group results by chat for better organization
   */
  groupResultsByChat(results: SearchResult[]): Record<string, SearchResult[]> {
    return results.reduce((groups, result) => {
      const chatId = result.chat_id
      if (!groups[chatId]) {
        groups[chatId] = []
      }
      groups[chatId].push(result)
      return groups
    }, {} as Record<string, SearchResult[]>)
  }

  /**
   * Get node type icon for display
   */
  getNodeTypeIcon(type: string): string {
    switch (type) {
      case 'main': return '🏠'
      case 'branch': return '🌿'
      case 'media': return '🖼️'
      case 'claude-code': return '🤖'
      default: return '💬'
    }
  }

  /**
   * Initialize the service (load history, etc.)
   */
  init() {
    this.loadSearchHistory()
  }
}

// Export singleton instance
export const branchSearchService = new BranchSearchService()

// Initialize on import
branchSearchService.init()

export default branchSearchService