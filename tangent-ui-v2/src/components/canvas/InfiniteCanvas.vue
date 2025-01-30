<template>
  <div class="fixed overflow-visible bg-background transition-all duration-300" :style="{
    left: sidePanelOpen ? '40vw' : '0',
    right: '0',
    top: '0',
    bottom: '0'
  }" @dragenter.prevent="handleDragEnter" @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop">

    <!-- Main Canvas -->
    <div ref="canvasRef"
      class="absolute inset-0 transition-transform duration-500 ease-in-out overscroll-none touch-pan-y"
      @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseUp"
      @mousedown="handleCanvasMouseDown" @touchstart="handleTouchStart" @touchmove="handleTouchMove" tabindex="0"
      @keydown="handleKeyDown">
      <!-- Canvas Transform Container -->
      <div class="absolute transform-gpu" :style="transformStyle"
        :class="{ 'transition-transform-overview': isWorkspaceOverview, overflow: 'visible' }">
        <!-- Overview Mode -->
        <template v-if="isWorkspaceOverview">
          <div class="absolute" :style="nodesLayerStyle">
            <div v-for="workspace in workspaces" :key="workspace.id"
              class="workspace-node relative p-6 bg-base-200/90 backdrop-blur rounded-xl border border-base-300 transition-all duration-500 hover:shadow-lg hover:-translate-y-1 cursor-move"
              :style="{
                position: 'absolute',
                left: `${workspace.x}px`,
                top: `${workspace.y}px`,
                transform: workspace.isExpanding ? 'scale(2)' : 'scale(1)',
                opacity: workspace.isExpanding ? 0 : 1,
                width: '300px'
              }" :data-workspace-id="workspace.id" @mousedown="(e) => handleWorkspaceMouseDown(e, workspace)"
              @click.stop="handleWorkspaceSelect(workspace)">
              <div class="text-lg font-semibold mb-2">
                {{ workspace.title }}
              </div>
              <div class="text-sm text-base-content/60 space-y-1">
                <div>
                  {{ workspace.nodeCount }} branches
                </div>
                <div>
                  Last updated: {{ new Date(workspace.lastUpdated).toLocaleString() }}
                </div>
              </div>
            </div>
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
              <MediaBranchNode v-if="node.type === 'media'" :ref="(el) => { if (el) mediaNodesRef[node.id] = el }"
                :node="node" :is-selected="isNodeFocused(node.id)" :selected-model="selectedModel"
                :open-router-api-key="openRouterApiKey" :zoom="zoom" :model-registry="modelRegistry"
                @select="handleNodeSelect(node.id)" @drag-start="handleDragStart" @create-branch="handleCreateBranch"
                @update-title="store.updateNodeTitle"
                @resend="(userMessageIndex) => handleResend(node.id, userMessageIndex)"
                @delete="() => store.removeNode(node.id)" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none'
                }" />

              <WebBranchNode v-else-if="node.type === 'web'" :node="node" :is-selected="isNodeFocused(node.id)"
                :selected-model="selectedModel" :open-router-api-key="openRouterApiKey" :zoom="zoom"
                :model-registry="modelRegistry" @select="handleNodeSelect(node.id)" @drag-start="handleDragStart"
                @create-branch="handleCreateBranch" @update-title="store.updateNodeTitle"
                @resend="(userMessageIndex) => handleResend(node.id, userMessageIndex)"
                @delete="() => store.removeNode(node.id)" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none'
                }" />

              <BranchNode v-else :node="node" :is-selected="isNodeFocused(node.id)" :selected-model="selectedModel"
                :open-router-api-key="openRouterApiKey" @input-focus="zoomToInput" :zoom="zoom"
                :model-registry="modelRegistry" @select="handleNodeSelect(node.id)" @drag-start="handleDragStart"
                @create-branch="handleCreateBranch" @update-title="store.updateNodeTitle"
                @resend="(userMessageIndex) => handleResend(node.id, userMessageIndex)"
                @delete="() => store.removeNode(node.id)" @update-position="handleNodePositionUpdate"
                @snap="handleNodeSnap" @unsnap="handleNodeUnsnap" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none'
                }" />
            </template>
          </div>
        </template>
      </div>
    </div>

    <!-- Overlays -->
    <div v-show="isDraggingFile"
      class="absolute inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center pointer-events-none z-50">
      <div class="text-2xl font-semibold text-primary">
        Drop media to create a new node
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch, PropType } from 'vue';
import BranchNode from './node/BranchNode.vue';
import WebBranchNode from './node/WebBranchNode.vue';
import MediaBranchNode from './node/MediaBranchNode.vue';
import SplineConnector from './spline/SplineConnector.vue';
import { useCanvasStore } from '../../stores/canvasStore';
import { useChatStore } from '../../stores/chatStore';
// Add near the top with other refs
const modelRegistry = ref(new Map<string, ModelInfo>());

// Add the ModelInfo interface
interface ModelInfo {
  id: string;
  name: string;
  source: 'ollama' | 'openrouter' | 'custom';
  provider?: string;
}

const store = useCanvasStore();
const chatStore = useChatStore();
const canvasRef = ref(null);

// State
const props = defineProps({
  selectedModel: {
    type: String,
    required: true,
    default: ''
  },
  openRouterApiKey: {
    type: String,
    required: true
  },
  modelType: {
    type: String,
    required: true,
    default: ''
  },
  sidePanelOpen: {
    type: Boolean,
    required: true
  },
  autoZoomEnabled: {
    type: Boolean,
    required: true
  },
  zoom: {  // Add this prop definition
    type: Number,
    required: true,
    default: 1
  },
  gestureMode: {
    type: String as PropType<'scroll' | 'zoom'>,
    required: true,
    default: 'zoom'
  }
});


const emit = defineEmits(['update:zoom', 'update:autoZoomEnabled']);

// Modify zoom ref to be computed
const zoom = computed({
  get: () => props.zoom,
  set: (value) => emit('update:zoom', value)
});

// Modify autoZoomEnabled to use prop
watch(() => props.autoZoomEnabled, (newValue) => {
  if (newValue) {
    autoFitNodes();
  }
});

const panX = ref(0);
const panY = ref(0);
const isPanning = ref(false);
const lastPanPosition = ref({ x: 0, y: 0 });
const focusedNodeId = ref(null);
const focusedTopicId = ref<string | null>(null);
const isDraggingFile = ref(false);
const mediaNodesRef = ref<InstanceType<typeof MediaBranchNode>[]>([]);


const lastActivityTimestamp = ref(Date.now());
const autoZoomEnabled = ref(true);
const isAutoZooming = ref(false);
const AUTO_CENTER_DELAY = 30000; // 30 seconds
const inactivityTimer = ref(null);

const isClusterVizFocused = ref(false);
const windowSize = ref({
  width: typeof window !== 'undefined' ? window.innerWidth : 1920,
  height: typeof window !== 'undefined' ? window.innerHeight : 1080
});

const workspaceDragState = ref({
  isDragging: false,
  activeId: null as string | null,
  offset: { x: 0, y: 0 }
});


const isWorkspaceOverview = ref(true);  // Whether we're showing workspaces list
const expandingWorkspaceId = ref<string | null>(null); // For transition animation
const workspaces = computed(() => {
  // Force recompute when isWorkspaceOverview changes
  const showingOverview = isWorkspaceOverview.value;

  return chatStore.chats.map((chat, index) => {
    // Calculate grid position
    const itemsPerRow = 3;
    const gridX = (index % itemsPerRow) * 350; // 350px spacing
    const gridY = Math.floor(index / itemsPerRow) * 250; // 250px spacing

    return {
      id: chat.id,
      title: chat.title,
      nodeCount: chat.nodeCount,
      lastUpdated: chat.updatedAt,
      x: chat.x || gridX + 100, // Add offset from left
      y: chat.y || gridY + 100, // Add offset from top
      isExpanding: expandingWorkspaceId.value === chat.id
    };
  });
});
const isBrowser = typeof window !== 'undefined';

const snappedNodeId = ref<string | null>(null);
const nodePositions = ref(new Map<string, { x: number, y: number }>());

const isFocusedMode = ref(true);
const rootNodeId = ref<string | null>(null);


// Helper Functions
const getNodeCenter = (node) => ({
  x: node.x + store.CARD_WIDTH / 2,
  y: node.y + store.CARD_HEIGHT / 2
});


// Modify the existing transformStyle computed property
const transformStyle = computed(() => {
  if (isWorkspaceOverview.value) {
    return {
      transform: `scale(1) translate(0, 0)`,
      transformOrigin: '0 0',
      transition: 'transform 0.3s ease-out'
    };
  }

  if (isFocusedMode.value && rootNodeId.value) {
    // In focused mode, center the root node and make it 75% of viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nodeWidth = store.CARD_WIDTH;
    const nodeHeight = store.CARD_HEIGHT;

    // Calculate scale to fit 75% of viewport while maintaining aspect ratio
    const scaleX = (vw * 0.75) / nodeWidth;
    const scaleY = (vh * 0.75) / nodeHeight;
    const scale = Math.min(scaleX, scaleY);

    // Center the node
    const translateX = (vw - nodeWidth * scale) / 2;
    const translateY = (vh - nodeHeight * scale) / 2;

    return {
      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
      transformOrigin: '0 0',
      transition: 'transform 0.3s ease-out'
    };
  }

  // Regular canvas transform for non-focused mode
  return {
    transform: `scale(${zoom.value}) translate(${panX.value / zoom.value}px, ${panY.value / zoom.value}px)`,
    transformOrigin: '0 0',
    width: '100000px',
    height: '100000px',
    transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none'
  };
});

const svgStyle = computed(() => ({
  width: '100000px',
  height: '100000px'
}));

const nodesLayerStyle = computed(() => ({
  width: '100000px',
  height: '100000px',
  left: 0,
  top: 0
}));

// In Canvas component, modify handleNodeSnap:
const handleNodeSnap = async ({ nodeId, originalPosition }) => {
  const node = store.nodes.find(n => n.id === nodeId);
  if (!node) return;

  store.isTransitioning = true;
  snappedNodeId.value = nodeId;
  nodePositions.value.set(nodeId, originalPosition);

  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  // First center the node in the viewport
  const targetZoom = 0.8; // Slightly zoomed out to ensure visibility
  const nodeCenter = {
    x: node.x + store.CARD_WIDTH / 2,
    y: node.y + store.CARD_HEIGHT / 2
  };

  // Center the node with slight vertical offset to account for header/input
  const verticalOffset = rect.height * 0.1;
  panX.value = (rect.width / 2) - (nodeCenter.x * targetZoom);
  panY.value = (rect.height / 2) - (nodeCenter.y * targetZoom) + verticalOffset;
  zoom.value = targetZoom;

  // Let the centering animation complete
  await new Promise(resolve => setTimeout(resolve, 300));
  store.isTransitioning = false;
};

const handleNodeUnsnap = async ({ nodeId, originalPosition }) => {
  snappedNodeId.value = null;

  const node = store.nodes.find(n => n.id === nodeId);
  if (!node) return;

  store.isTransitioning = true;

  // Return to previous zoom/pan centered on the node
  const rect = canvasRef.value?.getBoundingClientRect();
  if (rect) {
    const nodeCenter = {
      x: node.x + store.CARD_WIDTH / 2,
      y: node.y + store.CARD_HEIGHT / 2
    };

    // Use same zoom/pan logic as regular node selection
    const bounds = calculateNodeBounds(node);
    const newZoom = calculateRequiredZoom(bounds, rect);

    const verticalOffset = rect.height * 0.1;
    panX.value = (rect.width / 2) - (nodeCenter.x * newZoom);
    panY.value = (rect.height / 2) - (nodeCenter.y * newZoom) + verticalOffset;
    zoom.value = newZoom;
  }

  // Restore original position
  store.updateNodePosition(nodeId, originalPosition);
  nodePositions.value.delete(nodeId);

  await new Promise(resolve => setTimeout(resolve, 300));
  store.isTransitioning = false;
};

const handleWorkspaceMouseDown = (e: MouseEvent, workspace: { id: string }) => {
  e.stopPropagation();
  const canvasRect = canvasRef.value.getBoundingClientRect();

  // Calculate the initial click position in canvas coordinates
  const canvasX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
  const canvasY = (e.clientY - canvasRect.top - panY.value) / zoom.value;

  // Find the workspace to get its current position
  const currentWorkspace = chatStore.chats.find(chat => chat.id === workspace.id);
  if (!currentWorkspace) return;

  // Calculate offset from the workspace's position
  workspaceDragState.value = {
    isDragging: true,
    activeId: workspace.id,
    offset: {
      x: canvasX - currentWorkspace.x,
      y: canvasY - currentWorkspace.y
    }
  };

  // Add dragging class for visual feedback
  e.currentTarget.classList.add('dragging');
};


const calculateInputBounds = (nodeId: string) => {
  const inputElement = document.querySelector(`[data-node-id="${nodeId}"] .message-input`);
  if (!inputElement) return null;

  const node = store.nodes.find(n => n.id === nodeId);
  if (!node) return null;

  const inputRect = inputElement.getBoundingClientRect();
  const PADDING = 40;

  // Convert input height from screen to canvas coordinates
  const heightInCanvasCoords = inputRect.height / zoom.value;

  return {
    minX: node.x - PADDING,
    maxX: node.x + store.CARD_WIDTH + PADDING,
    minY: node.y + store.CARD_HEIGHT - heightInCanvasCoords - PADDING,
    maxY: node.y + store.CARD_HEIGHT + PADDING
  };
};

const zoomToInput = async (nodeId: string) => {
  const node = store.nodes.find(n => n.id === nodeId);
  if (!node) return;

  // Don't zoom if node is snapped
  if (document.querySelector(`[data-node-id="${nodeId}"].snapped`)) return;

  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  store.isTransitioning = true;
  focusedNodeId.value = nodeId;

  // Wait for next tick to ensure DOM is updated
  await nextTick();

  // Get input area bounds
  const bounds = calculateInputBounds(nodeId);
  if (!bounds) return;

  // Calculate zoom level - we want the input area to take up about 30% of the viewport height
  const desiredHeight = rect.height * 0.3;
  const inputHeight = bounds.maxY - bounds.minY;
  const newZoom = Math.min(Math.max(desiredHeight / inputHeight, 0.1), 2);

  // Calculate center position of input area
  const inputCenterX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
  const inputCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2;

  // Center the input in the viewport, slightly towards the bottom
  const verticalOffset = rect.height * 0.2; // 20% from bottom
  panX.value = (rect.width / 2) - (inputCenterX * newZoom);
  panY.value = (rect.height * 0.8) - (inputCenterY * newZoom);

  // Update zoom level
  zoom.value = newZoom;

  // Reset transition state after animation
  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
};

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
  const node = store.nodes.find(n => n.id === nodeId);
  if (!node) return;

  // Don't zoom if the node is snapped
  if (document.querySelector(`[data-node-id="${nodeId}"].snapped`)) {
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
  panX.value = (rect.width / 2) - (nodeCenterX * newZoom);
  panY.value = (rect.height / 2) - (nodeCenterY * newZoom) + verticalOffset;

  // Update zoom level
  zoom.value = newZoom;

  // Reset transition state after animation
  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
};


const calculateNodeBounds = (node) => {
  // Get the actual DOM element of the node
  const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
  if (!nodeElement) {
    // Fallback to fixed dimensions if element not found
    const PADDING = 100;
    return {
      minX: node.x - PADDING,
      maxX: node.x + store.CARD_WIDTH + PADDING,
      minY: node.y - PADDING,
      maxY: node.y + store.CARD_HEIGHT + PADDING
    };
  }

  // Get the actual dimensions from the DOM
  const nodeRect = nodeElement.getBoundingClientRect();
  const PADDING = 100; // Increased padding for better visibility

  // Convert the height from screen coordinates to canvas coordinates
  const heightInCanvasCoords = nodeRect.height / zoom.value;

  return {
    minX: node.x - PADDING,
    maxX: node.x + store.CARD_WIDTH + PADDING,
    minY: node.y - PADDING,
    maxY: node.y + heightInCanvasCoords + PADDING
  };
};


const handleNodePositionUpdate = (nodeId: string, position: { x: number, y: number }) => {
  store.updateNodePosition(nodeId, position);
};

const handleWheel = (e) => {
  if (document.querySelector('.branch-node.snapped') || snappedNodeId.value !== null) {
    return;
  }
  resetInactivityTimer();

  // Check if it's a two-finger gesture (trackpad)
  if (e.deltaMode === 0 && Math.abs(e.deltaY) < 50) {
    if (props.gestureMode === 'zoom') {
      // Zoom mode - use two fingers to zoom
      const ZOOM_SENSITIVITY = 0.005;
      const ZOOM_MIN = 0.1;
      const ZOOM_MAX = 5;

      const rect = canvasRef.value.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const mouseContentX = (mouseX - panX.value) / zoom.value;
      const mouseContentY = (mouseY - panY.value) / zoom.value;

      const delta = -e.deltaY;
      const newZoom = Math.min(
        Math.max(zoom.value * (1 + delta * ZOOM_SENSITIVITY), ZOOM_MIN),
        ZOOM_MAX
      );

      zoom.value = newZoom;
      panX.value = mouseX - mouseContentX * newZoom;
      panY.value = mouseY - mouseContentY * newZoom;
    } else {
      // Scroll mode - use two fingers to pan or zoom with CMD/CTRL key
      if (e.metaKey || e.ctrlKey) {
        // CMD/CTRL + wheel for zooming in any mode
        const ZOOM_SENSITIVITY = 0.005;
        const ZOOM_MIN = 0.1;
        const ZOOM_MAX = 5;

        const rect = canvasRef.value.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const mouseContentX = (mouseX - panX.value) / zoom.value;
        const mouseContentY = (mouseY - panY.value) / zoom.value;

        const delta = -e.deltaY;
        const newZoom = Math.min(
          Math.max(zoom.value * (1 + delta * ZOOM_SENSITIVITY), ZOOM_MIN),
          ZOOM_MAX
        );

        zoom.value = newZoom;
        panX.value = mouseX - mouseContentX * newZoom;
        panY.value = mouseY - mouseContentY * newZoom;
      } else {
        // Pan mode - use two fingers to pan
        panX.value -= e.deltaX;
        panY.value -= e.deltaY;
      }
    }
  } else {
    // Regular scroll for single-finger or non-trackpad
    panX.value -= e.deltaX;
    panY.value -= e.deltaY;
  }
};

const centerCanvas = () => {
  zoom.value = 1;
  panX.value = 0;
  panY.value = 0;
}

onMounted(() => {
  if (isBrowser) {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    if (canvasRef.value) {
      canvasRef.value.addEventListener('wheel', handleWheel, { passive: false });
    }

    if (store.nodes.length) {

      centerCanvas();

    }

    resetInactivityTimer();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('dragenter', handleDragEnter);
  window.removeEventListener('dragleave', handleDragLeave);
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('wheel', handleWheel);
  }
  if (inactivityTimer.value) {
    clearTimeout(inactivityTimer.value);
  }
});

watch(() => store.nodes.length, () => {
  resetInactivityTimer();
});

watch(() => store.nodes.length, (newLength, oldLength) => {
  if (newLength === 1 && oldLength === 0) {
    rootNodeId.value = store.nodes[0].id;
  }
});

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  // Check for both files and URLs
  if (e.dataTransfer?.types.includes('Files') || e.dataTransfer?.types.includes('text/uri-list')) {
    isDraggingFile.value = true;
    console.log('Drag enter with file or URL');
  }
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  // Set dropEffect to 'copy' to indicate we'll copy the file
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
};


const handleWorkspaceSelect = (workspace: { id: string }) => {
  // Start expansion animation
  expandingWorkspaceId.value = workspace.id;
  isWorkspaceOverview.value = false;

  // Calculate the workspace node's current center position
  const workspaceNode = document.querySelector(
    `[data-workspace-id="${workspace.id}"]`
  );
  const rect = workspaceNode?.getBoundingClientRect();
  if (!rect) return;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Animate canvas to center on this point
  const targetScale = 2;
  const duration = 500;
  const startPosition = {
    x: panX.value,
    y: panY.value,
    scale: zoom.value
  };

  // Animation frame
  const animate = (progress: number) => {
    const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease out

    zoom.value = startPosition.scale +
      (targetScale - startPosition.scale) * easeProgress;

    panX.value = startPosition.x +
      (centerX - startPosition.x) * easeProgress;
    panY.value = startPosition.y +
      (centerY - startPosition.y) * easeProgress;
  };

  // Run animation
  store.isTransitioning = true;
  const startTime = Date.now();

  const tick = () => {
    const progress = Math.min(1, (Date.now() - startTime) / duration);
    animate(progress);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      // Animation complete - load workspace
      store.loadChatState(workspace.id).then(() => {
        store.isTransitioning = false;
      });
    }
  };
  requestAnimationFrame(tick);
};

const returnToOverview = async () => {
  console.log('Returning to overview');

  // First set overview mode before clearing state
  isWorkspaceOverview.value = true;

  // Clear canvas store state
  store.clearCurrentWorkspace();

  // Force a fresh reload of chats
  await chatStore.loadChats();

  // Reset view parameters
  zoom.value = 1;
  panX.value = 0;
  panY.value = 0;
  expandingWorkspaceId.value = null; // Reset expanding state

  // Ensure DOM is updated before fitting nodes
  await nextTick();
  await chatStore.loadChats(); // Double-check chats are loaded
  autoFitNodes();
};



const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  // Only hide overlay if leaving the canvas container
  const rect = e.currentTarget?.getBoundingClientRect();
  if (rect) {
    const { clientX, clientY } = e;
    if (
      clientX <= rect.left ||
      clientX >= rect.right ||
      clientY <= rect.top ||
      clientY >= rect.bottom
    ) {
      isDraggingFile.value = false;
      console.log('Drag leave canvas');
    }
  }
};
const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  isDraggingFile.value = false;
  console.log('Drop event:', {
    selectedModel: props.selectedModel,
    modelType: props.modelType,
    apiKey: !!props.openRouterApiKey
  });

  // Calculate drop position in canvas coordinates first since we'll need it for both cases
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) {
    console.log('No canvas rect found');
    return;
  }

  const x = (e.clientX - rect.left - panX.value) / zoom.value;
  const y = (e.clientY - rect.top - panY.value) / zoom.value;

  // Check for URL first
  const url = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
  if (url && url.startsWith('http')) {
    console.log('URL dropped:', url);

    // Create new web node
    const newNode = store.addNode(null, -1, { x, y }, {
      type: 'web',
      title: url,
      url: url
    });

    // Center on new node
    centerOnNode(newNode.id);
    return;
  }

  // If not URL, check for files
  const files = e.dataTransfer?.files;
  if (!files?.length) {
    console.log('No files or URLs in drop');
    return;
  }

  const file = files[0];
  console.log('File type:', file.type);

  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    console.log('Invalid file type:', file.type);
    alert('Only image and video files are supported');
    return;
  }

  console.log('Creating media node at', { x, y });

  // Create new media node
  const newNode = store.addNode(null, -1, { x, y }, {
    type: 'media',
    title: file.name
  });

  // Wait for next tick to ensure refs are updated
  await nextTick();

  // Get the media node instance from our ref
  const mediaNode = mediaNodesRef.value[newNode.id];
  if (!mediaNode) {
    console.error('Media node not found after creation');
    store.removeNode(newNode.id);
    return;
  }

  try {
    const apiType = props.selectedModel.includes('gemini') ? 'gemini' :
      props.selectedModel.includes('/') && !props.selectedModel.includes('gemini') ? 'openrouter' : 'ollama';

    console.log('Processing media with:', {
      apiType,
      model: props.selectedModel
    });

    // Get the correct API key based on the API type
    const apiKey = apiType === 'gemini'
      ? localStorage.getItem('geminiApiKey')  // Use Gemini API key for Gemini models
      : props.openRouterApiKey;               // Use OpenRouter API key for OpenRouter models

    // Process the media file
    await mediaNode.processMedia(
      file,
      apiType,
      apiKey
    );

    // Center on new node
    centerOnNode(newNode.id);

  } catch (error) {
    console.error('Error processing media:', error);
    store.removeNode(newNode.id);
    alert('Failed to process media file');
  }
};

const centerOnNode = (nodeId) => {
  const node = store.nodes.find(n => n.id === nodeId);
  if (!node) return;

  store.isTransitioning = true;
  const center = getNodeCenter(node);

  const rect = canvasRef.value.getBoundingClientRect();

  // Calculate horizontal centering as before
  panX.value = (rect.width / 2) - (center.x * zoom.value);

  // Add vertical offset to account for input window
  // Move the node up by 20% of viewport height
  const verticalOffset = rect.height * 0.2;
  panY.value = (rect.height / 2) - (center.y * zoom.value) + verticalOffset;

  focusedNodeId.value = nodeId;

  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
};

const handleCreateBranch = (parentId: string, messageIndex: number, position: { x: number, y: number }, initialData: any) => {
  // Exit focused mode when creating a branch
  isFocusedMode.value = false;

  // Existing branch creation logic...
  const parentNode = store.nodes.find(n => n.id === parentId);
  if (!parentNode) return;

  const existingBranches = store.nodes.filter(n => n.parentId === parentId);
  const verticalOffset = existingBranches.length * (store.CARD_HEIGHT + 20);

  const adjustedPosition = {
    x: position.x,
    y: parentNode.y + verticalOffset
  };

  // Create the new node
  const newNode = store.addNode(parentId, messageIndex, adjustedPosition, {
    ...initialData,
    // Ensure vertical offset is preserved in node data
    y: adjustedPosition.y
  });

  // First center on the new node
  centerOnNode(newNode.id);

  // After creating branch, fit all nodes in view
  setTimeout(() => {
    autoFitNodes();
  }, 400);
};

const handleResend = async (nodeId: string, userMessageIndex: number) => {
  const node = store.nodes.find(n => n.id === nodeId);
  if (!node || !node.messages) return;

  const userMsg = node.messages[userMessageIndex];
  if (!userMsg || userMsg.role !== 'user') return;

  // Remove the AI response that follows this user message
  store.removeMessage(nodeId, userMessageIndex + 1);

  // Set up model info in registry before sending
  let modelInfo: ModelInfo;
  if (props.selectedModel === 'custom_model') {
    modelInfo = {
      id: 'custom_model',
      name: 'Custom Model',
      source: 'custom'
    };
  } else {
    modelInfo = {
      id: props.selectedModel,
      name: props.selectedModel.includes('/') ? props.selectedModel.split('/')[1] : props.selectedModel,
      source: props.modelType === 'ollama' ? 'ollama' : 'openrouter',
      provider: props.modelType === 'openrouter' ? props.selectedModel.split('/')[0] : undefined
    };
  }

  modelRegistry.value.set(props.selectedModel, modelInfo);

  // Pass false for addUserMessage since we're reusing the existing message
  await store.sendMessage(nodeId, userMsg.content, props.selectedModel, props.openRouterApiKey, false);
};

const findNodeInDirection = (currentNode, connections, direction) => {
  const connectedNodes = connections
    .filter(conn =>
      conn.parent.id === currentNode.id ||
      conn.child.id === currentNode.id
    )
    .map(conn =>
      conn.parent.id === currentNode.id ? conn.child : conn.parent
    );

  const currentCenter = getNodeCenter(currentNode);

  return connectedNodes
    .filter(node => {
      const nodeCenter = getNodeCenter(node);
      return direction === 'up'
        ? nodeCenter.y < currentCenter.y
        : nodeCenter.y > currentCenter.y;
    })
    .sort((a, b) => {
      const aCenter = getNodeCenter(a);
      const bCenter = getNodeCenter(b);
      const aDist = Math.abs(aCenter.y - currentCenter.y);
      const bDist = Math.abs(bCenter.y - currentCenter.y);
      return aDist - bDist;
    })[0]?.id;
};


const handleMouseUp = () => {
  if (workspaceDragState.value.isDragging) {
    const { activeId } = workspaceDragState.value;
    if (activeId) {
      // Save workspace position
      const workspace = chatStore.chats.find(chat => chat.id === activeId);
      if (workspace) {
        chatStore.updateChatMetadata(activeId, {
          x: workspace.x,
          y: workspace.y
        });
      }
    }
  }

  workspaceDragState.value = {
    isDragging: false,
    activeId: null,
    offset: { x: 0, y: 0 }
  };

  store.isDragging = false;
  store.activeNode = null;
  isPanning.value = false;
};

const handleCanvasMouseDown = (e) => {
  if (snappedNodeId.value !== null) return;
  // Check if the click was within a branch node, if so, do not pan.
  if (e.target instanceof Element && e.target.closest('.branch-node')) {
    return;
  }

  if (e.button === 0 && !store.isDragging) {
    isPanning.value = true;
    lastPanPosition.value = { x: e.clientX - panX.value, y: e.clientY - panY.value };
  }
};

const handleTouchMove = (e: TouchEvent) => {
  e.preventDefault(); // Prevent default browser behavior

  if (isPanning.value && e.touches.length === 2) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const centerX = (touch1.clientX + touch2.clientX) / 2;
    const centerY = (touch1.clientY + touch2.clientY) / 2;

    panX.value = centerX - lastPanPosition.value.x;
    panY.value = centerY - lastPanPosition.value.y;
  }
};
const handleTouchStart = (e: TouchEvent) => {
  e.preventDefault(); // Prevent default browser behavior

  if (e.touches.length === 2) {
    // If two fingers, start panning
    isPanning.value = true;
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const centerX = (touch1.clientX + touch2.clientX) / 2;
    const centerY = (touch1.clientY + touch2.clientY) / 2;
    lastPanPosition.value = { x: centerX - panX.value, y: centerY - panY.value };
  }
};

const handleKeyDown = (e) => {
  if (store.isTransitioning) return;

  if (e.key === 'Escape' && isClusterVizFocused.value) {
    unfocusClusterViz();
    return;
  }

  const currentNode = store.nodes.find(n => n.id === focusedNodeId.value);
  if (!currentNode) return;

  const connections = store.connections;
  let targetNodeId = null;

  switch (e.key) {
    case 'ArrowUp':
      targetNodeId = findNodeInDirection(currentNode, connections, 'up');
      break;
    case 'ArrowDown':
      targetNodeId = findNodeInDirection(currentNode, connections, 'down');
      break;
    case 'ArrowRight':
      targetNodeId = currentNode.parentId;
      break;
    case 'ArrowLeft':
      targetNodeId = connections
        .find(conn => conn.parent.id === currentNode.id)?.child.id;
      break;
  }

  if (targetNodeId) {
    centerOnNode(targetNodeId);
  }
};

const handleClusterVizClick = (e: MouseEvent) => {
  if (!isClusterVizFocused.value) {
    e.stopPropagation();

    store.isTransitioning = true;
    isClusterVizFocused.value = true;
    isPanning.value = false;
    store.isDragging = false;
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

  const bounds = store.nodes.reduce((acc, node) => {
    const nodeWidth = store.CARD_WIDTH;
    const nodeHeight = store.CARD_HEIGHT;

    return {
      minX: Math.min(acc.minX, node.x),
      maxX: Math.max(acc.maxX, node.x + nodeWidth),
      minY: Math.min(acc.minY, node.y),
      maxY: Math.max(acc.maxY, node.y + nodeHeight)
    };
  }, {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity
  });

  return bounds;
};

// Function to auto-center and zoom to fit all nodes
const autoFitNodes = () => {
  if (!canvasRef.value || !autoZoomEnabled.value || store.isDragging || isPanning.value) return;

  const bounds = calculateNodesBounds();
  if (!bounds) return;

  const rect = canvasRef.value.getBoundingClientRect();
  const padding = 100; // Padding around the nodes

  // Calculate required zoom to fit all nodes
  const contentWidth = bounds.maxX - bounds.minX + (padding * 2);
  const contentHeight = bounds.maxY - bounds.minY + (padding * 2);
  const scaleX = rect.width / contentWidth;
  const scaleY = rect.height / contentHeight;
  const newZoom = Math.min(scaleX, scaleY, 1); // Cap zoom at 1 to prevent too much zoom

  // Calculate center point of all nodes
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  isAutoZooming.value = true;
  store.isTransitioning = true;

  // Animate to new position and zoom
  zoom.value = newZoom;
  panX.value = (rect.width / 2) - (centerX * newZoom);
  panY.value = (rect.height / 2) - (centerY * newZoom);

  setTimeout(() => {
    isAutoZooming.value = false;
    store.isTransitioning = false;
  }, 300);
};


defineExpose({
  autoFitNodes,
  isWorkspaceOverview,
  returnToOverview
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

  if (workspaceDragState.value.isDragging && isWorkspaceOverview.value) {
    const { activeId, offset } = workspaceDragState.value;
    if (!activeId) return;

    const canvasRect = canvasRef.value.getBoundingClientRect();

    // Calculate the new position in canvas coordinates
    const canvasX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
    const canvasY = (e.clientY - canvasRect.top - panY.value) / zoom.value;

    // Update position in local state, using the same offset logic as node dragging
    const workspace = chatStore.chats.find(chat => chat.id === activeId);
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
      y: canvasY - store.dragOffset.y
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
    y: canvasY - node.y
  };
};

const handleTopicSelect = (topicId: string) => {
  focusedTopicId.value = topicId;
  centerOnNode(topicId);
};

// Active State Checks
const isNodeFocused = (nodeId) => focusedNodeId.value === nodeId;

const isConnectionActive = (connection) => {
  if (!focusedNodeId.value) return false;
  return connection.parent.id === focusedNodeId.value ||
    connection.child.id === focusedNodeId.value;
};

// Lifecycle
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  canvasRef.value?.focus();

  if (store.nodes.length) {
    centerOnNode(store.nodes[0].id);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
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

.workspace-node {
  position: absolute;
  transition: transform 0.1s ease-out, opacity 0.3s ease-out;
  will-change: transform;
}

.workspace-node.dragging {
  transition: none;
  cursor: grabbing;
}
</style>