<template>
  <div 
    class="enhanced-infinite-canvas modern-drag-container" 
    :class="[
      'theme-' + currentTheme,
      { 
        'drag-over': isDragOver,
        'drag-active': isDragActive,
        'left-panel-open': sidePanelOpen,
        'right-panel-open': rightPanelOpen,
        'both-panels-open': sidePanelOpen && rightPanelOpen
      }
    ]"
    :style="{
      left: sidePanelOpen ? '40vw' : '0px',
      right: rightPanelOpen ? '40vw' : '0',
      top: '0',
      bottom: '0',
      zIndex: '30',
    }" 
    @dragenter.prevent="handleDragEnter" 
    @dragover.prevent="handleDragOver" 
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
    ref="canvasRef"
  >



    <!-- Enhanced Loading State -->
    <Transition name="fade" mode="out-in">
      <div v-if="chatStore.isLoading" class="canvas-loading-overlay">
        <div class="loading-container modern-loading">
          <div class="loading-spinner ultra-modern"></div>
          <h3 class="loading-title">Loading workspaces...</h3>
          <p class="loading-subtitle">Preparing your infinite canvas</p>
          <div class="loading-progress">
            <div class="progress-line" :style="{ width: loadingProgress + '%' }"></div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Enhanced Onboarding -->
    <Transition name="zoom-fade" mode="out-in">
      <div 
        v-if="workspaces.length === 0 && !chatStore.isLoading" 
        class="onboarding-container enhanced-onboarding"
        :class="{ 'drag-active': isDragOver }"
        @dragenter.prevent="handleDragEnter"
        @dragover.prevent="handleDragOver" 
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
      
        <div class="onboarding-content">
          <!-- Animated Welcome Header -->
          <div class="welcome-header">
            <div class="welcome-icon">
              <div class="icon-glow"></div>
              <Sparkles :size="48" />
            </div>
            <h1 class="welcome-title">Welcome to Tangent</h1>
            <p class="welcome-subtitle">Your infinite AI workspace awaits</p>
          </div>
          
          <!-- Enhanced Action Cards -->
          <div class="action-cards">
            <!-- Import Card with hover effects -->
            <div 
              class="action-card import-card"
              :class="{ 'drag-hover': isDragOver }"
            >
              <div class="card-glow"></div>
              <div class="card-content">
                <div class="card-icon">
                  <Upload :size="32" />
                </div>
                <h2>Import Conversations</h2>
                <p>Drop your ChatGPT or Claude export files here to transform them into visual workspaces</p>
                <div class="supported-formats">
                  <span class="format-tag">JSON</span>
                  <span class="format-tag">ChatGPT</span>
                  <span class="format-tag">Claude</span>
                </div>
              </div>
            </div>
          
          <!-- Create New Option -->
          <button @click="handleNewWorkspace" class="create-new-button group">
            <div class="create-new-inner">
              <div class="text-4xl mb-6 text-base-content/40 group-hover:text-primary transition-colors">
                ✨
              </div>
              <h2 class="text-2xl font-medium mb-4">Start Fresh</h2>
              <p class="text-base-content/60 mb-6">
                Create a new workspace and begin your AI conversations from scratch
              </p>
              <div class="text-sm text-primary/60 group-hover:text-primary transition-colors">
                Click to create
              </div>
            </div>
          </button>
          </div>
        </div>
      </div>
      
      <!-- Main Canvas -->
      <div v-else class="workspace-container">
      <Transition name="fade">
        <div v-if="notification.visible"
          class="fixed top-16 left-1/2 transform -translate-x-1/2 px-4 py-2 notification-toast rounded-lg shadow-lg z-50">
          {{ notification.message }}
        </div>
      </Transition>

      <!-- Enhanced Workspace Search Bar -->
      <Transition name="slide-down" appear>
        <WorkspaceSearchBar 
          v-if="isWorkspaceOverview" 
          v-model="searchQuery" 
          :view-mode="viewMode"
          :side-panel-open="sidePanelOpen"
          :right-panel-open="rightPanelOpen"
          :rag-panel-open="appStore.isRAGPanelOpen"
          @toggle-view="handleViewModeToggle" 
          class="workspace-search-bar enhanced-search-bar" 
        />
      </Transition>

      <!-- Grid View -->
      <transition name="fade" mode="out-in">
        <GridWorkspaceView v-if="isWorkspaceOverview" 
          ref="gridWorkspaceRef"
          :workspaces="filteredWorkspaces"
          :selected-workspace-id="selectedWorkspaceId" 
          :search-query="searchQuery"
          :external-controls="true"
          :current-view-mode="externalViewMode"
          :sort-by="externalSortBy"
          :card-size="externalCardSize"
          @select-workspace="handleWorkspaceSelect" 
          @favorite-workspace="handleWorkspaceFavorite"
          @duplicate-workspace="handleWorkspaceDuplicate" 
          @archive-workspace="handleWorkspaceArchive"
          @export-workspace="handleWorkspaceExport" 
          @delete-workspace="handleWorkspaceDelete"
          @import-completed="handleImportCompleted"
          @update-filter-state="handleFilterStateUpdate"
          @update-graph-stats="handleGraphStatsUpdate"
          @update-3d-support="handle3DSupportUpdate"
          @update-fullscreen="handleFullscreenUpdate"
          class="grid-view absolute inset-0" />
      </transition>

      <!-- Detailed Workspace View (when a workspace is selected) -->
      <div v-if="!isWorkspaceOverview" ref="canvasRef"
        class="absolute inset-0 transition-transform duration-500 ease-in-out overscroll-none touch-pan-y"
        @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseUp"
        @mousedown="handleCanvasMouseDown" @touchstart="handleTouchStart" @touchmove="handleTouchMove" tabindex="0"
        @keydown="handleKeyDown">
        
        <!-- Canvas Transform Container -->
        <div class="absolute transform-gpu" :style="transformStyle">
          <!-- SVG Layer for Connections -->
          <svg class="absolute overflow-visible" style="z-index: 0; pointer-events: none;" :style="svgStyle"
            preserveAspectRatio="none">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" class="fill-primary" />
              </marker>
            </defs>
            <template v-for="connection in visibleConnections" :key="`${connection.parent.id}-${connection.child.id}`">
              <SplineConnector :start-node="connection.parent" :end-node="connection.child"
                :card-width="getEffectiveCardDimensions(connection.child).width"
                :card-height="getEffectiveCardDimensions(connection.child).height"
                :start-card-width="getEffectiveCardDimensions(connection.parent).width"
                :start-card-height="getEffectiveCardDimensions(connection.parent).height"
                :end-lod-level="getEffectiveCardDimensions(connection.child).lodLevel"
                :start-lod-level="getEffectiveCardDimensions(connection.parent).lodLevel"
                :is-active="isConnectionActive(connection)" :zoom-level="zoom"
                :is-source-node-expanded="expandedNodes.has(connection.parent.id)" />
            </template>
          </svg>

          <!-- Nodes Layer -->
          <div class="absolute" :style="nodesLayerStyle" style="z-index: 1">
            <template v-for="node in visibleNodes" :key="node.id">
              <!-- Branch Node (handles text and media) -->
              <BranchNode v-if="node.type === 'branch' || node.type === 'main' || node.type === 'media'" :node="node"
                :is-selected="isNodeFocused(node.id)" :selected-model="selectedModel"
                :open-router-api-key="openRouterApiKey" :modelType="modelType" :zoom="zoom"                 :model-registry="modelRegistry" :is-side-panel-open="sidePanelOpen"
                :is-right-panel-open="rightPanelOpen" :supports-vision="isVisionModelSelected"
                @select="handleNodeSelect(node.id)" @drag-start="handleDragStart" @create-branch="handleCreateBranch"
                @update-title="store.updateNodeTitle" @resend="(userMessageIndex) =>
                  handleResend(node.id, userMessageIndex)
                " @delete="() => handleNodeDelete(node.id)"
                @update-messages="(messages) => store.updateNodeMessages(node.id, messages)" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning
                    ? 'transform 0.3s ease-out'
                    : 'none',
                }" />

              <!-- Web Node -->
              <WebBranchNode v-else-if="node.type === 'web'" :node="node" :is-selected="isNodeFocused(node.id)"
                :selected-model="selectedModel" :open-router-api-key="openRouterApiKey" :modelType="modelType"
                :zoom="zoom" :lod-level="getLODLevel(node.id)" :model-registry="modelRegistry"
                @select="handleNodeSelect(node.id)" @drag-start="handleDragStart" @create-branch="handleCreateBranch"
                @update-title="store.updateNodeTitle" @resend="(userMessageIndex) =>
                  handleResend(node.id, userMessageIndex)
                " @delete="() => handleNodeDelete(node.id)" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning
                    ? 'transform 0.3s ease-out'
                    : 'none',
                }" />

              <!-- Branch Node -->
              <BranchNode v-else :node="node" :is-selected="isNodeFocused(node.id)"
                :is-snapped="store.snappedNodeId === node.id" :selected-model="selectedModel"
                :open-router-api-key="openRouterApiKey" :modelType="modelType" :zoom="zoom"                 :model-registry="modelRegistry" :is-side-panel-open="sidePanelOpen"
                :is-right-panel-open="rightPanelOpen" :supports-vision="isVisionModelSelected"
                @select="handleNodeSelect(node.id)" @drag-start="handleDragStart" @create-branch="handleCreateBranch"
                @update-title="store.updateNodeTitle"
                @resend="(userMessageIndex) => handleResend(node.id, userMessageIndex)"
                @delete="() => handleNodeDelete(node.id)" @update-position="handleNodePositionUpdate"
                @snap="handleNodeSnap" @unsnap="handleNodeUnsnap" @focus-input="handleFocusInput"
                @expansion-change="handleNodeExpansionChange"
                @update-messages="(messages) => store.updateNodeMessages(node.id, messages)" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none',
                }" />
            </template>
          </div>

          <!-- Interaction Layer for Splines - On Top of Everything -->
          <svg class="absolute overflow-visible" style="z-index: 2; pointer-events: none;" :style="svgStyle"
            preserveAspectRatio="none">
            <template v-for="connection in visibleConnections"
              :key="`interaction-${connection.parent.id}-${connection.child.id}`">
              <!-- Clickable paths - show hitbox on hover -->
              <path :d="getSplinePath(connection.parent, connection.child, expandedNodes.has(connection.parent.id))"
                stroke="rgba(255, 255, 255, 0.2)" stroke-opacity="0" fill="none" :stroke-width="40"
                style="cursor: pointer; pointer-events: stroke; transition: stroke-opacity 0.2s ease;"
                class="spline-hitbox" @dblclick="handleSplineDoubleClick(connection)"
                @click="console.log('Interaction layer clicked!', connection)"
                @mouseenter="handleSplineHover(connection, true)" @mouseleave="handleSplineHover(connection, false)" />
            </template>
          </svg>
        </div>
      </div>
    </div>
    </Transition>

    <!-- File Drop Overlay -->
    <div v-show="isDraggingFile"
      class="absolute inset-0 file-drop-overlay backdrop-blur-sm flex items-center justify-center pointer-events-none z-50">
      <div class="text-2xl font-semibold file-drop-text">
        Drop media to create a new node
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  provide,
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  watch,
  PropType,
} from "vue";
import BranchNode from "./node/BranchNode.vue";
import emitter from '@/utils/eventBus'
import GridWorkspaceView from "../workspace/GridWorkspaceView.vue";
import WorkspaceSearchBar from "../workspace/WorkspaceSearchBar.vue";
import WebBranchNode from "./node/WebBranchNode.vue";
import SplineConnector from "./spline/MainSplineConnector.vue";
import { useCanvasStore } from "@/stores/canvasStore";
import { useChatStore } from "@/stores/chatStore";
import { useViewportObserver } from "@/composables/useViewportObserver";
import { useAppStore } from "@/stores/appStore";
import { useModelStore } from "@/stores/modelStore";
import { useThemeStore } from "@/stores/themeStore";
import type { ModelInfo } from '@/types/model';
import { Plus, Circle, LayoutGrid, Bot, MessageSquare, Download, Sparkles, Upload, ArrowRight } from "lucide-vue-next";
import { DotLottieVue } from '@lottiefiles/dotlottie-vue';

// Add near the top with other refs
const modelRegistry = ref(new Map<string, ModelInfo>());

const store = useCanvasStore();
const chatStore = useChatStore();
const modelStore = useModelStore();
const appStore = useAppStore();
const themeStore = useThemeStore();

// Theme computeds
const currentTheme = computed(() => themeStore.currentTheme);
const themeColors = computed(() => themeStore.currentThemeColors);

// Populate model registry with all available models
const updateModelRegistry = () => {
  modelRegistry.value.clear();

  // Add all available models from each provider to the registry
  const allModels = [
    ...modelStore.ollamaModels,
    ...modelStore.openRouterModels,
    ...modelStore.googleModels,
    ...modelStore.anthropicModels,
    ...modelStore.openaiModels
  ];

  allModels.forEach(model => {
    if (model && model.id) {
      modelRegistry.value.set(model.id, model);
    }
  });
};

// View modes and search
const viewMode = ref('grid'); // Only 'grid' mode now
const searchQuery = ref('');

// External workspace controls
const externalViewMode = ref('grid');
const externalSortBy = ref('recent');
const externalCardSize = ref(240);
const gridWorkspaceRef = ref(null);

// RTS perspective constants
const RTS_SCALE_Y = 0.6; // Vertical compression factor for RTS perspective
const perfTestPanel = ref(null);

// Props
const props = defineProps({
  selectedModel: {
    type: String,
    required: true,
    default: "",
  },
  openRouterApiKey: {
    type: String,
    required: true,
  },
  modelType: {
    type: String,
    required: true,
    default: "",
  },
  sidePanelOpen: {
    type: Boolean,
    required: true,
  },
  rightPanelOpen: {
    type: Boolean,
    default: false,
  },
  autoZoomEnabled: {
    type: Boolean,
    required: true,
  },
  zoom: {
    type: Number,
    required: true,
    default: 1,
  },
  gestureMode: {
    type: String as PropType<"scroll" | "zoom">,
    required: true,
    default: "scroll",
  },
  isHeightLocked: {
    type: Boolean,
    required: true,
    default: false,
  },
});

// Emits
const emit = defineEmits([
  "update:zoom",
  "update:autoZoomEnabled",
  "update:isHeightLocked",
  "workspace-opened",
  "snap",
  "unsnap",
  "update-filter-state",
  "update-graph-stats",
  "update-3d-support",
  "update-fullscreen"
]);

// Modify zoom ref to be computed
const zoom = computed({
  get: () => props.zoom,
  set: (value) => emit("update:zoom", value),
});

const targetZoom = 1.5;

// Watch for autoZoom changes
watch(
  () => props.autoZoomEnabled,
  (newValue) => {
    if (newValue) {
      autoFitNodes();
    }
  }
);

// Watch for zoom changes to clear focused LOD node
watch(
  () => props.zoom,
  (newZoom, oldZoom) => {
    // Clear focused LOD node when user manually zooms
    // but only if the zoom change is significant (not from clicking on the node)
    if (Math.abs(newZoom - oldZoom) > 0.01) {
      // Check if we're still above the full detail threshold
      if (newZoom <= 0.5) {
        // Handle low zoom level
      }
    }
  }
);

// State
const panX = ref(0);
const panY = ref(0);
const expandedNodes = ref(new Set());
const isPanning = ref(false);
const lastPanPosition = ref({ x: 0, y: 0 });
const focusedNodeId = ref(null);
// Node that's been clicked on for LOD focus

const focusedTopicId = ref<string | null>(null);
const isDraggingFile = ref(false);

provide('performanceTestingActive', false);

const lastActivityTimestamp = ref(Date.now());
const autoZoomEnabled = ref(true);
const isAutoZooming = ref(false);
const AUTO_CENTER_DELAY = 30000; // 30 seconds
const inactivityTimer = ref(null);

const isClusterVizFocused = ref(false);
const windowSize = ref({
  width: typeof window !== "undefined" ? window.innerWidth : 1920,
  height: typeof window !== "undefined" ? window.innerHeight : 1080,
});

// Workspace Dragging State
const workspaceDragState = ref({
  isDragging: false,
  activeId: null as string | null,
  offset: { x: 0, y: 0 },
});

const notification = ref({ visible: false, message: '' });

// Portal animation state
const isPortalHovered = ref(false);
const isPortalClicked = ref(false);
const isDragOver = ref(false);
const isDragActive = ref(false);
const loadingProgress = ref(0);
const canvasRef = ref<HTMLElement>();

// Generate cyclone lines
const cycloneLines = ref([]);
const sparkles = ref([]);

// Initialize portal animations
const initializePortalAnimations = () => {
  // Generate cyclone lines
  cycloneLines.value = Array.from({ length: 12 }, (_, i) => ({
    length: 40 + Math.random() * 20,
    x: 50 + Math.cos((i / 12) * Math.PI * 2) * 30,
    y: 50 + Math.sin((i / 12) * Math.PI * 2) * 30,
    rotation: (i / 12) * 360 + Math.random() * 30,
    delay: i * 100,
    duration: 2000 + Math.random() * 1000
  }));
  
  // Generate sparkles
  sparkles.value = Array.from({ length: 8 }, (_, i) => ({
    x: 20 + Math.random() * 60,
    y: 20 + Math.random() * 60,
    delay: Math.random() * 2000,
    duration: 1500 + Math.random() * 1000
  }));
};

// Zoom constants
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 2;
const ZOOM_SENSITIVITY = 0.005;
const PAN_SENSITIVITY = 1.0;

// Simple Undo/Redo system for deletions and moves
const undoStack = ref([]);
const redoStack = ref([]);
const maxUndoStackSize = 20;
const dragStartPosition = ref(null);

// Multi-select system
const selectedNodeIds = ref(new Set());
const isMultiDragging = ref(false);
const multiDragStartPositions = ref(new Map());

// Calculate max node count 
const maxNodeCount = computed(() => {
  if (!workspaces.value.length) return 1;
  return Math.max(...workspaces.value.map(w => w.nodeCount || 0), 1);
});


const isWorkspaceOverview = ref(true);
const expandingWorkspaceId = ref<string | null>(null);

// Initialize portal animations on component load
initializePortalAnimations();

const features = [
  {
    title: "🌳 Branch & Explore",
    description:
      "Create new conversation branches to explore different ideas and directions while maintaining context.",
  },
  {
    title: "🖼️ Rich Media",
    description:
      "Drag and drop images and files to discuss them with AI models or extract information.",
  },
  {
    title: "🤖 Multiple Models",
    description:
      "Switch between different AI models for varied capabilities and perspectives.",
  },
  {
    title: "💾 Save & Organize",
    description:
      "Create multiple workspaces to keep your projects and conversations organized.",
  },
];

// Workspace data for grid view - memoized for performance with large datasets
const workspaces = computed(() => {
  // Only include essential fields to reduce memory overhead
  return chatStore.chats.map((chat) => ({
    id: chat.id,
    title: chat.title || 'Untitled',
    nodeCount: chat.nodeCount || 0,
    lastUpdated: chat.updatedAt,
    x: chat.x || 0,
    y: chat.y || 0,
    isExpanding: expandingWorkspaceId.value === chat.id,
    tags: chat.tags || [],
    color: chat.color || '#ffffff',
    isFavorite: chat.isFavorite || false,
    status: chat.status || 'active',
    format: chat.format,
    isImported: chat.isImported || false
  }));
});

// Filtered workspaces based on search query
const filteredWorkspaces = computed(() => {
  if (!searchQuery.value) return workspaces.value;

  const query = searchQuery.value.toLowerCase();
  return workspaces.value.filter(workspace => {
    const title = (workspace.title || '').toLowerCase();
    const tags = workspace.tags ? workspace.tags.map(tag => tag.name.toLowerCase()) : [];

    return title.includes(query) || tags.some(tag => tag.includes(query));
  });
});

const isBrowser = typeof window !== "undefined";

const snappedNodeId = ref<string | null>(null);
const nodePositions = ref(new Map<string, { x: number; y: number }>());

const isFocusedMode = ref(true);
const rootNodeId = ref<string | null>(null);

// Helper Functions
const getNodeCenter = (node) => ({
  x: node.x + store.CARD_WIDTH / 2,
  y: node.y + store.CARD_HEIGHT / 2,
});

// LOD Level calculation based on zoom and node state
const getLODLevel = (nodeId: string) => {
  const isNodeSnapped = snappedNodeId.value === nodeId;
  const isNodeFocusedState = focusedNodeId.value === nodeId;
  
  // Always use full detail for snapped nodes
  if (isNodeSnapped) return 'full';
  
  // Use zoom level to determine LOD
  if (zoom.value >= 1.0) return 'full';
  if (zoom.value >= 0.5) return 'summary';
  if (zoom.value >= 0.2) return 'preview';
  return 'block';
};

// Calculate effective card dimensions based on LOD level and node type
const getEffectiveCardDimensions = (node: any) => {
  const lodLevel = getLODLevel(node.id);
  
  // Base dimensions
  let width = CARD_WIDTH; // 672px
  let height = CARD_HEIGHT; // 400px
  
  // Adjust dimensions based on LOD level
  switch (lodLevel) {
    case 'block':
      width = 120;
      height = 60;
      break;
    case 'preview':
      width = 480;
      height = 120;
      break;
    case 'summary':
      width = 560;
      height = 200;
      break;
    case 'full':
    default:
      width = CARD_WIDTH;
      height = CARD_HEIGHT;
      break;
  }
  
  // Adjust for specific node types
  if (node.type === 'web') {
    // Web nodes might be slightly different
    height *= 0.8;
  }
  
  return {
    width,
    height,
    lodLevel
  };
};

const getMediaUrl = (mediaContent) => {
  if (!mediaContent) return '';
  if (mediaContent.previewUrl) return mediaContent.previewUrl;
  if (mediaContent.media_id) return `http://127.0.0.1:5050/media/${mediaContent.media_id}`;
  return '';
};

// Generate concise title for image using vision model
const generateTitleFromDescription = async (description: string): Promise<string> => {
  try {
    // Use a text model to generate a concise title from the description
    const { routerService } = await import('@/services/routerService');
    const routingResult = await routerService.routeRequest({
      message: `Based on this image description, generate a concise title in 3-5 words: "${description}". Respond with only the title, no additional text.`,
      hasImages: false
    });

    if (!routingResult.model) {
      throw new Error('No text model available for title generation');
    }

    const response = await fetch('http://127.0.0.1:5050/api/ollama-proxy/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: routingResult.model.name || routingResult.model.id,
        prompt: `Based on this image description, generate a concise title in 3-5 words: "${description}". Respond with only the title, no additional text.`,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 20
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate title: ${response.status}`);
    }

    const result = await response.json();
    const title = result.response?.trim() || '';

    // Clean up the title - remove quotes and extra punctuation
    const cleanTitle = title.replace(/["']/g, '').replace(/\.$/, '').trim();

    console.log(`[InfiniteCanvas] Generated title: "${cleanTitle}"`);
    return cleanTitle || 'Untitled Image';

  } catch (error) {
    console.error('[InfiniteCanvas] Title generation error:', error);
    return 'Untitled Image'; // Fallback
  }
};

// Convert file to base64
const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const processMediaForNode = async (node, file) => {
  try {
    // FIRST: Create thumbnail immediately for instant UI feedback
    const mediaId = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const previewUrl = URL.createObjectURL(file);

    // Set media content immediately so thumbnail shows
    await store.updateNode(node.id, {
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

    console.log('[InfiniteCanvas] Media content saved to database');

    // Force a small delay to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 50));

    // Import auto-caption service, agent service, and router service
    const { autoCaptionService } = await import('@/services/autoCaptionService');
    const { agentService } = await import('@/services/agentService');
    const { routerService } = await import('@/services/routerService');

    // Check if we should use auto-captioning for images
    const settings = await autoCaptionService.getSettings();
    const shouldAutoCaption = settings.enabled &&
      file.type.startsWith('image/') &&
      settings.model &&
      settings.model.trim() !== '';

    console.log('[InfiniteCanvas] Processing options:', {
      autoCaptionEnabled: settings.enabled,
      selectedModel: settings.model,
      shouldAutoCaption
    });

    // Use router service to determine the best approach for image handling
    if (file.type.startsWith('image/')) {
      console.log('[InfiniteCanvas] Using router service for image handling');

      const routingResult = await routerService.routeRequest({
        message: 'Analyze this uploaded image',
        hasImages: true
      });

      console.log('[InfiniteCanvas] Router result:', routingResult);

      // If no vision model configured, show agent configurator
      if (!routingResult.model) {
        console.log('[InfiniteCanvas] No vision agent configured, showing configurator');
        await agentService.showAgentConfigurator('agents');

        // Update node with message about configuration needed
        await store.updateNode(node.id, {
          mediaContent: {
            ...node.mediaContent,
            analysis: 'Image uploaded. Configure a vision agent in the settings panel to enable automatic captioning.'
          },
          messages: [
            ...(node.messages || []),
            {
              role: 'assistant',
              content: 'I\'ve uploaded your image, but no vision agent is configured for automatic analysis. Please set up a vision agent in the settings panel (gear icon) to enable automatic image captioning.',
              timestamp: new Date().toISOString()
            }
          ],
          isProcessingMedia: false,
          isGeneratingTitle: false
        });
        return;
      }

      // Update settings to use the router-selected model
      const currentSettings = await autoCaptionService.getSettings();
      const updatedSettings = {
        ...currentSettings,
        enabled: true,
        model: routingResult.model.name || routingResult.model.id
      };

      console.log('[InfiniteCanvas] Using router-selected vision model:', routingResult.model.name);
    }

    if (shouldAutoCaption) {
      console.log('[InfiniteCanvas] Using auto-captioning service');

      // Update status
      node.mediaContent.analysis = 'Generating caption...';

      // Generate caption
      const result = await autoCaptionService.captionFile(file);

      if (result.success && result.caption) {
        // Update with successful caption
        const updatedMediaContent = {
          ...node.mediaContent,
          analysis: result.caption
        };

        const updatedMessages = [
          ...(node.messages || []),
          {
            role: 'assistant',
            content: result.caption,
            timestamp: new Date().toISOString()
          }
        ];

        console.log(`[InfiniteCanvas] Auto-caption generated in ${result.responseTime}ms`);
        console.log('[InfiniteCanvas] Updating node with caption:', result.caption.substring(0, 100) + '...');

        // Generate a concise title from the image description
        let conciseTitle = node.title;
        if (node.isGeneratingTitle) {
          try {
            conciseTitle = await generateTitleFromDescription(result.caption);
            console.log('[InfiniteCanvas] Generated title from description:', conciseTitle);
          } catch (error) {
            console.warn('[InfiniteCanvas] Title generation from description failed:', error);
          }
        }

        // Save updated content to database
        await store.updateNode(node.id, {
          mediaContent: updatedMediaContent,
          messages: updatedMessages,
          isProcessingMedia: false,
          isGeneratingTitle: false,
          title: conciseTitle,
          metadata: {
            ...node.metadata,
            mediaContent: updatedMediaContent
          }
        });
      } else {
        // Handle caption failure
        console.error(`[InfiniteCanvas] Auto-caption failed:`, result.error);

        const updatedMediaContent = {
          ...node.mediaContent,
          analysis: 'Caption generation failed'
        };

        const updatedMessages = [
          ...(node.messages || []),
          {
            role: 'assistant',
            content: `Image uploaded successfully, but automatic captioning failed: ${result.error}. You can still chat about this image.`,
            timestamp: new Date().toISOString()
          }
        ];

        // Save updated content to database
        await store.updateNode(node.id, {
          mediaContent: updatedMediaContent,
          messages: updatedMessages,
          isProcessingMedia: false,
          isGeneratingTitle: false,
          metadata: {
            ...node.metadata,
            mediaContent: updatedMediaContent
          }
        });
      }

      console.log('[InfiniteCanvas] Auto-caption complete, saved to database');
    } else {
      // No auto-captioning, just mark as ready
      await store.updateNode(node.id, {
        mediaContent: {
          ...node.mediaContent,
          analysis: 'Media uploaded successfully'
        },
        isProcessingMedia: false,
        isGeneratingTitle: false
      });
    }

  } catch (error) {
    console.error('[InfiniteCanvas] Media processing error:', error);

    await store.updateNode(node.id, {
      mediaContent: {
        ...node.mediaContent,
        analysis: `Processing failed: ${error.message}`
      },
      isProcessingMedia: false,
      isGeneratingTitle: false
    });
  }
};

// Vision capabilities computed property
const isVisionModelSelected = computed(() => {
  return modelStore.selectedModelCapabilities?.supportsVision || false;
});

// Enhanced computed styles with RTS perspective
const transformStyle = computed(() => {
  if (store.snappedNodeId !== null) {
    return {
      transform: "none",
      transformOrigin: "0 0",
      width: "100000px",
      height: "100000px",
      transition: "none",
    };
  }

  // Overview mode with RTS perspective adjustments
  if (isWorkspaceOverview.value) {
    return {
      transform: `translate(${panX.value}px, ${panY.value}px)`,
      transformOrigin: "0 0",
      transition: "transform 0.3s ease-out",
    };
  }

  // Regular mode: scale and translate
  return {
    transform: `scale(${zoom.value}) translate(${panX.value / zoom.value}px, ${panY.value / zoom.value}px)`,
    transformOrigin: "0 0",
    width: "100000px",
    height: "100000px",
    transition: store.isTransitioning ? "transform 0.3s ease-out" : "none",
  };
});

const svgStyle = computed(() => ({
  width: "100000px",
  height: "100000px",
  viewBox: "0 0 100000 100000", // Match the actual coordinate space of nodes
}));

const nodesLayerStyle = computed(() => ({
  width: "100000px",
  height: "100000px",
  left: 0,
  top: 0,
  pointerEvents: 'auto', // Allow pointer events for nodes always
}));

// Viewport culling for performance optimization
const VIEWPORT_BUFFER = 500; // Buffer zone around viewport in pixels
const CARD_WIDTH = 672; // Standard card width (42rem = 672px)
const CARD_HEIGHT = 400; // Estimated card height

// Initialize viewport observer for enhanced performance
const { observe, unobserve, isElementVisible, getVisibleElementIds } = useViewportObserver({
  rootMargin: `${VIEWPORT_BUFFER}px`,
  threshold: 0,
});

// Enhanced visibility tracking with intersection observer fallback
const intersectionVisibleNodes = ref(new Set<string>());

const visibleNodes = computed(() => {
  // Always show all nodes if snapped, in workspace overview, or during any drag/pan operations
  if (store.snappedNodeId !== null || isWorkspaceOverview.value || isPanning.value || store.isDragging || isMultiDragging.value || workspaceDragState.value.isDragging) {
    return store.nodes;
  }

  // Use intersection observer results if available and nodes are being observed
  if (intersectionVisibleNodes.value.size > 0) {
    return store.nodes.filter(node => intersectionVisibleNodes.value.has(node.id));
  }

  // Fallback to computational viewport culling with larger buffer to prevent disappearing
  const buffer = VIEWPORT_BUFFER * 2; // Double buffer for safety
  const viewportLeft = (-panX.value - buffer) / zoom.value;
  const viewportTop = (-panY.value - buffer) / zoom.value;
  const viewportRight = (windowSize.value.width - panX.value + buffer) / zoom.value;
  const viewportBottom = (windowSize.value.height - panY.value + buffer) / zoom.value;

  return store.nodes.filter(node => {
    const nodeLeft = node.x;
    const nodeTop = node.y;
    const nodeRight = node.x + CARD_WIDTH;
    const nodeBottom = node.y + CARD_HEIGHT;

    return !(nodeRight < viewportLeft || 
             nodeLeft > viewportRight || 
             nodeBottom < viewportTop || 
             nodeTop > viewportBottom);
  });
});

// Visible connections (only between visible nodes)
const visibleConnections = computed(() => {
  if (store.snappedNodeId !== null || isWorkspaceOverview.value) {
    return store.connections;
  }

  const visibleNodeIds = new Set(visibleNodes.value.map(node => node.id));
  return store.connections.filter(connection => 
    visibleNodeIds.has(connection.parent.id) || visibleNodeIds.has(connection.child.id)
  );
});

// Update intersection observer when nodes change
watch(
  () => store.nodes,
  (newNodes) => {
    // Update intersection observer for new nodes
    nextTick(() => {
      newNodes.forEach(node => {
        const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
        if (nodeElement && !intersectionVisibleNodes.value.has(node.id)) {
          observe(nodeElement, node.id);
        }
      });

      // Update visible nodes set from intersection observer
      const visibleIds = getVisibleElementIds();
      intersectionVisibleNodes.value = new Set(visibleIds.filter(id => 
        newNodes.some(node => node.id === id)
      ));
    });
  },
  { deep: true, immediate: true }
);

// Coordinate conversion helpers
const screenToWorld = (screenX, screenY) => {
  if (!canvasRef.value) return { x: 0, y: 0 };
  const rect = canvasRef.value.getBoundingClientRect();
  const worldX = (screenX - rect.left - panX.value) / zoom.value;
  const worldY = (screenY - rect.top - panY.value) / zoom.value;
  return { x: worldX, y: worldY };
};

const worldToScreen = (worldX, worldY) => {
  return {
    x: (worldX * zoom.value) + panX.value,
    y: (worldY * zoom.value) + panY.value
  };
};

// Multi-select helper functions
const findNodeAt = (screenX, screenY) => {
  if (!canvasRef.value) return null;

  // Get canvas bounds
  const canvasRect = canvasRef.value.getBoundingClientRect();

  // Convert to canvas coordinates accounting for pan and zoom
  const canvasX = screenX - canvasRect.left;
  const canvasY = screenY - canvasRect.top;

  // Check each node to see if click is within its bounds
  return store.nodes.find(node => {
    const nodeScreenX = (node.x * zoom.value) + panX.value;
    const nodeScreenY = (node.y * zoom.value) + panY.value;
    const nodeScreenWidth = store.CARD_WIDTH * zoom.value;
    const nodeScreenHeight = store.CARD_HEIGHT * zoom.value;

    return canvasX >= nodeScreenX &&
      canvasX <= nodeScreenX + nodeScreenWidth &&
      canvasY >= nodeScreenY &&
      canvasY <= nodeScreenY + nodeScreenHeight;
  });
};






// Undo/Redo Functions
const addToUndoStack = (action) => {
  undoStack.value.push(action);

  // Limit stack size
  if (undoStack.value.length > maxUndoStackSize) {
    undoStack.value.shift();
  }

  // Clear redo stack when new action is performed
  redoStack.value = [];
};

const undo = () => {
  if (undoStack.value.length === 0) {
    showNotification('Nothing to undo');
    return;
  }

  const lastAction = undoStack.value.pop();

  if (lastAction.type === 'delete_nodes') {
    // Restore the deleted nodes
    lastAction.deletedNodes.forEach(nodeData => {
      store.nodes.push(nodeData);
    });

    // Add to redo stack
    redoStack.value.push(lastAction);

    showNotification(`Restored ${lastAction.deletedNodes.length} deleted node(s)`);
  } else if (lastAction.type === 'move_node') {
    // Restore the node's previous position
    const node = store.nodes.find(n => n.id === lastAction.nodeId);
    if (node) {
      // Save current position for redo
      const currentPosition = { x: node.x, y: node.y };

      // Restore previous position
      store.updateNodePosition(lastAction.nodeId, lastAction.previousPosition);

      // Add to redo stack
      redoStack.value.push({
        type: 'move_node',
        nodeId: lastAction.nodeId,
        previousPosition: currentPosition,
        newPosition: lastAction.previousPosition,
        timestamp: Date.now()
      });

      showNotification('Undid node move');
    }
  } else if (lastAction.type === 'move_multiple_nodes') {
    // Restore multiple nodes' previous positions
    const currentPositions = [];

    lastAction.moves.forEach(move => {
      const node = store.nodes.find(n => n.id === move.nodeId);
      if (node) {
        // Save current position for redo
        currentPositions.push({
          nodeId: move.nodeId,
          previousPosition: { x: node.x, y: node.y },
          newPosition: move.previousPosition
        });

        // Restore previous position
        store.updateNodePosition(move.nodeId, move.previousPosition);
      }
    });

    // Add to redo stack
    redoStack.value.push({
      type: 'move_multiple_nodes',
      moves: currentPositions,
      timestamp: Date.now()
    });

    showNotification(`Undid move of ${lastAction.moves.length} nodes`);
  }
};

const redo = () => {
  if (redoStack.value.length === 0) {
    showNotification('Nothing to redo');
    return;
  }

  const actionToRedo = redoStack.value.pop();

  if (actionToRedo.type === 'delete_nodes') {
    // Re-delete the nodes
    actionToRedo.deletedNodes.forEach(nodeData => {
      const index = store.nodes.findIndex(n => n.id === nodeData.id);
      if (index !== -1) {
        store.nodes.splice(index, 1);
      }
    });

    // Add back to undo stack
    undoStack.value.push(actionToRedo);

    showNotification(`Re-deleted ${actionToRedo.deletedNodes.length} node(s)`);
  } else if (actionToRedo.type === 'move_node') {
    // Redo the node move
    const node = store.nodes.find(n => n.id === actionToRedo.nodeId);
    if (node) {
      // Save current position for undo
      const currentPosition = { x: node.x, y: node.y };

      // Move to the redo position
      store.updateNodePosition(actionToRedo.nodeId, actionToRedo.previousPosition);

      // Add back to undo stack
      undoStack.value.push({
        type: 'move_node',
        nodeId: actionToRedo.nodeId,
        previousPosition: currentPosition,
        newPosition: actionToRedo.previousPosition,
        timestamp: Date.now()
      });

      showNotification('Redid node move');
    }
  } else if (actionToRedo.type === 'move_multiple_nodes') {
    // Redo multiple node moves
    const currentPositions = [];

    actionToRedo.moves.forEach(move => {
      const node = store.nodes.find(n => n.id === move.nodeId);
      if (node) {
        // Save current position for undo
        currentPositions.push({
          nodeId: move.nodeId,
          previousPosition: { x: node.x, y: node.y },
          newPosition: move.previousPosition
        });

        // Move to redo position
        store.updateNodePosition(move.nodeId, move.previousPosition);
      }
    });

    // Add back to undo stack
    undoStack.value.push({
      type: 'move_multiple_nodes',
      moves: currentPositions,
      timestamp: Date.now()
    });

    showNotification(`Redid move of ${actionToRedo.moves.length} nodes`);
  }
};

// Node Deletion with Confirmation
const handleNodeDelete = async (nodeId: string) => {
  const node = store.nodes.find(n => n.id === nodeId);
  if (!node) return;

  // Find all descendant nodes that will be deleted
  const getDescendants = (parentId: string): string[] => {
    const children = store.nodes.filter(n => n.parentId === parentId);
    let descendants = children.map(c => c.id);

    for (const child of children) {
      descendants = descendants.concat(getDescendants(child.id));
    }

    return descendants;
  };

  const descendants = getDescendants(nodeId);
  const totalNodesToDelete = descendants.length + 1; // +1 for the node itself

  // Create confirmation message
  let confirmMessage = `Are you sure you want to delete this ${node.type === 'main' ? 'main' : 'branch'} node?`;
  if (descendants.length > 0) {
    confirmMessage += `\n\nThis will also permanently delete ${descendants.length} child branch${descendants.length === 1 ? '' : 'es'}.`;
  }
  confirmMessage += '\n\nThis action cannot be undone.';

  // Show confirmation dialog
  if (!confirm(confirmMessage)) {
    return;
  }

  // Save the nodes that will be deleted for undo
  const nodesToDelete = [node, ...descendants.map(id => store.nodes.find(n => n.id === id))].filter(Boolean);
  const deletedNodesData = nodesToDelete.map(n => JSON.parse(JSON.stringify(n)));

  // Add to undo stack before deleting
  addToUndoStack({
    type: 'delete_nodes',
    deletedNodes: deletedNodesData,
    timestamp: Date.now()
  });

  // Delete the node and all its descendants
  store.removeNode(nodeId);

  showNotification(`Deleted ${totalNodesToDelete} node${totalNodesToDelete === 1 ? '' : 's'} (Ctrl/Cmd+Z to undo)`);
};


// Create new workspace
const handleNewWorkspace = async () => {
  // Trigger portal animation
  isPortalClicked.value = true;
  
  // Reset after animation
  setTimeout(() => {
    isPortalClicked.value = false;
  }, 1000);
  
  if (store.snappedNodeId) {
    store.popSnappedNode()
  }
  await store.clearCurrentWorkspace();

  const newWorkspaceId = await store.createNewWorkspace();
  if (newWorkspaceId) {
    await chatStore.loadChats();
    await store.loadChatState(newWorkspaceId);

    const rootNodeId = store.nodes[0]?.id;
    if (rootNodeId) {
      nextTick(() => {
        centerAndSnapNode(rootNodeId);
      });
    }
  }
};

// Handle view mode toggle (simplified for grid-only)
const handleViewModeToggle = (mode) => {
  // Only grid mode supported now
  viewMode.value = 'grid';
};

// Center and snap to a node
const centerAndSnapNode = (nodeId: string) => {
  console.log('[InfiniteCanvas] centerAndSnapNode called for:', nodeId);
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) {
    console.log('[InfiniteCanvas] Node not found:', nodeId);
    return;
  }

  store.isTransitioning = true;

  const center = getNodeCenter(node);
  if (!canvasRef.value) {
    console.warn('[InfiniteCanvas] canvasRef is null, cannot center node');
    store.isTransitioning = false;
    return;
  }
  const rect = canvasRef.value.getBoundingClientRect();

  panX.value = rect.width / 2 - center.x * zoom.value;

  const verticalOffset = Math.min(rect.height * 0.05, 30);
  panY.value = rect.height / 2 - center.y * zoom.value + verticalOffset;

  focusedNodeId.value = nodeId;

  nextTick(() => {
    // Emit snap for all nodes that support snapping (including main nodes for auto-snap)
    emit('snap', { nodeId: node.id, originalPosition: { x: node.x, y: node.y } });

    setTimeout(() => {
      store.isTransitioning = false;
    }, 300);
  });
};

// Watch for side panel changes
watch(() => props.sidePanelOpen, (isOpen) => {
  setTimeout(() => {
    if (props.autoZoomEnabled) {
      autoFitNodes();
    }
  }, 300);
}, { immediate: false });

// Watch for right panel changes
watch(() => props.rightPanelOpen, (isOpen) => {
  setTimeout(() => {
    if (props.autoZoomEnabled) {
      autoFitNodes();
    }
  }, 300);
}, { immediate: false });

// Handle height lock for nodes
const handleHeightLock = () => {
  const selectedNode = store.nodes.find((n) => n.id === focusedNodeId.value);
  if (!selectedNode) return;

  const nodeElement = document.querySelector(
    `[data-node-id="${selectedNode.id}"]`
  );
  if (!nodeElement) return;

  const nodeRect = nodeElement.getBoundingClientRect();
  const canvasRect = canvasRef.value?.getBoundingClientRect();
  if (!canvasRect) return;

  const visibleTop = Math.max(0, canvasRect.top - nodeRect.top);
  const visibleBottom = Math.min(
    nodeRect.height,
    canvasRect.bottom - nodeRect.top
  );

  const visibleHeight = (visibleBottom - visibleTop) / zoom.value;
  const paddedHeight = visibleHeight - 32;

  store.setNodeHeightLock(selectedNode.id, paddedHeight);
  emit("update:isHeightLocked", true);
};

const showNotification = (message: string) => {
  notification.value = { visible: true, message };
  setTimeout(() => {
    notification.value.visible = false;
  }, 2000);
};

const handleHeightUnlock = () => {
  if (focusedNodeId.value) {
    store.clearNodeHeightLock(focusedNodeId.value);
  }
  emit("update:isHeightLocked", false);
};

// Handle node snapping
const handleNodeSnap = async ({ nodeId, originalPosition }) => {
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  // Don't trigger any auto-centering
  const prevAutoZoom = autoZoomEnabled.value;
  autoZoomEnabled.value = false;

  store.isTransitioning = true;
  store.snapNode(nodeId);
  nodePositions.value.set(nodeId, originalPosition);

  // Wait for the BranchNode component to handle its own snap animation
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Re-enable auto zoom after snapping is complete
  setTimeout(() => {
    store.isTransitioning = false;
    autoZoomEnabled.value = prevAutoZoom;
  }, 350);
};


// Handle node unsnapping
const handleNodeUnsnap = async ({ nodeId, originalPosition }) => {
  store.unsnapNode(nodeId);

  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  store.isTransitioning = true;

  const rect = canvasRef.value?.getBoundingClientRect();
  if (rect) {
    const nodeCenter = {
      x: node.x + store.CARD_WIDTH / 2,
      y: node.y + store.CARD_HEIGHT / 2,
    };

    const bounds = calculateNodeBounds(node);
    const newZoom = calculateRequiredZoom(bounds, rect);

    const verticalOffset = rect.height * 0.1;
    panX.value = rect.width / 2 - nodeCenter.x * newZoom;
    panY.value = rect.height / 2 - nodeCenter.y * newZoom + verticalOffset;
    zoom.value = newZoom;
  }

  store.updateNodePosition(nodeId, originalPosition);
  nodePositions.value.delete(nodeId);

  await new Promise((resolve) => setTimeout(resolve, 300));
  store.isTransitioning = false;
};

// Handle focus on a node's input
const handleFocusInput = ({ nodeId }) => {
  const branchNodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (!branchNodeEl) return;

  const inputEl = branchNodeEl.querySelector(".message-input");
  if (!inputEl) return;

  const inputRect = inputEl.getBoundingClientRect();
  const canvasRect = canvasRef.value.getBoundingClientRect();


  const inputCenterX = inputRect.left + inputRect.width / 2;
  const inputCenterY = inputRect.top + inputRect.height / 2;
  const canvasCenterX = canvasRect.width / 2;
  const canvasCenterY = canvasRect.height / 2;

  panX.value = canvasCenterX - (inputCenterX - canvasRect.left) * targetZoom;
  panY.value = canvasCenterY - (inputCenterY - canvasRect.top) * targetZoom;
  zoom.value = targetZoom;
};

// Workspace drag handling
const handleWorkspaceDragStart = (dragData) => {
  workspaceDragState.value.isDragging = true;
  workspaceDragState.value.activeId = dragData.id;
  workspaceDragState.value.offset = dragData.offset;
};

const selectedWorkspaceId = computed(() => {
  if (!isWorkspaceOverview.value) return null;
  return workspaceDragState.value.activeId || null;
});

// Calculate required zoom level for a node
const calculateRequiredZoom = (bounds, containerRect) => {
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  const zoomX = (containerRect.width * 0.85) / contentWidth;
  const zoomY = (containerRect.height * 0.8) / contentHeight;

  return Math.min(Math.max(Math.min(zoomX, zoomY), ZOOM_MIN), ZOOM_MAX);
};

// Handle node selection
const handleNodeSelect = async (nodeId: string) => {
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  if (store.snappedNodeId === nodeId) {
    focusedNodeId.value = nodeId;
    return;
  }

  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  // Focus and center on the node
  store.isTransitioning = true;
  focusedNodeId.value = nodeId;
  
  await nextTick();
  
  const bounds = calculateNodeBounds(node);
  const newZoom = calculateRequiredZoom(bounds, rect);

  const nodeCenterX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
  const nodeCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2;

  const verticalOffset = Math.min(rect.height * 0.05, 30);
  panX.value = rect.width / 2 - nodeCenterX * newZoom;
  panY.value = rect.height / 2 - nodeCenterY * newZoom + verticalOffset;

  zoom.value = newZoom;

  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
};

// Calculate node bounds
const calculateNodeBounds = (node) => {
  if (!node) {
    if (!store.nodes.length) return null;

    return store.nodes.reduce(
      (acc, node) => {
        const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
        if (!nodeElement) return acc;

        const nodeRect = nodeElement.getBoundingClientRect();
        const actualHeight = nodeRect.height / zoom.value;

        return {
          minX: Math.min(acc.minX, node.x),
          maxX: Math.max(acc.maxX, node.x + store.CARD_WIDTH),
          minY: Math.min(acc.minY, node.y),
          maxY: Math.max(acc.maxY, node.y + actualHeight),
        };
      },
      {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
      }
    );
  }

  const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
  if (!nodeElement) {
    return {
      minX: node.x,
      maxX: node.x + store.CARD_WIDTH,
      minY: node.y,
      maxY: node.y + store.CARD_HEIGHT + 100,
    };
  }

  const nodeRect = nodeElement.getBoundingClientRect();
  const actualHeight = nodeRect.height / zoom.value;

  return {
    minX: node.x,
    maxX: node.x + store.CARD_WIDTH,
    minY: node.y,
    maxY: node.y + (actualHeight * 1.1),
  };
};

// Handle node position updates
const handleNodePositionUpdate = (
  nodeId: string,
  position: { x: number; y: number }
) => {
  store.updateNodePosition(nodeId, position);
};

const handleWheel = (e: WheelEvent) => {
  // Check if the wheel event is from a messages scroll container
  const messagesContainer = (e.target as HTMLElement).closest('.messages-scroll-container');
  if (messagesContainer) {
    // Check if this is a canvas gesture (zoom with CMD/Ctrl)
    const isCanvasGesture = e.metaKey || e.ctrlKey;
    if (!isCanvasGesture) {
      // Regular scrolling in messages container - don't handle it
      return;
    }
  }

  if ((e.target as HTMLElement).closest(".branch-node.snapped")) {
    // Allow scrolling within message containers when node is snapped
    const target = e.target as HTMLElement;
    const isMessageScrollContainer = target.closest(".messages-scroll-container");
    const isMessageContainer = target.closest(".message-container");
    const isMessageContent = target.closest(".message-content");
    
    if (isMessageScrollContainer || isMessageContainer || isMessageContent) {
      // Let the message container handle its own scrolling
      return;
    }
    console.log("Snapped node, ignoring wheel event");
    return;
  }

  // Disable zoom/pan/scroll in overview mode
  if (isWorkspaceOverview.value) {
    e.preventDefault();
    return;
  }

  e.preventDefault();
  resetInactivityTimer();

  // Using global constants

  const rect = canvasRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const contentX = (mouseX - panX.value) / zoom.value;
  const contentY = (mouseY - panY.value) / zoom.value;

  // Detect trackpad gesture type based on gestureMode setting and CMD key
  const cmdPressed = e.metaKey || e.ctrlKey; // CMD on Mac, Ctrl on PC

  // When gestureMode is 'zoom': 2-finger = zoom, CMD+2-finger = pan
  // When gestureMode is 'scroll': 2-finger = pan, CMD+2-finger = zoom  
  const shouldZoom = props.gestureMode === 'zoom' ? !cmdPressed : cmdPressed;
  const shouldPan = !shouldZoom && (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0);

  if (shouldZoom) {
    // Handle zoom
    const zoomDelta = -e.deltaY * ZOOM_SENSITIVITY;
    const newZoom = Math.min(
      Math.max(zoom.value * (1 + zoomDelta), ZOOM_MIN),
      ZOOM_MAX
    );

    // Zoom towards mouse cursor
    panX.value = mouseX - contentX * newZoom;
    panY.value = mouseY - contentY * newZoom;
    zoom.value = newZoom;
  } else if (shouldPan) {
    // Handle pan with 2-finger trackpad gesture
    panX.value -= e.deltaX * PAN_SENSITIVITY;
    panY.value -= e.deltaY * PAN_SENSITIVITY;
  }
};

// Center canvas
const centerCanvas = () => {
  if (!isWorkspaceOverview) {
    zoom.value = 1;
    targetZoom.value = 1;
    panX.value = 0;
    panY.value = 0;
  }
};

const isInitializing = ref(false);

// Cleanup on component unmount
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("dragenter", handleDragEnter);
  window.removeEventListener("dragleave", handleDragLeave);
  window.removeEventListener("resize", () => {
    windowSize.value.width = window.innerWidth;
    windowSize.value.height = window.innerHeight;
  });

  if (canvasRef.value) {
    canvasRef.value.removeEventListener("wheel", handleWheel);
  }
  if (inactivityTimer.value) {
    clearTimeout(inactivityTimer.value);
  }
});

// Watch for node changes
watch(
  () => store.nodes.length,
  () => {
    resetInactivityTimer();
  }
);

watch(
  () => store.nodes.length,
  (newLength, oldLength) => {
    if (newLength === 1 && oldLength === 0) {
      rootNodeId.value = store.nodes[0].id;
    }
  }
);


// Watch for window size changes
watch(
  () => [windowSize.value.width, windowSize.value.height],
  () => {
    if (props.autoZoomEnabled && !store.isDragging && !isPanning.value) {
      autoFitNodes();
    }
  },
  { deep: true }
);

// Watch for model changes and update registry
watch(
  () => [
    modelStore.ollamaModels,
    modelStore.openRouterModels,
    modelStore.googleModels,
    modelStore.anthropicModels,
    modelStore.openaiModels
  ],
  () => {
    updateModelRegistry();
  },
  { deep: true }
);

// Handle file drag events
const handleDragEnter = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  if (!isWorkspaceOverview.value && e.dataTransfer?.items?.length === 1) {
    const item = e.dataTransfer.items[0];
    if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/'))) {
      isDraggingFile.value = true;
      isDragActive.value = true;
      console.log('Drag enter with media file');
    }
  }
  
  // Handle conversation imports on onboarding
  if (workspaces.value.length === 0) {
    isDragOver.value = true;
    isDragActive.value = true;
  }
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  const rect = e.currentTarget?.getBoundingClientRect();
  if (rect) {
    const { clientX, clientY } = e;
    if (clientX <= rect.left || clientX >= rect.right ||
      clientY <= rect.top || clientY >= rect.bottom) {
      isDraggingFile.value = false;
      isDragActive.value = false;
      // Also handle conversation import drag leave
      if (workspaces.value.length === 0) {
        isDragOver.value = false;
      }
    }
  }
};

const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  // Handle conversation imports on onboarding screen (when no workspaces exist)
  if (workspaces.value.length === 0) {
    isDragOver.value = false;
    isDragActive.value = false;
    
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    // Import the conversation files
    try {
      const { conversationImportService } = await import('@/services/conversationImportService');
      
      // Set up status monitoring to refresh workspace list when first workspace is imported
      let hasImportedFirstWorkspace = false;
      const statusUnsubscribe = conversationImportService.onStatusUpdate(async (status) => {
        // When the first workspace is imported, immediately refresh the workspace list
        if (!hasImportedFirstWorkspace && status.imported_conversations > 0) {
          hasImportedFirstWorkspace = true;
          console.log('First workspace imported, refreshing workspace list...');
          await chatStore.loadChats();
          // The UI should now automatically update to show GridWorkspaceView since workspaces.length > 0
        }
        
        // When import is completely finished, do a final refresh
        if (!status.is_running && status.imported_conversations > 0) {
          console.log('Import completed, doing final workspace refresh...');
          await chatStore.loadChats();
          statusUnsubscribe(); // Clean up the status listener
          
          // Note: Clustering is now automatically triggered during the import process
          console.log('Import and clustering process completed');
        }
      });
      
      for (const file of Array.from(files)) {
        if (file.name.endsWith('.json') || file.name.endsWith('.zip')) {
          console.log('Importing file:', file.name);
          await conversationImportService.importFile(file);
          
          // Show success notification
          showNotification(`Successfully imported ${file.name}`);
        } else {
          showNotification(`Unsupported file type: ${file.name}`, 'error');
        }
      }
    } catch (error) {
      console.error('Import failed:', error);
      showNotification('Import failed. Please try again.', 'error');
    }
    return;
  }

  if (isWorkspaceOverview.value) {
    return;
  }

  isDraggingFile.value = false;

  // Check if the drop target is a node element (not empty canvas)
  const dropTarget = e.target as HTMLElement;
  const isDropOnNode = dropTarget?.closest('.branch-node') !== null;

  if (isDropOnNode) {
    console.log('Drop on node detected, letting BranchNode handle it');
    return;
  }

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    return;
  }

  // Create a new node when dropping on empty canvas
  console.log('Media file dropped on empty canvas - creating new node');

  await nextTick(async () => {
    try {
      const rect = canvasRef.value?.getBoundingClientRect();
      if (!rect) throw new Error("Canvas reference not found");

      const position = {
        x: (e.clientX - rect.left - panX.value) / zoom.value,
        y: (e.clientY - rect.top - panY.value) / zoom.value,
      };

      // Create a new branch node immediately with filename as temporary title
      const newNode = await store.addNode(null, -1, position, {
        type: "branch",
        title: file.name,
        isProcessingMedia: true,
        isGeneratingTitle: true
      });

      // Wait a moment to ensure the node ID has been updated by the database
      await new Promise(resolve => setTimeout(resolve, 200));

      // Process the media using the existing function
      await processMediaForNode(newNode, file);

      centerOnNode(newNode.id);
    } catch (error) {
      console.error("Error handling media drop:", error);
      alert(error instanceof Error ? error.message : "Unknown error occurred");
    }
  });
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "copy";
  }
  
  // Handle conversation imports on onboarding
  if (workspaces.value.length === 0) {
    isDragOver.value = true;
  }
};

const returnToOverview = async () => {
  console.log("Returning to overview");

  const currentScale = zoom.value;
  const currentPanX = panX.value;
  const currentPanY = panY.value;

  // Remove any existing overlays first
  const existingOverlays = document.querySelectorAll('.overview-transition-overlay');
  existingOverlays.forEach(existing => {
    try {
      if (existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    } catch (error) {
      console.warn('Failed to remove existing overlay:', error);
    }
  });

  const overlay = document.createElement('div');
  overlay.className = 'overview-transition-overlay';
  document.body.appendChild(overlay);

  store.isTransitioning = true;

  zoom.value = currentScale * 0.8;

  document.body.classList.add('transition-blur');

  setTimeout(async () => {
    zoom.value = 1;
    panX.value = 0;
    panY.value = 0;
    expandingWorkspaceId.value = null;

    isWorkspaceOverview.value = true;
    store.clearCurrentWorkspace();

    await chatStore.loadChats();
    await nextTick();

    const workspaceElements = document.querySelectorAll('.grid-workspace-card');
    workspaceElements.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.8) translateY(20px)';
      el.style.transition = 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transitionDelay = `${i * 0.05}s`;

      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'scale(1) translateY(0)';
      }, 50);
    });

    resetWorkspacePhysics();

    setTimeout(() => {
      document.body.classList.remove('transition-blur');
      // Safely remove overlay with error handling
      try {
        if (overlay && overlay.parentNode) {
          document.body.removeChild(overlay);
        }
      } catch (error) {
        console.warn('Failed to remove transition overlay:', error);
      }
      store.isTransitioning = false;
    }, 500);
  }, 300);
};

const handleWorkspaceSelect = async (workspaceId: string) => {
  console.log('Selecting workspace:', workspaceId);

  store.isTransitioning = false;
  expandingWorkspaceId.value = workspaceId;

  const workspaceNode = document.querySelector(`[data-workspace-id="${workspaceId}"]`);
  if (!workspaceNode) {
    console.warn(`Could not find workspace node with id ${workspaceId}`);
    isWorkspaceOverview.value = false;
    await store.loadChatState(workspaceId);
    expandedNodes.value = new Set(store.nodes.map(node => node.id));
    await nextTick();

    // Check for auto-snapping after workspace loads
    const autoSnapped = checkAndAutoSnapSingleBranch();
    
    // Auto-fit nodes if we didn't auto-snap
    if (!autoSnapped) {
      autoFitNodes();
    }
    return;
  }

  const rect = workspaceNode.getBoundingClientRect();
  if (!rect) return;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const startPosition = {
    x: panX.value,
    y: panY.value,
    scale: zoom.value
  };

  store.isTransitioning = true;

  isWorkspaceOverview.value = false;

  await store.loadChatState(workspaceId);
  expandedNodes.value = new Set(store.nodes.map(node => node.id));

  await nextTick();

  zoom.value = 1;
  panX.value = centerX - rect.width / 2;
  panY.value = centerY - rect.height / 2;

  await nextTick();

  // Check for auto-snapping before autoFitNodes
  const autoSnapped = checkAndAutoSnapSingleBranch();

  // Always auto-fit when entering canvas
  if (autoSnapped) {
    // Delay autofit slightly if auto-snapping occurred to let snapping complete
    setTimeout(() => autoFitNodes(), 100);
  } else {
    autoFitNodes();
  }

  emitter.emit('workspace-opened');

  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
};

const handleWorkspaceFavorite = async (workspaceId: string) => {
  const workspace = chatStore.chats.find(chat => chat.id === workspaceId);
  if (workspace) {
    await chatStore.updateChatMetadata(workspaceId, {
      isFavorite: !workspace.isFavorite
    });
    await chatStore.loadChats();
  }
};

const handleWorkspaceDuplicate = async (workspaceId: string) => {
  await chatStore.duplicateChat(workspaceId);
  await chatStore.loadChats();
  autoFitNodes();
};

const handleWorkspaceArchive = (workspaceId: string) => {
  const workspace = chatStore.chats.find(chat => chat.id === workspaceId);
  if (workspace) {
    const newStatus = workspace.status === 'archived' ? 'active' : 'archived';
    chatStore.updateChatMetadata(workspaceId, { status: newStatus });
  }
};

const handleWorkspaceExport = (workspaceId: string) => {
  alert(`Exporting workspace: ${workspaceId}`);
};

const handleWorkspaceDelete = async (workspaceId: string) => {
  if (confirm("Are you sure you want to delete this workspace?")) {
    await chatStore.deleteChat(workspaceId);
    await chatStore.loadChats();
    autoFitNodes();
  }
};

const handleImportCompleted = async (importResult: { imported: number; skipped: number }) => {
  console.log(`Import completed: ${importResult.imported} imported, ${importResult.skipped} skipped`);
  
  // Refresh the chat list to show newly imported workspaces
  await chatStore.loadChats();
  
  // Show notification
  showNotification(`Successfully imported ${importResult.imported} conversation${importResult.imported !== 1 ? 's' : ''}!`);
  
  // Auto-fit to show all workspaces including new ones
  await nextTick();
  autoFitNodes();
};

const getImportIcon = (format: string) => {
  switch (format) {
    case 'chatgpt': return Bot;
    case 'claude': return MessageSquare;
    default: return Download;
  }
};

const getImportLabel = (format: string) => {
  switch (format) {
    case 'chatgpt': return 'ChatGPT Import';
    case 'claude': return 'Claude Import';
    default: return 'Imported';
  }
};

// Center on a specific node
const centerOnNode = (nodeId) => {
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  store.isTransitioning = true;
  const center = getNodeCenter(node);

  const rect = canvasRef.value.getBoundingClientRect();

  // If zoom is too low for full detail, zoom in to spotlight the node
  if (zoom.value < 0.5) {
    // Zoom to just above the threshold
    const targetZoom = 0.6;
    panX.value = rect.width / 2 - center.x * targetZoom;
    const verticalOffset = Math.min(rect.height * 0.05, 30);
    panY.value = rect.height / 2 - center.y * targetZoom + verticalOffset;
    zoom.value = targetZoom;
  } else {
    panX.value = rect.width / 2 - center.x * zoom.value;
    const verticalOffset = Math.min(rect.height * 0.05, 30);
    panY.value = rect.height / 2 - center.y * zoom.value + verticalOffset;
  }

  focusedNodeId.value = nodeId;

  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
};

// Check if workspace has only one branch node and auto-snap it
const checkAndAutoSnapSingleBranch = () => {
  console.log('[InfiniteCanvas] Checking for auto-snap condition');

  if (!store.nodes || store.nodes.length === 0) {
    console.log('[InfiniteCanvas] No nodes found, skipping auto-snap');
    return false;
  }

  // Don't auto-snap if something is already snapped
  if (store.snappedNodeId) {
    console.log('[InfiniteCanvas] Node already snapped, skipping auto-snap:', store.snappedNodeId);
    return false;
  }

  // Don't auto-snap if we're in overview mode
  if (isWorkspaceOverview.value) {
    console.log('[InfiniteCanvas] In overview mode, skipping auto-snap');
    return false;
  }

  console.log('[InfiniteCanvas] Found nodes:', {
    total: store.nodes.length,
    nodeTypes: store.nodes.map(n => ({ id: n.id, type: n.type, parentId: n.parentId }))
  });

  // Auto-snap if there's exactly one node total (only the main node)
  if (store.nodes.length === 1 && store.nodes[0].type === 'main') {
    const mainNode = store.nodes[0];
    console.log('[InfiniteCanvas] Auto-snapping single main node:', mainNode.id);

    // Use nextTick to ensure DOM is ready before snapping
    nextTick(() => {
      setTimeout(() => {
        // Tell the BranchNode to toggle snap using event bus
        emitter.emit('auto-snap-node', { nodeId: mainNode.id });
      }, 500); // Small delay to ensure workspace transition is complete
    });

    return true;
  }

  console.log('[InfiniteCanvas] Auto-snap condition not met - found', store.nodes.length, 'total nodes');
  return false;
};

// Handle branch creation
const handleCreateBranch = async (
  parentId: string,
  messageIndex: number,
  position: { x: number; y: number },
  initialData: any
) => {
  isFocusedMode.value = false;

  // Step 1: Check if any node is currently snapped and unsnap it first
  if (store.snappedNodeId) {
    console.log('[InfiniteCanvas] Unsnapping current node before creating branch:', store.snappedNodeId);

    // Unsnap the current node using event bus
    emitter.emit('auto-snap-node', { nodeId: store.snappedNodeId });

    // Wait for unsnap animation to complete
    await new Promise(resolve => setTimeout(resolve, 450));
  }

  const parentNode = store.nodes.find((n) => n.id === parentId);
  if (!parentNode) return;

  const existingBranches = store.nodes.filter((n) => n.parentId === parentId);
  const verticalOffset = existingBranches.length * (store.CARD_HEIGHT + 20);

  const adjustedPosition = {
    x: position.x,
    y: parentNode.y + verticalOffset,
  };

  // Extract the first user message for title generation
  // This could be from the initial data or the most recent message
  let firstUserMessage = '';

  if (initialData?.userMessage) {
    firstUserMessage = initialData.userMessage;
  } else if (parentNode.messages && parentNode.messages.length > 0) {
    // Get the user message at the branch point
    const branchMessage = parentNode.messages[messageIndex];
    if (branchMessage && branchMessage.role === 'user') {
      firstUserMessage = branchMessage.content;
    } else {
      // Find the most recent user message
      for (let i = messageIndex; i >= 0; i--) {
        const msg = parentNode.messages[i];
        if (msg && msg.role === 'user') {
          firstUserMessage = msg.content;
          break;
        }
      }
    }
  }

  // Step 2: Create the branch node with title generation enabled
  const newNode = await store.addNode(parentId, messageIndex, adjustedPosition, {
    ...initialData,
    y: adjustedPosition.y,
  }, {
    generateTitle: true,
    firstUserMessage: firstUserMessage
  });

  console.log('[InfiniteCanvas] Created new branch node:', newNode.id, 'at position:', adjustedPosition);

  // Ensure the new node is immediately visible by forcing a visibility update
  intersectionVisibleNodes.value.add(newNode.id);

  // Step 3: Center on the new node immediately
  await nextTick(); // Wait for DOM update
  centerOnNode(newNode.id);

  // Step 4: Snap the new branch node
  setTimeout(() => {
    console.log('[InfiniteCanvas] Auto-snapping new branch node:', newNode.id);
    emitter.emit('auto-snap-node', { nodeId: newNode.id });
  }, 600); // Increased timeout to ensure centering completes
};

// Handle resending messages
const handleResend = async (nodeId: string, userMessageIndex: number) => {
  const node = store.nodes.find(n => n.id === nodeId);
  if (!node || !node.messages) return;

  const userMsg = node.messages[userMessageIndex];
  if (!userMsg || userMsg.role !== "user") return;

  store.removeMessage(nodeId, userMessageIndex + 1);

  const modelInfo: ModelInfo = {
    id: props.selectedModel,
    name: props.selectedModel,
    source: props.modelType as 'ollama' | 'openrouter' | 'google' | 'anthropic' | 'openai'
  };

  await store.sendMessage(
    nodeId,
    userMsg.content,
    modelInfo,
    props.openRouterApiKey,
    false
  );
};

// Shared function to calculate spline path - used by both visual and interaction layers
const calculateSplinePath = (startNode: any, endNode: any, isExpanded: boolean) => {
  // Use exact same variables as MainSplineConnector
  const startNodeX = startNode.x;
  const startNodeY = startNode.y;
  const endNodeX = endNode.x;
  const endNodeY = endNode.y;
  
  const endDimensions = getEffectiveCardDimensions(endNode);
  const startDimensions = getEffectiveCardDimensions(startNode);
  const endCardWidth = endDimensions.width;
  const endCardHeight = endDimensions.height;
  const startCardWidth = startDimensions.width;
  const startCardHeight = startDimensions.height;
  
  const isLeft = endNode.type === 'left-branch';
  const isSourceExpanded = isExpanded;
  
  const idx = endNode.branchMessageIndex ?? 0;
  
  // EXACT yOff calculation as MainSplineConnector
  let yOff;
  switch (startDimensions.lodLevel) {
    case 'block':
      yOff = isSourceExpanded ? Math.min(idx * 15 + 8, startCardHeight / 2) : startCardHeight / 2;
      break;
    case 'summary':
      yOff = isSourceExpanded ? Math.min(idx * 30 + 15, startCardHeight / 2) : startCardHeight / 2;
      break;
    case 'full':
    default:
      yOff = isSourceExpanded ? idx * 120 + 40 : 40;
      break;
  }

  // EXACT startPoint and endPoint calculation as MainSplineConnector
  const startPoint = {
    x: isLeft ? startNodeX - 1 : startNodeX + startCardWidth + 1,
    y: startNodeY + Math.min(yOff, startCardHeight - 10)
  };

  const endPoint = {
    x: endNodeX + (isLeft ? endCardWidth - 1 : 1), // Stop 1px before the edge
    y: endNodeY + endCardHeight / 2
  };

  // EXACT pathAndControlPoints calculation as MainSplineConnector
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const dist = Math.hypot(dx, dy);
  
  const cpDist = Math.min(dist * 0.5, 300);
  const vert = Math.min(Math.abs(dy) * 0.2, 60) * (dy < 0 ? -1 : 1);

  const controlPoint1 = {
    x: startPoint.x + (isLeft ? -cpDist : cpDist),
    y: startPoint.y + vert * 0.5
  };
  const controlPoint2 = {
    x: endPoint.x + (isLeft ? cpDist * 0.6 : -cpDist * 0.6),
    y: endPoint.y - vert * 0.5
  };

  return `M${startPoint.x.toFixed(1)},${startPoint.y.toFixed(1)}C${controlPoint1.x.toFixed(1)},${controlPoint1.y.toFixed(1)},${controlPoint2.x.toFixed(1)},${controlPoint2.y.toFixed(1)},${endPoint.x.toFixed(1)},${endPoint.y.toFixed(1)}`;
};

// Use the shared function for interaction layer
const getSplinePath = calculateSplinePath;

// Handle spline double-click from interaction layer
const handleSplineDoubleClick = (connection: any) => {
  console.log('Spline double-clicked from interaction layer!', connection);
  // Emit an event that the SplineConnector can listen to
  emitter.emit('spline-double-click', {
    parentId: connection.parent.id,
    childId: connection.child.id
  });
};

// Handle spline hover from interaction layer
const handleSplineHover = (connection: any, isHovering: boolean) => {
  // Emit hover event that SplineConnector can listen to
  emitter.emit('spline-hover', {
    parentId: connection.parent.id,
    childId: connection.child.id,
    isHovering: isHovering
  });
};

// Mouse event handlers
const handleMouseUp = () => {
  if (workspaceDragState.value.isDragging) {
    const { activeId } = workspaceDragState.value;
    if (activeId) {
      const workspace = chatStore.chats.find((chat) => chat.id === activeId);
      if (workspace) {
        chatStore.updateChatMetadata(activeId, {
          x: workspace.x,
          y: workspace.y,
        });
      }
    }
  }

  workspaceDragState.value = {
    isDragging: false,
    activeId: null,
    offset: { x: 0, y: 0 },
  };


  // Handle multi-drag completion
  if (isMultiDragging.value) {
    isMultiDragging.value = false;

    // Save multi-node move to undo stack
    const moveActions = [];
    selectedNodeIds.value.forEach(nodeId => {
      const node = store.nodes.find(n => n.id === nodeId);
      const startPos = multiDragStartPositions.value.get(nodeId);
      if (node && startPos) {
        const finalPosition = { x: node.x, y: node.y };

        // Only save if node actually moved
        if (startPos.x !== finalPosition.x || startPos.y !== finalPosition.y) {
          moveActions.push({
            nodeId,
            previousPosition: startPos,
            newPosition: finalPosition
          });
        }
      }
    });

    if (moveActions.length > 0) {
      addToUndoStack({
        type: 'move_multiple_nodes',
        moves: moveActions,
        timestamp: Date.now()
      });
    }

    multiDragStartPositions.value.clear();
  }

  // Check if a single node was being dragged and save to undo stack
  if (store.isDragging && store.activeNode && dragStartPosition.value) {
    const draggedNode = store.nodes.find(n => n.id === store.activeNode);
    if (draggedNode) {
      const finalPosition = { x: draggedNode.x, y: draggedNode.y };
      const startPosition = { x: dragStartPosition.value.x, y: dragStartPosition.value.y };

      // Only add to undo stack if the node actually moved
      if (startPosition.x !== finalPosition.x || startPosition.y !== finalPosition.y) {
        addToUndoStack({
          type: 'move_node',
          nodeId: store.activeNode,
          previousPosition: startPosition,
          newPosition: finalPosition,
          timestamp: Date.now()
        });
      }
    }

    // Clear drag start position
    dragStartPosition.value = null;
  }

  store.isDragging = false;
  store.activeNode = null;
  isPanning.value = false;
};

const handleCanvasMouseDown = (e) => {
  if (snappedNodeId.value !== null) return;

  // Disable panning in overview mode
  if (isWorkspaceOverview.value) return;

  const clickedNode = findNodeAt(e.clientX, e.clientY);

  if (clickedNode) {
    // Clicked on a node - handle selection
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // Clear selection if not holding modifier keys
      selectedNodeIds.value.clear();
    }

    // Toggle node selection
    if (selectedNodeIds.value.has(clickedNode.id)) {
      selectedNodeIds.value.delete(clickedNode.id);
    } else {
      selectedNodeIds.value.add(clickedNode.id);
    }

    // Start multi-drag if node is selected
    if (selectedNodeIds.value.has(clickedNode.id)) {
      isMultiDragging.value = true;
      multiDragStartPositions.value.clear();

      // Save start positions for all selected nodes
      selectedNodeIds.value.forEach(nodeId => {
        const node = store.nodes.find(n => n.id === nodeId);
        if (node) {
          multiDragStartPositions.value.set(nodeId, { x: node.x, y: node.y });
        }
      });

      dragStartPosition.value = screenToWorld(e.clientX, e.clientY);
    }
  } else {
    // Clicked on empty canvas - start panning
    isPanning.value = true;
    lastPanPosition.value = {
      x: e.clientX - panX.value,
      y: e.clientY - panY.value,
    };
  }
};


// Touch event handlers
const handleTouchMove = (e: TouchEvent) => {
  e.preventDefault();

  // Disable touch interactions in overview mode
  if (isWorkspaceOverview.value) return;

  if (isPanning.value && e.touches.length === 1) {
    const touch = e.touches[0];
    panX.value = touch.clientX - lastPanPosition.value.x;
    panY.value = touch.clientY - lastPanPosition.value.y;
  } else if (e.touches.length === 2) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];

    const centerX = (touch1.clientX + touch2.clientX) / 2;
    const centerY = (touch1.clientY + touch2.clientY) / 2;

    const distance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );

    if (!lastPanPosition.value.lastDistance) {
      lastPanPosition.value.lastDistance = distance;
    }

    const deltaDistance = distance - lastPanPosition.value.lastDistance;

    const newZoom = Math.min(
      Math.max(zoom.value + deltaDistance * 0.01, ZOOM_MIN),
      ZOOM_MAX
    );
    zoom.value = newZoom;

    const contentX = (centerX - panX.value) / zoom.value;
    const contentY = (centerY - panY.value) / zoom.value;

    panX.value = centerX - contentX * newZoom;
    panY.value = centerY - contentY * newZoom;

    lastPanPosition.value.lastDistance = distance;
  }
};

const handleTouchStart = (e: TouchEvent) => {
  e.preventDefault();

  // Disable touch interactions in overview mode
  if (isWorkspaceOverview.value) return;

  if (e.touches.length === 1) {
    isPanning.value = true;
    const touch = e.touches[0];
    lastPanPosition.value = {
      x: touch.clientX - panX.value,
      y: touch.clientY - panY.value,
    };
  } else if (e.touches.length === 2) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    lastPanPosition.value.lastDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
  }
};

// Find closest node in a direction
const findClosestNodeInDirection = (currentNode, direction) => {
  const currentCenter = getNodeCenter(currentNode);
  const connectedNodes = store.connections
    .filter(
      (conn) =>
        conn.parent.id === currentNode.id || conn.child.id === currentNode.id
    )
    .map((conn) =>
      conn.parent.id === currentNode.id ? conn.child : conn.parent
    );

  let candidates = [];
  if (direction === "up") {
    candidates = connectedNodes.filter(
      (node) => getNodeCenter(node).y < currentCenter.y
    );
  } else if (direction === "down") {
    candidates = connectedNodes.filter(
      (node) => getNodeCenter(node).y > currentCenter.y
    );
  } else if (direction === "left") {
    candidates = connectedNodes.filter(
      (node) => getNodeCenter(node).x < currentCenter.x
    );
  } else if (direction === "right") {
    candidates = connectedNodes.filter(
      (node) => getNodeCenter(node).x > currentCenter.x
    );
  }

  candidates.sort((a, b) => {
    const distA = Math.hypot(
      getNodeCenter(a).x - currentCenter.x,
      getNodeCenter(a).y - currentCenter.y
    );
    const distB = Math.hypot(
      getNodeCenter(b).x - currentCenter.x,
      getNodeCenter(b).y - currentCenter.y
    );
    return distA - distB;
  });

  return candidates[0]?.id;
};

// Handle keyboard navigation
const handleKeyDown = (e: KeyboardEvent) => {
  const activeTag = document.activeElement?.tagName.toLowerCase();
  const isEditing =
    activeTag === 'input' ||
    activeTag === 'textarea' ||
    document.activeElement?.hasAttribute('contenteditable');


  if (!isEditing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    alwaysShowPetals.value = !alwaysShowPetals.value;
    localStorage.setItem('alwaysShowPetals', alwaysShowPetals.value.toString());

    showNotification(alwaysShowPetals.value ? 'Petals: Always Visible' : 'Petals: Visible on Hover');
  }

  // Undo/Redo keyboard shortcuts
  if (!isEditing) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? e.metaKey : e.ctrlKey;

    // Undo: Ctrl/Cmd + Z (without Shift)
    if (cmdKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }

    // Redo: Ctrl/Cmd + Shift + Z
    if (cmdKey && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      redo();
      return;
    }

    // Redo alternative: Ctrl/Cmd + Y
    if (cmdKey && e.key === 'y') {
      e.preventDefault();
      redo();
      return;
    }
  }

  if (store.isTransitioning) return;

  if (store.snappedNodeId !== null) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      emitter.emit('navigate-relic', {
        direction: e.key === "ArrowLeft" ? "previous" : "next",
        nodeId: store.snappedNodeId
      });

      e.preventDefault();
      return;
    }

    if (e.key === "Escape") {
      const node = store.nodes.find(n => n.id === store.snappedNodeId);
      if (node) {
        const originalPosition = nodePositions.value.get(store.snappedNodeId);
        if (originalPosition) {
          handleNodeUnsnap({ nodeId: store.snappedNodeId, originalPosition });
        }
      }
      e.preventDefault();
      return;
    }
  }

  const currentNode = store.nodes.find((n) => n.id === focusedNodeId.value);
  if (!currentNode) return;

  const parentNode = store.nodes.find((n) => n.id === currentNode.parentId);
  const children = store.nodes
    .filter((n) => n.parentId === currentNode.id)
    .sort((a, b) => a.y - b.y);

  let targetNodeId = null;

  if (e.key === "ArrowRight") {
    if (children.length > 0) {
      targetNodeId = children[0].id;
    } else {
      targetNodeId = findClosestNodeInDirection(currentNode, "right");
    }
  } else if (e.key === "ArrowLeft") {
    if (parentNode) {
      targetNodeId = parentNode.id;
    } else {
      targetNodeId = findClosestNodeInDirection(currentNode, "left");
    }
  } else if (e.key === "ArrowUp") {
    if (parentNode) {
      const siblings = store.nodes
        .filter((n) => n.parentId === parentNode.id)
        .sort((a, b) => a.y - b.y);
      const index = siblings.findIndex((n) => n.id === currentNode.id);
      if (index > 0) {
        targetNodeId = siblings[index - 1].id;
      }
    }
    if (!targetNodeId) {
      targetNodeId = findClosestNodeInDirection(currentNode, "up");
    }
  } else if (e.key === "ArrowDown") {
    if (parentNode) {
      const siblings = store.nodes
        .filter((n) => n.parentId === parentNode.id)
        .sort((a, b) => a.y - b.y);
      const index = siblings.findIndex((n) => n.id === currentNode.id);
      if (index >= 0 && index < siblings.length - 1) {
        targetNodeId = siblings[index + 1].id;
      }
    }
    if (!targetNodeId) {
      targetNodeId = findClosestNodeInDirection(currentNode, "down");
    }
  }

  if (targetNodeId) {
    focusedNodeId.value = targetNodeId;
    centerOnNode(targetNodeId);
  }
};

// Handle key release
const handleKeyUp = (e: KeyboardEvent) => {
  // No special handling needed for grid-only mode
};

// Unfocus cluster visualization
const unfocusClusterViz = () => {
  store.isTransitioning = true;

  isClusterVizFocused.value = false;
  focusedTopicId.value = null;

  setTimeout(() => {
    store.isTransitioning = false;
    autoFitNodes();
  }, 700);
};

// Enhanced auto-fit for RTS perspective
const autoFitNodes = () => {
  if (
    !canvasRef.value ||
    !autoZoomEnabled.value ||
    store.isDragging ||
    isPanning.value ||
    workspaceDragState.value.isDragging
  )
    return;

  const bounds = isWorkspaceOverview.value ? calculateWorkspacesBounds() : calculateNodeBounds(null);
  if (!bounds) return;

  const rect = canvasRef.value.getBoundingClientRect();
  const padding = isWorkspaceOverview.value ? 120 : 200; // More padding for RTS view

  const contentWidth = bounds.maxX - bounds.minX + padding * 2;
  const contentHeight = bounds.maxY - bounds.minY + padding * 2;

  // Adjust for RTS perspective - account for vertical compression
  const adjustedContentHeight = contentHeight * RTS_SCALE_Y;

  const scaleX = rect.width / contentWidth;
  const scaleY = rect.height / adjustedContentHeight;

  const newZoom = Math.min(scaleX, scaleY, 1);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  isAutoZooming.value = true;
  store.isTransitioning = true;

  zoom.value = newZoom;
  panX.value = rect.width / 2 - centerX * newZoom;
  panY.value = rect.height / 2 - centerY * newZoom;

  setTimeout(() => {
    isAutoZooming.value = false;
    store.isTransitioning = false;
  }, 300);

  window.autoFitNodes = autoFitNodes;
};

// Reset workspace physics (placeholder function)
const resetWorkspacePhysics = () => {
  // Reset any physics-related state for workspaces
  // This can be expanded later if needed
  console.log('Workspace physics reset');
};

// Enhanced bounds calculation for RTS
const calculateWorkspacesBounds = () => {
  if (!chatStore.chats.length) return null;

  return chatStore.chats.reduce(
    (acc, workspace) => {
      // Adjust bounds for RTS perspective
      const adjustedY = workspace.y * RTS_SCALE_Y;

      return {
        minX: Math.min(acc.minX, workspace.x),
        maxX: Math.max(acc.maxX, workspace.x + 300),
        minY: Math.min(acc.minY, adjustedY),
        maxY: Math.max(acc.maxY, adjustedY + 200 * RTS_SCALE_Y),
      };
    },
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    }
  );
};

// Workspace control methods
const updateWorkspaceViewMode = (mode: string) => {
  externalViewMode.value = mode;
};

const updateWorkspaceSortBy = (sortBy: string) => {
  externalSortBy.value = sortBy;
};

const updateWorkspaceCardSize = (size: number) => {
  externalCardSize.value = size;
};

const toggleWorkspaceFilters = () => {
  if (gridWorkspaceRef.value) {
    gridWorkspaceRef.value.toggleFilters?.();
  }
};

const handleFilterStateUpdate = (hasFilters: boolean, count: number) => {
  // This will be passed back to App.vue to update the dock controls
  emit('update-filter-state', { hasFilters, count });
};

const handleGraphStatsUpdate = (stats: { topics: number; workspaces: number }) => {
  // Pass graph stats to App.vue for the unified controls dock
  emit('update-graph-stats', stats);
};

const handle3DSupportUpdate = (supported: boolean) => {
  emit('update-3d-support', supported);
};

const handleFullscreenUpdate = (fullscreen: boolean) => {
  emit('update-fullscreen', fullscreen);
};

// Graph control methods
const updateGraphLayout = (layout: string) => {
  if (gridWorkspaceRef.value) {
    gridWorkspaceRef.value.updateGraphLayout?.(layout);
  }
};

const toggleGraphControls = () => {
  if (gridWorkspaceRef.value) {
    gridWorkspaceRef.value.toggleGraphControls?.();
  }
};

const resetGraph = () => {
  if (gridWorkspaceRef.value) {
    gridWorkspaceRef.value.resetGraph?.();
  }
};

const toggleFullscreen = () => {
  if (gridWorkspaceRef.value) {
    gridWorkspaceRef.value.toggleFullscreen?.();
  }
};

// Expose methods to parent component
defineExpose({
  autoFitNodes,
  isWorkspaceOverview,
  returnToOverview,
  handleHeightLock,
  handleHeightUnlock,
  centerAndSnapNode,
  handleWorkspaceSelect,
  checkAndAutoSnapSingleBranch,
  runPerformanceTest: () => perfTestPanel.value?.generateMockFlowers(),
  clearPerformanceTest: () => perfTestPanel.value?.clearMockFlowers(),
  updateWorkspaceViewMode,
  updateWorkspaceSortBy,
  updateWorkspaceCardSize,
  toggleWorkspaceFilters,
  updateGraphLayout,
  toggleGraphControls,
  resetGraph,
  toggleFullscreen
});

// Reset inactivity timer
const resetInactivityTimer = () => {
  if (inactivityTimer.value) {
    clearTimeout(inactivityTimer.value);
  }

  lastActivityTimestamp.value = Date.now();

  inactivityTimer.value = setTimeout(() => {
    if (Date.now() - lastActivityTimestamp.value >= AUTO_CENTER_DELAY) {
      autoFitNodes();
    }
  }, AUTO_CENTER_DELAY);
};

// Handle mouse movement
const handleMouseMove = (e) => {
  if (snappedNodeId.value !== null) return;
  if (isClusterVizFocused.value) return;
  resetInactivityTimer();

  const worldMousePos = screenToWorld(e.clientX, e.clientY);

  if (isMultiDragging.value && dragStartPosition.value) {
    // Handle multi-node dragging
    const deltaX = worldMousePos.x - dragStartPosition.value.x;
    const deltaY = worldMousePos.y - dragStartPosition.value.y;

    // Apply delta to all selected nodes
    selectedNodeIds.value.forEach(nodeId => {
      const node = store.nodes.find(n => n.id === nodeId);
      const startPos = multiDragStartPositions.value.get(nodeId);
      if (node && startPos) {
        store.updateNodePosition(nodeId, {
          x: startPos.x + deltaX,
          y: startPos.y + deltaY
        });
      }
    });
  } else if (workspaceDragState.value.isDragging) {
    const { activeId, offset } = workspaceDragState.value;
    if (!activeId) return;

    const canvasRect = canvasRef.value.getBoundingClientRect();

    const canvasX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
    const canvasY = (e.clientY - canvasRect.top - panY.value) / zoom.value;

    const workspace = workspaces.value.find(w => w.id === activeId);
    if (workspace) {
      workspace.x = canvasX - offset.x;
      workspace.y = canvasY - offset.y;
    }

  } else if (store.isDragging && store.activeNode) {
    const canvasRect = canvasRef.value.getBoundingClientRect();

    const canvasX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
    const canvasY = (e.clientY - canvasRect.top - panY.value) / zoom.value;

    store.updateNodePosition(store.activeNode, {
      x: canvasX - store.dragOffset.x,
      y: canvasY - store.dragOffset.y,
    });
  } else if (isPanning.value && lastPanPosition.value) {
    // Handle canvas panning
    panX.value = e.clientX - lastPanPosition.value.x;
    panY.value = e.clientY - lastPanPosition.value.y;
  }
};

const handleNodeExpansionChange = ({ nodeId, isExpanded }) => {
  if (isExpanded) {
    expandedNodes.value.add(nodeId);
  } else {
    expandedNodes.value.delete(nodeId);
  }
};

// Handle drag start for nodes
const handleDragStart = (e, node) => {
  store.isDragging = true;
  store.activeNode = node.id;

  // Save the initial position for undo
  dragStartPosition.value = {
    nodeId: node.id,
    x: node.x,
    y: node.y
  };

  const canvasRect = canvasRef.value.getBoundingClientRect();

  const canvasX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
  const canvasY = (e.clientY - canvasRect.top - panY.value) / zoom.value;

  store.dragOffset = {
    x: canvasX - node.x,
    y: canvasY - node.y,
  };
};

// Handle topic selection
const handleTopicSelect = (topicId: string) => {
  focusedTopicId.value = topicId;
  centerOnNode(topicId);
};

// Combined drag handlers removed - using the ones at lines 1644+ which handle both media and conversation imports

// Active state checks
const isNodeFocused = (nodeId) => focusedNodeId.value === nodeId;

const isConnectionActive = (connection) => {
  if (!focusedNodeId.value) return false;
  return (
    connection.parent.id === focusedNodeId.value ||
    connection.child.id === focusedNodeId.value
  );
};

// Listen for external workspace loads (from WorkspaceMenu, etc.)
emitter.on('workspace-loaded-external', () => {
  console.log('[InfiniteCanvas] External workspace load detected, checking auto-snap');
  nextTick(() => {
    setTimeout(() => {
      checkAndAutoSnapSingleBranch();
    }, 100); // Small delay to ensure nodes are loaded
  });
});

// Component lifecycle
onMounted(async () => {
  if (isBrowser) {

    store.nodes.forEach(node => {
      expandedNodes.value.add(node.id);
    });

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    if (canvasRef.value) {
      canvasRef.value.addEventListener("wheel", handleWheel, {
        passive: false,
      });
    }

    window.autoFitNodes = autoFitNodes;
    window.resetWorkspacePhysics = resetWorkspacePhysics;

    window.addEventListener("resize", () => {
      windowSize.value.width = window.innerWidth;
      windowSize.value.height = window.innerHeight;
    });

    // Initialize model registry
    updateModelRegistry();

    // Simulate loading progress for modern UI
    const interval = setInterval(() => {
      loadingProgress.value += Math.random() * 10;
      if (loadingProgress.value >= 100) {
        loadingProgress.value = 100;
        clearInterval(interval);
      }
    }, 100);

    if (isBrowser && !isInitializing.value) {
      isInitializing.value = true;
      try {
        await chatStore.loadChats();

        if (store.nodes.length) {
          centerCanvas();
        } else {
          if (isWorkspaceOverview.value) {
            // Grid view setup complete
          }
        }

        resetInactivityTimer();
      } finally {
        isInitializing.value = false;
      }
    }
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  // Clean up event listeners
  emitter.off('workspace-loaded-external');
  
  // Clean up intersection observer
  store.nodes.forEach(node => {
    unobserve(node.id);
  });

  // Clean up any stuck transition overlays
  const stuckOverlays = document.querySelectorAll('.overview-transition-overlay');
  stuckOverlays.forEach(overlay => {
    try {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    } catch (error) {
      console.warn('Failed to remove stuck overlay:', error);
    }
  });
  
  // Clean up body classes
  document.body.classList.remove('transition-blur');
});
</script>

<style scoped>
/* Onboarding drag state */
.onboarding-drag-active {
  background: oklch(from oklch(var(--p)) l c h / 0.05) !important;
  border: 2px dashed oklch(var(--p)) !important;
}

.onboarding-drag-active .drop-zone {
  background: oklch(from oklch(var(--p)) l c h / 0.1) !important;
  border-color: oklch(var(--p)) !important;
  transform: scale(1.02);
}

.onboarding-drag-active .drop-zone-inner {
  background: oklch(from oklch(var(--p)) l c h / 0.05) !important;
}
</style>

<style scoped>
/* Workspace Import Badge for Detail View */
.workspace-import-badge {
  @apply fixed bottom-4 left-20 z-50 flex items-center gap-2 px-3 py-2 rounded-lg;
  @apply backdrop-blur-sm transition-all duration-200 font-medium text-sm;
  background: oklch(from oklch(var(--b1)) l c h / 0.95);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  box-shadow: 0 4px 12px oklch(from oklch(var(--bc)) l c h / 0.1);
  transition: all 0.2s ease, background 0.3s ease, border-color 0.3s ease, color 0.3s ease;
}

.workspace-import-badge.import-chatgpt {
  background: oklch(from oklch(var(--in)) l c h / 0.1);
  border-color: oklch(from oklch(var(--in)) l c h / 0.3);
  color: oklch(var(--in));
}

.workspace-import-badge.import-claude {
  background: oklch(from oklch(var(--wa)) l c h / 0.1);
  border-color: oklch(from oklch(var(--wa)) l c h / 0.3);
  color: oklch(var(--wa));
}

/* Container Styles - Theme Aware Background */
.canvas-background {
  /* Default seamless gradient background matching GridWorkspaceView */
  background: linear-gradient(135deg,
      oklch(var(--b1)),
      oklch(var(--b1)),
      oklch(from oklch(var(--b2)) l c h / 0.3));
  transition: background 0.3s ease;
}

/* Cyberpunk theme specific gradient */
[data-theme="cyberpunk"] .canvas-background {
  background: linear-gradient(32deg, oklch(0.9 0.18 176.5), oklch(0.81 0.16 172.13), oklch(0.71 0.19 3.12));
}

/* Synthwave theme specific gradient */
[data-theme="synthwave"] .canvas-background {
  background: linear-gradient(41deg, oklch(0.78 0.12 226.65), oklch(0.72 0.18 339.2 / 0.62), oklch(0.76 0.19 111.62 / 0));
}

.workspace-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* Ensure container is transparent to show parent background */
  background: transparent;
}

.grid-view {
  overflow-y: auto;
  padding-top: 4rem;
  /* Remove any background to allow seamless transition */
  background: transparent;
}

.workspace-search-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
}

/* Enhanced GPU Acceleration */
.transform-gpu {
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  will-change: transform;
}

/* Enhanced transitions */
.transition-transform {
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 500ms;
}

.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}

.transition-transform-overview {
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 500ms;
}

/* Animation States */
.enter-active,
.leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.enter-from,
.leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Fade transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Waterfall transitions */
.waterfall-enter-active,
.waterfall-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.waterfall-enter-from,
.waterfall-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.waterfall-move {
  transition: transform 0.3s;
}

.waterfall-enter-active {
  transition-delay: 0.3s;
}

/* Welcome Screen Theme-Aware Styling */
.welcome-content {
  color: oklch(from oklch(var(--bc)) l c h / 0.8);
}

.welcome-subtitle {
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.welcome-feature-card {
  background: linear-gradient(135deg,
      oklch(from oklch(var(--b1)) l c h / 0.8),
      oklch(from oklch(var(--b2)) l c h / 0.5));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  backdrop-filter: blur(8px);
}

/* Spline hitbox hover effect */
.spline-hitbox:hover {
  stroke-opacity: 1 !important;
}

.welcome-feature-card:hover {
  background: linear-gradient(135deg,
      oklch(from oklch(var(--p)) l c h / 0.05),
      oklch(from oklch(var(--b1)) l c h / 0.9),
      oklch(from oklch(var(--b2)) l c h / 0.6));
  border-color: oklch(from oklch(var(--p)) l c h / 0.2);
  box-shadow:
    0 12px 32px oklch(from oklch(var(--p)) l c h / 0.15),
    0 0 0 1px oklch(from oklch(var(--p)) l c h / 0.1);
  transform: translateY(-4px);
  transition: all 0.2s ease;
}

.notification-toast {
  background: oklch(from oklch(var(--p)) l c h / 0.9);
  color: oklch(var(--pc));
  backdrop-filter: blur(8px);
}

.file-drop-overlay {
  background: oklch(from oklch(var(--p)) l c h / 0.2);
}

.file-drop-text {
  color: oklch(var(--p));
  text-shadow: 0 2px 4px oklch(from oklch(var(--p)) l c h / 0.3);
}

/* Media drop overlay */
.media-drop-overlay {
  pointer-events: none;
  z-index: 100;
}

/* Clean Onboarding Styles */
.drop-zone {
  @apply p-8 rounded-2xl border-2 border-dashed border-base-content/10 transition-all duration-300 cursor-pointer;
}

.drop-zone:hover {
  @apply border-base-content/20 bg-base-200/30;
}

.drop-zone-active {
  @apply border-primary bg-primary/5 scale-[1.02];
}

.drop-zone-inner {
  @apply text-center;
}

.create-new-button {
  @apply p-8 rounded-2xl border-2 border-transparent transition-all duration-300 text-left w-full;
  @apply hover:border-primary/20 hover:bg-primary/5 hover:scale-[1.02];
}

.create-new-inner {
  @apply text-center;
}

.onboarding-drag-active {
  @apply bg-base-200/20;
}

/* Loading State */
.loading-container {
  @apply text-center;
}

.lottie-loader {
  filter: 
    hue-rotate(var(--lottie-hue, 0deg))
    saturate(var(--lottie-saturation, 1))
    brightness(var(--lottie-brightness, 1));
  animation: lottieGlow 3s ease-in-out infinite alternate;
}

@keyframes lottieGlow {
  0% {
    filter: 
      hue-rotate(var(--lottie-hue, 0deg))
      saturate(var(--lottie-saturation, 1))
      brightness(var(--lottie-brightness, 1));
  }
  100% {
    filter: 
      hue-rotate(var(--lottie-hue, 0deg))
      saturate(var(--lottie-saturation, 1))
      brightness(var(--lottie-brightness, 1));
  }
}

/* Theme-specific Lottie customizations */
[data-theme="light"] .lottie-loader {
  --lottie-hue: 0deg;
  --lottie-saturation: 1.2;
  --lottie-brightness: 0.9;
}

[data-theme="dark"] .lottie-loader {
  --lottie-hue: 0deg;
  --lottie-saturation: 1.1;
  --lottie-brightness: 1.1;
}

[data-theme="cyberpunk"] .lottie-loader {
  --lottie-hue: 180deg;
  --lottie-saturation: 1.5;
  --lottie-brightness: 1.2;
}

[data-theme="synthwave"] .lottie-loader {
  --lottie-hue: 300deg;
  --lottie-saturation: 1.4;
  --lottie-brightness: 1.1;
}

/* UI Element Entrance Animations */
.animate-slide-down {
  animation: slideDown 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Enhanced Modern Canvas Animations */
.enhanced-infinite-canvas {
  @apply fixed overflow-hidden;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--b1)) l c h / 0.98) 0%, 
    oklch(from oklch(var(--b2)) l c h / 0.95) 100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
              background 0.3s ease;
}

.enhanced-infinite-canvas.drag-over {
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.1) 0%, 
    oklch(from oklch(var(--s)) l c h / 0.05) 100%);
  transform: scale(1.01);
}

/* Enhanced Search Bar */
.enhanced-search-bar {
  left: 50%;
  z-index: 50;
  --tw-translate-x: -50%;
  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border-radius: 24px;
}

/* Ultra Modern Loading */
.canvas-loading-overlay {
  @apply absolute inset-0 flex items-center justify-center z-50;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--b1)) l c h / 0.98) 0%, 
    oklch(from oklch(var(--b2)) l c h / 0.95) 100%);
  backdrop-filter: blur(24px);
  transition: background 0.3s ease;
}

.modern-loading {
  @apply text-center max-w-md;
}

.ultra-modern {
  @apply w-16 h-16 mx-auto mb-6 rounded-full relative;
  background: conic-gradient(from 0deg, 
    oklch(var(--p)), 
    oklch(var(--s)), 
    oklch(var(--a)), 
    oklch(var(--p)));
  animation: ultraSpin 2s linear infinite;
  transition: background 0.3s ease;
}

.ultra-modern::before {
  @apply absolute inset-2 rounded-full;
  content: '';
  background: oklch(var(--b1));
  transition: background 0.3s ease;
}

.ultra-modern::after {
  @apply absolute inset-4 rounded-full;
  content: '';
  background: conic-gradient(from 0deg, 
    oklch(var(--p)), 
    oklch(var(--s)), 
    oklch(var(--a)), 
    oklch(var(--p)));
  animation: ultraSpin 1s linear infinite reverse;
  transition: background 0.3s ease;
}

.loading-title {
  @apply text-2xl font-bold mb-2;
  color: oklch(var(--bc));
  animation: titlePulse 2s ease-in-out infinite alternate;
  transition: color 0.3s ease;
}

.loading-subtitle {
  @apply text-base opacity-70 mb-6;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
  transition: color 0.3s ease;
}

.loading-progress {
  @apply w-full h-1 rounded-full overflow-hidden;
  background: oklch(from oklch(var(--bc)) l c h / 0.1);
  transition: background 0.3s ease;
}

.progress-line {
  @apply h-full rounded-full;
  background: linear-gradient(90deg, 
    oklch(var(--p)), 
    oklch(var(--s)), 
    oklch(var(--a)));
  transition: width 0.3s ease, background 0.3s ease;
  animation: progressFlow 2s ease-in-out infinite;
}

/* Enhanced Onboarding */
.enhanced-onboarding {
  @apply absolute inset-0 flex items-center justify-center z-40 p-8;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--b1)) l c h / 0.98) 0%, 
    oklch(from oklch(var(--b2)) l c h / 0.95) 100%);
  backdrop-filter: blur(20px);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
              background 0.3s ease, 
              color 0.3s ease;
}

.enhanced-onboarding.drag-active {
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.1) 0%, 
    oklch(from oklch(var(--s)) l c h / 0.05) 100%);
  transform: scale(1.02);
}

.onboarding-content {
  @apply max-w-6xl w-full px-4;
  margin-bottom: 120px;
  /* Responsive scaling when panels are open */
  transition: all 0.3s ease;
}

/* Adapt layout when side panels are open */
.enhanced-infinite-canvas .onboarding-content {
  /* Scale down content when space is constrained */
  max-width: min(90vw, 6rem * 16); /* 90vw or 6xl, whichever is smaller */
}

/* Specific optimizations for panel states */
.both-panels-open .onboarding-content {
  max-width: 100%;
  padding: 1rem;
}

.both-panels-open .welcome-header {
  margin-bottom: 1rem;
}

.both-panels-open .welcome-title {
  font-size: 1.75rem;
  line-height: 1.1;
}

.both-panels-open .welcome-subtitle {
  font-size: 0.875rem;
}

.both-panels-open .action-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: none;
}

.both-panels-open .action-card {
  padding: 1rem;
  border-radius: 0.75rem;
}

.both-panels-open .action-card h2 {
  font-size: 1.125rem;
  margin-bottom: 0.25rem;
}

.both-panels-open .action-card p {
  font-size: 0.8rem;
  line-height: 1.3;
}

.both-panels-open .create-new-button {
  padding: 1rem;
}

/* Ultra-compact layout for very narrow spaces (both panels open) */
@media (max-width: 500px) {
  .onboarding-content {
    max-width: 100%;
    padding: 0.75rem;
  }
  
  .welcome-header {
    margin-bottom: 1rem;
  }
  
  .welcome-icon {
    width: 2.5rem;
    height: 2.5rem;
    margin-bottom: 0.75rem;
  }
  
  .welcome-title {
    font-size: 1.75rem;
    margin-bottom: 0.25rem;
    line-height: 1.1;
  }
  
  .welcome-subtitle {
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
  }
  
  .action-cards {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: none;
    margin: 0;
  }
  
  .action-card {
    padding: 1rem;
    border-radius: 0.75rem;
  }
  
  .action-card h2 {
    font-size: 1.125rem;
    margin-bottom: 0.25rem;
  }
  
  .action-card p {
    font-size: 0.8rem;
    line-height: 1.3;
    margin-bottom: 0.75rem;
  }
  
  .card-icon {
    margin-bottom: 0.75rem;
  }
  
  .create-new-button {
    padding: 1rem;
    border-radius: 0.75rem;
  }
  
  .create-new-button h2 {
    font-size: 1.125rem;
    margin-bottom: 0.25rem;
  }
  
  .create-new-button p {
    font-size: 0.8rem;
    line-height: 1.3;
    margin-bottom: 0.75rem;
  }
}

.welcome-header {
  @apply text-center mb-8 lg:mb-16;
  /* Responsive scaling for narrow spaces */
  transition: all 0.3s ease;
}

/* Compact welcome header when space is limited */
.enhanced-infinite-canvas .welcome-header {
  margin-bottom: clamp(1rem, 4vw, 4rem);
}

.welcome-icon {
  @apply relative mx-auto mb-8 w-24 h-24 flex items-center justify-center;
  color: oklch(var(--p));
  transition: color 0.3s ease;
}

.icon-glow {
  @apply absolute inset-0 rounded-full;
  background: radial-gradient(circle, 
    oklch(from oklch(var(--p)) l c h / 0.3) 0%, 
    transparent 70%);
  animation: iconPulse 3s ease-in-out infinite;
  transition: background 0.3s ease;
}

.welcome-title {
  @apply text-4xl lg:text-6xl font-light mb-4;
  color: oklch(var(--bc));
  animation: titleFloat 4s ease-in-out infinite;
  transition: color 0.3s ease, text-shadow 0.3s ease, font-size 0.3s ease;
  /* Responsive font size based on available width */
  font-size: clamp(2.5rem, 8vw, 3.75rem);
}

.welcome-subtitle {
  @apply text-xl opacity-70;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
  transition: color 0.3s ease;
}

/* Enhanced Action Cards */
.action-cards {
  @apply grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 max-w-4xl mx-auto;
  /* Responsive grid that stacks on narrow screens */
  transition: gap 0.3s ease;
}

/* Optimized vertical layout for narrow screens */
@media (max-width: 800px) {
  .onboarding-content {
    max-width: 100%;
    padding: 1rem;
  }
  
  .welcome-header {
    margin-bottom: 1.5rem;
  }
  
  .welcome-icon {
    width: 3rem;
    height: 3rem;
    margin-bottom: 1rem;
  }
  
  .welcome-title {
    font-size: 2.25rem;
    margin-bottom: 0.5rem;
    line-height: 1.2;
  }
  
  .welcome-subtitle {
    font-size: 1rem;
    margin-bottom: 1rem;
  }
  
  .action-cards {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: none;
    margin: 0;
  }
  
  .action-card {
    padding: 1.5rem;
    margin: 0;
    border-radius: 1rem;
  }
  
  .action-card h2 {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }
  
  .action-card p {
    font-size: 0.875rem;
    line-height: 1.4;
    margin-bottom: 1rem;
  }
  
  .card-icon {
    margin-bottom: 1rem;
  }
  
  .supported-formats {
    gap: 0.5rem;
    justify-self: center;
    flex-wrap: wrap;
  }
  
  .format-tag {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }
  
  .create-new-button {
    padding: 1.5rem;
    border-radius: 1rem;
  }
  
  .create-new-button h2 {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }
  
  .create-new-button p {
    font-size: 0.875rem;
    line-height: 1.4;
    margin-bottom: 1rem;
  }
}

.action-card {
  @apply relative p-4 lg:p-8 rounded-3xl cursor-pointer;
  @apply transition-all duration-500 ease-out;
  /* Responsive padding */
  padding: clamp(1rem, 4vw, 2rem);
  background: oklch(from oklch(var(--b1)) l c h / 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  box-shadow: 
    0 8px 32px oklch(from oklch(var(--b3)) l c h / 0.2),
    inset 0 1px 0 oklch(from oklch(var(--bc)) l c h / 0.05);
  animation: cardFloat 6s ease-in-out infinite;
  transition: all 0.5s ease-out, 
              background 0.3s ease, 
              border-color 0.3s ease, 
              box-shadow 0.3s ease;
}

.action-card:nth-child(2) {
  animation-delay: -3s;
}

.action-card:hover {
  transform: translateY(-12px) scale(1.02);
  box-shadow: 
    0 24px 48px oklch(from oklch(var(--p)) l c h / 0.2),
    0 0 0 1px oklch(from oklch(var(--p)) l c h / 0.1),
    inset 0 1px 0 oklch(from oklch(var(--bc)) l c h / 0.1);
  border-color: oklch(from oklch(var(--p)) l c h / 0.3);
}

.import-card.drag-hover {
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.1) 0%, 
    oklch(from oklch(var(--s)) l c h / 0.05) 100%);
  border-color: oklch(var(--p));
  transform: scale(1.05);
}

.card-glow {
  @apply absolute inset-0 rounded-3xl opacity-0;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.1) 0%, 
    oklch(from oklch(var(--s)) l c h / 0.05) 100%);
  transition: opacity 0.3s ease, background 0.3s ease;
}

.action-card:hover .card-glow {
  opacity: 1;
}

.card-content {
  @apply relative z-10;
}

.card-icon {
  @apply w-16 h-16 mx-auto mb-6 flex items-center justify-center rounded-2xl;
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  color: oklch(var(--p));
  transition: background 0.3s ease, color 0.3s ease;
}

.action-card h2 {
  @apply text-2xl font-semibold mb-4;
  color: oklch(var(--bc));
  justify-self: center;
  transition: color 0.3s ease;
}

.action-card p {
  @apply text-base opacity-70 mb-6;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
  transition: color 0.3s ease;
}

.supported-formats {
  justify-self: center;
  @apply flex gap-2 flex-wrap;
}

.format-tag {
  @apply px-3 py-1 rounded-full text-xs font-medium;
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  color: oklch(var(--p));
  border: 1px solid oklch(from oklch(var(--p)) l c h / 0.2);
  transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

/* Enhanced Animations */
@keyframes ultraSpin {
  to { transform: rotate(360deg); }
}

@keyframes titlePulse {
  0%, 100% { 
    text-shadow: 0 0 20px oklch(from oklch(var(--p)) l c h / 0.3);
  }
  50% { 
    text-shadow: 0 0 40px oklch(from oklch(var(--p)) l c h / 0.5);
  }
}

@keyframes progressFlow {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes iconPulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.1); opacity: 1; }
}

@keyframes titleFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes cardFloat {
  0%, 100% { transform: translateY(0) rotateX(0deg); }
  50% { transform: translateY(-5px) rotateX(2deg); }
}

/* Transition Classes */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-30px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}

.zoom-fade-enter-active,
.zoom-fade-leave-active {
  transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
}

.zoom-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.zoom-fade-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Accessibility - Reduce motion */
@media (prefers-reduced-motion: reduce) {
  .transform-gpu {
    transform: none !important;
  }

  * {
    transition: none !important;
    animation: none !important;
  }
}
</style>