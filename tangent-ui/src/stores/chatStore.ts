import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ChatSummary } from '@/types/chat';

export const useChatStore = defineStore('chat', () => {
    const currentChatId = ref<string | null>(null);
    const chats = ref<ChatSummary[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    // Load chat list
    const loadChats = async () => {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await fetch('http://127.0.0.1:5000/chats');
            if (!response.ok) { // Check for HTTP errors
                throw new Error(`Failed to load chats: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            chats.value = data.chats;
        } catch (e: any) { // using any to avoid TS type issues with generic errors
            error.value = e.message || 'Failed to load chats';  // Store a user-friendly error
            console.error(e);
        } finally {
            isLoading.value = false;
        }
    };
    // Create new chat
    const createChat = async (title: string, initialNode: any) => {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await fetch('http://127.0.0.1:5000/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, initialNode })
            });
            if (!response.ok) { // Check for HTTP errors here too
                throw new Error(`Failed to create chat: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            await loadChats();
   
            return data.chatId; // Return the ID.
        } catch (e: any) {
            error.value = e.message || 'Failed to create chat'; // Store user friendly error
            console.error(e);
            return null;
        } finally {
            isLoading.value = false;
        }
    }
    const updateChatMetadata = async (chatId: string, metadata: Partial<ChatSummary>) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/chats/${chatId}`, {
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
            const response = await fetch(`http://127.0.0.1:5000/chats/${chatId}`);
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
            await fetch(`http://127.0.0.1:5000/chats/${chatId}`, { method: 'DELETE' });
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
            const response = await fetch(`http://127.0.0.1:5000/chats/${chatId}/nodes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nodeData)
            });
            const data = await response.json();
            return data.nodeId;
        } catch (e) {
            console.error(e);
            return null;
        }
    };

    // Update node
    const updateNode = async (chatId: string, nodeId: string, data: any) => {
        try {
            await fetch(`http://127.0.0.1:5000/chats/${chatId}/nodes/${nodeId}`, {
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
            await fetch(`http://127.0.0.1:5000/chats/${chatId}/nodes/${nodeId}`, {
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

    return {
        currentChatId,
        chats,
        isLoading,
        error,
        currentChat,
        loadChats,
        createChat,
        loadChat,
        deleteChat,
        addNode,
        updateNode,
        removeNode,
        autoSave,
        updateChatMetadata
    };
});