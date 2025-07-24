<template>
  <Teleport to="body">
    <Transition
      :name="transitionName"
      appear
      @enter="onEnter"
      @leave="onLeave"
    >
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="sidebar-dropdown"
        :class="[
          'theme-' + currentTheme,
          positionClass,
          sizeClass
        ]"
        :style="dropdownStyle"
        @click.stop
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useThemeStore } from '@/stores/themeStore'

interface Props {
  isOpen: boolean
  buttonRef?: HTMLElement | null
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom'
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  maxWidth?: number
  maxHeight?: number | string
  offsetX?: number
  offsetY?: number
  customPosition?: { x: number; y: number; transformOrigin?: string }
}

const props = withDefaults(defineProps<Props>(), {
  position: 'top-left',
  size: 'medium',
  offsetX: 8,
  offsetY: 8
})

const dropdownRef = ref<HTMLElement>()
const themeStore = useThemeStore()
const currentTheme = computed(() => themeStore.currentTheme)
const isDarkTheme = computed(() => themeStore.isDarkTheme(currentTheme.value))
const themeColors = computed(() => themeStore.getThemeColors(currentTheme.value))

const transitionName = computed(() => {
  return props.position.includes('right') ? 'dropdown-right' : 'dropdown-left'
})

const positionClass = computed(() => `dropdown-${props.position}`)
const sizeClass = computed(() => `dropdown-${props.size}`)

const dropdownStyle = computed(() => {
  if (!props.isOpen) return {}

  const baseStyles = {
    backgroundColor: isDarkTheme.value ? 'rgba(20, 20, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(16px)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)',
    boxShadow: isDarkTheme.value 
      ? '0 20px 60px rgba(0, 0, 0, 0.4), 0 8px 32px rgba(0, 0, 0, 0.2)' 
      : '0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 32px rgba(0, 0, 0, 0.1)',
    maxWidth: props.maxWidth ? `${props.maxWidth}px` : undefined,
    maxHeight: props.maxHeight ? (typeof props.maxHeight === 'string' ? props.maxHeight : `${props.maxHeight}px`) : undefined,
  }

  // Calculate position based on button ref and position prop
  const position = calculatePosition()
  
  // Theme-specific adjustments
  if (currentTheme.value === 'cyberpunk') {
    baseStyles.backgroundColor = 'rgba(10, 10, 20, 0.98)'
    baseStyles.borderColor = `${themeColors.value.primary}40`
    baseStyles.boxShadow = `0 0 40px ${themeColors.value.primary}30, 0 20px 60px rgba(0, 0, 0, 0.5)`
  } else if (currentTheme.value === 'synthwave') {
    baseStyles.backgroundColor = 'rgba(25, 10, 40, 0.96)'
    baseStyles.borderColor = `${themeColors.value.secondary}40`
    baseStyles.boxShadow = `0 0 32px ${themeColors.value.secondary}25, 0 20px 60px rgba(0, 0, 0, 0.4)`
  } else if (currentTheme.value === 'aqua') {
    baseStyles.backgroundColor = 'rgba(0, 40, 60, 0.94)'
    baseStyles.borderColor = `${themeColors.value.primary}50`
    baseStyles.boxShadow = `0 0 24px ${themeColors.value.primary}20, 0 20px 60px rgba(0, 0, 0, 0.3)`
  }

  return {
    ...baseStyles,
    ...position
  }
})


const calculatePosition = () => {
  if (props.customPosition) {
    return {
      left: `${props.customPosition.x}px`,
      top: `${props.customPosition.y}px`,
      transformOrigin: props.customPosition.transformOrigin || 'center center'
    }
  }

  if (!props.buttonRef) {
    // Default positioning if no button ref
    return props.position.includes('right') 
      ? { right: '20px', top: '80px', transformOrigin: 'top right' }
      : { left: '20px', top: '80px', transformOrigin: 'top left' }
  }

  const buttonRect = props.buttonRef.getBoundingClientRect()
  const buttonCenterX = buttonRect.left + buttonRect.width / 2
  const buttonCenterY = buttonRect.top + buttonRect.height / 2

  let position: any = {}
  let transformOrigin = ''

  switch (props.position) {
    case 'top-left':
      position.left = `${buttonRect.left + props.offsetX}px`
      position.top = `${buttonRect.top + props.offsetY}px` // Start from button top for expanding effect
      transformOrigin = `${buttonCenterX - buttonRect.left - props.offsetX}px 24px` // Transform from button center
      break
      
    case 'top-right':
      position.right = `${window.innerWidth - buttonRect.right + props.offsetX}px`
      position.top = `${buttonRect.bottom + props.offsetY}px`
      transformOrigin = `${buttonRect.right - buttonCenterX + props.offsetX}px ${props.offsetY}px`
      break
      
    case 'bottom-left':
      position.left = `${buttonRect.left + props.offsetX}px`
      position.bottom = `${window.innerHeight - buttonRect.top + props.offsetY}px`
      transformOrigin = `${buttonCenterX - buttonRect.left - props.offsetX}px 100%`
      break
      
    case 'bottom-right':
      position.right = `${window.innerWidth - buttonRect.right + props.offsetX}px`
      position.bottom = `${window.innerHeight - buttonRect.top + props.offsetY}px`
      transformOrigin = `${buttonRect.right - buttonCenterX + props.offsetX}px 100%`
      break
  }

  position.transformOrigin = transformOrigin
  return position
}

const onEnter = (el: Element) => {
  nextTick(() => {
    // Recalculate position after element is in DOM
    if (dropdownRef.value) {
      const newPosition = calculatePosition()
      Object.assign(dropdownRef.value.style, newPosition)
    }
  })
}

const onLeave = () => {
  // Any cleanup if needed
}

// Handle click outside to close
const handleClickOutside = (event: MouseEvent) => {
  if (!props.isOpen) return
  
  const target = event.target as Element
  if (dropdownRef.value && !dropdownRef.value.contains(target)) {
    // Also check if click was on the button that opens this dropdown
    if (props.buttonRef && props.buttonRef.contains(target)) {
      return // Don't close if clicking the button itself
    }
    emit('close')
  }
}

// Handle ESC key
const handleEscKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

const emit = defineEmits<{
  close: []
}>()

// Watch for position changes when button ref changes or window resizes
watch(() => [props.buttonRef, props.isOpen], () => {
  if (props.isOpen && dropdownRef.value) {
    nextTick(() => {
      const newPosition = calculatePosition()
      Object.assign(dropdownRef.value!.style, newPosition)
    })
  }
})

// Handle window resize
const handleResize = () => {
  if (props.isOpen && dropdownRef.value) {
    const newPosition = calculatePosition()
    Object.assign(dropdownRef.value.style, newPosition)
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
  document.addEventListener('keydown', handleEscKey)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
  document.removeEventListener('keydown', handleEscKey)
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.sidebar-dropdown {
  position: fixed;
  z-index: 1010;
  border: 1px solid;
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(16px);
}

/* Connected appearance - make dropdown look like button expansion */
.dropdown-top-left {
  border-top-left-radius: 12px; /* Match button radius */
  border-top-right-radius: 12px; /* Match button radius */
  margin-top: -8px; /* Overlap to create seamless connection */
  padding-top: 8px; /* Compensate for overlap */
}

.dropdown-top-right {
  border-top-left-radius: 12px; /* Match button radius */
  border-top-right-radius: 12px; /* Match button radius */  
  margin-top: -8px; /* Overlap to create seamless connection */
  padding-top: 8px; /* Compensate for overlap */
}

/* Size variations */
.dropdown-small {
  min-width: 200px;
  max-width: 300px;
}

.dropdown-medium {
  min-width: 280px;
  max-width: 400px;
  max-height: 400px;
}

.dropdown-large {
  min-width: 350px;
  max-width: 500px;
  max-height: 500px;
}

.dropdown-xlarge {
  min-width: 400px;
  max-width: 600px;
  max-height: 600px;
}

/* Transition animations */
.dropdown-left-enter-active,
.dropdown-left-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-left-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
}

.dropdown-left-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
}

.dropdown-right-enter-active,
.dropdown-right-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-right-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
}

.dropdown-right-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
}
</style>