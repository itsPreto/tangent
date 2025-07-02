<template>
  <div class="title-generation-loader inline-flex items-center gap-2">
    <!-- Animated dots -->
    <div class="flex items-center gap-1">
      <div 
        v-for="i in 3" 
        :key="i"
        class="w-1 h-1 bg-primary rounded-full animate-pulse"
        :style="{ 
          animationDelay: `${(i - 1) * 0.2}s`,
          animationDuration: '1s'
        }"
      ></div>
    </div>
    
    <!-- Loading text with typewriter effect -->
    <span class="text-xs text-base-content/60 font-mono">
      {{ displayText }}
    </span>
    
    <!-- Brain icon with subtle glow -->
    <div class="relative">
      <div class="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
      <svg 
        class="w-3 h-3 text-primary relative z-10" 
        fill="currentColor" 
        viewBox="0 0 20 20"
      >
        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
        <path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  messages: {
    type: Array,
    default: () => ['Thinking...', 'Crafting title...', 'Almost there...']
  },
  speed: {
    type: Number,
    default: 150 // milliseconds per character
  }
})

const displayText = ref('')
const currentMessageIndex = ref(0)
const currentCharIndex = ref(0)
let typewriterInterval: number | null = null

const typewriterEffect = () => {
  const currentMessage = props.messages[currentMessageIndex.value]
  
  if (currentCharIndex.value < currentMessage.length) {
    displayText.value += currentMessage[currentCharIndex.value]
    currentCharIndex.value++
  } else {
    // Message complete, wait a bit then move to next
    setTimeout(() => {
      currentMessageIndex.value = (currentMessageIndex.value + 1) % props.messages.length
      currentCharIndex.value = 0
      displayText.value = ''
    }, 800)
  }
}

onMounted(() => {
  typewriterInterval = setInterval(typewriterEffect, props.speed)
})

onUnmounted(() => {
  if (typewriterInterval) {
    clearInterval(typewriterInterval)
  }
})
</script>

<style scoped>
@keyframes pulse {
  0%, 100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

.animate-pulse {
  animation: pulse 1s ease-in-out infinite;
}

@keyframes ping {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  75%, 100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.animate-ping {
  animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.title-generation-loader {
  user-select: none;
}
</style>