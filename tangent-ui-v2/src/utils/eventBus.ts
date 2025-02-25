// eventBus.ts
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
};

const emitter = mitt<Events>();

export default emitter;
