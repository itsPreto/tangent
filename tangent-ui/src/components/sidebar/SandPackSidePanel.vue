<template>
  <div class="h-full flex flex-col side-panel-container" :class="'theme-' + currentTheme">
    <!-- Header with enhanced toolbar - Theme-aware styling -->
    <div class="flex justify-between items-center p-2 border-b panel-header" :style="headerStyle">
      <div class="flex items-center gap-4 flex-1 min-w-0">
        <!-- View switcher -->
        <div class="flex items-center gap-2 border-r pr-4 mr-2 view-switcher" :style="dividerStyle">
          <button @click="currentView = 'editor'" class="btn btn-sm gap-2 view-btn"
            :class="currentView === 'editor' ? 'btn-primary' : 'btn-ghost'"
            :style="getViewButtonStyle(currentView === 'editor')" title="IDE">
            <Code class="w-4 h-4" />
            <span class="hidden sm:inline"></span>
          </button>
          <button @click="switchToManager" class="btn btn-sm gap-2 view-btn"
            :class="currentView === 'manager' ? 'btn-primary' : 'btn-ghost'"
            :style="getViewButtonStyle(currentView === 'manager')" title="Relics">
            <LayoutGrid class="w-4 h-4" />
            <span class="hidden sm:inline"></span>
          </button>
        </div>

        <!-- File controls (only visible in editor view) -->
        <div v-if="currentView === 'editor'" class="flex items-center gap-2">
          <!-- <button @click="createNewFile" class="btn btn-sm btn-ghost file-btn" :style="controlButtonStyle"
            title="New File">
            <FilePlus class="w-4 h-4" />
          </button>
          <button @click="createNewFolder" class="btn btn-sm btn-ghost file-btn" :style="controlButtonStyle"
            title="New Folder">
            <FolderPlus class="w-4 h-4" />
          </button> -->
          <button @click="saveFile" class="btn btn-sm gap-2 save-btn" :class="hasEdits ? 'btn-primary' : 'btn-ghost'"
            :style="getSaveButtonStyle(hasEdits)" :disabled="!hasEdits">
            <Save class="w-4 h-4" />
          </button>
        </div>

        <!-- File tabs -->
        <div v-if="currentView === 'editor' && openFiles.length > 0"
          class="flex items-center gap-1 overflow-x-auto file-tabs-container">
          <div v-for="file in openFiles" :key="file.id" @click="selectFile(file.id)"
            class="px-3 py-1 text-sm rounded-t-md cursor-pointer transition-colors flex items-center gap-1 file-tab"
            :class="currentFileId === file.id ? 'active-tab' : 'inactive-tab'"
            :style="getFileTabStyle(currentFileId === file.id)">
            <FileIcon :filename="file.name" class="w-3 h-3" />
            <span class="truncate max-w-xs">{{ file.name }}</span>
            <button @click.stop="closeFile(file.id)" class="p-1 rounded-full close-tab-btn"
              :style="closeTabButtonStyle">
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Editor-specific controls -->
        <div v-if="currentView === 'editor'" class="flex items-center gap-2">
          <button @click="toggleInlineAssistant" class="btn btn-sm editor-control-btn"
            :class="isInlineAssistantActive ? 'btn-primary' : 'btn-ghost'"
            :style="getControlButtonStyle(isInlineAssistantActive)" title="AI Assist">
            <Sparkles class="w-4 h-4" />
          </button>
          <button @click="copyToClipboard" class="btn btn-ghost btn-sm editor-control-btn" :style="controlButtonStyle">
            <Copy class="w-4 h-4" />
          </button>
        </div>

        <!-- Manager-specific controls -->
        <div v-if="currentView === 'manager'" class="flex items-center gap-2">
          <button @click="createNewRelic" class="btn btn-sm btn-primary gap-2 new-relic-btn" :style="actionButtonStyle">
            <Plus class="w-4 h-4" />
            <span class="hidden sm:inline">New Relic</span>
          </button>
        </div>

        <button @click="handleClose" class="btn btn-ghost btn-sm close-panel-btn" :style="controlButtonStyle">
          <XIcon class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 flex flex-col overflow-hidden content-area" style="height: calc(100% - 48px);">
      <!-- Editor View -->
      <template v-if="currentView === 'editor'">
        <!-- Main Editor Layout -->
        <div class="flex flex-1 overflow-hidden">
          <!-- File Explorer Sidebar -->
          <div class="w-64 border-r flex flex-col overflow-hidden" :style="explorerStyle">
            <FileExplorer :files="fileStructure" :activeFileId="currentFileId" @select-file="selectFileFromExplorer"
              @create-file="handleCreateFile" @create-folder="handleCreateFolder" @delete-item="handleDeleteItem"
              @rename-item="handleRenameItem" :theme="currentTheme" />
          </div>

          <!-- Editor and Preview Container -->
          <div class="flex-1 flex flex-col overflow-hidden">
            <!-- Language bar -->
            <div class="flex items-center justify-between px-4 py-2 language-bar" :style="languageBarStyle">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium language-indicator">{{ currentLanguage }}</span>
                <Badge v-if="isStreaming" variant="secondary"
                  :style="{ backgroundColor: themeColors.secondary + '30', color: themeColors.secondary }">Streaming
                </Badge>
              </div>
              <div v-if="previewErrors && currentLanguage !== 'python'" class="text-sm error-message"
                :style="errorMessageStyle">
                Error: {{ previewErrors }}
              </div>
            </div>

            <!-- Editor/Preview Split -->
            <div class="flex-1 flex flex-col overflow-hidden">
              <template v-if="currentLanguage === 'python'">
                <div class="h-full flex flex-col">
                  <!-- Python Editor -->
                  <div :style="{ height: `${splitPosition}%` }" class="relative min-h-0 editor-container">
                    <PythonEditor ref="pythonEditorRef" :code="currentCode" :read-only="isStreaming"
                      @update:code="handleCodeUpdate" class="h-full w-full" />
                  </div>

                  <!-- Resize handle -->
                  <div
                    class="h-2 cursor-row-resize flex items-center justify-center group transition-colors resize-handle"
                    :style="resizeHandleStyle" @mousedown="startResize">
                    <div class="w-8 h-1 rounded group-hover:bg-base-content/40 transition-colors resize-handle-bar"
                      :style="resizeHandleBarStyle"></div>
                  </div>

                  <!-- Python Preview -->
                  <div :style="{ height: `calc(${100 - splitPosition - 1}%)` }"
                    class="min-h-0 preview-container flex flex-col">
                    <PreviewContainer @refresh="runCode">
                      <PythonPreview ref="pythonPreviewRef" :code="currentCode" @message="handlePreviewMessage" />
                    </PreviewContainer>
                  </div>
                </div>
              </template>
              <template v-else>
                <SandpackProvider :files="sandpackFiles" :template="getTemplate(currentLanguage)" :theme="editorTheme"
                  :customSetup="sandpackSetup" :options="{
                    autorun: !isStreaming,
                    recompileMode: 'immediate',
                    recompileDelay: 250
                  }" class="h-full">

                  <div class="h-full flex flex-col">
                    <!-- Editor container -->
                    <div :style="{ height: `${splitPosition}%` }" class="relative min-h-0 editor-container">
                      <SandpackCodeEditor ref="sandpackEditorRef" @code-update="handleCodeUpdate" showLineNumbers
                        :readOnly="isStreaming" class="h-full w-full" wrapContent closableTabs />

                      <!-- Inline AI Assistant Prompt -->
                      <div v-if="showInlinePrompt"
                        class="absolute bottom-4 left-4 right-4 p-3 rounded-md shadow-lg z-10 inline-prompt"
                        :style="inlinePromptStyle">
                        <div class="flex items-center gap-2">
                          <Sparkles class="w-4 h-4" :style="{ color: themeColors.primary }" />
                          <input ref="inlinePromptRef" v-model="inlinePromptText" @keydown.stop
                            class="flex-1 bg-transparent border-none outline-none prompt-input"
                            :style="promptInputStyle" placeholder="Ask AI to help with your code..."
                            @keydown.enter="submitInlinePrompt" @keydown.esc="cancelInlinePrompt" />
                        </div>
                        <div class="flex justify-end mt-2 gap-2">
                          <button @click="cancelInlinePrompt" class="btn btn-sm btn-ghost cancel-btn"
                            :style="controlButtonStyle">Cancel</button>
                          <button @click="submitInlinePrompt" class="btn btn-sm btn-primary send-btn"
                            :style="actionButtonStyle">Send</button>
                        </div>
                      </div>
                    </div>

                    <!-- Resize handle -->
                    <div
                      class="h-2 cursor-row-resize flex items-center justify-center group transition-colors resize-handle"
                      :style="resizeHandleStyle" @mousedown="startResize">
                      <div class="w-8 h-1 rounded group-hover:bg-base-content/40 transition-colors resize-handle-bar"
                        :style="resizeHandleBarStyle"></div>
                    </div>

                    <!-- Preview container -->
                    <div :style="{ height: `calc(${100 - splitPosition - 1}%)` }"
                      class="min-h-0 preview-container flex flex-col">
                      <PreviewContainer @refresh="refreshPreview">
                        <SandpackPreview ref="previewRef" class="flex-1 w-full" :options="{
                          showNavigator: false,
                          showRefreshButton: false,
                          showSyntaxError: true,
                        }" @message="handlePreviewMessage" />
                      </PreviewContainer>
                    </div>
                  </div>
                </SandpackProvider>
              </template>
            </div>
          </div>
        </div>
      </template>

      <!-- Manager View -->
      <template v-if="currentView === 'manager'">
        <div class="flex-1 p-4 overflow-auto manager-view" :style="managerViewStyle">
          <!-- Search and sort controls -->
          <div class="flex flex-col md:flex-row gap-4 mb-6">
            <div class="relative flex-1 search-container">
              <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 search-icon"
                :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }" />
              <input v-model="searchQuery" type="text" placeholder="Search relics..."
                class="input input-bordered w-full pl-10 search-input" :style="searchInputStyle" />
            </div>
            <div class="flex items-center gap-2 sort-container">
              <span class="text-sm sort-label"
                :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)' }">Sort by:</span>
              <select v-model="sortBy" class="select select-bordered select-sm sort-select" :style="selectStyle">
                <option value="name">Name</option>
                <option value="date">Last modified</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          <!-- Relics grid -->
          <div v-if="filteredRelics.length > 0"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relics-grid">
            <div v-for="(relic, index) in filteredRelics" :key="relic.id" @click="openRelic(relic)"
              class="relic-card overflow-hidden cursor-pointer hover:shadow-md transition-all"
              :style="getRelicCardStyle(relic.status, index)">
              <!-- Relic preview -->
              <div class="h-32 flex items-center justify-center relative overflow-hidden relic-preview"
                :style="relicPreviewStyle">
                <div v-if="relic.thumbnailUrl" class="w-full h-full">
                  <img :src="relic.thumbnailUrl" class="w-full h-full object-cover" alt="Relic preview" />
                </div>
                <div v-else class="text-center placeholder-content"
                  :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }">
                  <Layers class="w-10 h-10 mx-auto mb-2" />
                  <span class="text-xs">No preview</span>
                </div>

                <!-- Status badge -->
                <div class="absolute top-2 right-2 px-2 py-1 rounded-full text-xs text-white status-badge"
                  :style="getStatusBadgeStyle(relic.status)">
                  {{ relic.status === 'passed' ? 'Passed' : relic.status === 'failed' ? 'Failed' : 'Feedback' }}
                </div>
              </div>

              <!-- Relic info -->
              <div class="p-3 relic-info" :style="relicInfoStyle">
                <div class="flex justify-between items-start mb-1">
                  <h3 class="font-medium text-base truncate pr-2 relic-title"
                    :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)' }">{{ relic.name }}</h3>
                  <div class="flex items-center gap-1">
                    <button @click.stop="duplicateRelic(relic)" class="p-1 rounded-full relic-action-btn"
                      :style="relicActionButtonStyle">
                      <Copy class="w-3 h-3" />
                    </button>
                    <button @click.stop="deleteRelic(relic)" class="p-1 rounded-full relic-action-btn"
                      :style="relicActionButtonStyle">
                      <Trash class="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p class="text-xs mb-2 truncate relic-description"
                  :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }">
                  {{ relic.description || 'No description' }}
                </p>
                <div class="flex justify-between items-center text-xs relic-meta"
                  :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }">
                  <span>{{ formatDate(relic.lastModified) }}</span>
                  <span>{{ relic.language }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-else class="flex flex-col items-center justify-center h-64 empty-state"
            :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }">
            <Box class="w-16 h-16 mb-4" />
            <h3 class="text-lg font-medium mb-2">No relics found</h3>
            <p class="text-sm mb-4">
              {{ searchQuery ? 'Try a different search term' : 'Create your first relic to get started' }}
            </p>
            <button @click="createNewRelic" class="btn btn-primary gap-2 create-relic-btn" :style="actionButtonStyle">
              <Plus class="w-4 h-4" />
              Create New Relic
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Modals -->
    <DiffViewModal v-if="showDiffModal" :codeSnippets="codeSnippets" @close="showDiffModal = false" />

    <!-- New File/Folder Modal -->
    <dialog ref="newItemDialog" class="modal">
      <div class="modal-box" :style="modalStyle">
        <h3 class="font-bold text-lg modal-title" :style="modalTitleStyle">
          {{ newItemType === 'file' ? 'New File' : 'New Folder' }}
        </h3>
        <div class="py-4">
          <div class="mb-4">
            <label class="label" :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }">
              {{ newItemType === 'file' ? 'File Name' : 'Folder Name' }}
            </label>
            <input v-model="newItemName" type="text"
              :placeholder="newItemType === 'file' ? 'component.jsx' : 'components'" class="input input-bordered w-full"
              :style="inputStyle" @keydown.enter="confirmNewItem" />
          </div>
          <div v-if="newItemType === 'file'" class="mb-4">
            <label class="label" :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }">
              Language
            </label>
            <select v-model="newItemLanguage" class="select select-bordered w-full" :style="selectStyle">
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="react">React (JSX)</option>
              <option value="typescriptreact">React (TSX)</option>
              <option value="vue">Vue</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="python">Python</option>
              <option value="json">JSON</option>
              <option value="markdown">Markdown</option>
            </select>
          </div>
        </div>
        <div class="modal-action">
          <button @click="closeNewItemDialog" class="btn btn-ghost" :style="modalCloseButtonStyle">Cancel</button>
          <button @click="confirmNewItem" class="btn btn-primary" :style="actionButtonStyle">Create</button>
        </div>
      </div>
    </dialog>

    <!-- New Relic Modal -->
    <dialog ref="newRelicDialog" class="modal">
      <div class="modal-box" :style="modalStyle">
        <h3 class="font-bold text-lg modal-title" :style="modalTitleStyle">Create New Relic</h3>
        <div class="py-4">
          <div class="mb-4">
            <label class="label"
              :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }">Name</label>
            <input v-model="newRelic.name" type="text" placeholder="My Awesome Component"
              class="input input-bordered w-full" :style="inputStyle" />
          </div>
          <div class="mb-4">
            <label class="label"
              :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }">Description</label>
            <textarea v-model="newRelic.description" placeholder="A brief description of this component..."
              class="textarea textarea-bordered w-full" rows="2" :style="textareaStyle"></textarea>
          </div>
          <div class="mb-4">
            <label class="label"
              :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }">Language</label>
            <select v-model="newRelic.language" class="select select-bordered w-full" :style="selectStyle">
              <option value="react">React (JSX)</option>
              <option value="typescriptreact">React (TSX)</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="vue">Vue</option>
              <option value="python">Python</option>
              <option value="html">HTML (Static)</option>
            </select>
          </div>
        </div>
        <div class="modal-action">
          <button @click="closeNewRelicDialog" class="btn btn-ghost" :style="modalCloseButtonStyle">Cancel</button>
          <button @click="confirmNewRelic" class="btn btn-primary" :style="actionButtonStyle">Create</button>
        </div>
      </div>
    </dialog>

    <!-- Delete Confirmation Modal -->
    <dialog ref="deleteConfirmDialog" class="modal">
      <div class="modal-box" :style="modalStyle">
        <h3 class="font-bold text-lg modal-title" :style="modalTitleStyle">Delete Item</h3>
        <p class="py-4" :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }">
          Are you sure you want to delete "{{ itemToDelete?.name }}"? This action cannot be undone.
        </p>
        <div class="modal-action">
          <button @click="closeDeleteConfirmDialog" class="btn btn-ghost" :style="modalCloseButtonStyle">Cancel</button>
          <button @click="confirmDeleteItem" class="btn btn-error" :style="errorButtonStyle">Delete</button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  XIcon, Copy, ChevronLeft, ChevronRight, Save, FilePlus, FolderPlus, FolderOpen, Box,
  FileCode, Play, Sparkles, X, Code, LayoutGrid, Plus, Filter, Search, Layers, Trash
} from 'lucide-vue-next'
import { getTemplateCode, getFiles } from '@/utils/relicTemplates'
import { SandpackProvider, SandpackPreview, SandpackCodeEditor } from 'sandpack-vue3'
import type { SandpackFiles, SandpackMessage } from '@codesandbox/sandpack-react'
import { sandpackSetup } from '../sidebar/sandpackDeps'
import PreviewContainer from './SandPackPreviewContainer.vue'
import PythonPreview from './PythonPreview.vue'
import PythonEditor from './PythonEditor.vue'
import Badge from '../ui/Badge.vue'
import emitter from '@/utils/eventBus'
import { useThemeStore } from '@/stores/themeStore'
import DiffViewModal from './DiffViewModal.vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from "@/stores/chatStore"
import { useProjectStore } from '@/stores/projectStore'
import { storeToRefs } from 'pinia'

// File Explorer Component
import FileExplorer from './FileExplorer.vue'
import FileIcon from './FileIcon.vue'

interface Props {
  nodeId: string
}

interface CodeSnippet {
  code: string
  language: string
  isStreaming: boolean
  timestamp: number
  codeIndex: number
  nodeId?: string
}

interface FileItem {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  parentId?: string
  language?: string
  code?: string
  lastModified: number
  children?: FileItem[]
}

interface CodeFile {
  id: string
  name: string
  language: string
  code: string
  lastModified: number
  path: string
}

interface Relic {
  id: string
  name: string
  description: string
  language: string
  code: string
  dependencies: Record<string, string>
  status: 'passed' | 'failed' | 'feedback'
  lastModified: number
  thumbnailUrl?: string
  sourceInfo?: {
    chatId: string
    nodeId: string
    messageIndex: number
    codeIndex: number
  }
}

interface NewRelicData {
  name: string
  description: string
  language: string
  template: string
}

const props = withDefaults(defineProps<Props>(), {
  nodeId: ''
})

const emit = defineEmits(['panel-opened', 'panel-closed'])
const themeStore = useThemeStore()
const canvasStore = useCanvasStore()
const appStore = useAppStore()

const { snappedNodeId, activeNode } = storeToRefs(canvasStore)

const pythonEditorRef = ref<any>(null)
const sandpackEditorRef = ref(null)
const pythonPreviewRef = ref<any>(null)

// Theme-related state
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light')
let themeObserver: MutationObserver | null = null

// Check if current theme is dark
const isDarkTheme = computed(() => {
  return themeStore.isDarkTheme(currentTheme.value)
})

// Get theme colors from the store
const themeColors = computed(() => {
  return themeStore.getThemeColors(currentTheme.value)
})

const effectiveNodeId = computed(() =>
  currentNodeId.value ||
  snappedNodeId.value ||
  activeNode.value ||
  canvasStore.nodes[0]?.id
)

const currentNodeId = ref<string>(props.nodeId)

// View Management
const currentView = ref<'editor' | 'manager'>('editor')

let autoSaveTimeout: number | null = null

// Editor State
const currentCode = ref('// Start coding here\n\nconst MyComponent = () => {\n  return (\n    <div>\n      <h1>Hello World</h1>\n    </div>\n  );\n};\n\nexport default MyComponent;')
const currentLanguage = ref('react')
const isStreaming = ref(false)
const currentCodeIndex = ref<number | undefined>(undefined)
const currentOriginalCode = ref('')
const codeSnippets = ref<CodeSnippet[]>([])
const currentSnippetIndex = ref(-1)
const splitPosition = ref(50)
const showDiffModal = ref(false)
const previewRef = ref<null | { getBundlerError: () => string }>(null)
const previewErrors = ref('')
const lastSavedCode = ref('')
const hasEdits = ref(false)

// File management
const fileStructure = ref<FileItem[]>([])
const openFiles = ref<CodeFile[]>([])
const currentFileId = ref<string | null>(null)

// New item modal state
const newItemDialog = ref<HTMLDialogElement | null>(null)
const newItemType = ref<'file' | 'folder'>('file')
const newItemName = ref('')
const newItemLanguage = ref('javascript')
const newItemParentId = ref<string | null>(null)

// Inline AI assistance
const isInlineAssistantActive = ref(false)
const showInlinePrompt = ref(false)
const inlinePromptText = ref('')
const inlinePromptRef = ref<HTMLInputElement | null>(null)

// Manager state
const relics = ref<Relic[]>([])
const searchQuery = ref('')
const sortBy = ref<'name' | 'date' | 'status'>('date')
const newRelicDialog = ref<HTMLDialogElement | null>(null)
const deleteConfirmDialog = ref<HTMLDialogElement | null>(null)
const itemToDelete = ref<FileItem | Relic | null>(null)
const newRelic = ref<NewRelicData>({
  name: '',
  description: '',
  language: 'react',
  template: 'basic'
})

// Initialize default file structure
const initializeFileStructure = () => {
  fileStructure.value = [
    {
      id: 'src',
      name: 'src',
      type: 'folder',
      path: '/src',
      lastModified: Date.now(),
      children: [
        {
          id: 'app-js',
          name: 'App.js',
          type: 'file',
          path: '/src/App.js',
          parentId: 'src',
          language: 'react',
          code: '// Start coding here\n\nconst App = () => {\n  return (\n    <div>\n      <h1>Hello World</h1>\n    </div>\n  );\n};\n\nexport default App;',
          lastModified: Date.now()
        }
      ]
    },
    {
      id: 'public',
      name: 'public',
      type: 'folder',
      path: '/public',
      lastModified: Date.now(),
      children: [
        {
          id: 'index-html',
          name: 'index.html',
          type: 'file',
          path: '/public/index.html',
          parentId: 'public',
          language: 'html',
          code: '<!DOCTYPE html>\n<html>\n<head>\n  <title>My App</title>\n</head>\n<body>\n  <div id="root"></div>\n</body>\n</html>',
          lastModified: Date.now()
        }
      ]
    }
  ]

  // Load the first file
  const firstFile = findFileById('app-js')
  if (firstFile) {
    selectFileFromExplorer(firstFile)
  }
}

// File management functions
const findFileById = (id: string): FileItem | null => {
  const search = (items: FileItem[]): FileItem | null => {
    for (const item of items) {
      if (item.id === id) return item
      if (item.children) {
        const found = search(item.children)
        if (found) return found
      }
    }
    return null
  }
  return search(fileStructure.value)
}

const addFileToStructure = (file: FileItem, parentId?: string) => {
  if (!parentId) {
    fileStructure.value.push(file)
    return
  }

  const parent = findFileById(parentId)
  if (parent && parent.type === 'folder') {
    if (!parent.children) parent.children = []
    parent.children.push(file)
  }
}

const removeFileFromStructure = (fileId: string) => {
  const removeFromArray = (items: FileItem[]): boolean => {
    const index = items.findIndex(item => item.id === fileId)
    if (index !== -1) {
      items.splice(index, 1)
      return true
    }

    for (const item of items) {
      if (item.children && removeFromArray(item.children)) {
        return true
      }
    }
    return false
  }

  removeFromArray(fileStructure.value)
}

const selectFileFromExplorer = (file: FileItem) => {
  if (file.type !== 'file') return

  // Check if file is already open
  const existingFile = openFiles.value.find(f => f.id === file.id)
  if (existingFile) {
    currentFileId.value = file.id
    currentCode.value = file.code || ''
    currentLanguage.value = file.language || 'javascript'
    lastSavedCode.value = currentCode.value
    hasEdits.value = false
  } else {
    // Open new file
    const codeFile: CodeFile = {
      id: file.id,
      name: file.name,
      language: file.language || 'javascript',
      code: file.code || '',
      lastModified: file.lastModified,
      path: file.path
    }

    openFiles.value.push(codeFile)
    currentFileId.value = file.id
    currentCode.value = file.code || ''
    currentLanguage.value = file.language || 'javascript'
    lastSavedCode.value = currentCode.value
    hasEdits.value = false
  }
}

const selectFile = (fileId: string) => {
  const file = openFiles.value.find(f => f.id === fileId)
  if (file) {
    currentFileId.value = fileId
    currentCode.value = file.code
    currentLanguage.value = file.language
    lastSavedCode.value = file.code
    hasEdits.value = false
  }
}

const closeFile = (fileId: string) => {
  const fileIndex = openFiles.value.findIndex(f => f.id === fileId)
  if (fileIndex !== -1) {
    const file = openFiles.value[fileIndex]

    if (currentFileId.value === fileId && hasEdits.value) {
      if (confirm('Save changes before closing?')) {
        saveFile()
      }
    }

    openFiles.value.splice(fileIndex, 1)

    if (currentFileId.value === fileId) {
      if (openFiles.value.length > 0) {
        selectFile(openFiles.value[0].id)
      } else {
        currentFileId.value = null
        currentCode.value = ''
      }
    }
  }
}

const createNewFile = () => {
  newItemType.value = 'file'
  newItemName.value = ''
  newItemLanguage.value = 'javascript'
  newItemParentId.value = null
  newItemDialog.value?.showModal()
}

const createNewFolder = () => {
  newItemType.value = 'folder'
  newItemName.value = ''
  newItemParentId.value = null
  newItemDialog.value?.showModal()
}

const handleCreateFile = (parentId?: string) => {
  newItemType.value = 'file'
  newItemName.value = ''
  newItemLanguage.value = 'javascript'
  newItemParentId.value = parentId || null
  newItemDialog.value?.showModal()
}

const handleCreateFolder = (parentId?: string) => {
  newItemType.value = 'folder'
  newItemName.value = ''
  newItemParentId.value = parentId || null
  newItemDialog.value?.showModal()
}

const closeNewItemDialog = () => {
  newItemDialog.value?.close()
}

const confirmNewItem = () => {
  if (!newItemName.value.trim()) {
    alert(`Please enter a ${newItemType.value} name`)
    return
  }

  const projectStore = useProjectStore()
  
  if (projectStore.currentProject) {
    const itemPath = newItemParentId.value ? 
      `${findFileById(newItemParentId.value)?.path || ''}/${newItemName.value}` : 
      `/${newItemName.value}`

    if (newItemType.value === 'file') {
      const language = getLanguageFromExtension(newItemName.value) || newItemLanguage.value
      
      // Add to project store
      const fileId = projectStore.addFileToProject(projectStore.currentProject.id, {
        name: newItemName.value,
        path: itemPath,
        content: getTemplateCode('basic', language),
        language,
        type: 'file',
        parentId: newItemParentId.value || undefined
      })

      // Add to local file structure
      const newFile: FileItem = {
        id: fileId,
        name: newItemName.value,
        type: 'file',
        path: itemPath,
        parentId: newItemParentId.value || undefined,
        language,
        code: getTemplateCode('basic', language),
        lastModified: Date.now()
      }

      addFileToStructure(newFile, newItemParentId.value || undefined)
      selectFileFromExplorer(newFile)
    } else {
      // Add folder to project store
      const folderId = projectStore.addFileToProject(projectStore.currentProject.id, {
        name: newItemName.value,
        path: itemPath,
        content: '',
        language: 'folder',
        type: 'folder',
        parentId: newItemParentId.value || undefined
      })

      // Add to local file structure
      const newFolder: FileItem = {
        id: folderId,
        name: newItemName.value,
        type: 'folder',
        path: itemPath,
        parentId: newItemParentId.value || undefined,
        lastModified: Date.now(),
        children: []
      }

      addFileToStructure(newFolder, newItemParentId.value || undefined)
    }
  }

  closeNewItemDialog()
}

const handleDeleteItem = (item: FileItem) => {
  const projectStore = useProjectStore()
  
  if (projectStore.currentProject) {
    // Delete from project store
    projectStore.deleteFileFromProject(projectStore.currentProject.id, item.id)
    
    // Close the file if it's open
    closeFile(item.id)
    
    // Remove from file structure
    removeFileFromStructure(item.id)
  }
}

const handleRenameItem = (item: FileItem, newName: string) => {
  const projectStore = useProjectStore()
  
  if (projectStore.currentProject) {
    // Rename in project store
    projectStore.renameFileInProject(projectStore.currentProject.id, item.id, newName)
    
    // Update local structure
    item.name = newName
    item.lastModified = Date.now()
    
    // Update the path
    const parentPath = item.parentId ? findFileById(item.parentId)?.path || '' : ''
    item.path = `${parentPath}/${newName}`

    // If it's an open file, update the open files array
    const openFile = openFiles.value.find(f => f.id === item.id)
    if (openFile) {
      openFile.name = newName
      openFile.path = item.path
    }

    // Update language if it's a file and extension changed
    if (item.type === 'file') {
      const newLanguage = getLanguageFromExtension(newName)
      if (newLanguage && newLanguage !== item.language) {
        item.language = newLanguage
        if (openFile) {
          openFile.language = newLanguage
        }
        if (currentFileId.value === item.id) {
          currentLanguage.value = newLanguage
        }
      }
    }
  }
}


const closeDeleteConfirmDialog = () => {
  deleteConfirmDialog.value?.close()
  itemToDelete.value = null
}

const confirmDeleteItem = () => {
  if (!itemToDelete.value) return

  if ('path' in itemToDelete.value) {
    // It's a file item
    const fileItem = itemToDelete.value as FileItem

    // Close the file if it's open
    closeFile(fileItem.id)

    // Remove from file structure
    removeFileFromStructure(fileItem.id)
  } else {
    // It's a relic (existing logic)
    const relicItem = itemToDelete.value as Relic
    const index = relics.value.findIndex(r => r.id === relicItem.id)
    if (index !== -1) {
      relics.value.splice(index, 1)
      saveRelicsToLocalStorage()
    }
  }

  closeDeleteConfirmDialog()
}

// Utility functions
const getLanguageFromExtension = (filename: string): string | null => {
  const ext = filename.split('.').pop()?.toLowerCase()
  const extensionMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'react',
    'ts': 'typescript',
    'tsx': 'typescriptreact',
    'vue': 'vue',
    'html': 'html',
    'css': 'css',
    'py': 'python',
    'json': 'json',
    'md': 'markdown'
  }
  return extensionMap[ext || ''] || null
}



// Sandpack integration
const sandpackFiles = computed(() => {
  // Convert file structure to sandpack files format
  const files: { [key: string]: { code: string } } = {}
  const addFilesToSandpack = (items: FileItem[]) => {
    for (const item of items) {
      if (item.type === 'file' && item.code) {
        files[item.path] = { code: item.code }
      }
      if (item.children) {
        addFilesToSandpack(item.children)
      }
    }
  }

  addFilesToSandpack(fileStructure.value)

  // Ensure there's at least one file for sandpack
  if (Object.keys(files).length === 0) {
    files['/App.js'] = { code: currentCode.value }
  }

  return files
})

// Theme-based styling (keeping existing styles)
const headerStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 35, 0.95)' : 'rgba(250, 250, 255, 0.95)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(230, 230, 240, 0.5)',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px'
  }
})

const explorerStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(25, 25, 30, 0.95)' : 'rgba(248, 248, 252, 0.95)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(230, 230, 240, 0.5)'
  }
})

const dividerStyle = computed(() => {
  return {
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(230, 230, 240, 0.5)'
  }
})

const getViewButtonStyle = (isActive: boolean) => {
  if (isActive) {
    return {
      backgroundColor: isDarkTheme.value ? adjustColorOpacity(themeColors.value.primary, 0.2) : adjustColorOpacity(themeColors.value.primary, 0.1),
      color: themeColors.value.primary,
      borderColor: adjustColorOpacity(themeColors.value.primary, 0.3)
    }
  }
  return controlButtonStyle.value
}

const controlButtonStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.4)' : 'rgba(245, 245, 250, 0.6)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.2)' : 'rgba(230, 230, 240, 0.4)'
  }
})

const getControlButtonStyle = (isActive: boolean) => {
  if (isActive) {
    return {
      backgroundColor: isDarkTheme.value ? adjustColorOpacity(themeColors.value.primary, 0.2) : adjustColorOpacity(themeColors.value.primary, 0.1),
      color: themeColors.value.primary,
      borderColor: adjustColorOpacity(themeColors.value.primary, 0.3)
    }
  }
  return controlButtonStyle.value
}

const actionButtonStyle = computed(() => {
  const primaryColor = themeColors.value.primary
  return {
    backgroundColor: isDarkTheme.value
      ? adjustColorOpacity(primaryColor, 0.2)
      : adjustColorOpacity(primaryColor, 0.1),
    color: themeColors.value.primary,
    borderColor: adjustColorOpacity(primaryColor, 0.3)
  }
})

const getSaveButtonStyle = (isEnabled: boolean) => {
  if (isEnabled) {
    return actionButtonStyle.value
  }
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.3)' : 'rgba(245, 245, 250, 0.5)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.2)' : 'rgba(230, 230, 240, 0.3)'
  }
}

const errorButtonStyle = computed(() => {
  const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--er') || '#FF3333'
  return {
    backgroundColor: isDarkTheme.value
      ? adjustColorOpacity(errorColor, 0.2)
      : adjustColorOpacity(errorColor, 0.1),
    color: errorColor,
    borderColor: adjustColorOpacity(errorColor, 0.3)
  }
})

const getFileTabStyle = (isActive: boolean) => {
  if (isActive) {
    return {
      backgroundColor: isDarkTheme.value ? 'rgba(60, 60, 70, 0.95)' : 'rgba(230, 230, 240, 0.95)',
      color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
      borderColor: themeColors.value.primary,
      borderTopWidth: '2px',
      borderTopStyle: 'solid'
    }
  }
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(50, 50, 60, 0.6)' : 'rgba(240, 240, 250, 0.6)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'
  }
}

const closeTabButtonStyle = computed(() => {
  return {
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)'
  }
})

const languageBarStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.8)' : 'rgba(240, 240, 250, 0.8)'
  }
})

const errorMessageStyle = computed(() => {
  const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--er') || '#FF3333'
  return { color: errorColor }
})

const resizeHandleStyle = computed(() => {
  return {
    backgroundColor: 'transparent',
    marginRight: '8px',
    marginLeft: '8px',
    radiusBorder: '16px',
    transition: 'background-color 0.2s ease'
  }
})

const resizeHandleBarStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value
      ? adjustColorOpacity(themeColors.value.primary, 0.6)
      : adjustColorOpacity(themeColors.value.primary, 0.4),
    transition: 'background-color 0.2s ease, width 0.2s ease',
    height: '2px'
  }
})

const inlinePromptStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    borderColor: themeColors.value.primary,
    borderWidth: '3px',
    borderStyle: 'solid'
  }
})

const promptInputStyle = computed(() => {
  return {
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
  }
})

const managerViewStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(28, 28, 35, 0.8)' : 'rgba(250, 250, 255, 0.8)'
  }
})

const searchInputStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.7)' : 'rgba(255, 255, 255, 0.95)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)'
  }
})

const selectStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.7)' : 'rgba(255, 255, 255, 0.95)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)'
  }
})

const relicPreviewStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 40, 0.8)' : 'rgba(245, 245, 250, 0.8)',
    borderBottom: isDarkTheme.value
      ? '1px solid rgba(80, 80, 90, 0.3)'
      : '1px solid rgba(220, 220, 230, 0.5)'
  }
})

const getRelicCardStyle = (status: string, index: number) => {
  let borderColor
  if (status === 'passed') {
    borderColor = getComputedStyle(document.documentElement).getPropertyValue('--su') || '#36D399'
  } else if (status === 'failed') {
    borderColor = getComputedStyle(document.documentElement).getPropertyValue('--er') || '#FF3333'
  } else {
    borderColor = getComputedStyle(document.documentElement).getPropertyValue('--in') || '#3ABFF8'
  }

  return {
    backgroundColor: isDarkTheme.value ? 'rgba(35, 35, 45, 0.9)' : 'rgba(255, 255, 255, 0.95)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '0.5rem',
    borderLeftWidth: '4px',
    borderLeftColor: borderColor,
    '--index': index
  }
}

const getStatusBadgeStyle = (status: string) => {
  let backgroundColor
  if (status === 'passed') {
    backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--su') || '#36D399'
  } else if (status === 'failed') {
    backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--er') || '#FF3333'
  } else {
    backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--in') || '#3ABFF8'
  }
  return { backgroundColor }
}

const relicInfoStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(32, 32, 40, 0.95)' : 'rgba(252, 252, 255, 0.95)'
  }
})

const relicActionButtonStyle = computed(() => {
  return {
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)'
  }
})

const modalStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(32, 32, 40, 0.98)' : 'rgba(255, 255, 255, 0.98)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)',
    borderWidth: '1px',
    borderStyle: 'solid'
  }
})

const modalTitleStyle = computed(() => {
  return {
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.95)'
  }
})

const modalCloseButtonStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(60, 60, 70, 0.6)' : 'rgba(240, 240, 245, 0.6)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)'
  }
})

const inputStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.7)' : 'rgba(250, 250, 255, 0.95)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)'
  }
})

const textareaStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.7)' : 'rgba(250, 250, 255, 0.95)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)'
  }
})

const filteredRelics = computed(() => {
  return relics.value
    .filter(relic => {
      const matchesSearch = searchQuery.value
        ? relic.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        relic.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        relic.language.toLowerCase().includes(searchQuery.value.toLowerCase())
        : true
      return matchesSearch
    })
    .sort((a, b) => {
      if (sortBy.value === 'name') {
        return a.name.localeCompare(b.name)
      } else if (sortBy.value === 'date') {
        return b.lastModified - a.lastModified
      } else if (sortBy.value === 'status') {
        return a.status.localeCompare(b.status)
      }
      return 0
    })
})

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

// Utility function to adjust color opacity
function adjustColorOpacity(hexColor: string, opacity: number): string {
  let r, g, b
  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hexColor)) {
    return `rgba(128, 128, 128, ${opacity})`
  }
  const hex = hexColor.replace('#', '')
  if (hex.length === 3) {
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16)
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16)
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16)
  } else {
    r = parseInt(hex.substring(0, 2), 16)
    g = parseInt(hex.substring(2, 4), 16)
    b = parseInt(hex.substring(4, 6), 16)
  }
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

const updateThemeFromDOM = () => {
  const newTheme = document.documentElement.getAttribute('data-theme') || 'light'
  if (newTheme !== currentTheme.value) {
    currentTheme.value = newTheme
  }
}

const getTemplate = (language: string) => {
  if (language === 'vue') return 'vue'
  if (language === 'python') return 'static'
  if (language === 'html') return 'static'
  if (language === 'typescript' || language === 'typescriptreact') return 'react-ts'
  return 'react'
}

const startResize = (e: MouseEvent) => {
  e.preventDefault()
  const container = document.querySelector('.h-full.flex.flex-col') as HTMLElement
  if (!container) return

  const containerHeight = container.offsetHeight
  const startY = e.clientY
  const startHeight = splitPosition.value

  const onMouseMove = (e: MouseEvent) => {
    const deltaY = e.clientY - startY
    const deltaPercent = (deltaY / containerHeight) * 100
    const newSplitPosition = Math.min(Math.max(20, startHeight + deltaPercent), 80)
    splitPosition.value = newSplitPosition
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

const saveFile = () => {
  if (!currentFileId.value || !hasEdits.value) return

  const projectStore = useProjectStore()
  if (projectStore.currentProject) {
    // Save to project store
    projectStore.updateProjectFile(projectStore.currentProject.id, currentFileId.value, currentCode.value)
    
    // Update local file structure
    const file = findFileById(currentFileId.value)
    if (file && file.type === 'file') {
      file.code = currentCode.value
      file.lastModified = Date.now()
    }

    // Update the open file
    const openFile = openFiles.value.find(f => f.id === currentFileId.value)
    if (openFile) {
      openFile.code = currentCode.value
      openFile.lastModified = Date.now()
    }

    lastSavedCode.value = currentCode.value
    hasEdits.value = false
  }
}


const handleCodeUpdate = (newCode: string) => {
  currentCode.value = newCode
  hasEdits.value = currentCode.value !== lastSavedCode.value

  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout)
  }

  autoSaveTimeout = window.setTimeout(() => {
    saveFile()
    autoSaveTimeout = null
  }, 1000)
}

const copyToClipboard = async () => {
  if (currentLanguage.value === 'python') {
    if (pythonEditorRef.value) {
      const latestCode = pythonEditorRef.value.getCode()
      currentCode.value = latestCode || currentCode.value
    }
  } else {
    if (sandpackEditorRef.value && sandpackEditorRef.value.getCode) {
      try {
        const latestCode = await sandpackEditorRef.value.getCode()
        currentCode.value = latestCode || currentCode.value
      } catch (err) {
        console.error("Error getting code:", err)
      }
    }
  }

  if (currentCode.value) {
    try {
      await navigator.clipboard.writeText(currentCode.value)
      console.log("Code copied to clipboard")
    } catch (err) {
      console.error("Failed to copy code:", err)
    }
  }
}

const refreshPreview = () => {
  if (previewRef.value) {
    const iframe = previewRef.value.$el.querySelector('iframe')
    if (iframe) {
      iframe.src = iframe.src
    }
  }
}

const runCode = () => {
  previewErrors.value = ''
  if (currentLanguage.value === 'python') {
    if (pythonPreviewRef.value) {
      pythonPreviewRef.value.runPythonCode()
    }
  }
}

const handlePreviewMessage = (event: SandpackMessage | { type: 'error' | 'console', error?: string | Error, data?: string[] }) => {
  if (event.type === 'error') {
    if (event.error) {
      if (typeof event.error === 'string') {
        previewErrors.value = event.error
      } else if (event.error.message) {
        previewErrors.value = event.error.message
      } else {
        previewErrors.value = "An unknown error occurred"
      }
    }
  } else if (event.type === 'console') {
    if (Array.isArray(event.data) && event.data.length > 0) {
      const logMessages = event.data.map((item) => {
        if (typeof item === 'object' && item !== null && 'data' in item && item.data !== undefined) {
          if (Array.isArray(item.data)) {
            return item.data.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
          } else if (item.data instanceof Error || typeof item.data.message === 'string') {
            return item.data.message
          }
          return String(item.data)
        } else if (typeof item === 'string') {
          return item
        }
        return ''
      }).filter(Boolean)

      if (logMessages.length > 0) {
        if (currentLanguage.value === 'python') {
          console.log('Python Output:', logMessages.join('\n'))
          if (logMessages.some(msg => msg.includes('Error:') || msg.includes('Traceback'))) {
            previewErrors.value = logMessages.join('\n')
          } else {
            previewErrors.value = ''
          }
        } else {
          previewErrors.value = logMessages.join('\n')
        }
      } else {
        if (previewErrors.value) previewErrors.value = ''
      }
    }
  }
}

const toggleInlineAssistant = async () => {
  if (sandpackEditorRef.value && sandpackEditorRef.value.getCode) {
    const latestCode = await sandpackEditorRef.value.getCode()
    currentCode.value = latestCode || currentCode.value
  }

  showInlinePrompt.value = true
  nextTick(() => {
    inlinePromptRef.value?.focus()
  })
}

const submitInlinePrompt = async () => {
  const promptText = inlinePromptText.value.trim()
  if (!promptText) {
    cancelInlinePrompt()
    return
  }

  showInlinePrompt.value = false
  inlinePromptText.value = ''

  // Implementation would depend on your AI integration
  console.log('AI prompt:', promptText)
}

const cancelInlinePrompt = () => {
  inlinePromptText.value = ''
  showInlinePrompt.value = false
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}

// Manager functions
const switchToManager = () => {
  currentView.value = 'manager'
}

const createNewRelic = () => {
  newRelic.value = {
    name: '',
    description: '',
    language: 'react',
    template: 'basic'
  }
  newRelicDialog.value?.showModal()
}

const closeNewRelicDialog = () => {
  newRelicDialog.value?.close()
}

const confirmNewRelic = () => {
  if (!newRelic.value.name.trim()) {
    alert('Please enter a name for the relic')
    return
  }

  const relicId = `relic-${Date.now()}`
  const code = getTemplateCode(newRelic.value.template, newRelic.value.language)

  const relic: Relic = {
    id: relicId,
    name: newRelic.value.name,
    description: newRelic.value.description,
    language: newRelic.value.language,
    code,
    dependencies: {},
    status: 'passed',
    lastModified: Date.now()
  }

  relics.value.push(relic)
  saveRelicsToLocalStorage()
  closeNewRelicDialog()
  openRelic(relic)
}

const openRelic = async (relic: Relic) => {
  currentView.value = 'editor'
  currentCode.value = relic.code
  currentLanguage.value = relic.language
  currentFileId.value = relic.id
  lastSavedCode.value = relic.code
  hasEdits.value = false
  previewErrors.value = ''

  await nextTick()
  runCode()
}

const duplicateRelic = (relic: Relic) => {
  const newRelic: Relic = {
    ...relic,
    id: `relic-${Date.now()}`,
    name: `${relic.name} (Copy)`,
    lastModified: Date.now()
  }
  relics.value.push(newRelic)
  saveRelicsToLocalStorage()
}

const deleteRelic = (relic: Relic) => {
  itemToDelete.value = relic
  deleteConfirmDialog.value?.showModal()
}

const saveRelicsToLocalStorage = () => {
  localStorage.setItem('webRelics', JSON.stringify(relics.value))
}

const loadRelics = () => {
  const relicsRaw = localStorage.getItem('webRelics')
  if (relicsRaw) {
    try {
      relics.value = JSON.parse(relicsRaw)
    } catch (e) {
      console.error('Error parsing relics:', e)
      relics.value = []
    }
  } else {
    relics.value = []
  }
}


const handleShowSandbox = (payload: {
  code: string
  language: string
  isStreaming: boolean
  partial?: boolean
  nodeId?: string
  codeIndex?: number
  messageIndex?: number
  chatId?: string
}) => {
  const { code, language, isStreaming: payloadIsStreaming, partial = false, nodeId = 'adhoc', codeIndex = 0, messageIndex = 0, chatId } = payload

  if (!code) return

  // Use projectStore instead of direct file manipulation
  const projectStore = useProjectStore()
  const chatStore = useChatStore()
  
  const workspaceId = chatId || chatStore.currentChatId || 'default'
  
  // Get or create project for this specific code snippet
  let project = projectStore.getProjectBySource(workspaceId, nodeId, messageIndex, codeIndex)
  
  if (!project) {
    // Create new project from the code snippet
    project = projectStore.createProjectFromCode(code, language, {
      workspaceId,
      nodeId,
      messageIndex,
      codeIndex
    })
  } else if (payloadIsStreaming) {
    // Update the main file content during streaming
    const mainFile = project.fileStructure.find(f => f.type === 'file' && f.name.startsWith('App.'))
    if (mainFile) {
      projectStore.updateProjectFile(project.id, mainFile.id, code)
    }
  }
  
  // Switch to this project
  projectStore.switchToProject(project.id)
  
  // Update the editor to show this project
  loadProjectIntoEditor(project)
  
  // Update streaming state
  isStreaming.value = payloadIsStreaming
  currentNodeId.value = nodeId

  if (!payloadIsStreaming) {
    lastSavedCode.value = code
  }
}

// New function to load project into editor
const loadProjectIntoEditor = (project: CodeProject) => {
  // Convert project structure to editor structure
  const convertProjectFilesToEditor = (projectFiles: ProjectFile[]): FileItem[] => {
    return projectFiles.map(pf => ({
      id: pf.id,
      name: pf.name,
      type: pf.type,
      path: pf.path,
      parentId: pf.parentId,
      language: pf.language,
      code: pf.content,
      lastModified: pf.lastModified,
      children: pf.children ? convertProjectFilesToEditor(pf.children) : undefined
    }))
  }
  
  // Update file structure
  fileStructure.value = convertProjectFilesToEditor(project.fileStructure)
  
  // Clear and restore open files
  openFiles.value = []
  
  // Ensure the main file is always open
  const mainFile = project.fileStructure.find(f => f.name.startsWith('App.'))
  if (mainFile && !project.openFiles.includes(mainFile.id)) {
    project.openFiles.unshift(mainFile.id)
  }
  
  // Restore open files
  project.openFiles.forEach(fileId => {
    const projectFile = findProjectFileById(project, fileId)
    if (projectFile) {
      const editorFile: CodeFile = {
        id: projectFile.id,
        name: projectFile.name,
        language: projectFile.language,
        code: projectFile.content,
        lastModified: projectFile.lastModified,
        path: projectFile.path
      }
      openFiles.value.push(editorFile)
    }
  })
  
  // Set current file
  if (project.currentFileId) {
    selectFile(project.currentFileId)
  } else if (openFiles.value.length > 0) {
    selectFile(openFiles.value[0].id)
  } else {
    // Select first file in structure
    const firstFile = findFirstFileInStructure(fileStructure.value)
    if (firstFile) {
      selectFileFromExplorer(firstFile)
    }
  }
}

// Helper function to find project file by ID
const findProjectFileById = (project: CodeProject, fileId: string): ProjectFile | null => {
  const search = (files: ProjectFile[]): ProjectFile | null => {
    for (const file of files) {
      if (file.id === fileId) return file
      if (file.children) {
        const found = search(file.children)
        if (found) return found
      }
    }
    return null
  }
  return search(project.fileStructure)
}

// Helper function to find first file in structure
const findFirstFileInStructure = (files: FileItem[]): FileItem | null => {
  for (const file of files) {
    if (file.type === 'file') return file
    if (file.children) {
      const found = findFirstFileInStructure(file.children)
      if (found) return found
    }
  }
  return null
}

// Helper function to get file extension based on language
const getFileExtension = (language: string): string => {
  const extensionMap: Record<string, string> = {
    'javascript': 'js',
    'typescript': 'ts',
    'react': 'jsx',
    'typescriptreact': 'tsx',
    'vue': 'vue',
    'html': 'html',
    'css': 'css',
    'python': 'py',
    'json': 'json',
    'markdown': 'md'
  }
  return extensionMap[language] || 'txt'
}

// Lifecycle
onMounted(() => {
  initializeFileStructure()

  themeObserver = new MutationObserver(() => {
    updateThemeFromDOM()
  })

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })

  updateThemeFromDOM()
  emitter.on('show-sandbox', handleShowSandbox)
  loadRelics()
})

onUnmounted(() => {
  if (themeObserver) {
    themeObserver.disconnect()
  }
  emitter.off('show-sandbox', handleShowSandbox)
})

watch(() => props.nodeId, (newId) => {
  if (newId) {
    currentNodeId.value = newId
  }
})

watch(() => [openFiles.value, currentFileId.value], () => {
  const projectStore = useProjectStore()
  if (projectStore.currentProject) {
    const openFileIds = openFiles.value.map(f => f.id)
    projectStore.updateProjectOpenFiles(
      projectStore.currentProject.id, 
      openFileIds, 
      currentFileId.value
    )
  }
}, { deep: true })

</script>

<style scoped>
/* Sandpack styles */
:deep(.sp-wrapper) {
  height: 100% !important;
  border: none !important;
}

:deep(.sp-layout) {
  height: 100% !important;
  border: none !important;
  background: transparent !important;
  flex-direction: column !important;
}

:deep(.sp-stack) {
  height: 100% !important;
  background: transparent !important;
}

:deep(.sp-code-editor) {
  height: 100% !important;
  min-height: 0 !important;
}

:deep(.cm-editor) {
  height: 100% !important;
}

:deep(.sp-preview-container) {
  height: 100% !important;
  min-height: 0 !important;
}

:deep(.sp-preview) {
  height: 100% !important;
  padding: 0 !important;
}

/* Theme-specific styling */
.side-panel-container {
  background-color: var(--b1);
  color: var(--bc);
}

.theme-dark .side-panel-container {
  background-color: rgba(20, 20, 25, 0.98);
}

/* File tabs animation */
.file-tab {
  transition: all 0.2s ease-in-out;
}

/* Relic cards animation */
.relic-card {
  animation: slide-in-fade 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  animation-delay: calc(0.05s * var(--index, 0));
  transition: all 0.3s ease;
}

@keyframes slide-in-fade {
  0% {
    transform: translateY(20px);
    opacity: 0;
  }

  100% {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>