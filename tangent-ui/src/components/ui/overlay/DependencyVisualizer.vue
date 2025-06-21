<template>
  <div ref="containerRef" class="relative w-full h-full overflow-hidden">
    <!-- Minimal Controls -->
    <div class="absolute top-4 left-4 z-10 flex gap-2">
      <button
        @click="refreshDependencies"
        :disabled="loading"
        class="flex items-center gap-1 px-3 py-1.5 bg-base-200/80 backdrop-blur-sm border border-base-300 rounded-lg text-base-content text-xs hover:bg-base-200/90 transition-all"
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
          class="pl-7 pr-3 py-1.5 bg-base-200/80 backdrop-blur-sm border border-base-300 rounded-lg text-base-content text-xs placeholder-base-content/60 w-32 focus:w-40 transition-all focus:outline-none focus:border-base-content/40"
        />
      </div>
    </div>

    <!-- Stats -->
    <div v-if="dependencyData" class="absolute bottom-4 left-4 z-10 flex gap-2 text-xs text-base-content/80">
      <span class="px-2 py-1 bg-base-200/80 backdrop-blur-sm rounded border border-base-300">
        {{ dependencyData.stats.totalFiles }} Files
      </span>
      <span class="px-2 py-1 bg-base-200/80 backdrop-blur-sm rounded border border-base-300">
        {{ dependencyData.stats.totalDependencies }} Deps
      </span>
      <span v-if="dependencyData.stats.circularDependencies > 0" 
        class="px-2 py-1 bg-error/20 backdrop-blur-sm rounded border border-error/40 text-error">
        {{ dependencyData.stats.circularDependencies }} Circular
      </span>
    </div>

    <!-- Spread Control -->
    <div class="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-base-200/80 backdrop-blur-sm border border-base-300 rounded-lg">
      <span class="text-xs text-base-content/80">Spread:</span>
      <input
        type="range"
        min="50"
        max="200"
        step="25"
        v-model.number="linkDistance"
        @input="updateLinkDistance"
        class="w-16 h-1 bg-base-content/20 rounded-lg appearance-none cursor-pointer slider"
      />
      <span class="text-xs text-base-content/60 w-6 text-center">{{ linkDistance }}</span>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-base-200/50 backdrop-blur-sm z-20">
      <div class="text-center text-base-content">
        <RefreshCw class="w-8 h-8 animate-spin mx-auto mb-2" />
        <p class="text-sm">Analyzing dependencies...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error && !loading" class="absolute inset-0 flex items-center justify-center bg-base-200/50 backdrop-blur-sm z-20">
      <div class="text-center text-base-content max-w-xs">
        <div class="w-12 h-12 border-2 border-error rounded-full flex items-center justify-center mx-auto mb-3">
          <span class="text-error">⚠</span>
        </div>
        <h3 class="text-sm font-semibold mb-2">Analysis Failed</h3>
        <p class="text-xs opacity-80 mb-4">{{ error }}</p>
        <button @click="refreshDependencies" class="px-3 py-1 bg-primary/20 border border-primary/40 rounded text-xs hover:bg-primary/30 transition-all">
          Try Again
        </button>
      </div>
    </div>

    <!-- No Data State -->
    <div v-else-if="!dependencyData && !loading && !error" class="absolute inset-0 flex items-center justify-center z-20">
      <div class="text-center text-base-content/80 max-w-xs">
        <div class="w-16 h-16 border-2 border-dashed border-base-content/40 rounded-full flex items-center justify-center mx-auto mb-4">
          <span class="text-2xl">📊</span>
        </div>
        <h3 class="text-sm font-semibold mb-2">No Data</h3>
        <p class="text-xs opacity-60 mb-4">Click analyze to load dependencies</p>
        <button @click="refreshDependencies" class="px-3 py-1 bg-primary/20 border border-primary/40 rounded text-xs hover:bg-primary/30 transition-all">
          Analyze Project
        </button>
      </div>
    </div>

    <!-- SVG Container -->
    <svg ref="svgRef" class="w-full h-full" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { RefreshCw, Search } from 'lucide-vue-next';
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

// Reactive state
const containerRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const dependencyData = ref<DependencyData | null>(null);
const searchTerm = ref('');
const linkDistance = ref(125);

// D3 variables
let simulation: any = null;
let g: any = null;
let tooltip: any = null;

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
  
  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  
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

const visualizeDependencyGraph = () => {
  if (!dependencyData.value || !g) return;
  
  // Clear previous
  g.selectAll('*').remove();
  
  const nodes = dependencyData.value.files.map(file => {
    const isHotspot = dependencyData.value?.analysis?.hotspots?.some((h: any) => h.file === file.path);
    return {
      id: file.path,
      name: file.name,
      type: getNodeType(file),
      category: file.category,
      imports: file.imports || [],
      size: Math.max(4, Math.min(12, Math.sqrt((file.imports?.length || 0) + 1) * 4 + 4)),
      file: file,
      isHotspot: isHotspot
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
  
  // Create simulation
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d: any) => d.id).distance(linkDistance.value * 0.8))
    .force('charge', d3.forceManyBody().strength(-linkDistance.value * 2))
    .force('center', d3.forceCenter(0, 0))
    .force('collision', d3.forceCollide().radius((d: any) => d.size + 5));

  // Draw links
  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .enter().append('line')
    .attr('stroke', (d: any) => {
      if (d.isCircular) return '#ef4444'; // red for circular
      if (d.type === 'external') return '#f59e0b'; // amber for external
      return '#6b7280'; // gray for normal
    })
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', (d: any) => d.isCircular ? 1.5 : 0.8)
    .attr('stroke-dasharray', (d: any) => {
      if (d.isCircular) return '3,3';
      if (d.type === 'external') return '2,2';
      return null;
    });

  // Draw nodes
  const node = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .enter().append('circle')
    .attr('r', (d: any) => d.size)
    .attr('fill', (d: any) => fileTypeColors[d.type] || fileTypeColors.other)
    .attr('stroke', (d: any) => d.isHotspot ? '#ef4444' : '#9ca3af')
    .attr('stroke-width', (d: any) => d.isHotspot ? 1.5 : 0.5)
    .style('cursor', 'pointer')
    .on('mouseover', (event: any, d: any) => {
      tooltip.transition().duration(200).style('opacity', 1);
      tooltip.html(`
        <div><strong>${d.name}</strong></div>
        <div style="font-size: 10px; opacity: 0.8;">${d.type}</div>
        <div style="font-size: 10px;">Deps: ${d.imports.length}</div>
        ${d.isHotspot ? '<div style="color: #ff6b6b; font-size: 10px;">🔥 Hotspot</div>' : ''}
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
  
  // Update positions
  simulation.on('tick', () => {
    link
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);
    
    node
      .attr('cx', (d: any) => d.x)
      .attr('cy', (d: any) => d.y);
  });
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
    g.selectAll('line').style('opacity', 0.6);
    return;
  }
  
  const matchingFiles = dependencyData.value.files.filter(file =>
    file.name.toLowerCase().includes(term) ||
    file.path.toLowerCase().includes(term)
  );
  
  const matchingIds = new Set(matchingFiles.map(f => f.path));
  
  g.selectAll('circle')
    .style('opacity', (d: any) => matchingIds.has(d.id) ? 1 : 0.3);
    
  g.selectAll('line')
    .style('opacity', (link: any) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return (matchingIds.has(sourceId) || matchingIds.has(targetId)) ? 0.8 : 0.1;
    });
};

const updateLinkDistance = () => {
  if (!simulation) return;
  
  simulation.force('link', d3.forceLink().id((d: any) => d.id).distance(linkDistance.value * 0.8));
  simulation.force('charge', d3.forceManyBody().strength(-linkDistance.value * 2));
  simulation.alpha(0.3).restart();
};

// Auto-refresh on mount
onMounted(async () => {
  await nextTick();
  initializeVisualization();
  refreshDependencies(); // Auto-refresh when component loads
});

onUnmounted(() => {
  if (tooltip) {
    tooltip.remove();
  }
});

// Re-initialize when data changes
watch(dependencyData, (newData) => {
  if (newData) {
    nextTick(() => {
      initializeVisualization();
      visualizeDependencyGraph();
    });
  }
});

// Handle window resize
watch(() => [containerRef.value], () => {
  if (dependencyData.value) {
    nextTick(() => {
      initializeVisualization();
      visualizeDependencyGraph();
    });
  }
});
</script>

<style scoped>
.slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  background: hsl(var(--p));
  border-radius: 50%;
  cursor: pointer;
  border: 1px solid hsl(var(--p) / 0.4);
}

.slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: hsl(var(--p));
  border-radius: 50%;
  cursor: pointer;
  border: 1px solid hsl(var(--p) / 0.4);
}
</style>