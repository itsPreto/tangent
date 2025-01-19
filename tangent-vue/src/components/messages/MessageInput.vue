<!-- src/components/MessageInput.vue -->
<template>
  <div class="message-input-container border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
    <div class="relative">
      <textarea
        ref="textareaRef"
        v-model="messageInput"
        rows="1"
        class="w-full px-4 py-2.5 resize-none bg-white dark:bg-gray-800 
               border border-gray-200 dark:border-gray-700 rounded-lg pr-24
               text-gray-800 dark:text-gray-200 placeholder-gray-500
               focus:ring-2 focus:ring-primary focus:ring-opacity-50 focus:border-transparent"
        :class="{ 'opacity-50': isLoading }"
        placeholder="Type your message..."
        @keydown.enter.prevent="handleSubmit"
        @input="autoResize"
      ></textarea>
      
      <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
        <!-- The button toggles between "Send" and "Stop" based on isLoading -->
        <button
          class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 
                 transition-colors disabled:opacity-50"
          :disabled="!isLoading && !messageInput.trim()"
          @click="handleToggleButton"
        >
          <!-- If isLoading, show Stop icon; otherwise show Send icon -->
          <template v-if="isLoading">
            <!-- Stop Icon (any you prefer, e.g. XCircle, or lucide StopCircle, etc.) -->
            <StopCircle class="w-5 h-5 text-red-600" />
          </template>
          <template v-else>
            <Send class="w-5 h-5 text-primary" />
          </template>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import { Send, StopCircle } from 'lucide-vue-next';

const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['send', 'stop']);

const messageInput = ref('');
const textareaRef = ref(null);

/**
 * Dynamically resize the text area.
 */
const autoResize = () => {
  const textarea = textareaRef.value;
  if (!textarea) return;
  
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
};

/**
 * Called on Enter or Send button click.
 */
const handleSubmit = async () => {
  const message = messageInput.value.trim();
  if (!message || props.isLoading) return;

  emit('send', message);
  messageInput.value = '';
  
  await nextTick();
  autoResize();
};

/**
 * Called if isLoading is true (currently streaming).
 * Emitted up so parent can stop the generation and update store.
 */
const handleStop = () => {
  emit('stop');
};

/**
 * Toggle function for the button click:
 * - If we are loading/streaming => "Stop"
 * - Otherwise => "Send"
 */
const handleToggleButton = () => {
  if (props.isLoading) {
    handleStop();
  } else {
    handleSubmit();
  }
};
</script>
