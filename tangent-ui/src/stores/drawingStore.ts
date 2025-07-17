import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface DrawingShape {
  id: string;
  type: 'rectangle' | 'circle' | 'diamond' | 'arrow' | 'line' | 'pen' | 'text' | 'image';
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
  
  // Computed properties
  const selectedShapes = computed(() => {
    return shapes.value.filter(shape => selectedShapeIds.value.includes(shape.id));
  });
  
  const hasSelection = computed(() => selectedShapeIds.value.length > 0);
  
  const canUndo = computed(() => {
    // TODO: Implement undo/redo history
    return false;
  });
  
  const canRedo = computed(() => {
    // TODO: Implement undo/redo history
    return false;
  });
  
  // Actions
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
    } else {
      shouldAdd = (shape.width || 0) > 5 || (shape.height || 0) > 5;
    }
    
    if (shouldAdd) {
      shapes.value.push({ ...shape });
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
  
  const deleteSelected = () => {
    if (selectedShapeIds.value.length === 0) return;
    
    shapes.value = shapes.value.filter(shape => !selectedShapeIds.value.includes(shape.id));
    selectedShapeIds.value = [];
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
    canUndo,
    canRedo,
    
    // Actions
    setCurrentTool,
    startDrawing,
    updateDrawing,
    finishDrawing,
    selectShape,
    clearSelection,
    deleteSelected,
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
    importShapes
  };
});