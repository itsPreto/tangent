import { ref, reactive, computed } from 'vue'
import type { Component } from 'vue'

interface FloatingWidget {
  id: string
  component: Component
  props: Record<string, any>
  isVisible: boolean
  autoHide: boolean
  autoHideDelay: number
  zIndex: number
}

interface WidgetOptions {
  autoHide?: boolean
  autoHideDelay?: number
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  x?: number
  y?: number
  zIndex?: number
}

class FloatingWidgetManager {
  private widgets = reactive<Map<string, FloatingWidget>>(new Map())
  private nextZIndex = 1000

  // Get all visible widgets
  getVisibleWidgets = computed(() => {
    return Array.from(this.widgets.values())
      .filter(widget => widget.isVisible)
      .sort((a, b) => a.zIndex - b.zIndex)
  })

  // Show a progress widget
  showProgress(
    id: string, 
    progress: number, 
    label?: string, 
    options: WidgetOptions = {}
  ) {
    this.showWidget(id, {
      type: 'progress',
      progress,
      label,
      position: options.position || 'center',
      x: options.x,
      y: options.y,
      isVisible: true,
      autoHide: options.autoHide ?? false,
      autoHideDelay: options.autoHideDelay || 3000
    }, options)
  }

  // Show a tool status widget
  showToolStatus(
    id: string,
    toolName: string,
    description: string,
    status: 'pending' | 'success' | 'error',
    options: WidgetOptions = {}
  ) {
    this.showWidget(id, {
      type: 'tool-status',
      toolName,
      description,
      status,
      position: options.position || 'bottom-right',
      x: options.x,
      y: options.y,
      isVisible: true,
      autoHide: options.autoHide ?? true,
      autoHideDelay: options.autoHideDelay || 3000
    }, options)
  }

  // Show a notification widget
  showNotification(
    id: string,
    title: string,
    message: string,
    level: 'info' | 'success' | 'warning' | 'error' = 'info',
    options: WidgetOptions = {}
  ) {
    this.showWidget(id, {
      type: 'notification',
      title,
      message,
      notificationLevel: level,
      position: options.position || 'top-right',
      x: options.x,
      y: options.y,
      isVisible: true,
      isInteractive: true,
      autoHide: options.autoHide ?? true,
      autoHideDelay: options.autoHideDelay || 5000
    }, options)
  }

  // Show a custom widget
  showCustom(
    id: string,
    props: Record<string, any>,
    options: WidgetOptions = {}
  ) {
    this.showWidget(id, {
      type: 'custom',
      ...props,
      position: options.position || 'center',
      x: options.x,
      y: options.y,
      isVisible: true,
      autoHide: options.autoHide ?? false,
      autoHideDelay: options.autoHideDelay || 3000
    }, options)
  }

  // Generic show widget method
  private showWidget(id: string, props: Record<string, any>, options: WidgetOptions = {}) {
    // Close existing widget with same ID
    this.hideWidget(id)

    // Create new widget
    const widget: FloatingWidget = {
      id,
      component: () => import('../components/canvas/node/FloatingWidget.vue'),
      props: {
        ...props,
        onClose: () => this.hideWidget(id),
        onMouseEnter: () => this.handleWidgetMouseEnter(id),
        onMouseLeave: () => this.handleWidgetMouseLeave(id)
      },
      isVisible: true,
      autoHide: options.autoHide ?? props.autoHide ?? true,
      autoHideDelay: options.autoHideDelay ?? props.autoHideDelay ?? 3000,
      zIndex: options.zIndex ?? this.nextZIndex++
    }

    this.widgets.set(id, widget)

    // Auto hide if enabled
    if (widget.autoHide) {
      setTimeout(() => {
        this.hideWidget(id)
      }, widget.autoHideDelay)
    }
  }

  // Hide a specific widget
  hideWidget(id: string) {
    const widget = this.widgets.get(id)
    if (widget) {
      widget.isVisible = false
      // Remove after animation
      setTimeout(() => {
        this.widgets.delete(id)
      }, 300)
    }
  }

  // Hide all widgets
  hideAllWidgets() {
    for (const id of this.widgets.keys()) {
      this.hideWidget(id)
    }
  }

  // Update widget progress
  updateProgress(id: string, progress: number, label?: string) {
    const widget = this.widgets.get(id)
    if (widget && widget.props.type === 'progress') {
      widget.props.progress = progress
      if (label) {
        widget.props.label = label
      }
    }
  }

  // Update tool status
  updateToolStatus(id: string, status: 'pending' | 'success' | 'error') {
    const widget = this.widgets.get(id)
    if (widget && widget.props.type === 'tool-status') {
      widget.props.status = status
    }
  }

  // Check if a widget exists and is visible
  isWidgetVisible(id: string): boolean {
    const widget = this.widgets.get(id)
    return widget ? widget.isVisible : false
  }

  // Handle widget mouse events
  private handleWidgetMouseEnter(id: string) {
    console.log('Widget mouse enter:', id)
  }

  private handleWidgetMouseLeave(id: string) {
    console.log('Widget mouse leave:', id)
  }

  // Get widget count
  getWidgetCount = computed(() => this.widgets.size)

  // Clear all widgets (for cleanup)
  clear() {
    this.widgets.clear()
  }
}

// Create singleton instance
const widgetManager = new FloatingWidgetManager()

// Composable hook
export function useFloatingWidgets() {
  return {
    // Widget management
    showProgress: widgetManager.showProgress.bind(widgetManager),
    showToolStatus: widgetManager.showToolStatus.bind(widgetManager),
    showNotification: widgetManager.showNotification.bind(widgetManager),
    showCustom: widgetManager.showCustom.bind(widgetManager),
    hideWidget: widgetManager.hideWidget.bind(widgetManager),
    hideAllWidgets: widgetManager.hideAllWidgets.bind(widgetManager),
    
    // Widget updates
    updateProgress: widgetManager.updateProgress.bind(widgetManager),
    updateToolStatus: widgetManager.updateToolStatus.bind(widgetManager),
    
    // Widget queries
    isWidgetVisible: widgetManager.isWidgetVisible.bind(widgetManager),
    getVisibleWidgets: widgetManager.getVisibleWidgets,
    getWidgetCount: widgetManager.getWidgetCount,
    
    // Cleanup
    clear: widgetManager.clear.bind(widgetManager)
  }
}

// Export the manager for advanced usage
export { widgetManager }

// Quick helper functions for common use cases
export const showQuickNotification = (
  message: string, 
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
) => {
  const id = `notification_${Date.now()}`
  widgetManager.showNotification(id, type.charAt(0).toUpperCase() + type.slice(1), message, type)
}

export const showToolActivity = (
  nodeId: string,
  toolName: string, 
  description: string
) => {
  const id = `tool_${nodeId}_${toolName}_${Date.now()}`
  widgetManager.showToolStatus(id, toolName, description, 'pending', {
    position: 'bottom-right',
    autoHide: false
  })
  return id
}

export const completeToolActivity = (
  id: string, 
  success: boolean = true
) => {
  widgetManager.updateToolStatus(id, success ? 'success' : 'error')
  // Auto hide after showing result
  setTimeout(() => {
    widgetManager.hideWidget(id)
  }, 2000)
}