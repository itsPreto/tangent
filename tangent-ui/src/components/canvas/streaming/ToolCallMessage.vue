<template>
  <div class="tool-call-message">
    <div class="tool-header">
      <span class="tool-name">{{ message.data.tool_name }}</span>
      <span class="tool-status" :class="statusClass">{{ message.data.status }}</span>
    </div>
    <div class="tool-content">
      <div v-if="message.data.parameters" class="tool-parameters">
        <strong>Parameters:</strong>
        <pre>{{ JSON.stringify(message.data.parameters, null, 2) }}</pre>
      </div>
      <div v-if="message.data.result" class="tool-result">
        <strong>Result:</strong>
        <pre>{{ JSON.stringify(message.data.result, null, 2) }}</pre>
      </div>
      <div v-if="message.data.error" class="tool-error">
        <strong>Error:</strong>
        <pre>{{ message.data.error }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  message: {
    data: {
      tool_name: string
      status: string
      parameters?: any
      result?: any
      error?: string
    }
  }
}

const props = defineProps<Props>()

const statusClass = computed(() => ({
  'status-success': props.message.data.status === 'success',
  'status-error': props.message.data.status === 'error',
  'status-pending': props.message.data.status === 'pending'
}))
</script>

<style scoped>
.tool-call-message {
  font-family: monospace;
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tool-name {
  font-weight: 600;
  color: #1e293b;
}

.tool-status {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
}

.status-success {
  background: #dcfce7;
  color: #166534;
}

.status-error {
  background: #fef2f2;
  color: #dc2626;
}

.status-pending {
  background: #fef3c7;
  color: #92400e;
}

.tool-content {
  font-size: 11px;
}

.tool-parameters,
.tool-result,
.tool-error {
  margin-bottom: 8px;
}

.tool-parameters pre,
.tool-result pre,
.tool-error pre {
  background: #f8fafc;
  padding: 4px;
  border-radius: 2px;
  margin-top: 4px;
  max-height: 100px;
  overflow-y: auto;
}

.tool-error pre {
  background: #fef2f2;
  color: #dc2626;
}
</style>