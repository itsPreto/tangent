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
    children = db.relationship('Node', backref=db.backref('parent', remote_side=[id]))

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
            messages=initial_node_data.get('messages', []),
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
        """Remove a node and its children"""
        node = Node.query.filter_by(chat_id=chat_id, id=node_id).first()
        if not node or node.type == 'main':
            return False
            
        db.session.delete(node)
        db.session.commit()
        return True