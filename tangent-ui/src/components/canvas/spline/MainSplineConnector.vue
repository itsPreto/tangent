<template>
  <g style="pointer-events: all !important; isolation: isolate;">
    <!-- Gradient definitions for directional flow -->
    <defs>
      <linearGradient 
        :id="`connection-gradient-${startNode.id}-${endNode.id}`"
        gradientUnits="userSpaceOnUse"
        :x1="gradientCoords.x1"
        :y1="gradientCoords.y1" 
        :x2="gradientCoords.x2"
        :y2="gradientCoords.y2"
      >
        <!-- Strong color at parent (start) -->
        <stop offset="0%" :stop-color="isActive ? activePathColor : inactivePathColor" :stop-opacity="isActive ? 1.0 : 0.8" />
        <!-- Medium color in middle -->
        <stop offset="50%" :stop-color="isActive ? activePathColor : inactivePathColor" :stop-opacity="isActive ? 0.7 : 0.5" />
        <!-- Fade out at child (end) -->
        <stop offset="100%" :stop-color="isActive ? activePathColor : inactivePathColor" :stop-opacity="isActive ? 0.3 : 0.2" />
      </linearGradient>
    </defs>
    
    <!-- Main dashed path with gradient stroke -->
    <path
      :d="pathData"
      :stroke="`url(#connection-gradient-${startNode.id}-${endNode.id})`"
      :stroke-width="getVisualStrokeWidth()"
      :stroke-dasharray="dashPattern"
      fill="none"
      class="transition-all duration-300 connector-path"
      :class="{ 'active-path': isActive, 'hovered-path': isHovered }"
      :style="{
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        pointerEvents: 'none',
        filter: isHovered ? `drop-shadow(0 0 ${strokeWidth.value * 0.5}px ${activePathColor.value})` : 'none'
      }"
    />


    <!-- Hidden path for text alignment -->
    <path
      :id="`connection-path-${startNode.id}-${endNode.id}`"
      :d="isLeftBranch ? reversedPathData : pathData"
      fill="none"
      stroke="none"
      pointer-events="none"
    />

    <!-- Label with contrast background -->
    <g class="label-container" v-if="hasLabel" style="pointer-events: all; z-index: 10;">
      
      <!-- Enhanced glow path for active state -->
      <path
        v-if="isActive"
        :d="pathData"
        :stroke="`url(#connection-gradient-${startNode.id}-${endNode.id})`"
        :stroke-width="strokeWidth * 3"
        :stroke-dasharray="dashPattern"
        fill="none"
        class="glow-path"
        :style="{
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          filter: `blur(${strokeWidth * 0.8}px)`,
          opacity: 0.6
        }"
      />
      
      <!-- A single, clean text element. -->
      <text class="text-container" style="pointer-events: all;">
        <textPath
          :href="`#connection-path-${startNode.id}-${endNode.id}`"
          startOffset="50%"
          text-anchor="middle"
          :class="{ reversed: isLeftBranch }"
        >
          <tspan
            :dy="-15"
            class="label-text"
            :style="{
              fontSize: `${fontSize}px`,
              fontWeight: 600,
              fill: getLabelColor(),
              pointerEvents: 'all',
              cursor: 'pointer',
              ...(shouldUseNeonGlow() ? {
                filter: `drop-shadow(0 0 2px ${glowColor})`
              } : {})
            }"
            @dblclick.stop="handleLabelDoubleClick"
          >
            {{ getLabelText() }}
          </tspan>
        </textPath>
      </text>

      <!-- Inline editor -->
      <foreignObject
        v-if="isEditing"
        :x="labelPosition.x"
        :y="labelPosition.y"
        :width="300 / Math.min(1, zoomLevel)"
        :height="50 / Math.min(1, zoomLevel)"
        @dblclick.stop
        style="z-index: 20; pointer-events: all;"
      >
        <div xmlns="http://www.w3.org/2000/svg" class="flex items-center justify-center w-full h-full">
          <input
            ref="inputRef"
            v-model="labelInput"
            @blur="handleLabelBlur"
            @keydown="handleKeyDown"
            class="px-3 py-2 text-center w-full rounded border"
            :style="{
              fontSize: `${fontSize}px`,
              color: getLabelColor(),
              backgroundColor: getInputBackgroundColor(),
              borderColor: activePathColor,
              boxShadow: `0 0 0 2px ${hexToRgba(activePathColor, 0.4)}`,
              pointerEvents: 'auto'
            }"
          />
        </div>
      </foreignObject>
    </g>
    
  </g>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick
} from 'vue'
import emitter from '@/utils/eventBus'
import { useThemeStore } from '@/stores/themeStore'
import { useCanvasStore } from '@/stores/canvasStore'
import type { ThemeName } from '@/stores/themeStore'

const props = defineProps({
  startNode: { type: Object, required: true },
  endNode: { type: Object, required: true },
  cardWidth: { type: Number, required: true }, // End node dimensions
  cardHeight: { type: Number, required: true }, // End node dimensions
  startCardWidth: { type: Number, required: true }, // Start node dimensions
  startCardHeight: { type: Number, required: true }, // Start node dimensions
  endLodLevel: { type: String, default: 'full' }, // End node LOD level
  startLodLevel: { type: String, default: 'full' }, // Start node LOD level
  isActive: { type: Boolean, default: false },
  zoomLevel: { type: Number, default: 1 },
  isSourceNodeExpanded: { type: Boolean, default: true }
})

// State
const isEditing = ref(false)
const labelInput = ref('')
const customLabel = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const isHovered = ref(false)

// Theme store for accessing theme colors
const themeStore = useThemeStore()
const canvasStore = useCanvasStore()
const currentThemeName = ref<ThemeName>('light')
const isThemeDark = ref(false)


// Visibility state
let isVisible = true

// Constants
const baseStroke = 2
const baseFontSize = 14
const labelOffset = 12

// Dynamic theme-based colors
const themeColors = computed(() => {
  return themeStore.getThemeColors(currentThemeName.value)
})

const isLightBackground = computed(() => !isThemeDark.value)

// Active color - use theme-specific vibrant colors
const activePathColor = computed(() => {
  const colors = themeColors.value
  
  // Theme-specific active path colors for maximum visibility
  switch (currentThemeName.value) {
    // Light themes
    case 'light': return colors.primary
    case 'cupcake': return colors.primary
    case 'bumblebee': return colors.secondary // Darker orange
    case 'emerald': return colors.primary
    case 'corporate': return colors.primary
    case 'garden': return colors.primary
    case 'lofi': return '#333333'
    case 'pastel': return '#9b7aa8' // Muted purple
    case 'fantasy': return colors.primary
    case 'wireframe': return '#666666'
    case 'lemonade': return colors.primary
    
    // Dark themes
    case 'dark': return colors.secondary // Pink
    case 'synthwave': return colors.primary // Magenta
    case 'retro': return colors.accent
    case 'cyberpunk': return colors.primary // Cyan
    case 'valentine': return colors.primary
    case 'halloween': return colors.primary
    case 'forest': return colors.primary
    case 'aqua': return colors.primary
    case 'black': return colors.accent
    case 'luxury': return colors.accent // Gold
    case 'dracula': return colors.primary
    case 'cmyk': return colors.primary
    case 'autumn': return colors.accent
    case 'business': return colors.accent
    case 'acid': return colors.primary
    case 'night': return colors.secondary
    case 'coffee': return colors.secondary
    case 'winter': return colors.primary
    
    default: return colors.primary
  }
})

// Inactive path color with theme-appropriate contrast
const inactivePathColor = computed(() => {
  // Theme-specific inactive colors
  switch (currentThemeName.value) {
    // Light themes - darker muted colors
    case 'light':
    case 'corporate':
    case 'emerald':
      return 'rgba(60, 60, 70, 0.4)'
    case 'cupcake':
    case 'pastel':
      return 'rgba(140, 120, 140, 0.4)'
    case 'bumblebee':
    case 'lemonade':
      return 'rgba(100, 80, 40, 0.4)'
    case 'garden':
    case 'fantasy':
      return 'rgba(80, 90, 80, 0.4)'
    case 'lofi':
    case 'wireframe':
      return 'rgba(40, 40, 40, 0.4)'
      
    // Dark themes - lighter muted colors
    case 'dark':
    case 'business':
      return 'rgba(180, 180, 200, 0.4)'
    case 'synthwave':
    case 'cyberpunk':
    case 'acid':
      return 'rgba(150, 150, 200, 0.3)'
    case 'retro':
    case 'autumn':
      return 'rgba(200, 180, 160, 0.4)'
    case 'valentine':
    case 'dracula':
      return 'rgba(200, 150, 180, 0.4)'
    case 'halloween':
      return 'rgba(180, 120, 80, 0.4)'
    case 'forest':
    case 'aqua':
      return 'rgba(150, 200, 180, 0.4)'
    case 'black':
      return 'rgba(120, 120, 120, 0.4)'
    case 'luxury':
      return 'rgba(180, 160, 120, 0.4)'
    case 'cmyk':
      return 'rgba(180, 180, 180, 0.4)'
    case 'night':
      return 'rgba(160, 170, 200, 0.4)'
    case 'coffee':
      return 'rgba(180, 160, 140, 0.4)'
    case 'winter':
      return 'rgba(180, 200, 220, 0.4)'
      
    default:
      return isLightBackground.value ? 'rgba(60, 60, 60, 0.4)' : 'rgba(200, 200, 200, 0.4)'
  }
})

// Glow effect color based on theme
const glowColor = computed(() => {
  const colors = themeColors.value
  
  // Special glow colors for themes
  switch (currentThemeName.value) {
    case 'cyberpunk': return '#00FFFF'
    case 'synthwave': return '#FF00FF'
    case 'acid': return '#00FF00'
    case 'valentine': return '#FF1493'
    case 'halloween': return '#FF4500'
    case 'dracula': return '#BD93F9'
    case 'luxury': return '#FFD700'
    case 'aqua': return '#00CED1'
    case 'neon': return colors.accent
    default: return colors.accent
  }
})

// REMOVED: The entire unreliable detectCanvasColor function is gone.

// Geometry
const isLeftBranch = computed(() => props.endNode.type === 'left-branch')

const connectionPoints = computed(() => {
  // Explicitly reference all reactive dependencies
  const startNodeX = props.startNode.x
  const startNodeY = props.startNode.y
  const endNodeX = props.endNode.x
  const endNodeY = props.endNode.y
  const endCardWidth = props.cardWidth
  const endCardHeight = props.cardHeight
  const startCardWidth = props.startCardWidth
  const startCardHeight = props.startCardHeight
  const isSourceExpanded = props.isSourceNodeExpanded
  const isLeft = isLeftBranch.value
  
  const idx = props.endNode.branchMessageIndex ?? 0
  
  // Calculate yOff based on specific LOD level
  let yOff;
  switch (props.startLodLevel) {
    case 'block':
      // Very small spacing for block LOD
      yOff = isSourceExpanded ? Math.min(idx * 15 + 8, startCardHeight / 2) : startCardHeight / 2;
      break;
    case 'summary':
      // Medium spacing for summary LOD
      yOff = isSourceExpanded ? Math.min(idx * 30 + 15, startCardHeight / 2) : startCardHeight / 2;
      break;
    case 'full':
    default:
      // Full spacing for full LOD
      yOff = isSourceExpanded ? idx * 120 + 40 : 40;
      break;
  }

  const startPoint = {
    x: isLeft ? startNodeX - 1 : startNodeX + startCardWidth + 1,
    y: startNodeY + Math.min(yOff, startCardHeight - 10)
  }

  const endPoint = {
    x: endNodeX + (isLeft ? endCardWidth - 1 : 1), // Stop 1px before the edge
    y: endNodeY + endCardHeight / 2
  }


  return { startPoint, endPoint }
})

function calculateConnectionPoints() {
  return connectionPoints.value
}

const pathAndControlPoints = computed(() => {
  const { startPoint, endPoint } = calculateConnectionPoints()
  const dx = endPoint.x - startPoint.x
  const dy = endPoint.y - startPoint.y
  const dist = Math.hypot(dx, dy)
  
  // Improved curve calculation for better visual flow
  const cpDist = Math.min(dist * 0.5, 300) // Slightly less aggressive curve
  const vert = Math.min(Math.abs(dy) * 0.2, 60) * (dy < 0 ? -1 : 1) // Reduced vertical influence

  const controlPoint1 = {
    x: startPoint.x + (isLeftBranch.value ? -cpDist : cpDist),
    y: startPoint.y + vert * 0.5 // Smoother transition
  }
  const controlPoint2 = {
    x: endPoint.x + (isLeftBranch.value ? cpDist * 0.6 : -cpDist * 0.6), // Asymmetric for better flow
    y: endPoint.y - vert * 0.5
  }

  // Clean up path formatting for better performance
  const path = `M${startPoint.x.toFixed(1)},${startPoint.y.toFixed(1)}C${controlPoint1.x.toFixed(1)},${controlPoint1.y.toFixed(1)},${controlPoint2.x.toFixed(1)},${controlPoint2.y.toFixed(1)},${endPoint.x.toFixed(1)},${endPoint.y.toFixed(1)}`

  return { startPoint, endPoint, controlPoint1, controlPoint2, path }
})

const pathData = computed(() => pathAndControlPoints.value.path)
const reversedPathData = computed(() => {
  const { startPoint, endPoint, controlPoint1, controlPoint2 } =
    pathAndControlPoints.value
  return `M ${endPoint.x} ${endPoint.y}
          C ${controlPoint2.x} ${controlPoint2.y},
            ${controlPoint1.x} ${controlPoint1.y},
            ${startPoint.x} ${startPoint.y}`
})

// Styling - consistent across all zoom levels
const strokeWidth = computed(() => {
  return baseStroke * (props.isActive ? 1.5 : 1) // Only scale for active state
})

const dashPattern = computed(() => {
  return "4 6" // Consistent dash pattern regardless of zoom
})
const fontSize = computed(() => baseFontSize) // Consistent font size regardless of zoom

// Gradient coordinates for directional flow from parent to child
const gradientCoords = computed(() => {
  const { startPoint, endPoint } = calculateConnectionPoints()
  
  return {
    x1: startPoint.x,
    y1: startPoint.y,
    x2: endPoint.x,
    y2: endPoint.y
  }
})

// Compute glow intensity based on theme
const glowIntensity = computed(() => {
  switch (currentThemeName.value) {
    case 'cyberpunk':
    case 'synthwave':
    case 'acid':
      return 8
    case 'neon':
    case 'valentine':
      return 6
    default:
      return 4
  }
})

// Check if theme should use neon-style glows
function shouldUseNeonGlow(): boolean {
  const neonThemes = ['cyberpunk', 'synthwave', 'acid', 'valentine', 'halloween', 'dracula']
  return neonThemes.includes(currentThemeName.value)
}

// Get particle color with enhanced visibility
function getParticleColor(): string {
  const colors = themeColors.value
  
  // For particles, we want them to stand out more than the paths
  switch (currentThemeName.value) {
    // Light themes - use vibrant theme colors
    case 'light': return colors.primary
    case 'cupcake': return colors.secondary // Pink
    case 'bumblebee': return colors.primary // Yellow
    case 'emerald': return colors.accent // Red for contrast
    case 'corporate': return colors.primary
    case 'garden': return colors.secondary // Red accent
    case 'lofi': return '#666666'
    case 'pastel': return colors.secondary // Pink
    case 'fantasy': return colors.secondary // Orange
    case 'wireframe': return '#333333'
    case 'lemonade': return colors.secondary // Bright yellow
    
    // Dark themes - use bright accent colors
    case 'dark': return colors.accent // Teal
    case 'synthwave': return colors.accent // Yellow
    case 'retro': return colors.primary // Chocolate
    case 'cyberpunk': return colors.accent // Lime
    case 'valentine': return colors.accent // Light pink
    case 'halloween': return colors.accent // Lime green
    case 'forest': return colors.accent // Lighter green
    case 'aqua': return colors.primary // Bright cyan
    case 'black': return colors.accent // Light gray
    case 'luxury': return colors.accent // Gold
    case 'dracula': return colors.accent // Green
    case 'cmyk': return colors.accent // Yellow
    case 'autumn': return colors.primary // Brown
    case 'business': return colors.accent // Light blue
    case 'acid': return colors.accent // Yellow
    case 'night': return colors.accent // Purple
    case 'coffee': return colors.accent // Light coffee
    case 'winter': return colors.accent // Emerald
    
    default: return props.isActive ? colors.accent : colors.secondary
  }
}

// Get particle glow color for enhanced effects
function getParticleGlowColor(): string {
  const colors = themeColors.value
  
  switch (currentThemeName.value) {
    case 'cyberpunk': return '#ADFF2F' // Lime glow
    case 'synthwave': return '#FFFF00' // Yellow glow
    case 'acid': return '#00FF00' // Green glow
    case 'valentine': return '#FFB6C1' // Light pink glow
    case 'halloween': return '#32CD32' // Lime green glow
    case 'dracula': return '#50FA7B' // Green glow
    case 'luxury': return '#FFD700' // Gold glow
    case 'aqua': return '#09ECF3' // Cyan glow
    default: return colors.accent
  }
}

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Get input background color based on theme
function getInputBackgroundColor(): string {
  switch (currentThemeName.value) {
    // Light themes
    case 'light':
    case 'corporate':
    case 'emerald':
      return 'rgba(255, 255, 255, 0.95)'
    case 'cupcake':
      return 'rgba(255, 245, 250, 0.95)'
    case 'bumblebee':
      return 'rgba(255, 250, 240, 0.95)'
    case 'pastel':
      return 'rgba(250, 245, 255, 0.95)'
    case 'garden':
    case 'lemonade':
      return 'rgba(245, 255, 245, 0.95)'
    case 'lofi':
    case 'wireframe':
      return 'rgba(250, 250, 250, 0.95)'
    case 'fantasy':
      return 'rgba(255, 245, 245, 0.95)'
      
    // Dark themes
    case 'dark':
    case 'business':
      return 'rgba(30, 30, 40, 0.95)'
    case 'synthwave':
      return 'rgba(20, 10, 40, 0.95)'
    case 'cyberpunk':
      return 'rgba(10, 20, 30, 0.95)'
    case 'acid':
      return 'rgba(20, 20, 10, 0.95)'
    case 'retro':
    case 'autumn':
      return 'rgba(40, 30, 20, 0.95)'
    case 'valentine':
    case 'dracula':
      return 'rgba(40, 20, 30, 0.95)'
    case 'halloween':
      return 'rgba(30, 20, 10, 0.95)'
    case 'forest':
    case 'aqua':
      return 'rgba(10, 30, 30, 0.95)'
    case 'black':
      return 'rgba(20, 20, 20, 0.95)'
    case 'luxury':
      return 'rgba(30, 25, 15, 0.95)'
    case 'cmyk':
      return 'rgba(20, 20, 30, 0.95)'
    case 'night':
      return 'rgba(20, 20, 40, 0.95)'
    case 'coffee':
      return 'rgba(30, 25, 20, 0.95)'
    case 'winter':
      return 'rgba(20, 30, 40, 0.95)'
      
    default:
      return isLightBackground.value ? 'rgba(255, 255, 255, 0.95)' : 'rgba(30, 30, 30, 0.95)'
  }
}

// Get label color with proper contrast for all themes
function getLabelColor(): string {
  // Use theme colors for maximum visibility
  const colors = themeColors.value
  
  switch (currentThemeName.value) {
    // Light themes - use darker variants of theme colors
    case 'light':
      return '#570DF8' // Deep purple
    case 'cupcake':
      return '#65C3C8' // Teal
    case 'bumblebee':
      return '#181830' // Use accent (dark) for contrast
    case 'emerald':
      return '#377CFB' // Blue secondary
    case 'corporate':
      return '#4B6BFB' // Primary blue
    case 'garden':
      return '#5c7f67' // Forest green
    case 'lofi':
      return '#0D0D0D' // Near black
    case 'pastel':
      return '#7c6882' // Darker variant of pastel purple
    case 'fantasy':
      return '#6D0A0A' // Deep red
    case 'wireframe':
      return '#595959' // Dark gray
    case 'lemonade':
      return '#519903' // Dark lime
      
    // Dark themes - use brighter/vibrant variants
    case 'dark':
      return '#F471B5' // Bright pink secondary
    case 'synthwave':
      return '#FF00FF' // Magenta
    case 'retro':
      return '#F4A460' // Sandy brown accent
    case 'cyberpunk':
      return '#00FFFF' // Cyan
    case 'valentine':
      return '#FFB6C1' // Light pink accent
    case 'halloween':
      return '#FF8C00' // Dark orange
    case 'forest':
      return '#1EB854' // Bright green
    case 'aqua':
      return '#09ECF3' // Bright cyan
    case 'black':
      return '#999999' // Light gray accent
    case 'luxury':
      return '#FFD700' // Gold accent
    case 'dracula':
      return '#FF79C6' // Pink
    case 'cmyk':
      return '#FFEB3B' // Yellow accent
    case 'autumn':
      return '#CD853F' // Peru accent
    case 'business':
      return '#60A5FA' // Light blue accent
    case 'acid':
      return '#FFFF00' // Yellow
    case 'night':
      return '#C084FC' // Purple accent
    case 'coffee':
      return '#DAC3B3' // Light coffee accent
    case 'winter':
      return '#10B981' // Emerald accent
      
    default:
      return colors.primary
  }
}

// Label content
const hasLabel = computed(() => customLabel.value || getDefaultLabel())

function getDefaultLabel() {
  const idx = props.endNode.branchMessageIndex ?? 0
  const msg = props.startNode.messages?.[idx]?.content ?? ''
  const words = msg.split(' ').slice(0, 3).join(' ')
  return words.length > 20 ? `${words.slice(0, 20)}…` : words || ''
}

function getLabelText() {
  if (customLabel.value) return customLabel.value
  const defaultLabel = getDefaultLabel()
  return defaultLabel || `Branch ${(props.endNode.branchMessageIndex ?? 0) + 1}`
}

const inputWidth = computed(() => {
  const w = labelInput.value.length * fontSize.value * 0.6
  return Math.max(50, Math.min(300 / props.zoomLevel, w / props.zoomLevel))
})
const inputHeight = computed(() => (fontSize.value * 1.5) / props.zoomLevel)

const labelPosition = computed(() => {
  const { startPoint, endPoint } = connectionPoints.value
  const midX =
    startPoint.x + (endPoint.x - startPoint.x) / 2 +
    (isLeftBranch.value ? -inputWidth.value : 0)
  const midY =
    startPoint.y + (endPoint.y - startPoint.y) / 2 -
    inputHeight.value / 2 -
    labelOffset
  return { x: midX, y: midY }
})

function calculateLabelPosition() {
  return labelPosition.value
}

// Event handlers
function handleLabelDoubleClick(e: MouseEvent) {
  e.stopPropagation()
  e.preventDefault()
  if (!isEditing.value) {
    isEditing.value = true
    labelInput.value = customLabel.value || getLabelText()
    nextTick(() => inputRef.value?.focus())
  }
}

function handleLabelBlur() {
  if (labelInput.value.trim()) customLabel.value = labelInput.value.trim()
  isEditing.value = false
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') handleLabelBlur()
  else if (e.key === 'Escape') isEditing.value = false
}

// Simple double-click handler
function handleSimpleDoubleClick(e: MouseEvent) {
  e.stopPropagation()
  e.preventDefault()
  
  console.log('Spline double-clicked!')
  
  // If no custom label exists, create a default one
  if (!customLabel.value && !getDefaultLabel()) {
    customLabel.value = `Branch ${(props.endNode.branchMessageIndex ?? 0) + 1}`
  }
  
  // Trigger label editing
  if (!isEditing.value) {
    isEditing.value = true
    labelInput.value = customLabel.value || getLabelText()
    nextTick(() => inputRef.value?.focus())
  }
}

// Calculate visual stroke width based on state
function getVisualStrokeWidth() {
  let width = strokeWidth.value
  if (isHovered.value && !props.isActive) width *= 1.2 // Only add hover effect if not active
  return width
}


// Setup intersection observer
function setupObserver() {
  if (typeof IntersectionObserver === 'undefined') return
  const id = `connection-path-${props.startNode.id}-${props.endNode.id}`
  const svg = document.querySelector(`#${id}`)?.closest('svg')
  if (!svg) return
  const obs = new IntersectionObserver(
    es => (isVisible = es[0].isIntersecting),
    { threshold: 0.1 }
  )
  obs.observe(svg)
  return () => obs.disconnect()
}

// Performance optimized watch - only update when positions actually change
let lastPositions = { sx: 0, sy: 0, ex: 0, ey: 0 }
let frameRequested = false

watch(
  () => [
    props.startNode.x,
    props.startNode.y,
    props.endNode.x,
    props.endNode.y
  ],
  ([sx, sy, ex, ey]) => {
    // Only trigger updates if position changed significantly (> 0.5px)
    const changed = 
      Math.abs(sx - lastPositions.sx) > 0.5 ||
      Math.abs(sy - lastPositions.sy) > 0.5 ||
      Math.abs(ex - lastPositions.ex) > 0.5 ||
      Math.abs(ey - lastPositions.ey) > 0.5
    
    if (changed && !frameRequested) {
      frameRequested = true
      requestAnimationFrame(() => {
        lastPositions = { sx, sy, ex, ey }
        frameRequested = false
        // Paths update automatically via computed properties
      })
    }
  },
  { flush: 'post' } // Use post-flush for better performance
)

// Lifecycle
onMounted(() => {
  const stopObs = setupObserver()
  
  // Enhanced theme detection with full theme name support
  const updateTheme = () => {
    const theme = document.documentElement.getAttribute('data-theme') as ThemeName || 'light'
    currentThemeName.value = theme
    isThemeDark.value = themeStore.isDarkTheme(theme)
  }
  
  const themeObserver = new MutationObserver(updateTheme)
  
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme']
  })
  
  // Initial theme check
  updateTheme()
  
  // Listen for spline double-click events from interaction layer
  const handleInteractionLayerClick = (data: any) => {
    if (data.parentId === props.startNode.id && data.childId === props.endNode.id) {
      handleSimpleDoubleClick(new MouseEvent('dblclick'))
    }
  }
  
  // Listen for spline hover events from interaction layer
  const handleInteractionLayerHover = (data: any) => {
    if (data.parentId === props.startNode.id && data.childId === props.endNode.id) {
      isHovered.value = data.isHovering
    }
  }
  
  emitter.on('spline-double-click', handleInteractionLayerClick)
  emitter.on('spline-hover', handleInteractionLayerHover)

  onBeforeUnmount(() => {
    stopObs && stopObs()
    themeObserver.disconnect()
    emitter.off('spline-double-click', handleInteractionLayerClick)
    emitter.off('spline-hover', handleInteractionLayerHover)
  })
})
</script>

<style scoped>
.text-container {
  pointer-events: none;
}

textPath.reversed {
  transform: scale(1, -1);
}

.label-container {
  isolation: isolate;
}

.label-container * {
  touch-action: manipulation;
}

/* Simple input styling */
input {
  transition: all 0.2s ease;
  pointer-events: auto;
  z-index: 30;
}

input:focus {
  outline: none;
}

/* Theme-specific enhancements */
path {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Neon glow animation for specific themes */
@keyframes neon-pulse {
  0%, 100% {
    filter: brightness(1) drop-shadow(0 0 4px currentColor);
  }
  50% {
    filter: brightness(1.2) drop-shadow(0 0 8px currentColor);
  }
}

.label-text {
  transition: all 0.2s ease;
}

/* Make sure pointer events work */
.pointer-events-auto {
  pointer-events: all !important;
}

.label-container {
  pointer-events: all !important;
}

.label-text {
  pointer-events: all !important;
  cursor: pointer !important;
}

/* Hover effects for spline */
.connector-path.hovered-path {
  filter: brightness(1.2);
  animation: splinePulse 1.5s ease-in-out infinite;
}

@keyframes splinePulse {
  0%, 100% {
    opacity: 1;
    filter: brightness(1.2);
  }
  50% {
    opacity: 0.85;
    filter: brightness(1.3);
  }
}

/* Interaction area visual feedback */
.spline-interaction-area {
  transition: all 0.2s ease;
}

/* Debug visualization (uncomment to see hitbox) */
/*
.spline-interaction-area rect {
  fill: rgba(255, 0, 0, 0.1);
  stroke: red;
  stroke-width: 1;
}
*/
</style>