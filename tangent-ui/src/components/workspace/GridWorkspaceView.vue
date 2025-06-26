<template>
  <div class="grid-workspace-view">
    <div class="grid-container">
      <div v-for="(workspace, index) in filteredWorkspaces" :key="workspace.id" class="grid-item">
        <div class="grid-workspace-card" 
            :class="{ 
              'selected': selectedWorkspaceId === workspace.id,
              'favorite': workspace.isFavorite 
            }"
            :style="cardStyles"
            @click="$emit('select-workspace', workspace.id)" 
            :data-workspace-id="workspace.id">
          <div class="card-header" :style="headerStyles">
            <h3 class="card-title">{{ workspace.title || 'Untitled Workspace' }}</h3>
            <div class="card-actions">
              <button @click.stop="$emit('favorite-workspace', workspace.id)" 
                      class="action-btn"
                      :style="actionButtonStyles">
                <Star class="w-4 h-4" :class="{ 'text-yellow-400 fill-yellow-400': workspace.isFavorite }" />
              </button>
              <button @click.stop="showContextMenu(workspace.id, $event)" 
                      class="action-btn"
                      :style="actionButtonStyles">
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

            <div v-if="workspace.tags && workspace.tags.length > 0" class="tags-container">
              <div v-for="tag in workspace.tags" :key="tag.id" 
                  class="tag"
                  :style="getTagStyles(tag)">
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  MessageCircle, Clock, Star, MoreVertical,
  Copy, Archive, Download, Trash2
} from 'lucide-vue-next';
import ContextMenu from '@/components/ui/ContextMenu.vue';
import { useThemeStore } from '@/stores/themeStore';
import type { ThemeName } from '@/stores/themeStore';

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

// Theme management
const themeStore = useThemeStore();
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');

// Theme observer
let themeObserver;

onMounted(() => {
  themeObserver = new MutationObserver(() => {
    currentTheme.value = document.documentElement.getAttribute('data-theme') || 'light';
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
});

onBeforeUnmount(() => {
  if (themeObserver) {
    themeObserver.disconnect();
  }
});

// Theme-aware computed properties
const isDarkTheme = computed(() => {
  return themeStore.isDarkTheme(currentTheme.value as ThemeName);
});

const themeColors = computed(() => {
  return themeStore.getThemeColors(currentTheme.value as ThemeName);
});

// Enhanced card styling with better contrast
const cardStyles = computed(() => {
  const baseStyles = {
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    // Ensure proper text color based on theme
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
  };

  // Theme-specific card backgrounds for better contrast
  switch (currentTheme.value) {
    case 'cyberpunk':
      return {
        ...baseStyles,
        backgroundColor: 'rgba(15, 15, 25, 0.95)',
        backdropFilter: 'blur(10px)',
        border: `1px solid ${themeColors.value.primary}40`,
        boxShadow: `0 4px 15px rgba(0, 0, 0, 0.4), inset 0 1px 0 ${themeColors.value.primary}20`,
        color: 'rgba(255, 255, 255, 0.9)' // Ensure light text on dark background
      };
    
    case 'synthwave':
      return {
        ...baseStyles,
        backgroundColor: 'rgba(30, 15, 50, 0.9)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${themeColors.value.secondary}50`,
        boxShadow: `0 4px 20px rgba(80, 30, 110, 0.3), inset 0 1px 0 ${themeColors.value.secondary}30`
      };
    
    case 'aqua':
      return {
        ...baseStyles,
        backgroundColor: 'rgba(0, 40, 70, 0.85)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${themeColors.value.primary}60`,
        boxShadow: '0 4px 15px rgba(0, 60, 90, 0.3)'
      };
    
    case 'forest':
    case 'garden':
      return {
        ...baseStyles,
        backgroundColor: isDarkTheme.value ? 'rgba(20, 35, 25, 0.9)' : 'rgba(245, 250, 245, 0.95)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${themeColors.value.primary}40`,
        boxShadow: isDarkTheme.value 
          ? '0 4px 15px rgba(0, 0, 0, 0.4)' 
          : '0 4px 15px rgba(0, 0, 0, 0.1)'
      };
    
    case 'valentine':
    case 'cupcake':
      return {
        ...baseStyles,
        backgroundColor: isDarkTheme.value ? 'rgba(40, 25, 35, 0.9)' : 'rgba(255, 248, 252, 0.95)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${themeColors.value.primary}50`,
        boxShadow: isDarkTheme.value 
          ? '0 4px 15px rgba(0, 0, 0, 0.4)' 
          : '0 4px 15px rgba(255, 192, 203, 0.2)'
      };
    
    case 'retro':
      return {
        ...baseStyles,
        backgroundColor: 'rgba(40, 35, 25, 0.9)',
        backdropFilter: 'blur(6px)',
        border: `2px solid ${themeColors.value.primary}60`,
        borderStyle: 'solid',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
      };
    
    case 'black':
      return {
        ...baseStyles,
        backgroundColor: 'rgba(40, 40, 40, 0.95)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.6)'
      };
    
    case 'light':
    case 'corporate':
    case 'wireframe':
      return {
        ...baseStyles,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(0, 0, 0, 0.15)',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
        color: 'rgba(0, 0, 0, 0.9)' // Ensure dark text on light backgrounds
      };
    
    default:
      // Default enhanced contrast for unknown themes
      return {
        ...baseStyles,
        backgroundColor: isDarkTheme.value 
          ? 'rgba(25, 25, 35, 0.9)' 
          : 'rgba(250, 250, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        border: isDarkTheme.value 
          ? `1px solid ${themeColors.value.primary}40` 
          : `1px solid ${themeColors.value.primary}30`,
        boxShadow: isDarkTheme.value 
          ? '0 4px 15px rgba(0, 0, 0, 0.4)' 
          : '0 4px 15px rgba(0, 0, 0, 0.1)'
      };
  }
});

const headerStyles = computed(() => {
  const borderColor = isDarkTheme.value 
    ? `${themeColors.value.primary}30` 
    : `${themeColors.value.primary}20`;
  
  return {
    borderBottom: `1px solid ${borderColor}`,
    padding: '1rem'
  };
});

const actionButtonStyles = computed(() => {
  const primary = themeColors.value.primary;
  
  return {
    backgroundColor: isDarkTheme.value 
      ? `${primary}20` 
      : `${primary}15`,
    border: `1px solid ${primary}30`,
    transition: 'all 0.2s ease'
  };
});

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

// Enhanced tag styling with theme awareness
const getTagStyles = (tag) => {
  const primary = themeColors.value.primary;
  const secondary = themeColors.value.secondary;
  const accent = themeColors.value.accent;
  
  // Create contrasting tag colors based on theme
  const tagColors = {
    primary: {
      backgroundColor: `${primary}25`,
      color: isDarkTheme.value ? primary : primary,
      border: `1px solid ${primary}40`
    },
    secondary: {
      backgroundColor: `${secondary}25`,
      color: isDarkTheme.value ? secondary : secondary,
      border: `1px solid ${secondary}40`
    },
    accent: {
      backgroundColor: `${accent}25`,
      color: isDarkTheme.value ? accent : accent,
      border: `1px solid ${accent}40`
    },
    success: {
      backgroundColor: isDarkTheme.value ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)',
      color: isDarkTheme.value ? '#22c55e' : '#16a34a',
      border: '1px solid rgba(34, 197, 94, 0.3)'
    },
    warning: {
      backgroundColor: isDarkTheme.value ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.15)',
      color: isDarkTheme.value ? '#f59e0b' : '#d97706',
      border: '1px solid rgba(245, 158, 11, 0.3)'
    },
    error: {
      backgroundColor: isDarkTheme.value ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)',
      color: isDarkTheme.value ? '#ef4444' : '#dc2626',
      border: '1px solid rgba(239, 68, 68, 0.3)'
    }
  };
  
  // Use tag's colorName if it exists and is in our map, otherwise default to primary
  const colorKey = (tag.colorName && tagColors[tag.colorName]) ? tag.colorName : 'primary';
  
  return {
    ...tagColors[colorKey],
    padding: '0.25rem 0.5rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '500',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };
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
  border-radius: 0.75rem;
  overflow: hidden;
  height: 100%;
  position: relative;
}

.grid-workspace-card:hover {
  transform: translateY(-4px) scale(1.02);
  filter: brightness(1.05);
}

.grid-workspace-card.selected {
  transform: translateY(-2px) scale(1.01);
  filter: brightness(1.1);
  box-shadow: 0 0 0 2px currentColor !important;
}

.grid-workspace-card.favorite::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-left: 20px solid transparent;
  border-top: 20px solid #fbbf24;
  z-index: 10;
}

.grid-workspace-card.favorite::after {
  content: '★';
  position: absolute;
  top: 2px;
  right: 2px;
  color: white;
  font-size: 0.75rem;
  z-index: 11;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-weight: 600;
  font-size: 1.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 0.5rem;
  color: inherit; /* Inherit color from parent */
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
}

.action-btn:hover {
  transform: scale(1.1);
  filter: brightness(1.2);
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
  opacity: 0.8;
  color: inherit; /* Inherit color from parent */
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.tag {
  transition: all 0.2s ease;
}

.tag:hover {
  transform: scale(1.05);
  filter: brightness(1.1);
}

.context-menu-item {
  @apply flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-base-200/50 text-left;
}

.text-error {
  color: #ef4444;
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

/* Enhanced animations */
@keyframes cardPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.grid-workspace-card.selected {
  animation: cardPulse 2s infinite;
}
</style>