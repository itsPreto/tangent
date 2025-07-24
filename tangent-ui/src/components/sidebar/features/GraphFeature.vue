<template>
  <div class="graph-feature" :class="['theme-' + currentTheme, { 'tab-active': activeTab !== 'info' }]">
    <!-- Full height graph container -->
    <div class="graph-container" ref="graphContainer">
      <!-- Enhanced Loading State -->
      <div v-if="clusteringStatus.is_running" class="graph-loading-state">
        <DotLottieVue :src="'/loading-animation-2.lottie'" autoplay loop :style="{ width: '120px', height: '120px' }"
          class="loading-animation" />
        <h3>{{ getLoadingTitle() }}</h3>
        <div class="loading-details">
          <div class="loading-phase">
            <span class="phase-icon">{{ getPhaseIcon() }}</span>
            <span class="phase-text">{{ getPhaseText() }}</span>
          </div>
          <div v-if="clusteringStatus.progress > 0" class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: clusteringStatus.progress * 100 + '%' }"></div>
            </div>
            <div class="progress-info">
              <span class="progress-text">{{ Math.round(clusteringStatus.progress * 100) }}%</span>
              <span v-if="clusteringStatus.total_workspaces > 0" class="workspace-counter">
                {{ clusteringStatus.processed_workspaces }}/{{ clusteringStatus.total_workspaces }} workspaces
              </span>
            </div>
          </div>
          <div v-if="clusteringSettings.autoOptimize" class="optimization-info">
            <div class="optimization-status">
              <span class="optimization-icon">●</span>
              <span>Testing configurations for optimal clustering</span>
            </div>
            <div class="optimization-params">
              <span>Algorithm: {{ clusteringSettings.algorithm.toUpperCase() }}</span>
              <span>Range: {{ clusteringSettings.minClusters }}-{{ clusteringSettings.maxClusters }} clusters</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="errorMessage" class="graph-error-state">
        <div class="error-icon">!</div>
        <h3>Clustering Error</h3>
        <p>{{ errorMessage }}</p>
        <button @click="retryClusteringWithError" class="retry-btn error">
          Retry Analysis
        </button>
      </div>

      <!-- Real ForceGraph Component -->
      <ForceGraph
        v-else-if="!clusteringStatus.is_running && clusteringStatus.clusters && clusteringStatus.clusters.length > 0"
        ref="forceGraphRef" :clustering-status="clusteringStatus" :external-controls="true" :enable-3d="is3DEnabled"
        :force-settings="forceSettings" :current-layout="currentLayout" @select-workspace="handleSelectWorkspace"
        @update-stats="handleGraphStatsUpdate" @update3-d-support="handle3DSupportUpdate"
        @update-fullscreen="handleFullscreenUpdate" class="force-graph-main" />

      <!-- Empty State -->
      <div v-else class="graph-placeholder">
        <GitBranch class="w-16 h-16 opacity-30" />
        <h3>No Graph Data Available</h3>
        <p>Start clustering analysis to visualize workspace relationships and topics.</p>

        <!-- Requirements Check -->
        <div v-if="workspaceCount !== null && workspaceCount >= 0" class="requirements-info">
          <div class="requirement-item" :class="{ 'met': workspaceCount >= 2, 'not-met': workspaceCount < 2 }">
            <span class="requirement-icon">{{ workspaceCount >= 2 ? '✓' : '✗' }}</span>
            <span class="requirement-text">{{ workspaceCount }} workspace{{ workspaceCount !== 1 ? 's' : '' }}
              available</span>
          </div>
          <div v-if="workspaceCount < 2" class="requirement-warning">
            <span class="warning-icon">⚠️</span>
            <span>At least 2 workspaces required for clustering analysis</span>
          </div>
          <div v-else-if="workspaceCount < 5" class="requirement-info-text">
            <span class="info-icon">ℹ️</span>
            <span>Limited clustering options with {{ workspaceCount }} workspaces</span>
          </div>
        </div>

        <button @click="startClustering" class="retry-btn" :disabled="workspaceCount === null || workspaceCount < 2"
          :class="{ 'disabled': workspaceCount === null || workspaceCount < 2 }">
          {{ workspaceCount === null ? 'Loading...' : workspaceCount < 2 ? 'Insufficient Workspaces'
            : 'Start Clustering Analysis' }} </button>
      </div>
    </div>

    <!-- Enhanced Control Panel with Tabs -->
    <div class="control-panel">
      <!-- Tab Navigation -->
      <div class="tab-navigation">
        <button @click="activeTab = 'info'" class="tab-btn" :class="{ active: activeTab === 'info' }">
          <Info :size="14" />
          <span>About</span>
        </button>
        <button @click="activeTab = 'settings'" class="tab-btn" :class="{ active: activeTab === 'settings' }">
          <Settings :size="14" />
          <span>Settings</span>
        </button>
        <button @click="activeTab = 'insights'" class="tab-btn" :class="{ active: activeTab === 'insights' }">
          <BarChart :size="14" />
          <span>Insights</span>
        </button>
        <button @click="activeTab = 'export'" class="tab-btn" :class="{ active: activeTab === 'export' }">
          <Download :size="14" />
          <span>Export</span>
        </button>
      </div>

      <!-- Top Controls Bar - Only show on info tab -->
      <div v-if="activeTab === 'info'" class="top-controls">
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

          <button @click="toggle3D" class="controls-btn" :class="{ active: is3DEnabled }" title="Toggle 3D">
            3D
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

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Info Tab -->
        <div v-if="activeTab === 'info'" class="tab-panel info-panel">
          <div class="info-section">
            <h3 class="info-title">Workspace Clustering & Visualization</h3>
            <p class="info-description">
              Discover hidden patterns and relationships in your workspace data through intelligent clustering and
              interactive force-directed visualization.
            </p>
          </div>

          <div class="info-section">
            <h4 class="info-subtitle">How it works</h4>
            <div class="info-steps">
              <div class="step">
                <div class="step-icon">1</div>
                <div class="step-content">
                  <strong>Analysis</strong> - AI analyzes your workspace content, messages, and metadata
                </div>
              </div>
              <div class="step">
                <div class="step-icon">2</div>
                <div class="step-content">
                  <strong>Clustering</strong> - Groups similar workspaces based on topics, themes, and patterns
                </div>
              </div>
              <div class="step">
                <div class="step-icon">3</div>
                <div class="step-content">
                  <strong>Visualization</strong> - Creates interactive network showing relationships and connections
                </div>
              </div>
            </div>
          </div>

          <div class="info-section">
            <h4 class="info-subtitle">Understanding the Graph</h4>
            <div class="legend">
              <div class="legend-item">
                <div class="legend-icon cluster-node"></div>
                <span><strong>Cluster Nodes</strong> - Topic centers (larger, colored circles)</span>
              </div>
              <div class="legend-item">
                <div class="legend-icon workspace-node"></div>
                <span><strong>Workspace Nodes</strong> - Individual workspaces (smaller circles)</span>
              </div>
              <div class="legend-item">
                <div class="legend-icon connection-line"></div>
                <span><strong>Connections</strong> - Relationships and similarity strength</span>
              </div>
            </div>
          </div>

          <div class="info-section">
            <h4 class="info-subtitle">Interaction Tips</h4>
            <div class="tips-grid">
              <div class="tip">
                <strong>Drag</strong> nodes to explore relationships
              </div>
              <div class="tip">
                <strong>Zoom</strong> to focus on specific clusters
              </div>
              <div class="tip">
                <strong>Click</strong> nodes to view details
              </div>
              <div class="tip">
                <strong>Hover</strong> to see connections
              </div>
            </div>
          </div>
        </div>

        <!-- Settings Tab -->
        <div v-if="activeTab === 'settings'" class="tab-panel settings-panel">
          <!-- Condensed Clustering Controls -->
          <div class="clustering-controls-grid">
            <!-- Algorithm & Resolution Column -->
            <div class="control-column">
              <div class="algorithm-toggle">
                <button @click="clusteringSettings.algorithm = 'kmeans'"
                  :class="{ active: clusteringSettings.algorithm === 'kmeans' }" class="algo-btn">
                  K-Means
                </button>
                <button @click="clusteringSettings.algorithm = 'dbscan'"
                  :class="{ active: clusteringSettings.algorithm === 'dbscan' }" class="algo-btn">
                  DBSCAN
                </button>
              </div>

              <!-- Multi-Resolution Slider -->
              <div class="resolution-control-compact">
                <label>Resolution</label>
                <div class="resolution-slider-wrapper">
                  <span class="res-min">{{ clusterLimits.min }}</span>
                  <input v-model.number="multiResolutionState.currentResolution"
                    @input="switchToResolution($event.target.value)" type="range" :min="clusterLimits.min"
                    :max="clusterLimits.max" step="1" class="compact-slider"
                    :disabled="multiResolutionState.isLoadingResolution" />
                  <span class="res-max">{{ clusterLimits.max }}</span>
                  <span class="res-current">{{ multiResolutionState.currentResolution }}</span>
                </div>
                <div class="cache-indicators">
                  <span v-if="multiResolutionState.cacheStatus.cachedResolutions.length > 0" class="cache-dot"></span>
                  <button @click="invalidateCache" class="mini-btn" title="Clear cache">×</button>
                </div>
              </div>
            </div>

            <!-- Algorithm-specific Parameters Column -->
            <div class="control-column">
              <!-- K-Means Parameters -->
              <div v-if="clusteringSettings.algorithm === 'kmeans'" class="param-group">
                <div class="compact-control">
                  <label>Clusters</label>
                  <input v-model.number="clusteringSettings.numClusters" type="range" min="2" max="15" step="1"
                    class="compact-slider" />
                  <span class="value">{{ clusteringSettings.numClusters }}</span>
                </div>

                <div class="quality-toggle">
                  <button v-for="quality in ['balanced', 'tight', 'separated']" :key="quality"
                    @click="clusteringSettings.qualityTarget = quality"
                    :class="{ active: clusteringSettings.qualityTarget === quality }" class="quality-btn">
                    {{ quality }}
                  </button>
                </div>
              </div>

              <!-- DBSCAN Parameters -->
              <div v-else class="param-group">
                <div class="compact-control">
                  <label>ε</label>
                  <input v-model.number="clusteringSettings.dbscanEps" type="range" min="0.1" max="2.0" step="0.1"
                    class="compact-slider" />
                  <span class="value">{{ clusteringSettings.dbscanEps.toFixed(1) }}</span>
                </div>

                <div class="compact-control">
                  <label>Min</label>
                  <input v-model.number="clusteringSettings.dbscanMinSamples" type="range" min="2" max="10" step="1"
                    class="compact-slider" />
                  <span class="value">{{ clusteringSettings.dbscanMinSamples }}</span>
                </div>
              </div>
            </div>

            <!-- Auto-Optimize & Actions Column -->
            <div class="control-column">
              <div class="optimize-control">
                <label class="toggle-switch">
                  <input type="checkbox" v-model="clusteringSettings.autoOptimize" />
                  <span class="toggle-slider"></span>
                  <span class="toggle-label">Auto-optimize</span>
                </label>

                <div v-if="clusteringSettings.autoOptimize" class="optimize-range">
                  <input v-model.number="clusteringSettings.minClusters" type="number" min="2" max="15"
                    class="mini-input" />
                  <span>–</span>
                  <input v-model.number="clusteringSettings.maxClusters" type="number" min="2" max="15"
                    class="mini-input" />
                </div>
              </div>

              <button @click="recomputeClusters" class="recompute-btn" :disabled="clusteringStatus.is_running">
                <RefreshCw :size="14" />
                {{ clusteringSettings.autoOptimize ? 'Optimize' : 'Recompute' }}
              </button>
            </div>
          </div>

          <div class="settings-section">
            <h4 class="settings-subtitle">Visualization Controls</h4>
            <div class="controls-grid">
              <div class="control-group">
                <label>Link Distance</label>
                <div class="slider-container">
                  <input v-model.number="forceSettings.linkDistance" type="range" min="20" max="200" step="10"
                    class="control-slider" />
                  <span class="control-value">{{ forceSettings.linkDistance }}</span>
                </div>
              </div>

              <div class="control-group">
                <label>Link Strength</label>
                <div class="slider-container">
                  <input v-model.number="forceSettings.linkStrength" type="range" min="0.1" max="2" step="0.1"
                    class="control-slider" />
                  <span class="control-value">{{ forceSettings.linkStrength }}</span>
                </div>
              </div>

              <div class="control-group">
                <label>Repulsion Force</label>
                <div class="slider-container">
                  <input v-model.number="forceSettings.chargeStrength" type="range" min="-500" max="-10" step="10"
                    class="control-slider" />
                  <span class="control-value">{{ forceSettings.chargeStrength }}</span>
                </div>
              </div>

              <div class="control-group">
                <label>Center Attraction</label>
                <div class="slider-container">
                  <input v-model.number="forceSettings.centerStrength" type="range" min="0" max="1" step="0.05"
                    class="control-slider" />
                  <span class="control-value">{{ forceSettings.centerStrength }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Insights Tab -->
        <div v-if="activeTab === 'insights'" class="tab-panel insights-panel">
          <div v-if="clusteringStatus.clusters && clusteringStatus.clusters.length > 0" class="insights-content">
            <!-- Cluster Overview -->
            <div class="insights-section">
              <h4 class="insights-subtitle">Cluster Overview</h4>
              <div class="overview-stats">
                <div class="stat-card">
                  <div class="stat-icon">•</div>
                  <div class="stat-info">
                    <div class="stat-value">{{ clusteringStatus.clusters.length }}</div>
                    <div class="stat-label">Total Clusters</div>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon">◆</div>
                  <div class="stat-info">
                    <div class="stat-value">{{ getTotalWorkspaces() }}</div>
                    <div class="stat-label">Total Workspaces</div>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon">★</div>
                  <div class="stat-info">
                    <div class="stat-value">{{ getClusteringQuality() }}</div>
                    <div class="stat-label">Quality Score</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cluster Size Distribution -->
            <div class="insights-section">
              <h4 class="insights-subtitle">Cluster Size Distribution</h4>
              <div class="cluster-sizes">
                <div v-for="(cluster, index) in clusteringStatus.clusters" :key="cluster.id" class="cluster-bar">
                  <div class="cluster-info">
                    <span class="cluster-name">{{ cluster.title || `Cluster ${index + 1}` }}</span>
                    <span class="cluster-count">{{ cluster.size || cluster.workspaces?.length || 0 }}</span>
                  </div>
                  <div class="cluster-bar-track">
                    <div class="cluster-bar-fill" :style="{
                      width: (cluster.size || cluster.workspaces?.length || 0) / Math.max(...clusteringStatus.clusters.map(c => c.size || c.workspaces?.length || 0)) * 100 + '%',
                      backgroundColor: getClusterColor(index)
                    }"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cluster Balance Analysis -->
            <div class="insights-section">
              <h4 class="insights-subtitle">Balance Analysis</h4>
              <div class="balance-metrics">
                <div class="balance-metric">
                  <span class="metric-label">Largest Cluster</span>
                  <span class="metric-value">{{ getLargestClusterSize() }} workspaces</span>
                </div>
                <div class="balance-metric">
                  <span class="metric-label">Smallest Cluster</span>
                  <span class="metric-value">{{ getSmallestClusterSize() }} workspaces</span>
                </div>
                <div class="balance-metric">
                  <span class="metric-label">Average Size</span>
                  <span class="metric-value">{{ getAverageClusterSize() }} workspaces</span>
                </div>
                <div class="balance-metric">
                  <span class="metric-label">Balance Score</span>
                  <span class="metric-value balance-score" :class="getBalanceScoreClass()">{{ getBalanceScore()
                    }}</span>
                </div>
              </div>
            </div>

            <!-- Topic Coherence -->
            <div class="insights-section">
              <h4 class="insights-subtitle">Topic Coherence</h4>
              <div class="coherence-list">
                <div v-for="(cluster, index) in clusteringStatus.clusters" :key="cluster.id" class="coherence-item">
                  <div class="coherence-header">
                    <span class="coherence-cluster">{{ cluster.title || `Cluster ${index + 1}` }}</span>
                    <span class="coherence-score" :class="getCoherenceScoreClass(getCoherenceScore(cluster))">
                      {{ getCoherenceScore(cluster) }}%
                    </span>
                  </div>
                  <div class="coherence-bar">
                    <div class="coherence-fill" :style="{
                      width: getCoherenceScore(cluster) + '%',
                      backgroundColor: getCoherenceColor(getCoherenceScore(cluster))
                    }"></div>
                  </div>
                  <div class="coherence-tags">
                    <span v-for="tag in cluster.commonTags?.slice(0, 3)" :key="tag.id" class="coherence-tag">
                      {{ tag.name }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Recommendations -->
            <div class="insights-section">
              <h4 class="insights-subtitle">Recommendations</h4>
              <div class="recommendations">
                <div v-for="recommendation in getRecommendations()" :key="recommendation.id"
                  class="recommendation-item">
                  <div class="recommendation-icon">{{ recommendation.icon }}</div>
                  <div class="recommendation-content">
                    <div class="recommendation-title">{{ recommendation.title }}</div>
                    <div class="recommendation-description">{{ recommendation.description }}</div>
                  </div>
                  <div class="recommendation-action">
                    <button @click="applyRecommendation(recommendation)" class="recommendation-btn">
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state for insights -->
          <div v-else class="insights-placeholder">
            <BarChart class="w-12 h-12 opacity-30" />
            <h4>No Cluster Data Available</h4>
            <p>Run clustering analysis to see detailed insights and statistics.</p>
            <button @click="activeTab = 'settings'" class="placeholder-btn">
              Go to Settings
            </button>
          </div>
        </div>

        <!-- Export Tab -->
        <div v-if="activeTab === 'export'" class="tab-panel export-panel">
          <div v-if="clusteringStatus.clusters && clusteringStatus.clusters.length > 0" class="export-content">
            <!-- Data Export Section -->
            <div class="export-section">
              <h4 class="export-subtitle">Data Export</h4>
              <div class="export-options">
                <div class="export-option">
                  <div class="export-info">
                    <div class="export-format">
                      <span class="format-icon">▪</span>
                      <strong>Cluster Data (JSON)</strong>
                    </div>
                    <span class="export-description">Complete cluster information with metadata</span>
                  </div>
                  <button @click="exportData('clusters', 'json')" class="export-btn">
                    <Download :size="14" />
                    Export
                  </button>
                </div>

                <div class="export-option">
                  <div class="export-info">
                    <div class="export-format">
                      <span class="format-icon">📄</span>
                      <strong>Workspace List (CSV)</strong>
                    </div>
                    <span class="export-description">Spreadsheet-friendly workspace data</span>
                  </div>
                  <button @click="exportData('workspaces', 'csv')" class="export-btn">
                    <Download :size="14" />
                    Export
                  </button>
                </div>

                <div class="export-option">
                  <div class="export-info">
                    <div class="export-format">
                      <span class="format-icon">🔗</span>
                      <strong>Relationships (JSON)</strong>
                    </div>
                    <span class="export-description">Connections and similarity data</span>
                  </div>
                  <button @click="exportData('relationships', 'json')" class="export-btn">
                    <Download :size="14" />
                    Export
                  </button>
                </div>

                <div class="export-option">
                  <div class="export-info">
                    <div class="export-format">
                      <span class="format-icon">📋</span>
                      <strong>Statistics Report (XML)</strong>
                    </div>
                    <span class="export-description">Detailed analytics and metrics</span>
                  </div>
                  <button @click="exportData('statistics', 'xml')" class="export-btn">
                    <Download :size="14" />
                    Export
                  </button>
                </div>
              </div>
            </div>

            <!-- Visualization Export Section -->
            <div class="export-section">
              <h4 class="export-subtitle">Visualization Export</h4>
              <div class="export-options">
                <div class="export-option">
                  <div class="export-info">
                    <div class="export-format">
                      <span class="format-icon">🖼️</span>
                      <strong>Graph Image (PNG)</strong>
                    </div>
                    <span class="export-description">High-resolution graph visualization</span>
                  </div>
                  <button @click="exportVisualization('png')" class="export-btn" :disabled="!canExportVisualization">
                    <Download :size="14" />
                    Export
                  </button>
                </div>

                <div class="export-option">
                  <div class="export-info">
                    <div class="export-format">
                      <span class="format-icon">🎨</span>
                      <strong>Vector Graphics (SVG)</strong>
                    </div>
                    <span class="export-description">Scalable vector format for editing</span>
                  </div>
                  <button @click="exportVisualization('svg')" class="export-btn" :disabled="!canExportVisualization">
                    <Download :size="14" />
                    Export
                  </button>
                </div>

                <div class="export-option">
                  <div class="export-info">
                    <div class="export-format">
                      <span class="format-icon">📄</span>
                      <strong>Document (PDF)</strong>
                    </div>
                    <span class="export-description">Professional report format</span>
                  </div>
                  <button @click="exportVisualization('pdf')" class="export-btn" :disabled="!canExportVisualization">
                    <Download :size="14" />
                    Export
                  </button>
                </div>
              </div>
            </div>

            <!-- Export Configuration -->
            <div class="export-section">
              <h4 class="export-subtitle">Export Settings</h4>
              <div class="export-settings">
                <div class="setting-group">
                  <label class="setting-label">
                    <input type="checkbox" v-model="exportSettings.includeMetadata" />
                    <span>Include metadata and timestamps</span>
                  </label>
                </div>
                <div class="setting-group">
                  <label class="setting-label">
                    <input type="checkbox" v-model="exportSettings.includeStatistics" />
                    <span>Include clustering statistics</span>
                  </label>
                </div>
                <div class="setting-group">
                  <label class="setting-label">
                    <input type="checkbox" v-model="exportSettings.prettifyJson" />
                    <span>Format JSON for readability</span>
                  </label>
                </div>
                <div class="setting-group">
                  <label class="setting-label">
                    <input type="checkbox" v-model="exportSettings.includeVisualizationSettings" />
                    <span>Include visualization parameters</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Batch Export -->
            <div class="export-section">
              <h4 class="export-subtitle">Batch Export</h4>
              <div class="batch-export">
                <div class="batch-info">
                  <span class="batch-description">
                    Export all data formats and visualizations in a single archive
                  </span>
                </div>
                <button @click="exportBatch()" class="batch-export-btn" :disabled="batchExportProgress.isExporting">
                  <div v-if="batchExportProgress.isExporting" class="batch-progress">
                    <span class="progress-spinner">⏳</span>
                    <span>{{ batchExportProgress.currentStep }} ({{ batchExportProgress.progress }}%)</span>
                  </div>
                  <div v-else class="batch-ready">
                    <Download :size="16" />
                    <span>Export Complete Package</span>
                  </div>
                </button>
                <div v-if="batchExportProgress.isExporting" class="batch-progress-bar">
                  <div class="batch-progress-fill" :style="{ width: batchExportProgress.progress + '%' }"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state for export -->
          <div v-else class="export-placeholder">
            <Download class="w-12 h-12 opacity-30" />
            <h4>Export & Share</h4>
            <p>Run clustering analysis to enable data and visualization export.</p>
            <button @click="activeTab = 'settings'" class="placeholder-btn">
              Go to Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onBeforeUnmount, watch } from 'vue';
import { GitBranch, RefreshCw, Maximize2, Settings, RotateCcw, Circle, Zap, Magnet, Info, BarChart, Download } from 'lucide-vue-next';
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
const activeTab = ref('info'); // Tab management
const is3DEnabled = ref(false); // 3D mode toggle

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

// Advanced clustering settings
const clusteringSettings = reactive({
  algorithm: 'kmeans',
  numClusters: 5,
  minClusterSize: 2,
  maxClusters: 15,
  minClusters: 3,
  dbscanEps: 0.5,
  dbscanMinSamples: 3,
  includeOutliers: true,
  qualityTarget: 'balanced',
  autoOptimize: false
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

// Multi-resolution clustering state
const multiResolutionState = reactive({
  currentResolution: parseInt(localStorage.getItem('tangent_clustering_resolution') || '5'),
  isLoadingResolution: false,
  availableResolutions: [] as number[],
  cacheStatus: {
    version: 0,
    isStale: false,
    lastUpdated: null as Date | null,
    cachedResolutions: [] as number[]
  }
});

// Compute dynamic cluster limits based on workspace count
const clusterLimits = computed(() => {
  const workspaceCount = clusteringStatus.total_workspaces || 0;

  if (workspaceCount <= 10) {
    return { min: 2, max: 5 };
  } else if (workspaceCount <= 25) {
    return { min: 2, max: 10 };
  } else if (workspaceCount <= 50) {
    return { min: 2, max: 15 };
  } else if (workspaceCount <= 100) {
    return { min: 2, max: 25 };
  } else if (workspaceCount <= 250) {
    return { min: 2, max: 50 };
  } else {
    return { min: 2, max: 100 };
  }
});

// Update current resolution to be within dynamic limits
watch(clusterLimits, (newLimits) => {
  if (multiResolutionState.currentResolution < newLimits.min) {
    multiResolutionState.currentResolution = newLimits.min;
  } else if (multiResolutionState.currentResolution > newLimits.max) {
    multiResolutionState.currentResolution = newLimits.max;
  }
}, { immediate: true });

// Error handling
const errorMessage = ref<string | null>(null);
const workspaceCount = ref<number | null>(null);

// Mock graph stats - would be real data in implementation
const graphStats = ref({
  nodes: 24,
  links: 31,
  clusters: 5
});

// Export settings and state
const exportSettings = reactive({
  includeMetadata: true,
  includeStatistics: true,
  prettifyJson: true,
  includeVisualizationSettings: false
});

const batchExportProgress = reactive({
  isExporting: false,
  progress: 0,
  currentStep: '',
  totalSteps: 0
});

const canExportVisualization = computed(() => {
  return clusteringStatus.clusters && clusteringStatus.clusters.length > 0 && !clusteringStatus.is_running;
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

// Force settings are reactive and will update the graph automatically

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
};

const applyAndSave = () => {
  // Settings are reactive and save automatically
  console.log('Force settings applied:', forceSettings);
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

const toggle3D = () => {
  is3DEnabled.value = !is3DEnabled.value;
  console.log('3D mode:', is3DEnabled.value);
  console.log('Passing enable-3d prop as:', is3DEnabled.value);
};

// Clustering methods
const startClustering = async () => {
  try {
    errorMessage.value = null; // Clear any previous errors

    // Ensure we have workspace count
    if (workspaceCount.value === null || workspaceCount.value < 2) {
      errorMessage.value = 'Cannot start clustering: insufficient workspaces or data not loaded yet.';
      return;
    }

    // Adaptive clustering based on workspace count
    const adaptiveNClusters = Math.min(5, Math.max(2, Math.floor(workspaceCount.value / 2)));

    await clusteringService.startClustering({
      method: 'kmeans',
      n_clusters: adaptiveNClusters
    });
    console.log(`Starting clustering process with ${adaptiveNClusters} clusters for ${workspaceCount.value} workspaces`);
  } catch (error) {
    console.error('Failed to start clustering:', error);

    // Parse specific error messages
    const errorMsg = error instanceof Error ? error.message : 'Failed to start clustering analysis';
    if (errorMsg.includes('should be >=')) {
      errorMessage.value = `Not enough workspaces for clustering. You have ${workspaceCount.value} workspace(s) but need at least 2.`;
    } else if (errorMsg.includes('No valid content')) {
      errorMessage.value = 'Your workspaces don\'t contain enough content for analysis. Add more conversations first.';
    } else {
      errorMessage.value = errorMsg;
    }
  }
};

const retryClusteringWithError = async () => {
  errorMessage.value = null;
  await startClustering();
};

// Enhanced clustering methods with auto-optimization
const recomputeClusters = async () => {
  try {
    errorMessage.value = null;

    // Validate cluster count against workspace count
    if (workspaceCount.value === null || workspaceCount.value < 2) {
      errorMessage.value = 'Cannot start clustering: insufficient workspaces or data not loaded yet.';
      return;
    }

    const maxPossibleClusters = Math.max(2, workspaceCount.value - 1);
    const adjustedNumClusters = Math.min(clusteringSettings.numClusters, maxPossibleClusters);

    if (adjustedNumClusters !== clusteringSettings.numClusters) {
      console.warn(`Adjusted clusters from ${clusteringSettings.numClusters} to ${adjustedNumClusters} based on ${workspaceCount.value} workspaces`);
    }

    // Prepare parameters including advanced settings
    const params: any = {
      method: clusteringSettings.algorithm as 'kmeans' | 'dbscan',
      n_clusters: adjustedNumClusters,
      eps: clusteringSettings.dbscanEps,
      min_samples: clusteringSettings.dbscanMinSamples
    };

    // Add auto-optimization parameters if enabled
    if (clusteringSettings.autoOptimize) {
      params.autoOptimize = true;
      params.minClusters = clusteringSettings.minClusters;
      params.maxClusters = clusteringSettings.maxClusters;
      params.qualityTarget = clusteringSettings.qualityTarget;
    }

    console.log('Recomputing clusters with parameters:', params);

    // Start clustering with all parameters
    await clusteringService.startClustering(params);

  } catch (error) {
    console.error('Failed to recompute clusters:', error);
    errorMessage.value = error instanceof Error ? error.message : 'Failed to recompute clusters';
  }
};


const resetClusteringSettings = () => {
  Object.assign(clusteringSettings, {
    algorithm: 'kmeans',
    numClusters: 5,
    minClusterSize: 2,
    maxClusters: 15,
    minClusters: 3,
    dbscanEps: 0.5,
    dbscanMinSamples: 3,
    includeOutliers: true,
    qualityTarget: 'balanced',
    autoOptimize: false
  });
};

// Multi-resolution clustering methods
const checkCacheStatus = async () => {
  try {
    const response = await fetch('http://127.0.0.1:5050/api/clustering/cache/status');
    if (response.ok) {
      const status = await response.json();
      multiResolutionState.cacheStatus = {
        version: status.cache_version,
        isStale: status.cache_is_stale,
        lastUpdated: status.last_updated ? new Date(status.last_updated) : null,
        cachedResolutions: status.cached_resolutions || []
      };
      multiResolutionState.availableResolutions = status.cached_resolutions || [];
    }
  } catch (error) {
    console.error('Failed to check cache status:', error);
  }
};

const switchToResolution = async (targetResolution: number) => {
  if (multiResolutionState.isLoadingResolution) return;

  try {
    multiResolutionState.isLoadingResolution = true;

    // Check if this resolution is already cached
    if (multiResolutionState.availableResolutions.includes(targetResolution)) {
      // Load from cache
      const response = await fetch(`http://127.0.0.1:5050/api/clustering/resolution/${targetResolution}?method=${clusteringSettings.algorithm}`);
      if (response.ok) {
        const result = await response.json();
        clusteringStatus.clusters = result.clusters || [];
        multiResolutionState.currentResolution = targetResolution;
        localStorage.setItem('tangent_clustering_resolution', targetResolution.toString());

        // Update graph stats
        graphStats.value.clusters = result.clusters?.length || 0;
        graphStats.value.nodes = result.clusters?.reduce((total, cluster) =>
          total + (cluster.size || cluster.workspaces?.length || 0), 0) || 0;

        console.log(`Switched to ${targetResolution}-cluster resolution from cache`);
        return;
      }
    }

    // Generate new resolution if not cached
    const response = await fetch('http://127.0.0.1:5050/api/clustering/multi-resolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_resolutions: [targetResolution],
        method: clusteringSettings.algorithm,
        eps: clusteringSettings.dbscanEps,
        min_samples: clusteringSettings.dbscanMinSamples
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.resolutions && result.resolutions[targetResolution]) {
        clusteringStatus.clusters = result.resolutions[targetResolution].clusters || [];
        multiResolutionState.currentResolution = targetResolution;
        localStorage.setItem('tangent_clustering_resolution', targetResolution.toString());

        // Update available resolutions
        if (!multiResolutionState.availableResolutions.includes(targetResolution)) {
          multiResolutionState.availableResolutions.push(targetResolution);
          multiResolutionState.availableResolutions.sort((a, b) => a - b);
        }

        // Update graph stats
        graphStats.value.clusters = result.resolutions[targetResolution].clusters?.length || 0;
        graphStats.value.nodes = result.resolutions[targetResolution].clusters?.reduce((total, cluster) =>
          total + (cluster.size || cluster.workspaces?.length || 0), 0) || 0;

        console.log(`Generated and switched to ${targetResolution}-cluster resolution`);
      }
    }
  } catch (error) {
    console.error('Failed to switch resolution:', error);
    errorMessage.value = `Failed to switch to ${targetResolution} clusters`;
  } finally {
    multiResolutionState.isLoadingResolution = false;
  }
};

const generateMultipleResolutions = async () => {
  try {
    const limits = clusterLimits.value;
    const resolutions = [];

    // Generate key resolution points
    for (let i = limits.min; i <= limits.max; i += Math.max(1, Math.floor((limits.max - limits.min) / 10))) {
      resolutions.push(i);
    }

    // Always include the current resolution
    if (!resolutions.includes(multiResolutionState.currentResolution)) {
      resolutions.push(multiResolutionState.currentResolution);
    }

    const response = await fetch('http://127.0.0.1:5050/api/clustering/multi-resolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_resolutions: resolutions,
        method: clusteringSettings.algorithm,
        eps: clusteringSettings.dbscanEps,
        min_samples: clusteringSettings.dbscanMinSamples
      })
    });

    if (response.ok) {
      const result = await response.json();
      multiResolutionState.availableResolutions = Object.keys(result.resolutions || {}).map(Number).sort((a, b) => a - b);
      console.log(`Generated ${multiResolutionState.availableResolutions.length} resolution variations`);
    }
  } catch (error) {
    console.error('Failed to generate multiple resolutions:', error);
  }
};

const invalidateCache = async () => {
  try {
    const response = await fetch('http://127.0.0.1:5050/api/clustering/cache/invalidate', {
      method: 'POST'
    });
    if (response.ok) {
      multiResolutionState.availableResolutions = [];
      multiResolutionState.cacheStatus.cachedResolutions = [];
      multiResolutionState.cacheStatus.isStale = false;
      console.log('Cache invalidated successfully');
    }
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
  }
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

// Enhanced loading state methods
const getLoadingTitle = () => {
  if (clusteringSettings.autoOptimize) {
    return 'Optimizing Clustering Parameters...';
  }
  return clusteringStatus.status_message || 'Processing workspaces...';
};

const getPhaseIcon = () => {
  const progress = clusteringStatus.progress || 0;
  if (progress < 0.3) return '•';
  if (progress < 0.7) return '••';
  return '•••';
};

const getPhaseText = () => {
  const progress = clusteringStatus.progress || 0;
  if (clusteringSettings.autoOptimize) {
    if (progress < 0.3) return 'Analyzing workspace content';
    if (progress < 0.7) return 'Testing cluster configurations';
    return 'Optimizing final parameters';
  } else {
    if (progress < 0.3) return 'Analyzing workspace content';
    if (progress < 0.7) return 'Computing similarity matrices';
    return 'Generating clusters';
  }
};

// Insights panel methods
const getTotalWorkspaces = () => {
  return clusteringStatus.clusters?.reduce((total, cluster) =>
    total + (cluster.size || cluster.workspaces?.length || 0), 0) || 0;
};

const getClusteringQuality = () => {
  // Mock clustering quality score (0-100)
  const balance = getBalanceScore();
  const avgCoherence = clusteringStatus.clusters?.reduce((sum, cluster) =>
    sum + getCoherenceScore(cluster), 0) / (clusteringStatus.clusters?.length || 1) || 0;
  return Math.round((balance + avgCoherence) / 2);
};

const getLargestClusterSize = () => {
  return Math.max(...(clusteringStatus.clusters?.map(c => c.size || c.workspaces?.length || 0) || [0]));
};

const getSmallestClusterSize = () => {
  return Math.min(...(clusteringStatus.clusters?.map(c => c.size || c.workspaces?.length || 0) || [0]));
};

const getAverageClusterSize = () => {
  const total = getTotalWorkspaces();
  const count = clusteringStatus.clusters?.length || 1;
  return Math.round(total / count);
};

const getBalanceScore = () => {
  const sizes = clusteringStatus.clusters?.map(c => c.size || c.workspaces?.length || 0) || [];
  if (sizes.length === 0) return 0;

  const avg = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
  const variance = sizes.reduce((sum, size) => sum + Math.pow(size - avg, 2), 0) / sizes.length;
  const coefficient = Math.sqrt(variance) / avg;

  // Convert to 0-100 scale (lower coefficient = higher balance)
  return Math.max(0, Math.min(100, Math.round(100 - (coefficient * 100))));
};

const getBalanceScoreClass = () => {
  const score = getBalanceScore();
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
};

const getCoherenceScore = (cluster: any) => {
  // Mock coherence score based on cluster characteristics
  const baseScore = 60 + Math.random() * 30;
  const tagBonus = (cluster.commonTags?.length || 0) * 5;
  return Math.min(100, Math.round(baseScore + tagBonus));
};

const getCoherenceScoreClass = (score: number) => {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
};

const getCoherenceColor = (score: number) => {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#ef4444';
};

const getClusterColor = (index: number) => {
  const colors = ['#d946ef', '#a855f7', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6'];
  return colors[index % colors.length];
};

const getRecommendations = () => {
  const recommendations = [];

  // Balance recommendation
  const balanceScore = getBalanceScore();
  if (balanceScore < 60) {
    recommendations.push({
      id: 'balance',
      icon: '⚖️',
      title: 'Improve Cluster Balance',
      description: 'Consider adjusting the number of clusters to achieve better balance',
      action: 'adjustClusters'
    });
  }

  // Coherence recommendation
  const avgCoherence = clusteringStatus.clusters?.reduce((sum, cluster) =>
    sum + getCoherenceScore(cluster), 0) / (clusteringStatus.clusters?.length || 1) || 0;
  if (avgCoherence < 70) {
    recommendations.push({
      id: 'coherence',
      icon: '→',
      title: 'Enhance Topic Coherence',
      description: 'Try adjusting algorithm parameters for more coherent clusters',
      action: 'optimizeCoherence'
    });
  }

  // Auto-optimization recommendation
  if (!clusteringSettings.autoOptimize) {
    recommendations.push({
      id: 'optimize',
      icon: '🚀',
      title: 'Try Auto-Optimization',
      description: 'Let the system find optimal clustering parameters automatically',
      action: 'enableAutoOptimize'
    });
  }

  return recommendations;
};

const applyRecommendation = (recommendation: any) => {
  switch (recommendation.action) {
    case 'adjustClusters':
      activeTab.value = 'settings';
      break;
    case 'optimizeCoherence':
      activeTab.value = 'settings';
      break;
    case 'enableAutoOptimize':
      clusteringSettings.autoOptimize = true;
      activeTab.value = 'settings';
      break;
  }
};

// Export methods
const exportData = async (type: string, format: string) => {
  try {
    let data: any;
    let filename: string;

    switch (type) {
      case 'clusters':
        data = generateClustersData();
        filename = `tangent-clusters-${new Date().toISOString().split('T')[0]}.${format}`;
        break;
      case 'workspaces':
        data = generateWorkspacesData();
        filename = `tangent-workspaces-${new Date().toISOString().split('T')[0]}.${format}`;
        break;
      case 'relationships':
        data = generateRelationshipsData();
        filename = `tangent-relationships-${new Date().toISOString().split('T')[0]}.${format}`;
        break;
      case 'statistics':
        data = generateStatisticsData();
        filename = `tangent-statistics-${new Date().toISOString().split('T')[0]}.${format}`;
        break;
      default:
        throw new Error('Unknown export type');
    }

    const formattedData = formatExportData(data, format);
    downloadFile(formattedData, filename, getMimeType(format));
  } catch (error) {
    console.error('Export failed:', error);
    errorMessage.value = `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

const exportVisualization = async (format: string) => {
  try {
    if (!forceGraphRef.value) {
      throw new Error('Graph visualization not available');
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `tangent-graph-${timestamp}.${format}`;

    // This would interface with the ForceGraph component's export functionality
    // For now, we'll simulate the export
    const exportData = await simulateVisualizationExport(format);
    downloadFile(exportData, filename, getMimeType(format));
  } catch (error) {
    console.error('Visualization export failed:', error);
    errorMessage.value = `Visualization export failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

const exportBatch = async () => {
  try {
    batchExportProgress.isExporting = true;
    batchExportProgress.progress = 0;
    batchExportProgress.totalSteps = 7;

    const timestamp = new Date().toISOString().split('T')[0];
    const zipName = `tangent-complete-export-${timestamp}.zip`;

    // Step 1: Export clusters data
    batchExportProgress.currentStep = 'Exporting cluster data...';
    await sleep(500);
    const clustersData = generateClustersData();
    batchExportProgress.progress = 15;

    // Step 2: Export workspaces data
    batchExportProgress.currentStep = 'Exporting workspace data...';
    await sleep(500);
    const workspacesData = generateWorkspacesData();
    batchExportProgress.progress = 30;

    // Step 3: Export relationships
    batchExportProgress.currentStep = 'Exporting relationships...';
    await sleep(500);
    const relationshipsData = generateRelationshipsData();
    batchExportProgress.progress = 45;

    // Step 4: Export statistics
    batchExportProgress.currentStep = 'Generating statistics...';
    await sleep(500);
    const statisticsData = generateStatisticsData();
    batchExportProgress.progress = 60;

    // Step 5: Export visualizations
    batchExportProgress.currentStep = 'Capturing visualizations...';
    await sleep(800);
    const visualizationData = await simulateVisualizationExport('png');
    batchExportProgress.progress = 80;

    // Step 6: Create archive
    batchExportProgress.currentStep = 'Creating archive...';
    await sleep(500);
    const archiveData = await createExportArchive({
      clusters: clustersData,
      workspaces: workspacesData,
      relationships: relationshipsData,
      statistics: statisticsData,
      visualization: visualizationData
    });
    batchExportProgress.progress = 95;

    // Step 7: Download
    batchExportProgress.currentStep = 'Finalizing download...';
    await sleep(300);
    downloadFile(archiveData, zipName, 'application/zip');
    batchExportProgress.progress = 100;

    // Reset after completion
    setTimeout(() => {
      batchExportProgress.isExporting = false;
      batchExportProgress.progress = 0;
      batchExportProgress.currentStep = '';
    }, 1000);
  } catch (error) {
    console.error('Batch export failed:', error);
    batchExportProgress.isExporting = false;
    errorMessage.value = `Batch export failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

// Data generation methods
const generateClustersData = () => {
  const baseData = {
    clusters: clusteringStatus.clusters || [],
    algorithm: clusteringSettings.algorithm,
    totalClusters: clusteringStatus.clusters?.length || 0,
    totalWorkspaces: getTotalWorkspaces(),
    qualityScore: getClusteringQuality()
  };

  if (exportSettings.includeMetadata) {
    baseData.metadata = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      settings: clusteringSettings
    };
  }

  if (exportSettings.includeStatistics) {
    baseData.statistics = {
      balanceScore: getBalanceScore(),
      averageClusterSize: getAverageClusterSize(),
      largestCluster: getLargestClusterSize(),
      smallestCluster: getSmallestClusterSize(),
      coherenceScores: clusteringStatus.clusters?.map(cluster => ({
        clusterId: cluster.id,
        score: getCoherenceScore(cluster)
      })) || []
    };
  }

  if (exportSettings.includeVisualizationSettings) {
    baseData.visualizationSettings = {
      layout: currentLayout.value,
      forceSettings: { ...forceSettings }
    };
  }

  return baseData;
};

const generateWorkspacesData = () => {
  const workspaces = [];

  clusteringStatus.clusters?.forEach((cluster, clusterIndex) => {
    cluster.workspaces?.forEach(workspace => {
      workspaces.push({
        id: workspace.id,
        title: workspace.title,
        clusterId: cluster.id,
        clusterTitle: cluster.title || `Cluster ${clusterIndex + 1}`,
        nodeCount: workspace.nodeCount,
        lastUpdated: workspace.lastUpdated,
        tags: workspace.tags || [],
        ...(exportSettings.includeMetadata && {
          metadata: {
            exportDate: new Date().toISOString(),
            clusterIndex: clusterIndex + 1
          }
        })
      });
    });
  });

  return { workspaces };
};

const generateRelationshipsData = () => {
  const relationships = [];

  // Generate mock relationships between clusters and workspaces
  clusteringStatus.clusters?.forEach(cluster => {
    cluster.workspaces?.forEach(workspace => {
      // Mock similarity connections
      const similarityConnections = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < similarityConnections; i++) {
        relationships.push({
          source: workspace.id,
          target: `workspace_${Math.floor(Math.random() * 100)}`,
          type: 'similarity',
          strength: Math.random() * 0.8 + 0.2,
          clusterId: cluster.id
        });
      }
    });
  });

  return { relationships };
};

const generateStatisticsData = () => {
  return {
    overview: {
      totalClusters: clusteringStatus.clusters?.length || 0,
      totalWorkspaces: getTotalWorkspaces(),
      qualityScore: getClusteringQuality(),
      algorithm: clusteringSettings.algorithm
    },
    clusterDistribution: clusteringStatus.clusters?.map((cluster, index) => ({
      clusterId: cluster.id,
      title: cluster.title || `Cluster ${index + 1}`,
      size: cluster.size || cluster.workspaces?.length || 0,
      coherenceScore: getCoherenceScore(cluster),
      commonTags: cluster.commonTags || []
    })) || [],
    balanceAnalysis: {
      balanceScore: getBalanceScore(),
      averageSize: getAverageClusterSize(),
      largestCluster: getLargestClusterSize(),
      smallestCluster: getSmallestClusterSize(),
      variance: calculateClusterVariance()
    },
    recommendations: getRecommendations(),
    ...(exportSettings.includeMetadata && {
      metadata: {
        exportDate: new Date().toISOString(),
        settings: clusteringSettings
      }
    })
  };
};

// Helper methods
const formatExportData = (data: any, format: string) => {
  switch (format) {
    case 'json':
      return exportSettings.prettifyJson ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    case 'csv':
      return convertToCSV(data);
    case 'xml':
      return convertToXML(data);
    default:
      return JSON.stringify(data);
  }
};

const convertToCSV = (data: any) => {
  if (data.workspaces) {
    const headers = ['ID', 'Title', 'Cluster ID', 'Cluster Title', 'Node Count', 'Last Updated'];
    const rows = data.workspaces.map((workspace: any) => [
      workspace.id,
      workspace.title,
      workspace.clusterId,
      workspace.clusterTitle,
      workspace.nodeCount,
      workspace.lastUpdated
    ]);
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
  return 'No CSV data available';
};

const convertToXML = (data: any) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<tangent-export>
  <export-date>${new Date().toISOString()}</export-date>
  <statistics>
    <total-clusters>${data.overview?.totalClusters || 0}</total-clusters>
    <total-workspaces>${data.overview?.totalWorkspaces || 0}</total-workspaces>
    <quality-score>${data.overview?.qualityScore || 0}</quality-score>
    <algorithm>${data.overview?.algorithm || 'unknown'}</algorithm>
  </statistics>
</tangent-export>`;
};

const getMimeType = (format: string) => {
  switch (format) {
    case 'json': return 'application/json';
    case 'csv': return 'text/csv';
    case 'xml': return 'application/xml';
    case 'png': return 'image/png';
    case 'svg': return 'image/svg+xml';
    case 'pdf': return 'application/pdf';
    case 'zip': return 'application/zip';
    default: return 'application/octet-stream';
  }
};

const downloadFile = (data: any, filename: string, mimeType: string) => {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const simulateVisualizationExport = async (format: string) => {
  // Simulate visualization export - in a real implementation, this would
  // capture the actual graph visualization from the ForceGraph component
  await sleep(1000);
  return `Mock ${format.toUpperCase()} visualization data`;
};

const createExportArchive = async (data: any) => {
  // Simulate creating a ZIP archive - in a real implementation, this would
  // use a library like JSZip to create an actual archive
  await sleep(500);
  return `Mock ZIP archive containing: ${Object.keys(data).join(', ')}`;
};

const calculateClusterVariance = () => {
  const sizes = clusteringStatus.clusters?.map(c => c.size || c.workspaces?.length || 0) || [];
  if (sizes.length === 0) return 0;

  const avg = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
  return sizes.reduce((sum, size) => sum + Math.pow(size - avg, 2), 0) / sizes.length;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Cleanup
let statusUnsubscribe: (() => void) | null = null;

onMounted(async () => {
  // Fetch workspace count
  try {
    const response = await fetch('http://127.0.0.1:5050/chats');
    if (response.ok) {
      const chats = await response.json();
      workspaceCount.value = chats.length;
    }
  } catch (error) {
    console.error('Failed to fetch workspace count:', error);
    workspaceCount.value = 0;
  }

  // Subscribe to clustering status updates
  statusUnsubscribe = clusteringService.onStatusUpdate((status) => {
    Object.assign(clusteringStatus, status);

    // Handle clustering errors
    if (status.status_message && status.status_message.toLowerCase().includes('no valid content')) {
      errorMessage.value = `No meaningful content found for clustering analysis. Your ${workspaceCount.value || 'available'} workspace(s) may be empty or contain insufficient conversation data. Try adding more messages to your workspaces first.`;
      // Stop the clustering process
      clusteringStatus.is_running = false;
    } else if (status.status_message && status.status_message.toLowerCase().includes('error')) {
      errorMessage.value = status.status_message;
      clusteringStatus.is_running = false;
    }

    // Update multi-resolution state when clustering completes
    if (!status.is_running && status.clusters && status.clusters.length > 0) {
      // Update current resolution to match actual cluster count
      multiResolutionState.currentResolution = status.clusters.length;
      localStorage.setItem('tangent_clustering_resolution', status.clusters.length.toString());

      // Refresh cache status
      checkCacheStatus();

      console.log('Clustering completed with', status.clusters.length, 'clusters');
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

  // Initialize multi-resolution cache status
  await checkCacheStatus();

  // Load persisted resolution if available and different from current
  const savedResolution = parseInt(localStorage.getItem('tangent_clustering_resolution') || '5');
  if (savedResolution !== multiResolutionState.currentResolution &&
    clusteringStatus.clusters && clusteringStatus.clusters.length > 0) {
    // Try to load the saved resolution
    await switchToResolution(savedResolution);
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Shrink graph when viewing other tabs */
.graph-feature.tab-active .graph-container {
  flex: 0 0 50vh;
  min-height: 50vh;
  max-height: 50vh;
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Expand control panel when viewing other tabs */
.graph-feature.tab-active .control-panel {
  flex: 1;
  max-height: calc(100% - 50vh);
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
  align-self: center;
  min-width: 0;
  flex-direction: row;
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
  background: oklch(var(--p));
  color: oklch(var(--pc));
}

.stat-badge.workspaces {
  background: oklch(var(--s));
  color: oklch(var(--sc));
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
  background: oklch(var(--p));
  color: oklch(var(--pc));
  box-shadow: 0 2px 4px oklch(var(--p) / 0.3);
}

.layout-buttons {
  background: oklch(var(--b3));
}

.layout-btn {
  color: oklch(var(--bc));
}

.layout-btn:hover {
  background: oklch(var(--b2));
  color: oklch(var(--bc));
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
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border-color: oklch(var(--p));
}

.controls-btn {
  background: oklch(var(--b2));
  border: 1px solid oklch(var(--bc) / 0.1);
  color: oklch(var(--bc));
}

.controls-btn:hover {
  background: oklch(var(--b3));
  transform: translateY(-1px);
}

/* Force Controls */
.force-controls {
  padding: 16px;
}

.force-controls {
  background: oklch(var(--b1));
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
  color: oklch(var(--bc));
}

.theme-dark .force-controls-title {
  color: oklch(var(--bc));
}

.theme-cmyk .force-controls-title {
  color: oklch(var(--bc));
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
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.theme-light .force-btn.secondary:hover {
  background: oklch(var(--b1));
}

.theme-dark .force-btn.secondary {
  background: oklch(var(--bc) / 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: oklch(from oklch(var(--bc)) l c h / 0.8);
}

.theme-dark .force-btn.secondary:hover {
  background: oklch(var(--bc) / 0.2);
}

.theme-cmyk .force-btn.secondary {
  background: oklch(var(--bc) / 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: oklch(from oklch(var(--bc)) l c h / 0.8);
}

.theme-cmyk .force-btn.secondary:hover {
  background: oklch(var(--bc) / 0.2);
}

.force-btn.primary {
  background: oklch(var(--p));
  border-color: oklch(var(--p));
  color: oklch(var(--pc));
}

.force-btn.primary:hover {
  background: oklch(var(--pf));
  border-color: oklch(var(--pf));
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
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.theme-dark .control-group label {
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.theme-cmyk .control-group label {
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
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
  background: oklch(var(--b2));
}

.theme-dark .control-slider {
  background: oklch(var(--b2));
}

.theme-cmyk .control-slider {
  background: oklch(var(--b2));
}

.control-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: oklch(var(--p));
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
  color: oklch(var(--p));
  min-width: 40px;
  text-align: center;
  background: oklch(var(--p) / 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

/* Condensed Clustering Controls */
.clustering-controls-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  padding: 16px;
  background: oklch(var(--bc) / 0.02);
  border-radius: 8px;
  margin-bottom: 16px;
}

.control-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Algorithm Toggle */
.algorithm-toggle {
  display: flex;
  gap: 4px;
  padding: 2px;
  background: oklch(var(--bc) / 0.05);
  border-radius: 6px;
}

.algo-btn {
  flex: 1;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: oklch(var(--bc) / 0.7);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.algo-btn.active {
  background: oklch(var(--p));
  color: oklch(var(--pc));
}

/* Compact Resolution Control */
.resolution-control-compact {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.resolution-control-compact label {
  font-size: 11px;
  color: oklch(var(--bc) / 0.8);
  margin: 0;
}

.resolution-slider-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.compact-slider {
  flex: 1;
  height: 4px;
  background: oklch(var(--bc) / 0.1);
  border-radius: 2px;
  outline: none;
  border: none;
  cursor: pointer;
}

.compact-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  background: oklch(var(--p));
  border-radius: 50%;
  cursor: pointer;
}

.res-min,
.res-max {
  font-size: 10px;
  color: oklch(var(--bc) / 0.5);
  min-width: 12px;
  text-align: center;
}

.res-current {
  font-size: 11px;
  color: oklch(var(--p));
  font-weight: 600;
  min-width: 20px;
  text-align: center;
}

.cache-indicators {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cache-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: oklch(var(--su));
}

.mini-btn {
  width: 16px;
  height: 16px;
  border: none;
  background: oklch(var(--bc) / 0.1);
  color: oklch(var(--bc) / 0.6);
  border-radius: 50%;
  cursor: pointer;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.mini-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: oklch(var(--er));
}

/* Parameter Groups */
.param-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compact-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.compact-control label {
  font-size: 11px;
  color: oklch(var(--bc) / 0.8);
  min-width: 50px;
  margin: 0;
}

.compact-control .value {
  font-size: 11px;
  color: oklch(var(--p));
  font-weight: 600;
  min-width: 20px;
  text-align: center;
}

/* Quality Toggle */
.quality-toggle {
  display: flex;
  gap: 2px;
  background: oklch(var(--bc) / 0.05);
  border-radius: 4px;
  padding: 2px;
}

.quality-btn {
  flex: 1;
  padding: 4px 6px;
  border: none;
  background: transparent;
  color: oklch(var(--bc) / 0.6);
  border-radius: 2px;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.2s ease;
}

.quality-btn.active {
  background: oklch(var(--p));
  color: oklch(var(--pc));
}

/* Auto-Optimize Control */
.optimize-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggle-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toggle-switch input {
  display: none;
}

.toggle-slider {
  width: 32px;
  height: 16px;
  background: oklch(var(--bc) / 0.1);
  border-radius: 8px;
  position: relative;
  transition: all 0.2s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: all 0.2s ease;
}

.toggle-switch input:checked+.toggle-slider {
  background: oklch(var(--p));
}

.toggle-switch input:checked+.toggle-slider::before {
  transform: translateX(16px);
  background: white;
}

.toggle-label {
  font-size: 11px;
  color: oklch(var(--bc) / 0.8);
}

.optimize-range {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mini-input {
  width: 40px;
  padding: 2px 4px;
  border: 1px solid oklch(var(--bc) / 0.1);
  background: oklch(var(--bc) / 0.05);
  color: oklch(var(--bc) / 0.9);
  border-radius: 3px;
  font-size: 11px;
  text-align: center;
}

.optimize-range span {
  font-size: 10px;
  color: oklch(var(--bc) / 0.5);
}

/* Recompute Button */
.recompute-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.recompute-btn:hover {
  background: oklch(var(--pf));
}

.recompute-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Multi-Resolution Slider Styles */
.resolution-controls {
  background: oklch(var(--bc) / 0.03);
  border: 1px solid oklch(var(--bc) / 0.1);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.resolution-slider-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.resolution-slider {
  width: 100%;
  height: 6px;
  background: linear-gradient(90deg, oklch(var(--su)) 0%, oklch(var(--in)) 50%, oklch(var(--p)) 100%);
  border-radius: 3px;
  outline: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.resolution-slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.resolution-slider::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  background: white;
  border: 2px solid oklch(var(--in));
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.resolution-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
}

.resolution-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: oklch(var(--bc) / 0.7);
}

.resolution-value {
  font-weight: 600;
  color: oklch(var(--in));
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.resolution-label {
  font-size: 11px;
  color: oklch(var(--bc) / 0.5);
}

.setting-hint {
  margin-top: 4px;
  font-size: 11px;
}

.loading-hint {
  color: oklch(var(--wa));
  animation: pulse 1.5s infinite;
}

.cached-hint {
  color: oklch(var(--su));
}

.generate-hint {
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.cache-status {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.cache-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.cache-label {
  font-size: 12px;
  color: oklch(var(--bc) / 0.7);
}

.stale-warning {
  font-size: 11px;
  color: oklch(var(--wa));
  background: rgba(245, 158, 11, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.cache-actions {
  display: flex;
  gap: 8px;
}

.cache-btn {
  flex: 1;
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid oklch(var(--bc) / 0.2);
  border-radius: 4px;
  background: oklch(var(--bc) / 0.05);
  color: oklch(var(--bc) / 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
}

.cache-btn:hover {
  background: oklch(var(--bc) / 0.1);
  color: oklch(var(--pc));
}

.cache-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cache-btn.secondary {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: oklch(var(--er));
}

.cache-btn.secondary:hover {
  background: rgba(239, 68, 68, 0.2);
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.6;
  }
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

/* Enhanced Loading State */
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
  margin-bottom: 20px;
  color: oklch(var(--pc));
}

.loading-details {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 320px;
}

.loading-phase {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: oklch(var(--bc) / 0.1);
  border-radius: 20px;
  border: 1px solid oklch(var(--bc) / 0.2);
}

.phase-icon {
  font-size: 16px;
}

.phase-text {
  font-size: 13px;
  font-weight: 500;
  color: oklch(var(--bc) / 0.9);
}

.progress-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: oklch(var(--bc) / 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, oklch(var(--p)), oklch(var(--s)));
  transition: width 0.3s ease;
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, oklch(var(--bc) / 0.3), transparent);
  animation: shimmer 2s infinite;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-text {
  font-size: 14px;
  font-weight: 600;
  color: oklch(var(--p));
}

.workspace-counter {
  font-size: 12px;
  color: oklch(var(--bc) / 0.8);
}

.optimization-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: oklch(var(--p) / 0.1);
  border-radius: 8px;
  border: 1px solid oklch(var(--p) / 0.3);
  width: 100%;
}

.optimization-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: oklch(var(--p));
}

.optimization-icon {
  font-size: 14px;
}

.optimization-params {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: oklch(var(--bc) / 0.7);
}

.optimization-params span {
  background: oklch(var(--bc) / 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  align-self: flex-start;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
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
  background: oklch(var(--b1) / 0.9);
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
  color: oklch(var(--pc));
}

.graph-error-state p {
  color: oklch(var(--bc) / 0.8);
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
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  margin-top: 16px;
}

.retry-btn:hover {
  background: oklch(var(--pf));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(217, 70, 239, 0.3);
}

.retry-btn.error {
  background: oklch(var(--er));
}

.retry-btn.error:hover {
  background: oklch(var(--erf));
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  background: oklch(var(--bc) / 0.05);
  border-radius: 8px;
  padding: 4px;
  margin: 12px 16px;
  gap: 4px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  cursor: pointer;
  border-radius: 6px;
  background: transparent;
  transition: all 0.2s ease;
  position: relative;
  z-index: 1;
  font-size: 13px;
  font-weight: 500;
  flex: 1;
  justify-content: center;
  min-width: 0;
}

.tab-btn.active {
  background: oklch(var(--p));
  color: oklch(var(--pc));
  box-shadow: 0 2px 4px oklch(var(--p) / 0.3);
}

/* Tab buttons are now universally themed */

/* Tab Content */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tab-panel {
  animation: fadeIn 0.3s ease;
  flex: 1;
  padding: 16px;
  background: oklch(var(--bc) / 0.02);
  border-radius: 8px;
  overflow-y: auto;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Info Panel */
.info-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: oklch(var(--bc));
}

.info-description {
  font-size: 14px;
  line-height: 1.5;
  color: oklch(from oklch(var(--bc)) l c h / 0.8);
  margin: 0;
}

.info-subtitle {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: oklch(var(--bc));
}

.info-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.step-icon {
  font-size: 16px;
  width: 28px;
  height: 28px;
  text-align: center;
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
  font-size: 13px;
  line-height: 1.4;
  color: oklch(var(--bc));
}

.step-content strong {
  color: oklch(var(--bc));
  font-weight: 600;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: oklch(var(--bc));
}

.legend-item strong {
  color: oklch(var(--bc));
  font-weight: 600;
}

.legend-icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-icon.cluster-node {
  background: oklch(var(--p));
  width: 20px;
  height: 20px;
}

.legend-icon.workspace-node {
  background: #a855f7;
  width: 12px;
  height: 12px;
}

.legend-icon.connection-line {
  background: oklch(var(--s));
  border-radius: 1px;
  height: 2px;
  width: 20px;
}

.tips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.tip {
  padding: 8px 12px;
  background: oklch(var(--b2));
  border-radius: 6px;
  font-size: 12px;
  text-align: center;
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.2);
  color: oklch(var(--bc));
}

.tip strong {
  color: oklch(var(--bc));
  font-weight: 700;
}

/* Settings Panel */
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-subtitle {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: oklch(var(--bc));
}

.algorithm-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.algorithm-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid oklch(var(--bc) / 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.algorithm-option:hover {
  background: oklch(var(--bc) / 0.05);
}

.algorithm-option input[type="radio"] {
  accent-color: oklch(var(--p));
}

.algorithm-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.algorithm-info strong {
  font-size: 14px;
  font-weight: 600;
  color: oklch(var(--bc));
}

.algorithm-info span {
  font-size: 12px;
  color: oklch(var(--bc) / 0.7);
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 24px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-group label {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-container .control-slider {
  flex: 1;
}

.setting-hint {
  font-size: 11px;
  opacity: 0.6;
  font-style: italic;
}

.settings-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.settings-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  justify-content: center;
}

.settings-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-btn.primary {
  background: oklch(var(--p));
  border-color: oklch(var(--p));
  color: oklch(var(--pc));
}

.settings-btn.primary:hover:not(:disabled) {
  background: oklch(var(--pf));
  border-color: oklch(var(--pf));
}

.settings-btn.secondary {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.2);
  color: oklch(var(--bc) / 0.8);
}

.settings-btn.secondary:hover {
  background: oklch(var(--bc) / 0.1);
}

/* Advanced Settings Styles */
.quality-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.quality-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid oklch(var(--bc) / 0.1);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
}

.quality-option:hover {
  background: oklch(var(--bc) / 0.05);
}

.quality-option input[type="radio"] {
  accent-color: oklch(var(--p));
}

.toggle-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-container input[type="checkbox"] {
  accent-color: oklch(var(--p));
}

.toggle-container label {
  font-size: 13px;
  cursor: pointer;
  text-transform: none;
  letter-spacing: normal;
  color: oklch(var(--bc) / 0.8);
}

.optimization-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.optimization-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: oklch(var(--p));
}

.optimization-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.optimization-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid oklch(var(--bc) / 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.optimization-option:hover {
  background: oklch(var(--bc) / 0.05);
}

.optimization-option input[type="checkbox"] {
  accent-color: oklch(var(--p));
}

.optimization-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.optimization-info strong {
  font-size: 14px;
  font-weight: 600;
  color: oklch(var(--bc));
}

.optimization-info span {
  font-size: 12px;
  color: oklch(var(--bc) / 0.7);
}

.optimization-range {
  margin-top: 8px;
  padding-left: 24px;
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid oklch(var(--bc) / 0.2);
  border-radius: 4px;
  background: oklch(var(--bc) / 0.1);
  color: oklch(var(--pc));
  font-size: 12px;
  text-align: center;
}

.range-input:focus {
  outline: none;
  border-color: oklch(var(--p));
  box-shadow: 0 0 0 2px rgba(217, 70, 239, 0.2);
}

.range-inputs span {
  font-size: 12px;
  opacity: 0.7;
}

/* Insights Panel */
.insights-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.insights-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.insights-subtitle {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: oklch(var(--bc));
}

/* Overview Stats */
.overview-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: oklch(var(--bc) / 0.05);
  border-radius: 8px;
  border: 1px solid oklch(var(--bc) / 0.1);
}

.stat-icon {
  font-size: 20px;
  width: 32px;
  text-align: center;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: oklch(var(--bc));
}

.stat-label {
  font-size: 11px;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Cluster Size Distribution */
.cluster-sizes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cluster-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cluster-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.cluster-name {
  font-weight: 500;
}

.cluster-count {
  font-weight: 600;
  color: oklch(var(--p));
}

.cluster-bar-track {
  height: 8px;
  background: oklch(var(--bc) / 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.cluster-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Balance Analysis */
.balance-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.balance-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: oklch(var(--bc) / 0.05);
  border-radius: 6px;
}

.metric-label {
  font-size: 11px;
  color: oklch(var(--bc) / 0.7);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
  color: oklch(var(--bc));
}

.balance-score.excellent {
  color: oklch(var(--su));
}

.balance-score.good {
  color: oklch(var(--wa));
}

.balance-score.fair {
  color: oklch(var(--wa));
}

.balance-score.poor {
  color: oklch(var(--er));
}

/* Topic Coherence */
.coherence-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.coherence-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: oklch(var(--bc) / 0.05);
  border-radius: 8px;
  border: 1px solid oklch(var(--bc) / 0.1);
}

.coherence-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.coherence-cluster {
  font-size: 13px;
  font-weight: 500;
}

.coherence-score {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.coherence-score.excellent {
  background: rgba(16, 185, 129, 0.2);
  color: oklch(var(--su));
}

.coherence-score.good {
  background: rgba(245, 158, 11, 0.2);
  color: oklch(var(--wa));
}

.coherence-score.fair {
  background: rgba(249, 115, 22, 0.2);
  color: oklch(var(--wa));
}

.coherence-score.poor {
  background: rgba(239, 68, 68, 0.2);
  color: oklch(var(--er));
}

.coherence-bar {
  height: 4px;
  background: oklch(var(--bc) / 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.coherence-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.coherence-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.coherence-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: oklch(var(--p) / 0.2);
  color: oklch(var(--p));
  border-radius: 4px;
  border: 1px solid oklch(var(--p) / 0.3);
}

/* Recommendations */
.recommendations {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

@media (min-width: 768px) {
  .recommendations {
    grid-template-columns: 1fr 1fr;
  }
}

.recommendation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: oklch(var(--bc) / 0.05);
  border-radius: 8px;
  border: 1px solid oklch(var(--bc) / 0.1);
  transition: all 0.2s ease;
}

.recommendation-item:hover {
  background: oklch(var(--bc) / 0.08);
}

.recommendation-icon {
  font-size: 18px;
  width: 32px;
  text-align: center;
}

.recommendation-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.recommendation-title {
  font-size: 13px;
  font-weight: 600;
  color: oklch(var(--p));
}

.recommendation-description {
  font-size: 11px;
  opacity: 0.8;
  line-height: 1.4;
}

.recommendation-action {
  flex-shrink: 0;
}

.recommendation-btn {
  padding: 4px 12px;
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.recommendation-btn:hover {
  background: oklch(var(--pf));
  transform: translateY(-1px);
}

/* Export Panel */
.export-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.export-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.export-subtitle {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: oklch(var(--bc));
}

.export-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.export-option {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: oklch(var(--bc) / 0.05);
  border-radius: 8px;
  border: 1px solid oklch(var(--bc) / 0.1);
  transition: all 0.2s ease;
}

.export-option:hover {
  background: oklch(var(--bc) / 0.08);
}

.export-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.export-format {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: oklch(var(--bc));
}

.format-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.export-description {
  font-size: 11px;
  color: oklch(var(--bc) / 0.7);
  line-height: 1.3;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.export-btn:hover:not(:disabled) {
  background: oklch(var(--pf));
  transform: translateY(-1px);
}

.export-btn:disabled {
  background: oklch(var(--bc) / 0.1);
  color: oklch(var(--bc) / 0.4);
  cursor: not-allowed;
}

/* Export Settings */
.export-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: oklch(var(--bc) / 0.05);
  border-radius: 8px;
  border: 1px solid oklch(var(--bc) / 0.1);
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  cursor: pointer;
  color: oklch(var(--bc) / 0.8);
  transition: color 0.2s ease;
}

.setting-label:hover {
  color: oklch(var(--bc));
}

.setting-label input[type="checkbox"] {
  accent-color: oklch(var(--p));
}

/* Batch Export */
.batch-export {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: oklch(var(--p) / 0.1);
  border-radius: 8px;
  border: 1px solid oklch(var(--p) / 0.2);
}

.batch-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.batch-description {
  font-size: 12px;
  opacity: 0.8;
  line-height: 1.4;
}

.batch-export-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 48px;
}

.batch-export-btn:hover:not(:disabled) {
  background: oklch(var(--pf));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(217, 70, 239, 0.3);
}

.batch-export-btn:disabled {
  background: oklch(var(--bc) / 0.1);
  color: oklch(var(--bc) / 0.6);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.batch-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.batch-ready {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-progress-bar {
  width: 100%;
  height: 4px;
  background: oklch(var(--bc) / 0.2);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;
}

.batch-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, oklch(var(--p)), oklch(var(--s)));
  transition: width 0.3s ease;
  border-radius: 2px;
}

/* Placeholder panels */
.insights-placeholder,
.export-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  gap: 12px;
}

.insights-placeholder h4,
.export-placeholder h4 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: oklch(var(--bc));
}

.insights-placeholder p,
.export-placeholder p {
  font-size: 13px;
  color: oklch(var(--bc) / 0.7);
  margin: 0;
}

.placeholder-btn {
  padding: 8px 16px;
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
}

.placeholder-btn:hover {
  background: oklch(var(--pf));
  transform: translateY(-1px);
}

/* Requirements Info Styling */
.requirements-info {
  margin: 16px 0;
  padding: 12px;
  background: rgba(var(--bc), 0.05);
  border-radius: 8px;
  border: 1px solid rgba(var(--bc), 0.1);
}

.requirement-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin-bottom: 8px;
}

.requirement-item.met {
  color: oklch(var(--su));
}

.requirement-item.not-met {
  color: oklch(var(--er));
}

.requirement-icon {
  font-weight: bold;
  width: 16px;
  text-align: center;
}

.requirement-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: oklch(var(--wa));
  padding: 8px;
  background: rgba(var(--wa), 0.1);
  border-radius: 6px;
  border-left: 3px solid oklch(var(--wa));
}

.requirement-info-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: oklch(var(--in));
  padding: 8px;
  background: rgba(var(--in), 0.1);
  border-radius: 6px;
  border-left: 3px solid oklch(var(--in));
}

.retry-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: oklch(var(--n));
  color: oklch(var(--nc));
}

.retry-btn.disabled:hover {
  transform: none;
  background: oklch(var(--n));
}
</style>