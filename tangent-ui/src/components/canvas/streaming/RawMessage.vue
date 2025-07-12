<template>
  <div class="raw-message">
    <div class="raw-content">
      <div v-if="message.data.text" class="raw-text">
        {{ message.data.text }}
      </div>
      <div v-else class="raw-json">
        <pre>{{ JSON.stringify(message.data, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  message: {
    data: any
  }
}

const props = defineProps<Props>()
</script>

<style scoped>
.raw-message {
  font-family: monospace;
  color: #64748b;
}

.raw-content {
  font-size: 11px;
}

.raw-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.raw-json pre {
  background: #f8fafc;
  padding: 4px;
  border-radius: 2px;
  max-height: 80px;
  overflow-y: auto;
}
</style>