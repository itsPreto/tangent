<template>
    <div class="media-branch-node" :class="{ 'processing': isProcessing }">
        <BranchNode 
            :node="props.node" 
            :is-selected="isSelected" 
            :selected-model="selectedModel"
            :modelType="modelType"
            :open-router-api-key="openRouterApiKey" 
            :zoom="zoom" 
            :model-registry="modelRegistry"
            :is-side-panel-open="isSidePanelOpen"
            @select="$emit('select')" 
            @drag-start="(e, node) => $emit('drag-start', e, node)"
            @create-branch="(parentId, index, pos, data) => $emit('create-branch', parentId, index, pos, data)"
            @update-title="(id, title) => $emit('update-title', id, title)"
            @resend="messageIndex => $emit('resend', messageIndex)" 
            @delete="$emit('delete')"
            @send="handleMessageSend">
            <template #default>
                <!-- Media thumbnail header - shown immediately when image is dropped -->
                <div v-if="mediaContent && isImage" class="media-thumbnail-header relative overflow-hidden cursor-pointer" @click="openImageModal">
                    <div class="absolute inset-0">
                        <img 
                            :src="mediaUrl" 
                            class="w-full h-full object-cover"
                            :alt="mediaContent.filename" />
                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                    </div>
                    <div class="relative z-10 p-3 pt-20">
                        <div class="text-white">
                            <p class="text-xs opacity-80">{{ mediaContent.mime_type }}</p>
                            <!-- Processing status overlay -->
                            <div v-if="showProcessingStatus" class="flex items-center gap-2 mt-1">
                                <div class="loading loading-spinner loading-xs"></div>
                                <span class="text-xs">
                                    <span v-if="isProcessing">Processing...</span>
                                    <span v-else-if="isAutoCaptioning">Generating caption...</span>
                                    <span v-else if="isGeneratingTitle">Generating title...</span>
                                    <span v-else>Processing...</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <!-- Click indicator -->
                    <div class="absolute top-2 right-2 bg-white/20 backdrop-blur-sm rounded-full p-1.5">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                    </div>
                </div>

                <!-- Full media preview for videos and detailed view -->
                <div v-if="mediaContent && isVideo" class="media-preview p-4 border-b border-base-300">
                    <!-- Video preview -->
                    <video controls class="max-w-full h-auto rounded-lg">
                        <source :src="mediaUrl" :type="mediaContent.mime_type">
                        Your browser does not support the video tag.
                    </video>

                    <!-- Media info -->
                    <div class="mt-2 text-sm text-base-content/70">
                        <span class="font-medium">{{ mediaContent.filename }}</span>
                        <span class="ml-2 px-2 py-1 bg-base-200 rounded text-xs">{{ mediaContent.type }}</span>
                    </div>
                    
                    <!-- Processing status for videos -->
                    <div v-if="showProcessingStatus" class="mt-4 text-sm text-base-content/60">
                        <div class="flex items-center gap-2">
                            <div class="loading loading-spinner loading-sm"></div>
                            <span v-if="isProcessing">Processing media...</span>
                            <span v-else-if="isAutoCaptioning">Generating caption...</span>
                            <span v-else>Processing media...</span>
                        </div>
                    </div>
                </div>
                
                <!-- Error and action section -->
                <div v-if="autoCaptionError || (isImage && mediaContent?.analysis && !isAutoCaptioning)" class="p-3 border-b border-base-300/50">
                    <!-- Auto-caption error -->
                    <div v-if="autoCaptionError" class="p-2 bg-error/10 border border-error/20 rounded text-sm text-error mb-2">
                        <div class="flex items-center gap-2">
                            <span class="text-error">⚠️</span>
                            <span>{{ autoCaptionError }}</span>
                        </div>
                    </div>
                    
                    <!-- Regenerate caption button for images -->
                    <div v-if="isImage && mediaContent?.analysis && !isAutoCaptioning">
                        <button 
                            @click="regenerateCaption" 
                            class="btn btn-xs btn-ghost opacity-60 hover:opacity-100"
                            title="Regenerate caption">
                            🔄 Regenerate Caption
                        </button>
                    </div>
                </div>

                <!-- Chat messages will be rendered by BranchNode -->
            </template>
        </BranchNode>
        
        <!-- Image Modal -->
        <Teleport to="body">
            <div v-if="showImageModal" class="fixed inset-0 z-50 flex items-center justify-center" @click="showImageModal = false">
                <!-- Background dim -->
                <div class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
                
                <!-- Modal content -->
                <div class="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center" @click.stop>
                    <img 
                        v-if="mediaContent && isImage"
                        :src="mediaUrl" 
                        class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        :alt="mediaContent.filename" />
                    
                    <!-- Close button -->
                    <button 
                        @click="showImageModal = false"
                        class="absolute top-4 right-4 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full p-2 transition-colors">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                    
                    <!-- Image info -->
                    <div class="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
                        <p class="text-sm font-medium">{{ mediaContent?.filename }}</p>
                        <p class="text-xs opacity-80 mt-1">{{ mediaContent?.mime_type }}</p>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import BranchNode from './BranchNode.vue';
import type { PropType } from 'vue';
import type { Node } from '../../../types/message';
import { autoCaptionService, type CaptionResult } from '@/services/autoCaptionService';
import { useModelStore } from '@/stores/modelStore';

// Enhanced types to support media chat
interface MediaContent {
    media_id: string;
    filename: string;
    mime_type: string;
    analysis: string;
    type: 'image' | 'video';
    previewUrl?: string;
}

interface MediaNode extends Node {
    mediaContent?: MediaContent;
}

interface ModelInfo {
    id: string;
    name: string;
    source: 'ollama' | 'openrouter' | 'custom';
    provider?: string;
}

// Props
const props = defineProps({
    node: {
        type: Object as PropType<MediaNode>,
        required: true
    },
    isSelected: {
        type: Boolean,
        required: true
    },
    selectedModel: {
        type: String,
        required: true
    },
    modelType: {
        type: String,
        required: true
    },
    openRouterApiKey: {
        type: String,
        required: true
    },
    zoom: {
        type: Number,
        required: true
    },
    modelRegistry: {
        type: Object as PropType<Map<string, ModelInfo>>,
        required: true
    },
    isSidePanelOpen: {
        type: Boolean,
        required: true
    }
});

// Emits
const emit = defineEmits<{
    (e: 'select'): void;
    (e: 'drag-start', event: MouseEvent, node: MediaNode): void;
    (e: 'create-branch', parentId: string, messageIndex: number, position: { x: number, y: number }, initialData: any): void;
    (e: 'update-title', id: string, title: string): void;
    (e: 'resend', messageIndex: number): void;
    (e: 'delete'): void;
}>();

// Stores
const modelStore = useModelStore();

// State
const isProcessing = ref(false);
const isAutoCaptioning = ref(false);
const isGeneratingTitle = ref(false);
const autoCaptionError = ref<string | null>(null);
const showImageModal = ref(false);
const mediaContent = computed(() => props.node.mediaContent);
const isImage = computed(() => mediaContent.value?.mime_type.startsWith('image/'));
const isVideo = computed(() => mediaContent.value?.mime_type.startsWith('video/'));
const mediaUrl = computed(() => 
    mediaContent.value
        ? mediaContent.value.previewUrl || `http://127.0.0.1:5050/media/${mediaContent.value.media_id}`
        : null
);

// Computed to determine if we should show processing status
const showProcessingStatus = computed(() => {
    // Show if any local processing flags are true
    if (isProcessing.value || isAutoCaptioning.value || isGeneratingTitle.value) {
        return true;
    }
    
    // Show if node processing flag is true AND we don't have a completed analysis
    if (props.node.isProcessingMedia) {
        const analysis = mediaContent.value?.analysis;
        // Don't show processing if we have a real analysis (not the default "Processing..." text)
        if (analysis && 
            analysis !== 'Processing...' && 
            analysis !== 'Processing media...' && 
            analysis !== 'Generating caption...') {
            return false;
        }
        return true;
    }
    
    return false;
});


const processMedia = async (file: File, apiType: string, apiKey?: string) => {
  isProcessing.value = true;
  
  try {
    // Check if we should use auto-captioning for images
    const settings = autoCaptionService.getSettings();
    const shouldAutoCaption = settings.enabled && 
                              file.type.startsWith('image/') && 
                              settings.model &&
                              settings.model.trim() !== '';
    
    console.log('[MediaBranchNode] Processing media:', {
      fileName: file.name,
      fileType: file.type,
      apiType,
      autoCaptionEnabled: settings.enabled,
      selectedModel: settings.model,
      shouldAutoCaption,
      settings: settings
    });
    
    if (shouldAutoCaption) {
      // Use auto-captioning service instead of the backend
      console.log('[MediaBranchNode] Using auto-captioning service');
      await processImageWithAutoCaption(file);
      return;
    } else {
      console.log('[MediaBranchNode] Auto-captioning not available, using backend fallback');
    }
    
    // Fallback to existing backend processing
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_type', apiType);
    formData.append('model', props.selectedModel);
    if (apiKey) formData.append('api_key', apiKey);

    const response = await fetch('http://127.0.0.1:5050/process-media', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to process media');
    }

    const result = await response.json();
    console.log('[MediaBranchNode] Backend response:', result);
    
    // Update node with media content
    props.node.mediaContent = result;
    
    // Add initial analysis message
    if (!props.node.messages) {
      props.node.messages = [];
    }
    
    props.node.messages.push({
      role: 'assistant',
      content: result.analysis || 'Image processed successfully.',
      timestamp: new Date().toISOString()
    });
    
    console.log('[MediaBranchNode] Backend processing complete');

  } catch (error) {
    console.error('[MediaBranchNode] Media processing error:', error);
    
    // Ensure UI shows error state
    if (props.node.mediaContent) {
      props.node.mediaContent.analysis = 'Processing failed';
    }
    
    throw error;
  } finally {
    isProcessing.value = false;
    console.log('[MediaBranchNode] Processing state reset, isProcessing:', isProcessing.value);
  }
};

// New auto-captioning method
const processImageWithAutoCaption = async (file: File) => {
  isAutoCaptioning.value = true;
  autoCaptionError.value = null;
  
  try {
    // Create media content object
    const mediaId = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const previewUrl = URL.createObjectURL(file);
    
    props.node.mediaContent = {
      media_id: mediaId,
      filename: file.name,
      mime_type: file.type,
      type: 'image',
      analysis: 'Generating caption...',
      previewUrl
    };
    
    // Generate caption
    const result: CaptionResult = await autoCaptionService.captionFile(file);
    
    if (result.success && result.caption) {
      // Update with successful caption
      props.node.mediaContent.analysis = result.caption;
      
      // Add initial message with caption
      props.node.messages = [{
        role: 'assistant',
        content: result.caption,
        timestamp: new Date().toISOString()
      }];
      
      console.log(`[MediaBranchNode] Auto-caption generated in ${result.responseTime}ms using ${result.model}`);
      console.log(`[MediaBranchNode] Caption: "${result.caption.substring(0, 100)}..."`);
    } else {
      // Handle caption failure
      const errorMsg = result.error || 'Failed to generate caption';
      autoCaptionError.value = errorMsg;
      
      console.error(`[MediaBranchNode] Auto-caption failed:`, errorMsg);
      
      props.node.mediaContent.analysis = 'Caption generation failed';
      props.node.messages = [{
        role: 'assistant',
        content: `Image uploaded successfully, but automatic captioning failed: ${errorMsg}. You can still chat about this image.`,
        timestamp: new Date().toISOString()
      }];
    }
    
  } catch (error) {
    console.error('[MediaBranchNode] Auto-caption error:', error);
    autoCaptionError.value = error instanceof Error ? error.message : 'Unknown error';
    
    if (props.node.mediaContent) {
      props.node.mediaContent.analysis = 'Caption generation failed';
      props.node.messages = [{
        role: 'assistant',
        content: 'Image uploaded successfully. Automatic captioning encountered an error, but you can still chat about this image.',
        timestamp: new Date().toISOString()
      }];
    }
  } finally {
    isAutoCaptioning.value = false;
  }
};

// Method to regenerate caption
const regenerateCaption = async () => {
  if (!mediaContent.value || !isImage.value) return;
  
  isAutoCaptioning.value = true;
  autoCaptionError.value = null;
  
  try {
    let result: CaptionResult;
    
    if (mediaContent.value.previewUrl) {
      // Use preview URL if available
      result = await autoCaptionService.captionUrl(mediaContent.value.previewUrl);
    } else {
      // Use media URL
      const url = `http://127.0.0.1:5050/media/${mediaContent.value.media_id}`;
      result = await autoCaptionService.captionUrl(url);
    }
    
    if (result.success && result.caption) {
      // Update analysis
      mediaContent.value.analysis = result.caption;
      
      // Add regeneration message
      props.node.messages.push({
        role: 'assistant',
        content: `[Updated caption] ${result.caption}`,
        timestamp: new Date().toISOString()
      });
    } else {
      autoCaptionError.value = result.error || 'Failed to regenerate caption';
    }
    
  } catch (error) {
    console.error('Caption regeneration error:', error);
    autoCaptionError.value = error instanceof Error ? error.message : 'Unknown error';
  } finally {
    isAutoCaptioning.value = false;
  }
};

// New method to handle follow-up messages
const handleMessageSend = async (message: string) => {
    if (!props.node.mediaContent?.media_id) {
        console.error('No media ID found');
        return;
    }

    try {
        // Add user message to the chat
        props.node.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });

        // Send follow-up request to backend
        const response = await fetch('http://127.0.0.1:5050/chat-follow-up', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                media_id: props.node.mediaContent.media_id,
                message: message,
                api_key: props.openRouterApiKey
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get response');
        }

        const result = await response.json();

        // Add AI response to the chat
        props.node.messages.push({
            role: 'assistant',
            content: result.response,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in chat follow-up:', error);
        // Add error message to chat
        props.node.messages.push({
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your message.',
            timestamp: new Date().toISOString()
        });
    }
};

// Auto-caption on mount if image is already present
onMounted(async () => {
  // Reset processing states on mount
  isProcessing.value = false;
  isAutoCaptioning.value = false;
  
  // If there's already an image without analysis, try to auto-caption it
  if (mediaContent.value && 
      isImage.value && 
      (!mediaContent.value.analysis || 
       mediaContent.value.analysis === 'Processing media...' ||
       mediaContent.value.analysis === 'Processing...')) {
    
    const settings = autoCaptionService.getSettings();
    if (settings.enabled && settings.model) {
      console.log('[MediaBranchNode] Auto-captioning existing image on mount');
      await regenerateCaption();
    }
  }
  
  console.log('[MediaBranchNode] Mounted with mediaContent:', {
    hasMedia: !!mediaContent.value,
    isImage: isImage.value,
    analysis: mediaContent.value?.analysis,
    isProcessing: isProcessing.value,
    isAutoCaptioning: isAutoCaptioning.value,
    nodeProcessing: props.node.isProcessingMedia
  });
  
  // Debug: Watch for changes to isProcessingMedia
  setInterval(() => {
    if (props.node.isProcessingMedia !== undefined) {
      console.log('[MediaBranchNode] isProcessingMedia check:', {
        nodeProcessing: props.node.isProcessingMedia,
        localProcessing: isProcessing.value,
        autoCaptioning: isAutoCaptioning.value,
        analysis: mediaContent.value?.analysis
      });
    }
  }, 1000);
});

// Expose methods
defineExpose({
    processMedia,
    regenerateCaption,
    generateImageTitle
});
// Generate concise title for image using router model
const generateImageTitle = async (file: File): Promise<string> => {
  isGeneratingTitle.value = true;
  
  try {
    const base64Data = await fileToBase64(file);
    
    // Use the same model that the router service uses for vision tasks
    const routerModel = 'qwen2.5vl:3b';
    
    const titlePrompt = 'Generate a concise, descriptive title for this image in 3-5 words. Focus on the main subject or action. Respond with only the title, no additional text.';
    
    const response = await fetch('http://localhost:5050/api/ollama-proxy/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: routerModel,
        prompt: titlePrompt,
        images: [base64Data],
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 20
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to generate title: ${response.status}`);
    }
    
    const result = await response.json();
    const title = result.response?.trim() || '';
    
    // Clean up the title - remove quotes and extra punctuation
    const cleanTitle = title.replace(/["']/g, '').replace(/\.$/, '').trim();
    
    console.log(`[MediaBranchNode] Generated title: "${cleanTitle}"`);
    return cleanTitle || file.name;
    
  } catch (error) {
    console.error('[MediaBranchNode] Title generation error:', error);
    return file.name; // Fallback to filename
  } finally {
    isGeneratingTitle.value = false;
  }
};

// Convert file to base64 (duplicate of autoCaptionService method for independence)
const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Open image in modal view
const openImageModal = () => {
  showImageModal.value = true;
};
</script>

<style scoped>
.media-branch-node {
    position: relative;
}

.media-branch-node.processing::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.2rem;
}

.loading {
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.media-preview {
    position: relative;
    overflow: hidden;
    border-radius: 0.5rem;
}

.media-preview img,
.media-preview video {
    max-height: 400px;
    object-fit: contain;
    width: 100%;
}

.media-thumbnail-header {
    height: 120px;
    transition: opacity 0.2s ease;
}

.media-thumbnail-header:hover {
    opacity: 0.95;
}
</style>