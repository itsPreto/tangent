<template>
  <div class="workspace-controls-dock" :style="dockPositionStyle">
    <div class="dock-container">
      <!-- View Mode Selector -->
      <div class="view-mode-selector">
        <button 
          v-for="(mode, index) in viewModes" 
          :key="mode.id"
          @click="$emit('update:viewMode', mode.id)"
          class="view-mode-btn"
          :class="{ 'active': currentViewMode === mode.id }"
        >
          <component :is="mode.icon" :size="16" />
          <span v-if="!isCompact">{{ mode.label }}</span>
        </button>
      </div>

      <!-- Graph-specific controls when in graph mode -->
      <template v-if="currentViewMode === 'graph'">
        <!-- Stats -->
        <div class="stats-section">
          <span class="stat-badge">{{ graphStats.topics || 0 }} Topics</span>
          <span class="stat-badge">{{ graphStats.workspaces || 0 }} Workspaces</span>
        </div>

        <!-- Interaction Hints -->
        <div class="interaction-hint">
          <span class="hint-text">
            {{ is3DSupported ? 'Mouse to rotate • Click nodes • Scroll to zoom' : 'Drag to pan • Scroll to zoom • Drag nodes • Click workspaces to open' }}
          </span>
        </div>

        <!-- Layout Selector -->
        <select 
          :value="graphLayout" 
          @input="$emit('update:graphLayout', $event.target.value)" 
          class="layout-select"
        >
          <option value="radial">Radial</option>
          <option value="cluster">Cluster</option>
          <option value="hierarchical">Hierarchical</option>
          <option value="force-directed">Force-Directed</option>
        </select>

        <!-- Graph Controls -->
        <button 
          @click="$emit('toggle-graph-controls')" 
          class="control-btn"
          :class="{ 'active': showGraphControls }"
        >
          <Settings :size="16" />
          <span v-if="!isCompact">Controls</span>
        </button>

        <button @click="$emit('reset-graph')" class="control-btn">
          <RotateCcw :size="16" />
          <span v-if="!isCompact">Reset</span>
        </button>

        <!-- Fullscreen -->
        <button @click="$emit('toggle-fullscreen')" class="control-btn">
          <Maximize2 v-if="!isFullscreen" :size="16" />
          <Minimize2 v-else :size="16" />
        </button>
      </template>

      <!-- Regular controls for non-graph modes -->
      <template v-else>
        <!-- Sort & Filter -->
        <div class="filter-controls">
          <select :value="sortBy" @input="$emit('update:sortBy', $event.target.value)" class="sort-select">
            <option value="recent">Recently Updated</option>
            <option value="created">Date Created</option>
            <option value="name">Name A-Z</option>
            <option value="size">Size (Nodes)</option>
            <option value="activity">Most Active</option>
          </select>

          <button 
            @click="$emit('toggle-filters')" 
            class="filter-btn"
            :class="{ 'active': hasActiveFilters }"
          >
            <Filter :size="16" />
            <span v-if="!isCompact">Filters</span>
            <span v-if="hasActiveFilters" class="filter-count">{{ activeFilterCount }}</span>
          </button>
        </div>

        <!-- Grid Size Slider -->
        <div class="grid-controls">
          <span class="control-label">Size</span>
          <input 
            :value="cardSize" 
            @input="$emit('update:cardSize', parseInt($event.target.value))"
            type="range" 
            min="180" 
            max="320" 
            step="20"
            class="size-slider"
          >
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { 
  Grid, List, LayoutGrid, Filter, Network, Settings, RotateCcw, Maximize2, Minimize2
} from 'lucide-vue-next';

interface Props {
  currentViewMode: string;
  sortBy: string;
  cardSize: number;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  isSidePanelOpen: boolean;
  isAgentConfiguratorOpen: boolean;
  graphStats?: { topics: number; workspaces: number };
  graphLayout?: string;
  showGraphControls?: boolean;
  is3DSupported?: boolean;
  isFullscreen?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits([
  'update:viewMode',
  'update:sortBy', 
  'update:cardSize',
  'toggle-filters',
  'update:graphLayout',
  'toggle-graph-controls',
  'reset-graph',
  'toggle-fullscreen'
]);

// Dynamic positioning based on panel states (similar to main header)
const dockPositionStyle = computed(() => {
  const leftPanelOpen = props.isSidePanelOpen;
  const rightPanelOpen = props.isAgentConfiguratorOpen;

  return {
    left: leftPanelOpen ? '40vw' : '0',
    right: rightPanelOpen ? '40vw' : '0',
    justifySelf: 'center',
    width: leftPanelOpen && rightPanelOpen ? '20vw' :
    leftPanelOpen || rightPanelOpen ? '60vw' : '100vw',
    maxWidth: leftPanelOpen && rightPanelOpen ? '90%' : '100%',
    transform: 'translateX(0)' // Override the default centering
  };
});

// Determine if we should use compact mode based on available space
const isCompact = computed(() => {
  const leftPanelOpen = props.isSidePanelOpen;
  const rightPanelOpen = props.isAgentConfiguratorOpen;
  
  // Use compact mode when both panels are open, or when space is very limited
  return (leftPanelOpen && rightPanelOpen);
});

const viewModes = [
  { id: 'grid', label: 'Grid', icon: Grid },
  { id: 'compact', label: 'Compact', icon: List },
  { id: 'detailed', label: 'Detailed', icon: LayoutGrid },
  { id: 'graph', label: 'Graph', icon: Network }
];
</script>

<style scoped>
.workspace-controls-dock {
  position: fixed;
  top: 4rem; /* Position closer to header for seamless connection */
  z-index: 60; /* Controls dock - important controls layer */
  background: oklch(from oklch(var(--b1)) l c h / 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.2);
  border-top: none;
  border-bottom-right-radius: 12px;
  border-bottom-left-radius: 12px;
  box-shadow: 0 4px 16px oklch(from oklch(var(--b1)) l c h / 0.4);
  padding: 8px 16px;
  transition: all 0.3s ease;
  display: flex;
  justify-content: center;
}

.dock-container {
  display: flex;
  align-items: center;
  gap: 16px;
  white-space: nowrap;
}

.view-mode-selector {
  display: flex;
  gap: 4px;
  background: oklch(from oklch(var(--bc)) l c h / 0.05);
  padding: 4px;
  border-radius: 8px;
}

.view-mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: oklch(var(--bc));
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-shadow: 0 1px 1px oklch(from oklch(var(--b1)) l c h / 0.8);
}

.view-mode-btn:hover {
  background: oklch(from oklch(var(--bc)) l c h / 0.1);
  color: oklch(var(--bc));
}

.view-mode-btn.active {
  background: oklch(var(--p));
  color: oklch(var(--pc));
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-select,
.layout-select {
  padding: 6px 12px;
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.3);
  border-radius: 6px;
  background: oklch(from oklch(var(--b1)) l c h / 0.98);
  color: oklch(var(--bc));
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s ease;
  text-shadow: 0 1px 1px oklch(from oklch(var(--b1)) l c h / 0.8);
}

.sort-select:focus,
.layout-select:focus {
  border-color: oklch(var(--p));
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.3);
  border-radius: 6px;
  background: oklch(from oklch(var(--b1)) l c h / 0.98);
  color: oklch(var(--bc));
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  text-shadow: 0 1px 1px oklch(from oklch(var(--b1)) l c h / 0.8);
}

.filter-btn:hover {
  background: oklch(from oklch(var(--bc)) l c h / 0.05);
  color: oklch(var(--bc));
}

.filter-btn.active {
  border-color: oklch(var(--p));
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  color: oklch(var(--p));
}

.filter-count {
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  min-width: 16px;
  text-align: center;
}

.graph-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: oklch(from oklch(var(--s)) l c h / 0.1);
  color: oklch(var(--s));
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
}

.grid-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 12px;
  font-weight: 500;
  color: oklch(var(--bc));
  text-shadow: 0 1px 1px oklch(from oklch(var(--b1)) l c h / 0.8);
}

.size-slider {
  width: 80px;
  height: 4px;
  border-radius: 2px;
  background: oklch(from oklch(var(--bc)) l c h / 0.2);
  outline: none;
  cursor: pointer;
  appearance: none;
}

.size-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: oklch(var(--p));
  cursor: pointer;
  border: 2px solid oklch(var(--b1));
  box-shadow: 0 2px 4px oklch(from oklch(var(--bc)) l c h / 0.2);
}

.size-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: oklch(var(--p));
  cursor: pointer;
  border: 2px solid oklch(var(--b1));
  box-shadow: 0 2px 4px oklch(from oklch(var(--bc)) l c h / 0.2);
}

/* Graph-specific controls */
.stats-section {
  display: flex;
  gap: 8px;
}

.interaction-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
}

.hint-text {
  font-size: 11px;
  color: oklch(from oklch(var(--bc)) l c h / 0.8);
  white-space: nowrap;
  text-shadow: 0 1px 2px oklch(from oklch(var(--b1)) l c h / 0.5);
}

.stat-badge {
  padding: 4px 10px;
  border-radius: 12px;
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  color: oklch(var(--p));
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.3);
  border-radius: 6px;
  background: oklch(from oklch(var(--b1)) l c h / 0.98);
  color: oklch(var(--bc));
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-shadow: 0 1px 1px oklch(from oklch(var(--b1)) l c h / 0.8);
}

.control-btn:hover {
  background: oklch(from oklch(var(--bc)) l c h / 0.05);
  color: oklch(var(--bc));
}

.control-btn.active {
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border-color: oklch(var(--p));
}

/* Theme-specific contrast improvements for problematic themes */
[data-theme="acid"] .workspace-controls-dock,
[data-theme="cyberpunk"] .workspace-controls-dock,
[data-theme="valentine"] .workspace-controls-dock {
  background: oklch(from oklch(var(--b1)) l c h / 0.98);
  backdrop-filter: blur(16px);
  box-shadow: 0 4px 20px oklch(from oklch(var(--b1)) l c h / 0.6);
}

[data-theme="acid"] .view-mode-btn,
[data-theme="acid"] .control-btn,
[data-theme="acid"] .filter-btn,
[data-theme="acid"] .control-label,
[data-theme="acid"] .hint-text {
  color: oklch(var(--bc));
  text-shadow: 0 2px 4px oklch(from oklch(var(--b1)) l c h / 0.9);
  font-weight: 600;
}

[data-theme="winter"] .workspace-controls-dock,
[data-theme="retro"] .workspace-controls-dock,
[data-theme="cmyk"] .workspace-controls-dock,
[data-theme="autumn"] .workspace-controls-dock {
  background: oklch(from oklch(var(--b1)) l c h / 0.96);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.4);
}

[data-theme="winter"] .view-mode-btn,
[data-theme="winter"] .control-btn,
[data-theme="winter"] .filter-btn,
[data-theme="winter"] .control-label,
[data-theme="winter"] .hint-text,
[data-theme="retro"] .view-mode-btn,
[data-theme="retro"] .control-btn,
[data-theme="retro"] .filter-btn,
[data-theme="retro"] .control-label,
[data-theme="retro"] .hint-text,
[data-theme="cmyk"] .view-mode-btn,
[data-theme="cmyk"] .control-btn,
[data-theme="cmyk"] .filter-btn,
[data-theme="cmyk"] .control-label,
[data-theme="cmyk"] .hint-text,
[data-theme="autumn"] .view-mode-btn,
[data-theme="autumn"] .control-btn,
[data-theme="autumn"] .filter-btn,
[data-theme="autumn"] .control-label,
[data-theme="autumn"] .hint-text {
  color: oklch(var(--bc));
  text-shadow: 0 1px 3px oklch(from oklch(var(--b1)) l c h / 0.8);
  font-weight: 600;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .dock-container {
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .graph-info span {
    display: none;
  }
  
  .view-mode-btn span {
    display: none;
  }
  
  .control-label {
    display: none;
  }
  
  .size-slider {
    width: 60px;
  }
}
</style>