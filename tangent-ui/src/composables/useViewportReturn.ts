import { ref, computed, type Ref } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { topicSpatialService } from '@/services/topicSpatialService'

export function useViewportReturn(
  zoom: Ref<number>, 
  panX: Ref<number>, 
  panY: Ref<number>, 
  autoFitNodes?: () => void,
  allWorkspaceNodes?: Ref<any[]>
) {
  const store = useCanvasStore()
  
  // State - explicitly start with indicator hidden
  const returnTimeout = ref<number | null>(null)
  const showDistanceIndicator = ref(false) // Start with indicator hidden
  const isIndicatorFadingOut = ref(false)
  const distanceToContent = ref(0)
  const directionToContent = ref({ x: 1, y: 0 }) // Default pointing right
  const hasInteracted = ref(false) // Track if user has interacted with canvas
  const stateChangeTimeout = ref<number | null>(null) // Debounce rapid state changes
  
  
  // FORCE indicator to be hidden initially
  showDistanceIndicator.value = false
  
  // Debounced state change to prevent rapid oscillation during transitions
  const setShowIndicatorDebounced = (shouldShow: boolean, immediate = false) => {
    if (stateChangeTimeout.value) {
      clearTimeout(stateChangeTimeout.value)
    }
    
    if (immediate) {
      showDistanceIndicator.value = shouldShow
    } else {
      stateChangeTimeout.value = setTimeout(() => {
        showDistanceIndicator.value = shouldShow
        stateChangeTimeout.value = null
      }, 50) as unknown as number // Small debounce to prevent rapid changes
    }
  }
  
  // Get all nodes including input container - simplified to match zui-prototype pattern
  const getAllNodes = () => {
    let nodes = []
    
    // Use workspace nodes if available (includes workspaceId for clustering)
    if (allWorkspaceNodes?.value && allWorkspaceNodes.value.length > 0) {
      nodes = allWorkspaceNodes.value.map(node => ({
        id: node.id,
        x: node.x || 0,
        y: node.y || 0,
        width: node.type === 'tool-call-compact' ? 120 : 400,
        height: node.type === 'tool-call-compact' ? 40 : 300,
        workspaceId: node.workspaceId // Include workspace ID for clustering
      }))
    } else if (store.nodes && store.nodes.length > 0) {
      // Fallback to regular nodes if no workspace nodes
      nodes = store.nodes.map(node => ({
        id: node.id,
        x: node.x || 0,
        y: node.y || 0,
        width: node.type === 'tool-call-compact' ? 120 : 400,
        height: node.type === 'tool-call-compact' ? 40 : 300
      }))
    }
    
    // Add input container as a "node" at its fixed coordinate
    const canvasElement = document.querySelector('.workspace-container')
    const inputContainer = canvasElement?.querySelector('.canvas-input-container')
    
    if (inputContainer) {
      // Input container now lives at fixed world coordinate (-3000, -3000)
      const NEW_CHAT_X = -3000
      const NEW_CHAT_Y = -3000
      
      nodes.push({
        id: 'input-container',
        x: NEW_CHAT_X,
        y: NEW_CHAT_Y,
        width: 600, // Match input container width from component
        height: 300  // Reasonable height for input container
      })
    }
    
    return nodes
  }
  
  // Check if any nodes are visible in the current viewport
  const isAnyNodeVisible = (canvasRef: HTMLElement | null) => {
    const rect = canvasRef?.getBoundingClientRect()
    if (!rect) {
      return true
    }
    
    const currentZoom = zoom.value
    
    // Calculate viewport boundaries in world space
    const viewportLeft = -panX.value / currentZoom
    const viewportRight = (rect.width - panX.value) / currentZoom
    const viewportTop = -panY.value / currentZoom
    const viewportBottom = (rect.height - panY.value) / currentZoom
    
    const nodes = getAllNodes()
    if (nodes.length === 0) {
      return true // If no nodes, don't show indicator
    }
    
    // Check if any node intersects with viewport
    const visible = nodes.some(node => {
      const nodeLeft = node.x
      const nodeRight = node.x + node.width
      const nodeTop = node.y
      const nodeBottom = node.y + node.height
      
      const isVisible = !(nodeRight < viewportLeft || 
               nodeLeft > viewportRight || 
               nodeBottom < viewportTop || 
               nodeTop > viewportBottom)
      
      return isVisible
    })
    
    return visible
  }
  
  // Calculate distance and direction to nearest content
  const updateDistanceIndicator = (canvasRef: HTMLElement | null) => {
    const rect = canvasRef?.getBoundingClientRect()
    if (!rect) return
    
    const currentZoom = zoom.value
    const viewportCenterX = (rect.width / 2 - panX.value) / currentZoom
    const viewportCenterY = (rect.height / 2 - panY.value) / currentZoom
    
    // At very low zoom levels (<8%), show distance to nearest topic island
    if (currentZoom < 0.08) {
      const topicInfo = topicSpatialService.getDistanceToNearestTopic(viewportCenterX, viewportCenterY)
      
      if (topicInfo.island) {
        directionToContent.value = topicInfo.direction
        distanceToContent.value = Math.round(topicInfo.distance)
        return
      }
    }
    
    // Get all nodes and try to detect workspace clusters
    const nodes = getAllNodes()
    if (nodes.length === 0) {
      return
    }
    
    // Group nodes by workspace if they have workspaceId
    const workspaceClusters = new Map()
    const unclusteredNodes = []
    
    nodes.forEach(node => {
      // Check if node has workspaceId property
      if (node.workspaceId) {
        if (!workspaceClusters.has(node.workspaceId)) {
          workspaceClusters.set(node.workspaceId, [])
        }
        workspaceClusters.get(node.workspaceId).push(node)
      } else {
        unclusteredNodes.push(node)
      }
    })
    
    // If we have workspace clusters, find the nearest one
    if (workspaceClusters.size > 0) {
      let nearestClusterCenter = null
      let nearestDistance = Infinity
      
      workspaceClusters.forEach((clusterNodes, workspaceId) => {
        // Calculate cluster center
        let centerX = 0, centerY = 0
        clusterNodes.forEach(node => {
          centerX += node.x + node.width / 2
          centerY += node.y + node.height / 2
        })
        centerX /= clusterNodes.length
        centerY /= clusterNodes.length
        
        // Calculate distance to viewport center
        const distance = Math.sqrt(
          Math.pow(centerX - viewportCenterX, 2) + 
          Math.pow(centerY - viewportCenterY, 2)
        )
        
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestClusterCenter = { x: centerX, y: centerY }
        }
      })
      
      // Point to nearest cluster if it's far enough away
      if (nearestClusterCenter && nearestDistance > 500) {
        const dx = nearestClusterCenter.x - viewportCenterX
        const dy = nearestClusterCenter.y - viewportCenterY
        const length = Math.sqrt(dx * dx + dy * dy)
        
        directionToContent.value = {
          x: dx / length,
          y: dy / length
        }
        distanceToContent.value = Math.round(length)
        return
      }
    }
    
    // Fallback: Calculate the center of ALL content
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    
    nodes.forEach(node => {
      minX = Math.min(minX, node.x)
      minY = Math.min(minY, node.y)
      maxX = Math.max(maxX, node.x + node.width)
      maxY = Math.max(maxY, node.y + node.height)
    })
    
    const contentCenterX = (minX + maxX) / 2
    const contentCenterY = (minY + maxY) / 2
    
    const dx = contentCenterX - viewportCenterX
    const dy = contentCenterY - viewportCenterY
    const length = Math.sqrt(dx * dx + dy * dy)
    
    if (length > 0) {
      directionToContent.value = {
        x: dx / length,
        y: dy / length
      }
      distanceToContent.value = Math.round(length)
    }
  }
  
  // Center on content bounds with optimal zoom (like center button)
  const centerOnContent = (canvasRef: HTMLElement | null, startFadeOut = true) => {
    
    // Hide indicator immediately when clicked (immediate change for responsive UX)
    setShowIndicatorDebounced(false, true)
    
    // Clear any timeouts
    if (returnTimeout.value) {
      clearTimeout(returnTimeout.value)
      returnTimeout.value = null
    }
    if (stateChangeTimeout.value) {
      clearTimeout(stateChangeTimeout.value)
      stateChangeTimeout.value = null
    }
    
    // Use smooth version of autoFitNodes for consistent centering
    if (autoFitNodes) {
      smoothAutoFitNodes(canvasRef)
    } else {
      // Fallback implementation
      const rect = canvasRef?.getBoundingClientRect()
      if (!rect) return
      
      const nodes = getAllNodes()
      if (nodes.length === 0) return
      
      // Find content bounds
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      
      nodes.forEach(node => {
        minX = Math.min(minX, node.x)
        minY = Math.min(minY, node.y)
        maxX = Math.max(maxX, node.x + node.width)
        maxY = Math.max(maxY, node.y + node.height)
      })
      
      // Calculate content dimensions
      const contentWidth = maxX - minX
      const contentHeight = maxY - minY
      const contentCenterX = (minX + maxX) / 2
      const contentCenterY = (minY + maxY) / 2
      
      // Calculate optimal zoom to fit all content (like center button does)
      const padding = 200 // Same padding as autoFitNodes
      const targetZoom = Math.min(
        (rect.width - padding * 2) / contentWidth,
        (rect.height - padding * 2) / contentHeight,
        1 // Don't zoom in beyond 100%
      )
      
      // Calculate target pan position to center content in viewport
      const targetPanX = rect.width / 2 - contentCenterX * targetZoom
      const targetPanY = rect.height / 2 - contentCenterY * targetZoom
      
      // Animate to target position AND zoom smoothly
      animateToPositionWithZoom(targetPanX, targetPanY, targetZoom, 500)
    }
  }
  
  // Smooth animation function (pan only)
  const animateToPosition = (targetX: number, targetY: number, duration: number = 300) => {
    const startX = panX.value
    const startY = panY.value
    const startTime = performance.now()
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function (ease-out cubic for smooth deceleration)
      const eased = 1 - Math.pow(1 - progress, 3)
      
      // Update pan values
      panX.value = startX + (targetX - startX) * eased
      panY.value = startY + (targetY - startY) * eased
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    requestAnimationFrame(animate)
  }
  
  // Smooth animation function (pan + zoom)
  const animateToPositionWithZoom = (targetX: number, targetY: number, targetZoom: number, duration: number = 500) => {
    const startX = panX.value
    const startY = panY.value
    const startZoom = zoom.value
    const startTime = performance.now()
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function (ease-out cubic for smooth deceleration)
      const eased = 1 - Math.pow(1 - progress, 3)
      
      // Update pan and zoom values simultaneously
      panX.value = startX + (targetX - startX) * eased
      panY.value = startY + (targetY - startY) * eased
      zoom.value = startZoom + (targetZoom - startZoom) * eased
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    requestAnimationFrame(animate)
  }
  
  // Smooth version of autoFitNodes - captures values and animates to them
  const smoothAutoFitNodes = (canvasRef: HTMLElement | null) => {
    // Store current values
    const startZoom = zoom.value
    const startPanX = panX.value
    const startPanY = panY.value
    
    // Call autoFitNodes to calculate target values
    if (autoFitNodes) {
      autoFitNodes()
    }
    
    // Capture the target values that autoFitNodes just set
    const targetZoom = zoom.value
    const targetPanX = panX.value
    const targetPanY = panY.value
    
    // Reset to start values
    zoom.value = startZoom
    panX.value = startPanX
    panY.value = startPanY
    
    // Now animate smoothly to the target values
    animateToPositionWithZoom(targetPanX, targetPanY, targetZoom, 600)
  }
  
  
  // Hide distance indicator (Vue transition handles fade)
  const hideDistanceIndicator = () => {
    if (!showDistanceIndicator.value) return
    
    showDistanceIndicator.value = false
  }
  
  // Check node visibility and distance, trigger return if needed
  const checkNodeVisibility = (canvasRef: HTMLElement | null) => {
    // Don't do anything until user has interacted
    if (!hasInteracted.value) {
      return
    }
    
    const nodesVisible = isAnyNodeVisible(canvasRef)
    updateDistanceIndicator(canvasRef)
    
    const distanceThreshold = 2000 // Show indicator when content is >2000px away
    const isContentFar = distanceToContent.value > distanceThreshold
    
    if (!nodesVisible && isContentFar) {
      // Show distance indicator (no auto pullback) - use debounced change
      setShowIndicatorDebounced(true)
      
      // Clear any existing timeout
      if (returnTimeout.value) {
        clearTimeout(returnTimeout.value)
        returnTimeout.value = null
      }
      
    } else if (nodesVisible || !isContentFar) {
      // Hide distance indicator when nodes are visible or content is close - use debounced change
      setShowIndicatorDebounced(false)
      
      // Clear timeout
      if (returnTimeout.value) {
        clearTimeout(returnTimeout.value)
        returnTimeout.value = null
      }
    }
  }
  
  // Immediate check during interaction (wheel/drag)
  const checkNodeVisibilityImmediate = (canvasRef: HTMLElement | null) => {
    // Mark that user has interacted ONLY if it's a real user interaction (not initialization)
    // We need to be more strict about what counts as interaction
    const rect = canvasRef?.getBoundingClientRect()
    if (!rect) return
    
    // Only mark as interacted if distance calculation shows we're far from nodes
    // This prevents false positives during initialization
    const nodesVisible = isAnyNodeVisible(canvasRef)
    updateDistanceIndicator(canvasRef)
    
    const distanceThreshold = 1000 // Lower threshold for more responsive showing
    const isContentFar = distanceToContent.value > distanceThreshold
    
    // Only mark as interacted if we're actually far from content (real pan/scroll)
    if (isContentFar && !nodesVisible) {
      hasInteracted.value = true
    }
    
    
    // Decision logic - all conditions must be met
    const shouldShowIndicator = !nodesVisible && isContentFar && hasInteracted.value
    
    if (shouldShowIndicator && !showDistanceIndicator.value) {
      // Show indicator - it should fade in
      setShowIndicatorDebounced(true)
      
      // Clear any existing timeout (no auto pullback)
      if (returnTimeout.value) {
        clearTimeout(returnTimeout.value)
        returnTimeout.value = null
      }
      
    } else if (!shouldShowIndicator && showDistanceIndicator.value) {
      // Hide indicator - it should fade out
      setShowIndicatorDebounced(false)  
      
      // Clear timeout
      if (returnTimeout.value) {
        clearTimeout(returnTimeout.value)
        returnTimeout.value = null
      }
    }
  }
  
  // Enhanced viewport bounds calculation for LOD system
  const getViewportBounds = (canvasRef: HTMLElement | null) => {
    const rect = canvasRef?.getBoundingClientRect()
    if (!rect) {
      return null
    }
    
    const currentZoom = zoom.value
    const currentPanX = panX.value
    const currentPanY = panY.value
    
    // Calculate viewport boundaries in world space
    const left = -currentPanX / currentZoom
    const right = (rect.width - currentPanX) / currentZoom
    const top = -currentPanY / currentZoom
    const bottom = (rect.height - currentPanY) / currentZoom
    
    return {
      left,
      right, 
      top,
      bottom,
      width: right - left,
      height: bottom - top,
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2
    }
  }
  
  // Check if a node bounds intersects with viewport (with optional buffer)
  const isNodeInViewport = (nodeBounds: { x: number, y: number, width: number, height: number }, canvasRef: HTMLElement | null, buffer: number = 500) => {
    const viewport = getViewportBounds(canvasRef)
    if (!viewport) return true // Default to visible if can't calculate
    
    const nodeLeft = nodeBounds.x
    const nodeRight = nodeBounds.x + nodeBounds.width  
    const nodeTop = nodeBounds.y
    const nodeBottom = nodeBounds.y + nodeBounds.height
    
    const viewportLeft = viewport.left - buffer
    const viewportRight = viewport.right + buffer
    const viewportTop = viewport.top - buffer
    const viewportBottom = viewport.bottom + buffer
    
    // Check intersection
    return !(nodeRight < viewportLeft || 
             nodeLeft > viewportRight || 
             nodeBottom < viewportTop || 
             nodeTop > viewportBottom)
  }
  
  // Get all nodes that are currently visible in viewport
  const getVisibleNodes = (canvasRef: HTMLElement | null, buffer: number = 500) => {
    const allNodes = getAllNodes()
    return allNodes.filter(node => isNodeInViewport(node, canvasRef, buffer))
  }

  return {
    // State
    showDistanceIndicator,
    isIndicatorFadingOut,
    distanceToContent,
    directionToContent,
    hasInteracted,
    
    // Methods
    isAnyNodeVisible,
    updateDistanceIndicator,
    centerOnContent,
    hideDistanceIndicator,
    checkNodeVisibility,
    checkNodeVisibilityImmediate,
    animateToPositionWithZoom,
    
    // Enhanced viewport methods for LOD system
    getViewportBounds,
    isNodeInViewport,
    getVisibleNodes
  }
}