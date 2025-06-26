<template>
  <div ref="editorRef" 
       class="fixed z-50 shadow-xl w-72 editor-container overflow-hidden"
       :style="[positionStyle, themeStyle]"
       @mousedown.stop
       @click.stop>
    
    <!-- Connected header that visually extends from avatar -->
    <div class="editor-header px-4 py-3 border-b border-white/10">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <img :src="modelAvatar" alt="Model Avatar" class="w-6 h-6 rounded-full object-cover border border-base-300" />
          <span class="font-medium">{{ model.name }}</span>
        </div>
        <button @click.stop="$emit('close')" class="p-1 hover:bg-white/10 rounded-full transition-colors">
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <div class="p-4 space-y-4">
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label>Temperature</Label>
          <span class="text-xs opacity-70">{{ parameters.temperature.toFixed(1) }}</span>
        </div>
        <Slider v-model="parameters.temperature" class="w-full" :min="0" :max="1" :step="0.1" @mousedown.stop />
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label>Top P</Label>
          <span class="text-xs opacity-70">{{ parameters.topP.toFixed(2) }}</span>
        </div>
        <Slider v-model="parameters.topP" class="w-full" :min="0" :max="1" :step="0.05" @mousedown.stop />
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label>Top K</Label>
          <span class="text-xs opacity-70">{{ parameters.topK }}</span>
        </div>
        <Slider v-model="parameters.topK" class="w-full" :min="1" :max="100" :step="1" @mousedown.stop />
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label>Max Tokens</Label>
          <span class="text-xs opacity-70">{{ parameters.maxOutputTokens }}</span>
        </div>
        <Slider v-model="parameters.maxOutputTokens" class="w-full" :min="256" :max="4096" :step="256" @mousedown.stop />
      </div>

      <div class="flex justify-end gap-2 mt-6">
        <Button variant="outline" size="sm" @click.stop="$emit('close')">Cancel</Button>
        <Button size="sm" @click.stop="saveParameters">Save</Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { X } from 'lucide-vue-next';
import Button from '../ui/Button.vue';
import Label from '../ui/Label.vue';
import Slider from '../ui/Slider.vue';
import type { ModelInfo, ModelParameters } from '@/types/model';
import { useThemeStore } from '@/stores/themeStore';

const props = defineProps<{
  model: ModelInfo;
  modelAvatar: string;
  currentParameters: ModelParameters;
  triggerRect: DOMRect;
}>();

const emit = defineEmits<{
  (e: 'save', params: ModelParameters): void;
  (e: 'close'): void;
}>();

const editorRef = ref<HTMLElement | null>(null);
const parameters = ref({ ...props.currentParameters });
const themeStore = useThemeStore();
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');
const editorHeight = ref(0);

// Get the accent color based on the model and current theme
const accentColor = computed(() => {
  // Extract the model ID's numerical value to get a consistent color
  const id = props.model?.id || '';
  const numericValue = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorIndex = numericValue % 3;
  
  // Get theme colors
  const colors = themeStore.getThemeColors(currentTheme.value);
  
  // Select a color based on the index
  switch (colorIndex) {
    case 0: return colors.primary;
    case 1: return colors.secondary;
    case 2: return colors.accent;
    default: return colors.primary;
  }
});

// Adjust color opacity
function adjustColorOpacity(hexColor, opacity) {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Theme-aware styling
const themeStyle = computed(() => {
  const isDark = themeStore.isDarkTheme(currentTheme.value);
  const color = accentColor.value;
  
  return {
    '--accent-color': color,
    '--accent-color-transparent': adjustColorOpacity(color, 0.15),
    '--text-color': isDark ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.85)',
    '--background-color': isDark 
      ? 'linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.9))' 
      : 'linear-gradient(to bottom, rgba(255,255,255,0.9), rgba(255,255,255,0.95))',
    '--border-color': adjustColorOpacity(color, 0.6),
    'backdrop-filter': 'blur(20px)',
    'color': 'var(--text-color)',
    'background': 'var(--background-color)',
    'border': '1px solid var(--border-color)',
    'border-top': 'none',
    'box-shadow': `0 4px 24px ${adjustColorOpacity(color, 0.3)}, 0 8px 32px ${adjustColorOpacity(color, 0.2)}`
  };
});

// Fixed positioning that places the editor directly below the avatar
const positionStyle = computed(() => {
  if (!props.triggerRect) {
    return { display: 'none' };
  }
  
  const avatarRect = props.triggerRect;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const editorWidth = 288; // w-72 = 18rem = 288px
  
  // Position the editor directly below the avatar with no gap
  let left = avatarRect.left + (avatarRect.width / 2) - (editorWidth / 2);
  let top = avatarRect.bottom; // No gap - directly connected
  
  // Ensure the editor doesn't go off-screen horizontally
  if (left < 16) left = 16;
  if (left + editorWidth > viewportWidth - 16) {
    left = viewportWidth - editorWidth - 16;
  }
  
  // If there's not enough room below, position above
  if (top + editorHeight.value > viewportHeight - 16) {
    top = avatarRect.top - editorHeight.value;
  }
  
  return {
    'position': 'fixed',
    'top': `${top}px`,
    'left': `${left}px`,
    'border-radius': '0 0 0.5rem 0.5rem', // Only round bottom corners
  };
});

const saveParameters = () => {
  emit('save', parameters.value);
  emit('close');
};

// Prevent events from reaching the canvas
const preventPropagation = (event: Event) => {
  event.stopPropagation();
};

// Close when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (editorRef.value && !editorRef.value.contains(event.target as Node)) {
    emit('close');
  }
};

// Update position after height is known
const updateEditorHeight = () => {
  if (editorRef.value) {
    editorHeight.value = editorRef.value.offsetHeight;
  }
};

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
  
  // Update theme from DOM
  const newTheme = document.documentElement.getAttribute('data-theme') || 'light';
  currentTheme.value = newTheme;
  
  // Setup theme observation
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
  
  // Stop propagation for all mouse events on the editor
  if (editorRef.value) {
    editorRef.value.addEventListener('mousedown', preventPropagation);
    editorRef.value.addEventListener('mousemove', preventPropagation);
    editorRef.value.addEventListener('mouseup', preventPropagation);
    editorRef.value.addEventListener('click', preventPropagation);
  }
  
  // Get editor height after it's rendered
  nextTick(() => {
    updateEditorHeight();
  });
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  
  if (editorRef.value) {
    editorRef.value.removeEventListener('mousedown', preventPropagation);
    editorRef.value.removeEventListener('mousemove', preventPropagation);
    editorRef.value.removeEventListener('mouseup', preventPropagation);
    editorRef.value.removeEventListener('click', preventPropagation);
  }
});

// Update position whenever the component height changes
watch(() => editorHeight.value, () => {
  nextTick(() => {
    // Force a style update based on new computed values
    if (editorRef.value) {
      Object.entries(positionStyle.value).forEach(([key, value]) => {
        editorRef.value.style.setProperty(key, value.toString());
      });
    }
  });
});
</script>

<style scoped>
/* Base isolation */
.editor-container {
  isolation: isolate;
  transform-origin: top center;
  animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  max-height: 400px;
  transition: max-height 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: scaleY(0);
    max-height: 0;
  }
  to {
    opacity: 1;
    transform: scaleY(1);
    max-height: 400px;
  }
}

/* Connected header styling */
.editor-header {
  background: var(--accent-color-transparent);
  backdrop-filter: blur(20px);
  position: relative;
}

.editor-header::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent-color);
  opacity: 0.6;
}

/* Theme-specific styles */
:global(.dark) .editor-container,
:global([data-theme="dark"]) .editor-container,
:global([data-theme="night"]) .editor-container,
:global([data-theme="dracula"]) .editor-container,
:global([data-theme="black"]) .editor-container,
:global([data-theme="coffee"]) .editor-container,
:global([data-theme="synthwave"]) .editor-container,
:global([data-theme="cyberpunk"]) .editor-container,
:global([data-theme="forest"]) .editor-container {
  --text-color: rgba(255, 255, 255, 0.95);
  --background-color: linear-gradient(to bottom, rgba(20, 20, 20, 0.9), rgba(10, 10, 10, 0.95));
}
</style>