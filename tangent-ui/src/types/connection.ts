// src/types/connection.ts

export interface ConnectionType {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
  curveType: 'straight' | 'curved';
  controlPoint?: { x: number; y: number };
}

export interface Connection {
  id: string;
  startNodeId: string;
  endNodeId: string;
  typeId: string;
  label?: string;
  path?: string; // SVG path string, calculated dynamically
  isSelected?: boolean;
  isHovered?: boolean;
  isVisible?: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface ConnectionPoint {
  nodeId: string;
  side: 'left' | 'right' | 'top' | 'bottom';
  offset: number; // Offset from the side (0-1 normalized)
}

export interface ConnectionCreationState {
  isDrawing: boolean;
  startNodeId: string | null;
  currentPath: string | null;
  previewPath: string | null;
  mousePosition: { x: number; y: number };
  targetNodeId: string | null;
  connectionTypeId: string;
}

export interface ConnectionAnimationState {
  isJiggling: boolean;
  frameCount: number;
  originalPath: string | null;
  animatedPath: string | null;
}

// Connection path calculation types
export interface PathCoordinates {
  x: number;
  y: number;
}

export interface ConnectionPath {
  start: PathCoordinates;
  end: PathCoordinates;
  controlPoint: PathCoordinates;
  path: string; // SVG path string
}

// Default connection types
export const DEFAULT_CONNECTION_TYPES: ConnectionType[] = [
  {
    id: 'default-curved',
    name: 'Curved',
    color: '#6b7280',
    isDefault: true,
    curveType: 'curved',
    controlPoint: { x: 90, y: 40 }
  },
  {
    id: 'default-straight',
    name: 'Straight',
    color: '#6b7280',
    curveType: 'straight',
    controlPoint: { x: 0, y: 0 }
  }
];

// Connection viewport optimization
export interface ConnectionViewport {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export interface ConnectionBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}