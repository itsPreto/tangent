<template>
  <div class="system-message">
    <div class="system-content">
      <div v-if="systemInit" class="system-init">
        <div class="init-header">
          <span class="init-icon">🔧</span>
          <span class="init-title">Claude Code Session Initialized</span>
        </div>
        <div class="init-details">
          <div class="init-item">
            <strong>Model:</strong> {{ systemInit.model }}
          </div>
          <div class="init-item">
            <strong>Session:</strong> {{ systemInit.session_id }}
          </div>
          <div class="init-item">
            <strong>Working Directory:</strong> {{ systemInit.cwd }}
          </div>
          <div class="init-item">
            <strong>Tools:</strong> {{ systemInit.tools.join(', ') }}
          </div>
          <div v-if="systemInit.mcp_servers.length > 0" class="init-item">
            <strong>MCP Servers:</strong>
            <div class="mcp-servers">
              <div v-for="server in systemInit.mcp_servers" :key="server.name" class="mcp-server">
                {{ server.name }} ({{ server.status }})
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="systemResult" class="system-result">
        <div class="result-header">
          <span class="result-icon">{{ systemResult.subtype === 'success' ? '✅' : '❌' }}</span>
          <span class="result-title">{{ getResultTitle(systemResult.subtype) }}</span>
        </div>
        <div class="result-details">
          <div class="result-item">
            <strong>Duration:</strong> {{ (systemResult.duration_ms / 1000).toFixed(2) }}s
          </div>
          <div class="result-item">
            <strong>API Time:</strong> {{ (systemResult.duration_api_ms / 1000).toFixed(2) }}s
          </div>
          <div class="result-item">
            <strong>Turns:</strong> {{ systemResult.num_turns }}
          </div>
          <div class="result-item">
            <strong>Cost:</strong> ${{ systemResult.total_cost_usd.toFixed(4) }}
          </div>
          <div v-if="systemResult.result" class="result-content">
            <strong>Result:</strong> {{ systemResult.result }}
          </div>
        </div>
      </div>
      
      <div v-if="rawData" class="system-raw">
        <pre>{{ rawData }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ClaudeCodeSystemMessage, ClaudeCodeResultMessage } from '../../../utils/ClaudeCodeMessageParser'

interface Props {
  message: {
    data: ClaudeCodeSystemMessage | ClaudeCodeResultMessage | any
  }
}

const props = defineProps<Props>()

const systemInit = computed(() => {
  const data = props.message.data
  if (data?.type === 'system' && data?.subtype === 'init') {
    return data as ClaudeCodeSystemMessage
  }
  return null
})

const systemResult = computed(() => {
  const data = props.message.data
  if (data?.type === 'result') {
    return data as ClaudeCodeResultMessage
  }
  return null
})

const rawData = computed(() => {
  if (systemInit.value || systemResult.value) return null
  return JSON.stringify(props.message.data, null, 2)
})

function getResultTitle(subtype: string): string {
  switch (subtype) {
    case 'success':
      return 'Session Completed Successfully'
    case 'error_max_turns':
      return 'Maximum Turns Reached'
    case 'error_during_execution':
      return 'Error During Execution'
    default:
      return 'Session Ended'
  }
}
</script>

<style scoped>
.system-message {
  font-family: monospace;
  color: #64748b;
}

.system-content {
  font-size: 11px;
}

.system-init,
.system-result {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
}

.init-header,
.result-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.init-icon,
.result-icon {
  font-size: 14px;
}

.init-title,
.result-title {
  font-weight: 600;
  color: #374151;
  font-size: 12px;
}

.init-details,
.result-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.init-item,
.result-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 10px;
}

.init-item strong,
.result-item strong {
  color: #6b7280;
  min-width: 80px;
  flex-shrink: 0;
}

.mcp-servers {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}

.mcp-server {
  font-size: 9px;
  color: #9ca3af;
  padding: 2px 4px;
  background: #f3f4f6;
  border-radius: 2px;
}

.result-content {
  margin-top: 4px;
  padding: 4px;
  background: #f9fafb;
  border-radius: 2px;
  border-left: 3px solid #3b82f6;
}

.system-raw pre {
  background: #f1f5f9;
  padding: 4px;
  border-radius: 2px;
  margin-top: 4px;
  max-height: 80px;
  overflow-y: auto;
}
</style>