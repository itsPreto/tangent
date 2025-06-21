<template>
    <div class="file-tree-item">
      <!-- File/Folder Row -->
      <div 
        class="file-row flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-base-content/5 rounded-sm"
        :class="{ 
          'bg-primary/20 text-primary': isActive,
          'bg-base-content/5': isSelected && !isActive
        }"
        :style="{ paddingLeft: `${8 + level * 16}px`, ...itemStyle }"
        @click="handleClick"
        @contextmenu="handleRightClick"
        @dblclick="handleDoubleClick"
      >
        <!-- Expand/Collapse Icon -->
        <div class="w-4 h-4 flex items-center justify-center expand-icon">
          <ChevronRight 
            v-if="item.type === 'folder'" 
            class="w-3 h-3 transition-transform" 
            :class="{ 'rotate-90': isExpanded }"
            :style="chevronStyle"
          />
        </div>
        
        <!-- File/Folder Icon -->
        <div class="w-4 h-4 flex items-center justify-center file-icon">
          <FileIcon 
            v-if="item.type === 'file'" 
            :filename="item.name" 
            class="w-4 h-4" 
          />
          <Folder 
            v-else 
            class="w-4 h-4" 
            :class="{ 'text-primary': isExpanded }"
            :style="folderIconStyle"
          />
        </div>
        
        <!-- File/Folder Name -->
        <span 
          v-if="!isRenaming"
          class="flex-1 text-sm truncate file-name"
          :style="nameStyle"
        >
          {{ item.name }}
        </span>
        
        <!-- Rename Input -->
        <input
          v-else
          ref="renameInput"
          v-model="renameValue"
          class="flex-1 text-sm bg-transparent border border-primary rounded px-1 py-0.5 outline-none"
          :style="renameInputStyle"
          @blur="handleRenameBlur"
          @keydown.enter="confirmRename"
          @keydown.esc="cancelRename"
          @click.stop
        />
        
        <!-- Action Icons (visible on hover) -->
        <div class="flex items-center gap-0.5 action-icons opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            v-if="item.type === 'folder'"
            @click.stop="$emit('create-file', item.id)"
            class="p-0.5 rounded hover:bg-base-content/10 transition-colors"
            :style="actionButtonStyle"
            title="New File"
          >
            <FilePlus class="w-3 h-3" />
          </button>
          
          <button
            v-if="item.type === 'folder'"
            @click.stop="$emit('create-folder', item.id)"
            class="p-0.5 rounded hover:bg-base-content/10 transition-colors"
            :style="actionButtonStyle"
            title="New Folder"
          >
            <FolderPlus class="w-3 h-3" />
          </button>
        </div>
      </div>
      
      <!-- Children (if folder is expanded) -->
      <div v-if="item.type === 'folder' && isExpanded && item.children" class="children">
        <FileTreeItem
          v-for="child in sortedChildren"
          :key="child.id"
          :item="child"
          :level="level + 1"
          :activeFileId="activeFileId"
          :expandedFolders="expandedFolders"
          :theme="theme"
          @select="$emit('select', $event)"
          @toggle-folder="$emit('toggle-folder', $event)"
          @create-file="$emit('create-file', $event)"
          @create-folder="$emit('create-folder', $event)"
          @delete="$emit('delete', $event)"
          @rename="$emit('rename', $event)"
        />
      </div>
      
      <!-- Context Menu -->
      <div
        v-if="showContextMenu"
        class="fixed z-50 bg-base-100 border border-base-content/20 rounded-md shadow-lg py-1 context-menu"
        :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px', ...contextMenuStyle }"
        @click="closeContextMenu"
      >
        <button
          v-if="item.type === 'folder'"
          @click="$emit('create-file', item.id)"
          class="w-full px-3 py-1.5 text-left text-sm hover:bg-base-content/10 flex items-center gap-2"
          :style="contextMenuItemStyle"
        >
          <FilePlus class="w-3.5 h-3.5" />
          New File
        </button>
        
        <button
          v-if="item.type === 'folder'"
          @click="$emit('create-folder', item.id)"
          class="w-full px-3 py-1.5 text-left text-sm hover:bg-base-content/10 flex items-center gap-2"
          :style="contextMenuItemStyle"
        >
          <FolderPlus class="w-3.5 h-3.5" />
          New Folder
        </button>
        
        <hr v-if="item.type === 'folder'" class="my-1 border-base-content/10" />
        
        <button
          @click="startRename"
          class="w-full px-3 py-1.5 text-left text-sm hover:bg-base-content/10 flex items-center gap-2"
          :style="contextMenuItemStyle"
        >
          <Edit class="w-3.5 h-3.5" />
          Rename
        </button>
        
        <button
          @click="$emit('delete', item)"
          class="w-full px-3 py-1.5 text-left text-sm hover:bg-red-500/10 text-red-500 flex items-center gap-2"
          :style="deleteMenuItemStyle"
        >
          <Trash class="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
  import { 
    ChevronRight, Folder, FilePlus, FolderPlus, 
    Edit, Trash
  } from 'lucide-vue-next'
  import FileIcon from './FileIcon.vue'
  
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
  
  interface Props {
    item: FileItem
    level: number
    activeFileId?: string | null
    expandedFolders: Set<string>
    theme: string
  }
  
  const props = withDefaults(defineProps<Props>(), {
    activeFileId: null
  })
  
  const emit = defineEmits<{
    'select': [file: FileItem]
    'toggle-folder': [folderId: string]
    'create-file': [parentId?: string]
    'create-folder': [parentId?: string]
    'delete': [item: FileItem]
    'rename': [item: FileItem, newName: string]
  }>()
  
  // State
  const isSelected = ref(false)
  const showContextMenu = ref(false)
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)
  const isRenaming = ref(false)
  const renameValue = ref('')
  const renameInput = ref<HTMLInputElement | null>(null)
  
  // Computed
  const isActive = computed(() => props.activeFileId === props.item.id)
  const isExpanded = computed(() => props.expandedFolders.has(props.item.id))
  
  const isDarkTheme = computed(() => {
    return props.theme === 'dark' || 
           props.theme === 'night' || 
           props.theme === 'coffee' ||
           props.theme === 'dracula' ||
           props.theme === 'synthwave' ||
           props.theme === 'cyberpunk'
  })
  
  const sortedChildren = computed(() => {
    if (!props.item.children) return []
    
    return [...props.item.children].sort((a, b) => {
      // Folders first, then files
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
      }
      // Alphabetical within type
      return a.name.localeCompare(b.name)
    })
  })
  
  // Styles
  const itemStyle = computed(() => ({
    transition: 'background-color 0.15s ease, color 0.15s ease'
  }))
  
  const chevronStyle = computed(() => ({
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'
  }))
  
  const folderIconStyle = computed(() => ({
    color: isExpanded.value 
      ? (isDarkTheme.value ? '#60a5fa' : '#3b82f6')
      : (isDarkTheme.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)')
  }))
  
  const nameStyle = computed(() => ({
    color: isActive.value 
      ? (isDarkTheme.value ? '#60a5fa' : '#3b82f6')
      : (isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)')
  }))
  
  const actionButtonStyle = computed(() => ({
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'
  }))
  
  const contextMenuStyle = computed(() => ({
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.98)' : 'rgba(255, 255, 255, 0.98)',
    borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.4)' : 'rgba(220, 220, 230, 0.6)',
    minWidth: '160px',
    backdropFilter: 'blur(8px)'
  }))
  
  const contextMenuItemStyle = computed(() => ({
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
  }))
  
  const deleteMenuItemStyle = computed(() => ({
    color: '#ef4444'
  }))
  
  const renameInputStyle = computed(() => ({
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    borderColor: isDarkTheme.value ? '#60a5fa' : '#3b82f6'
  }))
  
  // Methods
  const handleClick = () => {
    if (props.item.type === 'file') {
      emit('select', props.item)
    } else {
      emit('toggle-folder', props.item.id)
    }
    closeContextMenu()
  }
  
  const handleDoubleClick = () => {
    if (props.item.type === 'file') {
      emit('select', props.item)
    }
  }
  
  const handleRightClick = (event: MouseEvent) => {
    event.preventDefault()
    contextMenuX.value = event.clientX
    contextMenuY.value = event.clientY
    showContextMenu.value = true
    
    // Close menu when clicking outside
    nextTick(() => {
      document.addEventListener('click', closeContextMenu, { once: true })
    })
  }
  
  const closeContextMenu = () => {
    showContextMenu.value = false
  }
  
  const startRename = () => {
    isRenaming.value = true
    renameValue.value = props.item.name
    closeContextMenu()
    
    nextTick(() => {
      if (renameInput.value) {
        renameInput.value.focus()
        
        // Select filename without extension
        const dotIndex = renameValue.value.lastIndexOf('.')
        if (dotIndex > 0 && props.item.type === 'file') {
          renameInput.value.setSelectionRange(0, dotIndex)
        } else {
          renameInput.value.select()
        }
      }
    })
  }
  
  const confirmRename = () => {
    const newName = renameValue.value.trim()
    if (newName && newName !== props.item.name) {
      emit('rename', props.item, newName)
    }
    cancelRename()
  }
  
  const cancelRename = () => {
    isRenaming.value = false
    renameValue.value = ''
  }
  
  const handleRenameBlur = () => {
    // Small delay to allow for other events (like Enter key)
    setTimeout(cancelRename, 100)
  }
  
  // Handle keyboard shortcuts
  const handleKeyDown = (event: KeyboardEvent) => {
    if (isActive.value && !isRenaming.value) {
      if (event.key === 'F2') {
        event.preventDefault()
        startRename()
      } else if (event.key === 'Delete') {
        event.preventDefault()
        emit('delete', props.item)
      }
    }
  }
  
  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })
  
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })
  </script>
  
  <style scoped>
  .file-tree-item {
    user-select: none;
  }
  
  .file-row:hover .action-icons {
    opacity: 1;
  }
  
  .context-menu {
    animation: fadeIn 0.1s ease-out;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  /* Better text selection for rename input */
  .file-row input {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
  }
  </style>