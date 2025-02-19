
// src/components/ui/Slider.vue
<template>
  <div 
    ref="sliderRef"
    class="relative flex items-center select-none touch-none w-full"
    :class="className"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- Track -->
    <div class="relative w-full h-2 rounded-full bg-secondary overflow-hidden">
      <!-- Active Track Fill -->
      <div
        class="absolute h-full bg-primary transition-all"
        :style="{ width: `${percentage}%` }"
      />
    </div>

    <!-- Thumb -->
    <div
      class="absolute h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      :style="{ left: `calc(${percentage}% - 8px)` }"
      role="slider"
      :aria-valuenow="modelValue"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuetext="modelValue.toString()"
      tabindex="0"
      @keydown.left.prevent="decrementValue"
      @keydown.right.prevent="incrementValue"
      @keydown.down.prevent="decrementValue"
      @keydown.up.prevent="incrementValue"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  modelValue: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  className: ''
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const sliderRef = ref<HTMLDivElement | null>(null)
const isDragging = ref(false)

const percentage = computed(() => {
  return ((props.modelValue - props.min) / (props.max - props.min)) * 100
})

const updateValue = (clientX: number) => {
  if (!sliderRef.value || props.disabled) return

  const rect = sliderRef.value.getBoundingClientRect()
  const percentage = (clientX - rect.left) / rect.width
  const rawValue = props.min + (props.max - props.min) * percentage
  
  // Snap to step
  const steppedValue = Math.round(rawValue / props.step) * props.step
  
  // Clamp value
  const clampedValue = Math.max(props.min, Math.min(props.max, steppedValue))
  
  emit('update:modelValue', clampedValue)
}

const handleMouseDown = (event: MouseEvent) => {
  if (props.disabled) return
  isDragging.value = true
  updateValue(event.clientX)
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return
  updateValue(event.clientX)
}

const handleMouseUp = () => {
  isDragging.value = false
}

const handleMouseLeave = () => {
  isDragging.value = false
}

const handleTouchStart = (event: TouchEvent) => {
  if (props.disabled) return
  isDragging.value = true
  updateValue(event.touches[0].clientX)
}

const handleTouchMove = (event: TouchEvent) => {
  if (!isDragging.value) return
  updateValue(event.touches[0].clientX)
}

const handleTouchEnd = () => {
  isDragging.value = false
}

const incrementValue = () => {
  if (props.disabled) return
  const newValue = Math.min(props.max, props.modelValue + props.step)
  emit('update:modelValue', newValue)
}

const decrementValue = () => {
  if (props.disabled) return
  const newValue = Math.max(props.min, props.modelValue - props.step)
  emit('update:modelValue', newValue)
}
</script>