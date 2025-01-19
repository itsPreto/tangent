<template>
  <div class="fixed inset-0 w-full h-full overflow-hidden bg-background">
    <!-- Main Canvas -->
    <div 
      ref="canvasRef"
      class="absolute inset-0 transition-transform duration-500 ease-in-out"
      :class="{ '-translate-x-1/2': store.viewMode === '3d' }"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @mousedown="handleCanvasMouseDown"
      tabindex="0"
      @keydown="handleKeyDown"
    >
      <!-- Canvas Transform Container -->
      <div 
        class="absolute transform-gpu"
        :style="transformStyle"
      >
        <!-- SVG Layer for Connections -->
        <svg 
          class="absolute pointer-events-none overflow-visible" 
          style="z-index: 1"
          :style="svgStyle"
          viewBox="0 0 100000 100000"
          preserveAspectRatio="none"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" class="fill-primary" />
            </marker>
          </defs>
          
          <template v-for="connection in store.connections" :key="`${connection.parent.id}-${connection.child.id}`">
            <SplineConnector
              :start-node="connection.parent"
              :end-node="connection.child"
              :card-width="store.CARD_WIDTH"
              :card-height="store.CARD_HEIGHT"
              :is-active="isConnectionActive(connection)"
              :zoom-level="zoom.valueOf()"
            />
          </template>
        </svg>

        <!-- Nodes Layer -->
        <div class="absolute" :style="nodesLayerStyle" style="z-index: 2">
          <BranchNode
            v-for="node in store.nodes"
            :open-router-api-key="openRouterApiKey"
            :key="node.id"
            :node="node"
            :is-selected="isNodeFocused(node.id)"
            :selected-model="selectedModel"
            @select="handleNodeSelect"
            @drag-start="handleDragStart"
            @create-branch="handleCreateBranch"
            @update-title="store.updateNodeTitle"
            @delete="() => store.removeNode(node.id)"
            :style="{
              transform: `translate(${node.x}px, ${node.y}px)`,
              transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none'
            }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useCanvasStore } from '../../stores/canvasStore';
import BranchNode from './node/BranchNode.vue';
import SplineConnector from './spline/SplineConnector.vue';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

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
  }
});

const store = useCanvasStore();
const canvasRef = ref(null);

// State
const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
const isPanning = ref(false);
const lastPanPosition = ref({ x: 0, y: 0 });
const focusedNodeId = ref(null);

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

const handleWheel = (e) => {
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
  
  // Add the wheel event listener with { passive: false }
  if (canvasRef.value) {
    canvasRef.value.addEventListener('wheel', handleWheel, { passive: false });
  }
  
  if (store.nodes.length) {
    centerOnNode(store.nodes[0].id);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
  // Remove the wheel event listener
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('wheel', handleWheel);
  }
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

const findNearestNode = () => {
  const rect = canvasRef.value.getBoundingClientRect();
  const viewportCenter = {
    x: (rect.width / 2 - panX.value) / zoom.value,
    y: (rect.height / 2 - panY.value) / zoom.value
  };

  let nearest = null;
  let minDistance = Infinity;

  store.nodes.forEach(node => {
    const center = getNodeCenter(node);
    const dx = center.x - viewportCenter.x;
    const dy = center.y - viewportCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = node;
    }
  });

  return nearest?.id;
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

// Event Handlers
const handleMouseMove = (e) => {
  if (store.isDragging && store.activeNode) {
    const canvasRect = canvasRef.value.getBoundingClientRect();
    const newX = (e.clientX - canvasRect.left - store.dragOffset.x) / zoom.value;
    const newY = (e.clientY - canvasRect.top - store.dragOffset.y) / zoom.value;

    store.updateNodePosition(store.activeNode, { x: newX, y: newY });
  } else if (isPanning.value) {
    panX.value = e.clientX - lastPanPosition.value.x;
    panY.value = e.clientY - lastPanPosition.value.y;
  }
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

  switch (e.key.toLowerCase()) {
    case 'w':
      targetNodeId = findNodeInDirection(currentNode, connections, 'up');
      break;
    case 's':
      targetNodeId = findNodeInDirection(currentNode, connections, 'down');
      break;
    case 'a':
      targetNodeId = currentNode.parentId;
      break;
    case 'd':
      targetNodeId = connections
        .find(conn => conn.parent.id === currentNode.id)?.child.id;
      break;
  }

  if (targetNodeId) {
    centerOnNode(targetNodeId);
  }
};

const handleDragStart = (e, node) => {
  store.isDragging = true;
  store.activeNode = node.id;
  
  const rect = e.currentTarget.getBoundingClientRect();
  store.dragOffset = {
    x: (e.clientX - rect.left) / zoom.value,
    y: (e.clientY - rect.top) / zoom.value
  };
};

const handleCreateBranch = (parentId, messageIndex, position, initialData) => {
  // Use the store to create the new branch node
  const newNode = store.addNode(parentId, messageIndex, position, initialData);
  // Center the view on the new node
  centerOnNode(newNode.id);
};

const handleNodeSelect = (nodeId) => {
  // If we're in 3D view, switch back to 2D when selecting a node
  if (store.viewMode === '3d') {
    store.toggleView();
  }
  focusedNodeId.value = nodeId;
  centerOnNode(nodeId);
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
  overflow: hidden; /* Add this line */
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