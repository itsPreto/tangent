<template>
  <div class="pointer-events-auto absolute transition-all duration-300 branch-node" ref="nodeElement"
    :data-node-id="node.id" :data-side-panel-open="isSidePanelOpen" :data-right-panel-open="isRightPanelOpen" :class="[
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
    @dragover="supportsVision ? handleDragOver : undefined" @drop="supportsVision ? handleDrop : undefined"
    :style="[nodePositionStyle, nodeThemeStyle]">
    <div v-if="isSnapped" class="fixed inset-0 backdrop-blur-xl -z-10 pointer-events-none" :style="{
      backgroundColor: snappedBackgroundStyle
    }">
    </div>

    <Card :class="[
      'node-card',
      'backdrop-blur transition-all duration-300',
      isSnapped ? 'snapped-card' : 'max-w-2xl w-[42rem]'
    ]" :style="computedCardStyle">
      <div class="relative group w-full h-9 flex items-center justify-center" ref="avatarRef">
        <!-- Subtle glow effect when params editor is open -->
        <div v-if="showParamsEditor" class="absolute inset-0 bg-primary/10 blur-xl rounded-full pointer-events-none" />
        <div class="flex -space-x-3 relative z-10">
          <div v-for="model in uniqueModels" :key="model.id" @click.stop="() => openModelParams(model)" class="relative first:ml-0">
            <img :src="getAvatarUrl(model)" :alt="model.name"
              :class="[
                'w-9 h-9 rounded-full border-2 shadow-md object-cover cursor-pointer hover:z-10 transition-all duration-300',
                showParamsEditor && lastModel?.id === model.id ? 'border-primary scale-110 ring-2 ring-primary/50' : 'border-base-100 hover:scale-110'
              ]" />
          </div>
        </div>
      </div>

      <!-- Use teleport to position the editor at body level -->
      <Teleport to="body">
        <ModelParamsEditor v-if="showParamsEditor && currentModel" :model="currentModel" :model-avatar="getAvatarUrl(currentModel)"
          :current-parameters="canvasStore.getModelParams(node.id, currentModel.id)" :trigger-rect="avatarRect" @save="updateModelParams"
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
                  <!-- Show loading animation when generating title -->
                  <template v-if="node.isGeneratingTitle">
                    <TitleGenerationLoader />
                  </template>
                  <!-- Show normal title when not generating -->
                  <template v-else>
                    <span class="text-lg font-semibold truncate max-w-lg text-base-content">
                      {{ node.title || "Untitled Thread" }}
                    </span>
                    <div class="flex items-center gap-1 flex-shrink-0">
                      <!-- Regenerate title button -->
                      <button 
                        @click.stop="regenerateTitle" 
                        class="p-1 rounded-full hover:bg-white/10 transition-all duration-200"
                        :class="{ 'animate-pulse': isRegeneratingTitle }"
                        :disabled="isRegeneratingTitle"
                        title="Regenerate title with AI"
                      >
                        <Sparkles class="w-4 h-4 text-base-content/60 hover:text-primary" />
                      </button>
                      <!-- Manual edit button -->
                      <button @click.stop="startEditing" class="p-1 rounded-full hover:bg-white/10 transition-all duration-200">
                        <Edit2 class="w-4 h-4 text-base-content/60" />
                      </button>
                    </div>
                  </template>
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
            <!-- Enhanced Context Usage Indicator -->
            <div class="flex items-center gap-2">
              <TokenCounter 
                :text="getAllMessagesText" 
                :context-limit="actualContextLimit"
                :show-percentage="true"
                :show-progress-bar="true"
                :cache-key="`branch-${node.id}`"
                class="mr-1" 
                size="small"
                :class="contextStatusClass"
              />
              
              <!-- Context status indicator -->
              <div 
                v-if="contextUsagePercentage >= 60"
                class="flex items-center gap-1"
                :title="contextStatusMessage"
              >
                <div 
                  class="w-2 h-2 rounded-full"
                  :class="contextIndicatorClass"
                ></div>
              </div>
              
              <!-- Compacted conversation indicator -->
              <div 
                v-if="hasCompactedMessages"
                class="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs"
                title="This conversation includes compacted summaries"
              >
                <Archive class="w-3 h-3" />
                <span>{{ compactedMessageCount }}</span>
              </div>
            </div>
            
            <!-- Auto-compact button when approaching limits -->
            <button 
              v-if="shouldShowCompactButton"
              @click.stop="handleAutoCompact"
              :class="[
                'p-2 rounded-full transition-colors',
                contextUsagePercentage >= 85 
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-600 animate-pulse' 
                  : 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-600'
              ]"
              :title="contextUsagePercentage >= 85 ? 'Context limit approaching - compact now!' : 'Auto-compact old messages to save context'"
            >
              <Archive class="w-4 h-4" />
            </button>

            <!-- Auto TTS Toggle -->
            <button @click.stop="toggleAutoTTS" :class="[
              'p-2 rounded-full transition-colors',
              autoTTSEnabled
                ? 'bg-green-500/20 hover:bg-green-500/30 text-green-600'
                : 'hover:bg-white/10 text-base-content/60'
            ]" :title="autoTTSEnabled ? 'Disable auto TTS for responses' : 'Enable auto TTS for responses'">
              <Volume2 class="w-5 h-5" />
            </button>

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

        <!-- Media Content Section -->
        <div v-if="hasMediaContent" class="media-content-section">
          <!-- Media thumbnail header for images -->
          <div v-if="isImageMedia" class="media-thumbnail-header p-3 border-b border-base-300/50">
            <div class="flex items-center gap-3">
              <img 
                :src="mediaUrl" 
                class="w-16 h-16 object-cover rounded-lg shadow-sm flex-shrink-0"
                :alt="node.mediaContent.filename" />
              <div class="flex-grow min-w-0">
                <p class="font-medium text-sm text-base-content truncate">{{ node.mediaContent.filename }}</p>
                <p class="text-xs text-base-content/60 mt-1">{{ node.mediaContent.mime_type }}</p>
                <!-- Processing status in header -->
                <div v-if="node.isProcessingMedia || isMediaProcessing" class="flex items-center gap-2 mt-2">
                  <ImageAnalysisLoader />
                </div>
              </div>
            </div>
          </div>

          <!-- Full media preview for videos -->
          <div v-if="isVideoMedia" class="media-preview p-4 border-b border-base-300">
            <video controls class="max-w-full h-auto rounded-lg">
              <source :src="mediaUrl" :type="node.mediaContent.mime_type">
              Your browser does not support the video tag.
            </video>
            <div class="mt-2 text-sm text-base-content/70">
              <span class="font-medium">{{ node.mediaContent.filename }}</span>
              <span class="ml-2 px-2 py-1 bg-base-200 rounded text-xs">{{ node.mediaContent.type }}</span>
            </div>
            <div v-if="isMediaProcessing" class="mt-4 text-sm text-base-content/60">
              <div class="flex items-center gap-2">
                <div class="loading loading-spinner loading-sm"></div>
                <span>{{ mediaProcessingStatus }}</span>
              </div>
            </div>
          </div>
          
          <!-- Regenerate caption button for images -->
          <div v-if="isImageMedia && node.mediaContent?.analysis && !isMediaProcessing" class="p-3 border-b border-base-300/50">
            <button 
              @click="regenerateCaption" 
              class="btn btn-xs btn-ghost opacity-60 hover:opacity-100"
              title="Regenerate caption">
              🔄 Regenerate Caption
            </button>
          </div>
        </div>

        <!-- Messages Container -->
        <div :class="[
          'messages-container transition-all duration-300 relative flex-grow overflow-hidden',
          isSnapped ? 'snapped-messages-container' : '',
          isExpanded && node.messages ? 'space-y-4' : ''
        ]">
          <!-- Compacted Messages Section -->
          <div v-if="isExpanded && compactedSections.length > 0" class="px-2 space-y-3">
            <CollapsedMessagesView
              v-for="section in compactedSections"
              :key="section.id"
              :compacted-section="section"
              :showing-expanded="expandedSectionId === section.id"
              :showing-summary="summarySectionId === section.id"
              @expand-messages="handleExpandSection(section.id)"
              @show-summary="handleShowSummary(section.id)"
              @remove-compaction="handleRemoveCompaction(section.id)"
            />
          </div>

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
                <!-- Message Content with Hanging Indent -->
                <div class="relative">
                  <div class="flex items-start gap-3">
                    <!-- Action Buttons -->
                    <div class="flex items-center gap-2 flex-shrink-0 ml-auto" v-if="!msg.isStreaming">
                      <button @click.stop="expandMessage(i)" class="p-1.5 rounded-full hover:bg-white/10">
                        <component :is="expandedMessages.has(i) ? Maximize2 : Minimize2"
                          class="w-4 h-4 text-base-content/60" />
                      </button>
                    </div>
                  </div>
                  
                  <!-- Message layout - different for snapped vs standard mode -->
                  <div v-if="isSnapped" class="message-with-label text-sm break-words overflow-hidden" :style="{ color: textContentColor }"
                    :class="{
                      'line-clamp-2': expandedMessages.has(i),
                      'whitespace-pre-wrap': !msg.isStreaming,
                      'whitespace-normal': msg.isStreaming
                    }">
                    <span v-if="msg.role === 'assistant'" class="message-label text-xs font-medium">
                      {{ msg.isStreaming ? 'AI Typing...' : getModelDisplayName(msg) }}:
                    </span>
                    <span class="message-content-inline">
                      <MessageContent 
                        :content="msg.content" 
                        :is-streaming="msg.isStreaming" 
                        :node-id="node.id"
                        :content-parts="msg.contentParts" 
                        :message-index="i" 
                        :data-message-idx="i"
                      />
                    </span>
                  </div>
                  
                  <!-- Standard mode - stacked layout -->
                  <div v-else class="message-stacked">
                    <!-- Only show label for AI messages -->
                    <div v-if="msg.role === 'assistant'" class="ai-model-label text-xs font-medium mb-1">
                      {{ msg.isStreaming ? 'AI Typing...' : getModelDisplayName(msg) }}:
                    </div>
                    <div class="message-content-block text-sm break-words overflow-hidden" :style="{ color: textContentColor }"
                      :class="{
                        'line-clamp-2': expandedMessages.has(i),
                        'whitespace-pre-wrap': !msg.isStreaming,
                        'whitespace-normal': msg.isStreaming
                      }">
                      <MessageContent 
                        :content="msg.content" 
                        :is-streaming="msg.isStreaming" 
                        :node-id="node.id"
                        :content-parts="msg.contentParts" 
                        :message-index="i" 
                        :data-message-idx="i"
                      />
                    </div>
                  </div>
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

                      <!-- TTS Controls -->
                      <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                        <TTSControls :text="msg.content"
                          :auto-trigger="autoTTSEnabled && i === node.messages.length - 1 && !msg.isStreaming"
                          :streaming-trigger="autoTTSEnabled && msg.isStreaming && i === node.messages.length - 1"
                          :streaming-text="msg.isStreaming && i === node.messages.length - 1 ? node.streamingContent : null"
                          compact />
                      </div>
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
  GitBranch,
  Volume2,
  Archive,
  Sparkles
} from 'lucide-vue-next';

import MessageInput from '../../messages/MessageInput.vue';
import CollapsedMessagesView from '../../messages/CollapsedMessagesView.vue';
import { useCanvasStore } from '../../../stores/canvasStore';
import { useThemeStore } from '@/stores/themeStore';
import { Card } from '@/components/ui/card';
import Badge from '../../ui/Badge.vue';
import MessageContent from '../../messages/MessageContent.vue';
import MessageTimestamp from '../../messages/MessageTimestamp.vue';
import ModelParamsEditor from '../../models/ModelParamsEditor.vue';
import TokenCounter from '@/components/ui/TokenCounter.vue';
import TitleGenerationLoader from '@/components/ui/TitleGenerationLoader.vue';
import ImageAnalysisLoader from '@/components/ui/ImageAnalysisLoader.vue';
import TTSControls from '../../messages/TTSControls.vue';
import { tokenTrackingService, type CompactedSection, type TokenUsage } from '@/services/tokenTrackingService';
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
import { autoCaptionService, type CaptionResult } from '@/services/autoCaptionService';

interface ExtendedMessage extends ModelParameters {
  // Extend as needed
  modelId?: string;
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
  isRightPanelOpen?: boolean;
  supportsVision?: boolean;
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
const autoTTSEnabled = ref(false);
const isRegeneratingTitle = ref(false);

// Compaction state
const compactedSections = ref<CompactedSection[]>([]);
const expandedSectionId = ref<string | null>(null);
const summarySectionId = ref<string | null>(null);
const currentTokenCount = ref(0);

const canvasStore = useCanvasStore();
const modelStore = useModelStore();

const themeStore = useThemeStore();
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');

let themeObserver;

// Get theme colors
const themeColors = computed(() => {
  return themeStore.getThemeColors(currentTheme.value);
});

const isLightTheme = computed(() => {
  const darkThemes = [
    'dark', 'synthwave', 'retro', 'cyberpunk', 'halloween',
    'forest', 'aqua', 'black', 'luxury', 'dracula', 'cmyk',
    'autumn', 'business', 'acid', 'night', 'coffee'
  ];
  return !darkThemes.includes(currentTheme.value);
});

const snappedBackgroundStyle = computed(() => {
  // Use theme colors for background instead of plain white/black
  const colors = themeColors.value;
  
  if (isLightTheme.value) {
    // For light themes, use a very light tint of the primary color
    const rgb = hexToRgb(colors.primary);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
  } else {
    // For dark themes, use a dark tint of the primary color
    const rgb = hexToRgb(colors.primary);
    return `rgba(${Math.min(rgb.r, 60)}, ${Math.min(rgb.g, 60)}, ${Math.min(rgb.b, 60)}, 0.8)`;
  }
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

// Get current model for params editor
const currentModel = computed(() => {
  // First try to get from lastModel if it exists
  if (lastModel.value) return lastModel.value;
  
  // Otherwise, create a model from the selectedModel prop
  if (props.selectedModel) {
    return getModelInfo(props.selectedModel);
  }
  
  return undefined;
});

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

// Media handling state
const isMediaProcessing = ref(false);
const isAutoCaptioning = ref(false);

// Media computed properties
const hasMediaContent = computed(() => !!props.node.mediaContent);
const isImageMedia = computed(() => props.node.mediaContent?.mime_type?.startsWith('image/'));
const isVideoMedia = computed(() => props.node.mediaContent?.mime_type?.startsWith('video/'));
const mediaUrl = computed(() => {
  if (!props.node.mediaContent) return null;
  return props.node.mediaContent.previewUrl || `http://127.0.0.1:5050/media/${props.node.mediaContent.media_id}`;
});

const mediaProcessingStatus = computed(() => {
  if (isAutoCaptioning.value) return 'Generating caption...';
  if (isMediaProcessing.value) return 'Processing media...';
  if (props.node.isProcessingMedia) return 'Processing...';
  return 'Processing...';
});

// Token tracking computed properties
const activeModel = computed(() => {
  // Use the last model used in this branch if available
  if (lastModel.value) return lastModel.value;
  
  // Otherwise fall back to the selected model for this branch
  if (props.selectedModel) {
    return getModelInfo(props.selectedModel);
  }
  
  // Finally fall back to the global selected model or first unique model
  return modelStore.selectedModel || uniqueModels.value[0] || null;
});

const tokenUsage = computed((): TokenUsage => {
  return tokenTrackingService.getTokenUsage(
    currentTokenCount.value,
    activeModel.value,
    compactedSections.value.length > 0
  );
});

const hasCompactedSections = computed(() => compactedSections.value.length > 0);

// Enhanced context tracking computed properties
const actualContextLimit = computed(() => {
  // Try to get real context limit from model, fallback to activeModel estimate
  return activeModel.value?.inputTokenLimit || 4096;
});

const contextUsagePercentage = computed(() => {
  const limit = actualContextLimit.value;
  const usage = currentTokenCount.value;
  return limit > 0 ? Math.round((usage / limit) * 100) : 0;
});

const hasCompactedMessages = computed(() => {
  return props.node.messages?.some(msg => 
    msg.contentParts?.some(part => part.type === 'compacted')
  ) || false;
});

const compactedMessageCount = computed(() => {
  return props.node.messages?.filter(msg => 
    msg.contentParts?.some(part => part.type === 'compacted')
  ).length || 0;
});

const shouldShowCompactButton = computed(() => {
  return (contextUsagePercentage.value >= 70 || tokenUsage.value.shouldCompact) && 
         !hasCompactedSections.value &&
         props.node.messages &&
         props.node.messages.length >= 5;
});

const contextStatusClass = computed(() => {
  const percentage = contextUsagePercentage.value;
  if (percentage >= 85) return 'text-red-600';
  if (percentage >= 70) return 'text-orange-600';
  if (percentage >= 60) return 'text-yellow-600';
  return '';
});

const contextIndicatorClass = computed(() => {
  const percentage = contextUsagePercentage.value;
  if (percentage >= 85) return 'bg-red-500 animate-pulse';
  if (percentage >= 70) return 'bg-orange-500';
  if (percentage >= 60) return 'bg-yellow-500';
  return 'bg-green-500';
});

const contextStatusMessage = computed(() => {
  const percentage = contextUsagePercentage.value;
  if (percentage >= 85) return 'Context limit critical - compaction recommended';
  if (percentage >= 70) return 'Context usage high - consider compacting';
  if (percentage >= 60) return 'Context usage moderate';
  return 'Context usage normal';
});

const displayMessages = computed((): ExtendedMessage[] => {
  let baseMessages: ExtendedMessage[] = [];
  
  // If we're showing an expanded section, show those messages instead
  if (expandedSectionId.value) {
    const section = compactedSections.value.find(s => s.id === expandedSectionId.value);
    baseMessages = section ? section.originalMessages : props.node.messages || [];
  } else {
    baseMessages = props.node.messages || [];
  }
  
  // Add streaming content if present
  return props.node.streamingContent
    ? [
      ...baseMessages,
      {
        role: 'assistant',
        content: props.node.streamingContent,
        contentParts: [{ type: 'text', content: props.node.streamingContent }],
        isStreaming: true,
        timestamp: new Date().toISOString()
      } as ExtendedMessage
    ]
    : baseMessages;
});

// Get model display name for message labels
const getModelDisplayName = (message: any): string => {
  // For streaming messages, use the current active model
  if (message.isStreaming && activeModel.value?.name) {
    return activeModel.value.name;
  }
  
  // For completed messages, try to get the model from the message's modelId
  if (message.modelId) {
    const modelInfo = getModelInfo(message.modelId);
    if (modelInfo?.name) {
      return modelInfo.name;
    }
  }
  
  // Fallback to active model name if no modelId on message
  if (activeModel.value?.name) {
    return activeModel.value.name;
  }
  
  return 'AI';
};

// Media processing function
const processMediaForNode = async (file: File) => {
  try {
    isMediaProcessing.value = true;
    
    // Create media content immediately for instant UI feedback
    const mediaId = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const previewUrl = URL.createObjectURL(file);
    
    // Set media content immediately so thumbnail shows
    canvasStore.updateNode(props.node.id, {
      mediaContent: {
        media_id: mediaId,
        filename: file.name,
        mime_type: file.type,
        type: file.type.startsWith('image/') ? 'image' : 'video',
        analysis: 'Processing...',
        previewUrl
      },
      isProcessingMedia: true
    });
    
    console.log('[BranchNode] Media content set immediately:', {
      fileName: file.name,
      fileType: file.type,
      mediaId,
      nodeId: props.node.id
    });
    
    // Check if we should use auto-captioning for images
    const settings = await autoCaptionService.getSettings();
    const shouldAutoCaption = settings.enabled && 
                              file.type.startsWith('image/') && 
                              settings.model &&
                              settings.model.trim() !== '';

    // Use router service to determine the best approach for image handling
    if (file.type.startsWith('image/')) {
      console.log('[BranchNode] Using router service for image handling');
      
      const { routerService } = await import('@/services/routerService');
      const routingResult = await routerService.routeRequest({
        message: 'Analyze this uploaded image',
        hasImages: true
      });
      
      console.log('[BranchNode] Router result:', routingResult);
      
      // If no vision model configured, show agent configurator
      if (!routingResult.model) {
        console.log('[BranchNode] No vision agent configured, showing configurator');
        const { agentService } = await import('@/services/agentService');
        await agentService.showAgentConfigurator('agents');
        
        // Update node with message about configuration needed
        canvasStore.updateNode(props.node.id, {
          mediaContent: {
            ...props.node.mediaContent,
            analysis: 'Image uploaded. Configure a vision agent in the settings panel to enable automatic captioning.'
          },
          messages: [
            ...(props.node.messages || []),
            {
              role: 'assistant',
              content: 'I\'ve uploaded your image, but no vision agent is configured for automatic analysis. Please set up a vision agent in the settings panel (gear icon) to enable automatic image captioning.',
              timestamp: new Date().toISOString()
            }
          ],
          isProcessingMedia: false
        });
        return;
      }
      
      // Update auto-caption settings to use router-selected model
      const currentSettings = await autoCaptionService.getSettings();
      const updatedSettings = {
        ...currentSettings,
        enabled: true,
        model: routingResult.model.name || routingResult.model.id
      };
      autoCaptionService.saveSettings(updatedSettings);
      
      console.log('[BranchNode] Using router-selected vision model:', routingResult.model.name);
    }
    
    if (shouldAutoCaption) {
      console.log('[BranchNode] Using auto-captioning service');
      isAutoCaptioning.value = true;
      
      // Generate caption
      const result: CaptionResult = await autoCaptionService.captionFile(file);
      
      if (result.success && result.caption) {
        // Update with successful caption
        canvasStore.updateNode(props.node.id, {
          mediaContent: {
            ...props.node.mediaContent,
            analysis: result.caption
          },
          messages: [
            ...(props.node.messages || []),
            {
              role: 'assistant',
              content: result.caption,
              timestamp: new Date().toISOString()
            }
          ],
          isProcessingMedia: false
        });
        
        console.log(`[BranchNode] Auto-caption generated in ${result.responseTime}ms`);
      } else {
        // Handle caption failure
        console.error('[BranchNode] Auto-caption failed:', result.error);
        
        canvasStore.updateNode(props.node.id, {
          mediaContent: {
            ...props.node.mediaContent,
            analysis: 'Caption generation failed'
          },
          messages: [
            ...(props.node.messages || []),
            {
              role: 'assistant',
              content: `Image uploaded successfully, but automatic captioning failed: ${result.error}. You can still chat about this image.`,
              timestamp: new Date().toISOString()
            }
          ],
          isProcessingMedia: false
        });
      }
    } else {
      // No auto-captioning, just mark as ready
      canvasStore.updateNode(props.node.id, {
        mediaContent: {
          ...props.node.mediaContent,
          analysis: 'Media uploaded successfully'
        },
        isProcessingMedia: false
      });
    }
    
  } catch (error) {
    console.error('[BranchNode] Media processing error:', error);
    
    canvasStore.updateNode(props.node.id, {
      mediaContent: {
        ...props.node.mediaContent,
        analysis: `Processing failed: ${error.message}`
      },
      isProcessingMedia: false
    });
  } finally {
    isMediaProcessing.value = false;
    isAutoCaptioning.value = false;
  }
};

// Regenerate caption function
const regenerateCaption = async () => {
  if (!props.node.mediaContent || !isImageMedia.value) return;
  
  isAutoCaptioning.value = true;
  
  try {
    let result: CaptionResult;
    
    if (props.node.mediaContent.previewUrl) {
      // Use preview URL if available
      result = await autoCaptionService.captionUrl(props.node.mediaContent.previewUrl);
    } else {
      // Use media URL
      const url = `http://127.0.0.1:5050/media/${props.node.mediaContent.media_id}`;
      result = await autoCaptionService.captionUrl(url);
    }
    
    if (result.success && result.caption) {
      // Update analysis
      canvasStore.updateNode(props.node.id, {
        mediaContent: {
          ...props.node.mediaContent,
          analysis: result.caption
        },
        messages: [
          ...(props.node.messages || []),
          {
            role: 'assistant',
            content: `[Updated caption] ${result.caption}`,
            timestamp: new Date().toISOString()
          }
        ]
      });
    } else {
      console.error('Caption regeneration failed:', result.error);
    }
    
  } catch (error) {
    console.error('Caption regeneration error:', error);
  } finally {
    isAutoCaptioning.value = false;
  }
};

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
    'dark', 'synthwave', 'retro', 'cyberpunk', 'halloween',
    'forest', 'aqua', 'black', 'luxury', 'dracula', 'cmyk',
    'autumn', 'business', 'acid', 'night', 'coffee'
  ];

  const forceLightText = forceLightTextThemes.includes(currentTheme.value);

  // Override the contrast text color for problematic themes
  const textColor = forceLightText
    ? 'rgba(255, 255, 255, 0.95)'
    : baseColorSet.value.contrastText;

  // Use theme-appropriate background colors instead of generic black/white
  const colors = themeColors.value;
  const primaryRgb = hexToRgb(colors.primary);
  const secondaryRgb = hexToRgb(colors.secondary);
  
  let baseBgColor, messageBgColor;
  
  if (!isLightTheme.value) {
    // Dark themes: use very dark tints of theme colors
    baseBgColor = `rgba(${Math.min(primaryRgb.r * 0.3, 40)}, ${Math.min(primaryRgb.g * 0.3, 40)}, ${Math.min(primaryRgb.b * 0.3, 40)}, 0.85)`;
    messageBgColor = `rgba(${Math.min(secondaryRgb.r * 0.2, 30)}, ${Math.min(secondaryRgb.g * 0.2, 30)}, ${Math.min(secondaryRgb.b * 0.2, 30)}, 0.7)`;
  } else {
    // Light themes: use very light tints of theme colors
    baseBgColor = `rgba(${Math.max(255 - (255 - primaryRgb.r) * 0.1, 240)}, ${Math.max(255 - (255 - primaryRgb.g) * 0.1, 240)}, ${Math.max(255 - (255 - primaryRgb.b) * 0.1, 240)}, 0.9)`;
    messageBgColor = `rgba(${Math.max(255 - (255 - secondaryRgb.r) * 0.05, 245)}, ${Math.max(255 - (255 - secondaryRgb.g) * 0.05, 245)}, ${Math.max(255 - (255 - secondaryRgb.b) * 0.05, 245)}, 0.8)`;
  }

  return {
    '--node-color': baseColorSet.value.base,
    '--node-color-light': baseColorSet.value.light,
    '--node-color-dark': baseColorSet.value.dark,
    '--node-color-transparent': baseColorSet.value.transparent,
    '--node-text-color': textColor,
    '--node-glow-color': `${adjustColorOpacity(baseColorSet.value.base, 0.4)}`,
    '--node-border-color': `${adjustColorOpacity(baseColorSet.value.light, 0.6)}`,
    '--node-shadow-color': `${adjustColorOpacity(baseColorSet.value.dark, 0.5)}`,
    '--base-bg-color': baseBgColor,
    '--message-bg-color': messageBgColor
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
  const rightPanelWidth = props.isRightPanelOpen ? vw * 0.4 : 0;
  const availableWidth = vw - sidePanelWidth - rightPanelWidth;

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
  const rightPanelWidth = props.isRightPanelOpen ? vw * 0.4 : 0;
  const availableWidth = vw - sidePanelWidth - rightPanelWidth;
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
      const currentRect = nodeElement.value?.getBoundingClientRect();
      originalPosition.value = {
        x: props.node.x,
        y: props.node.y,
        left: currentRect?.left || 0,
        top: currentRect?.top || 0
      };

      // First, set the node to its current screen position with fixed positioning
      if (nodeElement.value && currentRect) {
        nodeElement.value.style.position = 'fixed';
        nodeElement.value.style.transform = `translate3d(${currentRect.left}px, ${currentRect.top}px, 0) scale(${props.zoom})`;
        nodeElement.value.style.transformOrigin = '0 0';
      }

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

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  console.log('[BranchNode] DragOver event triggered, supportsVision:', props.supportsVision);
  if (props.supportsVision) {
    e.dataTransfer!.dropEffect = 'copy';
  }
};

const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  console.log('[BranchNode] Drop event triggered, supportsVision:', props.supportsVision);
  
  if (!props.supportsVision) {
    console.log('[BranchNode] Vision not supported, skipping drop handling');
    return;
  }
  
  try {
    const files = Array.from(e.dataTransfer?.files || []);
    const mediaFiles = files.filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    
    if (mediaFiles.length > 0) {
      console.log('[BranchNode] Handling media drop on existing node:', props.node.id);
      
      // Take the first media file and set it as the node's media content
      const file = mediaFiles[0];
      await processMediaForNode(file);
    }
  } catch (error) {
    console.error('Error handling dropped files:', error);
  }
};

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

const scrollToTop = () => {
  if (messagesContainerRef.value) {
    messagesContainerRef.value.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
};

const openModelParams = (model?: ModelInfo) => {
  if (model) {
    lastModel.value = model;
  }
  showParamsEditor.value = true;
};

const updateModelParams = (params: ModelParameters) => {
  if (currentModel.value) {
    canvasStore.updateModelParams(props.node.id, currentModel.value.id, params);
  }
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

const regenerateTitle = async () => {
  if (isRegeneratingTitle.value) return;
  
  isRegeneratingTitle.value = true;
  
  try {
    // Find the first user message in this node for title generation
    let firstUserMessage = '';
    
    if (props.node.messages && props.node.messages.length > 0) {
      const userMessage = props.node.messages.find(msg => msg.role === 'user');
      if (userMessage) {
        firstUserMessage = userMessage.content;
      }
    }
    
    if (!firstUserMessage) {
      console.warn('No user message found for title generation');
      return;
    }
    
    // Call the canvas store method to regenerate title
    await canvasStore.regenerateNodeTitle(props.node.id, firstUserMessage);
    
  } catch (error) {
    console.error('Failed to regenerate title:', error);
  } finally {
    isRegeneratingTitle.value = false;
  }
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

// Get the vertical position of a message container within the node
const getMessageVerticalOffset = (messageIndex: number): number => {
  if (!messagesContainerRef.value) return 40; // Default fallback
  
  // Find the message container element
  const messageElement = messagesContainerRef.value.querySelector(
    `[data-message-index="${messageIndex}"]`
  ) as HTMLElement;
  
  if (!messageElement) return 40; // Default if not found
  
  // Get the offset relative to the messages container
  const containerRect = messagesContainerRef.value.getBoundingClientRect();
  const messageRect = messageElement.getBoundingClientRect();
  
  // Calculate the center position of the message
  const relativeTop = messageRect.top - containerRect.top;
  const messageCenter = relativeTop + (messageRect.height / 2);
  
  // Add the container's offset within the node card
  // Account for node header, padding, etc.
  const nodeHeaderHeight = 120; // Approximate height of node header
  
  return nodeHeaderHeight + messageCenter;
};

// Get the branch button position for spline connection
const getBranchButtonPosition = (messageIndex: number): { x: number; y: number } => {
  if (!messagesContainerRef.value) return { x: 0, y: 40 };
  
  const messageElement = messagesContainerRef.value.querySelector(
    `[data-message-index="${messageIndex}"]`
  ) as HTMLElement;
  
  if (!messageElement) return { x: 0, y: 40 };
  
  const containerRect = messagesContainerRef.value.getBoundingClientRect();
  const messageRect = messageElement.getBoundingClientRect();
  
  // Calculate message center vertically
  const relativeTop = messageRect.top - containerRect.top;
  const messageCenter = relativeTop + (messageRect.height / 2);
  const nodeHeaderHeight = 120;
  const y = nodeHeaderHeight + messageCenter;
  
  // Calculate horizontal position of branch button
  // For user messages: button is at -left-12 (48px left of message)
  // For assistant messages: button is at -right-12 (48px right of message)
  const message = props.node.messages?.[messageIndex];
  const isUserMessage = message?.role === 'user';
  
  // Branch button is 48px (12 * 4) outside the message container
  // Button itself is 40px wide (p-2 + icon), so center is 20px from edge
  const buttonOffset = 48 + 20; // Distance from card edge to button center
  
  const x = isUserMessage ? -buttonOffset : canvasStore.CARD_WIDTH + buttonOffset;
  
  return { x, y };
};

// Emit message position updates when needed
const emitMessagePositions = () => {
  if (!props.node.messages || !messagesContainerRef.value) return;
  
  const positions: Record<number, number> = {};
  const buttonPositions: Record<number, { x: number; y: number }> = {};
  
  props.node.messages.forEach((_, index) => {
    positions[index] = getMessageVerticalOffset(index);
    buttonPositions[index] = getBranchButtonPosition(index);
  });
  
  // Emit to canvas store or parent component
  emitter.emit('node-message-positions-updated', {
    nodeId: props.node.id,
    positions,
    buttonPositions
  });
};

// Build multi-level branch context with summaries
const buildBranchContext = async (node: any): Promise<string> => {
  try {
    const { modelContextService } = await import('@/services/modelContextService');
    const summaries: any[] = [];
    
    // Collect summaries from parent branches
    const collectParentSummaries = (currentNode: any) => {
      if (!currentNode.parentId) return;
      
      const parentNode = canvasStore.nodes.find(n => n.id === currentNode.parentId);
      if (!parentNode) return;
      
      // Look for compacted summaries in parent's messages
      const compactedMessages = parentNode.messages?.filter(msg => 
        msg.contentParts?.some(part => part.type === 'compacted')
      ) || [];
      
      // Add parent summaries
      compactedMessages.forEach(msg => {
        const compactedPart = msg.contentParts?.find(part => part.type === 'compacted');
        if (compactedPart?.compactedData) {
          summaries.unshift({
            branchTitle: compactedPart.compactedData.branchTitle,
            summary: compactedPart.compactedData.summary
          });
        }
      });
      
      // Recursively collect from grandparents
      collectParentSummaries(parentNode);
    };
    
    // Start collecting from current node's parent
    collectParentSummaries(node);
    
    // Add current branch's recent context (non-compacted messages)
    const recentMessages = node.messages?.filter(msg => 
      !msg.contentParts?.some(part => part.type === 'compacted')
    ).slice(-3) || [];
    
    const recentContext = recentMessages.map(m => m.content).join(' ');
    
    // Build the multi-level context string
    if (summaries.length > 0) {
      const contextText = modelContextService.buildMultiBranchContext(summaries);
      return contextText + (recentContext ? `\n\nRecent conversation:\n${recentContext}` : '');
    }
    
    return recentContext;
  } catch (error) {
    console.error('Error building branch context:', error);
    // Fallback to simple context
    return node.messages?.slice(-3).map(m => m.content).join(' ') || '';
  }
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

    // 🚀 Router Service Integration - Intelligent Model Selection
    let modelInfo = {
      id: props.selectedModel,
      name: props.selectedModel,
      source: props.modelType
    };

    // Build multi-level branch context (needed regardless of routing)
    let branchContext = [];
    try {
      branchContext = await buildBranchContext(props.node);
    } catch (contextError) {
      console.warn('[BranchNode] Failed to build branch context:', contextError);
      branchContext = [];
    }

    try {
      // Import router service
      const { routerService } = await import('@/services/routerService');
      
      // Prepare routing request
      const routingRequest = {
        message: messageText,
        hasImages: pasteEntries?.some(entry => entry.type === 'image') || false,
        context: branchContext
      };

      console.log('[BranchNode] Routing request:', {
        message: messageText.substring(0, 100) + '...',
        hasImages: routingRequest.hasImages,
        contextLength: routingRequest.context.length
      });

      // Get routing decision
      const routingResult = await routerService.routeRequest(routingRequest);
      
      console.log('[BranchNode] Routing result:', {
        category: routingResult.category,
        confidence: routingResult.confidence,
        model: routingResult.model?.name,
        fallbackUsed: routingResult.fallbackUsed,
        responseTime: routingResult.responseTime
      });

      // Use routed model if available, otherwise fallback to selected model
      if (routingResult.model) {
        modelInfo = {
          id: routingResult.model.id,
          name: routingResult.model.name,
          source: routingResult.model.source
        };
        
        console.log(`[BranchNode] 🎯 Routed to ${routingResult.category} agent: ${routingResult.model.name} (${routingResult.responseTime}ms)`);
      } else {
        console.log(`[BranchNode] ⚠️ No agent configured for ${routingResult.category}, using selected model: ${props.selectedModel}`);
      }

    } catch (routerError) {
      console.error('[BranchNode] Router service failed, using selected model:', routerError);
      // Continue with originally selected model as fallback
    }

    await canvasStore.sendMessage(
      props.node.id,
      {
        text: messageText,
        pasteEntries: pasteEntries,
        branchContext: branchContext
      },
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

const toggleAutoTTS = () => {
  autoTTSEnabled.value = !autoTTSEnabled.value;
  console.log('BranchNode: Auto TTS toggled to:', autoTTSEnabled.value, 'for node:', props.node.id);
  // Store the preference in localStorage for persistence
  localStorage.setItem(`autoTTS_${props.node.id}`, autoTTSEnabled.value.toString());
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

watch(() => props.isRightPanelOpen, () => {
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

// Compaction methods
const handleAutoCompact = async () => {
  if (!props.node.messages || props.node.messages.length < 5) return;
  
  // Get the current model to check context limits
  const currentModel = activeModel.value;
  if (!currentModel) return;
  
  try {
    // Import the model context service
    const { modelContextService } = await import('@/services/modelContextService');
    
    // Check if compaction is needed
    const shouldCompact = await modelContextService.shouldCompactConversation(
      props.node.messages,
      currentModel.name,
      { maxSummaryWords: 400, includeParentContext: true, compactThreshold: 80 }
    );
    
    if (!shouldCompact) return;
    
    // Take the first 75% of messages for compaction, leaving recent context
    const splitIndex = Math.floor(props.node.messages.length * 0.75);
    const messagesToCompact = props.node.messages.slice(0, splitIndex);
    const remainingMessages = props.node.messages.slice(splitIndex);
    
    // Create compacted summary using the new service
    const compactSummary = await modelContextService.compactConversation(
      messagesToCompact,
      props.node.title || 'Untitled Thread'
    );
    
    // Create a compacted message content part
    const compactedMessage = {
      role: 'assistant' as const,
      content: `Conversation summary (${compactSummary.originalMessageCount} messages compacted)`,
      contentParts: [{
        type: 'compacted' as const,
        content: compactSummary.summary,
        compactedData: {
          id: compactSummary.id,
          originalMessageCount: compactSummary.originalMessageCount,
          compactedAt: compactSummary.compactedAt,
          summary: compactSummary.summary,
          branchTitle: compactSummary.branchTitle,
          isExpanded: false,
          originalMessages: messagesToCompact
        }
      }],
      timestamp: new Date().toISOString()
    };
    
    // Update the node with compacted message + remaining messages
    const updatedMessages = [compactedMessage, ...remainingMessages];
    
    await canvasStore.updateNode(props.node.id, {
      messages: updatedMessages
    });
    
    // Clear token cache for this branch
    tokenTrackingService.clearBranchCache(props.node.id);
    
    console.log(`[BranchNode] Compacted ${messagesToCompact.length} messages into summary`);
  } catch (error) {
    console.error('Error creating compacted conversation:', error);
  }
};

const handleBranchFromLastMessage = () => {
  // Find the last non-compacted message
  const messages = props.node.messages || [];
  let lastNonCompactedIndex = messages.length - 1;
  
  // Look backwards for the last message that isn't compacted
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const hasCompactedContent = message.contentParts?.some(part => part.type === 'compacted');
    if (!hasCompactedContent) {
      lastNonCompactedIndex = i;
      break;
    }
  }
  
  // Emit event to create a new branch from this message
  emitter.emit('create-branch-from-message', {
    nodeId: props.node.id,
    messageIndex: lastNonCompactedIndex,
    includeParentContext: true
  });
};

const handleExpandSection = (sectionId: string) => {
  expandedSectionId.value = expandedSectionId.value === sectionId ? null : sectionId;
  summarySectionId.value = null; // Clear summary view
};

const handleShowSummary = (sectionId: string) => {
  summarySectionId.value = summarySectionId.value === sectionId ? null : sectionId;
  expandedSectionId.value = null; // Clear expanded view
};

const handleRemoveCompaction = (sectionId: string) => {
  const sectionIndex = compactedSections.value.findIndex(s => s.id === sectionId);
  if (sectionIndex === -1) return;
  
  const section = compactedSections.value[sectionIndex];
  
  // Restore messages to the node
  const currentMessages = props.node.messages || [];
  const restoredMessages = [...section.originalMessages, ...currentMessages];
  
  canvasStore.updateNode(props.node.id, {
    messages: restoredMessages
  });
  
  // Remove the compacted section
  compactedSections.value.splice(sectionIndex, 1);
  
  // Clear any active views
  if (expandedSectionId.value === sectionId) {
    expandedSectionId.value = null;
  }
  if (summarySectionId.value === sectionId) {
    summarySectionId.value = null;
  }
  
  // Clear token cache
  tokenTrackingService.clearBranchCache(props.node.id);
};

// Watch for token count updates
watch(() => getAllMessagesText.value, async (newText) => {
  try {
    currentTokenCount.value = await tokenTrackingService.countBranchTokens(
      props.node.messages || [],
      '', // No current input from here
      props.node.id
    );
  } catch (error) {
    console.error('Error updating token count:', error);
  }
}, { immediate: true });

onMounted(() => {
  if (!props.node.title) {
    isEditing.value = true;
  }

  // Restore autoTTS preference from localStorage
  const savedAutoTTS = localStorage.getItem(`autoTTS_${props.node.id}`);
  if (savedAutoTTS !== null) {
    autoTTSEnabled.value = savedAutoTTS === 'true';
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

  // Handle compacted conversation events
  emitter.on('continue-conversation', ({ nodeId }) => {
    if (nodeId === props.node.id) {
      // Focus on the message input to continue the conversation
      document.querySelector(`[data-node-id="${nodeId}"] textarea`)?.focus();
    }
  });

  emitter.on('branch-from-last', ({ nodeId }) => {
    if (nodeId === props.node.id) {
      // Create a new branch from the last non-compacted message
      handleBranchFromLastMessage();
    }
  });

  emitter.on('toggle-compacted-expansion', ({ nodeId, expanded }) => {
    if (nodeId === props.node.id) {
      // Handle toggling expansion of compacted messages
      console.log(`Toggling compacted expansion for ${nodeId}: ${expanded}`);
    }
  });

  emitter.on('request-node-position-update', ({ nodeId }) => {
    if (nodeId === props.node.id) {
      // Update message positions when requested
      nextTick(() => {
        emitMessagePositions();
      });
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
    
    // Emit initial message positions
    nextTick(() => {
      emitMessagePositions();
    });
  }
});

// Watch for message changes and update positions
watch(() => props.node.messages?.length, () => {
  nextTick(() => {
    emitMessagePositions();
  });
});

// Watch for expansion state changes
watch(isExpanded, () => {
  nextTick(() => {
    emitMessagePositions();
  });
});

onBeforeUnmount(() => {
  if (themeObserver) {
    themeObserver.disconnect();
  }
  document.body.classList.remove('has-snapped-node');
  emitter.off('debug-sandbox');
  emitter.off('streaming-complete');
  emitter.off('scroll-to-code-bubble', scrollToCodeBubble);
  emitter.off('continue-conversation');
  emitter.off('branch-from-last');
  emitter.off('toggle-compacted-expansion');
  emitter.off('request-node-position-update');
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
/* COMPLETE BRANCH NODE STYLES - Fixed theme contrasting and consistent snapped backgrounds */

/* FIXED: Proper theme detection for text contrast */
.branch-node {
  --node-color: var(--p);
  --node-color-light: var(--pf, var(--p));
  --node-color-dark: var(--pc, var(--p));
  --node-color-transparent: rgba(var(--p), 0.1);
  --node-text-color: var(--pc, #000);
  --node-glow-color: rgba(var(--p), 0.4);
  --node-border-color: rgba(var(--p), 0.6);
  --node-shadow-color: rgba(var(--p), 0.5);
  --base-bg-color: rgba(255, 255, 255, 0.7);
  --message-bg-color: rgba(245, 245, 245, 0.6);
  --snapped-backdrop: rgba(0, 0, 0, 0.4);
  /* Default backdrop */
}

/* FIXED: Dark themes get light text and dark backdrops */
.theme-dark,
.theme-synthwave,
.theme-cyberpunk,
.theme-dracula,
.theme-night,
.theme-black,
.theme-luxury,
.theme-forest,
.theme-coffee {
  --node-text-color: rgba(255, 255, 255, 0.95) !important;
  --base-bg-color: rgba(0, 0, 0, 0.7);
  --message-bg-color: rgba(30, 30, 30, 0.6);
}

/* FIXED: Light themes get dark text and light backdrops */
.theme-light,
.theme-corporate,
.theme-cupcake,
.theme-bumblebee,
.theme-emerald,
.theme-retro,
.theme-valentine,
.theme-garden,
.theme-lofi,
.theme-pastel,
.theme-fantasy,
.theme-wireframe,
.theme-autumn,
.theme-acid,
.theme-lemonade,
.theme-winter {
  --node-text-color: rgba(0, 0, 0, 0.85) !important;
  --base-bg-color: rgba(255, 255, 255, 0.8);
  --message-bg-color: rgba(245, 245, 245, 0.7);
}

/* FIXED: Mixed themes */
.theme-cmyk {
  --node-text-color: rgba(0, 0, 0, 0.85) !important;
  --base-bg-color: rgba(255, 255, 255, 0.8);
}

/* THEME-SPECIFIC SNAPPED BACKDROPS - Match canvas backgrounds */
.theme-light {
  --snapped-backdrop: rgba(248, 250, 252, 0.8);
}

/* Light gray */
.theme-dark {
  --snapped-backdrop: rgba(15, 23, 42, 0.8);
}

/* Dark slate */
.theme-cupcake {
  --snapped-backdrop: rgba(253, 242, 248, 0.8);
}

/* Pink tint */
.theme-bumblebee {
  --snapped-backdrop: rgba(255, 251, 235, 0.8);
}

/* Warm yellow */
.theme-emerald {
  --snapped-backdrop: rgba(236, 253, 245, 0.8);
}

/* Green tint */
.theme-corporate {
  --snapped-backdrop: rgba(248, 250, 252, 0.8);
}

/* Clean gray */
.theme-synthwave {
  --snapped-backdrop: rgba(20, 5, 40, 0.8);
}

/* Dark purple */
.theme-retro {
  --snapped-backdrop: rgba(255, 248, 220, 0.8);
}

/* Deep cyberpunk purple */
.theme-cyberpunk {
  --snapped-backdrop: rgba(20, 5, 30, 0.9);
}

/* Dark yellow base */
.theme-valentine {
  --snapped-backdrop: rgba(255, 240, 245, 0.8);
}

/* Dark purple/blue Halloween theme */
.theme-halloween {
  --snapped-backdrop: rgba(15, 10, 25, 0.95);
}

/* Dark orange */
.theme-garden {
  --snapped-backdrop: rgba(240, 253, 244, 0.8);
}

/* Light green */
.theme-forest {
  --snapped-backdrop: rgba(10, 25, 15, 0.8);
}

/* Dark green */
.theme-aqua {
  --snapped-backdrop: rgba(5, 25, 35, 0.8);
}

/* Dark teal */
.theme-lofi {
  --snapped-backdrop: rgba(250, 248, 246, 0.8);
}

/* Warm off-white */
.theme-pastel {
  --snapped-backdrop: rgba(252, 251, 255, 0.8);
}

/* Very light purple */
.theme-fantasy {
  --snapped-backdrop: rgba(255, 240, 255, 0.8);
}

/* Light magenta */
.theme-wireframe {
  --snapped-backdrop: rgba(255, 255, 255, 0.9);
}

/* Pure white */
.theme-black {
  --snapped-backdrop: rgba(0, 0, 0, 0.8);
}

/* Pure black */
.theme-luxury {
  --snapped-backdrop: rgba(15, 15, 15, 0.8);
}

/* Rich black */
.theme-dracula {
  --snapped-backdrop: rgba(40, 42, 54, 0.8);
}

/* Dracula background */
.theme-cmyk {
  --snapped-backdrop: rgba(245, 245, 255, 0.8);
}

/* Light blue tint */
.theme-autumn {
  --snapped-backdrop: rgba(255, 248, 235, 0.8);
}

/* Warm cream */
.theme-business {
  --snapped-backdrop: rgba(25, 35, 45, 0.8);
}

/* Dark with neon glow */
.theme-acid {
  --snapped-backdrop: rgba(20, 20, 20, 0.9);
}

/* Bright yellow tint */
.theme-lemonade {
  --snapped-backdrop: rgba(255, 255, 240, 0.8);
}

/* Light yellow */
.theme-night {
  --snapped-backdrop: rgba(15, 20, 35, 0.8);
}

/* Deep blue */
.theme-coffee {
  --snapped-backdrop: rgba(25, 15, 10, 0.8);
}

/* Dark brown */
.theme-winter {
  --snapped-backdrop: rgba(240, 248, 255, 0.8);
}

/* Ice blue */

/* Enhanced glassmorphism variables for better contrast */
:root {
  /* User message glassmorphism - warm contrasting colors */
  --user-glass-primary: rgba(99, 102, 241, 0.15);
  /* Indigo */
  --user-glass-secondary: rgba(79, 70, 229, 0.25);
  /* Darker indigo */
  --user-border-color: rgba(99, 102, 241, 0.3);
  --user-accent-color: rgb(99, 102, 241);
  --user-shadow-color: rgba(99, 102, 241, 0.2);
  --user-highlight-color: rgba(165, 180, 252, 0.4);

  /* AI message glassmorphism - uses node theme color */
  --ai-glass-primary: var(--node-color-transparent);
  --ai-glass-secondary: rgba(var(--node-color), 0.25);
  --ai-border-color: rgba(var(--node-color), 0.3);
  --ai-shadow-color: rgba(var(--node-color), 0.2);
  --ai-highlight-color: rgba(var(--node-color), 0.4);
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

/* Enhanced node card styling with better theme support */
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
  color: var(--node-text-color);
  /* Ensure proper text color inheritance */
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
      var(--a, #ff6347) 15%,
      var(--wa, #ffd700) 30%,
      var(--su, #32cd32) 45%,
      var(--in, #4169e1) 60%,
      var(--p, #9400d3) 75%,
      var(--er, #ff1493) 90%,
      var(--a, #ff6347) 100%);
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

/* Ensure inner content appears above overlays and inherits proper colors */
.streaming .node-card>* {
  position: relative;
  z-index: 1;
  color: inherit;
}

/* FIXED: Proper text color inheritance for all child elements */
.node-card * {
  color: inherit;
}

/* FIXED: Specific overrides for elements that might not inherit properly */
.node-card .text-lg,
.node-card .text-sm,
.node-card .text-xs,
.node-card .badge,
.node-card .text-base-content,
.node-card .text-base-content\/60 {
  color: var(--node-text-color) !important;
}

/* Semi-transparent text */
.node-card .text-base-content\/60 {
  color: var(--node-text-color) !important;
  opacity: 0.6;
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

/* UPDATED: Centralized Message alignment styles like Claude's interface */
.user-message,
.ai-message {
  margin: 0 auto 1rem auto !important;
  /* Center both message types */
  max-width: 90% !important;
  /* Slightly wider for better readability */
  justify-content: flex-start !important;
  /* Consistent alignment */
  padding: 1rem 1.5rem !important;
  /* Consistent padding */
  align-self: center !important;
  /* Center alignment */
  float: none !important;
  /* Remove floating */
  clear: both !important;
  /* Ensure proper stacking */
  text-align: left !important;
  /* Consistent text alignment */
  display: block !important;
  /* Ensure proper block display */
  position: relative;
  backdrop-filter: blur(12px) !important;
  /* Glassmorphism effect */
  -webkit-backdrop-filter: blur(12px) !important;
  /* Safari support */
  color: var(--node-text-color) !important;
  /* Ensure message text uses theme-appropriate color */
}

/* User message glassmorphism - Contrasting warm tone */
.user-message {
  background: linear-gradient(135deg,
      var(--user-glass-primary),
      var(--user-glass-secondary)) !important;
  border: 1px solid var(--user-border-color) !important;
  border-left: 3px solid var(--user-accent-color) !important;
  box-shadow:
    0 4px 16px var(--user-shadow-color),
    inset 0 1px 0 var(--user-highlight-color) !important;
}

/* AI message glassmorphism - Node theme color */
.ai-message {
  background: linear-gradient(135deg,
      var(--ai-glass-primary),
      var(--ai-glass-secondary)) !important;
  border: 1px solid var(--ai-border-color) !important;
  border-left: 3px solid var(--node-color) !important;
  box-shadow:
    0 4px 16px var(--ai-shadow-color),
    inset 0 1px 0 var(--ai-highlight-color) !important;
}

/* Remove the old pseudo-elements since we're using direct backgrounds */
.user-message::before,
.ai-message::before {
  display: none;
}

/* Updated message text styling */
.message-text {
  color: var(--node-text-color);
  text-align: left !important;
  /* Consistent left alignment */
}

.user-message .message-text {
  font-weight: 500;
  /* Keep slightly bolder for user messages */
  text-align: left !important;
  /* Change from right to left */
}

.user-message .badge {
  margin-left: 0 !important;
  /* Reset margin */
}

/* UPDATED: Message container styling for centralized layout */
.message-container {
  position: relative;
  transition: all 0.2s ease-in-out;
  margin: 0 auto 1rem auto !important;
  /* Center the container */
  padding: 1rem !important;
  overflow: visible;
  border-radius: 0.75rem;
  width: 95% !important;
  /* Consistent width */
  display: block !important;
  max-width: none !important;
  /* Remove max-width restriction */
  color: var(--node-text-color) !important;
  /* Ensure container text uses theme color */
}

/* Enhanced hover effects for the new centered layout */
.message-container:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.user-message:hover {
  background: linear-gradient(135deg,
      var(--user-glass-secondary),
      var(--user-glass-primary)) !important;
  border-color: var(--user-accent-color) !important;
  box-shadow:
    0 6px 20px var(--user-shadow-color),
    inset 0 1px 0 var(--user-highlight-color),
    0 0 0 1px var(--user-border-color) !important;
}

.ai-message:hover {
  background: linear-gradient(135deg,
      var(--ai-glass-secondary),
      var(--ai-glass-primary)) !important;
  border-color: var(--node-color) !important;
  box-shadow:
    0 6px 20px var(--ai-shadow-color),
    inset 0 1px 0 var(--ai-highlight-color),
    0 0 0 1px var(--ai-border-color) !important;
}

/* UPDATED: Branch button positioning for centered layout */
.message-container .branch-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: all 0.2s ease-in-out;
  z-index: 20;
  background-color: var(--base-bg-color);
  color: var(--node-color) !important;
  border-radius: 50%;
  padding: 0.5rem;
}

.user-message .branch-btn {
  right: -3rem;
  /* Position to the right of the message */
}

.ai-message .branch-btn {
  left: -3rem;
  /* Position to the left of the message */
}

.message-container:hover .branch-btn {
  opacity: 1;
}

.branch-btn:hover {
  background-color: var(--node-color-transparent) !important;
  transform: translateY(-50%) scale(1.1);
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

/* Message with hanging indent layout */
.message-with-label {
  position: relative;
}

.message-label {
  float: left;
  margin-right: 0.5rem;
  line-height: 1.4;
}

.message-content-inline {
  display: block;
  overflow: hidden;
  line-height: 1.4;
}

/* Ensure subsequent lines align with container edge, not the label */
.message-content-inline :deep(.whitespace-pre-wrap) {
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Handle code blocks and other content properly */
.message-content-inline :deep(.mt-3) {
  margin-top: 0.75rem;
  clear: both;
  margin-left: 0;
}

.message-content-inline :deep(.mb-3) {
  margin-bottom: 0.75rem;
  clear: both;
  margin-left: 0;
}

/* Standard mode - stacked layout for better space utilization */
.message-stacked {
  width: 100%;
}

.message-label-block {
  display: block;
  line-height: 1.4;
}

.message-content-block {
  display: block;
  width: 100%;
  line-height: 1.4;
}

/* AI model label styling for better contrast */
.ai-model-label {
  background: hsl(var(--p) / 0.1);
  color: hsl(var(--p));
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  border: 1px solid hsl(var(--p) / 0.2);
  display: inline-block;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.025em;
}

/* Dark theme adjustments for AI label */
[data-theme="dark"] .ai-model-label,
[data-theme="synthwave"] .ai-model-label,
[data-theme="cyberpunk"] .ai-model-label,
[data-theme="dracula"] .ai-model-label,
[data-theme="night"] .ai-model-label,
[data-theme="halloween"] .ai-model-label,
[data-theme="forest"] .ai-model-label,
[data-theme="black"] .ai-model-label,
[data-theme="luxury"] .ai-model-label,
[data-theme="business"] .ai-model-label,
[data-theme="coffee"] .ai-model-label {
  background: hsl(var(--p) / 0.15);
  border: 1px solid hsl(var(--p) / 0.3);
}

/* Snapped mode AI label styling */
.message-label {
  background: hsl(var(--p) / 0.1);
  color: hsl(var(--p));
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  border: 1px solid hsl(var(--p) / 0.2);
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.025em;
  margin-right: 0.75rem;
}

/* Enhanced snapped view styling with THEME-CONSISTENT backgrounds */
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
}

/* FIXED: Theme-consistent backdrop that matches canvas background */
.branch-node.snapped::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--snapped-backdrop);
  /* Use theme-specific backdrop */
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: -1;
  pointer-events: none;
  transition: opacity 0.3s ease-out;
}

/* Adjust width based on side panel */
.branch-node.snapped[data-side-panel-open="true"] {
  width: 60vw;
}

.branch-node.snapped[data-side-panel-open="false"] {
  width: 100vw;
}

/* Adjust width based on right panel */
.branch-node.snapped[data-right-panel-open="true"] {
  width: 60vw;
}

/* Combined panel states - both panels open */
.branch-node.snapped[data-side-panel-open="true"][data-right-panel-open="true"] {
  width: 20vw;
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
  color: var(--node-text-color) !important;
  /* Ensure snapped card uses proper text color */
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
}

/* Collapsed preview styling */
.collapsed-preview {
  color: var(--node-text-color) !important;
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

/* Theme-specific glassmorphism customizations */
.theme-cyberpunk .user-message {
  background: linear-gradient(135deg,
      rgba(255, 117, 152, 0.3),
      rgba(247, 213, 29, 0.2)) !important;
  border-color: rgba(255, 117, 152, 0.7) !important;
  box-shadow:
    0 4px 16px rgba(255, 117, 152, 0.5),
    inset 0 1px 0 rgba(247, 213, 29, 0.4),
    0 0 15px rgba(255, 117, 152, 0.4) !important;
}

.theme-cyberpunk .ai-message {
  background: linear-gradient(135deg,
      rgba(117, 209, 240, 0.3),
      rgba(255, 117, 152, 0.15)) !important;
  border-color: rgba(117, 209, 240, 0.7) !important;
  box-shadow:
    0 4px 16px rgba(117, 209, 240, 0.5),
    inset 0 1px 0 rgba(255, 117, 152, 0.3),
    0 0 15px rgba(117, 209, 240, 0.4) !important;
}

.theme-synthwave .user-message {
  background: linear-gradient(135deg,
      rgba(255, 150, 0, 0.25),
      rgba(255, 100, 150, 0.3)) !important;
  border-color: rgba(255, 150, 0, 0.6) !important;
}

.theme-synthwave .ai-message {
  background: linear-gradient(135deg,
      rgba(150, 0, 255, 0.2),
      rgba(200, 100, 255, 0.3)) !important;
  border-color: rgba(150, 0, 255, 0.5) !important;
}

.theme-valentine .user-message,
.theme-cupcake .user-message {
  background: linear-gradient(135deg,
      rgba(100, 150, 255, 0.2),
      rgba(150, 100, 255, 0.25)) !important;
  border-color: rgba(100, 150, 255, 0.5) !important;
}

.theme-valentine .ai-message,
.theme-cupcake .ai-message {
  background: linear-gradient(135deg,
      rgba(255, 150, 200, 0.2),
      rgba(255, 200, 220, 0.25)) !important;
  border-color: rgba(255, 150, 200, 0.4) !important;
}

.theme-forest .user-message,
.theme-garden .user-message {
  background: linear-gradient(135deg,
      rgba(100, 200, 255, 0.2),
      rgba(150, 220, 255, 0.25)) !important;
  border-color: rgba(100, 200, 255, 0.5) !important;
}

.theme-night .user-message {
  background: linear-gradient(135deg,
      rgba(255, 200, 100, 0.25),
      rgba(255, 150, 50, 0.3)) !important;
  border-color: rgba(255, 200, 100, 0.6) !important;
}

.theme-luxury .user-message {
  background: linear-gradient(135deg,
      rgba(218, 165, 32, 0.2),
      rgba(255, 215, 0, 0.25)) !important;
  border-color: rgba(218, 165, 32, 0.5) !important;
  box-shadow:
    0 4px 16px rgba(218, 165, 32, 0.3),
    inset 0 1px 0 rgba(255, 215, 0, 0.4),
    0 0 10px rgba(218, 165, 32, 0.2) !important;
}

.theme-cyberpunk .node-card {
  border-width: 2px;
  border-style: solid;
  box-shadow: 
    0 0 15px var(--node-glow-color), 
    inset 0 0 8px rgba(117, 209, 240, 0.2),
    0 0 25px rgba(255, 117, 152, 0.3);
  background: var(--base-bg-color) !important;
}

.theme-synthwave .node-card {
  background: linear-gradient(to bottom right, rgba(20, 10, 30, 0.8), rgba(80, 30, 110, 0.7)) !important;
  border-width: 1px;
  box-shadow: 0 0 20px var(--node-glow-color);
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

.theme-aqua .node-card {
  background: linear-gradient(135deg, rgba(0, 30, 60, 0.8), rgba(0, 180, 220, 0.3)) !important;
  backdrop-filter: blur(20px);
  border-radius: 1rem;
  box-shadow: 0 8px 32px rgba(0, 180, 220, 0.4);
}

.theme-forest .node-card,
.theme-garden .node-card {
  background: linear-gradient(to bottom, rgba(20, 40, 20, 0.7), rgba(40, 80, 40, 0.5)) !important;
}

.theme-night .node-card {
  background: linear-gradient(to bottom, rgba(10, 10, 30, 0.8), rgba(20, 30, 60, 0.6)) !important;
  box-shadow: 0 8px 30px rgba(0, 0, 30, 0.6);
}

.theme-coffee .node-card {
  background: linear-gradient(to bottom, rgba(50, 30, 20, 0.8), rgba(80, 50, 40, 0.6)) !important;
}

.theme-luxury .node-card {
  background: linear-gradient(to bottom, rgba(20, 20, 20, 0.9), rgba(40, 40, 40, 0.8)) !important;
  border: 1px solid rgba(218, 165, 32, 0.6);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(218, 165, 32, 0.3);
}

/* Enhanced cyberpunk snapped state styling */
.theme-cyberpunk .node-card.snapped {
  background: var(--snapped-backdrop) !important;
  border-color: rgba(117, 209, 240, 0.8) !important;
  box-shadow: 
    0 0 20px var(--node-glow-color), 
    inset 0 0 12px rgba(117, 209, 240, 0.3),
    0 0 35px rgba(255, 117, 152, 0.4),
    0 0 50px rgba(247, 213, 29, 0.2) !important;
}

.theme-cyberpunk .snapped .user-message {
  background: linear-gradient(135deg,
      rgba(255, 117, 152, 0.4),
      rgba(247, 213, 29, 0.25)) !important;
  border-color: rgba(255, 117, 152, 0.8) !important;
  box-shadow:
    0 4px 20px rgba(255, 117, 152, 0.6),
    inset 0 1px 0 rgba(247, 213, 29, 0.5),
    0 0 20px rgba(255, 117, 152, 0.5) !important;
}

.theme-cyberpunk .snapped .ai-message {
  background: linear-gradient(135deg,
      rgba(117, 209, 240, 0.4),
      rgba(255, 117, 152, 0.2)) !important;
  border-color: rgba(117, 209, 240, 0.8) !important;
  box-shadow:
    0 4px 20px rgba(117, 209, 240, 0.6),
    inset 0 1px 0 rgba(255, 117, 152, 0.4),
    0 0 20px rgba(117, 209, 240, 0.5) !important;
}

/* Halloween theme styling with purple and blue */
.theme-halloween .user-message {
  background: linear-gradient(135deg,
      rgba(88, 28, 135, 0.4),
      rgba(25, 25, 50, 0.3)) !important;
  border-color: rgba(124, 58, 237, 0.6) !important;
  box-shadow:
    0 4px 16px rgba(88, 28, 135, 0.5),
    inset 0 1px 0 rgba(59, 130, 246, 0.2),
    0 0 20px rgba(88, 28, 135, 0.4) !important;
}

.theme-halloween .ai-message {
  background: linear-gradient(135deg,
      rgba(25, 25, 50, 0.4),
      rgba(59, 130, 246, 0.2)) !important;
  border-color: rgba(59, 130, 246, 0.6) !important;
  box-shadow:
    0 4px 16px rgba(25, 25, 50, 0.6),
    inset 0 1px 0 rgba(124, 58, 237, 0.2),
    0 0 20px rgba(59, 130, 246, 0.3) !important;
}

.theme-halloween .node-card {
  position: relative;
  border-width: 2px;
  border-style: solid;
  border-color: rgba(88, 28, 135, 0.6) !important;
  box-shadow: 
    0 0 20px rgba(88, 28, 135, 0.4), 
    inset 0 0 10px rgba(25, 25, 50, 0.5),
    0 0 30px rgba(59, 130, 246, 0.2);
}

/* Add bat decorations with CSS */
.theme-halloween .node-card::before,
.theme-halloween .node-card::after {
  content: '🦇';
  position: absolute;
  font-size: 20px;
  opacity: 0.3;
  animation: float-bats 15s ease-in-out infinite;
  pointer-events: none;
}

.theme-halloween .node-card::before {
  top: 10px;
  right: 20px;
  animation-delay: 0s;
}

.theme-halloween .node-card::after {
  bottom: 20px;
  left: 30px;
  animation-delay: 7.5s;
  transform: scaleX(-1);
}

@keyframes float-bats {
  0%, 100% { transform: translateY(0) rotate(-5deg); }
  25% { transform: translateY(-10px) rotate(5deg); }
  50% { transform: translateY(5px) rotate(-3deg); }
  75% { transform: translateY(-5px) rotate(3deg); }
}

.theme-halloween .node-card.snapped {
  background: var(--snapped-backdrop) !important;
  border-color: rgba(124, 58, 237, 0.8) !important;
  box-shadow: 
    0 0 25px rgba(88, 28, 135, 0.6), 
    inset 0 0 15px rgba(25, 25, 50, 0.6),
    0 0 40px rgba(59, 130, 246, 0.3),
    0 0 60px rgba(88, 28, 135, 0.3) !important;
}

.theme-halloween .snapped .user-message {
  background: linear-gradient(135deg,
      rgba(88, 28, 135, 0.5),
      rgba(25, 25, 50, 0.35)) !important;
  border-color: rgba(124, 58, 237, 0.8) !important;
  box-shadow:
    0 4px 20px rgba(88, 28, 135, 0.6),
    inset 0 1px 0 rgba(59, 130, 246, 0.3),
    0 0 25px rgba(88, 28, 135, 0.5) !important;
}

.theme-halloween .snapped .ai-message {
  background: linear-gradient(135deg,
      rgba(25, 25, 50, 0.5),
      rgba(59, 130, 246, 0.25)) !important;
  border-color: rgba(59, 130, 246, 0.8) !important;
  box-shadow:
    0 4px 20px rgba(25, 25, 50, 0.7),
    inset 0 1px 0 rgba(124, 58, 237, 0.3),
    0 0 25px rgba(59, 130, 246, 0.4) !important;
}

/* Acid theme styling with neon effects */
.theme-acid .user-message {
  background: linear-gradient(135deg,
      rgba(255, 0, 255, 0.25),
      rgba(255, 255, 0, 0.15)) !important;
  border-color: rgba(255, 0, 255, 0.7) !important;
  box-shadow:
    0 4px 16px rgba(255, 0, 255, 0.4),
    inset 0 1px 0 rgba(255, 255, 0, 0.3),
    0 0 20px rgba(255, 0, 255, 0.3) !important;
}

.theme-acid .ai-message {
  background: linear-gradient(135deg,
      rgba(0, 255, 0, 0.25),
      rgba(255, 255, 0, 0.15)) !important;
  border-color: rgba(0, 255, 0, 0.7) !important;
  box-shadow:
    0 4px 16px rgba(0, 255, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 0, 0.3),
    0 0 20px rgba(0, 255, 0, 0.3) !important;
}

.theme-acid .node-card {
  border-width: 2px;
  border-style: solid;
  box-shadow: 
    0 0 15px rgba(255, 255, 0, 0.3), 
    inset 0 0 8px rgba(255, 0, 255, 0.1),
    0 0 25px rgba(0, 255, 0, 0.2);
  background: var(--base-bg-color) !important;
}

.theme-acid .node-card.snapped {
  background: var(--snapped-backdrop) !important;
  border-color: rgba(255, 255, 0, 0.8) !important;
  box-shadow: 
    0 0 20px rgba(255, 255, 0, 0.5), 
    inset 0 0 12px rgba(255, 0, 255, 0.2),
    0 0 35px rgba(0, 255, 0, 0.3),
    0 0 50px rgba(255, 255, 0, 0.2) !important;
}

.theme-acid .snapped .user-message {
  background: linear-gradient(135deg,
      rgba(255, 0, 255, 0.35),
      rgba(255, 255, 0, 0.2)) !important;
  border-color: rgba(255, 0, 255, 0.8) !important;
  box-shadow:
    0 4px 20px rgba(255, 0, 255, 0.5),
    inset 0 1px 0 rgba(255, 255, 0, 0.4),
    0 0 25px rgba(255, 0, 255, 0.4) !important;
}

.theme-acid .snapped .ai-message {
  background: linear-gradient(135deg,
      rgba(0, 255, 0, 0.35),
      rgba(255, 255, 0, 0.2)) !important;
  border-color: rgba(0, 255, 0, 0.8) !important;
  box-shadow:
    0 4px 20px rgba(0, 255, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 0, 0.4),
    0 0 25px rgba(0, 255, 0, 0.4) !important;
}

/* Fix acid theme text visibility */
.theme-acid .node-card .text-base-content {
  color: rgba(255, 255, 255, 0.95) !important;
  text-shadow: 0 0 10px rgba(255, 255, 0, 0.3);
}

.theme-acid .node-card .text-base-content\/60 {
  color: rgba(255, 255, 255, 0.7) !important;
  text-shadow: 0 0 8px rgba(0, 255, 0, 0.2);
}

.theme-acid .node-card span.text-lg {
  color: rgba(255, 255, 255, 0.95) !important;
  text-shadow: 0 0 12px rgba(255, 255, 0, 0.4);
}

.theme-acid .node-card input {
  background: rgba(30, 30, 30, 0.9) !important;
  color: rgba(255, 255, 255, 0.95) !important;
  border-color: rgba(255, 255, 0, 0.5) !important;
}

/* Make all icons in acid theme more visible */
.theme-acid .node-card svg {
  color: rgba(255, 255, 255, 0.8) !important;
  filter: drop-shadow(0 0 3px rgba(255, 255, 0, 0.5));
}

/* UPDATED: Mobile responsiveness for centered layout */
@media (max-width: 640px) {

  .user-message,
  .ai-message {
    max-width: 98% !important;
    padding: 0.75rem 1rem !important;
  }

  .message-container {
    width: 98% !important;
    padding: 0.75rem !important;
  }

  /* Adjust branch button positioning for mobile */
  .user-message .branch-btn {
    right: -2rem;
  }

  .ai-message .branch-btn {
    left: -2rem;
  }

  .branch-node.snapped {
    padding: 2rem 1rem 1rem;
  }

  .snapped-card {
    max-width: 98%;
  }
}

/* UPDATED: Ensure proper spacing in snapped mode */
.snapped-messages-container .message-container {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 0 1rem 0 !important;
  color: var(--node-text-color) !important;
}

.snapped-messages-container .user-message,
.snapped-messages-container .ai-message {
  max-width: 75% !important;
  margin: 0 auto !important;
  color: var(--node-text-color) !important;
}

/* Improved hover states and transitions */
.message-container {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* Add glassmorphism shadow effects for both message types */
.user-message {
  box-shadow:
    0 4px 16px var(--user-shadow-color),
    inset 0 1px 0 var(--user-highlight-color),
    0 1px 3px rgba(0, 0, 0, 0.1) !important;
}

.ai-message {
  box-shadow:
    0 4px 16px var(--ai-shadow-color),
    inset 0 1px 0 var(--ai-highlight-color),
    0 1px 3px rgba(0, 0, 0, 0.1) !important;
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