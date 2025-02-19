<template>
    <div class="workspace-node transition-all duration-300"
         :class="[{'selected': isSelected, 'dragging': isDragging}]"
         :style="{transform: `translate(${workspace.x}px, ${workspace.y}px)`}"
         :data-workspace-id="workspace.id"
         @mousedown="handleMouseDown"
         @click.stop="handleClick">
      
      <div :class="[
        'workspace-card relative rounded-lg border',
        'transition-shadow duration-300',
        hover ? 'hover:shadow-xl hover:-translate-y-1' : '',
        customClasses,
        'bg-base-200',
        'text-base-content',
        'border-base-300',
        {'transform scale-110': workspace.isFavorite}
        ]"
        :style="{
        width: '300px',
        height: '200px',
        transform: workspace.isFavorite ? 'scale(1.2)' : 'none'
        }">
        <!-- Status Indicator -->
        <div class="absolute -top-1 -right-1">
          <div :class="[
            'w-3 h-3 rounded-full',
            {'animate-pulse': workspace.isActive},
            statusClass
          ]"></div>
        </div>
  
        <!-- Main Content Area -->
        <div class="p-4">
          <!-- Header with Title and Actions -->
          <div class="flex items-start justify-between gap-4 mb-4">
            <!-- Title and Branch Count -->
            <div class="flex-1">
              <!-- Title Section with Edit -->
                <!-- Title Section with Edit -->
                <div class="flex items-center gap-2 mb-2">
                    <input v-if="isEditing"
                        ref="titleInputRef"
                        v-model="titleInput"
                        @blur="handleTitleUpdate"
                        @keyup.enter="handleTitleUpdate"
                        class="input input-bordered w-full text-base-content"
                        :placeholder="'Enter workspace title...'"
                        type="text"/>
                    <template v-else>
                    <h3 class="text-lg font-semibold truncate">
                        {{ workspace.title || 'Untitled Workspace' }}
                    </h3>
                    <button @click.stop="startEditing"
                            class="btn btn-ghost btn-sm rounded-full p-1 text-base-content/60">
                        <Edit2 class="w-4 h-4"/>
                    </button>
                    </template>
                </div>
  
              <!-- Metadata Row -->
              <div class="flex items-center gap-4 text-sm text-base-content/60">
                <div class="flex items-center gap-1">
                  <MessageCircle class="w-4 h-4"/>
                  {{ workspace.nodeCount || 0 }} branches
                </div>
                <div class="flex items-center gap-1">
                  <Clock class="w-4 h-4"/>
                  {{ formatDate(workspace.lastUpdated) }}
                </div>
              </div>
            </div>
  
            <!-- Action Buttons -->
            <div class="flex flex-col items-end gap-2">
              
            <button @click.stop="handleFavorite"
                    class="btn btn-ghost btn-sm rounded-full p-1 transition-colors duration-200"
                    :title="workspace.isFavorite ? 'Remove from favorites' : 'Add to favorites'">
            <Star 
                class="w-5 h-5" 
                :class="{'text-yellow-400 fill-yellow-400': workspace.isFavorite}"
            />
            </button>
              <button @click.stop="showContextMenu = true"
                      class="btn btn-ghost btn-sm rounded-full p-1">
                <MoreVertical class="w-5 h-5"/>
              </button>
            </div>
          </div>
  
          <!-- Description Section -->
          <div class="mb-4">
            <div v-if="isEditingDesc" class="flex flex-col gap-2">
                <textarea
                    ref="descInputRef"
                    v-model="descInput"
                    @blur="handleDescUpdate"
                    class="textarea textarea-bordered w-full text-sm"
                    :placeholder="'Enter workspace description...'"
                    rows="3"
                />
                <div class="flex justify-end gap-2">
                    <button @click="isEditingDesc = false" class="btn btn-sm btn-ghost">Cancel</button>
                    <button @click="handleDescUpdate" class="btn btn-sm btn-primary">Save</button>
                </div>
            </div>
            <div v-else class="flex items-center justify-between group">
              <p class="text-sm text-base-content/80 flex-grow">
                {{ workspace.description || 'No description available.' }}
              </p>
              <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button @click.stop="startEditingDesc" 
                        class="btn btn-ghost btn-sm rounded-full p-1"
                        title="Edit description">
                  <Edit2 class="w-4 h-4"/>
                </button>
                <button @click.stop="generateAIDescription" 
                        class="btn btn-ghost btn-sm rounded-full p-1"
                        title="Generate AI description">
                  <Sparkles class="w-4 h-4"/>
                </button>
              </div>
            </div>
          </div>
  
          <!-- Tags Section -->
          <div class="flex flex-wrap gap-2">
            <button v-for="tag in workspace.tags" :key="tag.id"
                    :style="{ backgroundColor: tag.color, color: getContrastColor(tag.color) }"
                    class="badge badge-sm text-xs px-2 py-0.5">
              {{ tag.name }}
            </button>
            <button @click.stop="showTagEditor = true"
                    class="text-xs text-base-content/60 hover:text-base-content flex items-center gap-1">
              <Plus class="w-3 h-3"/> Add Tag
            </button>
          </div>
        </div>
  
        <!-- Progress Bar -->
        <div v-if="showProgress" class="absolute bottom-0 left-0 right-0 h-1 bg-base-200">
          <div class="h-full bg-primary transition-all duration-300"
               :style="{ width: `${progress}%` }"></div>
        </div>
      </div>
  
      <!-- Tag Editor Modal -->
      <Modal v-if="showTagEditor" @close="showTagEditor = false">
        <template #title>Manage Tags</template>
        <div class="space-y-4">
          <div v-for="tag in workspace.tags" :key="tag.id"
               class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <input type="color" v-model="tag.color" class="w-8 h-8"/>
              <input type="text" v-model="tag.name"
                     class="bg-base-200/50 px-2 py-1 rounded"/>
            </div>
            <button @click="removeTag(tag.id)" class="text-destructive">
              <Trash2 class="w-4 h-4"/>
            </button>
          </div>
          <button @click="addNewTag"
                  class="w-full py-2 px-4 rounded bg-primary/10 hover:bg-primary/20
                text-primary flex items-center justify-center gap-2">
            <Plus class="w-4 h-4"/> Add New Tag
          </button>
        </div>
      </Modal>
  
      <!-- Context Menu -->
      <ContextMenu v-if="showContextMenu"
                   :position="contextMenuPosition"
                   @close="showContextMenu = false">
        <button @click="$emit('duplicate')" class="context-menu-item">
          <Copy class="w-4 h-4"/> Duplicate
        </button>
        <button @click="$emit('archive')" class="context-menu-item">
          <Archive class="w-4 h-4"/> Archive
        </button>
        <button @click="$emit('export')" class="context-menu-item">
          <Download class="w-4 h-4"/> Export
        </button>
        <hr class="my-2 border-base-200"/>
        <button @click="$emit('delete')" class="context-menu-item text-destructive">
          <Trash2 class="w-4 h-4"/> Delete
        </button>
      </ContextMenu>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, computed, watch, nextTick } from 'vue';
  import {
    Edit2, MessageCircle, Clock, Star, MoreVertical,
    Plus, Trash2, Copy, Archive, Download, Sparkles
  } from 'lucide-vue-next';
  import Modal from '../../ui/Modal.vue';
  import ContextMenu from '../../ui/ContextMenu.vue';
    import { useCanvasStore } from '@/stores/canvasStore';
    import { useModelStore } from '@/stores/modelStore';

  
  // Props
  const props = defineProps({
    workspace: {
      type: Object,
      required: true
    },
    isSelected: Boolean,
    hover: {
      type: Boolean,
      default: true
    },
    customClasses: {
      type: String,
      default: ''
    },
    showProgress: Boolean,
    progress: {
      type: Number,
      default: 0
    }
  });
  
  // Emits
  const emit = defineEmits([
    'select',
    'update',
    'drag-start',
    'favorite',
    'duplicate',
    'archive',
    'export',
    'delete'
  ]);
  
  // State
  const isEditing = ref(false);
  const isEditingDesc = ref(false);
  const isDragging = ref(false);
  const showTagEditor = ref(false);
  const showContextMenu = ref(false);
  const contextMenuPosition = ref({ x: 0, y: 0 });

// Refs for input elements
    const titleInputRef = ref<HTMLInputElement | null>(null);
    const descInputRef = ref<HTMLTextAreaElement | null>(null);
    const titleInput = ref(props.workspace.title || '');
    const descInput = ref(props.workspace.description || '');

  const store = useCanvasStore();
  const modelStore = useModelStore();
  
  // Computed
  const statusClass = computed(() => {
    switch (props.workspace.status) {
      case 'active': return 'bg-green-500';
      case 'archived': return 'bg-gray-500';
      case 'draft': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  });
  
  // Methods
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      emit('drag-start', {
        id: props.workspace.id,
        offset: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }
      });
    }
  };
  
  const handleClick = () => {
    if (!isDragging.value) {
      emit('select', props.workspace.id);
    }
  };
  const startEditing = () => {
  isEditing.value = true;
  titleInput.value = props.workspace.title || '';
  nextTick(() => {
    if (titleInputRef.value) {
      titleInputRef.value.focus();
      titleInputRef.value.select();
    }
  });
};

const startEditingDesc = () => {
  isEditingDesc.value = true;
  descInput.value = props.workspace.description || '';
  nextTick(() => {
    if (descInputRef.value) {
      descInputRef.value.focus();
      descInputRef.value.select();
    }
  });
};

const handleTitleUpdate = () => {
  if (titleInput.value?.trim()) {
    emit('update', {
      id: props.workspace.id,
      title: titleInput.value.trim()
    });
  }
  isEditing.value = false;
};

const handleDescUpdate = () => {
  emit('update', {
    id: props.workspace.id,
    description: descInput.value?.trim() || ''
  });
  isEditingDesc.value = false;
};

const generateAIDescription = async () => {
  // Get current model and API key from the model store
  const currentModel = modelStore.selectedModel;
  const openRouterApiKey = localStorage.getItem('openRouterApiKey');
  
  if (!currentModel) {
    console.error('No model selected');
    return;
  }

  // Check for required API keys based on model source
  if (currentModel.source === 'openrouter' && !openRouterApiKey) {
    console.error('Missing OpenRouter API key');
    return;
  }

  const originalDesc = descInput.value;
  descInput.value = "AI is generating description...";
  
  try {
    // Create a temporary node to handle the message
    const tempNode = {
      id: 'temp-' + crypto.randomUUID(),
      messages: [],
      type: 'description',
      streamingContent: null
    };

    // Prepare context for description generation
    const prompt = `Generate a brief, clear description for a conversation workspace titled "${props.workspace.title}" that has ${props.workspace.nodeCount || 0} discussion branches.`;

    // Use the existing sendMessage logic
    const modelResponse = await store.sendMessage(
      tempNode.id,
      prompt,
      currentModel,
      openRouterApiKey || '',
      false // Don't add user message
    );

    if (modelResponse) {
      const generatedDesc = tempNode.messages[tempNode.messages.length - 1]?.content || '';
      descInput.value = generatedDesc;
      emit('update', {
        id: props.workspace.id,
        description: generatedDesc
      });
    }
  } catch (error) {
    console.error('Failed to generate AI description:', error);
    // Restore original description on error
    descInput.value = originalDesc;
  }
};
  const addNewTag = () => {
    const newTag = {
      id: crypto.randomUUID(),
      name: 'New Tag',
      color: '#' + Math.floor(Math.random() * 16777215).toString(16),
    };
    emit('update', {
      id: props.workspace.id,
      tags: [...props.workspace.tags, newTag]
    });
  };
  
  const removeTag = (tagId: string) => {
    emit('update', {
      id: props.workspace.id,
      tags: props.workspace.tags.filter(t => t.id !== tagId)
    });
  };

  const handleFavorite = () => {
  emit('favorite');
};
  
  const getContrastColor = (hexColor: string): string => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#FFFFFF';
  };
  
  // Watchers
  watch(() => props.workspace.title, (newTitle) => {
    titleInput.value = newTitle;
  });
  
  watch(() => props.workspace.description, (newDesc) => {
    descInput.value = newDesc;
  });
  </script>
  
  <style scoped>
  .workspace-node {
    position: absolute;
    user-select: none;
  }
  
  .selected {
    @apply ring-2 ring-primary ring-opacity-60;
  }
  
  /* Context menu styling */
  .context-menu-item {
    @apply flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-base-200/50 text-left;
  }
  
  /* Animation classes */
  .dragging {
    opacity: 0.8;
    cursor: grabbing;
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  </style>