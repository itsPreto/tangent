// src/types/message.ts

export interface ContentPart {
  type: 'text' | 'code' | 'paste';
  content: string;
  language?: string;
  detectedLanguage?: string; // For auto-detected language in pasted content
  codeIndex?: number;
  complete?: boolean;
  wordCount?: number; // For paste content
  preview?: string; // Optional preview text
}

// Additional helper types for the unified CodePreview component
export interface CodePreviewData {
  content: string;
  language: string;
  nodeId: string;
  codeIndex?: number;
  complete?: boolean;
  isStreaming?: boolean;
}

export interface PasteData {
  isPaste: boolean;
  content: string;
  wordCount: number;
  detectedLanguage?: string;
}

export interface TTSConfig {
  enabled: boolean;
  voice: string;
  speed: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string; //original message
  contentParts: ContentPart[]; // Array of text, code, and paste parts
  timestamp: string;
  isStreaming?: boolean;
  modelId?: string;
}

export interface Node {
  id: string;
  x: number;
  y: number;
  title?: string;
  parentId: string | null;
  messages: Message[];
  type: 'main' | 'branch' | 'media' | 'web';
  branchMessageIndex: number | null;
  streamingContent?: string | null;
  lockedHeight?: number;
  modelParams?: Record<string, any>; // Model-specific parameters
}