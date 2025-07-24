import { ref } from 'vue'

export interface ClusterResult {
  clusters: Record<string, number>
  positions: Record<string, { x: number; y: number }>
  cluster_info: {
    method: string
    k?: number
    silhouette_score?: number
    n_clusters?: number
    n_noise?: number
  }
  success: boolean
  error?: string
}

export interface AutoArrangeOptions {
  method?: 'kmeans' | 'dbscan'
  k?: number
  eps?: number
  min_samples?: number
  canvas_bounds?: {
    width: number
    height: number
    margin: number
  }
}

class AutoArrangeService {
  private baseUrl = 'http://127.0.0.1:5050'
  public isProcessing = ref(false)
  public lastResult = ref<ClusterResult | null>(null)

  async clusterNodes(
    chatId: string, 
    options: AutoArrangeOptions = {}
  ): Promise<ClusterResult> {
    this.isProcessing.value = true
    
    try {
      const response = await fetch(`${this.baseUrl}/api/nodes/cluster`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          method: options.method || 'kmeans',
          k: options.k,
          eps: options.eps,
          min_samples: options.min_samples,
          canvas_bounds: options.canvas_bounds
        })
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`)
      }

      this.lastResult.value = result
      return result
      
    } catch (error) {
      console.error('Error clustering nodes:', error)
      const errorResult: ClusterResult = {
        clusters: {},
        positions: {},
        cluster_info: { method: options.method || 'kmeans' },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      this.lastResult.value = errorResult
      return errorResult
    } finally {
      this.isProcessing.value = false
    }
  }

  async autoArrangeNodes(
    chatId: string,
    options: AutoArrangeOptions = {}
  ): Promise<ClusterResult> {
    this.isProcessing.value = true
    
    try {
      const response = await fetch(`${this.baseUrl}/api/nodes/auto-arrange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          method: options.method || 'kmeans',
          canvas_bounds: options.canvas_bounds
        })
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`)
      }

      this.lastResult.value = result
      return result
      
    } catch (error) {
      console.error('Error auto-arranging nodes:', error)
      const errorResult: ClusterResult = {
        clusters: {},
        positions: {},
        cluster_info: { method: options.method || 'kmeans' },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      this.lastResult.value = errorResult
      return errorResult
    } finally {
      this.isProcessing.value = false
    }
  }

  /**
   * Calculate optimal canvas bounds based on current viewport and nodes
   */
  calculateCanvasBounds(viewportWidth: number, viewportHeight: number, zoom: number) {
    // Calculate reasonable canvas bounds for clustering
    const scaledWidth = viewportWidth / zoom
    const scaledHeight = viewportHeight / zoom
    
    return {
      width: Math.max(scaledWidth * 2, 2000), // At least 2000px wide
      height: Math.max(scaledHeight * 2, 1500), // At least 1500px tall
      margin: 200 // 200px margin from edges
    }
  }

  /**
   * Get cluster statistics from the last result
   */
  getClusterStats() {
    if (!this.lastResult.value || !this.lastResult.value.success) {
      return null
    }

    const clusters = this.lastResult.value.clusters
    const clusterCounts: Record<number, number> = {}
    
    // Count nodes per cluster
    Object.values(clusters).forEach(clusterId => {
      clusterCounts[clusterId] = (clusterCounts[clusterId] || 0) + 1
    })

    return {
      totalNodes: Object.keys(clusters).length,
      numClusters: Object.keys(clusterCounts).length,
      clusterSizes: clusterCounts,
      avgClusterSize: Object.keys(clusters).length / Object.keys(clusterCounts).length,
      silhouetteScore: this.lastResult.value.cluster_info.silhouette_score,
      method: this.lastResult.value.cluster_info.method
    }
  }

  /**
   * Get color for a cluster (for visualization)
   */
  getClusterColor(clusterId: number): string {
    const colors = [
      '#3B82F6', // Blue
      '#EF4444', // Red
      '#10B981', // Green
      '#F59E0B', // Amber
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#06B6D4', // Cyan
      '#84CC16', // Lime
      '#F97316', // Orange
      '#6366F1', // Indigo
    ]
    
    return colors[clusterId % colors.length]
  }

  /**
   * Clear the last result
   */
  clearResult() {
    this.lastResult.value = null
  }
}

// Export singleton instance
export const autoArrangeService = new AutoArrangeService()
export default autoArrangeService