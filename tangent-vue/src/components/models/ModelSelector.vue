<template>
  <div class="relative inline-block">
    <!-- Model Selection Button -->
    <button @click="toggleDropdown"
      class="w-64 bg-background border rounded-md px-3 py-2 text-sm flex items-center justify-between hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
      <div class="flex items-center gap-2 overflow-hidden">
        <span v-if="selectedModel" class="flex items-center gap-2">
          <Badge :variant="selectedModel.source === 'ollama' ? 'default' : 'secondary'" class="text-xs">
            {{ selectedModel.source === 'ollama' ? 'Local' : 'Cloud' }}
          </Badge>
          <span class="font-medium truncate">{{ selectedModel.name }}</span>
        </span>
        <span v-else>Select Model</span>
      </div>
      <ChevronDown class="w-4 h-4 transition-transform" :class="{ 'rotate-180': isOpen }" />
    </button>

    <!-- Dropdown Menu -->
    <div v-show="isOpen" class="absolute right-0 mt-2 w-96 bg-background border rounded-md shadow-lg z-30">
      <!-- Search and Filter Bar -->
      <div class="p-3 border-b">
        <div class="relative mb-2">
          <Search class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input v-model="searchQuery" type="text"
            class="w-full pl-9 pr-3 py-2 border rounded-md bg-background text-sm placeholder:text-gray-400"
            placeholder="Search models..." />
        </div>
        <!-- Price Filter -->
        <div class="flex gap-2 mt-2">
          <button
            @click="priceFilter = 'all'"
            class="px-3 py-1 text-xs rounded-md"
            :class="priceFilter === 'all' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'"
          >
            All
          </button>
          <button
            @click="priceFilter = 'free'"
            class="px-3 py-1 text-xs rounded-md"
            :class="priceFilter === 'free' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'"
          >
            Free
          </button>
          <button
            @click="priceFilter = 'paid'"
            class="px-3 py-1 text-xs rounded-md"
            :class="priceFilter === 'paid' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'"
          >
            Paid
          </button>
        </div>
      </div>

      <!-- Models List -->
      <div class="max-h-[60vh] overflow-y-auto">
        <!-- Combined Models List -->
        <div v-for="model in filteredModels" :key="model.id"
          class="border-b last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
          @click="selectModel(model)">
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
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { ChevronDown, Search } from 'lucide-vue-next';
import Badge from '../ui/Badge.vue';

export interface ModelPricing {
  prompt: string;
  completion: string;
}

export interface BaseModel {
  id: string;
  name: string;
  source: 'ollama' | 'openrouter';
}

export interface OllamaModel extends BaseModel {
  source: 'ollama';
}

export interface OpenRouterModel extends BaseModel {
  source: 'openrouter';
  provider: string;
  description?: string;
  pricing: ModelPricing;
  tags?: string[];
  context_length?: number;
}

export type Model = OllamaModel | OpenRouterModel;

const props = defineProps<{
  apiKey?: string;
  selectedModel: Model | null;
}>();

const emit = defineEmits<{
  (e: 'select', model: Model): void;
}>();

// State
const isOpen = ref(false);
const searchQuery = ref('');
const priceFilter = ref<'all' | 'free' | 'paid'>('all');
const ollamaModels = ref<OllamaModel[]>([]);
const openRouterModels = ref<OpenRouterModel[]>([]);

// Computed
const filteredModels = computed(() => {
  const query = searchQuery.value.toLowerCase();
  const allModels = [...ollamaModels.value, ...openRouterModels.value];

  return allModels
    .filter(model => {
      // Text search filter
      const matchesSearch = model.name.toLowerCase().includes(query) ||
        (model.source === 'openrouter' &&
          ((model as OpenRouterModel).description?.toLowerCase().includes(query) ||
            (model as OpenRouterModel).provider.toLowerCase().includes(query)));

      // Price filter
      if (priceFilter.value === 'all') return matchesSearch;
      
      if (model.source === 'ollama') {
        // Consider all local models as free
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
      // Sort local models first, then by name
      if (a.source !== b.source) {
        return a.source === 'ollama' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
});

const isOpenRouterModel = (model: Model): model is OpenRouterModel => {
  return model.source === 'openrouter';
};

// Methods
const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const selectModel = (model: Model) => {
  emit('select', model);
  isOpen.value = false;
};

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

// Lifecycle
onMounted(() => {
  fetchOllamaModels();
  if (props.apiKey) {
    fetchOpenRouterModels();
  }
});

watch(() => props.apiKey, (newKey) => {
  if (newKey) {
    fetchOpenRouterModels();
  } else {
    openRouterModels.value = [];
  }
});

// Close dropdown when clicking outside
const closeDropdown = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.relative')) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', closeDropdown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeDropdown);
});
</script>