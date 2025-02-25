<template>
  <div class="message-input-container border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
    <div class="relative">
      <div 
        class="w-full min-h-[42px] max-h-[200px] overflow-y-auto px-4 py-2.5 
               bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
               rounded-lg pr-24 text-gray-800 dark:text-gray-200"
        :class="{ 'opacity-50': isLoading }"
      >
        <div 
          ref="editableRef"
          contenteditable="true"
          class="focus:outline-none min-h-[24px]"
          placeholder="Type your message..."
          @paste="handlePaste"
          @keydown.meta.enter.prevent="handleNewline"
          @keydown.ctrl.enter.prevent="handleNewline"
          @keydown.enter.prevent="handleEnter"
          @input="handleInput"
        ></div>
      </div>
      
      <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
        <TokenCounter 
          :text="getCurrentInputText"
          size="small"
          :show-icon="false"
        />
        <button
          class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 
                transition-colors disabled:opacity-50"
          :disabled="isLoading || !hasContent"      
          @click="handleSubmit"
        >
          <template v-if="isLoading">
            <StopCircle class="w-5 h-5 text-red-600" />
          </template>
          <template v-else>
            <Send class="w-5 h-5 text-primary" />
          </template>
        </button>
      </div>

      <!-- Preview Portal -->
      <Teleport to="body">
        <div v-if="activePreview"
             ref="previewEl"
             class="fixed z-[9999] p-4 bg-white dark:bg-gray-800 border border-gray-200 
                    dark:border-gray-600 rounded-lg shadow-lg max-w-2xl"
             :style="{
               left: previewPosition.left + 'px',
               top: previewPosition.top + 'px',
               maxHeight: '40vh',
               width: '90vw',
               transform: 'translateY(-100%) translateY(-8px)',
               opacity: activePreview ? 1 : 0,
               transition: 'opacity 150ms ease, transform 150ms ease',
               overflow: 'auto'
             }"
             @mouseenter="keepPreview = true"
             @mouseleave="handlePreviewLeave"
        >
          <div class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
            {{ activePreview.content }}
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import TokenCounter from '@/components/ui/TokenCounter.vue';
import { Send, StopCircle } from 'lucide-vue-next';

const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['send', 'stop']);

const editableRef = ref(null);
const inputText = ref(''); // new reactive variable to track input text
const previewEl = ref(null);
const pastedContent = ref(new Map());
const activePreview = ref(null);
const previewPosition = ref({ left: 0, top: 0 });
const keepPreview = ref(false);
let previewTimeout = null;

const getCurrentInputText = computed(() => inputText.value);
const hasContent = computed(() => inputText.value.length > 0);

const handleSubmit = () => {
  console.log('Submit attempted:', {
    hasContent: hasContent.value,
    isLoading: props.isLoading,
    text: getCurrentInputText.value,
    rawText: editableRef.value?.textContent || ''
  });
  
  if (props.isLoading || !hasContent.value) return;
  
  const message = getCurrentInputText.value;
  if (message) {
    emit('send', message);
    editableRef.value.textContent = '';
    inputText.value = ''; // reset the reactive text
    handleInput();
  }
};

const calculatePreviewPosition = (cardElement) => {
  if (!cardElement) return;
  
  const rect = cardElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  
  let left = rect.left + (rect.width / 2);
  const previewWidth = Math.min(360, viewportWidth * 0.9);
  left = Math.max(previewWidth/2 + 20, Math.min(left, viewportWidth - previewWidth/2 - 20));
  
  previewPosition.value = {
    left: left - previewWidth/2,
    top: rect.top
  };
};

const createPasteCard = (wordCount, id, preview) => {
  const card = document.createElement('span');
  card.contentEditable = 'false';
  card.className = 'inline-flex items-center gap-1 px-2 py-1 mx-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer';
  card.dataset.pasteId = id;
  
  const count = document.createElement('span');
  count.className = 'text-sm text-gray-600 dark:text-gray-300';
  count.textContent = `${wordCount}w`;
  
  const removeBtn = document.createElement('button');
  removeBtn.className = 'ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1';
  removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  removeBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    card.remove();
    pastedContent.value.delete(id);
    activePreview.value = null;
  };

  const showPreview = () => {
    if (previewTimeout) {
      clearTimeout(previewTimeout);
      previewTimeout = null;
    }
    activePreview.value = { id, content: preview };
    calculatePreviewPosition(card);
  };

  const hidePreview = () => {
    if (keepPreview.value) return;
    previewTimeout = setTimeout(() => {
      if (!keepPreview.value) {
        activePreview.value = null;
      }
    }, 100);
  };

  card.addEventListener('mouseenter', showPreview);
  card.addEventListener('mouseleave', hidePreview);
  card.addEventListener('click', (e) => {
    e.preventDefault();
    showPreview();
  });

  card.appendChild(count);
  card.appendChild(removeBtn);
  return card;
};

const handleInput = () => {
  if (!editableRef.value) return;
  
  // Update the reactive inputText variable with the latest content
  inputText.value = editableRef.value.innerText.trim();
  console.log('Input detected:', inputText.value);
  
  if (inputText.value === '') {
    editableRef.value.setAttribute('data-empty', 'true');
  } else {
    editableRef.value.removeAttribute('data-empty');
  }
};

const handlePaste = (event) => {
  event.preventDefault();
  const pastedText = event.clipboardData.getData('text');
  const wordCount = pastedText.trim().split(/\s+/).length;
  
  if (wordCount > 100) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    
    const pasteId = Date.now().toString();
    pastedContent.value.set(pasteId, pastedText);
    
    const card = createPasteCard(wordCount, pasteId, pastedText);
    range.insertNode(card);
    
    range.setStartAfter(card);
    range.setEndAfter(card);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    document.execCommand('insertText', false, pastedText);
  }
};

const handleNewline = () => {
  document.execCommand('insertLineBreak');
};

const handleEnter = (event) => {
  if (event.shiftKey) {
    handleNewline();
    return;
  }
  event.preventDefault();
  handleSubmit();
};

const handlePreviewLeave = () => {
  keepPreview.value = false;
  if (!previewTimeout) {
    previewTimeout = setTimeout(() => {
      activePreview.value = null;
    }, 100);
  }
};

const handleStop = () => {
  emit('stop');
};

onBeforeUnmount(() => {
  if (previewTimeout) {
    clearTimeout(previewTimeout);
  }
});
</script>

<style>
[contenteditable]:empty:before {
  content: attr(placeholder);
  color: #9ca3af;
  pointer-events: none;
}

[contenteditable][data-empty]:before {
  content: attr(placeholder);
  color: #9ca3af;
  pointer-events: none;
}

.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

/* Preview Animation */
.preview-enter-active,
.preview-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.preview-enter-from,
.preview-leave-to {
  opacity: 0;
  transform: translateY(-100%) translateY(-16px);
}
</style>
