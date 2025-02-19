// InfiniteCanvas.vue
<template>
  <div class="fixed overflow-visible bg-background transition-all duration-300" :style="{
    left: sidePanelOpen ? '40vw' : '0',
    right: '0',
    top: '0',
    bottom: '0',
  }" @dragenter.prevent="handleDragEnter" @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop">
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
                <div v-for="(feature, index) in features" :key="index" class=" p-6 bg-base-200/50 rounded-xl border border-base-300 hover:shadow-md hover:translate-y-[-4px]
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
    <div v-else ref="canvasRef"
      class="absolute inset-0 transition-transform duration-500 ease-in-out overscroll-none touch-pan-y"
      @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseUp"
      @mousedown="handleCanvasMouseDown" @touchstart="handleTouchStart" @touchmove="handleTouchMove" tabindex="0"
      @keydown="handleKeyDown" @wheel="handleWheel">
      <!-- Canvas Transform Container -->
      <div class="absolute transform-gpu" :style="transformStyle" :class="{
        'transition-transform-overview': isWorkspaceOverview,
        overflow: 'visible',
      }">
        <!-- Overview Mode -->
        <template v-if="isWorkspaceOverview">
          <div class="absolute" :style="nodesLayerStyle">
            <WorkspaceNode v-for="workspace in workspaces" :key="workspace.id" :workspace="workspace"
              :is-selected="selectedWorkspaceId === workspace.id" @select="handleWorkspaceSelect"
              @drag-start="handleWorkspaceDragStart" @update="handleWorkspaceUpdate"
              @favorite="handleWorkspaceFavorite(workspace.id)" @duplicate="handleWorkspaceDuplicate(workspace.id)"
              @archive="handleWorkspaceArchive(workspace.id)" @export="handleWorkspaceExport(workspace.id)"
              @delete="handleWorkspaceDelete(workspace.id)" />
          </div>
        </template>

        <!-- Detailed Workspace View -->
        <template v-else>
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
                :is-active="isConnectionActive(connection)" :zoom-level="zoom" />
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
                @resend="(userMessageIndex) =>
                  handleResend(node.id, userMessageIndex)
                  " @delete="() => store.removeNode(node.id)" @update-position="handleNodePositionUpdate"
                @snap="handleNodeSnap" @unsnap="handleNodeUnsnap" @focus-input="handleFocusInput" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning
                    ? 'transform 0.3s ease-out'
                    : 'none',
                }" />
            </template>
          </div>
        </template>
      </div>
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
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  watch,
  PropType,
} from "vue";
import BranchNode from "./node/BranchNode.vue";
import TangentLogo from '../logo/TangentLogo.vue';

import WebBranchNode from "./node/WebBranchNode.vue";
import MediaBranchNode from "./node/MediaBranchNode.vue";
import SplineConnector from "./spline/SplineConnector.vue";
import WorkspaceNode from "./node/WorkspaceNode.vue"; // Import WorkspaceNode
import { useCanvasStore } from "@/stores/canvasStore";
import { useChatStore } from "@/stores/chatStore";
import type { ModelInfo } from '@/types/model';
import { Plus } from "lucide-vue-next";
// Add near the top with other refs
const modelRegistry = ref(new Map<string, ModelInfo>());


const store = useCanvasStore();
const chatStore = useChatStore();
const canvasRef = ref(null);

// State
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
    // Add this prop definition
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

const emit = defineEmits([
  "update:zoom",
  "update:autoZoomEnabled",
  "update:isHeightLocked",
]);

// Modify zoom ref to be computed.  This is VERY IMPORTANT.
const zoom = computed({
  get: () => props.zoom,
  set: (value) => emit("update:zoom", value),
});

// Modify autoZoomEnabled to use prop
watch(
  () => props.autoZoomEnabled,
  (newValue) => {
    if (newValue) {
      autoFitNodes();
    }
  }
);

const panX = ref(0);
const panY = ref(0);
const isPanning = ref(false);
const lastPanPosition = ref({ x: 0, y: 0 });
const focusedNodeId = ref(null);
const focusedTopicId = ref<string | null>(null);
const isDraggingFile = ref(false);
const mediaNodesRef = ref<Record<string, InstanceType<typeof MediaBranchNode>>>(
  {}
);

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

// Workspace Dragging State - Now simpler
const workspaceDragState = ref({
  isDragging: false,
  activeId: null as string | null,
  offset: { x: 0, y: 0 }, // Store offset here
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
const workspaces = computed(() => {
  const showingOverview = isWorkspaceOverview.value;

  // Calculate optimal grid layout
  const contentWidth =
    windowSize.value.width -
    (props.sidePanelOpen ? windowSize.value.width * 0.4 : 0);
  const cardWidth = 300; // Width of each workspace card
  const cardHeight = 200; // Height of each workspace card
  const horizontalGap = 80; // Increased gap between cards horizontally
  const verticalGap = 40; // Gap between cards vertically

  // Calculate how many cards can fit in a row
  const cardsPerRow = Math.max(
    1,
    Math.floor((contentWidth - 100) / (cardWidth + horizontalGap))
  );

  return chatStore.chats.map((chat, index) => {
    // Calculate grid position
    const row = Math.floor(index / cardsPerRow);
    const col = index % cardsPerRow;

    // Center the entire grid
    const totalWidth = cardsPerRow * (cardWidth + horizontalGap) - horizontalGap;
    const leftOffset = (contentWidth - totalWidth) / 2;

    // Calculate actual position
    const x = leftOffset + col * (cardWidth + horizontalGap) + 50;
    const y = row * (cardHeight + verticalGap) + 100; // Add top margin

    return {
      id: chat.id,
      title: chat.title,
      nodeCount: chat.nodeCount,
      lastUpdated: chat.updatedAt,
      x: chat.x || x,
      y: chat.y || y,
      isExpanding: expandingWorkspaceId.value === chat.id,
      tags: chat.tags || [],  // Ensure tags exist
      color: chat.color,      // Ensure color exists
    };
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

  // Regular mode: scale and translate,  use the computed `zoom` here!
  return {
    transform: `scale(${zoom.value}) translate(${panX.value / zoom.value}px, ${panY.value / zoom.value
      }px)`,
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

const handleNewWorkspace = async () => {

  if (store.snappedNodeId) {
    store.popSnappedNode()
  }
  await store.clearCurrentWorkspace();

  const newWorkspaceId = await store.createNewWorkspace();
  if (newWorkspaceId) {
    await chatStore.loadChats();
    await store.loadChatState(newWorkspaceId);

    // Get the ID of the newly created root node.  Assumes the first node is the root.
    const rootNodeId = store.nodes[0]?.id;
    if (rootNodeId) {
      nextTick(() => {
        centerAndSnapNode(rootNodeId);
      });
    }
  }
};

// NEW FUNCTION: centerAndSnapNode
const centerAndSnapNode = (nodeId: string) => {
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  store.isTransitioning = true;

  const center = getNodeCenter(node);
  const rect = canvasRef.value.getBoundingClientRect();

  // Calculate horizontal centering as before
  panX.value = rect.width / 2 - center.x * zoom.value; // Use computed zoom

  // Add vertical offset to account for input window
  // Move the node up by 20% of viewport height
  const verticalOffset = rect.height * 0.2;
  panY.value = rect.height / 2 - center.y * zoom.value + verticalOffset;

  focusedNodeId.value = nodeId;

  // Use nextTick to wait for the DOM to update *after* centering
  nextTick(() => {
    // Now, trigger the snap.
    emit('snap', { nodeId: node.id, originalPosition: { x: node.x, y: node.y } });

    setTimeout(() => {
      store.isTransitioning = false;
    }, 300);
  });
};

watch(() => props.sidePanelOpen, (isOpen) => {
  // Wait for panel transition to complete
  setTimeout(() => {
    if (props.autoZoomEnabled) {
      autoFitNodes();
    }
  }, 300); // Match the transition duration
}, { immediate: false });


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

  // Add some padding (e.g., 32px = 2rem)
  const paddedHeight = visibleHeight - 32;

  // Tell the store to set this height for the node
  store.setNodeHeightLock(selectedNode.id, paddedHeight);

  emit("update:isHeightLocked", true);
};

const handleHeightUnlock = () => {
  if (focusedNodeId.value) {
    store.clearNodeHeightLock(focusedNodeId.value);
  }
  emit("update:isHeightLocked", false);
};

// In Canvas component, modify handleNodeSnap:
const handleNodeSnap = async ({ nodeId, originalPosition }) => {
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  store.isTransitioning = true;
  //snappedNodeId.value = nodeId; NO
  store.snapNode(nodeId);
  nodePositions.value.set(nodeId, originalPosition);

  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  // Calculate available width based on side panel state
  const availableWidth = props.sidePanelOpen ? rect.width * 0.6 : rect.width;

  // THIS WAS THE KEY ERROR: Use computed zoom.value, not the prop
  const targetZoom = 0.8;

  const nodeCenter = {
    x: node.x + store.CARD_WIDTH / 2,
    y: node.y + store.CARD_HEIGHT / 2,
  };

  const sidePanelOffset = props.sidePanelOpen ? rect.width * 0.4 : 0; // Account for side panel
  const verticalOffset = rect.height * 0.1; // Vertical offset

  panX.value =
    sidePanelOffset + availableWidth / 2 - nodeCenter.x * targetZoom;
  panY.value = rect.height / 2 - nodeCenter.y * targetZoom + verticalOffset;

  // *** USE THE COMPUTED PROPERTY HERE ***
  zoom.value = targetZoom;

  await new Promise((resolve) => setTimeout(resolve, 300));
  store.isTransitioning = false;
};

const handleNodeUnsnap = async ({ nodeId, originalPosition }) => {
  //snappedNodeId.value = null;
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

    // *** USE THE COMPUTED ZOOM PROPERTY ***
    const newZoom = calculateRequiredZoom(bounds, rect);

    const verticalOffset = rect.height * 0.1;
    panX.value = rect.width / 2 - nodeCenter.x * newZoom;
    panY.value = rect.height / 2 - nodeCenter.y * newZoom + verticalOffset;
    zoom.value = newZoom; // And here!
  }

  // Restore original position
  store.updateNodePosition(nodeId, originalPosition);
  nodePositions.value.delete(nodeId);

  await new Promise((resolve) => setTimeout(resolve, 300));
  store.isTransitioning = false;
};


const handleFocusInput = ({ nodeId }) => {
  // Find the branch node element
  const branchNodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (!branchNodeEl) return;

  // Assume your MessageInput component has a class or data attribute (e.g. "message-input")
  const inputEl = branchNodeEl.querySelector(".message-input");
  if (!inputEl) return;

  const inputRect = inputEl.getBoundingClientRect();
  const canvasRect = canvasRef.value.getBoundingClientRect();

  // Decide on a desired zoom level for focusing on the input.
  const targetZoom = 1.5; // tweak as needed

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

// --- Workspace Event Handlers (Simplified) ---
const handleWorkspaceDragStart = (dragData) => {
  workspaceDragState.value.isDragging = true;
  workspaceDragState.value.activeId = dragData.id;
  workspaceDragState.value.offset = dragData.offset; // Store offset
  // No longer adding 'dragging' class here - it's handled in WorkspaceNode
};

const selectedWorkspaceId = computed(() => {
  if (!isWorkspaceOverview.value) return null;
  return workspaceDragState.value.activeId || null; // Highlight the dragging workspace
});

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

// Updated handleNodeSelect function
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
  const newZoom = calculateRequiredZoom(bounds, rect); // Use computed zoom.value

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

const calculateNodeBounds = () => {
  if (!store.nodes.length) return null;

  const bounds = store.nodes.reduce(
    (acc, node) => {
      // Get the actual DOM element for this node
      const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
      if (!nodeElement) return acc;

      // Get the actual rendered height
      const nodeRect = nodeElement.getBoundingClientRect();
      const actualHeight = nodeRect.height / zoom.value; // Convert from screen to canvas coordinates, using computed zoom

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

  return bounds;
};

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

  resetInactivityTimer();

  const ZOOM_SENSITIVITY = 0.005;
  const ZOOM_MIN = 0.05;
  const ZOOM_MAX = 2;

  const rect = canvasRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Calculate point on content under mouse before zoom
  const contentX = (mouseX - panX.value) / zoom.value; // Use computed zoom.value
  const contentY = (mouseY - panY.value) / zoom.value;

  // Calculate new zoom
  const delta = props.gestureMode === "zoom" ? -e.deltaY : e.deltaX; // Pan in X direction if not zooming
  const zoomDelta = props.gestureMode === "zoom" ? delta * ZOOM_SENSITIVITY : 0; // Only zoom if in zoom mode
  const newZoom = Math.min(
    Math.max(zoom.value * (1 + zoomDelta), ZOOM_MIN),
    ZOOM_MAX
  ); // Use computed zoom.value

  // Calculate new pan values
  if (props.gestureMode === "zoom") {
    panX.value = mouseX - contentX * newZoom; // Correct pan calculation
    panY.value = mouseY - contentY * newZoom;
  } else {
    // pan using deltaX, deltaY based on gestureMode
    panX.value -= e.deltaX;
    panY.value -= e.deltaY;
  }
  // Set new zoom using the computed property
  zoom.value = newZoom;
};

const centerCanvas = () => {
  zoom.value = 1;
  panX.value = 0;
  panY.value = 0;
};

const isInitializing = ref(false);


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


//Corrected watch statement
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


watch(
  () => [windowSize.value.width, windowSize.value.height],
  () => {
    // Recalculate layout/positions if needed
  },
  { deep: true }
);

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

// --- Workspace Selection and Animation ---

const returnToOverview = async () => {
  console.log("Returning to overview");

  // First disable transitions
  store.isTransitioning = false;

  // Reset all view parameters first
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

  // Re-enable transitions for the auto-fit
  store.isTransitioning = true;
  autoFitNodes();

  // Disable transitions after auto-fit animation
  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
};

const handleWorkspaceSelect = async (workspaceId: string) => {
  // Disable any ongoing transitions
  store.isTransitioning = false;

  // Set expanding state
  expandingWorkspaceId.value = workspaceId;

  // Get workspace node position before switching views
  const workspaceNode = document.querySelector(`[data-workspace-id="${workspaceId}"]`);
  const rect = workspaceNode?.getBoundingClientRect();
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

  // Disable transitions after animation
  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
};

// --- Workspace Updates (CRUD) ---

const handleWorkspaceUpdate = (updateData) => {
  // updateData will contain { id, ...otherProps }
  chatStore.updateChatMetadata(updateData.id, updateData);
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
  // Implement export logic here.  Could open a modal, generate a file, etc.
  alert(`Exporting workspace: ${workspaceId}`); // Placeholder
};

const handleWorkspaceDelete = async (workspaceId: string) => {
  if (confirm("Are you sure you want to delete this workspace?")) {
    await chatStore.deleteChat(workspaceId);
    await chatStore.loadChats();
    autoFitNodes();
  }
};


const centerOnNode = (nodeId) => {
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  store.isTransitioning = true;
  const center = getNodeCenter(node);

  const rect = canvasRef.value.getBoundingClientRect();

  // Calculate horizontal centering as before
  panX.value = rect.width / 2 - center.x * zoom.value; // Use computed zoom

  // Add vertical offset to account for input window
  // Move the node up by 20% of viewport height
  const verticalOffset = rect.height * 0.2;
  panY.value = rect.height / 2 - center.y * zoom.value + verticalOffset;

  focusedNodeId.value = nodeId;

  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
};

const handleCreateBranch = (
  parentId: string,
  messageIndex: number,
  position: { x: number; y: number },
  initialData: any
) => {
  // Exit focused mode when creating a branch
  isFocusedMode.value = false;

  // Existing branch creation logic...
  const parentNode = store.nodes.find((n) => n.id === parentId);
  if (!parentNode) return;

  const existingBranches = store.nodes.filter((n) => n.parentId === parentId);
  const verticalOffset = existingBranches.length * (store.CARD_HEIGHT + 20);

  // Adjust the position for the new branch.
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
    modelInfo, // Pass the ModelInfo object instead of just the model ID string
    props.openRouterApiKey,
    false
  );
};

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

// New helper to find a fallback candidate using geometry:
const findClosestNodeInDirection = (currentNode, direction) => {
  const currentCenter = getNodeCenter(currentNode);
  // Gather connected nodes from the connection list as a fallback.
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

// New keydown handler:
const handleKeyDown = (e: KeyboardEvent) => {
  if (store.isTransitioning) return; // Add this line
  const currentNode = store.nodes.find((n) => n.id === focusedNodeId.value);
  if (!currentNode) return;

  // Determine if the current node is part of a parent–child structure.
  const parentNode = store.nodes.find((n) => n.id === currentNode.parentId);
  // Get all children of the current node, sorted top-to-bottom (by y coordinate)
  const children = store.nodes
    .filter((n) => n.parentId === currentNode.id)
    .sort((a, b) => a.y - b.y);

  let targetNodeId = null;

  if (e.key === "ArrowRight") {
    // If the current node has children, select the top-most child.
    if (children.length > 0) {
      targetNodeId = children[0].id;
    } else {
      // Fallback: find a node that lies to the right of the current one.
      targetNodeId = findClosestNodeInDirection(currentNode, "right");
    }
  } else if (e.key === "ArrowLeft") {
    // When pressing left, if there is a parent, go there.
    if (parentNode) {
      targetNodeId = parentNode.id;
    } else {
      // Otherwise, fallback to geometry.
      targetNodeId = findClosestNodeInDirection(currentNode, "left");
    }
  } else if (e.key === "ArrowUp") {
    // When the current node is a child (i.e. it has a parent),
    // allow up to navigate to an earlier (upper) sibling.
    if (parentNode) {
      const siblings = store.nodes
        .filter((n) => n.parentId === parentNode.id)
        .sort((a, b) => a.y - b.y);
      const index = siblings.findIndex((n) => n.id === currentNode.id);
      if (index > 0) {
        targetNodeId = siblings[index - 1].id;
      }
    }
    // Fallback: if nothing was found among siblings, try the geometric approach.
    if (!targetNodeId) {
      targetNodeId = findClosestNodeInDirection(currentNode, "up");
    }
  } else if (e.key === "ArrowDown") {
    // When the current node is a child, allow down to navigate to a later (lower) sibling.
    if (parentNode) {
      const siblings = store.nodes
        .filter((n) => n.parentId === parentNode.id)
        .sort((a, b) => a.y - b.y);
      const index = siblings.findIndex((n) => n.id === currentNode.id);
      if (index >= 0 && index < siblings.length - 1) {
        targetNodeId = siblings[index + 1].id;
      }
    }
    // Fallback: use geometry if no sibling was found.
    if (!targetNodeId) {
      targetNodeId = findClosestNodeInDirection(currentNode, "down");
    }
  }

  if (targetNodeId) {
    focusedNodeId.value = targetNodeId;
    centerOnNode(targetNodeId);
  }
};

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

// Event Handlers
const calculateNodesBounds = () => {
  if (!store.nodes.length) return null;

  const bounds = store.nodes.reduce(
    (acc, node) => {
      const nodeWidth = store.CARD_WIDTH;
      const nodeHeight = store.CARD_HEIGHT;

      return {
        minX: Math.min(acc.minX, node.x),
        maxX: Math.max(acc.maxX, node.x + nodeWidth),
        minY: Math.min(acc.minY, node.y),
        maxY: Math.max(acc.maxY, node.y + nodeHeight),
      };
    },
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    }
  );

  return bounds;
};

const autoFitNodes = () => {
  if (
    !canvasRef.value ||
    !autoZoomEnabled.value ||
    store.isDragging ||
    isPanning.value ||
    workspaceDragState.value.isDragging
  )
    return;

  const bounds = isWorkspaceOverview.value ? calculateWorkspacesBounds() : calculateNodeBounds();
  if (!bounds) return;

  const rect = canvasRef.value.getBoundingClientRect();
  const padding = isWorkspaceOverview.value ? 100 : 200; // Different padding for overview

  const contentWidth = bounds.maxX - bounds.minX + padding * 2;
  const contentHeight = bounds.maxY - bounds.minY + padding * 2;
  const scaleX = rect.width / contentWidth;
  const scaleY = rect.height / contentHeight;

  // *** KEY CHANGE: Use computed zoom.value ***
  const newZoom = Math.min(scaleX, scaleY, 1);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  isAutoZooming.value = true;
  store.isTransitioning = true;

  zoom.value = newZoom; // Use the computed property setter
  panX.value = rect.width / 2 - centerX * newZoom;
  panY.value = rect.height / 2 - centerY * newZoom;

  setTimeout(() => {
    isAutoZooming.value = false;
    store.isTransitioning = false;
  }, 300);
};

// Add this new function to calculate bounds for workspaces
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
defineExpose({
  autoFitNodes,
  isWorkspaceOverview,
  returnToOverview,
  handleHeightLock,
  handleHeightUnlock,
});

// Function to reset inactivity timer
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

const handleMouseMove = (e) => {
  if (snappedNodeId.value !== null) return;
  if (isClusterVizFocused.value) return;
  resetInactivityTimer();

  if (workspaceDragState.value.isDragging) {
    const { activeId, offset } = workspaceDragState.value;
    if (!activeId) return;

    const canvasRect = canvasRef.value.getBoundingClientRect();

    //Calculate new postition in canvas coordinates
    const canvasX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
    const canvasY = (e.clientY - canvasRect.top - panY.value) / zoom.value;

    // Update the workspace position in the *local* workspaces array
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
}; // Correctly closed handleDragStart

const handleTopicSelect = (topicId: string) => {
  focusedTopicId.value = topicId;
  centerOnNode(topicId);
};

// Active State Checks
const isNodeFocused = (nodeId) => focusedNodeId.value === nodeId;

const isConnectionActive = (connection) => {
  if (!focusedNodeId.value) return false;
  return (
    connection.parent.id === focusedNodeId.value ||
    connection.child.id === focusedNodeId.value
  );
};

// Lifecycle

onMounted(async () => { // Make onMounted async
  if (isBrowser) {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    if (canvasRef.value) {
      canvasRef.value.addEventListener("wheel", handleWheel, {
        passive: false,
      });
    }

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
.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  touch-action: none;
  user-select: none;
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

/* REMOVE: Styles for .workspace-node are now in WorkspaceNode.vue */

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
  /* Needed for v-for reordering to animate smoothly */
}

.waterfall-enter-active {
  transition-delay: 0.3s;
}

.p-6:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  transform: translateY(-4px);
  /* Slight upward movement */
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  /* Smooth transition */
}
</style>