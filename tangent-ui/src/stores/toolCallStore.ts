import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ToolCall {
  id: string
  node_id: string
  tool_name: string
  parameters: Record<string, any>
  result?: Record<string, any>
  status: 'pending' | 'success' | 'error'
  error_message?: string
  duration_ms?: number
  created_at: string
  updated_at: string
}

export interface FileNode {
  id: string
  node_id: string
  file_path: string
  file_size: number
  content_hash?: string
  mime_type: string
  created_by?: string
  modified_by?: string
  created_at: string
  updated_at: string
}

export interface ExecutionNode {
  id: string
  node_id: string
  command: string
  working_dir?: string
  environment?: Record<string, string>
  pid?: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed'
  exit_code?: number
  stdout?: string
  stderr?: string
  started_by?: string
  created_at: string
  updated_at: string
}

export interface ClaudeCodeInstance {
  instance_id: string
  status: 'starting' | 'running' | 'paused' | 'stopped' | 'error' | 'completed'
  session_id?: string
  cost_usd: number
  num_turns: number
  duration_ms: number
  working_dir: string
  node_id?: string
  config: Record<string, any>
  // Auto-detection fields
  pid?: number
  memory_mb?: number
  cpu_percent?: number
  allowed_tools?: string[]
  command_line?: string
  is_detected?: boolean
  created_at?: string
}

export interface ClaudeCodeSession {
  session_id: string
  instance_id: string
  config: Record<string, any>
  cost_usd: number
  num_turns: number
  working_dir: string
  created_at: string
  final_status: string
}

export const useToolCallStore = defineStore('toolCall', () => {
  // State
  const toolCalls = ref<Map<string, ToolCall[]>>(new Map()) // node_id -> tool_calls[]
  const fileNodes = ref<Map<string, FileNode[]>>(new Map()) // node_id -> file_nodes[]
  const executionNodes = ref<Map<string, ExecutionNode[]>>(new Map()) // node_id -> execution_nodes[]
  const claudeCodeInstances = ref<Map<string, ClaudeCodeInstance>>(new Map()) // instance_id -> instance
  const claudeCodeSessions = ref<ClaudeCodeSession[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const getToolCallsForNode = computed(() => {
    return (nodeId: string) => toolCalls.value.get(nodeId) || []
  })

  const getFileNodesForNode = computed(() => {
    return (nodeId: string) => fileNodes.value.get(nodeId) || []
  })

  const getExecutionNodesForNode = computed(() => {
    return (nodeId: string) => executionNodes.value.get(nodeId) || []
  })

  const getActiveInstances = computed(() => {
    return Array.from(claudeCodeInstances.value.values())
      .filter(instance => ['running', 'paused'].includes(instance.status))
  })

  const getAllInstances = computed(() => {
    return Array.from(claudeCodeInstances.value.values())
  })

  const getTotalCost = computed(() => {
    return Array.from(claudeCodeInstances.value.values())
      .reduce((total, instance) => total + (instance.cost_usd || 0), 0)
  })

  // Actions
  async function fetchToolCallsForNode(nodeId: string) {
    try {
      loading.value = true
      error.value = null
      
      const response = await fetch(`http://127.0.0.1:5050/api/tool-calls/node/${nodeId}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      toolCalls.value.set(nodeId, data)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch tool calls'
      console.error('Error fetching tool calls:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchFileNodesForNode(nodeId: string) {
    try {
      loading.value = true
      error.value = null
      
      const response = await fetch(`http://127.0.0.1:5050/api/file-nodes/node/${nodeId}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      fileNodes.value.set(nodeId, data)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch file nodes'
      console.error('Error fetching file nodes:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchExecutionNodesForNode(nodeId: string) {
    try {
      loading.value = true
      error.value = null
      
      const response = await fetch(`http://127.0.0.1:5050/api/execution-nodes/node/${nodeId}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      executionNodes.value.set(nodeId, data)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch execution nodes'
      console.error('Error fetching execution nodes:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchAllForNode(nodeId: string) {
    await Promise.all([
      fetchToolCallsForNode(nodeId),
      fetchFileNodesForNode(nodeId),
      fetchExecutionNodesForNode(nodeId)
    ])
  }

  async function terminateExecution(executionId: string) {
    try {
      const response = await fetch(`http://127.0.0.1:5050/api/execution-nodes/${executionId}/terminate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data.success
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to terminate execution'
      console.error('Error terminating execution:', err)
      return false
    }
  }

  // Claude Code Management
  async function createClaudeCodeInstance(config: Record<string, any>): Promise<string | null> {
    try {
      loading.value = true
      error.value = null
      
      const response = await fetch('http://127.0.0.1:5050/api/claude-code/instances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data.instance_id
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create Claude Code instance'
      console.error('Error creating Claude Code instance:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  async function fetchClaudeCodeInstances() {
    try {
      loading.value = true
      error.value = null
      
      const response = await fetch('http://127.0.0.1:5050/api/claude-code/instances')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      claudeCodeInstances.value.clear()
      data.forEach((instance: ClaudeCodeInstance) => {
        claudeCodeInstances.value.set(instance.instance_id, instance)
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch Claude Code instances'
      console.error('Error fetching Claude Code instances:', err)
    } finally {
      loading.value = false
    }
  }

  async function getClaudeCodeInstanceStatus(instanceId: string) {
    try {
      const response = await fetch(`http://127.0.0.1:5050/api/claude-code/instances/${instanceId}/status`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      claudeCodeInstances.value.set(instanceId, data)
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to get instance status'
      console.error('Error getting instance status:', err)
      return null
    }
  }

  async function sendMessageToInstance(instanceId: string, message: string) {
    try {
      const response = await fetch(`http://127.0.0.1:5050/api/claude-code/instances/${instanceId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data.success
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to send message'
      console.error('Error sending message:', err)
      return false
    }
  }

  async function pauseInstance(instanceId: string) {
    try {
      const response = await fetch(`http://127.0.0.1:5050/api/claude-code/instances/${instanceId}/pause`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      if (data.success) {
        await getClaudeCodeInstanceStatus(instanceId)
      }
      return data.success
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to pause instance'
      console.error('Error pausing instance:', err)
      return false
    }
  }

  async function resumeInstance(instanceId: string) {
    try {
      const response = await fetch(`http://127.0.0.1:5050/api/claude-code/instances/${instanceId}/resume`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      if (data.success) {
        await getClaudeCodeInstanceStatus(instanceId)
      }
      return data.success
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to resume instance'
      console.error('Error resuming instance:', err)
      return false
    }
  }

  async function stopInstance(instanceId: string) {
    try {
      const response = await fetch(`http://127.0.0.1:5050/api/claude-code/instances/${instanceId}/stop`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      if (data.success) {
        claudeCodeInstances.value.delete(instanceId)
      }
      return data.success
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to stop instance'
      console.error('Error stopping instance:', err)
      return false
    }
  }

  async function fetchClaudeCodeSessions() {
    try {
      loading.value = true
      error.value = null
      
      const response = await fetch('http://127.0.0.1:5050/api/claude-code/sessions')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      claudeCodeSessions.value = data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch Claude Code sessions'
      console.error('Error fetching Claude Code sessions:', err)
    } finally {
      loading.value = false
    }
  }

  async function resumeSession(sessionId: string, config: Record<string, any> = {}) {
    try {
      loading.value = true
      error.value = null
      
      const response = await fetch(`http://127.0.0.1:5050/api/claude-code/sessions/${sessionId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data.instance_id
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to resume session'
      console.error('Error resuming session:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  // Utility functions
  function clearError() {
    error.value = null
  }

  function setDetectedInstances(instances: ClaudeCodeInstance[]) {
    // Clear existing instances and add detected ones
    claudeCodeInstances.value.clear()
    instances.forEach((instance: ClaudeCodeInstance) => {
      claudeCodeInstances.value.set(instance.instance_id, instance)
    })
  }

  function clearAllData() {
    toolCalls.value.clear()
    fileNodes.value.clear()
    executionNodes.value.clear()
    claudeCodeInstances.value.clear()
    claudeCodeSessions.value = []
  }

  return {
    // State
    toolCalls,
    fileNodes,
    executionNodes,
    claudeCodeInstances,
    claudeCodeSessions,
    loading,
    error,
    
    // Computed
    getToolCallsForNode,
    getFileNodesForNode,
    getExecutionNodesForNode,
    getActiveInstances,
    getAllInstances,
    getTotalCost,
    
    // Actions
    fetchToolCallsForNode,
    fetchFileNodesForNode,
    fetchExecutionNodesForNode,
    fetchAllForNode,
    terminateExecution,
    createClaudeCodeInstance,
    fetchClaudeCodeInstances,
    getClaudeCodeInstanceStatus,
    sendMessageToInstance,
    pauseInstance,
    resumeInstance,
    stopInstance,
    fetchClaudeCodeSessions,
    resumeSession,
    setDetectedInstances,
    clearError,
    clearAllData
  }
})