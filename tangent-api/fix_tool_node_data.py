#!/usr/bin/env python3
"""
Fix tool node data migration script.
Updates existing tool-call-compact nodes with proper parameters from the backup table.
"""

import sqlite3
import json
import uuid
from datetime import datetime

def fix_tool_node_data():
    """Fix the tool node data by properly extracting parameters from backup nodes."""
    
    # Connect to database
    conn = sqlite3.connect('instance/chats.db')
    cursor = conn.cursor()
    
    print("Starting tool node data fix...")
    
    # Get all current compact nodes that need fixing
    cursor.execute("""
        SELECT id, node_metadata 
        FROM nodes 
        WHERE type = 'tool-call-compact'
    """)
    
    compact_nodes = cursor.fetchall()
    print(f"Found {len(compact_nodes)} compact nodes to fix")
    
    # Get backup data mapping
    cursor.execute("""
        SELECT id, type, node_metadata 
        FROM nodes_backup_pre_migration 
        WHERE type IN ('bash-execution', 'file-read', 'file-write', 'file-edit', 'websearch', 'content-search')
    """)
    
    backup_nodes = {row[0]: (row[1], row[2]) for row in cursor.fetchall()}
    print(f"Found {len(backup_nodes)} backup nodes with data")
    
    updated_count = 0
    
    for node_id, metadata_str in compact_nodes:
        try:
            # Parse current metadata
            metadata = json.loads(metadata_str)
            
            # Check if this node was migrated and has empty parameters
            # Use the node ID itself to find the backup data
            if node_id in backup_nodes:
                backup_type, backup_metadata_str = backup_nodes[node_id]
                backup_metadata = json.loads(backup_metadata_str)
                
                # Extract tool information from backup
                tool_name = backup_metadata.get('tool_name')
                if not tool_name:
                    # Map backup type to tool name if tool_name is missing
                    type_to_tool_name = {
                        'websearch': 'WebSearch',
                        'bash-execution': 'Bash', 
                        'file-read': 'Read',
                        'file-write': 'Write',
                        'file-edit': 'Edit',
                        'content-search': 'Grep'
                    }
                    tool_name = type_to_tool_name.get(backup_type, 'Unknown')
                
                parameters = {}
                
                # Check if this is a minimal node with only type information
                if len(backup_metadata) == 1 and 'type' in backup_metadata:
                    # This node only has type info, add a note in parameters
                    parameters['note'] = f'Incomplete data - only type {backup_metadata["type"]} available'
                
                # Extract parameters based on tool type and backup metadata structure
                if backup_type == 'bash-execution':
                    if 'command' in backup_metadata:
                        parameters['command'] = backup_metadata['command']
                    if 'description' in backup_metadata:
                        parameters['description'] = backup_metadata['description']
                    if 'timeout' in backup_metadata and backup_metadata['timeout']:
                        parameters['timeout'] = backup_metadata['timeout']
                
                elif backup_type == 'file-read':
                    if 'filePath' in backup_metadata:
                        parameters['file_path'] = backup_metadata['filePath']
                    if 'offset' in backup_metadata and backup_metadata['offset']:
                        parameters['offset'] = backup_metadata['offset']
                    if 'limit' in backup_metadata and backup_metadata['limit']:
                        parameters['limit'] = backup_metadata['limit']
                
                elif backup_type == 'file-write':
                    if 'filePath' in backup_metadata:
                        parameters['file_path'] = backup_metadata['filePath']
                    if 'contentLength' in backup_metadata:
                        parameters['content_length'] = backup_metadata['contentLength']
                
                elif backup_type == 'file-edit':
                    if 'filePath' in backup_metadata:
                        parameters['file_path'] = backup_metadata['filePath']
                    if 'oldString' in backup_metadata:
                        parameters['old_string'] = backup_metadata['oldString']
                    if 'newString' in backup_metadata:
                        parameters['new_string'] = backup_metadata['newString']
                
                elif backup_type == 'websearch':
                    if 'query' in backup_metadata:
                        parameters['query'] = backup_metadata['query']
                    if 'allowedDomains' in backup_metadata:
                        parameters['allowed_domains'] = backup_metadata['allowedDomains']
                    if 'blockedDomains' in backup_metadata:
                        parameters['blocked_domains'] = backup_metadata['blockedDomains']
                
                elif backup_type == 'content-search':
                    if 'pattern' in backup_metadata:
                        parameters['pattern'] = backup_metadata['pattern']
                    if 'path' in backup_metadata:
                        parameters['path'] = backup_metadata['path']
                    if 'type' in backup_metadata:
                        parameters['type'] = backup_metadata['type']
                
                # Copy any other relevant fields directly
                for key, value in backup_metadata.items():
                    if key not in ['tool_name'] and key not in parameters:
                        # Map common field names
                        if key == 'filePath':
                            parameters['file_path'] = value
                        elif key == 'oldString':
                            parameters['old_string'] = value
                        elif key == 'newString':
                            parameters['new_string'] = value
                        elif key in ['query', 'pattern', 'command', 'description', 'timeout', 'path', 'type', 'glob', 'output_mode']:
                            parameters[key] = value
                
                # Update the toolCall with proper data
                metadata['toolCall']['tool_name'] = tool_name
                metadata['toolCall']['parameters'] = parameters
                metadata['toolCall']['created_at'] = datetime.now().isoformat()
                metadata['toolCall']['updated_at'] = datetime.now().isoformat()
                
                # Update the node in database
                updated_metadata = json.dumps(metadata)
                cursor.execute("""
                    UPDATE nodes 
                    SET node_metadata = ? 
                    WHERE id = ?
                """, (updated_metadata, node_id))
                
                updated_count += 1
                print(f"Updated node {node_id} ({tool_name}) with {len(parameters)} parameters")
        
        except Exception as e:
            print(f"Error processing node {node_id}: {e}")
            continue
    
    # Commit changes
    conn.commit()
    conn.close()
    
    print(f"\nFixed {updated_count} tool nodes with proper parameters")
    print("Tool node data fix completed!")

if __name__ == "__main__":
    fix_tool_node_data()