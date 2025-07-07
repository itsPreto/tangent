export interface MockDataConfig {
  platform: 'chatgpt' | 'claude'
  conversation_count: number
  max_messages_per_conversation: number
  content_source: 'general' | 'tech_support' | 'creative'
}

export interface MockDataResponse {
  conversations: any[]
  error?: string
}

class MockDataService {
  private baseUrl = 'http://127.0.0.1:5050'

  async generateMockArchive(config: MockDataConfig): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate-mock-archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Request failed with status ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to generate mock archive:', error)
      throw error
    }
  }

  downloadAsFile(data: any[], platform: string): void {
    const filename = `${platform}_conversations.json`
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

export const mockDataService = new MockDataService()