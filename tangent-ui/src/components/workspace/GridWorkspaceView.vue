<template>
  <div class="grid-workspace-view" ref="containerRef">
    <!-- Virtual Scroll Container -->
    <div class="virtual-scroll-container" 
         :style="{ height: `${totalHeight}px` }">
      
      <!-- Visible Items -->
      <div class="visible-items" 
           :style="{ transform: `translateY(${offsetY}px)` }">
        
        <TransitionGroup name="grid-item" tag="div" class="grid-container">
          <div v-for="workspace in visibleWorkspaces" 
               :key="workspace.id" 
               class="grid-item"
               :data-index="workspace._index">
            
            <!-- Workspace Card -->
            <div class="workspace-card" 
                 :class="{ 
                   'selected': selectedWorkspaceId === workspace.id,
                   'favorite': workspace.isFavorite,
                   'loading': workspace._loading
                 }"
                 @click="handleSelectWorkspace(workspace.id)"
                 @mouseenter="preloadWorkspace(workspace.id)"
                 :data-workspace-id="workspace.id">
              
              <!-- Card Background Effects -->
              <div class="card-background">
                <div class="gradient-overlay"></div>
                <div class="noise-overlay"></div>
                <div class="shimmer-effect" v-if="workspace._loading"></div>
              </div>
              
              <!-- Card Content -->
              <div class="card-content">
                <!-- Header Section -->
                <div class="card-header">
                  <div class="title-section">
                    <h3 class="workspace-title">
                      {{ workspace.title || 'Untitled Workspace' }}
                    </h3>
                    <div class="workspace-subtitle" v-if="workspace.description">
                      {{ truncateText(workspace.description, 60) }}
                    </div>
                  </div>
                  
                  <div class="actions-section">
                    <button @click.stop="toggleFavorite(workspace.id)" 
                            class="action-btn favorite-btn"
                            :class="{ 'is-favorite': workspace.isFavorite }">
                      <Star :size="18" :fill="workspace.isFavorite ? 'currentColor' : 'none'" />
                    </button>
                    <button @click.stop="showContextMenu(workspace, $event)" 
                            class="action-btn menu-btn">
                      <MoreVertical :size="18" />
                    </button>
                  </div>
                </div>
                
                <!-- Stats Row -->
                <div class="stats-row">
                  <div class="stat-item">
                    <GitBranch :size="12" class="stat-icon" />
                    <span class="stat-value">{{ workspace.nodeCount || workspace.branches?.length || 0 }}</span>
                  </div>
                  <div class="stat-item">
                    <MessageSquare :size="12" class="stat-icon" />
                    <span class="stat-value">{{ workspace.messageCount || workspace.messages?.length || 0 }}</span>
                  </div>
                  <div class="stat-item">
                    <Clock :size="12" class="stat-icon" />
                    <span class="stat-value">{{ formatRelativeTime(workspace.lastUpdated || workspace.updatedAt || workspace.createdAt) }}</span>
                  </div>
                </div>
                
                <!-- Tags Section -->
                <div v-if="workspace.tags?.length" class="tags-section">
                  <TransitionGroup name="tag" tag="div" class="tags-container">
                    <span v-for="tag in workspace.tags.slice(0, 3)" 
                          :key="`${workspace.id}-${tag.id}`"
                          class="tag-pill"
                          :style="getTagStyle(tag)">
                      {{ tag.name }}
                    </span>
                    <span v-if="workspace.tags.length > 3" 
                          class="tag-pill more-tags">
                      +{{ workspace.tags.length - 3 }}
                    </span>
                  </TransitionGroup>
                </div>
                
              </div>
              
              <!-- Hover Effects -->
              <div class="hover-layer"></div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>
    
    <!-- Loading Indicator -->
    <Transition name="fade">
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>
    </Transition>
    
    <!-- Context Menu -->
    <Teleport to="body">
      <Transition name="context-menu">
        <ContextMenu 
          v-if="contextMenu.visible" 
          :position="contextMenu.position"
          @close="closeContextMenu">
          <button @click="handleAction('duplicate')" class="menu-item">
            <Copy :size="16" /> Duplicate
          </button>
          <button @click="handleAction('archive')" class="menu-item">
            <Archive :size="16" /> Archive
          </button>
          <button @click="handleAction('export')" class="menu-item">
            <Download :size="16" /> Export
          </button>
          <div class="menu-divider"></div>
          <button @click="handleAction('delete')" class="menu-item danger">
            <Trash2 :size="16" /> Delete
          </button>
        </ContextMenu>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, reactive } from 'vue';
import { 
  Star, MoreVertical, GitBranch, MessageSquare, Clock,
  Copy, Archive, Download, Trash2 
} from 'lucide-vue-next';
import { useVirtualScroll } from '@/composables/useVirtualScroll';
import { useThemeStore } from '@/stores/themeStore';
import ContextMenu from '@/components/ui/ContextMenu.vue';

// Props & Emits
const props = defineProps({
  workspaces: {
    type: Array,
    required: true
  },
  selectedWorkspaceId: String,
  searchQuery: String,
  itemsPerRow: {
    type: Number,
    default: 5
  }
});

const emit = defineEmits([
  'select-workspace',
  'favorite-workspace',
  'duplicate-workspace',
  'archive-workspace',
  'export-workspace',
  'delete-workspace'
]);

// Refs
const containerRef = ref<HTMLElement>();
const isLoading = ref(false);
const preloadedIds = new Set<string>();

// Local state for favorites to handle optimistic updates
const localFavorites = ref<Set<string>>(new Set());

// Theme & Performance
const themeStore = useThemeStore();

// Context Menu State
const contextMenu = ref({
  visible: false,
  position: { x: 0, y: 0 },
  workspace: null
});

// Virtual Scrolling Configuration
const ITEM_HEIGHT = 160; // Height of each card
const ITEM_GAP = 24; // Gap between items
const BUFFER_ITEMS = 2; // Extra rows to render off-screen
const SCROLL_DEBOUNCE = 16; // 60fps

// Initialize local favorites from props
watch(() => props.workspaces, (newWorkspaces) => {
  localFavorites.value = new Set(
    newWorkspaces.filter(w => w.isFavorite).map(w => w.id)
  );
}, { immediate: true });

// Computed Properties
const filteredWorkspaces = computed(() => {
  const workspaces = props.searchQuery 
    ? props.workspaces.filter(workspace => {
        const query = props.searchQuery.toLowerCase();
        const title = (workspace.title || '').toLowerCase();
        const description = (workspace.description || '').toLowerCase();
        const tags = workspace.tags?.map(t => t.name.toLowerCase()) || [];
        
        return title.includes(query) || 
               description.includes(query) || 
               tags.some(tag => tag.includes(query));
      })
    : props.workspaces;
  
  // Apply local favorite state
  return workspaces.map(w => ({
    ...w,
    isFavorite: localFavorites.value.has(w.id)
  }));
});

// Virtual Scroll Setup
const {
  visibleItems: visibleWorkspaces,
  totalHeight,
  offsetY,
  handleScroll
} = useVirtualScroll({
  items: filteredWorkspaces,
  containerRef,
  itemHeight: ITEM_HEIGHT,
  itemsPerRow: props.itemsPerRow,
  gap: ITEM_GAP,
  buffer: BUFFER_ITEMS,
  debounce: SCROLL_DEBOUNCE
});

// Methods
const handleSelectWorkspace = (id: string) => {
  emit('select-workspace', id);
};

const toggleFavorite = (id: string) => {
  // Toggle local state for immediate feedback
  if (localFavorites.value.has(id)) {
    localFavorites.value.delete(id);
  } else {
    localFavorites.value.add(id);
  }
  
  // Force reactivity update
  localFavorites.value = new Set(localFavorites.value);
  
  // Emit event to parent
  emit('favorite-workspace', id);
};

const showContextMenu = (workspace: any, event: MouseEvent) => {
  contextMenu.value = {
    visible: true,
    position: { x: event.clientX, y: event.clientY },
    workspace
  };
};

const closeContextMenu = () => {
  contextMenu.value.visible = false;
};

const handleAction = (action: string) => {
  const workspace = contextMenu.value.workspace;
  if (!workspace) return;
  
  emit(`${action}-workspace`, workspace.id);
  closeContextMenu();
};

const preloadWorkspace = async (id: string) => {
  if (preloadedIds.has(id)) return;
  preloadedIds.add(id);
  
  // Simulate preloading workspace data
  // In real implementation, this would fetch additional data
  await nextTick();
};

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const formatRelativeTime = (dateString: string) => {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 7) {
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
  } else if (diffDays > 0) {
    return `${diffDays}d ago`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else if (diffMins > 0) {
    return `${diffMins}m ago`;
  } else {
    return 'Just now';
  }
};

const getTagStyle = (tag: any) => {
  const colors = {
    primary: { bg: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' },
    secondary: { bg: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' },
    success: { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' },
    warning: { bg: 'rgba(251, 146, 60, 0.1)', color: '#fb923c' },
    error: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }
  };
  
  const colorScheme = colors[tag.color] || colors.primary;
  
  return {
    backgroundColor: colorScheme.bg,
    color: colorScheme.color,
    border: `1px solid ${colorScheme.color}20`
  };
};

// Lifecycle
onMounted(() => {
  if (containerRef.value) {
    containerRef.value.addEventListener('scroll', handleScroll, { passive: true });
    
    // Handle responsive grid
    const resizeObserver = new ResizeObserver(() => {
      handleScroll();
    });
    resizeObserver.observe(containerRef.value);
    
    onBeforeUnmount(() => {
      containerRef.value?.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    });
  }
});

// Watch for changes
watch(() => props.searchQuery, () => {
  // Reset scroll position on search
  if (containerRef.value) {
    containerRef.value.scrollTop = 0;
  }
});

</script>

<style scoped>
.grid-workspace-view {
  @apply w-full h-full overflow-auto relative;
  container-type: inline-size;
}

.virtual-scroll-container {
  @apply relative w-full;
}

.visible-items {
  @apply absolute top-0 left-0 right-0;
  will-change: transform;
}

.grid-container {
  @apply grid gap-6 p-6;
  grid-template-columns: repeat(5, 1fr);
}

/* Responsive Grid */
@container (max-width: 1400px) {
  .grid-container {
    grid-template-columns: repeat(4, 1fr);
  }
}

@container (max-width: 1100px) {
  .grid-container {
    grid-template-columns: repeat(3, 1fr);
  }
}

@container (max-width: 800px) {
  .grid-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

@container (max-width: 500px) {
  .grid-container {
    grid-template-columns: 1fr;
  }
}

.grid-item {
  @apply relative;
  contain: layout style paint;
}

.workspace-card {
  @apply relative h-[160px] rounded-xl overflow-hidden cursor-pointer;
  @apply transition-all duration-300 ease-out;
  @apply bg-base-100 border border-base-300;
  transform: translateZ(0); /* Force GPU acceleration */
  will-change: transform;
}

.workspace-card:hover {
  @apply shadow-2xl border-primary/50;
  transform: translateY(-4px) scale(1.02);
}

.workspace-card.selected {
  @apply ring-2 ring-primary ring-offset-2 ring-offset-base-100;
  transform: translateY(-2px) scale(1.01);
}

/* Remove the corner indicator - we have the star button now */
/* .workspace-card.favorite::before {
  @apply absolute top-0 right-0 w-16 h-16;
  content: '';
  background: linear-gradient(135deg, #fbbf24 0%, transparent 50%);
  clip-path: polygon(100% 0, 0 0, 100% 100%);
} */

.workspace-card.loading {
  @apply animate-pulse;
}

/* Card Background Effects */
.card-background {
  @apply absolute inset-0 -z-10;
}

.gradient-overlay {
  @apply absolute inset-0;
  background: linear-gradient(135deg, 
    rgba(var(--p), 0.05) 0%, 
    transparent 50%,
    rgba(var(--s), 0.05) 100%);
}

.noise-overlay {
  @apply absolute inset-0 opacity-[0.02];
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E");
}

.shimmer-effect {
  @apply absolute inset-0;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(255, 255, 255, 0.1) 50%, 
    transparent 100%);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Card Content */
.card-content {
  @apply relative h-full p-4 flex flex-col gap-3;
}

.card-header {
  @apply flex justify-between items-start gap-3;
}

.title-section {
  @apply flex-1 min-w-0;
}

.workspace-title {
  @apply text-base font-semibold truncate;
  @apply text-base-content;
}

.workspace-subtitle {
  @apply text-xs text-base-content/60 mt-0.5;
  @apply line-clamp-1;
}

.actions-section {
  @apply flex gap-2 flex-shrink-0;
}

.action-btn {
  @apply w-8 h-8 rounded-lg flex items-center justify-center;
  @apply bg-base-200 hover:bg-base-300;
  @apply transition-all duration-200;
  @apply text-base-content/70 hover:text-base-content;
}

.favorite-btn.is-favorite {
  @apply text-warning bg-warning/20;
  @apply border border-warning/30;
}

.favorite-btn:hover {
  @apply bg-warning/10 text-warning;
}

/* Stats Row */
.stats-row {
  @apply flex justify-between items-center gap-2 mt-auto;
}

.stat-item {
  @apply flex items-center gap-1 text-xs;
  @apply text-base-content/70;
}

.stat-icon {
  @apply text-primary/70;
}

.stat-value {
  @apply font-medium;
}

/* Tags Section */
.tags-section {
  @apply mt-2;
}

.tags-container {
  @apply flex flex-wrap gap-1;
}

.tag-pill {
  @apply px-2 py-0.5 rounded-full text-xs font-medium;
  @apply transition-all duration-200;
}

.tag-pill:hover {
  @apply scale-105 brightness-110;
}

.more-tags {
  @apply bg-base-200 text-base-content/60;
}


/* Hover Layer */
.hover-layer {
  @apply absolute inset-0 pointer-events-none;
  @apply bg-gradient-to-t from-primary/5 to-transparent opacity-0;
  @apply transition-opacity duration-300;
}

.workspace-card:hover .hover-layer {
  @apply opacity-100;
}

/* Loading State */
.loading-overlay {
  @apply absolute inset-0 flex items-center justify-center;
  @apply bg-base-100/80 backdrop-blur-sm;
}

.loading-spinner {
  @apply w-12 h-12 border-primary/30 border-t-primary;
  @apply rounded-full animate-spin;
}

/* Context Menu */
.menu-item {
  @apply flex items-center gap-3 w-full px-4 py-2.5;
  @apply text-sm hover:bg-base-200;
  @apply transition-colors duration-150;
}

.menu-item.danger {
  @apply text-error hover:bg-error/10;
}

.menu-divider {
  @apply h-px bg-base-200 my-1;
}

/* Animations */
.grid-item-enter-active,
.grid-item-leave-active {
  transition: all 0.3s ease;
}

.grid-item-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

.grid-item-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.tag-enter-active,
.tag-leave-active {
  transition: all 0.2s ease;
}

.tag-enter-from,
.tag-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.context-menu-enter-active,
.context-menu-leave-active {
  transition: all 0.2s ease;
}

.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Performance Optimizations */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Performance Debug Panel */
.performance-debug {
  @apply fixed top-4 right-4 z-50;
  pointer-events: none;
}

.debug-panel {
  @apply bg-base-100/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-base-300;
  @apply text-xs font-mono;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 120px;
}

.debug-metric {
  @apply flex justify-between items-center;
}

.metric-label {
  @apply text-base-content/60 font-medium;
}

.metric-value {
  @apply text-base-content font-semibold;
}

.metric-value.good {
  @apply text-success;
}

.metric-value.bad {
  @apply text-error;
}

/* Dark Mode Enhancements */
:root[data-theme="dark"] .workspace-card {
  @apply bg-base-100/50 backdrop-blur-sm;
}

:root[data-theme="dark"] .gradient-overlay {
  background: linear-gradient(135deg, 
    rgba(var(--p), 0.1) 0%, 
    transparent 50%,
    rgba(var(--s), 0.1) 100%);
}
</style>