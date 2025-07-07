import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'highlight.js/styles/github-dark.css';
import SandpackPlugin from 'sandpack-vue3';
import router from './router'
import App from './App.vue'
import './assets/main.css'
import { useThemeStore } from './stores/themeStore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// Initialize theme store
const themeStore = useThemeStore()
themeStore.initializeTheme()

app.use(router)
app.use(SandpackPlugin());
app.mount('#app')
