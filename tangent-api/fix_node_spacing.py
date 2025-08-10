#!/usr/bin/env python3
"""
Fix node spacing in the database to ensure all nodes are at least 5 grid dots (250px) apart.
"""

import sqlite3
import math
import uuid
from datetime import datetime

# Constants
MIN_DISTANCE = 250  # 5 grid dots * 50px per dot
STEP_SIZE = 50      # 1 grid dot
MAX_ATTEMPTS = 100  # Maximum attempts to find free position

def calculate_distance(x1, y1, x2, y2):
    """Calculate Euclidean distance between two points."""
    return math.sqrt((x2 - x1)**2 + (y2 - y1)**2)

def find_overlapping_nodes(cursor):
    """Find all pairs of nodes that are closer than MIN_DISTANCE."""
    query = """
    SELECT 
        n1.id as node1_id,
        n1.title as node1_title,
        n1.x as node1_x,
        n1.y as node1_y,
        n2.id as node2_id,
        n2.title as node2_title,
        n2.x as node2_x,
        n2.y as node2_y,
        SQRT(POWER(n1.x - n2.x, 2) + POWER(n1.y - n2.y, 2)) as distance
    FROM nodes n1 
    JOIN nodes n2 ON n1.id < n2.id
    WHERE SQRT(POWER(n1.x - n2.x, 2) + POWER(n1.y - n2.y, 2)) < ?
    ORDER BY distance
    """
    
    cursor.execute(query, (MIN_DISTANCE,))
    return cursor.fetchall()

def get_all_nodes(cursor):
    """Get all nodes with their positions."""
    cursor.execute("SELECT id, title, x, y FROM nodes ORDER BY created_at")
    return cursor.fetchall()

def is_position_free(cursor, x, y, exclude_ids=None):
    """Check if a position is free from other nodes."""
    if exclude_ids is None:
        exclude_ids = []
    
    placeholders = ','.join(['?' for _ in exclude_ids])
    query = f"""
    SELECT id FROM nodes 
    WHERE id NOT IN ({placeholders if exclude_ids else 'SELECT NULL WHERE 1=0'})
    """
    
    cursor.execute(query, exclude_ids)
    existing_nodes = cursor.fetchall()
    
    for node in existing_nodes:
        cursor.execute("SELECT x, y FROM nodes WHERE id = ?", (node[0],))
        node_pos = cursor.fetchone()
        if node_pos:
            distance = calculate_distance(x, y, node_pos[0], node_pos[1])
            if distance < MIN_DISTANCE:
                return False
    return True

def find_free_position(cursor, target_x, target_y, exclude_ids=None):
    """Find a free position near the target coordinates."""
    if exclude_ids is None:
        exclude_ids = []
    
    # First try the target position
    if is_position_free(cursor, target_x, target_y, exclude_ids):
        return target_x, target_y
    
    # Search in expanding circles around the target position
    for radius in range(STEP_SIZE, MAX_ATTEMPTS * STEP_SIZE, STEP_SIZE):
        # Try positions around the circle at this radius
        num_positions = max(8, int(radius / STEP_SIZE * 2))
        
        for i in range(num_positions):
            angle = (i / num_positions) * 2 * math.pi
            test_x = target_x + math.cos(angle) * radius
            test_y = target_y + math.sin(angle) * radius
            
            if is_position_free(cursor, test_x, test_y, exclude_ids):
                return test_x, test_y
    
    # If no free position found, return original position with a large offset
    print(f"Warning: No free position found for ({target_x}, {target_y}), using offset")
    return target_x + MAX_ATTEMPTS * STEP_SIZE, target_y

def fix_node_spacing(db_path):
    """Fix spacing for all nodes in the database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Analyzing current node spacing...")
        overlapping = find_overlapping_nodes(cursor)
        
        if not overlapping:
            print("✅ All nodes are properly spaced! No fixes needed.")
            return
        
        print(f"❌ Found {len(overlapping)} pairs of nodes that are too close together.")
        
        # Get all nodes sorted by creation date (older nodes get priority)
        all_nodes = get_all_nodes(cursor)
        print(f"📊 Total nodes to process: {len(all_nodes)}")
        
        updated_count = 0
        processed_ids = set()
        
        for node in all_nodes:
            node_id, title, x, y = node
            
            if node_id in processed_ids:
                continue
                
            # Check if this node needs repositioning
            if not is_position_free(cursor, x, y, [node_id]):
                print(f"🔄 Repositioning '{title}' from ({x:.1f}, {y:.1f})")
                
                # Find a new position
                new_x, new_y = find_free_position(cursor, x, y, list(processed_ids) + [node_id])
                
                # Update the node position
                cursor.execute("""
                    UPDATE nodes 
                    SET x = ?, y = ? 
                    WHERE id = ?
                """, (new_x, new_y, node_id))
                
                print(f"   ➡️ Moved to ({new_x:.1f}, {new_y:.1f})")
                updated_count += 1
            
            processed_ids.add(node_id)
        
        # Commit changes
        conn.commit()
        
        print(f"\n✅ Fixed spacing for {updated_count} nodes.")
        
        # Verify the fix
        print("\n🔍 Verifying fix...")
        overlapping_after = find_overlapping_nodes(cursor)
        
        if overlapping_after:
            print(f"⚠️  Still have {len(overlapping_after)} overlapping pairs:")
            for pair in overlapping_after[:5]:  # Show first 5
                print(f"   '{pair[1]}' and '{pair[5]}': {pair[8]:.1f}px apart")
        else:
            print("🎉 All nodes are now properly spaced!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    db_path = "instance/chats.db"
    print("🔧 Starting node spacing fix...")
    print(f"📁 Database: {db_path}")
    print(f"📏 Minimum distance: {MIN_DISTANCE}px ({MIN_DISTANCE/50} grid dots)")
    print()
    
    fix_node_spacing(db_path)