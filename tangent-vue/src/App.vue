<script setup lang="ts">
import { ref } from 'vue';
import { Settings } from 'lucide-vue-next';
import InfiniteCanvas from './components/canvas/InfiniteCanvas.vue';
import ThemeToggle from './components/theme/ThemeToggle.vue';
import TangentLogo from './components/logo/TangentLogo.vue';
import ModelSelector from './components/models/ModelSelector.vue';
import TaskManager from './components/manager/TaskManager.vue';
import type { Model } from './components/models/ModelSelector.vue';

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

// Methods
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
};
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Logo - Centered at top -->
    <div class="fixed top-4 left-1/2 -translate-x-1/2 z-10">
      <TangentLogo />
    </div>

    <!-- Settings Modal -->
    <dialog ref="settingsDialog" class="modal">
      <div class="modal-box max-w-lg">
        <div class="flex items-center space-x-2 mb-4">
          <button 
            class="btn btn-sm"
            :class="{ 'btn-active': activeTab === 'api' }"
            @click="activeTab = 'api'"
          >
            API Settings
          </button>
          <button 
            class="btn btn-sm"
            :class="{ 'btn-active': activeTab === 'tasks' }"
            @click="activeTab = 'tasks'"
          >
            Tasks
          </button>
        </div>

        <div v-if="activeTab === 'api'" class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">OpenRouter API Key</span>
            </label>
            <input
              v-model="openRouterApiKey"
              type="password"
              placeholder="sk-or-..."
              class="input input-bordered w-full"
            />
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

    <!-- Model Selection Header -->
    <div class="fixed top-0 right-0 p-4 z-20 flex items-center gap-2">
      <button
        @click="openSettings"
        class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Settings class="w-5 h-5" />
      </button>

      <ModelSelector
        :api-key="openRouterApiKey"
        :selected-model="selectedModel"
        @select="handleModelSelect"
      />

      <ThemeToggle />
    </div>

    <!-- Canvas -->
    <InfiniteCanvas
      :selected-model="selectedModel?.id || ''"
      :open-router-api-key="openRouterApiKey"
      :model-type="modelType"
    />
  </div>
</template>