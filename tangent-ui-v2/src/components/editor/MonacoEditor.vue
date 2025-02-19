<template>
  <!-- Just a container that fills its parent space -->
  <div ref="containerRef" class="monaco-editor-container w-full h-full"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as monaco from 'monaco-editor'

// We define props for v-model, language, theme, etc.
const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'javascriptreact' }, // Default to React/JS
  theme: { type: String, default: 'vs-dark' },
  options: { type: Object, default: () => ({}) },
  readOnly: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'mount', 'change'])

const containerRef = ref<HTMLElement | null>(null)
let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  if (containerRef.value) {
    // Create the editor
    editorInstance = monaco.editor.create(containerRef.value, {
      value: props.modelValue,
      language: props.language,
      theme: props.theme,
      automaticLayout: true,
      ...props.options,
      readOnly: props.readOnly,
    })

    // Emit v-model updates
    editorInstance.onDidChangeModelContent(() => {
      const newVal = editorInstance?.getValue() || ''
      emit('update:modelValue', newVal)
      emit('change', newVal)
    })

    // Let parent know we mounted
    emit('mount', editorInstance)
  }
})

// If parent changes the code, update the editor
watch(
  () => props.modelValue,
  (newVal) => {
    if (editorInstance && newVal !== editorInstance.getValue()) {
      const pos = editorInstance.getPosition()
      editorInstance.setValue(newVal)
      if (pos) editorInstance.setPosition(pos)
    }
  }
)

// If parent changes the language, update the model
watch(
  () => props.language,
  (newLang) => {
    if (editorInstance && editorInstance.getModel()) {
      monaco.editor.setModelLanguage(editorInstance.getModel()!, newLang)
    }
  }
)

// If parent changes the theme, update Monaco
watch(
  () => props.theme,
  (newTheme) => {
    monaco.editor.setTheme(newTheme)
  }
)

onBeforeUnmount(() => {
  if (editorInstance) {
    editorInstance.dispose()
  }
})
</script>

<style>
.monaco-editor-container {
  /* Fills its parent’s width/height */
  width: 100%;
  height: 100%;
}
</style>
