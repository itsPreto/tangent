<template>
  <div class="search-bar-container">
    <div class="search-input-wrapper">
      <Search class="search-icon" />
      <input
        ref="searchInputRef"
        v-model="searchValue"
        type="text"
        class="search-input"
        placeholder="Search workspaces... (Press '/' to focus)"
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
  justify-content: space-between;
  padding: 1rem;
  max-width: 100%;
  background-color: rgba(var(--color-base-100, 15 23 42), 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(var(--color-base-300, 51 65 85), 0.5);
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 600px;
  background-color: rgba(var(--color-base-200, 30 41 59), 0.8);
  border-radius: 9999px;
  padding: 0 1rem;
  border: 1px solid rgba(var(--color-base-300, 51 65 85), 0.5);
  transition: all 0.2s ease;
}

.search-input-wrapper:focus-within {
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
  border-radius: 9999px;
  padding: 0.25rem;
  border: 1px solid rgba(var(--color-base-300, 51 65 85), 0.5);
  margin-left: 1rem;
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
</style>