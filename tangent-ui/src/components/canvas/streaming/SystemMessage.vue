<template>
  <div class="system-message">
    <div class="system-content">
      <div v-if="message.data.session_id" class="system-info">
        <strong>Session ID:</strong> {{ message.data.session_id }}
      </div>
      <div v-if="message.data.subtype" class="system-subtype">
        <strong>Type:</strong> {{ message.data.subtype }}
      </div>
      <div v-if="message.data.total_cost_usd" class="system-cost">
        <strong>Total Cost:</strong> ${{ message.data.total_cost_usd.toFixed(4) }}
      </div>
      <div v-if="message.data.num_turns" class="system-turns">
        <strong>Turns:</strong> {{ message.data.num_turns }}
      </div>
      <div v-if="rawData" class="system-raw">
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

const rawData = computed(() => {
  const filtered = { ...props.message.data }
  delete filtered.session_id
  delete filtered.subtype
  delete filtered.total_cost_usd
  delete filtered.num_turns
  
  if (Object.keys(filtered).length === 0) return null
  return JSON.stringify(filtered, null, 2)
})
</script>

<style scoped>
.system-message {
  font-family: monospace;
  color: #64748b;
}

.system-content {
  font-size: 11px;
}

.system-info,
.system-subtype,
.system-cost,
.system-turns {
  margin-bottom: 4px;
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