<template>
  <div class="profile-settings-container" :class="'theme-' + currentTheme">
    <div class="profile-content">
      <!-- Header with back button -->
      <div class="profile-settings-header">
        <button @click="$emit('back-to-canvas')" class="back-button">
          <ArrowLeft :size="20" />
          <span>Back to Canvas</span>
        </button>
        <h1 class="page-title">Profile & Settings</h1>
      </div>
      <!-- Authentication Section (when not logged in) -->
    <div v-if="!isAuthenticated" class="auth-section">
      <div class="auth-header">
        <div class="auth-icon">
          <User :size="48" />
        </div>
        <h1 class="auth-title">Welcome to Tangent</h1>
        <p class="auth-subtitle">Sign in to sync your workspaces and settings across devices</p>
      </div>

      <div class="auth-forms">
        <div class="form-tabs">
          <button 
            @click="activeAuthTab = 'login'"
            :class="{ 'active': activeAuthTab === 'login' }"
            class="tab-button"
          >
            Sign In
          </button>
          <button 
            @click="activeAuthTab = 'register'"
            :class="{ 'active': activeAuthTab === 'register' }"
            class="tab-button"
          >
            Sign Up
          </button>
        </div>

        <div class="form-content">
          <LoginForm 
            v-if="activeAuthTab === 'login'"
            @login-success="handleAuthSuccess"
            @switch-to-register="activeAuthTab = 'register'"
          />
          <RegisterForm 
            v-if="activeAuthTab === 'register'"
            @register-success="handleAuthSuccess"
            @switch-to-login="activeAuthTab = 'login'"
          />
        </div>
      </div>
    </div>

    <!-- Profile Settings Section (when logged in) -->
    <div v-else class="profile-section">
      <div class="profile-header">
        <div class="profile-avatar">
          <img v-if="userAvatar" :src="userAvatar" :alt="userName" class="avatar-image" />
          <div v-else class="avatar-placeholder">
            <User :size="32" />
          </div>
        </div>
        <div class="profile-info">
          <h1 class="profile-name">{{ userName }}</h1>
          <p class="profile-email">{{ userEmail }}</p>
        </div>
        <button @click="handleLogout" class="logout-button">
          <LogOut :size="16" />
          <span>Sign Out</span>
        </button>
      </div>

      <div class="settings-content">
        <div class="settings-tabs">
          <button 
            v-for="tab in settingsTabs"
            :key="tab.id"
            @click="activeSettingsTab = tab.id"
            :class="{ 'active': activeSettingsTab === tab.id }"
            class="settings-tab"
          >
            <component :is="tab.icon" :size="16" />
            <span>{{ tab.label }}</span>
          </button>
        </div>

        <div class="settings-panel">
          <!-- Profile Settings -->
          <div v-if="activeSettingsTab === 'profile'" class="settings-section">
            <h3 class="section-title">Profile Information</h3>
            <form @submit.prevent="handleProfileUpdate" class="profile-form">
              <div class="form-field">
                <label for="profile-name" class="field-label">Full Name</label>
                <input
                  id="profile-name"
                  v-model="profileForm.name"
                  type="text"
                  class="field-input"
                  :class="{ 'error': profileErrors.name }"
                />
                <span v-if="profileErrors.name" class="field-error">{{ profileErrors.name }}</span>
              </div>

              <div class="form-field">
                <label for="profile-email" class="field-label">Email</label>
                <input
                  id="profile-email"
                  :value="userEmail"
                  type="email"
                  class="field-input"
                  disabled
                />
                <span class="field-help">Contact support to change your email address</span>
              </div>

              <button 
                type="submit" 
                :disabled="isLoading || !hasProfileChanges"
                class="save-button"
              >
                <span v-if="isLoading" class="loading loading-spinner loading-sm"></span>
                <span v-else>Save Changes</span>
              </button>
            </form>
          </div>

          <!-- Security Settings -->
          <div v-if="activeSettingsTab === 'security'" class="settings-section">
            <h3 class="section-title">Password & Security</h3>
            <form @submit.prevent="handlePasswordChange" class="security-form">
              <div class="form-field">
                <label for="current-password" class="field-label">Current Password</label>
                <input
                  id="current-password"
                  v-model="passwordForm.currentPassword"
                  type="password"
                  class="field-input"
                  :class="{ 'error': passwordErrors.currentPassword }"
                />
                <span v-if="passwordErrors.currentPassword" class="field-error">{{ passwordErrors.currentPassword }}</span>
              </div>

              <div class="form-field">
                <label for="new-password" class="field-label">New Password</label>
                <input
                  id="new-password"
                  v-model="passwordForm.newPassword"
                  type="password"
                  class="field-input"
                  :class="{ 'error': passwordErrors.newPassword }"
                />
                <span v-if="passwordErrors.newPassword" class="field-error">{{ passwordErrors.newPassword }}</span>
              </div>

              <div class="form-field">
                <label for="confirm-new-password" class="field-label">Confirm New Password</label>
                <input
                  id="confirm-new-password"
                  v-model="passwordForm.confirmPassword"
                  type="password"
                  class="field-input"
                  :class="{ 'error': passwordErrors.confirmPassword }"
                />
                <span v-if="passwordErrors.confirmPassword" class="field-error">{{ passwordErrors.confirmPassword }}</span>
              </div>

              <button 
                type="submit" 
                :disabled="isLoading || !isPasswordFormValid"
                class="save-button"
              >
                <span v-if="isLoading" class="loading loading-spinner loading-sm"></span>
                <span v-else>Change Password</span>
              </button>
            </form>
          </div>

          <!-- Preferences -->
          <div v-if="activeSettingsTab === 'preferences'" class="settings-section">
            <h3 class="section-title">Preferences</h3>
            <div class="preferences-form">
              <div class="preference-item">
                <div class="preference-header">
                  <h4 class="preference-title">Theme</h4>
                  <p class="preference-description">Choose your preferred color scheme</p>
                </div>
                <div class="theme-selector">
                  <button
                    v-for="theme in availableThemes"
                    :key="theme.id"
                    @click="selectTheme(theme.id)"
                    :class="{ 'active': currentTheme === theme.id }"
                    class="theme-option"
                  >
                    <div class="theme-colors">
                      <div class="color-dot" :style="{ backgroundColor: theme.primary }"></div>
                      <div class="color-dot" :style="{ backgroundColor: theme.secondary }"></div>
                      <div class="color-dot" :style="{ backgroundColor: theme.accent }"></div>
                    </div>
                    <span class="theme-name">{{ theme.name }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { User, LogOut, Settings, Shield, Palette, ArrowLeft } from 'lucide-vue-next'
import { useUserStore } from '@/stores/userStore'
import { useThemeStore } from '@/stores/themeStore'
import LoginForm from './LoginForm.vue'
import RegisterForm from './RegisterForm.vue'

// Define emits
const emit = defineEmits<{
  'back-to-canvas': []
}>()

const userStore = useUserStore()
const themeStore = useThemeStore()

// Auth state
const activeAuthTab = ref<'login' | 'register'>('login')

// Settings state
const activeSettingsTab = ref('profile')
const settingsTabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'preferences', label: 'Preferences', icon: Palette }
]

// Form state
const profileForm = ref({
  name: ''
})

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const profileErrors = ref({
  name: ''
})

const passwordErrors = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// Computed
const isAuthenticated = computed(() => userStore.isAuthenticated)
const userName = computed(() => userStore.userName)
const userEmail = computed(() => userStore.userEmail)
const userAvatar = computed(() => userStore.userAvatar)
const isLoading = computed(() => userStore.isLoading)
const currentTheme = computed(() => themeStore.currentTheme)

const hasProfileChanges = computed(() => {
  return profileForm.value.name !== userName.value
})

const isPasswordFormValid = computed(() => {
  return passwordForm.value.currentPassword &&
         passwordForm.value.newPassword &&
         passwordForm.value.confirmPassword &&
         passwordForm.value.newPassword === passwordForm.value.confirmPassword &&
         passwordForm.value.newPassword.length >= 8
})

const availableThemes = computed(() => [
  { id: 'light', name: 'Light', primary: '#570DF8', secondary: '#F000B8', accent: '#37CDBE' },
  { id: 'dark', name: 'Dark', primary: '#793EF9', secondary: '#F471B5', accent: '#1FB2A5' },
  { id: 'cupcake', name: 'Cupcake', primary: '#65C3C8', secondary: '#EF9FBC', accent: '#EEAF3A' },
  { id: 'cyberpunk', name: 'Cyberpunk', primary: '#00CCDD', secondary: '#FF1493', accent: '#88CC22' },
  { id: 'synthwave', name: 'Synthwave', primary: '#FF00FF', secondary: '#00FFFF', accent: '#CCCC00' }
])

// Actions
const handleAuthSuccess = () => {
  // Initialize profile form with user data
  profileForm.value.name = userName.value
}

const handleLogout = async () => {
  await userStore.logout()
  // Reset forms
  profileForm.value.name = ''
  passwordForm.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  }
  activeAuthTab.value = 'login'
}

const handleProfileUpdate = async () => {
  // Validate
  if (!profileForm.value.name.trim()) {
    profileErrors.value.name = 'Name is required'
    return
  }

  profileErrors.value.name = ''

  const success = await userStore.updateProfile({
    name: profileForm.value.name.trim()
  })

  if (success) {
    // Show success message or toast
    console.log('Profile updated successfully')
  }
}

const handlePasswordChange = async () => {
  // Reset errors
  passwordErrors.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  }

  // Validate
  if (!passwordForm.value.currentPassword) {
    passwordErrors.value.currentPassword = 'Current password is required'
    return
  }

  if (!passwordForm.value.newPassword) {
    passwordErrors.value.newPassword = 'New password is required'
    return
  }

  if (passwordForm.value.newPassword.length < 8) {
    passwordErrors.value.newPassword = 'Password must be at least 8 characters'
    return
  }

  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordErrors.value.confirmPassword = 'Passwords do not match'
    return
  }

  const success = await userStore.changePassword(
    passwordForm.value.currentPassword,
    passwordForm.value.newPassword
  )

  if (success) {
    // Clear form
    passwordForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
    console.log('Password changed successfully')
  }
}

const selectTheme = (themeId: string) => {
  themeStore.setTheme(themeId)
}

// Initialize
onMounted(() => {
  if (isAuthenticated.value) {
    profileForm.value.name = userName.value
  }
})
</script>

<style scoped>
.profile-settings-container {
  width: 100%;
  height: 100vh;
  padding: 2rem;
  background: hsl(var(--b1));
  overflow-y: auto;
}

.profile-content {
  max-width: 800px;
  margin: 0 auto;
}

.profile-settings-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid hsl(var(--b3));
}

.back-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: hsl(var(--b2));
  color: hsl(var(--bc));
  border: 1px solid hsl(var(--b3));
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.back-button:hover {
  background: hsl(var(--b3));
  transform: translateX(-2px);
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: hsl(var(--bc));
  margin: 0;
}

/* Authentication Section */
.auth-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: 2rem 0;
}

.auth-header {
  text-align: center;
  max-width: 500px;
}

.auth-icon {
  margin-bottom: 1rem;
  color: hsl(var(--p));
}

.auth-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: hsl(var(--bc));
  margin-bottom: 0.5rem;
}

.auth-subtitle {
  font-size: 1.125rem;
  color: hsl(var(--bc) / 0.6);
  line-height: 1.6;
}

.auth-forms {
  width: 100%;
  max-width: 400px;
}

.form-tabs {
  display: flex;
  margin-bottom: 2rem;
  background: hsl(var(--b2));
  border-radius: 0.75rem;
  padding: 0.25rem;
}

.tab-button {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  color: hsl(var(--bc) / 0.6);
  font-weight: 500;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-button.active {
  background: hsl(var(--b1));
  color: hsl(var(--bc));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Profile Section */
.profile-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: hsl(var(--b2));
  border-radius: 1rem;
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: hsl(var(--b3));
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--bc) / 0.5);
}

.profile-info {
  flex: 1;
}

.profile-name {
  font-size: 1.5rem;
  font-weight: 600;
  color: hsl(var(--bc));
  margin-bottom: 0.25rem;
}

.profile-email {
  color: hsl(var(--bc) / 0.6);
}

.logout-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: hsl(var(--er) / 0.1);
  color: hsl(var(--er));
  border: 1px solid hsl(var(--er) / 0.3);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.logout-button:hover {
  background: hsl(var(--er) / 0.2);
}

.settings-content {
  display: flex;
  gap: 2rem;
}

.settings-tabs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 200px;
}

.settings-tab {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  color: hsl(var(--bc) / 0.6);
  text-align: left;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.settings-tab:hover {
  background: hsl(var(--b2));
  color: hsl(var(--bc));
}

.settings-tab.active {
  background: hsl(var(--p));
  color: hsl(var(--pc));
}

.settings-panel {
  flex: 1;
  background: hsl(var(--b2));
  border-radius: 1rem;
  padding: 2rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: hsl(var(--bc));
  margin-bottom: 1rem;
}

.profile-form,
.security-form {
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

.field-input:disabled {
  background: hsl(var(--b2));
  color: hsl(var(--bc) / 0.5);
  cursor: not-allowed;
}

.field-input.error {
  border-color: hsl(var(--er));
}

.field-error {
  color: hsl(var(--er));
  font-size: 0.75rem;
}

.field-help {
  color: hsl(var(--bc) / 0.5);
  font-size: 0.75rem;
}

.save-button {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: hsl(var(--p));
  color: hsl(var(--pc));
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-button:hover:not(:disabled) {
  background: hsl(var(--p) / 0.9);
  transform: translateY(-1px);
}

.save-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Preferences */
.preferences-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.preference-item {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preference-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.preference-title {
  font-weight: 600;
  color: hsl(var(--bc));
}

.preference-description {
  color: hsl(var(--bc) / 0.6);
  font-size: 0.875rem;
}

.theme-selector {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 2px solid hsl(var(--b3));
  border-radius: 0.75rem;
  background: hsl(var(--b1));
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-option:hover {
  border-color: hsl(var(--p) / 0.5);
}

.theme-option.active {
  border-color: hsl(var(--p));
  background: hsl(var(--p) / 0.1);
}

.theme-colors {
  display: flex;
  gap: 0.25rem;
}

.color-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.theme-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--bc));
}

@media (max-width: 768px) {
  .profile-settings-container {
    padding: 1rem;
  }

  .settings-content {
    flex-direction: column;
    gap: 1rem;
  }

  .settings-tabs {
    flex-direction: row;
    min-width: auto;
    overflow-x: auto;
  }

  .settings-panel {
    padding: 1.5rem;
  }

  .profile-header {
    flex-direction: column;
    text-align: center;
  }

  .theme-selector {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>