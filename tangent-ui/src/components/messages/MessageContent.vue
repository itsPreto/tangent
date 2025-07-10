<template>
  <div class="message-content-wrapper" :class="contentWrapperClasses">
    <!-- Streaming content display -->
    <template v-if="props.isStreaming">
      <div class="streaming-container">
        <div class="streaming-parts">
          <!-- Regular text content -->
          <div v-if="streamingTextContent" class="streaming-text-content">
            <div class="text-content prose prose-sm max-w-none"
                 :class="textContentClasses"
                 v-html="streamingTextContent" />
          </div>
          
          <!-- Thinking block while streaming -->
          <ThinkingBlock 
            v-if="streamingThinkContent" 
            :content="streamingThinkContent" 
            :is-streaming="true"
            :node-id="props.nodeId"
            :message-index="getMessageIndex()" 
          />
          
          <!-- Code block while streaming -->
          <div v-if="streamingCodeContent" class="streaming-code-content">
            <CodePreview 
              :nodeId="props.nodeId" 
              :language="streamingLanguage" 
              :content="streamingCodeContent"
              :is-streaming="true" 
              :code-index="0" 
              :message-index="getMessageIndex()"
              @click="handleCodeClick({ content: streamingCodeContent, language: streamingLanguage, nodeId: props.nodeId, codeIndex: 0, messageIndex: getMessageIndex(), complete: false })" 
            />
          </div>
        </div>
      </div>
    </template>
    
    <!-- Complete content display -->
    <template v-else>
      <div class="message-content" :style="themeStyles">
        <div v-for="(part, index) in parsedContent" :key="index" class="content-part">
          <!-- Text content with enhanced typography -->
          <div v-if="part.type === 'text'" 
               class="text-content prose prose-sm max-w-none"
               :class="textContentClasses"
               v-html="part.content" />
          
          <!-- Code content -->
          <div v-else-if="part.type === 'code'" class="code-content-wrapper">
            <CodePreview :nodeId="props.nodeId" :language="part.language" :content="part.content"
              :code-index="part.codeIndex" :message-index="getMessageIndex()" :is-streaming="false"
              @click="handleCodeClick(part)" @preview="handleCodePreview(part)" />
          </div>
          
          <!-- Think content -->
          <div v-else-if="part.type === 'think'" class="think-content-wrapper">
            <ThinkingBlock 
              :content="part.content" 
              :is-streaming="false"
              :node-id="props.nodeId"
              :message-index="getMessageIndex()" 
            />
          </div>

          <!-- Pasted content -->
          <div v-else-if="part.type === 'paste'" class="paste-content-wrapper">
            <div class="paste-content-header">
              <div class="paste-icon">
                <Clipboard class="w-4 h-4" />
              </div>
              <span class="paste-label">Pasted Content</span>
              <div class="paste-meta">
                <span class="paste-word-count">{{ part.wordCount }} words</span>
              </div>
            </div>
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

          <!-- Compacted conversation summaries -->
          <div v-else-if="part.type === 'compacted'" class="compacted-content-wrapper">
            <div class="compacted-content-header">
              <div class="compacted-icon">
                <Archive class="w-4 h-4" />
              </div>
              <span class="compacted-label">Conversation Summary</span>
            </div>
            <CompactedMessageView 
              :compacted-data="part.compactedData!"
              @continue-conversation="handleContinueConversation"
              @branch-from-last="handleBranchFromLast"
              @toggle-expansion="handleToggleExpansion"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Clipboard, Archive } from 'lucide-vue-next'
import emitter, { Events } from '@/utils/eventBus'
import CodePreview from './CodePreview.vue'
import CompactedMessageView from './CompactedMessageView.vue'
import ThinkingBlock from './ThinkingBlock.vue'
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

// Theme awareness - get current theme from store
const currentTheme = computed(() => themeStore.currentTheme)

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

// Content wrapper classes for theme-aware styling
const contentWrapperClasses = computed(() => ({
  [`theme-${currentTheme.value}`]: true,
  'is-streaming': props.isStreaming
}))

// Text content classes for enhanced typography
const textContentClasses = computed(() => {
  const isDark = ['dark', 'synthwave', 'cyberpunk', 'halloween', 'forest', 'aqua', 'black', 'luxury', 'dracula', 'business', 'acid', 'night', 'coffee'].includes(currentTheme.value)
  
  return {
    'prose-invert': isDark,
    'theme-aware-text': true
  }
})

const getMessageIndex = (): number => {
  return props.messageIndex || 0;
}

// For complete (non-streaming) content:
const lastCompleteContent = ref('')

// For streaming accumulation:
const streamingBuffer = ref('')
const streamingLanguage = ref('react')
const isStreamingActive = ref(false)

// Separate streaming content types
const streamingTextContent = ref('')
const streamingThinkContent = ref('')
const streamingCodeContent = ref('')

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

// Parse think tags from content - enhanced for streaming
function parseThinkTags(text: string, isStreaming = false): { beforeThink: string, thinkContent: string, afterThink: string, hasThink: boolean } {
  // For streaming: detect opening tag even without closing tag
  if (isStreaming) {
    const openTagIndex = text.indexOf('<think>');
    if (openTagIndex !== -1) {
      const beforeThink = text.substring(0, openTagIndex);
      const afterOpenTag = text.substring(openTagIndex + 7); // 7 = length of '<think>'
      
      // Check if we have a closing tag
      const closeTagIndex = afterOpenTag.indexOf('</think>');
      if (closeTagIndex !== -1) {
        // Complete think block
        const thinkContent = afterOpenTag.substring(0, closeTagIndex);
        const afterThink = afterOpenTag.substring(closeTagIndex + 8); // 8 = length of '</think>'
        return {
          beforeThink: beforeThink.trim(),
          thinkContent: thinkContent.trim(),
          afterThink: afterThink.trim(),
          hasThink: true
        };
      } else {
        // Partial think block (streaming)
        return {
          beforeThink: beforeThink.trim(),
          thinkContent: afterOpenTag.trim(),
          afterThink: '',
          hasThink: true
        };
      }
    }
  } else {
    // For complete content: use regex as before
    const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
    const match = text.match(thinkRegex);
    
    if (match) {
      const beforeThink = text.substring(0, match.index || 0);
      const thinkContent = match[1] || '';
      const afterThink = text.substring((match.index || 0) + match[0].length);
      
      return {
        beforeThink: beforeThink.trim(),
        thinkContent: thinkContent.trim(),
        afterThink: afterThink.trim(),
        hasThink: true
      };
    }
  }
  
  return {
    beforeThink: text,
    thinkContent: '',
    afterThink: '',
    hasThink: false
  };
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
      streamingTextContent.value = '';
      streamingThinkContent.value = '';
      streamingCodeContent.value = '';
      isStreamingActive.value = false;
      
      // Force re-parse of complete content to ensure think tags are properly handled
      // This will trigger the parsedContent computed to re-run
      return;
    }

    // Parse streaming content for different types (with streaming flag)
    const thinkParsed = parseThinkTags(newContent, true);
    const codeParsed = extractCodeBlock(newContent);

    // Handle thinking content
    if (thinkParsed.hasThink) {
      streamingThinkContent.value = thinkParsed.thinkContent;
      // Process the rest of the content without think tags
      const remainingContent = thinkParsed.beforeThink + ' ' + thinkParsed.afterThink;
      const codeInRemaining = extractCodeBlock(remainingContent.trim());
      
      if (codeInRemaining.isCodeBlock) {
        streamingCodeContent.value = codeInRemaining.code;
        streamingLanguage.value = codeInRemaining.language || 'text';
        streamingTextContent.value = '';
      } else {
        streamingTextContent.value = remainingContent.trim();
        streamingCodeContent.value = '';
      }
    } else if (codeParsed.isCodeBlock) {
      // Only code content
      streamingCodeContent.value = codeParsed.code;
      streamingLanguage.value = codeParsed.language || 'text';
      streamingTextContent.value = '';
      streamingThinkContent.value = '';
    } else {
      // Only text content
      streamingTextContent.value = newContent;
      streamingCodeContent.value = '';
      streamingThinkContent.value = '';
    }

    // Emit sandbox events for code content
    if (streamingCodeContent.value) {
      emitter.emit('show-sandbox', {
        code: streamingCodeContent.value,
        language: streamingLanguage.value,
        isStreaming: true,
        nodeId: props.nodeId,
        partial: true
      } as Events['show-sandbox']);
    }

    isStreamingActive.value = true;
  },
  { immediate: true }
);

// When streaming stops, ensure content is properly preserved
watch(
  () => props.isStreaming,
  (newVal, oldVal) => {
    if (oldVal && !newVal) {
      // Streaming just stopped - preserve the final content
      lastCompleteContent.value = props.content;
      
      // Emit final sandbox update if needed
      if (isStreamingActive.value && streamingCodeContent.value) {
        emitter.emit('show-sandbox', {
          code: streamingCodeContent.value,
          language: streamingLanguage.value,
          isStreaming: false,
          nodeId: props.nodeId,
          partial: false
        } as Events['show-sandbox']);
      }
      
      // Clear streaming state
      isStreamingActive.value = false;
    }
  }
);

const parsedContent = computed<ContentPart[]>(() => {
  // Always re-parse from raw content to ensure think tags are detected
  // This ensures existing messages get updated with improved parsing logic
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

    // First, extract and process think tags
    const thinkParsed = parseThinkTags(text);
    
    if (thinkParsed.hasThink) {
      // Process content before think tag
      if (thinkParsed.beforeThink) {
        processTextSegment(thinkParsed.beforeThink);
      }
      
      // Add think tag as separate part
      parts.push({
        type: 'think',
        content: thinkParsed.thinkContent,
        complete: true
      });
      
      // Process content after think tag
      if (thinkParsed.afterThink) {
        processTextSegment(thinkParsed.afterThink);
      }
    } else {
      // No think tags, process normally
      processTextSegment(text);
    }
  }

  function processTextSegment(text: string) {
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

// Handle compacted message events
const handleContinueConversation = () => {
  // Continue conversation on the same branch after compaction
  emitter.emit('continue-conversation', { nodeId: props.nodeId });
};

const handleBranchFromLast = () => {
  // Create a new branch from the last message before compaction
  emitter.emit('branch-from-last', { nodeId: props.nodeId });
};

const handleToggleExpansion = (expanded: boolean) => {
  // Toggle expansion of compacted message
  emitter.emit('toggle-compacted-expansion', { 
    nodeId: props.nodeId, 
    expanded 
  });
};

// Theme reactivity is handled automatically by the theme store
</script>

<style scoped>
/* Main wrapper styling */
.message-content-wrapper {
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Content spacing and layout */
.message-content {
  color: var(--message-text-color, inherit);
  line-height: 1.7;
  font-size: 0.95rem;
}

.content-part {
  margin-bottom: 0.75rem;
  transition: opacity 0.2s ease;
}

.content-part:last-child {
  margin-bottom: 0;
}

/* Enhanced text content styling */
.text-content {
  color: var(--message-text-color) !important;
  line-height: 1.7;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
}

/* Streaming content styling */
.streaming-container {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}

.streaming-parts {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.streaming-text-content {
  padding: 0.5rem 0;
}

.streaming-text-content .text-content {
  position: relative;
}

.streaming-text-content .text-content::after {
  content: '';
  display: inline-block;
  width: 2px;
  height: 1.2em;
  background: hsl(var(--p));
  margin-left: 0.125rem;
  animation: blink 1s infinite;
  vertical-align: baseline;
}

.streaming-code-content {
  margin: 0.5rem 0;
}

.think-content-wrapper {
  margin: 0.5rem 0;
}

.streaming-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, rgb(var(--p)), rgb(var(--s)), rgb(var(--a)));
  background-size: 200% 100%;
  animation: streamingGradient 2s ease-in-out infinite;
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgb(var(--p) / 0.1);
  border: 1px solid rgb(var(--p) / 0.2);
  border-radius: 6px;
  backdrop-filter: blur(4px);
}

.streaming-pulse {
  width: 8px;
  height: 8px;
  background: rgb(var(--p));
  border-radius: 50%;
  animation: streamingPulse 1.5s ease-in-out infinite;
}

.streaming-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--p));
  letter-spacing: 0.025em;
}

.streaming-content {
  position: relative;
}

/* Code content wrapper */
.code-content-wrapper {
  margin: 0.75rem 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
}

/* Paste content styling */
.paste-content-wrapper {
  margin: 0.75rem 0;
  border: 1px solid rgb(var(--b3) / 0.3);
  border-radius: 8px;
  overflow: hidden;
  background: rgb(var(--b1));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.paste-content-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, rgb(var(--s) / 0.1), rgb(var(--s) / 0.05));
  border-bottom: 1px solid rgb(var(--b3) / 0.2);
}

.paste-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: rgb(var(--s) / 0.15);
  border: 1px solid rgb(var(--s) / 0.3);
  border-radius: 8px;
  color: rgb(var(--s));
}

.paste-label {
  font-weight: 600;
  font-size: 0.875rem;
  color: rgb(var(--bc) / 0.9);
  letter-spacing: 0.025em;
}

.paste-meta {
  margin-left: auto;
  display: flex;
  gap: 0.5rem;
}

.paste-word-count {
  padding: 0.25rem 0.75rem;
  background: rgb(var(--s) / 0.1);
  border: 1px solid rgb(var(--s) / 0.2);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(var(--s));
}

/* Compacted content styling */
.compacted-content-wrapper {
  margin: 0.75rem 0;
  border: 1px solid rgb(var(--b3) / 0.3);
  border-radius: 8px;
  overflow: hidden;
  background: rgb(var(--b1));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.compacted-content-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, rgb(var(--a) / 0.1), rgb(var(--a) / 0.05));
  border-bottom: 1px solid rgb(var(--b3) / 0.2);
}

.compacted-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: rgb(var(--a) / 0.15);
  border: 1px solid rgb(var(--a) / 0.3);
  border-radius: 8px;
  color: rgb(var(--a));
}

.compacted-label {
  font-weight: 600;
  font-size: 0.875rem;
  color: rgb(var(--bc) / 0.9);
  letter-spacing: 0.025em;
}

/* Enhanced typography for text content */
:deep(.text-content) {
  --tw-prose-body: var(--message-text-color);
  --tw-prose-headings: var(--message-text-color);
  --tw-prose-lead: rgb(var(--bc) / 0.7);
  --tw-prose-links: rgb(var(--p));
  --tw-prose-bold: var(--message-text-color);
  --tw-prose-counters: rgb(var(--bc) / 0.6);
  --tw-prose-bullets: rgb(var(--bc) / 0.4);
  --tw-prose-hr: rgb(var(--bc) / 0.3);
  --tw-prose-quotes: var(--message-text-color);
  --tw-prose-quote-borders: rgb(var(--p) / 0.3);
  --tw-prose-captions: rgb(var(--bc) / 0.6);
  --tw-prose-code: rgb(var(--p));
  --tw-prose-pre-code: rgb(var(--bc) / 0.9);
  --tw-prose-pre-bg: rgb(var(--b2));
  --tw-prose-th-borders: rgb(var(--bc) / 0.3);
  --tw-prose-td-borders: rgb(var(--bc) / 0.2);
}

:deep(.text-content h1),
:deep(.text-content h2),
:deep(.text-content h3),
:deep(.text-content h4),
:deep(.text-content h5),
:deep(.text-content h6) {
  font-weight: 700;
  letter-spacing: -0.025em;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
}

:deep(.text-content h1) {
  font-size: 1.5em;
  border-bottom: 2px solid rgb(var(--p) / 0.3);
  padding-bottom: 0.5em;
}

:deep(.text-content h2) {
  font-size: 1.3em;
}

:deep(.text-content h3) {
  font-size: 1.15em;
}

:deep(.text-content p) {
  margin-bottom: 1em;
}

:deep(.text-content a) {
  color: rgb(var(--p));
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px solid rgb(var(--p) / 0.3);
  transition: all 0.2s ease;
}

:deep(.text-content a:hover) {
  border-bottom-color: rgb(var(--p));
  background: rgb(var(--p) / 0.1);
  padding: 0.125rem 0.25rem;
  margin: -0.125rem -0.25rem;
  border-radius: 4px;
}

:deep(.text-content blockquote) {
  border-left: 4px solid rgb(var(--p) / 0.5);
  background: rgb(var(--p) / 0.05);
  padding: 1rem 1.5rem;
  margin: 1.5rem 0;
  border-radius: 0 8px 8px 0;
  font-style: italic;
  position: relative;
}

:deep(.text-content blockquote::before) {
  content: '"';
  position: absolute;
  top: 0.5rem;
  left: 0.75rem;
  font-size: 2rem;
  color: rgb(var(--p) / 0.3);
  font-family: serif;
}

:deep(.text-content ul),
:deep(.text-content ol) {
  padding-left: 1.5rem;
  margin: 1rem 0;
}

:deep(.text-content li) {
  margin: 0.5rem 0;
  position: relative;
}

:deep(.text-content ul li::marker) {
  color: rgb(var(--p));
}

:deep(.text-content ol li::marker) {
  color: rgb(var(--p));
  font-weight: 600;
}

:deep(.text-content table) {
  width: 100%;
  margin: 1.5rem 0;
  border-collapse: collapse;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

:deep(.text-content th),
:deep(.text-content td) {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid rgb(var(--bc) / 0.2);
}

:deep(.text-content th) {
  background: rgb(var(--b2));
  font-weight: 600;
  color: rgb(var(--bc) / 0.9);
}

:deep(.text-content tr:hover) {
  background: rgb(var(--b2) / 0.5);
}

:deep(.text-content code) {
  background: rgb(var(--b2));
  color: rgb(var(--p));
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875em;
  font-weight: 500;
  border: 1px solid rgb(var(--bc) / 0.1);
}

:deep(.text-content pre) {
  background: rgb(var(--b2));
  padding: 1rem 1.25rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0;
  border: 1px solid rgb(var(--bc) / 0.1);
}

:deep(.text-content pre code) {
  background: none;
  padding: 0;
  border: none;
  color: rgb(var(--bc) / 0.9);
}

/* Animations */
@keyframes streamingGradient {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

@keyframes streamingPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Theme-specific enhancements removed - now handled by parent component */

/* Text color is now handled by the theme store and parent component */

/* Responsive design */
@media (max-width: 768px) {
  .streaming-container {
    padding: 0.75rem;
  }
  
  .paste-content-header,
  .compacted-content-header {
    padding: 0.5rem 0.75rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .paste-meta {
    margin-left: 0;
    width: 100%;
    justify-content: flex-start;
  }
}

/* Accessibility improvements */
@media (prefers-reduced-motion: reduce) {
  .streaming-container::before {
    animation: none;
  }
  
  .streaming-pulse {
    animation: none;
    opacity: 1;
  }
  
  .content-part {
    transition: none;
  }
}

/* Focus states for better accessibility */
:deep(.text-content a:focus) {
  outline: 2px solid rgb(var(--p));
  outline-offset: 2px;
  border-radius: 4px;
}
</style>