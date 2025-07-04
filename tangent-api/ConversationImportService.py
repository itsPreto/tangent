import json
import uuid
import time
import logging
import threading
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
import pandas as pd
from ChatPersistenceService import ChatPersistenceService, Chat, Node
from ChatgptChatProcessor import ChatGPTDataProcessor

class ConversationImportService:
    def __init__(self, persistence_service: ChatPersistenceService):
        """
        Initialize the conversation import service
        """
        self.logger = logging.getLogger(__name__)
        self.persistence_service = persistence_service
        self.app = persistence_service.app  # Store reference to Flask app
        self.import_status = {
            'is_running': False,
            'progress': 0.0,
            'status_message': '',
            'total_conversations': 0,
            'processed_conversations': 0,
            'imported_conversations': 0,
            'skipped_conversations': 0,
            'errors': [],
            'current_conversation': ''
        }
        self.import_thread = None
        self.chatgpt_processor = ChatGPTDataProcessor()
        
    def start_import(self, file_data: bytes, filename: str) -> Dict[str, Any]:
        """
        Start the conversation import process
        """
        if self.import_status['is_running']:
            return {'error': 'Import already in progress'}
            
        try:
            # Parse the JSON data
            data = json.loads(file_data.decode('utf-8'))
            
            # Detect format based on structure
            import_format = self._detect_format(data)
            
            if import_format == 'unknown':
                return {'error': 'Unsupported conversation format'}
            
            # Reset status
            self.import_status = {
                'is_running': True,
                'progress': 0.0,
                'status_message': f'Starting import of {filename}...',
                'total_conversations': len(data) if isinstance(data, list) else 1,
                'processed_conversations': 0,
                'imported_conversations': 0,
                'skipped_conversations': 0,
                'errors': [],
                'current_conversation': '',
                'format': import_format,
                'filename': filename
            }
            
            # Start import thread
            self.import_thread = threading.Thread(
                target=self._run_import,
                args=(data, import_format),
                daemon=True
            )
            self.import_thread.start()
            
            return {'status': 'started', 'format': import_format}
            
        except json.JSONDecodeError as e:
            return {'error': f'Invalid JSON format: {str(e)}'}
        except Exception as e:
            self.logger.error(f"Error starting import: {str(e)}")
            return {'error': f'Failed to start import: {str(e)}'}
    
    def _detect_format(self, data: Any) -> str:
        """
        Detect conversation format based on data structure
        """
        if not isinstance(data, list):
            return 'unknown'
            
        if len(data) == 0:
            return 'unknown'
            
        sample = data[0]
        
        # Check for ChatGPT format
        if isinstance(sample, dict) and 'mapping' in sample and 'conversation_id' in sample:
            return 'chatgpt'
            
        # Check for Claude format
        if isinstance(sample, dict) and 'chat_messages' in sample and 'uuid' in sample:
            return 'claude'
            
        return 'unknown'
    
    def _run_import(self, data: List[Dict], import_format: str):
        """
        Run the import process in a separate thread
        """
        try:
            self.logger.info(f"Starting import of {len(data)} conversations in {import_format} format")
            
            for i, conversation in enumerate(data):
                if not self.import_status['is_running']:
                    break
                    
                try:
                    # Update progress
                    self.import_status['processed_conversations'] = i
                    self.import_status['progress'] = (i / len(data)) * 100
                    
                    # Get conversation title for status
                    title = self._get_conversation_title(conversation, import_format)
                    self.import_status['current_conversation'] = title
                    self.import_status['status_message'] = f'Processing: {title}'
                    
                    # Check if conversation already exists
                    if self._conversation_exists(conversation, import_format):
                        self.import_status['skipped_conversations'] += 1
                        continue
                    
                    # Convert and import conversation
                    if import_format == 'chatgpt':
                        self._import_chatgpt_conversation(conversation)
                    elif import_format == 'claude':
                        self._import_claude_conversation(conversation)
                    
                    self.import_status['imported_conversations'] += 1
                    
                except Exception as e:
                    error_msg = f"Error processing conversation '{title}': {str(e)}"
                    self.logger.error(error_msg)
                    self.import_status['errors'].append(error_msg)
                    
                # Small delay to prevent overwhelming the system
                time.sleep(0.01)
            
            # Complete
            self.import_status['progress'] = 100.0
            self.import_status['processed_conversations'] = len(data)
            self.import_status['status_message'] = f'Import complete: {self.import_status["imported_conversations"]} imported, {self.import_status["skipped_conversations"]} skipped'
            self.import_status['is_running'] = False
            
            self.logger.info(f"Import completed: {self.import_status['imported_conversations']} imported, {self.import_status['skipped_conversations']} skipped")
            
        except Exception as e:
            self.logger.error(f"Import failed: {str(e)}")
            self.import_status['status_message'] = f'Import failed: {str(e)}'
            self.import_status['is_running'] = False
    
    def _get_conversation_title(self, conversation: Dict, format_type: str) -> str:
        """
        Extract conversation title based on format
        """
        if format_type == 'chatgpt':
            return conversation.get('title', 'Untitled Chat')
        elif format_type == 'claude':
            return conversation.get('name', 'Untitled Conversation')
        return 'Unknown'
    
    def _conversation_exists(self, conversation: Dict, format_type: str) -> bool:
        """
        Check if conversation already exists in database
        """
        # For now, we'll check by title. In a real implementation,
        # you'd want to use conversation IDs or more sophisticated matching
        title = self._get_conversation_title(conversation, format_type)
        
        # Get existing chats
        with self.app.app_context():
            existing_chats = self.persistence_service.list_chats()
            existing_titles = [chat['title'] for chat in existing_chats]
        
        return title in existing_titles
    
    def _import_chatgpt_conversation(self, conversation: Dict):
        """
        Import a ChatGPT conversation with branching support
        """
        title = conversation.get('title', 'Untitled Chat')
        conv_id = conversation.get('conversation_id', str(uuid.uuid4()))
        
        # Use existing ChatGPT processor to extract messages
        messages = self.chatgpt_processor.process_chatgpt_messages([conversation])
        
        if not messages:
            return
        
        # Create the main chat
        with self.app.app_context():
            chat_id = self.persistence_service.create_chat(
                title=title,
                initial_node_data={
                    'title': 'Main Thread',
                    'x': 100,
                    'y': 100,
                    'messages': [],
                    'metadata': {'original_id': conv_id, 'format': 'chatgpt'}
                },
                import_metadata={
                    'format': 'chatgpt',
                    'original_id': conv_id
                }
            )
        
        # Process branching structure
        self._create_chatgpt_nodes(chat_id, conversation, messages)
    
    def _create_chatgpt_nodes(self, chat_id: str, conversation: Dict, messages: List[Dict]):
        """
        Create nodes for ChatGPT conversation with proper branching
        """
        mapping = conversation.get('mapping', {})
        
        # Build node hierarchy
        node_map = {}  # mapping node_id -> Node object
        root_nodes = []
        
        # Find root node (usually has no parent or parent is 'client-created-root')
        for node_id, node_data in mapping.items():
            parent_id = node_data.get('parent')
            if not parent_id or parent_id == 'client-created-root':
                root_nodes.append(node_id)
        
        # Process nodes in breadth-first order
        if root_nodes:
            self._process_chatgpt_node_recursive(
                chat_id, mapping, root_nodes[0], None, node_map, messages, x=100, y=100
            )
    
    def _process_chatgpt_node_recursive(self, chat_id: str, mapping: Dict, node_id: str, 
                                      parent_node_id: Optional[str], node_map: Dict, 
                                      messages: List[Dict], x: float, y: float):
        """
        Recursively process ChatGPT nodes and create corresponding workspace nodes
        """
        node_data = mapping.get(node_id)
        if not node_data:
            return
        
        message_data = node_data.get('message')
        if not message_data:
            # Process children of empty nodes
            children = node_data.get('children', [])
            for i, child_id in enumerate(children):
                child_x = x + (i * 300)  # Spread children horizontally
                self._process_chatgpt_node_recursive(
                    chat_id, mapping, child_id, parent_node_id, node_map, messages, child_x, y
                )
            return
        
        # Convert message to workspace format
        workspace_messages = self._convert_chatgpt_message_to_workspace(message_data)
        
        if not workspace_messages:
            return
        
        # Create node
        node_title = f"Branch from {message_data.get('author', {}).get('role', 'unknown')}"
        if parent_node_id:
            node_title = f"Branch {len(node_map) + 1}"
        
        # Create node using persistence service with Flask app context
        from ChatPersistenceService import Node, db
        
        with self.app.app_context():
            node = Node(
                id=str(uuid.uuid4()),
                chat_id=chat_id,
                parent_id=parent_node_id,
                type='branch' if parent_node_id else 'main',
                title=node_title,
                x=x,
                y=y,
                messages=workspace_messages,
                node_metadata={'original_id': node_id, 'format': 'chatgpt'}
            )
            
            db.session.add(node)
            db.session.commit()
        
        node_map[node_id] = node.id
        
        # Process children
        children = node_data.get('children', [])
        for i, child_id in enumerate(children):
            child_x = x + 200  # Move children to the right
            child_y = y + (i * 150)  # Spread children vertically
            self._process_chatgpt_node_recursive(
                chat_id, mapping, child_id, node.id, node_map, messages, child_x, child_y
            )
    
    def _convert_chatgpt_message_to_workspace(self, message_data: Dict) -> List[Dict]:
        """
        Convert ChatGPT message format to workspace message format
        """
        content = message_data.get("content", {})
        if isinstance(content, dict) and "parts" in content:
            text = " ".join(str(part) for part in content["parts"])
        else:
            text = str(content)
        
        if not text.strip():
            return []
        
        role = message_data.get("author", {}).get("role", "user")
        if role == "system":
            role = "assistant"  # Convert system messages to assistant
        
        # Convert timestamp
        created_at = message_data.get("create_time")
        timestamp = datetime.utcnow().isoformat()
        
        if created_at:
            try:
                if isinstance(created_at, (int, float)):
                    timestamp = pd.to_datetime(created_at, unit='s').isoformat()
                else:
                    timestamp = pd.to_datetime(created_at).isoformat()
            except:
                pass
        
        return [{
            'role': role,
            'content': text,
            'timestamp': timestamp
        }]
    
    def _import_claude_conversation(self, conversation: Dict):
        """
        Import a Claude conversation (linear structure)
        """
        title = conversation.get('name', 'Untitled Conversation')
        conv_uuid = conversation.get('uuid', str(uuid.uuid4()))
        
        # Extract messages
        chat_messages = conversation.get('chat_messages', [])
        
        if not chat_messages:
            return
        
        # Convert messages to workspace format
        workspace_messages = []
        for msg in chat_messages:
            workspace_msg = self._convert_claude_message_to_workspace(msg)
            if workspace_msg:
                workspace_messages.append(workspace_msg)
        
        # Create the chat with main node
        with self.app.app_context():
            chat_id = self.persistence_service.create_chat(
                title=title,
                initial_node_data={
                    'title': 'Main Thread',
                    'x': 100,
                    'y': 100,
                    'messages': workspace_messages,
                    'metadata': {'original_id': conv_uuid, 'format': 'claude'}
                },
                import_metadata={
                    'format': 'claude',
                    'original_id': conv_uuid
                }
            )
    
    def _convert_claude_message_to_workspace(self, message: Dict) -> Optional[Dict]:
        """
        Convert Claude message format to workspace message format
        """
        # Extract text content
        text = message.get('text', '')
        if not text and 'content' in message:
            content = message['content']
            if isinstance(content, list) and len(content) > 0:
                if isinstance(content[0], dict) and 'text' in content[0]:
                    text = content[0]['text']
        
        if not text.strip():
            return None
        
        # Convert role
        role = message.get('sender', 'user')
        if role == 'human':
            role = 'user'
        
        # Convert timestamp
        timestamp = message.get('created_at', datetime.utcnow().isoformat())
        
        return {
            'role': role,
            'content': text,
            'timestamp': timestamp
        }
    
    def get_import_status(self) -> Dict[str, Any]:
        """
        Get current import status
        """
        return self.import_status.copy()
    
    def stop_import(self) -> Dict[str, Any]:
        """
        Stop the current import process
        """
        if self.import_status['is_running']:
            self.import_status['is_running'] = False
            self.import_status['status_message'] = 'Import stopped by user'
            return {'status': 'stopped'}
        return {'status': 'not_running'}