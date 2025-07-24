<template>
  <div v-if="suggestions.length > 0" class="reflection-suggestions">
    <div class="suggestions-header" @click="isExpanded = !isExpanded">
      <div class="header-content">
        <Lightbulb class="w-4 h-4 text-amber-500" />
        <span class="header-text">Relevant Insights</span>
        <Badge variant="secondary" class="suggestion-count">{{ suggestions.length }}</Badge>
      </div>
      <button 
        class="expand-btn"
        :class="{ 'expanded': isExpanded }"
      >
        <ChevronDown class="w-4 h-4" />
      </button>
    </div>
    
    <Transition name="expand">
      <div v-if="isExpanded" class="suggestions-content">
        <div class="suggestions-list">
          <div 
            v-for="suggestion in visibleSuggestions" 
            :key="suggestion.id"
            class="suggestion-card group"
            @click="handleSuggestionClick(suggestion)"
          >
            <div class="suggestion-main">
              <div class="suggestion-problem">
                <h4 class="problem-title">{{ suggestion.problem_statement }}</h4>
                <p class="solution-text">{{ suggestion.solution_breakthrough }}</p>
              </div>
              
              <div class="suggestion-meta">
                <div class="meta-tags">
                  <Badge 
                    v-for="tech in suggestion.technologies.slice(0, 2)" 
                    :key="tech"
                    variant="outline" 
                    class="tech-tag"
                  >
                    {{ tech }}
                  </Badge>
                  <Badge 
                    v-if="suggestion.complexity" 
                    :variant="getComplexityVariant(suggestion.complexity)"
                    class="complexity-tag"
                  >
                    {{ suggestion.complexity }}
                  </Badge>
                </div>
                
                <div class="meta-scores">
                  <div v-if="suggestion.contextual_relevance_score" class="score-badge relevance">
                    <span class="score-label">Relevance</span>
                    <span class="score-value">{{ Math.round(suggestion.contextual_relevance_score * 100) }}%</span>
                  </div>
                  <div v-if="suggestion.similarity_score" class="score-badge similarity">
                    <span class="score-label">Similarity</span>
                    <span class="score-value">{{ Math.round(suggestion.similarity_score * 100) }}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="suggestion-actions">
              <button 
                @click.stop="handleFeedback(suggestion.id, true)" 
                class="feedback-btn helpful"
                :class="{ active: feedbackState[suggestion.id] === 'helpful' }"
                title="Mark as helpful"
              >
                <ThumbsUp class="w-3 h-3" />
              </button>
              <button 
                @click.stop="handleFeedback(suggestion.id, false)" 
                class="feedback-btn not-helpful"
                :class="{ active: feedbackState[suggestion.id] === 'not-helpful' }"
                title="Mark as not helpful"
              >
                <ThumbsDown class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        
        <div v-if="suggestions.length > maxVisible" class="show-more-container">
          <button @click="showMore" class="show-more-btn">
            Show {{ Math.min(3, suggestions.length - maxVisible) }} more insights
            <ChevronRight class="w-3 h-3" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Lightbulb, ChevronDown, ChevronRight, ThumbsUp, ThumbsDown } from 'lucide-vue-next'
import Badge from '@/components/ui/Badge.vue'

interface ReflectionSuggestion {
  id: string
  problem_statement: string
  technical_challenge: string
  solution_breakthrough: string
  key_insights: string[]
  technologies: string[]
  domains: string[]
  complexity: string
  keywords: string[]
  contextual_relevance_score?: number
  similarity_score?: number
  created_at: string
}

interface Props {
  nodeId: string
  chatId?: string
  messages: any[]
  autoExpand?: boolean
  maxInitialVisible?: number
}

const props = withDefaults(defineProps<Props>(), {
  chatId: 'unknown',
  autoExpand: false,
  maxInitialVisible: 3
})

const emit = defineEmits<{
  suggestionClick: [suggestion: ReflectionSuggestion]
  feedback: [suggestionId: string, helpful: boolean]
}>()

// State
const suggestions = ref<ReflectionSuggestion[]>([])
const isExpanded = ref(props.autoExpand)
const isLoading = ref(false)
const maxVisible = ref(props.maxInitialVisible)
const feedbackState = ref<Record<string, 'helpful' | 'not-helpful'>>({})

// Computed
const visibleSuggestions = computed(() => suggestions.value.slice(0, maxVisible.value))

// Methods
const loadSuggestions = async () => {
  if (isLoading.value || !props.messages.length) return
  
  isLoading.value = true
  try {
    const response = await fetch('http://127.0.0.1:5050/api/conversation/reflection-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: props.messages,
        limit: 10
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      suggestions.value = data.suggestions || []
      
      // Auto-expand if we have suggestions and autoExpand is true
      if (suggestions.value.length > 0 && props.autoExpand) {
        isExpanded.value = true
      }
    }
  } catch (error) {
    console.error('Failed to load reflection suggestions:', error)
  } finally {
    isLoading.value = false
  }
}

const handleSuggestionClick = (suggestion: ReflectionSuggestion) => {
  emit('suggestionClick', suggestion)
}

const handleFeedback = async (suggestionId: string, helpful: boolean) => {
  try {
    const response = await fetch(`http://127.0.0.1:5050/api/reflections/${suggestionId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helpful })
    })
    
    if (response.ok) {
      feedbackState.value[suggestionId] = helpful ? 'helpful' : 'not-helpful'
      emit('feedback', suggestionId, helpful)
    }
  } catch (error) {
    console.error('Failed to submit feedback:', error)
  }
}

const showMore = () => {
  maxVisible.value = Math.min(maxVisible.value + 3, suggestions.value.length)
}

const getComplexityVariant = (complexity: string) => {
  switch (complexity) {
    case 'low': return 'outline'
    case 'medium': return 'secondary'
    case 'high': return 'destructive'
    case 'expert': return 'default'
    default: return 'outline'
  }
}

// Lifecycle
onMounted(() => {
  loadSuggestions()
})

// Expose refresh method for parent components
defineExpose({
  refresh: loadSuggestions
})
</script>

<style scoped>
.reflection-suggestions {
  @apply border border-gray-200 rounded-lg bg-white/80 backdrop-blur-sm my-3;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.suggestions-header {
  @apply flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors;
}

.header-content {
  @apply flex items-center gap-2;
}

.header-text {
  @apply text-sm font-medium text-gray-600;
}

.suggestion-count {
  @apply text-xs px-1.5 py-0.5;
}

.expand-btn {
  @apply p-1 rounded-md hover:bg-gray-100 transition-all duration-200 text-gray-500;
}

.expand-btn.expanded {
  @apply rotate-180;
}

.suggestions-content {
  @apply border-t border-gray-200;
}

.suggestions-list {
  @apply space-y-2 p-3;
}

.suggestion-card {
  @apply flex items-start justify-between p-3 rounded-md border border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-all duration-200;
}

.suggestion-main {
  @apply flex-1 min-w-0;
}

.suggestion-problem {
  @apply mb-2;
}

.problem-title {
  @apply text-sm font-medium text-gray-900 mb-1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.solution-text {
  @apply text-xs text-gray-600;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.suggestion-meta {
  @apply flex items-center justify-between;
}

.meta-tags {
  @apply flex items-center gap-1 flex-wrap;
}

.tech-tag {
  @apply text-xs px-1.5 py-0.5;
}

.complexity-tag {
  @apply text-xs px-1.5 py-0.5 capitalize;
}

.meta-scores {
  @apply flex items-center gap-2;
}

.score-badge {
  @apply flex items-center gap-1 text-xs;
}

.score-badge.relevance {
  @apply text-blue-600;
}

.score-badge.similarity {
  @apply text-green-600;
}

.score-label {
  @apply text-gray-500;
}

.score-value {
  @apply font-medium;
}

.suggestion-actions {
  @apply flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity;
}

.feedback-btn {
  @apply p-1.5 rounded-md hover:bg-gray-100 transition-all duration-200 text-gray-500;
}

.feedback-btn.helpful:hover,
.feedback-btn.helpful.active {
  @apply text-green-600 bg-green-50;
}

.feedback-btn.not-helpful:hover,
.feedback-btn.not-helpful.active {
  @apply text-red-600 bg-red-50;
}

.show-more-container {
  @apply p-3 border-t border-gray-200;
}

.show-more-btn {
  @apply flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors font-medium;
}

/* Transitions */
.expand-enter-active,
.expand-leave-active {
  @apply transition-all duration-300 ease-in-out;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
  opacity: 1;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .reflection-suggestions {
    @apply border-gray-700 bg-gray-800/80;
  }

  .suggestions-header {
    @apply hover:bg-gray-700;
  }

  .header-text {
    @apply text-gray-400;
  }

  .expand-btn {
    @apply hover:bg-gray-700 text-gray-400;
  }

  .suggestions-content {
    @apply border-gray-700;
  }

  .suggestion-card {
    @apply border-gray-700 hover:border-gray-600 hover:bg-gray-700;
  }

  .problem-title {
    @apply text-gray-100;
  }

  .solution-text {
    @apply text-gray-400;
  }

  .score-label {
    @apply text-gray-400;
  }

  .feedback-btn {
    @apply hover:bg-gray-700 text-gray-400;
  }

  .feedback-btn.helpful:hover,
  .feedback-btn.helpful.active {
    @apply bg-green-900/20;
  }

  .feedback-btn.not-helpful:hover,
  .feedback-btn.not-helpful.active {
    @apply bg-red-900/20;
  }

  .show-more-container {
    @apply border-gray-700;
  }

  .show-more-btn {
    @apply text-gray-400 hover:text-gray-100;
  }
}
</style>