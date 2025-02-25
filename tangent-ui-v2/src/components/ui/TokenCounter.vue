<!-- src/components/ui/TokenCounter.vue -->
<template>
    <div :class="[
      'flex items-center gap-1.5 text-base-content/60',
      size === 'small' ? 'text-xs' : 'text-sm',
      className
    ]">
      <Hash v-if="showIcon" :class="size === 'small' ? 'w-3 h-3' : 'w-4 h-4'" />
      <div v-if="isLoading" 
        :class="[
          'rounded-full border-t-2 border-r-2 border-base-content/60 animate-spin',
          size === 'small' ? 'w-3 h-3' : 'w-4 h-4'
        ]"
      />
      <span v-else>{{ tokenCount.toLocaleString() }}</span>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Hash } from 'lucide-vue-next';
  
  const props = defineProps({
    text: {
      type: String,
      required: true
    },
    className: {
      type: String,
      default: ''
    },
    showIcon: {
      type: Boolean,
      default: true
    },
    size: {
      type: String as () => 'small' | 'normal',
      default: 'normal'
    }
  });
  
  const tokenCount = ref(0);
  const isLoading = ref(false);
  let debounceTimer: number | null = null;
  
  async function countTokens(text: string) {
    if (!text) {
      tokenCount.value = 0;
      return;
    }
  
    isLoading.value = true;
    try {
      const response = await fetch('http://127.0.0.1:5000/count-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      tokenCount.value = data.tokens;
    } catch (error) {
      console.error('Error counting tokens:', error);
      tokenCount.value = 0;
    } finally {
      isLoading.value = false;
    }
  }
  
  watch(() => props.text, (newText) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(() => {
      countTokens(newText);
    }, 500);
  }, { immediate: true });
  </script>