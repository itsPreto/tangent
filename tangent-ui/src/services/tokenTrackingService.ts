// Token tracking service for branch-level context management
import type { Message } from '@/types/message';
import type { ModelInfo } from '@/types/model';

export interface TokenUsage {
  current: number;
  limit: number;
  percentage: number;
  canCompact: boolean;
  shouldCompact: boolean;
}

export interface CompactedSection {
  id: string;
  originalMessages: Message[];
  summary: string;
  tokenCount: number;
  createdAt: string;
}

class TokenTrackingService {
  private tokenCache = new Map<string, number>();
  private debounceTimers = new Map<string, number>();
  
  /**
   * Count tokens for text using the backend tokenizer
   */
  async countTokens(text: string, cacheKey?: string): Promise<number> {
    if (!text.trim()) return 0;
    
    // Check cache first
    if (cacheKey && this.tokenCache.has(cacheKey)) {
      return this.tokenCache.get(cacheKey)!;
    }
    
    try {
      const response = await fetch('http://127.0.0.1:5050/count-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      const count = data.tokens || 0;
      
      // Cache the result
      if (cacheKey) {
        this.tokenCache.set(cacheKey, count);
      }
      
      return count;
    } catch (error) {
      console.error('Error counting tokens:', error);
      return Math.ceil(text.length / 4); // Fallback estimation
    }
  }

  /**
   * Count tokens for all messages in a branch with debouncing
   */
  async countBranchTokens(
    messages: Message[], 
    currentInput: string = '',
    branchId: string
  ): Promise<number> {
    const fullText = this.messagesToText(messages, currentInput);
    const cacheKey = `branch-${branchId}-${this.hashString(fullText)}`;
    
    // Debounce for real-time input
    if (this.debounceTimers.has(branchId)) {
      clearTimeout(this.debounceTimers.get(branchId));
    }
    
    return new Promise((resolve) => {
      const timer = window.setTimeout(async () => {
        const count = await this.countTokens(fullText, cacheKey);
        this.debounceTimers.delete(branchId);
        resolve(count);
      }, 150); // Short debounce for real-time feel
      
      this.debounceTimers.set(branchId, timer);
    });
  }

  /**
   * Get token usage status for a branch against the active model
   */
  getTokenUsage(
    currentTokens: number, 
    model: ModelInfo | null,
    hasCompactedSections = false
  ): TokenUsage {
    const limit = model?.inputTokenLimit || 4096;
    const percentage = (currentTokens / limit) * 100;
    
    return {
      current: currentTokens,
      limit,
      percentage,
      canCompact: currentTokens > limit * 0.5 && !hasCompactedSections,
      shouldCompact: percentage > 80
    };
  }

  /**
   * Convert messages to text for token counting
   */
  messagesToText(messages: Message[], currentInput = ''): string {
    const messageTexts = messages.map(msg => {
      // Include both original content and content parts
      const mainContent = msg.content || '';
      const partsContent = msg.contentParts
        ?.map(part => part.content)
        .join('\n') || '';
      
      return `${msg.role}: ${mainContent}\n${partsContent}`.trim();
    });
    
    if (currentInput.trim()) {
      messageTexts.push(`user: ${currentInput}`);
    }
    
    return messageTexts.join('\n\n');
  }

  /**
   * Create a summary of messages for compaction
   */
  async createCompactSummary(messages: Message[]): Promise<string> {
    if (messages.length === 0) return '';
    
    const conversationText = this.messagesToText(messages);
    
    try {
      const response = await fetch('http://127.0.0.1:5050/compact-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: conversationText,
          maxSummaryTokens: 500 // Keep summary concise
        })
      });
      
      const data = await response.json();
      return data.summary || 'Previous conversation context available.';
    } catch (error) {
      console.error('Error creating compact summary:', error);
      // Fallback: create a simple summary
      return this.createFallbackSummary(messages);
    }
  }

  /**
   * Fallback summary creation when API is unavailable
   */
  private createFallbackSummary(messages: Message[]): string {
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    const totalLength = this.messagesToText(messages).length;
    
    return `Previous conversation: ${userMessages} user messages, ${assistantMessages} assistant responses (${Math.ceil(totalLength / 1000)}k chars)`;
  }

  /**
   * Simple string hash for caching
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  /**
   * Clear cache for a specific branch
   */
  clearBranchCache(branchId: string): void {
    for (const key of this.tokenCache.keys()) {
      if (key.startsWith(`branch-${branchId}`)) {
        this.tokenCache.delete(key);
      }
    }
  }

  /**
   * Clear all token caches
   */
  clearAllCaches(): void {
    this.tokenCache.clear();
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
  }
}

export const tokenTrackingService = new TokenTrackingService();