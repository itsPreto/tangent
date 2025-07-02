import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';

interface VirtualScrollOptions {
  items: ComputedRef<any[]>;
  containerRef: Ref<HTMLElement | undefined>;
  itemHeight: number;
  itemsPerRow: number;
  gap: number;
  buffer: number;
  debounce: number;
}

interface VirtualScrollReturn {
  visibleItems: ComputedRef<any[]>;
  totalHeight: ComputedRef<number>;
  offsetY: ComputedRef<number>;
  handleScroll: () => void;
}

export function useVirtualScroll(options: VirtualScrollOptions): VirtualScrollReturn {
  const {
    items,
    containerRef,
    itemHeight,
    itemsPerRow,
    gap,
    buffer,
    debounce
  } = options;

  const scrollTop = ref(0);
  const containerHeight = ref(0);
  const scrollTimeout = ref<number>();

  // Calculate total rows needed
  const totalRows = computed(() => {
    return Math.ceil(items.value.length / itemsPerRow);
  });

  // Calculate total height
  const totalHeight = computed(() => {
    return totalRows.value * (itemHeight + gap) - gap;
  });

  // Calculate visible range
  const visibleRange = computed(() => {
    if (!containerHeight.value) return { start: 0, end: 0 };

    const startRow = Math.floor(scrollTop.value / (itemHeight + gap));
    const endRow = Math.ceil((scrollTop.value + containerHeight.value) / (itemHeight + gap));
    
    // Add buffer rows
    const bufferedStart = Math.max(0, startRow - buffer);
    const bufferedEnd = Math.min(totalRows.value, endRow + buffer);

    return { start: bufferedStart, end: bufferedEnd };
  });

  // Calculate offset for positioning
  const offsetY = computed(() => {
    return visibleRange.value.start * (itemHeight + gap);
  });

  // Get visible items
  const visibleItems = computed(() => {
    const { start, end } = visibleRange.value;
    const startIndex = start * itemsPerRow;
    const endIndex = Math.min(end * itemsPerRow, items.value.length);
    
    return items.value.slice(startIndex, endIndex).map((item, index) => ({
      ...item,
      _index: startIndex + index
    }));
  });

  // Debounced scroll handler
  const handleScroll = () => {
    if (!containerRef.value) return;

    // Clear existing timeout
    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value);
    }

    // Set new timeout with debounce
    scrollTimeout.value = window.setTimeout(() => {
      scrollTop.value = containerRef.value?.scrollTop || 0;
      containerHeight.value = containerRef.value?.clientHeight || 0;
    }, debounce);
  };

  // Watch for container changes
  watch(containerRef, (newContainer) => {
    if (newContainer) {
      // Initial measurements
      containerHeight.value = newContainer.clientHeight;
      scrollTop.value = newContainer.scrollTop;

      // Set up resize observer
      const resizeObserver = new ResizeObserver(() => {
        containerHeight.value = newContainer.clientHeight;
      });
      resizeObserver.observe(newContainer);

      // Cleanup on unmount
      return () => {
        resizeObserver.disconnect();
        if (scrollTimeout.value) {
          clearTimeout(scrollTimeout.value);
        }
      };
    }
  }, { immediate: true });

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll
  };
}