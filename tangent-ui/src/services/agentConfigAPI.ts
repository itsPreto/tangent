import type { AgentConfig } from '@/stores/agentStore';

export interface AgentConfigAPI {
  // Agent Configuration endpoints
  getAllAgentConfigs(): Promise<AgentConfig[]>;
  getAgentConfig(configId: string): Promise<AgentConfig>;
  createAgentConfig(config: Partial<AgentConfig>): Promise<{ id: string; message: string }>;
  updateAgentConfig(configId: string, updates: Partial<AgentConfig>): Promise<{ message: string }>;
  deleteAgentConfig(configId: string): Promise<{ message: string }>;
  setAgentModel(agentType: string, model: any): Promise<{ message: string }>;
  createDefaultAgents(): Promise<{ created_agents: string[]; message: string }>;
  
  // API Key endpoints
  getApiKeys(): Promise<Record<string, string>>;
  setApiKey(provider: string, keyValue: string): Promise<{ message: string }>;
  deleteApiKey(provider: string): Promise<{ message: string }>;
  
  // System Message endpoints
  getSystemMessages(): Promise<Record<string, string>>;
  setSystemMessage(agentType: string, message: string, agentId?: string): Promise<{ message: string }>;
  
  // User Preference endpoints
  getPreferences(category?: string): Promise<Record<string, any>>;
  setPreference(key: string, value: any, category: string): Promise<{ message: string }>;
  deletePreference(key: string): Promise<{ message: string }>;
  
  // Migration endpoint
  migrateLocalStorage(localStorageData: Record<string, any>): Promise<{ message: string; results: Record<string, number> }>;
}

class AgentConfigAPIService implements AgentConfigAPI {
  private baseUrl = 'http://127.0.0.1:5050/api';
  
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  // Agent Configuration methods
  
  async getAllAgentConfigs(): Promise<AgentConfig[]> {
    return this.request<AgentConfig[]>('/agent-configs');
  }
  
  async getAgentConfig(configId: string): Promise<AgentConfig> {
    return this.request<AgentConfig>(`/agent-configs/${configId}`);
  }
  
  async createAgentConfig(config: Partial<AgentConfig>): Promise<{ id: string; message: string }> {
    return this.request<{ id: string; message: string }>('/agent-configs', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }
  
  async updateAgentConfig(configId: string, updates: Partial<AgentConfig>): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/agent-configs/${configId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  async deleteAgentConfig(configId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/agent-configs/${configId}`, {
      method: 'DELETE',
    });
  }
  
  async setAgentModel(agentType: string, model: any): Promise<{ message: string }> {
    return this.request<{ message: string }>('/agent-configs/set-model', {
      method: 'POST',
      body: JSON.stringify({ agent_type: agentType, model }),
    });
  }
  
  async createDefaultAgents(): Promise<{ created_agents: string[]; message: string }> {
    return this.request<{ created_agents: string[]; message: string }>('/agent-configs/defaults', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
  
  // API Key methods
  
  async getApiKeys(): Promise<Record<string, string>> {
    return this.request<Record<string, string>>('/api-keys');
  }
  
  async setApiKey(provider: string, keyValue: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ provider, key_value: keyValue }),
    });
  }
  
  async deleteApiKey(provider: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api-keys/${provider}`, {
      method: 'DELETE',
    });
  }
  
  // System Message methods
  
  async getSystemMessages(): Promise<Record<string, string>> {
    return this.request<Record<string, string>>('/system-messages');
  }
  
  async setSystemMessage(agentType: string, message: string, agentId?: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/system-messages', {
      method: 'POST',
      body: JSON.stringify({ agent_type: agentType, message, agent_id: agentId }),
    });
  }
  
  // User Preference methods
  
  async getPreferences(category?: string): Promise<Record<string, any>> {
    const queryParams = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.request<Record<string, any>>(`/preferences${queryParams}`);
  }
  
  async setPreference(key: string, value: any, category: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/preferences', {
      method: 'POST',
      body: JSON.stringify({ key, value, category }),
    });
  }
  
  async deletePreference(key: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/preferences/${key}`, {
      method: 'DELETE',
    });
  }
  
  // Migration method
  
  async migrateLocalStorage(localStorageData: Record<string, any>): Promise<{ message: string; results: Record<string, number> }> {
    return this.request<{ message: string; results: Record<string, number> }>('/migrate-localstorage', {
      method: 'POST',
      body: JSON.stringify({ localStorage_data: localStorageData }),
    });
  }
}

// Export singleton instance
export const agentConfigAPI = new AgentConfigAPIService();