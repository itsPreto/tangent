import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, Minimize2, ArrowLeftRight } from 'lucide-react';
import { cn } from '../../utils/utils';

const ChatContainer = ({ children, className }) => {
  const [size, setSize] = useState('collapsed');
  const [containerWidth, setContainerWidth] = useState(400);
  const containerRef = useRef(null);

  const sizeStyles = {
    collapsed: 'w-[240px] h-[30px] overflow-hidden',
    normal: 'w-[400px] h-[800px]',
    large: 'w-[1400px] h-[800px]',
  };

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [size]);

  const getNextSize = (currentSize) => {
    const sizes = ['collapsed', 'normal', 'large'];
    const currentIndex = sizes.indexOf(currentSize);
    return sizes[(currentIndex + 1) % sizes.length];
  };

  // Split children into ModelStatus and other components
  const childrenArray = React.Children.toArray(children);
  const modelStatus = childrenArray[0];
  const otherChildren = childrenArray.slice(1);

  // Clone ModelStatus with containerWidth prop
  const enhancedModelStatus = React.cloneElement(modelStatus, {
    containerWidth,
    className: "w-full" // Ensure ModelStatus takes full width
  });

  return (
    <div 
      ref={containerRef}
      className={cn(
        "absolute bottom-0 right-0 bg-background border border-border z-10",
        "transition-all duration-300 ease-in-out flex flex-col",
        sizeStyles[size],
        className
      )}
    >
      {/* Header with ModelStatus */}
      <div className="flex-shrink-0 border-b border-border relative bg-background z-20 w-full">
        <div className="relative flex items-center w-full">
          {/* ModelStatus container with padding for the button */}
          <div className="flex-1 pl-10 w-full">
            {enhancedModelStatus}
          </div>
          
          {/* Size toggle button */}
          <button 
            onClick={() => setSize(getNextSize(size))}
            className={cn(
              "absolute top-0 left-0 px-2 py-1 hover:bg-secondary/50",
              "transition-colors duration-200",
              size === 'collapsed' ? "h-full" : "h-[30px]"
            )}
          >
            {size === 'collapsed' ? (
              <Maximize2 className="h-4 w-4" />
            ) : size === 'large' ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <ArrowLeftRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Chat content */}
      <div className="flex-1 min-h-0 relative">
        {otherChildren}
      </div>
    </div>
  );
};

export default ChatContainer;
