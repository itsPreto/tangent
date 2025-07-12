<template>
  <div class="error-message">
    <div class="error-content">
      <div v-if="message.data.error" class="error-text">
        {{ message.data.error }}
      </div>
      <div v-if="message.data.details" class="error-details">
        <strong>Details:</strong>
        <pre>{{ JSON.stringify(message.data.details, null, 2) }}</pre>
      </div>
      <div v-if="rawData" class="error-raw">
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
  if (props.message.data.error || props.message.data.details) return null
  return JSON.stringify(props.message.data, null, 2)
})
</script>

<style scoped>
.error-message {
  font-family: monospace;
  color: #dc2626;
}

.error-content {
  font-size: 11px;
}

.error-text {
  margin-bottom: 8px;
  font-weight: 500;
}

.error-details {
  margin-bottom: 8px;
}

.error-details pre {
  background: #fef2f2;
  padding: 4px;
  border-radius: 2px;
  margin-top: 4px;
  max-height: 80px;
  overflow-y: auto;
}

.error-raw pre {
  background: #fef2f2;
  padding: 4px;
  border-radius: 2px;
  margin-top: 4px;
  max-height: 80px;
  overflow-y: auto;
}
</style>