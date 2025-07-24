<template>
  <div
    ref="buttonRef"
    class="floating-corner-button"
    :class="[
      'theme-' + currentTheme,
      position,
      { 
        'active': isActive, 
        'morphing': isMorphing,
        'morphed': isMorphing, // Also add morphed class when fully morphed
        'inline-mode': morphingMode === 'inline',
        'no-border': isRightContentPanelOpen
      }
    ]"
    :style="buttonStyle"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- Button State (when closed) -->
    <Transition name="button-content">
      <div v-if="!isMorphing" class="button-content">
        <component :is="icon" :size="iconSize" class="button-icon" />
      </div>
    </Transition>
    
    <!-- Dropdown Content (when morphing) -->
    <Transition name="dropdown-content">
      <div v-if="isMorphing" class="dropdown-content-wrapper">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '@/stores/themeStore'

const buttonRef = ref<HTMLElement>()

// Expose the button ref so parent components can access it
defineExpose({
  buttonRef
})

interface Props {
  icon: any
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  isActive?: boolean
  title?: string
  iconSize?: number
  morphWidth?: number | string
  morphHeight?: string
  marginTop?: string
  morphingMode?: 'hover' | 'inline'
  dropdownState?: 'collapsed' | 'features-list' | 'feature-content'
  forceInline?: boolean
  forceOpen?: boolean
  isRightContentPanelOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
  title: '',
  iconSize: 20,
  morphWidth: 320,
  morphHeight: '80vh',
  marginTop: '0px',
  morphingMode: 'hover',
  dropdownState: 'collapsed',
  forceInline: false,
  forceOpen: false,
  isRightContentPanelOpen: false
})

// Internal state for morphing
const isHovered = ref(false)
const isMorphing = computed(() => {
  // Force open takes priority
  if (props.forceOpen) {
    return true
  }
  // In hover mode, always respond to hover
  if (props.morphingMode === 'hover') {
    return isHovered.value
  }
  // In inline mode, morph when dropdown state is not collapsed
  if (props.morphingMode === 'inline') {
    return props.dropdownState !== 'collapsed' || props.forceInline
  }
  return false
})

const emit = defineEmits<{
  click: []
}>()

const handleClick = () => {
  emit('click')
}

const handleMouseEnter = () => {
  isHovered.value = true
}

const handleMouseLeave = () => {
  isHovered.value = false
}

const themeStore = useThemeStore()
const currentTheme = computed(() => themeStore.currentTheme)
const isDarkTheme = computed(() => themeStore.isDarkTheme(currentTheme.value))
const themeColors = computed(() => themeStore.getThemeColors(currentTheme.value))


const buttonStyle = computed(() => {
  const isInlineMode = props.morphingMode === 'inline'
  const shouldMorph = isMorphing.value
  
  const baseStyles = {
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    backdropFilter: 'blur(12px)',
    borderColor: 'rgba(80, 80, 80, 0.5)',
    color: 'rgba(255, 255, 255, 0.9)',
    boxShadow: 'rgba(0, 0, 0, 0.3) 0px 8px 32px, rgba(0, 0, 0, 0.2) 0px 2px 8px',
    width: shouldMorph ? (typeof props.morphWidth === 'number' ? `${props.morphWidth}px` : props.morphWidth) : '48px',
    height: shouldMorph ? (isInlineMode ? '100vh' : props.morphHeight) : '48px',
    transition: isInlineMode 
      ? 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      : 'width 0.3s, height 0.4s 0.1s',
  }

  if (currentTheme.value === 'cyberpunk') {
    return {
      ...baseStyles,
      backgroundColor: 'rgba(20, 20, 30, 0.95)',
      borderColor: `${themeColors.value.primary}80`,
      boxShadow: `0 0 20px ${themeColors.value.primary}40, 0 8px 32px rgba(0, 0, 0, 0.4)`,
      color: themeColors.value.primary
    }
  } else if (currentTheme.value === 'synthwave') {
    return {
      ...baseStyles,
      backgroundColor: 'rgba(40, 20, 60, 0.9)',
      borderColor: `${themeColors.value.secondary}70`,
      boxShadow: `0 0 16px ${themeColors.value.secondary}30, 0 8px 32px rgba(0, 0, 0, 0.3)`
    }
  } else if (currentTheme.value === 'aqua') {
    return {
      ...baseStyles,
      backgroundColor: 'rgba(0, 60, 90, 0.8)',
      borderColor: `${themeColors.value.primary}90`,
      boxShadow: `0 0 12px ${themeColors.value.primary}25, 0 8px 32px rgba(0, 0, 0, 0.2)`
    }
  }

  return baseStyles
})
</script>

<style scoped>
.floating-corner-button {
  position: fixed;
  z-index: 1000;
  border-radius: 12px;
  border: 1px solid;
}

.floating-corner-button.no-border {
  border: none;
  background-color: transparent !important;
  backdrop-filter: none !important;
  border-color: transparent !important;
  box-shadow: none !important;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  cursor: pointer;
  backdrop-filter: blur(12px);
  overflow: hidden;
}

/* Inline mode integration */
.floating-corner-button.inline-mode {
  position: relative;
  top: unset !important;
  right: unset !important;
  bottom: unset !important;
  left: unset !important;
  margin: 0;
  z-index: 100;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
}

.floating-corner-button.inline-mode.morphing {
  height: 100vh !important;
  width: 100% !important;
  border-radius: 0;
}

.floating-corner-button:not(.morphing) {
  align-items: center;
  justify-content: center;
}

.floating-corner-button:not(.morphing):hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
}


.floating-corner-button.top-left {
  top: 20px;
  left: 20px;
}

.floating-corner-button.top-right {
  top: 20px;
  right: 20px;
}

.floating-corner-button.top-right.inline-mode {
  top: unset;
  right: unset;
}

.floating-corner-button.bottom-left {
  bottom: 20px;
  left: 20px;
}

.floating-corner-button.bottom-right {
  bottom: 20px;
  right: 20px;
}

.floating-corner-button.active {
  transform: scale(1.1);
}

.button-icon {
  transition: all 0.2s ease;
}

.floating-corner-button:hover .button-icon {
  transform: scale(1.1);
}

/* Theme-specific hover effects */
.theme-cyberpunk .floating-corner-button:hover {
  box-shadow: 0 0 30px var(--p, #00ff88)60, 0 12px 40px rgba(0, 0, 0, 0.4);
}

.theme-synthwave .floating-corner-button:hover {
  box-shadow: 0 0 24px var(--s, #ff1e9d)40, 0 12px 40px rgba(0, 0, 0, 0.3);
}

.theme-aqua .floating-corner-button:hover {
  box-shadow: 0 0 18px var(--p, #09ecf3)35, 0 12px 40px rgba(0, 0, 0, 0.2);
}

/* Morphing state styles */
.floating-corner-button.morphing {
  cursor: default;
}

.button-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.dropdown-content-wrapper {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 8px 0;
}

/* Content transitions */
.button-content-enter-active,
.button-content-leave-active {
  transition: opacity 0.2s ease;
}

.button-content-enter-from,
.button-content-leave-to {
  opacity: 0;
}

.dropdown-content-enter-active {
  transition: opacity 0.3s ease 0.2s; /* Delay to let morphing happen first */
}

.dropdown-content-leave-active {
  transition: opacity 0.2s ease;
}

.dropdown-content-enter-from,
.dropdown-content-leave-to {
  opacity: 0;
}
</style>