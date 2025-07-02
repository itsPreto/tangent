import { invoke } from '@tauri-apps/api/core'

class ApiService {
  private baseUrl: string = 'http://localhost:5050'
  private isDesktop: boolean = false

  constructor() {
    this.detectEnvironment()
  }

  private async detectEnvironment() {
    try {
      // Check if we're running in Tauri
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        this.isDesktop = true
        // Get the backend URL from Tauri
        this.baseUrl = await invoke('get_backend_url')
      }
    } catch (error) {
      console.warn('Not running in Tauri environment, using default API URL')
    }
  }

  public getApiUrl(): string {
    return `${this.baseUrl}/api`
  }

  public getBaseUrl(): string {
    return this.baseUrl
  }

  public isDesktopApp(): boolean {
    return this.isDesktop
  }

  // Utility method for making API requests with proper error handling
  public async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.getApiUrl()}${endpoint}`
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error)
      throw error
    }
  }

  // WebSocket connection for real-time features
  public createWebSocket(endpoint: string): WebSocket {
    const wsUrl = this.baseUrl.replace('http', 'ws') + endpoint
    return new WebSocket(wsUrl)
  }
}

// Export singleton instance
export const apiService = new ApiService()
export default apiService