<template>
  <div class="relative inline-flex items-center gap-2 px-3 py-2 bg-base-200/90 backdrop-blur 
              border border-base-300 rounded-full cursor-pointer transition-all duration-200
              hover:bg-base-300/90 hover:shadow-md group"
       @mouseenter="isHovered = true"
       @mouseleave="isHovered = false"
       @click="handleClick">
    <Code class="w-4 h-4 text-base-content/60" />
    <span class="text-sm text-base-content/80">
      {{ language || 'code' }} snippet
      <span v-if="isStreaming" class="ml-1 inline-flex items-center">
        <span class="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-ping mr-0.5"></span>
        <span class="text-xs text-primary font-medium">streaming</span>
      </span>
      <span v-if="isEdited" class="ml-1 inline-flex items-center">
        <span class="text-xs text-warning font-medium">(edited)</span>
      </span>
    </span>
    
    <!-- Content indicator -->
    <div v-if="content?.length > 0" class="absolute -right-1 -top-1 w-2 h-2 rounded-full" 
         :class="isEdited ? 'bg-warning' : 'bg-primary'"></div>
    
    <!-- Hover tooltip -->
    <div class="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-base-300/90 
                backdrop-blur rounded text-xs whitespace-nowrap transition-opacity duration-200 z-10"
         :class="isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'">
      Click to {{ isStreaming ? 'view live code' : 'open in editor' }}
    </div>
    
    <!-- Quick action buttons on hover -->
    <div class="absolute right-0 top-full mt-1 opacity-0 group-hover:opacity-100 
                transition-opacity duration-200 flex gap-1 bg-base-300/90 backdrop-blur 
                rounded-md p-1 shadow-md">
      <button class="p-1.5 hover:bg-base-200 rounded-md transition-colors"
              title="Copy to clipboard" @click.stop="copyContent">
        <Copy class="w-3.5 h-3.5 text-base-content/60" />
      </button>
      <button v-if="!isStreaming" class="p-1.5 hover:bg-base-200 rounded-md transition-colors"
              title="Edit in workspace" @click.stop="openEditor">
        <Edit class="w-3.5 h-3.5 text-base-content/60" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Code, Copy, Edit } from 'lucide-vue-next';
import emitter from '@/utils/eventBus';
import { useAppStore } from '@/stores/appStore';

interface CodeBubbleProps {
  language?: string;
  content?: string;
  nodeId: string;
  isStreaming?: boolean;
  codeIndex?: number;
}

interface CodeBubbleEmits {
  (e: 'click', data: { content: string, language: string, nodeId: string, codeIndex?: number, complete?: boolean }): void;
}

const props = withDefaults(defineProps<CodeBubbleProps>(), {
  language: 'jsx',
  content: '',
  isStreaming: false,
  codeIndex: 0
});

const emit = defineEmits<CodeBubbleEmits>();
const appStore = useAppStore();

const isHovered = ref(false);
const isEdited = ref(false);

// Check if this code bubble has edited content
onMounted(() => {
  // Get any edited versions from localStorage
  const editedVersionsJson = localStorage.getItem(`edited-code-${props.nodeId}-${props.codeIndex}`);
  if (editedVersionsJson) {
    try {
      const editedVersion = JSON.parse(editedVersionsJson);
      isEdited.value = editedVersion.isEdited || false;
    } catch (e) {
      console.error('Error parsing edited code data:', e);
    }
  }
});

const handleClick = () => {
  console.log('CodeBubble clicked:', props.nodeId);
  appStore.openSidePanel();
  emit('click', {
    content: props.content || '',
    language: props.language || 'react',
    nodeId: props.nodeId,
    codeIndex: props.codeIndex,
    complete: !props.isStreaming
  });
};

const copyContent = async (e: Event) => {
  e.stopPropagation();
  if (props.content) {
    try {
      await navigator.clipboard.writeText(props.content);
      // Could show a small toast or notification here
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }
};

const openEditor = (e: Event) => {
  e.stopPropagation();
  appStore.openSidePanel();
  emit('click', {
    content: props.content || '',
    language: props.language || 'react',
    nodeId: props.nodeId,
    codeIndex: props.codeIndex,
    complete: !props.isStreaming
  });
};
</script>