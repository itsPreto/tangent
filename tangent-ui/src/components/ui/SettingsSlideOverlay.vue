<template>
  <!-- Settings Slide System -->
  <Transition name="settings-slide">
    <div v-if="isOpen" class="settings-slide-system" :class="'theme-' + currentTheme">
      <!-- Settings panel that slides up from bottom (80vh height) -->
      <div class="settings-panel">
      <div class="settings-header">
        <h2 class="settings-title">Settings</h2>
        <button @click="$emit('close')" class="close-button" title="Close Settings">
          <X :size="20" />
        </button>
      </div>
      
      <!-- Settings content with smooth scrolling -->
      <div class="settings-content">
        <!-- Theme Section -->
        <div class="settings-section">
          <h3 class="section-title">Theme</h3>
          <div class="theme-grid">
            <button
              v-for="theme in themes"
              :key="theme.value"
              @click="handleThemeChange(theme.value)"
              class="theme-option"
              :class="{ active: currentTheme === theme.value }"
              :style="getThemePreviewStyle(theme.value)"
            >
              <span class="theme-name">{{ theme.label }}</span>
            </button>
          </div>
        </div>
        
        <!-- General Settings -->
        <div class="settings-section">
          <h3 class="section-title">General</h3>
          <div class="settings-group">
            <label class="setting-item">
              <input type="checkbox" class="checkbox">
              <span>Auto-save workspaces</span>
            </label>
            <label class="setting-item">
              <input type="checkbox" class="checkbox" checked>
              <span>Show keyboard shortcuts</span>
            </label>
            <label class="setting-item">
              <input type="checkbox" class="checkbox" checked>
              <span>Enable animations</span>
            </label>
          </div>
        </div>
        
        <!-- Privacy Settings -->
        <div class="settings-section">
          <h3 class="section-title">Privacy</h3>
          <div class="settings-group">
            <label class="setting-item">
              <input type="checkbox" class="checkbox">
              <span>Collect usage analytics</span>
            </label>
            <label class="setting-item">
              <input type="checkbox" class="checkbox" checked>
              <span>Enable crash reporting</span>
            </label>
          </div>
        </div>
        
        <!-- Performance Settings -->
        <div class="settings-section">
          <h3 class="section-title">Performance</h3>
          <div class="settings-group">
            <label class="setting-item">
              <input type="checkbox" class="checkbox" checked>
              <span>Hardware acceleration</span>
            </label>
            <label class="setting-item">
              <input type="checkbox" class="checkbox">
              <span>Reduce animations</span>
            </label>
          </div>
        </div>
      </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useThemeStore } from '@/stores/themeStore'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// Ensure smooth animation by waiting for DOM update
watch(() => props.isOpen, async (newValue) => {
  if (newValue) {
    await nextTick()
  }
})

const themeStore = useThemeStore()
const currentTheme = computed(() => themeStore.currentTheme)
const themeColors = computed(() => themeStore.getThemeColors(currentTheme.value))

const themes = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
  { label: 'Cyberpunk', value: 'cyberpunk' },
  { label: 'Synthwave', value: 'synthwave' },
  { label: 'Aqua', value: 'aqua' },
  { label: 'Valentine', value: 'valentine' },
  { label: 'Cupcake', value: 'cupcake' },
  { label: 'Forest', value: 'forest' }
]

const handleThemeChange = (theme: string) => {
  themeStore.setTheme(theme)
}

const getThemePreviewStyle = (theme: string) => {
  const previewColors = themeStore.getThemeColors(theme)
  return {
    background: `linear-gradient(45deg, ${previewColors.primary}40, ${previewColors.secondary}40)`,
    borderColor: previewColors.primary
  }
}
</script>

<style scoped>
.settings-slide-system {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1400;
  pointer-events: auto;
}

/* Settings panel that slides up from bottom */
.settings-panel {
  height: 80vh;
  background: hsl(var(--b1));
  border-top: 2px solid hsl(var(--b3));
  border-top-left-radius: 1.5rem;
  border-top-right-radius: 1.5rem;
  box-shadow: 0 -10px 50px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
}

/* Vue Transition animations */
.settings-slide-enter-active,
.settings-slide-leave-active {
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.settings-slide-enter-from {
  transform: translateY(100%);
}

.settings-slide-enter-to {
  transform: translateY(0);
}

.settings-slide-leave-from {
  transform: translateY(0);
}

.settings-slide-leave-to {
  transform: translateY(100%);
}

/* Settings header */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid hsl(var(--b3));
  background: hsl(var(--b2) / 0.8);
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.settings-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: hsl(var(--bc));
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: hsl(var(--b3));
  border: 1px solid hsl(var(--b3));
  color: hsl(var(--bc));
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: hsl(var(--bc) / 0.1);
  transform: scale(1.05);
}

/* Settings content - scrollable */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background: hsl(var(--b1));
}

.settings-section {
  background: hsl(var(--b2) / 0.3);
  border: 1px solid hsl(var(--b3));
  border-radius: 1rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: hsl(var(--bc));
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid hsl(var(--b3));
}

/* Theme grid */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  border: 2px solid transparent;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: hsl(var(--b3) / 0.5);
}

.theme-option:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.theme-option.active {
  border-color: var(--p, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.theme-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--bc));
  margin-top: 0.5rem;
}

/* Settings groups */
.settings-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  background: hsl(var(--b3) / 0.3);
}

.setting-item:hover {
  background: hsl(var(--b3) / 0.5);
}

.checkbox {
  width: 1.125rem;
  height: 1.125rem;
  accent-color: var(--p, #3b82f6);
  cursor: pointer;
}

/* Custom scrollbar */
.settings-content::-webkit-scrollbar {
  width: 6px;
}

.settings-content::-webkit-scrollbar-track {
  background: hsl(var(--b2));
  border-radius: 3px;
}

.settings-content::-webkit-scrollbar-thumb {
  background: hsl(var(--b3));
  border-radius: 3px;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--bc) / 0.3);
}

/* Responsive design */
@media (max-width: 768px) {
  .settings-content {
    padding: 1rem;
  }
  
  .theme-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.5rem;
  }
  
  .settings-header {
    padding: 1rem 1.5rem;
  }
  
  .settings-title {
    font-size: 1.5rem;
  }
}
</style>