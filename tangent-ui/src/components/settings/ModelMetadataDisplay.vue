<template>
  <div class="model-metadata-display">
    <div v-if="loading" class="loading-state">
      <Loader class="w-3 h-3 animate-spin" />
      <span class="loading-text">Loading metadata...</span>
    </div>
    
    <div v-else-if="error" class="error-state">
      <AlertCircle class="w-3 h-3 text-red-400" />
      <span class="error-text">{{ error }}</span>
    </div>
    
    <div v-else-if="metadata" class="metadata-grid">
      <!-- Essential Model Information -->
      
      <!-- Parameter Size -->
      <div v-if="metadata.parameterSize" class="metadata-item">
        <span class="metadata-label">Parameters</span>
        <span class="metadata-value badge-primary">{{ metadata.parameterSize }}</span>
      </div>
      
      <!-- Quantization -->
      <div v-if="metadata.quantization" class="metadata-item">
        <span class="metadata-label">Quantization</span>
        <span class="metadata-value badge-secondary">{{ metadata.quantization }}</span>
      </div>
      
      <!-- Context Length -->
      <div v-if="metadata.contextLength" class="metadata-item">
        <span class="metadata-label">Context</span>
        <span class="metadata-value badge-accent">{{ formatContextLength(metadata.contextLength) }}</span>
      </div>
      
      <!-- File Size -->
      <div v-if="metadata.size" class="metadata-item">
        <span class="metadata-label">File Size</span>
        <span class="metadata-value">{{ formatFileSize(metadata.size) }}</span>
      </div>
      
      <!-- Architecture -->
      <div v-if="metadata.architecture" class="metadata-item">
        <span class="metadata-label">Architecture</span>
        <span class="metadata-value">{{ metadata.architecture }}</span>
      </div>
      
      <!-- Attention Heads (for technical users) -->
      <div v-if="metadata.headCount" class="metadata-item">
        <span class="metadata-label">Attention Heads</span>
        <span class="metadata-value">{{ formatNumber(metadata.headCount) }}</span>
      </div>
      
      <!-- Embedding Dimensions -->
      <div v-if="metadata.embeddingLength" class="metadata-item">
        <span class="metadata-label">Embedding Dim</span>
        <span class="metadata-value">{{ formatNumber(metadata.embeddingLength) }}</span>
      </div>
      
      <!-- Vocabulary Size -->
      <div v-if="metadata.vocabSize" class="metadata-item">
        <span class="metadata-label">Vocab Size</span>
        <span class="metadata-value">{{ formatNumber(metadata.vocabSize) }}</span>
      </div>
      
      <!-- Capabilities -->
      <div v-if="metadata.capabilities?.length" class="metadata-item">
        <span class="metadata-label">Capabilities</span>
        <div class="capabilities-badges">
          <span v-for="cap in metadata.capabilities.slice(0, 2)" :key="cap" 
                class="metadata-value badge-info">{{ cap }}</span>
        </div>
      </div>
      
      <!-- Model Family -->
      <div v-if="metadata.family" class="metadata-item">
        <span class="metadata-label">Family</span>
        <span class="metadata-value">{{ metadata.family }}</span>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <Info class="w-3 h-3 text-gray-400" />
      <span class="empty-text">No metadata available</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Loader, AlertCircle, Info } from 'lucide-vue-next';
import type { ModelInfo } from '@/types/model';

interface Props {
  model: ModelInfo;
}

const props = defineProps<Props>();

const loading = ref(false);
const error = ref<string | null>(null);
const metadata = ref<any>(null);

// Enhanced metadata fetching for different providers
const fetchModelMetadata = async () => {
  if (!props.model) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    if (props.model.source === 'ollama') {
      // Fetch detailed Ollama model information
      const response = await fetch('http://localhost:11434/api/show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: props.model.id })
      });
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract key metadata from various sources
      const extractedMetadata = {
        parameterSize: data.details?.parameter_size || extractParameterSize(data),
        quantization: data.details?.quantization_level || extractQuantization(data),
        contextLength: extractContextLength(data),
        size: data.size || extractSize(data),
        architecture: data.model_info?.['general.architecture'],
        headCount: data.model_info?.['llama.attention.head_count'],
        embeddingLength: data.model_info?.['llama.embedding_length'],
        vocabSize: data.model_info?.['llama.vocab_size'],
        family: data.details?.family || extractFamily(data),
        capabilities: data.capabilities || []
      };
      
      metadata.value = extractedMetadata;
    } else {
      // For other providers, use what we have from the model registry
      metadata.value = {
        name: props.model.name,
        parameterSize: props.model.parameterSize,
        size: props.model.size,
        family: props.model.family,
        capabilities: props.model.capabilities || [],
        provider: props.model.provider || props.model.source
      };
    }
  } catch (err: any) {
    console.error('Error fetching model metadata:', err);
    error.value = err.message || 'Failed to fetch metadata';
    
    // Fallback to basic model info
    metadata.value = {
      name: props.model.name,
      family: props.model.family,
      source: props.model.source
    };
  } finally {
    loading.value = false;
  }
};

// Helper functions to extract metadata from various response formats
const extractParameterSize = (data: any): string | null => {
  // Try various locations where parameter size might be stored
  return data.details?.parameter_size || 
         data.model_info?.['general.parameter_count'] ? 
         formatParameterCount(data.model_info['general.parameter_count']) : null;
};

const extractSize = (data: any): number | null => {
  return data.size || null;
};

const extractQuantization = (data: any): string | null => {
  return data.details?.quantization_level || 
         data.model_info?.['general.file_type'] ? 
         `Q${data.model_info['general.file_type']}` : null;
};

const extractFamily = (data: any): string | null => {
  return data.details?.family || 
         data.model_info?.['general.architecture'] || null;
};

const extractContextLength = (data: any): number | null => {
  return data.model_info?.['llama.context_length'] || 
         data.model_info?.['general.context_length'] || null;
};

const formatParameterCount = (count: number): string => {
  if (count >= 1e9) return `${(count / 1e9).toFixed(1)}B`;
  if (count >= 1e6) return `${(count / 1e6).toFixed(1)}M`;
  if (count >= 1e3) return `${(count / 1e3).toFixed(1)}K`;
  return count.toString();
};

const formatFileSize = (bytes: number): string => {
  if (!bytes) return '';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
};

const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

const formatContextLength = (tokens: number): string => {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M tokens`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K tokens`;
  }
  return `${tokens} tokens`;
};

// Estimate response time based on model characteristics
const estimateResponseTime = (metadata: any): string => {
  if (!metadata) return 'Unknown';
  
  const paramSize = parseFloat(metadata.parameterSize || '0');
  const quantization = metadata.quantization || '';
  const architecture = metadata.architecture || metadata.family || '';
  
  // Base response time estimation (in seconds for typical queries)
  let baseTime = 0;
  
  // Parameter size impact
  if (paramSize <= 1) baseTime = 0.5;        // Very small models
  else if (paramSize <= 3) baseTime = 1.0;   // Small models (1B-3B)
  else if (paramSize <= 7) baseTime = 2.0;   // Medium models (3B-7B)
  else if (paramSize <= 13) baseTime = 4.0;  // Large models (7B-13B)
  else if (paramSize <= 30) baseTime = 8.0;  // Very large models (13B-30B)
  else baseTime = 15.0;                      // Huge models (30B+)
  
  // Quantization impact (lower quantization = faster)
  if (quantization.includes('Q2')) baseTime *= 0.6;      // Very fast
  else if (quantization.includes('Q3')) baseTime *= 0.7;  // Fast
  else if (quantization.includes('Q4')) baseTime *= 0.8;  // Balanced
  else if (quantization.includes('Q5')) baseTime *= 1.0;  // Default
  else if (quantization.includes('Q6')) baseTime *= 1.2;  // Slower
  else if (quantization.includes('Q8')) baseTime *= 1.5;  // Much slower
  
  // Architecture impact
  if (architecture.toLowerCase().includes('llama')) baseTime *= 1.0;      // Baseline
  else if (architecture.toLowerCase().includes('qwen')) baseTime *= 0.9;   // Slightly faster
  else if (architecture.toLowerCase().includes('mistral')) baseTime *= 0.8; // Faster
  
  // Format the time
  if (baseTime < 1) {
    return `~${Math.round(baseTime * 1000)}ms`;
  } else if (baseTime < 10) {
    return `~${baseTime.toFixed(1)}s`;
  } else {
    return `~${Math.round(baseTime)}s`;
  }
};

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
};

const getProviderName = (source: string): string => {
  const providerNames = {
    ollama: 'Ollama',
    openrouter: 'OpenRouter',
    anthropic: 'Anthropic',
    google: 'Google',
    openai: 'OpenAI',
    custom: 'Custom'
  };
  return providerNames[source] || source;
};

// Watch for model changes
watch(() => props.model, fetchModelMetadata, { immediate: true });

onMounted(() => {
  if (props.model) {
    fetchModelMetadata();
  }
});
</script>

<style scoped>
.model-metadata-display {
  font-size: 0.75rem;
  margin-top: 0.5rem;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem;
  opacity: 0.7;
}

.loading-text,
.error-text,
.empty-text {
  font-size: 0.65rem;
}

.error-text {
  color: rgb(248, 113, 113);
}

.metadata-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.375rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  min-height: 1.25rem;
}

.metadata-label {
  font-weight: 600;
  opacity: 0.8;
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  flex-shrink: 0;
  min-width: 60px;
}

.metadata-value {
  font-size: 0.65rem;
  text-align: right;
  word-break: break-word;
  flex: 1;
}

.capabilities-badges {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* Badge styles */
.badge-primary {
  background: rgba(59, 130, 246, 0.2);
  color: rgba(59, 130, 246, 0.9);
  padding: 0.125rem 0.375rem;
  border-radius: 8px;
  font-weight: 500;
}

.badge-secondary {
  background: rgba(34, 197, 94, 0.2);
  color: rgba(34, 197, 94, 0.9);
  padding: 0.125rem 0.375rem;
  border-radius: 8px;
  font-weight: 500;
}

.badge-accent {
  background: rgba(168, 85, 247, 0.2);
  color: rgba(168, 85, 247, 0.9);
  padding: 0.125rem 0.375rem;
  border-radius: 8px;
  font-weight: 500;
}

.badge-info {
  background: rgba(156, 163, 175, 0.2);
  color: rgba(156, 163, 175, 0.9);
  padding: 0.125rem 0.375rem;
  border-radius: 8px;
  font-weight: 500;
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
  .metadata-grid {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }
}
</style>