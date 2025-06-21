import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
from sklearn.cluster import HDBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer
import umap
from collections import Counter, defaultdict
import re
import logging
from datetime import datetime, timedelta
import json

class AnalyticsService:
    def __init__(self, embedding_service):
        """
        Initialize analytics service with embedding service dependency
        """
        self.logger = logging.getLogger(__name__)
        self.embedding_service = embedding_service
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=2
        )
    
    def analyze_conversation_clusters(self, min_cluster_size: int = 3, n_components: int = 50) -> Dict[str, Any]:
        """
        Perform clustering analysis on conversation embeddings
        """
        try:
            # Get embeddings and metadata
            embeddings = self.embedding_service.get_all_embeddings()
            metadata = self.embedding_service.get_conversation_metadata()
            
            if len(embeddings) == 0:
                return {"clusters": [], "stats": {"total_conversations": 0}}
            
            # Reduce dimensionality with UMAP
            umap_reducer = umap.UMAP(
                n_components=min(n_components, len(embeddings) - 1),
                random_state=42,
                min_dist=0.1,
                n_neighbors=min(15, len(embeddings) - 1)
            )
            
            reduced_embeddings = umap_reducer.fit_transform(embeddings)
            
            # Perform clustering with HDBSCAN
            clusterer = HDBSCAN(
                min_cluster_size=min_cluster_size,
                metric='euclidean',
                cluster_selection_method='eom'
            )
            
            cluster_labels = clusterer.fit_predict(reduced_embeddings)
            
            # Organize results
            clusters = self._organize_clusters(cluster_labels, metadata, reduced_embeddings)
            
            # Generate cluster statistics
            stats = self._generate_cluster_stats(cluster_labels, metadata)
            
            return {
                "clusters": clusters,
                "stats": stats,
                "umap_coordinates": reduced_embeddings.tolist(),
                "cluster_labels": cluster_labels.tolist()
            }
            
        except Exception as e:
            self.logger.error(f"Error in clustering analysis: {e}")
            return {"clusters": [], "stats": {"error": str(e)}}
    
    def _organize_clusters(self, cluster_labels: np.ndarray, metadata: List[Dict], coordinates: np.ndarray) -> List[Dict[str, Any]]:
        """
        Organize clustering results into structured format
        """
        clusters = []
        unique_labels = set(cluster_labels)
        
        for label in unique_labels:
            if label == -1:  # Skip noise points
                continue
            
            # Get conversations in this cluster
            cluster_mask = cluster_labels == label
            cluster_metadata = [metadata[i] for i in range(len(metadata)) if cluster_mask[i]]
            cluster_coords = coordinates[cluster_mask]
            
            # Extract keywords from titles
            titles = [meta.get('title', '') for meta in cluster_metadata if meta.get('title')]
            keywords = self._extract_keywords_from_titles(titles)
            
            # Calculate centroid
            centroid = np.mean(cluster_coords, axis=0)
            
            # Analyze completion patterns
            completion_analysis = self._analyze_completion_patterns(cluster_metadata)
            
            cluster_info = {
                "id": f"cluster_{label}",
                "label": label,
                "name": self._generate_cluster_name(keywords, titles),
                "size": int(np.sum(cluster_mask)),
                "conversations": [meta['conversation_id'] for meta in cluster_metadata],
                "keywords": keywords[:10],  # Top 10 keywords
                "centroid": centroid.tolist(),
                "completion_rate": completion_analysis['completion_rate'],
                "avg_message_count": completion_analysis['avg_message_count'],
                "date_range": completion_analysis['date_range'],
                "top_titles": titles[:5]  # Top 5 titles for reference
            }
            
            clusters.append(cluster_info)
        
        # Sort clusters by size (largest first)
        clusters.sort(key=lambda x: x['size'], reverse=True)
        
        return clusters
    
    def _extract_keywords_from_titles(self, titles: List[str]) -> List[str]:
        """
        Extract meaningful keywords from conversation titles
        """
        if not titles:
            return []
        
        try:
            # Clean and combine titles
            cleaned_titles = []
            for title in titles:
                if title and len(title.strip()) > 0:
                    # Remove common patterns and clean
                    cleaned = re.sub(r'[^\w\s]', ' ', title.lower())
                    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
                    cleaned_titles.append(cleaned)
            
            if not cleaned_titles:
                return []
            
            # Use TF-IDF to extract keywords
            tfidf_matrix = self.vectorizer.fit_transform(cleaned_titles)
            feature_names = self.vectorizer.get_feature_names_out()
            
            # Get average TF-IDF scores
            mean_scores = np.mean(tfidf_matrix.toarray(), axis=0)
            
            # Get top keywords
            top_indices = np.argsort(mean_scores)[-20:][::-1]
            keywords = [feature_names[i] for i in top_indices if mean_scores[i] > 0]
            
            return keywords
            
        except Exception as e:
            self.logger.warning(f"Error extracting keywords: {e}")
            # Fallback: simple word frequency
            all_text = ' '.join(titles).lower()
            words = re.findall(r'\b\w+\b', all_text)
            word_freq = Counter(words)
            return [word for word, count in word_freq.most_common(10) if len(word) > 2]
    
    def _generate_cluster_name(self, keywords: List[str], titles: List[str]) -> str:
        """
        Generate a descriptive name for a cluster
        """
        if not keywords:
            return "Untitled Cluster"
        
        # Use top keywords to create name
        top_keywords = keywords[:3]
        name = ' & '.join(top_keywords).title()
        
        # Limit length
        if len(name) > 50:
            name = name[:47] + "..."
        
        return name
    
    def _analyze_completion_patterns(self, cluster_metadata: List[Dict]) -> Dict[str, Any]:
        """
        Analyze completion patterns within a cluster
        """
        if not cluster_metadata:
            return {
                "completion_rate": 0.0,
                "avg_message_count": 0,
                "date_range": {"start": None, "end": None}
            }
        
        message_counts = [meta.get('message_count', 0) for meta in cluster_metadata]
        avg_message_count = np.mean(message_counts) if message_counts else 0
        
        # Simple heuristic for completion: conversations with more messages are more "complete"
        # This could be enhanced with more sophisticated analysis
        completion_threshold = max(5, avg_message_count * 0.8)
        completed_count = sum(1 for count in message_counts if count >= completion_threshold)
        completion_rate = completed_count / len(message_counts) if message_counts else 0
        
        # Date range analysis
        dates = []
        for meta in cluster_metadata:
            date_str = meta.get('created_at', '')
            if date_str:
                try:
                    # Handle different date formats
                    if isinstance(date_str, (int, float)):
                        date = datetime.fromtimestamp(date_str)
                    else:
                        # Try common ISO format
                        date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    dates.append(date)
                except:
                    continue
        
        date_range = {
            "start": min(dates).isoformat() if dates else None,
            "end": max(dates).isoformat() if dates else None
        }
        
        return {
            "completion_rate": float(completion_rate),
            "avg_message_count": float(avg_message_count),
            "date_range": date_range
        }
    
    def _generate_cluster_stats(self, cluster_labels: np.ndarray, metadata: List[Dict]) -> Dict[str, Any]:
        """
        Generate overall clustering statistics
        """
        unique_labels = set(cluster_labels)
        noise_count = np.sum(cluster_labels == -1)
        
        return {
            "total_conversations": len(cluster_labels),
            "total_clusters": len(unique_labels) - (1 if -1 in unique_labels else 0),
            "noise_conversations": int(noise_count),
            "clustered_conversations": len(cluster_labels) - int(noise_count),
            "clustering_efficiency": float((len(cluster_labels) - noise_count) / len(cluster_labels)) if len(cluster_labels) > 0 else 0
        }
    
    def generate_insights(self, clusters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Generate actionable insights from clustering analysis
        """
        insights = []
        
        try:
            # Find unfinished projects
            unfinished_clusters = [c for c in clusters if c['completion_rate'] < 0.5 and c['size'] >= 2]
            for cluster in unfinished_clusters[:5]:  # Top 5 unfinished
                insights.append({
                    "type": "unfinished",
                    "title": f"Unfinished Project: {cluster['name']}",
                    "description": f"You have {cluster['size']} conversations about {cluster['name']} with low completion rate ({cluster['completion_rate']:.1%}). Consider revisiting these topics.",
                    "actionable": True,
                    "related_conversations": cluster['conversations'],
                    "confidence": min(0.9, cluster['size'] / 10),
                    "metadata": {
                        "cluster_id": cluster['id'],
                        "completion_rate": cluster['completion_rate'],
                        "size": cluster['size']
                    }
                })
            
            # Find emerging patterns
            recent_clusters = self._find_recent_activity_clusters(clusters)
            for cluster in recent_clusters[:3]:
                insights.append({
                    "type": "pattern",
                    "title": f"Emerging Interest: {cluster['name']}",
                    "description": f"You've been exploring {cluster['name']} recently. This appears to be a growing area of interest.",
                    "actionable": False,
                    "related_conversations": cluster['conversations'],
                    "confidence": 0.7,
                    "metadata": {
                        "cluster_id": cluster['id'],
                        "size": cluster['size']
                    }
                })
            
            # Generate continuation suggestions
            for cluster in unfinished_clusters[:3]:
                suggestions = self._generate_continuation_suggestions(cluster)
                if suggestions:
                    insights.append({
                        "type": "suggestion",
                        "title": f"Continue {cluster['name']}",
                        "description": f"Suggested next steps: {suggestions}",
                        "actionable": True,
                        "related_conversations": cluster['conversations'],
                        "confidence": 0.8,
                        "metadata": {
                            "cluster_id": cluster['id'],
                            "suggestions": suggestions
                        }
                    })
            
        except Exception as e:
            self.logger.error(f"Error generating insights: {e}")
            insights.append({
                "type": "error",
                "title": "Analysis Error",
                "description": "Unable to generate insights due to processing error.",
                "actionable": False,
                "related_conversations": [],
                "confidence": 0.0
            })
        
        return insights
    
    def _find_recent_activity_clusters(self, clusters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Find clusters with recent activity
        """
        recent_clusters = []
        cutoff_date = datetime.now() - timedelta(days=30)
        
        for cluster in clusters:
            if cluster['date_range']['end']:
                try:
                    end_date = datetime.fromisoformat(cluster['date_range']['end'].replace('Z', '+00:00'))
                    if end_date > cutoff_date:
                        recent_clusters.append(cluster)
                except:
                    continue
        
        return sorted(recent_clusters, key=lambda x: x['size'], reverse=True)
    
    def _generate_continuation_suggestions(self, cluster: Dict[str, Any]) -> str:
        """
        Generate specific suggestions for continuing unfinished projects
        """
        keywords = cluster.get('keywords', [])
        completion_rate = cluster.get('completion_rate', 0)
        
        suggestions = []
        
        if 'code' in keywords or 'programming' in keywords or 'script' in keywords:
            suggestions.append("Review and test existing code")
            suggestions.append("Add documentation or comments")
            suggestions.append("Implement missing features")
        
        if 'design' in keywords or 'ui' in keywords or 'interface' in keywords:
            suggestions.append("Create mockups or wireframes")
            suggestions.append("Gather user feedback")
            suggestions.append("Refine visual design")
        
        if 'research' in keywords or 'analysis' in keywords or 'study' in keywords:
            suggestions.append("Compile findings into a report")
            suggestions.append("Conduct additional research")
            suggestions.append("Create actionable recommendations")
        
        if completion_rate < 0.3:
            suggestions.append("Break down into smaller tasks")
            suggestions.append("Set specific milestones")
        
        if not suggestions:
            suggestions.append("Review previous conversations")
            suggestions.append("Define next concrete steps")
            suggestions.append("Set completion goals")
        
        return " • ".join(suggestions[:3])  # Return top 3 suggestions