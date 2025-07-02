import { ref, reactive } from 'vue';
import emitter from '@/utils/eventBus';

// Store message positions for all nodes
const nodeMessagePositions = reactive<Record<string, Record<number, number>>>({});
const nodeButtonPositions = reactive<Record<string, Record<number, { x: number; y: number }>>>({});

// Track when positions need updating
const positionsNeedUpdate = ref(new Set<string>());

export function useMessagePositions() {
  // Initialize listener for position updates
  const initializeListener = () => {
    emitter.on('node-message-positions-updated', ({ nodeId, positions, buttonPositions }) => {
      nodeMessagePositions[nodeId] = positions;
      nodeButtonPositions[nodeId] = buttonPositions;
      positionsNeedUpdate.value.delete(nodeId);
    });
  };

  // Get the vertical offset for a specific message in a node
  const getMessageOffset = (nodeId: string, messageIndex: number): number => {
    const positions = nodeMessagePositions[nodeId];
    if (!positions || positions[messageIndex] === undefined) {
      // Mark this node as needing position update
      positionsNeedUpdate.value.add(nodeId);
      
      // Return estimated position based on message index
      // This is a fallback - actual positions should be calculated by the node
      return 120 + (messageIndex * 100);
    }
    
    return positions[messageIndex];
  };

  // Get the branch button position for a specific message
  const getBranchButtonPosition = (nodeId: string, messageIndex: number): { x: number; y: number } => {
    const buttonPositions = nodeButtonPositions[nodeId];
    if (!buttonPositions || !buttonPositions[messageIndex]) {
      // Mark this node as needing position update
      positionsNeedUpdate.value.add(nodeId);
      
      // Return estimated position
      return { x: 0, y: 120 + (messageIndex * 100) };
    }
    
    return buttonPositions[messageIndex];
  };

  // Request position update for a specific node
  const requestPositionUpdate = (nodeId: string) => {
    positionsNeedUpdate.value.add(nodeId);
    // The BranchNode component should listen for this and update positions
    emitter.emit('request-node-position-update', { nodeId });
  };

  // Clear positions for a node (e.g., when node is deleted)
  const clearNodePositions = (nodeId: string) => {
    delete nodeMessagePositions[nodeId];
    delete nodeButtonPositions[nodeId];
    positionsNeedUpdate.value.delete(nodeId);
  };

  return {
    getMessageOffset,
    getBranchButtonPosition,
    requestPositionUpdate,
    clearNodePositions,
    initializeListener,
    nodeMessagePositions,
    nodeButtonPositions,
    positionsNeedUpdate
  };
}