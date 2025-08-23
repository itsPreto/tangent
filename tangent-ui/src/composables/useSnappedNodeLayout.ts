import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/appStore'

export interface LayoutDimensions {
  containerWidth: string
  containerHeight: string
  sidebarWidth: string
  sidebarHeight: string
  nodeMarginLeft: string
  nodeWidth: string
  shouldStackSidebars: boolean
  layoutMode: 'dual-sidebar' | 'stacked-left' | 'minimal'
}

export function useSnappedNodeLayout() {
  const appStore = useAppStore()
  const windowWidth = ref(window.innerWidth)
  const windowHeight = ref(window.innerHeight)

  // Layout breakpoints for different configurations
  const LAYOUT_BREAKPOINTS = {
    // Below this width, force stacked layout even without right content panel
    FORCE_STACK: 1100,
    // Below this width, use minimal layout (no sidebars or very compact)
    MINIMAL: 800,
    // Optimal width for dual sidebar experience
    DUAL_SIDEBAR_OPTIMAL: 1500,
    // Sidebar widths - increased for better visibility
    SIDEBAR_WIDTH_VW: 15,
    SIDEBAR_WIDTH_PX: 320,  // Increased from 240px
    // Minimum sidebar width before stacking (prevents too much shrinking)
    SIDEBAR_MIN_WIDTH_PX: 280  // Increased from 200px
  }

  const updateWindowDimensions = () => {
    windowWidth.value = window.innerWidth
    windowHeight.value = window.innerHeight
  }

  onMounted(() => {
    window.addEventListener('resize', updateWindowDimensions)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateWindowDimensions)
  })

  // Calculate available width considering right content panel and dev tools
  const availableWidth = computed(() => {
    let available = windowWidth.value
    
    // Account for right content panel (35vw when open)
    if (appStore.isRightContentPanelOpen) {
      available = available * 0.65 // 65% of viewport when right panel takes 35%
    }
    
    return available
  })

  // Determine optimal layout strategy based on available width
  const layoutStrategy = computed((): LayoutDimensions['layoutMode'] => {
    const available = availableWidth.value
    
    if (available < LAYOUT_BREAKPOINTS.MINIMAL) {
      return 'minimal'
    } else if (available < LAYOUT_BREAKPOINTS.FORCE_STACK || appStore.isRightContentPanelOpen) {
      return 'stacked-left'
    } else {
      return 'dual-sidebar'
    }
  })

  // Calculate responsive dimensions based on layout strategy
  const layoutDimensions = computed((): LayoutDimensions => {
    const strategy = layoutStrategy.value
    const available = availableWidth.value
    const height = windowHeight.value

    switch (strategy) {
      case 'minimal':
        return {
          containerWidth: '100vw',
          containerHeight: `${height}px`,
          sidebarWidth: '0px',
          sidebarHeight: '0px',
          nodeMarginLeft: '0px',
          nodeWidth: '100vw',
          shouldStackSidebars: false,
          layoutMode: 'minimal'
        }

      case 'stacked-left':
        const stackedSidebarWidth = Math.min(
          LAYOUT_BREAKPOINTS.SIDEBAR_WIDTH_PX, 
          available * 0.20 // Increased to 20% of available width
        )
        const nodeWidthStacked = appStore.isRightContentPanelOpen 
          ? '40vw' // Reduced from 45vw
          : `calc(100vw - ${stackedSidebarWidth}px - 60px)` // Account for margins

        return {
          containerWidth: appStore.isRightContentPanelOpen ? '65vw' : '100vw',
          containerHeight: `${height}px`,
          sidebarWidth: `${stackedSidebarWidth}px`,
          sidebarHeight: '45%', // Stack vertically, each takes 45%
          nodeMarginLeft: appStore.isRightContentPanelOpen ? '10vw' : `${stackedSidebarWidth + 20}px`,
          nodeWidth: nodeWidthStacked,
          shouldStackSidebars: true,
          layoutMode: 'stacked-left'
        }

      case 'dual-sidebar':
      default:
        // Calculate responsive sidebar width but respect minimum
        const calculatedSidebarWidth = Math.max(
          LAYOUT_BREAKPOINTS.SIDEBAR_MIN_WIDTH_PX,
          Math.min(
            LAYOUT_BREAKPOINTS.SIDEBAR_WIDTH_PX,
            available * 0.20 // Increased to 20% of available width
          )
        )
        
        return {
          containerWidth: '100vw',
          containerHeight: `${height}px`,
          sidebarWidth: `${calculatedSidebarWidth}px`,
          sidebarHeight: `${height - 40}px`,
          nodeMarginLeft: `${calculatedSidebarWidth + 30}px`,  // Increased margin
          nodeWidth: `calc(100vw - ${calculatedSidebarWidth * 2 + 100}px)`, // More space for sidebars
          shouldStackSidebars: false,
          layoutMode: 'dual-sidebar'
        }
    }
  })

  // Responsive sidebar positioning for left sidebar
  const leftSidebarStyle = computed(() => {
    const layout = layoutDimensions.value
    
    if (layout.layoutMode === 'minimal') {
      return { display: 'none' }
    }

    const baseStyle = {
      position: 'fixed' as const,
      width: layout.sidebarWidth,
      height: layout.sidebarHeight,
      left: '20px',
      zIndex: 40
    }

    if (layout.shouldStackSidebars) {
      return {
        ...baseStyle,
        top: '20px',
        bottom: 'auto'
      }
    }

    return {
      ...baseStyle,
      top: '20px'
    }
  })

  // Responsive sidebar positioning for right sidebar
  const rightSidebarStyle = computed(() => {
    const layout = layoutDimensions.value
    
    if (layout.layoutMode === 'minimal') {
      return { display: 'none' }
    }

    const baseStyle = {
      position: 'fixed' as const,
      width: layout.sidebarWidth,
      height: layout.sidebarHeight,
      zIndex: 40
    }

    if (layout.shouldStackSidebars) {
      return {
        ...baseStyle,
        left: '20px',
        right: 'auto',
        bottom: '20px',
        top: 'auto'
      }
    }

    return {
      ...baseStyle,
      right: '20px',
      top: '20px'
    }
  })

  // Responsive node container style
  const nodeContainerStyle = computed(() => {
    const layout = layoutDimensions.value

    return {
      position: 'fixed' as const,
      left: '0px',
      top: '0px',
      width: layout.containerWidth,
      height: layout.containerHeight,
      zIndex: 1000
    }
  })

  // Responsive node card style
  const nodeCardStyle = computed(() => {
    const layout = layoutDimensions.value

    return {
      marginLeft: layout.nodeMarginLeft,
      marginRight: layout.layoutMode === 'dual-sidebar' ? '260px' : '0px', // Right sidebar space
      width: layout.nodeWidth
    }
  })

  // Debug info for development
  const debugInfo = computed(() => ({
    windowWidth: windowWidth.value,
    availableWidth: availableWidth.value,
    layoutStrategy: layoutStrategy.value,
    isRightContentPanelOpen: appStore.isRightContentPanelOpen,
    dimensions: layoutDimensions.value
  }))

  return {
    layoutDimensions,
    layoutStrategy,
    leftSidebarStyle,
    rightSidebarStyle,
    nodeContainerStyle,
    nodeCardStyle,
    availableWidth,
    debugInfo
  }
}