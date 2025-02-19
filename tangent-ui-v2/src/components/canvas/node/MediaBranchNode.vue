<template>
    <div class="media-branch-node" :class="{ 'processing': isProcessing }">
        <BranchNode 
            :node="node" 
            :is-selected="isSelected" 
            :selected-model="selectedModel"
            :modelType="modelType"
            :open-router-api-key="openRouterApiKey" 
            :zoom="zoom" 
            :model-registry="modelRegistry"
            @select="$emit('select')" 
            @drag-start="(e, node) => $emit('drag-start', e, node)"
            @create-branch="(parentId, index, pos, data) => $emit('create-branch', parentId, index, pos, data)"
            @update-title="(id, title) => $emit('update-title', id, title)"
            @resend="messageIndex => $emit('resend', messageIndex)" 
            @delete="$emit('delete')"
            @send="handleMessageSend">
            <template #default>
                <!-- Media preview content -->
                <div v-if="mediaContent" class="media-preview p-4 border-b border-base-300">
                    <!-- Image preview -->
                    <img v-if="isImage" 
                         :src="mediaUrl" 
                         class="max-w-full h-auto rounded-lg"
                         :alt="mediaContent.filename" />

                    <!-- Video preview -->
                    <video v-else-if="isVideo" controls class="max-w-full h-auto rounded-lg">
                        <source :src="mediaUrl" :type="mediaContent.mime_type">
                        Your browser does not support the video tag.
                    </video>

                    <!-- Analysis status -->
                    <div v-if="isProcessing" class="mt-4 text-sm text-base-content/60">
                        Processing media...
                    </div>
                </div>

                <!-- Chat messages will be rendered by BranchNode -->
            </template>
        </BranchNode>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import BranchNode from './BranchNode.vue';
import type { PropType } from 'vue';
import type { Node } from '../../../types/message';

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

// State
const isProcessing = ref(false);
const mediaContent = computed(() => props.node.mediaContent);
const isImage = computed(() => mediaContent.value?.mime_type.startsWith('image/'));
const isVideo = computed(() => mediaContent.value?.mime_type.startsWith('video/'));
const mediaUrl = computed(() => 
    mediaContent.value
        ? mediaContent.value.previewUrl || `http://127.0.0.1:5000/media/${mediaContent.value.media_id}`
        : null
);

const processMedia = async (file: File, apiType: string, apiKey?: string) => {
  isProcessing.value = true;
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_type', apiType);
    formData.append('model', props.selectedModel);
    if (apiKey) formData.append('api_key', apiKey);

    const response = await fetch('http://127.0.0.1:5000/process-media', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to process media');
    }

    const result = await response.json();
    // Update node with media content
    props.node.mediaContent = result;
    
    // Add initial analysis message
    props.node.messages = [{
      role: 'assistant',
      content: result.analysis,
      timestamp: new Date().toISOString()
    }];

  } catch (error) {
    console.error('Media processing error:', error);
    throw error;
  } finally {
    isProcessing.value = false;
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
        const response = await fetch('http://127.0.0.1:5000/chat-follow-up', {
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

// Expose methods
defineExpose({
    processMedia
});
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
</style>