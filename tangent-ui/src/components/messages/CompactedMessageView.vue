<template>
  <div class="compacted-message-container border-l-4 border-primary/30 bg-base-100/50 rounded-r-lg my-3">
    <div class="p-4">
      <!-- Header with collapse/expand controls -->
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <Archive class="w-4 h-4 text-primary/70" />
          <span class="text-sm font-semibold text-primary/90">
            Compacted Summary
          </span>
          <Badge variant="secondary" class="text-xs">
            {{ compactedData.originalMessageCount }} messages
          </Badge>
        </div>
        
        <div class="flex items-center gap-2">
          <span class="text-xs text-base-content/60">
            {{ formatDate(compactedData.compactedAt) }}
          </span>
          <button
            @click="toggleExpansion"
            class="p-1 rounded-full hover:bg-base-200 transition-colors"
            :title="isExpanded ? 'Collapse summary' : 'Expand to see original messages'"
          >
            <ChevronDown 
              class="w-4 h-4 text-base-content/60 transition-transform duration-200" 
              :class="{ 'rotate-180': isExpanded }" 
            />
          </button>
        </div>
      </div>

      <!-- Summary content -->
      <div class="mb-3">
        <p class="text-sm text-base-content/80 leading-relaxed">
          {{ compactedData.summary }}
        </p>
      </div>

      <!-- Branch options -->
      <div class="flex items-center gap-2 text-xs">
        <button
          @click="$emit('continue-conversation')"
          class="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors"
        >
          Continue Here
        </button>
        <button
          @click="$emit('branch-from-last')"
          class="px-3 py-1 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-full transition-colors"
        >
          Branch from Last Message
        </button>
      </div>
    </div>

    <!-- Expanded original messages -->
    <div 
      v-if="isExpanded && compactedData.originalMessages" 
      class="border-t border-base-300/50 bg-base-50/30"
    >
      <div class="p-3">
        <div class="text-xs font-semibold text-base-content/70 mb-3 flex items-center gap-2">
          <History class="w-3 h-3" />
          Original Messages ({{ compactedData.originalMessageCount }})
        </div>
        
        <div class="space-y-2 max-h-96 overflow-y-auto">
          <div 
            v-for="(message, index) in compactedData.originalMessages" 
            :key="index"
            class="text-xs p-2 rounded border border-base-300/30"
            :class="message.role === 'user' ? 'bg-blue-50/30' : 'bg-green-50/30'"
          >
            <div class="font-semibold mb-1 capitalize">{{ message.role }}</div>
            <div class="text-base-content/70 line-clamp-3">{{ message.content }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Archive, ChevronDown, History } from 'lucide-vue-next'
import Badge from '@/components/ui/Badge.vue'
import type { CompactedMessageData } from '@/types/message'

interface Props {
  compactedData: CompactedMessageData
}

interface Emits {
  (e: 'continue-conversation'): void
  (e: 'branch-from-last'): void
  (e: 'toggle-expansion', expanded: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isExpanded = ref(props.compactedData.isExpanded || false)

const toggleExpansion = () => {
  isExpanded.value = !isExpanded.value
  emit('toggle-expansion', isExpanded.value)
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}
</script>

<style scoped>
.compacted-message-container {
  position: relative;
}

.compacted-message-container::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 100%);
  border-radius: 2px;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>