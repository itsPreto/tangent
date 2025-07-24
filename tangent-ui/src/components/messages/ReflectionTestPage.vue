<template>
  <div class="reflection-test-page">
    <h1 class="text-2xl font-bold mb-6">Reflection Suggestions Test</h1>
    
    <!-- Test ReflectionSuggestions Component -->
    <div class="test-section">
      <h2 class="text-lg font-semibold mb-4">Reflection Suggestions Component</h2>
      <div class="mock-message-container">
        <div class="mock-assistant-message">
          <div class="mock-avatar">🤖</div>
          <div class="mock-content">
            This is a mock assistant message about React state management. 
            The ReflectionSuggestions component should appear below.
          </div>
        </div>
        
        <!-- Test the ReflectionSuggestions component with mock data -->
        <ReflectionSuggestions
          node-id="test-node"
          chat-id="test-chat"
          :messages="mockMessages"
          :auto-expand="true"
          @suggestion-click="handleSuggestionClick"
          @feedback="handleFeedback"
          class="mt-4"
        />
      </div>
    </div>
    
    <!-- Test ReflectionToggle Component -->
    <div class="test-section">
      <h2 class="text-lg font-semibold mb-4">Reflection Toggle Component</h2>
      <ReflectionToggle
        :is-enabled="reflectionsEnabled"
        @toggle="reflectionsEnabled = $event"
      />
    </div>
    
    <!-- Mock Modal Trigger -->
    <div class="test-section">
      <h2 class="text-lg font-semibold mb-4">Reflection Detail Modal</h2>
      <button 
        @click="showModal = true"
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Open Test Modal
      </button>
    </div>
    
    <!-- Test Modal -->
    <ReflectionDetailModal
      :is-open="showModal"
      :reflection="mockReflection"
      @close="showModal = false"
      @feedback="handleModalFeedback"
    />
    
    <!-- Debug Section -->
    <div class="test-section">
      <h2 class="text-lg font-semibold mb-4">Debug Info</h2>
      <div class="bg-gray-100 p-4 rounded text-sm">
        <p><strong>Reflections Enabled:</strong> {{ reflectionsEnabled }}</p>
        <p><strong>Modal Open:</strong> {{ showModal }}</p>
        <p><strong>Last Action:</strong> {{ lastAction }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ReflectionSuggestions from './ReflectionSuggestions.vue'
import ReflectionDetailModal from './ReflectionDetailModal.vue'
import ReflectionToggle from './ReflectionToggle.vue'

// State
const reflectionsEnabled = ref(true)
const showModal = ref(false)
const lastAction = ref('None')

// Mock data
const mockMessages = ref([
  { role: 'user', content: 'My React useState hook is not working properly' },
  { role: 'assistant', content: 'This is usually caused by state mutation. Make sure you are not modifying state directly.' },
  { role: 'user', content: 'Thank you! That fixed the issue' }
])

const mockReflection = ref({
  id: 'test-reflection-1',
  problem_statement: 'React component not re-rendering when useState hook is called',
  technical_challenge: 'Understanding React state immutability and re-rendering lifecycle',
  solution_breakthrough: 'Avoid mutating state directly, always create new state objects',
  key_insights: [
    'State mutations do not trigger re-renders in React',
    'Always use setState with new objects or arrays',
    'Spread operator is helpful for creating new state objects'
  ],
  failed_approaches: [
    'Modifying state arrays with push() method',
    'Directly changing object properties'
  ],
  technologies: ['react', 'javascript', 'hooks'],
  domains: ['frontend'],
  complexity: 'medium',
  keywords: ['react', 'useState', 'state', 'immutability', 're-rendering'],
  contextual_relevance_score: 0.85,
  similarity_score: 0.72,
  created_at: new Date().toISOString()
})

// Event handlers
const handleSuggestionClick = (suggestion: any) => {
  lastAction.value = `Clicked suggestion: ${suggestion.problem_statement}`
  console.log('Suggestion clicked:', suggestion)
}

const handleFeedback = (suggestionId: string, helpful: boolean) => {
  lastAction.value = `Feedback: ${suggestionId} marked as ${helpful ? 'helpful' : 'not helpful'}`
  console.log('Feedback:', { suggestionId, helpful })
}

const handleModalFeedback = (helpful: boolean) => {
  lastAction.value = `Modal feedback: marked as ${helpful ? 'helpful' : 'not helpful'}`
  console.log('Modal feedback:', helpful)
}
</script>

<style scoped>
.reflection-test-page {
  @apply max-w-4xl mx-auto p-6 space-y-8;
}

.test-section {
  @apply border border-gray-200 rounded-lg p-6;
}

.mock-message-container {
  @apply bg-gray-50 p-4 rounded-lg;
}

.mock-assistant-message {
  @apply flex items-start gap-3 mb-4;
}

.mock-avatar {
  @apply w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm;
}

.mock-content {
  @apply flex-1 bg-white p-3 rounded-lg shadow-sm;
}
</style>