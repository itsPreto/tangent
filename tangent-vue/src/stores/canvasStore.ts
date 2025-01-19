import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Message } from '../types/message';

export const useCanvasStore = defineStore('canvas', () => {
  // Main state
  const nodes = ref([{ 
    id: '1', 
    x: 100, 
    y: 100, 
    text: 'Root Node',
    parentId: null,
    messages: [],
    title: 'Root Thread',
    type: 'main',
    branchMessageIndex: null // Add this to track where branches start
  }]);
  
  const activeNode = ref(null);
  const isDragging = ref(false);
  const dragOffset = ref({ x: 0, y: 0 });
  const viewMode = ref('2d');
  const isTransitioning = ref(false);

  // Constants
  const CARD_WIDTH = 672;
  const CARD_HEIGHT = 80;
  const HORIZONTAL_SPACING = 100;

  // Topic clustering state
  const topicClusters = ref(new Map());
  const nodeTopics = ref(new Map());

  // Computed properties for 3D view
  const graphData = computed(() => {
    const clusters = Array.from(topicClusters.value.entries()).map(([topicId, nodeSet]) => ({
      id: `cluster-${topicId}`,
      type: 'cluster',
      nodes: Array.from(nodeSet),
      size: nodeSet.size
    }));

    const graphNodes = nodes.value.map(node => ({
      id: node.id,
      title: node.title || 'Untitled Thread',
      clusterId: nodeTopics.value.get(node.id),
      messageCount: node.messages?.length || 0,
      lastActive: node.messages?.[node.messages.length - 1]?.timestamp,
      branchPoint: node.branchMessageIndex
    }));

    const links = connections.value.map(conn => ({
      source: conn.parent.id,
      target: conn.child.id,
      branchPoint: nodes.value.find(n => n.id === conn.child.id)?.branchMessageIndex
    }));

    return {
      nodes: [...graphNodes, ...clusters],
      links
    };
  });

  // Connections computed property
  const connections = computed(() => {
    return nodes.value
      .filter(node => node.parentId)
      .map(node => {
        const parent = nodes.value.find(n => n.id === node.parentId);
        return { parent, child: node };
      });
  });



  const removeMessage = (nodeId: string, messageIndex: number) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (node && node.messages) {
      // Create a new array without the message at messageIndex
      node.messages = [
        ...node.messages.slice(0, messageIndex),
        ...node.messages.slice(messageIndex + 1)
      ];
      
      // If this node has children, we need to update their inherited messages
      const childNodes = nodes.value.filter(n => n.parentId === nodeId);
      childNodes.forEach(childNode => {
        if (childNode.branchMessageIndex && childNode.branchMessageIndex >= messageIndex) {
          // Adjust the branch message index if needed
          childNode.branchMessageIndex--;
        }
      });
    }
  };

  // Node management
  const addNode = (parentId, branchMessageIndex, position, initialData = {}) => {
    const newId = (Math.max(...nodes.value.map(n => parseInt(n.id))) + 1).toString();
    const parentNode = nodes.value.find(n => n.id === parentId);
    const existingChildren = nodes.value.filter(n => n.parentId === parentId).length;

    // Copy parent messages up to the branch point
    const parentMessages = parentNode?.messages || [];
    const contextMessages = parentMessages.slice(0, branchMessageIndex + 1).map(msg => ({
      ...msg,
      timestamp: new Date().toISOString() // Reset timestamp for the new branch
    }));

    const newNode = {
      id: newId,
      x: position.x,
      y: position.y + (existingChildren * (CARD_HEIGHT + 20)),
      text: `Node ${newId}`,
      parentId,
      messages: contextMessages,
      type: 'branch',
      branchMessageIndex, // Store the point where this branch diverged
      ...initialData
    };

    nodes.value.push(newNode);
    return newNode;
  };

  // Message management with branch awareness
  const addMessage = (nodeId: string, message: string | Message) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (node) {
      // If message is a string, create Message object
      const newMessage = typeof message === 'string' ? {
        role: 'assistant',
        content: message,
        timestamp: new Date().toISOString(),
        isStreaming: false
      } : {
        ...message,
        isStreaming: message.isStreaming ?? false // Set default if not provided
      };
      
      node.messages = [...(node.messages || []), newMessage];
      // analyzeNodeTopics(nodeId);
    }
  };

  // Rest of the store implementation...
  const updateNodePosition = (id, position) => {
    const node = nodes.value.find(n => n.id === id);
    if (node) {
      node.x = position.x;
      node.y = position.y;
    }
  };

  const removeNode = (id) => {
    const topicId = nodeTopics.value.get(id);
    if (topicId !== undefined) {
      const cluster = topicClusters.value.get(topicId);
      if (cluster) {
        cluster.delete(id);
        if (cluster.size === 0) {
          topicClusters.value.delete(topicId);
        }
      }
      nodeTopics.value.delete(id);
    }
    nodes.value = nodes.value.filter(n => n.id !== id && n.parentId !== id);
  };

  const updateNodeTitle = (id, title) => {
    const node = nodes.value.find(n => n.id === id);
    if (node) {
      node.title = title;
    }
  };

  const setStreamingContent = (nodeId, content) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (node) {
      node.streamingContent = content;
    }
  };

  return {
    // State
    nodes,
    activeNode,
    isDragging,
    dragOffset,
    viewMode,
    isTransitioning,
    topicClusters,
    nodeTopics,
    
    // Computed
    connections,
    graphData,
    
    // Constants
    CARD_WIDTH,
    CARD_HEIGHT,
    HORIZONTAL_SPACING,
    
    // Methods
    addNode,
    updateNodePosition,
    removeNode,
    updateNodeTitle,
    addMessage,
    setStreamingContent,
    removeMessage
  };
});