import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BranchNode } from '../visualization/BranchNode';
import ChatInterface from './ChatInterface';
import CanvasToolbar from '../navigation/CanvasToolbar';
import ChatContainer from './ChatContainer';
import FloatingInput from '../shared/FloatingInput';
import { MessageNavigator } from '../navigation/MessageNavigator'
import { ModelStatus } from '../shared/ModelStatus'
import { cn } from "../../utils/utils";
import { useVisualization } from '../providers/VisualizationProvider';

export function GridBackground({ translate, scale, className }) {
  const gridSize = 20;
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;
  const offsetX = (translate.x % (gridSize * scale)) / scale;
  const offsetY = (translate.y % (gridSize * scale)) / scale;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        transform: `translate(${offsetX}px, ${offsetY}px)`,
      }}
    >
      <defs>
        <pattern
          id="grid"
          width={gridSize}
          height={gridSize}
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            className={cn("stroke-[1.2]", className)}
          />
        </pattern>
      </defs>
      <rect
        x="-20"
        y="-20"
        width={viewWidth + 40}
        height={viewHeight + 40}
        fill="url(#grid)"
      />
    </svg>
  );
}

const defaultTemplate = {
  id: 'template',
  type: 'template',
  title: 'New Branch',
  systemPrompt: '',
  x: 50,
  y: 150,
  messages: []
};

const systemPrompt = `You are a helpful AI assistant. When responding:
1. For brief responses ("briefly", "quick", "short"):
   - Use maximum 3 sentences
   - Focus on core concepts only

2. For comprehensive responses ("tell me everything", "explain in detail"):
   - Write at least 6-8 paragraphs
   - Cover fundamentals, history, types, applications
   - Include specific examples and use cases
   - Explain technical concepts in depth
   - Break down complex topics into subtopics
   - Discuss current trends and future implications

3. For unspecified length:
   - Provide 4-5 sentences
   - Balance detail and brevity

4. For React-related tasks:
   - Focus on functional components and hooks (e.g., \`useState\`, \`useEffect\`).
   - Assume the user works with an environment that supports modern React (version 18 or higher) and includes support for live previews and error handling.
   - Components should be styled using a lightweight, utility-first CSS framework (such as Tailwind CSS) unless otherwise specified.
   - Responses should account for ease of testing and previewing components, ensuring a smooth developer experience.

5. Always adapt your response length and content style based on explicit or implicit length cues in the user's question.`;



const TangentChat = ({
  initialConversation,
  isPanelCollapsed = false,
  nodes,
  setNodes,
  activeChat,
  setActiveChat
}) => {
  const [selectedNodePosition, setSelectedNodePosition] = useState(null);

  const [temperature, setTemperature] = useState(0.7);

  const { handleRefresh, theme, setTheme } = useVisualization();

  const [activeResponses, setActiveResponses] = useState(new Map());

  const [containerWidth, setContainerWidth] = useState(400);

  const [expandedMessages, setExpandedMessages] = useState(new Set());

  const [selectedNode, setSelectedNode] = useState(initialConversation?.id || 1);
  const [focusedMessageIndex, setFocusedMessageIndex] = useState(0);
  const [expandedNodes, setExpandedNodes] = useState(new Set([initialConversation?.id]));
  const [inputValue, setInputValue] = useState(''); // Changed from input to inputValue
  const [activeTool, setActiveTool] = useState('pan');
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [chatContainerSize, setChatContainerSize] = useState('normal');
  const [activeContext, setActiveContext] = useState({
    messages: [],
    systemPrompt: '',
    parentChain: []
  });
  const [dragState, setDragState] = useState({
    isDragging: false,
    nodeId: null,
    startPos: { x: 0, y: 0 },
    nodeStartPos: { x: 0, y: 0 }
  });
  const [streamingMessage, setStreamingMessage] = useState("");
  const [continuationCount, setContinuationCount] = useState(0);
  const lastResponseTime = useRef(null);

  const [showQuickInput, setShowQuickInput] = useState(true);
  const [quickInputPosition, setQuickInputPosition] = useState({
    x: window.innerWidth / 2 - 192, // Half of input width (384/2)
    y: window.innerHeight - 90
  });

  const [activeThreadId, setActiveThreadId] = useState(initialConversation?.id || 1);



  const [contentHeight, setContentHeight] = useState(0);

  const canvasRef = useRef(null);
  const nodesRef = useRef(nodes);
  const transformRef = useRef({ scale, translate });

  const contentRef = useRef(null);


  nodesRef.current = nodes;


  // Add a sensitivity factor for panning
  const PANNING_SENSITIVITY = 0.42;
  // Add a sensitivity factor for dragging nodes

  const ZOOM_SENSITIVITY = 0.0012;

  const getChatContainerWidth = useCallback(() => {
    const widths = {
      collapsed: 240,
      normal: 400,
      large: 1200,
      xlarge: Math.floor(window.innerWidth * 0.73)
    };
    return widths[chatContainerSize] || widths.normal;
  }, [chatContainerSize]);


  const getFullMessageHistory = useCallback((nodeId) => {
    const currentNode = nodes.find(n => n.id === nodeId);
    if (!currentNode) return [];

    // If it's the main thread or has no parent, return messages as is
    if (currentNode.type === 'main' || !currentNode.parentId) {
      return currentNode.messages;
    }

    // For branch nodes, return the contextMessages if they exist
    if (currentNode.contextMessages) {
      return currentNode.contextMessages;
    }

    // Fallback to just the node's messages if no context exists
    return currentNode.messages;
  }, [nodes]);


  useEffect(() => {
    transformRef.current = { scale, translate };
  }, [scale, translate]);


  useEffect(() => {
    if (!contentRef.current) return;

    const height = contentRef.current.getBoundingClientRect().height;
    setContentHeight(height);

    // Only pan if content exceeds viewport
    if (height > window.innerHeight) {
      const overflow = height - window.innerHeight;
      setTranslate(prev => ({
        ...prev,
        y: -overflow + 200 // Leave some space at bottom
      }));
    }
  }, [nodes]); // Run when messages/nodes update


  useEffect(() => {
    const root = document.documentElement;
    // Remove all possible theme classes
    root.classList.remove('light', 'dark', 'hextech-nordic', 'singed-theme');
    // Add the selected theme
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (initialConversation && Array.isArray(initialConversation)) {
      const updatedNodes = initialConversation.map((node) => ({
        ...node,
        x: node.x ?? selectedNodePosition?.x ?? 400,
        y: node.y ?? selectedNodePosition?.y ?? 100,
      }));
      setNodes(updatedNodes);
      setExpandedNodes(new Set(updatedNodes.map((node) => node.id)));
      setSelectedNode(updatedNodes[0]?.id || 1);
    }
  }, [initialConversation, selectedNodePosition]);

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('http://localhost:11434/api/tags');
        const data = await response.json();
        setModels(data.models);

        // Check if a model is already stored in localStorage
        const savedModel = localStorage.getItem('selectedModel');
        if (savedModel && data.models.some(model => model.name === savedModel)) {
          // Use the saved model if it exists in the fetched list
          setSelectedModel(savedModel);
        } else if (data.models.length > 0) {
          // Otherwise, set the last model in the list as default
          const lastModel = data.models[data.models.length - 1].name;
          setSelectedModel(lastModel);
          localStorage.setItem('selectedModel', lastModel);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    };
    fetchModels();
  }, []);

  const handleToggleMessageExpand = useCallback((messageIndex) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageIndex)) {
        next.delete(messageIndex);
      } else {
        next.add(messageIndex);
      }
      return next;
    });
  }, []);



  const handleToolSelect = useCallback((tool) => {
    setActiveTool(tool);
  }, []);

  const handleThemeChange = useCallback((newTheme) => {
    setTheme(newTheme);
  }, []);

  const focusOnMessage = useCallback((nodeId, messageIndex, zoomInClose = false) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    // Calculate message position within node
    const messageOffset = messageIndex * 120; // Approximate height per message
    const messageY = node.y + 300 + messageOffset; // 100px is base node header height

    // Center the canvas on the message
    const centerX = canvasRect.width / 2;
    const centerY = canvasRect.height / 2;

    // Calculate new translation to center the message
    const newTranslateX = centerX - (node.x + 128) * scale;
    const newTranslateY = centerY - messageY * scale;

    // Update translation
    setTranslate({
      x: newTranslateX,
      y: newTranslateY
    });

    // Set zoom level based on whether Shift is pressed
    setScale(zoomInClose ? 2 : scale);

    // Expand the node if it's not already expanded
    if (!expandedNodes.has(nodeId)) {
      setExpandedNodes(prev => new Set([...prev, nodeId]));
    }

    // Select the node
    setSelectedNode(nodeId);
    setFocusedMessageIndex(messageIndex);
  }, [nodes, scale, expandedNodes]);


  const handleInputChange = (e) => {
    // If it's an event, use e.target.value, otherwise use the value directly
    const newValue = e.target ? e.target.value : e;
    setInputValue(newValue);
  };

  const createPreviewBranch = ({ parentId, code, language, position, messageIndex }) => {
    return {
      id: Date.now() + Math.random(), // Generate unique ID
      type: 'preview',
      title: `${language.toUpperCase()} Preview`,
      parentId,
      parentMessageIndex: messageIndex,
      x: position.x,
      y: position.y,
      messages: [{
        role: 'assistant',
        content: code,
        language,
        isPreview: true,
        timestamp: new Date().toISOString()
      }]
    };
  };


  const handleSendMessage = async (nodeId, message) => {
    // Early validation
    if (!message || typeof message !== 'string') {
      console.error('Invalid message:', message);
      return;
    }
    if (!message.trim()) return;

    // Clear the input immediately after sending
    setInputValue('');

    const currentNode = nodes.find(n => n.id === nodeId);
    if (!currentNode) {
      console.error('Node not found:', nodeId);
      return;
    }

    // 1) Add user message
    const newMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      context: determineMessageContext(message),
    };
    setNodes(prevNodes => prevNodes.map(node =>
      node.id === nodeId
        ? {
          ...node,
          messages: [...node.messages, newMessage],
          contextMessages: node.type === 'branch'
            ? [...(node.contextMessages || []), newMessage]
            : undefined,
        }
        : node
    ));

    // 2) Mark the node as actively receiving a response
    setActiveResponses(prev => new Map(prev).set(nodeId, true));

    try {
      // Build conversation context
      const conversationContext = currentNode.type === 'branch'
        ? [...(currentNode.contextMessages || []), newMessage]
        : [...currentNode.messages];

      // Format conversation for the API
      const formattedConversation = conversationContext
        .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      // 3) Send request
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: formattedConversation + '\n\nHuman: ' + message + '\n\nAssistant:',
          stream: true,
          system: currentNode.systemPrompt || systemPrompt,
          options: {
            temperature: temperature || 0.7,
            num_ctx: 8192,
            num_predict: 2048,
            top_p: 0.9,
            top_k: 20,
          },
        }),
      });

      // 4) Handle streaming response
      let accumulatedResponse = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            // Check for both response and message properties
            const responseText = data.response || (data.message && data.message.content);

            if (responseText) {
              accumulatedResponse += responseText;
              // Update streaming content
              setNodes(prevNodes => prevNodes.map(node =>
                node.id === nodeId
                  ? { ...node, streamingContent: accumulatedResponse }
                  : node
              ));
            }
          } catch (err) {
            console.error('Error parsing JSON line:', err);
          }
        }
      }

      // 5) Final assistant message
      const finalMessage = {
        role: 'assistant',
        content: accumulatedResponse || 'No response received',  // Fallback content
        timestamp: new Date().toISOString(),
      };

      // 6) Insert final message into the main thread
      setNodes(prevNodes => prevNodes.map(node => {
        if (node.id !== nodeId) return node;
        return {
          ...node,
          messages: [
            ...node.messages.filter(m => m.role !== 'assistant' || !m.isStreaming),
            finalMessage,
          ],
          contextMessages: node.type === 'branch'
            ? [...(node.contextMessages || []), finalMessage]
            : undefined,
          streamingContent: null,
        };
      }));

      const codeBlockRegex = /```(python)([\s\S]*?)```/g;
      const matches = [...accumulatedResponse.matchAll(codeBlockRegex)];

      if (matches.length > 0) {
        const previewBranches = matches.map((match, index) => {
          const [, language, code] = match;
          const cleanCode = code.trim();

          // Position new node near the parent
          const position = {
            x: currentNode.x + 400,
            y: currentNode.y + index * 300,
          };

          // Create preview branch
          return createPreviewBranch({
            parentId: nodeId,
            code: cleanCode,
            language,
            position,
            messageIndex: currentNode.messages.length + 1,
          });
        });

        // Add preview branches to nodes
        setNodes(prev => [...prev, ...previewBranches]);
      }
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      // Clear streaming state on error
      setNodes(prevNodes => prevNodes.map(node =>
        node.id === nodeId ? { ...node, streamingContent: null } : node
      ));
    } finally {
      // Clear active response
      setActiveResponses(prev => {
        const next = new Map(prev);
        next.delete(nodeId);
        return next;
      });
    }
  };


  const determineMessageContext = (content) => {
    const pythonIndicators = ['python', 'def ', 'import ', 'print('];
    const reactIndicators = ['react', 'jsx', 'component', 'useState'];

    if (pythonIndicators.some(i => content.toLowerCase().includes(i))) return 'python';
    if (reactIndicators.some(i => content.toLowerCase().includes(i))) return 'react';
    return 'text';
  };

  const wrapCodeInComponent = (code) => {
    if (!code.includes('export default') && !code.includes('function')) {
      return `
import React, { useState } from 'react';

export default function PreviewComponent() {
  ${code}
  return (
    <div className="p-4">
      <button onClick={handleClick} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        Click me!
      </button>
      <p className="mt-2">Count: {count}</p>
    </div>
  );
}`;
    }
    return code;
  };

  const handleFloatingInputSend = (message) => {
    handleSendMessage(selectedNode, message);
  };

  const handleUpdateTitle = (nodeId, newTitle) => {
    setNodes(prevNodes => prevNodes.map(node =>
      node.id === nodeId ? { ...node, title: newTitle } : node
    ));
  };

  const buildConversationContext = (node) => {
    let context = {
      messages: [],
      parentChain: []
    };

    // Build the chain of parent nodes
    let currentNode = node;
    while (currentNode) {
      context.parentChain.unshift(currentNode.id);
      if (currentNode.parentId) {
        const parentNode = nodes.find(n => n.id === currentNode.parentId);
        if (parentNode) {
          // Add messages up to the branch point
          const relevantMessages = parentNode.messages.slice(0, currentNode.parentMessageIndex + 1);
          context.messages.unshift(...relevantMessages);
          currentNode = parentNode;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Add the current node's messages
    context.messages.push(...node.messages);

    return context;
  };

  const onCreateBranch = async (parentNodeId, messageIndex, position = null) => {
    const parentNode = nodes.find(n => n.id === parentNodeId);
    if (!parentNode) return;

    // Calculate position using the new function instead of using provided position
    const branchPosition = calculateBranchPosition(parentNode, messageIndex, nodes);

    const newNode = createBranch(
      parentNode,
      defaultTemplate,
      nodes,
      messageIndex,
      branchPosition // Use calculated position
    );

    // Update the active context with the full context from parent
    const branchContext = buildConversationContext(newNode);
    setActiveContext(branchContext);

    setNodes(prevNodes => [...prevNodes, newNode]);
    setSelectedNode(newNode.id);
  };


  const screenToCanvas = useCallback((screenX, screenY) => {
    const { scale, translate } = transformRef.current;
    return {
      x: (screenX - translate.x) / scale,
      y: (screenY - translate.y) / scale
    };
  }, []);

  const handleDragStart = useCallback((e, node) => {
    if (node.type === 'main') return;

    e.preventDefault();
    e.stopPropagation();

    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    setDragState({
      isDragging: true,
      nodeId: node.id,
      startPos: canvasPos,
      nodeStartPos: { x: node.x, y: node.y }
    });
  }, [screenToCanvas]);

  const handleDrag = useCallback((e) => {
    if (!dragState.isDragging) return;

    const currentPos = screenToCanvas(e.clientX, e.clientY);

    const deltaX = currentPos.x - dragState.startPos.x;
    const deltaY = currentPos.y - dragState.startPos.y;

    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === dragState.nodeId
          ? {
            ...node,
            x: dragState.nodeStartPos.x + deltaX,
            y: dragState.nodeStartPos.y + deltaY
          }
          : node
      )
    );
  }, [dragState, screenToCanvas]);

  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      nodeId: null,
      startPos: { x: 0, y: 0 },
      nodeStartPos: { x: 0, y: 0 }
    });
  }, []);

  const getSiblingBranches = useCallback((nodeId) => {
    const currentNode = nodes.find(n => n.id === nodeId);
    if (!currentNode || !currentNode.parentId) return [];

    // Get all branches that share the same parent and parent message index
    return nodes.filter(n =>
      n.id !== nodeId &&
      n.parentId === currentNode.parentId &&
      n.parentMessageIndex === currentNode.parentMessageIndex
    ).sort((a, b) => a.y - b.y); // Sort by vertical position
  }, [nodes]);

  // Handle canvas mouse down for both panning and node dragging
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button !== 0) return;

    const target = e.target;
    const isBackground = target === canvasRef.current ||
      target.classList.contains('grid-background');

    if (activeTool === 'pan' || (activeTool === 'select' && (e.ctrlKey || e.metaKey || isBackground))) {
      e.preventDefault();
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [activeTool]);

  const handleDeleteNode = (nodeId) => {
    // Also delete all child nodes
    const nodesToDelete = new Set([nodeId]);
    let foundMore = true;

    while (foundMore) {
      foundMore = false;
      nodes.forEach(node => {
        if (node.parentId && nodesToDelete.has(node.parentId) && !nodesToDelete.has(node.id)) {
          nodesToDelete.add(node.id);
          foundMore = true;
        }
      });
    }

    setNodes(nodes.filter(node => !nodesToDelete.has(node.id)));
    if (selectedNode && nodesToDelete.has(selectedNode)) {
      setSelectedNode(1); // Return to main thread
    }
  };


  const handleWheel = useCallback((e) => {
    if (e.target.closest('.scrollable')) {
      // Ignore scrolling events if the target is inside a scrollable container
      return;
    }
    e.preventDefault();

    const { scale: currentScale, translate: currentTranslate } = transformRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if it's a zoom gesture (CMD/CTRL pressed)
    if (e.ctrlKey || e.metaKey) {
      // Handle zooming
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const zoom = Math.exp(delta);

      // Limit scale between 0.1 and 5 with smoother transitions
      const newScale = Math.min(Math.max(0.1, currentScale * zoom), 5);

      const mouseBeforeZoom = screenToCanvas(mouseX, mouseY);
      const scaleDiff = newScale - currentScale;

      const newTranslate = {
        x: currentTranslate.x - mouseBeforeZoom.x * scaleDiff,
        y: currentTranslate.y - mouseBeforeZoom.y * scaleDiff
      };

      setScale(newScale);
      setTranslate(newTranslate);
    } else {
      // Handle panning (two-finger gesture or trackpad)
      // Apply panning sensitivity for smoother movement
      const dx = e.deltaX * PANNING_SENSITIVITY;
      const dy = e.deltaY * PANNING_SENSITIVITY;

      setTranslate(prev => ({
        x: prev.x - dx,
        y: prev.y - dy
      }));
    }
  }, [screenToCanvas]);

  const calculateBranchPosition = (parentNode, messageIndex, existingNodes) => {
    const BASE_SPACING_X = 300; // Horizontal space between branches
    const BASE_SPACING_Y = 200; // Increased vertical space for better visibility
    const MESSAGE_HEIGHT = 120; // Height per message

    const baseX = parentNode.x + BASE_SPACING_X;
    const baseY = parentNode.y + (messageIndex * MESSAGE_HEIGHT);

    const siblingBranches = existingNodes.filter(node =>
      node.parentId === parentNode.id && node.parentMessageIndex === messageIndex
    );

    const verticalOffset = siblingBranches.length * BASE_SPACING_Y;

    return {
      x: baseX,
      y: baseY + verticalOffset,
    };
  };

  // Function to center the main node
  const centerCanvas = useCallback(() => {
    if (!canvasRef.current) return;

    // Calculate expanded bounds including messages
    const calculateExpandedBounds = (nodes, expandedNodes) => {
      return nodes.reduce((bounds, node) => {
        const nodeWidth = NODE_WIDTH;
        let nodeHeight = NODE_HEADER_HEIGHT;

        // Add height for expanded messages
        if (expandedNodes.has(node.id) && node.messages) {
          nodeHeight += node.messages.reduce((height, msg) => {
            return height + (msg.content.length > 150 ? 160 : 120) + MESSAGE_PADDING;
          }, 0);
        }

        return {
          minX: Math.min(bounds.minX, node.x),
          maxX: Math.max(bounds.maxX, node.x + nodeWidth),
          minY: Math.min(bounds.minY, node.y),
          maxY: Math.max(bounds.maxY, node.y + nodeHeight)
        };
      }, {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
      });
    };

    const viewport = {
      width: canvasRef.current.clientWidth,
      height: canvasRef.current.clientHeight
    };

    // Calculate bounds including expanded messages
    const bounds = calculateExpandedBounds(nodes, expandedNodes);
    if (!bounds || bounds.minX === Infinity) return;

    // Add padding around the content
    const PADDING = 100;
    const contentWidth = bounds.maxX - bounds.minX + (PADDING * 2);
    const contentHeight = bounds.maxY - bounds.minY + (PADDING * 2);

    // Get chat container width
    const chatContainerWidth = getChatContainerWidth();

    // Calculate available canvas width (accounting for chat container)
    const availableWidth = viewport.width - chatContainerWidth;

    // Calculate ideal scale
    const scaleX = (availableWidth * 0.9) / contentWidth;
    const scaleY = (viewport.height * 0.9) / contentHeight;
    const newScale = Math.min(Math.min(scaleX, scaleY), 1);

    // Calculate center position
    const centerX = bounds.minX + (contentWidth / 2);
    const centerY = bounds.minY + (contentHeight / 2);

    // Calculate translation to center the content
    const newTranslate = {
      x: (availableWidth / 2) - (centerX * newScale) + (PADDING * newScale),
      y: (viewport.height / 2) - (centerY * newScale) + (PADDING * newScale)
    };

    // Update viewport
    setScale(newScale);
    setTranslate(newTranslate);
  }, [nodes, expandedNodes, getChatContainerWidth]);

  const organizeNodesIntoStack = useCallback(() => {
    // Spacing constants
    const LEVEL_HORIZONTAL_SPACING = 500;
    const MESSAGE_VERTICAL_SPACING = 120; // Base spacing per message
    const BRANCH_VERTICAL_PADDING = 50;   // Extra padding between branch groups
    const INITIAL_OFFSET_X = 200;
    const INITIAL_OFFSET_Y = 100;

    // Find the root (main) node
    const rootNode = nodes.find(node => node.type === 'main');
    if (!rootNode) return;

    // Group branches by their parent message index
    const branchesByMessage = new Map();
    nodes.forEach(node => {
      if (node.type === 'branch' && node.parentId === rootNode.id) {
        const messageIndex = node.parentMessageIndex || 0;
        if (!branchesByMessage.has(messageIndex)) {
          branchesByMessage.set(messageIndex, []);
        }
        branchesByMessage.get(messageIndex).push(node);
      }
    });

    // Calculate vertical position based on message index
    const getMessageY = (messageIndex) => {
      return INITIAL_OFFSET_Y + (messageIndex * MESSAGE_VERTICAL_SPACING);
    };

    // Process nodes recursively to maintain hierarchy
    const processNode = (node, level, branchGroup = null) => {
      let x = INITIAL_OFFSET_X + (level * LEVEL_HORIZONTAL_SPACING);
      let y;

      if (node.type === 'main') {
        // Position main thread
        y = INITIAL_OFFSET_Y;
      } else {
        // Position branch based on parent message
        const messageY = getMessageY(node.parentMessageIndex);
        const branchesAtMessage = branchesByMessage.get(node.parentMessageIndex) || [];
        const branchIndex = branchesAtMessage.findIndex(b => b.id === node.id);

        // Add vertical offset based on branch position within message group
        y = messageY + (branchIndex * BRANCH_VERTICAL_PADDING);
      }

      // Update node position
      const updatedNode = {
        ...node,
        x,
        y
      };

      // Process child branches
      const childBranches = nodes.filter(n => n.parentId === node.id);
      const processedChildren = childBranches.map((child, index) => {
        return processNode(child, level + 1, {
          parentY: y,
          index,
          total: childBranches.length
        });
      });

      return {
        node: updatedNode,
        children: processedChildren
      };
    };

    // Process all nodes starting from root
    const processedStructure = processNode(rootNode, 0);

    // Flatten the processed structure back into an array
    const flattenStructure = (structure) => {
      const nodes = [structure.node];
      structure.children.forEach(child => {
        nodes.push(...flattenStructure(child));
      });
      return nodes;
    };

    const newNodes = flattenStructure(processedStructure);

    // Update nodes
    setNodes(newNodes);

    // Center view on the organized structure
    if (canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();

      // Calculate bounds
      const bounds = {
        minX: Math.min(...newNodes.map(n => n.x)),
        maxX: Math.max(...newNodes.map(n => n.x)),
        minY: Math.min(...newNodes.map(n => n.y)),
        maxY: Math.max(...newNodes.map(n => n.y))
      };

      // Calculate structure dimensions and center
      const structureWidth = bounds.maxX - bounds.minX + 800; // Add padding
      const structureHeight = bounds.maxY - bounds.minY + 400; // Add padding
      const structureCenterX = (bounds.minX + bounds.maxX) / 2;
      const structureCenterY = (bounds.minY + bounds.maxY) / 2;

      // Calculate ideal scale
      const scaleX = (canvasRect.width * 0.8) / structureWidth;
      const scaleY = (canvasRect.height * 0.8) / structureHeight;
      const newScale = Math.min(Math.min(scaleX, scaleY), 1);

      // Update viewport
      setScale(newScale);
      setTranslate({
        x: (canvasRect.width / 2) - (structureCenterX * newScale),
        y: (canvasRect.height / 2) - (structureCenterY * newScale)
      });
    }
  }, [nodes]);

  const NODE_WIDTH = 400;
  const NODE_HEADER_HEIGHT = 80;
  const MESSAGE_PADDING = 16;


  const getConnectionPoints = (sourceNode, targetNode, expandedNodes) => {
    const NODE_WIDTH = 400; // Adjust based on your node dimensions
    const NODE_HEIGHT = 80; // Header height or height of non-expanded node

    const isSourceExpanded = expandedNodes.has(sourceNode.id);
    const messageIndex = targetNode.parentMessageIndex || 0;

    // Calculate source point
    const sourceY = isSourceExpanded
      ? sourceNode.y + NODE_HEIGHT + (messageIndex * 120) // Adjust for expanded node
      : sourceNode.y + NODE_HEIGHT / 2; // Center for collapsed node
    const sourceX = sourceNode.x + NODE_WIDTH; // Right edge of the source node

    // Calculate target point
    const targetY = targetNode.y + NODE_HEIGHT / 2; // Center of the target node
    const targetX = targetNode.x; // Left edge of the target node

    return {
      x1: sourceX,
      y1: sourceY,
      x2: targetX,
      y2: targetY
    };
  };


  // Calculate the bounding box of all nodes
  const calculateNodesBounds = (nodes) => {
    if (!nodes.length) return null;

    return nodes.reduce((bounds, node) => {
      const nodeWidth = 256; // Fixed node width
      const nodeHeight = 100; // Base node height

      // Update bounds
      return {
        minX: Math.min(bounds.minX, node.x),
        maxX: Math.max(bounds.maxX, node.x + nodeWidth),
        minY: Math.min(bounds.minY, node.y),
        maxY: Math.max(bounds.maxY, node.y + nodeHeight)
      };
    }, {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    });
  };


  // Calculate the ideal scale to fit content
  const calculateIdealScale = (bounds, viewport, padding = 100) => {
    if (!bounds) return 1;

    const contentWidth = bounds.maxX - bounds.minX + padding * 2;
    const contentHeight = bounds.maxY - bounds.minY + padding * 2;

    // Get the current chat container width
    const chatContainerWidth = getChatContainerWidth(); // We'll create this function

    // Calculate scale based on both dimensions, accounting for chat container
    const scaleX = (viewport.width - chatContainerWidth) / contentWidth;
    const scaleY = viewport.height / contentHeight;

    // Use the smaller scale to ensure content fits
    return Math.min(Math.min(scaleX, scaleY), 1);
  };

  // Calculate the translation to center content
  const calculateCenteringTranslation = (bounds, viewport, scale, padding = 100) => {
    if (!bounds) return { x: 0, y: 0 };

    const contentWidth = (bounds.maxX - bounds.minX + padding * 2) * scale;
    const contentHeight = (bounds.maxY - bounds.minY + padding * 2) * scale;

    // Get the current chat container width
    const chatContainerWidth = getChatContainerWidth();

    // Calculate the available canvas width
    const availableWidth = viewport.width - chatContainerWidth;

    // Center horizontally in the available space, accounting for chat container
    const x = (availableWidth / 2) - (bounds.minX * scale) - (contentWidth / 2) + padding * scale;

    // Center vertically
    const y = (viewport.height / 2) - (bounds.minY * scale) - (contentHeight / 2) + padding * scale;

    return { x, y };
  };

  const getBezierPath = (points) => {
    const { x1, y1, x2, y2 } = points;

    const controlOffset = Math.abs(x2 - x1) * 0.4; // Adjust control point for smoother curve

    const cp1x = x1 + controlOffset; // Control point 1
    const cp1y = y1;
    const cp2x = x2 - controlOffset; // Control point 2
    const cp2y = y2;

    return `M ${x1},${y1} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
  };



  const Connection = ({ sourceNode, targetNode, expandedNodes }) => {
    if (!sourceNode || !targetNode) return null;

    // Get connection points with relative position info
    const points = getConnectionPoints(sourceNode, targetNode, expandedNodes);

    // Generate the path
    const path = getBezierPath(points);

    // Set opacity based on expansion state
    const opacity = expandedNodes.has(sourceNode.id) ? 1 : 0.5;

    return (
      <path
        d={path}
        className="stroke-primary dark:stroke-primary"
        style={{
          opacity,
          transition: 'all 0.2s ease-in-out'
        }}
        strokeWidth="2"
        fill="none"
      />
    );
  };

  // Helper function to calculate message offset (unchanged but included for completeness)

  const calculateMessageOffset = (messageIndex) => {
    const BASE_OFFSET = 80; // Header height
    const MESSAGE_HEIGHT = 120;
    const MESSAGE_PADDING = 16;
    return BASE_OFFSET + (messageIndex * (MESSAGE_HEIGHT + MESSAGE_PADDING));
  };

  const createBranch = (parentNode, template, nodes, messageIndex, position = null) => {
    const NODE_SPACING = 400; // Horizontal spacing between nodes
    const newId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 1;
    const contextMessages = parentNode.messages.slice(0, messageIndex + 1);

    // Calculate optimal position if not provided
    const defaultPosition = {
      x: position?.x ?? parentNode.x + NODE_SPACING,
      y: position?.y ?? parentNode.y + calculateMessageOffset(messageIndex)
    };

    // Adjust position to prevent overlap with existing nodes
    const adjustedPosition = adjustNodePosition(defaultPosition, nodes, NODE_SPACING);

    return {
      id: newId,
      messages: [parentNode.messages[messageIndex]],
      x: adjustedPosition.x,
      y: adjustedPosition.y,
      type: 'branch',
      title: template.title || `Branch ${newId}`,
      parentId: parentNode.id,
      systemPrompt: template.systemPrompt,
      collapsed: true,
      parentMessageIndex: messageIndex,
      contextMessages: contextMessages
    };
  };

  const adjustNodePosition = (position, nodes, spacing) => {
    const OVERLAP_THRESHOLD = spacing / 2;
    let adjustedPosition = { ...position };
    let hasOverlap;

    do {
      hasOverlap = false;
      for (const node of nodes) {
        const distance = Math.sqrt(
          Math.pow(node.x - adjustedPosition.x, 2) +
          Math.pow(node.y - adjustedPosition.y, 2)
        );

        if (distance < OVERLAP_THRESHOLD) {
          hasOverlap = true;
          // Shift position diagonally
          adjustedPosition.x += spacing / 2;
          adjustedPosition.y += spacing / 4;
          break;
        }
      }
    } while (hasOverlap);

    return adjustedPosition;
  };


  const handleSelect = (nodeId) => {
    setSelectedNode(nodeId);
    setActiveThreadId(nodeId);
  };

  const getConnectedBranches = (nodeId, messageIndex) => {
    const currentNode = nodes.find(n => n.id === nodeId);
    if (!currentNode) return { left: [], right: [], parent: null };

    // Get parent info
    const parent = currentNode.parentId ? nodes.find(n => n.id === currentNode.parentId) : null;
    const parentPosition = parent ? getNodePosition(currentNode, parent) : null;

    // Get all child branches at current message
    const children = nodes.filter(n =>
      n.parentId === currentNode.id &&
      n.parentMessageIndex === messageIndex
    );

    // Sort children by x position
    const leftBranches = children.filter(n => n.x < currentNode.x)
      .sort((a, b) => b.x - a.x); // Sort from closest to furthest
    const rightBranches = children.filter(n => n.x >= currentNode.x)
      .sort((a, b) => a.x - b.x); // Sort from closest to furthest

    return {
      left: leftBranches,
      right: rightBranches,
      parent: parent ? { node: parent, position: parentPosition } : null
    };
  };

  const handleNavigation = useCallback((direction) => {
    const currentNode = nodes.find(n => n.id === selectedNode);
    if (!currentNode) return;

    const branches = getConnectedBranches(selectedNode, focusedMessageIndex);
    const siblingBranches = getSiblingBranches(selectedNode);

    switch (direction) {
      case 'up': {
        if (focusedMessageIndex > 0) {
          // Regular message navigation
          focusOnMessage(selectedNode, focusedMessageIndex - 1);
        } else {
          // Try to find a sibling branch above
          const siblingAbove = siblingBranches.reverse().find(n => n.y < currentNode.y);
          if (siblingAbove) {
            // Jump to the last message of the sibling branch above
            const siblingMessages = siblingAbove.messages.length;
            focusOnMessage(siblingAbove.id, Math.max(0, siblingMessages - 1));
          }
        }
        break;
      }

      case 'down': {
        if (focusedMessageIndex < currentNode.messages.length - 1) {
          // Regular message navigation
          focusOnMessage(selectedNode, focusedMessageIndex + 1);
        } else {
          // Try to find a sibling branch below
          const siblingBelow = siblingBranches.find(n => n.y > currentNode.y);
          if (siblingBelow) {
            // Jump to the first message of the sibling branch below
            focusOnMessage(siblingBelow.id, 0);
          }
        }
        break;
      }

      case 'left': {
        if (branches.parent?.position === 'left') {
          focusOnMessage(branches.parent.node.id, currentNode.parentMessageIndex);
        } else if (branches.left.length > 0) {
          const currentIndex = branches.left.findIndex(n => n.id === selectedNode);
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % branches.left.length;
          focusOnMessage(branches.left[nextIndex].id, 0);
        }
        break;
      }

      case 'right': {
        if (branches.parent?.position === 'right') {
          focusOnMessage(branches.parent.node.id, currentNode.parentMessageIndex);
        } else if (branches.right.length > 0) {
          const currentIndex = branches.right.findIndex(n => n.id === selectedNode);
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % branches.right.length;
          focusOnMessage(branches.right[nextIndex].id, 0);
        }
        break;
      }
    }
  }, [nodes, selectedNode, focusedMessageIndex, focusOnMessage, getConnectedBranches, getSiblingBranches]);


  // Add this useEffect for the keyboard listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only show quick input if user is not already typing somewhere
      const isTyping = document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.closest('.chat-interface');

      if (isTyping) return;

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        setQuickInputPosition({ x: e.clientX, y: e.clientY });
        setShowQuickInput(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA') return;

      if (!selectedNode) return;

      const currentNode = nodes.find(n => n.id === selectedNode);
      if (!currentNode) return;

      const isShiftPressed = e.shiftKey;
      const branches = getConnectedBranches(selectedNode, focusedMessageIndex);
      const siblingBranches = getSiblingBranches(selectedNode);

      switch (e.key.toLowerCase()) {
        case 'w': {
          if (focusedMessageIndex > 0) {
            focusOnMessage(selectedNode, focusedMessageIndex - 1, isShiftPressed);
          } else {
            const siblingAbove = siblingBranches.reverse().find(n => n.y < currentNode.y);
            if (siblingAbove) {
              const siblingMessages = siblingAbove.messages.length;
              focusOnMessage(siblingAbove.id, Math.max(0, siblingMessages - 1), isShiftPressed);
            }
          }
          break;
        }

        case 's': {
          if (focusedMessageIndex < currentNode.messages.length - 1) {
            focusOnMessage(selectedNode, focusedMessageIndex + 1, isShiftPressed);
          } else {
            const siblingBelow = siblingBranches.find(n => n.y > currentNode.y);
            if (siblingBelow) {
              focusOnMessage(siblingBelow.id, 0, isShiftPressed);
            }
          }
          break;
        }

        case 'a': {
          if (branches.parent?.position === 'left') {
            focusOnMessage(branches.parent.node.id, currentNode.parentMessageIndex, isShiftPressed);
          } else if (branches.left.length > 0) {
            const currentIndex = branches.left.findIndex(n => n.id === selectedNode);
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % branches.left.length;
            focusOnMessage(branches.left[nextIndex].id, 0, isShiftPressed);
          }
          break;
        }

        case 'd': {
          if (branches.parent?.position === 'right') {
            focusOnMessage(branches.parent.node.id, currentNode.parentMessageIndex, isShiftPressed);
          } else if (branches.right.length > 0) {
            const currentIndex = branches.right.findIndex(n => n.id === selectedNode);
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % branches.right.length;
            focusOnMessage(branches.right[nextIndex].id, 0, isShiftPressed);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, focusedMessageIndex, nodes, focusOnMessage, getConnectedBranches, getSiblingBranches]);

  const getNodePosition = (sourceNode, targetNode) => {
    return targetNode.x < sourceNode.x ? 'left' : 'right';
  };


  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if the active element is a text input or textarea
      const isTyping = document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA';

      // If user is typing in an input field, only handle shortcuts with modifier keys
      if (isTyping && !e.ctrlKey && !e.metaKey) {
        return;
      }

      // Handle all keyboard shortcuts in one place
      switch (e.key.toLowerCase()) {
        case 'c':
          centerCanvas();
          break;
        case 'o':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault(); // Prevent saving
            organizeNodesIntoStack();
          }
          break;
        case 'g':
          setActiveTool('select');
          break;
        case 'h':
          setActiveTool('pan');
          break;
        case 's':
          setActiveTool('select');
          break;
        case ' ':
          if (activeTool === 'pan') {
            setActiveTool('pan');
          }
          break;
      }
    };


    const handleKeyUp = (e) => {
      // Only handle space key for pan tool when not typing
      const isTyping = document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA';

      if (!isTyping && e.key === ' ' && activeTool === 'pan') {
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [centerCanvas, organizeNodesIntoStack, activeTool, isModelDropdownOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Add the wheel event listener with passive: false to allow preventDefault
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel, { passive: false });
    };
  }, [handleWheel]);

  const handleToggleExpand = useCallback((nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragState.isDragging) {
        handleDrag(e);
      } else if (isPanning) {
        const dx = (e.clientX - lastMousePos.x) * PANNING_SENSITIVITY;
        const dy = (e.clientY - lastMousePos.y) * PANNING_SENSITIVITY;

        setTranslate(prev => ({
          x: prev.x + dx,
          y: prev.y + dy
        }));

        setLastMousePos({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      if (dragState.isDragging) {
        handleDragEnd();
      }
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, isPanning, handleDrag, handleDragEnd, lastMousePos]);


  return (
    <div className="relative flex h-full bg-background overflow-hidden">
      {/* Canvas Area with Grid and Interactions */}
      <div
        ref={canvasRef}
        className={cn(
          "absolute inset-0 overflow-hidden select-none",
          isPanning ? "cursor-grabbing" : activeTool === "pan" ? "cursor-grab" : "cursor-default"
        )}
        onMouseDown={handleCanvasMouseDown}
        style={{ touchAction: 'none' }}
      >
        {/* Background Grid */}
        <GridBackground
          translate={translate}
          scale={scale}
          className="stroke-border dark:stroke-border"
        />

        {/* Toolbar - Fixed with Dynamic Positioning */}
        <div
          className="fixed bottom-20 z-10"
          style={{
            left: isPanelCollapsed ? '1rem' : 'calc(20vw + 1rem)'
          }}
        >
          <CanvasToolbar
            activeTool={activeTool}
            onToolSelect={handleToolSelect}
            theme={theme}
            onThemeChange={handleThemeChange}
            selectedModel={selectedModel}
            models={models}
            onModelSelect={setSelectedModel}
            isModelDropdownOpen={isModelDropdownOpen}
            setIsModelDropdownOpen={setIsModelDropdownOpen}
            modelDropdownRef={modelDropdownRef}
          />
        </div>

        {/* Bottom Navigation Bar - Fixed with Dynamic Positioning */}
        <div
          className="fixed bottom-1 mx-2 z-10 flex gap-2 right: 10px width: -webkit-fill-available justify-content: space-around"
          style={{
            left: isPanelCollapsed ? '1rem' : 'calc(20vw + 1rem)'
          }}
        >
          <MessageNavigator
            currentNode={nodes.find(n => n.id === selectedNode)}
            currentIndex={focusedMessageIndex}
            totalMessages={nodes.find(n => n.id === selectedNode)?.messages.length || 0}
            onNavigate={handleNavigation}
            branches={getConnectedBranches(selectedNode, focusedMessageIndex)}
            isMessageExpanded={expandedMessages.has(focusedMessageIndex)}
            onToggleExpand={handleToggleMessageExpand}
          />
        </div>

        {/* Canvas Content - Nodes and Connections */}
        <div ref={contentRef}
          className="absolute inset-0 z-0"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* SVG Layer for Connections */}
          <svg
            className="absolute"
            style={{
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: 'none'
            }}
          >
            {nodes.map((node) => {
              if (!node.parentId) return null;
              const parent = nodes.find(n => n.id === node.parentId);
              if (!parent) return null;
              return (
                <Connection
                  key={`connection-${parent.id}-${node.id}`}
                  sourceNode={parent}
                  targetNode={node}
                  expandedNodes={expandedNodes}
                />
              );
            })}
          </svg>

          {/* Node Components */}
          {nodes.map((node) => (
            <BranchNode
              key={`node-${node.id}-${node.branchId || '0'}`}
              node={node}
              nodes={nodes}
              isExpanded={expandedNodes.has(node.id)}
              isSelected={selectedNode === node.id}
              onToggleExpand={() => handleToggleExpand(node.id)}
              onSelect={() => handleSelect(node.id)}
              onDelete={() => handleDeleteNode(node.id)}
              onDragStart={handleDragStart}
              onCreateBranch={onCreateBranch}
              selectedModel={selectedModel}
              currentMessageIndex={node.id === selectedNode ? focusedMessageIndex : null}
              branchId={node.branchId}
              expandedMessages={expandedMessages}
              onToggleMessageExpand={handleToggleMessageExpand}
              onUpdateTitle={handleUpdateTitle}
              isActiveThread={node.id === activeThreadId}
              style={{
                position: 'absolute',
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: '400px',
                zIndex: selectedNode === node.id ? 10 : 1
              }}
            />
          ))}

        </div>
      </div>

      {/* Chat Sidebar */}
      <ChatContainer
        size={chatContainerSize}
        onSizeChange={setChatContainerSize}
      >
        <ModelStatus
          selectedModel={selectedModel}
          isLoading={isLoading}
          temperature={temperature}
          onTemperatureChange={setTemperature}
          models={models}
          onModelSelect={setSelectedModel}
          containerWidth={containerWidth}
        />
        {selectedNode && (
          <ChatInterface
            messages={getFullMessageHistory(selectedNode)}
            input={inputValue}
            isLoading={isLoading}
            onInputChange={handleInputChange}
            onSend={handleSendMessage}
            streamingMessage={streamingMessage}
            continuationCount={continuationCount}
            activeNode={nodes.find(n => n.id === selectedNode)}
            expandedMessages={expandedMessages} // Add this prop
            onToggleMessageExpand={handleToggleMessageExpand} // Add this prop
          />
        )}
      </ChatContainer>

      <FloatingInput
        show={showQuickInput}
        onClose={() => setShowQuickInput(false)}
        onSend={handleFloatingInputSend}
        isLoading={activeResponses.has(selectedNode)}
        position={quickInputPosition}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        allowParallel={true}
        style={{
          position: contentHeight > window.innerHeight ? 'fixed' : 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)'
        }}
      />
    </div>
  );
};

export default TangentChat;