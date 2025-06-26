import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ModelInfo } from '@/types/model';

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
  // Load saved agent configs from localStorage
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

  // Save configs to localStorage whenever they change
  const saveConfigs = () => {
    localStorage.setItem('agentConfigs', JSON.stringify(agentConfigs.value));
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
  const updateAgentConfig = (agentId: string, updates: Partial<AgentConfig>) => {
    const index = agentConfigs.value.findIndex(agent => agent.id === agentId);
    if (index !== -1) {
      agentConfigs.value[index] = { ...agentConfigs.value[index], ...updates };
      saveConfigs();
    }
  };

  // Set the model for a specific agent type
  const setAgentModel = (type: 'text' | 'vision' | 'code' | 'router' | 'custom', model: ModelInfo) => {
    const agent = agentConfigs.value.find(a => a.type === type && a.isDefault);
    if (agent) {
      updateAgentConfig(agent.id, { model, enabled: true });
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

  // Remove a custom agent (can't remove default agents)
  const removeAgent = (agentId: string) => {
    const agent = agentConfigs.value.find(a => a.id === agentId);
    if (agent && !agent.id.startsWith('default-')) {
      agentConfigs.value = agentConfigs.value.filter(a => a.id !== agentId);
      saveConfigs();
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
    removeAgent,
    createAgentType,
    updateAgentTriggers,
    saveConfigs
  };
});