#!/usr/bin/env python3
"""
Comprehensive tool node fix script.
Handles all faulty compact nodes in one go.
"""

import sqlite3
import json
import uuid
from datetime import datetime

def fix_all_tool_nodes():
    """Fix all tool nodes comprehensively."""
    
    # Connect to database
    conn = sqlite3.connect('instance/chats.db')
    cursor = conn.cursor()
    
    print("Starting comprehensive tool node fix...")
    
    # Get all current compact nodes
    cursor.execute("""
        SELECT id, node_metadata 
        FROM nodes 
        WHERE type = 'tool-call-compact'
    """)
    
    compact_nodes = cursor.fetchall()
    print(f"Found {len(compact_nodes)} compact nodes to check")
    
    # Get backup data mapping
    cursor.execute("""
        SELECT id, type, node_metadata 
        FROM nodes_backup_pre_migration 
        WHERE type IN ('bash-execution', 'file-read', 'file-write', 'file-edit', 'websearch', 'content-search')
    """)
    
    backup_nodes = {row[0]: (row[1], row[2]) for row in cursor.fetchall()}
    print(f"Found {len(backup_nodes)} backup nodes with data")
    
    fixed_count = 0
    created_count = 0
    
    for node_id, metadata_str in compact_nodes:
        try:
            metadata = json.loads(metadata_str)
            
            # Case 1: Node has incomplete metadata structure
            if 'toolCall' not in metadata:
                print(f"Creating toolCall structure for node {node_id}")
                
                # Check if we have backup data
                if node_id in backup_nodes:
                    backup_type, backup_metadata_str = backup_nodes[node_id]
                    backup_metadata = json.loads(backup_metadata_str)
                    
                    # Create proper toolCall structure
                    tool_name = backup_metadata.get('tool_name') or get_tool_name_from_type(backup_type)
                    parameters = extract_parameters(backup_type, backup_metadata)
                    
                    metadata['toolCall'] = {
                        'id': node_id,
                        'tool_name': tool_name,
                        'parameters': parameters,
                        'result': None,
                        'status': 'success',
                        'duration_ms': None,
                        'created_at': datetime.now().isoformat(),
                        'updated_at': datetime.now().isoformat()
                    }
                    created_count += 1
                else:
                    # No backup data, create minimal structure
                    metadata['toolCall'] = {
                        'id': node_id,
                        'tool_name': 'Unknown',
                        'parameters': {'note': 'No backup data available'},
                        'result': None,
                        'status': 'success',
                        'duration_ms': None,
                        'created_at': datetime.now().isoformat(),
                        'updated_at': datetime.now().isoformat()
                    }
                    created_count += 1
            
            # Case 2: Node has toolCall but missing/wrong tool_name or empty parameters
            elif metadata['toolCall'].get('tool_name') == 'Unknown' or not metadata['toolCall'].get('parameters'):
                if node_id in backup_nodes:
                    backup_type, backup_metadata_str = backup_nodes[node_id]
                    backup_metadata = json.loads(backup_metadata_str)
                    
                    # Update with correct data
                    tool_name = backup_metadata.get('tool_name') or get_tool_name_from_type(backup_type)
                    parameters = extract_parameters(backup_type, backup_metadata)
                    
                    metadata['toolCall']['tool_name'] = tool_name
                    metadata['toolCall']['parameters'] = parameters
                    metadata['toolCall']['updated_at'] = datetime.now().isoformat()
                    
                    fixed_count += 1
            
            # Update the node in database
            updated_metadata = json.dumps(metadata)
            cursor.execute("""
                UPDATE nodes 
                SET node_metadata = ? 
                WHERE id = ?
            """, (updated_metadata, node_id))
            
        except Exception as e:
            print(f"Error processing node {node_id}: {e}")
            continue
    
    # Commit changes
    conn.commit()
    conn.close()
    
    print(f"\nFixed {fixed_count} existing toolCall structures")
    print(f"Created {created_count} new toolCall structures")
    print("Comprehensive tool node fix completed!")

def get_tool_name_from_type(backup_type):
    """Map backup type to proper tool name."""
    type_mapping = {
        'websearch': 'WebSearch',
        'bash-execution': 'Bash', 
        'file-read': 'Read',
        'file-write': 'Write',
        'file-edit': 'Edit',
        'content-search': 'Grep'
    }
    return type_mapping.get(backup_type, 'Unknown')

def extract_parameters(backup_type, backup_metadata):
    """Extract parameters based on backup type and metadata."""
    parameters = {}
    
    # Check if this is minimal data
    if len(backup_metadata) == 1 and 'type' in backup_metadata:
        parameters['note'] = f'Incomplete data - only type {backup_metadata["type"]} available'
        parameters['type'] = backup_metadata['type']
        return parameters
    
    # Extract based on tool type
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
    
    # Copy any other relevant fields
    for key, value in backup_metadata.items():
        if key not in ['tool_name'] and key not in parameters:
            if key == 'filePath':
                parameters['file_path'] = value
            elif key == 'oldString':
                parameters['old_string'] = value
            elif key == 'newString':
                parameters['new_string'] = value
            elif key in ['query', 'pattern', 'command', 'description', 'timeout', 'path', 'type', 'glob', 'output_mode']:
                parameters[key] = value
    
    return parameters

if __name__ == "__main__":
    fix_all_tool_nodes()