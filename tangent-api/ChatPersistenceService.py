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

class ChatPersistenceService:
    def __init__(self, app):
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chats.db'
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        db.init_app(app)
        with app.app_context():
            db.create_all()

    def create_chat(self, title: str, initial_node_data: Dict) -> str:
        """Create a new chat with initial main node"""
        chat = Chat(
            id=str(uuid.uuid4()),
            title=title
        )

        main_node = Node(
            id=str(uuid.uuid4()),
            chat_id=chat.id,
            type='main',
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
            
        main_node = Node.query.filter_by(chat_id=chat_id, parent_id=None).first()
        
        return {
            'id': chat.id,
            'title': chat.title,
            'createdAt': chat.created_at.isoformat(),
            'updatedAt': chat.updated_at.isoformat(),
            'nodes': node_to_dict(main_node)
        }

    def list_chats(self) -> List[Dict]:
            """Get list of all chats with basic info"""
            chats = Chat.query.order_by(Chat.updated_at.desc()).all()
            print(f"Chats from DB: {chats}")  # ADD THIS LINE for debugging
            return [{
                'id': chat.id,
                'title': chat.title,
                'createdAt': chat.created_at.isoformat(),
                'updatedAt': chat.updated_at.isoformat(),
                'nodeCount': len(chat.nodes)
            } for chat in chats]

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
            
        for key, value in data.items():
            if hasattr(node, key):
                setattr(node, key, value)
                
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