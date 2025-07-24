import { agentConfigAPI } from './agentConfigAPI';

export class ConfigMigrationService {
  /**
   * Migrate all localStorage data to the database
   */
  static async migrateAllLocalStorageData(): Promise<boolean> {
    try {
      const localStorageData = this.extractLocalStorageData();
      
      if (Object.keys(localStorageData).length === 0) {
        console.log('No localStorage data to migrate');
        return true;
      }
      
      console.log('Migrating localStorage data to database...', localStorageData);
      
      const result = await agentConfigAPI.migrateLocalStorage(localStorageData);
      
      console.log('Migration completed:', result);
      
      // Optionally clear localStorage after successful migration
      // this.clearMigratedLocalStorageData();
      
      return true;
    } catch (error) {
      console.error('Failed to migrate localStorage data:', error);
      return false;
    }
  }
  
  /**
   * Extract all relevant data from localStorage
   */
  private static extractLocalStorageData(): Record<string, any> {
    const data: Record<string, any> = {};
    
    // API Keys
    const apiKeys = ['anthropicApiKey', 'openRouterApiKey', 'geminiApiKey'];
    apiKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        data[key] = value;
      }
    });
    
    // System Messages
    const systemMessageTypes = ['text', 'vision', 'code', 'router'];
    systemMessageTypes.forEach(type => {
      const key = `systemMessage_${type}`;
      const value = localStorage.getItem(key);
      if (value) {
        data[key] = value;
      }
    });
    
    // TTS Settings
    const ttsKeys = ['ttsEnabled', 'ttsVoice', 'ttsSpeed', 'ttsAutoRead'];
    ttsKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        // Parse boolean values
        if (value === 'true' || value === 'false') {
          data[key] = value === 'true';
        } else {
          data[key] = value;
        }
      }
    });
    
    // Whisper Settings
    const whisperKeys = [
      'whisperEnabled', 'whisperModel', 'whisperLanguage', 
      'whisperThreads', 'whisperTranslate', 'whisperDiarize', 'whisperTimestamps'
    ];
    whisperKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        // Parse boolean values
        if (value === 'true' || value === 'false') {
          data[key] = value === 'true';
        } else if (key === 'whisperThreads') {
          data[key] = parseInt(value);
        } else {
          data[key] = value;
        }
      }
    });
    
    // Favorite Models
    const favoriteModels = localStorage.getItem('favoriteModels');
    if (favoriteModels) {
      try {
        data['favoriteModels'] = JSON.parse(favoriteModels);
      } catch (e) {
        console.error('Failed to parse favoriteModels:', e);
      }
    }
    
    // Agent Configs
    const agentConfigs = localStorage.getItem('agentConfigs');
    if (agentConfigs) {
      try {
        data['agentConfigs'] = JSON.parse(agentConfigs);
      } catch (e) {
        console.error('Failed to parse agentConfigs:', e);
      }
    }
    
    return data;
  }
  
  /**
   * Clear migrated localStorage data (optional)
   */
  private static clearMigratedLocalStorageData(): void {
    const keysToRemove = [
      // API Keys
      'anthropicApiKey', 'openRouterApiKey', 'geminiApiKey',
      // System Messages
      'systemMessage_text', 'systemMessage_vision', 'systemMessage_code', 'systemMessage_router',
      // TTS Settings
      'ttsEnabled', 'ttsVoice', 'ttsSpeed', 'ttsAutoRead',
      // Whisper Settings
      'whisperEnabled', 'whisperModel', 'whisperLanguage', 
      'whisperThreads', 'whisperTranslate', 'whisperDiarize', 'whisperTimestamps',
      // Other settings
      'favoriteModels', 'agentConfigs'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('Cleared migrated localStorage data');
  }
  
  /**
   * Check if migration is needed (has localStorage data but no database data)
   */
  static async shouldMigrate(): Promise<boolean> {
    try {
      // Check if there's localStorage data
      const localStorageData = this.extractLocalStorageData();
      const hasLocalStorageData = Object.keys(localStorageData).length > 0;
      
      if (!hasLocalStorageData) {
        return false;
      }
      
      // Check if there's already data in the database
      const agentConfigs = await agentConfigAPI.getAllAgentConfigs();
      const hasDbData = agentConfigs.length > 0;
      
      // Migrate if we have localStorage data but no database data
      return hasLocalStorageData && !hasDbData;
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }
}

// Export for direct usage
export const configMigrationService = ConfigMigrationService;