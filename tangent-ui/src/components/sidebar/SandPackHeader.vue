<template>
    <div class="flex items-center justify-between px-4 py-2 preview-header" :style="headerStyle">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">Preview</span>
        
        <!-- FPS counter if enabled -->
        <span v-if="fpsCounter" class="text-xs px-2 py-1 rounded-md bg-base-300/30">
          {{ fpsCounter }}
        </span>
      </div>
      
      <!-- Relic Navigation (only when needed) -->
      <div v-if="showNavigation" class="flex items-center gap-3">
        <button @click="$emit('previous')" 
                class="p-1 hover:bg-base-300/50 rounded-full transition-colors"
                :disabled="currentIndex <= 0"
                :style="getButtonStyle(currentIndex <= 0)">
          <ChevronLeft class="w-4 h-4" />
        </button>
        
        <span class="text-xs font-medium">
          {{ currentIndex + 1 }} of {{ totalRelics }}
        </span>
        
        <button @click="$emit('next')" 
                class="p-1 hover:bg-base-300/50 rounded-full transition-colors"
                :disabled="currentIndex >= totalRelics - 1"
                :style="getButtonStyle(currentIndex >= totalRelics - 1)">
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
      
      <div class="flex items-center gap-2">
        <button @click="$emit('refresh')" 
                class="p-1 rounded-full hover:bg-base-300/30 transition-colors tooltip"
                data-tip="Refresh">
          <RefreshCw class="w-4 h-4 text-base-content/60" />
        </button>
        
        <!-- Fullscreen toggle button -->
        <button @click="toggleFullscreen" 
                class="p-1 rounded-full hover:bg-base-300/30 transition-colors tooltip"
                data-tip="Toggle fullscreen">
          <component :is="isFullscreen ? Minimize2 : Maximize2" class="w-4 h-4 text-base-content/60" />
        </button>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { computed, ref } from 'vue';
  import { ChevronLeft, ChevronRight, RefreshCw, Maximize2, Minimize2 } from 'lucide-vue-next';
  import { useThemeStore } from '@/stores/themeStore';
  
  const props = defineProps({
    currentIndex: {
      type: Number,
      default: 0
    },
    totalRelics: {
      type: Number,
      default: 0
    },
    showNavigation: {
      type: Boolean,
      default: false
    },
    fpsCounter: {
      type: String,
      default: ''
    }
  });
  
  const emit = defineEmits(['previous', 'next', 'refresh', 'fullscreen']);
  
  const themeStore = useThemeStore();
  const currentTheme = computed(() => document.documentElement.getAttribute('data-theme') || 'light');
  const isDarkTheme = computed(() => themeStore.isDarkTheme(currentTheme.value));
  const isFullscreen = ref(false);
  
  // Default primary color based on CSS variables (safer than JS binding)
  const primaryColor = computed(() => {
    try {
      const colors = themeStore.getThemeColors(currentTheme.value);
      return colors && colors.primary ? colors.primary : 'var(--p, #3b82f6)';
    } catch (err) {
      return 'var(--p, #3b82f6)';
    }
  });
  
  const headerStyle = computed(() => {
    return {
      backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 40, 0.9)' : 'rgba(245, 245, 250, 0.9)',
      borderTopLeftRadius: isFullscreen.value ? '0' : '8px',
      borderTopRightRadius: isFullscreen.value ? '0' : '8px',
      borderBottom: isDarkTheme.value 
        ? '1px solid rgba(60, 60, 70, 0.5)' 
        : '1px solid rgba(220, 220, 230, 0.5)',
      zIndex: 10,
      position: 'relative'
    };
  });
  
  const getButtonStyle = (isDisabled: boolean) => {
    if (isDisabled) {
      return {
        opacity: 0.5,
        cursor: 'not-allowed',
        color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'
      };
    }
    
    return {
      color: primaryColor.value,
      cursor: 'pointer'
    };
  };
  
  const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value;
    emit('fullscreen', isFullscreen.value);
  };
  </script>
  
  <style scoped>
  .preview-header {
    transition: background-color 0.3s ease;
    height: 36px;
  }
  
  .preview-header button {
    transition: all 0.2s ease;
  }
  
  /* Use CSS variables directly */
  :deep(.theme-cyberpunk) .preview-header {
    box-shadow: 0 0 8px var(--p, #3b82f6);
  }
  
  :deep(.theme-synthwave) .preview-header {
    background: linear-gradient(90deg, 
      rgba(40, 10, 60, 0.9) 0%, 
      rgba(60, 20, 90, 0.9) 100%);
  }
  
  /* Tooltip styling */
  .tooltip {
    position: relative;
  }
  
  .tooltip:before {
    content: attr(data-tip);
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%) translateY(100%);
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s, visibility 0.2s;
    z-index: 20;
  }
  
  .tooltip:hover:before {
    opacity: 1;
    visibility: visible;
  }
  </style>