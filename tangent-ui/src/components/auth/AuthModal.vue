<template>
  <div v-if="isOpen" class="auth-modal-overlay" @click="closeModal">
    <div class="auth-modal" @click.stop>
      <div class="auth-header">
        <h2 class="auth-title">{{ isLogin ? 'Sign In' : 'Sign Up' }}</h2>
        <button @click="closeModal" class="close-btn">
          <X class="w-5 h-5" />
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" class="auth-form">
        <div v-if="!isLogin" class="form-group">
          <label for="name" class="form-label">Name</label>
          <input 
            id="name"
            v-model="form.name"
            type="text"
            class="form-input"
            :class="{ 'error': errors.name }"
            placeholder="Enter your name"
            required
          />
          <span v-if="errors.name" class="error-message">{{ errors.name }}</span>
        </div>
        
        <div class="form-group">
          <label for="email" class="form-label">Email</label>
          <input 
            id="email"
            v-model="form.email"
            type="email"
            class="form-input"
            :class="{ 'error': errors.email }"
            placeholder="Enter your email"
            required
          />
          <span v-if="errors.email" class="error-message">{{ errors.email }}</span>
        </div>
        
        <div class="form-group">
          <label for="password" class="form-label">Password</label>
          <input 
            id="password"
            v-model="form.password"
            type="password"
            class="form-input"
            :class="{ 'error': errors.password }"
            placeholder="Enter your password"
            required
          />
          <span v-if="errors.password" class="error-message">{{ errors.password }}</span>
        </div>
        
        <div v-if="userStore.error" class="error-message global-error">
          {{ userStore.error }}
        </div>
        
        <button 
          type="submit" 
          class="auth-submit-btn"
          :disabled="userStore.isLoading"
          :class="{ 'loading': userStore.isLoading }"
        >
          <span v-if="userStore.isLoading" class="loading-spinner"></span>
          {{ isLogin ? 'Sign In' : 'Sign Up' }}
        </button>
      </form>
      
      <div class="auth-footer">
        <p class="auth-switch">
          {{ isLogin ? "Don't have an account?" : "Already have an account?" }}
          <button @click="toggleMode" class="auth-switch-btn">
            {{ isLogin ? 'Sign Up' : 'Sign In' }}
          </button>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useUserStore } from '@/stores/userStore'

interface Props {
  isOpen: boolean
  initialMode?: 'login' | 'register'
}

interface Emits {
  (e: 'close'): void
  (e: 'success'): void
}

const props = withDefaults(defineProps<Props>(), {
  initialMode: 'login'
})

const emit = defineEmits<Emits>()

const userStore = useUserStore()

const isLogin = ref(props.initialMode === 'login')
const form = reactive({
  name: '',
  email: '',
  password: ''
})

const errors = reactive({
  name: '',
  email: '',
  password: ''
})

const validateForm = () => {
  // Reset errors
  errors.name = ''
  errors.email = ''
  errors.password = ''
  
  let isValid = true
  
  if (!isLogin.value && !form.name.trim()) {
    errors.name = 'Name is required'
    isValid = false
  }
  
  if (!form.email.trim()) {
    errors.email = 'Email is required'
    isValid = false
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Please enter a valid email'
    isValid = false
  }
  
  if (!form.password.trim()) {
    errors.password = 'Password is required'
    isValid = false
  } else if (form.password.length < 6) {
    errors.password = 'Password must be at least 6 characters'
    isValid = false
  }
  
  return isValid
}

const handleSubmit = async () => {
  if (!validateForm()) return
  
  userStore.clearError()
  
  try {
    let success = false
    
    if (isLogin.value) {
      success = await userStore.login({
        email: form.email,
        password: form.password
      })
    } else {
      success = await userStore.register({
        email: form.email,
        name: form.name,
        password: form.password
      })
    }
    
    if (success) {
      emit('success')
      closeModal()
    }
  } catch (error) {
    console.error('Auth error:', error)
  }
}

const toggleMode = () => {
  isLogin.value = !isLogin.value
  userStore.clearError()
  
  // Reset form
  form.name = ''
  form.email = ''
  form.password = ''
  
  // Reset errors
  errors.name = ''
  errors.email = ''
  errors.password = ''
}

const closeModal = () => {
  emit('close')
}

// Watch for prop changes
watch(() => props.initialMode, (newMode) => {
  isLogin.value = newMode === 'login'
})

// Clear errors when modal closes
watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    userStore.clearError()
  }
})
</script>

<style scoped>
.auth-modal-overlay {
  @apply fixed inset-0 bg-black/50 flex items-center justify-center z-50;
  backdrop-filter: blur(4px);
}

.auth-modal {
  @apply bg-base-100 rounded-lg shadow-xl w-full max-w-md mx-4;
  animation: modal-appear 0.2s ease-out;
}

@keyframes modal-appear {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.auth-header {
  @apply flex items-center justify-between p-6 border-b border-base-300;
}

.auth-title {
  @apply text-2xl font-bold text-base-content;
}

.close-btn {
  @apply p-2 hover:bg-base-200 rounded-full transition-colors;
}

.auth-form {
  @apply p-6 space-y-4;
}

.form-group {
  @apply space-y-2;
}

.form-label {
  @apply block text-sm font-medium text-base-content;
}

.form-input {
  @apply w-full px-3 py-2 border border-base-300 rounded-md bg-base-100 text-base-content;
  @apply focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent;
  @apply transition-colors;
}

.form-input.error {
  @apply border-error focus:ring-error;
}

.error-message {
  @apply text-sm text-error;
}

.global-error {
  @apply p-3 bg-error/10 border border-error/20 rounded-md;
}

.auth-submit-btn {
  @apply w-full bg-primary text-primary-content py-3 rounded-md font-medium;
  @apply hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2;
  @apply disabled:opacity-50 disabled:cursor-not-allowed;
  @apply transition-colors flex items-center justify-center gap-2;
}

.loading-spinner {
  @apply w-5 h-5 border-2 border-primary-content/30 border-t-primary-content rounded-full animate-spin;
}

.auth-footer {
  @apply p-6 border-t border-base-300;
}

.auth-switch {
  @apply text-center text-base-content/70;
}

.auth-switch-btn {
  @apply text-primary hover:text-primary/80 font-medium ml-1;
  @apply transition-colors;
}
</style>