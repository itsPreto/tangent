import { clusteringService, type TopicIsland, type ClusterResult } from './clusteringService'

interface SpatialPosition {
  x: number
  y: number
}

interface WorkspacePosition extends SpatialPosition {
  workspaceId: string
  topicId?: string
}

interface TopicIslandLayout {
  island: TopicIsland
  position: SpatialPosition
  workspacePositions: WorkspacePosition[]
}

class TopicSpatialService {
  private topicIslands: TopicIsland[] = []
  private workspacePositions: Map<string, WorkspacePosition> = new Map()
  private islandLayoutCache: Map<string, TopicIslandLayout> = new Map()
  
  // Island configuration
  private readonly ISLAND_SPACING = 2000 // Distance between topic islands
  private readonly ISLAND_RADIUS_BASE = 300 // Base radius for islands
  private readonly ISLAND_RADIUS_MULTIPLIER = 50 // Additional radius per workspace
  private readonly WORKSPACE_SPACING = 150 // Spacing between workspaces within island
  private readonly CANVAS_CENTER = { x: 0, y: 0 } // Center of the infinite canvas

  /**
   * Initialize topic islands and workspace positions
   */
  async initialize(): Promise<void> {
    try {
      // Get topic islands from clustering service
      this.topicIslands = await clusteringService.getTopicIslands()
      
      // Generate spatial layout
      await this.generateTopicLayout()
      
    } catch (error) {
      console.error('Error initializing topic spatial service:', error)
      // Fallback: generate from clustering results
      await this.generateFromClusteringResults()
    }
  }

  /**
   * Generate topic island layout in a circular pattern around canvas center
   */
  private async generateTopicLayout(): Promise<void> {
    if (this.topicIslands.length === 0) return

    const angleStep = (2 * Math.PI) / this.topicIslands.length
    
    this.topicIslands.forEach((island, index) => {
      // Position islands in a circle around the center
      const angle = index * angleStep
      const distance = this.ISLAND_SPACING + (this.topicIslands.length > 6 ? this.ISLAND_SPACING * 0.5 : 0)
      
      const islandPosition: SpatialPosition = {
        x: this.CANVAS_CENTER.x + Math.cos(angle) * distance,
        y: this.CANVAS_CENTER.y + Math.sin(angle) * distance
      }

      // Calculate island radius based on workspace count
      const radius = this.ISLAND_RADIUS_BASE + (island.workspaces.length * this.ISLAND_RADIUS_MULTIPLIER)
      
      // Position workspaces within the island
      const workspacePositions = this.generateWorkspacePositionsInIsland(
        island.workspaces,
        islandPosition,
        radius,
        island.id
      )

      // Cache the layout
      const layout: TopicIslandLayout = {
        island: { ...island, x: islandPosition.x, y: islandPosition.y, radius },
        position: islandPosition,
        workspacePositions
      }
      
      this.islandLayoutCache.set(island.id, layout)
      
      // Update workspace position map
      workspacePositions.forEach(pos => {
        this.workspacePositions.set(pos.workspaceId, pos)
      })
    })
  }

  /**
   * Generate workspace positions within a topic island using circular packing
   */
  private generateWorkspacePositionsInIsland(
    workspaces: any[],
    islandCenter: SpatialPosition,
    islandRadius: number,
    topicId: string
  ): WorkspacePosition[] {
    if (workspaces.length === 0) return []
    
    if (workspaces.length === 1) {
      // Single workspace goes in the center
      return [{
        workspaceId: workspaces[0].id,
        x: islandCenter.x,
        y: islandCenter.y,
        topicId
      }]
    }

    const positions: WorkspacePosition[] = []
    
    if (workspaces.length <= 6) {
      // Small groups: arrange in a circle around island center
      const angleStep = (2 * Math.PI) / workspaces.length
      const ringRadius = Math.min(islandRadius * 0.6, this.WORKSPACE_SPACING * 2)
      
      workspaces.forEach((workspace, index) => {
        const angle = index * angleStep
        positions.push({
          workspaceId: workspace.id,
          x: islandCenter.x + Math.cos(angle) * ringRadius,
          y: islandCenter.y + Math.sin(angle) * ringRadius,
          topicId
        })
      })
    } else {
      // Large groups: use multiple rings
      let remainingWorkspaces = [...workspaces]
      let currentRadius = this.WORKSPACE_SPACING
      let ringIndex = 0
      
      while (remainingWorkspaces.length > 0 && ringIndex < 3) {
        const circumference = 2 * Math.PI * currentRadius
        const maxInRing = Math.floor(circumference / this.WORKSPACE_SPACING)
        const inThisRing = Math.min(remainingWorkspaces.length, maxInRing)
        
        if (ringIndex === 0 && inThisRing === 1) {
          // First ring with single item goes in center
          positions.push({
            workspaceId: remainingWorkspaces[0].id,
            x: islandCenter.x,
            y: islandCenter.y,
            topicId
          })
          remainingWorkspaces.shift()
        } else {
          // Arrange in ring
          const angleStep = (2 * Math.PI) / inThisRing
          for (let i = 0; i < inThisRing; i++) {
            const angle = i * angleStep
            positions.push({
              workspaceId: remainingWorkspaces[i].id,
              x: islandCenter.x + Math.cos(angle) * currentRadius,
              y: islandCenter.y + Math.sin(angle) * currentRadius,
              topicId
            })
          }
          remainingWorkspaces.splice(0, inThisRing)
        }
        
        currentRadius += this.WORKSPACE_SPACING
        ringIndex++
      }
    }

    return positions
  }

  /**
   * Fallback: generate topic islands from clustering results
   */
  private async generateFromClusteringResults(): Promise<void> {
    try {
      const results = await clusteringService.getResults()
      if (!results.clusters || results.clusters.length === 0) return

      // Convert cluster results to topic islands
      this.topicIslands = results.clusters.map((cluster, index) => ({
        id: cluster.id,
        title: cluster.title,
        description: `Topic cluster with ${cluster.workspaces.length} workspaces`,
        x: 0, // Will be set in generateTopicLayout
        y: 0,
        radius: 0,
        workspaces: cluster.workspaces,
        color: this.generateTopicColor(index),
        commonTags: cluster.commonTags || []
      }))

      await this.generateTopicLayout()
    } catch (error) {
      console.error('Error generating from clustering results:', error)
    }
  }

  /**
   * Generate a color for a topic island
   */
  private generateTopicColor(index: number): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ]
    return colors[index % colors.length]
  }

  /**
   * Get position for a workspace
   */
  getWorkspacePosition(workspaceId: string): WorkspacePosition | null {
    return this.workspacePositions.get(workspaceId) || null
  }

  /**
   * Get all topic islands with their layouts
   */
  getTopicIslands(): TopicIsland[] {
    return Array.from(this.islandLayoutCache.values()).map(layout => layout.island)
  }

  /**
   * Get the nearest topic island to a position
   */
  getNearestTopicIsland(x: number, y: number): TopicIsland | null {
    if (this.topicIslands.length === 0) return null

    let nearestIsland: TopicIsland | null = null
    let nearestDistance = Infinity

    for (const island of this.topicIslands) {
      const distance = Math.sqrt(
        Math.pow(island.x - x, 2) + Math.pow(island.y - y, 2)
      )
      
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIsland = island
      }
    }

    return nearestIsland
  }

  /**
   * Assign workspace to topic island and update its position
   */
  async assignWorkspaceToTopic(workspaceId: string, topicId: string): Promise<WorkspacePosition | null> {
    try {
      // Get the topic island layout
      const layout = this.islandLayoutCache.get(topicId)
      if (!layout) {
        console.error(`Topic island not found: ${topicId}`)
        return null
      }

      // Find an available position in the island
      const newPosition = this.findAvailablePositionInIsland(layout)
      
      if (newPosition) {
        // Update local cache
        this.workspacePositions.set(workspaceId, {
          workspaceId,
          x: newPosition.x,
          y: newPosition.y,
          topicId
        })

        // Update backend
        await clusteringService.updateWorkspacePosition(workspaceId, newPosition.x, newPosition.y, topicId)
        
        return this.workspacePositions.get(workspaceId) || null
      }

      return null
    } catch (error) {
      console.error('Error assigning workspace to topic:', error)
      return null
    }
  }

  /**
   * Find an available position within a topic island
   */
  private findAvailablePositionInIsland(layout: TopicIslandLayout): SpatialPosition | null {
    const { island, position } = layout
    const existingPositions = layout.workspacePositions

    // Try to place in the next available ring position
    const maxRadius = island.radius * 0.8
    let currentRadius = this.WORKSPACE_SPACING
    
    while (currentRadius <= maxRadius) {
      const circumference = 2 * Math.PI * currentRadius
      const positionsInRing = Math.floor(circumference / this.WORKSPACE_SPACING)
      
      for (let i = 0; i < positionsInRing; i++) {
        const angle = (i / positionsInRing) * 2 * Math.PI
        const testX = position.x + Math.cos(angle) * currentRadius
        const testY = position.y + Math.sin(angle) * currentRadius
        
        // Check if position is available (not too close to existing positions)
        const isAvailable = existingPositions.every(pos => {
          const distance = Math.sqrt(
            Math.pow(pos.x - testX, 2) + Math.pow(pos.y - testY, 2)
          )
          return distance >= this.WORKSPACE_SPACING * 0.8
        })
        
        if (isAvailable) {
          return { x: testX, y: testY }
        }
      }
      
      currentRadius += this.WORKSPACE_SPACING
    }

    return null
  }

  /**
   * Get distance and direction to nearest topic island
   */
  getDistanceToNearestTopic(viewportX: number, viewportY: number): {
    distance: number
    direction: { x: number, y: number }
    island: TopicIsland | null
  } {
    const nearestIsland = this.getNearestTopicIsland(viewportX, viewportY)
    
    if (!nearestIsland) {
      return {
        distance: 0,
        direction: { x: 1, y: 0 },
        island: null
      }
    }

    const dx = nearestIsland.x - viewportX
    const dy = nearestIsland.y - viewportY
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    return {
      distance,
      direction: distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 1, y: 0 },
      island: nearestIsland
    }
  }
}

// Create singleton instance
export const topicSpatialService = new TopicSpatialService()

export type { TopicIslandLayout, WorkspacePosition, SpatialPosition }