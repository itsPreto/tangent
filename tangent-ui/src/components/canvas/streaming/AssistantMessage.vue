<template>
  <div class="assistant-message">
    <div class="assistant-content">
      <div v-if="textContent" class="assistant-text">
        {{ textContent }}
      </div>
      <div v-if="toolUses.length > 0" class="assistant-tools">
        <div v-for="tool in toolUses" :key="tool.id" class="tool-use">
          <strong>{{ tool.name }}:</strong>
          <pre>{{ JSON.stringify(tool.input, null, 2) }}</pre>
        </div>
      </div>
      <div v-if="rawData" class="assistant-raw">
        <pre>{{ rawData }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  message: {
    data: any
  }
}

const props = defineProps<Props>()

const textContent = computed(() => {
  const message = props.message.data.message
  if (!message?.content) return null
  
  const textBlocks = message.content.filter((block: any) => block.type === 'text')
  return textBlocks.map((block: any) => block.text).join('\n')
})

const toolUses = computed(() => {
  const message = props.message.data.message
  if (!message?.content) return []
  
  return message.content.filter((block: any) => block.type === 'tool_use')
})

const rawData = computed(() => {
  if (textContent.value || toolUses.value.length > 0) return null
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

.assistant-tools {
  margin-bottom: 8px;
}

.tool-use {
  margin-bottom: 4px;
  padding: 4px;
  background: #fef3c7;
  border-radius: 2px;
}

.tool-use strong {
  color: #92400e;
}

.tool-use pre {
  background: #fffbeb;
  padding: 2px;
  border-radius: 2px;
  margin-top: 2px;
  max-height: 60px;
  overflow-y: auto;
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