<template>
    <div class="relative flex-shrink min-w-0">
        <!-- Main Button -->
        <button @click="isOpen = !isOpen" class="workspace-menu-button btn btn-sm gap-1 bg-base-200/90 backdrop-blur hover:bg-base-300/90 min-w-0 max-w-[150px] sm:max-w-[200px] flex items-center">
            <FolderOpen class="w-4 h-4 flex-shrink-0" />
            <span class="truncate flex-1 min-w-0 text-left">
                <span v-if="currentWorkspace">{{ currentWorkspace.title }}</span>
                <span v-else>Untitled</span>
            </span>
            <ChevronDown class="w-4 h-4 flex-shrink-0 transition-transform ml-auto" :class="{ 'rotate-180': isOpen }" />
        </button>

        <!-- Dropdown Menu -->
        <Teleport to="body">
            <div v-if="isOpen"
                class="fixed w-80 max-w-[calc(100vw-2rem)] bg-base-200/95 backdrop-blur border border-base-300 rounded-lg shadow-lg p-2 space-y-2"
                style="z-index: 99999;"
                :style="dropdownPosition"
                @click.stop>
            <!-- Save Current -->
            <div v-if="!currentWorkspace || isEditing" class="p-2">
                <input ref="titleInput" v-model="workspaceTitle" @keyup.enter="handleSave" class="input input-sm w-full"
                    :placeholder="currentWorkspace ? 'Rename workspace...' : 'Name your workspace...'" />
                <div class="flex justify-end gap-2 mt-2">
                    <button @click="isEditing = false" class="btn btn-sm btn-ghost">
                        Cancel
                    </button>
                    <button @click="handleSave" class="btn btn-sm btn-primary">
                        {{ currentWorkspace ? 'Rename' : 'Save' }}
                    </button>
                </div>
            </div>

            <!-- Quick Actions -->
            <div v-else class="flex gap-2 p-2">
                <button @click="isEditing = true" class="btn btn-sm btn-ghost flex-1">
                    {{ currentWorkspace ? 'Rename' : 'Save As...' }}
                </button>
                <button v-if="currentWorkspace" @click="handleCleanup"
                    class="btn btn-sm btn-ghost text-warning hover:bg-warning/10"
                    title="Clean up orphaned nodes">
                    🧹 Cleanup
                </button>
                <button v-if="currentWorkspace" @click="handleDelete"
                    class="btn btn-sm btn-ghost text-destructive hover:bg-destructive/10">
                    Delete
                </button>
            </div>

            <!-- Saved Workspaces -->
            <div v-if="savedWorkspaces.length" class="border-t border-base-300">
                <!-- Search and Sorting Controls -->
                <div class="py-2 px-3 space-y-2">
                    <!-- Sort Toggle -->
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-base-content/60">Workspaces</span>
                        <div class="join join-horizontal">
                            <button 
                                @click="sortBy = 'recent'"
                                class="join-item btn btn-xs"
                                :class="sortBy === 'recent' ? 'btn-primary' : 'btn-ghost'"
                            >
                                Recent
                            </button>
                            <button 
                                @click="sortBy = 'alphabetical'"
                                class="join-item btn btn-xs"
                                :class="sortBy === 'alphabetical' ? 'btn-primary' : 'btn-ghost'"
                            >
                                A-Z
                            </button>
                            <button 
                                @click="sortBy = 'size'"
                                class="join-item btn btn-xs"
                                :class="sortBy === 'size' ? 'btn-primary' : 'btn-ghost'"
                            >
                                Size
                            </button>
                        </div>
                    </div>
                    
                    <!-- Search Input -->
                    <input 
                        v-model="searchQuery" 
                        type="text" 
                        placeholder="Search workspaces..." 
                        class="input input-xs w-full bg-base-300/50 border-none"
                    />
                    
                    <!-- Filter Options - 3-way toggles -->
                    <div v-if="savedWorkspaces.length > 5" class="space-y-2">
                        <!-- Size Filter Toggle -->
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-base-content/60">Size</span>
                            <div class="join join-horizontal">
                                <button 
                                    @click="sizeFilter = sizeFilter === 'small' ? 'all' : 'small'"
                                    class="join-item btn btn-xs"
                                    :class="sizeFilter === 'small' ? 'btn-primary' : 'btn-ghost'"
                                >
                                    Small
                                </button>
                                <button 
                                    @click="sizeFilter = sizeFilter === 'medium' ? 'all' : 'medium'"
                                    class="join-item btn btn-xs"
                                    :class="sizeFilter === 'medium' ? 'btn-primary' : 'btn-ghost'"
                                >
                                    Medium
                                </button>
                                <button 
                                    @click="sizeFilter = sizeFilter === 'large' ? 'all' : 'large'"
                                    class="join-item btn btn-xs"
                                    :class="sizeFilter === 'large' ? 'btn-primary' : 'btn-ghost'"
                                >
                                    Large
                                </button>
                            </div>
                        </div>
                        
                        <!-- Age Filter Toggle -->
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-base-content/60">Age</span>
                            <div class="join join-horizontal">
                                <button 
                                    @click="ageFilter = ageFilter === 'recent' ? 'all' : 'recent'"
                                    class="join-item btn btn-xs"
                                    :class="ageFilter === 'recent' ? 'btn-primary' : 'btn-ghost'"
                                >
                                    Recent
                                </button>
                                <button 
                                    @click="ageFilter = ageFilter === 'week' ? 'all' : 'week'"
                                    class="join-item btn btn-xs"
                                    :class="ageFilter === 'week' ? 'btn-primary' : 'btn-ghost'"
                                >
                                    This Week
                                </button>
                                <button 
                                    @click="ageFilter = ageFilter === 'older' ? 'all' : 'older'"
                                    class="join-item btn btn-xs"
                                    :class="ageFilter === 'older' ? 'btn-primary' : 'btn-ghost'"
                                >
                                    Older
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Workspace List with Scrolling -->
                <div class="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-transparent">
                    <div v-for="workspace in filteredWorkspaces" :key="workspace.id" class="workspace-item">
                    <!-- Normal View -->
                    <div v-if="editingWorkspaceId !== workspace.id" 
                        class="flex items-center gap-2 w-full p-2 hover:bg-base-300/50 rounded-md transition-colors group"
                        :class="{ 'bg-primary/10': workspace.id === currentWorkspace?.id }">
                        <button @click="() => loadWorkspace(workspace.id)" class="flex-1 flex items-center gap-3 text-left">
                            <div class="flex-1">
                                <div class="font-medium">{{ workspace.title }}</div>
                                <div class="text-xs text-base-content/60">
                                    {{ formatWorkspaceInfo(workspace) }}
                                </div>
                            </div>
                            <ChevronRight class="w-4 h-4 text-base-content/40" />
                        </button>
                        <button @click="startInlineEdit(workspace.id)" 
                            class="btn btn-xs btn-ghost opacity-0 group-hover:opacity-100 transition-opacity p-1"
                            title="Edit name">
                            <EditIcon class="w-3 h-3" />
                        </button>
                    </div>
                    
                    <!-- Inline Edit View -->
                    <div v-else class="p-2">
                        <input 
                            ref="inlineEditInput"
                            v-model="workspaceTitle" 
                            @keyup.enter="handleInlineEditSave"
                            @keyup.escape="cancelInlineEdit"
                            class="input input-xs w-full mb-2"
                            :placeholder="workspace.title" />
                        <div class="flex justify-end gap-1">
                            <button @click="cancelInlineEdit" class="btn btn-xs btn-ghost">Cancel</button>
                            <button @click="handleInlineEditSave" class="btn btn-xs btn-primary">Save</button>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
            </div>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, onBeforeUnmount, inject } from 'vue';
import { FolderOpen, ChevronDown, ChevronRight, Edit as EditIcon } from 'lucide-vue-next';
import { useCanvasStore } from '@/stores/canvasStore';
import { useChatStore } from '@/stores/chatStore';

const canvasStore = useCanvasStore();
const chatStore = useChatStore();

const emit = defineEmits(['workspace-loaded', 'new-workspace']);

// Inject canvas ref from parent to handle overview transitions
const canvasRef = inject<any>('canvasRef', null);

onMounted(async () => {
    await chatStore.loadChats();
    document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside);
});

const isOpen = ref(false);
const isEditing = ref(false);
const workspaceTitle = ref('');
const titleInput = ref<HTMLInputElement>();
const editingWorkspaceId = ref<string | null>(null);
const sortBy = ref<'recent' | 'alphabetical' | 'size'>(localStorage.getItem('workspaceSortBy') as any || 'recent');
const inlineEditInput = ref<HTMLInputElement>();
const searchQuery = ref('');
const sizeFilter = ref<'all' | 'small' | 'medium' | 'large'>('all');
const ageFilter = ref<'all' | 'recent' | 'week' | 'older'>('all');

const handleClickOutside = (event: Event) => {
    const target = event.target as HTMLElement;
    if (isOpen.value && !target.closest('.relative')) {
        isOpen.value = false;
    }
};

const dropdownPosition = ref({});

const updateDropdownPosition = () => {
    if (typeof window === 'undefined') return;
    
    const button = document.querySelector('.workspace-menu-button');
    if (!button) return;
    
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const dropdownWidth = 320; // 20rem (w-80)
    
    let left = rect.left;
    if (left + dropdownWidth > viewportWidth - 16) {
        left = viewportWidth - dropdownWidth - 16;
    }
    
    dropdownPosition.value = {
        top: `${rect.bottom + 8}px`,
        left: `${Math.max(16, left)}px`
    };
};

watch(isOpen, (newValue) => {
    if (newValue) {
        nextTick(() => {
            updateDropdownPosition();
        });
    }
});

const savedWorkspaces = computed(() => {
    let sorted = [...chatStore.chats];
    
    switch (sortBy.value) {
        case 'alphabetical':
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'size':
            // Sort by node count (if available in metadata, otherwise use message count as proxy)
            sorted.sort((a, b) => {
                const aSize = a.nodeCount || 0;
                const bSize = b.nodeCount || 0;
                return bSize - aSize;
            });
            break;
        case 'recent':
        default:
            sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            break;
    }
    
    return sorted;
});

const filteredWorkspaces = computed(() => {
    let workspaces = savedWorkspaces.value;
    
    // Apply search filter
    if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase().trim();
        workspaces = workspaces.filter(workspace => 
            workspace.title.toLowerCase().includes(query)
        );
    }
    
    // Apply size filter
    if (sizeFilter.value !== 'all') {
        workspaces = workspaces.filter(workspace => {
            const nodeCount = workspace.nodeCount || 0;
            switch (sizeFilter.value) {
                case 'small': return nodeCount < 5;
                case 'medium': return nodeCount >= 5 && nodeCount <= 20;
                case 'large': return nodeCount > 20;
                default: return true;
            }
        });
    }
    
    // Apply age filter
    if (ageFilter.value !== 'all') {
        workspaces = workspaces.filter(workspace => {
            const updatedAt = new Date(workspace.updatedAt);
            const now = new Date();
            const daysDiff = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
            
            switch (ageFilter.value) {
                case 'recent': return daysDiff <= 2;
                case 'week': return daysDiff <= 7;
                case 'older': return daysDiff > 7;
                default: return true;
            }
        });
    }
    
    return workspaces;
});

const currentWorkspace = computed(() => {
    if (!canvasStore.lastSavedWorkspaceId) {
        return null;
    }
    const workspace = chatStore.chats.find(
        chat => chat.id === canvasStore.lastSavedWorkspaceId
    );

    return workspace;
});

const handleSave = async () => {
    if (!workspaceTitle.value.trim()) return;
    
    try {
        if (currentWorkspace.value) {
            // We're renaming an existing workspace
            const success = await chatStore.updateChatMetadata(currentWorkspace.value.id, {
                title: workspaceTitle.value.trim()
            });
            
            if (success) {
                await chatStore.loadChats();
                workspaceTitle.value = '';
                isEditing.value = false;
                isOpen.value = false;
            }
        } else {
            // We're creating a new workspace
            const workspaceId = await canvasStore.saveWorkspace(workspaceTitle.value);
            if (workspaceId) {
                await chatStore.loadChats();
                workspaceTitle.value = '';
                isEditing.value = false;
                isOpen.value = false;
                await loadWorkspace(workspaceId);
            }
        }
    } catch (error) {
        console.error('Error saving workspace:', error);
    }
};

const openNewWorkspaceEditor = () => {
    isEditing.value = true;
    nextTick(() => {
        titleInput.value?.focus();
    });
};

const startEditing = (workspaceId: string) => {
    const workspace = chatStore.chats.find(chat => chat.id === workspaceId);
    if (workspace) {
        workspaceTitle.value = workspace.title;
        isEditing.value = true;
        nextTick(() => {
            titleInput.value?.focus();
            titleInput.value?.select();
        });
    }
};

// Inline editing functions
const startInlineEdit = (workspaceId: string) => {
    const workspace = chatStore.chats.find(chat => chat.id === workspaceId);
    if (workspace) {
        editingWorkspaceId.value = workspaceId;
        workspaceTitle.value = workspace.title;
        nextTick(() => {
            inlineEditInput.value?.focus();
            inlineEditInput.value?.select();
        });
    }
};

const cancelInlineEdit = () => {
    editingWorkspaceId.value = null;
    workspaceTitle.value = '';
};

const handleInlineEditSave = async () => {
    if (!workspaceTitle.value.trim() || !editingWorkspaceId.value) return;
    
    try {
        const success = await chatStore.updateChatMetadata(editingWorkspaceId.value, {
            title: workspaceTitle.value.trim()
        });
        
        if (success) {
            await chatStore.loadChats();
            editingWorkspaceId.value = null;
            workspaceTitle.value = '';
        }
    } catch (error) {
        console.error('Error updating workspace name:', error);
    }
};

// Format workspace info based on sort type
const formatWorkspaceInfo = (workspace: any) => {
    const date = new Date(workspace.updatedAt).toLocaleDateString();
    const nodeCount = workspace.nodeCount || 0;
    const nodeText = nodeCount === 1 ? 'node' : 'nodes';
    
    switch (sortBy.value) {
        case 'size':
            return `${nodeCount} ${nodeText} • ${date}`;
        case 'alphabetical':
            return `${nodeCount} ${nodeText} • ${date}`;
        case 'recent':
        default:
            return `${date} • ${nodeCount} ${nodeText}`;
    }
};

// Watch for sort changes and persist to localStorage
watch(sortBy, (newValue) => {
    localStorage.setItem('workspaceSortBy', newValue);
});

const loadWorkspace = async (id: string) => {
    isOpen.value = false;

    // Check if we have access to the canvas ref and if we're in overview mode
    if (canvasRef?.value) {
        const isInOverview = canvasRef.value.isWorkspaceOverview ?? true;
        
        if (isInOverview) {
            // Use the canvas's workspace selection method to properly transition
            await canvasRef.value.handleWorkspaceSelect(id);
        } else {
            // We're already in a workspace, just switch to the new one
            await canvasStore.clearCurrentWorkspace();
            const success = await canvasStore.loadChatState(id);
            if (success) {
                canvasStore.lastSavedWorkspaceId = id;
                await nextTick();
                emit('workspace-loaded');
            }
        }
    } else {
        // Fallback to the original method if canvas ref is not available
        await canvasStore.clearCurrentWorkspace();
        const success = await canvasStore.loadChatState(id);
        if (success) {
            canvasStore.lastSavedWorkspaceId = id;
            await nextTick();
            emit('workspace-loaded');
        }
    }
};

const handleDelete = async () => {
    if (!currentWorkspace.value) return;

    if (confirm('Delete this workspace? This cannot be undone.')) {
        await chatStore.deleteChat(currentWorkspace.value.id);
        await canvasStore.clearCurrentWorkspace();
        await chatStore.loadChats();
        isOpen.value = false;
    }
};

const handleCleanup = async () => {
    if (!currentWorkspace.value) return;

    try {
        // First check integrity
        const integrityCheck = await chatStore.checkNodeIntegrity(currentWorkspace.value.id);
        
        if (integrityCheck && integrityCheck.orphaned_nodes > 0) {
            const message = `Found ${integrityCheck.orphaned_nodes} orphaned nodes.\n\nDo you want to clean them up? This will remove nodes that have invalid parent references.`;
            
            if (confirm(message)) {
                const result = await chatStore.cleanupOrphanedNodes(currentWorkspace.value.id);
                
                if (result && result.cleaned_nodes > 0) {
                    alert(`Successfully cleaned up ${result.cleaned_nodes} orphaned nodes!`);
                    
                    // Reload the workspace to reflect changes
                    await chatStore.loadChats();
                    
                    // If this is the current workspace, reload it
                    if (canvasStore.lastSavedWorkspaceId === currentWorkspace.value.id) {
                        await canvasStore.loadChatState(currentWorkspace.value.id);
                    }
                } else {
                    alert('No nodes were cleaned up.');
                }
            }
        } else {
            alert('No orphaned nodes found. Workspace is clean!');
        }
    } catch (error) {
        console.error('Error during cleanup:', error);
        alert('Error during cleanup. Check console for details.');
    }
};

watch(isEditing, async (newValue) => {
    if (newValue) {
        workspaceTitle.value = currentWorkspace.value?.title || '';
        await nextTick();
        titleInput.value?.focus();
    }
});

defineExpose({ openNewWorkspaceEditor });
</script>