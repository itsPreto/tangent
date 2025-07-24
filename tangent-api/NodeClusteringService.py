import numpy as np
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler
import json
import logging
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
import hashlib

logger = logging.getLogger(__name__)

class NodeClusteringService:
    """
    Service for clustering nodes based on content similarity and relationships
    """
    
    def __init__(self, embedding_service, chat_service):
        self.embedding_service = embedding_service
        self.chat_service = chat_service
        self.scaler = StandardScaler()
        
    def extract_node_content(self, node: Dict) -> str:
        """Extract meaningful content from a node for embedding generation"""
        content_parts = []
        
        # Add node title
        if node.get('title'):
            content_parts.append(node['title'])
            
        # Add message content
        if node.get('messages'):
            for message in node['messages']:
                if isinstance(message.get('content'), str):
                    content_parts.append(message['content'])
                elif isinstance(message.get('content'), list):
                    for part in message['content']:
                        if isinstance(part, dict) and part.get('type') == 'text':
                            content_parts.append(part.get('text', ''))
                        
        # Add media descriptions if available
        if node.get('mediaContent') and node['mediaContent'].get('analysis'):
            content_parts.append(f"Media: {node['mediaContent']['analysis']}")
            
        # Add node type context
        if node.get('type'):
            content_parts.append(f"Type: {node['type']}")
            
        return ' '.join(content_parts)
    
    async def generate_node_embeddings(self, chat_id: str) -> Dict[str, np.ndarray]:
        """Generate embeddings for all nodes in a chat"""
        try:
            chat = self.chat_service.get_chat(chat_id)
            if not chat or not chat.nodes:
                return {}
                
            embeddings = {}
            
            for node in chat.nodes:
                content = self.extract_node_content(node.__dict__)
                if content.strip():
                    # Generate embedding using the existing service
                    embedding = await self.embedding_service.generate_embedding(content)
                    if embedding is not None:
                        embeddings[node.id] = np.array(embedding)
                        
            logger.info(f"Generated embeddings for {len(embeddings)} nodes in chat {chat_id}")
            return embeddings
            
        except Exception as e:
            logger.error(f"Error generating node embeddings: {e}")
            return {}
    
    def cluster_nodes_kmeans(self, embeddings: Dict[str, np.ndarray], 
                           k: Optional[int] = None) -> Dict[str, Any]:
        """Cluster nodes using K-means algorithm"""
        if len(embeddings) < 2:
            return {
                'clusters': {node_id: 0 for node_id in embeddings.keys()},
                'cluster_centers': [],
                'silhouette_score': 0,
                'method': 'kmeans',
                'k': 1
            }
            
        node_ids = list(embeddings.keys())
        embedding_matrix = np.array(list(embeddings.values()))
        
        # Normalize embeddings
        embedding_matrix = self.scaler.fit_transform(embedding_matrix)
        
        # Determine optimal k if not provided
        if k is None:
            k = self._find_optimal_k(embedding_matrix, max_k=min(10, len(embeddings) // 2))
            
        # Perform clustering
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(embedding_matrix)
        
        # Calculate silhouette score
        silhouette_avg = silhouette_score(embedding_matrix, cluster_labels) if k > 1 else 0
        
        # Create cluster assignments
        clusters = {node_ids[i]: int(cluster_labels[i]) for i in range(len(node_ids))}
        
        return {
            'clusters': clusters,
            'cluster_centers': kmeans.cluster_centers_.tolist(),
            'silhouette_score': silhouette_avg,
            'method': 'kmeans',
            'k': k
        }
    
    def cluster_nodes_dbscan(self, embeddings: Dict[str, np.ndarray], 
                           eps: float = 0.5, min_samples: int = 2) -> Dict[str, Any]:
        """Cluster nodes using DBSCAN algorithm"""
        if len(embeddings) < 2:
            return {
                'clusters': {node_id: 0 for node_id in embeddings.keys()},
                'n_clusters': 1,
                'n_noise': 0,
                'method': 'dbscan',
                'eps': eps,
                'min_samples': min_samples
            }
            
        node_ids = list(embeddings.keys())
        embedding_matrix = np.array(list(embeddings.values()))
        
        # Normalize embeddings
        embedding_matrix = self.scaler.fit_transform(embedding_matrix)
        
        # Perform clustering
        dbscan = DBSCAN(eps=eps, min_samples=min_samples)
        cluster_labels = dbscan.fit_predict(embedding_matrix)
        
        # Create cluster assignments (-1 for noise points)
        clusters = {node_ids[i]: int(cluster_labels[i]) for i in range(len(node_ids))}
        
        # Count clusters and noise points
        n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
        n_noise = list(cluster_labels).count(-1)
        
        return {
            'clusters': clusters,
            'n_clusters': n_clusters,
            'n_noise': n_noise,
            'method': 'dbscan',
            'eps': eps,
            'min_samples': min_samples
        }
    
    def _find_optimal_k(self, embeddings: np.ndarray, max_k: int = 10) -> int:
        """Find optimal number of clusters using elbow method and silhouette analysis"""
        if len(embeddings) <= 2:
            return 1
            
        scores = []
        k_range = range(2, min(max_k + 1, len(embeddings)))
        
        for k in k_range:
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(embeddings)
            score = silhouette_score(embeddings, cluster_labels)
            scores.append(score)
            
        if not scores:
            return 2
            
        # Return k with highest silhouette score
        optimal_k = k_range[np.argmax(scores)]
        return optimal_k
    
    def calculate_cluster_positions(self, nodes: List[Dict], clusters: Dict[str, int], 
                                  canvas_bounds: Dict[str, float] = None) -> Dict[str, Dict[str, float]]:
        """Calculate optimal positions for nodes based on cluster assignments"""
        if not canvas_bounds:
            canvas_bounds = {'width': 2000, 'height': 1500, 'margin': 200}
            
        # Group nodes by cluster
        cluster_groups = {}
        for node in nodes:
            cluster_id = clusters.get(node['id'], 0)
            if cluster_id not in cluster_groups:
                cluster_groups[cluster_id] = []
            cluster_groups[cluster_id].append(node)
            
        new_positions = {}
        
        # Calculate cluster centers in a grid layout
        n_clusters = len(cluster_groups)
        if n_clusters == 0:
            return {}
            
        # Arrange clusters in a rough grid
        grid_size = int(np.ceil(np.sqrt(n_clusters)))
        cluster_width = (canvas_bounds['width'] - 2 * canvas_bounds['margin']) / grid_size
        cluster_height = (canvas_bounds['height'] - 2 * canvas_bounds['margin']) / grid_size
        
        for i, (cluster_id, cluster_nodes) in enumerate(cluster_groups.items()):
            # Calculate cluster center position
            grid_x = i % grid_size
            grid_y = i // grid_size
            
            center_x = canvas_bounds['margin'] + grid_x * cluster_width + cluster_width / 2
            center_y = canvas_bounds['margin'] + grid_y * cluster_height + cluster_height / 2
            
            # Arrange nodes within cluster using force-directed layout
            cluster_positions = self._arrange_nodes_in_cluster(
                cluster_nodes, center_x, center_y, 
                min(cluster_width * 0.8, cluster_height * 0.8)
            )
            
            new_positions.update(cluster_positions)
            
        return new_positions
    
    def _arrange_nodes_in_cluster(self, nodes: List[Dict], center_x: float, 
                                center_y: float, max_radius: float) -> Dict[str, Dict[str, float]]:
        """Arrange nodes within a cluster using a circular or force-directed layout"""
        positions = {}
        n_nodes = len(nodes)
        
        if n_nodes == 1:
            positions[nodes[0]['id']] = {'x': center_x, 'y': center_y}
        elif n_nodes <= 8:
            # Circular arrangement for small clusters
            angle_step = 2 * np.pi / n_nodes
            radius = min(max_radius / 3, 150)  # Reasonable spacing
            
            for i, node in enumerate(nodes):
                angle = i * angle_step
                x = center_x + radius * np.cos(angle)
                y = center_y + radius * np.sin(angle)
                positions[node['id']] = {'x': x, 'y': y}
        else:
            # Grid arrangement for larger clusters
            grid_size = int(np.ceil(np.sqrt(n_nodes)))
            node_spacing = max_radius / grid_size
            
            for i, node in enumerate(nodes):
                grid_x = i % grid_size
                grid_y = i // grid_size
                
                x = center_x - max_radius/2 + grid_x * node_spacing
                y = center_y - max_radius/2 + grid_y * node_spacing
                positions[node['id']] = {'x': x, 'y': y}
                
        return positions
    
    async def auto_arrange_nodes(self, chat_id: str, method: str = 'kmeans', 
                               **kwargs) -> Dict[str, Any]:
        """Main method to auto-arrange nodes based on clustering"""
        try:
            # Generate embeddings
            embeddings = await self.generate_node_embeddings(chat_id)
            if not embeddings:
                return {'error': 'No embeddings generated', 'positions': {}}
            
            # Perform clustering
            if method == 'kmeans':
                cluster_result = self.cluster_nodes_kmeans(
                    embeddings, k=kwargs.get('k')
                )
            elif method == 'dbscan':
                cluster_result = self.cluster_nodes_dbscan(
                    embeddings, 
                    eps=kwargs.get('eps', 0.5),
                    min_samples=kwargs.get('min_samples', 2)
                )
            else:
                return {'error': f'Unknown clustering method: {method}'}
            
            # Get nodes from database
            chat = self.chat_service.get_chat(chat_id)
            if not chat or not chat.nodes:
                return {'error': 'No nodes found for clustering'}
                
            nodes = [node.__dict__ for node in chat.nodes]
            
            # Calculate new positions
            new_positions = self.calculate_cluster_positions(
                nodes, cluster_result['clusters'], kwargs.get('canvas_bounds')
            )
            
            return {
                'clusters': cluster_result['clusters'],
                'positions': new_positions,
                'cluster_info': cluster_result,
                'success': True
            }
            
        except Exception as e:
            logger.error(f"Error in auto_arrange_nodes: {e}")
            return {'error': str(e), 'positions': {}}