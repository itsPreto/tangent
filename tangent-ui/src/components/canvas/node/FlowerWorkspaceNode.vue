<template>
  <div ref="wrapperRef"
    class="flower-workspace-node"
    :class="[{ selected: isSelected, favorite: workspace.isFavorite, bloom: isHovered || alwaysShowPetals }]"
    :style="wrapperStyle"
    :data-workspace-id="workspace.id"
  >
    <svg
      :width="svgWidth"
      :height="svgHeight"
      :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
      class="flower-svg"
      preserveAspectRatio="none"
      pointer-events="none"
    >
      <!-- Enhanced Gradients for petals and other elements -->
      <defs>
        <!-- Main petal gradient -->
        <linearGradient :id="`petal-grad-${workspace.id}`" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"  :stop-color="gradientColor1" />
          <stop offset="60%" :stop-color="gradientColor2" />
          <stop offset="100%" :stop-color="gradientColor3" />
        </linearGradient>
        
        <!-- Inner petal highlight gradient -->
        <linearGradient :id="`petal-highlight-${workspace.id}`" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"  :stop-color="petalHighlightColor" :stop-opacity="0.9" />
          <stop offset="100%" :stop-color="petalHighlightColor" :stop-opacity="0" />
        </linearGradient>
        
        <!-- Center disk radial gradient -->
        <radialGradient :id="`center-grad-${workspace.id}`" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%"  :stop-color="centerHighlightColor" />
          <stop offset="70%" :stop-color="centerColor" />
          <stop offset="100%" :stop-color="centerShadowColor" />
        </radialGradient>
        
        <!-- Stem gradient -->
        <linearGradient :id="`stem-grad-${workspace.id}`" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  :stop-color="stemTopColor" />
          <stop offset="100%" :stop-color="stemBottomColor" />
        </linearGradient>
      </defs>

      <!-- ========== STEM (path from head center down to ground) ========== -->
      <!-- Set pointer-events="none" to make stem non-clickable -->
      <path
        :d="optimizedStemPath"
        :stroke="`url(#stem-grad-${workspace.id})`"
        :stroke-width="stemWidth"
        fill="none"
        stroke-linecap="round"
        class="stem-path"
        pointer-events="none"
      />
      
      <!-- Small leaves on stem (for visual interest) -->
      <path v-if="shouldRenderStemLeaves" v-for="(leaf, idx) in stemLeaves" :key="`leaf-${idx}`"
        :d="leaf.path"
        :fill="leaf.fill"
        :transform="`translate(${leaf.x}, ${leaf.y}) rotate(${leaf.angle})`"
        class="stem-leaf"
        pointer-events="none"
      />

      <!-- ========== HEAD (positioned relative to SVG top-left) ========== -->
      <g
        class="head-group"
        :transform="`translate(${svgWidth/2}, ${headGroupY})`"
      >
        <!-- Background glow for selected/favorite flowers -->
        <circle v-if="isSelected || workspace.isFavorite" 
          :r="baseRadius * 1.2" 
          :fill="glowColor"
          class="flower-glow"
          opacity="0.6"
          pointer-events="none"
        />
        
        <!-- FIXED: Use nested groups to separate rotation from animation -->
        <g v-for="(angle, idx) in petalAngles" :key="`petal-group-${idx}`"
          :transform="`rotate(${angle})`"
          v-if="shouldRenderPetals">
          <!-- Each petal in its own rotation group - petals ARE clickable but transparent parts aren't -->
          <path
            :d="petalPath"
            :fill="`url(#petal-grad-${workspace.id})`"
            :style="{ '--d': `${idx * 20}ms` }"
            class="petal-shape"
            pointer-events="fill"
            @click.stop="handleClick"
          />
          
          <!-- Inner highlight in the same rotation group -->
          <path
            :d="petalInnerHighlightPath"
            :fill="`url(#petal-highlight-${workspace.id})`"
            :style="{ '--d': `${idx * 20 + 100}ms` }"
            class="petal-highlight"
            pointer-events="none"
          />
        </g>

        <!-- Clickable center disk with enhanced styling -->
        <circle 
          :r="baseRadius * 0.72" 
          :fill="`url(#center-grad-${workspace.id})`" 
          class="flower-center" 
          pointer-events="fill"
          @click.stop="handleClick"
          @mouseenter="isHovered = true"
          @mouseleave="isHovered = false"
        />
        
        <!-- Title display -->
        <text
          text-anchor="middle"
          dominant-baseline="middle"
          :style="`font-size:${Math.max(10, baseRadius * 0.28)}px;font-weight:600;fill:${textColor};`"
          pointer-events="none"
        >
          {{ truncatedTitle }}
        </text>
        
        <!-- Invisible larger hitbox for easier selection -->
        <circle 
          :r="baseRadius * 1.4" 
          fill="rgba(0,0,0,0)" 
          stroke="none"
          pointer-events="fill"
          @click.stop="handleClick"
          @mouseenter="isHovered = true"
          @mouseleave="isHovered = false"
        />
      </g>
    </svg>

    <!-- actions -->
    <div class="flower-actions">
      <button @click.stop="$emit('favorite')" class="flower-action-btn">
        <Star class="w-4 h-4" :class="{ 'text-yellow-400 fill-yellow-400': workspace.isFavorite }" />
      </button>
      <button @click.stop="openMenu" class="flower-action-btn">
        <MoreVertical class="w-4 h-4" />
      </button>
    </div>

    <ContextMenu
      v-if="showContextMenu && !isMoreThan200Flowers"
      :position="contextMenuPosition"
      @close="showContextMenu = false"
    >
      <button @click="$emit('duplicate')" class="context-menu-item"><Copy class="w-4 h-4" />Duplicate</button>
      <button @click="$emit('archive')"   class="context-menu-item"><Archive class="w-4 h-4" />Archive</button>
      <button @click="$emit('export')"    class="context-menu-item"><Download class="w-4 h-4" />Export</button>
      <hr class="my-2 border-base-200" />
      <button @click="$emit('delete')"    class="context-menu-item text-destructive"><Trash2 class="w-4 h-4" />Delete</button>
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, inject } from 'vue';
import { Star, MoreVertical, Copy, Archive, Download, Trash2 } from 'lucide-vue-next';
import ContextMenu from '@/components/ui/ContextMenu.vue';
import { useThemeStore } from '@/stores/themeStore';
import type { ThemeName } from '@/stores/themeStore';

/* ---------- props / emits ---------- */
const props = defineProps({
  workspace    : { type:Object, required:true },
  isSelected   : Boolean,
  maxNodeCount : { type:Number, default:1 },
  windowHeight : { type:Number, required:true }, // Prop for current window height
  alwaysShowPetals: { type:Boolean, default:false }, // New prop for controlling petal visibility
});
const emit = defineEmits(['select','favorite','duplicate','archive','export','delete']);
const wrapperRef = ref(null);

/* ---------- theme ---------- */
const themeStore  = useThemeStore();
const activeTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');
let obs:MutationObserver|undefined;
onMounted(()=>{
  obs = new MutationObserver(()=>activeTheme.value=document.documentElement.getAttribute('data-theme')||'light');
  obs.observe(document.documentElement,{attributes:true, attributeFilter:['data-theme']});
});
onBeforeUnmount(()=>obs?.disconnect());

/* ---------- refs ---------- */
const isHovered = ref(false); // Explicitly declared ref

/* ---------- theme flags for styling variants ---------- */
const isDarkTheme = computed(() => themeStore.isDarkTheme(activeTheme.value as ThemeName));
const isMinimalist = computed(() => ['lofi', 'wireframe', 'black', 'light', 'corporate'].includes(activeTheme.value));

/* ---------- geometry ---------- */
const branchCount = computed(()=>props.workspace.nodeCount || 1);
const minR = 35, maxR = 80;
const baseRadius = computed(()=>{
  const scale = props.maxNodeCount>1 ? Math.min(1, branchCount.value/props.maxNodeCount) : 0.5;
  return minR + scale*(maxR-minR);
});

/* ground position settings */
const GROUND_BUFFER = 20; // Increased buffer from the absolute bottom
const GROUND_LINE = computed(() => props.windowHeight - GROUND_BUFFER);

/* hover growth - how much the head moves up and stem effectively grows */
const growthPx = computed(()=>{
  const ratio = (maxR - baseRadius.value)/(maxR - minR); // 1->small, 0->largest
  const minGrow=2, maxGrow=8;
  return minGrow + ratio*(maxGrow-minGrow);
});

/* Head center Y in SVG coordinates */
const headCenterY_in_svg = computed(() => baseRadius.value);

/* SVG Dimensions - ensure room for full stem */
const stemWidth = computed(()=>Math.max(2.5, baseRadius.value*0.1)); // Slightly thinner for elegance
const svgWidth = computed(() => baseRadius.value * 2 + Math.max(stemWidth.value * 4, growthPx.value));
// Make sure SVG height extends to the ground
const svgHeight = computed(() => GROUND_LINE.value + GROUND_BUFFER);

/* Wrapper position and dimensions */
const wrapperLeft = computed(() => {
  if (!props.workspace || typeof props.workspace.x !== 'number') return 0; // Fallback
  return props.workspace.x - svgWidth.value / 2;
});

const wrapperTop = computed(() => {
  if (!props.workspace || typeof props.workspace.y !== 'number') return 0; // Fallback
  return props.workspace.y - baseRadius.value;
});

// Handle greater than 200 flowers case
const isMoreThan200Flowers = computed(() => {
  return props.maxNodeCount > 200;
});

const shouldRenderPetals = computed(() => {
  // Always render petals if alwaysShowPetals is true
  if (props.alwaysShowPetals) return true;
  
  // Otherwise, use the existing logic
  const totalFlowers = props.maxNodeCount > 100;
  return !totalFlowers || isHovered.value || props.isSelected || props.workspace.isFavorite;
});

// 2. Simplify path calculations for large flower counts
const optimizedPetalPath = computed(() => {
  // Use simpler paths when we have many flowers (>100)
  if (props.maxNodeCount > 100) {
    const r = petalLength.value * 0.8;
    const w = petalWidth.value * 0.7;
    return `M0,0 L${r/2},${w/2} L${r},0 L${r/2},${-w/2} Z`;
  }
  
  // Use standard path for normal cases
  return petalPath.value;
});

// 3. Optimize stem calculation for large flower counts
const optimizedStemPath = computed(() => {
  // Use simpler stem for large flower counts
  if (props.maxNodeCount > 100) {
    const startY = headGroupY.value; 
    const groundY = GROUND_LINE.value - wrapperTop.value; 
    const centerX = svgWidth.value/2;
    return `M${centerX},${startY} L${centerX},${groundY}`;
  }
  
  // Use standard stem path for normal cases
  return stemPath.value;
});

// 4. Conditional stem leaves rendering
const shouldRenderStemLeaves = computed(() => {
  // Only render stem leaves for fewer flowers or hover states
  return props.maxNodeCount < 50 || isHovered.value || props.isSelected;
});

// Make z-index dynamic based on hover/selection state to bring clicked flower to front
const dynamicZIndex = computed(() => {
  let baseZ = props.workspace.isFavorite ? 12 : 10;
  if (isHovered.value) baseZ += 5;
  if (props.isSelected) baseZ += 10;
  return baseZ;
});

const wrapperStyle = computed(()=>({
  left   : `${wrapperLeft.value}px`,
  top    : `${wrapperTop.value}px`,
  width  : `${svgWidth.value}px`,
  height : `${svgHeight.value}px`, // Match SVG height
  zIndex : dynamicZIndex.value,  // Use dynamic z-index for better overlapping behavior
  pointerEvents: "none", // Make the wrapper div ignore pointer events
}));

/* Head group Y position in SVG coords (adjusts for hover) */
const headGroupY = computed(() => {
  const currentHoverState = (isHovered && 'value' in isHovered) ? isHovered.value : false;
  return headCenterY_in_svg.value - (currentHoverState ? growthPx.value : 0);
});

/* Stem path - improved curve for more natural look */
const stemPath = computed(()=>{
  const startY = headGroupY.value; // Start at flower center
  const groundY = GROUND_LINE.value - wrapperTop.value; // Ground position in SVG coords
  const centerX = svgWidth.value/2;
  const stemHeight = groundY - startY;
  
  // Add slight curve with subtle randomness for organic feel
  const curveOffset = (Math.sin(props.workspace.id.charCodeAt(0) / 10) * 10) || 5;
  
  // More natural curved stem with slight bend
  return `M${centerX},${startY} C${centerX+curveOffset},${startY+stemHeight*0.3} ${centerX-curveOffset},${startY+stemHeight*0.6} ${centerX},${groundY}`;
});

/* Stem leaves for visual interest */
const stemLeaves = computed(() => {
  const groundY = GROUND_LINE.value - wrapperTop.value;
  const startY = headGroupY.value;
  const stemHeight = groundY - startY;
  const centerX = svgWidth.value/2;
  const leafCount = Math.min(Math.max(1, Math.floor(branchCount.value/3)), 3);
  
  // Create small decorative leaves along the stem
  return Array.from({length: leafCount}, (_, i) => {
    const yPos = startY + stemHeight * (0.3 + i * 0.25); // Distribute leaves along stem
    const xOffset = (i % 2 === 0 ? 1 : -1) * stemWidth.value * 2;
    const angle = (i % 2 === 0 ? -20 : 20) + (Math.random() - 0.5) * 10;
    
    // Simple leaf shape - can be customized more for different themes
    const leafSize = baseRadius.value * 0.2;
    
    return {
      x: centerX + xOffset,
      y: yPos,
      angle: angle,
      fill: stemTopColor.value,
      path: `M0,0 C${leafSize*0.5},${-leafSize*0.3} ${leafSize},${-leafSize*0.1} ${leafSize*1.2},0 C${leafSize},${leafSize*0.1} ${leafSize*0.5},${leafSize*0.3} 0,0 Z`
    };
  });
});

/* petals ---------- */
const petalCount = computed(() => {
  // Direct mapping to branch count, capped at 24 for visual clarity
  return Math.min(branchCount.value, 24);
});

// Generate an array of explicit angles that we can directly use in the template
const petalAngles = computed(() => {
  // Create an array of evenly distributed angles
  const angles = [];
  const count = petalCount.value;
  for (let i = 0; i < count; i++) {
    angles.push((360 / count) * i);
  }
  return angles;
});

// Improved petal shape with better curves
const petalLength = computed(() => baseRadius.value * 1.8);
const petalWidth = computed(() => baseRadius.value * 0.5);

// Main petal path - simplified for better rendering
const petalPath = computed(() => {
  const r = petalLength.value;
  const w = petalWidth.value;
  
  // More organic petal shape with simpler curves for reliable rendering
  return `M0,0 C${r*0.4},${w} ${r*0.6},${w} ${r},0 C${r*0.6},${-w} ${r*0.4},${-w} 0,0`;
});

// Inner highlight path for depth - simplified
const petalInnerHighlightPath = computed(() => {
  const r = petalLength.value * 0.7;
  const w = petalWidth.value * 0.4;
  
  // Simpler inner path for highlight effect
  return `M0,0 C${r*0.3},${w} ${r*0.5},${w} ${r*0.8},0 C${r*0.5},${-w} ${r*0.3},${-w} 0,0`;
});

/* colors - enhanced with theme integration ---------- */
const themeColors = computed(() => themeStore.getThemeColors(activeTheme.value as ThemeName));

// More sophisticated color derivation for flower elements
const centerColor = computed(() => themeColors.value.primary);
const centerHighlightColor = computed(() => lightenColor(themeColors.value.primary, 30));
const centerShadowColor = computed(() => darkenColor(themeColors.value.primary, 20));

// Enhanced gradient colors for petals
const gradientColor1 = computed(() => themeColors.value.primary);
const gradientColor2 = computed(() => themeColors.value.secondary);
const gradientColor3 = computed(() => {
  // Use accent if available, otherwise blend primary and secondary
  return themeColors.value.accent || blendColors(themeColors.value.primary, themeColors.value.secondary, 0.7);
});

// Highlight and texture colors
const petalHighlightColor = computed(() => lightenColor(themeColors.value.primary, 50));
const textColor = computed(() => isDarkTheme.value ? '#ffffff' : '#111111');

// Glow effect for selected/favorite
const glowColor = computed(() => props.isSelected ? lightenColor(themeColors.value.primary, 30) : '#FFD700');

// Stem colors with better theming
const stemTopColor = computed(() => {
  // Use a complementary green that harmonizes with the theme
  if (activeTheme.value === 'forest' || activeTheme.value === 'garden') {
    return themeColors.value.accent || '#2E7D32';
  }
  return isDarkTheme.value ? '#4CAF50' : '#2E7D32';
});

const stemBottomColor = computed(() => {
  return darkenColor(stemTopColor.value, 20);
});

/* Color utility functions */
function hexToRgb(hex) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function lightenColor(color, amount) {
  const rgb = hexToRgb(color);
  rgb.r = Math.min(255, rgb.r + amount);
  rgb.g = Math.min(255, rgb.g + amount);
  rgb.b = Math.min(255, rgb.b + amount);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function darkenColor(color, amount) {
  const rgb = hexToRgb(color);
  rgb.r = Math.max(0, rgb.r - amount);
  rgb.g = Math.max(0, rgb.g - amount);
  rgb.b = Math.max(0, rgb.b - amount);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function blendColors(color1, color2, ratio) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  const r = Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio);
  const g = Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio);
  const b = Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio);
  return rgbToHex(r, g, b);
}

/* title trunc */
const truncatedTitle = computed(()=>{
  const t = props.workspace.title || 'Untitled';
  const m = Math.max(8, Math.floor(baseRadius.value*0.3)); // dynamic length based on size
  return t.length>m ? t.slice(0,m-1)+'…' : t;
});

/* Click handler for petals/center */
function handleClick(e) {
  // Bring the flower to front temporarily by updating its z-index  
  if (wrapperRef.value) {
    wrapperRef.value.style.zIndex = '100'; // Temporary highest z-index
    
    // Reset z-index after a short delay
    setTimeout(() => {
      if (wrapperRef.value) {
        wrapperRef.value.style.zIndex = dynamicZIndex.value;
      }
    }, 500);
  }
  
  // Emit the select event
  emit('select');
  
  // Stop event propagation
  e.stopPropagation();
}

/* menu helpers */
const showContextMenu = ref(false);
const contextMenuPosition = ref({x:0,y:0});
function openMenu(e:MouseEvent){
  showContextMenu.value=true;
  contextMenuPosition.value={x:e.clientX,y:e.clientY};
  e.stopPropagation();
}
</script>

<style scoped>
/* container */
.flower-workspace-node{
  position: absolute;
  cursor: pointer;
  transition: box-shadow .3s, transform .3s ease, z-index 0.1s;
  transform-origin: center bottom;
}
.flower-workspace-node:hover{ 
  z-index: 20; 
  transform: translateY(-5px);
}
.selected{
  box-shadow: 0 0 0 4px rgba(255,255,255,.8), 0 8px 20px rgba(0,0,0,.25);
  z-index: 25;
}

/* svg tweaks */
.flower-svg{
  overflow: visible;
  position: absolute;
  top: 0;
  left: 0;
}

/* Petal styling - MODIFIED to remove rotation */
.petal-shape{
  transform-origin: 0 0;
  opacity: 0;
  transform: scale(0.4); /* Removed rotation */
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) var(--d), opacity 0.5s ease var(--d);
  cursor: pointer;
}

.bloom .petal-shape{
  opacity: 1;
  transform: scale(1); /* Removed rotation */
}

.petal-highlight {
  transform-origin: 0 0;
  opacity: 0;
  transform: scale(0.4); /* Removed rotation */
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) var(--d), opacity 0.5s ease var(--d);
}

.bloom .petal-highlight {
  opacity: 0.7;
  transform: scale(1); /* Removed rotation */
}

/* Flower center animation */
.flower-center {
  transition: transform 0.3s ease;
  cursor: pointer;
}

.bloom .flower-center {
  animation: pulse 3s infinite alternate;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* Stem styling and animation */
.stem-path {
  pointer-events: none;
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: drawStem 1.5s ease-out forwards;
  filter: drop-shadow(0px 0px 1px rgba(0, 0, 0, 0.2));
}

.stem-leaf {
  opacity: 0;
  transform-origin: 0 0;
  animation: fadeIn 0.5s ease forwards;
  animation-delay: 1.2s;
}

@keyframes fadeIn {
  to { opacity: 0.8; }
}

@keyframes drawStem {
  to { stroke-dashoffset: 0; }
}

/* Glow effect */
.flower-glow {
  opacity: 0.2;
  animation: glow 3s infinite alternate;
}

@keyframes glow {
  0% { opacity: 0.2; transform: scale(1); }
  100% { opacity: 0.5; transform: scale(1.1); }
}

/* actions */
.flower-actions{
  position: absolute;
  top: calc(v-bind(headGroupY) * 1px - v-bind(baseRadius) * 1px + 4px);
  right: 4px;
  display: flex; 
  gap: 4px; 
  opacity: 0;
  transition: opacity .2s;
  z-index: 30;
  pointer-events: auto;
}
.flower-workspace-node:hover .flower-actions{ opacity: 1; }

.flower-action-btn{
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255,255,255,.9);
  box-shadow: 0 1px 3px rgba(0,0,0,.25);
  border: none;
  cursor: pointer;
  color: var(--tw-base-content);
}
.flower-action-btn:hover{ transform: scale(1.1); }

.context-menu-item{ @apply flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-base-200/50 text-left; }
</style>