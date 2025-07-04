// Updates to your existing eventBus.ts
import mitt from 'mitt';

export type Events = {
  'show-sandbox': {
    code: string;
    language: string;
    isStreaming: boolean;
    nodeId?: string;
    partial?: boolean;
    codeIndex?: number;
  };
  'show-code-in-panel': {
    code: string;
    language: string;
    isStreaming: boolean;
    shouldOpenPanel?: boolean;
    nodeId?: string;
  };
  'debug-sandbox': {
    code: string;
    errors: string;
    nodeId?: string;
  };
  // Add this new event type
  'code-edit-status-changed': {
    nodeId: string;
    codeIndex: number;
    isEdited: boolean;
  };
  // Compacted conversation events
  'continue-conversation': {
    nodeId: string;
  };
  'branch-from-last': {
    nodeId: string;
  };
  'toggle-compacted-expansion': {
    nodeId: string;
    expanded: boolean;
  };
  'create-branch-from-message': {
    nodeId: string;
    messageIndex: number;
    includeParentContext: boolean;
  };
  'node-message-positions-updated': {
    nodeId: string;
    positions: Record<number, number>;
    buttonPositions: Record<number, { x: number; y: number }>;
  };
  'request-node-position-update': {
    nodeId: string;
  };
  'thumbnail-captured': {
    nodeId: string;
    codeIndex?: number;
  };
};

const emitter = mitt<Events>();

export default emitter;