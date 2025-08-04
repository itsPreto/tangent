interface ClusteringStatus {
  is_running: boolean;
  progress: number;
  status_message: string;
  total_workspaces: number;
  processed_workspaces: number;
  clusters: ClusterResult[];
}

interface ClusterResult {
  id: string;
  title: string;
  workspaces: ClusterWorkspace[];
  commonTags: Array<{ id: string; name: string; color: string }>;
  size: number;
}

interface ClusterWorkspace {
  id: string;
  title: string;
  nodeCount: number;
  lastUpdated: string;
  tags: any[];
}

interface ClusteringParams {
  method: 'kmeans' | 'dbscan';
  n_clusters?: number;
  eps?: number;
  min_samples?: number;
}

interface TopicIsland {
  id: string;
  title: string;
  description: string;
  x: number;
  y: number;
  radius: number;
  workspaces: ClusterWorkspace[];
  color: string;
  commonTags: Array<{ id: string; name: string; color: string }>;
}

class ClusteringService {
  private baseUrl = 'http://127.0.0.1:5050/api';
  private statusPollingInterval: number | null = null;
  private statusCallbacks: Array<(status: ClusteringStatus) => void> = [];

  /**
   * Start workspace clustering
   */
  async startClustering(params: ClusteringParams): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/clustering/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start clustering');
      }

      // Start polling for status updates
      this.startStatusPolling();
    } catch (error) {
      console.error('Error starting clustering:', error);
      throw error;
    }
  }

  /**
   * Get current clustering status
   */
  async getStatus(): Promise<ClusteringStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/clustering/status`);
      if (!response.ok) {
        throw new Error('Failed to get clustering status');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting clustering status:', error);
      throw error;
    }
  }

  /**
   * Get clustering results
   */
  async getResults(): Promise<{ clusters: ClusterResult[]; is_complete: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/clustering/results`);
      if (!response.ok) {
        throw new Error('Failed to get clustering results');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting clustering results:', error);
      throw error;
    }
  }

  /**
   * Stop clustering process
   */
  async stopClustering(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/clustering/stop`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to stop clustering');
      }

      this.stopStatusPolling();
    } catch (error) {
      console.error('Error stopping clustering:', error);
      throw error;
    }
  }

  /**
   * Subscribe to status updates
   */
  onStatusUpdate(callback: (status: ClusteringStatus) => void): () => void {
    this.statusCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Start polling for status updates
   */
  private startStatusPolling(): void {
    if (this.statusPollingInterval) {
      return; // Already polling
    }

    this.statusPollingInterval = window.setInterval(async () => {
      try {
        const status = await this.getStatus();
        
        // Notify all subscribers
        this.statusCallbacks.forEach(callback => callback(status));

        // Stop polling if clustering is complete
        if (!status.is_running) {
          this.stopStatusPolling();
        }
      } catch (error) {
        console.error('Error polling clustering status:', error);
      }
    }, 1000); // Poll every second
  }

  /**
   * Stop polling for status updates
   */
  private stopStatusPolling(): void {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
  }

  /**
   * Check if clustering is currently running
   */
  async isRunning(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.is_running;
    } catch {
      return false;
    }
  }

  /**
   * Search topics using cosine similarity
   */
  async searchTopicsBySimilarity(query: string, limit: number = 10): Promise<ClusterResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/clustering/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          limit: limit
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to search topics');
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error searching topics:', error);
      throw error;
    }
  }

  /**
   * Assign workspace to topic
   */
  async assignWorkspaceToTopic(workspaceId: string, topicId: string, createNew: boolean = false): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/clustering/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          topic_id: topicId,
          create_new: createNew
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign workspace to topic');
      }
    } catch (error) {
      console.error('Error assigning workspace to topic:', error);
      throw error;
    }
  }

  /**
   * Get topic islands for spatial visualization
   */
  async getTopicIslands(): Promise<TopicIsland[]> {
    try {
      const response = await fetch(`${this.baseUrl}/clustering/islands`);
      if (!response.ok) {
        throw new Error('Failed to get topic islands');
      }
      const data = await response.json();
      return data.islands || [];
    } catch (error) {
      console.error('Error getting topic islands:', error);
      throw error;
    }
  }

  /**
   * Update workspace position within topic island
   */
  async updateWorkspacePosition(workspaceId: string, x: number, y: number, topicId?: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/clustering/position`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          x: x,
          y: y,
          topic_id: topicId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update workspace position');
      }
    } catch (error) {
      console.error('Error updating workspace position:', error);
      throw error;
    }
  }

  /**
   * Generate topic clusters if none exist
   */
  async generateInitialClusters(): Promise<void> {
    try {
      // Start clustering with default parameters
      await this.startClustering({
        method: 'kmeans',
        n_clusters: 8 // Default number of topic islands
      });
    } catch (error) {
      console.error('Error generating initial clusters:', error);
      throw error;
    }
  }

  /**
   * Cleanup when service is destroyed
   */
  destroy(): void {
    this.stopStatusPolling();
    this.statusCallbacks = [];
  }
}

// Create singleton instance
export const clusteringService = new ClusteringService();

// Types for external use
export type { ClusteringStatus, ClusterResult, ClusterWorkspace, ClusteringParams, TopicIsland };