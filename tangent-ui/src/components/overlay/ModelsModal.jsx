import {
  motion,
  AnimatePresence,
} from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  X,
  Bot,
  Terminal,
  Eye,
  Network,
  RefreshCw,
  Loader2,
  GripHorizontal,
  Plus,
  Copy,
  Upload,
  Cpu,
  Search,
  AlertCircle,
} from "lucide-react";
import {
  CardTitle,
  CardContent,
  Button,
  ScrollArea,
  Badge,
  Input,
  Separator,
  Textarea,
} from "../index";
import { Alert, AlertDescription } from "../core/alert";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../core/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../core/tabs";
import { Card, CardHeader } from "../core/card";
import { ModelCard } from "../core/ModelCard";
import { cn } from "../../utils/utils";

const ModelsModal = ({
  isOpen,
  onClose,
  models,
  runningModels,
  detailedView,
  setDetailedView,
  onModelClick,
  onDeleteModel,
  pullModelName,
  setPullModelName,
  isPulling,
  onPullModel,
  pullStatus,
  onCreateModel,
  isCreating,
  createStatus,
  onCopyModel,
  isCopying,
  copyStatus,
  onPushModel,
  isPushing,
  pushStatus,
  onGenerateEmbeddings,
  isEmbedding,
  embeddingStatus,
}) => {
  const [activeTab, setActiveTab] = useState("local");
  const [libraryModels, setLibraryModels] = useState([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [modelTypeFilter, setModelTypeFilter] = useState("all");
  const [error, setError] = useState("");
  const [copySourceModel, setCopySourceModel] = useState("");
  const [copyDestinationModel, setCopyDestinationModel] = useState("");
  const [embeddingModelName, setEmbeddingModelName] = useState("");
  const [embeddingInput, setEmbeddingInput] = useState("");
  const [createModelName, setCreateModelName] = useState("");
  const [createModelFile, setCreateModelFile] = useState("");
  const [pushModelName, setPushModelName] = useState("");

  const handleDragEnd = (event, info) => {
    const threshold = window.innerHeight * 0.3;
    if (info.offset.y > threshold) {
      onClose();
    }
  };

  const categorizeModels = (modelsList) => {
    return modelsList.reduce(
      (acc, model) => {
        if (model.architecture === "bert" || model.name.includes("minilm")) {
          acc.embeddings.push(model);
        } else if (
          model.architecture === "mllama" ||
          model.name.includes("vision")
        ) {
          acc.vision.push(model);
        } else {
          acc.text.push(model);
        }
        return acc;
      },
      { text: [], vision: [], embeddings: [] }
    );
  };

  const categorizedModels = categorizeModels(models || []);

  const fetchLibraryModels = async () => {
    setIsLoadingLibrary(true);
    setError("");
    try {
      const response = await fetch("http://127.0.0.1:5001/api/models/library");
      if (!response.ok)
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setLibraryModels(data.models || []);
    } catch (err) {
      console.error("Error fetching library models:", err);
      setError(err.message);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const handleCreateModel = () => {
    if (!createModelName || !createModelFile) {
      alert("Please provide both model name and modelfile content");
      return;
    }
    onCreateModel(createModelName, createModelFile);
  };

  const handleCopyModel = () => {
    if (!copySourceModel || !copyDestinationModel) {
      alert("Please provide both source and destination model names");
      return;
    }
    onCopyModel(copySourceModel, copyDestinationModel);
  };

  const handlePushModel = () => {
    if (!pushModelName) {
      alert("Please provide a model name");
      return;
    }
    onPushModel(pushModelName);
  };

  const handleGenerateEmbeddings = () => {
    if (!embeddingModelName || !embeddingInput) {
      alert("Please provide both model name and input text");
      return;
    }
    onGenerateEmbeddings(embeddingModelName, embeddingInput);
  };

  useEffect(() => {
    if (isOpen && activeTab === "library") {
      fetchLibraryModels();
    }
  }, [isOpen, activeTab]);

  const filterModels = (modelsList) => {
    return modelsList.filter((model) => {
      const matchesSearch = model.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesType =
        modelTypeFilter === "all" || model.type === modelTypeFilter;
      return matchesSearch && matchesType;
    });
  };

  const filteredLibraryModels = filterModels(libraryModels);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="modal-backdrop"
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            key="modal-wrapper"
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              key="modal-content"
              className="relative w-full pointer-events-auto"
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.3}
              dragMomentum={false}
              onDragEnd={handleDragEnd}
              initial={{ y: window.innerHeight }}
              animate={{ y: 0 }}
              exit={{ y: window.innerHeight }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 200,
                mass: 0.8,
              }}
            >
              <div className="bg-background border-t rounded-t-xl shadow-2xl max-h-[85vh] overflow-hidden">
                <div className="group flex justify-center py-2 cursor-grab active:cursor-grabbing">
                  <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full transition-colors group-hover:bg-muted-foreground/40" />
                </div>
                <div className="container max-w-6xl mx-auto pb-6 px-4">
                  <CardHeader className="flex items-center justify-between pb-3">
                    <div className="flex items-center gap-2 text-foreground">
                      <Bot className="h-5 w-5" />
                      <CardTitle>Model Management</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDetailedView(!detailedView)}
                        className="h-8 w-8 text-foreground"
                      >
                        <GripHorizontal className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="local">Local Models</TabsTrigger>
                        <TabsTrigger value="library">Model Library</TabsTrigger>
                        <TabsTrigger value="management">Management</TabsTrigger>
                      </TabsList>
                      <TabsContent value="local" className="mt-0">
                        <ScrollArea className="h-[calc(85vh-250px)]">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Text Models Section */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-foreground">
                                <Terminal className="h-4 w-4" />
                                <h3 className="text-sm font-medium">Text Models</h3>
                                <Badge variant="outline" className="ml-auto">
                                  {models.filter(m => !m.name.includes('vision') && !m.name.includes('minilm')).length}
                                </Badge>
                              </div>
                              <div className="space-y-4">
                                {models
                                  .filter(m => !m.name.includes('vision') && !m.name.includes('minilm'))
                                  .map((model) => (
                                    <ModelCard
                                      key={model.name}
                                      model={model}
                                      modelType="text"
                                      detailedView={detailedView}
                                      onInfoClick={onModelClick}
                                      onDeleteClick={onDeleteModel}
                                      isRunning={runningModels.some(m => m.name === model.name)}
                                    />
                                  ))}
                              </div>
                            </div>

                            {/* Vision Models Section */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-foreground">
                                <Eye className="h-4 w-4" />
                                <h3 className="text-sm font-medium">Vision Models</h3>
                                <Badge variant="outline" className="ml-auto">
                                  {models.filter(m => m.name.includes('vision')).length}
                                </Badge>
                              </div>
                              <div className="space-y-4">
                                {models
                                  .filter(m => m.name.includes('vision'))
                                  .map((model) => (
                                    <ModelCard
                                      key={model.name}
                                      model={model}
                                      modelType="vision"
                                      detailedView={detailedView}
                                      onInfoClick={onModelClick}
                                      onDeleteClick={onDeleteModel}
                                      isRunning={runningModels.some(m => m.name === model.name)}
                                    />
                                  ))}
                              </div>
                            </div>

                            {/* Embedding Models Section */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-foreground">
                                <Network className="h-4 w-4" />
                                <h3 className="text-sm font-medium">Embedding Models</h3>
                                <Badge variant="outline" className="ml-auto">
                                  {models.filter(m => m.name.includes('minilm')).length}
                                </Badge>
                              </div>
                              <div className="space-y-4">
                                {models
                                  .filter(m => m.name.includes('minilm'))
                                  .map((model) => (
                                    <ModelCard
                                      key={model.name}
                                      model={model}
                                      modelType="embedding"
                                      detailedView={detailedView}
                                      onInfoClick={onModelClick}
                                      onDeleteClick={onDeleteModel}
                                      isRunning={runningModels.some(m => m.name === model.name)}
                                    />
                                  ))}
                              </div>
                            </div>
                          </div>
                        </ScrollArea>
                      </TabsContent>
                      <TabsContent value="library" className="mt-0">
                        <div className="space-y-6">
                          <div className="flex gap-4">
                            <div className="flex-1 relative">
                              <Input
                                placeholder="Search models..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10"
                              />
                              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                            </div>
                            <Select
                              value={modelTypeFilter}
                              onValueChange={setModelTypeFilter}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="text">Text Models</SelectItem>
                                <SelectItem value="vision">Vision Models</SelectItem>
                                <SelectItem value="embedding">Embedding Models</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              onClick={fetchLibraryModels}
                              disabled={isLoadingLibrary}
                            >
                              <RefreshCw
                                className={cn(
                                  "h-4 w-4 mr-2",
                                  isLoadingLibrary && "animate-spin"
                                )}
                              />
                              Refresh
                            </Button>
                          </div>

                          {error && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>{error}</AlertDescription>
                            </Alert>
                          )}

                          <ScrollArea className="h-[calc(85vh-250px)]">
                            {isLoadingLibrary ? (
                              <div className="flex items-center justify-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                              </div>
                            ) : filteredLibraryModels.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredLibraryModels.map((model) => (
                                  <ModelCard
                                    key={model.name}
                                    model={{
                                      ...model,
                                      size: "N/A",
                                      details: {
                                        parameter_size: "N/A",
                                        quantization_level: "N/A",
                                      },
                                    }}
                                    modelType={model.type}
                                    detailedView={true}
                                    onPullClick={() => onPullModel(model.name)}
                                    isLibraryModel={true}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                <p>No models found</p>
                                {searchTerm && (
                                  <p className="text-sm">
                                    Try adjusting your search criteria
                                  </p>
                                )}
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      </TabsContent>
                      <TabsContent value="management" className="mt-0">
                        <ScrollArea className="h-[calc(85vh-250px)]">
                          <div className="space-y-6">
                            {/* Pull Model Section */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <RefreshCw className="h-4 w-4" />
                                <h3 className="text-sm font-medium">Pull a Model</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder="Model name (e.g., llama2)"
                                  value={pullModelName}
                                  onChange={(e) => setPullModelName(e.target.value)}
                                  className="flex-1"
                                />
                                <Button
                                  size="icon"
                                  onClick={() => onPullModel(pullModelName)}
                                  disabled={isPulling}
                                >
                                  {isPulling ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                              {pullStatus && (
                                <p className="text-sm text-muted-foreground">
                                  {pullStatus}
                                </p>
                              )}
                            </div>

                            {/* Create Model Section */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                <h3 className="text-sm font-medium">Create a Model</h3>
                              </div>
                              <div className="space-y-2">
                                <Input
                                  placeholder="Model name"
                                  value={createModelName}
                                  onChange={(e) => setCreateModelName(e.target.value)}
                                />
                                <Textarea
                                  placeholder="Modelfile content"
                                  value={createModelFile}
                                  onChange={(e) => setCreateModelFile(e.target.value)}
                                />
                                <Button onClick={handleCreateModel} disabled={isCreating}>
                                  {isCreating ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : null}
                                  Create Model
                                </Button>
                              </div>
                              {createStatus && (
                                <p className="text-sm text-muted-foreground">
                                  {createStatus}
                                </p>
                              )}
                            </div>

                            {/* Copy Model Section */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Copy className="h-4 w-4" />
                                <h3 className="text-sm font-medium">Copy a Model</h3>
                              </div>
                              <div className="space-y-2">
                                <Input
                                  placeholder="Source model"
                                  value={copySourceModel}
                                  onChange={(e) => setCopySourceModel(e.target.value)}
                                />
                                <Input
                                  placeholder="Destination model"
                                  value={copyDestinationModel}
                                  onChange={(e) => setCopyDestinationModel(e.target.value)}
                                />
                                <Button onClick={handleCopyModel} disabled={isCopying}>
                                  {isCopying ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : null}
                                  Copy Model
                                </Button>
                              </div>
                              {copyStatus && (
                                <p className="text-sm text-muted-foreground">
                                  {copyStatus}
                                </p>
                              )}
                            </div>

                            {/* Push Model Section */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Upload className="h-4 w-4" />
                                <h3 className="text-sm font-medium">Push a Model</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder="Model name (e.g., namespace/model:tag)"
                                  value={pushModelName}
                                  onChange={(e) => setPushModelName(e.target.value)}
                                  className="flex-1"
                                />
                                <Button onClick={handlePushModel} disabled={isPushing}>
                                  {isPushing ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : null}
                                  Push Model
                                </Button>
                              </div>
                              {pushStatus && (
                                <p className="text-sm text-muted-foreground">
                                  {pushStatus}
                                </p>
                              )}
                            </div>

                            {/* Generate Embeddings Section */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Cpu className="h-4 w-4" />
                                <h3 className="text-sm font-medium">
                                  Generate Embeddings
                                </h3>
                              </div>
                              <div className="space-y-2">
                                <Input
                                  placeholder="Embedding model name"
                                  value={embeddingModelName}
                                  onChange={(e) => setEmbeddingModelName(e.target.value)}
                                />
                                <Textarea
                                  placeholder="Input text"
                                  value={embeddingInput}
                                  onChange={(e) => setEmbeddingInput(e.target.value)}
                                />
                                <Button
                                  onClick={handleGenerateEmbeddings}
                                  disabled={isEmbedding}
                                >
                                  {isEmbedding ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : null}
                                  Generate Embeddings
                                </Button>
                              </div>
                              {embeddingStatus && (
                                <p className="text-sm text-muted-foreground">
                                  {embeddingStatus}
                                </p>
                              )}
                            </div>
                          </div>
                        </ScrollArea>

                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ModelsModal;