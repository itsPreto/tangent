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
    <!-- Advanced Controls Bar (hidden when external controls are used) -->
    <div v-if="!externalControls" class="controls-bar animate-slide-down">
      <div class="view-controls animate-fade-in" style="--animation-delay: 0.1s">
        <!-- View Mode Selector -->
        <div class="view-mode-selector">
          <button 
            v-for="(mode, index) in viewModes" 
            :key="mode.id"
            @click="internalViewMode = mode.id"
            class="view-mode-btn animate-scale-in"
            :class="{ 'active': currentViewMode === mode.id }"
            :style="{ '--animation-delay': (0.2 + index * 0.02) + 's' }"
          >
            <component :is="mode.icon" :size="16" />
            <span>{{ mode.label }}</span>
          </button>
        </div>

        <!-- Sort & Filter -->
        <div class="filter-controls animate-fade-in" style="--animation-delay: 0.4s">
          <select v-model="internalSortBy" class="sort-select">
            <option value="recent">Recently Updated</option>
            <option value="created">Date Created</option>
            <option value="name">Name A-Z</option>
            <option value="size">Size (Nodes)</option>
            <option value="activity">Most Active</option>
          </select>

          <button 
            @click="showFilters = !showFilters" 
            class="filter-btn"
            :class="{ 'active': hasActiveFilters }"
          >
            <Filter :size="16" />
            <span>Filters</span>
            <span v-if="hasActiveFilters" class="filter-count">{{ activeFilterCount }}</span>
          </button>

          <!-- Auto-clustering hint when in graph mode -->
          <div v-if="currentViewMode === 'graph'" class="graph-info">
            <Network :size="16" />
            <span>Graph view with topic clustering</span>
          </div>
        </div>
      </div>

      <!-- Grid Size Slider -->
      <div class="grid-controls animate-fade-in" style="--animation-delay: 0.5s">
        <span class="control-label">Size</span>
        <input 
          v-model="internalCardSize" 
          type="range" 
          min="180" 
          max="320" 
          step="20"
          class="size-slider"
        >
      </div>
    </div>

    <!-- Advanced Filters Panel -->
    <Transition name="slide-down">
      <div v-if="showFilters" class="filters-panel">
        <div class="filter-section">
          <label class="filter-label">Tags</label>
          <div class="tag-filters">
            <button 
              v-for="tag in availableTags" 
              :key="tag.id"
              @click="toggleTagFilter(tag.id)"
              class="tag-filter"
              :class="{ 'active': selectedTags.has(tag.id) }"
              :style="{ '--tag-color': tag.color }"
            >
              {{ tag.name }}
            </button>
          </div>
        </div>

        <div class="filter-section">
          <label class="filter-label">Status</label>
          <div class="status-filters">
            <button 
              v-for="status in statusOptions" 
              :key="status"
              @click="toggleStatusFilter(status)"
              class="status-filter"
              :class="{ 'active': selectedStatuses.has(status) }"
            >
              {{ status }}
            </button>
          </div>
        </div>

        <div class="filter-section">
          <label class="filter-label">Size</label>
          <div class="range-filter">
            <input v-model="sizeRange[0]" type="number" placeholder="Min nodes" class="range-input">
            <span>to</span>
            <input v-model="sizeRange[1]" type="number" placeholder="Max nodes" class="range-input">
          </div>
        </div>
      </div>
    </Transition>

    <!-- Loading State -->
    <div v-if="isInitializing || isLoadingClusters" class="loading-container">
      <div class="loading-content">
        <!-- Lottie Animation Loader -->
        <DotLottieVue 
          :src="'/loading-animation-2.lottie'"
          autoplay 
          loop 
          :style="{ width: '160px', height: '160px' }"
          class="lottie-loader"
        />
        
        <div class="loading-text">
          <!-- Progress bar for clustering -->
          <div v-if="isLoadingClusters && clusteringStatus.progress > 0" class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: clusteringStatus.progress * 100 + '%' }"></div>
            </div>
            <span class="progress-text">{{ Math.round(clusteringStatus.progress * 100) }}%</span>
            <span v-if="clusteringStatus.total_workspaces > 0" class="workspace-counter">
              {{ clusteringStatus.processed_workspaces }}/{{ clusteringStatus.total_workspaces }} workspaces
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Drag Over Overlay -->
    <Transition name="drag-overlay">
      <div v-if="isDragOver" class="drag-overlay">
        <div class="drag-content">
          <div class="drag-icon">
            <Upload :size="48" />
          </div>
          <h3>Drop conversation files here</h3>
          <p>Supports ChatGPT and Claude JSON exports</p>
        </div>
      </div>
    </Transition>

    <!-- Graph Mode Loading State -->
    <div v-if="currentViewMode === 'graph' && (!clusteringEnabled || isLoadingClusters)" class="graph-loading-container">
      <div class="graph-loading-content">
        <div class="loading-spinner"></div>
        <h3>Cluster(ing) ya chats</h3>
        <p v-if="!clusteringEnabled">Starting topic clustering analysis...</p>
        <p v-else-if="isLoadingClusters">Analyzing workspace relationships...</p>
        <div class="loading-progress">
          <div class="progress-bar" :style="{ width: clusteringStatus.progress * 100 + '%' }"></div>
        </div>
      </div>
    </div>

    <!-- Grid Container or D3 Visualization -->
    <div v-if="!isInitializing && !isLoadingClusters" class="content-container">
      <!-- D3 Visualization with Topics Sidebar -->
      <div v-if="currentViewMode === 'graph' && clusteringEnabled" class="d3-layout">
        <TopicsPanel
          :clustering-status="clusteringStatus"
          :selected-cluster="selectedTopicCluster"
          @select-topic="handleTopicSelect"
          @select-workspace="handleSelectWorkspace"
          class="topics-sidebar"
        />
        <ForceGraph 
          v-if="clusteringStatus.clusters && clusteringStatus.clusters.length > 0"
          ref="d3GraphRef"
          :clustering-status="clusteringStatus"
          :external-controls="externalControls"
          @select-workspace="handleSelectWorkspace"
          @update-stats="handleGraphStatsUpdate"
          @update3-d-support="handle3DSupportUpdate"
          @update-fullscreen="handleFullscreenUpdate"
          class="d3-main"
        />
        <div v-else class="d3-placeholder">
          <div class="placeholder-content">
            <h3>No Graph Data Available</h3>
            <p>Clustering analysis is needed to generate the graph visualization.</p>
            <button @click="toggleClustering" class="retry-btn">
              Start Clustering Analysis
            </button>
          </div>
        </div>
      </div>
      
      <!-- Regular Grid View -->
      <div v-else class="grid-wrapper" :style="{ '--card-size': cardSize + 'px' }">
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
          tag="div" 
          class="workspace-grid modern-grid" 
          :class="currentViewMode"
        >
          <!-- Cluster Folder Cards -->
          <div 
            v-for="(cluster, index) in displayedClusters" 
            :key="'cluster-' + cluster.id"
            class="cluster-folder"
            :class="{ 
              'hidden-for-modal': openCluster && openCluster.id === cluster.id,
              'deconstructing': deconstructAnimation.get(cluster.id)
            }"
            :style="{ '--card-index': index }"
            @click="openClusterModal(cluster, $event)"
          >
            <div class="folder-icon">
              <FolderOpen :size="32" />
            </div>
            <div class="folder-info">
              <h3 class="folder-title">{{ cluster.title }}</h3>
              <span class="folder-count">{{ cluster.workspaces.length }} items</span>
            </div>
            <div class="cluster-actions">
              <button 
                @click="deconstructCluster(cluster, $event)" 
                class="cluster-action-btn deconstruct-btn"
                :title="'Explode ' + cluster.title"
              >
                <FolderMinus :size="16" />
              </button>
            </div>
          </div>

          <!-- Individual Workspace Cards -->
          <div 
            v-for="(workspace, index) in displayedWorkspaces" 
            :key="workspace.id" 
            class="workspace-card group enhanced"
            :class="{ 
              'selected': selectedWorkspaceId === workspace.id,
              'favorite': workspace.isFavorite,
              'compact': currentViewMode === 'compact',
              'detailed': currentViewMode === 'detailed',
              'imported': workspace.isImported,
              'chatgpt-import': workspace.format === 'chatgpt',
              'claude-import': workspace.format === 'claude',
              'deconstructed': workspace.clusterId
            }"
            :style="{ '--card-index': displayedClusters.length + index }"
            @click="handleSelectWorkspace(workspace.id)"
          >
          <!-- Card Glow Effect -->
          <div class="card-glow"></div>
          
          <!-- Card Background Pattern -->
          <div class="card-pattern"></div>

          <!-- Main Content -->
          <div class="card-content">
            <!-- Header Section -->
            <div class="card-header">
              <div class="workspace-meta">
                <!-- Workspace Type Indicator -->
                <div class="type-indicator" :class="getWorkspaceType(workspace)">
                  <component :is="getWorkspaceIcon(workspace)" :size="12" />
                </div>
                
                <div class="title-section">
                  <h3 class="workspace-title">
                    {{ workspace.title || 'Untitled' }}
                  </h3>
                  <p class="workspace-subtitle" v-if="workspace.description && currentViewMode !== 'compact'">
                    {{ truncateText(workspace.description, 60) }}
                  </p>
                </div>
              </div>
              
              <div class="card-actions">
                <!-- Reconstruct button for deconstructed workspaces -->
                <button 
                  v-if="workspace.clusterId"
                  @click.stop="reconstructCluster(workspace.clusterId, $event)" 
                  class="action-btn reconstruct-btn"
                  :title="'Rebuild cluster: ' + workspace.clusterTitle"
                >
                  <Layers :size="14" />
                </button>
                <button 
                  @click.stop="openPreviewModal(workspace, $event)" 
                  class="action-btn preview-btn"
                  :title="'Preview ' + workspace.title"
                >
                  <Eye :size="14" />
                </button>
                <button 
                  @click.stop="toggleFavorite(workspace.id)" 
                  class="action-btn favorite-btn"
                  :class="{ 'favorited': workspace.isFavorite }"
                >
                  <Star :size="14" :fill="workspace.isFavorite ? 'currentColor' : 'none'" />
                </button>
                <button 
                  @click.stop="showContextMenu(workspace, $event)" 
                  class="action-btn"
                >
                  <MoreHorizontal :size="14" />
                </button>
              </div>
            </div>

            <!-- Stats Section -->
            <div class="stats-section" v-if="currentViewMode !== 'compact'">
              <div class="primary-stats">
                <div class="stat-item">
                  <MessageSquare :size="12" />
                  <span>{{ workspace.nodeCount || 0 }}</span>
                </div>
                <div class="stat-item">
                  <Clock :size="12" />
                  <span>{{ formatTime(workspace.lastUpdated) }}</span>
                </div>
                <div class="stat-item" v-if="workspace.collaborators?.length">
                  <Users :size="12" />
                  <span>{{ workspace.collaborators.length }}</span>
                </div>
              </div>

              <!-- Activity Graph -->
              <div class="activity-graph" v-if="currentViewMode === 'detailed'">
                <div 
                  v-for="day in getActivityData(workspace)" 
                  :key="day.date"
                  class="activity-bar"
                  :style="{ height: day.activity * 100 + '%' }"
                ></div>
              </div>
            </div>

            <!-- Tags Section -->
            <div v-if="workspace.tags?.length && currentViewMode !== 'compact'" class="tags-section">
              <div class="tags-list">
                <span 
                  v-for="tag in workspace.tags.slice(0, currentViewMode === 'detailed' ? 5 : 3)" 
                  :key="tag.id"
                  class="tag"
                  :style="{ backgroundColor: tag.color }"
                >
                  {{ tag.name }}
                </span>
                <span v-if="workspace.tags.length > (currentViewMode === 'detailed' ? 5 : 3)" class="tag-overflow">
                  +{{ workspace.tags.length - (currentViewMode === 'detailed' ? 5 : 3) }}
                </span>
              </div>
            </div>

            <!-- Quick Actions (Detailed View) -->
            <div v-if="currentViewMode === 'detailed'" class="quick-actions">
              <button @click.stop="openWorkspace(workspace.id)" class="quick-btn primary">
                <Play :size="12" />
                <span>Open</span>
              </button>
              <button @click.stop="duplicateWorkspace(workspace.id)" class="quick-btn">
                <Copy :size="12" />
              </button>
              <button @click.stop="shareWorkspace(workspace.id)" class="quick-btn">
                <Share :size="12" />
              </button>
            </div>
          </div>

          <!-- Status Indicator -->
          <div class="status-indicator" :class="workspace.status || 'active'"></div>
          
          <!-- Import Source Badge -->
          <div v-if="workspace.isImported" class="import-badge" :class="workspace.format">
            <component :is="getImportIcon(workspace.format)" :size="12" />
            <span class="import-text">{{ getImportLabel(workspace.format) }}</span>
          </div>
          
          <!-- Progress Bar (if applicable) -->
          <div v-if="workspace.progress" class="progress-bar">
            <div class="progress-fill" :style="{ width: workspace.progress + '%' }"></div>
          </div>
        </div>
        </VueDraggable>
      
      <!-- Load More Button -->
      <div v-if="displayedWorkspaces.length > 0" class="load-more-section">
        <div v-if="isLoadingMore" class="loading-more">
          <div class="loading-spinner"></div>
          <span>Loading more workspaces...</span>
        </div>
        <button 
          v-else-if="hasMoreWorkspaces" 
          @click="loadMoreWorkspaces" 
          class="load-more-btn"
        >
          Load {{ Math.min(itemsPerPage, remainingWorkspaceCount) }} more workspaces
        </button>
        <div v-else-if="displayedWorkspaces.length >= itemsPerPage" class="all-loaded">
          <span>All workspaces loaded</span>
        </div>
      </div>
      
      <!-- Empty State (only show in grid view) -->
      <div v-if="displayedWorkspaces.length === 0 && displayedClusters.length === 0" class="empty-state">
        <FolderOpen :size="48" class="empty-icon" />
        <h3 class="empty-title">No workspaces found</h3>
        <p class="empty-subtitle">Try adjusting your filters or create a new workspace</p>
        <button @click="clearAllFilters" class="clear-filters-btn">
          Clear All Filters
        </button>
      </div>
      </div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <Transition name="context">
        <div 
          v-if="contextMenu.visible" 
          class="context-menu"
          :style="{ 
            left: contextMenu.position.x + 'px', 
            top: contextMenu.position.y + 'px' 
          }"
          @click.stop
        >
          <button @click="handleAction('open')" class="context-item primary">
            <Play :size="16" />
            <span>Open</span>
          </button>
          <button @click="handleAction('duplicate')" class="context-item">
            <Copy :size="16" />
            <span>Duplicate</span>
          </button>
          <button @click="handleAction('share')" class="context-item">
            <Share :size="16" />
            <span>Share</span>
          </button>
          <div class="context-divider"></div>
          <button @click="handleAction('archive')" class="context-item">
            <Archive :size="16" />
            <span>Archive</span>
          </button>
          <button @click="handleAction('export')" class="context-item">
            <Download :size="16" />
            <span>Export</span>
          </button>
          <div class="context-divider"></div>
          <button @click="handleAction('delete')" class="context-item danger">
            <Trash2 :size="16" />
            <span>Delete</span>
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Click outside handler -->
    <div 
      v-if="contextMenu.visible" 
      class="context-overlay" 
      @click="closeContextMenu"
    ></div>

    <!-- iOS Folder Modal -->
    <Teleport to="body">
      <div v-if="openCluster" class="folder-modal-overlay" @click="closeClusterModal">
        <div 
          class="folder-modal"
          :class="{ 'closing': isClosingCluster }"
          :style="modalAnimStyle" 
          @click.stop
        >
          <div class="modal-header">
            <h2>{{ openCluster.title }}</h2>
            <button @click="closeClusterModal" class="close-btn">
              <X :size="20" />
            </button>
          </div>
          
          <div class="modal-workspace-grid">
            <div 
              v-for="workspace in openCluster.workspaces"
              :key="workspace.id"
              class="modal-workspace-card"
              @click="selectWorkspaceFromModal(workspace.id)"
            >
              <div class="workspace-content">
                <h3>{{ workspace.title }}</h3>
                <p>{{ workspace.nodeCount || 0 }} nodes</p>
                <span class="workspace-date">{{ formatDate(workspace.lastUpdated) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Preview Modal -->
    <Teleport to="body">
      <div v-if="previewWorkspace" class="preview-modal-overlay" @click="closePreviewModal">
        <div 
          class="preview-modal"
          :class="{ 'closing': isClosingPreview }"
          :style="previewModalAnimStyle" 
          @click.stop
        >
          <div class="modal-header">
            <h2>{{ previewWorkspace.title || 'Untitled Workspace' }}</h2>
            <button @click="closePreviewModal" class="close-btn">
              <X :size="20" />
            </button>
          </div>
          
          <div class="preview-content">
            <!-- Workspace Details -->
            <div class="preview-details">
              <div class="detail-section">
                <h3>Overview</h3>
                <div class="detail-grid">
                  <div class="detail-item">
                    <MessageSquare :size="16" />
                    <span>{{ previewWorkspace.nodeCount || 0 }} nodes</span>
                  </div>
                  <div class="detail-item">
                    <Clock :size="16" />
                    <span>{{ formatTime(previewWorkspace.lastUpdated) }}</span>
                  </div>
                  <div class="detail-item" v-if="previewWorkspace.collaborators?.length">
                    <Users :size="16" />
                    <span>{{ previewWorkspace.collaborators.length }} collaborators</span>
                  </div>
                </div>
              </div>
              
              <!-- Description -->
              <div class="detail-section" v-if="previewWorkspace.description">
                <h3>Description</h3>
                <p>{{ previewWorkspace.description }}</p>
              </div>
              
              <!-- Tags -->
              <div class="detail-section" v-if="previewWorkspace.tags?.length">
                <h3>Tags</h3>
                <div class="preview-tags">
                  <span 
                    v-for="tag in previewWorkspace.tags"
                    :key="tag.id"
                    class="preview-tag"
                    :style="{ backgroundColor: tag.color }"
                  >
                    {{ tag.name }}
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Preview Canvas -->
            <div class="preview-canvas">
              <CanvasPreview :workspace-id="previewWorkspace.id" />
            </div>
          </div>
          
          <div class="modal-footer">
            <button @click="closePreviewModal" class="btn btn-ghost">
              Close Preview
            </button>
            <button 
              @click="closePreviewModal(); handleSelectWorkspace(previewWorkspace.id)" 
              class="btn btn-primary"
            >
              Open Workspace
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Import Progress Footer -->
    <Transition name="slide-up">
      <div v-if="isImporting || importStatus.is_running" class="import-progress-footer">
        <div class="import-progress-content">
          <div class="import-info">
            <div class="import-status">
              <div class="import-icon">
                <Upload :size="16" />
              </div>
              <div class="import-text">
                <span class="import-title">{{ importStatus.status_message || 'Importing conversations...' }}</span>
                <span class="import-subtitle">
                  {{ importStatus.imported_conversations || 0 }} imported, 
                  {{ importStatus.skipped_conversations || 0 }} skipped
                  <span v-if="importStatus.current_conversation">
                    • {{ importStatus.current_conversation }}
                  </span>
                </span>
              </div>
            </div>
            
            <!-- Progress Bar -->
            <div class="import-progress-bar">
              <div 
                class="import-progress-fill" 
                :style="{ width: (importStatus.progress || 0) + '%' }"
              ></div>
            </div>
            
            <div class="import-stats">
              <span>{{ Math.round(importStatus.progress || 0) }}%</span>
              <span>{{ importStatus.processed_conversations || 0 }}/{{ importStatus.total_conversations || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount, reactive, nextTick } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { 
  Grid, List, LayoutGrid, Filter, FolderOpen, Expand, Star, MoreHorizontal, 
  MessageSquare, Clock, Users, Play, Copy, Share, Archive, Download, Trash2,
  FileText, Image, Video, Bot, Code, Database, X, Upload, Network, Eye,
  Layers, FolderMinus
} from 'lucide-vue-next';
import { clusteringService, type ClusteringStatus } from '@/services/clusteringService';
import { conversationImportService, type ImportStatus } from '@/services/conversationImportService';
import { DotLottieVue } from '@lottiefiles/dotlottie-vue';
import ForceGraph from './ForceGraph.vue';
import TopicsPanel from './TopicsPanel.vue';
import CanvasPreview from './CanvasPreview.vue';

// Props
const props = defineProps({
  workspaces: {
    type: Array,
    required: true
  },
  selectedWorkspaceId: String,
  searchQuery: String,
  externalControls: {
    type: Boolean,
    default: false
  },
  currentViewMode: {
    type: String,
    default: 'grid'
  },
  sortBy: {
    type: String,
    default: 'recent'
  },
  cardSize: {
    type: Number,
    default: 240
  }
});

// Emits
const emit = defineEmits([
  'select-workspace',
  'favorite-workspace', 
  'duplicate-workspace',
  'archive-workspace',
  'export-workspace',
  'delete-workspace',
  'import-completed',
  'update-filter-state',
  'update-graph-stats',
  'update-3d-support',
  'update-fullscreen',
  'workspace-reorder'
]);

// Refs
const containerRef = ref<HTMLElement>();
const localFavorites = ref<Set<string>>(new Set());
const d3GraphRef = ref<any>();

// View Controls (use props when external controls are enabled)
const currentViewMode = computed(() => props.externalControls ? props.currentViewMode : internalViewMode.value);
const cardSize = computed(() => props.externalControls ? props.cardSize : internalCardSize.value);
const sortBy = computed(() => props.externalControls ? props.sortBy : internalSortBy.value);

// Internal controls (used when external controls are disabled)
const internalViewMode = ref('grid');
const internalCardSize = ref(240);
const internalSortBy = ref('recent');
const showFilters = ref(false);
const clusteringEnabled = ref(false);
const visualizationMode = ref('folder'); // 'folder' or 'd3'
const selectedTopicCluster = ref<number | null>(null);
const isInitializing = ref(true);
const isLoadingClusters = ref(false);
const loadingStartTime = ref(0);
const MINIMUM_LOADING_TIME = 1000; // 1 second minimum

// Filters
const selectedTags = ref<Set<string>>(new Set());
const selectedStatuses = ref<Set<string>>(new Set());
const sizeRange = ref([0, 1000]);
const dateRange = ref<{ start: string | null; end: string | null }>({ start: null, end: null });

// Pagination for performance
const currentPage = ref(0);
const itemsPerPage = 24; // Show 24 workspaces initially
const isLoadingMore = ref(false);

// Clustering
const clusters = ref([]);
const expandedClusters = ref<Set<string>>(new Set());
const clusteringStatus = reactive<ClusteringStatus>({
  is_running: false,
  progress: 0,
  status_message: '',
  total_workspaces: 0,
  processed_workspaces: 0,
  clusters: []
});

// Import status and drag-and-drop
const importStatus = reactive<ImportStatus>({
  is_running: false,
  progress: 0,
  status_message: '',
  total_conversations: 0,
  processed_conversations: 0,
  imported_conversations: 0,
  skipped_conversations: 0,
  errors: [],
  current_conversation: ''
});

const isDragOver = ref(false);
const isDragActive = ref(false);
const isImporting = ref(false);
const draggingId = ref<string | null>(null);

let statusUnsubscribe: (() => void) | null = null;
let importStatusUnsubscribe: (() => void) | null = null;

// Enhanced drag state
const dragOverlay = reactive({
  visible: false,
  workspace: null as any,
  style: {} as Record<string, string>
});

// Context Menu
const contextMenu = ref({
  visible: false,
  position: { x: 0, y: 0 },
  workspace: null
});

// View Modes
const viewModes = [
  { id: 'grid', label: 'Grid', icon: Grid },
  { id: 'compact', label: 'Compact', icon: List },
  { id: 'detailed', label: 'Detailed', icon: LayoutGrid },
  { id: 'graph', label: 'Graph', icon: Network }
];

// Mock data for demo
const availableTags = ref([
  { id: '1', name: 'AI/ML', color: '#6366f1' },
  { id: '2', name: 'Research', color: '#8b5cf6' },
  { id: '3', name: 'Development', color: '#06b6d4' },
  { id: '4', name: 'Analysis', color: '#10b981' },
  { id: '5', name: 'Creative', color: '#f59e0b' }
]);

const statusOptions = ['Active', 'Archived', 'Shared', 'Private'];

// Computed
const hasActiveFilters = computed(() => 
  selectedTags.value.size > 0 || 
  selectedStatuses.value.size > 0 || 
  sizeRange.value[0] > 0 || 
  sizeRange.value[1] < 1000
);

const activeFilterCount = computed(() => {
  let count = 0;
  if (selectedTags.value.size > 0) count++;
  if (selectedStatuses.value.size > 0) count++;
  if (sizeRange.value[0] > 0 || sizeRange.value[1] < 1000) count++;
  return count;
});

// Expose methods for external control
const toggleFilters = () => {
  showFilters.value = !showFilters.value;
};

// Graph control methods for external controls
const updateGraphLayout = (layout: string) => {
  if (d3GraphRef.value) {
    d3GraphRef.value.updateLayout(layout);
  }
};

const toggleGraphControls = () => {
  if (d3GraphRef.value) {
    d3GraphRef.value.updateShowControls(!d3GraphRef.value.showControls);
  }
};

const resetGraph = () => {
  if (d3GraphRef.value) {
    d3GraphRef.value.resetGraph();
  }
};

const toggleFullscreen = () => {
  if (d3GraphRef.value) {
    d3GraphRef.value.toggleFullscreen();
  }
};

defineExpose({
  toggleFilters,
  updateGraphLayout,
  toggleGraphControls,
  resetGraph,
  toggleFullscreen
});

// Watch filter state and emit to parent when using external controls
watch([hasActiveFilters, activeFilterCount], ([hasFilters, count]) => {
  if (props.externalControls) {
    emit('update-filter-state', hasFilters, count);
  }
}, { immediate: true });

const filteredWorkspaces = computed(() => {
  let workspaces = props.workspaces || [];
  
  // Apply search query
  if (props.searchQuery) {
    const query = props.searchQuery.toLowerCase();
    workspaces = workspaces.filter(w => {
      const title = (w.title || '').toLowerCase();
      const desc = (w.description || '').toLowerCase();
      const tags = w.tags?.map(t => t.name.toLowerCase()) || [];
      
      return title.includes(query) || 
             desc.includes(query) || 
             tags.some(tag => tag.includes(query));
    });
  }

  // Apply filters
  if (selectedTags.value.size > 0) {
    workspaces = workspaces.filter(w => 
      w.tags?.some(tag => selectedTags.value.has(tag.id))
    );
  }

  if (selectedStatuses.value.size > 0) {
    workspaces = workspaces.filter(w => 
      selectedStatuses.value.has(w.status || 'Active')
    );
  }

  if (sizeRange.value[0] > 0 || sizeRange.value[1] < 1000) {
    workspaces = workspaces.filter(w => {
      const nodeCount = w.nodeCount || 0;
      return nodeCount >= sizeRange.value[0] && nodeCount <= sizeRange.value[1];
    });
  }

  // Apply sorting
  workspaces = [...workspaces].sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return (a.title || '').localeCompare(b.title || '');
      case 'size':
        return (b.nodeCount || 0) - (a.nodeCount || 0);
      case 'created':
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      case 'recent':
      default:
        return new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0);
    }
  });

  // Apply local favorites
  return workspaces.map(w => ({
    ...w,
    isFavorite: localFavorites.value.has(w.id) || w.isFavorite
  }));
});

// Enhanced workspace items with draggable functionality
const workspaceItems = computed({
  get: () => filteredWorkspaces.value,
  set: (value) => {
    // Handle reordering
    const oldOrder = filteredWorkspaces.value;
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

// Real clustering results  
const clusterHoverStates = ref<Map<string, boolean>>(new Map());
const clusterHoverTimeouts = ref<Map<string, number>>(new Map());
const openCluster = ref<any>(null);
const modalAnimStyle = ref({});
const isClosingCluster = ref(false);

// Preview modal state
const previewWorkspace = ref<any>(null);
const previewModalAnimStyle = ref({});
const isClosingPreview = ref(false);

// Deconstructed clusters state
const deconstructedClusters = ref<Set<string>>(new Set());
const deconstructAnimation = ref<Map<string, boolean>>(new Map());

// Get workspaces from deconstructed clusters with filtering and pagination
const deconstructedWorkspaces = computed(() => {
  if (!clusteringEnabled.value) return [];
  
  let workspaces: any[] = [];
  clusteringStatus.clusters.forEach(cluster => {
    if (deconstructedClusters.value.has(cluster.id)) {
      // Add cluster info to each workspace for reconstruction
      cluster.workspaces.forEach(workspace => {
        workspaces.push({
          ...workspace,
          clusterId: cluster.id,
          clusterTitle: cluster.title
        });
      });
    }
  });
  
  // Apply search filtering to deconstructed workspaces
  if (props.searchQuery && props.searchQuery.trim()) {
    const query = props.searchQuery.toLowerCase();
    workspaces = workspaces.filter(w => {
      const title = (w.title || '').toLowerCase();
      const desc = (w.description || '').toLowerCase();
      const tags = w.tags?.map(t => t.name.toLowerCase()) || [];
      
      return title.includes(query) || 
             desc.includes(query) || 
             tags.some(tag => tag.includes(query));
    });
  }
  
  // Apply tag filtering
  if (selectedTags.value.size > 0) {
    workspaces = workspaces.filter(w => 
      w.tags?.some(tag => selectedTags.value.has(tag.id))
    );
  }
  
  // Apply status filtering
  if (selectedStatuses.value.size > 0) {
    workspaces = workspaces.filter(w => 
      selectedStatuses.value.has(w.status || 'active')
    );
  }
  
  // Apply date range filtering
  if (dateRange.value.start || dateRange.value.end) {
    workspaces = workspaces.filter(w => {
      const createdAt = new Date(w.createdAt || w.created_at);
      const startDate = dateRange.value.start ? new Date(dateRange.value.start) : null;
      const endDate = dateRange.value.end ? new Date(dateRange.value.end) : null;
      
      if (startDate && createdAt < startDate) return false;
      if (endDate && createdAt > endDate) return false;
      return true;
    });
  }
  
  // Apply pagination to deconstructed workspaces
  const endIndex = (currentPage.value + 1) * itemsPerPage;
  return workspaces.slice(0, endIndex);
});

const displayedClusters = computed(() => {
  if (!clusteringEnabled.value) return [];
  
  // Filter clusters based on search query
  let filtered = clusteringStatus.clusters;
  if (props.searchQuery && props.searchQuery.trim()) {
    const query = props.searchQuery.toLowerCase();
    filtered = clusteringStatus.clusters.filter(cluster => {
      // Search cluster title
      if (cluster.title.toLowerCase().includes(query)) return true;
      
      // Search workspace titles within cluster
      return cluster.workspaces.some(workspace => 
        workspace.title.toLowerCase().includes(query)
      );
    });
  }
  
  // Filter out deconstructed clusters
  return filtered
    .filter(cluster => !deconstructedClusters.value.has(cluster.id))
    .map(cluster => ({
      ...cluster,
      isHovered: clusterHoverStates.value.get(cluster.id) || false
    }));
});

// Paginated workspaces for performance
const paginatedWorkspaces = computed(() => {
  let baseWorkspaces = filteredWorkspaces.value;
  
  // Remove workspaces that are in clusters when clustering is enabled
  if (clusteringEnabled.value) {
    const clusteredWorkspaceIds = new Set();
    
    // Exclude workspaces from ALL clusters (both displayed and deconstructed)
    clusteringStatus.clusters.forEach(cluster => {
      cluster.workspaces.forEach(w => clusteredWorkspaceIds.add(w.id));
    });
    
    baseWorkspaces = baseWorkspaces.filter(w => !clusteredWorkspaceIds.has(w.id));
  }
  
  // Apply pagination
  const endIndex = (currentPage.value + 1) * itemsPerPage;
  return baseWorkspaces.slice(0, endIndex);
});

// Helper to get total filtered deconstructed workspaces count
const totalFilteredDeconstructedWorkspaces = computed(() => {
  if (!clusteringEnabled.value) return 0;
  
  let workspaces: any[] = [];
  clusteringStatus.clusters.forEach(cluster => {
    if (deconstructedClusters.value.has(cluster.id)) {
      cluster.workspaces.forEach(workspace => {
        workspaces.push({
          ...workspace,
          clusterId: cluster.id,
          clusterTitle: cluster.title
        });
      });
    }
  });
  
  // Apply same filtering logic as deconstructedWorkspaces
  if (props.searchQuery && props.searchQuery.trim()) {
    const query = props.searchQuery.toLowerCase();
    workspaces = workspaces.filter(w => {
      const title = (w.title || '').toLowerCase();
      const desc = (w.description || '').toLowerCase();
      const tags = w.tags?.map(t => t.name.toLowerCase()) || [];
      
      return title.includes(query) || 
             desc.includes(query) || 
             tags.some(tag => tag.includes(query));
    });
  }
  
  if (selectedTags.value.size > 0) {
    workspaces = workspaces.filter(w => 
      w.tags?.some(tag => selectedTags.value.has(tag.id))
    );
  }
  
  if (selectedStatuses.value.size > 0) {
    workspaces = workspaces.filter(w => 
      selectedStatuses.value.has(w.status || 'active')
    );
  }
  
  if (dateRange.value.start || dateRange.value.end) {
    workspaces = workspaces.filter(w => {
      const createdAt = new Date(w.createdAt || w.created_at);
      const startDate = dateRange.value.start ? new Date(dateRange.value.start) : null;
      const endDate = dateRange.value.end ? new Date(dateRange.value.end) : null;
      
      if (startDate && createdAt < startDate) return false;
      if (endDate && createdAt > endDate) return false;
      return true;
    });
  }
  
  return workspaces.length;
});

// Computed properties for pagination controls
const hasMoreWorkspaces = computed(() => {
  let totalWorkspaces = filteredWorkspaces.value.length;
  
  if (clusteringEnabled.value) {
    // Subtract ALL clustered workspaces (since we exclude all of them from paginatedWorkspaces)
    let clusteredCount = 0;
    clusteringStatus.clusters.forEach(cluster => {
      clusteredCount += cluster.workspaces.length;
    });
    totalWorkspaces -= clusteredCount;
  }
  
  const totalDeconstructed = totalFilteredDeconstructedWorkspaces.value;
  const currentlyShownWorkspaces = paginatedWorkspaces.value.length + deconstructedWorkspaces.value.length;
  const totalAvailableWorkspaces = totalWorkspaces + totalDeconstructed;
  
  return currentlyShownWorkspaces < totalAvailableWorkspaces;
});

const remainingWorkspaceCount = computed(() => {
  let totalWorkspaces = filteredWorkspaces.value.length;
  
  if (clusteringEnabled.value) {
    // Subtract ALL clustered workspaces (since we exclude all of them from paginatedWorkspaces)
    let clusteredCount = 0;
    clusteringStatus.clusters.forEach(cluster => {
      clusteredCount += cluster.workspaces.length;
    });
    totalWorkspaces -= clusteredCount;
  }
  
  const totalDeconstructed = totalFilteredDeconstructedWorkspaces.value;
  const currentlyShownWorkspaces = paginatedWorkspaces.value.length + deconstructedWorkspaces.value.length;
  const totalAvailableWorkspaces = totalWorkspaces + totalDeconstructed;
  
  return totalAvailableWorkspaces - currentlyShownWorkspaces;
});

// Backward compatibility alias
const displayedWorkspaces = computed(() => {
  // Combine regular workspaces with deconstructed workspaces
  return [...paginatedWorkspaces.value, ...deconstructedWorkspaces.value];
});

// Methods
const handleSelectWorkspace = (id: string) => {
  emit('select-workspace', id);
};

const handleTopicSelect = (clusterId: number) => {
  selectedTopicCluster.value = clusterId;
};

const handleGraphStatsUpdate = (stats: { topics: number; workspaces: number }) => {
  emit('update-graph-stats', stats);
};

const handle3DSupportUpdate = (supported: boolean) => {
  emit('update-3d-support', supported);
};

const handleFullscreenUpdate = (fullscreen: boolean) => {
  emit('update-fullscreen', fullscreen);
};

const toggleFavorite = (id: string) => {
  if (localFavorites.value.has(id)) {
    localFavorites.value.delete(id);
  } else {
    localFavorites.value.add(id);
  }
  localFavorites.value = new Set(localFavorites.value);
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

// Pagination methods
const loadMoreWorkspaces = async () => {
  if (isLoadingMore.value || !hasMoreWorkspaces.value) return;
  
  isLoadingMore.value = true;
  // Simulate a brief loading delay for better UX
  await new Promise(resolve => setTimeout(resolve, 200));
  currentPage.value++;
  isLoadingMore.value = false;
};

// Reset pagination when filters change
const resetPagination = () => {
  currentPage.value = 0;
};

const handleAction = (action: string) => {
  const workspace = contextMenu.value.workspace;
  if (!workspace) return;
  
  switch (action) {
    case 'open':
      handleSelectWorkspace(workspace.id);
      break;
    default:
      emit(`${action}-workspace`, workspace.id);
  }
  closeContextMenu();
};

const toggleTagFilter = (tagId: string) => {
  if (selectedTags.value.has(tagId)) {
    selectedTags.value.delete(tagId);
  } else {
    selectedTags.value.add(tagId);
  }
  selectedTags.value = new Set(selectedTags.value);
  resetPagination(); // Reset pagination when filters change
};

const toggleStatusFilter = (status: string) => {
  if (selectedStatuses.value.has(status)) {
    selectedStatuses.value.delete(status);
  } else {
    selectedStatuses.value.add(status);
  }
  resetPagination(); // Reset pagination when filters change
  selectedStatuses.value = new Set(selectedStatuses.value);
};

const toggleClustering = async () => {
  if (clusteringEnabled.value) {
    // Disable clustering
    clusteringEnabled.value = false;
    // Clear clusters from display (but keep them cached in backend)
    clusteringStatus.clusters = [];
  } else {
    // Check if we have cached results first
    try {
      setLoadingState(true);
      const status = await clusteringService.getStatus();
      if (status.clusters && status.clusters.length > 0) {
        // Use cached results
        Object.assign(clusteringStatus, status);
        clusteringEnabled.value = true;
        console.log('Using cached clustering results');
        setLoadingState(false);
      } else {
        // Start new clustering
        await clusteringService.startClustering({
          method: 'kmeans',
          n_clusters: 5
        });
        clusteringEnabled.value = true;
        console.log('Starting new clustering process');
        // Loading state will be cleared by status update handler
      }
    } catch (error) {
      console.error('Failed to start clustering:', error);
      clusteringEnabled.value = false;
      setLoadingState(false);
    }
  }
};

const clearAllFilters = () => {
  selectedTags.value.clear();
  selectedStatuses.value.clear();
  sizeRange.value = [0, 1000];
  showFilters.value = false;
};

// Helper function to ensure minimum loading time
const ensureMinimumLoadingTime = async () => {
  const elapsed = Date.now() - loadingStartTime.value;
  const remaining = MINIMUM_LOADING_TIME - elapsed;
  if (remaining > 0) {
    await new Promise(resolve => setTimeout(resolve, remaining));
  }
};

// Set loading state with timestamp
const setLoadingState = (loading: boolean) => {
  if (loading) {
    loadingStartTime.value = Date.now();
    isLoadingClusters.value = true;
  } else {
    // Don't clear immediately, ensure minimum time
    ensureMinimumLoadingTime().then(() => {
      isLoadingClusters.value = false;
    });
  }
};

const refreshClusteringStatus = async () => {
  try {
    const status = await clusteringService.getStatus();
    Object.assign(clusteringStatus, status);
    
    // If there are new clusters, enable clustering view
    if (status.clusters && status.clusters.length > 0) {
      clusteringEnabled.value = true;
      setLoadingState(false);
    }
  } catch (error) {
    console.error('Error refreshing clustering status:', error);
  }
};

const previewCluster = (cluster: any) => {
  // Clear any pending hide timeout
  const timeoutId = clusterHoverTimeouts.value.get(cluster.id);
  if (timeoutId) {
    clearTimeout(timeoutId);
    clusterHoverTimeouts.value.delete(cluster.id);
  }
  clusterHoverStates.value.set(cluster.id, true);
};

const hideClusterPreview = (cluster: any) => {
  // Add small delay to prevent flickering when moving between cards
  const timeoutId = setTimeout(() => {
    clusterHoverStates.value.set(cluster.id, false);
    clusterHoverTimeouts.value.delete(cluster.id);
  }, 150); // 150ms delay
  
  clusterHoverTimeouts.value.set(cluster.id, timeoutId);
};

const toggleCluster = (clusterId: string) => {
  console.log('Toggle cluster clicked:', clusterId);
  if (expandedClusters.value.has(clusterId)) {
    expandedClusters.value.delete(clusterId);
    console.log('Collapsed cluster:', clusterId);
  } else {
    expandedClusters.value.add(clusterId);
    console.log('Expanded cluster:', clusterId);
  }
  expandedClusters.value = new Set(expandedClusters.value);
};

const expandCluster = (clusterId: string) => {
  expandedClusters.value.add(clusterId);
  expandedClusters.value = new Set(expandedClusters.value);
};

const showClusterMenu = (cluster: any, event: MouseEvent) => {
  // Show context menu for cluster
  contextMenu.value = {
    visible: true,
    position: { x: event.clientX, y: event.clientY },
    target: cluster
  };
};

const openClusterModal = (cluster: any, event: MouseEvent) => {
  // Use currentTarget to ensure we get the element the event listener is on
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

  // The modal's final width (from your CSS class w-[600px])
  const modalFinalWidth = 600; 

  // --- Calculate initial transform values ---
  
  // 1. Center of the clicked folder (our starting point)
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  // 2. Center of the viewport (our ending point)
  const finalX = window.innerWidth / 2;
  const finalY = window.innerHeight / 2;
  
  // 3. The distance the modal needs to travel
  const translateX = startX - finalX;
  const translateY = startY - finalY;

  // 4. The initial scale to match the folder's width
  const scale = rect.width / modalFinalWidth;

  // 5. Set the CSS variables for the animation
  modalAnimStyle.value = {
    '--start-translate-x': `${translateX}px`,
    '--start-translate-y': `${translateY}px`,
    '--start-scale': scale,
  };
  
  openCluster.value = cluster;
};

const closeClusterModal = () => {
  if (isClosingCluster.value) return; // Prevent double-close
  
  isClosingCluster.value = true;
  
  // Wait for reverse animation to complete, then clean up
  setTimeout(() => {
    openCluster.value = null;
    isClosingCluster.value = false;
    modalAnimStyle.value = {};
  }, 300); // Match the animation duration
};

// Preview modal functions
const openPreviewModal = (workspace: any, event: MouseEvent) => {
  // Use currentTarget to ensure we get the element the event listener is on
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

  // The modal's final width (similar to cluster modal)
  const modalFinalWidth = 800; 

  // --- Calculate initial transform values ---
  
  // 1. Center of the clicked button (our starting point)
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  // 2. Center of the viewport (our ending point)
  const finalX = window.innerWidth / 2;
  const finalY = window.innerHeight / 2;
  
  // 3. The distance the modal needs to travel
  const translateX = startX - finalX;
  const translateY = startY - finalY;

  // 4. The initial scale to match the button's size
  const scale = rect.width / modalFinalWidth;

  // 5. Set the CSS variables for the animation
  previewModalAnimStyle.value = {
    '--start-translate-x': `${translateX}px`,
    '--start-translate-y': `${translateY}px`,
    '--start-scale': scale,
  };
  
  previewWorkspace.value = workspace;
};

const closePreviewModal = () => {
  if (isClosingPreview.value) return; // Prevent double-close
  
  isClosingPreview.value = true;
  
  // Wait for reverse animation to complete, then clean up
  setTimeout(() => {
    previewWorkspace.value = null;
    isClosingPreview.value = false;
    previewModalAnimStyle.value = {};
  }, 300); // Match the animation duration
};

const selectWorkspaceFromModal = (workspaceId: string) => {
  closeClusterModal();
  handleSelectWorkspace(workspaceId);
};

// Deconstruct/Reconstruct functions
const deconstructCluster = (cluster: any, event: MouseEvent) => {
  event.stopPropagation();
  
  // Add animation state
  deconstructAnimation.value.set(cluster.id, true);
  
  // Add to deconstructed set after brief delay for animation
  setTimeout(() => {
    deconstructedClusters.value.add(cluster.id);
    deconstructAnimation.value.delete(cluster.id);
  }, 300);
};

const reconstructCluster = (clusterId: string, event: MouseEvent) => {
  event.stopPropagation();
  
  // Remove from deconstructed set
  deconstructedClusters.value.delete(clusterId);
};

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric'
  });
};

// Drag and drop handlers
const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
  event.dataTransfer!.dropEffect = 'copy';
  isDragOver.value = true;
};

const handleDragEnter = (event: DragEvent) => {
  event.preventDefault();
  isDragOver.value = true;
};

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault();
  // Only set to false if we're leaving the container entirely
  if (!containerRef.value?.contains(event.relatedTarget as Node)) {
    isDragOver.value = false;
  }
};

const handleDrop = async (event: DragEvent) => {
  event.preventDefault();
  isDragOver.value = false;
  
  if (!event.dataTransfer?.files) return;
  
  const files = event.dataTransfer.files;
  const jsonFiles = Array.from(files).filter(file => 
    file.name.toLowerCase().endsWith('.json')
  );
  
  if (jsonFiles.length === 0) {
    console.warn('No JSON files found in dropped files');
    return;
  }
  
  try {
    isImporting.value = true;
    const results = await conversationImportService.handleDroppedFiles(files);
    
    // Log results
    results.forEach(result => {
      if (result.error) {
        console.error('Import error:', result.error);
      } else {
        console.log('Import started:', result);
      }
    });
    
  } catch (error) {
    console.error('Error handling dropped files:', error);
  } finally {
    // isImporting will be set to false when import status updates
  }
};

// Enhanced Vue Draggable Plus handlers
const onDragStart = (evt: any) => {
  isDragActive.value = true;
  draggingId.value = evt.item.dataset.id || evt.item.getAttribute('data-id');
  
  // Create enhanced drag overlay
  const workspaceId = draggingId.value;
  const workspace = workspaceItems.value.find(w => w.id === workspaceId);
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
  isDragActive.value = false;
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

// Removed getStackedCardStyle - now using pure CSS classes for smoother animations

const getWorkspaceType = (workspace: any) => {
  // Determine workspace type based on content
  if (workspace.tags?.some(t => t.name.toLowerCase().includes('ai'))) return 'ai';
  if (workspace.tags?.some(t => t.name.toLowerCase().includes('code'))) return 'code';
  if (workspace.nodeCount > 10) return 'large';
  return 'default';
};

const getWorkspaceIcon = (workspace: any) => {
  const type = getWorkspaceType(workspace);
  switch (type) {
    case 'ai': return Bot;
    case 'code': return Code;
    case 'large': return Database;
    default: return FileText;
  }
};

const getImportIcon = (format: string) => {
  switch (format) {
    case 'chatgpt': return Bot;
    case 'claude': return MessageSquare;
    default: return Download;
  }
};

const getImportLabel = (format: string) => {
  switch (format) {
    case 'chatgpt': return 'ChatGPT';
    case 'claude': return 'Claude';
    default: return 'Imported';
  }
};

const getActivityData = (workspace: any) => {
  // Calculate real activity data for the past 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    return {
      date: date.toISOString().split('T')[0],
      activity: 0
    };
  }).reverse(); // Oldest to newest
  
  // If we have detailed workspace data with nodes and messages
  if (workspace.nodes?.length) {
    // Count messages per day across all nodes
    workspace.nodes.forEach(node => {
      if (node.messages?.length) {
        node.messages.forEach(message => {
          if (message.timestamp) {
            const messageDate = new Date(message.timestamp).toISOString().split('T')[0];
            const dayIndex = last7Days.findIndex(day => day.date === messageDate);
            if (dayIndex !== -1) {
              last7Days[dayIndex].activity++;
            }
          }
        });
      }
    });
  } else {
    // Fallback: distribute activity based on updatedAt timestamp
    if (workspace.lastUpdated || workspace.updatedAt) {
      const updateDate = new Date(workspace.lastUpdated || workspace.updatedAt);
      const updateDateStr = updateDate.toISOString().split('T')[0];
      const dayIndex = last7Days.findIndex(day => day.date === updateDateStr);
      if (dayIndex !== -1) {
        last7Days[dayIndex].activity = workspace.nodeCount || 1;
      }
    }
  }
  
  // Normalize activity to 0-1 scale
  const maxActivity = Math.max(...last7Days.map(d => d.activity), 1);
  return last7Days.map(day => ({
    ...day,
    activity: maxActivity > 0 ? day.activity / maxActivity : 0
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

// Initialize
// ESC key handler for modals
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    // Check if other components want to handle ESC first
    if (contextMenu.value.visible) {
      return; // Let context menu handle it
    }
    
    // Handle preview modal
    if (previewWorkspace.value && !isClosingPreview.value) {
      event.preventDefault();
      event.stopPropagation();
      closePreviewModal();
      return;
    }
    
    // Handle cluster modal
    if (openCluster.value && !isClosingCluster.value) {
      event.preventDefault();
      event.stopPropagation();
      closeClusterModal();
      return;
    }
  }
};

// Watch for view mode changes to auto-enable clustering for graph mode
watch(currentViewMode, (newMode) => {
  if (newMode === 'graph' && !clusteringEnabled.value) {
    // Auto-enable clustering when switching to graph mode
    toggleClustering();
  }
});

// Reset pagination when sort or search changes
watch([sortBy, () => props.searchQuery], () => {
  resetPagination();
});

onMounted(async () => {
  // Start timing for minimum loading duration
  loadingStartTime.value = Date.now();
  
  localFavorites.value = new Set(
    (props.workspaces || []).filter(w => w.isFavorite).map(w => w.id)
  );
  
  // Add ESC key listener
  window.addEventListener('keydown', handleKeyDown);
  
  // Subscribe to clustering status updates
  statusUnsubscribe = clusteringService.onStatusUpdate((status) => {
    // Fix backend issue where processed_workspaces might be set incorrectly
    // The progress (0-1) should match processed_workspaces/total_workspaces ratio
    if (status.total_workspaces > 0 && status.progress >= 0 && status.progress <= 1) {
      // Calculate what processed_workspaces should be based on progress
      const expectedProcessed = Math.floor(status.progress * status.total_workspaces);
      
      // If the backend sent an incorrect processed count (like total-1 at the start),
      // use the calculated value instead
      if (status.progress < 0.95 && status.processed_workspaces > expectedProcessed + 10) {
        console.log(`Correcting processed_workspaces from ${status.processed_workspaces} to ${expectedProcessed} based on progress ${status.progress}`);
        status.processed_workspaces = expectedProcessed;
      }
    }
    
    Object.assign(clusteringStatus, status);
    
    // If clustering completed successfully and we have clusters, enable clustering view
    if (!status.is_running && status.clusters && status.clusters.length > 0) {
      clusteringEnabled.value = true;
      setLoadingState(false);
    }
  });
  
  // Subscribe to import status updates
  importStatusUnsubscribe = conversationImportService.onStatusUpdate((status) => {
    Object.assign(importStatus, status);
    
    // Update loading state based on import status
    if (status.is_running) {
      isImporting.value = true;
      
      // Auto-switch to graph view and enable clustering when incremental processing starts
      if (status.phase === 'embedding' || status.phase === 'clustering') {
        // Switch to graph view to show real-time clustering
        if (currentViewMode.value !== 'graph') {
          internalViewMode.value = 'graph';
        }
        
        clusteringEnabled.value = true;
        isLoadingClusters.value = true;
        
        // Refresh clustering status to get latest incremental results
        refreshClusteringStatus();
      }
    } else {
      isImporting.value = false;
      // Emit import completed event so parent can refresh workspace list
      if (status.imported_conversations > 0) {
        emit('import-completed', {
          imported: status.imported_conversations,
          skipped: status.skipped_conversations
        });
      }
    }
  });
  
  // Check initial clustering status
  try {
    const status = await clusteringService.getStatus();
    Object.assign(clusteringStatus, status);
    
    // If clustering is running, show loading state
    if (status.is_running) {
      isLoadingClusters.value = true;
    }
    
    // If there are existing clusters, enable clustering view
    if (!status.is_running && status.clusters && status.clusters.length > 0) {
      clusteringEnabled.value = true;
    }
  } catch (error) {
    console.error('Error getting initial clustering status:', error);
  } finally {
    // Ensure minimum loading time for initialization
    await ensureMinimumLoadingTime();
    isInitializing.value = false;
  }
});

onBeforeUnmount(() => {
  if (statusUnsubscribe) {
    statusUnsubscribe();
  }
  
  if (importStatusUnsubscribe) {
    importStatusUnsubscribe();
  }
  
  // Remove ESC key listener
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
/* Main Container - Theme Aware with Transparent Background */
.enhanced-grid-view {
  @apply h-full w-full flex flex-col;
  overflow: hidden;
  position: relative;
  /* Transparent background to show InfiniteCanvas background */
  background: transparent;
}

/* Controls Bar - Theme Aware */
.controls-bar {
  @apply sticky top-0 z-20 px-6 py-4;
  @apply backdrop-blur-xl flex items-center justify-between gap-6;
  background: oklch(from oklch(var(--b1)) l c h / 0.95);
  border-bottom: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  box-shadow: 0 4px 12px oklch(from oklch(var(--p)) l c h / 0.05);
}

.view-controls {
  @apply flex items-center gap-6;
}

.view-mode-selector {
  @apply flex rounded-xl p-1;
  background: oklch(from oklch(var(--b2)) l c h / 0.6);
}

.view-mode-btn {
  @apply flex items-center gap-2 px-3 py-2 rounded-lg;
  @apply text-sm font-medium transition-all duration-200;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.view-mode-btn:hover {
  color: oklch(var(--bc));
}

.view-mode-btn.active {
  background: oklch(var(--b1));
  color: oklch(var(--bc));
  box-shadow: 0 2px 4px oklch(from oklch(var(--p)) l c h / 0.1);
}

.filter-controls {
  @apply flex items-center gap-3;
}

.sort-select {
  @apply px-3 py-2 rounded-lg text-sm font-medium;
  background: oklch(var(--b1));
  color: oklch(var(--bc));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.2);
}

.sort-select:focus {
  outline: none;
  border-color: oklch(var(--p));
  box-shadow: 0 0 0 2px oklch(from oklch(var(--p)) l c h / 0.2);
}

.filter-btn, .cluster-btn {
  @apply flex items-center gap-2 px-3 py-2 rounded-lg;
  @apply text-sm font-medium transition-all duration-200 relative;
  background: oklch(var(--b1));
  color: oklch(var(--bc));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.2);
}

.filter-btn:hover, .cluster-btn:hover {
  background: oklch(from oklch(var(--b2)) l c h / 0.8);
  border-color: oklch(from oklch(var(--bc)) l c h / 0.3);
}

.filter-btn.active, .cluster-btn.active {
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border-color: oklch(var(--p));
}

.filter-count {
  @apply absolute -top-1 -right-1 w-5 h-5 rounded-full;
  @apply text-xs flex items-center justify-center font-bold;
  background: oklch(var(--wa));
  color: oklch(var(--wac));
}

/* Visualization Mode Selector */
.viz-mode-selector {
  @apply flex rounded-lg p-1 ml-3;
  background: oklch(from oklch(var(--b2)) l c h / 0.6);
}

.viz-mode-btn {
  @apply flex items-center gap-2 px-3 py-2 rounded-md;
  @apply text-sm font-medium transition-all duration-200;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.viz-mode-btn:hover {
  color: oklch(var(--bc));
}

.viz-mode-btn.active {
  background: oklch(var(--b1));
  color: oklch(var(--bc));
  box-shadow: 0 2px 4px oklch(from oklch(var(--p)) l c h / 0.1);
}

.graph-info {
  @apply flex items-center gap-2 px-3 py-2 rounded-md;
  @apply text-sm font-medium;
  background: oklch(from oklch(var(--a)) l c h / 0.15);
  color: oklch(var(--a));
  border: 1px solid oklch(from oklch(var(--a)) l c h / 0.3);
}

/* Content Container */
.content-container {
  @apply flex-1;
  overflow: visible;
  display: flex;
  flex-direction: column;
}

/* D3 Layout */
.d3-layout {
  @apply flex h-full;
}

.topics-sidebar {
  @apply w-80 flex-shrink-0;
}

.d3-main {
  @apply flex-1;
}

.d3-placeholder {
  @apply flex-1 flex items-center justify-center;
  background: oklch(from oklch(var(--b1)) l c h / 0.5);
  border: 2px dashed oklch(from oklch(var(--bc)) l c h / 0.3);
  border-radius: 12px;
  margin: 16px;
}

.placeholder-content {
  @apply text-center p-8;
}

.placeholder-content h3 {
  @apply text-xl font-semibold mb-2;
  color: oklch(var(--bc));
}

.placeholder-content p {
  @apply mb-4;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
}

.retry-btn {
  @apply px-4 py-2 rounded-lg font-medium transition-all duration-200;
  background: oklch(var(--p));
  color: oklch(var(--pc));
}

.retry-btn:hover {
  background: oklch(from oklch(var(--p)) calc(l - 0.1) c h);
}

/* Graph Loading State */
.graph-loading-container {
  @apply flex-1 flex items-center justify-center p-8;
}

.graph-loading-content {
  @apply text-center max-w-md;
}

.graph-loading-content h3 {
  @apply text-xl font-semibold mb-2;
  color: oklch(var(--bc));
}

.graph-loading-content p {
  @apply mb-4;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
}

.loading-progress {
  @apply w-full bg-base-300 rounded-full h-2 mt-4;
}

.progress-bar {
  @apply bg-primary h-2 rounded-full transition-all duration-300;
}

.grid-controls {
  @apply flex items-center gap-3;
}

.control-label {
  @apply text-sm font-medium;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.size-slider {
  @apply w-24;
  accent-color: oklch(var(--p));
}

/* Filters Panel - Theme Aware */
.filters-panel {
  @apply px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4;
  background: oklch(from oklch(var(--b2)) l c h / 0.5);
  border-bottom: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
}

.filter-section {
  @apply space-y-2;
}

.filter-label {
  @apply text-sm font-semibold;
  color: oklch(from oklch(var(--bc)) l c h / 0.8);
}

.tag-filters, .status-filters {
  @apply flex flex-wrap gap-2;
}

.tag-filter, .status-filter {
  @apply px-2 py-1 rounded-lg text-xs font-medium;
  @apply transition-all duration-200;
  background: oklch(var(--b1));
  color: oklch(var(--bc));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.2);
}

.tag-filter:hover, .status-filter:hover {
  background: oklch(from oklch(var(--b2)) l c h / 0.8);
}

.tag-filter.active {
  @apply text-white border-0;
  background-color: var(--tag-color);
}

.status-filter.active {
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border-color: oklch(var(--p));
}

.range-filter {
  @apply flex items-center gap-2;
}

.range-input {
  @apply w-20 px-2 py-1 rounded text-xs;
  background: oklch(var(--b1));
  color: oklch(var(--bc));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.2);
}

/* Grid */
.grid-wrapper {
  @apply flex-1 p-6;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.workspace-grid {
  @apply grid gap-6;
  margin-top: 40px; 
  grid-template-columns: repeat(auto-fill, minmax(var(--card-size), 1fr));
}

.workspace-grid.compact {
  @apply gap-3;
  margin-top: 40px; 
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.workspace-grid.detailed {
  @apply gap-8;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

/* Cluster Folder Cards - Theme Aware */
.cluster-folder {
  @apply flex flex-col items-center justify-center p-6 rounded-2xl;
  @apply cursor-pointer transition-all duration-300;
  min-height: var(--card-size);
  
  /* Dynamic background with theme colors */
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.08),
    oklch(from oklch(var(--s)) l c h / 0.06),
    oklch(from oklch(var(--a)) l c h / 0.04)
  );
  
  /* Themed border */
  border: 1px solid oklch(from oklch(var(--p)) l c h / 0.15);
  
  /* Subtle shadow with theme tint */
  box-shadow: 0 4px 12px oklch(from oklch(var(--p)) l c h / 0.08);
}

.cluster-folder:hover {
  /* Enhanced hover with theme colors */
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.12),
    oklch(from oklch(var(--s)) l c h / 0.10),
    oklch(from oklch(var(--a)) l c h / 0.08)
  );
  
  border-color: oklch(from oklch(var(--p)) l c h / 0.3);
  box-shadow: 
    0 8px 24px oklch(from oklch(var(--p)) l c h / 0.15),
    0 0 0 1px oklch(from oklch(var(--p)) l c h / 0.1);
  
  transform: translateY(-2px) scale(1.02);
}

.folder-icon {
  /* Gradient icon with theme colors */
  background: linear-gradient(135deg, 
    oklch(var(--p)), 
    oklch(var(--s))
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 12px;
  filter: drop-shadow(0 2px 4px oklch(from oklch(var(--p)) l c h / 0.2));
}

.folder-info {
  @apply text-center;
}

.folder-title {
  @apply font-semibold mb-1;
  color: oklch(var(--bc));
  text-shadow: 0 1px 2px oklch(from oklch(var(--p)) l c h / 0.1);
}

.folder-count {
  @apply text-sm;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
  
  /* Subtle accent background */
  background: oklch(from oklch(var(--a)) l c h / 0.1);
  @apply px-2 py-1 rounded-full;
  border: 1px solid oklch(from oklch(var(--a)) l c h / 0.15);
}

.cluster-folder.hidden-for-modal {
  @apply opacity-0 pointer-events-none;
  transform: scale(0.95);
}

.cluster-folder.deconstructing {
  animation: clusterExplode 0.3s ease-out forwards;
}

.cluster-actions {
  @apply absolute top-2 right-2 opacity-0 transition-opacity duration-200;
}

.cluster-folder:hover .cluster-actions {
  @apply opacity-100;
}

.cluster-action-btn {
  @apply w-6 h-6 rounded-lg flex items-center justify-center;
  @apply transition-colors duration-200;
  background: oklch(from oklch(var(--b1)) l c h / 0.9);
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  backdrop-filter: blur(4px);
}

.cluster-action-btn:hover {
  background: oklch(from oklch(var(--er)) l c h / 0.1);
  color: oklch(var(--er));
  border-color: oklch(from oklch(var(--er)) l c h / 0.3);
}

.cluster-folder {
  position: relative;
}

@keyframes clusterExplode {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(0.8);
    opacity: 0;
  }
}

/* iOS Folder Modal */
.folder-modal-overlay {
  @apply fixed inset-0 bg-black/50 backdrop-blur-sm z-50;
  @apply flex items-center justify-center;
  animation: fadeIn 0.3s ease-out;
}

.folder-modal {
  @apply rounded-2xl w-[600px] max-w-[90vw] max-h-[80vh] overflow-hidden;
  background: oklch(var(--b1));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  box-shadow: 0 25px 50px oklch(from oklch(var(--p)) l c h / 0.25);
  
  /* Use the new animation. The cubic-bezier gives it a nice "overshoot" bounce effect. */
  animation: modalExpandFromOrigin 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.folder-modal.closing {
  /* Reverse animation back to origin */
  animation: modalCollapseToOrigin 0.3s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
}

.modal-header {
  @apply flex items-center justify-between p-6;
  border-bottom: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
}

.modal-header h2 {
  @apply text-xl font-bold;
  color: oklch(var(--bc));
}

.close-btn {
  @apply p-2 rounded-lg transition-colors;
  color: oklch(var(--bc));
}

.close-btn:hover {
  background: oklch(from oklch(var(--b2)) l c h / 0.6);
}

.modal-workspace-grid {
  @apply grid grid-cols-2 gap-4 p-6 max-h-[60vh] overflow-y-auto;
}

.modal-workspace-card {
  @apply rounded-lg p-4 cursor-pointer transition-all duration-200;
  background: oklch(from oklch(var(--b2)) l c h / 0.5);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
}

.modal-workspace-card:hover {
  background: oklch(from oklch(var(--p)) l c h / 0.05);
  border-color: oklch(from oklch(var(--p)) l c h / 0.3);
  box-shadow: 0 4px 12px oklch(from oklch(var(--p)) l c h / 0.1);
}

.workspace-content h3 {
  @apply font-semibold mb-2 line-clamp-2;
  color: oklch(var(--bc));
}

.workspace-content p {
  @apply text-sm mb-1;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.workspace-date {
  @apply text-xs;
  color: oklch(from oklch(var(--bc)) l c h / 0.4);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modalExpandFromOrigin {
  from {
    /* 
      Start the transform from the calculated position and scale.
      No opacity fade - just pure transform animation.
    */
    transform: translate(var(--start-translate-x, 0), var(--start-translate-y, 0)) scale(var(--start-scale, 0.1));
  }
  to {
    /* 
      Animate to the final state: no translation relative to the center, and full scale.
    */
    transform: translate(0, 0) scale(1);
  }
}

@keyframes modalCollapseToOrigin {
  from {
    /* Start from the expanded state */
    transform: translate(0, 0) scale(1);
  }
  to {
    /* Animate back to the original folder position and size */
    transform: translate(var(--start-translate-x, 0), var(--start-translate-y, 0)) scale(var(--start-scale, 0.1));
  }
}

/* Preview Modal Styles */
.preview-modal-overlay {
  @apply fixed inset-0 bg-black/50 backdrop-blur-sm z-50;
  @apply flex items-center justify-center;
  animation: fadeIn 0.3s ease-out;
}

.preview-modal {
  @apply rounded-2xl w-[800px] max-w-[95vw] max-h-[90vh] overflow-hidden;
  background: oklch(var(--b1));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  box-shadow: 0 25px 50px oklch(from oklch(var(--p)) l c h / 0.25);
  
  /* Use the same animation as folder modal */
  animation: modalExpandFromOrigin 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.preview-modal.closing {
  /* Reverse animation back to origin */
  animation: modalCollapseToOrigin 0.3s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
}

.preview-content {
  @apply flex gap-6 p-6 overflow-hidden;
  max-height: calc(90vh - 140px); /* Account for header and footer */
}

.preview-details {
  @apply flex-1 space-y-6 overflow-y-auto;
  max-width: 300px;
}

.detail-section {
  @apply space-y-3;
}

.detail-section h3 {
  @apply text-sm font-semibold uppercase tracking-wide;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
}

.detail-grid {
  @apply space-y-2;
}

.detail-item {
  @apply flex items-center gap-2 text-sm;
  color: oklch(var(--bc));
}

.detail-item svg {
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.detail-section p {
  @apply text-sm leading-relaxed;
  color: oklch(from oklch(var(--bc)) l c h / 0.8);
}

.preview-tags {
  @apply flex flex-wrap gap-2;
}

.preview-tag {
  @apply px-2 py-1 rounded-full text-xs font-medium text-white;
}

.preview-canvas {
  @apply flex-1 rounded-lg overflow-hidden;
  background: oklch(from oklch(var(--b2)) l c h / 0.5);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  min-height: 300px;
}

.modal-footer {
  @apply flex items-center justify-end gap-3 p-6;
  border-top: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
}

.modal-footer .btn {
  @apply px-4 py-2 rounded-lg font-medium transition-colors;
}

.modal-footer .btn-ghost {
  @apply text-gray-600 hover:bg-gray-100;
}

.modal-footer .btn-primary {
  @apply bg-blue-500 text-white hover:bg-blue-600;
}

.mini-title {
  @apply text-xs font-semibold truncate;
  color: oklch(var(--bc));
}

.mini-stats {
  @apply text-xs;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.cluster-info {
  @apply space-y-2;
}

.cluster-title {
  @apply flex items-center gap-2 text-lg font-bold;
  color: oklch(var(--wa));
}

.cluster-subtitle {
  @apply text-sm;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.cluster-tags {
  @apply flex flex-wrap gap-1;
}

.cluster-tag {
  @apply px-2 py-0.5 rounded-full text-xs font-medium;
  color: oklch(var(--pc));
}

.cluster-actions {
  @apply absolute top-4 right-4 flex gap-2 opacity-0 transition-opacity duration-200;
}

.cluster-card:hover .cluster-actions {
  @apply opacity-100;
}

/* Enhanced Workspace Cards - Theme Aware */
.workspace-card {
  @apply relative cursor-pointer rounded-2xl overflow-hidden;
  @apply transition-all duration-300 ease-out;
  @apply hover:-translate-y-2;
  min-height: var(--card-size);
  
  /* Theme-aware background and border */
  background: linear-gradient(135deg, 
    oklch(var(--b1)),
    oklch(from oklch(var(--b2)) l c h / 0.3)
  );
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  
  /* Theme-aware shadow */
  box-shadow: 0 4px 12px oklch(from oklch(var(--p)) l c h / 0.08);
}

.workspace-card:hover {
  /* Enhanced hover with theme colors */
  border-color: oklch(from oklch(var(--p)) l c h / 0.3);
  box-shadow: 
    0 12px 32px oklch(from oklch(var(--p)) l c h / 0.15),
    0 0 0 1px oklch(from oklch(var(--p)) l c h / 0.1);
}

.workspace-card.enhanced {
  background: linear-gradient(135deg, 
    oklch(var(--b1)),
    oklch(from oklch(var(--b2)) l c h / 0.4),
    oklch(from oklch(var(--p)) l c h / 0.02)
  );
}

.workspace-card.compact {
  min-height: 120px;
}

.workspace-card.detailed {
  min-height: 280px;
}

.workspace-card.selected {
  @apply -translate-y-1;
  box-shadow: 
    0 0 0 2px oklch(var(--p)),
    0 0 0 4px oklch(var(--b1)),
    0 16px 40px oklch(from oklch(var(--p)) l c h / 0.2);
}

.workspace-card.favorite {
  border-color: oklch(from oklch(var(--wa)) l c h / 0.4);
  background: linear-gradient(135deg, 
    oklch(var(--b1)),
    oklch(from oklch(var(--wa)) l c h / 0.05)
  );
}

.card-glow {
  @apply absolute -inset-1 rounded-2xl opacity-0 transition-opacity duration-300;
  @apply blur-sm;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.2),
    oklch(from oklch(var(--s)) l c h / 0.2),
    oklch(from oklch(var(--a)) l c h / 0.2)
  );
}

.workspace-card:hover .card-glow {
  @apply opacity-100;
}

.card-pattern {
  @apply absolute inset-0 opacity-5;
  background-image: radial-gradient(circle at 1px 1px, rgba(0,0,0,0.15) 1px, transparent 0);
  background-size: 20px 20px;
}

.card-content {
  @apply relative h-full p-4 flex flex-col;
}

.card-header {
  @apply flex items-start justify-between gap-3 mb-3;
}

.workspace-meta {
  @apply flex items-start gap-3 flex-1 min-w-0;
}

.type-indicator {
  @apply w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0;
  background: oklch(from oklch(var(--b2)) l c h / 0.6);
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
}

.type-indicator.ai {
  background: oklch(from oklch(var(--p)) l c h / 0.15);
  color: oklch(var(--p));
}

.type-indicator.code {
  background: oklch(from oklch(var(--in)) l c h / 0.15);
  color: oklch(var(--in));
}

.type-indicator.large {
  background: oklch(from oklch(var(--su)) l c h / 0.15);
  color: oklch(var(--su));
}

.title-section {
  @apply flex-1 min-w-0;
}

.workspace-title {
  @apply text-base font-semibold truncate mb-1;
  color: oklch(var(--bc));
}

.workspace-subtitle {
  @apply text-xs line-clamp-2 leading-relaxed;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.card-actions {
  @apply flex gap-2 opacity-0 transition-opacity duration-200;
}

.workspace-card:hover .card-actions {
  @apply opacity-100;
}

.action-btn {
  @apply w-7 h-7 rounded-lg flex items-center justify-center;
  @apply transition-colors duration-200;
  background: oklch(from oklch(var(--b2)) l c h / 0.5);
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.action-btn:hover {
  background: oklch(from oklch(var(--b3)) l c h / 0.8);
  color: oklch(var(--bc));
}

.action-btn.favorite-btn.favorited {
  background: oklch(from oklch(var(--wa)) l c h / 0.2);
  color: oklch(var(--wa));
}

.action-btn.favorite-btn.favorited:hover {
  background: oklch(from oklch(var(--wa)) l c h / 0.3);
}

.action-btn.preview-btn:hover {
  background: oklch(from oklch(var(--in)) l c h / 0.2);
  color: oklch(var(--in));
}

.action-btn.reconstruct-btn:hover {
  background: oklch(from oklch(var(--su)) l c h / 0.2);
  color: oklch(var(--su));
}

.stats-section {
  @apply space-y-3 mb-3;
}

.primary-stats {
  @apply flex justify-between items-center;
}

.stat-item {
  @apply flex items-center gap-1 text-xs;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
}

.activity-graph {
  @apply flex items-end gap-1 h-8;
}

.activity-bar {
  @apply w-2 rounded-t transition-all duration-300;
  background: oklch(from oklch(var(--p)) l c h / 0.3);
}

.tags-section {
  @apply mt-auto;
}

.tags-list {
  @apply flex flex-wrap gap-1;
}

.tag {
  @apply px-2 py-0.5 rounded-full text-xs font-medium shadow-sm opacity-90;
  color: oklch(from oklch(var(--pc)) l c h / 0.9);
}

.tag-overflow {
  @apply px-2 py-0.5 rounded-full text-xs font-medium;
  background: oklch(from oklch(var(--b2)) l c h / 0.8);
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.quick-actions {
  @apply flex gap-2 mt-3 pt-3 border-t border-base-300/50;
}

.quick-btn {
  @apply flex items-center gap-1 px-2 py-1 rounded text-xs;
  @apply transition-colors duration-200;
  background: oklch(from oklch(var(--b2)) l c h / 0.8);
  color: oklch(var(--bc));
}

.quick-btn:hover {
  background: oklch(from oklch(var(--b3)) l c h / 0.9);
}

.quick-btn.primary {
  background: oklch(var(--p));
  color: oklch(var(--pc));
}

.quick-btn.primary:hover {
  background: oklch(from oklch(var(--p)) l c h / 0.9);
}

.status-indicator {
  @apply absolute top-3 left-3 w-2 h-2 rounded-full;
}

.status-indicator.active {
  background: oklch(var(--su));
}

.status-indicator.archived {
  background: oklch(var(--wa));
}

.progress-bar {
  @apply absolute bottom-0 left-0 right-0 h-1;
  background: oklch(from oklch(var(--b3)) l c h / 0.5);
}

.progress-fill {
  @apply h-full transition-all duration-300;
  background: oklch(var(--p));
}

/* Empty State */
.empty-state {
  @apply flex flex-col items-center justify-center h-64;
  @apply text-center space-y-4;
}

.empty-icon {
  color: oklch(from oklch(var(--bc)) l c h / 0.3);
}

.empty-title {
  @apply text-lg font-semibold;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.empty-subtitle {
  @apply text-sm;
  color: oklch(from oklch(var(--bc)) l c h / 0.5);
}

.clear-filters-btn {
  @apply px-4 py-2 rounded-lg transition-colors duration-200;
  background: oklch(var(--p));
  color: oklch(var(--pc));
}

.clear-filters-btn:hover {
  background: oklch(from oklch(var(--p)) l c h / 0.9);
}

/* Context Menu */
.context-overlay {
  @apply fixed inset-0 z-40;
}

.context-menu {
  @apply fixed z-50 min-w-48 py-2 backdrop-blur-xl rounded-xl;
  background: oklch(from oklch(var(--b1)) l c h / 0.95);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  box-shadow: 0 20px 40px oklch(from oklch(var(--p)) l c h / 0.15);
}

.context-item {
  @apply w-full flex items-center gap-3 px-4 py-2.5;
  @apply text-sm transition-colors duration-150;
  color: oklch(var(--bc));
}

.context-item:hover {
  background: oklch(from oklch(var(--b2)) l c h / 0.6);
}

.context-item.primary {
  color: oklch(var(--p));
}

.context-item.primary:hover {
  background: oklch(from oklch(var(--p)) l c h / 0.1);
}

.context-item.danger {
  color: oklch(var(--er));
}

.context-item.danger:hover {
  background: oklch(from oklch(var(--er)) l c h / 0.1);
}

.context-divider {
  @apply h-px my-1 mx-2;
  background: oklch(from oklch(var(--bc)) l c h / 0.1);
}

/* Enhanced Modern Card Animations - @dnd-kit Style */
.modern-grid {
  animation: gridFadeIn 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards;
}

.workspace-card {
  @apply transition-all duration-500 ease-out;
  animation: cardSlideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: calc(var(--card-index, 0) * 0.05s);
  opacity: 0;
  transform: translateY(30px) scale(0.95);
}

.workspace-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 
    0 20px 40px oklch(from oklch(var(--b3)) l c h / 0.3),
    0 0 0 1px oklch(from oklch(var(--p)) l c h / 0.1);
  border-color: oklch(from oklch(var(--p)) l c h / 0.2);
}

/* Drag and Drop States */
.workspace-card-ghost {
  opacity: 0.3;
  background: oklch(from oklch(var(--p)) l c h / 0.1) !important;
  border: 2px dashed oklch(var(--p)) !important;
  transform: scale(0.95);
}

.workspace-card-chosen {
  transform: scale(1.05) rotate(2deg);
  box-shadow: 0 15px 35px oklch(from oklch(var(--p)) l c h / 0.3);
  z-index: 1000;
}

.workspace-card-drag {
  opacity: 0.8;
  transform: rotate(5deg) scale(1.1);
  box-shadow: 0 25px 50px oklch(from oklch(var(--p)) l c h / 0.4);
}

.workspace-card-fallback {
  @apply rounded-2xl;
  background: oklch(from oklch(var(--p)) l c h / 0.2) !important;
  border: 2px dashed oklch(var(--p)) !important;
  backdrop-filter: blur(16px);
}

/* Enhanced Container States */
.modern-drag-container {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modern-drag-container.drag-over {
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.05) 0%, 
    oklch(from oklch(var(--s)) l c h / 0.03) 100%);
  transform: scale(1.01);
}

.modern-drag-container.drag-active {
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.08) 0%, 
    oklch(from oklch(var(--s)) l c h / 0.05) 100%);
}

.card-move {
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Grid container entrance animation */
.grid-wrapper {
  animation: gridFadeIn 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards;
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

@keyframes cardSlideIn {
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes cardFloat {
  0%, 100% { transform: translateY(0) rotateX(0deg); }
  50% { transform: translateY(-5px) rotateX(2deg); }
}

@keyframes dragPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* Enhanced hover effects during transitions */
.workspace-card:hover,
.cluster-folder:hover {
  transform: translateY(-4px) scale(1.02);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* UI Element Entrance Animations */
.animate-slide-down {
  animation: slideDown 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards;
}

.animate-fade-in {
  animation: fadeInUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards;
  animation-delay: var(--animation-delay, 0s);
  opacity: 0;
}

.animate-scale-in {
  animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: var(--animation-delay, 0s);
  opacity: 0;
  transform: scale(0.8);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(15px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.slide-down-enter-active,
.slide-down-leave-active {
  @apply transition-all duration-300 ease-out;
}

.slide-down-enter-from,
.slide-down-leave-to {
  @apply opacity-0 -translate-y-4;
}

.context-enter-active,
.context-leave-active {
  @apply transition-all duration-200 ease-out;
}

.context-enter-from,
.context-leave-to {
  @apply opacity-0 scale-95;
}

/* Responsive */
@media (max-width: 768px) {
  .controls-bar {
    @apply flex-col items-stretch gap-4;
  }
  
  .view-controls {
    @apply flex-wrap gap-3;
  }
  
  .grid-wrapper {
    @apply p-4;
  }
  
  .workspace-grid {
    grid-template-columns: 1fr;
    @apply gap-4;
  }
  
  .filters-panel {
    @apply grid-cols-1;
  }
}

/* Enhanced theme-aware styling for better contrast across all 29 themes */
.enhanced-grid-view {
  /* Additional theme-aware enhancements */
  backdrop-filter: blur(8px);
}

/* Import Source Badge */
.import-badge {
  @apply absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium;
  @apply backdrop-blur-sm transition-all duration-200;
  background: oklch(from oklch(var(--b1)) l c h / 0.9);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  box-shadow: 0 2px 8px oklch(from oklch(var(--bc)) l c h / 0.1);
}

.import-badge.chatgpt {
  background: oklch(from oklch(var(--in)) l c h / 0.1);
  border-color: oklch(from oklch(var(--in)) l c h / 0.3);
  color: oklch(var(--in));
}

.import-badge.claude {
  background: oklch(from oklch(var(--wa)) l c h / 0.1);
  border-color: oklch(from oklch(var(--wa)) l c h / 0.3);
  color: oklch(var(--wa));
}

.import-text {
  @apply hidden;
}

/* Show import text in detailed view */
.workspace-card.detailed .import-text {
  @apply inline;
}

/* Imported Workspace Card Styling */
.workspace-card.imported {
  position: relative;
}

.workspace-card.imported::before {
  content: '';
  @apply absolute inset-0 rounded-2xl pointer-events-none;
  background: linear-gradient(135deg, transparent 0%, transparent 80%, oklch(from oklch(var(--p)) l c h / 0.05) 100%);
}

.workspace-card.chatgpt-import {
  border-color: oklch(from oklch(var(--in)) l c h / 0.2);
}

.workspace-card.chatgpt-import::before {
  background: linear-gradient(135deg, 
    transparent 0%, 
    transparent 80%, 
    oklch(from oklch(var(--in)) l c h / 0.08) 100%
  );
}

.workspace-card.chatgpt-import:hover {
  border-color: oklch(from oklch(var(--in)) l c h / 0.4);
  box-shadow: 
    0 12px 32px oklch(from oklch(var(--in)) l c h / 0.15),
    0 0 0 1px oklch(from oklch(var(--in)) l c h / 0.1);
}

.workspace-card.claude-import {
  border-color: oklch(from oklch(var(--wa)) l c h / 0.2);
}

.workspace-card.claude-import::before {
  background: linear-gradient(135deg, 
    transparent 0%, 
    transparent 80%, 
    oklch(from oklch(var(--wa)) l c h / 0.08) 100%
  );
}

.workspace-card.claude-import:hover {
  border-color: oklch(from oklch(var(--wa)) l c h / 0.4);
  box-shadow: 
    0 12px 32px oklch(from oklch(var(--wa)) l c h / 0.15),
    0 0 0 1px oklch(from oklch(var(--wa)) l c h / 0.1);
}

.workspace-card.deconstructed {
  border-left: 3px solid oklch(var(--su));
  background: oklch(from oklch(var(--su)) l c h / 0.02);
}

.workspace-card.deconstructed::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(45deg, transparent 48%, oklch(from oklch(var(--su)) l c h / 0.05) 50%, transparent 52%);
  pointer-events: none;
  z-index: 1;
}

.workspace-card.deconstructed:hover {
  background: oklch(from oklch(var(--su)) l c h / 0.05);
  border-color: oklch(from oklch(var(--su)) l c h / 0.3);
  box-shadow: 
    0 8px 32px oklch(from oklch(var(--su)) l c h / 0.15),
    0 0 0 1px oklch(from oklch(var(--su)) l c h / 0.1);
}

/* Quick action borders */
.quick-actions {
  @apply flex gap-2 mt-3 pt-3;
  border-top: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
}

/* Enhanced scrollbar theming */
.modal-workspace-grid::-webkit-scrollbar {
  width: 6px;
}

.modal-workspace-grid::-webkit-scrollbar-track {
  background: oklch(from oklch(var(--b2)) l c h / 0.3);
}

.modal-workspace-grid::-webkit-scrollbar-thumb {
  background: oklch(from oklch(var(--p)) l c h / 0.3);
  border-radius: 3px;
}

.modal-workspace-grid::-webkit-scrollbar-thumb:hover {
  background: oklch(from oklch(var(--p)) l c h / 0.5);
}

/* Lottie Loading Animation */
.loading-container {
  @apply h-full w-full flex items-center justify-center;
  background: oklch(from oklch(var(--b1)) l c h / 0.95);
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}

.loading-content {
  @apply flex flex-col items-center gap-8;
  z-index: 2;
}

/* Lottie Loader Styling - Theme Adaptive */
.lottie-loader {
  filter: 
    drop-shadow(0 0 20px oklch(from oklch(var(--p)) l c h / 0.3))
    hue-rotate(var(--lottie-hue, 0deg))
    saturate(var(--lottie-saturation, 1))
    brightness(var(--lottie-brightness, 1));
  animation: lottieGlow 3s ease-in-out infinite alternate;
}

@keyframes lottieGlow {
  0% {
    filter: 
      drop-shadow(0 0 20px oklch(from oklch(var(--p)) l c h / 0.3))
      hue-rotate(var(--lottie-hue, 0deg))
      saturate(var(--lottie-saturation, 1))
      brightness(var(--lottie-brightness, 1));
  }
  100% {
    filter: 
      drop-shadow(0 0 30px oklch(from oklch(var(--p)) l c h / 0.5))
      hue-rotate(var(--lottie-hue, 0deg))
      saturate(var(--lottie-saturation, 1))
      brightness(var(--lottie-brightness, 1));
  }
}

/* Theme-specific color adjustments */
[data-theme="light"] .lottie-loader {
  --lottie-hue: 0deg;
  --lottie-saturation: 1.2;
  --lottie-brightness: 0.9;
}

[data-theme="dark"] .lottie-loader {
  --lottie-hue: 0deg;
  --lottie-saturation: 1.1;
  --lottie-brightness: 1.1;
}

[data-theme="cyberpunk"] .lottie-loader {
  --lottie-hue: 180deg;
  --lottie-saturation: 1.5;
  --lottie-brightness: 1.2;
}

[data-theme="synthwave"] .lottie-loader {
  --lottie-hue: 300deg;
  --lottie-saturation: 1.4;
  --lottie-brightness: 1.1;
}

[data-theme="aqua"] .lottie-loader {
  --lottie-hue: 180deg;
  --lottie-saturation: 1.3;
  --lottie-brightness: 1.0;
}

[data-theme="forest"] .lottie-loader {
  --lottie-hue: 120deg;
  --lottie-saturation: 1.2;
  --lottie-brightness: 0.9;
}

[data-theme="sunset"] .lottie-loader {
  --lottie-hue: 30deg;
  --lottie-saturation: 1.3;
  --lottie-brightness: 1.0;
}

[data-theme="corporate"] .lottie-loader {
  --lottie-hue: 210deg;
  --lottie-saturation: 1.1;
  --lottie-brightness: 0.95;
}

[data-theme="valentine"] .lottie-loader {
  --lottie-hue: 350deg;
  --lottie-saturation: 1.4;
  --lottie-brightness: 1.0;
}

[data-theme="halloween"] .lottie-loader {
  --lottie-hue: 30deg;
  --lottie-saturation: 1.6;
  --lottie-brightness: 1.1;
}

[data-theme="garden"] .lottie-loader {
  --lottie-hue: 150deg;
  --lottie-saturation: 1.3;
  --lottie-brightness: 0.9;
}

[data-theme="lofi"] .lottie-loader {
  --lottie-hue: 0deg;
  --lottie-saturation: 0.8;
  --lottie-brightness: 0.9;
}

[data-theme="pastel"] .lottie-loader {
  --lottie-hue: 0deg;
  --lottie-saturation: 0.7;
  --lottie-brightness: 1.1;
}

[data-theme="fantasy"] .lottie-loader {
  --lottie-hue: 270deg;
  --lottie-saturation: 1.5;
  --lottie-brightness: 1.2;
}

[data-theme="wireframe"] .lottie-loader {
  --lottie-hue: 0deg;
  --lottie-saturation: 0.1;
  --lottie-brightness: 0.8;
}

[data-theme="black"] .lottie-loader {
  --lottie-hue: 0deg;
  --lottie-saturation: 1.0;
  --lottie-brightness: 1.3;
}

[data-theme="luxury"] .lottie-loader {
  --lottie-hue: 45deg;
  --lottie-saturation: 1.4;
  --lottie-brightness: 1.1;
}

[data-theme="dracula"] .lottie-loader {
  --lottie-hue: 270deg;
  --lottie-saturation: 1.3;
  --lottie-brightness: 1.2;
}

[data-theme="cmyk"] .lottie-loader {
  --lottie-hue: 180deg;
  --lottie-saturation: 1.5;
  --lottie-brightness: 1.0;
}

[data-theme="autumn"] .lottie-loader {
  --lottie-hue: 20deg;
  --lottie-saturation: 1.4;
  --lottie-brightness: 0.95;
}

[data-theme="business"] .lottie-loader {
  --lottie-hue: 200deg;
  --lottie-saturation: 1.0;
  --lottie-brightness: 0.9;
}

[data-theme="acid"] .lottie-loader {
  --lottie-hue: 60deg;
  --lottie-saturation: 1.8;
  --lottie-brightness: 1.3;
}

[data-theme="lemonade"] .lottie-loader {
  --lottie-hue: 50deg;
  --lottie-saturation: 1.3;
  --lottie-brightness: 1.0;
}

[data-theme="night"] .lottie-loader {
  --lottie-hue: 240deg;
  --lottie-saturation: 1.2;
  --lottie-brightness: 1.1;
}

[data-theme="coffee"] .lottie-loader {
  --lottie-hue: 25deg;
  --lottie-saturation: 1.2;
  --lottie-brightness: 0.9;
}

[data-theme="winter"] .lottie-loader {
  --lottie-hue: 200deg;
  --lottie-saturation: 1.1;
  --lottie-brightness: 1.0;
}

[data-theme="dim"] .lottie-loader {
  --lottie-hue: 0deg;
  --lottie-saturation: 0.9;
  --lottie-brightness: 0.8;
}

[data-theme="nord"] .lottie-loader {
  --lottie-hue: 210deg;
  --lottie-saturation: 1.1;
  --lottie-brightness: 0.9;
}

/* Loading Text */
.loading-text {
  @apply text-center max-w-md;
}

.loading-text h3 {
  @apply text-xl font-semibold mb-2;
  color: oklch(var(--bc));
  animation: textGlow 3s ease-in-out infinite alternate;
}

.loading-text p {
  @apply text-base opacity-70;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
}

@keyframes textGlow {
  0% {
    text-shadow: 0 0 10px oklch(from oklch(var(--p)) l c h / 0.3);
  }
  100% {
    text-shadow: 0 0 20px oklch(from oklch(var(--p)) l c h / 0.5);
  }
}

/* Progress Bar */
.progress-container {
  @apply mt-4 w-full;
}

.progress-bar {
  @apply w-full h-2 rounded-full overflow-hidden;
  background: oklch(from oklch(var(--bc)) l c h / 0.1);
}

.progress-fill {
  @apply h-full rounded-full transition-all duration-300 ease-out;
  background: linear-gradient(
    90deg,
    oklch(var(--p)),
    oklch(var(--s)),
    oklch(var(--a))
  );
  background-size: 200% 100%;
  animation: progressShine 2s ease-in-out infinite;
}

@keyframes progressShine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.progress-text {
  @apply text-sm mt-2 font-medium;
  color: oklch(from oklch(var(--bc)) l c h / 0.8);
}

.workspace-counter {
  @apply text-xs mt-1 opacity-70;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

/* Theme-specific enhancements */
[data-theme="cyberpunk"] .neural-core,
[data-theme="cyberpunk"] .neural-node {
  box-shadow: 
    0 0 20px #00FFFF,
    0 0 40px #00FFFF50;
}

[data-theme="synthwave"] .neural-core,
[data-theme="synthwave"] .neural-node {
  box-shadow: 
    0 0 20px #FF00FF,
    0 0 40px #FF00FF50;
}

[data-theme="aqua"] .neural-loader {
  filter: drop-shadow(0 0 10px #00CED1);
}

/* Drag and Drop Styles */
.enhanced-grid-view.drag-over {
  background: oklch(from oklch(var(--p)) l c h / 0.05);
  border: 2px dashed oklch(var(--p));
  border-radius: 12px;
}

.drag-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center;
  background: oklch(from oklch(var(--b1)) l c h / 0.95);
  backdrop-filter: blur(10px);
}

.drag-content {
  @apply text-center;
}

.drag-icon {
  @apply mb-4 text-center;
  color: oklch(var(--p));
  animation: dragPulse 2s ease-in-out infinite;
}

@keyframes dragPulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
}

.drag-content h3 {
  @apply text-xl font-semibold mb-2;
  color: oklch(var(--bc));
}

.drag-content p {
  @apply text-base opacity-70;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
}

/* Import Progress Footer */
.import-progress-footer {
  @apply fixed bottom-0 left-0 right-0 z-40;
  background: oklch(from oklch(var(--b1)) l c h / 0.95);
  backdrop-filter: blur(12px);
  border-top: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  box-shadow: 0 -4px 20px oklch(from oklch(var(--p)) l c h / 0.1);
}

.import-progress-content {
  @apply max-w-7xl mx-auto px-6 py-4;
}

.import-info {
  @apply flex items-center gap-4;
}

.import-status {
  @apply flex items-center gap-3 flex-1;
}

.import-icon {
  @apply flex items-center justify-center w-8 h-8 rounded-lg;
  background: oklch(from oklch(var(--p)) l c h / 0.15);
  color: oklch(var(--p));
  animation: importSpin 2s linear infinite;
}

@keyframes importSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.import-text {
  @apply flex flex-col gap-1;
}

.import-title {
  @apply font-semibold text-sm;
  color: oklch(var(--bc));
}

.import-subtitle {
  @apply text-xs opacity-70;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
}

.import-progress-bar {
  @apply flex-1 max-w-xs h-2 rounded-full overflow-hidden;
  background: oklch(from oklch(var(--bc)) l c h / 0.1);
}

.import-progress-fill {
  @apply h-full transition-all duration-300 ease-out;
  background: linear-gradient(
    90deg,
    oklch(var(--p)),
    oklch(var(--s)),
    oklch(var(--a))
  );
  background-size: 200% 100%;
  animation: importProgressShine 2s ease-in-out infinite;
}

@keyframes importProgressShine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.import-stats {
  @apply flex gap-3 text-sm font-medium;
  color: oklch(from oklch(var(--bc)) l c h / 0.8);
}

/* Transition Animations */
.drag-overlay-enter-active,
.drag-overlay-leave-active {
  @apply transition-all duration-300 ease-out;
}

.drag-overlay-enter-from,
.drag-overlay-leave-to {
  @apply opacity-0;
  backdrop-filter: blur(0px);
}

.slide-up-enter-active,
.slide-up-leave-active {
  @apply transition-all duration-300 ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
  @apply opacity-0;
  transform: translateY(100%);
}

/* Load More Section */
.load-more-section {
  @apply flex justify-center items-center py-8 px-4;
}

.load-more-btn {
  @apply bg-primary text-primary-content px-6 py-3 rounded-lg font-medium transition-all duration-200;
  @apply hover:bg-primary/90 hover:scale-105 active:scale-95;
  @apply shadow-lg hover:shadow-xl;
  min-height: 44px;
}

.loading-more {
  @apply flex items-center gap-3 text-base-content/70;
}

.loading-spinner {
  @apply w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin;
}

.all-loaded {
  @apply text-base-content/60 text-sm font-medium py-2;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .import-progress-content {
    @apply px-4 py-3;
  }
  
  .import-info {
    @apply flex-col gap-2;
  }
  
  .import-progress-bar {
    @apply max-w-full;
  }
  
  .import-stats {
    @apply self-end;
  }
}
</style>