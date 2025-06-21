<template>
  <div class="message-timestamp opacity-0 group-hover:opacity-100" :class="[
    'absolute right-3 top-2 flex items-center gap-1.5 py-0.5 px-2',
    'bg-base-200/40 backdrop-blur-sm rounded-full'
  ]">
    <Timer class="w-3 h-3 text-base-content/40" />
    <span class="text-[10px] font-mono text-base-content/40">{{ formattedTime }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Timer } from 'lucide-vue-next';

const props = defineProps({
  timestamp: {
    type: String,
    required: true
  },
  side: {
    type: String,
    default: 'right',
    validator: (value: string) => ['left', 'right'].includes(value)
  }
});

const formattedTime = computed(() => {
  const date = new Date(props.timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
});
</script>

<style scoped>
.message-timestamp {
  white-space: nowrap;
  width: fit-content;
  transition: opacity 200ms ease-in-out;
  z-index: 10;
}
</style>