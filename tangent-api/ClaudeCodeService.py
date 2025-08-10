import asyncio
import json
import subprocess
import threading
import time
import signal
from typing import Dict, List, Optional, AsyncIterator
from datetime import datetime
import uuid
import os
from ToolCallService import ToolCallService
from ChatPersistenceService import db, Node

class ClaudeCodeService:
    """Service for managing Claude Code SDK instances and their lifecycle"""
    
    def __init__(self, app, tool_call_service: ToolCallService):
        self.app = app
        self.tool_call_service = tool_call_service
        self.active_instances = {}  # {instance_id: ClaudeCodeInstance}
        self.session_history = {}  # {session_id: session_data}
        
    async def create_instance(self, config: Dict) -> str:
        """Create a new Claude Code instance"""
        instance_id = str(uuid.uuid4())
        
        instance = ClaudeCodeInstance(
            instance_id=instance_id,
            config=config,
            tool_call_service=self.tool_call_service,
            app=self.app
        )
        
        self.active_instances[instance_id] = instance
        
        # Start the instance
        await instance.start()
        
        return instance_id
    
    def create_instance_sync(self, config: Dict) -> str:
        """Create a new Claude Code instance (synchronous version)"""
        instance_id = str(uuid.uuid4())
        
        instance = ClaudeCodeInstance(
            instance_id=instance_id,
            config=config,
            tool_call_service=self.tool_call_service,
            app=self.app
        )
        
        self.active_instances[instance_id] = instance
        
        # Start the instance synchronously
        instance.start_sync()
        
        return instance_id
    
    async def get_instance_status(self, instance_id: str) -> Dict:
        """Get status of a Claude Code instance"""
        if instance_id not in self.active_instances:
            return {'error': 'Instance not found'}
        
        instance = self.active_instances[instance_id]
        return await instance.get_status()
    
    def get_instance_status_sync(self, instance_id: str) -> Dict:
        """Get status of a Claude Code instance (synchronous version)"""
        if instance_id not in self.active_instances:
            return {'error': 'Instance not found'}
        
        instance = self.active_instances[instance_id]
        return instance.get_status_sync()
    
    async def send_message(self, instance_id: str, message: str) -> bool:
        """Send a message to a Claude Code instance"""
        if instance_id not in self.active_instances:
            return False
        
        instance = self.active_instances[instance_id]
        return await instance.send_message(message)
    
    def send_message_sync(self, instance_id: str, message: str) -> bool:
        """Send a message to a Claude Code instance (synchronous version)"""
        if instance_id not in self.active_instances:
            return False
        
        instance = self.active_instances[instance_id]
        
        # Check if this is a slash command and handle it specially
        if self.is_slash_command(message):
            return self.handle_slash_command(instance_id, message)
        
        return instance.send_message_sync(message)
    
    def is_slash_command(self, message: str) -> bool:
        """Check if message is a slash command"""
        return message.strip().startswith('/')
    
    def handle_slash_command(self, instance_id: str, command: str) -> Dict:
        """Handle slash command execution"""
        if instance_id not in self.active_instances:
            return {'success': False, 'error': 'Instance not found'}
        
        instance = self.active_instances[instance_id]
        command = command.strip()
        
        # Parse command and parameters
        parts = command.split(' ', 1)
        cmd = parts[0]
        params = parts[1] if len(parts) > 1 else ''
        
        try:
            if cmd == '/config':
                return self.handle_config_command(instance, params)
            elif cmd == '/tools':
                return self.handle_tools_command(instance, params)
            elif cmd == '/help':
                return self.handle_help_command(instance, params)
            elif cmd == '/cost':
                return self.handle_cost_command(instance, params)
            elif cmd == '/clear':
                return self.handle_clear_command(instance, params)
            elif cmd == '/compact':
                return self.handle_compact_command(instance, params)
            elif cmd == '/mcp':
                return self.handle_mcp_command(instance, params)
            elif cmd == '/memory':
                return self.handle_memory_command(instance, params)
            else:
                # Pass unknown commands directly to Claude Code CLI
                return {'success': instance.send_message_sync(command)}
                
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def handle_config_command(self, instance, params: str) -> Dict:
        """Handle /config command"""
        config_info = {
            'model': instance.config.get('model', 'claude-3-5-sonnet-20241022'),
            'max_tokens': instance.config.get('max_tokens', 8192),
            'temperature': instance.config.get('temperature', 0.7),
            'tools_enabled': instance.config.get('tools', []),
            'mcp_enabled': instance.config.get('mcp', {}).get('enabled', False),
            'working_directory': instance.config.get('workingDirectory', os.getcwd()),
            'cost_limit': instance.config.get('costLimit', 5.0)
        }
        
        return {
            'success': True,
            'type': 'config',
            'data': config_info
        }
    
    def handle_tools_command(self, instance, params: str) -> Dict:
        """Handle /tools command"""
        available_tools = [
            {'name': 'Read', 'status': 'active', 'description': 'Read files from disk'},
            {'name': 'Write', 'status': 'active', 'description': 'Write files to disk'},
            {'name': 'Edit', 'status': 'active', 'description': 'Edit existing files'},
            {'name': 'Bash', 'status': 'active', 'description': 'Execute shell commands'},
            {'name': 'Grep', 'status': 'active', 'description': 'Search file contents'},
            {'name': 'Glob', 'status': 'active', 'description': 'Find files by patterns'}
        ]
        
        return {
            'success': True,
            'type': 'tools',
            'data': available_tools
        }
    
    def handle_help_command(self, instance, params: str) -> Dict:
        """Handle /help command"""
        help_info = {
            'commands': [
                '/config - Show current configuration',
                '/tools - List available tools',
                '/cost - Display usage costs',
                '/clear - Clear conversation history',
                '/compact - Compact conversation',
                '/mcp - Manage MCP servers',
                '/memory - Show memory usage',
                '/help - Show this help'
            ],
            'shortcuts': [
                'Shift+Tab - Switch mode',
                'Ctrl+C - Stop current operation',
                'Escape - Cancel input'
            ]
        }
        
        return {
            'success': True,
            'type': 'help',
            'data': help_info
        }
    
    def handle_cost_command(self, instance, params: str) -> Dict:
        """Handle /cost command"""
        # Mock cost data (would be real in production)
        cost_info = {
            'session_cost': 0.45,
            'total_cost': 2.34,
            'tokens_used': 12543,
            'tokens_limit': instance.config.get('max_tokens', 8192),
            'cost_limit': instance.config.get('costLimit', 5.0)
        }
        
        return {
            'success': True,
            'type': 'cost',
            'data': cost_info
        }
    
    def handle_clear_command(self, instance, params: str) -> Dict:
        """Handle /clear command"""
        # Clear instance conversation history
        instance.conversation_history = []
        
        return {
            'success': True,
            'type': 'clear',
            'data': {'message': 'Conversation history cleared'}
        }
    
    def handle_compact_command(self, instance, params: str) -> Dict:
        """Handle /compact command"""
        # Mock compaction (would compress conversation in real implementation)
        original_count = len(getattr(instance, 'conversation_history', []))
        compacted_count = max(1, original_count // 3)
        
        return {
            'success': True,
            'type': 'compact',
            'data': {
                'original_messages': original_count,
                'compacted_messages': compacted_count,
                'compression_ratio': f'{((original_count - compacted_count) / original_count * 100):.1f}%' if original_count > 0 else '0%'
            }
        }
    
    def handle_mcp_command(self, instance, params: str) -> Dict:
        """Handle /mcp command"""
        # Mock MCP server data
        mcp_servers = [
            {'name': 'filesystem', 'status': 'connected', 'tools': 5},
            {'name': 'browser', 'status': 'connected', 'tools': 8},
            {'name': 'database', 'status': 'disconnected', 'tools': 12}
        ]
        
        return {
            'success': True,
            'type': 'mcp',
            'data': mcp_servers
        }
    
    def handle_memory_command(self, instance, params: str) -> Dict:
        """Handle /memory command"""
        # Mock memory usage data
        memory_info = {
            'context_size': 4096,
            'tokens_used': 2048,
            'memory_usage': '12.5 MB',
            'context_items': [
                {'type': 'file', 'name': 'main.py', 'size': '2.1 KB'},
                {'type': 'conversation', 'name': 'Recent chat', 'size': '8.4 KB'},
                {'type': 'tools', 'name': 'Tool outputs', 'size': '1.9 KB'}
            ]
        }
        
        return {
            'success': True,
            'type': 'memory',
            'data': memory_info
        }
    
    async def pause_instance(self, instance_id: str) -> bool:
        """Pause a Claude Code instance"""
        if instance_id not in self.active_instances:
            return False
        
        instance = self.active_instances[instance_id]
        return await instance.pause()
    
    def pause_instance_sync(self, instance_id: str) -> bool:
        """Pause a Claude Code instance (synchronous version)"""
        if instance_id not in self.active_instances:
            return False
        
        instance = self.active_instances[instance_id]
        return instance.pause_sync()
    
    async def resume_instance(self, instance_id: str) -> bool:
        """Resume a paused Claude Code instance"""
        if instance_id not in self.active_instances:
            return False
        
        instance = self.active_instances[instance_id]
        return await instance.resume()
    
    def resume_instance_sync(self, instance_id: str) -> bool:
        """Resume a paused Claude Code instance (synchronous version)"""
        if instance_id not in self.active_instances:
            return False
        
        instance = self.active_instances[instance_id]
        return instance.resume_sync()
    
    async def stop_instance(self, instance_id: str) -> bool:
        """Stop a Claude Code instance"""
        if instance_id not in self.active_instances:
            return False
        
        instance = self.active_instances[instance_id]
        result = await instance.stop()
        
        # Store session history
        session_data = await instance.get_session_data()
        if session_data:
            self.session_history[session_data['session_id']] = session_data
        
        # Remove from active instances
        del self.active_instances[instance_id]
        
        return result
    
    def stop_instance_sync(self, instance_id: str) -> bool:
        """Stop a Claude Code instance (synchronous version)"""
        if instance_id not in self.active_instances:
            return False
        
        instance = self.active_instances[instance_id]
        result = instance.stop_sync()
        
        # Store session history
        session_data = instance.get_session_data_sync()
        if session_data:
            self.session_history[session_data['session_id']] = session_data
        
        # Remove from active instances
        del self.active_instances[instance_id]
        
        return result
    
    async def get_active_instances(self) -> List[Dict]:
        """Get all active Claude Code instances"""
        instances = []
        for instance_id, instance in self.active_instances.items():
            status = await instance.get_status()
            instances.append(status)
        return instances
    
    def get_active_instances_sync(self) -> List[Dict]:
        """Get all active Claude Code instances (synchronous version)"""
        instances = []
        for instance_id, instance in self.active_instances.items():
            # Get status synchronously and return directly
            status = instance.get_status_sync()
            instances.append(status)
        return instances
    
    def get_session_history(self) -> List[Dict]:
        """Get historical Claude Code sessions"""
        return list(self.session_history.values())
    
    async def resume_session(self, session_id: str, config: Dict = None) -> str:
        """Resume a previous Claude Code session"""
        if session_id not in self.session_history:
            raise ValueError(f"Session {session_id} not found")
        
        session_data = self.session_history[session_id]
        
        # Create new instance with session data
        instance_config = config or {}
        instance_config['resume_session'] = session_id
        instance_config['session_data'] = session_data
        
        return await self.create_instance(instance_config)
    
    def resume_session_sync(self, session_id: str, config: Dict = None) -> str:
        """Resume a previous Claude Code session (synchronous version)"""
        if session_id not in self.session_history:
            raise ValueError(f"Session {session_id} not found")
        
        session_data = self.session_history[session_id]
        
        # Create new instance with session data
        instance_config = config or {}
        instance_config['resume_session'] = session_id
        instance_config['session_data'] = session_data
        
        return self.create_instance_sync(instance_config)
    
    def register_external_instance(self, instance_id: str, config: Dict) -> str:
        """Register an external Claude Code instance that's already running"""
        # Create a mock instance to represent the external session
        instance = ExternalClaudeCodeInstance(
            instance_id=instance_id,
            config=config,
            app=self.app
        )
        
        self.active_instances[instance_id] = instance
        return instance_id

class ClaudeCodeInstance:
    """Individual Claude Code SDK instance"""
    
    def __init__(self, instance_id: str, config: Dict, tool_call_service: ToolCallService, app):
        self.instance_id = instance_id
        self.config = config
        self.tool_call_service = tool_call_service
        self.app = app
        self.process = None
        self.status = 'created'
        self.session_id = None
        self.working_dir = config.get('working_dir', os.getcwd())
        self.cost_usd = 0.0
        self.num_turns = 0
        self.start_time = None
        self.node_id = config.get('node_id')
        self.subscribers = []  # WebSocket connections to notify
        
    async def start(self):
        """Start the Claude Code instance"""
        try:
            self.status = 'starting'
            self.start_time = time.time()
            
            # Build Claude Code command
            cmd = self._build_command()
            
            # Start subprocess
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.PIPE,
                text=True,
                cwd=self.working_dir
            )
            
            self.status = 'running'
            
            # Start output monitoring in background
            threading.Thread(target=self._monitor_output, daemon=True).start()
            
        except Exception as e:
            self.status = 'error'
            raise e
    
    def start_sync(self):
        """Start the Claude Code instance (synchronous version)"""
        try:
            self.status = 'starting'
            self.start_time = time.time()
            
            # Build Claude Code command
            cmd = self._build_command()
            
            # Start subprocess
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.PIPE,
                text=True,
                cwd=self.working_dir
            )
            
            self.status = 'running'
            
            # Start output monitoring in background
            threading.Thread(target=self._monitor_output, daemon=True).start()
            
        except Exception as e:
            self.status = 'error'
            raise e
    
    async def send_message(self, message: str) -> bool:
        """Send a message to the Claude Code instance"""
        if self.process and self.process.stdin:
            try:
                # Send message directly to Claude Code CLI
                self.process.stdin.write(message + '\n')
                self.process.stdin.flush()
                return True
            except Exception:
                return False
        return False
    
    def send_message_sync(self, message: str) -> bool:
        """Send a message to the Claude Code instance (synchronous version)"""
        if self.process and self.process.stdin:
            try:
                # Send message directly to Claude Code CLI
                self.process.stdin.write(message + '\n')
                self.process.stdin.flush()
                return True
            except Exception:
                return False
        return False
    
    async def pause(self) -> bool:
        """Pause the Claude Code instance"""
        if self.process:
            try:
                self.process.send_signal(signal.SIGSTOP)
                self.status = 'paused'
                return True
            except Exception:
                return False
        return False
    
    def pause_sync(self) -> bool:
        """Pause the Claude Code instance (synchronous version)"""
        if self.process:
            try:
                self.process.send_signal(signal.SIGSTOP)
                self.status = 'paused'
                return True
            except Exception:
                return False
        return False
    
    async def resume(self) -> bool:
        """Resume the paused Claude Code instance"""
        if self.process:
            try:
                self.process.send_signal(signal.SIGCONT)
                self.status = 'running'
                return True
            except Exception:
                return False
        return False
    
    def resume_sync(self) -> bool:
        """Resume the paused Claude Code instance (synchronous version)"""
        if self.process:
            try:
                self.process.send_signal(signal.SIGCONT)
                self.status = 'running'
                return True
            except Exception:
                return False
        return False
    
    async def stop(self) -> bool:
        """Stop the Claude Code instance"""
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
                self.status = 'stopped'
                return True
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.status = 'killed'
                return True
            except Exception:
                return False
        return False
    
    def stop_sync(self) -> bool:
        """Stop the Claude Code instance (synchronous version)"""
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
                self.status = 'stopped'
                return True
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.status = 'killed'
                return True
            except Exception:
                return False
        return False
    
    async def get_status(self) -> Dict:
        """Get current instance status"""
        duration_ms = int((time.time() - self.start_time) * 1000) if self.start_time else 0
        
        return {
            'instance_id': self.instance_id,
            'status': self.status,
            'session_id': self.session_id,
            'cost_usd': self.cost_usd,
            'num_turns': self.num_turns,
            'duration_ms': duration_ms,
            'working_dir': self.working_dir,
            'node_id': self.node_id,
            'config': self.config
        }
    
    def get_status_sync(self) -> Dict:
        """Get current instance status (synchronous version)"""
        duration_ms = int((time.time() - self.start_time) * 1000) if self.start_time else 0
        
        return {
            'instance_id': self.instance_id,
            'status': self.status,
            'session_id': self.session_id,
            'cost_usd': self.cost_usd,
            'num_turns': self.num_turns,
            'duration_ms': duration_ms,
            'working_dir': self.working_dir,
            'node_id': self.node_id,
            'config': self.config
        }
    
    async def get_session_data(self) -> Dict:
        """Get session data for persistence"""
        if not self.session_id:
            return None
        
        return {
            'session_id': self.session_id,
            'instance_id': self.instance_id,
            'config': self.config,
            'cost_usd': self.cost_usd,
            'num_turns': self.num_turns,
            'working_dir': self.working_dir,
            'created_at': datetime.fromtimestamp(self.start_time).isoformat() if self.start_time else None,
            'final_status': self.status
        }
    
    def get_session_data_sync(self) -> Dict:
        """Get session data for persistence (synchronous version)"""
        if not self.session_id:
            return None
        
        return {
            'session_id': self.session_id,
            'instance_id': self.instance_id,
            'config': self.config,
            'cost_usd': self.cost_usd,
            'num_turns': self.num_turns,
            'working_dir': self.working_dir,
            'created_at': datetime.fromtimestamp(self.start_time).isoformat() if self.start_time else None,
            'final_status': self.status
        }
    
    def subscribe(self, websocket):
        """Subscribe to instance updates"""
        self.subscribers.append(websocket)
    
    def unsubscribe(self, websocket):
        """Unsubscribe from instance updates"""
        if websocket in self.subscribers:
            self.subscribers.remove(websocket)
    
    def _build_command(self) -> List[str]:
        """Build Claude Code command with options"""
        cmd = ['claude']
        
        # Add initial prompt if provided
        initial_prompt = self.config.get('initial_prompt')
        if initial_prompt:
            cmd.append(initial_prompt)
        
        # Add max turns if specified
        max_turns = self.config.get('max_turns')
        if max_turns:
            cmd.extend(['--max-turns', str(max_turns)])
        
        # Add system prompt if specified
        system_prompt = self.config.get('system_prompt')
        if system_prompt:
            cmd.extend(['--system-prompt', system_prompt])
        
        # Add allowed tools if specified
        allowed_tools = self.config.get('allowed_tools', [])
        if allowed_tools:
            cmd.extend(['--allowed-tools', ','.join(allowed_tools)])
        
        # Add MCP config if specified
        mcp_config = self.config.get('mcp_config')
        if mcp_config:
            cmd.extend(['--mcp-config', mcp_config])
        
        # Add resume session if specified
        resume_session = self.config.get('resume_session')
        if resume_session:
            cmd.extend(['--resume', resume_session])
        
        return cmd
    
    def _monitor_output(self):
        """Monitor Claude Code output in background thread"""
        try:
            while self.process and self.process.poll() is None:
                line = self.process.stdout.readline()
                if line:
                    self._process_output_line(line.strip())
                time.sleep(0.1)
        except Exception as e:
            print(f"Error monitoring output: {e}")
    
    def _process_output_line(self, line: str):
        """Process a single output line from Claude Code"""
        try:
            # Try to parse as JSON first
            data = json.loads(line)
            
            # Handle different message types
            if data.get('type') == 'system' and data.get('subtype') == 'init':
                self.session_id = data.get('session_id')
                self._notify_subscribers('init', data)
            
            elif data.get('type') == 'assistant':
                self._handle_assistant_message(data)
            
            elif data.get('type') == 'result':
                self._handle_result_message(data)
            
            # Always notify subscribers of new data
            self._notify_subscribers('message', data)
            
        except json.JSONDecodeError:
            # Non-JSON output, treat as raw text
            # Check if it's a tool call pattern
            if self._is_tool_call_pattern(line):
                self._handle_tool_call_text(line)
            else:
                self._notify_subscribers('raw_output', {'text': line})
    
    def _handle_assistant_message(self, data: Dict):
        """Handle assistant message and extract tool calls"""
        message = data.get('message', {})
        content = message.get('content', [])
        
        for item in content:
            if item.get('type') == 'tool_use':
                self._handle_tool_use(item)
    
    def _handle_tool_use(self, tool_use: Dict):
        """Handle tool use and create tool call records"""
        if not self.node_id:
            return
        
        tool_name = tool_use.get('name')
        tool_input = tool_use.get('input', {})
        
        # Create tool call record
        tool_call_id = self.tool_call_service.create_tool_call(
            node_id=self.node_id,
            tool_name=tool_name,
            parameters=tool_input
        )
        
        # Execute tool based on type
        try:
            if tool_name == 'Read':
                result = self.tool_call_service.execute_read_tool(
                    tool_call_id, tool_input.get('file_path')
                )
            elif tool_name == 'Write':
                result = self.tool_call_service.execute_write_tool(
                    tool_call_id, tool_input.get('file_path'), tool_input.get('content')
                )
            elif tool_name == 'Bash':
                result = self.tool_call_service.execute_bash_tool(
                    tool_call_id, tool_input.get('command'), self.working_dir
                )
            
            # Notify subscribers of tool execution
            self._notify_subscribers('tool_call', {
                'tool_call_id': tool_call_id,
                'tool_name': tool_name,
                'status': 'success',
                'result': result
            })
            
        except Exception as e:
            self._notify_subscribers('tool_call', {
                'tool_call_id': tool_call_id,
                'tool_name': tool_name,
                'status': 'error',
                'error': str(e)
            })
    
    def _handle_result_message(self, data: Dict):
        """Handle final result message"""
        self.cost_usd = data.get('total_cost_usd', 0.0)
        self.num_turns = data.get('num_turns', 0)
        
        subtype = data.get('subtype')
        if subtype == 'success':
            self.status = 'completed'
        elif subtype in ['error_max_turns', 'error_during_execution']:
            self.status = 'error'
    
    def _notify_subscribers(self, event_type: str, data: Dict):
        """Notify all WebSocket subscribers of an event"""
        message = {
            'instance_id': self.instance_id,
            'event_type': event_type,
            'data': data,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Remove dead connections
        active_subscribers = []
        for ws in self.subscribers:
            try:
                ws.send(json.dumps(message))
                active_subscribers.append(ws)
            except:
                pass  # Connection is dead
        
        self.subscribers = active_subscribers
    
    def _is_tool_call_pattern(self, line: str) -> bool:
        """Check if line contains tool call pattern"""
        # Simple pattern matching for tool calls
        tool_patterns = [
            'Read(', 'Write(', 'Bash(', 'Edit(', 'Glob(', 'Grep('
        ]
        return any(pattern in line for pattern in tool_patterns)
    
    def _handle_tool_call_text(self, line: str):
        """Handle tool call from text output"""
        # Parse tool call from text format
        # This is a simplified parser - in practice you'd need more robust parsing
        try:
            if 'Read(' in line:
                # Extract file path from Read call
                start = line.find('Read(') + 5
                end = line.find(')', start)
                if end > start:
                    file_path = line[start:end].strip('"\'')
                    self._create_and_execute_tool_call('Read', {'file_path': file_path})
            
            elif 'Write(' in line:
                # Extract file path and content from Write call
                # This is simplified - real implementation would need better parsing
                self._notify_subscribers('raw_output', {'text': line, 'type': 'tool_call'})
            
            elif 'Bash(' in line:
                # Extract command from Bash call
                start = line.find('Bash(') + 5
                end = line.find(')', start)
                if end > start:
                    command = line[start:end].strip('"\'')
                    self._create_and_execute_tool_call('Bash', {'command': command})
            
        except Exception as e:
            print(f"Error parsing tool call: {e}")
    
    def _create_and_execute_tool_call(self, tool_name: str, parameters: Dict):
        """Create and execute a tool call"""
        if not self.node_id:
            return
        
        try:
            tool_call_id = self.tool_call_service.create_tool_call(
                node_id=self.node_id,
                tool_name=tool_name,
                parameters=parameters
            )
            
            # Execute tool based on type
            if tool_name == 'Read':
                result = self.tool_call_service.execute_read_tool(
                    tool_call_id, parameters.get('file_path')
                )
            elif tool_name == 'Write':
                result = self.tool_call_service.execute_write_tool(
                    tool_call_id, parameters.get('file_path'), parameters.get('content')
                )
            elif tool_name == 'Bash':
                result = self.tool_call_service.execute_bash_tool(
                    tool_call_id, parameters.get('command'), self.working_dir
                )
            
            # Notify subscribers
            self._notify_subscribers('tool_call', {
                'tool_call_id': tool_call_id,
                'tool_name': tool_name,
                'status': 'success',
                'result': result
            })
            
        except Exception as e:
            self._notify_subscribers('tool_call', {
                'tool_name': tool_name,
                'status': 'error',
                'error': str(e)
            })


class ExternalClaudeCodeInstance:
    """Represents an external Claude Code instance that's already running"""
    
    def __init__(self, instance_id: str, config: Dict, app):
        self.instance_id = instance_id
        self.config = config
        self.app = app
        self.status = 'running'  # Assume external instances are running
        self.session_id = config.get('session_id', 'external-session')
        self.working_dir = config.get('working_dir', '/Users/928546/Desktop/tangent')
        self.cost_usd = 0.0  # Unknown for external instances
        self.num_turns = 0  # Unknown for external instances
        self.start_time = time.time()  # Use current time as start
        self.node_id = config.get('node_id')
        self.subscribers = []
        
    def get_status_sync(self) -> Dict:
        """Get current instance status (synchronous version)"""
        duration_ms = int((time.time() - self.start_time) * 1000) if self.start_time else 0
        
        return {
            'instance_id': self.instance_id,
            'status': self.status,
            'session_id': self.session_id,
            'cost_usd': self.cost_usd,
            'num_turns': self.num_turns,
            'duration_ms': duration_ms,
            'working_dir': self.working_dir,
            'node_id': self.node_id,
            'config': self.config,
            'external': True
        }
    
    # External instances don't support these operations
    def send_message_sync(self, message: str) -> bool:
        return False
    
    def pause_sync(self) -> bool:
        return False
    
    def resume_sync(self) -> bool:
        return False
    
    def stop_sync(self) -> bool:
        # Remove from active instances when stopped
        return True
    
    def get_session_data_sync(self) -> Dict:
        return None
    
    def subscribe(self, websocket):
        self.subscribers.append(websocket)
    
    def unsubscribe(self, websocket):
        if websocket in self.subscribers:
            self.subscribers.remove(websocket)