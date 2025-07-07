<template>
  <div 
    class="enhanced-grid-view" 
    ref="containerRef"
    :class="{ 'drag-over': isDragOver }"
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Controls Bar with smooth animations -->
    <div v-if="!externalControls" class="controls-bar">
      <Transition name="slide-fade" appear>
        <div class="view-controls">
          <div class="view-mode-selector">
            <button 
              v-for="(mode, index) in viewModes" 
              :key="mode.id"
              @click="internalViewMode = mode.id"
              class="view-mode-btn modern-button"
              :class="{ 'active': currentViewMode === mode.id }"
              :style="{ '--stagger-delay': index * 0.1 + 's' }"
            >
              <component :is="mode.icon" :size="16" />
              <span>{{ mode.label }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Enhanced Drag and Drop Grid -->
    <div v-if="!isInitializing" class="enhanced-grid-container">
      <VueDraggable
        v-model="workspaceItems"
        :animation="300"
        :force-fallback="true"
        :fallback-class="'workspace-card-fallback'"
        :ghost-class="'workspace-card-ghost'"
        :chosen-class="'workspace-card-chosen'"
        :drag-class="'workspace-card-drag'"
        :group="{ name: 'workspaces', pull: false, put: false }"
        :sort="true"
        :disabled="currentViewMode === 'graph'"
        @start="onDragStart"
        @end="onDragEnd"
        @change="onDragChange"
        class="workspace-grid modern-grid"
        :class="currentViewMode"
        tag="div"
      >
        <!-- Workspace Cards with modern design -->
        <div 
          v-for="(workspace, index) in workspaceItems" 
          :key="workspace.id"
          :data-id="workspace.id"
          class="workspace-card modern-card"
          :class="{ 
            'selected': selectedWorkspaceId === workspace.id,
            'favorite': workspace.isFavorite,
            'compact': currentViewMode === 'compact',
            'detailed': currentViewMode === 'detailed',
            'dragging': draggingId === workspace.id
          }"
          :style="{ 
            '--animation-delay': `${index * 0.05}s`,
            '--card-index': index
          }"
          @click="handleWorkspaceClick(workspace)"
          @contextmenu="handleContextMenu($event, workspace)"
        >
          <!-- Card Glass Effect -->
          <div class="card-glass-bg"></div>
          
          <!-- Card Content -->
          <div class="card-content">
            <!-- Header with enhanced typography -->
            <div class="card-header">
              <div class="workspace-icon">
                <component :is="getWorkspaceIcon(workspace)" :size="20" />
              </div>
              <h3 class="workspace-title">{{ truncateText(workspace.title || 'Untitled', 40) }}</h3>
              <div class="card-actions">
                <button 
                  @click.stop="toggleFavorite(workspace)"
                  class="action-btn favorite-btn"
                  :class="{ 'active': workspace.isFavorite }"
                >
                  <Heart :size="16" />
                </button>
              </div>
            </div>

            <!-- Enhanced Stats with micro-animations -->
            <div class="workspace-stats">
              <div class="stat-item">
                <MessageSquare :size="14" />
                <span>{{ workspace.nodeCount || 0 }}</span>
              </div>
              <div class="stat-item">
                <Clock :size="14" />
                <span>{{ formatTime(workspace.lastUpdated) }}</span>
              </div>
              <div v-if="workspace.tags?.length" class="stat-item">
                <Tag :size="14" />
                <span>{{ workspace.tags.length }}</span>
              </div>
            </div>

            <!-- Activity Graph with smooth animations -->
            <div v-if="currentViewMode === 'detailed'" class="activity-graph">
              <div class="activity-bars">
                <div 
                  v-for="(day, i) in getActivityData(workspace)" 
                  :key="i"
                  class="activity-bar"
                  :style="{ 
                    '--height': `${day.activity * 100}%`,
                    '--delay': `${i * 0.1}s`
                  }"
                ></div>
              </div>
            </div>

            <!-- Tags with enhanced styling -->
            <div v-if="workspace.tags?.length && currentViewMode !== 'compact'" class="workspace-tags">
              <span 
                v-for="tag in workspace.tags.slice(0, 3)" 
                :key="tag.id"
                class="workspace-tag modern-tag"
                :style="{ '--tag-color': tag.color }"
              >
                {{ tag.name }}
              </span>
              <span v-if="workspace.tags.length > 3" class="tag-more">
                +{{ workspace.tags.length - 3 }}
              </span>
            </div>
          </div>

          <!-- Hover Effects -->
          <div class="card-hover-overlay"></div>
        </div>
      </VueDraggable>
    </div>

    <!-- Enhanced Loading State -->
    <Transition name="fade" mode="out-in">
      <div v-if="isInitializing" class="loading-state modern-loading">
        <div class="loading-content">
          <div class="loading-spinner modern-spinner"></div>
          <h3>Loading workspaces...</h3>
          <p>Preparing your creative space</p>
        </div>
      </div>
    </Transition>

    <!-- Drag Overlay for smooth drag operations -->
    <Teleport to="body">
      <div 
        v-if="dragOverlay.visible" 
        class="drag-overlay"
        :style="dragOverlay.style"
      >
        <div class="drag-preview-card">
          <div class="drag-preview-content">
            <component :is="getWorkspaceIcon(dragOverlay.workspace)" :size="20" />
            <span>{{ dragOverlay.workspace?.title }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { useGesture } from '@vueuse/gesture';
import { 
  Grid, List, LayoutGrid, Network, Heart, MessageSquare, 
  Clock, Tag, FileText, Bot, Code, Database 
} from 'lucide-vue-next';

// Props
interface Props {
  workspaces?: any[];
  searchQuery?: string;
  viewMode?: 'grid' | 'compact' | 'detailed' | 'graph';
  sortBy?: string;
  cardSize?: number;
  externalControls?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  workspaces: () => [],
  viewMode: 'grid',
  sortBy: 'recent',
  cardSize: 240,
  externalControls: false
});

// Emits
const emit = defineEmits<{
  'select-workspace': [workspace: any];
  'update-favorite': [workspaceId: string, isFavorite: boolean];
  'workspace-reorder': [oldIndex: number, newIndex: number];
}>();

// Reactive state
const containerRef = ref<HTMLElement>();
const selectedWorkspaceId = ref<string | null>(null);
const isDragOver = ref(false);
const isInitializing = ref(true);
const draggingId = ref<string | null>(null);

// View modes
const viewModes = [
  { id: 'grid', label: 'Grid', icon: Grid },
  { id: 'compact', label: 'Compact', icon: List },
  { id: 'detailed', label: 'Detailed', icon: LayoutGrid },
  { id: 'graph', label: 'Graph', icon: Network }
];

// Internal view mode (for non-external controls)
const internalViewMode = ref(props.viewMode);
const currentViewMode = computed(() => 
  props.externalControls ? props.viewMode : internalViewMode.value
);

// Drag overlay state
const dragOverlay = reactive({
  visible: false,
  workspace: null as any,
  style: {} as Record<string, string>
});

// Enhanced workspace items with draggable functionality
const workspaceItems = computed({
  get: () => props.workspaces || [],
  set: (value) => {
    // Handle reordering
    const oldOrder = props.workspaces || [];
    if (JSON.stringify(oldOrder.map(w => w.id)) !== JSON.stringify(value.map(w => w.id))) {
      // Find the moved item
      for (let i = 0; i < value.length; i++) {
        const newIndex = i;
        const oldIndex = oldOrder.findIndex(w => w.id === value[i].id);
        if (oldIndex !== newIndex && oldIndex !== -1) {
          emit('workspace-reorder', oldIndex, newIndex);
          break;
        }
      }
    }
  }
});

// Drag and drop handlers
const onDragStart = (evt: any) => {
  draggingId.value = evt.item.dataset.id;
  
  // Create enhanced drag overlay
  const workspace = workspaceItems.value.find(w => w.id === draggingId.value);
  if (workspace) {
    dragOverlay.workspace = workspace;
    dragOverlay.visible = true;
    
    // Position the overlay
    const rect = evt.item.getBoundingClientRect();
    dragOverlay.style = {
      position: 'fixed',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      pointerEvents: 'none',
      zIndex: '9999',
      transition: 'transform 0.2s ease-out'
    };
  }
};

const onDragEnd = (evt: any) => {
  draggingId.value = null;
  dragOverlay.visible = false;
  
  // Smooth animation back to position
  setTimeout(() => {
    dragOverlay.workspace = null;
  }, 300);
};

const onDragChange = (evt: any) => {
  // Handle the actual reordering logic
  if (evt.moved) {
    const { oldIndex, newIndex } = evt.moved;
    emit('workspace-reorder', oldIndex, newIndex);
  }
};

// File drop handlers
const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'copy';
  isDragOver.value = true;
};

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault();
  isDragOver.value = true;
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  if (!containerRef.value?.contains(e.relatedTarget as Node)) {
    isDragOver.value = false;
  }
};

const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  isDragOver.value = false;
  
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length > 0) {
    // Handle file import (implement your file import logic here)
    console.log('Files dropped:', files);
  }
};

// Workspace interactions
const handleWorkspaceClick = (workspace: any) => {
  selectedWorkspaceId.value = workspace.id;
  emit('select-workspace', workspace);
};

const handleContextMenu = (e: MouseEvent, workspace: any) => {
  e.preventDefault();
  // Implement context menu if needed
};

const toggleFavorite = (workspace: any) => {
  emit('update-favorite', workspace.id, !workspace.isFavorite);
};

// Utility functions
const getWorkspaceIcon = (workspace: any) => {
  if (workspace.tags?.some((t: any) => t.name.toLowerCase().includes('ai'))) return Bot;
  if (workspace.tags?.some((t: any) => t.name.toLowerCase().includes('code'))) return Code;
  if (workspace.nodeCount > 10) return Database;
  return FileText;
};

const getActivityData = (workspace: any) => {
  // Generate mock activity data for the past 7 days
  return Array.from({ length: 7 }, (_, i) => ({
    day: i,
    activity: Math.random() * 0.8 + 0.2
  }));
};

const truncateText = (text: string, maxLength: number) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const formatTime = (dateString: string) => {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffDays > 30) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } else if (diffDays > 0) {
    return `${diffDays}d`;
  } else if (diffHours > 0) {
    return `${diffHours}h`;
  } else if (diffMins > 0) {
    return `${diffMins}m`;
  } else {
    return 'now';
  }
};

// Initialize with smooth entrance animation
onMounted(async () => {
  // Simulate loading time for smooth entrance
  await new Promise(resolve => setTimeout(resolve, 800));
  isInitializing.value = false;
});

// Enhanced gesture support
if (containerRef.value) {
  useGesture({
    onDrag: ({ movement: [x, y], dragging }) => {
      if (dragging && dragOverlay.visible) {
        // Update drag overlay position
        dragOverlay.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
      }
    },
    onDragEnd: () => {
      if (dragOverlay.visible) {
        dragOverlay.style.transform = 'scale(1)';
      }
    }
  }, {
    target: containerRef,
    drag: {
      filterTaps: true,
      threshold: 10
    }
  });
}
</script>

<style scoped>
/* Modern Glass-morphism Design */
.enhanced-grid-view {
  @apply relative w-full h-full;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--b1)) l c h / 0.95) 0%, 
    oklch(from oklch(var(--b2)) l c h / 0.9) 100%);
  backdrop-filter: blur(20px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.enhanced-grid-view.drag-over {
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.1) 0%, 
    oklch(from oklch(var(--s)) l c h / 0.05) 100%);
  transform: scale(1.01);
}

/* Controls with modern animations */
.controls-bar {
  @apply mb-6 p-4;
  background: oklch(from oklch(var(--b1)) l c h / 0.8);
  backdrop-filter: blur(16px);
  border-radius: 24px;
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  box-shadow: 
    0 8px 32px oklch(from oklch(var(--b3)) l c h / 0.3),
    inset 0 1px 0 oklch(from oklch(var(--bc)) l c h / 0.05);
}

.view-mode-selector {
  @apply flex gap-2;
}

.modern-button {
  @apply relative px-4 py-2 rounded-xl font-medium text-sm;
  @apply transition-all duration-300 ease-out;
  background: oklch(from oklch(var(--b1)) l c h / 0.5);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  color: oklch(var(--bc));
  backdrop-filter: blur(12px);
  animation: slideInButton 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: var(--stagger-delay);
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}

.modern-button:hover {
  transform: translateY(-2px) scale(1.02);
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  border-color: oklch(from oklch(var(--p)) l c h / 0.3);
  box-shadow: 
    0 8px 25px oklch(from oklch(var(--p)) l c h / 0.2),
    0 0 0 1px oklch(from oklch(var(--p)) l c h / 0.1);
}

.modern-button.active {
  background: linear-gradient(135deg, 
    oklch(var(--p)), 
    oklch(from oklch(var(--p)) calc(l + 0.1) c h));
  color: oklch(var(--pc));
  border-color: oklch(from oklch(var(--p)) l c h / 0.5);
  box-shadow: 
    0 8px 25px oklch(from oklch(var(--p)) l c h / 0.3),
    inset 0 1px 0 oklch(from oklch(var(--pc)) l c h / 0.2);
}

/* Enhanced Grid Layout */
.enhanced-grid-container {
  @apply relative;
}

.modern-grid {
  @apply grid gap-6;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  animation: gridFadeIn 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards;
}

.modern-grid.compact {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.modern-grid.detailed {
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}

/* Modern Card Design with Glass-morphism */
.modern-card {
  @apply relative rounded-2xl overflow-hidden cursor-pointer;
  @apply transition-all duration-500 ease-out;
  background: oklch(from oklch(var(--b1)) l c h / 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  box-shadow: 
    0 4px 20px oklch(from oklch(var(--b3)) l c h / 0.2),
    inset 0 1px 0 oklch(from oklch(var(--bc)) l c h / 0.05);
  animation: cardSlideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: var(--animation-delay);
  opacity: 0;
  transform: translateY(30px) scale(0.95);
}

.modern-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 
    0 20px 40px oklch(from oklch(var(--b3)) l c h / 0.3),
    0 0 0 1px oklch(from oklch(var(--p)) l c h / 0.1),
    inset 0 1px 0 oklch(from oklch(var(--bc)) l c h / 0.1);
  border-color: oklch(from oklch(var(--p)) l c h / 0.2);
}

.modern-card.selected {
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.1) 0%, 
    oklch(from oklch(var(--s)) l c h / 0.05) 100%);
  border-color: oklch(var(--p));
  box-shadow: 
    0 8px 32px oklch(from oklch(var(--p)) l c h / 0.3),
    0 0 0 2px oklch(var(--p)),
    inset 0 1px 0 oklch(from oklch(var(--pc)) l c h / 0.1);
}

.modern-card.dragging {
  opacity: 0.5;
  transform: scale(1.05) rotate(3deg);
  z-index: 1000;
}

/* Card Glass Background */
.card-glass-bg {
  @apply absolute inset-0 opacity-50;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--b1)) calc(l + 0.05) c h / 0.8) 0%, 
    oklch(from oklch(var(--b2)) calc(l - 0.02) c h / 0.6) 100%);
  backdrop-filter: blur(16px);
}

/* Card Content */
.card-content {
  @apply relative z-10 p-6;
}

.card-header {
  @apply flex items-start gap-3 mb-4;
}

.workspace-icon {
  @apply flex-shrink-0 p-2 rounded-xl;
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  color: oklch(var(--p));
  transition: all 0.3s ease;
}

.workspace-title {
  @apply flex-1 font-semibold text-lg leading-tight;
  color: oklch(var(--bc));
  line-height: 1.3;
}

.card-actions {
  @apply flex gap-2;
}

.action-btn {
  @apply p-2 rounded-lg transition-all duration-300;
  background: oklch(from oklch(var(--b2)) l c h / 0.8);
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
}

.action-btn:hover {
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  color: oklch(var(--p));
  border-color: oklch(from oklch(var(--p)) l c h / 0.3);
  transform: scale(1.1);
}

.favorite-btn.active {
  background: oklch(from oklch(var(--error)) l c h / 0.1);
  color: oklch(var(--error));
  border-color: oklch(from oklch(var(--error)) l c h / 0.3);
}

/* Stats with micro-animations */
.workspace-stats {
  @apply flex gap-4 mb-4 text-sm;
}

.stat-item {
  @apply flex items-center gap-2;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
  transition: all 0.3s ease;
}

.stat-item:hover {
  color: oklch(var(--p));
  transform: scale(1.05);
}

/* Activity Graph */
.activity-graph {
  @apply mb-4;
}

.activity-bars {
  @apply flex gap-1 h-8;
}

.activity-bar {
  @apply flex-1 rounded-t-sm;
  background: linear-gradient(to top, 
    oklch(from oklch(var(--p)) l c h / 0.6),
    oklch(from oklch(var(--s)) l c h / 0.8));
  height: var(--height);
  animation: barGrow 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: var(--delay);
  transform: scaleY(0);
  transform-origin: bottom;
}

/* Tags */
.workspace-tags {
  @apply flex flex-wrap gap-2;
}

.modern-tag {
  @apply px-3 py-1 rounded-full text-xs font-medium;
  background: oklch(from var(--tag-color) l c h / 0.1);
  color: var(--tag-color);
  border: 1px solid oklch(from var(--tag-color) l c h / 0.2);
  transition: all 0.3s ease;
}

.modern-tag:hover {
  background: oklch(from var(--tag-color) l c h / 0.2);
  transform: translateY(-1px) scale(1.05);
}

.tag-more {
  @apply px-3 py-1 rounded-full text-xs font-medium;
  background: oklch(from oklch(var(--bc)) l c h / 0.1);
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

/* Hover Effects */
.card-hover-overlay {
  @apply absolute inset-0 opacity-0 pointer-events-none;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.05) 0%, 
    oklch(from oklch(var(--s)) l c h / 0.03) 100%);
  transition: opacity 0.3s ease;
}

.modern-card:hover .card-hover-overlay {
  opacity: 1;
}

/* Drag and Drop States */
.workspace-card-ghost {
  opacity: 0.3;
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  border-color: oklch(var(--p));
}

.workspace-card-chosen {
  transform: scale(1.05) rotate(2deg);
  box-shadow: 0 15px 35px oklch(from oklch(var(--p)) l c h / 0.3);
}

.workspace-card-drag {
  opacity: 0.8;
  transform: rotate(5deg);
}

.workspace-card-fallback {
  @apply rounded-2xl;
  background: oklch(from oklch(var(--p)) l c h / 0.2);
  border: 2px dashed oklch(var(--p));
  backdrop-filter: blur(16px);
}

/* Drag Overlay */
.drag-overlay {
  pointer-events: none;
  z-index: 9999;
}

.drag-preview-card {
  @apply w-full h-full rounded-2xl;
  background: oklch(from oklch(var(--b1)) l c h / 0.95);
  backdrop-filter: blur(20px);
  border: 2px solid oklch(var(--p));
  box-shadow: 
    0 20px 40px oklch(from oklch(var(--p)) l c h / 0.4),
    0 0 0 1px oklch(from oklch(var(--p)) l c h / 0.2);
  transform: scale(1.1) rotate(3deg);
}

.drag-preview-content {
  @apply flex items-center gap-3 p-4;
  color: oklch(var(--bc));
  font-weight: 600;
}

/* Modern Loading State */
.modern-loading {
  @apply absolute inset-0 flex items-center justify-center;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--b1)) l c h / 0.95) 0%, 
    oklch(from oklch(var(--b2)) l c h / 0.9) 100%);
  backdrop-filter: blur(20px);
}

.loading-content {
  @apply text-center;
}

.modern-spinner {
  @apply w-12 h-12 mx-auto mb-4 rounded-full;
  background: conic-gradient(from 0deg, 
    oklch(var(--p)), 
    oklch(var(--s)), 
    oklch(var(--a)), 
    oklch(var(--p)));
  animation: modernSpin 2s linear infinite;
  mask: radial-gradient(circle at center, transparent 40%, black 41%);
}

/* Animations */
@keyframes slideInButton {
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes cardSlideIn {
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes gridFadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes barGrow {
  to {
    transform: scaleY(1);
  }
}

@keyframes modernSpin {
  to {
    transform: rotate(360deg);
  }
}

/* Transition Classes */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>