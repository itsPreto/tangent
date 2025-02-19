<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100]">
    <!-- Backdrop with theme-aware blur -->
    <div class="absolute inset-0 bg-base-200/80 backdrop-blur-md" @click="$emit('close')" />
    
    <!-- Help Dialog -->
    <div class="relative flex items-center justify-center min-h-screen p-4">
      <div class="relative bg-base-100 rounded-lg shadow-2xl w-full max-w-2xl border border-base-300">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-base-300">
          <h2 class="text-xl font-semibold text-base-content">Tangent Help</h2>
          <button @click="$emit('close')" 
            class="p-2 hover:bg-base-200 rounded-full transition-colors text-base-content/70 hover:text-base-content">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Tabs -->
        <div class="border-b border-base-300 px-2">
          <div class="flex gap-2">
            <button v-for="tab in tabs" :key="tab.id"
              @click="activeTab = tab.id"
              class="flex items-center gap-2 px-4 py-3 border-b-2 transition-colors relative"
              :class="[
                activeTab === tab.id 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-base-content/70 hover:text-base-content hover:bg-base-200 rounded-t-lg'
              ]"
            >
              <component :is="tab.icon" class="w-4 h-4" />
              <span>{{ tab.label }}</span>
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="p-6 bg-base-100 rounded-b-lg">
          <!-- Keyboard Shortcuts -->
          <div v-if="activeTab === 'keyboard'" class="space-y-3">
            <div v-for="(shortcut, index) in shortcuts" :key="index" 
              class="flex items-center justify-between p-2 hover:bg-base-200 rounded-lg transition-colors group">
              <div class="flex items-center gap-2">
                <span v-for="key in shortcut.keys" :key="key" 
                  class="px-2 py-1 rounded bg-base-200 border border-base-300 text-sm font-mono text-base-content/90 shadow-sm group-hover:bg-base-100">
                  {{ key }}
                </span>
              </div>
              <span class="text-base-content/70 group-hover:text-base-content">{{ shortcut.description }}</span>
            </div>
          </div>

          <!-- Mouse & Gesture Tips -->
          <div v-else-if="activeTab === 'mouse'" class="space-y-3">
            <div v-for="(tip, index) in mouseTips" :key="index"
              class="flex items-start gap-4 p-2 hover:bg-base-200 rounded-lg transition-colors group">
              <MousePointer class="w-5 h-5 mt-1 shrink-0 text-primary" />
              <span class="text-base-content/70 group-hover:text-base-content">{{ tip }}</span>
            </div>
          </div>

          <!-- General Tips -->
          <div v-else-if="activeTab === 'tips'" class="space-y-3">
            <div v-for="(tip, index) in generalTips" :key="index"
              class="flex items-start gap-4 p-2 hover:bg-base-200 rounded-lg transition-colors group">
              <Sparkles class="w-5 h-5 mt-1 shrink-0 text-primary" />
              <span class="text-base-content/70 group-hover:text-base-content">{{ tip }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { X, Keyboard, MousePointer, Sparkles } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean
}>();

const emit = defineEmits<{
  (e: 'close'): void
}>();

const activeTab = ref('keyboard');

const tabs = [
  { id: 'keyboard', label: 'Keyboard', icon: Keyboard },
  { id: 'mouse', label: 'Mouse & Gestures', icon: MousePointer },
  { id: 'tips', label: 'Tips & Tricks', icon: Sparkles }
];

const shortcuts = [
  { keys: ['M'], description: 'Open model selector' },
  { keys: ['S'], description: 'Toggle snap mode for selected node' },
  { keys: ['ESC'], description: 'Exit snap mode' },
  { keys: ['↑', '↓', '←', '→'], description: 'Navigate between connected nodes' },
  { keys: ['/'], description: 'Search models' },
  { keys: ['?'], description: 'Show this help menu' }
];

const mouseTips = [
  'Double-click message to create a branch',
  'Drag nodes to rearrange them',
  'Use two fingers to zoom or pan based on mode',
];

const generalTips = [
  'Use different models for different tasks',
  'Create branches to explore alternative ideas',
  'Organize workspaces by project or theme',
  'Export workspaces for sharing',
  'Tag workspaces for better organization'
];
</script>

<style scoped>
/* Smooth transitions for theme changes */
.fixed {
  transition: background-color 0.2s ease;
}

.bg-base-100, 
.bg-base-200, 
.text-base-content,
.border-base-300 {
  transition: all 0.2s ease;
}

/* Improved backdrop blur */
.backdrop-blur-md {
  backdrop-filter: blur(12px);
}

/* Card shadow that works across themes */
.shadow-2xl {
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
}
</style>