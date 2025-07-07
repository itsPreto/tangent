import { ref, onBeforeUnmount } from 'vue';

export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): [(...args: Parameters<T>) => void, () => void] {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  onBeforeUnmount(() => {
    cancel();
  });

  return [debouncedFn, cancel];
}

export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 100
): [(...args: Parameters<T>) => void, () => void] {
  let lastCallTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const throttledFn = (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCallTime >= delay) {
      lastCallTime = now;
      fn(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        fn(...args);
      }, delay - (now - lastCallTime));
    }
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  onBeforeUnmount(() => {
    cancel();
  });

  return [throttledFn, cancel];
}

export function useRequestAnimationFrame<T extends (...args: any[]) => any>(
  fn: T
): [(...args: Parameters<T>) => void, () => void] {
  let rafId: number | null = null;
  let pendingArgs: Parameters<T> | null = null;

  const rafFn = (...args: Parameters<T>) => {
    pendingArgs = args;
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (pendingArgs) {
          fn(...pendingArgs);
          pendingArgs = null;
        }
        rafId = null;
      });
    }
  };

  const cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pendingArgs = null;
  };

  onBeforeUnmount(() => {
    cancel();
  });

  return [rafFn, cancel];
}

export function useMessageHeightCache() {
  const heightCache = ref(new Map<string, number>());
  const averageHeight = ref(100); // Default estimate

  const cacheHeight = (messageId: string, height: number) => {
    heightCache.value.set(messageId, height);
    
    // Update average height for better estimates
    const heights = Array.from(heightCache.value.values());
    if (heights.length > 0) {
      averageHeight.value = heights.reduce((sum, h) => sum + h, 0) / heights.length;
    }
  };

  const getHeight = (messageId: string): number => {
    return heightCache.value.get(messageId) || averageHeight.value;
  };

  const clearCache = () => {
    heightCache.value.clear();
    averageHeight.value = 100;
  };

  return {
    cacheHeight,
    getHeight,
    clearCache,
    averageHeight: averageHeight.value,
  };
}

export function usePerformanceMonitor() {
  const metrics = ref({
    renderTime: 0,
    memoryUsage: 0,
    frameRate: 0,
  });

  const measureRenderTime = async (renderFn: () => Promise<void> | void) => {
    const startTime = performance.now();
    await renderFn();
    const endTime = performance.now();
    metrics.value.renderTime = endTime - startTime;
  };

  const getMemoryUsage = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      metrics.value.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
    }
  };

  let frameCount = 0;
  let lastTime = performance.now();

  const updateFrameRate = () => {
    frameCount++;
    const currentTime = performance.now();
    if (currentTime - lastTime >= 1000) {
      metrics.value.frameRate = frameCount;
      frameCount = 0;
      lastTime = currentTime;
    }
    requestAnimationFrame(updateFrameRate);
  };

  // Start monitoring frame rate
  updateFrameRate();

  return {
    metrics,
    measureRenderTime,
    getMemoryUsage,
  };
}