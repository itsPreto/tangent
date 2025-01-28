import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface Model {
    id: string;
    name: string;
    source: 'ollama' | 'openrouter' | 'google';
    description?: string;
    provider?: string;
    version?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    temperature?: number;
    supportedGenerationMethods?: string[];
}

export const useModelStore = defineStore('models', () => {
    // State
    const ollamaModels = ref<Model[]>([]);
    const openRouterModels = ref<Model[]>([]);
    const googleModels = ref<Model[]>([]);
    const selectedModel = ref<Model | null>(
        localStorage.getItem('selectedModel')
            ? JSON.parse(localStorage.getItem('selectedModel')!)
            : null
    );

    const initialize = async () => {
        await Promise.all([
            fetchOllamaModels(),
            fetchOpenRouterModels(),
            fetchGoogleModels()
        ]);
    };


    // Fetch models from respective APIs
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
        const apiKey = localStorage.getItem('openRouterApiKey');
        if (!apiKey) return;

        try {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
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
                description: model.description
            }));
        } catch (error) {
            console.error('Error fetching OpenRouter models:', error);
            openRouterModels.value = [];
        }
    };

    const fetchGoogleModels = async () => {
        // Use geminiApiKey to match the component
        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            console.log('No Gemini API key found');
            return;
        }

        try {
            console.log('Fetching Google models...');
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received models:', data.models?.length || 0);

            // Filter out non-Gemini models and transform the data
            googleModels.value = data.models
                .filter((model: any) => model.name.includes('gemini'))
                .map((model: any) => ({
                    id: model.name,
                    name: model.displayName,
                    source: 'google' as const,
                    description: model.description,
                    version: model.version,
                    inputTokenLimit: model.inputTokenLimit,
                    outputTokenLimit: model.outputTokenLimit,
                    temperature: model.temperature,
                    supportedGenerationMethods: model.supportedGenerationMethods
                }))
                .sort((a: Model, b: Model) => {
                    const aIsExp = a.version?.includes('exp') || false;
                    const bIsExp = b.version?.includes('exp') || false;
                    if (aIsExp !== bIsExp) return aIsExp ? 1 : -1;
                    return b.name.localeCompare(a.name);
                });

            console.log('Processed Gemini models:', googleModels.value.length);
        } catch (error) {
            console.error('Error fetching Google models:', error);
            googleModels.value = [];
        }
    };

    // Get filtered models based on provider and search query
    const getFilteredModels = (provider: string, searchQuery: string) => {
        const query = searchQuery.toLowerCase();
        let models: Model[] = [];

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
        }

        return models.filter(model =>
            model.name.toLowerCase().includes(query) ||
            model.description?.toLowerCase().includes(query) ||
            model.provider?.toLowerCase().includes(query)
        );
    };

    // Set selected model and persist to localStorage
    const setSelectedModel = (model: Model) => {
        selectedModel.value = model;
        try {
            localStorage.setItem('selectedModel', JSON.stringify(model));
            localStorage.setItem('modelType', model.source);
        } catch (e) {
            console.error('Error storing model:', e);
        }
    };

    // Computed property to get the current model's capabilities
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
        initialize,
        getFilteredModels,
        setSelectedModel,
        selectedModelCapabilities
    };
});