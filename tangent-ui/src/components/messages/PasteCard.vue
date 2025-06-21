<template>
    <div class="paste-card my-2 border rounded-md overflow-hidden" :class="[
      `theme-${currentTheme}`,
      { expanded }
    ]">
      <!-- Preview mode -->
      <div v-if="!expanded" @click="toggleExpand" class="preview-mode cursor-pointer transition-all hover:bg-opacity-80">
        <div class="flex items-center justify-between p-3 bg-base-200 dark:bg-gray-800">
          <div class="flex items-center gap-2">
            <FileText class="w-5 h-5 text-base-content/70" />
            <span class="font-medium">Pasted content ({{ wordCount }} words)</span>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant="outline" class="text-xs">Click to expand</Badge>
            <ChevronDown class="w-4 h-4" />
          </div>
        </div>
        <div class="p-3 bg-base-100 dark:bg-gray-900">
          <div class="line-clamp-2 text-sm text-base-content/80 font-mono">{{ preview }}</div>
        </div>
      </div>
      
      <!-- Expanded mode -->
      <div v-else class="expanded-mode">
        <div class="flex items-center justify-between p-3 bg-base-200 dark:bg-gray-800">
          <div class="flex items-center gap-2">
            <FileText class="w-5 h-5 text-base-content/70" />
            <span class="font-medium">Pasted content ({{ wordCount }} words)</span>
          </div>
          <div class="flex items-center gap-3">
            <button @click="copyContent" class="btn btn-sm btn-ghost gap-2">
              <Copy class="w-4 h-4" />
              <span class="text-xs">Copy</span>
            </button>
            <button @click="toggleExpand" class="btn btn-sm btn-ghost">
              <ChevronUp class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div class="p-3 bg-base-100 dark:bg-gray-900 max-h-96 overflow-y-auto">
          <pre class="text-sm text-base-content/90 font-mono whitespace-pre-wrap">{{ content }}</pre>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted } from 'vue';
  import { FileText, ChevronDown, ChevronUp, Copy } from 'lucide-vue-next';
  import Badge from '../ui/Badge.vue';
  
  const props = defineProps({
    content: {
      type: String,
      required: true
    },
    preview: {
      type: String,
      default: ''
    },
    wordCount: {
      type: Number,
      default: 0
    }
  });
  
  const expanded = ref(false);
  const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');
  
  const toggleExpand = () => {
    expanded.value = !expanded.value;
  };
  
  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(props.content);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };
  
  onMounted(() => {
    // Theme observation
    const themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          currentTheme.value = document.documentElement.getAttribute('data-theme') || 'light';
        }
      });
    });
  
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  });
  </script>
  
  <style scoped>
  .paste-card {
    transition: all 0.3s ease;
    border-color: rgba(var(--bc), 0.2);
  }
  
  .paste-card.expanded {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .expanded-mode .max-h-96 {
    scrollbar-width: thin;
    scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
  }
  
  .expanded-mode .max-h-96::-webkit-scrollbar {
    width: 6px;
  }
  
  .expanded-mode .max-h-96::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .expanded-mode .max-h-96::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.5);
    border-radius: 3px;
  }
  
  /* Theme-specific styling */
  .theme-cyberpunk .paste-card {
    border-color: var(--p);
    box-shadow: 0 0 8px var(--p);
  }
  
  .theme-synthwave .paste-card {
    background: linear-gradient(135deg, rgba(45, 10, 80, 0.4), rgba(10, 10, 40, 0.4));
    border-color: rgba(255, 100, 255, 0.5);
  }
  
  .theme-luxury .paste-card {
    border-color: rgba(255, 215, 0, 0.5);
  }
  </style>