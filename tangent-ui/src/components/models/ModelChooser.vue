<template>
    <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div class="bg-base-100 p-6 rounded-lg shadow-xl w-[70vw] max-w-3xl">
            <h2 class="text-lg font-semibold mb-4">Choose a Model</h2>

            <!-- Search Input -->
            <div class="mb-4">
                <input type="text" v-model="searchQuery" placeholder="Search models..."
                    class="input input-bordered w-full" />
            </div>

            <!-- Model List -->
            <div class="overflow-y-auto max-h-[60vh]">
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

                <div v-if="filteredModels.length === 0" class="p-8 text-center text-gray-500">
                    <p class="text-sm">No models found matching your search.</p>
                </div>
            </div>

            <!-- Close Button -->
            <div class="mt-6">
                <button @click="$emit('close')" class="btn btn-block">Cancel</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Badge from './Badge.vue';  // Make sure this path is correct
import anthropic from '@/assets/anthropic.jpeg';
import openai from '@/assets/openai.jpeg';
import google from '@/assets/google.jpeg';
import meta from '@/assets/meta.jpeg';
import mistral from '@/assets/mistral.jpeg';
import unknownAvatar from '@/assets/unknown.jpeg';
import ollama from '@/assets/ollama.jpeg';

interface ModelInfo {
    id: string;
    name: string;
    source: 'ollama' | 'openrouter' | 'custom';
    provider?: string;
}

const props = defineProps({
    currentModel: {
        type: String,
        required: false, // Might not have a current model
    },
    availableModels: {
        type: Array as () => ModelInfo[],
        required: true,
    },
});

const emit = defineEmits(['select-model', 'close']);

const searchQuery = ref('');

const filteredModels = computed(() => {
    const query = searchQuery.value.toLowerCase();
    return props.availableModels.filter(model =>
        model.name.toLowerCase().includes(query) ||
        (model.provider && model.provider.toLowerCase().includes(query))
    );
});

const selectModel = (model: ModelInfo) => {
    emit('select-model', model);
};
const providerAvatars: Record<string, string> = {
    Anthropic: anthropic,
    OpenAI: openai,
    Google: google,
    Meta: meta,
    Mistral: mistral,
    Unknown: unknownAvatar,
    ollama: ollama,
};
const getAvatarUrl = (model?: ModelInfo): string => {
    if (!model) return providerAvatars['Unknown'];
    if (model.source === 'ollama') {
        return providerAvatars['ollama'];
    }
    const avatar = model.provider ? providerAvatars[model.provider] : providerAvatars['Unknown'];
    return avatar || providerAvatars['Unknown'];
};

const getProviderName = (source: string) => {
    switch (source) {
        case 'ollama': return 'Local';
        case 'openrouter': return 'Cloud';
        case 'google': return 'Google';
        case 'anthropic': return 'Anthropic';
        case 'openai': return 'OpenAI';
        case 'custom': return 'Custom';
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
        case 'custom': return 'secondary';
        default: return 'default';
    }
};
</script>