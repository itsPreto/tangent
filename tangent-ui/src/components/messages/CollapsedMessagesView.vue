<template>
  <div class="collapsed-messages-container bg-base-200/50 border border-base-300/50 rounded-lg overflow-hidden">
    <!-- Header with compaction info -->
    <div class="flex items-center justify-between p-3 bg-base-300/30 border-b border-base-300/50">
      <div class="flex items-center gap-2 text-sm text-base-content/70">
        <Archive class="w-4 h-4" />
        <span>{{ compactedSection.originalMessages.length }} messages compacted</span>
        <span class="text-xs opacity-60">({{ formatDate(compactedSection.createdAt) }})</span>
      </div>
      <div class="flex items-center gap-1 text-xs text-base-content/60">
        <Hash class="w-3 h-3" />
        <span>{{ compactedSection.tokenCount.toLocaleString() }} tokens</span>
      </div>
    </div>

    <!-- Split-view container with click zones -->
    <div class="relative h-32 flex">
      <!-- Left zone: expand to show full messages -->
      <div 
        @click="$emit('expand-messages')"
        class="flex-1 p-4 cursor-pointer hover:bg-primary/5 transition-colors border-r border-base-300/30"
        :class="{ 'bg-primary/10': showingExpanded }"
      >
        <div class="h-full flex flex-col justify-center">
          <div class="flex items-center gap-2 mb-2">
            <ChevronRight class="w-4 h-4 text-primary" />
            <span class="text-sm font-medium text-base-content">View Full Messages</span>
          </div>
          <p class="text-xs text-base-content/60 line-clamp-3">
            Click to expand and view the complete conversation history with all {{ compactedSection.originalMessages.length }} messages in chronological order.
          </p>
        </div>
      </div>

      <!-- Right zone: show compact summary -->
      <div 
        @click="$emit('show-summary')"
        class="flex-1 p-4 cursor-pointer hover:bg-secondary/5 transition-colors"
        :class="{ 'bg-secondary/10': showingSummary }"
      >
        <div class="h-full flex flex-col">
          <div class="flex items-center gap-2 mb-2">
            <FileText class="w-4 h-4 text-secondary" />
            <span class="text-sm font-medium text-base-content">Compact Summary</span>
          </div>
          <div class="text-xs text-base-content/70 line-clamp-4 overflow-hidden">
            {{ truncatedSummary }}
          </div>
        </div>
      </div>
    </div>

    <!-- Status indicators -->
    <div class="flex justify-between items-center px-3 py-2 bg-base-300/20 text-xs">
      <span class="text-base-content/50">
        {{ statusText }}
      </span>
      <button 
        @click="$emit('remove-compaction')"
        class="text-warning hover:text-warning/80 transition-colors"
        title="Remove compaction and restore full messages"
      >
        <RotateCcw class="w-3 h-3" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Archive, Hash, ChevronRight, FileText, RotateCcw } from 'lucide-vue-next';
import type { CompactedSection } from '@/services/tokenTrackingService';

const props = defineProps<{
  compactedSection: CompactedSection;
  showingExpanded?: boolean;
  showingSummary?: boolean;
}>();

defineEmits<{
  'expand-messages': [];
  'show-summary': [];
  'remove-compaction': [];
}>();

const truncatedSummary = computed(() => {
  const summary = props.compactedSection.summary;
  return summary.length > 150 ? summary.substring(0, 150) + '...' : summary;
});

const statusText = computed(() => {
  if (props.showingExpanded) return 'Showing full message history';
  if (props.showingSummary) return 'Using compact summary as context';
  return 'Click left to expand • Click right for summary';
});

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}
</script>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-4 {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.collapsed-messages-container {
  transition: all 0.2s ease;
}

.collapsed-messages-container:hover {
  border-color: theme('colors.primary' / 0.3);
}
</style>