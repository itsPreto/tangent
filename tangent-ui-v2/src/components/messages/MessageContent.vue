<template>
  <div class="message-content">
    <!-- If streaming, display the accumulated snippet -->
    <template v-if="props.isStreaming">
      <div class="mt-3 mb-3">
        <CodeBubble
          :language="streamingLanguage"
          :content="streamingBuffer"
          @click="handleCodeClick({ content: streamingBuffer, language: streamingLanguage, complete: !props.isStreaming })"
        />
      </div>
    </template>
    <!-- Otherwise, display the parsed (complete) content -->
    <template v-else>
      <span v-for="(part, index) in parsedContent" :key="index">
        <span
          v-if="part.type === 'text'"
          v-html="part.content"
          class="text-base-content whitespace-pre-wrap"
        />
        <div v-else-if="part.type === 'code'" class="mt-3 mb-3">
          <CodeBubble
            :language="part.language"
            :content="part.content"
            @click="handleCodeClick(part)"
          />
        </div>
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import emitter, { Events } from '@/utils/eventBus'
import CodeBubble from './CodeBubble.vue'
import { useAppStore } from '@/stores/appStore'

interface Props {
  content: string;
  isStreaming?: boolean;
  nodeId?: string;
}

interface ContentPart {
  type: 'text' | 'code';
  content: string;
  language?: string;
  complete?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
  nodeId: ''
})

const appStore = useAppStore()

// For complete (non-streaming) content:
const lastCompleteContent = ref('')

// For streaming accumulation:
const streamingBuffer = ref('')
const streamingLanguage = ref('javascriptreact') // default language
const isStreamingActive = ref(false)

// Helper: Extract code block content between triple backticks
function extractCodeBlock(text: string): string {
  // This regex captures content between ``` (optionally with "jsx" after the backticks)
  const regex = /```(?:jsx)?\s*([\s\S]*?)\s*```/;
  const match = text.match(regex);
  return match ? match[1] : text;
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
    // While streaming, update the buffer with only the code block content
    streamingBuffer.value = extractCodeBlock(newContent);
    streamingLanguage.value = 'javascriptreact'; // Adjust as needed
    emitter.emit('show-sandbox', {
      code: streamingBuffer.value,
      language: streamingLanguage.value,
      isStreaming: true,
      nodeId: props.nodeId,
      partial: true
    } as Events['show-sandbox']);
    isStreamingActive.value = true;
  },
  { immediate: true }
);

// When streaming stops, emit one final update
watch(
  () => props.isStreaming,
  (newVal) => {
    if (!newVal && isStreamingActive.value) {
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

// For non-streamed content, parse using your normal logic:
const parsedContent = computed<ContentPart[]>(() => {
  const contentToProcess = lastCompleteContent.value || props.content;
  const parts: ContentPart[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let currentBuffer = '';

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
        parts.push({
          type: 'code',
          content: currentBuffer,
          language: codeLanguage || 'javascriptreact',
          complete: true
        });
        currentBuffer = '';
        codeLanguage = '';
        inCodeBlock = false;
      } else {
        if (currentBuffer) processMarkdown(currentBuffer);
        currentBuffer = '';
        codeLanguage = line.slice(3).trim();
        inCodeBlock = true;
      }
    } else {
      currentBuffer += currentBuffer ? '\n' + line : line;
    }
  }
  if (inCodeBlock) {
    parts.push({
      type: 'code',
      content: currentBuffer,
      language: codeLanguage || 'javascriptreact',
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
    language: part.language || 'javascriptreact',
    isStreaming: !part.complete,
    nodeId: props.nodeId
  };
  emitter.emit('show-sandbox', eventData as Events['show-sandbox']);
  appStore.openSidePanel();
};
</script>
