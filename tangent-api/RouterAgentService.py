import json
import requests
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class RouterAgentService:
    """Service for using LLM routing agent to analyze conversations for reflection generation"""
    
    def __init__(self):
        # Default to Ollama for router agent analysis (local models)
        self.default_api = "ollama"
        self.default_model = "qwen3:4b"  # Use 4b model for better analysis
        self.api_key = None  # Not needed for Ollama
        self.ollama_base_url = "http://localhost:11434"
        
    def analyze_conversation_for_reflection(self, messages: List[Dict], trigger_data: Dict) -> Dict:
        """
        Use multi-pass recursive conversation analysis to generate comprehensive reflection data
        
        Args:
            messages: List of conversation messages
            trigger_data: Information about what triggered the reflection
                - trigger_type: 'upvote' or 'thanks'
                - trigger_message_index: Index of message that was upvoted/thanked
                - node_id: Source node ID
                - chat_id: Source chat ID
        
        Returns:
            Dictionary with reflection analysis results
        """
        try:
            # Pass 1: Initial analysis - problem identification and context
            pass1_data = self._analysis_pass_1_problem_identification(messages, trigger_data)
            
            # Pass 2: Technical deep dive - solution analysis and patterns
            pass2_data = self._analysis_pass_2_technical_analysis(messages, trigger_data, pass1_data)
            
            # Pass 3: Learning synthesis - insights and knowledge extraction
            pass3_data = self._analysis_pass_3_learning_synthesis(messages, trigger_data, pass1_data, pass2_data)
            
            # Combine all passes into final reflection
            reflection_data = self._combine_analysis_passes(pass1_data, pass2_data, pass3_data)
            
            # Add source information
            reflection_data.update({
                'source_node_id': trigger_data['node_id'],
                'source_chat_id': trigger_data['chat_id'],
                'triggered_by': trigger_data['trigger_type'],
                'trigger_message_index': trigger_data['trigger_message_index'],
                'conversation_length': len(messages),
                'message_range_start': max(0, trigger_data['trigger_message_index'] - 10),
                'message_range_end': min(len(messages) - 1, trigger_data['trigger_message_index'])
            })
            
            return reflection_data
            
        except Exception as e:
            logger.error(f"Error in multi-pass conversation analysis: {str(e)}")
            # Return a basic reflection structure on failure
            return self._create_fallback_reflection(messages, trigger_data)
    
    def _build_reflection_analysis_prompt(self, messages: List[Dict], trigger_data: Dict) -> str:
        """Build the prompt for conversation analysis"""
        
        # Convert messages to readable format
        conversation_text = ""
        for i, msg in enumerate(messages):
            role = "User" if msg['role'] == 'user' else "Assistant"
            content = msg.get('content', '')
            if isinstance(content, list):
                # Handle complex content (like with images)
                content = ' '.join([item.get('text', '') for item in content if isinstance(item, dict) and 'text' in item])
            conversation_text += f"Message {i} ({role}): {content}\\n\\n"
        
        trigger_info = f"The user {'upvoted message' if trigger_data['trigger_type'] == 'upvote' else 'expressed thanks after message'} {trigger_data['trigger_message_index']}"
        
        prompt = f"""You are an AI reflection analyst tasked with analyzing a conversation where a breakthrough moment occurred. Your job is to extract key insights about what problem was solved and how.

CONVERSATION:
{conversation_text}

TRIGGER: {trigger_info}

Please analyze this conversation and provide a structured reflection in the following JSON format:

{{
    "problem_statement": "Clear description of the main problem that was being solved",
    "technical_challenge": "Specific technical challenge or obstacle that was overcome", 
    "solution_breakthrough": "The key insight or approach that led to the solution",
    "failed_approaches": ["List of approaches that were tried but didn't work"],
    "key_insights": ["List of 3-5 key insights learned from this problem-solving process"],
    "technologies": ["List of technologies, frameworks, or tools involved"],
    "code_patterns": ["List of specific code patterns or techniques used"],
    "error_patterns": ["List of common errors or issues encountered"],
    "domains": ["List of domain categories like 'frontend', 'backend', 'devops', etc."],
    "complexity": "low|medium|high|expert",
    "iteration_count": "Number of attempts/iterations before breakthrough (estimate)",
    "time_to_solution": "Estimated time from problem to solution in minutes",
    "keywords": ["List of technical keywords for indexing and search"]
}}

ANALYSIS GUIDELINES:
1. Focus on the technical problem-solving journey
2. Identify what made the breakthrough possible
3. Extract reusable insights that could help with similar future problems
4. Be specific about technologies and approaches used
5. Consider both what worked and what didn't work
6. Extract keywords that would help find this reflection later

Provide only the JSON response with no additional text."""

        return prompt
    
    def _call_llm_api(self, prompt: str) -> str:
        """Call the LLM API to analyze the conversation"""
        if self.default_api == "ollama":
            return self._call_ollama_api(prompt)
        elif self.default_api == "openrouter":
            return self._call_openrouter_api(prompt)
        else:
            raise ValueError(f"Unsupported API: {self.default_api}")
    
    def _call_ollama_api(self, prompt: str) -> str:
        """Call Ollama API with the given prompt"""
        try:
            response = requests.post(
                f"{self.ollama_base_url}/api/generate",
                json={
                    'model': self.default_model,
                    'prompt': prompt,
                    'stream': False,
                    'options': {
                        'temperature': 0.1,
                        'top_p': 0.9,
                        'num_predict': 1000  # Limit output for faster response
                    }
                },
                timeout=60  # Longer timeout for local models
            )
            
            response.raise_for_status()
            result = response.json()
            
            return result.get('response', '')
            
        except Exception as e:
            logger.error(f"Ollama API call failed: {str(e)}")
            raise
    
    def _call_openrouter_api(self, prompt: str) -> str:
        """Call OpenRouter API for conversation analysis"""
        try:
            response = requests.post(
                'https://openrouter.ai/api/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {self.api_key}',
                    'HTTP-Referer': 'http://localhost:5050',
                    'X-Title': 'Tangent Reflection System',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': self.default_model,
                    'messages': [
                        {'role': 'user', 'content': prompt}
                    ],
                    'temperature': 0.1,  # Low temperature for consistent analysis
                    'max_tokens': 2000
                },
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            
            return result['choices'][0]['message']['content']
            
        except Exception as e:
            logger.error(f"OpenRouter API call failed: {str(e)}")
            raise
    
    def _parse_reflection_response(self, response: str) -> Dict:
        """Parse the LLM response into structured reflection data"""
        try:
            # Try to extract JSON from the response
            response = response.strip()
            
            # Find JSON block if wrapped in markdown
            if '```json' in response:
                start = response.find('```json') + 7
                end = response.find('```', start)
                response = response[start:end].strip()
            elif '```' in response:
                start = response.find('```') + 3
                end = response.find('```', start)
                response = response[start:end].strip()
            
            # Parse JSON
            reflection_data = json.loads(response)
            
            # Validate required fields
            required_fields = ['problem_statement', 'technical_challenge', 'solution_breakthrough', 'key_insights', 'keywords']
            for field in required_fields:
                if field not in reflection_data:
                    raise ValueError(f"Missing required field: {field}")
            
            # Ensure lists are actually lists
            list_fields = ['failed_approaches', 'key_insights', 'technologies', 'code_patterns', 'error_patterns', 'domains', 'keywords']
            for field in list_fields:
                if field in reflection_data and not isinstance(reflection_data[field], list):
                    reflection_data[field] = [reflection_data[field]] if reflection_data[field] else []
            
            # Set defaults for optional fields
            reflection_data.setdefault('failed_approaches', [])
            reflection_data.setdefault('technologies', [])
            reflection_data.setdefault('code_patterns', [])
            reflection_data.setdefault('error_patterns', [])
            reflection_data.setdefault('domains', [])
            reflection_data.setdefault('complexity', 'medium')
            reflection_data.setdefault('iteration_count', None)
            reflection_data.setdefault('time_to_solution', None)
            
            return reflection_data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.error(f"Response was: {response}")
            raise ValueError(f"Invalid JSON response from LLM: {e}")
        except Exception as e:
            logger.error(f"Error parsing reflection response: {e}")
            raise
    
    def _analysis_pass_1_problem_identification(self, messages: List[Dict], trigger_data: Dict) -> Dict:
        """
        Pass 1: Identify the core problem and high-level context
        """
        try:
            conversation_text = self._format_conversation_for_analysis(messages)
            trigger_info = f"The user {'upvoted message' if trigger_data['trigger_type'] == 'upvote' else 'expressed thanks after message'} {trigger_data['trigger_message_index']}"
            
            prompt = f"""You are an expert problem analyst. Analyze this conversation to identify the core problem that was being solved.

CONVERSATION:
{conversation_text}

TRIGGER: {trigger_info}

Focus on identifying:
1. What was the user trying to achieve?
2. What was the main obstacle or challenge?
3. What domain/context is this problem in?
4. How complex was the problem?

Respond in JSON format:
{{
    "problem_statement": "Clear, concise description of the main problem",
    "user_goal": "What the user was ultimately trying to achieve",
    "problem_domain": "Technical domain (e.g., 'frontend', 'backend', 'devops', 'ui-design')",
    "complexity_level": "low|medium|high|expert",
    "context_keywords": ["keyword1", "keyword2", "keyword3"],
    "problem_type": "bug-fix|feature-implementation|optimization|learning|debugging"
}}"""

            response = self._call_llm_api(prompt)
            return self._parse_json_response(response)
            
        except Exception as e:
            logger.error(f"Error in analysis pass 1: {e}")
            return {
                "problem_statement": "Problem identification failed",
                "user_goal": "Unknown goal",
                "problem_domain": "general",
                "complexity_level": "medium",
                "context_keywords": ["analysis-failed"],
                "problem_type": "unknown"
            }
    
    def _analysis_pass_2_technical_analysis(self, messages: List[Dict], trigger_data: Dict, pass1_data: Dict) -> Dict:
        """
        Pass 2: Deep dive into technical details, solutions, and patterns
        """
        try:
            conversation_text = self._format_conversation_for_analysis(messages)
            context = f"Previous analysis identified this as a {pass1_data.get('complexity_level', 'medium')} complexity {pass1_data.get('problem_type', 'unknown')} problem in the {pass1_data.get('problem_domain', 'general')} domain."
            
            prompt = f"""You are a technical solution analyst. Given the conversation and previous analysis, examine the technical details of how the problem was solved.

PREVIOUS ANALYSIS:
{context}
Problem: {pass1_data.get('problem_statement', 'Unknown problem')}

CONVERSATION:
{conversation_text}

Focus on:
1. What specific technical approaches were tried?
2. Which approaches failed and why?
3. What was the breakthrough solution?
4. What code patterns, technologies, or methods were involved?
5. What errors or obstacles were encountered?

Respond in JSON format:
{{
    "solution_breakthrough": "Description of the key solution that worked",
    "failed_approaches": ["approach1 that failed", "approach2 that failed"],
    "technologies_used": ["tech1", "tech2", "tech3"],
    "code_patterns": ["pattern1", "pattern2"],
    "error_patterns": ["error_type1", "error_type2"],
    "technical_keywords": ["keyword1", "keyword2", "keyword3"],
    "iteration_count": number_of_attempts_before_success,
    "breakthrough_moment": "What specifically led to the solution"
}}"""

            response = self._call_llm_api(prompt)
            return self._parse_json_response(response)
            
        except Exception as e:
            logger.error(f"Error in analysis pass 2: {e}")
            return {
                "solution_breakthrough": "Technical analysis failed",
                "failed_approaches": [],
                "technologies_used": [],
                "code_patterns": [],
                "error_patterns": [],
                "technical_keywords": ["analysis-failed"],
                "iteration_count": None,
                "breakthrough_moment": "Unknown"
            }
    
    def _analysis_pass_3_learning_synthesis(self, messages: List[Dict], trigger_data: Dict, pass1_data: Dict, pass2_data: Dict) -> Dict:
        """
        Pass 3: Extract insights, learning patterns, and meta-knowledge
        """
        try:
            conversation_text = self._format_conversation_for_analysis(messages)
            
            context = f"""Problem: {pass1_data.get('problem_statement', 'Unknown')}
Domain: {pass1_data.get('problem_domain', 'general')}
Solution: {pass2_data.get('solution_breakthrough', 'Unknown solution')}
Technologies: {', '.join(pass2_data.get('technologies_used', []))}"""
            
            prompt = f"""You are a learning pattern analyst. Synthesize the conversation to extract deeper insights and transferable knowledge.

CONTEXT FROM PREVIOUS ANALYSIS:
{context}

CONVERSATION:
{conversation_text}

Focus on:
1. What key insights can be learned from this solution?
2. What patterns could help with similar problems?
3. What mistakes were made that others could avoid?
4. What mental models or approaches were effective?
5. How could this knowledge be applied to related problems?

Respond in JSON format:
{{
    "key_insights": ["insight1", "insight2", "insight3"],
    "transferable_patterns": ["pattern1", "pattern2"],
    "common_mistakes": ["mistake1", "mistake2"],
    "mental_models": ["model1", "model2"],
    "related_domains": ["domain1", "domain2"],
    "learning_keywords": ["keyword1", "keyword2"],
    "difficulty_indicators": ["what made this hard"],
    "success_factors": ["what led to success"],
    "time_to_solution_estimate": "minutes_from_problem_to_solution"
}}"""

            response = self._call_llm_api(prompt)
            return self._parse_json_response(response)
            
        except Exception as e:
            logger.error(f"Error in analysis pass 3: {e}")
            return {
                "key_insights": ["Learning synthesis failed"],
                "transferable_patterns": [],
                "common_mistakes": [],
                "mental_models": [],
                "related_domains": [],
                "learning_keywords": ["analysis-failed"],
                "difficulty_indicators": [],
                "success_factors": [],
                "time_to_solution_estimate": None
            }
    
    def _combine_analysis_passes(self, pass1_data: Dict, pass2_data: Dict, pass3_data: Dict) -> Dict:
        """
        Combine the results of all three analysis passes into a comprehensive reflection
        """
        # Merge keywords from all passes
        all_keywords = []
        all_keywords.extend(pass1_data.get('context_keywords', []))
        all_keywords.extend(pass2_data.get('technical_keywords', []))
        all_keywords.extend(pass3_data.get('learning_keywords', []))
        
        # Remove duplicates while preserving order
        keywords = list(dict.fromkeys(all_keywords))
        
        # Combine domains
        domains = [pass1_data.get('problem_domain', 'general')]
        domains.extend(pass3_data.get('related_domains', []))
        domains = list(dict.fromkeys(domains))
        
        # Parse time to solution
        time_estimate = pass3_data.get('time_to_solution_estimate')
        time_to_solution = None
        if time_estimate and isinstance(time_estimate, str):
            # Try to extract number from string like "15_minutes" or "2_hours"
            import re
            match = re.search(r'(\d+)', time_estimate)
            if match:
                time_to_solution = int(match.group(1))
                if 'hour' in time_estimate.lower():
                    time_to_solution *= 60
        
        return {
            'problem_statement': pass1_data.get('problem_statement', 'Unknown problem'),
            'technical_challenge': pass2_data.get('solution_breakthrough', 'Unknown challenge'),
            'solution_breakthrough': pass2_data.get('solution_breakthrough', 'Unknown solution'),
            'failed_approaches': pass2_data.get('failed_approaches', []),
            'key_insights': pass3_data.get('key_insights', []),
            'technologies': pass2_data.get('technologies_used', []),
            'code_patterns': pass2_data.get('code_patterns', []),
            'error_patterns': pass2_data.get('error_patterns', []),
            'domains': domains,
            'complexity': pass1_data.get('complexity_level', 'medium'),
            'iteration_count': pass2_data.get('iteration_count'),
            'time_to_solution': time_to_solution,
            'keywords': keywords[:10]  # Limit to top 10 keywords
        }
    
    def _format_conversation_for_analysis(self, messages: List[Dict]) -> str:
        """Format conversation messages for LLM analysis"""
        conversation_text = ""
        for i, msg in enumerate(messages):
            role = "User" if msg['role'] == 'user' else "Assistant"
            content = msg.get('content', '')
            if isinstance(content, list):
                # Handle complex content (like with images)
                content = ' '.join([item.get('text', '') for item in content if isinstance(item, dict) and 'text' in item])
            conversation_text += f"Message {i} ({role}): {content}\n\n"
        return conversation_text
    
    def _parse_json_response(self, response: str) -> Dict:
        """Parse JSON response from LLM with error handling"""
        try:
            # Try to find JSON in the response
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                return json.loads(json_str)
            else:
                # If no JSON found, return empty dict
                logger.warning(f"No JSON found in response: {response[:200]}...")
                return {}
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.error(f"Response was: {response}")
            return {}
        except Exception as e:
            logger.error(f"Error parsing JSON response: {e}")
            return {}
    
    def _create_fallback_reflection(self, messages: List[Dict], trigger_data: Dict) -> Dict:
        """Create a basic reflection when LLM analysis fails"""
        # Extract some basic information from the conversation
        last_user_msg = None
        last_assistant_msg = None
        
        for msg in reversed(messages):
            if msg['role'] == 'user' and not last_user_msg:
                last_user_msg = msg.get('content', '')
            elif msg['role'] == 'assistant' and not last_assistant_msg:
                last_assistant_msg = msg.get('content', '')
            
            if last_user_msg and last_assistant_msg:
                break
        
        return {
            'problem_statement': f"Problem discussed in conversation (analysis failed)",
            'technical_challenge': f"Technical challenge that was addressed",
            'solution_breakthrough': f"Solution provided by assistant",
            'failed_approaches': [],
            'key_insights': ['Reflection generated from failed analysis'],
            'technologies': [],
            'code_patterns': [],
            'error_patterns': [],
            'domains': ['general'],
            'complexity': 'medium',
            'iteration_count': None,
            'time_to_solution': None,
            'keywords': ['fallback', 'analysis-failed']
        }
    
    def analyze_current_conversation_context(self, messages: List[Dict], include_suggestions: bool = True) -> Dict:
        """
        Analyze current conversation to identify context for reflection matching
        
        Args:
            messages: Current conversation messages
            include_suggestions: Whether to include reflection suggestions
            
        Returns:
            Dictionary with context analysis and optional reflection suggestions
        """
        try:
            # Build context analysis prompt
            context_prompt = self._build_context_analysis_prompt(messages)
            
            # Call LLM API
            response = self._call_llm_api(context_prompt)
            
            # Parse context response
            context_data = self._parse_context_response(response)
            
            # Add conversation metadata
            context_data['conversation_length'] = len(messages)
            context_data['recent_message_count'] = min(len(messages), 10)
            context_data['has_errors'] = self._detect_error_patterns(messages)
            context_data['conversation_stage'] = self._determine_conversation_stage(messages)
            
            return context_data
            
        except Exception as e:
            logger.error(f"Error in context analysis: {str(e)}")
            return {
                'technologies': [],
                'domains': [],
                'keywords': [],
                'problem_patterns': [],
                'complexity': 'medium'
            }
    
    def _build_context_analysis_prompt(self, messages: List[Dict]) -> str:
        """Build prompt for current conversation context analysis"""
        
        # Get recent messages (last 10)
        recent_messages = messages[-10:] if len(messages) > 10 else messages
        
        conversation_text = ""
        for i, msg in enumerate(recent_messages):
            role = "User" if msg['role'] == 'user' else "Assistant"
            content = msg.get('content', '')
            if isinstance(content, list):
                content = ' '.join([item.get('text', '') for item in content if isinstance(item, dict) and 'text' in item])
            conversation_text += f"{role}: {content}\\n\\n"
        
        prompt = f"""Extract technical information from this conversation:

CONVERSATION:
{conversation_text}

Return only a JSON object with these fields:
{{
    "technologies": ["react", "javascript"],
    "domains": ["frontend"],
    "keywords": ["useState", "hook", "rendering"],
    "problem_patterns": ["state management"],
    "complexity": "medium"
}}

Rules:
- technologies: frameworks, libraries, languages
- domains: frontend, backend, database, mobile, devops
- keywords: technical terms and concepts
- problem_patterns: types of issues being solved
- complexity: low, medium, high, or expert

Output only valid JSON, no other text."""

        return prompt
    
    def _parse_context_response(self, response: str) -> Dict:
        """Parse context analysis response"""
        try:
            response = response.strip()
            
            # Extract JSON
            if '```json' in response:
                start = response.find('```json') + 7
                end = response.find('```', start)
                response = response[start:end].strip()
            elif '```' in response:
                start = response.find('```') + 3
                end = response.find('```', start)
                response = response[start:end].strip()
            
            context_data = json.loads(response)
            
            # Ensure lists
            list_fields = ['technologies', 'domains', 'keywords', 'problem_patterns']
            for field in list_fields:
                if field not in context_data:
                    context_data[field] = []
                elif not isinstance(context_data[field], list):
                    context_data[field] = [context_data[field]] if context_data[field] else []
            
            context_data.setdefault('complexity', 'medium')
            
            return context_data
            
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Error parsing context response: {e}")
            return {
                'technologies': [],
                'domains': [],
                'keywords': [],
                'problem_patterns': [],
                'complexity': 'medium'
            }
    
    def _detect_error_patterns(self, messages: List[Dict]) -> bool:
        """Detect if conversation contains error patterns"""
        error_indicators = [
            'error', 'exception', 'failed', 'not working', 'broken', 'issue',
            'problem', 'bug', 'crash', 'undefined', 'null', '404', '500'
        ]
        
        recent_messages = messages[-5:] if len(messages) > 5 else messages
        for msg in recent_messages:
            content = str(msg.get('content', '')).lower()
            if any(indicator in content for indicator in error_indicators):
                return True
        return False
    
    def _determine_conversation_stage(self, messages: List[Dict]) -> str:
        """Determine what stage the conversation is in"""
        if len(messages) < 2:
            return 'initial'
        elif len(messages) < 5:
            return 'problem_definition'
        elif self._detect_error_patterns(messages):
            return 'troubleshooting'
        elif any('thank' in str(msg.get('content', '')).lower() for msg in messages[-3:]):
            return 'resolution'
        else:
            return 'problem_solving'
    
    def suggest_relevant_reflections(self, context_data: Dict, limit: int = 5) -> List[Dict]:
        """
        Suggest relevant reflections based on current conversation context using enhanced relevance scoring
        
        Args:
            context_data: Context analysis from current conversation
            limit: Maximum number of suggestions
            
        Returns:
            List of relevant reflection suggestions with contextual relevance scores
        """
        try:
            # Import here to avoid circular dependency
            from ReflectionService import ReflectionService
            reflection_service = ReflectionService()
            
            # Use enhanced contextual relevance scoring
            suggestions = reflection_service.get_contextual_reflection_suggestions(
                context_data, 
                limit=limit * 2,  # Get more candidates for better filtering
                min_score=0.2  # Lower threshold to get more candidates
            )
            
            # If no suggestions with enhanced scoring, fall back to basic search
            if not suggestions:
                # Build search criteria from context
                criteria = {
                    'domains': context_data.get('domains', []),
                    'technologies': context_data.get('technologies', []),
                    'keywords': context_data.get('keywords', []),
                    'complexity_range': self._get_complexity_range(context_data.get('complexity', 'medium'))
                }
                
                # Search for matching reflections
                suggestions = reflection_service.search_by_advanced_criteria(criteria)
                
                # Also try similarity search with context keywords
                if context_data.get('keywords'):
                    query_text = ' '.join(context_data['keywords'][:5])  # Use top 5 keywords
                    similar_reflections = reflection_service.search_reflections_by_similarity(
                        query_text, limit=limit, similarity_threshold=0.5  # Lower threshold
                    )
                    
                    # Combine and deduplicate
                    all_suggestions = suggestions + similar_reflections
                    seen_ids = set()
                    unique_suggestions = []
                    for suggestion in all_suggestions:
                        if suggestion['id'] not in seen_ids:
                            seen_ids.add(suggestion['id'])
                            unique_suggestions.append(suggestion)
                    
                    suggestions = unique_suggestions
                
                # Sort by relevance and limit
                suggestions.sort(key=lambda x: x.get('match_score', x.get('similarity_score', 0)), reverse=True)
            
            return suggestions[:limit]
            
        except Exception as e:
            logger.error(f"Error suggesting relevant reflections: {e}")
            return []
    
    def _get_complexity_range(self, complexity: str) -> tuple:
        """Get complexity range for search criteria"""
        complexity_map = {
            'low': (0.0, 0.3),
            'medium': (0.3, 0.7), 
            'high': (0.6, 0.9),
            'expert': (0.8, 1.0)
        }
        return complexity_map.get(complexity, (0.0, 1.0))