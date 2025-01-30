<template>
    <div class="relative">
        <!-- Main Button -->
        <button @click="isOpen = !isOpen" class="btn btn-sm gap-2 bg-base-200/90 backdrop-blur hover:bg-base-300/90">
            <FolderOpen class="w-4 h-4" />
            <span v-if="currentWorkspace">{{ currentWorkspace.title }}</span>
            <span v-else>Untitled Workspace</span>
            <ChevronDown class="w-4 h-4 transition-transform" :class="{ 'rotate-180': isOpen }" />
        </button>

        <!-- Dropdown Menu -->
        <div v-if="isOpen"
            class="absolute top-full mt-2 left-0 w-80 bg-base-200/95 backdrop-blur border border-base-300 rounded-lg shadow-lg p-2 space-y-2"
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
                <button v-if="currentWorkspace" @click="handleDelete"
                    class="btn btn-sm btn-ghost text-destructive hover:bg-destructive/10">
                    Delete
                </button>
            </div>

            <!-- Saved Workspaces -->
            <div v-if="savedWorkspaces.length" class="border-t border-base-300">
                <div class="py-2 px-3 text-sm text-base-content/60">
                    Recent Workspaces
                </div>
                <button v-for="workspace in savedWorkspaces" :key="workspace.id"
                    @click="() => loadWorkspace(workspace.id)"
                    class="flex items-center gap-3 w-full p-2 hover:bg-base-300/50 rounded-md transition-colors"
                    :class="{ 'bg-primary/10': workspace.id === currentWorkspace?.id }">
                    <div class="flex-1 text-left">
                        <div class="font-medium">{{ workspace.title }}</div>
                        <div class="text-xs text-base-content/60">
                            {{ new Date(workspace.updatedAt).toLocaleString() }}
                        </div>
                    </div>
                    <ChevronRight class="w-4 h-4 text-base-content/40" />
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, onBeforeUnmount } from 'vue';
import { FolderOpen, ChevronDown, ChevronRight } from 'lucide-vue-next';
import { useCanvasStore } from '@/stores/canvasStore';
import { useChatStore } from '@/stores/chatStore';

const canvasStore = useCanvasStore();
const chatStore = useChatStore();

const emit = defineEmits(['workspace-loaded']);

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

const handleClickOutside = (event: Event) => {
    const target = event.target as HTMLElement;
    if (isOpen.value && !target.closest('.relative')) {
        isOpen.value = false;
    }
};

const savedWorkspaces = computed(() =>
    chatStore.chats.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
);

const currentWorkspace = computed(() => {
  // Only show current workspace if we're not in overview mode
  if (canvasStore.isOverviewMode) {
    return null;
  }
  return chatStore.chats.find(chat => chat.id === canvasStore.lastSavedWorkspaceId);
});

const handleSave = async () => {
    if (!workspaceTitle.value.trim()) return;

    const workspaceId = await canvasStore.saveWorkspace(workspaceTitle.value);
    if (workspaceId) {
        await chatStore.loadChats();
        workspaceTitle.value = '';
        isEditing.value = false;
        isOpen.value = false;
        await loadWorkspace(workspaceId);
    }
};

const loadWorkspace = async (id: string) => {
    isOpen.value = false;

    // Clear previous state first
    await canvasStore.clearCurrentWorkspace();

    // Then load new state
    const success = await canvasStore.loadChatState(id);
    if (success) {
        canvasStore.lastSavedWorkspaceId = id;
        emit('workspace-loaded');

        await nextTick();
        emit('workspace-loaded');
    }
};

const handleDelete = async () => {
    if (!currentWorkspace.value) return;

    if (await window.confirm('Delete this workspace? This cannot be undone.')) {
        await chatStore.deleteChat(currentWorkspace.value.id);
        canvasStore.lastSavedWorkspaceId = null;
        isOpen.value = false;
    }
};

watch(isEditing, async (newValue) => {
    if (newValue) {
        workspaceTitle.value = currentWorkspace.value?.title || '';
        await nextTick();
        titleInput.value?.focus();
    }
});
</script>