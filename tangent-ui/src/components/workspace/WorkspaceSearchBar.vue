<template>
  <div class="search-bar-container">
    <div class="search-input-wrapper">
      <Search class="search-icon" />
      <input
        ref="searchInputRef"
        v-model="searchValue"
        type="text"
        class="search-input"
        placeholder="Search workspaces... (Press '?' to focus)"
        @input="handleInput"
      />
      <button v-if="searchValue" @click="clearSearch" class="clear-button">
        <X class="clear-icon" />
      </button>
    </div>

    <!-- Clustering Progress Indicator -->
    <Transition name="slide-in">
      <div v-if="clusteringStatus.is_running" class="clustering-progress">
        <div class="progress-content">
          <div class="progress-icon">
            <FolderOpen :size="16" class="spinning" />
          </div>
          <div class="progress-text">
            <span class="progress-label">{{ clusteringStatus.status_message }}</span>
            <div class="progress-details">
              {{ Math.round(clusteringStatus.progress * 100) }}% • 
              {{ clusteringStatus.processed_workspaces }}/{{ clusteringStatus.total_workspaces }}
            </div>
          </div>
          <div class="progress-bar-container">
            <div 
              class="progress-bar-fill" 
              :style="{ width: (clusteringStatus.progress * 100) + '%' }"
            ></div>
          </div>
          <button @click="stopClustering" class="stop-btn" title="Stop clustering">
            <X :size="14" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, reactive } from 'vue';
import { Search, X, FolderOpen } from 'lucide-vue-next';
import { clusteringService, type ClusteringStatus } from '@/services/clusteringService';

// Props
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});

// Emits
const emit = defineEmits(['update:modelValue']);

// Refs
const searchInputRef = ref(null);
const searchValue = ref(props.modelValue);

// Clustering status
const clusteringStatus = reactive<ClusteringStatus>({
  is_running: false,
  progress: 0,
  status_message: '',
  total_workspaces: 0,
  processed_workspaces: 0,
  clusters: []
});

let statusUnsubscribe: (() => void) | null = null;

// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
  searchValue.value = newValue;
});

// Methods
const handleInput = () => {
  emit('update:modelValue', searchValue.value);
};

const clearSearch = () => {
  searchValue.value = '';
  emit('update:modelValue', '');
  searchInputRef.value?.focus();
};

const focusInput = () => {
  searchInputRef.value?.focus();
};

// Clustering methods
const stopClustering = async () => {
  try {
    await clusteringService.stopClustering();
  } catch (error) {
    console.error('Error stopping clustering:', error);
  }
};

// Event listener for '/' key to focus search
onMounted(async () => {
  const handleKeyDown = (e) => {
    if (e.key === '/' && document.activeElement !== searchInputRef.value) {
      e.preventDefault();
      focusInput();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  
  // Subscribe to clustering status updates
  statusUnsubscribe = clusteringService.onStatusUpdate((status) => {
    Object.assign(clusteringStatus, status);
  });
  
  // Check initial clustering status
  try {
    const status = await clusteringService.getStatus();
    Object.assign(clusteringStatus, status);
  } catch (error) {
    console.error('Error getting initial clustering status:', error);
  }
  
  // Cleanup
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
});

onBeforeUnmount(() => {
  if (statusUnsubscribe) {
    statusUnsubscribe();
  }
});

// Expose methods to parent component
defineExpose({
  focusInput
});
</script>

<style scoped>
.search-bar-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  max-width: 100%;
  background-color: transparent;
  position: sticky;
  bottom: 0;
  z-index: 50;
  position: relative;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  width: 24rem;
  max-width: 50vw;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--b1)) l c h / 0.8),
    oklch(from oklch(var(--b2)) l c h / 0.6)
  );
  backdrop-filter: blur(10px);
  border-radius: 9999px;
  padding: 0 1rem;
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.15);
  transition: all 0.3s ease;
}

.search-input-wrapper:hover {
  width: 28rem;
  max-width: 60vw;
}

.search-input-wrapper:focus-within {
  width: 32rem;
  max-width: 70vw;
  border-color: oklch(var(--p));
  box-shadow: 0 0 0 2px oklch(from oklch(var(--p)) l c h / 0.2);
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.03),
    oklch(from oklch(var(--b1)) l c h / 0.9),
    oklch(from oklch(var(--b2)) l c h / 0.7)
  );
}

.search-icon {
  width: 1rem;
  height: 1rem;
  color: oklch(from oklch(var(--bc)) l c h / 0.5);
  margin-right: 0.5rem;
}

.search-input {
  flex: 1;
  height: 2.5rem;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.875rem;
  color: oklch(var(--bc));
}

.search-input::placeholder {
  color: oklch(from oklch(var(--bc)) l c h / 0.4);
}

.clear-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
}

.clear-icon {
  width: 1rem;
  height: 1rem;
  color: oklch(from oklch(var(--bc)) l c h / 0.5);
  transition: color 0.2s ease;
}

.clear-button:hover .clear-icon {
  color: oklch(var(--bc));
}

/* Clustering Progress Indicator */
.clustering-progress {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 60;
}

.progress-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--wa)) l c h / 0.95),
    oklch(from oklch(var(--wa)) l c h / 0.8)
  );
  backdrop-filter: blur(10px);
  border-radius: 9999px;
  padding: 0.5rem 1rem;
  border: 1px solid oklch(from oklch(var(--wa)) l c h / 0.3);
  box-shadow: 0 4px 12px oklch(from oklch(var(--wa)) l c h / 0.2);
  color: oklch(var(--wac));
  min-width: 280px;
}

.progress-icon {
  flex-shrink: 0;
}

.spinning {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.progress-text {
  flex: 1;
  min-width: 0;
}

.progress-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
}

.progress-details {
  font-size: 0.625rem;
  opacity: 0.7;
  margin-top: 0.125rem;
  line-height: 1;
}

.progress-bar-container {
  width: 60px;
  height: 4px;
  background-color: oklch(from oklch(var(--wac)) l c h / 0.2);
  border-radius: 2px;
  overflow: hidden;
  flex-shrink: 0;
}

.progress-bar-fill {
  height: 100%;
  background-color: oklch(var(--wac));
  border-radius: 2px;
  transition: width 0.3s ease;
}

.stop-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 9999px;
  border: none;
  background: oklch(from oklch(var(--wac)) l c h / 0.1);
  color: oklch(from oklch(var(--wac)) l c h / 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.stop-btn:hover {
  background: oklch(from oklch(var(--wac)) l c h / 0.2);
  color: oklch(var(--wac));
}

/* Animation for clustering progress */
.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 0.3s ease;
}

.slide-in-enter-from {
  opacity: 0;
  transform: translateY(-50%) translateX(20px) scale(0.95);
}

.slide-in-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(20px) scale(0.95);
}


/* Responsive adjustments */
@media (max-width: 768px) {
  .search-input-wrapper {
    width: 20rem;
    max-width: 70vw;
  }
  
  .search-input-wrapper:hover {
    width: 22rem;
    max-width: 80vw;
  }
  
  .search-input-wrapper:focus-within {
    width: 24rem;
    max-width: 85vw;
  }
  
  .search-bar-container {
    padding: 0.75rem;
  }
}

@media (max-width: 480px) {
  .search-input-wrapper {
    width: 18rem;
    max-width: 80vw;
  }
  
  .search-input-wrapper:hover,
  .search-input-wrapper:focus-within {
    width: 20rem;
    max-width: 90vw;
  }
  
}
</style>