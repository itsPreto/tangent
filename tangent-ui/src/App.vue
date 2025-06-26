<template>
  <div class="min-h-screen bg-background app-container" :class="['theme-' + currentTheme]">

    <!-- Side Panel -->
    <SidePanel
      class="fixed left-0 top-0 h-full w-[40vw] bg-background transform transition-transform shadow-xl duration-300 z-40 side-panel overflow-hidden"
      :class="[
        appStore.isSidePanelOpen ? 'translate-x-0' : '-translate-x-full',
        'theme-' + currentTheme
      ]"
      style="margin: 2rem 2rem 2rem 0rem; border-color: #334155; border-width: 1px; height: calc(100vh - 4rem); border-radius: 0 1.5rem 1.5rem 0; border-left: none;"
      :node-id="currentNodeId" @panel-opened="appStore.openSidePanel" @panel-closed="appStore.closeSidePanel" />

    <!-- Toggle Button -->
    <button @click="appStore.toggleSidePanel()"
      class="fixed top-1/2 -translate-y-1/2 z-50 p-2 border border-l-0 rounded-r-md transition-all duration-300 shadow-md toggle-panel-btn"
      :style="{ ...toggleButtonStyle, left: appStore.isSidePanelOpen ? 'calc(40vw - 0.1rem)' : '0' }">
      <ChevronRight class="w-5 h-5 transition-transform" :class="{ 'rotate-180': appStore.isSidePanelOpen }" />
    </button>

    <!-- Top Controls Container -->
    <div class="fixed transition-all duration-300 top-controls relative" style="z-index: 60;"
      :class="topControlsClasses" :style="topControlsContainerStyle">

      <!-- Ultra-compact layout with centered logo -->
      <template v-if="isUltraCompact">
        <div class="w-full flex items-center justify-between">
          <!-- Left Menu -->
          <div class="relative overflow-menu flex items-center">
            <button @click="showOverflowMenu = !showOverflowMenu"
              class="btn btn-sm btn-ghost theme-btn flex items-center justify-center" :style="buttonStyles">
              <Menu class="w-4 h-4" />
            </button>

            <!-- Overflow dropdown -->
            <div v-if="showOverflowMenu"
              class="absolute top-full left-0 mt-1 bg-base-100 rounded-lg shadow-lg border min-w-40"
              style="z-index: 9999;" :style="dropdownStyle">
              <div class="p-1">
                <button @click="handleNewWorkspace; showOverflowMenu = false"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-base-200 rounded">
                  <Plus class="w-4 h-4" />
                  New Workspace
                </button>
                <!-- <button @click="triggerFileSelect; showOverflowMenu = false"
                      class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-base-200 rounded">
                      <UploadCloud class="w-4 h-4" />
                      Import JSON
                    </button> -->
                <ThemeToggle class="w-full" />
              </div>
            </div>
          </div>

          <!-- Right Menu -->
          <div class="relative right-overflow-menu flex items-center">
            <button @click="showRightOverflowMenu = !showRightOverflowMenu"
              class="btn btn-sm btn-ghost theme-btn relative flex items-center justify-center" :style="buttonStyles">
              <div v-if="selectedModel" class="w-2 h-2 rounded-full bg-primary absolute -top-1 -right-1"></div>
              <MoreVertical class="w-4 h-4" />
            </button>

            <!-- Right overflow dropdown -->
            <div v-if="showRightOverflowMenu"
              class="absolute top-full right-0 mt-1 bg-base-100 rounded-lg shadow-lg border min-w-40"
              style="z-index: 9999;" :style="dropdownStyle">
              <div class="p-1">
                <WorkspaceMenu class="w-full" ref="workspaceMenuRef" @workspace-loaded="handleWorkspaceLoaded" />
                <button @click="appStore.openAgentConfigurator(); showRightOverflowMenu = false"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-base-200 rounded">
                  <Settings class="w-4 h-4" />
                  Settings
                  <span v-if="selectedModel" class="ml-auto text-xs opacity-70">{{ selectedModel.name.substring(0, 10)
                  }}...</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Absolutely Centered Logo -->
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style="z-index: 10;">
          <TangentLogo class="scale-75" />
        </div>
      </template>

      <!-- Normal and compact layouts -->
      <template v-else>
        <div class="w-full flex items-center justify-between">
          <!-- Left Controls Section -->
          <div class="flex items-center gap-2 left-controls">

            <!-- Primary Actions -->
            <div class="flex items-center gap-1" :class="{ 'gap-1': isCompactMode, 'gap-2': !isCompactMode }">
              <button @click="handleNewWorkspace"
                class="btn btn-sm btn-ghost transition-all duration-300 shadow-md theme-btn flex items-center justify-center"
                :class="compactButtonClasses" :style="buttonStyles" :title="'New Workspace'">
                <Plus :class="iconSizeClasses" />
                <span v-if="!isCompactMode" class="hidden sm:inline text-xs">New</span>
              </button>

              <div class="flex-shrink min-w-0 max-w-[150px] sm:max-w-[200px]">
                <WorkspaceMenu ref="workspaceMenuRef" @workspace-loaded="handleWorkspaceLoaded" />
              </div>

            </div>
          </div>

          <!-- Right Controls Section -->
          <div class="flex items-center gap-2 right-controls">

            <!-- <ThemeToggle v-if="!isCompactMode" /> -->

            <!-- Model Badge - collapsible with hover scroll -->
            <div v-if="selectedModel && !isCompactMode" class="relative model-badge-container">
              <Badge @click.stop="appStore.openAgentConfigurator()" @mouseenter="startHoverScrolling"
                @mouseleave="stopHoverScrolling" @wheel.prevent="handleScrollOnBadge"
                class="model-badge cursor-pointer transition-all duration-200" :class="{
                  'h-6 p-2': !isCompactMode,
                  'h-5 p-1 text-xs': isCompactMode,
                  'ring-2 ring-primary/50': isHovering
                }" :style="modelBadgeStyle">
                {{ isCompactMode ? (currentDisplayModel?.name || selectedModel?.name || '').substring(0, 8) + '...' :
                  (currentDisplayModel?.name || selectedModel?.name || '') }}
              </Badge>

              <!-- Confirmation Dialog -->
              <div v-if="showConfirmDialog"
                class="absolute top-full mt-2 bg-base-100 rounded-lg shadow-lg border border-base-300 p-3 z-50 max-w-xs right-0"
                :style="confirmDialogStyle">
                <p class="text-sm mb-3 text-center break-words">
                  Switch to <span class="font-medium">{{ hoveredModel?.name }}</span>?
                </p>
                <div class="flex gap-2 justify-center">
                  <button @click="confirmModelSwitch" class="btn btn-sm btn-primary">
                    Yes
                  </button>
                  <button @click="cancelModelSwitch" class="btn btn-sm btn-ghost">
                    No
                  </button>
                </div>
              </div>
            </div>

            <!-- Compact model indicator -->
            <button v-if="selectedModel && isCompactMode" @click="appStore.openAgentConfigurator()"
              class="btn btn-sm btn-ghost theme-btn relative flex items-center justify-center" :style="buttonStyles"
              :title="selectedModel.name">
              <div class="w-2 h-2 rounded-full bg-primary absolute -top-1 -right-1"></div>
              <Settings :class="iconSizeClasses" />
            </button>

            <!-- Settings Button -->
            <!-- <button v-if="!isCompactMode || !selectedModel" 
                @click="appStore.openAgentConfigurator()" 
                class="btn btn-sm btn-ghost theme-btn flex items-center justify-center" 
                :style="buttonStyles"
                :title="'Settings'">
                <Settings :class="iconSizeClasses" />
              </button> -->

          </div>
        </div>

        <!-- Absolutely Centered Logo -->
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 center-controls" style="z-index: 10;">
          <TangentLogo :class="{ 'scale-75': isCompactMode }" />
        </div>
      </template>
    </div>

    <!-- Bottom Controls Container -->
    <div v-if="!isInOverview" class="fixed bottom-0 z-50 transition-all duration-300 flex justify-start" :style="{
      left: appStore.isSidePanelOpen ? '40vw' : '0',
      right: appStore.isAgentConfiguratorOpen ? '40vw' : '0'
    }">
      <div class="flex flex-col px-4 space-y-2 md:flex-row md:items-center md:space-y-0 md:space-x-4 mb-4">
        <button @click="handleBackToWorkspaces" class="btn btn-sm back-to-workspaces-btn hover:bg-base-300/90"
          :style="controlButtonStyle">
          <ArrowLeft class="w-4 h-4" />
          <span class="text-sm">Back to Workspaces</span>
        </button>
      </div>
    </div>

    <!-- Canvas Controls -->
    <div v-if="!isInOverview" class="fixed bottom-4 z-50 flex items-center gap-2"
      :style="{ right: appStore.isAgentConfiguratorOpen ? 'calc(40vw)' : '0px' }">
      <button class="h-8 px-3 canvas-control-btn hover:bg-base-300/90" :style="controlButtonStyle"
        @click="toggleAutoZoom">
        <span class="text-sm">{{ canvasAutoZoom ? 'Auto-fit On' : 'Auto-fit Off' }}</span>
      </button>
      <button class="h-8 px-3 canvas-control-btn hover:bg-base-300/90 flex items-center gap-2"
        :style="controlButtonStyle" @click="gestureMode = gestureMode === 'zoom' ? 'scroll' : 'zoom'">
        <component :is="gestureMode === 'zoom' ? ZoomIn : Move" class="w-4 h-4" />
        <span class="text-sm">Two-finger {{ gestureMode === 'zoom' ? 'Zoom' : 'Pan' }}</span>
      </button>
      <div class="px-3 h-8 text-sm zoom-indicator flex items-center"
        :style="controlButtonStyle">
        {{ Math.round(canvasZoom * 100) }}%
      </div>
    </div>

    <!-- Canvas Container Wrapper -->
    <div class="transition-all duration-300 canvas-wrapper" :class="'theme-' + currentTheme"
      :style="canvasWrapperStyle">
      <InfiniteCanvas ref="canvasRef" :selected-model="selectedModel?.id || ''" :open-router-api-key="openRouterApiKey"
        :model-type="modelType" :side-panel-open="appStore.isSidePanelOpen"
        :right-panel-open="appStore.isAgentConfiguratorOpen" :gesture-mode="gestureMode" v-model:zoom="canvasZoom"
        v-model:auto-zoom-enabled="canvasAutoZoom" v-model:is-height-locked="isHeightLocked"
        :viewport-height="windowSize.innerHeight" :viewport-width="windowSize.innerWidth"
        @node-selected="handleNodeSelected" />
    </div>

    <!-- Workspace Overview Title -->
    <div v-if="!isInOverview" class="fixed bottom-4 z-50 w-full text-center transition-all duration-300"
      :style="{ left: appStore.isSidePanelOpen ? '40vw' : '0', right: '0' }">
      <div v-if="showOverviewTitle"
        class="inline-block px-8 py-3 overview-title border border-base-300 text-lg font-semibold relative overflow-hidden group hover:px-12 hover:py-4 transition-all duration-300"
        :style="overviewTitleStyle">
        <span
          class="absolute p-8 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 group-hover:left-4 group-focus:left-4">
          <Search class="w-5 h-5" />
        </span>
        <span
          class="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus:opacity-100">...</span>
      </div>
    </div>


    <!-- Agent Configurator Right Side Panel -->
    <AgentConfiguratorSidePanel
      class="fixed right-0 top-0 h-full w-[40vw] bg-background transform transition-transform duration-300 z-40 agent-configurator-panel overflow-hidden"
      :class="[
        appStore.isAgentConfiguratorOpen ? 'translate-x-0' : 'translate-x-full',
        'theme-' + currentTheme
      ]"
      style="margin-top: 2rem; margin-bottom: 2rem; margin-left: 2rem;  height: calc(100vh - 4rem); border-radius: 1.5rem 0 0 1.5rem; border-right: none;"
      @close="appStore.closeAgentConfigurator" @model-selected="handleModelSelected" @api-key-saved="handleApiKeySaved"
      :current-model="selectedModel" />

    <!-- Agent Configurator Toggle Button -->
    <button @click="appStore.toggleAgentConfigurator"
      class="fixed top-1/2 -translate-y-1/2 z-50 p-2 border border-r-0 rounded-l-md transition-all duration-300 shadow-md agent-toggle-btn"
      :style="{ ...toggleButtonStyle, right: appStore.isAgentConfiguratorOpen ? 'calc(40vw - 0.1rem)' : '0' }">
      <ChevronRight class="w-5 h-5 transition-transform" :class="{ 'rotate-180': !appStore.isAgentConfiguratorOpen }" />
    </button>

    <!-- Progress Indicator -->
    <div v-if="isImporting" class="fixed inset-0 z-50 flex items-center justify-center progress-overlay"
      :style="progressOverlayStyle">
      <div class="p-4 bg-base-100 rounded-lg shadow-lg text-center progress-card" :style="progressCardStyle">
        <p class="text-lg font-semibold mb-2">Importing Workspaces...</p>
        <progress class="progress w-56" :value="importProgress" max="100" :style="progressBarStyle"></progress>
        <p class="mt-2 text-sm">{{ importStatus }}</p>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, provide, watch, nextTick } from 'vue';
import { Plus, ArrowLeft, Settings, ChevronRight, ZoomIn, Move, Search, HelpCircle, UploadCloud, Eye, Menu, MoreVertical } from 'lucide-vue-next';
import 'highlight.js/styles/github-dark.css';
import InfiniteCanvas from './components/canvas/InfiniteCanvas.vue';
import ThemeToggle from './components/theme/ThemeToggle.vue';
import TangentLogo from './components/logo/TangentLogo.vue';
import WorkspaceMenu from './components/workspace/WorkspaceMenu.vue';
import SidePanel from './components/sidebar/SandPackSidePanel.vue';
import AgentConfiguratorSidePanel from './components/settings/AgentConfiguratorSidePanel.vue';
import Badge from './components/ui/Badge.vue';
import { useCanvasStore } from '@/stores/canvasStore';
import { useModelStore } from '@/stores/modelStore';
import { useChatStore } from '@/stores/chatStore';
import { useAppStore } from '@/stores/appStore';
import { useThemeStore } from '@/stores/themeStore';
import { useAgentStore } from '@/stores/agentStore';
import emitter from '@/utils/eventBus'
import type { Node } from '@/types/message';
import type { ModelInfo } from '@/types/model';

const gestureMode = ref<'scroll' | 'zoom'>('zoom');
const anthropicApiKey = ref(localStorage.getItem('anthropicApiKey') || '');

// Canvas and workspace state
const canvasRef = ref<InstanceType<typeof InfiniteCanvas> | null>(null);
provide('canvasRef', canvasRef);
const canvasZoom = ref(1);
const canvasAutoZoom = ref(true);

const windowSize = ref({
  innerHeight: 0,
  innerWidth: 0
});

const showLogo = computed(() => {
  return (canvasRef.value?.workspaces && canvasRef.value.workspaces.length !== 0) || false;
});

const currentNodeId = ref('');

// Stores
const canvasStore = useCanvasStore();
const modelStore = useModelStore();
const chatStore = useChatStore();
const appStore = useAppStore();
const themeStore = useThemeStore();
const agentStore = useAgentStore();

// Theme awareness
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');

// Theme observer
let themeObserver;

const selectedNode = ref<Node | null>(null);

// Model selection and API keys (Corrected Initialization)
const modelType = ref<string>(''); // Initialize to empty string
const openRouterApiKey = ref('');
const geminiApiKey = ref('');
const customApiUrl = ref<string | null>(null);

// Model badge hover scrolling state
const isHovering = ref(false);
const currentDisplayModel = ref<ModelInfo | null>(null);
const hoveredModel = ref<ModelInfo | null>(null);
const showConfirmDialog = ref(false);
const allModels = ref<ModelInfo[]>([]);
const originalModel = ref<ModelInfo | null>(null);

// Initialize from local storage *after* defining the refs
modelType.value = localStorage.getItem('modelType') || '';
openRouterApiKey.value = localStorage.getItem('openRouterApiKey') || '';
geminiApiKey.value = localStorage.getItem('geminiApiKey') || '';

// Computed selectedModel that reflects the active code agent's model
const selectedModel = computed(() => {
  // First try to get the code agent's model
  const codeAgentModel = agentStore.codeAgent?.model;
  if (codeAgentModel) {
    return codeAgentModel;
  }

  // Fallback to text agent if code agent is not configured
  const textAgentModel = agentStore.textAgent?.model;
  if (textAgentModel) {
    return textAgentModel;
  }

  // Final fallback to localStorage or modelStore
  const storedModel = localStorage.getItem('selectedModel') ? JSON.parse(localStorage.getItem('selectedModel')!) : null;
  return storedModel || modelStore.selectedModel;
});

// Initialize currentDisplayModel with selectedModel
currentDisplayModel.value = selectedModel.value;

// Watch selectedModel changes and update currentDisplayModel
watch(selectedModel, (newModel) => {
  if (newModel && !isHovering.value) {
    currentDisplayModel.value = newModel;
  }
}, { immediate: true });

// Watch for agent model changes and force update (even during hover)
watch(() => agentStore.codeAgent?.model?.id, (newModelId, oldModelId) => {
  if (newModelId && newModelId !== oldModelId) {
    // Force update when agent model changes, even during hover
    currentDisplayModel.value = agentStore.codeAgent?.model || selectedModel.value;
  }
}, { immediate: false });

const isHeightLocked = ref(false);

// Responsive UI state
const showOverflowMenu = ref(false);
const showRightOverflowMenu = ref(false);

const isInOverview = computed(() => {
  return canvasRef.value?.isWorkspaceOverview ?? true;
});

// Responsive breakpoints based on available space
const availableWidth = computed(() => {
  const leftPanelOpen = appStore.isSidePanelOpen;
  const rightPanelOpen = appStore.isAgentConfiguratorOpen;

  if (leftPanelOpen && rightPanelOpen) {
    return 20; // 20vw when both panels are open
  } else if (leftPanelOpen || rightPanelOpen) {
    return 60; // 60vw when one panel is open
  } else {
    return 100; // 100vw when no panels are open
  }
});

// Responsive modes
const isUltraCompact = computed(() => availableWidth.value <= 25);
const isCompactMode = computed(() => availableWidth.value <= 50);

// Dynamic classes for responsive design
const topControlsClasses = computed(() => ({
  'ultra-compact': isUltraCompact.value,
  'compact': isCompactMode.value && !isUltraCompact.value,
  'normal': !isCompactMode.value
}));

const compactButtonClasses = computed(() => ({
  'px-2': isCompactMode.value,
  'px-3': !isCompactMode.value
}));

const iconSizeClasses = computed(() => ({
  'w-4 h-4': !isCompactMode.value,
  'w-3.5 h-3.5': isCompactMode.value
}));

// Theme-based dynamic styles
const isDarkTheme = computed(() => {
  return themeStore.isDarkTheme(currentTheme.value);
});

const themeColors = computed(() => {
  return themeStore.getThemeColors(currentTheme.value);
});

// Dynamic style objects for theme-aware components
const sidePanelStyle = computed(() => {
  const baseStyles = {
  };

  // Theme-specific adjustments
  if (currentTheme.value === 'cyberpunk') {
    return {
      ...baseStyles,
      boxShadow: `inset 0px 1px 20px 2px ${themeColors.value.primary}50, 0 0 15px ${themeColors.value.secondary}30`,
      borderRight: `2px solid ${themeColors.value.primary}80`,
      background: `linear-gradient(135deg, rgba(0,0,0,0.9), ${adjustColorOpacity(themeColors.value.primary, 0.1)})`
    };
  }

  if (currentTheme.value === 'synthwave') {
    return {
      ...baseStyles,
      boxShadow: `inset 0px 1px 25px 2px ${themeColors.value.secondary}40`,
      background: `linear-gradient(to bottom, rgba(20,10,30,0.9), rgba(80,30,110,0.7))`
    };
  }

  return baseStyles;
});

const toggleButtonStyle = computed(() => {
  const isCyberpunk = currentTheme.value === 'cyberpunk';
  const isSynthwave = currentTheme.value === 'synthwave';
  const isAqua = currentTheme.value === 'aqua';

  let styles = {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(10px)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 80, 0.5)' : 'rgba(200, 200, 200, 0.5)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
  };

  if (isCyberpunk) {
    styles = {
      ...styles,
      backgroundColor: 'rgba(20, 20, 30, 0.9)',
      borderColor: `${themeColors.value.primary}80`,
      boxShadow: `0 0 8px ${themeColors.value.primary}60`,
      color: themeColors.value.primary
    };
  } else if (isSynthwave) {
    styles = {
      ...styles,
      backgroundColor: 'rgba(40, 20, 60, 0.8)',
      borderColor: `${themeColors.value.secondary}70`,
      boxShadow: `0 0 12px ${themeColors.value.secondary}40`
    };
  } else if (isAqua) {
    styles = {
      ...styles,
      backgroundColor: 'rgba(0, 60, 90, 0.7)',
      borderColor: `${themeColors.value.primary}90`,
      boxShadow: `0 0 10px ${themeColors.value.primary}30`
    };
  }

  return styles;
});

const canvasWrapperStyle = computed(() => {
  const leftPanelOpen = appStore.isSidePanelOpen;
  const rightPanelOpen = appStore.isAgentConfiguratorOpen;

  let width = '100vw';
  let marginLeft = '0';
  let marginRight = '0';

  if (leftPanelOpen && rightPanelOpen) {
    width = '20vw';
    marginLeft = '40vw';
    marginRight = '40vw';
  } else if (leftPanelOpen) {
    width = '60vw';
    marginLeft = '40vw';
  } else if (rightPanelOpen) {
    width = '60vw';
    marginRight = '40vw';
  }

  return {
    width,
    marginLeft,
    marginRight
  };
});

const topControlsContainerStyle = computed(() => {
  const leftPanelOpen = appStore.isSidePanelOpen;
  const rightPanelOpen = appStore.isAgentConfiguratorOpen;

  return {
    left: leftPanelOpen ? '40vw' : '0',
    right: rightPanelOpen ? '40vw' : '0',
    width: leftPanelOpen && rightPanelOpen ? '20vw' :
      leftPanelOpen || rightPanelOpen ? '60vw' : '100vw',
    backdropFilter: 'blur(4px)',
    borderBottom: isDarkTheme.value ? '1px solid rgba(80, 80, 80, 0.3)' : '1px solid rgba(200, 200, 200, 0.3)',
    padding: isUltraCompact.value ? '0.5rem' : '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: isCompactMode.value ? '0.5rem' : '1rem'
  };
});

const dropdownStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(8px)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)',
    boxShadow: isDarkTheme.value
      ? '0 10px 25px rgba(0, 0, 0, 0.5)'
      : '0 10px 25px rgba(0, 0, 0, 0.15)'
  };
});

const buttonStyles = computed(() => {
  const primary = themeColors.value.primary;
  const secondary = themeColors.value.secondary;

  // Get background color and text color based on theme
  let bgColor = isDarkTheme.value ? 'rgba(30, 30, 30, 0.7)' : 'rgba(245, 245, 245, 0.7)';
  let borderColor = isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)';
  let textColor = isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)';

  // Theme-specific adjustments
  if (currentTheme.value === 'cyberpunk') {
    bgColor = 'rgba(20, 20, 30, 0.8)';
    borderColor = `${primary}70`;
    textColor = primary;
  } else if (currentTheme.value === 'synthwave') {
    bgColor = 'rgba(40, 20, 60, 0.7)';
    borderColor = `${secondary}60`;
    textColor = secondary;
  } else if (currentTheme.value === 'aqua') {
    bgColor = 'rgba(0, 60, 90, 0.6)';
    borderColor = `${primary}80`;
    textColor = primary;
  }

  return {
    backgroundColor: bgColor,
    borderColor: borderColor,
    color: textColor,
  };
});

const modelBadgeStyle = computed(() => {
  const primary = themeColors.value.primary;

  return {
    backgroundColor: adjustColorOpacity(primary, 0.2),
    color: isDarkTheme.value ? 'white' : 'black',
    border: `1px solid ${adjustColorOpacity(primary, 0.4)}`
  };
});

const confirmDialogStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(8px)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)',
    boxShadow: isDarkTheme.value
      ? '0 10px 25px rgba(0, 0, 0, 0.5)'
      : '0 10px 25px rgba(0, 0, 0, 0.15)'
  };
});

const controlButtonStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 30, 0.8)' : 'rgba(245, 245, 245, 0.8)',
    backdropFilter: 'blur(5px)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
  };
});

const overviewTitleStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 30, 0.8)' : 'rgba(245, 245, 245, 0.8)',
    backdropFilter: 'blur(5px)',
    borderRadius: '9999px',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)',
  };
});

const isImporting = ref(false);
const importProgress = ref(0);
const importStatus = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const progressOverlayStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(20, 20, 25, 0.7)' : 'rgba(240, 240, 245, 0.7)',
    backdropFilter: 'blur(5px)'
  };
});

const progressCardStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 40, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 80, 0.5)' : 'rgba(200, 200, 200, 0.5)',
    boxShadow: isDarkTheme.value
      ? '0 10px 25px rgba(0, 0, 0, 0.5)'
      : '0 10px 25px rgba(0, 0, 0, 0.2)'
  };
});

const progressBarStyle = computed(() => {
  return {
    '--value-color': themeColors.value.primary,
    '--bg-color': isDarkTheme.value ? 'rgba(50, 50, 60, 0.5)' : 'rgba(230, 230, 240, 0.5)',
    height: '0.75rem',
    borderRadius: '0.375rem'
  };
});

const triggerFileSelect = () => {
  fileInput.value?.click();
};

// Helper functions
function adjustColorOpacity(hexColor: string, opacity: number): string {
  // Convert hex to rgb
  let r, g, b;

  // Check if it's a valid hex color
  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hexColor)) {
    // Return a fallback if not a valid hex
    return `rgba(128, 128, 128, ${opacity})`;
  }

  // Convert short hex to full form
  const hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

const toggleAutoZoom = () => {
  canvasAutoZoom.value = !canvasAutoZoom.value;
  if (canvasAutoZoom.value) {
    canvasRef.value?.autoFitNodes();
  }
};

const handleModelSelected = (model: ModelInfo) => {
  // Update the code agent with the selected model
  agentStore.setAgentModel('code', model);
  modelType.value = model.source;
  localStorage.setItem('selectedModel', JSON.stringify(model));
  localStorage.setItem('modelType', model.source);
};

const handleApiKeySaved = ({ provider, apiKey }: { provider: string, apiKey: string }) => {
  // Update local API key references
  switch (provider) {
    case 'openrouter':
      openRouterApiKey.value = apiKey;
      break;
    case 'anthropic':
      anthropicApiKey.value = apiKey;
      break;
    case 'gemini':
      geminiApiKey.value = apiKey;
      break;
  }
};

// Model hover scrolling functions
const initializeAllModels = () => {
  const models: ModelInfo[] = [];

  // Combine all models from different providers (access .value since they are refs)
  if (modelStore.ollamaModels) models.push(...modelStore.ollamaModels);
  if (modelStore.openRouterModels) models.push(...modelStore.openRouterModels);
  if (modelStore.googleModels) models.push(...modelStore.googleModels);
  if (modelStore.anthropicModels) models.push(...modelStore.anthropicModels);
  if (modelStore.openaiModels) models.push(...modelStore.openaiModels);

  console.log('Models found:', {
    ollama: modelStore.ollamaModels?.length || 0,
    openRouter: modelStore.openRouterModels?.length || 0,
    google: modelStore.googleModels?.length || 0,
    anthropic: modelStore.anthropicModels?.length || 0,
    openai: modelStore.openaiModels?.length || 0,
    total: models.length
  });

  allModels.value = models;
};

const startHoverScrolling = async () => {
  isHovering.value = true;

  // Try to load models that are likely to be available
  // Only load Ollama for now since that's what the current model appears to be
  if (!modelStore.ollamaModels.length && selectedModel.value?.source === 'ollama') {
    try {
      await modelStore.initializeProvider('ollama');
    } catch (error) {
      // Silently handle error - will fall back to test models
    }
  }

  initializeAllModels();

  // If we still don't have models, create a test list for demonstration
  if (allModels.value.length === 0) {
    const testModels: ModelInfo[] = [];

    // Add the current model if it exists
    if (selectedModel.value) {
      testModels.push(selectedModel.value);
    }

    // Add some common test models for demonstration
    testModels.push(
      {
        id: 'llama3.2:3b',
        name: 'Llama 3.2 3B',
        source: 'ollama' as const,
        provider: 'Ollama',
        isFree: true
      },
      {
        id: 'llama3.2:1b',
        name: 'Llama 3.2 1B',
        source: 'ollama' as const,
        provider: 'Ollama',
        isFree: true
      },
      {
        id: 'qwen2.5:7b',
        name: 'Qwen 2.5 7B',
        source: 'ollama' as const,
        provider: 'Ollama',
        isFree: true
      }
    );

    allModels.value = testModels;
  }

  if (selectedModel.value) {
    currentDisplayModel.value = selectedModel.value;
    originalModel.value = selectedModel.value; // Store the original model
  }
};

const stopHoverScrolling = () => {
  isHovering.value = false;

  // Don't auto-close dialog - only reset display if no dialog is showing
  if (!showConfirmDialog.value) {
    // Reset to original selected model
    if (selectedModel.value) {
      currentDisplayModel.value = selectedModel.value;
    }
    hoveredModel.value = null;
    originalModel.value = null;
  }
};


const handleScrollOnBadge = (event: WheelEvent) => {
  if (!allModels.value.length || !isHovering.value) return;

  const currentIndex = allModels.value.findIndex(
    model => model.id === currentDisplayModel.value?.id
  );

  let nextIndex;
  if (event.deltaY > 0) {
    // Scroll down - next model
    nextIndex = (currentIndex + 1) % allModels.value.length;
  } else {
    // Scroll up - previous model
    nextIndex = currentIndex <= 0 ? allModels.value.length - 1 : currentIndex - 1;
  }

  const nextModel = allModels.value[nextIndex];
  currentDisplayModel.value = nextModel;
  hoveredModel.value = nextModel;

  // Check if we've scrolled away from the original model
  if (nextModel?.id !== originalModel.value?.id) {
    // Show dialog immediately when scrolling away from original
    showConfirmDialog.value = true;
  } else {
    // Hide dialog when scrolling back to original
    showConfirmDialog.value = false;
  }
};

const confirmModelSwitch = () => {
  if (hoveredModel.value) {
    handleModelSelected(hoveredModel.value);
  }
  showConfirmDialog.value = false;
  isHovering.value = false;
};

const cancelModelSwitch = () => {
  showConfirmDialog.value = false;
  // Reset to original selected model
  if (selectedModel.value) {
    currentDisplayModel.value = selectedModel.value;
  }
  hoveredModel.value = null;
  originalModel.value = null;
};

const handleGlobalHotkey = (e: KeyboardEvent) => {
  // Do not fire if focus is on an input/textarea or contentEditable element:
  const activeTag = document.activeElement?.tagName.toLowerCase();
  if (
    activeTag === 'input' ||
    activeTag === 'textarea' ||
    document.activeElement?.hasAttribute('contenteditable')
  ) {
    return;
  }

  // Handle Esc key to close model confirmation dialog
  if (e.key === 'Escape' && showConfirmDialog.value) {
    e.preventDefault();
    cancelModelSwitch();
    return;
  }

  // Use lowercase "m" (you can change this key if you wish)
  if (e.key.toLowerCase() === 'm') {
    e.preventDefault();
    appStore.openAgentConfigurator();
  }
};

// Close overflow menus when clicking outside
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as Element;
  if (showOverflowMenu.value && !target.closest('.overflow-menu')) {
    showOverflowMenu.value = false;
  }
  if (showRightOverflowMenu.value && !target.closest('.right-overflow-menu')) {
    showRightOverflowMenu.value = false;
  }
};

const handleBackToWorkspaces = () => {
  if (canvasRef.value) {
    canvasRef.value.returnToOverview()
  }
};

const showOverviewTitle = computed(() => {
  return isInOverview.value;
});

const handleNodeSelected = (node: Node) => {
  selectedNode.value = node;
};

const handleWorkspaceLoaded = () => {
  canvasRef.value?.autoFitNodes();
};


const workspaceMenuRef = ref<any>(null);

const handleNewWorkspace = async () => {
  // Start with an animation that signals creation
  const createAnimation = document.createElement('div');
  createAnimation.className = 'workspace-creation-animation';
  document.body.appendChild(createAnimation);

  // Animate outward
  setTimeout(() => {
    createAnimation.classList.add('expand');

    // Clear any existing snapped nodes
    if (canvasStore.snappedNodeId) {
      canvasStore.popSnappedNode();
    }

    setTimeout(async () => {
      document.body.removeChild(createAnimation);

      // Clear the current workspace with a fade transition
      await canvasStore.clearCurrentWorkspace();

      // Create new workspace with a nice entrance animation
      const newWorkspaceId = await canvasStore.createNewWorkspace();

      if (newWorkspaceId) {
        // Refresh the workspaces list
        await chatStore.loadChats();
        await canvasStore.loadChatState(newWorkspaceId);

        // Get the ID of the newly created root node
        const rootNodeId = canvasStore.nodes[0]?.id;
        if (rootNodeId) {
          // Center and snap to the root node with custom easing
          nextTick(() => {
            if (canvasRef.value) {
              canvasRef.value.centerAndSnapNode(rootNodeId, true);
            }
          });
        }
      }
    }, 400);
  }, 10);
};

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (!files || files.length === 0) {
    return;
  }

  const file = files[0];
  if (!file.name || !file.name.endsWith('.json')) {
    alert('Please select a JSON file.');
    return;
  }

  // Clear existing state before import
  await canvasStore.clearCurrentWorkspace();

  // Ensure we're in overview mode BEFORE starting the import
  if (canvasRef.value) {
    await canvasRef.value.returnToOverview();
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('http://127.0.0.1:5050/api/process', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process file');
    }

    const data = await response.json();
    if (data.messages && Array.isArray(data.messages)) {
      // Group messages by chat_id
      const chatGroups = data.messages.reduce((groups, message) => {
        const chatId = message.chat_id;
        if (!groups[chatId]) {
          groups[chatId] = [];
        }
        groups[chatId].push(message);
        return groups;
      }, {});

      // Process each chat group sequentially with visual feedback
      let processed = 0;
      const total = Object.keys(chatGroups).length;

      for (const [chatId, messages] of Object.entries(chatGroups)) {
        processed++;

        // Create workspace and immediately show it
        const firstMessage = messages[0];
        const workspace = {
          id: chatId,
          title: firstMessage.chat_name,
          nodeCount: messages.length,
          lastUpdated: new Date().toISOString(),
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 200,
          status: 'active',
          tags: [],
          color: '#ffffff',
          isFavorite: false
        };

        // Add workspace and wait for UI update
        await canvasStore.addWorkspaceToOverview(workspace);

        // Force a UI update
        await nextTick();

        // Process messages
        await canvasStore.importWorkspaceMessages(messages);

        // Let the UI catch up
        await nextTick();

        // Update auto-fit for smooth visual feedback
        if (canvasRef.value) {
          canvasRef.value.autoFitNodes();
        }
      }

      // Final refresh of chat list
      await chatStore.loadChats();

    } else {
      console.error("Unexpected response format:", data);
      alert('Failed to process the chat data. Check the console for details.');
    }

  } catch (error) {
    console.error('Error uploading file:', error);
    alert('Error uploading file: ' + (error instanceof Error ? error.message : String(error)));
  } finally {
    target.value = ''; // Reset the file input
  }
};

const handleNavigateToCodeBubble = async (data: {
  chatId: string;
  nodeId: string;
  codeIndex: number;
}) => {
  console.log('Navigating to code bubble:', data);

  try {
    // 1. First, check if we're already in this workspace
    const chatStore = useChatStore();
    const canvasStore = useCanvasStore();
    const inSameWorkspace = chatStore.currentChatId === data.chatId;

    // If we need to change workspaces, go back to overview first
    if (!inSameWorkspace && canvasRef.value) {
      console.log('Returning to overview view...');

      // Exit current workspace if one is open
      if (!canvasRef.value.isWorkspaceOverview) {
        await canvasRef.value.returnToOverview();
        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Open the workspace containing the code bubble
      console.log('Opening workspace:', data.chatId);
      await canvasRef.value.handleWorkspaceSelect(data.chatId);
      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. Snap to the branch node
    if (canvasRef.value) {
      console.log('Snapping to node:', data.nodeId);
      canvasRef.value.centerAndSnapNode(data.nodeId);

      // Wait for snap animation to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // 4. Emit event to scroll to the message with the code bubble
      emitter.emit('scroll-to-code-bubble', {
        nodeId: data.nodeId,
        codeIndex: data.codeIndex
      });
    }
  } catch (error) {
    console.error('Error navigating to code bubble:', error);
  }
};

// Note: Drag and drop handlers removed - archive uploads now handled by ArchiveUpload component

// Theme update function
const updateThemeFromDOM = () => {
  const newTheme = document.documentElement.getAttribute('data-theme') || 'light';
  if (newTheme !== currentTheme.value) {
    currentTheme.value = newTheme;
    console.log('Theme changed to', currentTheme.value);
  }
};

// Watchers and lifecycle hooks
watch(() => canvasRef.value?.workspaces, (newWorkspaces) => {
  // This will trigger a recompute of showLogo when workspaces change
}, { deep: true });

watch(() => canvasStore.activeNode, (newNodeId) => {
  if (newNodeId) {
    currentNodeId.value = newNodeId;
  }
});

// Update currentDisplayModel when selectedModel changes
watch(() => selectedModel.value, (newModel) => {
  currentDisplayModel.value = newModel;
});

// Also watch the model store's selectedModel
watch(() => modelStore.selectedModel, (newModel) => {
  if (newModel && !selectedModel.value) {
    selectedModel.value = newModel;
    currentDisplayModel.value = newModel;
  }
});

onMounted(async () => {
  canvasStore.initFromLocalStorage(); // Keep this for other settings
  await chatStore.loadChats();
  emitter.on('navigate-to-code-bubble', handleNavigateToCodeBubble);

  // Setup theme observer
  themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'data-theme') {
        updateThemeFromDOM();
      }
    });
  });

  // Start observing theme changes on document element
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  // Initial theme check
  updateThemeFromDOM();

  document.addEventListener('keydown', handleGlobalHotkey);
  document.addEventListener('click', handleClickOutside);

  const updateWindowSize = () => {
    windowSize.value = {
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth
    };
  };

  updateWindowSize();
  window.addEventListener('resize', updateWindowSize);

  // Note: Drag-and-drop for archive files is now handled by the archive management system
});

onBeforeUnmount(() => {
  if (themeObserver) {
    themeObserver.disconnect();
  }

  emitter.off('navigate-to-code-bubble', handleNavigateToCodeBubble);
  window.removeEventListener('resize', updateWindowSize);
  document.removeEventListener('keydown', handleGlobalHotkey);
  document.removeEventListener('click', handleClickOutside);

  // Note: Drag-and-drop cleanup no longer needed
});
</script>

<style scoped>
/* App-wide base styles */
.app-container {
  transition: background-color 0.3s ease, color 0.3s ease;
  overflow: hidden;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.app-container.theme-acid {
  background: #1b141d;
}

/* Canvas wrapper positioning to avoid header overlap */
.canvas-wrapper {
  padding-top: 3rem;
  height: 100vh;
  overflow: hidden;
}

.top-controls.ultra-compact~.canvas-wrapper {
  padding-top: 2.5rem;
}

.top-controls.compact~.canvas-wrapper {
  padding-top: 2.75rem;
}

/* Side panel theming */
.side-panel {
  isolation: isolate;
  transition: transform 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease;
}

.side-panel-inner {
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
}

/* Top controls styling */
.top-controls {
  transition: all 0.3s ease;
  min-height: 3rem;
  overflow: visible;
}

.top-controls.ultra-compact {
  min-height: 2.5rem;
}

.top-controls.compact {
  min-height: 2.75rem;
}

.top-controls .left-controls,
.top-controls .right-controls {
  flex-shrink: 0;
  min-width: 0;
}

.top-controls .center-controls {
  min-width: 0;
}

/* Responsive button adjustments */
.top-controls.ultra-compact .btn {
  min-height: 2rem;
  padding: 0.25rem 0.5rem;
}

.top-controls.compact .btn {
  min-height: 2.25rem;
  padding: 0.375rem 0.75rem;
}

/* Ultra-compact centered layout */
.top-controls.ultra-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

/* Dropdown menu z-index fixes */
.overflow-menu,
.right-overflow-menu {
  position: relative;
  z-index: 100;
}

/* Ensure dropdowns appear above all other content */
.overflow-menu .absolute,
.right-overflow-menu .absolute {
  z-index: 9999 !important;
  position: absolute;
}

/* Button and control styling */
.theme-btn,
.canvas-control-btn,
.back-to-workspaces-btn,
.toggle-panel-btn {
  transition: all 0.2s ease;
}

.theme-btn:hover,
.canvas-control-btn:hover,
.back-to-workspaces-btn:hover {
  transform: translateY(-1px);
}

.zoom-indicator {
  border-radius: 9999px;
  backdrop-filter: blur(5px);
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

/* Overview title styling */
.overview-title {
  backdrop-filter: blur(5px);
  transition: all 0.3s ease;
}

/* Import progress styling */
.progress-overlay {
  transition: background-color 0.3s ease, backdrop-filter 0.3s ease;
}

.progress-card {
  transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.progress[value] {
  appearance: none;
  background-color: var(--bg-color, rgba(200, 200, 200, 0.3));
  border-radius: 0.375rem;
  overflow: hidden;
}

.progress[value]::-webkit-progress-bar {
  background-color: var(--bg-color, rgba(200, 200, 200, 0.3));
  border-radius: 0.375rem;
}

.progress[value]::-webkit-progress-value {
  background-color: var(--value-color, #3b82f6);
  transition: width 0.3s ease;
}

.progress[value]::-moz-progress-bar {
  background-color: var(--value-color, #3b82f6);
  transition: width 0.3s ease;
}

/* Workspace creation animation */
.workspace-creation-animation {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 50px;
  height: 50px;
  margin-top: -25px;
  margin-left: -25px;
  background: radial-gradient(circle, var(--p-light, rgba(var(--p), 0.7)) 0%, rgba(var(--p), 0) 70%);
  border-radius: 50%;
  z-index: 9999;
  opacity: 0.8;
  transform: scale(0);
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.workspace-creation-animation.expand {
  transform: scale(40);
  opacity: 0;
}

/* Theme-specific styles */
.theme-cyberpunk .workspace-creation-animation {
  box-shadow: 0 0 30px var(--p);
  background: radial-gradient(circle, var(--p) 0%, rgba(0, 0, 0, 0) 70%);
}

.theme-synthwave .workspace-creation-animation {
  background: radial-gradient(circle, var(--s) 0%, rgba(0, 0, 0, 0) 70%);
  box-shadow: 0 0 30px var(--s);
}

.theme-aqua .side-panel-inner {
  background: linear-gradient(135deg, rgba(0, 30, 60, 0.9), rgba(0, 60, 90, 0.7));
  box-shadow: inset 0px 1px 20px 2px rgba(9, 236, 243, 0.2);
}

.theme-valentine .side-panel-inner,
.theme-cupcake .side-panel-inner {
  border-top-right-radius: 16px;
  border-bottom-right-radius: 16px;
  box-shadow: inset 0px 1px 15px 2px rgba(255, 192, 203, 0.2);
}

.theme-retro .overview-title {
  border-style: double;
  border-width: 3px;
}

/* Fix cyberpunk theme background - remove yellow tint */
[data-theme="cyberpunk"] {
  --b1: #1a1a2e;
  /* Dark blue-purple instead of yellow */
  --b2: #16213e;
  --b3: #0f1419;
  --bc: #e94560;
  /* Adjust base content color */
}

/* Override canvas background for cyberpunk theme */
[data-theme="cyberpunk"] .bg-background {
  background-color: #1a1a2e !important;
}
</style>