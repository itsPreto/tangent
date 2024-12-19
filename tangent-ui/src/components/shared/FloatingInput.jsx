import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RecordingButton } from '../forms/RecordingButton';

const FloatingInput = ({
  onSend,
  isLoading,
  show,
  onClose,
  position,
  inputValue,
  onInputChange,
  allowParallel = true
}) => {
  const inputRef = useRef(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleSendMessage = () => {
    if (inputValue.trim() && (!isLoading || allowParallel) && !isTranscribing) {
      onSend(inputValue);
      onInputChange('');
      onClose();
    }
  };

  const handleTranscriptionComplete = (transcript) => {
    onInputChange(transcript);
    setIsTranscribing(false);
    if (transcript.trim()) {
      handleSendMessage();
    }
  };

  const handleTranscriptionStart = () => {
    setIsTranscribing(true);
    onInputChange('');
  };

  useEffect(() => {
    if (show && inputRef.current) {
      inputRef.current.focus();
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 50 }}
          className="fixed z-49 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-4 w-96"
          style={{
            left: `${position?.x ?? window.innerWidth / 2 - 192}px`,
            top: `${position?.y ?? window.innerHeight - 90}px`
          }}
        >
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                } else if (e.key === 'Escape') {
                  onClose();
                }
              }}
              placeholder="Type your message..."
              rows={1}
              className="flex-1 px-3 py-2 rounded-lg bg-muted/50 text-foreground placeholder:text-muted-foreground border border-border resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isTranscribing || (isLoading && !allowParallel)}
            />

            <RecordingButton
              onTranscriptionComplete={handleTranscriptionComplete}
              onTranscriptionStart={handleTranscriptionStart}
              onRecordingStop={() => setIsTranscribing(false)}
              disabled={isLoading && !allowParallel}
              className="text-foreground"
            />

            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || (isLoading && !allowParallel) || isTranscribing}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading && !allowParallel ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingInput;