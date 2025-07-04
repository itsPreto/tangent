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
          <!-- Project file controls (hidden for relics) -->
          <div v-if="!currentFileId?.startsWith('relic-')" class="flex items-center gap-2">
            <!-- <button @click="createNewFile" class="btn btn-sm btn-ghost file-btn" :style="controlButtonStyle"
              title="New File">
              <FilePlus class="w-4 h-4" />
            </button>
            <button @click="createNewFolder" class="btn btn-sm btn-ghost file-btn" :style="controlButtonStyle"
              title="New Folder">
              <FolderPlus class="w-4 h-4" />
            </button> -->
          </div>
          
          <!-- Save button (always visible) -->
          <button @click="saveFile" class="btn btn-sm gap-2 save-btn" 
            :class="currentFileId?.startsWith('relic-') ? 'btn-primary' : (hasEdits ? 'btn-primary' : 'btn-ghost')"
            :style="currentFileId?.startsWith('relic-') ? actionButtonStyle : getSaveButtonStyle(hasEdits)" 
            :disabled="currentFileId?.startsWith('relic-') ? false : !hasEdits">
            <Save class="w-4 h-4" />
            <span v-if="currentFileId?.startsWith('relic-')" class="hidden sm:inline">Save Version</span>
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
          <!-- File Explorer Sidebar (hidden for relics) -->
          <div v-if="!currentFileId?.startsWith('relic-')"
            class="border-r flex flex-col overflow-hidden transition-all duration-300 ease-in-out" 
            :class="explorerCollapsed ? 'w-12' : 'w-64'"
            :style="explorerStyle">
            <div v-if="!explorerCollapsed" class="h-full">
              <FileExplorer :files="fileStructure" :activeFileId="currentFileId" @select-file="selectFileFromExplorer"
                @create-file="handleCreateFile" @create-folder="handleCreateFolder" @delete-item="handleDeleteItem"
                @rename-item="handleRenameItem" @toggle-explorer="toggleExplorer" :theme="currentTheme" />
            </div>
            <div v-else class="h-full flex flex-col items-center py-3">
              <button @click="toggleExplorer" 
                class="p-2 rounded-md hover:bg-base-content/10 transition-colors"
                :style="controlButtonStyle" 
                title="Expand Explorer">
                <ChevronRight class="w-4 h-4" />
              </button>
            </div>
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
              <div v-else-if="compilationSuccess && currentLanguage !== 'python'" class="text-sm text-success"
                :style="{ color: themeColors.primary }">
                ✓ Compiled successfully
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
                <SandpackProvider :files="debouncedSandpackFiles" :template="getTemplate(currentLanguage)" :theme="editorTheme"
                  :customSetup="sandpackSetup" :options="{
                    autorun: !isStreaming && !isCompiling,
                    recompileMode: 'immediate',
                    recompileDelay: 0
                  }" class="h-full">

                  <div class="h-full flex flex-col">
                    <!-- Editor container -->
                    <div :style="{ height: `${splitPosition}%` }" class="relative min-h-0 editor-container">
                      <SandpackCodeEditor ref="sandpackEditorRef" 
                        @code-update="handleCodeUpdate"
                        @update="handleCodeUpdate"
                        @change="handleCodeUpdate"
                        showLineNumbers
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
                      <PreviewContainer @refresh="refreshPreview" 
                        :show-capture-button="showCaptureButton && !isStreaming && !isCompiling"
                        :is-capturing="isCapturing"
                        @capture="captureScreenshot">
                        <!-- Loading animation overlay -->
                        <div v-if="isStreaming || isCompiling" class="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm z-10">
                          <div class="flex flex-col items-center space-y-4">
                            <div class="w-24 h-24">
                              <DotLottieVue 
                                src="/loading-animation-1.lottie" 
                                background="transparent" 
                                speed="1" 
                                loop 
                                autoplay>
                              </DotLottieVue>
                            </div>
                            <div class="text-sm font-medium opacity-80">
                              {{ isStreaming ? 'Streaming code...' : 'Compiling...' }}
                            </div>
                          </div>
                        </div>
                        
                        <SandpackPreview ref="previewRef" class="flex-1 w-full" :options="{
                          showNavigator: false,
                          showRefreshButton: false,
                          showSyntaxError: !isStreaming && !isCompiling,
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
                    <button @click.stop="showRelicVersionHistory(relic)" class="p-1 rounded-full relic-action-btn"
                      :style="relicActionButtonStyle" title="Version History">
                      <History class="w-3 h-3" />
                    </button>
                    <button @click.stop="duplicateRelic(relic)" class="p-1 rounded-full relic-action-btn"
                      :style="relicActionButtonStyle" title="Duplicate">
                      <Copy class="w-3 h-3" />
                    </button>
                    <button @click.stop="deleteRelic(relic)" class="p-1 rounded-full relic-action-btn"
                      :style="relicActionButtonStyle" title="Delete">
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
    
    <!-- Version History Modal -->
    <dialog ref="versionHistoryDialog" class="modal">
      <div class="modal-box max-w-2xl" :style="modalStyle">
        <h3 class="font-bold text-lg modal-title mb-4" :style="modalTitleStyle">
          Version History - {{ selectedRelicForHistory?.name }}
        </h3>
        <div class="space-y-2 max-h-96 overflow-y-auto">
          <div v-for="version in relicVersions" :key="version.version"
               @click="loadRelicVersion(version.version)"
               class="p-3 rounded cursor-pointer transition-colors"
               :style="getVersionItemStyle(version.version === selectedRelicForHistory?.latest_version?.version)">
            <div class="flex justify-between items-start">
              <div>
                <div class="font-medium">Version {{ version.version }}</div>
                <div class="text-sm opacity-70">{{ version.commit_message }}</div>
              </div>
              <div class="text-sm opacity-60">
                {{ formatDate(new Date(version.created_at).getTime()) }}
              </div>
            </div>
          </div>
        </div>
        <div class="modal-action">
          <button @click="closeVersionHistoryDialog" class="btn btn-ghost" :style="modalCloseButtonStyle">Close</button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  XIcon, Copy, ChevronLeft, ChevronRight, Save, FilePlus, FolderPlus, FolderOpen, Box,
  FileCode, Play, Sparkles, X, Code, LayoutGrid, Plus, Filter, Search, Layers, Trash, History, Camera
} from 'lucide-vue-next'
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'
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
import { useProjectStore, type CodeProject, type ProjectFile } from '@/stores/projectStore'
import { storeToRefs } from 'pinia'
import { relicService, type Relic as RelicData, type CreateRelicData, type RelicVersion } from '@/services/relicService'
import { thumbnailService } from '@/services/thumbnailService'

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

interface Relic extends RelicData {
  status: 'passed' | 'failed' | 'feedback'
  lastModified: number
  thumbnailUrl?: string
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
const explorerCollapsed = ref(true)

let autoSaveTimeout: number | null = null

// Editor State
const currentCode = ref('// Start coding here\n\nconst MyComponent = () => {\n  return (\n    <div>\n      <h1>Hello World</h1>\n    </div>\n  );\n};\n\nexport default MyComponent;')
const currentLanguage = ref('react')
const isStreaming = ref(false)
const isCompiling = ref(false)
const debouncedCode = ref('')
const compilationTimer = ref<number | null>(null)
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
const showCaptureButton = ref(true)
const isCapturing = ref(false)
const compilationSuccess = ref(false)

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
const versionHistoryDialog = ref<HTMLDialogElement | null>(null)
const itemToDelete = ref<FileItem | Relic | null>(null)
const selectedRelicForHistory = ref<Relic | null>(null)
const relicVersions = ref<RelicVersion[]>([])
const newRelic = ref<NewRelicData>({
  name: '',
  description: '',
  language: 'react',
  template: 'basic'
})

// Initialize default file structure
const initializeFileStructure = () => {
  // Don't initialize if we're viewing a relic
  const isRelic = currentFileId.value?.startsWith('relic-')
  if (isRelic) {
    console.log('Skipping file structure init for relic')
    return
  }
  
  // Don't initialize if we already have a project
  const projectStore = useProjectStore()
  if (projectStore.currentProject) {
    loadProjectIntoEditor(projectStore.currentProject)
    return
  }

  fileStructure.value = [
    {
      id: 'app-js',
      name: 'App.js',
      type: 'file',
      path: '/App.js',
      language: 'javascript',
      code: '// Start coding here\n\nconst App = () => {\n  return (\n    <div style={{ minHeight: "100vh", backgroundColor: "inherit", color: "inherit", padding: "2rem" }}>\n      <h1>Hello World</h1>\n      <p>Your themed preview is ready!</p>\n    </div>\n  );\n};\n\nexport default App;',
      lastModified: Date.now()
    },
    {
      id: 'index-js',
      name: 'index.js',
      type: 'file',
      path: '/index.js',
      language: 'javascript',
      code: 'import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App.js";\n\nconst root = createRoot(document.getElementById("root"));\nroot.render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);',
      lastModified: Date.now()
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

const toggleExplorer = () => {
  const isRelic = currentFileId.value?.startsWith('relic-')
  
  // Don't show file explorer for relics
  if (isRelic) {
    console.log('File explorer disabled for relics')
    return
  }
  
  explorerCollapsed.value = !explorerCollapsed.value
}


const closeDeleteConfirmDialog = () => {
  deleteConfirmDialog.value?.close()
  itemToDelete.value = null
}

const confirmDeleteItem = async () => {
  if (!itemToDelete.value) return

  if ('path' in itemToDelete.value) {
    // It's a file item
    const fileItem = itemToDelete.value as FileItem

    // Close the file if it's open
    closeFile(fileItem.id)

    // Remove from file structure
    removeFileFromStructure(fileItem.id)
  } else {
    // It's a relic
    const relicItem = itemToDelete.value as Relic
    try {
      await relicService.deleteRelic(relicItem.id)
      const index = relics.value.findIndex(r => r.id === relicItem.id)
      if (index !== -1) {
        relics.value.splice(index, 1)
      }
    } catch (error) {
      console.error('Error deleting relic:', error)
      alert('Failed to delete relic: ' + error.message)
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

  // Ensure we always have the main App.js file at the root level for Sandpack
  // If we have /src/App.js but not /App.js, copy it to root
  if (files['/src/App.js'] && !files['/App.js']) {
    files['/App.js'] = files['/src/App.js']
  }

  // Ensure we have the necessary setup files if they don't exist
  if (!files['/index.js']) {
    files['/index.js'] = { 
      code: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);` 
    }
  }

  return files
})

// Debounced sandpack files - only updates after streaming stops
const debouncedSandpackFiles = computed(() => {
  if (isStreaming.value || isCompiling.value) {
    // Return last stable version during streaming
    return debouncedCode.value ? 
      { '/App.js': { code: debouncedCode.value } } : 
      sandpackFiles.value
  }
  
  // For relics, ensure we use the current code
  const isRelic = currentFileId.value?.startsWith('relic-')
  if (isRelic && currentCode.value) {
    // Always use App.js for consistency with Sandpack rendering
    const fileName = '/App.js'
    
    // Create a proper Sandpack files structure for the relic
    const files = { [fileName]: { code: currentCode.value } }
    
    // Add necessary setup files
    if (currentLanguage.value.includes('react')) {
      files['/index.js'] = {
        code: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import './styles.css';

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);`
      }
      
      files['/styles.css'] = {
        code: `html, body, #root {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--fallback-b1, oklch(var(--b1)));
  color: var(--fallback-bc, oklch(var(--bc)));
}

.container {
  background-color: inherit;
  color: inherit;
  padding: 2rem;
  text-align: center;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}`
      }
    }
    
    return files
  }
  
  return sandpackFiles.value
})

// Theme-based styling (keeping existing styles)
const headerStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 35, 0.95)' : 'rgba(250, 250, 255, 0.95)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(230, 230, 240, 0.5)',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
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

const saveFile = async () => {
  if (!currentFileId.value) return

  const projectStore = useProjectStore()
  
  // Check if this is a relic
  const isRelic = currentFileId.value.startsWith('relic-')
  
  if (isRelic) {
    try {
      // FIRST: Get the actual code from the Sandpack editor
      let codeToSave = currentCode.value
      
      if (sandpackEditorRef.value && sandpackEditorRef.value.getCode) {
        try {
          const editorCode = await sandpackEditorRef.value.getCode('/App.js')
          if (editorCode) {
            codeToSave = editorCode
            console.log('Got code from editor for saving:', editorCode.substring(0, 100))
          }
        } catch (err) {
          try {
            const fallbackCode = await sandpackEditorRef.value.getCode()
            if (fallbackCode) {
              codeToSave = fallbackCode
              console.log('Got fallback code from editor:', fallbackCode.substring(0, 100))
            }
          } catch (err2) {
            console.log('Could not get code from editor, using stored code')
          }
        }
      }
      
      console.log('Saving relic with code:', codeToSave.substring(0, 100))
      
      // Save to relic service (creates new version)
      const updatedRelic = await relicService.saveCode(currentFileId.value, codeToSave)
      
      console.log('Updated relic response:', updatedRelic)
      
      // Update local relic with the latest version data
      const relicIndex = relics.value.findIndex(r => r.id === currentFileId.value)
      if (relicIndex !== -1) {
        relics.value[relicIndex] = {
          ...relics.value[relicIndex],
          ...updatedRelic,
          code: updatedRelic.latest_version?.code || codeToSave,
          lastModified: new Date(updatedRelic.updated_at).getTime(),
          status: relics.value[relicIndex].status, // Preserve local status
          latest_version: updatedRelic.latest_version // Ensure latest version is updated
        }
        
        console.log('Updated local relic:', relics.value[relicIndex])
      }
      
      // Update our stored code and reset edit state
      currentCode.value = codeToSave
      lastSavedCode.value = codeToSave
      hasEdits.value = false
      
      // Also refresh the relics list to ensure we have the latest data
      await loadRelics()
      
      console.log('Relic saved successfully with latest version')
    } catch (error) {
      console.error('Error saving relic:', error)
      alert('Failed to save relic: ' + error.message)
    }
  } else if (projectStore.currentProject) {
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
  
  // Check if editing changes compared to last saved
  const codeChanged = currentCode.value !== lastSavedCode.value
  hasEdits.value = codeChanged
  
  console.log('Code update:', {
    newCode: newCode.substring(0, 50) + '...',
    lastSaved: lastSavedCode.value.substring(0, 50) + '...',
    hasEdits: hasEdits.value,
    isRelic: currentFileId.value?.startsWith('relic-')
  })

  // Update the current file in memory immediately
  if (currentFileId.value) {
    const file = findFileById(currentFileId.value)
    if (file && file.type === 'file') {
      file.code = newCode
    }
    
    const openFile = openFiles.value.find(f => f.id === currentFileId.value)
    if (openFile) {
      openFile.code = newCode
    }
  }

  // Handle debounced compilation
  if (isStreaming.value) {
    // Don't compile during streaming
    if (compilationTimer.value) {
      clearTimeout(compilationTimer.value)
    }
  } else {
    // Debounce compilation for manual edits
    if (compilationTimer.value) {
      clearTimeout(compilationTimer.value)
    }
    
    isCompiling.value = true
    compilationTimer.value = window.setTimeout(() => {
      debouncedCode.value = newCode
      isCompiling.value = false
      compilationTimer.value = null
    }, 300)
  }

  // Only auto-save for non-relic files (relics should be manually saved)
  const isRelic = currentFileId.value?.startsWith('relic-')
  if (!isRelic) {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout)
    }

    autoSaveTimeout = window.setTimeout(() => {
      saveFile()
      autoSaveTimeout = null
    }, 1000)
  }
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
  console.log('Preview message received:', event)
  
  if (event.type === 'error') {
    compilationSuccess.value = false
    showCaptureButton.value = false
    if (event.error) {
      if (typeof event.error === 'string') {
        previewErrors.value = event.error
      } else if (event.error.message) {
        previewErrors.value = event.error.message
      } else {
        previewErrors.value = "An unknown error occurred"
      }
    }
  } else if (event.type === 'compile') {
    // Handle successful compilation
    if (event.status === 'success') {
      compilationSuccess.value = true
      previewErrors.value = ''
      setTimeout(() => {
        showCaptureButton.value = true
      }, 500)
    }
  } else if (event.type === 'done' || event.type === 'success') {
    // Alternative success message types
    compilationSuccess.value = true
    previewErrors.value = ''
    setTimeout(() => {
      showCaptureButton.value = true
    }, 500)
  } else if (event.type === 'action' && event.action === 'show-error') {
    // Handle bundler errors
    compilationSuccess.value = false
    showCaptureButton.value = false
    
    if (previewRef.value && previewRef.value.getBundlerError) {
      previewErrors.value = previewRef.value.getBundlerError()
    }
  } else if (event.type === 'start') {
    // Compilation started
    compilationSuccess.value = false
    showCaptureButton.value = false
    previewErrors.value = ''
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
  } else {
    // For any other event type, if there are no errors and it's not streaming/compiling,
    // assume the component rendered successfully and show capture button
    if (!isStreaming.value && !isCompiling.value && !previewErrors.value) {
      setTimeout(() => {
        if (!showCaptureButton.value) {
          showCaptureButton.value = true
        }
      }, 1000) // Wait a bit longer for the render to complete
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

const confirmNewRelic = async () => {
  if (!newRelic.value.name.trim()) {
    alert('Please enter a name for the relic')
    return
  }

  try {
    const relicId = `relic-${Date.now()}`
    const code = getTemplateCode(newRelic.value.template, newRelic.value.language)
    
    const relicData: CreateRelicData = {
      id: relicId,
      name: newRelic.value.name,
      description: newRelic.value.description || '',
      language: newRelic.value.language,
      code,
      dependencies: {},
      workspace_id: effectiveNodeId.value
    }
    
    const createdRelic = await relicService.createRelic(relicData)
    
    // Transform to local format
    const relic: Relic = {
      ...createdRelic,
      status: 'passed',
      lastModified: new Date(createdRelic.created_at).getTime(),
      code: createdRelic.latest_version?.code || code
    }
    
    relics.value.push(relic)
    closeNewRelicDialog()
    
    console.log('Opening relic with template code:', code)
    openRelic(relic)
  } catch (error) {
    console.error('Error creating relic:', error)
    alert('Failed to create relic: ' + error.message)
  }
}

const openRelic = async (relic: Relic) => {
  currentView.value = 'editor'
  
  // Use latest version code if available
  const code = relic.latest_version?.code || relic.code || ''
  
  // Clear existing project state to load relic properly
  fileStructure.value = []
  openFiles.value = []
  
  // Create a simple file structure for the relic (always use App.js)
  const fileName = 'App.js'
  const relicFile: FileItem = {
    id: relic.id,
    name: fileName,
    type: 'file',
    path: `/${fileName}`,
    language: relic.language,
    code: code,
    lastModified: relic.lastModified
  }
  
  fileStructure.value = [relicFile]
  
  // Add to open files
  const codeFile: CodeFile = {
    id: relic.id,
    name: fileName,
    language: relic.language,
    code: code,
    lastModified: relic.lastModified,
    path: `/${fileName}`
  }
  
  openFiles.value = [codeFile]
  
  // Set current state
  currentCode.value = code
  currentLanguage.value = relic.language
  currentFileId.value = relic.id
  lastSavedCode.value = code
  hasEdits.value = false
  previewErrors.value = ''
  
  console.log('Relic opened:', {
    id: relic.id,
    codeLength: code.length,
    language: relic.language,
    hasEdits: hasEdits.value
  })

  await nextTick()
  runCode()
}

const duplicateRelic = async (relic: Relic) => {
  try {
    const newRelicData: CreateRelicData = {
      id: `relic-${Date.now()}`,
      name: `${relic.name} (Copy)`,
      description: relic.description,
      language: relic.language,
      code: relic.code || relic.latest_version?.code || '',
      dependencies: relic.latest_version?.dependencies || {},
      workspace_id: effectiveNodeId.value
    }
    
    const createdRelic = await relicService.createRelic(newRelicData)
    
    const newRelic: Relic = {
      ...createdRelic,
      status: 'passed',
      lastModified: new Date(createdRelic.created_at).getTime(),
      code: createdRelic.latest_version?.code || newRelicData.code
    }
    
    relics.value.push(newRelic)
  } catch (error) {
    console.error('Error duplicating relic:', error)
    alert('Failed to duplicate relic: ' + error.message)
  }
}

const deleteRelic = (relic: Relic) => {
  itemToDelete.value = relic
  deleteConfirmDialog.value?.showModal()
}

const saveRelicsToLocalStorage = () => {
  localStorage.setItem('webRelics', JSON.stringify(relics.value))
}

const showRelicVersionHistory = async (relic: Relic) => {
  try {
    selectedRelicForHistory.value = relic
    relicVersions.value = await relicService.getRelicVersions(relic.id)
    
    console.log('Version history for relic:', relic.id)
    console.log('Available versions:', relicVersions.value)
    console.log('Relic latest version:', relic.latest_version)
    
    versionHistoryDialog.value?.showModal()
  } catch (error) {
    console.error('Error loading version history:', error)
    alert('Failed to load version history: ' + error.message)
  }
}

const closeVersionHistoryDialog = () => {
  versionHistoryDialog.value?.close()
  selectedRelicForHistory.value = null
  relicVersions.value = []
}

const loadRelicVersion = async (version: number) => {
  if (!selectedRelicForHistory.value) return
  
  try {
    const relicWithVersion = await relicService.getRelic(selectedRelicForHistory.value.id, version)
    
    // Update the relic in our list
    const index = relics.value.findIndex(r => r.id === selectedRelicForHistory.value!.id)
    if (index !== -1) {
      relics.value[index] = {
        ...relics.value[index],
        ...relicWithVersion,
        code: relicWithVersion.latest_version?.code || '',
        lastModified: new Date(relicWithVersion.updated_at).getTime(),
        status: relics.value[index].status
      }
    }
    
    // Open the relic with the selected version
    closeVersionHistoryDialog()
    openRelic(relics.value[index])
  } catch (error) {
    console.error('Error loading relic version:', error)
    alert('Failed to load relic version: ' + error.message)
  }
}

const getVersionItemStyle = (isCurrent: boolean) => {
  if (isCurrent) {
    return {
      backgroundColor: isDarkTheme.value 
        ? adjustColorOpacity(themeColors.value.primary, 0.2) 
        : adjustColorOpacity(themeColors.value.primary, 0.1),
      borderColor: adjustColorOpacity(themeColors.value.primary, 0.3),
      borderWidth: '1px',
      borderStyle: 'solid'
    }
  }
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.4)' : 'rgba(245, 245, 250, 0.6)',
    borderColor: 'transparent',
    borderWidth: '1px',
    borderStyle: 'solid'
  }
}

// Debug functions
const debugRelicState = () => {
  console.log('=== RELIC DEBUG STATE ===')
  console.log('currentFileId:', currentFileId.value)
  console.log('currentCode length:', currentCode.value?.length || 0)
  console.log('lastSavedCode length:', lastSavedCode.value?.length || 0)
  console.log('hasEdits:', hasEdits.value)
  console.log('currentCode preview:', currentCode.value?.substring(0, 100))
  console.log('lastSavedCode preview:', lastSavedCode.value?.substring(0, 100))
  console.log('codes are equal:', currentCode.value === lastSavedCode.value)
  console.log('isStreaming:', isStreaming.value)
  console.log('========================')
}

const forceEnableSave = () => {
  console.log('Force enabling save button')
  hasEdits.value = true
}


// Screenshot capture functionality
const captureScreenshot = async () => {
  if (isCapturing.value) return
  
  isCapturing.value = true
  
  try {
    // Find the preview iframe - try multiple selectors
    let previewIframe = document.querySelector('iframe[data-sandpack-preview]') as HTMLIFrameElement
    
    if (!previewIframe) {
      // Try alternative selectors for Sandpack iframe
      previewIframe = document.querySelector('.sp-preview iframe') as HTMLIFrameElement
    }
    
    if (!previewIframe) {
      // Try generic iframe in preview container
      previewIframe = document.querySelector('.preview-container iframe') as HTMLIFrameElement
    }
    
    if (!previewIframe) {
      // Try any iframe in the sandpack container
      previewIframe = document.querySelector('.sp-wrapper iframe') as HTMLIFrameElement
    }
    
    if (!previewIframe) {
      console.error('Preview iframe not found. Available iframes:', 
        Array.from(document.querySelectorAll('iframe')).map(el => ({
          src: el.src,
          className: el.className,
          id: el.id,
          dataset: el.dataset
        }))
      )
      return
    }
    
    console.log('Found preview iframe:', previewIframe)
    
    // Get the current code content and language from the editor
    const currentCodeContent = currentCode.value || debouncedCode.value || ''
    const currentLanguage = currentFileId.value?.endsWith('.html') ? 'html' :
                           currentFileId.value?.endsWith('.css') ? 'css' :
                           currentFileId.value?.endsWith('.js') ? 'javascript' :
                           currentFileId.value?.endsWith('.ts') ? 'typescript' :
                           'javascript' // default
    
    // Capture the screenshot with code content and language
    const screenshotDataUrl = await thumbnailService.captureIframeScreenshot(previewIframe, currentCodeContent, currentLanguage)
    
    console.log('Screenshot captured:', {
      dataUrl: screenshotDataUrl ? screenshotDataUrl.substring(0, 100) : 'null',
      hasData: !!screenshotDataUrl
    })
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `screenshot-${timestamp}.jpg`
    
    // Upload the screenshot
    const thumbnailUrl = await thumbnailService.uploadThumbnailImage(screenshotDataUrl, filename)
    
    // Determine what type of content we're capturing
    if (currentFileId.value?.startsWith('relic-')) {
      // Save thumbnail for relic
      const relicId = currentFileId.value.replace('relic-', '')
      await thumbnailService.saveThumbnail({
        relic_id: relicId,
        thumbnail_url: thumbnailUrl,
        type: 'relic'
      })
      
      // Update the relic in our local state
      const relicIndex = relics.value.findIndex(r => r.id === relicId)
      if (relicIndex !== -1) {
        relics.value[relicIndex].thumbnailUrl = thumbnailUrl
      }
      
      console.log('Thumbnail saved for relic:', relicId)
    } else {
      // Save thumbnail for code preview from a conversation branch
      const codeIndex = currentCodeIndex.value ?? 0; // Default to 0 if undefined
      await thumbnailService.saveThumbnail({
        node_id: effectiveNodeId.value,
        code_index: codeIndex,
        thumbnail_url: thumbnailUrl,
        type: 'code_preview'
      })
      
      console.log('Thumbnail saved for code preview:', { 
        nodeId: effectiveNodeId.value, 
        codeIndex: codeIndex 
      })
      
      console.log('Screenshot captured and saved:', thumbnailUrl)
      
      // Emit event to notify CodePreview components to reload thumbnails
      emitter.emit('thumbnail-captured', {
        nodeId: effectiveNodeId.value,
        codeIndex: codeIndex
      })
    }
    
    // Hide the capture button after successful capture
    showCaptureButton.value = false
    
  } catch (error) {
    console.error('Error capturing screenshot:', error)
    alert('Failed to capture screenshot: ' + error.message)
  } finally {
    isCapturing.value = false
  }
}

// Manual code checker for relics
const checkCodeChanges = async () => {
  if (!currentFileId.value?.startsWith('relic-')) return
  
  if (sandpackEditorRef.value && sandpackEditorRef.value.getCode) {
    try {
      // Get code from the App.js file specifically
      const editorCode = await sandpackEditorRef.value.getCode('/App.js')
      if (editorCode && editorCode !== currentCode.value) {
        console.log('Manual code check detected change in /App.js')
        console.log('Editor code preview:', editorCode.substring(0, 100))
        console.log('Current code preview:', currentCode.value.substring(0, 100))
        handleCodeUpdate(editorCode)
      }
    } catch (err) {
      console.error('Error getting code from editor:', err)
      // Fallback - try to get any code from editor
      try {
        const allCode = await sandpackEditorRef.value.getCode()
        if (allCode && allCode !== currentCode.value) {
          console.log('Fallback: detected change via getCode()')
          handleCodeUpdate(allCode)
        }
      } catch (err2) {
        console.error('Fallback also failed:', err2)
      }
    }
  }
}

const loadRelics = async () => {
  try {
    const loadedRelics = await relicService.listRelics(effectiveNodeId.value)
    
    // Transform to local format
    relics.value = loadedRelics.map(r => ({
      ...r,
      status: 'passed' as const,
      lastModified: new Date(r.updated_at).getTime(),
      code: r.latest_version?.code || r.code || ''
    }))
  } catch (error) {
    console.error('Error loading relics:', error)
    // Fallback to localStorage
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
  const wasStreaming = isStreaming.value
  isStreaming.value = payloadIsStreaming
  currentNodeId.value = nodeId
  currentCodeIndex.value = codeIndex

  if (payloadIsStreaming) {
    // Clear any pending compilation during streaming
    if (compilationTimer.value) {
      clearTimeout(compilationTimer.value)
      compilationTimer.value = null
    }
    isCompiling.value = false
  } else {
    // Streaming just stopped, trigger debounced compilation
    if (wasStreaming) {
      isCompiling.value = true
      compilationTimer.value = window.setTimeout(() => {
        debouncedCode.value = code
        isCompiling.value = false
        compilationTimer.value = null
      }, 300)
    }
    
    lastSavedCode.value = code
    // Auto-save after loading to persist the state
    setTimeout(() => {
      saveFile()
    }, 100)
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
  loadRelics() // async but we don't need to await
  
  // Start periodic code checker for relics
  setInterval(checkCodeChanges, 1000)
})

onUnmounted(() => {
  if (themeObserver) {
    themeObserver.disconnect()
  }
  emitter.off('show-sandbox', handleShowSandbox)
  
  // Save any pending changes before unmounting
  if (hasEdits.value) {
    saveFile()
  }
  
  // Clear any pending auto-save timeout
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout)
  }
  
  // Clear any pending compilation timeout
  if (compilationTimer.value) {
    clearTimeout(compilationTimer.value)
  }
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
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  color: var(--bc);
  /* Dynamic shadow that adapts to theme */
  box-shadow: 8px 0 40px rgba(255, 255, 255, 0.08), 2px 0 20px rgba(0, 0, 0, 0.15);
}

/* Light theme shadows */
[data-theme="light"] .side-panel-container,
[data-theme="cupcake"] .side-panel-container,
[data-theme="bumblebee"] .side-panel-container,
[data-theme="emerald"] .side-panel-container,
[data-theme="corporate"] .side-panel-container,
[data-theme="garden"] .side-panel-container,
[data-theme="lofi"] .side-panel-container,
[data-theme="pastel"] .side-panel-container,
[data-theme="fantasy"] .side-panel-container,
[data-theme="wireframe"] .side-panel-container,
[data-theme="lemonade"] .side-panel-container,
[data-theme="business"] .side-panel-container {
  box-shadow: 8px 0 40px rgba(0, 0, 0, 0.12), 2px 0 20px rgba(0, 0, 0, 0.08);
}

/* Dark theme shadows */
[data-theme="dark"] .side-panel-container,
[data-theme="synthwave"] .side-panel-container,
[data-theme="retro"] .side-panel-container,
[data-theme="cyberpunk"] .side-panel-container,
[data-theme="valentine"] .side-panel-container,
[data-theme="halloween"] .side-panel-container,
[data-theme="forest"] .side-panel-container,
[data-theme="aqua"] .side-panel-container,
[data-theme="black"] .side-panel-container,
[data-theme="luxury"] .side-panel-container,
[data-theme="dracula"] .side-panel-container,
[data-theme="night"] .side-panel-container,
[data-theme="coffee"] .side-panel-container,
[data-theme="winter"] .side-panel-container {
  box-shadow: 8px 0 40px rgba(155, 179, 21, 0.08), 2px 0 20px rgba(255, 255, 255, 0.04);
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