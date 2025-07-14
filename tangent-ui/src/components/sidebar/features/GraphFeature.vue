<template>
  <div class="graph-feature" :class="'theme-' + currentTheme">
    <!-- Wrapper around ForceGraph for sidebar -->
    <div class="graph-content">
      <!-- Graph Controls Header -->
      <div class="graph-header" :style="headerStyle">
        <div class="header-section">
          <GitBranch class="w-5 h-5 text-green-400" />
          <span class="header-text">Workspace Graph</span>
        </div>
        <div class="header-controls">
          <button @click="toggleLayoutMode" class="control-btn" :style="buttonStyle">
            <RotateCcw class="w-4 h-4" />
          </button>
          <button @click="resetGraph" class="control-btn" :style="buttonStyle">
            <RefreshCw class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Graph Settings -->
      <div class="graph-settings" :style="sectionStyle">
        <div class="setting-group">
          <label class="setting-label">Layout</label>
          <select v-model="layoutMode" class="setting-select" :style="selectStyle">
            <option value="force">Force-Directed</option>
            <option value="radial">Radial</option>
            <option value="hierarchical">Hierarchical</option>
            <option value="circular">Circular</option>
          </select>
        </div>
        
        <div class="setting-group">
          <label class="setting-label">Node Size</label>
          <input 
            v-model="nodeSize" 
            type="range" 
            min="5" 
            max="50" 
            class="setting-range"
            :style="rangeStyle" />
        </div>
        
        <div class="setting-group">
          <label class="setting-label">Link Distance</label>
          <input 
            v-model="linkDistance" 
            type="range" 
            min="10" 
            max="200" 
            class="setting-range"
            :style="rangeStyle" />
        </div>
      </div>

      <!-- Graph Stats -->
      <div class="graph-stats" :style="sectionStyle">
        <div class="stat-item">
          <span class="stat-label">Nodes:</span>
          <span class="stat-value">{{ graphStats.nodes }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Links:</span>
          <span class="stat-value">{{ graphStats.links }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Clusters:</span>
          <span class="stat-value">{{ graphStats.clusters }}</span>
        </div>
      </div>

      <!-- Graph Container -->
      <div class="graph-container" ref="graphContainer">
        <!-- Loading State -->
        <div v-if="clusteringStatus.is_running" class="graph-loading-state">
          <DotLottieVue 
            :src="'/loading-animation-2.lottie'"
            autoplay 
            loop 
            :style="{ width: '120px', height: '120px' }"
            class="loading-animation"
          />
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
          ref="forceGraphRef"
          :clustering-status="clusteringStatus"
          :external-controls="false"
          @select-workspace="handleSelectWorkspace"
          @update-stats="handleGraphStatsUpdate"
          @update3-d-support="handle3DSupportUpdate"
          @update-fullscreen="handleFullscreenUpdate"
          class="force-graph-main"
        />
        
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onBeforeUnmount } from 'vue';
import { GitBranch, RotateCcw, RefreshCw } from 'lucide-vue-next';
import { useThemeStore } from '@/stores/themeStore';
import { clusteringService, type ClusteringStatus } from '@/services/clusteringService';
import ForceGraph from '@/components/workspace/ForceGraph.vue';
import { DotLottieVue } from '@lottiefiles/dotlottie-vue';

// Stores
const themeStore = useThemeStore();

// Reactive state
const layoutMode = ref('force');
const nodeSize = ref(20);
const linkDistance = ref(80);
const graphContainer = ref<HTMLElement>();
const forceGraphRef = ref<any>();

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
const toggleLayoutMode = () => {
  const modes = ['force', 'radial', 'hierarchical', 'circular'];
  const currentIndex = modes.indexOf(layoutMode.value);
  layoutMode.value = modes[(currentIndex + 1) % modes.length];
};

const resetGraph = () => {
  if (forceGraphRef.value) {
    forceGraphRef.value.resetGraph();
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
  console.log('Graph stats updated:', stats);
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

// Computed styles
const headerStyle = computed(() => {
  return {
    borderBottom: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`,
    backgroundColor: isDarkTheme.value ? 'rgba(20, 20, 20, 0.5)' : 'rgba(240, 240, 240, 0.5)'
  };
});

const sectionStyle = computed(() => {
  return {
    borderBottom: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.2)' : 'rgba(200, 200, 200, 0.2)'}`
  };
});

const buttonStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 40, 0.8)' : 'rgba(240, 240, 240, 0.8)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
    border: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`
  };
});

const selectStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    border: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`
  };
});

const rangeStyle = computed(() => {
  return {
    accentColor: themeColors.value.primary
  };
});

const getPlaceholderNodeStyle = (index: number) => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280', '#14b8a6'];
  const positions = [
    { top: '20%', left: '30%' },
    { top: '15%', left: '70%' },
    { top: '40%', left: '20%' },
    { top: '35%', left: '80%' },
    { top: '65%', left: '25%' },
    { top: '60%', left: '75%' },
    { top: '80%', left: '40%' },
    { top: '85%', left: '60%' }
  ];
  
  const color = colors[index % colors.length];
  const position = positions[index % positions.length];
  
  return {
    backgroundColor: color,
    position: 'absolute',
    top: position.top,
    left: position.left,
    transform: 'translate(-50%, -50%)',
    animationDelay: `${index * 0.2}s`
  };
};
</script>

<style scoped>
.graph-feature {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.graph-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.graph-header {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-text {
  font-weight: 600;
  font-size: 16px;
}

.header-controls {
  display: flex;
  gap: 8px;
}

.control-btn {
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover {
  opacity: 0.8;
}

.graph-settings {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex-shrink: 0;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.8;
}

.setting-select {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.setting-range {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.graph-stats {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #10b981;
}

.graph-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.02);
}

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

.placeholder-nodes {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.placeholder-node {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.4;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.8;
    transform: translate(-50%, -50%) scale(1.2);
  }
}
.retry-btn {
  padding: 8px 16px;
  background: var(--theme-primary);
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
  background: var(--theme-primary-dark);
  transform: translateY(-1px);
}

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
  background: rgba(var(--theme-background-rgb), 0.95);
}

.loading-animation {
  margin-bottom: 16px;
}

.graph-loading-state h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--theme-text-primary);
}

.progress-container {
  width: 100%;
  max-width: 300px;
  margin-top: 16px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(var(--theme-border-rgb), 0.2);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: var(--theme-primary);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-primary);
  margin-right: 12px;
}

.workspace-counter {
  font-size: 12px;
  color: var(--theme-text-secondary);
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
  background: rgba(var(--theme-background-rgb), 0.95);
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
  color: var(--theme-text-primary);
}

.graph-error-state p {
  color: var(--theme-text-secondary);
  margin-bottom: 20px;
  max-width: 300px;
  line-height: 1.5;
}

.retry-btn.error {
  background: #ef4444;
  color: white;
}

.retry-btn.error:hover {
  background: #dc2626;
}
</style>