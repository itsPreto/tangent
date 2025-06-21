<template>
    <div class="h-full flex flex-col file-explorer" :style="containerStyle">
        <!-- Header -->
        <div class="p-3 border-b explorer-header flex-shrink-0" :style="headerStyle">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-base-content/90">EXPLORER</h3>
                <div class="flex items-center gap-1">
                    <button @click="createFile()" class="p-1 rounded hover:bg-base-content/10 transition-colors"
                        :style="iconButtonStyle" title="New File">
                        <FilePlus class="w-3.5 h-3.5" />
                    </button>
                    <button @click="createFolder()" class="p-1 rounded hover:bg-base-content/10 transition-colors"
                        :style="iconButtonStyle" title="New Folder">
                        <FolderPlus class="w-3.5 h-3.5" />
                    </button>
                    <button @click="collapseAll" class="p-1 rounded hover:bg-base-content/10 transition-colors"
                        :style="iconButtonStyle" title="Collapse All">
                        <ChevronDown class="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>

        <!-- File Tree - FIXED HEIGHT (60% of container) -->
        <div class="file-tree-container" :style="treeContainerStyle">
            <div class="p-2 h-full overflow-auto">
                <FileTreeItem v-for="item in files" :key="item.id" :item="item" :level="0" :activeFileId="activeFileId"
                    :expandedFolders="expandedFolders" :theme="theme" @select="$emit('select-file', $event)"
                    @toggle-folder="toggleFolder" @create-file="createFile" @create-folder="createFolder"
                    @delete="$emit('delete-item', $event)"
                    @rename="$emit('rename-item', $event.item, $event.newName)" />
            </div>
        </div>

        <!-- Bottom sections container - FIXED HEIGHT (40% of container) -->
        <div class="flex-shrink-0 flex flex-col" :style="bottomSectionsStyle">
            <!-- Dependencies Section -->
            <div class="border-t dependencies-section" :style="dependenciesStyle">
                <div class="p-2">
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="text-xs font-semibold text-base-content/80 uppercase">Dependencies</h4>
                        <button @click="toggleDependencies" class="p-1 rounded hover:bg-base-content/10 transition-colors"
                            :style="iconButtonStyle">
                            <ChevronDown class="w-3 h-3 transition-transform"
                                :class="{ 'rotate-180': !dependenciesExpanded }" />
                        </button>
                    </div>

                    <div v-if="dependenciesExpanded" class="space-y-1 max-h-20 overflow-y-auto">
                        <div v-for="(version, name) in dependencies" :key="name"
                            class="flex items-center gap-2 text-xs text-base-content/70 hover:text-base-content/90 cursor-pointer"
                            :style="dependencyItemStyle">
                            <Package class="w-3 h-3 flex-shrink-0" />
                            <span class="flex-1 truncate">{{ name }}</span>
                            <span class="text-base-content/50">{{ version }}</span>
                        </div>

                        <div v-if="Object.keys(dependencies).length === 0"
                            class="text-xs text-base-content/50 italic text-center py-2">
                            No dependencies
                        </div>
                    </div>
                </div>
            </div>

            <!-- Outline Section -->
            <div class="border-t outline-section" :style="outlineStyle">
                <div class="p-2">
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="text-xs font-semibold text-base-content/80 uppercase">Outline</h4>
                        <button @click="toggleOutline" class="p-1 rounded hover:bg-base-content/10 transition-colors"
                            :style="iconButtonStyle">
                            <ChevronDown class="w-3 h-3 transition-transform" :class="{ 'rotate-180': !outlineExpanded }" />
                        </button>
                    </div>

                    <div v-if="outlineExpanded" class="space-y-1 max-h-20 overflow-y-auto">
                        <div v-for="symbol in outline" :key="symbol.name"
                            class="flex items-center gap-2 text-xs text-base-content/70 hover:text-base-content/90 cursor-pointer py-1"
                            :style="outlineItemStyle" @click="jumpToSymbol(symbol)">
                            <component :is="getSymbolIcon(symbol.type)" class="w-3 h-3 flex-shrink-0" />
                            <span class="flex-1 truncate">{{ symbol.name }}</span>
                        </div>

                        <div v-if="outline.length === 0" class="text-xs text-base-content/50 italic text-center py-2">
                            No symbols found
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
    FilePlus, FolderPlus, ChevronDown, Package,
    SquareFunction, Variable, Box, Settings
} from 'lucide-vue-next'
import FileTreeItem from './FileTreeItem.vue'

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

interface CodeSymbol {
    name: string
    type: 'function' | 'variable' | 'class' | 'interface' | 'component'
    line: number
    column: number
}

interface Props {
    files: FileItem[]
    activeFileId?: string | null
    theme: string
}

const props = withDefaults(defineProps<Props>(), {
    activeFileId: null,
    theme: 'light'
})

const emit = defineEmits<{
    'select-file': [file: FileItem]
    'create-file': [parentId?: string]
    'create-folder': [parentId?: string]
    'delete-item': [item: FileItem]
    'rename-item': [item: FileItem, newName: string]
}>()

// State
const expandedFolders = ref<Set<string>>(new Set(['src', 'public']))
const dependenciesExpanded = ref(false) // Changed to false by default to save space
const outlineExpanded = ref(false) // Changed to false by default to save space
const dependencies = ref<Record<string, string>>({
    'react': '^18.2.0',
    'react-dom': '^18.2.0',
    'lucide-react': '^0.263.1'
})
const outline = ref<CodeSymbol[]>([])

// Theme detection with better contrast
const isDarkTheme = computed(() => {
    return props.theme === 'dark' ||
        props.theme === 'night' ||
        props.theme === 'coffee' ||
        props.theme === 'dracula' ||
        props.theme === 'synthwave' ||
        props.theme === 'cyberpunk'
})

// Improved styles with better contrast and fixed heights
const containerStyle = computed(() => ({
    backgroundColor: isDarkTheme.value ? 'rgba(25, 25, 30, 0.98)' : 'rgba(248, 248, 252, 0.98)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.9)',
    backdropFilter: 'blur(8px)'
}))

const headerStyle = computed(() => ({
    borderColor: isDarkTheme.value ? 'rgba(100, 100, 120, 0.4)' : 'rgba(200, 200, 220, 0.6)',
    backgroundColor: isDarkTheme.value ? 'rgba(20, 20, 25, 0.6)' : 'rgba(240, 240, 245, 0.6)',
    backdropFilter: 'blur(4px)'
}))

const treeContainerStyle = computed(() => ({
    height: '60%', // Fixed height - takes 60% of the explorer
    minHeight: '200px',
    backgroundColor: 'transparent',
    borderColor: isDarkTheme.value ? 'rgba(100, 100, 120, 0.3)' : 'rgba(200, 200, 220, 0.5)'
}))

const bottomSectionsStyle = computed(() => ({
    height: '40%', // Fixed height - takes remaining 40%
    maxHeight: '40%',
    overflow: 'hidden'
}))

const iconButtonStyle = computed(() => ({
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)',
    transition: 'color 0.2s ease'
}))

const dependenciesStyle = computed(() => ({
    borderColor: isDarkTheme.value ? 'rgba(100, 100, 120, 0.4)' : 'rgba(200, 200, 220, 0.6)',
    backgroundColor: isDarkTheme.value ? 'rgba(20, 20, 25, 0.4)' : 'rgba(245, 245, 250, 0.4)',
    flex: '1',
    minHeight: '0'
}))

const outlineStyle = computed(() => ({
    borderColor: isDarkTheme.value ? 'rgba(100, 100, 120, 0.4)' : 'rgba(200, 200, 220, 0.6)',
    backgroundColor: isDarkTheme.value ? 'rgba(20, 20, 25, 0.4)' : 'rgba(245, 245, 250, 0.4)',
    flex: '1',
    minHeight: '0'
}))

const dependencyItemStyle = computed(() => ({
    padding: '2px 6px',
    borderRadius: '4px',
    transition: 'background-color 0.2s ease'
}))

const outlineItemStyle = computed(() => ({
    padding: '2px 6px',
    borderRadius: '4px',
    transition: 'background-color 0.2s ease'
}))

// Methods
const toggleFolder = (folderId: string) => {
    if (expandedFolders.value.has(folderId)) {
        expandedFolders.value.delete(folderId)
    } else {
        expandedFolders.value.add(folderId)
    }
}

const collapseAll = () => {
    expandedFolders.value.clear()
}

const createFile = (parentId?: string) => {
    emit('create-file', parentId)
}

const createFolder = (parentId?: string) => {
    emit('create-folder', parentId)
}

const toggleDependencies = () => {
    dependenciesExpanded.value = !dependenciesExpanded.value
}

const toggleOutline = () => {
    outlineExpanded.value = !outlineExpanded.value
}

const getSymbolIcon = (type: string) => {
  switch (type) {
    case 'function':
      return SquareFunction
    case 'variable':
      return Variable
    case 'class':
    case 'component':
      return Box
    default:
      return Settings
  }
}

const jumpToSymbol = (symbol: CodeSymbol) => {
    // Emit event or use editor API to jump to symbol location
    console.log('Jumping to symbol:', symbol)
}

// Parse code for outline (simplified but improved)
const parseCodeForOutline = (code: string, language: string): CodeSymbol[] => {
    const symbols: CodeSymbol[] = []

    if (!code) return symbols

    const lines = code.split('\n')

    if (language === 'javascript' || language === 'react' || language === 'typescript' || language === 'typescriptreact') {
        lines.forEach((line, index) => {
            // Function declarations
            const funcMatch = line.match(/(?:function\s+|const\s+|let\s+|var\s+)(\w+)\s*(?:=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{|function))/);
            if (funcMatch) {
                symbols.push({
                    name: funcMatch[1],
                    type: 'function',
                    line: index + 1,
                    column: line.indexOf(funcMatch[1])
                })
            }

            // React components
            const componentMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>|\([^)]*\)\s*{)/);
            if (componentMatch && /^[A-Z]/.test(componentMatch[1])) {
                symbols.push({
                    name: componentMatch[1],
                    type: 'component',
                    line: index + 1,
                    column: line.indexOf(componentMatch[1])
                })
            }

            // Class declarations
            const classMatch = line.match(/class\s+(\w+)/);
            if (classMatch) {
                symbols.push({
                    name: classMatch[1],
                    type: 'class',
                    line: index + 1,
                    column: line.indexOf(classMatch[1])
                })
            }

            // Interface declarations (TypeScript)
            const interfaceMatch = line.match(/interface\s+(\w+)/);
            if (interfaceMatch) {
                symbols.push({
                    name: interfaceMatch[1],
                    type: 'interface',
                    line: index + 1,
                    column: line.indexOf(interfaceMatch[1])
                })
            }
        })
    }

    return symbols.slice(0, 10) // Limit to first 10 symbols to avoid crowding
}

// Watch for active file changes to update outline
watch(() => props.activeFileId, (newActiveFileId) => {
    if (newActiveFileId) {
        // Find the active file and parse its code
        const findFile = (files: FileItem[]): FileItem | null => {
            for (const file of files) {
                if (file.id === newActiveFileId) return file
                if (file.children) {
                    const found = findFile(file.children)
                    if (found) return found
                }
            }
            return null
        }

        const activeFile = findFile(props.files)
        if (activeFile && activeFile.code && activeFile.language) {
            outline.value = parseCodeForOutline(activeFile.code, activeFile.language)
        } else {
            outline.value = []
        }
    } else {
        outline.value = []
    }
}, { immediate: true })

onMounted(() => {
    // Initialize with default expanded folders
    expandedFolders.value.add('src')
    expandedFolders.value.add('public')
})
</script>

<style scoped>
.file-explorer {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    font-size: 13px;
}

.explorer-header {
    user-select: none;
}

.file-tree-container {
    position: relative;
}

.dependencies-section,
.outline-section {
    min-height: 0;
    overflow: hidden;
}

/* Better scrollbar styling */
.file-tree-container::-webkit-scrollbar,
.dependencies-section::-webkit-scrollbar,
.outline-section::-webkit-scrollbar {
    width: 6px;
}

.file-tree-container::-webkit-scrollbar-track,
.dependencies-section::-webkit-scrollbar-track,
.outline-section::-webkit-scrollbar-track {
    background: transparent;
}

.file-tree-container::-webkit-scrollbar-thumb,
.dependencies-section::-webkit-scrollbar-thumb,
.outline-section::-webkit-scrollbar-thumb {
    background: rgba(128, 128, 128, 0.4);
    border-radius: 3px;
}

.file-tree-container::-webkit-scrollbar-thumb:hover,
.dependencies-section::-webkit-scrollbar-thumb:hover,
.outline-section::-webkit-scrollbar-thumb:hover {
    background: rgba(128, 128, 128, 0.6);
}

/* Fade effect for scrollable content */
.dependencies-section .space-y-1,
.outline-section .space-y-1 {
    position: relative;
}

.dependencies-section .space-y-1::after,
.outline-section .space-y-1::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 10px;
    background: linear-gradient(transparent, var(--fallback-b1, oklch(var(--b1))));
    pointer-events: none;
}

/* Improved hover effects */
.p-1:hover {
    background-color: var(--fallback-b2, oklch(var(--b2) / 0.5)) !important;
}

.dependencies-section .flex:hover,
.outline-section .flex:hover {
    background-color: var(--fallback-b2, oklch(var(--b2) / 0.3));
}
</style>