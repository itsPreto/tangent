<template>
  <div class="assistant-message">
    <div class="assistant-content">
      <div v-if="textContent" class="assistant-text">
        <div v-for="(chunk, index) in textChunks" :key="index" class="text-chunk">
          {{ chunk }}
        </div>
      </div>
      <div v-if="toolUse" class="assistant-tool">
        <div class="tool-header">
          <span class="tool-name">{{ toolUse.tool_name }}</span>
          <span class="tool-id">{{ toolUse.tool_id }}</span>
        </div>
        <pre class="tool-params">{{ JSON.stringify(toolUse.parameters, null, 2) }}</pre>
      </div>
      <div v-if="rawData" class="assistant-raw">
        <pre>{{ rawData }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ClaudeCodeTextMessage, ClaudeCodeToolUseMessage } from '../../../utils/ClaudeCodeMessageParser'

interface Props {
  message: {
    data: ClaudeCodeTextMessage | ClaudeCodeToolUseMessage | any
    parsedMessage?: any
  }
}

const props = defineProps<Props>()

const textContent = computed(() => {
  const data = props.message.data
  if (data?.type === 'text') {
    return (data as ClaudeCodeTextMessage).content
  }
  return null
})

const textChunks = computed(() => {
  if (!textContent.value) return []
  
  // Split text into chunks for progressive rendering
  const chunks = textContent.value.split('\n')
  return chunks.filter(chunk => chunk.trim())
})

const toolUse = computed(() => {
  const data = props.message.data
  if (data?.type === 'tool_use') {
    return data as ClaudeCodeToolUseMessage
  }
  return null
})

const rawData = computed(() => {
  if (textContent.value || toolUse.value) return null
  return JSON.stringify(props.message.data, null, 2)
})
</script>

<style scoped>
.assistant-message {
  font-family: monospace;
  color: #1e293b;
}

.assistant-content {
  font-size: 11px;
}

.assistant-text {
  margin-bottom: 8px;
  white-space: pre-wrap;
}

.text-chunk {
  margin-bottom: 2px;
  line-height: 1.4;
}

.assistant-tool {
  margin-bottom: 8px;
  padding: 6px;
  background: #fef3c7;
  border-radius: 4px;
  border-left: 3px solid #f59e0b;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.tool-name {
  font-weight: 600;
  color: #92400e;
  font-size: 12px;
}

.tool-id {
  font-size: 10px;
  color: #78716c;
  font-family: monospace;
  background: #fffbeb;
  padding: 2px 4px;
  border-radius: 2px;
}

.tool-params {
  background: #fffbeb;
  padding: 4px;
  border-radius: 2px;
  margin-top: 4px;
  max-height: 80px;
  overflow-y: auto;
  font-size: 10px;
  color: #78716c;
}

.assistant-raw pre {
  background: #f8fafc;
  padding: 4px;
  border-radius: 2px;
  margin-top: 4px;
  max-height: 80px;
  overflow-y: auto;
}
</style>