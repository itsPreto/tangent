<!-- BranchNode.vue -->
<template>
  <div class="branch-node" :class="{
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
          <!-- Dark overlay on hover (optional 'cool' effect) -->
          <div
            class="avatar-overlay transition-opacity duration-200 opacity-0 absolute inset-0 rounded-full bg-black/30 group-hover:opacity-100">
          </div>
          <!-- Tooltip -->
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
          <div class="flex items-center gap-3">
            <button @click.stop="isExpanded = !isExpanded"
              class="p-2 rounded-full hover:bg-base-300/80 transition-colors">
              <ChevronDown class="w-5 h-5 transition-transform duration-200" :class="{ '-rotate-90': !isExpanded }"
                :style="{ color: threadColor }" />
            </button>

            <div class="flex flex-col">
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

              <div class="flex items-center gap-2 mt-1">
                <MessageCircle class="w-4 h-4 text-base-content/60" />
                <span class="text-sm text-base-content/60">
                  {{ node.messages?.length || 0 }} messages
                </span>
              </div>
            </div>
          </div>

          <button v-if="node.type !== 'main'"
            class="p-2 rounded-full hover:bg-destructive/10 text-base-content/60 hover:text-destructive flex-shrink-0"
            @click.stop="$emit('delete')">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div v-if="isExpanded && node.messages" class="space-y-4">
          <div v-for="(msg, i) in displayMessages" :key="i" class="relative group message-container"
            :style="getMessageStyles(i)">
            <MessageTimestamp :timestamp="msg.timestamp" :side="node.type === 'branch' ? 'left' : 'right'" />

            <div class="p-4 relative z-10">
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

              <div class="text-sm text-base-content break-words overflow-hidden" :class="{
                'line-clamp-2': expandedMessages.has(i),
                'whitespace-pre-wrap': !msg.isStreaming,
                'whitespace-normal': msg.isStreaming
              }">
                <MessageContent :content="msg.content" :is-streaming="msg.isStreaming" />
              </div>

              <div class="mt-3 flex items-center justify-between">
                <div class="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button class="flex items-center gap-2 text-sm text-primary hover:underline"
                    @click.stop="createBranch(i)">
                    <PlusCircle class="w-4 h-4" />
                    New branch
                  </button>

                  <button v-if="msg.isStreaming" class="flex items-center gap-2 text-sm text-red-500 hover:underline"
                    @click.stop="stopStreaming">
                    <XCircle class="w-4 h-4" />
                    Stop
                  </button>

                  <button v-else-if="msg.role === 'assistant'"
                    class="flex items-center gap-2 text-sm text-primary hover:underline"
                    @click.stop="handleRegenerate(i)">
                    <RotateCw class="w-4 h-4" />
                    Regenerate
                  </button>
                </div>

                <!-- Model Badge (replaced text bubble with a mini avatar + label) -->
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
  ChevronDown, MessageCircle, Edit2, X, PlusCircle,
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
  }
});

const emit = defineEmits(['select', 'drag-start', 'create-branch', 'update-title', 'delete']);

// UI states
const isExpanded = ref(true);
const isEditing = ref(false);
const titleInput = ref('');
const expandedMessages = ref(new Set());
const titleInputRef = ref<HTMLElement | null>(null);
const isDraggable = ref(false);
const dragStartPosition = ref({ x: 0, y: 0 });
const DRAG_THRESHOLD = 5; // Pixels to move before initiating drag
const isStreaming = ref(false);
const fadeTimeout = ref(null);

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
  const index = Math.abs(Math.floor(Math.sin(props.node.id) * hues.length));
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

// Model tracking
const modelRegistry = ref(new Map<string, ModelInfo>());

const providerAvatars: Record<string, string> = {
  Anthropic: anthropic,
  OpenAI: openai,
  Google: google,
  Meta: meta,
  Mistral: mistral,
  Unknown: unknownAvatar,
}

function getAvatarUrl(model?: ModelInfo): string {
  if (!model) return providerAvatars['Unknown'];
  if (model.source === 'ollama') {
    // Could be a dedicated "ollama" avatar
    return ollama;
  }
  // For openrouter-based (Anthropic, OpenAI, etc.)
  const avatar = providerAvatars[model.provider || 'Unknown'];
  return avatar || providerAvatars['Unknown'];
}

// Get unique models used in the thread
const uniqueModels = computed(() => {
  const models = new Set<ModelInfo>();
  props.node.messages.forEach((msg) => {
    if (msg.modelId) {
      const model = modelRegistry.value.get(msg.modelId);
      if (model) models.add(model);
    }
  });
  return Array.from(models);
});

// Helper functions for model retrieval
function getModelInfo(modelId?: string): ModelInfo | undefined {
  if (!modelId) return undefined;
  return modelRegistry.value.get(modelId);
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
const createBranch = (messageIndex: number) => {
  const offset = messageIndex * 120;
  // Calculate new branch position
  const position = {
    x: props.node.x + 300,
    y: props.node.y + offset - 60
  };

  // Create initial data for the new branch
  const initialData = {
    title: `Branch from "${props.node.title || 'Untitled Thread'}"`,
    // Copy messages up to this branch point
    messages: props.node.messages.slice(0, messageIndex + 1),
    branchMessageIndex: messageIndex
  };

  emit('create-branch', props.node.id, messageIndex, position, initialData);
};

/* ------------------
   Message sending
------------------ */
async function handleMessageSend(message: string) {
  const systemPrompt = `
    You are a helpful coding assistant.
    Always output any code in fenced blocks with the correct syntax, like:
    \`\`\`python
    # some python code
    \`\`\`
    or \`\`\`jsx
    // some React code
    \`\`\`
  `;

  try {
    isLoading.value = true;
    abortController = new AbortController();

    // Create/update model info
    let modelInfo: ModelInfo;
    if (props.selectedModel.includes('/')) {
      const [provider, name] = props.selectedModel.split('/');
      modelInfo = {
        id: props.selectedModel,
        name: name,
        source: 'openrouter',
        provider: provider
      };
    } else {
      modelInfo = {
        id: props.selectedModel,
        name: props.selectedModel,
        source: 'ollama'
      };
    }
    modelRegistry.value.set(modelInfo.id, modelInfo);

    const userMessage: ExtendedMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    store.addMessage(props.node.id, userMessage);

    const messageContext = props.node.messages.map((msg) => ({
      role: msg.role,
      content: msg.content
    }));

    const isOpenRouter = props.selectedModel.includes('/');

    const endpoint = isOpenRouter
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'http://localhost:11434/api/chat';

    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (isOpenRouter) {
      headers['Authorization'] = `Bearer ${props.openRouterApiKey}`;
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'Tangent Chat';
    }

    const requestBody = {
      model: props.selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messageContext,
        { role: 'user', content: message }
      ],
      stream: true
    };

    console.log('OpenRouter Request:', {
      model: props.selectedModel,
      headers,
      body: requestBody
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: abortController.signal
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(`OpenRouter API error: ${response.status} ${errorData}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is null');

    let accumulatedContent = '';
    const decoder = new TextDecoder();

    if (isOpenRouter) {
      // OpenRouter SSE handling
      const processLine = (line: string) => {
        if (!line || line.startsWith(': OPENROUTER PROCESSING')) return;
        if (line.startsWith('data: ')) {
          line = line.slice(5);
        }

        try {
          const data = JSON.parse(line);
          const content = data.choices?.[0]?.delta?.content || '';
          if (content) {
            accumulatedContent += content;
            store.setStreamingContent(props.node.id, accumulatedContent);
          }
        } catch (e) {
          console.error('Error parsing OpenRouter response:', e, 'Line:', line);
        }
      };

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep last incomplete line

        for (const line of lines) {
          processLine(line.trim());
        }
      }
      if (buffer) {
        processLine(buffer.trim());
      }
    } else {
      // Ollama streaming
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((l) => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            const content = data.message?.content || '';
            if (content) {
              accumulatedContent += content;
              store.setStreamingContent(props.node.id, accumulatedContent);
            }
          } catch (e) {
            console.error('Error parsing chunk:', e);
          }
        }
      }
    }

    // Store final message
    const assistantMessage: ExtendedMessage = {
      role: 'assistant',
      content: accumulatedContent,
      timestamp: new Date().toISOString(),
      modelId: modelInfo.id
    };
    store.addMessage(props.node.id, assistantMessage);
    store.setStreamingContent(props.node.id, null);

    // Auto-generate title for new conversations
    if (props.node.messages.length === 2 && !props.node.title) {
      generateTitle();
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('Request aborted');
    } else {
      console.error('Error sending message:', error);
    }
    store.setStreamingContent(props.node.id, null);
  } finally {
    isLoading.value = false;
    abortController = null;
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
   Regenerate logic
------------------ */
function handleRegenerate(assistantIndex: number) {
  const lastMsg = props.node.messages[assistantIndex];
  if (lastMsg?.role === 'assistant') {
    store.removeMessage(props.node.id, assistantIndex);
  }

  const userIndex = assistantIndex - 1;
  const userMsg = props.node.messages[userIndex];
  if (userMsg?.role === 'user') {
    handleMessageSend(userMsg.content);
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
    props.node.type === 'branch' && index <= props.node.branchMessageIndex;
  return {
    background: `linear-gradient(to right, ${threadColor.value}10, ${threadColor.value}25)`,
    borderLeft: `4px solid ${threadColor.value}`,
    borderRadius: '0.5rem',
    position: 'relative',
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
    #ff6347 100%
  );
  background-size: 200% 100%;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  animation: flowBorder 3s linear infinite;
  opacity: 0;
  transition: opacity 1s ease-in-out;
  z-index: 0;
}

.streaming .node-card::before {
  inset: -2px;  /* Reduced from -4px */
  padding: 2px;  /* Reduced from 4px */
  filter: blur(3px);  /* Slightly reduced blur */
}

.streaming .node-card::after {
  inset: -1px;  /* Reduced from -2px */
  padding: 1px;  /* Reduced from 2px */
  filter: blur(1px);  /* Reduced blur for sharper inner border */
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

.message-container:hover .model-badge {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
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