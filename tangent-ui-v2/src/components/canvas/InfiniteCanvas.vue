// InfiniteCanvas.vue
<template>
  <div class="fixed overflow-hidden bg-background transition-all duration-300" :style="{
    left: sidePanelOpen ? '40vw' : '0',
    right: '0',
    top: '0',
    bottom: '0'
  }">
    <!-- Main Canvas -->
    <div ref="canvasRef" class="absolute inset-0 transition-transform duration-500 ease-in-out"
      :class="{ '-translate-x-1/2': store.viewMode === '3d' }" @mousemove="handleMouseMove" @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp" @mousedown="handleCanvasMouseDown" tabindex="0" @keydown="handleKeyDown">
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
            <SplineConnector :start-node="connection.parent" :end-node="connection.child" :card-width="store.CARD_WIDTH"
              :card-height="store.CARD_HEIGHT" :is-active="isConnectionActive(connection)" :zoom-level="zoom" />
          </template>
        </svg>

        <!-- Nodes Layer -->
        <div class="absolute" :style="nodesLayerStyle" style="z-index: 2">
          <BranchNode v-for="node in store.nodes" :key="node.id" :open-router-api-key="openRouterApiKey" :node="node"
            :is-selected="isNodeFocused(node.id)" :selected-model="selectedModel" :zoom="zoom"
            :model-registry="modelRegistry" @select="handleNodeSelect(node.id)" @drag-start="handleDragStart"
            @create-branch="handleCreateBranch" @update-title="store.updateNodeTitle"
            @resend="(userMessageIndex) => handleResend(node.id, userMessageIndex)"
            @delete="() => store.removeNode(node.id)" :style="{
              transform: `translate(${node.x}px, ${node.y}px)`,
              transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none'
            }" />
        </div>
      </div>
    </div>

    <!-- Zoom Level Display -->
    <div
      class="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-3 py-1.5 bg-base-200/90 backdrop-blur rounded-full border border-base-300 shadow-lg">
      <span class="text-sm font-medium text-base-content">
        {{ Math.round(zoom * 100) }}%
      </span>
    </div>

    <button
      class="fixed bottom-4 right-4 px-3 py-1.5 bg-base-200/90 backdrop-blur rounded-full border border-base-300 shadow-lg hover:bg-base-300/90 transition-colors"
      @click="autoZoomEnabled = !autoZoomEnabled">
      <span class="text-sm font-medium text-base-content">
        Auto-center: {{ autoZoomEnabled ? 'On' : 'Off' }}
      </span>
    </button>
  </div>
</template>


<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useCanvasStore } from '../../stores/canvasStore';
import BranchNode from './node/BranchNode.vue';
import SplineConnector from './spline/SplineConnector.vue';

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
  }
});

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
const canvasRef = ref(null);

// State
const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
const isPanning = ref(false);
const lastPanPosition = ref({ x: 0, y: 0 });
const focusedNodeId = ref(null);

const lastActivityTimestamp = ref(Date.now());
const autoZoomEnabled = ref(true);
const isAutoZooming = ref(false);
const AUTO_CENTER_DELAY = 30000; // 5 seconds
const inactivityTimer = ref(null);

// Helper Functions
const getNodeCenter = (node) => ({
  x: node.x + store.CARD_WIDTH / 2,
  y: node.y + store.CARD_HEIGHT / 2
});



const transformStyle = computed(() => ({
  transform: `scale(${zoom.value}) translate(${panX.value / zoom.value}px, ${panY.value / zoom.value}px)`,
  transformOrigin: '0 0',
  width: '100000px',
  height: '100000px',
  background: 'transparent', // Changed from 'inherit'
  transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none'
}));

// Add new computed properties for SVG and nodes layer
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

const handleNodeSelect = (nodeId: string) => {
  // Center the view on the selected node
  centerOnNode(nodeId);
  // Update the focused node
  focusedNodeId.value = nodeId;
};

const handleWheel = (e) => {
  resetInactivityTimer();
  // If it's a zoom event (Ctrl/Cmd + wheel)
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();

    const ZOOM_SENSITIVITY = 0.001; // Increased for smoother zoom
    const ZOOM_MIN = 0.1;
    const ZOOM_MAX = 5;

    const rect = canvasRef.value.getBoundingClientRect();

    // Get mouse position relative to viewport
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate mouse position relative to content
    const mouseContentX = (mouseX - panX.value) / zoom.value;
    const mouseContentY = (mouseY - panY.value) / zoom.value;

    // Calculate new zoom level
    const delta = -e.deltaY;
    const newZoom = Math.min(
      Math.max(zoom.value * (1 + delta * ZOOM_SENSITIVITY), ZOOM_MIN),
      ZOOM_MAX
    );

    // Update the zoom level
    zoom.value = newZoom;

    // Adjust pan to keep mouse position fixed
    panX.value = mouseX - mouseContentX * newZoom;
    panY.value = mouseY - mouseContentY * newZoom;
  } else {
    // Regular panning
    panX.value -= e.deltaX;
    panY.value -= e.deltaY;
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  if (canvasRef.value) {
    canvasRef.value.addEventListener('wheel', handleWheel, { passive: false });
  }

  // Initial centering of nodes
  if (store.nodes.length) {
    autoFitNodes();
  }

  // Start inactivity timer
  resetInactivityTimer();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
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


const centerOnNode = (nodeId) => {
  const node = store.nodes.find(n => n.id === nodeId);
  if (!node) return;

  store.isTransitioning = true;
  const center = getNodeCenter(node);

  const rect = canvasRef.value.getBoundingClientRect();
  // Center the node in the viewport
  panX.value = (rect.width / 2) - (center.x * zoom.value);
  panY.value = (rect.height / 2) - (center.y * zoom.value);

  focusedNodeId.value = nodeId;

  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
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
  store.isDragging = false;
  store.activeNode = null;
  isPanning.value = false;
};

const handleCanvasMouseDown = (e) => {
  if (e.button === 0 && !store.isDragging) {
    isPanning.value = true;
    lastPanPosition.value = { x: e.clientX - panX.value, y: e.clientY - panY.value };
  }
};

const handleKeyDown = (e) => {
  if (store.isTransitioning) return;

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
  autoFitNodes
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
  resetInactivityTimer();

  if (store.isDragging && store.activeNode) {
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

const handleCreateBranch = (parentId: string, messageIndex: number, position: { x: number, y: number }, initialData: any) => {
  const parentNode = store.nodes.find(n => n.id === parentId);
  if (!parentNode) return;

  // Find existing branches from this parent
  const existingBranches = store.nodes.filter(n => n.parentId === parentId);

  // Determine initial vertical offset based on number of existing branches
  const verticalOffset = existingBranches.length * (store.CARD_HEIGHT + 20);

  // Update position
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

  // Center the view on the new node
  centerOnNode(newNode.id);
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
.transform-gpu {
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  perspective: 1000px;
  overflow: hidden;
  /* Add this line */
}

div:focus {
  outline: none;
}

div:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.1);
}

/* Add these new styles */
.fixed {
  overflow: hidden;
}

.absolute {
  overflow: visible;
}
</style>