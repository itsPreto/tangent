<template>
  <div ref="wrapperRef"
    class="flower-workspace-node"
    :class="[{ selected: isSelected, favorite: workspace.isFavorite, bloom: shouldBloom }]"
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
      <!-- Enhanced Gradients -->
      <defs>
        <linearGradient :id="`petal-grad-${workspace.id}`" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"  :stop-color="gradientColor1" />
          <stop offset="60%" :stop-color="gradientColor2" />
          <stop offset="100%" :stop-color="gradientColor3" />
        </linearGradient>
        
        <linearGradient :id="`petal-highlight-${workspace.id}`" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"  :stop-color="petalHighlightColor" :stop-opacity="0.9" />
          <stop offset="100%" :stop-color="petalHighlightColor" :stop-opacity="0" />
        </linearGradient>
        
        <radialGradient :id="`center-grad-${workspace.id}`" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  :stop-color="centerHighlightColor" />
          <stop offset="70%" :stop-color="centerColor" />
          <stop offset="100%" :stop-color="centerShadowColor" />
        </radialGradient>
        
        <linearGradient :id="`stem-grad-${workspace.id}`" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  :stop-color="stemTopColor" />
          <stop offset="30%" :stop-color="stemMidColor" />
          <stop offset="70%" :stop-color="stemBottomColor" />
          <stop offset="100%" :stop-color="stemRootColor" />
        </linearGradient>
      </defs>

      <!-- PROCEDURAL STEM -->
      <g class="stem-group" pointer-events="none">
        <!-- Main organic stem -->
        <path
          :d="organicStemPath"
          :stroke="`url(#stem-grad-${workspace.id})`"
          :stroke-width="stemWidth"
          fill="none"
          stroke-linecap="round"
          class="stem-path main-stem"
        />
        
        <!-- Stem branches -->
        <template v-if="renderComplexFeatures">
          <path v-for="branch in stemBranches" :key="`branch-${branch.id}`"
            :d="branch.path"
            :stroke="branch.color"
            :stroke-width="branch.width"
            fill="none"
            stroke-linecap="round"
            class="stem-branch"
            :style="{ animationDelay: branch.delay }"
          />
        </template>
        
        <!-- Procedural leaves -->
        <!-- Removed leaves from stems -->
        
        <!-- Ground roots -->
        <template v-if="renderRoots">
          <path v-for="root in groundRoots" :key="`root-${root.id}`"
            :d="root.path"
            :stroke="root.color"
            :stroke-width="root.width"
            fill="none"
            stroke-linecap="round"
            class="ground-root"
            :style="{ animationDelay: root.delay }"
          />
        </template>
      </g>

      <!-- FLOWER HEAD -->
      <g class="head-group" :transform="`translate(${headX}, ${headY})`">
        <!-- Glow effect -->
        <circle v-if="showGlow" 
          :r="baseRadius * 1.2" 
          :fill="glowColor"
          class="flower-glow"
          opacity="0.6"
        />
        
        <!-- Petals -->
        <template v-if="renderPetals">
          <g v-for="petal in petalData" :key="`petal-${petal.id}`"
            :transform="petal.transform">
            <path
              :d="petal.path"
              :fill="`url(#petal-grad-${workspace.id})`"
              :style="{ animationDelay: petal.delay }"
              class="petal-shape"
              pointer-events="fill"
              @click.stop="handleClick"
            />
            <path
              :d="petal.highlightPath"
              :fill="`url(#petal-highlight-${workspace.id})`"
              :style="{ animationDelay: petal.highlightDelay }"
              class="petal-highlight"
              pointer-events="none"
            />
          </g>
        </template>

        <!-- Center -->
        <circle 
          :r="branchCount === 1 ? baseRadius * 0.55 : baseRadius * 0.72" 
          :fill="`url(#center-grad-${workspace.id})`" 
          class="flower-center" 
          pointer-events="fill"
          @click.stop="handleClick"
          @mouseenter="isHovered = true"
          @mouseleave="isHovered = false"
        />
        
        <!-- Title -->
        <text
          text-anchor="middle"
          dominant-baseline="middle"
          :style="titleStyle"
          pointer-events="none"
        >
          {{ truncatedTitle }}
        </text>
        
        <!-- Hitbox -->
        <circle 
          :r="baseRadius * 1.4" 
          fill="transparent" 
          pointer-events="fill"
          @click.stop="handleClick"
          @mouseenter="isHovered = true"
          @mouseleave="isHovered = false"
        />
      </g>
    </svg>

    <!-- Actions -->
    <div class="flower-actions" :style="actionsStyle">
      <button @click.stop="$emit('favorite')" class="flower-action-btn">
        <Star class="w-4 h-4" :class="{ 'text-yellow-400 fill-yellow-400': workspace.isFavorite }" />
      </button>
      <button @click.stop="openMenu" class="flower-action-btn">
        <MoreVertical class="w-4 h-4" />
      </button>
    </div>

    <ContextMenu
      v-if="showContextMenu && maxNodeCount <= 200"
      :position="contextMenuPosition"
      @close="showContextMenu = false"
    >
      <button @click="$emit('duplicate')" class="context-menu-item">
        <Copy class="w-4 h-4" />Duplicate
      </button>
      <button @click="$emit('archive')" class="context-menu-item">
        <Archive class="w-4 h-4" />Archive
      </button>
      <button @click="$emit('export')" class="context-menu-item">
        <Download class="w-4 h-4" />Export
      </button>
      <hr class="my-2 border-base-200" />
      <button @click="$emit('delete')" class="context-menu-item text-destructive">
        <Trash2 class="w-4 h-4" />Delete
      </button>
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { Star, MoreVertical, Copy, Archive, Download, Trash2 } from 'lucide-vue-next';
import ContextMenu from '@/components/ui/ContextMenu.vue';
import { useThemeStore } from '@/stores/themeStore';
import type { ThemeName } from '@/stores/themeStore';

// Props & Emits
const props = defineProps({
  workspace: { type: Object, required: true },
  isSelected: Boolean,
  maxNodeCount: { type: Number, default: 1 },
  windowHeight: { type: Number, required: true },
  alwaysShowPetals: { type: Boolean, default: false },
});

const emit = defineEmits(['select', 'favorite', 'duplicate', 'archive', 'export', 'delete']);

// Refs
const wrapperRef = ref(null);
const isHovered = ref(false);

// Theme
const themeStore = useThemeStore();
const activeTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');

let obs: MutationObserver | undefined;
onMounted(() => {
  obs = new MutationObserver(() => {
    activeTheme.value = document.documentElement.getAttribute('data-theme') || 'light';
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
});
onBeforeUnmount(() => obs?.disconnect());

// Safe number function to prevent NaN
const safeNumber = (value: any, fallback: number = 0): number => {
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? fallback : num;
};

// Utility functions
const seededRandom = (seed: number): number => {
  const safeSeed = safeNumber(seed, 1);
  const x = Math.sin(safeSeed) * 10000;
  return x - Math.floor(x);
};

const noise1D = (x: number, seed: number = 1): number => {
  const safeX = safeNumber(x, 0);
  const safeSeed = safeNumber(seed, 1);
  const frequency = 0.05;
  const scaledX = safeX * frequency;
  const floorX = Math.floor(scaledX);
  const fracX = scaledX - floorX;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const n1 = seededRandom(floorX + safeSeed);
  const n2 = seededRandom(floorX + 1 + safeSeed);
  return (n1 * (1 - fade(fracX)) + n2 * fade(fracX));
};

// Basic computed properties with safe defaults
const branchCount = computed(() => safeNumber(props.workspace?.nodeCount, 1));

const seedValue = computed(() => {
  try {
    let hash = 0;
    const str = (props.workspace?.id || 'default').toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) || 1;
  } catch {
    return 1;
  }
});

// Density and sizing with safe calculations
const densityScale = computed(() => {
  const maxNodes = safeNumber(props.maxNodeCount, 1);
  if (maxNodes > 200) return 0.4;
  if (maxNodes > 100) return 0.6;
  if (maxNodes > 50) return 0.8;
  return 1.0;
});

const baseRadius = computed(() => {
  const isSingleBranch = branchCount.value === 1;
  const minR = (isSingleBranch ? 20 : 25) * densityScale.value;
  const maxR = (isSingleBranch ? 40 : 60) * densityScale.value;
  const maxNodes = safeNumber(props.maxNodeCount, 1);
  const branches = branchCount.value;
  const scale = maxNodes > 1 ? Math.min(1, branches / maxNodes) : 0.5;
  return safeNumber(minR + scale * (maxR - minR), minR);
});

// Positioning with anti-overlap offset
const positionOffset = computed(() => {
  const maxNodes = safeNumber(props.maxNodeCount, 1);
  const magnitude = maxNodes > 50 ? 8 : 4;
  const seed = seedValue.value;
  return {
    x: safeNumber((seededRandom(seed) - 0.5) * magnitude, 0),
    y: safeNumber((seededRandom(seed + 1) - 0.5) * magnitude, 0)
  };
});

// Layout calculations with safe defaults
const GROUND_BUFFER = 20;
const groundLine = computed(() => safeNumber(props.windowHeight, 800) - GROUND_BUFFER);
const growthPx = computed(() => safeNumber(2 + (seededRandom(seedValue.value + 5) * 4), 2));
const stemWidth = computed(() => safeNumber(Math.max(1.5, baseRadius.value * 0.08) * densityScale.value, 1.5));

// SVG dimensions with safe calculations
const svgWidth = computed(() => {
  const width = baseRadius.value * 2.4 + Math.max(stemWidth.value * 6, growthPx.value);
  return safeNumber(width, 100);
});

const svgHeight = computed(() => {
  const height = groundLine.value + GROUND_BUFFER;
  return safeNumber(height, 400);
});

// Head positioning with safe calculations
const headX = computed(() => {
  const x = svgWidth.value / 2 + positionOffset.value.x;
  return safeNumber(x, svgWidth.value / 2);
});

const headY = computed(() => {
  const baseY = baseRadius.value;
  const hoverAdjust = isHovered.value ? growthPx.value : 0;
  const y = baseY - hoverAdjust + positionOffset.value.y;
  return safeNumber(y, baseRadius.value);
});

// Wrapper positioning with safe calculations
const wrapperStyle = computed(() => {
  const workspaceX = safeNumber(props.workspace?.x, 0);
  const workspaceY = safeNumber(props.workspace?.y, 0);
  
  return {
    left: `${workspaceX - svgWidth.value / 2 + positionOffset.value.x}px`,
    top: `${workspaceY - baseRadius.value + positionOffset.value.y}px`,
    width: `${svgWidth.value}px`,
    height: `${svgHeight.value}px`,
    zIndex: isHovered.value ? 20 : (props.isSelected ? 15 : (props.workspace?.isFavorite ? 12 : 10)),
    pointerEvents: 'none',
  };
});

// Conditional rendering flags
const renderPetals = computed(() => {
  return props.alwaysShowPetals || 
         props.maxNodeCount < 100 || 
         isHovered.value || 
         props.isSelected || 
         props.workspace?.isFavorite;
});

const renderLeaves = computed(() => props.maxNodeCount < 100 || isHovered.value || props.isSelected);
const renderComplexFeatures = computed(() => props.maxNodeCount < 50 && branchCount.value > 3);
const renderRoots = computed(() => props.maxNodeCount < 30 && (isHovered.value || props.isSelected));
const shouldBloom = computed(() => isHovered.value || props.alwaysShowPetals);
const showGlow = computed(() => props.isSelected || props.workspace?.isFavorite);

// Organic stem path with safe calculations
const organicStemPath = computed(() => {
  const startY = headY.value;
  const workspaceY = safeNumber(props.workspace?.y, 0);
  const endY = groundLine.value - (workspaceY - baseRadius.value + positionOffset.value.y);
  const centerX = headX.value;
  const height = safeNumber(endY - startY, 100);
  
  if (height <= 0) return `M${centerX},${startY} L${centerX},${startY + 50}`;
  
  // Simple organic curve with noise
  const segments = Math.min(5, Math.max(2, Math.floor(height / 80)));
  let path = `M${centerX},${startY}`;
  
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const y = startY + height * t;
    const noiseX = noise1D(y, seedValue.value) * 12 * densityScale.value;
    const x = safeNumber(centerX + noiseX, centerX);
    
    if (i === 1) {
      const cp1x = safeNumber(centerX + noiseX * 0.5, centerX);
      const cp1y = safeNumber(startY + height * 0.3, startY);
      path += ` Q${cp1x},${cp1y} ${x},${y}`;
    } else {
      path += ` T${x},${y}`;
    }
  }
  
  return path;
});

// Stem branches with safe calculations
const stemBranches = computed(() => {
  if (!renderComplexFeatures.value) return [];
  
  const count = Math.min(2, Math.floor(branchCount.value / 4));
  return Array.from({ length: count }, (_, i) => {
    const startY = safeNumber(headY.value + (baseRadius.value * (1 + i * 0.5)), headY.value);
    const direction = i % 2 === 0 ? 1 : -1;
    const length = baseRadius.value * 0.6;
    const endX = safeNumber(headX.value + direction * length, headX.value);
    const endY = safeNumber(startY + length * 0.3, startY);
    
    return {
      id: i,
      path: `M${headX.value},${startY} Q${safeNumber(headX.value + direction * length * 0.5, headX.value)},${safeNumber(startY + length * 0.1, startY)} ${endX},${endY}`,
      color: stemMidColor.value,
      width: stemWidth.value * 0.6,
      delay: `${1.5 + i * 0.2}s`
    };
  });
});

// Stem leaves with safe calculations and pre-computed transforms
const stemLeaves = computed(() => {
  if (!renderLeaves.value) return [];
  
  const count = Math.min(3, Math.max(1, Math.floor(branchCount.value / 2)));
  return Array.from({ length: count }, (_, i) => {
    const t = 0.3 + (i / Math.max(1, count - 1)) * 0.4;
    const yPos = safeNumber(headY.value + baseRadius.value * (1 + t * 2), headY.value);
    const side = i % 2 === 0 ? 1 : -1;
    const leafSize = baseRadius.value * 0.15 * densityScale.value;
    const scale = safeNumber(0.8 + seededRandom(seedValue.value + i + 20) * 0.4, 0.8);
    const x = safeNumber(headX.value + side * stemWidth.value * 2, headX.value);
    const angle = safeNumber((20 + seededRandom(seedValue.value + i) * 15) * side, 0);
    
    return {
      id: i,
      transform: `translate(${x}, ${yPos}) rotate(${angle}) scale(${scale})`,
      fill: `hsl(120, 60%, ${isDarkTheme.value ? 45 : 35}%)`,
      path: `M0,0 C${leafSize * 0.6},${-leafSize * 0.3} ${leafSize * 1.2},0 ${leafSize * 0.6},${leafSize * 0.3} Z`,
      delay: `${1.8 + i * 0.15}s`
    };
  });
});

// Ground roots with safe calculations
const groundRoots = computed(() => {
  if (!renderRoots.value) return [];
  
  const count = 3;
  const workspaceY = safeNumber(props.workspace?.y, 0);
  const groundY = groundLine.value - (workspaceY - baseRadius.value + positionOffset.value.y);
  
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 120 - 60; // -60 to +60 degrees
    const length = baseRadius.value * 0.4;
    const endX = safeNumber(headX.value + Math.sin(angle * Math.PI / 180) * length, headX.value);
    const endY = safeNumber(groundY + length * 0.2, groundY);
    const cpX = safeNumber(headX.value + Math.sin(angle * Math.PI / 180) * length * 0.5, headX.value);
    const cpY = safeNumber(groundY + length * 0.05, groundY);
    
    return {
      id: i,
      path: `M${headX.value},${groundY} Q${cpX},${cpY} ${endX},${endY}`,
      color: darkenColor(stemBottomColor.value, 30),
      width: stemWidth.value * 0.4,
      delay: `${2 + i * 0.1}s`
    };
  });
});

// Petal data with safe calculations and pre-computed transforms
// CACHED petal data to avoid heavy recalculation
const petalCache = new Map();

const petalData = computed(() => {
  if (!renderPetals.value) return [];
  
  // Create cache key from important props
  const cacheKey = `${branchCount.value}-${baseRadius.value}-${densityScale.value}-${seedValue.value}`;
  
  // Return cached result if available
  if (petalCache.has(cacheKey)) {
    return petalCache.get(cacheKey);
  }
  
  // REDUCED complexity for performance
  const isSingleBranch = branchCount.value === 1;
  const count = isSingleBranch ? 8 : Math.min(Math.max(1, branchCount.value), 6); // Reduced from 16/10 to 8/6
  
  // Simpler calculations
  const sizeFactor = isSingleBranch ? 0.75 : 1;
  const baseLength = baseRadius.value * 1.4 * densityScale.value * sizeFactor; // Slightly smaller
  const baseWidth = baseRadius.value * 0.4 * densityScale.value * sizeFactor;
  
  const result = Array.from({ length: count }, (_, i) => {
    const baseAngle = (360 / count) * i;
    const angleVar = isSingleBranch ? 0 : (seededRandom(seedValue.value + i) - 0.5) * 8; // Reduced variation
    const scaleVar = isSingleBranch ? 1 : 0.9 + seededRandom(seedValue.value + i + 10) * 0.2; // Less variation
    const lengthMod = isSingleBranch ? 1.1 : 0.95 + seededRandom(seedValue.value + i + 20) * 0.1;
    
    const r = baseLength * lengthMod;
    const w = isSingleBranch ? baseWidth * 0.5 : baseWidth;
    const angle = baseAngle + angleVar;
    
    // SIMPLIFIED path generation
    const petalPath = isSingleBranch 
      ? `M0,0 L${r * 0.3},${w} L${r},0 L${r * 0.3},${-w} Z` // Simpler triangle shape
      : `M0,0 L${r * 0.5},${w} L${r},0 L${r * 0.5},${-w} Z`; // Simpler shape for multi-branch too
    
    // No highlight path to reduce DOM complexity
    return {
      id: i,
      transform: `rotate(${angle}) scale(${scaleVar})`,
      path: petalPath,
      delay: `${i * 30}ms`, // Slightly longer delays
    };
  });
  
  // Cache the result
  petalCache.set(cacheKey, result);
  
  // Limit cache size to prevent memory leak
  if (petalCache.size > 20) {
    const firstKey = petalCache.keys().next().value;
    petalCache.delete(firstKey);
  }
  
  return result;
});

// Theme colors
const isDarkTheme = computed(() => themeStore.isDarkTheme(activeTheme.value as ThemeName));
const themeColors = computed(() => themeStore.getThemeColors(activeTheme.value as ThemeName));

const centerColor = computed(() => themeColors.value.primary);
const centerHighlightColor = computed(() => lightenColor(themeColors.value.primary, 30));
const centerShadowColor = computed(() => darkenColor(themeColors.value.primary, 20));
const gradientColor1 = computed(() => themeColors.value.primary);
const gradientColor2 = computed(() => themeColors.value.secondary);
const gradientColor3 = computed(() => themeColors.value.accent || blendColors(themeColors.value.primary, themeColors.value.secondary, 0.7));
const petalHighlightColor = computed(() => lightenColor(themeColors.value.primary, 50));
const textColor = computed(() => isDarkTheme.value ? '#ffffff' : '#111111');
const glowColor = computed(() => props.isSelected ? lightenColor(themeColors.value.primary, 30) : '#FFD700');

const stemTopColor = computed(() => isDarkTheme.value ? '#4CAF50' : '#2E7D32');
const stemMidColor = computed(() => blendColors(stemTopColor.value, stemBottomColor.value, 0.5));
const stemBottomColor = computed(() => darkenColor(stemTopColor.value, 25));
const stemRootColor = computed(() => darkenColor(stemTopColor.value, 40));

// Color utilities
function hexToRgb(hex: string) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function lightenColor(color: string, amount: number) {
  const rgb = hexToRgb(color);
  rgb.r = Math.min(255, rgb.r + amount);
  rgb.g = Math.min(255, rgb.g + amount);
  rgb.b = Math.min(255, rgb.b + amount);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function darkenColor(color: string, amount: number) {
  const rgb = hexToRgb(color);
  rgb.r = Math.max(0, rgb.r - amount);
  rgb.g = Math.max(0, rgb.g - amount);
  rgb.b = Math.max(0, rgb.b - amount);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function blendColors(color1: string, color2: string, ratio: number) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  const r = Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio);
  const g = Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio);
  const b = Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio);
  return rgbToHex(r, g, b);
}

// Text and styling
const truncatedTitle = computed(() => {
  const title = props.workspace?.title || 'Untitled';
  const maxLength = Math.max(6, Math.floor(baseRadius.value * 0.25));
  return title.length > maxLength ? title.slice(0, maxLength - 1) + '…' : title;
});

const titleStyle = computed(() => 
  `font-size:${Math.max(8, baseRadius.value * 0.26)}px;font-weight:600;fill:${textColor.value};`
);

const actionsStyle = computed(() => ({
  top: `${headY.value - baseRadius.value + 4}px`,
  right: '4px'
}));

// Event handlers
function handleClick(e: Event) {
  if (wrapperRef.value) {
    (wrapperRef.value as HTMLElement).style.zIndex = '100';
    setTimeout(() => {
      if (wrapperRef.value) {
        (wrapperRef.value as HTMLElement).style.zIndex = String(wrapperStyle.value.zIndex);
      }
    }, 500);
  }
  emit('select');
  e.stopPropagation();
}

const showContextMenu = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
function openMenu(e: MouseEvent) {
  showContextMenu.value = true;
  contextMenuPosition.value = { x: e.clientX, y: e.clientY };
  e.stopPropagation();
}
</script>

<style scoped>
.flower-workspace-node {
  position: absolute;
  cursor: pointer;
  margin-top: 20vh;
  transition: transform 0.3s ease, z-index 0.1s;
  transform-origin: center bottom;
}

.flower-workspace-node:hover {
  z-index: 20;
  transform: translateY(-3px);
}

.selected {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.8), 0 6px 16px rgba(0, 0, 0, 0.25);
  z-index: 25;
}

.flower-svg {
  overflow: visible;
  position: absolute;
  top: 0;
  left: 0;
}

/* Petal animations */
.petal-shape {
  transform-origin: 0 0;
  opacity: 0;
  transform: scale(0.3);
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease;
  cursor: pointer;
}

.bloom .petal-shape {
  opacity: 1;
  transform: scale(1);
}

.petal-highlight {
  transform-origin: 0 0;
  opacity: 0;
  transform: scale(0.3);
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease;
}

.bloom .petal-highlight {
  opacity: 0.6;
  transform: scale(1);
}

/* Stem animations */
.main-stem {
  stroke-dasharray: 1500;
  stroke-dashoffset: 1500;
  animation: drawStem 2s ease-out forwards;
  filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.15));
}

.stem-branch {
  stroke-dasharray: 300;
  stroke-dashoffset: 300;
  opacity: 0;
  animation: drawBranch 1s ease-out forwards;
}

.stem-leaf {
  opacity: 0;
  transform-origin: 0 0;
  animation: leafGrow 0.8s ease-out forwards;
}

.ground-root {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  opacity: 0;
  animation: rootGrow 0.6s ease-out forwards;
}

.flower-center {
  transition: transform 0.3s ease;
  cursor: pointer;
}

.bloom .flower-center {
  animation: organicPulse 4s infinite alternate;
}

.flower-glow {
  opacity: 0.2;
  animation: organicGlow 3.5s infinite alternate;
}

/* Keyframes */
@keyframes drawStem {
  to { stroke-dashoffset: 0; }
}

@keyframes drawBranch {
  to { 
    stroke-dashoffset: 0; 
    opacity: 0.8;
  }
}

@keyframes leafGrow {
  0% { 
    opacity: 0; 
    transform: scale(0);
  }
  100% { 
    opacity: 0.9; 
    transform: scale(1);
  }
}

@keyframes rootGrow {
  to { 
    stroke-dashoffset: 0; 
    opacity: 0.4;
  }
}

@keyframes organicPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes organicGlow {
  0% { opacity: 0.2; transform: scale(1); }
  100% { opacity: 0.6; transform: scale(1.15); }
}

/* Actions */
.flower-actions {
  position: absolute;
  display: flex;
  gap: 3px;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 30;
  pointer-events: auto;
}

.flower-workspace-node:hover .flower-actions {
  opacity: 1;
}

.flower-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  border: none;
  cursor: pointer;
  color: var(--tw-base-content);
  transition: transform 0.2s ease;
}

.flower-action-btn:hover {
  transform: scale(1.1);
  background: rgba(255, 255, 255, 1);
}

.context-menu-item {
  @apply flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-base-200/50 text-left;
}
</style>