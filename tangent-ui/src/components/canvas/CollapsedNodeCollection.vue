<template>
  <g class="collapsed-node-collection">
    <!-- Main collection container -->
    <rect
      :x="collection.position.x - 150"
      :y="collection.position.y - 100"
      width="300"
      height="200"
      fill="rgba(168, 85, 247, 0.1)"
      stroke="rgba(168, 85, 247, 0.8)"
      stroke-width="3"
      stroke-dasharray="10,5"
      rx="15"
      class="collection-container hover:fill-opacity-20 transition-all cursor-pointer"
      @mousedown="handleMouseDown"
      @dblclick="handleDoubleClick"
    >
      <animate attributeName="stroke-dashoffset" values="0;15" dur="2s" repeatCount="indefinite" />
    </rect>
    
    <!-- Collection title -->
    <text
      :x="collection.position.x"
      :y="collection.position.y - 60"
      text-anchor="middle"
      fill="rgba(168, 85, 247, 0.9)"
      font-size="14"
      font-weight="600"
      class="collection-title"
    >
      {{ collection.title }}
    </text>
    
    <!-- Current node indicator -->
    <text
      :x="collection.position.x"
      :y="collection.position.y - 40"
      text-anchor="middle"
      fill="rgba(168, 85, 247, 0.7)"
      font-size="11"
      class="node-indicator"
    >
      Node {{ collection.currentIndex + 1 }} of {{ collection.nodeIds.size }}
    </text>
    
    <!-- Preview of current node -->
    <g v-if="currentNode" class="current-node-preview">
      <!-- Simplified node representation -->
      <rect
        :x="collection.position.x - 120"
        :y="collection.position.y - 20"
        width="240"
        height="40"
        fill="rgba(255, 255, 255, 0.9)"
        stroke="rgba(168, 85, 247, 0.5)"
        stroke-width="1"
        rx="8"
        class="node-preview"
      />
      
      <!-- Node title (truncated) -->
      <text
        :x="collection.position.x"
        :y="collection.position.y + 5"
        text-anchor="middle"
        fill="rgba(55, 48, 163, 0.8)"
        font-size="12"
        class="node-title"
      >
        {{ truncatedTitle }}
      </text>
    </g>
    
    <!-- Navigation controls -->
    <g class="navigation-controls">
      <!-- Previous button -->
      <circle
        :cx="collection.position.x - 100"
        :cy="collection.position.y + 60"
        r="20"
        fill="rgba(168, 85, 247, 0.2)"
        stroke="rgba(168, 85, 247, 0.6)"
        stroke-width="2"
        class="nav-button hover:fill-opacity-40 transition-all cursor-pointer"
        @click="handlePrevious"
      />
      <text
        :x="collection.position.x - 100"
        :y="collection.position.y + 66"
        text-anchor="middle"
        fill="rgba(168, 85, 247, 0.8)"
        font-size="16"
        font-weight="bold"
        class="nav-text cursor-pointer"
        @click="handlePrevious"
      >
        ‹
      </text>
      
      <!-- Next button -->
      <circle
        :cx="collection.position.x + 100"
        :cy="collection.position.y + 60"
        r="20"
        fill="rgba(168, 85, 247, 0.2)"
        stroke="rgba(168, 85, 247, 0.6)"
        stroke-width="2"
        class="nav-button hover:fill-opacity-40 transition-all cursor-pointer"
        @click="handleNext"
      />
      <text
        :x="collection.position.x + 100"
        :y="collection.position.y + 66"
        text-anchor="middle"
        fill="rgba(168, 85, 247, 0.8)"
        font-size="16"
        font-weight="bold"
        class="nav-text cursor-pointer"
        @click="handleNext"
      >
        ›
      </text>
    </g>
    
    <!-- Expand Button -->
    <g class="expand-button" :transform="`translate(${collection.position.x + 120}, ${collection.position.y - 80})`">
      <circle
        r="12"
        fill="rgba(168, 85, 247, 0.9)"
        stroke="rgba(255, 255, 255, 0.9)"
        stroke-width="2"
        class="expand-btn cursor-pointer hover:fill-opacity-80 transition-all"
        @click="handleExpandClick"
      />
      <text
        text-anchor="middle"
        dy="1"
        fill="white"
        font-size="8"
        font-weight="bold"
        class="expand-btn-text cursor-pointer"
        @click="handleExpandClick"
      >
        ⤢
      </text>
    </g>
    
    <!-- Expand hint -->
    <text
      :x="collection.position.x"
      :y="collection.position.y + 90"
      text-anchor="middle"
      fill="rgba(168, 85, 247, 0.6)"
      font-size="10"
      class="expand-hint"
    >
      Click ⤢ or double-click to expand
    </text>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '@/stores/chatStore'

// Props
const props = defineProps<{
  collectionId: string
  collection: {
    nodeIds: Set<string>
    position: { x: number; y: number }
    currentIndex: number
    title: string
  }
  zoom: number
}>()

// Emits
const emit = defineEmits<{
  expand: [collectionId: string]
  scroll: [collectionId: string, direction: 'next' | 'prev']
  move: [collectionId: string, position: { x: number; y: number }]
}>()

// Store
const store = useChatStore()

// Get current node being displayed
const currentNode = computed(() => {
  const nodeIds = Array.from(props.collection.nodeIds)
  const currentNodeId = nodeIds[props.collection.currentIndex]
  return store.nodes.find(n => n.id === currentNodeId) || null
})

// Truncated title for display
const truncatedTitle = computed(() => {
  if (!currentNode.value?.title) return 'Untitled Node'
  const title = currentNode.value.title
  return title.length > 30 ? title.substring(0, 30) + '...' : title
})

// Drag state
let isDragging = false
let dragStart = { x: 0, y: 0 }

// Handlers
const handleMouseDown = (event: MouseEvent) => {
  isDragging = true
  dragStart = { x: event.clientX, y: event.clientY }
  event.stopPropagation()
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    
    const deltaX = (e.clientX - dragStart.x) / props.zoom
    const deltaY = (e.clientY - dragStart.y) / props.zoom
    
    const newPosition = {
      x: props.collection.position.x + deltaX,
      y: props.collection.position.y + deltaY
    }
    
    emit('move', props.collectionId, newPosition)
    dragStart = { x: e.clientX, y: e.clientY }
  }
  
  const handleMouseUp = () => {
    isDragging = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleDoubleClick = (event: MouseEvent) => {
  event.stopPropagation()
  emit('expand', props.collectionId)
}

const handleNext = (event: MouseEvent) => {
  event.stopPropagation()
  emit('scroll', props.collectionId, 'next')
}

const handlePrevious = (event: MouseEvent) => {
  event.stopPropagation()
  emit('scroll', props.collectionId, 'prev')
}

const handleExpandClick = (event: MouseEvent) => {
  event.stopPropagation()
  emit('expand', props.collectionId)
}
</script>

<style scoped>
.collapsed-node-collection {
  pointer-events: all;
}

.nav-button:hover {
  filter: brightness(1.1);
}

.collection-container:hover {
  filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.4));
}
</style>