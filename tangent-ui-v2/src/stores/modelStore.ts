import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ModelInfo } from '@/types/model';

export const useModelStore = defineStore('models', () => {
    const ollamaModels = ref<ModelInfo[]>([]);
    const openRouterModels = ref<ModelInfo[]>([]);
    const googleModels = ref<ModelInfo[]>([]);
    const anthropicModels = ref<ModelInfo[]>([]);
    const openaiModels = ref<ModelInfo[]>([]);
    const selectedModel = ref<ModelInfo | null>(
        localStorage.getItem('selectedModel')
            ? JSON.parse(localStorage.getItem('selectedModel')!)
            : null
    );

    const loading = ref({
        ollama: false,
        openrouter: false,
        google: false,
        anthropic: false,
        openai: false,
        custom: false,
    });

    // Add a filter state
    const modelFilter = ref<'all' | 'free' | 'paid'>('all'); // 'all', 'free', 'paid'

      // Initialize (fetch) models for a specific provider
    const initializeProvider = async (provider: string) => {
      loading.value[provider] = true;
      try{
        switch (provider) {
          case 'ollama':
            await fetchOllamaModels();
            break;
          case 'openrouter':
            await fetchOpenRouterModels();
            break;
          case 'google':
            await fetchGoogleModels();
            break;
          case 'anthropic':
            // await fetchAnthropicModels()
            break;
          case 'openai':
            // await fetchOpenAiModels();
            break;
        }
      } finally {
        loading.value[provider] = false;
      }
    }
    const initialize = async () => {
        // This can stay empty, or you can use it for other initialization
    };

    const hasModels = (provider: string) => {
        switch (provider) {
            case 'ollama':
                return ollamaModels.value.length > 0;
            case 'openrouter':
                return openRouterModels.value.length > 0;
            case 'google':
                return googleModels.value.length > 0;
            case 'anthropic':
                return anthropicModels.value.length > 0;
            case 'openai':
                return openaiModels.value.length > 0;
            default:
                return false;
        }
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
                    source: 'ollama' as const,
                    isFree: true, // Assume Ollama models are free (locally hosted)
                }));
            }
        } catch (error) {
            console.error('Error fetching Ollama models:', error);
            ollamaModels.value = [];
        }
    };

  const fetchOpenRouterModels = async () => {
    const apiKey = localStorage.getItem('openRouterApiKey');
    if (!apiKey) {
        console.log('No OpenRouter API key found');
        return;
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Tangent',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`OpenRouter API error (${response.status}):`, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        openRouterModels.value = data.data.map((model: any) => ({
            id: model.id,
            name: model.name.split(':')[1]?.trim() || model.name,
            source: 'openrouter' as const,
            provider: model.name.split(':')[0],
            description: model.description,
            // Correctly determine if the model is free based on pricing
            isFree: model.pricing && model.pricing.prompt === 0 && model.pricing.completion === 0,
        }));
    } catch (error) {
        console.error('Error fetching OpenRouter models:', error);
        openRouterModels.value = [];
    }
};

const fetchGoogleModels = async () => {
    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey) {
        console.log('No Gemini API key found');
        return;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        googleModels.value = data.models
            .filter((model: any) => model.name.includes('gemini'))
            .map((model: any) => {
                // Determine if it's free based on the model name/ID and the pricing information
                let isFree = false;
                // Explicitly list free models based on the provided documentation
                if (model.name === 'models/gemini-2.0-flash-lite-preview-0514' ||
                    model.name === 'models/gemini-1.5-flash-002' ||
                    model.name === 'models/gemini-1.5-flash-8b-001' ||
                    model.name === 'models/text-embedding-004'
                    ) {
                    isFree = true;
                }
              
                return {
                    id: model.name,
                    name: model.displayName,
                    source: 'google' as const,
                    description: model.description,
                    version: model.version,
                    inputTokenLimit: model.inputTokenLimit,
                    outputTokenLimit: model.outputTokenLimit,
                    temperature: model.temperature,
                    supportedGenerationMethods: model.supportedGenerationMethods,
                    isFree: isFree,
                };
            })
            .sort((a: ModelInfo, b: ModelInfo) => {
                const aIsExp = a.version?.includes('exp') || false;
                const bIsExp = b.version?.includes('exp') || false;
                if (aIsExp !== bIsExp) return aIsExp ? 1 : -1;
                return b.name.localeCompare(a.name);
            });

    } catch (error) {
        console.error('Error fetching Google models:', error);
        googleModels.value = [];
    }
};

    // Get filtered models based on provider, search query, and free/paid filter
    const getFilteredModels = (provider: string, searchQuery: string) => {
        const query = searchQuery.toLowerCase();
        let models: ModelInfo[] = [];

        switch (provider) {
            case 'ollama':
                models = ollamaModels.value;
                break;
            case 'openrouter':
                models = openRouterModels.value;
                break;
            case 'google':
                models = googleModels.value;
                break;
            case 'anthropic':
                models = anthropicModels.value;
                break;
            case 'openai':
                models = openaiModels.value;
                break;
            default:
                return [];
        }

        // Apply free/paid filter
        if (modelFilter.value === 'free') {
            models = models.filter(model => model.isFree);
        } else if (modelFilter.value === 'paid') {
            models = models.filter(model => !model.isFree);
        }
        // Apply the search query
        return models.filter(model =>
            model.name.toLowerCase().includes(query) ||
            model.description?.toLowerCase().includes(query) ||
            model.provider?.toLowerCase().includes(query)
        );
    };

    const setSelectedModel = (model: ModelInfo) => {
        selectedModel.value = model;
        try {
            localStorage.setItem('selectedModel', JSON.stringify(model));
            localStorage.setItem('modelType', model.source);
        } catch (e) {
            console.error('Error storing model:', e);
        }
    };

    const selectedModelCapabilities = computed(() => {
        if (!selectedModel.value) return null;

        return {
            supportsVision: selectedModel.value.name.toLowerCase().includes('vision'),
            supportsChat: selectedModel.value.supportedGenerationMethods?.includes('generateContent') || false,
            maxInputTokens: selectedModel.value.inputTokenLimit || 0,
            maxOutputTokens: selectedModel.value.outputTokenLimit || 0
        };
    });

    return {
        selectedModel,
        ollamaModels,
        openRouterModels,
        googleModels,
        anthropicModels,
        openaiModels,
        initialize,
        initializeProvider,
        getFilteredModels,
        setSelectedModel,
        selectedModelCapabilities,
        loading,
        hasModels,
        modelFilter, // Expose the filter
    };
});