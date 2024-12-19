
// HoverTooltip.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HoverTooltip = ({ hoveredPoint }) => {
  if (!hoveredPoint) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        transition={{ duration: 0.2 }}
        className="fixed pointer-events-none z-50 bg-popover/95 backdrop-blur-sm border rounded-lg shadow-lg p-4"
        style={{
          left: hoveredPoint.x + 15,
          top: hoveredPoint.y - 15,
          transform: "translate(-50%, -100%)",
          maxWidth: "320px",
        }}
      >
        <div className="space-y-1">
          <div className="font-medium">{hoveredPoint.title}</div>
          <div className="text-sm text-muted-foreground">{hoveredPoint.topic}</div>
          {hoveredPoint.branchCount && (
            <div className="text-sm font-medium text-primary">
              {hoveredPoint.branchCount}
            </div>
          )}
          {hoveredPoint.hasReflection && (
            <div className="text-xs text-yellow-500">Has reflection</div>
          )}
          {hoveredPoint.coherence && (
            <div className="text-xs text-muted-foreground">
              Coherence: {Math.round(hoveredPoint.coherence * 100)}%
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default HoverTooltip;


