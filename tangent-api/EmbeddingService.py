import os
import json
import numpy as np
import requests
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings
import logging

class EmbeddingService:
    def __init__(self, model_name: str = 'all-minilm:latest', persist_directory: str = './chroma_db', ollama_base_url: str = 'http://localhost:11434'):
        """
        Initialize the embedding service with Ollama and ChromaDB
        """
        self.logger = logging.getLogger(__name__)
        self.model_name = model_name
        self.ollama_base_url = ollama_base_url
        self.persist_directory = persist_directory
        
        # Initialize ChromaDB
        self.client = chromadb.PersistentClient(path=persist_directory)
        self.collection = self.client.get_or_create_collection(
            name="conversations",
            metadata={"hnsw:space": "cosine"}
        )
        
    def generate_embeddings(self, texts: List[str]) -> np.ndarray:
        """
        Generate embeddings for a list of texts using Ollama
        """
        try:
            embeddings = []
            for text in texts:
                response = requests.post(
                    f"{self.ollama_base_url}/api/embed",
                    json={
                        "model": self.model_name,
                        "input": text
                    },
                    timeout=30
                )
                response.raise_for_status()
                result = response.json()
                embeddings.append(result["embeddings"][0])
            
            return np.array(embeddings)
        except Exception as e:
            self.logger.error(f"Error generating embeddings: {e}")
            raise
    
    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generate embedding for a single text using Ollama (async compatible)
        """
        try:
            response = requests.post(
                f"{self.ollama_base_url}/api/embed",
                json={
                    "model": self.model_name,
                    "input": text
                },
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            return result["embeddings"][0]
        except Exception as e:
            self.logger.error(f"Error generating single embedding: {e}")
            return None
    
    def extract_conversation_text(self, conversation: Dict[str, Any]) -> str:
        """
        Extract meaningful text from a conversation object for embedding
        """
        text_parts = []
        
        # Add conversation title if available
        if 'title' in conversation:
            text_parts.append(conversation['title'])
        
        # Extract messages
        messages = conversation.get('mapping', {}) if 'mapping' in conversation else conversation.get('messages', [])
        
        if isinstance(messages, dict):
            # ChatGPT format with mapping
            for node_id, node in messages.items():
                if node.get('message') and node['message'].get('content'):
                    content = node['message']['content']
                    if isinstance(content, dict):
                        if 'parts' in content:
                            text_parts.extend(content['parts'])
                    elif isinstance(content, str):
                        text_parts.append(content)
        elif isinstance(messages, list):
            # Claude format with message list
            for message in messages:
                if isinstance(message, dict):
                    if 'content' in message:
                        if isinstance(message['content'], list):
                            for content_item in message['content']:
                                if isinstance(content_item, dict) and 'text' in content_item:
                                    text_parts.append(content_item['text'])
                                elif isinstance(content_item, str):
                                    text_parts.append(content_item)
                        elif isinstance(message['content'], str):
                            text_parts.append(message['content'])
        
        # Join all text parts
        full_text = ' '.join(str(part) for part in text_parts if part)
        return full_text[:8000]  # Limit text length for embedding
    
    def store_conversation_embedding(self, conversation_id: str, conversation: Dict[str, Any], metadata: Dict[str, Any] = None):
        """
        Generate and store embedding for a single conversation
        """
        try:
            text = self.extract_conversation_text(conversation)
            if not text.strip():
                self.logger.warning(f"No text extracted for conversation {conversation_id}")
                return
            
            embedding = self.generate_embeddings([text])[0]
            
            # Prepare metadata
            meta = {
                'conversation_id': conversation_id,
                'text_length': len(text),
                'message_count': self._count_messages(conversation),
                'created_at': conversation.get('create_time', conversation.get('created_at', '')),
                'title': conversation.get('title', '')[:100],  # Limit title length
            }
            if metadata:
                meta.update(metadata)
            
            # Store in ChromaDB
            self.collection.add(
                embeddings=[embedding.tolist()],
                documents=[text],
                metadatas=[meta],
                ids=[conversation_id]
            )
            
            self.logger.info(f"Stored embedding for conversation {conversation_id}")
            
        except Exception as e:
            self.logger.error(f"Error storing embedding for conversation {conversation_id}: {e}")
            raise
    
    def _count_messages(self, conversation: Dict[str, Any]) -> int:
        """
        Count the number of messages in a conversation
        """
        messages = conversation.get('mapping', {}) if 'mapping' in conversation else conversation.get('messages', [])
        
        if isinstance(messages, dict):
            return len([node for node in messages.values() if node.get('message')])
        elif isinstance(messages, list):
            return len(messages)
        
        return 0
    
    def batch_store_conversations(self, conversations: Dict[str, Dict[str, Any]], batch_size: int = 50):
        """
        Store embeddings for multiple conversations in batches
        """
        conversation_ids = list(conversations.keys())
        
        for i in range(0, len(conversation_ids), batch_size):
            batch_ids = conversation_ids[i:i + batch_size]
            
            try:
                for conv_id in batch_ids:
                    self.store_conversation_embedding(conv_id, conversations[conv_id])
                
                self.logger.info(f"Processed batch {i//batch_size + 1}/{(len(conversation_ids) + batch_size - 1)//batch_size}")
                
            except Exception as e:
                self.logger.error(f"Error processing batch starting at index {i}: {e}")
                continue
    
    def search_similar_conversations(self, query_text: str, n_results: int = 10) -> List[Dict[str, Any]]:
        """
        Find conversations similar to the query text
        """
        try:
            query_embedding = self.generate_embeddings([query_text])[0]
            
            results = self.collection.query(
                query_embeddings=[query_embedding.tolist()],
                n_results=n_results,
                include=['metadatas', 'documents', 'distances']
            )
            
            # Format results
            formatted_results = []
            for i in range(len(results['ids'][0])):
                formatted_results.append({
                    'conversation_id': results['ids'][0][i],
                    'metadata': results['metadatas'][0][i],
                    'document': results['documents'][0][i],
                    'similarity': 1 - results['distances'][0][i]  # Convert distance to similarity
                })
            
            return formatted_results
            
        except Exception as e:
            self.logger.error(f"Error searching conversations: {e}")
            return []
    
    def get_all_embeddings(self) -> np.ndarray:
        """
        Retrieve all embeddings for clustering analysis
        """
        try:
            # Get all items from the collection
            results = self.collection.get(include=['embeddings', 'metadatas'])
            
            if not results['embeddings']:
                return np.array([])
            
            embeddings = np.array(results['embeddings'])
            return embeddings
            
        except Exception as e:
            self.logger.error(f"Error retrieving embeddings: {e}")
            return np.array([])
    
    def get_conversation_metadata(self) -> List[Dict[str, Any]]:
        """
        Retrieve metadata for all stored conversations
        """
        try:
            results = self.collection.get(include=['metadatas'])
            return results['metadatas']
        except Exception as e:
            self.logger.error(f"Error retrieving metadata: {e}")
            return []
    
    def clear_collection(self):
        """
        Clear all stored conversations and embeddings
        """
        try:
            # Delete the collection and recreate it
            self.client.delete_collection(name="conversations")
            self.collection = self.client.get_or_create_collection(
                name="conversations",
                metadata={"hnsw:space": "cosine"}
            )
            self.logger.info("Cleared all conversation embeddings")
        except Exception as e:
            self.logger.error(f"Error clearing collection: {e}")
            raise
    
    def search_nodes(self, query: str, chat_id: str = None, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search for nodes based on semantic similarity to query
        """
        try:
            # Generate embedding for the query
            query_embedding = self.generate_embeddings([query])[0]
            
            # Build filter for specific chat if provided
            where_filter = None
            if chat_id:
                where_filter = {"chat_id": {"$eq": chat_id}}
            
            # Search in nodes collection
            results = self.nodes_collection.query(
                query_embeddings=[query_embedding.tolist()],
                n_results=limit,
                where=where_filter,
                include=['metadatas', 'documents', 'distances']
            )
            
            # Format results
            formatted_results = []
            if results['ids'] and results['ids'][0]:
                for i in range(len(results['ids'][0])):
                    formatted_results.append({
                        'node_id': results['ids'][0][i],
                        'metadata': results['metadatas'][0][i],
                        'content': results['documents'][0][i],
                        'similarity': 1 - results['distances'][0][i]
                    })
            
            return formatted_results
            
        except Exception as e:
            self.logger.error(f"Error searching nodes: {e}")
            return []
    
    def store_node_embedding(self, node_id: str, node_content: str, chat_id: str, metadata: Dict[str, Any] = None):
        """
        Store embedding for a single node
        """
        try:
            if not hasattr(self, 'nodes_collection'):
                self.nodes_collection = self.client.get_or_create_collection(
                    name="nodes",
                    metadata={"hnsw:space": "cosine"}
                )
            
            if not node_content.strip():
                self.logger.warning(f"No content for node {node_id}")
                return
            
            embedding = self.generate_embeddings([node_content])[0]
            
            # Prepare metadata
            meta = {
                'node_id': node_id,
                'chat_id': chat_id,
                'content_length': len(node_content),
                'created_at': metadata.get('created_at', '') if metadata else ''
            }
            if metadata:
                meta.update(metadata)
            
            # Store in ChromaDB
            self.nodes_collection.upsert(
                embeddings=[embedding.tolist()],
                documents=[node_content],
                metadatas=[meta],
                ids=[node_id]
            )
            
            self.logger.info(f"Stored embedding for node {node_id}")
            
        except Exception as e:
            self.logger.error(f"Error storing node embedding {node_id}: {e}")
            raise