<template>
  <div class="branch-node" ref="nodeElement" :data-node-id="node.id" :data-side-panel-open="isSidePanelOpen" :class="{
    'selected': isSelected,
    'glow-highlight': shouldGlow,
    'streaming': node.streamingContent,
    'active': isStreaming,
    'fading-out': !node.streamingContent && isStreaming,
    'draggable': isDraggable,
    'snapped': isSnapped,  // Use the prop here
    'transition-snap': isTransitioningSnap
  }" @click="handleNodeClick" @mousedown="handleMouseDown" @mousemove="handleMouseMove" @mouseup="handleMouseUp"
    :style="nodePositionStyle">
    <Card :class="[
      'node-card',
      'backdrop-blur transition-all duration-300',
      isSnapped ? 'snapped-card' : 'max-w-2xl w-[42rem]'
    ]" :style="computedCardStyle">
      <!-- Model Avatar -->
      <div class="relative group w-full h-9 flex items-center justify-center" ref="avatarRef">
        <div class="flex -space-x-3">
          <div v-for="model in uniqueModels" :key="model.id" @click.stop="openModelParams" class="relative first:ml-0">
            <img :src="getAvatarUrl(model)" :alt="model.name"
              class="w-9 h-9 rounded-full border-2 border-base-100 shadow-md object-cover cursor-pointer hover:z-10 transition-transform hover:scale-110" />
          </div>
        </div>
        <!-- Model Settings Editor -->
        <ModelParamsEditor v-if="showParamsEditor" :model="lastModel" :model-avatar="getAvatarUrl(lastModel)"
          :current-parameters="canvasStore.getModelParams(node.id)" :trigger-rect="avatarRect" @save="updateModelParams"
          @close="() => { showParamsEditor = false }" />
      </div>
      <div :class="['p-4 mt-4', isSnapped ? 'snapped-content' : '']"
        :style="isSnapped ? { height: '100%', display: 'flex', flexDirection: 'column' } : {}">
        <!-- Header Row -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <button @click.stop="isExpanded = !isExpanded" class="p-2 rounded-full hover:bg-white/10 transition-colors"
              :style="{ color: threadColor }">
              <ChevronDown class="w-5 h-5 transition-transform duration-200" :class="{ '-rotate-90': !isExpanded }" />
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
                  <button @click.stop="startEditing" class="p-1 rounded-full hover:bg-white/10 flex-shrink-0">
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

          <!-- Control Buttons -->
          <div class="flex items-center gap-2">
            <button @click.stop="toggleSnap" class="p-2 rounded-full hover:bg-white/10 transition-colors"
              :title="isSnapped ? 'Exit full view' : 'Enter full view'">
              <Expand v-if="!isSnapped" class="w-5 h-5 text-base-content/60" />
              <Shrink v-else class="w-5 h-5 text-base-content/60" />
            </button>

            <button v-if="node.type !== 'main' && !isSnapped"
              class="p-2 rounded-full hover:bg-destructive/10 text-base-content/60 hover:text-destructive flex-shrink-0"
              @click.stop="$emit('delete')">
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Slot for media -->
        <slot></slot>

        <!-- Messages Container -->
        <div :class="[
          'messages-container transition-all duration-300 relative flex-grow overflow-hidden',
          isSnapped ? 'snapped-messages-container' : '',
          isExpanded && node.messages ? 'space-y-4' : ''
        ]">
          <!-- Expanded Messages View -->
          <div v-if="isExpanded && node.messages"
            class="space-y-4 h-full overflow-y-auto px-4 messages-scroll-container" ref="messagesContainerRef"
            tabindex="0" @wheel.capture.stop="handleMessagesWheel">
            <div v-for="(msg, i) in displayMessages" :key="i" class="relative group message-container"
              :style="getMessageStyles(i)">
              <MessageTimestamp :timestamp="msg.timestamp" :side="node.type === 'branch' ? 'left' : 'right'" />

              <!-- Branch Buttons - Left -->
              <div class="absolute inset-y-0 -left-12 flex items-center opacity-0 group-hover:opacity-100 
                transition-all duration-200 ease-in-out z-20">
                <button @click.stop="createBranch(i, 'left')"
                  class="p-2 rounded-full hover:bg-white/10 transition-colors group/btn" :style="{ color: threadColor }"
                  title="Branch left">
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

              <!-- Branch Buttons - Right -->
              <div class="absolute inset-y-0 -right-12 flex items-center opacity-0 group-hover:opacity-100 
                transition-all duration-200 ease-in-out z-20">
                <button @click.stop="createBranch(i, 'right')"
                  class="p-2 rounded-full hover:bg-white/10 transition-colors group/btn" :style="{ color: threadColor }"
                  title="Branch right">
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

              <div class="relative w-full z-10">
                <!-- Message Header -->
                <div class="flex items-center justify-between mb-2">
                  <Badge :variant="msg.role === 'user' ? 'default' : msg.isStreaming ? 'outline' : 'secondary'"
                    class="text-xs">
                    {{ msg.role === 'user' ? 'You' : msg.isStreaming ? 'AI Typing...' : 'AI' }}
                  </Badge>

                  <div class="flex items-center gap-2" v-if="!msg.isStreaming">
                    <button @click.stop="expandMessage(i)" class="p-1.5 rounded-full hover:bg-white/10">
                      <component :is="expandedMessages.has(i) ? Maximize2 : Minimize2"
                        class="w-4 h-4 text-base-content/60" />
                    </button>
                  </div>
                </div>

                <!-- Message Content -->
                <div class="text-sm break-words overflow-hidden" :class="{
                  'line-clamp-2': expandedMessages.has(i),
                  'whitespace-pre-wrap': !msg.isStreaming,
                  'whitespace-normal': msg.isStreaming
                }">
                  <MessageContent :content="msg.content" :is-streaming="msg.isStreaming" />
                </div>

                <!-- Message Actions -->
                <div class="mt-3 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <button v-if="msg.isStreaming" @click.stop="stopStreaming" class="flex items-center gap-2 text-sm text-red-500 hover:underline opacity-0 
                   group-hover:opacity-100 transition-opacity">
                      <XCircle class="w-4 h-4" />
                      Stop
                    </button>

                    <template v-else-if="msg.role === 'assistant'">
                      <button @click.stop="$emit('resend', i - 1)" class="flex items-center gap-2 text-sm hover:underline opacity-0 
                     group-hover:opacity-100 transition-opacity" :style="{ color: threadColor }">
                        <RotateCw class="w-4 h-4" />
                      </button>

                      <button @click.stop="copyToMarkdown(msg)" class="flex items-center gap-2 text-sm hover:underline opacity-0 
                     group-hover:opacity-100 transition-opacity" :style="{ color: threadColor }">
                        <ClipboardCopy class="w-4 h-4" />
                      </button>
                    </template>
                  </div>

                  <!-- Model Badge remains unchanged -->
                  <div v-if="msg.role === 'assistant'" class="model-badge opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 
              px-3 py-1 rounded-full text-xs bg-base-100/90 border border-base-200">
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

          <!-- Scroll Buttons -->
          <div v-if="isSnapped && showScrollButtons" class="absolute right-4 bottom-20 flex flex-col gap-2 z-50">
            <button @click="scrollToTop" class="p-2 rounded-full bg-base-300/80 hover:bg-base-300 transition-colors"
              :class="{ 'opacity-0 pointer-events-none': isAtTop }">
              <ChevronUp class="w-5 h-5" />
            </button>
            <button @click="scrollToBottom" class="p-2 rounded-full bg-base-300/80 hover:bg-base-300 transition-colors"
              :class="{ 'opacity-0 pointer-events-none': isAtBottom }">
              <ChevronDown class="w-5 h-5" />
            </button>
          </div>

          <!-- Collapsed View -->
          <div v-if="!isExpanded && node.messages?.length" class="mt-2 text-sm text-base-content/60">
            <div class="line-clamp-2 break-words overflow-hidden">
              Last message:
              {{ node.streamingContent || node.messages[node.messages.length - 1]?.content }}
            </div>
          </div>
        </div>
      </div>

      <!-- Message Input -->
      <MessageInput :is-loading="isLoading" @send="handleMessageSend" @stop="stopStreaming" @click="handleInputClick" />
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onBeforeUnmount, watch, type PropType } from 'vue';
import {
  ChevronDown,
  ChevronUp,
  MessageCircle,
  ClipboardCopy,
  Edit2,
  X,
  Maximize2,
  Minimize2,
  XCircle,
  RotateCw,
  Expand,
  Shrink,
  GitBranch
} from 'lucide-vue-next';

import MessageInput from '../../messages/MessageInput.vue';
import { useCanvasStore } from '../../../stores/canvasStore';
import { Card } from '@/components/ui/card';
import Badge from '../../ui/Badge.vue';
import MessageContent from '../../messages/MessageContent.vue';
import MessageTimestamp from '../../messages/MessageTimestamp.vue';
import ModelParamsEditor from '../../models/ModelParamsEditor.vue';
import type { ModelParameters } from '@/types/model';
import type { ModelInfo } from '@/types/model';
import { useModelStore } from '@/stores/modelStore';
import anthropic from '@/assets/anthropic.jpeg';
import openai from '@/assets/openai.jpeg';
import google from '@/assets/google.jpeg';
import meta from '@/assets/meta.jpeg';
import mistral from '@/assets/mistral.jpeg';
import unknownAvatar from '@/assets/unknown.jpeg';
import ollama from '@/assets/ollama.jpeg';

interface ExtendedMessage extends ModelParameters {
  // Extend as needed
  modelId?: string;
}

interface ExtendedNode {
  id: string;
  title?: string;
  messages: ExtendedMessage[];
  streamingContent: string | null;
  type: string;
  branchMessageIndex: number | null;
  x: number;
  y: number;
  // … plus any additional properties you need
}

const props = defineProps({
  node: {
    type: Object as PropType<ExtendedNode>,
    required: true
  },
  isSelected: Boolean,
  selectedModel: { type: String, required: true },
  openRouterApiKey: { type: String, required: true },
  modelType: { type: String, required: true, default: "" },
  zoom: { type: Number, required: true },
  modelRegistry: { type: Object as PropType<Map<string, ModelInfo>>, required: true },
  isSidePanelOpen: { type: Boolean, default: false }
});

const emit = defineEmits([
  'select',
  'drag-start',
  'create-branch',
  'update-title',
  'delete',
  'resend',
  'update-position',
  'snap',
  'unsnap',
  'focus-input'
]);

// Local state and refs
const isExpanded = ref(true);
const isEditing = ref(false);
const titleInput = ref('');
const messagesContainerRef = ref<HTMLElement | null>(null);
const showScrollButtons = ref(false);
const isAtTop = ref(true);
const isAtBottom = ref(true);
const expandedMessages = ref(new Set<number>());
const titleInputRef = ref<HTMLElement | null>(null);
const isDraggable = ref(false);
const isDragging = ref(false);
const dragStartPosition = ref({ x: 0, y: 0 });
const DRAG_THRESHOLD = 5;
const isStreaming = ref(false);
const fadeTimeout = ref<number | null>(null);
const lastModel = ref<ModelInfo | undefined>(undefined);

const isSnapped = ref(false);
const isTransitioningSnap = ref(false);
const originalPosition = ref<{ x: number; y: number; left?: number; top?: number }>({ x: 0, y: 0 });

const canvasStore = useCanvasStore();
const modelStore = useModelStore();

const showParamsEditor = ref(false);
const avatarRef = ref<HTMLElement | null>(null);
// --- NEW: Computed avatarRect for ModelParamsEditor ---
const avatarRect = computed(() => avatarRef.value ? avatarRef.value.getBoundingClientRect() : null);

// Add this computed property
const uniqueModels = computed(() => {
  if (!props.node.messages) return [];

  // Get all unique model IDs from messages
  const modelIds = new Set(
    props.node.messages
      .filter(msg => msg.role === 'assistant' && msg.modelId)
      .map(msg => msg.modelId)
  );

  // Convert to array of model info objects
  return Array.from(modelIds)
    .map(id => getModelInfo(id))
    .filter(Boolean); // Remove any undefined values
});

const isLoading = ref(false);
let abortController: AbortController | null = null;

const threadColor = computed(() => {
  const hues = [210, 330, 160, 280, 40, 190];
  const index = Math.abs(
    Math.floor(Number(props.node.id) * Math.sin(Number(props.node.id))) % hues.length
  );
  return `hsl(${hues[index]}, 85%, 45%)`;
});

const shouldGlow = computed(() => {
  // Only glow if the node is selected and zoom is below 100% (i.e., less than 1)
  return props.isSelected && props.zoom < 1;
});



const calculateSnappedPosition = () => {
  if (!isSnapped.value || !nodeElement.value) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sidePanelWidth = props.isSidePanelOpen ? vw * 0.4 : 0;
  const availableWidth = vw - sidePanelWidth;

  // Get the current node's position and dimensions
  const nodeRect = nodeElement.value.getBoundingClientRect();
  const card = nodeElement.value.querySelector('.node-card');
  if (!card) return null;

  const cardRect = card.getBoundingClientRect();

  // Calculate the scale needed to fit the card
  const scaleX = (availableWidth * 0.9) / cardRect.width;
  const scaleY = (vh * 0.9) / cardRect.height;
  const scale = Math.min(scaleX, scaleY, 1);

  // Calculate the center position for the snapped state
  const targetLeft = sidePanelWidth + (availableWidth - cardRect.width * scale) / 2;
  const targetTop = (vh - cardRect.height * scale) / 2;

  return {
    targetLeft,
    targetTop,
    scale,
    currentLeft: nodeRect.left,
    currentTop: nodeRect.top,
    currentScale: props.zoom
  };
};

const calculateAndUpdateSnappedPosition = () => {
  if (!isSnapped.value) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sidePanelWidth = props.isSidePanelOpen ? vw * 0.4 : 0;
  const availableWidth = vw - sidePanelWidth;
  const availableHeight = vh;

  nextTick(() => {
    if (nodeElement.value) {
      const card = nodeElement.value.querySelector('.snapped-card') as HTMLElement;
      if (card) {
        const cardWidth = card.offsetWidth;
        const cardHeight = card.offsetHeight;
        const scaleX = (availableWidth * 0.9) / cardWidth;
        const scaleY = (availableHeight * 0.9) / cardHeight;
        const scale = Math.min(scaleX, scaleY, 1);
        const left = sidePanelWidth + (availableWidth - cardWidth * scale) / 2;
        const top = (availableHeight - cardHeight * scale) / 2;
        nodeElement.value.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
        nodeElement.value.style.transformOrigin = 'top left';
      }
    }
  });
};



const displayMessages = computed((): ExtendedMessage[] => {
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

const handleInputClick = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (!isSnapped.value) {
    emit('focus-input', { nodeId: props.node.id });
  }
};

const handleNodeClick = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('input')) {
    e.stopPropagation();
    return;
  }
  emit('select');
};


const nodePositionStyle = computed(() => {
  if (isSnapped.value) {
    const snappedPosition = calculateSnappedPosition();
    if (!snappedPosition) return {};

    // During the transition, animate from current position to target position
    return {
      position: 'fixed',
      transform: `translate3d(${snappedPosition.targetLeft}px, ${snappedPosition.targetTop}px, 0) scale(${snappedPosition.scale})`,
      transformOrigin: '0 0',
      transition: isTransitioningSnap.value ? 'transform 0.3s ease-out' : 'none'
    };
  }

  // Normal positioning
  return {
    transform: `translate(${props.node.x}px, ${props.node.y}px)`,
    transition: isTransitioningSnap.value ? 'transform 0.3s ease-out' : 'none'
  };
});

const toggleSnap = async () => {
  if (!isSnapped.value) {
    console.log('Snapping node:', props.node.id);
    // Store original position before snapping
    originalPosition.value = {
      x: props.node.x,
      y: props.node.y,
      left: nodeElement.value?.getBoundingClientRect().left || 0,
      top: nodeElement.value?.getBoundingClientRect().top || 0
    };

    // Enable transition and snap
    isTransitioningSnap.value = true;
    await nextTick();

    emit('snap', {
      nodeId: props.node.id,
      originalPosition: originalPosition.value
    });

    document.body.classList.add('has-snapped-node');
    isSnapped.value = true;
    canvasStore.snapNode(props.node.id);

    // Disable transition after animation completes
    setTimeout(() => {
      isTransitioningSnap.value = false;
    }, 300);
  } else {
    console.log('Unsnapping node:', props.node.id);
    // Enable transition for unsnapping
    isTransitioningSnap.value = true;

    // Set initial position to current snapped position
    const snappedPosition = calculateSnappedPosition();
    if (snappedPosition) {
      nodeElement.value.style.transform = `translate3d(${snappedPosition.currentLeft}px, ${snappedPosition.currentTop}px, 0) scale(${snappedPosition.currentScale})`;
    }

    await nextTick();

    // Trigger unsnap
    emit('unsnap', {
      nodeId: props.node.id,
      originalPosition: originalPosition.value
    });

    document.body.classList.remove('has-snapped-node');
    isSnapped.value = false;
    canvasStore.unsnapNode(props.node.id);

    // Disable transition after animation completes
    setTimeout(() => {
      isTransitioningSnap.value = false;
    }, 300);
  }
};


const nodeElement = ref<HTMLElement | null>(null);

function getAvatarUrl(model?: ModelInfo): string {
  if (!model) return providerAvatars['Unknown'];
  if (model.source === 'ollama') return providerAvatars['ollama'];
  const avatar = model.provider ? providerAvatars[model.provider] : providerAvatars['Unknown'];
  return avatar || providerAvatars['Unknown'];
}

function getModelInfo(modelId?: string): ModelInfo | undefined {
  if (!modelId) return undefined;
  const registryModel = props.modelRegistry.get(modelId);
  if (registryModel) return registryModel;
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

const onKeyDown = (e: KeyboardEvent) => {
  const activeTag = document.activeElement?.tagName.toLowerCase();
  if (activeTag === "input" || activeTag === "textarea") return;
  if (!props.isSelected) return;
  if (e.key.toLowerCase() === "s" && !isSnapped.value) {
    e.preventDefault();
    toggleSnap();
  } else if (e.key === "Escape" && isSnapped.value) {
    e.preventDefault();
    toggleSnap();
  }
};

const nodeStyles = computed(() => ({
  '--border-color': threadColor.value,
  '--border-color-light': `${threadColor.value}50`
}));

const handleMouseDown = (e: MouseEvent) => {
  if (props.node.type !== 'main' && !isSnapped.value) {
    dragStartPosition.value = { x: e.clientX, y: e.clientY };
    isDraggable.value = true;
    isDragging.value = false;
  }
};

const copyToMarkdown = async (msg: ExtendedMessage) => {
  try {
    // Convert code blocks to markdown format
    let markdownContent = msg.content.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      return `\`\`\`${lang || ''}\n${code.trim()}\n\`\`\``;
    });

    // Add extra newline after code blocks for better formatting
    markdownContent = markdownContent.replace(/```\n/g, '```\n\n');

    // Copy to clipboard
    await navigator.clipboard.writeText(markdownContent);

    // Optional: Show a notification or feedback
    // You could add a toast notification here if you have a notification system
  } catch (error) {
    console.error('Error copying to clipboard:', error);
  }
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDraggable.value) return;
  const dx = Math.abs(e.clientX - dragStartPosition.value.x);
  const dy = Math.abs(e.clientY - dragStartPosition.value.y);
  if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
    e.stopPropagation();
    isDraggable.value = false;
    isDragging.value = true;
    emit('drag-start', e, props.node);
  }
};

const handleMouseUp = () => {
  const wasDragging = isDragging.value;
  isDraggable.value = false;
  isDragging.value = false;
  if (!wasDragging) {
    emit('select');
  }
};

const scrollToTop = () => {
  if (messagesContainerRef.value) {
    messagesContainerRef.value.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
};

const openModelParams = () => {
  showParamsEditor.value = true;
};

const updateModelParams = (params: ModelParameters) => {
  canvasStore.updateModelParams(props.node.id, params);
  showParamsEditor.value = false;
};

const scrollToBottom = () => {
  if (messagesContainerRef.value) {
    const container = messagesContainerRef.value;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }
};

const updateScrollButtonsVisibility = () => {
  if (!messagesContainerRef.value) return;
  const container = messagesContainerRef.value;
  const { scrollTop, scrollHeight, clientHeight } = container;
  showScrollButtons.value = scrollHeight > clientHeight;
  isAtTop.value = scrollTop <= 10;
  isAtBottom.value = Math.ceil(scrollTop + clientHeight) >= scrollHeight - 10;
};

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

const createBranch = (messageIndex: number, direction: 'left' | 'right') => {
  const horizontalOffset = direction === 'left'
    ? -canvasStore.CARD_WIDTH - 100
    : canvasStore.CARD_WIDTH + 100;
  const position = {
    x: props.node.x + horizontalOffset,
    y: props.node.y
  };
  const initialData = {
    title: `Branch from "${props.node.title || 'Untitled Thread'}"`,
    messages: props.node.messages.slice(0, messageIndex + 1),
    branchMessageIndex: messageIndex,
    type: direction === 'left' ? 'left-branch' : 'right-branch'
  };
  emit('create-branch', props.node.id, messageIndex, position, initialData);
};

async function handleMessageSend(message: string) {
  isLoading.value = true;
  try {
    const modelInfo: ModelInfo = {
      id: props.selectedModel,
      name: props.selectedModel,
      source: props.modelType as 'ollama' | 'openrouter' | 'google' | 'anthropic' | 'openai'
    };
    const userMsg = { content: message };
    await canvasStore.sendMessage(
      props.node.id,
      userMsg.content,
      modelInfo,
      props.openRouterApiKey
    );
    if (props.node.messages.length === 2 && !props.node.title) {
      generateTitle();
    }
  } catch (error) {
    console.error('Error sending message:', error);
  } finally {
    isLoading.value = false;
  }
}

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
        system: 'You are a helpful assistant. Respond only with the title - no explanations or additional text.',
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

function stopStreaming() {
  if (abortController) {
    abortController.abort();
    canvasStore.setStreamingContent(props.node.id, null);
  }
}

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
    props.node.type === 'branch' &&
    props.node.branchMessageIndex !== null &&
    index <= props.node.branchMessageIndex;
  const baseColor = threadColor.value;
  const messageBackground = isInherited
    ? `linear-gradient(to right, ${baseColor}03, ${baseColor}08)`
    : `linear-gradient(to right, ${baseColor}08, ${baseColor}15)`;
  return {
    background: messageBackground,
    borderLeft: `4px ${isInherited ? 'dashed' : 'solid'} ${baseColor}`,
    borderRadius: '0.5rem',
    position: 'relative' as const,
    transition: 'box-shadow 0.3s ease',
    ...(isInherited && { boxShadow: `inset 0 0 0 1px ${baseColor}10` })
  };
}

const handleMessagesWheel = (e: WheelEvent) => {
  console.log('Messages container wheel event', e);
};

watch(() => displayMessages.value, () => {
  nextTick(() => {
    updateScrollButtonsVisibility();
    if (isSnapped.value && (isAtBottom.value || props.node.streamingContent)) {
      scrollToBottom();
    }
  });
}, { deep: true });

watch(() => props.node.title, (newTitle) => {
  titleInput.value = newTitle || '';
}, { immediate: true });

watch(() => props.isSidePanelOpen, () => {
  if (isSnapped.value) {
    calculateAndUpdateSnappedPosition();
  }
}, { immediate: true });

watch(() => props.node.streamingContent, (newVal) => {
  if (newVal) {
    if (fadeTimeout.value) {
      clearTimeout(fadeTimeout.value);
    }
    isStreaming.value = true;
  } else if (isStreaming.value) {
    fadeTimeout.value = setTimeout(() => {
      isStreaming.value = false;
    }, 1000);
  }
});

onMounted(() => {
  if (!props.node.title) {
    isEditing.value = true;
  }
  window.addEventListener("keydown", onKeyDown);
  if (props.node.messages && props.node.messages.length > 0) {
    let lastMessage = props.node.messages[props.node.messages.length - 1];
    if (lastMessage.modelId) {
      lastModel.value = getModelInfo(lastMessage.modelId);
    }
  }
  if (messagesContainerRef.value) {
    messagesContainerRef.value.addEventListener('scroll', () => {
      requestAnimationFrame(updateScrollButtonsVisibility);
    });
    calculateAndUpdateSnappedPosition();
  }
});

onBeforeUnmount(() => {
  document.body.classList.remove('has-snapped-node');
  window.removeEventListener("keydown", onKeyDown);
  if (messagesContainerRef.value) {
    messagesContainerRef.value.removeEventListener('scroll', updateScrollButtonsVisibility);
  }
  isSnapped.value = false;
  isTransitioningSnap.value = false;
  isDraggable.value = false;
  isDragging.value = false;
  if (fadeTimeout.value) {
    clearTimeout(fadeTimeout.value);
  }
});
</script>

<style scoped>
/* Global theme variables */
:global(:root) {
  --glow-color: rgba(59, 130, 246, 0.8);
}

:global([data-theme="dark"]) {
  --glow-color: rgba(255, 0, 0, 0.8);
}

:global([data-theme="light"]) {
  --glow-color: rgba(87, 13, 248, 0.8);
  /* #570DF8 */
}

:global([data-theme="cupcake"]) {
  --glow-color: rgba(101, 195, 200, 0.8);
  /* #65C3C8 */
}

:global([data-theme="bumblebee"]) {
  --glow-color: rgba(249, 215, 47, 0.8);
  /* #F9D72F */
}

:global([data-theme="emerald"]) {
  --glow-color: rgba(102, 204, 138, 0.8);
  /* #66CC8A */
}

:global([data-theme="corporate"]) {
  --glow-color: rgba(75, 107, 251, 0.8);
  /* #4B6BFB */
}

:global([data-theme="garden"]) {
  --glow-color: rgba(92, 127, 103, 0.8);
  /* #5c7f67 */
}

:global([data-theme="lofi"]) {
  --glow-color: rgba(13, 13, 13, 0.8);
  /* #0D0D0D */
}

:global([data-theme="pastel"]) {
  --glow-color: rgba(209, 193, 215, 0.8);
  /* #d1c1d7 */
}

:global([data-theme="fantasy"]) {
  --glow-color: rgba(109, 10, 10, 0.8);
  /* #6D0A0A */
}

:global([data-theme="wireframe"]) {
  --glow-color: rgba(184, 184, 184, 0.8);
  /* #B8B8B8 */
}

:global([data-theme="lemonade"]) {
  --glow-color: rgba(81, 153, 3, 0.8);
  /* #519903 */
}

/* Dark themes */
:global([data-theme="dark"]) {
  --glow-color: rgba(121, 62, 249, 0.8);
  /* #793EF9 */
}

:global([data-theme="synthwave"]) {
  --glow-color: rgba(231, 121, 193, 0.8);
  /* #E779C1 */
}

:global([data-theme="retro"]) {
  --glow-color: rgba(239, 153, 149, 0.8);
  /* #EF9995 */
}

:global([data-theme="cyberpunk"]) {
  --glow-color: rgba(255, 117, 152, 0.8);
  /* #FF7598 */
}

:global([data-theme="valentine"]) {
  --glow-color: rgba(233, 109, 123, 0.8);
  /* #E96D7B */
}

:global([data-theme="halloween"]) {
  --glow-color: rgba(242, 140, 24, 0.8);
  /* #F28C18 */
}

:global([data-theme="forest"]) {
  --glow-color: rgba(30, 184, 84, 0.8);
  /* #1EB854 */
}

:global([data-theme="aqua"]) {
  --glow-color: rgba(9, 236, 243, 0.8);
  /* #09ECF3 */
}

:global([data-theme="black"]) {
  --glow-color: rgba(51, 51, 51, 0.8);
  /* #333333 */
}

:global([data-theme="luxury"]) {
  --glow-color: rgba(218, 165, 32, 0.8);
  /* #DAA520 */
}

:global([data-theme="dracula"]) {
  --glow-color: rgba(255, 121, 198, 0.8);
  /* #FF79C6 */
}

:global([data-theme="cmyk"]) {
  --glow-color: rgba(0, 188, 212, 0.8);
  /* #00BCD4 */
}

:global([data-theme="autumn"]) {
  --glow-color: rgba(139, 69, 19, 0.8);
  /* #8B4513 */
}

:global([data-theme="business"]) {
  --glow-color: rgba(28, 78, 128, 0.8);
  /* #1C4E80 */
}

:global([data-theme="acid"]) {
  --glow-color: rgba(255, 0, 255, 0.8);
  /* #FF00FF */
}

:global([data-theme="night"]) {
  --glow-color: rgba(56, 189, 248, 0.8);
  /* #38BDF8 */
}

:global([data-theme="coffee"]) {
  --glow-color: rgba(111, 78, 55, 0.8);
  /* #6F4E37 */
}

:global([data-theme="winter"]) {
  --glow-color: rgba(14, 165, 233, 0.8);
  /* #0EA5E9 */
}


/* Base container for the node */
.branch-node {
  position: absolute;
  transition: all 0.3s ease-out;
  user-select: none;
  overflow: visible;
}

.draggable:active {
  cursor: grabbing;
}

/* Node card base styles */
.node-card {
  backdrop-filter: blur(12px);
  background-color: rgb(0 0 0 / 0.2) !important;
  margin: 4px;
  transition: all 0.3s ease;
  position: relative;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  overflow: visible !important;
}

.node-card:hover {
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
}

/* Selected node styling */
.selected .node-card {
  ring: 2px;
  ring-color: rgb(59 130 246);
}

/* Streaming effect overlays */
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
  padding: 2px;
  filter: blur(3px);
}

.streaming .node-card::after {
  inset: -1px;
  padding: 1px;
  filter: blur(1px);
}

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

/* Ensure inner content appears above overlays */
.streaming .node-card>* {
  position: relative;
  z-index: 1;
}

/* Badge animation */
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

/* Message container styling */
.message-container {
  position: relative;
  transition: all 0.2s ease-in-out;
  margin: 0 auto;
  padding: 0 4rem;
  width: 100%;
  overflow: visible;
  /* Let the outer container scroll instead */
}

.message-container::before {
  content: '';
  position: absolute;
  overflow: auto;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgb(255 255 255 / 0.03);
  border-radius: 0.5rem;
  z-index: -1;
}

.message-container:hover {
  transform: translateX(0);
}

.branch-button {
  transform: translateX(20px);
  opacity: 0;
  transition: all 0.2s ease-in-out;
}

.message-container .absolute {
  padding: 0.5rem;
  margin: -0.5rem;
}

.message-container .absolute.inset-y-0.-left-12 {
  left: 0;
}

.message-container .absolute.inset-y-0.-right-12 {
  right: 0;
}

.message-container:hover .branch-button {
  transform: translateX(0);
  opacity: 1;
}

/* Glow effect using the theme variable */
.branch-node.glow-highlight .node-card {
  box-shadow: 0 0 15px 5px var(--glow-color), 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* Other common elements */
.avatar-overlay {
  border-radius: 9999px;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.branch-node.snapped {
  position: fixed !important;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1000;
  padding: 4rem 2rem 2rem;
  /* Keep padding for aesthetics */
  pointer-events: auto;
  /*  REMOVE overflow-y: auto; from here  */
  transform: scale(1) !important;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  transition: width 0.5s ease-out, transform 0.3s ease-out;
  /* Keep transitions */
  will-change: transform;
}

/* Adjust width based on side panel */
.branch-node.snapped[data-side-panel-open="true"] {
  width: 60vw;
}

.branch-node.snapped[data-side-panel-open="false"] {
  width: 100vw;
}

/* Snapped card styling */
.snapped-card {
  /* margin-top: 10px; */
  background: linear-gradient(to bottom, var(--border-color-light) / 0.9, var(--border-color) / 0.95) !important;
  backdrop-filter: blur(106px) !important;
  width: 100%;
  display: flex !important;
  flex-direction: column !important;
  height: calc(100vh - 8rem) !important;
  /* Account for padding */
  max-height: calc(100vh - 8rem) !important;
  /* Full width within its container */
  max-width: 90%;
  /* Limit maximum width */
  /* REMOVE: height: calc(94vh - 6rem) !important;  Do NOT set a fixed height*/
  overflow-y: hidden !important;
  /* Scrollbar for the ENTIRE card content */
  display: flex;
  /*  Stack children vertically */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  /* Keep shadow */
}



/* Ensure the content area fills available space */
.snapped-content {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  /* Critical for nested flex scrolling */
  overflow: hidden !important;
}


/* Snapped messages container - ensure it's scrollable */


.snapped-messages-container {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* Critical for nested flex scrolling */
  position: relative;
  /* For absolute positioning of scroll buttons */
}



.messages-scroll-container {
  flex: 1 1 auto;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch;
  /* Smooth scrolling on iOS */
  scroll-behavior: smooth;
  padding-right: 8px;
  /* Give space for scrollbar */
}

/* Ensure the node-card inside a snapped node doesn't transform */
.branch-node.snapped .node-card {
  transform: none !important;
  scale: 1 !important;
}

.snapped-messages-container>div {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
}

/* Scroll buttons transitions */
.snapped-messages-container button {
  transition: opacity 0.2s ease-in-out;
}

/* Scrollbar styling */
.snapped-messages-container>div::-webkit-scrollbar {
  width: 6px;
}

.snapped-messages-container>div::-webkit-scrollbar-track {
  background: transparent;
}

.snapped-messages-container>div::-webkit-scrollbar-thumb {
  background-color: rgba(155, 155, 155, 0.5);
  border-radius: 3px;
}

.transition-snap {
  transition: transform 0.3s ease-out !important;
}

.relative.group {
  display: flex;
  place-items: center;
}

.avatar-img {
  object-fit: contain;
  object-position: center;
}

.rounded-full {
  box-sizing: border-box;
}

/* Style for the MessageInput container (last child) */
.snapped-card> :last-child {
  margin-top: auto;
  /* Push to the bottom */
  padding: 1rem;
  border-top: 1px solid var(--border-color-light);
  /* Keep border */
  background: var(--background);
  /* Keep background */
}
</style>