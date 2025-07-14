<template>
  <Transition name="slide-content-panel" appear>
    <div 
      v-if="isOpen && activeFeature" 
      class="feature-content-panel" 
      :class="'theme-' + currentTheme"
      :style="{ ...panelStyle, ...panelPositionStyle }">
      
      <!-- Panel Header -->
      <div class="panel-header" :style="headerStyle">
        <div class="header-content">
          <div class="feature-info">
            <div class="feature-icon" :style="getFeatureIconStyle()">
              <component :is="featureConfig?.icon" :size="20" :style="{ color: featureConfig?.color }" />
            </div>
            <h2 class="panel-title">{{ featureConfig?.label }}</h2>
          </div>
          
          <button class="close-button" @click="handleClose" :style="closeButtonStyle">
            <X :size="20" />
          </button>
        </div>
      </div>

      <!-- Panel Content -->
      <div class="panel-content">
        <!-- Model Selector Feature -->
        <ModelSelectorFeature 
          v-if="activeFeature === 'model-selector'" 
          :node-id="nodeId" />
        
        
        <!-- SandpackSidePanel (Code Editor + Preview + Relic Manager) -->
        <SandpackSidePanel 
          v-else-if="activeFeature === 'sandpack'" 
          :node-id="nodeId"
          @panel-opened="$emit('panel-opened')"
          @panel-closed="$emit('panel-closed')" />
        
        <!-- Claude Code Management Feature -->
        <ClaudeCodeManagementFeature 
          v-else-if="activeFeature === 'claude-code'"
          :node-id="nodeId"
          @open-workspace="$emit('open-workspace', $event)" />
        
        <!-- Testing Feature -->
        <TestingFeature 
          v-else-if="activeFeature === 'testing'" />
        
        <!-- Mock Data Feature -->
        <MockDataFeature 
          v-else-if="activeFeature === 'mock-data'" />
        
        <!-- Force Graph -->
        <GraphFeature 
          v-else-if="activeFeature === 'force-graph'" />
        
        <!-- Documents Feature -->
        <DocumentsFeature 
          v-else-if="activeFeature === 'documents'"
          @document-selected="$emit('document-selected', $event)"
          @document-dragged="$emit('document-dragged', $event)" />
        
        <!-- Fallback content -->
        <div v-else class="fallback-content">
          <div class="fallback-message">
            <h3>Select a Feature</h3>
            <p>Choose a feature from the sidebar to get started.</p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { X, Settings, Code, Bot, TestTube, Database, FileText, GitBranch, LayoutGrid, MessageSquare, Palette } from 'lucide-vue-next';
import { useThemeStore } from '@/stores/themeStore';
import { useAppStore } from '@/stores/appStore';

// AgentConfigurator extracted features
import ModelSelectorFeature from './features/ModelSelectorFeature.vue';
import ClaudeCodeManagementFeature from './features/ClaudeCodeManagementFeature.vue';
import TestingFeature from './features/TestingFeature.vue';
import MockDataFeature from './features/MockDataFeature.vue';

// Existing real components
import SandpackSidePanel from '../sidebar/SandPackSidePanel.vue';
import GraphFeature from './features/GraphFeature.vue';
import DocumentsFeature from './features/DocumentsFeature.vue';

const props = defineProps<{
  isOpen: boolean;
  activeFeature: string | null;
  nodeId?: string;
}>();

const emit = defineEmits<{
  'close': [];
  'panel-opened': [];
  'panel-closed': [];
  'document-selected': [document: any];
  'document-dragged': [document: any, event: DragEvent];
  'open-workspace': [instance: any];
}>();

// Stores
const themeStore = useThemeStore();
const appStore = useAppStore();


// Theme reactivity
const currentTheme = computed(() => themeStore.currentTheme);
const isDarkTheme = computed(() => themeStore.isDarkTheme(currentTheme.value));
const themeColors = computed(() => themeStore.getThemeColors(currentTheme.value));

// Feature configurations matching the new feature IDs
const featureConfigs = {
  'model-selector': { 
    icon: Settings, 
    label: 'Models', 
    color: '#8b5cf6' 
  },
  'sandpack': { 
    icon: Code, 
    label: 'Code Editor', 
    color: '#3b82f6' 
  },
  'claude-code': { 
    icon: Bot, 
    label: 'Claude Code', 
    color: '#f59e0b' 
  },
  'testing': { 
    icon: TestTube, 
    label: 'Testing', 
    color: '#22c55e' 
  },
  'mock-data': { 
    icon: Database, 
    label: 'Mock Data', 
    color: '#ec4899' 
  },
  'force-graph': { 
    icon: GitBranch, 
    label: 'Force Graph', 
    color: '#10b981' 
  },
  'documents': { 
    icon: FileText, 
    label: 'Documents', 
    color: '#f59e0b' 
  },
  'themes': { 
    icon: Palette, 
    label: 'Themes', 
    color: '#f59e0b' 
  }
};

const featureConfig = computed(() => {
  return props.activeFeature ? featureConfigs[props.activeFeature] : null;
});

// Methods
const handleClose = () => {
  emit('close');
};

// Computed styles
const panelStyle = computed(() => {
  let backgroundColor = isDarkTheme.value ? 'rgba(15, 15, 15, 0.95)' : 'rgba(250, 250, 250, 0.95)';
  let borderColor = isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)';
  
  // Theme-specific adjustments
  if (currentTheme.value === 'cyberpunk') {
    backgroundColor = 'rgba(10, 10, 20, 0.95)';
    borderColor = `${themeColors.value.primary}40`;
  } else if (currentTheme.value === 'synthwave') {
    backgroundColor = 'rgba(20, 5, 30, 0.95)';
    borderColor = `${themeColors.value.secondary}40`;
  }

  return {
    backgroundColor,
    borderColor,
    backdropFilter: 'blur(10px)',
    borderLeft: `1px solid ${borderColor}`,
    transition: 'background-color 0.3s ease'
  };
});

const headerStyle = computed(() => {
  return {
    borderBottom: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`,
    backgroundColor: isDarkTheme.value ? 'rgba(20, 20, 20, 0.5)' : 'rgba(240, 240, 240, 0.5)'
  };
});

const closeButtonStyle = computed(() => {
  return {
    backgroundColor: 'transparent',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
    border: 'none',
    transition: 'all 0.2s ease'
  };
});

const getFeatureIconStyle = () => {
  const color = featureConfig.value?.color || '#6b7280';
  return {
    backgroundColor: `${color}20`,
    border: `1px solid ${color}40`
  };
};

// Dynamic panel positioning based on right sidebar expansion
const panelPositionStyle = computed(() => {
  const rightSidebarWidth = appStore.isRightSidebarExpanded ? 180 : 60;
  return {
    right: `${rightSidebarWidth}px`
  };
});
</script>

<style scoped>
.feature-content-panel {
  position: fixed;
  top: 0;
  height: 100vh;
  width: 35vw;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  z-index: 998;
  transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-header {
  padding: 20px;
  flex-shrink: 0;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.feature-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.feature-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.panel-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: inherit;
}

.close-button {
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1) !important;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.fallback-content {
  padding: 40px 20px;
  text-align: center;
}

.fallback-message h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: inherit;
}

.fallback-message p {
  color: rgba(128, 128, 128, 0.8);
  font-size: 14px;
}

/* Themes Feature Styling */
.themes-feature-container {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.themes-feature-content {
  max-width: 100%;
}

.themes-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.theme-card {
  transition: all 0.2s ease;
}

.theme-card:hover {
  transform: translateY(-1px);
}

.theme-card:active {
  transform: translateY(0);
}

/* Custom scrollbar for themes grid */
.themes-grid::-webkit-scrollbar {
  width: 4px;
}

.themes-grid::-webkit-scrollbar-track {
  background: transparent;
}

.themes-grid::-webkit-scrollbar-thumb {
  background: hsl(var(--bc) / 0.2);
  border-radius: 2px;
}

.themes-grid::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--bc) / 0.3);
}

/* Smooth slide panel transitions */
.slide-content-panel-enter-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
}

.slide-content-panel-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.6, 1);
  will-change: transform, opacity;
}

.slide-content-panel-enter-from {
  transform: translateX(100%) scale(0.95);
  opacity: 0;
}

.slide-content-panel-leave-to {
  transform: translateX(100%) scale(0.95);
  opacity: 0;
}
</style>