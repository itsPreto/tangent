/**
 * Optimized drag handling service for buttery smooth performance
 * Batches updates, uses RAF throttling, and implements dirty rectangle tracking
 */

import type { Node } from '@/types/message';
import { spatialIndex } from './spatialIndexService';
import { performanceMode } from './performanceMode';
import { domOptimizer } from './domOptimizationService';

interface DragState {
  isDragging: boolean;
  draggedNodes: Map<string, { startX: number; startY: number; currentX: number; currentY: number }>;
  rafId: number | null;
  dirtyRect: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

class DragOptimizationService {
  private state: DragState = {
    isDragging: false,
    draggedNodes: new Map(),
    rafId: null,
    dirtyRect: null
  };
  
  private pendingUpdates: Map<string, { x: number; y: number }> = new Map();
  private updateCallback: ((nodeId: string, position: { x: number; y: number }) => void) | null = null;
  
  /**
   * Start dragging nodes - cache their initial positions
   */
  startDrag(nodes: Array<{ id: string; x: number; y: number }>): void {
    this.state.isDragging = true;
    this.state.draggedNodes.clear();
    
    // Enter performance mode for maximum smoothness
    performanceMode.enterPerformanceMode('node-drag');
    
    // Start DOM optimization to defer expensive DOM operations
    domOptimizer.startOptimization();
    
    nodes.forEach(node => {
      this.state.draggedNodes.set(node.id, {
        startX: node.x,
        startY: node.y,
        currentX: node.x,
        currentY: node.y
      });
    });
    
    // Initialize dirty rect
    this.resetDirtyRect();
  }
  
  /**
   * Update node positions during drag - batched with RAF
   * This is called on every mouse move but only updates once per frame
   */
  updateDrag(updates: Array<{ id: string; x: number; y: number }>): void {
    if (!this.state.isDragging) return;
    
    // Queue updates
    updates.forEach(update => {
      this.pendingUpdates.set(update.id, { x: update.x, y: update.y });
      
      // Update dirty rectangle
      this.expandDirtyRect(update.x, update.y);
      
      // Update current position in drag state
      const dragState = this.state.draggedNodes.get(update.id);
      if (dragState) {
        this.expandDirtyRect(dragState.currentX, dragState.currentY);
        dragState.currentX = update.x;
        dragState.currentY = update.y;
      }
    });
    
    // Schedule RAF update if not already scheduled
    if (this.state.rafId === null) {
      this.state.rafId = requestAnimationFrame(() => {
        this.flushUpdates();
        this.state.rafId = null;
      });
    }
  }
  
  /**
   * End drag and commit final positions
   */
  endDrag(finalUpdateCallback?: (nodeId: string, position: { x: number; y: number }) => Promise<void>): void {
    if (!this.state.isDragging) return;
    
    // Cancel any pending RAF
    if (this.state.rafId !== null) {
      cancelAnimationFrame(this.state.rafId);
      this.state.rafId = null;
    }
    
    // Flush any remaining updates
    this.flushUpdates();
    
    // Commit final positions to store and spatial index
    this.state.draggedNodes.forEach((dragState, nodeId) => {
      if (finalUpdateCallback) {
        finalUpdateCallback(nodeId, { x: dragState.currentX, y: dragState.currentY });
      }
      // Update spatial index only once at the end
      spatialIndex.updateNodePosition(nodeId, dragState.currentX, dragState.currentY);
    });
    
    // Exit performance mode
    performanceMode.exitPerformanceMode('node-drag');
    
    // End DOM optimization and process deferred operations
    domOptimizer.endOptimization();
    
    // Reset state
    this.state.isDragging = false;
    this.state.draggedNodes.clear();
    this.pendingUpdates.clear();
    this.resetDirtyRect();
  }
  
  /**
   * Set the callback for immediate visual updates during drag
   */
  setUpdateCallback(callback: (nodeId: string, position: { x: number; y: number }) => void): void {
    this.updateCallback = callback;
  }
  
  /**
   * Get the current dirty rectangle for optimized rendering
   */
  getDirtyRect(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    return this.state.dirtyRect;
  }
  
  /**
   * Check if currently dragging
   */
  isDragging(): boolean {
    return this.state.isDragging;
  }
  
  // Private methods
  
  private flushUpdates(): void {
    if (this.pendingUpdates.size === 0) return;
    
    // Apply updates to visual representation only (not to store)
    this.pendingUpdates.forEach((position, nodeId) => {
      if (this.updateCallback) {
        this.updateCallback(nodeId, position);
      }
    });
    
    this.pendingUpdates.clear();
  }
  
  private resetDirtyRect(): void {
    this.state.dirtyRect = null;
  }
  
  private expandDirtyRect(x: number, y: number): void {
    if (!this.state.dirtyRect) {
      this.state.dirtyRect = {
        minX: x - 200, // Add padding for node size
        minY: y - 150,
        maxX: x + 200,
        maxY: y + 150
      };
    } else {
      this.state.dirtyRect.minX = Math.min(this.state.dirtyRect.minX, x - 200);
      this.state.dirtyRect.minY = Math.min(this.state.dirtyRect.minY, y - 150);
      this.state.dirtyRect.maxX = Math.max(this.state.dirtyRect.maxX, x + 200);
      this.state.dirtyRect.maxY = Math.max(this.state.dirtyRect.maxY, y + 150);
    }
  }
  
  /**
   * Cancel any ongoing drag operation
   */
  cancelDrag(): void {
    if (this.state.rafId !== null) {
      cancelAnimationFrame(this.state.rafId);
      this.state.rafId = null;
    }
    
    // Reset nodes to their original positions
    this.state.draggedNodes.forEach((dragState, nodeId) => {
      if (this.updateCallback) {
        this.updateCallback(nodeId, { x: dragState.startX, y: dragState.startY });
      }
    });
    
    // Exit performance mode and DOM optimization
    if (this.state.isDragging) {
      performanceMode.exitPerformanceMode('node-drag-cancel');
      domOptimizer.endOptimization();
    }
    
    // Reset state
    this.state.isDragging = false;
    this.state.draggedNodes.clear();
    this.pendingUpdates.clear();
    this.resetDirtyRect();
  }
}

// Export singleton instance
export const dragOptimizer = new DragOptimizationService();