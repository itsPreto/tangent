<template>
  <!-- Topic Islands View - Rendered at cluster LOD (<1% zoom) -->
  <g v-if="showTopicIslands" class="topic-islands-layer">
    <!-- Background gradient for knowledge universe feel -->
    <defs>
      <radialGradient id="universe-gradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" :stop-color="baseColorSet?.primary || '#6366F1'" stop-opacity="0.1" />
        <stop offset="70%" :stop-color="baseColorSet?.secondary || '#8B5CF6'" stop-opacity="0.05" />
        <stop offset="100%" stop-color="transparent" />
      </radialGradient>
      
      <!-- Island glow effects -->
      <filter v-for="island in topicIslands" :key="`glow-${island.id}`" 
              :id="`island-glow-${island.id}`" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
        <feMerge> 
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Universe background -->
    <circle
      :cx="canvasCenter.x"
      :cy="canvasCenter.y" 
      :r="universeRadius"
      fill="url(#universe-gradient)"
      opacity="0.6"
    />

    <!-- Connection lines between related islands -->
    <g class="island-connections">
      <line
        v-for="connection in islandConnections"
        :key="`connection-${connection.from}-${connection.to}`"
        :x1="connection.x1"
        :y1="connection.y1"
        :x2="connection.x2"
        :y2="connection.y2"
        :stroke="baseColorSet?.accent || '#10B981'"
        stroke-width="2"
        stroke-opacity="0.3"
        stroke-dasharray="5,10"
      />
    </g>

    <!-- Topic Clusters and Connected Workspaces -->
    <g v-for="island in topicIslands" :key="island.id" class="topic-cluster">
      <!-- Connections from topic cluster to workspaces -->
      <g class="workspace-connections">
        <line
          v-for="(workspace, index) in island.workspaces"
          :key="`connection-${workspace.id}`"
          :x1="island.x"
          :y1="island.y"
          :x2="getWorkspacePosition(island, index).x"
          :y2="getWorkspacePosition(island, index).y"
          :stroke="island.color"
          stroke-width="1"
          stroke-opacity="0.4"
          class="workspace-connection"
        />
      </g>
      
      <!-- Individual workspace circles -->
      <g class="workspace-circles">
        <circle
          v-for="(workspace, index) in island.workspaces"
          :key="workspace.id"
          :cx="getWorkspacePosition(island, index).x"
          :cy="getWorkspacePosition(island, index).y"
          :r="8"
          :fill="island.color"
          :opacity="hoveredIsland?.id === island.id ? 0.9 : 0.7"
          :stroke="island.color"
          stroke-width="1"
          stroke-opacity="0.8"
          class="workspace-circle transition-all duration-300 cursor-pointer"
          @click="navigateToWorkspace(workspace)"
          @mouseenter="onWorkspaceHover(workspace, true)"
          @mouseleave="onWorkspaceHover(workspace, false)"
        />
      </g>
      
      <!-- Topic cluster center -->
      <g 
        class="topic-cluster-center"
        @click="navigateToIsland(island)"
        @mouseenter="onIslandHover(island, true)"
        @mouseleave="onIslandHover(island, false)"
        style="cursor: pointer;"
      >
        <!-- Topic cluster base -->
        <circle
          :cx="island.x"
          :cy="island.y"
          :r="25"
          :fill="island.color"
          :opacity="hoveredIsland?.id === island.id ? 0.3 : 0.2"
          :stroke="island.color"
          :stroke-width="hoveredIsland?.id === island.id ? 3 : 2"
          :stroke-opacity="hoveredIsland?.id === island.id ? 0.9 : 0.6"
          class="transition-all duration-300"
        />
        
        <!-- Topic cluster core -->
        <circle
          :cx="island.x"
          :cy="island.y"
          :r="15"
          :fill="island.color"
          :opacity="hoveredIsland?.id === island.id ? 0.6 : 0.4"
          class="transition-all duration-300"
        />
      </g>

      <!-- Island label -->
      <text
        :x="island.x"
        :y="island.y + 45"
        text-anchor="middle"
        :fill="baseColorSet?.content || '#1F2937'"
        font-size="12"
        font-weight="600"
        :opacity="hoveredIsland?.id === island.id ? 1 : 0.8"
        class="transition-all duration-300"
      >
        {{ island.title }}
      </text>

      <!-- Workspace count -->
      <text
        :x="island.x"
        :y="island.y + 60"
        text-anchor="middle"
        :fill="baseColorSet?.content || '#1F2937'"
        font-size="10"
        :opacity="hoveredIsland?.id === island.id ? 0.9 : 0.6"
        class="transition-all duration-300"
      >
        {{ island.workspaces.length }} workspace{{ island.workspaces.length !== 1 ? 's' : '' }}
      </text>
    </g>

    <!-- Legend -->
    <g class="topic-legend" :transform="`translate(${legendPosition.x}, ${legendPosition.y})`">
      <rect
        x="-80"
        y="-20"
        width="160"
        height="80"
        :fill="baseColorSet?.base100 || '#FFFFFF'"
        :stroke="baseColorSet?.base300 || '#D1D5DB'"
        stroke-width="1"
        rx="8"
        opacity="0.9"
      />
      
      <text
        x="0"
        y="-5"
        text-anchor="middle"
        :fill="baseColorSet?.content || '#1F2937'"
        font-size="12"
        font-weight="600"
      >
        Knowledge Universe
      </text>
      
      <text
        x="0"
        y="10"
        text-anchor="middle"
        :fill="baseColorSet?.content || '#1F2937'"
        font-size="10"
        opacity="0.7"
      >
        {{ totalWorkspaces }} workspaces
      </text>
      
      <text
        x="0"
        y="25"
        text-anchor="middle"
        :fill="baseColorSet?.content || '#1F2937'"
        font-size="10"
        opacity="0.7"
      >
        {{ topicIslands.length }} topic{{ topicIslands.length !== 1 ? 's' : '' }}
      </text>
      
      <text
        x="0"
        y="45"
        text-anchor="middle"
        :fill="baseColorSet?.accent || '#10B981'"
        font-size="9"
        class="cursor-pointer hover:opacity-80"
        @click="zoomToOverview"
      >
        Click island to explore →
      </text>
    </g>
  </g>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useThemeStore } from '@/stores/themeStore'
import { topicSpatialService, type TopicIsland } from '@/services/topicSpatialService'
import { clusteringService } from '@/services/clusteringService'

// Props
const props = defineProps<{
  zoomLevel: number
  viewportBounds: {
    left: number
    right: number
    top: number
    bottom: number
    centerX: number
    centerY: number
  } | null
}>()

// Emits
const emit = defineEmits<{
  navigateToIsland: [island: TopicIsland]
  zoomToOverview: []
}>()

// State
const topicIslands = ref<TopicIsland[]>([])
const hoveredIsland = ref<TopicIsland | null>(null)
const hoveredWorkspace = ref<any>(null)
const isLoading = ref(true)

// Theme
const themeStore = useThemeStore()
const baseColorSet = computed(() => themeStore.currentColorSet)

// Show topic islands only at very low zoom (below workspace overview)
const showTopicIslands = computed(() => {
  const shouldShow = props.zoomLevel < 0.05 // Show below 5% zoom (lower than workspace overview)
  if (shouldShow && topicIslands.value.length > 0) {
    console.log('TopicIslandView: Showing islands at zoom:', props.zoomLevel, 'Islands:', topicIslands.value.length)
  }
  return shouldShow
})

// Canvas center
const canvasCenter = computed(() => ({
  x: props.viewportBounds?.centerX || 0,
  y: props.viewportBounds?.centerY || 0
}))

// Universe radius based on viewport
const universeRadius = computed(() => {
  if (!props.viewportBounds) return 3000
  return Math.max(
    props.viewportBounds.width,
    props.viewportBounds.height
  ) * 0.8
})

// Legend position (top-right of viewport)
const legendPosition = computed(() => {
  if (!props.viewportBounds) return { x: 200, y: -200 }
  return {
    x: props.viewportBounds.right - 100,
    y: props.viewportBounds.top + 60
  }
})

// Total workspaces across all islands
const totalWorkspaces = computed(() => {
  return topicIslands.value.reduce((total, island) => total + island.workspaces.length, 0)
})

// Island connections (lines between related topics)
const islandConnections = computed(() => {
  const connections: Array<{
    from: string
    to: string
    x1: number
    y1: number
    x2: number
    y2: number
  }> = []

  // Create connections between islands that share common tags
  for (let i = 0; i < topicIslands.value.length; i++) {
    for (let j = i + 1; j < topicIslands.value.length; j++) {
      const island1 = topicIslands.value[i]
      const island2 = topicIslands.value[j]
      
      // Check if islands share common tags
      const sharedTags = island1.commonTags?.filter(tag1 => 
        island2.commonTags?.some(tag2 => tag2.name === tag1.name)
      ) || []
      
      if (sharedTags.length > 0) {
        connections.push({
          from: island1.id,
          to: island2.id,
          x1: island1.x,
          y1: island1.y,
          x2: island2.x,
          y2: island2.y
        })
      }
    }
  }

  return connections
})

// Get position for workspace circles around the topic cluster
const getWorkspacePosition = (island: TopicIsland, workspaceIndex: number) => {
  const workspaceCount = island.workspaces.length
  if (workspaceCount === 1) {
    return { x: island.x + 60, y: island.y }
  }
  
  const angle = (workspaceIndex / workspaceCount) * 2 * Math.PI
  const baseRadius = 80 // Distance from topic center
  const radiusVariation = 30 // Add some variation to make it more organic
  const radius = baseRadius + (Math.sin(workspaceIndex * 2.5) * radiusVariation)
  
  return {
    x: island.x + Math.cos(angle) * radius,
    y: island.y + Math.sin(angle) * radius
  }
}

// Event handlers
const onIslandHover = (island: TopicIsland, isHovered: boolean) => {
  hoveredIsland.value = isHovered ? island : null
}

const onWorkspaceHover = (workspace: any, isHovered: boolean) => {
  hoveredWorkspace.value = isHovered ? workspace : null
}

const navigateToIsland = (island: TopicIsland) => {
  emit('navigateToIsland', island)
}

const navigateToWorkspace = (workspace: any) => {
  console.log('Navigate to workspace:', workspace)
  // TODO: Implement workspace navigation
}

const zoomToOverview = () => {
  emit('zoomToOverview')
}

// Initialize topic islands
const initializeIslands = async () => {
  isLoading.value = true
  console.log('TopicIslandView: Initializing islands...')
  try {
    await topicSpatialService.initialize()
    const islands = topicSpatialService.getTopicIslands()
    console.log('TopicIslandView: Got islands:', islands.length)
    topicIslands.value = islands
    
    if (islands.length === 0) {
      console.warn('TopicIslandView: No islands found, trying fallback...')
      // Fallback: create islands directly from clustering results
      await createIslandsFromClustering()
    }
  } catch (error) {
    console.error('Error initializing topic islands:', error)
    // Fallback: create islands directly from clustering results
    await createIslandsFromClustering()
  } finally {
    isLoading.value = false
  }
}

// Fallback: create islands directly from clustering results
const createIslandsFromClustering = async () => {
  try {
    const results = await clusteringService.getResults()
    console.log('TopicIslandView: Clustering results:', results.clusters?.length || 0, 'clusters')
    
    if (results.clusters && results.clusters.length > 0) {
      const islands = results.clusters.map((cluster, index) => {
        // Create more organic, scattered positioning like in the screenshot
        const gridSize = Math.ceil(Math.sqrt(results.clusters.length))
        const col = index % gridSize
        const row = Math.floor(index / gridSize)
        
        // Add some randomness to make it look more natural
        const baseX = (col - gridSize/2) * 400 + (Math.random() - 0.5) * 200
        const baseY = (row - gridSize/2) * 300 + (Math.random() - 0.5) * 150
        
        return {
          id: cluster.id,
          title: cluster.title,
          description: `${cluster.workspaces?.length || 0} workspaces`,
          x: baseX,
          y: baseY,
          radius: 200 + (cluster.workspaces?.length || 0) * 10,
          workspaces: cluster.workspaces || [],
          color: generateIslandColor(index),
          commonTags: cluster.commonTags || []
        }
      })
      
      console.log('TopicIslandView: Created fallback islands:', islands.length)
      topicIslands.value = islands
    }
  } catch (error) {
    console.error('Error creating fallback islands:', error)
    // Last resort: create a simple test island
    console.log('TopicIslandView: Creating test island as last resort')
    topicIslands.value = [{
      id: 'test-island',
      title: 'Test Topic Island',
      description: 'Debug island to verify rendering',
      x: 0,
      y: 0,
      radius: 300,
      workspaces: [{ id: 'test', title: 'Test Workspace' }],
      color: '#4ECDC4',
      commonTags: []
    }]
  }
}

// Generate colors for islands
const generateIslandColor = (index: number): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ]
  return colors[index % colors.length]
}

// Watch for zoom level changes to trigger initialization
watch(() => props.zoomLevel, (newZoom) => {
  console.log('TopicIslandView: Zoom changed to:', newZoom)
  if (newZoom < 0.08 && topicIslands.value.length === 0 && !isLoading.value) {
    console.log('TopicIslandView: Triggering initialization...')
    initializeIslands()
  }
}, { immediate: true })

// Initialize on mount
onMounted(() => {
  if (showTopicIslands.value) {
    initializeIslands()
  }
})
</script>

<style scoped>
.topic-island {
  transition: all 0.3s ease;
}

.topic-island:hover {
  transform: scale(1.05);
}

.workspace-dots circle {
  transition: all 0.2s ease;
}

.common-tags text {
  font-family: monospace;
}

.topic-legend text {
  pointer-events: all;
}
</style>