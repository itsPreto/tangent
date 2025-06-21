<template>
  <div class="grid-workspace-view">
    <div class="grid-container">
      <div v-for="(workspace, index) in filteredWorkspaces" :key="workspace.id" class="grid-item">
        <div class="grid-workspace-card" 
            :class="{ 'selected': selectedWorkspaceId === workspace.id }"
            @click="$emit('select-workspace', workspace.id)" 
            :data-workspace-id="workspace.id">
          <div class="card-header">
            <h3 class="card-title">{{ workspace.title || 'Untitled Workspace' }}</h3>
            <div class="card-actions">
              <button @click.stop="$emit('favorite-workspace', workspace.id)" class="action-btn">
                <Star class="w-4 h-4" :class="{ 'text-yellow-400 fill-yellow-400': workspace.isFavorite }" />
              </button>
              <button @click.stop="showContextMenu(workspace.id, $event)" class="action-btn">
                <MoreVertical class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="card-content">
            <div class="card-metadata">
              <div class="metadata-item">
                <MessageCircle class="w-4 h-4" />
                <span>{{ workspace.nodeCount || 0 }} branches</span>
              </div>
              <div class="metadata-item">
                <Clock class="w-4 h-4" />
                <span>{{ formatDate(workspace.lastUpdated) }}</span>
              </div>
            </div>

            <div class="tags-container">
              <div v-for="tag in workspace.tags" :key="tag.id" 
                  class="tag"
                  :class="getTagClass(tag)">
                {{ tag.name }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <ContextMenu v-if="activeContextMenu.isVisible" :position="activeContextMenu.position" @close="closeContextMenu">
      <button @click="handleContextMenuAction('duplicate')" class="context-menu-item">
        <Copy class="w-4 h-4" /> Duplicate
      </button>
      <button @click="handleContextMenuAction('archive')" class="context-menu-item">
        <Archive class="w-4 h-4" /> Archive
      </button>
      <button @click="handleContextMenuAction('export')" class="context-menu-item">
        <Download class="w-4 h-4" /> Export
      </button>
      <hr class="my-2 border-base-200" />
      <button @click="handleContextMenuAction('delete')" class="context-menu-item text-error">
        <Trash2 class="w-4 h-4" /> Delete
      </button>
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  MessageCircle, Clock, Star, MoreVertical,
  Copy, Archive, Download, Trash2
} from 'lucide-vue-next';
import ContextMenu from './ContextMenu.vue';
import { useThemeStore } from '@/stores/themeStore';

// Props
const props = defineProps({
  workspaces: {
    type: Array,
    required: true
  },
  selectedWorkspaceId: String,
  searchQuery: String
});

// Emits
const emit = defineEmits([
  'select-workspace',
  'favorite-workspace',
  'duplicate-workspace',
  'archive-workspace',
  'export-workspace',
  'delete-workspace'
]);

// State
const activeContextMenu = ref({
  isVisible: false,
  workspaceId: null,
  position: { x: 0, y: 0 }
});

// Theme store
const themeStore = useThemeStore();

// Computed
const filteredWorkspaces = computed(() => {
  if (!props.searchQuery) return props.workspaces;

  const query = props.searchQuery.toLowerCase();
  return props.workspaces.filter(workspace => {
    const title = (workspace.title || '').toLowerCase();
    const tags = workspace.tags ? workspace.tags.map(tag => tag.name.toLowerCase()) : [];

    return title.includes(query) || tags.some(tag => tag.includes(query));
  });
});

// Methods
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const showContextMenu = (workspaceId, event) => {
  activeContextMenu.value = {
    isVisible: true,
    workspaceId,
    position: { x: event.clientX, y: event.clientY }
  };
  event.stopPropagation();
};

const closeContextMenu = () => {
  activeContextMenu.value.isVisible = false;
};

const handleContextMenuAction = (action) => {
  const workspaceId = activeContextMenu.value.workspaceId;
  if (!workspaceId) return;

  switch (action) {
    case 'duplicate':
      emit('duplicate-workspace', workspaceId);
      break;
    case 'archive':
      emit('archive-workspace', workspaceId);
      break;
    case 'export':
      emit('export-workspace', workspaceId);
      break;
    case 'delete':
      emit('delete-workspace', workspaceId);
      break;
  }

  closeContextMenu();
};

// Map tag color to daisyUI theme color classes
const getTagClass = (tag) => {
  // Map known color names to daisyUI classes
  const colorMap = {
    primary: 'bg-primary text-primary-content',
    secondary: 'bg-secondary text-secondary-content',
    accent: 'bg-accent text-accent-content',
    neutral: 'bg-neutral text-neutral-content',
    info: 'bg-info text-info-content',
    success: 'bg-success text-success-content',
    warning: 'bg-warning text-warning-content',
    error: 'bg-error text-error-content',
  };
  
  // Use the tag's colorName if it maps to a daisyUI color
  if (tag.colorName && colorMap[tag.colorName]) {
    return colorMap[tag.colorName];
  }
  
  // Default to accent if no specific color or if the color doesn't map
  return 'bg-accent text-accent-content';
};
</script>

<style scoped>
.grid-workspace-view {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1.5rem;
}

.grid-item {
  height: 100%;
}

.grid-workspace-card {
  background-color: hsl(var(--b2) / 0.8);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  border: 1px solid hsl(var(--b3) / 0.5);
  overflow: hidden;
  height: 100%;
  transition: all 0.2s ease;
  box-shadow: 0 4px 6px hsl(var(--nf) / 0.05);
  cursor: pointer;
}

.grid-workspace-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 15px hsl(var(--nf) / 0.1);
  border-color: hsl(var(--b3));
}

.grid-workspace-card.selected {
  border-color: hsl(var(--p));
  box-shadow: 0 0 0 2px hsl(var(--p) / 0.3), 0 10px 15px hsl(var(--nf) / 0.1);
}

.card-header {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid hsl(var(--b3) / 0.5);
}

.card-title {
  font-weight: 600;
  font-size: 1.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: hsl(var(--b3) / 0.3);
  transition: all 0.2s ease;
}

.action-btn:hover {
  background-color: hsl(var(--b3) / 0.6);
}

.card-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-metadata {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: hsl(var(--bc) / 0.7);
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.tag {
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-menu-item {
  @apply flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-base-200/50 text-left;
}

.text-error {
  color: hsl(var(--er));
}

.border-base-200 {
  border-color: hsl(var(--b2));
}

/* Responsive Adjustments */
@media (max-width: 1600px) {
  .grid-container {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1200px) {
  .grid-container {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .grid-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .grid-container {
    grid-template-columns: 1fr;
  }
}
</style>