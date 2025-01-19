// types/message.ts
export interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    isStreaming?: boolean;
  }
  
  export interface ContentPart {
    type: 'text' | 'code';
    content: string;
    language?: string;
  }

  interface StreamingPart {
    type: 'text' | 'code';
    content: string;
    language?: string;
    complete?: boolean;
    highlightedContent?: string; // Add this to cache highlighted content
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