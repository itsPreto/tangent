<template>
  <button
    class="simple-floating-button"
    :class="[
      'theme-' + currentTheme,
      position,
      { 'active': isActive }
    ]"
    :style="buttonStyle"
    @click.stop="handleClick"
    :title="title"
  >
    <component :is="icon" :size="iconSize" class="button-icon" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/themeStore'

interface Props {
  icon: any
  position: 'bottom-left' | 'bottom-right'
  isActive?: boolean
  title?: string
  iconSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
  title: '',
  iconSize: 20
})

const emit = defineEmits<{
  click: []
}>()

const handleClick = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  emit('click')
}

const themeStore = useThemeStore()
const currentTheme = computed(() => themeStore.currentTheme)
const themeColors = computed(() => themeStore.getThemeColors(currentTheme.value))

const buttonStyle = computed(() => {
  const baseStyles = {
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    backdropFilter: 'blur(12px)',
    borderColor: 'rgba(80, 80, 80, 0.5)',
    color: 'rgba(255, 255, 255, 0.9)',
    boxShadow: 'rgba(0, 0, 0, 0.3) 0px 8px 32px, rgba(0, 0, 0, 0.2) 0px 2px 8px',
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
.simple-floating-button {
  position: fixed;
  z-index: 1000;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(12px);
  transition: all 0.2s ease;
}

.simple-floating-button:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
}

.simple-floating-button.bottom-left {
  bottom: 20px;
  left: 20px;
}

.simple-floating-button.bottom-right {
  bottom: 20px;
  right: 20px;
}

.simple-floating-button.active {
  transform: scale(1.1);
}

.button-icon {
  transition: all 0.2s ease;
}

.simple-floating-button:hover .button-icon {
  transform: scale(1.1);
}

/* Theme-specific hover effects */
.theme-cyberpunk .simple-floating-button:hover {
  box-shadow: 0 0 30px var(--p, #00ff88)60, 0 12px 40px rgba(0, 0, 0, 0.4);
}

.theme-synthwave .simple-floating-button:hover {
  box-shadow: 0 0 24px var(--s, #ff1e9d)40, 0 12px 40px rgba(0, 0, 0, 0.3);
}

.theme-aqua .simple-floating-button:hover {
  box-shadow: 0 0 18px var(--p, #09ecf3)35, 0 12px 40px rgba(0, 0, 0, 0.2);
}
</style>