<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex justify-between items-center p-4 border-b border-base-300">
      <div class="flex items-center gap-4">
        <h2 class="text-lg font-semibold">Code Viewer</h2>
        <div class="flex items-center gap-2" v-if="codeSnippets.length > 0">
          <button @click="previousSnippet" class="btn btn-sm btn-ghost" :disabled="currentSnippetIndex <= 0">
            <ChevronLeft class="w-4 h-4" />
          </button>
          <span class="text-sm">{{ currentSnippetIndex + 1 }} / {{ codeSnippets.length }}</span>
          <button @click="nextSnippet" class="btn btn-sm btn-ghost"
            :disabled="currentSnippetIndex >= codeSnippets.length - 1">
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
        <button @click="openDiffView" class="btn btn-sm btn-ghost gap-2" :disabled="codeSnippets.length < 2">
          <GitCompare class="w-4 h-4" />
          Diff View
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button @click="sendErrors" class="btn btn-ghost btn-sm gap-2">
          <Bug class="w-4 h-4" />
        </button>
        <button @click="copyToClipboard" class="btn btn-ghost btn-sm gap-2">
          <Copy class="w-4 h-4" />
        </button>
        <button @click="saveCurrentCode" class="btn btn-sm btn-primary gap-2" :disabled="!hasEdits">
          <Save class="w-4 h-4" />
        </button>
        <button @click="handleClose" class="btn btn-ghost btn-sm">
          <XIcon class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 relative" style="max-height: 93vh;">
      <div v-if="currentCode" class="h-full">
        <div class="flex items-center justify-between px-4 py-2 bg-base-200">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">Language: {{ currentLanguage }}</span>
            <Badge v-if="isStreaming" variant="secondary">Streaming</Badge>
          </div>
          <div v-if="previewErrors" class="text-red-500 text-sm">
            Error: {{ previewErrors }}
          </div>
        </div>

        <SandpackProvider :files="getFiles(currentCode)" :template="getTemplate(currentLanguage)" :theme="editorTheme"
          :customSetup="sandpackSetup" :options="{
            autorun: !isStreaming,
            recompileMode: 'immediate',
            recompileDelay: 500
           }">
          <div class="h-[calc(100%-40px)] flex flex-col">
            <div :style="{ height: `${splitPosition}%` }" class="border-b border-base-300">
              <SandpackCodeEditor @code-update="handleCodeUpdate" showLineNumbers :readOnly="isStreaming" class="h-full"
                style="resize: none" wrapContent closableTabs :options="{
                  autoSave: true,
                  autoComplete: true,
                  formatOnSave: true
                }" />
            </div>

            <div
              class="h-2 bg-base-200 hover:bg-base-300 cursor-row-resize flex items-center justify-center group transition-colors"
              @mousedown="startResize">
              <div class="w-8 h-1 bg-base-content/20 rounded group-hover:bg-base-content/40 transition-colors"></div>
            </div>

            <div :style="{ height: `${100 - splitPosition - 1}%` }" class="overflow-hidden">
              <SandpackPreview
                ref="previewRef"
                class="h-full"
                :options="{
                  showNavigator: true,
                  showRefreshButton: true,
                }"
                @message="handleSandpackMessage"
              />
            </div>
          </div>
        </SandpackProvider>
      </div>
      <div v-else class="h-full flex items-center justify-center text-base-content/50">
        <p>No code selected</p>
      </div>
    </div>

    <!-- Diff View Modal -->
    <DiffViewModal v-if="showDiffModal" :codeSnippets="codeSnippets" @close="showDiffModal = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { XIcon, Copy, ChevronLeft, ChevronRight, Save, GitCompare, Bug } from 'lucide-vue-next'
import { SandpackProvider, SandpackPreview, SandpackCodeEditor } from 'sandpack-vue3'
import type { SandpackFiles, SandpackMessage } from '@codesandbox/sandpack-react'
import { sandpackSetup } from './sandpackDeps'
import Badge from '../ui/Badge.vue'
import emitter from '@/utils/eventBus'
import { useThemeStore } from '@/stores/themeStore'
import DiffViewModal from './DiffViewModal.vue'
import { useCanvasStore } from '@/stores/canvasStore'

interface Props {
  nodeId: string;
}

interface CodeSnippet {
  code: string;
  language: string;
  isStreaming: boolean;
  timestamp: number;
  codeIndex: number;
}

const props = withDefaults(defineProps<Props>(), {
  nodeId: ''
});

const emit = defineEmits(['panel-opened', 'panel-closed'])
const themeStore = useThemeStore()
const canvasStore = useCanvasStore()

const currentNodeId = ref<string>(props.nodeId);

// State
const currentCode = ref('')
const currentLanguage = ref('javascriptreact')
const isStreaming = ref(false)
const codeSnippets = ref<CodeSnippet[]>([])
const currentSnippetIndex = ref(-1)
const splitPosition = ref(50)
const showDiffModal = ref(false)
const previewRef = ref<null | { getBundlerError: () => string }>(null) // Keep this, even though we don't directly use getBundlerError
const previewErrors = ref('')
const lastSavedCode = ref('')
const hasEdits = ref(false)

// Theme
const editorTheme = computed(() => {
  // ... (same as before) ...
  const isDark = themeStore.isDarkTheme(themeStore.currentTheme)
    const colors = themeStore.currentThemeColors
    return {
        colors: {
            surface1: isDark ? '#1e1e1e' : '#ffffff',
            surface2: isDark ? '#2c2c2c' : '#f5f5f5',
            surface3: isDark ? '#393939' : '#eeeeee',
            clickable: isDark ? '#999999' : '#666666',
            base: isDark ? '#808080' : '#808080',
            disabled: isDark ? '#4d4d4d' : '#cccccc',
            hover: isDark ? '#c5c5c5' : '#333333',
            accent: colors.primary,
            error: '#ff453a',
            errorSurface: isDark ? '#39000d' : '#ffebeb'
        },
        syntax: {
            plain: isDark ? '#d4d4d4' : '#24292e',
            comment: isDark ? '#6a9955' : '#6a737d',
            keyword: isDark ? '#569cd6' : '#d73a49',
            tag: isDark ? '#569cd6' : '#22863a',
            punctuation: isDark ? '#d4d4d4' : '#24292e',
            definition: isDark ? '#4fc1ff' : '#6f42c1',
            property: isDark ? '#9cdcfe' : '#005cc5',
            static: isDark ? '#d4d4d4' : '#032f62',
            string: isDark ? '#ce9178' : '#032f62'
        },
        font: {
            body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            mono: '"Fira Mono", "DejaVu Sans Mono", Menlo, Consolas, "Liberation Mono", Monaco, "Lucida Console", monospace'
        }
    }
})

const getFiles = (code: string): SandpackFiles => {
  const mainFile = { code, active: true };
    if (['javascript', 'javascriptreact'].includes(currentLanguage.value)) {
        return {
            '/App.js': mainFile,
            '/index.js': {
                code: `
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import './styles.css';

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);`,
                hidden: true
            },
            '/styles.css': {
                code: `
html, body, #root {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}`,
                hidden: true
            }
        };
    }
    return { '/App.js': mainFile };
};

const getTemplate = (language: string) => language.includes('vue') ? 'vue' : 'react'

const startResize = (e: MouseEvent) => {
  e.preventDefault()
  const container = (e.target as HTMLElement).closest('.flex-1') as HTMLElement
  const startY = e.clientY
  const startHeight = splitPosition.value
  const containerHeight = container.offsetHeight

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientY - startY
    const newPosition = startHeight + (delta / containerHeight * 100)
    splitPosition.value = Math.min(Math.max(20, newPosition), 80)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const handleClose = () => {
  emit('panel-closed')
}

const copyToClipboard = async () => {
  if (currentCode.value) {
    try {
      await navigator.clipboard.writeText(currentCode.value)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }
}

const handleShowSandbox = (data: {
  code: string;
  language: string;
  isStreaming: boolean;
  nodeId?: string;
  partial?: boolean;
  codeIndex?: number;
}) => {
  if (data.nodeId && data.nodeId !== currentNodeId.value) {
    codeSnippets.value = [];
    currentSnippetIndex.value = -1;
    currentNodeId.value = data.nodeId;
  }

    if (data.partial) {
        if (currentSnippetIndex.value !== -1) {
            // Append to the existing snippet
            codeSnippets.value[currentSnippetIndex.value].code += data.code;
        } else {
            // Create a new snippet for the partial content
            codeSnippets.value.push({
                code: data.code,
                language: data.language,
                isStreaming: data.isStreaming,
                timestamp: Date.now(),
                codeIndex: data.codeIndex || 0,
            });
            currentSnippetIndex.value = codeSnippets.value.length - 1;
            lastSavedCode.value = ''; // Reset lastSavedCode for a new snippet
        }
    } else {
        // For non-partial content, replace or add as before
        if (currentSnippetIndex.value !== -1 && codeSnippets.value[currentSnippetIndex.value]) {
            codeSnippets.value[currentSnippetIndex.value] = {
                code: data.code,
                language: data.language,
                isStreaming: data.isStreaming,
                timestamp: Date.now(),
                codeIndex: data.codeIndex || 0,
            };
            lastSavedCode.value = data.code
        } else {
          codeSnippets.value.push({
            code: data.code,
            language: data.language,
            isStreaming: data.isStreaming,
            timestamp: Date.now(),
            codeIndex: data.codeIndex || 0,
          })
          currentSnippetIndex.value = codeSnippets.value.length - 1
          lastSavedCode.value = data.code; // Update lastSavedCode with the full code
        }

    }

  currentCode.value = currentSnippetIndex.value !== -1
    ? codeSnippets.value[currentSnippetIndex.value].code
    : ""
  currentLanguage.value = data.language
  isStreaming.value = data.isStreaming
    hasEdits.value = currentCode.value !== lastSavedCode.value;

  emit('panel-opened')
}


const nextSnippet = () => {
  if (currentSnippetIndex.value < codeSnippets.value.length - 1) {
    currentSnippetIndex.value++
    const snippet = codeSnippets.value[currentSnippetIndex.value]
    currentCode.value = snippet.code
    currentLanguage.value = snippet.language
    isStreaming.value = snippet.isStreaming
    hasEdits.value = currentCode.value !== lastSavedCode.value
  }
}

const previousSnippet = () => {
  if (currentSnippetIndex.value > 0) {
    currentSnippetIndex.value--
    const snippet = codeSnippets.value[currentSnippetIndex.value]
    currentCode.value = snippet.code
    currentLanguage.value = snippet.language
    isStreaming.value = snippet.isStreaming
    hasEdits.value = currentCode.value !== lastSavedCode.value
  }
}

const openDiffView = () => {
  showDiffModal.value = true
}

const handleCodeUpdate = (newCode: string) => {
    currentCode.value = newCode;
    // Check if the updated code is different from the last saved version
    hasEdits.value = currentCode.value !== lastSavedCode.value;
}

const saveCurrentCode = () => {
    if (!hasEdits.value || currentSnippetIndex.value === -1 || !currentNodeId.value) {
        return; // Exit if no edits, no snippet, or no node ID
    }

    const node = canvasStore.nodes.find(n => n.id === currentNodeId.value);
    if (!node) {
        console.warn("Current node not found. Cannot save code.");
        return;
    }

    const currentSnippet = codeSnippets.value[currentSnippetIndex.value];
    const messageIndex = node.messages.findIndex(
        msg => msg.contentParts?.some(part => part.codeIndex === currentSnippet.codeIndex)
    );

    if (messageIndex === -1) {
        console.warn("Could not find message to update. No codeIndex match.");
        return;
    }

    const updatedMessages = [...node.messages];
    updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        contentParts: updatedMessages[messageIndex].contentParts.map(part => {
            if (part.type === 'code' && part.codeIndex === currentSnippet.codeIndex) {
                return { ...part, content: currentCode.value };
            }
            return part;
        })
    };

    // Update the code snippet in place, preserving isThree if it exists
    codeSnippets.value[currentSnippetIndex.value] = {
        ...currentSnippet,
        code: currentCode.value,
        isStreaming: false,
        timestamp: Date.now(),
    };

    lastSavedCode.value = currentCode.value;
    hasEdits.value = false;

    canvasStore.updateNode(currentNodeId.value, {
        messages: updatedMessages
    });
};
const handleSandpackMessage = (event: SandpackMessage) => {
  if (event.type === 'error') {
    // Handle compile/runtime errors
    if (event.error) {
      if (typeof event.error === 'string') {
        previewErrors.value = event.error;
      } else if (event.error.message) {
        previewErrors.value = event.error.message;
      } else {
        previewErrors.value = "An unknown error occurred";
      }
    }
  } else if (event.type === 'console') {
    // Handle console messages
    if (Array.isArray(event.data)) {
      const logMessages = event.data.map((item) => {
        // Handle different console message formats
        if (typeof item === 'string') {
          return item;
        }
        
        if (item.data) {
          // Handle array of console arguments
          if (Array.isArray(item.data)) {
            return item.data.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
          }
          // Handle error objects or messages
          if (item.data instanceof Error || typeof item.data.message === 'string') {
            return item.data.message;
          }
          // Handle plain data
          return String(item.data);
        }

        return '';
      }).filter(Boolean); // Remove empty messages

      previewErrors.value = logMessages.join('\n');
    }
  }

  // Log for debugging
  if (previewErrors.value) {
    console.log("Sandpack Error/Console Output:", {
      type: event.type,
      message: previewErrors.value
    });
  }
};

const sendErrors = async () => {
  try {
    // Wait for a short time (optional, but good practice).
    await new Promise(resolve => setTimeout(resolve, 250));

    let errorsToSend = previewErrors.value;

    if (!errorsToSend) {
      errorsToSend = "An error occurred, but the specific error message could not be retrieved.";
      console.warn("Error message could not be retrieved from Sandpack.");
    }

    const debugPrompt = `I have a React component that's throwing errors. Here's the current code:

\`\`\`jsx
${currentCode.value}
\`\`\`

And here are the errors:
${errorsToSend}

Please analyze the errors and provide a corrected version of the component that resolves these issues. Explain what was wrong and what changes you made.`;

    if (!currentNodeId.value) {
      console.error('No nodeId available for debug message');
      return;
    }

    emitter.emit('debug-sandbox', {
      code: currentCode.value,
      errors: debugPrompt,
      nodeId: currentNodeId.value
    });
  } catch (error) {
    console.error('Error in sendErrors:', error);
    previewErrors.value = 'Failed to process errors: ' + String(error);
  }
}

// Watchers and Lifecycle Hooks
watch(codeSnippets, (newSnippets) => {
  if (newSnippets.length > 0) {
    const currentSnippet = newSnippets[currentSnippetIndex.value]
    hasEdits.value = currentCode.value !== lastSavedCode.value
  }
}, { deep: true })


watch(() => props.nodeId, (newId) => {
  if (newId) {
    currentNodeId.value = newId;
  }
});

onMounted(() => {
  emitter.on('show-sandbox', handleShowSandbox)
})

onUnmounted(() => {
  emitter.off('show-sandbox', handleShowSandbox)
})
</script>

<style scoped>
/* ... (same styles as before) ... */
:deep(.sp-wrapper) {
  height: 100% !important;
  border: none !important;
  background: transparent !important;
}

:deep(.sp-layout) {
  height: 100% !important;
  border: none !important;
  background: transparent !important;
  flex-direction: column !important;
}

:deep(.sp-stack) {
  height: 100% !important;
  background: transparent !important;
}

:deep(.sp-code-editor) {
  height: 100% !important;
  min-height: 0 !important;
}

:deep(.cm-editor) {
  height: 100% !important;
}

:deep(.sp-preview-container) {
  height: 100% !important;
  min-height: 0 !important;
}

:deep(.sp-preview) {
  height: 100% !important;
  padding: 0 !important;
}

:deep(.sp-code-editor .cm-theme) {
  height: 100% !important;
}

:deep(.sp-stack > div) {
  min-height: 0 !important;
}
</style>