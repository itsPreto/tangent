<template>
    <div class="workspace-overview w-full h-full relative">
        <!-- Background Pattern -->
        <div class="absolute inset-0 workspace-grid" :style="gridStyle"></div>

        <!-- Welcome Section -->
        <div v-if="workspaces.length === 0" class="absolute inset-0 flex items-center justify-center">
            <div class="text-center welcome-section">
                <div class="mb-8">
                    <div class="welcome-icon mx-auto mb-4">
                        <Sparkles class="w-16 h-16 text-primary" />
                    </div>
                    <h1 class="text-4xl font-bold mb-4 text-primary">Welcome to Tangent</h1>
                    <p class="text-lg opacity-70 max-w-md mx-auto">
                        Create your first workspace to start exploring ideas and building knowledge networks.
                    </p>
                </div>

                <button @click="handleCreateFirst" class="btn btn-primary btn-lg create-first-btn">
                    <Plus class="w-5 h-5 mr-2" />
                    Create Your First Workspace
                </button>

                <div class="mt-8 grid grid-cols-2 gap-4 max-w-md mx-auto text-sm opacity-60">
                    <div class="flex items-center gap-2">
                        <MessageSquare class="w-4 h-4" />
                        <span>AI Conversations</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <GitBranch class="w-4 h-4" />
                        <span>Branching Dialogues</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <Code class="w-4 h-4" />
                        <span>Code Generation</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <Share2 class="w-4 h-4" />
                        <span>Knowledge Sharing</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Workspace Grid -->
        <div v-else class="workspace-container" :style="containerStyle">
            <div v-for="workspace in visibleWorkspaces" :key="workspace.id"
                class="workspace-flower absolute cursor-pointer transition-all duration-300" :class="{
                    'workspace-selected': selectedWorkspaceId === workspace.id,
                    'workspace-hovered': hoveredWorkspaceId === workspace.id
                }" :style="getWorkspaceStyle(workspace)" @click="handleWorkspaceClick(workspace)"
                @mouseenter="hoveredWorkspaceId = workspace.id" @mouseleave="hoveredWorkspaceId = null"
                @contextmenu.prevent="handleWorkspaceContextMenu(workspace, $event)">
                <!-- Workspace Flower Visualization -->
                <FlowerWorkspaceNode :workspace="workspace" :is-selected="selectedWorkspaceId === workspace.id"
                    :is-hovered="hoveredWorkspaceId === workspace.id" :zoom="zoom" />

                <!-- Workspace Info Overlay -->
                <div class="workspace-info absolute top-full left-1/2 transform -translate-x-1/2 mt-2" :class="{
                    'opacity-100': hoveredWorkspaceId === workspace.id || selectedWorkspaceId === workspace.id,
                    'opacity-0': hoveredWorkspaceId !== workspace.id && selectedWorkspaceId !== workspace.id
                }">
                    <div class="bg-base-100 rounded-lg shadow-lg p-3 min-w-48 workspace-card">
                        <h3 class="font-semibold text-sm mb-1 truncate">{{ workspace.title }}</h3>
                        <div class="flex items-center gap-4 text-xs opacity-70">
                            <span class="flex items-center gap-1">
                                <MessageSquare class="w-3 h-3" />
                                {{ workspace.nodeCount || 0 }}
                            </span>
                            <span class="flex items-center gap-1">
                                <Clock class="w-3 h-3" />
                                {{ formatDate(workspace.lastUpdated) }}
                            </span>
                        </div>
                        <div v-if="workspace.tags?.length" class="flex gap-1 mt-2">
                            <span v-for="tag in workspace.tags.slice(0, 3)" :key="tag"
                                class="px-2 py-0.5 bg-primary/20 text-primary rounded text-xs">
                                {{ tag }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Create New Workspace Button -->
        <button v-if="workspaces.length > 0" @click="handleCreateNew"
            class="fixed bottom-8 right-8 btn btn-primary btn-circle btn-lg create-new-btn shadow-xl"
            :style="createButtonStyle">
            <Plus class="w-6 h-6" />
        </button>

        <!-- Context Menu -->
        <div v-if="contextMenu.visible" class="fixed z-50 bg-base-100 rounded-lg shadow-xl border context-menu" :style="{
            top: contextMenu.y + 'px',
            left: contextMenu.x + 'px'
        }">
            <button @click="handleRenameWorkspace" class="w-full px-4 py-2 text-left hover:bg-base-200 rounded-t-lg">
                <Edit class="w-4 h-4 inline mr-2" />
                Rename
            </button>
            <button @click="handleDuplicateWorkspace" class="w-full px-4 py-2 text-left hover:bg-base-200">
                <Copy class="w-4 h-4 inline mr-2" />
                Duplicate
            </button>
            <button @click="handleToggleFavorite" class="w-full px-4 py-2 text-left hover:bg-base-200">
                <Heart class="w-4 h-4 inline mr-2"
                    :class="{ 'fill-red-500 text-red-500': contextMenu.workspace?.isFavorite }" />
                {{ contextMenu.workspace?.isFavorite ? 'Unfavorite' : 'Favorite' }}
            </button>
            <div class="border-t border-base-300"></div>
            <button @click="handleDeleteWorkspace"
                class="w-full px-4 py-2 text-left hover:bg-red-500/10 text-red-500 rounded-b-lg">
                <Trash class="w-4 h-4 inline mr-2" />
                Delete
            </button>
        </div>

        <!-- Overlay to close context menu -->
        <div v-if="contextMenu.visible" class="fixed inset-0 z-40" @click="closeContextMenu"></div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
    Plus, Sparkles, MessageSquare, GitBranch, Code, Share2,
    Clock, Edit, Copy, Heart, Trash
} from 'lucide-vue-next'
import FlowerWorkspaceNode from '../canvas/node/FlowerWorkspaceNode.vue'
import type { Workspace, Viewport } from '@/types/canvas'

// Props
interface Props {
    workspaces: Workspace[]
    viewport: Viewport
    zoom: number
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
    'workspace-select': [workspaceId: string]
    'workspace-create': []
}>()

// State
const selectedWorkspaceId = ref<string | null>(null)
const hoveredWorkspaceId = ref<string | null>(null)
const contextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    workspace: null as Workspace | null
})

// Computed
const visibleWorkspaces = computed(() => {
    // Filter workspaces that are visible in current viewport
    const margin = 200 // Extra margin for smooth scrolling
    const viewportBounds = {
        left: -props.viewport.x - margin,
        right: -props.viewport.x + window.innerWidth + margin,
        top: -props.viewport.y - margin,
        bottom: -props.viewport.y + window.innerHeight + margin
    }

    return props.workspaces.filter(workspace => {
        const x = workspace.x || 0
        const y = workspace.y || 0
        const size = 120 * props.zoom // Approximate workspace size

        return (
            x + size >= viewportBounds.left &&
            x - size <= viewportBounds.right &&
            y + size >= viewportBounds.top &&
            y - size <= viewportBounds.bottom
        )
    })
})

const containerStyle = computed(() => ({
    transform: `translate(${props.viewport.x}px, ${props.viewport.y}px) scale(${props.zoom})`,
    transformOrigin: 'top left'
}))

const gridStyle = computed(() => {
    const gridSize = 50 * props.zoom
    const offsetX = props.viewport.x % gridSize
    const offsetY = props.viewport.y % gridSize

    return {
        backgroundImage: `
        linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
      `,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `${offsetX}px ${offsetY}px`,
        opacity: 0.3
    }
})

const createButtonStyle = computed(() => ({
    transform: `scale(${Math.max(0.8, Math.min(1.2, 1 / props.zoom))})`,
    transformOrigin: 'center'
}))

// Methods
const getWorkspaceStyle = (workspace: Workspace) => ({
    left: `${workspace.x || 0}px`,
    top: `${workspace.y || 0}px`,
    zIndex: selectedWorkspaceId.value === workspace.id ? 10 :
        hoveredWorkspaceId.value === workspace.id ? 5 : 1
})

const handleWorkspaceClick = (workspace: Workspace) => {
    if (selectedWorkspaceId.value === workspace.id) {
        // Double-click behavior - open workspace
        emit('workspace-select', workspace.id)
    } else {
        // Single click - select workspace
        selectedWorkspaceId.value = workspace.id
        setTimeout(() => {
            if (selectedWorkspaceId.value === workspace.id) {
                emit('workspace-select', workspace.id)
            }
        }, 300) // Short delay for double-click detection
    }
}

const handleCreateFirst = () => {
    emit('workspace-create')
}

const handleCreateNew = () => {
    emit('workspace-create')
}

const handleWorkspaceContextMenu = (workspace: Workspace, event: MouseEvent) => {
    contextMenu.value = {
        visible: true,
        x: event.clientX,
        y: event.clientY,
        workspace
    }
}

const closeContextMenu = () => {
    contextMenu.value.visible = false
}

const handleRenameWorkspace = () => {
    if (contextMenu.value.workspace) {
        const newTitle = prompt('Enter new workspace name:', contextMenu.value.workspace.title)
        if (newTitle && newTitle.trim()) {
            // Emit rename event or handle through store
            console.log('Rename workspace:', contextMenu.value.workspace.id, 'to:', newTitle)
        }
    }
    closeContextMenu()
}

const handleDuplicateWorkspace = () => {
    if (contextMenu.value.workspace) {
        // Emit duplicate event or handle through store
        console.log('Duplicate workspace:', contextMenu.value.workspace.id)
    }
    closeContextMenu()
}

const handleToggleFavorite = () => {
    if (contextMenu.value.workspace) {
        // Emit favorite toggle event or handle through store
        console.log('Toggle favorite:', contextMenu.value.workspace.id)
    }
    closeContextMenu()
}

const handleDeleteWorkspace = () => {
    if (contextMenu.value.workspace) {
        const confirmed = confirm(`Are you sure you want to delete "${contextMenu.value.workspace.title}"?`)
        if (confirmed) {
            // Emit delete event or handle through store
            console.log('Delete workspace:', contextMenu.value.workspace.id)
        }
    }
    closeContextMenu()
}

const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`

    return date.toLocaleDateString()
}

// Lifecycle
onMounted(() => {
    document.addEventListener('click', closeContextMenu)
})

onBeforeUnmount(() => {
    document.removeEventListener('click', closeContextMenu)
})
</script>

<style scoped>
.workspace-overview {
    background: radial-gradient(circle at center, rgba(0, 0, 0, 0.02) 0%, transparent 70%);
}

.workspace-grid {
    background-blend-mode: multiply;
}

.welcome-section {
    animation: fadeInUp 0.8s ease-out;
}

.welcome-icon {
    animation: pulse 2s ease-in-out infinite;
}

.create-first-btn {
    animation: glow 2s ease-in-out infinite alternate;
}

.workspace-flower {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.workspace-flower:hover {
    transform: scale(1.1);
    filter: brightness(1.1);
}

.workspace-selected {
    transform: scale(1.15) !important;
    filter: brightness(1.2) drop-shadow(0 0 20px rgba(59, 130, 246, 0.5));
}

.workspace-info {
    transition: opacity 0.2s ease;
    pointer-events: none;
}

.workspace-card {
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.create-new-btn {
    animation: breathe 3s ease-in-out infinite;
}

.context-menu {
    min-width: 160px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes pulse {

    0%,
    100% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.05);
    }
}

@keyframes glow {
    from {
        box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
    }

    to {
        box-shadow: 0 0 30px rgba(59, 130, 246, 0.6);
    }
}

/* Theme-specific styles */
.theme-cyberpunk .workspace-card {
    background: rgba(0, 0, 0, 0.8);
    border-color: theme(colors.primary);
    box-shadow: 0 0 15px theme(colors.primary/30);
}

.theme-synthwave .workspace-card {
    background: rgba(30, 10, 50, 0.9);
    border-color: theme(colors.secondary);
    box-shadow: 0 0 15px theme(colors.secondary/30);
}

@keyframes breathe {

    0%,
    100% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.05);
    }
}

</style>