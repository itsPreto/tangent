<template>
  <div class="relative inline-flex items-center gap-2 px-3 py-2 bg-base-200/90 backdrop-blur 
              border border-base-300 rounded-full cursor-pointer transition-all duration-200
              hover:bg-base-300/90 hover:shadow-md group"
       @mouseenter="isHovered = true"
       @mouseleave="isHovered = false"
       @click="$emit('click')">
    <Code class="w-4 h-4 text-base-content/60" />
    <span class="text-sm text-base-content/80">
      {{ language || 'code' }} snippet
    </span>
    
    <!-- Hover tooltip -->
    <div class="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-base-300/90 
                backdrop-blur rounded text-xs whitespace-nowrap transition-opacity duration-200"
         :class="isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'">
      Click to view code
    </div>
  </div>
</template>

<script setup lang="ts">

interface CodeBubbleEmits {
  (e: 'click'): void;
}


import { ref } from 'vue';
import { Code } from 'lucide-vue-next';

defineProps<{
  language?: string;
}>();

defineEmits<CodeBubbleEmits>();

const isHovered = ref(false);
</script>
