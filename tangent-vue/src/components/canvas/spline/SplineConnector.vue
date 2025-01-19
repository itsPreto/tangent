<template>
  <g>
    <!-- Shadow path -->
    <path :d="pathData" stroke="#94a3b8" stroke-width="4" fill="none" opacity="0.2" />
    <!-- Main path -->
    <path :d="pathData" :stroke="isActive ? '#2563eb' : '#94a3b8'" :stroke-width="isActive ? 3 : 2" fill="none"
      marker-end="url(#arrowhead)" class="transition-all duration-200" />

    <!-- Hidden path for text alignment -->
    <path :id="`connection-path-${startNode.id}-${endNode.id}`" :d="pathData" fill="none" stroke="none" />

    <!-- Label Container -->
    <g class="label-container">
      <!-- Background for better readability -->
      <text class="text-container">
        <textPath :href="`#connection-path-${startNode.id}-${endNode.id}`" startOffset="50%" text-anchor="middle">
          <tspan :dy="-12" class="label-text" :style="labelStyle">
            <tspan @dblclick.stop.prevent="handleLabelDoubleClick" class="label-background" v-if="!isEditing">{{
              getLabelText() }}</tspan>
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
import { ref, computed, nextTick } from 'vue';

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

const isEditing = ref(false);
const labelInput = ref('');
const customLabel = ref('');
const inputRef = ref(null);

// Compute font size based on zoom level
const fontSize = computed(() => {
  const baseSize = 16;
  const scaleFactor = 1 / Math.min(1, props.zoomLevel);
  return Math.max(baseSize * scaleFactor, baseSize);
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

const calculateConnectionPoints = () => {
  const messageIndex = props.endNode.branchMessageIndex || 0;
  const messageYOffset = messageIndex * 120 + 40; // Base message height plus some padding

  // Determine if branch comes from left or right based on node type
  const isLeftBranch = props.endNode.type === 'left-branch';

  const startPoint = {
    x: isLeftBranch
      ? props.startNode.x - 48 // Position for left branch button (-12px - button width)
      : props.startNode.x + props.cardWidth + 48, // Position for right branch button
    y: props.startNode.y + messageYOffset
  };

  const endPoint = {
    x: props.endNode.x + (isLeftBranch ? props.cardWidth : 0), // Connect to right side if left branch
    y: props.endNode.y + props.cardHeight / 2
  };

  return { startPoint, endPoint };
};


const calculateLabelPosition = () => {
  const { startPoint, endPoint } = calculateConnectionPoints();
  return {
    x: startPoint.x + (endPoint.x - startPoint.x) / 2 - (150 / Math.min(1, props.zoomLevel)),
    y: startPoint.y + (endPoint.y - startPoint.y) / 2 - (25 / Math.min(1, props.zoomLevel))
  };
};

const pathData = computed(() => {
  const { startPoint, endPoint } = calculateConnectionPoints();

  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Adjust control points based on branch direction and distance
  const isLeftBranch = props.endNode.type === 'left-branch';
  const controlPointDistance = Math.min(80, distance * 0.4);

  const controlPoint1 = {
    x: startPoint.x + (isLeftBranch ? -controlPointDistance : controlPointDistance),
    y: startPoint.y
  };

  const controlPoint2 = {
    x: endPoint.x + (isLeftBranch ? controlPointDistance : -controlPointDistance),
    y: endPoint.y
  };

  return `M ${startPoint.x} ${startPoint.y} 
          C ${controlPoint1.x} ${controlPoint1.y},
            ${controlPoint2.x} ${controlPoint2.y},
            ${endPoint.x} ${endPoint.y}`;
});

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
</style>