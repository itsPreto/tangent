import uuid
import random
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)

class MockDataService:
    """Service for generating configurable mock workspace and chat data for performance testing"""
    
    def __init__(self, chat_service):
        self.chat_service = chat_service
        
        # Sample conversation topics and content for realistic data
        self.conversation_topics = [
            "Software Development", "Machine Learning", "Data Science", "Web Design",
            "Mobile Apps", "DevOps", "Database Design", "API Architecture",
            "User Experience", "Product Strategy", "Agile Methodology", "Code Review",
            "Testing Strategies", "Performance Optimization", "Security Best Practices",
            "Cloud Computing", "Microservices", "Frontend Frameworks", "Backend Systems"
        ]
        
        self.sample_messages = [
            "Can you help me understand how to implement this feature?",
            "What are the best practices for this approach?",
            "I'm running into some performance issues with this code.",
            "How would you architect this system for scalability?",
            "What testing strategy would you recommend?",
            "Can we refactor this to be more maintainable?",
            "I need help debugging this issue.",
            "What are the security implications of this design?",
            "How can we optimize this for better user experience?",
            "What would be the best way to document this?"
        ]
        
        self.assistant_responses = [
            "I'd be happy to help you with that. Let me break this down step by step.",
            "That's a great question. Here are several approaches you could consider:",
            "I can see why you're running into that issue. Let's explore some solutions.",
            "For scalability, I'd recommend considering these architectural patterns:",
            "Testing is crucial here. I'd suggest implementing these strategies:",
            "Refactoring this code would definitely improve maintainability. Here's how:",
            "Let's debug this systematically. First, let's check these areas:",
            "Security is important to consider. Here are the key concerns:",
            "For better UX, we should focus on these optimization areas:",
            "Good documentation is essential. I'd recommend this structure:"
        ]
    
    def generate_mock_workspace_config(self, total_nodes: int, num_workspaces: int,
                                     branching_factor: float = 0.3,
                                     max_depth: int = 5,
                                     canvas_bounds: Dict = None) -> Dict[str, Any]:
        """
        Generate configuration for mock workspaces with specified parameters
        
        Args:
            total_nodes: Total number of branch nodes to create
            num_workspaces: Number of separate workspaces
            branching_factor: Probability of creating branches (0.0-1.0)
            max_depth: Maximum conversation depth
            canvas_bounds: Canvas boundary constraints
        """
        if not canvas_bounds:
            canvas_bounds = {'width': 10000, 'height': 8000, 'margin': 500}
            
        # Distribute nodes across workspaces
        base_nodes_per_workspace = total_nodes // num_workspaces
        extra_nodes = total_nodes % num_workspaces
        
        workspaces = []
        
        for i in range(num_workspaces):
            # Assign nodes to this workspace
            nodes_in_workspace = base_nodes_per_workspace
            if i < extra_nodes:
                nodes_in_workspace += 1
                
            # Generate workspace configuration
            workspace_config = {
                'workspace_id': str(uuid.uuid4()),
                'title': f"Workspace {i + 1} - {random.choice(self.conversation_topics)}",
                'node_count': nodes_in_workspace,
                'branching_factor': branching_factor,
                'max_depth': max_depth,
                'center_x': random.uniform(
                    canvas_bounds['margin'], 
                    canvas_bounds['width'] - canvas_bounds['margin']
                ),
                'center_y': random.uniform(
                    canvas_bounds['margin'], 
                    canvas_bounds['height'] - canvas_bounds['margin']
                ),
                'spread_radius': min(800, max(300, nodes_in_workspace * 50))
            }
            
            workspaces.append(workspace_config)
            
        return {
            'total_nodes': total_nodes,
            'num_workspaces': num_workspaces,
            'workspaces': workspaces,
            'generation_config': {
                'branching_factor': branching_factor,
                'max_depth': max_depth,
                'canvas_bounds': canvas_bounds
            }
        }
    
    def generate_conversation_tree(self, node_count: int, branching_factor: float,
                                 max_depth: int, root_topic: str) -> List[Dict]:
        """Generate a tree structure of connected conversation nodes"""
        nodes = []
        node_relationships = []  # Track parent-child relationships
        
        # Create root node
        root_id = str(uuid.uuid4())
        root_node = {
            'id': root_id,
            'title': f"Root: {root_topic}",
            'messages': self._generate_conversation_messages(random.randint(3, 8)),
            'depth': 0,
            'parent_id': None,
            'children': []
        }
        nodes.append(root_node)
        
        # Keep track of nodes that can have children
        expandable_nodes = [{'id': root_id, 'depth': 0}]
        nodes_created = 1
        
        # Generate remaining nodes
        while nodes_created < node_count and expandable_nodes:
            # Choose a random expandable node
            parent_info = random.choice(expandable_nodes)
            parent_id = parent_info['id']
            parent_depth = parent_info['depth']
            
            # Decide if this node should branch
            should_branch = random.random() < branching_factor
            
            if should_branch and parent_depth < max_depth - 1:
                # Create 1-3 child nodes
                num_children = random.randint(1, min(3, node_count - nodes_created))
                
                for _ in range(num_children):
                    if nodes_created >= node_count:
                        break
                        
                    child_id = str(uuid.uuid4())
                    child_node = {
                        'id': child_id,
                        'title': f"Branch: {random.choice(self.conversation_topics)}",
                        'messages': self._generate_conversation_messages(random.randint(2, 6)),
                        'depth': parent_depth + 1,
                        'parent_id': parent_id,
                        'children': []
                    }
                    nodes.append(child_node)
                    nodes_created += 1
                    
                    # Add to expandable nodes if not at max depth
                    if parent_depth + 1 < max_depth - 1:
                        expandable_nodes.append({'id': child_id, 'depth': parent_depth + 1})
                    
                    # Update parent's children list
                    for node in nodes:
                        if node['id'] == parent_id:
                            node['children'].append(child_id)
                            break
            
            # Remove parent from expandable nodes (prevent infinite loops)
            expandable_nodes.remove(parent_info)
        
        return nodes
    
    def _generate_conversation_messages(self, count: int) -> List[Dict]:
        """Generate realistic conversation messages"""
        messages = []
        
        for i in range(count):
            is_user = i % 2 == 0
            
            message = {
                'id': str(uuid.uuid4()),
                'content': random.choice(self.sample_messages if is_user else self.assistant_responses),
                'role': 'user' if is_user else 'assistant',
                'timestamp': (datetime.now() - timedelta(minutes=random.randint(1, 60))).isoformat(),
                'metadata': {
                    'length': random.randint(50, 500),
                    'complexity': random.choice(['simple', 'medium', 'complex'])
                }
            }
            messages.append(message)
            
        return messages
    
    def generate_positioned_nodes(self, workspace_config: Dict) -> List[Dict]:
        """Generate nodes with canvas positions for a workspace"""
        conversation_tree = self.generate_conversation_tree(
            workspace_config['node_count'],
            workspace_config['branching_factor'],
            workspace_config['max_depth'],
            workspace_config['title']
        )
        
        # Position nodes on canvas using tree layout
        positioned_nodes = []
        center_x = workspace_config['center_x']
        center_y = workspace_config['center_y']
        spread_radius = workspace_config['spread_radius']
        
        # Create position mapping
        depth_counts = {}  # Track how many nodes at each depth
        for node in conversation_tree:
            depth = node['depth']
            if depth not in depth_counts:
                depth_counts[depth] = 0
            depth_counts[depth] += 1
        
        depth_positions = {}  # Track current position index at each depth
        for depth in depth_counts:
            depth_positions[depth] = 0
        
        # Position each node
        for node in conversation_tree:
            depth = node['depth']
            current_pos = depth_positions[depth]
            total_at_depth = depth_counts[depth]
            
            if total_at_depth == 1:
                # Single node at this depth - center it
                x = center_x
                y = center_y + (depth * 300)  # Vertical spacing by depth
            else:
                # Multiple nodes - spread them horizontally
                angle_step = (2 * 3.14159) / total_at_depth
                angle = current_pos * angle_step
                radius = spread_radius * (0.5 + depth * 0.3)
                
                x = center_x + radius * random.uniform(0.7, 1.3) * (1 if random.random() > 0.5 else -1)
                y = center_y + (depth * 300) + random.uniform(-100, 100)
            
            # Add some randomization to avoid perfect alignment
            x += random.uniform(-50, 50)
            y += random.uniform(-50, 50)
            
            positioned_node = {
                'id': node['id'],
                'title': node['title'],
                'x': x,
                'y': y,
                'depth': depth,  # Add depth as top-level field for sorting
                'parent_id': node['parent_id'],  # Add parent_id as top-level field
                'messages': node['messages'],
                'metadata': {
                    'depth': depth,
                    'parent_id': node['parent_id'],
                    'children': node['children'],
                    'workspace_id': workspace_config['workspace_id'],
                    'node_type': 'mock_generated',
                    'generated_at': datetime.now().isoformat()
                }
            }
            positioned_nodes.append(positioned_node)
            depth_positions[depth] += 1
        
        return positioned_nodes
    
    async def create_mock_workspaces(self, config: Dict) -> Dict[str, Any]:
        """Create mock workspaces in the database based on configuration"""
        try:
            created_chats = []
            total_nodes_created = 0
            
            # Create separate workspaces as originally intended
            for workspace_config in config['workspaces']:
                # Generate positioned nodes for this workspace
                nodes = self.generate_positioned_nodes(workspace_config)
                
                # Prepare initial node data
                initial_node_data = {
                    'type': 'main',
                    'title': f"Root - {workspace_config['title']}",
                    'x': workspace_config['center_x'],
                    'y': workspace_config['center_y'],
                    'messages': nodes[0]['messages'] if nodes else [],
                    'metadata': {
                        'workspace_id': workspace_config['workspace_id'],
                        'is_mock_data': True,
                        'generated_at': datetime.now().isoformat()
                    }
                }
                
                # Create the chat with proper method signature
                logger.info(f"Creating chat: {workspace_config['title']}")
                chat_id = self.chat_service.create_chat(
                    title=workspace_config['title'],
                    initial_node_data=initial_node_data
                )
                if not chat_id:
                    logger.error(f"Failed to create chat for workspace {workspace_config['workspace_id']}")
                    continue
                    
                logger.info(f"Successfully created chat {chat_id} with root node")
                
                # Get the root node ID from the created chat
                chat_data = self.chat_service.get_chat(chat_id)
                root_node_id = None
                if chat_data and 'nodes' in chat_data:
                    root_node_id = chat_data['nodes'].get('id')
                
                # Add additional nodes to the chat
                logger.info(f"Adding {len(nodes)-1} additional nodes to chat {chat_id}")
                nodes_added = 1  # Count the root node
                
                # Build mapping from original IDs to created node IDs
                id_mapping = {nodes[0]['id']: root_node_id}  # Map root node to actual ID
                
                # Sort nodes by depth to ensure parents are created before children
                remaining_nodes = sorted(nodes[1:], key=lambda n: n['depth'])
                
                for i, node in enumerate(remaining_nodes):  # Process in depth order
                    # Map parent ID from original tree to actual database parent ID
                    parent_id = None
                    if node.get('parent_id') and node['parent_id'] in id_mapping:
                        parent_id = id_mapping[node['parent_id']]
                    
                    node_data = {
                        'type': 'main',
                        'title': node['title'],
                        'x': node['x'],
                        'y': node['y'],
                        'parentId': parent_id,  # Include parent relationship
                        'messages': node['messages'],
                        'metadata': node['metadata']
                    }
                    
                    logger.debug(f"Adding node {i+2}/{len(nodes)}: {node['title']} (parent: {parent_id})")
                    created_node_id = self.chat_service.add_node(chat_id, node_data)
                    if not created_node_id:
                        logger.warning(f"Failed to create node {node['id']} in chat {chat_id}")
                    else:
                        # Store the mapping from original ID to created ID for parent references
                        id_mapping[node['id']] = created_node_id
                        nodes_added += 1
                        logger.debug(f"Successfully added node {created_node_id} with parent {parent_id}")
                
                logger.info(f"Chat {chat_id} final node count: {nodes_added}/{len(nodes)}")
                
                created_chats.append({
                    'chat_id': chat_id,
                    'workspace_id': workspace_config['workspace_id'],
                    'title': workspace_config['title'],
                    'node_count': len(nodes),
                    'center_x': workspace_config['center_x'],
                    'center_y': workspace_config['center_y']
                })
                total_nodes_created += len(nodes)
            
            return {
                'success': True,
                'created_chats': created_chats,
                'total_nodes_created': total_nodes_created,
                'total_workspaces_created': len(created_chats),
                'generation_timestamp': datetime.now().isoformat(),
                'config_used': config
            }
            
        except Exception as e:
            logger.error(f"Error creating mock workspaces: {e}")
            return {
                'success': False,
                'error': str(e),
                'created_chats': [],
                'total_nodes_created': 0
            }
    
    async def clear_mock_data(self) -> Dict[str, Any]:
        """Clear all mock-generated data from the database"""
        try:
            # Get all chats to identify mock data
            all_chats = self.chat_service.list_chats()
            mock_chats = []
            cleared_chats = 0
            cleared_nodes = 0
            
            # Find chats that contain mock data by checking node metadata
            for chat_summary in all_chats:
                try:
                    chat_data = self.chat_service.get_chat(chat_summary['id'])
                    if chat_data and 'nodes' in chat_data:
                        # Check if this chat contains mock data by examining node metadata
                        def has_mock_data(node):
                            if not node:
                                return False
                            metadata = node.get('metadata', {})
                            if metadata.get('is_mock_data') or metadata.get('node_type') == 'mock_generated':
                                return True
                            # Check children recursively
                            for child in node.get('children', []):
                                if has_mock_data(child):
                                    return True
                            return False
                        
                        if has_mock_data(chat_data['nodes']):
                            mock_chats.append(chat_summary['id'])
                except Exception as e:
                    logger.warning(f"Error checking chat {chat_summary['id']} for mock data: {e}")
                    continue
            
            # Delete all identified mock data chats
            for chat_id in mock_chats:
                try:
                    # Count nodes before deletion
                    chat_data = self.chat_service.get_chat(chat_id)
                    if chat_data and 'nodes' in chat_data:
                        def count_nodes(node):
                            if not node:
                                return 0
                            count = 1
                            for child in node.get('children', []):
                                count += count_nodes(child)
                            return count
                        cleared_nodes += count_nodes(chat_data['nodes'])
                    
                    # Delete the entire chat (which cascades to delete all nodes)
                    if self.chat_service.delete_chat(chat_id):
                        cleared_chats += 1
                        logger.info(f"Deleted mock chat: {chat_id}")
                    else:
                        logger.warning(f"Failed to delete chat: {chat_id}")
                        
                except Exception as e:
                    logger.error(f"Error deleting chat {chat_id}: {e}")
                    continue
            
            return {
                'success': True,
                'message': f'Successfully cleared {cleared_chats} mock workspaces and {cleared_nodes} nodes',
                'cleared_chats': cleared_chats,
                'cleared_nodes': cleared_nodes,
                'cleared_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error clearing mock data: {e}")
            return {
                'success': False,
                'error': str(e),
                'cleared_chats': 0,
                'cleared_nodes': 0
            }