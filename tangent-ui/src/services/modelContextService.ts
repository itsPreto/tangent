
export interface ModelContextInfo {
  contextLength: number;
  promptTokenCount: number;
  responseTokenCount: number;
  maxTokens: number;
}

export interface CompactSummary {
  id: string;
  branchTitle: string;
  summary: string;
  originalMessageCount: number;
  compactedAt: string;
  parentSummaries?: CompactSummary[];
}

export interface ConversationCompactOptions {
  maxSummaryWords: number;
  includeParentContext: boolean;
  compactThreshold: number; // percentage of context to trigger compaction
}

class ModelContextService {
  private contextCache = new Map<string, ModelContextInfo>();
  
  async getModelContextInfo(modelName: string): Promise<ModelContextInfo | null> {
    if (this.contextCache.has(modelName)) {
      return this.contextCache.get(modelName)!;
    }

    try {
      const response = await fetch('http://localhost:5050/api/ollama-proxy/show', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: modelName
        })
      });

      if (!response.ok) {
        console.error(`Failed to fetch model info for ${modelName}:`, response.status);
        return null;
      }

      const modelData = await response.json();
      
      // Extract context length from model parameters
      const contextLength = this.extractContextLength(modelData);
      
      const contextInfo: ModelContextInfo = {
        contextLength,
        promptTokenCount: 0,
        responseTokenCount: 0,
        maxTokens: contextLength
      };

      this.contextCache.set(modelName, contextInfo);
      return contextInfo;
    } catch (error) {
      console.error(`Error fetching model context info for ${modelName}:`, error);
      return null;
    }
  }

  private extractContextLength(modelData: any): number {
    // Check various possible locations for context length
    if (modelData.parameters?.num_ctx) {
      return parseInt(modelData.parameters.num_ctx);
    }
    
    if (modelData.modelinfo?.['llama.context_length']) {
      return parseInt(modelData.modelinfo['llama.context_length']);
    }
    
    if (modelData.details?.parameters?.num_ctx) {
      return parseInt(modelData.details.parameters.num_ctx);
    }

    // Check template parameters
    if (modelData.template) {
      const template = modelData.template.toLowerCase();
      if (template.includes('8192')) return 8192;
      if (template.includes('4096')) return 4096;
      if (template.includes('2048')) return 2048;
      if (template.includes('32768')) return 32768;
      if (template.includes('16384')) return 16384;
    }

    // Default fallback - most common for smaller models
    return 4096;
  }

  async shouldCompactConversation(
    messages: any[], 
    modelName: string, 
    options: ConversationCompactOptions
  ): Promise<boolean> {
    const contextInfo = await this.getModelContextInfo(modelName);
    if (!contextInfo) return false;

    const estimatedTokens = this.estimateTokenCount(messages);
    const contextUsagePercentage = (estimatedTokens / contextInfo.contextLength) * 100;
    
    return contextUsagePercentage >= options.compactThreshold;
  }

  private estimateTokenCount(messages: any[]): number {
    // Simple token estimation - roughly 4 characters per token
    let totalChars = 0;
    for (const message of messages) {
      if (typeof message.content === 'string') {
        totalChars += message.content.length;
      }
    }
    return Math.ceil(totalChars / 4);
  }

  async compactConversation(
    messages: any[],
    branchTitle: string,
    options: Partial<ConversationCompactOptions> = {}
  ): Promise<CompactSummary> {
    const defaultOptions: ConversationCompactOptions = {
      maxSummaryWords: 400,
      includeParentContext: true,
      compactThreshold: 80
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // Build conversation text for summarization
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    // Generate summary using the router service
    const { routerService } = await import('@/services/routerService');
    const routingResult = await routerService.routeRequest({
      message: `Please provide a comprehensive summary of the following conversation in exactly ${finalOptions.maxSummaryWords} words or less. Focus on key topics, decisions, and outcomes:\n\n${conversationText}`,
      hasImages: false
    });

    if (!routingResult.model) {
      throw new Error('No model available for conversation summarization');
    }

    const response = await fetch('http://localhost:5050/api/ollama-proxy/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: routingResult.model.name || routingResult.model.id,
        prompt: `Please provide a comprehensive summary of the following conversation in exactly ${finalOptions.maxSummaryWords} words or less. Focus on key topics, decisions, and outcomes:\n\n${conversationText}`,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: Math.ceil(finalOptions.maxSummaryWords * 1.5) // Allow some buffer
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate summary: ${response.status}`);
    }

    const result = await response.json();
    const summary = result.response?.trim() || 'Summary generation failed';

    return {
      id: `compact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      branchTitle,
      summary,
      originalMessageCount: messages.length,
      compactedAt: new Date().toISOString()
    };
  }

  buildMultiBranchContext(summaries: CompactSummary[]): string {
    if (summaries.length === 0) return '';
    
    let contextText = 'The following summaries belong to the user whom you are providing assistance to. The conversation is structured into a branching scheme:\n\n';
    
    summaries.forEach((summary, index) => {
      const branchLabel = String.fromCharCode(65 + index); // A, B, C, etc.
      contextText += `Branch ${branchLabel} "${summary.branchTitle}": ${summary.summary}\n\n`;
    });
    
    contextText += 'Please use this context to provide relevant and informed responses.';
    
    return contextText;
  }

  clearCache(): void {
    this.contextCache.clear();
  }
}

export const modelContextService = new ModelContextService();