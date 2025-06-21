/**
 * Auto-caption service for MediaBranchNode
 * Handles automatic image captioning using Ollama vision models
 */

export interface AutoCaptionSettings {
  enabled: boolean;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface CaptionResult {
  success: boolean;
  caption?: string;
  error?: string;
  model?: string;
  responseTime?: number;
}

class AutoCaptionService {
  private readonly BACKEND_URL = 'http://localhost:5050';
  private readonly OLLAMA_PROXY_URL = 'http://localhost:6060';
  
  // Try proxy first, fallback to direct
  private async makeOllamaRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    // First try through Flask backend proxy
    try {
      const proxyResponse = await fetch(`${this.BACKEND_URL}/api/ollama-proxy${endpoint}`, options);
      if (proxyResponse.ok) {
        return proxyResponse;
      }
    } catch (error) {
      console.warn('Flask proxy failed, trying direct connection:', error);
    }
    
    // Fallback to direct connection
    return fetch(`${this.OLLAMA_PROXY_URL}/api${endpoint}`, options);
  }
  
  /**
   * Get auto-caption settings from localStorage
   */
  getSettings(): AutoCaptionSettings {
    const saved = localStorage.getItem('autoCaptionSettings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse auto-caption settings:', e);
      }
    }
    
    // Default settings - try to get a working vision model
    return {
      enabled: true,
      model: '', // Will be set by component when available models are loaded
      maxTokens: 150,
      temperature: 0.3
    };
  }
  
  /**
   * Save auto-caption settings to localStorage
   */
  saveSettings(settings: AutoCaptionSettings): void {
    localStorage.setItem('autoCaptionSettings', JSON.stringify(settings));
  }
  
  /**
   * Convert file to base64
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extract base64 data (remove data URL prefix)
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Generate caption for an image file
   */
  async captionFile(file: File, customPrompt?: string): Promise<CaptionResult> {
    const settings = this.getSettings();
    
    if (!settings.enabled) {
      return {
        success: false,
        error: 'Auto-captioning is disabled'
      };
    }
    
    if (!settings.model) {
      return {
        success: false,
        error: 'No vision model selected'
      };
    }
    
    const startTime = Date.now();
    
    try {
      // Convert file to base64
      const base64Data = await this.fileToBase64(file);
      
      console.log(`[AutoCaption] Starting caption for ${file.name} (${file.type})`);
      console.log(`[AutoCaption] Using model: ${settings.model}`);
      console.log(`[AutoCaption] Base64 length: ${base64Data.length}`);
      console.log(`[AutoCaption] Settings:`, { 
        temperature: settings.temperature, 
        maxTokens: settings.maxTokens 
      });
      
      // Prepare the prompt
      const prompt = customPrompt || 'Describe this image in detail. Focus on the main subjects, objects, colors, setting, and any notable features or text visible in the image.';
      
      // Send to Ollama via /generate endpoint (which handles images better)
      const response = await this.makeOllamaRequest('/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: settings.model,
          prompt: prompt,
          images: [base64Data],
          stream: false,
          options: {
            temperature: settings.temperature,
            num_predict: settings.maxTokens
          }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AutoCaption] HTTP Error ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`[AutoCaption] Raw response:`, data);
      
      // Handle different response formats from /generate vs /chat
      let caption = '';
      if (data.response) {
        // /generate endpoint response format
        caption = data.response;
      } else if (data.message?.content) {
        // /chat endpoint response format (fallback)
        caption = data.message.content;
      } else if (typeof data === 'string') {
        // Direct string response
        caption = data;
      }
      
      if (!caption || caption.trim() === '') {
        console.error('Empty caption response:', data);
        throw new Error('No caption generated - empty response');
      }
      
      caption = caption.trim();
      
      const responseTime = Date.now() - startTime;
      
      console.log(`[AutoCaption] Success! Generated caption in ${responseTime}ms:`);
      console.log(`[AutoCaption] Caption preview: "${caption.substring(0, 100)}..."`);
      
      return {
        success: true,
        caption,
        model: settings.model,
        responseTime
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`[AutoCaption] Error after ${responseTime}ms:`, error);
      
      if (error instanceof Error) {
        console.error(`[AutoCaption] Error details:`, {
          message: error.message,
          stack: error.stack
        });
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime
      };
    }
  }
  
  /**
   * Generate caption for a media URL (for existing media)
   */
  async captionUrl(mediaUrl: string, customPrompt?: string): Promise<CaptionResult> {
    const settings = this.getSettings();
    
    if (!settings.enabled) {
      return {
        success: false,
        error: 'Auto-captioning is disabled'
      };
    }
    
    if (!settings.model) {
      return {
        success: false,
        error: 'No vision model selected'
      };
    }
    
    const startTime = Date.now();
    
    try {
      // Fetch the image and convert to base64
      const response = await fetch(mediaUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      const file = new File([blob], 'image', { type: blob.type });
      
      return await this.captionFile(file, customPrompt);
      
    } catch (error) {
      console.error('Auto-caption URL error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Test if a vision model is available and working
   */
  async testModel(modelName: string): Promise<boolean> {
    try {
      // Create a small test image (1x1 pixel red image)
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 1, 1);
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });
      
      const file = new File([blob], 'test.png', { type: 'image/png' });
      
      // Test with a simple prompt
      const result = await this.captionFile(file, 'What color is this image?');
      
      return result.success;
      
    } catch (error) {
      console.error('Model test error:', error);
      return false;
    }
  }
  
  /**
   * Get available vision models from the proxy
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.makeOllamaRequest('/tags');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const models = data.models || [];
      
      // Filter for vision models
      return models
        .filter((model: any) => model.has_vision)
        .map((model: any) => model.name);
        
    } catch (error) {
      console.error('Failed to fetch vision models:', error);
      return [];
    }
  }
  
  /**
   * Debug function to check auto-captioning status
   * Call from browser console: window.debugAutoCaption()
   */
  async debugStatus(): Promise<void> {
    console.log('=== AUTO-CAPTION DEBUG STATUS ===');
    
    const settings = this.getSettings();
    console.log('Settings:', settings);
    
    try {
      const availableModels = await this.getAvailableModels();
      console.log('Available vision models:', availableModels);
      
      if (settings.model && availableModels.includes(settings.model)) {
        console.log('✅ Selected model is available');
        
        // Test the model
        const isWorking = await this.testModel(settings.model);
        console.log(`Model test result: ${isWorking ? '✅ WORKING' : '❌ FAILED'}`);
      } else {
        console.log('❌ Selected model is not available or not set');
      }
      
    } catch (error) {
      console.error('❌ Error checking models:', error);
    }
    
    console.log('=== END DEBUG STATUS ===');
  }
}

// Export singleton instance
export const autoCaptionService = new AutoCaptionService();
export default autoCaptionService;

// Make debug functions available globally
if (typeof window !== 'undefined') {
  (window as any).debugAutoCaption = () => autoCaptionService.debugStatus();
  
  // Debug function to check media nodes
  (window as any).debugMediaNodes = () => {
    console.log('=== MEDIA NODES DEBUG ===');
    
    // Import canvas store
    import('@/stores/canvasStore').then(({ useCanvasStore }) => {
      const store = useCanvasStore();
      const mediaNodes = store.nodes.filter((node: any) => node.type === 'media');
      
      console.log(`Found ${mediaNodes.length} media nodes:`);
      
      mediaNodes.forEach((node: any, index: number) => {
        console.log(`\n[${index + 1}] Media Node ${node.id}:`);
        console.log('  Position:', { x: node.x, y: node.y });
        console.log('  Processing states:', {
          isProcessingMedia: node.isProcessingMedia,
          hasMediaContent: !!node.mediaContent
        });
        
        if (node.mediaContent) {
          console.log('  Media content:', {
            filename: node.mediaContent.filename,
            type: node.mediaContent.type,
            analysis: node.mediaContent.analysis?.substring(0, 100) + '...',
            previewUrl: node.mediaContent.previewUrl?.substring(0, 50) + '...',
            media_id: node.mediaContent.media_id
          });
        } else {
          console.log('  ❌ No media content found');
        }
        
        console.log('  Messages:', node.messages?.length || 0);
        console.log('  Metadata:', node.metadata);
      });
    });
    
    console.log('=== END MEDIA NODES DEBUG ===');
  };
}