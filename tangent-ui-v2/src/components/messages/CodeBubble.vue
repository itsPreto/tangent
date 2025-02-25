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
    </span>
    
    <!-- Content indicator -->
    <div v-if="content?.length > 0" class="absolute -right-1 -top-1 w-2 h-2 rounded-full bg-primary"></div>
    
    <!-- Hover tooltip -->
    <div class="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-base-300/90 
                backdrop-blur rounded text-xs whitespace-nowrap transition-opacity duration-200"
         :class="isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'">
      Click to view code
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Code } from 'lucide-vue-next';

interface CodeBubbleProps {
  language?: string;
  content?: string;
  nodeId: string;
}

interface CodeBubbleEmits {
  (e: 'click', data: { content: string, language: string, nodeId: string }): void;
}

const props = defineProps<CodeBubbleProps>();
const emit = defineEmits<CodeBubbleEmits>();

const isHovered = ref(false);

const handleClick = () => {
  console.log('CodeBubble clicked:', props.nodeId);
  emit('click', {
    content: props.content || '',
    language: props.language || 'javascriptreact',
    nodeId: props.nodeId
  });
};
</script>