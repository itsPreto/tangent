<template>
  <div 
    class="right-features-dropdown" 
    :class="[
      'theme-' + currentTheme,
      `state-${dropdownState}`,
      { 'morphing': isTransitioning }
    ]"
  >
    <!-- Morphing Header -->
    <HeaderMorphComponent
      v-if="!isRightContentPanelOpen"
      :dropdown-state="dropdownState"
      :active-feature="activeFeatureData"
      @back-clicked="handleBackToFeatures"
    />

    <!-- Content Area -->
    <div class="content-area">
      <!-- Features Grid State -->
      <Transition name="content-slide" mode="out-in">
        <div v-if="dropdownState === 'features-list'" key="features-content" class="features-content">
          <!-- Features Grid -->
          <div class="features-grid">
            <div
              v-for="feature in features"
              :key="feature.id"
              class="feature-item"
              :class="{ 
                'active': selectedFeature === feature.id,
                'themes-item': feature.id === 'themes'
              }"
              @click="handleFeatureClick(feature)"
              @mouseenter="handleFeatureHover(feature)"
              @mouseleave="handleFeatureLeave"
              :style="getFeatureItemStyle(feature)"
            >
              <!-- Themes divider -->
              <div v-if="feature.id === 'themes'" class="themes-divider"></div>
              
              <div class="feature-icon" :style="getFeatureIconStyle(feature)">
                <component :is="feature.icon" :size="20" />
              </div>
              
              <div class="feature-info">
                <div class="feature-label">{{ feature.label }}</div>
                <div class="feature-description">{{ feature.description }}</div>
              </div>

              <!-- Hover indicator -->
              <div class="hover-indicator" v-if="hoveredFeature === feature.id">
                <ChevronRight :size="16" />
              </div>
            </div>
          </div>

          <!-- Inline Themes Section (when themes is hovered/selected) -->
          <Transition name="slide-down">
            <div v-if="showInlineThemes" class="themes-section">
              <div class="themes-header">
                <div class="themes-header-content">
                  <span class="section-title">Choose Theme</span>
                  <input 
                    v-model="themeSearchQuery"
                    type="text" 
                    placeholder="Search themes..."
                    class="theme-search-input"
                  />
                </div>
              </div>
              
              <!-- Current Theme Display -->
              <div class="current-theme">
                <div class="theme-dots">
                  <div class="theme-dot" :style="{ backgroundColor: themeColors.primary }" />
                  <div class="theme-dot" :style="{ backgroundColor: themeColors.secondary }" />
                  <div class="theme-dot" :style="{ backgroundColor: themeColors.accent }" />
                </div>
                <div class="current-theme-name">{{ currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1) }}</div>
              </div>
              
              <!-- Themes Grid -->
              <div class="themes-grid">
                <div 
                  v-for="theme in filteredThemes" 
                  :key="theme"
                  @click="selectTheme(theme)"
                  class="theme-item"
                  :class="{ 'active': theme === currentTheme }"
                >
                  <div class="theme-dots">
                    <div class="theme-dot" :style="{ backgroundColor: getThemeColorsForTheme(theme).primary }" />
                    <div class="theme-dot" :style="{ backgroundColor: getThemeColorsForTheme(theme).secondary }" />
                    <div class="theme-dot" :style="{ backgroundColor: getThemeColorsForTheme(theme).accent }" />
                  </div>
                  <div class="theme-name">{{ theme.charAt(0).toUpperCase() + theme.slice(1) }}</div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>

      <!-- Feature Content State -->
      <Transition name="content-slide" mode="out-in">
        <div v-if="dropdownState === 'feature-content'" key="feature-content" class="feature-content">
          <FeatureContentPanel
            :is-open="true"
            :active-feature="selectedFeature"
            :node-id="nodeId"
            @close="$emit('close')"
            @feature-switch="handleFeatureSwitch"
            @panel-opened="$emit('panel-opened')"
            @panel-closed="$emit('panel-closed')"
            @open-workspace="$emit('open-workspace', $event)"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Settings,
  Code,
  Bot,
  TestTube,
  GitBranch,
  FileText,
  Palette,
  ChevronRight
} from 'lucide-vue-next'
import { useThemeStore } from '@/stores/themeStore'
import HeaderMorphComponent from './HeaderMorphComponent.vue'
import FeatureContentPanel from '@/components/sidebar/FeatureContentPanel.vue'

interface Props {
  dropdownState: 'collapsed' | 'features-list' | 'feature-content'
  selectedFeature?: string | null
  nodeId?: string | null
  isRightContentPanelOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedFeature: null,
  nodeId: null,
  isRightContentPanelOpen: false
})

const emit = defineEmits<{
  'feature-clicked': [feature: any]
  'feature-hovered': [feature: any]
  'theme-selected': [theme: string]
  'back-to-features': []
  'close': []
  'panel-opened': []
  'panel-closed': []
  'open-workspace': [event: any]
}>()

const themeStore = useThemeStore()
const currentTheme = computed(() => themeStore.currentTheme)
const isDarkTheme = computed(() => themeStore.isDarkTheme(currentTheme.value))
const themeColors = computed(() => themeStore.getThemeColors(currentTheme.value))

const hoveredFeature = ref<string | null>(null)
const showInlineThemes = ref(false)
const themeSearchQuery = ref('')
const isTransitioning = ref(false)

// Get active feature data for header component
const activeFeatureData = computed(() => {
  if (!props.selectedFeature) return null
  return features.value.find(f => f.id === props.selectedFeature) || null
})

const features = computed(() => [
  { 
    id: 'model-selector', 
    icon: Settings, 
    label: 'Models', 
    color: themeColors.value.primary,
    description: 'Model selector and agent configuration'
  },
  { 
    id: 'sandpack', 
    icon: Code, 
    label: 'Code Editor', 
    color: themeColors.value.primary,
    description: 'Code editor + preview + relic manager'
  },
  { 
    id: 'claude-code', 
    icon: Bot, 
    label: 'Claude Code', 
    color: themeColors.value.primary,
    description: 'Claude Code instance management'
  },
  { 
    id: 'testing', 
    icon: TestTube, 
    label: 'Testing', 
    color: themeColors.value.primary,
    description: 'Model testing and evaluation suite'
  },
  { 
    id: 'force-graph', 
    icon: GitBranch, 
    label: 'Clusters', 
    color: themeColors.value.primary,
    description: 'Interactive workspace relationships graph'
  },
  { 
    id: 'documents', 
    icon: FileText, 
    label: 'Documents', 
    color: themeColors.value.primary,
    description: 'RAG document panel and management'
  },
  { 
    id: 'themes', 
    icon: Palette, 
    label: 'Themes', 
    color: themeColors.value.accent,
    description: 'Switch between 30 beautiful themes'
  }
])

const availableThemes = computed(() => [
  'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate', 'synthwave', 'retro',
  'cyberpunk', 'valentine', 'garden', 'lofi', 'pastel', 'fantasy', 'wireframe', 
  'black', 'luxury', 'dracula', 'cmyk', 'autumn', 'aqua', 'winter',
  'business', 'acid', 'lemonade', 'night', 'coffee', 'halloween', 'forest', 'watermelon'
])

const filteredThemes = computed(() => {
  if (!themeSearchQuery.value) return availableThemes.value
  return availableThemes.value.filter(theme => 
    theme.toLowerCase().includes(themeSearchQuery.value.toLowerCase())
  )
})

const handleFeatureClick = (feature: any) => {
  if (feature.id === 'themes') {
    showInlineThemes.value = !showInlineThemes.value
    return
  }
  
  // Start transition and emit feature click
  isTransitioning.value = true
  setTimeout(() => isTransitioning.value = false, 300)
  
  emit('feature-clicked', feature)
}

const handleBackToFeatures = () => {
  showInlineThemes.value = false
  isTransitioning.value = true
  setTimeout(() => isTransitioning.value = false, 300)
  
  emit('back-to-features')
}

const handleFeatureSwitch = (featureId: string) => {
  // Find the feature and emit feature-clicked to switch to it
  const feature = features.value.find(f => f.id === featureId)
  if (feature) {
    emit('feature-clicked', feature)
  }
}

const handleFeatureHover = (feature: any) => {
  hoveredFeature.value = feature.id
  emit('feature-hovered', feature)
}

const handleFeatureLeave = () => {
  hoveredFeature.value = null
}

const selectTheme = (theme: string) => {
  themeStore.setTheme(theme)
  emit('theme-selected', theme)
}

const getFeatureItemStyle = (feature: any) => {
  const isActive = props.selectedFeature === feature.id
  const isHovered = hoveredFeature.value === feature.id
  
  let style = {
    transition: 'all 0.2s ease',
    cursor: 'pointer'
  }
  
  if (isActive || isHovered) {
    style = {
      ...style,
      backgroundColor: `${feature.color}15`,
      borderColor: `${feature.color}30`
    }
  }
  
  return style
}

const getFeatureIconStyle = (feature: any) => {
  return {
    color: feature.color,
    transition: 'all 0.2s ease'
  }
}

const getThemeColorsForTheme = (theme: string) => {
  return themeStore.getThemeColors(theme)
}

// Watch for dropdown state changes to reset themes panel
watch(() => props.dropdownState, (newState) => {
  if (newState !== 'features-list') {
    showInlineThemes.value = false
  }
})
</script>

<style scoped>
.right-features-dropdown {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--dropdown-bg, rgba(0, 0, 0, 0.95));
  border-radius: 12px;
  backdrop-filter: blur(20px);
}

/* Content area that hosts both states */
.content-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.features-content,
.feature-content {
  height: 100%;
  overflow: hidden;
}

/* Features Grid Styles */
.features-grid {
  padding: 8px 0;
  overflow-y: auto;
  max-height: calc(100% - 60px); /* Account for header */
}

.feature-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  margin: 2px 8px;
  position: relative;
  transition: all 0.2s ease;
}

.feature-item:hover {
  background-color: rgba(128, 128, 128, 0.08);
  transform: translateX(2px);
}

.feature-item.active {
  background-color: rgba(128, 128, 128, 0.12);
}

.themes-divider {
  position: absolute;
  top: -4px;
  left: 8px;
  right: 8px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-color, #666), transparent);
}

.feature-icon {
  margin-right: 12px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.feature-info {
  flex: 1;
  min-width: 0;
}

.feature-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.feature-description {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.8;
}

.hover-indicator {
  margin-left: 8px;
  opacity: 0.6;
  transition: all 0.2s ease;
}

/* Content slide transitions */
.content-slide-enter-active,
.content-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.content-slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.content-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

/* Themes section styles */
.themes-section {
  padding: 16px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
}

.themes-header {
  margin-bottom: 16px;
}

.themes-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.theme-search-input {
  flex: 1;
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.2));
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  outline: none;
  transition: all 0.2s ease;
}

.theme-search-input:focus {
  border-color: var(--accent-color);
  background: rgba(255, 255, 255, 0.1);
}

.current-theme {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 16px;
}

.theme-dots {
  display: flex;
  gap: 6px;
}

.theme-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.current-theme-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.themes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.theme-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.02);
}

.theme-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.theme-item.active {
  border-color: var(--accent-color);
  background: rgba(var(--accent-color-rgb), 0.1);
}

.theme-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  text-align: center;
}

/* Slide down transition for themes */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-10px);
}

.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 400px;
  opacity: 1;
  transform: translateY(0);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .feature-item {
    padding: 10px 12px;
  }
  
  .feature-label {
    font-size: 13px;
  }
  
  .feature-description {
    font-size: 11px;
  }
  
  .themes-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 6px;
  }
}

/* State-specific styles */
.state-feature-content .content-area {
  background: var(--panel-bg, rgba(0, 0, 0, 0.2));
}

/* Morphing animation support */
.morphing {
  pointer-events: none;
}

.morphing .content-area {
  overflow: hidden;
}
</style>