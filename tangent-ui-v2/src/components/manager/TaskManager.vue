<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { Plus, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-vue-next';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  type: 'feature' | 'bug';
  dateCreated: string;
  dateUpdated: string;
}

const tasks = ref<Task[]>([]);
const showNewTaskForm = ref(false);
const newTask = ref({
  title: '',
  description: '',
  type: 'feature' as const
});
const expandedTaskId = ref<string | null>(null);
const filterStatus = ref<Task['status'] | 'all'>('all');
const filterType = ref<Task['type'] | 'all'>('all');

const addTask = () => {
  if (!newTask.value.title.trim()) return;
  
  const now = new Date().toISOString();
  tasks.value.unshift({
    id: crypto.randomUUID(),
    title: newTask.value.title,
    description: newTask.value.description,
    status: 'todo',
    type: newTask.value.type,
    dateCreated: now,
    dateUpdated: now
  });
  
  newTask.value = {
    title: '',
    description: '',
    type: 'feature'
  };
  showNewTaskForm.value = false;
};

const cancelNewTask = () => {
  newTask.value = {
    title: '',
    description: '',
    type: 'feature'
  };
  showNewTaskForm.value = false;
};

const deleteTask = (taskId: string) => {
  tasks.value = tasks.value.filter(task => task.id !== taskId);
  if (expandedTaskId.value === taskId) {
    expandedTaskId.value = null;
  }
};

const updateTaskStatus = (task: Task, status: Task['status']) => {
  task.status = status;
  task.dateUpdated = new Date().toISOString();
};

const toggleExpand = (taskId: string) => {
  expandedTaskId.value = expandedTaskId.value === taskId ? null : taskId;
};

const filteredTasks = computed(() => {
  return tasks.value.filter(task => {
    const statusMatch = filterStatus.value === 'all' || task.status === filterStatus.value;
    const typeMatch = filterType.value === 'all' || task.type === filterType.value;
    return statusMatch && typeMatch;
  });
});

const getStatusColor = (status: Task['status']) => {
  switch (status) {
    case 'todo': return 'bg-blue-500/10 text-blue-500';
    case 'in-progress': return 'bg-yellow-500/10 text-yellow-500';
    case 'done': return 'bg-green-500/10 text-green-500';
  }
};

onMounted(() => {
  const savedTasks = localStorage.getItem('projectTasks');
  if (savedTasks) tasks.value = JSON.parse(savedTasks);
});

watch(tasks, (newTasks) => {
  localStorage.setItem('projectTasks', JSON.stringify(newTasks));
}, { deep: true });
</script>

<template>
  <div class="space-y-6">
    <!-- Header with New Task Button -->
    <div class="flex justify-between items-center">
      <div class="flex gap-2 text-sm">
        <select v-model="filterStatus" class="select select-sm select-bordered">
          <option value="all">All Status</option>
          <option value="todo">Todo</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <select v-model="filterType" class="select select-sm select-bordered">
          <option value="all">All Types</option>
          <option value="feature">Features</option>
          <option value="bug">Bugs</option>
        </select>
      </div>
      
      <button 
        v-if="!showNewTaskForm"
        class="btn btn-sm btn-primary"
        @click="showNewTaskForm = true"
      >
        <Plus class="w-4 h-4" />
        New Task
      </button>
    </div>

    <!-- New Task Form (Collapsible) -->
    <div 
      v-if="showNewTaskForm"
      class="border border-base-300 rounded-lg p-4 space-y-3 bg-base-200/50"
    >
      <div class="flex justify-between items-center">
        <h3 class="font-medium">Create New Task</h3>
        <button 
          class="btn btn-ghost btn-sm btn-square"
          @click="cancelNewTask"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      
      <input
        v-model="newTask.title"
        type="text"
        placeholder="Task title..."
        class="input input-sm input-bordered w-full"
        @keyup.enter="addTask"
      />
      
      <textarea
        v-model="newTask.description"
        placeholder="Description (optional)"
        class="textarea textarea-bordered textarea-sm w-full h-20 resize-none"
      />
      
      <div class="flex gap-2">
        <select v-model="newTask.type" class="select select-sm select-bordered flex-1">
          <option value="feature">Feature</option>
          <option value="bug">Bug</option>
        </select>
        <button 
          class="btn btn-sm btn-primary"
          @click="addTask"
        >
          Create Task
        </button>
      </div>
    </div>

    <!-- Tasks List -->
    <div class="space-y-2">
      <div 
        v-for="task in filteredTasks" 
        :key="task.id" 
        class="border border-base-300 rounded-lg overflow-hidden hover:border-base-content/20 transition-colors"
      >
        <!-- Task Header -->
        <div 
          class="flex items-center justify-between p-3 cursor-pointer"
          @click="toggleExpand(task.id)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <span 
              class="px-2 py-0.5 rounded-full text-xs capitalize"
              :class="getStatusColor(task.status)"
            >
              {{ task.status }}
            </span>
            <span 
              class="px-2 py-0.5 rounded-full text-xs capitalize"
              :class="task.type === 'bug' ? 'bg-red-500/10 text-red-500' : 'bg-purple-500/10 text-purple-500'"
            >
              {{ task.type }}
            </span>
            <span class="truncate">{{ task.title }}</span>
          </div>
          <component 
            :is="expandedTaskId === task.id ? ChevronUp : ChevronDown" 
            class="w-4 h-4 opacity-50"
          />
        </div>
        
        <!-- Task Details -->
        <div 
          v-if="expandedTaskId === task.id"
          class="p-3 pt-0 space-y-3 text-sm"
        >
          <p class="text-base-content/70 whitespace-pre-wrap">
            {{ task.description || 'No description provided.' }}
          </p>
          
          <div class="flex items-center gap-2">
            <select 
              v-model="task.status" 
              class="select select-sm select-bordered"
              @change="updateTaskStatus(task, $event.target.value)"
            >
              <option value="todo">Todo</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
            
            <button 
              class="btn btn-ghost btn-sm text-error"
              @click="deleteTask(task.id)"
              title="Delete task"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            
            <div class="flex-1" />
            
            <div class="text-xs text-base-content/50">
              Updated {{ new Date(task.dateUpdated).toLocaleString() }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>