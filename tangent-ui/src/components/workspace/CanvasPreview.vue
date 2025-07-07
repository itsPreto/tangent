<template>
  <div class="canvas-preview" ref="containerRef">
    <div class="preview-loading" v-if="isLoading">
      <div class="loading-spinner"></div>
      <span>Loading canvas...</span>
    </div>
    
    <div class="preview-error" v-else-if="error">
      <div class="error-icon">⚠️</div>
      <span>{{ error }}</span>
    </div>
    
    <svg 
      v-else-if="workspaceData && workspaceData.nodes.length > 0"
      class="preview-svg"
      :viewBox="viewBox"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- Grid background -->
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      
      <!-- Connections -->
      <g class="connections">
        <path 
          v-for="connection in connections" 
          :key="`${connection.from}-${connection.to}`"
          :d="connection.path"
          class="connection-path"
          :class="getConnectionClass(connection)"
        />
      </g>
      
      <!-- Nodes -->
      <g class="nodes">
        <g 
          v-for="node in workspaceData.nodes" 
          :key="node.id"
          :transform="`translate(${node.x}, ${node.y})`"
          class="node"
          :class="getNodeClass(node)"
        >
          <!-- Node background -->
          <rect 
            :width="nodeWidth"
            :height="nodeHeight"
            rx="4"
            class="node-bg"
          />
          
          <!-- Node type indicator -->
          <circle 
            :cx="6"
            :cy="6"
            r="3"
            class="node-type-indicator"
            :class="`type-${node.type}`"
          />
          
          <!-- Node content indicator -->
          <rect 
            v-if="node.messages && node.messages.length > 0"
            x="2"
            :y="nodeHeight - 6"
            :width="Math.min(nodeWidth - 4, (node.messages.length * 2))"
            height="2"
            rx="1"
            class="message-indicator"
          />
          
          <!-- Branch indicator -->
          <text 
            v-if="node.branchMessageIndex !== null && node.branchMessageIndex !== undefined"
            :x="nodeWidth - 4"
            y="8"
            class="branch-indicator"
            text-anchor="end"
            font-size="6"
          >
            {{ node.branchMessageIndex + 1 }}
          </text>
        </g>
      </g>
    </svg>
    
    <div class="empty-state" v-else>
      <div class="empty-icon">📋</div>
      <span>Empty workspace</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import type { Node, Message } from '@/types/message';

interface Props {
  workspaceId: string;
}

const props = defineProps<Props>();

// State
const containerRef = ref<HTMLElement>();
const isLoading = ref(true);
const error = ref<string | null>(null);
const workspaceData = ref<{
  nodes: Node[];
  title: string;
} | null>(null);

// Canvas dimensions
const nodeWidth = 24;
const nodeHeight = 16;
const padding = 20;

// Computed viewBox for SVG
const viewBox = computed(() => {
  if (!workspaceData.value || workspaceData.value.nodes.length === 0) {
    return '0 0 200 150';
  }

  const nodes = workspaceData.value.nodes;
  const minX = Math.min(...nodes.map(n => n.x)) - padding;
  const maxX = Math.max(...nodes.map(n => n.x + nodeWidth)) + padding;
  const minY = Math.min(...nodes.map(n => n.y)) - padding;
  const maxY = Math.max(...nodes.map(n => n.y + nodeHeight)) + padding;

  const width = maxX - minX;
  const height = maxY - minY;

  return `${minX} ${minY} ${width} ${height}`;
});

// Compute connections between nodes
const connections = computed(() => {
  if (!workspaceData.value) return [];

  const connections: Array<{
    from: string;
    to: string;
    path: string;
    type: string;
  }> = [];

  workspaceData.value.nodes.forEach(node => {
    if (node.parentId) {
      const parent = workspaceData.value!.nodes.find(n => n.id === node.parentId);
      if (parent) {
        // Calculate connection path
        const startX = parent.x + nodeWidth / 2;
        const startY = parent.y + nodeHeight;
        const endX = node.x + nodeWidth / 2;
        const endY = node.y;

        // Create a curved path
        const midY = startY + (endY - startY) / 2;
        const path = `M ${startX} ${startY} Q ${startX} ${midY} ${endX} ${endY}`;

        connections.push({
          from: parent.id,
          to: node.id,
          path,
          type: node.type
        });
      }
    }
  });

  return connections;
});

// Get CSS class for node based on type and properties
const getNodeClass = (node: Node) => {
  const classes = [`node-${node.type}`];
  
  if (node.messages && node.messages.length > 0) {
    classes.push('has-messages');
  }
  
  if (node.branchMessageIndex !== null && node.branchMessageIndex !== undefined) {
    classes.push('is-branch');
  }
  
  return classes.join(' ');
};

// Get CSS class for connection based on type
const getConnectionClass = (connection: any) => {
  return `connection-${connection.type}`;
};

// Load workspace data
const loadWorkspaceData = async (workspaceId: string) => {
  if (!workspaceId) {
    error.value = 'No workspace ID provided';
    isLoading.value = false;
    return;
  }

  try {
    isLoading.value = true;
    error.value = null;

    // Fetch workspace data from the API
    const response = await fetch(`http://127.0.0.1:5050/api/chats/${workspaceId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to load workspace: ${response.status}`);
    }

    const chatData = await response.json();
    
    // Flatten nested node structure
    const flattenNodes = (node: any): Node[] => {
      const children = node.children || [];
      return [
        {
          id: node.id,
          type: node.type || 'branch',
          title: node.title,
          x: node.x || 0,
          y: node.y || 0,
          parentId: node.parentId,
          branchMessageIndex: node.branchMessageIndex,
          messages: node.messages || [],
          streamingContent: null,
        },
        ...children.flatMap(flattenNodes)
      ];
    };

    workspaceData.value = {
      title: chatData.title || 'Untitled Workspace',
      nodes: flattenNodes(chatData.nodes)
    };

    isLoading.value = false;
  } catch (err) {
    console.error('Error loading workspace data:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load workspace';
    isLoading.value = false;
  }
};

// Watch for workspace ID changes
watch(() => props.workspaceId, (newId) => {
  if (newId) {
    loadWorkspaceData(newId);
  }
}, { immediate: true });

onMounted(() => {
  if (props.workspaceId) {
    loadWorkspaceData(props.workspaceId);
  }
});
</script>

<style scoped>
.canvas-preview {
  @apply w-full h-full flex items-center justify-center;
  background: oklch(from oklch(var(--b2)) l c h / 0.3);
  border-radius: 8px;
  overflow: hidden;
}

.preview-loading,
.preview-error,
.empty-state {
  @apply flex flex-col items-center justify-center gap-2 text-center p-4;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.loading-spinner {
  @apply w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin;
  opacity: 0.6;
}

.error-icon,
.empty-icon {
  @apply text-2xl opacity-60;
}

.preview-svg {
  @apply w-full h-full;
  color: oklch(from oklch(var(--bc)) l c h / 0.4);
}

/* Node styles */
.node-bg {
  fill: oklch(var(--b1));
  stroke: oklch(from oklch(var(--bc)) l c h / 0.2);
  stroke-width: 0.5;
}

.node.node-main .node-bg {
  fill: oklch(from oklch(var(--p)) l c h / 0.1);
  stroke: oklch(from oklch(var(--p)) l c h / 0.4);
}

.node.node-branch .node-bg {
  fill: oklch(from oklch(var(--s)) l c h / 0.08);
  stroke: oklch(from oklch(var(--s)) l c h / 0.3);
}

.node.node-media .node-bg {
  fill: oklch(from oklch(var(--a)) l c h / 0.08);
  stroke: oklch(from oklch(var(--a)) l c h / 0.3);
}

.node.node-web .node-bg {
  fill: oklch(from oklch(var(--in)) l c h / 0.08);
  stroke: oklch(from oklch(var(--in)) l c h / 0.3);
}

/* Node type indicators */
.node-type-indicator {
  fill: oklch(from oklch(var(--bc)) l c h / 0.4);
}

.node-type-indicator.type-main {
  fill: oklch(var(--p));
}

.node-type-indicator.type-branch {
  fill: oklch(var(--s));
}

.node-type-indicator.type-media {
  fill: oklch(var(--a));
}

.node-type-indicator.type-web {
  fill: oklch(var(--in));
}

/* Message indicators */
.message-indicator {
  fill: oklch(from oklch(var(--su)) l c h / 0.6);
}

.node.has-messages .message-indicator {
  fill: oklch(var(--su));
}

/* Branch indicators */
.branch-indicator {
  fill: oklch(from oklch(var(--bc)) l c h / 0.7);
  font-family: monospace;
  font-weight: 600;
}

/* Connection styles */
.connection-path {
  fill: none;
  stroke: oklch(from oklch(var(--bc)) l c h / 0.3);
  stroke-width: 1;
}

.connection-path.connection-branch {
  stroke: oklch(from oklch(var(--s)) l c h / 0.5);
}

.connection-path.connection-media {
  stroke: oklch(from oklch(var(--a)) l c h / 0.5);
}

.connection-path.connection-web {
  stroke: oklch(from oklch(var(--in)) l c h / 0.5);
}

/* Hover effects */
.node:hover .node-bg {
  fill: oklch(from oklch(var(--p)) l c h / 0.05);
  stroke: oklch(from oklch(var(--p)) l c h / 0.4);
}

.connection-path:hover {
  stroke: oklch(var(--p));
  stroke-width: 1.5;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .preview-loading,
  .preview-error,
  .empty-state {
    @apply text-xs;
  }
  
  .loading-spinner {
    @apply w-4 h-4;
  }
}
</style>