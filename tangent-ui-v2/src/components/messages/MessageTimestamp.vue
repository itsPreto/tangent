
<!-- MessageTimestamp.vue -->
<template>
    <div
      class="absolute flex items-center px-3 py-1.5 gap-1.5 text-xs font-mono rounded-full 
             bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700
             text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 
             transition-all duration-200"
      :class="side === 'right' ? 'left-[calc(100%+8px)] top-4' : 'right-[calc(100%+8px)] top-4'"
    >
      <Timer class="w-3 h-3" />
      <span>{{ formattedTime }}</span>
    </div>
  </template>
  
  <script setup lang="ts">
  // MessageTimestamp.vue
import { computed } from 'vue';
import { Timer } from 'lucide-vue-next';

const props = defineProps({
  timestamp: {
    type: String,
    required: true
  },
  side: {
    type: String,
    default: 'right',
    validator: (value: string) => ['left', 'right'].includes(value)
  }
});

const formattedTime = computed(() => {
  const date = new Date(props.timestamp);
  return `${
    date.getHours().toString().padStart(2, '0')
  }:${
    date.getMinutes().toString().padStart(2, '0')
  }:${
    date.getSeconds().toString().padStart(2, '0')
  }`;
});
  </script>
  
  <!-- Updated styles for BranchNode.vue -->
  <style>
  .message-bubble {
    @apply relative transition-all duration-200 rounded-lg p-4;
  }
  
  .message-bubble.user {
    @apply bg-blue-900/20 border-l-4 border-blue-500;
  }
  
  .message-bubble.assistant {
    @apply bg-purple-900/20 border-l-4 border-purple-500;
  }
  
  .message-bubble.inherited {
    @apply opacity-75 border-dashed;
  }
  
  .node-card {
    @apply backdrop-blur bg-gray-900/30 transition-all duration-300 border border-gray-700/50 rounded-lg;
  }
  
  .node-card:hover {
    @apply shadow-lg shadow-black/20 border-gray-600/50;
  }
  
  .selected .node-card {
    @apply ring-2 ring-blue-500/50;
  }
  
  .streaming .node-card {
    @apply relative;
  }
  
  .streaming .node-card::before {
    content: '';
    @apply absolute inset-0 rounded-lg;
    background: linear-gradient(90deg, 
      theme('colors.blue.500') 0%,
      theme('colors.purple.500') 50%,
      theme('colors.blue.500') 100%
    );
    background-size: 200% 100%;
    animation: flowBorder 4s linear infinite;
    z-index: 0;
    opacity: 0.2;
  }
  
  @keyframes flowBorder {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }
  </style>