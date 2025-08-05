<template>
  <!-- Cluster View - 3-level hierarchy: Topics -> Workspaces -> Branches -->
  <g v-if="showClusterView && clusterData" class="cluster-view-layer">
    <!-- Background gradient -->
    <defs>
      <radialGradient id="cluster-gradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" :stop-color="baseColorSet?.primary || '#6366F1'" stop-opacity="0.05" />
        <stop offset="100%" stop-color="transparent" />
      </radialGradient>
    </defs>

    <!-- Universe background -->
    <circle
      :cx="canvasCenter.x"
      :cy="canvasCenter.y" 
      :r="2000"
      fill="url(#cluster-gradient)"
      opacity="0.6"
    />

    <!-- Topic Islands with 3-level hierarchy -->
    <g v-for="topic in clusterData" :key="topic.id" class="topic-island">
      
      <!-- Topic Center (Level 1) - Star shape -->
      <g class="topic-center">
        <!-- Star shape for topic center -->
        <path
          :d="getStarPath(topic.x, topic.y, 25, 12)"
          fill="white"
          stroke="#4A90E2" 
          stroke-width="3"
          class="topic-star cursor-pointer hover:fill-opacity-90 transition-all"
          @click="navigateToTopic(topic)"
        />
        
        <!-- Topic label -->
        <text
          :x="topic.x"
          :y="topic.y + 45"
          text-anchor="middle"
          fill="#1F2937"
          font-size="14"
          font-weight="bold"
          class="topic-label"
        >
          {{ topic.name }}
        </text>
      </g>

      <!-- Workspaces (Level 2) -->
      <g v-for="workspace in topic.workspaces" :key="workspace.id" class="workspace-node">
        
        <!-- Connection from topic to workspace -->
        <line
          :x1="topic.x"
          :y1="topic.y"
          :x2="workspace.x"
          :y2="workspace.y"
          stroke="#4A90E2"
          stroke-width="2"
          stroke-opacity="0.6"
          class="topic-workspace-connection"
        />
        
        <!-- Workspace circle -->
        <circle
          :cx="workspace.x"
          :cy="workspace.y"
          :r="Math.max(15, workspace.branchCount * 2)"
          fill="#34D399"
          stroke="#059669"
          stroke-width="2"
          opacity="0.8"
          class="workspace-circle cursor-pointer hover:opacity-100 transition-all"
          @click="navigateToWorkspace(workspace.id)"
        />
        
        <!-- Workspace title -->
        <text
          :x="workspace.x"
          :y="workspace.y + Math.max(30, workspace.branchCount * 2 + 15)"
          text-anchor="middle"
          fill="#1F2937"
          font-size="11"
          font-weight="600"
          class="workspace-label"
        >
          {{ workspace.title.length > 20 ? workspace.title.substring(0, 20) + '...' : workspace.title }}
        </text>
        
        <!-- Branch count -->
        <text
          :x="workspace.x"
          :y="workspace.y + Math.max(44, workspace.branchCount * 2 + 29)"
          text-anchor="middle"
          fill="#6B7280"
          font-size="9"
          class="branch-count"
        >
          {{ workspace.branchCount }} nodes
        </text>

        <!-- Branch nodes (Level 3) - Small dots around workspace -->
        <g v-for="(node, index) in workspace.nodes.slice(0, Math.min(workspace.nodes.length, 8))" 
           :key="node.id" class="branch-node">
          
          <!-- Connection from workspace to branch -->
          <line
            :x1="workspace.x"
            :y1="workspace.y"
            :x2="workspace.x + Math.cos((index / Math.min(workspace.nodes.length, 8)) * 2 * Math.PI) * (Math.max(15, workspace.branchCount * 2) + 25)"
            :y2="workspace.y + Math.sin((index / Math.min(workspace.nodes.length, 8)) * 2 * Math.PI) * (Math.max(15, workspace.branchCount * 2) + 25)"
            stroke="#34D399"
            stroke-width="1"
            stroke-opacity="0.4"
            class="workspace-branch-connection"
          />
          
          <!-- Branch dot -->
          <circle
            :cx="workspace.x + Math.cos((index / Math.min(workspace.nodes.length, 8)) * 2 * Math.PI) * (Math.max(15, workspace.branchCount * 2) + 25)"
            :cy="workspace.y + Math.sin((index / Math.min(workspace.nodes.length, 8)) * 2 * Math.PI) * (Math.max(15, workspace.branchCount * 2) + 25)"
            :r="4"
            fill="#F59E0B"
            stroke="#D97706"
            stroke-width="1"
            opacity="0.7"
            class="branch-dot"
          />
        </g>
        
        <!-- Show "+" if there are more nodes -->
        <text
          v-if="workspace.nodes.length > 8"
          :x="workspace.x + Math.cos(0) * (Math.max(15, workspace.branchCount * 2) + 40)"
          :y="workspace.y + 4"
          text-anchor="middle"
          fill="#6B7280"
          font-size="12"
          font-weight="bold"
          class="more-nodes-indicator"
        >
          +{{ workspace.nodes.length - 8 }}
        </text>
      </g>
    </g>

    <!-- Legend -->
    <g class="cluster-legend" :transform="`translate(${legendPosition.x}, ${legendPosition.y})`">
      <rect
        x="-100"
        y="-30"
        width="200"
        height="100"
        :fill="baseColorSet?.base100 || '#FFFFFF'"
        :stroke="baseColorSet?.base300 || '#D1D5DB'"
        stroke-width="1"
        rx="8"
        opacity="0.95"
      />
      
      <text
        x="0"
        y="-10"
        text-anchor="middle"
        :fill="baseColorSet?.content || '#1F2937'"
        font-size="14"
        font-weight="bold"
      >
        Knowledge Cluster View
      </text>
      
      <!-- Legend items -->
      <g transform="translate(-80, 10)">
        <path :d="getStarPath(0, 0, 8, 4)" fill="white" stroke="#4A90E2" stroke-width="1"/>
        <text x="15" y="4" :fill="baseColorSet?.content || '#1F2937'" font-size="10">Topics</text>
      </g>
      
      <g transform="translate(0, 10)">
        <circle cx="0" cy="0" r="6" fill="#34D399" stroke="#059669" stroke-width="1"/>
        <text x="15" y="4" :fill="baseColorSet?.content || '#1F2937'" font-size="10">Workspaces</text>
      </g>
      
      <g transform="translate(-80, 30)">
        <circle cx="0" cy="0" r="3" fill="#F59E0B" stroke="#D97706" stroke-width="1"/>
        <text x="15" y="4" :fill="baseColorSet?.content || '#1F2937'" font-size="10">Branches</text>
      </g>
      
      <text
        x="0"
        y="55"
        text-anchor="middle"
        :fill="baseColorSet?.accent || '#10B981'"
        font-size="9"
        class="cursor-pointer hover:opacity-80"
        @click="zoomToOverview"
      >
        Click to zoom in →
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
  clusterData: Array<{
    id: string
    name: string
    x: number
    y: number
    workspaces: Array<{
      id: string
      title: string
      branchCount: number
      x: number
      y: number
      nodes: any[]
    }>
  }> | null
  isLodLocked: boolean
  lockedLodLevel: string
}>()

// Emits
const emit = defineEmits<{
  navigateToIsland: [island: TopicIsland]
  zoomToOverview: []
  navigateToWorkspace: [workspaceId: string]
}>()

// State
const topicIslands = ref<TopicIsland[]>([])
const hoveredIsland = ref<TopicIsland | null>(null)
const hoveredWorkspace = ref<any>(null)
const isLoading = ref(true)

// Theme
const themeStore = useThemeStore()
const baseColorSet = computed(() => themeStore.currentColorSet)

// Show cluster view based on LOD level (respecting lock state)
const showClusterView = computed(() => {
  let shouldShow;
  
  // If LOD is locked, use the locked level
  if (props.isLodLocked) {
    shouldShow = props.lockedLodLevel === 'cluster' && props.clusterData && props.clusterData.length > 0
    // console.log('TopicIslandView: LOD locked to', props.lockedLodLevel, 'showing cluster:', shouldShow)
  } else {
    // Normal zoom-based logic
    shouldShow = props.zoomLevel <= 0.10 && props.clusterData && props.clusterData.length > 0
    // console.log('TopicIslandView: Showing cluster view at zoom:', props.zoomLevel, 'Topics:', props.clusterData?.length || 0)
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

const navigateToWorkspace = (workspaceId: string) => {
  console.log('Navigate to workspace:', workspaceId)
  emit('navigateToWorkspace', workspaceId)
}

const navigateToTopic = (topic: any) => {
  console.log('Navigate to topic:', topic.name)
  // For now, just zoom to the topic area
  // You could enhance this to focus on the topic cluster
}

// Generate star path for topic centers
const getStarPath = (cx: number, cy: number, outerRadius: number, innerRadius: number) => {
  const points = 5
  let path = ''
  
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const x = cx + Math.cos(angle - Math.PI / 2) * radius
    const y = cy + Math.sin(angle - Math.PI / 2) * radius
    
    if (i === 0) {
      path += `M ${x} ${y}`
    } else {
      path += ` L ${x} ${y}`
    }
  }
  
  path += ' Z'
  return path
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
  // Only log significant zoom changes, not every frame
  if (newZoom <= 0.10 && topicIslands.value.length === 0 && !isLoading.value) {
    initializeIslands()
  }
}, { immediate: true })

// Initialize on mount
onMounted(() => {
  if (showClusterView.value) {
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