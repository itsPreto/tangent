from ChatPersistenceService import db, Reflection, Node, Chat
from EmbeddingService import EmbeddingService
from ReflectionIndexingService import ReflectionIndexingService
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import json
import uuid
import re
from sqlalchemy import func, and_, or_, desc, asc


class ReflectionService:
    """Service for managing AI reflection system - captures breakthrough moments and builds searchable knowledge base"""
    
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.indexing_service = ReflectionIndexingService()
    
    def create_reflection(self, reflection_data: Dict) -> str:
        """
        Create a new reflection from trigger data
        
        Args:
            reflection_data: Dictionary containing reflection information
                Required fields:
                - source_node_id: Node that triggered the reflection
                - source_chat_id: Chat containing the node
                - triggered_by: 'upvote' or 'thanks'
                - trigger_message_index: Index of message that was upvoted/thanked
                - problem_statement: Description of the problem that was solved
                - technical_challenge: Technical challenge that was overcome
                - solution_breakthrough: Key insight that led to the solution
                - key_insights: List of key insights learned
                - keywords: List of technical keywords for indexing
                - message_range_start: Start index of analyzed conversation
                - message_range_end: End index of analyzed conversation
                - conversation_length: Total messages at time of reflection
                
                Optional fields:
                - failed_approaches: List of failed approach descriptions
                - technologies: List of technologies involved
                - code_patterns: List of code patterns/snippets
                - error_patterns: List of common errors
                - domains: List of domain categories
                - complexity: 'low', 'medium', 'high', 'expert'
                - iteration_count: Number of attempts before breakthrough
                - time_to_solution: Minutes from problem to solution
                - embeddings: Vector embeddings for search
        
        Returns:
            reflection_id: UUID of created reflection
        """
        reflection_id = str(uuid.uuid4())
        
        # Generate embeddings for semantic search
        embeddings = self._generate_reflection_embeddings(reflection_data)
        
        # Extract enhanced keywords and metadata
        metadata = self.indexing_service.extract_keywords_and_metadata(reflection_data)
        
        # Enhance keywords with extracted technical keywords
        enhanced_keywords = list(set(
            reflection_data.get('keywords', []) + 
            metadata.get('technical_keywords', []) + 
            metadata.get('error_keywords', [])
        ))[:20]  # Limit to 20 keywords
        
        reflection = Reflection(
            id=reflection_id,
            source_node_id=reflection_data['source_node_id'],
            source_chat_id=reflection_data['source_chat_id'],
            triggered_by=reflection_data['triggered_by'],
            trigger_message_index=reflection_data['trigger_message_index'],
            problem_statement=reflection_data['problem_statement'],
            technical_challenge=reflection_data['technical_challenge'],
            solution_breakthrough=reflection_data['solution_breakthrough'],
            key_insights=reflection_data['key_insights'],
            keywords=enhanced_keywords,
            message_range_start=reflection_data['message_range_start'],
            message_range_end=reflection_data['message_range_end'],
            conversation_length=reflection_data['conversation_length'],
            
            # Optional fields with defaults
            failed_approaches=reflection_data.get('failed_approaches', []),
            technologies=reflection_data.get('technologies', []),
            code_patterns=reflection_data.get('code_patterns', []),
            error_patterns=reflection_data.get('error_patterns', []),
            domains=reflection_data.get('domains', []),
            complexity=reflection_data.get('complexity', 'medium'),
            iteration_count=reflection_data.get('iteration_count'),
            time_to_solution=reflection_data.get('time_to_solution'),
            embeddings=embeddings,
        )
        
        db.session.add(reflection)
        db.session.commit()
        
        return reflection_id
    
    def get_reflection(self, reflection_id: str) -> Optional[Dict]:
        """Get a reflection by ID"""
        reflection = Reflection.query.get(reflection_id)
        if not reflection:
            return None
        
        return self._reflection_to_dict(reflection)
    
    def update_reflection_usage(self, reflection_id: str, was_helpful: Optional[bool] = None) -> bool:
        """
        Update reflection usage statistics
        
        Args:
            reflection_id: UUID of reflection
            was_helpful: True if marked helpful, False if not helpful, None if just used
        
        Returns:
            Success boolean
        """
        reflection = Reflection.query.get(reflection_id)
        if not reflection:
            return False
        
        # Update usage count and last used timestamp
        reflection.usage_count = (reflection.usage_count or 0) + 1
        reflection.last_used = datetime.utcnow()
        
        # Update helpfulness counters if feedback provided
        if was_helpful is True:
            reflection.helpful_count = (reflection.helpful_count or 0) + 1
        elif was_helpful is False:
            reflection.not_helpful_count = (reflection.not_helpful_count or 0) + 1
        
        # Recalculate relevance score based on helpful ratio and usage
        self._update_relevance_score(reflection)
        
        db.session.commit()
        return True
    
    def search_reflections(self, query_params: Dict) -> List[Dict]:
        """
        Search for relevant reflections based on various criteria
        
        Args:
            query_params: Dictionary containing search parameters
                - keywords: List of keywords to match
                - technologies: List of technologies to filter by
                - domains: List of domains to filter by
                - complexity: Complexity level to match
                - min_relevance_score: Minimum relevance score
                - limit: Maximum number of results (default: 10)
                - exclude_node_id: Node ID to exclude from results
                - exclude_chat_id: Chat ID to exclude from results
        
        Returns:
            List of reflection dictionaries sorted by relevance
        """
        query = Reflection.query
        
        # Filter by keywords (OR match - any keyword matches)
        if 'keywords' in query_params and query_params['keywords']:
            keyword_filters = []
            for keyword in query_params['keywords']:
                keyword_filters.append(
                    func.json_extract(Reflection.keywords, '$').like(f'%{keyword}%')
                )
            query = query.filter(or_(*keyword_filters))
        
        # Filter by technologies (AND match - must have all technologies)
        if 'technologies' in query_params and query_params['technologies']:
            for tech in query_params['technologies']:
                query = query.filter(
                    func.json_extract(Reflection.technologies, '$').like(f'%{tech}%')
                )
        
        # Filter by domains (OR match - any domain matches)
        if 'domains' in query_params and query_params['domains']:
            domain_filters = []
            for domain in query_params['domains']:
                domain_filters.append(
                    func.json_extract(Reflection.domains, '$').like(f'%{domain}%')
                )
            query = query.filter(or_(*domain_filters))
        
        # Filter by complexity
        if 'complexity' in query_params:
            query = query.filter(Reflection.complexity == query_params['complexity'])
        
        # Filter by minimum relevance score
        if 'min_relevance_score' in query_params:
            query = query.filter(Reflection.relevance_score >= query_params['min_relevance_score'])
        
        # Exclude specific node or chat
        if 'exclude_node_id' in query_params:
            query = query.filter(Reflection.source_node_id != query_params['exclude_node_id'])
        
        if 'exclude_chat_id' in query_params:
            query = query.filter(Reflection.source_chat_id != query_params['exclude_chat_id'])
        
        # Order by relevance score (high to low), then by recency
        query = query.order_by(
            desc(Reflection.relevance_score),
            desc(Reflection.last_used),
            desc(Reflection.created_at)
        )
        
        # Apply limit
        limit = query_params.get('limit', 10)
        reflections = query.limit(limit).all()
        
        return [self._reflection_to_dict(r) for r in reflections]
    
    def get_reflections_by_node(self, node_id: str) -> List[Dict]:
        """Get all reflections for a specific node"""
        reflections = Reflection.query.filter_by(source_node_id=node_id).order_by(desc(Reflection.created_at)).all()
        return [self._reflection_to_dict(r) for r in reflections]
    
    def get_reflections_by_chat(self, chat_id: str) -> List[Dict]:
        """Get all reflections for a specific chat"""
        reflections = Reflection.query.filter_by(source_chat_id=chat_id).order_by(desc(Reflection.created_at)).all()
        return [self._reflection_to_dict(r) for r in reflections]
    
    def get_recent_reflections(self, limit: int = 10, days: int = 30) -> List[Dict]:
        """Get recent reflections within specified days"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        reflections = (Reflection.query
                      .filter(Reflection.created_at >= cutoff_date)
                      .order_by(desc(Reflection.created_at))
                      .limit(limit)
                      .all())
        return [self._reflection_to_dict(r) for r in reflections]
    
    def get_top_reflections(self, limit: int = 10) -> List[Dict]:
        """Get highest scoring reflections"""
        reflections = (Reflection.query
                      .order_by(desc(Reflection.relevance_score))
                      .limit(limit)
                      .all())
        return [self._reflection_to_dict(r) for r in reflections]
    
    def delete_reflection(self, reflection_id: str) -> bool:
        """Delete a reflection"""
        reflection = Reflection.query.get(reflection_id)
        if not reflection:
            return False
        
        db.session.delete(reflection)
        db.session.commit()
        return True
    
    def get_reflection_stats(self) -> Dict:
        """Get overall reflection system statistics"""
        total_reflections = Reflection.query.count()
        
        # Count by trigger type
        upvote_count = Reflection.query.filter_by(triggered_by='upvote').count()
        thanks_count = Reflection.query.filter_by(triggered_by='thanks').count()
        
        # Average relevance score
        avg_relevance = db.session.query(func.avg(Reflection.relevance_score)).scalar() or 0.0
        
        # Usage statistics
        total_usage = db.session.query(func.sum(Reflection.usage_count)).scalar() or 0
        total_helpful = db.session.query(func.sum(Reflection.helpful_count)).scalar() or 0
        total_not_helpful = db.session.query(func.sum(Reflection.not_helpful_count)).scalar() or 0
        
        # Recent activity (last 7 days)
        recent_cutoff = datetime.utcnow() - timedelta(days=7)
        recent_reflections = Reflection.query.filter(Reflection.created_at >= recent_cutoff).count()
        
        return {
            'total_reflections': total_reflections,
            'upvote_triggered': upvote_count,
            'thanks_triggered': thanks_count,
            'average_relevance_score': round(avg_relevance, 2),
            'total_usage_count': total_usage,
            'total_helpful_feedback': total_helpful,
            'total_not_helpful_feedback': total_not_helpful,
            'recent_reflections_7_days': recent_reflections,
            'helpfulness_ratio': round(total_helpful / max(total_helpful + total_not_helpful, 1), 2)
        }
    
    def extract_keywords_from_text(self, text: str) -> List[str]:
        """
        Extract technical keywords from text for indexing
        This is a simple implementation - could be enhanced with NLP libraries
        """
        # Common technical keywords and patterns
        technical_terms = {
            # Programming languages
            'javascript', 'typescript', 'python', 'java', 'rust', 'go', 'cpp', 'c++',
            'react', 'vue', 'angular', 'node', 'express', 'flask', 'django',
            
            # Technologies
            'sql', 'database', 'api', 'rest', 'graphql', 'json', 'xml', 'html', 'css',
            'docker', 'kubernetes', 'aws', 'git', 'github', 'mongodb', 'postgresql',
            
            # Concepts
            'function', 'component', 'service', 'class', 'method', 'variable', 'array',
            'object', 'string', 'number', 'boolean', 'async', 'await', 'promise',
            'hook', 'state', 'props', 'event', 'callback', 'closure', 'scope',
            'error', 'exception', 'bug', 'debug', 'test', 'refactor', 'optimize'
        }
        
        # Extract words and filter for technical terms
        import re
        words = re.findall(r'\b\w+\b', text.lower())
        keywords = list(set(word for word in words if word in technical_terms))
        
        # Also look for common error patterns
        error_patterns = re.findall(r'\b(?:error|exception|failed|undefined|null|cannot|unable)\s+\w+', text.lower())
        keywords.extend(error_patterns)
        
        return list(set(keywords))[:20]  # Limit to 20 keywords
    
    def _reflection_to_dict(self, reflection: Reflection) -> Dict:
        """Convert Reflection model to dictionary"""
        return {
            'id': reflection.id,
            'source_node_id': reflection.source_node_id,
            'source_chat_id': reflection.source_chat_id,
            'triggered_by': reflection.triggered_by,
            'trigger_message_index': reflection.trigger_message_index,
            'problem_statement': reflection.problem_statement,
            'technical_challenge': reflection.technical_challenge,
            'solution_breakthrough': reflection.solution_breakthrough,
            'failed_approaches': reflection.failed_approaches or [],
            'key_insights': reflection.key_insights or [],
            'technologies': reflection.technologies or [],
            'code_patterns': reflection.code_patterns or [],
            'error_patterns': reflection.error_patterns or [],
            'domains': reflection.domains or [],
            'complexity': reflection.complexity,
            'iteration_count': reflection.iteration_count,
            'time_to_solution': reflection.time_to_solution,
            'embeddings': reflection.embeddings,
            'keywords': reflection.keywords or [],
            'relevance_score': reflection.relevance_score,
            'usage_count': reflection.usage_count,
            'helpful_count': reflection.helpful_count,
            'not_helpful_count': reflection.not_helpful_count,
            'last_used': reflection.last_used.isoformat() if reflection.last_used else None,
            'message_range_start': reflection.message_range_start,
            'message_range_end': reflection.message_range_end,
            'conversation_length': reflection.conversation_length,
            'created_at': reflection.created_at.isoformat(),
            'updated_at': reflection.updated_at.isoformat()
        }
    
    def _update_relevance_score(self, reflection: Reflection):
        """Calculate and update relevance score based on usage and feedback"""
        usage_count = reflection.usage_count or 0
        helpful_count = reflection.helpful_count or 0
        not_helpful_count = reflection.not_helpful_count or 0
        
        # Base score from helpfulness ratio
        total_feedback = helpful_count + not_helpful_count
        if total_feedback > 0:
            helpfulness_ratio = helpful_count / total_feedback
        else:
            helpfulness_ratio = 0.5  # Neutral if no feedback
        
        # Usage frequency bonus (logarithmic to prevent runaway scores)
        import math
        usage_bonus = math.log(max(usage_count, 1)) / 10
        
        # Recency bonus (recent usage is weighted higher)
        recency_bonus = 0.0
        if reflection.last_used:
            days_since_use = (datetime.utcnow() - reflection.last_used).days
            recency_bonus = max(0, (30 - days_since_use) / 30) * 0.2
        
        # Combined score (0-1 scale)
        reflection.relevance_score = min(1.0, helpfulness_ratio + usage_bonus + recency_bonus)
    
    def calculate_contextual_relevance_score(self, reflection: Reflection, context_data: Dict, similarity_score: float = 0.0) -> float:
        """
        Calculate enhanced relevance score based on context similarity and multiple factors
        
        Args:
            reflection: Reflection object to score
            context_data: Current conversation context from RouterAgentService
            similarity_score: Optional semantic similarity score (0.0 to 1.0)
            
        Returns:
            Enhanced relevance score (0.0 to 1.0)
        """
        try:
            # Get base relevance score
            base_score = reflection.relevance_score or 0.5
            
            # Factor 1: Semantic similarity (highest weight)
            similarity_factor = similarity_score * 0.4
            
            # Factor 2: Technology overlap
            tech_overlap = self._calculate_technology_overlap(reflection, context_data)
            tech_factor = tech_overlap * 0.25
            
            # Factor 3: Domain match
            domain_match = self._calculate_domain_match(reflection, context_data)
            domain_factor = domain_match * 0.15
            
            # Factor 4: Complexity appropriateness
            complexity_match = self._calculate_complexity_match(reflection, context_data)
            complexity_factor = complexity_match * 0.1
            
            # Factor 5: Problem pattern similarity
            pattern_match = self._calculate_pattern_match(reflection, context_data)
            pattern_factor = pattern_match * 0.1
            
            # Combine all factors
            contextual_score = (
                similarity_factor + 
                tech_factor + 
                domain_factor + 
                complexity_factor + 
                pattern_factor
            )
            
            # Weighted combination of base score (30%) and contextual score (70%)
            final_score = (base_score * 0.3) + (contextual_score * 0.7)
            
            return min(1.0, max(0.0, final_score))
            
        except Exception as e:
            logger.error(f"Error calculating contextual relevance score: {e}")
            return reflection.relevance_score or 0.5
    
    def _calculate_technology_overlap(self, reflection: Reflection, context_data: Dict) -> float:
        """Calculate overlap between reflection and context technologies"""
        reflection_techs = set(tech.lower() for tech in reflection.technologies or [])
        context_techs = set(tech.lower() for tech in context_data.get('technologies', []))
        
        if not reflection_techs or not context_techs:
            return 0.0
        
        overlap = len(reflection_techs.intersection(context_techs))
        total = len(reflection_techs.union(context_techs))
        
        return overlap / total if total > 0 else 0.0
    
    def _calculate_domain_match(self, reflection: Reflection, context_data: Dict) -> float:
        """Calculate domain matching score"""
        reflection_domains = set(domain.lower() for domain in reflection.domains or [])
        context_domains = set(domain.lower() for domain in context_data.get('domains', []))
        
        if not context_domains:
            return 0.5  # Neutral if no context domains
        
        if not reflection_domains:
            return 0.0
        
        # Check for exact matches
        matches = reflection_domains.intersection(context_domains)
        return len(matches) / len(context_domains) if context_domains else 0.0
    
    def _calculate_complexity_match(self, reflection: Reflection, context_data: Dict) -> float:
        """Calculate complexity appropriateness score"""
        complexity_map = {'low': 1, 'medium': 2, 'high': 3, 'expert': 4}
        
        reflection_complexity = complexity_map.get(reflection.complexity, 2)
        context_complexity = complexity_map.get(context_data.get('complexity', 'medium'), 2)
        
        # Perfect match gets full score, adjacent levels get partial score
        diff = abs(reflection_complexity - context_complexity)
        if diff == 0:
            return 1.0
        elif diff == 1:
            return 0.7
        elif diff == 2:
            return 0.3
        else:
            return 0.0
    
    def _calculate_pattern_match(self, reflection: Reflection, context_data: Dict) -> float:
        """Calculate problem pattern similarity"""
        reflection_keywords = set(keyword.lower() for keyword in reflection.keywords or [])
        context_keywords = set(keyword.lower() for keyword in context_data.get('keywords', []))
        context_patterns = set(pattern.lower() for pattern in context_data.get('problem_patterns', []))
        
        # Combine context keywords and patterns
        context_terms = context_keywords.union(context_patterns)
        
        if not reflection_keywords or not context_terms:
            return 0.0
        
        overlap = len(reflection_keywords.intersection(context_terms))
        return min(1.0, overlap / len(context_terms)) if context_terms else 0.0
    
    def get_contextual_reflection_suggestions(self, context_data: Dict, limit: int = 5, min_score: float = 0.3) -> List[Dict]:
        """
        Get reflection suggestions with enhanced contextual relevance scoring
        
        Args:
            context_data: Current conversation context
            limit: Maximum number of suggestions
            min_score: Minimum relevance score threshold
            
        Returns:
            List of reflection suggestions with contextual scores
        """
        try:
            # Get all reflections
            reflections = Reflection.query.all()
            
            suggestions = []
            for reflection in reflections:
                # Calculate semantic similarity if embeddings exist
                similarity_score = 0.0
                if reflection.embeddings and context_data.get('keywords'):
                    # Create query text from context keywords
                    query_text = ' '.join(context_data['keywords'][:5])
                    query_embeddings = self.embedding_service.generate_embeddings(query_text)
                    if query_embeddings:
                        similarity_score = self._calculate_cosine_similarity(query_embeddings, reflection.embeddings)
                
                # Calculate contextual relevance score
                contextual_score = self.calculate_contextual_relevance_score(
                    reflection, context_data, similarity_score
                )
                
                # Only include if above threshold
                if contextual_score >= min_score:
                    reflection_dict = self._reflection_to_dict(reflection)
                    reflection_dict['contextual_relevance_score'] = contextual_score
                    reflection_dict['similarity_score'] = similarity_score
                    suggestions.append(reflection_dict)
            
            # Sort by contextual relevance score and limit
            suggestions.sort(key=lambda x: x['contextual_relevance_score'], reverse=True)
            return suggestions[:limit]
            
        except Exception as e:
            logger.error(f"Error getting contextual suggestions: {e}")
            return []
    
    def _generate_reflection_embeddings(self, reflection_data: Dict) -> List[float]:
        """
        Generate vector embeddings for a reflection to enable semantic search
        
        Args:
            reflection_data: Dictionary containing reflection information
            
        Returns:
            List of embedding values (typically 384 or 768 dimensions)
        """
        try:
            # Combine key text fields for embedding generation
            embedding_text = self._build_embedding_text(reflection_data)
            
            # Generate embeddings using the embedding service
            embeddings = self.embedding_service.generate_embeddings(embedding_text)
            
            return embeddings
            
        except Exception as e:
            print(f"[ReflectionService] Error generating embeddings: {e}")
            # Return empty list if embedding generation fails
            return []
    
    def _build_embedding_text(self, reflection_data: Dict) -> str:
        """
        Build composite text for embedding generation by combining key reflection fields
        """
        text_parts = []
        
        # Core content
        text_parts.append(reflection_data.get('problem_statement', ''))
        text_parts.append(reflection_data.get('technical_challenge', ''))
        text_parts.append(reflection_data.get('solution_breakthrough', ''))
        
        # Key insights
        insights = reflection_data.get('key_insights', [])
        if insights:
            text_parts.append(' '.join(insights))
        
        # Technologies and patterns
        technologies = reflection_data.get('technologies', [])
        if technologies:
            text_parts.append(' '.join(technologies))
        
        code_patterns = reflection_data.get('code_patterns', [])
        if code_patterns:
            text_parts.append(' '.join(code_patterns))
        
        # Keywords
        keywords = reflection_data.get('keywords', [])
        if keywords:
            text_parts.append(' '.join(keywords))
        
        # Failed approaches (important for understanding what doesn't work)
        failed_approaches = reflection_data.get('failed_approaches', [])
        if failed_approaches:
            text_parts.append(' '.join(failed_approaches))
        
        # Join all parts with spaces and clean up
        embedding_text = ' '.join(text_parts)
        
        # Clean up the text
        embedding_text = re.sub(r'\s+', ' ', embedding_text)  # Remove extra whitespace
        embedding_text = embedding_text.strip()
        
        return embedding_text
    
    def search_reflections_by_similarity(self, query_text: str, limit: int = 10, similarity_threshold: float = 0.7) -> List[Dict]:
        """
        Search reflections using semantic similarity via embeddings
        
        Args:
            query_text: Text to search for similar reflections
            limit: Maximum number of results to return
            similarity_threshold: Minimum similarity score (0.0 to 1.0)
            
        Returns:
            List of reflection dictionaries with similarity scores
        """
        try:
            # Generate embeddings for the query
            query_embeddings = self.embedding_service.generate_embeddings(query_text)
            
            if not query_embeddings:
                print("[ReflectionService] Failed to generate query embeddings")
                return []
            
            # Get all reflections with embeddings
            reflections = Reflection.query.filter(Reflection.embeddings.isnot(None)).all()
            
            results = []
            for reflection in reflections:
                try:
                    # Calculate cosine similarity
                    similarity = self._calculate_cosine_similarity(query_embeddings, reflection.embeddings)
                    
                    if similarity >= similarity_threshold:
                        reflection_dict = self._reflection_to_dict(reflection)
                        reflection_dict['similarity_score'] = similarity
                        results.append(reflection_dict)
                        
                except Exception as e:
                    print(f"[ReflectionService] Error calculating similarity for reflection {reflection.id}: {e}")
                    continue
            
            # Sort by similarity score (descending) and limit results
            results.sort(key=lambda x: x['similarity_score'], reverse=True)
            return results[:limit]
            
        except Exception as e:
            print(f"[ReflectionService] Error in similarity search: {e}")
            return []
    
    def _calculate_cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            Cosine similarity score (0.0 to 1.0)
        """
        try:
            import numpy as np
            
            # Convert to numpy arrays
            a = np.array(vec1)
            b = np.array(vec2)
            
            # Calculate cosine similarity
            dot_product = np.dot(a, b)
            norm_a = np.linalg.norm(a)
            norm_b = np.linalg.norm(b)
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            similarity = dot_product / (norm_a * norm_b)
            
            # Ensure the result is between 0 and 1
            return max(0.0, min(1.0, similarity))
            
        except Exception as e:
            print(f"[ReflectionService] Error calculating cosine similarity: {e}")
            return 0.0
    
    def find_related_reflections(self, reflection_id: str, limit: int = 5) -> List[Dict]:
        """
        Find reflections that are similar to a given reflection
        
        Args:
            reflection_id: ID of the source reflection
            limit: Maximum number of similar reflections to return
            
        Returns:
            List of similar reflection dictionaries with similarity scores
        """
        try:
            # Get the source reflection
            source_reflection = Reflection.query.get(reflection_id)
            if not source_reflection or not source_reflection.embeddings:
                return []
            
            # Find similar reflections (excluding the source reflection)
            all_reflections = Reflection.query.filter(
                and_(
                    Reflection.id != reflection_id,
                    Reflection.embeddings.isnot(None)
                )
            ).all()
            
            results = []
            for reflection in all_reflections:
                try:
                    similarity = self._calculate_cosine_similarity(
                        source_reflection.embeddings, 
                        reflection.embeddings
                    )
                    
                    if similarity > 0.6:  # Lower threshold for related reflections
                        reflection_dict = self._reflection_to_dict(reflection)
                        reflection_dict['similarity_score'] = similarity
                        results.append(reflection_dict)
                        
                except Exception as e:
                    print(f"[ReflectionService] Error calculating similarity: {e}")
                    continue
            
            # Sort by similarity and return top results
            results.sort(key=lambda x: x['similarity_score'], reverse=True)
            return results[:limit]
            
        except Exception as e:
            print(f"[ReflectionService] Error finding related reflections: {e}")
            return []
    
    def update_reflection_embeddings(self, reflection_id: str) -> bool:
        """
        Regenerate embeddings for a specific reflection (useful after updates)
        
        Args:
            reflection_id: ID of reflection to update
            
        Returns:
            True if successful, False otherwise
        """
        try:
            reflection = Reflection.query.get(reflection_id)
            if not reflection:
                return False
            
            # Convert reflection to dict format for embedding generation
            reflection_data = {
                'problem_statement': reflection.problem_statement,
                'technical_challenge': reflection.technical_challenge,
                'solution_breakthrough': reflection.solution_breakthrough,
                'key_insights': reflection.key_insights or [],
                'technologies': reflection.technologies or [],
                'code_patterns': reflection.code_patterns or [],
                'keywords': reflection.keywords or [],
                'failed_approaches': reflection.failed_approaches or []
            }
            
            # Generate new embeddings
            new_embeddings = self._generate_reflection_embeddings(reflection_data)
            
            # Update the reflection
            reflection.embeddings = new_embeddings
            db.session.commit()
            
            return True
            
        except Exception as e:
            print(f"[ReflectionService] Error updating embeddings: {e}")
            db.session.rollback()
            return False
    
    def search_by_advanced_criteria(self, criteria: Dict) -> List[Dict]:
        """
        Search reflections using advanced criteria and metadata
        
        Args:
            criteria: Dictionary with search criteria from indexing service
            
        Returns:
            List of matching reflections with relevance scores
        """
        return self.indexing_service.search_by_advanced_criteria(criteria)
    
    def get_reflection_metadata(self, reflection_id: str) -> Optional[Dict]:
        """
        Get detailed metadata for a specific reflection
        
        Args:
            reflection_id: ID of the reflection
            
        Returns:
            Dictionary with extracted metadata or None if not found
        """
        try:
            reflection = Reflection.query.get(reflection_id)
            if not reflection:
                return None
            
            # Build reflection data for metadata extraction
            reflection_data = {
                'problem_statement': reflection.problem_statement,
                'technical_challenge': reflection.technical_challenge,
                'solution_breakthrough': reflection.solution_breakthrough,
                'key_insights': reflection.key_insights or [],
                'failed_approaches': reflection.failed_approaches or [],
                'technologies': reflection.technologies or [],
                'code_patterns': reflection.code_patterns or [],
                'keywords': reflection.keywords or [],
                'iteration_count': reflection.iteration_count,
                'time_to_solution': reflection.time_to_solution
            }
            
            return self.indexing_service.extract_keywords_and_metadata(reflection_data)
            
        except Exception as e:
            print(f"[ReflectionService] Error getting reflection metadata: {e}")
            return None
    
    def update_all_reflection_metadata(self) -> Dict:
        """
        Update metadata for all existing reflections using the indexing service
        
        Returns:
            Dictionary with update statistics
        """
        return self.indexing_service.update_all_reflection_metadata()
    
    def search_reflections_by_keyword_patterns(self, 
                                              technical_keywords: List[str] = None,
                                              error_keywords: List[str] = None,
                                              domains: List[str] = None,
                                              complexity: str = None,
                                              limit: int = 10) -> List[Dict]:
        """
        Search reflections by specific keyword patterns and metadata
        
        Args:
            technical_keywords: List of technical terms to search for
            error_keywords: List of error-related terms
            domains: List of technical domains
            complexity: Complexity level filter
            limit: Maximum number of results
            
        Returns:
            List of matching reflections
        """
        try:
            query = Reflection.query
            
            # Apply filters based on provided criteria
            if technical_keywords:
                # Search in keywords field
                for keyword in technical_keywords:
                    query = query.filter(Reflection.keywords.contains([keyword]))
            
            if domains:
                # Search in domains field
                for domain in domains:
                    query = query.filter(Reflection.domains.contains([domain]))
            
            if complexity:
                query = query.filter(Reflection.complexity == complexity)
            
            # Order by relevance score and creation date
            query = query.order_by(desc(Reflection.relevance_score), desc(Reflection.created_at))
            
            reflections = query.limit(limit).all()
            
            return [self._reflection_to_dict(reflection) for reflection in reflections]
            
        except Exception as e:
            print(f"[ReflectionService] Error in keyword pattern search: {e}")
            return []