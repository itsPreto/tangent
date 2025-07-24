from typing import Dict, List, Optional, Any
import json
import uuid
from datetime import datetime
from ChatPersistenceService import db, AgentConfig, UserApiKey, SystemMessage, UserPreference

class AgentConfigService:
    """Service for managing agent configurations, API keys, and user preferences"""
    
    def __init__(self):
        pass
    
    # Agent Configuration Methods
    
    def get_all_agent_configs(self, user_id: str = None) -> List[Dict]:
        """Get all agent configurations for a user"""
        query = AgentConfig.query
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        configs = query.all()
        return [self._agent_config_to_dict(config) for config in configs]
    
    def get_agent_config(self, config_id: str, user_id: str = None) -> Optional[Dict]:
        """Get a specific agent configuration"""
        query = AgentConfig.query.filter_by(id=config_id)
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        config = query.first()
        return self._agent_config_to_dict(config) if config else None
    
    def create_agent_config(self, config_data: Dict, user_id: str = None) -> str:
        """Create a new agent configuration"""
        config = AgentConfig(
            id=str(uuid.uuid4()),
            name=config_data['name'],
            description=config_data.get('description'),
            type=config_data['type'],
            custom_type=config_data.get('customType'),
            model_data=config_data.get('model'),
            is_default=config_data.get('isDefault', False),
            enabled=config_data.get('enabled', True),
            emoji=config_data.get('emoji'),
            color=config_data.get('color'),
            priority=config_data.get('priority', 50),
            prompt=config_data.get('prompt'),
            trigger_patterns=config_data.get('triggerPatterns'),
            tags=config_data.get('tags'),
            user_id=user_id
        )
        
        db.session.add(config)
        db.session.commit()
        return config.id
    
    def update_agent_config(self, config_id: str, updates: Dict, user_id: str = None) -> bool:
        """Update an agent configuration"""
        query = AgentConfig.query.filter_by(id=config_id)
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        config = query.first()
        if not config:
            return False
        
        # Update fields
        field_mapping = {
            'name': 'name',
            'description': 'description',
            'type': 'type',
            'customType': 'custom_type',
            'model': 'model_data',
            'isDefault': 'is_default',
            'enabled': 'enabled',
            'emoji': 'emoji',
            'color': 'color',
            'priority': 'priority',
            'prompt': 'prompt',
            'triggerPatterns': 'trigger_patterns',
            'tags': 'tags'
        }
        
        for key, value in updates.items():
            if key in field_mapping:
                setattr(config, field_mapping[key], value)
        
        db.session.commit()
        return True
    
    def delete_agent_config(self, config_id: str, user_id: str = None) -> bool:
        """Delete an agent configuration"""
        query = AgentConfig.query.filter_by(id=config_id)
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        config = query.first()
        if not config:
            return False
        
        # Don't allow deletion of default agents
        if config.id.startswith('default-'):
            return False
        
        db.session.delete(config)
        db.session.commit()
        return True
    
    def set_agent_model(self, agent_type: str, model_data: Dict, user_id: str = None) -> bool:
        """Set model for a specific agent type"""
        # Find the default agent of this type
        query = AgentConfig.query.filter_by(type=agent_type, is_default=True)
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        config = query.first()
        if config:
            config.model_data = model_data
            config.enabled = True
            db.session.commit()
            return True
        return False
    
    def create_default_agents(self, user_id: str = None) -> List[str]:
        """Create default agent configurations for a user"""
        default_configs = [
            {
                'id': 'default-text',
                'name': 'Default Text Agent',
                'description': 'Handles general text-based conversations and queries',
                'type': 'text',
                'is_default': True,
                'enabled': True,
                'prompt': 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses to user queries.'
            },
            {
                'id': 'default-vision',
                'name': 'Default Vision Agent', 
                'description': 'Processes and analyzes images, provides descriptions and answers visual questions',
                'type': 'vision',
                'is_default': True,
                'enabled': True,
                'prompt': 'You are an AI assistant specialized in analyzing images. Provide detailed, accurate descriptions and answer questions about visual content.'
            },
            {
                'id': 'default-code',
                'name': 'Default Code Agent',
                'description': 'Assists with programming, code review, and technical questions',
                'type': 'code',
                'is_default': True,
                'enabled': False,
                'prompt': 'You are a programming assistant. Help with code, debugging, architecture, and technical solutions.'
            },
            {
                'id': 'default-router',
                'name': 'Default Router Agent',
                'description': 'Routes requests to appropriate specialized agents',
                'type': 'router',
                'is_default': True,
                'enabled': False,
                'prompt': 'You are a router agent. Analyze user requests and determine which specialized agent should handle them.'
            }
        ]
        
        created_ids = []
        for config_data in default_configs:
            # Check if already exists
            existing = AgentConfig.query.filter_by(
                id=config_data['id'], 
                user_id=user_id
            ).first()
            
            if not existing:
                config = AgentConfig(
                    id=config_data['id'],
                    name=config_data['name'],
                    description=config_data['description'],
                    type=config_data['type'],
                    is_default=config_data['is_default'],
                    enabled=config_data['enabled'],
                    prompt=config_data['prompt'],
                    user_id=user_id
                )
                db.session.add(config)
                created_ids.append(config.id)
        
        db.session.commit()
        return created_ids
    
    # API Key Methods
    
    def get_api_keys(self, user_id: str = None) -> Dict[str, str]:
        """Get all API keys for a user"""
        query = UserApiKey.query.filter_by(is_active=True)
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        keys = query.all()
        return {key.provider: key.key_value for key in keys}
    
    def set_api_key(self, provider: str, key_value: str, user_id: str = None) -> bool:
        """Set an API key for a provider"""
        # Check if key already exists
        query = UserApiKey.query.filter_by(provider=provider)
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        existing_key = query.first()
        
        if existing_key:
            existing_key.key_value = key_value
            existing_key.is_active = True
            existing_key.updated_at = datetime.utcnow()
        else:
            new_key = UserApiKey(
                provider=provider,
                key_value=key_value,
                user_id=user_id
            )
            db.session.add(new_key)
        
        db.session.commit()
        return True
    
    def delete_api_key(self, provider: str, user_id: str = None) -> bool:
        """Delete an API key"""
        query = UserApiKey.query.filter_by(provider=provider)
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        key = query.first()
        if key:
            db.session.delete(key)
            db.session.commit()
            return True
        return False
    
    # System Message Methods
    
    def get_system_messages(self, user_id: str = None) -> Dict[str, str]:
        """Get all system messages for a user"""
        query = SystemMessage.query
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        messages = query.all()
        return {msg.agent_type: msg.message for msg in messages}
    
    def set_system_message(self, agent_type: str, message: str, user_id: str = None, agent_id: str = None) -> bool:
        """Set a system message for an agent type"""
        # Check if message already exists
        query = SystemMessage.query.filter_by(agent_type=agent_type)
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        existing_message = query.first()
        
        if existing_message:
            existing_message.message = message
            existing_message.updated_at = datetime.utcnow()
        else:
            new_message = SystemMessage(
                agent_type=agent_type,
                agent_id=agent_id,
                message=message,
                user_id=user_id
            )
            db.session.add(new_message)
        
        db.session.commit()
        return True
    
    # User Preference Methods
    
    def get_preferences(self, category: str = None, user_id: str = None) -> Dict[str, Any]:
        """Get user preferences, optionally filtered by category"""
        query = UserPreference.query
        if user_id:
            query = query.filter_by(user_id=user_id)
        if category:
            query = query.filter_by(category=category)
        
        preferences = query.all()
        return {pref.preference_key: pref.preference_value for pref in preferences}
    
    def set_preference(self, key: str, value: Any, category: str, user_id: str = None) -> bool:
        """Set a user preference"""
        # Check if preference already exists
        query = UserPreference.query.filter_by(preference_key=key)
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        existing_pref = query.first()
        
        if existing_pref:
            existing_pref.preference_value = value
            existing_pref.category = category
            existing_pref.updated_at = datetime.utcnow()
        else:
            new_pref = UserPreference(
                preference_key=key,
                preference_value=value,
                category=category,
                user_id=user_id
            )
            db.session.add(new_pref)
        
        db.session.commit()
        return True
    
    def delete_preference(self, key: str, user_id: str = None) -> bool:
        """Delete a user preference"""
        query = UserPreference.query.filter_by(preference_key=key)
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        pref = query.first()
        if pref:
            db.session.delete(pref)
            db.session.commit()
            return True
        return False
    
    # Bulk Operations for Migration
    
    def import_localStorage_data(self, localStorage_data: Dict, user_id: str = None) -> Dict[str, int]:
        """Import data from localStorage format"""
        results = {
            'agent_configs': 0,
            'api_keys': 0,
            'system_messages': 0,
            'preferences': 0
        }
        
        # Import agent configs
        if 'agentConfigs' in localStorage_data:
            for config_data in localStorage_data['agentConfigs']:
                try:
                    self.create_agent_config(config_data, user_id)
                    results['agent_configs'] += 1
                except Exception as e:
                    print(f"Failed to import agent config: {e}")
        
        # Import API keys
        api_key_mapping = {
            'anthropicApiKey': 'anthropic',
            'openRouterApiKey': 'openrouter',
            'geminiApiKey': 'google'
        }
        
        for localStorage_key, provider in api_key_mapping.items():
            if localStorage_key in localStorage_data and localStorage_data[localStorage_key]:
                try:
                    self.set_api_key(provider, localStorage_data[localStorage_key], user_id)
                    results['api_keys'] += 1
                except Exception as e:
                    print(f"Failed to import API key {provider}: {e}")
        
        # Import system messages
        system_message_types = ['text', 'vision', 'code', 'router']
        for agent_type in system_message_types:
            key = f'systemMessage_{agent_type}'
            if key in localStorage_data and localStorage_data[key]:
                try:
                    self.set_system_message(agent_type, localStorage_data[key], user_id)
                    results['system_messages'] += 1
                except Exception as e:
                    print(f"Failed to import system message {agent_type}: {e}")
        
        # Import preferences (TTS, Whisper, favorites)
        preference_mapping = {
            # TTS settings
            'ttsEnabled': ('tts', 'tts_enabled'),
            'ttsVoice': ('tts', 'tts_voice'),
            'ttsSpeed': ('tts', 'tts_speed'),
            'ttsAutoRead': ('tts', 'tts_auto_read'),
            # Whisper settings
            'whisperEnabled': ('whisper', 'whisper_enabled'),
            'whisperModel': ('whisper', 'whisper_model'),
            'whisperLanguage': ('whisper', 'whisper_language'),
            'whisperThreads': ('whisper', 'whisper_threads'),
            'whisperTranslate': ('whisper', 'whisper_translate'),
            'whisperDiarize': ('whisper', 'whisper_diarize'),
            'whisperTimestamps': ('whisper', 'whisper_timestamps'),
            # Model favorites
            'favoriteModels': ('models', 'favorite_models')
        }
        
        for localStorage_key, (category, pref_key) in preference_mapping.items():
            if localStorage_key in localStorage_data:
                try:
                    value = localStorage_data[localStorage_key]
                    # Parse JSON strings for boolean/array values
                    if isinstance(value, str) and value in ['true', 'false']:
                        value = value == 'true'
                    elif isinstance(value, str) and value.startswith('['):
                        value = json.loads(value)
                    
                    self.set_preference(pref_key, value, category, user_id)
                    results['preferences'] += 1
                except Exception as e:
                    print(f"Failed to import preference {localStorage_key}: {e}")
        
        return results
    
    # Helper Methods
    
    def _agent_config_to_dict(self, config: AgentConfig) -> Dict:
        """Convert AgentConfig model to dictionary"""
        return {
            'id': config.id,
            'name': config.name,
            'description': config.description,
            'type': config.type,
            'customType': config.custom_type,
            'model': config.model_data,
            'isDefault': config.is_default,
            'enabled': config.enabled,
            'emoji': config.emoji,
            'color': config.color,
            'priority': config.priority,
            'prompt': config.prompt,
            'triggerPatterns': config.trigger_patterns,
            'tags': config.tags,
            'createdAt': config.created_at.isoformat() if config.created_at else None,
            'updatedAt': config.updated_at.isoformat() if config.updated_at else None
        }