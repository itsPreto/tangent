<template>
  <div class="thinking-block" :class="{ 'expanded': isExpanded }">
    <div class="thinking-header" @click="toggleExpanded">
      <div class="thinking-icon">
        <Brain class="w-4 h-4" />
      </div>
      <span class="thinking-label">{{ isStreaming ? 'Thinking...' : 'Reasoning' }}</span>
      <div class="thinking-controls">
        <span v-if="isStreaming" class="thinking-indicator">
          <div class="thinking-dot"></div>
          processing...
        </span>
        <ChevronDown 
          class="w-4 h-4 thinking-chevron" 
          :class="{ 'rotated': isExpanded }"
        />
      </div>
    </div>
    
    <div class="thinking-content-wrapper" v-if="isExpanded">
      <div class="thinking-content">
        <div class="thinking-text" v-if="!isStreaming" v-show="content.trim()">
          {{ content }}
        </div>
        <div class="thinking-streaming" v-else v-show="content.trim()">
          <div class="streaming-text">{{ content }}</div>
          <div class="streaming-cursor"></div>
        </div>
        <div v-if="!content.trim()" class="thinking-placeholder">
          <div class="placeholder-text">Thinking content will appear here...</div>
        </div>
      </div>
      <div class="thinking-footer" v-if="!isStreaming">
        <button @click="copyContent" class="thinking-copy-btn">
          <Copy class="w-3 h-3" />
          Copy reasoning
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Brain, ChevronDown, Copy } from 'lucide-vue-next';

interface Props {
  content: string;
  isStreaming?: boolean;
  nodeId: string;
  messageIndex?: number;
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
  messageIndex: 0
});

const isExpanded = ref(true); // Start expanded for better visibility

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const copyContent = () => {
  navigator.clipboard.writeText(props.content);
  // Could add a toast notification here
};
</script>

<style scoped>
.thinking-block {
  margin: 0.5rem 0;
  border: 1px solid hsl(var(--b3) / 0.3);
  border-radius: 8px;
  background: hsl(var(--b1));
  overflow: hidden;
  transition: all 0.2s ease;
}

.thinking-block:hover {
  border-color: hsl(var(--p) / 0.3);
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  user-select: none;
}

.thinking-header:hover {
  background: hsl(var(--b2) / 0.5);
}

.thinking-icon {
  color: hsl(var(--p));
  flex-shrink: 0;
}

.thinking-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--bc));
  flex-grow: 1;
}

.thinking-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.thinking-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: hsl(var(--p));
  font-weight: 500;
}

.thinking-dot {
  width: 4px;
  height: 4px;
  background: hsl(var(--p));
  border-radius: 50%;
  animation: thinkingPulse 1.5s ease-in-out infinite;
}

.thinking-chevron {
  color: hsl(var(--bc) / 0.6);
  transition: transform 0.2s ease;
}

.thinking-chevron.rotated {
  transform: rotate(180deg);
}

.thinking-content-wrapper {
  border-top: 1px solid hsl(var(--b3) / 0.3);
  background: hsl(var(--b2) / 0.3);
}

.thinking-content {
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

.thinking-text {
  font-size: 0.85rem;
  line-height: 1.6;
  color: hsl(var(--bc) / 0.8);
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.thinking-streaming {
  display: flex;
  align-items: flex-end;
  gap: 0.25rem;
}

.streaming-text {
  font-size: 0.85rem;
  line-height: 1.6;
  color: hsl(var(--bc) / 0.8);
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.streaming-cursor {
  width: 2px;
  height: 1.2em;
  background: hsl(var(--p));
  animation: blink 1s infinite;
  flex-shrink: 0;
}

.thinking-footer {
  display: flex;
  justify-content: flex-end;
  padding: 0.5rem 1rem;
  background: hsl(var(--b1));
  border-top: 1px solid hsl(var(--b3) / 0.3);
}

.thinking-copy-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  background: transparent;
  border: 1px solid hsl(var(--b3) / 0.5);
  border-radius: 4px;
  color: hsl(var(--bc) / 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.thinking-copy-btn:hover {
  background: hsl(var(--b3) / 0.3);
  color: hsl(var(--bc));
}

.thinking-placeholder {
  padding: 1rem;
  text-align: center;
  color: hsl(var(--bc) / 0.5);
  font-style: italic;
}

.placeholder-text {
  font-size: 0.85rem;
}

@keyframes thinkingPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.3;
    transform: scale(1.2);
  }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>