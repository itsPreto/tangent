<template>
  <div class="message-content">
    <!-- If streaming, show chunked output as it arrives -->
    <template v-if="isStreaming">
      <div v-for="(part, index) in streamingParts" :key="index" class="first:mt-0 mt-4">
        <CodePreview v-if="part.type === 'code'" :content="part.content" :is-streaming="!part.complete"
          :language="part.language || 'plaintext'" />
        <div v-else v-html="part.content" class="text-base-content whitespace-pre-wrap" />
      </div>
    </template>

    <!-- Otherwise, render the fully parsed content (once complete) -->
    <template v-else>
      <div v-for="(part, index) in parsedContent" :key="index" class="first:mt-0 mt-4">
        <CodePreview v-if="part.type === 'code'" :content="part.content" :is-streaming="false"
          :language="part.language" />
        <div v-else v-html="part.content" class="text-base-content whitespace-pre-wrap" />
      </div>
    </template>

    <!-- Optional "AI typing" indicator -->
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

// Store the last complete content
const lastCompleteContent = ref('')

// Keep track of streaming parts
const streamingParts = ref<ContentPart[]>([])

// Watch for content changes during streaming
watch(
  () => props.content,
  async (newContent) => {
    if (!props.isStreaming) {
      // Store the complete content when streaming ends
      lastCompleteContent.value = newContent
      return
    }

    const parts: ContentPart[] = []
    let inCodeBlock = false
    let codeLanguage = ''
    let currentBuffer = ''
    let i = 0

    while (i < newContent.length) {
      if (newContent.slice(i, i + 3) === '```') {
        if (!inCodeBlock) {
          if (currentBuffer) {
            const html = await marked(currentBuffer)
            const safeHTML = DOMPurify.sanitize(html as string)
            parts.push({
              type: 'text',
              content: safeHTML,
              complete: true
            })
            currentBuffer = ''
          }
          let endOfLine = newContent.indexOf('\n', i + 3)
          if (endOfLine === -1) endOfLine = newContent.length
          codeLanguage = newContent.slice(i + 3, endOfLine).trim()

          inCodeBlock = true
          i = endOfLine + 1
        } else {
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
        currentBuffer += newContent[i]
        i++
      }
    }

    if (currentBuffer) {
      if (inCodeBlock) {
        parts.push({
          type: 'code',
          content: currentBuffer,
          language: codeLanguage || 'plaintext',
          complete: false
        })
      } else {
        const html = await marked(currentBuffer)
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

// Parse content for non-streaming mode
const parsedContent = computed<ContentPart[]>(() => {
  // Use the last complete content instead of props.content
  const contentToProcess = lastCompleteContent.value || props.content
  const parts: ContentPart[] = []
  let inCodeBlock = false
  let codeLanguage = ''
  let currentBuffer = ''

  const processMarkdown = (text: string) => {
    if (!text) return
    const html = marked(text)
    const safeHTML = DOMPurify.sanitize(html as string)
    parts.push({
      type: 'text',
      content: safeHTML,
      complete: true
    })
  }

  const lines = contentToProcess.split('\n')

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        parts.push({
          type: 'code',
          content: currentBuffer,
          language: codeLanguage || 'plaintext',
          complete: true
        })
        currentBuffer = ''
        codeLanguage = ''
        inCodeBlock = false
      } else {
        if (currentBuffer) processMarkdown(currentBuffer)
        currentBuffer = ''
        codeLanguage = line.slice(3).trim()
        inCodeBlock = true
      }
    } else {
      currentBuffer += currentBuffer ? '\n' + line : line
    }
  }

  if (inCodeBlock) {
    parts.push({
      type: 'code',
      content: currentBuffer,
      language: codeLanguage || 'plaintext',
      complete: true
    })
  } else if (currentBuffer) {
    processMarkdown(currentBuffer)
  }

  return parts
})
</script>