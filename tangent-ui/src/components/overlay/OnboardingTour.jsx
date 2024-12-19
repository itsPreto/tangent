import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, FileUp, Network, GitBranch, Bot, MessageCircle } from 'lucide-react';
import { Button } from '../core/button';

const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Tangent',
    content: 'Discover insights from your AI conversations with our interactive visualization and analysis tools.',
    icon: MessageCircle,
    highlight: 'center',
    position: 'center'
  },
  {
    id: 'upload',
    title: 'Upload Your Chats',
    content: 'Start by uploading your chat archive to visualize your conversation patterns and topics.',
    icon: FileUp,
    highlight: '[data-tour="upload"]',
    position: 'right'
  },
  {
    id: 'visualization',
    title: 'Interactive Visualization',
    content: 'Explore your conversation clusters in an interactive map. Similar topics are grouped together.',
    icon: Network,
    highlight: '[data-tour="visualization"]',
    position: 'bottom'
  },
  {
    id: 'branches',
    title: 'Conversation Branches',
    content: 'View and create conversation branches to explore different directions in your chats.',
    icon: GitBranch,
    highlight: '[data-tour="branches"]',
    position: 'left'
  },
  {
    id: 'models',
    title: 'AI Models',
    content: 'Switch between different AI models for your conversations and manage your model preferences.',
    icon: Bot,
    highlight: '[data-tour="models"]',
    position: 'bottom'
  }
];

const getTooltipPosition = (elementRect, position, tooltipSize = { width: 320, height: 200 }) => {
  if (position === 'center') {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    };
  }

  const spacing = 12; // Space between element and tooltip
  let top, left, transform;

  switch (position) {
    case 'top':
      top = elementRect.top - tooltipSize.height - spacing;
      left = elementRect.left + elementRect.width / 2;
      transform = 'translateX(-50%)';
      break;
    case 'bottom':
      top = elementRect.bottom + spacing;
      left = elementRect.left + elementRect.width / 2;
      transform = 'translateX(-50%)';
      break;
    case 'left':
      top = elementRect.top + elementRect.height / 2;
      left = elementRect.left - tooltipSize.width - spacing;
      transform = 'translateY(-50%)';
      break;
    case 'right':
      top = elementRect.top + elementRect.height / 2;
      left = elementRect.right + spacing;
      transform = 'translateY(-50%)';
      break;
    default:
      top = elementRect.bottom + spacing;
      left = elementRect.left;
      transform = 'translateX(0)';
  }

  // Adjust position if tooltip would go off screen
  const padding = 16;
  const viewport = {
    width: window.innerWidth - padding * 2,
    height: window.innerHeight - padding * 2
  };

  if (left < padding) {
    left = padding;
    transform = 'translateX(0)';
  } else if (left + tooltipSize.width > viewport.width) {
    left = viewport.width - tooltipSize.width;
    transform = 'translateX(0)';
  }

  if (top < padding) {
    top = padding;
  } else if (top + tooltipSize.height > viewport.height) {
    top = viewport.height - tooltipSize.height;
  }

  return { top, left, transform };
};

export default function OnboardingTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0, transform: 'none' });
  const [highlightedElement, setHighlightedElement] = useState(null);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour) {
      setIsActive(true);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const step = TOUR_STEPS[currentStep];
    if (step.highlight === 'center') {
      setHighlightedElement(null);
      setTooltipPosition(getTooltipPosition(null, 'center'));
    } else {
      const element = document.querySelector(step.highlight);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightedElement({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        setTooltipPosition(getTooltipPosition(rect, step.position));
      }
    }
  }, [currentStep, isActive]);

  const handleComplete = () => {
    setIsActive(false);
    localStorage.setItem('hasSeenTour', 'true');
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  if (!isActive) return null;

  const currentTourStep = TOUR_STEPS[currentStep];
  const Icon = currentTourStep.icon;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Highlight */}
      <AnimatePresence>
        {highlightedElement && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute border-2 border-primary rounded-lg"
            style={{
              top: highlightedElement.top - 4,
              left: highlightedElement.left - 4,
              width: highlightedElement.width + 8,
              height: highlightedElement.height + 8,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="pointer-events-auto absolute w-[320px]"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: tooltipPosition.transform
        }}
      >
        <div className="relative rounded-xl border bg-card p-6 shadow-lg">
          <button
            onClick={handleComplete}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-semibold tracking-tight">{currentTourStep.title}</h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentTourStep.content}
            </p>

            <div className="flex items-center justify-between pt-4">
              <div className="flex gap-1">
                {TOUR_STEPS.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 w-4 rounded-full transition-colors ${
                      index === currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleComplete}>
                  Skip
                </Button>
                <Button size="sm" onClick={handleNext}>
                  {currentStep === TOUR_STEPS.length - 1 ? (
                    'Get started'
                  ) : (
                    <>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}