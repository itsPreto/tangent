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

    <!-- Top Controls Container -->
    <div class="fixed top-0 z-50 transition-all duration-300 flex justify-between" :style="{
      left: isSidePanelOpen ? '40vw' : '0',
      right: '0'
    }">
      <!-- Left Controls Group -->
      <div class="flex items-center gap-4 p-4">
        <div class="flex items-center gap-4">
          <WorkspaceMenu />
          
          <!-- Canvas Controls -->
          <div class="flex items-center gap-2">
            <ThemeToggle />
            <div class="px-3 py-1.5 bg-base-200/90 backdrop-blur text-sm rounded-full border border-base-300">
              {{ Math.round(canvasZoom * 100) }}%
            </div>
            <button
              class="px-3 py-1.5 bg-base-200/90 backdrop-blur rounded-full border border-base-300 hover:bg-base-300/90"
              @click="toggleAutoZoom"
            >
              <span class="text-sm">{{ canvasAutoZoom ? 'Auto-fit On' : 'Auto-fit Off' }}</span>
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

    <!-- Canvas Container -->
    <InfiniteCanvas 
      ref="canvasRef" 
      :selected-model="selectedModel?.id || ''" 
      :open-router-api-key="openRouterApiKey"
      :model-type="modelType" 
      :side-panel-open="isSidePanelOpen" 
      :zoom="canvasZoom" 
      v-model:zoom="canvasZoom"
      v-model:auto-zoom-enabled="canvasAutoZoom" 
    />

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
            <input v-model="geminiApiKey" type="password" placeholder="AIza..."
              class="input input-bordered w-full" />

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
import { ref, onMounted } from 'vue';
import { Settings, ChevronRight } from 'lucide-vue-next';
import InfiniteCanvas from './components/canvas/InfiniteCanvas.vue';
import ThemeToggle from './components/theme/ThemeToggle.vue';
import TangentLogo from './components/logo/TangentLogo.vue';
import ModelSelector from './components/models/ModelSelector.vue';
import TaskManager from './components/manager/TaskManager.vue';
import TokenOptimizer from './components/tokenizer/DirectoryTokenizer.vue';
import WorkspaceMenu from './components/workspace/WorkspaceMenu.vue';
import type { Model } from './stores/modelStore';
import { useCanvasStore } from './stores/canvasStore';
import { useModelStore } from './stores/modelStore';
import { useChatStore } from './stores/chatStore';

const canvasRef = ref<InstanceType<typeof InfiniteCanvas> | null>(null);
const canvasZoom = ref(1);
const canvasAutoZoom = ref(true);

// Stores
const canvasStore = useCanvasStore();
const modelStore = useModelStore();
const chatStore = useChatStore();

onMounted(() => {
    canvasStore.initFromLocalStorage();
    chatStore.loadChats();  // Add this line
});
// State
const selectedModel = ref<Model | null>(
  localStorage.getItem('selectedModel')
    ? JSON.parse(localStorage.getItem('selectedModel')!)
    : null
);
const modelType = ref<string>(localStorage.getItem('modelType') || '');
const settingsDialog = ref<HTMLDialogElement | null>(null);
const openRouterApiKey = ref(localStorage.getItem('openRouterApiKey') || '');
const geminiApiKey = ref(localStorage.getItem('geminiApiKey') || '');
const activeTab = ref<'api' | 'tasks'>('api');
const customApiUrl = ref<string | null>(localStorage.getItem('customApiUrl') || null);
const isSidePanelOpen = ref(false);

// Methods
const toggleSidePanel = () => {
  isSidePanelOpen.value = !isSidePanelOpen.value;
  setTimeout(() => {
    canvasRef.value?.autoFitNodes();
  }, 300);
};

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

const openSettings = () => settingsDialog.value?.showModal();

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