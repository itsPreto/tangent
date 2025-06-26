<!-- src/components/ui/TokenCounter.vue -->
<template>
    <div :class="[
      'flex items-center gap-1.5',
      size === 'small' ? 'text-xs' : 'text-sm',
      getStatusColor(),
      className
    ]">
      <Hash v-if="showIcon" :class="size === 'small' ? 'w-3 h-3' : 'w-4 h-4'" />
      <div v-if="isLoading" 
        :class="[
          'rounded-full border-t-2 border-r-2 animate-spin',
          size === 'small' ? 'w-3 h-3 border-current' : 'w-4 h-4 border-current'
        ]"
      />
      <template v-else>
        <span>{{ tokenCount.toLocaleString() }}</span>
        <span v-if="contextLimit" class="opacity-60">
          / {{ contextLimit.toLocaleString() }}
        </span>
        <span v-if="showPercentage && contextLimit" class="ml-1 opacity-80">
          ({{ Math.round(percentage) }}%)
        </span>
      </template>
      
      <!-- Visual progress bar for context usage -->
      <div v-if="showProgressBar && contextLimit" 
        :class="[
          'rounded-full bg-base-300',
          size === 'small' ? 'w-8 h-1' : 'w-12 h-1.5'
        ]">
        <div 
          :class="[
            'h-full rounded-full transition-all duration-300',
            getProgressBarColor()
          ]"
          :style="{ width: `${Math.min(percentage, 100)}%` }"
        />
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, watch, computed } from 'vue';
  import { Hash } from 'lucide-vue-next';
  import { tokenTrackingService } from '@/services/tokenTrackingService';
  
  const props = defineProps({
    text: {
      type: String,
      required: true
    },
    contextLimit: {
      type: Number,
      default: 0
    },
    className: {
      type: String,
      default: ''
    },
    showIcon: {
      type: Boolean,
      default: true
    },
    showPercentage: {
      type: Boolean,
      default: false
    },
    showProgressBar: {
      type: Boolean,
      default: false
    },
    size: {
      type: String as () => 'small' | 'normal',
      default: 'normal'
    },
    cacheKey: {
      type: String,
      default: ''
    }
  });
  
  const tokenCount = ref(0);
  const isLoading = ref(false);
  let debounceTimer: number | null = null;
  
  const percentage = computed(() => {
    if (!props.contextLimit) return 0;
    return (tokenCount.value / props.contextLimit) * 100;
  });
  
  function getStatusColor(): string {
    if (!props.contextLimit) return 'text-base-content/60';
    
    const pct = percentage.value;
    if (pct >= 90) return 'text-red-500';
    if (pct >= 80) return 'text-orange-500';
    if (pct >= 70) return 'text-yellow-600';
    return 'text-base-content/60';
  }
  
  function getProgressBarColor(): string {
    const pct = percentage.value;
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 80) return 'bg-orange-500';
    if (pct >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  }
  
  async function countTokens(text: string) {
    if (!text.trim()) {
      tokenCount.value = 0;
      return;
    }
  
    isLoading.value = true;
    try {
      const count = await tokenTrackingService.countTokens(text, props.cacheKey);
      tokenCount.value = count;
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
    }, props.showProgressBar ? 200 : 500); // Faster updates for real-time tracking
  }, { immediate: true });
  </script>