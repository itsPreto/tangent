// src/stores/connectionStore.ts

import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import type { 
  Connection, 
  ConnectionType, 
  ConnectionCreationState, 
  ConnectionAnimationState,
  ConnectionViewport
} from '@/types/connection';
import { DEFAULT_CONNECTION_TYPES } from '@/types/connection';

export const useConnectionStore = defineStore('connection', () => {
  // Normalized state pattern (following Kinopio's approach)
  const connectionsById = shallowRef<Record<string, Connection>>({});
  const connectionIds = ref<string[]>([]);
  
  const connectionTypesById = shallowRef<Record<string, ConnectionType>>({});
  const connectionTypeIds = ref<string[]>([]);
  
  // Connection creation state
  const creationState = ref<ConnectionCreationState>({
    isDrawing: false,
    startNodeId: null,
    currentPath: null,
    previewPath: null,
    mousePosition: { x: 0, y: 0 },
    targetNodeId: null,
    connectionTypeId: 'default-curved'
  });
  
  // Animation states
  const animationStates = ref<Record<string, ConnectionAnimationState>>({});
  
  // Viewport for optimization
  const viewport = ref<ConnectionViewport>({
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    zoom: 1
  });
  
  // Selection and interaction
  const selectedConnectionIds = ref<string[]>([]);
  const hoveredConnectionId = ref<string | null>(null);
  
  // Computed getters
  const allConnections = computed(() => 
    connectionIds.value.map(id => connectionsById.value[id]).filter(Boolean)
  );
  
  const allConnectionTypes = computed(() => 
    connectionTypeIds.value.map(id => connectionTypesById.value[id]).filter(Boolean)
  );
  
  const visibleConnections = computed(() => 
    allConnections.value.filter(connection => connection.isVisible !== false)
  );
  
  const selectedConnections = computed(() => 
    selectedConnectionIds.value.map(id => connectionsById.value[id]).filter(Boolean)
  );
  
  const connectionsByNodeId = computed(() => {
    const byNodeId: Record<string, Connection[]> = {};
    
    allConnections.value.forEach(connection => {
      // Start node connections
      if (!byNodeId[connection.startNodeId]) {
        byNodeId[connection.startNodeId] = [];
      }
      byNodeId[connection.startNodeId].push(connection);
      
      // End node connections
      if (!byNodeId[connection.endNodeId]) {
        byNodeId[connection.endNodeId] = [];
      }
      byNodeId[connection.endNodeId].push(connection);
    });
    
    return byNodeId;
  });
  
  // Actions
  const initializeDefaultConnectionTypes = () => {
    DEFAULT_CONNECTION_TYPES.forEach(type => {
      connectionTypesById.value[type.id] = type;
      if (!connectionTypeIds.value.includes(type.id)) {
        connectionTypeIds.value.push(type.id);
      }
    });
  };
  
  const addConnection = (connection: Connection) => {
    connectionsById.value[connection.id] = connection;
    if (!connectionIds.value.includes(connection.id)) {
      connectionIds.value.push(connection.id);
    }
  };
  
  const updateConnection = (id: string, updates: Partial<Connection>) => {
    const connection = connectionsById.value[id];
    if (connection) {
      connectionsById.value[id] = { ...connection, ...updates, updatedAt: new Date().toISOString() };
    }
  };
  
  const removeConnection = (id: string) => {
    delete connectionsById.value[id];
    const index = connectionIds.value.indexOf(id);
    if (index > -1) {
      connectionIds.value.splice(index, 1);
    }
    
    // Clean up selection
    const selectionIndex = selectedConnectionIds.value.indexOf(id);
    if (selectionIndex > -1) {
      selectedConnectionIds.value.splice(selectionIndex, 1);
    }
    
    // Clean up hover
    if (hoveredConnectionId.value === id) {
      hoveredConnectionId.value = null;
    }
    
    // Clean up animation state
    delete animationStates.value[id];
  };
  
  const addConnectionType = (type: ConnectionType) => {
    connectionTypesById.value[type.id] = type;
    if (!connectionTypeIds.value.includes(type.id)) {
      connectionTypeIds.value.push(type.id);
    }
  };
  
  const updateConnectionType = (id: string, updates: Partial<ConnectionType>) => {
    const type = connectionTypesById.value[id];
    if (type) {
      connectionTypesById.value[id] = { ...type, ...updates };
    }
  };
  
  const removeConnectionType = (id: string) => {
    delete connectionTypesById.value[id];
    const index = connectionTypeIds.value.indexOf(id);
    if (index > -1) {
      connectionTypeIds.value.splice(index, 1);
    }
  };
  
  // Selection management
  const selectConnection = (id: string) => {
    if (!selectedConnectionIds.value.includes(id)) {
      selectedConnectionIds.value.push(id);
    }
  };
  
  const deselectConnection = (id: string) => {
    const index = selectedConnectionIds.value.indexOf(id);
    if (index > -1) {
      selectedConnectionIds.value.splice(index, 1);
    }
  };
  
  const clearSelection = () => {
    selectedConnectionIds.value = [];
  };
  
  const toggleConnectionSelection = (id: string) => {
    if (selectedConnectionIds.value.includes(id)) {
      deselectConnection(id);
    } else {
      selectConnection(id);
    }
  };
  
  // Hover management
  const setHoveredConnection = (id: string | null) => {
    hoveredConnectionId.value = id;
  };
  
  // Creation workflow
  const startConnectionCreation = (startNodeId: string, typeId: string = 'default-curved') => {
    creationState.value = {
      isDrawing: true,
      startNodeId,
      currentPath: null,
      previewPath: null,
      mousePosition: { x: 0, y: 0 },
      targetNodeId: null,
      connectionTypeId: typeId
    };
  };
  
  const updateConnectionCreation = (updates: Partial<ConnectionCreationState>) => {
    creationState.value = { ...creationState.value, ...updates };
  };
  
  const finishConnectionCreation = (connection: Connection) => {
    addConnection(connection);
    creationState.value = {
      isDrawing: false,
      startNodeId: null,
      currentPath: null,
      previewPath: null,
      mousePosition: { x: 0, y: 0 },
      targetNodeId: null,
      connectionTypeId: 'default-curved'
    };
  };
  
  const cancelConnectionCreation = () => {
    creationState.value = {
      isDrawing: false,
      startNodeId: null,
      currentPath: null,
      previewPath: null,
      mousePosition: { x: 0, y: 0 },
      targetNodeId: null,
      connectionTypeId: 'default-curved'
    };
  };
  
  // Animation management
  const startJigglingAnimation = (connectionId: string) => {
    const connection = connectionsById.value[connectionId];
    if (connection) {
      animationStates.value[connectionId] = {
        isJiggling: true,
        frameCount: 0,
        originalPath: connection.path || null,
        animatedPath: null
      };
    }
  };
  
  const stopJigglingAnimation = (connectionId: string) => {
    const animationState = animationStates.value[connectionId];
    if (animationState) {
      delete animationStates.value[connectionId];
      
      // Restore original path
      if (animationState.originalPath) {
        updateConnection(connectionId, { path: animationState.originalPath });
      }
    }
  };
  
  const updateAnimationFrame = (connectionId: string, frameCount: number, animatedPath: string) => {
    const animationState = animationStates.value[connectionId];
    if (animationState) {
      animationStates.value[connectionId] = {
        ...animationState,
        frameCount,
        animatedPath
      };
    }
  };
  
  // Viewport management
  const updateViewport = (newViewport: Partial<ConnectionViewport>) => {
    viewport.value = { ...viewport.value, ...newViewport };
  };
  
  // Bulk operations
  const removeConnectionsByNodeId = (nodeId: string) => {
    const connectionsToRemove = allConnections.value.filter(
      connection => connection.startNodeId === nodeId || connection.endNodeId === nodeId
    );
    
    connectionsToRemove.forEach(connection => {
      removeConnection(connection.id);
    });
  };
  
  const updateConnectionPaths = (pathUpdates: { id: string; path: string }[]) => {
    pathUpdates.forEach(({ id, path }) => {
      updateConnection(id, { path });
    });
  };
  
  // Utility functions
  const getConnectionById = (id: string) => connectionsById.value[id];
  const getConnectionTypeById = (id: string) => connectionTypesById.value[id];
  const getConnectionsForNode = (nodeId: string) => connectionsByNodeId.value[nodeId] || [];
  
  // Initialize store
  try {
    initializeDefaultConnectionTypes();
  } catch (error) {
    console.error('Error initializing connection types:', error);
  }
  
  return {
    // State
    connectionsById,
    connectionIds,
    connectionTypesById,
    connectionTypeIds,
    creationState,
    animationStates,
    viewport,
    selectedConnectionIds,
    hoveredConnectionId,
    
    // Computed
    allConnections,
    allConnectionTypes,
    visibleConnections,
    selectedConnections,
    connectionsByNodeId,
    
    // Actions
    addConnection,
    updateConnection,
    removeConnection,
    addConnectionType,
    updateConnectionType,
    removeConnectionType,
    selectConnection,
    deselectConnection,
    clearSelection,
    toggleConnectionSelection,
    setHoveredConnection,
    startConnectionCreation,
    updateConnectionCreation,
    finishConnectionCreation,
    cancelConnectionCreation,
    startJigglingAnimation,
    stopJigglingAnimation,
    updateAnimationFrame,
    updateViewport,
    removeConnectionsByNodeId,
    updateConnectionPaths,
    
    // Utilities
    getConnectionById,
    getConnectionTypeById,
    getConnectionsForNode
  };
});