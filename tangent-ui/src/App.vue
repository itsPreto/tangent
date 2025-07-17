<template>
  <div class="min-h-screen bg-background app-container" :class="['theme-' + currentTheme]">

    <!-- Dual Sidebar Mode -->
    <template v-if="appStore.isDualSidebarMode">
      <!-- Left Navigation Sidebar -->
      <LeftNavigationSidebar 
        :is-expanded="appStore.isLeftSidebarExpanded"
        @toggle-expanded="appStore.toggleLeftSidebar"
        @nav-item-clicked="handleLeftNavItemClick" />
      
      <!-- Right Feature Sidebar -->
      <RightFeatureSidebar 
        @feature-clicked="handleRightFeatureClick" />
      
      <!-- Feature Content Panel -->
      <FeatureContentPanel 
        :is-open="appStore.isRightContentPanelOpen"
        :active-feature="appStore.activeRightFeature"
        :node-id="currentNodeId"
        @close="appStore.closeRightFeature"
        @panel-opened="handleFeaturePanelOpened"
        @panel-closed="handleFeaturePanelClosed"
        @document-selected="handleDocumentSelected"
        @document-dragged="handleDocumentDragged" />
        
      <!-- Canvas Container Wrapper -->
      <div class="transition-all duration-300 canvas-wrapper" :class="'theme-' + currentTheme"
        :style="getCanvasWrapperStyle">
        <InfiniteCanvas ref="canvasRef" :selected-model="selectedModel?.id || ''" :open-router-api-key="openRouterApiKey"
          :model-type="modelType" :side-panel-open="effectiveSidePanelOpen"
          :right-panel-open="effectiveRightPanelOpen" :right-sidebar-expanded="appStore.isRightSidebarExpanded" :gesture-mode="gestureMode" v-model:zoom="canvasZoom"
          v-model:is-height-locked="isHeightLocked"
          :viewport-height="windowSize.innerHeight" :viewport-width="windowSize.innerWidth"
          @node-selected="handleNodeSelected" @update-filter-state="handleFilterStateUpdate" 
          @update-graph-stats="handleGraphStatsUpdate" @update-3d-support="handle3DSupportUpdate"
          @update-fullscreen="handleFullscreenUpdate" />
      </div>
    </template>

    <!-- Legacy Mode (keeping for backward compatibility) -->
    <template v-else>
      <!-- Side Panel with smooth slide animation -->
    <Transition 
      name="slide-panel-left"
      appear
      @before-enter="onBeforeEnter"
      @enter="onEnter" 
      @leave="onLeave">
      <SidePanel
        v-if="appStore.isSidePanelOpen"
        class="fixed left-0 top-0 h-full w-[40vw] bg-background shadow-xl z-40 side-panel overflow-hidden"
        :class="'theme-' + currentTheme"
        style="border-color: #334155; border-width: 1px; height: 100vh; border-left: none;"
        :node-id="currentNodeId" @panel-opened="appStore.openSidePanel" @panel-closed="appStore.closeSidePanel" />
    </Transition>
    </template>

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
                <button @click="appStore.toggleSidePanel(); showOverflowMenu = false"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-base-200 rounded">
                  <Terminal v-if="!appStore.isSidePanelOpen" class="w-4 h-4" />
                  <X v-else class="w-4 h-4" />
                  {{ appStore.isSidePanelOpen ? 'Close IDE' : 'Open IDE' }}
                </button>
                <button @click="handleNewWorkspace; showOverflowMenu = false"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-base-200 rounded">
                  <Plus class="w-4 h-4" />
                  New Workspace
                </button>
                <button @click="handleShowAllWorkspaces; showOverflowMenu = false"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-base-200 rounded">
                  <FolderOpen class="w-4 h-4" />
                  All Workspaces
                </button>
                <button @click="appStore.toggleRAGPanel(); showOverflowMenu = false"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-base-200 rounded">
                  <FileText class="w-4 h-4" />
                  Documents
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
                <button @click="appStore.toggleAgentConfigurator(); showRightOverflowMenu = false"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-base-200 rounded">
                  <Settings v-if="!appStore.isAgentConfiguratorOpen" class="w-4 h-4" />
                  <X v-else class="w-4 h-4" />
                  {{ appStore.isAgentConfiguratorOpen ? 'Close Settings' : 'Open Settings' }}
                  <span v-if="selectedModel && !appStore.isAgentConfiguratorOpen" class="ml-auto text-xs opacity-70">{{ selectedModel.name.substring(0, 10)
                  }}...</span>
                </button>
                <WorkspaceMenu class="w-full" ref="workspaceMenuRef" @workspace-loaded="handleWorkspaceLoaded" />
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Normal and compact layouts -->
      <template v-else>
        <div class="w-full flex items-center justify-between">
          <!-- Left Controls Section -->
          <div class="flex items-center gap-2 left-controls">

            <!-- Primary Actions -->
            <div class="flex items-center gap-1" :class="{ 'gap-1': isCompactMode, 'gap-2': !isCompactMode }">
              <!-- IDE Panel Toggle (only in legacy mode) -->
              <button v-if="!appStore.isDualSidebarMode" @click="appStore.toggleSidePanel()"
                class="btn btn-sm btn-ghost transition-all duration-300 shadow-md theme-btn flex items-center justify-center"
                :class="[compactButtonClasses, { 'btn-primary': appStore.isSidePanelOpen }]" 
                :style="buttonStyles" 
                :title="appStore.isSidePanelOpen ? 'Close IDE Panel' : 'Open IDE Panel'">
                <Terminal v-if="!appStore.isSidePanelOpen" :class="iconSizeClasses" />
                <X v-else :class="iconSizeClasses" />
              </button>
              
              <button @click="handleNewWorkspace"
                class="btn btn-sm btn-ghost transition-all duration-300 shadow-md theme-btn flex items-center justify-center"
                :class="compactButtonClasses" :style="buttonStyles" :title="'New Workspace'">
                <Plus :class="iconSizeClasses" />
                <span v-if="!isCompactMode" class="hidden sm:inline text-xs">New</span>
              </button>
              
              <button @click="handleShowAllWorkspaces"
                class="btn btn-sm btn-ghost transition-all duration-300 shadow-md theme-btn flex items-center justify-center"
                :class="compactButtonClasses" :style="buttonStyles" :title="'All Workspaces'">
                <FolderOpen :class="iconSizeClasses" />
                <span v-if="!isCompactMode" class="hidden sm:inline text-xs">All</span>
              </button>
              
              <button @click="appStore.toggleRAGPanel()"
                class="btn btn-sm btn-ghost transition-all duration-300 shadow-md theme-btn flex items-center justify-center"
                :class="[compactButtonClasses, { 'btn-primary': appStore.isRAGPanelOpen }]" :style="buttonStyles" :title="'Toggle Documents Panel'">
                <FileText :class="iconSizeClasses" />
                <span v-if="!isCompactMode" class="hidden sm:inline text-xs">Docs</span>
              </button>

              <div class="flex-shrink min-w-0 max-w-[150px] sm:max-w-[200px]">
                <WorkspaceMenu ref="workspaceMenuRef" @workspace-loaded="handleWorkspaceLoaded" />
              </div>

            </div>
          </div>

          <!-- Right Controls Section -->
          <div class="flex items-center gap-2 right-controls">
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
            <!-- Agent Configurator Panel Toggle (only in legacy mode) -->
            <button v-if="!appStore.isDualSidebarMode" @click="appStore.toggleAgentConfigurator()"
              class="btn btn-sm btn-ghost transition-all duration-300 shadow-md theme-btn flex items-center justify-center"
              :class="[compactButtonClasses, { 'btn-primary': appStore.isAgentConfiguratorOpen }]" 
              :style="buttonStyles" 
              :title="appStore.isAgentConfiguratorOpen ? 'Close Settings Panel' : 'Open Settings Panel'">
              <Settings v-if="!appStore.isAgentConfiguratorOpen" :class="iconSizeClasses" />
              <X v-else :class="iconSizeClasses" />
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Workspace Controls Dock - Only visible in overview mode and not during onboarding -->
    <WorkspaceControlsDock 
      v-if="isInOverview && !isOnboarding"
      :current-view-mode="workspaceViewMode"
      :sort-by="workspaceSortBy"
      :card-size="workspaceCardSize"
      :has-active-filters="workspaceHasActiveFilters"
      :active-filter-count="workspaceActiveFilterCount"
      :is-side-panel-open="appStore.isSidePanelOpen"
      :is-agent-configurator-open="appStore.isAgentConfiguratorOpen"
      :graph-stats="workspaceGraphStats"
      :graph-layout="workspaceGraphLayout"
      :show-graph-controls="workspaceShowGraphControls"
      :is3-d-supported="workspaceIs3DSupported"
      :is-fullscreen="workspaceIsFullscreen"
      @update:view-mode="updateWorkspaceViewMode"
      @update:sort-by="updateWorkspaceSortBy"
      @update:card-size="updateWorkspaceCardSize"
      @toggle-filters="toggleWorkspaceFilters"
      @update:graph-layout="updateWorkspaceGraphLayout"
      @toggle-graph-controls="toggleWorkspaceGraphControls"
      @reset-graph="resetWorkspaceGraph"
      @toggle-fullscreen="toggleWorkspaceFullscreen"
    />

    <!-- Bottom Controls Container -->
    <!-- <div class="fixed bottom-0 flex justify-start pointer-events-none" 
         style="transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);"
         :style="{
           zIndex: 50,
           left: (!isInOverview) ? effectiveLeftMargin : '1rem',
           right: (!isInOverview && effectiveRightPanelOpen) ? effectiveRightMargin : 'auto',
           marginBottom: appStore.isRAGPanelOpen ? '20vh' : '0'
         }">
      
    </div> -->

    <!-- Canvas Controls -->
    <div v-if="!isInOverview && !isOnWelcomeScreen" class="fixed bottom-4 z-50 flex items-center gap-2"
      style="transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);"
      :style="{ 
        right: `calc(${effectiveRightMargin} + 1rem)`,
        marginBottom: appStore.isRAGPanelOpen ? '20vh' : '0'
      }">
      <button class="h-8 px-3 canvas-control-btn hover:bg-base-300/90 flex items-center gap-2"
        :style="controlButtonStyle" @click="gestureMode = gestureMode === 'zoom' ? 'scroll' : 'zoom'"
        :title="gestureMode === 'zoom' ? '2-finger: Zoom, CMD+2-finger: Pan' : '2-finger: Pan, CMD+2-finger: Zoom'">
        <component :is="gestureMode === 'zoom' ? ZoomIn : Move" class="w-4 h-4" />
        <span class="text-sm">{{ gestureMode === 'zoom' ? 'Zoom Mode' : 'Pan Mode' }}</span>
      </button>
    </div>


    <!-- Workspace Overview Title -->
    <div v-if="!isInOverview" class="fixed bottom-4 z-50 w-full text-center"
      style="transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);"
      :style="{ 
        left: effectiveLeftMargin, 
        right: effectiveRightMargin,
        marginBottom: appStore.isRAGPanelOpen ? '4rem' : '0'
      }">
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
    <Transition 
      name="slide-panel-right"
      appear
      @before-enter="onBeforeEnterRight"
      @enter="onEnterRight" 
      @leave="onLeaveRight">
      <AgentConfiguratorSidePanel
        v-if="appStore.isAgentConfiguratorOpen"
        class="fixed right-0 top-0 h-full w-[40vw] bg-background z-40 agent-configurator-panel overflow-hidden"
        :class="'theme-' + currentTheme"
        :style="{ 
          marginLeft: '2rem',  
          height: '100vh', 
          borderRight: 'none'
        }"
        @close="appStore.closeAgentConfigurator" @model-selected="handleModelSelected" @api-key-saved="handleApiKeySaved" @open-workspace="handleOpenWorkspace"
        :current-model="selectedModel" />
    </Transition>


    <!-- Progress Indicator -->
    <div v-if="isImporting" class="fixed inset-0 z-50 flex items-center justify-center progress-overlay"
      :style="progressOverlayStyle">
      <div class="p-4 bg-base-100 rounded-lg shadow-lg text-center progress-card" :style="progressCardStyle">
        <p class="text-lg font-semibold mb-2">Importing Workspaces...</p>
        <progress class="progress w-56" :value="importProgress" max="100" :style="progressBarStyle"></progress>
        <p class="mt-2 text-sm">{{ importStatus }}</p>
      </div>
    </div>

    <!-- Sliding Footer -->
    <SlidingFooter 
      :is-open="appStore.isSlidingFooterOpen"
      @close="appStore.closeSlidingFooter"
      @toggle="appStore.toggleSlidingFooter" />

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, provide, watch, nextTick } from 'vue';
import { Plus, ArrowLeft, Settings, ChevronRight, ZoomIn, Move, Search, HelpCircle, UploadCloud, Eye, Menu, MoreVertical, FileText, Terminal, X, FolderOpen } from 'lucide-vue-next';
import 'highlight.js/styles/github-dark.css';
import InfiniteCanvas from './components/canvas/InfiniteCanvas.vue';
import ThemeToggle from './components/theme/ThemeToggle.vue';
import WorkspaceMenu from './components/workspace/WorkspaceMenu.vue';
import SidePanel from './components/sidebar/SandPackSidePanel.vue';
import LeftNavigationSidebar from './components/sidebar/LeftNavigationSidebar.vue';
import RightFeatureSidebar from './components/sidebar/RightFeatureSidebar.vue';
import FeatureContentPanel from './components/sidebar/FeatureContentPanel.vue';
import SlidingFooter from './components/ui/SlidingFooter.vue';
import AgentConfiguratorSidePanel from './components/settings/AgentConfiguratorSidePanel.vue';
import Badge from './components/ui/Badge.vue';
import WorkspaceControlsDock from './components/workspace/WorkspaceControlsDock.vue';
import { useCanvasStore } from '@/stores/canvasStore';
import { useModelStore } from '@/stores/modelStore';
import { useChatStore } from '@/stores/chatStore';
import { useAppStore } from '@/stores/appStore';
import { useThemeStore } from '@/stores/themeStore';
import { useAgentStore } from '@/stores/agentStore';
import emitter from '@/utils/eventBus'
import type { Node } from '@/types/message';
import type { ModelInfo } from '@/types/model';

const gestureMode = ref<'scroll' | 'zoom'>('scroll');
const anthropicApiKey = ref(localStorage.getItem('anthropicApiKey') || '');

// Canvas and workspace state
const canvasRef = ref<InstanceType<typeof InfiniteCanvas> | null>(null);

// Computed props for InfiniteCanvas that adapt to the current UI mode
const effectiveSidePanelOpen = computed(() => {
  if (appStore.isDualSidebarMode) {
    // In dual sidebar mode, consider left sidebar expanded OR right content panel open as "side panel open"
    return appStore.isLeftSidebarExpanded || appStore.isRightContentPanelOpen;
  } else {
    // Legacy mode
    return appStore.isSidePanelOpen;
  }
});

const effectiveRightPanelOpen = computed(() => {
  if (appStore.isDualSidebarMode) {
    // In dual sidebar mode, only the content panel affects main layout, not sidebar hover
    return appStore.isRightContentPanelOpen;
  } else {
    // Legacy mode
    return appStore.isAgentConfiguratorOpen;
  }
});

// Computed positioning for UI elements that adapt to the current mode
const effectiveLeftMargin = computed(() => {
  if (appStore.isDualSidebarMode) {
    return appStore.isLeftSidebarExpanded ? '260px' : '60px';
  } else {
    return appStore.isSidePanelOpen ? '40vw' : '0';
  }
});

const effectiveRightMargin = computed(() => {
  if (appStore.isDualSidebarMode) {
    // For UI elements, respond to both content panel and sidebar hover expansion
    if (appStore.isRightContentPanelOpen) {
      return 'calc(60px + 35vw)';
    } else if (appStore.isRightSidebarExpanded) {
      return '180px';
    } else {
      return '60px';
    }
  } else {
    return appStore.isAgentConfiguratorOpen ? '40vw' : '0';
  }
});

// Dual sidebar event handlers
const handleLeftNavItemClick = (item: any) => {
  console.log('Left nav item clicked:', item);
  // Navigation logic is handled in the LeftNavigationSidebar component
};

const handleRightFeatureClick = (feature: any) => {
  console.log('Right feature clicked:', feature);
  appStore.toggleRightFeature(feature.id);
};

const handleFeaturePanelOpened = () => {
  console.log('Feature panel opened');
};

const handleFeaturePanelClosed = () => {
  console.log('Feature panel closed');
};
provide('canvasRef', canvasRef);
const canvasZoom = ref(1);

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

// Onboarding state - hide UI components when no workspaces exist
const isOnboarding = computed(() => {
  return chatStore.chats.length === 0 && !chatStore.isLoading;
});

// Theme awareness - use reactive theme store
const currentTheme = computed(() => themeStore.currentTheme);

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

const isOnWelcomeScreen = computed(() => {
  return canvasRef.value?.isWelcomeScreen ?? true;
});

// Responsive breakpoints based on available space
const availableWidth = computed(() => {
  if (appStore.isDualSidebarMode) {
    // Dual sidebar mode calculations
    const leftSidebarExpanded = appStore.isLeftSidebarExpanded;
    const rightContentPanelOpen = appStore.isRightContentPanelOpen;
    
    // Calculate remaining space as percentage
    const leftWidth = leftSidebarExpanded ? 260 : 60; // px
    const rightWidth = 60; // right sidebar is always 60px
    const contentPanelWidth = rightContentPanelOpen ? 35 : 0; // vw
    
    // Rough calculation: convert to percentage of viewport
    const fixedWidthPx = leftWidth + rightWidth; // Fixed pixel widths
    const viewportWidthPx = window.innerWidth || 1200; // Fallback for SSR
    const fixedWidthPercent = (fixedWidthPx / viewportWidthPx) * 100;
    
    return Math.max(20, 100 - fixedWidthPercent - contentPanelWidth);
  } else {
    // Legacy mode calculations
    const leftPanelOpen = appStore.isSidePanelOpen;
    const rightPanelOpen = appStore.isAgentConfiguratorOpen;

    if (leftPanelOpen && rightPanelOpen) {
      return 20; // 20vw when both panels are open
    } else if (leftPanelOpen || rightPanelOpen) {
      return 60; // 60vw when one panel is open
    } else {
      return 100; // 100vw when no panels are open
    }
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

// Canvas wrapper style that supports both modes - copy the exact legacy approach
const getCanvasWrapperStyle = computed(() => {
  
  if (appStore.isDualSidebarMode) {
    // Dual sidebar mode - use SAME approach as legacy but with different sidebar states
    const leftSidebarOpen = appStore.isLeftSidebarExpanded;
    const rightSidebarExpanded = appStore.isRightSidebarExpanded;
    const rightContentPanelOpen = appStore.isRightContentPanelOpen;
    const ragPanelOpen = appStore.isRAGPanelOpen;

    let width = '100vw';
    let marginLeft = '0';
    let marginRight = '0';
    let height = '100vh';
    let marginBottom = '0';
    let paddingTop = '3rem';

    // No margins needed - snapped nodes position themselves absolutely
    // and calculate available space directly using sidebar dimensions
    
    // Width is automatic - no need to calculate it manually
    width = 'auto';

    // Account for RAG panel height
    if (ragPanelOpen) {
      height = '80vh';
      marginBottom = '20vh';
    }

    // Extra padding when workspace controls dock is visible
    if (isInOverview.value) {
      paddingTop = '7rem';
    }

    const result = {
      width,
      marginLeft,
      marginRight,
      height,
      marginBottom,
      paddingTop,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    };
    
    return result;
  } else {
    // Legacy mode
    return canvasWrapperStyle.value;
  }
});

const canvasWrapperStyle = computed(() => {
  const leftPanelOpen = appStore.isSidePanelOpen;
  const rightPanelOpen = appStore.isAgentConfiguratorOpen;
  const ragPanelOpen = appStore.isRAGPanelOpen;

  let width = '100vw';
  let marginLeft = '0';
  let marginRight = '0';
  let height = '100vh';
  let marginBottom = '0';
  let paddingTop = '3rem';

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

  // Account for RAG panel height
  if (ragPanelOpen) {
    height = '80vh'; // Reduce height by 20vh for RAG panel
    marginBottom = '20vh';
  }

  // Extra padding when workspace controls dock is visible
  if (isInOverview.value) {
    paddingTop = '7rem'; // Account for header (3rem) + dock height + spacing
  }

  return {
    width,
    marginLeft,
    marginRight,
    height,
    marginBottom,
    paddingTop
  };
});

const topControlsContainerStyle = computed(() => {
  if (appStore.isDualSidebarMode) {
    // Dual sidebar mode - account for both sidebars
    const leftSidebarOpen = appStore.isLeftSidebarExpanded;
    const rightSidebarExpanded = appStore.isRightSidebarExpanded;
    const rightContentPanelOpen = appStore.isRightContentPanelOpen;

    let leftMargin = leftSidebarOpen ? '260px' : '0px';
    let rightMargin = '60px'; // Right sidebar is always 60px
    
    // If content panel is open, add its width
    if (rightContentPanelOpen) {
      rightMargin = 'calc(60px + 35vw)';
    } else if (rightSidebarExpanded) {
      rightMargin = '180px';
    }

    return {
      left: leftMargin,
      right: rightMargin,
      width: 'auto',
      backdropFilter: 'blur(4px)',
      borderBottom: isDarkTheme.value ? '1px solid rgba(80, 80, 80, 0.3)' : '1px solid rgba(200, 200, 200, 0.3)',
      padding: isUltraCompact.value ? '0.5rem' : '1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: isCompactMode.value ? '0.5rem' : '1rem'
    };
  } else {
    // Legacy mode
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
  }
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

const handleOpenWorkspace = async (workspaceId: string) => {
  console.log('App: Opening workspace from agent configurator:', workspaceId);
  
  // Get reference to the canvas component
  const canvasRef = document.querySelector('.infinite-canvas');
  if (canvasRef && canvasRef.handleWorkspaceSelect) {
    await canvasRef.handleWorkspaceSelect(workspaceId);
  } else {
    // Fallback: emit the event that other components listen to
    emitter.emit('open-workspace', workspaceId);
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

// Workspace controls state
const workspaceViewMode = ref('grid');
const workspaceSortBy = ref('recent');
const workspaceCardSize = ref(240);
const workspaceHasActiveFilters = ref(false);
const workspaceActiveFilterCount = ref(0);

// Graph-specific controls
const workspaceGraphStats = ref({ topics: 0, workspaces: 0 });
const workspaceGraphLayout = ref('radial');
const workspaceShowGraphControls = ref(false);
const workspaceIs3DSupported = ref(false);
const workspaceIsFullscreen = ref(false);

// Workspace controls methods
const updateWorkspaceViewMode = (mode: string) => {
  workspaceViewMode.value = mode;
  // Pass to InfiniteCanvas/GridWorkspaceView
  if (canvasRef.value) {
    canvasRef.value.updateWorkspaceViewMode?.(mode);
  }
};

const updateWorkspaceSortBy = (sortBy: string) => {
  workspaceSortBy.value = sortBy;
  if (canvasRef.value) {
    canvasRef.value.updateWorkspaceSortBy?.(sortBy);
  }
};

const updateWorkspaceCardSize = (size: number) => {
  workspaceCardSize.value = size;
  if (canvasRef.value) {
    canvasRef.value.updateWorkspaceCardSize?.(size);
  }
};

const toggleWorkspaceFilters = () => {
  if (canvasRef.value) {
    canvasRef.value.toggleWorkspaceFilters?.();
  }
};

// Graph control methods
const updateWorkspaceGraphLayout = (layout: string) => {
  workspaceGraphLayout.value = layout;
  if (canvasRef.value) {
    canvasRef.value.updateGraphLayout?.(layout);
  }
};

const toggleWorkspaceGraphControls = () => {
  workspaceShowGraphControls.value = !workspaceShowGraphControls.value;
  if (canvasRef.value) {
    canvasRef.value.toggleGraphControls?.();
  }
};

const resetWorkspaceGraph = () => {
  if (canvasRef.value) {
    canvasRef.value.resetGraph?.();
  }
};

const toggleWorkspaceFullscreen = () => {
  if (canvasRef.value) {
    canvasRef.value.toggleFullscreen?.();
  }
};

const handleFilterStateUpdate = ({ hasFilters, count }: { hasFilters: boolean; count: number }) => {
  workspaceHasActiveFilters.value = hasFilters;
  workspaceActiveFilterCount.value = count;
};

const handleGraphStatsUpdate = ({ topics, workspaces }: { topics: number; workspaces: number }) => {
  workspaceGraphStats.value = { topics, workspaces };
};

const handle3DSupportUpdate = (supported: boolean) => {
  workspaceIs3DSupported.value = supported;
};

const handleFullscreenUpdate = (fullscreen: boolean) => {
  workspaceIsFullscreen.value = fullscreen;
};

const handleNodeSelected = (node: Node) => {
  selectedNode.value = node;
};

const handleWorkspaceLoaded = () => {
  canvasRef.value?.autoFitNodes();
};


const workspaceMenuRef = ref<any>(null);

const handleShowAllWorkspaces = () => {
  if (canvasRef.value) {
    canvasRef.value.showWorkspaceOverview();
  }
};

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

// RAG Document Panel event handlers
const handleDocumentSelected = (document: any) => {
  console.log('Document selected:', document);
  // TODO: Handle document selection for context
};

const handleDocumentDragged = (document: any, event: DragEvent) => {
  console.log('Document dragged:', document);
  // TODO: Handle document drag to create new nodes with context
};

// Transition debugging methods
const onBeforeEnter = (el: Element) => {
  console.log('Left panel before enter');
};

const onEnter = (el: Element) => {
  console.log('Left panel enter');
};

const onLeave = (el: Element) => {
  console.log('Left panel leave');
};

const onBeforeEnterRight = (el: Element) => {
  console.log('Right panel before enter');
};

const onEnterRight = (el: Element) => {
  console.log('Right panel enter');
};

const onLeaveRight = (el: Element) => {
  console.log('Right panel leave');
};

// Theme is now managed reactively by the theme store

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
  // Prevent layout flash by preloading critical state
  canvasStore.initFromLocalStorage(); // Keep this for other settings
  
  // Load chats with minimal flash by ensuring UI state is ready
  await chatStore.loadChats();
  
  // Use nextTick to ensure DOM is fully rendered before showing UI
  await nextTick();
  
  // Enable dual sidebar mode by default for testing
  // Comment this out to keep legacy mode as default
  appStore.enableDualSidebarMode();
  
  emitter.on('navigate-to-code-bubble', handleNavigateToCodeBubble);

  // Theme is now managed by the theme store, no need for DOM observation

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
  emitter.off('navigate-to-code-bubble', handleNavigateToCodeBubble);
  window.removeEventListener('resize', updateWindowSize);
  document.removeEventListener('keydown', handleGlobalHotkey);
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
/* App-wide base styles */
.app-container {
  transition: background-color 0.3s ease, color 0.3s ease;
  overflow: hidden;
  height: 100vh;
  /* Removed fixed positioning to allow margin-based content pushing */
}

.app-container.theme-acid {
  background: linear-gradient(147deg, #f702ff, #ff00ff, #ff02c687, #26ff0475);
}

/* Canvas wrapper positioning to avoid header overlap */
.canvas-wrapper {
  position: relative;
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

/* Override canvas background for all themes to match snapped backdrop when branch is snapped */

/* Light themes */
[data-theme="light"] .bg-background {
  background: rgba(248, 250, 252, 0.8);
}

[data-theme="cupcake"] .bg-background {
  background: rgba(253, 242, 248, 0.8);
}

[data-theme="bumblebee"] .bg-background {
  background: rgba(255, 251, 235, 0.8);
}

[data-theme="emerald"] .bg-background {
  background: rgba(236, 253, 245, 0.8);
}

[data-theme="corporate"] .bg-background {
  background: rgba(248, 250, 252, 0.8);
}

[data-theme="retro"] .bg-background {
  background: rgba(255, 248, 220, 0.8);
}

[data-theme="valentine"] .bg-background {
  background: rgba(255, 240, 245, 0.8);
}

[data-theme="garden"] .bg-background {
  background: rgba(240, 253, 244, 0.8);
}

[data-theme="lofi"] .bg-background {
  background: rgba(250, 248, 246, 0.8);
}

[data-theme="pastel"] .bg-background {
  background: rgba(252, 251, 255, 0.8);
}

[data-theme="fantasy"] .bg-background {
  background: rgba(255, 240, 255, 0.8);
}

[data-theme="wireframe"] .bg-background {
  background: rgba(255, 255, 255, 0.9);
}

[data-theme="cmyk"] .bg-background {
  background: rgba(245, 245, 255, 0.8);
}

[data-theme="autumn"] .bg-background {
  background: rgba(255, 248, 235, 0.8);
}

[data-theme="lemonade"] .bg-background {
  background: rgba(255, 255, 240, 0.8);
}

[data-theme="winter"] .bg-background {
  background: rgba(240, 248, 255, 0.8);
}

/* Dark themes */
[data-theme="dark"] .bg-background {
  background: rgba(15, 23, 42, 0.8);
}

[data-theme="synthwave"] .bg-background {
  background: rgba(20, 5, 40, 0.8);
}

[data-theme="cyberpunk"] .bg-background {
  background: rgba(20, 5, 30, 0.9);
}

[data-theme="halloween"] .bg-background {
  background: rgba(15, 10, 25, 0.95);
}

[data-theme="forest"] .bg-background {
  background: rgba(10, 25, 15, 0.8);
}

[data-theme="aqua"] .bg-background {
  background: rgba(5, 25, 35, 0.8);
}

[data-theme="black"] .bg-background {
  background: rgba(0, 0, 0, 0.8);
}

[data-theme="luxury"] .bg-background {
  background: rgba(15, 15, 15, 0.8);
}

[data-theme="dracula"] .bg-background {
  background: rgba(40, 42, 54, 0.8);
}

[data-theme="business"] .bg-background {
  background: rgba(25, 35, 45, 0.8);
}

[data-theme="acid"] .bg-background {
  background: rgba(20, 20, 20, 0.9);
}

[data-theme="night"] .bg-background {
  background: rgba(15, 20, 35, 0.8);
}

[data-theme="coffee"] .bg-background {
  background: rgba(25, 15, 10, 0.8);
}

/* Slide Panel Transitions for Memory Optimization */
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.3s ease-out;
}

.slide-panel-enter-from {
  transform: translateX(-100%);
}

.slide-panel-enter-to {
  transform: translateX(0);
}

.slide-panel-leave-from {
  transform: translateX(0);
}

.slide-panel-leave-to {
  transform: translateX(-100%);
}

/* Left Panel Specific Transitions */
.slide-panel-left-enter-active,
.slide-panel-left-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.slide-panel-left-enter-from {
  transform: translateX(-100%);
}

.slide-panel-left-enter-to {
  transform: translateX(0);
}

.slide-panel-left-leave-from {
  transform: translateX(0);
}

.slide-panel-left-leave-to {
  transform: translateX(-100%);
}

/* Global Theme Transition Rules for Smooth Theme Changes */
* {
  transition: background-color 0.3s ease, 
              color 0.3s ease, 
              border-color 0.3s ease,
              box-shadow 0.3s ease,
              text-shadow 0.3s ease !important;
}

/* Prevent layout flash during navigation */
.workspace-controls-dock,
.controls-bar {
  will-change: transform, opacity;
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
}

/* Optimize transitions for better performance */
.workspace-controls-dock {
  transform: translateZ(0); /* Create composite layer */
}

/* Smooth visibility transitions */
.top-controls {
  transition: opacity 0.15s ease-out, visibility 0.15s ease-out;
}

/* Prevent flash when switching between modes */
.canvas-wrapper {
  transition: margin 0.2s ease-out;
}

/* Preserve existing transitions for transform and specific properties */
*[style*="transition:"],
.transition-all,
.transition-transform,
.transition-colors,
.transition-opacity {
  /* Keep existing transitions intact */
}

/* Theme-aware elements get enhanced transitions */
.btn, .card, .navbar, .menu, .modal, .dropdown, .tooltip,
.bg-base-100, .bg-base-200, .bg-base-300,
.text-base-content, .text-primary, .text-secondary,
[class*="bg-"], [class*="text-"], [class*="border-"] {
  transition: background-color 0.3s ease, 
              color 0.3s ease, 
              border-color 0.3s ease,
              box-shadow 0.3s ease !important;
}

/* Side Panel Slide Transitions */
.slide-panel-left-enter-active,
.slide-panel-left-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  will-change: transform;
}

.slide-panel-left-enter-from {
  transform: translateX(-100%) !important;
}

.slide-panel-left-leave-to {
  transform: translateX(-100%) !important;
}

.slide-panel-right-enter-active,
.slide-panel-right-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  will-change: transform;
}

.slide-panel-right-enter-from {
  transform: translateX(100%) !important;
}

.slide-panel-right-leave-to {
  transform: translateX(100%) !important;
}

/* Dual Sidebar Layout */
.dual-sidebar-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.main-content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0; /* Allow shrinking */
  overflow: hidden;
}

.right-sidebar-container {
  display: flex;
  flex-shrink: 0;
}

/* Canvas wrapper for dual sidebar mode */
.dual-sidebar-layout .canvas-wrapper {
  flex: 1;
  height: 100vh;
  overflow: hidden;
}
</style>