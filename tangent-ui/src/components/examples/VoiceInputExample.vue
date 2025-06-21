<template>
  <div class="voice-input-example p-6 max-w-2xl mx-auto">
    <h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">
      Voice Input Example
    </h2>
    
    <div class="space-y-6">
      <!-- Voice Input Component -->
      <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">
          Voice Input with VAD
        </h3>
        
        <VoiceInput 
          @transcription="handleTranscription"
          @submit="handleSubmit"
          @error="handleError"
        />
      </div>
      
      <!-- Message Display -->
      <div v-if="messages.length > 0" class="space-y-3">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Messages
        </h3>
        
        <div class="space-y-2">
          <div 
            v-for="(message, index) in messages" 
            :key="index"
            class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
          >
            <div class="text-sm text-blue-600 dark:text-blue-400 mb-1">
              {{ message.timestamp }} - {{ message.type }}
            </div>
            <div class="text-gray-800 dark:text-gray-200">
              {{ message.text }}
            </div>
          </div>
        </div>
        
        <button
          @click="clearMessages"
          class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Clear Messages
        </button>
      </div>
      
      <!-- Error Display -->
      <div v-if="lastError" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <h4 class="font-semibold text-red-800 dark:text-red-300 mb-2">Error:</h4>
        <p class="text-red-600 dark:text-red-400">{{ lastError }}</p>
      </div>
      
      <!-- Instructions -->
      <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h3 class="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">
          How to Use
        </h3>
        
        <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p><strong>Manual Mode:</strong></p>
          <ul class="list-disc list-inside ml-4 space-y-1">
            <li>Click the microphone button to start recording</li>
            <li>Speak your message</li>
            <li>Click the button again to stop recording</li>
            <li>Review the transcription and edit if needed</li>
            <li>Click "Send Now" or manually submit</li>
          </ul>
          
          <p class="mt-4"><strong>Continuous Mode:</strong></p>
          <ul class="list-disc list-inside ml-4 space-y-1">
            <li>Click the microphone button to start listening</li>
            <li>Speak naturally - the system detects speech automatically</li>
            <li>After 1.5 seconds of silence, it will auto-transcribe and submit</li>
            <li>Adjust VAD settings in the advanced panel</li>
          </ul>
          
          <p class="mt-4"><strong>VAD Settings:</strong></p>
          <ul class="list-disc list-inside ml-4 space-y-1">
            <li><strong>VAD Threshold:</strong> Sensitivity for speech detection (0.1-1.0)</li>
            <li><strong>Min Speech:</strong> Minimum speech duration to consider (100-1000ms)</li>
            <li><strong>Silence Timeout:</strong> How long to wait after speech ends (500-3000ms)</li>
            <li><strong>Max Speech:</strong> Maximum continuous speech duration (10-60s)</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import VoiceInput from '@/components/messages/VoiceInput.vue';

interface Message {
  text: string;
  type: 'transcription' | 'submission';
  timestamp: string;
}

const messages = ref<Message[]>([]);
const lastError = ref<string>('');

const handleTranscription = (text: string) => {
  messages.value.push({
    text,
    type: 'transcription',
    timestamp: new Date().toLocaleTimeString()
  });
  lastError.value = '';
};

const handleSubmit = (text: string) => {
  messages.value.push({
    text,
    type: 'submission',
    timestamp: new Date().toLocaleTimeString()
  });
  lastError.value = '';
};

const handleError = (error: string) => {
  lastError.value = error;
  console.error('Voice input error:', error);
};

const clearMessages = () => {
  messages.value = [];
  lastError.value = '';
};
</script>