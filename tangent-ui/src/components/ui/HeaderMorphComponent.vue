<template>
  <div class="header-morph-component">
    <!-- Features & Tools State (dropdownState === 'features-list') -->
    <Transition name="header-fade">
      <div v-if="dropdownState === 'features-list'" key="features-header" class="header-content">
        <div class="header-icon">
          <Settings :size="20" />
        </div>
        <span class="header-text">Features & Tools</span>
      </div>
    </Transition>

    <!-- Feature Content State (dropdownState === 'feature-content') -->
    <Transition name="header-fade">
      <div v-if="dropdownState === 'feature-content'" key="feature-header" class="header-content">
        <button class="back-button" @click="handleBackClick" :title="`Back to Features & Tools`">
          <ChevronLeft :size="18" />
          <span class="back-text">Back</span>
        </button>
        
        <div class="feature-info" v-if="activeFeature">
          <div class="feature-icon" :style="{ color: activeFeature.color }">
            <component :is="activeFeature.icon" :size="18" />
          </div>
          <span class="feature-name">{{ activeFeature.label }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { Settings, ChevronLeft } from 'lucide-vue-next'

interface Props {
  dropdownState: 'collapsed' | 'features-list' | 'feature-content'
  activeFeature?: {
    id: string
    label: string
    icon: any
    color: string
  } | null
}

const props = withDefaults(defineProps<Props>(), {
  activeFeature: null
})

const emit = defineEmits<{
  'back-clicked': []
}>()

const handleBackClick = () => {
  emit('back-clicked')
}
</script>

<style scoped>
.header-morph-component {
  position: relative;
  width: 100%;
  height: 60px; /* Fixed height to prevent layout shifts */
  display: flex;
  align-items: center;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 0 20px;
}

.header-icon,
.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-text,
.feature-name {
  font-weight: 600;
  font-size: 16px;
  color: var(--text-primary);
  user-select: none;
}

/* Back button styling */
.back-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.back-button:hover {
  background: var(--hover-bg, rgba(255, 255, 255, 0.05));
  border-color: var(--border-hover, rgba(255, 255, 255, 0.2));
  transform: translateX(-2px);
}

.back-text {
  font-size: 14px;
  font-weight: 500;
}

.feature-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 12px;
  flex: 1;
}

/* Header fade transitions */
.header-fade-enter-active,
.header-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.header-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.header-fade-enter-to,
.header-fade-leave-from {
  opacity: 1;
  transform: translateX(0);
}

/* Ensure smooth transitions */
.header-morph-component * {
  transition: color 0.2s ease;
}

/* Theme-specific adjustments */
:deep(.lucide) {
  transition: all 0.2s ease;
}

/* Responsive design */
@media (max-width: 768px) {
  .header-content {
    padding: 0 16px;
  }
  
  .feature-name {
    font-size: 15px;
  }
  
  .back-text {
    font-size: 13px;
  }
}
</style>