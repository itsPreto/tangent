import numpy as np
import json
import requests
from typing import List, Dict, Any, Optional, Tuple
from sklearn.cluster import KMeans, DBSCAN
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from EmbeddingService import EmbeddingService
from ChatPersistenceService import ChatPersistenceService
import logging
import threading
import time
from datetime import datetime

class ClusteringService:
    def __init__(self, embedding_service: EmbeddingService, persistence_service: ChatPersistenceService):
        """
        Initialize the clustering service with embedding and persistence services
        """
        self.logger = logging.getLogger(__name__)
        self.embedding_service = embedding_service
        self.persistence_service = persistence_service
        self.app = None  # Will be set from Flask app context
        self.clustering_status = {
            'is_running': False,
            'progress': 0.0,
            'status_message': '',
            'total_workspaces': 0,
            'processed_workspaces': 0,
            'clusters': []
        }
        self.clustering_thread = None
        self.workspace_embeddings = {}  # Cache for embeddings
        self.cached_clusters = []  # Persistent clustering results
        self.cache_timestamp = None  # When clusters were last generated
        
    def extract_workspace_content(self, chat_data: Dict[str, Any]) -> str:
        """
        Extract meaningful content from a workspace for embedding generation
        """
        content_parts = []
        
        # Add chat title
        if chat_data.get('title'):
            content_parts.append(f"Title: {chat_data['title']}")
        
        # The nodes structure is different - it's a single nested structure, not a list
        def extract_from_node(node):
            if not node:
                return
            
            self.logger.debug(f"Processing node: {node.get('id', 'unknown')} with keys: {list(node.keys())}")
            
            # Add node title if available
            if node.get('title'):
                content_parts.append(f"Section: {node['title']}")
            
            # Extract messages
            messages = node.get('messages', [])
            self.logger.debug(f"Found {len(messages)} messages in node")
            
            for i, message in enumerate(messages):
                if isinstance(message, dict):
                    self.logger.debug(f"Message {i} keys: {list(message.keys())}")
                    
                    # Try multiple content field names
                    content = None
                    if 'content' in message:
                        content = message['content']
                    elif 'text' in message:
                        content = message['text']
                    elif 'message' in message:
                        content = message['message']
                    
                    if content:
                        if isinstance(content, list):
                            # Handle list of content items
                            for item in content:
                                if isinstance(item, dict) and 'text' in item:
                                    content_parts.append(str(item['text'])[:500])
                                elif isinstance(item, str):
                                    content_parts.append(str(item)[:500])
                        elif isinstance(content, str):
                            content_parts.append(str(content)[:500])
                        elif isinstance(content, dict) and 'text' in content:
                            content_parts.append(str(content['text'])[:500])
                    
                    # Also try to get the role and add some context
                    role = message.get('role', '')
                    if role in ['user', 'assistant'] and content:
                        content_parts.append(f"{role}: {str(content)[:400]}")
            
            # Recursively process children
            children = node.get('children', [])
            for child in children:
                extract_from_node(child)
        
        # Extract from the main node structure
        nodes = chat_data.get('nodes')
        if nodes:
            extract_from_node(nodes)
        else:
            self.logger.warning(f"No 'nodes' key found in chat_data. Available keys: {list(chat_data.keys())}")
        
        # Join all content and limit total length
        full_content = ' '.join(content_parts)
        return full_content[:8000]  # Limit to 8k characters for embedding efficiency
    
    def generate_workspace_embeddings(self, force_refresh: bool = False) -> Dict[str, np.ndarray]:
        """
        Generate embeddings for all workspaces
        """
        try:
            self.clustering_status['status_message'] = 'Loading workspaces...'
            self.clustering_status['progress'] = 0.1
            
            # Get all chats
            chats = self.persistence_service.list_chats()
            total_chats = len(chats)
            self.clustering_status['total_workspaces'] = total_chats
            
            if total_chats == 0:
                self.logger.warning("No workspaces found for clustering")
                return {}
            
            embeddings = {}
            contents = []
            chat_ids = []
            
            self.clustering_status['status_message'] = 'Extracting workspace content...'
            
            for i, chat in enumerate(chats):
                try:
                    # Update progress
                    progress = 0.1 + (i / total_chats) * 0.4  # 10-50% for content extraction
                    self.clustering_status['progress'] = progress
                    self.clustering_status['processed_workspaces'] = i
                    
                    # Get chat ID safely
                    chat_id = chat['id'] if isinstance(chat, dict) else getattr(chat, 'id', None)
                    if not chat_id:
                        continue
                    
                    # Get full chat data with nodes
                    chat_data = self.persistence_service.get_chat(chat_id)
                    if not chat_data:
                        continue
                    
                    # Check if we need to regenerate embedding
                    chat_updated_at = chat.get('updatedAt', '') if isinstance(chat, dict) else getattr(chat, 'updated_at', '')
                    cache_key = f"{chat_id}_{chat_updated_at}"
                    if not force_refresh and cache_key in self.workspace_embeddings:
                        embeddings[chat_id] = self.workspace_embeddings[cache_key]
                        continue
                    
                    # Extract content
                    content = self.extract_workspace_content(chat_data)
                    self.logger.debug(f"Extracted content for {chat_id}: {content[:200]}...")
                    if content.strip():
                        contents.append(content)
                        chat_ids.append(chat_id)
                    else:
                        self.logger.warning(f"No content extracted for workspace {chat_id}. Chat data keys: {list(chat_data.keys()) if chat_data else 'None'}")
                    
                except Exception as e:
                    chat_id_for_error = chat['id'] if isinstance(chat, dict) else getattr(chat, 'id', 'unknown')
                    self.logger.error(f"Error processing workspace {chat_id_for_error}: {e}")
                    continue
            
            if not contents:
                self.logger.warning("No valid content found for embedding generation")
                return {}
            
            # Generate embeddings in batches
            self.clustering_status['status_message'] = 'Generating embeddings...'
            self.clustering_status['progress'] = 0.5
            
            batch_size = 10
            for i in range(0, len(contents), batch_size):
                batch_contents = contents[i:i + batch_size]
                batch_ids = chat_ids[i:i + batch_size]
                
                # Update progress
                progress = 0.5 + (i / len(contents)) * 0.3  # 50-80% for embedding generation
                self.clustering_status['progress'] = progress
                
                try:
                    batch_embeddings = self.embedding_service.generate_embeddings(batch_contents)
                    
                    for j, embedding in enumerate(batch_embeddings):
                        chat_id = batch_ids[j]
                        embeddings[chat_id] = embedding
                        
                        # Cache the embedding
                        chat = next((c for c in chats if c['id'] == chat_id), None)
                        if chat:
                            cache_key = f"{chat_id}_{chat.get('updatedAt', '')}"
                            self.workspace_embeddings[cache_key] = embedding
                
                except Exception as e:
                    self.logger.error(f"Error generating embeddings for batch starting at {i}: {e}")
                    continue
            
            self.clustering_status['status_message'] = 'Embeddings generated successfully'
            self.clustering_status['progress'] = 0.8
            
            return embeddings
            
        except Exception as e:
            self.logger.error(f"Error generating workspace embeddings: {e}")
            self.clustering_status['status_message'] = f'Error: {str(e)}'
            return {}
    
    def cluster_workspaces(self, method: str = 'kmeans', n_clusters: Optional[int] = None, 
                          min_samples: int = 2, eps: float = 0.5) -> List[Dict[str, Any]]:
        """
        Cluster workspaces based on their embeddings
        """
        try:
            self.clustering_status['status_message'] = 'Starting clustering...'
            self.clustering_status['progress'] = 0.8
            
            # Generate embeddings
            embeddings = self.generate_workspace_embeddings()
            if not embeddings:
                return []
            
            # Prepare data for clustering
            workspace_ids = list(embeddings.keys())
            embedding_matrix = np.array([embeddings[id] for id in workspace_ids])
            
            # Normalize embeddings
            scaler = StandardScaler()
            normalized_embeddings = scaler.fit_transform(embedding_matrix)
            
            self.clustering_status['status_message'] = 'Running clustering algorithm...'
            self.clustering_status['progress'] = 0.9
            
            # Perform clustering
            if method == 'kmeans':
                # Auto-determine number of clusters if not specified
                if n_clusters is None:
                    n_clusters = min(max(2, len(workspace_ids) // 3), 8)  # 2-8 clusters
                
                clusterer = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
                cluster_labels = clusterer.fit_predict(normalized_embeddings)
                
            elif method == 'dbscan':
                clusterer = DBSCAN(eps=eps, min_samples=min_samples)
                cluster_labels = clusterer.fit_predict(normalized_embeddings)
                
            else:
                raise ValueError(f"Unknown clustering method: {method}")
            
            # Organize results
            clusters = {}
            for i, workspace_id in enumerate(workspace_ids):
                cluster_id = int(cluster_labels[i])
                if cluster_id not in clusters:
                    clusters[cluster_id] = []
                clusters[cluster_id].append(workspace_id)
            
            # Format cluster results
            formatted_clusters = []
            for cluster_id, workspace_ids in clusters.items():
                if cluster_id == -1:  # DBSCAN noise points
                    continue
                
                if len(workspace_ids) < 2:  # Skip single-item clusters
                    continue
                
                # Get workspace details with content samples for LLM naming
                cluster_workspaces = []
                for workspace_id in workspace_ids:
                    try:
                        chat_data = self.persistence_service.get_chat(workspace_id)
                        if chat_data:
                            # Extract content sample for LLM naming
                            content_sample = self.extract_workspace_content(chat_data)[:300]  # First 300 chars
                            
                            cluster_workspaces.append({
                                'id': workspace_id,
                                'title': chat_data.get('title', 'Untitled'),
                                'nodeCount': len(chat_data.get('nodes', [])) if chat_data.get('nodes') else 0,
                                'lastUpdated': chat_data.get('updatedAt', ''),
                                'tags': chat_data.get('tags', []),
                                'content_sample': content_sample  # For LLM naming
                            })
                    except Exception as e:
                        self.logger.error(f"Error loading workspace {workspace_id}: {e}")
                        continue
                
                if cluster_workspaces:
                    # Generate cluster title using LLM based on content
                    cluster_title = self.generate_cluster_title_llm(cluster_workspaces)
                    
                    # Clean up workspaces for frontend (remove content_sample)
                    clean_workspaces = []
                    for ws in cluster_workspaces:
                        clean_ws = {k: v for k, v in ws.items() if k != 'content_sample'}
                        clean_workspaces.append(clean_ws)
                    
                    formatted_clusters.append({
                        'id': f'cluster_{cluster_id}',
                        'title': cluster_title,
                        'workspaces': clean_workspaces,
                        'commonTags': self.extract_common_tags(clean_workspaces),
                        'size': len(clean_workspaces)
                    })
            
            # Cache the results for persistence
            self.cached_clusters = formatted_clusters
            self.cache_timestamp = datetime.now()
            
            self.clustering_status['clusters'] = formatted_clusters
            self.clustering_status['status_message'] = f'Clustering complete: {len(formatted_clusters)} clusters found'
            self.clustering_status['progress'] = 1.0
            
            return formatted_clusters
            
        except Exception as e:
            self.logger.error(f"Error clustering workspaces: {e}")
            self.clustering_status['status_message'] = f'Clustering failed: {str(e)}'
            return []
    
    def generate_cluster_title_llm(self, workspaces: List[Dict[str, Any]]) -> str:
        """
        Generate a descriptive title for a cluster using LLM based on workspace content
        """
        try:
            # Collect content from all workspaces in the cluster
            cluster_content = []
            for workspace in workspaces:
                title = workspace.get('title', 'Untitled')
                cluster_content.append(f"Workspace: {title}")
                
                # Add a sample of content if available
                if 'content_sample' in workspace:
                    cluster_content.append(f"Sample: {workspace['content_sample'][:200]}")
            
            content_summary = '\n'.join(cluster_content)
            
            # Create prompt for naming
            prompt = f"""Based on the following group of related conversation workspaces, generate a short, descriptive name (2-4 words max) that captures the main theme or topic:

{content_summary}

Requirements:
- Must be 2-4 words maximum
- Should capture the main theme/topic
- Be specific and meaningful
- Avoid generic terms like "Projects" or "Workspaces"
- Examples: "JavaScript Debugging", "Recipe Ideas", "Travel Planning", "AI Ethics Discussion"

Generate only the name, nothing else:"""

            # Make LLM request to Ollama (fastest local option)
            response = requests.post(
                'http://localhost:11434/api/generate',
                json={
                    'model': 'qwen3:0.6b',  # Fast model for naming
                    'prompt': prompt,
                    'stream': False,
                    'options': {
                        'temperature': 0.3,  # Low temperature for consistent naming
                        'num_predict': 50,   # Longer to get past think tags
                    }
                },
                timeout=15  # Quick timeout for fast naming
            )
            
            if response.status_code == 200:
                result = response.json()
                generated_name = result.get('response', '').strip()
                
                # Filter out <think> content
                import re
                # Remove everything between <think> and </think> tags
                generated_name = re.sub(r'<think>.*?</think>', '', generated_name, flags=re.DOTALL)
                # Remove any remaining XML-like tags
                generated_name = re.sub(r'<[^>]*>', '', generated_name)
                # Clean up whitespace and common junk
                generated_name = generated_name.strip().strip('"\'.,;:!?\n-')
                
                # Only return if it looks like a valid name
                if generated_name and len(generated_name) < 50 and len(generated_name.split()) <= 6:
                    return generated_name
                
        except Exception as e:
            self.logger.warning(f"LLM naming failed, falling back to simple naming: {e}")
        
        # Fallback to simple naming
        return self.generate_cluster_title_simple(workspaces)
    
    def generate_cluster_title_simple(self, workspaces: List[Dict[str, Any]]) -> str:
        """
        Generate a descriptive title for a cluster based on workspace titles (fallback)
        """
        titles = [w.get('title', '') for w in workspaces if w.get('title')]
        
        # Simple heuristic: find common words in titles
        if titles:
            words = []
            for title in titles:
                words.extend(title.lower().split())
            
            # Count word frequency
            word_count = {}
            for word in words:
                if len(word) > 3:  # Ignore short words
                    word_count[word] = word_count.get(word, 0) + 1
            
            # Find most common meaningful word
            if word_count:
                common_word = max(word_count.items(), key=lambda x: x[1])[0]
                return f"{common_word.capitalize()} Projects"
        
        # Fallback to generic name
        return f"Group of {len(workspaces)} workspaces"
    
    def extract_common_tags(self, workspaces: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Extract tags that appear in multiple workspaces in the cluster
        """
        tag_count = {}
        for workspace in workspaces:
            tags = workspace.get('tags', [])
            for tag in tags:
                tag_name = tag if isinstance(tag, str) else tag.get('name', '')
                if tag_name:
                    tag_count[tag_name] = tag_count.get(tag_name, 0) + 1
        
        # Return tags that appear in at least 30% of workspaces
        threshold = max(1, len(workspaces) * 0.3)
        common_tags = []
        for tag_name, count in tag_count.items():
            if count >= threshold:
                common_tags.append({
                    'id': tag_name,
                    'name': tag_name,
                    'color': '#6366f1'  # Default color
                })
        
        return common_tags
    
    def start_clustering_background(self, method: str = 'kmeans', **kwargs):
        """
        Start clustering in a background thread
        """
        if self.clustering_status['is_running']:
            self.logger.warning("Clustering is already running")
            return
        
        # Capture the current Flask app context
        from flask import current_app
        app = current_app._get_current_object()
        
        self.clustering_status = {
            'is_running': True,
            'progress': 0.0,
            'status_message': 'Initializing clustering...',
            'total_workspaces': 0,
            'processed_workspaces': 0,
            'clusters': []
        }
        
        def clustering_worker():
            try:
                # Push the app context into the background thread
                with app.app_context():
                    self.cluster_workspaces(method=method, **kwargs)
            except Exception as e:
                self.logger.error(f"Background clustering failed: {e}")
                self.clustering_status['status_message'] = f'Clustering failed: {str(e)}'
            finally:
                self.clustering_status['is_running'] = False
        
        self.clustering_thread = threading.Thread(target=clustering_worker)
        self.clustering_thread.daemon = True
        self.clustering_thread.start()
    
    def get_clustering_status(self) -> Dict[str, Any]:
        """
        Get the current clustering status and progress
        """
        status = self.clustering_status.copy()
        
        # If not currently running and we have cached clusters, return them
        if not status['is_running'] and self.cached_clusters:
            status['clusters'] = self.cached_clusters
            status['status_message'] = f'Cached clusters available: {len(self.cached_clusters)} groups'
            status['progress'] = 1.0
            
        return status
    
    def stop_clustering(self):
        """
        Stop the clustering process
        """
        if self.clustering_thread and self.clustering_thread.is_alive():
            # Note: Python doesn't have a clean way to stop threads
            # This just marks it as not running, the thread will finish naturally
            self.clustering_status['is_running'] = False
            self.clustering_status['status_message'] = 'Stopping clustering...'
    
    def clear_all_data(self):
        """
        Clear all clustering data and caches
        """
        try:
            self.logger.info("🚨 Clearing all clustering data")
            
            # Stop any running clustering
            self.stop_clustering()
            
            # Clear cached data
            self.workspace_embeddings = {}
            self.cached_clusters = []
            self.cache_timestamp = None
            
            # Reset status
            self.clustering_status = {
                'is_running': False,
                'progress': 0.0,
                'status_message': 'Cleared',
                'total_workspaces': 0,
                'processed_workspaces': 0,
                'clusters': []
            }
            
            self.logger.info("✅ Clustering data cleared successfully")
            
        except Exception as e:
            self.logger.error(f"❌ Error clearing clustering data: {e}")