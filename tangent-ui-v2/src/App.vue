<template>
  <div class="min-h-screen bg-background" @dragenter.prevent="handleDragEnter" @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave" @drop.prevent="handleDrop">
    <!-- Side Panel -->
    <div
      class="fixed left-0 top-0 h-full w-[40vw] bg-background shadow-lg transform transition-transform duration-300 z-40 border-r border-base-300"
      :class="appStore.isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'">
      <div class="h-full pt-2 px-4 pb-4 bg-background">
        <SidePanel @panel-opened="isSidePanelOpen = true" @panel-closed="isSidePanelOpen = false" />
      </div>
    </div>

    <!-- Toggle Button -->
    <button @click="appStore.toggleSidePanel()"
      class="fixed left-0 top-1/2 -translate-y-1/2 z-50 p-2 bg-background border border-l-0 border-base-300 rounded-r-md hover:bg-base-200 transition-all duration-300 shadow-md"
      :class="{ 'translate-x-[40vw]': appStore.isSidePanelOpen }">
      <ChevronRight class="w-5 h-5 transition-transform" :class="{ 'rotate-180': appStore.isSidePanelOpen }" />
    </button>

    <!-- Top Controls Container -->
    <div class="fixed z-50 transition-all duration-300 flex justify-between"
      :style="{ left: appStore.isSidePanelOpen ? '40vw' : '0', right: '0' }">
      <div class="flex flex-col px-4 space-y-2 md:flex-row md:items-center md:space-y-0 md:space-x-4 mt-16 sm:mt-4">
        <div class="flex items-center space-x-4">
          <!-- Logo Container -->
          <TangentLogo v-if="showLogo" />
          <ThemeToggle />
          <!-- New Workspace Button -->
          <button @click="handleNewWorkspace" :style="buttonStyles"
            class="btn btn-sm btn-ghost gap-2 transition-all duration-300 shadow-md">
            <Plus class="w-4 h-4" />
          </button>

          <!-- File Input (Hidden) -->
          <input type="file" id="file-upload" ref="fileInput" accept=".json" @change="handleFileSelect"
            class="hidden" />
          <!-- Upload Button (Triggers File Input) -->
          <button @click="triggerFileSelect" :style="buttonStyles"
            class="btn btn-sm btn-ghost gap-2 transition-all duration-300 shadow-md">
            <UploadCloud class="w-4 h-4" />
          </button>

        </div>
      </div>
      <div class="flex items-center gap-2 relative">
        <div class="relative flex items-center">
          <WorkspaceMenu ref="workspaceMenuRef" @workspace-loaded="handleWorkspaceLoaded" />
          <Badge v-if="selectedModel" @click.stop="openSettingsAndShowModels"
            class="h-6 bg-green-500 text-white p-2 cursor-pointer ml-2">
            {{ selectedModel.name }}
          </Badge>
          <button @click="openSettingsAndShowModels" class="btn btn-sm btn-ghost">
            <Settings class="w-4 h-4" />
          </button>
          <button @click="showHelp = true" class="btn btn-ghost btn-sm">
            <HelpCircle class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom Controls Container -->
    <div v-if="!isInOverview" class="fixed bottom-0 z-50 transition-all duration-300 flex justify-start"
      :style="{ left: appStore.isSidePanelOpen ? '40vw' : '0', right: '0' }">
      <div class="flex flex-col px-4 space-y-2 md:flex-row md:items-center md:space-y-0 md:space-x-4 mb-4">
        <button @click="handleBackToWorkspaces"
          class="btn btn-sm bg-base-200/90 backdrop-blur rounded-full border border-base-300 hover:bg-base-300/90">
          <ArrowLeft class="w-4 h-4" />
          <span class="text-sm">Back to Workspaces</span>
        </button>
      </div>
    </div>

    <!-- Canvas Controls -->
    <div v-if="!isInOverview" class="fixed bottom-4 right-24 z-50 flex items-center gap-2">
      <button class="h-8 px-3 bg-base-200/90 backdrop-blur rounded-full border border-base-300 hover:bg-base-300/90"
        @click="toggleAutoZoom">
        <span class="text-sm">{{ canvasAutoZoom ? 'Auto-fit On' : 'Auto-fit Off' }}</span>
      </button>
      <button
        class="h-8 px-3 bg-base-200/90 backdrop-blur rounded-full border border-base-300 hover:bg-base-300/90 flex items-center gap-2"
        @click="gestureMode = gestureMode === 'zoom' ? 'scroll' : 'zoom'">
        <component :is="gestureMode === 'zoom' ? ZoomIn : Move" class="w-4 h-4" />
        <span class="text-sm">Two-finger {{ gestureMode === 'zoom' ? 'Zoom' : 'Pan' }}</span>
      </button>
    </div>
    <div v-if="!isInOverview"
      class="fixed bottom-4 right-4 z-50 px-3 h-8 bg-base-200/90 backdrop-blur text-sm rounded-full border border-base-300 flex items-center">
      {{ Math.round(canvasZoom * 100) }}%
    </div>

    <!-- Canvas Container Wrapper -->
    <div class="transition-all duration-300"
      :style="{ width: appStore.isSidePanelOpen ? '60vw' : '100vw', marginLeft: appStore.isSidePanelOpen ? '40vw' : '0' }">
      <!-- Use appStore -->
      <InfiniteCanvas ref="canvasRef" :selected-model="selectedModel?.id || ''" :open-router-api-key="openRouterApiKey"
        :model-type="modelType" :side-panel-open="appStore.isSidePanelOpen" :gesture-mode="gestureMode"
        v-model:zoom="canvasZoom" v-model:auto-zoom-enabled="canvasAutoZoom" v-model:is-height-locked="isHeightLocked"
        :viewport-height="windowSize.innerHeight" :viewport-width="windowSize.innerWidth"
        @node-selected="handleNodeSelected" />
    </div>

    <!-- Workspace Overview Title -->
    <div v-if="!isInOverview" class="fixed bottom-4 z-50 w-full text-center transition-all duration-300"
      :style="{ left: appStore.isSidePanelOpen ? '40vw' : '0', right: '0' }">
      <!-- Use appStore -->
      <div v-if="showOverviewTitle"
        class="inline-block px-8 py-3 bg-base-200/90 backdrop-blur rounded-full border border-base-300 text-lg font-semibold relative overflow-hidden group hover:px-12 hover:py-4 transition-all duration-300">
        <span
          class="absolute p-8 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 group-hover:left-4 group-focus:left-4">
          <Search class="w-5 h-5" />
        </span>
        <span
          class="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus:opacity-100">...</span>
      </div>
    </div>

    <!-- Settings & Model Selector Modal -->
    <dialog ref="settingsDialog" class="modal">
      <div class="modal-box max-w-3xl max-h-[80vh] overflow-y-auto">
        <!-- Modal Tabs -->
        <div class="flex items-center space-x-2 mb-4">
          <button class="btn btn-sm" :class="{ 'btn-active': activeTab === 'api' }" @click="activeTab = 'api'">
            API Settings
          </button>
          <button class="btn btn-sm" :class="{ 'btn-active': activeTab === 'tasks' }" @click="activeTab = 'tasks'">
            Tasks
          </button>
          <button class="btn btn-sm" :class="{ 'btn-active': activeTab === 'models' }" @click="activeTab = 'models'">
            Models
          </button>
          <button class="btn btn-sm" :class="{ 'btn-active': activeTab === 'agents' }" @click="activeTab = 'agents'">
            Agents
          </button>
        </div>
        <div class="relative">
          <transition name="fade" mode="out-in">
            <!-- Simplified API Settings Tab -->
            <div v-if="activeTab === 'api'" key="api" class="space-y-4 p-2">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">API Provider</span>
                </label>
                <select v-model="selectedApiProvider" class="input input-bordered w-full">
                  <option value="openrouter">OpenRouter</option>
                  <option value="gemini">Gemini</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div class="form-control" v-if="selectedApiProvider === 'openrouter'">
                <label class="label">
                  <span class="label-text">OpenRouter API Key</span>
                </label>
                <input v-model="openRouterApiKey" type="password" placeholder="sk-or-..."
                  class="input input-bordered w-full" @keyup.enter="saveApiKey('openrouter')" />
                <!-- Confirmation Message -->
                <div v-if="apiKeySaveStatus.openrouter" class="text-sm text-green-500 mt-1">
                  {{ apiKeySaveStatus.openrouter }}
                </div>
              </div>
              <div class="form-control" v-if="selectedApiProvider === 'gemini'">
                <label class="label">
                  <span class="label-text">Gemini API Key</span>
                </label>
                <input v-model="geminiApiKey" type="password" placeholder="AIza..." class="input input-bordered w-full"
                  @keyup.enter="saveApiKey('gemini')" />
                <div v-if="apiKeySaveStatus.gemini" class="text-sm text-green-500 mt-1">
                  {{ apiKeySaveStatus.gemini }}
                </div>
              </div>
              <div v-if="selectedApiProvider === 'custom'">
                <div class="form-control">
                  <label class="label">
                    <span class="label-text">Custom Inference/Completion URL</span>
                  </label>
                  <input v-model="customApiUrl" type="url" placeholder="https://your-api.com/inference"
                    class="input input-bordered w-full" />
                </div>
                <div class="form-control">
                  <label class="label">
                    <span class="label-text">Custom API Key</span>
                  </label>
                  <input v-model="customApiKey" type="password" placeholder="Enter your API key"
                    class="input input-bordered w-full" />
                </div>
              </div>
            </div>
            <!-- Tasks Content -->
            <div v-else-if="activeTab === 'tasks'" key="tasks" class="p-2">
              <TaskManager />
            </div>
            <!-- Models Content -->
            <div v-else-if="activeTab === 'models'" key="models" class="p-2">
              <!-- Model Filter Buttons -->
              <div class="flex h-10 mb-2 bg-base-200 rounded-lg p-1">
                <!-- Ollama -->
                <button @click="setActiveProvider('ollama')"
                  class="relative flex items-center gap-2 px-3 rounded-md transition-all duration-300" :class="{
                    'bg-base-100 shadow-sm flex-1': activeProvider === 'ollama',
                    'w-10 hover:bg-base-300': activeProvider !== 'ollama'
                  }">
                  <span class="w-6 h-6 flex items-center justify-center">
                    <img :src="ollama" alt="Ollama" class="w-5 h-5 object-contain" />
                  </span>
                  <span class="truncate transition-opacity duration-300"
                    :class="{ 'opacity-0 w-0': activeProvider !== 'ollama' }">
                    Ollama
                  </span>
                </button>
                <!-- OpenRouter -->
                <button @click="setActiveProvider('openrouter')"
                  class="relative flex items-center gap-2 px-3 rounded-md transition-all duration-300" :class="{
                    'bg-base-100 shadow-sm flex-1': activeProvider === 'openrouter',
                    'w-10 hover:bg-base-300': activeProvider !== 'openrouter'
                  }">
                  <span class="w-6 h-6 flex items-center justify-center">
                    <svg :width="activeProvider === 'openrouter' ? 20 : 12"
                      :height="activeProvider === 'openrouter' ? 20 : 12" viewBox="0 0 512 512"
                      xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="currentColor"
                      class="transition-all duration-300">
                      <g clip-path="url(#clip0_205_3)">
                        <path
                          d="M3 248.945C18 248.945 76 236 106 219C136 202 136 202 198 158C276.497 102.293 332 120.945 423 120.945"
                          stroke-width="90" />
                        <path d="M511 121.5L357.25 210.268L357.25 32.7324L511 121.5Z" />
                        <path
                          d="M0 249C15 249 73 261.945 103 278.945C133 295.945 133 295.945 195 339.945C273.497 395.652 329 377 420 377"
                          stroke-width="90" />
                        <path d="M508 376.445L354.25 287.678L354.25 465.213L508 376.445Z" />
                      </g>
                    </svg>
                  </span>
                  <span class="truncate transition-opacity duration-300"
                    :class="{ 'opacity-0 w-0': activeProvider !== 'openrouter' }">
                    OpenRouter
                  </span>
                </button>
                <!-- Google -->
                <button @click="setActiveProvider('google')"
                  class="relative flex items-center gap-2 px-3 rounded-md transition-all duration-300" :class="{
                    'bg-base-100 shadow-sm flex-1': activeProvider === 'google',
                    'w-10 hover:bg-base-300': activeProvider !== 'google'
                  }">
                  <span class="w-6 h-6 flex items-center justify-center">
                    <img :src="google" alt="Google" class="w-5 h-5 object-contain" />
                  </span>
                  <span class="truncate transition-opacity duration-300"
                    :class="{ 'opacity-0 w-0': activeProvider !== 'google' }">
                    Google
                  </span>
                </button>
                <!-- Custom -->
                <button @click="setActiveProvider('custom')"
                  class="relative flex items-center gap-2 px-3 rounded-md transition-all duration-300" :class="{
                    'bg-base-100 shadow-sm flex-1': activeProvider === 'custom',
                    'w-10 hover:bg-base-300': activeProvider !== 'custom'
                  }">
                  <span class="w-6 h-6 flex items-center justify-center">
                    <Plus class="w-5 h-5" />
                  </span>
                  <span class="truncate transition-opacity duration-300"
                    :class="{ 'opacity-0 w-0': activeProvider !== 'custom' }">
                    Custom
                  </span>
                </button>
              </div>
              <!-- Regular Model Selection -->
              <div>
                <!-- Search Bar -->
                <div class="p-3 border-b border-base-300">
                  <div class="relative">
                    <Search class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input v-model="searchQuery" type="text" placeholder="Search models... (/)"
                      class="w-full pl-9 pr-3 py-2 border border-base-300 rounded-md bg-base-100 text-sm placeholder:text-gray-400 text-base-content" />
                  </div>
                </div>
                <!-- Models List -->
                <div class="max-h-[60vh] overflow-y-auto bg-base-100" role="listbox">
                  <!-- Loading Message -->
                  <div v-if="modelStore.loading[activeProvider]" class="p-8 text-center text-gray-500">
                    <p class="text-sm">Loading {{ getProviderName(activeProvider) }} models...</p>
                  </div>
                  <!-- Models -->
                  <div v-else-if="filteredModels.length > 0">
                    <div v-for="(model, index) in filteredModels" :key="model.id"
                      class="border-b border-base-300 last:border-0 cursor-pointer hover:bg-base-200"
                      :class="{ 'bg-blue-50 dark:bg-blue-900': highlightedIndex === index }"
                      @click="selectModelFromList(model)" @mouseover="highlightedIndex = index">
                      <div class="p-3">
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <Badge :variant="getProviderVariant(model.source)" class="text-xs">
                              {{ getProviderName(model.source) }}
                            </Badge>
                            <span class="font-medium text-base-content">{{ model.name }}</span>
                          </div>
                        </div>
                        <p v-if="model.description" class="mt-1 text-xs text-gray-500 text-base-content line-clamp-2">
                          {{ model.description }}
                        </p>
                      </div>
                    </div>
                  </div>
                  <!-- Empty State -->
                  <div v-else class="p-8 text-center text-gray-500">
                    <p class="text-sm">No models available for {{ getProviderName(activeProvider) }}</p>
                  </div>
                </div>
              </div>
            </div>
            <!-- Agents Content -->
            <div v-else-if="activeTab === 'agents'" key="agents" class="p-2">
              <AgentSettings />
            </div>
          </transition>
        </div>

        <!-- Modal Action -->
        <div class="modal-action mt-4">
          <button class="btn" @click="closeSettings">Close</button>
        </div>
      </div>
    </dialog>

    <HelpOverlay :is-open="showHelp" @close="showHelp = false" />
    <!-- Progress Indicator -->
    <div v-if="isImporting" class="fixed inset-0 z-50 flex items-center justify-center bg-base-300/50 backdrop-blur">
      <div class="p-4 bg-base-100 rounded-lg shadow-lg text-center">
        <p class="text-lg font-semibold mb-2">Importing Workspaces...</p>
        <progress class="progress progress-primary w-56" :value="importProgress" max="100"></progress>
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
import TaskManager from './components/manager/TaskManager.vue';
import WorkspaceMenu from './components/workspace/WorkspaceMenu.vue';
import SidePanel from './components/sidepanel/SandPackSidePanel.vue';
import Badge from './components/ui/Badge.vue';
import google from '@/assets/google.jpeg';
import ollama from '@/assets/ollama.jpeg';
import { useCanvasStore } from '@/stores/canvasStore';
import { useModelStore } from '@/stores/modelStore';
import { useChatStore } from '@/stores/chatStore';
import { useAppStore } from '@/stores/appStore';  // Import appStore

import type { Node } from '@/types/message';
import type { ModelInfo } from '@/types/model';
import HelpOverlay from './components/ui/overlay/HelpOverlay.vue';
// import SidePanel from './components/sidepanel/SidePanel.vue';


import AgentSettings from './components/agents/AgentSettings.vue';

const gestureMode = ref<'scroll' | 'zoom'>('zoom');

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

const canvasStore = useCanvasStore();
const modelStore = useModelStore();
const chatStore = useChatStore();
const appStore = useAppStore(); // Use appStore

const currentTheme = ref(
  document.documentElement.getAttribute('data-theme') || 'light'
);


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


const selectedApiProvider = ref('openrouter');
const customApiKey = ref('');
const isHeightLocked = ref(false);

// API Key Save Status (Corrected Initialization)
const apiKeySaveStatus = ref({
  openrouter: '',
  gemini: '',
});

const activeTab = ref<'api' | 'tasks' | 'models' | 'agents'>('agents');

const isInOverview = computed(() => {
  return canvasRef.value?.isWorkspaceOverview ?? true;
});


const toggleAutoZoom = () => {
  canvasAutoZoom.value = !canvasAutoZoom.value;
  if (canvasAutoZoom.value) {
    canvasRef.value?.autoFitNodes();
  }
};

const settingsDialog = ref<HTMLDialogElement | null>(null);

const openSettingsAndShowModels = () => {
  settingsDialog.value?.showModal();
  activeTab.value = 'models';
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


const closeSettings = () => {
  settingsDialog.value?.close();
};

const activeProvider = ref<
  'ollama' | 'openrouter' | 'google' | 'anthropic' | 'openai' | 'custom'
>('ollama');
const searchQuery = ref('');
const highlightedIndex = ref(0);
const customProvider = ref('anthropic');
const customProviderApiKey = ref('');
const apiEndpoint = ref('');

const filteredModels = computed(() => {
  return modelStore.getFilteredModels(activeProvider.value, searchQuery.value);
});

const handleBackToWorkspaces = () => { if (canvasRef.value) { canvasRef.value.returnToOverview() } };


const handleCustomProviderSubmit = () => {
  console.log('Connecting to custom provider:', {
    provider: customProvider.value,
    apiKey: customProviderApiKey.value,
    endpoint: apiEndpoint.value
  });
  customProviderApiKey.value = '';
  apiEndpoint.value = '';
};

// const showBackButton = computed(() => {
//   return !isInOverview.value;
// });

const buttonStyles = computed(() => ({
  backgroundColor: getComputedStyle(document.documentElement)
    .getPropertyValue('--btn-bg')
    .trim(),
  borderColor: getComputedStyle(document.documentElement)
    .getPropertyValue('--btn-border')
    .trim(),
  color: getComputedStyle(document.documentElement)
    .getPropertyValue('--btn-text')
    .trim(),
}));

const showOverviewTitle = computed(() => {
  return isInOverview.value;
});

const selectModelFromList = (model: ModelInfo) => {
  selectedModel.value = model;
  modelType.value = model.source;
  localStorage.setItem('selectedModel', JSON.stringify(model));
  localStorage.setItem('modelType', model.source);
};

const getProviderName = (source: string) => {
  switch (source) {
    case 'ollama': return 'Local';
    case 'openrouter': return 'Cloud';
    case 'google': return 'Google';
    case 'anthropic': return 'Anthropic';
    case 'openai': return 'OpenAI';
    default: return source;
  }
};

const getProviderVariant = (source: string) => {
  switch (source) {
    case 'ollama': return 'default';
    case 'openrouter': return 'secondary';
    case 'google': return 'outline';
    case 'anthropic': return 'secondary';
    case 'openai': return 'default';
    default: return 'default';
  }
};

const handleNodeSelected = (node: Node) => {
  selectedNode.value = node;
};

const handleWorkspaceLoaded = () => {
  canvasRef.value?.autoFitNodes();
};

const workspaceMenuRef = ref<any>(null);


const handleNewWorkspace = async () => {
  // Clear any existing snapped nodes
  if (canvasStore.snappedNodeId) {
    canvasStore.popSnappedNode();
  }

  // Clear the current workspace
  await canvasStore.clearCurrentWorkspace();

  // Create new workspace
  const newWorkspaceId = await canvasStore.createNewWorkspace();

  if (newWorkspaceId) {
    // Refresh the workspaces list
    await chatStore.loadChats();

    // Load the new workspace state
    await canvasStore.loadChatState(newWorkspaceId);

    // Get the ID of the newly created root node
    const rootNodeId = canvasStore.nodes[0]?.id;
    if (rootNodeId) {
      // Center and snap to the root node
      nextTick(() => {
        if (canvasRef.value) {
          canvasRef.value.centerAndSnapNode(rootNodeId);
        }
      });
    }
  }
};

const setActiveProvider = (provider: typeof activeProvider.value) => {
  activeProvider.value = provider;
  if (!modelStore.hasModels(provider)) {
    modelStore.initializeProvider(provider);
  }
};

// Corrected saveApiKey function
const saveApiKey = (provider: 'openrouter' | 'gemini') => {
  let apiKey = '';
  if (provider === 'openrouter') {
    apiKey = openRouterApiKey.value;
    localStorage.setItem('openRouterApiKey', apiKey);
  } else if (provider === 'gemini') {
    apiKey = geminiApiKey.value;
    localStorage.setItem('geminiApiKey', apiKey);
  }

  // Check if apiKey is not empty *before* accessing apiKeySaveStatus.value
  if (apiKey) {
    apiKeySaveStatus.value[provider] = 'API Key Saved!';
    setTimeout(() => {
      apiKeySaveStatus.value[provider] = '';
    }, 2000);
    modelStore.initializeProvider(provider);
  }
};


const isImporting = ref(false);
const importProgress = ref(0);
const importStatus = ref(''); // Add this line
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


//Drag and Drop handlers
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

watch(() => canvasRef.value?.workspaces, (newWorkspaces) => {
  // This will trigger a recompute of showLogo when workspaces change
}, { deep: true });

onMounted(async () => {
  canvasStore.initFromLocalStorage(); // Keep this for other settings
  await chatStore.loadChats();

  document.addEventListener('keydown', handleGlobalHotkey); //moved inside of ifs to avoid errors of uninitialized components
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


  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateWindowSize);
    document.removeEventListener('keydown', handleGlobalHotkey);
    // Clean up drag-and-drop listeners
    document.removeEventListener('dragenter', handleDragEnter);
    document.removeEventListener('dragover', handleDragOver);
    document.removeEventListener('dragleave', handleDragLeave);
    document.removeEventListener('drop', handleDrop);

  });

  if (!modelStore.hasModels(activeProvider.value)) {
    modelStore.initializeProvider(activeProvider.value);
  }
});

</script>

<style scoped>
.modal {
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.side-panel {
  isolation: isolate;
}

.btn {
  transition: all 0.2s ease;
}

.btn-ghost {
  @apply hover:bg-base-200/90;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

:global([data-theme="light"]) {
  --btn-bg: #f1f5f9;
  /* Example light background */
  --btn-border: #d1d5db;
  /* Example light border */
  --btn-text: #1f2937;
  /* Example light text */
}

:global([data-theme="dark"]) {
  --btn-bg: #374151;
  /* Example dark background */
  --btn-border: #4b5563;
  /* Example dark border */
  --btn-text: #f9fafb;
  /* Example dark text */
}
</style>