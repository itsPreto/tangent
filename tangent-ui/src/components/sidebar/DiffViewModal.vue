<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
    <div class="bg-base-100 p-6 rounded-lg shadow-xl w-full max-w-4xl">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold">Code Diff Viewer</h2>
        <button @click="closeModal" class="btn btn-ghost btn-sm">
          <XIcon class="w-4 h-4" />
        </button>
      </div>

      <div class="flex gap-4 mb-4">
        <select v-model="selectedVersion1" class="select select-bordered">
          <option v-for="(snippet, index) in codeSnippets" :key="index" :value="index">
            Version {{ index + 1 }} ({{ new Date(snippet.timestamp).toLocaleString() }})
          </option>
        </select>
        <span class="text-base-content/70">vs.</span>
        <select v-model="selectedVersion2" class="select select-bordered">
          <option v-for="(snippet, index) in codeSnippets" :key="index" :value="index">
            Version {{ index + 1 }} ({{ new Date(snippet.timestamp).toLocaleString() }})
          </option>
        </select>
      </div>

      <div v-if="diffResult" class="border border-base-300 rounded-lg overflow-auto" style="max-height: 60vh;">
        <pre class="p-4 whitespace-pre-wrap" v-html="diffResult"></pre>
      </div>

      <div class="mt-6">
        <button @click="closeModal" class="btn btn-block">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { XIcon } from 'lucide-vue-next'
import { diffChars } from 'diff'

interface CodeSnippet {
  code: string;
  language: string;
  isStreaming: boolean;
  timestamp: number;
}

const props = defineProps({
  codeSnippets: {
    type: Array as () => CodeSnippet[],
    required: true
  }
});

const emit = defineEmits(['close']);

const isOpen = ref(true);
const selectedVersion1 = ref(0);
const selectedVersion2 = ref(1);

const diffResult = computed(() => {
  if (props.codeSnippets.length < 2) return '';
  const snippet1 = props.codeSnippets[selectedVersion1.value]?.code || '';
  const snippet2 = props.codeSnippets[selectedVersion2.value]?.code || '';

  const diff = diffChars(snippet1, snippet2);

  return diff.map(part => {
    let color = 'inherit';
    if (part.added) color = 'green';
    if (part.removed) color = 'red';
    return `<span style="color: ${color};">${escapeHtml(part.value)}</span>`;
  }).join('');
});

const escapeHtml = (unsafe: string) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const closeModal = () => {
  emit('close');
  isOpen.value = false;
};

watch(isOpen, (newVal) => {
  if (!newVal) {
    emit('close')
  }
})
</script>

<style scoped>
pre {
  font-family: monospace;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>