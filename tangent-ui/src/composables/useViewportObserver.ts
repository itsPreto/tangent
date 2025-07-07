import { ref, onMounted, onBeforeUnmount } from 'vue';

interface ViewportObserverOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

interface ObservedElement {
  id: string;
  element: Element;
  isVisible: boolean;
}

export function useViewportObserver(options: ViewportObserverOptions = {}) {
  const visibleElements = ref(new Set<string>());
  const observedElements = ref(new Map<string, ObservedElement>());
  let observer: IntersectionObserver | null = null;

  const defaultOptions: ViewportObserverOptions = {
    root: null,
    rootMargin: '500px', // 500px buffer zone
    threshold: 0,
    ...options,
  };

  const initializeObserver = () => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported');
      return;
    }

    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const elementId = entry.target.getAttribute('data-node-id');
        if (!elementId) return;

        const observedElement = observedElements.value.get(elementId);
        if (!observedElement) return;

        observedElement.isVisible = entry.isIntersecting;

        if (entry.isIntersecting) {
          visibleElements.value.add(elementId);
        } else {
          visibleElements.value.delete(elementId);
        }

        // Trigger reactivity by creating a new Set
        visibleElements.value = new Set(visibleElements.value);
      });
    }, defaultOptions);
  };

  const observe = (element: Element, id: string) => {
    if (!observer) return;

    const observedElement: ObservedElement = {
      id,
      element,
      isVisible: false,
    };

    observedElements.value.set(id, observedElement);
    observer.observe(element);
  };

  const unobserve = (id: string) => {
    if (!observer) return;

    const observedElement = observedElements.value.get(id);
    if (observedElement) {
      observer.unobserve(observedElement.element);
      observedElements.value.delete(id);
      visibleElements.value.delete(id);
      visibleElements.value = new Set(visibleElements.value);
    }
  };

  const isElementVisible = (id: string) => {
    return visibleElements.value.has(id);
  };

  const getVisibleElementIds = () => {
    return Array.from(visibleElements.value);
  };

  const disconnect = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    observedElements.value.clear();
    visibleElements.value.clear();
  };

  onMounted(() => {
    initializeObserver();
  });

  onBeforeUnmount(() => {
    disconnect();
  });

  return {
    visibleElements: visibleElements.value,
    observe,
    unobserve,
    isElementVisible,
    getVisibleElementIds,
    disconnect,
  };
}