// src/utils/connectionUtils.ts

import type { 
  PathCoordinates, 
  ConnectionPath, 
  ConnectionType, 
  ConnectionBounds,
  ConnectionViewport 
} from '@/types/connection';

/**
 * Kinopio-style connection path calculation utilities
 * Uses quadratic Bézier curves with simple control points
 */

// Default control points for different connection types
export const DEFAULT_CONTROL_POINTS = {
  curved: { x: 90, y: 40 },
  straight: { x: 0, y: 0 }
} as const;

/**
 * Calculate connection path between two coordinates
 * Format: m{startX},{startY} q{controlX},{controlY} {deltaX},{deltaY}
 */
export const getConnectionPathBetweenCoords = (
  start: PathCoordinates,
  end: PathCoordinates,
  controlPoint: PathCoordinates = DEFAULT_CONTROL_POINTS.curved
): string => {
  // Validate input coordinates
  if (!isFinite(start.x) || !isFinite(start.y) || !isFinite(end.x) || !isFinite(end.y)) {
    console.warn('Invalid coordinates in getConnectionPathBetweenCoords:', { start, end });
    return `m0,0 q0,0 0,0`; // Return minimal valid path
  }
  
  if (!isFinite(controlPoint.x) || !isFinite(controlPoint.y)) {
    console.warn('Invalid control point in getConnectionPathBetweenCoords:', controlPoint);
    controlPoint = DEFAULT_CONTROL_POINTS.curved;
  }
  
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  
  // Ensure delta values are finite
  if (!isFinite(deltaX) || !isFinite(deltaY)) {
    console.warn('Invalid delta values:', { deltaX, deltaY });
    return `m0,0 q0,0 0,0`; // Return minimal valid path
  }
  
  return `m${start.x},${start.y} q${controlPoint.x},${controlPoint.y} ${deltaX},${deltaY}`;
};

/**
 * Extract start coordinates from SVG path
 */
export const startCoordsFromConnectionPath = (path: string): PathCoordinates | null => {
  const match = path.match(/^m([-\d.]+),([-\d.]+)/);
  if (!match) return null;
  
  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2])
  };
};

/**
 * Extract end coordinates from SVG path
 */
export const endCoordsFromConnectionPath = (path: string): PathCoordinates | null => {
  const startCoords = startCoordsFromConnectionPath(path);
  if (!startCoords) return null;
  
  const match = path.match(/q[-\d.,\s]+([-\d.]+),([-\d.]+)$/);
  if (!match) return null;
  
  return {
    x: startCoords.x + parseFloat(match[1]),
    y: startCoords.y + parseFloat(match[2])
  };
};

/**
 * Extract control point from SVG path
 */
export const curveControlPointFromPath = (path: string): PathCoordinates | null => {
  const match = path.match(/q([-\d.]+),([-\d.]+)/);
  if (!match) return null;
  
  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2])
  };
};

/**
 * Calculate bounding rectangle for connection path
 */
export const rectFromConnectionPath = (path: string): ConnectionBounds | null => {
  const startCoords = startCoordsFromConnectionPath(path);
  const endCoords = endCoordsFromConnectionPath(path);
  const controlPoint = curveControlPointFromPath(path);
  
  if (!startCoords || !endCoords || !controlPoint) return null;
  
  // For quadratic Bézier curves, we need to consider the control point
  const controlAbsolute = {
    x: startCoords.x + controlPoint.x,
    y: startCoords.y + controlPoint.y
  };
  
  const allX = [startCoords.x, endCoords.x, controlAbsolute.x];
  const allY = [startCoords.y, endCoords.y, controlAbsolute.y];
  
  return {
    minX: Math.min(...allX),
    minY: Math.min(...allY),
    maxX: Math.max(...allX),
    maxY: Math.max(...allY)
  };
};

/**
 * Update path with new control point (for animations)
 */
export const updatedPath = (
  originalPath: string,
  oldControlPoint: string,
  newX: number,
  newY: number
): string => {
  // Ensure numbers are valid
  if (!isFinite(newX) || !isFinite(newY)) {
    console.warn('Invalid coordinates in updatedPath:', { newX, newY });
    return originalPath;
  }
  
  // Extract the original path parts
  const startMatch = originalPath.match(/^m([-\d.]+),([-\d.]+)/);
  const endMatch = originalPath.match(/q[-\d.,\s]+([-\d.]+),([-\d.]+)$/);
  
  if (!startMatch || !endMatch) {
    console.warn('Invalid path format in updatedPath:', originalPath);
    return originalPath;
  }
  
  const startX = parseFloat(startMatch[1]);
  const startY = parseFloat(startMatch[2]);
  const deltaX = parseFloat(endMatch[1]);
  const deltaY = parseFloat(endMatch[2]);
  
  // Ensure all values are finite
  if (!isFinite(startX) || !isFinite(startY) || !isFinite(deltaX) || !isFinite(deltaY)) {
    console.warn('Invalid path coordinates:', { startX, startY, deltaX, deltaY });
    return originalPath;
  }
  
  // Create new path with proper formatting
  return `m${startX},${startY} q${newX},${newY} ${deltaX},${deltaY}`;
};

/**
 * Calculate connection path for nodes with automatic side detection
 */
export const calculateConnectionPath = (
  startNode: { id: string; x: number; y: number; width: number; height: number },
  endNode: { id: string; x: number; y: number; width: number; height: number },
  connectionType: ConnectionType
): ConnectionPath => {
  // Validate input nodes
  if (!startNode || !endNode) {
    console.warn('Invalid nodes in calculateConnectionPath:', { startNode, endNode });
    return {
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 },
      controlPoint: DEFAULT_CONTROL_POINTS.curved,
      path: 'm0,0 q0,0 0,0'
    };
  }
  
  // Ensure all node properties are valid numbers
  const safeStartNode = {
    x: isFinite(startNode.x) ? startNode.x : 0,
    y: isFinite(startNode.y) ? startNode.y : 0,
    width: isFinite(startNode.width) ? startNode.width : 300,
    height: isFinite(startNode.height) ? startNode.height : 200
  };
  
  const safeEndNode = {
    x: isFinite(endNode.x) ? endNode.x : 0,
    y: isFinite(endNode.y) ? endNode.y : 0,
    width: isFinite(endNode.width) ? endNode.width : 300,
    height: isFinite(endNode.height) ? endNode.height : 200
  };
  
  // Determine which sides to connect based on node positions
  const startCenter = { 
    x: safeStartNode.x + safeStartNode.width / 2, 
    y: safeStartNode.y + safeStartNode.height / 2 
  };
  const endCenter = { 
    x: safeEndNode.x + safeEndNode.width / 2, 
    y: safeEndNode.y + safeEndNode.height / 2 
  };
  
  const isLeftToRight = startCenter.x < endCenter.x;
  
  // Calculate connection points
  let startPoint: PathCoordinates;
  let endPoint: PathCoordinates;
  
  if (isLeftToRight) {
    // Connect from right side of start to left side of end
    startPoint = {
      x: safeStartNode.x + safeStartNode.width,
      y: safeStartNode.y + safeStartNode.height / 2
    };
    endPoint = {
      x: safeEndNode.x,
      y: safeEndNode.y + safeEndNode.height / 2
    };
  } else {
    // Connect from left side of start to right side of end
    startPoint = {
      x: safeStartNode.x,
      y: safeStartNode.y + safeStartNode.height / 2
    };
    endPoint = {
      x: safeEndNode.x + safeEndNode.width,
      y: safeEndNode.y + safeEndNode.height / 2
    };
  }
  
  // Adjust control point based on connection direction
  let controlPoint = connectionType.controlPoint || DEFAULT_CONTROL_POINTS.curved;
  
  if (!isLeftToRight) {
    // Flip control point for right-to-left connections
    controlPoint = { x: -controlPoint.x, y: controlPoint.y };
  }
  
  const path = getConnectionPathBetweenCoords(startPoint, endPoint, controlPoint);
  
  return {
    start: startPoint,
    end: endPoint,
    controlPoint,
    path
  };
};

/**
 * Physics-based animation utilities
 */

// Exponential easing function for organic movement (from Kinopio)
export const newPointPosition = (
  base: number,
  cycleProgress: number,
  isForwardCycle: boolean
): number => {
  if (isForwardCycle) {
    return Math.round(base + Math.exp(cycleProgress / 6));
  } else {
    return Math.round(base - Math.exp(cycleProgress / 6));
  }
};

// Calculate jiggling control point position
export const jigglingControlPointPosition = (
  originalControlPoint: PathCoordinates,
  frameCount: number,
  framesPerDirection: number = 24
): PathCoordinates => {
  const completedCycles = Math.floor(frameCount / framesPerDirection);
  const cycleProgress = (frameCount - completedCycles * framesPerDirection) / framesPerDirection;
  const isForwardCycle = completedCycles % 2 === 0;
  
  const x = newPointPosition(originalControlPoint.x, cycleProgress, isForwardCycle);
  const y = newPointPosition(originalControlPoint.y, cycleProgress, isForwardCycle);
  
  return { x, y };
};

/**
 * Viewport optimization utilities
 */

// Check if connection is visible in viewport
export const isConnectionInViewport = (
  path: string,
  viewport: ConnectionViewport
): boolean => {
  const bounds = rectFromConnectionPath(path);
  if (!bounds) return false;
  
  const viewportBounds = {
    minX: viewport.x,
    minY: viewport.y,
    maxX: viewport.x + viewport.width,
    maxY: viewport.y + viewport.height
  };
  
  // Check if connection bounds intersect with viewport
  return !(
    bounds.maxX < viewportBounds.minX ||
    bounds.minX > viewportBounds.maxX ||
    bounds.maxY < viewportBounds.minY ||
    bounds.minY > viewportBounds.maxY
  );
};

// Calculate distance between two points
export const distanceBetweenPoints = (
  point1: PathCoordinates,
  point2: PathCoordinates
): number => {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// Check if point is near connection path (for click detection)
export const isPointNearPath = (
  point: PathCoordinates,
  path: string,
  threshold: number = 10
): boolean => {
  const startCoords = startCoordsFromConnectionPath(path);
  const endCoords = endCoordsFromConnectionPath(path);
  
  if (!startCoords || !endCoords) return false;
  
  // Simple distance check to connection line
  // For more accurate detection, we could use SVG path point-in-stroke
  const distanceToStart = distanceBetweenPoints(point, startCoords);
  const distanceToEnd = distanceBetweenPoints(point, endCoords);
  const lineLength = distanceBetweenPoints(startCoords, endCoords);
  
  // Check if point is close to the line
  return distanceToStart + distanceToEnd <= lineLength + threshold;
};

/**
 * Generate unique ID for connections
 */
export const generateConnectionId = (startNodeId: string, endNodeId: string): string => {
  return `connection_${startNodeId}_${endNodeId}_${Date.now()}`;
};

/**
 * Validate connection (prevent self-connections, duplicates, etc.)
 */
export const validateConnection = (
  startNodeId: string,
  endNodeId: string,
  existingConnections: { startNodeId: string; endNodeId: string }[]
): { valid: boolean; reason?: string } => {
  // Prevent self-connections
  if (startNodeId === endNodeId) {
    return { valid: false, reason: 'Cannot connect node to itself' };
  }
  
  // Check for duplicate connections
  const duplicate = existingConnections.find(
    conn => 
      (conn.startNodeId === startNodeId && conn.endNodeId === endNodeId) ||
      (conn.startNodeId === endNodeId && conn.endNodeId === startNodeId)
  );
  
  if (duplicate) {
    return { valid: false, reason: 'Connection already exists' };
  }
  
  return { valid: true };
};

/**
 * Reduced motion utilities
 */
export const userPrefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  return query.matches;
};