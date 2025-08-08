<template>
  <div class="mock-data-controls">
    <!-- Header with Toggle -->
    <div class="controls-header" @click="isExpanded = !isExpanded">
      <div class="header-content">
        <div class="icon-title">
          <Database :size="20" />
          <h3>Mock Data Generator</h3>
        </div>
        <div class="header-actions">
          <span v-if="lastGenerated" class="last-generated">
            Last: {{ formatTime(lastGenerated) }}
          </span>
          <ChevronDown 
            :size="16" 
            :class="{ 'rotated': isExpanded }" 
            class="chevron"
          />
        </div>
      </div>
    </div>

    <!-- Expandable Controls -->
    <Transition name="slide-down">
      <div v-if="isExpanded" class="controls-content">
        
        <!-- Performance Warning -->
        <div v-if="config.totalNodes > 500" class="warning-banner">
          <AlertTriangle :size="16" />
          <span>High node count may impact performance</span>
        </div>

        <!-- Configuration Grid -->
        <div class="config-grid">
          
          <!-- Total Nodes -->
          <div class="config-item">
            <label for="total-nodes">Total Nodes</label>
            <div class="input-with-slider">
              <input 
                id="total-nodes"
                v-model.number="config.totalNodes" 
                type="number" 
                :min="1" 
                :max="5000"
                class="number-input"
                @input="updatePreview"
              />
              <input 
                v-model.number="config.totalNodes"
                type="range" 
                :min="1" 
                :max="5000"
                step="10"
                class="slider"
                @input="updatePreview"
              />
            </div>
            <span class="input-help">Total branch nodes across all workspaces</span>
          </div>

          <!-- Number of Workspaces -->
          <div class="config-item">
            <label for="num-workspaces">Workspaces</label>
            <div class="input-with-slider">
              <input 
                id="num-workspaces"
                v-model.number="config.numWorkspaces" 
                type="number" 
                :min="1" 
                :max="50"
                class="number-input"
                @input="updatePreview"
              />
              <input 
                v-model.number="config.numWorkspaces"
                type="range" 
                :min="1" 
                :max="50"
                class="slider"
                @input="updatePreview"
              />
            </div>
            <span class="input-help">Separate conversation workspaces</span>
          </div>

          <!-- Branching Factor -->
          <div class="config-item">
            <label for="branching-factor">Branching Factor</label>
            <div class="input-with-slider">
              <input 
                id="branching-factor"
                v-model.number="config.branchingFactor" 
                type="number" 
                :min="0" 
                :max="1"
                step="0.1"
                class="number-input"
                @input="updatePreview"
              />
              <input 
                v-model.number="config.branchingFactor"
                type="range" 
                :min="0" 
                :max="1"
                step="0.1"
                class="slider"
                @input="updatePreview"
              />
            </div>
            <span class="input-help">Probability of conversation branching (0.0-1.0)</span>
          </div>

          <!-- Max Depth -->
          <div class="config-item">
            <label for="max-depth">Max Depth</label>
            <div class="input-with-slider">
              <input 
                id="max-depth"
                v-model.number="config.maxDepth" 
                type="number" 
                :min="1" 
                :max="10"
                class="number-input"
                @input="updatePreview"
              />
              <input 
                v-model.number="config.maxDepth"
                type="range" 
                :min="1" 
                :max="10"
                class="slider"
                @input="updatePreview"
              />
            </div>
            <span class="input-help">Maximum conversation thread depth</span>
          </div>

        </div>

        <!-- Preview Information -->
        <div v-if="preview" class="preview-section">
          <h4>Preview</h4>
          <div class="preview-grid">
            <div class="preview-item">
              <span class="preview-label">Avg nodes per workspace:</span>
              <span class="preview-value">{{ Math.round(config.totalNodes / config.numWorkspaces) }}</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">Canvas coverage:</span>
              <span class="preview-value">{{ config.numWorkspaces }} workspaces</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">Estimated branches:</span>
              <span class="preview-value">~{{ Math.round(config.totalNodes * config.branchingFactor) }}</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">Performance impact:</span>
              <span :class="`preview-value impact-${getPerformanceImpact()}`">
                {{ getPerformanceImpact().toUpperCase() }}
              </span>
            </div>
          </div>
        </div>

        <!-- Performance Metrics -->
        <div v-if="performanceMetrics" class="metrics-section">
          <h4>Performance Metrics</h4>
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">Render time:</span>
              <span class="metric-value">{{ performanceMetrics.renderTime }}ms</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Memory usage:</span>
              <span class="metric-value">{{ performanceMetrics.memoryUsage }}MB</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">FPS:</span>
              <span :class="`metric-value fps-${getFpsClass(performanceMetrics.fps)}`">
                {{ performanceMetrics.fps }}
              </span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <button 
            @click="generatePreview" 
            :disabled="isLoading"
            class="btn btn-secondary"
          >
            <Eye :size="16" />
            Preview Config
          </button>
          
          <button 
            @click="generateMockData" 
            :disabled="isLoading || !isValidConfig"
            class="btn btn-primary"
          >
            <template v-if="isLoading">
              <div class="loading-spinner"></div>
              Generating...
            </template>
            <template v-else>
              <Play :size="16" />
              Generate Data
            </template>
          </button>
          
          <button 
            @click="loadAllNodesMode" 
            :disabled="isLoading"
            class="btn btn-success"
          >
            <Database :size="16" />
            Show All Nodes
          </button>
          
          <button 
            @click="clearMockData" 
            :disabled="isLoading"
            class="btn btn-danger"
          >
            <Trash2 :size="16" />
            Clear All
          </button>
        </div>

        <!-- Status Messages -->
        <Transition name="fade">
          <div v-if="statusMessage" :class="`status-message ${statusMessage.type}`">
            {{ statusMessage.text }}
          </div>
        </Transition>

      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { 
  Database, ChevronDown, AlertTriangle, Eye, Play, Trash2 
} from 'lucide-vue-next'
import { apiService } from '@/utils/api'
import { useCanvasStore } from '@/stores/canvasStore'

const emit = defineEmits(['data-generated', 'data-cleared', 'performance-update', 'all-nodes-loaded'])

// Component state
const isExpanded = ref(false)
const isLoading = ref(false)
const lastGenerated = ref(null)
const preview = ref(null)
const performanceMetrics = ref(null)
const statusMessage = ref(null)

// Configuration
const config = ref({
  totalNodes: 100,
  numWorkspaces: 5,
  branchingFactor: 0.3,
  maxDepth: 5,
  canvasBounds: {
    width: 10000,
    height: 8000,
    margin: 500
  }
})

// Store instances
const canvasStore = useCanvasStore()

// Computed properties
const isValidConfig = computed(() => {
  return config.value.totalNodes >= config.value.numWorkspaces &&
         config.value.numWorkspaces > 0 &&
         config.value.totalNodes > 0
})

// Methods
const updatePreview = async () => {
  try {
    const response = await apiService.post('/mock-data/config', config.value)
    preview.value = response.preview
  } catch (error) {
    console.error('Error updating preview:', error)
  }
}

const generatePreview = async () => {
  await updatePreview()
  showStatus('Preview updated', 'success')
}

const generateMockData = async () => {
  if (!isValidConfig.value) return
  
  isLoading.value = true
  showStatus('Generating mock data...', 'info')
  
  try {
    const startTime = performance.now()
    
    const response = await apiService.post('/mock-data/generate', config.value)
    
    const endTime = performance.now()
    const generationTime = Math.round(endTime - startTime)
    
    if (response.success) {
      lastGenerated.value = new Date()
      showStatus(
        `Generated ${response.total_nodes_created} nodes in ${response.total_workspaces_created} workspaces (${generationTime}ms)`, 
        'success'
      )
      emit('data-generated', response)
      
      // Start performance monitoring
      startPerformanceMonitoring()
    } else {
      showStatus(`Error: ${response.error}`, 'error')
    }
  } catch (error) {
    console.error('Error generating mock data:', error)
    showStatus('Failed to generate mock data', 'error')
  } finally {
    isLoading.value = false
  }
}

const loadAllNodesMode = async () => {
  isLoading.value = true
  showStatus('Loading all nodes from all workspaces...', 'info')
  
  try {
    const result = await canvasStore.loadAllNodesMode()
    
    if (result.success) {
      showStatus(
        `Loaded ${result.totalNodes} nodes from ${result.totalWorkspaces} workspaces!`, 
        'success'
      )
      
      // Start performance monitoring for the loaded nodes
      startPerformanceMonitoring()
      
      // Emit event to notify parent (will close the panel and show canvas)
      emit('all-nodes-loaded', result)
    } else {
      showStatus('Failed to load all nodes', 'error')
    }
  } catch (error) {
    console.error('Error loading all nodes:', error)
    showStatus('Failed to load all nodes', 'error')
  } finally {
    isLoading.value = false
  }
}

const clearMockData = async () => {
  if (!confirm('This will clear all mock-generated data. Continue?')) return
  
  isLoading.value = true
  showStatus('Clearing mock data...', 'info')
  
  try {
    const response = await apiService.post('/mock-data/clear')
    
    if (response.success) {
      lastGenerated.value = null
      performanceMetrics.value = null
      showStatus('Mock data cleared successfully', 'success')
      emit('data-cleared')
    } else {
      showStatus(`Error: ${response.error}`, 'error')
    }
  } catch (error) {
    console.error('Error clearing mock data:', error)
    showStatus('Failed to clear mock data', 'error')
  } finally {
    isLoading.value = false
  }
}

const startPerformanceMonitoring = () => {
  // Simple performance monitoring
  let frameCount = 0
  let lastTime = performance.now()
  
  const measurePerformance = () => {
    frameCount++
    const now = performance.now()
    
    if (now - lastTime >= 1000) { // Update every second
      const fps = Math.round(frameCount * 1000 / (now - lastTime))
      
      performanceMetrics.value = {
        renderTime: Math.round(now - lastTime),
        memoryUsage: Math.round((performance.memory?.usedJSHeapSize || 0) / 1024 / 1024),
        fps
      }
      
      emit('performance-update', performanceMetrics.value)
      
      frameCount = 0
      lastTime = now
    }
    
    requestAnimationFrame(measurePerformance)
  }
  
  measurePerformance()
}

const getPerformanceImpact = () => {
  const totalComplexity = config.value.totalNodes * (1 + config.value.branchingFactor)
  
  if (totalComplexity < 100) return 'low'
  if (totalComplexity < 500) return 'medium'
  return 'high'
}

const getFpsClass = (fps) => {
  if (fps >= 30) return 'good'
  if (fps >= 15) return 'medium'
  return 'poor'
}

const showStatus = (text, type = 'info') => {
  statusMessage.value = { text, type }
  setTimeout(() => {
    statusMessage.value = null
  }, 5000)
}

const formatTime = (date) => {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  }).format(date)
}

// Watchers
watch(() => config.value.totalNodes, () => {
  // Auto-adjust workspaces if totalNodes becomes too small
  if (config.value.totalNodes < config.value.numWorkspaces) {
    config.value.numWorkspaces = config.value.totalNodes
  }
}, { immediate: true })

// Initialize
onMounted(() => {
  updatePreview()
})
</script>

<style scoped>
.mock-data-controls {
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700;
  min-width: 320px;
  max-width: 500px;
}

.controls-header {
  @apply p-4 cursor-pointer select-none border-b border-gray-200 dark:border-gray-700;
}

.controls-header:hover {
  @apply bg-gray-50 dark:bg-gray-700;
}

.header-content {
  @apply flex items-center justify-between;
}

.icon-title {
  @apply flex items-center gap-2;
}

.icon-title h3 {
  @apply text-lg font-semibold text-gray-900 dark:text-white;
}

.header-actions {
  @apply flex items-center gap-2;
}

.last-generated {
  @apply text-xs text-gray-500 dark:text-gray-400;
}

.chevron {
  @apply transition-transform text-gray-500 dark:text-gray-400;
}

.chevron.rotated {
  @apply rotate-180;
}

.controls-content {
  @apply p-4 space-y-4;
}

.warning-banner {
  @apply flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg border border-yellow-200 dark:border-yellow-800;
}

.config-grid {
  @apply grid grid-cols-1 gap-4;
}

.config-item {
  @apply space-y-2;
}

.config-item label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.input-with-slider {
  @apply flex items-center gap-3;
}

.number-input {
  @apply w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
}

.slider {
  @apply flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer;
}

.slider::-webkit-slider-thumb {
  @apply appearance-none w-4 h-4 bg-blue-500 rounded-full cursor-pointer;
}

.input-help {
  @apply text-xs text-gray-500 dark:text-gray-400;
}

.preview-section, .metrics-section {
  @apply p-3 bg-gray-50 dark:bg-gray-700 rounded-lg;
}

.preview-section h4, .metrics-section h4 {
  @apply text-sm font-medium text-gray-700 dark:text-gray-300 mb-2;
}

.preview-grid, .metrics-grid {
  @apply grid grid-cols-2 gap-2;
}

.preview-item, .metric-item {
  @apply text-xs;
}

.preview-label, .metric-label {
  @apply text-gray-500 dark:text-gray-400;
}

.preview-value, .metric-value {
  @apply font-medium text-gray-900 dark:text-white ml-1;
}

.impact-low { @apply text-green-600 dark:text-green-400; }
.impact-medium { @apply text-yellow-600 dark:text-yellow-400; }
.impact-high { @apply text-red-600 dark:text-red-400; }

.fps-good { @apply text-green-600 dark:text-green-400; }
.fps-medium { @apply text-yellow-600 dark:text-yellow-400; }
.fps-poor { @apply text-red-600 dark:text-red-400; }

.action-buttons {
  @apply flex gap-2 flex-wrap;
}

.btn {
  @apply flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors;
}

.btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white;
}

.btn-secondary {
  @apply bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white;
}

.btn-success {
  @apply bg-green-600 hover:bg-green-700 text-white;
}

.btn-danger {
  @apply bg-red-600 hover:bg-red-700 text-white;
}

.loading-spinner {
  @apply w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin;
}

.status-message {
  @apply p-3 rounded-lg text-sm;
}

.status-message.success {
  @apply bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800;
}

.status-message.error {
  @apply bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800;
}

.status-message.info {
  @apply bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800;
}

/* Transitions */
.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-down-enter-from, .slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}

.slide-down-enter-to, .slide-down-leave-from {
  max-height: 1000px;
  opacity: 1;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>