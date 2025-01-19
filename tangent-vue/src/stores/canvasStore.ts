import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Message, Node } from '../types/message';

export const useCanvasStore = defineStore('canvas', () => {
  // Main state
  const nodes = ref<Node[]>([{
    id: '1',
    x: 100,
    y: 100,
    title: 'Root Thread',
    parentId: null,
    messages: [],
    type: 'main',
    branchMessageIndex: null, // Add this to track where branches start
    streamingContent: null
  }]);

  const activeNode = ref<string | null>(null);
  const isDragging = ref(false);
  const dragOffset = ref({ x: 0, y: 0 });
  const viewMode = ref<'2d' | '3d'>('2d');
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
      lastActive: node.messages?.[node.messages.length - 1]?.timestamp || '',
      branchPoint: node.branchMessageIndex
    }));

    const links = connections.value.map(conn => ({
      source: conn.parent?.id || '',
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

  const sendMessage = async (
    nodeId: string,
    message: string,
    selectedModel: string,
    openRouterApiKey: string,
    addUserMessage = true
  ) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (!node) return;

    const systemPrompt = `
      You are a helpful AI assistant who can engage in natural conversation while also helping with code. When sharing code examples, always format them in markdown using fenced blocks with the appropriate language.
    `;

    try {
      // Parse model info based on whether it's OpenRouter or Ollama
      let modelInfo: { id: string; name: string; source: 'ollama' | 'openrouter'; provider?: string };
      if (selectedModel.includes('/')) {
        const [provider, name] = selectedModel.split('/');
        modelInfo = {
          id: selectedModel,
          name,
          source: 'openrouter',
          provider
        };
      } else {
        modelInfo = {
          id: selectedModel,
          name: selectedModel,
          source: 'ollama'
        };
      }

      // Only add new user message if addUserMessage is true
      if (addUserMessage) {
        const userMessage: Message = {
          role: 'user',
          content: message,
          timestamp: new Date().toISOString(),
          isStreaming: false
        };
        addMessage(nodeId, userMessage);
      }

      // Create message context from existing messages
      const messageContext = node.messages.map((msg) => ({
        role: msg.role,
        content: msg.content
      }));

      const isOpenRouter = selectedModel.includes('/');
      const endpoint = isOpenRouter
        ? 'https://openrouter.ai/api/v1/chat/completions'
        : 'http://localhost:11434/api/chat';

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (isOpenRouter) {
        headers['Authorization'] = `Bearer ${openRouterApiKey}`;
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'Tangent Chat';
      }

      const requestBody = {
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messageContext
        ],
        stream: true
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is null');

      let accumulatedContent = '';
      const decoder = new TextDecoder();

      // In canvasStore.ts, update the OpenRouter streaming handler:
      if (isOpenRouter) {
        // OpenRouter SSE handling
        const processLine = (line: string) => {
          // First check for control messages before any string manipulation
          if (!line || line === 'data: [DONE]' || line === '[DONE]' || line.startsWith(': OPENROUTER PROCESSING')) {
            return;
          }

          // Remove 'data: ' prefix if present
          const jsonData = line.startsWith('data: ') ? line.slice(5) : line;

          try {
            const data = JSON.parse(jsonData);
            const content = data.choices?.[0]?.delta?.content || '';
            if (content) {
              accumulatedContent += content;
              setStreamingContent(nodeId, accumulatedContent);
            }
          } catch (e) {
            // Only log actual parsing errors
            if (!line.includes('[DONE]') && !line.includes('OPENROUTER PROCESSING')) {
              console.error('Error parsing OpenRouter response:', e);
            }
          }
        };

        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            processLine(line);  // Process the raw line without trimming
          }
        }
        // Process any remaining buffer content
        if (buffer) {
          processLine(buffer);  // Process the raw buffer without trimming
        }
      } else {
        // Ollama streaming
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter((l) => l.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              const content = data.message?.content || '';
              if (content) {
                accumulatedContent += content;
                setStreamingContent(nodeId, accumulatedContent);
              }
            } catch (e) {
              console.error('Error parsing chunk:', e);
            }
          }
        }
      }

      // Store final message with model info
      const assistantMessage: Message = {
        role: 'assistant',
        content: accumulatedContent,
        timestamp: new Date().toISOString(),
        modelId: modelInfo.id,  // Include the full model ID
        isStreaming: false
      };
      addMessage(nodeId, assistantMessage);
      setStreamingContent(nodeId, null);

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      setStreamingContent(nodeId, null);
      return false;
    }
  };

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
  const addNode = (parentId: string, branchMessageIndex: number, position: { x: number, y: number }, initialData = {}) => {
    const newId = (Math.max(...nodes.value.map(n => parseInt(n.id))) + 1).toString();
    const parentNode = nodes.value.find(n => n.id === parentId);
    const existingChildren = nodes.value.filter(n => n.parentId === parentId).length;

    // Copy parent messages up to the branch point
    const parentMessages = parentNode?.messages || [];
    const contextMessages = parentMessages.slice(0, branchMessageIndex + 1).map(msg => ({
      ...msg,
      timestamp: new Date().toISOString() // Reset timestamp for the new branch
    }));

    const newNode: Node = {
      id: newId,
      x: position.x,
      y: position.y + (existingChildren * (CARD_HEIGHT + 20)),
      parentId,
      messages: contextMessages,
      type: 'branch',
      branchMessageIndex, // Store the point where this branch diverged
      streamingContent: null,
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
      const newMessage: Message = typeof message === 'string' ? {
        role: 'assistant',
        content: message,
        timestamp: new Date().toISOString(),
        isStreaming: false
      } : {
        ...message,
        role: message.role as 'user' | 'assistant',
        isStreaming: message.isStreaming ?? false // Set default if not provided
      };

      node.messages = [...(node.messages || []), newMessage];
      // analyzeNodeTopics(nodeId);
    }
  };

  // Rest of the store implementation...
  const updateNodePosition = (id: string, position: { x: number, y: number }) => {
    const node = nodes.value.find(n => n.id === id);
    if (node) {
      node.x = position.x;
      node.y = position.y;
    }
  };

  const removeNode = (id: string) => {
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

  const updateNodeTitle = (id: string, title: string) => {
    const node = nodes.value.find(n => n.id === id);
    if (node) {
      node.title = title;
    }
  };

  const setStreamingContent = (nodeId: string, content: string | null) => {
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
    removeMessage,
    sendMessage
  };
});