<template>
  <div class="fixed overflow-visible bg-background transition-all duration-300" :style="{
    left: sidePanelOpen ? '40vw' : '0',
    right: '0',
    top: '0',
    bottom: '0',
  }" @dragenter.prevent="handleDragEnter" @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop">

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
              Your visual workspace for conversations with AI
            </p>
          </transition>
          <transition name="waterfall" appear>
            <div class="grid gap-6 text-center">
              <!-- Loop through feature cards -->
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

    <!-- Main Canvas -->
    <div v-else class="workspace-container">
      <Transition name="fade">
        <div v-if="notification.visible"
          class="fixed top-16 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-primary/80 text-primary-content rounded-lg shadow-lg z-50">
          {{ notification.message }}
        </div>
      </Transition>
      <!-- Bubble View -->
      <div v-if="viewMode === 'bubble' && isWorkspaceOverview" ref="canvasRef"
        class="bubble-view absolute inset-0 transition-transform duration-500 ease-in-out overscroll-none touch-pan-y"
        @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseUp"
        @mousedown="handleCanvasMouseDown" @touchstart="handleTouchStart" @touchmove="handleTouchMove" tabindex="0"
        @keydown="handleKeyDown" @wheel="handleWheel">

        <!-- Canvas Transform Container -->
        <div class="absolute transform-gpu" :style="transformStyle" :class="{
          'transition-transform-overview': isWorkspaceOverview,
          'overflow-visible': true,
        }">
          <!-- Bubble Layout -->
          <div class="absolute" :style="nodesLayerStyle">
            <FlowerWorkspaceNode v-for="workspace in filteredWorkspaces" :key="workspace.id" :workspace="workspace"
              :is-selected="selectedWorkspaceId === workspace.id" :max-node-count="maxNodeCount"
              :window-height="windowSize.value ? windowSize.value.height : 1080" :always-show-petals="alwaysShowPetals"
              @select="handleWorkspaceSelect(workspace.id)" @favorite="handleWorkspaceFavorite(workspace.id)"
              @duplicate="handleWorkspaceDuplicate(workspace.id)" @archive="handleWorkspaceArchive(workspace.id)"
              @export="handleWorkspaceExport(workspace.id)" @delete="handleWorkspaceDelete(workspace.id)" />
          </div>
        </div>
      </div>

      <!-- Grid View -->
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
              <!-- Media Node -->
              <MediaBranchNode v-if="node.type === 'media'" :ref="(el) => {
                if (el) mediaNodesRef.value[node.id] = el;
              }" :node="node" :is-selected="isNodeFocused(node.id)" :selected-model="selectedModel"
                :open-router-api-key="openRouterApiKey" :modelType="modelType" :zoom="zoom"
                :model-registry="modelRegistry" @select="handleNodeSelect(node.id)" @drag-start="handleDragStart"
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

              <!-- Branch Node (with input zoom on focus) -->
              <BranchNode v-else :node="node" :is-selected="isNodeFocused(node.id)"
                :is-snapped="store.snappedNodeId === node.id" :selected-model="selectedModel"
                :open-router-api-key="openRouterApiKey" :modelType="modelType" :zoom="zoom"
                :model-registry="modelRegistry" :is-side-panel-open="sidePanelOpen" @select="handleNodeSelect(node.id)"
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
import GridWorkspaceView from "../ui/GridWorkspaceView.vue";
import WorkspaceSearchBar from "../workspace/WorkspaceSearchBar.vue";
import WebBranchNode from "./node/WebBranchNode.vue";
import MediaBranchNode from "./node/MediaBranchNode.vue";
import SplineConnector from "./spline/MainSplineConnector.vue";
import { useCanvasStore } from "@/stores/canvasStore";
import { useChatStore } from "@/stores/chatStore";
import type { ModelInfo } from '@/types/model';
import PerformanceTestPanel from './PerformanceTestPanel.vue';
import { Plus, Circle, LayoutGrid } from "lucide-vue-next";

// Add near the top with other refs
const modelRegistry = ref(new Map<string, ModelInfo>());

const store = useCanvasStore();
const chatStore = useChatStore();
const canvasRef = ref(null);

// View modes and search
const viewMode = ref('bubble'); // 'bubble' or 'grid'
const searchQuery = ref('');
const perfTestPanel = ref(null);
const alwaysShowPetals = ref(localStorage.getItem('alwaysShowPetals') === 'true' || false);

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
const mediaNodesRef = ref<Record<string, InstanceType<typeof MediaBranchNode>>>(
  {}
);

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

const isWorkspaceOverview = ref(true); // Whether we're showing workspaces list
const expandingWorkspaceId = ref<string | null>(null); // For transition animation

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

// Workspaces with force-directed layout for bubble view
const workspaces = computed(() => {
  // Base workspace data
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

  // For bubble view, apply force-directed layout
  if (viewMode.value === 'bubble' && workspaceData.length > 0) {
    return simulateFlowerLayout(workspaceData);
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

// Computed styles
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

  // Overview mode: no scaling transformation
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
  viewBox: `0 0 ${windowSize.value.width} ${windowSize.value.height}`, // Dynamic viewBox
}));

const nodesLayerStyle = computed(() => ({
  width: "100000px",
  height: "100000px",
  left: 0,
  top: 0,
}));

provide('alwaysShowPetals', alwaysShowPetals);

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

    // Get the ID of the newly created root node. Assumes the first node is the root.
    const rootNodeId = store.nodes[0]?.id;
    if (rootNodeId) {
      nextTick(() => {
        centerAndSnapNode(rootNodeId);
      });
    }
  }
};

// Handle view mode toggle between bubble and grid
const handleViewModeToggle = (mode) => {
  viewMode.value = mode;

  // If switching to bubble view, reset canvas
  if (mode === 'bubble') {
    nextTick(() => {
      autoFitNodes();
    });
  }
};

const simulateFlowerLayout = (workspaceNodes) => {
  const nodes = JSON.parse(JSON.stringify(workspaceNodes));

  /* canvas dims */
  const canvasW = windowSize.value.width - (props.sidePanelOpen ? windowSize.value.width * 0.4 : 0);
  const canvasH = windowSize.value.height;
  const FLOOR = canvasH - 140;      // matches .flower‑ground

  /* physics consts */
  const G = 9.8 * 8;
  const AIR = 0.995;
  const DAMP = 0.6;
  const PAD = 25;                   // petal padding

  const maxCount = Math.max(...nodes.map(n => n.nodeCount || 1), 1);

  /* --- init ------------------------------------------------------- */
  nodes.forEach(n => {
    const baseR = 50 + ((n.nodeCount || 1) / maxCount) * 70;
    n.radius = baseR + PAD;
    n.mass = n.radius ** 2;

    /* ▶ spawn at least one full radius + 20 px below top‑edge */
    n.x = (isFinite(n.x) ? n.x : canvasW / 2) + (Math.random() - 0.5) * canvasW * 0.5;
    n.y = Math.max(n.radius + 20, baseR * 2 + Math.random() * 80);   // << key change

    n.vx = (Math.random() - 0.5) * 30;
    n.vy = Math.random() * 10;
  });

  /* --- Euler integrate  ------------------------------------------------ */
  const dt = 1 / 120;
  const STEPS = 1200;          // ≈10 s of settling – prevents overlaps
  for (let k = 0; k < STEPS; k++) {
    /* motion + gravity */
    nodes.forEach(a => {
      a.vy += G * dt;
      a.vx *= AIR; a.vy *= AIR;
      a.x += a.vx * dt;
      a.y += a.vy * dt;

      /* bounds */
      if (a.y + a.radius > FLOOR) { a.y = FLOOR - a.radius; a.vy *= -DAMP; a.vx *= 0.9; }
      if (a.y - a.radius < 0) { a.y = a.radius; a.vy *= -DAMP; }
      if (a.x - a.radius < 0) { a.x = a.radius; a.vx *= -DAMP; }
      if (a.x + a.radius > canvasW) { a.x = canvasW - a.radius; a.vx *= -DAMP; }
    });

    /* collisions */
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y, minD = a.radius + b.radius;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < minD * minD) {
          const dist = Math.sqrt(dist2) || 1, nx = dx / dist, ny = dy / dist;
          const overlap = minD - dist, tm = a.mass + b.mass;
          a.x -= nx * overlap * (b.mass / tm); a.y -= ny * overlap * (b.mass / tm);
          b.x += nx * overlap * (a.mass / tm); b.y += ny * overlap * (a.mass / tm);

          const relV = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          const J = -(1 + DAMP) * relV / (1 / a.mass + 1 / b.mass);
          a.vx -= J * nx / a.mass; a.vy -= J * ny / a.mass;
          b.vx += J * nx / b.mass; b.vy += J * ny / b.mass;
        }
      }
    }
  }

  /* strip sim props */
  nodes.forEach(n => { delete n.vx; delete n.vy; delete n.mass; });
  return nodes;
};


// Replace your resetWorkspacePhysics function with this improved version
const resetWorkspacePhysics = () => {
  // Reset workspace positions with better initial clustering
  const canvasWidth = windowSize.value.width - (props.sidePanelOpen ? windowSize.value.width * 0.4 : 0);
  const canvasHeight = windowSize.value.height;

  // Make the function available globally
  window.resetWorkspacePhysics = resetWorkspacePhysics;
  chatStore.chats.forEach((chat, index) => {
    // Calculate radius for workspace based on node count
    const nodeCount = chat.nodeCount || 1;
    const maxCount = Math.max(...chatStore.chats.map(c => c.nodeCount || 1), 1);
    const minSize = 80;
    const maxSize = 160;
    chat.radius = minSize + (nodeCount / maxCount) * (maxSize - minSize);

    // Position horizontally - spread across center 60% of screen with some randomness
    const horizontalRange = canvasWidth * 0.6;
    const centerX = canvasWidth / 2;
    const x = centerX + (Math.random() - 0.5) * horizontalRange;

    // Position vertically - start at top with some randomness
    const y = Math.max(chat.radius, Math.random() * 100);

    // Update positions in the chat store
    chatStore.updateChatMetadata(chat.id, {
      x: x,
      y: y,
      radius: chat.radius
    });

    window.resetWorkspacePhysics = resetWorkspacePhysics;
  });

  // Force re-simulation after a brief delay
  setTimeout(() => {
    if (viewMode.value === 'bubble') {
      // Force a re-render of the workspaces
      const chatCopy = [...chatStore.chats];
      chatStore.chats = [];

      nextTick(() => {
        chatStore.chats = chatCopy;

        // Then trigger auto-fit after DOM update
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

  // Calculate horizontal centering
  panX.value = rect.width / 2 - center.x * zoom.value;

  // Add vertical offset to account for input window
  // Move the node up by 20% of viewport height
  const verticalOffset = rect.height * 0.2;
  panY.value = rect.height / 2 - center.y * zoom.value + verticalOffset;

  focusedNodeId.value = nodeId;

  // Use nextTick to wait for the DOM to update after centering
  nextTick(() => {
    // Now, trigger the snap
    emit('snap', { nodeId: node.id, originalPosition: { x: node.x, y: node.y } });

    setTimeout(() => {
      store.isTransitioning = false;
    }, 300);
  });
};

// Watch for side panel changes
watch(() => props.sidePanelOpen, (isOpen) => {
  // Wait for panel transition to complete
  setTimeout(() => {
    if (props.autoZoomEnabled) {
      autoFitNodes();
    }
  }, 300); // Match the transition duration
}, { immediate: false });

// Handle height lock for nodes
const handleHeightLock = () => {
  const selectedNode = store.nodes.find((n) => n.id === focusedNodeId.value);
  if (!selectedNode) return;

  // Get the node's DOM element
  const nodeElement = document.querySelector(
    `[data-node-id="${selectedNode.id}"]`
  );
  if (!nodeElement) return;

  // Get the node's bounding rect relative to the viewport
  const nodeRect = nodeElement.getBoundingClientRect();
  const canvasRect = canvasRef.value?.getBoundingClientRect();
  if (!canvasRect) return;

  // Calculate which parts of the node are within the viewport
  const visibleTop = Math.max(0, canvasRect.top - nodeRect.top);
  const visibleBottom = Math.min(
    nodeRect.height,
    canvasRect.bottom - nodeRect.top
  );

  // Calculate the visible height in canvas coordinates (accounting for current zoom)
  const visibleHeight = (visibleBottom - visibleTop) / zoom.value;

  // Add some padding
  const paddedHeight = visibleHeight - 32;

  // Tell the store to set this height for the node
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

  store.isTransitioning = true;
  store.snapNode(nodeId);
  nodePositions.value.set(nodeId, originalPosition);

  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  // Calculate available width based on side panel state
  const availableWidth = props.sidePanelOpen ? rect.width * 0.6 : rect.width;

  const targetZoom = 0.8;

  const nodeCenter = {
    x: node.x + store.CARD_WIDTH / 2,
    y: node.y + store.CARD_HEIGHT / 2,
  };

  const sidePanelOffset = props.sidePanelOpen ? rect.width * 0.4 : 0; // Account for side panel
  const verticalOffset = rect.height * 0.1; // Vertical offset

  panX.value = sidePanelOffset + availableWidth / 2 - nodeCenter.x * targetZoom;
  panY.value = rect.height / 2 - nodeCenter.y * targetZoom + verticalOffset;

  zoom.value = targetZoom;

  await new Promise((resolve) => setTimeout(resolve, 300));
  store.isTransitioning = false;
};

// Handle node unsnapping
const handleNodeUnsnap = async ({ nodeId, originalPosition }) => {
  store.unsnapNode(nodeId);

  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  store.isTransitioning = true;

  // Return to previous zoom/pan centered on the node
  const rect = canvasRef.value?.getBoundingClientRect();
  if (rect) {
    const nodeCenter = {
      x: node.x + store.CARD_WIDTH / 2,
      y: node.y + store.CARD_HEIGHT / 2,
    };

    // Use same zoom/pan logic as regular node selection
    const bounds = calculateNodeBounds(node);
    const newZoom = calculateRequiredZoom(bounds, rect);

    const verticalOffset = rect.height * 0.1;
    panX.value = rect.width / 2 - nodeCenter.x * newZoom;
    panY.value = rect.height / 2 - nodeCenter.y * newZoom + verticalOffset;
    zoom.value = newZoom;
  }

  // Restore original position
  store.updateNodePosition(nodeId, originalPosition);
  nodePositions.value.delete(nodeId);

  await new Promise((resolve) => setTimeout(resolve, 300));
  store.isTransitioning = false;
};

// Handle focus on a node's input
const handleFocusInput = ({ nodeId }) => {
  // Find the branch node element
  const branchNodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (!branchNodeEl) return;

  // Assume your MessageInput component has a class or data attribute
  const inputEl = branchNodeEl.querySelector(".message-input");
  if (!inputEl) return;

  const inputRect = inputEl.getBoundingClientRect();
  const canvasRect = canvasRef.value.getBoundingClientRect();

  // Decide on a desired zoom level for focusing on the input
  const targetZoom = 1.5;

  // Calculate the input's center relative to the canvas
  const inputCenterX = inputRect.left + inputRect.width / 2;
  const inputCenterY = inputRect.top + inputRect.height / 2;
  const canvasCenterX = canvasRect.width / 2;
  const canvasCenterY = canvasRect.height / 2;

  // Adjust pan so that the input's center aligns with the canvas center
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
  return workspaceDragState.value.activeId || null; // Highlight the dragging workspace
});

// Calculate required zoom level for a node
const calculateRequiredZoom = (bounds, containerRect) => {
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  // Calculate zoom levels needed for both dimensions
  const zoomX = (containerRect.width * 0.9) / contentWidth; // Use 90% of container width
  const zoomY = (containerRect.height * 0.9) / contentHeight; // Use 90% of container height

  // Use the smaller zoom level to ensure the entire node fits
  // Cap zoom between 0.1 and 2 to prevent extreme zoom levels
  return Math.min(Math.max(Math.min(zoomX, zoomY), 0.1), 2);
};

// Handle node selection
const handleNodeSelect = async (nodeId: string) => {
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  // Don't zoom if the node is snapped
  if (store.snappedNodeId === nodeId) {
    focusedNodeId.value = nodeId;
    return;
  }

  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  store.isTransitioning = true;
  focusedNodeId.value = nodeId;

  // Wait for next tick to ensure DOM is updated
  await nextTick();

  // Calculate the bounds and required zoom
  const bounds = calculateNodeBounds(node);
  const newZoom = calculateRequiredZoom(bounds, rect);

  // Calculate the node's center position
  const nodeCenterX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
  const nodeCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2;

  // Calculate the required pan position to center the node
  // Add a slight vertical offset to account for the input area
  const verticalOffset = rect.height * 0.1; // 10% of viewport height
  panX.value = rect.width / 2 - nodeCenterX * newZoom;
  panY.value = rect.height / 2 - nodeCenterY * newZoom + verticalOffset;

  // Update zoom level using the computed property
  zoom.value = newZoom;

  // Reset transition state after animation
  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
};

// Calculate node bounds
const calculateNodeBounds = (node) => {
  if (!node) {
    if (!store.nodes.length) return null;

    // Calculate bounds for all nodes if no specific node is provided
    return store.nodes.reduce(
      (acc, node) => {
        // Get the actual DOM element for this node
        const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
        if (!nodeElement) return acc;

        // Get the actual rendered height
        const nodeRect = nodeElement.getBoundingClientRect();
        const actualHeight = nodeRect.height / zoom.value; // Convert from screen to canvas coordinates

        return {
          minX: Math.min(acc.minX, node.x),
          maxX: Math.max(acc.maxX, node.x + store.CARD_WIDTH),
          minY: Math.min(acc.minY, node.y),
          maxY: Math.max(acc.maxY, node.y + actualHeight), // Use actual height instead of CARD_HEIGHT
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

  // Calculate bounds for a specific node
  const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
  if (!nodeElement) {
    return {
      minX: node.x,
      maxX: node.x + store.CARD_WIDTH,
      minY: node.y,
      maxY: node.y + store.CARD_HEIGHT,
    };
  }

  const nodeRect = nodeElement.getBoundingClientRect();
  const actualHeight = nodeRect.height / zoom.value;

  return {
    minX: node.x,
    maxX: node.x + store.CARD_WIDTH,
    minY: node.y,
    maxY: node.y + actualHeight,
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
  // Check if CMD/Meta key is pressed
  // if (e.metaKey || e.ctrlKey) {
  //   // Let the NavigationWheel component handle this
  //   return;
  // }

  if ((e.target as HTMLElement).closest(".branch-node.snapped")) {
    console.log("Snapped node, ignoring wheel event");
    return;
  }

  resetInactivityTimer();

  const ZOOM_SENSITIVITY = 0.005;
  const ZOOM_MIN = 0.05;
  const ZOOM_MAX = 2;

  const rect = canvasRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Calculate point on content under mouse before zoom
  const contentX = (mouseX - panX.value) / zoom.value;
  const contentY = (mouseY - panY.value) / zoom.value;

  // Calculate new zoom
  const delta = props.gestureMode === "zoom" ? -e.deltaY : e.deltaX;
  const zoomDelta = props.gestureMode === "zoom" ? delta * ZOOM_SENSITIVITY : 0;
  const newZoom = Math.min(
    Math.max(zoom.value * (1 + zoomDelta), ZOOM_MIN),
    ZOOM_MAX
  );

  // Calculate new pan values
  if (props.gestureMode === "zoom") {
    panX.value = mouseX - contentX * newZoom;
    panY.value = mouseY - contentY * newZoom;
  } else {
    // pan using deltaX, deltaY based on gestureMode
    panX.value -= e.deltaX;
    panY.value -= e.deltaY;
  }
  // Set new zoom using the computed property
  zoom.value = newZoom;
};

// Center canvas
const centerCanvas = () => {
  zoom.value = 1;
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

// Clean up media node references when nodes change
watch(
  () => store.nodes,
  (newNodes) => {
    // Clear old refs that no longer exist
    Object.keys(mediaNodesRef.value).forEach((id) => {
      if (!newNodes.find((n) => n.id === id)) {
        delete mediaNodesRef.value[id];
      }
    });
  },
  { deep: true }
);

// Watch for window size changes
watch(
  () => [windowSize.value.width, windowSize.value.height],
  () => {
    // Recalculate layout/positions if needed
    if (props.autoZoomEnabled && !store.isDragging && !isPanning.value) {
      autoFitNodes();
    }
  },
  { deep: true }
);

// Handle file drag events
const handleDragEnter = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  // Only show media overlay if in workspace view with media files
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

  // Check if mouse is leaving the canvas
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

  // Only handle media files in workspace view
  if (isWorkspaceOverview.value) {
    return; // Let App.vue handle JSON files
  }

  isDraggingFile.value = false;
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    return; // Only handle media files
  }

  await nextTick(async () => {
    try {
      const rect = canvasRef.value?.getBoundingClientRect();
      if (!rect) throw new Error("Canvas reference not found");

      const position = {
        x: (e.clientX - rect.left - panX.value) / zoom.value,
        y: (e.clientY - rect.top - panY.value) / zoom.value,
      };

      const apiType = props.selectedModel.includes("gemini")
        ? "gemini"
        : props.selectedModel.includes("/")
          ? "openrouter"
          : "ollama";

      const apiKey =
        apiType === "gemini"
          ? localStorage.getItem("geminiApiKey")
          : props.openRouterApiKey;

      if (apiType !== "ollama" && !apiKey) {
        throw new Error(`No API key provided for ${apiType}`);
      }

      const newNode = store.addNode(null, -1, position, {
        type: "media",
        title: file.name,
      });

      await nextTick();
      await nextTick();

      const mediaNode = mediaNodesRef.value[newNode.id];
      if (!mediaNode) {
        throw new Error("Media node not found after creation");
      }

      await mediaNode.processMedia(file, apiType, apiKey);
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

  // Set dropEffect to 'copy' to indicate we'll copy the file
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "copy";
  }
};

const returnToOverview = async () => {
  console.log("Returning to overview");

  // Save current view state for transition
  const currentScale = zoom.value;
  const currentPanX = panX.value;
  const currentPanY = panY.value;

  // Add transition overlay
  const overlay = document.createElement('div');
  overlay.className = 'overview-transition-overlay';
  document.body.appendChild(overlay);

  // Enable transition for smooth effect
  store.isTransitioning = true;

  // Create "shrinking" effect on current workspace
  zoom.value = currentScale * 0.8;

  // Add slight blur effect during transition
  document.body.classList.add('transition-blur');

  setTimeout(async () => {
    // Reset view parameters
    zoom.value = 1;
    panX.value = 0;
    panY.value = 0;
    expandingWorkspaceId.value = null;

    // Then set overview mode and clear state
    isWorkspaceOverview.value = true;
    store.clearCurrentWorkspace();

    // Force a fresh reload of chats
    await chatStore.loadChats();

    // Wait for DOM update
    await nextTick();

    // Prepare for workspace entrance animation
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

    // Reset workspace physics to make them fall again
    resetWorkspacePhysics();

    // Remove blur and overlay when transition completes
    setTimeout(() => {
      document.body.classList.remove('transition-blur');
      document.body.removeChild(overlay);
      store.isTransitioning = false;
    }, 500);
  }, 300);
};

const handleWorkspaceSelect = async (workspaceId: string) => {
  console.log('Selecting workspace:', workspaceId);


  // Disable any ongoing transitions
  store.isTransitioning = false;

  // Set expanding state
  expandingWorkspaceId.value = workspaceId;

  // Get workspace node position before switching views
  const workspaceNode = document.querySelector(`[data-workspace-id="${workspaceId}"]`);
  if (!workspaceNode) {
    console.warn(`Could not find workspace node with id ${workspaceId}`);
    // Proceed with default position if element not found
    isWorkspaceOverview.value = false;
    await store.loadChatState(workspaceId);

    // IMPORTANT: Initialize expandedNodes with the new nodes
    expandedNodes.value = new Set(store.nodes.map(node => node.id));

    await nextTick();
    autoFitNodes();
    return;
  }

  const rect = workspaceNode.getBoundingClientRect();
  if (!rect) return;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Store initial state
  const startPosition = {
    x: panX.value,
    y: panY.value,
    scale: zoom.value
  };

  // Enable transitions for the animation
  store.isTransitioning = true;

  // Switch to detailed view
  isWorkspaceOverview.value = false;

  // Load chat state
  await store.loadChatState(workspaceId);

  // IMPORTANT: Initialize expandedNodes with the new nodes
  expandedNodes.value = new Set(store.nodes.map(node => node.id));

  // Wait for DOM update
  await nextTick();

  // Reset zoom and pan to match workspace position
  zoom.value = 1;
  panX.value = centerX - rect.width / 2;
  panY.value = centerY - rect.height / 2;

  // Wait another tick for position update
  await nextTick();

  // Perform auto-fit with transition
  autoFitNodes();

  // Add this line to emit the event
  emitter.emit('workspace-opened');

  // Disable transitions after animation
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
    // Refresh the workspaces list to trigger reordering
    await chatStore.loadChats();
  }
};

const handleWorkspaceDuplicate = async (workspaceId: string) => {
  await chatStore.duplicateChat(workspaceId);
  await chatStore.loadChats(); // Reload chats to update the list
  autoFitNodes(); // Recalculate positions
};

const handleWorkspaceArchive = (workspaceId: string) => {
  const workspace = chatStore.chats.find(chat => chat.id === workspaceId);
  if (workspace) {
    const newStatus = workspace.status === 'archived' ? 'active' : 'archived'; //toggle
    chatStore.updateChatMetadata(workspaceId, { status: newStatus });
  }
};

const handleWorkspaceExport = (workspaceId: string) => {
  // Implement export logic here
  alert(`Exporting workspace: ${workspaceId}`); // Placeholder
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

  // Calculate horizontal centering
  panX.value = rect.width / 2 - center.x * zoom.value;

  // Add vertical offset to account for input window
  // Move the node up by 20% of viewport height
  const verticalOffset = rect.height * 0.2;
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
  // Exit focused mode when creating a branch
  isFocusedMode.value = false;

  // Existing branch creation logic
  const parentNode = store.nodes.find((n) => n.id === parentId);
  if (!parentNode) return;

  const existingBranches = store.nodes.filter((n) => n.parentId === parentId);
  const verticalOffset = existingBranches.length * (store.CARD_HEIGHT + 20);

  // Adjust the position for the new branch
  const adjustedPosition = {
    x: position.x,
    y: parentNode.y + verticalOffset,
  };

  // Create the new node
  const newNode = store.addNode(parentId, messageIndex, adjustedPosition, {
    ...initialData,
    y: adjustedPosition.y,
  });

  // First center on the new node
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

  // Remove the AI response that follows this user message
  store.removeMessage(nodeId, userMessageIndex + 1);

  // Create proper ModelInfo object
  const modelInfo: ModelInfo = {
    id: props.selectedModel,
    name: props.selectedModel,
    source: props.modelType as 'ollama' | 'openrouter' | 'google' | 'anthropic' | 'openai'
  };

  // Pass ModelInfo object to sendMessage
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
      // Save workspace position using the chat store
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

  // Check for left button (button 0) and that we aren't dragging a node already
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

  if (isPanning.value && e.touches.length === 1) {
    // Single-finger pan
    const touch = e.touches[0];
    panX.value = touch.clientX - lastPanPosition.value.x;
    panY.value = touch.clientY - lastPanPosition.value.y;
  } else if (e.touches.length === 2) {
    // Two-finger zoom
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];

    // Calculate the midpoint between the two touches
    const centerX = (touch1.clientX + touch2.clientX) / 2;
    const centerY = (touch1.clientY + touch2.clientY) / 2;

    // Calculate distance between touches (for zoom)
    const distance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );

    if (!lastPanPosition.value.lastDistance) {
      // Initialize if not set
      lastPanPosition.value.lastDistance = distance;
    }

    const deltaDistance = distance - lastPanPosition.value.lastDistance;

    // Use the computed zoom property here
    const newZoom = Math.min(
      Math.max(zoom.value + deltaDistance * 0.01, 0.1),
      2
    );
    zoom.value = newZoom; // Use computed property setter

    // Calculate content coordinates under the midpoint before zoom
    const contentX = (centerX - panX.value) / zoom.value;
    const contentY = (centerY - panY.value) / zoom.value;

    // Update pan values based on the new zoom and midpoint
    panX.value = centerX - contentX * newZoom;
    panY.value = centerY - contentY * newZoom;

    // Store last distance for next move
    lastPanPosition.value.lastDistance = distance;
  }
};

const handleTouchStart = (e: TouchEvent) => {
  e.preventDefault();

  if (e.touches.length === 1) {
    // If one finger, start panning
    isPanning.value = true;
    const touch = e.touches[0];
    lastPanPosition.value = {
      x: touch.clientX - panX.value,
      y: touch.clientY - panY.value,
    };
  } else if (e.touches.length === 2) {
    // Initialize lastDistance for zoom
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
  // Gather connected nodes from the connection list as a fallback
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

  // Choose the candidate that is closest (by Euclidean distance)
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

  // Check if active element is an input or contentEditable element
  const activeTag = document.activeElement?.tagName.toLowerCase();
  const isEditing =
    activeTag === 'input' ||
    activeTag === 'textarea' ||
    document.activeElement?.hasAttribute('contenteditable');

  // Only process if not editing text and Command/Ctrl + P is pressed
  // Using CMD+P for "Petals" (avoiding CMD+F which is browser's find)
  if (!isEditing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault(); // Prevent browser's print dialog
    alwaysShowPetals.value = !alwaysShowPetals.value;
    localStorage.setItem('alwaysShowPetals', alwaysShowPetals.value.toString());

    // Show a brief notification of the change
    showNotification(alwaysShowPetals.value ? 'Petals: Always Visible' : 'Petals: Visible on Hover');
  }

  if (store.isTransitioning) return;

  // Handle relic navigation when a node is snapped
  if (store.snappedNodeId !== null) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      // Only handle left/right keys when a node is snapped
      // Emit an event for the SidePanel to handle
      emitter.emit('navigate-relic', {
        direction: e.key === "ArrowLeft" ? "previous" : "next",
        nodeId: store.snappedNodeId
      });

      // Prevent default to avoid scrolling
      e.preventDefault();
      return;
    }

    // If Escape is pressed while a node is snapped, unsnap it
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

  // Continue with existing keyboard navigation for non-snapped nodes
  const currentNode = store.nodes.find((n) => n.id === focusedNodeId.value);
  if (!currentNode) return;

  // Determine if the current node is part of a parent–child structure
  const parentNode = store.nodes.find((n) => n.id === currentNode.parentId);
  // Get all children of the current node, sorted top-to-bottom (by y coordinate)
  const children = store.nodes
    .filter((n) => n.parentId === currentNode.id)
    .sort((a, b) => a.y - b.y);

  let targetNodeId = null;

  if (e.key === "ArrowRight") {
    // If the current node has children, select the top-most child
    if (children.length > 0) {
      targetNodeId = children[0].id;
    } else {
      // Fallback: find a node that lies to the right of the current one
      targetNodeId = findClosestNodeInDirection(currentNode, "right");
    }
  } else if (e.key === "ArrowLeft") {
    // When pressing left, if there is a parent, go there
    if (parentNode) {
      targetNodeId = parentNode.id;
    } else {
      // Otherwise, fallback to geometry
      targetNodeId = findClosestNodeInDirection(currentNode, "left");
    }
  } else if (e.key === "ArrowUp") {
    // When the current node is a child, allow up to navigate to an earlier (upper) sibling
    if (parentNode) {
      const siblings = store.nodes
        .filter((n) => n.parentId === parentNode.id)
        .sort((a, b) => a.y - b.y);
      const index = siblings.findIndex((n) => n.id === currentNode.id);
      if (index > 0) {
        targetNodeId = siblings[index - 1].id;
      }
    }
    // Fallback: if nothing was found among siblings, try the geometric approach
    if (!targetNodeId) {
      targetNodeId = findClosestNodeInDirection(currentNode, "up");
    }
  } else if (e.key === "ArrowDown") {
    // When the current node is a child, allow down to navigate to a later (lower) sibling
    if (parentNode) {
      const siblings = store.nodes
        .filter((n) => n.parentId === parentNode.id)
        .sort((a, b) => a.y - b.y);
      const index = siblings.findIndex((n) => n.id === currentNode.id);
      if (index >= 0 && index < siblings.length - 1) {
        targetNodeId = siblings[index + 1].id;
      }
    }
    // Fallback: use geometry if no sibling was found
    if (!targetNodeId) {
      targetNodeId = findClosestNodeInDirection(currentNode, "down");
    }
  }

  if (targetNodeId) {
    focusedNodeId.value = targetNodeId;
    centerOnNode(targetNodeId);
  }
};

// Unfocus cluster visualization
const unfocusClusterViz = () => {
  // First step: Start unfocus transition
  store.isTransitioning = true;

  // Second step: Unfocus
  isClusterVizFocused.value = false;
  focusedTopicId.value = null;

  // Third step: After transition, re-enable canvas and reset
  setTimeout(() => {
    store.isTransitioning = false;
    autoFitNodes();
  }, 700); // Match the transition duration
};

// Auto-fit nodes
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
  const padding = isWorkspaceOverview.value ? 100 : 200; // Different padding for overview

  const contentWidth = bounds.maxX - bounds.minX + padding * 2;
  const contentHeight = bounds.maxY - bounds.minY + padding * 2;
  const scaleX = rect.width / contentWidth;
  const scaleY = rect.height / contentHeight;

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

// Calculate bounds for workspaces
const calculateWorkspacesBounds = () => {
  if (!chatStore.chats.length) return null;

  return chatStore.chats.reduce(
    (acc, workspace) => {
      return {
        minX: Math.min(acc.minX, workspace.x),
        maxX: Math.max(acc.maxX, workspace.x + 300), // Assuming 300px width
        minY: Math.min(acc.minY, workspace.y),
        maxY: Math.max(acc.maxY, workspace.y + 200), // Assuming 200px height
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

    // Calculate new position in canvas coordinates
    const canvasX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
    const canvasY = (e.clientY - canvasRect.top - panY.value) / zoom.value;

    // Update the workspace position in the local workspaces array
    const workspace = workspaces.value.find(w => w.id === activeId);
    if (workspace) {
      workspace.x = canvasX - offset.x;
      workspace.y = canvasY - offset.y;
    }

  } else if (store.isDragging && store.activeNode) {
    // Handle node dragging
    const canvasRect = canvasRef.value.getBoundingClientRect();

    // Calculate the new position in canvas space
    const canvasX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
    const canvasY = (e.clientY - canvasRect.top - panY.value) / zoom.value;

    // Update node position accounting for the initial click offset
    store.updateNodePosition(store.activeNode, {
      x: canvasX - store.dragOffset.x,
      y: canvasY - store.dragOffset.y,
    });
  } else if (isPanning.value) {
    // Handle canvas panning
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

  // Calculate the initial click position in canvas space
  const canvasX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
  const canvasY = (e.clientY - canvasRect.top - panY.value) / zoom.value;

  // Calculate offset from the node's position
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

    if (isBrowser && !isInitializing.value) {
      isInitializing.value = true;
      try {
        await chatStore.loadChats();

        if (store.nodes.length) {
          centerCanvas();
        } else {
          // If we're in overview mode (no nodes selected), trigger physics
          if (isWorkspaceOverview.value) {
            resetWorkspacePhysics();
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
});
</script>

<style scoped>
/* GPU Acceleration */
.transform-gpu {
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  perspective: 1000px;
  overflow: hidden;
}

/* Layout & Positioning */
.fixed {
  overflow: hidden;
  z-index: 40;
}

.absolute {
  overflow: visible;
}

/* Basic Transitions */
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

/* Focus States */
div:focus {
  outline: none;
}

div:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.1);
}

/* Canvas Controls */
.canvas-control {
  position: fixed;
  padding: 0.375rem 0.75rem;
  background-color: rgb(var(--color-base-200) / 0.9);
  backdrop-filter: blur(4px);
  border-radius: 9999px;
  border: 1px solid rgb(var(--color-base-300));
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
}

.canvas-control:hover {
  background-color: rgb(var(--color-base-300) / 0.9);
}

/* Transform Utilities */
.will-change-transform {
  will-change: transform;
}

.transform-smooth {
  transition: transform 0.3s ease-out;
}

/* Container Styles */
.workspace-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.bubble-view {
  overflow: hidden;
  touch-action: none;
  user-select: none;
}

.grid-view {
  overflow-y: auto;
  padding-top: 4rem;
}

.workspace-search-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
}

/* SVG Layer */
.svg-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
}

/* Node Layer */
.node-layer {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
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

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Performance Optimizations */
.hardware-accelerated {
  transform: translateZ(0);
  backface-visibility: hidden;
}

.media-drop-overlay {
  pointer-events: none;
  z-index: 100;
}

/* Add these to ensure drag events are captured properly */
.fixed {
  touch-action: none;
}

[draggable="true"] {
  cursor: move;
}

/* Transition for Overview and Detailed Views */
.transition-transform-overview {
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 500ms;
}

/* Waterfall Transition */
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

.p-6:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  transform: translateY(-4px);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.overview-transition-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(var(--color-base-200), 0.3);
  backdrop-filter: blur(3px);
  z-index: 50;
  opacity: 0;
  animation: fadeIn 0.3s forwards;
}

.transition-blur {
  animation: blurEffect 0.5s forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes blurEffect {
  0% {
    backdrop-filter: blur(0px);
  }

  50% {
    backdrop-filter: blur(5px);
  }

  100% {
    backdrop-filter: blur(0px);
  }
}

/* Bubble animation */
@keyframes bubblePulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(var(--color-primary), 0.7);
  }

  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(var(--color-primary), 0);
  }

  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(var(--color-primary), 0);
  }
}

.bubble-highlight {
  animation: bubblePulse 2s infinite;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}
</style>