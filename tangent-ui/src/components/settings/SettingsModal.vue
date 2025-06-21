<template>
    <dialog ref="dialogRef" class="modal settings-modal" @close="emit('close')">
        <div class="modal-box max-w-4xl max-h-[85vh]" :style="modalStyle">
            <!-- Header with close button -->
            <div class="flex justify-between items-center mb-6 pb-3 border-b border-base-300">
                <h2 class="text-xl font-semibold">Settings</h2>
                <button @click="close" class="btn btn-sm btn-circle">
                    <X class="w-4 h-4" />
                </button>
            </div>

            <!-- Tab Navigation -->
            <div class="tabs tabs-boxed bg-base-200 p-1 rounded-lg mb-6">
                <button v-for="tab in tabs" :key="tab.id" @click="setActiveTab(tab.id)"
                    class="tab flex-1 flex items-center justify-center gap-2 h-10"
                    :class="activeTab === tab.id ? 'tab-active' : ''">
                    <component :is="tab.icon" class="w-4 h-4" />
                    <span>{{ tab.label }}</span>
                </button>
            </div>

            <!-- Content Container -->
            <div class="overflow-y-auto pb-4" style="max-height: calc(85vh - 180px);">
                <!-- API Settings Tab -->
                <div v-if="activeTab === 'api'" class="space-y-5">
                    <div class="form-control">
                        <label class="label font-medium">
                            <span class="label-text">API Provider</span>
                        </label>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <button v-for="provider in apiProviders" :key="provider.id"
                                @click="selectedApiProvider = provider.id"
                                class="provider-btn flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all duration-200"
                                :class="selectedApiProvider === provider.id ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/50'">
                                <div class="w-6 h-6 flex items-center justify-center bg-base-300 rounded-full">
                                    <img :src="provider.icon" :alt="provider.label" class="w-4 h-4 object-contain" />
                                </div>
                                <span>{{ provider.label }}</span>
                            </button>
                        </div>
                    </div>

                    <!-- API Key Inputs -->
                    <div class="bg-base-200 p-4 rounded-lg">
                        <template v-if="selectedApiProvider === 'openrouter'">
                            <div class="form-control">
                                <div class="flex items-center justify-between">
                                    <label class="label">
                                        <span class="label-text font-medium">OpenRouter API Key</span>
                                    </label>
                                    <a href="https://openrouter.ai/keys" target="_blank"
                                        class="text-xs text-primary hover:underline">
                                        Get API Key
                                    </a>
                                </div>
                                <div class="relative">
                                    <input v-model="openRouterApiKey" type="password" placeholder="sk-or-..."
                                        class="input input-bordered w-full pr-24"
                                        :class="apiKeySaveStatus.openrouter ? 'input-success' : ''"
                                        @keyup.enter="saveApiKey('openrouter')" />
                                    <button @click="saveApiKey('openrouter')"
                                        class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-sm btn-primary">
                                        Save Key
                                    </button>
                                </div>
                                <transition name="slide-fade">
                                    <p v-if="apiKeySaveStatus.openrouter"
                                        class="text-success text-sm mt-1 flex items-center">
                                        <Check class="w-4 h-4 mr-1" />
                                        {{ apiKeySaveStatus.openrouter }}
                                    </p>
                                </transition>
                            </div>
                        </template>

                        <template v-if="selectedApiProvider === 'anthropic'">
                            <div class="form-control">
                                <div class="flex items-center justify-between">
                                    <label class="label">
                                        <span class="label-text font-medium">Anthropic API Key</span>
                                    </label>
                                    <a href="https://console.anthropic.com/" target="_blank"
                                        class="text-xs text-primary hover:underline">
                                        Get API Key
                                    </a>
                                </div>
                                <div class="relative">
                                    <input v-model="anthropicApiKey" type="password" placeholder="sk-ant-..."
                                        class="input input-bordered w-full pr-24"
                                        :class="apiKeySaveStatus.anthropic ? 'input-success' : ''"
                                        @keyup.enter="saveApiKey('anthropic')" />
                                    <button @click="saveApiKey('anthropic')"
                                        class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-sm btn-primary">
                                        Save Key
                                    </button>
                                </div>
                                <transition name="slide-fade">
                                    <p v-if="apiKeySaveStatus.anthropic"
                                        class="text-success text-sm mt-1 flex items-center">
                                        <Check class="w-4 h-4 mr-1" />
                                        {{ apiKeySaveStatus.anthropic }}
                                    </p>
                                </transition>
                            </div>
                        </template>

                        <template v-if="selectedApiProvider === 'gemini'">
                            <div class="form-control">
                                <div class="flex items-center justify-between">
                                    <label class="label">
                                        <span class="label-text font-medium">Gemini API Key</span>
                                    </label>
                                    <a href="https://ai.google.dev/" target="_blank"
                                        class="text-xs text-primary hover:underline">
                                        Get API Key
                                    </a>
                                </div>
                                <div class="relative">
                                    <input v-model="geminiApiKey" type="password" placeholder="AIza..."
                                        class="input input-bordered w-full pr-24"
                                        :class="apiKeySaveStatus.gemini ? 'input-success' : ''"
                                        @keyup.enter="saveApiKey('gemini')" />
                                    <button @click="saveApiKey('gemini')"
                                        class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-sm btn-primary">
                                        Save Key
                                    </button>
                                </div>
                                <transition name="slide-fade">
                                    <p v-if="apiKeySaveStatus.gemini"
                                        class="text-success text-sm mt-1 flex items-center">
                                        <Check class="w-4 h-4 mr-1" />
                                        {{ apiKeySaveStatus.gemini }}
                                    </p>
                                </transition>
                            </div>
                        </template>

                        <template v-if="selectedApiProvider === 'custom'">
                            <div class="space-y-4">
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text font-medium">Custom Inference URL</span>
                                    </label>
                                    <input v-model="customApiUrl" type="url"
                                        placeholder="https://your-api.com/inference"
                                        class="input input-bordered w-full" />
                                </div>
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text font-medium">Custom API Key</span>
                                    </label>
                                    <div class="relative">
                                        <input v-model="customApiKey" type="password" placeholder="Enter your API key"
                                            class="input input-bordered w-full pr-24"
                                            :class="apiKeySaveStatus.custom ? 'input-success' : ''"
                                            @keyup.enter="saveApiKey('custom')" />
                                        <button @click="saveApiKey('custom')"
                                            class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-sm btn-primary">
                                            Save Key
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Models Tab -->
                <div v-if="activeTab === 'models'" class="space-y-4">
                    <!-- Provider Selection -->
                    <div class="bg-base-200 p-1 rounded-lg">
                        <div class="grid grid-cols-3 md:grid-cols-6 gap-1">
                            <button v-for="provider in modelProviders" :key="provider.id"
                                @click="setActiveProvider(provider.id)"
                                class="flex flex-col items-center gap-1 py-2 px-2 rounded-md transition-all duration-200"
                                :class="activeProvider === provider.id ? 'bg-base-100 text-primary font-medium shadow-sm' : 'hover:bg-base-300/50'">
                                <div class="w-6 h-6 flex items-center justify-center">
                                    <img :src="provider.icon" :alt="provider.name" class="w-5 h-5 object-contain" />
                                </div>
                                <span class="text-xs whitespace-nowrap">{{ provider.name }}</span>
                            </button>
                        </div>
                    </div>

                    <!-- Search -->
                    <div class="bg-base-200/50 p-3 rounded-lg">
                        <div class="relative">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50" />
                            <input v-model="searchQuery" type="text" placeholder="Search models... (/)"
                                class="w-full pl-10 pr-3 py-2 bg-base-100 border border-base-300 rounded-lg"
                                @keyup.slash="focusSearch" ref="searchInput" />
                        </div>
                    </div>

                    <!-- Currently selected model info -->
                    <div v-if="selectedModel" class="p-4 border border-primary/30 bg-primary/5 rounded-lg">
                        <h4 class="text-sm font-medium mb-2 text-primary">Currently Selected Model</h4>
                        <div class="flex items-start gap-3">
                            <div class="p-2 bg-base-200 rounded-lg">
                                <div class="w-8 h-8 flex items-center justify-center">
                                    <img :src="getProviderIcon(selectedModel.source)" class="w-6 h-6 object-contain"
                                        alt="Provider icon" />
                                </div>
                            </div>
                            <div>
                                <div class="font-semibold">{{ selectedModel.name }}</div>
                                <div v-if="selectedModel.description"
                                    class="text-xs text-base-content/70 mt-1 line-clamp-2">
                                    {{ selectedModel.description }}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Models List -->
                    <div class="border border-base-300 rounded-lg overflow-hidden">
                        <!-- Loading state -->
                        <div v-if="isLoading"
                            class="flex items-center justify-center p-8 text-base-content/70 bg-base-100">
                            <div class="flex flex-col items-center">
                                <Loader class="w-8 h-8 animate-spin mb-2" />
                                <p>Loading {{ getProviderName(activeProvider) }} models...</p>
                            </div>
                        </div>

                        <!-- Empty state -->
                        <div v-else-if="filteredModels.length === 0"
                            class="flex items-center justify-center p-8 text-base-content/70 bg-base-100">
                            <div class="flex flex-col items-center">
                                <AlertCircle class="w-8 h-8 mb-2" />
                                <p>No models found for "{{ searchQuery }}"</p>
                            </div>
                        </div>

                        <!-- Models -->
                        <div v-else class="max-h-[40vh] overflow-y-auto bg-base-100">
                            <div v-for="(model, index) in filteredModels" :key="model.id" @click="selectModel(model)"
                                @mouseover="highlightedIndex = index"
                                class="p-4 cursor-pointer transition-all duration-200 border-b border-base-300 last:border-b-0"
                                :class="{
                                    'bg-base-200/50': highlightedIndex === index && !isModelSelected(model),
                                    'bg-primary/10 border-l-4 border-l-primary': isModelSelected(model),
                                    'pl-[calc(1rem-4px)]': isModelSelected(model)
                                }">
                                <div class="flex items-start gap-3">
                                    <div class="p-1.5 bg-base-200 rounded">
                                        <div class="w-5 h-5 flex items-center justify-center">
                                            <img :src="getProviderIcon(model.source)" class="w-4 h-4 object-contain"
                                                alt="Model provider" />
                                        </div>
                                    </div>
                                    <div class="flex-1">
                                        <div class="font-medium">{{ model.name }}</div>
                                        <div v-if="model.description"
                                            class="text-xs text-base-content/70 mt-1 line-clamp-2">
                                            {{ model.description }}
                                        </div>
                                    </div>
                                    <div v-if="isModelSelected(model)" class="flex items-center text-primary">
                                        <Check class="w-5 h-5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tasks Tab -->
                <div v-if="activeTab === 'tasks'" class="bg-base-100 rounded-lg p-4">
                    <div class="task-manager-placeholder">
                        <!-- Fallback content in case TaskManager component fails -->
                        <div class="text-center p-6 border border-dashed border-base-300 rounded-lg">
                            <ClipboardList class="w-12 h-12 mx-auto mb-3 text-base-content/50" />
                            <h3 class="text-lg font-medium mb-2">Task Manager</h3>
                            <p class="text-sm text-base-content/70">Manage your automated tasks and workflows</p>
                        </div>
                    </div>
                </div>

                <!-- Agents Tab -->
                <div v-if="activeTab === 'agents'" class="bg-base-100 rounded-lg p-4">
                    <div class="agent-settings-placeholder">
                        <!-- Fallback content in case AgentSettings component fails -->
                        <div class="text-center p-6 border border-dashed border-base-300 rounded-lg">
                            <Bot class="w-12 h-12 mx-auto mb-3 text-base-content/50" />
                            <h3 class="text-lg font-medium mb-2">Agent Settings</h3>
                            <p class="text-sm text-base-content/70">Configure automated agents and their behaviors</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </dialog>

    <!-- Selection notification -->
    <Teleport to="body">
        <transition name="notification">
            <div v-if="notification.show"
                class="fixed bottom-4 right-4 z-[9999] bg-success text-success-content px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
                <Check class="w-5 h-5" />
                <span>{{ notification.message }}</span>
            </div>
        </transition>
    </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { X, Search, Check, AlertCircle, Loader, Key, Layers, ListChecks, Bot, ClipboardList } from 'lucide-vue-next';
// Import components conditionally to prevent failures
let TaskManager = null;
let AgentSettings = null;

try {
    TaskManager = require('./TaskManager.vue').default;
} catch (e) {
    console.warn('TaskManager component not available:', e);
}

try {
    AgentSettings = require('./AgentSettings.vue').default;
} catch (e) {
    console.warn('AgentSettings component not available:', e);
}

import { useModelStore } from '@/stores/modelStore';
import { useThemeStore } from '@/stores/themeStore';

// Default images - these need to be accessible or replaced
import ollamaIcon from '@/assets/ollama.jpeg';
import googleIcon from '@/assets/google.jpeg';
import anthropicIcon from '@/assets/anthropic.jpeg';
import openRouterIcon from '@/assets/unknown.jpeg'; // Use existing image
import openAIIcon from '@/assets/openai.jpeg';
import customIcon from '@/assets/unknown.jpeg';


const props = defineProps({
    isOpen: Boolean,
    initialTab: {
        type: String,
        default: 'models'
    },
    currentModel: Object
});

const emit = defineEmits(['close', 'model-selected', 'api-key-saved']);

// Refs
const dialogRef = ref(null);
const activeTab = ref(props.initialTab);
const selectedApiProvider = ref(localStorage.getItem('selectedApiProvider') || 'openrouter');
const searchQuery = ref('');
const highlightedIndex = ref(-1);
const activeProvider = ref('openrouter');
const searchInput = ref(null);

// API Keys
const openRouterApiKey = ref(localStorage.getItem('openRouterApiKey') || '');
const anthropicApiKey = ref(localStorage.getItem('anthropicApiKey') || '');
const geminiApiKey = ref(localStorage.getItem('geminiApiKey') || '');
const customApiKey = ref(localStorage.getItem('customApiKey') || '');
const customApiUrl = ref(localStorage.getItem('customApiUrl') || '');

// API Save Status
const apiKeySaveStatus = ref({
    openrouter: '',
    anthropic: '',
    gemini: '',
    custom: ''
});

// Notification system
const notification = ref({
    show: false,
    message: '',
    type: 'success'
});

// Stores
const modelStore = useModelStore();
const themeStore = useThemeStore();

// Initialize selected model from props or localStorage
const selectedModel = ref(
    props.currentModel ||
    (localStorage.getItem('selectedModel')
        ? JSON.parse(localStorage.getItem('selectedModel'))
        : null)
);

// Tab configuration
const tabs = [
    { id: 'api', label: 'API Settings', icon: Key },
    { id: 'models', label: 'Models', icon: Layers },
    { id: 'tasks', label: 'Tasks', icon: ListChecks },
    { id: 'agents', label: 'Agents', icon: Bot }
];

// API Providers
const apiProviders = [
    { id: 'openrouter', label: 'OpenRouter', icon: openRouterIcon },
    { id: 'anthropic', label: 'Anthropic', icon: anthropicIcon },
    { id: 'gemini', label: 'Gemini', icon: googleIcon },
    { id: 'custom', label: 'Custom', icon: customIcon }
];

// Model Providers
const modelProviders = [
    { id: 'ollama', name: 'Ollama', icon: ollamaIcon },
    { id: 'openrouter', name: 'Openrouter', icon: openRouterIcon },
    { id: 'google', name: 'Google', icon: googleIcon },
    { id: 'anthropic', name: 'Anthropic', icon: anthropicIcon },
    { id: 'openai', name: 'OpenAI', icon: openAIIcon },
    { id: 'custom', name: 'Custom', icon: customIcon }
];

// Computed
const isLoading = computed(() => modelStore.loading[activeProvider.value]);

const filteredModels = computed(() => {
    return modelStore.getFilteredModels(activeProvider.value, searchQuery.value) || [];
});

// Theme-based styling
const currentTheme = computed(() => document.documentElement.getAttribute('data-theme') || 'light');
const isDarkTheme = computed(() => themeStore.isDarkTheme(currentTheme.value));
const themeColors = computed(() => themeStore.getThemeColors(currentTheme.value));

// Modal styling
const modalStyle = computed(() => {
    let style = {
        backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 35, 0.95)' : 'rgba(250, 250, 250, 0.95)',
        backdropFilter: 'blur(10px)',
        border: isDarkTheme.value ? '1px solid rgba(80, 80, 80, 0.3)' : '1px solid rgba(200, 200, 200, 0.3)',
        boxShadow: isDarkTheme.value
            ? '0 20px 40px rgba(0, 0, 0, 0.5)'
            : '0 20px 40px rgba(0, 0, 0, 0.2)'
    };

    return style;
});

// Methods
const open = () => {
    dialogRef.value?.showModal();
};

const close = () => {
    dialogRef.value?.close();
    emit('close');
};

const setActiveTab = (tabId) => {
    activeTab.value = tabId;
};

const setActiveProvider = (provider) => {
    activeProvider.value = provider;
    if (!modelStore.hasModels(provider)) {
        modelStore.initializeProvider(provider);
    }
};

const saveApiKey = (provider) => {
    let apiKey = '';

    switch (provider) {
        case 'openrouter':
            apiKey = openRouterApiKey.value;
            localStorage.setItem('openRouterApiKey', apiKey);
            break;
        case 'anthropic':
            apiKey = anthropicApiKey.value;
            localStorage.setItem('anthropicApiKey', apiKey);
            break;
        case 'gemini':
            apiKey = geminiApiKey.value;
            localStorage.setItem('geminiApiKey', apiKey);
            break;
        case 'custom':
            apiKey = customApiKey.value;
            localStorage.setItem('customApiKey', apiKey);
            localStorage.setItem('customApiUrl', customApiUrl.value);
            break;
    }

    if (apiKey) {
        apiKeySaveStatus.value[provider] = 'API Key Saved!';
        showNotification(`${getProviderName(provider)} API key saved successfully`);

        setTimeout(() => {
            apiKeySaveStatus.value[provider] = '';
        }, 3000);

        modelStore.initializeProvider(provider);
        emit('api-key-saved', { provider, apiKey });
    }
};

const selectModel = (model) => {
    selectedModel.value = model;
    localStorage.setItem('selectedModel', JSON.stringify(model));
    localStorage.setItem('modelType', model.source);

    // Show notification
    showNotification(`${model.name} selected as current model`);

    // Emit event for parent component
    emit('model-selected', model);
};

const isModelSelected = (model) => {
    return selectedModel.value && selectedModel.value.id === model.id;
};

const getProviderName = (provider) => {
    switch (provider) {
        case 'ollama': return 'Local';
        case 'openrouter': return 'OpenRouter';
        case 'google': return 'Google';
        case 'anthropic': return 'Anthropic';
        case 'openai': return 'OpenAI';
        default: return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
};

const getProviderIcon = (source) => {
    switch (source) {
        case 'ollama': return ollamaIcon;
        case 'openrouter': return openRouterIcon;
        case 'google': return googleIcon;
        case 'anthropic': return anthropicIcon;
        case 'openai': return openAIIcon;
        default: return customIcon;
    }
};

const showNotification = (message, type = 'success') => {
    // Hide any existing notification first
    notification.value.show = false;

    // Set up new notification
    setTimeout(() => {
        notification.value = {
            show: true,
            message,
            type
        };

        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.value.show = false;
        }, 3000);
    }, 10);
};

const focusSearch = () => {
    searchInput.value?.focus();
};

// Watch for props changes
watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        nextTick(() => {
            open();
            if (activeTab.value === 'models') {
                focusSearch();
            }
        });
    } else {
        close();
    }
});

watch(() => props.initialTab, (newVal) => {
    activeTab.value = newVal;
});

watch(() => props.currentModel, (newVal) => {
    if (newVal) {
        selectedModel.value = newVal;
    }
});

// Lifecycle hooks
onMounted(() => {
    // Log for debugging
    console.log('SettingsModal mounted', {
        isOpen: props.isOpen,
        activeTab: activeTab.value
    });

    if (props.isOpen) {
        nextTick(() => {
            open();
        });
    }

    // Initialize models for current provider
    if (!modelStore.hasModels(activeProvider.value)) {
        modelStore.initializeProvider(activeProvider.value);
    }
});
</script>

<style scoped>
.settings-modal::backdrop {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
}

/* Transition animations */
.slide-fade-enter-active,
.slide-fade-leave-active {
    transition: all 0.3s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translateY(-10px);
    opacity: 0;
}

.notification-enter-active,
.notification-leave-active {
    transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.notification-enter-from,
.notification-leave-to {
    transform: translateY(20px);
    opacity: 0;
}

/* Custom scrollbar styling */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 10px;
}

::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);
}

/* Better tab styling */
.tab-active {
    background-color: var(--p);
    color: var(--pc);
}
</style>