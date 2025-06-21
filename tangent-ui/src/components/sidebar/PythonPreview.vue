<!-- src/components/sandpack/PythonPreview.vue -->
<template>
    <div class="python-preview-container h-full w-full flex flex-col">
      <div v-if="isLoadingPyodide" class="flex-1 flex items-center justify-center text-lg text-gray-500">
        Loading Python interpreter... (this might take a moment, especially the first time)
      </div>
      <div v-else class="flex-1 flex flex-col overflow-hidden">
        <div class="code-display bg-gray-800 text-white p-4 font-mono text-sm overflow-auto flex-1">
          <pre v-if="output">{{ output }}</pre>
          <pre v-if="error" class="text-red-400">{{ error }}</pre>
          <pre v-if="!output && !error" class="text-gray-500">Run code to see output...</pre>
        </div>
        <button @click="runPythonCode" class="run-button bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-b-md">
          Run Python Code
        </button>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted, watch, nextTick } from 'vue';
  
  // IMPORTANT: Pyodide is a global object loaded via a <script> tag (as in your example).
  // We'll tell TypeScript about it and use a global instance to avoid reloading.
  declare const loadPyodide: any; // Declare global loadPyodide function
  
  const props = defineProps<{
    code: string;
  }>();
  
  const emit = defineEmits(['message']); // Emit 'message' for errors/outputs to the parent (SandPackSidePanel)
  
  const pyodide = ref(null);
  const isLoadingPyodide = ref(true);
  const output = ref('');
  const error = ref('');
  
  // Global Pyodide instance to ensure it's only loaded once
  let _pyodideInstance: any = null;
  
  // You can add packages here if needed for common Python snippets
  // E.g., ['pandas', 'numpy']
  const pythonPackages: string[] = ['micropip']; // micropip is often needed to install other packages via pip in Pyodide
  
  async function initializePyodide() {
    if (_pyodideInstance) {
      pyodide.value = _pyodideInstance;
      isLoadingPyodide.value = false;
      // When switching back to Python, autorun if the code is already present
      if (props.code) {
        runPythonCode();
      }
      return;
    }
  
    try {
      isLoadingPyodide.value = true;
      emit('message', { type: 'console', data: ['Loading Python interpreter...'] });
      
      // Attempt to load pyodide.js if it's not already on the page
      // (This part might need to be handled more robustly in App.vue if the script isn't always present)
      if (typeof loadPyodide === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
        script.async = true;
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
      }
  
      _pyodideInstance = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/'
      });
      pyodide.value = _pyodideInstance;
  
      // Install specified packages
      if (pythonPackages.length > 0) {
        emit('message', { type: 'console', data: [`Installing Python packages: ${pythonPackages.join(', ')}...`] });
        await pyodide.value.loadPackage(pythonPackages);
      }
      
      emit('message', { type: 'console', data: ['Python interpreter loaded.'] });
      isLoadingPyodide.value = false;
      runPythonCode(); // Autorun on initial load if code is present
    } catch (err: any) {
      error.value = `Failed to load Pyodide: ${err.message || err}`;
      emit('message', { type: 'error', error: error.value });
      isLoadingPyodide.value = false;
      console.error('Pyodide initialization error:', err);
    }
  }
  
  async function runPythonCode() {
    if (isLoadingPyodide.value || !pyodide.value) {
      error.value = 'Python interpreter not yet loaded.';
      emit('message', { type: 'error', error: error.value });
      return;
    }
  
    output.value = '';
    error.value = '';
    
    // Redirect Python's stdout and stderr to capture print statements and errors
    pyodide.value.runPython(`
  import sys
  from io import StringIO
  sys.stdout = StringIO()
  sys.stderr = StringIO()
  `);
  
    try {
      await pyodide.value.runPythonAsync(props.code);
      const stdoutBuffer = pyodide.value.runPython('sys.stdout.getvalue()');
      const stderrBuffer = pyodide.value.runPython('sys.stderr.getvalue()');
      
      output.value = stdoutBuffer; // Display regular print output
      if (stderrBuffer) {
        error.value = stderrBuffer; // Display stderr as an error
        emit('message', { type: 'error', error: error.value });
      } else {
        // If no stderr, send stdout to console for parent to display
        emit('message', { type: 'console', data: [output.value] });
      }
  
    } catch (err: any) {
      // Catch Python execution errors
      error.value = `Python Error:\n${err.message || err}`;
      emit('message', { type: 'error', error: error.value });
      console.error('Python execution error:', err);
    }
  }
  
  onMounted(() => {
    initializePyodide();
  });
  
  watch(
    () => props.code,
    (newCode, oldCode) => {
      // Only re-run if code changes AND Pyodide is loaded
      if (pyodide.value && newCode !== oldCode) {
        runPythonCode();
      }
    }
  );
  
  // Expose runPythonCode so parent can trigger it
  defineExpose({ runPythonCode });
  </script>
  
  <style scoped>
  .python-preview-container {
    background-color: #282c34; /* Dark background for code */
    color: #abb2bf; /* Light text color */
    font-family: 'Fira Mono', 'DejaVu Sans Mono', Menlo, Consolas, 'Liberation Mono', Monaco, 'Lucida Console', monospace;
    font-size: 0.875rem; /* Equivalent to text-sm */
    border-bottom-left-radius: 8px; /* Match SandpackPreview */
    border-bottom-right-radius: 8px; /* Match SandpackPreview */
  }
  
  .code-display {
    white-space: pre-wrap; /* Preserve whitespace and wrap long lines */
    word-break: break-all; /* Break long words */
    overflow-wrap: break-word; /* Ensure wrapping within words */
  }
  
  .run-button {
    align-self: flex-end; /* Push button to the bottom */
    width: 100%; /* Make button full width */
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
  }
  </style>