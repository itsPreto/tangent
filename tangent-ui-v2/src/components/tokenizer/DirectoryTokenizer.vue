<template>
    <div class="min-h-screen bg-background/40 backdrop-blur-md p-6 border border-border/40">
      <div class="max-w-6xl mx-auto">
        <div class="flex justify-between items-center mb-8">
          <div class="flex items-center space-x-4">
            <h1 class="text-3xl font-bold text-foreground">Tokenic</h1>
            <div class="relative flex space-x-2">
              <select v-model="optimizationLevel"
                      class="w-44 px-3 py-2 bg-background border rounded-lg shadow-sm">
                <option value="low">Conservative</option>
                <option value="medium">Standard</option>
                <option value="aggressive">Aggressive</option>
              </select>
              <select v-model="selectedModel"
                      class="w-full px-4 py-2 bg-background/80 backdrop-blur-sm border rounded-lg appearance-none cursor-pointer">
                <optgroup v-for="(models, category) in groupedModels" :key="category" :label="category">
                  <option v-for="model in models" :key="model" :value="model">
                    {{ model }}
                  </option>
                </optgroup>
              </select>
              <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <span class="i-lucide-chevron-down h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
  
        <!-- Tab Selection -->
        <div class="flex gap-4 border-b mb-6">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="px-4 py-2 -mb-px transition-colors relative"
            :class="[
              activeTab === tab.id
                ? 'border-b-2 border-primary text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            {{ tab.name }}
          </button>
        </div>
  
        <!-- File Processing -->
        <div v-if="activeTab === 'file'" class="space-y-6">
          <div class="flex items-center gap-4">
            <div class="flex-1 relative">
              <input
                v-model="filePath"
                type="text"
                placeholder="Enter file path..."
                class="w-full px-4 py-3 bg-background border rounded-lg pr-10"
                @keyup.enter="optimizeFile"
              />
              <button
                v-if="filePath"
                @click="filePath = ''"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <span class="i-lucide-x h-4 w-4" />
              </button>
            </div>
            <button
              @click="optimizeFile"
              class="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isProcessing || !filePath"
            >
              {{ isProcessing ? 'Processing...' : 'Optimize' }}
            </button>
          </div>
        </div>
  
        <!-- Directory Processing -->
        <div v-if="activeTab === 'directory'" class="space-y-6">
          <div class="flex items-center gap-4">
            <div class="flex-1 relative">
              <input
                v-model="directory"
                type="text"
                placeholder="Enter directory path..."
                class="w-full px-4 py-3 bg-background border rounded-lg pr-10"
                @keyup.enter="processDirectory"
              />
              <button
                v-if="directory"
                @click="directory = ''"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <span class="i-lucide-x h-4 w-4" />
              </button>
            </div>
            <button
              @click="processDirectory"
              class="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isProcessing || !directory"
            >
              {{ isProcessing ? 'Processing...' : 'Process Directory' }}
            </button>
          </div>
        </div>
  
        <!-- Raw Text Input -->
        <div v-if="activeTab === 'raw'" class="space-y-6">
          <div class="flex items-center gap-4 mb-4">
            <select v-model="rawInputType" class="px-4 py-3 bg-background border rounded-lg">
              <option value="system">System</option>
              <option value="user">User</option>
              <option value="assistant">Assistant</option>
            </select>
            <button
              @click="optimizeRawText"
              class="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isProcessing || !rawText"
            >
              {{ isProcessing ? 'Processing...' : 'Optimize' }}
            </button>
          </div>
          <div class="relative">
            <textarea
              v-model="rawText"
              placeholder="Enter your text here..."
              class="w-full h-48 p-4 bg-background border rounded-lg font-mono text-sm resize-none"
              @keyup.ctrl.enter="optimizeRawText"
            />
            <div v-if="rawText" class="absolute top-2 right-2">
              <button @click="rawText = ''" class="p-1 hover:bg-muted rounded">
                <span class="i-lucide-x h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
  
        <!-- Results Display -->
        <div v-if="currentResult" class="mt-8 bg-card border rounded-lg shadow-sm">
          <!-- Header Stats -->
          <div class="p-4 border-b">
            <div v-if="currentResult.filepath" class="mb-2 text-sm text-muted-foreground">
              {{ currentResult.filepath }}
            </div>
            <div class="flex items-center justify-between">
              <div class="flex gap-6 text-sm">
                <div>
                  <span class="text-muted-foreground">Original Tokens:</span>
                  <span class="ml-2 font-medium">{{ currentResult.token_map.original.token_count }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Optimized Tokens:</span>
                  <span class="ml-2 font-medium">{{ currentResult.token_map.optimized.token_count }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Reduction:</span>
                  <span class="ml-2 font-medium">
                    {{
                      (
                        (currentResult.token_map.original.token_count -
                          currentResult.token_map.optimized.token_count) /
                        currentResult.token_map.original.token_count
                      * 100).toFixed(1)
                    }}%
                  </span>
                </div>
              </div>
              <div class="text-sm text-muted-foreground">
                Model: {{ currentResult.model }}
              </div>
            </div>
          </div>
  
          <!-- Token Visualization -->
          <div class="grid grid-cols-2 gap-6 p-6">
            <!-- Original Panel -->
            <div>
              <h4 class="font-medium mb-2">Original</h4>
              <div class="max-h-[400px] overflow-auto">
                <pre
                  class="p-4 bg-muted rounded-lg font-mono text-sm whitespace-normal leading-tight"
                  style="margin: 0;"
                >
  <template v-for="(token, idx) in currentResult.token_map.original.tokens" :key="idx">
    <span
      class="token"
      :class="{
        'bg-destructive/20 text-destructive': isRemovedToken(token),
        'bg-success/20 text-success': isNewToken(token),
        'opacity-50': isRemovedToken(token)
      }"
    >
      {{ token.trim() }}
    </span><span v-if="idx < currentResult.token_map.original.tokens.length - 1"> </span>
  </template>
                </pre>
              </div>
            </div>
  
            <!-- Removed Tokens Panel -->
            <div>
              <h4 class="font-medium mb-2">Removed Tokens</h4>
              <div class="max-h-[400px] overflow-auto">
                <pre
                  class="p-4 bg-muted rounded-lg font-mono text-sm whitespace-normal leading-tight"
                  style="margin: 0;"
                >
  <template v-for="(token, idx) in removedTokens" :key="idx">
    <span class="token bg-destructive/20 text-destructive">
      {{ token.trim() }}
    </span><span v-if="idx < removedTokens.length - 1"> </span>
  </template>
                </pre>
              </div>
            </div>
          </div>
  
          <!-- Token Analysis -->
          <div class="p-4 border-t bg-muted">
            <div class="grid grid-cols-3 gap-8">
              <div>
                <p class="text-sm text-muted-foreground mb-1">Removed Tokens</p>
                <p class="text-2xl font-bold">{{ getRemovedTokenCount() }}</p>
              </div>
              <div>
                <p class="text-sm text-muted-foreground mb-1">New Tokens</p>
                <p class="text-2xl font-bold">{{ getNewTokenCount() }}</p>
              </div>
              <div>
                <p class="text-sm text-muted-foreground mb-1">Token Savings</p>
                <p class="text-2xl font-bold">{{ getTokenSavings() }}</p>
              </div>
            </div>
          </div>
        </div>
  
        <!-- Bundle Results -->
        <div v-if="activeTab === 'directory' && processedFiles.length" class="mt-8 space-y-4">
          <div class="bg-card border rounded-lg p-4">
            <h3 class="text-lg font-medium mb-4">Bundle Summary</h3>
            <div class="grid grid-cols-4 gap-6">
              <div>
                <p class="text-sm text-muted-foreground">Total Files</p>
                <p class="text-2xl font-bold">{{ processedFiles.length }}</p>
              </div>
              <div>
                <p class="text-sm text-muted-foreground">Total Original Tokens</p>
                <p class="text-2xl font-bold">{{ totalOriginalTokens }}</p>
              </div>
              <div>
                <p class="text-sm text-muted-foreground">Total Optimized Tokens</p>
                <p class="text-2xl font-bold">{{ totalOptimizedTokens }}</p>
              </div>
              <div>
                <p class="text-sm text-muted-foreground">Average Reduction</p>
                <p class="text-2xl font-bold">
                  {{
                    (
                      (totalOriginalTokens - totalOptimizedTokens) /
                        totalOriginalTokens
                    * 100).toFixed(1)
                  }}%
                </p>
              </div>
            </div>
          </div>
        </div>
  
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  
  interface TokenMap {
    text: string
    token_count: number
    tokens: string[]
  }
  
  interface ProcessedResult {
    filepath?: string
    token_map: {
      original: TokenMap
      optimized: TokenMap
    }
    optimization_level: string
    model: string
  }
  
  interface Tab {
    id: 'file' | 'directory' | 'raw'
    name: string
  }
  
  const tabs: Tab[] = [
    { id: 'file', name: 'Single File' },
    { id: 'directory', name: 'Directory' },
    { id: 'raw', name: 'Raw Text' }
  ]
  
  const activeTab = ref<Tab['id']>('file')
  const directory = ref('')
  const filePath = ref('')
  const rawText = ref('')
  const rawInputType = ref<'system' | 'user' | 'assistant'>('user')
  const optimizationLevel = ref('medium')
  const isProcessing = ref(false)
  const currentResult = ref<ProcessedResult | null>(null)
  const processedFiles = ref<ProcessedResult[]>([])
  const selectedModel = ref('gpt-4')
  const availableModels = ref<string[]>([])
  
  const groupedModels = computed(() => {
    return {
      Popular: availableModels.value.filter(m =>
        ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-1106-preview'].includes(m)
      ),
      'Open-Source Models': availableModels.value.filter(m =>
        m.includes('llama') || m.includes('meta')
      ),
      'OpenAI Models': availableModels.value.filter(m =>
        m.includes('gpt') && !['gpt-4','gpt-3.5-turbo','gpt-4-1106-preview'].includes(m)
      ),
      Legacy: availableModels.value.filter(m =>
        ['davinci','curie','babbage','ada'].includes(m)
      )
    }
  })
  
  const totalOriginalTokens = computed(() => {
    return processedFiles.value.reduce((sum, file) =>
      sum + file.token_map.original.token_count, 0
    )
  })
  
  const totalOptimizedTokens = computed(() => {
    return processedFiles.value.reduce((sum, file) =>
      sum + file.token_map.optimized.token_count, 0
    )
  })
  
  onMounted(async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/models')
      const data = await response.json()
      availableModels.value = data.models
    } catch (error) {
      console.error('Error fetching models:', error)
    }
  })
  
  const removedTokens = computed(() => {
    if (!currentResult.value) return []
    const original = currentResult.value.token_map.original.tokens
    const optimized = currentResult.value.token_map.optimized.tokens
    return original.filter(token => !optimized.includes(token))
  })
  
  const isRemovedToken = (token: string) => {
    if (!currentResult.value) return false
    return !currentResult.value.token_map.optimized.tokens.includes(token)
  }
  
  const isNewToken = (token: string) => {
    if (!currentResult.value) return false
    return (
      currentResult.value.token_map.optimized.tokens.includes(token) &&
      !currentResult.value.token_map.original.tokens.includes(token)
    )
  }
  
  const getRemovedTokenCount = () => {
    if (!currentResult.value) return 0
    return currentResult.value.token_map.original.tokens.filter(token =>
      isRemovedToken(token)
    ).length
  }
  
  const getNewTokenCount = () => {
    if (!currentResult.value) return 0
    return currentResult.value.token_map.optimized.tokens.filter(token =>
      isNewToken(token)
    ).length
  }
  
  const getTokenSavings = () => {
    if (!currentResult.value) return 0
    return (
      currentResult.value.token_map.original.token_count -
      currentResult.value.token_map.optimized.token_count
    )
  }
  
  const optimizeFile = async () => {
    if (!filePath.value) return
    isProcessing.value = true
    try {
      const response = await fetch('http://127.0.0.1:5000/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: filePath.value,
          level: optimizationLevel.value,
          model: selectedModel.value
        }),
      })
  
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to optimize file')
      }
  
      const data = await response.json()
      currentResult.value = data
    } catch (error) {
      console.error('Error optimizing file:', error)
    } finally {
      isProcessing.value = false
    }
  }
  
  const processDirectory = async () => {
    if (!directory.value) return
    isProcessing.value = true
    try {
      const response = await fetch('http://127.0.0.1:5000/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directory: directory.value,
          level: optimizationLevel.value,
          model: selectedModel.value
        }),
      })
  
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to process directory')
      }
  
      const data = await response.json()
      processedFiles.value = data.files
      if (data.files.length > 0) {
        currentResult.value = data.files[0]
      }
    } catch (error) {
      console.error('Error processing directory:', error)
    } finally {
      isProcessing.value = false
    }
  }
  
  const optimizeRawText = async () => {
    if (!rawText.value) return
    isProcessing.value = true
    try {
      const response = await fetch('http://127.0.0.1:5000/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText.value,
          type: rawInputType.value,
          level: optimizationLevel.value,
          model: selectedModel.value
        }),
      })
  
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to optimize text')
      }
  
      const data = await response.json()
      currentResult.value = data
    } catch (error) {
      console.error('Error optimizing text:', error)
    } finally {
      isProcessing.value = false
    }
  }
  </script>
  
  <style>
  .token {
    display: inline-block;
    border-radius: 2px;
    padding: 0 2px;
    margin: 0 1px;
  }
  </style>
  