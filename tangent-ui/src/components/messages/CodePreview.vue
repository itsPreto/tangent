<template>
  <div class="code-preview-container my-2">
    <!-- Default thumbnail preview mode -->
    <div v-if="!expanded" 
         class="code-preview-thumbnail border rounded-md overflow-hidden cursor-pointer 
                transition-all duration-200 hover:shadow-md" 
         :class="`theme-${currentTheme}`"
         @click="toggleExpanded">
      
      <!-- Header -->
      <div class="flex items-center justify-between p-3 bg-base-200 dark:bg-gray-800">
        <div class="flex items-center gap-2">
          <component :is="getContentIcon" class="w-4 h-4 text-base-content/70" />
          <span class="font-medium text-sm">{{ getContentLabel }}</span>
          <Badge variant="outline" class="text-xs">{{ lineCount }} lines</Badge>
          <Badge v-if="wordCount && !isCode" variant="outline" class="text-xs">{{ wordCount }} words</Badge>
          <span v-if="isStreaming" class="ml-2 inline-flex items-center">
            <span class="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-ping mr-1"></span>
            <span class="text-xs text-primary font-medium">streaming</span>
          </span>
        </div>
        <ChevronDown class="w-4 h-4 text-base-content/50" />
      </div>
      
      <!-- Preview content - horizontal thumbnail -->
      <div class="p-3 bg-base-100 dark:bg-gray-900 max-h-24 overflow-hidden">
        <pre v-if="isCode" class="text-xs text-base-content/80 font-mono whitespace-pre-wrap leading-relaxed"><code :class="`language-${detectedLanguage}`">{{ previewContent }}</code></pre>
        <div v-else class="text-xs text-base-content/80 leading-relaxed line-clamp-4">{{ previewContent }}</div>
        <!-- Fade overlay for overflow indication -->
        <div class="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-base-100 to-transparent pointer-events-none"></div>
      </div>
    </div>

    <!-- Expanded full view mode -->
    <div v-else class="code-preview-card border rounded-md overflow-hidden shadow-lg" :class="`theme-${currentTheme}`">
      <div class="flex items-center justify-between p-3 bg-base-200 dark:bg-gray-800">
        <div class="flex items-center gap-2">
          <component :is="getContentIcon" class="w-5 h-5 text-base-content/70" />
          <span class="font-medium">{{ getContentLabel }}</span>
          <Badge variant="outline" class="text-xs">{{ lineCount }} lines</Badge>
          <Badge v-if="wordCount && !isCode" variant="outline" class="text-xs">{{ wordCount }} words</Badge>
        </div>
        <div class="flex items-center gap-3">
          <button @click.stop="copyContent" class="btn btn-sm btn-ghost gap-2">
            <Copy class="w-4 h-4" />
            <span class="text-xs">Copy</span>
          </button>
          <button v-if="isCode" @click.stop="openInSandbox" class="btn btn-sm btn-primary gap-2">
            <ExternalLink class="w-4 h-4" />
            <span class="text-xs">Open</span>
          </button>
          <button @click.stop="toggleExpanded" class="btn btn-sm btn-ghost">
            <ChevronUp class="w-4 h-4" />
          </button>
        </div>
      </div>
      <div class="p-4 bg-base-100 dark:bg-gray-900 max-h-96 overflow-y-auto">
        <pre v-if="isCode" class="text-sm text-base-content/90 font-mono whitespace-pre-wrap"><code :class="`language-${detectedLanguage}`">{{ content }}</code></pre>
        <div v-else class="text-sm text-base-content/90 whitespace-pre-wrap">{{ content }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { 
  Code, 
  FileText, 
  Copy, 
  ExternalLink, 
  ChevronUp,
  ChevronDown 
} from 'lucide-vue-next';
import Badge from '../ui/Badge.vue';
import emitter from '@/utils/eventBus';
import { useChatStore } from "@/stores/chatStore"
import { useAppStore } from '@/stores/appStore';

interface CodePreviewProps {
  content: string;
  language?: string;
  nodeId: string;
  codeIndex?: number;
  messageIndex?: number; // Add messageIndex prop
  isStreaming?: boolean;
  forceExpanded?: boolean;
  preview?: string;
  wordCount?: number;
}


interface CodePreviewEmits {
  (e: 'click', data: { content: string, language: string, nodeId: string, codeIndex?: number, complete?: boolean }): void;
  (e: 'preview', data: { content: string, language: string, nodeId: string, codeIndex?: number }): void;
  (e: 'close'): void;
}

const props = withDefaults(defineProps<CodePreviewProps>(), {
  language: '',
  codeIndex: 0,
  messageIndex: 0, // Default to 0
  isStreaming: false,
  forceExpanded: false,
  preview: '',
  wordCount: 0
});

const emit = defineEmits<CodePreviewEmits>();
const appStore = useAppStore();

const expanded = ref(props.forceExpanded);
const isEdited = ref(false);
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');

// Auto-detect if content is code or plain text
const isCode = computed(() => {
  if (props.language && props.language !== 'text') return true;
  
  // Auto-detection patterns
  const codePatterns = [
    /import\s+.*from\s+['"][^'"]+['"]/,  // ES6 imports
    /export\s+(default\s+)?(function|const|class)/,  // ES6 exports
    /function\s+\w+\s*\(/,  // Function declarations
    /const\s+\w+\s*=/,  // Const declarations
    /let\s+\w+\s*=/,  // Let declarations
    /var\s+\w+\s*=/,  // Var declarations
    /class\s+\w+/,  // Class declarations
    /def\s+\w+\s*\(/,  // Python functions
    /if\s*\([^)]*\)\s*{/,  // If statements with braces
    /<template>/,  // Vue templates
    /<script>/,  // Script tags
    /<\/?[a-z][\s\S]*>/i,  // HTML tags
    /\{[\s\S]*\}/,  // Object/JSON patterns
    /console\.(log|error|warn)/,  // Console statements
    /document\./,  // DOM manipulation
    /window\./,  // Window object
  ];
  
  return codePatterns.some(pattern => pattern.test(props.content));
});

// Detect language if not provided
const detectedLanguage = computed(() => {
  if (props.language && props.language !== 'text') return props.language;
  if (!isCode.value) return 'text';
  
  const content = props.content;
  
  // Vue SFC detection
  if (content.includes('<template>') && content.includes('<script') && content.includes('<style')) {
    return 'vue';
  }
  
  // React/JSX detection
  if (content.includes('export default') && content.includes('return (') && content.includes('<')) {
    return 'react';
  }
  
  // Python detection
  if (content.includes('def ') || content.includes('import ') && content.includes('print(')) {
    return 'python';
  }
  
  // TypeScript detection
  if (content.includes(': string') || content.includes(': number') || content.includes('interface ')) {
    return 'typescript';
  }
  
  // HTML detection
  if (content.includes('<!DOCTYPE') || content.includes('<html')) {
    return 'html';
  }
  
  // CSS detection
  if (content.includes('{') && content.includes('}') && content.includes(':') && content.match(/[\w-]+\s*:/)) {
    return 'css';
  }
  
  // Default to JavaScript for code-like content
  return 'javascript';
});

// Get appropriate icon for content type
const getContentIcon = computed(() => {
  return isCode.value ? Code : FileText;
});

// Get appropriate label for content type
const getContentLabel = computed(() => {
  if (isCode.value) {
    return `${detectedLanguage.value} snippet`;
  } else {
    return 'text content';
  }
});

// Generate preview content (first few lines)
const previewContent = computed(() => {
  const lines = props.content.split('\n');
  return lines.slice(0, 4).join('\n');
});

const lineCount = computed(() => {
  return props.content.split('\n').length;
});

// Check if content has been edited
onMounted(() => {
  const editedVersionsJson = localStorage.getItem(`edited-code-${props.nodeId}-${props.codeIndex}`);
  if (editedVersionsJson) {
    try {
      const editedVersion = JSON.parse(editedVersionsJson);
      isEdited.value = editedVersion.isEdited || false;
    } catch (e) {
      console.error('Error parsing edited code data:', e);
    }
  }

  // Theme observation
  const themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'data-theme') {
        currentTheme.value = document.documentElement.getAttribute('data-theme') || 'light';
      }
    });
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
});

const toggleExpanded = () => {
  expanded.value = !expanded.value;
};

const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(props.content);
    // Could add toast notification here
  } catch (err) {
    console.error('Failed to copy content:', err);
  }
};

const openInSandbox = () => {
  if (!isCode.value) return;
  
  const chatStore = useChatStore();
  
  // Emit event to open in sandbox/editor with complete project info
  emitter.emit('show-sandbox', {
    code: props.content,
    language: detectedLanguage.value,
    isStreaming: props.isStreaming,
    nodeId: props.nodeId,
    codeIndex: props.codeIndex,
    messageIndex: props.messageIndex,
    chatId: chatStore.currentChatId,
    complete: !props.isStreaming
  });
  
  appStore.openSidePanel();
  
  // Emit the click event for compatibility
  emit('click', {
    content: props.content,
    language: detectedLanguage.value,
    nodeId: props.nodeId,
    codeIndex: props.codeIndex,
    messageIndex: props.messageIndex,
    complete: !props.isStreaming
  });
};

</script>

<style scoped>
.code-preview-thumbnail {
  transition: all 0.2s ease;
  border-color: rgba(var(--bc), 0.2);
  position: relative;
}

.code-preview-thumbnail:hover {
  border-color: rgba(var(--bc), 0.3);
  transform: translateY(-1px);
}

.code-preview-card {
  transition: all 0.3s ease;
  border-color: rgba(var(--bc), 0.2);
}

.max-h-96 {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
}

.max-h-96::-webkit-scrollbar {
  width: 6px;
}

.max-h-96::-webkit-scrollbar-track {
  background: transparent;
}

.max-h-96::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

.line-clamp-4 {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Theme-specific styling */
.theme-cyberpunk .code-preview-thumbnail,
.theme-cyberpunk .code-preview-card {
  border-color: var(--p);
  box-shadow: 0 0 8px rgba(var(--p), 0.3);
}

.theme-synthwave .code-preview-thumbnail,
.theme-synthwave .code-preview-card {
  background: linear-gradient(135deg, rgba(45, 10, 80, 0.4), rgba(10, 10, 40, 0.4));
  border-color: rgba(255, 100, 255, 0.5);
}

.theme-luxury .code-preview-thumbnail,
.theme-luxury .code-preview-card {
  border-color: rgba(255, 215, 0, 0.5);
}

/* Syntax highlighting */
code[class*="language-"] {
  color: var(--base-content);
}

.language-javascript code,
.language-jsx code,
.language-react code {
  color: #f7df1e;
}

.language-python code {
  color: #3776ab;
}

.language-vue code {
  color: #4fc08d;
}

.language-html code {
  color: #e34c26;
}

.language-css code {
  color: #1572b6;
}

.language-typescript code {
  color: #3178c6;
}
</style>