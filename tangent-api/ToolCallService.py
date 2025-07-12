from typing import Dict, List, Optional, Any
import json
import time
from datetime import datetime
from ChatPersistenceService import db, ToolCall, FileNode, ExecutionNode, Node
import uuid
import hashlib
import os
import subprocess
import threading

class ToolCallService:
    """Service for managing tool calls and their lifecycle"""
    
    def __init__(self, app):
        self.app = app
        self.active_executions = {}  # Track running processes
        
    def create_tool_call(self, node_id: str, tool_name: str, parameters: Dict) -> str:
        """Create a new tool call record"""
        with self.app.app_context():
            tool_call = ToolCall(
                id=str(uuid.uuid4()),
                node_id=node_id,
                tool_name=tool_name,
                parameters=parameters,
                status='pending'
            )
            db.session.add(tool_call)
            db.session.commit()
            return tool_call.id
    
    def update_tool_call_status(self, tool_call_id: str, status: str, result: Dict = None, error_message: str = None, duration_ms: int = None):
        """Update tool call status and result"""
        with self.app.app_context():
            tool_call = ToolCall.query.get(tool_call_id)
            if tool_call:
                tool_call.status = status
                tool_call.result = result
                tool_call.error_message = error_message
                tool_call.duration_ms = duration_ms
                tool_call.updated_at = datetime.utcnow()
                db.session.commit()
    
    def execute_read_tool(self, tool_call_id: str, file_path: str) -> Dict:
        """Execute Read tool call"""
        start_time = time.time()
        
        try:
            # Validate file exists and is readable
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")
            
            # Read file content
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Calculate file stats
            file_size = os.path.getsize(file_path)
            content_hash = hashlib.sha256(content.encode()).hexdigest()
            
            result = {
                'content': content,
                'file_path': file_path,
                'file_size': file_size,
                'content_hash': content_hash,
                'lines': len(content.splitlines()),
                'success': True
            }
            
            # Update tool call status
            duration_ms = int((time.time() - start_time) * 1000)
            self.update_tool_call_status(tool_call_id, 'success', result, duration_ms=duration_ms)
            
            return result
            
        except Exception as e:
            error_msg = str(e)
            duration_ms = int((time.time() - start_time) * 1000)
            self.update_tool_call_status(tool_call_id, 'error', error_message=error_msg, duration_ms=duration_ms)
            raise
    
    def execute_write_tool(self, tool_call_id: str, file_path: str, content: str) -> Dict:
        """Execute Write tool call"""
        start_time = time.time()
        
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            # Write file content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # Calculate file stats
            file_size = os.path.getsize(file_path)
            content_hash = hashlib.sha256(content.encode()).hexdigest()
            
            result = {
                'file_path': file_path,
                'file_size': file_size,
                'content_hash': content_hash,
                'lines': len(content.splitlines()),
                'success': True,
                'action': 'created' if not os.path.exists(file_path) else 'modified'
            }
            
            # Create or update FileNode
            with self.app.app_context():
                tool_call = ToolCall.query.get(tool_call_id)
                if tool_call:
                    file_node = FileNode(
                        node_id=tool_call.node_id,
                        file_path=file_path,
                        file_size=file_size,
                        content_hash=content_hash,
                        mime_type=self._get_mime_type(file_path),
                        created_by=tool_call_id
                    )
                    db.session.add(file_node)
                    db.session.commit()
            
            # Update tool call status
            duration_ms = int((time.time() - start_time) * 1000)
            self.update_tool_call_status(tool_call_id, 'success', result, duration_ms=duration_ms)
            
            return result
            
        except Exception as e:
            error_msg = str(e)
            duration_ms = int((time.time() - start_time) * 1000)
            self.update_tool_call_status(tool_call_id, 'error', error_message=error_msg, duration_ms=duration_ms)
            raise
    
    def execute_bash_tool(self, tool_call_id: str, command: str, working_dir: str = None) -> str:
        """Execute Bash tool call"""
        start_time = time.time()
        
        try:
            # Create ExecutionNode
            with self.app.app_context():
                tool_call = ToolCall.query.get(tool_call_id)
                if tool_call:
                    execution_node = ExecutionNode(
                        node_id=tool_call.node_id,
                        command=command,
                        working_dir=working_dir or os.getcwd(),
                        status='running',
                        started_by=tool_call_id
                    )
                    db.session.add(execution_node)
                    db.session.commit()
                    execution_id = execution_node.id
            
            # Execute command
            process = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=working_dir
            )
            
            # Store process for potential termination
            self.active_executions[execution_id] = process
            
            # Wait for completion
            stdout, stderr = process.communicate()
            exit_code = process.returncode
            
            # Update ExecutionNode
            with self.app.app_context():
                execution = ExecutionNode.query.get(execution_id)
                if execution:
                    execution.status = 'completed' if exit_code == 0 else 'failed'
                    execution.exit_code = exit_code
                    execution.stdout = stdout
                    execution.stderr = stderr
                    execution.updated_at = datetime.utcnow()
                    db.session.commit()
            
            # Clean up
            if execution_id in self.active_executions:
                del self.active_executions[execution_id]
            
            result = {
                'command': command,
                'exit_code': exit_code,
                'stdout': stdout,
                'stderr': stderr,
                'success': exit_code == 0,
                'execution_id': execution_id
            }
            
            # Update tool call status
            duration_ms = int((time.time() - start_time) * 1000)
            status = 'success' if exit_code == 0 else 'error'
            error_msg = stderr if exit_code != 0 else None
            self.update_tool_call_status(tool_call_id, status, result, error_message=error_msg, duration_ms=duration_ms)
            
            return execution_id
            
        except Exception as e:
            error_msg = str(e)
            duration_ms = int((time.time() - start_time) * 1000)
            self.update_tool_call_status(tool_call_id, 'error', error_message=error_msg, duration_ms=duration_ms)
            raise
    
    def get_tool_calls_for_node(self, node_id: str) -> List[Dict]:
        """Get all tool calls for a specific node"""
        with self.app.app_context():
            tool_calls = ToolCall.query.filter_by(node_id=node_id).order_by(ToolCall.created_at).all()
            return [self._serialize_tool_call(tc) for tc in tool_calls]
    
    def get_tool_call_details(self, tool_call_id: str) -> Dict:
        """Get detailed information about a specific tool call"""
        with self.app.app_context():
            tool_call = ToolCall.query.get(tool_call_id)
            if not tool_call:
                return None
            
            details = self._serialize_tool_call(tool_call)
            
            # Add related nodes
            if tool_call.tool_name == 'Write':
                details['created_files'] = [self._serialize_file_node(f) for f in tool_call.created_files]
            elif tool_call.tool_name == 'Bash':
                details['executions'] = [self._serialize_execution_node(e) for e in tool_call.started_executions]
            
            return details
    
    def get_file_nodes_for_node(self, node_id: str) -> List[Dict]:
        """Get all file nodes for a specific node"""
        with self.app.app_context():
            file_nodes = FileNode.query.filter_by(node_id=node_id).order_by(FileNode.created_at).all()
            return [self._serialize_file_node(fn) for fn in file_nodes]
    
    def get_execution_nodes_for_node(self, node_id: str) -> List[Dict]:
        """Get all execution nodes for a specific node"""
        with self.app.app_context():
            execution_nodes = ExecutionNode.query.filter_by(node_id=node_id).order_by(ExecutionNode.created_at).all()
            return [self._serialize_execution_node(en) for en in execution_nodes]
    
    def terminate_execution(self, execution_id: str) -> bool:
        """Terminate a running execution"""
        if execution_id in self.active_executions:
            try:
                process = self.active_executions[execution_id]
                process.terminate()
                
                # Update ExecutionNode status
                with self.app.app_context():
                    execution = ExecutionNode.query.get(execution_id)
                    if execution:
                        execution.status = 'killed'
                        execution.updated_at = datetime.utcnow()
                        db.session.commit()
                
                del self.active_executions[execution_id]
                return True
            except Exception:
                return False
        return False
    
    def _serialize_tool_call(self, tool_call: ToolCall) -> Dict:
        """Serialize a ToolCall object to dictionary"""
        return {
            'id': tool_call.id,
            'node_id': tool_call.node_id,
            'tool_name': tool_call.tool_name,
            'parameters': tool_call.parameters,
            'result': tool_call.result,
            'status': tool_call.status,
            'error_message': tool_call.error_message,
            'duration_ms': tool_call.duration_ms,
            'created_at': tool_call.created_at.isoformat(),
            'updated_at': tool_call.updated_at.isoformat()
        }
    
    def _serialize_file_node(self, file_node: FileNode) -> Dict:
        """Serialize a FileNode object to dictionary"""
        return {
            'id': file_node.id,
            'node_id': file_node.node_id,
            'file_path': file_node.file_path,
            'file_size': file_node.file_size,
            'content_hash': file_node.content_hash,
            'mime_type': file_node.mime_type,
            'created_by': file_node.created_by,
            'modified_by': file_node.modified_by,
            'created_at': file_node.created_at.isoformat(),
            'updated_at': file_node.updated_at.isoformat()
        }
    
    def _serialize_execution_node(self, execution_node: ExecutionNode) -> Dict:
        """Serialize an ExecutionNode object to dictionary"""
        return {
            'id': execution_node.id,
            'node_id': execution_node.node_id,
            'command': execution_node.command,
            'working_dir': execution_node.working_dir,
            'environment': execution_node.environment,
            'pid': execution_node.pid,
            'status': execution_node.status,
            'exit_code': execution_node.exit_code,
            'stdout': execution_node.stdout,
            'stderr': execution_node.stderr,
            'started_by': execution_node.started_by,
            'created_at': execution_node.created_at.isoformat(),
            'updated_at': execution_node.updated_at.isoformat()
        }
    
    def _get_mime_type(self, file_path: str) -> str:
        """Get MIME type for file based on extension"""
        ext = os.path.splitext(file_path)[1].lower()
        mime_types = {
            '.py': 'text/x-python',
            '.js': 'text/javascript',
            '.ts': 'text/typescript',
            '.vue': 'text/x-vue',
            '.html': 'text/html',
            '.css': 'text/css',
            '.json': 'application/json',
            '.md': 'text/markdown',
            '.txt': 'text/plain',
            '.yml': 'text/yaml',
            '.yaml': 'text/yaml',
            '.xml': 'text/xml',
            '.sql': 'text/x-sql',
            '.sh': 'text/x-shellscript',
            '.dockerfile': 'text/x-dockerfile'
        }
        return mime_types.get(ext, 'text/plain')