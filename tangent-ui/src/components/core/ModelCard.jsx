// ModelCard.jsx
import React from "react";
import {
  Info,
  Trash2,
  Terminal,
  Eye,
  Network,
  Bot,
  CircuitBoard,
  Brain,
  Activity,
  Download,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
  Badge,
} from "../index";

export const ModelCard = ({
  model,
  isRunning,
  onInfoClick,
  onDeleteClick,
  onPullClick,
  modelType,
  detailedView = false,
  isLibraryModel = false,
}) => {
  const getModelIcon = () => {
    switch (modelType) {
      case "text":
        return <Terminal className="h-5 w-5 text-blue-500" />;
      case "vision":
        return <Eye className="h-5 w-5 text-purple-500" />;
      case "embedding":
        return <Network className="h-5 w-5 text-green-500" />;
      default:
        return <Bot className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatSize = (size) => {
    if (!size) return "N/A";
    const sizeNum = parseInt(size);
    if (sizeNum >= 1073741824) {
      return `${(sizeNum / 1073741824).toFixed(1)} GB`;
    } else if (sizeNum >= 1048576) {
      return `${(sizeNum / 1048576).toFixed(1)} MB`;
    } else if (sizeNum >= 1024) {
      return `${(sizeNum / 1024).toFixed(1)} KB`;
    }
    return `${sizeNum} Bytes`;
  };

  const handleCardClick = (e) => {
    if (!e.target.closest("button")) {
      onInfoClick?.(model.name);
    }
  };

  return (
    <Card
      className="w-full h-full flex flex-col justify-between transition-all hover:shadow-lg cursor-pointer"
      onClick={handleCardClick}
    >
      <CardHeader className="p-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {getModelIcon()}
          <div>
            <CardTitle className="text-sm font-semibold">{model.name}</CardTitle>
            {detailedView && (
              <CardDescription className="text-xs">
                {model.architecture || "Architecture N/A"}
              </CardDescription>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInfoClick?.(model.name);
                  }}
                  aria-label="Show Info"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Show Info</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isLibraryModel ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPullClick?.(model.name);
                    }}
                    aria-label="Pull Model"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pull Model</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            !isRunning && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClick?.(model.name);
                      }}
                      aria-label="Delete Model"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Model</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          )}
        </div>
      </CardHeader>
      {detailedView && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <CircuitBoard className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {model.details?.parameter_size || "N/A"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {formatSize(model.size)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {model.details?.quantization_level || "N/A"}
              </span>
            </div>
          </div>
          {model.tags && (
            <div className="mt-3 flex flex-wrap gap-2">
              {model.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag.split(":")[1]}
                </Badge>
              ))}
              {model.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{model.tags.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      )}
      {isRunning && (
        <Badge variant="secondary" className="absolute top-2 right-2 h-6">
          Active
        </Badge>
      )}
    </Card>
  );
};
