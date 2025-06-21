<template>
  <div class="h-full flex flex-col side-panel-container" :class="'theme-' + currentTheme">
    <!-- Header with enhanced toolbar - Theme-aware styling -->
    <div class="flex justify-between items-center p-2 border-b panel-header" :style="headerStyle">
      <div class="flex items-center gap-4">
        <!-- View switcher -->
        <div class="flex items-center gap-2 border-r pr-4 mr-2 view-switcher" :style="dividerStyle">
          <button @click="currentView = 'editor'" class="btn btn-sm gap-2 view-btn"
            :class="currentView === 'editor' ? 'btn-primary' : 'btn-ghost'"
            :style="getViewButtonStyle(currentView === 'editor')" title="IDE">
            <Code class="w-4 h-4" />
            <span class="hidden sm:inline">IDE</span>
          </button>
          <button @click="switchToManager" class="btn btn-sm gap-2 view-btn"
            :class="currentView === 'manager' ? 'btn-primary' : 'btn-ghost'"
            :style="getViewButtonStyle(currentView === 'manager')" title="Relics">
            <LayoutGrid class="w-4 h-4" />
            <span class="hidden sm:inline">Relics</span>
          </button>
        </div>
        <!-- File controls (only visible in editor view) -->
        <div v-if="currentView === 'editor'" class="flex items-center gap-2">
          <button @click="createNewFile" class="btn btn-sm btn-ghost file-btn" :style="controlButtonStyle"
            title="New File">
            <FilePlus class="w-4 h-4" />
          </button>
          <button @click="openFile" class="btn btn-sm btn-ghost file-btn" :style="controlButtonStyle" title="Open File">
            <FolderOpen class="w-4 h-4" />
          </button>
          <button @click="saveFile" class="btn btn-sm gap-2 save-btn" :class="hasEdits ? 'btn-primary' : 'btn-ghost'"
            :style="getSaveButtonStyle(hasEdits)" :disabled="!hasEdits">
            <Save class="w-4 h-4" />
          </button>
        </div>

        <!-- File tabs with enhanced styling -->
        <div v-if="currentView === 'editor' && openFiles.length > 0"
          class="flex items-center gap-1 overflow-x-auto max-w-md file-tabs-container">
          <div v-for="file in openFiles" :key="file.id" @click="selectFile(file.id)"
            class="px-3 py-1 text-sm rounded-t-md cursor-pointer transition-colors flex items-center gap-1 file-tab"
            :class="currentFileId === file.id ? 'active-tab' : 'inactive-tab'"
            :style="getFileTabStyle(currentFileId === file.id)">
            <span class="truncate max-w-xs">{{ file.name }}</span>
            <button @click.stop="closeFile(file.id)" class="p-1 rounded-full close-tab-btn"
              :style="closeTabButtonStyle">
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Editor-specific controls with theme-aware styling -->
        <div v-if="currentView === 'editor'" class="flex items-center gap-2">
          <!-- <button @click="toggleInlineAssistant" class="btn btn-sm editor-control-btn"
            :class="isInlineAssistantActive ? 'btn-primary' : 'btn-ghost'"
            :style="getControlButtonStyle(isInlineAssistantActive)" title="AI Assist">
            <Sparkles class="w-4 h-4" />
          </button> -->
          <button @click="syncFromDom" class="btn btn-ghost btn-sm editor-control-btn" :style="controlButtonStyle">
            <span class="text-xs">Sync</span>
          </button>
          <button @click="debugEditorState" class="btn btn-ghost btn-sm editor-control-btn" :style="controlButtonStyle">
            <span class="text-xs">Debug</span>
          </button>
          <button @click="runCode" class="btn btn-sm btn-ghost editor-control-btn" :style="controlButtonStyle">
            <Play class="w-4 h-4" />
          </button>
          <button @click="sendErrors" class="btn btn-ghost btn-sm editor-control-btn" :style="controlButtonStyle">
            <Bug class="w-4 h-4" />
          </button>
          <button @click="copyToClipboard" class="btn btn-ghost btn-sm editor-control-btn" :style="controlButtonStyle">
            <Copy class="w-4 h-4" />
          </button>
        </div>

        <!-- Manager-specific controls with theme-aware styling -->
        <div v-if="currentView === 'manager'" class="flex items-center gap-2">
          <button @click="createNewRelic" class="btn btn-sm btn-primary gap-2 new-relic-btn" :style="actionButtonStyle">
            <Plus class="w-4 h-4" />
            <span class="hidden sm:inline">New Relic</span>
          </button>
          <div class="relative">
            <button @click="showFilterMenu = !showFilterMenu" class="btn btn-sm btn-ghost gap-2 filter-btn"
              :style="controlButtonStyle">
              <Filter class="w-4 h-4" />
              <span class="hidden sm:inline">Filter</span>
            </button>

            <!-- Filter dropdown menu with theme styling -->
            <div v-if="showFilterMenu"
              class="absolute right-0 top-full mt-1 rounded-md shadow-lg z-10 p-2 w-48 filter-menu"
              :style="filterMenuStyle">
              <div class="flex flex-col gap-2">
                <label class="flex items-center gap-2 cursor-pointer filter-option">
                  <input type="checkbox" v-model="filters.showPassed" class="checkbox checkbox-sm checkbox-success" />
                  <span class="filter-label"
                    :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }">Passed</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer filter-option">
                  <input type="checkbox" v-model="filters.showFailed" class="checkbox checkbox-sm checkbox-error" />
                  <span class="filter-label"
                    :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }">Failed</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer filter-option">
                  <input type="checkbox" v-model="filters.showFeedback" class="checkbox checkbox-sm checkbox-info" />
                  <span class="filter-label"
                    :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }">User Feedback</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <button @click="handleClose" class="btn btn-ghost btn-sm close-panel-btn" :style="controlButtonStyle">
          <XIcon class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Content Area - Full Height Container -->
    <div class="flex-1 flex flex-col overflow-hidden content-area" style="height: calc(100% - 48px);">
      <!-- Editor View -->
      <template v-if="currentView === 'editor'">
        <!-- Editing actions when working with code from a chat bubble -->
        <div v-if="currentNodeId && currentCodeIndex !== undefined && hasEdits"
          class="py-2 px-4 mb-4 editing-notification" :style="notificationStyle">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">You're editing code from a chat message</p>
              <p class="text-xs text-base-content/70">Your changes are saved but not synced back to the original message
              </p>
            </div>
            <div class="flex gap-2">
              <button @click="updateOriginalCode" class="btn btn-sm btn-warning gap-1 update-btn"
                :style="warningButtonStyle">
                <Save class="w-3 h-3" />
                Update Original
              </button>
              <button @click="saveAsNewRelic" class="btn btn-sm btn-primary gap-1 save-as-btn"
                :style="actionButtonStyle">
                <FilePlus class="w-3 h-3" />
                Save as Relic
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between px-4 py-2 language-bar" :style="languageBarStyle">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium language-indicator">Language: {{ currentLanguage }}</span>
            <Badge v-if="isStreaming" variant="secondary"
              :style="{ backgroundColor: themeColors.secondary + '30', color: themeColors.secondary }">Streaming</Badge>

            <!-- Relic Navigation (only visible when node is snapped) -->
            <div v-if="isNodeSnapped && filteredRelics.length > 1"
              class="ml-4 flex items-center gap-3 px-3 py-1 rounded-full relic-navigation"
              :style="relicNavigationStyle">
              <button @click="previousRelic" class="p-1 hover:bg-base-300/50 rounded-full transition-colors"
                :disabled="currentRelicIndex <= 0" :style="getNavigationButtonStyle(currentRelicIndex <= 0)">
                <ChevronLeft class="w-4 h-4" />
              </button>

              <span class="text-xs font-medium">
                {{ currentRelicIndex + 1 }} of {{ filteredRelics.length }}
              </span>

              <button @click="nextRelic" class="p-1 hover:bg-base-300/50 rounded-full transition-colors"
                :disabled="currentRelicIndex >= filteredRelics.length - 1"
                :style="getNavigationButtonStyle(currentRelicIndex >= filteredRelics.length - 1)">
                <ChevronRight class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div v-if="previewErrors" class="text-sm error-message" :style="errorMessageStyle">
            Error: {{ previewErrors }}
          </div>
        </div>

        <!-- This is our full height container -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <SandpackProvider :files="sandpackFiles" :template="getTemplate(currentLanguage)" :theme="editorTheme"
            :customSetup="sandpackSetup" :options="{
              autorun: !isStreaming,
              recompileMode: 'immediate',
              recompileDelay: 250
            }" class="h-full">

            <!-- Editor and Preview Container - fixed full height layout -->
            <div class="h-full flex flex-col">
              <!-- Editor container with explicit height calculation -->
              <div :style="{ height: `${splitPosition}%` }" class="relative min-h-0 editor-container rounded-xl">
                <SandpackCodeEditor ref="sandpackEditorRef" @code-update="handleCodeUpdate" showLineNumbers
                  :readOnly="isStreaming" class="h-full w-full" style="resize: none" wrapContent closableTabs :options="{
                    autoSave: true,
                    autoComplete: true,
                    formatOnSave: true
                  }" />


                <!-- Inline AI Assistant Prompt with theme styling -->
                <div v-if="showInlinePrompt"
                  class="absolute bottom-4 left-4 right-4 p-3 rounded-md shadow-lg z-10 inline-prompt"
                  :style="inlinePromptStyle">
                  <div class="flex items-center gap-2">
                    <Sparkles class="w-4 h-4" :style="{ color: themeColors.primary }" />
                    <input ref="inlinePromptRef" v-model="inlinePromptText" @keydown.stop
                      class="flex-1 bg-transparent border-none outline-none prompt-input" :style="promptInputStyle"
                      placeholder="Ask AI to help with your code..." @keydown.enter="submitInlinePrompt"
                      @keydown.esc="cancelInlinePrompt" />
                  </div>
                  <div class="flex justify-end mt-2 gap-2">
                    <button @click="cancelInlinePrompt" class="btn btn-sm btn-ghost cancel-btn"
                      :style="controlButtonStyle">Cancel</button>
                    <button @click="submitInlinePrompt" class="btn btn-sm btn-primary send-btn"
                      :style="actionButtonStyle">Send</button>
                  </div>
                </div>
              </div>

              <!-- Resize handle with theme styling -->
              <div class="h-2 cursor-row-resize flex items-center justify-center group transition-colors resize-handle"
                :style="resizeHandleStyle" @mousedown="startResize">
                <div class="w-8 h-1 rounded group-hover:bg-base-content/40 transition-colors resize-handle-bar"
                  :style="resizeHandleBarStyle"></div>
              </div>

              <!-- Preview container with explicit height calculation -->
              <div :style="{ height: `calc(${100 - splitPosition - 1}%)` }"
                class="min-h-0 preview-container rounded-br-md flex flex-col">

                <!-- UPDATED: Using PreviewContainer instead of separate components -->
                <PreviewContainer :current-index="currentRelicIndex" :total-relics="filteredRelics.length"
                  :show-navigation="isNodeSnapped && filteredRelics.length > 1" @previous="previousRelic"
                  @next="nextRelic" @refresh="refreshPreview">

                  <SandpackPreview ref="previewRef" class="flex-1 w-full" :options="{
                    showNavigator: false,
                    showRefreshButton: false,
                    showSyntaxError: true,
                  }" @message="handleSandpackMessage" />
                </PreviewContainer>
              </div>
            </div>
          </SandpackProvider>
        </div>
      </template>

      <!-- Manager View with theme enhancements -->
      <template v-if="currentView === 'manager'">
        <div class="flex-1 p-4 overflow-auto manager-view" :style="managerViewStyle">
          <!-- Search and sort controls with theme styling -->
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

          <!-- Relics grid with theme-aware cards -->
          <div v-if="filteredRelics.length > 0"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relics-grid">
            <div v-for="(relic, index) in filteredRelics" :key="relic.id" @click="openRelic(relic)"
              class="relic-card overflow-hidden cursor-pointer hover:shadow-md transition-all" :class="{
                'status-passed': relic.status === 'passed',
                'status-failed': relic.status === 'failed',
                'status-feedback': relic.status === 'feedback'
              }" :style="getRelicCardStyle(relic.status, index)">
              <!-- Relic preview (thumbnail) with theme styling -->
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

                <!-- Status badge with theme-specific styling -->
                <div class="absolute top-2 right-2 px-2 py-1 rounded-full text-xs text-white status-badge"
                  :style="getStatusBadgeStyle(relic.status)">
                  {{ relic.status === 'passed' ? 'Passed' : relic.status === 'failed' ? 'Failed' : 'Feedback' }}
                </div>
              </div>

              <!-- Relic info with theme styling -->
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

          <!-- Empty state with theme styling -->
          <div v-else class="flex flex-col items-center justify-center h-64 empty-state"
            :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }">
            <Box class="w-16 h-16 mb-4" />
            <h3 class="text-lg font-medium mb-2">No relics found</h3>
            <p class="text-sm mb-4">
              {{ searchQuery ? 'Try a different search term or clear filters' : 'Create your first relic to get started'
              }}
            </p>
            <button @click="createNewRelic" class="btn btn-primary gap-2 create-relic-btn" :style="actionButtonStyle">
              <Plus class="w-4 h-4" />
              Create New Relic
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Modals with theme-aware styling -->

    <!-- Diff View Modal -->
    <DiffViewModal v-if="showDiffModal" :codeSnippets="codeSnippets" @close="showDiffModal = false" />

    <!-- File Explorer Modal -->
    <dialog ref="fileExplorerDialog" class="modal">
      <div class="modal-box" :style="modalStyle">
        <h3 class="font-bold text-lg modal-title" :style="modalTitleStyle">Open File</h3>
        <div class="py-4">
          <div class="mb-2 p-2 rounded-md file-list" :style="fileListStyle" v-if="savedFiles.length > 0">
            <div v-for="file in savedFiles" :key="file.id" @click="loadSavedFile(file)"
              class="p-2 rounded cursor-pointer flex items-center justify-between file-item" :style="fileItemStyle">
              <div class="flex items-center gap-2">
                <FileCode class="w-4 h-4" />
                <span class="file-name" :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)' }">{{
                  file.name }}</span>
              </div>
              <span class="text-xs opacity-60 file-date">{{ formatDate(file.lastModified) }}</span>
            </div>
          </div>
          <div v-else class="text-center p-4 empty-files"
            :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }">
            No saved files found
          </div>
        </div>
        <div class="modal-action">
          <button class="btn" @click="closeFileExplorer" :style="modalCloseButtonStyle">Cancel</button>
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
            </select>
          </div>

          <div class="mb-4">
            <label class="label"
              :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }">Template</label>
            <select v-model="newRelic.template" class="select select-bordered w-full" :style="selectStyle">
              <option value="empty">Empty</option>
              <option value="basic">Basic Component</option>
              <option value="stateful">Stateful Component</option>
              <option value="tailwind">Tailwind Component</option>
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
        <h3 class="font-bold text-lg modal-title" :style="modalTitleStyle">Delete Relic</h3>
        <p class="py-4" :style="{ color: isDarkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }">
          Are you sure you want to delete "{{ relicToDelete?.name }}"? This action cannot be undone.
        </p>
        <div class="modal-action">
          <button @click="closeDeleteConfirmDialog" class="btn btn-ghost" :style="modalCloseButtonStyle">Cancel</button>
          <button @click="confirmDeleteRelic" class="btn btn-error" :style="errorButtonStyle">Delete</button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  XIcon, Copy, ChevronLeft, ChevronRight, Save,
  GitCompare, Bug, FilePlus, FolderOpen, Box,
  FileCode, Play, Sparkles, X, Code, LayoutGrid,
  Plus, Download, Filter, Search, Layers, Trash
} from 'lucide-vue-next'
import { getTemplateCode } from '@/utils/relicTemplates';
import { SandpackProvider, SandpackPreview, SandpackCodeEditor } from 'sandpack-vue3'
import type { SandpackFiles, SandpackMessage } from '@codesandbox/sandpack-react'
import { sandpackSetup } from './sandpackDeps'
import PreviewContainer from './SandPackPreviewContainer.vue';
import Badge from '../ui/Badge.vue'
import emitter from '@/utils/eventBus'
import { useThemeStore } from '@/stores/themeStore'
import DiffViewModal from './DiffViewModal.vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from "@/stores/chatStore";
import { storeToRefs } from 'pinia';

interface Props {
  nodeId: string;
}

interface CodeSnippet {
  code: string;
  language: string;
  isStreaming: boolean;
  timestamp: number;
  codeIndex: number;
}

interface CodeFile {
  id: string;
  name: string;
  language: string;
  code: string;
  lastModified: number;
}

interface Relic {
  id: string;
  name: string;
  description: string;
  language: string;
  code: string;
  dependencies: Record<string, string>;
  status: 'passed' | 'failed' | 'feedback';
  lastModified: number;
  thumbnailUrl?: string;
  sourceInfo?: {
    chatId: string;
    nodeId: string;
    messageIndex: number;
    codeIndex: number;
  };
}

interface NewRelicData {
  name: string;
  description: string;
  language: string;
  template: string;
}

interface EditedCodeVersion {
  originalCode: string;
  editedCode: string;
  language: string;
  timestamp: number;
  nodeId: string;
  codeIndex: number;
  isEdited: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  nodeId: ''
});

const effectiveNodeId = computed(() =>
  currentNodeId.value            // from prop
  || snappedNodeId.value         // full‑screen thread
  || activeNode.value            // last clicked card
  || canvasStore.nodes[0]?.id    // root of current workspace
);

const emit = defineEmits(['panel-opened', 'panel-closed'])
const themeStore = useThemeStore()
const canvasStore = useCanvasStore()
const appStore = useAppStore();

const { snappedNodeId, activeNode } = storeToRefs(canvasStore);

// Theme-related state
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');
let themeObserver: MutationObserver | null = null;

// Check if current theme is dark
const isDarkTheme = computed(() => {
  return themeStore.isDarkTheme(currentTheme.value);
});

// Get theme colors from the store
const themeColors = computed(() => {
  return themeStore.getThemeColors(currentTheme.value);
});

const currentNodeId = ref<string>(props.nodeId);
const editedCodeVersions = ref<Map<string, EditedCodeVersion>>(new Map());

// View Management
const currentView = ref<'editor' | 'manager'>('editor');

const currentRelicIndex = ref(0);
const isNodeSnapped = computed(() => !!canvasStore.snappedNodeId);

const sandpackEditorRef = ref(null);

// 2. Define the auto-save timeout ref
const autoSaveTimeout = ref(null);

const sandpackFiles = computed(() => getFiles(currentCode.value));

// Editor State
const currentCode = ref('// Start coding here\n\nconst MyComponent = () => {\n  return (\n    <div>\n      <h1>Hello World</h1>\n    </div>\n  );\n};\n\nexport default MyComponent;')
const currentLanguage = ref('react')
const isStreaming = ref(false)
const currentCodeIndex = ref<number | undefined>(undefined);
const sourceRelics = ref<Map<string, Relic>>(new Map());
const currentOriginalCode = ref('');
const codeSnippets = ref<CodeSnippet[]>([])
const currentSnippetIndex = ref(-1)
const splitPosition = ref(50) // Default 50/50 split
const showDiffModal = ref(false)
const previewRef = ref<null | { getBundlerError: () => string }>(null)
const previewErrors = ref('')
const lastSavedCode = ref('')
const hasEdits = ref(false)
const showDiffView = ref(false)
const originalCodeBeforeAssist = ref('')
const suggestedCode = ref('')
const isDiffMode = ref(false)
const showAcceptDiscard = ref(false)

// File management
const openFiles = ref<CodeFile[]>([])
const currentFileId = ref<string | null>(null)
const savedFiles = ref<CodeFile[]>([])
const fileExplorerDialog = ref<HTMLDialogElement | null>(null)

// Inline AI assistance
const isInlineAssistantActive = ref(false)
const showInlinePrompt = ref(false)
const inlinePromptText = ref('')
const inlinePromptRef = ref<HTMLInputElement | null>(null)

// Manager state
const relics = ref<Relic[]>([])
const searchQuery = ref('')
const sortBy = ref<'name' | 'date' | 'status'>('date')
const filters = ref({
  showPassed: true,
  showFailed: true,
  showFeedback: true
})
const showFilterMenu = ref(false)
const newRelicDialog = ref<HTMLDialogElement | null>(null)
const deleteConfirmDialog = ref<HTMLDialogElement | null>(null)
const relicToDelete = ref<Relic | null>(null)
const newRelic = ref<NewRelicData>({
  name: '',
  description: '',
  language: 'react',
  template: 'basic'
})

// Theme-based styling
const headerStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 35, 0.95)' : 'rgba(250, 250, 255, 0.95)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(230, 230, 240, 0.5)',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px'
  };
});

const dividerStyle = computed(() => {
  return {
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(230, 230, 240, 0.5)'
  };
});

const getViewButtonStyle = (isActive: boolean) => {
  if (isActive) {
    return {
      backgroundColor: isDarkTheme.value ? adjustColorOpacity(themeColors.value.primary, 0.2) : adjustColorOpacity(themeColors.value.primary, 0.1),
      color: themeColors.value.primary,
      borderColor: adjustColorOpacity(themeColors.value.primary, 0.3)
    };
  }
  return controlButtonStyle.value;
};

const controlButtonStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.4)' : 'rgba(245, 245, 250, 0.6)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.2)' : 'rgba(230, 230, 240, 0.4)',
    '&:hover': {
      backgroundColor: isDarkTheme.value ? 'rgba(50, 50, 60, 0.6)' : 'rgba(235, 235, 240, 0.8)'
    }
  };
});

const getControlButtonStyle = (isActive: boolean) => {
  if (isActive) {
    return {
      backgroundColor: isDarkTheme.value ? adjustColorOpacity(themeColors.value.primary, 0.2) : adjustColorOpacity(themeColors.value.primary, 0.1),
      color: themeColors.value.primary,
      borderColor: adjustColorOpacity(themeColors.value.primary, 0.3)
    };
  }
  return controlButtonStyle.value;
};

const actionButtonStyle = computed(() => {
  const primaryColor = themeColors.value.primary;

  return {
    backgroundColor: isDarkTheme.value
      ? adjustColorOpacity(primaryColor, 0.2)
      : adjustColorOpacity(primaryColor, 0.1),
    color: themeColors.value.primary,
    borderColor: adjustColorOpacity(primaryColor, 0.3),
    '&:hover': {
      backgroundColor: isDarkTheme.value
        ? adjustColorOpacity(primaryColor, 0.3)
        : adjustColorOpacity(primaryColor, 0.15),
    }
  };
});

const getSaveButtonStyle = (isEnabled: boolean) => {
  if (isEnabled) {
    return actionButtonStyle.value;
  }
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.3)' : 'rgba(245, 245, 250, 0.5)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.2)' : 'rgba(230, 230, 240, 0.3)'
  };
};

const warningButtonStyle = computed(() => {
  const warningColor = getComputedStyle(document.documentElement).getPropertyValue('--wa') || '#FFCC00';

  return {
    backgroundColor: isDarkTheme.value
      ? adjustColorOpacity(warningColor, 0.2)
      : adjustColorOpacity(warningColor, 0.1),
    color: warningColor,
    borderColor: adjustColorOpacity(warningColor, 0.3),
    '&:hover': {
      backgroundColor: isDarkTheme.value
        ? adjustColorOpacity(warningColor, 0.3)
        : adjustColorOpacity(warningColor, 0.15),
    }
  };
});

const errorButtonStyle = computed(() => {
  const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--er') || '#FF3333';

  return {
    backgroundColor: isDarkTheme.value
      ? adjustColorOpacity(errorColor, 0.2)
      : adjustColorOpacity(errorColor, 0.1),
    color: errorColor,
    borderColor: adjustColorOpacity(errorColor, 0.3),
    '&:hover': {
      backgroundColor: isDarkTheme.value
        ? adjustColorOpacity(errorColor, 0.3)
        : adjustColorOpacity(errorColor, 0.15),
    }
  };
});

const getFileTabStyle = (isActive: boolean) => {
  if (isActive) {
    return {
      backgroundColor: isDarkTheme.value ? 'rgba(60, 60, 70, 0.95)' : 'rgba(230, 230, 240, 0.95)',
      color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
      borderColor: themeColors.value.primary,
      borderTopWidth: '2px',
      borderTopStyle: 'solid'
    };
  }

  return {
    backgroundColor: isDarkTheme.value ? 'rgba(50, 50, 60, 0.6)' : 'rgba(240, 240, 250, 0.6)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
    '&:hover': {
      backgroundColor: isDarkTheme.value ? 'rgba(55, 55, 65, 0.8)' : 'rgba(235, 235, 245, 0.8)'
    }
  };
};

const closeTabButtonStyle = computed(() => {
  return {
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
    '&:hover': {
      backgroundColor: isDarkTheme.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
    }
  };
});

const notificationStyle = computed(() => {
  const warningColor = getComputedStyle(document.documentElement).getPropertyValue('--wa') || '#FFCC00';

  return {
    backgroundColor: isDarkTheme.value
      ? adjustColorOpacity(warningColor, 0.05)
      : adjustColorOpacity(warningColor, 0.05),
    borderColor: adjustColorOpacity(warningColor, 0.3),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '0.375rem'
  };
});

const languageBarStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.8)' : 'rgba(240, 240, 250, 0.8)'
  };
});

const errorMessageStyle = computed(() => {
  const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--er') || '#FF3333';
  return {
    color: errorColor
  };
});

const resizeHandleStyle = computed(() => {
  return {
    backgroundColor: 'transparent', // Make the background transparent
    marginRight: '8px',
    marginLeft: '8px',
    radiusBorder: '16px',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: isDarkTheme.value
        ? adjustColorOpacity(themeColors.value.primary, 0.1)
        : adjustColorOpacity(themeColors.value.primary, 0.05)
    }
  };
});
const resizeHandleBarStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value
      ? adjustColorOpacity(themeColors.value.primary, 0.6)  // More vibrant in dark mode
      : adjustColorOpacity(themeColors.value.primary, 0.4), // Slightly more subtle in light mode
    transition: 'background-color 0.2s ease, width 0.2s ease',
    height: '2px', // Make it slightly thicker for better visibility
  };
});

const inlinePromptStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    borderColor: themeColors.value.primary,
    borderWidth: '3px',
    borderStyle: 'solid'
  };
});

const promptInputStyle = computed(() => {
  return {
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    '::placeholder': {
      color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'
    }
  };
});

const managerViewStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(28, 28, 35, 0.8)' : 'rgba(250, 250, 255, 0.8)'
  };
});

const searchInputStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.7)' : 'rgba(255, 255, 255, 0.95)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)'
  };
});

const selectStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.7)' : 'rgba(255, 255, 255, 0.95)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)'
  };
});

const filterMenuStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(35, 35, 45, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)',
    borderWidth: '1px',
    borderStyle: 'solid',
    boxShadow: isDarkTheme.value
      ? '0 8px 16px rgba(0, 0, 0, 0.3)'
      : '0 8px 16px rgba(0, 0, 0, 0.1)'
  };
});

const getRelicCardStyle = (status: string, index: number) => {
  let borderColor;
  let borderLeftStyle = {};

  // Set color based on status
  if (status === 'passed') {
    const successColor = getComputedStyle(document.documentElement).getPropertyValue('--su') || '#36D399';
    borderColor = successColor;
  } else if (status === 'failed') {
    const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--er') || '#FF3333';
    borderColor = errorColor;
  } else {
    const infoColor = getComputedStyle(document.documentElement).getPropertyValue('--in') || '#3ABFF8';
    borderColor = infoColor;
  }

  // Apply left border styling
  borderLeftStyle = {
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    borderLeftColor: borderColor
  };

  return {
    backgroundColor: isDarkTheme.value ? 'rgba(35, 35, 45, 0.9)' : 'rgba(255, 255, 255, 0.95)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    boxShadow: isDarkTheme.value
      ? '0 4px 8px rgba(0, 0, 0, 0.2)'
      : '0 4px 8px rgba(0, 0, 0, 0.05)',
    '--index': index,
    ...borderLeftStyle,
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: isDarkTheme.value
        ? '0 10px 20px rgba(0, 0, 0, 0.3)'
        : '0 10px 20px rgba(0, 0, 0, 0.1)'
    }
  };
};

const relicPreviewStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 40, 0.8)' : 'rgba(245, 245, 250, 0.8)',
    borderBottom: isDarkTheme.value
      ? '1px solid rgba(80, 80, 90, 0.3)'
      : '1px solid rgba(220, 220, 230, 0.5)'
  };
});



const getStatusBadgeStyle = (status: string) => {
  let backgroundColor;

  if (status === 'passed') {
    const successColor = getComputedStyle(document.documentElement).getPropertyValue('--su') || '#36D399';
    backgroundColor = successColor;
  } else if (status === 'failed') {
    const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--er') || '#FF3333';
    backgroundColor = errorColor;
  } else {
    const infoColor = getComputedStyle(document.documentElement).getPropertyValue('--in') || '#3ABFF8';
    backgroundColor = infoColor;
  }

  return {
    backgroundColor: backgroundColor,
    boxShadow: isDarkTheme.value
      ? '0 2px 4px rgba(0, 0, 0, 0.3)'
      : '0 2px 4px rgba(0, 0, 0, 0.1)'
  };
};

const relicInfoStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(32, 32, 40, 0.95)' : 'rgba(252, 252, 255, 0.95)'
  };
});

const relicActionButtonStyle = computed(() => {
  return {
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
    '&:hover': {
      backgroundColor: isDarkTheme.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
    }
  };
});

const modalStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(32, 32, 40, 0.98)' : 'rgba(255, 255, 255, 0.98)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)',
    borderWidth: '1px',
    borderStyle: 'solid',
    boxShadow: isDarkTheme.value
      ? '0 25px 50px rgba(0, 0, 0, 0.5)'
      : '0 25px 50px rgba(0, 0, 0, 0.15)'
  };
});

const modalTitleStyle = computed(() => {
  return {
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.95)'
  };
});

const modalCloseButtonStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(60, 60, 70, 0.6)' : 'rgba(240, 240, 245, 0.6)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)'
  };
});

const fileListStyle = computed(() => {
  return {
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)',
    borderWidth: '1px',
    borderStyle: 'solid'
  };
});

const fileItemStyle = computed(() => {
  return {
    '&:hover': {
      backgroundColor: isDarkTheme.value ? 'rgba(50, 50, 60, 0.5)' : 'rgba(240, 240, 250, 0.5)'
    }
  };
});

const inputStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.7)' : 'rgba(250, 250, 255, 0.95)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)'
  };
});

const textareaStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.7)' : 'rgba(250, 250, 255, 0.95)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(220, 220, 230, 0.5)'
  };
});

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


const relicNavigationStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value
      ? 'rgba(50, 50, 60, 0.7)'
      : 'rgba(240, 240, 250, 0.7)',
    borderColor: isDarkTheme.value
      ? 'rgba(80, 80, 90, 0.3)'
      : 'rgba(220, 220, 230, 0.5)',
    borderWidth: '1px',
    borderStyle: 'solid'
  };
});

const getNavigationButtonStyle = (isDisabled: boolean) => {
  if (isDisabled) {
    return {
      opacity: 0.5,
      cursor: 'not-allowed',
      color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'
    };
  }

  return {
    color: themeColors.value.primary,
    cursor: 'pointer'
  };
};

// Navigation methods
const nextRelic = () => {
  if (currentRelicIndex.value < filteredRelics.value.length - 1) {
    currentRelicIndex.value++;
    loadRelicAtIndex(currentRelicIndex.value);
  }
};

const previousRelic = () => {
  if (currentRelicIndex.value > 0) {
    currentRelicIndex.value--;
    loadRelicAtIndex(currentRelicIndex.value);
  }
};

const loadRelicAtIndex = (index: number) => {
  const relic = filteredRelics.value[index];
  if (!relic) return;

  // Update current code snippet index
  const snippetIndex = codeSnippets.value.findIndex(
    s => s.nodeId === relic.nodeId && s.codeIndex === relic.codeIndex
  );

  if (snippetIndex !== -1) {
    currentSnippetIndex.value = snippetIndex;
    const snippet = codeSnippets.value[snippetIndex];

    // Update editor content
    currentCode.value = snippet.code;
    currentLanguage.value = snippet.language;
    isStreaming.value = snippet.isStreaming;
    hasEdits.value = currentCode.value !== lastSavedCode.value;
    currentCodeIndex.value = snippet.codeIndex;

    // Update edited status if needed
    const editedVersion = loadEditedCode(relic.nodeId, relic.codeIndex);
    if (editedVersion) {
      currentOriginalCode.value = editedVersion.originalCode;
    } else {
      currentOriginalCode.value = snippet.code;
    }

    // Run code preview after a short delay
    setTimeout(() => {
      runCode();
    }, 300);
  }
};

const filteredRelics = computed(() => {
  if (!currentNodeId.value && !canvasStore.snappedNodeId) {
    // No workspace open - use all relics as fallback
    return Object.values(codeSnippets.value)
      .sort((a, b) => a.codeIndex - b.codeIndex);
  }

  // Get the effective node ID from either current or snapped node
  const activeNodeId = currentNodeId.value || canvasStore.snappedNodeId;

  // Only show relics from the current workspace/node
  return Object.values(codeSnippets.value)
    .filter(snippet => snippet.nodeId === activeNodeId)
    .sort((a, b) => a.codeIndex - b.codeIndex);
});

// Utility function to adjust color opacity
function adjustColorOpacity(hexColor: string, opacity: number): string {
  // Convert hex to rgb
  let r, g, b;

  // Check if it's a valid hex color
  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hexColor)) {
    // Return a fallback if not a valid hex
    return `rgba(128, 128, 128, ${opacity})`;
  }

  // Convert short hex to full form
  const hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Update theme from DOM
const updateThemeFromDOM = () => {
  const newTheme = document.documentElement.getAttribute('data-theme') || 'light';
  if (newTheme !== currentTheme.value) {
    currentTheme.value = newTheme;
    console.log('SidePanel: Theme changed to', currentTheme.value);
  }
};

const getFiles = (code: string): SandpackFiles => {
  const mainFile = { code, active: true };
  if (['javascript', 'react'].includes(currentLanguage.value)) {
    return {
      '/App.js': mainFile,
      '/index.js': {
        code: `
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import './styles.css';

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
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
    };
  }
  return { '/App.js': mainFile };
};

const getTemplate = (language: string) => language.includes('vue') ? 'vue' : 'react'

const startResize = (e: MouseEvent) => {
  e.preventDefault()

  // Get container dimensions
  const container = document.querySelector('.h-full.flex.flex-col') as HTMLElement;
  if (!container) return;

  const containerHeight = container.offsetHeight;
  const startY = e.clientY;
  const startHeight = splitPosition.value;

  const onMouseMove = (e: MouseEvent) => {
    // Calculate percentage based on mouse movement
    const deltaY = e.clientY - startY;
    const deltaPercent = (deltaY / containerHeight) * 100;
    const newSplitPosition = Math.min(Math.max(20, startHeight + deltaPercent), 80);

    splitPosition.value = newSplitPosition;
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

const handleClose = () => {
  emit('panel-closed')
}


const saveEditedCode = (nodeId: string, codeIndex: number, originalCode: string, editedCode: string, language: string) => {
  const key = `${nodeId}-${codeIndex}`;
  const isEdited = originalCode !== editedCode;

  const versionData: EditedCodeVersion = {
    originalCode,
    editedCode,
    language,
    timestamp: Date.now(),
    nodeId,
    codeIndex,
    isEdited
  };

  // Update our in-memory store
  editedCodeVersions.value.set(key, versionData);

  // Save to localStorage to persist across page navigations
  localStorage.setItem(`edited-code-${key}`, JSON.stringify(versionData));

  // Update code bubble display state through an event
  emitter.emit('code-edit-status-changed', {
    nodeId,
    codeIndex,
    isEdited
  });

  return isEdited;
};


const loadEditedCode = (nodeId: string, codeIndex: number): EditedCodeVersion | null => {
  const key = `${nodeId}-${codeIndex}`;

  // First check our in-memory store
  if (editedCodeVersions.value.has(key)) {
    return editedCodeVersions.value.get(key) || null;
  }

  // Then check localStorage
  const savedVersion = localStorage.getItem(`edited-code-${key}`);
  if (savedVersion) {
    try {
      const parsedVersion: EditedCodeVersion = JSON.parse(savedVersion);
      editedCodeVersions.value.set(key, parsedVersion);
      return parsedVersion;
    } catch (e) {
      console.error('Error parsing saved edited code:', e);
      return null;
    }
  }

  return null;
};

const refreshPreview = () => {
  if (previewRef.value) {
    const iframe = previewRef.value.$el.querySelector('iframe');
    if (iframe) {
      iframe.src = iframe.src;
    }
  }
};

const copyToClipboard = async () => {
  console.log("[DEBUG] copyToClipboard called");

  // Try DOM sync first
  const syncedFromDOM = syncFromDOM();

  if (!syncedFromDOM) {
    // Fall back to original method if DOM sync failed
    if (sandpackEditorRef.value && sandpackEditorRef.value.getCode) {
      try {
        const latestCode = await sandpackEditorRef.value.getCode();
        currentCode.value = latestCode || currentCode.value;
      } catch (err) {
        console.error("Error getting code:", err);
      }
    }
  }

  if (currentCode.value) {
    try {
      await navigator.clipboard.writeText(currentCode.value);
      console.log("Code copied to clipboard");
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  }
};

const syncFromDOM = () => {
  // Get the CodeMirror instance through the DOM
  const cmEditor = document.querySelector('.cm-editor');

  if (cmEditor) {
    const content = cmEditor.querySelector('.cm-content');
    if (content) {
      // Extract text from the editor content
      const code = Array.from(content.querySelectorAll('.cm-line'))
        .map(line => line.textContent)
        .join('\n');

      // Update current code
      currentCode.value = code;
      console.log("Synced from DOM:", code.substring(0, 40) + "...");
      return true;
    }
  }

  console.log("Could not extract code from DOM");
  return false;
};
// -----------------------------------------------------------------------------
// Show a (possibly‑streaming) code snippet in the side‑panel editor
// -----------------------------------------------------------------------------
const handleShowSandbox = (payload: {
  code: string
  language: string
  isStreaming: boolean
  partial?: boolean
  nodeId?: string
  codeIndex?: number
  chatId?: string
}) => {
  const {
    code,
    language,
    isStreaming,
    partial = false,
    nodeId = 'adhoc',
    codeIndex = 0,
  } = payload

  if (!code) return                                    // nothing to do

  const isCurrentlyOpen =
    currentNodeId.value === nodeId &&
    currentCodeIndex.value === codeIndex

  // did we used to be streaming but just finished?
  const wasStreaming =
    currentSnippetIndex.value !== -1 &&
    codeSnippets.value[currentSnippetIndex.value]?.isStreaming

  // ---------------------------------------------------------------------------
  // Slot management – keep ONE slot per   (nodeId, codeIndex)
  // ---------------------------------------------------------------------------
  const ensureSlotFor = (nid: string, idx: number): number => {
    const existing = codeSnippets.value.findIndex(
      s => s.nodeId === nid && s.codeIndex === idx
    )
    if (existing !== -1) return existing

    // new slot – push a blank placeholder; we’ll fill it in right after
    codeSnippets.value.push({} as any)
    return codeSnippets.value.length - 1
  }

  // first chunk of a stream → pick/create the slot & overwrite it completely
  // partial chunk            → just patch the existing slot’s `code` + flags
  if (!partial) {
    currentSnippetIndex.value = ensureSlotFor(nodeId, codeIndex)

    codeSnippets.value[currentSnippetIndex.value] = {
      code,
      language,
      isStreaming,
      timestamp: Date.now(),
      codeIndex,
      nodeId,
    }
  } else if (currentSnippetIndex.value !== -1) {
    Object.assign(codeSnippets.value[currentSnippetIndex.value], {
      code,
      isStreaming,
      timestamp: Date.now(),
    })
  }

  // ---------------------------------------------------------------------------
  // Sync the editor if this snippet is (now) the one being viewed
  // ---------------------------------------------------------------------------
  if (isCurrentlyOpen || currentSnippetIndex.value !== -1) {
    const active = codeSnippets.value[currentSnippetIndex.value]
    currentCode.value = active.code
    currentLanguage.value = active.language
    isStreaming.value = active.isStreaming
    currentCodeIndex.value = active.codeIndex
    currentNodeId.value = active.nodeId
    hasEdits.value = currentCode.value !== lastSavedCode.value
  }

  // ---------------------------------------------------------------------------
  // Persist finished streams so “Save” reflects the final state
  // ---------------------------------------------------------------------------
  if (wasStreaming && !isStreaming) {
    lastSavedCode.value = currentCode.value
    emitter.emit('streaming-complete', { nodeId, codeIndex })
  } else if (!isStreaming) {
    lastSavedCode.value = currentCode.value
  }
}


const nextSnippet = () => {
  if (currentSnippetIndex.value < codeSnippets.value.length - 1) {
    currentSnippetIndex.value++
    const snippet = codeSnippets.value[currentSnippetIndex.value]
    currentCode.value = snippet.code
    currentLanguage.value = snippet.language
    isStreaming.value = snippet.isStreaming
    hasEdits.value = currentCode.value !== lastSavedCode.value
  }
}

const previousSnippet = () => {
  if (currentSnippetIndex.value > 0) {
    currentSnippetIndex.value--
    const snippet = codeSnippets.value[currentSnippetIndex.value]
    currentCode.value = snippet.code
    currentLanguage.value = snippet.language
    isStreaming.value = snippet.isStreaming
    hasEdits.value = currentCode.value !== lastSavedCode.value
  }
}

const openDiffView = () => {
  showDiffModal.value = true
}

const handleCodeUpdate = (newCode) => {
  console.log("[DEBUG] handleCodeUpdate called");
  console.log("[DEBUG] Old currentCode:", currentCode.value.substring(0, 40) + "...");
  console.log("[DEBUG] New code:", newCode.substring(0, 40) + "...");
  currentCode.value = newCode;
  hasEdits.value = currentCode.value !== lastSavedCode.value;
  console.log("[DEBUG] Updated currentCode, hasEdits:", hasEdits.value);

  // Auto-save after a delay
  if (autoSaveTimeout.value) {
    clearTimeout(autoSaveTimeout.value);
  }

  autoSaveTimeout.value = window.setTimeout(() => {
    saveCurrentCode();
    autoSaveTimeout.value = null;
  }, 1000);
};

const debugEditorState = async () => {
  console.log("==== EDITOR STATE DEBUG ====");
  console.log("currentCode value:", currentCode.value.substring(0, 40) + "...");
  console.log("Editor ref exists:", !!sandpackEditorRef.value);

  if (sandpackEditorRef.value && sandpackEditorRef.value.getCode) {
    try {
      const editorCode = await sandpackEditorRef.value.getCode();
      console.log("Actual editor content:", editorCode.substring(0, 40) + "...");
      console.log("Values match:", editorCode === currentCode.value);
    } catch (err) {
      console.log("Error getting editor code:", err);
    }
  }
  console.log("===========================");
};

const saveAsNewRelic = () => {
  if (!currentNodeId.value || currentCodeIndex.value === undefined) {
    console.error("No active code snippet to save as relic");
    return;
  }

  // Create a new relic from the current code
  const newRelicId = `relic-${Date.now()}`;
  const newRelic: Relic = {
    id: newRelicId,
    name: `Relic from ${currentNodeId.value} - ${formatDate(Date.now())}`,
    description: `Created from code snippet ${currentCodeIndex.value} in node ${currentNodeId.value}`,
    language: currentLanguage.value,
    code: currentCode.value,
    dependencies: {},
    status: previewErrors.value ? 'failed' : 'passed',
    lastModified: Date.now()
  };

  // Add to relics list
  relics.value.push(newRelic);

  // Save to local storage
  saveRelicsToLocalStorage();

  // Update the current file ID to point to the new relic
  currentFileId.value = newRelicId;
  lastSavedCode.value = currentCode.value;
  hasEdits.value = false;

  // Show confirmation
  alert(`Saved as new relic: ${newRelic.name}`);
};

const saveCurrentCode = () => {
  if (!hasEdits.value) return;

  // If we're editing a code snippet from a node
  if (currentSnippetIndex.value !== -1 && currentNodeId.value) {
    const node = canvasStore.nodes.find(n => n.id === currentNodeId.value);
    if (!node) {
      console.warn("Current node not found. Cannot save code.");
      return;
    }

    const currentSnippet = codeSnippets.value[currentSnippetIndex.value];
    const messageIndex = node.messages.findIndex(
      msg => msg.contentParts?.some(part => part.codeIndex === currentSnippet.codeIndex)
    );

    if (messageIndex !== -1) {
      const updatedMessages = [...node.messages];
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        contentParts: updatedMessages[messageIndex].contentParts.map(part => {
          if (part.type === 'code' && part.codeIndex === currentSnippet.codeIndex) {
            return { ...part, content: currentCode.value };
          }
          return part;
        })
      };

      codeSnippets.value[currentSnippetIndex.value] = {
        ...currentSnippet,
        code: currentCode.value,
        isStreaming: false,
        timestamp: Date.now(),
      };

      canvasStore.updateNode(currentNodeId.value, {
        messages: updatedMessages
      });
    }
  }

  // If we're editing a file
  if (currentFileId.value) {
    const fileIndex = openFiles.value.findIndex(f => f.id === currentFileId.value);
    if (fileIndex !== -1) {
      openFiles.value[fileIndex].code = currentCode.value;
      openFiles.value[fileIndex].lastModified = Date.now();

      // Save to local storage
      saveFileToLocal(openFiles.value[fileIndex]);
    }
  }

  // If we're editing a relic
  const currentRelic = relics.value.find(r => r.id === currentFileId.value);
  if (currentRelic) {
    currentRelic.code = currentCode.value;
    currentRelic.lastModified = Date.now();

    // Update compilation status
    if (previewErrors.value) {
      currentRelic.status = 'failed';
    } else {
      currentRelic.status = 'passed';
    }

    // Save relic to local storage
    saveRelicsToLocalStorage();
  }

  lastSavedCode.value = currentCode.value;
  hasEdits.value = false;
}

const updateOriginalCode = async () => {
  if (!currentNodeId.value || currentCodeIndex.value === undefined) {
    console.error("No active code snippet to update");
    return;
  }

  // Find the node and update the code in the original message
  const node = canvasStore.nodes.find(n => n.id === currentNodeId.value);
  if (!node) {
    console.warn("Current node not found. Cannot update code.");
    return;
  }

  // Find the message containing this code index
  const messageIndex = node.messages.findIndex(
    msg => msg.contentParts?.some(part => part.type === 'code' && part.codeIndex === currentCodeIndex.value)
  );

  if (messageIndex !== -1) {
    const updatedMessages = [...node.messages];
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      contentParts: updatedMessages[messageIndex].contentParts.map(part => {
        if (part.type === 'code' && part.codeIndex === currentCodeIndex.value) {
          return { ...part, content: currentCode.value };
        }
        return part;
      })
    };

    // Update the node
    await canvasStore.updateNode(currentNodeId.value, {
      messages: updatedMessages
    });

    // Reset the edited status
    const key = `${currentNodeId.value}-${currentCodeIndex.value}`;
    editedCodeVersions.value.delete(key);
    localStorage.removeItem(`edited-code-${key}`);

    // Update UI
    currentOriginalCode.value = currentCode.value;
    lastSavedCode.value = currentCode.value;
    hasEdits.value = false;

    // Emit event to update code bubble display
    emitter.emit('code-edit-status-changed', {
      nodeId: currentNodeId.value,
      codeIndex: currentCodeIndex.value,
      isEdited: false
    });

    // Show confirmation
    alert("Original code snippet updated successfully");
  } else {
    console.error("Could not find message containing the code snippet");
  }
};

const handleSandpackMessage = (event: SandpackMessage) => {
  if (event.type === 'error') {
    // Handle compile/runtime errors
    if (event.error) {
      if (typeof event.error === 'string') {
        previewErrors.value = event.error;
      } else if (event.error.message) {
        previewErrors.value = event.error.message;
      } else {
        previewErrors.value = "An unknown error occurred";
      }
    }
  } else if (event.type === 'console') {
    // Handle console messages
    if (Array.isArray(event.data)) {
      const logMessages = event.data.map((item) => {
        // Handle different console message formats
        if (typeof item === 'string') {
          return item;
        }

        if (item.data) {
          // Handle array of console arguments
          if (Array.isArray(item.data)) {
            return item.data.map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
          }
          // Handle error objects or messages
          if (item.data instanceof Error || typeof item.data.message === 'string') {
            return item.data.message;
          }
          // Handle plain data
          return String(item.data);
        }

        return '';
      }).filter(Boolean); // Remove empty messages

      previewErrors.value = logMessages.join('\n');
    }
  }
  nextTick(() => {
    updateRelicStatus();
  });
}

const sendErrors = async () => {
  try {
    await new Promise(resolve => setTimeout(resolve, 250));

    let errorsToSend = previewErrors.value;

    if (!errorsToSend) {
      errorsToSend = "An error occurred, but the specific error message could not be retrieved.";
    }

    const debugPrompt = `I have a React component that's throwing errors. Here's the current code:

\`\`\`jsx
${currentCode.value}
\`\`\`

And here are the errors:
${errorsToSend}

Please analyze the errors and provide a corrected version of the component that resolves these issues. Explain what was wrong and what changes you made.`;

    if (!currentNodeId.value) {
      console.error('No nodeId available for debug message');
      return;
    }

    emitter.emit('debug-sandbox', {
      code: currentCode.value,
      errors: debugPrompt,
      nodeId: currentNodeId.value
    });
  } catch (error) {
    console.error('Error in sendErrors:', error);
    previewErrors.value = 'Failed to process errors: ' + String(error);
  }
}

// File management functions
const createNewFile = () => {
  const newFileId = Date.now().toString();
  const newFile: CodeFile = {
    id: newFileId,
    name: `New File ${openFiles.value.length + 1}.jsx`,
    language: 'react',
    code: '// Start coding here\n\nconst MyComponent = () => {\n  return (\n    <div>\n      <h1>Hello World</h1>\n    </div>\n  );\n};\n\nexport default MyComponent;',
    lastModified: Date.now()
  };

  openFiles.value.push(newFile);
  currentFileId.value = newFileId;

  // Update the editor
  currentCode.value = newFile.code;
  currentLanguage.value = newFile.language;
  isStreaming.value = false;
  lastSavedCode.value = newFile.code;
  hasEdits.value = false;

  emit('panel-opened');
}

const selectFile = (fileId: string) => {
  const file = openFiles.value.find(f => f.id === fileId);
  if (file) {
    currentFileId.value = fileId;
    currentCode.value = file.code;
    currentLanguage.value = file.language;
    isStreaming.value = false;
    lastSavedCode.value = file.code;
    hasEdits.value = false;
  }
}

const closeFile = (fileId: string) => {
  // Check if file has unsaved changes
  const fileIndex = openFiles.value.findIndex(f => f.id === fileId);
  if (fileIndex !== -1) {
    const file = openFiles.value[fileIndex];

    // If has changes, prompt to save
    if (currentFileId.value === fileId && hasEdits.value) {
      if (confirm('Save changes before closing?')) {
        saveFile();
      }
    }

    // Remove file from open files
    openFiles.value.splice(fileIndex, 1);

    // If this was the current file, select another file or show empty state
    if (currentFileId.value === fileId) {
      if (openFiles.value.length > 0) {
        selectFile(openFiles.value[0].id);
      } else {
        currentFileId.value = null;
      }
    }
  }
}

const saveFile = () => {
  saveCurrentCode();
}

const saveFileToLocal = (file: CodeFile) => {
  // Get existing files
  const savedFilesRaw = localStorage.getItem('codeFiles');
  let existingFiles: CodeFile[] = [];
  if (savedFilesRaw) {
    try {
      existingFiles = JSON.parse(savedFilesRaw);
    } catch (e) {
      console.error('Error parsing saved files:', e);
    }
  }

  // Update or add the file
  const existingIndex = existingFiles.findIndex(f => f.id === file.id);
  if (existingIndex !== -1) {
    existingFiles[existingIndex] = file;
  } else {
    existingFiles.push(file);
  }

  // Save back to localStorage
  localStorage.setItem('codeFiles', JSON.stringify(existingFiles));

  // Update the savedFiles ref
  loadSavedFiles();
}

const loadSavedFiles = () => {
  const savedFilesRaw = localStorage.getItem('codeFiles');
  if (savedFilesRaw) {
    try {
      savedFiles.value = JSON.parse(savedFilesRaw);
    } catch (e) {
      console.error('Error parsing saved files:', e);
      savedFiles.value = [];
    }
  } else {
    savedFiles.value = [];
  }
}

const openFile = () => {
  loadSavedFiles();
  fileExplorerDialog.value?.showModal();
}

const closeFileExplorer = () => {
  fileExplorerDialog.value?.close();
}

const loadSavedFile = (file: CodeFile) => {
  // Check if already open
  const existingIndex = openFiles.value.findIndex(f => f.id === file.id);
  if (existingIndex !== -1) {
    selectFile(file.id);
  } else {
    openFiles.value.push({ ...file });
    currentFileId.value = file.id;
    currentCode.value = file.code;
    currentLanguage.value = file.language;
    lastSavedCode.value = file.code;
    hasEdits.value = false;
  }

  closeFileExplorer();
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString();
}

const runCode = () => {
  // Clear any previous errors
  previewErrors.value = '';

  // Use a safer approach to check for errors
  setTimeout(() => {
    // Instead of accessing iframe content directly, check for error indicators
    // in the parent document that Sandpack creates
    const hasErrorOverlay = document.querySelector('.sp-preview-error') !== null ||
      document.querySelector('.sp-overlay-error') !== null;

    if (hasErrorOverlay) {
      previewErrors.value = "React component rendering error detected";
    }

    updateRelicStatus();
  }, 1000);
}

const updateRelicStatus = () => {
  if (currentFileId.value) {
    const relicIndex = relics.value.findIndex(r => r.id === currentFileId.value);

    if (relicIndex !== -1) {
      // Check for different types of errors
      const hasErrors = !!previewErrors.value ||
        document.querySelector('.sp-preview-error') !== null ||
        document.querySelector('.sp-overlay-error') !== null;

      console.log(`Updating relic status: ${relics.value[relicIndex].name} - errors detected: ${hasErrors}`);

      // Create a new array with the updated relic to ensure reactivity
      const updatedRelics = [...relics.value];
      updatedRelics[relicIndex] = {
        ...updatedRelics[relicIndex],
        status: hasErrors ? 'failed' : 'passed',
        lastModified: Date.now()
      };

      // Update the reactive relics array
      relics.value = updatedRelics;

      // Save to localStorage
      saveRelicsToLocalStorage();
    }
  }
}

// Inline assistant functionality
const toggleInlineAssistant = async () => {
  // Force an update from the Sandpack editor to our state
  if (sandpackEditorRef.value && sandpackEditorRef.value.getCode) {
    // Get the latest code directly from the editor
    const latestCode = await sandpackEditorRef.value.getCode();
    currentCode.value = latestCode || currentCode.value;
  }

  // Store the original code
  originalCodeBeforeAssist.value = currentCode.value;

  // Show the prompt directly
  showInlinePrompt.value = true;

  // Focus the input on next tick
  nextTick(() => {
    inlinePromptRef.value?.focus();
  });
}

const setupKeyboardShortcuts = () => {
  document.addEventListener('keydown', (e) => {
    // Check for Cmd+K (Mac) or Ctrl+K (Windows)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k' && currentView.value === 'editor') {
      e.preventDefault()

      // Store the original code for diff comparison later
      originalCodeBeforeAssist.value = currentCode.value

      // Show the prompt directly
      showInlinePrompt.value = true

      // Focus the input on next tick
      nextTick(() => {
        inlinePromptRef.value?.focus()
      })
    }

    // ESC key to cancel inline diff mode if active
    if (e.key === 'Escape' && isDiffMode.value) {
      discardSuggestedChanges()
    }
  })
}

// --- submitInlinePrompt ---
const submitInlinePrompt = async () => {
  const promptText = inlinePromptText.value.trim();
  if (!promptText) {
    cancelInlinePrompt();
    return;
  }

  // Force a code sync before proceeding
  if (sandpackEditorRef.value && sandpackEditorRef.value.getCode) {
    const latestCode = await sandpackEditorRef.value.getCode();
    currentCode.value = latestCode || currentCode.value;
  }

  showInlinePrompt.value = false;
  isDiffMode.value = true;
  originalCodeBeforeAssist.value = currentCode.value;

  try {
    saveCurrentCode();
    const prompt = `I'm working on this code:\n\n\`\`\`${currentLanguage.value}\n${currentCode.value}\n\`\`\`\n\n${promptText}\n\nIMPORTANT: Please respond with ONLY the complete updated code without any explanations. I'll see the changes as a diff.`;

    // 2️⃣  Send it straight to the model (this also appends the user message internally)
    const modelInfo = JSON.parse(localStorage.getItem('selectedModel') || '{}');
    const apiKey = localStorage.getItem('openRouterApiKey') || '';

    await canvasStore.sendMessage(
      effectiveNodeId.value,
      prompt,
      modelInfo,
      apiKey,
    );

    // 3️⃣ Listen for assistant reply to extract code & show diff
    const unsubscribe = emitter.on('message-streamed', (data) => {
      if (data.nodeId === currentNodeId.value && data.role === 'assistant') {
        const extracted = extractCodeFromResponse(data.content);
        if (extracted) {
          suggestedCode.value = extracted;
          showDiffInEditor(originalCodeBeforeAssist.value, suggestedCode.value);
          showAcceptDiscard.value = true;
          unsubscribe();        // done listening
        }
      }
    });

  } catch (err) {
    console.error('inline prompt failed:', err);
    resetDiffMode();
    cancelInlinePrompt();
    alert('Something went wrong, try again.');
  } finally {
    inlinePromptText.value = '';
  }
};


// --- Extract code from the assistant's response ---
const extractCodeFromResponse = (response) => {
  // First try to match code blocks with language markers
  const codeBlockRegex = /```(?:\w+)?\s*([\s\S]*?)```/
  const match = response.match(codeBlockRegex)

  if (match && match[1]) {
    return match[1].trim()
  }

  // Next try to match plain code blocks without language markers
  const plainCodeBlockRegex = /```\s*([\s\S]*?)```/
  const plainMatch = response.match(plainCodeBlockRegex)

  if (plainMatch && plainMatch[1]) {
    return plainMatch[1].trim()
  }

  // If no code block, just return the raw response as it might be just code
  return response.trim()
}


const showDiffInEditor = (originalCode, newCode) => {
  // First, generate a detailed diff between the two code versions
  try {
    // Generate line-by-line diff information
    const diffLines = generateDiffLines(originalCode, newCode);

    // Apply highlighting to the editor
    if (diffLines && diffLines.length > 0) {
      // Apply the highlighted version to the editor
      currentCode.value = formatDiffForDisplay(newCode, diffLines);

      // Show UI elements for diff mode
      showDiffView.value = true;
      isDiffMode.value = true;
      showAcceptDiscard.value = true;
    } else {
      // No changes detected
      alert("No changes were suggested by the AI.");
      resetDiffMode();
    }
  } catch (error) {
    console.error("Error showing diff:", error);
    // Fallback to simple replacement if diff fails
    currentCode.value = newCode;
    showDiffView.value = true;
    isDiffMode.value = true;
    showAcceptDiscard.value = true;
  }
};

// Helper function to generate diff information
const generateDiffLines = (originalCode, newCode) => {
  // Split both code versions into lines
  const originalLines = originalCode.split('\n');
  const newLines = newCode.split('\n');

  // Create a simplified diff structure
  const diffLines = [];

  // Use a simple line-by-line comparison (for a full app, use a real diff library)
  let i = 0, j = 0;
  while (i < originalLines.length || j < newLines.length) {
    if (i >= originalLines.length) {
      // All remaining lines in newLines are additions
      while (j < newLines.length) {
        diffLines.push({ lineNum: j, type: 'added', content: newLines[j] });
        j++;
      }
      break;
    }

    if (j >= newLines.length) {
      // All remaining lines in originalLines are removals
      while (i < originalLines.length) {
        diffLines.push({ lineNum: i, type: 'removed', content: originalLines[i] });
        i++;
      }
      break;
    }

    if (originalLines[i] === newLines[j]) {
      // Line is unchanged
      diffLines.push({ lineNum: j, type: 'unchanged', content: newLines[j] });
      i++;
      j++;
    } else {
      // Line is different - try to find the next matching line
      let foundMatch = false;

      // Look ahead in the new code to see if the current original line appears later
      for (let lookAhead = 1; lookAhead < 5 && j + lookAhead < newLines.length; lookAhead++) {
        if (originalLines[i] === newLines[j + lookAhead]) {
          // Current original line was moved down - lines in between are additions
          for (let k = 0; k < lookAhead; k++) {
            diffLines.push({ lineNum: j + k, type: 'added', content: newLines[j + k] });
          }
          j += lookAhead;
          foundMatch = true;
          break;
        }
      }

      // If no match found looking ahead, look for the current new line in the original code
      if (!foundMatch) {
        for (let lookAhead = 1; lookAhead < 5 && i + lookAhead < originalLines.length; lookAhead++) {
          if (newLines[j] === originalLines[i + lookAhead]) {
            // Current new line was moved down - lines in between are removals
            for (let k = 0; k < lookAhead; k++) {
              diffLines.push({ lineNum: i + k, type: 'removed', content: originalLines[i + k] });
            }
            i += lookAhead;
            foundMatch = true;
            break;
          }
        }
      }

      // If still no match, consider it a one-line replacement
      if (!foundMatch) {
        diffLines.push({ lineNum: i, type: 'removed', content: originalLines[i] });
        diffLines.push({ lineNum: j, type: 'added', content: newLines[j] });
        i++;
        j++;
      }
    }
  }

  return diffLines;
};

// Format the diff for display in the editor by adding special comments
const formatDiffForDisplay = (newCode, diffLines) => {
  // Add special comment markers to highlight changes
  const lines = newCode.split('\n');
  const formattedLines = [...lines];

  // We'll add comment markers to show the changes
  // For different languages, we'll use appropriate comment syntax
  const commentStart = getCommentSyntax(currentLanguage.value);

  // First pass - mark added lines
  diffLines.forEach(diff => {
    if (diff.type === 'added') {
      const lineIndex = diff.lineNum;
      if (lineIndex >= 0 && lineIndex < formattedLines.length) {
        // Add a special comment at the end of the line
        formattedLines[lineIndex] = formattedLines[lineIndex] + ` ${commentStart} ADDED ✅`;
      }
    }
  });

  // Second pass - add comments for removed lines with the content that was removed
  diffLines.forEach(diff => {
    if (diff.type === 'removed') {
      // Find where to insert the removed line
      // Insert it near where it would have been in the original
      let insertIndex = 0;

      // Try to find the line before this one
      for (let i = diff.lineNum - 1; i >= 0; i--) {
        const prevDiff = diffLines.find(d => d.lineNum === i && d.type !== 'removed');
        if (prevDiff) {
          insertIndex = prevDiff.lineNum + 1;
          break;
        }
      }

      // If we couldn't find a previous line, try to find the next line
      if (insertIndex === 0) {
        for (let i = diff.lineNum + 1; i < diffLines.length; i++) {
          const nextDiff = diffLines.find(d => d.lineNum === i && d.type !== 'removed');
          if (nextDiff) {
            insertIndex = nextDiff.lineNum;
            break;
          }
        }
      }

      // If we still couldn't find a place, put it at the beginning
      if (insertIndex === 0) {
        insertIndex = 0;
      }

      // Make sure the index is valid
      insertIndex = Math.min(insertIndex, formattedLines.length);

      // Insert a comment showing the removed line
      formattedLines.splice(
        insertIndex,
        0,
        `${commentStart} REMOVED ❌: ${diff.content}`
      );
    }
  });

  return formattedLines.join('\n');
};

// Helper to get the appropriate comment syntax for different languages
const getCommentSyntax = (language) => {
  switch (language) {
    case 'html':
      return '<!--';
    case 'css':
      return '/*';
    case 'typescript':
    case 'javascript':
    case 'jsx':
    case 'tsx':
    case 'react':
    case 'typescriptreact':
      return '//';
    case 'python':
      return '#';
    case 'php':
      return '//';
    case 'ruby':
      return '#';
    default:
      return '//';
  }
};

// When accepting changes, clean up the diff markers
const acceptSuggestedChanges = () => {
  // Clean up any diff markers before saving
  currentCode.value = cleanupDiffMarkers(currentCode.value);

  // Save the cleaned code
  saveCurrentCode();

  // Reset the diff mode
  resetDiffMode();
};


const cleanupDiffMarkers = (code) => {
  const commentPatterns = [
    / \/\/ ADDED ✅$/gm,  // JS/TS comment
    / \/\* ADDED ✅$/gm,  // CSS comment
    / # ADDED ✅$/gm,     // Python/Ruby comment
    / <!-- ADDED ✅$/gm,  // HTML comment
    /^\/\/ REMOVED ❌:.*$/gm,  // JS/TS removed line
    /^\/\* REMOVED ❌:.*$/gm,  // CSS removed line
    /^# REMOVED ❌:.*$/gm,     // Python/Ruby removed line
    /^<!-- REMOVED ❌:.*$/gm,  // HTML removed line
  ];

  let cleanedCode = code;
  commentPatterns.forEach(pattern => {
    cleanedCode = cleanedCode.replace(pattern, '');
  });

  // Also clean up empty lines that might have been created
  cleanedCode = cleanedCode.replace(/\n\s*\n/g, '\n\n');

  return cleanedCode;
};

const discardSuggestedChanges = () => {
  // Restore the original code
  currentCode.value = originalCodeBeforeAssist.value

  // Add a custom event for analytics/tracking
  emitter.emit('ai-suggestion-discarded', {
    nodeId: currentNodeId.value,
    language: currentLanguage.value,
    prompt: inlinePromptText.value
  })

  // Clean up the diff mode
  resetDiffMode()
}

// --- Reset diff mode state ---
const resetDiffMode = () => {
  showDiffView.value = false
  isDiffMode.value = false
  showAcceptDiscard.value = false
  suggestedCode.value = ''
  // Note: we don't clear originalCodeBeforeAssist in case user wants to try again
}

// --- Cancel inline prompt ---
const cancelInlinePrompt = () => {
  inlinePromptText.value = ''
  showInlinePrompt.value = false

  // If in diff mode, also reset that
  if (isDiffMode.value) {
    resetDiffMode()
  }
}

// Relic Management Functions
const loadRelics = () => {
  // First load manually created relics from localStorage
  const relicsRaw = localStorage.getItem('webRelics');
  if (relicsRaw) {
    try {
      const savedRelics = JSON.parse(relicsRaw);
      relics.value = savedRelics;
    } catch (e) {
      console.error('Error parsing relics:', e);
      relics.value = [];
    }
  } else {
    relics.value = [];
  }

  // Then scan the canvas store for code bubbles and add them too
  scanAllWorkspacesForCodeBubbles();
}

const scanAllWorkspacesForCodeBubbles = async () => {
  const chatStore = useChatStore();

  // Ensure chats are loaded
  if (chatStore.chats.length === 0) {
    await chatStore.loadChats();
  }

  // Loop through all chats
  for (const chat of chatStore.chats) {
    try {
      // Load full chat data to access nodes and messages
      const chatData = await chatStore.loadChat(chat.id);
      if (!chatData || !chatData.nodes) continue;

      // Process each node recursively
      const processNode = (node) => {
        // Check messages for code parts
        if (node.messages) {
          node.messages.forEach((message, messageIndex) => {
            if (message.contentParts) {
              message.contentParts.forEach(part => {
                if (part.type === 'code' && part.content && part.codeIndex !== undefined) {
                  // Create a unique ID for this code bubble
                  const relicId = `chat-${chat.id}-node-${node.id}-code-${part.codeIndex}`;

                  // Create a relic for this code bubble
                  const newRelic: Relic = {
                    id: relicId,
                    name: `${chat.title} - ${node.title || 'Untitled'} - Code ${part.codeIndex + 1}`,
                    description: `Code snippet from chat: ${chat.title}`,
                    language: part.language || 'react',
                    code: part.content,
                    dependencies: {},
                    status: 'passed',
                    lastModified: Date.now(),
                    sourceInfo: {
                      chatId: chat.id,
                      nodeId: node.id,
                      messageIndex,
                      codeIndex: part.codeIndex
                    }
                  };

                  // Store in our sourceRelics map
                  sourceRelics.value.set(relicId, newRelic);
                }
              });
            }
          });
        }

        // Process children recursively
        if (node.children) {
          node.children.forEach(processNode);
        }
      };

      // Start processing from the root node
      processNode(chatData.nodes);
    } catch (error) {
      console.error(`Error processing chat ${chat.id}:`, error);
    }
  }

  // Merge source relics with saved relics, giving priority to saved ones
  const allRelics = [...relics.value];

  // Add source relics that don't already exist in saved relics
  sourceRelics.value.forEach((relic) => {
    if (!allRelics.some(r => r.id === relic.id)) {
      allRelics.push(relic);
    }
  });

  relics.value = allRelics;
}

const saveRelicsToLocalStorage = () => {
  localStorage.setItem('webRelics', JSON.stringify(relics.value));
}

const switchToManager = () => {
  currentView.value = 'manager';
  loadRelics(); // Refresh the list when switching to manager
}

const createNewRelic = () => {
  // Reset the new relic form
  newRelic.value = {
    name: '',
    description: '',
    language: 'react',
    template: 'basic'
  };

  // Show the dialog
  newRelicDialog.value?.showModal();
}

const closeNewRelicDialog = () => {
  newRelicDialog.value?.close();
}

const confirmNewRelic = () => {
  // Validate inputs
  if (!newRelic.value.name.trim()) {
    alert('Please enter a name for the relic');
    return;
  }

  // Create new relic
  const relicId = `relic-${Date.now()}`;
  const code = getTemplateCode(newRelic.value.template, newRelic.value.language);

  const relic: Relic = {
    id: relicId,
    name: newRelic.value.name,
    description: newRelic.value.description,
    language: newRelic.value.language,
    code,
    dependencies: {},
    status: 'passed', // Assume it will pass initially
    lastModified: Date.now()
  };

  // Add to relics list
  relics.value.push(relic);

  // Save to local storage
  saveRelicsToLocalStorage();

  // Close dialog
  closeNewRelicDialog();

  // Open the new relic in the editor
  openRelic(relic);
}

const openRelic = async (relic: Relic) => {
  // First, ensure the side panel is open at the app level
  appStore.openSidePanel();

  // If this relic has sourceInfo, prioritize navigating to its source
  if (relic.sourceInfo) {
    console.log('Navigating to relic source:', relic.sourceInfo);

    // Switch to editor view
    currentView.value = 'editor';

    // Load the code into the editor immediately so it's visible
    currentCode.value = relic.code;
    currentLanguage.value = relic.language;
    lastSavedCode.value = relic.code;
    hasEdits.value = false;
    currentCodeIndex.value = relic.sourceInfo.codeIndex;
    currentNodeId.value = relic.sourceInfo.nodeId;

    // Setup the editor state to reflect we're editing code from a chat message
    currentOriginalCode.value = relic.code;

    // Navigate to the source workspace and branch
    emitter.emit('navigate-to-code-bubble', {
      chatId: relic.sourceInfo.chatId,
      nodeId: relic.sourceInfo.nodeId,
      codeIndex: relic.sourceInfo.codeIndex
    });

    return;
  }

  // For relics without sourceInfo, continue with normal behavior
  // Switch to editor view
  currentView.value = 'editor';

  // Load the relic into the editor
  currentCode.value = relic.code;
  currentLanguage.value = relic.language;
  currentFileId.value = relic.id;
  lastSavedCode.value = relic.code;
  hasEdits.value = false;
  previewErrors.value = '';

  // Run the code to check for errors
  runCode();
};

const duplicateRelic = (relic: Relic) => {
  const newRelic: Relic = {
    ...relic,
    id: `relic-${Date.now()}`,
    name: `${relic.name} (Copy)`,
    lastModified: Date.now()
  };

  relics.value.push(newRelic);
  saveRelicsToLocalStorage();
}

const deleteRelic = (relic: Relic) => {
  relicToDelete.value = relic;
  deleteConfirmDialog.value?.showModal();
}

const closeDeleteConfirmDialog = () => {
  deleteConfirmDialog.value?.close();
  relicToDelete.value = null;
}

const confirmDeleteRelic = () => {
  if (relicToDelete.value) {
    // Remove from relics array
    const index = relics.value.findIndex(r => r.id === relicToDelete.value?.id);
    if (index !== -1) {
      relics.value.splice(index, 1);
    }

    // Save to local storage
    saveRelicsToLocalStorage();

    // Close dialog
    closeDeleteConfirmDialog();
  }
}

// Watchers and Lifecycle Hooks
watch(codeSnippets, (newSnippets) => {
  if (newSnippets.length > 0 && currentSnippetIndex.value !== -1) {
    const currentSnippet = newSnippets[currentSnippetIndex.value]
    hasEdits.value = currentCode.value !== lastSavedCode.value
  }
}, { deep: true })

watch(() => props.nodeId, (newId) => {
  if (newId) {
    currentNodeId.value = newId;
  }
});

// Existing watcher
watch(() => props.nodeId, (newId) => {
  if (newId) {
    currentNodeId.value = newId;
  }
});

// Add these new watchers right after the existing one
// Watch for node changes to reset relic indices
watch(() => currentNodeId.value, (newNodeId) => {
  if (newNodeId || canvasStore.snappedNodeId) {
    // Reset the relic index when changing nodes
    currentRelicIndex.value = 0;

    // Wait a tick to allow filteredRelics to update
    nextTick(() => {
      // If there are any relics, load the first one
      if (filteredRelics.value.length > 0) {
        loadRelicAtIndex(0);
      }
    });
  }
});

// Also watch for changes in the snapped node state
watch(() => canvasStore.snappedNodeId, (newSnappedNodeId) => {
  if (newSnappedNodeId) {
    // Reset the relic index when a node is snapped
    currentRelicIndex.value = 0;

    nextTick(() => {
      if (filteredRelics.value.length > 0) {
        loadRelicAtIndex(0);
      }
    });
  }
});

watch(currentCode, (newCode) => {
  // Force update the sandpack editor when currentCode changes externally
  if (sandpackEditorRef.value && sandpackEditorRef.value.updateCode) {
    sandpackEditorRef.value.updateCode(newCode);
  }
});

watch(() => previewErrors.value, (newErrors) => {
  // If we're editing a relic, update its status based on errors
  if (currentFileId.value) {
    const currentRelic = relics.value.find(r => r.id === currentFileId.value);
    if (currentRelic) {
      if (newErrors) {
        currentRelic.status = 'failed';
      } else {
        currentRelic.status = 'passed';
      }

      // Save the updated status
      saveRelicsToLocalStorage();
    }
  }
});

onMounted(() => {
  // Initialize with a default file if no files are open
  if (openFiles.value.length === 0) {
    createNewFile();
  }

  console.log("[DEBUG] SidePanel mounted, editor ref exists:", !!sandpackEditorRef.value);
  console.log("[DEBUG] Initial currentCode:", currentCode.value.substring(0, 40) + "...");

  // Wait for Sandpack to initialize
  setTimeout(async () => {
    console.log("[DEBUG] After timeout, editor ref exists:", !!sandpackEditorRef.value);
    if (sandpackEditorRef.value && sandpackEditorRef.value.getCode) {
      const initialEditorCode = await sandpackEditorRef.value.getCode();
      console.log("[DEBUG] Initial editor content:", initialEditorCode.substring(0, 40) + "...");
    }
  }, 1000);

  // Setup direct observation of theme attribute changes
  themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'data-theme') {
        updateThemeFromDOM();
      }
    });
  });

  setupKeyboardShortcuts();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (showInlinePrompt.value) {
        cancelInlinePrompt()
      } else if (isDiffMode.value) {
        discardSuggestedChanges()
      }
    }
  })

  // Start observing theme changes on document element
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  // Initial theme check
  updateThemeFromDOM();

  emitter.on('show-sandbox', handleShowSandbox);

  emitter.on('navigate-relic', ({ direction, nodeId }) => {
    // Only respond if this event is for the current node
    if (nodeId === currentNodeId.value || nodeId === canvasStore.snappedNodeId) {
      if (direction === 'next') {
        nextRelic();
      } else if (direction === 'previous') {
        previousRelic();
      }
    }
  });

  loadSavedFiles();
  loadRelics();

  window.addEventListener('error', (event) => {
    if (event.message.includes('React') || event.message.includes('THREE')) {
      previewErrors.value = event.message;
      updateRelicStatus();
    }
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Look for error indicators in the parent window
        const errorOverlays = document.querySelectorAll('.sp-preview-error, .sp-overlay-error');
        if (errorOverlays && errorOverlays.length > 0) {
          previewErrors.value = "React error detected";
          updateRelicStatus();
        }
      }
    }
  });

  // Observe the preview container itself
  const previewContainer = document.querySelector('.sp-preview-container');
  if (previewContainer) {
    observer.observe(previewContainer, { childList: true, subtree: true });
  }

  // Close filter menu when clicking outside
  document.addEventListener('click', (e) => {
    if (showFilterMenu.value && !(e.target as Element).closest('.relative')) {
      showFilterMenu.value = false;
    }
  });
})

onBeforeUnmount(() => {
  if (autoSaveTimeout.value) {
    clearTimeout(autoSaveTimeout.value);
    autoSaveTimeout.value = null;
  }
});

onUnmounted(() => {
  if (themeObserver) {
    themeObserver.disconnect();
  }

  emitter.off('show-sandbox', handleShowSandbox);

  emitter.off('navigate-relic');

  document.removeEventListener('keydown', setupKeyboardShortcuts)

  // Clean up document event listeners
  document.removeEventListener('click', (e) => {
    if (showFilterMenu.value && !(e.target as Element).closest('.relative')) {
      showFilterMenu.value = false;
    }
  });
})
</script>

<style scoped>
/* Fix Sandpack container styles */
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
  border-bottom-right-radius: 16px;
  border-bottom-left-radius: 16px;
}

:deep(.cm-editor) {
  height: 100% !important;
}

:deep(.sp-preview-container) {
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  height: 100% !important;
  min-height: 0 !important;
}

:deep(.sp-preview) {
  height: 100% !important;
  padding: 0 !important;
}

:deep(.sp-code-editor .cm-theme) {
  height: 100% !important;
}

:deep(.sp-stack > div) {
  min-h-0: !important;
}

/* Theme-specific styling */
.side-panel-container {
  background-color: var(--b1);
  color: var(--bc);
}

.theme-dark .side-panel-container {
  background-color: rgba(20, 20, 25, 0.98);
}

.theme-cyberpunk .side-panel-container {
  border-left: 2px solid var(--p);
  box-shadow: 0 0 20px var(--p);
}

.theme-synthwave .side-panel-container {
  background: linear-gradient(135deg, rgba(50, 10, 80, 0.95), rgba(20, 0, 40, 0.98));
  border-left: 1px solid rgba(255, 100, 255, 0.5);
}

.theme-retro .side-panel-container {
  border-left: 3px double var(--p);
}

.theme-valentine .side-panel-container,
.theme-cupcake .side-panel-container {
  border-left: 2px solid rgba(255, 150, 180, 0.5);
}

.theme-aqua .side-panel-container {
  background: linear-gradient(to right, rgba(0, 40, 60, 0.95), rgba(0, 20, 40, 0.98));
  border-left: 1px solid rgba(0, 210, 255, 0.5);
}

.theme-luxury .side-panel-container {
  border-left: 1px solid rgba(255, 215, 0, 0.5);
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.7);
}

/* Control button theme enhancements */
.file-btn,
.editor-control-btn,
.filter-btn,
.view-btn {
  transition: all 0.2s ease-in-out;
}

.theme-cyberpunk .file-btn:hover,
.theme-cyberpunk .editor-control-btn:hover,
.theme-cyberpunk .view-btn:hover {
  text-shadow: 0 0 8px var(--p);
  box-shadow: 0 0 12px var(--p);
}

.theme-synthwave .file-btn:hover,
.theme-synthwave .editor-control-btn:hover,
.theme-synthwave .view-btn:hover {
  background: linear-gradient(135deg, rgba(255, 100, 255, 0.2), rgba(100, 100, 255, 0.2)) !important;
}

/* Relic cards animation */
.relic-card {
  animation: slide-in-fade 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  animation-delay: calc(0.05s * var(--index, 0));
  transition: all 0.3s ease;
}

/* Theme-specific card styling */
.theme-cyberpunk .relic-card {
  background: rgba(10, 10, 30, 0.9) !important;
  border-color: var(--p) !important;
  box-shadow: 0 0 15px rgba(var(--p-rgb), 0.3) !important;
}

.theme-synthwave .relic-card {
  background: linear-gradient(135deg, rgba(40, 10, 60, 0.8), rgba(80, 20, 120, 0.6)) !important;
}

.theme-retro .relic-card {
  border-style: double !important;
  border-width: 3px !important;
}

.theme-aqua .relic-card {
  background: linear-gradient(135deg, rgba(0, 30, 50, 0.8), rgba(0, 50, 70, 0.6)) !important;
  border-color: rgba(0, 200, 255, 0.4) !important;
}

.theme-luxury .relic-card {
  background: rgba(15, 15, 15, 0.95) !important;
  border-color: rgba(212, 175, 55, 0.5) !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
}

/* Assign index to cards based on their grid position */
.grid>.relic-card:nth-child(1) {
  --index: 0;
}

.grid>.relic-card:nth-child(2) {
  --index: 1;
}

.grid>.relic-card:nth-child(3) {
  --index: 2;
}

.grid>.relic-card:nth-child(4) {
  --index: 3;
}

.grid>.relic-card:nth-child(5) {
  --index: 4;
}

.grid>.relic-card:nth-child(6) {
  --index: 5;
}

.grid>.relic-card:nth-child(7) {
  --index: 6;
}

.grid>.relic-card:nth-child(8) {
  --index: 7;
}

.grid>.relic-card:nth-child(9) {
  --index: 8;
}

.grid>.relic-card:nth-child(10) {
  --index: 9;
}

.grid>.relic-card:nth-child(11) {
  --index: 10;
}

.grid>.relic-card:nth-child(12) {
  --index: 11;
}

.grid>.relic-card:nth-child(13) {
  --index: 12;
}

.grid>.relic-card:nth-child(14) {
  --index: 13;
}

.grid>.relic-card:nth-child(15) {
  --index: 14;
}

.grid>.relic-card:nth-child(16) {
  --index: 15;
}

.grid>.relic-card:nth-child(17) {
  --index: 16;
}

.grid>.relic-card:nth-child(18) {
  --index: 17;
}

.grid>.relic-card:nth-child(19) {
  --index: 18;
}

.grid>.relic-card:nth-child(20) {
  --index: 19;
}

.grid>.relic-card:nth-child(n+21) {
  --index: 20;
}

/* Modal animations and styling */
dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.theme-cyberpunk dialog::backdrop {
  background: linear-gradient(135deg, rgba(0, 0, 40, 0.7), rgba(40, 0, 60, 0.7));
  backdrop-filter: blur(8px);
}

.theme-synthwave dialog::backdrop {
  background: linear-gradient(135deg, rgba(60, 10, 120, 0.6), rgba(120, 20, 60, 0.6));
  backdrop-filter: blur(8px);
}

/* Animation keyframes */
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

@keyframes glow {
  0% {
    box-shadow: 0 0 5px var(--p);
  }

  50% {
    box-shadow: 0 0 20px var(--p), 0 0 30px var(--p);
  }

  100% {
    box-shadow: 0 0 5px var(--p);
  }
}

.theme-cyberpunk .save-btn:not(:disabled),
.theme-synthwave .save-btn:not(:disabled) {
  animation: glow 2s infinite;
}
</style>