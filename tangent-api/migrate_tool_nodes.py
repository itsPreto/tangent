#!/usr/bin/env python3
"""
Migration script to convert existing tool-call branch nodes to compact tool nodes.
This script updates the database to use the new memory-efficient compact node format.
"""

import sqlite3
import json
import math
from datetime import datetime

def calculate_compact_position(parent_x, parent_y, index, radius_base=150, nodes_per_ring=6):
    """Calculate position for compact tool node in spiral pattern around parent."""
    ring = index // nodes_per_ring
    position_in_ring = index % nodes_per_ring
    
    radius = radius_base + (ring * 60)  # Increase radius for each ring
    angle = (position_in_ring * (2 * math.pi / nodes_per_ring))
    
    x = parent_x + math.cos(angle) * radius
    y = parent_y + math.sin(angle) * radius
    
    return x, y

def get_tool_call_info(node_metadata, title, node_type):
    """Extract tool call information from node metadata and title."""
    tool_call = {
        'id': f'migrated-{node_type}',
        'tool_name': 'Unknown',
        'parameters': {},
        'result': None,
        'status': 'success',  # Assume completed for existing nodes
        'duration_ms': None
    }
    
    # Parse tool information from different node types
    if node_type == 'tool':
        if node_metadata and 'tool_name' in node_metadata:
            tool_call['tool_name'] = node_metadata['tool_name']
        
        # Extract tool info from title
        if 'Write:' in title:
            tool_call['tool_name'] = 'Write'
            if 'filePath' in node_metadata:
                tool_call['parameters'] = {'file_path': node_metadata['filePath']}
        elif 'Bash:' in title:
            tool_call['tool_name'] = 'Bash'
            if 'command' in node_metadata:
                tool_call['parameters'] = {'command': node_metadata['command']}
        elif 'Todo List' in title:
            tool_call['tool_name'] = 'TodoWrite'
            if 'todos' in node_metadata:
                tool_call['result'] = {'todos': node_metadata['todos']}
    
    elif 'claude_code' in node_type:
        # Convert Claude Code specific node types
        tool_call['tool_name'] = 'Task'
        if 'agent' in node_type:
            tool_call['parameters'] = {'description': 'Claude Code Agent Task'}
        elif 'file' in node_type:
            tool_call['tool_name'] = 'Read' if 'read' in title.lower() else 'Write'
        elif 'search' in node_type:
            tool_call['tool_name'] = 'Grep'
        elif 'planning' in node_type:
            tool_call['parameters'] = {'description': 'Planning Task'}
        elif 'system' in node_type:
            tool_call['tool_name'] = 'Bash'
        elif 'todo' in node_type:
            tool_call['tool_name'] = 'TodoWrite'
        elif 'web' in node_type:
            tool_call['tool_name'] = 'WebFetch'
    
    elif node_type in ['file-read', 'file-write', 'file-edit']:
        tool_call['tool_name'] = 'Read' if 'read' in node_type else ('Edit' if 'edit' in node_type else 'Write')
    
    elif node_type == 'websearch':
        tool_call['tool_name'] = 'WebSearch'
    
    elif node_type == 'bash-execution':
        tool_call['tool_name'] = 'Bash'
    
    elif node_type == 'todowrite':
        tool_call['tool_name'] = 'TodoWrite'
    
    elif node_type == 'content-search':
        tool_call['tool_name'] = 'Grep'
    
    return tool_call

def migrate_tool_nodes():
    """Main migration function."""
    db_path = '/Users/928546/Desktop/tangent/tangent-api/instance/chats.db'
    
    # Tool-related node types to convert
    tool_node_types = [
        'tool',
        'claude_code_agent',
        'claude_code_agent_result', 
        'claude_code_file_operations',
        'claude_code_planning_operations',
        'claude_code_search_operations',
        'claude_code_system_operations',
        'claude_code_todo_operations',
        'claude_code_web_operations',
        'file-edit',
        'file-read',
        'file-write',
        'websearch',
        'bash-execution',
        'todowrite',
        'content-search'
    ]
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Backup the original data
        print("Creating backup of nodes table...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS nodes_backup_pre_migration AS 
            SELECT * FROM nodes WHERE 1=0
        ''')
        
        cursor.execute('INSERT INTO nodes_backup_pre_migration SELECT * FROM nodes')
        
        total_migrated = 0
        
        for node_type in tool_node_types:
            print(f"\nProcessing {node_type} nodes...")
            
            # Get all nodes of this type with their parent information
            cursor.execute('''
                SELECT n.id, n.parent_id, n.title, n.x, n.y, n.node_metadata,
                       p.x as parent_x, p.y as parent_y
                FROM nodes n
                LEFT JOIN nodes p ON n.parent_id = p.id  
                WHERE n.type = ?
            ''', (node_type,))
            
            nodes = cursor.fetchall()
            
            if not nodes:
                print(f"  No {node_type} nodes found")
                continue
                
            print(f"  Found {len(nodes)} {node_type} nodes to migrate")
            
            # Group nodes by parent to calculate spiral positions
            nodes_by_parent = {}
            for node in nodes:
                parent_id = node[1] or 'root'
                if parent_id not in nodes_by_parent:
                    nodes_by_parent[parent_id] = []
                nodes_by_parent[parent_id].append(node)
            
            for parent_id, parent_nodes in nodes_by_parent.items():
                for index, node in enumerate(parent_nodes):
                    node_id, parent_id, title, x, y, metadata_json, parent_x, parent_y = node
                    
                    try:
                        metadata = json.loads(metadata_json) if metadata_json else {}
                    except:
                        metadata = {}
                    
                    # Calculate new compact position
                    if parent_x is not None and parent_y is not None:
                        new_x, new_y = calculate_compact_position(parent_x, parent_y, index)
                    else:
                        # If no parent, keep original position but make it compact
                        new_x, new_y = x, y
                    
                    # Create tool call information
                    tool_call = get_tool_call_info(metadata, title, node_type)
                    tool_call['id'] = node_id  # Use node ID as tool call ID
                    
                    # Update the node
                    new_metadata = {
                        'toolCall': tool_call,
                        'isTemporary': True,
                        'migrated_from': node_type,
                        'migration_date': datetime.now().isoformat()
                    }
                    
                    cursor.execute('''
                        UPDATE nodes 
                        SET type = 'tool-call-compact',
                            x = ?,
                            y = ?,
                            node_metadata = ?
                        WHERE id = ?
                    ''', (new_x, new_y, json.dumps(new_metadata), node_id))
                    
                    total_migrated += 1
        
        print(f"\n✅ Migration completed! {total_migrated} nodes migrated to tool-call-compact format")
        print(f"✅ Original data backed up to nodes_backup_pre_migration table")
        
        # Verify the migration
        cursor.execute("SELECT COUNT(*) FROM nodes WHERE type = 'tool-call-compact'")
        compact_count = cursor.fetchone()[0]
        print(f"✅ Database now has {compact_count} tool-call-compact nodes")
        
        conn.commit()
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    
    finally:
        conn.close()

def rollback_migration():
    """Rollback function to restore original data if needed."""
    db_path = '/Users/928546/Desktop/tangent/tangent-api/instance/chats.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if backup exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes_backup_pre_migration'")
        if not cursor.fetchone():
            print("❌ No backup table found. Cannot rollback.")
            return
        
        print("Rolling back migration...")
        
        # Delete migrated nodes
        cursor.execute("DELETE FROM nodes WHERE type = 'tool-call-compact'")
        
        # Restore from backup (only the ones we migrated)
        cursor.execute('''
            INSERT INTO nodes 
            SELECT * FROM nodes_backup_pre_migration 
            WHERE type IN (
                'tool', 'claude_code_agent', 'claude_code_agent_result', 
                'claude_code_file_operations', 'claude_code_planning_operations',
                'claude_code_search_operations', 'claude_code_system_operations',
                'claude_code_todo_operations', 'claude_code_web_operations',
                'file-edit', 'file-read', 'file-write', 'websearch', 
                'bash-execution', 'todowrite', 'content-search'
            )
        ''')
        
        conn.commit()
        print("✅ Migration rolled back successfully")
        
    except Exception as e:
        print(f"❌ Rollback failed: {e}")
        conn.rollback()
        raise
    
    finally:
        conn.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'rollback':
        rollback_migration()
    else:
        print("🔄 Starting tool node migration...")
        print("This will convert existing tool-related nodes to the new compact format.")
        
        response = input("Continue? (y/N): ")
        if response.lower() == 'y':
            migrate_tool_nodes()
        else:
            print("Migration cancelled.")