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
        <TokenOptimizer />
      </div>
    </div>

    <!-- Toggle Button -->
    <button @click="toggleSidePanel"
      class="fixed left-0 top-1/2 -translate-y-1/2 z-50 p-2 bg-background border border-l-0 border-base-300 rounded-r-md hover:bg-base-200 transition-all duration-300 shadow-md"
      :class="{ 'translate-x-[40vw]': isSidePanelOpen }">
      <ChevronRight class="w-5 h-5 transition-transform" :class="{ 'rotate-180': isSidePanelOpen }" />
    </button>

    <!-- Left Controls (Theme Toggle) -->
    <div class="fixed top-0 z-50 transition-all duration-300 p-4" :style="{
      left: isSidePanelOpen ? '40vw' : '0'
    }">
      <ThemeToggle />
    </div>

    <!-- Right Controls -->
    <div class="fixed top-0 right-4 z-50 p-4 flex items-center gap-2">
      <button @click="openSettings" class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
        <Settings class="w-5 h-5" />
      </button>

      <ModelSelector :api-key="openRouterApiKey" :selected-model="selectedModel" @select="handleModelSelect" />
    </div>

    <!-- Canvas Container -->
    <div class="w-full h-screen">
      <InfiniteCanvas ref="canvasRef" :selected-model="selectedModel?.id || ''" :open-router-api-key="openRouterApiKey"
        :model-type="modelType" :side-panel-open="isSidePanelOpen" />
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
            <label class="label">
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
import { ref } from 'vue';
import { Settings, ChevronRight } from 'lucide-vue-next';
import InfiniteCanvas from './components/canvas/InfiniteCanvas.vue';
import ThemeToggle from './components/theme/ThemeToggle.vue';
import TangentLogo from './components/logo/TangentLogo.vue';
import ModelSelector from './components/models/ModelSelector.vue';
import TaskManager from './components/manager/TaskManager.vue';
import TokenOptimizer from './components/tokenizer/DirectoryTokenizer.vue';
import type { Model } from './components/models/ModelSelector.vue';
import { useCanvasStore } from './stores/canvasStore';

const canvasRef = ref<InstanceType<typeof InfiniteCanvas> | null>(null);

// State - load from localStorage if present
const selectedModel = ref<Model | null>(
  localStorage.getItem('selectedModel')
    ? JSON.parse(localStorage.getItem('selectedModel')!)
    : null
);
const modelType = ref<string>(localStorage.getItem('modelType') || '');
const settingsDialog = ref<HTMLDialogElement | null>(null);
const openRouterApiKey = ref(localStorage.getItem('openRouterApiKey') || '');
const activeTab = ref<'api' | 'tasks'>('api');
const canvasStore = useCanvasStore();
const customApiUrl = ref<string | null>(localStorage.getItem('customApiUrl') || null);

// Side panel state
const isSidePanelOpen = ref(false);

// Methods
const toggleSidePanel = () => {
  isSidePanelOpen.value = !isSidePanelOpen.value;
  // If panel is opening, wait for transition then center
  setTimeout(() => {
    canvasRef.value?.autoFitNodes();
  }, 300); // Match the transition duration
};

const handleModelSelect = (model: Model) => {
  console.log('Previous model:', selectedModel.value);
  console.log('New model:', model);

  selectedModel.value = model;
  modelType.value = model.source;

  try {
    localStorage.setItem('selectedModel', JSON.stringify(model));
    localStorage.setItem('modelType', model.source);
  } catch (e) {
    console.error('Error storing model:', e);
  }
};

const openSettings = () => {
  settingsDialog.value?.showModal();
};

const closeSettings = () => {
  settingsDialog.value?.close();
  if (openRouterApiKey.value) {
    localStorage.setItem('openRouterApiKey', openRouterApiKey.value);
  } else {
    localStorage.removeItem('openRouterApiKey');
  }
  canvasStore.setCustomApiUrl(customApiUrl.value)
};
</script>

<style scoped>
.modal {
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

/* Ensure side panel is above canvas */
.side-panel {
  isolation: isolate;
}
</style>