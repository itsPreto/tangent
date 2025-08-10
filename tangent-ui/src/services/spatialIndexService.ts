/**
 * High-performance spatial indexing service using Quadtree
 * Enables O(log n) viewport queries instead of O(n) linear searches
 * Critical for handling 100k+ nodes at 60fps
 */

import type { Node } from '@/types/message';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface QuadNode {
  bounds: Bounds;
  nodes: Node[];
  children: QuadNode[] | null;
}

export class QuadTree {
  private root: QuadNode;
  private maxDepth: number;
  private maxNodesPerQuad: number;
  private nodeMap: Map<string, Node>;
  private dirtyNodes: Set<string>;
  private updateThrottleId: number | null = null;

  constructor(bounds: Bounds, maxDepth = 8, maxNodesPerQuad = 10) {
    this.root = {
      bounds,
      nodes: [],
      children: null
    };
    this.maxDepth = maxDepth;
    this.maxNodesPerQuad = maxNodesPerQuad;
    this.nodeMap = new Map();
    this.dirtyNodes = new Set();
  }

  /**
   * Insert a node into the quadtree
   * O(log n) operation
   */
  insert(node: Node): void {
    this.nodeMap.set(node.id, node);
    this._insertNode(this.root, node, 0);
  }

  /**
   * Batch insert for initial load
   * More efficient than individual inserts
   */
  batchInsert(nodes: Node[]): void {
    nodes.forEach(node => {
      this.nodeMap.set(node.id, node);
    });
    this._rebuildTree();
  }

  /**
   * Update node position (for dragging)
   * Marks node as dirty and schedules batch update
   */
  updateNode(nodeId: string, x: number, y: number): void {
    const node = this.nodeMap.get(nodeId);
    if (!node) return;
    
    node.x = x;
    node.y = y;
    this.dirtyNodes.add(nodeId);
    
    // Throttle rebuilds to avoid excessive recalculation during drag
    if (this.updateThrottleId === null) {
      this.updateThrottleId = window.setTimeout(() => {
        this._processDirtyNodes();
        this.updateThrottleId = null;
      }, 16); // One frame at 60fps
    }
  }

  /**
   * Query nodes within viewport bounds
   * O(log n) operation - the key to performance!
   */
  query(bounds: Bounds, buffer = 500): Node[] {
    const expandedBounds = {
      x: bounds.x - buffer,
      y: bounds.y - buffer,
      width: bounds.width + buffer * 2,
      height: bounds.height + buffer * 2
    };
    
    const results: Node[] = [];
    this._queryNodes(this.root, expandedBounds, results);
    return results;
  }

  /**
   * Get nearest nodes to a point (for focus/snap operations)
   * Much faster than checking all nodes
   */
  getNearestNodes(x: number, y: number, count = 5): Node[] {
    const nodes = Array.from(this.nodeMap.values());
    
    // For small node counts, just sort
    if (nodes.length <= 100) {
      return nodes
        .map(node => ({
          node,
          distance: Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, count)
        .map(item => item.node);
    }
    
    // For large counts, use spatial query then sort
    const searchRadius = 1000;
    const nearby = this.query({
      x: x - searchRadius,
      y: y - searchRadius,
      width: searchRadius * 2,
      height: searchRadius * 2
    }, 0);
    
    return nearby
      .map(node => ({
        node,
        distance: Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, count)
      .map(item => item.node);
  }

  /**
   * Clear the entire tree
   */
  clear(): void {
    this.root.nodes = [];
    this.root.children = null;
    this.nodeMap.clear();
    this.dirtyNodes.clear();
  }

  /**
   * Get total node count
   */
  size(): number {
    return this.nodeMap.size;
  }

  // Private methods

  private _insertNode(quad: QuadNode, node: Node, depth: number): void {
    // Check if node is within quad bounds
    if (!this._intersects(quad.bounds, { 
      x: node.x, 
      y: node.y, 
      width: 200, // Approximate node width
      height: 150  // Approximate node height
    })) {
      return;
    }

    // If we haven't subdivided and we're under capacity or at max depth
    if (!quad.children && (quad.nodes.length < this.maxNodesPerQuad || depth >= this.maxDepth)) {
      quad.nodes.push(node);
      return;
    }

    // Need to subdivide
    if (!quad.children && depth < this.maxDepth) {
      this._subdivide(quad);
      
      // Move existing nodes to children
      const existingNodes = quad.nodes;
      quad.nodes = [];
      existingNodes.forEach(n => {
        quad.children!.forEach(child => {
          this._insertNode(child, n, depth + 1);
        });
      });
    }

    // Insert into children
    if (quad.children) {
      quad.children.forEach(child => {
        this._insertNode(child, node, depth + 1);
      });
    }
  }

  private _subdivide(quad: QuadNode): void {
    const { x, y, width, height } = quad.bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    quad.children = [
      // Top-left
      {
        bounds: { x, y, width: halfWidth, height: halfHeight },
        nodes: [],
        children: null
      },
      // Top-right
      {
        bounds: { x: x + halfWidth, y, width: halfWidth, height: halfHeight },
        nodes: [],
        children: null
      },
      // Bottom-left
      {
        bounds: { x, y: y + halfHeight, width: halfWidth, height: halfHeight },
        nodes: [],
        children: null
      },
      // Bottom-right
      {
        bounds: { x: x + halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight },
        nodes: [],
        children: null
      }
    ];
  }

  private _queryNodes(quad: QuadNode, bounds: Bounds, results: Node[]): void {
    if (!this._intersects(quad.bounds, bounds)) {
      return;
    }

    // Add nodes from this quad
    for (const node of quad.nodes) {
      if (this._nodeInBounds(node, bounds)) {
        results.push(node);
      }
    }

    // Recursively query children
    if (quad.children) {
      quad.children.forEach(child => {
        this._queryNodes(child, bounds, results);
      });
    }
  }

  private _intersects(a: Bounds, b: Bounds): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    );
  }

  private _nodeInBounds(node: Node, bounds: Bounds): boolean {
    return (
      node.x >= bounds.x &&
      node.x <= bounds.x + bounds.width &&
      node.y >= bounds.y &&
      node.y <= bounds.y + bounds.height
    );
  }

  private _processDirtyNodes(): void {
    if (this.dirtyNodes.size === 0) return;
    
    // For small updates, just remove and re-insert
    if (this.dirtyNodes.size < 10) {
      this.dirtyNodes.forEach(nodeId => {
        const node = this.nodeMap.get(nodeId);
        if (node) {
          this._removeFromTree(this.root, node);
          this._insertNode(this.root, node, 0);
        }
      });
    } else {
      // For large updates, rebuild the tree
      this._rebuildTree();
    }
    
    this.dirtyNodes.clear();
  }

  private _removeFromTree(quad: QuadNode, node: Node): boolean {
    const index = quad.nodes.indexOf(node);
    if (index !== -1) {
      quad.nodes.splice(index, 1);
      return true;
    }

    if (quad.children) {
      for (const child of quad.children) {
        if (this._removeFromTree(child, node)) {
          return true;
        }
      }
    }

    return false;
  }

  private _rebuildTree(): void {
    const nodes = Array.from(this.nodeMap.values());
    this.root.nodes = [];
    this.root.children = null;
    
    nodes.forEach(node => {
      this._insertNode(this.root, node, 0);
    });
  }
}

/**
 * Singleton spatial index manager
 */
class SpatialIndexManager {
  private quadTree: QuadTree;
  private initialized = false;

  constructor() {
    // Initialize with canvas bounds
    this.quadTree = new QuadTree({
      x: -50000,
      y: -50000,
      width: 100000,
      height: 100000
    });
  }

  /**
   * Initialize with nodes from store
   */
  init(nodes: Node[]): void {
    if (nodes.length > 0) {
      this.quadTree.batchInsert(nodes);
      this.initialized = true;
    }
  }

  /**
   * Add a new node
   */
  addNode(node: Node): void {
    this.quadTree.insert(node);
  }

  /**
   * Update node position (optimized for dragging)
   */
  updateNodePosition(nodeId: string, x: number, y: number): void {
    this.quadTree.updateNode(nodeId, x, y);
  }

  /**
   * Query visible nodes for viewport
   * This is THE KEY OPTIMIZATION - O(log n) instead of O(n)!
   */
  getVisibleNodes(viewport: Bounds, buffer = 500): Node[] {
    if (!this.initialized) return [];
    return this.quadTree.query(viewport, buffer);
  }

  /**
   * Get nearest nodes for snap/focus
   */
  getNearestNodes(x: number, y: number, count = 5): Node[] {
    return this.quadTree.getNearestNodes(x, y, count);
  }

  /**
   * Clear all nodes
   */
  clear(): void {
    this.quadTree.clear();
    this.initialized = false;
  }

  /**
   * Rebuild index (call after bulk updates)
   */
  rebuild(nodes: Node[]): void {
    this.quadTree.clear();
    if (nodes.length > 0) {
      this.quadTree.batchInsert(nodes);
      this.initialized = true;
    }
  }

  /**
   * Get stats for debugging
   */
  getStats(): { totalNodes: number; initialized: boolean } {
    return {
      totalNodes: this.quadTree.size(),
      initialized: this.initialized
    };
  }
}

// Export singleton instance
export const spatialIndex = new SpatialIndexManager();