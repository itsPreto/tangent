import { useCanvasStore } from '@/stores/canvasStore'
import { audioService } from '@/services/audioService'
import { ttsService } from '@/services/ttsService'

export class MemoryManager {
  private static instance: MemoryManager
  private cleanupIntervalId: number | null = null
  private memoryCheckInterval = 60000 // Check every minute

  private constructor() {}

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  startPeriodicCleanup(): void {
    if (this.cleanupIntervalId) {
      return // Already running
    }

    console.log('Starting periodic memory cleanup')
    
    this.cleanupIntervalId = window.setInterval(() => {
      this.performCleanup()
    }, this.memoryCheckInterval)
  }

  stopPeriodicCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = null
      console.log('Stopped periodic memory cleanup')
    }
  }

  performCleanup(): void {
    try {
      const canvasStore = useCanvasStore()
      
      // Get memory usage before cleanup
      const beforeUsage = canvasStore.getMemoryUsage()
      
      // Perform cleanup
      canvasStore.cleanupMemory()
      
      // Get memory usage after cleanup
      const afterUsage = canvasStore.getMemoryUsage()
      
      console.log('Memory cleanup performed:', {
        before: beforeUsage,
        after: afterUsage,
        reduced: {
          nodeModelParams: beforeUsage.nodeModelParams - afterUsage.nodeModelParams,
          topicClusters: beforeUsage.topicClusters - afterUsage.topicClusters,
          nodeTopics: beforeUsage.nodeTopics - afterUsage.nodeTopics
        }
      })
      
      // Force garbage collection if available (development only)
      if (process.env.NODE_ENV === 'development' && (window as any).gc) {
        (window as any).gc()
      }
      
    } catch (error) {
      console.error('Error during memory cleanup:', error)
    }
  }

  performDeepCleanup(): void {
    try {
      console.log('Performing deep memory cleanup')
      
      const canvasStore = useCanvasStore()
      
      // Clear all caches
      canvasStore.clearAllCaches()
      
      // Reset services
      audioService.reset()
      ttsService.reset()
      
      // Clear any remaining timers or intervals
      this.clearAllTimers()
      
      console.log('Deep cleanup completed')
      
    } catch (error) {
      console.error('Error during deep cleanup:', error)
    }
  }

  private clearAllTimers(): void {
    // Clear any lingering timers (brute force approach for development)
    const highestTimeoutId = setTimeout(() => {}, 0)
    for (let i = 0; i <= highestTimeoutId; i++) {
      clearTimeout(i)
    }
    
    const highestIntervalId = setInterval(() => {}, 1000)
    for (let i = 0; i <= highestIntervalId; i++) {
      clearInterval(i)
    }
  }

  getMemoryInfo(): any {
    const canvasStore = useCanvasStore()
    
    return {
      canvas: canvasStore.getMemoryUsage(),
      performance: (performance as any).memory ? {
        usedJSHeapSize: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
        totalJSHeapSize: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
        jsHeapSizeLimit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)
      } : null,
      audioService: {
        isRecording: audioService.state.value.isRecording,
        isProcessing: audioService.state.value.isProcessing,
        hasAudioBlob: !!audioService.state.value.audioBlob
      },
      ttsService: {
        isPlaying: ttsService.isPlaying.value,
        isSpeaking: ttsService.isSpeaking.value,
        voicesLoaded: ttsService.voices.value.length
      }
    }
  }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance()