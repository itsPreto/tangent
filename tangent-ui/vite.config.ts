import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'react': resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      'eslint/conf/eslint-all': resolve(__dirname, 'node_modules/eslint/conf/eslint-all.js')
    },
  },
  define: {
    process: { env: {} }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    },
    include: [
      'monaco-editor'
    ]
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'ui-vendor': ['@headlessui/vue', '@heroicons/vue', 'lucide-vue-next'],
          'highlight': ['highlight.js'],
          'prism': ['prismjs'],
          'marked': ['marked'],
          'dompurify': ['dompurify'],
          'monaco': ['monaco-editor']
        }
      }
    }
  }
})