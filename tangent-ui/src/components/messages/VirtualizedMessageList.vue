<template>
  <div ref="parentRef" class="overflow-y-auto overflow-x-hidden px-2 messages-scroll-container"
    :class="'theme-' + currentTheme" :key="currentTheme" :style="{ height: '100%', minHeight: '300px' }" tabindex="0"
    @wheel="throttledScrollHandler">
    <div :style="{
      height: `${rowVirtualizer.getTotalSize()}px`,
      width: '100%',
      position: 'relative',
    }">
      <div v-for="virtualRow in rowVirtualizer.getVirtualItems()" :key="virtualRow.index" :style="{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${virtualRow.size}px`,
        transform: `translateY(${virtualRow.start}px)`,
      }" :data-index="virtualRow.index">
        <div :ref="el => measureElement[virtualRow.index] = el" :data-index="virtualRow.index"
          class="relative group message-container" :class="{
            'user-message': messages[virtualRow.index].role === 'user',
            'ai-message': messages[virtualRow.index].role === 'assistant'
          }" :data-message-index="virtualRow.index" :data-message-id="`${nodeId}-message-${virtualRow.index}`"
          :data-code-bubble-parent="true" :style="getMessageStyles(virtualRow.index)">
          <MessageTimestamp :timestamp="messages[virtualRow.index].timestamp"
            :side="messages[virtualRow.index].role === 'user' ? 'right' : 'left'" />

          <!-- Message Content Container -->
          <div class="relative z-10">
            <!-- Message Content with Hanging Indent -->
            <div class="relative">
              <div class="flex items-start gap-3">
                <!-- Action Buttons -->
                <div class="flex items-center gap-2 flex-shrink-0 ml-auto"
                  v-if="!messages[virtualRow.index].isStreaming">
                  <button @click.stop="$emit('expand-message', virtualRow.index)"
                    class="p-1.5 rounded-full hover:bg-white/10">
                    <component :is="expandedMessages.has(virtualRow.index) ? Maximize2 : Minimize2"
                      class="w-4 h-4 text-base-content/60" />
                  </button>
                </div>
              </div>

              <!-- Modern chat bubble layout -->
              <div class="message-bubble-container">
                <!-- User message bubble (right side) -->
                <div v-if="messages[virtualRow.index].role === 'user'" class="user-bubble-wrapper">
                  <div class="user-bubble">
                    <div class="message-content-wrapper">
                      <MessageContent :content="messages[virtualRow.index].content"
                        :is-streaming="messages[virtualRow.index].isStreaming" :node-id="nodeId"
                        :content-parts="messages[virtualRow.index].contentParts" :message-index="virtualRow.index"
                        :data-message-idx="virtualRow.index" />
                    </div>
                  </div>
                  <div class="message-meta user-meta">
                    <span class="message-time">{{ formatTime(messages[virtualRow.index].timestamp) }}</span>
                  </div>
                </div>

                <!-- AI message bubble (left side) -->
                <div v-else class="ai-bubble-wrapper">
                  <div class="ai-avatar-container">
                    <img :src="getAvatarUrl(getModelInfo(messages[virtualRow.index].modelId))"
                      :alt="getModelDisplayName(messages[virtualRow.index])" class="ai-avatar" />
                  </div>
                  <div class="ai-content-container">
                    <div class="ai-model-header">
                      <span class="ai-model-name">{{ getModelDisplayName(messages[virtualRow.index]) }}</span>
                      <span v-if="messages[virtualRow.index].isStreaming" class="streaming-indicator-badge">
                        <span class="streaming-dot"></span>
                        typing...
                      </span>
                    </div>
                    <div class="ai-bubble">
                      <div class="message-content-wrapper">
                        <MessageContent :content="messages[virtualRow.index].content"
                          :is-streaming="messages[virtualRow.index].isStreaming" :node-id="nodeId"
                          :content-parts="messages[virtualRow.index].contentParts" :message-index="virtualRow.index"
                          :data-message-idx="virtualRow.index" />
                      </div>
                    </div>
                    <div class="message-meta ai-meta">
                      <span class="message-time">{{ formatTime(messages[virtualRow.index].timestamp) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Message Actions (floating on hover) -->
            <div class="message-actions opacity-0 group-hover:opacity-100 transition-all duration-200" :class="{
              'user-actions': messages[virtualRow.index].role === 'user',
              'ai-actions': messages[virtualRow.index].role === 'assistant'
            }">
              <div class="action-buttons-container">
                <button v-if="messages[virtualRow.index].isStreaming" @click.stop="$emit('stop-streaming')"
                  class="action-btn stop-btn" title="Stop streaming">
                  <XCircle class="w-4 h-4" />
                </button>

                <template v-else-if="messages[virtualRow.index].role === 'assistant'">
                  <button @click.stop="$emit('resend', virtualRow.index - 1)" class="action-btn resend-btn"
                    title="Regenerate response">
                    <RotateCw class="w-4 h-4" />
                  </button>

                  <button @click.stop="copyToMarkdown(messages[virtualRow.index])" class="action-btn copy-btn"
                    title="Copy message">
                    <ClipboardCopy class="w-4 h-4" />
                  </button>

                  <!-- TTS Controls -->
                  <div class="tts-controls">
                    <TTSControls :text="messages[virtualRow.index].content"
                      :auto-trigger="props.autoTTSEnabled && virtualRow.index === messages.length - 1 && !messages[virtualRow.index].isStreaming"
                      :streaming-trigger="props.autoTTSEnabled && messages[virtualRow.index].isStreaming && virtualRow.index === messages.length - 1"
                      :streaming-text="messages[virtualRow.index].isStreaming && virtualRow.index === messages.length - 1 ? streamingContent : null"
                      compact />
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- Branch Buttons (Now positioned appropriately based on message type) -->
          <div v-if="messages[virtualRow.index].role === 'user'" class="absolute inset-y-0 -left-12 flex items-center opacity-0 group-hover:opacity-100 
            transition-all duration-200 ease-in-out z-20">
            <button @click.stop="$emit('create-branch', virtualRow.index, 'left')"
              class="p-2 rounded-full hover:bg-white/10 transition-colors group/btn branch-btn"
              :style="{ color: threadColor }" title="Branch left">
              <div class="relative">
                <GitBranch class="w-5 h-5 transform -scale-x-100" />
                <div class="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 
                  group-hover/btn:opacity-100 transition-opacity duration-200 text-xs bg-base-300/90 
                  backdrop-blur px-2 py-1 rounded">
                  Branch left
                </div>
              </div>
            </button>
          </div>
          <div v-if="messages[virtualRow.index].role === 'assistant'" class="absolute inset-y-0 -right-12 flex items-center opacity-0 group-hover:opacity-100 
            transition-all duration-200 ease-in-out z-20">
            <button @click.stop="$emit('create-branch', virtualRow.index, 'right')"
              class="p-2 rounded-full hover:bg-white/10 transition-colors group/btn branch-btn"
              :style="{ color: threadColor }" title="Branch right">
              <div class="relative">
                <GitBranch class="w-5 h-5" />
                <div class="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 
                  group-hover/btn:opacity-100 transition-opacity duration-200 text-xs bg-base-300/90 
                  backdrop-blur px-2 py-1 rounded">
                  Branch right
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { useThrottle, useMessageHeightCache } from '@/composables/usePerformanceOptimization';
import {
  Maximize2,
  Minimize2,
  XCircle,
  RotateCw,
  ClipboardCopy,
  GitBranch,
} from 'lucide-vue-next';

import MessageContent from './MessageContent.vue';
import MessageTimestamp from './MessageTimestamp.vue';
import TTSControls from './TTSControls.vue';
import type { Message } from '@/types/message';
import type { ModelInfo } from '@/types/model';
import { useThemeStore } from '@/stores/themeStore';

// Props
interface Props {
  messages: Message[];
  nodeId: string;
  isSnapped: boolean;
  expandedMessages: Set<number>;
  textContentColor: string;
  threadColor: string;
  autoTTSEnabled?: boolean;
  streamingContent: string | null;
  getMessageStyles: (index: number) => Record<string, any>;
  getModelDisplayName: (message: Message) => string;
  getAvatarUrl: (modelInfo: ModelInfo | null) => string;
  getModelInfo: (modelId: string) => ModelInfo | null;
  copyToMarkdown: (message: Message) => void;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'expand-message': [index: number];
  'stop-streaming': [];
  'resend': [index: number];
  'create-branch': [index: number, direction: 'left' | 'right'];
  'wheel': [event: WheelEvent];
}>();

// Helper function to format time
const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Refs
const parentRef = ref<HTMLElement>();
const measureElement = ref<HTMLElement[]>([]);

// Theme support
const themeStore = useThemeStore();
const currentTheme = computed(() => themeStore.currentTheme);
const themeColors = computed(() => themeStore.currentThemeColors);

// Performance optimizations with height caching
const { cacheHeight, getHeight, averageHeight } = useMessageHeightCache();

// Estimated row height - this will be dynamically adjusted
const estimateSize = ref(160); // More conservative default that matches min-height + padding

// Throttled scroll handler for better performance
const [throttledScrollHandler] = useThrottle((event: WheelEvent) => {
  emit('wheel', event);
}, 16); // ~60fps

// Virtual scrolling setup with proper height measurement
const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: props.messages.length,
    getScrollElement: () => parentRef.value,
    estimateSize: (index) => {
      const messageId = `${props.nodeId}-message-${index}`;
      const cachedHeight = getHeight(messageId);
      return cachedHeight > 0 ? cachedHeight : estimateSize.value;
    },
    overscan: 3,
    measureElement: (el) => {
      if (!el) return estimateSize.value;

      const element = el as HTMLElement;
      const index = element.getAttribute('data-index');

      // First, try to return cached height if available
      if (index !== null) {
        const messageId = `${props.nodeId}-message-${index}`;
        const cachedHeight = getHeight(messageId);
        if (cachedHeight > 0) {
          return cachedHeight;
        }
      }

      // Only measure if element is potentially visible
      const rect = element.getBoundingClientRect();
      const height = rect.height;

      // Only cache height if it's reasonable and element seems to be properly rendered
      // Avoid caching when element is out of viewport (height could be 0 or invalid)
      if (height > 50 && height < 2000 && rect.width > 0) {
        if (index !== null) {
          const messageId = `${props.nodeId}-message-${index}`;
          cacheHeight(messageId, height);
          return height;
        }
      }

      // Fall back to estimate if measurement is invalid
      return estimateSize.value;
    },
  }))
);

// Auto-scroll to bottom for new messages
const scrollToBottom = () => {
  if (parentRef.value) {
    parentRef.value.scrollTop = parentRef.value.scrollHeight;
  }
};

// Watch for new messages and scroll to bottom if needed
watch(
  () => props.messages.length,
  (newLength, oldLength) => {
    if (newLength > oldLength) {
      nextTick(() => {
        // Force remeasure all items when new messages are added
        rowVirtualizer.value.measure();

        // Wait a bit longer for DOM to settle before scrolling
        setTimeout(() => {
          scrollToBottom();
        }, 50);
      });
    }
  }
);

// Watch for content changes and remeasure
watch(
  () => props.messages,
  () => {
    // Clear cache for potentially changed messages
    nextTick(() => {
      // Allow DOM to update then remeasure
      setTimeout(() => {
        rowVirtualizer.value.measure();
      }, 50);
    });
  },
  { deep: true }
);

let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

// Height measurement will be done with simple periodic updates

// Expose scroll methods and DOM element for external use
defineExpose({
  scrollToTop: () => {
    if (parentRef.value) {
      parentRef.value.scrollTop = 0;
    }
  },
  scrollToBottom,
  scrollToIndex: (index: number) => {
    rowVirtualizer.scrollToIndex(index);
  },
  // Method to reset virtual scrolling (useful for zoom changes)
  resetVirtualScrolling: () => {
    console.log('Resetting virtual scrolling');
    // Clear height cache and remeasure
    const { clearCache } = useMessageHeightCache();
    clearCache();

    nextTick(() => {
      setTimeout(() => {
        const updateEstimateSize = () => {
          const messageContainers = document.querySelectorAll('.message-container');
          if (messageContainers.length > 0) {
            const heights = Array.from(messageContainers).map(
              el => {
                const rect = (el as HTMLElement).getBoundingClientRect();
                return rect.width > 0 ? rect.height : 0; // Only use height if element is visible
              }
            ).filter(h => h > 50 && h < 2000);

            if (heights.length > 0) {
              const avgHeight = heights.reduce((sum, h) => sum + h, 0) / heights.length;
              estimateSize.value = Math.max(avgHeight, 150);

              // Cache heights for existing elements
              messageContainers.forEach((container) => {
                const rect = (container as HTMLElement).getBoundingClientRect();
                const height = rect.height;
                const index = (container as HTMLElement).getAttribute('data-index');
                if (height > 50 && height < 2000 && rect.width > 0 && index !== null) {
                  const messageId = `${props.nodeId}-message-${index}`;
                  cacheHeight(messageId, height);
                }
              });

              // Trigger remeasurement
              nextTick(() => {
                rowVirtualizer.value.measure();
              });
            }
          }
        };

        updateEstimateSize();
      }, 100);
    });
  },
  // Expose the DOM element for compatibility with existing code
  $el: parentRef,
  addEventListener: (type: string, listener: EventListener, options?: boolean | AddEventListenerOptions) => {
    if (parentRef.value) {
      parentRef.value.addEventListener(type, listener, options);
    }
  },
  removeEventListener: (type: string, listener: EventListener, options?: boolean | EventListenerOptions) => {
    if (parentRef.value) {
      parentRef.value.removeEventListener(type, listener, options);
    }
  },
  // Expose DOM element properties for compatibility
  get scrollTop() { return parentRef.value?.scrollTop || 0; },
  get scrollHeight() { return parentRef.value?.scrollHeight || 0; },
  get clientHeight() { return parentRef.value?.clientHeight || 0; },
  querySelector: (selector: string) => {
    return parentRef.value?.querySelector(selector) || null;
  },
  getBoundingClientRect: () => {
    return parentRef.value?.getBoundingClientRect() || new DOMRect();
  },
});

// Height measurement setup
onMounted(() => {
  // Initial height calculation after DOM settles
  const updateEstimateSize = () => {
    const messageContainers = document.querySelectorAll('.message-container');
    if (messageContainers.length > 0) {
      const heights = Array.from(messageContainers).map(
        el => {
          const rect = (el as HTMLElement).getBoundingClientRect();
          return rect.width > 0 ? rect.height : 0; // Only use height if element is visible
        }
      ).filter(h => h > 50 && h < 2000); // Only reasonable heights

      if (heights.length > 0) {
        const avgHeight = heights.reduce((sum, h) => sum + h, 0) / heights.length;
        estimateSize.value = Math.max(avgHeight, 150);

        // Cache heights for existing elements
        messageContainers.forEach((container) => {
          const rect = (container as HTMLElement).getBoundingClientRect();
          const height = rect.height;
          const index = (container as HTMLElement).getAttribute('data-index');
          if (height > 50 && height < 2000 && rect.width > 0 && index !== null) {
            const messageId = `${props.nodeId}-message-${index}`;
            cacheHeight(messageId, height);
          }
        });

        // Trigger remeasurement
        nextTick(() => {
          rowVirtualizer.value.measure();
        });
      }
    }
  };

  // Wait for DOM to be ready
  setTimeout(updateEstimateSize, 100);

  // Also update when messages change
  watch(
    () => props.messages.length,
    () => {
      setTimeout(updateEstimateSize, 100);
    }
  );


  onBeforeUnmount(() => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
  });
});
</script>

<style scoped>
/* Performance optimizations with CSS containment */
.messages-scroll-container {
  contain: layout style paint;
  will-change: scroll-position;
  position: relative;
  overflow-anchor: none;
  /* Prevent scroll anchoring issues */
  max-height: 100%;
  box-sizing: border-box;
}

.message-container {
  contain: layout style;
  transition: transform 0.2s ease;
  transform: translateZ(0);
  /* Force GPU acceleration */
}

.message-container:hover {
  transform: translateX(2px) translateZ(0);
}

/* Modern chat bubble layout */
.message-container {
  margin-bottom: 0;
  padding: 0.75rem 0 1rem 0;
  min-height: 80px;
  /* Ensure minimum height for proper virtual scrolling */
  position: relative;
  box-sizing: border-box;
  width: 100%;
}

.message-container:last-child {
  padding-bottom: 1rem;
  /* Keep bottom padding for last message */
}

/* Message bubble container */
.message-bubble-container {
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* User message styling (right side) */
.user-bubble-wrapper {
  display: flex;
  align-items: flex-end;
  margin-left: 20%;
  margin-bottom: 0;
}

.user-bubble {
  background: linear-gradient(135deg, hsl(var(--p)), hsl(var(--p) / 0.9));
  color: hsl(var(--pc));
  padding: 0.75rem 1rem;
  border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
  max-width: 100%;
  word-wrap: break-word;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  backdrop-filter: blur(8px);
}

.user-bubble::before {
  content: '';
  position: absolute;
  bottom: 0;
  right: -8px;
  width: 0;
  height: 0;
  border: 8px solid transparent;
  border-top-color: hsl(var(--p));
  border-right: none;
  transform: rotate(45deg);
}

.user-meta {
  margin-top: 0.25rem;
  margin-right: 0.5rem;
}

/* AI message styling (left side) */
.ai-bubble-wrapper {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  margin-right: 2%;
  margin-left: 2%;
  margin-bottom: 0;
  gap: 0.75rem;
}

.ai-avatar-container {
  flex-shrink: 0;
  margin-top: 0.5rem;
}

.ai-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid hsl(var(--b3));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.ai-content-container {
  flex: 1;
  min-width: 0;
}

.ai-model-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  margin-left: 0.5rem;
}

.ai-model-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--bc) / 0.7);
  letter-spacing: 0.025em;
}

.streaming-indicator-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  background: hsl(var(--s) / 0.1);
  border: 1px solid hsl(var(--s) / 0.3);
  border-radius: 1rem;
  font-size: 0.65rem;
  font-weight: 500;
  color: hsl(var(--s));
}

.streaming-dot {
  width: 4px;
  height: 4px;
  background: hsl(var(--s));
  border-radius: 50%;
  animation: streamingPulse 1.5s ease-in-out infinite;
}

.ai-bubble {
  background: hsl(100% 0 0);
  border: 1px solid hsl(93.2686% 0.016223 262.751375 / 0.5);
  color: hsl(41.8869% 0.053885 255.824911);
  padding: 0.75rem 1rem;
  border-radius: 0.25rem 1.25rem 1.25rem 1.25rem;
  max-width: 100%;
  justify-items: anchor-center;
  word-wrap: break-word;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  position: relative;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.ai-bubble::before {
  content: '';
  position: absolute;
  top: 0;
  left: -8px;
  width: 0;
  height: 0;
  border: 8px solid transparent;
  border-top-color: hsl(var(--b1));
  border-left: none;
  transform: rotate(-45deg);
}

.ai-meta {
  margin-top: 0.25rem;
  margin-left: 0.5rem;
}

/* Message metadata styling */
.message-meta {
  font-size: 0.65rem;
  color: hsl(var(--bc) / 0.5);
  font-weight: 500;
}

.message-time {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-container:hover .message-time {
  opacity: 1;
}

/* Message content wrapper */
.message-content-wrapper {
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Message actions styling */
.message-actions {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 30;
}

.user-actions {
  left: -60px;
}

.ai-actions {
  right: -60px;
}

.action-buttons-container {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: hsl(var(--b1) / 0.95);
  border: 1px solid hsl(var(--b3) / 0.3);
  border-radius: 0.5rem;
  padding: 0.25rem;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  border: none;
  background: transparent;
  cursor: pointer;
}

.action-btn:hover {
  background: hsl(var(--b3) / 0.5);
}

.stop-btn {
  color: hsl(var(--er));
}

.stop-btn:hover {
  background: hsl(var(--er) / 0.1);
}

.resend-btn {
  color: hsl(var(--bc) / 0.7);
}

.resend-btn:hover {
  background: hsl(var(--p) / 0.1);
  color: hsl(var(--p));
}

.copy-btn {
  color: hsl(var(--bc) / 0.7);
}

.copy-btn:hover {
  background: hsl(var(--s) / 0.1);
  color: hsl(var(--s));
}

.tts-controls {
  display: flex;
  align-items: center;
}

/* Theme-specific enhancements */
/* Theme-specific styling now handled by parent component's CSS custom properties */

/* Animation for streaming indicator */
@keyframes streamingPulse {

  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.3;
    transform: scale(1.2);
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .user-bubble-wrapper {
    margin-left: 10%;
  }

  .ai-bubble-wrapper {
    margin-right: 10%;
  }

  .ai-avatar {
    width: 1.75rem;
    height: 1.75rem;
  }

  .user-bubble,
  .ai-bubble {
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
  }

  .user-actions {
    left: -50px;
  }

  .ai-actions {
    right: -50px;
  }
}

@media (max-width: 480px) {
  .user-bubble-wrapper {
    margin-left: 5%;
  }

  .ai-bubble-wrapper {
    margin-right: 5%;
  }

  .user-actions {
    left: -40px;
  }

  .ai-actions {
    right: -40px;
  }
}

/* Branch button positioning */
.branch-btn {
  position: absolute;
  z-index: 20;
}

/* Optimize virtual scroll container */
.virtual-container {
  contain: strict;
  overflow: hidden;
}

/* GPU acceleration for smooth scrolling */
.virtual-item {
  will-change: transform;
  transform: translateZ(0);
}

/* Ensure virtual rows are properly isolated */
.message-container {
  isolation: isolate;
  z-index: 1;
}

/* Prevent content shifting during virtual scrolling */
.messages-scroll-container>div {
  contain: size layout style;
}

/* Ensure virtual items don't interfere with each other */
.messages-scroll-container>div>div {
  contain: layout style;
  pointer-events: auto;
}
</style>