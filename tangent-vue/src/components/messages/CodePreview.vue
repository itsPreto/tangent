<!-- CodePreview.vue -->
<template>
  <div class="relative mt-3 mb-3">
    <div class="absolute right-2 top-2 flex gap-2">
      <button 
        class="p-1.5 rounded bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
        @click="copyToClipboard"
      >
        <Clipboard class="w-4 h-4 text-gray-600 dark:text-gray-300" />
      </button>
    </div>
    <pre 
      ref="previewRef"
      :class="[
        'p-4 rounded-lg overflow-x-auto border',
        'bg-gray-100 dark:bg-gray-800',
        'border-gray-200 dark:border-gray-700',
        isDark ? 'hljs-dark' : 'hljs-light'
      ]"
    >
      <code 
        ref="codeRef"
        :class="`language-${props.language} hljs text-sm`"
        v-html="highlightedCode"
      />
    </pre>
    <div v-if="props.isStreaming" class="mt-2 flex gap-1">
      <span class="animate-bounce w-1.5 h-1.5 bg-primary rounded-full"></span>
      <span class="animate-bounce delay-75 w-1.5 h-1.5 bg-primary rounded-full"></span>
      <span class="animate-bounce delay-150 w-1.5 h-1.5 bg-primary rounded-full"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import { Clipboard } from 'lucide-vue-next';

interface Props {
  content: string;
  isStreaming: boolean;
  language?: string;
}

const props = withDefaults(defineProps<Props>(), {
  language: 'javascript'
});

const previewRef = ref<HTMLElement | null>(null);
const codeRef = ref<HTMLElement | null>(null);
const isDark = ref(false);

// Watch for theme changes
const updateTheme = () => {
  isDark.value = document.documentElement.classList.contains('dark');
};

onMounted(() => {
  // Initialize hljs
  hljs.configure({ 
    ignoreUnescapedHTML: true,
    languages: ['javascript', 'python', 'bash', 'typescript', 'json']
  });

  // Set initial theme
  updateTheme();

  // Watch for theme changes using MutationObserver
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        updateTheme();
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });

  // Cleanup
  onUnmounted(() => {
    observer.disconnect();
  });
});

const highlightedCode = computed(() => {
  try {
    // First ensure language is registered
    if (!hljs.getLanguage(props.language)) {
      console.warn(`Language ${props.language} not found, falling back to plaintext`);
      return DOMPurify.sanitize(props.content);
    }

    const result = hljs.highlight(props.content, {
      language: props.language,
    });

    return DOMPurify.sanitize(result.value);
  } catch (err) {
    console.error('Highlighting error:', err);
    return DOMPurify.sanitize(props.content);
  }
});

const copyToClipboard = () => {
  navigator.clipboard.writeText(props.content);
};
</script>

<style>
/* Light theme styles */
:root:not(.dark) .hljs-light {
  --hljs-background: transparent;
  --hljs-comment: #54575a;
  --hljs-keyword: #d73a49;
  --hljs-string: #032f62;
  --hljs-number: #005cc5;
  --hljs-function: #2c0f60;
  --hljs-title: #240b53;
  --hljs-params: #24292e;
  --hljs-built_in: #005cc5;
  --hljs-literal: #005cc5;
  --hljs-variable: #24292e;
  --hljs-type: #d73a49;
  --hljs-attr: #005cc5;
  --hljs-selector: #125f24;
}

/* Dark theme styles */
.dark .hljs-dark {
  --hljs-background: transparent;
  --hljs-comment: #8b949e;
  --hljs-keyword: #ff7b72;
  --hljs-string: #a5d6ff;
  --hljs-number: #79c0ff;
  --hljs-function: #d2a8ff;
  --hljs-title: #d2a8ff;
  --hljs-params: #c9d1d9;
  --hljs-built_in: #79c0ff;
  --hljs-literal: #79c0ff;
  --hljs-variable: #c9d1d9;
  --hljs-type: #ff7b72;
  --hljs-attr: #79c0ff;
  --hljs-selector: #7ee787;
}

/* Common styles */
.hljs {
  background: var(--hljs-background) !important;
  color: var(--hljs-params);
}

.hljs-comment { color: var(--hljs-comment); }
.hljs-keyword { color: var(--hljs-keyword); }
.hljs-string { color: var(--hljs-string); }
.hljs-number { color: var(--hljs-number); }
.hljs-function { color: var(--hljs-function); }
.hljs-title { color: var(--hljs-title); }
.hljs-params { color: var(--hljs-params); }
.hljs-built_in { color: var(--hljs-built_in); }
.hljs-literal { color: var(--hljs-literal); }
.hljs-variable { color: var(--hljs-variable); }
.hljs-type { color: var(--hljs-type); }
.hljs-attr { color: var(--hljs-attr); }
.hljs-selector { color: var(--hljs-selector); }

pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  tab-size: 2;
}

code {
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Monaco, 'Courier New', monospace;
}
</style>