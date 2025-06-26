<template>
  <div class="message-content" :style="themeStyles">
    <!-- If streaming, display the accumulated snippet -->
    <template v-if="props.isStreaming">
      <div class="mt-3 mb-3">
        <CodePreview :nodeId="props.nodeId" :language="streamingLanguage" :content="streamingBuffer"
          :is-streaming="true" :code-index="0" :message-index="getMessageIndex()"
          @click="handleCodeClick({ content: streamingBuffer, language: streamingLanguage, nodeId: props.nodeId, codeIndex: 0, messageIndex: getMessageIndex(), complete: false })" />
      </div>
    </template>
    <!-- Otherwise, display the parsed (complete) content -->
    <template v-else>
      <span v-for="(part, index) in parsedContent" :key="index">
        <span v-if="part.type === 'text'" v-html="part.content" class="whitespace-pre-wrap theme-aware-text"
          :style="{ color: textColor }" />
        <div v-else-if="part.type === 'code'" class="mt-3 mb-3">
          <CodePreview :nodeId="props.nodeId" :language="part.language" :content="part.content"
            :code-index="part.codeIndex" :message-index="getMessageIndex()" :is-streaming="false"
            @click="handleCodeClick(part)" @preview="handleCodePreview(part)" />
        </div>

        <!-- Handle pasted content with unified CodePreview -->
        <div v-else-if="part.type === 'paste'" class="mt-3 mb-3">
          <CodePreview :nodeId="props.nodeId" :content="part.content" :language="part.detectedLanguage || 'text'"
            :code-index="part.codeIndex || 0" :message-index="getMessageIndex()" :is-streaming="false"
            :word-count="part.wordCount" :force-expanded="part.content.length > 500" @click="handleCodeClick({
              content: part.content,
              language: part.detectedLanguage || 'text',
              nodeId: props.nodeId,
              codeIndex: part.codeIndex || 0,
              messageIndex: getMessageIndex(),
              complete: true
            })" />
        </div>
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import emitter, { Events } from '@/utils/eventBus'
import CodePreview from './CodePreview.vue'
import type { ContentPart } from '@/types/message'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from "@/stores/chatStore";
import { useThemeStore } from '@/stores/themeStore'

interface Props {
  content: string;
  isStreaming?: boolean;
  nodeId: string;
  contentParts?: ContentPart[];
  messageIndex?: number; // Add messageIndex prop
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
  contentParts: () => [],
  messageIndex: 0 // Default to 0
})

const appStore = useAppStore()
const chatStore = useChatStore()
const themeStore = useThemeStore()

// Theme awareness - get current theme
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light')

// Determine text color based on theme
const textColor = computed(() => {
  // List of dark themes that need light text
  const darkThemes = [
    'dark', 'synthwave', 'cyberpunk', 'halloween',
    'forest', 'aqua', 'black', 'luxury', 'dracula', 
    'business', 'acid', 'night', 'coffee'
  ]

  // Return light text for dark themes
  return darkThemes.includes(currentTheme.value)
    ? 'rgba(255, 255, 255, 0.95)'
    : 'rgba(0, 0, 0, 0.8)'
})

// Add CSS custom properties for theme-aware styling
const themeStyles = computed(() => ({
  '--message-text-color': textColor.value
}))

const getMessageIndex = (): number => {
  return props.messageIndex || 0;
}

// For complete (non-streaming) content:
const lastCompleteContent = ref('')

// For streaming accumulation:
const streamingBuffer = ref('')
const streamingLanguage = ref('react')
const isStreamingActive = ref(false)

// Enhanced language detection function
function detectLanguage(text: string): string {
  // Vue SFC detection
  if (text.includes('<template>') && text.includes('<script') && text.includes('<style')) {
    return 'vue';
  }

  // React/JSX detection
  if (text.includes('export default') && text.includes('return (') && text.includes('<')) {
    return 'react';
  }

  // Python detection
  if (text.includes('def ') || (text.includes('import ') && text.includes('print('))) {
    return 'python';
  }

  // TypeScript detection
  if (text.includes(': string') || text.includes(': number') || text.includes('interface ')) {
    return 'typescript';
  }

  // HTML detection
  if (text.includes('<!DOCTYPE') || text.includes('<html')) {
    return 'html';
  }

  // CSS detection
  if (text.includes('{') && text.includes('}') && text.includes(':') && text.match(/[\w-]+\s*:/)) {
    return 'css';
  }

  // JavaScript patterns
  const jsPatterns = [
    /import\s+.*from\s+['"][^'"]+['"]/,
    /export\s+(default\s+)?(function|const|class)/,
    /function\s+\w+\s*\(/,
    /const\s+\w+\s*=/,
    /let\s+\w+\s*=/,
    /console\.(log|error|warn)/,
  ];

  if (jsPatterns.some(pattern => pattern.test(text))) {
    return 'javascript';
  }

  return 'text';
}

// FIXED: extractCodeBlock function with proper Vue SFC detection
function extractCodeBlock(text: string): { code: string, language: string, isCodeBlock: boolean } {
  // Early exit if no code markers present at all
  if (!text.includes('```')) {
    return { code: text, language: 'text', isCodeBlock: false };
  }

  // Try to match a complete code block
  const regex = /```([a-zA-Z]*)\s*([\s\S]*?)\s*```/;
  const match = text.match(regex);

  if (match) {
    const detectedLanguage = match[1] || detectLanguage(match[2] || '');
    const codeContent = match[2] || '';

    return {
      code: codeContent,
      language: detectedLanguage,
      isCodeBlock: true
    };
  }

  // Try to match a simple code block without language
  const simpleRegex = /```([\s\S]*?)```/;
  const simpleMatch = text.match(simpleRegex);

  if (simpleMatch) {
    const codeContent = simpleMatch[1] || '';
    const language = detectLanguage(codeContent);

    return {
      code: codeContent,
      language: language,
      isCodeBlock: true
    };
  }

  // Check if we have a partial code block (streaming case)
  const startsWithTicks = /```([a-zA-Z]*)\s*([\s\S]*)/;
  const partialMatch = text.match(startsWithTicks);

  if (partialMatch) {
    const detectedLanguage = partialMatch[1] || detectLanguage(partialMatch[2] || '');
    const codeContent = partialMatch[2] || '';

    return {
      code: codeContent,
      language: detectedLanguage,
      isCodeBlock: true
    };
  }

  // No code block detected
  return { code: text, language: 'text', isCodeBlock: false };
}

// Parse paste cards and convert them to proper content parts
function parsePasteContent(text: string): {
  beforePaste: string,
  pasteContent: string,
  afterPaste: string,
  wordCount: number,
  hasPaste: boolean
} {
  // Match paste card patterns like [Paste 1: 1159 words]
  const pasteRegex = /\[Paste\s+\d+:\s+(\d+)\s+words?\]/;
  const match = text.match(pasteRegex);

  if (match) {
    const parts = text.split(pasteRegex);
    return {
      beforePaste: parts[0]?.trim() || '',
      pasteContent: parts[2]?.trim() || '', // The actual pasted content comes after the regex match
      afterPaste: parts[3]?.trim() || '',
      wordCount: parseInt(match[1]),
      hasPaste: true
    };
  }

  return {
    beforePaste: text,
    pasteContent: '',
    afterPaste: '',
    wordCount: 0,
    hasPaste: false
  };
}

// Watch the incoming content prop
watch(
  () => props.content,
  (newContent) => {
    if (!props.isStreaming) {
      lastCompleteContent.value = newContent;
      streamingBuffer.value = '';
      isStreamingActive.value = false;
      return;
    }

    // While streaming, check if we have code
    const extracted = extractCodeBlock(newContent);

    // Only treat as code if we have actual code markers
    if (extracted.isCodeBlock) {
      streamingBuffer.value = extracted.code;
      streamingLanguage.value = extracted.language || 'text';

      emitter.emit('show-sandbox', {
        code: streamingBuffer.value,
        language: streamingLanguage.value,
        isStreaming: true,
        nodeId: props.nodeId,
        partial: true
      } as Events['show-sandbox']);

      isStreamingActive.value = true;
    } else {
      // For non-code content, don't use CodeBubble
      isStreamingActive.value = false;
    }
  },
  { immediate: true }
);

// When streaming stops, emit one final update
watch(
  () => props.isStreaming,
  (newVal) => {
    if (!newVal && isStreamingActive.value && streamingBuffer.value) {
      emitter.emit('show-sandbox', {
        code: streamingBuffer.value,
        language: streamingLanguage.value,
        isStreaming: false,
        nodeId: props.nodeId,
        partial: false
      } as Events['show-sandbox']);
      isStreamingActive.value = false;
    }
  }
);

const parsedContent = computed<ContentPart[]>(() => {
  // If we have contentParts from the message, use those directly
  if (props.contentParts && props.contentParts.length > 0) {
    return props.contentParts.map((part, index) => ({
      ...part,
      codeIndex: part.codeIndex ?? index,
      complete: true
    }));
  }

  // Fallback to parsing the raw content (for backward compatibility)
  const contentToProcess = lastCompleteContent.value || props.content;
  const parts: ContentPart[] = [];
  let codeIndex = 0;

  // Split by paste markers and process each segment
  const pastePattern = /\[Paste\s+(\d+):\s+(\d+)\s+words?\]/g;
  let lastIndex = 0;
  let match;

  while ((match = pastePattern.exec(contentToProcess)) !== null) {
    // Process text before paste marker
    const beforeText = contentToProcess.slice(lastIndex, match.index).trim();
    if (beforeText) {
      processTextContent(beforeText);
    }

    // Create paste content part
    const pasteNumber = parseInt(match[1]);
    const wordCount = parseInt(match[2]);

    // Placeholder content - the actual paste content should come from contentParts
    const pasteContent = `Paste ${pasteNumber} content (${wordCount} words)\nActual content not available in this format.`;

    parts.push({
      type: 'paste',
      content: pasteContent,
      detectedLanguage: 'text',
      wordCount: wordCount,
      codeIndex: codeIndex++,
      complete: true
    });

    lastIndex = match.index + match[0].length;
  }

  // Process any remaining text after the last paste
  const remainingText = contentToProcess.slice(lastIndex).trim();
  if (remainingText) {
    processTextContent(remainingText);
  }

  // If no paste markers found and no remaining text was processed, process as regular content
  if (lastIndex === 0 && contentToProcess && !remainingText) {
    processTextContent(contentToProcess);
  }

  function processTextContent(text: string) {
    if (!text) return;

    let inCodeBlock = false;
    let codeLanguage = '';
    let currentBuffer = '';

    const processMarkdown = (markdownText: string) => {
      if (!markdownText) return;
      const html = marked(markdownText);
      const safeHTML = DOMPurify.sanitize(html);
      parts.push({
        type: 'text',
        content: safeHTML,
        complete: true
      });
    };

    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          if (currentBuffer) {
            const extracted = extractCodeBlock(`\`\`\`${codeLanguage}\n${currentBuffer}\n\`\`\``);

            parts.push({
              type: 'code',
              content: extracted.code,
              language: extracted.language || 'react',
              codeIndex: codeIndex++,
              complete: true
            });
          }
          currentBuffer = '';
          codeLanguage = '';
          inCodeBlock = false;
        } else {
          // Start of code block
          if (currentBuffer) processMarkdown(currentBuffer);
          currentBuffer = '';
          codeLanguage = line.slice(3).trim();
          inCodeBlock = true;
        }
      } else {
        currentBuffer += currentBuffer ? '\n' + line : line;
      }
    }

    // Handle any remaining content
    if (inCodeBlock) {
      if (currentBuffer) {
        const extracted = extractCodeBlock(`\`\`\`${codeLanguage}\n${currentBuffer}\n\`\`\``);

        parts.push({
          type: 'code',
          content: extracted.code,
          language: extracted.language || 'react',
          codeIndex: codeIndex++,
          complete: true
        });
      }
    } else if (currentBuffer) {
      processMarkdown(currentBuffer);
    }
  }

  return parts;
});

const handleCodeClick = (part: ContentPart & { messageIndex?: number }) => {
  const eventData = {
    code: part.content,
    language: part.language || part.detectedLanguage || 'react',
    isStreaming: !part.complete,
    nodeId: props.nodeId,
    codeIndex: part.codeIndex,
    messageIndex: part.messageIndex || getMessageIndex(), // Include message index
    chatId: chatStore.currentChatId
  };
  
  emitter.emit('show-sandbox', eventData as Events['show-sandbox']);
  appStore.openSidePanel();
};

const handleCodePreview = (part: ContentPart) => {
  // Preview functionality - this could show an inline preview
  console.log('Preview requested for:', part);
};

// Update current theme when it changes in the DOM
const updateThemeFromDOM = () => {
  const newTheme = document.documentElement.getAttribute('data-theme') || 'light';
  if (newTheme !== currentTheme.value) {
    currentTheme.value = newTheme;
  }
};

// Set up theme observer on mount
onMounted(() => {
  // Setup theme observation
  const themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'data-theme') {
        updateThemeFromDOM();
      }
    });
  });

  // Start observing theme changes on document element
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  // Initial theme check
  updateThemeFromDOM();

  // Clean up on unmount
  onBeforeUnmount(() => {
    if (themeObserver) {
      themeObserver.disconnect();
    }
  });
});
</script>

<style scoped>
.message-content {
  color: var(--message-text-color, inherit);
}

/* Force proper text coloring in parsed markdown */
:deep(.theme-aware-text) {
  color: var(--message-text-color) !important;
}

:deep(.theme-aware-text a) {
  color: var(--message-text-color);
  text-decoration: underline;
}

:deep(.theme-aware-text h1),
:deep(.theme-aware-text h2),
:deep(.theme-aware-text h3),
:deep(.theme-aware-text h4),
:deep(.theme-aware-text h5),
:deep(.theme-aware-text h6),
:deep(.theme-aware-text p),
:deep(.theme-aware-text li),
:deep(.theme-aware-text ul),
:deep(.theme-aware-text ol),
:deep(.theme-aware-text blockquote),
:deep(.theme-aware-text table) {
  color: var(--message-text-color) !important;
}

/* Special styling for blockquotes */
:deep(.theme-aware-text blockquote) {
  border-left: 3px solid var(--message-text-color);
  opacity: 0.8;
}

/* Fix for dark themes where we need all generated content to be light */
[data-theme="cyberpunk"] .message-content,
[data-theme="acid"] .message-content,
[data-theme="dracula"] .message-content,
[data-theme="night"] .message-content,
[data-theme="synthwave"] .message-content,
[data-theme="black"] .message-content,
[data-theme="luxury"] .message-content {
  --message-text-color: rgba(255, 255, 255, 0.95) !important;
}

/* Ensure code elements are readable */
:deep(pre),
:deep(code) {
  color: var(--message-text-color);
  border-radius: 4px;
  padding: 0.2em 0.4em;
}

/* Dark theme-specific code styles */
[data-theme="cyberpunk"] :deep(pre),
[data-theme="cyberpunk"] :deep(code),
[data-theme="cmyk"] :deep(pre),
[data-theme="cmyk"] :deep(code),
[data-theme="acid"] :deep(pre),
[data-theme="acid"] :deep(code),
[data-theme="dracula"] :deep(pre),
[data-theme="dracula"] :deep(code),
[data-theme="night"] :deep(pre),
[data-theme="night"] :deep(code),
[data-theme="synthwave"] :deep(pre),
[data-theme="synthwave"] :deep(code),
[data-theme="retro"] :deep(pre),
[data-theme="retro"] :deep(code),
[data-theme="black"] :deep(pre),
[data-theme="black"] :deep(code),
[data-theme="luxury"] :deep(pre),
[data-theme="luxury"] :deep(code) {
  background-color: rgba(255, 255, 255, 0.15);
}
</style>