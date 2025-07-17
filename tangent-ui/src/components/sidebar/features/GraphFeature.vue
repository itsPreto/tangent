<template>
  <div class="graph-feature" :class="'theme-' + currentTheme">
    <!-- Full height graph container -->
    <div class="graph-container" ref="graphContainer">
      <!-- Loading State -->
      <div v-if="clusteringStatus.is_running" class="graph-loading-state">
        <DotLottieVue :src="'/loading-animation-2.lottie'" autoplay loop :style="{ width: '120px', height: '120px' }"
          class="loading-animation" />
        <h3>{{ clusteringStatus.status_message || 'Processing workspaces...' }}</h3>
        <div v-if="clusteringStatus.progress > 0" class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: clusteringStatus.progress * 100 + '%' }"></div>
          </div>
          <span class="progress-text">{{ Math.round(clusteringStatus.progress * 100) }}%</span>
          <span v-if="clusteringStatus.total_workspaces > 0" class="workspace-counter">
            {{ clusteringStatus.processed_workspaces }}/{{ clusteringStatus.total_workspaces }} workspaces
          </span>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="errorMessage" class="graph-error-state">
        <div class="error-icon">⚠️</div>
        <h3>Clustering Error</h3>
        <p>{{ errorMessage }}</p>
        <button @click="retryClusteringWithError" class="retry-btn error">
          Retry Analysis
        </button>
      </div>

      <!-- Real ForceGraph Component -->
      <ForceGraph
        v-else-if="!clusteringStatus.is_running && clusteringStatus.clusters && clusteringStatus.clusters.length > 0"
        ref="forceGraphRef" :clustering-status="clusteringStatus" :external-controls="true"
        @select-workspace="handleSelectWorkspace" @update-stats="handleGraphStatsUpdate"
        @update3-d-support="handle3DSupportUpdate" @update-fullscreen="handleFullscreenUpdate"
        class="force-graph-main" />

      <!-- Empty State -->
      <div v-else class="graph-placeholder">
        <GitBranch class="w-16 h-16 opacity-30" />
        <h3>No Graph Data Available</h3>
        <p>Start clustering analysis to visualize workspace relationships and topics.</p>
        <button @click="startClustering" class="retry-btn">
          Start Clustering Analysis
        </button>
      </div>
    </div>

    <!-- Control Panel (anchored at bottom) -->
    <div class="control-panel">
      <!-- Top Controls Bar -->
      <div class="top-controls">
        <div class="stat-badge topics">
          <span class="stat-label">Topics:</span>
          <span class="stat-value">{{ graphStats.clusters }}</span>
        </div>
        <div class="control-actions">
          <div class="layout-buttons">
            <button @click="currentLayout = 'hierarchical'; handleLayoutChange()" class="layout-btn"
              :class="{ active: currentLayout === 'hierarchical' }" title="Hierarchical">
              <GitBranch :size="16" />
            </button>
            <button @click="currentLayout = 'radial'; handleLayoutChange()" class="layout-btn"
              :class="{ active: currentLayout === 'radial' }" title="Radial">
              <Circle :size="16" />
            </button>
            <button @click="currentLayout = 'cluster'; handleLayoutChange()" class="layout-btn"
              :class="{ active: currentLayout === 'cluster' }" title="Cluster">
              <Zap :size="16" />
            </button>
            <button @click="currentLayout = 'force-directed'; handleLayoutChange()" class="layout-btn"
              :class="{ active: currentLayout === 'force-directed' }" title="Force-Directed">
              <Magnet :size="16" />
            </button>
          </div>

          <button @click="toggleForceControls" class="controls-btn" :class="{ active: showForceControls }">
            <Settings :size="16" />
          </button>

          <button @click="resetGraph" class="controls-btn">
            <RotateCcw :size="16" />
            
          </button>

          <button @click="toggleFullscreen" class="controls-btn">
            <Maximize2 :size="16" />
          </button>
        </div>
        <div class="stat-badge workspaces">
          <span class="stat-label">Workspaces:</span>
          <span class="stat-value">{{ graphStats.nodes }}</span>
        </div>
      </div>

      <!-- Expandable Force Controls -->
      <Transition name="slide-up">
        <div v-if="showForceControls" class="force-controls">
          <div class="force-controls-header">
            <h3 class="force-controls-title">Force Controls</h3>
            <div class="force-controls-actions">
              <button @click="resetToDefaults" class="force-btn secondary">Reset to Defaults</button>
              <button @click="applyAndSave" class="force-btn primary">Apply & Save</button>
            </div>
          </div>

          <div class="controls-grid">
            <div class="control-group">
              <label>Link Distance</label>
              <input v-model.number="forceSettings.linkDistance" type="range" min="20" max="200" step="10"
                @input="updateForces" class="control-slider" />
              <span class="control-value">{{ forceSettings.linkDistance }}</span>
            </div>

            <div class="control-group">
              <label>Link Strength</label>
              <input v-model.number="forceSettings.linkStrength" type="range" min="0.1" max="2" step="0.1"
                @input="updateForces" class="control-slider" />
              <span class="control-value">{{ forceSettings.linkStrength }}</span>
            </div>

            <div class="control-group">
              <label>Repulsion Force</label>
              <input v-model.number="forceSettings.chargeStrength" type="range" min="-500" max="-10" step="10"
                @input="updateForces" class="control-slider" />
              <span class="control-value">{{ forceSettings.chargeStrength }}</span>
            </div>

            <div class="control-group">
              <label>Center Attraction</label>
              <input v-model.number="forceSettings.centerStrength" type="range" min="0" max="1" step="0.05"
                @input="updateForces" class="control-slider" />
              <span class="control-value">{{ forceSettings.centerStrength }}</span>
            </div>

            <div class="control-group">
              <label>Link Width</label>
              <input v-model.number="forceSettings.linkWidth" type="range" min="1" max="10" step="0.5"
                @input="updateForces" class="control-slider" />
              <span class="control-value">{{ forceSettings.linkWidth }}</span>
            </div>

            <div class="control-group">
              <label>Topic Node Size</label>
              <input v-model.number="forceSettings.topicNodeSize" type="range" min="5" max="30" step="1"
                @input="updateForces" class="control-slider" />
              <span class="control-value">{{ forceSettings.topicNodeSize }}</span>
            </div>

            <div class="control-group">
              <label>Workspace Node Size</label>
              <input v-model.number="forceSettings.workspaceNodeSize" type="range" min="2" max="15" step="0.5"
                @input="updateForces" class="control-slider" />
              <span class="control-value">{{ forceSettings.workspaceNodeSize }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onBeforeUnmount } from 'vue';
import { GitBranch, RefreshCw, Maximize2, Settings, RotateCcw, Circle, Zap, Magnet } from 'lucide-vue-next';
import { useThemeStore } from '@/stores/themeStore';
import { clusteringService, type ClusteringStatus } from '@/services/clusteringService';
import ForceGraph from '@/components/workspace/ForceGraph.vue';
import { DotLottieVue } from '@lottiefiles/dotlottie-vue';

// Stores
const themeStore = useThemeStore();

// Reactive state
const graphContainer = ref<HTMLElement>();
const forceGraphRef = ref<any>();
const showForceControls = ref(false);
const currentLayout = ref('hierarchical');

// Force settings that match ForceGraph component
const forceSettings = reactive({
  linkDistance: 80,
  linkStrength: 0.6,
  chargeStrength: -100,
  centerStrength: 0.1,
  linkWidth: 2,
  topicNodeSize: 8,
  workspaceNodeSize: 3.5
});

// Clustering state
const clusteringStatus = reactive<ClusteringStatus>({
  is_running: false,
  progress: 0,
  status_message: '',
  total_workspaces: 0,
  processed_workspaces: 0,
  clusters: []
});

// Error handling
const errorMessage = ref<string | null>(null);

// Mock graph stats - would be real data in implementation
const graphStats = ref({
  nodes: 24,
  links: 31,
  clusters: 5
});

// Theme reactivity
const currentTheme = computed(() => themeStore.currentTheme);
const isDarkTheme = computed(() => themeStore.isDarkTheme(currentTheme.value));
const themeColors = computed(() => themeStore.getThemeColors(currentTheme.value));

// Methods
const toggleForceControls = () => {
  showForceControls.value = !showForceControls.value;
};

const handleLayoutChange = () => {
  if (forceGraphRef.value) {
    forceGraphRef.value.updateLayout(currentLayout.value);
  }
};

const updateForces = () => {
  // Force settings are managed internally by the ForceGraph component
  // This function is kept for potential future implementation
};

const resetToDefaults = () => {
  Object.assign(forceSettings, {
    linkDistance: 80,
    linkStrength: 0.6,
    chargeStrength: -100,
    centerStrength: 0.1,
    linkWidth: 2,
    topicNodeSize: 8,
    workspaceNodeSize: 3.5
  });
  updateForces();
};

const applyAndSave = () => {
  updateForces();
  // Add any save logic here if needed
};

const resetGraph = () => {
  if (forceGraphRef.value) {
    forceGraphRef.value.resetGraph();
  }
};

const toggleFullscreen = () => {
  if (forceGraphRef.value) {
    forceGraphRef.value.toggleFullscreen();
  }
};

// Clustering methods
const startClustering = async () => {
  try {
    errorMessage.value = null; // Clear any previous errors
    await clusteringService.startClustering({
      method: 'kmeans',
      n_clusters: 5
    });
    console.log('Starting clustering process');
  } catch (error) {
    console.error('Failed to start clustering:', error);
    errorMessage.value = error instanceof Error ? error.message : 'Failed to start clustering analysis';
  }
};

const retryClusteringWithError = async () => {
  errorMessage.value = null;
  await startClustering();
};

const handleSelectWorkspace = (workspaceId: string) => {
  console.log('Selected workspace:', workspaceId);
};

const handleGraphStatsUpdate = (stats: { topics: number; workspaces: number }) => {
  graphStats.value.clusters = stats.topics;
  graphStats.value.nodes = stats.workspaces;
};

const handle3DSupportUpdate = (supported: boolean) => {
  console.log('3D support:', supported);
};

const handleFullscreenUpdate = (isFullscreen: boolean) => {
  console.log('Fullscreen:', isFullscreen);
};

// Cleanup
let statusUnsubscribe: (() => void) | null = null;

onMounted(async () => {
  // Subscribe to clustering status updates
  statusUnsubscribe = clusteringService.onStatusUpdate((status) => {
    Object.assign(clusteringStatus, status);

    // Handle clustering errors
    if (status.status_message && status.status_message.toLowerCase().includes('no valid content')) {
      errorMessage.value = 'No workspace content found for clustering. Add some conversations with content first.';
      // Stop the clustering process
      clusteringStatus.is_running = false;
    } else if (status.status_message && status.status_message.toLowerCase().includes('error')) {
      errorMessage.value = status.status_message;
      clusteringStatus.is_running = false;
    }
  });

  // Check initial clustering status
  try {
    const status = await clusteringService.getStatus();
    Object.assign(clusteringStatus, status);
  } catch (error) {
    console.error('Error getting initial clustering status:', error);
    errorMessage.value = 'Failed to connect to clustering service';
  }
});

onBeforeUnmount(() => {
  if (statusUnsubscribe) {
    statusUnsubscribe();
  }
});
</script>

<style scoped>
.graph-feature {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Full height graph container */
.graph-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: transparent;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Control Panel */
.control-panel {
  position: relative;
  flex-shrink: 0;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

/* Theme-aware control panel backgrounds */
.theme-light .control-panel {
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.theme-dark .control-panel {
  background: rgba(20, 20, 25, 0.95);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.theme-cmyk .control-panel {
  background: rgba(8, 8, 15, 0.95);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* Top Controls Bar */
.top-controls {
  display: flex;
  align-items: center;
  font-family: monospace;
  padding: 12px 16px;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  flex-direction: row;
  justify-self: anchor-center;
  align-content: space-around;
}

/* Theme-aware top controls */
.theme-light .top-controls {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.theme-dark .top-controls {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.theme-cmyk .top-controls {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-badges {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  min-width: 0;
}

.stat-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.stat-badge.topics {
  background: rgba(255, 192, 203, 0.3);
  color: #d946ef;
}

.stat-badge.workspaces {
  background: rgba(219, 70, 239, 0.2);
  color: #a855f7;
}

.stat-label {
  opacity: 0.8;
}

.stat-value {
  font-weight: 600;
}

.control-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.layout-buttons {
  display: flex;
  gap: 4px;
  padding: 2px;
  border-radius: 8px;
}

.layout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.layout-btn.active {
  background: #d946ef;
  color: white;
  box-shadow: 0 2px 4px rgba(217, 70, 239, 0.3);
}

/* Theme-aware layout buttons */
.theme-light .layout-buttons {
  background: rgba(0, 0, 0, 0.05);
}

.theme-light .layout-btn {
  color: rgba(0, 0, 0, 0.6);
}

.theme-light .layout-btn:hover {
  background: rgba(255, 255, 255, 0.8);
  color: rgba(0, 0, 0, 0.8);
}

.theme-dark .layout-buttons {
  background: rgba(255, 255, 255, 0.05);
}

.theme-dark .layout-btn {
  color: rgba(255, 255, 255, 0.6);
}

.theme-dark .layout-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.theme-cmyk .layout-buttons {
  background: rgba(255, 255, 255, 0.05);
}

.theme-cmyk .layout-btn {
  color: rgba(255, 255, 255, 0.6);
}

.theme-cmyk .layout-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.controls-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.controls-btn.active {
  background: #d946ef;
  color: white;
  border-color: #d946ef;
}

/* Theme-aware controls buttons */
.theme-light .controls-btn {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.8);
}

.theme-light .controls-btn:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
}

.theme-dark .controls-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.theme-dark .controls-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.theme-cmyk .controls-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.theme-cmyk .controls-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

/* Force Controls */
.force-controls {
  padding: 16px;
}

/* Theme-aware force controls */
.theme-light .force-controls {
  background: rgba(255, 255, 255, 0.98);
}

.theme-dark .force-controls {
  background: rgba(20, 20, 25, 0.98);
}

.theme-cmyk .force-controls {
  background: rgba(8, 8, 15, 0.98);
}

.force-controls-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.force-controls-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

/* Theme-aware force controls title */
.theme-light .force-controls-title {
  color: #1f2937;
}

.theme-dark .force-controls-title {
  color: #f9fafb;
}

.theme-cmyk .force-controls-title {
  color: #f9fafb;
}

.force-controls-actions {
  display: flex;
  gap: 8px;
}

.force-btn {
  padding: 6px 12px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

/* Theme-aware force buttons */
.theme-light .force-btn.secondary {
  background: white;
  border-color: rgba(0, 0, 0, 0.2);
  color: #6b7280;
}

.theme-light .force-btn.secondary:hover {
  background: #f9fafb;
}

.theme-dark .force-btn.secondary {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #d1d5db;
}

.theme-dark .force-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

.theme-cmyk .force-btn.secondary {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #d1d5db;
}

.theme-cmyk .force-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

.force-btn.primary {
  background: #d946ef;
  border-color: #d946ef;
  color: white;
}

.force-btn.primary:hover {
  background: #c026d3;
  border-color: #c026d3;
}

.controls-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-group label {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Theme-aware control group labels */
.theme-light .control-group label {
  color: #6b7280;
}

.theme-dark .control-group label {
  color: #9ca3af;
}

.theme-cmyk .control-group label {
  color: #9ca3af;
}

.control-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
}

/* Theme-aware control slider */
.theme-light .control-slider {
  background: #e5e7eb;
}

.theme-dark .control-slider {
  background: #374151;
}

.theme-cmyk .control-slider {
  background: #374151;
}

.control-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #d946ef;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.control-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.control-value {
  align-self: flex-end;
  font-size: 13px;
  font-weight: 600;
  color: #d946ef;
  min-width: 40px;
  text-align: center;
  background: rgba(217, 70, 239, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

/* Slide up animation */
.slide-up-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.6, 1);
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
  max-height: 0;
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
  max-height: 0;
}

/* Force Graph */
.force-graph-main {
  width: 100%;
  height: 100%;
}

/* Loading State */
.graph-loading-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
}

.loading-animation {
  margin-bottom: 16px;
}

.graph-loading-state h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: white;
}

.progress-container {
  width: 100%;
  max-width: 300px;
  margin-top: 16px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: #d946ef;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  font-weight: 600;
  color: #d946ef;
  margin-right: 12px;
}

.workspace-counter {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

/* Error State */
.graph-error-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.7;
}

.graph-error-state h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: white;
}

.graph-error-state p {
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 20px;
  max-width: 300px;
  line-height: 1.5;
}

/* Placeholder State */
.graph-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
}

.graph-placeholder h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 16px 0 8px;
}

.graph-placeholder p {
  opacity: 0.7;
  font-size: 14px;
  margin-bottom: 24px;
  max-width: 250px;
}

.retry-btn {
  padding: 8px 16px;
  background: #d946ef;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  margin-top: 16px;
}

.retry-btn:hover {
  background: #c026d3;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(217, 70, 239, 0.3);
}

.retry-btn.error {
  background: #ef4444;
}

.retry-btn.error:hover {
  background: #dc2626;
}
</style>