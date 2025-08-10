// ./src/stores/canvasStore.ts
import { defineStore } from 'pinia';
import { useChatStore } from './chatStore';
import { useConnectionStore } from './connectionStore';
import { ref, watch, computed } from 'vue';
import type { Message, Node, ContentPart, TTSConfig } from '../types/message';
import type { ModelInfo, ModelParameters } from '@/types/model';
import type { ChatSummary } from '@/types/chat';
import type { Connection } from '@/types/connection';
import { sandpackSetup } from '../components/sidebar/sandpackDeps'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import emitter from '@/utils/eventBus'
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { routerService } from '@/services/routerService';
import { generateConnectionId } from '@/utils/connectionUtils';
import { spatialIndex } from '@/services/spatialIndexService';

// Helper types for model info
type ModelSource = "custom" | "ollama" | "google" | "openrouter" | "anthropic" | "openai";

interface LocalStorageState {
  nodes: Node[];
  lastSavedWorkspaceId: string | null;
  isOverviewMode?: boolean;
}

interface RelicNode extends Node {
  type: 'relic';
  content: string;
  language: string;
  sourceNodeId: string;
  codeIndex: number;
}

// Function to detect if a message is likely requesting code
const isCodeRequest = (message: string): boolean => {
  const codeKeywords = [
    'create', 'build', 'component', 'code', 'react', 'vue', 'function',
    'implement', 'class', 'threejs', 'javascript', 'html', 'css',
    'develop', 'generate', 'write', 'program', 'app', 'application'
  ];

  // Check if the message is explicitly requesting code
  const messageLC = message.toLowerCase();

  // Check for explicit code-related phrases
  const containsCodePhrase =
    messageLC.includes('create a component') ||
    messageLC.includes('build me a') ||
    messageLC.includes('implement a') ||
    messageLC.includes('code that') ||
    messageLC.includes('write a function') ||
    messageLC.includes('generate a component');

  // Check for general code keywords
  const containsCodeKeyword = codeKeywords.some(keyword =>
    // Look for whole word matching to avoid false positives
    new RegExp(`\\b${keyword}\\b`, 'i').test(messageLC)
  );

  // Check for code syntax indicators
  const hasCodeIndicators =
    messageLC.includes('```') ||
    messageLC.includes('function ') ||
    messageLC.includes('const ') ||
    messageLC.includes('import ') ||
    messageLC.includes('export ') ||
    messageLC.includes('class ');

  // Check for UI/visual indicators
  const hasUIIndicators =
    messageLC.includes('button') ||
    messageLC.includes('interface') ||
    messageLC.includes('layout') ||
    messageLC.includes('component') ||
    messageLC.includes('display') ||
    (messageLC.includes('show') && messageLC.includes('ui'));

  // Check message length - very short messages are less likely to be code requests
  const isShortQuery = message.length < 20;
  const isQuestion = messageLC.startsWith('what') ||
    messageLC.startsWith('how') ||
    messageLC.startsWith('why') ||
    messageLC.startsWith('when') ||
    messageLC.startsWith('can you explain');

  // If it's a short question without explicit code indicators, it's likely not a code request
  if (isShortQuery && isQuestion && !containsCodePhrase) {
    return false;
  }

  return containsCodePhrase || (containsCodeKeyword && (hasUIIndicators || hasCodeIndicators));
};

export const useCanvasStore = defineStore('canvas', () => {
  const chatStore = useChatStore();
  const connectionStore = useConnectionStore();
  const lastSavedWorkspaceId = ref<string | null>(null);

  // Current chat metadata (including import information)
  const currentChatMetadata = ref<{
    format?: string;
    isImported?: boolean;
    originalId?: string;
  }>({});

  // User preference for assistant mode (defaults to general assistant)
  const preferCodeMode = ref<boolean>(false);

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

  /**
   * Build the system prompt based on whether the request is code‑related and what code type it targets.
   * The inline‑assistant now prepends its own instruction BEFORE calling `sendMessage`, so we no longer
   * need special‑case handling for the inline flow here.
   */
  const generateSystemPrompt = (isCodeReq: boolean, codeType?: string): string => {
    // 1️⃣  Non‑code context ➜ general chat helper
    if (!isCodeReq && !preferCodeMode.value) {
      return `You are a helpful AI assistant.\n\nRespond conversationally to general questions.\nOnly generate code when explicitly requested or when the user's message clearly indicates they need code.\nIf unsure whether code is needed, respond conversationally first and offer to create code if helpful.`;
    }

    // 2️⃣  Code context ➜ strict code generator
    const depsString = JSON.stringify(sandpackSetup.dependencies, null, 2);
    const base = `You are generating code that must work with EXACTLY these dependencies & versions:\n${depsString}\n\nRules:\n• Return a complete, working component/file – no placeholders.\n• Use ONLY the listed packages & versions.\n• No external assets or CDNs.\n• Export the component properly.\n• Follow React best‑practices for hooks & state.`;

    if (codeType === 'threejs') {
      return `${base}\n\nExtra Three.js rules:\n• Import OrbitControls from @react-three/drei.\n• Wrap scene in <Canvas> from @react-three/fiber.\n• Clean up any animations or event listeners.\n• Provide TS types if available.`;
    }

    if (codeType === 'react') {
      return `${base}\n\nExtra React rules:\n• Use functional components + hooks.\n• Define prop types / interfaces.\n• Clean up effects.\n• Optimize for performance.`;
    }

    return base; // default code prompt
  };

  // Function to determine conversation context based on history
  const determineConversationContext = (messages: Message[]): 'code' | 'chat' => {
    if (messages.length < 2) return 'chat';
    const recent = messages.slice(-Math.min(3, messages.length));
    const codeLike = recent.filter(m => m.contentParts?.some(p => p.type === 'code')).length;
    return codeLike >= 1 ? 'code' : 'chat';
  };

  // Store model params per node AND per model
  const nodeModelParams = ref(new Map<string, Map<string, ModelParameters>>());
  const workspaces = ref<ChatSummary[]>([]);

  const updateModelParams = (nodeId: string, modelId: string, params: ModelParameters) => {
    if (!nodeModelParams.value.has(nodeId)) {
      nodeModelParams.value.set(nodeId, new Map());
    }
    nodeModelParams.value.get(nodeId)!.set(modelId, params);
    if (chatStore.currentChatId) {
      chatStore.autoSave(chatStore.currentChatId, nodeId, { modelParams: { [modelId]: params } });
    }
  };

  const getModelParams = (nodeId: string, modelId: string, ctx: 'code' | 'chat' = 'chat'): ModelParameters => {
    const nodeParams = nodeModelParams.value.get(nodeId);
    const base = nodeParams?.get(modelId) || {
      temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 2048
    };
    if (ctx === 'chat') {
      return { ...base, temperature: Math.min(base.temperature + 0.1, 0.9), topP: Math.min(base.topP + 0.02, 0.98) };
    }
    return base;
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

    if (savedState) {
      try {
        const state = JSON.parse(savedState) as LocalStorageState;

        // ONLY restore if there are nodes.  An empty database should result
        // in an empty canvas state.
        if (state.nodes && state.nodes.length > 0) {
          // Use stored positions as-is (database now enforces proper spacing)
          const migratedNodes = state.nodes.map(node => {
            const fixedY = node.y;
            let fixedX = node.x;
            
            if (node.y !== fixedY || node.x !== fixedX) {
              console.log('[CanvasStore] Fixed localStorage extreme coordinates for node:', {
                nodeId: node.id,
                type: node.type,
                originalX: node.x,
                originalY: node.y,
                fixedX: fixedX,
                fixedY: fixedY
              });
            }
            
            return {
              ...node,
              x: fixedX,
              y: fixedY
            };
          });
          
          nodes.value = migratedNodes;
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
  
  // Connection settings
  const autoCreateConnections = ref(false); // Disabled by default for manual control
  
  // Viewport state for connection system
  const viewport = ref({
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    zoom: 1
  });

  // Constants
  const CARD_WIDTH = 672;
  const CARD_HEIGHT = 80;
  const HORIZONTAL_SPACING = 100;

  // Topic clustering state
  const topicClusters = ref(new Map());
  const nodeTopics = ref(new Map());
  const workspaceOrbitalPositions = ref({});
  
  // Connection labels storage
  const connectionLabels = ref(new Map<string, string>());

  let abortController: AbortController | null = null;

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

  // Toggle code mode preference
  const toggleCodeMode = () => {
    preferCodeMode.value = !preferCodeMode.value;
    // Optionally persist this preference in localStorage
    localStorage.setItem('preferCodeMode', preferCodeMode.value.toString());
    return preferCodeMode.value;
  };

  // Initialize code mode preference from localStorage
  const initCodeModePreference = () => {
    const savedPref = localStorage.getItem('preferCodeMode');
    if (savedPref !== null) {
      preferCodeMode.value = savedPref === 'true';
    }
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

      await addNode(msg.parent_message_id, parseInt(msg.branch_id) - 1, { x: nodeData.x, y: nodeData.y }, nodeData);

      // Small delay to allow UI updates
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };

  const createRelicNode = async (
    sourceNodeId: string,
    codeIndex: number,
    content: string,
    language: string,
    position: { x: number, y: number }
  ) => {
    // Generate a unique ID for the relic node
    const newId = `relic-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Get the source node to establish relationship
    const sourceNode = nodes.value.find(n => n.id === sourceNodeId);
    if (!sourceNode) {
      console.error(`Source node ${sourceNodeId} not found`);
      return null;
    }

    // Create the new relic node with explicit type casting to ensure all properties are set
    const newNode: RelicNode = {
      id: newId,
      type: 'relic',
      x: position.x,
      y: position.y,
      content: content || '',
      language: language || 'javascript',
      sourceNodeId: sourceNodeId,
      codeIndex: Number(codeIndex) || 0,
      // Include basic node properties
      parentId: sourceNodeId,
      messages: [],
      streamingContent: null,
      branchMessageIndex: null
    };

    // Add to local state
    nodes.value.push(newNode);

    // Auto-save if in a chat
    if (chatStore.currentChatId) {
      try {
        const nodeId = await chatStore.addNode(chatStore.currentChatId, {
          ...newNode,
          metadata: {
            type: 'relic',
            content: newNode.content,
            language: newNode.language,
            sourceNodeId: newNode.sourceNodeId,
            codeIndex: newNode.codeIndex
          }
        });

        if (nodeId) {
          newNode.id = nodeId;
          // Auto-save parent node's state as well
          if (sourceNodeId) {
            chatStore.autoSave(chatStore.currentChatId, sourceNodeId, {
              children: [...(sourceNode.children || []), nodeId]
            });
          }
        }
      } catch (error) {
        console.error('Error saving relic node:', error);
      }
    }

    return newNode;
  };

  const setupRelicPopoutListener = () => {
    emitter.on('popout-code-bubble', async (data: {
      content: string;
      language: string;
      sourceNodeId: string;
      codeIndex: number;
    }) => {
      const { content, language, sourceNodeId, codeIndex } = data;

      if (!content || !sourceNodeId) {
        console.error('Missing required data for relic node creation', data);
        return;
      }

      // Find the source node to position relative to it
      const sourceNode = nodes.value.find(n => n.id === sourceNodeId);
      if (!sourceNode) {
        console.error(`Source node ${sourceNodeId} not found`);
        return;
      }

      // Calculate position - place to the right of source node
      const position = {
        x: sourceNode.x + CARD_WIDTH + 200,
        y: sourceNode.y + (codeIndex * 50)
      };

      // Create the relic node
      const relicNode = await createRelicNode(
        sourceNodeId,
        Number(codeIndex) || 0,
        content || '',
        language || 'javascript',
        position
      );

      console.log('Created relic node:', relicNode);
    });
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

    // Reset all caches and memory-intensive state
    clearAllCaches();

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

  // Connections computed property - Legacy support for old spline system
  const connections = computed(() => {
    return nodes.value
      .filter(node => node.parentId)
      .map(node => {
        const parent = nodes.value.find(n => n.id === node.parentId);
        return { parent, child: node };
      });
  });

  // Branch indexing system - assigns sequential numbers starting from root (0)
  const nodeIndices = computed(() => {
    if (nodes.value.length === 0) return new Map();
    
    const indexMap = new Map<string, number>();
    
    // Find root node (node without parentId or type 'main')
    const rootNode = nodes.value.find(n => !n.parentId || n.type === 'main');
    if (!rootNode) return indexMap;
    
    // Breadth-first traversal to assign indices
    const queue: { node: any, index: number }[] = [{ node: rootNode, index: 0 }];
    let currentIndex = 0;
    
    while (queue.length > 0) {
      const { node, index } = queue.shift()!;
      indexMap.set(node.id, index);
      
      // Find all children of current node, sorted by creation time or position
      const children = nodes.value
        .filter(n => n.parentId === node.id)
        .sort((a, b) => {
          // Sort by branchMessageIndex first, then by x position, then by y position
          if (a.branchMessageIndex !== b.branchMessageIndex) {
            return (a.branchMessageIndex || 0) - (b.branchMessageIndex || 0);
          }
          if (a.x !== b.x) {
            return a.x - b.x;
          }
          return a.y - b.y;
        });
      
      // Add children to queue with sequential indices
      children.forEach(child => {
        queue.push({ node: child, index: ++currentIndex });
      });
    }
    
    return indexMap;
  });

  // Migration function: Convert parentId-based connections to new connection system
  const migrateConnectionsToNewSystem = () => {
    const existingConnections = new Set();
    
    nodes.value.forEach(node => {
      if (node.parentId) {
        const connectionKey = `${node.parentId}-${node.id}`;
        
        // Check if this connection already exists in the new system
        if (!existingConnections.has(connectionKey)) {
          const connectionId = generateConnectionId(node.parentId, node.id);
          const connection: Connection = {
            id: connectionId,
            startNodeId: node.parentId,
            endNodeId: node.id,
            typeId: 'default-curved',
            label: connectionLabels.value.get(connectionKey) || undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          connectionStore.addConnection(connection);
          existingConnections.add(connectionKey);
        }
      }
    });
  };

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
    initialData = {},
    options?: {
      generateTitle?: boolean;
      firstUserMessage?: string;
    }
  ) => {
    // Generate a unique ID - handle both numeric and UUID string IDs
    const numericIds = nodes.value
      .map(n => parseInt(n.id || '0'))
      .filter(id => !isNaN(id));
    const newId = numericIds.length > 0 
      ? (Math.max(...numericIds, 0) + 1).toString()
      : '1';
    const parentNode = nodes.value.find(n => n.id === parentId);
    const existingChildren = nodes.value.filter(n => n.parentId === parentId).length;

    const parentMessages = parentNode?.messages || [];
    const contextMessages = parentMessages.slice(0, branchMessageIndex + 1).map(msg => ({
      ...msg,
      timestamp: new Date().toISOString()
    }));

    // Initialize with placeholder title for branches
    let initialTitle = 'New Thread';
    if (parentId && options?.generateTitle) {
      initialTitle = 'Generating...'; // Will be replaced by router service
    }

    const newNode: Node = {
      id: newId,
      x: position.x,
      y: position.y + (existingChildren * (CARD_HEIGHT + 20)),
      parentId,
      messages: contextMessages,
      type: 'branch',
      branchMessageIndex,
      streamingContent: null,
      title: initialTitle,
      isGeneratingTitle: options?.generateTitle || false,
      ...initialData
    };

    // Add to local state
    nodes.value.push(newNode);
    
    // Add to spatial index for O(log n) viewport queries
    spatialIndex.addNode(newNode);

    // Generate title for branch nodes if requested
    if (parentId && options?.generateTitle && options?.firstUserMessage) {
      try {
        // Initialize router's title cache with existing node titles
        const existingTitles = nodes.value
          .filter(n => n.title && n.title !== 'New Thread' && n.title !== 'Generating...')
          .map(n => n.title!);
        routerService.initializeTitleCache(existingTitles);

        // Generate title using router service
        const title = await routerService.generateBranchTitle(
          options.firstUserMessage,
          contextMessages.map(m => `${m.role}: ${m.content}`).join('\n'),
          (partialTitle: string) => {
            // Real-time title updates for animation effect
            const node = nodes.value.find(n => n.id === newId);
            if (node) {
              node.title = partialTitle;
            }
          }
        );

        // Set final title and clear loading state
        const node = nodes.value.find(n => n.id === newId);
        if (node) {
          node.title = title;
          node.isGeneratingTitle = false;
          
          // Persist the title
          updateNodeTitle(newId, title);
        }

        console.log(`[CanvasStore] Generated title "${title}" for new branch node ${newId}`);
      } catch (error) {
        console.error('[CanvasStore] Title generation failed:', error);
        // Fallback to default title
        const node = nodes.value.find(n => n.id === newId);
        if (node) {
          node.title = 'New Branch';
          node.isGeneratingTitle = false;
          updateNodeTitle(newId, 'New Branch');
        }
      }
    }

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

    // Trigger memory cleanup every 10 nodes
    if (nodes.value.length % 10 === 0) {
      cleanupMemory();
    }

    // Create connection in the new system if node has a parent and auto-creation is enabled
    if (parentId && autoCreateConnections.value) {
      const connectionId = generateConnectionId(parentId, newNode.id);
      const connection: Connection = {
        id: connectionId,
        startNodeId: parentId,
        endNodeId: newNode.id,
        typeId: 'default-curved',
        label: connectionLabels.value.get(`${parentId}-${newNode.id}`) || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      connectionStore.addConnection(connection);
    }

    return newNode;
  };

  const createToolCallCompact = (parentNodeId: string, toolCall: any) => {
    const parentNode = nodes.value.find(n => n.id === parentNodeId);
    if (!parentNode) return null;

    // Calculate position in a spiral pattern around the parent node to avoid overlap
    const existingToolNodes = nodes.value.filter(n => 
      n.type === 'tool-call-compact' && n.parentId === parentNodeId
    );
    const index = existingToolNodes.length;
    const radius = 150 + (Math.floor(index / 6) * 60); // Increase radius for each ring
    const angle = (index % 6) * (Math.PI * 2 / 6); // 6 nodes per ring
    
    const position = {
      x: parentNode.x + Math.cos(angle) * radius,
      y: parentNode.y + Math.sin(angle) * radius
    };

    // Create a unique ID for the compact tool call node
    const toolCallCompactId = `${parentNodeId}_tool_${toolCall.id}`;

    const toolCallCompact = {
      id: toolCallCompactId,
      parentId: parentNodeId,
      type: 'tool-call-compact',
      x: position.x,
      y: position.y,
      toolCall,
      isTemporary: true // Mark as temporary so it can be easily removed
    };

    // Add to nodes array
    nodes.value.push(toolCallCompact);

    // Create lightweight connection (visual line only, no heavy connection logic)
    if (autoCreateConnections.value) {
      const connectionId = generateConnectionId(parentNodeId, toolCallCompactId);
      const connection: Connection = {
        id: connectionId,
        startNodeId: parentNodeId,
        endNodeId: toolCallCompactId,
        typeId: 'tool-connection', // Use a lighter connection type for tools
        label: undefined, // No labels for tool connections to reduce clutter
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      connectionStore.addConnection(connection);
    }

    return toolCallCompact;
  };

  // Remove tool call compact node
  const removeToolCallCompact = (compactId: string) => {
    const index = nodes.value.findIndex(n => n.id === compactId);
    if (index !== -1) {
      nodes.value.splice(index, 1);
      
      // Remove the connection from the connection store
      connectionStore.removeConnectionsByNodeId(compactId);
    }
  };

  const addMessage = async (nodeId: string, message: string | Message, pasteEntries?: any[]) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (!node) return;

    let newMessage: Message;
    if (typeof message === 'string') {
      // Simple text message
      const standardContentParts = await parseContent(message);
      const pasteContentParts = createPasteContentParts(pasteEntries);

      newMessage = {
        role: 'user',
        content: message,
        contentParts: [...standardContentParts, ...pasteContentParts],
        timestamp: new Date().toISOString(),
        isStreaming: false
      };
    } else {
      // Message object
      const standardContentParts = await parseContent(message.content);
      const pasteContentParts = createPasteContentParts(pasteEntries);

      newMessage = {
        ...message,
        content: message.content,
        contentParts: [...standardContentParts, ...pasteContentParts],
        role: message.role as 'user' | 'assistant',
        isStreaming: message.isStreaming ?? false,
        timestamp: message.timestamp || new Date().toISOString()
      };
    }

    // Validate and fix message properties
    newMessage = validateAndFixMessage(newMessage);

    node.messages = [...(node.messages || []), newMessage];

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
            const response = await fetch('http://127.0.0.1:5050/tts/process', {
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
    nodeId: string,
    contextType: 'code' | 'chat' = 'chat',
    codeType?: string
  ) => {
    if (!modelInfo.source) {
      throw new Error('Model source not specified');
    }

    const modelParams = getModelParams(nodeId, modelInfo.id, contextType);
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

        // Use Flask backend for Google
        endpoint = 'http://127.0.0.1:5050/api/chat/google/stream';
        headers = {
          ...headers,
          'X-API-Key': geminiApiKey
        };

        // Format for Google API
        requestBody = {
          model: modelInfo.id,
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

      case 'anthropic':
        const anthropicApiKey = localStorage.getItem('anthropicApiKey');
        if (!anthropicApiKey) {
          throw new Error('Anthropic API key not found');
        }

        // Use Flask backend for Anthropic
        endpoint = 'http://127.0.0.1:5050/api/chat/anthropic/stream';
        headers = {
          ...headers,
          'X-API-Key': anthropicApiKey
        };

        // Format messages for Anthropic API
        requestBody = {
          model: modelInfo.id,
          messages: messageContext,
          system: systemPrompt,
          temperature: modelParams.temperature,
          top_p: modelParams.topP,
          max_tokens: modelParams.maxOutputTokens
        };
        break;

      case 'openrouter':
        // Use Flask backend for OpenRouter
        endpoint = 'http://127.0.0.1:5050/api/chat/openrouter/stream';
        headers = {
          ...headers,
          'X-API-Key': openRouterApiKey
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
          max_tokens: modelParams.maxOutputTokens
        };
        break;

      case 'ollama':
        // Keep using local Ollama API directly since it doesn't have CORS issues
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

  // Update processSSELine to handle backend-formatted responses
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
          // For OpenRouter proxied through Flask
          return data.choices?.[0]?.delta?.content || '';

        case 'ollama':
          // Ollama's response structure (direct)
          console.log("Ollama data structure:", data);
          return data.message?.content || data.content || data.response || '';

        case 'anthropic':
          // Anthropic's SSE format proxied through Flask
          if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
            return data.delta.text || '';
          }
          return '';

        case 'google':
          // Google's response format proxied through Flask
          if (data.candidates && data.candidates[0]?.content?.parts) {
            return data.candidates[0].content.parts[0]?.text || '';
          }
          return '';

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

  const createPasteContentParts = (pasteEntries) => {
    if (!pasteEntries || !pasteEntries.length) return [];

    return pasteEntries.map(entry => ({
      type: 'paste',
      content: entry.content,
      preview: entry.preview || entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : ''),
      wordCount: entry.wordCount,
      complete: true
    }));
  };
  const sendMessage = async (
    nodeId: string,
    messageData: string | { text: string, pasteEntries?: any[] },
    selectedModel: ModelInfo,
    openRouterApiKey: string,
    addUserMessage = true,
    pasteEntries?: any[]
  ) => {
    const id = nodeId ?? snappedNodeId.value ?? activeNode.value;
    const node = nodes.value.find(n => n.id === id);
    if (!node) {
      throw new Error(`sendMessage: no node found for id "${id ?? 'undefined'}"`);
    }

    // Handle both string messages and structured message objects
    let messageText: string;
    let messagePasteEntries: any[] | undefined;
    let ttsConfig: TTSConfig | undefined;
    let branchContext: string | undefined;

    if (typeof messageData === 'object') {
      // Structured message
      messageText = messageData.text;
      messagePasteEntries = messageData.pasteEntries;
      ttsConfig = (messageData as any).tts; // For backward compatibility
      branchContext = (messageData as any).branchContext;
    } else {
      // Simple string message
      messageText = messageData;
      messagePasteEntries = pasteEntries;
    }

    // Detect if this is a code generation request
    const detectedIsCodeRequest = isCodeRequest(messageText);

    // Determine code type
    let codeType: string | undefined;
    if (detectedIsCodeRequest) {
      if (messageText.toLowerCase().includes('threejs')) {
        codeType = 'threejs';
      } else if (messageText.toLowerCase().includes('react')) {
        codeType = 'react';
      }
    }

    console.log("sendMessage called", {
      nodeId,
      messageText,
      selectedModel,
      openRouterApiKey,
      addUserMessage,
      ttsConfig,
      detectedIsCodeRequest,
      codeType,
      pasteEntries: messagePasteEntries
    });

    // Check if this is the first user message in a branch node that needs title generation
    const isFirstUserMessage = addUserMessage && 
      node.type === 'branch' && 
      node.parentId && // Only for branch nodes
      (!node.title || node.title === 'New Thread' || node.title === 'Untitled Thread') &&
      node.messages.filter(m => m.role === 'user').length === 0; // No user messages yet

    try {
      if (addUserMessage) {
        // Create paste content parts if needed
        const standardContentParts = await parseContent(messageText);
        const pasteContentParts = createPasteContentParts(messagePasteEntries);

        const userMessage: Message = {
          role: 'user',
          content: messageText,
          contentParts: [...standardContentParts, ...pasteContentParts],
          timestamp: new Date().toISOString(),
          isStreaming: false,
        };
        await addMessage(nodeId, userMessage, messagePasteEntries);

        // Generate title for branch nodes on first user message
        if (isFirstUserMessage) {
          // Don't await this - let it run in background
          generateTitleForBranch(nodeId, messageText).catch(error => {
            console.error('[CanvasStore] Background title generation failed:', error);
          });
        }
      }

      // Determine conversation context based on message history
      const conversationContext = determineConversationContext(node.messages);

      // Use detected code request or conversation context to guide model parameters
      const contextType = detectedIsCodeRequest || conversationContext === 'code' ? 'code' : 'chat';

      if (selectedModel.source === 'google') {
        if (!genAI.value) {
          initGeminiClient();
          if (!genAI.value) {
            throw new Error('Failed to initialize Gemini client');
          }
        }

        const model = genAI.value.getGenerativeModel({ model: selectedModel.id });
        const modelParams = getModelParams(nodeId, modelInfo.id, contextType);

        const history = node.messages
          .filter((msg, index) => {
            if (index === 0 && msg.role === 'assistant') return false;
            return true;
          })
          .map(msg => {
            // Get content with paste items appended for context
            let fullContent = msg.content;

            // For user messages, include the paste content
            if (msg.role === 'user') {
              const pasteParts = msg.contentParts?.filter(part => part.type === 'paste');
              if (pasteParts && pasteParts.length > 0) {
                pasteParts.forEach((part, idx) => {
                  fullContent += `\n\n--- Pasted content ${idx + 1} (${part.wordCount} words) ---\n${part.content}\n---\n`;
                });
              }
            }

            return {
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: fullContent }]
            };
          });

        try {
          // For Google/Gemini, we prepend the system prompt to the first message since it doesn't have system messages
          const systemPromptText = generateSystemPrompt(detectedIsCodeRequest, codeType);
          let fullSystemPrompt = systemPromptText;
          
          // Add branch context if available
          if (branchContext && branchContext.trim()) {
            fullSystemPrompt += `\n\n${branchContext}`;
          }
          
          if (history.length > 0 && history[0].role === 'user') {
            history[0].parts[0].text = `${fullSystemPrompt}\n\nUser request: ${history[0].parts[0].text}`;
          }

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

          await addMessage(nodeId, assistantMessage);
          setStreamingContent(nodeId, null);

          // Emit completion event
          emitter.emit('streaming-complete', { nodeId });

          return selectedModel.id;

        } catch (error) {
          throw new Error(`Gemini API error: ${error.message}`);
        }
      } else {
        // Build message context with paste content included
        const messageContext = node.messages
          .filter((msg, index) => {
            if (index === 0 && msg.role === 'assistant') return false;
            return true;
          })
          .map(msg => {
            let fullContent = msg.content;

            // For user messages, include the paste content
            if (msg.role === 'user') {
              const pasteParts = msg.contentParts?.filter(part => part.type === 'paste');
              if (pasteParts && pasteParts.length > 0) {
                pasteParts.forEach((part, idx) => {
                  fullContent += `\n\n--- Pasted content ${idx + 1} (${part.wordCount} words) ---\n${part.content}\n---\n`;
                });
              }
            }

            return {
              role: msg.role,
              content: fullContent
            };
          });

        // Generate appropriate system prompt based on message context and detected code request
        let systemPrompt = generateSystemPrompt(detectedIsCodeRequest, codeType);
        
        // Add branch context if available
        if (branchContext && branchContext.trim()) {
          systemPrompt += `\n\n${branchContext}`;
        }

        const { endpoint, headers, requestBody } = prepareRequest(
          selectedModel,
          messageContext,
          systemPrompt,
          openRouterApiKey,
          nodeId,
          contextType,
          codeType
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
          selectedModel.source as ModelSource,
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

        await addMessage(nodeId, assistantMessage);
        setStreamingContent(nodeId, null);
        abortController = null;

        // Emit completion event
        emitter.emit('streaming-complete', { nodeId });

        return selectedModel.id;
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setStreamingContent(nodeId, null);

      await addMessage(nodeId, {
        role: 'assistant',
        content: `An error occurred: ${error.message || 'Unknown error'}`,
        contentParts: [],
        timestamp: new Date().toISOString(),
        isStreaming: false,
      });

      // Emit completion event on error
      emitter.emit('streaming-complete', { nodeId });

      return false;
    } finally {
      // Always ensure streaming content is cleared and abort controller is reset
      setStreamingContent(nodeId, null);
      abortController = null;

      // Always emit completion event as a final safeguard
      emitter.emit('streaming-complete', { nodeId });
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
    let streamingParts: ContentPart[] = [];
    let lastPartsUpdateLength = 0;

    try {
      console.log("Starting streaming response for", modelSource);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const content = processSSELine(line, modelSource);

          if (content !== null) {
            accumulatedContent += content;
            setStreamingContent(nodeId, accumulatedContent);

            // Only reparse content if we've accumulated a significant amount of new text
            // This prevents excessive parsing operations
            if (accumulatedContent.length > lastPartsUpdateLength + 20 ||
              content.includes('```') ||
              accumulatedContent.length - lastPartsUpdateLength > 100) {

              try {
                // Parse the accumulated content into structured parts
                streamingParts = await parseContent(accumulatedContent);
                lastPartsUpdateLength = accumulatedContent.length;

                // Emit an event with both raw content and parsed parts
                emitter.emit('message-streamed', {
                  nodeId,
                  content: accumulatedContent,
                  contentParts: streamingParts,
                  role: 'assistant',
                  isStreaming: true
                });
              } catch (parseError) {
                console.error('Error parsing streaming content:', parseError);
              }
            }

            if (onStreamedContent) {
              await onStreamedContent(content);
            }
          }
        }
      }

      // Final parse and emit to ensure complete content is processed
      try {
        streamingParts = await parseContent(accumulatedContent);
        emitter.emit('message-streamed', {
          nodeId,
          content: accumulatedContent,
          contentParts: streamingParts,
          role: 'assistant',
          isStreaming: false
        });
      } catch (parseError) {
        console.error('Error in final parse of content:', parseError);
      }

      console.log("Stream complete. Total content:", accumulatedContent);
      return accumulatedContent;
    } catch (error) {
      console.error('Error in streaming response:', error);
      throw error;
    }
  };

  const parseStreamingContentInProgress = async (content) => {
    const parts = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let currentCodeBuffer = '';
    let currentTextBuffer = '';
    let codeIndex = 0;

    // Split the content by lines to detect code blocks
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // Closing code block
          if (currentCodeBuffer) {
            parts.push({
              type: 'code',
              content: currentCodeBuffer.trim(),
              language: codeLanguage,
              codeIndex: codeIndex++,
            });
          }
          currentCodeBuffer = '';
          inCodeBlock = false;
        } else {
          // Opening code block
          if (currentTextBuffer) {
            parts.push({
              type: 'text',
              content: await marked(currentTextBuffer),
            });
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
    if (currentTextBuffer) {
      parts.push({
        type: 'text',
        content: await marked(currentTextBuffer),
      });
    }

    if (inCodeBlock && currentCodeBuffer) {
      parts.push({
        type: 'code',
        content: currentCodeBuffer,
        language: codeLanguage || 'plaintext',
        codeIndex: codeIndex,
      });
    }

    return parts;
  };

  /**  ─────────────────────────────────────────────
 *  Stream a <4‑word title for a node
 *  ───────────────────────────────────────────── */
  const generateBranchTitle = async (
    nodeId: string,
    modelInfo: ModelInfo,
    openRouterApiKey: string
  ) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (!node) return;

    // Build a tiny prompt from the first few messages
    const preview = node.messages
      .slice(0, 3)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = `Title this chat in ≤4 words. Reply ONLY the title:\n\n${preview}`;

    // Re‑use our request builder so we hit the same model the user picked
    const { endpoint, headers, requestBody } = prepareRequest(
      modelInfo,
      [{ role: 'user', content: prompt }],
      '',                 // no system prompt
      openRouterApiKey,
      nodeId,
      'chat'
    );

    // Force stream mode (Ollama/openrouter already uses stream flag;
    // other vendors need us to set it too):
    requestBody.stream = true;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) throw new Error(`title gen failed: ${res.status}`);

    const reader = res.body!.getReader();
    let partial = '';
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const line = processSSELine(chunk, modelInfo.source as ModelSource);
      if (line !== null) {
        partial += line;
        // live‑update so Vue animates it
        node.title = partial;
      }
    }

    node.title = partial.trim().replace(/^"+|"+$/g, ''); // final cleanup
    updateNodeTitle(nodeId, node.title);                 // persist
  };

  const validateAndFixMessage = (message) => {
    // Ensure message has the required properties
    let fixed = { ...message };

    // Ensure timestamp is always set
    if (!fixed.timestamp) {
      fixed.timestamp = new Date().toISOString();
    }

    // Ensure role is set correctly
    if (!fixed.role || !['user', 'assistant'].includes(fixed.role)) {
      fixed.role = fixed.role || 'user';
    }

    // Ensure content is a string
    if (typeof fixed.content !== 'string') {
      fixed.content = String(fixed.content || '');
    }

    // Ensure streamingContent is initialized properly
    fixed.isStreaming = !!fixed.isStreaming;

    return fixed;
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
      
      // Update spatial index for efficient viewport queries
      spatialIndex.updateNodePosition(id, position.x, position.y);

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
        // For critical updates like parentId, save immediately instead of debouncing
        const criticalFields = ['parentId', 'branchMessageIndex'];
        const hasCriticalUpdate = Object.keys(updatedData).some(key => criticalFields.includes(key));
        
        if (hasCriticalUpdate) {
          await chatStore.updateNode(chatStore.currentChatId, id, updatedData);
        } else {
          chatStore.autoSave(chatStore.currentChatId, id, updatedData);
        }
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

  const updateNodeMessages = async (id: string, messages: Message[]) => {
    const node = nodes.value.find(n => n.id === id);
    if (node) {
      node.messages = messages;
      // Auto-save messages
      if (chatStore.currentChatId) {
        chatStore.autoSave(chatStore.currentChatId, id, { messages });
      }
    }
  };

  const updateNodeDimensions = async (id: string, width: number | null, height: number | null) => {
    const node = nodes.value.find(n => n.id === id);
    if (node) {
      // Only update dimensions that are provided (non-null)
      const updateData: any = {};
      
      if (width !== null) {
        (node as any).customWidth = width;
        updateData.customWidth = width;
      }
      
      if (height !== null) {
        (node as any).customHeight = height;
        updateData.customHeight = height;
      }
      
      // Auto-save dimensions (only save what was changed)
      if (chatStore.currentChatId && Object.keys(updateData).length > 0) {
        chatStore.autoSave(chatStore.currentChatId, id, updateData);
      }
    }
  };

  const generateTitleForBranch = async (nodeId: string, firstUserMessage: string) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (!node) {
      console.error(`[CanvasStore] Node ${nodeId} not found for title generation`);
      return;
    }

    try {
      // Set loading state
      node.isGeneratingTitle = true;
      node.title = 'Generating...';
      
      // Initialize router's title cache with existing node titles
      const existingTitles = nodes.value
        .filter(n => n.title && n.title !== 'New Thread' && n.title !== 'Generating...' && n.id !== nodeId)
        .map(n => n.title!);
      routerService.initializeTitleCache(existingTitles);

      // Build context from node messages for better title generation
      const context = node.messages
        .slice(0, 3) // Use first few messages for context
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      // Generate new title using router service
      const newTitle = await routerService.generateBranchTitle(
        firstUserMessage,
        context,
        (partialTitle: string) => {
          // Real-time title updates for animation effect
          const currentNode = nodes.value.find(n => n.id === nodeId);
          if (currentNode) {
            currentNode.title = partialTitle;
          }
        }
      );

      // Set final title and clear loading state
      const currentNode = nodes.value.find(n => n.id === nodeId);
      if (currentNode) {
        currentNode.title = newTitle;
        currentNode.isGeneratingTitle = false;
        
        // Persist the new title
        updateNodeTitle(nodeId, newTitle);
      }

      console.log(`[CanvasStore] Generated title "${newTitle}" for branch node ${nodeId}`);
      return newTitle;
      
    } catch (error) {
      console.error('[CanvasStore] Title generation failed:', error);
      
      // Clear loading state and revert to fallback
      const currentNode = nodes.value.find(n => n.id === nodeId);
      if (currentNode) {
        currentNode.isGeneratingTitle = false;
        currentNode.title = 'New Branch'; // Fallback title
        updateNodeTitle(nodeId, 'New Branch');
      }
    }
  };

  const regenerateNodeTitle = async (nodeId: string, firstUserMessage: string) => {
    const node = nodes.value.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    try {
      // Set loading state
      node.isGeneratingTitle = true;
      
      // Initialize router's title cache with existing node titles
      const existingTitles = nodes.value
        .filter(n => n.title && n.title !== 'New Thread' && n.title !== 'Generating...' && n.id !== nodeId)
        .map(n => n.title!);
      routerService.initializeTitleCache(existingTitles);

      // Build context from node messages for better title generation
      const context = node.messages
        .slice(0, 3) // Use first few messages for context
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      // Generate new title using router service
      const newTitle = await routerService.generateBranchTitle(
        firstUserMessage,
        context,
        (partialTitle: string) => {
          // Real-time title updates for animation effect
          const currentNode = nodes.value.find(n => n.id === nodeId);
          if (currentNode) {
            currentNode.title = partialTitle;
          }
        }
      );

      // Set final title and clear loading state
      const currentNode = nodes.value.find(n => n.id === nodeId);
      if (currentNode) {
        currentNode.title = newTitle;
        currentNode.isGeneratingTitle = false;
        
        // Persist the new title
        updateNodeTitle(nodeId, newTitle);
      }

      console.log(`[CanvasStore] Regenerated title "${newTitle}" for node ${nodeId}`);
      return newTitle;
      
    } catch (error) {
      console.error('[CanvasStore] Title regeneration failed:', error);
      
      // Clear loading state and revert to fallback
      const currentNode = nodes.value.find(n => n.id === nodeId);
      if (currentNode) {
        currentNode.isGeneratingTitle = false;
        // Keep the existing title if regeneration fails
      }
      
      throw error;
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

  // Load ALL nodes from ALL chats simultaneously for performance testing
  const loadAllNodesMode = async () => {
    try {
      console.log('[CanvasStore] Loading ALL nodes from ALL chats...');
      const response = await fetch('http://127.0.0.1:5050/api/all-nodes');
      if (!response.ok) {
        throw new Error(`Failed to fetch all nodes: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load all nodes');
      }
      
      console.log(`[CanvasStore] Loaded ${data.totalNodes} nodes from ${data.totalWorkspaces} workspaces`);
      
      // Clear existing nodes and spatial index  
      nodes.value = [];
      spatialIndex.clear();
      
      // Set all nodes in the store
      nodes.value = data.nodes || [];
      console.log('[CanvasStore] loadAllNodesMode - nodes set:', nodes.value.length, 'nodes');
      
      // CRITICAL: Add all loaded nodes to spatial index for viewport queries
      nodes.value.forEach(node => {
        spatialIndex.addNode(node);
      });
      
      // Set connections if available
      if (data.connections && data.connections.length > 0) {
        // Clear existing connections first
        connectionStore.clearAllConnections();
        
        // Add each connection individually
        data.connections.forEach((connection: any) => {
          connectionStore.addConnection({
            id: connection.id,
            startNodeId: connection.startNodeId,
            endNodeId: connection.endNodeId,
            typeId: connection.type || 'default-curved',
            chatId: connection.chatId,
            isVisible: true,
            path: ''  // Will be calculated by the spline component
          });
        });
        
        console.log('[CanvasStore] Added', data.connections.length, 'connections');
      }
      
      // Clear current chat ID since we're in "all nodes" mode
      console.log('[CanvasStore] Clearing currentChatId for all nodes mode');
      chatStore.currentChatId = null;
      console.log('[CanvasStore] Current chat ID after clearing:', chatStore.currentChatId);
      
      return {
        success: true,
        totalNodes: data.totalNodes,
        totalWorkspaces: data.totalWorkspaces,
        nodes: data.nodes
      };
      
    } catch (error) {
      console.error('[CanvasStore] Error loading all nodes:', error);
      throw error;
    }
  };

  const loadChatState = async (chatId: string) => {
    try {
      const chatData = await chatStore.loadChat(chatId);
      if (!chatData) throw new Error('Failed to load chat');

      console.log('[CanvasStore] Loading chat data:', chatData);
      console.log('[CanvasStore] Chat nodes structure:', chatData.nodes);

      // Store chat metadata for access by components
      currentChatMetadata.value = {
        format: chatData.format,
        isImported: chatData.isImported,
        originalId: chatData.originalId
      };

      // Restore connection labels if they exist
      if (chatData.connectionLabels) {
        console.log('[CanvasStore] Restoring connection labels:', chatData.connectionLabels);
        connectionLabels.value.clear();
        for (const [key, label] of Object.entries(chatData.connectionLabels)) {
          connectionLabels.value.set(key, label as string);
        }
      }

      // Clear existing nodes and spatial index
      nodes.value = [];
      spatialIndex.clear();

      // Convert and load nodes - handle both flat array and hierarchical structure
      const processNodes = (nodeData: any): Node[] => {
        // Check if nodeData is already a flat array (for compatibility)
        if (Array.isArray(nodeData)) {
          return nodeData.map(node => {
            // Use database positions as-is (database now enforces proper spacing)
            const fixedY = node.y;
            let fixedX = node.x;
            
            if (node.y !== fixedY || node.x !== fixedX) {
              console.log('[CanvasStore] Fixed extreme coordinates for node:', {
                nodeId: node.id,
                type: node.type,
                originalX: node.x,
                originalY: node.y,
                fixedX: fixedX,
                fixedY: fixedY
              });
            }
            
            const processedNode = {
              id: node.id,
              type: node.type,
              title: node.title,
              x: fixedX,
              y: fixedY,
              parentId: node.parentId,
              branchMessageIndex: node.branchMessageIndex,
              messages: node.messages || [],
              streamingContent: null,
              modelParams: node.modelParams,
              ...node.metadata
            };
            
            // Handle tool-call-compact nodes - extract toolCall from metadata
            if (node.type === 'tool-call-compact') {
              console.log('[CanvasStore] Processing compact node:', { 
                nodeId: node.id, 
                metadata: node.metadata,
                hasToolCall: !!node.metadata?.toolCall 
              });
              
              if (node.metadata?.toolCall) {
                processedNode.toolCall = node.metadata.toolCall;
                processedNode.isTemporary = node.metadata.isTemporary || true;
              } else {
                console.warn('[CanvasStore] Compact node missing toolCall:', node);
                // Create a fallback toolCall to prevent crashes
                processedNode.toolCall = {
                  id: node.id,
                  tool_name: 'Unknown',
                  parameters: {},
                  status: 'success',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
              }
            }
            
            return processedNode;
          });
        }
        
        // Handle hierarchical structure (single root node with children)
        const flattenNodes = (node: any): Node[] => {
          const children = node.children || [];
          
          // Use database positions as-is (database now enforces proper spacing)
          const fixedY = node.y;
          let fixedX = node.x;
          
          if (node.y !== fixedY || node.x !== fixedX) {
            console.log('[CanvasStore] Fixed extreme coordinates for hierarchical node:', {
              nodeId: node.id,
              type: node.type,
              originalX: node.x,
              originalY: node.y,
              fixedX: fixedX,
              fixedY: fixedY
            });
          }
          
          const processedNode = {
            id: node.id,
            type: node.type,
            title: node.title,
            x: fixedX,
            y: fixedY,
            parentId: node.parentId,
            branchMessageIndex: node.branchMessageIndex,
            messages: node.messages || [],
            streamingContent: null,
            modelParams: node.modelParams,
            ...node.metadata
          };
          
          // Handle tool-call-compact nodes - extract toolCall from metadata
          if (node.type === 'tool-call-compact') {
            console.log('[CanvasStore] Processing compact node (hierarchical):', { 
              nodeId: node.id, 
              metadata: node.metadata,
              hasToolCall: !!node.metadata?.toolCall 
            });
            
            if (node.metadata?.toolCall) {
              processedNode.toolCall = node.metadata.toolCall;
              processedNode.isTemporary = node.metadata.isTemporary || true;
            } else {
              console.warn('[CanvasStore] Compact node missing toolCall (hierarchical):', node);
              // Create a fallback toolCall to prevent crashes
              processedNode.toolCall = {
                id: node.id,
                tool_name: 'Unknown',
                parameters: {},
                status: 'success',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
            }
          }
          
          return [
            processedNode,
            ...children.flatMap(flattenNodes)
          ];
        };
        
        return flattenNodes(nodeData);
      };

      // Load nodes and update state
      nodes.value = processNodes(chatData.nodes);
      lastSavedWorkspaceId.value = chatId;
      
      // CRITICAL: Add all loaded nodes to spatial index for viewport queries
      nodes.value.forEach(node => {
        spatialIndex.addNode(node);
      });
      
      // Restore model parameters for each node
      nodeModelParams.value.clear();
      nodes.value.forEach(node => {
        if (node.modelParams) {
          const paramsMap = new Map<string, ModelParameters>();
          Object.entries(node.modelParams).forEach(([modelId, params]) => {
            paramsMap.set(modelId, params as ModelParameters);
          });
          nodeModelParams.value.set(node.id, paramsMap);
        }
      });

      // Update localStorage
      const state: LocalStorageState = {
        nodes: nodes.value,
        lastSavedWorkspaceId: chatId
      };
      localStorage.setItem('canvasState', JSON.stringify(state));

      // Migrate connections after loading nodes
      migrateConnectionsToNewSystem();

      // Emit event to notify canvas that workspace was loaded
      console.log('[CanvasStore] Emitting workspace-loaded event for:', chatId, 'with', nodes.value.length, 'nodes');
      emitter.emit('workspace-loaded', { chatId, nodeCount: nodes.value.length });

      return true;
    } catch (error) {
      console.error('Error loading chat state:', error);
      return false;
    }
  };

  const saveWorkspace = async (title?: string) => {
    try {
      if (!title) {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        title = `WS ${month}/${day} ${hours}:${minutes}`;
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
    console.log('[CanvasStore] Starting createNewWorkspace');
    
    // First, handle any existing snapped node
    if (snappedNodesStack.value.length > 0) {
      // Clear the snapped nodes stack
      snappedNodesStack.value = [];
      // Remove the 'has-snapped-node' class from body
      document.body.classList.remove('has-snapped-node');
    }

    const timestamp = new Date().toLocaleString();
    const defaultTitle = `WS:${timestamp}`;
    console.log('[CanvasStore] Generated title:', defaultTitle);

    // Calculate center position
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    console.log('[CanvasStore] Center position:', { centerX, centerY });

    // Create the root node
    const rootNode: Node = {
      id: '1',
      x: centerX - CARD_WIDTH / 2,
      y: centerY - CARD_HEIGHT / 2,
      title: 'New Thread',
      parentId: null,
      messages: [],
      type: 'main',
      branchMessageIndex: null,
      streamingContent: null
    };

    console.log('[CanvasStore] Created root node:', rootNode);

    // Clear existing nodes and set new root node
    nodes.value = [rootNode];
    isOverviewMode.value = false;

    const initialNodeData = {
      type: rootNode.type,
      title: rootNode.title,
      x: rootNode.x,
      y: rootNode.y,
      messages: rootNode.messages,
      metadata: {
        type: rootNode.type
      }
    };
    
    console.log('[CanvasStore] Calling chatStore.createChat with:', { defaultTitle, initialNodeData });

    // Create and save the workspace
    const chatId = await chatStore.createChat(defaultTitle, initialNodeData);

    console.log('[CanvasStore] chatStore.createChat returned:', chatId);

    if (chatId) {
      lastSavedWorkspaceId.value = chatId;
      const state = {
        nodes: nodes.value,
        lastSavedWorkspaceId: chatId,
        isOverviewMode: false
      };
      localStorage.setItem('canvasState', JSON.stringify(state));
      console.log('[CanvasStore] Workspace created successfully, saved to localStorage');
    } else {
      console.error('[CanvasStore] Failed to create workspace - chatId is null');
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

  // Initialize code mode preference when store is created
  initCodeModePreference();

  setupRelicPopoutListener();

  // Spatial index management - keep it in sync with nodes
  watch(nodes, (newNodes) => {
    // Rebuild spatial index when nodes change significantly
    if (newNodes.length === 0) {
      spatialIndex.clear();
    } else {
      // Check if this is a bulk update (more than 5 nodes changed)
      spatialIndex.rebuild(newNodes);
    }
  }, { deep: false }); // Don't watch deep changes, only array replacement
  
  /**
   * Get visible nodes using spatial index - O(log n) instead of O(n)!
   * This is the key optimization for handling 100k+ nodes
   */
  const getVisibleNodes = (viewport: { x: number; y: number; width: number; height: number }, buffer = 500): Node[] => {
    return spatialIndex.getVisibleNodes(viewport, buffer);
  };
  
  /**
   * Get nearest nodes to a point - useful for snap/focus
   */
  const getNearestNodes = (x: number, y: number, count = 5): Node[] => {
    return spatialIndex.getNearestNodes(x, y, count);
  };
  
  // Memory management functions
  const MAX_NODE_PARAMS_CACHE = 100; // Limit the number of cached node parameters
  const MAX_TOPIC_CLUSTERS = 50; // Limit topic clusters
  
  const cleanupMemory = () => {
    // Clean up nodeModelParams - keep only recent nodes
    if (nodeModelParams.value.size > MAX_NODE_PARAMS_CACHE) {
      const currentNodeIds = new Set(nodes.value.map(n => n.id));
      
      // Remove params for nodes that no longer exist
      for (const [nodeId] of nodeModelParams.value) {
        if (!currentNodeIds.has(nodeId)) {
          nodeModelParams.value.delete(nodeId);
        }
      }
      
      // If still too many, remove oldest entries (LRU-style)
      if (nodeModelParams.value.size > MAX_NODE_PARAMS_CACHE) {
        const entries = Array.from(nodeModelParams.value.keys());
        const toRemove = entries.slice(0, entries.length - MAX_NODE_PARAMS_CACHE);
        toRemove.forEach(nodeId => nodeModelParams.value.delete(nodeId));
      }
    }
    
    // Clean up topic clusters
    if (topicClusters.value.size > MAX_TOPIC_CLUSTERS) {
      const entries = Array.from(topicClusters.value.keys());
      const toRemove = entries.slice(0, entries.length - MAX_TOPIC_CLUSTERS);
      toRemove.forEach(topicId => {
        topicClusters.value.delete(topicId);
        // Also clean up related nodeTopics
        for (const [nodeId, nodeTopicId] of nodeTopics.value) {
          if (nodeTopicId === topicId) {
            nodeTopics.value.delete(nodeId);
          }
        }
      });
    }
  };
  
  const clearAllCaches = () => {
    // Clear all memory-intensive caches
    nodeModelParams.value.clear();
    topicClusters.value.clear();
    nodeTopics.value.clear();
    connectionLabels.value.clear();
    
    // Clear any other potential memory consumers
    snappedNodesStack.value = [];
    snappedNodeId.value = null;
    
    console.log('Canvas store caches cleared');
  };
  
  // Connection label functions
  const setConnectionLabel = (parentId: string, childId: string, label: string) => {
    const key = `${parentId}->${childId}`;
    connectionLabels.value.set(key, label);
    
    // Auto-save connection labels if in a chat
    if (chatStore.currentChatId) {
      const labelsObj = Object.fromEntries(connectionLabels.value);
      chatStore.updateChatMetadata(chatStore.currentChatId, {
        connectionLabels: labelsObj
      });
    }
  };
  
  const getConnectionLabel = (parentId: string, childId: string): string | undefined => {
    const key = `${parentId}->${childId}`;
    return connectionLabels.value.get(key);
  };
  
  const getMemoryUsage = () => {
    return {
      nodeModelParams: nodeModelParams.value.size,
      topicClusters: topicClusters.value.size,
      nodeTopics: nodeTopics.value.size,
      nodes: nodes.value.length,
      snappedNodes: snappedNodesStack.value.length
    };
  };

  return {
    nodes,
    activeNode,
    isDragging,
    dragOffset,
    viewMode,
    isTransitioning,
    topicClusters,
    nodeTopics,
    workspaceOrbitalPositions,
    customApiUrl,
    connections,
    nodeIndices,
    graphData,
    lastSavedWorkspaceId,
    isOverviewMode,
    snappedNodesStack,
    preferCodeMode,
    currentChatMetadata,

    CARD_WIDTH,
    CARD_HEIGHT,
    HORIZONTAL_SPACING,

    // Updated methods
    addNode,
    createToolCallCompact,
    removeToolCallCompact,
    updateNodePosition,
    removeNode,
    updateNodeTitle,
    updateNodeMessages,
    updateNodeDimensions,
    generateTitleForBranch,
    regenerateNodeTitle,
    addMessage,
    removeMessage,
    setStreamingContent,
    sendMessage,
    setCustomApiUrl,
    initFromLocalStorage,
    saveWorkspace,
    loadChatState,
    loadAllNodesMode,
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
    generateBranchTitle,
    prepareRequest,
    initGeminiClient,
    snappedNodeId,
    workspaces,
    addWorkspaceToOverview,
    importWorkspaceMessages,
    toggleCodeMode,
    isCodeRequest,
    determineConversationContext,
    
    // Memory management
    cleanupMemory,
    clearAllCaches,
    getMemoryUsage,
    
    // Spatial indexing for performance
    getVisibleNodes,
    getNearestNodes,
    
    // Connection labels
    setConnectionLabel,
    getConnectionLabel,
    connectionLabels,
    
    // New connection system
    migrateConnectionsToNewSystem,
    viewport,
    autoCreateConnections,
  };
});