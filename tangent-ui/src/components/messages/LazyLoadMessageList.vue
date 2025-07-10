<template>
  <div ref="scrollContainer" class="messages-scroll-container overflow-y-auto overflow-x-hidden px-4"
    :class="'theme-' + currentTheme" :style="{ height: '100%', maxHeight: '100%' }" @scroll="handleScroll">
    <!-- Load more button at top -->
    <div v-if="hasMoreAbove" class="text-center py-2">
      <button @click="loadMoreAbove" :disabled="isLoadingAbove" class="btn btn-sm btn-ghost">
        <span v-if="isLoadingAbove" class="loading loading-spinner loading-xs"></span>
        <span v-else>Load earlier messages</span>
      </button>
    </div>

    <!-- Messages -->
    <div class="space-y-4 py-4">
      <div v-for="(message, index) in visibleMessages" :key="`${nodeId}-message-${startIndex + index}`"
        :ref="el => messageRefs[startIndex + index] = el" class="relative group message-container" :class="{
          'user-message': message.role === 'user',
          'ai-message': message.role === 'assistant'
        }" :data-message-index="startIndex + index" :data-message-id="`${nodeId}-message-${startIndex + index}`"
        :data-code-bubble-parent="true" :style="getMessageStyles(startIndex + index)">
        <!-- Timestamp now handled in header, removed duplicate -->

        <!-- Message Content Container -->
        <div class="relative z-10">
          <!-- Message Content with Hanging Indent -->
          <div class="relative">
            <!-- Message Header - Three column layout for proper centering -->
            <div class="message-header">
              <!-- Left column: Timestamp -->
              <div class="header-left">
                <span class="message-timestamp-prominent">{{ formatTime(message.timestamp) }}</span>
              </div>

              <!-- Center column: Model Name -->
              <div class="header-center">
                <span class="ai-model-name" v-if="message.role === 'assistant'">
                  {{ getModelDisplayName(message) }}
                  <span v-if="message.isStreaming" class="streaming-indicator-badge">
                    <span class="streaming-dot"></span>
                    typing...
                  </span>
                </span>
              </div>

              <!-- Right column: Action buttons -->
              <div class="header-right">
                <div class="header-actions">
                  <!-- Editing controls (when active) -->
                  <div v-if="editingMessageIndex === startIndex + index" class="action-buttons-row">
                    <button @click.stop="saveEditedMessage(startIndex + index)" class="action-btn save-btn"
                      title="Save edit">
                      <Check class="w-4 h-4" />
                    </button>
                    <button @click.stop="cancelEditing()" class="action-btn cancel-btn" title="Cancel edit">
                      <X class="w-4 h-4" />
                    </button>
                  </div>

                  <!-- Standard actions (on hover) -->
                  <div v-else class="action-buttons-row">
                    <!-- Streaming stop button -->
                    <button v-if="message.isStreaming" @click.stop="$emit('stop-streaming')" class="action-btn stop-btn"
                      title="Stop streaming">
                      <XCircle class="w-4 h-4" />
                    </button>

                    <!-- Regular action buttons -->
                    <template v-else>
                      <!-- Edit button -->
                      <button @click.stop="startEditingMessage(startIndex + index)" class="action-btn edit-btn"
                        title="Edit message">
                        <Edit2 class="w-4 h-4" />
                      </button>

                      <!-- Assistant-specific actions -->
                      <template v-if="message.role === 'assistant'">
                        <button @click.stop="$emit('resend', startIndex + index - 1)" class="action-btn resend-btn"
                          title="Regenerate response">
                          <RotateCw class="w-4 h-4" />
                        </button>
                      </template>

                      <!-- Copy button -->
                      <button @click.stop="copyToMarkdown(message)" class="action-btn copy-btn" title="Copy message">
                        <ClipboardCopy class="w-4 h-4" />
                      </button>

                      <!-- TTS Controls -->
                      <div class="tts-controls-wrapper">
                        <TTSControls :text="message.content"
                          :auto-trigger="props.autoTTSEnabled && startIndex + index === messages.length - 1 && !message.isStreaming"
                          :streaming-trigger="props.autoTTSEnabled && message.isStreaming && startIndex + index === messages.length - 1"
                          :streaming-text="message.isStreaming && startIndex + index === messages.length - 1 ? streamingContent : null"
                          compact />
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modern chat bubble layout -->
            <div class="message-bubble-container">
              <!-- User message bubble (right side) -->
              <div v-if="message.role === 'user'" class="user-bubble-wrapper">
                <div class="user-bubble">
                  <div class="message-content-wrapper">
                    <MessageContent v-if="editingMessageIndex !== startIndex + index" :content="message.content"
                      :is-streaming="message.isStreaming" :node-id="nodeId" :content-parts="message.contentParts"
                      :message-index="startIndex + index" :data-message-idx="startIndex + index" />
                    <textarea v-else v-model="editingContent"
                      class="w-full p-2 bg-base-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      :rows="Math.max(3, editingContent.split('\n').length)" @keydown.escape="cancelEditing" />
                  </div>
                </div>
                <!-- User timestamp handled in main header -->
              </div>

              <!-- AI message bubble (left side) -->
              <div v-else class="ai-bubble-wrapper">
                <div class="ai-avatar-container">
                  <img :src="getAvatarUrl(getModelInfo(message.modelId))" :alt="getModelDisplayName(message)"
                    class="ai-avatar" />
                </div>
                <div class="ai-content-container">
                  <div class="ai-bubble">
                    <div class="message-content-wrapper">
                      <MessageContent :content="message.content" :is-streaming="message.isStreaming" :node-id="nodeId"
                        :content-parts="message.contentParts" :message-index="startIndex + index"
                        :data-message-idx="startIndex + index" />
                    </div>
                  </div>
                  <!-- Removed bottom timestamp since it's now in header -->
                </div>
              </div>
            </div>
          </div>

          <!-- Action buttons now integrated into header above -->
        </div>

        <!-- Branch Buttons - Left Side (for all messages) -->
        <div class="absolute inset-y-0 -left-12 flex items-center opacity-60 hover:opacity-100 
          transition-all duration-200 ease-in-out z-20">
          <button @click.stop="$emit('create-branch', startIndex + index, 'left')"
            class="p-2 rounded-full hover:bg-white/10 transition-colors group/btn branch-btn"
            :style="{ color: threadColor }" title="Create new conversation branch to the left">
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

        <!-- Branch Buttons - Right Side (positioned relative to message content) -->
        <div v-if="message.role === 'user'" class="absolute inset-y-0 right-0 flex items-center opacity-60 hover:opacity-100 
          transition-all duration-200 ease-in-out z-20" style="transform: translateX(calc(100% + 12px));">
          <button @click.stop="$emit('create-branch', startIndex + index, 'right')"
            class="p-2 rounded-full hover:bg-white/10 transition-colors group/btn branch-btn"
            :style="{ color: threadColor }" title="Create new conversation branch to the right">
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

        <!-- Branch Buttons - Right Side for AI messages (positioned relative to bubble) -->
        <div v-if="message.role === 'assistant'" class="absolute inset-y-0 right-0 flex items-center opacity-60 hover:opacity-100 
          transition-all duration-200 ease-in-out z-20" style="transform: translateX(calc(100% + 12px));">
          <button @click.stop="$emit('create-branch', startIndex + index, 'right')"
            class="p-2 rounded-full hover:bg-white/10 transition-colors group/btn branch-btn"
            :style="{ color: threadColor }" title="Create new conversation branch to the right">
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

    <!-- Load more button at bottom -->
    <div v-if="hasMoreBelow" ref="bottomTrigger" class="text-center py-2">
      <button @click="loadMoreBelow" :disabled="isLoadingBelow" class="btn btn-sm btn-ghost">
        <span v-if="isLoadingBelow" class="loading loading-spinner loading-xs"></span>
        <span v-else>Load more messages</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import {
  Maximize2,
  Minimize2,
  XCircle,
  RotateCw,
  ClipboardCopy,
  GitBranch,
  Edit2,
  Check,
  X,
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
  'edit-message': [index: number, newContent: string];
}>();

// Helper function to format time
const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Refs
const scrollContainer = ref<HTMLElement>();
const bottomTrigger = ref<HTMLElement>();
const messageRefs = ref<Record<number, HTMLElement>>({});

// Edit state
const editingMessageIndex = ref<number | null>(null);
const editingContent = ref('');

// Theme support
const themeStore = useThemeStore();
const currentTheme = computed(() => themeStore.currentTheme);

// Lazy loading state
const INITIAL_LOAD = 20;
const LOAD_MORE_COUNT = 10;

const startIndex = ref(0);
const endIndex = ref(INITIAL_LOAD);
const isLoadingAbove = ref(false);
const isLoadingBelow = ref(false);

// Computed properties
const visibleMessages = computed(() => {
  return props.messages.slice(startIndex.value, endIndex.value);
});

const hasMoreAbove = computed(() => startIndex.value > 0);
const hasMoreBelow = computed(() => endIndex.value < props.messages.length);

// Load more functions
const loadMoreAbove = async () => {
  if (isLoadingAbove.value || !hasMoreAbove.value) return;

  isLoadingAbove.value = true;
  const oldScrollHeight = scrollContainer.value?.scrollHeight || 0;

  await nextTick();

  startIndex.value = Math.max(0, startIndex.value - LOAD_MORE_COUNT);

  await nextTick();

  // Maintain scroll position
  if (scrollContainer.value) {
    const newScrollHeight = scrollContainer.value.scrollHeight;
    scrollContainer.value.scrollTop += (newScrollHeight - oldScrollHeight);
  }

  isLoadingAbove.value = false;
};

const loadMoreBelow = async () => {
  if (isLoadingBelow.value || !hasMoreBelow.value) return;

  isLoadingBelow.value = true;

  await nextTick();

  endIndex.value = Math.min(props.messages.length, endIndex.value + LOAD_MORE_COUNT);

  isLoadingBelow.value = false;
};

// Scroll handling
const handleScroll = () => {
  if (!scrollContainer.value) return;

  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value;

  // Auto-load when near edges
  if (scrollTop < 100 && hasMoreAbove.value && !isLoadingAbove.value) {
    loadMoreAbove();
  }

  if (scrollTop + clientHeight > scrollHeight - 100 && hasMoreBelow.value && !isLoadingBelow.value) {
    loadMoreBelow();
  }
};

// Intersection observer for auto-loading
let bottomObserver: IntersectionObserver | null = null;

onMounted(() => {
  // Set up intersection observer for bottom trigger
  if (bottomTrigger.value) {
    bottomObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreBelow.value && !isLoadingBelow.value) {
          loadMoreBelow();
        }
      },
      { threshold: 0.1 }
    );
    bottomObserver.observe(bottomTrigger.value);
  }

  // Initialize with recent messages
  if (props.messages.length > INITIAL_LOAD) {
    startIndex.value = Math.max(0, props.messages.length - INITIAL_LOAD);
    endIndex.value = props.messages.length;
  } else {
    startIndex.value = 0;
    endIndex.value = props.messages.length;
  }

  // Scroll to bottom initially
  nextTick(() => {
    scrollToBottom();
  });
});

onBeforeUnmount(() => {
  if (bottomObserver) {
    bottomObserver.disconnect();
  }
});

// Edit message functions
const startEditingMessage = (index: number) => {
  editingMessageIndex.value = index;
  editingContent.value = props.messages[index].content;
};

const saveEditedMessage = (index: number) => {
  if (editingContent.value.trim()) {
    emit('edit-message', index, editingContent.value);
  }
  cancelEditing();
};

const cancelEditing = () => {
  editingMessageIndex.value = null;
  editingContent.value = '';
};

// Auto-scroll to bottom for new messages
const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
};

const scrollToTop = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0;
  }
};

// Watch for new messages
watch(
  () => props.messages.length,
  (newLength, oldLength) => {
    if (newLength > oldLength) {
      // If we're showing the end of the list, include the new message
      if (endIndex.value === oldLength) {
        endIndex.value = newLength;
        nextTick(() => {
          scrollToBottom();
        });
      }
    }
  }
);

// Expose methods for external use
defineExpose({
  scrollToTop,
  scrollToBottom,
  scrollToIndex: (index: number) => {
    // Ensure the index is visible
    if (index < startIndex.value) {
      startIndex.value = Math.max(0, index - 5);
    } else if (index >= endIndex.value) {
      endIndex.value = Math.min(props.messages.length, index + 5);
    }

    nextTick(() => {
      const element = messageRefs.value[index];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  },
  // DOM element compatibility
  $el: scrollContainer,
  addEventListener: (type: string, listener: EventListener, options?: boolean | AddEventListenerOptions) => {
    scrollContainer.value?.addEventListener(type, listener, options);
  },
  removeEventListener: (type: string, listener: EventListener, options?: boolean | EventListenerOptions) => {
    scrollContainer.value?.removeEventListener(type, listener, options);
  },
  get scrollTop() { return scrollContainer.value?.scrollTop || 0; },
  get scrollHeight() { return scrollContainer.value?.scrollHeight || 0; },
  get clientHeight() { return scrollContainer.value?.clientHeight || 0; },
  querySelector: (selector: string) => {
    return scrollContainer.value?.querySelector(selector) || null;
  },
  getBoundingClientRect: () => {
    return scrollContainer.value?.getBoundingClientRect() || new DOMRect();
  },
});
</script>

<style scoped>
/* Container styling */
.messages-scroll-container {
  position: relative;
  scroll-behavior: smooth;
}

/* Message container */
.message-container {
  margin-bottom: 0;
  padding: 0.75rem 0 1rem 0;
  min-height: 80px;
  position: relative;
  box-sizing: border-box;
  width: 90%;
  margin-left: auto;
  margin-right: auto;
}

.message-container:last-child {
  padding-bottom: 1rem;
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
  margin-left: 20px;
  margin-right: 20px;
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

/* Message header - three column layout for proper centering */
.message-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  /* Equal width columns with flexible center */
  align-items: center;
  gap: 1rem;
  margin-left: 20px;
  margin-right: 20px;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: hsl(var(--b1) / 0.9);
  border: 1px solid hsl(var(--b3) / 0.2);
  border-radius: 0.5rem;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  display: flex;
  background: #f2459c;
  border-radius: 16px;
  align-items: center;
  inline-size: fit-content;
  justify-content: flex-start;
  justify-content: flex-start;
}

.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.header-actions {
  display: flex;
  align-items: center;
}

.action-buttons-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  background: hsl(var(--b3) / 0.1);
  border-radius: 0.375rem;
  padding: 0.25rem;
}

.ai-model-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: hsl(var(--bc) / 0.8);
  letter-spacing: 0.025em;
}

/* Prominent timestamp styling */
.message-timestamp-prominent {
  font-size: 0.7rem;
  font-weight: 600;
  color: hsl(var(--bc) / 0.9);
  background: hsl(var(--p) / 0.1);
  border: 1px solid hsl(var(--p) / 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  backdrop-filter: blur(4px);
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
  background: hsl(var(--b1));
  border: 1px solid hsl(var(--b3) / 0.5);
  color: hsl(var(--bc));
  padding: 0.75rem 1rem;
  border-radius: 0.25rem 1.25rem 1.25rem 1.25rem;
  max-width: 100%;
  word-wrap: break-word;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  position: relative;
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

/* Message metadata styling - updated */
.message-meta {
  font-size: 0.65rem;
  color: hsl(var(--bc) / 0.5);
  font-weight: 500;
}

/* Remove old timestamp hover behavior */

/* Message content wrapper */
.message-content-wrapper {
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Message actions styling - top right corner */
.message-actions-top-right {
  position: absolute;
  top: 0.5rem;
  right: 0.75rem;
  z-index: 30;
  display: flex;
  align-items: center;
  transition: opacity 0.2s ease;
}

.editing-controls-bottom,
.standard-actions-bottom {
  display: flex;
  gap: 0.5rem;
  background: hsl(var(--b1) / 0.95);
  border: 1px solid hsl(var(--b3) / 0.3);
  border-radius: 0.5rem;
  padding: 0.375rem;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  align-items: center;
}

.editing-controls-bottom {
  opacity: 1 !important;
  /* Always visible when editing */
}

.tts-controls-wrapper {
  display: flex;
  align-items: center;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0.25rem;
}

.action-btn:hover {
  background: hsl(var(--b3) / 0.5);
  transform: scale(1.05);
}

/* Quick action buttons are smaller */
.quick-actions .action-btn {
  width: 1.5rem;
  height: 1.5rem;
  padding: 0.125rem;
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

.edit-btn {
  color: hsl(var(--bc) / 0.7);
}

.edit-btn:hover {
  background: hsl(var(--p) / 0.1);
  color: hsl(var(--p));
}

.save-btn {
  color: hsl(var(--su));
}

.save-btn:hover {
  background: hsl(var(--su) / 0.1);
}

.cancel-btn {
  color: hsl(var(--er));
}

.cancel-btn:hover {
  background: hsl(var(--er) / 0.1);
}

.tts-controls {
  display: flex;
  align-items: center;
}

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

  /* Adjust header and actions for smaller screens */
  .message-header {
    padding: 0.375rem;
    margin-bottom: 0.375rem;
  }

  .message-actions-top-right {
    top: 0.375rem;
    right: 0.5rem;
  }

  .ai-header-top-right,
  .user-header-top-right {
    right: 0.5rem;
    top: 0.25rem;
  }

  .message-actions-top-right {
    top: 2.5rem;
    right: 0.5rem;
  }

  .action-buttons-row {
    padding: 0.2rem;
    gap: 0.25rem;
  }

  .message-timestamp-prominent {
    font-size: 0.65rem;
    padding: 0.2rem 0.4rem;
  }

  .ai-model-name {
    font-size: 0.7rem;
  }
}

@media (max-width: 480px) {
  .user-bubble-wrapper {
    margin-left: 5%;
  }

  .ai-bubble-wrapper {
    margin-right: 5%;
  }

  .ai-header-top-right,
  .user-header-top-right {
    right: 0.25rem;
    top: 0.125rem;
  }

  .message-actions-top-right {
    top: 2rem;
    right: 0.25rem;
  }

  .action-buttons-row {
    padding: 0.15rem;
    gap: 0.2rem;
  }

  .action-btn {
    min-width: 1.75rem;
    height: 1.75rem;
  }

  .message-timestamp-prominent {
    font-size: 0.6rem;
    padding: 0.15rem 0.3rem;
  }

  .ai-model-name {
    font-size: 0.65rem;
  }

  .ai-header-content {
    padding: 0.25rem 0.5rem;
    gap: 0.375rem;
  }
}

/* Branch button positioning */
.branch-btn {
  position: absolute;
  z-index: 20;
}
</style>