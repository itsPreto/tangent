from typing import Dict, List, Optional
import json
import uuid
from datetime import datetime, timedelta
from ChatPersistenceService import db, ClaudeCodeSession, ClaudeCodeConversation, ClaudeCodeInstance

class SessionService:
    """Service for managing Claude Code sessions with persistence and continuity"""
    
    def __init__(self, app):
        self.app = app
        
    def create_session(self, instance_id: str = None, working_dir: str = None, config: Dict = None) -> str:
        """Create a new Claude Code session"""
        with self.app.app_context():
            session = ClaudeCodeSession(
                instance_id=instance_id,
                working_dir=working_dir,
                session_data=config or {}
            )
            db.session.add(session)
            db.session.commit()
            return session.id
    
    def get_session(self, session_id: str) -> Optional[Dict]:
        """Get session details including conversation history"""
        with self.app.app_context():
            session = ClaudeCodeSession.query.get(session_id)
            if not session:
                return None
            
            conversations = ClaudeCodeConversation.query.filter_by(
                session_id=session_id
            ).order_by(ClaudeCodeConversation.turn_number).all()
            
            return {
                'id': session.id,
                'instance_id': session.instance_id,
                'created_at': session.created_at.isoformat(),
                'last_active': session.last_active.isoformat(),
                'message_count': session.message_count,
                'total_cost': session.total_cost,
                'session_data': session.session_data,
                'working_dir': session.working_dir,
                'status': session.status,
                'conversations': [
                    {
                        'id': conv.id,
                        'turn_number': conv.turn_number,
                        'role': conv.role,
                        'content': conv.content,
                        'metadata': conv.conversation_metadata,
                        'timestamp': conv.timestamp.isoformat()
                    }
                    for conv in conversations
                ]
            }
    
    def add_conversation_turn(self, session_id: str, role: str, content: str, metadata: Dict = None) -> str:
        """Add a conversation turn to a session"""
        with self.app.app_context():
            session = ClaudeCodeSession.query.get(session_id)
            if not session:
                raise ValueError(f"Session {session_id} not found")
            
            # Get next turn number
            last_turn = ClaudeCodeConversation.query.filter_by(
                session_id=session_id
            ).order_by(ClaudeCodeConversation.turn_number.desc()).first()
            
            turn_number = (last_turn.turn_number + 1) if last_turn else 1
            
            conversation = ClaudeCodeConversation(
                session_id=session_id,
                turn_number=turn_number,
                role=role,
                content=content,
                conversation_metadata=metadata or {}
            )
            
            # Update session stats
            session.message_count += 1
            session.last_active = datetime.utcnow()
            
            # Add cost if provided in metadata
            if metadata and 'cost_usd' in metadata:
                session.total_cost += metadata['cost_usd']
            
            db.session.add(conversation)
            db.session.commit()
            
            return conversation.id
    
    def update_session_status(self, session_id: str, status: str, session_data: Dict = None) -> bool:
        """Update session status and data"""
        with self.app.app_context():
            session = ClaudeCodeSession.query.get(session_id)
            if not session:
                return False
            
            session.status = status
            session.last_active = datetime.utcnow()
            
            if session_data:
                session.session_data = session_data
            
            db.session.commit()
            return True
    
    def get_resumable_sessions(self, limit: int = 10) -> List[Dict]:
        """Get recently active sessions that can be resumed"""
        with self.app.app_context():
            sessions = ClaudeCodeSession.query.filter(
                ClaudeCodeSession.status.in_(['active', 'paused'])
            ).order_by(ClaudeCodeSession.last_active.desc()).limit(limit).all()
            
            return [
                {
                    'id': session.id,
                    'instance_id': session.instance_id,
                    'last_active': session.last_active.isoformat(),
                    'message_count': session.message_count,
                    'total_cost': session.total_cost,
                    'working_dir': session.working_dir,
                    'status': session.status
                }
                for session in sessions
            ]
    
    def get_session_continuation_context(self, session_id: str, max_turns: int = 10) -> str:
        """Get recent conversation context for session continuation"""
        with self.app.app_context():
            conversations = ClaudeCodeConversation.query.filter_by(
                session_id=session_id
            ).order_by(ClaudeCodeConversation.turn_number.desc()).limit(max_turns).all()
            
            # Reverse to get chronological order
            conversations = list(reversed(conversations))
            
            context_lines = []
            for conv in conversations:
                role_prefix = "Human:" if conv.role == 'user' else "Assistant:"
                context_lines.append(f"{role_prefix} {conv.content}")
            
            return "\n\n".join(context_lines)
    
    def cleanup_old_sessions(self, days_old: int = 30) -> int:
        """Clean up sessions older than specified days"""
        with self.app.app_context():
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            
            old_sessions = ClaudeCodeSession.query.filter(
                ClaudeCodeSession.last_active < cutoff_date,
                ClaudeCodeSession.status.in_(['completed', 'error'])
            ).all()
            
            count = len(old_sessions)
            for session in old_sessions:
                db.session.delete(session)
            
            db.session.commit()
            return count
    
    def create_instance_record(self, config: Dict, node_id: str = None) -> str:
        """Create a database record for a Claude Code instance"""
        with self.app.app_context():
            instance = ClaudeCodeInstance(
                node_id=node_id,
                config=config,
                working_dir=config.get('working_dir'),
                status='created'
            )
            db.session.add(instance)
            db.session.commit()
            return instance.id
    
    def update_instance_status(self, instance_id: str, status: str, **kwargs) -> bool:
        """Update instance status and metrics"""
        with self.app.app_context():
            instance = ClaudeCodeInstance.query.get(instance_id)
            if not instance:
                return False
            
            instance.status = status
            
            # Update metrics if provided
            if 'cost_usd' in kwargs:
                instance.cost_usd = kwargs['cost_usd']
            if 'num_turns' in kwargs:
                instance.num_turns = kwargs['num_turns']
            if 'start_time' in kwargs:
                instance.start_time = kwargs['start_time']
            if 'end_time' in kwargs:
                instance.end_time = kwargs['end_time']
            
            db.session.commit()
            return True
    
    def get_instance_sessions(self, instance_id: str) -> List[Dict]:
        """Get all sessions for a specific instance"""
        with self.app.app_context():
            sessions = ClaudeCodeSession.query.filter_by(
                instance_id=instance_id
            ).order_by(ClaudeCodeSession.created_at.desc()).all()
            
            return [
                {
                    'id': session.id,
                    'created_at': session.created_at.isoformat(),
                    'last_active': session.last_active.isoformat(),
                    'message_count': session.message_count,
                    'total_cost': session.total_cost,
                    'status': session.status
                }
                for session in sessions
            ]