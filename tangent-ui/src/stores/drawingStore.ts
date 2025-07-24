import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface DrawingShape {
  id: string;
  type: 'rectangle' | 'circle' | 'diamond' | 'arrow' | 'line' | 'pen' | 'text' | 'image' | 'fill';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: { x: number; y: number }[];
  text?: string;
  imageUrl?: string;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  rotation: number;
  isSelected: boolean;
  isLocked: boolean;
  zIndex: number;
  // For fill areas - stores the filled region as a path
  fillPath?: string;
}

export interface DrawingState {
  shapes: DrawingShape[];
  currentTool: string;
  isDrawing: boolean;
  currentShape: DrawingShape | null;
  selectedShapeIds: string[];
  clipboard: DrawingShape[];
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  isGridVisible: boolean;
  isSnapToGrid: boolean;
  gridSize: number;
  canvasScale: number;
  canvasOffset: { x: number; y: number };
  history: DrawingShape[][];
  historyIndex: number;
}

export const useDrawingStore = defineStore('drawing', () => {
  // State
  const shapes = ref<DrawingShape[]>([]);
  const currentTool = ref<string>('cursor');
  const isDrawing = ref<boolean>(false);
  const currentShape = ref<DrawingShape | null>(null);
  const selectedShapeIds = ref<string[]>([]);
  const clipboard = ref<DrawingShape[]>([]);
  
  // Drawing properties
  const strokeColor = ref<string>('#000000');
  const fillColor = ref<string>('transparent');
  const strokeWidth = ref<number>(2);
  const opacity = ref<number>(1);
  
  // Grid and snap settings
  const isGridVisible = ref<boolean>(false);
  const isSnapToGrid = ref<boolean>(false);
  const gridSize = ref<number>(20);
  
  // Canvas transform
  const canvasScale = ref<number>(1);
  const canvasOffset = ref<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // History for undo/redo
  const history = ref<DrawingShape[][]>([[]]);
  const historyIndex = ref<number>(0);
  
  // Computed properties
  const selectedShapes = computed(() => {
    return shapes.value.filter(shape => selectedShapeIds.value.includes(shape.id));
  });
  
  const hasSelection = computed(() => selectedShapeIds.value.length > 0);

  const selectionBounds = computed(() => {
    if (selectedShapeIds.value.length === 0) return null;
    
    const selectedShapes = shapes.value.filter(shape => selectedShapeIds.value.includes(shape.id));
    if (selectedShapes.length === 0) return null;
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    selectedShapes.forEach(shape => {
      let shapeMinX = shape.x;
      let shapeMinY = shape.y;
      let shapeMaxX = shape.x;
      let shapeMaxY = shape.y;
      
      if (shape.type === 'circle') {
        const radius = shape.radius || 0;
        shapeMinX = shape.x - radius;
        shapeMinY = shape.y - radius;
        shapeMaxX = shape.x + radius;
        shapeMaxY = shape.y + radius;
      } else if (shape.type === 'rectangle' || shape.type === 'diamond' || shape.type === 'text' || shape.type === 'image') {
        shapeMaxX = shape.x + (shape.width || 0);
        shapeMaxY = shape.y + (shape.height || 0);
      } else if (shape.type === 'line' || shape.type === 'arrow') {
        shapeMaxX = shape.x + (shape.width || 0);
        shapeMaxY = shape.y + (shape.height || 0);
        if (shape.width && shape.width < 0) {
          shapeMinX = shape.x + shape.width;
          shapeMaxX = shape.x;
        }
        if (shape.height && shape.height < 0) {
          shapeMinY = shape.y + shape.height;
          shapeMaxY = shape.y;
        }
      } else if (shape.type === 'pen' && shape.points) {
        const xs = shape.points.map(p => p.x);
        const ys = shape.points.map(p => p.y);
        shapeMinX = Math.min(...xs);
        shapeMinY = Math.min(...ys);
        shapeMaxX = Math.max(...xs);
        shapeMaxY = Math.max(...ys);
      } else if (shape.type === 'fill') {
        // For fill shapes, use a simple bounding box around the click point
        // This is a simplified approach - in practice, you might want to parse the fillPath
        shapeMinX = shape.x - 50;
        shapeMinY = shape.y - 50;
        shapeMaxX = shape.x + 50;
        shapeMaxY = shape.y + 50;
      }
      
      minX = Math.min(minX, shapeMinX);
      minY = Math.min(minY, shapeMinY);
      maxX = Math.max(maxX, shapeMaxX);
      maxY = Math.max(maxY, shapeMaxY);
    });
    
    return {
      x: minX - 10, // Add padding
      y: minY - 10,
      width: maxX - minX + 20,
      height: maxY - minY + 20
    };
  });
  
  const canUndo = computed(() => {
    return historyIndex.value > 0;
  });
  
  const canRedo = computed(() => {
    return historyIndex.value < history.value.length - 1;
  });
  
  // Actions
  const saveToHistory = () => {
    // Remove any future history if we're not at the end
    if (historyIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, historyIndex.value + 1);
    }
    
    // Add current state to history
    history.value.push(JSON.parse(JSON.stringify(shapes.value)));
    historyIndex.value = history.value.length - 1;
    
    // Limit history size to prevent memory issues
    if (history.value.length > 50) {
      history.value = history.value.slice(-50);
      historyIndex.value = history.value.length - 1;
    }
  };
  
  const undo = () => {
    if (canUndo.value) {
      historyIndex.value--;
      shapes.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]));
      clearSelection();
    }
  };
  
  const redo = () => {
    if (canRedo.value) {
      historyIndex.value++;
      shapes.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]));
      clearSelection();
    }
  };

  const setCurrentTool = (tool: string) => {
    currentTool.value = tool;
    
    // Clear selection when switching tools (except for cursor)
    if (tool !== 'cursor') {
      clearSelection();
    }
  };
  
  const startDrawing = (x: number, y: number) => {
    if (currentTool.value === 'cursor' || currentTool.value === 'hand') {
      return;
    }
    
    isDrawing.value = true;
    
    const newShape: DrawingShape = {
      id: `shape-${Date.now()}-${Math.random()}`,
      type: currentTool.value as DrawingShape['type'],
      x,
      y,
      width: 0,
      height: 0,
      strokeColor: strokeColor.value,
      fillColor: fillColor.value,
      strokeWidth: strokeWidth.value,
      opacity: opacity.value,
      rotation: 0,
      isSelected: false,
      isLocked: false,
      zIndex: shapes.value.length
    };
    
    // Initialize shape-specific properties
    if (newShape.type === 'circle') {
      newShape.radius = 0;
    } else if (newShape.type === 'pen') {
      newShape.points = [{ x, y }];
    } else if (newShape.type === 'text') {
      newShape.text = 'Text';
      newShape.width = 50;
      newShape.height = 20;
    }
    
    currentShape.value = newShape;
  };
  
  const updateDrawing = (x: number, y: number) => {
    if (!isDrawing.value || !currentShape.value) return;
    
    const shape = currentShape.value;
    
    switch (shape.type) {
      case 'rectangle':
      case 'diamond':
      case 'text':
      case 'image':
        shape.width = Math.abs(x - shape.x);
        shape.height = Math.abs(y - shape.y);
        if (x < shape.x) shape.x = x;
        if (y < shape.y) shape.y = y;
        break;
        
      case 'circle':
        const radius = Math.sqrt(Math.pow(x - shape.x, 2) + Math.pow(y - shape.y, 2));
        shape.radius = radius;
        break;
        
      case 'line':
      case 'arrow':
        shape.width = x - shape.x;
        shape.height = y - shape.y;
        break;
        
      case 'pen':
        if (shape.points) {
          shape.points.push({ x, y });
        }
        break;
    }
  };
  
  const finishDrawing = () => {
    if (!isDrawing.value || !currentShape.value) return;
    
    // Only add shape if it has meaningful dimensions
    const shape = currentShape.value;
    let shouldAdd = false;
    
    if (shape.type === 'pen') {
      shouldAdd = (shape.points?.length || 0) > 1;
    } else if (shape.type === 'circle') {
      shouldAdd = (shape.radius || 0) > 5;
    } else if (shape.type === 'text') {
      shouldAdd = true; // Text shapes are always added
    } else {
      shouldAdd = (shape.width || 0) > 5 || (shape.height || 0) > 5;
    }
    
    if (shouldAdd) {
      shapes.value.push({ ...shape });
      saveToHistory();
    }
    
    isDrawing.value = false;
    currentShape.value = null;
  };
  
  const selectShape = (shapeId: string, addToSelection = false) => {
    if (addToSelection) {
      if (selectedShapeIds.value.includes(shapeId)) {
        selectedShapeIds.value = selectedShapeIds.value.filter(id => id !== shapeId);
      } else {
        selectedShapeIds.value.push(shapeId);
      }
    } else {
      selectedShapeIds.value = [shapeId];
    }
    
    // Update shape selection state
    shapes.value.forEach(shape => {
      shape.isSelected = selectedShapeIds.value.includes(shape.id);
    });
  };
  
  const clearSelection = () => {
    selectedShapeIds.value = [];
    shapes.value.forEach(shape => {
      shape.isSelected = false;
    });
  };

  const selectAllShapes = () => {
    selectedShapeIds.value = shapes.value.map(shape => shape.id);
    shapes.value.forEach(shape => {
      shape.isSelected = true;
    });
  };
  
  const deleteSelected = () => {
    if (selectedShapeIds.value.length === 0) return;
    
    shapes.value = shapes.value.filter(shape => !selectedShapeIds.value.includes(shape.id));
    selectedShapeIds.value = [];
    saveToHistory();
  };

  const deleteShape = (shapeId: string) => {
    const shapeIndex = shapes.value.findIndex(shape => shape.id === shapeId);
    if (shapeIndex !== -1) {
      shapes.value.splice(shapeIndex, 1);
      // Also remove from selection if it was selected
      selectedShapeIds.value = selectedShapeIds.value.filter(id => id !== shapeId);
      saveToHistory();
    }
  };
  
  const copySelected = () => {
    clipboard.value = selectedShapes.value.map(shape => ({ ...shape }));
  };
  
  const pasteShapes = (offsetX = 20, offsetY = 20) => {
    if (clipboard.value.length === 0) return;
    
    const newShapes = clipboard.value.map(shape => ({
      ...shape,
      id: `shape-${Date.now()}-${Math.random()}`,
      x: shape.x + offsetX,
      y: shape.y + offsetY,
      isSelected: true,
      zIndex: shapes.value.length
    }));
    
    shapes.value.push(...newShapes);
    selectedShapeIds.value = newShapes.map(shape => shape.id);
    saveToHistory();
  };
  
  const moveSelected = (deltaX: number, deltaY: number) => {
    selectedShapes.value.forEach(shape => {
      shape.x += deltaX;
      shape.y += deltaY;
    });
  };
  
  const duplicateSelected = () => {
    copySelected();
    pasteShapes();
  };
  
  const bringToFront = (shapeId: string) => {
    const shape = shapes.value.find(s => s.id === shapeId);
    if (shape) {
      shape.zIndex = Math.max(...shapes.value.map(s => s.zIndex)) + 1;
    }
  };
  
  const sendToBack = (shapeId: string) => {
    const shape = shapes.value.find(s => s.id === shapeId);
    if (shape) {
      shape.zIndex = Math.min(...shapes.value.map(s => s.zIndex)) - 1;
    }
  };
  
  const toggleGrid = () => {
    isGridVisible.value = !isGridVisible.value;
  };
  
  const toggleSnapToGrid = () => {
    isSnapToGrid.value = !isSnapToGrid.value;
  };
  
  const snapToGrid = (x: number, y: number) => {
    if (!isSnapToGrid.value) return { x, y };
    
    return {
      x: Math.round(x / gridSize.value) * gridSize.value,
      y: Math.round(y / gridSize.value) * gridSize.value
    };
  };
  
  const clearCanvas = () => {
    shapes.value = [];
    selectedShapeIds.value = [];
    currentShape.value = null;
    isDrawing.value = false;
  };
  
  const setCanvasTransform = (scale: number, offset: { x: number; y: number }) => {
    canvasScale.value = scale;
    canvasOffset.value = offset;
  };
  
  const exportShapes = () => {
    return JSON.stringify(shapes.value, null, 2);
  };
  
  const importShapes = (jsonData: string) => {
    try {
      const importedShapes = JSON.parse(jsonData);
      shapes.value = importedShapes;
      clearSelection();
    } catch (error) {
      console.error('Failed to import shapes:', error);
    }
  };

  // Shape property editing functions
  const updateSelectedShapeProperties = (properties: Partial<DrawingShape>) => {
    selectedShapes.value.forEach(shape => {
      Object.assign(shape, properties);
    });
    saveToHistory();
  };

  const updateShapeProperty = (shapeId: string, property: keyof DrawingShape, value: any) => {
    const shape = shapes.value.find(s => s.id === shapeId);
    if (shape) {
      (shape as any)[property] = value;
      saveToHistory();
    }
  };

  const updateSelectedStrokeColor = (color: string) => {
    selectedShapes.value.forEach(shape => {
      shape.strokeColor = color;
    });
    saveToHistory();
  };

  const updateSelectedFillColor = (color: string) => {
    selectedShapes.value.forEach(shape => {
      if (['rectangle', 'circle', 'diamond', 'fill'].includes(shape.type)) {
        shape.fillColor = color;
      }
    });
    saveToHistory();
  };

  const updateSelectedStrokeWidth = (width: number) => {
    selectedShapes.value.forEach(shape => {
      shape.strokeWidth = width;
    });
    saveToHistory();
  };

  const updateSelectedOpacity = (opacity: number) => {
    selectedShapes.value.forEach(shape => {
      shape.opacity = opacity;
    });
    saveToHistory();
  };

  const updateShapePosition = (shapeId: string, x: number, y: number) => {
    const shape = shapes.value.find(s => s.id === shapeId);
    if (shape) {
      shape.x = x;
      shape.y = y;
      saveToHistory();
    }
  };

  const updateShapeSize = (shapeId: string, width?: number, height?: number, radius?: number) => {
    const shape = shapes.value.find(s => s.id === shapeId);
    if (shape) {
      if (width !== undefined) shape.width = width;
      if (height !== undefined) shape.height = height;
      if (radius !== undefined && shape.type === 'circle') shape.radius = radius;
      saveToHistory();
    }
  };

  const lockShape = (shapeId: string) => {
    const shape = shapes.value.find(s => s.id === shapeId);
    if (shape) {
      shape.isLocked = true;
    }
  };

  const unlockShape = (shapeId: string) => {
    const shape = shapes.value.find(s => s.id === shapeId);
    if (shape) {
      shape.isLocked = false;
    }
  };

  const toggleLockSelected = () => {
    const hasLockedShapes = selectedShapes.value.some(shape => shape.isLocked);
    selectedShapes.value.forEach(shape => {
      shape.isLocked = !hasLockedShapes;
    });
    saveToHistory();
  };

  // Enhanced fill function using polygon detection
  const performFloodFill = (clickX: number, clickY: number, canvasElement: HTMLCanvasElement) => {
    console.log('Flood fill clicked at:', clickX, clickY);
    console.log('Available shapes:', shapes.value.length);
    
    // Look for pen shapes that might form closed polygons
    const penShapes = shapes.value.filter(shape => shape.type === 'pen' && shape.points && shape.points.length > 2);
    
    console.log('Found pen shapes:', penShapes.length);
    
    if (penShapes.length === 0) {
      console.log('No pen shapes found');
      return false;
    }
    
    // For each pen shape, check if it forms a closed area containing the click point
    for (const shape of penShapes) {
      if (!shape.points || shape.points.length < 3) continue;
      
      // Check if the pen shape is approximately closed (first and last points are close)
      const firstPoint = shape.points[0];
      const lastPoint = shape.points[shape.points.length - 1];
      const isClosedShape = Math.sqrt(
        Math.pow(firstPoint.x - lastPoint.x, 2) + Math.pow(firstPoint.y - lastPoint.y, 2)
      ) < 100; // Within 100 pixels is considered "closed" - more lenient for hand-drawn shapes
      
      console.log('Shape closed check:', isClosedShape, 'Distance:', Math.sqrt(
        Math.pow(firstPoint.x - lastPoint.x, 2) + Math.pow(firstPoint.y - lastPoint.y, 2)
      ));
      
      if (isClosedShape) {
        // Check if click point is inside this polygon using ray casting
        const isInside = isPointInPolygon(clickX, clickY, shape.points);
        console.log('Point inside polygon:', isInside);
        
        if (isInside) {
          // Create a filled polygon using the shape's points
          const pathData = createPolygonPath(shape.points);
          
          const fillShape: DrawingShape = {
            id: `fill-${Date.now()}-${Math.random()}`,
            type: 'fill',
            x: clickX,
            y: clickY,
            strokeColor: 'transparent',
            fillColor: fillColor.value,
            strokeWidth: 0,
            opacity: opacity.value,
            rotation: 0,
            isSelected: false,
            isLocked: false,
            zIndex: shapes.value.length,
            fillPath: pathData
          };

          shapes.value.push(fillShape);
          saveToHistory();
          console.log('Created polygon fill shape');
          return true;
        }
      }
    }
    
    // Fallback: create a small circular fill if click is near any pen shape
    const nearbyShapes = penShapes.filter(shape => {
      if (shape.points) {
        return shape.points.some(point => {
          const distance = Math.sqrt(Math.pow(point.x - clickX, 2) + Math.pow(point.y - clickY, 2));
          return distance < 100;
        });
      }
      return false;
    });
    
    if (nearbyShapes.length > 0) {
      const radius = 30;
      const fillPath = `M ${clickX - radius} ${clickY} A ${radius} ${radius} 0 1 1 ${clickX + radius} ${clickY} A ${radius} ${radius} 0 1 1 ${clickX - radius} ${clickY} Z`;
      
      const fillShape: DrawingShape = {
        id: `fill-${Date.now()}-${Math.random()}`,
        type: 'fill',
        x: clickX,
        y: clickY,
        strokeColor: 'transparent',
        fillColor: fillColor.value,
        strokeWidth: 0,
        opacity: opacity.value,
        rotation: 0,
        isSelected: false,
        isLocked: false,
        zIndex: shapes.value.length,
        fillPath: fillPath
      };

      shapes.value.push(fillShape);
      saveToHistory();
      console.log('Created fallback circular fill');
      return true;
    }
    
    // If no single closed shape found, try combining nearby pen strokes
    console.log('No single closed shape found, trying to combine nearby strokes...');
    
    // Create a virtual canvas to render all pen strokes and detect enclosed areas
    const virtualCanvas = document.createElement('canvas');
    virtualCanvas.width = canvasElement.width || 2000;
    virtualCanvas.height = canvasElement.height || 2000;
    const ctx = virtualCanvas.getContext('2d');
    
    if (ctx) {
      // Draw all pen strokes with thick lines to help connect gaps
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 5; // Thicker lines to bridge small gaps
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      penShapes.forEach(shape => {
        if (!shape.points || shape.points.length < 2) return;
        
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        
        ctx.stroke();
      });
      
      // Check if the click point is in an enclosed area using flood fill
      const imageData = ctx.getImageData(0, 0, virtualCanvas.width, virtualCanvas.height);
      const clickIndex = (Math.floor(clickY) * virtualCanvas.width + Math.floor(clickX)) * 4;
      
      // If clicking on a line, no fill
      if (imageData.data[clickIndex + 3] > 0) {
        console.log('Clicked on a line, cannot fill');
        return false;
      }
      
      // Perform flood fill to find enclosed area
      const filledPixels = floodFillArea(Math.floor(clickX), Math.floor(clickY), imageData, virtualCanvas.width, virtualCanvas.height);
      
      if (filledPixels.length > 50 && filledPixels.length < 500000) { // Reasonable area size
        // Create a path from the filled area
        const pathData = createPathFromPixels(filledPixels);
        
        const fillShape: DrawingShape = {
          id: `fill-${Date.now()}-${Math.random()}`,
          type: 'fill',
          x: clickX,
          y: clickY,
          strokeColor: 'transparent',
          fillColor: fillColor.value,
          strokeWidth: 0,
          opacity: opacity.value,
          rotation: 0,
          isSelected: false,
          isLocked: false,
          zIndex: shapes.value.length,
          fillPath: pathData
        };
        
        shapes.value.push(fillShape);
        saveToHistory();
        console.log('Created fill shape from combined strokes');
        return true;
      }
    }
    
    console.log('No suitable area found for filling');
    return false;
  };
  
  // Helper function to perform flood fill and return filled pixels
  const floodFillArea = (startX: number, startY: number, imageData: ImageData, width: number, height: number): { x: number; y: number }[] => {
    const pixels = imageData.data;
    const filledPixels: { x: number; y: number }[] = [];
    const visited = new Set<string>();
    const stack: [number, number][] = [[startX, startY]];
    
    while (stack.length > 0 && filledPixels.length < 500000) { // Prevent hanging on large areas
      const [x, y] = stack.pop()!;
      const key = `${x},${y}`;
      
      if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }
      
      visited.add(key);
      
      const index = (y * width + x) * 4;
      if (pixels[index + 3] > 0) { // Hit a boundary
        continue;
      }
      
      filledPixels.push({ x, y });
      
      // Add 4-connected neighbors
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    return filledPixels;
  };

  // Point-in-polygon test using ray casting algorithm
  const isPointInPolygon = (x: number, y: number, polygon: { x: number; y: number }[]): boolean => {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  };

  // Create SVG path from polygon points
  const createPolygonPath = (points: { x: number; y: number }[]): string => {
    if (points.length < 2) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    path += ' Z'; // Close the path
    
    return path;
  };

  // Helper function to create SVG path from filled pixels using marching squares
  const createPathFromPixels = (pixels: { x: number; y: number }[]): string => {
    if (pixels.length === 0) return '';

    // Convert pixels to a 2D grid for boundary tracing
    const bounds = {
      minX: Math.min(...pixels.map(p => p.x)),
      maxX: Math.max(...pixels.map(p => p.x)),
      minY: Math.min(...pixels.map(p => p.y)),
      maxY: Math.max(...pixels.map(p => p.y))
    };

    const width = bounds.maxX - bounds.minX + 1;
    const height = bounds.maxY - bounds.minY + 1;
    
    // Create a binary grid
    const grid = Array(height + 2).fill(null).map(() => Array(width + 2).fill(false));
    
    // Mark filled pixels in the grid (add 1 pixel border)
    pixels.forEach(p => {
      const x = p.x - bounds.minX + 1;
      const y = p.y - bounds.minY + 1;
      if (x >= 0 && x < width + 2 && y >= 0 && y < height + 2) {
        grid[y][x] = true;
      }
    });

    // Simple boundary tracing to create a polygon outline
    const contourPoints: { x: number; y: number }[] = [];
    
    // Find the topmost, leftmost filled pixel
    let startX = -1, startY = -1;
    outerLoop: for (let y = 0; y < height + 2; y++) {
      for (let x = 0; x < width + 2; x++) {
        if (grid[y][x]) {
          startX = x;
          startY = y;
          break outerLoop;
        }
      }
    }
    
    if (startX === -1) {
      // Fallback to simple rectangle
      return `M ${bounds.minX} ${bounds.minY} L ${bounds.maxX} ${bounds.minY} L ${bounds.maxX} ${bounds.maxY} L ${bounds.minX} ${bounds.maxY} Z`;
    }

    // Moore neighborhood boundary following
    const directions = [
      {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
      {dx: 1, dy: 0}, {dx: 1, dy: 1}, {dx: 0, dy: 1},
      {dx: -1, dy: 1}, {dx: -1, dy: 0}
    ];

    let currentX = startX;
    let currentY = startY;
    let direction = 7; // Start looking in the left direction
    let firstMove = true;

    do {
      // Add current point to contour (convert back to original coordinates)
      contourPoints.push({
        x: currentX - 1 + bounds.minX,
        y: currentY - 1 + bounds.minY
      });

      // Find next boundary pixel
      let found = false;
      for (let i = 0; i < 8; i++) {
        const checkDir = (direction + i) % 8;
        const nextX = currentX + directions[checkDir].dx;
        const nextY = currentY + directions[checkDir].dy;

        if (nextX >= 0 && nextX < width + 2 && nextY >= 0 && nextY < height + 2 && grid[nextY][nextX]) {
          currentX = nextX;
          currentY = nextY;
          direction = (checkDir + 6) % 8; // Update direction
          found = true;
          break;
        }
      }

      if (!found) break;
      
      // Prevent infinite loops
      if (contourPoints.length > pixels.length * 2) break;
      
      firstMove = false;
    } while (firstMove || currentX !== startX || currentY !== startY);

    // Create SVG path from contour points
    if (contourPoints.length < 3) {
      // Fallback to rectangle
      return `M ${bounds.minX} ${bounds.minY} L ${bounds.maxX} ${bounds.minY} L ${bounds.maxX} ${bounds.maxY} L ${bounds.minX} ${bounds.maxY} Z`;
    }

    let path = `M ${contourPoints[0].x} ${contourPoints[0].y}`;
    for (let i = 1; i < contourPoints.length; i++) {
      path += ` L ${contourPoints[i].x} ${contourPoints[i].y}`;
    }
    path += ' Z';

    return path;
  };
  
  return {
    // State
    shapes,
    currentTool,
    isDrawing,
    currentShape,
    selectedShapeIds,
    clipboard,
    strokeColor,
    fillColor,
    strokeWidth,
    opacity,
    isGridVisible,
    isSnapToGrid,
    gridSize,
    canvasScale,
    canvasOffset,
    
    // Computed
    selectedShapes,
    hasSelection,
    selectionBounds,
    canUndo,
    canRedo,
    
    // Actions
    setCurrentTool,
    startDrawing,
    updateDrawing,
    finishDrawing,
    selectShape,
    clearSelection,
    selectAllShapes,
    deleteSelected,
    deleteShape,
    undo,
    redo,
    saveToHistory,
    copySelected,
    pasteShapes,
    moveSelected,
    duplicateSelected,
    bringToFront,
    sendToBack,
    toggleGrid,
    toggleSnapToGrid,
    snapToGrid,
    clearCanvas,
    setCanvasTransform,
    exportShapes,
    importShapes,
    updateSelectedShapeProperties,
    updateShapeProperty,
    updateSelectedStrokeColor,
    updateSelectedFillColor,
    updateSelectedStrokeWidth,
    updateSelectedOpacity,
    updateShapePosition,
    updateShapeSize,
    lockShape,
    unlockShape,
    toggleLockSelected,
    performFloodFill
  };
});