// src/types/chat.ts
export interface ChatSummary {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    nodeCount: number;
  }
  
  export interface ChatData {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    nodes: Node;
  }