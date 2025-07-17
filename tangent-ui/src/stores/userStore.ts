import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TrialStatus {
  subscription_plan: string
  workspaces_used: number
  max_workspaces: number
  workspaces_remaining: number
  credits_used: number
  max_credits: number
  credits_remaining: number
  can_create_workspace: boolean
  subscription_expires?: string
}

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  is_active: boolean
  is_verified: boolean
  last_login?: string
  preferences: Record<string, any>
  trial_status: TrialStatus
  created_at: string
  updated_at: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  name: string
  password: string
}

export const useUserStore = defineStore('user', () => {
  // State
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isAuthenticated = computed(() => !!user.value && !!accessToken.value)
  const userName = computed(() => user.value?.name || 'User')
  const userEmail = computed(() => user.value?.email || '')
  const userAvatar = computed(() => user.value?.avatar_url)
  
  // Trial status computed properties
  const trialStatus = computed(() => user.value?.trial_status)
  const isOnTrial = computed(() => user.value?.trial_status?.subscription_plan === 'trial')
  const canCreateWorkspace = computed(() => user.value?.trial_status?.can_create_workspace ?? true)
  const workspacesRemaining = computed(() => user.value?.trial_status?.workspaces_remaining ?? 0)
  const creditsRemaining = computed(() => user.value?.trial_status?.credits_remaining ?? 0)
  const subscriptionPlan = computed(() => user.value?.trial_status?.subscription_plan ?? 'trial')

  // Actions
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      isLoading.value = true
      error.value = null

      const response = await fetch('http://127.0.0.1:5050/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      // Store tokens and user data
      accessToken.value = data.access_token
      refreshToken.value = data.refresh_token
      user.value = data.user

      // Store in localStorage for persistence
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('user_data', JSON.stringify(data.user))

      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const register = async (userData: RegisterData): Promise<boolean> => {
    try {
      isLoading.value = true
      error.value = null

      const response = await fetch('http://127.0.0.1:5050/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      // Store tokens and user data
      accessToken.value = data.access_token
      refreshToken.value = data.refresh_token
      user.value = data.user

      // Store in localStorage for persistence
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('user_data', JSON.stringify(data.user))

      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Registration failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const logout = async (): Promise<void> => {
    try {
      // Call logout endpoint if we have a token
      if (accessToken.value) {
        await fetch('http://127.0.0.1:5050/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken.value}`,
          },
        })
      }
    } catch (err) {
      console.warn('Logout endpoint failed:', err)
    } finally {
      // Clear state regardless of API call success
      user.value = null
      accessToken.value = null
      refreshToken.value = null
      error.value = null

      // Clear localStorage
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user_data')
    }
  }

  const refreshAccessToken = async (): Promise<boolean> => {
    try {
      if (!refreshToken.value) {
        return false
      }

      const response = await fetch('http://127.0.0.1:5050/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refreshToken.value}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Token refresh failed')
      }

      accessToken.value = data.access_token
      localStorage.setItem('access_token', data.access_token)

      return true
    } catch (err) {
      console.error('Token refresh failed:', err)
      await logout() // Clear session if refresh fails
      return false
    }
  }

  const updateProfile = async (profileData: Partial<User>): Promise<boolean> => {
    try {
      isLoading.value = true
      error.value = null

      const response = await fetch('http://127.0.0.1:5050/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken.value}`,
        },
        body: JSON.stringify(profileData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Profile update failed')
      }

      // Update user data
      user.value = data.user
      localStorage.setItem('user_data', JSON.stringify(data.user))

      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Profile update failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    try {
      isLoading.value = true
      error.value = null

      const response = await fetch('http://127.0.0.1:5050/api/user/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken.value}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Password change failed')
      }

      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Password change failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const loadFromStorage = (): void => {
    try {
      const storedAccessToken = localStorage.getItem('access_token')
      const storedRefreshToken = localStorage.getItem('refresh_token')
      const storedUserData = localStorage.getItem('user_data')

      if (storedAccessToken && storedRefreshToken && storedUserData) {
        accessToken.value = storedAccessToken
        refreshToken.value = storedRefreshToken
        user.value = JSON.parse(storedUserData)
      }
    } catch (err) {
      console.error('Failed to load auth data from storage:', err)
      // Clear corrupted data
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user_data')
    }
  }

  const clearError = (): void => {
    error.value = null
  }

  // HTTP interceptor helper for adding auth headers
  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (accessToken.value) {
      headers['Authorization'] = `Bearer ${accessToken.value}`
    }

    return headers
  }

  // Trial management methods
  const refreshTrialStatus = async (): Promise<boolean> => {
    if (!isAuthenticated.value) return false
    
    try {
      const response = await fetch('http://127.0.0.1:5050/api/user/trial-status', {
        headers: getAuthHeaders()
      })
      
      if (response.ok) {
        const data = await response.json()
        if (user.value) {
          user.value.trial_status = data.trial_status
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to refresh trial status:', error)
      return false
    }
  }

  const useCredits = async (credits: number = 1): Promise<boolean> => {
    if (!isAuthenticated.value) return false
    
    try {
      const response = await fetch('http://127.0.0.1:5050/api/user/use-credits', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ credits })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (user.value) {
          user.value.trial_status = data.trial_status
        }
        return true
      } else {
        const errorData = await response.json()
        error.value = errorData.message || 'Failed to use credits'
        return false
      }
    } catch (err) {
      console.error('Failed to use credits:', err)
      error.value = 'Failed to use credits'
      return false
    }
  }

  const checkWorkspaceLimit = (): boolean => {
    return canCreateWorkspace.value
  }

  // Initialize from storage on store creation
  loadFromStorage()

  return {
    // State
    user,
    accessToken,
    refreshToken,
    isLoading,
    error,
    
    // Computed
    isAuthenticated,
    userName,
    userEmail,
    userAvatar,
    trialStatus,
    isOnTrial,
    canCreateWorkspace,
    workspacesRemaining,
    creditsRemaining,
    subscriptionPlan,
    
    // Actions
    login,
    register,
    logout,
    refreshAccessToken,
    updateProfile,
    changePassword,
    loadFromStorage,
    clearError,
    refreshTrialStatus,
    useCredits,
    checkWorkspaceLimit,
    getAuthHeaders,
  }
})