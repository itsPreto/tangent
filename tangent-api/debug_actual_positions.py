#!/usr/bin/env python3
"""
Debug Actual Node Positions

Shows the real positions of root nodes vs their assigned topics
to identify why nodes appear far from their topics in the UI.
"""

import sqlite3
import json
import math
import requests
from typing import Dict, List, Tuple
from collections import defaultdict

def fetch_clustering_data() -> Dict:
    """Fetch clustering data from the API."""
    try:
        response = requests.post(
            'http://127.0.0.1:5050/api/workspaces/cluster',
            json={'use_existing_data': True},
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"API returned status {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Failed to fetch clustering data: {e}")
        return None

def load_database_data(db_path: str = "instance/chats.db") -> Tuple[List[Dict], List[Dict]]:
    """Load workspace and root node data from database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Load all workspaces (chats)
        cursor.execute("SELECT id, title, x, y FROM chats ORDER BY created_at")
        workspace_rows = cursor.fetchall()
        
        workspaces = []
        for row in workspace_rows:
            workspaces.append({
                'id': row[0],
                'title': row[1] or f"Workspace {row[0][:8]}",
                'x': row[2] or 0,
                'y': row[3] or 0
            })
        
        # Load all ROOT nodes (nodes without parent_id)
        cursor.execute("""
            SELECT id, chat_id, x, y, title
            FROM nodes 
            WHERE parent_id IS NULL
            ORDER BY created_at
        """)
        root_node_rows = cursor.fetchall()
        
        root_nodes = []
        for row in root_node_rows:
            root_nodes.append({
                'id': row[0],
                'chat_id': row[1],
                'x': float(row[2]) if row[2] else 0,
                'y': float(row[3]) if row[3] else 0,
                'title': row[4] or ""
            })
        
        return workspaces, root_nodes
        
    finally:
        conn.close()

def calculate_distance(x1, y1, x2, y2):
    """Calculate Euclidean distance between two points."""
    return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

def debug_actual_positions():
    """Debug the actual positions and show discrepancies."""
    
    print("🔍 DEBUGGING ACTUAL NODE POSITIONS")
    print("=" * 60)
    
    # Fetch clustering data
    clustering_data = fetch_clustering_data()
    if not clustering_data:
        print("❌ Failed to get clustering data")
        return
    
    # Load database data
    workspaces, root_nodes = load_database_data()
    
    print(f"📊 Loaded {len(workspaces)} workspaces and {len(root_nodes)} root nodes")
    
    # Get positioning data
    topics = clustering_data['topics']
    topic_positions = clustering_data['topic_positions']
    workspace_positions = clustering_data['workspace_positions']
    
    print(f"📍 Topic positions from API:")
    for topic_id, pos in topic_positions.items():
        topic_name = topics[topic_id]['topic']
        print(f"   {topic_name}: ({pos['x']}, {pos['y']})")
    
    print(f"\n🔍 WORKSPACE TO ROOT NODE MAPPING:")
    print("-" * 60)
    
    # Group root nodes by workspace
    nodes_by_workspace = defaultdict(list)
    for node in root_nodes:
        if node['chat_id']:
            nodes_by_workspace[node['chat_id']].append(node)
    
    major_issues = []
    
    # Check each workspace assignment
    for workspace_idx, workspace in enumerate(workspaces):
        workspace_id = workspace['id']
        workspace_root_nodes = nodes_by_workspace.get(workspace_id, [])
        
        if not workspace_root_nodes:
            continue
        
        # Get orbital assignment
        orbital_data = workspace_positions.get(str(workspace_idx))
        if not orbital_data:
            print(f"⚠️  No orbital data for workspace {workspace_idx}: {workspace['title'][:30]}")
            continue
        
        topic_id = str(orbital_data['topic_id'])
        topic_pos = topic_positions.get(topic_id)
        if not topic_pos:
            print(f"⚠️  No topic position for topic {topic_id}")
            continue
        
        topic_name = topics[topic_id]['topic']
        expected_orbital_x = orbital_data['orbital_x']
        expected_orbital_y = orbital_data['orbital_y']
        
        print(f"\n📋 Workspace {workspace_idx}: {workspace['title'][:40]}")
        print(f"   🏷️  Assigned to topic: {topic_name}")
        print(f"   🎯 Topic center: ({topic_pos['x']}, {topic_pos['y']})")
        print(f"   🌍 Expected orbital: ({expected_orbital_x}, {expected_orbital_y})")
        
        # Check each root node
        for node in workspace_root_nodes:
            actual_x, actual_y = node['x'], node['y']
            
            # Distance to topic center
            topic_distance = calculate_distance(actual_x, actual_y, topic_pos['x'], topic_pos['y'])
            
            # Distance to expected orbital position
            orbital_distance = calculate_distance(actual_x, actual_y, expected_orbital_x, expected_orbital_y)
            
            print(f"   📍 Root node actual: ({actual_x:.0f}, {actual_y:.0f})")
            print(f"      Distance to topic: {topic_distance:.0f}px")
            print(f"      Distance to expected orbital: {orbital_distance:.0f}px")
            
            if topic_distance > 500:  # Should be within ~200px
                major_issues.append({
                    'workspace': workspace['title'][:30],
                    'topic': topic_name,
                    'node_pos': (actual_x, actual_y),
                    'topic_pos': (topic_pos['x'], topic_pos['y']),
                    'expected_orbital': (expected_orbital_x, expected_orbital_y),
                    'topic_distance': topic_distance,
                    'orbital_distance': orbital_distance
                })
                print(f"      ❌ MAJOR ISSUE: Node too far from topic!")
            else:
                print(f"      ✅ OK: Close to topic")
    
    print(f"\n" + "=" * 60)
    print("🚨 MAJOR POSITIONING ISSUES FOUND:")
    print("=" * 60)
    
    if major_issues:
        print(f"Found {len(major_issues)} nodes far from their assigned topics:")
        
        for i, issue in enumerate(major_issues[:10]):  # Show first 10
            print(f"\n{i+1}. {issue['workspace']}")
            print(f"   Topic: {issue['topic']}")
            print(f"   Node at: ({issue['node_pos'][0]:.0f}, {issue['node_pos'][1]:.0f})")
            print(f"   Topic at: ({issue['topic_pos'][0]:.0f}, {issue['topic_pos'][1]:.0f})")
            print(f"   Expected orbital: ({issue['expected_orbital'][0]:.0f}, {issue['expected_orbital'][1]:.0f})")
            print(f"   Distance to topic: {issue['topic_distance']:.0f}px")
            print(f"   Distance to expected: {issue['orbital_distance']:.0f}px")
        
        if len(major_issues) > 10:
            print(f"\n... and {len(major_issues) - 10} more issues")
            
        print(f"\n💡 POSSIBLE CAUSES:")
        print(f"   1. Solar system script using wrong workspace-to-topic assignments")
        print(f"   2. Cached clustering data out of sync with database")
        print(f"   3. Frontend showing different nodes than expected")
        print(f"   4. Database positions not actually updated by script")
        
    else:
        print("✅ No major positioning issues found")
        print("All nodes are within reasonable distance of their topics")
    
    print("=" * 60)

if __name__ == "__main__":
    debug_actual_positions()