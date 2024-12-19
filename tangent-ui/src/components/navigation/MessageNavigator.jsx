import React, { useEffect } from 'react';
import { cn } from '../../utils/utils';
import { Expand, Minimize } from 'lucide-react';

export const MessageNavigator = ({
  currentNode,
  currentIndex,
  totalMessages,
  onNavigate,
  branches,
  isMessageExpanded,
  onToggleExpand
}) => {
  // Handle keyboard shortcuts for expansion
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle if not typing in an input
      if (document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA' ||
          !currentNode) return;

      // Handle 'e' key for expansion toggle
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault(); // Prevent any default 'e' key behavior
        onToggleExpand(currentIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, onToggleExpand, currentNode]);

  if (!currentNode) return null;

  const canGoUp = currentIndex > 0;
  const canGoDown = currentIndex < totalMessages - 1;
  const hasLeft = branches.left.length > 0 || branches.parent?.position === 'left';
  const hasRight = branches.right.length > 0 || branches.parent?.position === 'right';

  return (
    <div className={cn(
      "relative bottom-2 right-2 rounded-md text-[10px]",
      "bg-background/80 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60",
      "shadow-sm border border-border"
    )}>
      <div className="flex items-center gap-1">
        {/* Navigation buttons remain the same */}
        <div className="relative">
          <button 
            onClick={() => onNavigate('left')}
            className={cn(
              "px-1 rounded transition-colors",
              hasLeft
                ? "bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer" 
                : "bg-muted text-muted-foreground cursor-not-allowed"
          )}>A</button>
          {branches.left.length > 1 && (
            <span className="absolute -top-2 -right-1 text-[8px] text-primary">
              {branches.left.length}
            </span>
          )}
        </div>
        
        <div className="flex flex-col gap-0.5">
          <button 
            onClick={() => onNavigate('up')}
            className={cn(
              "px-1 rounded transition-colors",
              canGoUp
                ? "bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer" 
                : "bg-muted text-muted-foreground cursor-not-allowed"
          )}>W</button>
          <button 
            onClick={() => onNavigate('down')}
            className={cn(
              "px-1 rounded transition-colors",
              canGoDown
                ? "bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer" 
                : "bg-muted text-muted-foreground cursor-not-allowed"
          )}>S</button>
        </div>

        <div className="relative">
          <button 
            onClick={() => onNavigate('right')}
            className={cn(
              "px-1 rounded transition-colors",
              hasRight
                ? "bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer" 
                : "bg-muted text-muted-foreground cursor-not-allowed"
          )}>D</button>
          {branches.right.length > 1 && (
            <span className="absolute -top-2 -right-1 text-[8px] text-primary">
              {branches.right.length}
            </span>
          )}
        </div>

        {/* Updated Expand/Collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(currentIndex);
          }}
          className={cn(
            "p-1 rounded transition-colors",
            "bg-primary/20 text-primary hover:bg-primary/30",
            "flex items-center gap-1"
          )}
          title="Press 'E' to toggle expansion"
        >
          {isMessageExpanded ? (
            <>
              <Minimize className="w-3 h-3" />
              <span>E</span>
            </>
          ) : (
            <>
              <Expand className="w-3 h-3" />
              <span>E</span>
            </>
          )}
        </button>

        <span className="text-muted-foreground px-1">
          {currentIndex + 1}/{totalMessages}
        </span>
        <span className={cn(
          "px-1 rounded",
          "bg-primary/20 text-primary"
        )}>
          {currentNode.type === 'main' ? 'M' : `B${currentNode.id}`}
        </span>
      </div>
    </div>
  );
};

export default MessageNavigator;