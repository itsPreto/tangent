from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid
import json
from typing import Dict, List, Optional

db = SQLAlchemy()

class Chat(db.Model):
    __tablename__ = 'chats'
    id = db.Column(db.String(36), primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    nodes = db.relationship('Node', backref='chat', cascade='all, delete-orphan')
    x = db.Column(db.Float, nullable=True)
    y = db.Column(db.Float, nullable=True)
    # Import metadata - sticky labels for imported conversations
    import_format = db.Column(db.String(50), nullable=True)  # 'chatgpt', 'claude', etc.
    original_id = db.Column(db.String(255), nullable=True)  # Original conversation ID from source

class Node(db.Model):
    __tablename__ = 'nodes'
    id = db.Column(db.String(36), primary_key=True)
    chat_id = db.Column(db.String(36), db.ForeignKey('chats.id'), nullable=False)
    parent_id = db.Column(db.String(36), db.ForeignKey('nodes.id'), nullable=True)
    type = db.Column(db.String(50), nullable=False)  # 'main', 'branch', 'media', 'web'
    title = db.Column(db.String(255))
    x = db.Column(db.Float, nullable=False)
    y = db.Column(db.Float, nullable=False)
    branch_message_index = db.Column(db.Integer)
    messages = db.Column(db.JSON)
    node_metadata = db.Column(db.JSON)  # Renamed from metadata to avoid conflicts
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    children = db.relationship('Node', backref=db.backref('parent', remote_side=[id]), cascade='all, delete-orphan')

class NodeEmbedding(db.Model):
    __tablename__ = 'node_embeddings'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id = db.Column(db.String(36), db.ForeignKey('nodes.id'), nullable=False)
    embedding = db.Column(db.JSON, nullable=False)  # Store as JSON array
    embedding_model = db.Column(db.String(100), nullable=False)  # Track model used
    content_hash = db.Column(db.String(64), nullable=False)  # SHA256 of content for cache invalidation
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    node = db.relationship('Node', backref='embeddings')
    
    # Indexes for performance
    __table_args__ = (
        db.Index('idx_node_embeddings_node_id', 'node_id'),
        db.Index('idx_node_embeddings_model', 'embedding_model'),
        db.Index('idx_node_embeddings_hash', 'content_hash'),
    )

class ClusteringResult(db.Model):
    __tablename__ = 'clustering_results'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_ids = db.Column(db.JSON, nullable=False)  # List of chat IDs included in clustering
    clustering_params = db.Column(db.JSON, nullable=False)  # Parameters used for clustering
    clusters = db.Column(db.JSON, nullable=False)  # Cluster assignments and centroids
    embedding_model = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        db.Index('idx_clustering_results_model', 'embedding_model'),
        db.Index('idx_clustering_results_created', 'created_at'),
    )

class ToolCall(db.Model):
    __tablename__ = 'tool_calls'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id = db.Column(db.String(36), db.ForeignKey('nodes.id'), nullable=False)
    tool_name = db.Column(db.String(50), nullable=False)
    parameters = db.Column(db.JSON, nullable=True)
    result = db.Column(db.JSON, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='pending')  # 'pending', 'success', 'error'
    error_message = db.Column(db.Text, nullable=True)
    duration_ms = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    node = db.relationship('Node', backref='tool_calls')
    
    # Indexes
    __table_args__ = (
        db.Index('idx_tool_calls_node_id', 'node_id'),
        db.Index('idx_tool_calls_tool_name', 'tool_name'),
        db.Index('idx_tool_calls_status', 'status'),
        db.Index('idx_tool_calls_created', 'created_at'),
    )

class FileNode(db.Model):
    __tablename__ = 'file_nodes'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id = db.Column(db.String(36), db.ForeignKey('nodes.id'), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer, nullable=True)
    content_hash = db.Column(db.String(64), nullable=True)
    mime_type = db.Column(db.String(100), nullable=True)
    created_by = db.Column(db.String(36), db.ForeignKey('tool_calls.id'), nullable=True)
    modified_by = db.Column(db.String(36), db.ForeignKey('tool_calls.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    node = db.relationship('Node', backref='file_nodes')
    creator_tool_call = db.relationship('ToolCall', foreign_keys=[created_by], backref='created_files')
    modifier_tool_call = db.relationship('ToolCall', foreign_keys=[modified_by], backref='modified_files')
    
    # Indexes
    __table_args__ = (
        db.Index('idx_file_nodes_node_id', 'node_id'),
        db.Index('idx_file_nodes_file_path', 'file_path'),
        db.Index('idx_file_nodes_created_by', 'created_by'),
        db.Index('idx_file_nodes_modified_by', 'modified_by'),
    )

class ExecutionNode(db.Model):
    __tablename__ = 'execution_nodes'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id = db.Column(db.String(36), db.ForeignKey('nodes.id'), nullable=False)
    command = db.Column(db.Text, nullable=False)
    working_dir = db.Column(db.String(500), nullable=True)
    environment = db.Column(db.JSON, nullable=True)
    pid = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='pending')  # 'pending', 'running', 'completed', 'failed', 'killed'
    exit_code = db.Column(db.Integer, nullable=True)
    stdout = db.Column(db.Text, nullable=True)
    stderr = db.Column(db.Text, nullable=True)
    started_by = db.Column(db.String(36), db.ForeignKey('tool_calls.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    node = db.relationship('Node', backref='execution_nodes')
    starter_tool_call = db.relationship('ToolCall', foreign_keys=[started_by], backref='started_executions')
    
    # Indexes
    __table_args__ = (
        db.Index('idx_execution_nodes_node_id', 'node_id'),
        db.Index('idx_execution_nodes_status', 'status'),
        db.Index('idx_execution_nodes_pid', 'pid'),
        db.Index('idx_execution_nodes_started_by', 'started_by'),
    )

class ClaudeCodeSession(db.Model):
    """Enhanced Claude Code session management"""
    __tablename__ = 'claude_code_sessions'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    instance_id = db.Column(db.String(36), db.ForeignKey('claude_code_instances.id'), nullable=True)  # Reference to ClaudeCodeInstance if applicable
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_active = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    message_count = db.Column(db.Integer, default=0)
    total_cost = db.Column(db.Float, default=0.0)
    session_data = db.Column(db.JSON, nullable=True)  # JSON storage for session state
    working_dir = db.Column(db.String(500), nullable=True)
    status = db.Column(db.String(20), default='active')  # 'active', 'paused', 'completed', 'error'
    
    # Relationships
    conversations = db.relationship('ClaudeCodeConversation', backref='session', cascade='all, delete-orphan')
    
    # Indexes
    __table_args__ = (
        db.Index('idx_claude_code_sessions_instance_id', 'instance_id'),
        db.Index('idx_claude_code_sessions_status', 'status'),
        db.Index('idx_claude_code_sessions_created', 'created_at'),
        db.Index('idx_claude_code_sessions_last_active', 'last_active'),
    )

class ClaudeCodeConversation(db.Model):
    """Individual conversation turns within a Claude Code session"""
    __tablename__ = 'claude_code_conversations'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = db.Column(db.String(36), db.ForeignKey('claude_code_sessions.id'), nullable=False)
    turn_number = db.Column(db.Integer, nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    conversation_metadata = db.Column(db.JSON, nullable=True)  # Tool calls, costs, etc.
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        db.Index('idx_claude_code_conversations_session_id', 'session_id'),
        db.Index('idx_claude_code_conversations_turn', 'session_id', 'turn_number'),
        db.Index('idx_claude_code_conversations_role', 'role'),
        db.Index('idx_claude_code_conversations_timestamp', 'timestamp'),
    )

class ClaudeCodeInstance(db.Model):
    """Claude Code instance tracking for the service"""
    __tablename__ = 'claude_code_instances'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    instance_name = db.Column(db.String(100), nullable=False)
    config = db.Column(db.JSON, nullable=True)  # Instance configuration
    pid = db.Column(db.Integer, nullable=True)  # Process ID if running
    status = db.Column(db.String(20), default='stopped')  # 'running', 'stopped', 'error'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_heartbeat = db.Column(db.DateTime, nullable=True)
    working_dir = db.Column(db.String(500), nullable=True)
    
    # Relationships
    sessions = db.relationship('ClaudeCodeSession', backref='instance', cascade='all, delete-orphan')
    
    # Indexes
    __table_args__ = (
        db.Index('idx_claude_code_instances_status', 'status'),
        db.Index('idx_claude_code_instances_pid', 'pid'),
        db.Index('idx_claude_code_instances_heartbeat', 'last_heartbeat'),
    )

class ChatPersistenceService:
    def __init__(self, app):
        self.app = app  # Store reference to Flask app
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chats.db'
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        db.init_app(app)
        with app.app_context():
            db.create_all()
            # Note: Import columns will be added in future database migrations
            # For now, we use backward-compatible getattr() to handle missing columns

    def create_chat(self, title: str, initial_node_data: Dict, import_metadata: Dict = None) -> str:
        """Create a new chat with initial main node"""
        chat_data = {
            'id': str(uuid.uuid4()),
            'title': title
        }
        
        # Add import metadata if provided
        if import_metadata:
            chat_data['import_format'] = import_metadata.get('format')
            chat_data['original_id'] = import_metadata.get('original_id')
        
        chat = Chat(**chat_data)

        main_node = Node(
            id=str(uuid.uuid4()),
            chat_id=chat.id,
            type=initial_node_data.get('type', 'main'),  # Use provided type or default to 'main'
            title=initial_node_data.get('title', 'Root Thread'),
            x=initial_node_data.get('x', 100),
            y=initial_node_data.get('y', 100),
            messages=initial_node_data.get('messages', []), # Make sure this is passed!
            node_metadata=initial_node_data.get('metadata', {})  # Updated to use node_metadata
        )

        db.session.add(chat)
        db.session.add(main_node)
        db.session.commit()

        return chat.id

    def get_chat(self, chat_id: str) -> Optional[Dict]:
        """Get complete chat data including all nodes and their relationships"""
        chat = Chat.query.get(chat_id)
        if not chat:
            return None
            
        def node_to_dict(node):
            return {
                'id': node.id,
                'type': node.type,
                'title': node.title,
                'x': node.x,
                'y': node.y,
                'parentId': node.parent_id,
                'branchMessageIndex': node.branch_message_index,
                'messages': node.messages or [],
                'metadata': node.node_metadata or {},  # Convert back to metadata in API response
                'children': [node_to_dict(child) for child in node.children]
            }
            
        # Get all nodes for this chat to build the hierarchy properly
        all_nodes = Node.query.filter_by(chat_id=chat_id).all()
        
        # Build a map of node ID to node for efficient lookup
        node_map = {node.id: node for node in all_nodes}
        
        # Build the hierarchy by organizing nodes into parent-child relationships
        for node in all_nodes:
            if node.parent_id and node.parent_id in node_map:
                parent = node_map[node.parent_id]
                # Ensure children list exists
                if not hasattr(parent, '_children_cache'):
                    parent._children_cache = []
                parent._children_cache.append(node)
        
        # Enhanced node_to_dict function that uses the cached children
        def enhanced_node_to_dict(node):
            children = getattr(node, '_children_cache', [])
            return {
                'id': node.id,
                'type': node.type,
                'title': node.title,
                'x': node.x,
                'y': node.y,
                'parentId': node.parent_id,
                'branchMessageIndex': node.branch_message_index,
                'messages': node.messages or [],
                'metadata': node.node_metadata or {},
                'children': [enhanced_node_to_dict(child) for child in children]
            }
        
        # Find the main node (root node with no parent)
        main_node = next((node for node in all_nodes if node.parent_id is None), None)
        
        if not main_node:
            # Fallback: return empty structure if no main node found
            return {
                'id': chat.id,
                'title': chat.title,
                'createdAt': chat.created_at.isoformat(),
                'updatedAt': chat.updated_at.isoformat(),
                'nodes': {'id': None, 'children': []},
                'format': chat.import_format,
                'isImported': chat.import_format is not None,
                'originalId': chat.original_id
            }
        
        return {
            'id': chat.id,
            'title': chat.title,
            'createdAt': chat.created_at.isoformat(),
            'updatedAt': chat.updated_at.isoformat(),
            'nodes': enhanced_node_to_dict(main_node),
            'format': chat.import_format,  # Include sticky import format
            'isImported': chat.import_format is not None,
            'originalId': chat.original_id
        }

    def list_chats(self) -> List[Dict]:
            """Get list of all chats with basic info"""
            # Use a more efficient query that gets node counts without loading all nodes
            from sqlalchemy import func
            
            # Join with nodes table to get count without loading node data
            chats_with_counts = db.session.query(
                Chat.id,
                Chat.title,
                Chat.created_at,
                Chat.updated_at,
                Chat.import_format,
                Chat.original_id,
                func.count(Node.id).label('node_count')
            ).outerjoin(Node, Chat.id == Node.chat_id)\
             .group_by(Chat.id, Chat.title, Chat.created_at, Chat.updated_at, Chat.import_format, Chat.original_id)\
             .order_by(Chat.updated_at.desc()).all()
            
            result = []
            for chat_data in chats_with_counts:
                result.append({
                    'id': chat_data.id,
                    'title': chat_data.title,
                    'createdAt': chat_data.created_at.isoformat(),
                    'updatedAt': chat_data.updated_at.isoformat(),
                    'nodeCount': chat_data.node_count,
                    'format': chat_data.import_format,  # Use sticky import format from chat table
                    'isImported': chat_data.import_format is not None,  # Flag for imported conversations
                    'originalId': chat_data.original_id  # Original ID from source platform
                })
            
            return result

    def delete_chat(self, chat_id: str) -> bool:
        """Delete a chat and all its nodes"""
        chat = Chat.query.get(chat_id)
        if not chat:
            return False
        db.session.delete(chat)
        db.session.commit()
        return True

    def update_node(self, chat_id: str, node_id: str, data: Dict) -> bool:
        """Update node data"""
        node = Node.query.filter_by(chat_id=chat_id, id=node_id).first()
        if not node:
            return False
            
        # Convert metadata to node_metadata in incoming data
        if 'metadata' in data:
            data['node_metadata'] = data.pop('metadata')
            
        # Convert camelCase to snake_case for database fields
        field_mapping = {
            'parentId': 'parent_id',
            'branchMessageIndex': 'branch_message_index'
        }
        
        for key, value in data.items():
            # Use field mapping if available, otherwise use key as-is
            db_field = field_mapping.get(key, key)
            if hasattr(node, db_field):
                setattr(node, db_field, value)
                
        db.session.commit()
        return True

    def add_node(self, chat_id: str, node_data: Dict) -> Optional[str]:
        """Add a new node to existing chat"""
        chat = Chat.query.get(chat_id)
        if not chat:
            return None
            
        # Convert metadata to node_metadata in incoming data
        metadata = node_data.pop('metadata', {}) if 'metadata' in node_data else {}
            
        node = Node(
            id=str(uuid.uuid4()),
            chat_id=chat_id,
            type=node_data['type'],
            title=node_data.get('title'),
            x=node_data['x'],
            y=node_data['y'],
            parent_id=node_data.get('parentId'),
            branch_message_index=node_data.get('branchMessageIndex'),
            messages=node_data.get('messages', []),
            node_metadata=metadata
        )
        
        db.session.add(node)
        db.session.commit()
        return node.id

    def remove_node(self, chat_id: str, node_id: str) -> bool:
        """Remove a node and ALL its children recursively"""
        node = Node.query.filter_by(chat_id=chat_id, id=node_id).first()
        if not node or node.type == 'main':
            return False
        
        # Get count of nodes that will be deleted for logging
        def count_descendants(n):
            total = 1  # Count the node itself
            for child in n.children:
                total += count_descendants(child)
            return total
        
        nodes_to_delete = count_descendants(node)
        print(f"[ChatPersistenceService] Deleting node {node_id} and {nodes_to_delete - 1} descendants")
        
        # SQLAlchemy will now cascade delete children due to the relationship configuration
        db.session.delete(node)
        db.session.commit()
        
        print(f"[ChatPersistenceService] Successfully deleted {nodes_to_delete} nodes")
        return True
    
    def cleanup_orphaned_nodes(self, chat_id: str) -> int:
        """Clean up orphaned nodes that have invalid parent references"""
        try:
            # Find nodes with parent_id that doesn't exist
            orphaned_nodes = db.session.query(Node).filter(
                Node.chat_id == chat_id,
                Node.parent_id.isnot(None),
                ~Node.parent_id.in_(
                    db.session.query(Node.id).filter(Node.chat_id == chat_id)
                )
            ).all()
            
            orphan_count = len(orphaned_nodes)
            if orphan_count > 0:
                print(f"[ChatPersistenceService] Found {orphan_count} orphaned nodes in chat {chat_id}")
                for orphan in orphaned_nodes:
                    print(f"[ChatPersistenceService] Deleting orphaned node: {orphan.id} (parent: {orphan.parent_id})")
                    db.session.delete(orphan)
                
                db.session.commit()
                print(f"[ChatPersistenceService] Cleaned up {orphan_count} orphaned nodes")
            
            return orphan_count
        except Exception as e:
            print(f"[ChatPersistenceService] Error cleaning orphaned nodes: {e}")
            db.session.rollback()
            return 0
    
    def get_node_count_integrity_check(self, chat_id: str) -> dict:
        """Check node count integrity and identify potential issues"""
        try:
            all_nodes = Node.query.filter_by(chat_id=chat_id).all()
            total_count = len(all_nodes)
            
            # Count by type
            main_nodes = [n for n in all_nodes if n.type == 'main']
            branch_nodes = [n for n in all_nodes if n.type == 'branch']
            other_nodes = [n for n in all_nodes if n.type not in ['main', 'branch']]
            
            # Find orphaned nodes
            valid_parent_ids = {n.id for n in all_nodes}
            orphaned = [n for n in all_nodes if n.parent_id and n.parent_id not in valid_parent_ids]
            
            # Find root nodes (no parent)
            root_nodes = [n for n in all_nodes if not n.parent_id]
            
            return {
                'total_nodes': total_count,
                'main_nodes': len(main_nodes),
                'branch_nodes': len(branch_nodes),
                'other_nodes': len(other_nodes),
                'orphaned_nodes': len(orphaned),
                'root_nodes': len(root_nodes),
                'orphaned_details': [{'id': n.id, 'parent_id': n.parent_id, 'type': n.type} for n in orphaned]
            }
        except Exception as e:
            print(f"[ChatPersistenceService] Error in integrity check: {e}")
            return {'error': str(e)}
    
    def clear_all_data(self) -> bool:
        """Nuclear option: Clear ALL chats, nodes, and reset database to fresh state"""
        try:
            print("[ChatPersistenceService] 🚨 CLEARING ALL DATA - This will delete everything!")
            
            # Delete all nodes first (due to foreign key constraints)
            deleted_nodes = db.session.query(Node).delete()
            print(f"[ChatPersistenceService] Deleted {deleted_nodes} nodes")
            
            # Delete all chats
            deleted_chats = db.session.query(Chat).delete()
            print(f"[ChatPersistenceService] Deleted {deleted_chats} chats")
            
            # Commit the deletions
            db.session.commit()
            
            print("[ChatPersistenceService] ✅ All data cleared successfully")
            return True
            
        except Exception as e:
            print(f"[ChatPersistenceService] ❌ Error clearing all data: {e}")
            db.session.rollback()
            return False
