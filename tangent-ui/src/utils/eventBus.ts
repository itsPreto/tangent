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
};

const emitter = mitt<Events>();

export default emitter;