<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex justify-between items-center p-4 border-b border-base-300">
      <div class="flex items-center gap-4">
        <h2 class="text-lg font-semibold">Code Viewer</h2>
        <div class="flex items-center gap-2" v-if="codeSnippets.length > 0">
          <button 
            @click="previousSnippet" 
            class="btn btn-sm btn-ghost" 
            :disabled="currentSnippetIndex <= 0"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>
          <span class="text-sm">{{ currentSnippetIndex + 1 }} / {{ codeSnippets.length }}</span>
          <button 
            @click="nextSnippet" 
            class="btn btn-sm btn-ghost" 
            :disabled="currentSnippetIndex >= codeSnippets.length - 1"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button @click="sendErrors" class="btn btn-ghost btn-sm gap-2">
          <Bug class="w-4 h-4" />
          Send Errors
        </button>
        <button @click="copyToClipboard" class="btn btn-ghost btn-sm gap-2">
          <Copy class="w-4 h-4" />
          Copy
        </button>
        <button @click="handleClose" class="btn btn-ghost btn-sm">
          <XIcon class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 relative" style="max-height: 93vh;">
      <div v-if="currentCode" class="h-full">
        <div class="flex items-center justify-between px-4 py-2 bg-base-200">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">Language: {{ currentLanguage }}</span>
            <Badge v-if="isStreaming" variant="secondary">Streaming</Badge>
          </div>
        </div>
        
        <SandpackProvider
          :files="getFiles(currentCode)"
          :template="getTemplate(currentLanguage)"
          :theme="editorTheme"
          :customSetup="sandpackSetup"
          :options="{
            autorun: !isStreaming, // Don't auto-run when streaming
            recompileMode: 'immediate',
            recompileDelay: 500
          }"
        >
          <div class="h-[calc(100%-40px)] flex flex-col">
            <div :style="{ height: `${splitPosition}%` }" class="border-b border-base-300">
              <SandpackCodeEditor 
                showLineNumbers
                :readOnly="isStreaming"
                class="h-full"
                style="resize: none"
                wrapContent
                closableTabs
                :options="{
                  autoSave: true,
                  autoComplete: true,
                  formatOnSave: true
                }"
              />
            </div>

            <div 
              class="h-2 bg-base-200 hover:bg-base-300 cursor-row-resize flex items-center justify-center group transition-colors"
              @mousedown="startResize"
            >
              <div class="w-8 h-1 bg-base-content/20 rounded group-hover:bg-base-content/40 transition-colors"></div>
            </div>

            <div :style="{ height: `${100 - splitPosition - 1}%` }" class="overflow-hidden">
              <SandpackPreview ref="previewRef" class="h-full" :options="{
                showNavigator: true,
                showRefreshButton: true
              }" />
            </div>
          </div>
        </SandpackProvider>
      </div>
      <div v-else class="h-full flex items-center justify-center text-base-content/50">
        <p>No code selected</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { XIcon, Copy, ChevronLeft, ChevronRight, Bug } from 'lucide-vue-next'
import { SandpackProvider, SandpackPreview, SandpackCodeEditor } from 'sandpack-vue3'
import type { SandpackFiles } from '@codesandbox/sandpack-react'
import Badge from '../ui/Badge.vue'
import emitter from '@/utils/eventBus'
import { useThemeStore } from '@/stores/themeStore'

interface CodeSnippet {
  code: string
  language: string
  isStreaming: boolean
}

const emit = defineEmits(['panel-opened', 'panel-closed'])
const themeStore = useThemeStore()

// State
const currentCode = ref('')
const currentLanguage = ref('javascriptreact')
const isStreaming = ref(false)
const codeSnippets = ref<CodeSnippet[]>([])
const currentSnippetIndex = ref(-1)
const currentNodeId = ref<string | null>(null)
const splitPosition = ref(50)

// NEW: Refs for error capture
const previewRef = ref(null)
const previewErrors = ref('')

// Sandpack setup with dependencies
const sandpackSetup = {
  dependencies: {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@react-three/fiber": "^8.15.11",
    "@react-three/drei": "^9.88.13",
    "three": "^0.158.0",
    "@types/three": "^0.158.2"
  }
}

// Theme
const editorTheme = computed(() => {
  const isDark = themeStore.isDarkTheme(themeStore.currentTheme)
  const colors = themeStore.currentThemeColors
  
  return {
    colors: {
      surface1: isDark ? '#1e1e1e' : '#ffffff',
      surface2: isDark ? '#2c2c2c' : '#f5f5f5',
      surface3: isDark ? '#393939' : '#eeeeee',
      clickable: isDark ? '#999999' : '#666666',
      base: isDark ? '#808080' : '#808080',
      disabled: isDark ? '#4d4d4d' : '#cccccc',
      hover: isDark ? '#c5c5c5' : '#333333',
      accent: colors.primary,
      error: '#ff453a',
      errorSurface: isDark ? '#39000d' : '#ffebeb'
    },
    syntax: {
      plain: isDark ? '#d4d4d4' : '#24292e',
      comment: isDark ? '#6a9955' : '#6a737d',
      keyword: isDark ? '#569cd6' : '#d73a49',
      tag: isDark ? '#569cd6' : '#22863a',
      punctuation: isDark ? '#d4d4d4' : '#24292e',
      definition: isDark ? '#4fc1ff' : '#6f42c1',
      property: isDark ? '#9cdcfe' : '#005cc5',
      static: isDark ? '#d4d4d4' : '#032f62',
      string: isDark ? '#ce9178' : '#032f62'
    },
    font: {
      body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      mono: '"Fira Mono", "DejaVu Sans Mono", Menlo, Consolas, "Liberation Mono", Monaco, "Lucida Console", monospace'
    }
  }
})

// Methods
const getFiles = (code: string): SandpackFiles => {
  const mainFile = { code, active: true }
  if (['javascript', 'javascriptreact'].includes(currentLanguage.value)) {
    return {
      '/App.js': mainFile,
      '/index.js': {
        code: `
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from '@react-three/fiber';
import App from "./App";
import './styles.css';

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <Canvas>
      <App />
    </Canvas>
  </StrictMode>
);`,
        hidden: true
      },
      '/styles.css': {
        code: `
html, body, #root {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}`,
        hidden: true
      }
    }
  }
  // Add other language cases as needed
  return { '/App.js': mainFile }
}

const getTemplate = (language: string) => language.includes('vue') ? 'vue' : 'react'

// Resize handling (unchanged)
const startResize = (e: MouseEvent) => {
  e.preventDefault()
  const container = (e.target as HTMLElement).closest('.flex-1') as HTMLElement
  const startY = e.clientY
  const startHeight = splitPosition.value
  const containerHeight = container.offsetHeight

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientY - startY
    const newPosition = startHeight + (delta / containerHeight * 100)
    splitPosition.value = Math.min(Math.max(20, newPosition), 80)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const handleClose = () => {
  emit('panel-closed')
}

const copyToClipboard = async () => {
  if (currentCode.value) {
    try {
      await navigator.clipboard.writeText(currentCode.value)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }
}

// Listen for incoming sandbox updates (from your MessageContent component)
const handleShowSandbox = (data: {
  code: string
  language: string
  isStreaming: boolean
  nodeId?: string
  partial?: boolean
}) => {
  if (data.nodeId && data.nodeId !== currentNodeId.value) {
    codeSnippets.value = []
    currentSnippetIndex.value = -1
    currentNodeId.value = data.nodeId
  }
  if (codeSnippets.value.length > 0 && currentSnippetIndex.value !== -1) {
    codeSnippets.value[currentSnippetIndex.value].code = data.code
  } else {
    codeSnippets.value.push({
      code: data.code,
      language: data.language,
      isStreaming: data.isStreaming
    })
    currentSnippetIndex.value = 0
  }
  currentCode.value = data.code
  currentLanguage.value = data.language
  isStreaming.value = data.isStreaming
  emit('panel-opened')
}

const nextSnippet = () => {
  if (currentSnippetIndex.value < codeSnippets.value.length - 1) {
    currentSnippetIndex.value++
    const snippet = codeSnippets.value[currentSnippetIndex.value]
    currentCode.value = snippet.code
    currentLanguage.value = snippet.language
    isStreaming.value = snippet.isStreaming
  }
}

const previousSnippet = () => {
  if (currentSnippetIndex.value > 0) {
    currentSnippetIndex.value--
    const snippet = codeSnippets.value[currentSnippetIndex.value]
    currentCode.value = snippet.code
    currentLanguage.value = snippet.language
    isStreaming.value = snippet.isStreaming
  }
}

// NEW: Listen for error messages coming from the preview (e.g. via postMessage)
const handleIframeMessage = (event: MessageEvent) => {
  if (event.data && event.data.type === 'sandpack-error') {
    previewErrors.value = event.data.error
  }
}

// NEW: Send errors (wait a few seconds to allow the preview to update)
const sendErrors = async () => {
  await new Promise(resolve => setTimeout(resolve, 3000))
  const errorsToSend = previewErrors.value || 'No errors captured'
  // Emit an event with current code and errors; your chat/node code listens for 'debug-sandbox'
  emitter.emit('debug-sandbox', { code: currentCode.value, errors: errorsToSend })
}

onMounted(() => {
  emitter.on('show-sandbox', handleShowSandbox)
  window.addEventListener('message', handleIframeMessage)
})

onUnmounted(() => {
  emitter.off('show-sandbox', handleShowSandbox)
  window.removeEventListener('message', handleIframeMessage)
})
</script>

<style scoped>
/* (Your existing styles here, unchanged) */
:deep(.sp-wrapper) { height: 100% !important; border: none !important; background: transparent !important; }
:deep(.sp-layout) { height: 100% !important; border: none !important; background: transparent !important; flex-direction: column !important; }
:deep(.sp-stack) { height: 100% !important; background: transparent !important; }
:deep(.sp-code-editor) { height: 100% !important; min-height: 0 !important; }
:deep(.cm-editor) { height: 100% !important; }
:deep(.sp-preview-container) { height: 100% !important; min-height: 0 !important; }
:deep(.sp-preview) { height: 100% !important; padding: 0 !important; }
:deep(.sp-code-editor .cm-theme) { height: 100% !important; }
:deep(.sp-stack > div) { min-height: 0 !important; }
</style>
