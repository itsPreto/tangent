<template>
  <div class="message-content" :style="themeStyles">
    <!-- If streaming, display the accumulated snippet -->
    <template v-if="props.isStreaming">
      <!-- Existing streaming code... -->
    </template>
    <!-- Otherwise, display the parsed (complete) content -->
    <template v-else>
      <span v-for="(part, index) in parsedContent" :key="index">
        <span v-if="part.type === 'text'" v-html="part.content" class="whitespace-pre-wrap theme-aware-text"
          :style="{ color: textColor }" />
        <div v-else-if="part.type === 'code'" class="mt-3 mb-3">
          <CodeBubble :nodeId="props.nodeId" :language="part.language" :content="part.content"
            :code-index="part.codeIndex" :theme="currentTheme" @click="handleCodeClick(part)" />
        </div>
        <!-- Add support for paste cards -->
        <div v-else-if="part.type === 'paste'" class="mt-3 mb-3">
          <PasteCard 
            :content="part.content" 
            :preview="part.preview" 
            :word-count="part.wordCount" />
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
import CodeBubble from './CodeBubble.vue'
import PasteCard from './PasteCard.vue' // Import the new component
import type { ContentPart } from '@/types/message'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from "@/stores/chatStore";
import { useThemeStore } from '@/stores/themeStore'

interface Props {
  content: string;
  isStreaming?: boolean;
  nodeId: string;
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false
})

const appStore = useAppStore()
const chatStore = useChatStore()
const themeStore = useThemeStore() // Initialize theme store

// Theme awareness - get current theme
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light')

// Determine text color based on theme
const textColor = computed(() => {
  // List of dark themes that need light text
  const darkThemes = [
    'dark', 'synthwave', 'retro', 'cyberpunk', 'halloween',
    'forest', 'aqua', 'black', 'luxury', 'dracula', 'cmyk',
    'autumn', 'business', 'acid', 'night', 'coffee'
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

// For complete (non-streaming) content:
const lastCompleteContent = ref('')

// For streaming accumulation:
const streamingBuffer = ref('')
const streamingLanguage = ref('react')
const isStreamingActive = ref(false)

function extractCodeBlock(text: string): { code: string, language: string, isCodeBlock: boolean } {
  // Early exit if no code markers present at all
  if (!text.includes('```')) {
    return { code: text, language: 'text', isCodeBlock: false };
  }

  // Try to match a complete code block
  const regex = /```([a-zA-Z]*)\s*([\s\S]*?)\s*```/;
  const match = text.match(regex);

  if (match) {
    return {
      code: match[2] || '',
      language: match[1] || 'react',
      isCodeBlock: true
    };
  }

  // Try to match a simple code block without language
  const simpleRegex = /```([\s\S]*?)```/;
  const simpleMatch = text.match(simpleRegex);

  if (simpleMatch) {
    return {
      code: simpleMatch[1] || '',
      language: 'react',
      isCodeBlock: true
    };
  }

  // Check if we have a partial code block (streaming case)
  const startsWithTicks = /```([a-zA-Z]*)\s*([\s\S]*)/;
  const partialMatch = text.match(startsWithTicks);

  if (partialMatch) {
    return {
      code: partialMatch[2] || '',
      language: partialMatch[1] || 'react',
      isCodeBlock: true
    };
  }

  // No code block detected
  return { code: text, language: 'text', isCodeBlock: false };
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
  const contentToProcess = lastCompleteContent.value || props.content;
  const parts: ContentPart[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let currentBuffer = '';
  let codeIndex = 0;

  const processMarkdown = (text: string) => {
    if (!text) return;
    const html = marked(text);
    const safeHTML = DOMPurify.sanitize(html);
    parts.push({
      type: 'text',
      content: safeHTML,
      complete: true
    });
  };

  const lines = contentToProcess.split('\n');
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        parts.push({
          type: 'code',
          content: currentBuffer,
          language: codeLanguage || 'react',
          codeIndex: codeIndex++,
          complete: true
        });
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
    parts.push({
      type: 'code',
      content: currentBuffer,
      language: codeLanguage || 'react',
      codeIndex: codeIndex++,
      complete: true
    });
  } else if (currentBuffer) {
    processMarkdown(currentBuffer);
  }

  return parts;
});

const handleCodeClick = (part: ContentPart) => {
  const eventData = {
    code: part.content,
    language: part.language || 'react',
    isStreaming: !part.complete,
    nodeId: props.nodeId, // Use the one from props, not from part
    codeIndex: part.codeIndex,
    chatId: chatStore.currentChatId
  };
  
  emitter.emit('show-sandbox', eventData as Events['show-sandbox']);
  appStore.openSidePanel();
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
[data-theme="cmyk"] .message-content,
[data-theme="acid"] .message-content,
[data-theme="dracula"] .message-content,
[data-theme="night"] .message-content,
[data-theme="synthwave"] .message-content,
[data-theme="retro"] .message-content,
[data-theme="black"] .message-content,
[data-theme="luxury"] .message-content {
  --message-text-color: rgba(255, 255, 255, 0.95) !important;
}

/* Ensure code elements are readable */
:deep(pre),
:deep(code) {
  color: var(--message-text-color);
  background-color: rgba(0, 0, 0, 0.1);
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