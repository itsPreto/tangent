import { ref, onMounted, onBeforeUnmount } from 'vue';

interface PerformanceMetrics {
  fps: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  renderTime: number;
  itemsRendered: number;
}

export function usePerformanceMonitor() {
  const metrics = ref<PerformanceMetrics>({
    fps: 0,
    memory: { used: 0, total: 0, percentage: 0 },
    renderTime: 0,
    itemsRendered: 0
  });

  const isMonitoring = ref(false);
  
  let frameCount = 0;
  let lastTime = performance.now();
  let animationFrame: number;
  let monitoringInterval: number;

  const updateFPS = () => {
    const currentTime = performance.now();
    frameCount++;

    if (currentTime - lastTime >= 1000) {
      metrics.value.fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
      frameCount = 0;
      lastTime = currentTime;
    }

    if (isMonitoring.value) {
      animationFrame = requestAnimationFrame(updateFPS);
    }
  };

  const updateMemoryUsage = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      metrics.value.memory = {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        percentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
      };
    }
  };

  const measureRenderTime = (callback: () => void) => {
    const start = performance.now();
    callback();
    metrics.value.renderTime = performance.now() - start;
  };

  const updateItemsRendered = (count: number) => {
    metrics.value.itemsRendered = count;
  };

  const startMonitoring = () => {
    isMonitoring.value = true;
    
    // Start FPS monitoring
    updateFPS();
    
    // Update memory usage periodically
    monitoringInterval = window.setInterval(updateMemoryUsage, 1000);
  };

  const stopMonitoring = () => {
    isMonitoring.value = false;
    
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
    }
  };

  onMounted(() => {
    if (import.meta.env.DEV) {
      startMonitoring();
    }
  });

  onBeforeUnmount(() => {
    stopMonitoring();
  });

  return {
    metrics,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    measureRenderTime,
    updateItemsRendered
  };
}