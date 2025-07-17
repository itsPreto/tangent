/**
 * Claude Code SDK Message Parser
 * Handles parsing and processing of Claude Code SDK stream-json messages
 * according to the official SDK documentation
 */

export interface ClaudeCodeSystemMessage {
  type: 'system'
  subtype: 'init'
  session_id: string
  model: string
  tools: string[]
  mcp_servers: { name: string; status: string }[]
  cwd: string
  permission_mode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
}

export interface ClaudeCodeTextMessage {
  type: 'text'
  content: string
  session_id: string
}

export interface ClaudeCodeToolUseMessage {
  type: 'tool_use'
  tool_name: string
  tool_id: string
  parameters: Record<string, any>
  session_id: string
}

export interface ClaudeCodeUserMessage {
  type: 'user'
  content: string
  session_id: string
}

export interface ClaudeCodeResultMessage {
  type: 'result'
  subtype: 'success' | 'error_max_turns' | 'error_during_execution'
  session_id: string
  duration_ms: number
  duration_api_ms: number
  num_turns: number
  total_cost_usd: number
  is_error: boolean
  result?: string
}

export interface ClaudeCodeUnknownMessage {
  type: 'unknown'
  raw_message: any
}

export interface ClaudeCodeRawOutputMessage {
  type: 'raw_output'
  content: string
  parse_error?: string
}

export type ClaudeCodeMessage = 
  | ClaudeCodeSystemMessage
  | ClaudeCodeTextMessage
  | ClaudeCodeToolUseMessage
  | ClaudeCodeUserMessage
  | ClaudeCodeResultMessage
  | ClaudeCodeUnknownMessage
  | ClaudeCodeRawOutputMessage

export interface ParsedStreamingMessage {
  id: string
  timestamp: Date
  message: ClaudeCodeMessage
  sessionId: string
  isComplete: boolean
}

export class ClaudeCodeMessageParser {
  private messageBuffer: string = ''
  private currentSession: string | null = null
  private messageCount: number = 0
  
  /**
   * Parse a streaming message from Claude Code SDK
   */
  parseMessage(data: string): ParsedStreamingMessage | null {
    try {
      // Clean the data and parse JSON
      const cleanData = data.trim()
      if (!cleanData) return null
      
      // Handle SSE format (data: {...})
      let jsonData: string
      if (cleanData.startsWith('data: ')) {
        jsonData = cleanData.substring(6)
      } else {
        jsonData = cleanData
      }
      
      const message: ClaudeCodeMessage = JSON.parse(jsonData)
      
      // Extract session ID from message
      const sessionId = this.extractSessionId(message)
      if (sessionId) {
        this.currentSession = sessionId
      }
      
      // Create parsed message
      const parsed: ParsedStreamingMessage = {
        id: this.generateMessageId(),
        timestamp: new Date(),
        message,
        sessionId: sessionId || this.currentSession || 'unknown',
        isComplete: this.isMessageComplete(message)
      }
      
      return parsed
      
    } catch (error) {
      console.error('Failed to parse Claude Code message:', error, 'Data:', data)
      return null
    }
  }
  
  /**
   * Extract session ID from various message types
   */
  private extractSessionId(message: ClaudeCodeMessage): string | null {
    switch (message.type) {
      case 'system':
      case 'text':
      case 'tool_use':
      case 'user':
      case 'result':
        return message.session_id
      default:
        return null
    }
  }
  
  /**
   * Check if a message indicates completion
   */
  private isMessageComplete(message: ClaudeCodeMessage): boolean {
    return message.type === 'result'
  }
  
  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageCount}`
  }
  
  /**
   * Get current session ID
   */
  getCurrentSession(): string | null {
    return this.currentSession
  }
  
  /**
   * Reset parser state
   */
  reset(): void {
    this.messageBuffer = ''
    this.currentSession = null
    this.messageCount = 0
  }
  
  /**
   * Extract text content from messages for display
   */
  static extractTextContent(messages: ParsedStreamingMessage[]): string {
    return messages
      .filter(m => m.message.type === 'text')
      .map(m => (m.message as ClaudeCodeTextMessage).content)
      .join('')
  }
  
  /**
   * Extract tool uses from messages
   */
  static extractToolUses(messages: ParsedStreamingMessage[]): ClaudeCodeToolUseMessage[] {
    return messages
      .filter(m => m.message.type === 'tool_use')
      .map(m => m.message as ClaudeCodeToolUseMessage)
  }
  
  /**
   * Get session statistics from result message
   */
  static getSessionStats(messages: ParsedStreamingMessage[]): {
    cost: number
    turns: number
    duration: number
    success: boolean
  } | null {
    const resultMessage = messages.find(m => m.message.type === 'result')
    if (!resultMessage) return null
    
    const result = resultMessage.message as ClaudeCodeResultMessage
    return {
      cost: result.total_cost_usd,
      turns: result.num_turns,
      duration: result.duration_ms,
      success: result.subtype === 'success'
    }
  }
  
  /**
   * Check if conversation is still active
   */
  static isConversationActive(messages: ParsedStreamingMessage[]): boolean {
    const lastMessage = messages[messages.length - 1]
    return !lastMessage || lastMessage.message.type !== 'result'
  }
  
  /**
   * Format message for display
   */
  static formatMessageForDisplay(message: ParsedStreamingMessage): string {
    switch (message.message.type) {
      case 'system':
        const sys = message.message as ClaudeCodeSystemMessage
        return `🔧 Session initialized (${sys.model}) - ${sys.tools.length} tools available`
      
      case 'text':
        const text = message.message as ClaudeCodeTextMessage
        return text.content
      
      case 'tool_use':
        const tool = message.message as ClaudeCodeToolUseMessage
        return `🛠️ ${tool.tool_name}(${Object.keys(tool.parameters).join(', ')}) <button class="tool-popout-btn" onclick="popOutToolCall('${tool.tool_id}', '${tool.tool_name}')">Open in Branch</button>`
      
      case 'user':
        const user = message.message as ClaudeCodeUserMessage
        return `👤 ${user.content}`
      
      case 'result':
        const result = message.message as ClaudeCodeResultMessage
        const status = result.subtype === 'success' ? '✅' : '❌'
        return `${status} Complete (${result.num_turns} turns, $${result.total_cost_usd.toFixed(4)})`
      
      default:
        return `❓ Unknown message type: ${message.message.type}`
    }
  }
}