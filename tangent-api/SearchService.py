import re
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy import and_, or_, func
from ChatPersistenceService import Chat, Node
from EmbeddingService import EmbeddingService

logger = logging.getLogger(__name__)

class SearchService:
    """
    Advanced search service for finding nodes and branches with both text-based and semantic search
    """
    
    def __init__(self, chat_service, embedding_service: EmbeddingService):
        self.chat_service = chat_service
        self.embedding_service = embedding_service
        
    def extract_node_text(self, node) -> str:
        """Extract searchable text from a node"""
        text_parts = []
        
        # Add node title
        if node.title:
            text_parts.append(node.title)
            
        # Add message content
        if node.messages:
            try:
                messages = json.loads(node.messages) if isinstance(node.messages, str) else node.messages
                for message in messages:
                    if isinstance(message, dict):
                        content = message.get('content', '')
                        if isinstance(content, str):
                            text_parts.append(content)
                        elif isinstance(content, list):
                            for part in content:
                                if isinstance(part, dict) and part.get('type') == 'text':
                                    text_parts.append(part.get('text', ''))
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(f"Error parsing messages for node {node.id}: {e}")
                
        # Add media content if available
        if hasattr(node, 'node_metadata') and node.node_metadata:
            try:
                metadata = json.loads(node.node_metadata) if isinstance(node.node_metadata, str) else node.node_metadata
                if metadata.get('mediaContent') and metadata['mediaContent'].get('analysis'):
                    text_parts.append(f"Media: {metadata['mediaContent']['analysis']}")
            except (json.JSONDecodeError, TypeError):
                pass
                
        return ' '.join(text_parts)
    
    def text_search_nodes(self, query: str, chat_id: str = None, 
                         search_titles: bool = True, search_content: bool = True,
                         case_sensitive: bool = False, regex: bool = False) -> List[Dict[str, Any]]:
        """
        Perform text-based search on nodes
        """
        try:
            # Build base query
            db_session = self.chat_service.db.session
            query_builder = db_session.query(Node)
            
            if chat_id:
                query_builder = query_builder.filter(Node.chat_id == chat_id)
            
            # Get all nodes to search through
            nodes = query_builder.all()
            
            results = []
            
            # Prepare search pattern
            search_pattern = query
            flags = 0 if case_sensitive else re.IGNORECASE
            
            if regex:
                try:
                    pattern = re.compile(search_pattern, flags)
                except re.error as e:
                    logger.error(f"Invalid regex pattern: {e}")
                    return []
            else:
                # Escape special regex characters for literal search
                search_pattern = re.escape(search_pattern)
                pattern = re.compile(search_pattern, flags)
            
            for node in nodes:
                matches = []
                score = 0
                
                # Search in title
                if search_titles and node.title:
                    title_matches = list(pattern.finditer(node.title))
                    if title_matches:
                        matches.extend([{
                            'type': 'title',
                            'text': node.title,
                            'matches': [(m.start(), m.end()) for m in title_matches]
                        }])
                        score += len(title_matches) * 2  # Title matches weighted higher
                
                # Search in content
                if search_content:
                    content_text = self.extract_node_text(node)
                    if content_text:
                        content_matches = list(pattern.finditer(content_text))
                        if content_matches:
                            # Group matches by context (100 chars around each match)
                            contexts = []
                            for match in content_matches:
                                start = max(0, match.start() - 50)
                                end = min(len(content_text), match.end() + 50)
                                context = content_text[start:end]
                                contexts.append({
                                    'context': context,
                                    'match_start': match.start() - start,
                                    'match_end': match.end() - start
                                })
                            
                            matches.append({
                                'type': 'content',
                                'contexts': contexts[:5]  # Limit to first 5 matches
                            })
                            score += len(content_matches)
                
                if matches:
                    results.append({
                        'node_id': node.id,
                        'chat_id': node.chat_id,
                        'title': node.title,
                        'type': node.type,
                        'x': node.x,
                        'y': node.y,
                        'matches': matches,
                        'score': score,
                        'match_type': 'text'
                    })
            
            # Sort by relevance score (descending)
            results.sort(key=lambda x: x['score'], reverse=True)
            return results
            
        except Exception as e:
            logger.error(f"Error in text search: {e}")
            return []
    
    def semantic_search_nodes(self, query: str, chat_id: str = None, 
                            limit: int = 10, similarity_threshold: float = 0.7) -> List[Dict[str, Any]]:
        """
        Perform semantic search using embeddings
        """
        try:
            # Use the embedding service to search nodes
            embedding_results = self.embedding_service.search_nodes(query, chat_id, limit)
            
            results = []
            for result in embedding_results:
                if result['similarity'] >= similarity_threshold:
                    # Get additional node information from database
                    db_session = self.chat_service.db.session
                    node = db_session.query(Node).filter(Node.id == result['node_id']).first()
                    
                    if node:
                        results.append({
                            'node_id': node.id,
                            'chat_id': node.chat_id,
                            'title': node.title,
                            'type': node.type,
                            'x': node.x,
                            'y': node.y,
                            'similarity': result['similarity'],
                            'content_preview': result['content'][:200] + '...' if len(result['content']) > 200 else result['content'],
                            'match_type': 'semantic'
                        })
            
            return results
            
        except Exception as e:
            logger.error(f"Error in semantic search: {e}")
            return []
    
    def hybrid_search_nodes(self, query: str, chat_id: str = None, 
                          limit: int = 20, text_weight: float = 0.4, 
                          semantic_weight: float = 0.6) -> List[Dict[str, Any]]:
        """
        Combine text and semantic search results
        """
        try:
            # Perform both searches
            text_results = self.text_search_nodes(query, chat_id)
            semantic_results = self.semantic_search_nodes(query, chat_id, limit * 2)
            
            # Normalize scores and combine results
            combined_results = {}
            
            # Process text results
            max_text_score = max([r['score'] for r in text_results]) if text_results else 1
            for result in text_results:
                node_id = result['node_id']
                normalized_score = (result['score'] / max_text_score) * text_weight
                
                combined_results[node_id] = {
                    **result,
                    'combined_score': normalized_score,
                    'text_score': result['score'],
                    'semantic_score': 0
                }
            
            # Process semantic results
            for result in semantic_results:
                node_id = result['node_id']
                semantic_score = result['similarity'] * semantic_weight
                
                if node_id in combined_results:
                    # Update existing result
                    combined_results[node_id]['combined_score'] += semantic_score
                    combined_results[node_id]['semantic_score'] = result['similarity']
                    if 'content_preview' not in combined_results[node_id]:
                        combined_results[node_id]['content_preview'] = result['content_preview']
                else:
                    # Add new result
                    combined_results[node_id] = {
                        **result,
                        'combined_score': semantic_score,
                        'text_score': 0,
                        'semantic_score': result['similarity']
                    }
            
            # Sort by combined score and limit results
            final_results = list(combined_results.values())
            final_results.sort(key=lambda x: x['combined_score'], reverse=True)
            
            return final_results[:limit]
            
        except Exception as e:
            logger.error(f"Error in hybrid search: {e}")
            return []
    
    def search_nodes_by_type(self, node_type: str, chat_id: str = None) -> List[Dict[str, Any]]:
        """
        Search nodes by type (branch, main, media, etc.)
        """
        try:
            db_session = self.chat_service.db.session
            query_builder = db_session.query(Node).filter(Node.type == node_type)
            
            if chat_id:
                query_builder = query_builder.filter(Node.chat_id == chat_id)
                
            nodes = query_builder.all()
            
            results = []
            for node in nodes:
                results.append({
                    'node_id': node.id,
                    'chat_id': node.chat_id,
                    'title': node.title,
                    'type': node.type,
                    'x': node.x,
                    'y': node.y,
                    'match_type': 'type_filter'
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error searching by type: {e}")
            return []
    
    def search_nodes_in_area(self, chat_id: str, x_min: float, y_min: float, 
                           x_max: float, y_max: float) -> List[Dict[str, Any]]:
        """
        Search nodes within a specific canvas area
        """
        try:
            db_session = self.chat_service.db.session
            nodes = db_session.query(Node).filter(
                and_(
                    Node.chat_id == chat_id,
                    Node.x >= x_min,
                    Node.x <= x_max,
                    Node.y >= y_min,
                    Node.y <= y_max
                )
            ).all()
            
            results = []
            for node in nodes:
                results.append({
                    'node_id': node.id,
                    'chat_id': node.chat_id,
                    'title': node.title,
                    'type': node.type,
                    'x': node.x,
                    'y': node.y,
                    'match_type': 'area_filter'
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error searching in area: {e}")
            return []
    
    def get_search_suggestions(self, partial_query: str, chat_id: str = None, 
                             limit: int = 5) -> List[str]:
        """
        Get search suggestions based on partial query
        """
        try:
            db_session = self.chat_service.db.session
            query_builder = db_session.query(Node.title).filter(Node.title.isnull() == False)
            
            if chat_id:
                query_builder = query_builder.filter(Node.chat_id == chat_id)
            
            # Find titles that contain the partial query
            titles = query_builder.filter(
                Node.title.ilike(f'%{partial_query}%')
            ).distinct().limit(limit * 2).all()
            
            # Extract unique suggestions
            suggestions = []
            seen = set()
            
            for (title,) in titles:
                if title and title.lower() not in seen:
                    suggestions.append(title)
                    seen.add(title.lower())
                    if len(suggestions) >= limit:
                        break
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error getting search suggestions: {e}")
            return []