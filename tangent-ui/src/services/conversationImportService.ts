interface ImportStatus {
  is_running: boolean;
  progress: number;
  status_message: string;
  total_conversations: number;
  processed_conversations: number;
  imported_conversations: number;
  skipped_conversations: number;
  errors: string[];
  current_conversation: string;
  format?: string;
  filename?: string;
  embedding_progress?: number;
  clustering_progress?: number;
  phase?: string; // 'import', 'embedding', 'clustering', 'complete'
}

interface ImportResult {
  status: string;
  format?: string;
  message?: string;
  error?: string;
}

class ConversationImportService {
  private baseUrl = 'http://127.0.0.1:5050/api';
  private statusPollingInterval: number | null = null;
  private statusCallbacks: Array<(status: ImportStatus) => void> = [];

  /**
   * Import conversations from a file
   */
  async importFile(file: File): Promise<ImportResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${this.baseUrl}/import/conversations`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      // Start status polling
      this.startStatusPolling();

      return data;
    } catch (error) {
      console.error('Error starting import:', error);
      throw error;
    }
  }

  /**
   * Get current import status
   */
  async getStatus(): Promise<ImportStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/import/status`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get import status');
      }

      return data;
    } catch (error) {
      console.error('Error getting import status:', error);
      throw error;
    }
  }

  /**
   * Stop the import process
   */
  async stopImport(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/import/stop`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to stop import');
      }

      this.stopStatusPolling();
    } catch (error) {
      console.error('Error stopping import:', error);
      throw error;
    }
  }

  /**
   * Subscribe to status updates
   */
  onStatusUpdate(callback: (status: ImportStatus) => void): () => void {
    this.statusCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Start polling for status updates
   */
  private startStatusPolling(): void {
    if (this.statusPollingInterval) {
      return; // Already polling
    }

    this.statusPollingInterval = window.setInterval(async () => {
      try {
        const status = await this.getStatus();
        
        // Notify all callbacks
        this.statusCallbacks.forEach(callback => callback(status));
        
        // Stop polling if import is complete
        if (!status.is_running) {
          this.stopStatusPolling();
        }
      } catch (error) {
        console.error('Error polling import status:', error);
        // Don't stop polling on error, keep trying
      }
    }, 1000); // Poll every second
  }

  /**
   * Stop polling for status updates
   */
  private stopStatusPolling(): void {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
  }

  /**
   * Handle drag and drop files
   */
  async handleDroppedFiles(files: FileList): Promise<ImportResult[]> {
    const results: ImportResult[] = [];
    
    for (const file of Array.from(files)) {
      // Only process JSON files
      if (!file.name.toLowerCase().endsWith('.json')) {
        results.push({
          status: 'error',
          error: `Skipped ${file.name}: Only JSON files are supported`
        });
        continue;
      }
      
      try {
        const result = await this.importFile(file);
        results.push(result);
      } catch (error) {
        results.push({
          status: 'error',
          error: `Failed to import ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    return results;
  }

  /**
   * Validate if a file is a supported conversation export
   */
  static async validateConversationFile(file: File): Promise<{ valid: boolean; format?: string; error?: string }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          
          if (!Array.isArray(data)) {
            resolve({ valid: false, error: 'File must contain an array of conversations' });
            return;
          }
          
          if (data.length === 0) {
            resolve({ valid: false, error: 'File contains no conversations' });
            return;
          }
          
          const sample = data[0];
          
          // Check for ChatGPT format
          if (sample.mapping && sample.conversation_id) {
            resolve({ valid: true, format: 'chatgpt' });
            return;
          }
          
          // Check for Claude format
          if (sample.chat_messages && sample.uuid) {
            resolve({ valid: true, format: 'claude' });
            return;
          }
          
          resolve({ valid: false, error: 'Unsupported conversation format' });
        } catch (error) {
          resolve({ valid: false, error: 'Invalid JSON format' });
        }
      };
      
      reader.onerror = () => {
        resolve({ valid: false, error: 'Failed to read file' });
      };
      
      reader.readAsText(file);
    });
  }
}

// Export singleton instance
export const conversationImportService = new ConversationImportService();
export type { ImportStatus, ImportResult };