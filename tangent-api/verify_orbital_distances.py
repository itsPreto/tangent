#!/usr/bin/env python3
"""
Orbital Distance Verification Script

Verifies that every root node is positioned within the expected orbital radius
of their assigned topic center.
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

def verify_orbital_distances():
    """Verify that all root nodes are within expected orbital radius of their topics."""
    
    print("🔍 Verifying Orbital Distances...")
    print("=" * 60)
    
    # Fetch clustering data
    print("📡 Fetching clustering data...")
    clustering_data = fetch_clustering_data()
    if not clustering_data:
        print("❌ Failed to get clustering data")
        return
    
    # Load database data
    print("📊 Loading database data...")
    workspaces, root_nodes = load_database_data()
    
    print(f"✅ Loaded {len(workspaces)} workspaces and {len(root_nodes)} root nodes")
    
    # Get positioning data
    topics = clustering_data['topics']
    topic_positions = clustering_data['topic_positions']
    workspace_positions = clustering_data['workspace_positions']
    
    # Expected orbital constraints
    MAX_ORBITAL_RADIUS = 300  # 120 base + 80*2 rings + some buffer
    
    # Group root nodes by workspace
    nodes_by_workspace = defaultdict(list)
    for node in root_nodes:
        if node['chat_id']:
            nodes_by_workspace[node['chat_id']].append(node)
    
    # Verification results
    total_verified = 0
    violations = []
    max_distance = 0
    avg_distance = 0
    distance_sum = 0
    
    print("\n📍 Distance Analysis:")
    print("-" * 60)
    
    # Check each workspace
    for workspace_idx, workspace in enumerate(workspaces):
        workspace_id = workspace['id']
        workspace_root_nodes = nodes_by_workspace.get(workspace_id, [])
        
        if not workspace_root_nodes:
            continue
        
        # Get orbital position for this workspace
        orbital_data = workspace_positions.get(str(workspace_idx))
        if not orbital_data:
            print(f"⚠️  No orbital data for workspace {workspace_idx}")
            continue
        
        # Get topic position
        topic_id = orbital_data['topic_id']
        topic_pos = topic_positions.get(str(topic_id))
        if not topic_pos:
            print(f"⚠️  No topic position for topic {topic_id}")
            continue
        
        topic_name = topics[str(topic_id)]['topic']
        topic_x, topic_y = topic_pos['x'], topic_pos['y']
        
        print(f"\n🏷️  Topic: {topic_name} at ({topic_x:.0f}, {topic_y:.0f})")
        print(f"📋 Workspace: {workspace['title'][:40]}...")
        
        # Check each root node in this workspace
        for node in workspace_root_nodes:
            distance = calculate_distance(node['x'], node['y'], topic_x, topic_y)
            
            print(f"   📍 Root node at ({node['x']:.0f}, {node['y']:.0f}) - Distance: {distance:.1f}px")
            
            total_verified += 1
            distance_sum += distance
            max_distance = max(max_distance, distance)
            
            if distance > MAX_ORBITAL_RADIUS:
                violations.append({
                    'workspace': workspace['title'][:40],
                    'topic': topic_name,
                    'node_pos': (node['x'], node['y']),
                    'topic_pos': (topic_x, topic_y),
                    'distance': distance,
                    'max_allowed': MAX_ORBITAL_RADIUS
                })
                print(f"   ❌ VIOLATION: Distance {distance:.1f}px exceeds {MAX_ORBITAL_RADIUS}px")
            else:
                print(f"   ✅ OK: Within orbital radius")
    
    # Calculate statistics
    if total_verified > 0:
        avg_distance = distance_sum / total_verified
    
    print("\n" + "=" * 60)
    print("📊 VERIFICATION SUMMARY")
    print("=" * 60)
    print(f"🔍 Total Root Nodes Verified: {total_verified}")
    print(f"📏 Average Distance to Topic: {avg_distance:.1f}px")
    print(f"📐 Maximum Distance Found: {max_distance:.1f}px")
    print(f"🎯 Expected Max Orbital Radius: {MAX_ORBITAL_RADIUS}px")
    
    if violations:
        print(f"\n❌ VIOLATIONS FOUND: {len(violations)}")
        print("-" * 40)
        for violation in violations:
            print(f"🚨 {violation['workspace']}")
            print(f"   Topic: {violation['topic']}")
            print(f"   Distance: {violation['distance']:.1f}px (max: {violation['max_allowed']}px)")
            print(f"   Node: ({violation['node_pos'][0]:.0f}, {violation['node_pos'][1]:.0f})")
            print(f"   Topic: ({violation['topic_pos'][0]:.0f}, {violation['topic_pos'][1]:.0f})")
            print()
    else:
        print(f"\n✅ ALL NODES WITHIN ORBITAL RADIUS!")
        print("🎉 Perfect orbital clustering achieved!")
    
    print("=" * 60)

if __name__ == "__main__":
    verify_orbital_distances()