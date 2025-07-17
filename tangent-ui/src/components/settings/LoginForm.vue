<template>
  <div class="login-form-container">
    <form @submit.prevent="handleSubmit" class="login-form">
      <div class="form-header">
        <h2 class="form-title">Welcome Back</h2>
        <p class="form-subtitle">Sign in to your Tangent account</p>
      </div>

      <div v-if="error" class="error-message">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div class="form-fields">
        <div class="form-field">
          <label for="email" class="field-label">Email</label>
          <input
            id="email"
            v-model="formData.email"
            type="email"
            required
            class="field-input"
            :class="{ 'error': emailError }"
            placeholder="Enter your email"
            @blur="validateEmail"
          />
          <span v-if="emailError" class="field-error">{{ emailError }}</span>
        </div>

        <div class="form-field">
          <label for="password" class="field-label">Password</label>
          <div class="password-input-container">
            <input
              id="password"
              v-model="formData.password"
              :type="showPassword ? 'text' : 'password'"
              required
              class="field-input"
              :class="{ 'error': passwordError }"
              placeholder="Enter your password"
              @blur="validatePassword"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="password-toggle"
            >
              <Eye v-if="!showPassword" :size="16" />
              <EyeOff v-else :size="16" />
            </button>
          </div>
          <span v-if="passwordError" class="field-error">{{ passwordError }}</span>
        </div>
      </div>

      <div class="form-actions">
        <button
          type="submit"
          :disabled="isLoading || !isFormValid"
          class="submit-button"
        >
          <span v-if="isLoading" class="loading loading-spinner loading-sm"></span>
          <span v-else>Sign In</span>
        </button>

        <div class="form-links">
          <button type="button" @click="$emit('switch-to-register')" class="link-button">
            Don't have an account? Sign up
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { AlertTriangle, Eye, EyeOff } from 'lucide-vue-next'
import { useUserStore } from '@/stores/userStore'

const emit = defineEmits<{
  'login-success': []
  'switch-to-register': []
}>()

const userStore = useUserStore()

// Form state
const formData = ref({
  email: '',
  password: ''
})

const showPassword = ref(false)
const emailError = ref('')
const passwordError = ref('')

// Computed
const isLoading = computed(() => userStore.isLoading)
const error = computed(() => userStore.error)
const isFormValid = computed(() => 
  formData.value.email && 
  formData.value.password && 
  !emailError.value && 
  !passwordError.value
)

// Validation
const validateEmail = () => {
  const email = formData.value.email.trim()
  if (!email) {
    emailError.value = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailError.value = 'Please enter a valid email address'
  } else {
    emailError.value = ''
  }
}

const validatePassword = () => {
  const password = formData.value.password
  if (!password) {
    passwordError.value = 'Password is required'
  } else if (password.length < 8) {
    passwordError.value = 'Password must be at least 8 characters'
  } else {
    passwordError.value = ''
  }
}

// Actions
const handleSubmit = async () => {
  // Validate all fields
  validateEmail()
  validatePassword()

  if (!isFormValid.value) {
    return
  }

  userStore.clearError()
  
  const success = await userStore.login({
    email: formData.value.email.trim(),
    password: formData.value.password
  })

  if (success) {
    emit('login-success')
  }
}
</script>

<style scoped>
.login-form-container {
  max-width: 400px;
  margin: 0 auto;
  padding: 2rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-header {
  text-align: center;
  margin-bottom: 1rem;
}

.form-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: hsl(var(--bc));
  margin-bottom: 0.5rem;
}

.form-subtitle {
  color: hsl(var(--bc) / 0.6);
  font-size: 0.875rem;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: hsl(var(--er) / 0.1);
  border: 1px solid hsl(var(--er) / 0.3);
  border-radius: 0.5rem;
  color: hsl(var(--er));
  font-size: 0.875rem;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-weight: 500;
  color: hsl(var(--bc));
  font-size: 0.875rem;
}

.field-input {
  padding: 0.75rem;
  border: 1px solid hsl(var(--b3));
  border-radius: 0.5rem;
  background: hsl(var(--b1));
  color: hsl(var(--bc));
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.field-input:focus {
  outline: none;
  border-color: hsl(var(--p));
  box-shadow: 0 0 0 3px hsl(var(--p) / 0.1);
}

.field-input.error {
  border-color: hsl(var(--er));
}

.password-input-container {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: hsl(var(--bc) / 0.5);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: color 0.2s ease;
}

.password-toggle:hover {
  color: hsl(var(--bc));
}

.field-error {
  color: hsl(var(--er));
  font-size: 0.75rem;
}

.form-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: hsl(var(--p));
  color: hsl(var(--pc));
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  background: hsl(var(--p) / 0.9);
  transform: translateY(-1px);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.form-links {
  text-align: center;
}

.link-button {
  background: none;
  border: none;
  color: hsl(var(--p));
  font-size: 0.875rem;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s ease;
}

.link-button:hover {
  color: hsl(var(--p) / 0.8);
}
</style>