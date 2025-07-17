<template>
  <div class="tool-call-message">
    <div class="tool-header">
      <span class="tool-icon">🛠️</span>
      <span class="tool-name">{{ toolData.tool_name }}</span>
      <span class="tool-id">{{ toolData.tool_id }}</span>
    </div>
    <div class="tool-content">
      <div v-if="toolData.parameters" class="tool-parameters">
        <div class="param-header">
          <strong>Parameters:</strong>
        </div>
        <div class="param-list">
          <div v-for="(value, key) in toolData.parameters" :key="key" class="param-item">
            <span class="param-key">{{ key }}:</span>
            <span class="param-value">{{ formatParamValue(value) }}</span>
          </div>
        </div>
      </div>
      <div v-if="rawData" class="tool-raw">
        <pre>{{ rawData }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ClaudeCodeToolUseMessage } from '../../../utils/ClaudeCodeMessageParser'

interface Props {
  message: {
    data: ClaudeCodeToolUseMessage | any
  }
}

const props = defineProps<Props>()

const toolData = computed(() => {
  const data = props.message.data
  if (data?.type === 'tool_use') {
    return data as ClaudeCodeToolUseMessage
  }
  // Fallback for old format
  return {
    tool_name: data.tool_name || 'Unknown',
    tool_id: data.tool_id || data.call_id || 'unknown',
    parameters: data.parameters || {}
  }
})

const rawData = computed(() => {
  if (toolData.value.tool_name && toolData.value.tool_name !== 'Unknown') return null
  return JSON.stringify(props.message.data, null, 2)
})

function formatParamValue(value: any): string {
  if (typeof value === 'string') {
    return value.length > 100 ? value.substring(0, 100) + '...' : value
  }
  return JSON.stringify(value)
}
</script>

<style scoped>
.tool-call-message {
  font-family: monospace;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  background: #fef3c7;
  padding: 6px 8px;
  border-radius: 4px;
  border-left: 3px solid #f59e0b;
}

.tool-icon {
  font-size: 14px;
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

.tool-content {
  font-size: 11px;
}

.tool-parameters {
  margin-bottom: 8px;
}

.param-header {
  margin-bottom: 4px;
  color: #6b7280;
  font-size: 10px;
}

.param-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.param-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 2px 4px;
  background: #f9fafb;
  border-radius: 2px;
  font-size: 10px;
}

.param-key {
  font-weight: 500;
  color: #4b5563;
  min-width: 60px;
  flex-shrink: 0;
}

.param-value {
  color: #1f2937;
  word-break: break-word;
  font-family: monospace;
}

.tool-raw pre {
  background: #f8fafc;
  padding: 4px;
  border-radius: 2px;
  margin-top: 4px;
  max-height: 100px;
  overflow-y: auto;
}
</style>