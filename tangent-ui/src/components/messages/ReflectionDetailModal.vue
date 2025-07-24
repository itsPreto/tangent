<template>
  <Modal :is-open="isOpen" @close="$emit('close')">
    <div v-if="reflection" class="reflection-detail-modal">
      <div class="modal-header">
        <div class="header-content">
          <Lightbulb class="w-5 h-5 text-amber-500" />
          <h2 class="modal-title">Learning Insight</h2>
          <Badge 
            :variant="getComplexityVariant(reflection.complexity)"
            class="complexity-badge"
          >
            {{ reflection.complexity }} complexity
          </Badge>
        </div>
        <button @click="$emit('close')" class="close-btn">
          <X class="w-4 h-4" />
        </button>
      </div>
      
      <div class="modal-content">
        <!-- Problem Statement -->
        <div class="section">
          <h3 class="section-title">
            <AlertCircle class="w-4 h-4" />
            Problem
          </h3>
          <p class="section-content">{{ reflection.problem_statement }}</p>
        </div>
        
        <!-- Technical Challenge -->
        <div class="section">
          <h3 class="section-title">
            <Code class="w-4 h-4" />
            Technical Challenge
          </h3>
          <p class="section-content">{{ reflection.technical_challenge }}</p>
        </div>
        
        <!-- Solution Breakthrough -->
        <div class="section highlight">
          <h3 class="section-title">
            <Zap class="w-4 h-4" />
            Solution Breakthrough
          </h3>
          <p class="section-content">{{ reflection.solution_breakthrough }}</p>
        </div>
        
        <!-- Key Insights -->
        <div v-if="reflection.key_insights?.length" class="section">
          <h3 class="section-title">
            <Brain class="w-4 h-4" />
            Key Insights
          </h3>
          <ul class="insights-list">
            <li v-for="insight in reflection.key_insights" :key="insight" class="insight-item">
              <CheckCircle class="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{{ insight }}</span>
            </li>
          </ul>
        </div>
        
        <!-- Failed Approaches -->
        <div v-if="reflection.failed_approaches?.length" class="section">
          <h3 class="section-title">
            <XCircle class="w-4 h-4" />
            What Didn't Work
          </h3>
          <ul class="failed-approaches-list">
            <li v-for="approach in reflection.failed_approaches" :key="approach" class="failed-approach-item">
              <X class="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
              <span>{{ approach }}</span>
            </li>
          </ul>
        </div>
        
        <!-- Technologies & Metadata -->
        <div class="metadata-section">
          <!-- Technologies -->
          <div v-if="reflection.technologies?.length" class="metadata-group">
            <h4 class="metadata-title">Technologies</h4>
            <div class="tag-list">
              <Badge 
                v-for="tech in reflection.technologies" 
                :key="tech"
                variant="secondary"
                class="tech-tag"
              >
                {{ tech }}
              </Badge>
            </div>
          </div>
          
          <!-- Domains -->
          <div v-if="reflection.domains?.length" class="metadata-group">
            <h4 class="metadata-title">Domains</h4>
            <div class="tag-list">
              <Badge 
                v-for="domain in reflection.domains" 
                :key="domain"
                variant="outline"
                class="domain-tag"
              >
                {{ domain }}
              </Badge>
            </div>
          </div>
          
          <!-- Keywords -->
          <div v-if="reflection.keywords?.length" class="metadata-group">
            <h4 class="metadata-title">Keywords</h4>
            <div class="tag-list">
              <Badge 
                v-for="keyword in reflection.keywords.slice(0, 10)" 
                :key="keyword"
                variant="outline"
                class="keyword-tag"
              >
                {{ keyword }}
              </Badge>
            </div>
          </div>
        </div>
        
        <!-- Relevance Scores -->
        <div v-if="hasRelevanceScores" class="scores-section">
          <h4 class="scores-title">Relevance Analysis</h4>
          <div class="scores-grid">
            <div v-if="reflection.contextual_relevance_score" class="score-item">
              <div class="score-label">Contextual Relevance</div>
              <div class="score-bar">
                <div 
                  class="score-fill contextual" 
                  :style="{ width: `${reflection.contextual_relevance_score * 100}%` }"
                ></div>
              </div>
              <div class="score-value">{{ Math.round(reflection.contextual_relevance_score * 100) }}%</div>
            </div>
            
            <div v-if="reflection.similarity_score" class="score-item">
              <div class="score-label">Semantic Similarity</div>
              <div class="score-bar">
                <div 
                  class="score-fill similarity" 
                  :style="{ width: `${reflection.similarity_score * 100}%` }"
                ></div>
              </div>
              <div class="score-value">{{ Math.round(reflection.similarity_score * 100) }}%</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <div class="footer-left">
          <span class="created-at">
            Created {{ formatDate(reflection.created_at) }}
          </span>
        </div>
        
        <div class="footer-actions">
          <button 
            @click="handleFeedback(true)" 
            class="feedback-btn helpful"
            :class="{ active: localFeedback === 'helpful' }"
          >
            <ThumbsUp class="w-4 h-4" />
            Helpful
          </button>
          <button 
            @click="handleFeedback(false)" 
            class="feedback-btn not-helpful"
            :class="{ active: localFeedback === 'not-helpful' }"
          >
            <ThumbsDown class="w-4 h-4" />
            Not Helpful
          </button>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  X, Lightbulb, AlertCircle, Code, Zap, Brain, CheckCircle, 
  XCircle, ThumbsUp, ThumbsDown 
} from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import Badge from '@/components/ui/Badge.vue'

interface ReflectionSuggestion {
  id: string
  problem_statement: string
  technical_challenge: string
  solution_breakthrough: string
  key_insights: string[]
  failed_approaches?: string[]
  technologies: string[]
  domains: string[]
  complexity: string
  keywords: string[]
  contextual_relevance_score?: number
  similarity_score?: number
  created_at: string
}

interface Props {
  isOpen: boolean
  reflection: ReflectionSuggestion | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  feedback: [helpful: boolean]
}>()

// State
const localFeedback = ref<'helpful' | 'not-helpful' | null>(null)

// Computed
const hasRelevanceScores = computed(() => 
  props.reflection?.contextual_relevance_score !== undefined || 
  props.reflection?.similarity_score !== undefined
)

// Methods
const getComplexityVariant = (complexity: string) => {
  switch (complexity) {
    case 'low': return 'outline'
    case 'medium': return 'secondary'
    case 'high': return 'destructive'
    case 'expert': return 'default'
    default: return 'outline'
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return 'today'
  } else if (diffDays === 1) {
    return 'yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

const handleFeedback = async (helpful: boolean) => {
  if (!props.reflection) return
  
  try {
    const response = await fetch(`http://127.0.0.1:5050/api/reflections/${props.reflection.id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helpful })
    })
    
    if (response.ok) {
      localFeedback.value = helpful ? 'helpful' : 'not-helpful'
      emit('feedback', helpful)
    }
  } catch (error) {
    console.error('Failed to submit feedback:', error)
  }
}
</script>

<style scoped>
.reflection-detail-modal {
  @apply w-full max-w-2xl max-h-[90vh] flex flex-col;
}

.modal-header {
  @apply flex items-center justify-between p-6 border-b border-gray-200;
}

.header-content {
  @apply flex items-center gap-3;
}

.modal-title {
  @apply text-lg font-semibold text-gray-900;
}

.complexity-badge {
  @apply text-xs px-2 py-1 capitalize;
}

.close-btn {
  @apply p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900;
}

.modal-content {
  @apply flex-1 overflow-y-auto p-6 space-y-6;
}

.section {
  @apply space-y-3;
}

.section.highlight {
  @apply p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg;
}

.section-title {
  @apply flex items-center gap-2 text-sm font-semibold text-gray-900;
}

.section-content {
  @apply text-sm text-gray-600 leading-relaxed;
}

.insights-list,
.failed-approaches-list {
  @apply space-y-2;
}

.insight-item,
.failed-approach-item {
  @apply flex items-start gap-2 text-sm text-gray-600;
}

.metadata-section {
  @apply space-y-4 p-4 bg-gray-100/30 rounded-lg;
}

.metadata-group {
  @apply space-y-2;
}

.metadata-title {
  @apply text-xs font-medium text-gray-600 uppercase tracking-wide;
}

.tag-list {
  @apply flex flex-wrap gap-1;
}

.tech-tag,
.domain-tag,
.keyword-tag {
  @apply text-xs px-2 py-1;
}

.scores-section {
  @apply space-y-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg;
}

.scores-title {
  @apply text-sm font-semibold text-gray-900;
}

.scores-grid {
  @apply space-y-3;
}

.score-item {
  @apply flex items-center gap-3;
}

.score-label {
  @apply text-xs text-gray-600 min-w-[120px];
}

.score-bar {
  @apply flex-1 h-2 bg-gray-100 rounded-full overflow-hidden;
}

.score-fill {
  @apply h-full transition-all duration-500 ease-out;
}

.score-fill.contextual {
  @apply bg-blue-500;
}

.score-fill.similarity {
  @apply bg-green-500;
}

.score-value {
  @apply text-xs font-medium text-gray-900 min-w-[40px] text-right;
}

.modal-footer {
  @apply flex items-center justify-between p-6 border-t border-gray-200;
}

.footer-left {
  @apply flex items-center;
}

.created-at {
  @apply text-xs text-gray-600;
}

.footer-actions {
  @apply flex items-center gap-2;
}

.feedback-btn {
  @apply flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 transition-all duration-200 text-sm font-medium;
}

.feedback-btn.helpful {
  @apply hover:border-green-300 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400;
}

.feedback-btn.helpful.active {
  @apply border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400;
}

.feedback-btn.not-helpful {
  @apply hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-400;
}

.feedback-btn.not-helpful.active {
  @apply border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400;
}
</style>