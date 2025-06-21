<!-- src/components/sandpack/PythonEditor.vue -->
<template>
    <div class="python-editor-container h-full w-full">
      <div ref="editorContainer" class="h-full w-full"></div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted, watch, nextTick } from 'vue';
  import { EditorState } from '@codemirror/state';
  import { EditorView, basicSetup } from 'codemirror';
  import { python } from '@codemirror/lang-python';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { useThemeStore } from '@/stores/themeStore';
  
  const props = defineProps<{
    code: string;
    readOnly?: boolean;
  }>();
  
  const emit = defineEmits<{
    (e: 'update:code', code: string): void;
  }>();
  
  const editorContainer = ref<HTMLElement>();
  const themeStore = useThemeStore();
  let editorView: EditorView | null = null;
  
  const setupEditor = () => {
    if (!editorContainer.value) return;
  
    const isDark = themeStore.isDarkTheme(themeStore.currentTheme);
    
    const state = EditorState.create({
      doc: props.code,
      extensions: [
        basicSetup,
        python(),
        ...(isDark ? [oneDark] : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emit('update:code', update.state.doc.toString());
          }
        }),
        EditorState.readOnly.of(props.readOnly || false),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '14px',
          },
          '.cm-scroller': {
            fontFamily: '"Fira Code", "Monaco", "Cascadia Code", "Roboto Mono", monospace',
          },
          '.cm-focused': {
            outline: 'none',
          },
        }),
      ],
    });
  
    editorView = new EditorView({
      state,
      parent: editorContainer.value,
    });
  };
  
  const updateCode = (newCode: string) => {
    if (editorView && newCode !== editorView.state.doc.toString()) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: newCode,
        },
      });
    }
  };
  
  // Watch for external code changes
  watch(() => props.code, (newCode) => {
    updateCode(newCode);
  });
  
  // Watch for theme changes
  watch(() => themeStore.currentTheme, () => {
    // Recreate editor with new theme
    if (editorView) {
      editorView.destroy();
      nextTick(() => {
        setupEditor();
      });
    }
  });
  
  onMounted(() => {
    nextTick(() => {
      setupEditor();
    });
  });
  
  // Expose methods for parent component
  defineExpose({
    getCode: () => editorView?.state.doc.toString() || '',
    updateCode,
  });
  </script>
  
  <style scoped>
  .python-editor-container {
    border-radius: 8px;
    overflow: hidden;
  }
  
  :deep(.cm-editor) {
    height: 100% !important;
  }
  
  :deep(.cm-scroller) {
    height: 100% !important;
  }
  </style>