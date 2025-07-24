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
          <!-- Feature Tabs -->
          <div class="feature-tabs">
            <button
              v-for="feature in availableFeatures"
              :key="feature.id"
              :class="['feature-tab', { 'active': feature.id === activeFeature }]"
              @click="handleFeatureSwitch(feature.id)"
              :style="getFeatureTabStyle(feature)"
              :title="feature.description"
            >
              <component :is="feature.icon" :size="18" />
            </button>
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
import { useCanvasStore } from '@/stores/canvasStore';
import { useThemeColors } from '@/composables/useThemeColors';

// AgentConfigurator extracted features
import ModelSelectorFeature from './features/ModelSelectorFeature.vue';
import ClaudeCodeManagementFeature from './features/ClaudeCodeManagementFeature.vue';
import TestingFeature from './features/TestingFeature.vue';

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
  'feature-switch': [featureId: string];
}>();

// Stores
const themeStore = useThemeStore();
const appStore = useAppStore();
const canvasStore = useCanvasStore();

// Theme composable
const { currentTheme, isDarkTheme, themeColors, forceLightText, getTextColor } = useThemeColors();

// Feature configurations matching the new feature IDs
const featureConfigs = {
  'model-selector': { 
    icon: Settings, 
    label: 'Configs', 
    color: '#8b5cf6' 
  },
  'sandpack': { 
    icon: Code, 
    label: 'IDE', 
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
  'force-graph': { 
    icon: GitBranch, 
    label: 'Clusters', 
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

// Available features for tabs (excluding 'themes' as it's handled inline)
const availableFeatures = computed(() => [
  { 
    id: 'model-selector', 
    icon: Bot, 
    label: 'Models', 
    color: themeColors.value.primary,
    description: 'Model selector and agent configuration'
  },
  { 
    id: 'sandpack', 
    icon: Code, 
    label: 'Code Editor', 
    color: themeColors.value.primary,
    description: 'Code editor + preview + relic manager'
  },
  { 
    id: 'claude-code', 
    icon: Settings, 
    label: 'Claude Code', 
    color: themeColors.value.primary,
    description: 'Claude Code instance management'
  },
  { 
    id: 'force-graph', 
    icon: GitBranch, 
    label: 'Clusters', 
    color: themeColors.value.primary,
    description: 'Interactive workspace relationships graph'
  },
  { 
    id: 'testing', 
    icon: TestTube, 
    label: 'Testing', 
    color: themeColors.value.primary,
    description: 'Model testing and evaluation suite'
  },
  { 
    id: 'documents', 
    icon: FileText, 
    label: 'Documents', 
    color: themeColors.value.primary,
    description: 'RAG document panel and management'
  }
]);

// Methods
const handleClose = () => {
  // Emit back-to-features instead of close to return to features list
  emit('close');
};

const handleFeatureSwitch = (featureId: string) => {
  emit('feature-switch', featureId);
};

const getFeatureTabStyle = (feature: any) => {
  const isActive = feature.id === props.activeFeature;
  return {
    backgroundColor: isActive ? `${feature.color}20` : 'transparent',
    borderColor: isActive ? `${feature.color}40` : 'transparent',
    color: isActive ? feature.color : (forceLightText.value ? 'rgba(255, 255, 255, 0.7)' : (isDarkTheme.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)')),
    transition: 'all 0.2s ease'
  };
};

// Computed styles
const panelStyle = computed(() => {
  // Reduce opacity when a node is snapped to let aurora background show through
  const isNodeSnapped = !!canvasStore.snappedNodeId;
  const opacityMultiplier = isNodeSnapped ? 0.6 : 1.0;
  
  let backgroundColor = isDarkTheme.value ? `rgba(15, 15, 15, ${0.85 * opacityMultiplier})` : `rgba(250, 250, 250, ${0.9 * opacityMultiplier})`;
  let borderColor = isDarkTheme.value ? `rgba(80, 80, 80, ${0.3 * opacityMultiplier})` : `rgba(200, 200, 200, ${0.3 * opacityMultiplier})`;
  
  // Theme-specific adjustments
  if (currentTheme.value === 'cyberpunk') {
    backgroundColor = `rgba(10, 10, 20, ${0.85 * opacityMultiplier})`;
    borderColor = `${themeColors.value.primary}40`;
  } else if (currentTheme.value === 'synthwave') {
    backgroundColor = `rgba(20, 5, 30, ${0.85 * opacityMultiplier})`;
    borderColor = `${themeColors.value.secondary}40`;
  } else if (currentTheme.value === 'cmyk') {
    backgroundColor = `rgba(8, 8, 15, ${0.85 * opacityMultiplier})`;
    borderColor = `${themeColors.value.primary}40`;
  }

  return {
    backgroundColor,
    borderColor,
    backdropFilter: isNodeSnapped ? 'blur(8px)' : 'blur(12px)',
    color: forceLightText.value ? 'rgba(255, 255, 255, 0.95)' : getTextColor(),
    transition: 'background-color 0.3s ease, color 0.3s ease, backdrop-filter 0.3s ease'
  };
});

const headerStyle = computed(() => {
  return {
    borderBottom: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`,
  };
});

const closeButtonStyle = computed(() => {
  return {
    backgroundColor: 'transparent',
    color: forceLightText.value ? 'rgba(255, 255, 255, 0.7)' : (isDarkTheme.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'),
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
  const rightSidebarWidth = appStore.isRightSidebarExpanded ? 180 : 0;
  return {
    right: `${rightSidebarWidth}px`
  };
});
</script>

<style scoped>
.feature-content-panel {
  position: fixed;
  border-bottom-left-radius: 16px;
  border-top-left-radius: 16px;
  top: 0;
  height: 100vh;
  width: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  z-index: 1000;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  /* Remove transition on right property to avoid conflicts with slide animation */
}

/* Ensure text is readable in all themes */
.feature-content-panel .panel-title,
.feature-content-panel .fallback-message h3 {
  color: inherit;
}

/* Force light text for dark themes */
.feature-content-panel.theme-dark,
.feature-content-panel.theme-synthwave,
.feature-content-panel.theme-halloween,
.feature-content-panel.theme-forest,
.feature-content-panel.theme-aqua,
.feature-content-panel.theme-black,
.feature-content-panel.theme-luxury,
.feature-content-panel.theme-neon,
.feature-content-panel.theme-dracula,
.feature-content-panel.theme-business,
.feature-content-panel.theme-night,
.feature-content-panel.theme-coffee {
  color: rgba(255, 255, 255, 0.95);
}

.feature-content-panel.theme-dark .panel-title,
.feature-content-panel.theme-synthwave .panel-title,
.feature-content-panel.theme-cyberpunk .panel-title,
.feature-content-panel.theme-halloween .panel-title,
.feature-content-panel.theme-forest .panel-title,
.feature-content-panel.theme-aqua .panel-title,
.feature-content-panel.theme-black .panel-title,
.feature-content-panel.theme-luxury .panel-title,
.feature-content-panel.theme-neon .panel-title,
.feature-content-panel.theme-dracula .panel-title,
.feature-content-panel.theme-cmyk .panel-title,
.feature-content-panel.theme-business .panel-title,
.feature-content-panel.theme-acid .panel-title,
.feature-content-panel.theme-night .panel-title,
.feature-content-panel.theme-coffee .panel-title,
.feature-content-panel.theme-dark .fallback-message h3,
.feature-content-panel.theme-synthwave .fallback-message h3,
.feature-content-panel.theme-cyberpunk .fallback-message h3,
.feature-content-panel.theme-halloween .fallback-message h3,
.feature-content-panel.theme-forest .fallback-message h3,
.feature-content-panel.theme-aqua .fallback-message h3,
.feature-content-panel.theme-black .fallback-message h3,
.feature-content-panel.theme-luxury .fallback-message h3,
.feature-content-panel.theme-neon .fallback-message h3,
.feature-content-panel.theme-dracula .fallback-message h3,
.feature-content-panel.theme-cmyk .fallback-message h3,
.feature-content-panel.theme-business .fallback-message h3,
.feature-content-panel.theme-acid .fallback-message h3,
.feature-content-panel.theme-night .fallback-message h3,
.feature-content-panel.theme-coffee .fallback-message h3 {
  color: rgba(255, 255, 255, 0.95) !important;
}

.feature-content-panel.theme-cmyk,
.feature-content-panel.theme-cyberpunk,
.feature-content-panel.theme-acid {
  color: rgba(14, 14, 14, 0.95) !important;
}

.panel-header {
  padding: 20px;
  flex-shrink: 0;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.feature-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  justify-content: space-around;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.feature-tabs::-webkit-scrollbar {
  display: none;
}

.feature-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.2s ease;
  min-width: fit-content;
}

.feature-tab:hover {
  background-color: rgba(128, 128, 128, 0.1);
  transform: translateY(-1px);
}

.feature-tab.active {
  font-weight: 600;
}

.tab-label {
  font-size: 12px;
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
  backdrop-filter: blur(60px);
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
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
}

.slide-content-panel-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.6, 1), opacity 0.2s ease-out;
}

.slide-content-panel-enter-from {
  transform: translateX(105%);
  opacity: 0;
}

.slide-content-panel-leave-to {
  transform: translateX(105%);
  opacity: 0;
}

/* Universal Feature Panel Gradient System */
/* This creates a 3-section vertical gradient layout for all features */

/* Section 1: Top (Primary color dominant) */
.feature-content-panel :deep(.section-top),
.feature-content-panel :deep(.overview-panel),
.feature-content-panel :deep(.header-section),
.feature-content-panel :deep(.stats-section),
.feature-content-panel :deep(.agents-header-row),
.feature-content-panel :deep(.documents-header) {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 12%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 8%, hsl(var(--b2))));
  border-bottom: 1px solid color-mix(in srgb, v-bind(themeColors.primary) 25%, hsl(var(--bc) / 0.1));
  position: relative;
}

.feature-content-panel :deep(.section-top)::after,
.feature-content-panel :deep(.overview-panel)::after,
.feature-content-panel :deep(.header-section)::after,
.feature-content-panel :deep(.stats-section)::after,
.feature-content-panel :deep(.agents-header-row)::after,
.feature-content-panel :deep(.documents-header)::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: linear-gradient(90deg, 
    v-bind(themeColors.primary), 
    v-bind(themeColors.secondary), 
    v-bind(themeColors.accent));
}

/* Section 2: Middle (Secondary color dominant) */
.feature-content-panel :deep(.section-middle),
.feature-content-panel :deep(.sessions-panel),
.feature-content-panel :deep(.main-section),
.feature-content-panel :deep(.content-section),
.feature-content-panel :deep(.main-columns),
.feature-content-panel :deep(.search-section),
.feature-content-panel :deep(.results-section) {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.secondary) 10%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.accent) 6%, hsl(var(--b2))));
  border-bottom: 1px solid color-mix(in srgb, v-bind(themeColors.secondary) 25%, hsl(var(--bc) / 0.1));
}

/* Section 3: Bottom (Accent color dominant) */
.feature-content-panel :deep(.section-bottom),
.feature-content-panel :deep(.actions-panel),
.feature-content-panel :deep(.footer-section),
.feature-content-panel :deep(.controls-section),
.feature-content-panel :deep(.config-section) {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 10%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.primary) 6%, hsl(var(--b2))));
  border-bottom: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 25%, hsl(var(--bc) / 0.1));
}

/* Universal Button Styles with Gradient */
.feature-content-panel :deep(.btn-primary),
.feature-content-panel :deep(.primary-btn),
.feature-content-panel :deep(.action-btn-primary) {
  background: linear-gradient(135deg, 
    v-bind(themeColors.primary), 
    v-bind(themeColors.secondary)) !important;
  color: white !important;
  border: none !important;
  border-radius: 8px !important;
  padding: 0.5rem 1rem !important;
  font-weight: 500 !important;
  transition: all 0.2s ease !important;
}

.feature-content-panel :deep(.btn-primary):hover,
.feature-content-panel :deep(.primary-btn):hover,
.feature-content-panel :deep(.action-btn-primary):hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 90%, black), 
    color-mix(in srgb, v-bind(themeColors.secondary) 90%, black)) !important;
  transform: translateY(-1px) !important;
}

.feature-content-panel :deep(.btn-secondary),
.feature-content-panel :deep(.secondary-btn),
.feature-content-panel :deep(.action-btn-secondary) {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 12%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.primary) 8%, hsl(var(--b2)))) !important;
  color: hsl(var(--bc)) !important;
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 25%, hsl(var(--bc) / 0.1)) !important;
  border-radius: 8px !important;
  padding: 0.5rem 1rem !important;
  font-weight: 500 !important;
  transition: all 0.2s ease !important;
}

.feature-content-panel :deep(.btn-secondary):hover,
.feature-content-panel :deep(.secondary-btn):hover,
.feature-content-panel :deep(.action-btn-secondary):hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.accent) 18%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.primary) 12%, hsl(var(--b2)))) !important;
  transform: translateY(-1px) !important;
}

/* Universal Icon Button Styles */
.feature-content-panel :deep(.icon-btn),
.feature-content-panel :deep(.action-btn) {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 8%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 6%, hsl(var(--b2)))) !important;
  color: hsl(var(--bc)) !important;
  border: 1px solid color-mix(in srgb, v-bind(themeColors.primary) 20%, hsl(var(--bc) / 0.1)) !important;
  border-radius: 8px !important;
  padding: 0.5rem !important;
  transition: all 0.2s ease !important;
}

.feature-content-panel :deep(.icon-btn):hover,
.feature-content-panel :deep(.action-btn):hover {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 12%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 9%, hsl(var(--b2)))) !important;
  transform: translateY(-1px) !important;
}

.feature-content-panel :deep(.icon-btn.active),
.feature-content-panel :deep(.action-btn.active) {
  background: linear-gradient(135deg, 
    v-bind(themeColors.primary), 
    v-bind(themeColors.secondary)) !important;
  color: white !important;
}

/* Universal Card Styles */
.feature-content-panel :deep(.card),
.feature-content-panel :deep(.stat-box),
.feature-content-panel :deep(.info-card),
.feature-content-panel :deep(.session-card),
.feature-content-panel :deep(.document-card),
.feature-content-panel :deep(.model-card) {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 4%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 3%, hsl(var(--b2)))) !important;
  border: 1px solid color-mix(in srgb, v-bind(themeColors.accent) 15%, hsl(var(--bc) / 0.1)) !important;
  border-radius: 10px !important;
  padding: 1rem !important;
  transition: all 0.2s ease !important;
  position: relative !important;
}

.feature-content-panel :deep(.card):hover,
.feature-content-panel :deep(.stat-box):hover,
.feature-content-panel :deep(.info-card):hover,
.feature-content-panel :deep(.session-card):hover,
.feature-content-panel :deep(.document-card):hover,
.feature-content-panel :deep(.model-card):hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

.feature-content-panel :deep(.card)::after,
.feature-content-panel :deep(.stat-box)::after,
.feature-content-panel :deep(.info-card)::after,
.feature-content-panel :deep(.session-card)::after,
.feature-content-panel :deep(.document-card)::after,
.feature-content-panel :deep(.model-card)::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: radial-gradient(circle at 50% 0%, 
    color-mix(in srgb, v-bind(themeColors.accent) 8%, transparent) 0%, 
    transparent 70%);
  pointer-events: none;
}

/* Universal Input Styles */
.feature-content-panel :deep(.form-field),
.feature-content-panel :deep(.search-input),
.feature-content-panel :deep(.filter-select),
.feature-content-panel :deep(input),
.feature-content-panel :deep(textarea),
.feature-content-panel :deep(select) {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 3%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 2%, hsl(var(--b2)))) !important;
  border: 1px solid color-mix(in srgb, v-bind(themeColors.primary) 20%, hsl(var(--bc) / 0.1)) !important;
  border-radius: 8px !important;
  padding-left: 30px;
  color: hsl(var(--bc)) !important;
  transition: all 0.2s ease !important;
}

.feature-content-panel :deep(.form-field):focus,
.feature-content-panel :deep(.search-input):focus,
.feature-content-panel :deep(.filter-select):focus,
.feature-content-panel :deep(input):focus,
.feature-content-panel :deep(textarea):focus,
.feature-content-panel :deep(select):focus {
  border-color: v-bind(themeColors.primary) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, v-bind(themeColors.primary) 20%, transparent) !important;
  outline: none !important;
}

/* Special gradient highlight for active/selected items */
.feature-content-panel :deep(.selected),
.feature-content-panel :deep(.active),
.feature-content-panel :deep(.highlighted) {
  background: linear-gradient(135deg, 
    color-mix(in srgb, v-bind(themeColors.primary) 15%, hsl(var(--b1))),
    color-mix(in srgb, v-bind(themeColors.secondary) 12%, hsl(var(--b2)))) !important;
  border-color: v-bind(themeColors.primary) !important;
}
</style>