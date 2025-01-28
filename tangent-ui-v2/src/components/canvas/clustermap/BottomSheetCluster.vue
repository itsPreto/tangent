<template>
  <div>
    <!-- Bottom Sheet Pull Tab -->
    <div 
      class="fixed bottom-0 left-1/2 -translate-x-1/2 w-24 h-1.5 rounded-full bg-base-300/50 cursor-pointer hover:bg-base-300 transition-colors mb-2"
      @mouseenter="handleShowSheet"
      @mouseleave="startHideTimer"
    />

    <!-- Bottom Sheet -->
    <div 
      class="fixed mx-4 left-0 right-0 bg-base-200/95 backdrop-blur border-t border-base-300 shadow-lg transition-all duration-300 ease-in-out rounded-t-lg"
      :class="[
        isOpen ? 'bottom-0' : '-bottom-[500px]',
        'transform'
      ]"
      :style="{ height: '500px' }"
      @mouseenter="handleShowSheet"
      @mouseleave="handleHideSheet"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-2 border-b border-base-300">
        <h3 class="text-lg font-medium">Topic Clusters</h3>
        <button 
          class="p-1.5 hover:bg-base-300 rounded-lg transition-colors"
          @click="handleHideSheet"
        >
          <span class="sr-only">Close</span>
          <XIcon class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 h-full">
        <TopicClusterViz 
          :width="vizWidth" 
          :height="400"
          :selected-topic="selectedTopic"
          @select-node="handleTopicSelect"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { XIcon } from 'lucide-vue-next';
import TopicClusterViz from './TopicClusterViz.vue';

const props = defineProps<{
  selectedTopic?: string;
}>();

const emit = defineEmits<{
  (e: 'select-topic', topicId: string): void;
}>();

const isOpen = ref(false);
const hideTimer = ref<number | null>(null);
const windowWidth = ref(window.innerWidth);

const vizWidth = computed(() => windowWidth.value - 80);

const handleShowSheet = () => {
  if (hideTimer.value) {
    clearTimeout(hideTimer.value);
    hideTimer.value = null;
  }
  isOpen.value = true;
};

const handleHideSheet = () => {
  isOpen.value = false;
};

const startHideTimer = () => {
  hideTimer.value = window.setTimeout(() => {
    if (!isOpen.value) return;
    handleHideSheet();
  }, 300);
};

const handleTopicSelect = (node: any) => {
  emit('select-topic', node.id);
};

onMounted(() => {
  const handleResize = () => {
    windowWidth.value = window.innerWidth;
  };
  
  window.addEventListener('resize', handleResize);
  
  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    if (hideTimer.value) {
      clearTimeout(hideTimer.value);
    }
  });
});
</script>

<style scoped>
.bottom-sheet-enter-active,
.bottom-sheet-leave-active {
  transition: transform 0.3s ease-in-out;
}

.bottom-sheet-enter-from,
.bottom-sheet-leave-to {
  transform: translateY(100%);
}
</style>