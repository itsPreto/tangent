#!/usr/bin/env python3
"""
LOD-aware node spacing fix to prevent overlapping at different zoom levels.
Adjusts minimum spacing based on node LOD (Level of Detail) dimensions.
"""

import sqlite3
import math
import uuid
from datetime import datetime

# LOD-aware spacing constants
LOD_SPACING_CONFIG = {
    'compact': {
        'node_size': 60,      # 60px × 60px nodes
        'min_distance': 250,  # 5 grid dots * 50px
        'description': 'Compact nodes at high zoom (>40%)'
    },
    'preview': {
        'node_size': 480,     # 480px × 120px nodes (use width as primary)
        'min_distance': 800,  # 16 grid dots * 50px
        'description': 'Preview nodes at medium zoom (10%-40%)'
    },
    'full': {
        'node_size': 672,     # 672px width nodes (height varies)
        'min_distance': 1200, # 24 grid dots * 50px  
        'description': 'Full nodes at low zoom (<10%)'
    }
}

STEP_SIZE = 50      # 1 grid dot
MAX_ATTEMPTS = 100  # Maximum attempts to find free position

def calculate_distance(x1, y1, x2, y2):
    """Calculate Euclidean distance between two points."""
    return math.sqrt((x2 - x1)**2 + (y2 - y1)**2)

def get_lod_level_for_zoom(zoom_level):
    """Determine LOD level based on zoom percentage."""
    if zoom_level >= 0.4:  # 40%+
        return 'compact'
    elif zoom_level >= 0.1:  # 10-40%
        return 'preview'
    else:  # <10%
        return 'full'

def get_min_distance_for_lod(lod_level):
    """Get minimum distance for a given LOD level."""
    return LOD_SPACING_CONFIG[lod_level]['min_distance']

def find_overlapping_nodes(cursor, lod_level='full'):
    """Find all pairs of nodes that are closer than the LOD-appropriate MIN_DISTANCE."""
    min_distance = get_min_distance_for_lod(lod_level)
    
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
    
    cursor.execute(query, (min_distance,))
    return cursor.fetchall()

def get_all_nodes(cursor):
    """Get all nodes with their positions."""
    cursor.execute("SELECT id, title, x, y FROM nodes ORDER BY created_at")
    return cursor.fetchall()

def is_position_free(cursor, x, y, lod_level='full', exclude_ids=None):
    """Check if a position is free from other nodes based on LOD spacing requirements."""
    if exclude_ids is None:
        exclude_ids = []
    
    min_distance = get_min_distance_for_lod(lod_level)
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
            if distance < min_distance:
                return False
    return True

def find_free_position(cursor, target_x, target_y, lod_level='full', exclude_ids=None):
    """Find a free position near the target coordinates based on LOD spacing."""
    if exclude_ids is None:
        exclude_ids = []
    
    min_distance = get_min_distance_for_lod(lod_level)
    
    # First try the target position
    if is_position_free(cursor, target_x, target_y, lod_level, exclude_ids):
        return target_x, target_y
    
    # Search in expanding circles around the target position
    # Use LOD-aware step size for more efficient search
    lod_step_size = max(STEP_SIZE, min_distance // 10)
    
    for radius in range(lod_step_size, MAX_ATTEMPTS * lod_step_size, lod_step_size):
        # Try positions around the circle at this radius
        num_positions = max(8, int(radius / lod_step_size * 2))
        
        for i in range(num_positions):
            angle = (i / num_positions) * 2 * math.pi
            test_x = target_x + math.cos(angle) * radius
            test_y = target_y + math.sin(angle) * radius
            
            if is_position_free(cursor, test_x, test_y, lod_level, exclude_ids):
                return test_x, test_y
    
    # If no free position found, return original position with a large offset
    print(f"Warning: No free position found for ({target_x}, {target_y}), using offset")
    return target_x + MAX_ATTEMPTS * lod_step_size, target_y

def fix_node_spacing_lod_aware(db_path, target_lod='full'):
    """Fix spacing for all nodes based on target LOD level requirements."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        min_distance = get_min_distance_for_lod(target_lod)
        config = LOD_SPACING_CONFIG[target_lod]
        
        print(f"Analyzing node spacing for LOD level: {target_lod}")
        print(f"Target spacing: {min_distance}px ({min_distance/50} grid dots)")
        print(f"Node dimensions: {config['node_size']}px")
        print(f"Description: {config['description']}")
        print()
        
        overlapping = find_overlapping_nodes(cursor, target_lod)
        
        if not overlapping:
            print(f"✅ All nodes are properly spaced for {target_lod} LOD! No fixes needed.")
            return
        
        print(f"❌ Found {len(overlapping)} pairs of nodes that are too close for {target_lod} LOD.")
        
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
            if not is_position_free(cursor, x, y, target_lod, [node_id]):
                print(f"🔄 Repositioning '{title}' from ({x:.1f}, {y:.1f})")
                
                # Find a new position
                new_x, new_y = find_free_position(cursor, x, y, target_lod, list(processed_ids) + [node_id])
                
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
        
        print(f"\n✅ Fixed spacing for {updated_count} nodes using {target_lod} LOD standards.")
        
        # Verify the fix
        print(f"\n🔍 Verifying {target_lod} LOD spacing fix...")
        overlapping_after = find_overlapping_nodes(cursor, target_lod)
        
        if overlapping_after:
            print(f"⚠️  Still have {len(overlapping_after)} overlapping pairs:")
            for pair in overlapping_after[:5]:  # Show first 5
                print(f"   '{pair[1]}' and '{pair[5]}': {pair[8]:.1f}px apart (need {min_distance}px)")
        else:
            print(f"🎉 All nodes are now properly spaced for {target_lod} LOD!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

def analyze_current_spacing(db_path):
    """Analyze current spacing against all LOD levels."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("📊 SPACING ANALYSIS FOR ALL LOD LEVELS")
        print("=" * 50)
        
        for lod_level, config in LOD_SPACING_CONFIG.items():
            print(f"\n{lod_level.upper()} LOD ({config['description']}):")
            print(f"  Required spacing: {config['min_distance']}px ({config['min_distance']/50} grid dots)")
            print(f"  Node size: {config['node_size']}px")
            
            overlapping = find_overlapping_nodes(cursor, lod_level)
            if overlapping:
                print(f"  ❌ {len(overlapping)} overlapping pairs")
                if len(overlapping) <= 3:
                    for pair in overlapping:
                        print(f"    '{pair[1]}' ↔ '{pair[5]}': {pair[8]:.1f}px apart")
            else:
                print(f"  ✅ All nodes properly spaced")
                
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    db_path = "instance/chats.db"
    
    print("🔧 LOD-AWARE NODE SPACING FIX")
    print(f"📁 Database: {db_path}")
    print()
    
    # First analyze current state
    analyze_current_spacing(db_path)
    
    print("\n" + "=" * 50)
    print("APPLYING FULL LOD SPACING (most conservative)")
    print("=" * 50)
    
    # Apply the most conservative spacing (full LOD)
    fix_node_spacing_lod_aware(db_path, 'full')