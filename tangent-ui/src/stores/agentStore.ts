import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ModelInfo } from '@/types/model';
import { agentConfigAPI } from '@/services/agentConfigAPI';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  type: 'text' | 'vision' | 'code' | 'router' | 'custom';
  model: ModelInfo | null;
  isDefault: boolean;
  prompt?: string;
  enabled: boolean;
  // For custom agents
  customType?: string;
  triggerPatterns?: string[];
  priority?: number;
  tags?: string[];
}

export const useAgentStore = defineStore('agents', () => {
  // Load saved agent configs from localStorage (fallback)
  const loadSavedConfigs = (): AgentConfig[] => {
    const saved = localStorage.getItem('agentConfigs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved agent configs:', e);
      }
    }
    return getDefaultConfigs();
  };

  // Load agent configs from API
  const loadConfigsFromAPI = async (): Promise<AgentConfig[]> => {
    try {
      return await agentConfigAPI.getAllAgentConfigs();
    } catch (error) {
      console.error('Failed to load agent configs from API:', error);
      // Fall back to localStorage
      return loadSavedConfigs();
    }
  };

  // Default agent configurations
  const getDefaultConfigs = (): AgentConfig[] => [
    {
      id: 'default-text',
      name: 'Default Text Agent',
      description: 'Handles general text-based conversations and queries',
      type: 'text',
      model: null,
      isDefault: true,
      enabled: true,
      prompt: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses to user queries.'
    },
    {
      id: 'default-vision',
      name: 'Default Vision Agent',
      description: 'Processes and analyzes images, provides descriptions and answers visual questions',
      type: 'vision',
      model: null,
      isDefault: true,
      enabled: true,
      prompt: 'You are an AI assistant specialized in analyzing images. Provide detailed, accurate descriptions and answer questions about visual content.'
    },
    {
      id: 'default-code',
      name: 'Default Code Agent',
      description: 'Assists with programming, code review, and technical questions',
      type: 'code',
      model: null,
      isDefault: false,
      enabled: false,
      prompt: 'You are a programming assistant. Help with code, debugging, architecture, and technical solutions.'
    },
    {
      id: 'default-router',
      name: 'Default Router Agent',
      description: 'Routes requests to appropriate specialized agents',
      type: 'router',
      model: null,
      isDefault: false,
      enabled: false,
      prompt: 'You are a router agent. Analyze user requests and determine which specialized agent should handle them.'
    }
  ];

  const agentConfigs = ref<AgentConfig[]>(loadSavedConfigs());

  // Save configs to localStorage whenever they change (fallback)
  const saveConfigs = () => {
    localStorage.setItem('agentConfigs', JSON.stringify(agentConfigs.value));
  };

  // Initialize configs from API or localStorage
  const initializeConfigs = async () => {
    try {
      const apiConfigs = await loadConfigsFromAPI();
      
      // If no configs exist in API, create defaults
      if (apiConfigs.length === 0) {
        console.log('No agent configs found, creating defaults...');
        try {
          const result = await agentConfigAPI.createDefaultAgents();
          console.log('Created default agents:', result);
          // Reload configs after creating defaults
          const newConfigs = await agentConfigAPI.getAllAgentConfigs();
          agentConfigs.value = newConfigs;
        } catch (createError) {
          console.error('Failed to create default agents:', createError);
          // Fall back to local defaults
          agentConfigs.value = getDefaultConfigs();
        }
      } else {
        agentConfigs.value = apiConfigs;
      }
    } catch (error) {
      console.error('Failed to initialize from API, using localStorage:', error);
      agentConfigs.value = loadSavedConfigs();
    }
  };

  // Sync config to API
  const syncConfigToAPI = async (config: AgentConfig) => {
    try {
      if (config.id.startsWith('custom-')) {
        // For custom agents, update via API
        await agentConfigAPI.updateAgentConfig(config.id, config);
      }
    } catch (error) {
      console.error('Failed to sync config to API:', error);
      // Fall back to localStorage
      saveConfigs();
    }
  };

  // Computed getters for different agent types
  const textAgent = computed(() => 
    agentConfigs.value.find(agent => agent.type === 'text' && agent.isDefault && agent.enabled)
  );

  const visionAgent = computed(() => 
    agentConfigs.value.find(agent => agent.type === 'vision' && agent.isDefault && agent.enabled)
  );

  const codeAgent = computed(() => 
    agentConfigs.value.find(agent => agent.type === 'code' && agent.isDefault && agent.enabled)
  );

  const routerAgent = computed(() => 
    agentConfigs.value.find(agent => agent.type === 'router' && agent.isDefault && agent.enabled)
  );

  // Check if an agent type has a configured model
  const hasConfiguredAgent = (type: 'text' | 'vision' | 'code' | 'router' | 'custom'): boolean => {
    const agent = agentConfigs.value.find(a => a.type === type && a.isDefault && a.enabled);
    return !!(agent && agent.model);
  };

  // Get the default model for a specific task type
  const getDefaultModel = (type: 'text' | 'vision' | 'code' | 'router' | 'custom'): ModelInfo | null => {
    const agent = agentConfigs.value.find(a => a.type === type && a.isDefault && a.enabled);
    return agent?.model || null;
  };

  // Get all custom agents
  const customAgents = computed(() => 
    agentConfigs.value.filter(agent => agent.type === 'custom' && agent.enabled)
  );

  // Find agent by custom type
  const getAgentByCustomType = (customType: string): AgentConfig | null => {
    return agentConfigs.value.find(a => a.customType === customType && a.enabled) || null;
  };

  // Find best matching agent for a task
  const findBestAgentForTask = (taskDescription: string, tags: string[] = []): AgentConfig | null => {
    // First check router agent
    if (routerAgent.value && routerAgent.value.model) {
      return routerAgent.value;
    }

    // Check custom agents with pattern matching
    const customMatches = customAgents.value.filter(agent => {
      if (agent.triggerPatterns) {
        return agent.triggerPatterns.some(pattern => {
          const regex = new RegExp(pattern, 'i');
          return regex.test(taskDescription);
        });
      }
      if (agent.tags && tags.length > 0) {
        return agent.tags.some(tag => tags.includes(tag));
      }
      return false;
    });

    // Sort by priority and return highest priority match
    if (customMatches.length > 0) {
      return customMatches.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    }

    // Fallback to basic pattern matching
    const lowerTask = taskDescription.toLowerCase();
    
    if (lowerTask.includes('image') || lowerTask.includes('photo') || lowerTask.includes('picture') || lowerTask.includes('vision')) {
      return visionAgent.value;
    }
    
    if (lowerTask.includes('code') || lowerTask.includes('program') || lowerTask.includes('debug')) {
      return codeAgent.value;
    }
    
    // Default to text agent
    return textAgent.value;
  };

  // Update an agent's configuration
  const updateAgentConfig = async (agentId: string, updates: Partial<AgentConfig>) => {
    const index = agentConfigs.value.findIndex(agent => agent.id === agentId);
    if (index !== -1) {
      // Update local state immediately
      agentConfigs.value[index] = { ...agentConfigs.value[index], ...updates };
      
      // Try to sync to API
      try {
        await agentConfigAPI.updateAgentConfig(agentId, updates);
      } catch (error) {
        console.error('Failed to update agent config via API:', error);
        // Fall back to localStorage
        saveConfigs();
      }
    }
  };

  // Set the model for a specific agent type
  const setAgentModel = async (type: 'text' | 'vision' | 'code' | 'router' | 'custom', model: ModelInfo) => {
    // Try to use API first
    try {
      await agentConfigAPI.setAgentModel(type, model);
      // Refresh configs from API
      await initializeConfigs();
    } catch (error) {
      console.error('Failed to set agent model via API, using local fallback:', error);
      
      // Fall back to local logic
      let agent = agentConfigs.value.find(a => a.type === type && a.isDefault);
      
      // If not found, try to find any agent of this type (handles corrupted localStorage)
      if (!agent) {
        agent = agentConfigs.value.find(a => a.type === type);
      }
      
      if (agent) {
        await updateAgentConfig(agent.id, { model, enabled: true, isDefault: true });
      }
    }
  };

  // Enable/disable an agent
  const toggleAgent = (agentId: string) => {
    const agent = agentConfigs.value.find(a => a.id === agentId);
    if (agent) {
      updateAgentConfig(agentId, { enabled: !agent.enabled });
    }
  };

  // Check if we need to show agent configurator (when vision task attempted but no vision agent)
  const shouldShowAgentConfigurator = (taskType: 'text' | 'vision' | 'code' | 'router' | 'custom'): boolean => {
    return !hasConfiguredAgent(taskType);
  };

  // Create dynamic agent types
  const createAgentType = (name: string, description: string, triggerPatterns: string[] = [], tags: string[] = []): AgentConfig => {
    const newAgent: AgentConfig = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      type: 'custom',
      customType: name.toLowerCase().replace(/\s+/g, '_'),
      model: null,
      isDefault: false,
      enabled: true,
      triggerPatterns,
      tags,
      priority: 50,
      prompt: `You are a specialized AI agent for ${name}. ${description}`
    };
    
    agentConfigs.value.push(newAgent);
    saveConfigs();
    return newAgent;
  };

  // Update trigger patterns for custom agents
  const updateAgentTriggers = (agentId: string, triggerPatterns: string[]) => {
    const agent = agentConfigs.value.find(a => a.id === agentId);
    if (agent && agent.type === 'custom') {
      updateAgentConfig(agentId, { triggerPatterns });
    }
  };

  // Reset all configs to defaults
  const resetToDefaults = () => {
    agentConfigs.value = getDefaultConfigs();
    saveConfigs();
  };

  // Add a new custom agent
  const addCustomAgent = (config: Omit<AgentConfig, 'id'>) => {
    const newAgent: AgentConfig = {
      ...config,
      id: `custom-${Date.now()}`,
    };
    agentConfigs.value.push(newAgent);
    saveConfigs();
    return newAgent;
  };

  // Create custom agent (compatible with ModelSelectorFeature)
  const createCustomAgent = async (customData: { name: string; emoji?: string; color?: string }) => {
    const newAgentData = {
      name: customData.name,
      description: `Custom agent: ${customData.name}`,
      type: 'custom' as const,
      model: null,
      isDefault: false,
      enabled: true,
      priority: 50,
      emoji: customData.emoji,
      color: customData.color,
      prompt: `You are ${customData.name}, a specialized AI assistant.`
    };
    
    try {
      // Try to create via API
      const response = await agentConfigAPI.createAgentConfig(newAgentData);
      
      // Refresh configs from API to get the new agent
      await initializeConfigs();
      
      // Find and return the newly created agent
      const newAgent = agentConfigs.value.find(a => a.id === response.id);
      return newAgent || newAgentData;
    } catch (error) {
      console.error('Failed to create custom agent via API, using local fallback:', error);
      
      // Fall back to local creation
      const newAgent: AgentConfig = {
        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...newAgentData
      };
      
      agentConfigs.value.push(newAgent);
      saveConfigs();
      return newAgent;
    }
  };

  // Launch Claude Code instance with configuration
  const launchClaudeCode = async (config: Record<string, any>): Promise<string | null> => {
    // Import toolCallStore dynamically to avoid circular dependencies
    const { useToolCallStore } = await import('./toolCallStore');
    const toolCallStore = useToolCallStore();
    
    try {
      // Create the Claude Code instance
      const instanceId = await toolCallStore.createClaudeCodeInstance(config);
      
      if (instanceId) {
        console.log('[AgentStore] Successfully created Claude Code instance:', instanceId);
        return instanceId;
      } else {
        console.error('[AgentStore] Failed to create Claude Code instance - no instance ID returned');
        return null;
      }
    } catch (error) {
      console.error('[AgentStore] Error launching Claude Code:', error);
      throw error;
    }
  };

  // Remove a custom agent (can't remove default agents)
  const removeAgent = async (agentId: string) => {
    const agent = agentConfigs.value.find(a => a.id === agentId);
    if (agent && !agent.id.startsWith('default-')) {
      try {
        // Try to delete via API
        await agentConfigAPI.deleteAgentConfig(agentId);
        
        // Update local state
        agentConfigs.value = agentConfigs.value.filter(a => a.id !== agentId);
      } catch (error) {
        console.error('Failed to remove agent via API, using local fallback:', error);
        
        // Fall back to local removal
        agentConfigs.value = agentConfigs.value.filter(a => a.id !== agentId);
        saveConfigs();
      }
    }
  };

  return {
    agentConfigs,
    textAgent,
    visionAgent, 
    codeAgent,
    routerAgent,
    customAgents,
    hasConfiguredAgent,
    getDefaultModel,
    getAgentByCustomType,
    findBestAgentForTask,
    updateAgentConfig,
    setAgentModel,
    toggleAgent,
    shouldShowAgentConfigurator,
    resetToDefaults,
    addCustomAgent,
    createCustomAgent,
    removeAgent,
    createAgentType,
    updateAgentTriggers,
    saveConfigs,
    initializeConfigs,
    launchClaudeCode
  };
});