<template>
  <div class="auth-container">
    <!-- Welcome Screen with individual section controls -->
    <div class="welcome-wrapper">
      <slot />
    </div>
    
    <!-- Auth form appears in place of welcome content -->
    <div v-if="isRevealed" class="auth-form-container">
      <div class="auth-card">
        <div class="auth-header">
          <h2 class="auth-title">Welcome Back</h2>
          <p class="auth-subtitle">Sign in to continue</p>
        </div>

        <div class="auth-tabs">
          <button 
            @click="activeTab = 'login'"
            :class="{ 'active': activeTab === 'login' }"
            class="tab-btn"
          >
            Sign In
          </button>
          <button 
            @click="activeTab = 'register'"
            :class="{ 'active': activeTab === 'register' }"
            class="tab-btn"
          >
            Sign Up
          </button>
        </div>

        <div class="auth-form">
          <LoginForm 
            v-if="activeTab === 'login'"
            @login-success="handleAuthSuccess"
            @switch-to-register="activeTab = 'register'"
          />
          <RegisterForm 
            v-if="activeTab === 'register'"
            @register-success="handleAuthSuccess"
            @switch-to-login="activeTab = 'login'"
          />
        </div>

        <button @click="handleCancel" class="cancel-btn">
          <X :size="16" />
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useAppStore } from '@/stores/appStore'
import { useUserStore } from '@/stores/userStore'
import LoginForm from '@/components/settings/LoginForm.vue'
import RegisterForm from '@/components/settings/RegisterForm.vue'

const appStore = useAppStore()
const userStore = useUserStore()

const activeTab = ref<'login' | 'register'>('login')

const isRevealed = computed(() => appStore.isAuthRequired)

const handleAuthSuccess = () => {
  appStore.completeAuthFlow()
}

const handleCancel = () => {
  appStore.cancelAuthFlow()
}

// No need for scroll watching - CSS handles the animation
</script>

<style scoped>
.auth-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.welcome-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.auth-form-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: hsl(var(--b1));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeInScale 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.auth-card {
  max-width: 400px;
  width: 100%;
  background: hsl(var(--b2));
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: hsl(var(--bc));
  margin-bottom: 0.5rem;
}

.auth-subtitle {
  color: hsl(var(--bc) / 0.6);
  font-size: 0.875rem;
}

.auth-tabs {
  display: flex;
  gap: 0.25rem;
  background: hsl(var(--b3));
  border-radius: 0.5rem;
  padding: 0.25rem;
  margin-bottom: 2rem;
}

.tab-btn {
  flex: 1;
  padding: 0.75rem;
  border: none;
  background: none;
  color: hsl(var(--bc) / 0.6);
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: hsl(var(--b1));
  color: hsl(var(--bc));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.auth-form {
  margin-bottom: 2rem;
}

.cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  background: hsl(var(--b3));
  color: hsl(var(--bc) / 0.7);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.cancel-btn:hover {
  background: hsl(var(--b1));
  color: hsl(var(--bc));
}
</style>