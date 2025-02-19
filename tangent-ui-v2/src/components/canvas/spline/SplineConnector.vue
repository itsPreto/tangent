<template>
  <g class="pointer-events-auto">
    <!-- Main dashed path -->
    <path :d="pathData" :stroke="isActive ? glowColor : '#94a3b8'" :stroke-width="strokeWidth" fill="none"
      :stroke-dasharray="dashPattern" class="transition-all duration-200" opacity="0.4" />

    <!-- Particles with scaled radius -->
    <g v-for="particle in particles" :key="particle.id">
      <circle :cx="particle.x" :cy="particle.y" :r="particleRadius" :fill="isActive ? glowColor : '#94a3b8'">
        <animate attributeName="opacity" values="1;0.3;1" :dur="particle.duration" repeatCount="indefinite" />
      </circle>
    </g>

    <!-- Path for text alignment - Set pointer-events to none -->
    <path :id="`connection-path-${startNode.id}-${endNode.id}`" :d="isLeftBranch ? reversedPathData : pathData"
      fill="none" stroke="none" pointer-events="none" />

    <!-- Label Container - Set pointer-events to auto and increase z-index -->
    <g class="label-container" style="pointer-events: auto; z-index: 10;">
      <!-- Text container with increased hit area -->
      <text class="text-container" style="pointer-events: none;">
        <textPath :href="`#connection-path-${startNode.id}-${endNode.id}`" startOffset="50%" text-anchor="middle"
          :side="isLeftBranch ? 'right' : 'left'" :class="{ 'reversed': isLeftBranch }" style="pointer-events: auto;">
          <tspan :dy="-12" class="label-text" :style="[labelStyle, { pointerEvents: 'auto' }]">
            <!-- Clickable label background with increased hit area -->
            <tspan @dblclick.stop="handleLabelDoubleClick" class="label-background" v-if="!isEditing"
              style="cursor: pointer; pointer-events: all;">
              {{ getLabelText() }}
            </tspan>
          </tspan>
        </textPath>
      </text>

      <!-- Edit Input - Positioned absolutely with proper z-index -->
      <foreignObject v-if="isEditing" :x="calculateLabelPosition().x" :y="calculateLabelPosition().y"
        :width="300 / Math.min(1, zoomLevel)" :height="50 / Math.min(1, zoomLevel)" @dblclick.stop
        style="z-index: 20; pointer-events: auto;">
        <div xmlns="http://www.w3.org/2000/svg" class="flex items-center justify-center w-full h-full">
          <input ref="inputRef" v-model="labelInput" @blur="handleLabelBlur" @keydown="handleKeyDown"
            class="bg-base-100 border border-base-300 rounded px-3 py-2 text-center w-full"
            :style="[inputStyle, { pointerEvents: 'auto' }]" />
        </div>
      </foreignObject>
    </g>
  </g>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  startNode: {
    type: Object,
    required: true
  },
  endNode: {
    type: Object,
    required: true
  },
  cardWidth: {
    type: Number,
    required: true
  },
  cardHeight: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  zoomLevel: {
    type: Number,
    default: 1
  }
});

// State
const isEditing = ref(false);
const labelInput = ref('');
const customLabel = ref('');
const inputRef = ref(null);
const particles = ref([]);
let animationFrame = null;

// Constants
const baseStroke = 1.5;
const baseFontSize = 14;
const baseParticleRadius = 3;
const baseParticleSpeed = 0.002;
const numParticles = 4;
const labelOffset = 12; // Vertical offset for the label

const strokeWidth = computed(() => {
  const scale = 1 / Math.pow(props.zoomLevel, 1.2);
  return baseStroke * Math.min(scale, 4);
});

const dashPattern = computed(() => {
  const scale = 1 / Math.pow(props.zoomLevel, 1.2);
  const dash = 4 * Math.min(scale, 4);
  const gap = 6 * Math.min(scale, 4);
  return `${dash} ${gap}`;
});

const currentTheme = ref(
  document.documentElement.getAttribute('data-theme') || 'light'
);

const particleRadius = computed(() => {
  const scale = 1 / Math.pow(props.zoomLevel, 2.2);
  return baseParticleRadius * Math.min(scale, 3);
});

const isLeftBranch = computed(() => {
  return props.endNode.type === 'left-branch';
});

const fontSize = computed(() => {
  const scaleFactor = 1 / Math.min(1, props.zoomLevel);
  return Math.max(baseFontSize * scaleFactor, baseFontSize);
});

const labelStyle = computed(() => ({
  fontSize: `${fontSize.value}px`,
  fontWeight: 500
}));

const inputStyle = computed(() => ({
  fontSize: `${fontSize.value}px`,
  fontWeight: 500,
  // No scaling on the input itself, the foreignObject handles that
}));

const pathData = computed(() => {
  const { path } = pathAndControlPoints.value;
  return path;
});

const reversedPathData = computed(() => {
  const { startPoint, endPoint, controlPoint1, controlPoint2 } = pathAndControlPoints.value;

  return `M ${endPoint.x} ${endPoint.y} 
          C ${controlPoint2.x} ${controlPoint2.y},
            ${controlPoint1.x} ${controlPoint1.y},
            ${startPoint.x} ${startPoint.y}`;
});

// Also update the calculateLabelPosition function to work with the path:
const calculateLabelPosition = () => {
  const { startPoint, endPoint } = calculateConnectionPoints();
  const midX = startPoint.x + (endPoint.x - startPoint.x) / 2;
  const midY = startPoint.y + (endPoint.y - startPoint.y) / 2;

  // Adjust position based on branch direction
  const xOffset = isLeftBranch.value ? -150 : 0;

  return {
    x: midX + xOffset,
    y: midY - 25
  };
};

// --- Path and Control Point Calculations ---
const calculateConnectionPoints = () => {
  const messageIndex = props.endNode.branchMessageIndex || 0;
  const messageYOffset = messageIndex * 120 + 40;
  const startOffset = 1;

  const startPoint = {
    x: isLeftBranch.value
      ? props.startNode.x - startOffset
      : props.startNode.x + props.cardWidth + startOffset,
    y: props.startNode.y + messageYOffset
  };

  const endPoint = {
    x: props.endNode.x + (isLeftBranch.value ? props.cardWidth : 0),
    y: props.endNode.y + props.cardHeight / 2
  };

  return { startPoint, endPoint };
};

const pathAndControlPoints = computed(() => {
  const { startPoint, endPoint } = calculateConnectionPoints();

  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const controlPointDistance = Math.min(distance * 0.8, 200);
  const verticalOffset = Math.min(Math.abs(dy), 100) * (dy < 0 ? -1 : 1);

  const controlPoint1 = {
    x: startPoint.x + (isLeftBranch.value ? -controlPointDistance : controlPointDistance),
    y: startPoint.y + verticalOffset
  };

  const controlPoint2 = {
    x: endPoint.x + (isLeftBranch.value ? controlPointDistance : -controlPointDistance),
    y: endPoint.y - verticalOffset
  };

  const path = `M ${startPoint.x} ${startPoint.y} 
                C ${controlPoint1.x} ${controlPoint1.y},
                  ${controlPoint2.x} ${controlPoint2.y},
                  ${endPoint.x} ${endPoint.y}`;

  return { path, controlPoint1, controlPoint2, startPoint, endPoint };
});

// --- Label Positioning ---

const getPointOnCurve = (t) => { // Removed startPoint and endPoint parameters
  const { startPoint, endPoint, controlPoint1, controlPoint2 } = pathAndControlPoints.value;
  const t1 = 1 - t;
  return {
    x: Math.pow(t1, 3) * startPoint.x +
      3 * Math.pow(t1, 2) * t * controlPoint1.x +
      3 * t1 * Math.pow(t, 2) * controlPoint2.x +
      Math.pow(t, 3) * endPoint.x,
    y: Math.pow(t1, 3) * startPoint.y +
      3 * Math.pow(t1, 2) * t * controlPoint1.y +
      3 * t1 * Math.pow(t, 2) * controlPoint2.y +
      Math.pow(t, 3) * endPoint.y
  };
};

const labelPosition = computed(() => {
  const t = 0.5; // Midpoint of the curve
  const pointOnCurve = getPointOnCurve(t);

  // Adjust x based on branch type to ensure the label/input is on the outside of the curve
  let xAdjustment = 0;
  if (isLeftBranch.value) {
    xAdjustment = -inputWidth.value; // Move to the left for left branches
  } else {
    xAdjustment = 0;  // No adjustment for right branches (already positioned correctly)
  }
  const yAdjustment = -inputHeight.value / 2 - labelOffset;

  return {
    x: pointOnCurve.x + xAdjustment,
    y: pointOnCurve.y + yAdjustment,
  };
});

// --- Input Sizing ---

const inputWidth = computed(() => {
  // Estimate width based on text length, with a minimum and maximum
  const textWidth = (labelInput.value.length * (fontSize.value * 0.6)); // Approximate character width
  return Math.max(50, Math.min(300 / props.zoomLevel, textWidth / props.zoomLevel));
});

const inputHeight = computed(() => {
  return (fontSize.value * 1.5) / props.zoomLevel; //  height based on font size
});

// --- Particle Animation ---

const getParticleSpeed = () => {
  const scale = 1 / Math.max(0.3, props.zoomLevel);
  return (baseParticleSpeed * 0.7) * Math.min(scale, 2);
};

const initializeParticles = () => {
  const newParticles = [];
  const baseSpeed = getParticleSpeed();
  const adjustedNumParticles = Math.ceil(numParticles * 1.5);

  for (let i = 0; i < adjustedNumParticles; i++) {
    newParticles.push({
      id: i,
      progress: i / adjustedNumParticles,
      speed: baseSpeed + (Math.random() * baseSpeed * 0.5),
      duration: `${0.8 + Math.random() * 0.4}s`
    });
  }
  particles.value = newParticles;
};

const animateParticles = () => {
  const { startPoint, endPoint, controlPoint1, controlPoint2 } = pathAndControlPoints.value;

  // Get current base speed based on zoom level
  const baseSpeed = getParticleSpeed();

  particles.value = particles.value.map(particle => {

    const relativeSpeedFactor = particle.speed / (particle.speed - (Math.random() * particle.speed * 0.5));
    const newSpeed = baseSpeed + (Math.random() * baseSpeed * 0.5);
    particle.speed = newSpeed * relativeSpeedFactor;

    particle.progress += particle.speed;
    if (particle.progress > 1) {
      particle.progress = 0;
    }

    const t = particle.progress;
    const t1 = 1 - t;
    const point = {
      x: Math.pow(t1, 3) * startPoint.x +
        3 * Math.pow(t1, 2) * t * controlPoint1.x +
        3 * t1 * Math.pow(t, 2) * controlPoint2.x +
        Math.pow(t, 3) * endPoint.x,
      y: Math.pow(t1, 3) * startPoint.y +
        3 * Math.pow(t1, 2) * t * controlPoint1.y +
        3 * t1 * Math.pow(t, 2) * controlPoint2.y +
        Math.pow(t, 3) * endPoint.y
    };

    return {
      ...particle,
      x: point.x,
      y: point.y
    };
  });

  animationFrame = requestAnimationFrame(animateParticles);
};

// --- Lifecycle Hooks ---

onMounted(() => {
  initializeParticles();
  animateParticles();
});

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
});

// --- Label Text and Editing ---

const getLabelText = () => {
  if (customLabel.value) {
    return customLabel.value;
  }

  const messageIndex = typeof props.endNode.branchMessageIndex === 'number'
    ? props.endNode.branchMessageIndex
    : 0;
  const message = props.startNode.messages?.[messageIndex];

  if (message?.content) {
    const words = message.content.split(' ').slice(0, 3).join(' ');
    return words.length > 20 ? words.substring(0, 20) + '...' : words;
  }
  return `Branch ${messageIndex + 1}`;
};

const handleLabelDoubleClick = (event) => {
  event.stopPropagation();
  event.preventDefault();

  if (!isEditing.value) {
    isEditing.value = true;
    labelInput.value = customLabel.value || getLabelText();
    nextTick(() => {
      inputRef.value?.focus();
    });
  }
};

const handleLabelBlur = () => {
  if (labelInput.value.trim()) {
    customLabel.value = labelInput.value.trim();
  }
  isEditing.value = false;
};

const handleKeyDown = (event) => {
  if (event.key === 'Enter') {
    handleLabelBlur();
  } else if (event.key === 'Escape') {
    isEditing.value = false;
  }
};

// --- Theme-based Glow Color ---
const glowColor = computed(() => {
  // This dependency ensures the computed re-runs when currentTheme changes
  const theme = currentTheme.value;
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--glow-color')
    .trim();
});</script>

<style scoped>
.text-container {
  pointer-events: none;
}

.label-text {
  fill: var(--color-base-content);
  opacity: 0.8;
}

.label-background {
  pointer-events: all !important;
  cursor: pointer;
  fill: currentColor;
  background: var(--color-base-100);
  padding: 4px 12px;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  /* Increase hit area */
  padding: 8px 16px;
  margin: -8px -16px;
}

.label-background:hover {
  background: var(--color-base-200);
}

input {
  transition: all 0.2s ease;
  pointer-events: auto !important;
  z-index: 30;
  position: relative;
}

input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary/0.2);
}

textPath.reversed {
  transform: scale(1, -1);
}

/* Ensure proper stacking context */
.label-container {
  isolation: isolate;
}

/* Increase hit area for better interaction */
.label-container * {
  touch-action: manipulation;
}
</style>
