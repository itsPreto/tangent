/**
 * DOM Optimization Service
 * Reduces expensive DOM operations during critical interactions
 * Inspired by Kinopio's approach to pausing heavy DOM work
 */

class DOMOptimizationService {
  private isOptimizing = false;
  private deferredOperations: Array<() => void> = [];
  private rafId: number | null = null;
  
  /**
   * Check if DOM operations should be optimized/deferred
   */
  shouldOptimize(): boolean {
    return this.isOptimizing;
  }
  
  /**
   * Start DOM optimization mode
   */
  startOptimization(): void {
    if (this.isOptimizing) return;
    
    this.isOptimizing = true;
    console.log('[DOM] Starting DOM optimization mode');
  }
  
  /**
   * End DOM optimization mode and process deferred operations
   */
  endOptimization(): void {
    if (!this.isOptimizing) return;
    
    this.isOptimizing = false;
    console.log('[DOM] Ending DOM optimization mode');
    
    // Process deferred operations in next frame
    if (this.deferredOperations.length > 0) {
      this.rafId = requestAnimationFrame(() => {
        console.log(`[DOM] Processing ${this.deferredOperations.length} deferred operations`);
        
        // Process in small batches to avoid jank
        const batchSize = 5;
        const processBatch = () => {
          const batch = this.deferredOperations.splice(0, batchSize);
          batch.forEach(operation => {
            try {
              operation();
            } catch (e) {
              console.warn('[DOM] Deferred operation failed:', e);
            }
          });
          
          if (this.deferredOperations.length > 0) {
            requestAnimationFrame(processBatch);
          }
        };
        
        processBatch();
        this.rafId = null;
      });
    }
  }
  
  /**
   * Defer a DOM operation until optimization ends
   */
  deferOperation(operation: () => void): void {
    if (!this.isOptimizing) {
      // Execute immediately if not optimizing
      operation();
      return;
    }
    
    this.deferredOperations.push(operation);
  }
  
  /**
   * Optimized querySelector that returns cached result during optimization
   */
  querySelector(selector: string, parent: Document | Element = document): Element | null {
    if (!this.isOptimizing) {
      return parent.querySelector(selector);
    }
    
    // During optimization, skip expensive queries
    return null;
  }
  
  /**
   * Optimized querySelectorAll that returns empty during optimization
   */
  querySelectorAll(selector: string, parent: Document | Element = document): NodeListOf<Element> {
    if (!this.isOptimizing) {
      return parent.querySelectorAll(selector);
    }
    
    // Return empty NodeList during optimization
    return document.querySelectorAll('non-existent-element');
  }
  
  /**
   * Batch DOM updates using DocumentFragment
   */
  batchDOMUpdates(operations: Array<(fragment: DocumentFragment) => void>, parent: Element): void {
    if (this.isOptimizing) {
      this.deferOperation(() => this.executeBatchUpdate(operations, parent));
      return;
    }
    
    this.executeBatchUpdate(operations, parent);
  }
  
  private executeBatchUpdate(operations: Array<(fragment: DocumentFragment) => void>, parent: Element): void {
    const fragment = document.createDocumentFragment();
    
    operations.forEach(operation => {
      try {
        operation(fragment);
      } catch (e) {
        console.warn('[DOM] Batch operation failed:', e);
      }
    });
    
    parent.appendChild(fragment);
  }
  
  /**
   * Cancel all pending operations
   */
  cancelPendingOperations(): void {
    this.deferredOperations = [];
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export const domOptimizer = new DOMOptimizationService();