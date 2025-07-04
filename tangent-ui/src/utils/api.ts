
class ApiService {
  private baseUrl: string = 'http://127.0.0.1:5050'
  private isDesktop: boolean = false


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
      // Don't set Content-Type for FormData - let browser set it with boundary
      const headers: Record<string, string> = { ...options.headers as Record<string, string> }
      
      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json'
      }
      
      const response = await fetch(url, {
        ...options,
        headers,
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