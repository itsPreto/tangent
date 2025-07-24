import { ref, reactive, computed } from 'vue'
import emitter from '@/utils/eventBus'

interface StreamingMetrics {
  tokensPerSecond: number
  responseLatency: number
  totalTokens: number
  startTime: number | null
  lastTokenTime: number | null
  tokenHistory: number[]
}

interface ToolActivity {
  id: string
  nodeId: string
  tool: string
  description: string
  timestamp: number
  duration?: number
  status: 'pending' | 'success' | 'error'
}

class MetricsService {
  private nodeMetrics = reactive<Record<string, StreamingMetrics>>({})
  private toolActivities = ref<ToolActivity[]>([])
  private maxHistoryLength = 20

  // Get metrics for a specific node
  getNodeMetrics(nodeId: string): StreamingMetrics {
    if (!this.nodeMetrics[nodeId]) {
      this.nodeMetrics[nodeId] = {
        tokensPerSecond: 0,
        responseLatency: 0,
        totalTokens: 0,
        startTime: null,
        lastTokenTime: null,
        tokenHistory: []
      }
    }
    return this.nodeMetrics[nodeId]
  }

  // Start tracking streaming for a node
  startStreaming(nodeId: string) {
    const metrics = this.getNodeMetrics(nodeId)
    metrics.startTime = Date.now()
    metrics.lastTokenTime = null
    metrics.tokensPerSecond = 0
    metrics.responseLatency = 0
  }

  // Update token count and calculate speed
  updateTokenCount(nodeId: string, tokenCount: number) {
    const metrics = this.getNodeMetrics(nodeId)
    const now = Date.now()
    
    if (metrics.startTime) {
      // Calculate tokens per second
      const elapsedSeconds = (now - metrics.startTime) / 1000
      if (elapsedSeconds > 0) {
        metrics.tokensPerSecond = tokenCount / elapsedSeconds
        
        // Add to history for sparkline
        metrics.tokenHistory.push(metrics.tokensPerSecond)
        if (metrics.tokenHistory.length > this.maxHistoryLength) {
          metrics.tokenHistory.shift()
        }
      }

      // Calculate latency (time to first token)
      if (!metrics.lastTokenTime && tokenCount > 0) {
        metrics.responseLatency = now - metrics.startTime
      }
      
      metrics.lastTokenTime = now
    }
    
    metrics.totalTokens = tokenCount
  }

  // Stop tracking streaming
  stopStreaming(nodeId: string) {
    const metrics = this.getNodeMetrics(nodeId)
    metrics.startTime = null
    metrics.lastTokenTime = null
  }

  // Add tool activity
  addToolActivity(activity: Omit<ToolActivity, 'id' | 'timestamp'>) {
    const newActivity: ToolActivity = {
      ...activity,
      id: `${activity.nodeId}_${Date.now()}_${Math.random()}`,
      timestamp: Date.now()
    }
    
    this.toolActivities.value.unshift(newActivity)
    
    // Keep only recent activities (last 50)
    if (this.toolActivities.value.length > 50) {
      this.toolActivities.value = this.toolActivities.value.slice(0, 50)
    }
    
    // Emit event for real-time updates
    emitter.emit('tool-activity-added', newActivity)
  }

  // Update tool activity status
  updateToolActivity(activityId: string, updates: Partial<ToolActivity>) {
    const activity = this.toolActivities.value.find(a => a.id === activityId)
    if (activity) {
      Object.assign(activity, updates)
      if (updates.status === 'success' || updates.status === 'error') {
        activity.duration = Date.now() - activity.timestamp
      }
    }
  }

  // Get tool activities for a specific node
  getNodeToolActivities(nodeId: string) {
    return computed(() => 
      this.toolActivities.value
        .filter(activity => activity.nodeId === nodeId)
        .slice(0, 10) // Show last 10 activities
    )
  }

  // Get recent tool activities (all nodes)
  getRecentToolActivities() {
    return computed(() => this.toolActivities.value.slice(0, 20))
  }

  // Clear metrics for a node
  clearNodeMetrics(nodeId: string) {
    delete this.nodeMetrics[nodeId]
    this.toolActivities.value = this.toolActivities.value.filter(
      activity => activity.nodeId !== nodeId
    )
  }

  // Get session duration for a node (based on first message timestamp)
  getSessionDuration(nodeId: string, messages: any[] = []): string {
    if (!messages.length) return '0:00'
    
    const firstMessage = messages[0]
    const startTime = firstMessage?.timestamp ? new Date(firstMessage.timestamp).getTime() : Date.now()
    const duration = Date.now() - startTime
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
}

// Export singleton instance
export const metricsService = new MetricsService()

// Auto-track tool activities via event bus
emitter.on('tool-call-start', (data: { nodeId: string, tool: string, description: string }) => {
  metricsService.addToolActivity({
    nodeId: data.nodeId,
    tool: data.tool,
    description: data.description,
    status: 'pending'
  })
})

emitter.on('tool-call-complete', (data: { nodeId: string, tool: string, status: 'success' | 'error' }) => {
  // Find the most recent matching activity and update it
  const activities = metricsService.getRecentToolActivities().value
  const activity = activities.find(a => 
    a.nodeId === data.nodeId && 
    a.tool === data.tool && 
    a.status === 'pending'
  )
  
  if (activity) {
    metricsService.updateToolActivity(activity.id, { status: data.status })
  }
})

emitter.on('streaming-started', (data: { nodeId: string }) => {
  metricsService.startStreaming(data.nodeId)
})

emitter.on('streaming-token-update', (data: { nodeId: string, tokenCount: number }) => {
  metricsService.updateTokenCount(data.nodeId, data.tokenCount)
})

emitter.on('streaming-complete', (data: { nodeId: string }) => {
  metricsService.stopStreaming(data.nodeId)
})