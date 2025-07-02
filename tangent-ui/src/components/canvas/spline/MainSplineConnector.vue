<template>
  <g class="pointer-events-auto">
    <!-- Glow effect for active paths -->
    <defs v-if="isActive">
      <filter :id="`glow-${startNode.id}-${endNode.id}`">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    <!-- Main dashed path with theme-aware styling -->
    <path
      :d="pathData"
      :stroke="isActive ? activePathColor : inactivePathColor"
      :stroke-width="strokeWidth"
      :stroke-dasharray="dashPattern"
      fill="none"
      :opacity="isActive ? 0.9 : 0.6"
      :filter="isActive ? `url(#glow-${startNode.id}-${endNode.id})` : ''"
      class="transition-all duration-300"
      :style="{
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        ...(isActive && shouldUseNeonGlow() ? {
          filter: `drop-shadow(0 0 ${glowIntensity}px ${glowColor})`
        } : {})
      }"
    />

    <!-- Particles -->
    <g v-for="particle in particles" :key="particle.id">
      <circle
        v-if="!isNaN(particle.x) && !isNaN(particle.y) && !isNaN(particleRadius)"
        :cx="particle.x"
        :cy="particle.y"
        :r="particleRadius"
        :fill="getParticleColor()"
        :style="{
          ...(shouldUseNeonGlow() ? {
            filter: `drop-shadow(0 0 4px ${getParticleGlowColor()})`,
            mixBlendMode: 'screen'
          } : {})
        }"
      >
        <animate
          attributeName="opacity"
          :values="shouldUseNeonGlow() ? '1;0.6;1' : '0.9;0.4;0.9'"
          :dur="particle.duration"
          repeatCount="indefinite"
        />
      </circle>
    </g>

    <!-- Hidden path for text alignment -->
    <path
      :id="`connection-path-${startNode.id}-${endNode.id}`"
      :d="isLeftBranch ? reversedPathData : pathData"
      fill="none"
      stroke="none"
      pointer-events="none"
    />

    <!-- Label with contrast background -->
    <g class="label-container" v-if="hasLabel" style="pointer-events:auto;z-index:10">
      
      <!-- A single, clean text element. -->
      <text class="text-container">
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
        :x="calculateLabelPosition().x"
        :y="calculateLabelPosition().y"
        :width="300 / Math.min(1, zoomLevel)"
        :height="50 / Math.min(1, zoomLevel)"
        @dblclick.stop
        style="z-index:20;pointer-events:auto"
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
import { debounce } from 'lodash'
import { useThemeStore } from '@/stores/themeStore'
import { useCanvasStore } from '@/stores/canvasStore'
import type { ThemeName } from '@/stores/themeStore'

const props = defineProps({
  startNode: { type: Object, required: true },
  endNode: { type: Object, required: true },
  cardWidth: { type: Number, required: true },
  cardHeight: { type: Number, required: true },
  isActive: { type: Boolean, default: false },
  zoomLevel: { type: Number, default: 1 },
  isSourceNodeExpanded: { type: Boolean, default: true }
})

// State
const isEditing = ref(false)
const labelInput = ref('')
const customLabel = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const particles = ref<Particle[]>([])

// Theme store for accessing theme colors
const themeStore = useThemeStore()
const canvasStore = useCanvasStore()
const currentThemeName = ref<ThemeName>('light')
const isThemeDark = ref(false)


// Animation state
let animationFrame: number | null = null
let loopGen = 0
let isVisible = true

// Constants
const baseStroke = 2
const baseFontSize = 14
const baseParticleRadius = 3
const baseParticleSpeed = 0.002
const numParticles = 2 // Reduced from 4 to 2 for performance
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

function calculateConnectionPoints() {
  const idx = props.endNode.branchMessageIndex ?? 0
  const yOff = props.isSourceNodeExpanded ? idx * 120 + 40 : 40

  const startPoint = {
    x: isLeftBranch.value
      ? props.startNode.x - 1
      : props.startNode.x + props.cardWidth + 1,
    y: props.startNode.y + yOff
  }

  const endPoint = {
    x: props.endNode.x + (isLeftBranch.value ? props.cardWidth : 0),
    y: props.endNode.y + props.cardHeight / 2
  }

  return { startPoint, endPoint }
}

const pathAndControlPoints = computed(() => {
  const { startPoint, endPoint } = calculateConnectionPoints()
  const dx = endPoint.x - startPoint.x
  const dy = endPoint.y - startPoint.y
  const dist = Math.hypot(dx, dy)
  const cpDist = Math.min(dist * 0.8, 200)
  const vert = Math.min(Math.abs(dy), 100) * (dy < 0 ? -1 : 1)

  const controlPoint1 = {
    x: startPoint.x + (isLeftBranch.value ? -cpDist : cpDist),
    y: startPoint.y + vert
  }
  const controlPoint2 = {
    x: endPoint.x + (isLeftBranch.value ? cpDist : -cpDist),
    y: endPoint.y - vert
  }

  const path = `M ${startPoint.x} ${startPoint.y}
                C ${controlPoint1.x} ${controlPoint1.y},
                  ${controlPoint2.x} ${controlPoint2.y},
                  ${endPoint.x} ${endPoint.y}`

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

// Styling
const strokeWidth = computed(() => {
  const scale = 1 / Math.pow(props.zoomLevel, 1.2)
  return baseStroke * Math.min(scale, 4)
})
const dashPattern = computed(() => {
  const scale = 1 / Math.pow(props.zoomLevel, 1.2)
  return `${4 * Math.min(scale, 4)} ${6 * Math.min(scale, 4)}`
})
const particleRadius = computed(() => {
  const scale = 1 / Math.pow(props.zoomLevel, 2.2)
  return baseParticleRadius * Math.min(scale, 3)
})
const fontSize = computed(() =>
  Math.max(baseFontSize * (1 / Math.min(1, props.zoomLevel)), baseFontSize)
)

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

function calculateLabelPosition() {
  const { startPoint, endPoint } = calculateConnectionPoints()
  const midX =
    startPoint.x + (endPoint.x - startPoint.x) / 2 +
    (isLeftBranch.value ? -inputWidth.value : 0)
  const midY =
    startPoint.y + (endPoint.y - startPoint.y) / 2 -
    inputHeight.value / 2 -
    labelOffset
  return { x: midX, y: midY }
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

// Particle animation
interface Particle {
  id: number
  progress: number
  speed: number
  duration: string
  x: number
  y: number
}

function getParticleSpeed() {
  const scale = 1 / Math.max(0.5, props.zoomLevel)
  return Math.min(baseParticleSpeed * scale, baseParticleSpeed * 3)
}

function initializeParticles() {
  const base = getParticleSpeed()
  const arr: Particle[] = []
  for (let i = 0; i < numParticles; i++) {
    arr.push({
      id: i,
      progress: i / numParticles,
      speed: base + Math.random() * base * 0.5,
      duration: `${0.8 + Math.random() * 0.4}s`,
      x: 0,
      y: 0
    })
  }
  particles.value = arr
}

function animateParticles(myGen: number) {
  if (myGen !== loopGen) return

  // MAJOR OPTIMIZATION: Skip if not visible or zoomed out too much
  if (!pathAndControlPoints.value || props.zoomLevel < 0.1 || !isVisible) {
    // Use slower update rate when not visible or zoomed out
    setTimeout(() => animateParticles(myGen), 100) // 10fps instead of 60fps
    return
  }

  const { startPoint, endPoint, controlPoint1, controlPoint2 } =
    pathAndControlPoints.value

  // OPTIMIZATION: Reduce particle calculations per frame
  const frameSkip = props.zoomLevel < 0.5 ? 2 : 1 // Skip every other frame when zoomed out
  
  if (Date.now() % frameSkip === 0) {
    particles.value.forEach(p => {
      p.progress += p.speed
      if (p.progress > 1) p.progress -= 1

      const t = p.progress
      const t1 = 1 - t
      
      // Pre-calculate powers for better performance
      const t2 = t * t
      const t3 = t2 * t
      const t1_2 = t1 * t1
      const t1_3 = t1_2 * t1
      
      p.x = t1_3 * startPoint.x + 3 * t1_2 * t * controlPoint1.x + 3 * t1 * t2 * controlPoint2.x + t3 * endPoint.x
      p.y = t1_3 * startPoint.y + 3 * t1_2 * t * controlPoint1.y + 3 * t1 * t2 * controlPoint2.y + t3 * endPoint.y
    })
  }

  // Use variable frame rate based on zoom level
  const targetFPS = props.zoomLevel > 0.8 ? 60 : 30
  const delay = 1000 / targetFPS
  
  if (delay > 16) {
    setTimeout(() => animateParticles(myGen), delay)
  } else {
    animationFrame = requestAnimationFrame(() => animateParticles(myGen))
  }
}

function resetAnimation() {
  loopGen++
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
  initializeParticles()
  animateParticles(loopGen)
}

const debouncedResetAnimation = debounce(resetAnimation, 100)

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

// Watch for changes
watch(
  () => [
    props.startNode.x,
    props.startNode.y,
    props.endNode.x,
    props.endNode.y,
    props.zoomLevel
  ],
  () => {
    // Use immediate updates during drag operations for responsive spline rendering
    if (canvasStore.isDragging) {
      resetAnimation()
    } else {
      debouncedResetAnimation()
    }
  }
)

// Lifecycle
onMounted(() => {
  const stopObs = setupObserver()
  emitter.on('workspace-opened', resetAnimation)
  
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
  
  resetAnimation()

  onBeforeUnmount(() => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame)
    stopObs && stopObs()
    emitter.off('workspace-opened', resetAnimation)
    debouncedResetAnimation.cancel()
    themeObserver.disconnect()
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

/* Enhanced particle glow for neon themes */
circle {
  mix-blend-mode: screen;
}
</style>