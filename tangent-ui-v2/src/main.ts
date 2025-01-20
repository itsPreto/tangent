import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'highlight.js/styles/github-dark.css';
import router from './router'
import App from './App.vue'
import './assets/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
