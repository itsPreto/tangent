// types/message.ts
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  modelId?: string;
}

export interface ContentPart {
  type: 'text' | 'code';
  content: string;
  language?: string;
  complete?: boolean;
}

export interface Node {
  id: string;
  x: number;
  y: number;
  title?: string;
  parentId: string | null;
  messages: Message[];
  type: 'main' | 'branch';
  branchMessageIndex: number | null;
  streamingContent?: string | null;
}