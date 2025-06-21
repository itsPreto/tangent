<template>
    <div class="help-dice-container" :class="{ 'is-open': isOpen }">
      <!-- Main App Content Wrapper -->
      <div class="main-content-wrapper">
        <slot name="main-content"></slot>
        
        <!-- Shadow Overlay for compressed content -->
        <div class="content-shadow-overlay" :class="{ 'visible': isOpen }"></div>
      </div>
  
      <!-- Unified Help Panel with Glassmorphism -->
      <div class="help-dice-panel">
        <!-- Handle Bar -->
        <div class="handle-bar" @click="$emit('toggle')">
          <div class="handle-indicator"></div>
          <span class="handle-text">{{ isOpen ? 'Hide Help' : 'Show Help' }}</span>
          <div class="handle-indicator"></div>
        </div>

  
        <!-- Main Content Area -->
        <div class="content-area">
          <!-- Left Sidebar - Shortcuts -->
          <div class="side-panel left-panel">
            <div class="panel-header">
              <Keyboard class="w-5 h-5 text-blue-400" />
              <h3 class="text-lg font-semibold text-base-content">Shortcuts</h3>
            </div>
            <div class="shortcuts-list">
              <div 
                v-for="(shortcut, index) in shortcuts" 
                :key="index" 
                class="shortcut-item"
              >
                <div class="shortcut-keys">
                  <kbd 
                    v-for="key in shortcut.keys" 
                    :key="key" 
                    class="glass-kbd"
                  >
                    {{ key }}
                  </kbd>
                </div>
                <span class="shortcut-description">{{ shortcut.description }}</span>
              </div>
            </div>
          </div>
  
          <!-- Central Dependency Visualizer -->
          <div class="dependency-center">
            <!-- Node Info Panel -->
            <div class="node-info-panel">
              <div v-if="selectedNode" class="selected-node-info">
                <div class="node-info-header">
                  <div class="node-info-title">
                    <div class="node-color-dot" :style="{ backgroundColor: fileTypeColors[selectedNode.type] || fileTypeColors.other }"></div>
                    <h4 class="text-sm font-bold text-base-content">{{ selectedNode.name }}</h4>
                  </div>
                  <button @click="selectedNode = null" class="glass-button-sm">
                    <X class="w-3 h-3" />
                  </button>
                </div>
                <div class="node-info-content">
                  <div class="node-stats">
                    <span class="stat-item">Type: {{ selectedNode.type }}</span>
                    <span class="stat-item">Dependencies: {{ selectedNode.imports.length }}</span>
                    <span class="stat-item" v-if="selectedNode.isHotspot">🔥 Hotspot</span>
                  </div>
                  <div v-if="selectedNode.connectedNodes?.length" class="connected-nodes">
                    <p class="text-xs text-base-content/80 mb-1">Connected to:</p>
                    <div class="connected-list">
                      <span 
                        v-for="conn in selectedNode.connectedNodes.slice(0, 5)" 
                        :key="conn" 
                        class="connected-tag"
                      >
                        {{ conn }}
                      </span>
                      <span v-if="selectedNode.connectedNodes.length > 5" class="text-xs text-base-content/60">
                        +{{ selectedNode.connectedNodes.length - 5 }} more
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="no-selection">
                <p class="text-xs text-base-content/60">Click a node to view its details and connections</p>
              </div>
            </div>
  
            <!-- Graph Legend -->
            <div class="graph-legend">
              <div class="legend-section">
                <h5 class="legend-title">Node Types</h5>
                <div class="legend-items">
                  <div 
                    v-for="(color, type) in fileTypeColors" 
                    :key="type" 
                    class="legend-item"
                  >
                    <div class="legend-dot" :style="{ backgroundColor: color }"></div>
                    <span class="legend-label">{{ type.replace('-', ' ') }}</span>
                  </div>
                </div>
              </div>
              <div class="legend-section">
                <h5 class="legend-title">Link Types</h5>
                <div class="legend-items">
                  <div class="legend-item">
                    <div class="legend-line normal"></div>
                    <span class="legend-label">Normal</span>
                  </div>
                  <div class="legend-item">
                    <div class="legend-line external"></div>
                    <span class="legend-label">External</span>
                  </div>
                  <div class="legend-item">
                    <div class="legend-line circular"></div>
                    <span class="legend-label">Circular</span>
                  </div>
                </div>
              </div>
            </div>
  
            <div class="dependency-container" ref="containerRef">
              <!-- Minimal Controls -->
              <div class="absolute top-4 left-4 z-10 flex gap-2">
                <button
                  @click="refreshDependencies"
                  :disabled="loading"
                  class="glass-control-button"
                >
                  <RefreshCw :class="{ 'animate-spin': loading }" class="w-3 h-3" />
                  {{ loading ? 'Analyzing...' : 'Analyze' }}
                </button>
              </div>
  
              <!-- Search -->
              <div class="absolute top-4 right-4 z-10">
                <div class="relative">
                  <Search class="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-base-content/60" />
                  <input
                    type="text"
                    placeholder="Search..."
                    v-model="searchTerm"
                    @input="handleSearch"
                    class="glass-search-input"
                  />
                </div>
              </div>
  
              <!-- Stats -->
              <div v-if="dependencyData" class="absolute bottom-4 left-4 z-10 flex gap-2 text-xs">
                <span class="glass-stat-badge">
                  {{ dependencyData.stats.totalFiles }} Files
                </span>
                <span class="glass-stat-badge">
                  {{ dependencyData.stats.totalDependencies }} Deps
                </span>
                <span v-if="dependencyData.stats.circularDependencies > 0" 
                  class="glass-stat-badge-warning">
                  {{ dependencyData.stats.circularDependencies }} Circular
                </span>
              </div>
  
              <!-- Spread Control -->
              <div class="absolute bottom-4 right-4 z-10 glass-control-panel">
                <span class="text-xs text-base-content/80">Spread:</span>
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="25"
                  v-model.number="linkDistance"
                  @input="updateLinkDistance"
                  class="glass-slider"
                />
                <span class="text-xs text-base-content/60 w-6 text-center">{{ linkDistance }}</span>
              </div>
  
              <!-- Loading State -->
              <div v-if="loading" class="glass-overlay">
                <div class="text-center text-base-content">
                  <RefreshCw class="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p class="text-sm">Analyzing dependencies...</p>
                </div>
              </div>
  
              <!-- Error State -->
              <div v-else-if="error && !loading" class="glass-overlay">
                <div class="text-center text-base-content max-w-xs">
                  <div class="glass-error-icon">
                    <span class="text-red-400">⚠</span>
                  </div>
                  <h3 class="text-sm font-semibold mb-2">Analysis Failed</h3>
                  <p class="text-xs opacity-80 mb-4">{{ error }}</p>
                  <button @click="refreshDependencies" class="glass-button-primary">
                    Try Again
                  </button>
                </div>
              </div>
  
              <!-- No Data State -->
              <div v-else-if="!dependencyData && !loading && !error" class="glass-overlay">
                <div class="text-center text-base-content/80 max-w-xs">
                  <div class="glass-empty-icon">
                    <span class="text-2xl">📊</span>
                  </div>
                  <h3 class="text-sm font-semibold mb-2">No Data</h3>
                  <p class="text-xs opacity-60 mb-4">Click analyze to load dependencies</p>
                  <button @click="refreshDependencies" class="glass-button-primary">
                    Analyze Project
                  </button>
                </div>
              </div>
  
              <!-- SVG Container -->
              <svg ref="svgRef" class="w-full h-full" />
            </div>
          </div>
  
          <!-- Right Sidebar - Tips -->
          <div class="side-panel right-panel">
            <div class="panel-header">
              <Sparkles class="w-5 h-5 text-purple-400" />
              <h3 class="text-lg font-semibold text-base-content">Tips & Tricks</h3>
            </div>
            <div class="tips-list">
              <div 
                v-for="(tip, index) in combinedTips" 
                :key="index"
                class="tip-item"
              >
                <div class="tip-icon">
                  <component :is="tip.icon" class="w-4 h-4" />
                </div>
                <p class="tip-text">{{ tip.text }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
  import { X, Keyboard, Sparkles, GitBranch, RefreshCw, Search, MousePointer, Lightbulb } from 'lucide-vue-next';
  import * as d3 from 'd3';
  
  // Types
  interface DependencyFile {
    path: string;
    name: string;
    extension: string;
    category?: string;
    size?: number;
    imports?: Array<{
      path: string;
      type: string;
      importType?: string;
      resolved?: boolean;
      resolvedPath?: string;
    }>;
  }
  
  interface DependencyData {
    stats: {
      totalFiles: number;
      totalDependencies: number;
      circularDependencies: number;
      externalDependencies: number;
      vueComponents?: number;
      unresolvedImports?: number;
    };
    files: DependencyFile[];
    circularDependencies?: Array<{
      cycle: string[];
      length: number;
    }>;
    analysis?: {
      complexityScore?: number;
      hotspots?: Array<{
        file: string;
        dependencyCount?: number;
        dependentCount?: number;
        type: string;
      }>;
      recommendations?: Array<{
        type: string;
        message: string;
        priority: string;
      }>;
    };
    metadata?: any;
  }
  
  const props = defineProps<{
    isOpen: boolean
  }>();
  
  const emit = defineEmits<{
    (e: 'close'): void
    (e: 'toggle'): void
  }>();
  
  // Reactive state
  const containerRef = ref<HTMLElement | null>(null);
  const svgRef = ref<SVGSVGElement | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const dependencyData = ref<DependencyData | null>(null);
  const searchTerm = ref('');
  const linkDistance = ref(125);
  const selectedNode = ref<any>(null);
  const currentZoomScale = ref(1);
  
  // D3 variables
  let simulation: any = null;
  let g: any = null;
  let tooltip: any = null;
  let labels: any = null;
  
  // Data
  const shortcuts = [
    { keys: ['?'], description: 'Show/hide this help panel' },
    { keys: ['M'], description: 'Open model selector' },
    { keys: ['S'], description: 'Toggle snap mode for selected node' },
    { keys: ['ESC'], description: 'Exit current mode or close panels' },
    { keys: ['↑', '↓', '←', '→'], description: 'Navigate between connected nodes' },
    { keys: ['/'], description: 'Search models and components' },
    { keys: ['SPACE'], description: 'Pan the canvas' },
    { keys: ['CTRL', '+'], description: 'Zoom in' },
    { keys: ['CTRL', '-'], description: 'Zoom out' },
    { keys: ['CTRL', '0'], description: 'Reset zoom' }
  ];
  
  const combinedTips = [
    { icon: MousePointer, text: 'Click and drag on empty space to pan the canvas' },
    { icon: Sparkles, text: 'Double-click on messages to create branches' },
    { icon: MousePointer, text: 'Drag nodes to rearrange them in the workspace' },
    { icon: Lightbulb, text: 'Use different AI models for different types of tasks' },
    { icon: MousePointer, text: 'Use mouse wheel to zoom in and out' },
    { icon: Sparkles, text: 'Create branches to explore alternative conversation paths' },
    { icon: MousePointer, text: 'Right-click for context menus and quick actions' },
    { icon: Lightbulb, text: 'Organize your workspaces by project or topic themes' },
    { icon: MousePointer, text: 'Hold SHIFT while dragging to constrain movement' },
    { icon: Sparkles, text: 'Export important conversations for sharing with team members' },
    { icon: MousePointer, text: 'Click on node connections to follow dependency paths' },
    { icon: Lightbulb, text: 'The dependency visualizer helps understand code structure' },
    { icon: MousePointer, text: 'Hover over elements for detailed tooltips and information' },
    { icon: Sparkles, text: 'Use the spread slider to adjust node spacing for clarity' }
  ];
  
  // Color mapping
  const fileTypeColors: Record<string, string> = {
    'vue-component': '#ef4444',
    'typescript': '#3b82f6',
    'javascript': '#3b82f6',
    'store': '#10b981',
    'utility': '#8b5cf6',
    'service': '#8b5cf6',
    'types': '#f59e0b',
    'config': '#f59e0b',
    'external': '#f59e0b',
    'other': '#6b7280'
  };
  
  const getNodeType = (file: DependencyFile): string => {
    if (file.category) return file.category;
    if (file.path.includes('store')) return 'store';
    if (file.path.includes('util') || file.path.includes('service')) return 'utility';
    if (file.extension === '.vue') return 'vue-component';
    if (file.extension === '.ts') return 'typescript';
    if (file.extension === '.js') return 'javascript';
    return 'other';
  };
  
  const getBaseUrl = () => {
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050';
  };
  
  const initializeVisualization = () => {
    if (!containerRef.value || !svgRef.value) return;
    
    // Clear existing
    d3.select(svgRef.value).selectAll('*').remove();
    
    const container = containerRef.value;
    const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height) - 40;
    
    const svg = d3.select(svgRef.value)
      .attr('width', size)
      .attr('height', size)
      .style('position', 'absolute')
      .style('top', '50%')
      .style('left', '50%')
      .style('transform', 'translate(-50%, -50%)');
    
    g = svg.append('g');
    
    // Optimized zoom behavior with throttling
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', throttle((event) => {
        g.attr('transform', event.transform);
        currentZoomScale.value = event.transform.k;
        
        // Update label sizes based on zoom level
        if (labels) {
          const baseFontSize = 10;
          const scaledFontSize = Math.max(8, Math.min(16, baseFontSize / event.transform.k));
          labels.style('font-size', `${scaledFontSize}px`);
        }
      }, 16)); // ~60fps throttling
    
    svg.call(zoom);
    
    // Create tooltip
    tooltip = d3.select('body')
      .append('div')
      .attr('class', 'bg-base-100 text-base-content border border-base-300')
      .style('position', 'absolute')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('font-size', '11px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('opacity', 0)
      .style('box-shadow', '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)');
  };
  
  // Throttle function for performance
  const throttle = (func: Function, delay: number) => {
    let timeoutId: any;
    let lastExecTime = 0;
    return function (this: any, ...args: any[]) {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  };
  
  const visualizeDependencyGraph = () => {
    if (!dependencyData.value || !g) return;
    
    // Clear previous
    g.selectAll('*').remove();
    
    const nodes = dependencyData.value.files.map(file => {
      const isHotspot = dependencyData.value?.analysis?.hotspots?.some((h: any) => h.file === file.path);
      const importCount = file.imports?.length || 0;
      return {
        id: file.path,
        name: file.name,
        type: getNodeType(file),
        category: file.category,
        imports: file.imports || [],
        size: Math.max(8, Math.min(20, Math.sqrt(importCount + 1) * 6 + 8)), // Larger nodes
        file: file,
        isHotspot: isHotspot,
        selected: false
      };
    });
    
    const links: any[] = [];
    dependencyData.value.files.forEach(file => {
      (file.imports || []).forEach(imp => {
        const target = nodes.find(n => 
          n.id.includes(imp.path) || 
          n.name === imp.path.split('/').pop()
        );
        if (target) {
          const isCircular = dependencyData.value?.circularDependencies?.some((cycle: any) =>
            cycle.cycle?.includes(file.path) && cycle.cycle?.includes(target.id)
          );
          
          links.push({
            source: file.path,
            target: target.id,
            type: imp.type,
            importType: imp.importType,
            isCircular: isCircular,
            resolved: imp.resolved
          });
        }
      });
    });
    
    // Draw links with better visibility
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', (d: any) => {
        if (d.isCircular) return 'hsl(var(--er))';
        if (d.type === 'external') return 'hsl(var(--wa))';
        return 'hsl(var(--bc) / 0.6)'; // More visible
      })
      .attr('stroke-opacity', 0.8)
      .attr('stroke-width', (d: any) => d.isCircular ? 3 : 2) // Thicker lines
      .attr('stroke-dasharray', (d: any) => {
        if (d.isCircular) return '5,5';
        if (d.type === 'external') return '3,3';
        return null;
      })
      .style('cursor', 'pointer');
  
    // Draw nodes with better visibility
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter().append('circle')
      .attr('r', (d: any) => d.size)
      .attr('fill', (d: any) => fileTypeColors[d.type] || fileTypeColors.other)
      .attr('stroke', (d: any) => d.isHotspot ? 'hsl(var(--er))' : 'hsl(var(--bc) / 0.8)')
      .attr('stroke-width', (d: any) => d.isHotspot ? 3 : 2)
      .style('cursor', 'pointer')
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))')
      .on('click', (event: any, d: any) => {
        // Toggle selection
        d.selected = !d.selected;
        
        // Reset all highlighting
        node.style('opacity', 1).attr('stroke-width', (n: any) => n.isHotspot ? 3 : 2);
        link.style('opacity', 0.8);
        labels.style('opacity', 1);
        
        if (d.selected) {
          // Update selected node info
          const connectedNodeIds = new Set();
          connectedNodeIds.add(d.id);
          
          // Find connected nodes
          const connectedNames: string[] = [];
          links.forEach((l: any) => {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            
            if (sourceId === d.id) {
              connectedNodeIds.add(targetId);
              const targetNode = nodes.find(n => n.id === targetId);
              if (targetNode) connectedNames.push(targetNode.name);
            }
            if (targetId === d.id) {
              connectedNodeIds.add(sourceId);
              const sourceNode = nodes.find(n => n.id === sourceId);
              if (sourceNode) connectedNames.push(sourceNode.name);
            }
          });
          
          selectedNode.value = {
            ...d,
            connectedNodes: connectedNames
          };
          
          // Highlight clicked node and connected elements
          node
            .style('opacity', (n: any) => connectedNodeIds.has(n.id) ? 1 : 0.2)
            .attr('stroke-width', (n: any) => {
              if (n.id === d.id) return 4; // Selected node
              if (connectedNodeIds.has(n.id)) return 3; // Connected nodes
              return n.isHotspot ? 3 : 2;
            });
          
          link.style('opacity', (l: any) => {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            return (sourceId === d.id || targetId === d.id) ? 1 : 0.1;
          });
          
          labels.style('opacity', (n: any) => connectedNodeIds.has(n.id) ? 1 : 0.3);
        } else {
          selectedNode.value = null;
        }
      })
      .on('mouseover', (event: any, d: any) => {
        // Enhanced tooltip
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(`
          <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px;">${d.name}</div>
          <div style="font-size: 10px; opacity: 0.8; margin-bottom: 2px;">Type: ${d.type}</div>
          <div style="font-size: 10px; margin-bottom: 2px;">Dependencies: ${d.imports.length}</div>
          <div style="font-size: 10px; margin-bottom: 2px;">Size: ${Math.round(d.size)}px</div>
          ${d.isHotspot ? '<div style="color: #ff6b6b; font-size: 10px; font-weight: bold;">🔥 Hotspot</div>' : ''}
          <div style="font-size: 9px; opacity: 0.6; margin-top: 4px;">Click to explore connections</div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200).style('opacity', 0);
      })
      .call(d3.drag()
        .on('start', (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event: any, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));
  
    // Add permanent labels
    labels = g.append('g')
      .selectAll('text')
      .data(nodes)
      .enter().append('text')
      .text((d: any) => d.name) // Show full name since it scales with zoom
      .style('font-size', '10px')
      .style('font-weight', '600')
      .style('fill', 'hsl(var(--bc))')
      .style('text-anchor', 'middle')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 3px rgba(0,0,0,0.8)')
      .style('user-select', 'none');
  
    // Create optimized simulation for small graphs
    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(linkDistance.value))
      .force('charge', d3.forceManyBody().strength(-linkDistance.value * 2.5))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius((d: any) => d.size + linkDistance.value * 0.1))
      .alpha(1)
      .alphaDecay(0.02) // Faster settling
      .velocityDecay(0.4); // Faster dampening
  
    // Optimize tick updates with throttling
    let tickCount = 0;
    simulation.on('tick', throttle(() => {
      tickCount++;
      
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      
      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
      
      labels
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y + d.size + 12);
      
      // Stop simulation early for small graphs to improve performance
      if (tickCount > 100 && simulation.alpha() < 0.05) {
        simulation.stop();
      }
    }, 16));
  };
  
  const refreshDependencies = async () => {
    loading.value = true;
    error.value = null;
    
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/analyze-dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
      });
  
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
  
      const data = await response.json();
      
      if (data.stats?.totalDependencies === 0 && data.stats?.totalFiles > 0) {
        error.value = `Analysis found ${data.stats.totalFiles} files but 0 dependencies.`;
        return;
      }
      
      dependencyData.value = data;
    } catch (err) {
      console.error('Failed to analyze dependencies:', err);
      error.value = err instanceof Error ? err.message : 'Failed to analyze dependencies';
    } finally {
      loading.value = false;
    }
  };
  
  const handleSearch = () => {
    if (!dependencyData.value || !g) return;
    
    const term = searchTerm.value.toLowerCase();
    
    if (!term) {
      g.selectAll('circle').style('opacity', 1);
      g.selectAll('line').style('opacity', 0.8);
      g.selectAll('text').style('opacity', 1);
      return;
    }
    
    const matchingFiles = dependencyData.value.files.filter(file =>
      file.name.toLowerCase().includes(term) ||
      file.path.toLowerCase().includes(term)
    );
    
    const matchingIds = new Set(matchingFiles.map(f => f.path));
    
    g.selectAll('circle')
      .style('opacity', (d: any) => matchingIds.has(d.id) ? 1 : 0.2);
      
    g.selectAll('line')
      .style('opacity', (link: any) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return (matchingIds.has(sourceId) || matchingIds.has(targetId)) ? 0.9 : 0.1;
      });
    
    g.selectAll('text')
      .style('opacity', (d: any) => matchingIds.has(d.id) ? 1 : 0.3);
  };
  
  const updateLinkDistance = () => {
    if (!simulation) return;
    
    // Fix the spread slider - ensure it works in both directions
    const distance = linkDistance.value;
    simulation.force('link', d3.forceLink().id((d: any) => d.id).distance(distance));
    simulation.force('charge', d3.forceManyBody().strength(-distance * 2.5)); // Adjust charge proportionally
    simulation.force('collision', d3.forceCollide().radius((d: any) => d.size + distance * 0.1));
    simulation.alpha(0.3).restart();
  };
  
  // Auto-refresh on mount
  onMounted(async () => {
    await nextTick();
    initializeVisualization();
    refreshDependencies();
  });
  
  onUnmounted(() => {
    if (tooltip) {
      tooltip.remove();
    }
  });
  
  // Re-initialize when data changes
  watch(dependencyData, (newData) => {
    selectedNode.value = null; // Reset selection
    if (newData) {
      nextTick(() => {
        initializeVisualization();
        visualizeDependencyGraph();
      });
    }
  });
  
  // Handle window resize with debouncing
  const debouncedResize = throttle(() => {
    if (dependencyData.value) {
      nextTick(() => {
        initializeVisualization();
        visualizeDependencyGraph();
      });
    }
  }, 300); // 300ms debounce
  
  watch(() => [containerRef.value], debouncedResize);
  </script>
  
  <style scoped>
  .help-dice-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: none; /* Allow clicks to pass through */
  }
  
  .main-content-wrapper {
    position: relative;
    flex: 1;
    transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: top center;
    overflow: hidden;
    pointer-events: auto; /* Re-enable pointer events for main content */
  }
  
  .is-open .main-content-wrapper {
    flex: 0 0 20vh;
    transform: scale(0.85);
  }
  
  .content-shadow-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.3) 50%,
      rgba(0, 0, 0, 0.6) 100%
    );
    opacity: 0;
    transition: opacity 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    pointer-events: none;
    z-index: 10;
  }
  
  .content-shadow-overlay.visible {
    opacity: 1;
  }
  
  .help-dice-panel {
    height: 80vh;
    background: hsl(var(--b2) / 0.3); /* Reduced transparency */
    backdrop-filter: blur(15px); /* Reduced blur */
    border: 1px solid hsl(var(--b3)); /* Slightly more opaque border */
    border-bottom: none;
    border-radius: 1.5rem 1.5rem 0 0;
    box-shadow: 
      0 -10px 50px rgba(0, 0, 0, 0.4), /* Darker shadow */
      inset 0 1px 0 hsl(var(--bc) / 0.1);
    display: flex;
    flex-direction: column;
    transform: translateY(100%) rotateX(-20deg) rotateY(-5deg);
    transform-origin: bottom center;
    transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    opacity: 0;
    flex: 0 0 80vh;
    pointer-events: auto; /* Re-enable pointer events for help panel */
  }
  
  .is-open .help-dice-panel {
    transform: translateY(0) rotateX(0deg) rotateY(0deg);
    opacity: 1;
    animation: diceRollPush 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  @keyframes diceRollPush {
    0% {
      transform: translateY(100%) rotateX(-20deg) rotateY(-5deg) rotateZ(-2deg);
      opacity: 0;
      box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.1);
    }
    25% {
      transform: translateY(75%) rotateX(-15deg) rotateY(-3deg) rotateZ(-1deg);
      opacity: 0.3;
      box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.15);
    }
    50% {
      transform: translateY(40%) rotateX(-8deg) rotateY(2deg) rotateZ(1deg);
      opacity: 0.6;
      box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.2);
    }
    75% {
      transform: translateY(10%) rotateX(3deg) rotateY(-1deg) rotateZ(-0.5deg);
      opacity: 0.8;
      box-shadow: 0 -15px 45px rgba(0, 0, 0, 0.22);
    }
    100% {
      transform: translateY(0) rotateX(0deg) rotateY(0deg) rotateZ(0deg);
      opacity: 1;
      box-shadow: 
        0 -10px 50px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 hsl(var(--bc) / 0.1);
    }
  }
  
  .handle-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    cursor: pointer;
    border-bottom: 1px solid hsl(var(--b3));
    transition: all 0.2s ease;
    background: hsl(var(--b2) / 0.3);
    backdrop-filter: blur(10px);
    position: relative;
    overflow: hidden;
  }
  
  .handle-bar::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, hsl(var(--bc) / 0.1), transparent);
    transition: left 0.5s ease;
  }
  
  .handle-bar:hover::before {
    left: 100%;
  }
  
  .handle-bar:hover {
    background: hsl(var(--b2) / 0.8);
    transform: translateY(-2px);
  }
  
  .handle-indicator {
    width: 2rem;
    height: 4px;
    background: linear-gradient(90deg, #60a5fa, #c084fc, #f472b6);
    border-radius: 2px;
    opacity: 0.8;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 2px 8px rgba(96, 165, 250, 0.3);
  }
  
  .handle-bar:hover .handle-indicator {
    opacity: 1;
    width: 2.5rem;
    transform: scale(1.1);
    box-shadow: 0 4px 15px rgba(96, 165, 250, 0.5);
  }
  
  .handle-text {
    font-size: 0.875rem;
    font-weight: 600;
    color: hsl(var(--bc) / 0.9);
    transition: all 0.2s ease;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
  
  .handle-bar:hover .handle-text {
    color: hsl(var(--bc));
    transform: scale(1.05);
  }
  
  .help-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid hsl(var(--b3));
    background: hsl(var(--b2) / 0.3);
    backdrop-filter: blur(10px);
  }
  
  .help-icon {
    padding: 0.75rem;
    background: rgba(96, 165, 250, 0.1);
    border: 1px solid rgba(96, 165, 250, 0.2);
    border-radius: 1rem;
    color: #60a5fa;
    transition: all 0.2s ease;
    backdrop-filter: blur(10px);
  }
  
  .help-icon:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 15px rgba(96, 165, 250, 0.3);
  }
  
  .content-area {
    flex: 1;
    display: grid;
    grid-template-columns: 400px 1fr 400px;
    gap: 1rem;
    padding: 1rem;
    overflow: hidden;
  }
  
  .dependency-center {
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.3); /* More opaque background */
    border: 1px solid hsl(var(--b3)); /* More visible border */
    border-radius: 1rem;
    backdrop-filter: blur(12px); /* Reduced blur */
    box-shadow: inset 0 1px 0 hsl(var(--bc) / 0.1);
    overflow: hidden;
    position: relative;
  }
  
  .dependency-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  
  /* Node Info Panel Styles */
  .node-info-panel {
    padding: 0.75rem;
    border-bottom: 1px solid hsl(var(--b3));
    background: hsl(var(--b2) / 0.2);
    min-height: 60px;
  }
  
  .selected-node-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .node-info-header {
    display: flex;
    justify-content: between;
    align-items: center;
  }
  
  .node-info-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }
  
  .node-color-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  .node-info-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .node-stats {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .stat-item {
    font-size: 0.75rem;
    color: hsl(var(--bc) / 0.8);
    background: hsl(var(--b2) / 0.5);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid hsl(var(--b3));
  }
  
  .connected-nodes {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .connected-list {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
    align-items: center;
  }
  
  .connected-tag {
    font-size: 0.7rem;
    color: hsl(var(--bc) / 0.7);
    background: rgba(59, 130, 246, 0.2);
    padding: 0.15rem 0.4rem;
    border-radius: 0.2rem;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  
  .no-selection {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
  }
  
  /* Graph Legend Styles */
  .graph-legend {
    display: flex;
    gap: 1.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid hsl(var(--b3));
    background: hsl(var(--b2) / 0.1);
    font-size: 0.7rem;
  }
  
  .legend-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .legend-title {
    font-size: 0.65rem;
    font-weight: 600;
    color: hsl(var(--bc) / 0.9);
    margin-bottom: 0.25rem;
  }
  
  .legend-items {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .legend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  .legend-line {
    width: 12px;
    height: 2px;
    flex-shrink: 0;
  }
  
  .legend-line.normal {
    background: hsl(var(--bc) / 0.6);
  }
  
  .legend-line.external {
    background: #feca57;
    background-image: repeating-linear-gradient(
      90deg,
      transparent,
      transparent 2px,
      #feca57 2px,
      #feca57 4px
    );
  }
  
  .legend-line.circular {
    background: #ff6b6b;
    background-image: repeating-linear-gradient(
      90deg,
      transparent,
      transparent 3px,
      #ff6b6b 3px,
      #ff6b6b 6px
    );
  }
  
  .legend-label {
    font-size: 0.65rem;
    color: hsl(var(--bc) / 0.7);
    text-transform: capitalize;
    white-space: nowrap;
  }
  
  .glass-button-sm {
    padding: 0.25rem;
    background: hsl(var(--b2) / 0.6);
    border: 1px solid hsl(var(--b3));
    border-radius: 0.25rem;
    color: hsl(var(--bc));
    backdrop-filter: blur(10px);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .glass-button-sm:hover {
    background: hsl(var(--b2) / 0.9);
  }
  
  .side-panel {
    background: hsl(var(--b2) / 0.2); /* More opaque */
    border: 1px solid hsl(var(--b3)); /* More visible border */
    border-radius: 1rem;
    backdrop-filter: blur(12px); /* Reduced blur */
    box-shadow: inset 0 1px 0 hsl(var(--bc) / 0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid hsl(var(--b3));
    background: hsl(var(--b2) / 0.5);
  }
  
  .shortcuts-list,
  .tips-list {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .shortcut-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: anchor-center;
    padding: 0.75rem;
    background: hsl(var(--b2) / 0.5);
    border: 1px solid hsl(var(--b3));
    border-radius: 0.5rem;
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
  }
  
  .shortcut-item:hover {
    background: hsl(var(--b2) / 0.8);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  .shortcut-keys {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  
  .glass-kbd {
    padding: 0.25rem 0.5rem;
    background: hsl(var(--b2) / 0.6);
    border: 1px solid hsl(var(--b3));
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: hsl(var(--bc));
    backdrop-filter: blur(10px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
  
  .shortcut-description {
    color: hsl(var(--bc) / 0.8);
    font-size: 0.8rem;
    line-height: 1.4;
  }
  
  .tip-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem;
    background: hsl(var(--b2) / 0.5);
    border: 1px solid hsl(var(--b3));
    border-radius: 0.5rem;
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
  }
  
  .tip-item:hover {
    background: hsl(var(--b2) / 0.8);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  .tip-icon {
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(192, 132, 252, 0.1);
    border: 1px solid rgba(192, 132, 252, 0.2);
    border-radius: 0.5rem;
    color: #c084fc;
    backdrop-filter: blur(10px);
  }
  
  .tip-text {
    color: hsl(var(--bc) / 0.8);
    font-size: 0.8rem;
    line-height: 1.4;
    margin: 0;
  }
  
  /* Glass UI Controls */
  .glass-button {
    padding: 0.5rem;
    background: hsl(var(--b2) / 0.6);
    border: 1px solid hsl(var(--b3));
    border-radius: 0.5rem;
    color: hsl(var(--bc));
    backdrop-filter: blur(10px);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .glass-button:hover {
    background: hsl(var(--b2) / 0.9);
    transform: scale(1.05);
  }
  
  .glass-control-button {
    display: flex;
    items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    border: 1px solid hsl(var(--b3));
    border-radius: 0.5rem;
    color: hsl(var(--bc));
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .glass-control-button:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.4);
  }
  
  .glass-control-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .glass-search-input {
    padding-left: 1.75rem;
    padding-right: 0.75rem;
    padding-top: 0.375rem;
    padding-bottom: 0.375rem;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    border: 1px solid hsl(var(--b3));
    border-radius: 0.5rem;
    color: hsl(var(--bc));
    font-size: 0.75rem;
    width: 8rem;
    transition: all 0.2s ease;
  }
  
  .glass-search-input::placeholder {
    color: hsl(var(--bc) / 0.6);
  }
  
  .glass-search-input:focus {
    width: 10rem;
    outline: none;
    border-color: rgba(255, 255, 255, 0.4);
  }
  
  .glass-stat-badge {
    padding: 0.25rem 0.5rem;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    border: 1px solid hsl(var(--b3));
    border-radius: 0.25rem;
    color: hsl(var(--bc));
  }
  
  .glass-stat-badge-warning {
    padding: 0.25rem 0.5rem;
    background: rgba(239, 68, 68, 0.2);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 0.25rem;
    color: #fca5a5;
  }
  
  .glass-control-panel {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    border: 1px solid hsl(var(--b3));
    border-radius: 0.5rem;
  }
  
  .glass-slider {
    width: 4rem;
    height: 0.25rem;
    background: hsl(var(--bc) / 0.2);
    border-radius: 0.125rem;
    appearance: none;
    cursor: pointer;
  }
  
  .glass-slider::-webkit-slider-thumb {
    appearance: none;
    width: 0.75rem;
    height: 0.75rem;
    background: hsl(var(--p));
    border-radius: 50%;
    cursor: pointer;
    border: 1px solid hsl(var(--p) / 0.4);
    backdrop-filter: blur(10px);
  }
  
  .glass-slider::-moz-range-thumb {
    width: 0.75rem;
    height: 0.75rem;
    background: hsl(var(--p));
    border-radius: 50%;
    cursor: pointer;
    border: 1px solid hsl(var(--p) / 0.4);
  }
  
  .glass-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    z-index: 20;
  }
  
  .glass-error-icon,
  .glass-empty-icon {
    width: 3rem;
    height: 3rem;
    border: 2px solid rgba(239, 68, 68, 0.4);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 0.75rem;
    backdrop-filter: blur(10px);
  }
  
  .glass-empty-icon {
    border-color: rgba(255, 255, 255, 0.4);
    border-style: dashed;
  }
  
  .glass-button-primary {
    padding: 0.5rem 0.75rem;
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.4);
    border-radius: 0.25rem;
    color: hsl(var(--bc));
    font-size: 0.75rem;
    cursor: pointer;
    backdrop-filter: blur(10px);
    transition: all 0.2s ease;
  }
  
  .glass-button-primary:hover {
    background: rgba(59, 130, 246, 0.3);
  }
  
  /* Custom scrollbar */
  .shortcuts-list::-webkit-scrollbar,
  .tips-list::-webkit-scrollbar {
    width: 4px;
  }
  
  .shortcuts-list::-webkit-scrollbar-track,
  .tips-list::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .shortcuts-list::-webkit-scrollbar-thumb,
  .tips-list::-webkit-scrollbar-thumb {
    background: hsl(var(--bc) / 0.2);
    border-radius: 2px;
  }
  
  .shortcuts-list::-webkit-scrollbar-thumb:hover,
  .tips-list::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--bc) / 0.3);
  }
  
  /* Responsive design */
  @media (max-width: 1200px) {
    .content-area {
      grid-template-columns: 180px 1fr 180px;
    }
  }
  
  @media (max-width: 1024px) {
    .content-area {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr auto;
    }
    
    .side-panel {
      max-height: 200px;
    }
    
    .shortcuts-list,
    .tips-list {
      max-height: 150px;
    }
    
    .graph-legend {
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .legend-items {
      gap: 0.5rem;
    }
    
    .node-stats {
      gap: 0.5rem;
    }
  }
  
  @media (max-width: 768px) {
    .content-area {
      padding: 0.5rem;
      gap: 0.5rem;
    }
    
    .help-header {
      padding: 1rem;
    }
    
    .panel-header {
      padding: 0.75rem 1rem;
    }
    
    .shortcuts-list,
    .tips-list {
      padding: 0.5rem;
    }
  }
  </style>