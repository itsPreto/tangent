// src/types/chat.ts
import type { Node } from '@/types/message';

export interface ChatData {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  nodes: Node;
}

export interface ChatSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  x: number;
  y: number;
  status: 'active' | 'archived';
  tags: string[];
  color: string;
  isFavorite: boolean;
}