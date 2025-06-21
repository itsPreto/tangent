<template>
    <div class="web-branch-node">
        <BranchNode :node="node" :is-selected="isSelected" :selected-model="selectedModel"
            :open-router-api-key="openRouterApiKey" :zoom="zoom" :model-registry="modelRegistry"
            @select="$emit('select')" @drag-start="(e, node) => $emit('drag-start', e, node)"
            @create-branch="(parentId, index, pos, data) => $emit('create-branch', parentId, index, pos, data)"
            @update-title="(id, title) => $emit('update-title', id, title)"
            @resend="messageIndex => $emit('resend', messageIndex)" @delete="$emit('delete')">
            <template #default>
                <!-- Web preview content -->
                <div class="web-preview p-4 border-b border-base-300">
                    <div class="web-container bg-white rounded-lg overflow-hidden" style="height: 400px;">
                        <iframe 
                            :src="node.url" 
                            class="w-full h-full"
                            frameborder="0"
                            sandbox="allow-scripts allow-same-origin allow-popups"
                            loading="lazy"
                        ></iframe>
                    </div>
                    <div class="mt-2 text-sm text-base-content opacity-75">
                        <a :href="node.url" target="_blank" rel="noopener noreferrer" 
                           class="hover:underline flex items-center gap-2">
                            <ExternalLink class="w-4 h-4" />
                            {{ node.url }}
                        </a>
                    </div>
                </div>
            </template>
        </BranchNode>
    </div>
</template>

<script setup lang="ts">
import { ExternalLink } from 'lucide-vue-next';
import BranchNode from './BranchNode.vue';
import type { PropType } from 'vue';
import type { Node } from '../../../types/message';

interface WebNode extends Node {
    url: string;
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
        type: Object as PropType<WebNode>,
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

// Events
const emit = defineEmits<{
    (e: 'select'): void;
    (e: 'drag-start', event: MouseEvent, node: WebNode): void;
    (e: 'create-branch', parentId: string, messageIndex: number, position: { x: number, y: number }, initialData: any): void;
    (e: 'update-title', id: string, title: string): void;
    (e: 'resend', messageIndex: number): void;
    (e: 'delete'): void;
}>();
</script>

<style scoped>
.web-branch-node {
    position: relative;
}

.web-preview {
    position: relative;
    overflow: hidden;
    border-radius: 0.5rem;
}

.web-container {
    position: relative;
    width: 100%;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
}

.web-container::before {
    content: '';
    display: block;
    padding-top: 56.25%; /* 16:9 Aspect Ratio */
}

.web-container iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: white;
}
</style>