<template>
  <div 
    class="insight-card"
    :class="[
      `insight-${insight.type}`,
      { 'actionable': insight.actionable }
    ]"
  >
    <!-- Icon and Type -->
    <div class="insight-header">
      <div class="insight-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <!-- Unfinished Project Icon -->
          <template v-if="insight.type === 'unfinished'">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 12l4 4 8-8"/>
            <path d="M8 12l4 4" opacity="0.3"/>
          </template>
          
          <!-- Pattern Icon -->
          <template v-else-if="insight.type === 'pattern'">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </template>
          
          <!-- Suggestion Icon -->
          <template v-else-if="insight.type === 'suggestion'">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </template>
          
          <!-- Error Icon -->
          <template v-else-if="insight.type === 'error'">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </template>
          
          <!-- Default Icon -->
          <template v-else>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </template>
        </svg>
      </div>
      <div class="insight-meta">
        <span class="insight-type">{{ formatType(insight.type) }}</span>
        <div class="confidence-bar">
          <div 
            class="confidence-fill"
            :style="{ width: `${insight.confidence * 100}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="insight-content">
      <h4 class="insight-title">{{ insight.title }}</h4>
      <p class="insight-description">{{ insight.description }}</p>
    </div>

    <!-- Metadata -->
    <div v-if="hasMetadata" class="insight-metadata">
      <div v-if="insight.metadata?.size" class="meta-item">
        <span class="meta-label">Conversations:</span>
        <span class="meta-value">{{ insight.metadata.size }}</span>
      </div>
      
      <div v-if="insight.metadata?.completionRate !== undefined" class="meta-item">
        <span class="meta-label">Completion:</span>
        <span class="meta-value">{{ (insight.metadata.completionRate * 100).toFixed(0) }}%</span>
      </div>
      
      <div class="meta-item">
        <span class="meta-label">Related:</span>
        <span class="meta-value">{{ insight.relatedConversations.length }} chats</span>
      </div>
    </div>

    <!-- Suggestions -->
    <div v-if="insight.metadata?.suggestions" class="insight-suggestions">
      <div class="suggestions-label">Suggested Actions:</div>
      <div class="suggestions-text">{{ insight.metadata.suggestions }}</div>
    </div>

    <!-- Action Button -->
    <div v-if="insight.actionable" class="insight-actions">
      <button 
        @click="$emit('actionClick')"
        class="action-button"
        :class="getActionButtonClass()"
      >
        {{ getActionText() }}
      </button>
    </div>

    <!-- Confidence Indicator -->
    <div class="confidence-indicator">
      <span class="confidence-label">Confidence:</span>
      <span class="confidence-value">{{ (insight.confidence * 100).toFixed(0) }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Insight } from '@/types/archive'

const props = defineProps<{
  insight: Insight
}>()

defineEmits<{
  actionClick: []
}>()

const hasMetadata = computed(() => {
  return props.insight.metadata && (
    props.insight.metadata.size !== undefined ||
    props.insight.metadata.completionRate !== undefined ||
    props.insight.relatedConversations.length > 0
  )
})

function formatType(type: string): string {
  switch (type) {
    case 'unfinished':
      return 'Unfinished Project'
    case 'pattern':
      return 'Pattern Detected'
    case 'suggestion':
      return 'Suggestion'
    case 'error':
      return 'Error'
    default:
      return type.charAt(0).toUpperCase() + type.slice(1)
  }
}

function getActionText(): string {
  switch (props.insight.type) {
    case 'unfinished':
      return 'View Project'
    case 'pattern':
      return 'Explore Pattern'
    case 'suggestion':
      return 'View Suggestions'
    default:
      return 'Take Action'
  }
}

function getActionButtonClass(): string {
  switch (props.insight.type) {
    case 'unfinished':
      return 'action-unfinished'
    case 'pattern':
      return 'action-pattern'
    case 'suggestion':
      return 'action-suggestion'
    default:
      return 'action-default'
  }
}
</script>

<style scoped>
.insight-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.insight-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: #e2e8f0;
}

.insight-card.insight-unfinished::before {
  background: #f56565;
}

.insight-card.insight-pattern::before {
  background: #4299e1;
}

.insight-card.insight-suggestion::before {
  background: #48bb78;
}

.insight-card.insight-error::before {
  background: #ed8936;
}

.insight-card:hover {
  border-color: #cbd5e0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.insight-card.actionable {
  cursor: pointer;
}

.insight-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.insight-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #f7fafc;
  flex-shrink: 0;
}

.insight-unfinished .insight-icon {
  background: #fed7d7;
  color: #e53e3e;
}

.insight-pattern .insight-icon {
  background: #ebf8ff;
  color: #3182ce;
}

.insight-suggestion .insight-icon {
  background: #f0fff4;
  color: #38a169;
}

.insight-error .insight-icon {
  background: #feebc8;
  color: #dd6b20;
}

.insight-meta {
  flex: 1;
  min-width: 0;
}

.insight-type {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 0.25rem;
}

.confidence-bar {
  height: 4px;
  background: #e2e8f0;
  border-radius: 2px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: linear-gradient(90deg, #f56565 0%, #ed8936 50%, #48bb78 100%);
  transition: width 0.3s ease;
}

.insight-content {
  margin-bottom: 1rem;
}

.insight-title {
  margin: 0 0 0.5rem 0;
  color: #2d3748;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
}

.insight-description {
  margin: 0;
  color: #4a5568;
  font-size: 0.875rem;
  line-height: 1.5;
}

.insight-metadata {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
}

.meta-item {
  display: flex;
  flex-direction: column;
  text-align: center;
}

.meta-label {
  font-size: 0.75rem;
  color: #718096;
  margin-bottom: 0.25rem;
}

.meta-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #2d3748;
}

.insight-suggestions {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f0fff4;
  border-radius: 8px;
  border: 1px solid #c6f6d5;
}

.suggestions-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #2f855a;
  margin-bottom: 0.5rem;
}

.suggestions-text {
  font-size: 0.875rem;
  color: #276749;
  line-height: 1.5;
}

.insight-actions {
  margin-bottom: 1rem;
}

.action-button {
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-unfinished {
  background: #fed7d7;
  color: #c53030;
  border: 1px solid #feb2b2;
}

.action-unfinished:hover {
  background: #feb2b2;
}

.action-pattern {
  background: #ebf8ff;
  color: #2b6cb0;
  border: 1px solid #bee3f8;
}

.action-pattern:hover {
  background: #bee3f8;
}

.action-suggestion {
  background: #f0fff4;
  color: #2f855a;
  border: 1px solid #c6f6d5;
}

.action-suggestion:hover {
  background: #c6f6d5;
}

.action-default {
  background: #edf2f7;
  color: #4a5568;
  border: 1px solid #e2e8f0;
}

.action-default:hover {
  background: #e2e8f0;
}

.confidence-indicator {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid #f1f5f9;
  font-size: 0.75rem;
}

.confidence-label {
  color: #718096;
}

.confidence-value {
  font-weight: 600;
  color: #4a5568;
}

/* Responsive design */
@media (max-width: 640px) {
  .insight-card {
    padding: 1rem;
  }
  
  .insight-metadata {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .meta-item {
    flex-direction: row;
    justify-content: space-between;
    text-align: left;
  }
}
</style>