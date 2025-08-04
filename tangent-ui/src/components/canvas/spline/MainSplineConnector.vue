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
    
    <!-- Interactive connection circle at start point -->
    <g 
      v-if="!isDragging && shouldShowConnectionCircle"
      :transform="`translate(${connectionPoint.x}, ${connectionPoint.y})`"
      @mouseenter="handleConnectionHover(true)"
      @mouseleave="handleConnectionHover(false)"
      @mousedown.stop="startDrag"
      style="cursor: grab; pointer-events: all;"
    >
      <!-- Outer glow circle -->
      <circle
        r="8"
        :fill="connectionCircleColor"
        :opacity="isConnectionHovered ? 0.3 : 0.1"
        :style="{
          filter: isConnectionHovered ? `blur(4px)` : 'blur(2px)',
          transition: 'all 0.2s ease'
        }"
      />
      <!-- Inner circle -->
      <circle
        r="4"
        :fill="connectionCircleColor"
        :opacity="isConnectionHovered ? 1 : 0.4"
        :style="{
          transition: 'all 0.2s ease'
        }"
      />
    </g>
    


    <!-- Hidden path for text alignment -->
    <path
      :id="pathId"
      :d="isLeftBranch ? reversedPathData : pathData"
      :key="pathId"
      fill="none"
      stroke="none"
      pointer-events="none"
    />

    <!-- Enhanced glow path (always visible with constant intensity) -->
    <path
      :d="pathData"
      :stroke="`url(#connection-gradient-${startNode.id}-${endNode.id})`"
      :stroke-width="strokeWidth * 6"
      :stroke-dasharray="dashPattern"
      fill="none"
      class="glow-path"
      :style="{
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        filter: `blur(${strokeWidth * 1.5}px)`,
        opacity: 0.8,
        pointerEvents: 'none'
      }"
    />

    <!-- Label with contrast background -->
    <g class="label-container" v-if="hasLabel" style="pointer-events: all; z-index: 10;">
      
      <!-- A single, clean text element. -->
      <text class="text-container" style="pointer-events: all;">
        <textPath
          :href="`#${pathId}`"
          :key="`textpath-${pathId}`"
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
        :width="300 / Math.max(props.zoomLevel, 0.1)"
        :height="50 / Math.max(props.zoomLevel, 0.1)"
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
  isSourceNodeExpanded: { type: Boolean, default: true },
  curvature: { type: Number, default: 0.5 } // Curvature factor (0 = straight, 1 = moderate, 3 = extremely curvy)
})

// State
const isEditing = ref(false)
const labelInput = ref('')
const customLabel = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const isHovered = ref(false)
const isConnectionHovered = ref(false)
const isDragging = ref(false)
const dragPosition = ref({ x: 0, y: 0 })

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
  // Use node coordinates directly (should be fixed by canvas store migration)
  const startNodeX = Number(props.startNode?.x) || 0
  const startNodeY = Number(props.startNode?.y) || 0
  // Use drag position if dragging, otherwise use actual end node position
  const endNodeX = isDragging.value ? dragPosition.value.x : (Number(props.endNode?.x) || 0)
  const endNodeY = isDragging.value ? dragPosition.value.y : (Number(props.endNode?.y) || 0)
  const endCardWidth = Number(props.cardWidth) || 300
  const endCardHeight = Number(props.cardHeight) || 200
  const startCardWidth = Number(props.startCardWidth) || 300
  const startCardHeight = Number(props.startCardHeight) || 200
  const isSourceExpanded = Boolean(props.isSourceNodeExpanded)
  const isLeft = isLeftBranch.value
  
  // console.log('[MainSplineConnector] Node coordinates and dimensions:', {
  //   startNode: { 
  //     id: props.startNode?.id, 
  //     x: startNodeX, 
  //     y: startNodeY,
  //     type: props.startNode?.type,
  //     cardWidth: startCardWidth,
  //     cardHeight: startCardHeight
  //   },
  //   endNode: { 
  //     id: props.endNode?.id, 
  //     x: endNodeX, 
  //     y: endNodeY,
  //     type: props.endNode?.type,
  //     cardWidth: endCardWidth,
  //     cardHeight: endCardHeight
  //   }
  // })
  
  const idx = Number(props.endNode?.branchMessageIndex) || 0
  
  // Calculate yOff based on specific LOD level
  let yOff;
  switch (props.startLodLevel) {
    case 'cluster':
      // Cluster LOD: tiny squares, connect from center
      yOff = startCardHeight / 2;
      break;
    case 'compact':
      // Compact LOD: small cards, connect from center
      yOff = startCardHeight / 2;
      break;
    case 'preview':
      // Preview LOD: medium cards, connect from center with slight offset
      yOff = isSourceExpanded ? Math.min(idx * 20 + 15, startCardHeight / 2) : startCardHeight / 2;
      break;
    case 'full':
    default:
      // Full LOD: large cards, full spacing calculation
      yOff = isSourceExpanded ? idx * 120 + 40 : 40;
      break;
  }

  const startPoint = {
    x: isLeft ? startNodeX - 1 : startNodeX + startCardWidth + 1,
    y: startNodeY + Math.min(yOff, startCardHeight - 10)
  }

  let endPoint
  if (isDragging.value) {
    // When dragging, end point is exactly at cursor position (no card offset)
    endPoint = {
      x: endNodeX, // This is already dragPosition.x
      y: endNodeY  // This is already dragPosition.y
    }
  } else {
    // Normal connection to the actual end node with card offset
    // Adjust connection point based on end node LOD level
    let endY;
    switch (props.endLodLevel) {
      case 'cluster':
      case 'compact':
        // Connect to center for small nodes
        endY = endNodeY + endCardHeight / 2;
        break;
      case 'preview':
        // Connect slightly above center for preview nodes
        endY = endNodeY + endCardHeight * 0.4;
        break;
      case 'full':
      default:
        // Connect to center for full nodes
        endY = endNodeY + endCardHeight / 2;
        break;
    }
    
    endPoint = {
      x: endNodeX + (isLeft ? endCardWidth - 1 : 1), // Stop 1px before the edge
      y: endY
    }
  }

  // console.log('[MainSplineConnector] Final connection points:', {
  //   startPoint,
  //   endPoint,
  //   SVGPath: `M${startPoint.x.toFixed(1)},${startPoint.y.toFixed(1)}C...${endPoint.x.toFixed(1)},${endPoint.y.toFixed(1)}`
  // })

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
  
  // Customizable curve calculation based on curvature prop
  // curvature: 0 = straight line, 1 = moderate curve, 3 = extremely curvy
  const curvatureMultiplier = Math.max(0, props.curvature) // Allow values above 1 for extreme curves
  
  // Scale the base curve more dramatically for higher curvature values
  const baseCurveRatio = curvatureMultiplier <= 1 
    ? 0.1 + curvatureMultiplier * 0.8  // 0.1 to 0.9 for values 0-1
    : 0.9 + (curvatureMultiplier - 1) * 1.5  // 0.9 to 3.9 for values 1-3
  const baseCurve = dist * baseCurveRatio
  
  // Dramatically increase max curve distance for higher values
  const maxCurve = curvatureMultiplier <= 1
    ? 100 + curvatureMultiplier * 400  // 100px to 500px for values 0-1
    : 500 + (curvatureMultiplier - 1) * 800  // 500px to 2100px for values 1-3
  const cpDist = Math.min(baseCurve, maxCurve)
  
  // Increase vertical influence dramatically for higher curvature
  const verticalInfluence = curvatureMultiplier <= 1
    ? curvatureMultiplier * 0.3  // 0 to 0.3 for values 0-1
    : 0.3 + (curvatureMultiplier - 1) * 0.6  // 0.3 to 1.5 for values 1-3
  const maxVertical = curvatureMultiplier <= 1
    ? 60 * curvatureMultiplier  // 0 to 60px for values 0-1
    : 60 + (curvatureMultiplier - 1) * 100  // 60px to 260px for values 1-3
  const vert = Math.min(Math.abs(dy) * verticalInfluence, maxVertical) * (dy < 0 ? -1 : 1)

  const controlPoint1 = {
    x: startPoint.x + (isLeftBranch.value ? -cpDist : cpDist),
    y: startPoint.y + vert * 0.5
  }
  const controlPoint2 = {
    x: endPoint.x + (isLeftBranch.value ? cpDist * 0.6 : -cpDist * 0.6),
    y: endPoint.y - vert * 0.5
  }

  // Clean up path formatting for better performance with NaN safety
  const safeNum = (n) => isNaN(n) ? 0 : n
  const path = `M${safeNum(startPoint.x).toFixed(1)},${safeNum(startPoint.y).toFixed(1)}C${safeNum(controlPoint1.x).toFixed(1)},${safeNum(controlPoint1.y).toFixed(1)},${safeNum(controlPoint2.x).toFixed(1)},${safeNum(controlPoint2.y).toFixed(1)},${safeNum(endPoint.x).toFixed(1)},${safeNum(endPoint.y).toFixed(1)}`


  return { startPoint, endPoint, controlPoint1, controlPoint2, path }
})

const pathData = computed(() => pathAndControlPoints.value.path)
const reversedPathData = computed(() => {
  const { startPoint, endPoint, controlPoint1, controlPoint2 } =
    pathAndControlPoints.value
  const safeNum = (n) => isNaN(n) ? 0 : n
  return `M ${safeNum(endPoint.x)} ${safeNum(endPoint.y)}
          C ${safeNum(controlPoint2.x)} ${safeNum(controlPoint2.y)},
            ${safeNum(controlPoint1.x)} ${safeNum(controlPoint1.y)},
            ${safeNum(startPoint.x)} ${safeNum(startPoint.y)}`
})

// Styling - consistent across all zoom levels
const strokeWidth = computed(() => {
  // Implement spline LOD based on connected nodes
  const endLOD = props.endLodLevel
  const startLOD = props.startLodLevel
  
  // If either connected node is in cluster LOD, use very thin splines
  if (endLOD === 'cluster' || startLOD === 'cluster') {
    return baseStroke * 0.3 // Ultra-thin for cluster view
  }
  
  // If either node is in compact LOD, use thin splines  
  if (endLOD === 'compact' || startLOD === 'compact') {
    return baseStroke * 0.7 // Thinner for compact view
  }
  
  // If either node is in preview LOD, use medium splines
  if (endLOD === 'preview' || startLOD === 'preview') {
    return baseStroke * 1.0 // Normal thickness for preview
  }
  
  // Full LOD uses thick splines
  return baseStroke * 1.5 // Thick splines for full detail
})

const dashPattern = computed(() => {
  const endLOD = props.endLodLevel
  const startLOD = props.startLodLevel
  
  // Adjust dash pattern based on LOD level
  if (endLOD === 'cluster' || startLOD === 'cluster') {
    return "2 4" // Smaller dashes for cluster view
  }
  
  if (endLOD === 'compact' || startLOD === 'compact') {
    return "3 5" // Medium dashes for compact view
  }
  
  return "4 6" // Default dash pattern for preview and full LOD
})

// Connection point at the end node connection
const connectionPoint = computed(() => {
  const { endPoint } = connectionPoints.value
  return endPoint
})

// Connection circle color
const connectionCircleColor = computed(() => activePathColor.value)

// Show connection circle based on LOD levels
const shouldShowConnectionCircle = computed(() => {
  const endLOD = props.endLodLevel
  const startLOD = props.startLodLevel
  
  // Hide connection circles for cluster and compact views
  if (endLOD === 'cluster' || startLOD === 'cluster') {
    return false
  }
  
  if (endLOD === 'compact' || startLOD === 'compact') {
    return false
  }
  
  // Show connection circles for preview and full LOD
  return true
})

const fontSize = computed(() => {
  // Scale font size inversely with zoom level to maintain readability
  return baseFontSize / Math.max(props.zoomLevel, 0.1) // Prevent division by zero
})

// Compute unique path ID based on node positions
const pathId = computed(() => {
  return `connection-path-${props.startNode.id}-${props.endNode.id}-${Math.round(props.startNode.x)}-${Math.round(props.startNode.y)}-${Math.round(props.endNode.x)}-${Math.round(props.endNode.y)}`
})

// Gradient coordinates for directional flow from parent to child
const gradientCoords = computed(() => {
  const { startPoint, endPoint } = calculateConnectionPoints()
  
  const safeNum = (n) => isNaN(n) ? 0 : n
  
  return {
    x1: safeNum(startPoint.x),
    y1: safeNum(startPoint.y),
    x2: safeNum(endPoint.x),
    y2: safeNum(endPoint.y)
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
  const colors = themeColors.value
  
  // Helper function to calculate luminance
  function getLuminance(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    
    const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  }
  
  // Helper function to calculate contrast ratio
  function getContrastRatio(color1: string, color2: string): number {
    const lum1 = getLuminance(color1)
    const lum2 = getLuminance(color2)
    const brightest = Math.max(lum1, lum2)
    const darkest = Math.min(lum1, lum2)
    return (brightest + 0.05) / (darkest + 0.05)
  }
  
  // Get candidate colors for each theme
  const candidateColors = []
  
  // For light themes, prefer darker colors
  if (!isThemeDark.value) {
    candidateColors.push('#000000', '#333333', '#555555', colors.primary, colors.secondary)
    // Add darker variants of theme colors
    candidateColors.push(darkenColor(colors.primary, 0.3))
    candidateColors.push(darkenColor(colors.secondary, 0.3))
  } else {
    // For dark themes, prefer lighter colors  
    candidateColors.push('#FFFFFF', '#CCCCCC', '#AAAAAA', colors.primary, colors.secondary, colors.accent)
    // Add lighter variants of theme colors
    candidateColors.push(lightenColor(colors.primary, 0.3))
    candidateColors.push(lightenColor(colors.secondary, 0.3))
    candidateColors.push(lightenColor(colors.accent, 0.3))
  }
  
  // Special overrides for problematic themes
  switch (currentThemeName.value) {
    case 'bumblebee':
      candidateColors.unshift('#181830', '#000000') // Dark colors for yellow background
      break
    case 'cyberpunk':
      candidateColors.unshift('#00FFFF', '#FFFFFF') // Cyan or white for contrast
      break
    case 'synthwave':
      candidateColors.unshift('#FF00FF', '#00FFFF') // Bright magenta/cyan
      break
    case 'acid':
      candidateColors.unshift('#FFFF00', '#00FF00') // Bright yellow/green
      break
    case 'valentine':
      candidateColors.unshift('#FFB6C1', '#FFFFFF') // Light pink or white
      break
    case 'halloween':
      candidateColors.unshift('#FF8C00', '#FFFFFF') // Orange or white
      break
    case 'luxury':
      candidateColors.unshift('#FFD700', '#FFFFFF') // Gold or white
      break
  }
  
  // Try to get background color from CSS custom properties or fallback
  const backgroundColor = isThemeDark.value ? '#1a1a1a' : '#ffffff'
  
  // Find the color with best contrast (minimum 4.5:1 for accessibility)
  let bestColor = candidateColors[0]
  let bestContrast = getContrastRatio(bestColor, backgroundColor)
  
  for (const color of candidateColors) {
    const contrast = getContrastRatio(color, backgroundColor)
    if (contrast > bestContrast) {
      bestColor = color
      bestContrast = contrast
    }
  }
  
  // Ensure minimum contrast - if none meet the threshold, use black or white
  if (bestContrast < 4.5) {
    const blackContrast = getContrastRatio('#000000', backgroundColor)
    const whiteContrast = getContrastRatio('#FFFFFF', backgroundColor)
    bestColor = blackContrast > whiteContrast ? '#000000' : '#FFFFFF'
  }
  
  return bestColor
}

// Helper functions for color manipulation
function darkenColor(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) * (1 - amount))
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) * (1 - amount))
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) * (1 - amount))
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`
}

function lightenColor(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + (255 - parseInt(hex.slice(1, 3), 16)) * amount)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + (255 - parseInt(hex.slice(3, 5), 16)) * amount)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + (255 - parseInt(hex.slice(5, 7), 16)) * amount)
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`
}

// Label content
const hasLabel = computed(() => {
  return customLabel.value || 
         canvasStore.getConnectionLabel(props.startNode.id, props.endNode.id) || 
         getDefaultLabel()
})

function getDefaultLabel() {
  const idx = props.endNode.branchMessageIndex ?? 0
  const msg = props.startNode.messages?.[idx]?.content ?? ''
  const words = msg.split(' ').slice(0, 3).join(' ')
  return words.length > 20 ? `${words.slice(0, 20)}…` : words || ''
}

function getLabelText() {
  if (customLabel.value) return customLabel.value
  
  // Check for stored connection label first
  const storedLabel = canvasStore.getConnectionLabel(props.startNode.id, props.endNode.id)
  if (storedLabel) return storedLabel
  
  const defaultLabel = getDefaultLabel()
  return defaultLabel || `Branch ${(props.endNode.branchMessageIndex ?? 0) + 1}`
}

const inputWidth = computed(() => {
  const w = labelInput.value.length * fontSize.value * 0.6
  return Math.max(50 / Math.max(props.zoomLevel, 0.1), Math.min(300 / Math.max(props.zoomLevel, 0.1), w / Math.max(props.zoomLevel, 0.1)))
})
const inputHeight = computed(() => fontSize.value * 1.5 / Math.max(props.zoomLevel, 0.1))

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
  const id = pathId.value
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

// Connection circle hover handlers
const handleConnectionHover = (hovering: boolean) => {
  isConnectionHovered.value = hovering
}

// Drag handlers
const startDrag = (event: MouseEvent) => {
  event.preventDefault()
  isDragging.value = true
  
  // Get SVG coordinates
  const svg = event.currentTarget?.closest('svg')
  if (!svg) return
  
  const pt = svg.createSVGPoint()
  pt.x = event.clientX
  pt.y = event.clientY
  const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse())
  
  dragPosition.value = { x: svgP.x, y: svgP.y }
  
  // Add global event listeners
  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mouseup', handleDragEnd)
  
  // Emit drag start event
  emitter.emit('node-detach-start', {
    nodeId: props.endNode.id,
    parentId: props.startNode.id
  })
}

const handleDragMove = (event: MouseEvent) => {
  if (!isDragging.value) return
  
  // Get SVG coordinates
  const svg = document.querySelector('svg')
  if (!svg) return
  
  const pt = svg.createSVGPoint()
  pt.x = event.clientX
  pt.y = event.clientY
  const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse())
  
  dragPosition.value = { x: svgP.x, y: svgP.y }
  
  // Emit drag move event for highlighting potential targets
  emitter.emit('node-detach-move', {
    nodeId: props.endNode.id,
    position: dragPosition.value
  })
}

const handleDragEnd = async (event: MouseEvent) => {
  if (!isDragging.value) return
  
  // Remove global event listeners
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
  
  // Get the target element at the mouse position
  const target = document.elementFromPoint(event.clientX, event.clientY)
  
  // Check if dropped on a valid node
  const nodeElement = target?.closest('.branch-node-container')
  let actionPerformed = false
  
  if (nodeElement) {
    const targetNodeId = nodeElement.getAttribute('data-node-id')
    if (targetNodeId && targetNodeId !== props.endNode.id && targetNodeId !== props.startNode.id) {
      // Valid drop target - attempt to attach
      try {
        const response = await fetch(`http://127.0.0.1:5050/chats/${canvasStore.currentChatId}/nodes/${props.endNode.id}/attach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentId: targetNodeId,
            branchMessageIndex: 0 // TODO: Calculate appropriate index
          })
        })
        
        if (response.ok) {
          // Success - update the canvas
          canvasStore.updateNode(props.endNode.id, {
            parentId: targetNodeId,
            branchMessageIndex: 0
          })
          actionPerformed = true
          
          // Add to undo/redo history
          emitter.emit('add-undo-action', {
            type: 'node-reattach',
            nodeId: props.endNode.id,
            oldParentId: props.startNode.id,
            newParentId: targetNodeId,
            oldBranchIndex: props.endNode.branchMessageIndex
          })
        } else {
          const error = await response.json()
          console.error('Failed to attach node:', error)
        }
      } catch (error) {
        console.error('Error attaching node:', error)
      }
    }
  }
  
  if (!actionPerformed) {
    // Dropped in empty space - animate out and detach
    await animateSplineOut()
    
    try {
      const response = await fetch(`http://127.0.0.1:5050/chats/${canvasStore.currentChatId}/nodes/${props.endNode.id}/detach`, {
        method: 'POST'
      })
      
      if (response.ok) {
        // Success - update the canvas
        canvasStore.updateNode(props.endNode.id, {
          parentId: null,
          branchMessageIndex: null
        })
        
        // Add to undo/redo history
        emitter.emit('add-undo-action', {
          type: 'node-orphan',
          nodeId: props.endNode.id,
          oldParentId: props.startNode.id,
          oldBranchIndex: props.endNode.branchMessageIndex
        })
      }
    } catch (error) {
      console.error('Error detaching node:', error)
    }
  }
  
  isDragging.value = false
  
  // Emit drag end event
  emitter.emit('node-detach-end', {
    nodeId: props.endNode.id
  })
}

// Animate spline fading out when orphaned
const animateSplineOut = async () => {
  return new Promise<void>((resolve) => {
    // Animate the spline to fade and move off-canvas
    const steps = 20
    const duration = 300
    const stepTime = duration / steps
    let currentStep = 0
    
    const animate = () => {
      currentStep++
      const progress = currentStep / steps
      
      // Move end point off-canvas while fading
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight
      const offCanvasX = windowWidth + 200
      const offCanvasY = props.endNode.y
      
      // Interpolate between current drag position and off-canvas
      dragPosition.value = {
        x: dragPosition.value.x + (offCanvasX - dragPosition.value.x) * progress * 0.1,
        y: dragPosition.value.y + (offCanvasY - dragPosition.value.y) * progress * 0.05
      }
      
      if (currentStep < steps) {
        setTimeout(animate, stepTime)
      } else {
        resolve()
      }
    }
    
    animate()
  })
}
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