<template>
  <div class="chat-history-feature">
    <!-- Search and Filter Section -->
    <div class="search-section">
      <div class="search-box">
        <Search class="w-4 h-4 text-base-content/50" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Search workspaces..."
          class="search-input"
        />
      </div>
      
      <!-- Sort and Filter Controls -->
      <div class="controls-row">
        <div class="sort-controls">
          <span class="control-label">Sort:</span>
          <select v-model="sortBy" class="sort-select">
            <option value="recent">Recent</option>
            <option value="alphabetical">A-Z</option>
            <option value="size">Size</option>
          </select>
        </div>
        
        <div class="view-controls">
          <button 
            @click="viewMode = 'list'"
            class="view-btn"
            :class="{ 'active': viewMode === 'list' }"
          >
            <List class="w-4 h-4" />
          </button>
          <button 
            @click="viewMode = 'grid'"
            class="view-btn"
            :class="{ 'active': viewMode === 'grid' }"
          >
            <Grid3X3 class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
    
    <!-- Workspace List/Grid -->
    <div class="workspaces-container" :class="{ 'grid-mode': viewMode === 'grid' }">
      <div 
        v-for="workspace in filteredWorkspaces" 
        :key="workspace.id"
        class="workspace-item"
        :class="{ 
          'active': workspace.id === currentWorkspaceId,
          'grid-item': viewMode === 'grid'
        }"
        @click="loadWorkspace(workspace.id)"
      >
        <!-- List View -->
        <template v-if="viewMode === 'list'">
          <div class="workspace-icon">
            <MessageSquare class="w-4 h-4" />
          </div>
          <div class="workspace-info">
            <div class="workspace-title">{{ workspace.title }}</div>
            <div class="workspace-meta">
              {{ formatWorkspaceInfo(workspace) }}
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-base-content/30" />
        </template>
        
        <!-- Grid View -->
        <template v-else>
          <div class="grid-preview">
            <div class="preview-nodes">
              <div 
                v-for="i in Math.min(workspace.nodeCount || 3, 4)" 
                :key="i" 
                class="preview-node"
                :style="{ 
                  left: `${(i - 1) * 8}px`,
                  zIndex: 4 - i 
                }"
              />
            </div>
          </div>
          <div class="grid-info">
            <div class="grid-title">{{ workspace.title }}</div>
            <div class="grid-meta">
              {{ workspace.nodeCount || 0 }} nodes
            </div>
          </div>
        </template>
      </div>
      
      <div v-if="filteredWorkspaces.length === 0" class="no-results">
        <MessageSquare class="w-8 h-8 text-base-content/30 mb-2" />
        <p class="text-sm text-base-content/60">No workspaces found</p>
      </div>
    </div>
    
    <!-- Quick Stats -->
    <div class="stats-section">
      <div class="stat-card">
        <div class="stat-number">{{ totalWorkspaces }}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ totalNodes }}</div>
        <div class="stat-label">Nodes</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ recentWorkspaces }}</div>
        <div class="stat-label">Recent</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue';
import { Search, List, Grid3X3, MessageSquare, ChevronRight } from 'lucide-vue-next';
import { useChatStore } from '@/stores/chatStore';
import { useCanvasStore } from '@/stores/canvasStore';

// Stores
const chatStore = useChatStore();
const canvasStore = useCanvasStore();

// Inject canvas ref for proper workspace transitions
const canvasRef = inject<any>('canvasRef', null);

// Reactive state
const searchQuery = ref('');
const sortBy = ref<'recent' | 'alphabetical' | 'size'>('recent');
const viewMode = ref<'list' | 'grid'>('list');

// Computed properties
const currentWorkspaceId = computed(() => canvasStore.lastSavedWorkspaceId);

const sortedWorkspaces = computed(() => {
  let workspaces = [...chatStore.chats];
  
  switch (sortBy.value) {
    case 'alphabetical':
      workspaces.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'size':
      workspaces.sort((a, b) => (b.nodeCount || 0) - (a.nodeCount || 0));
      break;
    case 'recent':
    default:
      workspaces.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
  }
  
  return workspaces;
});

const filteredWorkspaces = computed(() => {
  if (!searchQuery.value.trim()) {
    return sortedWorkspaces.value;
  }
  
  const query = searchQuery.value.toLowerCase().trim();
  return sortedWorkspaces.value.filter(workspace => 
    workspace.title.toLowerCase().includes(query)
  );
});

// Stats
const totalWorkspaces = computed(() => chatStore.chats.length);
const totalNodes = computed(() => 
  chatStore.chats.reduce((sum, chat) => sum + (chat.nodeCount || 0), 0)
);
const recentWorkspaces = computed(() => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return chatStore.chats.filter(chat => 
    new Date(chat.updatedAt) > weekAgo
  ).length;
});

// Methods
const formatWorkspaceInfo = (workspace: any) => {
  const date = new Date(workspace.updatedAt).toLocaleDateString();
  const nodeCount = workspace.nodeCount || 0;
  return `${date} • ${nodeCount} nodes`;
};

const loadWorkspace = async (id: string) => {
  try {
    // Use canvas ref to handle proper workspace transition with animations
    if (canvasRef?.value && typeof canvasRef.value.handleWorkspaceSelect === 'function') {
      await canvasRef.value.handleWorkspaceSelect(id);
    } else {
      // Fallback if canvas ref is not available
      await canvasStore.clearCurrentWorkspace();
      const success = await canvasStore.loadChatState(id);
      if (success) {
        canvasStore.lastSavedWorkspaceId = id;
      }
    }
  } catch (error) {
    console.error('Error loading workspace:', error);
  }
};

// Load chats on mount
onMounted(async () => {
  await chatStore.loadChats();
});
</script>

<style scoped>
.chat-history-feature {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.search-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: hsl(var(--b2) / 0.5);
  border: 1px solid hsl(var(--b3));
  border-radius: 0.5rem;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: hsl(var(--bc));
  font-size: 0.875rem;
}

.search-input::placeholder {
  color: hsl(var(--bc) / 0.5);
}

.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sort-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-label {
  font-size: 0.75rem;
  color: hsl(var(--bc) / 0.7);
  font-weight: 500;
}

.sort-select {
  padding: 0.25rem 0.5rem;
  background: hsl(var(--b2));
  border: 1px solid hsl(var(--b3));
  border-radius: 0.25rem;
  color: hsl(var(--bc));
  font-size: 0.75rem;
}

.view-controls {
  display: flex;
  gap: 0.25rem;
}

.view-btn {
  padding: 0.25rem;
  background: transparent;
  border: 1px solid hsl(var(--b3));
  border-radius: 0.25rem;
  color: hsl(var(--bc) / 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-btn:hover {
  background: hsl(var(--b2) / 0.5);
  color: hsl(var(--bc));
}

.view-btn.active {
  background: hsl(var(--p));
  color: hsl(var(--pc));
  border-color: hsl(var(--p));
}

.workspaces-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.workspaces-container.grid-mode {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}

.workspace-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: hsl(var(--b2) / 0.3);
  border: 1px solid hsl(var(--b3));
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.workspace-item:hover {
  background: hsl(var(--b2) / 0.5);
  transform: translateY(-1px);
}

.workspace-item.active {
  background: hsl(var(--p) / 0.1);
  border-color: hsl(var(--p) / 0.3);
}

.workspace-item.grid-item {
  flex-direction: column;
  text-align: center;
  aspect-ratio: 1;
  gap: 0.5rem;
}

.workspace-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: hsl(var(--p) / 0.1);
  border-radius: 0.5rem;
  color: hsl(var(--p));
  flex-shrink: 0;
}

.workspace-info {
  flex: 1;
  min-width: 0;
}

.workspace-title {
  font-weight: 500;
  color: hsl(var(--bc));
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-meta {
  font-size: 0.75rem;
  color: hsl(var(--bc) / 0.6);
  margin-top: 0.125rem;
}

.grid-preview {
  position: relative;
  width: 2.5rem;
  height: 2rem;
  margin: 0 auto;
}

.preview-nodes {
  position: relative;
  width: 100%;
  height: 100%;
}

.preview-node {
  position: absolute;
  width: 1rem;
  height: 1rem;
  background: hsl(var(--p) / 0.7);
  border: 1px solid hsl(var(--p));
  border-radius: 0.25rem;
  top: 50%;
  transform: translateY(-50%);
}

.grid-info {
  flex: 1;
}

.grid-title {
  font-weight: 500;
  font-size: 0.75rem;
  color: hsl(var(--bc));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grid-meta {
  font-size: 0.625rem;
  color: hsl(var(--bc) / 0.6);
  margin-top: 0.125rem;
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid hsl(var(--b3));
}

.stat-card {
  text-align: center;
  padding: 0.5rem;
  background: hsl(var(--b2) / 0.3);
  border-radius: 0.5rem;
}

.stat-number {
  font-size: 1.25rem;
  font-weight: 700;
  color: hsl(var(--bc));
}

.stat-label {
  font-size: 0.625rem;
  color: hsl(var(--bc) / 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 0.125rem;
}

/* Custom scrollbar */
.workspaces-container::-webkit-scrollbar {
  width: 4px;
}

.workspaces-container::-webkit-scrollbar-track {
  background: transparent;
}

.workspaces-container::-webkit-scrollbar-thumb {
  background: hsl(var(--bc) / 0.2);
  border-radius: 2px;
}

.workspaces-container::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--bc) / 0.3);
}
</style>