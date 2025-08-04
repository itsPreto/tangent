#!/usr/bin/env python3
"""
Quick rollback script for the tool node migration.
This will restore the original tool nodes if needed.
"""

import sqlite3

def rollback_migration():
    """Rollback the tool node migration."""
    db_path = '/Users/928546/Desktop/tangent/tangent-api/instance/chats.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if backup exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes_backup_pre_migration'")
        if not cursor.fetchone():
            print("❌ No backup table found. Cannot rollback.")
            return
        
        print("🔄 Rolling back tool node migration...")
        
        # Get count of nodes to be restored
        cursor.execute("SELECT COUNT(*) FROM nodes WHERE type = 'tool-call-compact'")
        compact_count = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM nodes_backup_pre_migration 
            WHERE type IN (
                'tool', 'claude_code_agent', 'claude_code_agent_result', 
                'claude_code_file_operations', 'claude_code_planning_operations',
                'claude_code_search_operations', 'claude_code_system_operations',
                'claude_code_todo_operations', 'claude_code_web_operations',
                'file-edit', 'file-read', 'file-write', 'websearch', 
                'bash-execution', 'todowrite', 'content-search'
            )
        """)
        backup_count = cursor.fetchone()[0]
        
        print(f"Will remove {compact_count} compact nodes and restore {backup_count} original nodes")
        
        # Delete migrated nodes
        cursor.execute("DELETE FROM nodes WHERE type = 'tool-call-compact'")
        print(f"✅ Removed {compact_count} compact nodes")
        
        # Restore from backup
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
        
        print(f"✅ Restored {backup_count} original tool nodes")
        
        conn.commit()
        print("✅ Migration rolled back successfully!")
        print("⚠️  You may need to refresh your browser to see the changes")
        
    except Exception as e:
        print(f"❌ Rollback failed: {e}")
        conn.rollback()
        raise
    
    finally:
        conn.close()

if __name__ == "__main__":
    print("🚨 This will rollback the tool node migration to the old format")
    print("This will restore the memory-heavy branch nodes for tool calls")
    
    response = input("Are you sure you want to rollback? (y/N): ")
    if response.lower() == 'y':
        rollback_migration()
    else:
        print("Rollback cancelled.")