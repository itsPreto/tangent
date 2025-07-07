import { ref, computed, watch } from 'vue';
import type { Message } from '@/types/message';

interface ProgressiveLoadingOptions {
  initialLoadCount?: number;
  incrementLoadCount?: number;
  totalMessages?: number;
}

interface MessageLoadingState {
  loadedMessages: Message[];
  loadedCount: number;
  isLoading: boolean;
  hasMore: boolean;
  totalCount: number;
}

export function useProgressiveMessageLoading(
  allMessages: () => Message[],
  options: ProgressiveLoadingOptions = {}
) {
  const {
    initialLoadCount = 20,
    incrementLoadCount = 10,
  } = options;

  // Loading state
  const loadingState = ref<MessageLoadingState>({
    loadedMessages: [],
    loadedCount: 0,
    isLoading: false,
    hasMore: false,
    totalCount: 0,
  });

  // Whether progressive loading is enabled
  const isProgressiveLoadingEnabled = ref(false);

  // Get the messages to display
  const displayMessages = computed(() => {
    const messages = allMessages();
    
    // If progressive loading is disabled, return all messages
    if (!isProgressiveLoadingEnabled.value) {
      return messages;
    }

    // Return loaded messages
    return loadingState.value.loadedMessages;
  });

  // Initialize loading with the first batch of messages
  const initializeLoading = () => {
    const messages = allMessages();
    const totalCount = messages.length;
    
    // Only enable progressive loading for large message sets
    if (totalCount <= initialLoadCount) {
      isProgressiveLoadingEnabled.value = false;
      loadingState.value = {
        loadedMessages: messages,
        loadedCount: totalCount,
        isLoading: false,
        hasMore: false,
        totalCount,
      };
      return;
    }

    isProgressiveLoadingEnabled.value = true;
    
    // Load initial messages (from the end, as they're typically more relevant)
    const startIndex = Math.max(0, totalCount - initialLoadCount);
    const initialMessages = messages.slice(startIndex);
    
    loadingState.value = {
      loadedMessages: initialMessages,
      loadedCount: initialMessages.length,
      isLoading: false,
      hasMore: startIndex > 0,
      totalCount,
    };
  };

  // Load more messages from the beginning
  const loadMoreMessages = async () => {
    if (loadingState.value.isLoading || !loadingState.value.hasMore) {
      return;
    }

    loadingState.value.isLoading = true;

    // Simulate async loading (you could replace this with actual API calls)
    await new Promise(resolve => setTimeout(resolve, 100));

    const messages = allMessages();
    const currentCount = loadingState.value.loadedCount;
    const remainingCount = messages.length - currentCount;
    const loadCount = Math.min(incrementLoadCount, remainingCount);
    
    if (loadCount > 0) {
      // Load messages from the beginning that we haven't loaded yet
      const startIndex = Math.max(0, messages.length - currentCount - loadCount);
      const endIndex = messages.length - currentCount;
      const newMessages = messages.slice(startIndex, endIndex);
      
      loadingState.value = {
        ...loadingState.value,
        loadedMessages: [...newMessages, ...loadingState.value.loadedMessages],
        loadedCount: currentCount + loadCount,
        hasMore: startIndex > 0,
        isLoading: false,
      };
    } else {
      loadingState.value.isLoading = false;
    }
  };

  // Load all remaining messages
  const loadAllMessages = async () => {
    if (loadingState.value.isLoading) {
      return;
    }

    loadingState.value.isLoading = true;

    // Simulate async loading
    await new Promise(resolve => setTimeout(resolve, 200));

    const messages = allMessages();
    
    loadingState.value = {
      loadedMessages: messages,
      loadedCount: messages.length,
      isLoading: false,
      hasMore: false,
      totalCount: messages.length,
    };

    isProgressiveLoadingEnabled.value = false;
  };

  // Reset and reinitialize when messages change
  const resetLoading = () => {
    loadingState.value = {
      loadedMessages: [],
      loadedCount: 0,
      isLoading: false,
      hasMore: false,
      totalCount: 0,
    };
    initializeLoading();
  };

  // Watch for changes in the source messages
  watch(
    () => allMessages().length,
    (newLength, oldLength) => {
      // If new messages were added, append them to loaded messages
      if (newLength > oldLength && isProgressiveLoadingEnabled.value) {
        const messages = allMessages();
        const newMessages = messages.slice(oldLength);
        loadingState.value.loadedMessages.push(...newMessages);
        loadingState.value.loadedCount += newMessages.length;
        loadingState.value.totalCount = newLength;
      } else if (newLength !== oldLength) {
        // Reset if the message count changed significantly
        resetLoading();
      }
    }
  );

  // Initialize on first load
  initializeLoading();

  return {
    displayMessages,
    loadingState: computed(() => loadingState.value),
    isProgressiveLoadingEnabled: computed(() => isProgressiveLoadingEnabled.value),
    loadMoreMessages,
    loadAllMessages,
    resetLoading,
  };
}