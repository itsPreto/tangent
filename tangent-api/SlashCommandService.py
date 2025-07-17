from typing import Dict, List, Optional, Tuple, Any
import json
import re
import os
from datetime import datetime

class SlashCommandService:
    """Service for handling slash commands and file referencing"""
    
    def __init__(self, app, session_service=None, mcp_service=None):
        self.app = app
        self.session_service = session_service
        self.mcp_service = mcp_service
        
        # Register built-in slash commands
        self.commands = {
            '/bug': self._handle_bug_command,
            '/clear': self._handle_clear_command,
            '/help': self._handle_help_command,
            '/config': self._handle_config_command,
            '/sessions': self._handle_sessions_command,
            '/mcp': self._handle_mcp_command,
            '/tools': self._handle_tools_command,
        }
    
    def process_message(self, message: str, context: Dict = None) -> Tuple[str, Dict]:
        """Process a message for slash commands and file references
        
        Returns:
            Tuple of (processed_message, metadata)
        """
        metadata = {'original_message': message}
        
        # Check for slash commands (must be at start of message)
        if message.strip().startswith('/'):
            command_result = self._handle_slash_command(message, context or {})
            if command_result:
                return command_result['response'], {**metadata, 'command_result': command_result}
        
        # Process file references (@filename)
        processed_message, file_refs = self._process_file_references(message)
        if file_refs:
            metadata['file_references'] = file_refs
        
        return processed_message, metadata
    
    def _handle_slash_command(self, message: str, context: Dict) -> Optional[Dict]:
        """Handle slash command execution"""
        parts = message.strip().split()
        if not parts:
            return None
        
        command = parts[0]
        args = parts[1:] if len(parts) > 1 else []
        
        if command in self.commands:
            try:
                return self.commands[command](args, context)
            except Exception as e:
                return {
                    'command': command,
                    'success': False,
                    'error': str(e),
                    'response': f"Error executing {command}: {e}"
                }
        else:
            available_commands = ', '.join(self.commands.keys())
            return {
                'command': command,
                'success': False,
                'error': 'Unknown command',
                'response': f"Unknown command: {command}. Available commands: {available_commands}"
            }
    
    def _handle_bug_command(self, args: List[str], context: Dict) -> Dict:
        """Handle /bug command for reporting issues"""
        if not args:
            return {
                'command': '/bug',
                'success': False,
                'response': "Usage: /bug <description>\nReport a bug or issue with the current conversation."
            }
        
        description = ' '.join(args)
        
        # Create bug report data
        bug_report = {
            'description': description,
            'timestamp': datetime.utcnow().isoformat(),
            'context': {
                'session_id': context.get('session_id'),
                'node_id': context.get('node_id'),
                'user_agent': context.get('user_agent'),
                'url': context.get('url')
            }
        }
        
        # In a real implementation, this would submit to a bug tracking system
        return {
            'command': '/bug',
            'success': True,
            'bug_report': bug_report,
            'response': f"Bug report submitted: {description}\n\nThank you for reporting this issue. The development team will investigate."
        }
    
    def _handle_clear_command(self, args: List[str], context: Dict) -> Dict:
        """Handle /clear command for clearing conversation"""
        return {
            'command': '/clear',
            'success': True,
            'response': "Conversation cleared. Starting fresh.",
            'action': 'clear_conversation'
        }
    
    def _handle_help_command(self, args: List[str], context: Dict) -> Dict:
        """Handle /help command"""
        if args and args[0] in self.commands:
            # Show help for specific command
            command = args[0]
            help_text = self._get_command_help(command)
        else:
            # Show general help
            help_text = """Available slash commands:

/bug <description>    - Report a bug or issue
/clear               - Clear the current conversation
/help [command]      - Show help (optionally for a specific command)
/config [key] [value] - View or set configuration
/sessions            - List recent sessions
/mcp [action]        - Manage MCP servers
/tools               - List available tools

File References:
@filename            - Include file contents in your message
@directory/          - List directory contents

Examples:
  /bug The streaming is not working properly
  /config model claude-3-sonnet
  @src/main.py        - Include main.py in your message
  @src/               - List files in src directory
"""
        
        return {
            'command': '/help',
            'success': True,
            'response': help_text
        }
    
    def _handle_config_command(self, args: List[str], context: Dict) -> Dict:
        """Handle /config command for configuration management"""
        if not args:
            # Show current config
            config = {
                'working_directory': os.getcwd(),
                'session_id': context.get('session_id'),
                'node_id': context.get('node_id'),
                'model': context.get('model', 'claude-3-sonnet'),
                'temperature': context.get('temperature', 0.7),
                'max_tokens': context.get('max_tokens', 4096)
            }
            
            config_text = "Current configuration:\n"
            for key, value in config.items():
                config_text += f"  {key}: {value}\n"
            
            return {
                'command': '/config',
                'success': True,
                'config': config,
                'response': config_text
            }
        
        elif len(args) == 1:
            # Show specific config value
            key = args[0]
            # This would get from actual config store
            return {
                'command': '/config',
                'success': True,
                'response': f"Config value for '{key}': (would show actual value)"
            }
        
        elif len(args) == 2:
            # Set config value
            key, value = args
            # This would set in actual config store
            return {
                'command': '/config',
                'success': True,
                'response': f"Set {key} = {value}",
                'action': 'update_config',
                'config_update': {key: value}
            }
        
        else:
            return {
                'command': '/config',
                'success': False,
                'response': "Usage: /config [key] [value]\n  /config          - Show all config\n  /config key      - Show specific value\n  /config key val  - Set value"
            }
    
    def _handle_sessions_command(self, args: List[str], context: Dict) -> Dict:
        """Handle /sessions command"""
        if not self.session_service:
            return {
                'command': '/sessions',
                'success': False,
                'response': "Session service not available"
            }
        
        try:
            sessions = self.session_service.get_resumable_sessions(limit=10)
            
            if not sessions:
                response = "No recent sessions found."
            else:
                response = "Recent sessions:\n"
                for session in sessions:
                    response += f"  {session['id'][:8]} - {session['message_count']} messages - {session['status']} - ${session['total_cost']:.3f}\n"
                response += "\nUse --resume <session_id> to continue a session."
            
            return {
                'command': '/sessions',
                'success': True,
                'sessions': sessions,
                'response': response
            }
        except Exception as e:
            return {
                'command': '/sessions',
                'success': False,
                'response': f"Error retrieving sessions: {e}"
            }
    
    def _handle_mcp_command(self, args: List[str], context: Dict) -> Dict:
        """Handle /mcp command for MCP server management"""
        if not self.mcp_service:
            return {
                'command': '/mcp',
                'success': False,
                'response': "MCP service not available"
            }
        
        if not args:
            # Show MCP server status
            try:
                servers = self.mcp_service.get_mcp_servers()
                if not servers:
                    response = "No MCP servers configured."
                else:
                    response = "MCP Servers:\n"
                    for server in servers:
                        status = "🟢" if server.get('running') else "🔴"
                        response += f"  {status} {server['name']} - {server['tool_count']} tools\n"
                
                return {
                    'command': '/mcp',
                    'success': True,
                    'servers': servers,
                    'response': response
                }
            except Exception as e:
                return {
                    'command': '/mcp',
                    'success': False,
                    'response': f"Error getting MCP servers: {e}"
                }
        
        action = args[0]
        if action == 'list':
            return self._handle_mcp_command([], context)
        elif action == 'start' and len(args) > 1:
            server_name = args[1]
            try:
                success = self.mcp_service.start_mcp_server(server_name)
                return {
                    'command': '/mcp start',
                    'success': success,
                    'response': f"{'Started' if success else 'Failed to start'} MCP server: {server_name}"
                }
            except Exception as e:
                return {
                    'command': '/mcp start',
                    'success': False,
                    'response': f"Error starting server {server_name}: {e}"
                }
        elif action == 'stop' and len(args) > 1:
            server_name = args[1]
            try:
                success = self.mcp_service.stop_mcp_server(server_name)
                return {
                    'command': '/mcp stop',
                    'success': success,
                    'response': f"{'Stopped' if success else 'Failed to stop'} MCP server: {server_name}"
                }
            except Exception as e:
                return {
                    'command': '/mcp stop',
                    'success': False,
                    'response': f"Error stopping server {server_name}: {e}"
                }
        else:
            return {
                'command': '/mcp',
                'success': False,
                'response': "Usage: /mcp [list|start <server>|stop <server>]"
            }
    
    def _handle_tools_command(self, args: List[str], context: Dict) -> Dict:
        """Handle /tools command to list available tools"""
        tools = {
            'built_in': ['Read', 'Write', 'Bash', 'Glob', 'Grep', 'Edit', 'MultiEdit', 'LS', 'TodoWrite'],
            'mcp': []
        }
        
        if self.mcp_service:
            try:
                mcp_tools = self.mcp_service.get_available_tools()
                tools['mcp'] = list(mcp_tools.keys())
            except Exception:
                pass
        
        response = "Available tools:\n\nBuilt-in tools:\n"
        for tool in tools['built_in']:
            response += f"  • {tool}\n"
        
        if tools['mcp']:
            response += "\nMCP tools:\n"
            for tool in tools['mcp']:
                response += f"  • {tool}\n"
        
        total_tools = len(tools['built_in']) + len(tools['mcp'])
        response += f"\nTotal: {total_tools} tools available"
        
        return {
            'command': '/tools',
            'success': True,
            'tools': tools,
            'response': response
        }
    
    def _process_file_references(self, message: str) -> Tuple[str, List[Dict]]:
        """Process @filename references in message"""
        # Pattern to match @filename or @directory/
        pattern = r'@([a-zA-Z0-9._/-]+/?)'
        matches = re.findall(pattern, message)
        
        if not matches:
            return message, []
        
        file_refs = []
        processed_message = message
        
        for match in matches:
            file_path = match.strip()
            ref_info = self._resolve_file_reference(file_path)
            file_refs.append(ref_info)
            
            # Replace @filename with actual content or listing
            if ref_info['exists']:
                if ref_info['type'] == 'file':
                    replacement = f"\n\n--- Content of {file_path} ---\n{ref_info['content']}\n--- End of {file_path} ---\n"
                else:  # directory
                    files = '\n'.join([f"  {item}" for item in ref_info['content']])
                    replacement = f"\n\n--- Directory listing of {file_path} ---\n{files}\n--- End listing ---\n"
            else:
                replacement = f"\n\n[File not found: {file_path}]\n"
            
            processed_message = processed_message.replace(f'@{match}', replacement)
        
        return processed_message, file_refs
    
    def _resolve_file_reference(self, file_path: str) -> Dict:
        """Resolve a file reference to actual content"""
        try:
            # Security check - ensure path is safe
            if not self._is_safe_path(file_path):
                return {
                    'path': file_path,
                    'exists': False,
                    'error': 'Path not allowed for security reasons'
                }
            
            if os.path.isfile(file_path):
                # Read file content
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    return {
                        'path': file_path,
                        'type': 'file',
                        'exists': True,
                        'content': content,
                        'size': len(content),
                        'lines': len(content.splitlines())
                    }
                except UnicodeDecodeError:
                    return {
                        'path': file_path,
                        'type': 'file',
                        'exists': True,
                        'error': 'Binary file - cannot display content'
                    }
                except Exception as e:
                    return {
                        'path': file_path,
                        'exists': False,
                        'error': f'Error reading file: {e}'
                    }
            
            elif os.path.isdir(file_path):
                # List directory contents
                try:
                    items = sorted(os.listdir(file_path))
                    return {
                        'path': file_path,
                        'type': 'directory',
                        'exists': True,
                        'content': items,
                        'count': len(items)
                    }
                except Exception as e:
                    return {
                        'path': file_path,
                        'exists': False,
                        'error': f'Error listing directory: {e}'
                    }
            
            else:
                return {
                    'path': file_path,
                    'exists': False,
                    'error': 'Path does not exist'
                }
        
        except Exception as e:
            return {
                'path': file_path,
                'exists': False,
                'error': f'Unexpected error: {e}'
            }
    
    def _is_safe_path(self, path: str) -> bool:
        """Check if a path is safe to access"""
        # Basic security checks
        if '..' in path or path.startswith('/'):
            return False
        
        # Only allow paths within the project directory
        try:
            abs_path = os.path.abspath(path)
            project_root = '/Users/928546/Desktop/tangent'
            return abs_path.startswith(project_root)
        except:
            return False
    
    def _get_command_help(self, command: str) -> str:
        """Get detailed help for a specific command"""
        help_texts = {
            '/bug': "Report a bug or issue\nUsage: /bug <description>\nExample: /bug The file upload is not working",
            '/clear': "Clear the current conversation\nUsage: /clear\nThis will start a fresh conversation",
            '/config': "View or modify configuration\nUsage: /config [key] [value]\nExamples:\n  /config - show all settings\n  /config model - show current model\n  /config model claude-3-opus - set model",
            '/sessions': "List recent sessions\nUsage: /sessions\nShows active and recent sessions that can be resumed",
            '/mcp': "Manage MCP servers\nUsage: /mcp [action] [server]\nActions: list, start, stop\nExample: /mcp start filesystem",
            '/tools': "List available tools\nUsage: /tools\nShows all built-in and MCP tools available for use"
        }
        
        return help_texts.get(command, f"No detailed help available for {command}")
    
    def register_command(self, command: str, handler) -> bool:
        """Register a custom slash command"""
        if command in self.commands:
            return False  # Command already exists
        
        self.commands[command] = handler
        return True
    
    def unregister_command(self, command: str) -> bool:
        """Unregister a slash command"""
        if command not in self.commands:
            return False
        
        del self.commands[command]
        return True