<template>
  <div class="code-preview-container my-2">
    <!-- Modern compact preview mode -->
    <div v-if="!expanded" 
         class="modern-code-card group relative overflow-hidden cursor-pointer" 
         :class="`theme-${currentTheme}`"
         @click="toggleExpanded">
      
      <!-- Contrast overlay for better visibility -->
      <div class="card-contrast-layer"></div>
      
      <!-- Card content -->
      <div class="card-content">
        <!-- Header section -->
        <div class="card-header">
          <div class="card-icon-section">
            <div class="language-icon">
              <component :is="getContentIcon" class="w-5 h-5" />
            </div>
            <div class="language-info">
              <h3 class="language-title">{{ getContentLabel }}</h3>
              <div class="meta-badges">
                <span class="line-badge">{{ lineCount }} lines</span>
                <span v-if="wordCount && !isCode" class="word-badge">{{ wordCount }} words</span>
                <span v-if="isStreaming" class="streaming-badge">
                  <span class="streaming-dot"></span>
                  live
                </span>
              </div>
            </div>
          </div>
          
          <div class="expand-indicator" title="Expand code view">
            <ChevronDown class="w-4 h-4" />
          </div>
        </div>
        
        <!-- Preview content -->
        <div class="preview-section">
          <!-- Code thumbnail if available -->
          <div v-if="isCode && thumbnailUrl" class="code-thumbnail" @click.stop="openThumbnailModal">
            <img :src="thumbnailUrl" alt="Live preview" class="thumbnail-img" @error="thumbnailUrl = null" />
            <div class="thumbnail-overlay">
              <div class="thumbnail-label">Live Preview</div>
            </div>
          </div>
          
          <!-- Code preview text -->
          <div class="code-preview-text">
            <pre v-if="isCode" class="preview-code"><code :class="`language-${detectedLanguage}`" v-html="highlightedPreview"></code></pre>
            <div v-else class="preview-plain">{{ previewContent }}</div>
          </div>
        </div>
      </div>
      
      <!-- Hover effects -->
      <div class="card-glow"></div>
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
    <div v-if="expanded" class="code-preview-card expanded-bg border expanded-border
                       rounded-md overflow-hidden shadow-lg transition-all duration-300" 
         :class="`theme-${currentTheme}`">
      <div class="flex items-center justify-between p-3 backdrop-blur border-b header-border">
        <div class="flex items-center gap-2">
          <component :is="getContentIcon" class="w-5 h-5 icon-color-expanded" />
          <span class="font-medium expanded-label-text">{{ getContentLabel }}</span>
          <span class="px-2 py-1 expanded-badge-bg border expanded-badge-border rounded text-xs expanded-badge-text">
            {{ lineCount }} lines
          </span>
          <span v-if="wordCount && !isCode" class="px-2 py-1 expanded-badge-bg border expanded-badge-border rounded text-xs expanded-badge-text">
            {{ wordCount }} words
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button ref="copyButtonRef" @click.stop="copyContent" 
                  class="p-2 rounded-full expanded-btn-bg hover:expanded-btn-hover transition-colors duration-200 
                         expanded-btn-color hover:expanded-btn-hover-color"
                  @mouseenter="showCopyTooltip = true"
                  @mouseleave="showCopyTooltip = false">
            <Copy class="w-4 h-4" />
          </button>
          <button v-if="isCode" ref="openButtonRef" @click.stop="openInSandbox" 
                  class="p-2 rounded-full expanded-primary-btn-bg hover:expanded-primary-btn-hover expanded-primary-btn-text 
                         transition-colors duration-200"
                  @mouseenter="showOpenTooltip = true"
                  @mouseleave="showOpenTooltip = false">
            <ExternalLink class="w-4 h-4" />
          </button>
          <button @click.stop="toggleExpanded" 
                  class="p-2 rounded-full expanded-btn-bg hover:expanded-btn-hover transition-colors duration-200 
                         expanded-btn-color hover:expanded-btn-hover-color">
            <ChevronUp class="w-4 h-4" />
          </button>
        </div>
      </div>
      <div class="p-4 expanded-content-bg backdrop-blur max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-transparent">
        <pre v-if="isCode" class="text-sm font-mono whitespace-pre-wrap"><code ref="fullCodeRef" :class="`language-${detectedLanguage}`" v-html="highlightedCode"></code></pre>
        <div v-else class="text-sm expanded-content-text whitespace-pre-wrap">{{ content }}</div>
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

/* Modern card design with maximum contrast */
.modern-code-card {
  position: relative;
  border-radius: 12px;
  /* Strong contrasting background */
  background: hsl(var(--b1));
  border: 2px solid hsl(var(--bc) / 0.15);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  /* Very strong shadow for maximum visibility */
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.2),
    0 4px 8px rgba(0, 0, 0, 0.15),
    0 8px 16px rgba(0, 0, 0, 0.1),
    0 16px 32px rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.1);
  /* Ensure solid background */
  background-color: hsl(var(--b1));
}

.modern-code-card:hover {
  transform: translateY(-6px) scale(1.01);
  border-color: hsl(var(--p) / 0.4);
  border-width: 2px;
  /* Even stronger hover shadow */
  box-shadow: 
    0 4px 8px rgba(0, 0, 0, 0.25),
    0 8px 16px rgba(0, 0, 0, 0.2),
    0 16px 32px rgba(0, 0, 0, 0.15),
    0 24px 48px rgba(0, 0, 0, 0.1),
    0 32px 64px rgba(0, 0, 0, 0.05),
    0 0 0 2px hsl(var(--p) / 0.3);
}

.card-contrast-layer {
  position: absolute;
  inset: 0;
  /* Subtle inner shadow for depth */
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);
  pointer-events: none;
  z-index: 1;
  border-radius: 12px;
}

.card-content {
  position: relative;
  z-index: 2;
  padding: 1rem;
  /* Remove the translucent background */
  background: transparent;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.card-icon-section {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex: 1;
}

.language-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 12px;
  background: linear-gradient(135deg, 
    hsl(var(--p) / 0.15) 0%, 
    hsl(var(--p) / 0.08) 100%);
  color: hsl(var(--p));
  flex-shrink: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 2px 8px hsl(var(--p) / 0.12),
    0 1px 4px hsl(var(--p) / 0.08),
    inset 0 1px 0 hsl(var(--p) / 0.2);
  border: 1px solid hsl(var(--p) / 0.2);
}

.modern-code-card:hover .language-icon {
  background: linear-gradient(135deg, 
    hsl(var(--p) / 0.25) 0%, 
    hsl(var(--p) / 0.15) 100%);
  transform: scale(1.08) translateY(-1px);
  box-shadow: 
    0 4px 16px hsl(var(--p) / 0.2),
    0 2px 8px hsl(var(--p) / 0.15),
    inset 0 1px 0 hsl(var(--p) / 0.3),
    0 0 20px hsl(var(--p) / 0.1);
}

.language-info {
  flex: 1;
  min-width: 0;
}

.language-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--bc) / 0.9);
  margin-bottom: 0.375rem;
  line-height: 1.2;
}

.meta-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.line-badge, .word-badge, .streaming-badge {
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 0.125rem 0.5rem;
  border-radius: 8px;
  line-height: 1.2;
}

.line-badge {
  background: hsl(var(--p) / 0.1);
  color: hsl(var(--p));
  border: 1px solid hsl(var(--p) / 0.2);
}

.word-badge {
  background: hsl(var(--s) / 0.1);
  color: hsl(var(--s));
  border: 1px solid hsl(var(--s) / 0.2);
}

.streaming-badge {
  background: hsl(var(--su) / 0.1);
  color: hsl(var(--su));
  border: 1px solid hsl(var(--su) / 0.2);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.streaming-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: hsl(var(--su));
  animation: pulse-dot 1.5s ease-in-out infinite;
}

.expand-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 8px;
  background: linear-gradient(135deg, 
    hsl(var(--b2) / 0.8) 0%, 
    hsl(var(--b3) / 0.6) 100%);
  color: hsl(var(--bc) / 0.6);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  box-shadow: 
    0 1px 3px hsl(var(--bc) / 0.08),
    inset 0 1px 0 hsl(var(--b1) / 0.5);
  border: 1px solid hsl(var(--b3) / 0.3);
}

.modern-code-card:hover .expand-indicator {
  background: linear-gradient(135deg, 
    hsl(var(--p) / 0.15) 0%, 
    hsl(var(--p) / 0.08) 100%);
  color: hsl(var(--p));
  transform: rotate(180deg) scale(1.1);
  box-shadow: 
    0 2px 8px hsl(var(--p) / 0.15),
    inset 0 1px 0 hsl(var(--p) / 0.2),
    0 0 12px hsl(var(--p) / 0.08);
}

.preview-section {
  position: relative;
}

.code-thumbnail {
  position: absolute;
  top: 0;
  right: 0;
  width: 80px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid hsl(var(--b3) / 0.4);
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(var(--b2)) 100%);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 3;
  box-shadow: 
    0 2px 8px hsl(var(--bc) / 0.08),
    0 1px 4px hsl(var(--bc) / 0.06),
    inset 0 1px 0 hsl(var(--b1) / 0.8);
}

.code-thumbnail:hover {
  transform: scale(1.08) translateY(-2px);
  border-color: hsl(var(--p) / 0.5);
  box-shadow: 
    0 6px 20px hsl(var(--bc) / 0.12),
    0 3px 10px hsl(var(--bc) / 0.08),
    0 0 0 2px hsl(var(--p) / 0.2),
    0 0 16px hsl(var(--p) / 0.1);
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, hsl(var(--bc) / 0.8));
  padding: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.code-thumbnail:hover .thumbnail-overlay {
  opacity: 1;
}

.thumbnail-label {
  font-size: 0.5rem;
  color: hsl(var(--pc));
  font-weight: 500;
  text-align: center;
}

.code-preview-text {
  margin-right: 90px; /* Space for thumbnail */
  max-height: 4rem;
  overflow: hidden;
  position: relative;
}

.preview-code {
  font-size: 0.75rem;
  line-height: 1.4;
  font-family: ui-monospace, SFMono-Regular, Monaco, Consolas, monospace;
  color: hsl(var(--bc) / 0.8);
  margin: 0;
  white-space: pre;
  overflow: hidden;
}

.preview-plain {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: hsl(var(--bc) / 0.8);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-glow {
  position: absolute;
  inset: -2px;
  border-radius: 18px;
  opacity: 0;
  background: linear-gradient(135deg, 
    hsl(var(--p) / 0.15) 0%, 
    hsl(var(--s) / 0.08) 30%,
    hsl(var(--a) / 0.06) 70%, 
    hsl(var(--p) / 0.1) 100%);
  transition: opacity 0.4s ease;
  pointer-events: none;
  z-index: 0;
  filter: blur(1px);
  box-shadow: 
    0 0 20px hsl(var(--p) / 0.15),
    0 0 40px hsl(var(--p) / 0.08),
    0 0 60px hsl(var(--p) / 0.04);
}

.modern-code-card:hover .card-glow {
  opacity: 1;
  filter: blur(2px);
  box-shadow: 
    0 0 30px hsl(var(--p) / 0.2),
    0 0 60px hsl(var(--p) / 0.12),
    0 0 100px hsl(var(--p) / 0.06);
}

/* Animations */
@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.3;
    transform: scale(1.2);
  }
}

/* Theme-specific enhancements for modern cards */
.theme-cyberpunk .modern-code-card {
  border-color: hsl(var(--p) / 0.5);
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(var(--p) / 0.02) 50%, 
    hsl(var(--s) / 0.01) 100%);
  box-shadow: 
    0 2px 8px hsl(var(--p) / 0.15),
    0 4px 16px hsl(var(--p) / 0.08),
    0 8px 32px hsl(var(--p) / 0.04),
    0 0 0 1px hsl(var(--p) / 0.2),
    inset 0 1px 0 hsl(var(--b1) / 0.9);
}

.theme-cyberpunk .modern-code-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 
    0 8px 24px hsl(var(--p) / 0.25),
    0 16px 48px hsl(var(--p) / 0.15),
    0 24px 80px hsl(var(--p) / 0.08),
    0 0 0 2px hsl(var(--p) / 0.4),
    0 0 60px hsl(var(--p) / 0.2),
    inset 0 1px 0 hsl(var(--b1));
}

.theme-cyberpunk .card-glow {
  background: linear-gradient(135deg, 
    hsl(var(--p) / 0.2) 0%, 
    hsl(var(--s) / 0.15) 30%,
    hsl(var(--a) / 0.12) 70%, 
    hsl(var(--p) / 0.18) 100%);
  box-shadow: 
    0 0 40px hsl(var(--p) / 0.25),
    0 0 80px hsl(var(--p) / 0.15),
    0 0 120px hsl(var(--p) / 0.08);
}

.theme-synthwave .modern-code-card {
  border-color: hsl(var(--p) / 0.6);
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(var(--p) / 0.04) 30%,
    hsl(var(--s) / 0.03) 70%,
    hsl(var(--a) / 0.02) 100%);
  box-shadow: 
    0 2px 8px hsl(var(--p) / 0.12),
    0 4px 16px hsl(var(--p) / 0.06),
    0 0 24px hsl(var(--p) / 0.08),
    inset 0 1px 0 hsl(var(--b1) / 0.8);
}

.theme-synthwave .modern-code-card:hover {
  box-shadow: 
    0 8px 24px hsl(var(--p) / 0.2),
    0 16px 48px hsl(var(--p) / 0.12),
    0 0 60px hsl(var(--p) / 0.15),
    0 0 0 2px hsl(var(--p) / 0.3);
}

.theme-dracula .modern-code-card,
.theme-night .modern-code-card,
.theme-business .modern-code-card,
.theme-halloween .modern-code-card {
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(var(--b1) / 0.95) 50%, 
    hsl(var(--b2) / 0.9) 100%);
  border-color: hsl(var(--b3) / 0.5);
  box-shadow: 
    0 3px 12px hsl(var(--bc) / 0.12),
    0 6px 24px hsl(var(--bc) / 0.08),
    0 12px 48px hsl(var(--bc) / 0.04),
    inset 0 1px 0 hsl(var(--b1) / 0.8);
}

.theme-dracula .modern-code-card:hover,
.theme-night .modern-code-card:hover,
.theme-business .modern-code-card:hover,
.theme-halloween .modern-code-card:hover {
  box-shadow: 
    0 6px 24px hsl(var(--bc) / 0.15),
    0 12px 48px hsl(var(--bc) / 0.1),
    0 24px 80px hsl(var(--bc) / 0.06),
    0 0 0 1px hsl(var(--p) / 0.3),
    0 0 40px hsl(var(--p) / 0.1);
}

.theme-dracula .preview-code,
.theme-night .preview-code,
.theme-business .preview-code,
.theme-halloween .preview-code {
  color: hsl(var(--bc) / 0.9);
}

.theme-valentine .modern-code-card,
.theme-retro .modern-code-card,
.theme-winter .modern-code-card,
.theme-cupcake .modern-code-card,
.theme-light .modern-code-card {
  background: hsl(var(--b1));
  border: 2px solid hsl(var(--bc) / 0.2);
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.15),
    0 4px 8px rgba(0, 0, 0, 0.12),
    0 8px 16px rgba(0, 0, 0, 0.08),
    0 16px 32px rgba(0, 0, 0, 0.04);
}

/* Extra contrast for light themes */
.theme-valentine .card-content,
.theme-retro .card-content,
.theme-winter .card-content,
.theme-cupcake .card-content,
.theme-light .card-content {
  background: linear-gradient(180deg, 
    rgba(255, 255, 255, 0.95) 0%, 
    rgba(255, 255, 255, 0.85) 100%);
  backdrop-filter: blur(8px);
}

.theme-forest .modern-code-card {
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(var(--p) / 0.02) 100%);
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

/* Universal theme-aware components */
.theme-bg {
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(var(--b2) / 0.8) 50%, 
    hsl(var(--b3) / 0.6) 100%);
}

.thumbnail-bg {
  background: linear-gradient(135deg, 
    hsl(var(--b2) / 0.5) 0%, 
    hsl(var(--b3) / 0.3) 100%);
}

.thumbnail-container {
  background: hsl(var(--b1));
  border-color: hsl(var(--b3) / 0.5);
}

.placeholder-bg {
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(var(--b2)) 100%);
}

.header-border {
  border-color: hsl(var(--b3) / 0.4);
}

.icon-bg {
  background: hsl(var(--p) / 0.15);
}

.icon-color {
  color: hsl(var(--p));
}

.header-text {
  color: hsl(var(--bc) / 0.95);
}

.badge-bg {
  background: hsl(var(--p) / 0.15);
}

.badge-text {
  color: hsl(var(--p));
}

.badge-secondary-bg {
  background: hsl(var(--s) / 0.15);
}

.badge-secondary-text {
  color: hsl(var(--s));
}

.streaming-bg {
  background: hsl(var(--su) / 0.15);
}

.streaming-text {
  color: hsl(var(--su));
}

.streaming-indicator {
  background: hsl(var(--su));
}

.chevron-bg {
  background: hsl(var(--b3) / 0.3);
}

.chevron-color {
  color: hsl(var(--bc) / 0.7);
}

.group:hover .chevron-hover-bg {
  background: hsl(var(--p) / 0.2);
}

.group:hover .chevron-hover-color {
  color: hsl(var(--p));
}

.preview-bg {
  background: linear-gradient(180deg, 
    hsl(var(--b1) / 0.95) 0%, 
    hsl(var(--b2) / 0.8) 100%);
}

.code-text {
  color: hsl(var(--bc) / 0.85);
}

.preview-text {
  color: hsl(var(--bc) / 0.9);
}

.fade-overlay {
  background: linear-gradient(to top, 
    hsl(var(--b1)) 0%, 
    hsl(var(--b1) / 0.8) 50%, 
    transparent 100%);
}

.hover-glow {
  box-shadow: inset 0 0 0 1px hsl(var(--p) / 0.3), 
              0 0 25px hsl(var(--p) / 0.15);
}

/* Expanded view styles */
.expanded-bg {
  background: hsl(var(--b1));
}

.expanded-border {
  border-color: hsl(var(--b3) / 0.4);
}

.icon-color-expanded {
  color: hsl(var(--bc) / 0.7);
}

.expanded-label-text {
  color: hsl(var(--bc) / 0.9);
}

.expanded-badge-bg {
  background: hsl(var(--b2));
}

.expanded-badge-border {
  border-color: hsl(var(--b3));
}

.expanded-badge-text {
  color: hsl(var(--bc) / 0.8);
}

.expanded-btn-bg {
  background: transparent;
}

.expanded-btn-color {
  color: hsl(var(--bc) / 0.7);
}

.expanded-btn-hover {
  background: hsl(var(--b3) / 0.5);
}

.expanded-btn-hover-color {
  color: hsl(var(--bc));
}

.expanded-primary-btn-bg {
  background: hsl(var(--p) / 0.2);
}

.expanded-primary-btn-text {
  color: hsl(var(--p));
}

.expanded-primary-btn-hover {
  background: hsl(var(--p) / 0.3);
}

.expanded-content-bg {
  background: hsl(var(--b1) / 0.95);
}

.expanded-content-text {
  color: hsl(var(--bc) / 0.95);
}

/* Theme-specific enhanced contrast */
.theme-cyberpunk .code-preview-card {
  border-color: hsl(var(--p) / 0.6);
  box-shadow: 
    0 0 15px hsl(var(--p) / 0.2),
    0 4px 25px rgba(0, 0, 0, 0.3);
}

.theme-cyberpunk .theme-bg {
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(var(--p) / 0.08) 50%, 
    hsl(var(--s) / 0.06) 100%);
}

.theme-cyberpunk .hover-glow {
  box-shadow: inset 0 0 0 1px hsl(var(--p) / 0.4), 
              0 0 30px hsl(var(--p) / 0.3);
}

.theme-synthwave .theme-bg {
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(var(--p) / 0.12) 30%, 
    hsl(var(--s) / 0.1) 70%, 
    hsl(var(--a) / 0.08) 100%);
}

.theme-synthwave .code-preview-card {
  border-color: hsl(var(--p) / 0.5);
  box-shadow: 0 0 12px hsl(var(--p) / 0.25);
}

.theme-dracula .theme-bg {
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(231 15% 18%) 50%, 
    hsl(232 14% 31%) 100%);
}

.theme-dracula .code-text,
.theme-dracula .preview-text {
  color: hsl(var(--bc));
}

.theme-night .theme-bg {
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(210 30% 12%) 50%, 
    hsl(215 25% 18%) 100%);
}

.theme-business .theme-bg {
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(215 20% 15%) 50%, 
    hsl(220 15% 20%) 100%);
}

/* Dark theme enhanced code highlighting */
.theme-night .code-text,
.theme-business .code-text,
.theme-dracula .code-text {
  color: hsl(var(--bc) / 0.95);
}

.theme-halloween .theme-bg {
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(250 60% 8%) 50%, 
    hsl(24 100% 12%) 100%);
}

.theme-forest .theme-bg {
  background: linear-gradient(135deg, 
    hsl(var(--b1)) 0%, 
    hsl(155 30% 12%) 50%, 
    hsl(160 25% 18%) 100%);
}

/* Enhanced syntax highlighting with theme-aware contrast */
:deep(.token.comment),
:deep(.token.prolog),
:deep(.token.doctype),
:deep(.token.cdata) {
  color: hsl(var(--bc) / 0.55);
  font-style: italic;
  font-weight: 400;
}

:deep(.token.punctuation) {
  color: hsl(var(--bc) / 0.75);
  font-weight: 500;
}

:deep(.token.property),
:deep(.token.tag),
:deep(.token.boolean),
:deep(.token.number),
:deep(.token.constant),
:deep(.token.symbol),
:deep(.token.deleted) {
  color: hsl(0 84% 65%);
  font-weight: 600;
}

:deep(.token.selector),
:deep(.token.attr-name),
:deep(.token.string),
:deep(.token.char),
:deep(.token.builtin),
:deep(.token.inserted) {
  color: hsl(142 76% 58%);
  font-weight: 500;
}

:deep(.token.operator),
:deep(.token.entity),
:deep(.token.url),
:deep(.language-css .token.string),
:deep(.style .token.string) {
  color: hsl(45 100% 65%);
  font-weight: 500;
}

:deep(.token.atrule),
:deep(.token.attr-value),
:deep(.token.keyword) {
  color: hsl(213 94% 68%);
  font-weight: 600;
}

:deep(.token.function),
:deep(.token.class-name) {
  color: hsl(199 89% 72%);
  font-weight: 600;
}

:deep(.token.regex),
:deep(.token.important),
:deep(.token.variable) {
  color: hsl(316 73% 69%);
  font-weight: 500;
}

/* Dark theme specific syntax highlighting */
.theme-night :deep(.token.comment),
.theme-business :deep(.token.comment),
.theme-dracula :deep(.token.comment),
.theme-halloween :deep(.token.comment) {
  color: hsl(var(--bc) / 0.45);
}

.theme-night :deep(.token.property),
.theme-business :deep(.token.property),
.theme-dracula :deep(.token.property),
.theme-halloween :deep(.token.property),
.theme-night :deep(.token.tag),
.theme-business :deep(.token.tag),
.theme-dracula :deep(.token.tag),
.theme-halloween :deep(.token.tag),
.theme-night :deep(.token.number),
.theme-business :deep(.token.number),
.theme-dracula :deep(.token.number),
.theme-halloween :deep(.token.number) {
  color: hsl(0 75% 70%);
}

.theme-night :deep(.token.string),
.theme-business :deep(.token.string),
.theme-dracula :deep(.token.string),
.theme-halloween :deep(.token.string) {
  color: hsl(142 65% 65%);
}

.theme-night :deep(.token.keyword),
.theme-business :deep(.token.keyword),
.theme-dracula :deep(.token.keyword),
.theme-halloween :deep(.token.keyword) {
  color: hsl(213 85% 75%);
}

.theme-night :deep(.token.function),
.theme-business :deep(.token.function),
.theme-dracula :deep(.token.function),
.theme-halloween :deep(.token.function) {
  color: hsl(199 80% 78%);
}

/* Light theme adjustments for better contrast */
.theme-valentine :deep(.token.string),
.theme-retro :deep(.token.string),
.theme-winter :deep(.token.string) {
  color: hsl(142 85% 45%);
}

.theme-valentine :deep(.token.keyword),
.theme-retro :deep(.token.keyword),
.theme-winter :deep(.token.keyword) {
  color: hsl(213 100% 55%);
}

.theme-valentine :deep(.token.number),
.theme-retro :deep(.token.number),
.theme-winter :deep(.token.number) {
  color: hsl(0 90% 55%);
}

/* Tooltip positioning fix */
.group\/btn {
  position: relative;
}

.group\/btn span {
  z-index: 50;
}
</style>