<template>
  <div class="message-content">

    <!-- If streaming, show chunked output as it arrives -->
    <template v-if="isStreaming">
      <div
        v-for="(part, index) in streamingParts"
        :key="index"
        class="first:mt-0 mt-4"
      >
        <!-- Render code blocks in CodePreview -->
        <CodePreview
          v-if="part.type === 'code'"
          :content="part.content"
          :is-streaming="!part.complete"
          :language="part.language || 'plaintext'"
        />
        <!-- Render text (Markdown) by injecting pre-parsed HTML -->
        <div
          v-else
          v-html="part.content"
          class="text-gray-800 dark:text-gray-200 whitespace-pre-wrap"
        />
      </div>
    </template>

    <!-- Otherwise, render the fully parsed content (once complete) -->
    <template v-else>
      <div
        v-for="(part, index) in contentParts"
        :key="index"
        class="first:mt-0 mt-4"
      >
        <CodePreview
          v-if="part.type === 'code'"
          :content="part.content"
          :is-streaming="false"
          :language="part.language"
        />
        <div
          v-else
          v-html="part.content"
          class="text-gray-800 dark:text-gray-200 whitespace-pre-wrap"
        />
      </div>
    </template>

    <!-- Optional "AI typing" indicator (bouncing dots) -->
    <div v-if="isStreaming" class="mt-2 flex gap-1">
      <span class="animate-bounce w-1.5 h-1.5 bg-primary rounded-full"></span>
      <span class="animate-bounce delay-75 w-1.5 h-1.5 bg-primary rounded-full"></span>
      <span class="animate-bounce delay-150 w-1.5 h-1.5 bg-primary rounded-full"></span>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import CodePreview from './CodePreview.vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

interface Props {
  content: string
  isStreaming?: boolean
}

interface ContentPart {
  type: 'text' | 'code'
  content: string
  language?: string
  complete?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false
})

/**
 * 1) STREAMING MODE
 *    We chunk the incoming text *as it arrives* into either code or text.
 *    For code blocks, we push them to CodePreview. For text, we parse it into HTML with `marked`.
 */
const streamingParts = ref<ContentPart[]>([])

watch(
  () => props.content,
  (newContent) => {
    if (!props.isStreaming) return

    const parts: ContentPart[] = []
    let inCodeBlock = false
    let codeLanguage = ''
    let currentBuffer = ''
    let i = 0

    while (i < newContent.length) {
      // Looking for triple backticks
      if (newContent.slice(i, i + 3) === '```') {
        // If we're currently outside a code block, this starts one
        if (!inCodeBlock) {
          // If there's text so far, parse it as markdown
          if (currentBuffer) {
            const html = marked(currentBuffer)
            const safeHTML = DOMPurify.sanitize(html)
            parts.push({
              type: 'text',
              content: safeHTML,
              complete: true
            })
            currentBuffer = ''
          }
          // Grab the language (if any) right after the backticks
          let endOfLine = newContent.indexOf('\n', i + 3)
          if (endOfLine === -1) endOfLine = newContent.length
          codeLanguage = newContent.slice(i + 3, endOfLine).trim()

          inCodeBlock = true
          i = endOfLine + 1
        } else {
          // We found the closing backticks of the code block
          parts.push({
            type: 'code',
            content: currentBuffer.trim(),
            language: codeLanguage || 'plaintext',
            complete: true
          })

          inCodeBlock = false
          codeLanguage = ''
          currentBuffer = ''
          i += 3
        }
      } else {
        // Just normal text or code characters
        currentBuffer += newContent[i]
        i++
      }
    }

    // Whatever's left in currentBuffer after the loop
    if (currentBuffer) {
      if (inCodeBlock) {
        // Still inside a code block; code is incomplete
        parts.push({
          type: 'code',
          content: currentBuffer,
          language: codeLanguage || 'plaintext',
          complete: false
        })
      } else {
        // Plain text leftover, parse as markdown
        const html = marked(currentBuffer)
        const safeHTML = DOMPurify.sanitize(html)
        parts.push({
          type: 'text',
          content: safeHTML,
          complete: false
        })
      }
    }

    streamingParts.value = parts
  }
)

/**
 * 2) NON-STREAMING MODE
 *    If the message is complete, we parse the entire thing in one go:
 *    - Break it into code blocks vs. text blocks,
 *    - Then parse text blocks as markdown, code blocks remain code
 */
const contentParts = computed<ContentPart[]>(() => {
  if (props.isStreaming) return []

  const parts: ContentPart[] = []
  const lines = props.content.split('\n')
  let inCodeBlock = false
  let codeLanguage = ''
  let currentBuffer = ''

  const flushTextAsMarkdown = () => {
    if (!currentBuffer) return
    const html = marked(currentBuffer)
    const safeHTML = DOMPurify.sanitize(html)
    parts.push({
      type: 'text',
      content: safeHTML
    })
    currentBuffer = ''
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      // Toggle code mode
      if (inCodeBlock) {
        // End code block
        parts.push({
          type: 'code',
          content: currentBuffer,
          language: codeLanguage || 'plaintext'
        })
        currentBuffer = ''
        codeLanguage = ''
        inCodeBlock = false
      } else {
        // Start code block
        flushTextAsMarkdown()
        codeLanguage = line.slice(3).trim()
        inCodeBlock = true
      }
    } else {
      // Accumulate lines either in code or text
      currentBuffer += currentBuffer ? '\n' + line : line
    }
  }

  // If we never closed a code block
  if (inCodeBlock) {
    parts.push({
      type: 'code',
      content: currentBuffer,
      language: codeLanguage || 'plaintext'
    })
  } else {
    flushTextAsMarkdown()
  }

  return parts
})
</script>

<style scoped>
/* Example styling for text blocks. You can refine with Tailwind classes, etc. */
.text-gray-800 {
  color: #2d3748; /* just in case you aren't using Tailwind */
}

.dark .text-gray-200 {
  color: #edf2f7;
}

.prose code {
  background-color: rgba(27,31,35,.05);
  padding: 0.2em 0.4em;
  border-radius: 3px;
}
</style>
