<template>
  <div class="topics-panel" :class="{ 'compact': isCompact }">
    <div class="panel-header">
      <div class="header-content">
        <h3 class="panel-title">Topics Overview</h3>
        <span class="topics-count">{{ filteredTopics.length }} of {{ totalTopics }}</span>
      </div>
      
      <!-- Search and Filters -->
      <div class="panel-controls">
        <div class="search-container">
          <Search :size="16" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search topics..."
            class="search-input"
          />
        </div>
        
        <button 
          @click="showFilters = !showFilters"
          class="filter-toggle"
          :class="{ 'active': showFilters || hasActiveFilters }"
        >
          <SlidersHorizontal :size="16" />
          <span v-if="hasActiveFilters" class="filter-count">{{ activeFilterCount }}</span>
        </button>
      </div>

      <!-- Sort Options -->
      <div class="sort-options">
        <button
          v-for="option in sortOptions"
          :key="option.id"
          @click="sortBy = option.id"
          class="sort-btn"
          :class="{ 'active': sortBy === option.id }"
        >
          <component :is="option.icon" :size="14" />
          <span>{{ option.label }}</span>
        </button>
      </div>

      <!-- Advanced Filters -->
      <div v-if="showFilters" class="filters-section">
        <div class="filter-group">
          <label class="filter-label">Minimum Size</label>
          <input
            v-model="sizeFilter"
            type="range"
            min="1"
            :max="maxTopicSize"
            class="range-slider"
          />
          <span class="range-value">{{ sizeFilter }}+</span>
        </div>
        
        <div class="filter-group">
          <label class="filter-label">Coherence</label>
          <input
            v-model="coherenceFilter"
            type="range"
            min="0"
            max="100"
            class="range-slider"
          />
          <span class="range-value">{{ coherenceFilter }}%+</span>
        </div>
      </div>
    </div>

    <!-- Topics List -->
    <div class="topics-list">
      <div
        v-for="(topic, clusterId) in filteredTopics"
        :key="clusterId"
        class="topic-card"
        :class="{ 
          'selected': selectedCluster === parseInt(clusterId),
          'hovered': hoveredCluster === parseInt(clusterId)
        }"
        @click="selectTopic(parseInt(clusterId))"
        @mouseenter="hoveredCluster = parseInt(clusterId)"
        @mouseleave="hoveredCluster = null"
      >
        <!-- Topic Header -->
        <div class="topic-header">
          <div class="topic-indicator" :style="{ backgroundColor: getTopicColor(parseInt(clusterId)) }"></div>
          <div class="topic-info">
            <h4 class="topic-title">{{ topic.topic }}</h4>
            <div class="topic-stats">
              <span class="stat">
                <Users :size="12" />
                {{ topic.size }}
              </span>
              <span class="stat">
                <TrendingUp :size="12" />
                {{ Math.round(topic.coherence * 100) }}%
              </span>
            </div>
          </div>
          
          <button 
            v-if="!isCompact"
            @click.stop="toggleTopicExpansion(parseInt(clusterId))"
            class="expand-btn"
            :class="{ 'expanded': expandedTopics.has(parseInt(clusterId)) }"
          >
            <ChevronDown :size="16" />
          </button>
        </div>

        <!-- Coherence Bar -->
        <div class="coherence-bar">
          <div 
            class="coherence-fill" 
            :style="{ 
              width: (topic.coherence * 100) + '%',
              backgroundColor: getTopicColor(parseInt(clusterId))
            }"
          ></div>
        </div>

        <!-- Topic Reflection (expandable) -->
        <div 
          v-if="!isCompact && expandedTopics.has(parseInt(clusterId)) && topic.reflection"
          class="topic-reflection"
        >
          <p>{{ topic.reflection }}</p>
        </div>

        <!-- Workspaces List (when expanded) -->
        <div 
          v-if="!isCompact && expandedTopics.has(parseInt(clusterId))"
          class="workspaces-list"
        >
          <div class="workspaces-header">
            <MessageSquare :size="14" />
            <span>Workspaces ({{ getTopicWorkspaces(parseInt(clusterId)).length }})</span>
          </div>
          
          <div 
            v-for="workspace in getTopicWorkspaces(parseInt(clusterId))"
            :key="workspace.id"
            class="workspace-item"
            @click.stop="$emit('select-workspace', workspace.id)"
          >
            <div class="workspace-info">
              <span class="workspace-title">{{ workspace.title }}</span>
              <span class="workspace-meta">{{ workspace.nodeCount || 0 }} nodes</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-if="filteredTopics.length === 0" class="empty-state">
        <Search :size="32" class="empty-icon" />
        <p>No topics match your criteria</p>
        <button @click="clearFilters" class="clear-btn">Clear Filters</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { 
  Search, SlidersHorizontal, Users, TrendingUp, Target, GitBranch,
  ChevronDown, MessageSquare
} from 'lucide-vue-next';
import * as d3 from 'd3';
import type { ClusteringStatus } from '@/services/clusteringService';

interface Props {
  clusteringStatus: ClusteringStatus;
  selectedCluster?: number | null;
  isCompact?: boolean;
}

interface TopicData {
  topic: string;
  size: number;
  coherence: number;
  reflection?: string;
}

const props = withDefaults(defineProps<Props>(), {
  selectedCluster: null,
  isCompact: false
});

const emit = defineEmits<{
  'select-topic': [clusterId: number];
  'select-workspace': [workspaceId: string];
}>();

// State
const searchQuery = ref('');
const showFilters = ref(false);
const sortBy = ref('relevance');
const sizeFilter = ref(1);
const coherenceFilter = ref(0);
const expandedTopics = ref<Set<number>>(new Set());
const hoveredCluster = ref<number | null>(null);

// Sort options
const sortOptions = [
  { id: 'relevance', icon: Target, label: 'Relevance' },
  { id: 'size', icon: Users, label: 'Size' },
  { id: 'coherence', icon: TrendingUp, label: 'Coherence' },
];

// Color scale for topics
const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

// Computed
const totalTopics = computed(() => {
  return Object.keys(props.clusteringStatus?.clusters || {}).length;
});

const maxTopicSize = computed(() => {
  const clusters = props.clusteringStatus?.clusters || [];
  return Math.max(...clusters.map(c => c.workspaces.length), 10);
});

const topicsData = computed(() => {
  const clusters = props.clusteringStatus?.clusters || [];
  const topics: Record<string, TopicData> = {};
  
  clusters.forEach((cluster, index) => {
    topics[index.toString()] = {
      topic: cluster.title,
      size: cluster.workspaces.length,
      coherence: 0.85, // Default coherence
      reflection: `This topic contains ${cluster.workspaces.length} related workspaces focused on ${cluster.title.toLowerCase()}.`
    };
  });
  
  return topics;
});

const filteredTopics = computed(() => {
  let filtered = { ...topicsData.value };
  
  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = Object.fromEntries(
      Object.entries(filtered).filter(([_, topic]) =>
        topic.topic.toLowerCase().includes(query)
      )
    );
  }
  
  // Apply size filter
  filtered = Object.fromEntries(
    Object.entries(filtered).filter(([_, topic]) => topic.size >= sizeFilter.value)
  );
  
  // Apply coherence filter
  filtered = Object.fromEntries(
    Object.entries(filtered).filter(([_, topic]) => 
      (topic.coherence * 100) >= coherenceFilter.value
    )
  );
  
  // Sort topics
  const sortedEntries = Object.entries(filtered).sort(([aId, a], [bId, b]) => {
    switch (sortBy.value) {
      case 'size':
        return b.size - a.size;
      case 'coherence':
        return b.coherence - a.coherence;
      case 'relevance':
      default:
        return (b.size * b.coherence) - (a.size * a.coherence);
    }
  });
  
  return Object.fromEntries(sortedEntries);
});

const hasActiveFilters = computed(() => {
  return sizeFilter.value > 1 || coherenceFilter.value > 0 || searchQuery.value.trim() !== '';
});

const activeFilterCount = computed(() => {
  let count = 0;
  if (sizeFilter.value > 1) count++;
  if (coherenceFilter.value > 0) count++;
  if (searchQuery.value.trim() !== '') count++;
  return count;
});

// Methods
const selectTopic = (clusterId: number) => {
  emit('select-topic', clusterId);
};

const toggleTopicExpansion = (clusterId: number) => {
  if (expandedTopics.value.has(clusterId)) {
    expandedTopics.value.delete(clusterId);
  } else {
    expandedTopics.value.add(clusterId);
  }
  expandedTopics.value = new Set(expandedTopics.value);
};

const getTopicColor = (clusterId: number) => {
  return colorScale(clusterId.toString());
};

const getTopicWorkspaces = (clusterId: number) => {
  const clusters = props.clusteringStatus?.clusters || [];
  return clusters[clusterId]?.workspaces || [];
};

const clearFilters = () => {
  searchQuery.value = '';
  sizeFilter.value = 1;
  coherenceFilter.value = 0;
  showFilters.value = false;
};

// Auto-expand selected topic
watch(() => props.selectedCluster, (newCluster) => {
  if (newCluster !== null && !props.isCompact) {
    expandedTopics.value.add(newCluster);
    expandedTopics.value = new Set(expandedTopics.value);
  }
});
</script>

<style scoped>
.topics-panel {
  @apply flex flex-col h-full;
  background: oklch(var(--b1));
  border-right: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
}

.topics-panel.compact {
  @apply w-64;
}

/* Panel Header */
.panel-header {
  @apply flex-shrink-0 p-4 space-y-4;
  border-bottom: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
}

.header-content {
  @apply flex items-center justify-between;
}

.panel-title {
  @apply text-lg font-semibold;
  color: oklch(var(--bc));
}

.topics-count {
  @apply text-sm px-2 py-1 rounded-full;
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  color: oklch(var(--p));
}

/* Controls */
.panel-controls {
  @apply flex gap-2;
}

.search-container {
  @apply relative flex-1;
}

.search-icon {
  @apply absolute left-3 top-1/2 transform -translate-y-1/2;
  color: oklch(from oklch(var(--bc)) l c h / 0.5);
}

.search-input {
  @apply w-full pl-10 pr-3 py-2 rounded-lg border;
  background: oklch(var(--b2));
  border-color: oklch(from oklch(var(--bc)) l c h / 0.2);
  color: oklch(var(--bc));
}

.search-input:focus {
  outline: none;
  border-color: oklch(var(--p));
  box-shadow: 0 0 0 2px oklch(from oklch(var(--p)) l c h / 0.2);
}

.filter-toggle {
  @apply relative p-2 rounded-lg border transition-colors;
  background: oklch(var(--b2));
  border-color: oklch(from oklch(var(--bc)) l c h / 0.2);
  color: oklch(var(--bc));
}

.filter-toggle:hover {
  background: oklch(from oklch(var(--b3)) l c h / 0.8);
}

.filter-toggle.active {
  background: oklch(var(--p));
  color: oklch(var(--pc));
  border-color: oklch(var(--p));
}

.filter-count {
  @apply absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold;
  background: oklch(var(--wa));
  color: oklch(var(--wac));
}

/* Sort Options */
.sort-options {
  @apply flex gap-1;
}

.sort-btn {
  @apply flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.sort-btn:hover {
  color: oklch(var(--bc));
  background: oklch(from oklch(var(--b2)) l c h / 0.5);
}

.sort-btn.active {
  background: oklch(var(--p));
  color: oklch(var(--pc));
}

/* Filters Section */
.filters-section {
  @apply space-y-3 pt-3;
  border-top: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
}

.filter-group {
  @apply space-y-2;
}

.filter-label {
  @apply text-sm font-medium flex items-center justify-between;
  color: oklch(from oklch(var(--bc)) l c h / 0.8);
}

.range-slider {
  @apply w-full;
  accent-color: oklch(var(--p));
}

.range-value {
  @apply text-xs font-medium;
  color: oklch(var(--p));
}

/* Topics List */
.topics-list {
  @apply flex-1 overflow-auto p-2 space-y-2;
}

.topic-card {
  @apply rounded-lg p-3 cursor-pointer transition-all duration-200;
  background: oklch(from oklch(var(--b2)) l c h / 0.3);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
}

.topic-card:hover {
  background: oklch(from oklch(var(--b2)) l c h / 0.6);
  border-color: oklch(from oklch(var(--bc)) l c h / 0.2);
}

.topic-card.selected {
  background: oklch(from oklch(var(--p)) l c h / 0.1);
  border-color: oklch(var(--p));
  box-shadow: 0 0 0 1px oklch(from oklch(var(--p)) l c h / 0.2);
}

.topic-card.hovered {
  transform: translateY(-1px);
}

/* Topic Header */
.topic-header {
  @apply flex items-start gap-3;
}

.topic-indicator {
  @apply w-3 h-3 rounded-full mt-1 flex-shrink-0;
}

.topic-info {
  @apply flex-1 min-w-0;
}

.topic-title {
  @apply font-semibold truncate mb-1;
  color: oklch(var(--bc));
}

.topic-stats {
  @apply flex gap-3 text-xs;
}

.stat {
  @apply flex items-center gap-1;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.expand-btn {
  @apply p-1 rounded transition-transform;
  color: oklch(from oklch(var(--bc)) l c h / 0.5);
}

.expand-btn:hover {
  color: oklch(var(--bc));
  background: oklch(from oklch(var(--b3)) l c h / 0.5);
}

.expand-btn.expanded {
  transform: rotate(180deg);
}

/* Coherence Bar */
.coherence-bar {
  @apply w-full h-1 rounded-full mt-2 overflow-hidden;
  background: oklch(from oklch(var(--bc)) l c h / 0.1);
}

.coherence-fill {
  @apply h-full transition-all duration-300;
}

/* Topic Reflection */
.topic-reflection {
  @apply mt-3 pt-3;
  border-top: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
}

.topic-reflection p {
  @apply text-sm leading-relaxed;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
}

/* Workspaces List */
.workspaces-list {
  @apply mt-3 pt-3 space-y-2;
  border-top: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
}

.workspaces-header {
  @apply flex items-center gap-2 text-xs font-medium mb-2;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.workspace-item {
  @apply p-2 rounded border cursor-pointer transition-colors;
  background: oklch(from oklch(var(--b1)) l c h / 0.5);
  border-color: oklch(from oklch(var(--bc)) l c h / 0.1);
}

.workspace-item:hover {
  background: oklch(from oklch(var(--b3)) l c h / 0.5);
  border-color: oklch(from oklch(var(--bc)) l c h / 0.2);
}

.workspace-info {
  @apply space-y-1;
}

.workspace-title {
  @apply text-sm font-medium block truncate;
  color: oklch(var(--bc));
}

.workspace-meta {
  @apply text-xs;
  color: oklch(from oklch(var(--bc)) l c h / 0.5);
}

/* Empty State */
.empty-state {
  @apply text-center py-8;
}

.empty-icon {
  @apply mx-auto mb-3;
  color: oklch(from oklch(var(--bc)) l c h / 0.3);
}

.empty-state p {
  @apply text-sm mb-4;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.clear-btn {
  @apply px-4 py-2 rounded-lg text-sm font-medium transition-colors;
  background: oklch(var(--p));
  color: oklch(var(--pc));
}

.clear-btn:hover {
  background: oklch(from oklch(var(--p)) l c h / 0.9);
}

/* Responsive */
@media (max-width: 768px) {
  .panel-controls {
    @apply flex-col gap-2;
  }
  
  .sort-options {
    @apply flex-wrap;
  }
}
</style>