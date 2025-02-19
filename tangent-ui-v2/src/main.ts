import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'highlight.js/styles/github-dark.css';
import SandpackPlugin from 'sandpack-vue3';
import router from './router'
import App from './App.vue'
import './assets/main.css'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

// Tell Monaco which worker to load for which language
self.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    if (
      label === 'typescript' ||
      label === 'javascript' ||
      label === 'typescriptreact' ||
      label === 'javascriptreact'
    ) {
      return new tsWorker()
    }
    return new editorWorker()
  }
}

// (Optional) Tweak compiler options for better React support
monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
  allowJs: true,
  checkJs: false,
  jsx: monaco.languages.typescript.JsxEmit.React,
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(SandpackPlugin());
app.mount('#app')
