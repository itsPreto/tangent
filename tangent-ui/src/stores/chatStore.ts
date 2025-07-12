import { defineStore } from 'pinia';
import { ref, computed, shallowRef, triggerRef } from 'vue';
import type { ChatSummary } from '@/types/chat';

export const useChatStore = defineStore('chat', () => {
    const currentChatId = ref<string | null>(null);
    // Use shallowRef for large arrays to avoid deep reactivity overhead
    const chats = shallowRef<ChatSummary[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    // Load chat list
    const loadChats = async () => {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await fetch('http://127.0.0.1:5050/chats');
            if (!response.ok) { // Check for HTTP errors
                throw new Error(`Failed to load chats: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            chats.value = data.chats;
            triggerRef(chats); // Manually trigger reactivity for shallowRef
            
            // Log memory usage info for debugging
            console.log(`[ChatStore] Loaded ${data.chats.length} chats`);
            if (typeof performance !== 'undefined' && performance.memory) {
                const memMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                console.log(`[ChatStore] Memory usage: ${memMB}MB`);
            }
        } catch (e: any) { // using any to avoid TS type issues with generic errors
            error.value = e.message || 'Failed to load chats';  // Store a user-friendly error
            console.error(e);
        } finally {
            isLoading.value = false;
        }
    };
    // Create new chat
    const createChat = async (title: string, initialNode: any = null) => {
        console.log('[ChatStore] Starting createChat with:', { title, initialNode });
        isLoading.value = true;
        error.value = null;
        try {
            // If no initialNode provided, create a default one
            const nodeData = initialNode || {
                title: 'Root Thread',
                x: 100,
                y: 100,
                messages: [],
                metadata: {}
            };
            
            const requestBody = { title, initialNode: nodeData };
            console.log('[ChatStore] Request body:', JSON.stringify(requestBody, null, 2));
            
            const response = await fetch('http://127.0.0.1:5050/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            console.log('[ChatStore] Response status:', response.status, response.statusText);
            
            if (!response.ok) { // Check for HTTP errors here too
                const errorText = await response.text();
                console.error('[ChatStore] Error response:', errorText);
                throw new Error(`Failed to create chat: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            console.log('[ChatStore] Success response:', data);
            
            await loadChats();
   
            return data.chatId; // Return the ID.
        } catch (e: any) {
            error.value = e.message || 'Failed to create chat'; // Store user friendly error
            console.error('[ChatStore] Error in createChat:', e);
            return null;
        } finally {
            isLoading.value = false;
        }
    }
    const updateChatMetadata = async (chatId: string, metadata: Partial<ChatSummary>) => {
        try {
            const response = await fetch(`http://127.0.0.1:5050/chats/${chatId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(metadata)
            });

            if (!response.ok) {
                throw new Error('Failed to update chat metadata');
            }

            // Update local state immediately
            const chatIndex = chats.value.findIndex(chat => chat.id === chatId);
            if (chatIndex !== -1) {
                chats.value[chatIndex] = {
                    ...chats.value[chatIndex],
                    ...metadata,
                    isFavorite: metadata.isFavorite ?? chats.value[chatIndex].isFavorite
                };
                triggerRef(chats); // Manually trigger reactivity for shallowRef
            }

            // Reload chats to ensure consistency
            await loadChats();
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    };
    // Load specific chat
    const loadChat = async (chatId: string) => {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await fetch(`http://127.0.0.1:5050/chats/${chatId}`);
            const data = await response.json();
            currentChatId.value = chatId;
            return data;
        } catch (e) {
            error.value = 'Failed to load chat';
            console.error(e);
            return null;
        } finally {
            isLoading.value = false;
        }
    };

    // Delete chat
    const deleteChat = async (chatId: string) => {
        isLoading.value = true;
        error.value = null;
        try {
            await fetch(`http://127.0.0.1:5050/chats/${chatId}`, { method: 'DELETE' });
            if (currentChatId.value === chatId) {
                currentChatId.value = null;
            }
            await loadChats();
            return true;
        } catch (e) {
            error.value = 'Failed to delete chat';
            console.error(e);
            return false;
        } finally {
            isLoading.value = false;
        }
    };

    // Add node
    const addNode = async (chatId: string, nodeData: any) => {
        try {
            console.log('[ChatStore] Adding node:', nodeData);
            const response = await fetch(`http://127.0.0.1:5050/chats/${chatId}/nodes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nodeData)
            });
            
            console.log('[ChatStore] Add node response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[ChatStore] Add node error:', errorText);
                throw new Error(`Failed to add node: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('[ChatStore] Add node response data:', data);
            return data.nodeId;
        } catch (e) {
            console.error('[ChatStore] Error adding node:', e);
            return null;
        }
    };

    // Update node
    const updateNode = async (chatId: string, nodeId: string, data: any) => {
        try {
            await fetch(`http://127.0.0.1:5050/chats/${chatId}/nodes/${nodeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    // Remove node
    const removeNode = async (chatId: string, nodeId: string) => {
        try {
            await fetch(`http://127.0.0.1:5050/chats/${chatId}/nodes/${nodeId}`, {
                method: 'DELETE'
            });
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    // Auto-save functionality
    let saveTimeout: number | null = null;
    const autoSave = async (chatId: string, nodeId: string, data: any) => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }

        saveTimeout = window.setTimeout(async () => {
            await updateNode(chatId, nodeId, data);
        }, 2000); // Debounced save after 2 seconds of no changes
    };

    // Computed properties
    const currentChat = computed(() =>
        chats.value.find(chat => chat.id === currentChatId.value)
    );

    // Clean up orphaned nodes in a chat
    const cleanupOrphanedNodes = async (chatId: string) => {
        try {
            const response = await fetch(`http://127.0.0.1:5050/chats/${chatId}/cleanup-orphaned-nodes`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error('Failed to cleanup orphaned nodes');
            }
            
            const data = await response.json();
            console.log(`[ChatStore] Cleaned up ${data.cleaned_nodes} orphaned nodes`);
            return data;
        } catch (e) {
            console.error('Error cleaning orphaned nodes:', e);
            return null;
        }
    };
    
    // Check node integrity for a chat
    const checkNodeIntegrity = async (chatId: string) => {
        try {
            const response = await fetch(`http://127.0.0.1:5050/chats/${chatId}/integrity-check`);
            
            if (!response.ok) {
                throw new Error('Failed to check node integrity');
            }
            
            const data = await response.json();
            console.log('[ChatStore] Node integrity check:', data);
            return data;
        } catch (e) {
            console.error('Error checking node integrity:', e);
            return null;
        }
    };

    // Recent workspaces computed property
    const recentWorkspaces = computed(() => {
        return chats.value
            .filter(chat => chat.status !== 'archived')
            .sort((a, b) => new Date(b.lastModified || b.createdAt).getTime() - new Date(a.lastModified || a.createdAt).getTime())
            .slice(0, 6);
    });

    return {
        currentChatId,
        chats,
        isLoading,
        error,
        currentChat,
        recentWorkspaces,
        loadChats,
        createChat,
        loadChat,
        deleteChat,
        addNode,
        updateNode,
        removeNode,
        autoSave,
        updateChatMetadata,
        cleanupOrphanedNodes,
        checkNodeIntegrity
    };
});