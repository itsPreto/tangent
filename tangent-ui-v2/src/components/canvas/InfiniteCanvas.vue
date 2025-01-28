<template>
  <div class="fixed overflow-hidden bg-background transition-all duration-300" :style="{
    left: sidePanelOpen ? '40vw' : '0',
    right: '0',
    top: '0',
    bottom: '0'
  }" @dragenter.prevent="handleDragEnter" @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop">

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
        <!-- Nodes Layer -->
        <div class="absolute" :style="nodesLayerStyle" style="z-index: 2">
          <template v-for="node in store.nodes" :key="node.id">
            <!-- Use MediaBranchNode for media nodes -->
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

            <!-- Use WebBranchNode for web nodes -->
            <WebBranchNode v-else-if="node.type === 'web'" :node="node" :is-selected="isNodeFocused(node.id)"
              :selected-model="selectedModel" :open-router-api-key="openRouterApiKey" :zoom="zoom"
              :model-registry="modelRegistry" @select="handleNodeSelect(node.id)" @drag-start="handleDragStart"
              @create-branch="handleCreateBranch" @update-title="store.updateNodeTitle"
              @resend="(userMessageIndex) => handleResend(node.id, userMessageIndex)"
              @delete="() => store.removeNode(node.id)" :style="{
                transform: `translate(${node.x}px, ${node.y}px)`,
                transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none'
              }" />

            <!-- Regular BranchNode for other nodes -->
            <BranchNode v-else :node="node" :is-selected="isNodeFocused(node.id)" :selected-model="selectedModel"
              :open-router-api-key="openRouterApiKey" :zoom="zoom" :model-registry="modelRegistry"
              @select="handleNodeSelect(node.id)" @drag-start="handleDragStart" @create-branch="handleCreateBranch"
              @update-title="store.updateNodeTitle"
              @resend="(userMessageIndex) => handleResend(node.id, userMessageIndex)"
              @delete="() => store.removeNode(node.id)" :style="{
                transform: `translate(${node.x}px, ${node.y}px)`,
                transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none'
              }" />
          </template>
        </div>
      </div>
    </div>

    <!-- Drop Overlay -->
    <div v-show="isDraggingFile"
      class="absolute inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center pointer-events-none z-50">
      <div class="text-2xl font-semibold text-primary">
        Drop media to create a new node
      </div>
    </div>

    <!-- Bottom Sheet Cluster Visualization -->
    <BottomSheetCluster :selected-topic="focusedTopicId" @select-topic="handleTopicSelect" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';
import BranchNode from './node/BranchNode.vue';
import WebBranchNode from './node/WebBranchNode.vue';
import MediaBranchNode from './node/MediaBranchNode.vue';
import SplineConnector from './spline/SplineConnector.vue';
import { useCanvasStore } from '../../stores/canvasStore';
import BottomSheetCluster from './clustermap/BottomSheetCluster.vue';
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

const isBrowser = typeof window !== 'undefined';

const isFocusedMode = ref(true);
const rootNodeId = ref<string | null>(null);


// Helper Functions
const getNodeCenter = (node) => ({
  x: node.x + store.CARD_WIDTH / 2,
  y: node.y + store.CARD_HEIGHT / 2
});


// Modify the existing transformStyle computed property
const transformStyle = computed(() => {
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


const handleNodeSelect = (nodeId: string) => {
  centerOnNode(nodeId);
  focusedNodeId.value = nodeId;
};

const handleWheel = (e) => {
  resetInactivityTimer();
  // If it's a zoom event (Ctrl/Cmd + wheel)
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();

    const ZOOM_SENSITIVITY = 0.001;
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
    panX.value -= e.deltaX;
    panY.value -= e.deltaY;
  }
};

onMounted(() => {
  if (isBrowser) {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    if (canvasRef.value) {
      canvasRef.value.addEventListener('wheel', handleWheel, { passive: false });
    }

    if (store.nodes.length) {
      autoFitNodes();
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
  // Center the node in the viewport
  panX.value = (rect.width / 2) - (center.x * zoom.value);
  panY.value = (rect.height / 2) - (center.y * zoom.value);

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
  if (isClusterVizFocused.value) return;
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
</style>