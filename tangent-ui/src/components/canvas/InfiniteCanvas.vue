<template>
  <div class="fixed overflow-hidden bg-background transition-all duration-300" :style="{
    left: sidePanelOpen ? '40vw' : '0px', // Leave space for sidebar trigger
    right: rightPanelOpen ? '40vw' : '0',
    top: '0',
    bottom: '0',
    zIndex: '30',
  }" @dragenter.prevent="handleDragEnter" @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop">

    <!-- Grass Layer (behind search bar) -->
    <div v-if="isWorkspaceOverview" class="grass-layer">
      <div class="grass-container">
        <div 
          v-for="blade in grassBlades" 
          :key="blade.id" 
          class="grass-blade"
          :style="blade.style"
        ></div>
      </div>
    </div>

    <!-- Workspace Search Bar -->
    <WorkspaceSearchBar v-if="isWorkspaceOverview" v-model="searchQuery" :view-mode="viewMode"
      @toggle-view="handleViewModeToggle" class="workspace-search-bar" />

    <!-- Empty State Welcome -->
    <div v-if="workspaces.length === 0" class="absolute inset-0 flex items-center justify-center p-8">
      <div class="max-w-2xl text-center space-y-8">
        <transition name="waterfall" appear>
          <div class="flex flex-col items-center justify-center">
            <h1 class="text-4xl font-bold mb-6">
              Welcome to
            </h1>
            <TangentLogo />
          </div>
        </transition>
        <div class="space-y-6 text-base-content/80">
          <transition name="waterfall" appear :style="{ 'transition-delay': `0.1s` }">
            <p class="text-xl">
              - a digitial garden for your AI chats -
            </p>
          </transition>
          <transition name="waterfall" appear>
            <div class="grid gap-6 text-center">
              <transition-group name="waterfall" tag="div" appear>
                <div v-for="(feature, index) in features" :key="index" class="p-6 bg-base-200/50 rounded-xl border border-base-300 hover:shadow-md hover:translate-y-[-4px]
                  transition duration-200" :style="{ 'transition-delay': `${0.02}s` }">
                  <h3 class="text-lg font-semibold mb-3" v-html="feature.title"></h3>
                  <p v-html="feature.description"></p>
                </div>
              </transition-group>
            </div>
          </transition>

          <transition name="waterfall" appear :style="{ 'transition-delay': `0.6s` }">
            <div class="pt-6">
              <button @click="handleNewWorkspace" class="btn btn-primary btn-lg gap-2">
                <Plus class="w-5 h-5" />
                Create Your First Workspace
              </button>
              <p class="mt-4 text-base-content/60">
                To get started, simply create a new workspace or configure your
                AI model settings
              </p>
            </div>
          </transition>
        </div>
      </div>
    </div>

    <!-- Main Canvas with RTS Perspective -->
    <div v-else class="workspace-container rts-perspective">
      <Transition name="fade">
        <div v-if="notification.visible"
          class="fixed top-16 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-primary/80 text-primary-content rounded-lg shadow-lg z-50">
          {{ notification.message }}
        </div>
      </Transition>

      <!-- RTS Ground Plane -->
      <div v-if="viewMode === 'bubble' && isWorkspaceOverview" class="rts-ground-plane"></div>

      <!-- Bubble View with RTS -->
      <div v-if="viewMode === 'bubble' && isWorkspaceOverview" ref="canvasRef"
        class="bubble-view rts-canvas absolute inset-0 transition-transform duration-500 ease-in-out overscroll-none touch-pan-y"
        @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseUp"
        @mousedown="handleCanvasMouseDown" @touchstart="handleTouchStart" @touchmove="handleTouchMove" tabindex="0"
        @keydown="handleKeyDown" @wheel="handleWheel">

        <!-- Canvas Transform Container with RTS adjustments -->
        <div class="absolute transform-gpu rts-transform" :style="transformStyle" :class="{
          'transition-transform-overview': isWorkspaceOverview,
          'overflow-visible': true,
        }">
          <!-- Bubble Layout -->
          <div class="absolute rts-nodes-layer" :style="nodesLayerStyle">
            <FlowerWorkspaceNode v-for="workspace in filteredWorkspaces" :key="workspace.id" :workspace="workspace"
              :is-selected="selectedWorkspaceId === workspace.id" :max-node-count="maxNodeCount"
              :window-height="windowSize.value ? windowSize.value.height : 1080" :always-show-petals="alwaysShowPetals || isCommandPressed"
              @select="handleWorkspaceSelect(workspace.id)" @favorite="handleWorkspaceFavorite(workspace.id)"
              @duplicate="handleWorkspaceDuplicate(workspace.id)" @archive="handleWorkspaceArchive(workspace.id)"
              @export="handleWorkspaceExport(workspace.id)" @delete="handleWorkspaceDelete(workspace.id)" />
          </div>
        </div>
      </div>

      <!-- Grid View (unchanged) -->
      <transition name="fade" mode="out-in">
        <GridWorkspaceView v-if="viewMode === 'grid' && isWorkspaceOverview" :workspaces="filteredWorkspaces"
          :selected-workspace-id="selectedWorkspaceId" :search-query="searchQuery"
          @select-workspace="handleWorkspaceSelect" @favorite-workspace="handleWorkspaceFavorite"
          @duplicate-workspace="handleWorkspaceDuplicate" @archive-workspace="handleWorkspaceArchive"
          @export-workspace="handleWorkspaceExport" @delete-workspace="handleWorkspaceDelete"
          class="grid-view absolute inset-0" />
      </transition>

      <!-- Detailed Workspace View (when a workspace is selected) -->
      <div v-if="!isWorkspaceOverview" ref="canvasRef"
        class="absolute inset-0 transition-transform duration-500 ease-in-out overscroll-none touch-pan-y"
        @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseUp"
        @mousedown="handleCanvasMouseDown" @touchstart="handleTouchStart" @touchmove="handleTouchMove" tabindex="0"
        @keydown="handleKeyDown" @wheel="handleWheel">

        <!-- Canvas Transform Container -->
        <div class="absolute transform-gpu" :style="transformStyle">
          <!-- SVG Layer for Connections -->
          <svg class="absolute pointer-events-none overflow-visible" style="z-index: 1" :style="svgStyle"
            viewBox="0 0 100000 100000" preserveAspectRatio="none">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" class="fill-primary" />
              </marker>
            </defs>
            <template v-for="connection in store.connections" :key="`${connection.parent.id}-${connection.child.id}`">
              <SplineConnector :start-node="connection.parent" :end-node="connection.child"
                :card-width="store.CARD_WIDTH" :card-height="store.CARD_HEIGHT"
                :is-active="isConnectionActive(connection)" :zoom-level="zoom"
                :is-source-node-expanded="expandedNodes.value?.has(connection.parent.id) || false" />
            </template>
          </svg>

          <!-- Nodes Layer -->
          <div class="absolute" :style="nodesLayerStyle" style="z-index: 2">
            <template v-for="node in store.nodes" :key="node.id">
              <!-- Branch Node (handles text and media) -->
              <BranchNode v-if="node.type === 'branch' || node.type === 'main' || node.type === 'media'" :node="node" :is-selected="isNodeFocused(node.id)" :selected-model="selectedModel"
                :open-router-api-key="openRouterApiKey" :modelType="modelType" :zoom="zoom"
                :model-registry="modelRegistry" :is-side-panel-open="sidePanelOpen" :is-right-panel-open="rightPanelOpen" :supports-vision="isVisionModelSelected" @select="handleNodeSelect(node.id)" @drag-start="handleDragStart"
                @create-branch="handleCreateBranch" @update-title="store.updateNodeTitle" @resend="(userMessageIndex) =>
                  handleResend(node.id, userMessageIndex)
                " @delete="() => store.removeNode(node.id)" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning
                    ? 'transform 0.3s ease-out'
                    : 'none',
                }" />

              <!-- Web Node -->
              <WebBranchNode v-else-if="node.type === 'web'" :node="node" :is-selected="isNodeFocused(node.id)"
                :selected-model="selectedModel" :open-router-api-key="openRouterApiKey" :modelType="modelType"
                :zoom="zoom" :model-registry="modelRegistry" @select="handleNodeSelect(node.id)"
                @drag-start="handleDragStart" @create-branch="handleCreateBranch" @update-title="store.updateNodeTitle"
                @resend="(userMessageIndex) =>
                  handleResend(node.id, userMessageIndex)
                " @delete="() => store.removeNode(node.id)" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning
                    ? 'transform 0.3s ease-out'
                    : 'none',
                }" />

              <!-- Branch Node -->
              <BranchNode v-else :node="node" :is-selected="isNodeFocused(node.id)"
                :is-snapped="store.snappedNodeId === node.id" :selected-model="selectedModel"
                :open-router-api-key="openRouterApiKey" :modelType="modelType" :zoom="zoom"
                :model-registry="modelRegistry" :is-side-panel-open="sidePanelOpen" :is-right-panel-open="rightPanelOpen" :supports-vision="isVisionModelSelected" @select="handleNodeSelect(node.id)"
                @drag-start="handleDragStart" @create-branch="handleCreateBranch" @update-title="store.updateNodeTitle"
                @resend="(userMessageIndex) => handleResend(node.id, userMessageIndex)"
                @delete="() => store.removeNode(node.id)" @update-position="handleNodePositionUpdate"
                @snap="handleNodeSnap" @unsnap="handleNodeUnsnap" @focus-input="handleFocusInput"
                @expansion-change="handleNodeExpansionChange" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none',
                }" />
            </template>
          </div>
        </div>
      </div>

      <PerformanceTestPanel ref="perfTestPanel" />
    </div>

    <!-- File Drop Overlay -->
    <div v-show="isDraggingFile"
      class="absolute inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center pointer-events-none z-50">
      <div class="text-2xl font-semibold text-primary">
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
import TangentLogo from '../logo/TangentLogo.vue';
import emitter from '@/utils/eventBus'
import FlowerWorkspaceNode from "./node/FlowerWorkspaceNode.vue";
import GridWorkspaceView from "../workspace/GridWorkspaceView.vue";
import WorkspaceSearchBar from "../workspace/WorkspaceSearchBar.vue";
import WebBranchNode from "./node/WebBranchNode.vue";
import SplineConnector from "./spline/MainSplineConnector.vue";
import { useCanvasStore } from "@/stores/canvasStore";
import { useChatStore } from "@/stores/chatStore";
import { useAppStore } from "@/stores/appStore";
import { useModelStore } from "@/stores/modelStore";
import type { ModelInfo } from '@/types/model';
import PerformanceTestPanel from './PerformanceTestPanel.vue';
import { Plus, Circle, LayoutGrid } from "lucide-vue-next";

// Add near the top with other refs
const modelRegistry = ref(new Map<string, ModelInfo>());

const store = useCanvasStore();
const chatStore = useChatStore();
const modelStore = useModelStore();
const canvasRef = ref(null);
const appStore = useAppStore();

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
const viewMode = ref('bubble'); // 'bubble' or 'grid'
const searchQuery = ref('');
const perfTestPanel = ref(null);
const alwaysShowPetals = ref(localStorage.getItem('alwaysShowPetals') === 'true' || false);

// CMD/CTRL key state for flower bloom effect
const isCommandPressed = ref(false);

const STEM_LENGTH_MIN = 400; // Minimum stem length
const STEM_LENGTH_MAX = 650; // Maximum stem length

// RTS Perspective constants
const RTS_ANGLE = 35; // degrees for ground plane
const RTS_SCALE_Y = 0.6; // vertical compression
const DEPTH_FACTOR = 0.8; // how much depth affects positioning

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
    default: "zoom",
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
  "workspace-opened"
]);

// Modify zoom ref to be computed
const zoom = computed({
  get: () => props.zoom,
  set: (value) => emit("update:zoom", value),
});

// Watch for autoZoom changes
watch(
  () => props.autoZoomEnabled,
  (newValue) => {
    if (newValue) {
      autoFitNodes();
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

// Calculate max node count for bubble size normalization
const maxNodeCount = computed(() => {
  if (!workspaces.value.length) return 1;
  return Math.max(...workspaces.value.map(w => w.nodeCount || 0), 1);
});

// Generate procedural grass blades for ambient background
const grassBlades = computed(() => {
  if (!isWorkspaceOverview.value) return [];
  
  const canvasWidth = windowSize.value?.width || 1920;
  const bladeCount = Math.floor(canvasWidth / 8); // One blade every 8px
  const blades = [];
  
  // Seeded random function for consistent placement
  const seededRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  
  for (let i = 0; i < bladeCount; i++) {
    const seed = i * 123.456;
    const x = (i / bladeCount) * 100;
    
    // Varied blade properties
    const height = 30 + seededRandom(seed) * 40; // 30-70px range
    const width = 2 + seededRandom(seed + 1) * 3; // 2-5px range
    const rotation = (seededRandom(seed + 2) - 0.5) * 30; // More natural sway
    const delay = seededRandom(seed + 3) * 4; // Animation delay
    
    // Natural grass colors with variation
    const hue = 115 + seededRandom(seed + 4) * 10; // Green with slight variation
    const saturation = 40 + seededRandom(seed + 5) * 30; // 40-70%
    const lightness = 30 + seededRandom(seed + 6) * 25; // 30-55%
    
    blades.push({
      id: i,
      style: {
        position: 'absolute',
        left: `${x}%`,
        bottom: '0px',
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'bottom center',
        borderRadius: `${width}px ${width}px 0 0`,
        animationDelay: `${delay}s`,
        opacity: 0.7,
        boxShadow: `0 0 2px rgba(0, 100, 0, 0.2)`
      }
    });
  }
  
  return blades;
});

const isWorkspaceOverview = ref(true);
const expandingWorkspaceId = ref<string | null>(null);

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

// Enhanced workspace positioning with RTS perspective
const workspaces = computed(() => {
  const workspaceData = chatStore.chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    nodeCount: chat.nodeCount,
    lastUpdated: chat.updatedAt,
    x: chat.x,
    y: chat.y,
    isExpanding: expandingWorkspaceId.value === chat.id,
    tags: chat.tags || [],
    color: chat.color,
    isFavorite: chat.isFavorite || false,
    status: chat.status || 'active'
  }));

  if (viewMode.value === 'bubble' && workspaceData.length > 0) {
    return simulateRTSFlowerLayout(workspaceData);
  }

  return workspaceData;
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

const getMediaUrl = (mediaContent) => {
  if (!mediaContent) return '';
  if (mediaContent.previewUrl) return mediaContent.previewUrl;
  if (mediaContent.media_id) return `http://127.0.0.1:5050/media/${mediaContent.media_id}`;
  return '';
};

// Generate concise title for image using vision model
const generateConciseImageTitle = async (file: File): Promise<string> => {
  try {
    const base64Data = await fileToBase64(file);
    
    // Use the same model that the router service uses for vision tasks
    const routerModel = 'qwen2.5vl:3b';
    
    const titlePrompt = 'Generate a concise, descriptive title for this image in 3-5 words. Focus on the main subject or action. Respond with only the title, no additional text.';
    
    const response = await fetch('http://localhost:5050/api/ollama-proxy/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: routerModel,
        prompt: titlePrompt,
        images: [base64Data],
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
    return cleanTitle || file.name;
    
  } catch (error) {
    console.error('[InfiniteCanvas] Title generation error:', error);
    return file.name; // Fallback to filename
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
          isProcessingMedia: false
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
        
        // Save updated content to database
        await store.updateNode(node.id, { 
          mediaContent: updatedMediaContent,
          messages: updatedMessages,
          isProcessingMedia: false,
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
        isProcessingMedia: false
      });
    }

  } catch (error) {
    console.error('[InfiniteCanvas] Media processing error:', error);
    
    await store.updateNode(node.id, {
      mediaContent: {
        ...node.mediaContent,
        analysis: `Processing failed: ${error.message}`
      },
      isProcessingMedia: false
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
  viewBox: `0 0 ${windowSize.value.width} ${windowSize.value.height}`,
}));

const nodesLayerStyle = computed(() => ({
  width: "100000px",
  height: "100000px",
  left: 0,
  top: 0,
  pointerEvents: isWorkspaceOverview ? 'auto' : 'none', // Only capture events in overview mode
}));

provide('alwaysShowPetals', alwaysShowPetals);


const simulateRTSFlowerLayout = (workspaceNodes) => {
  const nodes = JSON.parse(JSON.stringify(workspaceNodes));

  // Adjust canvas dimensions
  const leftPanelWidth = props.sidePanelOpen ? windowSize.value.width * 0.4 : 0;
  const rightPanelWidth = props.rightPanelOpen ? windowSize.value.width * 0.4 : 0;
  const canvasW = windowSize.value.width - leftPanelWidth - rightPanelWidth;
  const canvasH = windowSize.value.height + 800;

  const FLOOR = canvasH - 90;
  const maxCount = Math.max(...nodes.map(n => n.nodeCount || 1), 1);

  // Calculate flower sizes
  nodes.forEach(n => {
    const baseR = 50 + ((n.nodeCount || 1) / maxCount) * 70;
    n.radius = baseR + 30;
  });

  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  // Seeded random function for consistent positioning
  const seededRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  if (nodes.length === 1) {
    // Single flower - random stem length between 200-400
    const seed = nodes[0].id.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
    const stemLength = 350 + seededRandom(seed) * 500; // Random between 200-400
    nodes[0].x = centerX;
    nodes[0].y = centerY - stemLength;
  } else {
    // Multiple flowers - each gets individual random stem length
    const itemsPerRow = Math.ceil(Math.sqrt(nodes.length));
    const spacing = Math.min(200, canvasW / (itemsPerRow + 1));

    nodes.forEach((node, index) => {
      // Create unique seed based on workspace ID
      let seed = 0;
      for (let i = 0; i < node.id.length; i++) {
        seed += node.id.charCodeAt(i) * (i + 1);
      }
      
      // Generate random stem length for this flower (200-400px)
      const stemLength = 400 + seededRandom(seed * 1.5) * 250; // Multiply seed for different randomness
      const groundY = centerY - stemLength;
      
      if (nodes.length <= 6) {
        // For small numbers, scatter around center at different stem heights
        const baseAngle = (2 * Math.PI * index) / nodes.length;
        const radius = Math.min(150, canvasW * 0.15);
        const scatterRadius = radius + (seededRandom(seed) - 0.5) * 80;
        node.x = centerX + Math.cos(baseAngle) * scatterRadius;
        node.y = groundY; // Individual stem length
      } else {
        // For larger numbers, scatter horizontally at different stem heights
        const baseX = centerX + (index - (nodes.length - 1) / 2) * spacing;
        const scatterX = (seededRandom(seed) - 0.5) * spacing * 0.6;
        node.x = baseX + scatterX;
        node.y = groundY; // Individual stem length
      }

      // Ensure flowers don't go too far out of bounds
      node.x = Math.max(node.radius, Math.min(canvasW - node.radius, node.x));
      node.y = Math.max(node.radius + 50, Math.min(FLOOR - node.radius - 100, node.y));
    });
  }

  return nodes;
};

// Create new workspace
const handleNewWorkspace = async () => {
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

// Handle view mode toggle
const handleViewModeToggle = (mode) => {
  viewMode.value = mode;

  if (mode === 'bubble') {
    nextTick(() => {
      autoFitNodes();
    });
  }
};

const resetWorkspacePhysics = () => {
  const leftPanelWidth = props.sidePanelOpen ? windowSize.value.width * 0.4 : 0;
  const rightPanelWidth = props.rightPanelOpen ? windowSize.value.width * 0.4 : 0;
  const canvasWidth = windowSize.value.width - leftPanelWidth - rightPanelWidth;
  const canvasHeight = windowSize.value.height + 800;

  window.resetWorkspacePhysics = resetWorkspacePhysics;

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // Seeded random function for consistent positioning
  const seededRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  chatStore.chats.forEach((chat, index) => {
    const nodeCount = chat.nodeCount || 1;
    const maxCount = Math.max(...chatStore.chats.map(c => c.nodeCount || 1), 1);
    const minSize = 80;
    const maxSize = 160;
    chat.radius = minSize + (nodeCount / maxCount) * (maxSize - minSize);

    let x, y;

    // Create unique seed based on workspace ID
    let seed = 0;
    for (let i = 0; i < chat.id.length; i++) {
      seed += chat.id.charCodeAt(i) * (i + 1);
    }
    
    // Generate random stem length for this flower (200-400px)
    const stemLength = 350 + seededRandom(seed * 1.5) * 500;
    const groundY = centerY - stemLength;

    if (chatStore.chats.length === 1) {
      // Single workspace - random stem length
      x = centerX;
      y = groundY;
    } else {
      // Multiple flowers - each gets individual random stem length
      const itemsPerRow = Math.ceil(Math.sqrt(chatStore.chats.length));
      const spacing = Math.min(200, canvasWidth / (itemsPerRow + 1));

      if (chatStore.chats.length <= 6) {
        // Small number - scatter around center at different stem heights
        const baseAngle = (2 * Math.PI * index) / chatStore.chats.length;
        const radius = Math.min(150, canvasWidth * 0.15);
        const scatterRadius = radius + (seededRandom(seed) - 0.5) * 80;
        x = centerX + Math.cos(baseAngle) * scatterRadius;
        y = groundY; // Individual stem length
      } else {
        // Larger number - scatter horizontally at different stem heights
        const baseX = centerX + (index - (chatStore.chats.length - 1) / 2) * spacing;
        const scatterX = (seededRandom(seed) - 0.5) * spacing * 0.6;
        x = baseX + scatterX;
        y = groundY; // Individual stem length
      }
    }

    // Ensure flowers stay within bounds
    x = Math.max(chat.radius, Math.min(canvasWidth - chat.radius, x));
    y = Math.max(chat.radius + 50, Math.min(canvasHeight - chat.radius - 100, y));

    chatStore.updateChatMetadata(chat.id, { x, y, radius: chat.radius });
  });

  // Force re-simulation with deterministic layout
  setTimeout(() => {
    if (viewMode.value === 'bubble') {
      const chatCopy = [...chatStore.chats];
      chatStore.chats = [];

      nextTick(() => {
        chatStore.chats = chatCopy;
        nextTick(() => {
          autoFitNodes();
        });
      });
    }
  }, 50);
};

// Center and snap to a node
const centerAndSnapNode = (nodeId: string) => {
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  store.isTransitioning = true;

  const center = getNodeCenter(node);
  const rect = canvasRef.value.getBoundingClientRect();

  panX.value = rect.width / 2 - center.x * zoom.value;

  const verticalOffset = Math.min(rect.height * 0.05, 30);
  panY.value = rect.height / 2 - center.y * zoom.value + verticalOffset;

  focusedNodeId.value = nodeId;

  nextTick(() => {
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

  const targetZoom = 1.5;

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

  return Math.min(Math.max(Math.min(zoomX, zoomY), 0.1), 2);
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
  if ((e.target as HTMLElement).closest(".branch-node.snapped")) {
    console.log("Snapped node, ignoring wheel event");
    return;
  }

  // Disable zoom/pan/scroll in overview mode
  if (isWorkspaceOverview.value) {
    e.preventDefault();
    return;
  }

  resetInactivityTimer();

  const ZOOM_SENSITIVITY = 0.005;
  const ZOOM_MIN = 0.05;
  const ZOOM_MAX = 2;

  const rect = canvasRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const contentX = (mouseX - panX.value) / zoom.value;
  const contentY = (mouseY - panY.value) / zoom.value;

  const delta = props.gestureMode === "zoom" ? -e.deltaY : e.deltaX;
  const zoomDelta = props.gestureMode === "zoom" ? delta * ZOOM_SENSITIVITY : 0;
  const newZoom = Math.min(
    Math.max(zoom.value * (1 + zoomDelta), ZOOM_MIN),
    ZOOM_MAX
  );

  if (props.gestureMode === "zoom") {
    panX.value = mouseX - contentX * newZoom;
    panY.value = mouseY - contentY * newZoom;
  } else {
    panX.value -= e.deltaX;
    panY.value -= e.deltaY;
  }

  zoom.value = newZoom;
};

// Center canvas
const centerCanvas = () => {
  zoom.value = 1;
  targetZoom.value = 1;
  panX.value = 0;
  panY.value = 0;
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
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value);
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
      console.log('Drag enter with media file');
    }
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
    }
  }
};

const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

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

      // Generate concise title for the image
      let nodeTitle = file.name;
      try {
        nodeTitle = await generateConciseImageTitle(file);
      } catch (error) {
        console.warn('[InfiniteCanvas] Title generation failed, using filename:', error);
      }
      
      // Create a new branch node that will handle the media
      const newNode = await store.addNode(null, -1, position, {
        type: "branch",
        title: nodeTitle,
        isProcessingMedia: true
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
};

const returnToOverview = async () => {
  console.log("Returning to overview");

  const currentScale = zoom.value;
  const currentPanX = panX.value;
  const currentPanY = panY.value;

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

    const workspaceElements = document.querySelectorAll('.bubble-workspace-node, .grid-workspace-card');
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
      document.body.removeChild(overlay);
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
    autoFitNodes();
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

  autoFitNodes();

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

// Center on a specific node
const centerOnNode = (nodeId) => {
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  store.isTransitioning = true;
  const center = getNodeCenter(node);

  const rect = canvasRef.value.getBoundingClientRect();

  panX.value = rect.width / 2 - center.x * zoom.value;

  const verticalOffset = Math.min(rect.height * 0.05, 30);
  panY.value = rect.height / 2 - center.y * zoom.value + verticalOffset;

  focusedNodeId.value = nodeId;

  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
};

// Handle branch creation
const handleCreateBranch = (
  parentId: string,
  messageIndex: number,
  position: { x: number; y: number },
  initialData: any
) => {
  isFocusedMode.value = false;

  const parentNode = store.nodes.find((n) => n.id === parentId);
  if (!parentNode) return;

  const existingBranches = store.nodes.filter((n) => n.parentId === parentId);
  const verticalOffset = existingBranches.length * (store.CARD_HEIGHT + 20);

  const adjustedPosition = {
    x: position.x,
    y: parentNode.y + verticalOffset,
  };

  const newNode = store.addNode(parentId, messageIndex, adjustedPosition, {
    ...initialData,
    y: adjustedPosition.y,
  });

  centerOnNode(newNode.id);
  setTimeout(() => {
    autoFitNodes();
  }, 400);
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

  store.isDragging = false;
  store.activeNode = null;
  isPanning.value = false;
};

const handleCanvasMouseDown = (e) => {
  if (snappedNodeId.value !== null) return;

  // Disable panning in overview mode
  if (isWorkspaceOverview.value) return;

  if (e.button === 0 && !store.isDragging && !workspaceDragState.value.isDragging) {
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
      Math.max(zoom.value + deltaDistance * 0.01, 0.1),
      2
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

  // Track CMD/CTRL key for flower bloom effect
  if ((e.metaKey || e.ctrlKey) && isWorkspaceOverview.value && viewMode.value === 'bubble') {
    isCommandPressed.value = true;
  }

  if (!isEditing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    alwaysShowPetals.value = !alwaysShowPetals.value;
    localStorage.setItem('alwaysShowPetals', alwaysShowPetals.value.toString());

    showNotification(alwaysShowPetals.value ? 'Petals: Always Visible' : 'Petals: Visible on Hover');
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

// Handle key release to stop flower bloom effect
const handleKeyUp = (e: KeyboardEvent) => {
  // Stop flower bloom effect when CMD/CTRL is released
  if ((e.key === 'Meta' || e.key === 'Control') && isWorkspaceOverview.value && viewMode.value === 'bubble') {
    isCommandPressed.value = false;
  }
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

// Expose methods to parent component
defineExpose({
  autoFitNodes,
  isWorkspaceOverview,
  returnToOverview,
  handleHeightLock,
  handleHeightUnlock,
  centerAndSnapNode,
  handleWorkspaceSelect,
  runPerformanceTest: () => perfTestPanel.value?.generateMockFlowers(),
  clearPerformanceTest: () => perfTestPanel.value?.clearMockFlowers()
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

  if (workspaceDragState.value.isDragging) {
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
  } else if (isPanning.value) {
    const dx = e.clientX - lastPanPosition.value.x;
    const dy = e.clientY - lastPanPosition.value.y;
    panX.value = dx;
    panY.value = dy;
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

// Active state checks
const isNodeFocused = (nodeId) => focusedNodeId.value === nodeId;

const isConnectionActive = (connection) => {
  if (!focusedNodeId.value) return false;
  return (
    connection.parent.id === focusedNodeId.value ||
    connection.child.id === focusedNodeId.value
  );
};

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

    if (isBrowser && !isInitializing.value) {
      isInitializing.value = true;
      try {
        await chatStore.loadChats();

        if (store.nodes.length) {
          centerCanvas();
        } else {
          if (isWorkspaceOverview.value) {
            resetWorkspacePhysics();
            
            // Show tip about CMD/CTRL bloom effect once
            if (!localStorage.getItem('cmdBloomTipShown') && chatStore.chats.length > 1) {
              setTimeout(() => {
                showNotification('💡 Hold CMD/CTRL to make all flowers bloom!');
                localStorage.setItem('cmdBloomTipShown', 'true');
              }, 2000);
            }
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
});
</script>

<style scoped>
/* RTS Perspective Base Styles */
.rts-perspective {
  perspective: 2000px;
  perspective-origin: center 20%;
}

.rts-canvas {
  transform-style: preserve-3d;
}

.rts-transform {
  transform-style: preserve-3d;
}

.rts-nodes-layer {
  transform-style: preserve-3d;
}

/* RTS Ground Plane */
.rts-ground-plane {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40%;
  background: linear-gradient(to bottom,
      transparent 0%,
      rgba(var(--color-base-300), 0.1) 30%,
      rgba(var(--color-base-300), 0.3) 70%,
      rgba(var(--color-base-300), 0.5) 100%);
  transform: rotateX(75deg) translateZ(-200px);
  transform-origin: bottom center;
  pointer-events: none;
  z-index: 0;
}

/* Enhanced GPU Acceleration for RTS */
.transform-gpu {
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  perspective: 2000px;
  overflow: hidden;
  will-change: transform;
}

/* Layout & Positioning with RTS adjustments */
.fixed {
  overflow: hidden;
  z-index: 40;
}

.absolute {
  overflow: visible;
}

/* Enhanced transitions for RTS */
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

/* Focus States with depth */
div:focus {
  outline: none;
}

div:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.1);
}

/* Canvas Controls with RTS positioning */
.canvas-control {
  position: fixed;
  padding: 0.375rem 0.75rem;
  background-color: rgb(var(--color-base-200) / 0.9);
  backdrop-filter: blur(4px);
  border-radius: 9999px;
  border: 1px solid rgb(var(--color-base-300));
  box-shadow: 0 2px 8px 0 rgb(0 0 0 / 0.15), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  transform: translateZ(50px);
  /* Bring controls forward in 3D space */
}

.canvas-control:hover {
  background-color: rgb(var(--color-base-300) / 0.9);
  transform: translateZ(60px) scale(1.05);
}

/* Transform Utilities for RTS */
.will-change-transform {
  will-change: transform;
}

.transform-smooth {
  transition: transform 0.3s ease-out;
}

/* Container Styles with RTS */
.workspace-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  transform-style: preserve-3d;
}

.bubble-view {
  overflow: hidden;
  touch-action: none;
  user-select: none;
  transform-style: preserve-3d;
}

.grid-view {
  overflow-y: auto;
  padding-top: 4rem;
}

/* Grass Layer - positioned behind search bar, extends full viewport width */
.grass-layer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100vw;
  height: 100px; /* Height to cover search bar area */
  z-index: 45; /* Behind search bar (z-index: 50) but above canvas elements */
  pointer-events: none;
  overflow: visible;
  transform: translateZ(90px);
}

.grass-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(to top, 
    rgba(34, 139, 34, 0.1) 0%,
    rgba(34, 139, 34, 0.05) 50%,
    transparent 100%);
}

.grass-blade {
  transition: transform 0.3s ease;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
  animation: grassSway 4s ease-in-out infinite;
  animation-delay: calc(var(--delay, 0) * 0.1s);
}

.grass-blade:nth-child(odd) {
  animation-direction: alternate;
}

.grass-blade:nth-child(even) {
  animation-direction: alternate-reverse;
}

.grass-blade:hover {
  transform: scale(1.1) rotate(calc(var(--rotation, 0deg) + 5deg));
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

/* Gentle swaying animation */
@keyframes grassSway {
  0%, 100% {
    transform: rotate(var(--rotation, 0deg)) translateX(0);
  }
  25% {
    transform: rotate(calc(var(--rotation, 0deg) + 2deg)) translateX(1px);
  }
  75% {
    transform: rotate(calc(var(--rotation, 0deg) - 2deg)) translateX(-1px);
  }
}

.workspace-search-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  transform: translateZ(100px);
  /* Behind configurator panel (z-index: 40) */
}

/* SVG Layer with depth */
.svg-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
  transform-style: preserve-3d;
}

/* Node Layer with 3D positioning */
.node-layer {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  transform-style: preserve-3d;
}

/* Animation States with depth */
.enter-active,
.leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.enter-from,
.leave-to {
  opacity: 0;
  transform: scale(0.95) translateZ(-20px);
}

/* Fade transition with depth */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateZ(-10px);
}

/* Performance Optimizations for RTS */
.hardware-accelerated {
  transform: translateZ(0);
  backface-visibility: hidden;
}

.media-drop-overlay {
  pointer-events: none;
  z-index: 100;
  transform: translateZ(200px);
}

/* RTS-specific drag behaviors */
.fixed {
  touch-action: none;
}

[draggable="true"] {
  cursor: move;
}

/* Transition for Overview and Detailed Views with RTS */
.transition-transform-overview {
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 500ms;
}

/* Waterfall Transition with depth */
.waterfall-enter-active,
.waterfall-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.waterfall-enter-from,
.waterfall-leave-to {
  opacity: 0;
  transform: translateY(20px) translateZ(-30px);
}

.waterfall-move {
  transition: transform 0.3s;
}

.waterfall-enter-active {
  transition-delay: 0.3s;
}

.p-6:hover {
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.25);
  transform: translateY(-6px) translateZ(10px);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* Enhanced overview transition overlay with depth */
.overview-transition-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(var(--color-base-200), 0.4);
  backdrop-filter: blur(4px);
  z-index: 50;
  opacity: 0;
  animation: fadeIn 0.3s forwards;
  transform: translateZ(150px);
}

.transition-blur {
  animation: blurEffect 0.5s forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateZ(150px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateZ(150px) scale(1);
  }
}

@keyframes blurEffect {
  0% {
    backdrop-filter: blur(0px);
    transform: scale(1);
  }

  50% {
    backdrop-filter: blur(6px);
    transform: scale(1.02);
  }

  100% {
    backdrop-filter: blur(0px);
    transform: scale(1);
  }
}

/* Enhanced bubble animation with 3D */
@keyframes bubblePulse {
  0% {
    transform: scale(1) translateZ(0px);
    box-shadow: 0 0 0 0 rgba(var(--color-primary), 0.7);
  }

  70% {
    transform: scale(1.05) translateZ(5px);
    box-shadow: 0 0 0 10px rgba(var(--color-primary), 0);
  }

  100% {
    transform: scale(1) translateZ(0px);
    box-shadow: 0 0 0 0 rgba(var(--color-primary), 0);
  }
}

.bubble-highlight {
  animation: bubblePulse 2s infinite;
}

/* Enhanced fade transitions with 3D */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px) translateZ(-20px);
}

/* Depth-based layering for better RTS effect */
.workspace-container>* {
  transform-style: preserve-3d;
}

/* Lighting effects for RTS atmosphere */
.rts-canvas::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  right: 2px;
  bottom: 2px;
  background: radial-gradient(ellipse 80% 60% at 50% 20%,
      rgba(255, 255, 255, 0.02) 0%,
      transparent 50%);
  pointer-events: none;
  z-index: 1000;
  transform: translateZ(300px);
  border-radius: 4px;
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  .rts-perspective {
    perspective: none !important;
  }

  .rts-transform,
  .rts-nodes-layer,
  .rts-canvas {
    transform-style: flat !important;
  }

  .rts-ground-plane {
    transform: none !important;
    opacity: 0.3 !important;
  }

  .transform-gpu {
    transform: none !important;
  }
}
</style>