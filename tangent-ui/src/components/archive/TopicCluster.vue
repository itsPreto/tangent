<template>
  <div 
    class="topic-cluster"
    :class="{ 
      'selected': isSelected,
      'low-completion': cluster.completionRate < 0.5,
      'high-completion': cluster.completionRate >= 0.8
    }"
    @click="$emit('click')"
  >
    <!-- Header -->
    <div class="cluster-header">
      <h3 class="cluster-name">{{ cluster.name }}</h3>
      <div class="cluster-size">{{ cluster.size }}</div>
    </div>

    <!-- Completion Rate -->
    <div class="completion-section">
      <div class="completion-label">Completion Rate</div>
      <div class="completion-bar">
        <div 
          class="completion-fill"
          :style="{ width: `${cluster.completionRate * 100}%` }"
        ></div>
      </div>
      <div class="completion-text">{{ (cluster.completionRate * 100).toFixed(0) }}%</div>
    </div>

    <!-- Stats -->
    <div class="cluster-stats">
      <div class="stat-item">
        <span class="stat-label">Avg Messages</span>
        <span class="stat-value">{{ cluster.avgMessageCount.toFixed(1) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Conversations</span>
        <span class="stat-value">{{ cluster.size }}</span>
      </div>
    </div>

    <!-- Keywords -->
    <div class="keywords-section">
      <div class="keywords-label">Keywords</div>
      <div class="keywords-list">
        <span 
          v-for="keyword in cluster.keywords.slice(0, 5)" 
          :key="keyword"
          class="keyword-tag"
        >
          {{ keyword }}
        </span>
        <span v-if="cluster.keywords.length > 5" class="more-keywords">
          +{{ cluster.keywords.length - 5 }} more
        </span>
      </div>
    </div>

    <!-- Date Range (if available) -->
    <div v-if="cluster.dateRange.start && cluster.dateRange.end" class="date-range">
      <div class="date-label">Time Period</div>
      <div class="date-text">{{ formatDateRange() }}</div>
    </div>

    <!-- Action Indicator -->
    <div class="action-indicator">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="1"/>
        <circle cx="19" cy="12" r="1"/>
        <circle cx="5" cy="12" r="1"/>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TopicCluster } from '@/types/archive'

defineEmits<{
  click: []
}>()

const props = defineProps<{
  cluster: TopicCluster
  isSelected?: boolean
  showDetails?: boolean
}>()

function formatDateRange(): string {
  if (!props.cluster.dateRange.start || !props.cluster.dateRange.end) {
    return 'Unknown period'
  }
  
  try {
    const start = new Date(props.cluster.dateRange.start)
    const end = new Date(props.cluster.dateRange.end)
    
    const startStr = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    const endStr = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    
    if (startStr === endStr) {
      return startStr
    }
    
    return `${startStr} - ${endStr}`
  } catch {
    return 'Unknown period'
  }
}
</script>

<style scoped>
.topic-cluster {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.topic-cluster:hover {
  border-color: #cbd5e0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

.topic-cluster.selected {
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.topic-cluster.low-completion {
  border-left: 4px solid #f56565;
}

.topic-cluster.high-completion {
  border-left: 4px solid #48bb78;
}

.cluster-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.cluster-name {
  margin: 0;
  color: #2d3748;
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.3;
  flex: 1;
  margin-right: 1rem;
}

.cluster-size {
  background: #edf2f7;
  color: #4a5568;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
  min-width: fit-content;
}

.completion-section {
  margin-bottom: 1rem;
}

.completion-label {
  font-size: 0.875rem;
  color: #718096;
  margin-bottom: 0.5rem;
}

.completion-bar {
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.completion-fill {
  height: 100%;
  background: linear-gradient(90deg, #f56565 0%, #ed8936 50%, #48bb78 100%);
  transition: width 0.3s ease;
}

.completion-text {
  font-size: 0.875rem;
  color: #4a5568;
  font-weight: 500;
}

.cluster-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 6px;
}

.stat-label {
  font-size: 0.75rem;
  color: #718096;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
}

.keywords-section {
  margin-bottom: 1rem;
}

.keywords-label {
  font-size: 0.875rem;
  color: #718096;
  margin-bottom: 0.5rem;
}

.keywords-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.keyword-tag {
  background: #e6fffa;
  color: #285e61;
  border: 1px solid #b2f5ea;
  padding: 0.25rem 0.5rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
}

.more-keywords {
  color: #718096;
  font-size: 0.75rem;
  font-style: italic;
  padding: 0.25rem 0;
}

.date-range {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f7fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.date-label {
  font-size: 0.75rem;
  color: #718096;
  margin-bottom: 0.25rem;
}

.date-text {
  font-size: 0.875rem;
  color: #4a5568;
  font-weight: 500;
}

.action-indicator {
  position: absolute;
  top: 1rem;
  right: 1rem;
  color: #cbd5e0;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.topic-cluster:hover .action-indicator {
  opacity: 1;
}

.topic-cluster.selected .action-indicator {
  opacity: 1;
  color: #4299e1;
}

/* Responsive design */
@media (max-width: 640px) {
  .topic-cluster {
    padding: 1rem;
  }
  
  .cluster-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .cluster-name {
    margin-right: 0;
  }
  
  .cluster-stats {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .stat-item {
    flex-direction: row;
    justify-content: space-between;
    text-align: left;
  }
}
</style>