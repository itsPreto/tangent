<template>
  <g>
    <!-- Main dashed path -->
    <path :d="pathData" :stroke="isActive ? '#2563eb' : '#94a3b8'" :stroke-width="strokeWidth" fill="none"
      :stroke-dasharray="dashPattern" class="transition-all duration-200" opacity="0.4" />

    <!-- Particles with scaled radius -->
    <g v-for="particle in particles" :key="particle.id">
      <circle :cx="particle.x" :cy="particle.y" :r="particleRadius" :fill="isActive ? '#2563eb' : '#94a3b8'">
        <animate attributeName="opacity" values="1;0.3;1" :dur="particle.duration" repeatCount="indefinite" />
      </circle>
    </g>


    <!-- Hidden path for text alignment -->
    <path :id="`connection-path-${startNode.id}-${endNode.id}`" :d="isLeftBranch ? reversedPathData : pathData"
      fill="none" stroke="none" />

    <!-- Label Container -->
    <g class="label-container">
      <text class="text-container">
        <textPath :href="`#connection-path-${startNode.id}-${endNode.id}`" startOffset="50%" text-anchor="middle"
          :side="isLeftBranch ? 'right' : 'left'" :class="{ 'reversed': isLeftBranch }">
          <tspan :dy="-12" class="label-text" :style="labelStyle">
            <tspan @dblclick.stop.prevent="handleLabelDoubleClick" class="label-background" v-if="!isEditing">
              {{ getLabelText() }}
            </tspan>
          </tspan>
        </textPath>
      </text>

      <!-- Edit Input -->
      <foreignObject v-if="isEditing" :x="calculateLabelPosition().x" :y="calculateLabelPosition().y"
        :width="300 / Math.min(1, zoomLevel)" :height="50 / Math.min(1, zoomLevel)" @dblclick.stop.prevent>
        <div xmlns="http://www.w3.org/2000/svg" class="flex items-center justify-center w-full h-full">
          <input ref="inputRef" v-model="labelInput" @blur="handleLabelBlur" @keydown="handleKeyDown"
            class="bg-base-100 border border-base-300 rounded px-3 py-2 text-center w-full" :style="inputStyle" />
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

const strokeWidth = computed(() => {
  const scale = 1 / Math.pow(props.zoomLevel, 1.2); // More aggressive scaling
  return baseStroke * Math.min(scale, 4); // Increased max scale
});

// Enhanced scaling for dash pattern
const dashPattern = computed(() => {
  const scale = 1 / Math.pow(props.zoomLevel, 1.2);
  const dash = 4 * Math.min(scale, 4);
  const gap = 6 * Math.min(scale, 4);
  return `${dash} ${gap}`;
});

// Enhanced scaling for particles
const particleRadius = computed(() => {
  const scale = 1 / Math.pow(props.zoomLevel, 1.2);
  return baseParticleRadius * Math.min(scale, 4);
});

// First, update the animateParticles function to correctly calculate control points
const animateParticles = () => {
  const { startPoint, endPoint } = calculateConnectionPoints();
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Use the same curve calculations as the main path
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

  // Get current base speed based on zoom level
  const baseSpeed = getParticleSpeed();

  particles.value = particles.value.map(particle => {
    // Update particle speed based on current zoom level while maintaining relative randomness
    const relativeSpeedFactor = particle.speed / (particle.speed - (Math.random() * particle.speed * 0.5));
    const newSpeed = baseSpeed + (Math.random() * baseSpeed * 0.5);
    particle.speed = newSpeed * relativeSpeedFactor;

    // Update progress with new speed
    particle.progress += particle.speed;
    if (particle.progress > 1) {
      particle.progress = 0;
    }

    // Get point on curve using the updated control points
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

// Update the getParticleSpeed function to adjust for the longer curve
const getParticleSpeed = () => {
  const scale = 1 / Math.max(0.3, props.zoomLevel);
  // Reduce base speed since the curve is longer
  return (baseParticleSpeed * 0.7) * Math.min(scale, 2);
};

// Adjust the number of particles and their initialization
const initializeParticles = () => {
  const newParticles = [];
  const baseSpeed = getParticleSpeed();
  
  // Increase number of particles since the curve is longer
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

const fontSize = computed(() => {
  const scaleFactor = 1 / Math.min(1, props.zoomLevel);
  return Math.max(baseFontSize * scaleFactor, baseFontSize);
});

const isLeftBranch = computed(() => {
  return props.endNode.type === 'left-branch';
});

const labelStyle = computed(() => ({
  fontSize: `${fontSize.value}px`,
  fontWeight: 500
}));

const inputStyle = computed(() => ({
  fontSize: `${fontSize.value}px`,
  fontWeight: 500,
  transform: `scale(${1 / props.zoomLevel})`,
  transformOrigin: 'center'
}));

// Path calculations
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
// Find the pathData computed property and replace it with this enhanced version
const pathData = computed(() => {
  const { startPoint, endPoint } = calculateConnectionPoints();

  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Increase the control point distance significantly
  const controlPointDistance = Math.min(distance * 0.8, 200);
  
  // Add vertical offset to control points to create more curve
  const verticalOffset = Math.min(Math.abs(dy), 100) * (dy < 0 ? -1 : 1);
  
  const controlPoint1 = {
    x: startPoint.x + (isLeftBranch.value ? -controlPointDistance : controlPointDistance),
    y: startPoint.y + verticalOffset
  };

  const controlPoint2 = {
    x: endPoint.x + (isLeftBranch.value ? controlPointDistance : -controlPointDistance),
    y: endPoint.y - verticalOffset
  };

  return `M ${startPoint.x} ${startPoint.y} 
          C ${controlPoint1.x} ${controlPoint1.y},
            ${controlPoint2.x} ${controlPoint2.y},
            ${endPoint.x} ${endPoint.y}`;
});

// Also update the reversedPathData computed property for consistency
const reversedPathData = computed(() => {
  const { startPoint, endPoint } = calculateConnectionPoints();

  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Use the same enhanced curving logic
  const controlPointDistance = Math.min(distance * 0.8, 200);
  const verticalOffset = Math.min(Math.abs(dy), 100) * (dy < 0 ? -1 : 1);

  const controlPoint1 = {
    x: endPoint.x + (isLeftBranch.value ? controlPointDistance : -controlPointDistance),
    y: endPoint.y - verticalOffset
  };

  const controlPoint2 = {
    x: startPoint.x + (isLeftBranch.value ? -controlPointDistance : controlPointDistance),
    y: startPoint.y + verticalOffset
  };

  return `M ${endPoint.x} ${endPoint.y} 
          C ${controlPoint1.x} ${controlPoint1.y},
            ${controlPoint2.x} ${controlPoint2.y},
            ${startPoint.x} ${startPoint.y}`;
});

// Update the getPointOnCurve function to match the new curving logic
const getPointOnCurve = (t, startPoint, endPoint) => {
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

onMounted(() => {
  initializeParticles();
  animateParticles();
});

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
});

// Label position calculation
const calculateLabelPosition = () => {
  const { startPoint, endPoint } = calculateConnectionPoints();
  const midX = startPoint.x + (endPoint.x - startPoint.x) / 2;
  const midY = startPoint.y + (endPoint.y - startPoint.y) / 2;

  return {
    x: midX - (150 / Math.min(1, props.zoomLevel)),
    y: midY - (25 / Math.min(1, props.zoomLevel))
  };
};

// Label text handling
const getLabelText = () => {
  if (customLabel.value) {
    return customLabel.value;
  }

  const messageIndex = props.endNode.branchMessageIndex;
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
</script>

<style scoped>
.text-container {
  pointer-events: none;
}

.label-text {
  pointer-events: none;
  fill: var(--color-base-content);
  opacity: 0.8;
}

.label-background {
  pointer-events: all;
  cursor: pointer;
  fill: currentColor;
  background: var(--color-base-100);
  padding: 4px 12px;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.label-background:hover {
  background: var(--color-base-200);
}

input {
  transition: all 0.2s ease;
}

input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary/0.2);
}

textPath.reversed {
  transform: scale(1, -1);
}
</style>