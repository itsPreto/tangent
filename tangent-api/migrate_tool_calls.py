#!/usr/bin/env python3
"""
Migration script to scan existing Claude Code workspaces and create ToolCall records
for tools that were executed but not tracked in the database.
"""

import os
import sys
import json
import re
from datetime import datetime
from typing import Dict, List, Optional, Any

# Add the parent directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from ChatPersistenceService import db, Chat, Node, ToolCall
from ToolCallService import ToolCallService

class ToolCallMigrator:
    def __init__(self, app):
        self.app = app
        self.tool_call_service = ToolCallService(app)
        self.stats = {
            'chats_processed': 0,
            'nodes_processed': 0,
            'tool_calls_created': 0,
            'tool_calls_skipped': 0,
            'errors': []
        }
    
    def run_migration(self, dry_run: bool = False, report_mode: bool = False):
        """Run the full migration process"""
        if report_mode:
            print(f"📊 Running tool call report...")
            self.generate_tool_call_report()
        else:
            print(f"🚀 Starting tool call migration (dry_run={dry_run})")
            
            with self.app.app_context():
                # Get all chats
                chats = Chat.query.all()
                print(f"📊 Found {len(chats)} workspaces to process")
                
                for chat in chats:
                    self.process_chat(chat, dry_run)
                
                self.print_summary()
    
    def process_chat(self, chat: Chat, dry_run: bool = False):
        """Process a single chat/workspace"""
        print(f"\n📁 Processing workspace: {chat.title} (ID: {chat.id})")
        self.stats['chats_processed'] += 1
        
        # Get all nodes for this chat
        nodes = Node.query.filter_by(chat_id=chat.id).all()
        print(f"   Found {len(nodes)} nodes")
        
        for node in nodes:
            self.process_node(node, dry_run)
    
    def process_node(self, node: Node, dry_run: bool = False):
        """Process a single node and extract tool calls from messages"""
        self.stats['nodes_processed'] += 1
        
        if not node.messages:
            return
        
        print(f"   🔍 Processing node: {node.id} (type: {node.type})")
        
        # Check if this node already has tool call records
        existing_tool_calls = ToolCall.query.filter_by(node_id=node.id).count()
        if existing_tool_calls > 0:
            print(f"     ⏭️  Node already has {existing_tool_calls} tool call records, skipping")
            self.stats['tool_calls_skipped'] += existing_tool_calls
            return
        
        # Extract tool calls from messages
        tool_calls = self.extract_tool_calls_from_messages(node.messages, node.id)
        
        if tool_calls:
            print(f"     🔧 Found {len(tool_calls)} tool calls")
            
            for tool_call_data in tool_calls:
                if not dry_run:
                    self.create_tool_call_record(tool_call_data)
                else:
                    print(f"       [DRY RUN] Would create: {tool_call_data['tool_name']}")
                
                self.stats['tool_calls_created'] += 1
    
    def extract_tool_calls_from_messages(self, messages: List[Dict], node_id: str) -> List[Dict]:
        """Extract tool call information from message content"""
        tool_calls = []
        
        for i, message in enumerate(messages):
            if message.get('role') != 'assistant':
                continue
            
            content = message.get('content', '')
            if not content:
                continue
            
            # Look for tool usage patterns in assistant messages
            extracted_calls = self.parse_tool_usage_from_content(content, node_id, i)
            tool_calls.extend(extracted_calls)
            
            # Also check for tool_calls in message metadata if it exists
            if 'tool_calls' in message:
                for tool_call in message['tool_calls']:
                    tool_calls.append(self.format_tool_call_from_metadata(tool_call, node_id, i))
        
        return tool_calls
    
    def parse_tool_usage_from_content(self, content: str, node_id: str, message_index: int) -> List[Dict]:
        """Parse tool usage from assistant message content using patterns"""
        tool_calls = []
        
        # Pattern 1: <function_calls> blocks (Claude Code format)
        antml_pattern = r'<function_calls>\s*<invoke name="([^"]+)">\s*(.*?)\s*</invoke>\s*</function_calls>'
        matches = re.finditer(antml_pattern, content, re.DOTALL)
        
        for match in matches:
            tool_name = match.group(1)
            params_text = match.group(2)
            
            # Parse parameters
            parameters = self.parse_parameters_from_text(params_text)
            
            tool_calls.append({
                'node_id': node_id,
                'tool_name': tool_name,
                'parameters': parameters,
                'status': 'success',  # Assume success if it was in conversation
                'message_index': message_index,
                'created_at': datetime.utcnow()
            })
        
        # Pattern 2: Direct tool mentions (fallback)
        tool_patterns = {
            'Read': r'Read\s+tool.*?file_path.*?["\']([^"\']+)["\']',
            'Write': r'Write\s+tool.*?file_path.*?["\']([^"\']+)["\']',
            'Edit': r'Edit\s+tool.*?file_path.*?["\']([^"\']+)["\']',
            'Bash': r'Bash\s+tool.*?command.*?["\']([^"\']+)["\']',
            'WebFetch': r'WebFetch\s+tool.*?url.*?["\']([^"\']+)["\']',
            'WebSearch': r'WebSearch\s+tool.*?query.*?["\']([^"\']+)["\']',
            'Grep': r'Grep\s+tool.*?pattern.*?["\']([^"\']+)["\']',
            'Glob': r'Glob\s+tool.*?pattern.*?["\']([^"\']+)["\']',
            'Task': r'Task\s+tool.*?description.*?["\']([^"\']+)["\']',
        }
        
        for tool_name, pattern in tool_patterns.items():
            matches = re.finditer(pattern, content, re.IGNORECASE | re.DOTALL)
            for match in matches:
                main_param = match.group(1)
                
                # Create basic parameters based on tool type
                parameters = self.create_basic_parameters(tool_name, main_param)
                
                tool_calls.append({
                    'node_id': node_id,
                    'tool_name': tool_name,
                    'parameters': parameters,
                    'status': 'success',
                    'message_index': message_index,
                    'created_at': datetime.utcnow()
                })
        
        return tool_calls
    
    def parse_parameters_from_text(self, params_text: str) -> Dict:
        """Parse parameters from function call text"""
        parameters = {}
        
        # Look for parameter patterns like <parameter name="file_path">value</parameter>
        param_pattern = r'<parameter name="([^"]+)">([^<]+)</parameter>'
        matches = re.finditer(param_pattern, params_text)
        
        for match in matches:
            param_name = match.group(1)
            param_value = match.group(2).strip()
            
            # Try to parse as JSON if it looks like JSON
            if param_value.startswith(('{', '[', '"')) or param_value in ('true', 'false', 'null'):
                try:
                    parameters[param_name] = json.loads(param_value)
                except json.JSONDecodeError:
                    parameters[param_name] = param_value
            else:
                parameters[param_name] = param_value
        
        return parameters
    
    def create_basic_parameters(self, tool_name: str, main_param: str) -> Dict:
        """Create basic parameters for a tool based on its type"""
        if tool_name in ('Read', 'Write', 'Edit'):
            return {'file_path': main_param}
        elif tool_name == 'Bash':
            return {'command': main_param}
        elif tool_name == 'WebFetch':
            return {'url': main_param}
        elif tool_name == 'WebSearch':
            return {'query': main_param}
        elif tool_name in ('Grep', 'Glob'):
            return {'pattern': main_param}
        elif tool_name == 'Task':
            return {'description': main_param}
        else:
            return {'value': main_param}
    
    def format_tool_call_from_metadata(self, tool_call: Dict, node_id: str, message_index: int) -> Dict:
        """Format tool call from message metadata"""
        return {
            'node_id': node_id,
            'tool_name': tool_call.get('name', 'Unknown'),
            'parameters': tool_call.get('parameters', {}),
            'status': 'success',
            'message_index': message_index,
            'created_at': datetime.utcnow()
        }
    
    def create_tool_call_record(self, tool_call_data: Dict):
        """Create a ToolCall record in the database"""
        try:
            tool_call = ToolCall(
                node_id=tool_call_data['node_id'],
                tool_name=tool_call_data['tool_name'],
                parameters=tool_call_data['parameters'],
                status=tool_call_data['status'],
                created_at=tool_call_data['created_at'],
                updated_at=tool_call_data['created_at']
            )
            
            db.session.add(tool_call)
            db.session.commit()
            
            print(f"       ✅ Created ToolCall: {tool_call_data['tool_name']} (ID: {tool_call.id})")
            
        except Exception as e:
            error_msg = f"Failed to create ToolCall for {tool_call_data['tool_name']}: {str(e)}"
            print(f"       ❌ {error_msg}")
            self.stats['errors'].append(error_msg)
            db.session.rollback()
    
    def print_summary(self):
        """Print migration summary"""
        print(f"\n📊 Migration Summary:")
        print(f"   Workspaces processed: {self.stats['chats_processed']}")
        print(f"   Nodes processed: {self.stats['nodes_processed']}")
        print(f"   Tool calls created: {self.stats['tool_calls_created']}")
        print(f"   Tool calls skipped: {self.stats['tool_calls_skipped']}")
        print(f"   Errors: {len(self.stats['errors'])}")
        
        if self.stats['errors']:
            print(f"\n❌ Errors encountered:")
            for error in self.stats['errors']:
                print(f"   - {error}")
    
    def generate_tool_call_report(self):
        """Generate a detailed report of tool calls per workspace"""
        with self.app.app_context():
            # Get all chats
            chats = Chat.query.all()
            total_workspaces = len(chats)
            workspaces_with_tools = 0
            all_tool_calls = {}
            tool_call_counts = {}
            
            print(f"\n📊 Analyzing {total_workspaces} workspaces...\n")
            
            for chat in chats:
                # Get all tool calls for this workspace
                tool_calls = db.session.query(ToolCall).join(Node).filter(
                    Node.chat_id == chat.id
                ).all()
                
                if tool_calls:
                    workspaces_with_tools += 1
                    all_tool_calls[chat.id] = {
                        'title': chat.title,
                        'tool_calls': tool_calls
                    }
                    
                    # Count tool types
                    for tool_call in tool_calls:
                        tool_name = tool_call.tool_name
                        if tool_name not in tool_call_counts:
                            tool_call_counts[tool_name] = 0
                        tool_call_counts[tool_name] += 1
            
            # Print summary
            print(f"📈 SUMMARY:")
            print(f"   Total workspaces: {total_workspaces}")
            print(f"   Workspaces with tool calls: {workspaces_with_tools}")
            print(f"   Workspaces without tool calls: {total_workspaces - workspaces_with_tools}")
            
            # Print tool call distribution
            print(f"\n🔧 TOOL CALL DISTRIBUTION:")
            for tool_name, count in sorted(tool_call_counts.items(), key=lambda x: x[1], reverse=True):
                print(f"   {tool_name}: {count}")
            
            # Print detailed workspace list
            print(f"\n📋 WORKSPACES WITH TOOL CALLS:\n")
            for chat_id, data in all_tool_calls.items():
                print(f"📁 Workspace: {data['title']} (ID: {chat_id})")
                print(f"   Total tool calls: {len(data['tool_calls'])}")
                
                # Group by tool name
                tools_by_name = {}
                for tool_call in data['tool_calls']:
                    tool_name = tool_call.tool_name
                    if tool_name not in tools_by_name:
                        tools_by_name[tool_name] = []
                    tools_by_name[tool_name].append(tool_call)
                
                # Print tool calls grouped by name
                for tool_name, calls in sorted(tools_by_name.items()):
                    print(f"   🔧 {tool_name}: {len(calls)} calls")
                    for i, call in enumerate(calls[:5]):  # Show first 5 of each type
                        params_preview = str(call.parameters)[:60] + '...' if len(str(call.parameters)) > 60 else str(call.parameters)
                        print(f"      [{i+1}] Node: {call.node_id[:8]}... | Status: {call.status} | Params: {params_preview}")
                    if len(calls) > 5:
                        print(f"      ... and {len(calls) - 5} more")
                print()  # Empty line between workspaces


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate tool calls from existing workspaces')
    parser.add_argument('--dry-run', action='store_true', help='Run in dry-run mode (don\'t create records)')
    parser.add_argument('--workspace-id', help='Process only a specific workspace ID')
    parser.add_argument('--report', action='store_true', help='Generate a report of tool calls per workspace')
    args = parser.parse_args()
    
    # Create Flask app (minimal setup)
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chats.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize database
    db.init_app(app)
    
    # Create migrator and run
    migrator = ToolCallMigrator(app)
    
    if args.report:
        # Generate report mode
        migrator.run_migration(dry_run=args.dry_run, report_mode=True)
    elif args.workspace_id:
        # Process single workspace
        with app.app_context():
            chat = Chat.query.get(args.workspace_id)
            if chat:
                print(f"Processing single workspace: {chat.title}")
                migrator.process_chat(chat, args.dry_run)
                migrator.print_summary()
            else:
                print(f"❌ Workspace {args.workspace_id} not found")
    else:
        # Process all workspaces
        migrator.run_migration(args.dry_run)


if __name__ == '__main__':
    main()