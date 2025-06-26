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
    
    // Ollama-specific state
    const selectedVisionModel = ref<string>(
        localStorage.getItem('selectedVisionModel') || ''
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
        try {
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
                    await fetchAnthropicModels();
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

    // Updated to use backend API
    const fetchAnthropicModels = async () => {
        const apiKey = localStorage.getItem('anthropicApiKey');
        if (!apiKey) {
            console.log('No Anthropic API key found');
            return;
        }

        try {
            const response = await fetch('http://127.0.0.1:5050/api/models/anthropic', {
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`Anthropic API error (${response.status}):`, errorData);
                throw new Error(`API error! status: ${response.status}`);
            }

            const data = await response.json();
            anthropicModels.value = data.data.map((model: any) => ({
                id: model.id,
                name: model.display_name || model.id,
                source: 'anthropic' as const,
                provider: 'Anthropic',
                description: `Anthropic's ${model.display_name || model.id} model`,
                // All Anthropic models are paid
                isFree: false,
                createdAt: model.created_at
            }));
        } catch (error) {
            console.error('Error fetching Anthropic models:', error);
            anthropicModels.value = [];
        }
    };

    // Updated to use backend API
    const fetchOpenRouterModels = async () => {
        const apiKey = localStorage.getItem('openRouterApiKey');
        if (!apiKey) {
            console.log('No OpenRouter API key found');
            return;
        }

        try {
            const response = await fetch('http://127.0.0.1:5050/api/models/openrouter', {
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`OpenRouter API error (${response.status}):`, errorData);
                throw new Error(`API error! status: ${response.status}`);
            }

            const data = await response.json();
            openRouterModels.value = data.data.map((model: any) => ({
                id: model.id,
                name: model.name.split(':')[1]?.trim() || model.name,
                source: 'openrouter' as const,
                provider: model.name.split(':')[0],
                description: model.description,
                // Correctly determine if the model is free based on pricing (handle both string and number values)
                isFree: model.pricing && 
                    (model.pricing.prompt === 0 || model.pricing.prompt === "0") && 
                    (model.pricing.completion === 0 || model.pricing.completion === "0"),
                // Check for vision capabilities based on architecture
                supportsVision: model.architecture?.input_modalities?.includes('image') || false,
                // Add additional metadata
                inputTokenLimit: model.context_length || 4096,
                architecture: model.architecture,
                parameterSize: model.name.toLowerCase().match(/(\d+)b/)?.[1] || null,
            }));
        } catch (error) {
            console.error('Error fetching OpenRouter models:', error);
            openRouterModels.value = [];
        }
    };

    // Updated to use backend API
    const fetchGoogleModels = async () => {
        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            console.log('No Gemini API key found');
            return;
        }

        try {
            const response = await fetch('http://127.0.0.1:5050/api/models/google', {
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            googleModels.value = data.models
                .filter((model: any) => model.name.includes('gemini'))
                .map((model: any) => {
                    // Determine if it's free based on the model name/ID
                    let isFree = false;
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

    // Keep local Ollama calls since they don't have CORS issues
    const fetchOllamaModels = async () => {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (Array.isArray(data.models)) {
                // Fetch detailed info for each model to get context length
                const modelsWithDetails = await Promise.all(
                    data.models.map(async (model: any) => {
                        // Enhanced vision detection logic
                        const modelName = model.name.toLowerCase();
                        const isVisionCapable = modelName.includes('vision') ||
                                              modelName.includes('llava') ||
                                              modelName.includes('moondream') ||
                                              modelName.includes('qwen') ||
                                              modelName.includes('granite') ||
                                              modelName.includes('gemma');

                        let inputTokenLimit = 4096; // Default fallback

                        try {
                            // Fetch detailed model information
                            const detailResponse = await fetch('http://localhost:11434/api/show', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ model: model.name })
                            });

                            if (detailResponse.ok) {
                                const detailData = await detailResponse.json();
                                // Extract context length from model info
                                const contextLength = detailData.model_info?.['llama.context_length'] || 
                                                    detailData.model_info?.['general.context_length'];
                                if (contextLength) {
                                    inputTokenLimit = contextLength;
                                }
                            }
                        } catch (error) {
                            console.warn(`Failed to fetch details for ${model.name}:`, error);
                        }

                        return {
                            id: model.name,
                            name: model.name,
                            source: 'ollama' as const,
                            isFree: true, // Assume Ollama models are free (locally hosted)
                            provider: 'Ollama',
                            supportsVision: isVisionCapable,
                            description: model.details?.family || model.name,
                            size: model.size,
                            modified_at: model.modified_at,
                            inputTokenLimit: inputTokenLimit
                        };
                    })
                );
                
                ollamaModels.value = modelsWithDetails;
            }
        } catch (error) {
            console.error('Error fetching Ollama models:', error);
            ollamaModels.value = [];
        }
    };

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

        // Use the enhanced vision detection logic
        const modelName = selectedModel.value.name.toLowerCase();
        const isVisionCapable = selectedModel.value.supportsVision ||
                              modelName.includes('vision') ||
                              modelName.includes('llava') ||
                              modelName.includes('moondream') ||
                              modelName.includes('qwen') ||
                              modelName.includes('granite') ||
                              modelName.includes('gemma');

        return {
            supportsVision: isVisionCapable,
            supportsChat: selectedModel.value.supportedGenerationMethods?.includes('generateContent') || true,
            maxInputTokens: selectedModel.value.inputTokenLimit || 0,
            maxOutputTokens: selectedModel.value.outputTokenLimit || 0
        };
    });

    // Ollama-specific methods
    const setOllamaModels = (models: any[]) => {
        ollamaModels.value = models.map((model: any) => ({
            id: model.name,
            name: model.name,
            source: 'ollama' as const,
            isFree: true,
            provider: 'Ollama',
            supportsVision: model.has_vision || false,
            description: model.metadata?.description || model.details?.family || model.name,
            size: model.size,
            modified_at: model.modified_at,
            metadata: model.metadata,
            has_vision: model.has_vision,
            has_completion: model.has_completion,
            has_embedding: model.has_embedding,
            inputTokenLimit: model.inputTokenLimit || model.metadata?.context_length || 4096
        }));
    };
    
    const setSelectedVisionModel = (modelName: string) => {
        selectedVisionModel.value = modelName;
        localStorage.setItem('selectedVisionModel', modelName);
    };
    
    const getVisionModels = computed(() => {
        return ollamaModels.value.filter(model => model.supportsVision || model.has_vision);
    });
    
    const getSmallestVisionModel = computed(() => {
        const visionModels = getVisionModels.value;
        if (visionModels.length === 0) return null;
        return visionModels.reduce((smallest, model) => {
            if (!smallest || (model.size && smallest.size && model.size < smallest.size)) {
                return model;
            }
            return smallest;
        }, null);
    });

    return {
        selectedModel,
        ollamaModels,
        openRouterModels,
        googleModels,
        anthropicModels,
        openaiModels,
        selectedVisionModel,
        initialize,
        initializeProvider,
        getFilteredModels,
        setSelectedModel,
        selectedModelCapabilities,
        loading,
        hasModels,
        modelFilter,
        // Ollama-specific methods
        setOllamaModels,
        setSelectedVisionModel,
        getVisionModels,
        getSmallestVisionModel
    };
});