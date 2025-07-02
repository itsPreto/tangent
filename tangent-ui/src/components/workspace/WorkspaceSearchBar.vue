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
    
    <div class="view-toggle">
      <button 
        @click="$emit('toggle-view', 'bubble')" 
        class="toggle-btn"
        :class="{ 'active': viewMode === 'bubble' }"
        title="Bubble View"
      >
        <Circle class="toggle-icon" />
      </button>
      <button 
        @click="$emit('toggle-view', 'grid')" 
        class="toggle-btn"
        :class="{ 'active': viewMode === 'grid' }"
        title="Grid View"
      >
        <LayoutGrid class="toggle-icon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { Search, X, Circle, LayoutGrid } from 'lucide-vue-next';

// Props
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  viewMode: {
    type: String,
    default: 'bubble'
  }
});

// Emits
const emit = defineEmits(['update:modelValue', 'toggle-view']);

// Refs
const searchInputRef = ref(null);
const searchValue = ref(props.modelValue);

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

// Event listener for '/' key to focus search
onMounted(() => {
  const handleKeyDown = (e) => {
    if (e.key === '/' && document.activeElement !== searchInputRef.value) {
      e.preventDefault();
      focusInput();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  
  // Cleanup
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
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
  background-color: rgba(var(--color-base-200, 30 41 59), 0.8);
  backdrop-filter: blur(10px);
  border-radius: 9999px;
  padding: 0 1rem;
  border: 1px solid rgba(var(--color-base-300, 51 65 85), 0.5);
  transition: all 0.3s ease;
}

.search-input-wrapper:hover {
  width: 28rem;
  max-width: 60vw;
}

.search-input-wrapper:focus-within {
  width: 32rem;
  max-width: 70vw;
  border-color: rgb(var(--color-primary, 37 99 235));
  box-shadow: 0 0 0 2px rgba(var(--color-primary, 37 99 235), 0.2);
}

.search-icon {
  width: 1rem;
  height: 1rem;
  color: rgba(var(--color-base-content, 255 255 255), 0.5);
  margin-right: 0.5rem;
}

.search-input {
  flex: 1;
  height: 2.5rem;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.875rem;
  color: rgb(var(--color-base-content, 255 255 255));
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
  color: rgba(var(--color-base-content, 255 255 255), 0.5);
}

.view-toggle {
  display: flex;
  align-items: center;
  background-color: rgba(var(--color-base-200, 30 41 59), 0.8);
  backdrop-filter: blur(10px);
  border-radius: 9999px;
  padding: 0.25rem;
  border: 1px solid rgba(var(--color-base-300, 51 65 85), 0.5);
  flex-shrink: 0;
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  border: none;
  background: transparent;
  color: rgba(var(--color-base-content, 255 255 255), 0.5);
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  background-color: rgba(var(--color-base-300, 51 65 85), 0.5);
}

.toggle-btn.active {
  background-color: rgb(var(--color-primary, 37 99 235));
  color: white;
}

.toggle-icon {
  width: 1rem;
  height: 1rem;
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
  
  .view-toggle {
    padding: 0.125rem;
  }
  
  .toggle-btn {
    width: 1.75rem;
    height: 1.75rem;
  }
}
</style>