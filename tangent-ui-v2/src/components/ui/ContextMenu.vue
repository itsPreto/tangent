// File: ui/ContextMenu.vue
<template>
  <TransitionRoot as="template" :show="true">
      <div class="fixed z-50" :style="{ left: `${position.x}px`, top: `${position.y}px` }">
          <TransitionChild as="template" enter="transition ease-out duration-100"
              enter-from="transform opacity-0 scale-95" enter-to="transform opacity-100 scale-100"
              leave="transition ease-in duration-75" leave-from="transform opacity-100 scale-100"
              leave-to="transform opacity-0 scale-95">
              <div class="bg-base-100 border border-base-300 rounded-md shadow-lg p-1 min-w-[150px]">
                  <slot></slot>
              </div>
          </TransitionChild>
      </div>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
// CORRECTED IMPORT:
import { TransitionRoot, TransitionChild } from '@headlessui/vue';

const props = defineProps({
  position: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['close']);

const handleClickOutside = (event) => {
  if (event.target.closest('.context-menu-item') === null) {
    emit('close');
  }
};

onMounted(() => {
  window.addEventListener('click', handleClickOutside, true); // Use capture phase
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleClickOutside, true);
});
</script>

<style scoped>
/* Add any component-specific styles here */
</style>