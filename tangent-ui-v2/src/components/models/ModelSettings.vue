<template>
  <div class="relative inline-block">
    <!-- Provider Tabs Container -->
    <div class="flex h-10 mb-2 bg-base-200 rounded-lg p-1">
      <!-- Ollama Tab -->
      <button @click="activeProvider = 'ollama'"
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

      <!-- OpenRouter Tab -->
      <button @click="activeProvider = 'openrouter'"
        class="relative flex items-center gap-2 px-3 rounded-md transition-all duration-300" :class="{
          'bg-base-100 shadow-sm flex-1': activeProvider === 'openrouter',
          'w-10 hover:bg-base-300': activeProvider !== 'openrouter'
        }">
        <span class="w-6 h-6 flex items-center justify-center">
          <svg :width="activeProvider === 'openrouter' ? 20 : 12" :height="activeProvider === 'openrouter' ? 20 : 12"
            viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="currentColor"
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

      <!-- Google Tab -->
      <button @click="activeProvider = 'google'"
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

      <!-- Custom Provider Tab -->
      <button @click="activeProvider = 'custom'"
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

    <!-- Model Selection Button -->
    <button @click="toggleDropdown" @keydown.space.prevent="toggleDropdown" @keydown.enter.prevent="toggleDropdown"
      @keydown.m.prevent="focusModelSelector"
      class="w-64 bg-base-100 border border-base-300 rounded-md px-3 py-2 text-sm flex items-center justify-between hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      ref="modelButton">
      <div class="flex items-center gap-2 overflow-hidden">
        <span v-if="modelStore.selectedModel" class="flex items-center gap-2">
          <Badge :variant="getProviderVariant(modelStore.selectedModel.source)" class="text-xs">
            {{ getProviderName(modelStore.selectedModel.source) }}
          </Badge>
          <span class="font-medium truncate text-base-content">{{ modelStore.selectedModel.name }}</span>
        </span>
        <span v-else class="text-base-content">Select Model (M)</span>
      </div>
      <ChevronDown class="w-4 h-4 transition-transform text-base-content" :class="{ 'rotate-180': isOpen }" />
    </button>

    <!-- Dropdown Menu -->
    <div v-show="isOpen"
      class="absolute right-0 mt-2 w-96 bg-base-100 border border-base-300 rounded-md shadow-lg z-30">
      <!-- Custom Provider Form -->
      <div v-if="activeProvider === 'custom'" class="p-4">
        <h3 class="text-lg font-medium mb-4">Connect Custom Provider</h3>
        <form @submit.prevent="handleCustomProviderSubmit">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Provider</label>
              <select v-model="customProvider" class="w-full p-2 border rounded-md bg-base-100">
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">API Key</label>
              <input type="password" v-model="apiKey" placeholder="Enter your API key"
                class="w-full p-2 border rounded-md bg-base-100" />
            </div>
            <div v-if="customProvider === 'other'">
              <label class="block text-sm font-medium mb-1">API Endpoint</label>
              <input type="text" v-model="apiEndpoint" placeholder="https://api.example.com"
                class="w-full p-2 border rounded-md bg-base-100" />
            </div>
            <button type="submit"
              class="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors">
              Connect Provider
            </button>
          </div>
        </form>
      </div>

      <!-- Regular Model Selection -->
      <template v-else>
        <!-- Search Bar -->
        <div class="p-3 border-b border-base-300">
          <div class="relative">
            <Search class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input v-model="searchQuery" type="text" ref="searchInput"
              class="w-full pl-9 pr-3 py-2 border border-base-300 rounded-md bg-base-100 text-sm placeholder:text-gray-400 text-base-content"
              placeholder="Search models... (/)" @keydown.up.prevent="navigateList('up')"
              @keydown.down.prevent="navigateList('down')" @keydown.enter.prevent="selectHighlighted"
              @keydown.esc.prevent="closeDropdown" />
          </div>
        </div>

        <!-- Models List -->
        <div class="max-h-[60vh] overflow-y-auto bg-base-100" role="listbox" ref="modelsList">
          <div v-for="(model, index) in filteredModels" :key="model.id"
            class="border-b border-base-300 last:border-0 cursor-pointer hover:bg-base-200 transition-all duration-200"
            :class="{
              'bg-blue-50 dark:bg-blue-900 ring ring-blue-500': selectedModel && selectedModel.id === model.id,
              'bg-white': !(selectedModel && selectedModel.id === model.id)
            }" @click="selectModelFromList(model)" @mouseover="highlightedIndex = index">
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


          <!-- Empty State -->
          <div v-if="filteredModels.length === 0" class="p-8 text-center text-gray-500 text-base-content">
            <p class="text-sm">No models available for {{ getProviderName(activeProvider) }}</p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ChevronDown, Search, Plus } from 'lucide-vue-next';
import Badge from '../ui/Badge.vue';
import { useModelStore } from '../../stores/modelStore';
import type { ModelInfo } from '@/types/model';
import google from '@/assets/google.jpeg';
import ollama from '@/assets/ollama.jpeg';

// Define props
const props = defineProps<{
  apiKey?: string;
}>();

const emit = defineEmits<{
  (e: 'select', model: ModelInfo): void;
}>();

const modelStore = useModelStore();

// Refs
const isOpen = ref(false);
const searchQuery = ref('');
const highlightedIndex = ref(0);
const modelButton = ref<HTMLButtonElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const modelsList = ref<HTMLDivElement | null>(null);
const activeProvider = ref<'ollama' | 'openrouter' | 'google' | 'custom'>('ollama');

// Custom provider form state
const customProvider = ref('anthropic');
const apiKey = ref('');
const apiEndpoint = ref('');

// Provider helpers
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

// Computed
const filteredModels = computed(() => {
  return modelStore.getFilteredModels(activeProvider.value, searchQuery.value);
});

// Methods
const handleCustomProviderSubmit = () => {
  console.log('Connecting to custom provider:', {
    provider: customProvider.value,
    apiKey: apiKey.value,
    endpoint: apiEndpoint.value
  });
  apiKey.value = '';
  apiEndpoint.value = '';
  closeDropdown();
};

const navigateList = (direction: 'up' | 'down') => {
  const maxIndex = filteredModels.value.length - 1;
  if (direction === 'up') {
    highlightedIndex.value = highlightedIndex.value <= 0 ? maxIndex : highlightedIndex.value - 1;
  } else {
    highlightedIndex.value = highlightedIndex.value >= maxIndex ? 0 : highlightedIndex.value + 1;
  }
};

const selectHighlighted = () => {
  const model = filteredModels.value[highlightedIndex.value];
  if (model) {
    selectModel(model);
  }
};

const selectModel = (model: ModelInfo) => {
  modelStore.setSelectedModel(model);
  emit('select', model);
  closeDropdown();
};

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    nextTick(() => {
      searchInput.value?.focus();
    });
  }
};

const closeDropdown = () => {
  isOpen.value = false;
  searchQuery.value = '';
  modelButton.value?.focus();
};

const focusModelSelector = () => {
  toggleDropdown();
};

// Lifecycle hooks
onMounted(async () => {
  await modelStore.initialize();
  document.addEventListener('keydown', handleGlobalKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleGlobalKeydown);
});

const handleGlobalKeydown = (e: KeyboardEvent) => {
  // Check if the active element is an input, textarea, or contenteditable element
  const activeElement = document.activeElement;
  const isTyping = activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement?.getAttribute('contenteditable') === 'true';

  // Only handle 'M' shortcut if user is not typing
  if (e.key === 'm' && !isOpen.value && !isTyping) {
    e.preventDefault();
    focusModelSelector();
  }

  // These shortcuts should still work when the dropdown is open
  if (isOpen.value) {
    if (e.key === '/') {
      e.preventDefault();
      searchInput.value?.focus();
    }
    if (e.key === 'Escape') {
      closeDropdown();
    }
  }
};
</script>