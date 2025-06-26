/**
 * Agent Service - Handles automatic agent selection and fallback behavior
 */

export interface AgentServiceResult {
  success: boolean;
  model?: any;
  shouldShowConfigurator?: boolean;
  error?: string;
}

class AgentService {
  
  /**
   * Get the appropriate model for a vision task
   * Returns the model or indicates if configurator should be shown
   */
  async getVisionModel(): Promise<AgentServiceResult> {
    try {
      const { useAgentStore } = await import('@/stores/agentStore');
      const agentStore = useAgentStore();
      
      const visionAgent = agentStore.visionAgent;
      
      if (visionAgent && visionAgent.model && visionAgent.enabled) {
        return {
          success: true,
          model: visionAgent.model
        };
      }
      
      // No vision agent configured, should show configurator
      return {
        success: false,
        shouldShowConfigurator: true,
        error: 'No vision agent configured'
      };
      
    } catch (error) {
      console.error('[AgentService] Error getting vision model:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the appropriate model for a text task
   */
  async getTextModel(): Promise<AgentServiceResult> {
    try {
      const { useAgentStore } = await import('@/stores/agentStore');
      const agentStore = useAgentStore();
      
      const textAgent = agentStore.textAgent;
      
      if (textAgent && textAgent.model && textAgent.enabled) {
        return {
          success: true,
          model: textAgent.model
        };
      }
      
      // No text agent configured, should show configurator
      return {
        success: false,
        shouldShowConfigurator: true,
        error: 'No text agent configured'
      };
      
    } catch (error) {
      console.error('[AgentService] Error getting text model:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Trigger showing the agent configurator with specific tab
   */
  async showAgentConfigurator(tabType: 'agents' = 'agents'): Promise<void> {
    try {
      const { useAppStore } = await import('@/stores/appStore');
      const appStore = useAppStore();
      
      // Set the active tab and open the configurator
      // Note: The tab switching logic will need to be implemented in the component
      appStore.openAgentConfigurator();
      
      // Emit an event to set the correct tab
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agent-configurator-tab', { 
          detail: { tab: tabType } 
        }));
      }
      
    } catch (error) {
      console.error('[AgentService] Error showing agent configurator:', error);
    }
  }

  /**
   * Check if a specific agent type is configured
   */
  async isAgentConfigured(type: 'text' | 'vision' | 'code' | 'router'): Promise<boolean> {
    try {
      const { useAgentStore } = await import('@/stores/agentStore');
      const agentStore = useAgentStore();
      return agentStore.hasConfiguredAgent(type);
    } catch (error) {
      console.warn('[AgentService] Error checking agent configuration:', error);
      return false;
    }
  }
}

// Export singleton instance
export const agentService = new AgentService();
export default agentService;