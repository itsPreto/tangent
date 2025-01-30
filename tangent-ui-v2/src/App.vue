<template>
  <div class="min-h-screen bg-background">
    <!-- Logo Container -->
    <div class="fixed top-4 z-50 transition-all duration-300 w-[180px]" :style="{
      left: isSidePanelOpen ? 'calc(40vw + (60vw - 180px) / 2)' : 'calc(50vw - 90px)'
    }">
      <TangentLogo />
    </div>

    <!-- Side Panel -->
    <div
      class="fixed left-0 top-0 h-full w-[40vw] bg-background shadow-lg transform transition-transform duration-300 z-40 border-r border-base-300"
      :class="isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'">
      <div class="h-full pt-2 px-4 pb-4 bg-background">
        <TopicClusterViz />
      </div>
    </div>

    <!-- Toggle Button -->
    <button @click="toggleSidePanel"
      class="fixed left-0 top-1/2 -translate-y-1/2 z-50 p-2 bg-background border border-l-0 border-base-300 rounded-r-md hover:bg-base-200 transition-all duration-300 shadow-md"
      :class="{ 'translate-x-[40vw]': isSidePanelOpen }">
      <ChevronRight class="w-5 h-5 transition-transform" :class="{ 'rotate-180': isSidePanelOpen }" />
    </button>

    <!-- Top Controls Container -->
    <div class="fixed z-50 transition-all duration-300 flex justify-between" :style="{
      left: isSidePanelOpen ? '40vw' : '0',
      right: '0'
    }">
      <!-- Left Controls Group -->
      <div class="flex items-center px-4">
        <div class="flex items-center gap-4">
          <WorkspaceMenu @workspace-loaded="handleWorkspaceLoaded" />

          <!-- Canvas Controls -->
          <div class="flex items-center gap-2">
            <ThemeToggle />
            <button class="px-3 bg-base-200/90 backdrop-blur rounded-full border border-base-300 hover:bg-base-300/90"
              @click="toggleAutoZoom">
              <span class="text-sm">{{ canvasAutoZoom ? 'Auto-fit On' : 'Auto-fit Off' }}</span>
            </button>
            <button
              class="px-3 bg-base-200/90 backdrop-blur rounded-full border border-base-300 hover:bg-base-300/90 flex items-center gap-2"
              @click="gestureMode = gestureMode === 'zoom' ? 'scroll' : 'zoom'">
              <component :is="gestureMode === 'zoom' ? ZoomIn : Move" class="w-4 h-4" />
              <span class="text-sm">Two-finger {{ gestureMode === 'zoom' ? 'Zoom' : 'Pan' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Right Controls Group -->
      <div class="flex items-center gap-2 p-4 mr-4">
        <button @click="openSettings" class="btn btn-sm btn-ghost">
          <Settings class="w-4 h-4" />
        </button>
        <ModelSelector :api-key="openRouterApiKey" :selected-model="selectedModel" @select="handleModelSelect" />
      </div>
    </div>

    <div class="fixed bottom-4 right-4 z-50 px-3 bg-base-200/90 backdrop-blur text-sm rounded-full border border-base-300">
      {{ Math.round(canvasZoom * 100) }}%
    </div>
    <!-- Canvas Container -->
    <InfiniteCanvas ref="canvasRef" :selected-model="selectedModel?.id || ''" :open-router-api-key="openRouterApiKey"
      :model-type="modelType" :side-panel-open="isSidePanelOpen" :gesture-mode="gestureMode" v-model:zoom="canvasZoom"
      v-model:auto-zoom-enabled="canvasAutoZoom" />

    <!-- "Back to Workspaces" Button -->
    <button v-if="showBackButton" class="fixed bottom-4 left-4 z-50 btn btn-sm btn-ghost gap-2"
      @click="handleReturnToOverview">
      <ArrowLeft class="w-4 h-4" />
      Back to Workspaces
    </button>

    <!-- Workspace Overview Title -->
    <div class="fixed bottom-4 z-50 w-full text-center transition-all duration-300"
      :style="{ left: isSidePanelOpen ? '40vw' : '0', right: '0' }">
      <div v-if="showOverviewTitle"
        class="inline-block px-4 py-2 bg-base-200/90 backdrop-blur rounded-full border border-base-300 text-lg font-semibold">
        Your Workspaces
      </div>
    </div>

    <!-- Settings Modal -->
    <dialog ref="settingsDialog" class="modal">
      <div class="modal-box max-w-lg">
        <div class="flex items-center space-x-2 mb-4">
          <button class="btn btn-sm" :class="{ 'btn-active': activeTab === 'api' }" @click="activeTab = 'api'">
            API Settings
          </button>
          <button class="btn btn-sm" :class="{ 'btn-active': activeTab === 'tasks' }" @click="activeTab = 'tasks'">
            Tasks
          </button>
        </div>

        <div v-if="activeTab === 'api'" class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">OpenRouter API Key</span>
            </label>
            <input v-model="openRouterApiKey" type="password" placeholder="sk-or-..."
              class="input input-bordered w-full" />

            <label class="label mt-2">
              <span class="label-text">Gemini API Key</span>
            </label>
            <input v-model="geminiApiKey" type="password" placeholder="AIza..." class="input input-bordered w-full" />

            <label class="label mt-2">
              <span class="label-text">Custom API URL</span>
            </label>
            <input v-model="customApiUrl" type="url" placeholder="http://localhost:8080/v1/chat/completions"
              class="input input-bordered w-full" />
          </div>
        </div>

        <div v-else-if="activeTab === 'tasks'">
          <TaskManager />
        </div>

        <div class="modal-action">
          <button class="btn" @click="closeSettings">Close</button>
        </div>
      </div>
    </dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ArrowLeft, Settings, ChevronRight, ZoomIn, Move } from 'lucide-vue-next';

import InfiniteCanvas from './components/canvas/InfiniteCanvas.vue';
import ThemeToggle from './components/theme/ThemeToggle.vue';
import TangentLogo from './components/logo/TangentLogo.vue';
import ModelSelector from './components/models/ModelSelector.vue';
import TaskManager from './components/manager/TaskManager.vue';
import WorkspaceMenu from './components/workspace/WorkspaceMenu.vue';
import TopicClusterViz from './components/canvas/clustermap/TopicClusterViz.vue';
import type { Model } from './stores/modelStore';

import { useCanvasStore } from './stores/canvasStore';
import { useModelStore } from './stores/modelStore';
import { useChatStore } from './stores/chatStore';

const gestureMode = ref<'scroll' | 'zoom'>('zoom');

// Refs and reactive state
const canvasRef = ref<InstanceType<typeof InfiniteCanvas> | null>(null);
const canvasZoom = ref(1);
const canvasAutoZoom = ref(true);

const canvasStore = useCanvasStore();
const modelStore = useModelStore();
const chatStore = useChatStore();

// Called once the component is mounted
onMounted(() => {
  canvasStore.initFromLocalStorage();
  chatStore.loadChats();
});

// Model selection
const selectedModel = ref<Model | null>(
  localStorage.getItem('selectedModel')
    ? JSON.parse(localStorage.getItem('selectedModel')!)
    : null
);
const modelType = ref<string>(localStorage.getItem('modelType') || '');
const openRouterApiKey = ref(localStorage.getItem('openRouterApiKey') || '');
const geminiApiKey = ref(localStorage.getItem('geminiApiKey') || '');
const customApiUrl = ref<string | null>(localStorage.getItem('customApiUrl') || null);
const activeTab = ref<'api' | 'tasks'>('api');
const isSidePanelOpen = ref(false);

// --- Computed to show/hide "Back to Workspaces" button safely ---
const showBackButton = computed(() => {
  return canvasRef.value && !canvasRef.value.isWorkspaceOverview;
});

// --- Computed to show/hide "Your Workspaces" title safely ---
const showOverviewTitle = computed(() => {
  return canvasRef.value && canvasRef.value.isWorkspaceOverview;
});

const handleWorkspaceLoaded = () => {
  canvasRef.value?.autoFitNodes();
};
// Methods
const toggleSidePanel = () => {
  isSidePanelOpen.value = !isSidePanelOpen.value;
  setTimeout(() => {
    canvasRef.value?.autoFitNodes();
  }, 300);
};

function handleReturnToOverview() {
  // Safely call the child's method
  canvasRef.value?.returnToOverview();
}

const toggleAutoZoom = () => {
  canvasAutoZoom.value = !canvasAutoZoom.value;
  if (canvasAutoZoom.value) {
    canvasRef.value?.autoFitNodes();
  }
};

const handleModelSelect = (model: Model) => {
  selectedModel.value = model;
  modelType.value = model.source;
  localStorage.setItem('selectedModel', JSON.stringify(model));
  localStorage.setItem('modelType', model.source);
};

const openSettings = () => {
  settingsDialog.value?.showModal();
};

const closeSettings = () => {
  settingsDialog.value?.close();
  if (openRouterApiKey.value) {
    localStorage.setItem('openRouterApiKey', openRouterApiKey.value);
  }
  if (geminiApiKey.value) {
    localStorage.setItem('geminiApiKey', geminiApiKey.value);
    modelStore.initialize();
  }
};

const settingsDialog = ref<HTMLDialogElement | null>(null);
</script>

<style scoped>
.modal {
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.side-panel {
  isolation: isolate;
}

/* Smooth transitions */
.btn {
  transition: all 0.2s ease;
}

.btn-ghost {
  @apply hover:bg-base-200/90;
}
</style>
