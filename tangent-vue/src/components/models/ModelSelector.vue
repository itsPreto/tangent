<template>
  <div class="relative inline-block">
    <!-- Model Selection Button -->
    <button @click="toggleDropdown" @keydown.space.prevent="toggleDropdown" @keydown.enter.prevent="toggleDropdown"
      @keydown.m.prevent="focusModelSelector"
      class="w-64 bg-background border rounded-md px-3 py-2 text-sm flex items-center justify-between hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      ref="modelButton">
      <div class="flex items-center gap-2 overflow-hidden">
        <span v-if="selectedModel" class="flex items-center gap-2">
          <Badge :variant="selectedModel.source === 'ollama' ? 'default' : 'secondary'" class="text-xs">
            {{ selectedModel.source === 'ollama' ? 'Local' : 'Cloud' }}
          </Badge>
          <span class="font-medium truncate">{{ selectedModel.name }}</span>
        </span>
        <span v-else>Select Model (M)</span>
      </div>
      <ChevronDown class="w-4 h-4 transition-transform" :class="{ 'rotate-180': isOpen }" />
    </button>

    <!-- Dropdown Menu -->
    <div v-show="isOpen" class="absolute right-0 mt-2 w-96 bg-background border rounded-md shadow-lg z-30" role="dialog"
      aria-label="Model Selection">
      <!-- Search and Filter Bar -->
      <div class="p-3 border-b">
        <div class="relative mb-2">
          <Search class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input v-model="searchQuery" type="text" ref="searchInput"
            class="w-full pl-9 pr-3 py-2 border rounded-md bg-background text-sm placeholder:text-gray-400"
            placeholder="Search models... (/)" @keydown.up.prevent="navigateList('up')"
            @keydown.down.prevent="navigateList('down')" @keydown.enter.prevent="selectHighlighted"
            @keydown.esc.prevent="closeDropdown" />
        </div>
        <!-- Price Filter -->
        <div class="flex gap-2 mt-2">
          <button v-for="filter in ['all', 'free', 'paid']" :key="filter" @click="priceFilter = filter"
            @keydown.enter="priceFilter = filter" class="px-3 py-1 text-xs rounded-md"
            :class="priceFilter === filter ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'"
            tabindex="0">
            {{ filter.charAt(0).toUpperCase() + filter.slice(1) }}
          </button>
        </div>
      </div>

      <!-- Models List -->
      <div class="max-h-[60vh] overflow-y-auto" role="listbox" ref="modelsList">
        <!-- Combined Models List -->
        <div v-for="(model, index) in filteredModels" :key="model.id"
          class="border-b last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
          :class="{ 'bg-blue-50 dark:bg-blue-900/20': highlightedIndex === index }" @click="selectModel(model)"
          @keydown.enter="selectModel(model)" @mouseover="highlightedIndex = index" role="option"
          :aria-selected="highlightedIndex === index" tabindex="0" ref="modelItems">
          <div class="p-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Badge :variant="model.source === 'ollama' ? 'default' : 'secondary'" class="text-xs">
                  {{ model.source === 'ollama' ? 'Local' : model.provider }}
                </Badge>
                <span class="font-medium">{{ model.name }}</span>
              </div>
              <div v-if="model.source === 'openrouter'" class="text-xs text-gray-500">
                ${{ model.pricing?.prompt }}/1K
              </div>
            </div>
            <p v-if="isOpenRouterModel(model) && model.description" class="mt-1 text-xs text-gray-500 line-clamp-2">
              {{ model.description }}
            </p>
            <div v-if="isOpenRouterModel(model) && model.tags?.length" class="flex gap-2 mt-2">
              <span v-for="tag in model.tags" :key="tag"
                class="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {{ tag }}
              </span>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="filteredModels.length === 0" class="p-8 text-center text-gray-500">
          <p v-if="searchQuery" class="text-sm">No models found matching "{{ searchQuery }}"</p>
          <p v-else class="text-sm">No models available</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { ChevronDown, Search } from 'lucide-vue-next';
import Badge from '../ui/Badge.vue';
import type { Model, OllamaModel, OpenRouterModel } from '../../types';

const props = defineProps<{
  apiKey?: string;
  selectedModel: Model | null;
}>();

const emit = defineEmits<{
  (e: 'select', model: Model): void;
}>();

// Refs
const isOpen = ref(false);
const searchQuery = ref('');
const priceFilter = ref<'all' | 'free' | 'paid'>('all');
const ollamaModels = ref<OllamaModel[]>([]);
const openRouterModels = ref<OpenRouterModel[]>([]);
const highlightedIndex = ref(0);
const modelButton = ref<HTMLButtonElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const modelsList = ref<HTMLDivElement | null>(null);
const modelItems = ref<HTMLDivElement[]>([]);
const isChatInputFocused = ref(false);

// Navigation
const navigateList = (direction: 'up' | 'down') => {
  const maxIndex = filteredModels.value.length - 1;
  if (direction === 'up') {
    highlightedIndex.value = highlightedIndex.value <= 0 ? maxIndex : highlightedIndex.value - 1;
  } else {
    highlightedIndex.value = highlightedIndex.value >= maxIndex ? 0 : highlightedIndex.value + 1;
  }

  // Scroll highlighted item into view
  const highlightedElement = modelItems.value[highlightedIndex.value];
  if (highlightedElement && modelsList.value) {
    highlightedElement.scrollIntoView({ block: 'nearest' });
  }
};

const selectHighlighted = () => {
  const model = filteredModels.value[highlightedIndex.value];
  if (model) {
    selectModel(model);
  }
};

// Toggle and focus management
const focusModelSelector = () => {
  toggleDropdown();
  nextTick(() => {
    if (isOpen.value) {
      searchInput.value?.focus();
    }
  });
};

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    highlightedIndex.value = 0;
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

// Model selection
const selectModel = (model: Model) => {
  emit('select', model);
  closeDropdown();
};

// Computed and utilities
const filteredModels = computed(() => {
  const query = searchQuery.value.toLowerCase();
  const allModels = [...ollamaModels.value, ...openRouterModels.value];

  return allModels
    .filter(model => {
      const matchesSearch = model.name.toLowerCase().includes(query) ||
        (model.source === 'openrouter' &&
          ((model as OpenRouterModel).description?.toLowerCase().includes(query) ||
            (model as OpenRouterModel).provider.toLowerCase().includes(query)));

      if (priceFilter.value === 'all') return matchesSearch;

      if (model.source === 'ollama') {
        return priceFilter.value === 'free' && matchesSearch;
      } else {
        const openRouterModel = model as OpenRouterModel;
        const isFree = openRouterModel.pricing.prompt === "0";
        return (
          (priceFilter.value === 'free' && isFree && matchesSearch) ||
          (priceFilter.value === 'paid' && !isFree && matchesSearch)
        );
      }
    })
    .sort((a, b) => {
      if (a.source !== b.source) {
        return a.source === 'ollama' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
});

const isOpenRouterModel = (model: Model): model is OpenRouterModel => {
  return model.source === 'openrouter';
};

const handleGlobalKeydown = (e: KeyboardEvent) => {
  // Check if any input or textarea is focused
  const activeElement = document.activeElement;
  const isInputFocused = activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement;

  // Immediately prevent model selector if we're typing in an input
  if (isInputFocused) {
    // Still allow Escape to close the dropdown if it's open
    if (e.key === 'Escape' && isOpen.value) {
      closeDropdown();
    }
    return;
  }

  // Handle model selector shortcuts only if no input is focused
  if (e.key === 'm' && !isOpen.value) {
    e.preventDefault();
    focusModelSelector();
  }

  // Focus search with '/' key
  if (e.key === '/' && isOpen.value) {
    e.preventDefault();
    searchInput.value?.focus();
  }

  // Close with Escape
  if (e.key === 'Escape' && isOpen.value) {
    closeDropdown();
  }
};

// Remove the chat input focus tracking since we're now checking actively
onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown);
  fetchOllamaModels();
  if (props.apiKey) {
    fetchOpenRouterModels();
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleGlobalKeydown);
});
// Reset highlighted index when filtered models change
watch(filteredModels, () => {
  highlightedIndex.value = 0;
});

// API calls
const fetchOllamaModels = async () => {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    if (Array.isArray(data.models)) {
      ollamaModels.value = data.models.map((model: any) => ({
        id: model.name,
        name: model.name,
        source: 'ollama' as const
      }));
    }
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    ollamaModels.value = [];
  }
};

const fetchOpenRouterModels = async () => {
  if (!props.apiKey) return;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${props.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    openRouterModels.value = data.data.map((model: any) => ({
      id: model.id,
      name: model.name.split(':')[1]?.trim() || model.name,
      source: 'openrouter' as const,
      provider: model.name.split(':')[0],
      description: model.description,
      pricing: {
        prompt: model.pricing.prompt,
        completion: model.pricing.completion
      },
      tags: [
        `${model.context_length}k context`,
        model.pricing.prompt === "0" ? "Free" : "Paid",
      ],
      context_length: model.context_length
    }));
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    openRouterModels.value = [];
  }
};
</script>