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
    
    def execute_glob_tool(self, tool_call_id: str, pattern: str, path: str = '.') -> Dict:
        """Execute Glob tool for pattern-based file searching"""
        import glob
        start_time = time.time()
        
        try:
            # Security check - ensure path is within allowed directories
            if not self._is_path_allowed(path):
                raise PermissionError(f"Access denied to path: {path}")
            
            # Execute glob pattern
            full_pattern = os.path.join(path, pattern) if path != '.' else pattern
            matches = glob.glob(full_pattern, recursive=True)
            
            # Format results with file stats
            results = []
            for match in sorted(matches):
                try:
                    stat = os.stat(match)
                    results.append({
                        "path": match,
                        "type": "file" if os.path.isfile(match) else "directory",
                        "size": stat.st_size,
                        "modified": stat.st_mtime
                    })
                except OSError:
                    # Handle broken symlinks or permission issues
                    continue
            
            result = {
                "matches": results,
                "count": len(results),
                "pattern": pattern,
                "search_path": path,
                "success": True
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
    
    def execute_grep_tool(self, tool_call_id: str, pattern: str, path: str = '.', **options) -> Dict:
        """Execute Grep tool for content searching with regex"""
        import re
        start_time = time.time()
        
        try:
            # Security check - ensure path is within allowed directories
            if not self._is_path_allowed(path):
                raise PermissionError(f"Access denied to path: {path}")
            
            # Parse options
            case_insensitive = options.get('-i', False)
            output_mode = options.get('output_mode', 'files_with_matches')
            glob_pattern = options.get('glob', None)
            file_type = options.get('type', None)
            context_after = options.get('-A', 0)
            context_before = options.get('-B', 0)
            context_around = options.get('-C', 0)
            show_line_numbers = options.get('-n', False)
            head_limit = options.get('head_limit', None)
            multiline = options.get('multiline', False)
            
            # If -C is set, it overrides -A and -B
            if context_around > 0:
                context_after = context_before = context_around
            
            # Compile regex pattern
            flags = re.IGNORECASE if case_insensitive else 0
            if multiline:
                flags |= re.MULTILINE | re.DOTALL
            regex = re.compile(pattern, flags)
            
            # Determine files to search
            if os.path.isfile(path):
                files_to_search = [path]
            else:
                files_to_search = self._find_files_to_search(path, glob_pattern, file_type)
            
            # Search files
            results = []
            total_matches = 0
            
            for file_path in files_to_search:
                if head_limit and len(results) >= head_limit:
                    break
                    
                try:
                    file_matches = self._search_file_content(file_path, regex, output_mode, 
                                                           context_before, context_after, 
                                                           show_line_numbers, multiline)
                    if file_matches:
                        results.append(file_matches)
                        total_matches += file_matches.get('match_count', 0)
                except (OSError, UnicodeDecodeError):
                    # Skip files that can't be read
                    continue
            
            result = {
                "pattern": pattern,
                "search_path": path,
                "output_mode": output_mode,
                "total_matches": total_matches,
                "files_searched": len(files_to_search),
                "files_with_matches": len(results),
                "results": results[:head_limit] if head_limit else results,
                "success": True
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
    
    def execute_edit_tool(self, tool_call_id: str, file_path: str, old_string: str, new_string: str, replace_all: bool = False) -> Dict:
        """Execute Edit tool for in-place file editing"""
        start_time = time.time()
        
        try:
            # Security check - ensure path is within allowed directories
            if not self._is_path_allowed(file_path):
                raise PermissionError(f"Access denied to path: {file_path}")
            
            # Validate file exists
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")
            
            # Read current content
            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            # Validate old_string exists
            if old_string not in original_content:
                raise ValueError(f"String not found in file: {old_string[:50]}...")
            
            # Validate old_string != new_string
            if old_string == new_string:
                raise ValueError("old_string and new_string must be different")
            
            # Perform replacement
            if replace_all:
                new_content = original_content.replace(old_string, new_string)
                replacements = original_content.count(old_string)
            else:
                # Check if old_string is unique
                if original_content.count(old_string) > 1:
                    raise ValueError("String appears multiple times in file. Use replace_all=True or provide more context.")
                new_content = original_content.replace(old_string, new_string, 1)
                replacements = 1
            
            # Write new content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            # Calculate stats
            file_size = os.path.getsize(file_path)
            content_hash = hashlib.sha256(new_content.encode()).hexdigest()
            
            result = {
                'file_path': file_path,
                'replacements_made': replacements,
                'old_string': old_string,
                'new_string': new_string,
                'replace_all': replace_all,
                'file_size': file_size,
                'content_hash': content_hash,
                'lines': len(new_content.splitlines()),
                'success': True
            }
            
            # Create FileNode for tracking
            with self.app.app_context():
                tool_call = ToolCall.query.get(tool_call_id)
                if tool_call:
                    file_node = FileNode(
                        node_id=tool_call.node_id,
                        file_path=file_path,
                        file_size=file_size,
                        content_hash=content_hash,
                        mime_type=self._get_mime_type(file_path),
                        modified_by=tool_call_id
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
    
    def execute_multiedit_tool(self, tool_call_id: str, file_path: str, edits: List[Dict]) -> Dict:
        """Execute MultiEdit tool for multiple file edits"""
        start_time = time.time()
        
        try:
            # Security check - ensure path is within allowed directories
            if not self._is_path_allowed(file_path):
                raise PermissionError(f"Access denied to path: {file_path}")
            
            # If file doesn't exist and first edit has empty old_string, create new file
            if not os.path.exists(file_path) and edits and edits[0].get('old_string') == '':
                # Create new file
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(edits[0]['new_string'])
                edits = edits[1:]  # Skip first edit since it was creating the file
                
            elif not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")
            
            # Read current content
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Apply edits sequentially
            successful_edits = []
            for i, edit in enumerate(edits):
                old_string = edit['old_string']
                new_string = edit['new_string']
                replace_all = edit.get('replace_all', False)
                
                # Validate old_string != new_string
                if old_string == new_string:
                    raise ValueError(f"Edit {i+1}: old_string and new_string must be different")
                
                # Validate old_string exists
                if old_string not in content:
                    raise ValueError(f"Edit {i+1}: String not found in file: {old_string[:50]}...")
                
                # Perform replacement
                if replace_all:
                    new_content = content.replace(old_string, new_string)
                    replacements = content.count(old_string)
                else:
                    # Check if old_string is unique
                    if content.count(old_string) > 1:
                        raise ValueError(f"Edit {i+1}: String appears multiple times. Use replace_all=True or provide more context.")
                    new_content = content.replace(old_string, new_string, 1)
                    replacements = 1
                
                content = new_content
                successful_edits.append({
                    'edit_number': i + 1,
                    'replacements': replacements,
                    'old_string': old_string,
                    'new_string': new_string
                })
            
            # Write final content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # Calculate stats
            file_size = os.path.getsize(file_path)
            content_hash = hashlib.sha256(content.encode()).hexdigest()
            
            result = {
                'file_path': file_path,
                'edits_applied': len(successful_edits),
                'edits_details': successful_edits,
                'file_size': file_size,
                'content_hash': content_hash,
                'lines': len(content.splitlines()),
                'success': True
            }
            
            # Create FileNode for tracking
            with self.app.app_context():
                tool_call = ToolCall.query.get(tool_call_id)
                if tool_call:
                    file_node = FileNode(
                        node_id=tool_call.node_id,
                        file_path=file_path,
                        file_size=file_size,
                        content_hash=content_hash,
                        mime_type=self._get_mime_type(file_path),
                        modified_by=tool_call_id
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
    
    def execute_ls_tool(self, tool_call_id: str, path: str, ignore: List[str] = None) -> Dict:
        """Execute LS tool for directory listing"""
        import fnmatch
        start_time = time.time()
        
        try:
            # Security check - ensure path is within allowed directories
            if not self._is_path_allowed(path):
                raise PermissionError(f"Access denied to path: {path}")
            
            # Validate path exists
            if not os.path.exists(path):
                raise FileNotFoundError(f"Path not found: {path}")
            
            # Get directory listing
            if os.path.isfile(path):
                # If path is a file, return file info
                stat = os.stat(path)
                result = {
                    'path': path,
                    'type': 'file',
                    'entries': [{
                        'name': os.path.basename(path),
                        'path': path,
                        'type': 'file',
                        'size': stat.st_size,
                        'modified': stat.st_mtime,
                        'permissions': oct(stat.st_mode)[-3:]
                    }],
                    'total_entries': 1,
                    'success': True
                }
            else:
                # Directory listing
                entries = []
                ignore_patterns = ignore or []
                
                for item in sorted(os.listdir(path)):
                    # Check ignore patterns
                    if any(fnmatch.fnmatch(item, pattern) for pattern in ignore_patterns):
                        continue
                    
                    item_path = os.path.join(path, item)
                    try:
                        stat = os.stat(item_path)
                        entries.append({
                            'name': item,
                            'path': item_path,
                            'type': 'directory' if os.path.isdir(item_path) else 'file',
                            'size': stat.st_size if os.path.isfile(item_path) else None,
                            'modified': stat.st_mtime,
                            'permissions': oct(stat.st_mode)[-3:]
                        })
                    except OSError:
                        # Handle broken symlinks or permission issues
                        continue
                
                result = {
                    'path': path,
                    'type': 'directory',
                    'entries': entries,
                    'total_entries': len(entries),
                    'ignored_patterns': ignore_patterns,
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
    
    def execute_todowrite_tool(self, tool_call_id: str, todos: List[Dict]) -> Dict:
        """Execute TodoWrite tool for task management"""
        start_time = time.time()
        
        try:
            # Validate todos format
            for i, todo in enumerate(todos):
                required_fields = ['content', 'status', 'priority', 'id']
                for field in required_fields:
                    if field not in todo:
                        raise ValueError(f"Todo {i+1}: Missing required field '{field}'")
                
                # Validate status
                if todo['status'] not in ['pending', 'in_progress', 'completed']:
                    raise ValueError(f"Todo {i+1}: Invalid status '{todo['status']}'")
                
                # Validate priority
                if todo['priority'] not in ['high', 'medium', 'low']:
                    raise ValueError(f"Todo {i+1}: Invalid priority '{todo['priority']}'")
            
            # Store todos in session (in a real implementation, this would go to a database)
            result = {
                'todos': todos,
                'total_todos': len(todos),
                'pending_count': len([t for t in todos if t['status'] == 'pending']),
                'in_progress_count': len([t for t in todos if t['status'] == 'in_progress']),
                'completed_count': len([t for t in todos if t['status'] == 'completed']),
                'high_priority_count': len([t for t in todos if t['priority'] == 'high']),
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
    
    def _is_path_allowed(self, path: str) -> bool:
        """Check if path is within allowed directories for security"""
        # For now, allow paths within the project directory
        # In production, this should be more restrictive
        try:
            # Get absolute path and resolve symlinks
            abs_path = os.path.abspath(path)
            project_root = '/Users/928546/Desktop/tangent'
            
            # Check if path is within project directory
            return abs_path.startswith(project_root)
        except:
            return False
    
    def _find_files_to_search(self, path: str, glob_pattern: str = None, file_type: str = None) -> List[str]:
        """Find files to search based on glob pattern or file type"""
        import glob
        import fnmatch
        
        files = []
        
        if os.path.isfile(path):
            return [path]
        
        # Map file types to extensions
        type_extensions = {
            'js': ['*.js', '*.jsx'],
            'ts': ['*.ts', '*.tsx'],
            'py': ['*.py'],
            'vue': ['*.vue'],
            'html': ['*.html', '*.htm'],
            'css': ['*.css', '*.scss', '*.sass'],
            'json': ['*.json'],
            'md': ['*.md', '*.markdown'],
            'txt': ['*.txt'],
            'yaml': ['*.yml', '*.yaml'],
            'xml': ['*.xml'],
            'sql': ['*.sql'],
            'sh': ['*.sh', '*.bash'],
            'java': ['*.java'],
            'cpp': ['*.cpp', '*.c', '*.h'],
            'go': ['*.go'],
            'rust': ['*.rs']
        }
        
        # Get patterns to match
        if glob_pattern:
            patterns = [glob_pattern]
        elif file_type and file_type in type_extensions:
            patterns = type_extensions[file_type]
        else:
            # Default to common text file patterns
            patterns = ['*']
        
        # Search for files
        for pattern in patterns:
            search_pattern = os.path.join(path, '**', pattern)
            matches = glob.glob(search_pattern, recursive=True)
            files.extend([f for f in matches if os.path.isfile(f)])
        
        return list(set(files))  # Remove duplicates
    
    def _search_file_content(self, file_path: str, regex, output_mode: str, 
                           context_before: int, context_after: int, 
                           show_line_numbers: bool, multiline: bool) -> Dict:
        """Search content within a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except (OSError, UnicodeDecodeError):
            return None
        
        if output_mode == 'files_with_matches':
            # Just check if file has matches
            if regex.search(content):
                return {
                    'file_path': file_path,
                    'match_count': len(regex.findall(content))
                }
            return None
        
        elif output_mode == 'count':
            matches = regex.findall(content)
            if matches:
                return {
                    'file_path': file_path,
                    'match_count': len(matches)
                }
            return None
        
        elif output_mode == 'content':
            lines = content.splitlines()
            matching_lines = []
            total_matches = 0
            
            for line_num, line in enumerate(lines, 1):
                if regex.search(line):
                    total_matches += len(regex.findall(line))
                    
                    # Calculate context range
                    start_line = max(0, line_num - 1 - context_before)
                    end_line = min(len(lines), line_num + context_after)
                    
                    # Get context lines
                    context_lines = []
                    for i in range(start_line, end_line):
                        prefix = f"{i+1:>4}: " if show_line_numbers else ""
                        marker = ">" if i == line_num - 1 else " "
                        context_lines.append(f"{marker}{prefix}{lines[i]}")
                    
                    matching_lines.append({
                        'line_number': line_num,
                        'line': line,
                        'context': context_lines
                    })
            
            if matching_lines:
                return {
                    'file_path': file_path,
                    'match_count': total_matches,
                    'matching_lines': matching_lines
                }
            return None
        
        return None