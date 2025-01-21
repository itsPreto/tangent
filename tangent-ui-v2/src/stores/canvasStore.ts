import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Message, Node } from '../types/message';

// Helper types for model info
type ModelSource = 'ollama' | 'openrouter' | 'custom';
interface ModelInfo {
  id: string;
  name: string;
  source: ModelSource;
  provider?: string;
}

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
    branchMessageIndex: null,
    streamingContent: null
  }]);

  // UI state
  const activeNode = ref<string | null>(null);
  const isDragging = ref(false);
  const dragOffset = ref({ x: 0, y: 0 });
  const viewMode = ref<'2d' | '3d'>('2d');
  const isTransitioning = ref(false);
  const customApiUrl = ref<string | null>(localStorage.getItem('customApiUrl') || null);

  // Constants
  const CARD_WIDTH = 672;
  const CARD_HEIGHT = 80;
  const HORIZONTAL_SPACING = 100;

  // Topic clustering state
  const topicClusters = ref(new Map());
  const nodeTopics = ref(new Map());

  // Helper function to process SSE lines
  const processSSELine = (line: string, source: ModelSource) => {
    // Skip empty lines and known control messages
    if (!line || line === 'data: [DONE]' || line === '[DONE]' ||
      (source === 'openrouter' && line.startsWith(': OPENROUTER PROCESSING'))) {
      return null;
    }

    // Remove 'data: ' prefix and handle different formats
    const jsonData = line.startsWith('data: ') ? line.slice(5) : line;

    try {
      const data = JSON.parse(jsonData);

      // Handle different provider response structures
      switch (source) {
        case 'openrouter':
          return data.choices?.[0]?.delta?.content || '';
        case 'ollama':
          // Ollama's response structure uses 'message' field
          return data.message?.content || data.content || '';
        case 'custom':
          // Handle custom API formats
          return data.content || data.response || data.output || '';
        default:
          return data.content || '';
      }
    } catch (e) {
      // Only log actual parsing errors for non-control messages
      if (!line.includes('[DONE]') && !line.includes('OPENROUTER PROCESSING')) {
        console.error(`Error parsing ${source} response:`, e, line);
      }
      return null;
    }
  };

  // Helper function to handle streaming responses
  const handleStreamingResponse = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    nodeId: string,
    modelSource: ModelSource
  ) => {
    let buffer = '';
    let accumulatedContent = '';
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const content = processSSELine(line, modelSource);
          if (content !== null) { // Explicit null check
            accumulatedContent += content;
            setStreamingContent(nodeId, accumulatedContent);
          }
        }
      }

      // Process any remaining buffer content
      if (buffer) {
        const content = processSSELine(buffer, modelSource);
        if (content !== null) {
          accumulatedContent += content;
          setStreamingContent(nodeId, accumulatedContent);
        }
      }

      return accumulatedContent;
    } catch (error) {
      console.error('Error in streaming response:', error);
      throw error;
    }
  };


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

  const parseModelInfo = (selectedModel: string): ModelInfo => {
    if (selectedModel.includes('/')) {
      const [provider, name] = selectedModel.split('/');
      return {
        id: selectedModel,
        name,
        source: 'openrouter',
        provider
      };
    } else if (customApiUrl.value) {
      return {
        id: selectedModel,
        name: selectedModel,
        source: 'custom'
      };
    } else {
      return {
        id: selectedModel,
        name: selectedModel,
        source: 'ollama'
      };
    }
  };

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
      You are a helpful AI assistant who can engage in natural conversation while also helping with code. 
      When sharing code examples, always format them in markdown using fenced blocks with the appropriate language.
    `;

    try {
      const modelInfo = parseModelInfo(selectedModel);

      if (addUserMessage) {
        const userMessage: Message = {
          role: 'user',
          content: message,
          timestamp: new Date().toISOString(),
          isStreaming: false
        };
        addMessage(nodeId, userMessage);
      }

      const messageContext = node.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const { endpoint, headers, requestBody } = prepareRequest(
        modelInfo,
        messageContext,
        systemPrompt,
        openRouterApiKey
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await getErrorText(response);
        throw new Error(errorText);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is null');

      const accumulatedContent = await handleStreamingResponse(reader, nodeId, modelInfo.source);

      // Store final message
      const assistantMessage: Message = {
        role: 'assistant',
        content: accumulatedContent,
        timestamp: new Date().toISOString(),
        modelId: modelInfo.id,
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

  const prepareRequest = (
    modelInfo: ModelInfo,
    messageContext: Array<{ role: string; content: string }>,
    systemPrompt: string,
    openRouterApiKey: string
  ) => {
    let endpoint = 'http://localhost:11434/api/chat';
    let headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (modelInfo.source === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      headers = {
        ...headers,
        'Authorization': `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Tangent Chat'
      };
    } else if (modelInfo.source === 'custom' && customApiUrl.value) {
      endpoint = customApiUrl.value;
    }

    const requestBody = modelInfo.source === 'custom' && customApiUrl.value
      ? {
        prompt: `${messageContext.map(m => `${m.role}: ${m.content}`).join('\n')}`,
        stream: true,
        model: modelInfo.id
      }
      : {
        model: modelInfo.id,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messageContext
        ],
        stream: true
      };

    return { endpoint, headers, requestBody };
  };

  const getErrorText = async (response: Response) => {
    let errorText = `API error: ${response.status}`;
    try {
      const errorData = await response.json();
      errorText += ` - ${JSON.stringify(errorData)}`;
    } catch (e) {
      console.error('Could not parse error body', e);
    }
    return errorText;
  };

  // Node management functions
  const addNode = (parentId: string, branchMessageIndex: number, position: { x: number, y: number }, initialData = {}) => {
    const newId = (Math.max(...nodes.value.map(n => parseInt(n.id))) + 1).toString();
    const parentNode = nodes.value.find(n => n.id === parentId);
    const existingChildren = nodes.value.filter(n => n.parentId === parentId).length;

    const parentMessages = parentNode?.messages || [];
    const contextMessages = parentMessages.slice(0, branchMessageIndex + 1).map(msg => ({
      ...msg,
      timestamp: new Date().toISOString()
    }));

    const newNode: Node = {
      id: newId,
      x: position.x,
      y: position.y + (existingChildren * (CARD_HEIGHT + 20)),
      parentId,
      messages: contextMessages,
      type: 'branch',
      branchMessageIndex,
      streamingContent: null,
      ...initialData
    };

    nodes.value.push(newNode);
    return newNode;
  };

  const addMessage = (nodeId: string, message: string | Message) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (node) {
      const newMessage: Message = typeof message === 'string'
        ? {
          role: 'assistant',
          content: message,
          timestamp: new Date().toISOString(),
          isStreaming: false
        }
        : {
          ...message,
          role: message.role as 'user' | 'assistant',
          isStreaming: message.isStreaming ?? false
        };

      node.messages = [...(node.messages || []), newMessage];
    }
  };

  const removeMessage = (nodeId: string, messageIndex: number) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (node && node.messages) {
      node.messages = [
        ...node.messages.slice(0, messageIndex),
        ...node.messages.slice(messageIndex + 1)
      ];

      const childNodes = nodes.value.filter(n => n.parentId === nodeId);
      childNodes.forEach(childNode => {
        if (childNode.branchMessageIndex && childNode.branchMessageIndex >= messageIndex) {
          childNode.branchMessageIndex--;
        }
      });
    }
  };

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

  const setCustomApiUrl = (url: string | null) => {
    customApiUrl.value = url;
    if (url) {
      localStorage.setItem('customApiUrl', url);
    } else {
      localStorage.removeItem('customApiUrl');
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
    customApiUrl,

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
    sendMessage,
    setCustomApiUrl
  };
});