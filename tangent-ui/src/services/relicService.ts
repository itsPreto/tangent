import { apiService } from '@/utils/api'

export interface RelicVersion {
  version: number
  commit_message: string
  created_at: string
  created_by: string
}

export interface Relic {
  id: string
  name: string
  description: string
  language: string
  status: string
  created_at: string
  updated_at: string
  workspace_id?: string
  source_info?: {
    chatId?: string
    nodeId?: string
    messageIndex?: number
    codeIndex?: number
  }
  latest_version?: {
    version: number
    code: string
    dependencies: Record<string, string>
    commit_message: string
    created_at: string
  }
  code?: string // For list view
  thumbnailUrl?: string // Thumbnail image URL
}

export interface CreateRelicData {
  id: string
  name: string
  description?: string
  language: string
  code: string
  dependencies?: Record<string, string>
  workspace_id?: string
  source_info?: Relic['source_info']
}

export interface UpdateRelicData {
  name?: string
  description?: string
  code?: string
  dependencies?: Record<string, string>
  commit_message?: string
}

class RelicService {
  private baseUrl: string
  
  constructor() {
    this.baseUrl = '/relics'
  }
  
  async listRelics(workspaceId?: string): Promise<Relic[]> {
    const params = workspaceId ? `?workspace_id=${workspaceId}` : ''
    const response = await apiService.fetch(`${this.baseUrl}${params}`)
    
    if (!response.ok) {
      throw new Error(`Failed to list relics: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.relics
  }
  
  async createRelic(relicData: CreateRelicData): Promise<Relic> {
    const response = await apiService.fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(relicData)
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create relic')
    }
    
    return response.json()
  }
  
  async getRelic(relicId: string, version?: number): Promise<Relic> {
    const params = version ? `?version=${version}` : ''
    const response = await apiService.fetch(`${this.baseUrl}/${relicId}${params}`)
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Relic not found')
      }
      throw new Error(`Failed to get relic: ${response.statusText}`)
    }
    
    return response.json()
  }
  
  async updateRelic(relicId: string, updates: UpdateRelicData): Promise<Relic> {
    const response = await apiService.fetch(`${this.baseUrl}/${relicId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update relic')
    }
    
    return response.json()
  }
  
  async deleteRelic(relicId: string): Promise<void> {
    const response = await apiService.fetch(`${this.baseUrl}/${relicId}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete relic')
    }
  }
  
  async getRelicVersions(relicId: string): Promise<RelicVersion[]> {
    const response = await apiService.fetch(`${this.baseUrl}/${relicId}/versions`)
    
    if (!response.ok) {
      throw new Error(`Failed to get relic versions: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.versions
  }
  
  // Helper method to save code changes with auto-generated commit message
  async saveCode(relicId: string, code: string, customMessage?: string): Promise<Relic> {
    const timestamp = new Date().toLocaleString()
    const commitMessage = customMessage || `Code update at ${timestamp}`
    
    return this.updateRelic(relicId, {
      code,
      commit_message: commitMessage
    })
  }
}

export const relicService = new RelicService()