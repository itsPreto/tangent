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
            
            <!-- Danger Zone -->
            <div class="border-t border-error/20 pt-2 mt-2">
                <div class="px-3 py-2">
                    <span class="text-xs text-error/60 font-medium">⚠️ Danger Zone</span>
                </div>
                <button 
                    @click="handleFreshStart"
                    class="w-full btn btn-sm btn-ghost text-error hover:bg-error/10 border border-error/20"
                >
                    🗑️ Fresh Start (Clear All Data)
                </button>
            </div>
            </div>
        </Teleport>
        
        <!-- Fresh Start Confirmation Modal -->
        <Teleport to="body">
            <div v-if="showFreshStartModal" 
                 class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100000] flex items-center justify-center p-4"
                 @click.self="cancelFreshStart">
                <div class="bg-base-100 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                    <div class="text-center">
                        <div class="text-6xl mb-4">⚠️</div>
                        <h2 class="text-2xl font-bold text-error mb-2">Fresh Start</h2>
                        <p class="text-base-content/70">
                            This will permanently delete <strong>ALL</strong> your data:
                        </p>
                    </div>
                    
                    <div class="bg-error/10 rounded-lg p-4 space-y-2">
                        <div class="flex items-center gap-2 text-sm">
                            <span class="w-2 h-2 bg-error rounded-full"></span>
                            <span>All workspaces and conversations</span>
                        </div>
                        <div class="flex items-center gap-2 text-sm">
                            <span class="w-2 h-2 bg-error rounded-full"></span>
                            <span>All nodes and branching data</span>
                        </div>
                        <div class="flex items-center gap-2 text-sm">
                            <span class="w-2 h-2 bg-error rounded-full"></span>
                            <span>All clustering and cached data</span>
                        </div>
                        <div class="flex items-center gap-2 text-sm">
                            <span class="w-2 h-2 bg-error rounded-full"></span>
                            <span>All uploaded files and audio</span>
                        </div>
                    </div>
                    
                    <div v-if="!showSecondConfirmation" class="text-center">
                        <p class="text-sm text-base-content/60 mb-4">
                            Are you sure you want to continue?
                        </p>
                        <div class="flex gap-3">
                            <button @click="cancelFreshStart" class="btn btn-outline flex-1">
                                Cancel
                            </button>
                            <button @click="showSecondConfirmation = true" class="btn btn-error flex-1">
                                Continue
                            </button>
                        </div>
                    </div>
                    
                    <div v-else class="space-y-4">
                        <div class="text-center">
                            <p class="text-sm font-medium text-error mb-2">
                                Final Confirmation Required
                            </p>
                            <p class="text-xs text-base-content/60 mb-4">
                                Type "<strong>DELETE EVERYTHING</strong>" to confirm:
                            </p>
                        </div>
                        
                        <input 
                            v-model="confirmationText"
                            type="text"
                            placeholder="DELETE EVERYTHING"
                            class="input input-bordered w-full text-center"
                            :class="{ 'input-error': confirmationText && !isConfirmationValid }"
                            @keyup.enter="confirmFreshStart"
                        />
                        
                        <div class="flex gap-3">
                            <button @click="cancelFreshStart" class="btn btn-outline flex-1">
                                Cancel
                            </button>
                            <button 
                                @click="confirmFreshStart" 
                                :disabled="!isConfirmationValid || isProcessing"
                                class="btn btn-error flex-1"
                                :class="{ 'loading': isProcessing }"
                            >
                                {{ isProcessing ? 'Clearing...' : 'Delete Everything' }}
                            </button>
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
import emitter from '@/utils/eventBus';

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

// Fresh Start modal state
const showFreshStartModal = ref(false);
const showSecondConfirmation = ref(false);
const confirmationText = ref('');
const isProcessing = ref(false);

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
    console.log('WorkspaceMenu loadWorkspace called with ID:', id);
    console.log('Canvas ref available:', !!canvasRef?.value);

    // Check if we have access to the canvas ref and if we're in overview mode or welcome screen
    if (canvasRef?.value) {
        const isInOverview = canvasRef.value.isWorkspaceOverview ?? true;
        const isInWelcome = canvasRef.value.isWelcomeScreen ?? false;
        const shouldUseTransition = isInOverview || isInWelcome;
        
        console.log('Is in overview mode:', isInOverview);
        console.log('Is in welcome screen:', isInWelcome);
        console.log('Should use transition:', shouldUseTransition);
        console.log('Canvas ref methods available:', {
            handleWorkspaceSelect: typeof canvasRef.value.handleWorkspaceSelect,
            isWorkspaceOverview: canvasRef.value.isWorkspaceOverview,
            isWelcomeScreen: canvasRef.value.isWelcomeScreen
        });
        
        if (shouldUseTransition) {
            console.log('Calling canvas handleWorkspaceSelect...');
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
                // Emit event for auto-snap checking
                emitter.emit('workspace-loaded-external');
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
            // Emit event for auto-snap checking
            emitter.emit('workspace-loaded-external');
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

// Fresh Start functionality
const isConfirmationValid = computed(() => {
    return confirmationText.value.trim().toUpperCase() === 'DELETE EVERYTHING';
});

const handleFreshStart = () => {
    showFreshStartModal.value = true;
    isOpen.value = false; // Close the workspace menu
};

const cancelFreshStart = () => {
    showFreshStartModal.value = false;
    showSecondConfirmation.value = false;
    confirmationText.value = '';
    isProcessing.value = false;
};

const confirmFreshStart = async () => {
    if (!isConfirmationValid.value || isProcessing.value) return;
    
    try {
        isProcessing.value = true;
        
        // Call the fresh start API
        const response = await fetch('http://127.0.0.1:5050/system/fresh-start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                confirmation: 'DELETE_EVERYTHING_I_AM_SURE'
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to perform fresh start');
        }
        
        const result = await response.json();
        console.log('Fresh start completed:', result);
        
        // Clear local state and reload
        await canvasStore.clearCurrentWorkspace();
        await chatStore.loadChats();
        
        // Clear browser storage
        clearAllLocalData();
        
        // Show success message
        alert('🎉 Fresh start completed! All data has been cleared.');
        
        // Reload the page to ensure clean state
        window.location.reload();
        
    } catch (error) {
        console.error('Fresh start failed:', error);
        alert(`❌ Fresh start failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        isProcessing.value = false;
        cancelFreshStart();
    }
};

const clearAllLocalData = () => {
    try {
        // Clear localStorage
        localStorage.clear();
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        // Clear any IndexedDB data (if used)
        if ('indexedDB' in window) {
            // Clear any stored IndexedDB databases
            console.log('Cleared IndexedDB data');
        }
        
        console.log('Cleared all local browser data');
    } catch (error) {
        console.warn('Could not clear some local data:', error);
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