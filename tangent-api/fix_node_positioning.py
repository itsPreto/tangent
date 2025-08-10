#!/usr/bin/env python3
"""
Fix node positioning for proper tree layout
Children positioned to the right and down from parents, with oldest child on top
"""

import sqlite3
import json
from typing import Dict, List, Set, Tuple
from dataclasses import dataclass
from datetime import datetime

@dataclass
class Node:
    id: str
    parent_id: str = None
    x: float = 0
    y: float = 0
    title: str = ""
    created_at: str = ""
    branch_side: str = "right"  # "left" or "right"
    children: List['Node'] = None
    
    def __post_init__(self):
        if self.children is None:
            self.children = []

class TreeLayoutEngine:
    def __init__(self):
        # Layout constants - adjusted for full detail LOD nodes
        self.HORIZONTAL_SPACING = 900   # Distance between parent and child horizontally (full detail needs more)
        self.VERTICAL_SPACING = 400     # Minimum vertical spacing between siblings (full detail height ~300px)
        self.ROOT_START_X = 100         # Starting X position for root nodes
        self.ROOT_START_Y = 100         # Starting Y position for first root
        self.WORKSPACE_HORIZONTAL_GAP = 1400  # Horizontal gap between workspace columns (waterfall)
        self.WORKSPACE_VERTICAL_GAP = 600     # Vertical gap between workspace rows (waterfall)
        
    def calculate_layout(self, nodes: List[Node]) -> Dict[str, Tuple[float, float]]:
        """Calculate optimal positions for all nodes using waterfall layout with workspace islands"""
        print(f"Calculating layout for {len(nodes)} nodes...")
        
        # Build tree structure
        roots, node_map = self._build_trees(nodes)
        print(f"Found {len(roots)} root nodes")
        
        # First pass: calculate each workspace's bounds
        print("Calculating workspace bounds...")
        workspace_bounds = []
        
        for root in roots:
            temp_positions = self._layout_tree(root, 0, 0)  # Layout at origin
            bounds = self._calculate_workspace_bounds(temp_positions)
            workspace_bounds.append(bounds)
            print(f"Workspace '{root.title[:30]}...' bounds: {bounds['width']:.0f}x{bounds['height']:.0f}")
        
        # Calculate waterfall grid dimensions
        workspaces_per_row = max(1, int(len(roots) ** 0.6))  # Roughly square-ish layout
        print(f"Using waterfall layout: {workspaces_per_row} workspaces per row")
        
        # Second pass: position workspaces with proper separation
        positions = {}
        row_heights = [0] * ((len(roots) + workspaces_per_row - 1) // workspaces_per_row)  # Max height per row
        
        for i, root in enumerate(roots):
            print(f"Processing workspace {i+1}/{len(roots)}: {root.title[:40]}...")
            
            row = i // workspaces_per_row
            col = i % workspaces_per_row
            
            # Calculate workspace position with proper separation
            workspace_x = self.ROOT_START_X
            workspace_y = self.ROOT_START_Y
            
            # Add horizontal spacing based on previous workspaces in this row
            for prev_col in range(col):
                prev_workspace_idx = row * workspaces_per_row + prev_col
                if prev_workspace_idx < len(workspace_bounds):
                    workspace_x += workspace_bounds[prev_workspace_idx]['width'] + self.WORKSPACE_HORIZONTAL_GAP
            
            # Add vertical spacing based on previous rows
            for prev_row in range(row):
                workspace_y += row_heights[prev_row] + self.WORKSPACE_VERTICAL_GAP
            
            # Update row height tracking
            row_heights[row] = max(row_heights[row], workspace_bounds[i]['height'])
            
            # Position this tree at calculated workspace position
            tree_positions = self._layout_tree(root, workspace_x, workspace_y)
            positions.update(tree_positions)
            
            print(f"  Positioned at ({workspace_x:.0f}, {workspace_y:.0f})")
            
        return positions
    
    def _build_trees(self, nodes: List[Node]) -> Tuple[List[Node], Dict[str, Node]]:
        """Build tree structure from flat node list"""
        node_map = {node.id: node for node in nodes}
        roots = []
        
        # Build parent-child relationships
        for node in nodes:
            if node.parent_id and node.parent_id in node_map:
                parent = node_map[node.parent_id]
                parent.children.append(node)
            else:
                # Node with no parent or orphaned node becomes a root
                roots.append(node)
        
        # Sort children by branch side first, then by creation time
        for node in nodes:
            if node.children:
                # Group by side: left children first, then right children
                # Within each side, sort by creation time (oldest first = top position)
                node.children.sort(key=lambda n: (n.branch_side != "left", n.created_at or ""))
                
        # Sort roots by creation time
        roots.sort(key=lambda n: n.created_at or "")
        
        return roots, node_map
    
    def _layout_tree(self, root: Node, start_x: float, start_y: float) -> Dict[str, Tuple[float, float]]:
        """Layout a single tree starting from root position"""
        positions = {}
        
        def layout_node(node: Node, x: float, y: float) -> float:
            """Layout node and its children, return the bottom Y coordinate used"""
            positions[node.id] = (x, y)
            
            if not node.children:
                return y
            
            # Separate children by branch side
            left_children = [child for child in node.children if child.branch_side == "left"]
            right_children = [child for child in node.children if child.branch_side == "right"]
            
            max_y = y
            child_y = y  # Start positioning children at same Y as parent
            
            # Position left-branching children (to the left of parent)
            if left_children:
                left_x = x - self.HORIZONTAL_SPACING
                for child in left_children:
                    bottom_y = layout_node(child, left_x, child_y)
                    max_y = max(max_y, bottom_y)
                    child_y = bottom_y + self.VERTICAL_SPACING
            
            # Position right-branching children (to the right of parent)
            if right_children:
                right_x = x + self.HORIZONTAL_SPACING
                child_y = y  # Reset Y position for right side
                for child in right_children:
                    bottom_y = layout_node(child, right_x, child_y)
                    max_y = max(max_y, bottom_y)
                    child_y = bottom_y + self.VERTICAL_SPACING
            
            return max_y
        
        layout_node(root, start_x, start_y)
        return positions
    
    def _calculate_tree_height(self, positions: Dict[str, Tuple[float, float]]) -> float:
        """Calculate total height of positioned tree"""
        if not positions:
            return 0
        y_values = [pos[1] for pos in positions.values()]
        return max(y_values) - min(y_values) + 300  # Add some padding
    
    def _calculate_workspace_bounds(self, positions: Dict[str, Tuple[float, float]]) -> Dict[str, float]:
        """Calculate the bounding box of a workspace"""
        if not positions:
            return {'width': 400, 'height': 300, 'min_x': 0, 'max_x': 400, 'min_y': 0, 'max_y': 300}
        
        x_values = [pos[0] for pos in positions.values()]
        y_values = [pos[1] for pos in positions.values()]
        
        min_x = min(x_values)
        max_x = max(x_values) + 400  # Add node width
        min_y = min(y_values)
        max_y = max(y_values) + 300  # Add node height
        
        # Add padding around the workspace
        padding = 200
        
        return {
            'width': (max_x - min_x) + padding * 2,
            'height': (max_y - min_y) + padding * 2,
            'min_x': min_x - padding,
            'max_x': max_x + padding,
            'min_y': min_y - padding,
            'max_y': max_y + padding
        }

def fix_node_positions():
    """Main function to fix all node positions in the database"""
    db_path = "instance/chats.db"
    
    try:
        # Connect to database
        print("Connecting to database...")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Fetch all nodes with metadata
        print("Fetching nodes from database...")
        cursor.execute("""
            SELECT id, parent_id, x, y, title, created_at, node_metadata
            FROM nodes 
            ORDER BY created_at
        """)
        
        rows = cursor.fetchall()
        print(f"Found {len(rows)} nodes in database")
        
        if not rows:
            print("No nodes found in database")
            return
        
        # Convert to Node objects
        nodes = []
        for row in rows:
            # Parse branch side from metadata
            branch_side = "right"  # default
            if row[6]:  # node_metadata
                try:
                    metadata = json.loads(row[6])
                    if metadata.get("type") == "left-branch":
                        branch_side = "left"
                except (json.JSONDecodeError, KeyError):
                    pass
            
            node = Node(
                id=row[0],
                parent_id=row[1],
                x=float(row[2]) if row[2] else 0,
                y=float(row[3]) if row[3] else 0,
                title=row[4] or "",
                created_at=row[5] or "",
                branch_side=branch_side
            )
            nodes.append(node)
        
        # Calculate new positions
        layout_engine = TreeLayoutEngine()
        new_positions = layout_engine.calculate_layout(nodes)
        
        print(f"Calculated positions for {len(new_positions)} nodes")
        
        # Update database with new positions
        print("Updating node positions in database...")
        update_count = 0
        
        for node_id, (new_x, new_y) in new_positions.items():
            cursor.execute("""
                UPDATE nodes 
                SET x = ?, y = ? 
                WHERE id = ?
            """, (new_x, new_y, node_id))
            update_count += 1
        
        # Commit changes
        conn.commit()
        print(f"Successfully updated positions for {update_count} nodes")
        
        # Print some sample positions
        print("\nSample new positions:")
        for i, (node_id, (x, y)) in enumerate(list(new_positions.items())[:5]):
            node = next(n for n in nodes if n.id == node_id)
            print(f"  {node.title[:40]:40} -> ({x:6.0f}, {y:6.0f})")
        
        print(f"\n✅ Successfully repositioned all nodes!")
        print("Children are now positioned to the right and down from parents.")
        print("Oldest children appear at the top of each sibling group.")
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    fix_node_positions()