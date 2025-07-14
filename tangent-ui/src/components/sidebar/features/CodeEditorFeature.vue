<template>
  <div class="code-editor-feature" :class="'theme-' + currentTheme">
    <!-- CRITICAL: This is a wrapper around the existing SandpackSidePanel -->
    <!-- We preserve ALL existing functionality by passing through all props and events -->
    <SandPackSidePanel 
      ref="sandpackPanelRef"
      :node-id="nodeId"
      :force-view="'editor'"
      @panel-opened="$emit('panel-opened')"
      @panel-closed="$emit('panel-closed')"
      class="h-full w-full sandpack-wrapper" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import SandPackSidePanel from '@/components/sidebar/SandPackSidePanel.vue';
import { useThemeStore } from '@/stores/themeStore';

const props = defineProps<{
  nodeId?: string;
}>();

const emit = defineEmits<{
  'panel-opened': [];
  'panel-closed': [];
}>();

// Stores
const themeStore = useThemeStore();

// Refs
const sandpackPanelRef = ref<InstanceType<typeof SandPackSidePanel>>();

// Theme reactivity
const currentTheme = computed(() => themeStore.currentTheme);

// Expose methods from SandpackSidePanel to parent components
// This ensures that any external calls to the panel still work
defineExpose({
  // Expose the underlying SandpackSidePanel instance
  sandpackPanel: sandpackPanelRef,
  
  // Proxy key methods that might be called externally
  openRelic: (relic: any) => {
    if (sandpackPanelRef.value && 'openRelic' in sandpackPanelRef.value) {
      (sandpackPanelRef.value as any).openRelic(relic);
    }
  },
  
  // Add other methods as needed based on SandpackSidePanel's exposed interface
  saveFile: () => {
    if (sandpackPanelRef.value && 'saveFile' in sandpackPanelRef.value) {
      (sandpackPanelRef.value as any).saveFile();
    }
  },
  
  // Proxy any other methods that external components might need
  switchToManager: () => {
    if (sandpackPanelRef.value && 'switchToManager' in sandpackPanelRef.value) {
      (sandpackPanelRef.value as any).switchToManager();
    }
  }
});
</script>

<style scoped>
.code-editor-feature {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.sandpack-wrapper {
  /* Ensure the SandpackSidePanel fills the available space */
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 
  Note: We don't override any of the SandpackSidePanel's internal styling
  to ensure we don't break any existing functionality. The SandpackSidePanel
  will handle its own theming and responsive behavior.
*/
</style>