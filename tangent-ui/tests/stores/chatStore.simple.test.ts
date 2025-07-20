import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '@/stores/chatStore'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('chatStore - Core Functionality', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetch.mockClear()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useChatStore()
      
      expect(store.currentChatId).toBe(null)
      expect(store.chats).toEqual([])
      expect(store.isLoading).toBe(false)
      expect(store.error).toBe(null)
    })
  })

  describe('loadChats', () => {
    it('should load chats successfully', async () => {
      const mockChats = [
        { id: 'chat-1', title: 'Test Chat 1', status: 'active', nodeCount: 1, createdAt: '2024-01-01', lastModified: '2024-01-01', updatedAt: '2024-01-01' }
      ]
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ chats: mockChats })
      })
      
      const store = useChatStore()
      await store.loadChats()
      
      expect(store.isLoading).toBe(false)
      expect(store.error).toBe(null)
      expect(store.chats).toEqual(mockChats)
    })

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })
      
      const store = useChatStore()
      await store.loadChats()
      
      expect(store.error).toBe('Failed to load chats: 500 Internal Server Error')
      expect(store.isLoading).toBe(false)
    })

    it('should prevent multiple simultaneous loads', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ chats: [] })
      })
      
      const store = useChatStore()
      
      const promise1 = store.loadChats()
      const promise2 = store.loadChats()
      
      await Promise.all([promise1, promise2])
      
      // Should only make one API call due to loading guard
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('createChat', () => {
    it('should create a new chat successfully', async () => {
      const mockChatId = 'new-chat-123'
      
      // Mock both the create and the reload calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ chatId: mockChatId })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ chats: [] })
        })
      
      const store = useChatStore()
      const result = await store.createChat('New Test Chat')
      
      expect(result).toBe(mockChatId)
      expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:5050/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Test Chat',
          initialNode: {
            title: 'Root Thread',
            x: 100,
            y: 100,
            messages: [],
            metadata: {}
          }
        })
      })
    })

    it('should handle create chat errors', async () => {
      // Clear any previous mocks
      mockFetch.mockReset()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Bad Request'
      })
      
      const store = useChatStore()
      const result = await store.createChat('Failed Chat')
      
      expect(result).toBe(null)
      expect(store.error).toBe('Failed to create chat: 400 Bad Request')
    })
  })

  describe('createTemplateChat', () => {
    it('should create a template chat locally', async () => {
      const store = useChatStore()
      
      const templateChat = await store.createTemplateChat()
      
      expect(templateChat).toMatchObject({
        title: 'New Chat',
        nodeCount: 0,
        isTemplate: true,
        status: 'active'
      })
      expect(templateChat.id).toMatch(/^template-/)
      expect(store.chats[0]).toBe(templateChat)
    })
  })

  describe('Computed Properties', () => {
    it('should return current chat when ID is set', async () => {
      const mockChats = [
        { id: 'chat-1', title: 'Test Chat 1', status: 'active', nodeCount: 1, createdAt: '2024-01-01', lastModified: '2024-01-01', updatedAt: '2024-01-01' }
      ]
      
      // Clear any previous mocks
      mockFetch.mockReset()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ chats: mockChats })
      })
      
      const store = useChatStore()
      await store.loadChats()
      store.currentChatId = 'chat-1'
      
      expect(store.currentChat).toEqual(mockChats[0])
    })

    it('should return undefined when no current chat', () => {
      const store = useChatStore()
      
      expect(store.currentChat).toBeUndefined()
    })
  })

  describe('Node Operations', () => {
    it('should add node successfully', async () => {
      const mockNodeId = 'node-123'
      
      // Clear any previous mocks
      mockFetch.mockReset()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodeId: mockNodeId })
      })
      
      const store = useChatStore()
      const nodeData = {
        title: 'New Node',
        x: 300,
        y: 300,
        messages: [],
        metadata: {}
      }
      
      const result = await store.addNode('chat-1', nodeData)
      
      expect(result).toBe(mockNodeId)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:5050/chats/chat-1/nodes',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nodeData)
        }
      )
    })

    it('should handle add node errors', async () => {
      // Clear any previous mocks
      mockFetch.mockReset()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request'
      })
      
      const store = useChatStore()
      const result = await store.addNode('chat-1', {})
      
      expect(result).toBe(null)
    })
  })
})