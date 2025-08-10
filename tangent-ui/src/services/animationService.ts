/**
 * High-performance animation service for smooth zoom and pan operations
 * Uses RAF throttling, frame skipping, and adaptive quality
 */

interface AnimationState {
  isAnimating: boolean;
  rafId: number | null;
  startTime: number;
  lastFrameTime: number;
  frameCount: number;
  droppedFrames: number;
}

interface AnimationTarget {
  panX: number;
  panY: number;
  zoom: number;
}

interface AnimationOptions {
  duration?: number;
  easing?: (t: number) => number;
  onUpdate?: (values: AnimationTarget) => void;
  onComplete?: () => void;
  adaptiveQuality?: boolean;
}

class AnimationService {
  private state: AnimationState = {
    isAnimating: false,
    rafId: null,
    startTime: 0,
    lastFrameTime: 0,
    frameCount: 0,
    droppedFrames: 0
  };
  
  private currentAnimation: {
    start: AnimationTarget;
    end: AnimationTarget;
    current: AnimationTarget;
    options: AnimationOptions;
  } | null = null;
  
  // Performance monitoring
  private readonly TARGET_FPS = 60;
  private readonly FRAME_BUDGET = 1000 / this.TARGET_FPS; // 16.67ms
  private readonly MIN_FPS = 30; // Drop quality if below this
  
  /**
   * Animate to a specific viewport state with optimized performance
   */
  animateTo(
    target: AnimationTarget,
    current: AnimationTarget,
    options: AnimationOptions = {}
  ): Promise<void> {
    // Cancel any existing animation
    this.cancel();
    
    const defaultOptions: AnimationOptions = {
      duration: 400,
      easing: this.easeOutQuad,
      adaptiveQuality: true,
      ...options
    };
    
    this.currentAnimation = {
      start: { ...current },
      end: target,
      current: { ...current },
      options: defaultOptions
    };
    
    this.state.isAnimating = true;
    this.state.startTime = performance.now();
    this.state.lastFrameTime = this.state.startTime;
    this.state.frameCount = 0;
    this.state.droppedFrames = 0;
    
    return new Promise((resolve) => {
      const animate = (currentTime: number) => {
        if (!this.currentAnimation) {
          resolve();
          return;
        }
        
        // Frame timing analysis
        const frameDelta = currentTime - this.state.lastFrameTime;
        const elapsed = currentTime - this.state.startTime;
        const progress = Math.min(elapsed / (this.currentAnimation.options.duration || 400), 1);
        
        // Skip frame if running behind (adaptive frame skipping)
        if (frameDelta > this.FRAME_BUDGET * 2 && progress < 0.9) {
          this.state.droppedFrames++;
          
          // If dropping too many frames, reduce quality or skip to end
          if (this.state.droppedFrames > 10 && this.currentAnimation.options.adaptiveQuality) {
            // Jump closer to target to catch up
            const skipProgress = Math.min(progress + 0.1, 1);
            this.updateAnimation(skipProgress);
          }
        } else {
          // Normal frame update
          this.updateAnimation(progress);
        }
        
        this.state.lastFrameTime = currentTime;
        this.state.frameCount++;
        
        if (progress < 1) {
          this.state.rafId = requestAnimationFrame(animate);
        } else {
          // Animation complete
          this.complete(resolve);
        }
      };
      
      this.state.rafId = requestAnimationFrame(animate);
    });
  }
  
  /**
   * Instantly jump to target without animation
   */
  jumpTo(target: AnimationTarget, onUpdate?: (values: AnimationTarget) => void): void {
    this.cancel();
    if (onUpdate) {
      onUpdate(target);
    }
  }
  
  /**
   * Cancel current animation
   */
  cancel(): void {
    if (this.state.rafId !== null) {
      cancelAnimationFrame(this.state.rafId);
      this.state.rafId = null;
    }
    
    this.state.isAnimating = false;
    this.currentAnimation = null;
  }
  
  /**
   * Check if currently animating
   */
  isAnimating(): boolean {
    return this.state.isAnimating;
  }
  
  /**
   * Get animation performance stats
   */
  getStats(): { fps: number; droppedFrames: number } {
    const elapsed = performance.now() - this.state.startTime;
    const fps = elapsed > 0 ? (this.state.frameCount / elapsed) * 1000 : 0;
    
    return {
      fps: Math.round(fps),
      droppedFrames: this.state.droppedFrames
    };
  }
  
  // Private methods
  
  private updateAnimation(progress: number): void {
    if (!this.currentAnimation) return;
    
    const { start, end, options } = this.currentAnimation;
    const eased = options.easing ? options.easing(progress) : progress;
    
    // Interpolate values
    this.currentAnimation.current = {
      panX: start.panX + (end.panX - start.panX) * eased,
      panY: start.panY + (end.panY - start.panY) * eased,
      zoom: start.zoom + (end.zoom - start.zoom) * eased
    };
    
    // Callback with current values
    if (options.onUpdate) {
      options.onUpdate(this.currentAnimation.current);
    }
  }
  
  private complete(resolve: () => void): void {
    if (!this.currentAnimation) {
      resolve();
      return;
    }
    
    // Ensure we end exactly at target
    if (this.currentAnimation.options.onUpdate) {
      this.currentAnimation.options.onUpdate(this.currentAnimation.end);
    }
    
    if (this.currentAnimation.options.onComplete) {
      this.currentAnimation.options.onComplete();
    }
    
    this.state.isAnimating = false;
    this.currentAnimation = null;
    
    // Log performance stats in development
    if (process.env.NODE_ENV === 'development') {
      const stats = this.getStats();
      if (stats.fps < this.MIN_FPS || stats.droppedFrames > 5) {
        console.warn(`Animation performance warning: ${stats.fps}fps, ${stats.droppedFrames} dropped frames`);
      }
    }
    
    resolve();
  }
  
  // Easing functions
  
  private easeOutQuad(t: number): number {
    return 1 - Math.pow(1 - t, 2);
  }
  
  private easeInOutCubic(t: number): number {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  private easeOutExpo(t: number): number {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }
}

// Export singleton instance
export const animationService = new AnimationService();

/**
 * Helper function to create smooth zoom animations
 */
export function smoothZoomTo(
  nodeX: number,
  nodeY: number,
  targetZoom: number,
  currentPan: { x: number; y: number },
  currentZoom: number,
  canvasRect: DOMRect,
  options?: AnimationOptions
): Promise<void> {
  // Calculate target pan to center on node
  const targetPanX = canvasRect.width / 2 - nodeX * targetZoom;
  const targetPanY = canvasRect.height / 2 - nodeY * targetZoom;
  
  return animationService.animateTo(
    {
      panX: targetPanX,
      panY: targetPanY,
      zoom: targetZoom
    },
    {
      panX: currentPan.x,
      panY: currentPan.y,
      zoom: currentZoom
    },
    options
  );
}