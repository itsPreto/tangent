import React, { useEffect, useState } from 'react';
import { Button } from '../core/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '../core/dialog';
import { ScrollArea } from '../core/scroll-area';
import { Input } from '../core/input';
import { Save, Trash2, FolderOpen } from 'lucide-react';
import axios from 'axios';

export const ChatPersistenceManager = ({
  nodes,
  onLoadChat,
  activeChat,
  setActiveChat
}) => {
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);
  const [savedChats, setSavedChats] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadSavedChats = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/chats/list');
      if (response.data.success) {
        setSavedChats(response.data.chats);
      }
    } catch (error) {
      console.error('Error loading saved chats:', error);
    }
  };

  useEffect(() => {
    loadSavedChats();
  }, []);

  const handleSave = async () => {
    if (!nodes.length) return;

    setIsLoading(true);
    try {
      const chatData = {
        chatId: activeChat?.id || undefined,
        nodes,
        title: activeChat?.title || 'Untitled Chat',
        metadata: {
          nodeCount: nodes.length,
          messageCount: nodes.reduce((acc, node) => acc + node.messages.length, 0)
        }
      };

      const response = await axios.post('http://localhost:5001/api/chats/save', chatData);
      if (response.data.success) {
        setActiveChat({
          id: response.data.chatId,
          title: chatData.title
        });
        await loadSavedChats();
      }
    } catch (error) {
      console.error('Error saving chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoad = async (chatId) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`http://localhost:5001/api/chats/load/${chatId}`);
      if (response.data.success) {
        const chatData = response.data.data;
        onLoadChat(chatData.nodes);
        setActiveChat({
          id: chatData.id,
          title: chatData.title
        });
        setShowLoadDialog(false);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (chatId) => {
    try {
      const response = await axios.delete(`http://localhost:5001/api/chats/delete/${chatId}`);
      if (response.data.success) {
        await loadSavedChats();
        if (activeChat?.id === chatId) {
          setActiveChat(null);
        }
        setShowDeleteDialog(false);
        setChatToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const initiateDelete = (chat, e) => {
    e.stopPropagation();
    setChatToDelete(chat);
    setShowDeleteDialog(true);
  };

  const filteredChats = savedChats.filter(chat =>
    chat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleSave}
          disabled={isLoading || !nodes.length}
          className="h-9 w-9"
        >
          <Save className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowLoadDialog(true)}
          disabled={isLoading}
          className="h-9 w-9"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>

      {/* Load Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load Chat</DialogTitle>
            <DialogDescription>
              Select a chat to load from your saved conversations
            </DialogDescription>
          </DialogHeader>

          <Input
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />

          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                  onClick={() => handleLoad(chat.id)}
                >
                  <div>
                    <h3 className="font-medium">{chat.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(chat.lastModified).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => initiateDelete(chat, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{chatToDelete?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Delete Chat</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete "{chatToDelete?.title}"? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 justify-end mt-4">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={() => chatToDelete && handleDelete(chatToDelete.id)}
                >
                  Delete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChatPersistenceManager;