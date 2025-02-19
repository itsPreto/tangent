// ./src/stores/canvasStore.ts
import { defineStore } from 'pinia';
import { useChatStore } from './chatStore';
import { ref, watch, computed } from 'vue';
import type { Message, Node, ContentPart, TTSConfig } from '../types/message';
import type { ModelInfo, ModelParameters } from '@/types/model';
import type { ChatSummary } from '@/types/chat';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";


import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Helper types for model info
type ModelSource = 'ollama' | 'openrouter' | 'custom';

interface LocalStorageState {
  nodes: Node[];
  lastSavedWorkspaceId: string | null;
  isOverviewMode?: boolean;
}


export const useCanvasStore = defineStore('canvas', () => {
  const chatStore = useChatStore();
  const lastSavedWorkspaceId = ref<string | null>(null);


  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    }
  ];

  const nodeModelParams = ref(new Map<string, ModelParameters>());

  const workspaces = ref<ChatSummary[]>([]);

  const updateModelParams = (nodeId: string, params: ModelParameters) => {
    nodeModelParams.value.set(nodeId, params);

    // Auto-save if in a chat
    if (chatStore.currentChatId) {
      chatStore.autoSave(chatStore.currentChatId, nodeId, {
        modelParams: params
      });
    }
  };

  const getModelParams = (nodeId: string): ModelParameters => {
    return nodeModelParams.value.get(nodeId) || {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048
    };
  };
  // At the top of useCanvasStore
  const genAI = ref<GoogleGenerativeAI | null>(null);

  // Initialize Gemini client when API key is available
  const initGeminiClient = () => {
    const apiKey = localStorage.getItem('geminiApiKey');
    if (apiKey) {
      genAI.value = new GoogleGenerativeAI(apiKey);
    }
  };
  const initFromLocalStorage = () => {
    const savedState = localStorage.getItem('canvasState');
    console.log("initFromLocalStorage: savedState:", savedState); // Log the raw saved state

    if (savedState) {
      try {
        const state = JSON.parse(savedState) as LocalStorageState;
        console.log("initFromLocalStorage: parsed state:", state); // Log the parsed state

        // ONLY restore if there are nodes.  An empty database should result
        // in an empty canvas state.
        if (state.nodes && state.nodes.length > 0) {
          console.log("initFromLocalStorage: Restoring nodes from localStorage");
          nodes.value = state.nodes;
          lastSavedWorkspaceId.value = state.lastSavedWorkspaceId;
          isOverviewMode.value = state.isOverviewMode ?? true; // Default to true if not present
        } else {
          console.log("initFromLocalStorage: No nodes to restore, or empty savedState");
        }

      } catch (error) {
        console.error("initFromLocalStorage: Error parsing saved state:", error);
      }
    } else {
      console.log("initFromLocalStorage: No savedState found in localStorage");
    }
  };
  const isOverviewMode = ref(true);

  // Main state
  const nodes = ref<Node[]>([]);

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

  let abortController: AbortController | null = null;
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

  const snappedNodesStack = ref<string[]>([]);

  const snappedNodeId = ref<string | null>(null);

  const snapNode = (nodeId: string) => {
    snappedNodeId.value = nodeId; // Just set the ID
    if (!snappedNodesStack.value.includes(nodeId)) {
      snappedNodesStack.value.push(nodeId);
    }
  };

  const unsnapNode = (nodeId: string) => {
    snappedNodeId.value = null; // Clear the ID
    snappedNodesStack.value = snappedNodesStack.value.filter(id => id !== nodeId);

  };
  const popSnappedNode = () => {
    // Pop off the top snapped node
    snappedNodesStack.value.pop();
    snappedNodeId.value = snappedNodesStack.value[snappedNodesStack.value.length - 1] ?? null;
  };


  const addWorkspaceToOverview = async (workspaceData: any) => {
    // Basic validation.
    if (!workspaceData.id || !workspaceData.title) {
      console.error("Invalid workspace data:", workspaceData);
      return;
    }

    const newWorkspace: ChatSummary = {
      id: workspaceData.id,
      title: workspaceData.title,
      createdAt: Date.now(), // You might get this from the backend, or generate here
      updatedAt: Date.now(),
      nodeCount: 0,       // You'll need to update this, or get it from backend
      x: Math.random() * 1000,  //  random initial position
      y: Math.random() * 600,
      status: 'active',       // Or 'archived', as appropriate
      tags: [],
      color: '#ffffff',       // Or a default color
      isFavorite: false,
    };

    workspaces.value.push(newWorkspace); // Directly add to the ref
    // Optionally save to local storage if you're managing workspace list here:
    // saveToLocalStorage(); // You'd need a function to save the state

    // If you also need to immediately reflect this in the chatStore:
      await chatStore.loadChats(); //I'm keeping this incase you end up adding a db route for it later
  };

  // 3. Add the `importWorkspaces` function:
  const importWorkspaceMessages = async (messages: any[]) => {
    // Process messages and create nodes
    for (const msg of messages) {
      const nodeData = {
        id: msg.message_id,
        parentId: msg.parent_message_id,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        type: 'branch',
        messages: [{
          role: msg.sender === 'human' ? 'user' : 'assistant',
          content: msg.text,
          contentParts: [],
          timestamp: msg.timestamp,
          isStreaming: false,
        }],
        branchMessageIndex: parseInt(msg.branch_id) - 1,
        title: msg.chat_name
      };
      
      await addNode(msg.parent_message_id, parseInt(msg.branch_id) - 1, {x: nodeData.x, y: nodeData.y}, nodeData);
      
      // Small delay to allow UI updates
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };

  const parseContent = async (fullContent: string): Promise<ContentPart[]> => {
    const parts: ContentPart[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let currentCodeBuffer = '';
    let currentTextBuffer = '';
    let codeIndex = 0;

    const lines = fullContent.split('\n');

    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // Closing code block
          if (currentCodeBuffer) { // Important: Check if buffer has content
            parts.push({
              type: 'code',
              content: currentCodeBuffer.trimEnd(), // Trim trailing whitespace
              language: codeLanguage,
              codeIndex: codeIndex++,
            });
          }
          currentCodeBuffer = '';
          codeLanguage = '';
          inCodeBlock = false;
        } else {
          // Opening code block
          if (currentTextBuffer) {
            const html = await marked(currentTextBuffer);
            const safeHTML = DOMPurify.sanitize(html);
            parts.push({ type: 'text', content: safeHTML });
            currentTextBuffer = '';
          }
          codeLanguage = line.slice(3).trim();
          inCodeBlock = true;
        }
      } else {
        if (inCodeBlock) {
          currentCodeBuffer += (currentCodeBuffer ? '\n' : '') + line;
        } else {
          currentTextBuffer += (currentTextBuffer ? '\n' : '') + line;
        }
      }
    }

    // Handle any remaining content
    if (currentCodeBuffer) {
      parts.push({
        type: 'code',
        content: currentCodeBuffer.trimEnd(), // Trim trailing whitespace
        language: codeLanguage,
        codeIndex: codeIndex++,
      });
    } else if (currentTextBuffer) {
      const html = await marked(currentTextBuffer)
      const safeHTML = DOMPurify.sanitize(html)
      parts.push({ type: 'text', content: safeHTML });
    }

    return parts;
  };
  const clearCurrentWorkspace = () => {
    // Handle any existing snapped node
    if (snappedNodesStack.value.length > 0) {
      snappedNodesStack.value = [];
      document.body.classList.remove('has-snapped-node');
    }

    // Reset nodes array
    nodes.value = [];

    // Reset UI state
    activeNode.value = null;
    isDragging.value = false;
    dragOffset.value = { x: 0, y: 0 };
    isTransitioning.value = false;

    // Reset topic clustering state
    topicClusters.value = new Map();
    nodeTopics.value = new Map();

    // Set overview mode to false
    isOverviewMode.value = false;

    // Clear workspace ID
    lastSavedWorkspaceId.value = null;

    // Clear local storage
    const state = { nodes: [], lastSavedWorkspaceId: null, isOverviewMode: false };
    localStorage.setItem('canvasState', JSON.stringify(state));
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
    if (selectedModel.startsWith('models/gemini')) {
      return {
        id: selectedModel,
        name: selectedModel.split('/')[1],
        source: 'google'  // This is the key change
      };
    } else if (selectedModel.includes('/')) {
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
  const addNode = async (
    parentId: string | null,
    branchMessageIndex: number,
    position: { x: number, y: number },
    initialData = {}
  ) => {
    const newId = (Math.max(...nodes.value.map(n => parseInt(n.id || '0')), 0) + 1).toString(); //handle the empty nodes array for inital node
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

    // Add to local state
    nodes.value.push(newNode);

    // Auto-save if in a chat
    if (chatStore.currentChatId) {
      const nodeId = await chatStore.addNode(chatStore.currentChatId, {
        ...newNode,
        metadata: {
          type: newNode.type,
          url: (newNode as any).url,
          mediaType: (newNode as any).mediaType
        }
      });
      if (nodeId) {
        newNode.id = nodeId;
        // Auto-save the parent node's state as well
        if (parentId) {
          const parentNode = nodes.value.find(n => n.id === parentId);
          if (parentNode) {
            chatStore.autoSave(chatStore.currentChatId, parentId, {
              children: [...(parentNode.children || []), nodeId]
            });
          }
        }
      }
    }

    return newNode;
  };



  const addMessage = async (nodeId: string, message: string | Message) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (!node) return;

    let newMessage: Message;
    if (typeof message === 'string') {
      // If it's a string, it's likely a simple text message from the user.
      newMessage = {
        role: 'user', // Set role to 'user' for user messages
        content: message, //keep the message intact
        contentParts: await parseContent(message), // Parse the content
        timestamp: new Date().toISOString(),
        isStreaming: false,
      };
    } else {
      // If it's a Message object, process its content.
      newMessage = {
        ...message,
        content: message.content,  // Keep original intact
        contentParts: await parseContent(message.content), // Parse content
        role: message.role as 'user' | 'assistant',
        isStreaming: message.isStreaming ?? false,
      };
    }

    console.log("addMessage: Adding message to node", nodeId, ":", newMessage); // ADD THIS
    node.messages = [...(node.messages || []), newMessage];
    console.log("addMessage: Node after adding message:", node); // ADD THIS

    // Auto-save messages
    if (chatStore.currentChatId) {
      chatStore.autoSave(chatStore.currentChatId, nodeId, {
        messages: node.messages
      });
    }
  };


  const processStreamedContent = async (
    nodeId: string,
    content: string,
    setStreamingContent: (nodeId: string, content: string | null) => void,
    ttsConfig?: TTSConfig
  ) => {
    if (ttsConfig?.enabled) {
      const sentences = content.split(/([.!?]+\s+)/);
      for (const sentence of sentences) {
        if (sentence.trim()) {
          try {
            const response = await fetch('http://127.0.0.1:5000/tts/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: sentence,
                voice: ttsConfig.voice,
                speed: ttsConfig.speed
              })
            });

            if (response.ok) {
              const audioBlob = await response.blob();
              const audio = new Audio(URL.createObjectURL(audioBlob));
              await audio.play();
            }
          } catch (error) {
            console.error('Error processing TTS:', error);
          }
        }
      }
    }
  };

  const prepareRequest = (
    modelInfo: ModelInfo,
    messageContext: Array<{ role: string; content: string }>,
    systemPrompt: string,
    openRouterApiKey: string,
    nodeId: string
  ) => {
    if (!modelInfo.source) {
      throw new Error('Model source not specified');
    }

    const modelParams = getModelParams(nodeId);
    let endpoint = '';
    let headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    let requestBody: any;

    switch (modelInfo.source) {
      case 'google':
        const geminiApiKey = localStorage.getItem('geminiApiKey');
        if (!geminiApiKey) {
          throw new Error('Gemini API key not found');
        }
        endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelInfo.id}:generateContent?key=${geminiApiKey}`;
        requestBody = {
          contents: messageContext.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          })),
          generationConfig: {
            temperature: modelParams.temperature,
            topK: modelParams.topK,
            topP: modelParams.topP,
            maxOutputTokens: modelParams.maxOutputTokens,
          },
          safetySettings
        };
        break;

      case 'openrouter':
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        headers = {
          ...headers,
          'Authorization': `Bearer ${openRouterApiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Tangent Chat'
        };
        requestBody = {
          model: modelInfo.id,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messageContext
          ],
          temperature: modelParams.temperature,
          top_p: modelParams.topP,
          top_k: modelParams.topK,
          max_tokens: modelParams.maxOutputTokens,
          stream: true
        };
        break;

      case 'ollama':
        endpoint = 'http://localhost:11434/api/chat';
        requestBody = {
          model: modelInfo.name,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messageContext
          ],
          options: {
            temperature: modelParams.temperature,
            top_p: modelParams.topP,
            top_k: modelParams.topK,
            num_predict: modelParams.maxOutputTokens,
          },
          stream: true
        };
        break;

      default:
        throw new Error(`Unsupported model source: ${modelInfo.source}`);
    }

    return { endpoint, headers, requestBody };
  };

  const sendMessage = async (
    nodeId: string,
    messageData: string | { message: string, tts?: TTSConfig },
    selectedModel: ModelInfo,
    openRouterApiKey: string,
    addUserMessage = true
  ) => {
    const messageText = typeof messageData === 'string' ? messageData : messageData.message;
    const ttsConfig = typeof messageData === 'string' ? undefined : messageData.tts;

    console.log("sendMessage called", { nodeId, messageText, selectedModel, openRouterApiKey, addUserMessage, ttsConfig });

    const node = nodes.value.find(n => n.id === nodeId);
    if (!node) {
      console.error("sendMessage: Node not found", nodeId);
      return false;
    }

    try {
      if (addUserMessage) {
        const userMessage: Message = {
          role: 'user',
          content: messageText,
          contentParts: await parseContent(messageText),
          timestamp: new Date().toISOString(),
          isStreaming: false,
        };
        addMessage(nodeId, userMessage);
      }

      if (selectedModel.source === 'google') {
        if (!genAI.value) {
          initGeminiClient();
          if (!genAI.value) {
            throw new Error('Failed to initialize Gemini client');
          }
        }

        const model = genAI.value.getGenerativeModel({ model: selectedModel.id });
        const modelParams = getModelParams(nodeId);

        const history = node.messages
          .filter((msg, index) => {
            if (index === 0 && msg.role === 'assistant') return false;
            return true;
          })
          .map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          }));

        try {
          const chat = model.startChat({
            history,
            generationConfig: {
              temperature: modelParams.temperature,
              topK: modelParams.topK,
              topP: modelParams.topP,
              maxOutputTokens: modelParams.maxOutputTokens,
            },
            safetySettings
          });

          const result = await chat.sendMessageStream(messageText);
          let accumulatedContent = '';

          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            accumulatedContent += chunkText;
            setStreamingContent(nodeId, accumulatedContent);
            await processStreamedContent(nodeId, chunkText, setStreamingContent, ttsConfig);
          }

          const assistantMessage: Message = {
            role: 'assistant',
            content: accumulatedContent,
            contentParts: await parseContent(accumulatedContent),
            timestamp: new Date().toISOString(),
            modelId: selectedModel.id,
            isStreaming: false,
          };

          addMessage(nodeId, assistantMessage);
          setStreamingContent(nodeId, null);
          return selectedModel.id;

        } catch (error) {
          throw new Error(`Gemini API error: ${error.message}`);
        }
      } else {
        const messageContext = node.messages
          .filter((msg, index) => {
            if (index === 0 && msg.role === 'assistant') return false;
            return true;
          })
          .map(msg => ({
            role: msg.role,
            content: msg.content
          }));

        const { endpoint, headers, requestBody } = prepareRequest(
          selectedModel,
          messageContext,
          "You are a helpful AI assistant...",
          openRouterApiKey,
          nodeId
        );

        abortController = new AbortController();
        const signal = abortController.signal;

        const fetchResponse = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal,
        });

        if (!fetchResponse.ok) {
          const errorText = await getErrorText(fetchResponse);
          throw new Error(errorText);
        }

        const reader = fetchResponse.body?.getReader();
        if (!reader) {
          throw new Error("Response body is null");
        }

        const response = await handleStreamingResponse(
          reader,
          nodeId,
          selectedModel.source,
          async (streamedContent: string) => {
            await processStreamedContent(nodeId, streamedContent, setStreamingContent, ttsConfig);
          }
        );

        const assistantMessage: Message = {
          role: 'assistant',
          content: response,
          contentParts: await parseContent(response),
          timestamp: new Date().toISOString(),
          modelId: selectedModel.id,
          isStreaming: false,
        };

        addMessage(nodeId, assistantMessage);
        setStreamingContent(nodeId, null);
        abortController = null;
        return selectedModel.id;
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setStreamingContent(nodeId, null);
      addMessage(nodeId, {
        role: 'assistant',
        content: `An error occurred: ${error.message || 'Unknown error'}`,
        contentParts: [],
        timestamp: new Date().toISOString(),
        isStreaming: false,
      });
      return false;
    }
  };

  const handleStreamingResponse = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    nodeId: string,
    modelSource: ModelSource,
    onStreamedContent?: (content: string) => Promise<void>
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
          if (content !== null) {
            accumulatedContent += content;
            setStreamingContent(nodeId, accumulatedContent);
            if (onStreamedContent) {
              await onStreamedContent(content);
            }
          }
        }
      }

      if (buffer) {
        const content = processSSELine(buffer, modelSource);
        if (content !== null) {
          accumulatedContent += content;
          setStreamingContent(nodeId, accumulatedContent);
          if (onStreamedContent) {
            await onStreamedContent(content);
          }
        }
      }

      return accumulatedContent;
    } catch (error) {
      console.error('Error in streaming response:', error);
      throw error;
    }
  };

  const removeMessage = async (nodeId: string, messageIndex: number) => {
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

      // Persist changes if in a chat
      if (chatStore.currentChatId) {
        await chatStore.updateNode(chatStore.currentChatId, nodeId, {
          messages: node.messages
        });

        // Update child nodes if branch indices changed
        for (const childNode of childNodes) {
          if (childNode.branchMessageIndex !== undefined) {
            await chatStore.updateNode(chatStore.currentChatId, childNode.id, {
              branchMessageIndex: childNode.branchMessageIndex
            });
          }
        }
      }
    }
  };


  const updateNodePosition = async (id: string, position: { x: number, y: number }) => {
    const node = nodes.value.find(n => n.id === id);
    if (node) {
      node.x = position.x;
      node.y = position.y;

      // Auto-save position if in a chat
      if (chatStore.currentChatId) {
        chatStore.autoSave(chatStore.currentChatId, id, { x: position.x, y: position.y });
      }
    }
  };

  const updateNode = async (id: string, updatedData: Partial<Node>) => {
    const node = nodes.value.find(n => n.id === id);
    if (node) {
      Object.assign(node, updatedData);

      // Auto-save if in a chat
      if (chatStore.currentChatId) {
        chatStore.autoSave(chatStore.currentChatId, id, updatedData);
      }
    }
  };

  const removeNode = async (id: string) => {
    // Remove from topics if present
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

    // Remove from backend if in a chat
    if (chatStore.currentChatId) {
      await chatStore.removeNode(chatStore.currentChatId, id);
    }

    // Remove from local state
    nodes.value = nodes.value.filter(n => n.id !== id && n.parentId !== id);
  };

  const updateNodeTitle = async (id: string, title: string) => {
    const node = nodes.value.find(n => n.id === id);
    if (node) {
      node.title = title;

      // Auto-save title
      if (chatStore.currentChatId) {
        chatStore.autoSave(chatStore.currentChatId, id, { title });
      }
    }
  };



  const setNodeHeightLock = (nodeId: string, height: number) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (node) {
      node.lockedHeight = height;

      // Auto-save if in a chat
      if (chatStore.currentChatId) {
        chatStore.autoSave(chatStore.currentChatId, nodeId, {
          lockedHeight: height
        });
      }
    }
  };

  const clearNodeHeightLock = (nodeId: string) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (node) {
      delete node.lockedHeight;

      // Auto-save the removal if in a chat
      if (chatStore.currentChatId) {
        chatStore.autoSave(chatStore.currentChatId, nodeId, {
          lockedHeight: undefined
        });
      }
    }
  };

  const setStreamingContent = (nodeId: string, content: string | null) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (node) {
      node.streamingContent = content;
    }
  };

  const loadChatState = async (chatId: string) => {
    try {
      const chatData = await chatStore.loadChat(chatId);
      if (!chatData) throw new Error('Failed to load chat');

      // Clear existing nodes
      nodes.value = [];

      // Convert and load nodes
      const flattenNodes = (node: any): Node[] => {
        const children = node.children || [];
        return [
          {
            id: node.id,
            type: node.type,
            title: node.title,
            x: node.x,
            y: node.y,
            parentId: node.parentId,
            branchMessageIndex: node.branchMessageIndex,
            messages: node.messages || [],
            streamingContent: null,
            ...node.metadata
          },
          ...children.flatMap(flattenNodes)
        ];
      };

      // Load nodes and update state
      nodes.value = flattenNodes(chatData.nodes);
      lastSavedWorkspaceId.value = chatId;

      // Update localStorage
      const state: LocalStorageState = {
        nodes: nodes.value,
        lastSavedWorkspaceId: chatId
      };
      localStorage.setItem('canvasState', JSON.stringify(state));

      return true;
    } catch (error) {
      console.error('Error loading chat state:', error);
      return false;
    }
  };

  const saveWorkspace = async (title?: string) => {
    try {
      if (!title) {
        title = `Workspace ${new Date().toLocaleString()}`;
      }

      // Save the root node and its state
      const rootNode = nodes.value.find(n => !n.parentId);
      if (!rootNode) return null;

      const chatId = await chatStore.createChat(title, {
        type: rootNode.type,
        title: rootNode.title,
        x: rootNode.x,
        y: rootNode.y,
        messages: rootNode.messages,
        metadata: {
          type: rootNode.type,
          url: (rootNode as any).url,
          mediaType: (rootNode as any).mediaType
        }
      });

      if (!chatId) throw new Error('Failed to create chat');

      // Save all other nodes
      const otherNodes = nodes.value.filter(n => n.parentId);
      for (const node of otherNodes) {
        await chatStore.addNode(chatId, {
          ...node,
          metadata: {
            type: node.type,
            url: (node as any).url,
            mediaType: (node as any).mediaType
          }
        });
      }

      // Update local state and localStorage
      lastSavedWorkspaceId.value = chatId;
      const state: LocalStorageState = {
        nodes: nodes.value,
        lastSavedWorkspaceId: chatId
      };
      localStorage.setItem('canvasState', JSON.stringify(state));

      return chatId;
    } catch (error) {
      console.error('Error saving workspace:', error);
      return null;
    }
  };

  const createNewWorkspace = async () => {
    // First, handle any existing snapped node
    if (snappedNodesStack.value.length > 0) {
      // Clear the snapped nodes stack
      snappedNodesStack.value = [];
      // Remove the 'has-snapped-node' class from body
      document.body.classList.remove('has-snapped-node');
    }

    const timestamp = new Date().toLocaleString();
    const defaultTitle = `WS:${timestamp}`;

    // Calculate center position
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // Create the root node
    const rootNode: Node = {
      id: '1',
      x: centerX - CARD_WIDTH / 2,
      y: centerY - CARD_HEIGHT / 2,
      title: 'New Thread',
      parentId: null,
      messages: [
        {
          role: 'assistant',
          content: 'How can I help you?',
          contentParts: [],
          timestamp: new Date().toISOString(),
        }
      ],
      type: 'main',
      branchMessageIndex: null,
      streamingContent: null
    };

    // Clear existing nodes and set new root node
    nodes.value = [rootNode];
    isOverviewMode.value = false;

    // Create and save the workspace
    const chatId = await chatStore.createChat(defaultTitle, {
      type: rootNode.type,
      title: rootNode.title,
      x: rootNode.x,
      y: rootNode.y,
      messages: rootNode.messages,
      metadata: {
        type: rootNode.type
      }
    });

    if (chatId) {
      lastSavedWorkspaceId.value = chatId;
      const state = {
        nodes: nodes.value,
        lastSavedWorkspaceId: chatId,
        isOverviewMode: false
      };
      localStorage.setItem('canvasState', JSON.stringify(state));
    }

    return chatId;
  };



  const setCustomApiUrl = (url: string | null) => {
    customApiUrl.value = url;
    if (url) {
      localStorage.setItem('customApiUrl', url);
    } else {
      localStorage.removeItem('customApiUrl');
    }
  };
  watch(() => nodes.value, (newNodes) => {
    // Save to localStorage
    const state: LocalStorageState = {
      nodes: newNodes,
      lastSavedWorkspaceId: lastSavedWorkspaceId.value,
      isOverviewMode: false,  // No longer need overview mode
    };
    localStorage.setItem('canvasState', JSON.stringify(state));

    // Auto-save to backend if in a chat
    if (chatStore.currentChatId) {
      newNodes.forEach(node => {
        chatStore.autoSave(chatStore.currentChatId!, node.id, {
          x: node.x,
          y: node.y,
          messages: node.messages,
          title: node.title,
          metadata: {
            type: node.type,
            url: (node as any).url,
            mediaType: (node as any).mediaType
          }
        });
      });
    }
  }, { deep: true });

  // Move the return statement inside the store definition
  return {
    nodes,
    activeNode,
    isDragging,
    dragOffset,
    viewMode,
    isTransitioning,
    topicClusters,
    nodeTopics,
    customApiUrl,
    connections,
    graphData,
    lastSavedWorkspaceId,
    isOverviewMode,
    snappedNodesStack,

    CARD_WIDTH,
    CARD_HEIGHT,
    HORIZONTAL_SPACING,

    // Updated methods
    addNode,
    updateNodePosition,
    removeNode,
    updateNodeTitle,
    addMessage,
    removeMessage,
    setStreamingContent,
    sendMessage,
    setCustomApiUrl,
    initFromLocalStorage,
    saveWorkspace,
    loadChatState,
    clearCurrentWorkspace,
    createNewWorkspace,
    updateNode,
    setNodeHeightLock,
    clearNodeHeightLock,
    snapNode,
    unsnapNode,
    popSnappedNode,
    updateModelParams,
    getModelParams,
    handleStreamingResponse,
    prepareRequest,
    initGeminiClient,
    snappedNodeId,
    workspaces,
    addWorkspaceToOverview,
    importWorkspaceMessages,
  };
});