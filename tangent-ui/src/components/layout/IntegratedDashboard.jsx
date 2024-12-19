import React, { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../core/tabs";
import {
  Share2,
  Download,
  ArrowLeft,
  Plus,
  Bot,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import ChatPersistenceManager from "../chat/ChatPersistanceManager";
import FileUploader from "../forms/FileUploader";
import { Button } from "../core/button";
import ModelsModal from "../overlay/ModelsModal";
import { ThemeToggle } from "../shared/ThemeToggle";
import { ScrollArea } from "../core/scroll-area";
import TangentLogo from "../shared/TangentLogo";
import { Sparkles, ChartBarIcon, Text } from "lucide-react";
import ExploreTab from "./ExploreTab";
import TopicsPanel from "../visualization/TopicsPanel";
import MainDashboard from "../visualization/MainDashboard";
import TangentChat from "../chat/TangentChat";
import { useVisualization } from "../providers/VisualizationProvider";

const SharedHeader = ({
  handleRefresh,
  theme,
  setTheme,
  onNewThread,
  onManageModels,
  isPanelCollapsed,
  onPanelToggle,
  nodes,
  setNodes,
  activeChat,
  setActiveChat,
}) => {
  return (
    <header
      className={`${
        isPanelCollapsed ? "w-screen" : "w-[80vw]"
      } h-16 bg-background border border-border ${
        isPanelCollapsed ? "left-0" : "left-[20vw]"
      } z-[100] flex items-center px-6 transition-all duration-300`}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={onPanelToggle}
        className="h-9 w-9 border-border"
      >
        {isPanelCollapsed ? (
          <PanelLeft className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </Button>

      <div className="absolute left-0 w-full flex justify-center pointer-events-none">
        <TangentLogo className="h-6 w-auto" />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button variant="outline" size="icon" className="h-9 w-9 border-border">
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onManageModels}
          className="h-9 w-9 border-border"
        >
          <Bot className="h-4 w-4" />
        </Button>
        <FileUploader
          onProcessingComplete={handleRefresh}
          buttonProps={{
            variant: "outline",
            size: "icon",
            className: "h-9 w-9",
          }}
        />
        <Button variant="outline" size="icon" className="h-9 w-9 border-border">
          <Share2 className="h-4 w-4" />
        </Button>
        <Button
          onClick={onNewThread}
          variant="default"
          size="icon"
          className="h-9 w-9 bg-primary"
        >
          <Plus className="h-4 w-4" />
        </Button>

        <ChatPersistenceManager
          nodes={nodes}
          onLoadChat={setNodes}
          activeChat={activeChat}
          setActiveChat={setActiveChat}
        />
      </div>
    </header>
  );
};

export const SharedHeaderWrapper = ({ onNewThread, onManageModels }) => {
  const { handleRefresh, theme, setTheme, view, setView } = useVisualization();
  const [lastConversation, setLastConversation] = useState(null);

  const handleBack = useCallback(
    (conversation = null) => {
      if (conversation) {
        setView("conversation");
        setLastConversation(conversation);
      } else {
        setView("clusters");
      }
    },
    [setView]
  );

  return (
    <SharedHeader
      handleRefresh={handleRefresh}
      theme={theme}
      setTheme={setTheme}
      currentView={view}
      handleBack={handleBack}
      onNewThread={onNewThread}
      lastConversation={lastConversation}
      onManageModels={onManageModels}
    />
  );
};

export const IntegratedDashboard = () => {
  const [selectedNodePosition, setSelectedNodePosition] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [view, setView] = useState("clusters");
  const [lastThread, setLastThread] = useState(null);
  const { handleRefresh, theme, setTheme } = useVisualization();
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true);
  const [showQuickInput, setShowQuickInput] = useState(true);
  // Models state management
  const [showModelsModal, setShowModelsModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [localModels, setLocalModels] = useState([]);
  const [runningModels, setRunningModels] = useState([]);
  const [modelInfo, setModelInfo] = useState(null);
  const [pullModelName, setPullModelName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState("");
  const [detailedView, setDetailedView] = useState(false);

  const [nodes, setNodes] = useState([
    {
      id: 1,
      messages: [],
      x: window.innerWidth / 2 - 200,
      y: 100,
      type: "main",
      title: "Main Thread",
      branchId: "0",
    },
  ]);

  const [activeChat, setActiveChat] = useState(null);

  // Add these state declarations at the top with other states
  const [sortBy, setSortBy] = useState("relevance");
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [data, setData] = useState(null);

  // Add this function with other handlers
  const handleTopicSelect = (clusterId) => {
    setSelectedCluster(parseInt(clusterId));
  };

  // Add this function to match what's used in MainDashboard
  function getColor(index) {
    const colors = [
      "#60A5FA",
      "#F87171",
      "#34D399",
      "#FBBF24",
      "#A78BFA",
      "#F472B6",
      "#FB923C",
      "#2DD4BF",
      "#4ADE80",
      "#A3E635",
      "#38BDF8",
      "#FB7185",
      "#818CF8",
      "#C084FC",
      "#E879F9",
      "#22D3EE",
      "#F43F5E",
      "#10B981",
      "#6366F1",
      "#8B5CF6",
    ];
    return colors[index % colors.length];
  }

  const handleModelClick = async (modelName) => {
    try {
      const response = await fetch("http://localhost:11434/api/show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName }),
      });
      const data = await response.json();
      setSelectedModel(modelName);
      setModelInfo(data);
    } catch (error) {
      console.error("Error fetching model info:", error);
    }
  };

  const handleDeleteModel = async (modelName) => {
    if (
      !window.confirm(`Are you sure you want to delete model "${modelName}"?`)
    )
      return;
    try {
      await fetch("http://localhost:11434/api/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName }),
      });
      const response = await fetch("http://localhost:11434/api/tags");
      const data = await response.json();
      setLocalModels(data.models);
    } catch (error) {
      console.error("Error deleting model:", error);
    }
  };

  const handlePullModel = async () => {
    if (!pullModelName.trim()) {
      alert("Please enter a model name");
      return;
    }
    setIsPulling(true);
    setPullStatus("Starting download...");
    try {
      const response = await fetch("http://localhost:11434/api/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: pullModelName.trim(), stream: false }),
      });
      if (!response.ok) throw new Error("Failed to pull model");
      setPullStatus("Model downloaded successfully");
      setPullModelName("");
      const tagsResponse = await fetch("http://localhost:11434/api/tags");
      const data = await tagsResponse.json();
      setLocalModels(data.models);
    } catch (error) {
      console.error("Error pulling model:", error);
      setPullStatus(`Error: ${error.message}`);
    } finally {
      setIsPulling(false);
    }
  };

  const handleManageModels = useCallback(() => {
    setShowModelsModal(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!nodes.length) return;

    try {
      const chatData = {
        chatId: activeChat?.id || undefined,
        nodes,
        title: activeChat?.title || "Untitled Chat",
        metadata: {
          nodeCount: nodes.length,
          messageCount: nodes.reduce(
            (acc, node) => acc + node.messages.length,
            0
          ),
        },
      };

      const response = await axios.post(
        "http://localhost:5001/api/chats/save",
        chatData
      );
      if (response.data.success) {
        setActiveChat({
          id: response.data.chatId,
          title: chatData.title,
        });
      }
    } catch (error) {
      console.error("Error saving chat:", error);
    }
  }, [nodes, activeChat]);

  const handleNewThread = useCallback(() => {
    const newConversation = [
      {
        id: Date.now(),
        messages: [],
        type: "main",
        title: "Main Thread",
        x: window.innerWidth / 4,
        y: window.innerHeight / 3,
        branchId: "0",
      },
      {
        id: Date.now() + 1,
        messages: [],
        type: "branch",
        title: "New Thread",
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        parentId: Date.now(),
        systemPrompt: "",
        parentMessageIndex: 0,
        branchId: "0.0",
      },
    ];
    setSelectedConversation(newConversation);
    setLastThread(newConversation);
    setSelectedNodePosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    setView("conversation");
  }, []);

  useEffect(() => {
    const handleOpenConversation = (event) => {
      const { nodes, position } = event.detail;
      setSelectedConversation(nodes);
      setLastThread(nodes);
      setSelectedNodePosition(position);
      setView("conversation");
    };

    window.addEventListener("openConversation", handleOpenConversation);

    return () => {
      window.removeEventListener("openConversation", handleOpenConversation);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping =
        document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA";

      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "s" &&
        !isTyping
      ) {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5001/api/visualization");
        const responseData = await response.json();
        const chatsWithReflections = new Set(
          responseData.chats_with_reflections
        );

        if (responseData.length > 0) {
          const chartData = [
            {
              id: "points",
              data: responseData.points.map((point, i) => ({
                x: point[0],
                y: point[1],
                cluster: responseData.clusters[i],
                title: responseData.titles[i],
                hasReflection: chatsWithReflections.has(responseData.titles[i]),
              })),
            },
          ];

          setData({
            chartData,
            topics: responseData.topics,
          });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  const handleTopicConversationSelect = async (chat) => {
    try {
      const baseTitle = chat.title.replace(/ \(Branch \d+\)$/, "");

      // Get the branched data
      const response = await fetch(
        `http://127.0.0.1:5001/api/messages_all/${encodeURIComponent(
          baseTitle
        )}?type=claude`
      );
      const messageData = await response.json();

      if (!messageData || !messageData.branches) {
        console.error("Failed to fetch conversation data");
        return;
      }

      // Build nodes structure for TangentChat
      const nodes = buildConversationNodes(messageData, baseTitle);
      console.log("Processed nodes:", nodes);

      if (!nodes || nodes.length === 0) {
        console.error("No valid nodes created from message data");
        return;
      }

      // Calculate center position for positioning the nodes
      const clickPosition = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };

      // Update the conversation state and view
      setSelectedConversation(nodes);
      setLastThread(nodes);
      setSelectedNodePosition(clickPosition);
      setView("conversation");
    } catch (error) {
      console.error("Error in conversation click handler:", error);
    }
  };

  // Helper function to build conversation nodes
  const buildConversationNodes = (responseData, chatTitle) => {
    if (!responseData || !responseData.branches) {
      console.error("Invalid response data structure");
      return [];
    }

    const nodes = [];
    const messageToNodeMap = new Map();
    let nodeIdCounter = 1;

    // First create the main thread (branch '0')
    const mainBranch = responseData.branches["0"];
    if (mainBranch) {
      const mainNode = {
        id: nodeIdCounter++,
        title: chatTitle,
        messages: mainBranch.map((msg) => ({
          role: msg.sender === "human" ? "user" : "assistant",
          content: msg.text,
          messageId: msg.message_id,
        })),
        type: "main",
        branchId: "0",
        x: window.innerWidth / 4,
        y: window.innerHeight / 3,
      };
      nodes.push(mainNode);
      mainBranch.forEach((msg) =>
        messageToNodeMap.set(msg.message_id, mainNode.id)
      );
    }

    // Then create all branch nodes
    Object.entries(responseData.branches).forEach(([branchId, messages]) => {
      if (branchId === "0") return; // Skip main thread

      const firstMessage = messages[0];
      if (!firstMessage?.parent_message_id) return;

      const parentNodeId = messageToNodeMap.get(firstMessage.parent_message_id);
      const parentNode = nodes.find((n) => n.id === parentNodeId);

      if (!parentNode) {
        console.warn(`Parent node not found for branch ${branchId}`);
        return;
      }

      const parentMessageIndex = parentNode.messages.findIndex(
        (msg) => msg.messageId === firstMessage.parent_message_id
      );

      const branchNode = {
        id: nodeIdCounter++,
        title: `${chatTitle} (Branch ${branchId})`,
        messages: messages.map((msg) => ({
          role: msg.sender === "human" ? "user" : "assistant",
          content: msg.text,
          messageId: msg.message_id,
        })),
        type: "branch",
        parentId: parentNodeId,
        parentMessageIndex: parentMessageIndex >= 0 ? parentMessageIndex : 0,
        branchId: branchId,
        x: parentNode.x + 300,
        y: parentNode.y + parentMessageIndex * 50,
        // Add context messages for the branch
        contextMessages: [
          ...parentNode.messages.slice(0, parentMessageIndex + 1),
          ...messages.map((msg) => ({
            role: msg.sender === "human" ? "user" : "assistant",
            content: msg.text,
            messageId: msg.message_id,
          })),
        ],
      };

      nodes.push(branchNode);
      messages.forEach((msg) =>
        messageToNodeMap.set(msg.message_id, branchNode.id)
      );
    });

    return nodes;
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Left Sidebar */}
      {!isPanelCollapsed && (
        <div className="fixed top-0 left-0 w-[20vw] h-full py-2 border-r border-border flex flex-col transition-all duration-300">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col"
          >
            <div className="px-4 py-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dashboard" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Map
                </TabsTrigger>
                <TabsTrigger value="explore" className="gap-2">
                  <ChartBarIcon className="h-4 w-4" />
                  Explore
                </TabsTrigger>
                <TabsTrigger value="topics" className="gap-2">
                  <Text className="h-4 w-4" />
                  Topics
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 p-4 overflow-hidden">
              <TabsContent
                value="dashboard"
                className="h-full m-0 overflow-hidden"
              >
                <MainDashboard />
              </TabsContent>
              <TabsContent value="explore" className="h-full m-0">
                <ScrollArea className="h-full">
                  <ExploreTab />
                </ScrollArea>
              </TabsContent>
              <TabsContent value="topics" className="h-full m-0">
                <ScrollArea className="h-full">
                  <TopicsPanel
                    data={data}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    selectedCluster={selectedCluster}
                    handleTopicSelect={handleTopicSelect}
                    getColor={getColor}
                    onConversationSelect={handleTopicConversationSelect}
                  />
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}

      {/* Right Content Area */}
      <div
        className={`${
          isPanelCollapsed ? "w-full" : "ml-[20vw] w-[80vw]"
        } flex flex-col transition-all duration-300`}
      >
        <SharedHeader
          handleRefresh={handleRefresh}
          theme={theme}
          setTheme={setTheme}
          currentView={view}
          handleBack={() => setView("clusters")}
          onNewThread={handleNewThread}
          lastConversation={lastThread}
          onManageModels={handleManageModels}
          isPanelCollapsed={isPanelCollapsed}
          onPanelToggle={() => setIsPanelCollapsed(!isPanelCollapsed)}
          nodes={nodes}
          setNodes={setNodes}
          activeChat={activeChat}
          setActiveChat={setActiveChat}
        />

        <ModelsModal
          isOpen={showModelsModal}
          onClose={() => setShowModelsModal(false)}
          models={localModels}
          runningModels={runningModels}
          detailedView={detailedView}
          setDetailedView={setDetailedView}
          onModelClick={handleModelClick}
          onDeleteModel={handleDeleteModel}
          pullModelName={pullModelName}
          setPullModelName={setPullModelName}
          isPulling={isPulling}
          onPullModel={handlePullModel}
          pullStatus={pullStatus}
          modelInfo={modelInfo}
          selectedModel={selectedModel}
        />

        <div className="flex-1 overflow-hidden">
          <TangentChat
            initialConversation={selectedConversation}
            isPanelCollapsed={isPanelCollapsed}
            nodes={nodes}
            setNodes={setNodes}
            activeChat={activeChat}
            setActiveChat={setActiveChat}
          />
        </div>
      </div>
    </div>
  );
};

export default IntegratedDashboard;
