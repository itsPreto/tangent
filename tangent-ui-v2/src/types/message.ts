export interface ContentPart {
  type: 'text' | 'code';
  content: string;
  language?: string; //  'javascript', 'python', 'html', etc.
  codeIndex?: number; // Index of the code block WITHIN the message
}

export interface TTSConfig {
  enabled: boolean;
  voice: string;
  speed: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string; //original message
  contentParts: ContentPart[]; // Array of text and code parts
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
  type: 'main' | 'branch' | 'media';
  branchMessageIndex: number | null;
  streamingContent?: string | null;
  lockedHeight?: number;
}