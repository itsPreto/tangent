import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/utils';

export const ModelStatus = ({
  selectedModel,
  isLoading,
  temperature = 0.7,
  onTemperatureChange,
  models = [],
  onModelSelect,
  className,
  containerWidth
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [tempSelection, setTempSelection] = useState(null);
  const [isEditingTemp, setIsEditingTemp] = useState(false);
  const [tempValue, setTempValue] = useState(temperature.toString());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef(null);
  const tempInputRef = useRef(null);
  const [modelName, modelSize] = (selectedModel || '').split(':');

  // Calculate max width based on container width
  const getMaxWidth = () => {
    if (!containerWidth) return 'w-[220px]';
    return `w-[${Math.min(containerWidth - 40, 220)}px]`;
  };

  const handleTempClick = (e) => {
    e.stopPropagation();
    setIsEditingTemp(true);
  };

  const handleTempChange = (e) => {
    const value = e.target.value;
    if (value === '' || (value >= 0 && value <= 2 && /^\d*\.?\d*$/.test(value))) {
      setTempValue(value);
    }
  };

  const handleTempBlur = () => {
    setIsEditingTemp(false);
    const newTemp = Math.min(Math.max(parseFloat(tempValue) || 0, 0), 2);
    setTempValue(newTemp.toString());
    onTemperatureChange?.(newTemp);
  };

  const handleTempKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTempBlur();
    }
    e.stopPropagation();
  };

  useEffect(() => {
    if (isEditingTemp && tempInputRef.current) {
      tempInputRef.current.focus();
    }
  }, [isEditingTemp]);

  const updateScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth);
    }
  };

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener('resize', updateScrollButtons);
    return () => window.removeEventListener('resize', updateScrollButtons);
  }, [isSelecting]);

  const handleScroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      scrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleSelect = (modelName) => {
    setTempSelection(modelName);
  };

  const handleCancel = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsSelecting(false);
      setTempSelection(null);
    }, 200);
  };

  const handleConfirm = () => {
    if (tempSelection) {
      onModelSelect(tempSelection);
    }
    handleCancel();
  };

  // Calculate modal width based on container width
  const getModalWidth = () => {
    if (!containerWidth) return 'w-full';
    if (containerWidth <= 240) return 'w-[220px]';
    if (containerWidth <= 400) return 'w-[380px]';
    return 'w-[500px]';
  };

  if (isSelecting) {
    return (
      <div className={cn(
        "p-2 rounded-md text-sm",
        "bg-background/80 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60",
        "shadow-sm border border-border",
        "transition-all duration-200",
        getModalWidth(),
        isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100",
        "w-full",
        className
      )}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Select Model</span>
            <button
              onClick={handleCancel}
              className="p-1 hover:bg-secondary/50 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            {canScrollLeft && (
              <button
                onClick={() => handleScroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 hover:bg-secondary/50 rounded-full bg-background/80 backdrop-blur-sm"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <div
              ref={scrollContainerRef}
              onScroll={updateScrollButtons}
              className="overflow-x-auto flex gap-2 px-6 scrollbar-hide scroll-smooth"
            >
              {models.map((model) => (
                <button
                  key={model.name}
                  onClick={() => handleSelect(model.name)}
                  className={cn(
                    "px-3 py-1.5 rounded-md whitespace-nowrap",
                    "transition-colors duration-200",
                    tempSelection === model.name ? "bg-primary text-primary-foreground" : "hover:bg-secondary/50"
                  )}
                >
                  {model.name}
                </button>
              ))}
            </div>

            {canScrollRight && (
              <button
                onClick={() => handleScroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 hover:bg-secondary/50 rounded-full bg-background/80 backdrop-blur-sm"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-sm rounded-md hover:bg-secondary/50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={cn(
                "px-3 py-1 text-sm rounded-md",
                tempSelection
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "opacity-50 cursor-not-allowed bg-secondary"
              )}
              disabled={!tempSelection}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsSelecting(true)}
      className={cn(
        "p-1.5 rounded-md text-[10px] cursor-pointer",
        "bg-background/80 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60",
        "shadow-sm border border-border",
        "hover:bg-secondary/50 transition-colors duration-200",
        getMaxWidth(),
        "w-full",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <Bot className="h-3 w-3 text-primary flex-shrink-0" />
          <span className={cn(
            "rounded truncate",
            "bg-primary/20 text-primary"
          )}>
            {modelName || 'No model selected'}
          </span>
        </div>

        {modelSize && (
          <span className="text-muted-foreground border-l border-border pl-2 flex-shrink-0">
            {modelSize}
          </span>
        )}

        <div
          className="text-muted-foreground border-l border-border pl-2 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {isEditingTemp ? (
            <input
              ref={tempInputRef}
              type="text"
              value={tempValue}
              onChange={handleTempChange}
              onBlur={handleTempBlur}
              onKeyDown={handleTempKeyDown}
              className="w-8 bg-transparent text-center outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span onClick={handleTempClick}>
              T={temperature}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="w-2 h-2 rounded-full bg-primary/80 animate-pulse flex-shrink-0" />
        )}
      </div>
    </div>
  );
};

export default ModelStatus;