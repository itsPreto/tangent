<template>
  <div 
    class="right-feature-sidebar" 
    :class="[
      'theme-' + currentTheme,
      { 'expanded': isExpanded, 'collapsed': !isExpanded }
    ]"
    :style="sidebarStyle"
    @mouseenter="handleSidebarHover"
    @mouseleave="handleSidebarLeave"
    @dragstart.stop
    @dragend.stop
    @dragover.stop
    @dragleave.stop
    @drop.stop>
    

    <!-- Feature List -->
    <div class="feature-list" :class="{ 'collapsed-list': !isExpanded }" 
         @dragstart.stop 
         @dragend.stop 
         @dragover.stop 
         @dragleave.stop 
         @drop.stop>
      <div
        v-for="(feature, index) in features"
        :key="feature.id"
        class="feature-item"
        :class="{ 
          'active': activeFeature === feature.id,
          'collapsed-item': !isExpanded,
          'dragging': isDragging && draggedIndex === index,
          'drag-over': dragOverIndex === index && draggedIndex !== index
        }"
        :draggable="feature.id !== 'themes'"
        @click="handleFeatureClick(feature, $event)"
        @dragstart="feature.id !== 'themes' ? handleDragStart($event, index) : null"
        @dragend="feature.id !== 'themes' ? handleDragEnd : null"
        @dragover="feature.id !== 'themes' ? handleDragOver($event, index) : null"
        @dragleave="feature.id !== 'themes' ? handleDragLeave : null"
        @drop="feature.id !== 'themes' ? handleDrop($event, index) : null"
        :style="getFeatureItemStyle(feature)"
        :title="!isExpanded ? feature.label : ''">
        
        <!-- Horizontal divider above themes -->
        <div v-if="feature.id === 'themes'" class="themes-divider"></div>
        
        <div class="feature-icon" :style="getFeatureIconStyle(feature)">
          <component :is="feature.icon" :size="20" :style="{ color: feature.color }" />
        </div>
        
        <Transition name="fade-slide" mode="out-in">
          <span v-if="isExpanded" class="feature-label">{{ feature.label }}</span>
        </Transition>
        
        <!-- Inline Themes Grid (positioned below this specific feature) -->
        <Transition name="slide-down">
          <div v-if="isExpanded && showThemes && feature.id === 'themes'" class="themes-inline-grid">
            <!-- Search -->
            <div class="theme-search">
              <input 
                v-model="themeSearch" 
                type="text" 
                placeholder="Search themes..."
                class="theme-search-input"
              />
            </div>
            
            <!-- Current Theme Display -->
            <div class="current-theme">
              <div class="current-theme-dots">
                <div class="theme-dot" :style="{ backgroundColor: themeColors.primary }" />
                <div class="theme-dot" :style="{ backgroundColor: themeColors.secondary }" />
                <div class="theme-dot" :style="{ backgroundColor: themeColors.accent }" />
              </div>
              <div class="current-theme-name">{{ currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1) }}</div>
            </div>
            
            <!-- Themes List - Expanded to fill available space -->
            <div class="themes-list-expanded">
              <div 
                v-for="theme in filteredThemes" 
                :key="theme"
                @click="selectTheme(theme)"
                class="theme-item"
                :class="{ 'active': theme === currentTheme }"
              >
                <!-- Color Dots -->
                <div class="theme-dots">
                  <div class="theme-dot" :style="{ backgroundColor: getThemeColorsForTheme(theme).primary }" />
                  <div class="theme-dot" :style="{ backgroundColor: getThemeColorsForTheme(theme).secondary }" />
                  <div class="theme-dot" :style="{ backgroundColor: getThemeColorsForTheme(theme).accent }" />
                </div>
                
                <!-- Theme Name -->
                <div class="theme-name">{{ theme.charAt(0).toUpperCase() + theme.slice(1) }}</div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { 
  Settings, 
  Code, 
  Bot, 
  TestTube, 
  Database, 
  FileText, 
  LayoutGrid,
  GitBranch,
  Palette
} from 'lucide-vue-next';
import { useThemeStore } from '@/stores/themeStore';
import { useAppStore } from '@/stores/appStore';
import { useThemeColors } from '@/composables/useThemeColors';
import { adjustColorLightness, getContrastTextColor } from '@/utils/themeUtils';

const emit = defineEmits<{
  'feature-clicked': [feature: any];
}>();

// Stores
const themeStore = useThemeStore();
const appStore = useAppStore();

// Theme composable with all utilities
const {
  currentTheme,
  isDarkTheme,
  themeColors,
  backgroundColors,
  getTextColor,
  forceLightText
} = useThemeColors();

// Reactive state
const activeFeature = ref<string | null>(null);
const isExpanded = ref(false);
const hoverTimeout = ref<number | null>(null);

// Drag and drop state
const isDragging = ref(false);
const draggedIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

// Theme selection state
const showThemes = ref(false);
const themeSearch = ref('');
const themesButtonIndex = computed(() => features.value.findIndex(f => f.id === 'themes'));

// All available themes
const allThemes = [
  'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate',
  'synthwave', 'retro', 'cyberpunk', 'valentine', 'halloween',
  'garden', 'forest', 'aqua', 'lofi', 'pastel', 'fantasy',
  'wireframe', 'black', 'luxury', 'neon', 'dracula', 'cmyk', 
  'autumn', 'business', 'acid', 'lemonade', 'night', 'coffee', 'winter'
];

const filteredThemes = computed(() => {
  if (!themeSearch.value.trim()) {
    return allThemes;
  }
  
  const query = themeSearch.value.toLowerCase().trim();
  return allThemes.filter(theme => 
    theme.toLowerCase().includes(query)
  );
});

const getThemeColorsForTheme = (theme: string) => {
  return themeStore.getThemeColors(theme);
};

const selectTheme = (theme: string) => {
  themeStore.setTheme(theme);
  showThemes.value = false; // Collapse after selection
};

// Feature definitions - reactive for drag and drop reordering
const defaultFeatures = [
  { 
    id: 'model-selector', 
    icon: Settings, 
    label: 'Models', 
    color: '#8b5cf6',
    description: 'Model selector and agent configuration'
  },
  { 
    id: 'sandpack', 
    icon: Code, 
    label: 'Code Editor', 
    color: '#3b82f6',
    description: 'Code editor + preview + relic manager'
  },
  { 
    id: 'claude-code', 
    icon: Bot, 
    label: 'Claude Code', 
    color: '#f59e0b',
    description: 'Claude Code instance management'
  },
  { 
    id: 'testing', 
    icon: TestTube, 
    label: 'Testing', 
    color: '#22c55e',
    description: 'Model testing and evaluation suite'
  },
  { 
    id: 'mock-data', 
    icon: Database, 
    label: 'Mock Data', 
    color: '#ec4899',
    description: 'Generate mock conversation archives'
  },
  { 
    id: 'force-graph', 
    icon: GitBranch, 
    label: 'Force Graph', 
    color: '#10b981',
    description: 'Interactive workspace relationships graph'
  },
  { 
    id: 'documents', 
    icon: FileText, 
    label: 'Documents', 
    color: '#f59e0b',
    description: 'RAG document panel and management'
  },
  { 
    id: 'themes', 
    icon: Palette, 
    label: 'Themes', 
    color: '#f59e0b',
    description: 'Switch between 23 beautiful themes'
  }
];

// Reactive features array for drag and drop
const features = ref([...defaultFeatures]);

// Methods
const handleFeatureClick = (feature: any, event: MouseEvent) => {
  // Don't handle click if we're dragging
  if (isDragging.value) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  
  // Special handling for themes feature
  if (feature.id === 'themes') {
    showThemes.value = !showThemes.value;
    // Keep sidebar expanded when showing themes
    isExpanded.value = true;
    return;
  }
  
  // Regular feature handling
  // Toggle feature - close if already active, open if different
  if (activeFeature.value === feature.id) {
    activeFeature.value = null;
  } else {
    activeFeature.value = feature.id;
  }
  
  // Collapse sidebar after clicking (except for themes)
  isExpanded.value = false;
  clearHoverTimeout();
  
  // Hide themes if showing
  showThemes.value = false;
  
  emit('feature-clicked', { ...feature, isActive: activeFeature.value === feature.id });
  
  // Handle specific feature logic
  switch (feature.id) {
    case 'model-selector':
      // Open Model Selector in content area
      break;
    case 'chat-history':
      // Open Chat History Panel in content area
      break;
    case 'sandpack':
      // Open SandpackSidePanel in content area
      break;
    case 'claude-code':
      // Open Claude Code Management in content area
      break;
    case 'testing':
      // Open Testing Suite in content area
      break;
    case 'mock-data':
      // Open Mock Data Generator in content area
      break;
    case 'force-graph':
      // Open Force Graph in content area
      break;
    case 'documents':
      // Open RAGDocumentPanel in content area
      break;
  }
};

const handleSidebarHover = () => {
  clearHoverTimeout();
  isExpanded.value = true;
  // Update app store so main content can respond to sidebar expansion
  appStore.expandRightSidebar();
};

const handleSidebarLeave = () => {
  // Set timeout to collapse after 200ms
  hoverTimeout.value = setTimeout(() => {
    isExpanded.value = false;
    // Update app store so main content can respond to sidebar collapse
    appStore.collapseRightSidebar();
  }, 200);
};

const clearHoverTimeout = () => {
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value);
    hoverTimeout.value = null;
  }
};

// Drag and drop methods
const handleDragStart = (e: DragEvent, index: number) => {
  // Prevent dragging themes item
  if (features.value[index].id === 'themes') {
    e.preventDefault();
    return;
  }
  
  e.stopPropagation(); // Prevent canvas drag interference
  e.stopImmediatePropagation(); // Stop all other event listeners
  isDragging.value = true;
  draggedIndex.value = index;
  
  // Set drag data
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Set custom data to identify our drag source
    e.dataTransfer.setData('application/x-tangent-feature', 'true');
  }
};

const handleDragEnd = (e: DragEvent) => {
  e.stopPropagation(); // Prevent canvas drag interference
  e.stopImmediatePropagation(); // Stop all other event listeners
  
  // Small delay to prevent click events from firing immediately after drag
  setTimeout(() => {
    isDragging.value = false;
    draggedIndex.value = null;
    dragOverIndex.value = null;
  }, 50);
};

const handleDragOver = (e: DragEvent, index: number) => {
  // Only handle our own drag events
  if (e.dataTransfer?.types.includes('application/x-tangent-feature')) {
    // Don't allow dropping on themes item
    if (features.value[index].id === 'themes') {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    dragOverIndex.value = index;
  }
};

const handleDragLeave = (e: DragEvent) => {
  // Only handle our own drag events
  if (e.dataTransfer?.types.includes('application/x-tangent-feature')) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // Safe null check for currentTarget
    const currentTarget = e.currentTarget as HTMLElement | null;
    const relatedTarget = e.relatedTarget as Node | null;
    
    // More defensive check - only clear if we have valid elements and we're actually leaving
    if (currentTarget && typeof currentTarget.getBoundingClientRect === 'function' && 
        (!relatedTarget || !currentTarget.contains(relatedTarget))) {
      dragOverIndex.value = null;
    }
  }
};

const handleDrop = (e: DragEvent, dropIndex: number) => {
  // Only handle our own drag events
  if (e.dataTransfer?.types.includes('application/x-tangent-feature')) {
    // Don't allow dropping on themes item
    if (features.value[dropIndex].id === 'themes') {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const dragIndex = draggedIndex.value;
    if (dragIndex === null || dragIndex === dropIndex) return;
    
    // Don't allow moving themes item
    if (features.value[dragIndex].id === 'themes') return;
    
    // Create new array with reordered items
    const newFeatures = [...features.value];
    const draggedItem = newFeatures[dragIndex];
    
    // Remove dragged item
    newFeatures.splice(dragIndex, 1);
    
    // Insert at new position (adjust index if dropping after themes)
    const themesIndex = newFeatures.findIndex(f => f.id === 'themes');
    let adjustedDropIndex = dropIndex;
    
    // If dropping after themes, adjust the index
    if (dropIndex > dragIndex && themesIndex >= 0) {
      adjustedDropIndex = dropIndex - 1;
    }
    
    // Don't allow dropping into themes position
    if (adjustedDropIndex >= themesIndex && themesIndex >= 0) {
      adjustedDropIndex = Math.max(0, themesIndex - 1);
    }
    
    newFeatures.splice(adjustedDropIndex, 0, draggedItem);
    
    // Update features array
    features.value = newFeatures;
    
    // Save order to localStorage
    saveFeatureOrder();
    
    // Reset drag state
    isDragging.value = false;
    draggedIndex.value = null;
    dragOverIndex.value = null;
  }
};

// Persistence methods
const saveFeatureOrder = () => {
  // Only save order of draggable items (exclude themes)
  const order = features.value.filter(f => f.id !== 'themes').map(f => f.id);
  localStorage.setItem('tangent-feature-order', JSON.stringify(order));
};

const loadFeatureOrder = () => {
  try {
    const savedOrder = localStorage.getItem('tangent-feature-order');
    if (savedOrder) {
      const order = JSON.parse(savedOrder);
      
      // Reorder draggable features based on saved order (exclude themes)
      const draggableFeatures = defaultFeatures.filter(f => f.id !== 'themes');
      const themesFeature = defaultFeatures.find(f => f.id === 'themes');
      
      const orderedFeatures = order.map((id: string) => 
        draggableFeatures.find(f => f.id === id)
      ).filter(Boolean);
      
      // Add any new draggable features that weren't in the saved order
      const existingIds = new Set(order);
      const newFeatures = draggableFeatures.filter(f => !existingIds.has(f.id));
      
      // Always put themes at the end
      features.value = [...orderedFeatures, ...newFeatures, themesFeature].filter(Boolean);
    }
  } catch (error) {
    console.error('Failed to load feature order:', error);
    features.value = [...defaultFeatures];
  }
};

// Computed styles using theme-aware backgrounds
const sidebarStyle = computed(() => {
  const baseBackground = backgroundColors.value.base;
  let backgroundColor = baseBackground;
  let borderColor = isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)';
  
  // Theme-specific adjustments
  if (currentTheme.value === 'cyberpunk') {
    backgroundColor = 'rgba(20, 20, 30, 0.95)';
    borderColor = `${themeColors.value.primary}50`;
  } else if (currentTheme.value === 'synthwave') {
    backgroundColor = 'rgba(30, 10, 50, 0.95)';
    borderColor = `${themeColors.value.secondary}50`;
  } else if (currentTheme.value === 'lofi') {
    backgroundColor = 'rgba(60, 59, 59, 0.95)';
    borderColor = 'rgba(100, 100, 100, 0.3)';
  } else if (currentTheme.value === 'garden') {
    backgroundColor = isDarkTheme.value ? 'rgba(20, 30, 25, 0.95)' : 'rgba(245, 250, 247, 0.95)';
    borderColor = `${themeColors.value.primary}30`;
  } else if (currentTheme.value === 'pastel') {
    backgroundColor = isDarkTheme.value ? 'rgba(30, 25, 30, 0.95)' : 'rgba(250, 248, 252, 0.95)';
    borderColor = `${themeColors.value.primary}25`;
  }

  return {
    backgroundColor,
    borderColor,
    color: getTextColor(),
    backdropFilter: 'blur(10px)',
    borderLeft: `1px solid ${borderColor}`,
    width: isExpanded.value ? '180px' : '60px',
    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease, color 0.3s ease'
  };
});

const headerStyle = computed(() => {
  return {
    borderBottom: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`,
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
  };
});

const getFeatureItemStyle = (feature: any) => {
  const isActive = activeFeature.value === feature.id;
  let backgroundColor = 'transparent';
  let color = getTextColor();
  let borderColor = 'transparent';
  let boxShadow = 'none';
  
  if (isActive) {
    // Enhanced contrast for light themes
    const darkenedFeatureColor = isDarkTheme.value 
      ? feature.color 
      : adjustColorLightness(feature.color, -25);
    
    if (isDarkTheme.value) {
      backgroundColor = 'rgba(255, 255, 255, 0.15)';
      color = feature.color;
      borderColor = `${feature.color}60`;
    } else {
      // Light theme: stronger background and darker text
      backgroundColor = `${darkenedFeatureColor}20`;
      color = darkenedFeatureColor;
      borderColor = `${darkenedFeatureColor}60`;
      boxShadow = `inset 0 0 0 1px ${darkenedFeatureColor}30`;
    }
  }

  // Theme-specific adjustments for better contrast
  if (currentTheme.value === 'cyberpunk' && isActive) {
    backgroundColor = `${feature.color}30`;
    color = feature.color;
    boxShadow = `0 0 8px ${feature.color}40`;
  } else if (currentTheme.value === 'synthwave' && isActive) {
    backgroundColor = `${feature.color}25`;
    color = feature.color;
    boxShadow = `0 0 8px ${feature.color}40`;
  } else if (['garden', 'emerald', 'cupcake', 'corporate', 'pastel'].includes(currentTheme.value) && isActive) {
    // Extra contrast for light themes that need it
    const extraDarkened = adjustColorLightness(feature.color, -35);
    backgroundColor = `${extraDarkened}25`;
    color = extraDarkened;
    borderColor = `${extraDarkened}80`;
    boxShadow = `inset 0 0 0 1px ${extraDarkened}40`;
  }
  
  return {
    backgroundColor,
    color,
    borderColor,
    boxShadow,
    borderLeft: isActive ? `3px solid ${isDarkTheme.value ? feature.color : adjustColorLightness(feature.color, -25)}` : '3px solid transparent',
    transition: 'all 0.2s ease'
  };
};

const getFeatureIconStyle = (feature: any) => {
  const isActive = activeFeature.value === feature.id;
  return {
    backgroundColor: isActive ? `${feature.color}30` : `${feature.color}20`,
    borderColor: isActive ? `${feature.color}60` : `${feature.color}40`,
    border: `1px solid`,
    transition: 'all 0.2s ease'
  };
};

// Load saved feature order on mount
onMounted(() => {
  loadFeatureOrder();
});
</script>

<style scoped>
.right-feature-sidebar {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: visible; /* Allow themes to overlay */
  z-index: 999;
  /* Sidebar pushes content instead of overlaying */
}

.right-feature-sidebar.collapsed {
  width: 60px;
}

.right-feature-sidebar.expanded {
  width: 200px;
}

.sidebar-header {
  padding: 20px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.feature-list {
  padding: 8px 0;
  flex: 1;
  overflow-y: auto;
}

.collapsed-list {
  padding: 8px 0;
}

.feature-list::-webkit-scrollbar {
  width: 6px;
}

.feature-list::-webkit-scrollbar-track {
  background: transparent;
}

.feature-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.feature-item {
  display: flex;
  align-items: center;
  padding: 8px;
  margin: 4px 8px;
  cursor: pointer;
  border-radius: 8px;
  min-height: 44px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative; /* For absolute positioning of themes grid */
  user-select: none; /* Prevent text selection during drag */
}

/* Drag and drop styles */
.feature-item.dragging {
  opacity: 0.5;
  transform: scale(0.95);
  cursor: grabbing;
  z-index: 1000;
}

.feature-item.drag-over {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  border: 2px dashed rgba(255, 255, 255, 0.3);
}

.feature-item:not(.dragging) {
  cursor: grab;
}

.feature-item:not(.dragging):active {
  cursor: grabbing;
}

/* Themes divider */
.themes-divider {
  position: absolute;
  top: -8px;
  left: 8px;
  right: 8px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  pointer-events: none;
}

/* Non-draggable themes item */
.feature-item[draggable="false"] {
  cursor: default;
}

.feature-item[draggable="false"]:active {
  cursor: default;
}

.feature-item.collapsed-item {
  padding: 8px;
  margin: 4px 8px;
  justify-content: center;
}

.feature-item:hover {
  background: rgba(255, 255, 255, 0.1) !important;
}

.feature-item.active {
  background: rgba(255, 255, 255, 0.15) !important;
  font-weight: 600;
}

.theme-cyberpunk .feature-item.active,
.theme-synthwave .feature-item.active,
.theme-neon .feature-item.active {
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
}

.feature-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.expanded .feature-icon {
  margin-right: 12px;
}

.collapsed .feature-icon {
  margin-right: 0;
}

.feature-label {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: inherit;
}

/* Smooth transition animations */
.fade-slide-enter-active {
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 1, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(16px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

/* Inline Themes Grid - Below the themes feature button */
.themes-inline-grid {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 50vh; /* Dynamic height based on available space */
  margin: 0 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  z-index: 1001;
  overflow: hidden;
}

.theme-search {
  margin-bottom: 12px;
}

.theme-search-input {
  width: 100%;
  padding: 6px 8px;
  background: rgba(128, 128, 128, 0.1);
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 4px;
  color: inherit;
  font-size: 12px;
  outline: none;
  transition: all 0.2s ease;
}

.theme-search-input::placeholder {
  opacity: 0.5;
}

.theme-search-input:focus {
  border-color: rgba(128, 128, 128, 0.4);
  background: rgba(128, 128, 128, 0.15);
}

.current-theme {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.current-theme-dots {
  display: flex;
  gap: 2px;
}

.current-theme-name {
  font-size: 11px;
  font-weight: 600;
  color: inherit;
  opacity: 0.9;
}

.themes-list-expanded {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}

.theme-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
}

.theme-item:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateX(3px) scale(1.02);
}

.theme-item.active {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.theme-dots {
  display: flex;
  gap: 2px;
}

.theme-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.theme-item:hover .theme-dot {
  transform: scale(1.2);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.theme-name {
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  flex: 1;
}

/* Smooth slide down transition for themes */
.slide-down-enter-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.slide-down-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.6, 1);
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}

.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 600px;
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Custom scrollbar for themes list */
.themes-list-expanded::-webkit-scrollbar {
  width: 3px;
}

.themes-list-expanded::-webkit-scrollbar-track {
  background: transparent;
}

.themes-list-expanded::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.themes-list-expanded::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Light theme specific overrides for better contrast */
.theme-light,
.theme-cupcake,
.theme-bumblebee,
.theme-emerald,
.theme-corporate,
.theme-retro,
.theme-valentine,
.theme-garden,
.theme-pastel,
.theme-wireframe,
.theme-cmyk,
.theme-lemonade,
.theme-winter,
.theme-lofi,
.theme-fantasy,
.theme-autumn {
  .feature-list,
  .feature-item,
  .feature-label,
  .current-theme-name {
    color: rgba(0, 0, 0, 0.87) !important;
  }
  
  .feature-item:not(.active) {
    background-color: transparent !important;
    color: rgba(0, 0, 0, 0.87) !important;
    border-color: transparent !important;
  }
  
  .feature-item.drag-over {
    border-color: rgba(0, 0, 0, 0.3) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  }
  
  .themes-divider {
    background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.2), transparent) !important;
  }
  
  .themes-inline-grid {
    background: rgba(0, 0, 0, 0.05);
    border-color: rgba(0, 0, 0, 0.15);
  }
  
  .theme-search-input {
    background: rgba(0, 0, 0, 0.05);
    border-color: rgba(0, 0, 0, 0.2);
    color: rgba(0, 0, 0, 0.87);
  }
  
  .theme-search-input:focus {
    border-color: rgba(0, 0, 0, 0.4);
  }
  
  .theme-search-input::placeholder {
    color: rgba(0, 0, 0, 0.5);
  }
  
  .feature-item:hover {
    background: rgba(0, 0, 0, 0.08) !important;
  }
  
  .theme-option:hover {
    background: rgba(0, 0, 0, 0.08);
  }
  
  .themes-list-expanded::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
  }
  
  .themes-list-expanded::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);
  }
}

/* Dark theme specific overrides for proper light text */
.theme-dark,
.theme-synthwave,
.theme-cyberpunk,
.theme-halloween,
.theme-forest,
.theme-aqua,
.theme-black,
.theme-luxury,
.theme-neon,
.theme-dracula,
.theme-business,
.theme-acid,
.theme-night,
.theme-coffee {
  .feature-list,
  .feature-item,
  .feature-label,
  .current-theme-name {
    color: rgba(255, 255, 255, 0.95) !important;
  }
  
  .feature-item:not(.active) {
    background-color: transparent !important;
    color: rgba(255, 255, 255, 0.95) !important;
    border-color: transparent !important;
  }
  
  .feature-item.drag-over {
    border-color: rgba(255, 255, 255, 0.3) !important;
    box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15) !important;
  }
  
  .themes-divider {
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent) !important;
  }
  
  .themes-inline-grid {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.15);
  }
  
  .theme-search-input {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }
  
  .theme-search-input:focus {
    border-color: rgba(255, 255, 255, 0.4);
  }
  
  .theme-search-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
  
  .feature-item:hover {
    background: rgba(255, 255, 255, 0.08) !important;
  }
  
  .theme-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  
  .themes-list-expanded::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .themes-list-expanded::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}
</style>