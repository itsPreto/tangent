export interface ModelInfo {
    id: string;
    name: string;
    source: 'ollama' | 'openrouter' | 'google' | 'anthropic' | 'openai';
    description?: string;
    provider?: string;
    version?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    temperature?: number;
    supportedGenerationMethods?: string[];
    isFree?: boolean;
    supportsVision?: boolean;
    size?: number;
    modified_at?: string;
}

export interface ModelParameters {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
}