<template>
  <div class="register-form-container">
    <form @submit.prevent="handleSubmit" class="register-form">
      <div class="form-header">
        <h2 class="form-title">Create Account</h2>
        <p class="form-subtitle">Join Tangent to start building amazing projects</p>
      </div>

      <div v-if="error" class="error-message">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div class="form-fields">
        <div class="form-field">
          <label for="name" class="field-label">Full Name</label>
          <input
            id="name"
            v-model="formData.name"
            type="text"
            required
            class="field-input"
            :class="{ 'error': nameError }"
            placeholder="Enter your full name"
            @blur="validateName"
          />
          <span v-if="nameError" class="field-error">{{ nameError }}</span>
        </div>

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
              placeholder="Create a strong password"
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
          <div class="password-requirements">
            <div class="requirement" :class="{ 'met': passwordChecks.length }">
              <Check v-if="passwordChecks.length" :size="12" />
              <X v-else :size="12" />
              <span>At least 8 characters</span>
            </div>
            <div class="requirement" :class="{ 'met': passwordChecks.uppercase }">
              <Check v-if="passwordChecks.uppercase" :size="12" />
              <X v-else :size="12" />
              <span>One uppercase letter</span>
            </div>
            <div class="requirement" :class="{ 'met': passwordChecks.lowercase }">
              <Check v-if="passwordChecks.lowercase" :size="12" />
              <X v-else :size="12" />
              <span>One lowercase letter</span>
            </div>
          </div>
        </div>

        <div class="form-field">
          <label for="confirmPassword" class="field-label">Confirm Password</label>
          <input
            id="confirmPassword"
            v-model="formData.confirmPassword"
            type="password"
            required
            class="field-input"
            :class="{ 'error': confirmPasswordError }"
            placeholder="Confirm your password"
            @blur="validateConfirmPassword"
          />
          <span v-if="confirmPasswordError" class="field-error">{{ confirmPasswordError }}</span>
        </div>
      </div>

      <div class="form-actions">
        <button
          type="submit"
          :disabled="isLoading || !isFormValid"
          class="submit-button"
        >
          <span v-if="isLoading" class="loading loading-spinner loading-sm"></span>
          <span v-else>Create Account</span>
        </button>

        <div class="form-links">
          <button type="button" @click="$emit('switch-to-login')" class="link-button">
            Already have an account? Sign in
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { AlertTriangle, Eye, EyeOff, Check, X } from 'lucide-vue-next'
import { useUserStore } from '@/stores/userStore'

const emit = defineEmits<{
  'register-success': []
  'switch-to-login': []
}>()

const userStore = useUserStore()

// Form state
const formData = ref({
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const showPassword = ref(false)
const nameError = ref('')
const emailError = ref('')
const passwordError = ref('')
const confirmPasswordError = ref('')

// Computed
const isLoading = computed(() => userStore.isLoading)
const error = computed(() => userStore.error)

const passwordChecks = computed(() => ({
  length: formData.value.password.length >= 8,
  uppercase: /[A-Z]/.test(formData.value.password),
  lowercase: /[a-z]/.test(formData.value.password)
}))

const isPasswordValid = computed(() => 
  passwordChecks.value.length && 
  passwordChecks.value.uppercase && 
  passwordChecks.value.lowercase
)

const isFormValid = computed(() => 
  formData.value.name && 
  formData.value.email && 
  formData.value.password && 
  formData.value.confirmPassword &&
  !nameError.value && 
  !emailError.value && 
  !passwordError.value &&
  !confirmPasswordError.value &&
  isPasswordValid.value
)

// Validation
const validateName = () => {
  const name = formData.value.name.trim()
  if (!name) {
    nameError.value = 'Name is required'
  } else if (name.length < 2) {
    nameError.value = 'Name must be at least 2 characters'
  } else {
    nameError.value = ''
  }
}

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
  } else if (!isPasswordValid.value) {
    passwordError.value = 'Password does not meet requirements'
  } else {
    passwordError.value = ''
  }
}

const validateConfirmPassword = () => {
  const confirmPassword = formData.value.confirmPassword
  if (!confirmPassword) {
    confirmPasswordError.value = 'Please confirm your password'
  } else if (confirmPassword !== formData.value.password) {
    confirmPasswordError.value = 'Passwords do not match'
  } else {
    confirmPasswordError.value = ''
  }
}

// Watch for password changes to revalidate confirm password
watch(() => formData.value.password, () => {
  if (formData.value.confirmPassword) {
    validateConfirmPassword()
  }
})

// Actions
const handleSubmit = async () => {
  // Validate all fields
  validateName()
  validateEmail()
  validatePassword()
  validateConfirmPassword()

  if (!isFormValid.value) {
    return
  }

  userStore.clearError()
  
  const success = await userStore.register({
    name: formData.value.name.trim(),
    email: formData.value.email.trim(),
    password: formData.value.password
  })

  if (success) {
    emit('register-success')
  }
}
</script>

<style scoped>
.register-form-container {
  max-width: 400px;
  margin: 0 auto;
  padding: 2rem;
}

.register-form {
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

.password-requirements {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.requirement {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: hsl(var(--bc) / 0.6);
  transition: color 0.2s ease;
}

.requirement.met {
  color: hsl(var(--su));
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