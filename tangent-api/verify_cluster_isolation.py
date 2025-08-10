#!/usr/bin/env python3
"""
Cluster Isolation Verification Script

Verifies that:
1. Each root node is within proper orbital radius of its assigned topic
2. No two topic territories overlap (proper cluster isolation)
3. Topic separations ensure no link crossing between clusters
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

def verify_cluster_isolation():
    """Verify that all clusters are properly isolated with no territory overlap."""
    
    print("🔍 Verifying Cluster Isolation and Territory Separation...")
    print("=" * 70)
    
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
    
    # Expected constraints
    MAX_ORBITAL_RADIUS = 300  # From our layout algorithm
    MIN_TOPIC_SEPARATION = 800  # Should be > 2 * MAX_ORBITAL_RADIUS for no overlap
    
    # Group root nodes by workspace
    nodes_by_workspace = defaultdict(list)
    for node in root_nodes:
        if node['chat_id']:
            nodes_by_workspace[node['chat_id']].append(node)
    
    # Build topic territories 
    topic_territories = {}
    for topic_id, topic_pos in topic_positions.items():
        topic_territories[topic_id] = {
            'center': (topic_pos['x'], topic_pos['y']),
            'radius': MAX_ORBITAL_RADIUS,
            'topic_name': topics[topic_id]['topic'],
            'root_nodes': []
        }
    
    print("\n🌍 Building Topic Territories...")
    print("-" * 50)
    
    # Assign root nodes to territories
    orbital_violations = []
    for workspace_idx, workspace in enumerate(workspaces):
        workspace_id = workspace['id']
        workspace_root_nodes = nodes_by_workspace.get(workspace_id, [])
        
        if not workspace_root_nodes:
            continue
        
        # Get orbital assignment
        orbital_data = workspace_positions.get(str(workspace_idx))
        if not orbital_data:
            continue
        
        topic_id = str(orbital_data['topic_id'])
        if topic_id not in topic_territories:
            continue
        
        # Check each root node
        for node in workspace_root_nodes:
            topic_center = topic_territories[topic_id]['center']
            distance = calculate_distance(node['x'], node['y'], topic_center[0], topic_center[1])
            
            topic_territories[topic_id]['root_nodes'].append({
                'node': node,
                'distance': distance,
                'workspace': workspace['title'][:30]
            })
            
            if distance > MAX_ORBITAL_RADIUS:
                orbital_violations.append({
                    'workspace': workspace['title'][:30],
                    'topic': topic_territories[topic_id]['topic_name'],
                    'distance': distance,
                    'max_allowed': MAX_ORBITAL_RADIUS
                })
    
    # Print territory summary
    for topic_id, territory in topic_territories.items():
        center_x, center_y = territory['center']
        node_count = len(territory['root_nodes'])
        print(f"🏷️  {territory['topic_name']}: ({center_x:.0f}, {center_y:.0f}) - {node_count} root nodes")
        if territory['root_nodes']:
            distances = [n['distance'] for n in territory['root_nodes']]
            avg_dist = sum(distances) / len(distances)
            max_dist = max(distances)
            print(f"   📏 Avg distance: {avg_dist:.1f}px, Max: {max_dist:.1f}px")
    
    print("\n🚧 Checking Territory Overlap...")
    print("-" * 40)
    
    # Check for territory overlaps
    territory_violations = []
    topic_list = list(topic_territories.items())
    
    for i, (topic_id_a, territory_a) in enumerate(topic_list):
        for j, (topic_id_b, territory_b) in enumerate(topic_list[i+1:], i+1):
            center_a = territory_a['center']
            center_b = territory_b['center']
            
            # Distance between topic centers
            center_distance = calculate_distance(center_a[0], center_a[1], center_b[0], center_b[1])
            
            # Required minimum distance (sum of radii + buffer)
            required_distance = territory_a['radius'] + territory_b['radius']
            
            print(f"📐 {territory_a['topic_name']} ↔ {territory_b['topic_name']}: {center_distance:.1f}px")
            print(f"   Required: ≥{required_distance:.1f}px", end="")
            
            if center_distance < required_distance:
                overlap = required_distance - center_distance
                territory_violations.append({
                    'topic_a': territory_a['topic_name'],
                    'topic_b': territory_b['topic_name'],
                    'distance': center_distance,
                    'required': required_distance,
                    'overlap': overlap
                })
                print(f" ❌ OVERLAP: {overlap:.1f}px")
            else:
                buffer = center_distance - required_distance
                print(f" ✅ OK (+{buffer:.1f}px buffer)")
    
    print("\n" + "=" * 70)
    print("📊 CLUSTER ISOLATION VERIFICATION SUMMARY")
    print("=" * 70)
    
    # Orbital violations summary
    print(f"🎯 Orbital Radius Check:")
    if orbital_violations:
        print(f"   ❌ {len(orbital_violations)} nodes outside orbital radius")
        for violation in orbital_violations[:3]:  # Show first 3
            print(f"   🚨 {violation['workspace']} → {violation['topic']}: {violation['distance']:.1f}px")
        if len(orbital_violations) > 3:
            print(f"   ... and {len(orbital_violations) - 3} more")
    else:
        print(f"   ✅ All {sum(len(t['root_nodes']) for t in topic_territories.values())} nodes within orbital radius")
    
    # Territory overlap summary
    print(f"\n🌍 Territory Isolation Check:")
    if territory_violations:
        print(f"   ❌ {len(territory_violations)} territory overlaps detected")
        for violation in territory_violations:
            print(f"   🚨 {violation['topic_a']} ⚡ {violation['topic_b']}: {violation['overlap']:.1f}px overlap")
    else:
        print(f"   ✅ All {len(topic_territories)} topic territories properly isolated")
    
    # Overall verdict
    print(f"\n🏆 FINAL VERDICT:")
    if not orbital_violations and not territory_violations:
        print("   ✅ PERFECT CLUSTER ISOLATION ACHIEVED!")
        print("   🎉 No link crossing expected between clusters")
    else:
        print("   ❌ CLUSTER ISOLATION ISSUES DETECTED")
        print("   🔧 Links will cross between overlapping territories")
        
        if territory_violations:
            print(f"\n💡 RECOMMENDED FIXES:")
            print(f"   📏 Increase TOPIC_HORIZONTAL_GAP from current value")
            print(f"   📏 Increase TOPIC_VERTICAL_GAP from current value")
            print(f"   🎯 Minimum gap needed: {required_distance + 100:.0f}px between centers")
    
    print("=" * 70)

if __name__ == "__main__":
    verify_cluster_isolation()