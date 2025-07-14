<template>
  <div class="d3-force-graph-container" ref="containerRef">
    <!-- Controls Bar - Hidden when external controls are used -->
    <div v-if="!externalControls" class="d3-controls">
      <div class="d3-stats">
        <span class="stat-badge">Topics: {{ Object.keys(visualizationData?.topics || {}).length }}</span>
        <span class="stat-badge">Workspaces: {{ totalWorkspaces }}</span>
      </div>
      
      <div class="d3-actions">        
        <!-- Layout Switcher -->
        <select v-model="currentLayout" @change="switchLayout" class="layout-select">
          <option value="radial">Radial</option>
          <option value="cluster">Cluster</option>
          <option value="hierarchical">Hierarchical</option>
          <option value="force-directed">Force-Directed</option>
        </select>
        
        <!-- Controls Toggle -->
        <button @click="toggleControls" class="d3-btn" :class="{ active: showControls }">
          <Settings :size="16" />
          <span>Controls</span>
        </button>
        
        <button @click="resetZoom" class="d3-btn">
          <RotateCcw :size="16" />
          <span>Reset</span>
        </button>
        <button @click="toggleFullscreen" class="d3-btn">
          <Maximize2 v-if="!isFullscreen" :size="16" />
          <Minimize2 v-else :size="16" />
        </button>
      </div>
    </div>


    <!-- Force Controls Panel -->
    <div v-if="showControls" class="controls-panel" :class="{ 'external-controls': externalControls }">
      <div class="controls-header">
        <h3 class="controls-title">Force Controls</h3>
        <div class="controls-actions">
          <button @click="resetToDefaults" class="controls-btn secondary">Reset to Defaults</button>
          <button @click="applyAndSave" class="controls-btn primary">Apply & Save</button>
        </div>
      </div>
      <div class="controls-grid">
        <div class="control-group">
          <label>Link Distance</label>
          <input 
            type="range" 
            v-model.number="forceSettings.linkDistance" 
            min="20" 
            max="200" 
            step="10"
            @input="updateForcesPreview"
            class="control-slider"
          />
          <span class="control-value">{{ forceSettings.linkDistance }}</span>
        </div>
        
        <div class="control-group">
          <label>Link Strength</label>
          <input 
            type="range" 
            v-model.number="forceSettings.linkStrength" 
            min="0.1" 
            max="2" 
            step="0.1"
            @input="updateForcesPreview"
            class="control-slider"
          />
          <span class="control-value">{{ forceSettings.linkStrength }}</span>
        </div>
        
        <div class="control-group">
          <label>Repulsion Force</label>
          <input 
            type="range" 
            v-model.number="forceSettings.chargeStrength" 
            min="-500" 
            max="-10" 
            step="10"
            @input="updateForcesPreview"
            class="control-slider"
          />
          <span class="control-value">{{ forceSettings.chargeStrength }}</span>
        </div>
        
        <div class="control-group">
          <label>Center Attraction</label>
          <input 
            type="range" 
            v-model.number="forceSettings.centerStrength" 
            min="0" 
            max="1" 
            step="0.05"
            @input="updateForcesPreview"
            class="control-slider"
          />
          <span class="control-value">{{ forceSettings.centerStrength }}</span>
        </div>
        
        <div class="control-group" v-if="currentLayout === 'radial'">
          <label>Radial Force</label>
          <input 
            type="range" 
            v-model.number="forceSettings.radialStrength" 
            min="0" 
            max="1" 
            step="0.05"
            @input="updateForcesPreview"
            class="control-slider"
          />
          <span class="control-value">{{ forceSettings.radialStrength }}</span>
        </div>
        
        <div class="control-group">
          <label>Link Width</label>
          <input 
            type="range" 
            v-model.number="forceSettings.linkWidth" 
            min="1" 
            max="10" 
            step="0.5"
            @input="updateVisualsPreview"
            class="control-slider"
          />
          <span class="control-value">{{ forceSettings.linkWidth }}</span>
        </div>
        
        <div class="control-group">
          <label>Topic Node Size</label>
          <input 
            type="range" 
            v-model.number="forceSettings.topicNodeSize" 
            min="4" 
            max="20" 
            step="1"
            @input="updateVisualsPreview"
            class="control-slider"
          />
          <span class="control-value">{{ forceSettings.topicNodeSize }}</span>
        </div>
        
        <div class="control-group">
          <label>Workspace Node Size</label>
          <input 
            type="range" 
            v-model.number="forceSettings.workspaceNodeSize" 
            min="1" 
            max="10" 
            step="0.5"
            @input="updateVisualsPreview"
            class="control-slider"
          />
          <span class="control-value">{{ forceSettings.workspaceNodeSize }}</span>
        </div>
      </div>
    </div>

    <!-- SVG Container -->
    <svg ref="svgRef" class="d3-svg" :style="{ background: `linear-gradient(135deg, ${getThemeAwareColors().backgroundGradient.from}, ${getThemeAwareColors().backgroundGradient.to})` }">
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" :fill="getThemeAwareColors().linkColor" />
        </marker>
      </defs>
      <g class="zoom-group">
        <!-- Links will be added here by D3 -->
        <g class="links-group"></g>
        <!-- Nodes will be added here by D3 -->
        <g class="nodes-group"></g>
        <!-- Labels will be added here by D3 -->
        <g class="labels-group"></g>
      </g>
    </svg>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <p>Loading visualization...</p>
      </div>
    </div>

    <!-- Node Tooltip -->
    <Teleport to="body">
      <div
        v-if="tooltip.visible"
        class="node-tooltip"
        :style="{
          left: tooltip.x + 'px',
          top: tooltip.y + 'px'
        }"
      >
        <div class="tooltip-content">
          <h4>{{ tooltip.data?.title }}</h4>
          <p v-if="tooltip.data?.type === 'topic'">
            {{ tooltip.data?.size }} workspaces
          </p>
          <p v-else-if="tooltip.data?.nodeCount">
            {{ tooltip.data?.nodeCount }} nodes
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue';
import * as d3 from 'd3';
import { RotateCcw, Maximize2, Minimize2, Settings } from 'lucide-vue-next';
import type { ClusteringStatus } from '@/services/clusteringService';
import { useThemeStore } from '@/stores/themeStore';

// Three.js imports for 3D rendering
interface ThreeJS {
  Scene: any;
  PerspectiveCamera: any;
  WebGLRenderer: any;
  SphereGeometry: any;
  MeshLambertMaterial: any;
  Mesh: any;
  DirectionalLight: any;
  AmbientLight: any;
  Vector3: any;
  Color: any;
  Raycaster: any;
  Vector2: any;
}

let THREE: ThreeJS | null = null;

interface Props {
  clusteringStatus: ClusteringStatus;
  externalControls?: boolean;
}

interface VisualizationData {
  points: number[][];
  clusters: number[];
  titles: string[];
  topics: Record<string, {
    topic: string;
    size: number;
    coherence: number;
    reflection: string;
  }>;
  chats_with_reflections: string[];
}

interface Node {
  id: string;
  type: 'topic' | 'workspace';
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
  title: string;
  clusterId?: number;
  size?: number;
  nodeCount?: number;
  color?: string;
}

interface Link {
  source: Node;
  target: Node;
}

interface ThemeColors {
  topicColors: string[];
  workspaceColor: string;
  linkColor: string;
  backgroundColor: string;
  backgroundGradient: {
    from: string;
    to: string;
  };
}

type ThemeName = 'light' | 'dark' | 'cupcake' | 'bumblebee' | 'emerald' | 'corporate' | 'synthwave' | 'retro' | 'cyberpunk' | 'valentine' | 'halloween' | 'garden' | 'forest' | 'aqua' | 'lofi' | 'pastel' | 'fantasy' | 'wireframe' | 'black' | 'luxury' | 'dracula' | 'cmyk' | 'autumn' | 'business' | 'acid' | 'lemonade' | 'night' | 'coffee' | 'winter';

const props = defineProps<Props>();
const emit = defineEmits<{
  selectWorkspace: [id: string];
  updateStats: [stats: { topics: number; workspaces: number }];
  update3DSupport: [supported: boolean];
  updateFullscreen: [fullscreen: boolean];
}>();

// Refs
const containerRef = ref<HTMLElement>();
const svgRef = ref<SVGElement>();
const isLoading = ref(false);
const isFullscreen = ref(false);
const visualizationData = ref<VisualizationData | null>(null);

// 3D state
let scene: any = null;
let camera: any = null;
let renderer: any = null;
let animationId: number | null = null;
let nodes3D: any[] = [];
let links3D: any[] = [];
let raycaster: any = null;
let mouse: any = null;
let selectedObject: any = null;

// D3 state (fallback)
let simulation: d3.Simulation<Node, Link> | null = null;
let svg: d3.Selection<SVGElement, unknown, null, undefined>;
let g: d3.Selection<SVGGElement, unknown, null, undefined>;
let zoom: d3.ZoomBehavior<SVGElement, unknown>;
let currentVisualizationLinks: any[] = [];

// 3D support flag
const is3DSupported = ref(false);

// Tooltip state
const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  data: null as Node | null
});

// Persistence helper functions
const loadSettingsFromStorage = () => {
  try {
    const saved = localStorage.getItem('d3-force-graph-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        layout: parsed.layout || 'radial',
        showControls: parsed.showControls || false,
        forces: {
          linkDistance: parsed.forces?.linkDistance ?? 80,
          linkStrength: parsed.forces?.linkStrength ?? 0.6,
          chargeStrength: parsed.forces?.chargeStrength ?? -100,
          centerStrength: parsed.forces?.centerStrength ?? 0.1,
          radialStrength: parsed.forces?.radialStrength ?? 0.3,
          collisionRadius: parsed.forces?.collisionRadius ?? 10,
          linkWidth: parsed.forces?.linkWidth ?? 2,
          topicNodeSize: parsed.forces?.topicNodeSize ?? 8,
          workspaceNodeSize: parsed.forces?.workspaceNodeSize ?? 3.5
        }
      };
    }
  } catch (error) {
    console.warn('Failed to load D3 force graph settings from localStorage:', error);
  }
  return null;
};

const saveSettingsToStorage = (layout: string, showControls: boolean, forces: any) => {
  try {
    const settings = {
      layout,
      showControls,
      forces: { ...forces }
    };
    localStorage.setItem('d3-force-graph-settings', JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save D3 force graph settings to localStorage:', error);
  }
};

// Load saved settings or use defaults
const savedSettings = loadSettingsFromStorage();

// Layout and force controls
const currentLayout = ref<'radial' | 'cluster' | 'hierarchical' | 'force-directed'>(
  savedSettings?.layout || 'radial'
);
const showControls = ref(savedSettings?.showControls || false);

const forceSettings = ref(
  savedSettings?.forces || {
    linkDistance: 80,
    linkStrength: 0.6,
    chargeStrength: -100,
    centerStrength: 0.1,
    radialStrength: 0.3,
    collisionRadius: 10,
    linkWidth: 2,
    topicNodeSize: 8,
    workspaceNodeSize: 3.5
  }
);

// Complete theme color mapping for all 28 themes with high contrast
const themeColorMaps: Record<ThemeName, ThemeColors> = {
  // Light themes
  light: {
    topicColors: ['#570DF8', '#F000B8', '#37CDBE', '#FF6B35', '#A8E6CF', '#FFD93D', '#6C5B7B', '#C06C84'],
    workspaceColor: '#8B5CF6',
    linkColor: '#94A3B8',
    backgroundColor: '#FEFEFE',
    backgroundGradient: { from: '#FEFEFE', to: '#F8FAFC' }
  },
  cupcake: {
    topicColors: ['#65C3C8', '#EF9FBC', '#EEAF3A', '#85C1E9', '#F8BBD9', '#A8E6CF', '#FFB3BA', '#BFEFFF'],
    workspaceColor: '#EF9FBC',
    linkColor: '#B8C6DB',
    backgroundColor: '#FAF0E6',
    backgroundGradient: { from: '#FAF0E6', to: '#F5F0F5' }
  },
  bumblebee: {
    topicColors: ['#F9D72F', '#E0A82E', '#181830', '#FFE066', '#FFF700', '#FFDB4D', '#B8860B', '#DAA520'],
    workspaceColor: '#E0A82E',
    linkColor: '#6B7280',
    backgroundColor: '#FFFBEB',
    backgroundGradient: { from: '#FFFBEB', to: '#FEF3C7' }
  },
  emerald: {
    topicColors: ['#66CC8A', '#377CFB', '#EA5234', '#4ECDC4', '#45B7D1', '#96CEB4', '#50FA7B', '#00FF7F'],
    workspaceColor: '#10B981',
    linkColor: '#9CA3AF',
    backgroundColor: '#F0FDF4',
    backgroundGradient: { from: '#F0FDF4', to: '#DCFCE7' }
  },
  corporate: {
    topicColors: ['#4B6BFB', '#7B92B2', '#EA5234', '#5A67D8', '#667EEA', '#764BA2', '#F093FB', '#F5576C'],
    workspaceColor: '#3B82F6',
    linkColor: '#9CA3AF',
    backgroundColor: '#F8FAFC',
    backgroundGradient: { from: '#F8FAFC', to: '#F1F5F9' }
  },
  garden: {
    topicColors: ['#5c7f67', '#be123c', '#9CA384', '#228B22', '#32CD32', '#90EE90', '#006400', '#9ACD32'],
    workspaceColor: '#16A34A',
    linkColor: '#9CA3AF',
    backgroundColor: '#F0FDF4',
    backgroundGradient: { from: '#F0FDF4', to: '#DCFCE7' }
  },
  lofi: {
    topicColors: ['#374151', '#6B7280', '#9CA3AF', '#4B5563', '#374151', '#1F2937', '#111827', '#6B7280'],
    workspaceColor: '#6B7280',
    linkColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    backgroundGradient: { from: '#F9FAFB', to: '#F3F4F6' }
  },
  pastel: {
    topicColors: ['#d1c1d7', '#f6cbd1', '#b4e9d6', '#FFCCCB', '#E0BBE4', '#C7CEEA', '#FDE2E4', '#DDA0DD'],
    workspaceColor: '#D8B4FE',
    linkColor: '#C4B5FD',
    backgroundColor: '#FEFEFE',
    backgroundGradient: { from: '#FEFEFE', to: '#FAF5FF' }
  },
  fantasy: {
    topicColors: ['#DC2626', '#EA580C', '#059669', '#7C2D12', '#B91C1C', '#CD5C5C', '#DC143C', '#F08080'],
    workspaceColor: '#DC2626',
    linkColor: '#9CA3AF',
    backgroundColor: '#FEF2F2',
    backgroundGradient: { from: '#FEF2F2', to: '#FECACA' }
  },
  wireframe: {
    topicColors: ['#6B7280', '#9CA3AF', '#D1D5DB', '#4B5563', '#374151', '#1F2937', '#E5E7EB', '#F3F4F6'],
    workspaceColor: '#6B7280',
    linkColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    backgroundGradient: { from: '#FFFFFF', to: '#F9FAFB' }
  },
  lemonade: {
    topicColors: ['#84CC16', '#65A30D', '#16A34A', '#22C55E', '#4ADE80', '#86EFAC', '#BBF7D0', '#DCFCE7'],
    workspaceColor: '#65A30D',
    linkColor: '#9CA3AF',
    backgroundColor: '#FEFCE8',
    backgroundGradient: { from: '#FEFCE8', to: '#FEF3C7' }
  },

  // Dark themes
  dark: {
    topicColors: ['#A855F7', '#EC4899', '#06B6D4', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6', '#F97316'],
    workspaceColor: '#A855F7',
    linkColor: '#6B7280',
    backgroundColor: '#0F172A',
    backgroundGradient: { from: '#0F172A', to: '#1E293B' }
  },
  synthwave: {
    topicColors: ['#E779C1', '#58C7F3', '#F3CC30', '#FF0080', '#00FFFF', '#FF1493', '#DA70D6', '#FF69B4'],
    workspaceColor: '#E779C1',
    linkColor: '#7C3AED',
    backgroundColor: '#1A0B2E',
    backgroundGradient: { from: '#1A0B2E', to: '#16213E' }
  },
  retro: {
    topicColors: ['#F59E0B', '#10B981', '#8B5CF6', '#F97316', '#EF4444', '#06B6D4', '#EC4899', '#84CC16'],
    workspaceColor: '#F59E0B',
    linkColor: '#78716C',
    backgroundColor: '#292524',
    backgroundGradient: { from: '#292524', to: '#44403C' }
  },
  cyberpunk: {
    topicColors: ['#FF0080', '#00FFFF', '#FFFF00', '#FF1493', '#00FF00', '#FF4500', '#9400D3', '#FF6347'],
    workspaceColor: '#FF0080',
    linkColor: '#0EA5E9',
    backgroundColor: '#0C0A09',
    backgroundGradient: { from: '#0C0A09', to: '#1C1917' }
  },
  valentine: {
    topicColors: ['#EC4899', '#F43F5E', '#FB7185', '#FBBF24', '#F97316', '#EF4444', '#DC2626', '#B91C1C'],
    workspaceColor: '#EC4899',
    linkColor: '#BE185D',
    backgroundColor: '#1F1115',
    backgroundGradient: { from: '#1F1115', to: '#2D1B27' }
  },
  halloween: {
    topicColors: ['#F97316', '#7C2D12', '#059669', '#FF6347', '#9400D3', '#FF8C00', '#8B008B', '#FF4500'],
    workspaceColor: '#F97316',
    linkColor: '#9333EA',
    backgroundColor: '#1C1917',
    backgroundGradient: { from: '#1C1917', to: '#292524' }
  },
  forest: {
    topicColors: ['#10B981', '#059669', '#047857', '#065F46', '#064E3B', '#022C22', '#14532D', '#166534'],
    workspaceColor: '#10B981',
    linkColor: '#6B7280',
    backgroundColor: '#0C1F17',
    backgroundGradient: { from: '#0C1F17', to: '#14532D' }
  },
  aqua: {
    topicColors: ['#06B6D4', '#0891B2', '#0E7490', '#155E75', '#164E63', '#083344', '#0369A1', '#0284C7'],
    workspaceColor: '#06B6D4',
    linkColor: '#64748B',
    backgroundColor: '#0F172A',
    backgroundGradient: { from: '#0F172A', to: '#1E293B' }
  },
  black: {
    topicColors: ['#6B7280', '#9CA3AF', '#D1D5DB', '#4B5563', '#374151', '#1F2937', '#E5E7EB', '#F3F4F6'],
    workspaceColor: '#9CA3AF',
    linkColor: '#4B5563',
    backgroundColor: '#000000',
    backgroundGradient: { from: '#000000', to: '#111827' }
  },
  luxury: {
    topicColors: ['#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F', '#451A03', '#FCD34D', '#FBBF24'],
    workspaceColor: '#F59E0B',
    linkColor: '#78716C',
    backgroundColor: '#1C1917',
    backgroundGradient: { from: '#1C1917', to: '#292524' }
  },
  dracula: {
    topicColors: ['#FF79C6', '#BD93F9', '#50FA7B', '#FFB86C', '#F1FA8C', '#8BE9FD', '#FF5555', '#6272A4'],
    workspaceColor: '#BD93F9',
    linkColor: '#6272A4',
    backgroundColor: '#282A36',
    backgroundGradient: { from: '#282A36', to: '#44475A' }
  },
  cmyk: {
    topicColors: ['#06B6D4', '#EC4899', '#FACC15', '#EF4444', '#8B5CF6', '#10B981', '#F97316', '#3B82F6'],
    workspaceColor: '#06B6D4',
    linkColor: '#6B7280',
    backgroundColor: '#0F172A',
    backgroundGradient: { from: '#0F172A', to: '#1E293B' }
  },
  autumn: {
    topicColors: ['#F97316', '#EA580C', '#DC2626', '#B91C1C', '#92400E', '#78350F', '#FBBF24', '#F59E0B'],
    workspaceColor: '#EA580C',
    linkColor: '#78716C',
    backgroundColor: '#1C1917',
    backgroundGradient: { from: '#1C1917', to: '#292524' }
  },
  business: {
    topicColors: ['#1E40AF', '#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE', '#EFF6FF'],
    workspaceColor: '#2563EB',
    linkColor: '#64748B',
    backgroundColor: '#0F172A',
    backgroundGradient: { from: '#0F172A', to: '#1E293B' }
  },
  acid: {
    topicColors: ['#FF00FF', '#00FF00', '#FFFF00', '#FF0080', '#80FF00', '#0080FF', '#FF8000', '#8000FF'],
    workspaceColor: '#FF00FF',
    linkColor: '#00FFFF',
    backgroundColor: '#000000',
    backgroundGradient: { from: '#000000', to: '#1A1A1A' }
  },
  night: {
    topicColors: ['#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#84CC16'],
    workspaceColor: '#3B82F6',
    linkColor: '#64748B',
    backgroundColor: '#0F172A',
    backgroundGradient: { from: '#0F172A', to: '#1E293B' }
  },
  coffee: {
    topicColors: ['#A16207', '#92400E', '#78350F', '#451A03', '#FBBF24', '#F59E0B', '#D97706', '#B45309'],
    workspaceColor: '#92400E',
    linkColor: '#78716C',
    backgroundColor: '#1C1917',
    backgroundGradient: { from: '#1C1917', to: '#292524' }
  },
  winter: {
    topicColors: ['#0EA5E9', '#0284C7', '#0369A1', '#075985', '#0C4A6E', '#082F49', '#7DD3FC', '#38BDF8'],
    workspaceColor: '#0284C7',
    linkColor: '#64748B',
    backgroundColor: '#0F172A',
    backgroundGradient: { from: '#0F172A', to: '#1E293B' }
  }
};

// Use ThemeStore for reactive theme detection
const themeStore = useThemeStore();

// Enhanced color scheme that adapts to all themes (using DOM since ThemeToggle bypasses store)
const getThemeAwareColors = (): ThemeColors => {
  return getThemeAwareColorsFromDOM();
};

// Current theme tracking (since ThemeToggle bypasses ThemeStore)
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');

// Debug current theme on mount
console.log('D3ForceGraph: Initial theme from DOM:', currentTheme.value);
console.log('D3ForceGraph: Initial theme from store:', themeStore.currentTheme);

// Enhanced color scheme that adapts to all themes
const getThemeAwareColorsFromDOM = (): ThemeColors => {
  const theme = currentTheme.value as ThemeName;
  return themeColorMaps[theme] || themeColorMaps.light;
};

// Update theme from DOM and recreate visualization
const updateThemeFromDOM = () => {
  const newTheme = document.documentElement.getAttribute('data-theme') || 'light';
  if (newTheme !== currentTheme.value) {
    const oldTheme = currentTheme.value;
    currentTheme.value = newTheme;
    const newColors = getThemeAwareColorsFromDOM();
    console.log(`D3ForceGraph: Theme changed from ${oldTheme} to: ${newTheme}`, {
      topicColors: newColors.topicColors,
      workspaceColor: newColors.workspaceColor,
      linkColor: newColors.linkColor,
      backgroundColor: newColors.backgroundColor,
      backgroundGradient: newColors.backgroundGradient
    });
    // Update colors instead of recreating entire visualization
    nextTick(() => {
      console.log('D3ForceGraph: Updating colors for new theme');
      if (is3DSupported.value && THREE && nodes3D.length > 0) {
        update3DColors();
      } else {
        updateColors();
      }
    });
  }
};

// Watch for theme changes via DOM observer (since ThemeToggle bypasses store)
let themeObserver: MutationObserver | null = null;

// Reactive color scale that updates with theme changes
const colorScale = computed(() => d3.scaleOrdinal(getThemeAwareColors().topicColors));

// Computed
const totalWorkspaces = computed(() => {
  return props.clusteringStatus?.clusters?.reduce((total, cluster) => {
    return total + cluster.workspaces.length;
  }, 0) || 0;
});

// Layout and control methods
const applyLayoutForces = () => {
  if (!simulation) return;
  
  // Clear existing forces
  simulation.force('link', null);
  simulation.force('charge', null);
  simulation.force('center', null);
  simulation.force('radial', null);
  simulation.force('x', null);
  simulation.force('y', null);
  simulation.force('collision', null);
  
  // Apply forces based on current layout
  switch (currentLayout.value) {
    case 'radial':
      applyRadialForces();
      break;
    case 'cluster':
      applyClusterForces();
      break;
    case 'hierarchical':
      applyHierarchicalForces();
      break;
    case 'force-directed':
      applyForceDirectedForces();
      break;
  }
  
  simulation.alpha(0.3).restart();
};

const applyRadialForces = () => {
  simulation
    .force('link', d3.forceLink(currentVisualizationLinks).id(d => d.id).distance(forceSettings.value.linkDistance).strength(forceSettings.value.linkStrength))
    .force('charge', d3.forceManyBody().strength(d => d.type === 'topic' ? forceSettings.value.chargeStrength * 2 : forceSettings.value.chargeStrength))
    .force('collision', d3.forceCollide().radius(d => d.type === 'topic' ? forceSettings.value.topicNodeSize + 5 : forceSettings.value.workspaceNodeSize + 2))
    .force('center', d3.forceCenter(0, 0).strength(forceSettings.value.centerStrength))
    .force('radial', d3.forceRadial(d => d.type === 'topic' ? 40 : 140, 0, 0).strength(forceSettings.value.radialStrength));
};

const applyClusterForces = () => {
  simulation
    .force('link', d3.forceLink(currentVisualizationLinks).id(d => d.id).distance(forceSettings.value.linkDistance).strength(forceSettings.value.linkStrength))
    .force('charge', d3.forceManyBody().strength(forceSettings.value.chargeStrength))
    .force('collision', d3.forceCollide().radius(d => d.type === 'topic' ? forceSettings.value.topicNodeSize + 5 : forceSettings.value.workspaceNodeSize + 2))
    .force('x', d3.forceX(d => {
      // Cluster topics horizontally
      const topicCount = Object.keys(visualizationData.value?.topics || {}).length;
      return d.type === 'topic' ? (d.clusterId - topicCount / 2) * 200 : 0;
    }).strength(0.3))
    .force('y', d3.forceY().strength(0.1));
};

const applyHierarchicalForces = () => {
  simulation
    .force('link', d3.forceLink(currentVisualizationLinks).id(d => d.id).distance(forceSettings.value.linkDistance * 1.5).strength(forceSettings.value.linkStrength))
    .force('charge', d3.forceManyBody().strength(forceSettings.value.chargeStrength * 0.5))
    .force('collision', d3.forceCollide().radius(d => d.type === 'topic' ? forceSettings.value.topicNodeSize + 5 : forceSettings.value.workspaceNodeSize + 2))
    .force('y', d3.forceY(d => d.type === 'topic' ? -100 : 100).strength(0.8))
    .force('x', d3.forceX().strength(0.1));
};

const applyForceDirectedForces = () => {
  simulation
    .force('link', d3.forceLink(currentVisualizationLinks).id(d => d.id).distance(forceSettings.value.linkDistance).strength(forceSettings.value.linkStrength))
    .force('charge', d3.forceManyBody().strength(forceSettings.value.chargeStrength))
    .force('collision', d3.forceCollide().radius(d => d.type === 'topic' ? forceSettings.value.topicNodeSize + 5 : forceSettings.value.workspaceNodeSize + 2))
    .force('center', d3.forceCenter(0, 0).strength(forceSettings.value.centerStrength));
};

const switchLayout = () => {
  applyLayoutForces();
  saveSettings();
};

const updateForces = () => {
  if (simulation) {
    applyLayoutForces();
  }
  saveSettings();
};

const updateVisuals = () => {
  if (!svgRef.value) return;
  
  // Update link width
  d3.select(svgRef.value)
    .selectAll('.links-group line')
    .attr('stroke-width', forceSettings.value.linkWidth);
  
  // Update node sizes
  d3.select(svgRef.value)
    .selectAll('.nodes-group circle')
    .attr('r', d => d.type === 'topic' ? forceSettings.value.topicNodeSize : forceSettings.value.workspaceNodeSize);
  
  saveSettings();
};

const updateColors = () => {
  if (!svgRef.value) {
    console.log('D3ForceGraph: No SVG ref available for color update');
    return;
  }
  
  const colors = getThemeAwareColors();
  console.log('D3ForceGraph: Updating colors with:', colors);
  
  // Update link colors
  const links = d3.select(svgRef.value).selectAll('.links-group line');
  console.log('D3ForceGraph: Found', links.size(), 'links to update');
  links.attr('stroke', colors.linkColor);
  
  // Update node colors
  const nodes = d3.select(svgRef.value).selectAll('.nodes-group circle');
  console.log('D3ForceGraph: Found', nodes.size(), 'nodes to update');
  nodes
    .attr('fill', d => {
      if (d.type === 'topic') {
        // Topic nodes: transparent with thick border
        return 'transparent';
      } else {
        // Workspace nodes: solid color
        const color = colors.topicColors[d.clusterId % colors.topicColors.length];
        console.log('D3ForceGraph: Setting workspace node color:', color);
        return color;
      }
    })
    .attr('stroke', d => {
      if (d.type === 'topic') {
        // Topic nodes: thick colored border
        const color = colors.topicColors[d.clusterId % colors.topicColors.length];
        console.log('D3ForceGraph: Setting topic node stroke:', color);
        return color;
      } else {
        // Workspace nodes: theme background color border
        return colors.backgroundColor;
      }
    });
  
  // Update SVG background
  d3.select(svgRef.value)
    .style('background', `linear-gradient(135deg, ${colors.backgroundGradient.from}, ${colors.backgroundGradient.to})`);
  
  console.log('D3ForceGraph: Color update completed');
};

const update3DColors = () => {
  if (!THREE || !renderer || !scene || !nodes3D.length) return;
  
  const colors = getThemeAwareColors();
  
  // Update renderer background
  const bgColor = new THREE.Color(colors.backgroundColor);
  renderer.setClearColor(bgColor, 1);
  
  // Update node materials
  nodes3D.forEach((mesh, index) => {
    if (mesh.userData.type === 'topic') {
      // Topic nodes: use cluster color
      const clusterId = mesh.userData.clusterId || 0;
      const color = new THREE.Color(colors.topicColors[clusterId % colors.topicColors.length]);
      mesh.material.color = color;
    } else if (mesh.userData.type === 'workspace') {
      // Workspace nodes: use cluster color
      const clusterId = mesh.userData.clusterId || 0;
      const color = new THREE.Color(colors.topicColors[clusterId % colors.topicColors.length]);
      mesh.material.color = color;
    }
  });
};

const saveSettings = () => {
  saveSettingsToStorage(currentLayout.value, showControls.value, forceSettings.value);
};

const toggleControls = () => {
  showControls.value = !showControls.value;
  saveSettings();
};

const updateForcesPreview = () => {
  if (simulation) {
    applyLayoutForces();
  }
};

const updateVisualsPreview = () => {
  if (!svgRef.value) return;
  
  // Update link width
  d3.select(svgRef.value)
    .selectAll('.links-group line')
    .attr('stroke-width', forceSettings.value.linkWidth);
  
  // Update node sizes
  d3.select(svgRef.value)
    .selectAll('.nodes-group circle')
    .attr('r', d => d.type === 'topic' ? forceSettings.value.topicNodeSize : forceSettings.value.workspaceNodeSize);
};

const applyAndSave = () => {
  updateForcesPreview();
  updateVisualsPreview();
  saveSettings();
};

const resetToDefaults = () => {
  forceSettings.value = {
    linkDistance: 80,
    linkStrength: 0.6,
    chargeStrength: -100,
    centerStrength: 0.1,
    radialStrength: 0.3,
    collisionRadius: 10,
    linkWidth: 2,
    topicNodeSize: 8,
    workspaceNodeSize: 3.5
  };
  currentLayout.value = 'radial';
  applyAndSave();
};

// Methods
const fetchVisualizationData = async () => {
  try {
    isLoading.value = true;
    
    // Use clustering data from props instead of separate API call
    if (props.clusteringStatus?.clusters && props.clusteringStatus.clusters.length > 0) {
      // Transform clustering data to visualization format
      const topics: Record<string, any> = {};
      const points: number[][] = [];
      const clusters: number[] = [];
      const titles: string[] = [];
      
      props.clusteringStatus.clusters.forEach((cluster, clusterIndex) => {
        // Add topic for this cluster
        topics[clusterIndex.toString()] = {
          topic: cluster.topic || `Cluster ${clusterIndex + 1}`,
          size: cluster.workspaces.length,
          coherence: cluster.coherence || 0.8,
          reflection: cluster.reflection || `Topic about ${cluster.topic || 'general discussion'}`
        };
        
        // Add workspaces for this cluster
        cluster.workspaces.forEach((workspace, workspaceIndex) => {
          // Generate reasonable 2D positions in a circle around cluster center
          const angle = (workspaceIndex / cluster.workspaces.length) * Math.PI * 2;
          const radius = 50 + Math.random() * 30; // Some spread
          const clusterX = (clusterIndex - props.clusteringStatus.clusters.length / 2) * 200;
          const clusterY = 0;
          
          points.push([
            clusterX + Math.cos(angle) * radius,
            clusterY + Math.sin(angle) * radius
          ]);
          clusters.push(clusterIndex);
          titles.push(workspace.title || `Workspace ${workspaceIndex + 1}`);
        });
      });
      
      visualizationData.value = {
        topics,
        points,
        clusters,
        titles,
        chats_with_reflections: titles // For now, assume all have reflections
      };
      
      console.log('Generated visualization data from clustering:', visualizationData.value);
      
      // Emit stats for external controls
      emit('updateStats', { 
        topics: Object.keys(topics).length, 
        workspaces: titles.length 
      });
    } else {
      console.warn('No clustering data available for visualization');
    }
  } catch (error) {
    console.error('Error preparing visualization data:', error);
  } finally {
    isLoading.value = false;
  }
};

const createVisualization = async () => {
  if (!visualizationData.value || !containerRef.value) {
    console.warn('Missing data or container for visualization');
    return;
  }

  const data = visualizationData.value;
  const container = containerRef.value;
  const width = container.clientWidth;
  const height = container.clientHeight;

  console.log('Creating visualization with data:', data);
  console.log('Container dimensions:', width, 'x', height);

  // Try to use 3D if supported, fallback to lofi force graph
  if (is3DSupported.value && THREE) {
    console.log('Using 3D visualization');
    create3DVisualization(data, width, height);
  } else {
    console.log('Using Lofi Force Graph visualization');
    if (!svgRef.value) {
      console.error('SVG ref not available for 2D visualization');
      return;
    }
    createLofiForceGraph(data, width, height);
  }
};

const create3DVisualization = (data: VisualizationData, width: number, height: number) => {
  if (!THREE || !containerRef.value) return;

  // Clear previous 3D scene
  if (renderer && renderer.domElement && renderer.domElement.parentNode === containerRef.value) {
    containerRef.value.removeChild(renderer.domElement);
  }

  // Setup 3D scene
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  
  // Get theme colors first
  const colors = getThemeAwareColors();
  
  renderer.setSize(width, height);
  // Set theme-aware background color for 3D scene
  const bgColor = new THREE.Color(colors.backgroundColor);
  renderer.setClearColor(bgColor, 1);
  containerRef.value.appendChild(renderer.domElement);

  // Setup lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 10, 5);
  scene.add(directionalLight);

  // Setup raycaster for mouse interaction
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  nodes3D = [];
  links3D = [];

  // Create topic nodes (larger, solid colored spheres)
  Object.entries(data.topics).forEach(([clusterId, topicData], index) => {
    const geometry = new THREE.SphereGeometry(3, 32, 32);
    const color = new THREE.Color(colors.topicColors[index % colors.topicColors.length]);
    const material = new THREE.MeshLambertMaterial({ 
      color: color,
      transparent: false,
      opacity: 1.0
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position topics in a circle
    const angle = (index / Object.keys(data.topics).length) * Math.PI * 2;
    const radius = 20;
    mesh.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0
    );
    
    mesh.userData = {
      id: `topic-${clusterId}`,
      type: 'topic',
      title: topicData.topic,
      size: topicData.size,
      clusterId: parseInt(clusterId)
    };
    
    scene.add(mesh);
    nodes3D.push(mesh);
  });

  // Create workspace nodes (smaller, semi-transparent spheres)
  data.points.forEach((point, index) => {
    const geometry = new THREE.SphereGeometry(1, 16, 16);
    const clusterIndex = data.clusters[index];
    const color = new THREE.Color(colors.topicColors[clusterIndex % colors.topicColors.length]);
    const material = new THREE.MeshLambertMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.7
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position workspaces around their topic
    const topicNode = nodes3D.find(n => n.userData.clusterId === clusterIndex);
    if (topicNode) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 5
      );
      mesh.position.copy(topicNode.position).add(offset);
    }
    
    mesh.userData = {
      id: `workspace-${index}`,
      type: 'workspace',
      title: data.titles[index],
      clusterId: clusterIndex
    };
    
    scene.add(mesh);
    nodes3D.push(mesh);
  });

  // Position camera
  camera.position.set(0, 0, 50);
  camera.lookAt(0, 0, 0);

  // Add mouse interaction
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onClick3D);

  // Start animation loop
  animate3D();
};

const createLofiForceGraph = (data: VisualizationData, width: number, height: number) => {
  // Clear previous visualization
  d3.select(svgRef.value!).selectAll("*").remove();

  // Get theme colors
  const colors = getThemeAwareColors();
  
  // Create radial layout with topics in center, workspaces on outer ring
  const nodes = [];
  const links = [];
  const topicCount = Object.keys(data.topics).length;
  
  // Create nodes for each cluster (topic + workspaces)
  Object.entries(data.topics).forEach(([clusterId, topicData], topicIndex) => {
    const clusterIdNum = parseInt(clusterId);
    
    // Create topic node positioned near center (inner ring)
    const topicAngle = (topicIndex / topicCount) * Math.PI * 2;
    const topicRadius = Math.min(50, topicCount * 8); // Small radius for center clustering
    
    const topicNode = {
      id: `topic-${clusterId}`,
      name: topicData.topic,
      type: 'topic',
      clusterId: clusterIdNum,
      x: Math.cos(topicAngle) * topicRadius,
      y: Math.sin(topicAngle) * topicRadius,
      fx: null, // Allow movement but bias toward center
      fy: null
    };
    nodes.push(topicNode);
    
    // Create workspace nodes for this cluster (outer ring)
    const workspaceNodes = data.points
      .map((point, index) => ({
        id: `workspace-${index}`,
        name: data.titles[index],
        clusterId: data.clusters[index],
        workspaceIndex: index,
        type: 'workspace'
      }))
      .filter(workspace => workspace.clusterId === clusterIdNum);
    
    // Position workspaces in an arc around their topic
    workspaceNodes.forEach((workspaceNode, workspaceIndex) => {
      const workspaceCount = workspaceNodes.length;
      const arcSpan = Math.PI / 3; // 60 degree arc per topic
      const startAngle = topicAngle - arcSpan / 2;
      const workspaceAngle = startAngle + (workspaceIndex / Math.max(1, workspaceCount - 1)) * arcSpan;
      const workspaceRadius = 120 + Math.random() * 40; // Outer ring with some variation
      
      workspaceNode.x = Math.cos(workspaceAngle) * workspaceRadius;
      workspaceNode.y = Math.sin(workspaceAngle) * workspaceRadius;
    });
    
    nodes.push(...workspaceNodes);
    
    // Create links from topic to its workspaces
    workspaceNodes.forEach(workspaceNode => {
      links.push({
        source: topicNode.id,
        target: workspaceNode.id
      });
    });
  });

  // Store links for force updates
  currentVisualizationLinks = links;

  console.log('Nodes:', nodes);
  console.log('Links:', links);

  // Setup SVG with centered viewBox and zoom behavior
  svg = d3.select(svgRef.value!)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [-width / 2, -height / 2, width, height])
    .style('background', `linear-gradient(135deg, ${colors.backgroundGradient.from}, ${colors.backgroundGradient.to})`)
    .style('cursor', 'grab');

  // Create zoom behavior
  zoom = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    })
    .on('start', () => {
      svg.style('cursor', 'grabbing');
    })
    .on('end', () => {
      svg.style('cursor', 'grab');
    });

  svg.call(zoom);

  // Create main group that will be transformed by zoom
  g = svg.append('g').attr('class', 'zoom-group');

  // Create force simulation based on current layout
  simulation = d3.forceSimulation(nodes);
  applyLayoutForces();

  // Create links
  const link = g.append('g')
    .attr('class', 'links-group')
    .attr('stroke', colors.linkColor)
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', forceSettings.value.linkWidth)
    .selectAll('line')
    .data(links)
    .join('line');

  // Create nodes
  const node = g.append('g')
    .attr('class', 'nodes-group')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', d => d.type === 'topic' ? forceSettings.value.topicNodeSize : forceSettings.value.workspaceNodeSize)
    .attr('fill', d => {
      if (d.type === 'topic') {
        // Topic nodes: transparent with thick border
        return 'transparent';
      } else {
        // Workspace nodes: solid color
        return colors.topicColors[d.clusterId % colors.topicColors.length];
      }
    })
    .attr('stroke', d => {
      if (d.type === 'topic') {
        // Topic nodes: thick colored border
        return colors.topicColors[d.clusterId % colors.topicColors.length];
      } else {
        // Workspace nodes: theme background color border
        return colors.backgroundColor;
      }
    })
    .attr('stroke-width', d => d.type === 'topic' ? 3 : 1.5)
    .style('cursor', 'pointer')
    .call(drag(simulation))
    .on('click', (event, d) => {
      if (d.type === 'workspace' && d.workspaceIndex !== undefined) {
        // Handle workspace selection
        const cluster = props.clusteringStatus.clusters[d.clusterId];
        if (cluster && cluster.workspaces[d.workspaceIndex]) {
          const workspace = cluster.workspaces[d.workspaceIndex];
          emit('selectWorkspace', workspace.id);
        }
      }
    })
    .on('mouseover', (event, d) => {
      showTooltip(event, {
        title: d.name,
        type: d.type,
        size: d.type === 'topic' ? nodes.filter(n => n.type === 'workspace' && n.clusterId === d.clusterId).length : undefined
      });
    })
    .on('mouseout', hideTooltip);

  // Add titles for accessibility
  node.append('title')
    .text(d => d.name || '');

  // Helper function to calculate link endpoints that stop at circle edges
  function linkArc(d) {
    const source = d.source;
    const target = d.target;
    
    // Check for valid coordinates
    if (!source || !target || 
        isNaN(source.x) || isNaN(source.y) || 
        isNaN(target.x) || isNaN(target.y)) {
      return { x1: 0, y1: 0, x2: 0, y2: 0 };
    }
    
    // Calculate distance between nodes
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0 || isNaN(distance)) {
      return { x1: source.x || 0, y1: source.y || 0, x2: target.x || 0, y2: target.y || 0 };
    }
    
    // Calculate unit vector
    const ux = dx / distance;
    const uy = dy / distance;
    
    // Get node radii
    const sourceRadius = source.type === 'topic' ? forceSettings.value.topicNodeSize : forceSettings.value.workspaceNodeSize;
    const targetRadius = target.type === 'topic' ? forceSettings.value.topicNodeSize : forceSettings.value.workspaceNodeSize;
    
    // Calculate start and end points at circle edges
    const x1 = source.x + ux * sourceRadius;
    const y1 = source.y + uy * sourceRadius;
    const x2 = target.x - ux * targetRadius;
    const y2 = target.y - uy * targetRadius;
    
    return { x1, y1, x2, y2 };
  }

  // Update positions on tick
  simulation.on('tick', () => {
    link.each(function(d) {
      const coords = linkArc(d);
      d3.select(this)
        .attr('x1', coords.x1)
        .attr('y1', coords.y1)
        .attr('x2', coords.x2)
        .attr('y2', coords.y2);
    });

    node
      .attr('cx', d => d.x || 0)
      .attr('cy', d => d.y || 0);
  });

  // Drag behavior
  function drag(simulation) {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }
};

const showTooltip = (event: MouseEvent, d: Node) => {
  tooltip.value = {
    visible: true,
    x: event.clientX + 10,
    y: event.clientY - 10,
    data: d
  };
};

const hideTooltip = () => {
  tooltip.value.visible = false;
};

// 3D Animation and interaction functions
const animate3D = () => {
  if (!scene || !camera || !renderer) return;
  
  animationId = requestAnimationFrame(animate3D);
  
  // Rotate the scene slowly
  if (nodes3D.length > 0) {
    nodes3D.forEach((node, index) => {
      if (node.userData.type === 'workspace') {
        // Orbit workspace nodes around their topics
        const time = Date.now() * 0.001;
        const offset = index * 0.1;
        node.rotation.y = time + offset;
      }
    });
  }
  
  renderer.render(scene, camera);
};

const onMouseMove = (event: MouseEvent) => {
  if (!camera || !raycaster) return;
  
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(nodes3D);
  
  // Reset all materials
  nodes3D.forEach(node => {
    if (node.userData.type === 'topic') {
      node.material.emissive.setHex(0x000000);
    }
  });
  
  if (intersects.length > 0) {
    const object = intersects[0].object;
    if (object.userData.type === 'topic') {
      object.material.emissive.setHex(0x222222);
    }
    
    // Show tooltip
    showTooltip(event, object.userData);
  } else {
    hideTooltip();
  }
};

const onClick3D = (event: MouseEvent) => {
  if (!camera || !raycaster) return;
  
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(nodes3D);
  
  if (intersects.length > 0) {
    const object = intersects[0].object;
    if (object.userData.type === 'workspace') {
      // Find the actual workspace ID from clustering data
      const workspaceIndex = parseInt(object.userData.id.split('-')[1]);
      const cluster = props.clusteringStatus.clusters[object.userData.clusterId!];
      if (cluster && cluster.workspaces[workspaceIndex % cluster.workspaces.length]) {
        const workspace = cluster.workspaces[workspaceIndex % cluster.workspaces.length];
        emit('selectWorkspace', workspace.id);
      }
    }
  }
};

const resetZoom = () => {
  if (is3DSupported.value && camera) {
    // Reset 3D camera position
    camera.position.set(0, 0, 50);
    camera.lookAt(0, 0, 0);
  } else if (svg && zoom) {
    // Reset 2D zoom and pan
    svg.transition()
      .duration(750)
      .call(zoom.transform, d3.zoomIdentity);
  }
};

const toggleFullscreen = async () => {
  try {
    if (!isFullscreen.value) {
      await containerRef.value?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.error('Error toggling fullscreen:', error);
  }
};

// Handle fullscreen changes
const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement;
  emit('updateFullscreen', isFullscreen.value);
  // Recreate visualization with new dimensions
  nextTick(() => {
    createVisualization();
  });
};

// Handle window resize
const handleResize = () => {
  nextTick(() => {
    createVisualization();
  });
};

// Watchers
watch(() => props.clusteringStatus, async (newStatus) => {
  console.log('Clustering status updated:', newStatus);
  if (newStatus?.clusters && newStatus.clusters.length > 0) {
    await fetchVisualizationData();
    await nextTick();
    createVisualization();
  }
}, { immediate: true, deep: true });

// Methods to handle external control updates
const updateLayout = (layout: string) => {
  currentLayout.value = layout as any;
  switchLayout();
};

const updateShowControls = (show: boolean) => {
  showControls.value = show;
};

const resetGraph = () => {
  resetZoom();
};

// Expose methods for parent component
defineExpose({
  updateLayout,
  updateShowControls,
  resetGraph,
  toggleFullscreen
});

// Initialize Three.js if available
const initThreeJS = async () => {
  try {
    // Dynamically import Three.js
    const threeModule = await import('three');
    THREE = {
      Scene: threeModule.Scene,
      PerspectiveCamera: threeModule.PerspectiveCamera,
      WebGLRenderer: threeModule.WebGLRenderer,
      SphereGeometry: threeModule.SphereGeometry,
      MeshLambertMaterial: threeModule.MeshLambertMaterial,
      Mesh: threeModule.Mesh,
      DirectionalLight: threeModule.DirectionalLight,
      AmbientLight: threeModule.AmbientLight,
      Vector3: threeModule.Vector3,
      Color: threeModule.Color,
      Raycaster: threeModule.Raycaster,
      Vector2: threeModule.Vector2
    };
    is3DSupported.value = true;
    console.log('Three.js loaded successfully - 3D visualization enabled');
    emit('update3DSupport', true);
  } catch (error) {
    console.log('Three.js not available - falling back to 2D visualization');
    is3DSupported.value = false;
    emit('update3DSupport', false);
  }
};

// Lifecycle
onMounted(async () => {
  await initThreeJS();
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  window.addEventListener('resize', handleResize);
  
  // Set up theme change observer (since ThemeToggle bypasses ThemeStore)
  themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        console.log('D3ForceGraph: data-theme mutation detected!');
        updateThemeFromDOM();
      }
    });
  });
  
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
});

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  window.removeEventListener('resize', handleResize);
  
  // Cleanup theme observer
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
  
  // Cleanup 3D resources
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (renderer && renderer.domElement && containerRef.value && renderer.domElement.parentNode === containerRef.value) {
    containerRef.value.removeChild(renderer.domElement);
  }
  
  // Cleanup 2D resources
  if (simulation) {
    simulation.stop();
  }
});
</script>

<style scoped>
.d3-force-graph-container {
  @apply relative w-full h-full;
  background: oklch(var(--b1));
  min-height: 600px;
  transition: background-color 0.3s ease;
}

/* Controls */
.d3-controls {
  @apply absolute top-4 left-4 right-4 z-10;
  @apply flex items-center justify-between;
  @apply backdrop-blur-sm rounded-lg px-4 py-2;
  background: oklch(from oklch(var(--b1)) l c h / 0.9);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.15);
  box-shadow: 0 4px 12px oklch(from oklch(var(--b1)) l c h / 0.3);
  transition: all 0.3s ease;
}

.d3-controls.external-controls {
  @apply top-20; /* Position below the external WorkspaceControlsDock */
}

/* Minimal info bar when using external controls */
.d3-minimal-info {
  @apply absolute top-4 left-4 right-4 z-10;
  @apply flex items-center justify-between;
  @apply backdrop-blur-sm rounded-lg px-4 py-2;
  background: oklch(from oklch(var(--b1)) l c h / 0.7);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  box-shadow: 0 2px 8px oklch(from oklch(var(--b1)) l c h / 0.2);
  transition: all 0.3s ease;
}

.d3-btn.minimal {
  @apply px-2 py-1;
  font-size: 11px;
}

/* Controls Panel */
.controls-panel {
  @apply absolute top-20 left-4 right-4 z-10;
  @apply backdrop-blur-sm rounded-lg p-4;
  background: oklch(from oklch(var(--b1)) l c h / 0.95);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.15);
  box-shadow: 0 4px 12px oklch(from oklch(var(--b1)) l c h / 0.3);
  max-height: 400px;
  overflow-y: auto;
}

.controls-panel.external-controls {
  @apply top-36; /* Position below both external controls and d3-controls */
}

.controls-header {
  @apply flex items-center justify-between mb-4 pb-3;
  border-bottom: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
}

.controls-title {
  @apply text-lg font-semibold;
  color: oklch(var(--bc));
}

.controls-actions {
  @apply flex gap-2;
}

.controls-btn {
  @apply px-3 py-1.5 rounded-lg text-sm font-medium;
  @apply border transition-all duration-200;
  cursor: pointer;
}

.controls-btn.primary {
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border: 1px solid oklch(var(--p));
}

.controls-btn.primary:hover {
  background: oklch(from oklch(var(--p)) calc(l - 0.1) c h);
}

.controls-btn.secondary {
  background: oklch(var(--b1));
  color: oklch(var(--bc));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.2);
}

.controls-btn.secondary:hover {
  background: oklch(from oklch(var(--b2)) l c h / 0.8);
}

.controls-grid {
  @apply grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4;
}

.control-group {
  @apply flex flex-col gap-1;
}

.control-group label {
  @apply text-xs font-medium;
  color: oklch(var(--bc));
}

.control-slider {
  @apply w-full h-2 rounded-lg appearance-none cursor-pointer;
  background: oklch(from oklch(var(--bc)) l c h / 0.2);
}

.control-slider::-webkit-slider-thumb {
  @apply appearance-none w-4 h-4 rounded-full cursor-pointer;
  background: oklch(var(--p));
}

.control-slider::-moz-range-thumb {
  @apply w-4 h-4 rounded-full cursor-pointer border-0;
  background: oklch(var(--p));
}

.control-value {
  @apply text-xs text-center;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
}

/* Layout Select */
.layout-select {
  @apply px-3 py-2 rounded-lg text-sm font-medium;
  @apply border transition-all duration-200;
  background: oklch(var(--b1));
  color: oklch(var(--bc));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.2);
}

.layout-select:focus {
  outline: none;
  border-color: oklch(var(--p));
}

.d3-stats {
  @apply flex gap-2;
}

.stat-badge {
  @apply px-3 py-1 rounded-full text-xs font-medium;
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  color: oklch(var(--p));
  border: 1px solid oklch(from oklch(var(--p)) l c h / 0.2);
  transition: all 0.2s ease;
}

.mode-badge {
  background: oklch(from oklch(var(--s)) l c h / 0.15);
  color: oklch(var(--s));
  border: 1px solid oklch(from oklch(var(--s)) l c h / 0.3);
  font-weight: 600;
}

.mode-badge.3d-mode {
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.2),
    oklch(from oklch(var(--a)) l c h / 0.2));
  color: oklch(var(--p));
  border: 1px solid oklch(from oklch(var(--p)) l c h / 0.4);
  box-shadow: 0 2px 8px oklch(from oklch(var(--p)) l c h / 0.2);
}

.d3-actions {
  @apply flex items-center gap-3;
}

.interaction-hint {
  @apply hidden md:block;
}

.hint-text {
  @apply text-xs;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.d3-btn {
  @apply flex items-center gap-2 px-3 py-2 rounded-lg;
  @apply text-sm font-medium transition-all duration-200;
  background: oklch(var(--b1));
  color: oklch(var(--bc));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.2);
}

.d3-btn:hover {
  background: oklch(from oklch(var(--b2)) l c h / 0.8);
  border-color: oklch(from oklch(var(--bc)) l c h / 0.3);
}

.d3-btn.active {
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border-color: oklch(var(--p));
}

/* SVG */
.d3-svg {
  @apply w-full h-full;
  /* Background is now set dynamically via :style binding */
}

/* Loading */
.loading-overlay {
  @apply absolute inset-0 flex items-center justify-center;
  background: oklch(from oklch(var(--b1)) l c h / 0.9);
  backdrop-filter: blur(4px);
}

.loading-content {
  @apply text-center;
}

.loading-spinner {
  @apply w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3;
}

/* Tooltip */
.node-tooltip {
  @apply fixed z-50 pointer-events-none;
}

.tooltip-content {
  @apply rounded-lg px-3 py-2 shadow-lg;
  background: oklch(var(--b1));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.2);
  @apply text-sm max-w-xs;
}

.tooltip-content h4 {
  @apply font-semibold mb-1;
  color: oklch(var(--bc));
}

.tooltip-content p {
  @apply text-xs;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
}

/* Responsive */
@media (max-width: 768px) {
  .d3-controls {
    @apply flex-col gap-2;
  }
  
  .stat-badge {
    @apply text-xs px-2 py-1;
  }
}
</style>