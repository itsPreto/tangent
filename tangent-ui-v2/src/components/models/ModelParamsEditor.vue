<template>
    <div ref="editorRef"
      class="absolute z-50 bg-base-200 rounded-lg shadow-xl border border-base-300 p-4 w-72"
      :style="positionStyle">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <img :src="getAvatarUrl(model)" alt="Model Avatar"
            class="w-6 h-6 rounded-full object-cover border border-base-300" />
          <span class="font-medium text-base-content">{{ model.name }}</span>
        </div>
        <button @click="$emit('close')" class="p-1 hover:bg-base-300 rounded-full">
          <X class="w-4 h-4" />
        </button>
      </div>
  
      <div class="space-y-4">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Temperature</Label>
            <span class="text-xs text-base-content/60">{{ parameters.temperature }}</span>
          </div>
          <Slider
            v-model="parameters.temperature"
            class="w-full"
            :min="0"
            :max="1"
            :step="0.1"
          />
        </div>
  
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Top P</Label>
            <span class="text-xs text-base-content/60">{{ parameters.topP }}</span>
          </div>
          <Slider
            v-model="parameters.topP"
            class="w-full"
            :min="0"
            :max="1"
            :step="0.05"
          />
        </div>
  
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Top K</Label>
            <span class="text-xs text-base-content/60">{{ parameters.topK }}</span>
          </div>
          <Slider
            v-model="parameters.topK"
            class="w-full"
            :min="1"
            :max="100"
            :step="1"
          />
        </div>
  
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Max Tokens</Label>
            <span class="text-xs text-base-content/60">{{ parameters.maxOutputTokens }}</span>
          </div>
          <Slider
            v-model="parameters.maxOutputTokens"
            class="w-full"
            :min="256"
            :max="4096"
            :step="256"
          />
        </div>
  
        <div class="flex justify-end gap-2 mt-6">
          <Button variant="outline" size="sm" @click="$emit('close')">Cancel</Button>
          <Button size="sm" @click="saveParameters">Save</Button>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { X } from 'lucide-vue-next';
  import Button from '../ui/Button.vue';
    import  Label from '../ui/Label.vue';
    import  Slider from '../ui/Slider.vue';
  import type { ModelInfo, ModelParameters } from '@/types/model';
  
  const props = defineProps<{
    model: ModelInfo;
    currentParameters: ModelParameters;
    triggerRect: DOMRect;
  }>();
  
  const emit = defineEmits<{
    (e: 'save', params: ModelParameters): void;
    (e: 'close'): void;
  }>();
  
  const editorRef = ref<HTMLElement | null>(null);
  const parameters = ref({ ...props.currentParameters });
  
  // Position the editor near the avatar
  const positionStyle = computed(() => {
    const rect = props.triggerRect;
    return {
      top: `${rect.bottom + 8}px`,
      left: `${rect.left - 144 + rect.width / 2}px`, // Center horizontally (272/2 = 144)
    };
  });
  
  const saveParameters = () => {
    emit('save', parameters.value);
    emit('close');
  };
  
  // Close when clicking outside
  const handleClickOutside = (event: MouseEvent) => {
    if (editorRef.value && !editorRef.value.contains(event.target as Node)) {
      emit('close');
    }
  };
  
  onMounted(() => {
    document.addEventListener('mousedown', handleClickOutside);
  });
  
  onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside);
  });
  </script>