<template>
  <div class="branch-node" :data-node-id="node.id" :class="{
    'selected': isSelected,
    'streaming': node.streamingContent,
    'active': isStreaming,
    'fading-out': !node.streamingContent && isStreaming,
    'draggable': isDraggable
  }" @click="$emit('select')" @mousedown="handleMouseDown" @mousemove="handleMouseMove" @mouseup="handleMouseUp">
    <Card class="bg-base-200/25 backdrop-blur node-card max-w-2xl w-[42rem]" :style="nodeStyles">
      <!-- Model Avatars -->
      <div class="absolute -top-4 left-1/2 transform -translate-x-1/2 flex -space-x-2 px-2">
        <div v-for="model in uniqueModels" :key="model.id" class="relative group w-9 h-9">
          <img :src="getAvatarUrl(model)" alt="Provider Avatar"
            class="w-9 h-9 rounded-full border-2 border-base-100 dark:border-base-300 shadow-md object-cover" />
          <div
            class="avatar-overlay transition-opacity duration-200 opacity-0 absolute inset-0 rounded-full bg-black/30 group-hover:opacity-100">
          </div>
          <div class="absolute bottom-full mb-2 hidden group-hover:block z-50"
            style="left: 50%; transform: translateX(-50%);">
            <div
              class="bg-base-100 dark:bg-base-300 border rounded-md shadow-lg px-2 py-1 text-xs whitespace-nowrap text-base-content">
              {{ model.name }}
            </div>
          </div>
        </div>
      </div>

      <div class="p-4">
        <div class="flex items-center justify-between mb-4">
          <!-- Header Content -->
          <div class="flex items-center gap-3">
            <button @click.stop="isExpanded = !isExpanded"
              class="p-2 rounded-full hover:bg-base-300/80 transition-colors">
              <ChevronDown class="w-5 h-5 transition-transform duration-200" :class="{ '-rotate-90': !isExpanded }"
                :style="{ color: threadColor }" />
            </button>

            <div class="flex flex-col">
              <!-- Title Section -->
              <div class="flex items-center gap-2">
                <template v-if="isEditing">
                  <input ref="titleInputRef" v-model="titleInput" @blur="handleTitleUpdate"
                    @keyup.enter="handleTitleUpdate" class="bg-base-100 px-2 py-1 rounded border text-base-content"
                    placeholder="Enter title..." />
                </template>
                <template v-else>
                  <span class="text-lg font-semibold truncate max-w-lg text-base-content">
                    {{ node.title || "Untitled Thread" }}
                  </span>
                  <button @click.stop="startEditing" class="p-1 rounded-full hover:bg-base-300/80 flex-shrink-0">
                    <Edit2 class="w-4 h-4 text-base-content/60" />
                  </button>
                </template>
              </div>

              <!-- Message Count -->
              <div class="flex items-center gap-2 mt-1">
                <MessageCircle class="w-4 h-4 text-base-content/60" />
                <span class="text-sm text-base-content/60">
                  {{ node.messages?.length || 0 }} messages
                </span>
              </div>
            </div>
          </div>

          <!-- Delete Button -->
          <button v-if="node.type !== 'main'"
            class="p-2 rounded-full hover:bg-destructive/10 text-base-content/60 hover:text-destructive flex-shrink-0"
            @click.stop="$emit('delete')">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Messages -->
        <div v-if="isExpanded && node.messages" class="space-y-4">
          <div v-for="(msg, i) in displayMessages" :key="i" class="relative group message-container"
            :style="getMessageStyles(i)">
            <MessageTimestamp :timestamp="msg.timestamp" :side="node.type === 'branch' ? 'left' : 'right'" />

            <!-- Branch Button -->
            <div
              class="absolute inset-y-0 -left-12 flex items-center opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out z-20">
              <button @click.stop="createBranch(i, 'left')"
                class="p-2 rounded-full hover:bg-base-300/80 text-primary hover:text-primary/80 transition-colors group/btn"
                title="Branch left">
                <div class="relative">
                  <GitBranch class="w-5 h-5 transform -scale-x-100" />
                  <div
                    class="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 text-xs bg-base-300/90 backdrop-blur px-2 py-1 rounded">
                    Branch left
                  </div>
                </div>
              </button>
            </div>

            <div
              class="absolute inset-y-0 -right-12 flex items-center opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out z-20">
              <button @click.stop="createBranch(i, 'right')"
                class="p-2 rounded-full hover:bg-base-300/80 text-primary hover:text-primary/80 transition-colors group/btn"
                title="Branch right">
                <div class="relative">
                  <GitBranch class="w-5 h-5" />
                  <div
                    class="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 text-xs bg-base-300/90 backdrop-blur px-2 py-1 rounded">
                    Branch right
                  </div>
                </div>
              </button>
            </div>

            <div class="p-4 relative z-10">
              <!-- Message Header -->
              <div class="flex items-center justify-between mb-2">
                <Badge :variant="msg.role === 'user' ? 'default' : msg.isStreaming ? 'outline' : 'secondary'"
                  class="text-xs">
                  {{ msg.role === 'user' ? 'You' : msg.isStreaming ? 'AI Typing...' : 'AI' }}
                </Badge>

                <div class="flex items-center gap-2" v-if="!msg.isStreaming">
                  <button @click.stop="expandMessage(i)" class="p-1.5 rounded-full hover:bg-base-300/80">
                    <component :is="expandedMessages.has(i) ? Maximize2 : Minimize2"
                      class="w-4 h-4 text-base-content/60" />
                  </button>
                </div>
              </div>

              <!-- Message Content -->
              <div class="text-sm text-base-content break-words overflow-hidden" :class="{
                'line-clamp-2': expandedMessages.has(i),
                'whitespace-pre-wrap': !msg.isStreaming,
                'whitespace-normal': msg.isStreaming
              }">
                <MessageContent :content="msg.content" :is-streaming="msg.isStreaming" />
              </div>

              <!-- Message Actions -->
              <div class="mt-3 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <button v-if="msg.isStreaming"
                    class="flex items-center gap-2 text-sm text-red-500 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                    @click.stop="stopStreaming">
                    <XCircle class="w-4 h-4" />
                    Stop
                  </button>

                  <button v-else-if="msg.role === 'assistant'"
                    class="flex items-center gap-2 text-sm text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                    @click.stop="$emit('resend', i - 1)">
                    <RotateCw class="w-4 h-4" />
                    Resend
                  </button>
                </div>

                <!-- Model Badge -->
                <div v-if="msg.role === 'assistant'"
                  class="model-badge opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-base-100/90 dark:bg-base-300/80 border border-base-200 dark:border-base-400">
                  <img :src="getAvatarUrl(getModelInfo(msg.modelId))" alt="Model Avatar"
                    class="w-4 h-4 rounded-full object-cover" />
                  <span class="text-base-content">
                    {{ getModelInfo(msg.modelId)?.name || 'Unknown Model' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Collapsed View -->
        <div v-else-if="node.messages?.length" class="mt-2 text-sm text-base-content/60">
          <div class="line-clamp-2 break-words overflow-hidden">
            Last message:
            {{ node.streamingContent || node.messages[node.messages.length - 1]?.content }}
          </div>
        </div>
      </div>

      <MessageInput :is-loading="isLoading" @send="handleMessageSend" @stop="stopStreaming" />
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onBeforeUnmount, watch } from 'vue';
import type { PropType } from 'vue';
import {
  ChevronDown, MessageCircle, Edit2, X,
  Maximize2, Minimize2, XCircle, RotateCw
} from 'lucide-vue-next';

import MessageInput from '../../messages/MessageInput.vue';
import { useCanvasStore } from '../../../stores/canvasStore';
import Card from '../../ui/Card.vue';
import Badge from '../../ui/Badge.vue';
import MessageContent from '../../messages/MessageContent.vue';
import MessageTimestamp from '../../messages/MessageTimestamp.vue';
import type { Message, Node } from '../../../types/message';
import anthropic from '@/assets/anthropic.jpeg'
import openai from '@/assets/openai.jpeg'
import google from '@/assets/google.jpeg'
import meta from '@/assets/meta.jpeg'
import mistral from '@/assets/mistral.jpeg'
import unknownAvatar from '@/assets/unknown.jpeg'
import ollama from '@/assets/ollama.jpeg'
import { GitBranch } from 'lucide-vue-next';

interface ModelInfo {
  id: string;
  name: string;
  source: 'ollama' | 'openrouter';
  provider?: string;
}

interface ExtendedMessage extends Message {
  modelId?: string;
}

interface ExtendedNode extends Node {
  messages: ExtendedMessage[];
  streamingContent: string | null
}

const props = defineProps({
  node: {
    type: Object as PropType<ExtendedNode>,
    required: true
  },
  isSelected: Boolean,
  selectedModel: {
    type: String,
    required: true
  },
  openRouterApiKey: {
    type: String,
    required: true
  },
  zoom: {
    type: Number,
    required: true
  },
  modelRegistry: {
    type: Object as PropType<Map<string, ModelInfo>>,
    required: true
  }
});


const emit = defineEmits(['select', 'drag-start', 'create-branch', 'update-title', 'delete', 'resend']);

// UI states
const isExpanded = ref(true);
const isEditing = ref(false);
const titleInput = ref('');
const expandedMessages = ref(new Set<number>());
const titleInputRef = ref<HTMLElement | null>(null);
const isDraggable = ref(false);
const dragStartPosition = ref({ x: 0, y: 0 });
const DRAG_THRESHOLD = 5; // Pixels to move before initiating drag
const isStreaming = ref(false);
const fadeTimeout = ref<number | null>(null);

// Store
const store = useCanvasStore();

// Loading / streaming states
const isLoading = ref(false);
// We'll store a single AbortController for the current request
let abortController: AbortController | null = null;

// Watch for title changes
watch(
  () => props.node.title,
  (newTitle) => {
    titleInput.value = newTitle || '';
  },
  { immediate: true }
);

watch(() => props.node.streamingContent, (newVal) => {
  if (newVal) {
    // Clear any existing timeout
    if (fadeTimeout.value) {
      clearTimeout(fadeTimeout.value);
    }
    isStreaming.value = true;
  } else if (isStreaming.value) {
    // Only start fade out if we were streaming
    fadeTimeout.value = setTimeout(() => {
      isStreaming.value = false;
    }, 1000); // Match this to your transition duration
  }
});

const threadColor = computed(() => {
  const hues = [210, 330, 160, 280, 40, 190];
  // Simple pseudo-random approach based on the node ID
  const index = Math.abs(Math.floor(Number(props.node.id) * Math.sin(Number(props.node.id))) % hues.length);
  return `hsl(${hues[index]}, 85%, 45%)`;
});

const displayMessages = computed((): Message[] => {
  if (!props.node.messages) return [];
  return props.node.streamingContent
    ? [
      ...props.node.messages,
      {
        role: 'assistant',
        content: props.node.streamingContent,
        isStreaming: true,
        timestamp: new Date().toISOString()
      }
    ]
    : props.node.messages;
});

const providerAvatars: Record<string, string> = {
  Anthropic: anthropic,
  OpenAI: openai,
  Google: google,
  Meta: meta,
  Mistral: mistral,
  Unknown: unknownAvatar,
  ollama: ollama
};

function getAvatarUrl(model?: ModelInfo): string {
  if (!model) return providerAvatars['Unknown'];

  if (model.source === 'ollama') {
    return providerAvatars['ollama'];
  }

  // For openrouter models
  const avatar = model.provider ? providerAvatars[model.provider] : providerAvatars['Unknown'];
  return avatar || providerAvatars['Unknown'];
}

const uniqueModels = computed(() => {
  const models = new Set<ModelInfo>();
  if (!props.node.messages) return [];

  props.node.messages.forEach((msg) => {
    if (msg.modelId) {
      const model = getModelInfo(msg.modelId);
      if (model) models.add(model);
    }
  });
  return Array.from(models);
});


function getModelInfo(modelId?: string): ModelInfo | undefined {
  if (!modelId) return undefined;

  // First try to get from registry
  const registryModel = props.modelRegistry.get(modelId);
  if (registryModel) return registryModel;

  // Fallback: Parse from model ID if not in registry
  if (modelId.includes('/')) {
    const [provider, name] = modelId.split('/');
    return {
      id: modelId,
      name,
      source: 'openrouter',
      provider
    };
  }

  return {
    id: modelId,
    name: modelId,
    source: 'ollama'
  };
}

const nodeStyles = computed(() => ({
  '--border-color': threadColor.value,
  '--border-color-light': `${threadColor.value}50`
}));

/* ------------------
   Drag event handlers
------------------ */
const handleMouseDown = (e: MouseEvent) => {
  if (props.node.type !== 'main') {
    dragStartPosition.value = { x: e.clientX, y: e.clientY };
    isDraggable.value = true;
  }
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDraggable.value) return;
  const dx = Math.abs(e.clientX - dragStartPosition.value.x);
  const dy = Math.abs(e.clientY - dragStartPosition.value.y);

  if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
    e.stopPropagation();
    isDraggable.value = false;
    emit('drag-start', e, props.node);
  }
};

const handleMouseUp = () => {
  isDraggable.value = false;
};

/* ------------------
   Title editing
------------------ */
const startEditing = () => {
  isEditing.value = true;
  titleInput.value = props.node.title || '';
  nextTick(() => {
    if (titleInputRef.value) {
      (titleInputRef.value as HTMLInputElement).focus();
      (titleInputRef.value as HTMLInputElement).select();
    }
  });
};

const handleTitleUpdate = () => {
  if (titleInput.value.trim()) {
    emit('update-title', props.node.id, titleInput.value.trim());
  }
  isEditing.value = false;
};

/* ------------------
   Branch creation
------------------ */
const createBranch = (messageIndex: number, direction: 'left' | 'right') => {
  const horizontalOffset = direction === 'left'
    ? -store.CARD_WIDTH - 100
    : store.CARD_WIDTH + 100;

  // Calculate new branch position
  const position = {
    x: props.node.x + horizontalOffset,
    y: props.node.y  // Let handleCreateBranch handle vertical positioning
  };

  // Create initial data for the new branch
  const initialData = {
    title: `Branch from "${props.node.title || 'Untitled Thread'}"`,
    messages: props.node.messages.slice(0, messageIndex + 1),
    branchMessageIndex: messageIndex,
    // This is crucial for connector positioning
    type: direction === 'left' ? 'left-branch' : 'right-branch'
  };

  emit('create-branch', props.node.id, messageIndex, position, initialData);
};

/* ------------------
   Message sending
------------------ */

async function handleMessageSend(message: string) {
  isLoading.value = true;
  try {
    await store.sendMessage(props.node.id, message, props.selectedModel, props.openRouterApiKey);
    // Auto-generate title for new conversations
    if (props.node.messages.length === 2 && !props.node.title) {
      generateTitle();
    }
  } catch (error) {
    console.error('Error sending message:', error);
  } finally {
    isLoading.value = false;
  }
}

/* ------------------
   Title generator
------------------ */
async function generateTitle() {
  try {
    const messages = props.node.messages.slice(0, 3);
    const prompt = `Based on this conversation, suggest a concise and descriptive title (max 5 words):\n\n${messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')}`;

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: props.selectedModel,
        prompt,
        system:
          'You are a helpful assistant. Respond only with the title - no explanations or additional text.',
        stream: false
      })
    });

    const data = await response.json();
    const generatedTitle = data.response.trim();
    emit('update-title', props.node.id, generatedTitle);
  } catch (error) {
    console.error('Error generating title:', error);
  }
}

/* ------------------
   Stop streaming
------------------ */
function stopStreaming() {
  if (abortController) {
    abortController.abort();
    store.setStreamingContent(props.node.id, null);
  }
}

/* ------------------
   Expand/collapse
------------------ */
const expandMessage = (index: number) => {
  const newSet = new Set(expandedMessages.value);
  if (newSet.has(index)) {
    newSet.delete(index);
  } else {
    newSet.add(index);
  }
  expandedMessages.value = newSet;
};

function getMessageStyles(index: number) {
  const isInherited =
    props.node.type === 'branch' && props.node.branchMessageIndex !== null && index <= props.node.branchMessageIndex;
  return {
    background: `linear-gradient(to right, ${threadColor.value}10, ${threadColor.value}25)`,
    borderLeft: `4px solid ${threadColor.value}`,
    borderRadius: '0.5rem',
    position: 'relative' as const, // Changed this
    transition: 'box-shadow 0.3s ease',
    ...(isInherited && {
      borderLeft: `4px dashed ${threadColor.value}`,
      background: `linear-gradient(to right, ${threadColor.value}05, ${threadColor.value}10)`,
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)'
    })
  };
}

onMounted(() => {
  if (!props.node.title) {
    isEditing.value = true;
  }
});

onBeforeUnmount(() => {
  isDraggable.value = false;
  if (fadeTimeout.value) {
    clearTimeout(fadeTimeout.value);
  }
});
</script>

<style scoped>
.branch-node {
  position: absolute;
  transition: transform 0.2s ease;
  user-select: none;
}

.draggable:active {
  cursor: grabbing;
}

.node-card {
  backdrop-filter: blur(8px);
  margin: 4px;
  transition: all 0.3s ease;
  position: relative;
}

.node-card:hover {
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1);
}

.selected .node-card {
  ring: 2px;
  ring-color: rgb(59 130 246);
}

/* Base streaming states */
.streaming .node-card::before,
.streaming .node-card::after {
  content: '';
  position: absolute;
  border-radius: inherit;
  background: linear-gradient(90deg,
      #ff1493 0%,
      #ff6347 15%,
      #ffd700 30%,
      #32cd32 45%,
      #4169e1 60%,
      #9400d3 75%,
      #ff1493 90%,
      #ff6347 100%);
  background-size: 200% 100%;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  animation: flowBorder 3s linear infinite;
  opacity: 0;
  transition: opacity 1s ease-in-out;
  z-index: 0;
}

.streaming .node-card::before {
  inset: -2px;
  /* Reduced from -4px */
  padding: 2px;
  /* Reduced from 4px */
  filter: blur(3px);
  /* Slightly reduced blur */
}

.streaming .node-card::after {
  inset: -1px;
  /* Reduced from -2px */
  padding: 1px;
  /* Reduced from 2px */
  filter: blur(1px);
  /* Reduced blur for sharper inner border */
}

/* Animation states */
.branch-node.active .node-card::before,
.branch-node.active .node-card::after {
  opacity: 1;
}

.branch-node.fading-out .node-card::before,
.branch-node.fading-out .node-card::after {
  opacity: 0;
}

@keyframes flowBorder {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}

/* Fix for child content rotation in streaming */
.streaming .node-card>* {
  position: relative;
  z-index: 1;
}

.model-badge {
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-container {
  position: relative;
  transition: all 0.2s ease-in-out;
}

.message-container:hover {
  transform: translateX(0);
}

.branch-button {
  transform: translateX(20px);
  opacity: 0;
  transition: all 0.2s ease-in-out;
}

.message-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: -12px;
  right: -12px;
  bottom: 0;
  z-index: -1;
}

/* Ensure branch buttons have enough hover area */
.message-container .absolute {
  padding: 0.5rem;
  margin: -0.5rem;
}

.message-container:hover .branch-button {
  transform: translateX(0);
  opacity: 1;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.avatar-overlay {
  border-radius: 9999px;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>