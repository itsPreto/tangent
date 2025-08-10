#!/usr/bin/env python3
"""
Topic Solar System Layout Algorithm

Creates a hierarchical layout where:
1. Topics are positioned as distant islands (macro level)
2. Workspaces orbit around their assigned topics (meso level) 
3. Individual nodes maintain their tree structure within workspaces (micro level)

This preserves existing node relationships while organizing workspaces semantically.
"""

import sqlite3
import json
import math
import requests
from typing import Dict, List, Tuple, Set
from dataclasses import dataclass
from collections import defaultdict

@dataclass
class Node:
    id: str
    parent_id: str = None
    chat_id: str = None
    x: float = 0
    y: float = 0
    title: str = ""
    created_at: str = ""
    original_x: float = 0  # Store original position
    original_y: float = 0
    
class SolarSystemLayoutEngine:
    def __init__(self):
        # Layout constants - updated for tighter orbital clustering
        self.MIN_DISTANCE = 100  # Minimum distance between any two nodes
        self.WORKSPACE_PADDING = 200  # Padding around each workspace
        
    def apply_solar_system_layout(self, db_path: str = "instance/chats.db"):
        """Apply the solar system layout to the database."""
        print("🌌 Starting Solar System Layout Application...")
        
        try:
            # Step 1: Get clustering data from API
            print("📡 Fetching topic clustering data from API...")
            clustering_data = self._fetch_clustering_data()
            
            if not clustering_data:
                print("❌ Failed to get clustering data from API")
                return
                
            print(f"✅ Retrieved data for {len(clustering_data['topics'])} topics")
            
            # Step 2: Load workspace and node data from database
            print("📊 Loading workspace and node data from database...")
            workspaces, all_nodes = self._load_database_data(db_path)
            print(f"📋 Loaded {len(workspaces)} workspaces with {len(all_nodes)} total nodes")
            
            # Step 3: Calculate solar system positioning
            print("🪐 Calculating solar system positions...")
            new_positions = self._calculate_solar_system_positions(
                clustering_data, workspaces, all_nodes
            )
            
            print(f"🎯 Calculated positions for {len(new_positions)} nodes")
            
            # Step 4: Apply positions to database
            print("💾 Applying new positions to database...")
            self._apply_positions_to_database(db_path, new_positions)
            
            print("🎉 Solar System Layout complete!")
            self._print_layout_summary(clustering_data, new_positions)
            
        except Exception as e:
            print(f"❌ Error during solar system layout: {e}")
            raise
    
    def _fetch_clustering_data(self) -> Dict:
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
    
    def _load_database_data(self, db_path: str) -> Tuple[List[Dict], List[Node]]:
        """Load workspace and node data from database."""
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
            
            # Load all nodes
            cursor.execute("""
                SELECT id, parent_id, chat_id, x, y, title, created_at
                FROM nodes 
                ORDER BY created_at
            """)
            node_rows = cursor.fetchall()
            
            nodes = []
            for row in node_rows:
                node = Node(
                    id=row[0],
                    parent_id=row[1],
                    chat_id=row[2],
                    x=float(row[3]) if row[3] else 0,
                    y=float(row[4]) if row[4] else 0,
                    title=row[5] or "",
                    created_at=row[6] or "",
                    original_x=float(row[3]) if row[3] else 0,
                    original_y=float(row[4]) if row[4] else 0
                )
                nodes.append(node)
            
            return workspaces, nodes
            
        finally:
            conn.close()
    
    def _calculate_solar_system_positions(self, clustering_data: Dict, 
                                        workspaces: List[Dict], 
                                        all_nodes: List[Node]) -> Dict[str, Tuple[float, float]]:
        """Calculate new positions using solar system layout."""
        
        # Get positioning data from clustering API
        topics = clustering_data['topics']
        topic_positions = clustering_data['topic_positions'] 
        workspace_positions = clustering_data['workspace_positions']
        clusters = clustering_data['clusters']
        
        # Group nodes by workspace (chat_id)
        nodes_by_workspace = defaultdict(list)
        for node in all_nodes:
            if node.chat_id:
                nodes_by_workspace[node.chat_id].append(node)
        
        new_positions = {}
        
        # Process each workspace
        for workspace_idx, workspace in enumerate(workspaces):
            workspace_id = workspace['id']
            workspace_nodes = nodes_by_workspace.get(workspace_id, [])
            
            if not workspace_nodes:
                continue
                
            # Get orbital position for this workspace
            orbital_data = workspace_positions.get(str(workspace_idx))
            if not orbital_data:
                print(f"⚠️  No orbital data for workspace {workspace_idx}: {workspace['title']}")
                continue
            
            # Find the root node for this workspace to use as the reference point
            root_node = None
            for node in workspace_nodes:
                if node.parent_id is None:  # This is the root node
                    root_node = node
                    break
            
            if not root_node:
                print(f"⚠️  No root node found for workspace {workspace['title']}")
                continue
            
            # Calculate offset from root node's current position to target orbital position
            current_root_x = root_node.x
            current_root_y = root_node.y
            target_workspace_x = orbital_data['orbital_x']
            target_workspace_y = orbital_data['orbital_y']
            
            offset_x = target_workspace_x - current_root_x
            offset_y = target_workspace_y - current_root_y
            
            topic_name = topics[orbital_data['topic_id']]['topic']
            
            print(f"🚀 Moving workspace '{workspace['title'][:30]}...' to orbit {topic_name}")
            print(f"   Root Node: ({current_root_x:.0f}, {current_root_y:.0f}) -> ({target_workspace_x:.0f}, {target_workspace_y:.0f})")
            print(f"   Offset:    ({offset_x:.0f}, {offset_y:.0f})")
            
            # Apply offset to all nodes in this workspace (preserving internal structure)
            for node in workspace_nodes:
                new_x = node.x + offset_x  # Use current position, not original
                new_y = node.y + offset_y
                
                new_positions[node.id] = (new_x, new_y)
            
            print(f"   📍 Moved {len(workspace_nodes)} nodes in workspace")
        
        return new_positions
    
    def _apply_positions_to_database(self, db_path: str, positions: Dict[str, Tuple[float, float]]):
        """Apply calculated positions to the database."""
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        try:
            update_count = 0
            
            for node_id, (new_x, new_y) in positions.items():
                cursor.execute("""
                    UPDATE nodes 
                    SET x = ?, y = ? 
                    WHERE id = ?
                """, (new_x, new_y, node_id))
                update_count += 1
            
            # Also update workspace (chat) positions to orbital centers
            # This isn't strictly necessary but keeps workspace positions in sync
            
            conn.commit()
            print(f"✅ Updated positions for {update_count} nodes in database")
            
        except Exception as e:
            conn.rollback()
            print(f"❌ Database update failed: {e}")
            raise
        finally:
            conn.close()
    
    def _print_layout_summary(self, clustering_data: Dict, positions: Dict):
        """Print a summary of the layout."""
        topics = clustering_data['topics']
        
        print("\n" + "="*60)
        print("🌌 SOLAR SYSTEM LAYOUT SUMMARY")
        print("="*60)
        
        print(f"📊 Topics: {len(topics)}")
        for topic_id, topic_data in topics.items():
            topic_name = topic_data['topic']
            workspace_count = topic_data['size']
            print(f"   🏷️  {topic_name}: {workspace_count} workspaces")
        
        print(f"\n🪐 Total Nodes Positioned: {len(positions)}")
        
        print("\n🎯 Layout Structure:")
        print("   Level 1: Topic Islands (macro layout)")
        print("   Level 2: Workspace Solar Systems (meso layout)")  
        print("   Level 3: Node Trees (micro layout - preserved)")
        
        print("\n✨ Benefits:")
        print("   • Related workspaces grouped around topics")
        print("   • Existing node relationships preserved")
        print("   • Semantic organization at workspace level")
        print("   • Scalable hierarchical structure")
        print("="*60)

def main():
    """Main function to apply solar system layout."""
    engine = SolarSystemLayoutEngine()
    engine.apply_solar_system_layout()

if __name__ == "__main__":
    main()