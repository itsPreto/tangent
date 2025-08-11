import yaml
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
import jsonschema
from flask import current_app

class CanvasConfigService:
    """
    Service for managing canvas configuration via YAML files
    Supports validation, hot reload, and bidirectional sync
    """
    
    def __init__(self, config_path: str = None):
        # Default to project root
        self.config_path = config_path or os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            'tangent-config.yaml'
        )
        self.config_data = None
        self.schema_path = os.path.join(
            os.path.dirname(__file__), 
            'config-schema.json'
        )
        self._last_modified = None
        
    def load_config(self) -> Dict[str, Any]:
        """Load configuration from YAML file with validation"""
        try:
            if not os.path.exists(self.config_path):
                return self._create_default_config()
                
            with open(self.config_path, 'r', encoding='utf-8') as file:
                config_data = yaml.safe_load(file)
                
            # Validate against schema if available
            if os.path.exists(self.schema_path):
                self._validate_config(config_data)
                
            # Update last modified time
            self._last_modified = os.path.getmtime(self.config_path)
            self.config_data = config_data
            
            return config_data
            
        except yaml.YAMLError as e:
            current_app.logger.error(f"YAML parsing error: {e}")
            raise ValueError(f"Invalid YAML syntax: {e}")
        except Exception as e:
            current_app.logger.error(f"Config loading error: {e}")
            raise
    
    def save_config(self, config_data: Dict[str, Any]) -> bool:
        """Save configuration to YAML file with validation"""
        try:
            # Validate before saving
            if os.path.exists(self.schema_path):
                self._validate_config(config_data)
            
            # Update timestamps
            config_data['updated_at'] = datetime.now(timezone.utc).isoformat()
            
            # Backup existing config
            if os.path.exists(self.config_path):
                backup_path = f"{self.config_path}.backup"
                with open(self.config_path, 'r') as src, open(backup_path, 'w') as dst:
                    dst.write(src.read())
            
            # Write new config with proper formatting
            with open(self.config_path, 'w', encoding='utf-8') as file:
                yaml.dump(config_data, file, 
                         default_flow_style=False,
                         indent=2,
                         sort_keys=False,
                         allow_unicode=True)
            
            # Update internal state
            self.config_data = config_data
            self._last_modified = os.path.getmtime(self.config_path)
            
            current_app.logger.info("Canvas configuration saved successfully")
            return True
            
        except Exception as e:
            current_app.logger.error(f"Config saving error: {e}")
            return False
    
    def get_section(self, section: str) -> Optional[Dict[str, Any]]:
        """Get specific configuration section"""
        if not self.config_data:
            self.load_config()
        
        return self.config_data.get(section)
    
    def update_section(self, section: str, data: Dict[str, Any]) -> bool:
        """Update specific configuration section"""
        if not self.config_data:
            self.load_config()
        
        self.config_data[section] = data
        return self.save_config(self.config_data)
    
    def get_hub_config(self) -> Dict[str, Any]:
        """Get hub positioning configuration"""
        return self.get_section('hub') or {}
    
    def get_topic_config(self) -> Dict[str, Any]:
        """Get topic clustering configuration"""
        return self.get_section('topic_clusters') or {}
    
    def get_node_config(self) -> Dict[str, Any]:
        """Get node positioning configuration"""
        return self.get_section('nodes') or {}
    
    def get_viewport_config(self) -> Dict[str, Any]:
        """Get viewport and navigation configuration"""
        return self.get_section('viewport') or {}
    
    def is_modified(self) -> bool:
        """Check if config file has been modified since last load"""
        if not os.path.exists(self.config_path):
            return False
            
        current_mtime = os.path.getmtime(self.config_path)
        return current_mtime != self._last_modified
    
    def reload_if_modified(self) -> bool:
        """Reload config if file has been modified"""
        if self.is_modified():
            self.load_config()
            return True
        return False
    
    def _validate_config(self, config_data: Dict[str, Any]) -> bool:
        """Validate configuration against JSON schema"""
        try:
            with open(self.schema_path, 'r') as schema_file:
                schema = json.load(schema_file)
                
            jsonschema.validate(config_data, schema)
            return True
            
        except jsonschema.ValidationError as e:
            current_app.logger.error(f"Config validation error: {e}")
            raise ValueError(f"Configuration validation failed: {e.message}")
        except FileNotFoundError:
            current_app.logger.warning("Schema file not found, skipping validation")
            return True
    
    def _create_default_config(self) -> Dict[str, Any]:
        """Create default configuration if none exists"""
        default_config = {
            'version': '1.0',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'hub': {
                'position': {'x': 0, 'y': 0},
                'components': {
                    'tangent_logo': {
                        'position': {'x': 0, 'y': -100},
                        'dimensions': {'width': 200, 'height': 60}
                    },
                    'canvas_input_container': {
                        'position': {'x': 0, 'y': 0},
                        'dimensions': {'width': 600, 'height': 300, 'claude_mode_width': 700},
                        'z_index': 1000
                    }
                }
            },
            'topic_clusters': {
                'layout_mode': 'circular',
                'circle_configuration': {
                    'inner_circle': {'radius': 25000, 'max_topics': 8},
                    'outer_circle': {'radius': 40000, 'max_topics': 16}
                }
            },
            'nodes': {
                'default_dimensions': {
                    'standard': {'width': 400, 'height': 300},
                    'compact': {'width': 120, 'height': 40}
                },
                'spacing': {'minimum_distance': 500, 'cluster_padding': 1000}
            },
            'viewport': {
                'default_zoom': 0.9,
                'min_zoom': 0.001,
                'max_zoom': 3.0,
                'center_animation_duration': 600,
                'distance_indicator': {'threshold': 2000, 'show_delay': 50}
            }
        }
        
        self.save_config(default_config)
        return default_config
    
    def export_to_json(self) -> str:
        """Export current config as JSON string"""
        if not self.config_data:
            self.load_config()
        
        return json.dumps(self.config_data, indent=2, ensure_ascii=False)
    
    def import_from_json(self, json_string: str) -> bool:
        """Import config from JSON string"""
        try:
            config_data = json.loads(json_string)
            return self.save_config(config_data)
        except json.JSONDecodeError as e:
            current_app.logger.error(f"JSON parsing error: {e}")
            return False
    
    def get_positioning_values(self) -> Dict[str, Any]:
        """Extract all positioning values for migration purposes"""
        if not self.config_data:
            self.load_config()
        
        positioning = {
            'hub_position': self.config_data.get('hub', {}).get('position', {'x': 0, 'y': 0}),
            'logo_position': self.config_data.get('hub', {}).get('components', {}).get('tangent_logo', {}).get('position', {'x': 0, 'y': -100}),
            'input_container_position': self.config_data.get('hub', {}).get('components', {}).get('canvas_input_container', {}).get('position', {'x': 0, 'y': 0}),
            'topic_radius': self.config_data.get('topic_clusters', {}).get('circle_configuration', {}).get('inner_circle', {}).get('radius', 25000),
            'default_zoom': self.config_data.get('viewport', {}).get('default_zoom', 0.9)
        }
        
        return positioning