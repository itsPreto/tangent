import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, Send, Loader2, ChevronUp, Sparkles, Play, Pause } from 'lucide-react';
import { cn } from '../../utils/utils';

const API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const TTS_CHUNK_SIZE = 1024;

// Utility functions
const splitIntoSentences = (text) => {
  return text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
};

const createChunks = (sentences, maxChunkSize = TTS_CHUNK_SIZE) => {
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += sentence;
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

const renderContinuationIndicator = (message) => {
  if (!message.continuationCount) return null;

  return (
    <div className="text-xs font-medium text-muted-foreground mt-2 flex items-center gap-2">
      <div className="flex gap-1">
        {[...Array(message.continuationCount)].map((_, i) => (
          <Sparkles key={i} className="w-3 h-3 text-primary" />
        ))}
      </div>
      {message.continuationCount > 1 &&
        `${message.continuationCount} continuations`
      }
    </div>
  );
};

export const ChatMessage = ({
  message,
  isCollapsed,
  onClick,
  voiceId = "21m00Tcm4TlvDq8ikWAM",
  apiKey = "----"
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [audioQueue, setAudioQueue] = useState([]);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioRef = useRef(null);
  const chunksRef = useRef([]);

  // Determine if message needs to be collapsible
  const needsCollapse = message.content?.length > 150;
  const isStreaming = message.isStreaming || false;
  const isTranscribing = message.isTranscribing || false;

  const generateSpeechForChunk = async (text) => {
    try {
      const response = await fetch(`${API_URL}/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.error('Error generating speech for chunk:', error);
      return null;
    }
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      setCurrentChunkIndex(0);
      setAudioQueue([]);
      setPlaybackProgress(0);
    } else {
      setIsPlaying(true);

      // Initialize chunks if not already done
      if (chunksRef.current.length === 0) {
        const sentences = splitIntoSentences(message.content);
        chunksRef.current = createChunks(sentences);
      }

      // Generate audio for first chunk if queue is empty
      if (audioQueue.length === 0) {
        const audioUrl = await generateSpeechForChunk(chunksRef.current[0]);
        if (audioUrl) {
          setAudioQueue([audioUrl]);
          playChunk(audioUrl);
        }
      }
    }
  };

  const playChunk = (audioUrl) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
    }
  };

  const handleAudioEnd = async () => {
    // Clean up current audio URL
    if (audioQueue[0]) {
      URL.revokeObjectURL(audioQueue[0]);
    }

    // Move to next chunk
    const nextChunkIndex = currentChunkIndex + 1;
    if (nextChunkIndex < chunksRef.current.length) {
      setCurrentChunkIndex(nextChunkIndex);

      // Generate audio for next chunk
      const nextAudioUrl = await generateSpeechForChunk(chunksRef.current[nextChunkIndex]);
      if (nextAudioUrl) {
        setAudioQueue([nextAudioUrl]);
        playChunk(nextAudioUrl);
      }

      // Update progress
      setPlaybackProgress(Math.round((nextChunkIndex / chunksRef.current.length) * 100));
    } else {
      // Reset everything when finished
      setIsPlaying(false);
      setCurrentChunkIndex(0);
      setAudioQueue([]);
      setPlaybackProgress(0);
    }
  };

  // Clean up audio URLs when component unmounts
  useEffect(() => {
    return () => {
      audioQueue.forEach(url => URL.revokeObjectURL(url));
    };
  }, [audioQueue]);

  // Reset state when message changes
  useEffect(() => {
    chunksRef.current = [];
    setCurrentChunkIndex(0);
    setPlaybackProgress(0);
    setIsPlaying(false);
    setAudioQueue([]);
  }, [message.content]);


  return (
    <div className={cn(
      "group relative p-6 rounded-2xl transition-all duration-300",
      "border border-transparent",
      !isStreaming && "hover:border-border hover:shadow-lg hover:shadow-background/5",
      message.role === 'user'
        ? "bg-primary/5 hover:bg-primary/10"
        : "bg-muted hover:bg-muted/80",
      needsCollapse && isCollapsed ? "cursor-pointer" : "",
      isTranscribing ? "animate-pulse" : "",
      "hextech-nordic:border-blue-500/20 hextech-nordic:hover:border-blue-500/40",
      "singed-theme:border-green-500/20 singed-theme:hover:border-green-500/40"
    )}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "flex items-start gap-2 text-xs font-medium px-3 py-1.5 rounded-full",
          "text-start", // Add text alignment
          message.role === 'user'
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        )}>
          <span className="whitespace-nowrap">
            {message.role === 'user' ? (
              message.isTranscribing ? 'Recording...' : 'You'
            ) : (
              <>
                <Sparkles className="inline-block w-3 h-3 mr-1" />
                {isStreaming ? 'AI Typing...' : 'AI'}
              </>
            )}
          </span>
        </div>

        {/* TTS controls for AI messages */}
        {message.role === 'assistant' && !isStreaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePlayPause();
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full",
              "text-xs font-medium transition-colors",
              "bg-primary/10 hover:bg-primary/20",
              "text-primary hover:text-primary-foreground"
            )}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3 h-3" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Play
              </>
            )}
          </button>
        )}

        <audio
          ref={audioRef}
          onEnded={handleAudioEnd}
          onError={() => {
            setIsPlaying(false);
            setCurrentChunkIndex(0);
            setAudioQueue([]);
            setPlaybackProgress(0);
          }}
        />

        {needsCollapse && (
          <div className={cn(
            "text-xs font-medium transition-colors",
            isCollapsed ? "text-primary hover:text-primary/80" : "text-muted-foreground"
          )}>
            {isCollapsed ? 'Expand message' : 'Collapse message'}
          </div>
        )}

        {isStreaming && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <span key={i} className={cn(
                  "animate-bounce w-1 h-1 rounded-full",
                  "bg-primary",
                  `delay-${i * 150}`
                )}></span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={cn(
        "text-sm leading-relaxed whitespace-pre-wrap",
        "text-foreground",
        isCollapsed ? "line-clamp-3" : ""
      )}>
        {message.content}

        {isStreaming && !message.content && (
          <span className="text-muted-foreground italic">Generating response...</span>
        )}
      </div>

      {/* Playback progress */}
      {isPlaying && chunksRef.current.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          <div className="text-xs text-muted-foreground">
            Playing chunk {currentChunkIndex + 1} of {chunksRef.current.length}
          </div>
          <div className="w-full h-1 bg-primary/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${playbackProgress}%` }}
            />
          </div>
        </div>
      )}

      {(!isStreaming && message.role === 'assistant') && renderContinuationIndicator(message)}

      {isStreaming && message.streamProgress && (
        <div className="mt-2 text-xs text-muted-foreground">
          Streaming... {message.streamProgress}%
        </div>
      )}
    </div>
  );
};

export default ChatMessage;

export const GlassPanel = ({ children, className = '', ...props }) => (
  <div
    className={cn(
      "bg-background/80 backdrop-blur-md",
      "border border-border",
      "shadow-lg shadow-background/5",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// ModelSelector component
export const ModelSelector = ({ selectedModel, models, onSelect, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) return (
    <div className={cn(
      "h-10 w-64 rounded-lg animate-pulse flex items-center justify-center",
      "bg-muted"
    )}>
      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
    </div>
  );

  return (
    <div className="relative w-64">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 rounded-lg",
          "bg-background/90 border border-border",
          "shadow-sm hover:shadow-md transition-all duration-200"
        )}
      >
        <span className="font-medium text-foreground truncate">{selectedModel}</span>
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground transition-transform duration-200",
          isOpen ? "rotate-180" : ""
        )} />
      </button>

      {isOpen && (
        <div className={cn(
          "absolute mt-2 w-full py-1 z-50 rounded-lg",
          "bg-background/95 backdrop-blur-lg",
          "border border-border shadow-xl"
        )}>
          {models.map((model) => (
            <button
              key={model.name}
              onClick={() => {
                onSelect(model.name);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center px-4 py-2.5 text-left",
                "hover:bg-muted/80 text-foreground"
              )}
            >
              {model.name === selectedModel && (
                <Check className="w-4 h-4 text-primary mr-2 shrink-0" />
              )}
              <span className={cn(
                "truncate",
                model.name === selectedModel ? "text-primary font-medium" : ""
              )}>
                {model.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ModelLoadingState = () => (
  <div className="h-10 w-64 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
  </div>
);


