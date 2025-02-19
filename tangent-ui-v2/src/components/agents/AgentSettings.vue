<template>
    <div class="agent-settings p-4">
      <h2 class="text-xl font-semibold mb-4">🚧 Agent Settings (WIP) 🚧</h2>
      <p class="text-gray-600 mb-4">Configure your AI agents here.  Assign models and roles for different tasks.</p>
  
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-base-200 p-4 rounded-lg shadow">
          <h3 class="text-lg font-medium mb-2">Router Agent</h3>
          <p class="text-sm text-gray-500">Select the model that will route incoming requests to specialized agents.</p>
          <select v-model="selectedRouterModel" class="select select-bordered w-full mt-2">
            <option v-for="model in availableModels" :key="model.id" :value="model.id">
              {{ model.name }} ({{ model.source }})
            </option>
          </select>
        </div>
  
        <div class="bg-base-200 p-4 rounded-lg shadow">
          <h3 class="text-lg font-medium mb-2">Coding Agent</h3>
          <p class="text-sm text-gray-500">Select the model that will handle code generation and analysis.</p>
          <select v-model="selectedCodingModel" class="select select-bordered w-full mt-2">
            <option v-for="model in availableModels" :key="model.id" :value="model.id">
               {{ model.name }} ({{ model.source }})
            </option>
          </select>
        </div>
  
        <div class="bg-base-200 p-4 rounded-lg shadow">
          <h3 class="text-lg font-medium mb-2">Image Analysis Agent</h3>
          <p class="text-sm text-gray-500">Select the model for image understanding and description.</p>
          <select v-model="selectedImageModel" class="select select-bordered w-full mt-2">
            <option v-for="model in availableModels" :key="model.id" :value="model.id">
              {{ model.name }} ({{ model.source }})
            </option>
          </select>
        </div>
  
        <div class="bg-base-200 p-4 rounded-lg shadow">
          <h3 class="text-lg font-medium mb-2">Custom Agent</h3>
          <p class="text-sm text-gray-500">Add a custom LLM agent that you would like to use.</p>
            <select class="select select-bordered w-full mt-2">
                <option> Custom Agent (coming soon)</option>
            </select>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { useModelStore } from '@/stores/modelStore'; // Import the model store
  import type { Model } from '@/stores/modelStore';
  
  const modelStore = useModelStore();
  
  // State for selected agent models (replace with agent store later)
  const selectedRouterModel = ref<string | null>(null);
  const selectedCodingModel = ref<string | null>(null);
  const selectedImageModel = ref<string | null>(null);
  
  // Computed property to get all available models
  const availableModels = computed(() => {
    return [
      ...modelStore.ollamaModels,
      ...modelStore.openRouterModels,
      ...modelStore.googleModels,
    ];
  });
  
  onMounted(async () => {
    await modelStore.initialize(); // Ensure models are loaded
  });
  
  </script>
  
  <style scoped>
  /* Add any custom styles for the agent settings here */
  </style>