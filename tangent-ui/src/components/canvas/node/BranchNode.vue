<template>
  <div class="pointer-events-auto absolute transition-all duration-300 branch-node" ref="nodeElement"
    :data-node-id="node.id" :data-side-panel-open="isSidePanelOpen" :class="[
      'theme-' + currentTheme,
      {
        'selected': isSelected,
        'glow-highlight': shouldGlow,
        'streaming': node.streamingContent,
        'active': isStreaming,
        'fading-out': !node.streamingContent && isStreaming,
        'draggable': isDraggable,
        'snapped': isSnapped,
        'transition-snap': isTransitioningSnap
      }
    ]" @click="handleNodeClick" @mousedown="handleMouseDown" @mousemove="handleMouseMove" @mouseup="handleMouseUp"
    :style="[nodePositionStyle, nodeThemeStyle]">
    <Card :class="[
      'node-card',
      'backdrop-blur transition-all duration-300',
      isSnapped ? 'snapped-card' : 'max-w-2xl w-[42rem]'
    ]" :style="computedCardStyle">
      <div class="relative group w-full h-9 flex items-center justify-center" ref="avatarRef">
        <div class="flex -space-x-3">
          <div v-for="model in uniqueModels" :key="model.id" @click.stop="openModelParams" class="relative first:ml-0">
            <img :src="getAvatarUrl(model)" :alt="model.name"
              class="w-9 h-9 rounded-full border-2 border-base-100 shadow-md object-cover cursor-pointer hover:z-10 transition-transform hover:scale-110" />
          </div>
        </div>
      </div>

      <!-- Use teleport to position the editor at body level -->
      <Teleport to="body">
        <ModelParamsEditor v-if="showParamsEditor" :model="lastModel" :model-avatar="getAvatarUrl(lastModel)"
          :current-parameters="canvasStore.getModelParams(node.id)" :trigger-rect="avatarRect" @save="updateModelParams"
          @close="() => { showParamsEditor = false }" />
      </Teleport>
      <div :class="['p-4 mt-4', isSnapped ? 'snapped-content' : '']"
        :style="isSnapped ? { height: '100%', display: 'flex', flexDirection: 'column' } : {}">
        <!-- Header Row -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <button @click.stop="toggleExpanded" class="p-2 rounded-full hover:bg-white/10 transition-colors"
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
            <TokenCounter :text="getAllMessagesText" class="mr-2" size="small" />
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
            class="space-y-4 h-full overflow-y-auto px-2 messages-scroll-container" ref="messagesContainerRef"
            tabindex="0" @wheel.capture.stop="handleMessagesWheel">
            <div v-for="(msg, i) in displayMessages" :key="i" class="relative group message-container"
              :class="{ 'user-message': msg.role === 'user', 'ai-message': msg.role === 'assistant' }"
              :data-message-index="i" :data-message-id="`${node.id}-message-${i}`" :data-code-bubble-parent="true"
              :style="getMessageStyles(i)">
              <MessageTimestamp :timestamp="msg.timestamp" :side="msg.role === 'user' ? 'right' : 'left'" />

              <!-- Message Content Container -->
              <div class="relative z-10">
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
                <div class="text-sm break-words overflow-hidden message-text" :style="{ color: textContentColor }"
                  :class="{
                    'line-clamp-2': expandedMessages.has(i),
                    'whitespace-pre-wrap': !msg.isStreaming,
                    'whitespace-normal': msg.isStreaming
                  }">
                  <MessageContent :content="msg.content" :is-streaming="msg.isStreaming" :node-id="node.id"
                    :data-message-idx="i" />
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
                     group-hover:opacity-100 transition-opacity message-action-btn" :style="{ color: threadColor }">
                        <RotateCw class="w-4 h-4" />
                      </button>

                      <button @click.stop="copyToMarkdown(msg)" class="flex items-center gap-2 text-sm hover:underline opacity-0 
                     group-hover:opacity-100 transition-opacity message-action-btn" :style="{ color: threadColor }">
                        <ClipboardCopy class="w-4 h-4" />
                      </button>
                    </template>
                  </div>

                  <!-- Model Badge -->
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

              <!-- Branch Buttons (Now positioned appropriately based on message type) -->
              <div v-if="msg.role === 'user'" class="absolute inset-y-0 -left-12 flex items-center opacity-0 group-hover:opacity-100 
                transition-all duration-200 ease-in-out z-20">
                <button @click.stop="createBranch(i, 'left')"
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
              <div v-if="msg.role === 'assistant'" class="absolute inset-y-0 -right-12 flex items-center opacity-0 group-hover:opacity-100 
                transition-all duration-200 ease-in-out z-20">
                <button @click.stop="createBranch(i, 'right')"
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

          <!-- Scroll Buttons -->
          <div v-if="isSnapped && showScrollButtons" class="absolute right-4 bottom-20 flex flex-col gap-2 z-50">
            <button @click="scrollToTop"
              class="p-2 rounded-full bg-base-300/80 hover:bg-base-300 transition-colors scroll-btn"
              :class="{ 'opacity-0 pointer-events-none': isAtTop }">
              <ChevronUp class="w-5 h-5" />
            </button>
            <button @click="scrollToBottom"
              class="p-2 rounded-full bg-base-300/80 hover:bg-base-300 transition-colors scroll-btn"
              :class="{ 'opacity-0 pointer-events-none': isAtBottom }">
              <ChevronDown class="w-5 h-5" />
            </button>
          </div>

          <!-- Collapsed View -->
          <div v-if="!isExpanded && node.messages?.length" class="mt-2 text-sm text-base-content/60 collapsed-preview">
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
import { ref, computed, onMounted, nextTick, onBeforeUnmount, watch } from 'vue';
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
import { useThemeStore } from '@/stores/themeStore';
import { Card } from '@/components/ui/card';
import Badge from '../../ui/Badge.vue';
import MessageContent from '../../messages/MessageContent.vue';
import MessageTimestamp from '../../messages/MessageTimestamp.vue';
import ModelParamsEditor from '../../models/ModelParamsEditor.vue';
import TokenCounter from '@/components/ui/TokenCounter.vue';
import type { ModelParameters } from '@/types/model';
import type { ModelInfo } from '@/types/model';
import { useModelStore } from '@/stores/modelStore';
import anthropic from '@/assets/anthropic.jpeg';
import emitter, { Events } from '@/utils/eventBus'
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

interface BranchNodeProps {  // Use a dedicated interface
  node: Node;
  isSelected: boolean;
  selectedModel: string;
  openRouterApiKey: string;
  modelType: string;
  zoom: number;
  modelRegistry: Map<string, ModelInfo>;
  isSidePanelOpen: boolean;
}

const props = defineProps<BranchNodeProps>();

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
  'focus-input',
  'expansion-change'
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
const wasRecentlyDragging = ref(false);
const isSnapped = ref(false);
const isTransitioningSnap = ref(false);
const originalPosition = ref<{ x: number; y: number; left?: number; top?: number }>({ x: 0, y: 0 });

const canvasStore = useCanvasStore();
const modelStore = useModelStore();

const themeStore = useThemeStore();
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');

let themeObserver;

// Get theme colors
const themeColors = computed(() => {
  return themeStore.getThemeColors(currentTheme.value);
});

// Calculate theme-based colors
const baseColorSet = computed(() => {
  const colorIndex = Math.abs(Number(props.node.id)) % 3;

  // Get base color from theme
  let baseColor;
  switch (colorIndex) {
    case 0:
      baseColor = themeColors.value.primary;
      break;
    case 1:
      baseColor = themeColors.value.secondary;
      break;
    case 2:
      baseColor = themeColors.value.accent;
      break;
    default:
      baseColor = themeColors.value.primary;
  }

  // Create color variants
  return {
    base: baseColor,
    light: adjustColorLightness(baseColor, 30), // Lighter variant
    dark: adjustColorLightness(baseColor, -20), // Darker variant
    transparent: adjustColorOpacity(baseColor, 0.15),
    contrastText: getContrastTextColor(baseColor)
  };
});

const showParamsEditor = ref(false);
const avatarRef = ref<HTMLElement | null>(null);
// --- Computed avatarRect for ModelParamsEditor ---
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

// Theme-aware card styling
const computedCardStyle = computed(() => {
  const isDark = themeStore.isDarkTheme(currentTheme.value);

  if (isSnapped.value) {
    return {
      background: `linear-gradient(to bottom, var(--node-color-transparent), ${adjustColorOpacity(baseColorSet.value.base, 0.25)})`,
      boxShadow: `0 8px 32px ${adjustColorOpacity(baseColorSet.value.dark, 0.4)}`,
      borderColor: `var(--node-border-color)`,
    };
  }

  return {
    background: isDark
      ? `linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.8))`
      : `linear-gradient(to bottom, rgba(255,255,255,0.8), rgba(255,255,255,0.95))`,
    borderColor: `var(--node-border-color)`,
  };
});

// Color conversion functions
function hexToRgb(hex) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const formattedHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(formattedHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Convert RGB to HSL
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return [h * 360, s * 100, l * 100];
}

// Convert HSL to RGB
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// RGB to hex
function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Adjust color lightness
function adjustColorLightness(hexColor, amount) {
  // Convert to RGB
  const rgb = hexToRgb(hexColor);
  // Convert to HSL
  const [h, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b);
  // Adjust lightness
  const newL = Math.max(0, Math.min(100, l + amount));
  // Convert back to RGB
  const [r, g, b] = hslToRgb(h, s, newL);
  // Convert back to hex
  return rgbToHex(r, g, b);
}

// Adjust color opacity
function adjustColorOpacity(hexColor, opacity) {
  const rgb = hexToRgb(hexColor);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

// Get contrast text color (white or black)
function getContrastTextColor(hexColor) {
  const rgb = hexToRgb(hexColor);
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness < 128 ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.85)';
}

// Generate theme-specific styles for the node
const nodeThemeStyle = computed(() => {
  const isDark = themeStore.isDarkTheme(currentTheme.value);

  // Force light text for specific dark themes regardless of contrast calculation
  const forceLightTextThemes = [
    'cyberpunk', 'dracula', 'cmyk', 'acid', 'night',
    'synthwave', 'retro', 'black', 'luxury'
  ];

  const forceLightText = forceLightTextThemes.includes(currentTheme.value);

  // Override the contrast text color for problematic themes
  const textColor = forceLightText
    ? 'rgba(255, 255, 255, 0.95)'
    : baseColorSet.value.contrastText;

  return {
    '--node-color': baseColorSet.value.base,
    '--node-color-light': baseColorSet.value.light,
    '--node-color-dark': baseColorSet.value.dark,
    '--node-color-transparent': baseColorSet.value.transparent,
    '--node-text-color': textColor,
    '--node-glow-color': `${adjustColorOpacity(baseColorSet.value.base, 0.4)}`,
    '--node-border-color': `${adjustColorOpacity(baseColorSet.value.light, 0.6)}`,
    '--node-shadow-color': `${adjustColorOpacity(baseColorSet.value.dark, 0.5)}`,
    '--base-bg-color': isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
    '--message-bg-color': isDark ? 'rgba(30, 30, 30, 0.6)' : 'rgba(245, 245, 245, 0.6)'
  };
});

// Thread color based on theme
const threadColor = computed(() => baseColorSet.value.base);

const shouldGlow = computed(() => {
  // Only glow if the node is selected and zoom is below 100% (i.e., less than 1)
  return props.isSelected && props.zoom < 1.5;
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
  // Add vertical offset to position node lower on the screen
  const targetLeft = sidePanelWidth + (availableWidth - cardRect.width * scale) / 2;
  const targetTop = (vh - cardRect.height * scale) / 2 + (vh * 0.08); // Add 8% of viewport height as offset

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
        // Position node lower on the screen by adding a vertical offset
        const top = (availableHeight - cardHeight * scale) / 2 + (availableHeight * 0.08); // Add 8% of viewport height
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

const getAllMessagesText = computed(() => {
  if (!props.node.messages) return '';
  return props.node.messages
    .map(msg => msg.content)
    .join('\n\n');
});

const handleInputClick = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (!isSnapped.value) {
    emit('focus-input', { nodeId: props.node.id });
  }
};

const handleNodeClick = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('input') || wasRecentlyDragging.value) {
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

const updateThemeFromDOM = () => {
  const newTheme = document.documentElement.getAttribute('data-theme') || 'light';
  if (newTheme !== currentTheme.value) {
    currentTheme.value = newTheme;
    console.log('Theme changed to', currentTheme.value);
  }
};

const toggleSnap = async () => {
  try {
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
      if (snappedPosition && nodeElement.value) {
        nodeElement.value.style.transform = `translate3d(${snappedPosition.currentLeft}px, ${snappedPosition.currentTop}px, 0) scale(${snappedPosition.currentScale})`;
      }

      await nextTick();

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
  } catch (error) {
    console.error("Error in toggleSnap:", error);
    // Reset states to prevent UI freeze
    isTransitioningSnap.value = false;
    document.body.classList.remove('has-snapped-node');

    // Try to restore to a safe state
    if (isSnapped.value) {
      isSnapped.value = false;
      canvasStore.unsnapNode(props.node.id);
    }
  }
};

const nodeElement = ref<HTMLElement | null>(null);

function getAvatarUrl(model?: ModelInfo): string {
  if (!model) return providerAvatars['Unknown'];
  if (model.source === 'ollama') return providerAvatars['ollama'];
  if (model.source === 'anthropic') return providerAvatars['Anthropic'];
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
  const isEditableDiv = document.activeElement?.getAttribute('contenteditable') === 'true';

  // Don't trigger shortcuts when typing in any editable element
  if (activeTag === "input" || activeTag === "textarea" || isEditableDiv) return;

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

  if (wasDragging) {
    // Set a flag that the node was recently dragging
    wasRecentlyDragging.value = true;
    setTimeout(() => {
      wasRecentlyDragging.value = false;
    }, 100); // Reset after a short delay
  } else {
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
    title: '',
    messages: props.node.messages.slice(0, messageIndex + 1).map(msg => ({
      ...msg, //keep other props of messages
      // fall back to empty array when contentParts is missing
      contentParts: (msg.contentParts ?? []).map((part, index) => ({
        ...part,
        codeIndex: index // Assign indices to contentParts
      }))
    })),
    branchMessageIndex: messageIndex,
    type: direction === 'left' ? 'left-branch' : 'right-branch'
  };
  emit('create-branch', props.node.id, messageIndex, position, initialData);
};

const handleMessageSend = async (messageData) => {
  isLoading.value = true;
  try {
    // Check if we got a structured message with paste entries
    let messageText;
    let pasteEntries = undefined;

    if (typeof messageData === 'object' && messageData.pasteEntries) {
      messageText = messageData.text;
      pasteEntries = messageData.pasteEntries;
    } else {
      messageText = messageData;
    }

    const modelInfo = {
      id: props.selectedModel,
      name: props.selectedModel,
      source: props.modelType
    };

    await canvasStore.sendMessage(
      props.node.id,
      messageText,
      modelInfo,
      props.openRouterApiKey,
      true, // add user message
      pasteEntries // Pass paste entries
    );

    // Generate title logic stays the same
    if (props.node.messages.length === 2 && !props.node.title) {
      const modelInfo = getModelInfo(props.selectedModel);
      canvasStore.generateBranchTitle(
        props.node.id,
        modelInfo!,
        props.openRouterApiKey
      );
    }
  } catch (error) {
    console.error('Error sending message:', error);
  } finally {
    isLoading.value = false;
  }
};

const scrollToCodeBubble = (data: {
  nodeId: string;
  codeIndex: number;
}) => {
  // Only handle if this is the target node
  if (data.nodeId !== props.node.id) return;

  // Find the message containing the code bubble
  if (messagesContainerRef.value) {
    const messages = messagesContainerRef.value.querySelectorAll('.message-container');

    // Loop through messages to find one with the code bubble
    for (const message of messages) {
      const codeBubbles = message.querySelectorAll('.code-bubble');

      for (let i = 0; i < codeBubbles.length; i++) {
        const bubble = codeBubbles[i];
        const bubbleIndex = bubble.getAttribute('data-code-index');

        if (bubbleIndex !== null && parseInt(bubbleIndex) === data.codeIndex) {
          // Found it! Scroll to this message
          message.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Highlight the code bubble temporarily
          bubble.classList.add('highlight-bubble');
          setTimeout(() => {
            bubble.classList.remove('highlight-bubble');
          }, 2000);

          return;
        }
      }
    }
  }
};

// For scrolling to a specific message
const scrollToMessage = (messageIndex: number) => {
  if (!messagesContainerRef.value) return;

  nextTick(() => {
    const messages = messagesContainerRef.value.querySelectorAll('.message-container');
    if (messageIndex >= 0 && messageIndex < messages.length) {
      const message = messages[messageIndex];
      message.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add a highlight effect
      message.classList.add('message-highlight');
      setTimeout(() => {
        message.classList.remove('message-highlight');
      }, 1500);
    }
  });
};

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
    abortController = null;
  }

  // Clear all streaming states
  canvasStore.setStreamingContent(props.node.id, null);
  isStreaming.value = false;
  isLoading.value = false;

  // Clear any fadeout timeouts
  if (fadeTimeout.value) {
    clearTimeout(fadeTimeout.value);
    fadeTimeout.value = null;
  }

  // Force UI refresh
  nextTick(() => {
    if (messagesContainerRef.value && isAtBottom.value) {
      scrollToBottom();
    }
  });
}

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
  emit('expansion-change', { nodeId: props.node.id, isExpanded: isExpanded.value });
};

const expandMessage = (index: number) => {
  const newSet = new Set(expandedMessages.value);
  if (newSet.has(index)) {
    newSet.delete(index);
  } else {
    newSet.add(index);
  }
  expandedMessages.value = newSet;
};


const textContentColor = computed(() => {
  // List of dark themes that need light text
  const darkThemes = [
    'dark', 'synthwave', 'retro', 'cyberpunk', 'halloween',
    'forest', 'aqua', 'black', 'luxury', 'dracula', 'cmyk',
    'autumn', 'business', 'acid', 'night', 'coffee'
  ];

  // Get current theme from document or store
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';

  // Return light text color for dark themes
  return darkThemes.includes(currentTheme) ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)';
});

function getMessageStyles(index: number) {
  const isInherited =
    props.node.type === 'branch' &&
    props.node.branchMessageIndex !== null &&
    index <= props.node.branchMessageIndex;

  return {
    background: isInherited
      ? `linear-gradient(to right, var(--node-color-transparent), ${adjustColorOpacity(baseColorSet.value.base, 0.08)})`
      : `linear-gradient(to right, ${adjustColorOpacity(baseColorSet.value.base, 0.08)}, ${adjustColorOpacity(baseColorSet.value.base, 0.15)})`,
    borderLeft: `4px ${isInherited ? 'dashed' : 'solid'} var(--node-color)`,
    borderRadius: '0.5rem',
    position: 'relative' as const,
    transition: 'box-shadow 0.3s ease',
    ...(isInherited && { boxShadow: `inset 0 0 0 1px ${adjustColorOpacity(baseColorSet.value.base, 0.1)}` })
  };
}

const handleMessagesWheel = (e: WheelEvent) => {
  // This captures wheel events in the messages container
  // console.log('Messages container wheel event', e);
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

  emitter.on('streaming-complete', (data) => {
    if (data.nodeId === props.node.id) {
      // Clear streaming state
      isStreaming.value = false;
      isLoading.value = false; // Make sure loading state is reset too

      // Clear any fadeout timeouts if they exist
      if (fadeTimeout.value) {
        clearTimeout(fadeTimeout.value);
        fadeTimeout.value = null;
      }

      // Force UI update
      nextTick(() => {
        canvasStore.setStreamingContent(props.node.id, null);
      });
    }
  });

  // Setup direct observation of theme attribute changes
  themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'data-theme') {
        updateThemeFromDOM();
      }
    });
  });

  // Start observing theme changes on document element
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  // Initial theme check
  updateThemeFromDOM();

  emitter.on('scroll-to-code-bubble', scrollToCodeBubble);

  emitter.on('debug-sandbox', async ({ code, errors, nodeId }) => {
    if (nodeId === props.node.id) {
      await handleMessageSend(errors);
    }
  });

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
  if (themeObserver) {
    themeObserver.disconnect();
  }
  document.body.classList.remove('has-snapped-node');
  emitter.off('debug-sandbox');
  emitter.off('streaming-complete');
  emitter.off('scroll-to-code-bubble', scrollToCodeBubble);
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
/* Branch node base variables */
.branch-node {
  --node-color: var(--p);
  /* Default to primary color if custom variables aren't set */
  --node-color-light: var(--pf, var(--p));
  /* Fallback to primary if primary-focus not available */
  --node-color-dark: var(--pc, var(--p));
  /* Fallback to primary if primary-content not available */
  --node-color-transparent: rgba(var(--p), 0.1);
  /* Semi-transparent primary */
  --node-text-color: var(--pc, #000);
  /* Default text color */
  --node-glow-color: rgba(var(--p), 0.4);
  /* Glow effect */
  --node-border-color: rgba(var(--p), 0.6);
  /* Border color */
  --node-shadow-color: rgba(var(--p), 0.5);
  /* Shadow color */
  --base-bg-color: rgba(255, 255, 255, 0.7);
  /* Default base background */
  --message-bg-color: rgba(245, 245, 245, 0.6);
  /* Default message background */
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

/* Enhanced node card styling */
.node-card {
  backdrop-filter: blur(12px);
  background-color: var(--base-bg-color) !important;
  border: 1px solid var(--node-border-color);
  margin: 4px;
  transition: all 0.3s ease;
  position: relative;
  box-shadow: 0 4px 12px var(--node-shadow-color);
  overflow: visible !important;
  border-radius: 0.75rem;
}

.node-card:hover {
  box-shadow: 0 8px 20px var(--node-shadow-color);
  transform: translateY(-2px);
}

/* Selected node styling */
.selected .node-card {
  border-color: var(--node-color);
  box-shadow: 0 0 0 2px var(--node-color-transparent), 0 8px 20px var(--node-shadow-color);
}

/* Enhanced glow effect */
.branch-node.glow-highlight .node-card {
  box-shadow: 0 0 15px 5px var(--node-glow-color), 0 4px 12px var(--node-shadow-color);
}

/* Streaming effect overlays */
.streaming .node-card::before,
.streaming .node-card::after {
  content: '';
  position: absolute;
  border-radius: inherit;
  background: linear-gradient(90deg,
      var(--er, #ff1493) 0%,
      /* Error color */
      var(--a, #ff6347) 15%,
      /* Accent color */
      var(--wa, #ffd700) 30%,
      /* Warning color */
      var(--su, #32cd32) 45%,
      /* Success color */
      var(--in, #4169e1) 60%,
      /* Info color */
      var(--p, #9400d3) 75%,
      /* Primary color */
      var(--er, #ff1493) 90%,
      /* Back to error */
      var(--a, #ff6347) 100%
      /* Back to accent */
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

/* Message alignment styles */
.user-message {
  margin-left: auto !important;
  margin-right: 0 !important;
  /* Remove right margin to attach to the edge */
  max-width: 85% !important;
  justify-content: flex-end !important;
  padding-left: 2rem !important;
  padding-right: 1rem !important;
  align-self: flex-end !important;
  /* Ensure alignment to the right */
  float: right !important;
  /* Force right alignment */
  clear: both !important;
  /* Ensure proper stacking */
  text-align: right !important;
  /* Align text to the right */
}

.ai-message {
  margin-right: auto !important;
  margin-left: 0 !important;
  /* Remove left margin to attach to the edge */
  max-width: 85% !important;
  justify-content: flex-start !important;
  padding-left: 1rem !important;
  padding-right: 2rem !important;
  align-self: flex-start !important;
  /* Ensure alignment to the left */
  float: left !important;
  /* Force left alignment */
  clear: both !important;
  /* Ensure proper stacking */
  text-align: left !important;
  /* Align text to the left */
}

/* Style for user message bubbles */
.user-message::before {
  content: '';
  position: absolute;
  overflow: auto;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--message-bg-color);
  border-radius: 1.25rem 0 0 1.25rem !important;
  /* Flat on the right side */
  z-index: -1;
  opacity: 0.7;
}

/* Style for AI message bubbles */
.ai-message::before {
  content: '';
  position: absolute;
  overflow: auto;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--node-color-transparent);
  border-radius: 0 1.25rem 1.25rem 0 !important;
  /* Flat on the left side */
  z-index: -1;
  opacity: 0.9;
}

/* Custom borders for message types */
.user-message {
  border-left: none !important;
  border-right: 4px solid var(--node-color) !important;
}

.ai-message {
  border-left: 4px solid var(--node-color) !important;
  border-right: none !important;
}

/* Add more distinct coloring for user messages */
.user-message .message-text {
  font-weight: 500;
  text-align: right !important;
}

.user-message .badge {
  margin-left: auto !important;
}

/* Message container styling */
.message-container {
  position: relative;
  transition: all 0.2s ease-in-out;
  margin: 0 0 1rem 0 !important;
  padding: 1rem !important;
  overflow: visible;
  border-radius: 0.5rem;
  width: 60% !important;
  display: block !important;
  /* Change to block for proper floating */
  /* Contain floated children */
}

.message-text {
  color: var(--node-text-color);
}

.message-container::after {
  content: "";
  display: table;
  clear: both;
}

/* Branch button effects */
.branch-btn {
  transform: translateX(20px);
  opacity: 0;
  transition: all 0.2s ease-in-out;
  background-color: var(--base-bg-color);
  color: var(--node-color) !important;
}

.message-container:hover .branch-btn {
  transform: translateX(0);
  opacity: 1;
}

.branch-btn:hover {
  background-color: var(--node-color-transparent) !important;
  transform: scale(1.1);
}

/* Message action buttons */
.message-action-btn {
  color: var(--node-color) !important;
}

.message-action-btn:hover {
  text-decoration: underline;
}

/* Avatar styling */
.avatar-overlay {
  border-radius: 9999px;
}

/* Line clamp for truncated text */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Enhanced snapped view styling */
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
  pointer-events: auto;
  transform: scale(1) !important;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  transition: width 0.5s ease-out, transform 0.3s ease-out;
  will-change: transform;
  backdrop-filter: blur(100px);
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
  background: linear-gradient(to bottom, var(--node-color-transparent), rgba(var(--b1), 0.8)) !important;
  backdrop-filter: blur(16px) !important;
  border: 1px solid var(--node-border-color);
  width: 100%;
  display: flex !important;
  flex-direction: column !important;
  height: calc(100vh - 8rem) !important;
  max-height: calc(100vh - 8rem) !important;
  max-width: 90%;
  overflow-y: hidden !important;
  display: flex;
  box-shadow: 0 8px 32px var(--node-shadow-color);
  border-radius: 1.25rem;
}

/* Ensure the content area fills available space */
.snapped-content {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  overflow: hidden !important;
}

/* Snapped messages container - ensure it's scrollable */
.snapped-messages-container {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}

/* Improved message scrolling container */
.messages-scroll-container {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 auto !important;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch !important;
  scroll-behavior: smooth !important;
  padding: 1rem !important;
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
  scrollbar-color: var(--node-color-transparent) transparent;
}

/* Scroll buttons */
.scroll-btn {
  background-color: var(--base-bg-color) !important;
  color: var(--node-color);
  box-shadow: 0 2px 8px var(--node-shadow-color);
}

.scroll-btn:hover {
  background-color: var(--node-color-light) !important;
  color: var(--node-text-color);
}

/* Scrollbar styling */
.snapped-messages-container>div::-webkit-scrollbar {
  width: 6px;
}

.snapped-messages-container>div::-webkit-scrollbar-track {
  background: transparent;
}

.snapped-messages-container>div::-webkit-scrollbar-thumb {
  background-color: var(--node-color-transparent);
  border-radius: 3px;
}

.snapped-messages-container>div::-webkit-scrollbar-thumb:hover {
  background-color: var(--node-color);
}

.transition-snap {
  transition: transform 0.3s ease-out !important;
}

.relative.group {
  display: flex;
  place-items: normal;
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
  padding: 1rem;
  border-top: 1px solid var(--node-border-color);
  background: var(--base-bg-color);
}

/* Collapsed preview styling */
.collapsed-preview {
  color: var(--node-text-color);
  background-color: var(--node-color-transparent);
  padding: 0.75rem;
  border-radius: 0.5rem;
  border-left: 3px solid var(--node-color);
}

/* Message highlight animation for navigation */
@keyframes messageHighlight {
  0% {
    box-shadow: 0 0 0 2px var(--node-color-transparent);
  }

  50% {
    box-shadow: 0 0 0 4px var(--node-color);
  }

  100% {
    box-shadow: 0 0 0 2px var(--node-color-transparent);
  }
}

.message-highlight {
  animation: messageHighlight 1.5s ease-in-out;
}

/* Code bubble highlighting */
.highlight-bubble {
  box-shadow: 0 0 0 2px var(--node-color), 0 0 15px var(--node-color);
  transition: all 0.3s ease;
}

/* Theme-specific customizations */
.theme-cyberpunk .node-card {
  border-width: 2px;
  border-style: solid;
  box-shadow: 0 0 10px var(--node-glow-color), inset 0 0 5px var(--node-glow-color);
  background: radial-gradient(circle at top left, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.9)) !important;
}

.theme-synthwave .node-card {
  background: linear-gradient(to bottom right, rgba(20, 10, 30, 0.8), rgba(80, 30, 110, 0.7)) !important;
  border-width: 1px;
  box-shadow: 0 0 20px var(--node-glow-color);
}

.theme-synthwave .message-container::before {
  background: linear-gradient(to right, rgba(80, 30, 110, 0.3), rgba(220, 130, 255, 0.2));
}

.theme-retro .node-card {
  border-width: 3px;
  border-style: double;
  background: rgba(245, 240, 220, 0.9) !important;
}

.theme-valentine .node-card,
.theme-cupcake .node-card {
  border-radius: 1.25rem;
  background: linear-gradient(to bottom, rgba(255, 240, 245, 0.9), rgba(255, 220, 230, 0.8)) !important;
}

.theme-valentine .message-container::before,
.theme-cupcake .message-container::before {
  background-color: rgba(255, 240, 245, 0.5);
  border-radius: 0.75rem;
}

.theme-aqua .node-card {
  background: linear-gradient(135deg, rgba(0, 30, 60, 0.8), rgba(0, 180, 220, 0.3)) !important;
  backdrop-filter: blur(20px);
  border-radius: 1rem;
  box-shadow: 0 8px 32px rgba(0, 180, 220, 0.4);
}

.theme-aqua .message-container::before {
  background: linear-gradient(to right, rgba(0, 120, 180, 0.2), rgba(0, 210, 240, 0.1));
}

.message-content {
  justify-self: center;
}

.theme-forest .node-card,
.theme-garden .node-card {
  background: linear-gradient(to bottom, rgba(20, 40, 20, 0.7), rgba(40, 80, 40, 0.5)) !important;
}

.theme-night .node-card {
  background: linear-gradient(to bottom, rgba(10, 10, 30, 0.8), rgba(20, 30, 60, 0.6)) !important;
  box-shadow: 0 8px 30px rgba(0, 0, 30, 0.6);
}

.theme-night .message-container::before {
  background-color: rgba(30, 40, 80, 0.4);
}

.theme-coffee .node-card {
  background: linear-gradient(to bottom, rgba(50, 30, 20, 0.8), rgba(80, 50, 40, 0.6)) !important;
}

.theme-luxury .node-card {
  background: linear-gradient(to bottom, rgba(20, 20, 20, 0.9), rgba(40, 40, 40, 0.8)) !important;
  border: 1px solid rgba(218, 165, 32, 0.6);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(218, 165, 32, 0.3);
}

/* Dark theme text customizations */
.theme-cyberpunk,
.theme-cmyk,
.theme-acid,
.theme-dracula,
.theme-night,
.theme-synthwave,
.theme-retro,
.theme-black,
.theme-luxury {
  --node-text-color: rgba(255, 255, 255, 0.95) !important;
  color: rgba(255, 255, 255, 0.95);
}

/* Force all child elements to use the correct text color */
.theme-cyberpunk .node-card,
.theme-cmyk .node-card,
.theme-acid .node-card,
.theme-dracula .node-card,
.theme-night .node-card,
.theme-synthwave .node-card,
.theme-retro .node-card,
.theme-black .node-card,
.theme-luxury .node-card {
  color: var(--node-text-color);
}

/* Make sure Badge text is visible */
.theme-cyberpunk .badge,
.theme-cmyk .badge,
.theme-acid .badge,
.theme-dracula .badge,
.theme-night .badge,
.theme-synthwave .badge,
.theme-retro .badge,
.theme-black .badge,
.theme-luxury .badge {
  color: var(--node-text-color);
}

/* Force specific text elements to be light in dark themes */
.theme-cyberpunk .text-base-content,
.theme-cmyk .text-base-content,
.theme-acid .text-base-content,
.theme-dracula .text-base-content,
.theme-night .text-base-content,
.theme-synthwave .text-base-content,
.theme-retro .text-base-content,
.theme-black .text-base-content,
.theme-luxury .text-base-content {
  color: rgba(255, 255, 255, 0.95) !important;
}

/* Fix for node titles and message counts */
.theme-cyberpunk .text-lg,
.theme-cmyk .text-lg,
.theme-acid .text-lg,
.theme-dracula .text-lg,
.theme-night .text-lg,
.theme-synthwave .text-lg,
.theme-retro .text-lg,
.theme-black .text-lg,
.theme-luxury .text-lg,
.theme-cyberpunk .text-sm,
.theme-cmyk .text-sm,
.theme-acid .text-sm,
.theme-dracula .text-sm,
.theme-night .text-sm,
.theme-synthwave .text-sm,
.theme-retro .text-sm,
.theme-black .text-sm,
.theme-luxury .text-sm {
  color: rgba(255, 255, 255, 0.95) !important;
}

/* Make semi-transparent text still light but slightly dimmed */
.theme-cyberpunk .text-base-content\/60,
.theme-cmyk .text-base-content\/60,
.theme-acid .text-base-content\/60,
.theme-dracula .text-base-content\/60,
.theme-night .text-base-content\/60,
.theme-synthwave .text-base-content\/60,
.theme-retro .text-base-content\/60,
.theme-black .text-base-content\/60,
.theme-luxury .text-base-content\/60 {
  color: rgba(255, 255, 255, 0.7) !important;
}

/* Specifically target the collapsed preview text */
.theme-cyberpunk .collapsed-preview,
.theme-cmyk .collapsed-preview,
.theme-acid .collapsed-preview,
.theme-dracula .collapsed-preview,
.theme-night .collapsed-preview,
.theme-synthwave .collapsed-preview,
.theme-retro .collapsed-preview,
.theme-black .collapsed-preview,
.theme-luxury .collapsed-preview {
  color: rgba(255, 255, 255, 0.95) !important;
}

/* Enhanced message container styles for better mobile handling */
@media (max-width: 640px) {

  .user-message,
  .ai-message {
    max-width: 95% !important;
  }

  .branch-node.snapped {
    padding: 2rem 1rem 1rem;
  }

  .snapped-card {
    max-width: 98%;
  }
}

/* Improved hover states and transitions */
.message-container {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.message-container:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.user-message:hover {
  transform: translateX(0) !important;
  /* Don't move when hovering */
}

.ai-message:hover {
  transform: translateX(0) !important;
  /* Don't move when hovering */
}

.user-message {
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.05) !important;
}

.ai-message {
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.05) !important;
}

/* Add subtle animation for new messages */
@keyframes messageAppear {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-container:last-child {
  animation: messageAppear 0.3s ease-out;
}
</style>