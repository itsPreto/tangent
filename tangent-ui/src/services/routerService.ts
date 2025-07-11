/**
 * Router Service - Intelligent request routing using qwen2.5vl:3b
 * Routes requests to appropriate agents based on content analysis
 */

import type { ModelInfo } from '@/types/model';

export interface RoutingRequest {
  message: string;
  hasImages?: boolean;
  context?: string;
}

export interface RoutingResult {
  category: 'code' | 'vision' | 'text' | 'custom';
  confidence: number;
  model: ModelInfo | null;
  agent?: any; // AgentConfig
  reasoning?: string;
  fallbackUsed?: boolean;
  responseTime?: number;
  title?: string; // Generated title for the branch
}

export interface RouterSettings {
  enabled: boolean;
  routerModel: string;
  fallbackToKeywords: boolean;
  confidenceThreshold: number;
  generateTitles: boolean;
  titleModel?: string;
}

class RouterService {
  private readonly OLLAMA_URL = 'http://localhost:11434';
  private readonly ROUTER_MODEL = 'qwen2.5vl:3b';
  private readonly TITLE_MODEL = 'llama3.2:3b'; // Fast, lightweight model for title generation
  
  // Cache for existing titles to avoid duplicates
  private titleCache = new Set<string>();
  
  // Synonym map for creating unique titles
  private readonly SYNONYMS: Record<string, string[]> = {
    'create': ['build', 'make', 'craft', 'develop', 'design'],
    'fix': ['repair', 'solve', 'debug', 'resolve', 'patch'],
    'analyze': ['examine', 'study', 'review', 'inspect', 'assess'],
    'help': ['assist', 'guide', 'support', 'aid', 'advise'],
    'code': ['script', 'program', 'software', 'app', 'system'],
    'data': ['info', 'details', 'facts', 'content', 'material'],
    'question': ['query', 'ask', 'inquiry', 'doubt', 'problem'],
    'solution': ['answer', 'fix', 'remedy', 'approach', 'method'],
    'project': ['task', 'work', 'plan', 'effort', 'mission'],
    'design': ['layout', 'style', 'pattern', 'format', 'structure']
  };
  
  // High-confidence routing prompt optimized for qwen2.5vl:3b
  private readonly ROUTING_PROMPT = `You are a request router. Analyze the user's request and categorize it into exactly one category.

Categories:
- "code" - Programming, debugging, software development, technical implementation, algorithms, code review
- "vision" - Image analysis, photo description, visual content questions, screenshot analysis  
- "text" - General conversation, knowledge questions, explanations, creative writing, non-technical topics

Rules:
1. Respond with ONLY the category name: "code", "vision", or "text"
2. No explanations, no additional text, no punctuation
3. If images are present, always choose "vision"
4. Programming questions are always "code" even if no code is shown

Request: "{query}"

Category:`;

  // Keyword fallback patterns
  private readonly CODE_KEYWORDS = [
    'code', 'function', 'class', 'variable', 'debug', 'error', 'bug', 'fix',
    'javascript', 'python', 'typescript', 'react', 'vue', 'css', 'html',
    'api', 'endpoint', 'database', 'query', 'algorithm', 'programming',
    'syntax', 'compile', 'runtime', 'framework', 'library', 'npm', 'git',
    'terminal', 'command line', 'bash', 'shell', 'regex', 'json', 'xml',
    'threejs', 'three.js', 'webgl', 'canvas', 'scene', 'mesh', 'geometry',
    'material', 'shader', 'render', 'animation', 'texture', 'lighting'
  ];

  private readonly VISION_KEYWORDS = [
    'image', 'photo', 'picture', 'screenshot', 'visual', 'see', 'look',
    'analyze', 'describe', 'colors', 'composition', 'happening', 'shows',
    'appears', 'visible', 'display', 'screen', 'chart', 'graph', 'diagram'
  ];

  /**
   * Get router settings from localStorage
   */
  getSettings(): RouterSettings {
    const saved = localStorage.getItem('routerSettings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse router settings:', e);
      }
    }
    
    return {
      enabled: true,
      routerModel: this.ROUTER_MODEL,
      fallbackToKeywords: true,
      confidenceThreshold: 0.8,
      generateTitles: true,
      titleModel: this.TITLE_MODEL
    };
  }

  /**
   * Save router settings
   */
  saveSettings(settings: RouterSettings): void {
    localStorage.setItem('routerSettings', JSON.stringify(settings));
  }

  /**
   * Route a request to the appropriate agent
   */
  async routeRequest(
    request: RoutingRequest, 
    options?: { 
      generateTitle?: boolean;
      onTitleUpdate?: (partialTitle: string) => void;
    }
  ): Promise<RoutingResult> {
    const settings = this.getSettings();
    
    // Quick check for images - always route to vision
    if (request.hasImages) {
      const visionAgent = await this.getVisionAgent();
      return {
        category: 'vision',
        confidence: 1.0,
        model: visionAgent?.model || null,
        agent: visionAgent,
        reasoning: 'Request contains images'
      };
    }

    // First try custom agents with pattern matching
    const customResult = await this.tryCustomAgents(request);
    if (customResult) {
      return customResult;
    }

    if (!settings.enabled) {
      // Fallback to keyword routing if router is disabled
      return await this.keywordRouting(request, options);
    }

    try {
      // Use LLM router for intelligent categorization
      const result = await this.llmRouting(request, settings);
      
      // If confidence is too low, fallback to keywords
      if (settings.fallbackToKeywords && result.confidence < settings.confidenceThreshold) {
        console.log('[Router] Low confidence, falling back to keyword routing');
        const keywordResult = await this.keywordRouting(request, options);
        keywordResult.fallbackUsed = true;
        return keywordResult;
      }
      
      // Generate title if requested and this is the first request
      if (options?.generateTitle && settings.generateTitles) {
        try {
          const title = await this.generateBranchTitle(
            request.message, 
            request.context,
            options.onTitleUpdate
          );
          result.title = title;
        } catch (titleError) {
          console.error('[Router] Title generation failed during routing:', titleError);
          // Continue without title - not critical
        }
      }
      
      return result;
    } catch (error) {
      console.error('[Router] LLM routing failed:', error);
      
      if (settings.fallbackToKeywords) {
        console.log('[Router] LLM failed, falling back to keyword routing');
        const keywordResult = await this.keywordRouting(request, options);
        keywordResult.fallbackUsed = true;
        return keywordResult;
      } else {
        throw error;
      }
    }
  }

  /**
   * Try to match request with custom agents
   */
  private async tryCustomAgents(request: RoutingRequest): Promise<RoutingResult | null> {
    try {
      const { useAgentStore } = await import('@/stores/agentStore');
      const agentStore = useAgentStore();
      
      const bestAgent = agentStore.findBestAgentForTask(request.message);
      
      if (bestAgent && bestAgent.type === 'custom' && bestAgent.model) {
        console.log(`[Router] Custom agent match: ${bestAgent.name}`);
        return {
          category: 'custom',
          confidence: 0.9,
          model: bestAgent.model,
          agent: bestAgent,
          reasoning: `Matched custom agent: ${bestAgent.name}`
        };
      }
      
      return null;
    } catch (error) {
      console.error('[Router] Error checking custom agents:', error);
      return null;
    }
  }

  /**
   * LLM-based intelligent routing using configured router model
   */
  private async llmRouting(request: RoutingRequest, settings: RouterSettings): Promise<RoutingResult> {
    const startTime = Date.now();
    
    // Get the router agent's model
    const routerModel = await this.getRouterModel();
    const modelToUse = routerModel?.name || settings.routerModel;
    
    const prompt = this.ROUTING_PROMPT.replace('{query}', request.message);
    
    try {
      const response = await fetch(`${this.OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for consistent routing
            num_predict: 5,   // Short response expected
            stop: ['\n', '.', '!', '?']
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Router API error: ${response.status}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      // Clean and validate response
      const rawResponse = data.response?.trim().toLowerCase() || '';
      const category = this.extractCategory(rawResponse);
      
      if (!category) {
        throw new Error(`Invalid router response: "${rawResponse}"`);
      }

      // Get appropriate agent for the category
      const { model, agent } = await this.getAgentForCategory(category);
      
      // Calculate confidence based on response clarity
      const confidence = this.calculateConfidence(rawResponse, category);
      
      console.log(`[Router] ${request.message.substring(0, 50)}... → ${category} (${responseTime}ms, ${confidence.toFixed(2)} confidence)`);
      
      return {
        category,
        confidence,
        model,
        agent,
        reasoning: `LLM routing: "${rawResponse}" → ${category}`,
        responseTime
      };
      
    } catch (error) {
      console.error('[Router] LLM routing error:', error);
      throw error;
    }
  }

  /**
   * Keyword-based fallback routing
   */
  private async keywordRouting(
    request: RoutingRequest, 
    options?: { 
      generateTitle?: boolean;
      onTitleUpdate?: (partialTitle: string) => void;
    }
  ): Promise<RoutingResult> {
    const message = request.message.toLowerCase();
    
    // Check for code keywords
    const codeMatches = this.CODE_KEYWORDS.filter(keyword => message.includes(keyword));
    const visionMatches = this.VISION_KEYWORDS.filter(keyword => message.includes(keyword));
    
    let category: 'code' | 'vision' | 'text';
    let confidence: number;
    let reasoning: string;
    
    if (codeMatches.length > visionMatches.length && codeMatches.length > 0) {
      category = 'code';
      confidence = Math.min(0.9, 0.5 + (codeMatches.length * 0.1));
      reasoning = `Keyword routing: found code keywords [${codeMatches.join(', ')}]`;
    } else if (visionMatches.length > 0) {
      category = 'vision';
      confidence = Math.min(0.9, 0.5 + (visionMatches.length * 0.1));
      reasoning = `Keyword routing: found vision keywords [${visionMatches.join(', ')}]`;
    } else {
      category = 'text';
      confidence = 0.7; // Default confidence for general text
      reasoning = 'Keyword routing: no specific keywords found, defaulting to text';
    }
    
    const { model, agent } = await this.getAgentForCategory(category);
    
    console.log(`[Router] Keyword: ${request.message.substring(0, 50)}... → ${category} (${confidence.toFixed(2)} confidence)`);
    
    const result: RoutingResult = {
      category,
      confidence,
      model,
      agent,
      reasoning
    };

    // Generate title if requested
    if (options?.generateTitle) {
      const settings = this.getSettings();
      if (settings.generateTitles) {
        try {
          const title = await this.generateBranchTitle(
            request.message, 
            request.context,
            options.onTitleUpdate
          );
          result.title = title;
        } catch (titleError) {
          console.error('[Router] Title generation failed during keyword routing:', titleError);
          // Continue without title - not critical
        }
      }
    }
    
    return result;
  }

  /**
   * Extract category from router response
   */
  private extractCategory(response: string): 'code' | 'vision' | 'text' | null {
    // Clean the response
    let cleaned = response.replace(/['"]/g, '').trim();
    cleaned = cleaned.replace(/^(category:|answer:|response:)\s*/i, '');
    cleaned = cleaned.split(/\s+/)[0]; // Take first word
    cleaned = cleaned.replace(/[^\w]/g, ''); // Remove punctuation
    
    // Validate against known categories
    const validCategories = ['code', 'vision', 'text'];
    return validCategories.includes(cleaned) ? cleaned as any : null;
  }

  /**
   * Calculate confidence based on response clarity
   */
  private calculateConfidence(response: string, category: string): number {
    // High confidence if response is clean and matches exactly
    if (response.trim() === category) {
      return 0.95;
    }
    
    // Medium confidence if response contains the category
    if (response.includes(category)) {
      return 0.85;
    }
    
    // Lower confidence if we had to extract/clean the response
    return 0.75;
  }

  /**
   * Get agent and model for a specific category
   */
  private async getAgentForCategory(category: 'code' | 'vision' | 'text'): Promise<{ model: ModelInfo | null; agent: any }> {
    try {
      const { useAgentStore } = await import('@/stores/agentStore');
      const agentStore = useAgentStore();
      
      let agent = null;
      
      switch (category) {
        case 'code':
          agent = agentStore.codeAgent;
          break;
        case 'vision':
          agent = agentStore.visionAgent;
          break;
        case 'text':
          agent = agentStore.textAgent;
          break;
      }
      
      return {
        model: agent?.model || null,
        agent: agent
      };
    } catch (error) {
      console.error('[Router] Failed to get agent for category:', error);
      return { model: null, agent: null };
    }
  }

  /**
   * Get vision agent specifically
   */
  private async getVisionAgent(): Promise<any> {
    try {
      const { useAgentStore } = await import('@/stores/agentStore');
      const agentStore = useAgentStore();
      
      return agentStore.visionAgent;
    } catch (error) {
      console.error('[Router] Failed to get vision agent:', error);
      return null;
    }
  }

  /**
   * Get router agent's model
   */
  private async getRouterModel(): Promise<any> {
    try {
      const { useAgentStore } = await import('@/stores/agentStore');
      const agentStore = useAgentStore();
      
      const routerAgent = agentStore.agentConfigs.find(config => config.type === 'router' && config.isDefault);
      return routerAgent?.model || null;
    } catch (error) {
      console.error('[Router] Failed to get router model:', error);
      return null;
    }
  }

  /**
   * Generate a concise title for a branch node using small LLM
   */
  async generateBranchTitle(
    message: string, 
    context?: string,
    onTitleUpdate?: (partialTitle: string) => void
  ): Promise<string> {
    const settings = this.getSettings();
    
    if (!settings.generateTitles) {
      return this.generateFallbackTitle(message);
    }

    try {
      // Build a focused prompt for title generation
      const contextText = context ? `\nContext: ${context}` : '';
      const prompt = `Generate a concise 2-4 word title for this conversation starter. Be creative but clear.${contextText}

User message: "${message}"

Title:`;

      const modelToUse = settings.titleModel || this.TITLE_MODEL;
      
      const response = await fetch(`${this.OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          prompt: prompt,
          stream: true,
          options: {
            temperature: 0.7, // Higher creativity for titles
            num_predict: 15,  // Short titles
            stop: ['\n', '.', '!', '?', ':', ';']
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Title generation API error: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let title = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                title += data.response;
                // Stream partial updates for real-time animation
                if (onTitleUpdate) {
                  onTitleUpdate(title.trim());
                }
              }
            } catch (e) {
              // Ignore malformed JSON
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Clean up the title
      title = this.cleanupTitle(title);
      
      // Handle duplicates
      title = this.ensureUniqueTitle(title);
      
      // Cache the title
      this.titleCache.add(title.toLowerCase());
      
      console.log(`[Router] Generated title: "${title}" for message: "${message.substring(0, 50)}..."`);
      
      return title;
      
    } catch (error) {
      console.error('[Router] Title generation failed:', error);
      return this.generateFallbackTitle(message);
    }
  }

  /**
   * Clean up generated title
   */
  private cleanupTitle(title: string): string {
    return title
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '') // Remove quotes
      .replace(/^\w+:?\s*/, '') // Remove "Title:" prefix
      .replace(/[.!?]+$/, '') // Remove ending punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Ensure title is unique by using synonyms
   */
  private ensureUniqueTitle(title: string): string {
    const normalizedTitle = title.toLowerCase();
    
    if (!this.titleCache.has(normalizedTitle)) {
      return title;
    }

    // Try to create unique variants using synonyms
    const words = title.split(' ');
    
    for (let attempts = 0; attempts < 5; attempts++) {
      const modifiedWords = words.map(word => {
        const lowerWord = word.toLowerCase();
        const synonyms = this.SYNONYMS[lowerWord];
        
        if (synonyms && synonyms.length > 0) {
          // Use the attempt number to cycle through synonyms
          const synonymIndex = attempts % synonyms.length;
          return word.charAt(0).toUpperCase() + synonyms[synonymIndex].slice(1);
        }
        return word;
      });
      
      const newTitle = modifiedWords.join(' ');
      const normalizedNewTitle = newTitle.toLowerCase();
      
      if (!this.titleCache.has(normalizedNewTitle)) {
        return newTitle;
      }
    }

    // If all synonyms are taken, add a number
    for (let i = 2; i <= 10; i++) {
      const numberedTitle = `${title} ${i}`;
      if (!this.titleCache.has(numberedTitle.toLowerCase())) {
        return numberedTitle;
      }
    }

    // Fallback: timestamp
    return `${title} ${Date.now().toString().slice(-3)}`;
  }

  /**
   * Generate a simple fallback title from the message
   */
  private generateFallbackTitle(message: string): string {
    // Extract key words from the message
    const words = message
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['the', 'and', 'but', 'for', 'are', 'with', 'can', 'you', 'how', 'what', 'when', 'where', 'why'].includes(word))
      .slice(0, 3);

    if (words.length === 0) {
      return 'New Chat';
    }

    const title = words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return this.ensureUniqueTitle(title);
  }

  /**
   * Initialize title cache from existing nodes
   */
  initializeTitleCache(existingTitles: string[]): void {
    this.titleCache.clear();
    existingTitles.forEach(title => {
      this.titleCache.add(title.toLowerCase());
    });
  }

  /**
   * Test router performance
   */
  async testRouter(): Promise<{ avgResponseTime: number; accuracy: number; results: any[] }> {
    const testCases = [
      { message: "How do I create a React component?", expected: "code" },
      { message: "Debug this JavaScript error", expected: "code" },
      { message: "What do you see in this image?", expected: "vision" },
      { message: "Analyze this photo", expected: "vision" },
      { message: "Tell me about quantum physics", expected: "text" },
      { message: "What's the weather like?", expected: "text" }
    ];

    const results = [];
    let totalTime = 0;
    let correct = 0;

    for (const testCase of testCases) {
      try {
        const result = await this.routeRequest({ message: testCase.message });
        
        const isCorrect = result.category === testCase.expected;
        if (isCorrect) correct++;
        
        totalTime += result.responseTime || 0;
        
        results.push({
          message: testCase.message,
          expected: testCase.expected,
          actual: result.category,
          correct: isCorrect,
          confidence: result.confidence,
          responseTime: result.responseTime
        });
        
      } catch (error) {
        results.push({
          message: testCase.message,
          expected: testCase.expected,
          actual: 'error',
          correct: false,
          error: error.message
        });
      }
    }

    return {
      avgResponseTime: totalTime / testCases.length,
      accuracy: (correct / testCases.length) * 100,
      results
    };
  }
}

// Export singleton instance
export const routerService = new RouterService();
export default routerService;