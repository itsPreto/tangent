<template>
  <div class="min-h-screen bg-background app-container" :class="['theme-' + currentTheme]"
    @dragenter.prevent="handleDragEnter" @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave" @drop.prevent="handleDrop">
    
    <!-- Side Panel with theme-aware styling -->
    <div class="fixed left-0 top-0 h-full w-[40vw] bg-background shadow-xl transform transition-transform duration-300 z-40 side-panel"
      :class="[
        appStore.isSidePanelOpen ? 'translate-x-0' : '-translate-x-full',
        'theme-' + currentTheme
      ]">
      <div class="h-full pt-2 px-4 pb-4 bg-background side-panel-inner" :style="sidePanelStyle">
        <SidePanel :node-id="currentNodeId" @panel-opened="isSidePanelOpen = true"
          @panel-closed="isSidePanelOpen = false" />
      </div>
    </div>

    <!-- Toggle Button with theme enhancements -->
    <button @click="appStore.toggleSidePanel()"
      class="fixed left-0 top-1/2 -translate-y-1/2 z-50 p-2 border border-l-0 rounded-r-md transition-all duration-300 shadow-md toggle-panel-btn"
      :class="{ 'translate-x-[40vw]': appStore.isSidePanelOpen }"
      :style="toggleButtonStyle">
      <ChevronRight class="w-5 h-5 transition-transform" :class="{ 'rotate-180': appStore.isSidePanelOpen }" />
    </button>

    <!-- Top Controls Container with theme-aware styling -->
    <div class="fixed z-50 transition-all duration-300 flex justify-between top-controls" 
      :style="[topControlsStyle, { left: appStore.isSidePanelOpen ? '40vw' : '0', right: '0' }]">
      <div class="flex flex-col px-4 space-y-2 md:flex-row md:items-center md:space-y-0 md:space-x-4 mt-16 sm:mt-4">
        <div class="flex items-center space-x-4">
          <!-- Logo Container -->
          <TangentLogo />
          <ThemeToggle />
          <!-- New Workspace Button -->
          <button @click="handleNewWorkspace"
            class="btn btn-sm btn-ghost gap-2 transition-all duration-300 shadow-md theme-btn"
            :style="buttonStyles">
            <Plus class="w-4 h-4" />
          </button>

          <!-- File Input (Hidden) -->
          <input type="file" id="file-upload" ref="fileInput" accept=".json" @change="handleFileSelect"
            class="hidden" />
          <!-- Upload Button (Triggers File Input) -->
          <button @click="triggerFileSelect"
            class="btn btn-sm btn-ghost gap-2 transition-all duration-300 shadow-md theme-btn"
            :style="buttonStyles">
            <UploadCloud class="w-4 h-4" />
          </button>

        </div>
      </div>
      <div class="flex items-center gap-2 relative">
        <div class="relative flex items-center">
          <WorkspaceMenu ref="workspaceMenuRef" @workspace-loaded="handleWorkspaceLoaded" />
          <Badge v-if="selectedModel" @click.stop="openSettingsAndShowModels"
            class="h-6 model-badge p-2 cursor-pointer ml-2"
            :style="modelBadgeStyle">
            {{ selectedModel.name }}
          </Badge>
          <button @click="openSettingsAndShowModels" class="btn btn-sm btn-ghost theme-btn" :style="buttonStyles">
            <Settings class="w-4 h-4" />
          </button>
          <button @click="showHelp = true" class="btn btn-ghost btn-sm theme-btn" :style="buttonStyles">
            <HelpCircle class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom Controls Container with theme enhancements -->
    <div v-if="!isInOverview" class="fixed bottom-0 z-50 transition-all duration-300 flex justify-start"
      :style="{ left: appStore.isSidePanelOpen ? '40vw' : '0', right: '0' }">
      <div class="flex flex-col px-4 space-y-2 md:flex-row md:items-center md:space-y-0 md:space-x-4 mb-4">
        <button @click="handleBackToWorkspaces"
          class="btn btn-sm back-to-workspaces-btn hover:bg-base-300/90"
          :style="controlButtonStyle">
          <ArrowLeft class="w-4 h-4" />
          <span class="text-sm">Back to Workspaces</span>
        </button>
      </div>
    </div>

    <!-- Canvas Controls with theme-specific styling -->
    <div v-if="!isInOverview" class="fixed bottom-4 right-24 z-50 flex items-center gap-2">
      <button class="h-8 px-3 canvas-control-btn hover:bg-base-300/90"
        :style="controlButtonStyle"
        @click="toggleAutoZoom">
        <span class="text-sm">{{ canvasAutoZoom ? 'Auto-fit On' : 'Auto-fit Off' }}</span>
      </button>
      <button
        class="h-8 px-3 canvas-control-btn hover:bg-base-300/90 flex items-center gap-2"
        :style="controlButtonStyle"
        @click="gestureMode = gestureMode === 'zoom' ? 'scroll' : 'zoom'">
        <component :is="gestureMode === 'zoom' ? ZoomIn : Move" class="w-4 h-4" />
        <span class="text-sm">Two-finger {{ gestureMode === 'zoom' ? 'Zoom' : 'Pan' }}</span>
      </button>
    </div>
    <div v-if="!isInOverview"
      class="fixed bottom-4 right-4 z-50 px-3 h-8 text-sm zoom-indicator flex items-center"
      :style="controlButtonStyle">
      {{ Math.round(canvasZoom * 100) }}%
    </div>

    <!-- Canvas Container Wrapper with theme transitions -->
    <div class="transition-all duration-300 canvas-wrapper"
      :class="'theme-' + currentTheme"
      :style="{ width: appStore.isSidePanelOpen ? '60vw' : '100vw', marginLeft: appStore.isSidePanelOpen ? '40vw' : '0' }">
      <!-- Use appStore -->
      <InfiniteCanvas ref="canvasRef" :selected-model="selectedModel?.id || ''" :open-router-api-key="openRouterApiKey"
        :model-type="modelType" :side-panel-open="appStore.isSidePanelOpen" :gesture-mode="gestureMode"
        v-model:zoom="canvasZoom" v-model:auto-zoom-enabled="canvasAutoZoom" v-model:is-height-locked="isHeightLocked"
        :viewport-height="windowSize.innerHeight" :viewport-width="windowSize.innerWidth"
        @node-selected="handleNodeSelected" />
    </div>

    <!-- Workspace Overview Title with theme effects -->
    <div v-if="!isInOverview" class="fixed bottom-4 z-50 w-full text-center transition-all duration-300"
      :style="{ left: appStore.isSidePanelOpen ? '40vw' : '0', right: '0' }">
      <!-- Use appStore -->
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

    <!-- New Settings Modal Component -->
    <SettingsModal 
      :is-open="settingsModalOpen" 
      :initial-tab="activeSettingsTab"
      :current-model="selectedModel"
      @close="closeSettingsModal"
      @model-selected="handleModelSelected"
      @api-key-saved="handleApiKeySaved"
    />

    <HelpOverlay :is-open="showHelp" @close="showHelp = false" />
    
    <!-- Progress Indicator with theme styling -->
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
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import { Plus, ArrowLeft, Settings, ChevronRight, ZoomIn, Move, Search, HelpCircle, UploadCloud } from 'lucide-vue-next';
import 'highlight.js/styles/github-dark.css';
import InfiniteCanvas from './components/canvas/InfiniteCanvas.vue';
import ThemeToggle from './components/theme/ThemeToggle.vue';
import TangentLogo from './components/logo/TangentLogo.vue';
import WorkspaceMenu from './components/workspace/WorkspaceMenu.vue';
import SidePanel from './components/sandpack/SandPackSidePanel.vue';
import Badge from './components/ui/Badge.vue';
import SettingsModal from './components/settings/SettingsModal.vue'; // New component
import { useCanvasStore } from '@/stores/canvasStore';
import { useModelStore } from '@/stores/modelStore';
import { useChatStore } from '@/stores/chatStore';
import { useAppStore } from '@/stores/appStore'; 
import { useThemeStore } from '@/stores/themeStore';
import emitter from '@/utils/eventBus'
import type { Node } from '@/types/message';
import type { ModelInfo } from '@/types/model';
import HelpOverlay from './components/ui/overlay/HelpOverlay.vue';

const gestureMode = ref<'scroll' | 'zoom'>('zoom');
const anthropicApiKey = ref(localStorage.getItem('anthropicApiKey') || '');

// Canvas and workspace state
const canvasRef = ref<InstanceType<typeof InfiniteCanvas> | null>(null);
const canvasZoom = ref(1);
const canvasAutoZoom = ref(true);

const windowSize = ref({
  innerHeight: 0,
  innerWidth: 0
});

const showHelp = ref(false);

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

// Theme awareness
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');

// Theme observer
let themeObserver;

const selectedNode = ref<Node | null>(null);

// Model selection and API keys (Corrected Initialization)
const selectedModel = ref<ModelInfo | null>(null); // Initialize to null
const modelType = ref<string>(''); // Initialize to empty string
const openRouterApiKey = ref('');
const geminiApiKey = ref('');
const customApiUrl = ref<string | null>(null);

// Initialize from local storage *after* defining the refs
selectedModel.value = localStorage.getItem('selectedModel') ? JSON.parse(localStorage.getItem('selectedModel')!) : null;
modelType.value = localStorage.getItem('modelType') || '';
openRouterApiKey.value = localStorage.getItem('openRouterApiKey') || '';
geminiApiKey.value = localStorage.getItem('geminiApiKey') || '';

const isHeightLocked = ref(false);

// Settings Modal State
const settingsModalOpen = ref(false);
const activeSettingsTab = ref('models');

const isInOverview = computed(() => {
  return canvasRef.value?.isWorkspaceOverview ?? true;
});

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

const topControlsStyle = computed(() => {
  return {
    backdropFilter: 'blur(4px)',
    borderBottom: isDarkTheme.value ? '1px solid rgba(80, 80, 80, 0.3)' : '1px solid rgba(200, 200, 200, 0.3)'
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

// Settings Modal Methods
const openSettingsAndShowModels = () => {
  activeSettingsTab.value = 'models';
  settingsModalOpen.value = true;
};

const closeSettingsModal = () => {
  settingsModalOpen.value = false;
};

const handleModelSelected = (model: ModelInfo) => {
  selectedModel.value = model;
  modelType.value = model.source;
  localStorage.setItem('selectedModel', JSON.stringify(model));
  localStorage.setItem('modelType', model.source);
};

const handleApiKeySaved = ({ provider, apiKey }: { provider: string, apiKey: string }) => {
  // Update local API key references
  switch(provider) {
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
  // Use lowercase "m" (you can change this key if you wish)
  if (e.key.toLowerCase() === 'm') {
    e.preventDefault();
    openSettingsAndShowModels();
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

const isImporting = ref(false);
const importProgress = ref(0);
const importStatus = ref(''); 
const fileInput = ref<HTMLInputElement | null>(null);

const triggerFileSelect = () => {
  fileInput.value?.click();
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
    const response = await fetch('http://127.0.0.1:5000/api/process', {
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

// Drag and Drop handlers
const handleDragEnter = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  isImporting.value = true; // Show the overlay when dragging starts
  importStatus.value = 'Drop to Upload'; // Initial status
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  // Optional: Add visual feedback for valid drop targets
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'; // Or 'move', 'link', as appropriate
  }
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  // Check if the mouse is leaving the window
  if (e.clientX <= 0 || e.clientX >= window.innerWidth ||
    e.clientY <= 0 || e.clientY >= window.innerHeight) {
    isImporting.value = false; // Hide the overlay
    importStatus.value = '';
  }
};

const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  isImporting.value = true;
  importProgress.value = 0;
  importStatus.value = "Uploading and processing...";

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) {
    importStatus.value = '';
    isImporting.value = false;
    return;
  }

  const file = files[0];
  if (!file.name || !file.name.endsWith('.json')) {
    alert('Please select a JSON file.');
    isImporting.value = false;
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/process', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process file');
    }

    const data = await response.json();
    // Assuming the backend sends a 'workspaces' array
    if (data.workspaces && Array.isArray(data.workspaces)) {
      importStatus.value = "Importing workspaces..."
      await canvasStore.importWorkspaces(data.workspaces, (progress) => {
        importProgress.value = progress;
      });
      // Switch to overview mode after import
      canvasRef.value?.returnToOverview();
      // Make sure chat list is up to date
      await chatStore.loadChats()
      nextTick(() => { // Ensure DOM is updated
        canvasRef.value?.autoFitNodes();  // Then trigger auto-fit.
      });

    } else {
      console.error("Unexpected response format:", data);
      alert('Failed to process the chat data.  Check the console for details.');
      isImporting.value = false;
    }

  } catch (error) {
    console.error('Error uploading file:', error);
    alert('Error uploading file: ' + (error instanceof Error ? error.message : String(error)));
    isImporting.value = false;
  } finally {
    // Reset even if there's an error
    isImporting.value = false;
    importProgress.value = 0; // Reset progress
    importStatus.value = "";
  }
};

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
  
  const updateWindowSize = () => {
    windowSize.value = {
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth
    };
  };

  updateWindowSize();
  window.addEventListener('resize', updateWindowSize);

  // Add drag-and-drop listeners to the document (for dropping anywhere)
  document.addEventListener('dragenter', handleDragEnter);
  document.addEventListener('dragover', handleDragOver);
  document.addEventListener('dragleave', handleDragLeave);
  document.addEventListener('drop', handleDrop);
});

onBeforeUnmount(() => {
  if (themeObserver) {
    themeObserver.disconnect();
  }
  
  emitter.off('navigate-to-code-bubble', handleNavigateToCodeBubble);
  window.removeEventListener('resize', updateWindowSize);
  document.removeEventListener('keydown', handleGlobalHotkey);
  
  // Clean up drag-and-drop listeners
  document.removeEventListener('dragenter', handleDragEnter);
  document.removeEventListener('dragover', handleDragOver);
  document.removeEventListener('dragleave', handleDragLeave);
  document.removeEventListener('drop', handleDrop);
});
</script>

<style scoped>
/* App-wide base styles */
.app-container {
  transition: background-color 0.3s ease, color 0.3s ease;
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
  transition: background-color 0.3s ease, backdrop-filter 0.3s ease, border-color 0.3s ease;
}

/* Button and control styling */
.theme-btn, .canvas-control-btn, .back-to-workspaces-btn, .toggle-panel-btn {
  transition: all 0.2s ease;
}

.theme-btn:hover, .canvas-control-btn:hover, .back-to-workspaces-btn:hover {
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
</style>