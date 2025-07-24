<template>
  <div class="reflection-toggle">
    <button 
      @click="toggleReflections"
      class="toggle-btn"
      :class="{ 'enabled': isEnabled }"
      :title="isEnabled ? 'Disable reflection suggestions' : 'Enable reflection suggestions'"
    >
      <Lightbulb class="w-4 h-4" />
      <span v-if="showLabel" class="toggle-label">
        {{ isEnabled ? 'Insights On' : 'Insights Off' }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Lightbulb } from 'lucide-vue-next'

interface Props {
  isEnabled: boolean
  showLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showLabel: true
})

const emit = defineEmits<{
  toggle: [enabled: boolean]
}>()

const toggleReflections = () => {
  emit('toggle', !props.isEnabled)
}
</script>

<style scoped>
.reflection-toggle {
  @apply inline-flex;
}

.toggle-btn {
  @apply flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 transition-all duration-200 text-sm font-medium;
  @apply hover:bg-gray-50;
}

.toggle-btn.enabled {
  @apply bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100;
}

.toggle-label {
  @apply text-xs;
}
</style>