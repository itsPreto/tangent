// src/types/message.ts

export interface ContentPart {
  type: 'text' | 'code' | 'paste'; // Add 'paste' type
  content: string;
  language?: string;
  codeIndex?: number;
  nodeId?: string;
  complete?: boolean;
  // Paste-specific properties
  preview?: string;
  wordCount?: number;
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
}