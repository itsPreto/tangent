<template>
  <div class="code-preview-container my-2">
    <!-- Default thumbnail preview mode -->
    <div v-if="!expanded" 
         class="code-preview-card group relative overflow-hidden cursor-pointer transition-all duration-300 
                hover:shadow-xl hover:scale-[1.02] transform-gpu" 
         :class="`theme-${currentTheme}`"
         @click="toggleExpanded">
      
      <!-- Background with gradient -->
      <div class="absolute inset-0 bg-gradient-to-br from-base-100 via-base-200/50 to-base-300/30"></div>
      
      <!-- Main content -->
      <div class="relative flex h-32">
        <!-- Thumbnail Section -->
        <div v-if="isCode" class="flex-shrink-0 w-40 p-3 flex items-center justify-center bg-gradient-to-br from-base-300/20 to-base-300/40">
          <div class="w-32 h-24 rounded-lg overflow-hidden shadow-lg bg-white border-2 border-base-300/50 
                      transition-all duration-300 group-hover:shadow-xl group-hover:border-primary/30 cursor-pointer"
               @click.stop="openThumbnailModal">
            <img v-if="thumbnailUrl" 
                 :src="thumbnailUrl" 
                 alt="Live preview" 
                 class="w-full h-full object-cover"
                 @error="thumbnailUrl = null" />
            <div v-else class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-base-100 to-base-200 text-base-content/40">
              <Code class="w-8 h-8 mb-1 opacity-60" />
              <span class="text-xs font-medium">Live Preview</span>
            </div>
          </div>
          
          <!-- Loading indicator -->
          <div v-if="thumbnailLoading" class="absolute inset-0 flex items-center justify-center bg-base-200/80 rounded-lg">
            <div class="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
        
        <!-- Content Section -->
        <div class="flex-1 flex flex-col min-w-0">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-base-300/30">
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <component :is="getContentIcon" class="w-4 h-4 text-primary" />
                </div>
                <div class="min-w-0">
                  <h3 class="font-semibold text-sm text-base-content/90 truncate">{{ getContentLabel }}</h3>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                      {{ lineCount }} lines
                    </span>
                    <span v-if="wordCount && !isCode" class="px-2 py-0.5 bg-secondary/10 text-secondary rounded-full text-xs font-medium">
                      {{ wordCount }} words
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="flex items-center gap-2">
              <span v-if="isStreaming" class="flex items-center gap-1.5 px-2 py-1 bg-success/10 text-success rounded-full text-xs font-medium">
                <span class="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                streaming
              </span>
              <div class="w-6 h-6 rounded-full bg-base-300/30 flex items-center justify-center transition-all duration-200 group-hover:bg-primary/20">
                <ChevronDown class="w-4 h-4 text-base-content/60 transition-all duration-200 group-hover:text-primary" />
              </div>
            </div>
          </div>
          
          <!-- Code Preview -->
          <div class="flex-1 p-4 relative overflow-hidden">
            <div v-if="isCode" class="h-full">
              <pre class="text-xs font-mono leading-relaxed text-base-content/70 overflow-hidden"><code ref="previewCodeRef" :class="`language-${detectedLanguage}`" v-html="highlightedPreview"></code></pre>
            </div>
            <div v-else class="text-sm text-base-content/80 leading-relaxed line-clamp-4">{{ previewContent }}</div>
            
            <!-- Fade overlay -->
            <div class="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-base-100 via-base-100/80 to-transparent pointer-events-none"></div>
          </div>
        </div>
      </div>
      
      <!-- Hover glow effect -->
      <div class="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
           style="box-shadow: inset 0 0 0 1px rgba(var(--p) / 0.2), 0 0 20px rgba(var(--p) / 0.1);"></div>
    </div>

    <!-- Thumbnail Modal -->
    <Teleport to="body">
      <div v-if="showThumbnailModal" 
           class="thumbnail-modal-overlay"
           @click="closeThumbnailModal">
        <div class="thumbnail-modal"
             :class="{ 'closing': isClosingModal }"
             :style="modalAnimStyle"
             @click.stop>
          <div class="modal-header">
            <h2 class="text-xl font-bold text-base-content">Live Preview</h2>
            <button @click="closeThumbnailModal" 
                    class="w-8 h-8 rounded-full bg-base-300/50 hover:bg-base-300 flex items-center justify-center transition-colors">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="modal-content">
            <img v-if="thumbnailUrl" 
                 :src="thumbnailUrl" 
                 alt="Live preview" 
                 class="w-full h-auto rounded-lg shadow-lg" />
            <div v-else class="w-full h-64 flex items-center justify-center bg-base-200 rounded-lg">
              <div class="text-center text-base-content/60">
                <Code class="w-16 h-16 mx-auto mb-4 opacity-60" />
                <p>No preview available</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Expanded full view mode -->
    <div v-if="expanded" class="code-preview-card border border-base-300 
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
          <button ref="copyButtonRef" @click.stop="copyContent" 
                  class="p-2 rounded-full hover:bg-base-300/80 transition-colors duration-200 
                         text-base-content/60 hover:text-base-content/80"
                  @mouseenter="showCopyTooltip = true"
                  @mouseleave="showCopyTooltip = false">
            <Copy class="w-4 h-4" />
          </button>
          <button v-if="isCode" ref="openButtonRef" @click.stop="openInSandbox" 
                  class="p-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary 
                         transition-colors duration-200"
                  @mouseenter="showOpenTooltip = true"
                  @mouseleave="showOpenTooltip = false">
            <ExternalLink class="w-4 h-4" />
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

    <!-- Teleported Tooltips -->
    <Teleport to="body">
      <div v-if="showCopyTooltip && copyButtonRef" 
           class="fixed px-2 py-1 bg-base-300/90 backdrop-blur rounded text-xs whitespace-nowrap pointer-events-none z-[9999] transition-opacity duration-200"
           :style="copyTooltipStyle">
        Copy
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showOpenTooltip && openButtonRef" 
           class="fixed px-2 py-1 bg-base-300/90 backdrop-blur rounded text-xs whitespace-nowrap pointer-events-none z-[9999] transition-opacity duration-200"
           :style="openTooltipStyle">
        Open
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { 
  Code, 
  FileText, 
  Copy, 
  ExternalLink, 
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-vue-next';
import Badge from '../ui/Badge.vue';
import emitter from '@/utils/eventBus';
import { useChatStore } from "@/stores/chatStore"
import { useAppStore } from '@/stores/appStore';
import { useThemeStore } from '@/stores/themeStore';
import { thumbnailService } from '@/services/thumbnailService';
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

// Tooltip refs and state
const copyButtonRef = ref<HTMLElement>();
const openButtonRef = ref<HTMLElement>();
const showCopyTooltip = ref(false);
const showOpenTooltip = ref(false);

// Thumbnail state
const thumbnailUrl = ref<string | null>(null);
const thumbnailLoading = ref(false);

// Thumbnail modal state
const showThumbnailModal = ref(false);
const isClosingModal = ref(false);
const modalAnimStyle = ref({});

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

// Tooltip positioning
const copyTooltipStyle = computed(() => {
  if (!copyButtonRef.value) return {};
  const rect = copyButtonRef.value.getBoundingClientRect();
  return {
    top: `${rect.top - 40}px`,
    left: `${rect.left + rect.width / 2}px`,
    transform: 'translateX(-50%)'
  };
});

const openTooltipStyle = computed(() => {
  if (!openButtonRef.value) return {};
  const rect = openButtonRef.value.getBoundingClientRect();
  return {
    top: `${rect.top - 40}px`,
    left: `${rect.left + rect.width / 2}px`,
    transform: 'translateX(-50%)'
  };
});

// Load thumbnail for this code preview
const loadThumbnail = async () => {
  if (!isCode.value) return; // Only load thumbnails for code content
  
  thumbnailLoading.value = true;
  try {
    // First try with the exact codeIndex
    let thumbnail = await thumbnailService.getThumbnail(undefined, props.nodeId, props.codeIndex);
    
    // If not found and codeIndex is not 0, try with codeIndex=0 as fallback
    if (!thumbnail && props.codeIndex !== 0) {
      thumbnail = await thumbnailService.getThumbnail(undefined, props.nodeId, 0);
    }
    
    if (thumbnail) {
      // Convert relative URL to absolute URL
      const baseUrl = 'http://127.0.0.1:5050';
      thumbnailUrl.value = thumbnail.thumbnail_url.startsWith('http') 
        ? thumbnail.thumbnail_url 
        : `${baseUrl}${thumbnail.thumbnail_url}`;
    }
  } catch (error) {
    console.error('Error loading thumbnail:', error);
  } finally {
    thumbnailLoading.value = false;
  }
};

// Listen for thumbnail capture events
const handleThumbnailCaptured = (event: { nodeId: string, codeIndex?: number }) => {
  // Reload thumbnail if this is for our node
  if (event.nodeId === props.nodeId) {
    console.log('Thumbnail captured for this node, reloading...');
    loadThumbnail();
  }
};

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

  // Load thumbnail
  loadThumbnail();
  
  // Listen for thumbnail capture events
  emitter.on('thumbnail-captured', handleThumbnailCaptured);
});

onUnmounted(() => {
  emitter.off('thumbnail-captured', handleThumbnailCaptured);
});

// Watch for nodeId and codeIndex changes to reload thumbnail
watch([() => props.nodeId, () => props.codeIndex], () => {
  loadThumbnail();
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

// Thumbnail modal functions
const openThumbnailModal = (event: MouseEvent) => {
  if (!thumbnailUrl.value) return;
  
  // Get the thumbnail element position
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  
  // Modal final dimensions
  const modalFinalWidth = 800;
  const modalFinalHeight = 600;
  
  // Calculate transform values like in GridWorkspaceView
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  
  const finalX = window.innerWidth / 2;
  const finalY = window.innerHeight / 2;
  
  const translateX = startX - finalX;
  const translateY = startY - finalY;
  
  const scale = Math.min(rect.width / modalFinalWidth, rect.height / modalFinalHeight);
  
  modalAnimStyle.value = {
    '--start-translate-x': `${translateX}px`,
    '--start-translate-y': `${translateY}px`,
    '--start-scale': scale,
  };
  
  showThumbnailModal.value = true;
};

const closeThumbnailModal = () => {
  if (isClosingModal.value) return;
  
  isClosingModal.value = true;
  
  setTimeout(() => {
    showThumbnailModal.value = false;
    isClosingModal.value = false;
    modalAnimStyle.value = {};
  }, 300);
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

/* Enhanced card styling */
.code-preview-card {
  border-radius: 12px;
  border: 1px solid rgb(var(--b3) / 0.3);
  background: rgb(var(--b1));
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.06);
}

.code-preview-card:hover {
  border-color: rgb(var(--p) / 0.3);
  box-shadow: 
    0 10px 25px rgba(0, 0, 0, 0.15),
    0 4px 10px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgb(var(--p) / 0.1);
}

/* Thumbnail styling */
.code-preview-card img {
  transition: transform 0.3s ease;
}

.code-preview-card:hover img {
  transform: scale(1.05);
}

/* Thumbnail Modal Styles */
.thumbnail-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-out;
}

.thumbnail-modal {
  width: 90vw;
  max-width: 800px;
  max-height: 90vh;
  background: rgb(var(--b1));
  border-radius: 16px;
  border: 1px solid rgb(var(--b3) / 0.3);
  box-shadow: 
    0 25px 50px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgb(var(--p) / 0.1);
  overflow: hidden;
  animation: thumbnailModalExpandFromOrigin 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.thumbnail-modal.closing {
  animation: thumbnailModalCollapseToOrigin 0.3s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid rgb(var(--b3) / 0.3);
  background: rgb(var(--b1));
}

.modal-content {
  padding: 1.5rem;
  max-height: calc(90vh - 100px);
  overflow-y: auto;
}

/* Modal Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes thumbnailModalExpandFromOrigin {
  from {
    transform: translate(var(--start-translate-x, 0), var(--start-translate-y, 0)) scale(var(--start-scale, 0.1));
  }
  to {
    transform: translate(0, 0) scale(1);
  }
}

@keyframes thumbnailModalCollapseToOrigin {
  from {
    transform: translate(0, 0) scale(1);
  }
  to {
    transform: translate(var(--start-translate-x, 0), var(--start-translate-y, 0)) scale(var(--start-scale, 0.1));
  }
}

/* Theme-specific enhancements */
.theme-cyberpunk .code-preview-card {
  border-color: rgb(var(--p) / 0.4);
  box-shadow: 
    0 0 12px rgb(var(--p) / 0.15),
    0 4px 20px rgba(0, 0, 0, 0.2);
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
  background: rgb(24 100 134);
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