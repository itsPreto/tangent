<template>
  <div class="code-preview-container my-2">
    <!-- Default thumbnail preview mode -->
    <div v-if="!expanded" 
         class="code-preview-thumbnail bg-base-200/90 backdrop-blur border border-base-300 
                rounded-md overflow-hidden cursor-pointer transition-all duration-200 
                hover:bg-base-300/90 hover:shadow-md group" 
         :class="`theme-${currentTheme}`"
         @click="toggleExpanded">
      
      <!-- Header -->
      <div class="flex items-center justify-between p-3 bg-base-200/80 backdrop-blur">
        <div class="flex items-center gap-2">
          <component :is="getContentIcon" class="w-4 h-4 text-base-content/60" />
          <span class="font-medium text-sm text-base-content/80">{{ getContentLabel }}</span>
          <span class="px-2 py-1 bg-base-100/90 border border-base-200 rounded text-xs text-base-content/70">
            {{ lineCount }} lines
          </span>
          <span v-if="wordCount && !isCode" class="px-2 py-1 bg-base-100/90 border border-base-200 rounded text-xs text-base-content/70">
            {{ wordCount }} words
          </span>
          <span v-if="isStreaming" class="ml-2 inline-flex items-center">
            <span class="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-ping mr-1"></span>
            <span class="text-xs text-primary font-medium">streaming</span>
          </span>
        </div>
        <ChevronDown class="w-4 h-4 text-base-content/50 transition-transform duration-200 group-hover:text-base-content/70" />
      </div>
      
      <!-- Preview content - horizontal thumbnail -->
      <div class="relative p-3  backdrop-blur max-h-24 overflow-hidden">
        <pre v-if="isCode" class="text-xs font-mono whitespace-pre-wrap leading-relaxed"><code ref="previewCodeRef" :class="`language-${detectedLanguage}`" v-html="highlightedPreview"></code></pre>
        <div v-else class="text-xs text-base-content/80 leading-relaxed line-clamp-4">{{ previewContent }}</div>
        <!-- Fade overlay for overflow indication -->
        <div class="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-base-100/90 to-transparent pointer-events-none"></div>
      </div>
    </div>

    <!-- Expanded full view mode -->
    <div v-else class="code-preview-card border border-base-300 
                       rounded-md overflow-hidden shadow-lg transition-all duration-300" 
         :class="`theme-${currentTheme}`">
      <div class="flex items-center justify-between p-3 backdrop-blur border-b border-base-300/50">
        <div class="flex items-center gap-2">
          <component :is="getContentIcon" class="w-5 h-5 text-base-content/60" />
          <span class="font-medium text-base-content/80">{{ getContentLabel }}</span>
          <span class="px-2 py-1 bg-base-100/90 border border-base-200 rounded text-xs text-base-content/70">
            {{ lineCount }} lines
          </span>
          <span v-if="wordCount && !isCode" class="px-2 py-1 bg-base-100/90 border border-base-200 rounded text-xs text-base-content/70">
            {{ wordCount }} words
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button @click.stop="copyContent" 
                  class="p-2 rounded-full hover:bg-base-300/80 transition-colors duration-200 
                         text-base-content/60 hover:text-base-content/80 group/btn">
            <Copy class="w-4 h-4" />
            <span class="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-base-300/90 
                         backdrop-blur rounded text-xs whitespace-nowrap transition-opacity duration-200 
                         opacity-0 group-hover/btn:opacity-100 pointer-events-none">Copy</span>
          </button>
          <button v-if="isCode" @click.stop="openInSandbox" 
                  class="p-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary 
                         transition-colors duration-200 group/btn">
            <ExternalLink class="w-4 h-4" />
            <span class="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-base-300/90 
                         backdrop-blur rounded text-xs whitespace-nowrap transition-opacity duration-200 
                         opacity-0 group-hover/btn:opacity-100 pointer-events-none">Open</span>
          </button>
          <button @click.stop="toggleExpanded" 
                  class="p-2 rounded-full hover:bg-base-300/80 transition-colors duration-200 
                         text-base-content/60 hover:text-base-content/80">
            <ChevronUp class="w-4 h-4" />
          </button>
        </div>
      </div>
      <div class="p-4 bg-base-100/90 backdrop-blur max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-transparent">
        <pre v-if="isCode" class="text-sm font-mono whitespace-pre-wrap"><code ref="fullCodeRef" :class="`language-${detectedLanguage}`" v-html="highlightedCode"></code></pre>
        <div v-else class="text-sm text-base-content/90 whitespace-pre-wrap">{{ content }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
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
import { useThemeStore } from '@/stores/themeStore';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/themes/prism.css';

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
const themeStore = useThemeStore();

const expanded = ref(props.forceExpanded);
const isEdited = ref(false);
const previewCodeRef = ref<HTMLElement>();
const fullCodeRef = ref<HTMLElement>();

// Use theme store for consistent theming
const currentTheme = computed(() => themeStore.currentTheme);
const themeColors = computed(() => themeStore.currentThemeColors);

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
  
  // Vue SFC detection - use markup for template parts
  if (content.includes('<template>') && content.includes('<script') && content.includes('<style')) {
    return 'markup';
  }
  
  // React/JSX detection
  if (content.includes('export default') && content.includes('return (') && content.includes('<')) {
    return 'jsx';
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
    const lang = detectedLanguage.value;
    // Map some language names to more user-friendly labels
    const labelMap: Record<string, string> = {
      'markup': 'HTML/Vue',
      'jsx': 'React',
      'tsx': 'React/TypeScript',
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'python': 'Python',
      'css': 'CSS',
      'json': 'JSON'
    };
    return `${labelMap[lang] || lang} snippet`;
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

// Syntax highlighting for full content
const highlightedCode = computed(() => {
  if (!isCode.value) return props.content;
  
  const language = detectedLanguage.value;
  if (Prism.languages[language]) {
    return Prism.highlight(props.content, Prism.languages[language], language);
  }
  
  // Fallback to plain text
  return props.content;
});

// Syntax highlighting for preview content
const highlightedPreview = computed(() => {
  if (!isCode.value) return previewContent.value;
  
  const language = detectedLanguage.value;
  if (Prism.languages[language]) {
    return Prism.highlight(previewContent.value, Prism.languages[language], language);
  }
  
  // Fallback to plain text
  return previewContent.value;
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
  position: relative;
}

.code-preview-thumbnail:hover {
  transform: translateY(-1px);
}

.code-preview-card {
  transition: all 0.3s ease;
}

.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: rgb(var(--b3)) transparent;
}


.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgb(var(--b3));
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgb(var(--bc) / 0.3);
}

.line-clamp-4 {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Theme-specific enhancements */
.theme-cyberpunk .code-preview-thumbnail,
.theme-cyberpunk .code-preview-card {
  border-color: rgb(var(--p) / 0.6);
  box-shadow: 0 0 12px rgb(var(--p) / 0.2);
}

.theme-cyberpunk .code-preview-thumbnail:hover,
.theme-cyberpunk .code-preview-card:hover {
  box-shadow: 0 0 20px rgb(var(--p) / 0.4);
}

.theme-synthwave .code-preview-thumbnail,
.theme-synthwave .code-preview-card {
  background: linear-gradient(135deg, rgb(var(--p) / 0.1), rgb(var(--s) / 0.1));
  border-color: rgb(var(--p) / 0.4);
  box-shadow: 0 0 8px rgb(var(--p) / 0.2);
}

.theme-retro .code-preview-thumbnail,
.theme-retro .code-preview-card {
  border-color: rgb(var(--p) / 0.4);
  background: rgb(var(--b1) / 0.95);
}

.theme-luxury .code-preview-thumbnail,
.theme-luxury .code-preview-card {
  border-color: rgb(var(--p) / 0.5);
  box-shadow: 0 2px 8px rgb(var(--p) / 0.1);
}

.theme-dracula .code-preview-thumbnail,
.theme-dracula .code-preview-card {
  border-color: rgb(var(--p) / 0.6);
  background: rgb(12 56 95 / 56%);
}

.theme-forest .code-preview-thumbnail,
.theme-forest .code-preview-card {
  border-color: rgb(var(--p) / 0.5);
  background: rgb(var(--b1) / 0.98);
}

.theme-valentine .code-preview-thumbnail,
.theme-valentine .code-preview-card {
  border-color: rgb(var(--p) / 0.4);
  background: linear-gradient(135deg, rgb(var(--b1) / 0.95), rgb(var(--p) / 0.05));
}

.theme-halloween .code-preview-thumbnail,
.theme-halloween .code-preview-card {
  border-color: rgb(var(--p) / 0.6);
  box-shadow: 0 0 10px rgb(var(--p) / 0.2);
}

.theme-aqua .code-preview-thumbnail,
.theme-aqua .code-preview-card {
  border-color: rgb(var(--p) / 0.5);
  background: linear-gradient(135deg, rgb(var(--b1) / 0.95), rgb(var(--p) / 0.03));
}

.theme-night .code-preview-thumbnail,
.theme-night .code-preview-card {
  border-color: rgb(var(--p) / 0.4);
  background: rgb(var(--b1) / 0.95);
}

.theme-coffee .code-preview-thumbnail,
.theme-coffee .code-preview-card {
  border-color: rgb(var(--p) / 0.5);
  background: rgb(var(--b1) / 0.97);
}

.theme-winter .code-preview-thumbnail,
.theme-winter .code-preview-card {
  border-color: rgb(var(--p) / 0.4);
  background: rgb(var(--b1) / 0.98);
}

.theme-business .code-preview-thumbnail,
.theme-business .code-preview-card {
  border-color: rgb(var(--p) / 0.3);
  background: rgb(43 76 92);
}

/* Prism.js theme customization with better dark theme contrast */
:deep(.token.comment),
:deep(.token.prolog),
:deep(.token.doctype),
:deep(.token.cdata) {
  color: rgb(var(--bc) / 0.6);
  font-style: italic;
}

:deep(.token.punctuation) {
  color: rgb(var(--bc) / 0.8);
}

:deep(.token.property),
:deep(.token.tag),
:deep(.token.boolean),
:deep(.token.number),
:deep(.token.constant),
:deep(.token.symbol),
:deep(.token.deleted) {
  color: #ff6b6b;
}

:deep(.token.selector),
:deep(.token.attr-name),
:deep(.token.string),
:deep(.token.char),
:deep(.token.builtin),
:deep(.token.inserted) {
  color: #51cf66;
}

:deep(.token.operator),
:deep(.token.entity),
:deep(.token.url),
:deep(.language-css .token.string),
:deep(.style .token.string) {
  color: #ffd43b;
}

:deep(.token.atrule),
:deep(.token.attr-value),
:deep(.token.keyword) {
  color: #339af0;
}

:deep(.token.function),
:deep(.token.class-name) {
  color: #74c0fc;
}

:deep(.token.regex),
:deep(.token.important),
:deep(.token.variable) {
  color: #f783ac;
}

/* Tooltip positioning fix */
.group\/btn {
  position: relative;
}

.group\/btn span {
  z-index: 50;
}
</style>