/**
 * Performance Mode Service
 * Pauses heavy computations during critical interactions like dragging and animations
 */

import { ref } from 'vue';

class PerformanceModeService {
  private isPaused = ref(false);
  private pauseCount = 0;
  private pausedWatchers = new Set<() => void>();
  private rafId: number | null = null;
  
  // Callbacks to pause/resume heavy operations
  private heavyOperations = new Map<string, {
    pause: () => void;
    resume: () => void;
  }>();
  
  /**
   * Enter performance mode - pauses heavy computations
   * Can be called multiple times (nested) - only resumes when all are complete
   */
  enterPerformanceMode(reason: string = 'unknown'): void {
    this.pauseCount++;
    
    if (this.pauseCount === 1) {
      console.log(`[Performance] Entering performance mode: ${reason}`);
      this.isPaused.value = true;
      
      // Pause all registered heavy operations
      this.heavyOperations.forEach((ops, name) => {
        try {
          ops.pause();
        } catch (e) {
          console.warn(`Failed to pause ${name}:`, e);
        }
      });
    }
  }
  
  /**
   * Exit performance mode - resumes computations
   * Only actually resumes when all nested calls have exited
   */
  exitPerformanceMode(reason: string = 'unknown'): void {
    if (this.pauseCount <= 0) return;
    
    this.pauseCount--;
    
    if (this.pauseCount === 0) {
      console.log(`[Performance] Exiting performance mode: ${reason}`);
      
      // Defer resuming heavy operations to next frame to avoid jank
      this.rafId = requestAnimationFrame(() => {
        this.isPaused.value = false;
        
        // Resume all registered heavy operations
        this.heavyOperations.forEach((ops, name) => {
          try {
            ops.resume();
          } catch (e) {
            console.warn(`Failed to resume ${name}:`, e);
          }
        });
        
        this.rafId = null;
      });
    }
  }
  
  /**
   * Register a heavy operation that should be paused during performance mode
   */
  registerHeavyOperation(
    name: string,
    pause: () => void,
    resume: () => void
  ): () => void {
    this.heavyOperations.set(name, { pause, resume });
    
    // If already in performance mode, pause immediately
    if (this.isPaused.value) {
      pause();
    }
    
    // Return unregister function
    return () => {
      this.heavyOperations.delete(name);
    };
  }
  
  /**
   * Check if currently in performance mode
   */
  isInPerformanceMode(): boolean {
    return this.isPaused.value;
  }
  
  /**
   * Wrap a function to automatically enter/exit performance mode
   */
  async wrapInPerformanceMode<T>(
    fn: () => T | Promise<T>,
    reason: string
  ): Promise<T> {
    this.enterPerformanceMode(reason);
    try {
      const result = await fn();
      return result;
    } finally {
      this.exitPerformanceMode(reason);
    }
  }
  
  /**
   * Create a throttled computed that respects performance mode
   */
  createThrottledComputed<T>(
    compute: () => T,
    delay: number = 100
  ): { value: T; pause: () => void; resume: () => void } {
    let timeoutId: number | null = null;
    let cachedValue: T = compute();
    let isPaused = false;
    
    const update = () => {
      if (isPaused || this.isPaused.value) return;
      
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = window.setTimeout(() => {
        if (!isPaused && !this.isPaused.value) {
          cachedValue = compute();
        }
        timeoutId = null;
      }, delay);
    };
    
    return {
      get value() {
        if (!isPaused && !this.isPaused.value) {
          update();
        }
        return cachedValue;
      },
      pause: () => {
        isPaused = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      },
      resume: () => {
        isPaused = false;
        update();
      }
    };
  }
  
  /**
   * Force garbage collection if available (Chrome DevTools)
   */
  forceGC(): void {
    if ((window as any).gc) {
      console.log('[Performance] Forcing garbage collection');
      (window as any).gc();
    }
  }
}

// Export singleton instance
export const performanceMode = new PerformanceModeService();