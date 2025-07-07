import json
import uuid
import time
import logging
import threading
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
import pandas as pd
from ChatPersistenceService import ChatPersistenceService, Chat, Node, NodeEmbedding
from ChatgptChatProcessor import ChatGPTDataProcessor
from EmbeddingService import EmbeddingService
import hashlib

class ConversationImportService:
    def __init__(self, persistence_service: ChatPersistenceService, embedding_service: EmbeddingService = None):
        """
        Initialize the conversation import service
        """
        self.logger = logging.getLogger(__name__)
        self.persistence_service = persistence_service
        self.app = persistence_service.app  # Store reference to Flask app
        self.embedding_service = embedding_service or EmbeddingService()
        self.import_status = {
            'is_running': False,
            'progress': 0.0,
            'status_message': '',
            'total_conversations': 0,
            'processed_conversations': 0,
            'imported_conversations': 0,
            'skipped_conversations': 0,
            'errors': [],
            'current_conversation': '',
            'embedding_progress': 0.0,
            'clustering_progress': 0.0,
            'phase': 'import'  # 'import', 'embedding', 'clustering', 'complete'
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
                        chat_id = self._import_chatgpt_conversation(conversation)
                    elif import_format == 'claude':
                        chat_id = self._import_claude_conversation(conversation)
                    
                    self.import_status['imported_conversations'] += 1
                    
                    # Stream: Generate embeddings and cluster immediately after each conversation
                    if chat_id:
                        self._process_conversation_incrementally(chat_id)
                    
                except Exception as e:
                    error_msg = f"Error processing conversation '{title}': {str(e)}"
                    self.logger.error(error_msg)
                    self.import_status['errors'].append(error_msg)
                    
                # Small delay to prevent overwhelming the system
                time.sleep(0.01)
            
            # Complete initial import phase
            self.import_status['progress'] = 100.0
            self.import_status['processed_conversations'] = len(data)
            self.import_status['status_message'] = f'Import complete: {self.import_status["imported_conversations"]} imported, {self.import_status["skipped_conversations"]} skipped'
            
            self.logger.info(f"Import completed: {self.import_status['imported_conversations']} imported, {self.import_status['skipped_conversations']} skipped")
            
            # Incremental processing is now done per-conversation above
            # Final cleanup and completion
            
            # Complete the entire process
            self._complete_import_process()
            
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
    
    def _import_chatgpt_conversation(self, conversation: Dict) -> str:
        """
        Import a ChatGPT conversation with branching support
        Returns the chat_id of the created conversation
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
        
        return chat_id
    
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
        
        # Find meaningful branching points and endpoints to create nodes
        significant_nodes = self._find_chatgpt_significant_nodes(mapping)
        
        # Process significant nodes only
        for i, node_id in enumerate(significant_nodes):
            x_pos = 100 + (i % 3) * 250  # Arrange in grid
            y_pos = 100 + (i // 3) * 200
            
            # Determine parent based on conversation path
            parent_workspace_id = self._find_parent_workspace_node(mapping, node_id, node_map)
            
            self._create_chatgpt_workspace_node(
                chat_id, mapping, node_id, parent_workspace_id, node_map, x_pos, y_pos
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
        
        # Build conversation thread up to this point
        conversation_thread = self._build_chatgpt_conversation_thread(mapping, node_id)
        
        if not conversation_thread:
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
                messages=conversation_thread,
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
    
    def _build_chatgpt_conversation_thread(self, mapping: Dict, end_node_id: str) -> List[Dict]:
        """
        Build the complete conversation thread from root to the specified node
        """
        # Trace back to root to build conversation path
        path = []
        current_id = end_node_id
        
        while current_id and current_id != 'client-created-root':
            node_data = mapping.get(current_id)
            if not node_data:
                break
                
            message_data = node_data.get('message')
            if message_data:
                path.append((current_id, message_data))
            
            current_id = node_data.get('parent')
        
        # Reverse path to get chronological order
        path.reverse()
        
        # Convert each message in the path to workspace format
        conversation_thread = []
        for node_id, message_data in path:
            workspace_message = self._convert_chatgpt_message_to_workspace(message_data)
            if workspace_message:
                conversation_thread.extend(workspace_message)
        
        return conversation_thread
    
    def _find_chatgpt_significant_nodes(self, mapping: Dict) -> List[str]:
        """
        Find significant nodes in ChatGPT conversation (branching points and endpoints)
        """
        significant_nodes = []
        
        # Find nodes that have multiple children (branching points)
        for node_id, node_data in mapping.items():
            children = node_data.get('children', [])
            message_data = node_data.get('message')
            
            if not message_data:
                continue
            
            # Include if it's a branching point (multiple children)
            if len(children) > 1:
                significant_nodes.append(node_id)
            
            # Include if it's an endpoint (no children)
            elif len(children) == 0:
                significant_nodes.append(node_id)
        
        # Always include at least one node (the longest conversation thread)
        if not significant_nodes:
            # Find the node with the longest path from root
            longest_path = 0
            longest_node = None
            
            for node_id, node_data in mapping.items():
                if node_data.get('message'):
                    path_length = self._get_chatgpt_path_length(mapping, node_id)
                    if path_length > longest_path:
                        longest_path = path_length
                        longest_node = node_id
            
            if longest_node:
                significant_nodes.append(longest_node)
        
        return significant_nodes
    
    def _get_chatgpt_path_length(self, mapping: Dict, node_id: str) -> int:
        """Get the path length from root to this node"""
        length = 0
        current_id = node_id
        
        while current_id and current_id != 'client-created-root':
            node_data = mapping.get(current_id)
            if not node_data:
                break
            length += 1
            current_id = node_data.get('parent')
        
        return length
    
    def _find_parent_workspace_node(self, mapping: Dict, node_id: str, node_map: Dict) -> Optional[str]:
        """Find the appropriate parent workspace node for this ChatGPT node"""
        # For now, make all nodes children of the main thread
        # This could be improved to create a more sophisticated branching structure
        return None
    
    def _create_chatgpt_workspace_node(self, chat_id: str, mapping: Dict, node_id: str, 
                                     parent_node_id: Optional[str], node_map: Dict, 
                                     x: float, y: float):
        """Create a single workspace node for a ChatGPT conversation thread"""
        node_data = mapping.get(node_id)
        if not node_data:
            return
        
        message_data = node_data.get('message')
        if not message_data:
            return
        
        # Build conversation thread up to this point
        conversation_thread = self._build_chatgpt_conversation_thread(mapping, node_id)
        
        if not conversation_thread:
            return
        
        # Create meaningful node title
        message_count = len(conversation_thread)
        last_message = conversation_thread[-1] if conversation_thread else {}
        last_role = last_message.get('role', 'unknown')
        
        if message_count <= 2:
            node_title = f"Quick Chat ({message_count} messages)"
        else:
            node_title = f"Conversation Thread ({message_count} messages)"
        
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
                messages=conversation_thread,
                node_metadata={'original_id': node_id, 'format': 'chatgpt', 'message_count': message_count}
            )
            
            db.session.add(node)
            db.session.commit()
            
            node_map[node_id] = node.id
    
    def _import_claude_conversation(self, conversation: Dict) -> str:
        """
        Import a Claude conversation (linear structure)
        Returns the chat_id of the created conversation
        """
        title = conversation.get('name', 'Untitled Conversation')
        conv_uuid = conversation.get('uuid', str(uuid.uuid4()))
        
        # Extract messages
        chat_messages = conversation.get('chat_messages', [])
        
        if not chat_messages:
            return None
        
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
            
            return chat_id
    
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
    
    def _generate_embeddings_for_nodes(self, chat_ids: List[str]):
        """
        Generate embeddings for all nodes in the specified chats
        """
        try:
            self.import_status['phase'] = 'embedding'
            self.import_status['status_message'] = 'Generating embeddings...'
            
            with self.app.app_context():
                from ChatPersistenceService import db
                
                # Get all nodes for the imported chats
                nodes = db.session.query(Node).filter(Node.chat_id.in_(chat_ids)).all()
                total_nodes = len(nodes)
                
                if total_nodes == 0:
                    return
                
                self.logger.info(f"Generating embeddings for {total_nodes} nodes")
                
                processed_count = 0
                batch_size = 10  # Process in batches to avoid memory issues
                
                for i in range(0, total_nodes, batch_size):
                    if not self.import_status['is_running']:
                        break
                        
                    batch = nodes[i:i + batch_size]
                    batch_texts = []
                    batch_nodes = []
                    
                    for node in batch:
                        content = self._extract_node_content(node)
                        if content:
                            batch_texts.append(content)
                            batch_nodes.append(node)
                    
                    if batch_texts:
                        try:
                            # Generate embeddings for batch
                            embeddings = self.embedding_service.generate_embeddings(batch_texts)
                            
                            # Store embeddings
                            for j, node in enumerate(batch_nodes):
                                content = batch_texts[j]
                                content_hash = hashlib.sha256(content.encode()).hexdigest()
                                
                                # Check if embedding already exists
                                existing = db.session.query(NodeEmbedding).filter_by(
                                    node_id=node.id,
                                    content_hash=content_hash,
                                    embedding_model=self.embedding_service.model_name
                                ).first()
                                
                                if not existing:
                                    embedding = NodeEmbedding(
                                        node_id=node.id,
                                        embedding=embeddings[j].tolist(),
                                        embedding_model=self.embedding_service.model_name,
                                        content_hash=content_hash
                                    )
                                    db.session.add(embedding)
                            
                            db.session.commit()
                            
                        except Exception as e:
                            self.logger.error(f"Error generating embeddings for batch: {e}")
                            continue
                    
                    processed_count += len(batch)
                    self.import_status['embedding_progress'] = (processed_count / total_nodes) * 100
                    self.import_status['status_message'] = f'Generated embeddings for {processed_count}/{total_nodes} nodes'
                
                self.logger.info(f"Completed embedding generation for {processed_count} nodes")
                
        except Exception as e:
            self.logger.error(f"Error in embedding generation: {e}")
            self.import_status['errors'].append(f"Embedding generation failed: {str(e)}")
    
    def _extract_node_content(self, node: Node) -> str:
        """
        Extract text content from a node for embedding generation
        """
        if not node.messages:
            return ""
        
        content_parts = []
        
        # Add title if available
        if node.title:
            content_parts.append(f"Title: {node.title}")
        
        # Extract text from messages
        for message in node.messages:
            if isinstance(message, dict):
                role = message.get('role', 'unknown')
                content = message.get('content', '')
                
                if content:
                    content_parts.append(f"{role}: {content}")
        
        return "\n".join(content_parts)
    
    def _start_clustering_process(self, chat_ids: List[str]):
        """
        Start clustering process for the imported chats
        """
        try:
            self.import_status['phase'] = 'clustering'
            self.import_status['status_message'] = 'Starting clustering...'
            
            # Import clustering service here to avoid circular imports
            from ClusteringService import ClusteringService
            
            clustering_service = ClusteringService()
            
            # Start clustering with default parameters
            clustering_params = {
                'minClusterSize': 3,
                'maxClusters': 10,
                'enableVisualization': True,
                'chat_ids': chat_ids  # Only cluster the newly imported chats
            }
            
            # This will run clustering in the background
            clustering_service.start_clustering(clustering_params)
            
            self.import_status['clustering_progress'] = 100.0
            self.import_status['status_message'] = 'Clustering started'
            
        except Exception as e:
            self.logger.error(f"Error starting clustering: {e}")
            self.import_status['errors'].append(f"Clustering failed: {str(e)}")
    
    def _complete_import_process(self):
        """
        Complete the import process
        """
        self.import_status['phase'] = 'complete'
        self.import_status['progress'] = 100.0
        self.import_status['embedding_progress'] = 100.0
        self.import_status['clustering_progress'] = 100.0
        self.import_status['is_running'] = False
        self.import_status['status_message'] = f'Import completed: {self.import_status["imported_conversations"]} conversations imported'
        
        self.logger.info(f"Import process completed successfully")
    
    def _process_conversation_incrementally(self, chat_id: str):
        """
        Process a single conversation: generate embeddings and trigger incremental clustering
        """
        try:
            self.import_status['phase'] = 'embedding'
            self.import_status['status_message'] = f'Generating embeddings for conversation...'
            
            with self.app.app_context():
                from ChatPersistenceService import db
                
                # Get nodes for this specific chat
                nodes = db.session.query(Node).filter(Node.chat_id == chat_id).all()
                
                for node in nodes:
                    content = self._extract_node_content(node)
                    if content:
                        content_hash = hashlib.sha256(content.encode()).hexdigest()
                        
                        # Check if embedding already exists
                        existing = db.session.query(NodeEmbedding).filter_by(
                            node_id=node.id,
                            content_hash=content_hash,
                            embedding_model=self.embedding_service.model_name
                        ).first()
                        
                        if not existing:
                            # Generate embedding for this node
                            embeddings = self.embedding_service.generate_embeddings([content])
                            
                            embedding = NodeEmbedding(
                                node_id=node.id,
                                embedding=embeddings[0].tolist(),
                                embedding_model=self.embedding_service.model_name,
                                content_hash=content_hash
                            )
                            db.session.add(embedding)
                
                db.session.commit()
                
                # Trigger incremental clustering with all available data
                self._trigger_incremental_clustering()
                
        except Exception as e:
            self.logger.error(f"Error in incremental processing: {e}")
            self.import_status['errors'].append(f"Incremental processing failed: {str(e)}")
    
    def _trigger_incremental_clustering(self):
        """
        Trigger clustering with all currently available embeddings
        """
        try:
            self.import_status['phase'] = 'clustering'
            self.import_status['status_message'] = 'Updating clusters...'
            
            # Import clustering service here to avoid circular imports
            from ClusteringService import ClusteringService
            
            clustering_service = ClusteringService(self.embedding_service, self.persistence_service)
            
            # Get all chats with embeddings for incremental clustering
            with self.app.app_context():
                from ChatPersistenceService import db
                
                # Get all chats that have embeddings
                chats_with_embeddings = db.session.query(Chat).join(
                    Node, Chat.id == Node.chat_id
                ).join(
                    NodeEmbedding, Node.id == NodeEmbedding.node_id
                ).distinct().all()
                
                if len(chats_with_embeddings) >= 1:  # Cluster even with just 1 conversation
                    chat_ids = [chat.id for chat in chats_with_embeddings]
                    
                    # Use the new incremental clustering method
                    clustering_service.cluster_incrementally(chat_ids)
                    
                    self.import_status['clustering_progress'] = 100.0
                    self.import_status['status_message'] = f'Updated clusters ({len(chats_with_embeddings)} conversations)'
                
        except Exception as e:
            self.logger.error(f"Error in incremental clustering: {e}")
            self.import_status['errors'].append(f"Incremental clustering failed: {str(e)}")
    
    def _get_imported_chat_ids(self) -> List[str]:
        """
        Get list of chat IDs that were imported in this session
        """
        # For now, we'll get all chats. In a more sophisticated implementation,
        # we could track the specific chats imported in this session
        try:
            with self.app.app_context():
                from ChatPersistenceService import db
                
                chats = db.session.query(Chat).all()
                return [chat.id for chat in chats]
        except Exception as e:
            self.logger.error(f"Error getting imported chat IDs: {e}")
            return []